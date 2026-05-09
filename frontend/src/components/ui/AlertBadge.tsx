import { cn } from "@/lib/utils";

type Severity = "critical" | "warning" | "info";

const config: Record<Severity, { label: string; className: string }> = {
  critical: { label: "Critical", className: "bg-red-500/15 text-red-400 border border-red-500/30" },
  warning: { label: "Warning", className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  info: { label: "Info", className: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
};

export function AlertBadge({ severity }: { severity: Severity }) {
  const { label, className } = config[severity];
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", className)}>
      {label}
    </span>
  );
}
