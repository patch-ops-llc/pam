import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings2, Check, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";

type Agency = {
  id: string;
  name: string;
  isActive: boolean;
};

type QuotaConfig = {
  id: string;
  agencyId: string;
  monthlyTarget: string;
  showBillable: boolean;
  showPreBilled: boolean;
  noQuota: boolean;
  isVisible: boolean;
};

type AgencyConfig = {
  agency: Agency;
  config: QuotaConfig | null;
};

export default function QuotaSettings() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, Partial<QuotaConfig>>>({});
  const [savingAgencies, setSavingAgencies] = useState<Set<string>>(new Set());
  const [savedAgencies, setSavedAgencies] = useState<Set<string>>(new Set());
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const configsRef = useRef<Record<string, Partial<QuotaConfig>>>({});
  
  // Keep ref in sync with state
  useEffect(() => {
    configsRef.current = configs;
  }, [configs]);

  const { data: agencies = [], isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/clients"],
  });

  const { data: quotaConfigs = [], isLoading: configsLoading } = useQuery<QuotaConfig[]>({
    queryKey: ["/api/quota-configs"],
  });

  // Initialize local state when data loads
  useEffect(() => {
    if (!agenciesLoading && !configsLoading) {
      const configMap: Record<string, Partial<QuotaConfig>> = {};
      
      // Initialize with existing configs or defaults
      agencies.forEach(agency => {
        if (agency.isActive) {
          const existingConfig = quotaConfigs.find(c => c.agencyId === agency.id);
          configMap[agency.id] = existingConfig || {
            agencyId: agency.id,
            monthlyTarget: "160",
            showBillable: true,
            showPreBilled: true,
            noQuota: false,
            isVisible: true,
          };
        }
      });
      
      setConfigs(configMap);
    }
  }, [agencies, quotaConfigs, agenciesLoading, configsLoading]);

  const updateMutation = useMutation({
    mutationFn: async ({ agencyId, data }: { agencyId: string; data: Partial<QuotaConfig> }) => {
      setSavingAgencies(prev => new Set(prev).add(agencyId));
      setSavedAgencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(agencyId);
        return newSet;
      });
      return await apiRequest(`/api/quota-configs/${agencyId}`, "PUT", data);
    },
    onSuccess: (_, variables) => {
      const { agencyId } = variables;
      queryClient.invalidateQueries({ queryKey: ["/api/quota-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/hours-by-agency"] });
      
      setSavingAgencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(agencyId);
        return newSet;
      });
      setSavedAgencies(prev => new Set(prev).add(agencyId));
      
      // Clear the "saved" indicator after 2 seconds
      setTimeout(() => {
        setSavedAgencies(prev => {
          const newSet = new Set(prev);
          newSet.delete(agencyId);
          return newSet;
        });
      }, 2000);
    },
    onError: (error: any, variables) => {
      const { agencyId } = variables;
      setSavingAgencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(agencyId);
        return newSet;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to update quota configuration",
        variant: "destructive",
      });
    },
  });

  const autoSave = (agencyId: string) => {
    // Use ref to get the latest config value (avoids stale closure)
    const config = configsRef.current[agencyId];
    if (!config) return;

    // Ensure all fields are present in the payload
    const completeConfig = {
      agencyId,
      monthlyTarget: config.monthlyTarget || "160",
      showBillable: config.showBillable ?? true,
      showPreBilled: config.showPreBilled ?? true,
      noQuota: config.noQuota ?? false,
      isVisible: config.isVisible ?? true,
    };

    updateMutation.mutate({
      agencyId,
      data: completeConfig,
    });
    
    // Clear the timer reference after execution
    delete saveTimers.current[agencyId];
  };

  const handleConfigChange = (agencyId: string, field: keyof QuotaConfig, value: any) => {
    setConfigs(prev => ({
      ...prev,
      [agencyId]: {
        ...prev[agencyId],
        agencyId,
        [field]: value,
      },
    }));

    // Clear existing timer for this agency
    if (saveTimers.current[agencyId]) {
      clearTimeout(saveTimers.current[agencyId]);
    }

    // Set a new timer to auto-save after 800ms of no changes
    saveTimers.current[agencyId] = setTimeout(() => {
      autoSave(agencyId);
    }, 800);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  if (agenciesLoading || configsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeAgencies = agencies.filter(a => a.isActive);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings2 className="h-8 w-8" />
          Quota Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure hour quotas and visibility settings for each agency
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agency Quota Configuration</CardTitle>
          <CardDescription>
            Set monthly targets, and control which metrics are visible on the dashboard. Weekly targets are automatically calculated based on days in each week.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {activeAgencies.map((agency) => {
            const config = configs[agency.id] || {
              agencyId: agency.id,
              monthlyTarget: "160",
              showBillable: true,
              showPreBilled: true,
              noQuota: false,
              isVisible: true,
            };

            const isSaving = savingAgencies.has(agency.id);
            const isSaved = savedAgencies.has(agency.id);

            return (
              <div key={agency.id} className="space-y-4 pb-6 border-b last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold" data-testid={`heading-agency-${agency.id}`}>
                    {agency.name}
                  </h3>
                  {isSaving && (
                    <Badge variant="secondary" className="flex items-center gap-1" data-testid={`badge-saving-${agency.id}`}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </Badge>
                  )}
                  {isSaved && !isSaving && (
                    <Badge variant="default" className="flex items-center gap-1 bg-green-600 hover:bg-green-600" data-testid={`badge-saved-${agency.id}`}>
                      <Check className="h-3 w-3" />
                      Saved
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`monthly-${agency.id}`}>Monthly Target (hours)</Label>
                  <Input
                    id={`monthly-${agency.id}`}
                    type="number"
                    min="0"
                    step="0.5"
                    value={config.monthlyTarget}
                    onChange={(e) => handleConfigChange(agency.id, 'monthlyTarget', e.target.value)}
                    data-testid={`input-monthly-${agency.id}`}
                    className="max-w-xs"
                  />
                  <p className="text-sm text-muted-foreground">
                    Weekly targets are automatically calculated based on days in each week
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Visibility Settings</Label>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`visible-${agency.id}`}
                        checked={config.isVisible ?? true}
                        onCheckedChange={(checked) => handleConfigChange(agency.id, 'isVisible', checked)}
                        data-testid={`checkbox-visible-${agency.id}`}
                      />
                      <Label
                        htmlFor={`visible-${agency.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Show Agency on Dashboard
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`no-quota-${agency.id}`}
                        checked={config.noQuota ?? false}
                        onCheckedChange={(checked) => handleConfigChange(agency.id, 'noQuota', checked)}
                        data-testid={`checkbox-no-quota-${agency.id}`}
                      />
                      <Label
                        htmlFor={`no-quota-${agency.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        No Quota (Pre-billed hours only)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`billable-${agency.id}`}
                        checked={config.showBillable ?? true}
                        onCheckedChange={(checked) => handleConfigChange(agency.id, 'showBillable', checked)}
                        data-testid={`checkbox-billable-${agency.id}`}
                      />
                      <Label
                        htmlFor={`billable-${agency.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Show Billable Progress
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`prebilled-${agency.id}`}
                        checked={config.showPreBilled ?? true}
                        onCheckedChange={(checked) => handleConfigChange(agency.id, 'showPreBilled', checked)}
                        data-testid={`checkbox-prebilled-${agency.id}`}
                      />
                      <Label
                        htmlFor={`prebilled-${agency.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Show Pre-billed Progress
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
