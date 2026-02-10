import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ForecastAccountRevenue } from "@shared/schema";

export function AccountRevenueTab() {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: accountRevenue = [] } = useQuery<ForecastAccountRevenue[]>({
    queryKey: ["/api/forecast/account-revenue"],
  });
  const { data: agencies = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { toast } = useToast();

  const deleteRevenue = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/account-revenue/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/account-revenue"] });
      toast({ title: "Project forecast deleted successfully" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Forecasted Project Revenue</h2>
          <p className="text-sm text-muted-foreground">Manually enter expected project revenue by client and timeframe</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          data-testid="button-add-account-revenue"
        >
          Add Project Forecast
        </Button>
      </div>

      {isAdding && (
        <AccountRevenueForm
          onSuccess={() => setIsAdding(false)}
          onCancel={() => setIsAdding(false)}
          agencies={agencies}
        />
      )}

      <div className="space-y-3">
        {accountRevenue.map((revenue) => {
          const agency = agencies.find((a: any) => a.id === revenue.agencyId);
          const clientName = revenue.prospectName || agency?.name || 'Unknown Client';
          const isProspect = !!revenue.prospectName;
          
          return (
            <Card key={revenue.id}>
              <CardContent className="p-4">
                {editingId === revenue.id ? (
                  <AccountRevenueForm
                    revenue={revenue}
                    onSuccess={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                    agencies={agencies}
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl font-bold">{clientName}</span>
                          {isProspect && (
                            <Badge variant="secondary" className="text-xs">
                              Prospect
                            </Badge>
                          )}
                          <Badge variant="outline">
                            ${parseFloat(revenue.monthlyAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                          </Badge>
                          {revenue.isRecurring && (
                            <Badge variant="default" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                        {revenue.description && (
                          <p className="text-sm text-muted-foreground">{revenue.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Start: {new Date(revenue.startDate).toLocaleDateString()}</span>
                          {revenue.endDate && (
                            <span>End: {new Date(revenue.endDate).toLocaleDateString()}</span>
                          )}
                          {revenue.isRecurring && !revenue.endDate && (
                            <span>Ongoing</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(revenue.id)}
                          data-testid={`button-edit-revenue-${revenue.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRevenue.mutate(revenue.id)}
                          data-testid={`button-delete-revenue-${revenue.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {accountRevenue.length === 0 && !isAdding && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No project forecasts configured. Click "Add Project Forecast" to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccountRevenueForm({ revenue, onSuccess, onCancel, agencies }: {
  revenue?: ForecastAccountRevenue;
  onSuccess: () => void;
  onCancel: () => void;
  agencies: any[];
}) {
  const [monthlyAmount, setMonthlyAmount] = useState(revenue?.monthlyAmount || "");
  const [description, setDescription] = useState(revenue?.description || "");
  const [startDate, setStartDate] = useState(revenue?.startDate || "");
  const [endDate, setEndDate] = useState(revenue?.endDate || "");
  const [agencyId, setAgencyId] = useState(revenue?.agencyId || "");
  const [prospectName, setProspectName] = useState(revenue?.prospectName || "");
  const [isProspect, setIsProspect] = useState(!!revenue?.prospectName);
  const [isRecurring, setIsRecurring] = useState(revenue?.isRecurring || false);
  const { toast } = useToast();

  const createRevenue = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/forecast/account-revenue", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/account-revenue"] });
      toast({ title: "Project forecast created successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create project forecast", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const updateRevenue = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/forecast/account-revenue/${revenue?.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/account-revenue"] });
      toast({ title: "Project forecast updated successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update project forecast", 
        description: error?.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isProspect && !agencyId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }
    
    if (isProspect && !prospectName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prospect name",
        variant: "destructive",
      });
      return;
    }
    
    const data = {
      monthlyAmount,
      description: description || null,
      startDate,
      endDate: (isRecurring || !endDate) ? null : endDate,
      agencyId: isProspect ? null : agencyId,
      prospectName: isProspect ? prospectName.trim() : null,
      isRecurring,
      isActive: true,
    };

    if (revenue) {
      updateRevenue.mutate(data);
    } else {
      createRevenue.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <Checkbox
          id="is-prospect"
          checked={isProspect}
          onCheckedChange={(checked) => setIsProspect(checked as boolean)}
          data-testid="checkbox-is-prospect"
        />
        <label
          htmlFor="is-prospect"
          className="text-sm cursor-pointer"
        >
          This is a prospect (not an existing client)
        </label>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {isProspect ? (
          <div className="space-y-2">
            <Label htmlFor="prospect-name">Prospect Name</Label>
            <Input
              id="prospect-name"
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              placeholder="e.g., ACME Corp"
              required
              data-testid="input-prospect-name"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="revenue-agency">Client</Label>
            <select
              id="revenue-agency"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="w-full p-2 border rounded-md bg-background text-foreground"
              required
              data-testid="select-revenue-agency"
            >
              <option value="">Select Client</option>
              {agencies.map((agency: any) => (
                <option key={agency.id} value={agency.id}>{agency.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="revenue-monthly-amount">Monthly Revenue</Label>
          <Input
            id="revenue-monthly-amount"
            type="number"
            step="0.01"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            required
            placeholder="10000.00"
            data-testid="input-revenue-monthly-amount"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <Checkbox
          id="is-recurring"
          checked={isRecurring}
          onCheckedChange={(checked) => {
            setIsRecurring(checked as boolean);
            if (checked) setEndDate("");
          }}
          data-testid="checkbox-is-recurring"
        />
        <label
          htmlFor="is-recurring"
          className="text-sm cursor-pointer"
        >
          Recurring (ongoing monthly revenue, no end date)
        </label>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="revenue-start-date">Start Date</Label>
          <Input
            id="revenue-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            data-testid="input-revenue-start-date"
          />
        </div>
        {!isRecurring && (
          <div className="space-y-2">
            <Label htmlFor="revenue-end-date">End Date (optional)</Label>
            <Input
              id="revenue-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="input-revenue-end-date"
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="revenue-description">Description (optional)</Label>
        <Input
          id="revenue-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Ongoing development projects"
          data-testid="input-revenue-description"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={createRevenue.isPending || updateRevenue.isPending}
          data-testid="button-submit-revenue"
        >
          {createRevenue.isPending || updateRevenue.isPending ? "Saving..." : revenue ? "Update" : "Add"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-revenue">
          Cancel
        </Button>
      </div>
    </form>
  );
}
