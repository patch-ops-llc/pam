import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, FileText, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { BrandingConfig } from "@shared/schema";

interface ConversionResult {
  htmlContent: string;
  metadata: {
    title?: string;
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    engagementTimeline?: string;
  };
}

export default function DocumentProposalIngestion() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBrandingId, setSelectedBrandingId] = useState<string>("");
  
  const { data: brandingProfiles = [] } = useQuery<BrandingConfig[]>({
    queryKey: ["/api/branding-configs"],
  });

  const selectedBranding = brandingProfiles.find(b => b.id === selectedBrandingId);

  const convertMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      if (inputMode === "upload" && selectedFile) {
        formData.append("file", selectedFile);
      } else if (inputMode === "paste" && textContent) {
        formData.append("textContent", textContent);
      }
      
      if (selectedBranding) {
        formData.append("brandPrimaryColor", selectedBranding.primaryColor || "#2563eb");
        formData.append("brandSecondaryColor", selectedBranding.secondaryColor || "#64748b");
      }
      
      const response = await fetch("/api/ai/document-to-proposal", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to convert document");
      }
      
      return response.json() as Promise<ConversionResult>;
    },
    onSuccess: (result) => {
      const state: Record<string, string | boolean> = {
        prefilled: true,
        htmlContent: result.htmlContent,
        title: result.metadata.title || "",
        companyName: result.metadata.companyName || "",
        contactName: result.metadata.contactName || "",
        contactEmail: result.metadata.contactEmail || "",
        engagementTimeline: result.metadata.engagementTimeline || "",
      };
      
      if (selectedBranding) {
        state.brandingProfileId = selectedBrandingId;
        state.brandingCompanyName = selectedBranding.companyName;
        state.brandingLogoUrl = selectedBranding.logoUrl || "";
        state.brandingPrimaryColor = selectedBranding.primaryColor;
        state.brandingSecondaryColor = selectedBranding.secondaryColor;
      }
      
      sessionStorage.setItem("proposalPrefill", JSON.stringify(state));
      
      toast({
        title: "Document converted",
        description: "Your proposal is ready for editing in the visual editor.",
      });
      
      navigate("/proposals/create/visual");
    },
    onError: (error) => {
      toast({
        title: "Conversion failed",
        description: error instanceof Error ? error.message : "Failed to convert document",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Unsupported file type",
          description: "Please upload a PDF, Word document (.docx), or plain text file.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const canConvert = (inputMode === "paste" && textContent.trim().length > 0) ||
                     (inputMode === "upload" && selectedFile !== null);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/proposals/create")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Create from Document
          </h1>
          <p className="text-muted-foreground">
            Upload or paste your document content to create a proposal
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Document Content</CardTitle>
            <CardDescription>
              Choose how to provide your document content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={inputMode === "paste" ? "default" : "outline"}
                onClick={() => setInputMode("paste")}
                className="flex-1"
                data-testid="button-mode-paste"
              >
                <FileText className="h-4 w-4 mr-2" />
                Paste Text
              </Button>
              <Button
                variant={inputMode === "upload" ? "default" : "outline"}
                onClick={() => setInputMode("upload")}
                className="flex-1"
                data-testid="button-mode-upload"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </div>

            {inputMode === "paste" ? (
              <div className="space-y-2">
                <Label htmlFor="textContent">Paste your document content</Label>
                <Textarea
                  id="textContent"
                  placeholder="Paste your proposal content here..."
                  className="min-h-[300px] font-mono text-sm"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  data-testid="textarea-content"
                />
                <p className="text-xs text-muted-foreground">
                  {textContent.length > 0 ? `${textContent.length.toLocaleString()} characters` : "No content yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-file"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={handleFileSelect}
                    data-testid="input-file"
                  />
                  
                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <Check className="h-8 w-8" />
                      </div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        data-testid="button-remove-file"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-muted-foreground">
                        PDF, Word (.docx), or plain text files up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Select a branding profile to apply to your proposal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="branding">Branding Profile (Optional)</Label>
                <Select value={selectedBrandingId} onValueChange={setSelectedBrandingId}>
                  <SelectTrigger data-testid="select-branding">
                    <SelectValue placeholder="Select a branding profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    {brandingProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedBranding && (
                <div className="p-4 rounded-lg border bg-muted/50">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div className="flex gap-2 items-center">
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: selectedBranding.primaryColor || "#2563eb" }}
                    />
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: selectedBranding.secondaryColor || "#64748b" }}
                    />
                    <span className="text-sm text-muted-foreground ml-2">
                      {selectedBranding.companyName}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="text-sm text-muted-foreground space-y-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</span>
                  <span>AI extracts and structures the content from your document</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</span>
                  <span>Your selected branding is applied to the proposal</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</span>
                  <span>The visual editor opens so you can review and refine the content</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">4</span>
                  <span>Save as draft or publish to share with your client</span>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            disabled={!canConvert || convertMutation.isPending}
            onClick={() => convertMutation.mutate()}
            data-testid="button-convert"
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Converting Document...
              </>
            ) : (
              "Convert and Open Editor"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
