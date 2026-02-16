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
import { Check, Loader2, ChevronRight, DollarSign, Users, Target, TrendingUp, Info, Plus, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

type PartnerBonusPolicy = {
  id: string;
  agencyId: string;
  name: string;
  monthlyTargetHours: string;
  bonusFullTime: string;
  bonusPartTime: string;
  overageRate: string;
  isActive: boolean;
};

type IndividualQuotaBonusSettings = {
  id: string;
  employmentType: string;
  monthlyTargetHours: string;
  quotaBonus: string;
  overageRate: string;
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

type PartnerHoursData = {
  agencyId: string;
  totalBilledHours: number;
};

const ADMIN_EMAIL = "zach@patchops.io";
const STANDARD_MONTHLY_HOURS = 160; // 40 hours/week * 4 weeks

// Hardcoded Bonus Policy - Effective January 2025
const BONUS_POLICY = {
  partnerBonuses: {
    fullTime: 135,  // $135 per partner
    partTime: 68,   // $68 per partner
  },
  individualQuota: {
    fullTime: 270,  // $270
    partTime: 135,  // $135
  },
  overageRate: 5,  // $5 per hour over individual quota
};

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
  
  const [partnerPolicyDialogOpen, setPartnerPolicyDialogOpen] = useState(false);
  const [editingPartnerPolicy, setEditingPartnerPolicy] = useState<PartnerBonusPolicy | null>(null);
  const [individualSettingsDialogOpen, setIndividualSettingsDialogOpen] = useState(false);
  const [editingIndividualSetting, setEditingIndividualSetting] = useState<IndividualQuotaBonusSettings | null>(null);
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

  const { data: partnerBonusPolicies = [], isLoading: partnerPoliciesLoading } = useQuery<PartnerBonusPolicy[]>({
    queryKey: ["/api/partner-bonus-policies"],
  });

  const { data: individualBonusSettings = [], isLoading: individualSettingsLoading } = useQuery<IndividualQuotaBonusSettings[]>({
    queryKey: ["/api/individual-quota-bonus-settings"],
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

  // Fetch billed hours per agency for partner bonus calculations
  const { data: partnerHoursData = [] } = useQuery<PartnerHoursData[]>({
    queryKey: ["/api/analytics/partner-hours", activeMonth],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/partner-hours?month=${activeMonth}`);
      if (!res.ok) return [];
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

  const createPartnerPolicyMutation = useMutation({
    mutationFn: async (policy: Omit<PartnerBonusPolicy, 'id'>) => {
      return await apiRequest("/api/partner-bonus-policies", "POST", policy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-bonus-policies"] });
      setPartnerPolicyDialogOpen(false);
      setEditingPartnerPolicy(null);
      toast({
        title: "Success",
        description: "Partner bonus policy created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create partner bonus policy",
        variant: "destructive",
      });
    },
  });

  const updatePartnerPolicyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PartnerBonusPolicy> }) => {
      return await apiRequest(`/api/partner-bonus-policies/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-bonus-policies"] });
      setPartnerPolicyDialogOpen(false);
      setEditingPartnerPolicy(null);
      toast({
        title: "Success",
        description: "Partner bonus policy updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update partner bonus policy",
        variant: "destructive",
      });
    },
  });

  const deletePartnerPolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/partner-bonus-policies/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner-bonus-policies"] });
      toast({
        title: "Success",
        description: "Partner bonus policy deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete partner bonus policy",
        variant: "destructive",
      });
    },
  });

  const updateIndividualSettingsMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IndividualQuotaBonusSettings> }) => {
      return await apiRequest(`/api/individual-quota-bonus-settings/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/individual-quota-bonus-settings"] });
      setIndividualSettingsDialogOpen(false);
      setEditingIndividualSetting(null);
      toast({
        title: "Success",
        description: "Individual bonus settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update individual bonus settings",
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

  const isLoading = agenciesLoading || usersLoading || resourceQuotasLoading || partnerPoliciesLoading || individualSettingsLoading;

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

  // Get individual settings for display
  const fullTimeSetting = individualBonusSettings.find(s => s.employmentType === 'full-time');
  const partTimeSetting = individualBonusSettings.find(s => s.employmentType === 'part-time');

  // Calculate partner quota progress using partner bonus policies targets + billed hours
  const partnerQuotaStatus = partnerBonusPolicies
    .filter(p => p.isActive)
    .map(policy => {
      const hoursData = partnerHoursData.find(h => h.agencyId === policy.agencyId);
      const billedHours = hoursData?.totalBilledHours || 0;
      const target = parseFloat(policy.monthlyTargetHours);
      const percentComplete = target > 0 ? (billedHours / target) * 100 : 0;
      return {
        policy,
        billedHours,
        target,
        percentComplete,
        quotaHit: percentComplete >= 100,
      };
    });

  return (
    <div className="space-y-6">
      {/* Employee Bonus Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Employee Bonus Guide
          </CardTitle>
          <CardDescription>
            Understanding how bonuses are calculated and earned each month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Partner Quota Bonus */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold">Partner Quota Bonus</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                When the team hits a partner's monthly target, everyone earns a bonus.
              </p>
              {partnerBonusPolicies.length > 0 ? (
                <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                  {partnerBonusPolicies.map((policy) => (
                    <div key={policy.id} className="border-l-2 border-blue-200 pl-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">{policy.name}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{policy.monthlyTargetHours}hrs/mo</Badge>
                      </div>
                      <div className="flex gap-3 text-xs mt-0.5">
                        <span>FT: <span className="font-medium text-green-600">${parseFloat(policy.bonusFullTime).toFixed(0)}</span></span>
                        <span>PT: <span className="font-medium text-green-600">${parseFloat(policy.bonusPartTime).toFixed(0)}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No partner policies configured</p>
              )}
            </div>

            {/* Individual Quota Bonus */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold">Individual Quota Bonus</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Hit your personal monthly target to earn your individual quota bonus.
              </p>
              {individualBonusSettings.length > 0 ? (
                <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                  {individualBonusSettings.map((setting) => (
                    <div key={setting.id} className="border-l-2 border-purple-200 pl-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs capitalize">{setting.employmentType}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{setting.monthlyTargetHours}hrs/mo</Badge>
                      </div>
                      <div className="text-xs mt-0.5">
                        Bonus: <span className="font-medium text-green-600">${parseFloat(setting.quotaBonus).toFixed(0)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No individual quota settings configured</p>
              )}
            </div>

            {/* Overage Bonus */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <h3 className="font-semibold">Overage Bonus</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Earn extra for every hour billed beyond your individual quota.
              </p>
              {individualBonusSettings.length > 0 ? (
                <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                  {individualBonusSettings.map((setting) => (
                    <div key={setting.id} className="border-l-2 border-orange-200 pl-2 py-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs capitalize">{setting.employmentType}</span>
                        <span className="font-medium text-green-600 text-xs">${parseFloat(setting.overageRate).toFixed(2)}/hr</span>
                      </div>
                    </div>
                  ))}
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Example: 10hrs over = ${(parseFloat(individualBonusSettings[0]?.overageRate || '5') * 10).toFixed(0)} bonus
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Overage rate not configured</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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

          {/* Bonus Calculator */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Bonus Calculator - {activeMonthDisplay}
              </CardTitle>
              <CardDescription>
                Estimated bonus amounts based on current month progress. Partner bonuses require hitting the partner's monthly target.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Partner Quota Status */}
              <div className="mb-6">
                <h4 className="font-medium text-sm mb-3">Partner Quota Status</h4>
                <div className="flex flex-wrap gap-2">
                  {partnerQuotaStatus.length > 0 ? partnerQuotaStatus.map((status) => (
                    <Badge 
                      key={status.policy.id}
                      variant={status.quotaHit ? "default" : "secondary"}
                      className={cn("text-sm py-1 px-3", status.quotaHit && "bg-green-600 hover:bg-green-600")}
                    >
                      {status.quotaHit ? <Check className="h-3 w-3 mr-1" /> : null}
                      {status.policy.name}: {status.percentComplete.toFixed(0)}%
                    </Badge>
                  )) : (
                    <p className="text-sm text-muted-foreground italic">No partner bonus policies configured</p>
                  )}
                </div>
              </div>

              {/* Individual Bonus Estimates */}
              <div>
                <h4 className="font-medium text-sm mb-3">Individual Bonus Estimates</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead className="text-right">Partner Bonus</TableHead>
                      <TableHead className="text-right">Quota Bonus</TableHead>
                      <TableHead className="text-right">Overage Bonus</TableHead>
                      <TableHead className="text-right">Total Estimated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resourceQuotaProgress.map((progress) => {
                      const thisUser = users.find(u => u.id === progress.user.id);
                      const isFullTime = thisUser?.employmentType !== 'part-time';
                      
                      // Count partners that hit quota (using partner bonus policies)
                      const partnersHitQuota = partnerQuotaStatus.filter(s => s.quotaHit).length;
                      
                      // Partner bonus per partner quota hit
                      const partnerBonus = partnersHitQuota * (isFullTime ? BONUS_POLICY.partnerBonuses.fullTime : BONUS_POLICY.partnerBonuses.partTime);
                      
                      // Individual quota bonus
                      const totalHours = progress.billedHours + (progress.prebilledHours || 0);
                      const hitQuota = totalHours >= progress.adjustedTarget;
                      const quotaBonus = hitQuota ? (isFullTime ? BONUS_POLICY.individualQuota.fullTime : BONUS_POLICY.individualQuota.partTime) : 0;
                      
                      // Overage bonus
                      const overageHours = Math.max(0, totalHours - progress.adjustedTarget);
                      const overageBonus = overageHours * BONUS_POLICY.overageRate;
                      
                      const totalBonus = partnerBonus + quotaBonus + overageBonus;
                      
                      return (
                        <TableRow key={progress.user.id}>
                          <TableCell className="font-medium">
                            {progress.user.firstName} {progress.user.lastName}
                            <Badge variant="outline" className="ml-2 text-xs">
                              {isFullTime ? 'FT' : 'PT'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            ${partnerBonus.toFixed(0)}
                            {partnersHitQuota > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({partnersHitQuota} partners)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(hitQuota ? "text-green-600" : "text-muted-foreground")}>
                              ${quotaBonus.toFixed(0)}
                            </span>
                            {!hitQuota && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({(progress.adjustedTarget - totalHours).toFixed(1)}hrs to go)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            ${overageBonus.toFixed(0)}
                            {overageHours > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({overageHours.toFixed(2)}hrs)
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={cn(totalBonus > 0 ? "text-green-600" : "")}>
                              ${totalBonus.toFixed(0)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {resourceQuotaProgress.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground italic">
                          No resource quota progress data available
                        </TableCell>
                      </TableRow>
                    )}
                    {/* Total Payout Row */}
                    {resourceQuotaProgress.length > 0 && (() => {
                      const partnersHitQuota = partnerQuotaStatus.filter(s => s.quotaHit).length;

                      let totalPartnerBonus = 0;
                      let totalQuotaBonus = 0;
                      let totalOverageBonus = 0;

                      resourceQuotaProgress.forEach((progress) => {
                        const thisUser = users.find(u => u.id === progress.user.id);
                        const isFullTime = thisUser?.employmentType !== 'part-time';
                        
                        totalPartnerBonus += partnersHitQuota * (isFullTime ? BONUS_POLICY.partnerBonuses.fullTime : BONUS_POLICY.partnerBonuses.partTime);
                        
                        const totalHours = progress.billedHours + (progress.prebilledHours || 0);
                        const hitQuota = totalHours >= progress.adjustedTarget;
                        totalQuotaBonus += hitQuota ? (isFullTime ? BONUS_POLICY.individualQuota.fullTime : BONUS_POLICY.individualQuota.partTime) : 0;
                        
                        const overageHours = Math.max(0, totalHours - progress.adjustedTarget);
                        totalOverageBonus += overageHours * BONUS_POLICY.overageRate;
                      });

                      const grandTotal = totalPartnerBonus + totalQuotaBonus + totalOverageBonus;

                      return (
                        <TableRow className="bg-muted/50 font-bold border-t-2">
                          <TableCell>Total Payout</TableCell>
                          <TableCell className="text-right">${totalPartnerBonus.toFixed(0)}</TableCell>
                          <TableCell className="text-right">${totalQuotaBonus.toFixed(0)}</TableCell>
                          <TableCell className="text-right">${totalOverageBonus.toFixed(0)}</TableCell>
                          <TableCell className="text-right text-lg">
                            <span className="text-green-600">${grandTotal.toFixed(0)}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </div>

              {/* Bonus Policy Summary */}
              <Alert className="mt-6">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Bonus Policy:</strong> Partner quota hit = ${BONUS_POLICY.partnerBonuses.fullTime} FT / ${BONUS_POLICY.partnerBonuses.partTime} PT per partner | 
                  Individual quota hit = ${BONUS_POLICY.individualQuota.fullTime} FT / ${BONUS_POLICY.individualQuota.partTime} PT | 
                  Overage = ${BONUS_POLICY.overageRate}/hr beyond quota
                </AlertDescription>
              </Alert>
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

      {/* Bonus Policies */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Partner Bonus Policies</CardTitle>
                <CardDescription>
                  Configure bonus amounts and targets for each partner agency. When the team hits a partner's monthly target, all eligible team members earn the bonus.
                </CardDescription>
              </div>
              {isAdmin && (
                <Dialog open={partnerPolicyDialogOpen && !editingPartnerPolicy} onOpenChange={(open) => {
                  setPartnerPolicyDialogOpen(open);
                  if (!open) setEditingPartnerPolicy(null);
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-partner-policy">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Partner Bonus Policy</DialogTitle>
                      <DialogDescription>
                        Create a new partner bonus policy for an agency.
                      </DialogDescription>
                    </DialogHeader>
                    <PartnerPolicyForm
                      agencies={agencies}
                      onSubmit={(data) => createPartnerPolicyMutation.mutate(data)}
                      isPending={createPartnerPolicyMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {partnerBonusPolicies.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {isAdmin 
                    ? "No partner bonus policies configured. Click 'Add Policy' to create one."
                    : "No partner bonus policies configured. Contact an administrator to set up partner quotas."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Monthly Target</TableHead>
                      <TableHead>FT Bonus</TableHead>
                      <TableHead>PT Bonus</TableHead>
                      <TableHead>Overage Rate</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerBonusPolicies.map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell className="font-medium">{policy.name}</TableCell>
                        <TableCell>{policy.monthlyTargetHours} hrs</TableCell>
                        <TableCell className="text-green-600">${policy.bonusFullTime}</TableCell>
                        <TableCell className="text-green-600">${policy.bonusPartTime}</TableCell>
                        <TableCell>${policy.overageRate}/hr</TableCell>
                        <TableCell>
                          <Badge variant={policy.isActive ? "default" : "secondary"}>
                            {policy.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Dialog open={editingPartnerPolicy?.id === policy.id} onOpenChange={(open) => {
                                if (!open) setEditingPartnerPolicy(null);
                              }}>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => setEditingPartnerPolicy(policy)}
                                    data-testid={`button-edit-partner-policy-${policy.id}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Partner Bonus Policy</DialogTitle>
                                    <DialogDescription>
                                      Update the partner bonus policy settings.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <PartnerPolicyForm
                                    agencies={agencies}
                                    initialData={policy}
                                    onSubmit={(data) => updatePartnerPolicyMutation.mutate({ id: policy.id, data })}
                                    isPending={updatePartnerPolicyMutation.isPending}
                                  />
                                </DialogContent>
                              </Dialog>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => {
                                  if (confirm("Are you sure you want to delete this policy?")) {
                                    deletePartnerPolicyMutation.mutate(policy.id);
                                  }
                                }}
                                data-testid={`button-delete-partner-policy-${policy.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Individual Quota Settings */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Individual Quota Bonus Settings</CardTitle>
              <CardDescription>
                Configure the individual quota targets and bonus amounts by employment type. These bonuses are earned when team members hit their personal monthly targets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Monthly Target</TableHead>
                    <TableHead>Quota Bonus</TableHead>
                    <TableHead>Overage Rate</TableHead>
                    {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {individualBonusSettings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium capitalize">{setting.employmentType}</TableCell>
                      <TableCell>{setting.monthlyTargetHours} hrs</TableCell>
                      <TableCell className="text-green-600">${setting.quotaBonus}</TableCell>
                      <TableCell>${setting.overageRate}/hr</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Dialog open={editingIndividualSetting?.id === setting.id} onOpenChange={(open) => {
                            if (!open) setEditingIndividualSetting(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => setEditingIndividualSetting(setting)}
                                data-testid={`button-edit-individual-setting-${setting.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Individual Bonus Settings</DialogTitle>
                                <DialogDescription>
                                  Update bonus settings for {setting.employmentType} employees.
                                </DialogDescription>
                              </DialogHeader>
                              <IndividualSettingsForm
                                initialData={setting}
                                onSubmit={(data) => updateIndividualSettingsMutation.mutate({ id: setting.id, data })}
                                isPending={updateIndividualSettingsMutation.isPending}
                              />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
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

function PartnerPolicyForm({ 
  agencies, 
  initialData, 
  onSubmit, 
  isPending 
}: { 
  agencies: Agency[];
  initialData?: PartnerBonusPolicy;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    agencyId: initialData?.agencyId || "",
    name: initialData?.name || "",
    monthlyTargetHours: initialData?.monthlyTargetHours || "160",
    bonusFullTime: initialData?.bonusFullTime || "150",
    bonusPartTime: initialData?.bonusPartTime || "75",
    overageRate: initialData?.overageRate || "5",
    isActive: initialData?.isActive ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agencyId">Partner Agency</Label>
        <Select 
          value={formData.agencyId} 
          onValueChange={(value) => {
            const agency = agencies.find(a => a.id === value);
            setFormData(prev => ({ 
              ...prev, 
              agencyId: value,
              name: agency?.name || prev.name
            }));
          }}
        >
          <SelectTrigger data-testid="select-partner-agency">
            <SelectValue placeholder="Select an agency" />
          </SelectTrigger>
          <SelectContent>
            {agencies.filter(a => a.isActive).map((agency) => (
              <SelectItem key={agency.id} value={agency.id}>
                {agency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Policy Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Partner Quota Bonus"
          data-testid="input-policy-name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="monthlyTargetHours">Monthly Target (hrs)</Label>
          <Input
            id="monthlyTargetHours"
            type="number"
            min="0"
            step="0.5"
            value={formData.monthlyTargetHours}
            onChange={(e) => setFormData(prev => ({ ...prev, monthlyTargetHours: e.target.value }))}
            data-testid="input-monthly-target"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overageRate">Overage Rate ($/hr)</Label>
          <Input
            id="overageRate"
            type="number"
            min="0"
            step="0.01"
            value={formData.overageRate}
            onChange={(e) => setFormData(prev => ({ ...prev, overageRate: e.target.value }))}
            data-testid="input-overage-rate"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bonusFullTime">Full-Time Bonus ($)</Label>
          <Input
            id="bonusFullTime"
            type="number"
            min="0"
            step="0.01"
            value={formData.bonusFullTime}
            onChange={(e) => setFormData(prev => ({ ...prev, bonusFullTime: e.target.value }))}
            data-testid="input-bonus-ft"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bonusPartTime">Part-Time Bonus ($)</Label>
          <Input
            id="bonusPartTime"
            type="number"
            min="0"
            step="0.01"
            value={formData.bonusPartTime}
            onChange={(e) => setFormData(prev => ({ ...prev, bonusPartTime: e.target.value }))}
            data-testid="input-bonus-pt"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked as boolean }))}
          data-testid="checkbox-policy-active"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending || !formData.agencyId || !formData.name} data-testid="button-save-policy">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            initialData ? "Update Policy" : "Create Policy"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function IndividualSettingsForm({ 
  initialData, 
  onSubmit, 
  isPending 
}: { 
  initialData: IndividualQuotaBonusSettings;
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    monthlyTargetHours: initialData.monthlyTargetHours || "160",
    quotaBonus: initialData.quotaBonus || "300",
    overageRate: initialData.overageRate || "5",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="monthlyTargetHours">Monthly Target (hrs)</Label>
        <Input
          id="monthlyTargetHours"
          type="number"
          min="0"
          step="0.5"
          value={formData.monthlyTargetHours}
          onChange={(e) => setFormData(prev => ({ ...prev, monthlyTargetHours: e.target.value }))}
          data-testid="input-individual-target"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quotaBonus">Quota Bonus ($)</Label>
          <Input
            id="quotaBonus"
            type="number"
            min="0"
            step="0.01"
            value={formData.quotaBonus}
            onChange={(e) => setFormData(prev => ({ ...prev, quotaBonus: e.target.value }))}
            data-testid="input-quota-bonus"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overageRate">Overage Rate ($/hr)</Label>
          <Input
            id="overageRate"
            type="number"
            min="0"
            step="0.01"
            value={formData.overageRate}
            onChange={(e) => setFormData(prev => ({ ...prev, overageRate: e.target.value }))}
            data-testid="input-individual-overage"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending} data-testid="button-save-individual-settings">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Update Settings"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
