// Display helpers. Premiums are the app's own operational data, shown as plain
// numbers (no currency symbol, to avoid a locale assumption).

export function money(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  if (Number.isNaN(v)) return "0";
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function fmtDate(ms: number | string | null | undefined): string {
  if (ms === null || ms === undefined || ms === "" || ms === 0) return "—";
  const n = typeof ms === "string" ? Number(ms) : ms;
  if (!Number.isFinite(n) || n === 0) return "—";
  return new Date(n).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(ms: number | string | null | undefined): string {
  if (ms === null || ms === undefined || ms === "" || ms === 0) return "—";
  const n = typeof ms === "string" ? Number(ms) : ms;
  if (!Number.isFinite(n)) return "—";
  return new Date(n).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** general_liability -> "General liability" */
export function label(s: string | null | undefined): string {
  if (!s) return "";
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
