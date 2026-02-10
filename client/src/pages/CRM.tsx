import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Plus,
  Phone,
  Mail,
  Linkedin,
  Calendar,
  Edit,
  Trash2,
  Building2,
  User as UserIcon,
  MessageSquare,
  Clock,
  ArrowRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import type { LeadWithStage, PipelineStage, LeadActivityWithUser, User } from "@shared/schema";

const leadFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  linkedInUrl: z.string().optional(),
  source: z.string().optional(),
  value: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  nextStep: z.string().optional(),
  stageId: z.string().min(1, "Stage is required"),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

const activityFormSchema = z.object({
  type: z.enum(["call", "email", "meeting", "note", "task"]),
  description: z.string().min(1, "Description is required"),
  occurredAt: z.string().optional(),
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

const priorityColors = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const activityTypeIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: MessageSquare,
  task: Clock,
};

export default function CRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithStage | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);

  const { toast } = useToast();

  const { data: leads = [], isLoading: leadsLoading } = useQuery<LeadWithStage[]>({
    queryKey: ["/api/crm/leads"],
  });

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: activities = [] } = useQuery<LeadActivityWithUser[]>({
    queryKey: ["/api/crm/leads", selectedLead?.id, "activities"],
    queryFn: async () => {
      if (!selectedLead) return [];
      const response = await fetch(`/api/crm/leads/${selectedLead.id}/activities`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch activities");
      return response.json();
    },
    enabled: !!selectedLead,
  });

  const leadStages = useMemo(() => {
    return stages.filter(s => s.type === "lead" && s.isActive).sort((a, b) => a.order - b.order);
  }, [stages]);

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(query) ||
        lead.company.toLowerCase().includes(query) ||
        lead.contactName?.toLowerCase().includes(query) ||
        lead.contactEmail?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadWithStage[]>();
    leadStages.forEach((stage) => {
      map.set(
        stage.id,
        filteredLeads.filter((lead) => lead.stageId === stage.id).sort((a, b) => (a.position || 0) - (b.position || 0))
      );
    });
    return map;
  }, [filteredLeads, leadStages]);

  const createForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      company: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      linkedInUrl: "",
      source: "",
      value: "",
      priority: "medium",
      nextStep: "",
      stageId: leadStages[0]?.id || "",
      notes: "",
    },
  });

  const editForm = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      company: "",
      priority: "medium",
      stageId: "",
    },
  });

  const activityForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      type: "note",
      description: "",
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: LeadFormValues) => {
      return apiRequest("/api/leads", "POST", {
        ...data,
        value: data.value ? data.value : null,
        contactEmail: data.contactEmail || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Lead created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<LeadFormValues> }) => {
      return apiRequest(`/api/leads/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      toast({ title: "Lead updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setIsEditDialogOpen(false);
      setIsDetailSheetOpen(false);
      setSelectedLead(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/leads/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({ title: "Lead deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setIsDetailSheetOpen(false);
      setSelectedLead(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormValues) => {
      if (!selectedLead) return;
      return apiRequest(`/api/crm/leads/${selectedLead.id}/activities`, "POST", data);
    },
    onSuccess: () => {
      toast({ title: "Activity logged" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads", selectedLead?.id, "activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setIsActivityDialogOpen(false);
      activityForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (lead: LeadWithStage) => {
    editForm.reset({
      name: lead.name,
      company: lead.company,
      contactName: lead.contactName || "",
      contactEmail: lead.contactEmail || "",
      contactPhone: lead.contactPhone || "",
      linkedInUrl: lead.linkedInUrl || "",
      source: lead.source || "",
      value: lead.value || "",
      priority: (lead.priority as "low" | "medium" | "high") || "medium",
      nextStep: lead.nextStep || "",
      stageId: lead.stageId,
      notes: lead.notes || "",
    });
    setSelectedLead(lead);
    setIsEditDialogOpen(true);
  };

  const openDetailSheet = (lead: LeadWithStage) => {
    setSelectedLead(lead);
    setIsDetailSheetOpen(true);
  };

  const handleCreateSubmit = (data: LeadFormValues) => {
    createLeadMutation.mutate(data);
  };

  const handleEditSubmit = (data: LeadFormValues) => {
    if (selectedLead) {
      updateLeadMutation.mutate({ id: selectedLead.id, data });
    }
  };

  const handleActivitySubmit = (data: ActivityFormValues) => {
    createActivityMutation.mutate(data);
  };

  const handleStageChange = (leadId: string, newStageId: string) => {
    updateLeadMutation.mutate({ id: leadId, data: { stageId: newStageId } });
  };

  if (leadsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CRM</h1>
          <p className="text-muted-foreground">
            Track and manage your prospects
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Lead
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, company, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "kanban")}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="kanban">Board</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {viewMode === "table" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead>Next Step</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No leads found matching your search." : "No leads yet. Create your first lead to get started."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => openDetailSheet(lead)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{lead.name}</span>
                        {lead.contactName && (
                          <span className="text-sm text-muted-foreground">{lead.contactName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lead.company}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{ borderColor: lead.stage.color || undefined }}
                      >
                        {lead.stage.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[lead.priority as keyof typeof priorityColors] || priorityColors.medium}>
                        {lead.priority || "medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lead.lastContactedAt ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.lastContactedAt), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{lead.nextStep || "-"}</span>
                    </TableCell>
                    <TableCell>
                      {lead.value ? (
                        <span className="font-medium">${Number(lead.value).toLocaleString()}</span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(lead)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteLeadMutation.mutate(lead.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {leadStages.map((stage) => (
            <Card key={stage.id} className="min-w-[300px] flex-shrink-0">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color || "#94a3b8" }}
                    />
                    {stage.name}
                  </CardTitle>
                  <Badge variant="secondary">{leadsByStage.get(stage.id)?.length || 0}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">{stage.id}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {leadsByStage.get(stage.id)?.map((lead) => (
                  <Card
                    key={lead.id}
                    className="p-3 cursor-pointer hover-elevate"
                    onClick={() => openDetailSheet(lead)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.company}</p>
                        </div>
                        <Badge className={`${priorityColors[lead.priority as keyof typeof priorityColors] || priorityColors.medium} text-xs`}>
                          {lead.priority || "medium"}
                        </Badge>
                      </div>
                      {lead.contactName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          {lead.contactName}
                        </div>
                      )}
                      {lead.value && (
                        <p className="text-sm font-medium">${Number(lead.value).toLocaleString()}</p>
                      )}
                      {lead.lastContactedAt && (
                        <p className="text-xs text-muted-foreground">
                          Last contact: {formatDistanceToNow(new Date(lead.lastContactedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </Card>
                )) || (
                  <p className="text-sm text-muted-foreground text-center py-4">No leads</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Lead Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Lead</DialogTitle>
            <DialogDescription>Add a new prospect to your pipeline</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Website Redesign" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 555 123 4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="linkedInUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn</FormLabel>
                      <FormControl>
                        <Input placeholder="linkedin.com/in/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={createForm.control}
                  name="stageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex flex-col">
                                <span>{stage.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">{stage.id}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value ($)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="10000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Referral, Cold outreach, Conference" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="nextStep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Step</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Schedule discovery call" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes about this lead..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLeadMutation.isPending}>
                  {createLeadMutation.isPending ? "Creating..." : "Create Lead"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>Update lead information</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="linkedInUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={editForm.control}
                  name="stageId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stage</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadStages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id}>
                              <div className="flex flex-col">
                                <span>{stage.name}</span>
                                <span className="text-xs text-muted-foreground font-mono">{stage.id}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value ($)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="nextStep"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Step</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateLeadMutation.isPending}>
                  {updateLeadMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selectedLead.name}
                  <Badge className={priorityColors[selectedLead.priority as keyof typeof priorityColors] || priorityColors.medium}>
                    {selectedLead.priority || "medium"}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {selectedLead.company}
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-180px)] mt-6 pr-4">
                <div className="space-y-6">
                  {/* Stage */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Stage</label>
                    <Select
                      value={selectedLead.stageId}
                      onValueChange={(value) => handleStageChange(selectedLead.id, value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {leadStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: stage.color || "#94a3b8" }}
                                />
                                {stage.name}
                              </div>
                              <span className="text-xs text-muted-foreground font-mono">{stage.id}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Contact Information</h4>
                    {selectedLead.contactName && (
                      <div className="flex items-center gap-2 text-sm">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                        {selectedLead.contactName}
                      </div>
                    )}
                    {selectedLead.contactEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedLead.contactEmail}`} className="text-primary hover:underline">
                          {selectedLead.contactEmail}
                        </a>
                      </div>
                    )}
                    {selectedLead.contactPhone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedLead.contactPhone}`} className="text-primary hover:underline">
                          {selectedLead.contactPhone}
                        </a>
                      </div>
                    )}
                    {selectedLead.linkedInUrl && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a href={selectedLead.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLead.value && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Value</label>
                        <p className="font-medium">${Number(selectedLead.value).toLocaleString()}</p>
                      </div>
                    )}
                    {selectedLead.source && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Source</label>
                        <p>{selectedLead.source}</p>
                      </div>
                    )}
                    {selectedLead.lastContactedAt && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Last Contact</label>
                        <p>{format(new Date(selectedLead.lastContactedAt), "MMM d, yyyy")}</p>
                      </div>
                    )}
                  </div>

                  {selectedLead.nextStep && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Next Step</label>
                      <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded-md">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.nextStep}</span>
                      </div>
                    </div>
                  )}

                  {selectedLead.notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Notes</label>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{selectedLead.notes}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Activities */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium">Activity Log</h4>
                      <Button size="sm" variant="outline" onClick={() => setIsActivityDialogOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Log Activity
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {activities.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No activities yet</p>
                      ) : (
                        activities.map((activity) => {
                          const Icon = activityTypeIcons[activity.type as keyof typeof activityTypeIcons] || MessageSquare;
                          return (
                            <div key={activity.id} className="flex gap-3 p-2 rounded-md bg-muted/50">
                              <div className="mt-0.5">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {activity.type}
                                  </Badge>
                                  <span>{format(new Date(activity.occurredAt), "MMM d, yyyy 'at' h:mm a")}</span>
                                </div>
                                <p className="text-sm mt-1">{activity.description}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => openEditDialog(selectedLead)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this lead?")) {
                      deleteLeadMutation.mutate(selectedLead.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Log Activity Dialog */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>Record an interaction with this lead</DialogDescription>
          </DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(handleActivitySubmit)} className="space-y-4">
              <FormField
                control={activityForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="call">Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="task">Task</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={activityForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What happened?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsActivityDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createActivityMutation.isPending}>
                  {createActivityMutation.isPending ? "Saving..." : "Log Activity"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
