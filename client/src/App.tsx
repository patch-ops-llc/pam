import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import Dashboard from "@/pages/Dashboard";
import DesignPreview from "@/pages/DesignPreview";
import TimeLogging from "@/pages/TimeLogging";
import TimeLogAudit from "@/pages/TimeLogAudit";
import Reports from "@/pages/Reports";
import Calendar from "@/pages/Calendar";
import Agencies from "@/pages/Agencies";
import Accounts from "@/pages/Accounts";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import SlackConfiguration from "@/pages/SlackConfiguration";
import QuotaSettings from "@/pages/QuotaSettings";
import Forecasting from "@/pages/Forecasting";
import TeamResources from "@/pages/TeamResources";
import Holidays from "@/pages/Holidays";
import Capacity from "@/pages/Capacity";
import Proposals from "@/pages/Proposals";
import CreateProposal from "@/pages/CreateProposal";
import ProposalView from "@/pages/ProposalView";
import NewProposalSelector from "@/pages/NewProposalSelector";
import VisualProposalEditor from "@/pages/VisualProposalEditor";
import DocumentProposalIngestion from "@/pages/DocumentProposalIngestion";
import KnowledgeBase from "@/pages/KnowledgeBase";
import GuidanceSettings from "@/pages/GuidanceSettings";
import Pipeline from "@/pages/Pipeline";
import Archive from "@/pages/Archive";
import Tasks from "@/pages/Tasks";
import CRM from "@/pages/CRM";
import ApiDocs from "@/pages/ApiDocs";
import UatSessions from "@/pages/UatSessions";
import UatSessionDetail from "@/pages/UatSessionDetail";
import UatReview from "@/pages/UatReview";
import UatPmView from "@/pages/UatPmView";
import UatPmPortal from "@/pages/UatPmPortal";
import UatDevPortal from "@/pages/UatDevPortal";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/UserMenu";
import { useLocation, Redirect } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
      <Route path="/time-logging" component={() => <Layout><TimeLogging /></Layout>} />
      <Route path="/time-log-audit" component={() => <Layout><TimeLogAudit /></Layout>} />
      <Route path="/reports" component={() => <Layout><Reports /></Layout>} />
      <Route path="/calendar" component={() => <Layout><Calendar /></Layout>} />
      <Route path="/clients" component={() => <Layout><Agencies /></Layout>} />
      <Route path="/accounts" component={() => <Layout><Accounts /></Layout>} />
      <Route path="/capacity" component={() => <Layout><Capacity /></Layout>} />
      <Route path="/users" component={() => <Layout><Users /></Layout>} />
      <Route path="/tasks" component={() => <Layout><Tasks /></Layout>} />
      <Route path="/settings" component={() => <Layout><Settings /></Layout>} />
      <Route path="/slack-configuration" component={() => <Layout><SlackConfiguration /></Layout>} />
      <Route path="/quota-settings" component={() => <Layout><QuotaSettings /></Layout>} />
      <Route path="/forecasting" component={() => <Layout><Forecasting /></Layout>} />
      <Route path="/team-resources" component={() => <Layout><TeamResources /></Layout>} />
      <Route path="/holidays" component={() => <Layout><Holidays /></Layout>} />
      <Route path="/proposals" component={() => <Layout><Proposals /></Layout>} />
      <Route path="/proposals/create" component={() => <Layout><NewProposalSelector /></Layout>} />
      <Route path="/proposals/create/transcript" component={() => <Layout><CreateProposal /></Layout>} />
      <Route path="/proposals/create/document" component={() => <Layout><DocumentProposalIngestion /></Layout>} />
      <Route path="/proposals/create/visual" component={() => <Layout><VisualProposalEditor /></Layout>} />
      <Route path="/proposals/edit/:id" component={() => <Layout><CreateProposal /></Layout>} />
      <Route path="/proposals/visual/edit/:id" component={() => <Layout><VisualProposalEditor /></Layout>} />
      <Route path="/proposals/:slug" component={ProposalView} />
      <Route path="/knowledge-base" component={() => <Layout><KnowledgeBase /></Layout>} />
      <Route path="/guidance-settings" component={() => <Layout><GuidanceSettings /></Layout>} />
      <Route path="/pipeline" component={() => <Layout><Pipeline /></Layout>} />
      <Route path="/archive" component={() => <Layout><Archive /></Layout>} />
      <Route path="/crm" component={() => <Layout><CRM /></Layout>} />
      <Route path="/api-docs" component={() => <Layout><ApiDocs /></Layout>} />
      <Route path="/uat" component={() => <Layout><UatSessions /></Layout>} />
      <Route path="/uat/pm" component={() => <Layout><UatPmView /></Layout>} />
      <Route path="/uat/invite/:token" component={UatReview} />
      <Route path="/uat/review/:token" component={UatReview} />
      <Route path="/r/:token" component={UatReview} />
      <Route path="/p/:token" component={UatPmPortal} />
      <Route path="/d/:token" component={UatDevPortal} />
      <Route path="/uat/:id" component={() => <Layout><UatSessionDetail /></Layout>} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/design-preview" component={DesignPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between gap-2 p-4 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <UserMenu />
          </header>
          <main className="flex-1 overflow-auto p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
