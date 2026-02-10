import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GuidanceSetting, InsertGuidanceSetting } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings2, Trash2, Edit2, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  { value: "scoping", label: "Scoping" },
  { value: "estimation", label: "Estimation" },
  { value: "assumptions", label: "Assumptions" },
  { value: "general", label: "General" },
] as const;

export default function GuidanceSettings() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editSetting, setEditSetting] = useState<GuidanceSetting | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: settings, isLoading } = useQuery<GuidanceSetting[]>({
    queryKey: ["/api/guidance-settings"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGuidanceSetting) => {
      return await apiRequest("/api/guidance-settings", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guidance-settings"] });
      setIsCreateOpen(false);
      toast({
        title: "Success",
        description: "Guidance setting created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create setting",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertGuidanceSetting> }) => {
      return await apiRequest(`/api/guidance-settings/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guidance-settings"] });
      setEditSetting(null);
      toast({
        title: "Success",
        description: "Setting updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update setting",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/guidance-settings/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guidance-settings"] });
      toast({
        title: "Success",
        description: "Setting deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete setting",
        variant: "destructive",
      });
    },
  });

  const filteredSettings = settings?.filter(
    (setting) => selectedCategory === "all" || setting.category === selectedCategory
  ).sort((a, b) => a.order - b.order);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Guidance Settings</h1>
          <p className="text-muted-foreground">Configure AI generation rules and guidelines</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-setting">
              <Plus className="mr-2 h-4 w-4" />
              Add Setting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Guidance Setting</DialogTitle>
              <DialogDescription>
                Create a new guidance rule for AI scope generation
              </DialogDescription>
            </DialogHeader>
            <CreateSettingForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          onClick={() => setSelectedCategory("all")}
          data-testid="button-filter-all"
        >
          All
        </Button>
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={selectedCategory === cat.value ? "default" : "outline"}
            onClick={() => setSelectedCategory(cat.value)}
            data-testid={`button-filter-${cat.value}`}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">Loading settings...</div>
      ) : !filteredSettings || filteredSettings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">No settings yet</h3>
            <p className="text-muted-foreground mb-4">
              Add guidance settings to customize AI scope generation
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-first">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Setting
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredSettings.map((setting) => (
            <Card key={setting.id} className="hover-elevate" data-testid={`card-setting-${setting.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-3 flex-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{setting.name}</CardTitle>
                        <Badge variant="secondary" data-testid={`badge-category-${setting.id}`}>
                          {CATEGORIES.find(c => c.value === setting.category)?.label || setting.category}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-order-${setting.id}`}>
                          Order: {setting.order}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2 whitespace-pre-wrap">
                        {setting.content}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditSetting(setting)}
                      data-testid={`button-edit-${setting.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this setting?")) {
                          deleteMutation.mutate(setting.id);
                        }
                      }}
                      data-testid={`button-delete-${setting.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {editSetting && (
        <Dialog open={!!editSetting} onOpenChange={() => setEditSetting(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Guidance Setting</DialogTitle>
              <DialogDescription>Update guidance rule</DialogDescription>
            </DialogHeader>
            <EditSettingForm
              setting={editSetting}
              onSubmit={(data) => updateMutation.mutate({ id: editSetting.id, data })}
              isPending={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateSettingForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: InsertGuidanceSetting) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    content: "",
    category: "general" as const,
    order: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder="e.g., Hour Estimation Rules"
          data-testid="input-name"
        />
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value as typeof formData.category })}
        >
          <SelectTrigger data-testid="select-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="order">Order</Label>
        <Input
          id="order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
          data-testid="input-order"
        />
        <p className="text-sm text-muted-foreground mt-1">
          Lower numbers appear first in AI prompts
        </p>
      </div>

      <div>
        <Label htmlFor="content">Content *</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          required
          placeholder="Enter guidance rules that the AI should follow..."
          data-testid="textarea-content"
        />
      </div>

      <Button type="submit" disabled={isPending} data-testid="button-submit">
        {isPending ? "Creating..." : "Create Setting"}
      </Button>
    </form>
  );
}

function EditSettingForm({
  setting,
  onSubmit,
  isPending,
}: {
  setting: GuidanceSetting;
  onSubmit: (data: Partial<InsertGuidanceSetting>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState<{
    name: string;
    content: string;
    category: "scoping" | "estimation" | "assumptions" | "general";
    order: number;
  }>({
    name: setting.name,
    content: setting.content,
    category: setting.category as "scoping" | "estimation" | "assumptions" | "general",
    order: setting.order,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-name">Name *</Label>
        <Input
          id="edit-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          data-testid="input-edit-name"
        />
      </div>

      <div>
        <Label htmlFor="edit-category">Category *</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value as typeof formData.category })}
        >
          <SelectTrigger data-testid="select-edit-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="edit-order">Order</Label>
        <Input
          id="edit-order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
          data-testid="input-edit-order"
        />
      </div>

      <div>
        <Label htmlFor="edit-content">Content *</Label>
        <Textarea
          id="edit-content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={6}
          required
          data-testid="textarea-edit-content"
        />
      </div>

      <Button type="submit" disabled={isPending} data-testid="button-submit-edit">
        {isPending ? "Updating..." : "Update Setting"}
      </Button>
    </form>
  );
}
