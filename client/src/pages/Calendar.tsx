import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Building2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isToday, isTomorrow, isYesterday } from "date-fns";

type CalendarConnection = {
  id: string;
  userId: string;
  calendarId: string;
  calendarName: string;
  accessToken: string;
  refreshToken?: string;
  isActive: boolean;
  lastSyncAt?: string;
  createdAt: string;
};

type CalendarEvent = {
  id: string;
  calendarConnectionId: string;
  googleEventId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
  isAllDay: boolean;
  createdAt: string;
};

export default function Calendar() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  
  // Handle OAuth callback messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error = params.get("error");
    
    if (success === "calendar_connected") {
      toast({
        title: "Calendar Connected",
        description: "Your Google Calendar has been connected successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-connections"] });
      // Clean up URL params
      setLocation("/calendar");
    }
    
    if (error === "connection_failed") {
      toast({
        title: "Error connecting calendar",
        description: "Failed to connect to Google Calendar. Please check your Google account permissions and try again.",
        variant: "destructive",
      });
      // Clean up URL params
      setLocation("/calendar");
    }
  }, [toast, setLocation]);
  
  // Fetch calendar connections
  const { data: connections = [], isLoading: connectionsLoading, error: connectionsError } = useQuery<CalendarConnection[]>({
    queryKey: ["/api/calendar-connections"]
  });

  // Fetch calendar events for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events", {
      start: startOfMonth.toISOString(),
      end: endOfMonth.toISOString()
    }],
    enabled: connections.length > 0
  });

  // Handle calendar connection by redirecting to OAuth
  const handleConnectCalendar = () => {
    window.location.href = "/auth/google/calendar";
  };

  // Disconnect calendar mutation
  const disconnectCalendarMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest(`/api/calendar-connections/${connectionId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({
        title: "Calendar Disconnected",
        description: "Calendar has been disconnected successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnection Failed",
        description: error.message || "Failed to disconnect calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Sync calendar mutation
  const syncCalendarMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      await apiRequest(`/api/calendar-connections/${connectionId}/sync`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({
        title: "Sync Complete",
        description: "Calendar events have been synchronized.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync calendar. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatEventTime = (startTime: string, endTime: string) => {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    
    if (isToday(start)) {
      return `Today ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else if (isTomorrow(start)) {
      return `Tomorrow ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else if (isYesterday(start)) {
      return `Yesterday ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else {
      return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'h:mm a')}`;
    }
  };

  const groupEventsByDate = (events: CalendarEvent[]) => {
    const grouped = events.reduce((acc, event) => {
      const date = format(parseISO(event.startTime), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    }, {} as Record<string, CalendarEvent[]>);

    // Sort events within each day by start time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => 
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });

    return grouped;
  };

  if (connectionsError || eventsError) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            Connect and manage your calendars across teams
          </p>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load calendar data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground">
          Connect and manage your calendars across teams
        </p>
      </div>

      {/* Calendar Connections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Connected Calendars</CardTitle>
            </div>
            <Button 
              onClick={handleConnectCalendar}
              data-testid="button-connect-calendar"
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connectionsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No calendars connected yet</p>
              <p className="text-sm text-muted-foreground mb-6">
                Connect your Google Calendar to start aggregating events across your team
              </p>
              <Button 
                onClick={handleConnectCalendar}
                data-testid="button-connect-first-calendar"
              >
                <Plus className="h-4 w-4 mr-2" />
                Connect Your First Calendar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{connection.calendarName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4">
                        <span>Calendar ID: {connection.calendarId}</span>
                        {connection.lastSyncAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last sync: {format(parseISO(connection.lastSyncAt), 'MMM d, h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={connection.isActive ? "default" : "secondary"}>
                      {connection.isActive ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncCalendarMutation.mutate(connection.id)}
                      disabled={syncCalendarMutation.isPending}
                      data-testid={`button-sync-${connection.id}`}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectCalendarMutation.mutate(connection.id)}
                      disabled={disconnectCalendarMutation.isPending}
                      data-testid={`button-disconnect-${connection.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Events */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Team Calendar Events - {format(now, 'MMMM yyyy')}</CardTitle>
              </div>
              <Badge variant="outline">
                {events.length} events this month
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <div className="space-y-2">
                      {Array.from({ length: 2 }).map((_, j) => (
                        <div key={j} className="flex items-start gap-3 p-3 border rounded-lg">
                          <Skeleton className="h-4 w-4 mt-0.5" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-3 w-32" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No events found</p>
                <p className="text-sm text-muted-foreground">
                  Events from your connected calendars will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupEventsByDate(events))
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, dayEvents]) => (
                  <div key={date} className="space-y-3">
                    <h3 className="font-medium text-sm text-muted-foreground border-b pb-1">
                      {format(parseISO(date), 'EEEE, MMMM d')}
                    </h3>
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                          <div className="h-4 w-1 bg-primary rounded-full mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{event.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatEventTime(event.startTime, event.endTime)}
                            </div>
                            {event.location && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                <ExternalLink className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}
                            {event.description && (
                              <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {event.description}
                              </div>
                            )}
                          </div>
                          {event.attendees && event.attendees.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {event.attendees.length}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}