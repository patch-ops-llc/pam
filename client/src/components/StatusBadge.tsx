import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, XCircle, CircleDot, Loader2 } from "lucide-react";

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

  const getStatusIcon = () => {
    switch (normalizedStatus) {
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />;
      case "in-progress":
      case "active":
        return <Loader2 className="h-3 w-3" />;
      case "cancelled":
        return <XCircle className="h-3 w-3" />;
      case "todo":
        return <CircleDot className="h-3 w-3" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ');
  };

  return (
    <Badge 
      className={`${getStatusClasses()} inline-flex items-center gap-1 ${className}`}
      data-testid={`badge-status-${normalizedStatus}`}
    >
      {getStatusIcon()}
      {formatStatus(status)}
    </Badge>
  );
}
