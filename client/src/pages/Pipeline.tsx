import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, DollarSign, Calendar, TrendingUp, Sparkles, Linkedin, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { insertLeadSchema, insertDealSchema, insertPipelineStageSchema } from "@shared/schema";
import type { Lead, Deal, PipelineStage } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function Pipeline() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("leads");
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [contactNameManuallyEdited, setContactNameManuallyEdited] = useState(false);

  // Queries
  const { data: leads = [], isLoading: leadsLoading, isError: leadsError } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: deals = [], isLoading: dealsLoading, isError: dealsError } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: stages = [], isLoading: stagesLoading, isError: stagesError } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  // Forms
  const leadForm = useForm<z.infer<typeof insertLeadSchema>>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      name: "",
      company: "",
      contactName: "",
      contactTitle: "",
      contactEmail: "",
      contactPhone: "",
      linkedInUrl: "",
      stageId: "",
      assignedToUserId: undefined,
      notes: "",
      isActive: true,
    },
  });

  // Auto-populate contactName from lead name when creating new lead (only if not manually edited)
  const watchedName = leadForm.watch("name");
  useEffect(() => {
    if (!editingLead && watchedName && !contactNameManuallyEdited) {
      leadForm.setValue("contactName", watchedName);
    }
  }, [watchedName, editingLead, contactNameManuallyEdited, leadForm]);

  const dealForm = useForm<z.infer<typeof insertDealSchema>>({
    resolver: zodResolver(insertDealSchema),
    defaultValues: {
      name: "",
      amount: "0",
      closeDate: "",
      probability: 50,
      stageId: "",
      assignedToUserId: undefined,
      leadId: undefined,
      notes: "",
      isActive: true,
    },
  });

  const stageForm = useForm<z.infer<typeof insertPipelineStageSchema>>({
    resolver: zodResolver(insertPipelineStageSchema),
    defaultValues: {
      name: "",
      type: "lead",
      order: 0,
      color: "#3b82f6",
      isActive: true,
    },
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertLeadSchema>) => {
      return await apiRequest("/api/leads", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setLeadDialogOpen(false);
      leadForm.reset();
      setContactNameManuallyEdited(false);
      toast({ title: "Lead created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertLeadSchema>> }) => {
      return await apiRequest(`/api/leads/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setLeadDialogOpen(false);
      setEditingLead(null);
      leadForm.reset();
      setContactNameManuallyEdited(false);
      toast({ title: "Lead updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/leads/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const enrichLeadMutation = useMutation({
    mutationFn: async (linkedInUrl: string): Promise<{ contactName?: string; contactTitle?: string; contactEmail?: string; company?: string; notes?: string }> => {
      const response = await apiRequest("/api/leads/enrich", "POST", { linkedInUrl });
      return response as { contactName?: string; contactTitle?: string; contactEmail?: string; company?: string; notes?: string };
    },
    onSuccess: (data) => {
      // Update form fields with enriched data
      if (data.contactName) leadForm.setValue("contactName", data.contactName);
      if (data.contactTitle) leadForm.setValue("contactTitle", data.contactTitle);
      if (data.contactEmail) leadForm.setValue("contactEmail", data.contactEmail);
      if (data.company && !leadForm.getValues("company")) leadForm.setValue("company", data.company);
      if (data.notes) {
        const existingNotes = leadForm.getValues("notes") || "";
        const separator = existingNotes ? "\n\n---\nAI Enriched:\n" : "";
        leadForm.setValue("notes", existingNotes + separator + data.notes);
      }
      toast({ title: "Lead enriched successfully", description: "Contact information has been updated from LinkedIn." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to enrich lead", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  function handleEnrichLead() {
    const linkedInUrl = leadForm.getValues("linkedInUrl");
    if (linkedInUrl) {
      enrichLeadMutation.mutate(linkedInUrl);
    }
  }

  const createDealMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertDealSchema>) => {
      return await apiRequest("/api/deals", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setDealDialogOpen(false);
      dealForm.reset();
      toast({ title: "Deal created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertDealSchema>> }) => {
      return await apiRequest(`/api/deals/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setDealDialogOpen(false);
      setEditingDeal(null);
      dealForm.reset();
      toast({ title: "Deal updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/deals/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertPipelineStageSchema>) => {
      return await apiRequest("/api/pipeline-stages", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      setStageDialogOpen(false);
      stageForm.reset();
      toast({ title: "Stage created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to create stage", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertPipelineStageSchema>> }) => {
      return await apiRequest(`/api/pipeline-stages/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      setStageDialogOpen(false);
      setEditingStage(null);
      stageForm.reset();
      toast({ title: "Stage updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update stage", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/pipeline-stages/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({ title: "Stage deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete stage", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Handlers
  function handleEditLead(lead: Lead) {
    setEditingLead(lead);
    leadForm.reset({
      name: lead.name,
      company: lead.company,
      contactName: lead.contactName || "",
      contactTitle: lead.contactTitle || "",
      contactEmail: lead.contactEmail || "",
      contactPhone: lead.contactPhone || "",
      linkedInUrl: lead.linkedInUrl || "",
      stageId: lead.stageId,
      assignedToUserId: lead.assignedToUserId || undefined,
      notes: lead.notes || "",
      isActive: lead.isActive,
    });
    setLeadDialogOpen(true);
  }

  function handleEditDeal(deal: Deal) {
    setEditingDeal(deal);
    dealForm.reset({
      name: deal.name,
      amount: deal.amount,
      closeDate: deal.closeDate,
      probability: deal.probability,
      stageId: deal.stageId,
      assignedToUserId: deal.assignedToUserId || undefined,
      leadId: deal.leadId || undefined,
      notes: deal.notes || "",
      isActive: deal.isActive,
    });
    setDealDialogOpen(true);
  }

  function handleEditStage(stage: PipelineStage) {
    setEditingStage(stage);
    stageForm.reset({
      name: stage.name,
      type: stage.type,
      order: stage.order,
      color: stage.color || "#3b82f6",
      isActive: stage.isActive,
    });
    setStageDialogOpen(true);
  }

  function onLeadSubmit(data: z.infer<typeof insertLeadSchema>) {
    if (editingLead) {
      updateLeadMutation.mutate({ id: editingLead.id, data });
    } else {
      createLeadMutation.mutate(data);
    }
  }

  function onDealSubmit(data: z.infer<typeof insertDealSchema>) {
    if (editingDeal) {
      updateDealMutation.mutate({ id: editingDeal.id, data });
    } else {
      createDealMutation.mutate(data);
    }
  }

  function onStageSubmit(data: z.infer<typeof insertPipelineStageSchema>) {
    if (editingStage) {
      updateStageMutation.mutate({ id: editingStage.id, data });
    } else {
      createStageMutation.mutate(data);
    }
  }

  const leadStages = stages.filter((s) => s.type === "lead");
  const dealStages = stages.filter((s) => s.type === "deal");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-muted-foreground">
          Manage leads, deals, and pipeline stages
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="leads" data-testid="tab-leads">Leads</TabsTrigger>
          <TabsTrigger value="deals" data-testid="tab-deals">Deals</TabsTrigger>
          <TabsTrigger value="stages" data-testid="tab-stages">Stage Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Leads</h2>
            <Button onClick={() => { setEditingLead(null); leadForm.reset(); setContactNameManuallyEdited(false); setLeadDialogOpen(true); }} data-testid="button-add-lead">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </div>

          {leadsLoading && <p className="text-muted-foreground">Loading leads...</p>}
          {leadsError && <p className="text-destructive">Failed to load leads. Please try again.</p>}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <Card key={lead.id} data-testid={`card-lead-${lead.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{lead.name}</CardTitle>
                      <CardDescription>{lead.company}</CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEditLead(lead)} data-testid={`button-edit-lead-${lead.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteLeadMutation.mutate(lead.id)} data-testid={`button-delete-lead-${lead.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {lead.contactName && <p><span className="text-muted-foreground">Contact:</span> {lead.contactName}</p>}
                    {lead.contactEmail && <p><span className="text-muted-foreground">Email:</span> {lead.contactEmail}</p>}
                    <p>
                      <span className="text-muted-foreground">Stage:</span>{" "}
                      <Badge>{leadStages.find((s) => s.id === lead.stageId)?.name || "Unknown"}</Badge>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Created {formatDistanceToNow(new Date(lead.createdAt))} ago
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Deals</h2>
            <Button onClick={() => { setEditingDeal(null); dealForm.reset(); setDealDialogOpen(true); }} data-testid="button-add-deal">
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </div>

          {dealsLoading && <p className="text-muted-foreground">Loading deals...</p>}
          {dealsError && <p className="text-destructive">Failed to load deals. Please try again.</p>}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <Card key={deal.id} data-testid={`card-deal-${deal.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{deal.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-2">
                        <DollarSign className="h-4 w-4" />
                        ${parseFloat(deal.amount).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEditDeal(deal)} data-testid={`button-edit-deal-${deal.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteDealMutation.mutate(deal.id)} data-testid={`button-delete-deal-${deal.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Close: {new Date(deal.closeDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>Probability: {deal.probability}%</span>
                    </div>
                    <p>
                      <span className="text-muted-foreground">Stage:</span>{" "}
                      <Badge>{dealStages.find((s) => s.id === deal.stageId)?.name || "Unknown"}</Badge>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Pipeline Stages</h2>
            <Button onClick={() => { setEditingStage(null); stageForm.reset(); setStageDialogOpen(true); }} data-testid="button-add-stage">
              <Plus className="h-4 w-4 mr-2" />
              Add Stage
            </Button>
          </div>

          {stagesLoading && <p className="text-muted-foreground">Loading stages...</p>}
          {stagesError && <p className="text-destructive">Failed to load stages. Please try again.</p>}

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead Stages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {leadStages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between p-2 border rounded" data-testid={`stage-${stage.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: stage.color || "#3b82f6" }} />
                      <span>{stage.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEditStage(stage)} data-testid={`button-edit-stage-${stage.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteStageMutation.mutate(stage.id)} data-testid={`button-delete-stage-${stage.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deal Stages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dealStages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between p-2 border rounded" data-testid={`stage-${stage.id}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: stage.color || "#3b82f6" }} />
                      <span>{stage.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleEditStage(stage)} data-testid={`button-edit-stage-${stage.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteStageMutation.mutate(stage.id)} data-testid={`button-delete-stage-${stage.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Dialog */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLead ? "Edit Lead" : "Create Lead"}</DialogTitle>
            <DialogDescription>
              {editingLead ? "Update the lead information" : "Add a new lead to your pipeline"}
            </DialogDescription>
          </DialogHeader>
          <Form {...leadForm}>
            <form onSubmit={leadForm.handleSubmit(onLeadSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-lead-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-lead-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={leadForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""}
                          onChange={(e) => {
                            field.onChange(e);
                            if (!editingLead) {
                              setContactNameManuallyEdited(true);
                            }
                          }}
                          data-testid="input-lead-contact-name" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="contactTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title / Role</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="e.g. CEO, Director of Marketing" data-testid="input-lead-contact-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="email" data-testid="input-lead-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={leadForm.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-lead-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={leadForm.control}
                name="linkedInUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn Profile URL
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ""}
                          placeholder="https://linkedin.com/in/..." 
                          data-testid="input-lead-linkedin" 
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleEnrichLead()}
                        disabled={!field.value || enrichLeadMutation.isPending}
                        data-testid="button-enrich-lead"
                      >
                        {enrichLeadMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span className="ml-1">Enrich</span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={leadForm.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-lead-stage">
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={leadForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="textarea-lead-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  data-testid="button-submit-lead"
                  disabled={createLeadMutation.isPending || updateLeadMutation.isPending}
                >
                  {editingLead ? "Update Lead" : "Create Lead"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Deal Dialog */}
      <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDeal ? "Edit Deal" : "Create Deal"}</DialogTitle>
            <DialogDescription>
              {editingDeal ? "Update the deal information" : "Add a new deal to your pipeline"}
            </DialogDescription>
          </DialogHeader>
          <Form {...dealForm}>
            <form onSubmit={dealForm.handleSubmit(onDealSubmit)} className="space-y-4">
              <FormField
                control={dealForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deal Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-deal-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={dealForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" data-testid="input-deal-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={dealForm.control}
                  name="closeDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Close Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-deal-close-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={dealForm.control}
                  name="probability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Probability (%)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          min="0" 
                          max="100" 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-deal-probability" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={dealForm.control}
                name="stageId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-deal-stage">
                          <SelectValue placeholder="Select a stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {dealStages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={dealForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="textarea-deal-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  data-testid="button-submit-deal"
                  disabled={createDealMutation.isPending || updateDealMutation.isPending}
                >
                  {editingDeal ? "Update Deal" : "Create Deal"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stage Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Edit Stage" : "Create Stage"}</DialogTitle>
            <DialogDescription>
              {editingStage ? "Update the stage settings" : "Add a new stage to your pipeline"}
            </DialogDescription>
          </DialogHeader>
          <Form {...stageForm}>
            <form onSubmit={stageForm.handleSubmit(onStageSubmit)} className="space-y-4">
              <FormField
                control={stageForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-stage-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={stageForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-stage-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="deal">Deal</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stageForm.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="number" 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-stage-order" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={stageForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} type="color" data-testid="input-stage-color" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="submit" 
                  data-testid="button-submit-stage"
                  disabled={createStageMutation.isPending || updateStageMutation.isPending}
                >
                  {editingStage ? "Update Stage" : "Create Stage"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
