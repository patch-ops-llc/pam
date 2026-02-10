import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Calendar, Mail, User, Check, Download, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProposalWithProject } from "@shared/schema";
import patchOpsLogo from "@assets/patchops-brandmark_1760456303725.jpg";

export default function ProposalView() {
  const params = useParams<{ slug: string }>();
  const { slug } = params;
  const { toast } = useToast();
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);

  const { data: proposal, isLoading, error } = useQuery<ProposalWithProject>({
    queryKey: ["/api/proposals/view", slug],
    queryFn: async () => {
      const response = await fetch(`/api/proposals/view/${slug}`);
      if (!response.ok) {
        throw new Error("Proposal not found");
      }
      return response.json();
    },
  });

  // Load custom Google Font dynamically
  useEffect(() => {
    if (proposal?.brandFont && proposal.brandFont !== "Inter") {
      const fontName = proposal.brandFont.replace(/ /g, '+');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
      link.id = 'proposal-custom-font';
      document.head.appendChild(link);

      return () => {
        const existingLink = document.getElementById('proposal-custom-font');
        if (existingLink) {
          existingLink.remove();
        }
      };
    }
  }, [proposal?.brandFont]);

  const acceptProposalMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/proposals/${proposal?.id}/accept`, "POST", {
        contactEmail: proposal?.contactEmail,
        contactName: proposal?.contactName,
        companyName: proposal?.companyName,
        title: proposal?.title,
      });
    },
    onSuccess: () => {
      setAcceptDialogOpen(false);
      toast({
        title: "Proposal Accepted",
        description: "Thank you! We've sent a notification to our team and will be in touch shortly.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to accept proposal. Please try again or contact us directly.",
        variant: "destructive",
      });
    },
  });

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleBookMeeting = () => {
    window.open("https://app.onecal.io/b/zach-west/meet-with-zach", "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen p-8 max-w-6xl mx-auto">
        <Alert variant="destructive">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            Proposal not found. Please check the URL or contact your account manager.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Default PatchOps logo
  const whiteLabelLogo = proposal.whiteLabelLogoUrl || patchOpsLogo;
  
  // Custom branding - validate colors match hex pattern for safety
  const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
  const brandFont = proposal.brandFont || "Inter";
  const brandPrimaryColor = (proposal.brandPrimaryColor && hexColorRegex.test(proposal.brandPrimaryColor)) 
    ? proposal.brandPrimaryColor : "#2563eb";
  const brandSecondaryColor = (proposal.brandSecondaryColor && hexColorRegex.test(proposal.brandSecondaryColor)) 
    ? proposal.brandSecondaryColor : "#64748b";
  const brandAccentColor = (proposal.brandAccentColor && hexColorRegex.test(proposal.brandAccentColor)) 
    ? proposal.brandAccentColor : "#f59e0b";

  // Convert hex to rgba for transparency effects
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div className="min-h-screen bg-white pb-24" style={{ 
      fontFamily: brandFont,
      ['--brand-primary' as any]: brandPrimaryColor,
      ['--brand-secondary' as any]: brandSecondaryColor,
      ['--brand-accent' as any]: brandAccentColor,
      ['--brand-font' as any]: brandFont,
    }}>
      <style>{`
        .proposal-badge {
          background-color: ${hexToRgba(brandPrimaryColor, 0.15)};
          color: ${brandPrimaryColor};
          border-color: ${hexToRgba(brandPrimaryColor, 0.3)};
        }
        .proposal-prose h1, .proposal-prose h2, .proposal-prose h3 {
          color: ${brandPrimaryColor};
        }
        .proposal-prose a {
          color: ${brandAccentColor};
        }
        .proposal-prose strong {
          color: ${brandPrimaryColor};
        }
        .proposal-prose p {
          color: #1f2937;
        }
        @media print {
          /* Hide action bar */
          .fixed {
            display: none !important;
          }
          
          /* Clean white background */
          body, .min-h-screen {
            background: white !important;
            padding-bottom: 0 !important;
          }
          
          /* Better page layout */
          @page {
            margin: 0.75in;
            size: letter;
          }
          
          /* Optimize container for print */
          .max-w-6xl {
            max-width: 100% !important;
            padding: 0 !important;
          }
          
          /* Better spacing between sections */
          .space-y-8 > * + * {
            margin-top: 1.5rem !important;
          }
          
          /* Cleaner card borders for print */
          .bg-white {
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
          }
          
          /* Page break control */
          .break-before {
            page-break-before: always;
          }
          
          /* Avoid breaking inside cards */
          .no-break {
            page-break-inside: avoid;
          }
          
          /* Better logo sizing */
          img {
            max-height: 60px !important;
          }
          
          /* Improve typography for print */
          h1 {
            font-size: 2rem !important;
            margin-bottom: 0.5rem !important;
          }
          
          .prose {
            font-size: 11pt !important;
            line-height: 1.6 !important;
          }
          
          .prose h2 {
            font-size: 1.25rem !important;
            margin-top: 1.5rem !important;
            margin-bottom: 0.75rem !important;
          }
          
          .prose h3 {
            font-size: 1.1rem !important;
            margin-top: 1rem !important;
            margin-bottom: 0.5rem !important;
          }
          
          .prose p {
            margin-bottom: 0.75rem !important;
          }
          
          .prose ul, .prose ol {
            margin-bottom: 0.75rem !important;
          }
        }
      `}</style>
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Logo Header */}
        <div className="flex items-center justify-between pb-6" style={{ 
          borderBottom: `2px solid ${hexToRgba(brandPrimaryColor, 0.4)}`
        }}>
          <div className="flex items-center gap-8">
            {whiteLabelLogo && (
              <img 
                src={whiteLabelLogo} 
                alt="Company Logo" 
                className="h-12 object-contain"
                data-testid="img-white-label-logo"
              />
            )}
          </div>
          {proposal.prospectLogoUrl && (
            <img 
              src={proposal.prospectLogoUrl} 
              alt={`${proposal.companyName} Logo`} 
              className="h-12 object-contain"
              data-testid="img-prospect-logo"
            />
          )}
        </div>

        {/* Title Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 
              className="text-4xl font-bold tracking-tight" 
              style={{ color: brandPrimaryColor }}
              data-testid="text-proposal-title"
            >
              {proposal.title}
            </h1>
            <Badge variant="outline" className="proposal-badge" data-testid="badge-template-type">
              {proposal.templateType}
            </Badge>
          </div>
          <p 
            className="text-lg text-gray-700" 
            data-testid="text-company-name"
          >
            Prepared for {proposal.companyName}
          </p>
        </div>

        {/* Contact Details */}
        {(proposal.contactName || proposal.contactEmail || proposal.engagementTimeline) && (
          <Card className="no-break" style={{ borderColor: hexToRgba(brandPrimaryColor, 0.3), borderWidth: '1px', backgroundColor: 'white' }}>
            <CardHeader>
              <CardTitle style={{ color: brandPrimaryColor }}>Proposal Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {proposal.contactName && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" style={{ color: brandAccentColor }} />
                  <span className="text-sm text-gray-800" data-testid="text-contact-name">{proposal.contactName}</span>
                </div>
              )}
              {proposal.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" style={{ color: brandAccentColor }} />
                  <span className="text-sm text-gray-800" data-testid="text-contact-email">{proposal.contactEmail}</span>
                </div>
              )}
              {proposal.engagementTimeline && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" style={{ color: brandAccentColor }} />
                  <span className="text-sm text-gray-800" data-testid="text-timeline">{proposal.engagementTimeline}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Proposal Content */}
        <Card className="no-break" style={{ borderColor: hexToRgba(brandPrimaryColor, 0.3), borderWidth: '1px', backgroundColor: 'white' }}>
          <CardContent className="pt-6">
            <div 
              className="prose proposal-prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{ __html: proposal.htmlContent || '' }}
              data-testid="content-proposal-html"
            />
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 pt-8 border-t border-gray-200">
          <p data-testid="text-footer">
            This proposal is valid for 30 days from the date of issue.
          </p>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 z-50 shadow-lg" style={{ 
        borderTop: `1px solid ${hexToRgba(brandPrimaryColor, 0.3)}`
      }}>
        <div className="max-w-6xl mx-auto p-4 flex items-center justify-center gap-4">
          <Button 
            size="lg"
            onClick={() => setAcceptDialogOpen(true)}
            data-testid="button-accept-proposal"
            className="hover-elevate"
            style={{ backgroundColor: brandPrimaryColor, color: 'white' }}
          >
            <Check className="h-4 w-4" />
            Accept Proposal
          </Button>
          <Button 
            size="lg"
            variant="outline"
            onClick={handleDownloadPDF}
            data-testid="button-download-pdf"
            style={{ borderColor: brandPrimaryColor, color: brandPrimaryColor }}
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button 
            size="lg"
            variant="outline"
            onClick={handleBookMeeting}
            data-testid="button-book-meeting"
            style={{ borderColor: brandPrimaryColor, color: brandPrimaryColor }}
          >
            <Video className="h-4 w-4" />
            Book a Meeting
          </Button>
        </div>
      </div>

      {/* Accept Proposal Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent data-testid="dialog-accept-proposal" className="bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Accept Proposal</DialogTitle>
            <DialogDescription className="text-gray-600">
              By accepting this proposal, we'll send a notification to our team with your contact information.
              We'll reach out to you shortly to get started!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setAcceptDialogOpen(false)}
              data-testid="button-cancel-accept"
              className="text-gray-900 border-gray-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => acceptProposalMutation.mutate()}
              disabled={acceptProposalMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptProposalMutation.isPending ? "Sending..." : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
