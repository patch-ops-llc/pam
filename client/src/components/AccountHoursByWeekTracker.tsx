import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type WeekData = {
  weekStart: string;
  weekEnd: string;
  hours: number;
};

type AccountHoursData = {
  accountId: string;
  accountName: string;
  agencyId: string;
  agencyName: string;
  maxHoursPerWeek: number | null;
  weeks: WeekData[];
};

export function AccountHoursByWeekTracker() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: accountHours = [], isLoading } = useQuery<AccountHoursData[]>({
    queryKey: ["/api/analytics/account-hours-by-week", 8],
    queryFn: async () => {
      const res = await fetch("/api/analytics/account-hours-by-week?weeks=8");
      if (!res.ok) throw new Error("Failed to fetch account hours by week");
      return res.json();
    },
  });

  const accountsWithMax = accountHours.filter((a) => a.maxHoursPerWeek != null);
  const overLimitCount = accountsWithMax.filter((a) =>
    a.weeks.some((w) => w.hours > (a.maxHoursPerWeek ?? 0))
  ).length;

  if (isLoading || accountsWithMax.length === 0) {
    return null;
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="px-4 py-3">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-4 text-left hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Hours per Account per Week
                </CardTitle>
                {overLimitCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {overLimitCount} over limit
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs shrink-0">
                {accountsWithMax.length} account{accountsWithMax.length !== 1 ? "s" : ""} with max caps
              </CardDescription>
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="px-4 py-3 pt-0">
            <p className="text-xs text-muted-foreground mb-4">
              Track hours per client per week to avoid exceeding caps. Set "Max Hours Per Week" on accounts in Clients & Accounts.
            </p>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {accountsWithMax.map((account) => (
                <div
                  key={account.accountId}
                  className="rounded-lg border p-3 space-y-2"
                  data-testid={`account-hours-${account.accountId}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{account.accountName}</p>
                      <p className="text-xs text-muted-foreground">{account.agencyName}</p>
                    </div>
                    {account.maxHoursPerWeek != null && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Max {account.maxHoursPerWeek}h/week
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {account.weeks.slice(0, 4).map((w) => {
                      const isOver =
                        account.maxHoursPerWeek != null &&
                        w.hours > account.maxHoursPerWeek;
                      const isNear =
                        account.maxHoursPerWeek != null &&
                        w.hours > account.maxHoursPerWeek * 0.9 &&
                        !isOver;
                      return (
                        <div
                          key={w.weekStart}
                          className={cn(
                            "rounded px-2 py-1 text-xs font-medium",
                            isOver && "bg-destructive/15 text-destructive",
                            isNear && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                            !isOver && !isNear && "bg-muted/50"
                          )}
                          title={`${format(parseISO(w.weekStart), "MMM d")} – ${format(parseISO(w.weekEnd), "MMM d")}${isOver ? " — Over limit!" : ""}`}
                        >
                          {format(parseISO(w.weekStart), "MMM d")}: {w.hours.toFixed(2)}h
                          {isOver && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
