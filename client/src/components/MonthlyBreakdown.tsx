import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Calendar, User, Building2, FolderOpen, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

type MonthlyBreakdownData = {
  agency: {
    id: string;
    name: string;
    description?: string;
  };
  account: {
    id: string;
    name: string;
    description?: string;
  };
  project: {
    id: string;
    name: string;
    description?: string;
  } | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  actualHours: number;
  billedHours: number;
};

export function MonthlyBreakdown() {
  // Fetch monthly breakdown data
  const { data: breakdownData = [], isLoading, error } = useQuery<MonthlyBreakdownData[]>({
    queryKey: ["analytics", "monthly-breakdown"],
    queryFn: async () => {
      const response = await fetch('/api/analytics/monthly-breakdown', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch monthly breakdown');
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <Skeleton className="h-6 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="ml-4 space-y-3">
                  <Skeleton className="h-5 w-64" />
                  <div className="ml-4 space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <div className="ml-4 space-y-1">
                      {Array.from({ length: 2 }).map((_, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <Skeleton className="h-4 w-32" />
                          <div className="flex gap-2">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load monthly breakdown data. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  // Group data by agency -> account -> project -> user
  const groupedData = breakdownData.reduce((acc, item) => {
    const agencyKey = item.agency.id;
    const accountKey = item.account.id;
    const projectKey = item.project?.id || 'no-project';

    if (!acc[agencyKey]) {
      acc[agencyKey] = {
        agency: item.agency,
        accounts: {}
      };
    }

    if (!acc[agencyKey].accounts[accountKey]) {
      acc[agencyKey].accounts[accountKey] = {
        account: item.account,
        projects: {}
      };
    }

    if (!acc[agencyKey].accounts[accountKey].projects[projectKey]) {
      acc[agencyKey].accounts[accountKey].projects[projectKey] = {
        project: item.project,
        users: []
      };
    }

    acc[agencyKey].accounts[accountKey].projects[projectKey].users.push({
      user: item.user,
      actualHours: item.actualHours,
      billedHours: item.billedHours
    });

    return acc;
  }, {} as any);

  // Calculate totals
  const totalActualHours = breakdownData.reduce((sum, item) => sum + item.actualHours, 0);
  const totalBilledHours = breakdownData.reduce((sum, item) => sum + item.billedHours, 0);
  const efficiency = totalActualHours > 0 ? (totalBilledHours / totalActualHours) * 100 : 0;

  const currentMonth = format(new Date(), 'MMMM yyyy');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Monthly Hours Breakdown - {currentMonth}</CardTitle>
          </div>
          <div className="flex gap-4">
            <Badge variant="outline" className="gap-1">
              <Target className="h-3 w-3" />
              Actual: {totalActualHours.toFixed(2)}h
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Target className="h-3 w-3" />
              Billed: {totalBilledHours.toFixed(1)}h
            </Badge>
            <Badge variant={efficiency >= 100 ? "default" : "secondary"} className="gap-1">
              <Target className="h-3 w-3" />
              {efficiency.toFixed(2)}% Efficiency
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedData).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No time logs found for {currentMonth}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(groupedData).map((agencyGroup: any) => (
              <div key={agencyGroup.agency.id} className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg">{agencyGroup.agency.name}</h3>
                </div>

                <div className="ml-4 space-y-4">
                  {Object.values(agencyGroup.accounts).map((accountGroup: any) => (
                    <div key={accountGroup.account.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium text-base">{accountGroup.account.name}</h4>
                      </div>

                      <div className="ml-6 space-y-3">
                        {Object.values(accountGroup.projects).map((projectGroup: any) => (
                          <div key={projectGroup.project?.id || 'no-project'} className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Target className="h-3 w-3" />
                              <span>{projectGroup.project?.name || 'No Project'}</span>
                            </div>

                            <div className="ml-6 space-y-1">
                              {projectGroup.users
                                .sort((a: any, b: any) => 
                                  a.user.firstName.localeCompare(b.user.firstName) ||
                                  a.user.lastName.localeCompare(b.user.lastName)
                                )
                                .map((userItem: any) => (
                                <div key={userItem.user.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm">
                                      {userItem.user.firstName} {userItem.user.lastName}
                                    </span>
                                  </div>
                                  <div className="flex gap-3 text-sm">
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Actual:</span>
                                      <span className="font-medium">{userItem.actualHours.toFixed(1)}h</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Billed:</span>
                                      <span className="font-medium">{userItem.billedHours.toFixed(2)}h</span>
                                    </div>
                                    <Badge 
                                      variant={
                                        userItem.actualHours > 0 && (userItem.billedHours / userItem.actualHours) >= 1 
                                          ? "default" 
                                          : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {userItem.actualHours > 0 
                                        ? ((userItem.billedHours / userItem.actualHours) * 100).toFixed(0)
                                        : 0
                                      }%
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}