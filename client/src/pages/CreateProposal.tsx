import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Search, Plus, Trash2, Sparkles, RefreshCw, ArrowLeft, ChevronDown } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ProposalWithProject, BrandingConfig } from "@shared/schema";
import { z } from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { convertScopeToHTML } from "@/lib/scopeToHtml";
import { BrandingProfileSelector } from "@/components/BrandingProfileSelector";

// Relaxed schema for drafts - only requires template type
const proposalDraftSchema = z.object({
  title: z.string().optional().default(""),
  slug: z.string().optional().default(""),
  companyName: z.string().optional().default(""),
  htmlContent: z.string().optional().default(""),
  templateType: z.enum(["project", "retainer"]),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  engagementTimeline: z.string().optional(),
  whiteLabelLogoUrl: z.string().optional(),
  prospectLogoUrl: z.string().optional(),
  brandFont: z.string().optional().default("Inter"),
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #2563eb)").optional().default("#2563eb"),
  brandSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #64748b)").optional().default("#64748b"),
  brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #f59e0b)").optional().default("#f59e0b"),
  status: z.enum(["draft", "published"]).default("draft"),
});

// Strict schema for publishing - requires all key fields
const proposalPublishSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  companyName: z.string().min(1, "Company name is required"),
  htmlContent: z.string().optional().default(""),
  templateType: z.enum(["project", "retainer"]),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  engagementTimeline: z.string().optional(),
  whiteLabelLogoUrl: z.string().optional(),
  prospectLogoUrl: z.string().optional(),
  brandFont: z.string().optional().default("Inter"),
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #2563eb)").optional().default("#2563eb"),
  brandSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #64748b)").optional().default("#64748b"),
  brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g., #f59e0b)").optional().default("#f59e0b"),
  status: z.enum(["draft", "published"]).default("draft"),
});

type ProposalFormData = z.infer<typeof proposalPublishSchema>;

interface ScopeItem {
  storyId: string;
  hours: number;
  workstream: string;
  customerStory: string;
  recommendedApproach: string;
  assumptions: string;
  order: number;
}

export default function CreateProposal() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/proposals/edit/:id");
  const isEditMode = Boolean(match);
  const proposalId = params?.id;
  
  const [chatTranscript, setChatTranscript] = useState("");
  const [companyNameForGeneration, setCompanyNameForGeneration] = useState("");
  const [generalInstructions, setGeneralInstructions] = useState("");
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [projectContext, setProjectContext] = useState({ projectName: "", accountName: "" });
  const [selectedBrandingProfileId, setSelectedBrandingProfileId] = useState<string | undefined>();
  
  const { toast } = useToast();

  const { data: proposals = [] } = useQuery<ProposalWithProject[]>({
    queryKey: ["/api/proposals"]
  });

  // Fetch existing proposal when editing
  const { data: existingProposal, isLoading: isLoadingProposal, error: proposalError } = useQuery<ProposalWithProject>({
    queryKey: ["/api/proposals", proposalId],
    enabled: isEditMode && Boolean(proposalId),
  });

  // Fetch scope items when editing
  const { data: existingScopeItems = [] } = useQuery<any[]>({
    queryKey: ["/api/proposals", proposalId, "scope-items"],
    enabled: isEditMode && Boolean(proposalId),
  });

  const proposalForm = useForm<ProposalFormData>({
    resolver: zodResolver(proposalDraftSchema),
    defaultValues: {
      title: "",
      slug: "",
      companyName: "",
      htmlContent: "",
      templateType: "project",
      contactName: "",
      contactEmail: "",
      engagementTimeline: "",
      whiteLabelLogoUrl: "",
      prospectLogoUrl: "",
      brandFont: "Inter",
      brandPrimaryColor: "#2563eb",
      brandSecondaryColor: "#64748b",
      brandAccentColor: "#f59e0b",
      status: "draft",
    },
  });

  // Auto-generate slug from title changes
  useEffect(() => {
    const subscription = proposalForm.watch((value, { name }) => {
      if (name === 'title' && value.title) {
        const slug = value.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        proposalForm.setValue("slug", slug, { shouldValidate: false });
      }
    });
    return () => subscription.unsubscribe();
  }, [proposalForm]);

  // Sync company name from top field to generation field
  useEffect(() => {
    const subscription = proposalForm.watch((value, { name }) => {
      if (name === 'companyName' && value.companyName) {
        setCompanyNameForGeneration(value.companyName);
      }
    });
    return () => subscription.unsubscribe();
  }, [proposalForm]);

  // Populate form when editing existing proposal
  useEffect(() => {
    if (existingProposal && isEditMode) {
      proposalForm.reset({
        title: existingProposal.title || "",
        slug: existingProposal.slug || "",
        companyName: existingProposal.companyName || "",
        htmlContent: existingProposal.htmlContent || "",
        templateType: (existingProposal.templateType || "project") as "project" | "retainer",
        contactName: existingProposal.contactName || "",
        contactEmail: existingProposal.contactEmail || "",
        engagementTimeline: existingProposal.engagementTimeline || "",
        whiteLabelLogoUrl: existingProposal.whiteLabelLogoUrl || "",
        prospectLogoUrl: existingProposal.prospectLogoUrl || "",
        brandFont: existingProposal.brandFont || "Inter",
        brandPrimaryColor: existingProposal.brandPrimaryColor || "#2563eb",
        brandSecondaryColor: existingProposal.brandSecondaryColor || "#64748b",
        brandAccentColor: existingProposal.brandAccentColor || "#f59e0b",
        status: (existingProposal.status || "draft") as "draft" | "published",
      });
    }
  }, [existingProposal, isEditMode, proposalForm]);

  // Populate scope items when editing
  useEffect(() => {
    if (existingScopeItems && existingScopeItems.length > 0 && isEditMode) {
      const formattedItems: ScopeItem[] = existingScopeItems.map((item) => ({
        storyId: String(item.storyId || item.order + 1),
        hours: item.hours || 0,
        workstream: item.workstreamName || "",
        customerStory: item.customerStory || "",
        recommendedApproach: item.recommendedApproach || "",
        assumptions: item.assumptions || "",
        order: item.order || 0,
      }));
      setScopeItems(formattedItems);
    }
  }, [existingScopeItems, isEditMode]);

  const extractMetadataMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/ai/extract-metadata", "POST", {
        chatTranscript,
      });
      return await response.json();
    },
    onSuccess: (metadata) => {
      // Auto-populate form fields from extracted metadata
      if (metadata.title) {
        proposalForm.setValue("title", metadata.title);
        // Auto-generate slug from title
        const slug = metadata.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        proposalForm.setValue("slug", slug);
      }
      if (metadata.companyName) {
        proposalForm.setValue("companyName", metadata.companyName);
      }
      if (metadata.contactName) {
        proposalForm.setValue("contactName", metadata.contactName);
      }
      if (metadata.contactEmail) {
        proposalForm.setValue("contactEmail", metadata.contactEmail);
      }
      if (metadata.engagementTimeline) {
        proposalForm.setValue("engagementTimeline", metadata.engagementTimeline);
      }
    },
    onError: (error) => {
      // Silently fail - metadata extraction is optional
      console.error("Failed to extract metadata:", error);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/ai/generate-scope", "POST", {
        chatTranscript,
        companyName: companyNameForGeneration || undefined,
        generalInstructions: generalInstructions || undefined,
        previousProposalIds: selectedProposalIds.length > 0 ? selectedProposalIds : undefined,
        projectContext: {
          projectName: projectContext.projectName || undefined,
          accountName: projectContext.accountName || undefined,
        },
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setScopeItems(data.scopeItems);
      // Also extract and populate metadata from transcript
      extractMetadataMutation.mutate();
      toast({
        title: "Success",
        description: `Generated ${data.scopeItems.length} scope items and auto-populated form fields`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate scope",
        variant: "destructive",
      });
    },
  });

  const refineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/ai/refine-scope", "POST", {
        scopeItems,
        refinementInstructions: refinementPrompt,
        companyName: companyNameForGeneration || undefined,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setScopeItems(data.scopeItems);
      setRefinementPrompt("");
      toast({
        title: "Success",
        description: "Scope refined successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refine scope",
        variant: "destructive",
      });
    },
  });

  const saveProposalMutation = useMutation({
    mutationFn: async (data: ProposalFormData & { scopeItems?: ScopeItem[], chatTranscript?: string }) => {
      if (isEditMode && proposalId) {
        await apiRequest(`/api/proposals/${proposalId}`, "PATCH", data);
      } else {
        const response = await apiRequest("/api/proposals", "POST", data);
        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      if (isEditMode && proposalId) {
        queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId] });
        queryClient.invalidateQueries({ queryKey: ["/api/proposals", proposalId, "scope-items"] });
      }
      toast({
        title: "Success",
        description: isEditMode ? "Proposal updated successfully" : "Proposal created successfully",
      });
      navigate("/proposals");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || (isEditMode ? "Failed to update proposal" : "Failed to create proposal"),
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!chatTranscript.trim()) {
      toast({
        title: "Error",
        description: "Please provide a chat transcript",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleRefine = () => {
    if (!refinementPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please provide refinement instructions",
        variant: "destructive",
      });
      return;
    }
    refineMutation.mutate();
  };

  const handleUpdateItem = (index: number, updates: Partial<ScopeItem>) => {
    setScopeItems(items => items.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const handleDeleteItem = (index: number) => {
    setScopeItems(items => {
      const filtered = items.filter((_, i) => i !== index);
      // Renumber story IDs sequentially after deletion
      return filtered.map((item, i) => ({ ...item, storyId: String(i + 1) }));
    });
  };

  const handleAddItem = () => {
    const newItem: ScopeItem = {
      storyId: String(scopeItems.length + 1),
      hours: 0,
      workstream: "General",
      customerStory: "",
      recommendedApproach: "",
      assumptions: "",
      order: scopeItems.length,
    };
    setScopeItems([...scopeItems, newItem]);
  };

  const handleFormSubmit = () => {
    if (scopeItems.length > 0) {
      const generatedHTML = convertScopeToHTML(scopeItems);
      proposalForm.setValue("htmlContent", generatedHTML, { shouldValidate: true });
    }
    proposalForm.handleSubmit(onSubmitProposal)();
  };

  const handleSaveDraft = () => {
    // Generate HTML content from scope items before saving
    if (scopeItems.length > 0) {
      const generatedHTML = convertScopeToHTML(scopeItems);
      proposalForm.setValue("htmlContent", generatedHTML, { shouldValidate: true });
    }
    proposalForm.setValue("status", "draft");
    proposalForm.handleSubmit(onSubmitProposal)();
  };

  const handlePublish = () => {
    // Check if there are scope items before publishing
    if (scopeItems.length === 0) {
      toast({
        title: "Cannot Publish",
        description: "Please add at least one scope item before publishing",
        variant: "destructive",
      });
      return;
    }
    
    // Generate HTML content from scope items before publishing
    const generatedHTML = convertScopeToHTML(scopeItems);
    proposalForm.setValue("htmlContent", generatedHTML, { shouldValidate: true });
    
    // Manually validate against strict publish schema
    const formData = { ...proposalForm.getValues(), status: "published" as const, htmlContent: generatedHTML };
    const result = proposalPublishSchema.safeParse(formData);
    
    if (!result.success) {
      // Map validation errors to form fields
      const fieldErrors = result.error.flatten().fieldErrors;
      Object.entries(fieldErrors).forEach(([field, errors]) => {
        if (errors && errors.length > 0) {
          proposalForm.setError(field as any, {
            type: "manual",
            message: errors[0],
          });
        }
      });
      
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before publishing",
        variant: "destructive",
      });
      return;
    }
    
    // If validation passes, proceed with publish
    proposalForm.setValue("status", "published");
    proposalForm.handleSubmit(onSubmitProposal)();
  };

  const onSubmitProposal = (data: ProposalFormData) => {
    if (scopeItems.length > 0) {
      saveProposalMutation.mutate({ ...data, scopeItems, chatTranscript });
    } else {
      saveProposalMutation.mutate(data);
    }
  };

  const handleApplyBrandingProfile = (profile: BrandingConfig) => {
    setSelectedBrandingProfileId(profile.id);
    const currentValues = proposalForm.getValues();
    proposalForm.reset({
      ...currentValues,
      companyName: profile.companyName,
      whiteLabelLogoUrl: profile.logoUrl || "",
      brandPrimaryColor: profile.primaryColor,
      brandSecondaryColor: profile.secondaryColor,
    });
    toast({
      title: "Branding Profile Applied",
      description: `Loaded branding for ${profile.companyName}`,
    });
  };

  const handleClearBrandingProfile = () => {
    setSelectedBrandingProfileId(undefined);
  };

  const totalHours = scopeItems.reduce((sum, item) => sum + item.hours, 0);

  if (isEditMode && isLoadingProposal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading proposal...</p>
      </div>
    );
  }

  if (isEditMode && proposalError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Failed to load proposal. The proposal may not exist or you don't have access to it.</p>
        <Button onClick={() => navigate("/proposals")} data-testid="button-back-to-proposals">
          Back to Proposals
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/proposals")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            {isEditMode ? "Edit Proposal" : "Create Proposal"}
          </h1>
          <p className="text-muted-foreground">
            {isEditMode ? "Update your proposal details" : "Generate a proposal using AI-powered scope generation"}
          </p>
        </div>
      </div>

      <Form {...proposalForm}>
        <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }} className="space-y-6">
          <Collapsible defaultOpen={true}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle>Generate Scope</CardTitle>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Company Name (Required for Generation)</label>
                <Input
                  value={companyNameForGeneration}
                  onChange={(e) => setCompanyNameForGeneration(e.target.value)}
                  placeholder="e.g., Acme Corporation"
                  data-testid="input-company-for-generation"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This name will be used in workstream titles (e.g., "Acme Integration")
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">General Instructions (Optional)</label>
                <Textarea
                  value={generalInstructions}
                  onChange={(e) => setGeneralInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g., 'Use agile methodology', 'Include accessibility requirements', 'Focus on mobile-first design'..."
                  data-testid="textarea-general-instructions"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Reference Previous Proposals (Optional)</label>
                <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto">
                  {proposals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No previous proposals available</p>
                  ) : (
                    proposals.map((p) => (
                      <div key={p.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`proposal-${p.id}`}
                          checked={selectedProposalIds.includes(p.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedProposalIds([...selectedProposalIds, p.id]);
                            } else {
                              setSelectedProposalIds(selectedProposalIds.filter(id => id !== p.id));
                            }
                          }}
                          data-testid={`checkbox-proposal-${p.id}`}
                        />
                        <label
                          htmlFor={`proposal-${p.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {p.title} - {p.companyName}
                        </label>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Select one or more previous proposals to use as context for phase 2 or update scopes
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Chat Transcript</label>
                <Textarea
                  value={chatTranscript}
                  onChange={(e) => setChatTranscript(e.target.value)}
                  rows={6}
                  placeholder="Paste your conversation with the client here..."
                  data-testid="textarea-transcript"
                />
              </div>

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={generateMutation.isPending || !chatTranscript.trim() || !companyNameForGeneration.trim()}
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Scope
                  </>
                )}
              </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible defaultOpen={true}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle>Basic Information</CardTitle>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={proposalForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Q4 Website Redesign" data-testid="input-proposal-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proposalForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="q4-website-redesign" data-testid="input-proposal-slug" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proposalForm.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Acme Corporation" data-testid="input-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={proposalForm.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" data-testid="input-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proposalForm.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="john@example.com" data-testid="input-contact-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {scopeItems.length > 0 && (
            <>
              <Collapsible defaultOpen={true}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div>
                            <CardTitle>Scope Items ({scopeItems.length})</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">Total: {totalHours} hours</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" onClick={(e) => { e.stopPropagation(); handleAddItem(); }} size="sm" variant="outline" data-testid="button-add-item">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                          </Button>
                          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-28">Story ID</TableHead>
                          <TableHead className="w-28">Hours</TableHead>
                          <TableHead className="min-w-40">Workstream</TableHead>
                          <TableHead>Customer Story</TableHead>
                          <TableHead>Approach</TableHead>
                          <TableHead>Assumptions</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scopeItems.map((item, index) => (
                          <TableRow key={index} data-testid={`row-scope-${index}`}>
                            <TableCell className="align-top">
                              <Input
                                value={String(index + 1)}
                                readOnly
                                className="w-full font-mono text-sm bg-muted"
                                data-testid={`input-story-id-${index}`}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={item.hours}
                                onChange={(e) => handleUpdateItem(index, { hours: parseInt(e.target.value) || 0 })}
                                className="w-full"
                                data-testid={`input-hours-${index}`}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={item.workstream}
                                onChange={(e) => handleUpdateItem(index, { workstream: e.target.value })}
                                className="w-full"
                                data-testid={`input-workstream-${index}`}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={item.customerStory}
                                onChange={(e) => handleUpdateItem(index, { customerStory: e.target.value })}
                                rows={6}
                                className="w-full min-h-[120px]"
                                data-testid={`textarea-story-${index}`}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={item.recommendedApproach}
                                onChange={(e) => handleUpdateItem(index, { recommendedApproach: e.target.value })}
                                rows={8}
                                className="w-full min-h-[160px] whitespace-pre-wrap"
                                data-testid={`textarea-approach-${index}`}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={item.assumptions}
                                onChange={(e) => handleUpdateItem(index, { assumptions: e.target.value })}
                                rows={8}
                                className="w-full min-h-[160px] whitespace-pre-wrap"
                                data-testid={`textarea-assumptions-${index}`}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteItem(index)}
                                data-testid={`button-delete-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <Collapsible defaultOpen={true}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate">
                      <div className="flex items-center justify-between">
                        <CardTitle>Refine Scope</CardTitle>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                <CardContent className="space-y-4">
                  <Textarea
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    rows={2}
                    placeholder="e.g., 'Increase estimates by 20%' or 'Add more detail to the authentication stories'"
                    data-testid="textarea-refinement"
                  />
                  <Button
                    type="button"
                    onClick={handleRefine}
                    disabled={refineMutation.isPending || !refinementPrompt.trim()}
                    variant="outline"
                    data-testid="button-refine"
                  >
                    {refineMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Refining...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Refine Scope
                      </>
                    )}
                  </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </>
          )}

          <Collapsible defaultOpen={true}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle>Brand Customization</CardTitle>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
            <CardContent className="space-y-4">
              <BrandingProfileSelector
                selectedProfileId={selectedBrandingProfileId}
                onApplyProfile={handleApplyBrandingProfile}
                onClearProfile={handleClearBrandingProfile}
                disabled={saveProposalMutation.isPending}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={proposalForm.control}
                  name="whiteLabelLogoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>White Label Logo URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/logo.png" data-testid="input-white-label-logo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proposalForm.control}
                  name="prospectLogoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prospect Logo URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/client-logo.png" data-testid="input-prospect-logo" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={proposalForm.control}
                name="brandFont"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand Font</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-brand-font">
                          <SelectValue placeholder="Select a font" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Inter">Inter (Default)</SelectItem>
                        <SelectItem value="Roboto">Roboto</SelectItem>
                        <SelectItem value="Poppins">Poppins</SelectItem>
                        <SelectItem value="Montserrat">Montserrat</SelectItem>
                        <SelectItem value="Open Sans">Open Sans</SelectItem>
                        <SelectItem value="Lato">Lato</SelectItem>
                        <SelectItem value="Raleway">Raleway</SelectItem>
                        <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                        <SelectItem value="Merriweather">Merriweather</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={proposalForm.control}
                  name="brandPrimaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            type="color" 
                            {...field} 
                            className="h-10 w-16 p-1 cursor-pointer"
                            data-testid="input-primary-color" 
                          />
                        </FormControl>
                        <Input 
                          value={field.value} 
                          onChange={field.onChange}
                          placeholder="#2563eb"
                          className="flex-1"
                          data-testid="input-primary-color-hex"
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proposalForm.control}
                  name="brandSecondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            type="color" 
                            {...field} 
                            className="h-10 w-16 p-1 cursor-pointer"
                            data-testid="input-secondary-color" 
                          />
                        </FormControl>
                        <Input 
                          value={field.value} 
                          onChange={field.onChange}
                          placeholder="#64748b"
                          className="flex-1"
                          data-testid="input-secondary-color-hex"
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={proposalForm.control}
                  name="brandAccentColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Accent Color</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input 
                            type="color" 
                            {...field} 
                            className="h-10 w-16 p-1 cursor-pointer"
                            data-testid="input-accent-color" 
                          />
                        </FormControl>
                        <Input 
                          value={field.value} 
                          onChange={field.onChange}
                          placeholder="#f59e0b"
                          className="flex-1"
                          data-testid="input-accent-color-hex"
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/proposals")} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleSaveDraft} 
              disabled={saveProposalMutation.isPending} 
              data-testid="button-save-draft"
            >
              Save Draft
            </Button>
            <Button 
              type="button" 
              onClick={handlePublish} 
              disabled={saveProposalMutation.isPending} 
              data-testid="button-publish"
            >
              Publish Proposal
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
