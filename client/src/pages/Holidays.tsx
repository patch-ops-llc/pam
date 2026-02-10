import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
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

const holidaySchema = z.object({
  name: z.string().min(1, "Holiday name is required"),
  date: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
}).refine((data) => {
  if (!data.endDate) return true;
  // Append T00:00:00 to parse dates in local timezone consistently
  return new Date(data.endDate + 'T00:00:00') >= new Date(data.date + 'T00:00:00');
}, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

type HolidayFormData = z.infer<typeof holidaySchema>;

export default function Holidays() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteHolidayId, setDeleteHolidayId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"]
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (data: HolidayFormData) => {
      return apiRequest("/api/holidays", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Holiday Added",
        description: "The company holiday has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add holiday. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/holidays/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      setDeleteHolidayId(null);
      toast({
        title: "Holiday Deleted",
        description: "The company holiday has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete holiday. Please try again.",
        variant: "destructive",
      });
    }
  });

  const form = useForm<HolidayFormData>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      date: "",
      endDate: ""
    }
  });

  function onSubmit(data: HolidayFormData) {
    // Convert empty endDate string to undefined for proper backend handling
    const submitData = {
      ...data,
      endDate: data.endDate && data.endDate.trim() !== '' ? data.endDate : undefined
    };
    addHolidayMutation.mutate(submitData);
  }

  // Sort holidays by date
  const sortedHolidays = [...holidays].sort((a, b) => 
    new Date(a.date + 'T00:00:00').getTime() - new Date(b.date + 'T00:00:00').getTime()
  );

  // Group by year
  const holidaysByYear = sortedHolidays.reduce((acc, holiday) => {
    const year = new Date(holiday.date + 'T00:00:00').getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(holiday);
    return acc;
  }, {} as Record<number, Holiday[]>);

  const years = Object.keys(holidaysByYear).map(Number).sort((a, b) => b - a);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Company Holidays</h1>
          <p className="text-muted-foreground mt-1">
            Manage company-wide holidays that affect capacity calculations
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-holiday">
          <Plus className="h-4 w-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">Loading holidays...</div>
          </CardContent>
        </Card>
      ) : sortedHolidays.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No company holidays configured</p>
              <p className="text-sm mt-1">Add holidays to exclude them from capacity calculations</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {years.map(year => (
            <Card key={year}>
              <CardHeader>
                <CardTitle>{year}</CardTitle>
                <CardDescription>
                  {holidaysByYear[year].length} {holidaysByYear[year].length === 1 ? 'holiday' : 'holidays'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {holidaysByYear[year].map((holiday) => (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                      data-testid={`holiday-${holiday.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium" data-testid={`text-holiday-name-${holiday.id}`}>
                            {holiday.name}
                          </div>
                          <div className="text-sm text-muted-foreground" data-testid={`text-holiday-date-${holiday.id}`}>
                            {holiday.endDate ? (
                              <>
                                {format(new Date(holiday.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')} - {format(new Date(holiday.endDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                              </>
                            ) : (
                              format(new Date(holiday.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteHolidayId(holiday.id)}
                        data-testid={`button-delete-holiday-${holiday.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent data-testid="dialog-add-holiday">
          <DialogHeader>
            <DialogTitle>Add Company Holiday</DialogTitle>
            <DialogDescription>
              Add a company-wide holiday that will be excluded from capacity calculations.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Holiday Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., New Year's Day" 
                        {...field}
                        data-testid="input-holiday-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        data-testid="input-holiday-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        data-testid="input-holiday-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel-holiday"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={addHolidayMutation.isPending}
                  data-testid="button-submit-holiday"
                >
                  {addHolidayMutation.isPending ? "Adding..." : "Add Holiday"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteHolidayId !== null} onOpenChange={() => setDeleteHolidayId(null)}>
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
              onClick={() => deleteHolidayId && deleteHolidayMutation.mutate(deleteHolidayId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteHolidayMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
