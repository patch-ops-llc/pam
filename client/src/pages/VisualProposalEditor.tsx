import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Sparkles, 
  ChevronDown,
  Wand2,
  FileText,
  ListPlus,
  PenLine,
  MessageSquare,
  Loader2,
  Copy,
  Check
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ProposalWithProject, BrandingConfig } from "@shared/schema";
import { z } from "zod";
import { RichTextEditor } from "@/components/RichTextEditor";
import { BrandingProfileSelector } from "@/components/BrandingProfileSelector";

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
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().default("#2563eb"),
  brandSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().default("#64748b"),
  brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().default("#f59e0b"),
  status: z.enum(["draft", "published"]).default("draft"),
});

const proposalPublishSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  companyName: z.string().min(1, "Company name is required"),
  htmlContent: z.string().min(1, "Content is required"),
  templateType: z.enum(["project", "retainer"]),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  engagementTimeline: z.string().optional(),
  whiteLabelLogoUrl: z.string().optional(),
  prospectLogoUrl: z.string().optional(),
  brandFont: z.string().optional().default("Inter"),
  brandPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().default("#2563eb"),
  brandSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().default("#64748b"),
  brandAccentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color").optional().default("#f59e0b"),
  status: z.enum(["draft", "published"]).default("draft"),
});

type ProposalFormData = z.infer<typeof proposalPublishSchema>;

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface CopilotSuggestion {
  type: "expand" | "rewrite" | "section" | "custom";
  label: string;
  prompt: string;
}

const quickSuggestions: CopilotSuggestion[] = [
  { type: "section", label: "Generate Executive Summary", prompt: "Write a professional executive summary for this proposal that highlights the key value proposition and expected outcomes." },
  { type: "section", label: "Add Scope Section", prompt: "Create a detailed scope of work section with clear deliverables and milestones." },
  { type: "section", label: "Add Timeline Section", prompt: "Generate a project timeline section with phases and estimated durations." },
  { type: "section", label: "Add Pricing Section", prompt: "Create a pricing section template with cost breakdown and payment terms." },
  { type: "expand", label: "Expand Current Content", prompt: "Take the current proposal content and expand it with more detail, examples, and professional language." },
  { type: "rewrite", label: "Make More Professional", prompt: "Rewrite the current content to be more professional, polished, and persuasive while maintaining the core message." },
];

export default function VisualProposalEditor() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/proposals/visual/edit/:id");
  const isEditMode = Boolean(match);
  const proposalId = params?.id;

  const [htmlContent, setHtmlContent] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [copiedContent, setCopiedContent] = useState<string | null>(null);
  const [selectedBrandingProfileId, setSelectedBrandingProfileId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const { data: existingProposal, isLoading: isLoadingProposal } = useQuery<ProposalWithProject>({
    queryKey: ["/api/proposals", proposalId],
    enabled: isEditMode && Boolean(proposalId),
  });

  const { data: brandingConfigs = [] } = useQuery<BrandingConfig[]>({
    queryKey: ["/api/branding-configs"],
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
      setHtmlContent(existingProposal.htmlContent || "");
    }
  }, [existingProposal, isEditMode, proposalForm]);

  useEffect(() => {
    if (!isEditMode) {
      const prefillData = sessionStorage.getItem("proposalPrefill");
      if (prefillData) {
        try {
          const data = JSON.parse(prefillData);
          if (data.prefilled) {
            let formValues: Partial<ProposalFormData> = {
              ...proposalForm.getValues(),
              title: data.title || "",
              companyName: data.companyName || "",
              htmlContent: data.htmlContent || "",
              contactName: data.contactName || "",
              contactEmail: data.contactEmail || "",
              engagementTimeline: data.engagementTimeline || "",
            };
            
            if (data.brandingProfileId) {
              setSelectedBrandingProfileId(data.brandingProfileId);
              formValues = {
                ...formValues,
                companyName: data.brandingCompanyName || formValues.companyName,
                whiteLabelLogoUrl: data.brandingLogoUrl || "",
                brandPrimaryColor: data.brandingPrimaryColor || "#2563eb",
                brandSecondaryColor: data.brandingSecondaryColor || "#64748b",
              };
            }
            
            proposalForm.reset(formValues as ProposalFormData);
            setHtmlContent(data.htmlContent || "");
            
            if (formValues.title) {
              const slug = formValues.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
              proposalForm.setValue("slug", slug, { shouldValidate: false });
            }
            
            sessionStorage.removeItem("proposalPrefill");
          }
        } catch (e) {
          console.error("Failed to parse prefill data:", e);
        }
      }
    }
  }, [isEditMode, proposalForm]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [copilotMessages]);

  const copilotMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await apiRequest("/api/ai/copilot", "POST", {
        prompt,
        currentContent: htmlContent,
        context: {
          title: proposalForm.getValues("title"),
          companyName: proposalForm.getValues("companyName"),
          templateType: proposalForm.getValues("templateType"),
        },
      });
      return await response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: CopilotMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
      };
      setCopilotMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response",
        variant: "destructive",
      });
    },
  });

  const saveProposalMutation = useMutation({
    mutationFn: async (data: ProposalFormData) => {
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
        description: error.message || "Failed to save proposal",
        variant: "destructive",
      });
    },
  });

  const handleCopilotSubmit = (prompt: string) => {
    if (!prompt.trim()) return;

    const userMessage: CopilotMessage = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };
    setCopilotMessages(prev => [...prev, userMessage]);
    setCopilotInput("");
    copilotMutation.mutate(prompt);
  };

  const handleQuickSuggestion = (suggestion: CopilotSuggestion) => {
    handleCopilotSubmit(suggestion.prompt);
  };

  const handleCopyToEditor = (content: string) => {
    const newContent = htmlContent 
      ? `${htmlContent}\n\n${content}`
      : content;
    setHtmlContent(newContent);
    proposalForm.setValue("htmlContent", newContent);
    setCopiedContent(content);
    setTimeout(() => setCopiedContent(null), 2000);
    toast({
      title: "Content Added",
      description: "AI-generated content has been added to the editor",
    });
  };

  const handleSaveDraft = () => {
    proposalForm.setValue("htmlContent", htmlContent);
    proposalForm.setValue("status", "draft");
    proposalForm.handleSubmit(onSubmitProposal)();
  };

  const handlePublish = () => {
    proposalForm.setValue("htmlContent", htmlContent);
    
    const formData = { ...proposalForm.getValues(), status: "published" as const, htmlContent };
    const result = proposalPublishSchema.safeParse(formData);
    
    if (!result.success) {
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
    
    proposalForm.setValue("status", "published");
    proposalForm.handleSubmit(onSubmitProposal)();
  };

  const onSubmitProposal = (data: ProposalFormData) => {
    saveProposalMutation.mutate({ ...data, htmlContent });
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

  if (isEditMode && isLoadingProposal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading proposal...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-4 pb-4 border-b">
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
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              {isEditMode ? "Edit Proposal" : "Visual Proposal Editor"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Create your proposal with the AI copilot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saveProposalMutation.isPending}
            data-testid="button-save-draft"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={handlePublish}
            disabled={saveProposalMutation.isPending}
            data-testid="button-publish"
          >
            <Send className="h-4 w-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 pt-4 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <Form {...proposalForm}>
            <form className="space-y-4 overflow-y-auto pr-2">
              <Collapsible defaultOpen>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover-elevate py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Proposal Details</CardTitle>
                        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={proposalForm.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Title</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Proposal title" data-testid="input-title" />
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
                                <Input {...field} placeholder="Client company" data-testid="input-company" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <FormField
                          control={proposalForm.control}
                          name="contactName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Primary contact" data-testid="input-contact-name" />
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
                                <Input {...field} type="email" placeholder="email@example.com" data-testid="input-contact-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={proposalForm.control}
                          name="templateType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-template-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="project">Project</SelectItem>
                                  <SelectItem value="retainer">Retainer</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={proposalForm.control}
                        name="engagementTimeline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Timeline</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Q1 2025, 8 weeks" data-testid="input-timeline" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <BrandingProfileSelector
                        selectedProfileId={selectedBrandingProfileId}
                        onApplyProfile={handleApplyBrandingProfile}
                        onClearProfile={() => setSelectedBrandingProfileId(undefined)}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <Card className="flex-1 flex flex-col">
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Proposal Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <RichTextEditor
                    content={htmlContent}
                    onChange={setHtmlContent}
                    placeholder="Start writing your proposal content here..."
                  />
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        <Card className="w-96 flex flex-col overflow-hidden">
          <CardHeader className="py-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Copilot
            </CardTitle>
          </CardHeader>
          
          <div className="p-3 border-b space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Quick Actions</p>
            <div className="flex flex-wrap gap-1.5">
              {quickSuggestions.slice(0, 4).map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleQuickSuggestion(suggestion)}
                  disabled={copilotMutation.isPending}
                  data-testid={`button-quick-${suggestion.type}-${index}`}
                >
                  {suggestion.type === "section" && <ListPlus className="h-3 w-3 mr-1" />}
                  {suggestion.type === "expand" && <Wand2 className="h-3 w-3 mr-1" />}
                  {suggestion.type === "rewrite" && <PenLine className="h-3 w-3 mr-1" />}
                  {suggestion.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickSuggestions.slice(4).map((suggestion, index) => (
                <Button
                  key={index + 4}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleQuickSuggestion(suggestion)}
                  disabled={copilotMutation.isPending}
                  data-testid={`button-quick-${suggestion.type}-${index + 4}`}
                >
                  {suggestion.type === "section" && <ListPlus className="h-3 w-3 mr-1" />}
                  {suggestion.type === "expand" && <Wand2 className="h-3 w-3 mr-1" />}
                  {suggestion.type === "rewrite" && <PenLine className="h-3 w-3 mr-1" />}
                  {suggestion.label}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {copilotMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Ask the AI copilot for help with your proposal
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use quick actions above or type a custom request
                  </p>
                </div>
              ) : (
                copilotMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg p-3 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-4"
                        : "bg-muted mr-4"
                    }`}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.role === "assistant" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs w-full"
                        onClick={() => handleCopyToEditor(message.content)}
                        data-testid={`button-copy-${message.id}`}
                      >
                        {copiedContent === message.content ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Added to Editor
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Add to Editor
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
              {copilotMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted rounded-lg mr-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating response...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <Separator />
          
          <div className="p-3">
            <div className="flex gap-2">
              <Textarea
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                placeholder="Ask the AI for help..."
                className="min-h-[60px] resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleCopilotSubmit(copilotInput);
                  }
                }}
                data-testid="textarea-copilot-input"
              />
            </div>
            <Button
              className="w-full mt-2"
              onClick={() => handleCopilotSubmit(copilotInput)}
              disabled={!copilotInput.trim() || copilotMutation.isPending}
              data-testid="button-send-copilot"
            >
              {copilotMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
