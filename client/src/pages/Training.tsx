import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingProgram, TrainingEnrollmentWithProgress } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, BookOpen, CheckCircle2, ArrowRight, MoreVertical, LogOut } from "lucide-react";
import { Link } from "wouter";

export default function Training() {
  const { toast } = useToast();

  const { data: programs, isLoading: loadingPrograms } = useQuery<TrainingProgram[]>({
    queryKey: ["/api/training/programs"],
  });

  const { data: enrollments, isLoading: loadingEnrollments } = useQuery<TrainingEnrollmentWithProgress[]>({
    queryKey: ["/api/training/enrollments"],
  });

  const enrollMutation = useMutation({
    mutationFn: async (programId: string) => {
      const response = await apiRequest("/api/training/enrollments", "POST", { programId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
      toast({ title: "Enrolled!", description: "You've been enrolled in the training program." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enroll",
        variant: "destructive",
      });
    },
  });

  const unenrollMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const response = await apiRequest(`/api/training/enrollments/${enrollmentId}`, "DELETE");
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to unenroll");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/enrollments"] });
      toast({ title: "Unenrolled", description: "You've been removed from the training program." });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unenroll",
        variant: "destructive",
      });
    },
  });

  const enrolledProgramIds = new Set(enrollments?.map(e => e.programId) || []);

  const activePrograms = programs?.filter(p => p.status === "active") || [];

  if (loadingPrograms || loadingEnrollments) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 training-ui">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          Training
        </h1>
        <p className="text-muted-foreground mt-1 text-base">
          Build your skills through hands-on training programs
        </p>
      </div>

      {/* My Enrollments */}
      {enrollments && enrollments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My Programs</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => {
              const progressPct = enrollment.totalModules > 0
                ? Math.round((enrollment.completedModules / enrollment.totalModules) * 100)
                : 0;

              return (
                <Card key={enrollment.id} className="h-full flex flex-col cursor-pointer hover:shadow-md transition-shadow">
                  <Link href={`/training/programs/${enrollment.programId}`} className="flex-1 flex flex-col min-w-0">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xl">{enrollment.program.title}</CardTitle>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <Badge variant={
                            enrollment.status === "completed" ? "default" :
                            enrollment.status === "in_progress" ? "secondary" : "outline"
                          }>
                            {enrollment.status === "completed" ? "Completed" :
                             enrollment.status === "in_progress" ? "In Progress" : "Not Started"}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.preventDefault()}
                                title="Actions (Leave program)"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (confirm("Leave this training program? Your progress will be lost.")) {
                                    unenrollMutation.mutate(enrollment.id);
                                  }
                                }}
                                disabled={unenrollMutation.isPending}
                              >
                                <LogOut className="h-4 w-4 mr-2" />
                                Unenroll
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {enrollment.program.description && (
                        <CardDescription className="line-clamp-2">
                          {enrollment.program.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-base">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{enrollment.completedModules}/{enrollment.totalModules} modules</span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">{progressPct}% complete</p>
                          <button
                            type="button"
                            className="text-sm text-destructive hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm("Leave this training program? Your progress will be lost.")) {
                                unenrollMutation.mutate(enrollment.id);
                              }
                            }}
                          >
                            Leave program
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Programs */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {enrollments && enrollments.length > 0 ? "Available Programs" : "Training Programs"}
        </h2>
        {activePrograms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-base font-medium">No Training Programs Available</h3>
              <p className="text-muted-foreground mt-1 text-base">
                Training programs will appear here once they are created by an administrator.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activePrograms
              .filter(p => !enrolledProgramIds.has(p.id))
              .map((program) => (
                <Card key={program.id} className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{program.title}</CardTitle>
                    <CardDescription className="text-base">{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end gap-3">
                    {program.prerequisites && (
                      <p className="text-sm text-muted-foreground">
                        Prerequisites: {program.prerequisites}
                      </p>
                    )}
                    <Button
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.preventDefault();
                        enrollMutation.mutate(program.id);
                      }}
                      disabled={enrollMutation.isPending}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Enroll Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            {activePrograms.filter(p => !enrolledProgramIds.has(p.id)).length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-8 text-center">
                    <div className="flex items-center gap-2 text-muted-foreground text-base">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>You're enrolled in all available programs</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
