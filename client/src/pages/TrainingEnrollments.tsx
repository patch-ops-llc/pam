import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TrainingProgram, TrainingProgramWithPhases } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, ChevronLeft, GraduationCap, User as UserIcon } from "lucide-react";
import { Link } from "wouter";

type EnrollmentWithUser = {
  id: string;
  userId: string;
  programId: string;
  status: string;
  program: TrainingProgram;
  user: { id: string; firstName: string; lastName: string; email: string };
  submissions: { moduleId: string; status: string }[];
  totalModules: number;
  completedModules: number;
};

export default function TrainingEnrollments() {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const { data: programs, isLoading: loadingPrograms } = useQuery<TrainingProgram[]>({
    queryKey: ["/api/training/programs"],
  });

  const { data: programDetail } = useQuery<TrainingProgramWithPhases>({
    queryKey: ["/api/training/programs", selectedProgramId],
    enabled: !!selectedProgramId,
  });

  const { data: enrollments, isLoading: loadingEnrollments } = useQuery<EnrollmentWithUser[]>({
    queryKey: ["/api/training/admin/programs", selectedProgramId, "enrollments"],
    enabled: !!selectedProgramId,
  });

  if (loadingPrograms) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 training-ui">
      <div>
        <Link href="/training/admin">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Training Admin
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Users className="h-8 w-8" />
          Enrollments
        </h1>
        <p className="text-muted-foreground mt-1 text-base">
          See who is enrolled in each course and where their progress is
        </p>
      </div>

      {/* Program selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Select Program</CardTitle>
          <CardDescription className="text-base">
            Choose a program to view enrolled students and their progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedProgramId ?? ""} onValueChange={(v) => setSelectedProgramId(v || null)}>
            <SelectTrigger className="w-full max-w-md text-base h-11">
              <SelectValue placeholder="Select a program..." />
            </SelectTrigger>
            <SelectContent>
              {programs?.filter(p => p.status === "active").map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-base">
                  {p.title}
                </SelectItem>
              ))}
              {programs?.filter(p => p.status !== "active").map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-base">
                  {p.title} <span className="text-muted-foreground">({p.status})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Enrollments list */}
      {selectedProgramId && (
        <>
          {loadingEnrollments ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : enrollments && enrollments.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Enrolled Students</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {enrollments.map((enrollment) => {
                  const progressPct = enrollment.totalModules > 0
                    ? Math.round((enrollment.completedModules / enrollment.totalModules) * 100)
                    : 0;
                  const displayName = enrollment.user
                    ? `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim() || enrollment.user.email
                    : "Unknown";

                  return (
                    <Card key={enrollment.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary shrink-0">
                              <UserIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-lg truncate">{displayName}</CardTitle>
                              {enrollment.user?.email && (
                                <CardDescription className="text-base truncate">{enrollment.user.email}</CardDescription>
                              )}
                            </div>
                          </div>
                          <Badge variant={
                            enrollment.status === "completed" ? "default" :
                            enrollment.status === "in_progress" ? "secondary" : "outline"
                          }>
                            {enrollment.status === "completed" ? "Completed" :
                             enrollment.status === "in_progress" ? "In Progress" : "Not Started"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between text-base">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{enrollment.completedModules}/{enrollment.totalModules} modules</span>
                          </div>
                          <Progress value={progressPct} className="h-2" />
                          <p className="text-sm text-muted-foreground text-right">{progressPct}% complete</p>
                        </div>

                        {/* Module-level breakdown */}
                        {programDetail && programDetail.phases.length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm font-medium mb-2">Module status</p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {programDetail.phases.map((phase) =>
                                phase.modules.map((mod) => {
                                  const sub = enrollment.submissions?.find((s: { moduleId: string }) => s.moduleId === mod.id);
                                  const status = sub?.status ?? "not_started";
                                  return (
                                    <div key={mod.id} className="flex items-center justify-between text-sm py-1">
                                      <span className="truncate flex-1">{mod.title}</span>
                                      <Badge variant="outline" className="ml-2 text-xs shrink-0">
                                        {status === "passed" ? "Passed" :
                                         status === "submitted" || status === "under_review" ? "Under review" :
                                         status === "in_progress" ? "In progress" :
                                         status === "needs_revision" ? "Revision" : "Not started"}
                                      </Badge>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Enrollments</h3>
                <p className="text-muted-foreground mt-1 text-base">
                  No one has enrolled in this program yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {selectedProgramId === null && programs && programs.length > 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-base">
              Select a program above to view enrollments and progress.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
