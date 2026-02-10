import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, MoreHorizontal, Slack, AlertCircle, CheckCircle2, Building2, Users, Trash2, Edit, TestTube2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SlackConfiguration, Agency, Account } from "@shared/schema";

// Form schema for creating Slack configurations
const createFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  webhookUrl: z.string().url("Must be a valid URL").regex(
    /^https:\/\/hooks\.slack\.com\/services\/.+$/,
    "Must be a valid Slack webhook URL (https://hooks.slack.com/services/...)"
  ),
  channelName: z.string().min(1, "Channel name is required").regex(
    /^#[a-z0-9_-]+$/,
    "Channel name must start with # and contain only lowercase letters, numbers, underscores, and hyphens"
  ),
  agencyId: z.string().optional(),
  accountId: z.string().optional(),
  eventTypes: z.array(z.string()).min(1, "At least one event type must be selected"),
  isActive: z.boolean().default(true),
});

// Form schema for updating Slack configurations (webhook optional)
const updateFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  webhookUrl: z.string().url("Must be a valid URL").regex(
    /^https:\/\/hooks\.slack\.com\/services\/.+$/,
    "Must be a valid Slack webhook URL (https://hooks.slack.com/services/...)"
  ).optional().or(z.literal("")),
  channelName: z.string().min(1, "Channel name is required").regex(
    /^#[a-z0-9_-]+$/,
    "Channel name must start with # and contain only lowercase letters, numbers, underscores, and hyphens"
  ),
  agencyId: z.string().optional(),
  accountId: z.string().optional(),
  eventTypes: z.array(z.string()).min(1, "At least one event type must be selected"),
  isActive: z.boolean().default(true),
});

type CreateFormData = z.infer<typeof createFormSchema>;
type UpdateFormData = z.infer<typeof updateFormSchema>;

const eventTypeOptions = [
  { value: "time_log_created", label: "Time Log Created" },
  { value: "time_log_updated", label: "Time Log Updated" },
  { value: "task_created", label: "Task Created" },
  { value: "task_updated", label: "Task Updated" },
  { value: "task_completed", label: "Task Completed" },
  { value: "project_created", label: "Project Created" },
  { value: "project_updated", label: "Project Updated" },
];

export default function SlackConfiguration() {
  const [searchQuery, setSearchQuery] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SlackConfiguration | null>(null);
  const { toast } = useToast();

  const form = useForm<CreateFormData | UpdateFormData>({
    resolver: zodResolver(editingConfig ? updateFormSchema : createFormSchema),
    defaultValues: {
      name: "",
      webhookUrl: "",
      channelName: "#general",
      eventTypes: [],
      isActive: true,
    },
  });

  // Fetch Slack configurations
  const { data: slackConfigs = [], isLoading: configsLoading, refetch } = useQuery<SlackConfiguration[]>({
    queryKey: ["/api/slack-configurations"]
  });

  // Fetch agencies for filter dropdown
  const { data: agencies = [] } = useQuery<Agency[]>({
    queryKey: ["/api/clients"]
  });

  // Fetch accounts for form dropdown
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"]
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateFormData) => apiRequest("/api/slack-configurations", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack-configurations"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Slack configuration created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Slack configuration",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UpdateFormData> }) => {
      // Filter out empty webhook URL to avoid overwriting existing secret
      const filteredData = { ...data };
      if (filteredData.webhookUrl === "") {
        delete filteredData.webhookUrl;
      }
      return apiRequest(`/api/slack-configurations/${id}`, "PUT", filteredData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack-configurations"] });
      setIsDialogOpen(false);
      setEditingConfig(null);
      form.reset();
      toast({
        title: "Success",
        description: "Slack configuration updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update Slack configuration",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/slack-configurations/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slack-configurations"] });
      toast({
        title: "Success",
        description: "Slack configuration deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete Slack configuration",
        variant: "destructive",
      });
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/slack-configurations/${id}/test`, "POST"),
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || "Test message sent to Slack successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test message to Slack",
        variant: "destructive",
      });
    },
  });

  // Process configurations with related data
  const configsWithRelations = useMemo(() => {
    return slackConfigs.map(config => {
      const agency = agencies.find(a => a.id === config.agencyId);
      const account = accounts.find(a => a.id === config.accountId);
      
      return {
        ...config,
        agency,
        account,
        scope: config.accountId ? "Account" : config.agencyId ? "Agency" : "Global",
      };
    });
  }, [slackConfigs, agencies, accounts]);

  // Filter configurations
  const filteredConfigs = configsWithRelations.filter(config => {
    const matchesSearch = 
      config.channelName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.agency?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.account?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAgency = agencyFilter === "all" || config.agencyId === agencyFilter;
    
    return matchesSearch && matchesAgency;
  });

  // Handle form submission
  const onSubmit = (data: CreateFormData | UpdateFormData) => {
    if (editingConfig) {
      updateMutation.mutate({ id: editingConfig.id, data: data as UpdateFormData });
    } else {
      createMutation.mutate(data as CreateFormData);
    }
  };

  // Handle edit
  const handleEdit = (config: SlackConfiguration) => {
    setEditingConfig(config);
    form.reset({
      name: config.name,
      webhookUrl: "", // Don't prefill webhook URL for security
      channelName: config.channelName,
      agencyId: config.agencyId || undefined,
      accountId: config.accountId || undefined,
      eventTypes: config.eventTypes,
      isActive: config.isActive,
    });
    setIsDialogOpen(true);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingConfig(null);
    form.reset();
    // Reset resolver when dialog closes to avoid stale references
    setTimeout(() => {
      form.reset({
        name: "",
        webhookUrl: "",
        channelName: "#general",
        eventTypes: [],
        isActive: true,
      });
    }, 0);
  };

  // Handle agency change in form
  const onAgencyChange = (agencyId: string, field: any) => {
    const value = agencyId === "none" ? undefined : agencyId;
    form.setValue("agencyId", value);
    form.setValue("accountId", undefined); // Reset account when agency changes
    field.onChange(value); // Maintain proper form state
  };

  // Get accounts for selected agency
  const availableAccounts = useMemo(() => {
    const selectedAgencyId = form.watch("agencyId");
    if (!selectedAgencyId) return accounts;
    return accounts.filter(account => account.agencyId === selectedAgencyId);
  }, [accounts, form.watch("agencyId")]);

  if (configsLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Slack Configuration</h1>
            <p className="text-muted-foreground">Loading configurations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Slack Configuration</h1>
          <p className="text-muted-foreground">
            Configure Slack notifications for different agencies and accounts
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-slack-config">
              <Plus className="h-4 w-4 mr-2" />
              Add Configuration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingConfig ? "Edit Slack Configuration" : "Add Slack Configuration"}
              </DialogTitle>
              <DialogDescription>
                Configure Slack webhook and notification settings for your organization.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form} key={editingConfig ? `edit-${editingConfig.id}` : 'create'}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Marketing Notifications"
                          data-testid="input-config-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Webhook URL
                        {editingConfig && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Leave blank to keep existing)
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            editingConfig 
                              ? "Leave blank to keep current webhook URL"
                              : "https://hooks.slack.com/services/..."
                          }
                          data-testid="input-webhook-url"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      {editingConfig && (
                        <p className="text-xs text-muted-foreground">
                          For security, webhook URLs are not displayed during edit. Leave this field blank to keep the existing webhook URL, or enter a new one to replace it.
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="channelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="#general"
                          data-testid="input-channel-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="agencyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agency (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => onAgencyChange(value, field)}
                        value={field.value || "none"}
                        data-testid="select-agency"
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select agency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Global (All Agencies)</SelectItem>
                          {agencies.map((agency) => (
                            <SelectItem key={agency.id} value={agency.id}>
                              {agency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                        value={field.value || "none"}
                        data-testid="select-account"
                        disabled={!form.watch("agencyId")}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">All Accounts</SelectItem>
                          {availableAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="eventTypes"
                  render={() => (
                    <FormItem>
                      <FormLabel>Event Types</FormLabel>
                      <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                        {eventTypeOptions.map((option) => (
                          <FormField
                            key={option.value}
                            control={form.control}
                            name="eventTypes"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(option.value)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      if (checked) {
                                        field.onChange([...current, option.value]);
                                      } else {
                                        field.onChange(current.filter((val) => val !== option.value));
                                      }
                                    }}
                                    data-testid={`checkbox-event-${option.value}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {option.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-is-active"
                        />
                      </FormControl>
                      <FormLabel>Active</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit-config"
                  >
                    {editingConfig ? "Update" : "Create"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDialogClose}
                    data-testid="button-cancel-config"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search configurations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-configs"
          />
        </div>

        <Select value={agencyFilter} onValueChange={setAgencyFilter} data-testid="select-agency-filter">
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by agency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agencies</SelectItem>
            {agencies.map((agency) => (
              <SelectItem key={agency.id} value={agency.id}>
                {agency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Channel</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Event Types</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Webhook</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No Slack configurations found
                </TableCell>
              </TableRow>
            ) : (
              filteredConfigs.map((config) => (
                <TableRow key={config.id} data-testid={`row-config-${config.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Slack className="h-4 w-4 text-purple-600" />
                      <span className="font-medium">{config.channelName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {config.scope === "Account" && <Users className="h-3 w-3" />}
                      {config.scope === "Agency" && <Building2 className="h-3 w-3" />}
                      {config.scope === "Global" && <AlertCircle className="h-3 w-3" />}
                      {config.scope}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {config.account ? (
                        <div>
                          <div className="font-medium">{config.account.name}</div>
                          <div className="text-muted-foreground">{config.agency?.name}</div>
                        </div>
                      ) : config.agency ? (
                        <div className="font-medium">{config.agency.name}</div>
                      ) : (
                        <span className="text-muted-foreground">All</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {config.eventTypes.slice(0, 2).map((eventType) => (
                        <Badge key={eventType} variant="secondary" className="text-xs">
                          {eventTypeOptions.find(opt => opt.value === eventType)?.label || eventType}
                        </Badge>
                      ))}
                      {config.eventTypes.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{config.eventTypes.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={config.isActive ? "default" : "secondary"}
                      className="flex items-center gap-1 w-fit"
                    >
                      {config.isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          Inactive
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {config.webhookUrl.replace(/^(https:\/\/hooks\.slack\.com\/services\/)(.*)(.{6})$/, '$1****$3')}
                    </code>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-actions-${config.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => testMutation.mutate(config.id)}
                          data-testid={`button-test-${config.id}`}
                          disabled={testMutation.isPending}
                        >
                          <TestTube2 className="h-4 w-4 mr-2" />
                          {testMutation.isPending ? "Testing..." : "Test Webhook"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEdit(config)}
                          data-testid={`button-edit-${config.id}`}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(config.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${config.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {filteredConfigs.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {filteredConfigs.length} of {slackConfigs.length} configurations
        </div>
      )}
    </div>
  );
}