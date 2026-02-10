import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Key, Plus, Trash2, Copy, Check, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreatedApiKey extends ApiKey {
  key: string;
  message: string;
}

export default function ApiDocs() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [deletingKey, setDeletingKey] = useState<ApiKey | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const { toast } = useToast();

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("/api/api-keys", "POST", { name });
      return await response.json() as CreatedApiKey;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setCreatedKey(data);
      setIsCreateDialogOpen(false);
      setNewKeyName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/api-keys/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      toast({
        title: "Success",
        description: "API key revoked successfully",
      });
      setDeletingKey(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const baseUrl = window.location.origin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Manage your API keys and learn how to integrate with the PAM API
        </p>
      </div>

      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="leads">Leads API</TabsTrigger>
          <TabsTrigger value="examples">Code Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Create and manage API keys for external access
                </CardDescription>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No API keys created yet</p>
                  <p className="text-sm">Create a key to start using the API</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{key.name}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {key.keyPrefix}...
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Created {format(new Date(key.createdAt), "MMM d, yyyy")}
                          </span>
                          {key.lastUsedAt && (
                            <span>
                              Last used {format(new Date(key.lastUsedAt), "MMM d, yyyy")}
                            </span>
                          )}
                          {key.expiresAt && (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Expires {format(new Date(key.expiresAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingKey(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads API</CardTitle>
              <CardDescription>
                Create, read, update, and delete leads via the API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Include your API key in the <code className="bg-muted px-1 rounded">x-api-key</code> header:
                </p>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                  x-api-key: pam_your_api_key_here
                </pre>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Endpoints</h3>
                
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">GET</Badge>
                    <code className="text-sm">/api/leads</code>
                  </div>
                  <p className="text-sm text-muted-foreground">List all leads</p>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">GET</Badge>
                    <code className="text-sm">/api/leads/:id</code>
                  </div>
                  <p className="text-sm text-muted-foreground">Get a specific lead by ID</p>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600">POST</Badge>
                    <code className="text-sm">/api/leads</code>
                  </div>
                  <p className="text-sm text-muted-foreground">Create a new lead</p>
                  <div className="mt-2">
                    <p className="text-xs font-medium mb-1">Request Body:</p>
                    <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`{
  "name": "Lead Name",        // required
  "stageId": "uuid",          // required - pipeline stage ID
  "company": "Company Name",  // optional
  "email": "email@example.com", // optional
  "phone": "555-1234",        // optional
  "priority": "medium",       // optional: low, medium, high, urgent
  "value": "50000",           // optional: deal value
  "source": "Website",        // optional
  "nextSteps": "...",         // optional
  "notes": "..."              // optional
}`}
                    </pre>
                  </div>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-600">PATCH</Badge>
                    <code className="text-sm">/api/leads/:id</code>
                  </div>
                  <p className="text-sm text-muted-foreground">Update a lead</p>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-600">DELETE</Badge>
                    <code className="text-sm">/api/leads/:id</code>
                  </div>
                  <p className="text-sm text-muted-foreground">Delete a lead</p>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600">GET</Badge>
                    <code className="text-sm">/api/pipeline-stages</code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Get pipeline stages (needed for stageId when creating leads)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code Examples</CardTitle>
              <CardDescription>
                Examples for integrating with the PAM API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">cURL</h3>
                <ScrollArea className="h-[200px] bg-muted rounded-lg p-4">
                  <pre className="text-sm">
{`# Get pipeline stages first
curl ${baseUrl}/api/pipeline-stages \\
  -H "x-api-key: YOUR_API_KEY"

# Create a lead
curl -X POST ${baseUrl}/api/leads \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -d '{
    "name": "New Website Project",
    "company": "Acme Corp",
    "email": "contact@acme.com",
    "stageId": "STAGE_ID_FROM_ABOVE",
    "priority": "high",
    "value": "25000"
  }'

# List all leads
curl ${baseUrl}/api/leads \\
  -H "x-api-key: YOUR_API_KEY"`}
                  </pre>
                </ScrollArea>
              </div>

              <div>
                <h3 className="font-semibold mb-2">JavaScript / TypeScript</h3>
                <ScrollArea className="h-[300px] bg-muted rounded-lg p-4">
                  <pre className="text-sm">
{`const API_KEY = 'YOUR_API_KEY';
const BASE_URL = '${baseUrl}';

// Helper function
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(\`\${BASE_URL}\${endpoint}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(\`API error: \${response.status}\`);
  }
  return response.json();
}

// Get pipeline stages
const stages = await apiRequest('/api/pipeline-stages');
const leadStage = stages.find(s => s.type === 'lead');

// Create a lead
const newLead = await apiRequest('/api/leads', {
  method: 'POST',
  body: JSON.stringify({
    name: 'New Website Project',
    company: 'Acme Corp',
    email: 'contact@acme.com',
    stageId: leadStage.id,
    priority: 'high',
    value: '25000',
  }),
});

console.log('Created lead:', newLead);

// List all leads
const leads = await apiRequest('/api/leads');
console.log('All leads:', leads);`}
                  </pre>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external access. The key will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., Production Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(newKeyName)}
              disabled={!newKeyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now - it will not be shown again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={createdKey?.key || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(createdKey?.key || "")}
                >
                  {copiedKey ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Save this key securely. You won't be able to see it again after closing this dialog.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingKey} onOpenChange={() => setDeletingKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the key "{deletingKey?.name}"? This action cannot be undone and any integrations using this key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingKey && deleteMutation.mutate(deletingKey.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
