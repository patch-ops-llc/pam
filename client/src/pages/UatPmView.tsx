import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Clock, Search, Filter, Users, FileText, Eye, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useLocation } from "wouter";
import type { UatSessionWithRelations } from "@shared/schema";

type SortField = "name" | "status" | "createdAt" | "progress";
type SortDirection = "asc" | "desc";

export default function UatPmView() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedSession, setSelectedSession] = useState<UatSessionWithRelations | null>(null);

  const { data: sessions = [], isLoading } = useQuery<UatSessionWithRelations[]>({
    queryKey: ["/api/uat-sessions"],
  });

  const getProgressInfo = (session: UatSessionWithRelations) => {
    const total = session.checklistItems.length;
    const sessionAny = session as UatSessionWithRelations & { responses?: { checklistItemId: string; status: string; feedback?: string }[] };
    const responses = sessionAny.responses || [];
    const completed = new Set(responses.map((r: { checklistItemId: string }) => r.checklistItemId)).size;
    const approved = responses.filter((r: { status: string }) => r.status === "approved").length;
    const changesRequested = responses.filter((r: { status: string }) => r.status === "changes_requested").length;
    return { total, completed, approved, changesRequested };
  };

  const filteredSessions = sessions
    .filter(session => {
      if (statusFilter !== "all" && session.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return session.name.toLowerCase().includes(query) ||
          session.description?.toLowerCase().includes(query) ||
          session.project?.name.toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "progress":
          const aProgress = getProgressInfo(a);
          const bProgress = getProgressInfo(b);
          comparison = (aProgress.total ? aProgress.completed / aProgress.total : 0) - 
                       (bProgress.total ? bProgress.completed / bProgress.total : 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 text-muted-foreground" />;
    return sortDirection === "asc" ? 
      <ChevronUp className="w-4 h-4 ml-1" /> : 
      <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const stats = {
    total: sessions.length,
    draft: sessions.filter(s => s.status === "draft").length,
    active: sessions.filter(s => s.status === "active").length,
    completed: sessions.filter(s => s.status === "completed").length,
    needingAttention: sessions.filter(s => {
      const progress = getProgressInfo(s);
      return progress.changesRequested > 0 && s.status === "active";
    }).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PM Overview</h1>
          <p className="text-muted-foreground">Review and manage all UAT sessions</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/uat")}>
          Back to Sessions
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Sessions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.draft}</div>
            <div className="text-sm text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.needingAttention}</div>
            <div className="text-sm text-muted-foreground">Needs Attention</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Session <SortIcon field="name" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status <SortIcon field="status" />
                  </div>
                </TableHead>
                <TableHead>Reviewers</TableHead>
                <TableHead 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleSort("progress")}
                >
                  <div className="flex items-center">
                    Progress <SortIcon field="progress" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover-elevate"
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center">
                    Created <SortIcon field="createdAt" />
                  </div>
                </TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions.map(session => {
                  const progress = getProgressInfo(session);
                  const progressPercent = progress.total ? (progress.completed / progress.total) * 100 : 0;
                  return (
                    <TableRow key={session.id} className="hover-elevate">
                      <TableCell>
                        <div>
                          <div className="font-medium">{session.name}</div>
                          {session.project && (
                            <div className="text-sm text-muted-foreground">{session.project.name}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {session.guests.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <Progress value={progressPercent} className="h-2" />
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-600">{progress.approved}</span>
                            {progress.changesRequested > 0 && (
                              <span className="text-amber-600">{progress.changesRequested} changes</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setSelectedSession(session)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => navigate(`/uat/${session.id}`)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        {selectedSession && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedSession.name}</DialogTitle>
              <DialogDescription>
                {selectedSession.description || "No description"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedSession.status)}
                {selectedSession.project && (
                  <span className="text-sm text-muted-foreground">
                    Project: {selectedSession.project.name}
                  </span>
                )}
              </div>

              <div>
                <h4 className="font-medium mb-2">Checklist Items ({selectedSession.checklistItems.length})</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {selectedSession.checklistItems.map((item, idx) => {
                    type ResponseType = { checklistItemId: string; status: string; feedback?: string; id: string };
                    const sessionAny = selectedSession as UatSessionWithRelations & { responses?: ResponseType[] };
                    const responses: ResponseType[] = (sessionAny.responses || []).filter((r: ResponseType) => r.checklistItemId === item.id);
                    const hasApproval = responses.some((r: ResponseType) => r.status === "approved");
                    const hasChanges = responses.some((r: ResponseType) => r.status === "changes_requested");
                    return (
                      <div key={item.id} className="p-3 border rounded-md">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">{idx + 1}.</span>
                              <span className="font-medium">{item.title}</span>
                            </div>
                            {item.instructions && (
                              <p className="text-sm text-muted-foreground mt-1">{item.instructions}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {hasApproval && <Badge className="bg-green-600">Approved</Badge>}
                            {hasChanges && <Badge variant="outline">Changes</Badge>}
                            {!hasApproval && !hasChanges && <Badge variant="secondary">Pending</Badge>}
                          </div>
                        </div>
                        {responses.filter((r: ResponseType) => r.feedback).map((r: ResponseType) => (
                          <div key={r.id} className="mt-2 p-2 bg-muted rounded text-sm">
                            <span className="font-medium">Feedback:</span> {r.feedback}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Reviewers ({selectedSession.guests.length})</h4>
                <div className="space-y-2">
                  {selectedSession.guests.map(guest => (
                    <div key={guest.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <div className="font-medium">{guest.name}</div>
                        <div className="text-sm text-muted-foreground">{guest.email}</div>
                      </div>
                      {guest.lastAccessedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last active: {formatDistanceToNow(new Date(guest.lastAccessedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedSession(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  navigate(`/uat/${selectedSession.id}`);
                  setSelectedSession(null);
                }}>
                  Manage Session
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
