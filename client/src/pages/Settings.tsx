import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Save, Palette, Plus, Edit, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BrandingConfig } from "@shared/schema";
import { LogoUpload } from "@/components/LogoUpload";

const brandingConfigSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  logoUrl: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
  customDomain: z.string().optional(),
  isActive: z.boolean().default(false),
});

type BrandingConfigFormData = z.infer<typeof brandingConfigSchema>;

export default function Settings() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<BrandingConfig | null>(null);
  const [deletingConfig, setDeletingConfig] = useState<BrandingConfig | null>(null);
  const { toast } = useToast();

  const { data: brandingConfigs = [], isLoading } = useQuery<BrandingConfig[]>({
    queryKey: ["/api/branding-configs"]
  });

  const createForm = useForm<BrandingConfigFormData>({
    resolver: zodResolver(brandingConfigSchema),
    defaultValues: {
      companyName: "",
      logoUrl: "",
      primaryColor: "#2563eb",
      secondaryColor: "#64748b",
      customDomain: "",
      isActive: false,
    },
  });

  const editForm = useForm<BrandingConfigFormData>({
    resolver: zodResolver(brandingConfigSchema),
    defaultValues: {
      companyName: "",
      logoUrl: "",
      primaryColor: "#2563eb",
      secondaryColor: "#64748b",
      customDomain: "",
      isActive: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BrandingConfigFormData) => {
      return await apiRequest("/api/branding-configs", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding-configs"] });
      toast({
        title: "Success",
        description: "Branding profile created successfully",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create branding profile",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BrandingConfigFormData }) => {
      return await apiRequest(`/api/branding-configs/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding-configs"] });
      toast({
        title: "Success",
        description: "Branding profile updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingConfig(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update branding profile",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/branding-configs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding-configs"] });
      toast({
        title: "Success",
        description: "Branding profile deleted successfully",
      });
      setDeletingConfig(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete branding profile",
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: BrandingConfigFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: BrandingConfigFormData) => {
    if (!editingConfig) return;
    updateMutation.mutate({ id: editingConfig.id, data });
  };

  const handleEdit = (config: BrandingConfig) => {
    setEditingConfig(config);
    editForm.reset({
      companyName: config.companyName,
      logoUrl: config.logoUrl || "",
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      customDomain: config.customDomain || "",
      isActive: config.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (config: BrandingConfig) => {
    setDeletingConfig(config);
  };

  const confirmDelete = () => {
    if (deletingConfig) {
      deleteMutation.mutate(deletingConfig.id);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your branding profiles for proposals
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding Profiles
          </CardTitle>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-create-branding"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Profile
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : brandingConfigs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No branding profiles yet. Create one to reuse across proposals.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {brandingConfigs.map((config) => (
                <div
                  key={config.id}
                  className="border rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-10 h-10 rounded"
                        style={{ backgroundColor: config.primaryColor }}
                      />
                      <div
                        className="w-10 h-10 rounded"
                        style={{ backgroundColor: config.secondaryColor }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{config.companyName}</h3>
                        {config.isActive && (
                          <Badge variant="default">
                            <Star className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {config.logoUrl && (
                          <span className="mr-4">Logo: {config.logoUrl.substring(0, 50)}...</span>
                        )}
                        <span className="mr-2">{config.primaryColor}</span>
                        <span>{config.secondaryColor}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(config)}
                      data-testid={`button-edit-branding-${config.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(config)}
                      data-testid={`button-delete-branding-${config.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Branding Profile</DialogTitle>
            <DialogDescription>
              Create a reusable branding profile for your proposals
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-create-company-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <LogoUpload
                        currentLogoUrl={field.value}
                        onLogoChange={field.onChange}
                        disabled={createMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" {...field} className="w-20" data-testid="input-create-primary-color" />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" {...field} className="w-20" data-testid="input-create-secondary-color" />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit-create-branding"
                >
                  {createMutation.isPending ? "Creating..." : "Create Profile"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branding Profile</DialogTitle>
            <DialogDescription>
              Update your branding profile settings
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-company-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <LogoUpload
                        currentLogoUrl={field.value}
                        onLogoChange={field.onChange}
                        disabled={updateMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" {...field} className="w-20" data-testid="input-edit-primary-color" />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" {...field} className="w-20" data-testid="input-edit-secondary-color" />
                          <Input {...field} className="flex-1" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-submit-edit-branding"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingConfig} onOpenChange={() => setDeletingConfig(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branding Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the branding profile for "{deletingConfig?.companyName}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-branding">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete-branding"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
