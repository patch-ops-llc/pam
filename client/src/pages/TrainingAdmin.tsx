import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  TrainingProgram,
  TrainingProgramWithPhases,
  TrainingPhase,
  TrainingModule,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Settings2,
  Layers,
  Upload,
  Users,
} from "lucide-react";
import { Link } from "wouter";

type EditMode = "program" | "phase" | "module" | null;

export default function TrainingAdmin() {
  const { toast } = useToast();
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<TrainingPhase | null>(null);
  const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [seedJson, setSeedJson] = useState("");

  // Form state
  const [formData, setFormData] = useState<Record<string, any>>({});

  const { data: programs, isLoading } = useQuery<TrainingProgram[]>({
    queryKey: ["/api/training/programs"],
  });

  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);

  const { data: expandedProgram } = useQuery<TrainingProgramWithPhases>({
    queryKey: ["/api/training/programs", expandedProgramId],
    enabled: !!expandedProgramId,
  });

  // Program mutations
  const createProgramMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/training/programs", "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs"] });
      closeDialog();
      toast({ title: "Success", description: "Program created" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateProgramMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/training/programs/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs"] });
      closeDialog();
      toast({ title: "Success", description: "Program updated" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteProgramMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/training/programs/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs"] });
      toast({ title: "Deleted", description: "Program deleted" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // Phase mutations
  const createPhaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/training/phases", "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs", expandedProgramId] });
      closeDialog();
      toast({ title: "Success", description: "Phase created" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/training/phases/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs", expandedProgramId] });
      closeDialog();
      toast({ title: "Success", description: "Phase updated" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deletePhaseMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/training/phases/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs", expandedProgramId] });
      toast({ title: "Deleted", description: "Phase deleted" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // Module mutations
  const createModuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/training/modules", "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs", expandedProgramId] });
      closeDialog();
      toast({ title: "Success", description: "Module created" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const updateModuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/training/modules/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs", expandedProgramId] });
      closeDialog();
      toast({ title: "Success", description: "Module updated" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/training/modules/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs", expandedProgramId] });
      toast({ title: "Deleted", description: "Module deleted" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  // Seed mutation
  const seedMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/training/seed", "POST", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/programs"] });
      setSeedDialogOpen(false);
      setSeedJson("");
      toast({ title: "Success", description: "Training program seeded successfully" });
    },
    onError: (error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  function closeDialog() {
    setEditMode(null);
    setIsCreating(false);
    setSelectedProgram(null);
    setSelectedPhase(null);
    setSelectedModule(null);
    setFormData({});
  }

  function openCreateProgram() {
    setEditMode("program");
    setIsCreating(true);
    setFormData({ title: "", description: "", philosophy: "", prerequisites: "", estimatedHours: "", status: "draft", order: 0 });
  }

  function openEditProgram(program: TrainingProgram) {
    setEditMode("program");
    setIsCreating(false);
    setSelectedProgram(program);
    setFormData({
      title: program.title,
      description: program.description || "",
      philosophy: program.philosophy || "",
      prerequisites: program.prerequisites || "",
      estimatedHours: program.estimatedHours || "",
      status: program.status,
      order: program.order,
    });
  }

  function openCreatePhase(programId: string) {
    setEditMode("phase");
    setIsCreating(true);
    setFormData({ programId, title: "", description: "", estimatedHours: "", milestoneReview: "", passCriteria: "", order: 0 });
  }

  function openEditPhase(phase: TrainingPhase) {
    setEditMode("phase");
    setIsCreating(false);
    setSelectedPhase(phase);
    setFormData({
      programId: phase.programId,
      title: phase.title,
      description: phase.description || "",
      estimatedHours: phase.estimatedHours || "",
      milestoneReview: phase.milestoneReview || "",
      passCriteria: phase.passCriteria || "",
      order: phase.order,
    });
  }

  function openCreateModule(phaseId: string) {
    setEditMode("module");
    setIsCreating(true);
    setFormData({
      phaseId,
      title: "",
      estimatedHours: "",
      clientStory: "",
      assignment: "",
      testingRequirements: "",
      deliverablesAndPresentation: "",
      beReadyToAnswer: "",
      order: 0,
    });
  }

  function openEditModule(mod: TrainingModule) {
    setEditMode("module");
    setIsCreating(false);
    setSelectedModule(mod);
    setFormData({
      phaseId: mod.phaseId,
      title: mod.title,
      estimatedHours: mod.estimatedHours || "",
      clientStory: mod.clientStory || "",
      assignment: mod.assignment || "",
      testingRequirements: mod.testingRequirements || "",
      deliverablesAndPresentation: mod.deliverablesAndPresentation || "",
      beReadyToAnswer: mod.beReadyToAnswer || "",
      order: mod.order,
    });
  }

  function handleSave() {
    if (editMode === "program") {
      if (isCreating) {
        createProgramMutation.mutate(formData);
      } else {
        updateProgramMutation.mutate({ id: selectedProgram!.id, data: formData });
      }
    } else if (editMode === "phase") {
      if (isCreating) {
        createPhaseMutation.mutate(formData);
      } else {
        updatePhaseMutation.mutate({ id: selectedPhase!.id, data: formData });
      }
    } else if (editMode === "module") {
      if (isCreating) {
        createModuleMutation.mutate(formData);
      } else {
        updateModuleMutation.mutate({ id: selectedModule!.id, data: formData });
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 training-ui">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Settings2 className="h-8 w-8" />
            Training Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-base">Manage training programs, phases, and modules</p>
        </div>
        <div className="flex gap-2">
          <Link href="/training/admin/enrollments">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Enrollments
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setSeedDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Seed Data
          </Button>
          <Button onClick={openCreateProgram}>
            <Plus className="h-4 w-4 mr-2" />
            New Program
          </Button>
        </div>
      </div>

      {/* Programs List */}
      {(!programs || programs.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Training Programs</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Create your first training program or import seed data to get started.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSeedDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />Import Seed Data
              </Button>
              <Button onClick={openCreateProgram}>
                <Plus className="h-4 w-4 mr-2" />Create Program
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {programs.map((program) => (
            <Card key={program.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="cursor-pointer" onClick={() => setExpandedProgramId(expandedProgramId === program.id ? null : program.id)}>
                    <div className="flex items-center gap-2">
                      <CardTitle>{program.title}</CardTitle>
                      <Badge variant={program.status === "active" ? "default" : program.status === "draft" ? "secondary" : "outline"}>
                        {program.status}
                      </Badge>
                    </div>
                    {program.description && <CardDescription className="mt-1">{program.description}</CardDescription>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditProgram(program)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm("Delete this program and all its phases/modules?")) {
                        deleteProgramMutation.mutate(program.id);
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedProgramId === program.id && expandedProgram && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4" />
                        Phases
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => openCreatePhase(program.id)}>
                        <Plus className="h-3 w-3 mr-1" />Add Phase
                      </Button>
                    </div>
                    {expandedProgram.phases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No phases yet.</p>
                    ) : (
                      <Accordion type="multiple" className="space-y-2">
                        {expandedProgram.phases.map((phase, phaseIdx) => (
                          <AccordionItem key={phase.id} value={phase.id} className="border rounded-lg px-3">
                            <AccordionTrigger className="hover:no-underline py-3">
                              <div className="flex items-center gap-3 text-left flex-1">
                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                  {phaseIdx + 1}
                                </div>
                                <span className="font-medium text-sm">{phase.title}</span>
                                <span className="text-xs text-muted-foreground">{phase.modules.length} modules</span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pb-2">
                                <div className="flex gap-1 justify-end">
                                  <Button variant="ghost" size="sm" onClick={() => openEditPhase(phase)}>
                                    <Edit2 className="h-3 w-3 mr-1" />Edit Phase
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    if (confirm("Delete this phase and all its modules?")) {
                                      deletePhaseMutation.mutate(phase.id);
                                    }
                                  }}>
                                    <Trash2 className="h-3 w-3 mr-1" />Delete
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => openCreateModule(phase.id)}>
                                    <Plus className="h-3 w-3 mr-1" />Add Module
                                  </Button>
                                </div>
                                {phase.modules.map((mod, modIdx) => (
                                  <div key={mod.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                                    <span className="text-xs font-medium text-muted-foreground w-6 text-center">{modIdx + 1}</span>
                                    <span className="flex-1 text-base">{mod.title}</span>
                                    {mod.estimatedHours && (
                                      <span className="text-xs text-muted-foreground">{mod.estimatedHours}h</span>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModule(mod)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                      if (confirm("Delete this module?")) {
                                        deleteModuleMutation.mutate(mod.id);
                                      }
                                    }}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editMode !== null} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Create" : "Edit"} {editMode === "program" ? "Program" : editMode === "phase" ? "Phase" : "Module"}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? `Add a new training ${editMode}.`
                : `Update the training ${editMode} details.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Common fields */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={`${editMode} title`}
              />
            </div>

            {editMode === "program" && (
              <>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Program description"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Philosophy</Label>
                  <Textarea
                    value={formData.philosophy || ""}
                    onChange={(e) => setFormData({ ...formData, philosophy: e.target.value })}
                    placeholder="Program philosophy"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Hours</Label>
                    <Input
                      value={formData.estimatedHours || ""}
                      onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                      placeholder="e.g., 60-80"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status || "draft"} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Prerequisites</Label>
                  <Textarea
                    value={formData.prerequisites || ""}
                    onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                    placeholder="Prerequisites for the program"
                    rows={2}
                  />
                </div>
              </>
            )}

            {editMode === "phase" && (
              <>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Phase description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Hours</Label>
                    <Input
                      value={formData.estimatedHours || ""}
                      onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                      placeholder="e.g., 16-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Input
                      type="number"
                      value={formData.order ?? 0}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Milestone Review</Label>
                  <Textarea
                    value={formData.milestoneReview || ""}
                    onChange={(e) => setFormData({ ...formData, milestoneReview: e.target.value })}
                    placeholder="Milestone review details"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pass Criteria</Label>
                  <Textarea
                    value={formData.passCriteria || ""}
                    onChange={(e) => setFormData({ ...formData, passCriteria: e.target.value })}
                    placeholder="What does passing look like?"
                    rows={3}
                  />
                </div>
              </>
            )}

            {editMode === "module" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Hours</Label>
                    <Input
                      value={formData.estimatedHours || ""}
                      onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                      placeholder="e.g., 4-6"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Input
                      type="number"
                      value={formData.order ?? 0}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Client Story</Label>
                  <Textarea
                    value={formData.clientStory || ""}
                    onChange={(e) => setFormData({ ...formData, clientStory: e.target.value })}
                    placeholder="The client story and business context..."
                    rows={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assignment</Label>
                  <Textarea
                    value={formData.assignment || ""}
                    onChange={(e) => setFormData({ ...formData, assignment: e.target.value })}
                    placeholder="Goals and key decisions..."
                    rows={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Testing Requirements</Label>
                  <Textarea
                    value={formData.testingRequirements || ""}
                    onChange={(e) => setFormData({ ...formData, testingRequirements: e.target.value })}
                    placeholder="Test scenarios..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deliverables & Presentation</Label>
                  <Textarea
                    value={formData.deliverablesAndPresentation || ""}
                    onChange={(e) => setFormData({ ...formData, deliverablesAndPresentation: e.target.value })}
                    placeholder="What to prepare and present..."
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Be Ready to Answer</Label>
                  <Textarea
                    value={formData.beReadyToAnswer || ""}
                    onChange={(e) => setFormData({ ...formData, beReadyToAnswer: e.target.value })}
                    placeholder="Questions to prepare for..."
                    rows={4}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title?.trim()}>
              {isCreating ? "Create" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed Data Dialog */}
      <Dialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Seed Data</DialogTitle>
            <DialogDescription>
              Paste JSON seed data to bulk create a training program with phases and modules.
              The JSON should have a "program" object and a "phases" array.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={seedJson}
              onChange={(e) => setSeedJson(e.target.value)}
              placeholder='{"program": {...}, "phases": [...]}'
              rows={15}
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                try {
                  const data = JSON.parse(seedJson);
                  seedMutation.mutate(data);
                } catch {
                  toast({ title: "Invalid JSON", description: "Please check the format.", variant: "destructive" });
                }
              }}
              disabled={!seedJson.trim() || seedMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
