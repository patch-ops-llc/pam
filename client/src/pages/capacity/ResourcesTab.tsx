import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import type { ForecastCapacityResource } from "@shared/schema";

export function ResourcesTab() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { toast } = useToast();

  const { data: resources = [] } = useQuery<ForecastCapacityResource[]>({
    queryKey: ["/api/forecast/capacity/resources"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/capacity/resources/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/capacity/resources"] });
      toast({ title: "Resource deleted" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Resources</CardTitle>
            <CardDescription>Configure team members with their billable and actual hours per month</CardDescription>
          </div>
          <Button onClick={() => setIsAddingNew(!isAddingNew)} data-testid="button-add-resource">
            <Plus className="h-4 w-4 mr-2" />
            {isAddingNew ? "Cancel" : "Add Resource"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Billable Hours/Month</TableHead>
              <TableHead>Actual Hours/Month</TableHead>
              <TableHead>Efficiency %</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAddingNew && (
              <ResourceRow 
                onSuccess={() => setIsAddingNew(false)} 
                onCancel={() => setIsAddingNew(false)}
              />
            )}
            {resources.map((resource) => (
              editingId === resource.id ? (
                <ResourceRow 
                  key={resource.id}
                  resource={resource}
                  onSuccess={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TableRow key={resource.id}>
                  <TableCell className="font-medium">{resource.name}</TableCell>
                  <TableCell>{resource.defaultBillableHours}</TableCell>
                  <TableCell>{resource.defaultActualHours}</TableCell>
                  <TableCell>{resource.defaultEfficiencyPercent || "100"}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{resource.notes || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(resource.id)}
                        data-testid={`button-edit-resource-${resource.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(resource.id)}
                        data-testid={`button-delete-resource-${resource.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            ))}
            {resources.length === 0 && !isAddingNew && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No resources configured yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ResourceRow({ resource, onSuccess, onCancel }: { 
  resource?: ForecastCapacityResource; 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: resource?.name || "",
    defaultBillableHours: resource?.defaultBillableHours || "160",
    defaultActualHours: resource?.defaultActualHours || "160",
    defaultEfficiencyPercent: resource?.defaultEfficiencyPercent || "100",
    notes: resource?.notes || "",
  });
  const { toast } = useToast();

  const handleBillableHoursChange = (value: string) => {
    const billable = parseFloat(value);
    const actual = parseFloat(formData.defaultActualHours);
    
    if (!isNaN(billable) && !isNaN(actual) && actual > 0) {
      const efficiency = (billable / actual) * 100;
      setFormData({ 
        ...formData, 
        defaultBillableHours: value,
        defaultEfficiencyPercent: efficiency.toFixed(2)
      });
    } else {
      setFormData({ ...formData, defaultBillableHours: value });
    }
  };

  const handleActualHoursChange = (value: string) => {
    const actual = parseFloat(value);
    const billable = parseFloat(formData.defaultBillableHours);
    
    if (!isNaN(actual) && !isNaN(billable) && actual > 0) {
      const efficiency = (billable / actual) * 100;
      setFormData({ 
        ...formData, 
        defaultActualHours: value,
        defaultEfficiencyPercent: efficiency.toFixed(2)
      });
    } else {
      setFormData({ ...formData, defaultActualHours: value });
    }
  };

  const handleEfficiencyChange = (value: string) => {
    const efficiency = parseFloat(value);
    const billable = parseFloat(formData.defaultBillableHours);
    
    if (!isNaN(efficiency) && !isNaN(billable) && efficiency > 0) {
      const actual = billable / (efficiency / 100);
      setFormData({ 
        ...formData, 
        defaultEfficiencyPercent: value,
        defaultActualHours: actual.toFixed(2)
      });
    } else {
      setFormData({ ...formData, defaultEfficiencyPercent: value });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (resource) {
        return await apiRequest(`/api/forecast/capacity/resources/${resource.id}`, "PATCH", data);
      } else {
        return await apiRequest("/api/forecast/capacity/resources", "POST", { ...data, isActive: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/capacity/resources"] });
      toast({ title: resource ? "Resource updated" : "Resource created" });
      onSuccess();
    },
  });

  return (
    <TableRow>
      <TableCell>
        <Input 
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Name"
          data-testid="input-resource-name"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="number"
          value={formData.defaultBillableHours}
          onChange={(e) => handleBillableHoursChange(e.target.value)}
          placeholder="160"
          data-testid="input-billable-hours"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="number"
          value={formData.defaultActualHours}
          onChange={(e) => handleActualHoursChange(e.target.value)}
          placeholder="160"
          data-testid="input-actual-hours"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="number"
          value={formData.defaultEfficiencyPercent}
          onChange={(e) => handleEfficiencyChange(e.target.value)}
          placeholder="100"
          data-testid="input-efficiency-percent"
        />
      </TableCell>
      <TableCell>
        <Input 
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notes"
          data-testid="input-resource-notes"
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => saveMutation.mutate(formData)}
            disabled={!formData.name || saveMutation.isPending}
            data-testid="button-save-resource"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            data-testid="button-cancel-resource"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
