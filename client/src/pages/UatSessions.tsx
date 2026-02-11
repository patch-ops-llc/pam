import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, Link2, Copy, Users, CheckCircle2, AlertCircle, Clock, ExternalLink, ChevronRight, CalendarDays, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { insertUatSessionSchema } from "@shared/schema";
import type { UatSession, UatSessionWithRelations, Project, Account, User } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { useLocation } from "wouter";

const sessionFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["draft", "active", "completed"]).default("draft"),
});

type SessionFormData = z.infer<typeof sessionFormSchema>;

export default function UatSessions() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<UatSession | null>(null);

  const { data: sessions = [], isLoading } = useQuery<UatSessionWithRelations[]>({
    queryKey: ["/api/uat-sessions"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      priority: "medium",
      status: "draft",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const response = await apiRequest("/api/uat-sessions", "POST", data);
      return await response.json();
    },
    onSuccess: async (newSession) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions"] });
      setSessionDialogOpen(false);
      form.reset();
      toast({ title: "UAT session created successfully" });
      console.log("Created session:", newSession);
    },
    onError: (error: Error) => {
      console.error("Failed to create session:", error);
      toast({ 
        title: "Failed to create UAT session", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SessionFormData> }) => {
      return await apiRequest(`/api/uat-sessions/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions"] });
      setSessionDialogOpen(false);
      setEditingSession(null);
      form.reset();
      toast({ title: "UAT session updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update UAT session", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/uat-sessions/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uat-sessions"] });
      toast({ title: "UAT session deleted" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete UAT session", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (data: SessionFormData) => {
    if (editingSession) {
      updateMutation.mutate({ id: editingSession.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (session: UatSession) => {
    setEditingSession(session);
    form.reset({
      name: session.name,
      description: session.description || "",
      priority: (session.priority as "low" | "medium" | "high") || "medium",
      status: session.status as "draft" | "active" | "completed",
    });
    setSessionDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingSession(null);
    form.reset({
      name: "",
      description: "",
      priority: "medium",
      status: "draft",
    });
    setSessionDialogOpen(true);
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

  // UAT links always use the custom domain for white-label branding
  const uatBaseUrl = import.meta.env.VITE_UAT_CUSTOM_DOMAIN || 'https://testhub.us';
  
  const getInviteLink = (session: UatSession) => {
    return `${uatBaseUrl}/r/${session.inviteToken}`;
  };

  const copyInviteLink = (session: UatSession) => {
    navigator.clipboard.writeText(getInviteLink(session));
    toast({ title: "Invite link copied to clipboard" });
  };

  const getSessionProgress = (session: UatSessionWithRelations) => {
    const items = session.checklistItems || [];
    const guests = session.guests || [];
    const total = items.length;
    
    if (total === 0) {
      return { total: 0, completed: 0, approved: 0, changesRequested: 0, percent: 0, guestCount: guests.length };
    }
    
    // For each item, check if at least one guest has responded
    let completed = 0;
    let approved = 0;
    let changesRequested = 0;
    
    items.forEach((item: any) => {
      const responses = item.responses || [];
      if (responses.length > 0) {
        completed++;
        const hasApproval = responses.some((r: any) => r.status === "approved");
        const hasChanges = responses.some((r: any) => r.status === "changes_requested");
        if (hasApproval) approved++;
        if (hasChanges) changesRequested++;
      }
    });
    
    return {
      total,
      completed,
      approved,
      changesRequested,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      guestCount: guests.length,
    };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">UAT Sessions</h1>
          <p className="text-muted-foreground">Manage user acceptance testing with external reviewers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/uat/pm")}>
            <LayoutDashboard className="w-4 h-4 mr-2" />
            PM View
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No UAT sessions yet</h3>
            <p className="text-muted-foreground mb-4">Create a session to start collecting feedback from reviewers</p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Session
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover-elevate cursor-pointer group" onClick={() => navigate(`/uat/${session.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{session.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(session.status)}
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </div>
                {session.description && (
                  <CardDescription className="line-clamp-2">{session.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                  <span>Created {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}</span>
                  {session.dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Due {formatDistanceToNow(new Date(session.dueDate), { addSuffix: true })}
                    </span>
                  )}
                </div>
                {(session.checklistItems?.length > 0 || session.guests?.length > 0) && (
                  <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {session.checklistItems?.length || 0} items
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {session.guests?.length || 0} reviewers
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(getInviteLink(session), "_blank")}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Open
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyInviteLink(session)}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEdit(session)}
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this session?")) {
                        deleteMutation.mutate(session.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Create UAT Session"}</DialogTitle>
            <DialogDescription>
              {editingSession ? "Update the session details" : "Create a new session for collecting UAT feedback"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Website Redesign - Round 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of what's being tested..."
                        className="resize-none"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editingSession && (
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSessionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingSession ? "Update Session" : "Create Session"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
