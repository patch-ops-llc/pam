import { useState, useEffect, useCallback } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import Training from "@/pages/Training";
import TrainingProgram from "@/pages/TrainingProgram";
import TrainingModule from "@/pages/TrainingModule";
import TrainingAdmin from "@/pages/TrainingAdmin";
import TrainingEnrollments from "@/pages/TrainingEnrollments";
import TrainingReview from "@/pages/TrainingReview";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { UserMenu } from "@/components/UserMenu";
import { useLocation, Redirect } from "wouter";

// Route-to-breadcrumb mapping
const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/time-logging": "Time Logging",
  "/time-log-audit": "Time Log Audit",
  "/reports": "Reports",
  "/calendar": "Calendar",
  "/clients": "Clients",
  "/accounts": "Accounts",
  "/capacity": "Capacity",
  "/users": "Users",
  "/tasks": "Tasks",
  "/settings": "Settings",
  "/slack-configuration": "Slack Configuration",
  "/quota-settings": "Quota Settings",
  "/forecasting": "Forecasting",
  "/team-resources": "Team Resources",
  "/holidays": "Holidays",
  "/proposals": "Proposals",
  "/proposals/create": "New Proposal",
  "/proposals/create/transcript": "Transcript Proposal",
  "/proposals/create/document": "Document Proposal",
  "/proposals/create/visual": "Visual Proposal",
  "/knowledge-base": "Knowledge Base",
  "/guidance-settings": "Guidance Settings",
  "/pipeline": "Pipeline",
  "/archive": "Archive",
  "/crm": "CRM",
  "/api-docs": "API Documentation",
  "/uat": "UAT Sessions",
  "/uat/pm": "PM Overview",
  "/training": "Training",
  "/training/admin": "Training Admin",
  "/training/reviews": "Training Reviews",
  "/design-preview": "Design Preview",
};

// Searchable nav items for Cmd+K palette
const searchableRoutes = [
  { label: "Dashboard", path: "/", group: "Main" },
  { label: "Time Logging", path: "/time-logging", group: "Main" },
  { label: "Tasks", path: "/tasks", group: "Main" },
  { label: "Accounts", path: "/accounts", group: "Delivery" },
  { label: "Time Log Audit", path: "/time-log-audit", group: "Delivery" },
  { label: "Reports", path: "/reports", group: "Delivery" },
  { label: "Archive", path: "/archive", group: "Delivery" },
  { label: "Clients", path: "/clients", group: "Delivery" },
  { label: "Capacity", path: "/capacity", group: "Delivery" },
  { label: "UAT Sessions", path: "/uat", group: "Delivery" },
  { label: "Forecasting", path: "/forecasting", group: "Operations" },
  { label: "Proposals", path: "/proposals", group: "Operations" },
  { label: "Knowledge Base", path: "/knowledge-base", group: "Operations" },
  { label: "Guidance Settings", path: "/guidance-settings", group: "Operations" },
  { label: "Training", path: "/training", group: "Training" },
  { label: "Training Admin", path: "/training/admin", group: "Training" },
  { label: "Training Enrollments", path: "/training/admin/enrollments", group: "Training" },
  { label: "Training Reviews", path: "/training/reviews", group: "Training" },
  { label: "Slack Integration", path: "/slack-configuration", group: "Integrations" },
  { label: "API Documentation", path: "/api-docs", group: "Integrations" },
  { label: "Users", path: "/users", group: "System" },
  { label: "Settings", path: "/settings", group: "System" },
  { label: "Calendar", path: "/calendar", group: "Main" },
  { label: "Pipeline", path: "/pipeline", group: "Operations" },
  { label: "CRM", path: "/crm", group: "Operations" },
];

function getPageTitle(path: string): string {
  if (routeTitles[path]) return routeTitles[path];
  // Handle dynamic routes
  if (path.startsWith("/proposals/edit/")) return "Edit Proposal";
  if (path.startsWith("/proposals/visual/edit/")) return "Edit Visual Proposal";
  if (path.startsWith("/training/programs/")) return "Training Program";
  if (path.startsWith("/training/modules/")) return "Training Module";
  if (path.startsWith("/uat/") && path !== "/uat/pm") return "UAT Session";
  return "Page";
}

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
      <Route path="/training" component={() => <Layout><Training /></Layout>} />
      <Route path="/training/programs/:id" component={() => <Layout><TrainingProgram /></Layout>} />
      <Route path="/training/modules/:id" component={() => <Layout><TrainingModule /></Layout>} />
      <Route path="/training/admin/enrollments" component={() => <Layout><TrainingEnrollments /></Layout>} />
      <Route path="/training/admin" component={() => <Layout><TrainingAdmin /></Layout>} />
      <Route path="/training/reviews" component={() => <Layout><TrainingReview /></Layout>} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/design-preview" component={DesignPreview} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [currentPath] = useLocation();
  const [, setLocation] = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  const pageTitle = getPageTitle(currentPath);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((path: string) => {
    setCmdOpen(false);
    setLocation(path);
  }, [setLocation]);

  // Group routes by their group
  const groups = searchableRoutes.reduce<Record<string, typeof searchableRoutes>>((acc, route) => {
    if (!acc[route.group]) acc[route.group] = [];
    acc[route.group].push(route);
    return acc;
  }, {});

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
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="hidden sm:block h-5 w-px bg-border" />
              <span className="hidden sm:block text-sm font-medium text-foreground">
                {pageTitle}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCmdOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                data-testid="button-command-palette"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Search...</span>
                <kbd className="hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPath}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      {/* Command Palette Dialog */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search pages..." />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          {Object.entries(groups).map(([group, routes]) => (
            <CommandGroup key={group} heading={group}>
              {routes.map((route) => (
                <CommandItem
                  key={route.path}
                  onSelect={() => handleSelect(route.path)}
                  className="cursor-pointer"
                >
                  {route.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
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
