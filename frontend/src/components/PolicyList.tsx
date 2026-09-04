import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import * as api from "@/lib/api";
import { can } from "@/lib/rbac";
import { money, fmtDate, label } from "@/lib/format";
import type { PolicyStatus, Role } from "@/lib/api";

const STATUSES: PolicyStatus[] = ["quoted", "bound", "active", "renewed", "cancelled"];

export function PolicyList({
  role,
  onOpen,
  onNewQuote,
}: {
  role: Role;
  onOpen: (id: number) => void;
  onNewQuote: () => void;
}) {
  const [filter, setFilter] = useState<"all" | PolicyStatus>("all");
  const [rows, setRows] = useState<api.PolicyList>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.listPolicies(filter === "all" ? undefined : filter));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load policies.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Policies</h2>
          <p className="text-muted-foreground text-sm">The book of business, newest first.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as "all" | PolicyStatus)}>
            <SelectTrigger className="w-40" size="sm">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {label(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
          <Button size="sm" onClick={onNewQuote} disabled={!can(role, "quote")} title={can(role, "quote") ? "" : "Requires an agent or underwriter"}>
            <Plus /> New quote
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Policy</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Current premium</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  No policies match this filter.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpen(p.id)}>
                  <TableCell className="font-mono text-sm">#{p.id}</TableCell>
                  <TableCell className="capitalize">{label(p.product)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(p.current_premium)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(p.effective_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(p.expiration_date)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
