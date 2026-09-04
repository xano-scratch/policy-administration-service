import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  PencilLine,
  RefreshCw,
  XCircle,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import * as api from "@/lib/api";
import { can } from "@/lib/rbac";
import { money, fmtDate, fmtDateTime, label } from "@/lib/format";
import type { EndorseBody, PolicyEvent, Role } from "@/lib/api";

type EndorseKind = EndorseBody["kind"];
const ENDORSE_KINDS: EndorseKind[] = ["add_coverage", "remove_coverage", "change_limit", "change_deductible"];

const EVENT_ICON: Record<string, typeof FileText> = {
  "policy.quoted": FileText,
  "policy.bound": CheckCircle2,
  "policy.endorsed": PencilLine,
  "policy.renewed": RefreshCw,
  "policy.cancelled": XCircle,
};

function eventSummary(ev: PolicyEvent): string {
  const d = (ev.detail ?? {}) as Record<string, unknown>;
  switch (ev.event_type) {
    case "policy.quoted":
      return d.base_premium != null ? `Base premium ${money(d.base_premium as number)}` : "Quote opened";
    case "policy.endorsed":
      return `${label(String(d.kind ?? "change"))}: premium ${money(d.old_premium as number)} to ${money(d.new_premium as number)}`;
    case "policy.cancelled":
      return d.reason ? `Reason: ${String(d.reason)}` : "Cancelled";
    case "policy.renewed":
      return "Term rolled forward one period";
    case "policy.bound":
      return "Bound and activated";
    default:
      return "";
  }
}

export function PolicyDetail({ id, role, onBack }: { id: number; role: Role; onBack: () => void }) {
  const [data, setData] = useState<api.PolicyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);

  // endorsement form
  const [endKind, setEndKind] = useState<EndorseKind>("change_limit");
  const [endDesc, setEndDesc] = useState("Raise dwelling limit");
  const [endDelta, setEndDelta] = useState("150");

  // cancel form
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getPolicy(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load the policy.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(name: string, fn: () => Promise<unknown>, ok: string) {
    setAction(name);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setAction(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const policy = data.policy;
  if (!policy) return null; // guarded server-side (notfound precondition); narrow for the view
  const { policyholder, coverages, endorsements, events } = data;
  const isUW = can(role, "bind");
  const deltaPreview = policy.current_premium + (parseFloat(endDelta) || 0);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ArrowLeft /> Back to policies
        </Button>
        <div className="flex items-center gap-2">
          {policy.status === "quoted" && (
            <Button
              size="sm"
              onClick={() => void run("bind", () => api.bind(id), "Policy bound and activated.")}
              disabled={!isUW || action !== null}
              title={isUW ? "" : "Only an underwriter can bind"}
            >
              {action === "bind" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Bind
            </Button>
          )}
          {policy.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void run("renew", () => api.renew(id), "Policy renewed.")}
              disabled={!isUW || action !== null}
              title={isUW ? "" : "Only an underwriter can renew"}
            >
              {action === "renew" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Renew
            </Button>
          )}
          {policy.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelling((c) => !c)}
              disabled={!isUW || action !== null}
              title={isUW ? "" : "Only an underwriter can cancel"}
            >
              <XCircle /> Cancel
            </Button>
          )}
        </div>
      </div>

      {cancelling && policy.status !== "cancelled" && (
        <Card className="border-destructive/40">
          <CardContent className="space-y-3 p-4">
            <Label htmlFor="reason">Reason for cancellation</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this policy being cancelled?" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCancelling(false)}>
                Keep policy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!reason.trim() || action !== null}
                onClick={() =>
                  void run("cancel", () => api.cancel({ policy_id: id, reason }), "Policy cancelled.").then(() => {
                    setCancelling(false);
                    setReason("");
                  })
                }
              >
                {action === "cancel" ? <Loader2 className="animate-spin" /> : null} Confirm cancellation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header + facts */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <CardTitle className="font-mono text-lg">Policy #{policy.id}</CardTitle>
              <StatusBadge status={policy.status} />
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid grid-cols-2 gap-y-2">
              <dt className="text-muted-foreground">Policyholder</dt>
              <dd className="text-right font-medium">{policyholder?.name ?? "—"}</dd>
              <dt className="text-muted-foreground">Segment</dt>
              <dd className="text-right capitalize">{label(policyholder?.segment ?? "")}</dd>
              <dt className="text-muted-foreground">Product</dt>
              <dd className="text-right capitalize">{label(policy.product)}</dd>
              <dt className="text-muted-foreground">Term</dt>
              <dd className="text-right">{policy.term_months} months</dd>
              <dt className="text-muted-foreground">Effective</dt>
              <dd className="text-right">{fmtDate(policy.effective_date)}</dd>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="text-right">{fmtDate(policy.expiration_date)}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Base premium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{money(policy.base_premium)}</div>
          </CardContent>
        </Card>
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Current premium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-primary text-2xl font-semibold tabular-nums">{money(policy.current_premium)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coverages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Coverages</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Limit</TableHead>
                <TableHead className="text-right">Deductible</TableHead>
                <TableHead className="text-right">Rate factor</TableHead>
                <TableHead className="text-right">Contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coverages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No coverages.
                  </TableCell>
                </TableRow>
              ) : (
                coverages.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="capitalize">{label(c.kind)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.limit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.deductible)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.rate_factor}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(Math.max(0, c.limit * c.rate_factor - c.deductible * 0.05))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Endorsement form (active only) */}
      {policy.status === "active" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Endorse this policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr_1fr]">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select value={endKind} onValueChange={(v) => setEndKind(v as EndorseKind)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENDORSE_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {label(k)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-desc">Description</Label>
                <Input id="end-desc" value={endDesc} onChange={(e) => setEndDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-delta">Premium delta</Label>
                <Input id="end-delta" type="number" value={endDelta} onChange={(e) => setEndDelta(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                Current <span className="tabular-nums">{money(policy.current_premium)}</span> becomes{" "}
                <span className="text-foreground font-medium tabular-nums">{money(deltaPreview)}</span> on submit.
              </p>
              <Button
                size="sm"
                disabled={!isUW || action !== null || !endDesc.trim()}
                title={isUW ? "" : "Only an underwriter can endorse"}
                onClick={() =>
                  void run(
                    "endorse",
                    () => api.endorse({ policy_id: id, kind: endKind, description: endDesc, premium_delta: parseFloat(endDelta) || 0 }),
                    "Endorsement applied and premium recomputed.",
                  )
                }
              >
                {action === "endorse" ? <Loader2 className="animate-spin" /> : <PencilLine />} Apply endorsement
              </Button>
            </div>
            {endorsements.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">Endorsements</div>
                  {endorsements.map((e) => (
                    <div key={e.id} className="flex items-center justify-between">
                      <span>
                        {label(e.kind)} · {e.description}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {e.premium_delta >= 0 ? "+" : ""}
                        {money(e.premium_delta)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {events.map((ev, i) => {
              const Icon = EVENT_ICON[ev.event_type] ?? FileText;
              return (
                <li key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="bg-muted text-foreground flex size-8 items-center justify-center rounded-full">
                      <Icon className="size-4" />
                    </div>
                    {i < events.length - 1 && <div className="bg-border mt-1 w-px flex-1" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{label(ev.event_type.replace("policy.", ""))}</span>
                      <span className="text-muted-foreground text-xs">{fmtDateTime(ev.created_at)}</span>
                    </div>
                    <p className="text-muted-foreground text-sm">{eventSummary(ev)}</p>
                    <p className="text-muted-foreground/70 text-xs">
                      {ev.from_status ? `${ev.from_status} → ${ev.to_status}` : `→ ${ev.to_status}`} · {ev.actor}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
