import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Table2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

type WeekData = {
  weekStart: string;
  weekEnd: string;
  projectedActual: number;
  projectedBillable: number;
  actualHours: number;
  billableHours: number;
};

type AccountRow = {
  accountId: string;
  accountName: string;
  agencyId: string;
  agencyName: string;
  weeks: WeekData[];
};

type CapacityWorksheetData = {
  accounts: AccountRow[];
  teamCapacityByWeek: Array<{ weekStart: string; weekEnd: string; capacityHours: number }>;
};

export function CapacityWorksheetTab() {
  const [weeksCount, setWeeksCount] = useState(8);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<CapacityWorksheetData>({
    queryKey: ["/api/analytics/capacity-worksheet", weeksCount],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/capacity-worksheet?weeks=${weeksCount}`);
      if (!res.ok) throw new Error("Failed to fetch capacity worksheet");
      return res.json();
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      accountId,
      weekStart,
      projectedActualHours,
      projectedBillableHours,
    }: {
      accountId: string;
      weekStart: string;
      projectedActualHours: number;
      projectedBillableHours: number;
    }) => {
      return await apiRequest("/api/capacity-projections", "POST", {
        accountId,
        weekStart,
        projectedActualHours,
        projectedBillableHours,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/capacity-worksheet"] });
      toast({ title: "Projection saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const handleCellBlur = (
    accountId: string,
    weekStart: string,
    projectedActual: number,
    projectedBillable: number
  ) => {
    if (projectedActual === 0 && projectedBillable === 0) return;
    upsertMutation.mutate({
      accountId,
      weekStart,
      projectedActualHours: projectedActual,
      projectedBillableHours: projectedBillable,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load capacity worksheet
        </CardContent>
      </Card>
    );
  }

  const { accounts, teamCapacityByWeek } = data;

  const projectedTotalsByWeek = teamCapacityByWeek.map((tw) => {
    const total = accounts.reduce((sum, acc) => {
      const w = acc.weeks.find((x) => x.weekStart === tw.weekStart);
      return sum + (w?.projectedActual ?? 0);
    }, 0);
    return { ...tw, projectedTotal: total };
  });

  const accountsByAgency = accounts.reduce<Record<string, AccountRow[]>>((acc, row) => {
    const key = row.agencyId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const agencyNames = [...new Set(accounts.map((a) => ({ id: a.agencyId, name: a.agencyName })))];
  const uniqueAgencies = agencyNames.filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Table2 className="h-5 w-5" />
                Capacity Worksheet
              </CardTitle>
              <CardDescription>
                Enter projected hours by account. Compare against team capacity. Actual and billable
                from time logs.
              </CardDescription>
            </div>
            <Select value={String(weeksCount)} onValueChange={(v) => setWeeksCount(parseInt(v, 10))}>
              <SelectTrigger className="w-[160px]" data-testid="select-weeks">
                <SelectValue placeholder="Weeks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">Next 4 weeks</SelectItem>
                <SelectItem value="8">Next 8 weeks</SelectItem>
                <SelectItem value="12">Next 12 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] min-w-[180px] sticky left-0 bg-background z-10">
                    Account
                  </TableHead>
                  <TableHead className="w-[120px] min-w-[100px]">Client</TableHead>
                  {teamCapacityByWeek.map((tw) => (
                    <TableHead
                      key={tw.weekStart}
                      className="text-center min-w-[140px]"
                      title={`${format(parseISO(tw.weekStart), "MMM d")} – ${format(parseISO(tw.weekEnd), "MMM d")}`}
                    >
                      {format(parseISO(tw.weekStart), "MMM d")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueAgencies.flatMap((agency) =>
                  (accountsByAgency[agency.id] ?? []).map((row) => (
                    <TableRow key={row.accountId}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        {row.accountName}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.agencyName}
                      </TableCell>
                      {row.weeks.map((w) => (
                        <ProjectedCell
                          key={w.weekStart}
                          accountId={row.accountId}
                          weekStart={w.weekStart}
                          projectedActual={w.projectedActual}
                          projectedBillable={w.projectedBillable}
                          actualHours={w.actualHours}
                          billableHours={w.billableHours}
                          onBlur={handleCellBlur}
                        />
                      ))}
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2} className="sticky left-0 bg-muted/50 z-10">
                    Team capacity
                  </TableCell>
                  {teamCapacityByWeek.map((tw) => (
                    <TableCell key={tw.weekStart} className="text-center text-muted-foreground">
                      {tw.capacityHours.toFixed(0)}h
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30 font-medium">
                  <TableCell colSpan={2} className="sticky left-0 bg-muted/30 z-10">
                    Projected total
                  </TableCell>
                  {projectedTotalsByWeek.map((tw) => {
                    const util = tw.capacityHours > 0 ? (tw.projectedTotal / tw.capacityHours) * 100 : 0;
                    return (
                      <TableCell key={tw.weekStart} className="text-center">
                        <span className={cn(util > 100 && "text-destructive font-semibold")}>
                          {tw.projectedTotal.toFixed(0)}h
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({util.toFixed(0)}%)
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectedCell({
  accountId,
  weekStart,
  projectedActual,
  projectedBillable,
  actualHours,
  billableHours,
  onBlur,
}: {
  accountId: string;
  weekStart: string;
  projectedActual: number;
  projectedBillable: number;
  actualHours: number;
  billableHours: number;
  onBlur: (accountId: string, weekStart: string, totalActual: number, totalBillable: number) => void;
}) {
  const [editValue, setEditValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const displayActual = (projectedActual || 0).toFixed(2);
  const displayBillable = (projectedBillable || 0).toFixed(2);

  const handleBlur = () => {
    if (!isEditing) return;
    const parts = editValue.split("/").map((s) => parseFloat(s.trim()) || 0);
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    onBlur(accountId, weekStart, a, b);
    setIsEditing(false);
    setEditValue("");
  };

  const handleClick = () => {
    setIsEditing(true);
    setEditValue(`${displayActual} / ${displayBillable}`);
  };

  const hasActual = actualHours > 0;
  const hasBillable = billableHours > 0;

  return (
    <TableCell className="text-center align-middle">
      <div
        className="flex flex-col items-center gap-0.5"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            handleBlur();
          }
        }}
      >
        {isEditing ? (
          <Input
            type="text"
            className="w-24 h-7 text-center text-xs"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="act / bill"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBlur();
            }}
          />
        ) : (
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 min-w-[60px]"
            onClick={handleClick}
          >
            <span className="font-medium">{displayActual}</span>
            <span className="text-muted-foreground mx-0.5">/</span>
            <span className="font-medium">{displayBillable}</span>
          </div>
        )}
        {(hasActual || hasBillable) && (
          <span className="text-[10px] text-muted-foreground" title="Actual / Billable from logs">
            ({actualHours.toFixed(2)} / {billableHours.toFixed(2)})
          </span>
        )}
      </div>
    </TableCell>
  );
}
