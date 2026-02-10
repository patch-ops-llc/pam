import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Clock, AlertCircle, List, Wrench } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import UatStepsTester from "@/components/UatStepsTester";
import { apiRequest } from "@/lib/queryClient";
import type { UatChecklistItem, UatChecklistItemStep, UatTestRun, UatTestStepResult } from "@shared/schema";

interface DevPortalData {
  session: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  };
  collaborator: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  items: UatChecklistItem[];
}

interface ItemProgress {
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  pendingSteps: number;
}

function extractTokenFromPath(path: string): string | null {
  const match = path.match(/^\/d\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function UatDevPortal() {
  const [location] = useLocation();
  const token = extractTokenFromPath(location);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<DevPortalData>({
    queryKey: [`/api/uat/dev/${token}`],
    enabled: !!token,
  });

  const { data: itemProgress } = useQuery<Record<string, ItemProgress>>({
    queryKey: [`/api/uat/dev/${token}/progress`],
    enabled: !!token,
    refetchInterval: 5000,
  });

  // Set neutral page title and favicon for unbranded experience
  useEffect(() => {
    document.title = data?.session?.name 
      ? `${data.session.name} - Developer Portal` 
      : "Developer Portal - Test Session";
    
    // Update favicon for UAT pages
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/uat-favicon.svg";
    }
    
    return () => {
      document.title = "Project Management";
    };
  }, [data?.session?.name]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Link</h2>
            <p className="text-muted-foreground">This developer portal link is not valid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load</h2>
            <p className="text-muted-foreground">
              {(error as Error)?.message || "This link may be invalid or expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { session, collaborator, items } = data;
  const selectedItem = items.find(i => i.id === selectedItemId);

  const getItemStatus = (itemId: string) => {
    const progress = itemProgress?.[itemId];
    if (!progress || progress.totalSteps === 0) return "pending";
    if (progress.failedSteps > 0) return "failed";
    if (progress.passedSteps === progress.totalSteps) return "passed";
    if (progress.passedSteps > 0) return "in_progress";
    return "pending";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Passed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "in_progress":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const totalItems = items.length;
  const passedItems = items.filter(i => getItemStatus(i.id) === "passed").length;
  const progressPercent = totalItems > 0 ? (passedItems / totalItems) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>{session.name}</CardTitle>
                {session.description && (
                  <CardDescription className="mt-1">{session.description}</CardDescription>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm text-muted-foreground">
                Testing as: <span className="font-medium">{collaborator.name}</span>
              </span>
              <Badge variant="outline">Developer</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Test Progress</span>
                <span>{passedItems} of {totalItems} items passed</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <List className="w-4 h-4" />
                Test Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {items.map((item, index) => {
                  const status = getItemStatus(item.id);
                  const progress = itemProgress?.[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`w-full text-left p-4 transition-colors hover-elevate ${
                        selectedItemId === item.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{index + 1}.</span>
                            <span className="font-medium truncate">{item.title}</span>
                          </div>
                          {progress && progress.totalSteps > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {progress.passedSteps}/{progress.totalSteps} steps passed
                            </div>
                          )}
                        </div>
                        {getStatusBadge(status)}
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No test items available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedItem ? (
              <>
                <CardHeader>
                  <CardTitle>{selectedItem.title}</CardTitle>
                  {selectedItem.instructions && (
                    <CardDescription className="mt-2">
                      {selectedItem.instructions}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <UatStepsTester
                    itemId={selectedItem.id}
                    token={token}
                    guestName={collaborator.name}
                    guestId={collaborator.id}
                    isDeveloper
                    onMarkComplete={() => {
                      const currentIdx = items.findIndex(i => i.id === selectedItem.id);
                      if (currentIdx < items.length - 1) {
                        setSelectedItemId(items[currentIdx + 1].id);
                        toast({ title: "Item tested", description: "Moving to next item" });
                      } else {
                        toast({ title: "Testing complete!", description: "All items have been reviewed" });
                      }
                    }}
                  />
                </CardContent>
              </>
            ) : (
              <CardContent className="py-16 text-center text-muted-foreground">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Select a test item from the list to begin testing</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
