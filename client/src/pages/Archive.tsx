import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { ChevronDown, ChevronRight, Archive as ArchiveIcon, Folder, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { ProjectWithTeamAndRelations, AccountWithAgency } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Archive() {
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: allProjects = [], isLoading: projectsLoading } = useQuery<ProjectWithTeamAndRelations[]>({
    queryKey: ["/api/projects/with-team"]
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<AccountWithAgency[]>({
    queryKey: ["/api/accounts"]
  });

  const restoreProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest(`/api/projects/${projectId}/restore`, "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-team"] });
      toast({
        title: "Project restored",
        description: "The project has been restored to active status.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to restore project.",
        variant: "destructive",
      });
    },
  });

  const hardDeleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiRequest(`/api/projects/${projectId}/hard`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-team"] });
      toast({
        title: "Project deleted",
        description: "The project has been permanently deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project.",
        variant: "destructive",
      });
    },
  });

  // Filter to show only completed/archived projects
  const archivedProjects = allProjects.filter(p => p.status === 'completed' || p.stage === 'complete');

  // Group archived projects by account
  const projectsByAccount = archivedProjects.reduce((acc, project) => {
    const accountId = project.accountId;
    if (!acc[accountId]) {
      acc[accountId] = [];
    }
    acc[accountId].push(project);
    return acc;
  }, {} as Record<string, ProjectWithTeamAndRelations[]>);

  function toggleAccount(accountId: string) {
    const newOpen = new Set(openAccounts);
    if (newOpen.has(accountId)) {
      newOpen.delete(accountId);
    } else {
      newOpen.add(accountId);
    }
    setOpenAccounts(newOpen);
  }

  // Get accounts that have archived content
  const accountsWithArchived = accounts.filter(
    account => projectsByAccount[account.id]?.length > 0
  );

  const isLoading = projectsLoading || accountsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archive</h1>
          <p className="text-muted-foreground">
            Completed and archived projects
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">Loading archived items...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ArchiveIcon className="h-8 w-8" />
          Archive
        </h1>
        <p className="text-muted-foreground">
          Completed and archived projects
        </p>
      </div>

      {accountsWithArchived.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <ArchiveIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No archived items</h3>
              <p className="text-muted-foreground max-w-sm">
                Projects marked as completed will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accountsWithArchived.map((account) => (
            <Card key={account.id}>
              <Collapsible
                open={openAccounts.has(account.id)}
                onOpenChange={() => toggleAccount(account.id)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover-elevate">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {openAccounts.has(account.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <Folder className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle>{account.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{account.agency.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {projectsByAccount[account.id]?.length || 0} archived
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {/* Projects */}
                    {projectsByAccount[account.id]?.map((project) => (
                      <div
                        key={project.id}
                        className="border rounded-lg p-4 space-y-3"
                        data-testid={`archived-project-${project.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Folder className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <h3 className="font-medium">{project.name}</h3>
                              {project.description && (
                                <p className="text-sm text-muted-foreground">{project.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{project.status}</Badge>
                            <Badge variant="outline">{project.stage}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => restoreProjectMutation.mutate(project.id)}
                              disabled={restoreProjectMutation.isPending}
                              data-testid={`button-restore-project-${project.id}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm(`Are you sure you want to permanently delete "${project.name}"? This cannot be undone.`)) {
                                  hardDeleteProjectMutation.mutate(project.id);
                                }
                              }}
                              disabled={hardDeleteProjectMutation.isPending}
                              data-testid={`button-delete-project-${project.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {project.startDate && (
                            <span>
                              {format(new Date(project.startDate), 'MMM d, yyyy')}
                              {project.endDate && ` - ${format(new Date(project.endDate), 'MMM d, yyyy')}`}
                            </span>
                          )}
                          {project.estimatedHours && (
                            <span>{project.estimatedHours}h estimated</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
