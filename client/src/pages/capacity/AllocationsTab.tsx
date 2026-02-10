import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Check, X, ChevronDown } from "lucide-react";
import type { ForecastCapacityResource, ForecastCapacityAllocation, Agency } from "@shared/schema";
import { format } from "date-fns";

export function AllocationsTab() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { toast } = useToast();

  const { data: allocations = [] } = useQuery<ForecastCapacityAllocation[]>({
    queryKey: ["/api/forecast/capacity/allocations"],
  });

  const { data: agencies = [] } = useQuery<Agency[]>({
    queryKey: ["/api/agencies"],
  });

  const { data: resources = [] } = useQuery<ForecastCapacityResource[]>({
    queryKey: ["/api/forecast/capacity/resources"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/forecast/capacity/allocations/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/capacity/allocations"] });
      toast({ title: "Allocation deleted" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Client Allocations</CardTitle>
            <CardDescription>Track monthly hour commitments by client and resources</CardDescription>
          </div>
          <Button onClick={() => setIsAddingNew(!isAddingNew)} data-testid="button-add-allocation">
            <Plus className="h-4 w-4 mr-2" />
            {isAddingNew ? "Cancel" : "Add Allocation"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client/Prospect</TableHead>
              <TableHead>Resources</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Billable Hours/Month</TableHead>
              <TableHead>Start Month</TableHead>
              <TableHead>End Month</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isAddingNew && (
              <AllocationRow
                agencies={agencies}
                resources={resources}
                onSuccess={() => setIsAddingNew(false)}
                onCancel={() => setIsAddingNew(false)}
              />
            )}
            {allocations.map((allocation) => {
              const agency = agencies.find(a => a.id === allocation.agencyId);
              const allocationResources = allocation.resourceIds
                .map(id => resources.find(r => r.id === id))
                .filter(Boolean);
              const resourceNames = allocationResources.length > 0 
                ? allocationResources.map(r => r!.name).join(", ")
                : "Unassigned";
              
              return editingId === allocation.id ? (
                <AllocationRow
                  key={allocation.id}
                  allocation={allocation}
                  agencies={agencies}
                  resources={resources}
                  onSuccess={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TableRow key={allocation.id}>
                  <TableCell className="font-medium">{allocation.prospectName || agency?.name || "-"}</TableCell>
                  <TableCell>{resourceNames}</TableCell>
                  <TableCell className="capitalize">{allocation.engagementType}</TableCell>
                  <TableCell>{allocation.monthlyBillableHours}</TableCell>
                  <TableCell>{allocation.startMonth ? format(new Date(allocation.startMonth), "MMM yyyy") : "-"}</TableCell>
                  <TableCell>{allocation.endMonth ? format(new Date(allocation.endMonth), "MMM yyyy") : "Ongoing"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(allocation.id)}
                        data-testid={`button-edit-allocation-${allocation.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(allocation.id)}
                        data-testid={`button-delete-allocation-${allocation.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {allocations.length === 0 && !isAddingNew && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No allocations configured yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AllocationRow({ 
  allocation, 
  agencies,
  resources,
  onSuccess, 
  onCancel 
}: { 
  allocation?: ForecastCapacityAllocation;
  agencies: Agency[];
  resources: ForecastCapacityResource[];
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    agencyId: allocation?.agencyId || null,
    prospectName: allocation?.prospectName || "",
    resourceIds: allocation?.resourceIds || [],
    engagementType: allocation?.engagementType || "project",
    monthlyBillableHours: allocation?.monthlyBillableHours || "160",
    description: allocation?.description || "",
    startMonth: allocation?.startMonth || format(new Date(), "yyyy-MM-01"),
    endMonth: allocation?.endMonth || "",
  });
  const { toast } = useToast();

  const toggleResource = (resourceId: string) => {
    setFormData(prev => ({
      ...prev,
      resourceIds: prev.resourceIds.includes(resourceId)
        ? prev.resourceIds.filter(id => id !== resourceId)
        : [...prev.resourceIds, resourceId]
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        agencyId: data.agencyId || undefined,
        prospectName: data.prospectName || undefined,
        endMonth: data.endMonth || undefined,
        isActive: true,
      };
      
      if (allocation) {
        return await apiRequest(`/api/forecast/capacity/allocations/${allocation.id}`, "PATCH", payload);
      } else {
        return await apiRequest("/api/forecast/capacity/allocations", "POST", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forecast/capacity/allocations"] });
      toast({ title: allocation ? "Allocation updated" : "Allocation created" });
      onSuccess();
    },
  });

  const isProspect = !formData.agencyId;

  return (
    <TableRow>
      <TableCell>
        {isProspect ? (
          <Input 
            value={formData.prospectName}
            onChange={(e) => setFormData({ ...formData, prospectName: e.target.value, agencyId: null })}
            placeholder="Prospect name"
            data-testid="input-prospect-name"
          />
        ) : (
          <Select value={formData.agencyId || ""} onValueChange={(value) => setFormData({ ...formData, agencyId: value, prospectName: "" })}>
            <SelectTrigger data-testid="select-agency">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prospect">New Prospect</SelectItem>
              {agencies.filter(a => a.isActive).map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>{agency.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between" data-testid="button-select-resources">
              {formData.resourceIds.length > 0 
                ? `${formData.resourceIds.length} selected` 
                : "Select resources"}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              {resources.map((resource) => (
                <div key={resource.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`resource-${resource.id}`}
                    checked={formData.resourceIds.includes(resource.id)}
                    onCheckedChange={() => toggleResource(resource.id)}
                    data-testid={`checkbox-resource-${resource.id}`}
                  />
                  <label htmlFor={`resource-${resource.id}`} className="text-sm cursor-pointer">
                    {resource.name}
                  </label>
                </div>
              ))}
              {resources.length === 0 && (
                <div className="text-sm text-muted-foreground">No resources available</div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>
      <TableCell>
        <Select value={formData.engagementType} onValueChange={(value) => setFormData({ ...formData, engagementType: value })}>
          <SelectTrigger data-testid="select-engagement-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="project">Project</SelectItem>
            <SelectItem value="retainer">Retainer</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input 
          type="number"
          value={formData.monthlyBillableHours}
          onChange={(e) => setFormData({ ...formData, monthlyBillableHours: e.target.value })}
          placeholder="160"
          data-testid="input-billable-hours-allocation"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="month"
          value={formData.startMonth.substring(0, 7)}
          onChange={(e) => setFormData({ ...formData, startMonth: e.target.value + "-01" })}
          data-testid="input-start-month"
        />
      </TableCell>
      <TableCell>
        <Input 
          type="month"
          value={formData.endMonth.substring(0, 7)}
          onChange={(e) => setFormData({ ...formData, endMonth: e.target.value ? e.target.value + "-01" : "" })}
          placeholder="Ongoing"
          data-testid="input-end-month"
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => saveMutation.mutate(formData)}
            disabled={(!formData.agencyId && !formData.prospectName) || saveMutation.isPending}
            data-testid="button-save-allocation"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            data-testid="button-cancel-allocation"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
