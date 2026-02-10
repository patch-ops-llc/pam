import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Calendar, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import type { Holiday } from "@shared/schema";
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

type HolidayFormData = {
  name: string;
  date: string;
  endDate?: string;
};

function HolidayRow({
  holiday,
  onSuccess,
  onCancel,
}: {
  holiday?: Holiday;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<HolidayFormData>(
    holiday
      ? {
          name: holiday.name,
          date: holiday.date,
          endDate: holiday.endDate || "",
        }
      : {
          name: "",
          date: "",
          endDate: "",
        }
  );

  const createMutation = useMutation({
    mutationFn: async (data: HolidayFormData) => {
      const submitData = {
        ...data,
        endDate: data.endDate && data.endDate.trim() !== "" ? data.endDate : undefined,
      };
      return apiRequest("/api/holidays", "POST", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      toast({ title: "Holiday Added" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to add holiday", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: HolidayFormData) => {
      if (!holiday) return;
      const submitData = {
        ...data,
        endDate: data.endDate && data.endDate.trim() !== "" ? data.endDate : undefined,
      };
      return apiRequest(`/api/holidays/${holiday.id}`, "PATCH", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      toast({ title: "Holiday Updated" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to update holiday", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.date) {
      toast({
        title: "Validation Error",
        description: "Please fill in holiday name and date",
        variant: "destructive",
      });
      return;
    }

    if (formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
      toast({
        title: "Validation Error",
        description: "End date must be on or after start date",
        variant: "destructive",
      });
      return;
    }

    if (holiday) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <TableRow>
      <TableCell>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., New Year's Day"
          data-testid={holiday ? `input-edit-name-${holiday.id}` : "input-new-name"}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          data-testid={holiday ? `input-edit-date-${holiday.id}` : "input-new-date"}
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={formData.endDate || ""}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          placeholder="Optional"
          data-testid={holiday ? `input-edit-end-${holiday.id}` : "input-new-end"}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSubmit}
            disabled={isPending}
            data-testid={holiday ? `button-save-${holiday.id}` : "button-save-new"}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            disabled={isPending}
            data-testid={holiday ? `button-cancel-edit-${holiday.id}` : "button-cancel-new"}
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function HolidaysTab() {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/holidays/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setDeleteId(null);
      toast({ title: "Holiday Deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete holiday", variant: "destructive" });
    },
  });

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Company Holidays
              </CardTitle>
              <CardDescription>Manage company-wide holidays that affect capacity calculations</CardDescription>
            </div>
            <Button onClick={() => setIsAddingNew(!isAddingNew)} data-testid="button-add-holiday">
              <Plus className="h-4 w-4 mr-2" />
              {isAddingNew ? "Cancel" : "Add Holiday"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading holidays...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Holiday Name</TableHead>
                  <TableHead className="w-[150px]">Start Date</TableHead>
                  <TableHead className="w-[150px]">End Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAddingNew && (
                  <HolidayRow onSuccess={() => setIsAddingNew(false)} onCancel={() => setIsAddingNew(false)} />
                )}
                {sortedHolidays.length === 0 && !isAddingNew ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No company holidays configured</p>
                      <p className="text-sm mt-1">Add holidays to exclude them from capacity calculations</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedHolidays.map((holiday) => {
                    if (editingId === holiday.id) {
                      return (
                        <HolidayRow
                          key={holiday.id}
                          holiday={holiday}
                          onSuccess={() => setEditingId(null)}
                          onCancel={() => setEditingId(null)}
                        />
                      );
                    }

                    return (
                      <TableRow key={holiday.id} data-testid={`holiday-${holiday.id}`}>
                        <TableCell className="font-medium" data-testid={`text-holiday-name-${holiday.id}`}>
                          {holiday.name}
                        </TableCell>
                        <TableCell data-testid={`text-holiday-date-${holiday.id}`}>{holiday.date}</TableCell>
                        <TableCell>{holiday.endDate || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingId(holiday.id)}
                              data-testid={`button-edit-holiday-${holiday.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(holiday.id)}
                              data-testid={`button-delete-holiday-${holiday.id}`}
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
        <AlertDialogContent data-testid="dialog-delete-holiday">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Holiday?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the holiday from the system. This action cannot be undone.
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
