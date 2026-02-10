import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LogoUploadProps {
  currentLogoUrl?: string;
  onLogoChange: (logoUrl: string) => void;
  disabled?: boolean;
}

export function LogoUpload({ currentLogoUrl, onLogoChange, disabled = false }: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentLogoUrl);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      console.log("Step 1: Requesting upload URL...");
      const uploadResponse = await fetch("/api/logos/upload", {
        method: "POST",
        credentials: "include",
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Failed to get upload URL:", uploadResponse.status, errorText);
        throw new Error(`Failed to get upload URL: ${uploadResponse.status}`);
      }
      
      const { uploadURL, publicURL } = await uploadResponse.json();
      console.log("Step 2: Got upload URL, uploading file...", { publicURL });

      const fileUploadResponse = await fetch(uploadURL, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!fileUploadResponse.ok) {
        const errorText = await fileUploadResponse.text();
        console.error("Failed to upload file to storage:", fileUploadResponse.status, errorText);
        throw new Error(`Failed to upload file: ${fileUploadResponse.status}`);
      }

      console.log("Step 3: File uploaded, confirming...");
      const confirmResponse = await fetch("/api/logos/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ publicURL }),
      });

      if (!confirmResponse.ok) {
        const errorText = await confirmResponse.text();
        console.error("Failed to confirm upload:", confirmResponse.status, errorText);
        throw new Error(`Failed to confirm upload: ${confirmResponse.status}`);
      }

      console.log("Step 4: Upload confirmed successfully!");

      setPreviewUrl(publicURL);
      onLogoChange(publicURL);

      toast({
        title: "Logo uploaded",
        description: "Your logo has been uploaded successfully",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(undefined);
    onLogoChange("");
  };

  return (
    <div className="space-y-4">
      <Label>Logo</Label>
      
      {previewUrl ? (
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-32 h-32 border rounded-md overflow-hidden bg-muted flex items-center justify-center">
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              data-testid="button-remove-logo"
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={disabled || isUploading}
              className="hidden"
              id="logo-replace-input"
              data-testid="input-replace-logo"
            />
            <Label htmlFor="logo-replace-input">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isUploading}
                asChild
                data-testid="button-replace-logo"
              >
                <span>
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Replace
                    </>
                  )}
                </span>
              </Button>
            </Label>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-md p-6 text-center">
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
            className="hidden"
            id="logo-upload-input"
            data-testid="input-upload-logo"
          />
          <Label htmlFor="logo-upload-input">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || isUploading}
              asChild
              data-testid="button-upload-logo"
            >
              <span>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </>
                )}
              </span>
            </Button>
          </Label>
          <p className="text-sm text-muted-foreground mt-2">
            PNG, JPG, or SVG (max 5MB)
          </p>
        </div>
      )}
    </div>
  );
}
