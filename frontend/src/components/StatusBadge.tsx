import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { label } from "@/lib/format";
import type { PolicyStatus } from "@/lib/api";

// Semantic-token classes only, so both light and dark themes read well.
const STYLES: Record<string, string> = {
  quoted: "border-chart-4/40 bg-chart-4/15 text-chart-4",
  bound: "border-chart-3/40 bg-chart-3/15 text-chart-3",
  active: "border-chart-2/40 bg-chart-2/15 text-chart-2",
  renewed: "border-chart-1/40 bg-chart-1/15 text-chart-1",
  cancelled: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: PolicyStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", STYLES[status] ?? "", className)}>
      {label(status)}
    </Badge>
  );
}
