import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  TrainingModuleWithSections,
  TrainingEnrollmentWithProgress,
  TrainingModuleSubmission,
} from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  BookOpen,
  Target,
  TestTubes,
  FileCheck,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Pencil,
  ExternalLink,
  ListChecks,
  StickyNote,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { formatProseWithBullets } from "@/lib/trainingUtils";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "not_started":
      return <Badge variant="outline">Not Started</Badge>;
    case "in_progress":
      return <Badge variant="secondary" className="gap-1"><Pencil className="h-3 w-3" />In Progress</Badge>;
    case "submitted":
      return <Badge className="gap-1 bg-blue-500 hover:bg-blue-600"><Send className="h-3 w-3" />Submitted</Badge>;
    case "under_review":
      return <Badge className="gap-1 bg-amber-500 hover:bg-amber-600"><Clock className="h-3 w-3" />Under Review</Badge>;
    case "passed":
      return <Badge className="gap-1 bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3" />Passed</Badge>;
    case "needs_revision":
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Needs Revision</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

type ChecklistProgress = Record<string, { completed: boolean; notes: string }>;

export default function TrainingModule() {
  const params = useParams<{ id: string }>();
  const moduleId = params.id;
  const { toast } = useToast();
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [checklistProgress, setChecklistProgress] = useState<ChecklistProgress>({});
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const { data: module, isLoading: loadingModule } = useQuery<TrainingModuleWithSections>({
    queryKey: ["/api/training/modules", moduleId],
    enabled: !!moduleId,
  });

  const { data: enrollments } = useQuery<TrainingEnrollmentWithProgress[]>({
    queryKey: ["/api/training/enrollments"],
  });

  // Find the enrollment for this module's program using the programId from the API
  const enrollment = enrollments?.find(e => e.programId === module?.programId);
  const submission = enrollment?.submissions?.find(s => s.moduleId === moduleId);

  // Initialize checklist progress from submission data
  useEffect(() => {
    if (submission?.checklistProgress) {
      setChecklistProgress(submission.checklistProgress as ChecklistProgress);
    }
  }, [submission?.checklistProgress]);

  // Initialize submission notes
  useEffect(() => {
    if (submission?.submissionNotes) {
      setSubmissionNotes(submission.submissionNotes);
    }
  }, [submission?.submissionNotes]);

  // Start module (create or update submission to in_progress)
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) throw new Error("Not enrolled");
      if (submission) {
        const response = await apiRequest(`/api/training/submissions/${submission.id}`, "PATCH", {
          status: "in_progress",
        });
        return await response.json();
      } else {
        const response = await apiRequest("/api/training/submissions", "POST", {
          enrollmentId: enrollment.id,
          moduleId,
          status: "in_progress",
        });
        return await response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
      toast({ title: "Started", description: "Module marked as in progress." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to start", variant: "destructive" });
    },
  });

  // Save checklist progress (debounced auto-save)
  const saveProgressMutation = useMutation({
    mutationFn: async (progress: ChecklistProgress) => {
      if (!submission) throw new Error("No submission");
      const response = await apiRequest(`/api/training/submissions/${submission.id}`, "PATCH", {
        checklistProgress: progress,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
    },
  });

  const saveProgress = useCallback((newProgress: ChecklistProgress) => {
    setChecklistProgress(newProgress);
    if (submission) {
      saveProgressMutation.mutate(newProgress);
    }
  }, [submission]);

  // Submit for review
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!submission) throw new Error("No submission found — start the module first");
      const response = await apiRequest(`/api/training/submissions/${submission.id}`, "PATCH", {
        status: "submitted",
        submissionNotes,
        checklistProgress,
        submittedAt: new Date().toISOString(),
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
      toast({ title: "Submitted!", description: "Your module has been submitted for review." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to submit", variant: "destructive" });
    },
  });

  function toggleCheckItem(itemId: string) {
    const current = checklistProgress[itemId] || { completed: false, notes: "" };
    const newProgress = {
      ...checklistProgress,
      [itemId]: { ...current, completed: !current.completed },
    };
    saveProgress(newProgress);
  }

  function updateCheckItemNotes(itemId: string, notes: string) {
    const current = checklistProgress[itemId] || { completed: false, notes: "" };
    const newProgress = {
      ...checklistProgress,
      [itemId]: { ...current, notes },
    };
    setChecklistProgress(newProgress);
  }

  function saveCheckItemNotes(itemId: string) {
    if (submission) {
      saveProgressMutation.mutate(checklistProgress);
    }
  }

  if (loadingModule) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-xl font-semibold">Module Not Found</h2>
        <Link href="/training">
          <Button variant="outline"><ChevronLeft className="h-4 w-4 mr-2" />Back to Training</Button>
        </Link>
      </div>
    );
  }

  const canSubmit = submission && (submission.status === "in_progress" || submission.status === "needs_revision");
  const canStart = !submission || submission.status === "not_started";
  const isActive = submission && (submission.status === "in_progress" || submission.status === "needs_revision");

  const checklistItems = module.checklist || [];
  const completedChecks = checklistItems.filter(item => checklistProgress[item.id]?.completed).length;
  const allChecked = checklistItems.length > 0 && completedChecks === checklistItems.length;

  return (
    <div className="space-y-6 max-w-4xl training-ui">
      {/* Header */}
      <div>
        <Link href={module.programId ? `/training/programs/${module.programId}` : "/training"}>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Program
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">{module.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {submission && <StatusBadge status={submission.status} />}
            {canStart && enrollment && (
              <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                Start Module
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resource Links */}
      {module.resourceLinks && module.resourceLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {module.resourceLinks.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                >
                  <ExternalLink className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-base group-hover:text-primary">{link.label}</p>
                    {link.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{link.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="client-story" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="client-story" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Client Story</span>
          </TabsTrigger>
          <TabsTrigger value="assignment" className="gap-1.5">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Assignment</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Checklist</span>
            {checklistItems.length > 0 && (
              <span className="text-xs ml-1 hidden sm:inline">({completedChecks}/{checklistItems.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="deliverables" className="gap-1.5">
            <FileCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Deliverables</span>
          </TabsTrigger>
          <TabsTrigger value="submit" className="gap-1.5">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Submit</span>
          </TabsTrigger>
        </TabsList>

        {/* Client Story Tab */}
        <TabsContent value="client-story">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Client Story
              </CardTitle>
              <CardDescription>Understand the business and their pain points</CardDescription>
            </CardHeader>
            <CardContent>
              {module.clientStory ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                  {formatProseWithBullets(module.clientStory)}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No client story provided for this module.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignment Tab */}
        <TabsContent value="assignment">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Your Assignment
                </CardTitle>
                <CardDescription>High-level goals and key decisions you need to make</CardDescription>
              </CardHeader>
              <CardContent>
                {module.assignment ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {module.assignment}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No assignment details provided for this module.</p>
                )}
              </CardContent>
            </Card>

            {module.testingRequirements && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TestTubes className="h-5 w-5" />
                    Testing Requirements
                  </CardTitle>
                  <CardDescription>Scenarios to verify your work before presentation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                    {formatProseWithBullets(module.testingRequirements)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Checklist
              </CardTitle>
              <CardDescription>
                Track your progress through the key deliverables.
                {checklistItems.length > 0 && (
                  <span className="ml-1 font-medium">{completedChecks} of {checklistItems.length} complete</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checklistItems.length === 0 ? (
                <p className="text-muted-foreground italic">No checklist items for this module.</p>
              ) : (
                <div className="space-y-3">
                  {checklistItems.map((item) => {
                    const progress = checklistProgress[item.id] || { completed: false, notes: "" };
                    const notesExpanded = expandedNotes[item.id] || false;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-4 transition-colors ${progress.completed ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={progress.completed}
                            onCheckedChange={() => {
                              if (isActive) toggleCheckItem(item.id);
                            }}
                            disabled={!isActive}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${progress.completed ? "line-through text-muted-foreground" : ""}`}>
                              {item.text}
                            </p>
                            {/* Notes toggle */}
                            <button
                              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mt-1.5 transition-colors"
                              onClick={() => setExpandedNotes(prev => ({ ...prev, [item.id]: !notesExpanded }))}
                            >
                              <StickyNote className="h-3 w-3" />
                              {progress.notes ? "View notes" : "Add notes"}
                              {notesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                            {notesExpanded && (
                              <div className="mt-2">
                                <Textarea
                                  placeholder="Add your notes, design decisions, or questions..."
                                  value={progress.notes}
                                  onChange={(e) => updateCheckItemNotes(item.id, e.target.value)}
                                  onBlur={() => saveCheckItemNotes(item.id)}
                                  rows={3}
                                  className="text-sm"
                                  disabled={!isActive}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Progress summary */}
                  {allChecked && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="text-base font-medium">All items complete! Head to the Submit tab when ready.</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deliverables Tab */}
        <TabsContent value="deliverables">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Deliverables & Presentation
                </CardTitle>
                <CardDescription>What you need to prepare and present</CardDescription>
              </CardHeader>
              <CardContent>
                {module.deliverablesAndPresentation ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                    {formatProseWithBullets(module.deliverablesAndPresentation)}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">No deliverables specified for this module.</p>
                )}
              </CardContent>
            </Card>

            {module.beReadyToAnswer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Be Ready to Answer
                  </CardTitle>
                  <CardDescription>Questions you should be prepared to discuss</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                    {formatProseWithBullets(module.beReadyToAnswer)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Submit Tab */}
        <TabsContent value="submit">
          <div className="space-y-4">
            {/* Current Status */}
            <Card>
              <CardHeader>
                <CardTitle>Submission Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  {submission ? (
                    <>
                      <StatusBadge status={submission.status} />
                      {submission.submittedAt && (
                        <span className="text-sm text-muted-foreground">
                          Submitted {new Date(submission.submittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {enrollment
                        ? "Click 'Start Module' above to begin working on this module."
                        : "Enroll in the training program first to track your progress."}
                    </p>
                  )}
                </div>

                {/* Checklist summary */}
                {checklistItems.length > 0 && submission && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Checklist progress</span>
                      <span className="font-medium">{completedChecks}/{checklistItems.length} items</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${checklistItems.length > 0 ? (completedChecks / checklistItems.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviewer Feedback */}
            {submission?.reviewerNotes && (
              <Card className={submission.status === "needs_revision" ? "border-destructive" : "border-green-600"}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Reviewer Feedback
                  </CardTitle>
                  {submission.reviewedAt && (
                    <CardDescription>
                      Reviewed on {new Date(submission.reviewedAt).toLocaleDateString()}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                    {formatProseWithBullets(submission.reviewerNotes)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submission Form */}
            {canSubmit && (
              <Card>
                <CardHeader>
                  <CardTitle>Submit for Review</CardTitle>
                  <CardDescription>
                    Add notes about your implementation, design decisions, and anything else the reviewer should know.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Describe your implementation, key design decisions, and any challenges you encountered..."
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    rows={6}
                  />
                  <Button
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || !submissionNotes.trim()}
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Review
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Previous Submission Notes (when already submitted) */}
            {submission?.submissionNotes && !canSubmit && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Submission Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                    {formatProseWithBullets(submission.submissionNotes)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Additional Sections */}
      {module.sections && module.sections.length > 0 && (
        <div className="space-y-4">
          <Separator />
          <h2 className="text-lg font-semibold">Additional Resources</h2>
          {module.sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <Badge variant="outline" className="text-xs">{section.sectionType}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-base">
                  {formatProseWithBullets(section.content)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
