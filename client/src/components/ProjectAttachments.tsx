import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "./ObjectUploader";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { FileText, Download, Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UploadResult } from "@uppy/core";
import type { ProjectAttachment } from "@shared/schema";
import { format } from "date-fns";

interface ProjectAttachmentsProps {
  projectId: string;
  compact?: boolean;
}

export function ProjectAttachments({ projectId, compact = false }: ProjectAttachmentsProps) {
  const { toast } = useToast();

  const { data: attachments = [], isLoading } = useQuery<ProjectAttachment[]>({
    queryKey: ["/api/projects", projectId, "attachments"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/projects/${projectId}/attachments/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "attachments"] });
      toast({ title: "Attachment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete attachment", variant: "destructive" });
    },
  });

  const handleGetUploadParameters = async () => {
    const response = await fetch("/api/objects/upload", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = async (result: UploadResult) => {
    if (result.successful.length === 0) return;

    try {
      // Upload all successful files
      await Promise.all(
        result.successful.map(async (file) => {
          const fileName = file.name;
          const fileSize = file.size || 0;
          const fileType = file.type || "application/octet-stream";
          // Use uploadURL which will be normalized by the backend to /objects/ format
          const objectPath = file.uploadURL;

          await apiRequest(`/api/projects/${projectId}/attachments`, "POST", {
            fileName,
            fileSize,
            fileType,
            objectPath,
          });
        })
      );

      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "attachments"] });
      
      const count = result.successful.length;
      toast({ 
        title: count === 1 
          ? "File uploaded successfully" 
          : `${count} files uploaded successfully` 
      });
    } catch (error) {
      console.error("Failed to save attachment:", error);
      toast({ title: "Failed to save attachments", variant: "destructive" });
    }
  };

  const handleDownload = (attachment: ProjectAttachment) => {
    window.open(attachment.objectPath, "_blank");
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this attachment?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            <span>Attachments {attachments.length > 0 && `(${attachments.length})`}</span>
          </div>
          <ObjectUploader
            maxNumberOfFiles={5}
            maxFileSize={52428800} // 50MB
            onGetUploadParameters={handleGetUploadParameters}
            onComplete={handleUploadComplete}
          >
            <Upload className="h-3 w-3" />
          </ObjectUploader>
        </div>

        {attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group flex items-center justify-between text-xs p-2 rounded bg-muted/30 hover-elevate"
                data-testid={`attachment-${attachment.id}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium truncate" data-testid={`text-filename-${attachment.id}`}>
                    {attachment.fileName}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDownload(attachment)}
                    data-testid={`button-download-${attachment.id}`}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => handleDelete(attachment.id)}
                    data-testid={`button-delete-${attachment.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Attachments</h4>
        <ObjectUploader
          maxNumberOfFiles={5}
          maxFileSize={52428800} // 50MB
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Files
        </ObjectUploader>
      </div>

      {attachments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No attachments yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <Card key={attachment.id} className="hover-elevate" data-testid={`attachment-${attachment.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-filename-${attachment.id}`}>
                        {attachment.fileName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatFileSize(attachment.fileSize)}</span>
                        <span>•</span>
                        <span>{format(new Date(attachment.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {attachment.fileType.split("/")[1]?.toUpperCase() || "FILE"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownload(attachment)}
                      data-testid={`button-download-${attachment.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(attachment.id)}
                      data-testid={`button-delete-${attachment.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
