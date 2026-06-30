export function StatusBadge({ status }: { status?: string }) {
  const normalized = (status || "").toLowerCase();
  return <span className={`badge badge-${normalized}`}>{status || "-"}</span>;
}
