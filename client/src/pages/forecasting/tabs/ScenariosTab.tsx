import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import type { ForecastScenario } from "@shared/schema";

export function ScenariosTab() {
  const [isCreating, setIsCreating] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ForecastScenario | null>(null);
  const { toast } = useToast();
  
  const { data: scenarios = [] } = useQuery<ForecastScenario[]>({
    queryKey: ["/api/forecast/scenarios"],
  });

  const { data: agencies = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });

  const deleteScenario = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/scenarios/${id}`, "DELETE");
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/scenarios"] });
      toast({ title: "Scenario deleted" });
      if (selectedScenario?.id === id) {
        setSelectedScenario(null);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete scenario", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scenario Planning</CardTitle>
              <CardDescription>Project outcomes based on new accounts and engagement changes</CardDescription>
            </div>
            <Button onClick={() => setIsCreating(!isCreating)} data-testid="button-create-scenario">
              {isCreating ? "Cancel" : "Create Scenario"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCreating && (
            <ScenarioForm 
              onSuccess={() => setIsCreating(false)} 
              agencies={agencies || []}
            />
          )}
          
          <div className="space-y-2">
            {scenarios.length > 0 ? (
              scenarios.map((scenario) => (
                <div 
                  key={scenario.id} 
                  className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                  data-testid={`scenario-${scenario.id}`}
                >
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => setSelectedScenario(scenario)}
                  >
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Blended rate: ${scenario.blendedRate}/hr
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScenario.mutate(scenario.id);
                    }}
                    data-testid={`button-delete-scenario-${scenario.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">No scenarios yet</div>
            )}
          </div>

          {selectedScenario && (
            <ScenarioDetail 
              scenario={selectedScenario} 
              onClose={() => setSelectedScenario(null)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ScenarioForm({ onSuccess, agencies }: { 
  onSuccess: () => void; 
  agencies: any[];
}) {
  const [name, setName] = useState("");
  const [blendedRate, setBlendedRate] = useState("90");
  const [quotaChanges, setQuotaChanges] = useState<Record<string, string>>({});
  const [newAccountName, setNewAccountName] = useState("");
  const [engagementType, setEngagementType] = useState("retainer");
  const [engagementValue, setEngagementValue] = useState("");
  const [newAccounts, setNewAccounts] = useState<Array<{name: string; engagementType: string; value: string}>>([]);
  const { toast } = useToast();

  const createScenario = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/forecast/scenarios", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/scenarios"] });
      toast({ title: "Scenario created successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to create scenario", variant: "destructive" });
    },
  });

  const addNewAccount = () => {
    if (newAccountName && engagementValue) {
      setNewAccounts([...newAccounts, { 
        name: newAccountName, 
        engagementType, 
        value: engagementValue 
      }]);
      setNewAccountName("");
      setEngagementValue("");
    }
  };

  const removeAccount = (index: number) => {
    setNewAccounts(newAccounts.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createScenario.mutate({
      name,
      blendedRate,
      agencyQuotaChanges: JSON.stringify(quotaChanges),
      newAccounts: newAccounts.length > 0 ? JSON.stringify(newAccounts) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="scenario-name">Scenario Name</Label>
          <Input
            id="scenario-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Q1 2025 Growth"
            data-testid="input-scenario-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scenario-rate">Blended Rate ($/hr)</Label>
          <Input
            id="scenario-rate"
            type="number"
            step="0.01"
            value={blendedRate}
            onChange={(e) => setBlendedRate(e.target.value)}
            required
            data-testid="input-scenario-rate"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Hours Adjustments by Agency (hours/week)</Label>
        {agencies.map((agency: any) => (
          <div key={agency.id} className="flex items-center gap-2">
            <span className="w-32 text-sm">{agency.name}:</span>
            <Input
              type="number"
              step="0.5"
              placeholder="0"
              value={quotaChanges[agency.id] || ""}
              onChange={(e) => setQuotaChanges({ ...quotaChanges, [agency.id]: e.target.value })}
              className="flex-1"
              data-testid={`input-quota-${agency.id}`}
            />
          </div>
        ))}
      </div>

      <div className="space-y-4 p-4 bg-muted/30 rounded-md">
        <Label>New Accounts</Label>
        {newAccounts.length > 0 && (
          <div className="space-y-2">
            {newAccounts.map((account, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                <div className="text-sm">
                  <span className="font-medium">{account.name}</span> - {account.engagementType}
                  {account.engagementType === 'retainer' && ` ($${account.value}/month)`}
                  {account.engagementType === 'hourly' && ` (${account.value} hrs/week)`}
                  {account.engagementType === 'project' && ` ($${account.value} pre-billed)`}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAccount(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="grid grid-cols-4 gap-2">
          <Input
            placeholder="Account name"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            data-testid="input-new-account-name"
          />
          <select
            value={engagementType}
            onChange={(e) => setEngagementType(e.target.value)}
            className="p-2 border rounded-md bg-background text-foreground"
            data-testid="select-engagement-type"
          >
            <option value="retainer">Retainer</option>
            <option value="hourly">Hourly</option>
            <option value="project">Project (Pre-billed)</option>
          </select>
          <Input
            type="number"
            step="0.01"
            placeholder={engagementType === 'hourly' ? 'Hours/week' : 'Amount'}
            value={engagementValue}
            onChange={(e) => setEngagementValue(e.target.value)}
            data-testid="input-engagement-value"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addNewAccount}
            data-testid="button-add-account"
          >
            Add
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={createScenario.isPending} data-testid="button-submit-scenario">
        {createScenario.isPending ? "Creating..." : "Create Scenario"}
      </Button>
    </form>
  );
}

function ScenarioDetail({ scenario, onClose }: { 
  scenario: ForecastScenario;
  onClose: () => void;
}) {
  const quotaChanges = scenario.agencyQuotaChanges ? JSON.parse(scenario.agencyQuotaChanges) : {};
  const newAccounts = scenario.newAccounts ? JSON.parse(scenario.newAccounts) : [];
  const blendedRate = parseFloat(scenario.blendedRate);
  
  const quotaRevenue = Object.entries(quotaChanges).reduce((sum, [_, hours]) => {
    const weeklyHours = parseFloat(hours as string);
    const weeks = 13;
    return sum + (weeklyHours * blendedRate * weeks);
  }, 0);

  const newAccountsRevenue = newAccounts.reduce((sum: number, account: any) => {
    const value = parseFloat(account.value);
    if (account.engagementType === 'retainer') {
      return sum + (value * 3);
    } else if (account.engagementType === 'hourly') {
      return sum + (value * blendedRate * 13);
    } else if (account.engagementType === 'project') {
      return sum + value;
    }
    return sum;
  }, 0);

  const totalRevenue = quotaRevenue + newAccountsRevenue;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <Card className="w-full max-w-2xl m-4" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{scenario.name}</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-scenario">
              ×
            </Button>
          </div>
          <CardDescription>Scenario projection (90 days)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Blended Rate</div>
              <div className="text-lg font-semibold">${blendedRate}/hr</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Projected Revenue</div>
              <div className="text-lg font-semibold text-green-600">
                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {Object.keys(quotaChanges).length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Hours Adjustments</div>
              {Object.entries(quotaChanges).map(([agencyId, hours]) => (
                <div key={agencyId} className="flex justify-between text-sm">
                  <span>Agency {agencyId.slice(0, 8)}...</span>
                  <span>{hours} hrs/week</span>
                </div>
              ))}
            </div>
          )}

          {newAccounts.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">New Accounts</div>
              {newAccounts.map((account: any, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{account.name} ({account.engagementType})</span>
                  <span>
                    {account.engagementType === 'retainer' && `$${parseFloat(account.value).toLocaleString()}/mo × 3 = $${(parseFloat(account.value) * 3).toLocaleString()}`}
                    {account.engagementType === 'hourly' && `${account.value} hrs/wk × 13 wks = $${(parseFloat(account.value) * blendedRate * 13).toLocaleString()}`}
                    {account.engagementType === 'project' && `$${parseFloat(account.value).toLocaleString()} pre-billed`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
