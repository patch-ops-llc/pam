import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Clock, CheckSquare, Info, Pencil, ExternalLink, MessageSquareText, Copy } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import type { UatChecklistItemStep } from "@shared/schema";

const stepFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  instructions: z.string().optional(),
  expectedResult: z.string().optional(),
  stepType: z.enum(["test", "delay", "info"]).default("test"),
  linkUrl: z.string().optional(),
  notesRequired: z.boolean().default(false),
  notesPrompt: z.string().optional(),
  estimatedDurationMinutes: z.number().optional(),
  isRequired: z.boolean().default(true),
});

type StepFormData = z.infer<typeof stepFormSchema>;

const stepTypeConfig = {
  test: { label: "Test Step", icon: CheckSquare, description: "Requires pass/fail verification" },
  delay: { label: "Wait/Delay", icon: Clock, description: "Wait for automation to complete" },
  info: { label: "Info Only", icon: Info, description: "Informational step, no action required" },
};

interface UatStepsEditorProps {
  itemId: string;
}

export default function UatStepsEditor({ itemId }: UatStepsEditorProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<UatChecklistItemStep | null>(null);

  const { data: steps = [], isLoading } = useQuery<UatChecklistItemStep[]>({
    queryKey: ["/api/uat-items", itemId, "steps"],
  });

  const form = useForm<StepFormData>({
    resolver: zodResolver(stepFormSchema),
    defaultValues: { 
      title: "", 
      instructions: "", 
      expectedResult: "", 
      stepType: "test",
      linkUrl: "",
      notesRequired: false,
      notesPrompt: "",
      isRequired: true,
    },
  });

  const watchStepType = form.watch("stepType");

  const openCreateDialog = () => {
    setEditingStep(null);
    form.reset({ title: "", instructions: "", expectedResult: "", stepType: "test", linkUrl: "", notesRequired: false, notesPrompt: "", isRequired: true });
    setDialogOpen(true);
  };

  const openEditDialog = (step: UatChecklistItemStep) => {
    const stepAny = step as any;
    setEditingStep(step);
    form.reset({
      title: step.title,
      instructions: step.instructions || "",
      expectedResult: stepAny.expectedResult || "",
      stepType: stepAny.stepType || "test",
      linkUrl: stepAny.linkUrl || "",
      notesRequired: stepAny.notesRequired || false,
      notesPrompt: stepAny.notesPrompt || "",
      estimatedDurationMinutes: stepAny.estimatedDurationMinutes,
      isRequired: stepAny.isRequired ?? true,
    });
    setDialogOpen(true);
  };

  const createStepMutation = useMutation({
    mutationFn: async (data: StepFormData) => {
      return await apiRequest(`/api/uat-items/${itemId}/steps`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-items", itemId, "steps"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Step added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add step", description: error.message, variant: "destructive" });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: StepFormData }) => {
      // Convert empty strings to null for optional text fields
      const cleanedData = {
        ...data,
        linkUrl: data.linkUrl?.trim() || null,
        notesPrompt: data.notesPrompt?.trim() || null,
        instructions: data.instructions?.trim() || null,
        expectedResult: data.expectedResult?.trim() || null,
      };
      return await apiRequest(`/api/uat-steps/${stepId}`, "PATCH", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-items", itemId, "steps"] });
      setDialogOpen(false);
      setEditingStep(null);
      form.reset();
      toast({ title: "Step updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update step", description: error.message, variant: "destructive" });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      return await apiRequest(`/api/uat-steps/${stepId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-items", itemId, "steps"] });
      toast({ title: "Step removed" });
    },
  });

  const duplicateStepMutation = useMutation({
    mutationFn: async (step: UatChecklistItemStep) => {
      const stepAny = step as any;
      return await apiRequest(`/api/uat-items/${itemId}/steps`, "POST", {
        title: `${step.title} (Copy)`,
        instructions: step.instructions || "",
        expectedResult: stepAny.expectedResult || "",
        stepType: stepAny.stepType || "test",
        linkUrl: stepAny.linkUrl || "",
        notesRequired: stepAny.notesRequired || false,
        notesPrompt: stepAny.notesPrompt || "",
        estimatedDurationMinutes: stepAny.estimatedDurationMinutes,
        isRequired: stepAny.isRequired ?? true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-items", itemId, "steps"] });
      toast({ title: "Step duplicated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to duplicate step", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: StepFormData) => {
    if (editingStep) {
      updateStepMutation.mutate({ stepId: editingStep.id, data });
    } else {
      createStepMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading steps...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Test Steps</span>
        <Button variant="outline" size="sm" onClick={openCreateDialog}>
          <Plus className="w-3 h-3 mr-1" />
          Add Step
        </Button>
      </div>

      {steps.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No test steps defined. Add steps for reviewers to test.</p>
      ) : (
        <div className="space-y-2">
          {steps.map((step, index) => {
            const stepAny = step as any;
            const typeConfig = stepTypeConfig[stepAny.stepType as keyof typeof stepTypeConfig] || stepTypeConfig.test;
            const TypeIcon = typeConfig.icon;
            return (
              <Card key={step.id} className="border-dashed">
                <CardContent className="py-2 px-3">
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-1 text-muted-foreground pt-0.5">
                      <GripVertical className="w-3 h-3" />
                      <span className="text-xs font-medium w-4">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{step.title}</span>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          <TypeIcon className="w-3 h-3 mr-1" />
                          {typeConfig.label}
                        </Badge>
                        {stepAny.stepType === "delay" && stepAny.estimatedDurationMinutes && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            ~{stepAny.estimatedDurationMinutes} min
                          </Badge>
                        )}
                        {stepAny.linkUrl && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Link
                          </Badge>
                        )}
                        {stepAny.notesRequired && (
                          <Badge variant="default" className="text-xs shrink-0">
                            <MessageSquareText className="w-3 h-3 mr-1" />
                            Notes Required
                          </Badge>
                        )}
                      </div>
                      {step.instructions && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{step.instructions}</p>
                      )}
                      {stepAny.linkUrl && (
                        <a 
                          href={stepAny.linkUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-xs text-muted-foreground underline hover:text-foreground mt-1 flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {stepAny.linkUrl.length > 50 ? stepAny.linkUrl.substring(0, 50) + "..." : stepAny.linkUrl}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEditDialog(step)}
                        title="Edit step"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => duplicateStepMutation.mutate(step)}
                        disabled={duplicateStepMutation.isPending}
                        title="Duplicate step"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          if (confirm("Delete this step?")) {
                            deleteStepMutation.mutate(step.id);
                          }
                        }}
                        title="Delete step"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setEditingStep(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? "Edit Test Step" : "Add Test Step"}</DialogTitle>
            <DialogDescription>
              {editingStep ? "Update the step details" : "Add a step that reviewers will test"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="stepType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Step Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(stepTypeConfig).map(([key, { label, description }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex flex-col">
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">{description}</span>
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
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={watchStepType === "delay" ? "e.g., Wait for email to arrive" : "e.g., Verify login button works"} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={watchStepType === "delay" ? "What to wait for..." : "What to check or verify..."}
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchStepType === "test" && (
                <FormField
                  control={form.control}
                  name="expectedResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Result (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., User is redirected to dashboard" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {watchStepType === "delay" && (
                <FormField
                  control={form.control}
                  name="estimatedDurationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Wait Time (minutes)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1"
                          placeholder="e.g., 5" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="linkUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Link (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="url"
                        placeholder="https://app.hubspot.com/..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      A clickable link for the reviewer to reference
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notesRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Require Notes</FormLabel>
                      <FormDescription>
                        Reviewer must enter notes before completing this step
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              {form.watch("notesRequired") && (
                <FormField
                  control={form.control}
                  name="notesPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes Prompt (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Note which rows you selected" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Custom prompt shown to reviewer
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createStepMutation.isPending || updateStepMutation.isPending}>
                  {createStepMutation.isPending || updateStepMutation.isPending 
                    ? "Saving..." 
                    : editingStep ? "Update Step" : "Add Step"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
