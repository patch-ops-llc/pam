import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, AlertCircle, Clock, Users, Link2, Copy, FileText, MessageSquare, ChevronDown, ChevronRight, Plus, Trash2, Pencil, Search, ArrowUpDown, Filter } from "lucide-react";
import { DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { UatItemComments } from "@/components/UatItemComments";
import type { UatChecklistItem, UatResponse, UatGuest, UatChecklistItemStep } from "@shared/schema";

interface CollaboratorInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SessionData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  inviteToken: string;
  dueDate: string | null;
  priority: string;
  createdAt: string;
  items: (UatChecklistItem & { 
    responses: UatResponse[];
    steps: UatChecklistItemStep[];
  })[];
  guests: UatGuest[];
  collaborators: CollaboratorInfo[];
}

interface PmPortalData {
  collaborator: CollaboratorInfo;
  session: SessionData;
}

function extractTokenFromPath(path: string): string | null {
  const match = path.match(/^\/p\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function UatPmPortal() {
  const [location] = useLocation();
  const token = extractTokenFromPath(location);
  const { toast } = useToast();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [newGuestName, setNewGuestName] = useState("");
  const [newGuestEmail, setNewGuestEmail] = useState("");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UatChecklistItem | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemInstructions, setItemInstructions] = useState("");
  const [itemReferenceUrl, setItemReferenceUrl] = useState("");
  
  // Step dialog state
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<UatChecklistItemStep | null>(null);
  const [stepItemId, setStepItemId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  const [stepInstructions, setStepInstructions] = useState("");
  const [stepExpectedResult, setStepExpectedResult] = useState("");
  const [stepType, setStepType] = useState<"test" | "delay" | "info">("test");
  
  // Collaborator invite state
  const [collabDialogOpen, setCollabDialogOpen] = useState(false);
  const [collabName, setCollabName] = useState("");
  const [collabEmail, setCollabEmail] = useState("");
  const [collabRole, setCollabRole] = useState<"developer" | "editor" | "viewer">("developer");
  
  // Filtering and sorting state
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemStatusFilter, setItemStatusFilter] = useState<"all" | "pending" | "approved" | "needs_remediation">("all");
  const [itemSortBy, setItemSortBy] = useState<"order" | "title" | "status" | "steps">("order");
  const [itemSortOrder, setItemSortOrder] = useState<"asc" | "desc">("asc");

  const { data, isLoading, error } = useQuery<PmPortalData>({
    queryKey: ["/api/uat/pm", token],
    queryFn: async () => {
      const response = await fetch(`/api/uat/pm/${token}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
      return response.json();
    },
    enabled: !!token,
  });

  const inviteGuestMutation = useMutation({
    mutationFn: async (guestData: { name: string; email: string }) => {
      const res = await apiRequest(`/api/uat/pm/${token}/guests`, "POST", guestData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      setInviteDialogOpen(false);
      setNewGuestName("");
      setNewGuestEmail("");
      toast({ title: "Reviewer invited", description: "An invite link has been created for the reviewer." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to invite reviewer", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: { title: string; instructions?: string; referenceUrl?: string }) => {
      const res = await apiRequest(`/api/uat/pm/${token}/items`, "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      setItemDialogOpen(false);
      setItemTitle("");
      setItemInstructions("");
      setItemReferenceUrl("");
      toast({ title: "Item created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create item", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: { title: string; instructions?: string; referenceUrl?: string } }) => {
      const res = await apiRequest(`/api/uat/pm/${token}/items/${itemId}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemTitle("");
      setItemInstructions("");
      setItemReferenceUrl("");
      toast({ title: "Item updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest(`/api/uat/pm/${token}/items/${itemId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      toast({ title: "Item deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
    },
  });

  const duplicateItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest(`/api/uat/pm/${token}/items/${itemId}/duplicate`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      toast({ title: "Item duplicated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to duplicate item", variant: "destructive" });
    },
  });

  // Step mutations
  const createStepMutation = useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: { title: string; instructions?: string; expectedResult?: string; stepType: string } }) => {
      const res = await apiRequest(`/api/uat/pm/${token}/items/${itemId}/steps`, "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      closeStepDialog();
      toast({ title: "Step created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create step", variant: "destructive" });
    },
  });

  const updateStepMutation = useMutation({
    mutationFn: async ({ stepId, data }: { stepId: string; data: { title?: string; instructions?: string; expectedResult?: string; stepType?: string } }) => {
      const res = await apiRequest(`/api/uat/pm/${token}/steps/${stepId}`, "PATCH", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      closeStepDialog();
      toast({ title: "Step updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update step", variant: "destructive" });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      await apiRequest(`/api/uat/pm/${token}/steps/${stepId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      toast({ title: "Step deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete step", variant: "destructive" });
    },
  });

  // Collaborator mutations
  const inviteCollaboratorMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string }) => {
      const res = await apiRequest(`/api/uat/pm/${token}/collaborators`, "POST", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat/pm", token] });
      setCollabDialogOpen(false);
      setCollabName("");
      setCollabEmail("");
      setCollabRole("developer");
      toast({ title: "Collaborator invited" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to invite collaborator", variant: "destructive" });
    },
  });

  const openCreateStepDialog = (itemId: string) => {
    setStepItemId(itemId);
    setEditingStep(null);
    setStepTitle("");
    setStepInstructions("");
    setStepExpectedResult("");
    setStepType("test");
    setStepDialogOpen(true);
  };

  const openEditStepDialog = (step: UatChecklistItemStep) => {
    setEditingStep(step);
    setStepItemId(step.itemId);
    setStepTitle(step.title);
    setStepInstructions(step.instructions || "");
    setStepExpectedResult(step.expectedResult || "");
    setStepType((step.stepType as "test" | "delay" | "info") || "test");
    setStepDialogOpen(true);
  };

  const closeStepDialog = () => {
    setStepDialogOpen(false);
    setEditingStep(null);
    setStepItemId(null);
    setStepTitle("");
    setStepInstructions("");
    setStepExpectedResult("");
    setStepType("test");
  };

  const handleStepSubmit = () => {
    const data = { 
      title: stepTitle, 
      instructions: stepInstructions || undefined, 
      expectedResult: stepExpectedResult || undefined,
      stepType 
    };
    if (editingStep) {
      updateStepMutation.mutate({ stepId: editingStep.id, data });
    } else if (stepItemId) {
      createStepMutation.mutate({ itemId: stepItemId, data });
    }
  };

  const openEditDialog = (item: UatChecklistItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemInstructions(item.instructions || "");
    setItemReferenceUrl((item as any).referenceUrl || "");
    setItemDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setItemTitle("");
    setItemInstructions("");
    setItemReferenceUrl("");
    setItemDialogOpen(true);
  };

  const handleItemSubmit = () => {
    const data = { 
      title: itemTitle, 
      instructions: itemInstructions || undefined,
      referenceUrl: itemReferenceUrl || undefined,
    };
    if (editingItem) {
      updateItemMutation.mutate({ itemId: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  // UAT links always use the custom domain for white-label branding
  const uatBaseUrl = import.meta.env.VITE_UAT_CUSTOM_DOMAIN || 'https://testhub.us';
  
  const getReviewerLink = (accessToken: string | null | undefined) => {
    if (!accessToken) return '';
    return `${uatBaseUrl}/r/${accessToken}`;
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Set neutral page title and favicon for unbranded experience
  useEffect(() => {
    document.title = data?.session?.name 
      ? `${data.session.name} - PM Portal` 
      : "PM Portal - Review Session";
    
    // Update favicon for UAT pages
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      link.href = "/uat-favicon.svg";
    }
    
    return () => {
      // Restore original title when leaving
      document.title = "Project Management";
    };
  }, [data?.session?.name]);

  // Helper function to get item status - defined before useMemo
  const getItemStatusForFilter = (item: { responses?: { status: string }[] }): "pending" | "approved" | "needs_remediation" | "in_progress" => {
    const responses = item.responses || [];
    if (responses.length === 0) {
      return "pending";
    }
    const hasApproval = responses.some(r => r.status === "approved");
    const hasChanges = responses.some(r => r.status === "changes_requested");
    if (hasChanges) {
      return "needs_remediation";
    }
    if (hasApproval) {
      return "approved";
    }
    return "in_progress";
  };

  // Filter and sort items - useMemo must be before early returns (React hooks rules)
  const items = data?.session?.items || [];
  const filteredItems = useMemo(() => {
    let result = [...items];
    
    // Apply search filter
    if (itemSearchQuery) {
      const query = itemSearchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.instructions && item.instructions.toLowerCase().includes(query))
      );
    }
    
    // Apply status filter
    if (itemStatusFilter !== "all") {
      result = result.filter(item => getItemStatusForFilter(item) === itemStatusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (itemSortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "status":
          comparison = getItemStatusForFilter(a).localeCompare(getItemStatusForFilter(b));
          break;
        case "steps":
          comparison = (a.steps?.length || 0) - (b.steps?.length || 0);
          break;
        case "order":
        default:
          comparison = (a.order || 0) - (b.order || 0);
          break;
      }
      return itemSortOrder === "desc" ? -comparison : comparison;
    });
    
    return result;
  }, [items, itemSearchQuery, itemStatusFilter, itemSortBy, itemSortOrder]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Access Link</h2>
            <p className="text-muted-foreground">This PM portal link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">This PM portal link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { collaborator, session } = data;
  const guests = session.guests || [];
  const canEdit = collaborator.role === "pm" || collaborator.role === "editor";

  const getProgressStats = () => {
    const total = items.length;
    const allResponses = items.flatMap(item => item.responses);
    const uniqueItemsWithResponses = new Set(allResponses.map(r => r.checklistItemId)).size;
    const approved = allResponses.filter(r => r.status === "approved").length;
    const changesRequested = allResponses.filter(r => r.status === "changes_requested").length;
    return { total, completed: uniqueItemsWithResponses, approved, changesRequested };
  };

  const progress = getProgressStats();
  const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "active":
        return <Badge variant="default"><AlertCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "completed":
        return <Badge className="bg-green-600 hover-elevate"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getItemStatusBadge = (item: typeof items[0]) => {
    const status = getItemStatusForFilter(item);
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-600 hover-elevate"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
      case "needs_remediation":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Needs Remediation</Badge>;
      default:
        return <Badge variant="secondary">In Progress</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{session.name}</h1>
            <p className="text-sm text-muted-foreground">PM Portal - {collaborator.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(session.status)}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{progress.total}</div>
              <div className="text-sm text-muted-foreground">Total Items</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{progress.completed}</div>
              <div className="text-sm text-muted-foreground">Reviewed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{progress.approved}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-600">{progress.changesRequested}</div>
              <div className="text-sm text-muted-foreground">Changes Requested</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>

        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items" className="gap-2">
              <FileText className="w-4 h-4" />
              Checklist Items ({items.length})
            </TabsTrigger>
            <TabsTrigger value="reviewers" className="gap-2">
              <Users className="w-4 h-4" />
              Reviewers ({guests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <Card>
              <CardHeader className="flex flex-col gap-4 py-4">
                <div className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">Checklist Items</CardTitle>
                    {session.description && (
                      <CardDescription>{session.description}</CardDescription>
                    )}
                  </div>
                  {canEdit && (
                    <Button onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={itemStatusFilter} onValueChange={(v) => setItemStatusFilter(v as any)}>
                    <SelectTrigger className="w-[150px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="needs_remediation">Needs Remediation</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={itemSortBy} onValueChange={(v) => setItemSortBy(v as any)}>
                    <SelectTrigger className="w-[130px]">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order">Order</SelectItem>
                      <SelectItem value="title">Title</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="steps">Steps</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setItemSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                    title={itemSortOrder === "asc" ? "Ascending" : "Descending"}
                  >
                    {itemSortOrder === "asc" ? "A-Z" : "Z-A"}
                  </Button>
                </div>
                {filteredItems.length !== items.length && (
                  <div className="text-sm text-muted-foreground">
                    Showing {filteredItems.length} of {items.length} items
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Feedback</TableHead>
                      {canEdit && <TableHead className="w-24">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item, index) => {
                      const isExpanded = expandedItems.has(item.id);
                      const responses = item.responses || [];
                      const steps = item.steps || [];
                      
                      return (
                        <>
                          <TableRow 
                            key={item.id}
                            className="cursor-pointer hover-elevate"
                            onClick={() => toggleItemExpanded(item.id)}
                          >
                            <TableCell>
                              <Button variant="ghost" size="icon">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{index + 1}. {item.title}</div>
                              {item.instructions && (
                                <div className="text-sm text-muted-foreground truncate max-w-xs">
                                  {item.instructions}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {steps.length > 0 ? (
                                <Badge variant="outline">{steps.length} steps</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getItemStatusBadge(item)}</TableCell>
                            <TableCell>
                              {responses.length > 0 ? (
                                <Badge variant="outline" className="gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {responses.length}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            {canEdit && (
                              <TableCell>
                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => openEditDialog(item)}
                                    title="Edit item"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => duplicateItemMutation.mutate(item.id)}
                                    title="Duplicate item"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      if (confirm("Delete this item?")) {
                                        deleteItemMutation.mutate(item.id);
                                      }
                                    }}
                                    title="Delete item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${item.id}-details`}>
                              <TableCell colSpan={canEdit ? 6 : 5} className="bg-muted/50">
                                <div className="p-4 space-y-4">
                                  {item.instructions && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-1">Instructions</h4>
                                      <p className="text-sm text-muted-foreground">{item.instructions}</p>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-sm font-medium">Test Steps</h4>
                                      {canEdit && (
                                        <Button size="sm" variant="outline" onClick={() => openCreateStepDialog(item.id)}>
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add Step
                                        </Button>
                                      )}
                                    </div>
                                    {steps.length > 0 ? (
                                      <div className="space-y-2">
                                        {steps.map((step, i) => (
                                          <div key={step.id} className="flex items-start gap-2 p-2 bg-background rounded border">
                                            <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
                                            <div className="flex-1">
                                              <div className="font-medium text-sm">{step.title}</div>
                                              {step.instructions && (
                                                <div className="text-xs text-muted-foreground mt-1">{step.instructions}</div>
                                              )}
                                              {step.expectedResult && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  <span className="font-medium">Expected:</span> {step.expectedResult}
                                                </div>
                                              )}
                                            </div>
                                            <Badge variant={step.stepType === "test" ? "default" : "secondary"}>
                                              {step.stepType}
                                            </Badge>
                                            {canEdit && (
                                              <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditStepDialog(step)}>
                                                  <Pencil className="w-3 h-3" />
                                                </Button>
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-6 w-6"
                                                  onClick={() => {
                                                    if (confirm("Delete this step?")) {
                                                      deleteStepMutation.mutate(step.id);
                                                    }
                                                  }}
                                                >
                                                  <Trash2 className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No test steps defined</p>
                                    )}
                                  </div>

                                  {responses.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Reviewer Feedback</h4>
                                      <div className="space-y-2">
                                        {responses.map(response => (
                                          <div key={response.id} className="p-2 bg-background rounded border">
                                            <div className="flex items-center gap-2 mb-1">
                                              {response.status === "approved" ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                              ) : (
                                                <XCircle className="w-4 h-4 text-destructive" />
                                              )}
                                              <span className="text-sm font-medium capitalize">
                                                {response.status.replace("_", " ")}
                                              </span>
                                            </div>
                                            {response.feedback && (
                                              <p className="text-sm text-muted-foreground">{response.feedback}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <UatItemComments
                                    itemId={item.id}
                                    itemTitle={item.title}
                                    apiEndpoint={`/api/uat/pm/${token}/items`}
                                    currentUserName={collaborator.name}
                                    currentUserId={collaborator.id}
                                    readOnly={collaborator.role === "viewer"}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground py-8">
                          No checklist items yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviewers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
                <CardTitle className="text-lg">Reviewers & Collaborators</CardTitle>
                <div className="flex items-center gap-2">
                  {collaborator.role === "pm" && (
                    <Button size="sm" variant="outline" onClick={() => setCollabDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Invite Developer
                    </Button>
                  )}
                  {(collaborator.role === "pm" || collaborator.role === "editor") && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" disabled={!data?.session?.id}>
                          <Users className="w-4 h-4 mr-2" />
                          Invite Reviewer
                        </Button>
                      </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Reviewer</DialogTitle>
                        <DialogDescription>
                          Add a new reviewer to this UAT session. They will receive a unique link to access the review.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (newGuestName && newGuestEmail) {
                          inviteGuestMutation.mutate({ name: newGuestName, email: newGuestEmail });
                        }
                      }} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={newGuestName}
                            onChange={(e) => setNewGuestName(e.target.value)}
                            placeholder="Reviewer name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newGuestEmail}
                            onChange={(e) => setNewGuestEmail(e.target.value)}
                            placeholder="reviewer@example.com"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={!newGuestName || !newGuestEmail || inviteGuestMutation.isPending}>
                            {inviteGuestMutation.isPending ? "Inviting..." : "Send Invite"}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Last Accessed</TableHead>
                      <TableHead>Invite Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guests.map(guest => (
                      <TableRow key={guest.id}>
                        <TableCell className="font-medium">{guest.name}</TableCell>
                        <TableCell>{guest.email}</TableCell>
                        <TableCell>
                          {guest.lastAccessedAt ? (
                            formatDistanceToNow(new Date(guest.lastAccessedAt), { addSuffix: true })
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {guest.accessToken ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => copyToClipboard(getReviewerLink(guest.accessToken), "Invite link")}
                            >
                              <Copy className="w-3 h-3" />
                              Copy Link
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">No token available</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {guests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No reviewers invited yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the checklist item details" : "Add a new checklist item for reviewers"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-title">Title</Label>
              <Input
                id="item-title"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="Enter item title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-instructions">Instructions (optional)</Label>
              <Textarea
                id="item-instructions"
                value={itemInstructions}
                onChange={(e) => setItemInstructions(e.target.value)}
                placeholder="Enter instructions for reviewers"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-reference-url">Reference URL (optional)</Label>
              <Input
                id="item-reference-url"
                value={itemReferenceUrl}
                onChange={(e) => setItemReferenceUrl(e.target.value)}
                placeholder="https://example.com/page-to-test"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleItemSubmit}
              disabled={!itemTitle.trim() || createItemMutation.isPending || updateItemMutation.isPending}
            >
              {createItemMutation.isPending || updateItemMutation.isPending 
                ? "Saving..." 
                : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStep ? "Edit Step" : "Add Step"}</DialogTitle>
            <DialogDescription>
              {editingStep ? "Update the test step details" : "Add a new test step to this item"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="step-title">Title</Label>
              <Input
                id="step-title"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                placeholder="Enter step title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-type">Step Type</Label>
              <Select value={stepType} onValueChange={(v) => setStepType(v as "test" | "delay" | "info")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="delay">Delay</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-instructions">Instructions (optional)</Label>
              <Textarea
                id="step-instructions"
                value={stepInstructions}
                onChange={(e) => setStepInstructions(e.target.value)}
                placeholder="Enter detailed instructions"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-expected">Expected Result (optional)</Label>
              <Textarea
                id="step-expected"
                value={stepExpectedResult}
                onChange={(e) => setStepExpectedResult(e.target.value)}
                placeholder="What should happen if this step passes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeStepDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleStepSubmit}
              disabled={!stepTitle.trim() || createStepMutation.isPending || updateStepMutation.isPending}
            >
              {createStepMutation.isPending || updateStepMutation.isPending 
                ? "Saving..." 
                : editingStep ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {collaborator.role === "pm" && (
        <Dialog open={collabDialogOpen} onOpenChange={setCollabDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Collaborator</DialogTitle>
              <DialogDescription>
                Add a developer or editor to collaborate on this session
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="collab-name">Name</Label>
                <Input
                  id="collab-name"
                  value={collabName}
                  onChange={(e) => setCollabName(e.target.value)}
                  placeholder="Enter collaborator name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collab-email">Email</Label>
                <Input
                  id="collab-email"
                  type="email"
                  value={collabEmail}
                  onChange={(e) => setCollabEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="collab-role">Role</Label>
                <Select value={collabRole} onValueChange={(v) => setCollabRole(v as "developer" | "editor" | "viewer")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="developer">Developer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCollabDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => inviteCollaboratorMutation.mutate({ name: collabName, email: collabEmail, role: collabRole })}
                disabled={!collabName.trim() || !collabEmail.trim() || inviteCollaboratorMutation.isPending}
              >
                {inviteCollaboratorMutation.isPending ? "Inviting..." : "Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
