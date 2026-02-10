import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  // Normalize the status to lowercase kebab-case
  const normalizedStatus = status.trim().toLowerCase().replace(/\s+/g, '-');
  
  const getStatusClasses = (): string => {
    switch (normalizedStatus) {
      case "completed":
        return "bg-emerald-500 dark:bg-emerald-600 text-white";
      case "in-progress":
      case "active":
        return "bg-orange-500 dark:bg-orange-600 text-white";
      case "cancelled":
        return "bg-violet-500 dark:bg-violet-600 text-white";
      case "todo":
        return "bg-cyan-500 dark:bg-cyan-600 text-white";
      default:
        return "bg-slate-500 dark:bg-slate-600 text-white";
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
  };

  return (
    <Badge 
      className={`${getStatusClasses()} ${className}`}
      data-testid={`badge-status-${normalizedStatus}`}
    >
      {formatStatus(status)}
    </Badge>
  );
}
