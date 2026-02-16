import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2, ChevronRight, Target, TrendingUp, Plus } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Agency = {
  id: string;
  name: string;
  isActive: boolean;
};

type ResourceQuota = {
  id: string;
  userId: string;
  monthlyTarget: string;
  isActive: boolean;
};

type User = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  employmentType?: string;
};

type QuotaPeriod = {
  id: string;
  yearMonth: string;
  calculatedAt: string;
  partnerResults: string | null;
  individualResults: string | null;
  totalPartnerBonusesPaid: string | null;
  totalIndividualBonusesPaid: string | null;
  totalOverageBonusesPaid: string | null;
  isFinalized: boolean;
};

type ResourceQuotaProgress = {
  user: User;
  monthlyTarget: number;
  adjustedTarget: number;
  expectedHours: number;
  billedHours: number;
  prebilledHours: number;
  percentageComplete: number;
};

const ADMIN_EMAIL = "zach@patchops.io";
const STANDARD_MONTHLY_HOURS = 160; // 40 hours/week * 4 weeks

type ForecastSettings = {
  id: string;
  blendedRate: string;
  toplineQuotaTarget: string | null;
  updatedAt: string;
};

export function QuotasTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.email === ADMIN_EMAIL;
  
  const [resourceQuotas, setResourceQuotas] = useState<Record<string, Partial<ResourceQuota>>>({});
  
  const [savingResources, setSavingResources] = useState<Set<string>>(new Set());
  const [savedResources, setSavedResources] = useState<Set<string>>(new Set());
  const resourceSaveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const resourceQuotasRef = useRef<Record<string, Partial<ResourceQuota>>>({});
  const [toplineQuotaInput, setToplineQuotaInput] = useState<string>("");
  const [savingTopline, setSavingTopline] = useState(false);
  const [savedTopline, setSavedTopline] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState<'current' | 'previous'>('current');
  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const previousMonth = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return format(date, 'yyyy-MM');
  }, []);
  const activeMonth = selectedMonth === 'current' ? currentMonth : previousMonth;
  const activeMonthDisplay = selectedMonth === 'current' 
    ? format(new Date(), 'MMMM yyyy')
    : format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'MMMM yyyy');

  useEffect(() => {
    resourceQuotasRef.current = resourceQuotas;
  }, [resourceQuotas]);


  const { data: agencies = [], isLoading: agenciesLoading } = useQuery<Agency[]>({
    queryKey: ["/api/clients"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: existingResourceQuotas = [], isLoading: resourceQuotasLoading } = useQuery<ResourceQuota[]>({
    queryKey: ["/api/resource-quotas"],
  });

  const { data: quotaPeriods = [], isLoading: quotaPeriodsLoading } = useQuery<QuotaPeriod[]>({
    queryKey: ["/api/quota-periods"],
  });

  const { data: forecastSettings } = useQuery<ForecastSettings>({
    queryKey: ["/api/forecast/settings"],
  });

  // Initialize topline quota input from settings
  useEffect(() => {
    if (forecastSettings?.toplineQuotaTarget != null && forecastSettings.toplineQuotaTarget !== "") {
      setToplineQuotaInput(forecastSettings.toplineQuotaTarget);
    }
  }, [forecastSettings?.toplineQuotaTarget]);

  const updateToplineQuotaMutation = useMutation({
    mutationFn: async (target: string) => {
      const response = await apiRequest("/api/forecast/settings", "PUT", {
        blendedRate: forecastSettings?.blendedRate || "90",
        toplineQuotaTarget: target || null,
      });
      return response;
    },
    onMutate: () => {
      setSavingTopline(true);
      setSavedTopline(false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/settings"] });
      setSavingTopline(false);
      setSavedTopline(true);
      setTimeout(() => setSavedTopline(false), 2000);
      toast({ title: "Saved", description: "Topline quota target updated." });
    },
    onError: (error: any) => {
      setSavingTopline(false);
      toast({ title: "Error", description: error.message || "Failed to update topline quota", variant: "destructive" });
    },
  });

  const { data: resourceQuotaProgress = [], isLoading: resourceProgressLoading } = useQuery<ResourceQuotaProgress[]>({
    queryKey: ["/api/analytics/resource-quota-tracker", activeMonth],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/resource-quota-tracker?month=${activeMonth}`);
      if (!res.ok) throw new Error('Failed to fetch resource quota progress');
      return res.json();
    },
  });

  useEffect(() => {
    if (!usersLoading && !resourceQuotasLoading) {
      const quotaMap: Record<string, Partial<ResourceQuota>> = {};
      
      users.forEach(user => {
        const existingQuota = existingResourceQuotas.find(q => q.userId === user.id);
        quotaMap[user.id] = existingQuota || {
          userId: user.id,
          monthlyTarget: "160",
          isActive: true,
        };
      });
      
      setResourceQuotas(quotaMap);
    }
  }, [users, existingResourceQuotas, usersLoading, resourceQuotasLoading]);

  const updateResourceQuotaMutation = useMutation({
    mutationFn: async ({ userId, quota }: { userId: string; quota: Partial<ResourceQuota> }) => {
      setSavingResources(prev => new Set(prev).add(userId));
      setSavedResources(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      
      const existing = existingResourceQuotas.find(q => q.userId === userId);
      if (existing) {
        return await apiRequest(`/api/resource-quotas/${existing.id}`, "PATCH", quota);
      } else {
        return await apiRequest("/api/resource-quotas", "POST", { ...quota, userId });
      }
    },
    onSuccess: (_, variables) => {
      const { userId } = variables;
      queryClient.invalidateQueries({ queryKey: ["/api/resource-quotas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/resource-quota-tracker"] });
      
      setSavingResources(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setSavedResources(prev => new Set(prev).add(userId));
      
      setTimeout(() => {
        setSavedResources(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }, 2000);
    },
    onError: (error: any, variables) => {
      const { userId } = variables;
      setSavingResources(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      toast({
        title: "Error",
        description: error.message || "Failed to update resource quota",
        variant: "destructive",
      });
    },
  });

  const saveQuotaPeriodMutation = useMutation({
    mutationFn: async (data: { yearMonth: string; partnerResults: string; individualResults: string; isFinalized: boolean }) => {
      const existing = quotaPeriods.find(p => p.yearMonth === data.yearMonth);
      if (existing) {
        return await apiRequest(`/api/quota-periods/${existing.id}`, "PATCH", data);
      } else {
        return await apiRequest("/api/quota-periods", "POST", data);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quota-periods"] });
      toast({
        title: "Success",
        description: variables.isFinalized 
          ? `Snapshot for ${variables.yearMonth} finalized successfully`
          : `Snapshot for ${variables.yearMonth} saved successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save quota period snapshot",
        variant: "destructive",
      });
    },
  });

  const autoSaveResource = (userId: string) => {
    const quota = resourceQuotasRef.current[userId];
    if (!quota) return;

    updateResourceQuotaMutation.mutate({
      userId,
      quota: {
        monthlyTarget: quota.monthlyTarget || "160",
        isActive: quota.isActive ?? true,
      },
    });
    
    delete resourceSaveTimers.current[userId];
  };

  const handleResourceQuotaChange = (userId: string, field: 'monthlyTarget' | 'isActive', value: string | boolean) => {
    setResourceQuotas(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        userId,
        [field]: value,
      },
    }));

    if (resourceSaveTimers.current[userId]) {
      clearTimeout(resourceSaveTimers.current[userId]);
    }

    resourceSaveTimers.current[userId] = setTimeout(() => {
      autoSaveResource(userId);
    }, 800);
  };

  // Mutation for updating user employment type
  const updateUserEmploymentTypeMutation = useMutation({
    mutationFn: async ({ userId, employmentType }: { userId: string; employmentType: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, { employmentType });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Updated",
        description: "Employment type updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employment type",
        variant: "destructive",
      });
    },
  });

  const handleEmploymentTypeChange = (userId: string, employmentType: string) => {
    updateUserEmploymentTypeMutation.mutate({ userId, employmentType });
  };

  useEffect(() => {
    return () => {
      Object.values(resourceSaveTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const isLoading = agenciesLoading || usersLoading || resourceQuotasLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Topline Quota Target */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Billable Hours Quota Target
            </CardTitle>
            <CardDescription>
              Set a single aggregate monthly hours target for the entire company. This number populates the dashboard and is used in forecasting calculations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="toplineQuota">Monthly Hours Target</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="toplineQuota"
                    type="number"
                    min="0"
                    step="1"
                    value={toplineQuotaInput}
                    onChange={(e) => setToplineQuotaInput(e.target.value)}
                    placeholder="e.g. 800"
                    className="w-40"
                    data-testid="input-topline-quota"
                  />
                  <span className="text-sm text-muted-foreground">hrs/month</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => updateToplineQuotaMutation.mutate(toplineQuotaInput)}
                  disabled={savingTopline}
                  size="sm"
                  data-testid="button-save-topline"
                >
                  {savingTopline ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Save Target
                </Button>
                {savedTopline && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Saved
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Progress & Resource Quotas */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Individual Progress - {activeMonthDisplay}
                  </CardTitle>
                  <CardDescription>
                    Tracking billed + prebilled hours toward adjusted targets (accounts for holidays and time off)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant={selectedMonth === 'previous' ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setSelectedMonth('previous')}
                    data-testid="btn-resource-previous-month"
                  >
                    Last Month
                  </Button>
                  <Button 
                    variant={selectedMonth === 'current' ? 'default' : 'outline'} 
                    size="sm"
                    onClick={() => setSelectedMonth('current')}
                    data-testid="btn-resource-current-month"
                  >
                    This Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {resourceProgressLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : resourceQuotaProgress.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No resource quotas configured. Enable tracking below to see progress.</p>
              ) : (
                <div className="space-y-4">
                  {resourceQuotaProgress.map((progress) => {
                    const totalHours = progress.billedHours + (progress.prebilledHours || 0);
                    const pacing = totalHours - progress.expectedHours;
                    const isPacingAhead = pacing >= 0;
                    const progressPercent = Math.min(100, (totalHours / progress.adjustedTarget) * 100);
                    
                    return (
                      <div key={progress.user.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{progress.user.firstName} {progress.user.lastName}</span>
                            <Badge variant={isPacingAhead ? "default" : "secondary"} className={cn("text-xs", isPacingAhead ? "bg-green-600 hover:bg-green-600" : "")}>
                              {isPacingAhead ? "+" : ""}{pacing.toFixed(2)}hrs
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {progress.billedHours.toFixed(2)}b + {(progress.prebilledHours || 0).toFixed(2)}pb = {totalHours.toFixed(2)} / {progress.adjustedTarget.toFixed(2)} hrs ({progressPercent.toFixed(0)}%)
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resource Quotas */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Quota Configuration</CardTitle>
              <CardDescription>
                Set individual monthly targets for each team member. Assumed efficiency is calculated based on a standard {STANDARD_MONTHLY_HOURS} hours/month (40hr/week x 4 weeks).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Team Member</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead className="w-[160px]">Monthly Target (hours)</TableHead>
                    <TableHead className="w-[100px]">Efficiency</TableHead>
                    <TableHead className="w-[120px]">In Tracker</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const quota = resourceQuotas[u.id] || {
                      userId: u.id,
                      monthlyTarget: "160",
                      isActive: true,
                    };

                    const isSaving = savingResources.has(u.id);
                    const isSaved = savedResources.has(u.id);
                    const target = parseFloat(quota.monthlyTarget || "160");
                    const assumedEfficiency = (target / STANDARD_MONTHLY_HOURS) * 100;

                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium" data-testid={`cell-user-${u.id}`}>
                          {u.firstName} {u.lastName}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.employmentType || 'full-time'}
                            onValueChange={(value) => handleEmploymentTypeChange(u.id, value)}
                          >
                            <SelectTrigger className="w-24" data-testid={`select-employment-type-${u.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full-time">FT</SelectItem>
                              <SelectItem value="part-time">PT</SelectItem>
                              <SelectItem value="contractor">1099</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={quota.monthlyTarget}
                            onChange={(e) => handleResourceQuotaChange(u.id, 'monthlyTarget', e.target.value)}
                            data-testid={`input-resource-monthly-${u.id}`}
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-sm font-medium",
                            assumedEfficiency >= 90 ? "text-green-600" : 
                            assumedEfficiency >= 75 ? "text-yellow-600" : "text-muted-foreground"
                          )}>
                            {assumedEfficiency.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={quota.isActive ?? true}
                            onCheckedChange={(checked) => handleResourceQuotaChange(u.id, 'isActive', checked as boolean)}
                            data-testid={`checkbox-resource-active-${u.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          {isSaving && (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit" data-testid={`badge-resource-saving-${u.id}`}>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving
                            </Badge>
                          )}
                          {isSaved && !isSaving && (
                            <Badge variant="default" className="flex items-center gap-1 w-fit bg-green-600 hover:bg-green-600" data-testid={`badge-resource-saved-${u.id}`}>
                              <Check className="h-3 w-3" />
                              Saved
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

      {/* Historical Snapshots (collapsible) */}
      <Accordion type="single" collapsible className="w-full" defaultValue="">
        <AccordionItem value="historical" data-testid="accordion-historical">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Historical Quota Snapshots
            </span>
          </AccordionTrigger>
          <AccordionContent>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription>
                    Save and view monthly quota configurations and actual hours achieved. Finalize months to lock in historical data.
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button 
                    onClick={() => {
                      const individualResults = resourceQuotaProgress.map(p => ({
                        userId: p.user.id,
                        name: `${p.user.firstName} ${p.user.lastName}`,
                        targetHours: p.monthlyTarget,
                        adjustedTarget: p.adjustedTarget,
                        billedHours: p.billedHours,
                        prebilledHours: p.prebilledHours,
                        percentComplete: p.percentageComplete,
                      }));
                      saveQuotaPeriodMutation.mutate({
                        yearMonth: activeMonth,
                        partnerResults: JSON.stringify([]),
                        individualResults: JSON.stringify(individualResults),
                        isFinalized: false,
                      });
                    }}
                    disabled={saveQuotaPeriodMutation.isPending}
                    data-testid="button-save-snapshot"
                  >
                    {saveQuotaPeriodMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Save {activeMonthDisplay} Snapshot
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {quotaPeriodsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : quotaPeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No historical snapshots saved yet. Click "Save Snapshot" to record the current month's quota data.</p>
              ) : (
                <div className="space-y-4">
                  {quotaPeriods.map((period) => {
                    let individualData: any[] = [];
                    try {
                      individualData = period.individualResults ? JSON.parse(period.individualResults) : [];
                    } catch (e) {
                      console.error('Failed to parse individual results:', e);
                    }
                    const monthDisplay = format(new Date(period.yearMonth + '-01'), 'MMMM yyyy');
                    
                    return (
                      <Collapsible key={period.id}>
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary">
                              <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90" />
                              <span className="font-medium">{monthDisplay}</span>
                              {period.isFinalized && (
                                <Badge variant="default" className="bg-green-600 hover:bg-green-600">
                                  <Check className="h-3 w-3 mr-1" />
                                  Finalized
                                </Badge>
                              )}
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                Saved: {format(new Date(period.calculatedAt), 'MMM d, yyyy h:mm a')}
                              </span>
                              {isAdmin && !period.isFinalized && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    saveQuotaPeriodMutation.mutate({
                                      yearMonth: period.yearMonth,
                                      partnerResults: period.partnerResults || '[]',
                                      individualResults: period.individualResults || '[]',
                                      isFinalized: true,
                                    });
                                  }}
                                  data-testid={`button-finalize-${period.id}`}
                                >
                                  Finalize
                                </Button>
                              )}
                            </div>
                          </div>
                          <CollapsibleContent className="mt-4 space-y-4">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Resource Quotas ({individualData.length})</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Resource</TableHead>
                                    <TableHead className="text-right">Target</TableHead>
                                    <TableHead className="text-right">Adjusted</TableHead>
                                    <TableHead className="text-right">Billed</TableHead>
                                    <TableHead className="text-right">Prebilled</TableHead>
                                    <TableHead className="text-right">% Complete</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {individualData.map((row: any) => (
                                    <TableRow key={row.userId}>
                                      <TableCell>{row.name}</TableCell>
                                      <TableCell className="text-right">{row.targetHours}hrs</TableCell>
                                      <TableCell className="text-right">{row.adjustedTarget?.toFixed(2)}hrs</TableCell>
                                      <TableCell className="text-right">{row.billedHours?.toFixed(1)}hrs</TableCell>
                                      <TableCell className="text-right">{row.prebilledHours?.toFixed(2)}hrs</TableCell>
                                      <TableCell className="text-right">
                                        <Badge variant={row.percentComplete >= 100 ? "default" : "secondary"}
                                               className={cn(row.percentComplete >= 100 && "bg-green-600 hover:bg-green-600")}>
                                          {row.percentComplete?.toFixed(0)}%
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

