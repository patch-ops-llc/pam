import {
  BarChart3,
  Users,
  Building2,
  Settings,
  Timer,
  UserPlus,
  TrendingUp,
  UsersRound,
  FileText,
  CheckSquare,
  ChevronDown,
  FolderOpen,
  Plug,
  Code,
  GraduationCap,
  LogOut,
} from "lucide-react";
import patchopsLogo from "@assets/patchops-brandmark-2_1758758915355.jpg";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

const mainItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: BarChart3,
  },
  {
    title: "Time Logging",
    url: "/time-logging",
    icon: Timer,
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: CheckSquare,
  },
];

const deliveryItems = [
  {
    title: "Accounts",
    url: "/accounts",
    icon: Users,
  },
  {
    title: "Audits",
    icon: FolderOpen,
    children: [
      {
        title: "Time Logs",
        url: "/time-log-audit",
      },
      {
        title: "Reports",
        url: "/reports",
      },
      {
        title: "Archive",
        url: "/archive",
      },
    ],
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Building2,
  },
  {
    title: "Capacity",
    url: "/capacity",
    icon: UsersRound,
  },
];

const operationsItems = [
  {
    title: "Forecasting",
    url: "/forecasting",
    icon: TrendingUp,
  },
  {
    title: "Proposals",
    icon: FileText,
    children: [
      {
        title: "Proposals",
        url: "/proposals",
      },
      {
        title: "Knowledge Base",
        url: "/knowledge-base",
      },
      {
        title: "Guidance Settings",
        url: "/guidance-settings",
      },
    ],
  },
];

const integrationsItems = [
  {
    title: "Slack Integration",
    url: "/slack-configuration",
    icon: Plug,
  },
  {
    title: "API Documentation",
    url: "/api-docs",
    icon: Code,
  },
];

const clientToolsItems = [
  {
    title: "UAT Sessions",
    url: "/uat",
    icon: CheckSquare,
  },
];

const trainingItems = [
  {
    title: "Training",
    icon: GraduationCap,
    children: [
      {
        title: "My Training",
        url: "/training",
      },
      {
        title: "Admin",
        url: "/training/admin",
      },
      {
        title: "Enrollments",
        url: "/training/admin/enrollments",
      },
      {
        title: "Reviews",
        url: "/training/reviews",
      },
    ],
  },
];

const systemItems = [
  {
    title: "Users",
    url: "/users",
    icon: UserPlus,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

function isRouteActive(currentPath: string, itemUrl: string): boolean {
  if (itemUrl === "/") return currentPath === "/";
  return currentPath === itemUrl || currentPath.startsWith(itemUrl + "/");
}

function MenuItem({ item, currentPath }: { item: any; currentPath: string }) {
  if (item.children) {
    const hasActiveChild = item.children.some((child: any) => isRouteActive(currentPath, child.url));
    return (
      <Collapsible defaultOpen={hasActiveChild} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={hasActiveChild}
              data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon />
              <span>{item.title}</span>
              <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child: any) => (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isRouteActive(currentPath, child.url)}
                    data-testid={`link-${child.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Link href={child.url}>
                      <span>{child.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isRouteActive(currentPath, item.url)}
        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Link href={item.url}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const [currentPath] = useLocation();
  const { user, logoutMutation } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'
    : '';
  const displayName = user
    ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username)
    : '';

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img 
            src={patchopsLogo} 
            alt="PatchOps Logo" 
            className="h-8 w-8 object-contain rounded"
          />
          <span className="text-3xl" style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 600, fontStyle: 'normal' }}>Pam</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <MenuItem key={item.title} item={item} currentPath={currentPath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Delivery</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {[...deliveryItems, ...clientToolsItems].map((item) => (
                <MenuItem key={item.title} item={item} currentPath={currentPath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => (
                <MenuItem key={item.title} item={item} currentPath={currentPath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Training</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {trainingItems.map((item) => (
                <MenuItem key={item.title} item={item} currentPath={currentPath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Integrations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {integrationsItems.map((item) => (
                <MenuItem key={item.title} item={item} currentPath={currentPath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <MenuItem key={item.title} item={item} currentPath={currentPath} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={() => logoutMutation.mutate()}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}