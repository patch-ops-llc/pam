import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, FileText, Trash2, Eye, CheckCircle, XCircle, Link as LinkIcon, ExternalLink, Edit } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProposalWithProject } from "@shared/schema";

export default function Proposals() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<ProposalWithProject | null>(null);
  
  const { toast } = useToast();

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<ProposalWithProject[]>({
    queryKey: ["/api/proposals"]
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/proposals/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setDeleteDialogOpen(false);
      setProposalToDelete(null);
      toast({
        title: "Success",
        description: "Proposal deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete proposal",
        variant: "destructive",
      });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" }) => {
      await apiRequest(`/api/proposals/${id}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Success",
        description: "Proposal status updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update proposal status",
        variant: "destructive",
      });
    },
  });

  const filteredProposals = proposals.filter((proposal) =>
    proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    proposal.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteProposal = (proposal: ProposalWithProject) => {
    setProposalToDelete(proposal);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (proposalToDelete) {
      deleteProposalMutation.mutate(proposalToDelete.id);
    }
  };

  const getProposalUrl = (proposal: ProposalWithProject) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/proposals/${proposal.slug}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "URL copied to clipboard",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Proposals</h1>
        <p className="text-muted-foreground">
          Create and manage client proposals with AI-powered scope generation
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Button onClick={() => navigate("/proposals/create")} data-testid="button-new-proposal">
          <Plus className="h-4 w-4 mr-2" />
          New Proposal
        </Button>
      </div>

      {proposalsLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading proposals...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">No proposals found</p>
              <p className="text-muted-foreground">Create your first proposal to get started</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProposals.map((proposal) => (
            <Card key={proposal.id} data-testid={`card-proposal-${proposal.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 flex-wrap" data-testid={`text-proposal-title-${proposal.id}`}>
                      {proposal.title}
                      <Badge variant={proposal.status === "published" ? "default" : "secondary"} data-testid={`badge-status-${proposal.id}`}>
                        {proposal.status === "published" ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Published
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Draft
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-template-${proposal.id}`}>
                        {proposal.templateType}
                      </Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1" data-testid={`text-company-name-${proposal.id}`}>
                      {proposal.companyName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {proposal.status === "draft" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate(`/proposals/edit/${proposal.id}`)}
                        data-testid={`button-edit-${proposal.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => togglePublishMutation.mutate({
                        id: proposal.id,
                        status: proposal.status === "published" ? "draft" : "published"
                      })}
                      data-testid={`button-toggle-publish-${proposal.id}`}
                    >
                      {proposal.status === "published" ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => window.open(getProposalUrl(proposal), '_blank', 'noopener,noreferrer')}
                      data-testid={`button-open-proposal-${proposal.id}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {proposal.status === "published" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => copyToClipboard(getProposalUrl(proposal))}
                        data-testid={`button-copy-link-${proposal.id}`}
                      >
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteProposal(proposal)}
                      data-testid={`button-delete-${proposal.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {proposal.status === "published" && (
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span className="font-mono text-xs" data-testid={`text-url-${proposal.id}`}>
                      {getProposalUrl(proposal)}
                    </span>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{proposalToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
