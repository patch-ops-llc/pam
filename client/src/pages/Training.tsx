import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingProgram, TrainingEnrollmentWithProgress } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, BookOpen, CheckCircle2, ArrowRight } from "lucide-react";
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <GraduationCap className="h-8 w-8" />
          Training
        </h1>
        <p className="text-muted-foreground mt-1">
          Build your skills through hands-on training programs
        </p>
      </div>

      {/* My Enrollments */}
      {enrollments && enrollments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">My Programs</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enrollment) => {
              const progressPct = enrollment.totalModules > 0
                ? Math.round((enrollment.completedModules / enrollment.totalModules) * 100)
                : 0;

              return (
                <Link key={enrollment.id} href={`/training/programs/${enrollment.programId}`}>
                  <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{enrollment.program.title}</CardTitle>
                        <Badge variant={
                          enrollment.status === "completed" ? "default" :
                          enrollment.status === "in_progress" ? "secondary" : "outline"
                        }>
                          {enrollment.status === "completed" ? "Completed" :
                           enrollment.status === "in_progress" ? "In Progress" : "Not Started"}
                        </Badge>
                      </div>
                      {enrollment.program.description && (
                        <CardDescription className="line-clamp-2">
                          {enrollment.program.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{enrollment.completedModules}/{enrollment.totalModules} modules</span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{progressPct}% complete</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Programs */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          {enrollments && enrollments.length > 0 ? "Available Programs" : "Training Programs"}
        </h2>
        {activePrograms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No Training Programs Available</h3>
              <p className="text-muted-foreground mt-1">
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
                    <CardDescription>{program.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-end gap-3">
                    {program.prerequisites && (
                      <p className="text-xs text-muted-foreground">
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
                  <div className="flex items-center gap-2 text-muted-foreground">
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
