import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, ArrowRight, ArrowLeft, Check, Lock, List, Focus, AlertTriangle, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import UatStepsTester from "@/components/UatStepsTester";

interface ReviewItem {
  id: string;
  title: string;
  instructions: string | null;
  order: number;
  response: {
    id: string;
    status: string;
    feedback: string | null;
  } | null;
}

interface ReviewData {
  requiresPassword?: boolean;
  authenticated?: boolean;
  session: {
    id: string;
    name: string;
    description?: string | null;
    status?: string;
  };
  guest?: {
    id: string;
    name: string;
    email: string;
  };
  items?: ReviewItem[];
  progress?: {
    total: number;
    completed: number;
    approved: number;
    changesRequested: number;
  };
}

function extractTokenFromPath(path: string): { token: string | null; type: "invite" | "review" | "short" } {
  const inviteMatch = path.match(/^\/uat\/invite\/([^/?#]+)/);
  if (inviteMatch) {
    return { token: inviteMatch[1], type: "invite" };
  }
  const reviewMatch = path.match(/^\/uat\/review\/([^/?#]+)/);
  if (reviewMatch) {
    return { token: reviewMatch[1], type: "review" };
  }
  // Short /r/ route - unified token that auto-detects type
  const shortMatch = path.match(/^\/r\/([^/?#]+)/);
  if (shortMatch) {
    return { token: shortMatch[1], type: "short" };
  }
  return { token: null, type: "review" };
}

function getStorageKey(token: string) {
  return `uat_auth_${token}`;
}

export default function UatReview() {
  const [location] = useLocation();
  const { token, type } = extractTokenFromPath(location);
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"focus" | "list">("focus");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authenticatedData, setAuthenticatedData] = useState<ReviewData | null>(null);
  const [remediationDialogOpen, setRemediationDialogOpen] = useState(false);
  const [remediationFeedback, setRemediationFeedback] = useState("");

  const apiEndpoint = type === "invite" 
    ? `/api/uat/invite/${token}` 
    : type === "short" 
      ? `/api/uat/token/${token}` 
      : `/api/uat/review/${token}`;

  // Check for stored auth on mount
  useEffect(() => {
    if (token && (type === "invite" || type === "short")) {
      const stored = sessionStorage.getItem(getStorageKey(token));
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setAuthenticatedData(data);
          setIsAuthenticated(true);
        } catch {
          sessionStorage.removeItem(getStorageKey(token));
        }
      }
    }
  }, [token, type]);

  const { data, isLoading, error } = useQuery<ReviewData>({
    queryKey: [apiEndpoint],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load review");
      }
      return response.json();
    },
    enabled: !!token && !isAuthenticated,
  });

  const authEndpoint = type === "short" 
    ? `/api/uat/token/${token}/authenticate` 
    : `/api/uat/invite/${token}/authenticate`;

  const authenticateMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const response = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Authentication failed");
      }
      return response.json();
    },
    onSuccess: (responseData) => {
      setIsAuthenticated(true);
      setAuthenticatedData(responseData);
      setAuthError("");
      sessionStorage.setItem(getStorageKey(token!), JSON.stringify(responseData));
    },
    onError: (error: Error) => {
      setAuthError(error.message);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      authenticateMutation.mutate(password);
    }
  };

  const isReadOnly = type === "invite";
  
  const respondEndpoint = type === "short"
    ? `/api/uat/token/${token}/respond`
    : `/api/uat/review/${token}/respond`;
  
  const respondMutation = useMutation({
    mutationFn: async ({ status, feedback, itemId }: { status: string; feedback?: string; itemId: string }) => {
      if (isReadOnly) {
        throw new Error("Please use a personalized review link to submit responses");
      }
      const response = await fetch(respondEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId: itemId,
          status,
          feedback,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit response");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
      
      // Clear cached auth data to force refetch
      if (token && isAuthenticated) {
        sessionStorage.removeItem(getStorageKey(token));
        setIsAuthenticated(false);
        setAuthenticatedData(null);
      }
      
      toast({ title: "Response submitted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    },
  });

  // Set neutral page title and favicon for unbranded experience
  // Use authenticatedData or data directly since reviewData is defined after early returns
  const sessionNameForTitle = isAuthenticated ? authenticatedData?.session?.name : data?.session?.name;
  useEffect(() => {
    document.title = sessionNameForTitle 
      ? `${sessionNameForTitle} - Review` 
      : "Review Session";
    
    // Update favicon for UAT pages
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/uat-favicon.svg";
    }
    
    return () => {
      document.title = "Project Management";
    };
  }, [sessionNameForTitle]);

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Review</h2>
            <p className="text-muted-foreground">
              {(error as Error)?.message || "This review link may be invalid or expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password prompt for protected sessions
  if (data?.requiresPassword && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Password Required</CardTitle>
            <CardDescription>
              Enter the password to access "{data.session.name}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {authError && (
                <p className="text-sm text-destructive">{authError}</p>
              )}
              <Button 
                type="submit" 
                className="w-full"
                disabled={authenticateMutation.isPending || !password.trim()}
              >
                {authenticateMutation.isPending ? "Verifying..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use authenticated data if available, otherwise use query data
  const reviewData = isAuthenticated ? authenticatedData : data;
  
  // Extract items for TypeScript narrowing
  const items = reviewData?.items;
  
  if (!items || !reviewData?.progress || !reviewData?.guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Review</h2>
            <p className="text-muted-foreground">
              This review link may be invalid or expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reviewData.session.status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Review Completed</h2>
            <p className="text-muted-foreground">
              This review session has been completed. Thank you for your feedback!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Items to Review</h2>
            <p className="text-muted-foreground">
              There are no items ready for review yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const progressPercent = (reviewData.progress.completed / reviewData.progress.total) * 100;
  const allComplete = reviewData.progress.completed === reviewData.progress.total;

  const handleApprove = () => {
    if (!currentItem) return;
    respondMutation.mutate({ 
      status: "approved", 
      itemId: currentItem.id 
    });
  };

  const openRemediationDialog = () => {
    setRemediationFeedback("");
    setRemediationDialogOpen(true);
  };

  // Post a comment to the item's discussion thread
  const postCommentMutation = useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: string }) => {
      const commentEndpoint = type === "short"
        ? `/api/uat/token/${token}/items/${itemId}/comments`
        : `/api/uat/review/${token}/items/${itemId}/comments`;
      return await apiRequest(commentEndpoint, "POST", { body });
    },
  });

  const handleNeedsRemediation = async () => {
    if (!currentItem || !remediationFeedback.trim()) return;
    
    try {
      // Submit the response with status
      await respondMutation.mutateAsync({ 
        status: "changes_requested", 
        itemId: currentItem.id,
        feedback: remediationFeedback.trim()
      });
      
      // Also post the feedback as a comment to the discussion thread
      await postCommentMutation.mutateAsync({
        itemId: currentItem.id,
        body: `**Needs Remediation:** ${remediationFeedback.trim()}`
      });
      
      setRemediationDialogOpen(false);
      setRemediationFeedback("");
    } catch (error) {
      // Error already handled by mutation error handlers
    }
  };

  // Table view for list mode
  const renderTableView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="w-32">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow 
                key={item.id} 
                className="cursor-pointer hover-elevate"
                onClick={() => {
                  setCurrentIndex(index);
                  setViewMode("focus");
                }}
              >
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    {item.instructions && (
                      <p className="text-sm text-muted-foreground truncate max-w-md">{item.instructions}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {item.response ? (
                    <Badge 
                      variant={item.response.status === "approved" ? "default" : "outline"}
                      className={item.response.status === "approved" ? "bg-green-600" : "border-amber-500 text-amber-600"}
                    >
                      {item.response.status === "approved" ? "Approved" : "Needs Remediation"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">{reviewData.session.name}</h1>
          {reviewData.session.description && (
            <p className="text-muted-foreground">{reviewData.session.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Reviewing as: <span className="font-medium">{reviewData.guest.name}</span>
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex justify-between text-sm flex-1">
              <span>Progress</span>
              <span>{reviewData.progress.completed} of {reviewData.progress.total} reviewed</span>
            </div>
            <ToggleGroup 
              type="single" 
              value={viewMode} 
              onValueChange={(v) => v && setViewMode(v as "focus" | "list")}
              className="ml-4"
            >
              <ToggleGroupItem value="focus" aria-label="Focus view" size="sm">
                <Focus className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view" size="sm">
                <List className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {reviewData.progress.changesRequested > 0 && (
            <p className="text-sm text-amber-600 mt-2">
              {reviewData.progress.changesRequested} item{reviewData.progress.changesRequested > 1 ? "s" : ""} need remediation
            </p>
          )}
        </div>

        {viewMode === "list" ? (
          renderTableView()
        ) : allComplete ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <h2 className="text-2xl font-semibold mb-2">All Items Reviewed!</h2>
              <p className="text-muted-foreground mb-4">
                Thank you for completing the review. You can update your responses below if needed.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{reviewData.progress.approved}</div>
                  <div className="text-sm text-muted-foreground">Approved</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{reviewData.progress.changesRequested}</div>
                  <div className="text-sm text-muted-foreground">Changes Requested</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  Item {currentIndex + 1} of {items.length}
                </Badge>
                {currentItem.response && (
                  <Badge 
                    variant={currentItem.response.status === "approved" ? "default" : "outline"}
                    className={currentItem.response.status === "approved" ? "bg-green-600" : ""}
                  >
                    {currentItem.response.status === "approved" ? "Approved" : "Changes Requested"}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl mt-2">{currentItem.title}</CardTitle>
              {currentItem.instructions && (
                <CardDescription className="text-base mt-2">
                  {currentItem.instructions}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {token && reviewData?.guest && (
                <UatStepsTester 
                  itemId={currentItem.id} 
                  token={token} 
                  guestName={reviewData.guest.name}
                  guestId={reviewData.guest.id}
                  onMarkComplete={() => {
                    if (currentIndex < items.length - 1) {
                      setCurrentIndex(currentIndex + 1);
                      toast({ title: "Item reviewed", description: "Moving to next item" });
                    } else {
                      toast({ title: "Review complete!", description: "You've reviewed all items" });
                    }
                  }}
                />
              )}
              {currentItem.response?.feedback && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-1">Your previous feedback:</p>
                  <p className="text-sm text-muted-foreground">{currentItem.response.feedback}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleApprove}
                  disabled={respondMutation.isPending}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={openRemediationDialog}
                  disabled={respondMutation.isPending}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Needs Remediation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {viewMode === "focus" && (
          <>
            <div className="flex justify-between mt-6">
              <Button
                variant="ghost"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
                disabled={currentIndex === items.length - 1}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="flex justify-center gap-1 mt-4">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex
                      ? "bg-primary"
                      : item.response
                      ? item.response.status === "approved"
                        ? "bg-green-600"
                        : "bg-amber-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={remediationDialogOpen} onOpenChange={setRemediationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Needs Remediation
            </DialogTitle>
            <DialogDescription>
              Explain what needs to be fixed or changed. This will be posted to the discussion thread.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="remediation-feedback">What needs to be fixed? *</Label>
              <Textarea
                id="remediation-feedback"
                value={remediationFeedback}
                onChange={(e) => setRemediationFeedback(e.target.value)}
                placeholder="Describe the issue and what changes are needed..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemediationDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleNeedsRemediation}
              disabled={!remediationFeedback.trim() || respondMutation.isPending || postCommentMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {respondMutation.isPending || postCommentMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
