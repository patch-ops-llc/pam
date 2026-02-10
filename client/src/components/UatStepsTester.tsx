import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Info, AlertCircle, Loader2, CheckCheck, ExternalLink, MessageSquareText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UatItemComments } from "@/components/UatItemComments";
import type { UatChecklistItemStep, UatTestRun, UatTestStepResult } from "@shared/schema";

const stepTypeConfig = {
  test: { label: "Test", icon: CheckCircle, color: "text-blue-500" },
  delay: { label: "Wait", icon: Clock, color: "text-amber-500" },
  info: { label: "Info", icon: Info, color: "text-gray-500" },
};

interface UatStepsTesterProps {
  itemId: string;
  token: string;
  guestName: string;
  guestId?: string;
  isDeveloper?: boolean;
  onMarkComplete?: () => void;
  showDoneButton?: boolean;
}

export default function UatStepsTester({ 
  itemId, 
  token, 
  guestName, 
  guestId, 
  isDeveloper = false,
  onMarkComplete,
  showDoneButton = true,
}: UatStepsTesterProps) {
  const apiBase = isDeveloper ? `/api/uat/dev/${token}` : `/api/uat/token/${token}`;
  const { toast } = useToast();
  const [failNotes, setFailNotes] = useState("");
  const [failDialogStep, setFailDialogStep] = useState<UatChecklistItemStep | null>(null);
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({});

  const { data: steps = [], isLoading: stepsLoading } = useQuery<UatChecklistItemStep[]>({
    queryKey: [`${apiBase}/items/${itemId}/steps`],
  });

  const { data: runData, isLoading: runLoading } = useQuery<{ run: UatTestRun | null; results: UatTestStepResult[] }>({
    queryKey: [`${apiBase}/items/${itemId}/active-run`],
  });

  const updateResultMutation = useMutation({
    mutationFn: async ({ stepId, status, notes }: { stepId: string; status: string; notes?: string }) => {
      if (!runData?.run) return;
      return await apiRequest(`${apiBase}/runs/${runData.run.id}/steps/${stepId}`, "PATCH", {
        status,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${apiBase}/items/${itemId}/active-run`] });
      setFailDialogStep(null);
      setFailNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update step", description: error.message, variant: "destructive" });
    },
  });

  if (stepsLoading || runLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading steps...</span>
      </div>
    );
  }

  if (steps.length === 0) {
    return null;
  }

  const results = runData?.results || [];
  const getStepResult = (stepId: string) => results.find(r => r.stepId === stepId);

  const handlePass = (step: UatChecklistItemStep) => {
    const stepAny = step as any;
    // Check if notes are required
    if (stepAny.notesRequired && !stepNotes[step.id]?.trim()) {
      toast({ 
        title: "Notes required", 
        description: stepAny.notesPrompt || "Please enter notes before completing this step",
        variant: "destructive" 
      });
      return;
    }
    const status = stepAny.stepType === "test" ? "passed" : "acknowledged";
    updateResultMutation.mutate({ stepId: step.id, status, notes: stepNotes[step.id] || undefined });
  };

  const handleFail = (step: UatChecklistItemStep) => {
    // Prefill fail notes with any notes already entered for this step
    setFailNotes(stepNotes[step.id] || "");
    setFailDialogStep(step);
  };

  const submitFail = () => {
    if (!failDialogStep || !failNotes.trim()) return;
    updateResultMutation.mutate({ stepId: failDialogStep.id, status: "failed", notes: failNotes });
  };

  const getStatusBadge = (result: UatTestStepResult | undefined) => {
    if (!result?.status) {
      return <Badge variant="outline" className="text-xs">Not tested</Badge>;
    }
    switch (result.status) {
      case "passed":
        return <Badge className="bg-green-500 text-xs">Passed</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case "acknowledged":
        return <Badge className="bg-blue-500 text-xs">Done</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{result.status}</Badge>;
    }
  };

  const completedSteps = results.filter(r => r.status && r.status !== "pending").length;
  const hasFailedSteps = results.some(r => r.status === "failed");
  const allStepsCompleted = completedSteps === steps.length && steps.length > 0;
  const hasProgress = completedSteps > 0;

  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-sm font-medium">Test Steps</h4>
      <div className="space-y-2">
        {steps.map((step, index) => {
          const stepAny = step as any;
          const typeConfig = stepTypeConfig[stepAny.stepType as keyof typeof stepTypeConfig] || stepTypeConfig.test;
          const TypeIcon = typeConfig.icon;
          const result = getStepResult(step.id);
          const isCompleted = result?.status && result.status !== null;

          return (
            <Card key={step.id} className={isCompleted ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" : ""}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                      <span className="font-medium">{step.title}</span>
                      {getStatusBadge(result)}
                    </div>
                    {step.instructions && (
                      <p className="text-sm text-muted-foreground mb-2">{step.instructions}</p>
                    )}
                    {stepAny.expectedResult && (
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium">Expected:</span> {stepAny.expectedResult}
                      </p>
                    )}
                    {stepAny.stepType === "delay" && stepAny.estimatedDurationMinutes && (
                      <p className="text-xs text-amber-600 mb-2">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Wait approximately {stepAny.estimatedDurationMinutes} minute(s)
                      </p>
                    )}
                    {stepAny.linkUrl && (
                      <a 
                        href={stepAny.linkUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline hover:text-foreground mb-2"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open Reference Link
                      </a>
                    )}
                    {stepAny.notesRequired && !isCompleted && (
                      <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-1 text-sm text-amber-700 dark:text-amber-300 mb-2">
                          <MessageSquareText className="w-3 h-3" />
                          <span className="font-medium">Notes Required</span>
                        </div>
                        {stepAny.notesPrompt && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{stepAny.notesPrompt}</p>
                        )}
                        <Textarea
                          placeholder="Enter your notes here..."
                          value={stepNotes[step.id] || ""}
                          onChange={(e) => setStepNotes(prev => ({ ...prev, [step.id]: e.target.value }))}
                          className="text-sm min-h-[60px]"
                        />
                      </div>
                    )}
                    {result?.status === "passed" && result.notes && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-950/30 rounded text-sm text-green-700 dark:text-green-300">
                        <MessageSquareText className="w-3 h-3 inline mr-1" />
                        {result.notes}
                      </div>
                    )}
                    {result?.status === "failed" && result.notes && (
                      <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/30 rounded text-sm text-red-700 dark:text-red-300">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {result.notes}
                      </div>
                    )}
                    {!isCompleted && (
                      <div className="flex gap-2 mt-2">
                        {stepAny.stepType === "test" ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handlePass(step)}
                              disabled={updateResultMutation.isPending}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Pass
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleFail(step)}
                              disabled={updateResultMutation.isPending}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Fail
                            </Button>
                          </>
                        ) : stepAny.stepType === "delay" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePass(step)}
                            disabled={updateResultMutation.isPending}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Done Waiting
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePass(step)}
                            disabled={updateResultMutation.isPending}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Acknowledged
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <UatItemComments
          itemId={itemId}
          apiEndpoint={`${apiBase}/items`}
          currentUserName={guestName}
          currentUserId={guestId}
        />
      </div>

      {showDoneButton && hasProgress && (
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {allStepsCompleted ? (
                hasFailedSteps ? (
                  <span className="text-amber-600">Review complete with issues reported</span>
                ) : (
                  <span className="text-green-600">All steps passed</span>
                )
              ) : (
                <span>{completedSteps} of {steps.length} steps completed</span>
              )}
            </div>
            <Button
              onClick={onMarkComplete}
              variant={hasFailedSteps ? "secondary" : "default"}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              {hasFailedSteps ? "Done (Issues Reported)" : "Done Reviewing"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!failDialogStep} onOpenChange={() => setFailDialogStep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Issue</DialogTitle>
            <DialogDescription>
              Please describe what went wrong with this step: {failDialogStep?.title}
            </DialogDescription>
          </DialogHeader>
          {(failDialogStep as any)?.notesRequired && (failDialogStep as any)?.notesPrompt && (
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <MessageSquareText className="w-3 h-3 inline mr-1" />
                {(failDialogStep as any).notesPrompt}
              </p>
            </div>
          )}
          <Textarea
            placeholder="Describe the issue..."
            value={failNotes}
            onChange={(e) => setFailNotes(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailDialogStep(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={submitFail}
              disabled={!failNotes.trim() || updateResultMutation.isPending}
            >
              {updateResultMutation.isPending ? "Submitting..." : "Report Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
