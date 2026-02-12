import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Calendar } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type PenguinHoursTrackerData = {
  id: string;
  agencyId: string;
  startDate: string;
  hourBank: string;
  hoursUsed: number;
  createdAt: string;
  updatedAt: string;
};

export function PenguinHoursTracker() {
  const { toast } = useToast();

  const { data: agencies = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/clients"],
  });

  const penguinAgency = agencies.find(a => a.name === "Penguin Strategies");

  const { data: trackerData, isLoading } = useQuery<PenguinHoursTrackerData>({
    queryKey: ["/api/penguin-hours-tracker", penguinAgency?.id],
    enabled: !!penguinAgency,
  });

  const createTrackerMutation = useMutation({
    mutationFn: async () => {
      if (!penguinAgency) throw new Error("Penguin agency not found");
      
      return apiRequest("/api/penguin-hours-tracker", "POST", {
        agencyId: penguinAgency.id,
        startDate: new Date(),
        hourBank: "50"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penguin-hours-tracker"] });
      toast({
        title: "Success",
        description: "Hours tracker started successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start hours tracker",
        variant: "destructive",
      });
    },
  });

  const resetTrackerMutation = useMutation({
    mutationFn: async () => {
      if (!penguinAgency) throw new Error("Penguin agency not found");
      
      return apiRequest(`/api/penguin-hours-tracker/${penguinAgency.id}/reset`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/penguin-hours-tracker"] });
      toast({
        title: "Success",
        description: "Hours tracker reset successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset hours tracker",
        variant: "destructive",
      });
    },
  });

  if (!penguinAgency) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!trackerData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Penguin Hours Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              No active hours tracker. Start tracking against the 50-hour bank.
            </p>
            <Button
              onClick={() => createTrackerMutation.mutate()}
              disabled={createTrackerMutation.isPending}
              data-testid="button-start-tracker"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Start Tracking Today
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hourBank = parseFloat(trackerData.hourBank);
  const hoursUsed = trackerData.hoursUsed;
  const hoursRemaining = Math.max(0, hourBank - hoursUsed);
  const progressPercentage = Math.min(100, (hoursUsed / hourBank) * 100);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>Penguin Hours Tracker</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetTrackerMutation.mutate()}
            disabled={resetTrackerMutation.isPending}
            data-testid="button-reset-tracker"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Started: {format(new Date(trackerData.startDate), "MMM d, yyyy")}
            </span>
            <span className="font-medium" data-testid="text-hours-remaining">
              {hoursRemaining.toFixed(2)}h remaining
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" data-testid="progress-hours" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground" data-testid="text-hours-used">
              {hoursUsed.toFixed(1)}h used
            </span>
            <span className="text-muted-foreground">
              {hourBank}h total
            </span>
          </div>
        </div>

        {hoursRemaining <= 5 && hoursRemaining > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Warning: Only {hoursRemaining.toFixed(1)} hours remaining in the bank
            </p>
          </div>
        )}

        {hoursRemaining <= 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-800 dark:text-red-200">
              Hour bank depleted! {Math.abs(hoursRemaining).toFixed(2)} hours over limit
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
