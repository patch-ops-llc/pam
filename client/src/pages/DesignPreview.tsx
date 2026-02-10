import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Home, 
  Clock, 
  Users, 
  Settings, 
  FileText, 
  Briefcase,
  ChevronRight,
  Plus,
  Search,
  Bell,
  Wrench,
  Zap,
  Check,
  AlertCircle,
  TrendingUp,
  Layers,
  Target,
  BarChart3
} from "lucide-react";
import patchopsLogo from "@assets/patchops-logo-v3-tt_1767626079946.png";

export default function DesignPreview() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold mb-2">PatchOps Cobalt Theme</h1>
            <p className="text-muted-foreground">
              A unified blue-dominant design inspired by the PatchOps logo
            </p>
          </div>
          <img src={patchopsLogo} alt="PatchOps" className="h-14" />
        </div>

        <Tabs defaultValue="palette" className="space-y-8">
          <TabsList data-testid="tabs-preview" className="bg-card border border-card-border">
            <TabsTrigger value="palette" data-testid="tab-palette">Color Palette</TabsTrigger>
            <TabsTrigger value="components" data-testid="tab-components">Components</TabsTrigger>
            <TabsTrigger value="layout" data-testid="tab-layout">Layout Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="palette" className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                  <Zap className="h-3 w-3 text-primary-foreground" />
                </div>
                Primary Blues - From the Logo
              </h2>
              <p className="text-muted-foreground mb-6">
                These are the core blues extracted from the PatchOps logo, used throughout the interface.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ColorSwatch 
                  name="Logo Cobalt" 
                  color="bg-primary" 
                  textColor="text-primary-foreground"
                  hsl="222 90% 56%"
                  description="Primary actions"
                />
                <ColorSwatch 
                  name="Deep Navy" 
                  color="bg-background" 
                  textColor="text-foreground"
                  hsl="222 47% 5%"
                  description="Background"
                  bordered
                />
                <ColorSwatch 
                  name="Rich Navy" 
                  color="bg-card" 
                  textColor="text-card-foreground"
                  hsl="222 55% 9%"
                  description="Cards & surfaces"
                  bordered
                />
                <ColorSwatch 
                  name="Medium Blue" 
                  color="bg-accent" 
                  textColor="text-accent-foreground"
                  hsl="222 70% 28%"
                  description="Highlights"
                />
                <ColorSwatch 
                  name="Muted Blue" 
                  color="bg-muted" 
                  textColor="text-muted-foreground"
                  hsl="222 35% 14%"
                  description="Subtle areas"
                  bordered
                />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-sidebar flex items-center justify-center border border-sidebar-border">
                  <Layers className="h-3 w-3 text-sidebar-foreground" />
                </div>
                Sidebar Blues
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ColorSwatch 
                  name="Sidebar Base" 
                  color="bg-sidebar" 
                  textColor="text-sidebar-foreground"
                  hsl="222 60% 7%"
                  description="Navigation base"
                  bordered
                />
                <ColorSwatch 
                  name="Sidebar Primary" 
                  color="bg-sidebar-primary" 
                  textColor="text-sidebar-primary-foreground"
                  hsl="222 90% 58%"
                  description="Active states"
                />
                <ColorSwatch 
                  name="Sidebar Accent" 
                  color="bg-sidebar-accent" 
                  textColor="text-sidebar-accent-foreground"
                  hsl="222 65% 22%"
                  description="Selected items"
                />
                <ColorSwatch 
                  name="Sidebar Border" 
                  color="bg-sidebar-border" 
                  textColor="text-sidebar-foreground"
                  hsl="222 55% 16%"
                  description="Dividers"
                />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-[hsl(200,85%,50%)] flex items-center justify-center">
                  <BarChart3 className="h-3 w-3 text-white" />
                </div>
                Chart Colors - Blue Spectrum
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <ColorSwatch 
                  name="Chart 1" 
                  color="bg-[hsl(222,90%,56%)]" 
                  textColor="text-white"
                  hsl="222 90% 56%"
                  description="Cobalt"
                />
                <ColorSwatch 
                  name="Chart 2" 
                  color="bg-[hsl(200,85%,50%)]" 
                  textColor="text-white"
                  hsl="200 85% 50%"
                  description="Sky"
                />
                <ColorSwatch 
                  name="Chart 3" 
                  color="bg-[hsl(180,70%,45%)]" 
                  textColor="text-white"
                  hsl="180 70% 45%"
                  description="Teal"
                />
                <ColorSwatch 
                  name="Chart 4" 
                  color="bg-[hsl(245,70%,60%)]" 
                  textColor="text-white"
                  hsl="245 70% 60%"
                  description="Indigo"
                />
                <ColorSwatch 
                  name="Chart 5" 
                  color="bg-[hsl(260,65%,55%)]" 
                  textColor="text-white"
                  hsl="260 65% 55%"
                  description="Violet"
                />
              </div>
            </div>

            <Card className="border-primary/30 bg-gradient-to-br from-card to-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  What Makes This Design Unique
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Logo-Matched Cobalt Blue</p>
                    <p className="text-sm text-muted-foreground">
                      Hue 222° with 90% saturation matches the exact blue from your PatchOps logo
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center border border-accent/50">
                    <Layers className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Blue-Infused Throughout</p>
                    <p className="text-sm text-muted-foreground">
                      Every surface, border, and highlight contains blue undertones for cohesion
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-[hsl(200,85%,50%)] flex items-center justify-center">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Blue-Spectrum Charts</p>
                    <p className="text-sm text-muted-foreground">
                      Charts use blues, teals, and violets instead of rainbow colors
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-sidebar flex items-center justify-center border border-sidebar-border">
                    <TrendingUp className="h-4 w-4 text-sidebar-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Rich Saturation Gradients</p>
                    <p className="text-sm text-muted-foreground">
                      Surfaces vary by saturation (35-60%) creating depth without losing the blue identity
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="components" className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Buttons</h2>
              <div className="flex flex-wrap gap-3">
                <Button data-testid="button-primary">Primary Action</Button>
                <Button variant="secondary" data-testid="button-secondary">Secondary</Button>
                <Button variant="outline" data-testid="button-outline">Outline</Button>
                <Button variant="ghost" data-testid="button-ghost">Ghost</Button>
                <Button variant="destructive" data-testid="button-destructive">Destructive</Button>
                <Button size="icon" data-testid="button-icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Badges</h2>
              <div className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge className="bg-[hsl(200,85%,50%)] text-white border-[hsl(200,85%,45%)]">Info</Badge>
                <Badge className="bg-[hsl(180,70%,45%)] text-white border-[hsl(180,70%,40%)]">Success</Badge>
                <Badge className="bg-[hsl(245,70%,60%)] text-white border-[hsl(245,70%,55%)]">Pending</Badge>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Form Inputs</h2>
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="search" 
                      placeholder="Search projects..." 
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="you@example.com"
                    data-testid="input-email"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Cards</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="hover-elevate">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                    <Briefcase className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">12</div>
                    <p className="text-xs text-muted-foreground">+2 from last month</p>
                  </CardContent>
                </Card>
                <Card className="hover-elevate">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
                    <Clock className="h-4 w-4 text-[hsl(200,85%,50%)]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">847.5</div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>
                <Card className="hover-elevate">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                    <Users className="h-4 w-4 text-[hsl(245,70%,60%)]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">24</div>
                    <p className="text-xs text-muted-foreground">Across 3 teams</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Progress</h2>
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Project Alpha</span>
                    <span className="text-muted-foreground">75%</span>
                  </div>
                  <Progress value={75} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Budget Used</span>
                    <span className="text-muted-foreground">45%</span>
                  </div>
                  <Progress value={45} />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">Status Indicators</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[hsl(180,70%,45%)]" />
                  <span className="text-sm">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-sm">In Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[hsl(245,70%,60%)]" />
                  <span className="text-sm">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-sm">Blocked</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Sidebar + Content Layout</h2>
              <p className="text-muted-foreground mb-6">
                Notice how the sidebar uses deeper blues, creating visual depth and hierarchy.
              </p>
            </div>
            
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="flex h-[520px]">
                <div className="w-64 bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-sidebar-border">
                    <img src={patchopsLogo} alt="PatchOps" className="h-8" />
                  </div>
                  
                  <nav className="space-y-1 flex-1">
                    {[
                      { icon: Home, label: "Dashboard", active: true },
                      { icon: Clock, label: "Time Logging" },
                      { icon: Briefcase, label: "Projects" },
                      { icon: FileText, label: "Proposals" },
                      { icon: Users, label: "Team" },
                      { icon: Settings, label: "Settings" },
                    ].map((item) => (
                      <button
                        key={item.label}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                          item.active 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-l-primary" 
                            : "text-sidebar-foreground hover-elevate"
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${item.active ? 'text-primary' : ''}`} />
                        {item.label}
                        {item.active && <ChevronRight className="h-4 w-4 ml-auto text-primary" />}
                      </button>
                    ))}
                  </nav>

                  <div className="pt-4 border-t border-sidebar-border">
                    <div className="flex items-center gap-3 p-2 rounded-md bg-sidebar-accent/50">
                      <Avatar className="h-9 w-9 border border-primary/30">
                        <AvatarFallback className="bg-primary/20 text-primary text-sm">JD</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">John Doe</p>
                        <p className="text-xs text-muted-foreground truncate">Admin</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <header className="h-14 border-b border-border flex items-center justify-between gap-4 px-6 bg-card/50">
                    <div className="flex items-center gap-4">
                      <h2 className="font-semibold">Dashboard</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost">
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost">
                        <Bell className="h-4 w-4" />
                      </Button>
                    </div>
                  </header>

                  <main className="flex-1 p-6 bg-background overflow-auto">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                          <TrendingUp className="h-4 w-4 text-[hsl(180,70%,45%)]" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">$45,231</div>
                          <p className="text-xs text-[hsl(180,70%,45%)]">+12% from last month</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                          <Check className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">127</div>
                          <p className="text-xs text-muted-foreground">23 due this week</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Alerts</CardTitle>
                          <AlertCircle className="h-4 w-4 text-[hsl(245,70%,60%)]" />
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">3</div>
                          <p className="text-xs text-[hsl(245,70%,60%)]">Requires attention</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                        <CardDescription>Latest updates from your team</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {[
                            { user: "Sarah Chen", action: "completed task", target: "Homepage Redesign", time: "2 min ago", color: "bg-[hsl(180,70%,45%)]" },
                            { user: "Mike Ross", action: "started working on", target: "API Integration", time: "15 min ago", color: "bg-primary" },
                            { user: "Emily Wang", action: "created proposal", target: "Q2 Strategy", time: "1 hour ago", color: "bg-[hsl(200,85%,50%)]" },
                          ].map((activity, i) => (
                            <div key={i} className="flex items-center gap-4">
                              <Avatar className="h-9 w-9 border border-border">
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                  {activity.user.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                  <span className="font-medium">{activity.user}</span>
                                  {' '}{activity.action}{' '}
                                  <span className="font-medium">{activity.target}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">{activity.time}</p>
                              </div>
                              <div className={`h-2 w-2 rounded-full ${activity.color}`} />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </main>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ColorSwatch({ 
  name, 
  color, 
  textColor, 
  hsl, 
  description,
  bordered = false 
}: { 
  name: string; 
  color: string; 
  textColor: string; 
  hsl: string;
  description: string;
  bordered?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div 
        className={`h-24 rounded-md flex flex-col justify-end p-3 ${color} ${textColor} ${bordered ? 'border border-border' : ''}`}
      >
        <span className="text-xs font-mono opacity-80">{hsl}</span>
      </div>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
