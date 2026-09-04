import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import * as api from "@/lib/api";
import { money, label } from "@/lib/format";
import type { CoverageInput } from "@/lib/api";

type Kind = NonNullable<CoverageInput["kind"]>;
type Segment = NonNullable<api.QuoteBody["segment"]>;
type Product = NonNullable<api.QuoteBody["product"]>;

type Row = { kind: Kind; limit: string; deductible: string; rate_factor: string };

const KINDS: Kind[] = ["collision", "dwelling", "general_liability", "medical"];
const SEGMENTS: Segment[] = ["personal", "commercial"];
const PRODUCTS: Product[] = ["auto", "property", "liability"];

const num = (s: string) => {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
};

export function QuoteForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("Harbor Point Logistics");
  const [email, setEmail] = useState("risk@harborpoint.test");
  const [segment, setSegment] = useState<Segment>("commercial");
  const [product, setProduct] = useState<Product>("auto");
  const [term, setTerm] = useState("12");
  const [rows, setRows] = useState<Row[]>([{ kind: "collision", limit: "50000", deductible: "1000", rate_factor: "0.03" }]);
  const [busy, setBusy] = useState(false);

  const estimate = useMemo(
    () => rows.reduce((sum, r) => sum + Math.max(0, num(r.limit) * num(r.rate_factor) - num(r.deductible) * 0.05), 0),
    [rows],
  );

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (rows.length === 0) {
      toast.error("A quote needs at least one coverage.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.quote({
        policyholder_name: name,
        policyholder_email: email,
        segment,
        product,
        term_months: num(term),
        coverages: rows.map((r) => ({
          kind: r.kind,
          limit: num(r.limit),
          deductible: num(r.deductible),
          rate_factor: num(r.rate_factor),
        })),
      });
      toast.success(`Quote #${result.policy.id} created — base premium ${money(result.policy.base_premium)}.`);
      onCreated(result.policy.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the quote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onCancel} className="-ml-2">
        <ArrowLeft /> Back to policies
      </Button>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>New quote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ph-name">Policyholder</Label>
                <Input id="ph-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph-email">Email</Label>
                <Input id="ph-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Segment</Label>
                <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {label(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={product} onValueChange={(v) => setProduct(v as Product)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {label(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term (months)</Label>
                <Input id="term" type="number" min={1} value={term} onChange={(e) => setTerm(e.target.value)} />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Coverages</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRows((rs) => [...rs, { kind: "medical", limit: "10000", deductible: "0", rate_factor: "0.02" }])}
                >
                  <Plus /> Add coverage
                </Button>
              </div>

              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Kind</Label>
                    <Select value={r.kind} onValueChange={(v) => setRow(i, { kind: v as Kind })}>
                      <SelectTrigger className="w-full" size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {label(k)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Limit</Label>
                    <Input type="number" value={r.limit} onChange={(e) => setRow(i, { limit: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Deductible</Label>
                    <Input type="number" value={r.deductible} onChange={(e) => setRow(i, { deductible: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">Rate factor</Label>
                    <Input type="number" step="0.001" value={r.rate_factor} onChange={(e) => setRow(i, { rate_factor: e.target.value })} />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                      disabled={rows.length === 1}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Premium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-muted-foreground text-sm">Estimated base premium</div>
              <div className="text-3xl font-semibold tabular-nums">{money(estimate)}</div>
              <p className="text-muted-foreground mt-2 text-xs">
                The backend computes the authoritative value from the coverage rule on submit: the sum of limit times
                rate factor, less a deductible credit.
              </p>
            </div>
            <Button className="w-full" onClick={() => void submit()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Create quote
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
