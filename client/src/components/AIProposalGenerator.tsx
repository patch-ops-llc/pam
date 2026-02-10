import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, RefreshCw, Save, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ScopeItem {
  storyId: string;
  hours: number;
  workstream: string;
  customerStory: string;
  recommendedApproach: string;
  assumptions: string;
  order: number;
}

interface AIProposalGeneratorProps {
  onSave?: (scopeItems: ScopeItem[], chatTranscript: string) => void;
}

export function AIProposalGenerator({ onSave }: AIProposalGeneratorProps) {
  const { toast } = useToast();
  const [chatTranscript, setChatTranscript] = useState("");
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [projectContext, setProjectContext] = useState({
    projectName: "",
    accountName: "",
    existingRequirements: "",
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/ai/generate-scope", {
        method: "POST",
        body: JSON.stringify({
          chatTranscript,
          projectContext: {
            projectName: projectContext.projectName || undefined,
            accountName: projectContext.accountName || undefined,
            existingRequirements: projectContext.existingRequirements || undefined,
          },
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setScopeItems(data.scopeItems);
      toast({
        title: "Success",
        description: `Generated ${data.scopeItems.length} scope items`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate scope",
        variant: "destructive",
      });
    },
  });

  const refineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/ai/refine-scope", {
        method: "POST",
        body: JSON.stringify({
          scopeItems,
          refinementInstructions: refinementPrompt,
        }),
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setScopeItems(data.scopeItems);
      setRefinementPrompt("");
      toast({
        title: "Success",
        description: "Scope refined successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refine scope",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (!chatTranscript.trim()) {
      toast({
        title: "Error",
        description: "Please provide a chat transcript",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleRefine = () => {
    if (!refinementPrompt.trim()) {
      toast({
        title: "Error",
        description: "Please provide refinement instructions",
        variant: "destructive",
      });
      return;
    }
    refineMutation.mutate();
  };

  const handleUpdateItem = (index: number, updates: Partial<ScopeItem>) => {
    setScopeItems(items => items.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ));
  };

  const handleDeleteItem = (index: number) => {
    setScopeItems(items => items.filter((_, i) => i !== index));
  };

  const handleAddItem = () => {
    const newItem: ScopeItem = {
      storyId: `ITEM-${scopeItems.length + 1}`,
      hours: 0,
      workstream: "General",
      customerStory: "",
      recommendedApproach: "",
      assumptions: "",
      order: scopeItems.length,
    };
    setScopeItems([...scopeItems, newItem]);
    setEditingIndex(scopeItems.length);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(scopeItems, chatTranscript);
    }
  };

  const totalHours = scopeItems.reduce((sum, item) => sum + item.hours, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Scope Generator
          </CardTitle>
          <CardDescription>
            Generate structured scopes of work from client conversations using AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                value={projectContext.projectName}
                onChange={(e) => setProjectContext({ ...projectContext, projectName: e.target.value })}
                placeholder="Optional"
                data-testid="input-project-name"
              />
            </div>
            <div>
              <Label htmlFor="accountName">Client Name</Label>
              <Input
                id="accountName"
                value={projectContext.accountName}
                onChange={(e) => setProjectContext({ ...projectContext, accountName: e.target.value })}
                placeholder="Optional"
                data-testid="input-account-name"
              />
            </div>
            <div>
              <Label htmlFor="existingRequirements">Existing Requirements</Label>
              <Input
                id="existingRequirements"
                value={projectContext.existingRequirements}
                onChange={(e) => setProjectContext({ ...projectContext, existingRequirements: e.target.value })}
                placeholder="Optional"
                data-testid="input-requirements"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="chatTranscript">Chat Transcript *</Label>
            <Textarea
              id="chatTranscript"
              value={chatTranscript}
              onChange={(e) => setChatTranscript(e.target.value)}
              rows={8}
              placeholder="Paste your conversation with the client here..."
              data-testid="textarea-transcript"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !chatTranscript.trim()}
            data-testid="button-generate"
          >
            {generateMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Scope
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {scopeItems.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Generated Scope ({scopeItems.length} items)</CardTitle>
                  <CardDescription>Total Hours: {totalHours}</CardDescription>
                </div>
                <Button onClick={handleAddItem} size="sm" variant="outline" data-testid="button-add-item">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Story ID</TableHead>
                      <TableHead className="w-20">Hours</TableHead>
                      <TableHead className="w-32">Workstream</TableHead>
                      <TableHead>Customer Story</TableHead>
                      <TableHead>Approach</TableHead>
                      <TableHead>Assumptions</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopeItems.map((item, index) => (
                      <TableRow key={index} data-testid={`row-scope-${index}`}>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              value={item.storyId}
                              onChange={(e) => handleUpdateItem(index, { storyId: e.target.value })}
                              className="w-full"
                              data-testid={`input-story-id-${index}`}
                            />
                          ) : (
                            <span className="font-mono text-sm">{item.storyId}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              type="number"
                              value={item.hours}
                              onChange={(e) => handleUpdateItem(index, { hours: parseInt(e.target.value) || 0 })}
                              className="w-full"
                              data-testid={`input-hours-${index}`}
                            />
                          ) : (
                            <Badge variant="secondary">{item.hours}h</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Input
                              value={item.workstream}
                              onChange={(e) => handleUpdateItem(index, { workstream: e.target.value })}
                              className="w-full"
                              data-testid={`input-workstream-${index}`}
                            />
                          ) : (
                            <span className="text-sm">{item.workstream}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Textarea
                              value={item.customerStory}
                              onChange={(e) => handleUpdateItem(index, { customerStory: e.target.value })}
                              rows={2}
                              className="w-full"
                              data-testid={`textarea-story-${index}`}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.customerStory}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Textarea
                              value={item.recommendedApproach}
                              onChange={(e) => handleUpdateItem(index, { recommendedApproach: e.target.value })}
                              rows={2}
                              className="w-full"
                              data-testid={`textarea-approach-${index}`}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.recommendedApproach}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingIndex === index ? (
                            <Textarea
                              value={item.assumptions}
                              onChange={(e) => handleUpdateItem(index, { assumptions: e.target.value })}
                              rows={2}
                              className="w-full"
                              data-testid={`textarea-assumptions-${index}`}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.assumptions}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {editingIndex === index ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingIndex(null)}
                                data-testid={`button-save-edit-${index}`}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingIndex(index)}
                                data-testid={`button-edit-${index}`}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteItem(index)}
                              data-testid={`button-delete-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Refine Scope</CardTitle>
              <CardDescription>
                Ask the AI to adjust the scope based on your feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={refinementPrompt}
                onChange={(e) => setRefinementPrompt(e.target.value)}
                rows={3}
                placeholder="e.g., 'Increase all estimates by 20%' or 'Break down the authentication feature into smaller tasks'"
                data-testid="textarea-refinement"
              />
              <Button
                onClick={handleRefine}
                disabled={refineMutation.isPending || !refinementPrompt.trim()}
                variant="outline"
                data-testid="button-refine"
              >
                {refineMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refining...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Refine Scope
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {onSave && (
            <div className="flex justify-end">
              <Button onClick={handleSave} size="lg" data-testid="button-save-scope">
                <Save className="mr-2 h-4 w-4" />
                Save Scope to Proposal
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
