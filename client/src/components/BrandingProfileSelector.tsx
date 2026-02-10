import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Star, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { BrandingConfig } from "@shared/schema";

interface BrandingProfileSelectorProps {
  selectedProfileId?: string;
  onApplyProfile: (profile: BrandingConfig) => void;
  onClearProfile: () => void;
  disabled?: boolean;
}

export function BrandingProfileSelector({
  selectedProfileId,
  onApplyProfile,
  onClearProfile,
  disabled = false,
}: BrandingProfileSelectorProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | undefined>(selectedProfileId);

  const { data: brandingConfigs = [], isLoading } = useQuery<BrandingConfig[]>({
    queryKey: ["/api/branding-configs"]
  });

  // Sync internal state with prop changes from parent
  useEffect(() => {
    setInternalSelectedId(selectedProfileId);
  }, [selectedProfileId]);

  const handleSelectChange = (value: string) => {
    if (value === "none") {
      setInternalSelectedId(undefined);
      onClearProfile();
      return;
    }

    const profile = brandingConfigs.find(p => p.id === value);
    if (profile) {
      setInternalSelectedId(value);
      onApplyProfile(profile);
    }
  };

  const handleClear = () => {
    setInternalSelectedId(undefined);
    onClearProfile();
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Branding Profile</Label>
        <div className="text-sm text-muted-foreground">Loading profiles...</div>
      </div>
    );
  }

  if (brandingConfigs.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Branding Profile</Label>
        <p className="text-sm text-muted-foreground">
          No branding profiles available. Create one in Settings to reuse across proposals.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="branding-profile-select">Branding Profile (Optional)</Label>
      <div className="flex gap-2">
        <Select
          value={internalSelectedId || "none"}
          onValueChange={handleSelectChange}
          disabled={disabled}
        >
          <SelectTrigger id="branding-profile-select" className="flex-1" data-testid="select-branding-profile">
            <SelectValue placeholder="Select a branding profile..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">None (Manual entry)</span>
            </SelectItem>
            {brandingConfigs.map((config) => (
              <SelectItem key={config.id} value={config.id}>
                <div className="flex items-center gap-2">
                  <span>{config.companyName}</span>
                  {config.isActive && (
                    <Badge variant="secondary" className="ml-2">
                      <Star className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {internalSelectedId && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClear}
            disabled={disabled}
            data-testid="button-clear-branding-profile"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {internalSelectedId && (
        <p className="text-sm text-muted-foreground">
          Selected profile will populate company name, logo, and brand colors
        </p>
      )}
    </div>
  );
}
