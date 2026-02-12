import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, XCircle, CircleDot, Loader2, Hourglass, Eye } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  // Normalize the status to lowercase with underscores
  const normalizedStatus = status.trim().toLowerCase().replace(/[\s-]+/g, '_');
  
  const getStatusClasses = (): string => {
    switch (normalizedStatus) {
      case "complete":
      case "completed":
        return "bg-emerald-500 dark:bg-emerald-600 text-white";
      case "in_progress":
      case "in-progress":
      case "active":
        return "bg-orange-500 dark:bg-orange-600 text-white";
      case "waiting_on_client":
        return "bg-amber-500 dark:bg-amber-600 text-white";
      case "waiting_on_internal_review":
        return "bg-blue-500 dark:bg-blue-600 text-white";
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
      case "complete":
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />;
      case "in_progress":
      case "in-progress":
      case "active":
        return <Loader2 className="h-3 w-3" />;
      case "waiting_on_client":
        return <Hourglass className="h-3 w-3" />;
      case "waiting_on_internal_review":
        return <Eye className="h-3 w-3" />;
      case "cancelled":
        return <XCircle className="h-3 w-3" />;
      case "todo":
        return <CircleDot className="h-3 w-3" />;
      default:
        return <Circle className="h-3 w-3" />;
    }
  };

  const statusLabels: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    "in-progress": "In Progress",
    waiting_on_client: "Waiting on Client",
    waiting_on_internal_review: "Waiting on Internal Review",
    complete: "Complete",
    completed: "Complete",
    cancelled: "Cancelled",
    active: "Active",
  };

  const formatStatus = (status: string) => {
    const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return statusLabels[normalized] || status.charAt(0).toUpperCase() + status.slice(1).replace(/[_-]/g, ' ');
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
