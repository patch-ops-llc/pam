import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type AgencyHours = {
  type: 'agency';
  id: string;
  name: string;
  weeklyBillable: number;
  monthlyBillable: number;
  weeklyPreBilled: number;
  monthlyPreBilled: number;
  weeklyTarget: number;
  monthlyTarget: number;
  showBillable: boolean;
  showPreBilled: boolean;
  isVisible: boolean;
};

export function AgencyQuotaTrackers() {
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');

  const { data: agencyHours = [], isLoading } = useQuery<AgencyHours[]>({
    queryKey: ["/api/analytics/hours-by-agency"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const sortedItems = [...agencyHours]
    .filter(agency => agency.isVisible)
    .sort((a, b) => {
      const totalA = viewMode === 'weekly' 
        ? a.weeklyBillable + a.weeklyPreBilled 
        : a.monthlyBillable + a.monthlyPreBilled;
      const totalB = viewMode === 'weekly' 
        ? b.weeklyBillable + b.weeklyPreBilled 
        : b.monthlyBillable + b.monthlyPreBilled;
      return totalB - totalA;
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-2xl">Hour Quota by Agency</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              onClick={() => setViewMode('weekly')}
              data-testid="button-view-weekly"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Weekly
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'monthly' ? 'default' : 'outline'}
              onClick={() => setViewMode('monthly')}
              data-testid="button-view-monthly"
            >
              <Clock className="h-3 w-3 mr-1" />
              Monthly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No time logged for any agencies yet
          </div>
        ) : (
          sortedItems.map((agency) => {
            const billableHours = viewMode === 'weekly' ? agency.weeklyBillable : agency.monthlyBillable;
            const preBilledHours = viewMode === 'weekly' ? agency.weeklyPreBilled : agency.monthlyPreBilled;
            const target = viewMode === 'weekly' ? agency.weeklyTarget : agency.monthlyTarget;
            const totalHours = billableHours + preBilledHours;
            
            // Defensive: handle zero targets to avoid division by zero
            const billablePercentage = target > 0 ? Math.min((billableHours / target) * 100, 100) : 0;
            const preBilledPercentage = target > 0 ? Math.min((preBilledHours / target) * 100, 100) : 0;
            
            return (
              <div key={agency.id} className="space-y-3" data-testid={`quota-agency-${agency.id}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-lg truncate" data-testid={`text-name-${agency.id}`}>
                      {agency.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {agency.showBillable && (
                      <Badge variant="outline" data-testid={`badge-billable-${agency.id}`}>
                        Billable: {billableHours.toFixed(2)}h
                      </Badge>
                    )}
                    {agency.showPreBilled && (
                      <Badge variant="outline" data-testid={`badge-prebilled-${agency.id}`}>
                        Pre-billed: {preBilledHours.toFixed(1)}h
                      </Badge>
                    )}
                    <Badge 
                      variant={totalHours >= target ? "default" : "secondary"}
                      data-testid={`badge-total-${agency.id}`}
                    >
                      {totalHours.toFixed(2)}h / {target}h
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {agency.showBillable && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Billable Hours</span>
                        <span className="font-medium">
                          {billableHours.toFixed(1)}h / {target}h
                        </span>
                      </div>
                      <Progress 
                        value={billablePercentage} 
                        className="h-6" 
                        data-testid={`progress-billable-${agency.id}`}
                      />
                    </div>
                  )}
                  {agency.showPreBilled && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pre-billed Hours</span>
                        <span className="font-medium">
                          {preBilledHours.toFixed(2)}h / {target}h
                        </span>
                      </div>
                      <Progress 
                        value={preBilledPercentage} 
                        className="h-6" 
                        data-testid={`progress-prebilled-${agency.id}`}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
