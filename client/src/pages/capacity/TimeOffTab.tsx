import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { CalendarDays, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { User, UserAvailabilityWithUser } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

type TimeOffFormData = {
  userId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  notes?: string;
};

function TimeOffRow({
  availability,
  users,
  onSuccess,
  onCancel,
}: {
  availability?: UserAvailabilityWithUser;
  users: User[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<TimeOffFormData>(
    availability
      ? {
          userId: availability.userId,
          startDate: availability.startDate,
          endDate: availability.endDate,
          reason: availability.reason || "",
          notes: availability.notes || "",
        }
      : {
          userId: "",
          startDate: "",
          endDate: "",
          reason: "",
          notes: "",
        }
  );

  const createMutation = useMutation({
    mutationFn: async (data: TimeOffFormData) => {
      return apiRequest("/api/user-availability", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-availability"] });
      toast({ title: "Time Off Added" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to add time off", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TimeOffFormData) => {
      if (!availability) return;
      return apiRequest(`/api/user-availability/${availability.id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-availability"] });
      toast({ title: "Time Off Updated" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to update time off", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.userId || !formData.startDate || !formData.endDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (availability) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <TableRow>
      <TableCell>
        <Select
          value={formData.userId}
          onValueChange={(value) => setFormData({ ...formData, userId: value })}
          disabled={!!availability}
        >
          <SelectTrigger data-testid={availability ? `select-edit-user-${availability.id}` : "select-new-user"}>
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          data-testid={availability ? `input-edit-start-${availability.id}` : "input-new-start"}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          data-testid={availability ? `input-edit-end-${availability.id}` : "input-new-end"}
        />
      </TableCell>
      <TableCell>
        <Input
          value={formData.reason || ""}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Vacation, PTO, etc."
          data-testid={availability ? `input-edit-reason-${availability.id}` : "input-new-reason"}
        />
      </TableCell>
      <TableCell>
        <Input
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes"
          data-testid={availability ? `input-edit-notes-${availability.id}` : "input-new-notes"}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSubmit}
            disabled={isPending}
            data-testid={availability ? `button-save-${availability.id}` : "button-save-new"}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
            data-testid={availability ? `button-cancel-edit-${availability.id}` : "button-cancel-new"}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function TimeOffTab() {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: availability = [], isLoading } = useQuery<UserAvailabilityWithUser[]>({
    queryKey: ["/api/user-availability"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/user-availability/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-availability"] });
      setDeleteId(null);
      toast({ title: "Time Off Deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete time off", variant: "destructive" });
    },
  });

  // Sort by start date (most recent first)
  const sortedAvailability = [...availability].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Team Time Off
              </CardTitle>
              <CardDescription>Manage team member time off and availability</CardDescription>
            </div>
            <Button onClick={() => setIsAddingNew(!isAddingNew)} data-testid="button-add-time-off">
              <Plus className="h-4 w-4 mr-2" />
              {isAddingNew ? "Cancel" : "Add Time Off"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading time off entries...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Team Member</TableHead>
                  <TableHead className="w-[150px]">Start Date</TableHead>
                  <TableHead className="w-[150px]">End Date</TableHead>
                  <TableHead className="w-[150px]">Reason</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingNew && (
                  <TimeOffRow
                    users={users}
                    onSuccess={() => setIsAddingNew(false)}
                    onCancel={() => setIsAddingNew(false)}
                  />
                )}
                {sortedAvailability.length === 0 && !isAddingNew ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No time off entries configured</p>
                      <p className="text-sm mt-1">Add time off entries to track team availability</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedAvailability.map((avail) => {
                    if (editingId === avail.id) {
                      return (
                        <TimeOffRow
                          key={avail.id}
                          availability={avail}
                          users={users}
                          onSuccess={() => setEditingId(null)}
                          onCancel={() => setEditingId(null)}
                        />
                      );
                    }

                    const user = users.find((u) => u.id === avail.userId);
                    return (
                      <TableRow key={avail.id} data-testid={`time-off-${avail.id}`}>
                        <TableCell className="font-medium">
                          {user ? `${user.firstName} ${user.lastName}` : "Unknown User"}
                        </TableCell>
                        <TableCell>{avail.startDate}</TableCell>
                        <TableCell>{avail.endDate}</TableCell>
                        <TableCell>{avail.reason || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{avail.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingId(avail.id)}
                              data-testid={`button-edit-time-off-${avail.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(avail.id)}
                              data-testid={`button-delete-time-off-${avail.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent data-testid="dialog-delete-time-off">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Off Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the time off entry from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
