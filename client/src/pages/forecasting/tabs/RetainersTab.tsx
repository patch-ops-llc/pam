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
import type { ForecastRetainer } from "@shared/schema";

export function RetainersTab() {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: retainers = [] } = useQuery<ForecastRetainer[]>({
    queryKey: ["/api/forecast/retainers"],
  });
  const { data: agencies = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const { toast } = useToast();

  const deleteRetainer = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/retainers/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/retainers"] });
      toast({ title: "Retainer deleted successfully" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Monthly Retainers</h2>
          <p className="text-sm text-muted-foreground">Track recurring retainer revenue</p>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          data-testid="button-add-retainer"
        >
          Add Retainer
        </Button>
      </div>

      {isAdding && (
        <RetainerForm
          onSuccess={() => setIsAdding(false)}
          onCancel={() => setIsAdding(false)}
          agencies={agencies}
        />
      )}

      <div className="space-y-3">
        {retainers.map((retainer) => (
          <Card key={retainer.id}>
            <CardContent className="p-4">
              {editingId === retainer.id ? (
                <RetainerForm
                  retainer={retainer}
                  onSuccess={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                  agencies={agencies}
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">
                          ${parseFloat(retainer.monthlyAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/month
                        </span>
                        {retainer.agencyId && (
                          <Badge variant="outline">
                            {agencies.find(a => a.id === retainer.agencyId)?.name || 'Unknown'}
                          </Badge>
                        )}
                      </div>
                      {retainer.description && (
                        <p className="text-sm text-muted-foreground">{retainer.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Start: {new Date(retainer.startDate).toLocaleDateString()}</span>
                        {retainer.endDate && (
                          <span>End: {new Date(retainer.endDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(retainer.id)}
                        data-testid={`button-edit-retainer-${retainer.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRetainer.mutate(retainer.id)}
                        data-testid={`button-delete-retainer-${retainer.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {retainers.length === 0 && !isAdding && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No retainers configured. Click "Add Retainer" to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RetainerForm({ retainer, onSuccess, onCancel, agencies }: {
  retainer?: ForecastRetainer;
  onSuccess: () => void;
  onCancel: () => void;
  agencies: any[];
}) {
  const [monthlyAmount, setMonthlyAmount] = useState(retainer?.monthlyAmount || "");
  const [description, setDescription] = useState(retainer?.description || "");
  const [startDate, setStartDate] = useState(retainer?.startDate || "");
  const [endDate, setEndDate] = useState(retainer?.endDate || "");
  const [agencyId, setAgencyId] = useState(retainer?.agencyId || "");
  const { toast } = useToast();

  const createRetainer = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/forecast/retainers", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/retainers"] });
      toast({ title: "Retainer created successfully" });
      onSuccess();
    },
  });

  const updateRetainer = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/forecast/retainers/${retainer!.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/retainers"] });
      toast({ title: "Retainer updated successfully" });
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data = {
      monthlyAmount,
      description: description || null,
      startDate,
      endDate: endDate || null,
      agencyId: agencyId || null,
      isActive: true,
    };

    if (retainer) {
      updateRetainer.mutate(data);
    } else {
      createRetainer.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-muted/30">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="retainer-amount">Monthly Amount</Label>
          <Input
            id="retainer-amount"
            type="number"
            step="0.01"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            required
            data-testid="input-retainer-amount"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="retainer-agency">Agency (optional)</Label>
          <select
            id="retainer-agency"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="w-full p-2 border rounded-md bg-background text-foreground"
            data-testid="select-retainer-agency"
          >
            <option value="">None</option>
            {agencies.map((agency: any) => (
              <option key={agency.id} value={agency.id}>{agency.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="retainer-start-date">Start Date</Label>
          <Input
            id="retainer-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            data-testid="input-retainer-start-date"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="retainer-end-date">End Date (optional)</Label>
          <Input
            id="retainer-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            data-testid="input-retainer-end-date"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="retainer-description">Description (optional)</Label>
        <Input
          id="retainer-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Client Name - Monthly Retainer"
          data-testid="input-retainer-description"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={createRetainer.isPending || updateRetainer.isPending}
          data-testid="button-submit-retainer"
        >
          {createRetainer.isPending || updateRetainer.isPending ? "Saving..." : retainer ? "Update" : "Add"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-retainer">
          Cancel
        </Button>
      </div>
    </form>
  );
}
