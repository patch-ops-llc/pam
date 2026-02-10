import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Copy, Users, CheckCircle2, AlertCircle, Clock, ArrowLeft, GripVertical, UserPlus, ExternalLink, Link, FileText, Image, MessageSquare, Lock, Key, Eye, EyeOff, RefreshCw, Calendar, User, CircleDot, AlertTriangle, PlayCircle, CheckCircle, XCircle, Tag, Mail, Activity, History, Search, ArrowUpDown, Filter, Pencil, Upload, Code } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UatSessionWithRelations, UatChecklistItem, UatGuest, UatSessionCollaborator } from "@shared/schema";
import { UAT_IMPORT_TEMPLATE, UAT_CURSOR_PROMPT, uatImportSchema } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface SessionStatusData {
  sessionId: string;
  sessionStatus: string;
  summary: {
    totalItems: number;
    passedItems: number;
    failedItems: number;
    partialItems: number;
    pendingItems: number;
  };
  items: {
    id: string;
    title: string;
    order: number;
    itemStatus: 'pending' | 'passed' | 'failed' | 'partial';
    passedSteps: number;
    failedSteps: number;
    totalSteps: number;
    lastReviewedAt: string | null;
    lastReviewedByName: string | null;
    lastReviewedByType: string | null;
    lastResolvedAt: string | null;
    lastResolvedByName: string | null;
  }[];
  testRuns: {
    id: string;
    runNumber: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  }[];
  activeRunId: string | null;
}
import { Share2 } from "lucide-react";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import UatStepsEditor from "@/components/UatStepsEditor";
import { UatItemComments } from "@/components/UatItemComments";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const itemFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  instructions: z.string().optional(),
  itemType: z.enum(["approval", "screenshot", "url", "text_feedback"]).default("approval"),
  internalNote: z.string().optional(),
  referenceUrl: z.string().optional(),
});

const guestFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
});

const collaboratorFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.enum(["pm", "editor", "viewer", "developer"]).default("pm"),
});

type ItemFormData = z.infer<typeof itemFormSchema>;
type GuestFormData = z.infer<typeof guestFormSchema>;
type CollaboratorFormData = z.infer<typeof collaboratorFormSchema>;

const itemTypeLabels: Record<string, { label: string; icon: typeof CheckCircle2; description: string }> = {
  approval: { label: "Approval Only", icon: CheckCircle2, description: "Reviewer approves or requests changes" },
  screenshot: { label: "Screenshot Required", icon: Image, description: "Reviewer must provide a screenshot" },
  url: { label: "URL Required", icon: Link, description: "Reviewer must provide a URL" },
  text_feedback: { label: "Text Feedback Required", icon: MessageSquare, description: "Reviewer must provide detailed feedback" },
};

function extractIdFromPath(path: string): string | null {
  const match = path.match(/^\/uat\/([^/?#]+)/);
  return match ? match[1] : null;
}

export default function UatSessionDetail() {
  const [location, navigate] = useLocation();
  const id = extractIdFromPath(location);
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Staff' : 'Staff';
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<UatChecklistItem | null>(null);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [collaboratorDialogOpen, setCollaboratorDialogOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  
  // Filtering and sorting state
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemStatusFilter, setItemStatusFilter] = useState<"all" | "pending" | "passed" | "failed" | "partial">("all");
  const [itemSortBy, setItemSortBy] = useState<"order" | "title" | "status">("order");
  const [itemSortOrder, setItemSortOrder] = useState<"asc" | "desc">("asc");

  const { data: session, isLoading } = useQuery<UatSessionWithRelations>({
    queryKey: ["/api/uat-sessions", id],
    enabled: !!id,
  });

  const { data: users = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/users"],
  });

  const itemForm = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: { title: "", instructions: "", itemType: "approval", internalNote: "", referenceUrl: "" },
  });

  const guestForm = useForm<GuestFormData>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: { name: "", email: "" },
  });

  const collaboratorForm = useForm<CollaboratorFormData>({
    resolver: zodResolver(collaboratorFormSchema),
    defaultValues: { name: "", email: "", role: "pm" },
  });

  const { data: collaborators = [] } = useQuery<UatSessionCollaborator[]>({
    queryKey: ["/api/uat-sessions", id, "collaborators"],
    enabled: !!id,
  });

  const { data: statusData, isLoading: statusLoading } = useQuery<SessionStatusData>({
    queryKey: ["/api/uat-sessions", id, "status"],
    enabled: !!id,
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      return await apiRequest(`/api/uat-sessions/${id}/items`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "status"] });
      setItemDialogOpen(false);
      itemForm.reset();
      toast({ title: "Checklist item added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add item", description: error.message, variant: "destructive" });
    },
  });

  const importItemsMutation = useMutation({
    mutationFn: async (jsonData: any) => {
      const response = await apiRequest(`/api/uat-sessions/${id}/items/import`, "POST", jsonData);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "status"] });
      setImportDialogOpen(false);
      setImportJson("");
      setImportError(null);
      toast({ 
        title: "Items imported", 
        description: `Successfully imported ${result.created} items${result.errors > 0 ? ` (${result.errors} failed)` : ""}` 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to import items", description: error.message, variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest(`/api/uat-items/${itemId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "status"] });
      toast({ title: "Item removed" });
    },
  });

  const duplicateItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest(`/api/uat-items/${itemId}/duplicate`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "status"] });
      toast({ title: "Item duplicated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to duplicate item", description: error.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: ItemFormData & { id: string }) => {
      const { id: itemId, ...updateData } = data;
      return await apiRequest(`/api/uat-items/${itemId}`, "PATCH", updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "status"] });
      setItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({ title: "Item updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update item", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (item: UatChecklistItem) => {
    setEditingItem(item);
    const itemAny = item as any;
    itemForm.reset({
      title: item.title,
      instructions: item.instructions || "",
      itemType: itemAny.itemType || "approval",
      internalNote: itemAny.internalNote || "",
      referenceUrl: itemAny.referenceUrl || "",
    });
    setItemDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    itemForm.reset({
      title: "",
      instructions: "",
      itemType: "approval",
      internalNote: "",
      referenceUrl: "",
    });
    setItemDialogOpen(true);
  };

  const handleItemSubmit = (data: ItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ ...data, id: editingItem.id });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const createGuestMutation = useMutation({
    mutationFn: async (data: GuestFormData) => {
      return await apiRequest(`/api/uat-sessions/${id}/guests`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      setGuestDialogOpen(false);
      guestForm.reset();
      toast({ title: "Reviewer added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add reviewer", description: error.message, variant: "destructive" });
    },
  });

  const deleteGuestMutation = useMutation({
    mutationFn: async (guestId: string) => {
      return await apiRequest(`/api/uat-guests/${guestId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      toast({ title: "Reviewer removed" });
    },
  });

  const createCollaboratorMutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      return await apiRequest(`/api/uat-sessions/${id}/collaborators`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "collaborators"] });
      setCollaboratorDialogOpen(false);
      collaboratorForm.reset();
      toast({ title: "PM collaborator added" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add collaborator", description: error.message, variant: "destructive" });
    },
  });

  const deleteCollaboratorMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      return await apiRequest(`/api/uat-collaborators/${collaboratorId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id, "collaborators"] });
      toast({ title: "Collaborator removed" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return await apiRequest(`/api/uat-sessions/${id}`, "PATCH", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions"] });
      toast({ title: "Session status updated" });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: { password?: string; generate?: boolean }): Promise<{ password: string }> => {
      const response = await apiRequest(`/api/uat-sessions/${id}/password`, "POST", data);
      return response.json();
    },
    onSuccess: (result: { password: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      setGeneratedPassword(result.password);
      setCustomPassword("");
      setPasswordDialogOpen(false);
      toast({ title: "Password set successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to set password", description: error.message, variant: "destructive" });
    },
  });

  const removePasswordMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/uat-sessions/${id}/password`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions", id] });
      setGeneratedPassword(null);
      toast({ title: "Password removed" });
    },
  });

  const sendUpdateEmailMutation = useMutation({
    mutationFn: async (): Promise<{ message: string; sentTo: string[] }> => {
      const response = await apiRequest(`/api/uat-sessions/${id}/send-update`, "POST");
      return response.json();
    },
    onSuccess: (result) => {
      toast({ 
        title: "Update email sent", 
        description: `Sent to ${result.sentTo.length} recipient(s)` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to send email", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // UAT links always use the custom domain for white-label branding
  const uatBaseUrl = import.meta.env.VITE_UAT_CUSTOM_DOMAIN || 'https://testhub.us';

  const getReviewerLink = (guest: UatGuest) => {
    return `${uatBaseUrl}/r/${guest.accessToken}`;
  };

  const getCollaboratorPortalLink = (collaborator: UatSessionCollaborator) => {
    const prefix = collaborator.role === "developer" ? "/d/" : "/p/";
    return `${uatBaseUrl}${prefix}${collaborator.accessToken}`;
  };

  const copyReviewerLink = (guest: UatGuest) => {
    navigator.clipboard.writeText(getReviewerLink(guest));
    toast({ title: "Reviewer link copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case "active":
        return <Badge variant="default"><AlertCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "completed":
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get item status from status data
  const getItemStatus = (itemId: string): "pending" | "passed" | "failed" | "partial" => {
    const statusItem = statusData?.items.find(i => i.id === itemId);
    return statusItem?.itemStatus || "pending";
  };

  // Filter and sort checklist items
  const filteredChecklistItems = useMemo(() => {
    if (!session) return [];
    let result = [...session.checklistItems];
    
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
      result = result.filter(item => getItemStatus(item.id) === itemStatusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (itemSortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "status":
          comparison = getItemStatus(a.id).localeCompare(getItemStatus(b.id));
          break;
        case "order":
        default:
          comparison = (a.order || 0) - (b.order || 0);
          break;
      }
      return itemSortOrder === "desc" ? -comparison : comparison;
    });
    
    return result;
  }, [session?.checklistItems, itemSearchQuery, itemStatusFilter, itemSortBy, itemSortOrder, statusData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Session not found</h3>
            <Button onClick={() => navigate("/uat")}>Back to Sessions</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/uat")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.name}</h1>
            {getStatusBadge(session.status)}
          </div>
          {session.description && (
            <p className="text-muted-foreground mt-1">{session.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => sendUpdateEmailMutation.mutate()}
            disabled={sendUpdateEmailMutation.isPending}
          >
            <Mail className="w-4 h-4 mr-2" />
            {sendUpdateEmailMutation.isPending ? "Sending..." : "Send Update Email"}
          </Button>
          {session.status === "draft" && (
            <Button onClick={() => updateStatusMutation.mutate("active")}>
              Activate Session
            </Button>
          )}
          {session.status === "active" && (
            <Button variant="outline" onClick={() => updateStatusMutation.mutate("completed")}>
              Mark Complete
            </Button>
          )}
        </div>
      </div>

      {session.project && (
        <div className="text-sm text-muted-foreground">
          Project: <span className="font-medium">{session.project.name}</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{session.checklistItems.length}</div>
            <div className="text-sm text-muted-foreground">Total Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{session.guests.length}</div>
            <div className="text-sm text-muted-foreground">Reviewers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${session.status === "completed" ? "text-green-600" : session.status === "active" ? "text-blue-600" : "text-muted-foreground"}`}>
              {session.status === "completed" ? "Done" : session.status === "active" ? "Active" : "Draft"}
            </div>
            <div className="text-sm text-muted-foreground">Session Status</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{collaborators.length}</div>
            <div className="text-sm text-muted-foreground">PM Collaborators</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="checklist" className="space-y-4">
        <TabsList>
          <TabsTrigger value="checklist">
            Checklist ({session.checklistItems.length})
          </TabsTrigger>
          <TabsTrigger value="status">
            <Activity className="w-4 h-4 mr-1" />
            Status
          </TabsTrigger>
          <TabsTrigger value="reviewers">
            Reviewers ({session.guests.length})
          </TabsTrigger>
          <TabsTrigger value="sharing">
            <Share2 className="w-4 h-4 mr-1" />
            PM Sharing ({collaborators.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checklist" className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Items reviewers will need to approve
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import JSON
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
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
                  <SelectItem value="passed">Passed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
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
            {filteredChecklistItems.length !== session.checklistItems.length && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredChecklistItems.length} of {session.checklistItems.length} items
              </div>
            )}
          </div>

          {session.checklistItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <h3 className="text-lg font-medium mb-2">No checklist items yet</h3>
                <p className="text-muted-foreground mb-4">Add items that reviewers need to approve</p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
                </Button>
              </CardContent>
            </Card>
          ) : filteredChecklistItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No items match your filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredChecklistItems.map((item, index) => {
                const itemAny = item as any;
                const typeInfo = itemTypeLabels[itemAny.itemType || "approval"] || itemTypeLabels.approval;
                const TypeIcon = typeInfo.icon;
                return (
                  <Card key={item.id}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-4">
                        <div className="flex items-center gap-2 text-muted-foreground pt-1">
                          <GripVertical className="w-4 h-4" />
                          <span className="text-sm font-medium w-6">{index + 1}</span>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium">{item.title}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {typeInfo.label}
                              </Badge>
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
                                disabled={duplicateItemMutation.isPending}
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
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {item.instructions && (
                            <div className="text-sm text-muted-foreground">{item.instructions}</div>
                          )}
                          {itemAny.referenceUrl && (
                            <a 
                              href={itemAny.referenceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-primary flex items-center gap-1 hover:underline"
                            >
                              <Link className="w-3 h-3" />
                              {itemAny.referenceUrl}
                            </a>
                          )}
                          {itemAny.internalNote && (
                            <div className="text-xs p-2 rounded bg-muted border-l-2 border-amber-500">
                              <span className="font-medium text-amber-600">Internal Note:</span>{" "}
                              <span className="text-muted-foreground">{itemAny.internalNote}</span>
                            </div>
                          )}
                          <Collapsible
                            open={expandedItems.has(item.id)}
                            onOpenChange={(open) => {
                              const newSet = new Set(expandedItems);
                              if (open) {
                                newSet.add(item.id);
                              } else {
                                newSet.delete(item.id);
                              }
                              setExpandedItems(newSet);
                            }}
                          >
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="mt-2 text-xs">
                                {expandedItems.has(item.id) ? (
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 mr-1" />
                                )}
                                <ListChecks className="w-3 h-3 mr-1" />
                                Test Steps
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 pt-3 border-t space-y-4">
                              <UatStepsEditor itemId={item.id} />
                              <UatItemComments
                                itemId={item.id}
                                itemTitle={item.title}
                                apiEndpoint="/api/uat-items"
                                currentUserName={currentUserName}
                                currentUserId={user?.id}
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-6">
          {statusLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : statusData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{statusData.summary.totalItems}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{statusData.summary.passedItems}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{statusData.summary.failedItems}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-600">{statusData.summary.partialItems}</div>
                    <div className="text-sm text-muted-foreground">Partial</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{statusData.summary.pendingItems}</div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Item Status</CardTitle>
                  <CardDescription>Current status of each checklist item with review tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Steps</TableHead>
                        <TableHead>Last Reviewed</TableHead>
                        <TableHead>Last Resolved</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statusData.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.order + 1}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{item.title}</TableCell>
                          <TableCell>
                            {item.itemStatus === 'passed' && (
                              <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Passed</Badge>
                            )}
                            {item.itemStatus === 'failed' && (
                              <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>
                            )}
                            {item.itemStatus === 'partial' && (
                              <Badge className="bg-amber-600"><AlertCircle className="w-3 h-3 mr-1" />Partial</Badge>
                            )}
                            {item.itemStatus === 'pending' && (
                              <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.totalSteps > 0 ? (
                              <span className={item.passedSteps === item.totalSteps ? 'text-green-600' : item.failedSteps > 0 ? 'text-red-600' : ''}>
                                {item.passedSteps}/{item.totalSteps}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No steps</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.lastReviewedAt ? (
                              <div>
                                <div className="font-medium">{item.lastReviewedByName || 'Unknown'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(item.lastReviewedAt), 'MMM d, h:mm a')}
                                </div>
                                {item.lastReviewedByType && (
                                  <Badge variant="outline" className="text-xs mt-1">{item.lastReviewedByType}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Not reviewed</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {item.lastResolvedAt ? (
                              <div>
                                <div className="font-medium text-green-600">{item.lastResolvedByName || 'Unknown'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(item.lastResolvedAt), 'MMM d, h:mm a')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {statusData.testRuns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Test Run History
                    </CardTitle>
                    <CardDescription>History of test runs for this session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Run #</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Completed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusData.testRuns.map((run) => (
                          <TableRow key={run.id}>
                            <TableCell className="font-medium">
                              Run {run.runNumber}
                              {run.id === statusData.activeRunId && (
                                <Badge variant="default" className="ml-2">Active</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {run.status === 'active' && <Badge variant="default">Active</Badge>}
                              {run.status === 'completed' && <Badge className="bg-green-600">Completed</Badge>}
                              {run.status === 'abandoned' && <Badge variant="secondary">Abandoned</Badge>}
                            </TableCell>
                            <TableCell className="text-sm">
                              {run.startedAt ? format(new Date(run.startedAt), 'MMM d, h:mm a') : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {run.completedAt ? format(new Date(run.completedAt), 'MMM d, h:mm a') : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Unable to load status data</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reviewers" className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Session Access</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {(session as { accessPassword?: string }).accessPassword ? (
                    <>
                      <Badge variant="outline" className="text-green-600">
                        <Lock className="w-3 h-3 mr-1" />
                        Password Protected
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removePasswordMutation.mutate()}
                        disabled={removePasswordMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary">No Password</Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPasswordDialogOpen(true)}
                      >
                        <Key className="w-3 h-3 mr-1" />
                        Set Password
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            {generatedPassword && (
              <CardContent className="py-3 pt-0">
                <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-md border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Password (copy now - shown once):</p>
                      <code className="text-lg font-mono font-bold">{generatedPassword}</code>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        toast({ title: "Password copied" });
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Each reviewer gets a unique link to submit their feedback
            </p>
            <Button onClick={() => setGuestDialogOpen(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add Reviewer
            </Button>
          </div>

          {session.guests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No reviewers yet</h3>
                <p className="text-muted-foreground mb-4">Add reviewers who will provide feedback on the checklist</p>
                <Button onClick={() => setGuestDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add First Reviewer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {session.guests.map((guest) => (
                <Card key={guest.id}>
                  <CardContent className="py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{guest.name}</div>
                      <div className="text-sm text-muted-foreground">{guest.email}</div>
                      {guest.lastAccessedAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last accessed {formatDistanceToNow(new Date(guest.lastAccessedAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyReviewerLink(guest)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(getReviewerLink(guest), "_blank")}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm("Remove this reviewer?")) {
                            deleteGuestMutation.mutate(guest.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sharing" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">Share with Partner PMs</p>
              <p className="text-sm text-muted-foreground">
                External agency PMs can manage reviewers and view progress via their own portal link
              </p>
            </div>
            <Button onClick={() => setCollaboratorDialogOpen(true)}>
              <Share2 className="w-4 h-4 mr-2" />
              Add PM Collaborator
            </Button>
          </div>

          {collaborators.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Share2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No PM collaborators yet</h3>
                <p className="text-muted-foreground mb-4">
                  Share this session with partner agency PMs for external collaboration
                </p>
                <Button onClick={() => setCollaboratorDialogOpen(true)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Add First Collaborator
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {collaborators.map((collaborator) => (
                <Card key={collaborator.id}>
                  <CardContent className="py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{collaborator.name}</div>
                        <Badge variant="outline" className="text-xs">
                          {collaborator.role.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{collaborator.email}</div>
                      {collaborator.lastAccessedAt && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Last accessed {formatDistanceToNow(new Date(collaborator.lastAccessedAt), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(getCollaboratorPortalLink(collaborator));
                          toast({ title: `${collaborator.role === "developer" ? "Developer" : "PM"} portal link copied` });
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(getCollaboratorPortalLink(collaborator), "_blank")}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          if (confirm("Remove this collaborator?")) {
                            deleteCollaboratorMutation.mutate(collaborator.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={collaboratorDialogOpen} onOpenChange={setCollaboratorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add PM Collaborator</DialogTitle>
            <DialogDescription>
              Share this session with a partner agency PM. They'll get a portal link to manage reviewers and view progress.
            </DialogDescription>
          </DialogHeader>
          <Form {...collaboratorForm}>
            <form onSubmit={collaboratorForm.handleSubmit((data) => createCollaboratorMutation.mutate(data))} className="space-y-4">
              <FormField
                control={collaboratorForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={collaboratorForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@partner-agency.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={collaboratorForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pm">PM (Full Access)</SelectItem>
                        <SelectItem value="editor">Editor (Can modify items)</SelectItem>
                        <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
                        <SelectItem value="developer">Developer (Test & Comment)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCollaboratorDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCollaboratorMutation.isPending}>
                  {createCollaboratorMutation.isPending ? "Adding..." : "Add Collaborator"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={(open) => {
        setItemDialogOpen(open);
        if (!open) setEditingItem(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Checklist Item" : "Add Checklist Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the checklist item details" : "Add an item that reviewers need to approve"}
            </DialogDescription>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(handleItemSubmit)} className="space-y-4">
              <FormField
                control={itemForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Review dashboard layout" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemForm.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instructions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Specific steps or things to check..."
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemForm.control}
                name="itemType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Response Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(itemTypeLabels).map(([key, { label, description }]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex flex-col">
                              <span>{label}</span>
                              <span className="text-xs text-muted-foreground">{description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemForm.control}
                name="referenceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/page-to-review" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={itemForm.control}
                name="internalNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Notes for your team (not visible to reviewers)..."
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setItemDialogOpen(false);
                  setEditingItem(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending}>
                  {editingItem ? (updateItemMutation.isPending ? "Saving..." : "Save Changes") : (createItemMutation.isPending ? "Adding..." : "Add Item")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={guestDialogOpen} onOpenChange={setGuestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reviewer</DialogTitle>
            <DialogDescription>
              Add someone to review this UAT session
            </DialogDescription>
          </DialogHeader>
          <Form {...guestForm}>
            <form onSubmit={guestForm.handleSubmit((data) => createGuestMutation.mutate(data))} className="space-y-4">
              <FormField
                control={guestForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Reviewer's name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={guestForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="reviewer@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setGuestDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createGuestMutation.isPending}>
                  Add Reviewer
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Session Password</DialogTitle>
            <DialogDescription>
              Protect this review session with a password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a custom password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button 
                  onClick={() => setPasswordMutation.mutate({ password: customPassword })}
                  disabled={!customPassword.trim() || setPasswordMutation.isPending}
                >
                  Set
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setPasswordMutation.mutate({ generate: true })}
              disabled={setPasswordMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Random Password
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setImportError(null);
          setShowPrompt(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import UAT Items from JSON</DialogTitle>
            <DialogDescription>
              Paste JSON generated by Cursor or another AI tool to bulk import checklist items and test steps
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={showPrompt ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPrompt(!showPrompt)}
              >
                <Code className="w-4 h-4 mr-2" />
                {showPrompt ? "Hide Cursor Prompt" : "Show Cursor Prompt"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(UAT_CURSOR_PROMPT);
                  toast({ title: "Copied", description: "Cursor prompt copied to clipboard" });
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Prompt
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportJson(UAT_IMPORT_TEMPLATE);
                  setImportError(null);
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Load Template
              </Button>
            </div>

            {showPrompt && (
              <div className="bg-muted p-3 rounded-lg overflow-auto max-h-48">
                <pre className="text-xs whitespace-pre-wrap font-mono">{UAT_CURSOR_PROMPT}</pre>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">JSON Data</label>
              <Textarea
                placeholder='Paste your JSON here...\n\n{\n  "version": "1.0",\n  "items": [...]\n}'
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  setImportError(null);
                }}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            {importError && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                <strong>Validation Error:</strong> {importError}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(importJson);
                    const validation = uatImportSchema.safeParse(parsed);
                    if (!validation.success) {
                      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                      setImportError(errors);
                    } else {
                      setImportError(null);
                      const itemCount = validation.data.items.length;
                      const stepCount = validation.data.items.reduce((acc, item) => acc + (item.steps?.length || 0), 0);
                      toast({ title: "Valid JSON", description: `${itemCount} items with ${stepCount} steps ready to import` });
                    }
                  } catch (e) {
                    setImportError("Invalid JSON format - please check your syntax");
                  }
                }}
                disabled={!importJson.trim()}
              >
                Validate
              </Button>
              <Button
                onClick={() => {
                  try {
                    const parsed = JSON.parse(importJson);
                    const validation = uatImportSchema.safeParse(parsed);
                    if (!validation.success) {
                      const errors = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                      setImportError(errors);
                      return;
                    }
                    importItemsMutation.mutate(parsed);
                  } catch (e) {
                    setImportError("Invalid JSON format - please check your syntax");
                  }
                }}
                disabled={!importJson.trim() || importItemsMutation.isPending}
              >
                {importItemsMutation.isPending ? "Importing..." : "Import Items"}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
