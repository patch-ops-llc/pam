import { useQuery } from "@tanstack/react-query";
import type {
  TrainingProgramWithPhases,
  TrainingEnrollmentWithProgress,
  TrainingModuleSubmission,
} from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GraduationCap,
  Clock,
  BookOpen,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Pencil,
  Send,
  AlertCircle,
} from "lucide-react";
import { Link, useParams } from "wouter";

function getModuleStatusBadge(submission?: TrainingModuleSubmission) {
  if (!submission || submission.status === "not_started") {
    return <Badge variant="outline" className="gap-1"><Circle className="h-3 w-3" />Not Started</Badge>;
  }
  switch (submission.status) {
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
      return <Badge variant="outline">{submission.status}</Badge>;
  }
}

export default function TrainingProgram() {
  const params = useParams<{ id: string }>();
  const programId = params.id;

  const { data: program, isLoading: loadingProgram } = useQuery<TrainingProgramWithPhases>({
    queryKey: ["/api/training/programs", programId],
    enabled: !!programId,
  });

  const { data: enrollments } = useQuery<TrainingEnrollmentWithProgress[]>({
    queryKey: ["/api/training/enrollments"],
  });

  const enrollment = enrollments?.find(e => e.programId === programId);
  const submissionsByModule = new Map<string, TrainingModuleSubmission>();
  enrollment?.submissions?.forEach(s => submissionsByModule.set(s.moduleId, s));

  if (loadingProgram) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <h2 className="text-xl font-semibold">Program Not Found</h2>
        <Link href="/training">
          <Button variant="outline"><ChevronLeft className="h-4 w-4 mr-2" />Back to Training</Button>
        </Link>
      </div>
    );
  }

  const totalModules = program.phases.reduce((sum, p) => sum + p.modules.length, 0);
  const completedModules = Array.from(submissionsByModule.values()).filter(s => s.status === "passed").length;
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/training">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Training
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GraduationCap className="h-8 w-8" />
            {program.title}
          </h1>
          {program.description && (
            <p className="text-muted-foreground max-w-3xl">{program.description}</p>
          )}
        </div>
      </div>

      {/* Program Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Modules</p>
                <p className="text-2xl font-bold">{totalModules}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{completedModules}/{totalModules}</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{progressPct}% complete</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Philosophy & Prerequisites */}
      {(program.philosophy || program.prerequisites) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {program.philosophy && (
              <div>
                <h3 className="font-semibold mb-1">Philosophy</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{program.philosophy}</p>
              </div>
            )}
            {program.prerequisites && (
              <div>
                <h3 className="font-semibold mb-1">Prerequisites</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{program.prerequisites}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Phases & Modules */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Curriculum</h2>
        <Accordion type="multiple" defaultValue={program.phases.map(p => p.id)} className="space-y-4">
          {program.phases.map((phase, phaseIdx) => {
            const phaseCompleted = phase.modules.every(m => {
              const sub = submissionsByModule.get(m.id);
              return sub?.status === "passed";
            });
            const phaseModulesCompleted = phase.modules.filter(m => {
              const sub = submissionsByModule.get(m.id);
              return sub?.status === "passed";
            }).length;

            return (
              <AccordionItem key={phase.id} value={phase.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {phaseIdx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{phase.title}</span>
                        {phaseCompleted && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{phaseModulesCompleted}/{phase.modules.length} modules</span>
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pb-2">
                    {phase.description && (
                      <p className="text-sm text-muted-foreground mb-3">{phase.description}</p>
                    )}
                    {phase.modules.map((mod, modIdx) => {
                      const submission = submissionsByModule.get(mod.id);
                      return (
                        <Link key={mod.id} href={`/training/modules/${mod.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors">
                            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-muted-foreground font-medium text-xs shrink-0">
                              {modIdx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{mod.title}</p>
                            </div>
                            {getModuleStatusBadge(submission)}
                          </div>
                        </Link>
                      );
                    })}
                    {/* Phase Milestone Review */}
                    {phase.milestoneReview && (
                      <Card className="mt-3 border-dashed">
                        <CardContent className="pt-4">
                          <h4 className="text-sm font-semibold mb-1">Milestone Review</h4>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{phase.milestoneReview}</p>
                        </CardContent>
                      </Card>
                    )}
                    {phase.passCriteria && (
                      <Card className="border-dashed">
                        <CardContent className="pt-4">
                          <h4 className="text-sm font-semibold mb-1">Pass Criteria</h4>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{phase.passCriteria}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
