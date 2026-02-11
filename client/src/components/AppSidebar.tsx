import {
  Clock,
  BarChart3,
  Users,
  Building2,
  Settings,
  Timer,
  UserPlus,
  MessageSquare,
  FileSearch,
  TrendingUp,
  UsersRound,
  FileText,
  Archive,
  BookOpen,
  Settings2,
  Calendar,
  CheckSquare,
  FileBarChart,
  ChevronDown,
  FolderOpen,
  Plug,
  Code,
  GraduationCap,
  ClipboardCheck,
} from "lucide-react";
import patchopsLogo from "@assets/patchops-brandmark-2_1758758915355.jpg";
import { Link } from "wouter";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

function MenuItem({ item }: { item: any }) {
  if (item.children) {
    return (
      <Collapsible defaultOpen className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <item.icon />
              <span>{item.title}</span>
              <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children.map((child: any) => (
                <SidebarMenuSubItem key={child.title}>
                  <SidebarMenuSubButton asChild data-testid={`link-${child.title.toLowerCase().replace(/\s+/g, '-')}`}>
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
      <SidebarMenuButton asChild data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
        <Link href={item.url}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="p-6">
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
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Delivery</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {deliveryItems.map((item) => (
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => (
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Client Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {clientToolsItems.map((item) => (
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Training</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {trainingItems.map((item) => (
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Integrations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {integrationsItems.map((item) => (
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <MenuItem key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}