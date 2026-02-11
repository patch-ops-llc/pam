import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Lock, DollarSign, TrendingUp, Calculator, FolderKanban, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FORECAST_PASSWORD, AUTH_KEY } from "./forecasting/utils";
import { ExpensesTab } from "./forecasting/tabs/ExpensesTab";
import { RetainersTab } from "./forecasting/tabs/RetainersTab";
import { InvoicesTab } from "./forecasting/tabs/InvoicesTab";
import { ScenariosTab } from "./forecasting/tabs/ScenariosTab";
import { AccountRevenueTab } from "./forecasting/tabs/AccountRevenueTab";
import { ForecastOverview } from "./forecasting/tabs/ForecastOverview";
import { CapacityTab } from "./forecasting/tabs/CapacityTab";

export default function Forecasting() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const authenticated = sessionStorage.getItem(AUTH_KEY);
    if (authenticated === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === FORECAST_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "true");
      setIsAuthenticated(true);
      setPassword("");
    } else {
      toast({
        title: "Incorrect password",
        description: "Please try again",
        variant: "destructive",
      });
      setPassword("");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-md mt-20">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>Forecasting Access</CardTitle>
            </div>
            <CardDescription>
              Enter the password to access financial forecasting tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="input-forecast-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-forecast-login">
                Access Forecasting
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Forecasting"
        description="Revenue projections and scenario planning"
        actions={
          <Button variant="outline" onClick={handleLogout} data-testid="button-forecast-logout">
            Lock
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <TrendingUp className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-projects">
            <FolderKanban className="h-4 w-4 mr-2" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">
            <DollarSign className="h-4 w-4 mr-2" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="retainers" data-testid="tab-retainers">
            <DollarSign className="h-4 w-4 mr-2" />
            Retainers
          </TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">
            <DollarSign className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
          <TabsTrigger value="capacity" data-testid="tab-capacity">
            <Users className="h-4 w-4 mr-2" />
            Capacity
          </TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">
            <Calculator className="h-4 w-4 mr-2" />
            Scenarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ForecastOverview />
        </TabsContent>

        <TabsContent value="projects">
          <AccountRevenueTab />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>

        <TabsContent value="retainers">
          <RetainersTab />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>

        <TabsContent value="capacity">
          <CapacityTab />
        </TabsContent>

        <TabsContent value="scenarios">
          <ScenariosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
