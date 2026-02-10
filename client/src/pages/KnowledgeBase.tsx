import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KnowledgeBaseDocument, InsertKnowledgeBaseDocument } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Trash2, Eye, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function KnowledgeBase() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewDocument, setViewDocument] = useState<KnowledgeBaseDocument | null>(null);
  const [editDocument, setEditDocument] = useState<KnowledgeBaseDocument | null>(null);

  const { data: documents, isLoading } = useQuery<KnowledgeBaseDocument[]>({
    queryKey: ["/api/knowledge-base"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertKnowledgeBaseDocument) => {
      const response = await apiRequest("/api/knowledge-base", "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setIsCreateOpen(false);
      toast({
        title: "Success",
        description: "Knowledge base document created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create document",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertKnowledgeBaseDocument> }) => {
      const response = await apiRequest(`/api/knowledge-base/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setEditDocument(null);
      toast({
        title: "Success",
        description: "Document updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/knowledge-base/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Knowledge Base</h1>
          <p className="text-muted-foreground">Manage historical proposals to improve AI scope generation</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-document">
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Knowledge Base Document</DialogTitle>
              <DialogDescription>
                Upload a historical proposal to help the AI generate better scopes
              </DialogDescription>
            </DialogHeader>
            <CreateDocumentForm
              onSubmit={(data) => createMutation.mutate(data)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">Loading documents...</div>
      ) : !documents || documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">No documents yet</h3>
            <p className="text-muted-foreground mb-4">
              Add historical proposals to build your knowledge base
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-add-first">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <Card key={doc.id} className="hover-elevate" data-testid={`card-document-${doc.id}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {doc.title}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Company: {doc.companyName}
                      {doc.projectType && ` • Type: ${doc.projectType}`}
                    </CardDescription>
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {doc.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" data-testid={`badge-tag-${index}`}>
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setViewDocument(doc)}
                      data-testid={`button-view-${doc.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditDocument(doc)}
                      data-testid={`button-edit-${doc.id}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this document?")) {
                          deleteMutation.mutate(doc.id);
                        }
                      }}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {viewDocument && (
        <Dialog open={!!viewDocument} onOpenChange={() => setViewDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{viewDocument.title}</DialogTitle>
              <DialogDescription>
                {viewDocument.companyName}
                {viewDocument.projectType && ` • ${viewDocument.projectType}`}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: viewDocument.htmlContent }} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editDocument && (
        <Dialog open={!!editDocument} onOpenChange={() => setEditDocument(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Document</DialogTitle>
              <DialogDescription>Update document metadata and content</DialogDescription>
            </DialogHeader>
            <EditDocumentForm
              document={editDocument}
              onSubmit={(data) => updateMutation.mutate({ id: editDocument.id, data })}
              isPending={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateDocumentForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: InsertKnowledgeBaseDocument) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    title: "",
    companyName: "",
    projectType: "",
    htmlContent: "",
    tags: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const extractedText = formData.htmlContent
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    onSubmit({
      title: formData.title,
      companyName: formData.companyName,
      projectType: formData.projectType || null,
      htmlContent: formData.htmlContent,
      extractedText,
      tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          data-testid="input-title"
        />
      </div>

      <div>
        <Label htmlFor="companyName">Company Name *</Label>
        <Input
          id="companyName"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          required
          data-testid="input-company"
        />
      </div>

      <div>
        <Label htmlFor="projectType">Project Type</Label>
        <Input
          id="projectType"
          value={formData.projectType}
          onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
          placeholder="e.g., CRM Implementation, Integration, Marketing Hub"
          data-testid="input-project-type"
        />
      </div>

      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="e.g., hubspot, salesforce, api-integration"
          data-testid="input-tags"
        />
      </div>

      <div>
        <Label htmlFor="htmlContent">HTML Content *</Label>
        <Textarea
          id="htmlContent"
          value={formData.htmlContent}
          onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
          rows={12}
          required
          placeholder="Paste the HTML content of the historical proposal here..."
          data-testid="textarea-html"
        />
      </div>

      <Button type="submit" disabled={isPending || !formData.htmlContent} data-testid="button-submit">
        {isPending ? "Creating..." : "Create Document"}
      </Button>
    </form>
  );
}

function EditDocumentForm({
  document,
  onSubmit,
  isPending,
}: {
  document: KnowledgeBaseDocument;
  onSubmit: (data: Partial<InsertKnowledgeBaseDocument>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    title: document.title,
    companyName: document.companyName,
    projectType: document.projectType || "",
    htmlContent: document.htmlContent,
    tags: document.tags ? document.tags.join(", ") : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const extractedText = formData.htmlContent
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    onSubmit({
      title: formData.title,
      companyName: formData.companyName,
      projectType: formData.projectType || null,
      htmlContent: formData.htmlContent,
      extractedText,
      tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-title">Title *</Label>
        <Input
          id="edit-title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          data-testid="input-edit-title"
        />
      </div>

      <div>
        <Label htmlFor="edit-companyName">Company Name *</Label>
        <Input
          id="edit-companyName"
          value={formData.companyName}
          onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
          required
          data-testid="input-edit-company"
        />
      </div>

      <div>
        <Label htmlFor="edit-projectType">Project Type</Label>
        <Input
          id="edit-projectType"
          value={formData.projectType}
          onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
          placeholder="e.g., CRM Implementation, Integration, Marketing Hub"
          data-testid="input-edit-project-type"
        />
      </div>

      <div>
        <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
        <Input
          id="edit-tags"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="e.g., hubspot, salesforce, api-integration"
          data-testid="input-edit-tags"
        />
      </div>

      <div>
        <Label htmlFor="edit-htmlContent">HTML Content *</Label>
        <Textarea
          id="edit-htmlContent"
          value={formData.htmlContent}
          onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
          rows={12}
          required
          data-testid="textarea-edit-html"
        />
      </div>

      <Button type="submit" disabled={isPending} data-testid="button-submit-edit">
        {isPending ? "Updating..." : "Update Document"}
      </Button>
    </form>
  );
}
