import { useState } from "react";
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
} from "lucide-react";
import { Link, useParams } from "wouter";

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

export default function TrainingModule() {
  const params = useParams<{ id: string }>();
  const moduleId = params.id;
  const { toast } = useToast();
  const [submissionNotes, setSubmissionNotes] = useState("");

  const { data: module, isLoading: loadingModule } = useQuery<TrainingModuleWithSections>({
    queryKey: ["/api/training/modules", moduleId],
    enabled: !!moduleId,
  });

  const { data: enrollments } = useQuery<TrainingEnrollmentWithProgress[]>({
    queryKey: ["/api/training/enrollments"],
  });

  // Find the enrollment for this module's program
  const enrollment = enrollments?.find(e =>
    e.submissions?.some(s => s.moduleId === moduleId) ||
    e.program // we'll match below
  );

  // Find the specific submission for this module
  const submission = enrollment?.submissions?.find(s => s.moduleId === moduleId);

  // Mark as in progress
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!enrollment) throw new Error("Not enrolled");
      if (submission) {
        // Update existing
        const response = await apiRequest(`/api/training/submissions/${submission.id}`, "PATCH", {
          status: "in_progress",
        });
        return await response.json();
      } else {
        // Create new
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
  });

  // Submit for review
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!submission) throw new Error("No submission found");
      const response = await apiRequest(`/api/training/submissions/${submission.id}`, "PATCH", {
        status: "submitted",
        submissionNotes,
        submittedAt: new Date().toISOString(),
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
      toast({ title: "Submitted!", description: "Your module has been submitted for review." });
    },
  });

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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <Link href="/training">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{module.title}</h1>
            {module.estimatedHours && (
              <p className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Estimated {module.estimatedHours} hours
              </p>
            )}
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
          <TabsTrigger value="testing" className="gap-1.5">
            <TestTubes className="h-4 w-4" />
            <span className="hidden sm:inline">Testing</span>
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
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {module.clientStory}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No client story provided for this module.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignment Tab */}
        <TabsContent value="assignment">
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
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTubes className="h-5 w-5" />
                Testing Requirements
              </CardTitle>
              <CardDescription>Scenarios to verify your work before presentation</CardDescription>
            </CardHeader>
            <CardContent>
              {module.testingRequirements ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {module.testingRequirements}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No testing requirements provided for this module.</p>
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
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {module.deliverablesAndPresentation}
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
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {module.beReadyToAnswer}
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
                        ? "Click 'Start Module' to begin working on this module."
                        : "Enroll in the training program to track your progress."}
                    </p>
                  )}
                </div>
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
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {submission.reviewerNotes}
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

            {/* Previous Submission Notes */}
            {submission?.submissionNotes && submission.status !== "in_progress" && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Submission Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {submission.submissionNotes}
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
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {section.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
