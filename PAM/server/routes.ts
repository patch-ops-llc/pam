import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertUserSchema, insertBrandingConfigSchema, insertAgencySchema, insertAccountSchema, insertAccountNoteSchema, insertProjectSchema, insertProjectAttachmentSchema, insertTaskSchema, insertSlackConfigurationSchema, insertQuotaConfigSchema, insertResourceQuotaSchema, insertPenguinHoursTrackerSchema, insertForecastInvoiceSchema, insertForecastExpenseSchema, insertForecastPayrollMemberSchema, insertForecastScenarioSchema, insertForecastRetainerSchema, insertForecastAccountRevenueSchema, insertForecastCapacityResourceSchema, insertForecastCapacityAllocationSchema, insertForecastResourceSchema, insertResourceMonthlyCapacitySchema, insertAccountForecastAllocationSchema, insertProjectTeamMemberSchema, insertUserAvailabilitySchema, insertHolidaySchema, insertProposalSchema, insertProposalDraftSchema, insertProposalPublishSchema, insertProposalScopeItemSchema, insertKnowledgeBaseDocumentSchema, insertGuidanceSettingSchema, insertChatTranscriptSchema, insertUatSessionSchema, insertUatGuestSchema, insertUatSessionCollaboratorSchema, insertUatChecklistItemSchema, insertUatResponseSchema, insertUatItemCommentSchema, insertUatChecklistItemStepSchema, uatImportSchema, insertTrainingProgramSchema, insertTrainingPhaseSchema, insertTrainingModuleSchema, insertTrainingModuleSectionSchema, insertTrainingEnrollmentSchema, insertTrainingModuleSubmissionSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { sendProposalAcceptanceEmail, sendUatSessionUpdateEmail } from "./email";
import { sendProposalAcceptedSlack } from "./slack";
import { getAnonymousUserId } from "./index";
import { setupAuth, requireAuth, requireQuotaAdmin, requireApiKeyOrAuth, generateApiKey, hashApiKey } from "./auth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { aiService } from "./ai-service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload PDF, DOCX, or TXT files."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for production (Railway/reverse proxy environments)
  if (process.env.NODE_ENV === 'production' || process.env.APP_URL) {
    app.set('trust proxy', 1);
  }

  // Session configuration
  app.use(session({
    store: storage.sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: !!(process.env.NODE_ENV === 'production' || process.env.APP_URL),
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax' // CSRF protection
    }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Setup username/password authentication
  setupAuth(app);

  // Google OAuth Strategy - for calendar connections only (uses separate strategy)
  passport.use("google-calendar", 
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/auth/google/calendar/callback",
        passReqToCallback: true,
        state: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email found in Google profile"));
          }

          // Store OAuth tokens for calendar access (no user ID needed - open access)
          if (accessToken && refreshToken) {
            const expiresAt = new Date(Date.now() + 3600 * 1000);
            
            try {
              const anonymousUserId = await getAnonymousUserId();
              await storage.createCalendarConnection({
                userId: anonymousUserId, // Use system anonymous user
                googleAccountEmail: email,
                accessToken,
                refreshToken,
                tokenExpiresAt: expiresAt,
                tokenScope: "https://www.googleapis.com/auth/calendar.readonly",
                tokenType: "Bearer",
                isActive: true
              });
            } catch (error) {
              console.error("Failed to store calendar connection:", error);
            }
          }
          
          return done(null, { email, connected: true });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google Calendar connection routes (open access - no login required)
  app.get("/auth/google/calendar", (req, res, next) => {
    passport.authenticate("google-calendar", { 
      scope: [
        "profile", 
        "email", 
        "https://www.googleapis.com/auth/calendar.readonly"
      ],
      accessType: "offline",
      prompt: "consent"
    })(req, res, next);
  });

  app.get("/auth/google/calendar/callback",
    passport.authenticate("google-calendar", { 
      failureRedirect: "/calendar?error=connection_failed",
      session: false
    }),
    (req, res) => {
      res.redirect("/calendar?success=calendar_connected");
    }
  );

  // Health check endpoint to verify deployed version
  app.get("/api/health/build", (req, res) => {
    res.json({
      buildTime: new Date().toISOString(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      pacingFixDeployed: true, // Marker for pacing calculation fix (Nov 2025)
      version: '1.0.1-pacing-fix'
    });
  });

  // Client routes (agencies in backend, clients in frontend terminology)
  app.get("/api/clients", async (req, res) => {
    try {
      const agencies = await storage.getAgencies();
      res.json(agencies);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validationResult = insertAgencySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid client data", 
          details: validationResult.error.issues 
        });
      }

      const agency = await storage.createAgency(validationResult.data);
      res.status(201).json(agency);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  app.patch("/api/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validation
      if (!id) {
        return res.status(400).json({ error: "Agency ID is required" });
      }

      // Define validation schema for partial agency updates with proper normalization
      const updateSchema = insertAgencySchema.partial().extend({
        type: z.enum(["agency", "direct"]).optional(),
        contactEmail: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            return s === "" ? null : s;
          },
          z.union([z.string().email("Invalid email format"), z.null()]).optional()
        ),
        contactPhone: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            return s === "" ? null : s;
          },
          z.union([z.string(), z.null()]).optional()
        ),
        monthlyBillingTarget: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            if (s === "") return null;
            const n = typeof s === 'number' ? s : Number(s);
            return isNaN(n) ? null : n.toString(); // Convert to string to match schema
          },
          z.union([z.string().refine(val => !val || Number(val) >= 0, { message: "Monthly billing target must be non-negative" }), z.null()]).optional()
        ),
      });

      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.issues 
        });
      }

      const updateData = validationResult.data;
      const updatedAgency = await storage.updateAgency(id, updateData);
      res.json(updatedAgency);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAgency(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Account routes
  app.get("/api/accounts", async (req, res) => {
    try {
      const accounts = await storage.getAccountsWithAgency();
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/by-agency/:agencyId", async (req, res) => {
    try {
      const { agencyId } = req.params;
      const accounts = await storage.getAccountsByAgency(agencyId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts by agency:", error);
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const accountData = insertAccountSchema.parse(req.body);
      const account = await storage.createAccount(accountData);
      res.status(201).json(account);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid account data", details: error.errors });
      }
      console.error("Error creating account:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.patch("/api/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertAccountSchema.partial();
      const validationResult = updateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid account data", 
          details: validationResult.error.issues 
        });
      }

      const account = await storage.updateAccount(id, validationResult.data);
      res.json(account);
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({ error: "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAccount(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Account Notes routes
  app.get("/api/accounts/:accountId/notes", async (req, res) => {
    try {
      const { accountId } = req.params;
      const notes = await storage.getAccountNotesByAccount(accountId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching account notes:", error);
      res.status(500).json({ error: "Failed to fetch account notes" });
    }
  });

  app.post("/api/accounts/:accountId/notes", async (req, res) => {
    try {
      const { accountId } = req.params;
      const noteData = insertAccountNoteSchema.parse({ ...req.body, accountId });
      const note = await storage.createAccountNote(noteData);
      res.status(201).json(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid note data", details: error.errors });
      }
      console.error("Error creating account note:", error);
      res.status(500).json({ error: "Failed to create account note" });
    }
  });

  app.patch("/api/accounts/:accountId/notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertAccountNoteSchema.partial().omit({ accountId: true });
      const validationResult = updateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid note data", 
          details: validationResult.error.issues 
        });
      }

      const note = await storage.updateAccountNote(id, validationResult.data);
      res.json(note);
    } catch (error) {
      console.error("Error updating account note:", error);
      res.status(500).json({ error: "Failed to update account note" });
    }
  });

  app.delete("/api/accounts/:accountId/notes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAccountNote(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account note:", error);
      res.status(500).json({ error: "Failed to delete account note" });
    }
  });

  // Project routes
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjectsWithRelations();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/by-account/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const projects = await storage.getProjectsByAccount(accountId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects by account:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const createSchema = insertProjectSchema.extend({
        goLiveDate: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            return s === "" ? null : s;
          },
          z.union([z.string(), z.null()]).optional()
        ),
        startDate: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            if (s === "") return null;
            if (typeof s === 'string' && !s.includes('T')) {
              return new Date(s + 'T00:00:00');
            }
            return s ? new Date(s) : null;
          },
          z.union([z.date(), z.null()]).optional()
        ),
        endDate: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            if (s === "") return null;
            if (typeof s === 'string' && !s.includes('T')) {
              return new Date(s + 'T00:00:00');
            }
            return s ? new Date(s) : null;
          },
          z.union([z.date(), z.null()]).optional()
        ),
      });
      
      const projectData = createSchema.parse(req.body);
      const project = await storage.createProject(projectData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Project ID is required" });
      }

      // Define validation schema with proper preprocessing for project updates
      const updateSchema = insertProjectSchema.partial().extend({
        goLiveDate: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            return s === "" ? null : s;
          },
          z.union([z.string(), z.null()]).optional()
        ),
        startDate: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            if (s === "") return null;
            if (typeof s === 'string' && !s.includes('T')) {
              return new Date(s + 'T00:00:00');
            }
            return s ? new Date(s) : null;
          },
          z.union([z.date(), z.null()]).optional()
        ),
        endDate: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            if (s === "") return null;
            if (typeof s === 'string' && !s.includes('T')) {
              return new Date(s + 'T00:00:00');
            }
            return s ? new Date(s) : null;
          },
          z.union([z.date(), z.null()]).optional()
        ),
        estimatedHours: z.preprocess(
          v => {
            if (v == null) return null;
            const s = typeof v === 'string' ? v.trim() : v;
            if (s === "") return null;
            const n = typeof s === 'number' ? s : Number(s);
            return isNaN(n) ? null : n.toString();
          },
          z.union([z.string(), z.null()]).optional()
        ),
      });

      const validationResult = updateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.issues 
        });
      }

      const updatedProject = await storage.updateProject(id, validationResult.data);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Soft delete: set deletedAt instead of actually deleting
      await storage.updateProject(id, { deletedAt: new Date() });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.delete("/api/projects/:id/hard", async (req, res) => {
    try {
      const { id } = req.params;
      // Hard delete: permanently remove project
      await storage.hardDeleteProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error hard deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  app.post("/api/projects/:id/restore", async (req, res) => {
    try {
      const { id } = req.params;
      // Restore archived project by setting status to active and stage to in-progress
      const updatedProject = await storage.updateProject(id, { 
        status: "active",
        stage: "in-progress"
      });
      res.json(updatedProject);
    } catch (error) {
      console.error("Error restoring project:", error);
      res.status(500).json({ error: "Failed to restore project" });
    }
  });

  // Task routes
  app.get("/api/tasks", async (req, res) => {
    try {
      const tasks = await storage.getTasksWithRelations();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/by-project/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const tasks = await storage.getTasksByProject(projectId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks by project:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/by-account/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      const tasks = await storage.getTasksByAccount(accountId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks by account:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const { 
        agencyId, 
        accountId, 
        projectId, 
        name, 
        description,
        status = "todo",
        priority = "medium",
        estimatedHours,
        assignedToUserId,
        startDate,
        dueDate,
        labelIds = [],
        collaboratorIds = []
      } = req.body;

      // Basic validation
      if (!name) {
        return res.status(400).json({ 
          error: "Missing required field: name" 
        });
      }

      const task = await storage.createTask({
        agencyId: agencyId || null,
        accountId: accountId || null,
        projectId: projectId || null,
        name,
        description: description || null,
        status,
        priority,
        estimatedHours: estimatedHours || null,
        assignedToUserId: assignedToUserId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        isActive: true
      });

      // Create label associations
      if (Array.isArray(labelIds) && labelIds.length > 0) {
        for (const labelId of labelIds) {
          await storage.createTaskLabelAssignment(task.id, labelId);
        }
      }

      // Create collaborator associations
      if (Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
        for (const userId of collaboratorIds) {
          await storage.addTaskCollaborator(task.id, userId);
        }
      }

      // Send Slack notifications for task_created event
      try {
        const users = await storage.getUsers();
        if (users.length > 0) {
          const configurations = await storage.getSlackConfigurationsByUser(users[0].id);
          const agency = agencyId ? await storage.getAgency(agencyId) : null;
          const account = accountId ? await storage.getAccount(accountId) : null;
          
          for (const config of configurations) {
            if (config.isActive && config.eventTypes.includes('task_created')) {
              const matchesAgency = !config.agencyId || config.agencyId === agencyId;
              const matchesAccount = !config.accountId || config.accountId === accountId;
              
              if (matchesAgency && matchesAccount) {
                const message = {
                  text: `✅ Task Created`,
                  blocks: [
                    {
                      type: "header",
                      text: {
                        type: "plain_text",
                        text: "✅ New Task Created"
                      }
                    },
                    {
                      type: "section",
                      fields: [
                        {
                          type: "mrkdwn",
                          text: `*Task:*\n${name}`
                        },
                        {
                          type: "mrkdwn",
                          text: `*Priority:*\n${priority}`
                        },
                        {
                          type: "mrkdwn",
                          text: `*Agency:*\n${agency?.name || 'N/A'}`
                        },
                        {
                          type: "mrkdwn",
                          text: `*Account:*\n${account?.name || 'N/A'}`
                        }
                      ]
                    },
                    ...(description ? [{
                      type: "section",
                      text: {
                        type: "mrkdwn",
                        text: `*Description:*\n${description}`
                      }
                    }] : [])
                  ]
                };

                await fetch(config.webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(message)
                });
              }
            }
          }
        }
      } catch (slackError) {
        console.error("Error sending Slack notification:", slackError);
      }

      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Task ID is required" });
      }

      // Define validation schema for task updates - only allow certain fields
      const updateTaskSchema = z.object({
        name: z.string().min(1, "Name is required").optional(),
        description: z.preprocess(
          v => v === "" ? null : v,
          z.string().nullable().optional()
        ),
        status: z.enum(["todo", "in-progress", "completed", "cancelled"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        estimatedHours: z.preprocess(
          v => {
            if (v === "" || v === null || v === undefined) return null;
            const n = typeof v === 'number' ? v : Number(v);
            return isNaN(n) ? null : n.toString(); // Convert to string to match schema
          },
          z.union([z.string().refine(val => !val || Number(val) >= 0, { message: "Estimated hours must be non-negative" }), z.null()]).optional()
        ),
        startDate: z.string().optional(),
        dueDate: z.union([z.string(), z.null()]).optional(),
        labelIds: z.array(z.string()).optional(),
        collaboratorIds: z.array(z.string()).optional(),
      });

      const validationResult = updateTaskSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.issues 
        });
      }

      const { labelIds, collaboratorIds, ...updateData } = validationResult.data;
      
      // Get the task before updating to check if status is changing to completed
      const taskBefore = await storage.getTask(id);
      const updatedTask = await storage.updateTask(id, updateData);
      
      // Update label associations if provided
      if (labelIds !== undefined) {
        // Remove all existing labels
        const existingLabels = await storage.getTaskLabelsByTask(id);
        for (const label of existingLabels) {
          await storage.deleteTaskLabelAssignment(id, label.id);
        }
        
        // Add new labels
        for (const labelId of labelIds) {
          await storage.createTaskLabelAssignment(id, labelId);
        }
      }

      // Update collaborator associations if provided
      if (collaboratorIds !== undefined) {
        // Remove all existing collaborators
        const existingCollaborators = await storage.getTaskCollaboratorsByTask(id);
        for (const collaborator of existingCollaborators) {
          await storage.removeTaskCollaborator(id, collaborator.id);
        }
        
        // Add new collaborators
        for (const userId of collaboratorIds) {
          await storage.addTaskCollaborator(id, userId);
        }
      }
      
      // Send Slack notifications for task_completed event
      if (updateData.status === 'completed' && taskBefore?.status !== 'completed') {
        try {
          const users = await storage.getUsers();
          if (users.length > 0) {
            const configurations = await storage.getSlackConfigurationsByUser(users[0].id);
            const agency = await storage.getAgencyById(updatedTask.agencyId);
            const account = await storage.getAccountById(updatedTask.accountId);
            
            for (const config of configurations) {
              if (config.isActive && config.eventTypes.includes('task_completed')) {
                const matchesAgency = !config.agencyId || config.agencyId === updatedTask.agencyId;
                const matchesAccount = !config.accountId || config.accountId === updatedTask.accountId;
                
                if (matchesAgency && matchesAccount) {
                  const message = {
                    text: `🎉 Task Completed`,
                    blocks: [
                      {
                        type: "header",
                        text: {
                          type: "plain_text",
                          text: "🎉 Task Completed"
                        }
                      },
                      {
                        type: "section",
                        fields: [
                          {
                            type: "mrkdwn",
                            text: `*Task:*\n${updatedTask.name}`
                          },
                          {
                            type: "mrkdwn",
                            text: `*Priority:*\n${updatedTask.priority}`
                          },
                          {
                            type: "mrkdwn",
                            text: `*Agency:*\n${agency?.name || 'Unknown'}`
                          },
                          {
                            type: "mrkdwn",
                            text: `*Account:*\n${account?.name || 'Unknown'}`
                          }
                        ]
                      },
                      ...(updatedTask.description ? [{
                        type: "section",
                        text: {
                          type: "mrkdwn",
                          text: `*Description:*\n${updatedTask.description}`
                        }
                      }] : [])
                    ]
                  };

                  await fetch(config.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                  });
                }
              }
            }
          }
        } catch (slackError) {
          console.error("Error sending Slack notification:", slackError);
        }
      }
      
      res.json(updatedTask);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Task ID is required" });
      }

      // Soft delete: set deletedAt instead of actually deleting
      await storage.updateTask(id, { deletedAt: new Date() });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  });

  // Bulk task operations
  app.post("/api/tasks/bulk/complete", async (req, res) => {
    try {
      const { taskIds } = req.body;
      
      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "taskIds array is required" });
      }

      // Update all tasks to completed status
      for (const taskId of taskIds) {
        await storage.updateTask(taskId, { status: "completed" });
      }

      res.json({ message: `${taskIds.length} tasks marked as complete` });
    } catch (error) {
      console.error("Error bulk completing tasks:", error);
      res.status(500).json({ error: "Failed to complete tasks" });
    }
  });

  app.post("/api/tasks/bulk/priority", async (req, res) => {
    try {
      const { taskIds, priority } = req.body;
      
      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "taskIds array is required" });
      }
      
      if (!priority || !["low", "medium", "high", "urgent"].includes(priority)) {
        return res.status(400).json({ error: "Valid priority is required" });
      }

      // Update all tasks with new priority
      for (const taskId of taskIds) {
        await storage.updateTask(taskId, { priority });
      }

      res.json({ message: `${taskIds.length} tasks priority updated to ${priority}` });
    } catch (error) {
      console.error("Error bulk updating task priorities:", error);
      res.status(500).json({ error: "Failed to update task priorities" });
    }
  });

  app.post("/api/tasks/bulk/delete", async (req, res) => {
    try {
      const { taskIds } = req.body;
      
      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "taskIds array is required" });
      }

      // Delete all tasks
      for (const taskId of taskIds) {
        await storage.deleteTask(taskId);
      }

      res.json({ message: `${taskIds.length} tasks deleted` });
    } catch (error) {
      console.error("Error bulk deleting tasks:", error);
      res.status(500).json({ error: "Failed to delete tasks" });
    }
  });

  // Task Labels routes
  app.get("/api/task-labels", async (req, res) => {
    try {
      const labels = await storage.getTaskLabels();
      res.json(labels);
    } catch (error) {
      console.error("Error fetching task labels:", error);
      res.status(500).json({ error: "Failed to fetch task labels" });
    }
  });

  app.post("/api/task-labels", async (req, res) => {
    try {
      const { name, color } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Label name is required" });
      }

      const label = await storage.createTaskLabel({ name, color });
      res.status(201).json(label);
    } catch (error) {
      console.error("Error creating task label:", error);
      res.status(500).json({ error: "Failed to create task label" });
    }
  });

  app.patch("/api/task-labels/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, color } = req.body;
      
      const label = await storage.updateTaskLabel(id, { name, color });
      res.json(label);
    } catch (error) {
      console.error("Error updating task label:", error);
      res.status(500).json({ error: "Failed to update task label" });
    }
  });

  app.delete("/api/task-labels/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTaskLabel(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task label:", error);
      res.status(500).json({ error: "Failed to delete task label" });
    }
  });

  // Task label assignments
  app.get("/api/tasks/:taskId/labels", async (req, res) => {
    try {
      const { taskId } = req.params;
      const labels = await storage.getTaskLabelsByTask(taskId);
      res.json(labels);
    } catch (error) {
      console.error("Error fetching task labels:", error);
      res.status(500).json({ error: "Failed to fetch task labels" });
    }
  });

  app.post("/api/tasks/:taskId/labels/:labelId", async (req, res) => {
    try {
      const { taskId, labelId } = req.params;
      const assignment = await storage.assignLabelToTask(taskId, labelId);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning label to task:", error);
      res.status(500).json({ error: "Failed to assign label to task" });
    }
  });

  app.delete("/api/tasks/:taskId/labels/:labelId", async (req, res) => {
    try {
      const { taskId, labelId } = req.params;
      await storage.removeLabelFromTask(taskId, labelId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing label from task:", error);
      res.status(500).json({ error: "Failed to remove label from task" });
    }
  });

  // Task collaborators
  app.get("/api/tasks/:taskId/collaborators", async (req, res) => {
    try {
      const { taskId } = req.params;
      const collaborators = await storage.getTaskCollaboratorsByTask(taskId);
      res.json(collaborators);
    } catch (error) {
      console.error("Error fetching task collaborators:", error);
      res.status(500).json({ error: "Failed to fetch task collaborators" });
    }
  });

  app.post("/api/tasks/:taskId/collaborators/:userId", async (req, res) => {
    try {
      const { taskId, userId } = req.params;
      const collaborator = await storage.addTaskCollaborator(taskId, userId);
      res.status(201).json(collaborator);
    } catch (error) {
      console.error("Error adding task collaborator:", error);
      res.status(500).json({ error: "Failed to add task collaborator" });
    }
  });

  app.delete("/api/tasks/:taskId/collaborators/:userId", async (req, res) => {
    try {
      const { taskId, userId } = req.params;
      await storage.removeTaskCollaborator(taskId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing task collaborator:", error);
      res.status(500).json({ error: "Failed to remove task collaborator" });
    }
  });

  // Time log routes - paginated endpoint
  app.get("/api/time-logs/paginated", async (req, res) => {
    try {
      const { start, end, userId, agencyId, accountId, page = '1', pageSize = '50' } = req.query;
      
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize as string) || 50));
      
      let timeLogs = await storage.getTimeLogsWithRelations();
      
      // Apply date filters
      if (start) {
        const startMatch = (start as string).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (startMatch) {
          const [, year, month, day] = startMatch;
          const startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          timeLogs = timeLogs.filter(log => {
            const logDateStr = typeof log.logDate === 'string' 
              ? log.logDate.slice(0, 10) 
              : log.logDate.toISOString().slice(0, 10);
            const [ly, lm, ld] = logDateStr.split('-').map(Number);
            const logDate = new Date(ly, lm - 1, ld);
            return logDate >= startDate;
          });
        }
      }
      
      if (end) {
        const endMatch = (end as string).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (endMatch) {
          const [, year, month, day] = endMatch;
          const endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          timeLogs = timeLogs.filter(log => {
            const logDateStr = typeof log.logDate === 'string' 
              ? log.logDate.slice(0, 10) 
              : log.logDate.toISOString().slice(0, 10);
            const [ly, lm, ld] = logDateStr.split('-').map(Number);
            const logDate = new Date(ly, lm - 1, ld);
            return logDate <= endDate;
          });
        }
      }
      
      // Apply other filters
      if (userId) {
        timeLogs = timeLogs.filter(log => log.userId === userId);
      }
      if (agencyId) {
        timeLogs = timeLogs.filter(log => log.agencyId === agencyId);
      }
      if (accountId) {
        timeLogs = timeLogs.filter(log => log.accountId === accountId);
      }
      
      // Sort by date descending
      timeLogs.sort((a, b) => {
        const dateA = new Date(a.logDate);
        const dateB = new Date(b.logDate);
        return dateB.getTime() - dateA.getTime();
      });
      
      const total = timeLogs.length;
      const totalPages = Math.ceil(total / pageSizeNum);
      const offset = (pageNum - 1) * pageSizeNum;
      const paginatedLogs = timeLogs.slice(offset, offset + pageSizeNum);
      
      // Calculate hours metrics
      const metrics = {
        totalActualHours: 0,
        totalBilledHours: 0,
        tier1ActualHours: 0,
        tier1BilledHours: 0,
        tier2ActualHours: 0,
        tier2BilledHours: 0,
        tier3ActualHours: 0,
        tier3BilledHours: 0,
      };
      
      // Account-level breakdown: { [accountId]: { accountName, agencyId, agencyName, total, tier1, tier2, tier3 } }
      const accountBreakdown: Record<string, {
        accountId: string;
        accountName: string;
        agencyId: string | null;
        agencyName: string;
        totalActual: number;
        totalBilled: number;
        tier1Actual: number;
        tier1Billed: number;
        tier2Actual: number;
        tier2Billed: number;
        tier3Actual: number;
        tier3Billed: number;
      }> = {};
      
      for (const log of timeLogs) {
        const actual = parseFloat(log.actualHours?.toString() || '0') || 0;
        const billed = parseFloat(log.billedHours?.toString() || '0') || 0;
        const tier = log.tier || 'tier1';
        
        metrics.totalActualHours += actual;
        metrics.totalBilledHours += billed;
        
        if (tier === 'tier1') {
          metrics.tier1ActualHours += actual;
          metrics.tier1BilledHours += billed;
        } else if (tier === 'tier2') {
          metrics.tier2ActualHours += actual;
          metrics.tier2BilledHours += billed;
        } else if (tier === 'tier3') {
          metrics.tier3ActualHours += actual;
          metrics.tier3BilledHours += billed;
        }
        
        // Account breakdown
        const accId = log.accountId || 'unassigned';
        if (!accountBreakdown[accId]) {
          accountBreakdown[accId] = {
            accountId: accId,
            accountName: log.account?.name || 'Unassigned',
            agencyId: log.agencyId || null,
            agencyName: log.agency?.name || 'No Agency',
            totalActual: 0,
            totalBilled: 0,
            tier1Actual: 0,
            tier1Billed: 0,
            tier2Actual: 0,
            tier2Billed: 0,
            tier3Actual: 0,
            tier3Billed: 0,
          };
        }
        
        accountBreakdown[accId].totalActual += actual;
        accountBreakdown[accId].totalBilled += billed;
        
        if (tier === 'tier1') {
          accountBreakdown[accId].tier1Actual += actual;
          accountBreakdown[accId].tier1Billed += billed;
        } else if (tier === 'tier2') {
          accountBreakdown[accId].tier2Actual += actual;
          accountBreakdown[accId].tier2Billed += billed;
        } else if (tier === 'tier3') {
          accountBreakdown[accId].tier3Actual += actual;
          accountBreakdown[accId].tier3Billed += billed;
        }
      }
      
      // Convert to array and sort by agency then account name
      const accountMetrics = Object.values(accountBreakdown).sort((a, b) => {
        if (a.agencyName !== b.agencyName) {
          return a.agencyName.localeCompare(b.agencyName);
        }
        return a.accountName.localeCompare(b.accountName);
      });
      
      res.json({
        data: paginatedLogs,
        total,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages,
        metrics,
        accountMetrics
      });
    } catch (error) {
      console.error("Error fetching paginated time logs:", error);
      res.status(500).json({ error: "Failed to fetch time logs" });
    }
  });

  // Time log export endpoint (returns all filtered logs for CSV export)
  app.get("/api/time-logs/export", async (req, res) => {
    try {
      const { start, end, userId, agencyId, accountId } = req.query;
      
      let timeLogs = await storage.getTimeLogsWithRelations();
      
      // Apply date filters
      if (start) {
        const startMatch = (start as string).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (startMatch) {
          const [, year, month, day] = startMatch;
          const startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          timeLogs = timeLogs.filter(log => {
            const logDateStr = typeof log.logDate === 'string' 
              ? log.logDate.slice(0, 10) 
              : log.logDate.toISOString().slice(0, 10);
            const [ly, lm, ld] = logDateStr.split('-').map(Number);
            const logDate = new Date(ly, lm - 1, ld);
            return logDate >= startDate;
          });
        }
      }
      
      if (end) {
        const endMatch = (end as string).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (endMatch) {
          const [, year, month, day] = endMatch;
          const endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          timeLogs = timeLogs.filter(log => {
            const logDateStr = typeof log.logDate === 'string' 
              ? log.logDate.slice(0, 10) 
              : log.logDate.toISOString().slice(0, 10);
            const [ly, lm, ld] = logDateStr.split('-').map(Number);
            const logDate = new Date(ly, lm - 1, ld);
            return logDate <= endDate;
          });
        }
      }
      
      // Apply other filters
      if (userId) {
        timeLogs = timeLogs.filter(log => log.userId === userId);
      }
      if (agencyId) {
        timeLogs = timeLogs.filter(log => log.agencyId === agencyId);
      }
      if (accountId) {
        timeLogs = timeLogs.filter(log => log.accountId === accountId);
      }
      
      // Sort by date descending
      timeLogs.sort((a, b) => {
        const dateA = new Date(a.logDate);
        const dateB = new Date(b.logDate);
        return dateB.getTime() - dateA.getTime();
      });
      
      res.json(timeLogs);
    } catch (error) {
      console.error("Error exporting time logs:", error);
      res.status(500).json({ error: "Failed to export time logs" });
    }
  });

  app.get("/api/time-logs", async (req, res) => {
    try {
      const { start, end, userId } = req.query;
      
      // If date range is provided, use the filtered method
      if (start && end) {
        // Parse dates correctly to avoid UTC conversion issues
        let startDate: Date;
        let endDate: Date;
        
        const startMatch = (start as string).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (startMatch) {
          const [, year, month, day] = startMatch;
          startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          startDate = new Date(start as string);
        }
        
        const endMatch = (end as string).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (endMatch) {
          const [, year, month, day] = endMatch;
          endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          endDate = new Date(end as string);
        }
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ error: "Invalid date format" });
        }
        
        const timeLogs = await storage.getTimeLogsByRange(startDate, endDate, userId as string);
        res.json(timeLogs);
      } else {
        let timeLogs = await storage.getTimeLogsWithRelations();
        
        // Filter by userId if provided
        if (userId) {
          timeLogs = timeLogs.filter(log => log.userId === userId);
        }
        
        res.json(timeLogs);
      }
    } catch (error) {
      console.error("Error fetching time logs:", error);
      res.status(500).json({ error: "Failed to fetch time logs" });
    }
  });

  app.post("/api/time-logs", async (req, res) => {
    try {
      const { 
        userId, 
        agencyId, 
        accountId, 
        projectId, 
        taskId, 
        taskName,
        description, 
        actualHours, 
        billedHours,
        tier,
        billingType,
        logDate,
        agencyTimeTrackerLogged 
      } = req.body;

      // Basic validation
      if (!userId || !agencyId || !accountId || !taskName || !actualHours || !billedHours) {
        return res.status(400).json({ 
          error: "Missing required fields: userId, agencyId, accountId, taskName, actualHours, billedHours" 
        });
      }

      // Parse logDate correctly - use exact date string to avoid timezone shifts
      let parsedLogDate: Date;
      if (logDate) {
        // Append time to force interpretation as local midnight, avoiding timezone shifts
        const dateMatch = logDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          // Add T00:00:00 to force local timezone interpretation
          parsedLogDate = new Date(`${logDate}T00:00:00`);
        } else {
          parsedLogDate = new Date(logDate);
        }
      } else {
        parsedLogDate = new Date();
      }

      const timeLog = await storage.createTimeLog({
        userId,
        agencyId,
        accountId,
        projectId: projectId || null,
        taskId: taskId || null,
        taskName,
        description: description || null,
        actualHours: actualHours.toString(),
        billedHours: billedHours.toString(),
        tier: tier || "tier1",
        billingType: billingType || "billed",
        agencyTimeTrackerLogged: agencyTimeTrackerLogged ?? null,
        logDate: parsedLogDate,
        startTime: null,
        endTime: null
      });

      // Send Slack notifications for time_log_created event
      try {
        console.log("🔔 Checking for Slack configurations for time_log_created event...");
        const users = await storage.getUsers();
        if (users.length > 0) {
          const configurations = await storage.getSlackConfigurationsByUser(users[0].id);
          console.log(`Found ${configurations.length} Slack configurations`);
          const user = await storage.getUser(userId);
          const agency = await storage.getAgency(agencyId);
          const account = await storage.getAccount(accountId);
          
          for (const config of configurations) {
            console.log(`Checking config: ${config.name}, active: ${config.isActive}, eventTypes: ${config.eventTypes.join(', ')}`);
            // Check if config is active and listens to time_log_created events
            if (config.isActive && config.eventTypes.includes('time_log_created')) {
              // Check if config matches the agency/account (null means all)
              const matchesAgency = !config.agencyId || config.agencyId === agencyId;
              const matchesAccount = !config.accountId || config.accountId === accountId;
              
              if (matchesAgency && matchesAccount) {
                console.log(`✅ Sending Slack notification to ${config.channelName}...`);
                // Send notification to Slack
                const message = {
                  text: `⏱️ Time Log Created`,
                  blocks: [
                    {
                      type: "header",
                      text: {
                        type: "plain_text",
                        text: "⏱️ New Time Log Entry"
                      }
                    },
                    {
                      type: "section",
                      fields: [
                        {
                          type: "mrkdwn",
                          text: `*User:*\n${user?.username || 'Unknown'}`
                        },
                        {
                          type: "mrkdwn",
                          text: `*Agency:*\n${agency?.name || 'Unknown'}`
                        },
                        {
                          type: "mrkdwn",
                          text: `*Account:*\n${account?.name || 'Unknown'}`
                        },
                        {
                          type: "mrkdwn",
                          text: `*Hours:*\n${actualHours}h actual, ${billedHours}h billed`
                        }
                      ]
                    },
                    {
                      type: "section",
                      text: {
                        type: "mrkdwn",
                        text: `*Description:*\n${description}`
                      }
                    }
                  ]
                };

                await fetch(config.webhookUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(message)
                });
              }
            }
          }
        }
      } catch (slackError) {
        console.error("Error sending Slack notification:", slackError);
        // Don't fail the request if Slack notification fails
      }

      res.status(201).json(timeLog);
    } catch (error) {
      console.error("Error creating time log:", error);
      res.status(500).json({ error: "Failed to create time log" });
    }
  });

  // Update time log entry
  app.patch("/api/time-logs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Time log ID is required" });
      }

      // Validation schema for updating time logs
      const updateTimeLogSchema = z.object({
        description: z.string().min(1, "Description is required").optional(),
        taskName: z.string().min(1, "Task name is required").optional(),
        projectId: z.string().uuid().optional(),
        accountId: z.string().uuid().optional(),
        agencyId: z.string().uuid().optional(),
        logDate: z.preprocess(
          v => {
            if (v === "" || v === null || v === undefined) return undefined;
            if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
              return new Date(v + 'T00:00:00.000Z');
            }
            return undefined;
          },
          z.date().optional()
        ),
        actualHours: z.preprocess(
          v => {
            if (v === "" || v === null || v === undefined) return undefined;
            const n = typeof v === 'number' ? v : Number(v);
            return isNaN(n) ? undefined : n.toString();
          },
          z.string().refine(val => !val || Number(val) >= 0, { message: "Actual hours must be non-negative" }).optional()
        ),
        billedHours: z.preprocess(
          v => {
            if (v === "" || v === null || v === undefined) return undefined;
            const n = typeof v === 'number' ? v : Number(v);
            return isNaN(n) ? undefined : n.toString();
          },
          z.string().refine(val => !val || Number(val) >= 0, { message: "Billed hours must be non-negative" }).optional()
        ),
        tier: z.enum(["tier1", "tier2", "tier3"]).optional(),
        billingType: z.enum(["billed", "prebilled"]).optional(),
      });

      const validationResult = updateTimeLogSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.issues 
        });
      }

      const updateData = validationResult.data;
      
      // Validate referenced entities exist
      if (updateData.projectId) {
        const project = await storage.getProject(updateData.projectId);
        if (!project) {
          return res.status(400).json({ error: "Invalid project ID" });
        }
      }
      
      if (updateData.accountId) {
        const account = await storage.getAccount(updateData.accountId);
        if (!account) {
          return res.status(400).json({ error: "Invalid account ID" });
        }
      }
      
      if (updateData.agencyId) {
        const agency = await storage.getAgency(updateData.agencyId);
        if (!agency) {
          return res.status(400).json({ error: "Invalid agency ID" });
        }
      }
      
      const updatedTimeLog = await storage.updateTimeLog(id, updateData);
      res.json(updatedTimeLog);
    } catch (error) {
      console.error("Error updating time log:", error);
      
      // Handle specific error cases
      if (error instanceof Error && error.message.includes("No active accounts")) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: "Failed to update time log" });
    }
  });

  // Delete time log entry
  app.delete("/api/time-logs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ error: "Time log ID is required" });
      }

      await storage.deleteTimeLog(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time log:", error);
      res.status(500).json({ error: "Failed to delete time log" });
    }
  });

  // Monthly time log report for invoicing
  app.get("/api/time-logs/reports/monthly", async (req, res) => {
    try {
      const { year, month } = req.query;
      
      if (!year || !month) {
        return res.status(400).json({ error: "Year and month are required" });
      }
      
      const yearNum = parseInt(year as string);
      const monthNum = parseInt(month as string);
      
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: "Invalid year or month" });
      }
      
      const report = await storage.getMonthlyTimeLogReport(yearNum, monthNum);
      res.json(report);
    } catch (error) {
      console.error("Error generating monthly report:", error);
      res.status(500).json({ error: "Failed to generate monthly report" });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Sanitize user data to remove password hashes
      const sanitizedUsers = users.map(user => {
        const { password, ...sanitized } = user;
        return sanitized;
      });
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { hashPassword } = await import("./auth");
      const validation = insertUserSchema.omit({ id: true }).safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid user data", details: validation.error });
      }
      
      // Check for existing username
      const existingUser = await storage.getUserByUsername(validation.data.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      // Check for existing email
      const existingEmail = await storage.getUserByEmail(validation.data.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      // Hash password before storing
      const user = await storage.createUser({
        ...validation.data,
        password: await hashPassword(validation.data.password),
      });
      
      // Sanitize user data
      const { password, ...sanitizedUser } = user;
      res.status(201).json(sanitizedUser);
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      // Handle PostgreSQL unique constraint violations
      if (error?.code === '23505') {
        if (error.constraint?.includes('username')) {
          return res.status(409).json({ error: "Username already exists" });
        }
        if (error.constraint?.includes('email')) {
          return res.status(409).json({ error: "Email already exists" });
        }
        return res.status(409).json({ error: "A user with this information already exists" });
      }
      
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertUserSchema.omit({ id: true, password: true }).partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid user data", details: validation.error });
      }
      
      // If email is being changed, check it's not already in use
      if (validation.data.email) {
        const existingEmail = await storage.getUserByEmail(validation.data.email);
        if (existingEmail && existingEmail.id !== id) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }
      
      // If username is being changed, check it's not already in use
      if (validation.data.username) {
        const existingUser = await storage.getUserByUsername(validation.data.username);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }
      
      const user = await storage.updateUser(id, validation.data);
      
      // Sanitize user data
      const { password, ...sanitizedUser } = user;
      res.json(sanitizedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      // Handle PostgreSQL unique constraint violations
      if (error?.code === '23505') {
        if (error.constraint?.includes('username')) {
          return res.status(409).json({ error: "Username already exists" });
        }
        if (error.constraint?.includes('email')) {
          return res.status(409).json({ error: "Email already exists" });
        }
        return res.status(409).json({ error: "A user with this information already exists" });
      }
      
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Branding Config routes
  app.get("/api/branding-configs", async (req, res) => {
    try {
      const configs = await storage.getBrandingConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching branding configs:", error);
      res.status(500).json({ error: "Failed to fetch branding configs" });
    }
  });

  app.get("/api/branding-configs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const config = await storage.getBrandingConfig(id);
      if (!config) {
        return res.status(404).json({ error: "Branding config not found" });
      }
      res.json(config);
    } catch (error) {
      console.error("Error fetching branding config:", error);
      res.status(500).json({ error: "Failed to fetch branding config" });
    }
  });

  app.post("/api/branding-configs", async (req, res) => {
    try {
      const validation = insertBrandingConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid branding config data", details: validation.error });
      }
      
      const config = await storage.createBrandingConfig(validation.data);
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating branding config:", error);
      res.status(500).json({ error: "Failed to create branding config" });
    }
  });

  app.patch("/api/branding-configs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertBrandingConfigSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid branding config data", details: validation.error });
      }
      
      const config = await storage.updateBrandingConfig(id, validation.data);
      res.json(config);
    } catch (error) {
      console.error("Error updating branding config:", error);
      res.status(500).json({ error: "Failed to update branding config" });
    }
  });

  app.delete("/api/branding-configs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBrandingConfig(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting branding config:", error);
      res.status(500).json({ error: "Failed to delete branding config" });
    }
  });

  // Calendar Connection routes
  app.get("/api/calendar-connections", async (req, res) => {
    try {
      // Open access - return all calendar connections for system anonymous user
      const anonymousUserId = await getAnonymousUserId();
      const connections = await storage.getCalendarConnectionsByUser(anonymousUserId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching calendar connections:", error);
      res.status(500).json({ error: "Failed to fetch calendar connections" });
    }
  });

  app.delete("/api/calendar-connections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCalendarConnection(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting calendar connection:", error);
      res.status(500).json({ error: "Failed to delete calendar connection" });
    }
  });

  // Calendar routes
  app.get("/api/calendars", async (req, res) => {
    try {
      const { connectionId } = req.query;
      if (!connectionId) {
        return res.status(400).json({ error: "Connection ID is required" });
      }
      const calendars = await storage.getCalendarsByConnection(connectionId as string);
      res.json(calendars);
    } catch (error) {
      console.error("Error fetching calendars:", error);
      res.status(500).json({ error: "Failed to fetch calendars" });
    }
  });

  // Calendar Event routes
  app.get("/api/calendar-events", async (req, res) => {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ error: "Start and end dates are required" });
      }
      
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const events = await storage.getCalendarEventsByDateRange(startDate, endDate);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/hours-by-week", async (req, res) => {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ error: "Start and end dates are required" });
      }
      
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const data = await storage.getHoursSummaryByWeek(startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error("Error fetching hours by week:", error);
      res.status(500).json({ error: "Failed to fetch hours by week" });
    }
  });

  app.get("/api/analytics/hours-by-month", async (req, res) => {
    try {
      const { start, end } = req.query;
      
      if (!start || !end) {
        return res.status(400).json({ error: "Start and end dates are required" });
      }
      
      const startDate = new Date(start as string);
      const endDate = new Date(end as string);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }
      
      const data = await storage.getHoursSummaryByMonth(startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error("Error fetching hours by month:", error);
      res.status(500).json({ error: "Failed to fetch hours by month" });
    }
  });

  app.get("/api/analytics/target-progress", async (req, res) => {
    try {
      const data = await storage.getTargetProgressByAgency();
      res.json(data);
    } catch (error) {
      console.error("Error fetching target progress:", error);
      res.status(500).json({ error: "Failed to fetch target progress" });
    }
  });

  app.get("/api/analytics/hours-by-account", async (req, res) => {
    try {
      const data = await storage.getHoursByAccount();
      res.json(data);
    } catch (error) {
      console.error("Error fetching hours by account:", error);
      res.status(500).json({ error: "Failed to fetch hours by account" });
    }
  });

  app.get("/api/analytics/hours-by-agency", async (req, res) => {
    try {
      const data = await storage.getHoursByAgency();
      res.json(data);
    } catch (error) {
      console.error("Error fetching hours by agency:", error);
      res.status(500).json({ error: "Failed to fetch hours by agency" });
    }
  });

  app.get("/api/analytics/efficiency-by-account", async (req, res) => {
    try {
      const data = await storage.getEfficiencyRatesByAccount();
      res.json(data);
    } catch (error) {
      console.error("Error fetching efficiency by account:", error);
      res.status(500).json({ error: "Failed to fetch efficiency by account" });
    }
  });

  app.get("/api/analytics/efficiency-by-agency", async (req, res) => {
    try {
      const data = await storage.getEfficiencyRatesByAgency();
      res.json(data);
    } catch (error) {
      console.error("Error fetching efficiency by agency:", error);
      res.status(500).json({ error: "Failed to fetch efficiency by agency" });
    }
  });

  app.get("/api/analytics/monthly-breakdown", async (req, res) => {
    try {
      const data = await storage.getMonthlyBreakdownByPerson();
      res.json(data);
    } catch (error) {
      console.error("Error fetching monthly breakdown:", error);
      res.status(500).json({ error: "Failed to fetch monthly breakdown" });
    }
  });

  app.get("/api/analytics/bonus-eligibility", async (req, res) => {
    try {
      const data = await storage.getWeeklyBonusEligibility();
      res.json(data);
    } catch (error) {
      console.error("Error fetching bonus eligibility:", error);
      res.status(500).json({ error: "Failed to fetch bonus eligibility" });
    }
  });

  app.get("/api/analytics/resource-quota-tracker", async (req, res) => {
    try {
      const month = req.query.month as string;
      if (!month) {
        return res.status(400).json({ error: "Month parameter is required (format: YYYY-MM)" });
      }
      const data = await storage.getResourceQuotaTracker(month);
      res.json(data);
    } catch (error) {
      console.error("Error fetching resource quota tracker:", error);
      res.status(500).json({ error: "Failed to fetch resource quota tracker" });
    }
  });

  app.get("/api/analytics/client-quota-tracker", async (req, res) => {
    try {
      const month = req.query.month as string;
      if (!month) {
        return res.status(400).json({ error: "Month parameter is required (format: YYYY-MM)" });
      }
      const data = await storage.getClientQuotaTracker(month);
      res.json(data);
    } catch (error) {
      console.error("Error fetching client quota tracker:", error);
      res.status(500).json({ error: "Failed to fetch client quota tracker" });
    }
  });

  app.get("/api/analytics/account-quota-tracker", async (req, res) => {
    try {
      const month = req.query.month as string;
      const agencyId = req.query.agencyId as string | undefined;
      if (!month) {
        return res.status(400).json({ error: "Month parameter is required (format: YYYY-MM)" });
      }
      const data = await storage.getAccountQuotaTracker(month, agencyId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching account quota tracker:", error);
      res.status(500).json({ error: "Failed to fetch account quota tracker" });
    }
  });

  // Google Calendar connection route
  app.post("/api/calendar-connections/google", async (req, res) => {
    try {
      // Redirect to Google OAuth
      res.json({ 
        message: "Google Calendar connection initiated",
        authUrl: `/auth/google/calendar`
      });
    } catch (error) {
      console.error("Error initiating calendar connection:", error);
      res.status(500).json({ error: "Failed to initiate calendar connection" });
    }
  });

  app.post("/api/calendar-connections/:id/sync", async (req, res) => {
    try {
      // For now, just return success - would implement actual sync logic
      res.json({ message: "Calendar sync initiated" });
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ error: "Failed to sync calendar" });
    }
  });

  // Slack Configuration Routes (open access)
  app.post("/api/slack-configurations", async (req, res) => {
    try {
      // Validate webhook URL format
      if (req.body.webhookUrl && !req.body.webhookUrl.match(/^https:\/\/hooks\.slack\.com\/services\/.+/)) {
        return res.status(400).json({ error: "Invalid Slack webhook URL format" });
      }

      // Validate channel name format
      if (req.body.channelName && !req.body.channelName.match(/^#[\w-]+$/)) {
        return res.status(400).json({ error: "Channel name must start with # and contain only letters, numbers, hyphens and underscores" });
      }

      // Get first user as default (since there's no auth system)
      const users = await storage.getUsers();
      const defaultUserId = users.length > 0 ? users[0].id : null;
      
      if (!defaultUserId) {
        return res.status(500).json({ error: "No users found in system" });
      }

      const validation = insertSlackConfigurationSchema.safeParse({
        ...req.body,
        userId: defaultUserId
      });

      if (!validation.success) {
        return res.status(400).json({ error: "Invalid slack configuration data", details: validation.error });
      }

      const slackConfig = await storage.createSlackConfiguration(validation.data);
      
      // Mask webhook URL in response
      res.status(201).json({
        ...slackConfig,
        webhookUrl: `****${slackConfig.webhookUrl.slice(-4)}`
      });
    } catch (error) {
      console.error("Error creating slack configuration:", error);
      res.status(500).json({ error: "Failed to create slack configuration" });
    }
  });

  app.get("/api/slack-configurations", async (req, res) => {
    try {
      // Get first user as default (since there's no auth system)
      const users = await storage.getUsers();
      const defaultUserId = users.length > 0 ? users[0].id : null;
      
      if (!defaultUserId) {
        return res.json([]);
      }

      const configurations = await storage.getSlackConfigurationsByUser(defaultUserId);
      // Mask webhook URLs for security - only show last 4 characters
      const maskedConfigurations = configurations.map(config => ({
        ...config,
        webhookUrl: `****${config.webhookUrl.slice(-4)}`,
        hasWebhookSecret: true
      }));
      res.json(maskedConfigurations);
    } catch (error) {
      console.error("Error fetching slack configurations:", error);
      res.status(500).json({ error: "Failed to fetch slack configurations" });
    }
  });

  app.put("/api/slack-configurations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate and sanitize the request - only allow certain fields to be updated
      const allowedFields = ['name', 'webhookUrl', 'channelName', 'agencyId', 'accountId', 'eventTypes', 'isActive'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (field in req.body && req.body[field] !== undefined && req.body[field] !== '') {
          updateData[field] = req.body[field];
        }
      }

      // Only validate webhook URL if it's being updated
      if (updateData.webhookUrl && !updateData.webhookUrl.match(/^https:\/\/hooks\.slack\.com\/services\/.+/)) {
        return res.status(400).json({ error: "Invalid Slack webhook URL format" });
      }

      // Validate channel name format
      if (updateData.channelName && !updateData.channelName.match(/^#[\w-]+$/)) {
        return res.status(400).json({ error: "Channel name must start with # and contain only letters, numbers, hyphens and underscores" });
      }

      const validation = insertSlackConfigurationSchema.partial().safeParse(updateData);

      if (!validation.success) {
        return res.status(400).json({ error: "Invalid slack configuration data", details: validation.error });
      }

      const updatedConfig = await storage.updateSlackConfiguration(id, updateData);
      
      // Mask webhook URL in response and indicate secret exists
      res.json({
        ...updatedConfig,
        webhookUrl: `****${updatedConfig.webhookUrl.slice(-4)}`,
        hasWebhookSecret: true
      });
    } catch (error) {
      console.error("Error updating slack configuration:", error);
      res.status(500).json({ error: "Failed to update slack configuration" });
    }
  });

  app.delete("/api/slack-configurations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteSlackConfiguration(id);
      res.json({ message: "Slack configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting slack configuration:", error);
      res.status(500).json({ error: "Failed to delete slack configuration" });
    }
  });

  // Slack Test Endpoint - sends a test message to verify webhook works
  app.post("/api/slack-configurations/:id/test", async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log("🔍 Testing Slack configuration:", id);
      
      // Get the configuration
      const config = await storage.getSlackConfigurationById(id);
      if (!config) {
        console.log("❌ Configuration not found:", id);
        return res.status(404).json({ error: "Slack configuration not found" });
      }
      
      console.log("📋 Configuration found:", {
        id: config.id,
        name: config.name,
        channelName: config.channelName,
        isActive: config.isActive,
        webhookUrlLength: config.webhookUrl.length,
        webhookUrlPrefix: config.webhookUrl.substring(0, 30) + "..."
      });
      
      // Prepare test message
      const testMessage = {
        text: "🧪 Test Message from PAM",
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🧪 Slack Integration Test"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Configuration:*\n${config.name}`
              },
              {
                type: "mrkdwn",
                text: `*Channel:*\n${config.channelName}`
              },
              {
                type: "mrkdwn",
                text: `*Status:*\n${config.isActive ? '✅ Active' : '⏸️ Inactive'}`
              },
              {
                type: "mrkdwn",
                text: `*Timestamp:*\n${new Date().toLocaleString()}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "If you're seeing this message, your Slack webhook is working correctly! 🎉"
            }
          }
        ]
      };
      
      console.log("📤 Sending test message to Slack...");
      console.log("Webhook URL:", config.webhookUrl);
      console.log("Message:", JSON.stringify(testMessage, null, 2));
      
      // Send test message
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });
      
      console.log("📥 Slack response status:", response.status);
      console.log("📥 Slack response ok:", response.ok);
      
      const responseText = await response.text();
      console.log("📥 Slack response body:", responseText);
      
      if (!response.ok) {
        console.error("❌ Slack API error:", {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        
        return res.status(response.status).json({ 
          error: "Slack webhook failed", 
          details: {
            status: response.status,
            statusText: response.statusText,
            body: responseText
          }
        });
      }
      
      console.log("✅ Test message sent successfully!");
      
      res.json({ 
        success: true, 
        message: "Test message sent successfully to Slack!",
        debug: {
          webhookUrl: `${config.webhookUrl.substring(0, 30)}...`,
          responseStatus: response.status,
          responseBody: responseText
        }
      });
    } catch (error) {
      console.error("❌ Error testing slack configuration:", error);
      res.status(500).json({ 
        error: "Failed to test slack configuration",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Quota Configuration Routes
  app.get("/api/quota-configs", async (req, res) => {
    try {
      const configs = await storage.getAllQuotaConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Error fetching quota configs:", error);
      res.status(500).json({ error: "Failed to fetch quota configurations" });
    }
  });

  app.get("/api/quota-configs/agency/:agencyId", async (req, res) => {
    try {
      const { agencyId } = req.params;
      const config = await storage.getQuotaConfigByAgency(agencyId);
      
      if (!config) {
        return res.status(404).json({ error: "Quota configuration not found for this agency" });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error fetching quota config:", error);
      res.status(500).json({ error: "Failed to fetch quota configuration" });
    }
  });

  app.post("/api/quota-configs", async (req, res) => {
    try {
      const validation = insertQuotaConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid quota configuration data", details: validation.error });
      }
      
      const config = await storage.createQuotaConfig(validation.data);
      res.status(201).json(config);
    } catch (error) {
      console.error("Error creating quota config:", error);
      res.status(500).json({ error: "Failed to create quota configuration" });
    }
  });

  app.put("/api/quota-configs/:agencyId", async (req, res) => {
    try {
      const { agencyId } = req.params;
      const validation = insertQuotaConfigSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid quota configuration data", details: validation.error });
      }
      
      const config = await storage.upsertQuotaConfig(agencyId, validation.data);
      res.json(config);
    } catch (error) {
      console.error("Error updating quota config:", error);
      res.status(500).json({ error: "Failed to update quota configuration" });
    }
  });

  app.delete("/api/quota-configs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQuotaConfig(id);
      res.json({ message: "Quota configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting quota config:", error);
      res.status(500).json({ error: "Failed to delete quota configuration" });
    }
  });

  // Resource Quota Routes
  app.get("/api/resource-quotas", async (req, res) => {
    try {
      const quotas = await storage.getAllResourceQuotas();
      res.json(quotas);
    } catch (error) {
      console.error("Error fetching resource quotas:", error);
      res.status(500).json({ error: "Failed to fetch resource quotas" });
    }
  });

  app.post("/api/resource-quotas", async (req, res) => {
    try {
      const validation = insertResourceQuotaSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid resource quota data", details: validation.error });
      }
      const quota = await storage.createResourceQuota(validation.data);
      res.status(201).json(quota);
    } catch (error) {
      console.error("Error creating resource quota:", error);
      res.status(500).json({ error: "Failed to create resource quota" });
    }
  });

  app.patch("/api/resource-quotas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertResourceQuotaSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid resource quota data", details: validation.error });
      }
      const quota = await storage.updateResourceQuota(id, validation.data);
      res.json(quota);
    } catch (error) {
      console.error("Error updating resource quota:", error);
      res.status(500).json({ error: "Failed to update resource quota" });
    }
  });

  app.delete("/api/resource-quotas/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteResourceQuota(id);
      res.json({ message: "Resource quota deleted successfully" });
    } catch (error) {
      console.error("Error deleting resource quota:", error);
      res.status(500).json({ error: "Failed to delete resource quota" });
    }
  });

  // Partner Bonus Policy Routes
  app.get("/api/partner-bonus-policies", async (_req, res) => {
    try {
      const policies = await storage.getPartnerBonusPolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching partner bonus policies:", error);
      res.status(500).json({ error: "Failed to fetch partner bonus policies" });
    }
  });

  app.get("/api/partner-bonus-policies/agency/:agencyId", async (req, res) => {
    try {
      const { agencyId } = req.params;
      const policy = await storage.getPartnerBonusPolicyByAgency(agencyId);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found for this agency" });
      }
      res.json(policy);
    } catch (error) {
      console.error("Error fetching partner bonus policy:", error);
      res.status(500).json({ error: "Failed to fetch partner bonus policy" });
    }
  });

  app.post("/api/partner-bonus-policies", requireQuotaAdmin, async (req, res) => {
    try {
      const policy = await storage.createPartnerBonusPolicy(req.body);
      res.status(201).json(policy);
    } catch (error) {
      console.error("Error creating partner bonus policy:", error);
      res.status(500).json({ error: "Failed to create partner bonus policy" });
    }
  });

  app.patch("/api/partner-bonus-policies/:id", requireQuotaAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const policy = await storage.updatePartnerBonusPolicy(id, req.body);
      res.json(policy);
    } catch (error) {
      console.error("Error updating partner bonus policy:", error);
      res.status(500).json({ error: "Failed to update partner bonus policy" });
    }
  });

  app.delete("/api/partner-bonus-policies/:id", requireQuotaAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePartnerBonusPolicy(id);
      res.json({ message: "Partner bonus policy deleted successfully" });
    } catch (error) {
      console.error("Error deleting partner bonus policy:", error);
      res.status(500).json({ error: "Failed to delete partner bonus policy" });
    }
  });

  // Individual Quota Bonus Settings Routes
  app.get("/api/individual-quota-bonus-settings", async (_req, res) => {
    try {
      const settings = await storage.getIndividualQuotaBonusSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching individual quota bonus settings:", error);
      res.status(500).json({ error: "Failed to fetch individual quota bonus settings" });
    }
  });

  app.patch("/api/individual-quota-bonus-settings/:id", requireQuotaAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const settings = await storage.updateIndividualQuotaBonusSettings(id, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating individual quota bonus settings:", error);
      res.status(500).json({ error: "Failed to update individual quota bonus settings" });
    }
  });

  // Quota Periods Routes
  app.get("/api/quota-periods", async (_req, res) => {
    try {
      const periods = await storage.getQuotaPeriods();
      res.json(periods);
    } catch (error) {
      console.error("Error fetching quota periods:", error);
      res.status(500).json({ error: "Failed to fetch quota periods" });
    }
  });

  app.get("/api/quota-periods/:yearMonth", async (req, res) => {
    try {
      const { yearMonth } = req.params;
      const period = await storage.getQuotaPeriodByMonth(yearMonth);
      if (!period) {
        return res.status(404).json({ error: "Quota period not found" });
      }
      res.json(period);
    } catch (error) {
      console.error("Error fetching quota period:", error);
      res.status(500).json({ error: "Failed to fetch quota period" });
    }
  });

  app.post("/api/quota-periods", requireQuotaAdmin, async (req, res) => {
    try {
      const period = await storage.createQuotaPeriod(req.body);
      res.status(201).json(period);
    } catch (error) {
      console.error("Error creating quota period:", error);
      res.status(500).json({ error: "Failed to create quota period" });
    }
  });

  app.patch("/api/quota-periods/:id", requireQuotaAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const period = await storage.updateQuotaPeriod(id, req.body);
      res.json(period);
    } catch (error) {
      console.error("Error updating quota period:", error);
      res.status(500).json({ error: "Failed to update quota period" });
    }
  });

  // Penguin Hours Tracker Routes
  app.get("/api/penguin-hours-tracker/:agencyId", async (req, res) => {
    try {
      const { agencyId } = req.params;
      const tracker = await storage.getPenguinHoursTracker(agencyId);
      
      if (!tracker) {
        return res.status(404).json({ error: "Tracker not found for this agency" });
      }
      
      const hoursUsed = await storage.getPenguinHoursUsed(agencyId, tracker.startDate);
      
      res.json({
        ...tracker,
        hoursUsed
      });
    } catch (error) {
      console.error("Error fetching penguin hours tracker:", error);
      res.status(500).json({ error: "Failed to fetch penguin hours tracker" });
    }
  });

  app.post("/api/penguin-hours-tracker", async (req, res) => {
    try {
      console.log("Penguin Hours Tracker - Request body:", JSON.stringify(req.body));
      const validation = insertPenguinHoursTrackerSchema.safeParse(req.body);
      
      if (!validation.success) {
        console.error("Penguin Hours Tracker - Validation failed:", JSON.stringify(validation.error, null, 2));
        return res.status(400).json({ error: "Invalid tracker data", details: validation.error });
      }
      
      const tracker = await storage.createPenguinHoursTracker(validation.data);
      const hoursUsed = await storage.getPenguinHoursUsed(validation.data.agencyId, tracker.startDate);
      
      res.status(201).json({
        ...tracker,
        hoursUsed
      });
    } catch (error) {
      console.error("Error creating penguin hours tracker:", error);
      res.status(500).json({ error: "Failed to create penguin hours tracker" });
    }
  });

  app.post("/api/penguin-hours-tracker/:agencyId/reset", async (req, res) => {
    try {
      const { agencyId } = req.params;
      const tracker = await storage.resetPenguinHoursTracker(agencyId);
      const hoursUsed = await storage.getPenguinHoursUsed(agencyId, tracker.startDate);
      
      res.json({
        ...tracker,
        hoursUsed
      });
    } catch (error) {
      console.error("Error resetting penguin hours tracker:", error);
      res.status(500).json({ error: "Failed to reset penguin hours tracker" });
    }
  });

  // Forecasting - Invoices
  app.get("/api/forecast/invoices", async (_req, res) => {
    try {
      const invoices = await storage.getForecastInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching forecast invoices:", error);
      res.status(500).json({ error: "Failed to fetch forecast invoices" });
    }
  });

  app.post("/api/forecast/invoices", async (req, res) => {
    try {
      const validation = insertForecastInvoiceSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid invoice data", details: validation.error });
      }
      
      const invoice = await storage.createForecastInvoice(validation.data);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating forecast invoice:", error);
      res.status(500).json({ error: "Failed to create forecast invoice" });
    }
  });

  app.patch("/api/forecast/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastInvoiceSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid invoice data", details: validation.error });
      }
      
      const invoice = await storage.updateForecastInvoice(id, validation.data);
      res.json(invoice);
    } catch (error) {
      console.error("Error updating forecast invoice:", error);
      res.status(500).json({ error: "Failed to update forecast invoice" });
    }
  });

  app.delete("/api/forecast/invoices/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastInvoice(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting forecast invoice:", error);
      res.status(500).json({ error: "Failed to delete forecast invoice" });
    }
  });

  // Forecasting - Expenses
  app.get("/api/forecast/expenses", async (_req, res) => {
    try {
      const expenses = await storage.getForecastExpenses();
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching forecast expenses:", error);
      res.status(500).json({ error: "Failed to fetch forecast expenses" });
    }
  });

  app.post("/api/forecast/expenses", async (req, res) => {
    try {
      const validation = insertForecastExpenseSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid expense data", details: validation.error });
      }
      
      // If it's recurring, create multiple expense entries
      if (validation.data.isRecurring && validation.data.recurrenceInterval) {
        const expenses = [];
        const startDate = new Date(validation.data.date);
        const endDate = validation.data.recurrenceEndDate 
          ? new Date(validation.data.recurrenceEndDate)
          : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate()); // Default to 1 year
        
        let currentDate = new Date(startDate);
        const maxIterations = 100; // Safety limit
        let iterations = 0;
        
        while (currentDate <= endDate && iterations < maxIterations) {
          const expenseData = {
            ...validation.data,
            date: currentDate.toISOString().split('T')[0],
          };
          
          const expense = await storage.createForecastExpense(expenseData);
          expenses.push(expense);
          
          // Calculate next date based on interval
          if (validation.data.recurrenceInterval === 'weekly') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (validation.data.recurrenceInterval === 'biweekly') {
            currentDate.setDate(currentDate.getDate() + 14);
          } else if (validation.data.recurrenceInterval === 'monthly') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
          
          iterations++;
        }
        
        res.status(201).json(expenses);
      } else {
        // Single expense
        const expense = await storage.createForecastExpense(validation.data);
        res.status(201).json(expense);
      }
    } catch (error) {
      console.error("Error creating forecast expense:", error);
      res.status(500).json({ error: "Failed to create forecast expense" });
    }
  });

  app.patch("/api/forecast/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastExpenseSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid expense data", details: validation.error });
      }
      
      const expense = await storage.updateForecastExpense(id, validation.data);
      res.json(expense);
    } catch (error) {
      console.error("Error updating forecast expense:", error);
      res.status(500).json({ error: "Failed to update forecast expense" });
    }
  });

  app.delete("/api/forecast/expenses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastExpense(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting forecast expense:", error);
      res.status(500).json({ error: "Failed to delete forecast expense" });
    }
  });

  // Forecasting - Payroll Members
  app.get("/api/forecast/payroll-members", async (_req, res) => {
    try {
      const members = await storage.getForecastPayrollMembers();
      res.json(members);
    } catch (error) {
      console.error("Error fetching payroll members:", error);
      res.status(500).json({ error: "Failed to fetch payroll members" });
    }
  });

  app.post("/api/forecast/payroll-members", async (req, res) => {
    try {
      const validation = insertForecastPayrollMemberSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid payroll member data", details: validation.error });
      }
      
      const member = await storage.createForecastPayrollMember(validation.data);
      res.status(201).json(member);
    } catch (error) {
      console.error("Error creating payroll member:", error);
      res.status(500).json({ error: "Failed to create payroll member" });
    }
  });

  app.patch("/api/forecast/payroll-members/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastPayrollMemberSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid payroll member data", details: validation.error });
      }
      
      const member = await storage.updateForecastPayrollMember(id, validation.data);
      res.json(member);
    } catch (error) {
      console.error("Error updating payroll member:", error);
      res.status(500).json({ error: "Failed to update payroll member" });
    }
  });

  app.delete("/api/forecast/payroll-members/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastPayrollMember(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payroll member:", error);
      res.status(500).json({ error: "Failed to delete payroll member" });
    }
  });

  // Forecasting - Scenarios
  app.get("/api/forecast/scenarios", async (_req, res) => {
    try {
      const scenarios = await storage.getForecastScenarios();
      res.json(scenarios);
    } catch (error) {
      console.error("Error fetching forecast scenarios:", error);
      res.status(500).json({ error: "Failed to fetch forecast scenarios" });
    }
  });

  app.post("/api/forecast/scenarios", async (req, res) => {
    try {
      const validation = insertForecastScenarioSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid scenario data", details: validation.error });
      }
      
      const scenario = await storage.createForecastScenario(validation.data);
      res.status(201).json(scenario);
    } catch (error) {
      console.error("Error creating forecast scenario:", error);
      res.status(500).json({ error: "Failed to create forecast scenario" });
    }
  });

  app.patch("/api/forecast/scenarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastScenarioSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid scenario data", details: validation.error });
      }
      
      const scenario = await storage.updateForecastScenario(id, validation.data);
      res.json(scenario);
    } catch (error) {
      console.error("Error updating forecast scenario:", error);
      res.status(500).json({ error: "Failed to update forecast scenario" });
    }
  });

  app.delete("/api/forecast/scenarios/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastScenario(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting forecast scenario:", error);
      res.status(500).json({ error: "Failed to delete forecast scenario" });
    }
  });

  // Forecasting - Retainers
  app.get("/api/forecast/retainers", async (_req, res) => {
    try {
      const retainers = await storage.getForecastRetainers();
      res.json(retainers);
    } catch (error) {
      console.error("Error fetching forecast retainers:", error);
      res.status(500).json({ error: "Failed to fetch forecast retainers" });
    }
  });

  app.post("/api/forecast/retainers", async (req, res) => {
    try {
      const validation = insertForecastRetainerSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid retainer data", details: validation.error });
      }
      
      const retainer = await storage.createForecastRetainer(validation.data);
      res.status(201).json(retainer);
    } catch (error) {
      console.error("Error creating forecast retainer:", error);
      res.status(500).json({ error: "Failed to create forecast retainer" });
    }
  });

  app.patch("/api/forecast/retainers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastRetainerSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid retainer data", details: validation.error });
      }
      
      const retainer = await storage.updateForecastRetainer(id, validation.data);
      res.json(retainer);
    } catch (error) {
      console.error("Error updating forecast retainer:", error);
      res.status(500).json({ error: "Failed to update forecast retainer" });
    }
  });

  app.delete("/api/forecast/retainers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastRetainer(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting forecast retainer:", error);
      res.status(500).json({ error: "Failed to delete forecast retainer" });
    }
  });

  // Forecasting - Account Revenue
  app.get("/api/forecast/account-revenue", async (_req, res) => {
    try {
      const accountRevenue = await storage.getForecastAccountRevenue();
      res.json(accountRevenue);
    } catch (error) {
      console.error("Error fetching forecast account revenue:", error);
      res.status(500).json({ error: "Failed to fetch forecast account revenue" });
    }
  });

  app.post("/api/forecast/account-revenue", async (req, res) => {
    try {
      const validation = insertForecastAccountRevenueSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid account revenue data", details: validation.error });
      }
      
      const accountRevenue = await storage.createForecastAccountRevenue(validation.data);
      res.status(201).json(accountRevenue);
    } catch (error) {
      console.error("Error creating forecast account revenue:", error);
      res.status(500).json({ error: "Failed to create forecast account revenue" });
    }
  });

  app.patch("/api/forecast/account-revenue/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastAccountRevenueSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid account revenue data", details: validation.error });
      }
      
      const accountRevenue = await storage.updateForecastAccountRevenue(id, validation.data);
      res.json(accountRevenue);
    } catch (error) {
      console.error("Error updating forecast account revenue:", error);
      res.status(500).json({ error: "Failed to update forecast account revenue" });
    }
  });

  app.delete("/api/forecast/account-revenue/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastAccountRevenue(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting forecast account revenue:", error);
      res.status(500).json({ error: "Failed to delete forecast account revenue" });
    }
  });

  // Forecasting - Capacity Resources
  app.get("/api/forecast/capacity/resources", async (_req, res) => {
    try {
      const resources = await storage.getForecastCapacityResources();
      res.json(resources);
    } catch (error) {
      console.error("Error fetching capacity resources:", error);
      res.status(500).json({ error: "Failed to fetch capacity resources" });
    }
  });

  app.post("/api/forecast/capacity/resources", async (req, res) => {
    try {
      const validation = insertForecastCapacityResourceSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid capacity resource data", details: validation.error });
      }
      
      const data = {
        ...validation.data,
        defaultBillableHours: validation.data.defaultBillableHours.toString(),
        defaultActualHours: validation.data.defaultActualHours.toString(),
        defaultEfficiencyPercent: validation.data.defaultEfficiencyPercent.toString(),
      };
      
      const resource = await storage.createForecastCapacityResource(data);
      res.status(201).json(resource);
    } catch (error) {
      console.error("Error creating capacity resource:", error);
      res.status(500).json({ error: "Failed to create capacity resource" });
    }
  });

  app.patch("/api/forecast/capacity/resources/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastCapacityResourceSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid capacity resource data", details: validation.error });
      }
      
      const data = {
        ...validation.data,
        ...(validation.data.defaultBillableHours !== undefined && { defaultBillableHours: validation.data.defaultBillableHours.toString() }),
        ...(validation.data.defaultActualHours !== undefined && { defaultActualHours: validation.data.defaultActualHours.toString() }),
        ...(validation.data.defaultEfficiencyPercent !== undefined && { defaultEfficiencyPercent: validation.data.defaultEfficiencyPercent.toString() }),
      };
      
      const resource = await storage.updateForecastCapacityResource(id, data);
      res.json(resource);
    } catch (error) {
      console.error("Error updating capacity resource:", error);
      res.status(500).json({ error: "Failed to update capacity resource" });
    }
  });

  app.delete("/api/forecast/capacity/resources/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastCapacityResource(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting capacity resource:", error);
      res.status(500).json({ error: "Failed to delete capacity resource" });
    }
  });

  // Forecasting - Capacity Allocations
  app.get("/api/forecast/capacity/allocations", async (_req, res) => {
    try {
      const allocations = await storage.getForecastCapacityAllocations();
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching capacity allocations:", error);
      res.status(500).json({ error: "Failed to fetch capacity allocations" });
    }
  });

  app.post("/api/forecast/capacity/allocations", async (req, res) => {
    try {
      const validation = insertForecastCapacityAllocationSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid capacity allocation data", details: validation.error });
      }
      
      const data = {
        ...validation.data,
        monthlyBillableHours: validation.data.monthlyBillableHours.toString(),
      };
      
      const allocation = await storage.createForecastCapacityAllocation(data);
      res.status(201).json(allocation);
    } catch (error) {
      console.error("Error creating capacity allocation:", error);
      res.status(500).json({ error: "Failed to create capacity allocation" });
    }
  });

  app.patch("/api/forecast/capacity/allocations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastCapacityAllocationSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid capacity allocation data", details: validation.error });
      }
      
      const data = {
        ...validation.data,
        ...(validation.data.monthlyBillableHours !== undefined && { monthlyBillableHours: validation.data.monthlyBillableHours.toString() }),
      };
      
      const allocation = await storage.updateForecastCapacityAllocation(id, data);
      res.json(allocation);
    } catch (error) {
      console.error("Error updating capacity allocation:", error);
      res.status(500).json({ error: "Failed to update capacity allocation" });
    }
  });

  app.delete("/api/forecast/capacity/allocations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastCapacityAllocation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting capacity allocation:", error);
      res.status(500).json({ error: "Failed to delete capacity allocation" });
    }
  });

  // Forecasting - Revenue Breakdowns by Client
  app.get("/api/forecast/quota-breakdown", async (req, res) => {
    try {
      // Get blended rate from settings
      let settings = await storage.getForecastSettings();
      if (!settings) {
        settings = await storage.upsertForecastSettings({ blendedRate: "90" });
      }
      const BLENDED_RATE = parseFloat(settings.blendedRate);
      
      // Accept months parameter directly instead of converting from days
      const forecastMonths = parseInt(req.query.months as string) || 1;
      const today = new Date();
      
      console.log('[quota-breakdown] Request params:', { months: req.query.months, forecastMonths, today: today.toISOString() });
      
      // Start from the beginning of the current month
      const forecastStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      forecastStartDate.setHours(0, 0, 0, 0);
      
      console.log('[quota-breakdown] Forecast months:', forecastMonths);
      
      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      };
      
      // Helper function to parse date string as local date (not UTC)
      const parseAsLocalDate = (dateString: string): Date => {
        const date = new Date(dateString);
        // If the string is in YYYY-MM-DD format, new Date() treats it as UTC
        // We need to adjust it to be interpreted as local
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
        return date;
      };
      
      // Get all invoices - use ALL invoices (pending and received) for blocking, but only pending for revenue
      const invoices = await storage.getForecastInvoices();
      const pendingInvoices = invoices.filter((inv: any) => inv.status === 'pending');
      
      // Build a set of agency-month pairs that have ANY invoices (pending or received) for blocking quota/retainers
      const invoicedMonths = new Set<string>();
      invoices.forEach((invoice: any) => {
        // Use forecastMonth if available, otherwise fall back to realizationDate, dueDate, or date
        const relevantDate = invoice.forecastMonth
          ? parseAsLocalDate(invoice.forecastMonth)
          : invoice.realizationDate 
            ? parseAsLocalDate(invoice.realizationDate)
            : invoice.dueDate 
              ? parseAsLocalDate(invoice.dueDate) 
              : parseAsLocalDate(invoice.date);
        const agencyId = invoice.agencyId || "unassigned";
        const monthKey = getMonthKey(relevantDate);
        invoicedMonths.add(`${agencyId}-${monthKey}`);
      });
      
      console.log('[quota-breakdown] Invoiced months:', Array.from(invoicedMonths));
      
      // Get all quota configs
      const quotaConfigs = await storage.getAllQuotaConfigs();
      
      // Calculate quota revenue breakdown by agency
      // Only count quota for months without invoices (quota is for collecting, not invoicing)
      const quotaByAgency: { [agencyId: string]: number } = {};
      
      quotaConfigs.forEach((config: any) => {
        if (config.monthlyTarget && !config.noQuota && config.agencyId) {
          const monthlyRevenue = parseFloat(config.monthlyTarget) * BLENDED_RATE;
          const agencyId = config.agencyId;
          
          // Count only months without invoices
          let quotaRevenue = 0;
          for (let i = 0; i < forecastMonths; i++) {
            const month = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
            const monthKey = getMonthKey(month);
            
            // Only add quota revenue if this month doesn't have an invoice
            if (!invoicedMonths.has(`${agencyId}-${monthKey}`)) {
              quotaRevenue += monthlyRevenue;
            }
          }
          
          quotaByAgency[agencyId] = (quotaByAgency[agencyId] || 0) + quotaRevenue;
        }
      });
      
      console.log('[quota-breakdown] Final result:', quotaByAgency);
      
      res.json(quotaByAgency);
    } catch (error) {
      console.error("Error calculating quota breakdown:", error);
      res.status(500).json({ error: "Failed to calculate quota breakdown" });
    }
  });

  app.get("/api/forecast/invoice-breakdown", async (req, res) => {
    try {
      const invoices = await storage.getForecastInvoices();
      const invoiceByAgency: { [agencyId: string]: number } = {};
      
      // Always include ALL pending invoices in forecast, regardless of date
      invoices.forEach((invoice: any) => {
        if (invoice.status === "pending") {
          const agencyId = invoice.agencyId || "unassigned";
          const amount = parseFloat(invoice.amount);
          invoiceByAgency[agencyId] = (invoiceByAgency[agencyId] || 0) + amount;
        }
      });
      
      res.json(invoiceByAgency);
    } catch (error) {
      console.error("Error calculating invoice breakdown:", error);
      res.status(500).json({ error: "Failed to calculate invoice breakdown" });
    }
  });

  app.get("/api/forecast/retainer-breakdown", async (req, res) => {
    try {
      const forecastMonths = parseInt(req.query.months as string) || 1;
      const today = new Date();
      
      // Start from the beginning of the current month
      const forecastStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      forecastStartDate.setHours(0, 0, 0, 0);
      
      // Calculate end date based on number of months
      const forecastEndDate = new Date(today.getFullYear(), today.getMonth() + forecastMonths, 0);
      forecastEndDate.setHours(23, 59, 59, 999);
      
      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      };
      
      // Helper function to parse date string as local date (not UTC)
      const parseAsLocalDate = (dateString: string): Date => {
        const date = new Date(dateString);
        // If the string is in YYYY-MM-DD format, new Date() treats it as UTC
        // We need to adjust it to be interpreted as local
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
        return date;
      };
      
      // Get all invoices to determine which agency-months already have invoices
      const invoices = await storage.getForecastInvoices();
      const invoicedMonths = new Set<string>();
      
      invoices.forEach((invoice: any) => {
        // Use forecastMonth if available, otherwise fall back to realizationDate, dueDate, or date
        const relevantDate = invoice.forecastMonth
          ? parseAsLocalDate(invoice.forecastMonth)
          : invoice.realizationDate 
            ? parseAsLocalDate(invoice.realizationDate)
            : invoice.dueDate 
              ? parseAsLocalDate(invoice.dueDate) 
              : parseAsLocalDate(invoice.date);
        if (relevantDate >= forecastStartDate && relevantDate <= forecastEndDate) {
          const agencyId = invoice.agencyId || "unassigned";
          const monthKey = getMonthKey(relevantDate);
          invoicedMonths.add(`${agencyId}-${monthKey}`);
        }
      });
      
      const retainers = await storage.getForecastRetainers();
      const retainerByAgency: { [agencyId: string]: number } = {};
      
      retainers.forEach((retainer: any) => {
        const startDate = new Date(retainer.startDate);
        const endDate = retainer.endDate ? new Date(retainer.endDate) : null;
        
        const agencyId = retainer.agencyId || "unassigned";
        const monthlyAmount = parseFloat(retainer.monthlyAmount);
        
        // Count full months where retainer is active AND no invoice exists
        let revenue = 0;
        for (let i = 0; i < forecastMonths; i++) {
          const monthStart = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
          const monthEnd = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i + 1, 0);
          const monthKey = getMonthKey(monthStart);
          
          // Check if retainer is active during any part of this month AND no invoice exists
          // Month is active if: monthStart <= endDate (or no endDate) AND monthEnd >= startDate
          if (monthStart <= (endDate || monthEnd) && monthEnd >= startDate && !invoicedMonths.has(`${agencyId}-${monthKey}`)) {
            revenue += monthlyAmount;
          }
        }
        
        retainerByAgency[agencyId] = (retainerByAgency[agencyId] || 0) + revenue;
      });
      
      res.json(retainerByAgency);
    } catch (error) {
      console.error("Error calculating retainer breakdown:", error);
      res.status(500).json({ error: "Failed to calculate retainer breakdown" });
    }
  });

  app.get("/api/forecast/project-breakdown", async (req, res) => {
    try {
      const forecastMonths = parseInt(req.query.months as string) || 1;
      const today = new Date();
      
      // Start from the beginning of the current month
      const forecastStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      forecastStartDate.setHours(0, 0, 0, 0);
      
      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      };
      
      // Helper function to parse date string as local date (not UTC)
      const parseAsLocalDate = (dateString: string): Date => {
        const date = new Date(dateString);
        // If the string is in YYYY-MM-DD format, new Date() treats it as UTC
        // We need to adjust it to be interpreted as local
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
        return date;
      };
      
      // Get all invoices - use ALL invoices (pending and received) for blocking project revenue
      const invoices = await storage.getForecastInvoices();
      
      // Build a set of months with ANY invoices (pending or received) for blocking project revenue
      const invoicedMonths = new Set<string>();
      invoices.forEach((invoice: any) => {
        // Use forecastMonth if available, otherwise fall back to realizationDate, dueDate, or date
        const relevantDate = invoice.forecastMonth
          ? parseAsLocalDate(invoice.forecastMonth)
          : invoice.realizationDate 
            ? parseAsLocalDate(invoice.realizationDate)
            : invoice.dueDate 
              ? parseAsLocalDate(invoice.dueDate) 
              : parseAsLocalDate(invoice.date);
        const agencyId = invoice.agencyId || "unassigned";
        const monthKey = getMonthKey(relevantDate);
        invoicedMonths.add(`${agencyId}-${monthKey}`);
      });
      
      const accountRevenue = await storage.getForecastAccountRevenue();
      const projectByAgency: { [agencyId: string]: number } = {};
      const prospectRevenue: { [prospectName: string]: number } = {};
      
      accountRevenue.forEach((forecast: any) => {
        // Only consider active forecasts
        if (!forecast.isActive) return;
        
        const monthlyAmount = parseFloat(forecast.monthlyAmount);
        if (monthlyAmount <= 0) return;
        
        const startDate = new Date(forecast.startDate);
        const endDate = forecast.endDate ? new Date(forecast.endDate) : null;
        
        // Count full months where forecast is active, then subtract invoices from project revenue
        let totalRevenue = 0;
        for (let i = 0; i < forecastMonths; i++) {
          const monthStart = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
          const monthEnd = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i + 1, 0);
          
          // Check if forecast is active during any part of this month
          // Month is active if: monthStart <= endDate (or no endDate) AND monthEnd >= startDate
          if (monthStart <= (endDate || monthEnd) && monthEnd >= startDate) {
            const monthKey = getMonthKey(monthStart);
            
            // For agencies (not prospects), only add project revenue if no invoice exists for this month
            if (!forecast.prospectName) {
              const agencyId = forecast.agencyId || "unassigned";
              // Only add project revenue if this agency-month doesn't have an invoice
              if (!invoicedMonths.has(`${agencyId}-${monthKey}`)) {
                totalRevenue += monthlyAmount;
              }
            } else {
              // For prospects, always add the full project revenue amount (no invoices to block)
              totalRevenue += monthlyAmount;
            }
          }
        }
        
        // Categorize by agency or prospect
        if (forecast.prospectName) {
          prospectRevenue[forecast.prospectName] = (prospectRevenue[forecast.prospectName] || 0) + totalRevenue;
        } else {
          const agencyId = forecast.agencyId || "unassigned";
          projectByAgency[agencyId] = (projectByAgency[agencyId] || 0) + totalRevenue;
        }
      });
      
      res.json({ agencies: projectByAgency, prospects: prospectRevenue });
    } catch (error) {
      console.error("Error calculating project breakdown:", error);
      res.status(500).json({ error: "Failed to calculate project breakdown" });
    }
  });

  app.get("/api/forecast/monthly-breakdown", async (req, res) => {
    try {
      // Get blended rate from settings
      let settings = await storage.getForecastSettings();
      if (!settings) {
        settings = await storage.upsertForecastSettings({ blendedRate: "90" });
      }
      const BLENDED_RATE = parseFloat(settings.blendedRate);
      
      const forecastMonths = parseInt(req.query.months as string) || 1;
      const today = new Date();
      
      // Start from the beginning of the current month
      const forecastStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      forecastStartDate.setHours(0, 0, 0, 0);
      
      // Calculate end date based on number of months
      const forecastEndDate = new Date(today.getFullYear(), today.getMonth() + forecastMonths, 0);
      forecastEndDate.setHours(23, 59, 59, 999);
      
      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      };
      
      // Helper function to parse date string as local date (not UTC)
      const parseAsLocalDate = (dateString: string): Date => {
        const date = new Date(dateString);
        // If the string is in YYYY-MM-DD format, new Date() treats it as UTC
        // We need to adjust it to be interpreted as local
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
        return date;
      };
      
      // Structure: { agencyId: { monthKey: { quota, invoices, retainers, projects } } }
      const monthlyByAgency: { [agencyId: string]: { [monthKey: string]: { quota: number; invoices: number; retainers: number; projects: number } } } = {};
      
      // First, get invoices and track which agency-month pairs have invoices
      const invoices = await storage.getForecastInvoices();
      const invoicedMonths = new Set<string>();
      
      // Current month key - quotas shouldn't show for current or past months
      const currentMonthKey = getMonthKey(today);
      
      invoices.forEach((invoice: any) => {
        const agencyId = invoice.agencyId || "unassigned";
        
        // Track the BILLING PERIOD month (invoice date) as invoiced - this blocks quota for that month
        // This is the month the invoice covers, regardless of when it's counted in forecast
        const invoiceDate = parseAsLocalDate(invoice.date);
        const billingMonthKey = getMonthKey(invoiceDate);
        invoicedMonths.add(`${agencyId}-${billingMonthKey}`);
        
        // Use forecastMonth for revenue counting (when the money is expected)
        const relevantDate = invoice.forecastMonth
          ? parseAsLocalDate(invoice.forecastMonth)
          : invoice.realizationDate 
            ? parseAsLocalDate(invoice.realizationDate)
            : invoice.dueDate 
              ? parseAsLocalDate(invoice.dueDate) 
              : invoiceDate;
        
        const monthKey = getMonthKey(relevantDate);
        const amount = parseFloat(invoice.amount);
        
        // Only count PENDING invoices in forecast revenue AND within forecast period
        if (invoice.status === "pending" && relevantDate >= forecastStartDate && relevantDate <= forecastEndDate) {
          if (!monthlyByAgency[agencyId]) {
            monthlyByAgency[agencyId] = {};
          }
          if (!monthlyByAgency[agencyId][monthKey]) {
            monthlyByAgency[agencyId][monthKey] = { quota: 0, invoices: 0, retainers: 0, projects: 0 };
          }
          
          monthlyByAgency[agencyId][monthKey].invoices += amount;
        }
      });
      
      // Get quota configs and calculate quota revenue
      // Only count quota for FUTURE months without invoices (quota is for projecting, not for current/past months)
      const quotaConfigs = await storage.getAllQuotaConfigs();
      
      quotaConfigs.forEach((config: any) => {
        if (config.monthlyTarget && !config.noQuota && config.agencyId) {
          const monthlyRevenue = parseFloat(config.monthlyTarget) * BLENDED_RATE;
          const agencyId = config.agencyId;
          
          // For each month in the forecast period (full months only)
          for (let i = 0; i < forecastMonths; i++) {
            const forecastMonth = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
            const monthKey = getMonthKey(forecastMonth);
            
            // Skip current month - quota projections are only for future months
            // Current month should be invoiced, not projected
            if (monthKey === currentMonthKey) {
              continue;
            }
            
            // Only add quota if this agency-month doesn't have an invoice
            if (!invoicedMonths.has(`${agencyId}-${monthKey}`)) {
              if (!monthlyByAgency[agencyId]) {
                monthlyByAgency[agencyId] = {};
              }
              if (!monthlyByAgency[agencyId][monthKey]) {
                monthlyByAgency[agencyId][monthKey] = { quota: 0, invoices: 0, retainers: 0, projects: 0 };
              }
              
              monthlyByAgency[agencyId][monthKey].quota += monthlyRevenue;
            }
          }
        }
      });
      
      // Get retainers and distribute by month (full months only)
      const retainers = await storage.getForecastRetainers();
      retainers.forEach((retainer: any) => {
        const startDate = parseAsLocalDate(retainer.startDate);
        const endDate = retainer.endDate ? parseAsLocalDate(retainer.endDate) : null;
        
        const agencyId = retainer.agencyId || "unassigned";
        const monthlyAmount = parseFloat(retainer.monthlyAmount);
        
        // For each month in the forecast period
        for (let i = 0; i < forecastMonths; i++) {
          const monthStart = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
          const monthEnd = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i + 1, 0);
          
          // Check if retainer is active during any part of this month AND no invoice exists
          // Month is active if: monthStart <= endDate (or no endDate) AND monthEnd >= startDate
          if (monthStart <= (endDate || monthEnd) && monthEnd >= startDate) {
            const monthKey = getMonthKey(monthStart);
            
            // Only add retainer revenue if this agency-month doesn't have an invoice
            if (!invoicedMonths.has(`${agencyId}-${monthKey}`)) {
              if (!monthlyByAgency[agencyId]) {
                monthlyByAgency[agencyId] = {};
              }
              if (!monthlyByAgency[agencyId][monthKey]) {
                monthlyByAgency[agencyId][monthKey] = { quota: 0, invoices: 0, retainers: 0, projects: 0 };
              }
              
              monthlyByAgency[agencyId][monthKey].retainers += monthlyAmount;
            }
          }
        }
      });
      
      // Get project forecasts and distribute by month (full months only)
      const accountRevenue = await storage.getForecastAccountRevenue();
      accountRevenue.forEach((forecast: any) => {
        if (!forecast.isActive) return;
        
        const monthlyAmount = parseFloat(forecast.monthlyAmount);
        if (monthlyAmount <= 0) return;
        
        const startDate = parseAsLocalDate(forecast.startDate);
        const endDate = forecast.endDate ? parseAsLocalDate(forecast.endDate) : null;
        
        // Skip prospects for now (they don't have an agencyId)
        if (forecast.prospectName) {
          return;
        }
        
        const agencyId = forecast.agencyId || "unassigned";
        
        // For each month in the forecast period
        for (let i = 0; i < forecastMonths; i++) {
          const monthStart = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
          const monthEnd = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i + 1, 0);
          
          // Check if forecast is active during any part of this month
          // Month is active if: monthStart <= endDate (or no endDate) AND monthEnd >= startDate
          if (monthStart <= (endDate || monthEnd) && monthEnd >= startDate) {
            const monthKey = getMonthKey(monthStart);
            
            // Always initialize the month object structure
            if (!monthlyByAgency[agencyId]) {
              monthlyByAgency[agencyId] = {};
            }
            if (!monthlyByAgency[agencyId][monthKey]) {
              monthlyByAgency[agencyId][monthKey] = { quota: 0, invoices: 0, retainers: 0, projects: 0 };
            }
            
            // Only add project revenue if this agency-month doesn't have an invoice
            if (!invoicedMonths.has(`${agencyId}-${monthKey}`)) {
              monthlyByAgency[agencyId][monthKey].projects += monthlyAmount;
            }
          }
        }
      });
      
      res.json(monthlyByAgency);
    } catch (error) {
      console.error("Error calculating monthly breakdown:", error);
      res.status(500).json({ error: "Failed to calculate monthly breakdown" });
    }
  });

  app.get("/api/forecast/prospect-monthly-breakdown", async (req, res) => {
    try {
      const forecastMonths = parseInt(req.query.months as string) || 1;
      const today = new Date();
      
      // Start from the beginning of the current month
      const forecastStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      forecastStartDate.setHours(0, 0, 0, 0);
      
      // Helper function to get month key (YYYY-MM format)
      const getMonthKey = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      };
      
      // Helper function to parse date string as local date (not UTC)
      const parseAsLocalDate = (dateString: string): Date => {
        const date = new Date(dateString);
        // If the string is in YYYY-MM-DD format, new Date() treats it as UTC
        // We need to adjust it to be interpreted as local
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
        }
        return date;
      };
      
      const accountRevenue = await storage.getForecastAccountRevenue();
      const prospectMonthly: { [prospectName: string]: { [monthKey: string]: number } } = {};
      
      accountRevenue.forEach((forecast: any) => {
        // Only consider active prospect forecasts
        if (!forecast.isActive || !forecast.prospectName) return;
        
        const monthlyAmount = parseFloat(forecast.monthlyAmount);
        if (monthlyAmount <= 0) return;
        
        const startDate = parseAsLocalDate(forecast.startDate);
        const endDate = forecast.endDate ? parseAsLocalDate(forecast.endDate) : null;
        const prospectName = forecast.prospectName;
        
        // For each month in the forecast period
        for (let i = 0; i < forecastMonths; i++) {
          const monthStart = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i, 1);
          const monthEnd = new Date(forecastStartDate.getFullYear(), forecastStartDate.getMonth() + i + 1, 0);
          
          // Check if forecast is active during any part of this month
          // Month is active if: monthStart <= endDate (or no endDate) AND monthEnd >= startDate
          if (monthStart <= (endDate || monthEnd) && monthEnd >= startDate) {
            const monthKey = getMonthKey(monthStart);
            
            if (!prospectMonthly[prospectName]) {
              prospectMonthly[prospectName] = {};
            }
            if (!prospectMonthly[prospectName][monthKey]) {
              prospectMonthly[prospectName][monthKey] = 0;
            }
            
            prospectMonthly[prospectName][monthKey] += monthlyAmount;
          }
        }
      });
      
      res.json(prospectMonthly);
    } catch (error) {
      console.error("Error calculating prospect monthly breakdown:", error);
      res.status(500).json({ error: "Failed to calculate prospect monthly breakdown" });
    }
  });

  // Forecast Settings
  app.get("/api/forecast/settings", async (req, res) => {
    try {
      let settings = await storage.getForecastSettings();
      if (!settings) {
        // Create default settings if none exist
        settings = await storage.upsertForecastSettings({ blendedRate: "90" });
      }
      res.json(settings);
    } catch (error) {
      console.error("Error fetching forecast settings:", error);
      res.status(500).json({ error: "Failed to fetch forecast settings" });
    }
  });

  app.put("/api/forecast/settings", requireAuth, async (req, res) => {
    try {
      const validation = insertForecastSettingsSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid settings data", details: validation.error });
      }
      
      const settings = await storage.upsertForecastSettings(validation.data);
      res.json(settings);
    } catch (error) {
      console.error("Error updating forecast settings:", error);
      res.status(500).json({ error: "Failed to update forecast settings" });
    }
  });

  // Forecasting - Resources (capacity planning)
  app.get("/api/forecast/resources", async (_req, res) => {
    try {
      const resources = await storage.getForecastResources();
      res.json(resources);
    } catch (error) {
      console.error("Error fetching forecast resources:", error);
      res.status(500).json({ error: "Failed to fetch forecast resources" });
    }
  });

  app.post("/api/forecast/resources", async (req, res) => {
    try {
      const validation = insertForecastResourceSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid resource data", details: validation.error });
      }
      
      const resource = await storage.createForecastResource(validation.data);
      res.status(201).json(resource);
    } catch (error) {
      console.error("Error creating forecast resource:", error);
      res.status(500).json({ error: "Failed to create forecast resource" });
    }
  });

  app.patch("/api/forecast/resources/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertForecastResourceSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid resource data", details: validation.error });
      }
      
      const resource = await storage.updateForecastResource(id, validation.data);
      res.json(resource);
    } catch (error) {
      console.error("Error updating forecast resource:", error);
      res.status(500).json({ error: "Failed to update forecast resource" });
    }
  });

  app.delete("/api/forecast/resources/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteForecastResource(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting forecast resource:", error);
      res.status(500).json({ error: "Failed to delete forecast resource" });
    }
  });

  // Forecasting - Resource Monthly Capacity
  app.get("/api/forecast/resource-capacity", async (_req, res) => {
    try {
      const capacity = await storage.getAllResourceMonthlyCapacity();
      res.json(capacity);
    } catch (error) {
      console.error("Error fetching resource monthly capacity:", error);
      res.status(500).json({ error: "Failed to fetch resource monthly capacity" });
    }
  });

  app.get("/api/forecast/resource-capacity/month/:month", async (req, res) => {
    try {
      const { month } = req.params;
      const capacity = await storage.getResourceMonthlyCapacityByMonth(month);
      res.json(capacity);
    } catch (error) {
      console.error("Error fetching resource monthly capacity for month:", error);
      res.status(500).json({ error: "Failed to fetch resource monthly capacity for month" });
    }
  });

  app.put("/api/forecast/resource-capacity", async (req, res) => {
    try {
      const validation = insertResourceMonthlyCapacitySchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid capacity data", details: validation.error });
      }
      
      const capacity = await storage.upsertResourceMonthlyCapacity(validation.data);
      res.json(capacity);
    } catch (error) {
      console.error("Error upserting resource monthly capacity:", error);
      res.status(500).json({ error: "Failed to upsert resource monthly capacity" });
    }
  });

  app.delete("/api/forecast/resource-capacity/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteResourceMonthlyCapacity(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting resource monthly capacity:", error);
      res.status(500).json({ error: "Failed to delete resource monthly capacity" });
    }
  });

  // Forecasting - Account Allocations
  app.get("/api/forecast/account-allocations", async (_req, res) => {
    try {
      const allocations = await storage.getAccountForecastAllocations();
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching account forecast allocations:", error);
      res.status(500).json({ error: "Failed to fetch account forecast allocations" });
    }
  });

  app.get("/api/forecast/account-allocations/month/:month", async (req, res) => {
    try {
      const { month } = req.params;
      const allocations = await storage.getAccountForecastAllocationsByMonth(month);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching account forecast allocations for month:", error);
      res.status(500).json({ error: "Failed to fetch account forecast allocations for month" });
    }
  });

  app.get("/api/forecast/account-allocations/resource/:resourceId", async (req, res) => {
    try {
      const { resourceId } = req.params;
      const allocations = await storage.getAccountForecastAllocationsByResource(resourceId);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching account forecast allocations for resource:", error);
      res.status(500).json({ error: "Failed to fetch account forecast allocations for resource" });
    }
  });

  app.post("/api/forecast/account-allocations", async (req, res) => {
    try {
      const validation = insertAccountForecastAllocationSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid allocation data", details: validation.error });
      }
      
      const allocation = await storage.createAccountForecastAllocation(validation.data);
      res.status(201).json(allocation);
    } catch (error) {
      console.error("Error creating account forecast allocation:", error);
      res.status(500).json({ error: "Failed to create account forecast allocation" });
    }
  });

  app.patch("/api/forecast/account-allocations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertAccountForecastAllocationSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid allocation data", details: validation.error });
      }
      
      const allocation = await storage.updateAccountForecastAllocation(id, validation.data);
      res.json(allocation);
    } catch (error) {
      console.error("Error updating account forecast allocation:", error);
      res.status(500).json({ error: "Failed to update account forecast allocation" });
    }
  });

  app.delete("/api/forecast/account-allocations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAccountForecastAllocation(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account forecast allocation:", error);
      res.status(500).json({ error: "Failed to delete account forecast allocation" });
    }
  });

  // Project Team Members
  app.post("/api/project-team-members", async (req, res) => {
    try {
      const validation = insertProjectTeamMemberSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid team member data", details: validation.error });
      }
      
      const member = await storage.createProjectTeamMember(validation.data);
      res.status(201).json(member);
    } catch (error) {
      console.error("Error creating project team member:", error);
      res.status(500).json({ error: "Failed to create project team member" });
    }
  });

  app.get("/api/project-team-members/project/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const members = await storage.getProjectTeamMembers(projectId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching project team members:", error);
      res.status(500).json({ error: "Failed to fetch project team members" });
    }
  });

  app.get("/api/project-team-members/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const members = await storage.getProjectTeamMembersByUser(userId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching user team memberships:", error);
      res.status(500).json({ error: "Failed to fetch user team memberships" });
    }
  });

  app.get("/api/projects/with-team", async (_req, res) => {
    try {
      const projects = await storage.getProjectsWithTeam();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects with team:", error);
      res.status(500).json({ error: "Failed to fetch projects with team" });
    }
  });

  app.patch("/api/project-team-members/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertProjectTeamMemberSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid team member data", details: validation.error });
      }
      
      const member = await storage.updateProjectTeamMember(id, validation.data);
      res.json(member);
    } catch (error) {
      console.error("Error updating project team member:", error);
      res.status(500).json({ error: "Failed to update project team member" });
    }
  });

  app.delete("/api/project-team-members/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProjectTeamMember(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project team member:", error);
      res.status(500).json({ error: "Failed to delete project team member" });
    }
  });

  // User Availability
  app.post("/api/user-availability", async (req, res) => {
    try {
      const validation = insertUserAvailabilitySchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid availability data", details: validation.error });
      }
      
      const availability = await storage.createUserAvailability(validation.data);
      res.status(201).json(availability);
    } catch (error) {
      console.error("Error creating user availability:", error);
      res.status(500).json({ error: "Failed to create user availability" });
    }
  });

  app.get("/api/user-availability", async (_req, res) => {
    try {
      const availability = await storage.getAllUserAvailability();
      res.json(availability);
    } catch (error) {
      console.error("Error fetching all user availability:", error);
      res.status(500).json({ error: "Failed to fetch all user availability" });
    }
  });

  app.get("/api/user-availability/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const availability = await storage.getUserAvailability(userId);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching user availability:", error);
      res.status(500).json({ error: "Failed to fetch user availability" });
    }
  });

  app.get("/api/user-availability/range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }
      
      const availability = await storage.getUserAvailabilityByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json(availability);
    } catch (error) {
      console.error("Error fetching user availability by range:", error);
      res.status(500).json({ error: "Failed to fetch user availability by range" });
    }
  });

  app.patch("/api/user-availability/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertUserAvailabilitySchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid availability data", details: validation.error });
      }
      
      const availability = await storage.updateUserAvailability(id, validation.data);
      res.json(availability);
    } catch (error) {
      console.error("Error updating user availability:", error);
      res.status(500).json({ error: "Failed to update user availability" });
    }
  });

  app.delete("/api/user-availability/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUserAvailability(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user availability:", error);
      res.status(500).json({ error: "Failed to delete user availability" });
    }
  });

  // Company Holidays
  app.post("/api/holidays", async (req, res) => {
    try {
      const validation = insertHolidaySchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid holiday data", details: validation.error });
      }
      
      const holiday = await storage.createHoliday(validation.data);
      res.status(201).json(holiday);
    } catch (error) {
      console.error("Error creating holiday:", error);
      res.status(500).json({ error: "Failed to create holiday" });
    }
  });

  app.get("/api/holidays", async (_req, res) => {
    try {
      const holidays = await storage.getHolidays();
      res.json(holidays);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      res.status(500).json({ error: "Failed to fetch holidays" });
    }
  });

  app.get("/api/holidays/range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }
      
      const holidays = await storage.getHolidaysByDateRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
      res.json(holidays);
    } catch (error) {
      console.error("Error fetching holidays by range:", error);
      res.status(500).json({ error: "Failed to fetch holidays by range" });
    }
  });

  app.patch("/api/holidays/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertHolidaySchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid holiday data", details: validation.error });
      }
      
      const holiday = await storage.updateHoliday(id, validation.data);
      res.json(holiday);
    } catch (error) {
      console.error("Error updating holiday:", error);
      res.status(500).json({ error: "Failed to update holiday" });
    }
  });

  app.delete("/api/holidays/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHoliday(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      res.status(500).json({ error: "Failed to delete holiday" });
    }
  });

  // Proposals routes
  app.get("/api/proposals", async (req, res) => {
    try {
      const proposals = await storage.getProposals();
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  app.get("/api/proposals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const proposal = await storage.getProposal(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  app.get("/api/proposals/view/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const proposal = await storage.getProposalBySlug(slug);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      if (proposal.status !== "published") {
        return res.status(404).json({ error: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal by slug:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  app.post("/api/proposals", async (req, res) => {
    try {
      const { scopeItems, chatTranscript, ...proposalData } = req.body;
      
      // Use appropriate schema based on status (default is "draft")
      const status = proposalData.status || "draft";
      const schema = status === "published" ? insertProposalPublishSchema : insertProposalDraftSchema;
      
      const validation = schema.safeParse(proposalData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid proposal data", details: validation.error });
      }
      const proposal = await storage.createProposal(validation.data);
      
      if (scopeItems && Array.isArray(scopeItems) && scopeItems.length > 0) {
        for (const item of scopeItems) {
          await storage.createProposalScopeItem({
            proposalId: proposal.id,
            storyId: item.order + 1, // Use order as sequential ID (1-based)
            hours: item.hours,
            workstreamName: item.workstream,
            customerStory: item.customerStory,
            recommendedApproach: item.recommendedApproach,
            assumptions: item.assumptions,
            order: item.order,
          });
        }
      }
      
      if (chatTranscript && typeof chatTranscript === 'string' && chatTranscript.trim().length > 0) {
        await storage.createChatTranscript({
          proposalId: proposal.id,
          title: validation.data.title,
          content: chatTranscript,
          companyName: validation.data.companyName,
        });
      }
      
      res.status(201).json(proposal);
    } catch (error) {
      console.error("Error creating proposal:", error);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  app.patch("/api/proposals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { scopeItems, chatTranscript, ...proposalData } = req.body;
      
      // Fetch existing proposal to merge data for validation
      const existingProposal = await storage.getProposal(id);
      if (!existingProposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      
      // Merge existing data with incoming updates for complete validation
      const mergedData = { ...existingProposal, ...proposalData };
      
      // Use effective status (from update or existing) for validation schema selection
      const effectiveStatus = proposalData.status ?? existingProposal.status;
      const schema = effectiveStatus === "published" 
        ? insertProposalPublishSchema
        : insertProposalDraftSchema;
      
      const validation = schema.safeParse(mergedData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid proposal data", details: validation.error });
      }
      
      // Only update with the fields that were actually sent
      const proposal = await storage.updateProposal(id, proposalData);
      
      if (scopeItems && Array.isArray(scopeItems)) {
        const existingItems = await storage.getProposalScopeItemsByProposal(id);
        for (const existingItem of existingItems) {
          await storage.deleteProposalScopeItem(existingItem.id);
        }
        
        for (const item of scopeItems) {
          await storage.createProposalScopeItem({
            proposalId: id,
            storyId: item.order + 1, // Use order as sequential ID (1-based)
            hours: item.hours,
            workstreamName: item.workstream,
            customerStory: item.customerStory,
            recommendedApproach: item.recommendedApproach,
            assumptions: item.assumptions,
            order: item.order,
          });
        }
      }
      
      if (chatTranscript && typeof chatTranscript === 'string') {
        const transcripts = await storage.getChatTranscripts();
        const existingTranscript = transcripts.find(t => t.proposalId === id);
        
        if (existingTranscript) {
          await storage.updateChatTranscript(existingTranscript.id, { content: chatTranscript });
        } else if (chatTranscript.trim().length > 0) {
          await storage.createChatTranscript({
            proposalId: id,
            title: proposal.title,
            content: chatTranscript,
            companyName: proposal.companyName,
          });
        }
      }
      
      res.json(proposal);
    } catch (error) {
      console.error("Error updating proposal:", error);
      res.status(500).json({ error: "Failed to update proposal" });
    }
  });

  app.delete("/api/proposals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProposal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting proposal:", error);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  });

  app.post("/api/proposals/:id/accept", async (req, res) => {
    try {
      const { id } = req.params;
      const { contactEmail, contactName, companyName, title } = req.body;

      // Send email notification to zach@patchops.io with CC to contact
      await sendProposalAcceptanceEmail(
        title,
        companyName,
        contactName || null,
        contactEmail || null
      );

      // Send Slack notification to #accepted-proposals
      await sendProposalAcceptedSlack(
        title,
        companyName,
        contactName || null,
        contactEmail || null
      );

      res.json({ 
        success: true, 
        message: 'Proposal acceptance notification sent' 
      });
    } catch (error) {
      console.error("Error accepting proposal:", error);
      res.status(500).json({ error: "Failed to accept proposal" });
    }
  });

  app.get("/api/proposals/:id/with-scope", async (req, res) => {
    try {
      const { id } = req.params;
      const proposal = await storage.getProposalWithScopeItems(id);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal with scope items:", error);
      res.status(500).json({ error: "Failed to fetch proposal with scope items" });
    }
  });

  // AI Generation routes
  app.post("/api/ai/generate-scope", async (req, res) => {
    try {
      const { chatTranscript, projectContext, generalInstructions, previousProposalIds, companyName } = req.body;
      
      if (!chatTranscript || typeof chatTranscript !== "string") {
        return res.status(400).json({ error: "Chat transcript is required" });
      }

      if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
        return res.status(400).json({ error: "Company name is required for generation" });
      }

      const [knowledgeBase, guidanceSettings] = await Promise.all([
        storage.getKnowledgeBaseDocuments(),
        storage.getGuidanceSettings()
      ]);

      let previousProposals;
      if (previousProposalIds && Array.isArray(previousProposalIds) && previousProposalIds.length > 0) {
        const proposals = await Promise.all(
          previousProposalIds.map(id => storage.getProposal(id))
        );
        previousProposals = proposals
          .filter(p => p !== null && p.htmlContent !== null)
          .map(p => ({
            title: p!.title,
            companyName: p!.companyName,
            htmlContent: p!.htmlContent as string
          }));
      }

      const scopeItems = await aiService.generateScope({
        chatTranscript,
        knowledgeBase,
        guidanceSettings,
        generalInstructions,
        companyName,
        previousProposals,
        projectContext
      });

      res.json({ scopeItems });
    } catch (error) {
      console.error("Error generating scope:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate scope" 
      });
    }
  });

  app.post("/api/ai/refine-scope", async (req, res) => {
    try {
      const { scopeItems, refinementInstructions, companyName } = req.body;
      
      if (!Array.isArray(scopeItems)) {
        return res.status(400).json({ error: "Scope items array is required" });
      }
      
      if (!refinementInstructions || typeof refinementInstructions !== "string") {
        return res.status(400).json({ error: "Refinement instructions are required" });
      }

      if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
        return res.status(400).json({ error: "Company name is required for refinement" });
      }

      const guidanceSettings = await storage.getGuidanceSettings();

      const refinedItems = await aiService.refineScope(
        scopeItems,
        refinementInstructions,
        guidanceSettings,
        companyName
      );

      res.json({ scopeItems: refinedItems });
    } catch (error) {
      console.error("Error refining scope:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to refine scope" 
      });
    }
  });

  app.post("/api/ai/extract-metadata", async (req, res) => {
    try {
      const { chatTranscript } = req.body;
      
      if (!chatTranscript || typeof chatTranscript !== "string") {
        return res.status(400).json({ error: "Chat transcript is required" });
      }

      const metadata = await aiService.extractProposalMetadata(chatTranscript);
      res.json(metadata);
    } catch (error) {
      console.error("Error extracting metadata:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to extract metadata" 
      });
    }
  });

  app.post("/api/ai/copilot", async (req, res) => {
    try {
      const { prompt, currentContent, context } = req.body;
      
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const content = await aiService.generateCopilotResponse(
        prompt,
        currentContent || "",
        context || {}
      );
      
      res.json({ content });
    } catch (error) {
      console.error("Error generating copilot response:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to generate AI response" 
      });
    }
  });

  app.post("/api/ai/document-to-proposal", upload.single("file"), async (req, res) => {
    try {
      let content: string;
      let isHtml = false;
      
      console.log("[document-to-proposal] Request received:", {
        hasFile: !!req.file,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
        hasTextContent: !!req.body.textContent,
        textContentLength: req.body.textContent?.length
      });
      
      if (req.file) {
        const parsed = await aiService.parseDocumentContent(
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname
        );
        
        console.log("[document-to-proposal] Parsed content:", {
          hasHtml: !!parsed.html,
          htmlLength: parsed.html?.length,
          textLength: parsed.text?.length
        });
        
        if (parsed.html) {
          content = parsed.html;
          isHtml = true;
        } else {
          content = parsed.text;
        }
      } else if (req.body.textContent) {
        content = req.body.textContent;
      } else {
        return res.status(400).json({ error: "Either a file or textContent is required" });
      }
      
      console.log("[document-to-proposal] Content to convert:", {
        contentLength: content?.length,
        isHtml,
        preview: content?.substring(0, 200)
      });
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "No content could be extracted from the document" });
      }
      
      const branding = {
        font: req.body.brandFont,
        primaryColor: req.body.brandPrimaryColor,
        secondaryColor: req.body.brandSecondaryColor,
        accentColor: req.body.brandAccentColor,
      };
      
      const result = await aiService.convertDocumentToProposal(content, isHtml, branding);
      
      res.json({
        htmlContent: result.htmlContent,
        metadata: result.metadata,
      });
    } catch (error) {
      console.error("Error converting document to proposal:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to convert document" 
      });
    }
  });

  // Proposal Scope Items routes
  app.get("/api/proposals/:proposalId/scope-items", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const items = await storage.getProposalScopeItemsByProposal(proposalId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching scope items:", error);
      res.status(500).json({ error: "Failed to fetch scope items" });
    }
  });

  app.post("/api/proposals/:proposalId/scope-items", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const validation = insertProposalScopeItemSchema.safeParse({ ...req.body, proposalId });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid scope item data", details: validation.error });
      }
      
      const item = await storage.createProposalScopeItem(validation.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating scope item:", error);
      res.status(500).json({ error: "Failed to create scope item" });
    }
  });

  app.post("/api/proposals/:proposalId/scope-items/bulk", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const { items } = req.body;
      
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items array is required" });
      }

      const validatedItems = items.map(item => {
        const validation = insertProposalScopeItemSchema.safeParse({ ...item, proposalId });
        if (!validation.success) {
          throw new Error("Invalid scope item data");
        }
        return validation.data;
      });

      const created = await storage.bulkCreateProposalScopeItems(validatedItems);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error bulk creating scope items:", error);
      res.status(500).json({ error: "Failed to bulk create scope items" });
    }
  });

  app.patch("/api/scope-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertProposalScopeItemSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid scope item data", details: validation.error });
      }
      
      const item = await storage.updateProposalScopeItem(id, validation.data);
      res.json(item);
    } catch (error) {
      console.error("Error updating scope item:", error);
      res.status(500).json({ error: "Failed to update scope item" });
    }
  });

  app.delete("/api/scope-items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProposalScopeItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scope item:", error);
      res.status(500).json({ error: "Failed to delete scope item" });
    }
  });

  app.delete("/api/proposals/:proposalId/scope-items", async (req, res) => {
    try {
      const { proposalId } = req.params;
      await storage.deleteProposalScopeItemsByProposal(proposalId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scope items:", error);
      res.status(500).json({ error: "Failed to delete scope items" });
    }
  });

  // Knowledge Base Documents routes
  app.get("/api/knowledge-base", async (req, res) => {
    try {
      const documents = await storage.getKnowledgeBaseDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching knowledge base documents:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base documents" });
    }
  });

  app.get("/api/knowledge-base/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getKnowledgeBaseDocument(id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching knowledge base document:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base document" });
    }
  });

  app.post("/api/knowledge-base", async (req, res) => {
    try {
      const validation = insertKnowledgeBaseDocumentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid document data", details: validation.error });
      }
      
      const document = await storage.createKnowledgeBaseDocument(validation.data);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating knowledge base document:", error);
      res.status(500).json({ error: "Failed to create knowledge base document" });
    }
  });

  app.patch("/api/knowledge-base/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertKnowledgeBaseDocumentSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid document data", details: validation.error });
      }
      
      const document = await storage.updateKnowledgeBaseDocument(id, validation.data);
      res.json(document);
    } catch (error) {
      console.error("Error updating knowledge base document:", error);
      res.status(500).json({ error: "Failed to update knowledge base document" });
    }
  });

  app.delete("/api/knowledge-base/:id", async (req, res) => {
    try {
      const { id} = req.params;
      await storage.deleteKnowledgeBaseDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting knowledge base document:", error);
      res.status(500).json({ error: "Failed to delete knowledge base document" });
    }
  });

  // Guidance Settings routes
  app.get("/api/guidance-settings", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const settings = category
        ? await storage.getGuidanceSettingsByCategory(category)
        : await storage.getGuidanceSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching guidance settings:", error);
      res.status(500).json({ error: "Failed to fetch guidance settings" });
    }
  });

  app.get("/api/guidance-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const setting = await storage.getGuidanceSetting(id);
      if (!setting) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching guidance setting:", error);
      res.status(500).json({ error: "Failed to fetch guidance setting" });
    }
  });

  app.post("/api/guidance-settings", async (req, res) => {
    try {
      const validation = insertGuidanceSettingSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid setting data", details: validation.error });
      }
      
      const setting = await storage.createGuidanceSetting(validation.data);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating guidance setting:", error);
      res.status(500).json({ error: "Failed to create guidance setting" });
    }
  });

  app.patch("/api/guidance-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertGuidanceSettingSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid setting data", details: validation.error });
      }
      
      const setting = await storage.updateGuidanceSetting(id, validation.data);
      res.json(setting);
    } catch (error) {
      console.error("Error updating guidance setting:", error);
      res.status(500).json({ error: "Failed to update guidance setting" });
    }
  });

  app.delete("/api/guidance-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteGuidanceSetting(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting guidance setting:", error);
      res.status(500).json({ error: "Failed to delete guidance setting" });
    }
  });

  // Chat Transcripts routes
  app.get("/api/chat-transcripts", async (req, res) => {
    try {
      const transcripts = await storage.getChatTranscripts();
      res.json(transcripts);
    } catch (error) {
      console.error("Error fetching chat transcripts:", error);
      res.status(500).json({ error: "Failed to fetch chat transcripts" });
    }
  });

  app.get("/api/chat-transcripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const transcript = await storage.getChatTranscript(id);
      if (!transcript) {
        return res.status(404).json({ error: "Transcript not found" });
      }
      res.json(transcript);
    } catch (error) {
      console.error("Error fetching chat transcript:", error);
      res.status(500).json({ error: "Failed to fetch chat transcript" });
    }
  });

  app.get("/api/proposals/:proposalId/chat-transcript", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const transcripts = await storage.getChatTranscripts();
      const proposalTranscript = transcripts.find(t => t.proposalId === proposalId);
      if (!proposalTranscript) {
        return res.status(404).json({ error: "Transcript not found for this proposal" });
      }
      res.json(proposalTranscript);
    } catch (error) {
      console.error("Error fetching proposal chat transcript:", error);
      res.status(500).json({ error: "Failed to fetch chat transcript" });
    }
  });

  app.post("/api/chat-transcripts", async (req, res) => {
    try {
      const validation = insertChatTranscriptSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid transcript data", details: validation.error });
      }
      
      const transcript = await storage.createChatTranscript(validation.data);
      res.status(201).json(transcript);
    } catch (error) {
      console.error("Error creating chat transcript:", error);
      res.status(500).json({ error: "Failed to create chat transcript" });
    }
  });

  app.patch("/api/chat-transcripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertChatTranscriptSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid transcript data", details: validation.error });
      }
      
      const transcript = await storage.updateChatTranscript(id, validation.data);
      res.json(transcript);
    } catch (error) {
      console.error("Error updating chat transcript:", error);
      res.status(500).json({ error: "Failed to update chat transcript" });
    }
  });

  app.delete("/api/chat-transcripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteChatTranscript(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting chat transcript:", error);
      res.status(500).json({ error: "Failed to delete chat transcript" });
    }
  });

  // Pipeline Stages routes (GET supports API key auth for external integrations)
  app.get("/api/pipeline-stages", requireApiKeyOrAuth, async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const stages = type 
        ? await storage.getPipelineStagesByType(type)
        : await storage.getPipelineStages();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching pipeline stages:", error);
      res.status(500).json({ error: "Failed to fetch pipeline stages" });
    }
  });

  app.post("/api/pipeline-stages", async (req, res) => {
    try {
      const stage = await storage.createPipelineStage(req.body);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating pipeline stage:", error);
      res.status(500).json({ error: "Failed to create pipeline stage" });
    }
  });

  app.patch("/api/pipeline-stages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, type, order, color, isActive } = req.body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (order !== undefined) updates.order = typeof order === 'string' ? parseInt(order, 10) : order;
      if (color !== undefined) updates.color = color;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const stage = await storage.updatePipelineStage(id, updates);
      if (!stage) {
        return res.status(404).json({ error: "Pipeline stage not found" });
      }
      res.json(stage);
    } catch (error) {
      console.error("Error updating pipeline stage:", error);
      res.status(500).json({ error: "Failed to update pipeline stage" });
    }
  });

  app.delete("/api/pipeline-stages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePipelineStage(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting pipeline stage:", error);
      res.status(500).json({ error: "Failed to delete pipeline stage" });
    }
  });

  // Leads routes (support both session auth and API key auth)
  app.get("/api/leads", requireApiKeyOrAuth, async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", requireApiKeyOrAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const lead = await storage.getLead(id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", requireApiKeyOrAuth, async (req, res) => {
    try {
      const lead = await storage.createLead(req.body);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  // Lead enrichment using AI and LinkedIn URL
  app.post("/api/leads/enrich", requireApiKeyOrAuth, async (req, res) => {
    try {
      const { linkedInUrl } = req.body;
      if (!linkedInUrl || typeof linkedInUrl !== 'string') {
        return res.status(400).json({ error: "LinkedIn URL is required" });
      }
      // Basic URL validation - must contain linkedin.com
      const trimmedUrl = linkedInUrl.trim().slice(0, 500); // Limit length
      if (!trimmedUrl.includes('linkedin.com')) {
        return res.status(400).json({ error: "Please provide a valid LinkedIn URL" });
      }
      const enrichedData = await aiService.enrichLeadFromLinkedIn(trimmedUrl);
      res.json(enrichedData);
    } catch (error) {
      console.error("Error enriching lead:", error);
      res.status(500).json({ error: "Failed to enrich lead" });
    }
  });

  app.patch("/api/leads/:id", requireApiKeyOrAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const lead = await storage.updateLead(id, req.body);
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", requireApiKeyOrAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLead(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // CRM routes - Leads with stage info
  app.get("/api/crm/leads", requireAuth, async (req, res) => {
    try {
      const leads = await storage.getLeadsWithStage();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching CRM leads:", error);
      res.status(500).json({ error: "Failed to fetch CRM leads" });
    }
  });

  app.get("/api/crm/leads/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const lead = await storage.getLeadWithStage(id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching CRM lead:", error);
      res.status(500).json({ error: "Failed to fetch CRM lead" });
    }
  });

  // Lead Activities
  app.get("/api/crm/leads/:leadId/activities", requireAuth, async (req, res) => {
    try {
      const { leadId } = req.params;
      const activities = await storage.getLeadActivities(leadId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching lead activities:", error);
      res.status(500).json({ error: "Failed to fetch lead activities" });
    }
  });

  app.post("/api/crm/leads/:leadId/activities", requireAuth, async (req, res) => {
    try {
      const { leadId } = req.params;
      const { type, description, occurredAt } = req.body;
      
      // Validate type is one of allowed values
      const validTypes = ['call', 'email', 'meeting', 'note', 'task'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: `Type must be one of: ${validTypes.join(', ')}` });
      }
      
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ error: "Description is required" });
      }
      
      // Parse and validate occurredAt date
      let parsedDate = new Date();
      if (occurredAt) {
        parsedDate = new Date(occurredAt);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid date format for occurredAt" });
        }
      }
      
      const activityData = {
        leadId,
        type,
        description: description.trim(),
        occurredAt: parsedDate,
        createdByUserId: (req.user as any)?.id || null,
      };
      
      const activity = await storage.createLeadActivity(activityData);
      
      // Update lead's lastContactedAt when logging certain activity types
      const contactTypes = ['call', 'email', 'meeting'];
      if (contactTypes.includes(type)) {
        await storage.updateLead(leadId, { lastContactedAt: new Date() });
      }
      
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating lead activity:", error);
      res.status(500).json({ error: "Failed to create lead activity" });
    }
  });

  app.delete("/api/crm/activities/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLeadActivity(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting lead activity:", error);
      res.status(500).json({ error: "Failed to delete lead activity" });
    }
  });

  // Deals routes
  app.get("/api/deals", async (req, res) => {
    try {
      const deals = await storage.getDeals();
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/deals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deal = await storage.getDeal(id);
      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  app.post("/api/deals", async (req, res) => {
    try {
      const deal = await storage.createDeal(req.body);
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  app.patch("/api/deals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deal = await storage.updateDeal(id, req.body);
      res.json(deal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/deals/:id", async (req, res) => {
    try {
      const { id} = req.params;
      await storage.deleteDeal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // API Key Management routes
  app.get("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const keys = await storage.getApiKeysByUser(userId);
      // Don't expose hashed keys
      const safeKeys = keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      }));
      res.json(safeKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  app.post("/api/api-keys", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const { name, expiresAt } = req.body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name is required" });
      }
      
      // Generate the API key
      const { plainKey, hashedKey, keyPrefix } = await generateApiKey();
      
      // Parse expiration if provided
      let expiration: Date | undefined;
      if (expiresAt) {
        expiration = new Date(expiresAt);
        if (isNaN(expiration.getTime())) {
          return res.status(400).json({ error: "Invalid expiration date" });
        }
      }
      
      // Store the key
      const apiKey = await storage.createApiKey({
        name: name.trim(),
        hashedKey,
        keyPrefix,
        userId,
        expiresAt: expiration,
      });
      
      // Return the plain key ONLY on creation (will never be shown again)
      res.status(201).json({
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey, // Only returned once!
        keyPrefix: apiKey.keyPrefix,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        message: "Save this key securely - it will not be shown again!",
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  app.delete("/api/api-keys/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const { id } = req.params;
      
      // Verify ownership
      const apiKey = await storage.getApiKeyById(id);
      if (!apiKey || apiKey.userId !== userId) {
        return res.status(404).json({ error: "API key not found" });
      }
      
      await storage.revokeApiKey(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error revoking API key:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  // UAT Sessions routes (internal user management)
  app.get("/api/uat-sessions", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getUatSessions();
      
      // Enrich sessions with response data for PM view
      const enrichedSessions = await Promise.all(
        sessions.map(async (session) => {
          const fullSession = await storage.getUatSessionWithRelations(session.id);
          if (!fullSession) return session;
          
          const responses = await storage.getUatResponsesBySession(session.id);
          return {
            ...fullSession,
            responses,
          };
        })
      );
      
      res.json(enrichedSessions);
    } catch (error) {
      console.error("Error fetching UAT sessions:", error);
      res.status(500).json({ error: "Failed to fetch UAT sessions" });
    }
  });

  app.get("/api/uat-sessions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getUatSessionWithRelations(id);
      if (!session) {
        return res.status(404).json({ error: "UAT session not found" });
      }
      res.json(session);
    } catch (error) {
      console.error("Error fetching UAT session:", error);
      res.status(500).json({ error: "Failed to fetch UAT session" });
    }
  });

  app.get("/api/uat-sessions/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.getUatSessionWithRelations(id);
      if (!session) {
        return res.status(404).json({ error: "UAT session not found" });
      }
      
      const items = await storage.getUatChecklistItems(id);
      const testRuns = await storage.getUatTestRuns(id);
      const activeRun = testRuns.find(r => r.status === 'active');
      const latestRun = activeRun || testRuns[0];
      
      const allSteps: any[] = [];
      for (const item of items) {
        const steps = await storage.getUatChecklistItemSteps(item.id);
        allSteps.push(...steps.map(s => ({ ...s, itemId: item.id })));
      }
      
      let stepResults: any[] = [];
      if (latestRun) {
        stepResults = await storage.getUatTestStepResults(latestRun.id);
      }
      
      const itemsWithStatus = await Promise.all(items.map(async (item) => {
        const itemSteps = allSteps.filter(s => s.itemId === item.id);
        const itemResults = stepResults.filter(r => itemSteps.some(s => s.id === r.stepId));
        
        const totalSteps = itemSteps.length;
        const passedSteps = itemResults.filter(r => r.status === 'passed' || r.status === 'acknowledged').length;
        const failedSteps = itemResults.filter(r => r.status === 'failed').length;
        
        let itemStatus: 'pending' | 'passed' | 'failed' | 'partial' = 'pending';
        if (totalSteps > 0) {
          if (failedSteps > 0) {
            itemStatus = 'failed';
          } else if (passedSteps === totalSteps) {
            itemStatus = 'passed';
          } else if (passedSteps > 0) {
            itemStatus = 'partial';
          }
        }
        
        let lastReviewedByName: string | undefined;
        let lastResolvedByName: string | undefined;
        
        if (item.lastReviewedById) {
          const reviewer = await storage.getUserById(item.lastReviewedById);
          lastReviewedByName = reviewer?.displayName || reviewer?.username;
        }
        if (item.lastResolvedById) {
          const resolver = await storage.getUserById(item.lastResolvedById);
          lastResolvedByName = resolver?.displayName || resolver?.username;
        }
        
        return {
          id: item.id,
          title: item.title,
          order: item.order,
          itemStatus,
          passedSteps,
          failedSteps,
          totalSteps,
          lastReviewedAt: item.lastReviewedAt,
          lastReviewedByName,
          lastReviewedByType: item.lastReviewedByType,
          lastResolvedAt: item.lastResolvedAt,
          lastResolvedByName,
          stepResults: itemResults.map(r => ({
            stepId: r.stepId,
            status: r.status,
            comment: r.comment,
            updatedAt: r.updatedAt,
          })),
        };
      }));
      
      const testRunHistory = testRuns.map(run => ({
        id: run.id,
        runNumber: run.runNumber,
        status: run.status,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      }));
      
      const summary = {
        totalItems: items.length,
        passedItems: itemsWithStatus.filter(i => i.itemStatus === 'passed').length,
        failedItems: itemsWithStatus.filter(i => i.itemStatus === 'failed').length,
        partialItems: itemsWithStatus.filter(i => i.itemStatus === 'partial').length,
        pendingItems: itemsWithStatus.filter(i => i.itemStatus === 'pending').length,
      };
      
      res.json({
        sessionId: id,
        sessionStatus: session.status,
        summary,
        items: itemsWithStatus,
        testRuns: testRunHistory,
        activeRunId: latestRun?.id,
      });
    } catch (error) {
      console.error("Error fetching UAT session status:", error);
      res.status(500).json({ error: "Failed to fetch session status" });
    }
  });

  app.post("/api/uat-sessions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      // Generate a shorter, URL-safe token (12 chars base64url = 72 bits of entropy)
      const inviteToken = randomBytes(9).toString("base64url");
      
      const validation = insertUatSessionSchema.safeParse({
        ...req.body,
        createdById: userId,
        inviteToken,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid session data", details: validation.error });
      }
      
      const session = await storage.createUatSession(validation.data);
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating UAT session:", error);
      res.status(500).json({ error: "Failed to create UAT session" });
    }
  });

  app.patch("/api/uat-sessions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const session = await storage.updateUatSession(id, req.body);
      res.json(session);
    } catch (error) {
      console.error("Error updating UAT session:", error);
      res.status(500).json({ error: "Failed to update UAT session" });
    }
  });

  app.delete("/api/uat-sessions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUatSession(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UAT session:", error);
      res.status(500).json({ error: "Failed to delete UAT session" });
    }
  });

  // UAT Session Password Management
  app.post("/api/uat-sessions/:id/password", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { password, generate } = req.body;
      const { hashPassword } = await import("./auth");
      
      let plainPassword: string;
      if (generate) {
        // Generate a simple 6-character alphanumeric password
        plainPassword = randomBytes(3).toString("hex").toUpperCase();
      } else if (password) {
        plainPassword = password;
      } else {
        return res.status(400).json({ error: "Password or generate flag required" });
      }
      
      const hashedPassword = await hashPassword(plainPassword);
      await storage.updateUatSession(id, { accessPassword: hashedPassword });
      
      // Return the plain password so it can be shown once
      res.json({ password: plainPassword, message: "Password set successfully" });
    } catch (error) {
      console.error("Error setting UAT session password:", error);
      res.status(500).json({ error: "Failed to set password" });
    }
  });

  app.delete("/api/uat-sessions/:id/password", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.updateUatSession(id, { accessPassword: null });
      res.json({ message: "Password removed" });
    } catch (error) {
      console.error("Error removing UAT session password:", error);
      res.status(500).json({ error: "Failed to remove password" });
    }
  });

  // UAT Session Email Notifications
  app.post("/api/uat-sessions/:id/send-update", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      // Fetch session, owner info, items, guests, and collaborators
      const session = await storage.getUatSessionById(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Get owner info
      let ownerEmail: string | undefined;
      let ownerName: string | undefined;
      if (session.createdById) {
        const owner = await storage.getUserById(session.createdById);
        if (owner) {
          ownerEmail = owner.email || undefined;
          ownerName = owner.displayName || owner.username;
        }
      }
      
      // Get items with step status info
      const items = await storage.getUatChecklistItems(id);
      const guests = await storage.getUatGuests(id);
      const collaborators = await storage.getUatSessionCollaborators(id);
      
      // Get active test run to calculate item statuses
      const testRuns = await storage.getUatTestRuns(id);
      const activeRun = testRuns.find(r => r.status === 'active');
      
      // Get all steps for items
      const allSteps: any[] = [];
      for (const item of items) {
        const steps = await storage.getUatChecklistItemSteps(item.id);
        allSteps.push(...steps.map(s => ({ ...s, itemId: item.id })));
      }
      
      // Get step results if there's an active run
      let stepResults: any[] = [];
      if (activeRun) {
        stepResults = await storage.getUatTestStepResults(activeRun.id);
      }
      
      // Calculate item statuses
      const itemsWithStatus = items.map(item => {
        const itemSteps = allSteps.filter(s => s.itemId === item.id);
        const itemResults = stepResults.filter(r => itemSteps.some(s => s.id === r.stepId));
        
        const totalSteps = itemSteps.length;
        const passedSteps = itemResults.filter(r => r.status === 'passed' || r.status === 'acknowledged').length;
        const failedSteps = itemResults.filter(r => r.status === 'failed').length;
        
        let itemStatus: 'pending' | 'passed' | 'failed' | 'partial' = 'pending';
        if (totalSteps > 0) {
          if (failedSteps > 0) {
            itemStatus = 'failed';
          } else if (passedSteps === totalSteps) {
            itemStatus = 'passed';
          } else if (passedSteps > 0) {
            itemStatus = 'partial';
          }
        }
        
        return {
          ...item,
          steps: itemSteps,
          stepResults: itemResults,
          itemStatus,
          passedSteps,
          totalSteps,
        };
      });
      
      const result = await sendUatSessionUpdateEmail({
        session: { ...session, ownerEmail, ownerName },
        items: itemsWithStatus,
        guests,
        collaborators,
      });
      
      if (result.success) {
        res.json({ message: "Update email sent successfully", sentTo: result.sentTo });
      } else {
        res.status(500).json({ error: result.error || "Failed to send email" });
      }
    } catch (error) {
      console.error("Error sending UAT update email:", error);
      res.status(500).json({ error: "Failed to send update email" });
    }
  });

  // UAT Checklist Items routes
  app.get("/api/uat-sessions/:sessionId/items", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const items = await storage.getUatChecklistItems(sessionId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching UAT checklist items:", error);
      res.status(500).json({ error: "Failed to fetch checklist items" });
    }
  });

  app.post("/api/uat-sessions/:sessionId/items", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const existingItems = await storage.getUatChecklistItems(sessionId);
      const nextOrder = existingItems.length;
      
      const validation = insertUatChecklistItemSchema.safeParse({
        ...req.body,
        sessionId,
        order: nextOrder,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid item data", details: validation.error });
      }
      
      const item = await storage.createUatChecklistItem(validation.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating UAT checklist item:", error);
      res.status(500).json({ error: "Failed to create checklist item" });
    }
  });

  app.patch("/api/uat-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const item = await storage.updateUatChecklistItem(id, req.body);
      res.json(item);
    } catch (error) {
      console.error("Error updating UAT checklist item:", error);
      res.status(500).json({ error: "Failed to update checklist item" });
    }
  });

  app.delete("/api/uat-items/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUatChecklistItem(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UAT checklist item:", error);
      res.status(500).json({ error: "Failed to delete checklist item" });
    }
  });

  app.post("/api/uat-items/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const originalItem = await storage.getUatChecklistItem(id);
      if (!originalItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const originalSteps = await storage.getUatChecklistItemSteps(id);
      const existingItems = await storage.getUatChecklistItems(originalItem.sessionId);
      const nextOrder = existingItems.length;
      
      const newItem = await storage.createUatChecklistItem({
        sessionId: originalItem.sessionId,
        title: `${originalItem.title} (Copy)`,
        instructions: originalItem.instructions,
        imageUrl: originalItem.imageUrl,
        itemType: originalItem.itemType,
        internalNote: originalItem.internalNote,
        referenceUrl: originalItem.referenceUrl,
        category: originalItem.category,
        ownerId: originalItem.ownerId,
        nextAction: originalItem.nextAction,
        order: nextOrder,
      });
      
      for (const step of originalSteps) {
        await storage.createUatChecklistItemStep({
          itemId: newItem.id,
          type: step.type,
          title: step.title,
          description: step.description,
          expectedResult: step.expectedResult,
          order: step.order,
        });
      }
      
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error duplicating UAT checklist item:", error);
      res.status(500).json({ error: "Failed to duplicate checklist item" });
    }
  });

  // Bulk import UAT items and steps from JSON (e.g., from Cursor AI)
  app.post("/api/uat-sessions/:sessionId/items/import", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      // Verify session exists
      const session = await storage.getUatSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Validate import payload
      const validation = uatImportSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Invalid import data", 
          details: validation.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          }))
        });
      }
      
      const { items } = validation.data;
      const existingItems = await storage.getUatChecklistItems(sessionId);
      let nextOrder = existingItems.length;
      
      const createdItems: any[] = [];
      const errors: { index: number; title: string; error: string }[] = [];
      
      for (let i = 0; i < items.length; i++) {
        const importItem = items[i];
        
        try {
          // Create the item
          const newItem = await storage.createUatChecklistItem({
            sessionId,
            title: importItem.title,
            instructions: importItem.instructions || null,
            itemType: importItem.itemType || "approval",
            internalNote: importItem.internalNote || null,
            referenceUrl: importItem.referenceUrl || null,
            category: importItem.category || null,
            order: nextOrder++,
          });
          
          // Create steps if provided
          if (importItem.steps && importItem.steps.length > 0) {
            for (let j = 0; j < importItem.steps.length; j++) {
              const step = importItem.steps[j];
              await storage.createUatChecklistItemStep({
                itemId: newItem.id,
                title: step.title,
                instructions: step.instructions || null,
                expectedResult: step.expectedResult || null,
                stepType: step.stepType || "test",
                linkUrl: step.linkUrl || null,
                notesRequired: step.notesRequired || false,
                notesPrompt: step.notesPrompt || null,
                order: step.order ?? j,
              });
            }
          }
          
          createdItems.push({
            id: newItem.id,
            title: newItem.title,
            stepsCreated: importItem.steps?.length || 0,
          });
        } catch (itemError: any) {
          errors.push({
            index: i,
            title: importItem.title,
            error: itemError.message || "Failed to create item",
          });
        }
      }
      
      res.status(201).json({
        success: true,
        created: createdItems.length,
        errors: errors.length,
        items: createdItems,
        errorDetails: errors,
      });
    } catch (error) {
      console.error("Error importing UAT items:", error);
      res.status(500).json({ error: "Failed to import items" });
    }
  });

  app.post("/api/uat-sessions/:sessionId/reorder", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { itemIds } = req.body;
      
      if (!Array.isArray(itemIds)) {
        return res.status(400).json({ error: "itemIds must be an array" });
      }
      
      await storage.reorderUatChecklistItems(sessionId, itemIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering UAT checklist items:", error);
      res.status(500).json({ error: "Failed to reorder checklist items" });
    }
  });

  // UAT Guests routes
  app.get("/api/uat-sessions/:sessionId/guests", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const guests = await storage.getUatGuests(sessionId);
      res.json(guests);
    } catch (error) {
      console.error("Error fetching UAT guests:", error);
      res.status(500).json({ error: "Failed to fetch guests" });
    }
  });

  app.post("/api/uat-sessions/:sessionId/guests", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      // Generate a shorter, URL-safe token (12 chars base64url = 72 bits of entropy)
      const accessToken = randomBytes(9).toString("base64url");
      
      const validation = insertUatGuestSchema.safeParse({
        ...req.body,
        sessionId,
        accessToken,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid guest data", details: validation.error });
      }
      
      const guest = await storage.createUatGuest(validation.data);
      res.status(201).json(guest);
    } catch (error) {
      console.error("Error creating UAT guest:", error);
      res.status(500).json({ error: "Failed to create guest" });
    }
  });

  app.delete("/api/uat-guests/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUatGuest(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UAT guest:", error);
      res.status(500).json({ error: "Failed to delete guest" });
    }
  });

  // UAT Session Collaborators (for external agency PMs)
  app.get("/api/uat-sessions/:sessionId/collaborators", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const collaborators = await storage.getUatSessionCollaborators(sessionId);
      res.json(collaborators);
    } catch (error) {
      console.error("Error getting UAT collaborators:", error);
      res.status(500).json({ error: "Failed to get collaborators" });
    }
  });

  app.post("/api/uat-sessions/:sessionId/collaborators", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const accessToken = randomBytes(9).toString("base64url");
      
      const validation = insertUatSessionCollaboratorSchema.safeParse({
        ...req.body,
        sessionId,
        accessToken,
        invitedById: req.user?.id,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid collaborator data", details: validation.error });
      }
      
      const collaborator = await storage.createUatSessionCollaborator(validation.data);
      res.status(201).json(collaborator);
    } catch (error) {
      console.error("Error creating UAT collaborator:", error);
      res.status(500).json({ error: "Failed to create collaborator" });
    }
  });

  app.delete("/api/uat-collaborators/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUatSessionCollaborator(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UAT collaborator:", error);
      res.status(500).json({ error: "Failed to delete collaborator" });
    }
  });

  // PM Portal access (for external agency PMs via token)
  app.get("/api/uat/pm/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      // Update last accessed
      await storage.updateUatSessionCollaboratorLastAccessed(collaborator.id);
      
      const session = await storage.getUatSessionWithRelations(collaborator.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const items = await storage.getUatChecklistItems(session.id);
      const guests = await storage.getUatGuests(session.id);
      const collaborators = await storage.getUatSessionCollaborators(session.id);
      
      // Get responses for each item
      const itemsWithResponses = await Promise.all(
        items.map(async (item) => {
          const responses = await storage.getUatResponses(item.id);
          const steps = await storage.getUatChecklistItemSteps(item.id);
          return { ...item, responses, steps };
        })
      );
      
      res.json({
        collaborator: {
          id: collaborator.id,
          name: collaborator.name,
          email: collaborator.email,
          role: collaborator.role,
        },
        session: {
          ...session,
          items: itemsWithResponses,
          guests,
          collaborators: collaborators.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            role: c.role,
          })),
        },
      });
    } catch (error) {
      console.error("Error loading PM portal:", error);
      res.status(500).json({ error: "Failed to load PM portal" });
    }
  });

  // PM Portal guest creation (token-authenticated)
  app.post("/api/uat/pm/:token/guests", async (req, res) => {
    try {
      const { token } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      // Only PM and Editor roles can invite guests
      if (collaborator.role === "viewer") {
        return res.status(403).json({ error: "You don't have permission to invite reviewers" });
      }
      
      // Generate a URL-safe access token for the guest
      const accessToken = randomBytes(9).toString("base64url");
      
      const validation = insertUatGuestSchema.safeParse({
        ...req.body,
        sessionId: collaborator.sessionId, // Server-side enforcement
        accessToken,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid guest data", details: validation.error });
      }
      
      const guest = await storage.createUatGuest(validation.data);
      res.status(201).json(guest);
    } catch (error) {
      console.error("Error creating guest via PM portal:", error);
      res.status(500).json({ error: "Failed to invite reviewer" });
    }
  });

  // PM Portal item management (token-authenticated)
  app.post("/api/uat/pm/:token/items", async (req, res) => {
    try {
      const { token } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to create items" });
      }
      
      const existingItems = await storage.getUatChecklistItems(collaborator.sessionId);
      const nextOrder = existingItems.length;
      
      const validation = insertUatChecklistItemSchema.safeParse({
        ...req.body,
        sessionId: collaborator.sessionId,
        order: nextOrder,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid item data", details: validation.error });
      }
      
      const item = await storage.createUatChecklistItem(validation.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating item via PM portal:", error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  app.patch("/api/uat/pm/:token/items/:itemId", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to edit items" });
      }
      
      const existingItem = await storage.getUatChecklistItem(itemId);
      if (!existingItem || existingItem.sessionId !== collaborator.sessionId) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const { title, instructions, itemType, internalNote, referenceUrl } = req.body;
      const item = await storage.updateUatChecklistItem(itemId, { 
        title, instructions, itemType, internalNote, referenceUrl 
      });
      res.json(item);
    } catch (error) {
      console.error("Error updating item via PM portal:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/uat/pm/:token/items/:itemId", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to delete items" });
      }
      
      const existingItem = await storage.getUatChecklistItem(itemId);
      if (!existingItem || existingItem.sessionId !== collaborator.sessionId) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      await storage.deleteUatChecklistItem(itemId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting item via PM portal:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.post("/api/uat/pm/:token/items/:itemId/duplicate", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to duplicate items" });
      }
      
      const originalItem = await storage.getUatChecklistItem(itemId);
      if (!originalItem || originalItem.sessionId !== collaborator.sessionId) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const originalSteps = await storage.getUatChecklistItemSteps(itemId);
      const existingItems = await storage.getUatChecklistItems(originalItem.sessionId);
      const nextOrder = existingItems.length;
      
      const newItem = await storage.createUatChecklistItem({
        sessionId: originalItem.sessionId,
        title: `${originalItem.title} (Copy)`,
        instructions: originalItem.instructions,
        imageUrl: originalItem.imageUrl,
        itemType: originalItem.itemType,
        internalNote: originalItem.internalNote,
        referenceUrl: originalItem.referenceUrl,
        category: originalItem.category,
        ownerId: originalItem.ownerId,
        nextAction: originalItem.nextAction,
        order: nextOrder,
      });
      
      for (const step of originalSteps) {
        await storage.createUatChecklistItemStep({
          itemId: newItem.id,
          type: step.type,
          title: step.title,
          description: step.description,
          expectedResult: step.expectedResult,
          order: step.order,
        });
      }
      
      res.status(201).json(newItem);
    } catch (error) {
      console.error("Error duplicating item via PM portal:", error);
      res.status(500).json({ error: "Failed to duplicate item" });
    }
  });

  // PM Portal Step CRUD
  app.post("/api/uat/pm/:token/items/:itemId/steps", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to create steps" });
      }
      
      const existingItem = await storage.getUatChecklistItem(itemId);
      if (!existingItem || existingItem.sessionId !== collaborator.sessionId) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const existingSteps = await storage.getUatChecklistItemSteps(itemId);
      const nextOrder = existingSteps.length;
      
      const validation = insertUatChecklistItemStepSchema.safeParse({
        ...req.body,
        itemId,
        order: nextOrder,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid step data", details: validation.error });
      }
      
      const step = await storage.createUatChecklistItemStep(validation.data);
      res.status(201).json(step);
    } catch (error) {
      console.error("Error creating step via PM portal:", error);
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.patch("/api/uat/pm/:token/steps/:stepId", async (req, res) => {
    try {
      const { token, stepId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to edit steps" });
      }
      
      const existingStep = await storage.getUatChecklistItemStep(stepId);
      if (!existingStep) {
        return res.status(404).json({ error: "Step not found" });
      }
      
      const item = await storage.getUatChecklistItem(existingStep.itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(404).json({ error: "Step not found" });
      }
      
      const { title, instructions, expectedResult, stepType, delaySeconds } = req.body;
      const step = await storage.updateUatChecklistItemStep(stepId, { 
        title, instructions, expectedResult, stepType, delaySeconds 
      });
      res.json(step);
    } catch (error) {
      console.error("Error updating step via PM portal:", error);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.delete("/api/uat/pm/:token/steps/:stepId", async (req, res) => {
    try {
      const { token, stepId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      if (collaborator.role === "viewer" || collaborator.role === "developer") {
        return res.status(403).json({ error: "You don't have permission to delete steps" });
      }
      
      const existingStep = await storage.getUatChecklistItemStep(stepId);
      if (!existingStep) {
        return res.status(404).json({ error: "Step not found" });
      }
      
      const item = await storage.getUatChecklistItem(existingStep.itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(404).json({ error: "Step not found" });
      }
      
      await storage.deleteUatChecklistItemStep(stepId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting step via PM portal:", error);
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  // PM Portal Collaborator invites (for inviting developers)
  app.post("/api/uat/pm/:token/collaborators", async (req, res) => {
    try {
      const { token } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid or expired PM access link" });
      }
      
      // Only PM role can invite other collaborators
      if (collaborator.role !== "pm") {
        return res.status(403).json({ error: "Only PMs can invite collaborators" });
      }
      
      const accessToken = randomBytes(9).toString('base64url');
      
      // Note: invitedById references users table, but PM portal collaborators aren't internal users
      // We set it to null here since the invite comes from an external collaborator
      const validation = insertUatSessionCollaboratorSchema.safeParse({
        ...req.body,
        sessionId: collaborator.sessionId,
        accessToken,
        invitedById: null,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid collaborator data", details: validation.error });
      }
      
      const newCollaborator = await storage.createUatSessionCollaborator(validation.data);
      res.status(201).json(newCollaborator);
    } catch (error) {
      console.error("Error creating collaborator via PM portal:", error);
      res.status(500).json({ error: "Failed to invite collaborator" });
    }
  });

  // External UAT access routes (for guest reviewers)
  
  // Session-level invite access (uses session inviteToken)
  app.get("/api/uat/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const session = await storage.getUatSessionByInviteToken(token);
      
      if (!session) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }
      
      if (session.status === "completed") {
        return res.status(404).json({ error: "This review session is no longer available" });
      }
      
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This review session has expired" });
      }
      
      // Check if session requires password
      if (session.accessPassword) {
        return res.json({
          requiresPassword: true,
          session: {
            id: session.id,
            name: session.name,
          },
        });
      }
      
      // Get checklist items (no responses since this is a general invite)
      const items = await storage.getUatChecklistItems(session.id);
      
      res.json({
        requiresPassword: false,
        session: {
          id: session.id,
          name: session.name,
          description: session.description,
          status: session.status,
        },
        guest: {
          id: "anonymous",
          name: "Reviewer",
          email: "",
        },
        items: items.map(item => ({
          ...item,
          response: null,
        })),
        progress: {
          total: items.length,
          completed: 0,
          approved: 0,
          changesRequested: 0,
        },
      });
    } catch (error) {
      console.error("Error loading UAT invite:", error);
      res.status(500).json({ error: "Failed to load review" });
    }
  });
  
  // Password authentication for invite access
  app.post("/api/uat/invite/:token/authenticate", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      const { comparePasswords } = await import("./auth");
      
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      const session = await storage.getUatSessionByInviteToken(token);
      
      if (!session) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }
      
      if (!session.accessPassword) {
        return res.status(400).json({ error: "This session does not require a password" });
      }
      
      const isValid = await comparePasswords(password, session.accessPassword);
      
      if (!isValid) {
        return res.status(401).json({ error: "Incorrect password" });
      }
      
      // Password verified, return full session data
      const items = await storage.getUatChecklistItems(session.id);
      
      res.json({
        authenticated: true,
        session: {
          id: session.id,
          name: session.name,
          description: session.description,
          status: session.status,
        },
        guest: {
          id: "anonymous",
          name: "Reviewer",
          email: "",
        },
        items: items.map(item => ({
          ...item,
          response: null,
        })),
        progress: {
          total: items.length,
          completed: 0,
          approved: 0,
          changesRequested: 0,
        },
      });
    } catch (error) {
      console.error("Error authenticating UAT invite:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });
  
  // Guest-specific review access (uses guest accessToken)
  app.get("/api/uat/review/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const guest = await storage.getUatGuestByAccessToken(token);
      
      if (!guest) {
        return res.status(404).json({ error: "Invalid or expired access link" });
      }
      
      const session = await storage.getUatSession(guest.sessionId);
      if (!session || session.status === "completed") {
        return res.status(404).json({ error: "This review session is no longer available" });
      }
      
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This review session has expired" });
      }
      
      // Update last accessed
      await storage.updateUatGuestLastAccessed(guest.id);
      
      // Get checklist items with responses
      const items = await storage.getUatChecklistItems(guest.sessionId);
      const responses = await storage.getUatResponsesByGuest(guest.id);
      
      const itemsWithStatus = items.map(item => {
        const response = responses.find(r => r.checklistItemId === item.id);
        return {
          ...item,
          response: response || null,
        };
      });
      
      res.json({
        session: {
          id: session.id,
          name: session.name,
          description: session.description,
          status: session.status,
        },
        guest: {
          id: guest.id,
          name: guest.name,
          email: guest.email,
        },
        items: itemsWithStatus,
        progress: {
          total: items.length,
          completed: responses.length,
          approved: responses.filter(r => r.status === "approved").length,
          changesRequested: responses.filter(r => r.status === "changes_requested").length,
        },
      });
    } catch (error) {
      console.error("Error loading UAT review:", error);
      res.status(500).json({ error: "Failed to load review" });
    }
  });

  app.post("/api/uat/review/:token/respond", async (req, res) => {
    try {
      const { token } = req.params;
      const { checklistItemId, status, feedback } = req.body;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const session = await storage.getUatSession(guest.sessionId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "This review session is not active" });
      }
      
      if (status !== "approved" && status !== "changes_requested") {
        return res.status(400).json({ error: "Status must be 'approved' or 'changes_requested'" });
      }
      
      if (status === "changes_requested" && !feedback?.trim()) {
        return res.status(400).json({ error: "Feedback is required when requesting changes" });
      }
      
      // Check if response already exists
      const existing = await storage.getUatResponse(checklistItemId, guest.id);
      
      let response;
      if (existing) {
        response = await storage.updateUatResponse(existing.id, { status, feedback });
      } else {
        response = await storage.createUatResponse({
          checklistItemId,
          guestId: guest.id,
          status,
          feedback,
        });
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error submitting UAT response:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // Unified short token route - handles both session invites and guest access tokens
  app.get("/api/uat/token/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // First try to find it as a guest access token
      const guest = await storage.getUatGuestByAccessToken(token);
      if (guest) {
        const session = await storage.getUatSession(guest.sessionId);
        if (!session || session.status === "completed") {
          return res.status(404).json({ error: "This review session is no longer available" });
        }
        
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          return res.status(410).json({ error: "This review session has expired" });
        }
        
        await storage.updateUatGuestLastAccessed(guest.id);
        
        const items = await storage.getUatChecklistItems(guest.sessionId);
        const responses = await storage.getUatResponsesByGuest(guest.id);
        
        const itemsWithStatus = items.map(item => {
          const response = responses.find(r => r.checklistItemId === item.id);
          return { ...item, response: response || null };
        });
        
        return res.json({
          session: {
            id: session.id,
            name: session.name,
            description: session.description,
            status: session.status,
          },
          guest: { id: guest.id, name: guest.name, email: guest.email },
          items: itemsWithStatus,
          progress: {
            total: items.length,
            completed: responses.length,
            approved: responses.filter(r => r.status === "approved").length,
            changesRequested: responses.filter(r => r.status === "changes_requested").length,
          },
        });
      }
      
      // Try as session invite token
      const session = await storage.getUatSessionByInviteToken(token);
      if (session) {
        if (session.status === "completed") {
          return res.status(404).json({ error: "This review session is no longer available" });
        }
        
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          return res.status(410).json({ error: "This review session has expired" });
        }
        
        if (session.accessPassword) {
          return res.json({
            requiresPassword: true,
            session: { id: session.id, name: session.name },
          });
        }
        
        const items = await storage.getUatChecklistItems(session.id);
        
        return res.json({
          requiresPassword: false,
          session: {
            id: session.id,
            name: session.name,
            description: session.description,
            status: session.status,
          },
          guest: { id: "anonymous", name: "Reviewer", email: "" },
          items: items.map(item => ({ ...item, response: null })),
          progress: {
            total: items.length,
            completed: 0,
            approved: 0,
            changesRequested: 0,
          },
        });
      }
      
      return res.status(404).json({ error: "Invalid or expired link" });
    } catch (error) {
      console.error("Error loading UAT token:", error);
      res.status(500).json({ error: "Failed to load review" });
    }
  });
  
  // Authenticate for short token route
  app.post("/api/uat/token/:token/authenticate", async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;
      const { comparePasswords } = await import("./auth");
      
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      const session = await storage.getUatSessionByInviteToken(token);
      
      if (!session) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }
      
      if (!session.accessPassword) {
        return res.status(400).json({ error: "This session does not require a password" });
      }
      
      const isValid = await comparePasswords(password, session.accessPassword);
      
      if (!isValid) {
        return res.status(401).json({ error: "Incorrect password" });
      }
      
      const items = await storage.getUatChecklistItems(session.id);
      
      res.json({
        authenticated: true,
        session: {
          id: session.id,
          name: session.name,
          description: session.description,
          status: session.status,
        },
        guest: { id: "anonymous", name: "Reviewer", email: "" },
        items: items.map(item => ({ ...item, response: null })),
        progress: {
          total: items.length,
          completed: 0,
          approved: 0,
          changesRequested: 0,
        },
      });
    } catch (error) {
      console.error("Error authenticating UAT token:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });
  
  // Submit response for short token route
  app.post("/api/uat/token/:token/respond", async (req, res) => {
    try {
      const { token } = req.params;
      const { checklistItemId, status, feedback } = req.body;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const session = await storage.getUatSession(guest.sessionId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "This review session is not active" });
      }
      
      if (status !== "approved" && status !== "changes_requested") {
        return res.status(400).json({ error: "Status must be 'approved' or 'changes_requested'" });
      }
      
      if (status === "changes_requested" && !feedback?.trim()) {
        return res.status(400).json({ error: "Feedback is required when requesting changes" });
      }
      
      const existing = await storage.getUatResponse(checklistItemId, guest.id);
      
      let response;
      if (existing) {
        response = await storage.updateUatResponse(existing.id, { status, feedback });
      } else {
        response = await storage.createUatResponse({
          checklistItemId,
          guestId: guest.id,
          status,
          feedback,
        });
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error submitting UAT response:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  // UAT Item Comments routes
  app.get("/api/uat-items/:itemId/comments", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const comments = await storage.getUatItemComments(itemId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching UAT item comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/uat-items/:itemId/comments", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const user = req.user as any;
      
      const validation = insertUatItemCommentSchema.safeParse({
        ...req.body,
        itemId,
        authorType: "internal",
        authorId: user.id,
        authorName: `${user.firstName} ${user.lastName}`,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid comment data", details: validation.error });
      }
      
      const comment = await storage.createUatItemComment(validation.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating UAT item comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.patch("/api/uat-comments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { body } = req.body;
      const comment = await storage.updateUatItemComment(id, { body });
      res.json(comment);
    } catch (error) {
      console.error("Error updating UAT item comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  app.delete("/api/uat-comments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUatItemComment(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UAT item comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Guest comment route (via token)
  app.post("/api/uat/token/:token/comments", async (req, res) => {
    try {
      const { token } = req.params;
      const { itemId, body, parentId } = req.body;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const session = await storage.getUatSession(guest.sessionId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "This review session is not active" });
      }
      
      const validation = insertUatItemCommentSchema.safeParse({
        itemId,
        body,
        parentId: parentId || null,
        authorType: "guest",
        authorId: guest.id,
        authorName: guest.name,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid comment data", details: validation.error });
      }
      
      const comment = await storage.createUatItemComment(validation.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating guest comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Guest edit comment
  app.patch("/api/uat/token/:token/comments/:commentId", async (req, res) => {
    try {
      const { token, commentId } = req.params;
      const { body } = req.body;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      // Verify the comment belongs to this guest
      const existingComment = await storage.getUatItemComment(commentId);
      if (!existingComment || existingComment.authorId !== guest.id || existingComment.authorType !== "guest") {
        return res.status(403).json({ error: "You can only edit your own comments" });
      }
      
      const comment = await storage.updateUatItemComment(commentId, { body });
      res.json(comment);
    } catch (error) {
      console.error("Error updating guest comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  // Get comments via token (for reviewers)
  app.get("/api/uat/token/:token/items/:itemId/comments", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const comments = await storage.getUatItemComments(itemId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching UAT item comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Create comment via token (for reviewers)
  app.post("/api/uat/token/:token/items/:itemId/comments", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const { body, parentId } = req.body;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const session = await storage.getUatSession(guest.sessionId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "This review session is not active" });
      }
      
      const validation = insertUatItemCommentSchema.safeParse({
        itemId,
        body,
        parentId: parentId || null,
        authorType: "guest",
        authorId: guest.id,
        authorName: guest.name,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid comment data", details: validation.error });
      }
      
      const comment = await storage.createUatItemComment(validation.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating guest comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // PM collaborator create comment
  app.post("/api/uat/pm/:token/items/:itemId/comments", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const { body, parentId } = req.body;
      
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid PM portal link" });
      }
      
      // PM and Editor roles can comment
      if (!["pm", "editor"].includes(collaborator.role)) {
        return res.status(403).json({ error: "You don't have permission to comment" });
      }
      
      // Verify the item belongs to the collaborator's session
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found in your session" });
      }
      
      const validation = insertUatItemCommentSchema.safeParse({
        itemId,
        body,
        parentId: parentId || null,
        authorType: "pm_collaborator",
        authorId: collaborator.id,
        authorName: collaborator.name,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid comment data", details: validation.error });
      }
      
      const comment = await storage.createUatItemComment(validation.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating PM collaborator comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // PM collaborator edit comment
  app.patch("/api/uat/pm/:token/comments/:commentId", async (req, res) => {
    try {
      const { token, commentId } = req.params;
      const { body } = req.body;
      
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid PM portal link" });
      }
      
      // PM and Editor roles can edit their own comments
      if (!["pm", "editor"].includes(collaborator.role)) {
        return res.status(403).json({ error: "You don't have permission to edit comments" });
      }
      
      // Verify the comment belongs to this collaborator
      const existingComment = await storage.getUatItemComment(commentId);
      if (!existingComment || existingComment.authorId !== collaborator.id || existingComment.authorType !== "pm_collaborator") {
        return res.status(403).json({ error: "You can only edit your own comments" });
      }
      
      const comment = await storage.updateUatItemComment(commentId, { body });
      res.json(comment);
    } catch (error) {
      console.error("Error updating PM collaborator comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  // PM collaborator get comments
  app.get("/api/uat/pm/:token/items/:itemId/comments", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      if (!collaborator) {
        return res.status(404).json({ error: "Invalid PM portal link" });
      }
      
      // Verify the item belongs to the collaborator's session
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found in your session" });
      }
      
      const comments = await storage.getUatItemComments(itemId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching PM collaborator comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Developer Portal routes
  app.get("/api/uat/dev/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid or expired developer access link" });
      }
      
      await storage.updateUatSessionCollaboratorLastAccessed(collaborator.id);
      
      const session = await storage.getUatSessionWithRelations(collaborator.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const items = await storage.getUatChecklistItems(session.id);
      
      res.json({
        session: {
          id: session.id,
          name: session.name,
          description: session.description,
          status: session.status,
        },
        collaborator: {
          id: collaborator.id,
          name: collaborator.name,
          email: collaborator.email,
          role: collaborator.role,
        },
        items,
      });
    } catch (error) {
      console.error("Error fetching developer portal data:", error);
      res.status(500).json({ error: "Failed to load developer portal" });
    }
  });

  // Developer portal progress
  app.get("/api/uat/dev/:token/progress", async (req, res) => {
    try {
      const { token } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      const items = await storage.getUatChecklistItems(collaborator.sessionId);
      const progress: Record<string, { totalSteps: number; passedSteps: number; failedSteps: number; pendingSteps: number }> = {};
      
      for (const item of items) {
        const steps = await storage.getUatChecklistItemSteps(item.id);
        const latestRun = await storage.getActiveUatTestRun(item.id);
        
        if (!latestRun || steps.length === 0) {
          progress[item.id] = { totalSteps: steps.length, passedSteps: 0, failedSteps: 0, pendingSteps: steps.length };
        } else {
          const results = await storage.getUatTestStepResults(latestRun.id);
          const passed = results.filter(r => r.status === "passed" || r.status === "acknowledged").length;
          const failed = results.filter(r => r.status === "failed").length;
          progress[item.id] = { 
            totalSteps: steps.length, 
            passedSteps: passed, 
            failedSteps: failed, 
            pendingSteps: steps.length - passed - failed 
          };
        }
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching developer progress:", error);
      res.status(500).json({ error: "Failed to load progress" });
    }
  });

  // Developer portal - get steps for an item
  app.get("/api/uat/dev/:token/items/:itemId/steps", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found" });
      }
      
      const steps = await storage.getUatChecklistItemSteps(itemId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching developer steps:", error);
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  // Developer portal - get active run for an item
  app.get("/api/uat/dev/:token/items/:itemId/active-run", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found" });
      }
      
      // Developers work with the active/latest test run (shared with other testers)
      let run = await storage.getActiveUatTestRun(itemId);
      
      if (!run) {
        // Create a new test run if none exists
        run = await storage.createUatTestRun({
          itemId,
          runNumber: 1,
          status: "active",
          triggerReason: "initial",
        });
        
        // Initialize step results
        const steps = await storage.getUatChecklistItemSteps(itemId);
        for (const step of steps) {
          await storage.updateUatTestStepResult(run.id, step.id, { status: "pending" });
        }
      }
      
      const results = await storage.getUatTestStepResults(run.id);
      res.json({ run, results });
    } catch (error) {
      console.error("Error fetching developer active run:", error);
      res.status(500).json({ error: "Failed to fetch active run" });
    }
  });

  // Developer portal - update step result
  app.patch("/api/uat/dev/:token/runs/:runId/steps/:stepId", async (req, res) => {
    try {
      const { token, runId, stepId } = req.params;
      const { status, notes } = req.body;
      
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      // Verify the run belongs to an item in the developer's session
      const run = await storage.getUatTestRun(runId);
      if (!run) {
        return res.status(404).json({ error: "Test run not found" });
      }
      
      const item = await storage.getUatChecklistItem(run.itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Not authorized to update this run" });
      }
      
      const result = await storage.updateUatTestStepResult(runId, stepId, { 
        status, 
        notes,
        testerName: collaborator.name,
        testerId: collaborator.id,
      });
      
      // Update item's lastReviewedAt/By tracking
      const updateData: any = {
        lastReviewedAt: new Date(),
        lastReviewedByName: collaborator.name,
        lastReviewedByType: 'developer',
      };
      
      // Check if all steps now pass (resolved)
      const steps = await storage.getUatChecklistItemSteps(run.itemId);
      const allResults = await storage.getUatTestStepResults(runId);
      const failedNow = allResults.some(r => r.status === 'failed') || status === 'failed';
      const allPassed = steps.every(s => {
        const r = allResults.find(res => res.stepId === s.id);
        if (s.id === stepId) return status === 'passed' || status === 'acknowledged';
        return r && (r.status === 'passed' || r.status === 'acknowledged');
      });
      
      if (!failedNow && allPassed) {
        updateData.lastResolvedAt = new Date();
        updateData.lastResolvedByName = collaborator.name;
      }
      
      await storage.updateUatChecklistItem(run.itemId, updateData);
      
      res.json(result);
    } catch (error) {
      console.error("Error updating developer step result:", error);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  // Developer portal - get comments
  app.get("/api/uat/dev/:token/items/:itemId/comments", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found" });
      }
      
      const comments = await storage.getUatItemComments(itemId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching developer comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  // Developer portal - post comment
  app.post("/api/uat/dev/:token/items/:itemId/comments", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      const { body, parentId } = req.body;
      
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found" });
      }
      
      const validation = insertUatItemCommentSchema.safeParse({
        itemId,
        body,
        parentId: parentId || null,
        authorType: "developer",
        authorId: collaborator.id,
        authorName: collaborator.name,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid comment data", details: validation.error });
      }
      
      const comment = await storage.createUatItemComment(validation.data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating developer comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  // Developer portal - edit comment
  app.patch("/api/uat/dev/:token/items/:itemId/comments/:commentId", async (req, res) => {
    try {
      const { token, itemId, commentId } = req.params;
      const { body } = req.body;
      
      const collaborator = await storage.getUatSessionCollaboratorByToken(token);
      if (!collaborator || collaborator.role !== "developer") {
        return res.status(404).json({ error: "Invalid developer link" });
      }
      
      // Verify the item belongs to the developer's session
      const item = await storage.getUatChecklistItem(itemId);
      if (!item || item.sessionId !== collaborator.sessionId) {
        return res.status(403).json({ error: "Item not found in your session" });
      }
      
      const existingComment = await storage.getUatItemComment(commentId);
      if (!existingComment || existingComment.itemId !== itemId) {
        return res.status(404).json({ error: "Comment not found" });
      }
      
      if (existingComment.authorId !== collaborator.id) {
        return res.status(403).json({ error: "You can only edit your own comments" });
      }
      
      const comment = await storage.updateUatItemComment(commentId, { body });
      res.json(comment);
    } catch (error) {
      console.error("Error updating developer comment:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  });

  // UAT Checklist Item Steps routes
  app.get("/api/uat-items/:itemId/steps", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const steps = await storage.getUatChecklistItemSteps(itemId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching UAT item steps:", error);
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.post("/api/uat-items/:itemId/steps", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const existingSteps = await storage.getUatChecklistItemSteps(itemId);
      const nextOrder = existingSteps.length;
      
      const validation = insertUatChecklistItemStepSchema.safeParse({
        ...req.body,
        itemId,
        order: nextOrder,
      });
      
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid step data", details: validation.error });
      }
      
      const step = await storage.createUatChecklistItemStep(validation.data);
      res.status(201).json(step);
    } catch (error) {
      console.error("Error creating UAT item step:", error);
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.patch("/api/uat-steps/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const step = await storage.updateUatChecklistItemStep(id, req.body);
      res.json(step);
    } catch (error) {
      console.error("Error updating UAT item step:", error);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.delete("/api/uat-steps/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUatChecklistItemStep(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting UAT item step:", error);
      res.status(500).json({ error: "Failed to delete step" });
    }
  });

  app.post("/api/uat-items/:itemId/steps/reorder", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const { stepIds } = req.body;
      
      if (!Array.isArray(stepIds)) {
        return res.status(400).json({ error: "stepIds must be an array" });
      }
      
      await storage.reorderUatChecklistItemSteps(itemId, stepIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering UAT item steps:", error);
      res.status(500).json({ error: "Failed to reorder steps" });
    }
  });

  // UAT Test Runs routes
  app.get("/api/uat-items/:itemId/runs", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const runs = await storage.getUatTestRuns(itemId);
      res.json(runs);
    } catch (error) {
      console.error("Error fetching UAT test runs:", error);
      res.status(500).json({ error: "Failed to fetch test runs" });
    }
  });

  app.get("/api/uat-items/:itemId/active-run", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const run = await storage.getActiveUatTestRun(itemId);
      if (!run) {
        return res.status(404).json({ error: "No active test run found" });
      }
      const results = await storage.getUatTestStepResults(run.id);
      res.json({ run, results });
    } catch (error) {
      console.error("Error fetching active UAT test run:", error);
      res.status(500).json({ error: "Failed to fetch active test run" });
    }
  });

  app.post("/api/uat-items/:itemId/runs", requireAuth, async (req, res) => {
    try {
      const { itemId } = req.params;
      const user = req.user as any;
      const run = await storage.createNewTestRunForRetest(itemId, user?.id);
      res.status(201).json(run);
    } catch (error) {
      console.error("Error creating UAT test run:", error);
      res.status(500).json({ error: "Failed to create test run" });
    }
  });

  // UAT Test Step Results routes
  app.get("/api/uat-runs/:runId/results", requireAuth, async (req, res) => {
    try {
      const { runId } = req.params;
      const results = await storage.getUatTestStepResults(runId);
      res.json(results);
    } catch (error) {
      console.error("Error fetching UAT test step results:", error);
      res.status(500).json({ error: "Failed to fetch test step results" });
    }
  });

  app.patch("/api/uat-runs/:runId/steps/:stepId", requireAuth, async (req, res) => {
    try {
      const { runId, stepId } = req.params;
      const { status, notes, testerName, testerId } = req.body;
      
      // Notes required only for failed steps (not for passed, acknowledged, or delay steps)
      if (status === "failed" && !notes?.trim()) {
        return res.status(400).json({ error: "Notes are required when marking a step as failed" });
      }
      
      const result = await storage.updateUatTestStepResult(runId, stepId, {
        status,
        notes,
        testerName,
        testerId,
      });
      
      // Update item's lastReviewedAt/By tracking
      const run = await storage.getUatTestRun(runId);
      if (run) {
        const updateData: any = {
          lastReviewedAt: new Date(),
          lastReviewedByName: testerName || 'Unknown',
          lastReviewedByType: 'internal',
        };
        
        // Check if item was previously failed and is now all passing (resolved)
        const steps = await storage.getUatChecklistItemSteps(run.itemId);
        const allResults = await storage.getUatTestStepResults(runId);
        const failedBefore = allResults.some(r => r.stepId !== stepId && r.status === 'failed');
        const failedNow = allResults.some(r => r.status === 'failed') || status === 'failed';
        const allPassed = steps.every(s => {
          const r = allResults.find(res => res.stepId === s.id);
          if (s.id === stepId) return status === 'passed' || status === 'acknowledged';
          return r && (r.status === 'passed' || r.status === 'acknowledged');
        });
        
        if (!failedNow && allPassed) {
          updateData.lastResolvedAt = new Date();
          updateData.lastResolvedByName = testerName || 'Unknown';
        }
        
        await storage.updateUatChecklistItem(run.itemId, updateData);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error updating UAT test step result:", error);
      res.status(500).json({ error: "Failed to update test step result" });
    }
  });

  // Guest routes for test steps (via token)
  app.get("/api/uat/token/:token/items/:itemId/steps", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const steps = await storage.getUatChecklistItemSteps(itemId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching UAT item steps:", error);
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.get("/api/uat/token/:token/items/:itemId/active-run", async (req, res) => {
    try {
      const { token, itemId } = req.params;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      let run = await storage.getActiveUatTestRun(itemId);
      
      // Auto-create a test run if none exists
      if (!run) {
        const item = await storage.getUatChecklistItem(itemId);
        if (!item) {
          return res.status(404).json({ error: "Item not found" });
        }
        
        // Use createNewTestRunForRetest which handles run numbers correctly
        run = await storage.createNewTestRunForRetest(itemId);
      }
      
      const results = await storage.getUatTestStepResults(run.id);
      res.json({ run, results });
    } catch (error) {
      console.error("Error fetching active UAT test run:", error);
      res.status(500).json({ error: "Failed to fetch active test run" });
    }
  });

  app.patch("/api/uat/token/:token/runs/:runId/steps/:stepId", async (req, res) => {
    try {
      const { token, runId, stepId } = req.params;
      const { status, notes } = req.body;
      
      const guest = await storage.getUatGuestByAccessToken(token);
      if (!guest) {
        return res.status(404).json({ error: "Invalid access link" });
      }
      
      const session = await storage.getUatSession(guest.sessionId);
      if (!session || session.status !== "active") {
        return res.status(400).json({ error: "This review session is not active" });
      }
      
      // Notes required only for failed steps (not for passed, acknowledged, or delay steps)
      if (status === "failed" && !notes?.trim()) {
        return res.status(400).json({ error: "Notes are required when marking a step as failed" });
      }
      
      const result = await storage.updateUatTestStepResult(runId, stepId, {
        status,
        notes,
        guestId: guest.id,
        testerName: guest.name,
        testerId: guest.id,
      });
      
      // Update item's lastReviewedAt/By tracking
      const run = await storage.getUatTestRun(runId);
      if (run) {
        const updateData: any = {
          lastReviewedAt: new Date(),
          lastReviewedByName: guest.name,
          lastReviewedByType: 'guest',
        };
        
        // Check if all steps now pass (resolved)
        const steps = await storage.getUatChecklistItemSteps(run.itemId);
        const allResults = await storage.getUatTestStepResults(runId);
        const failedNow = allResults.some(r => r.status === 'failed') || status === 'failed';
        const allPassed = steps.every(s => {
          const r = allResults.find(res => res.stepId === s.id);
          if (s.id === stepId) return status === 'passed' || status === 'acknowledged';
          return r && (r.status === 'passed' || r.status === 'acknowledged');
        });
        
        if (!failedNow && allPassed) {
          updateData.lastResolvedAt = new Date();
          updateData.lastResolvedByName = guest.name;
        }
        
        await storage.updateUatChecklistItem(run.itemId, updateData);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error updating UAT test step result:", error);
      res.status(500).json({ error: "Failed to update test step result" });
    }
  });

  // Object Storage routes (based on javascript_object_storage blueprint)
  // Get upload URL for project attachments
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Get upload URL for public logo files
  app.post("/api/logos/upload", requireAuth, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const { uploadURL, publicURL } = await objectStorageService.getPublicLogoUploadURL();
      res.json({ uploadURL, publicURL });
    } catch (error) {
      console.error("Error generating logo upload URL:", error);
      res.status(500).json({ error: "Failed to generate logo upload URL" });
    }
  });

  // Confirm logo upload and make it public
  app.post("/api/logos/confirm", requireAuth, async (req, res) => {
    try {
      const { publicURL } = req.body;
      if (!publicURL) {
        return res.status(400).json({ error: "publicURL is required" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const publicPaths = objectStorageService.getPublicObjectSearchPaths();
      
      const url = new URL(publicURL);
      const pathParts = url.pathname.split('/').filter(p => p);
      const bucketName = pathParts[0];
      const objectPath = '/' + pathParts.join('/');
      
      const isInPublicPath = publicPaths.some(publicPath => {
        const publicBucket = publicPath.split('/')[1];
        return publicBucket === bucketName && objectPath.startsWith('/' + bucketName + '/public/logos/');
      });
      
      if (!isInPublicPath) {
        return res.status(403).json({ error: "Invalid logo path" });
      }
      
      await objectStorageService.makeObjectPublic(publicURL);
      res.json({ success: true, publicURL });
    } catch (error) {
      console.error("Error confirming logo upload:", error);
      res.status(500).json({ error: "Failed to confirm logo upload" });
    }
  });

  // Serve private objects with ACL check
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.sendStatus(401);
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Project Attachments routes
  app.get("/api/projects/:projectId/attachments", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const attachments = await storage.getProjectAttachmentsByProject(projectId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching project attachments:", error);
      res.status(500).json({ error: "Failed to fetch attachments" });
    }
  });

  app.post("/api/projects/:projectId/attachments", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const validationResult = insertProjectAttachmentSchema.safeParse({
        ...req.body,
        projectId,
        userId,
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid attachment data", 
          details: validationResult.error.errors 
        });
      }

      // Extract object path from presigned URL
      const objectStorageService = new ObjectStorageService();
      let objectPath = req.body.objectPath;
      
      // If it's a full URL, extract the pathname and convert to /objects/ format
      if (objectPath.startsWith('http://') || objectPath.startsWith('https://')) {
        const url = new URL(objectPath);
        const pathname = url.pathname; // e.g., /bucket/uploads/uuid
        const privateDir = objectStorageService.getPrivateObjectDir();
        
        // Extract the object ID from the path
        // Expected format: /{bucket}/{privateDir}/uploads/{uuid}
        const parts = pathname.split('/').filter(p => p);
        if (parts.length >= 3 && parts[parts.length - 2] === 'uploads') {
          const objectId = parts[parts.length - 1];
          objectPath = `/objects/uploads/${objectId}`;
        } else {
          throw new Error('Invalid upload URL format');
        }
      }

      // Set ACL on the object
      try {
        const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        await objectStorageService.canAccessObjectEntity({
          userId,
          objectFile,
          requestedPermission: ObjectPermission.WRITE,
        });
      } catch (error) {
        console.error("Error setting object ACL:", error);
      }

      const attachment = await storage.createProjectAttachment({
        ...validationResult.data,
        objectPath,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Error creating project attachment:", error);
      res.status(500).json({ error: "Failed to create attachment" });
    }
  });

  app.delete("/api/projects/:projectId/attachments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteProjectAttachment(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting attachment:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  });

  // ==========================================
  // Training / LMS Routes
  // ==========================================

  // Training Programs
  app.get("/api/training/programs", requireAuth, async (req, res) => {
    try {
      const programs = await storage.getTrainingPrograms();
      res.json(programs);
    } catch (error) {
      console.error("Error fetching training programs:", error);
      res.status(500).json({ error: "Failed to fetch training programs" });
    }
  });

  app.get("/api/training/programs/:id", requireAuth, async (req, res) => {
    try {
      const program = await storage.getTrainingProgramWithPhases(req.params.id);
      if (!program) return res.status(404).json({ error: "Program not found" });
      res.json(program);
    } catch (error) {
      console.error("Error fetching training program:", error);
      res.status(500).json({ error: "Failed to fetch training program" });
    }
  });

  app.post("/api/training/programs", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingProgramSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const program = await storage.createTrainingProgram(validation.data);
      res.status(201).json(program);
    } catch (error) {
      console.error("Error creating training program:", error);
      res.status(500).json({ error: "Failed to create training program" });
    }
  });

  app.patch("/api/training/programs/:id", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingProgramSchema.partial().safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const program = await storage.updateTrainingProgram(req.params.id, validation.data);
      res.json(program);
    } catch (error) {
      console.error("Error updating training program:", error);
      res.status(500).json({ error: "Failed to update training program" });
    }
  });

  app.delete("/api/training/programs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTrainingProgram(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training program:", error);
      res.status(500).json({ error: "Failed to delete training program" });
    }
  });

  // Training Phases
  app.get("/api/training/programs/:programId/phases", requireAuth, async (req, res) => {
    try {
      const phases = await storage.getTrainingPhases(req.params.programId);
      res.json(phases);
    } catch (error) {
      console.error("Error fetching training phases:", error);
      res.status(500).json({ error: "Failed to fetch training phases" });
    }
  });

  app.post("/api/training/phases", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingPhaseSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const phase = await storage.createTrainingPhase(validation.data);
      res.status(201).json(phase);
    } catch (error) {
      console.error("Error creating training phase:", error);
      res.status(500).json({ error: "Failed to create training phase" });
    }
  });

  app.patch("/api/training/phases/:id", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingPhaseSchema.partial().safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const phase = await storage.updateTrainingPhase(req.params.id, validation.data);
      res.json(phase);
    } catch (error) {
      console.error("Error updating training phase:", error);
      res.status(500).json({ error: "Failed to update training phase" });
    }
  });

  app.delete("/api/training/phases/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTrainingPhase(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training phase:", error);
      res.status(500).json({ error: "Failed to delete training phase" });
    }
  });

  // Training Modules
  app.get("/api/training/phases/:phaseId/modules", requireAuth, async (req, res) => {
    try {
      const modules = await storage.getTrainingModules(req.params.phaseId);
      res.json(modules);
    } catch (error) {
      console.error("Error fetching training modules:", error);
      res.status(500).json({ error: "Failed to fetch training modules" });
    }
  });

  app.get("/api/training/modules/:id", requireAuth, async (req, res) => {
    try {
      const mod = await storage.getTrainingModule(req.params.id);
      if (!mod) return res.status(404).json({ error: "Module not found" });
      const sections = await storage.getTrainingModuleSections(mod.id);
      // Resolve programId from phase
      const phase = await storage.getTrainingPhase(mod.phaseId);
      res.json({ ...mod, sections, programId: phase?.programId });
    } catch (error) {
      console.error("Error fetching training module:", error);
      res.status(500).json({ error: "Failed to fetch training module" });
    }
  });

  app.post("/api/training/modules", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingModuleSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const mod = await storage.createTrainingModule(validation.data);
      res.status(201).json(mod);
    } catch (error) {
      console.error("Error creating training module:", error);
      res.status(500).json({ error: "Failed to create training module" });
    }
  });

  app.patch("/api/training/modules/:id", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingModuleSchema.partial().safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const mod = await storage.updateTrainingModule(req.params.id, validation.data);
      res.json(mod);
    } catch (error) {
      console.error("Error updating training module:", error);
      res.status(500).json({ error: "Failed to update training module" });
    }
  });

  app.delete("/api/training/modules/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTrainingModule(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training module:", error);
      res.status(500).json({ error: "Failed to delete training module" });
    }
  });

  // Training Module Sections
  app.get("/api/training/modules/:moduleId/sections", requireAuth, async (req, res) => {
    try {
      const sections = await storage.getTrainingModuleSections(req.params.moduleId);
      res.json(sections);
    } catch (error) {
      console.error("Error fetching training module sections:", error);
      res.status(500).json({ error: "Failed to fetch training module sections" });
    }
  });

  app.post("/api/training/sections", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingModuleSectionSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const section = await storage.createTrainingModuleSection(validation.data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error creating training module section:", error);
      res.status(500).json({ error: "Failed to create training module section" });
    }
  });

  app.patch("/api/training/sections/:id", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingModuleSectionSchema.partial().safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const section = await storage.updateTrainingModuleSection(req.params.id, validation.data);
      res.json(section);
    } catch (error) {
      console.error("Error updating training module section:", error);
      res.status(500).json({ error: "Failed to update training module section" });
    }
  });

  app.delete("/api/training/sections/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTrainingModuleSection(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting training module section:", error);
      res.status(500).json({ error: "Failed to delete training module section" });
    }
  });

  // Training Enrollments
  app.get("/api/training/enrollments", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const enrollments = await storage.getTrainingEnrollments(user.id);
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching training enrollments:", error);
      res.status(500).json({ error: "Failed to fetch training enrollments" });
    }
  });

  // Admin: all enrollments for a program (who is enrolled + progress)
  app.get("/api/training/admin/programs/:programId/enrollments", requireAuth, async (req, res) => {
    try {
      const enrollments = await storage.getTrainingEnrollmentsByProgram(req.params.programId);
      res.json(enrollments);
    } catch (error) {
      console.error("Error fetching program enrollments:", error);
      res.status(500).json({ error: "Failed to fetch program enrollments" });
    }
  });

  app.post("/api/training/enrollments", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { programId } = req.body;
      if (!programId) return res.status(400).json({ error: "programId is required" });

      // Check if already enrolled
      const existing = await storage.getTrainingEnrollmentByUserAndProgram(user.id, programId);
      if (existing) return res.status(409).json({ error: "Already enrolled in this program" });

      const enrollment = await storage.createTrainingEnrollment({
        userId: user.id,
        programId,
        status: "in_progress",
        startedAt: new Date(),
      });
      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Error creating training enrollment:", error);
      res.status(500).json({ error: "Failed to create training enrollment" });
    }
  });

  app.patch("/api/training/enrollments/:id", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingEnrollmentSchema.partial().safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const enrollment = await storage.updateTrainingEnrollment(req.params.id, validation.data);
      res.json(enrollment);
    } catch (error) {
      console.error("Error updating training enrollment:", error);
      res.status(500).json({ error: "Failed to update training enrollment" });
    }
  });

  // Training Module Submissions
  app.get("/api/training/enrollments/:enrollmentId/submissions", requireAuth, async (req, res) => {
    try {
      const submissions = await storage.getTrainingModuleSubmissions(req.params.enrollmentId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching training submissions:", error);
      res.status(500).json({ error: "Failed to fetch training submissions" });
    }
  });

  app.get("/api/training/enrollments/:enrollmentId/submissions/:moduleId", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getTrainingModuleSubmission(req.params.enrollmentId, req.params.moduleId);
      res.json(submission || null);
    } catch (error) {
      console.error("Error fetching training submission:", error);
      res.status(500).json({ error: "Failed to fetch training submission" });
    }
  });

  app.post("/api/training/submissions", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingModuleSubmissionSchema.safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const submission = await storage.createTrainingModuleSubmission(validation.data);
      res.status(201).json(submission);
    } catch (error) {
      console.error("Error creating training submission:", error);
      res.status(500).json({ error: "Failed to create training submission" });
    }
  });

  app.patch("/api/training/submissions/:id", requireAuth, async (req, res) => {
    try {
      const validation = insertTrainingModuleSubmissionSchema.partial().safeParse(req.body);
      if (!validation.success) return res.status(400).json({ error: "Invalid data", details: validation.error });
      const submission = await storage.updateTrainingModuleSubmission(req.params.id, validation.data);
      res.json(submission);
    } catch (error) {
      console.error("Error updating training submission:", error);
      res.status(500).json({ error: "Failed to update training submission" });
    }
  });

  // Training Reviews (admin/manager)
  app.get("/api/training/reviews", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getAllPendingReviews();
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching training reviews:", error);
      res.status(500).json({ error: "Failed to fetch training reviews" });
    }
  });

  app.patch("/api/training/reviews/:submissionId", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { status, reviewerNotes, reviewerRating } = req.body;
      const submission = await storage.updateTrainingModuleSubmission(req.params.submissionId, {
        status,
        reviewerNotes,
        reviewerRating,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      });
      res.json(submission);
    } catch (error) {
      console.error("Error reviewing training submission:", error);
      res.status(500).json({ error: "Failed to review training submission" });
    }
  });

  // Training Seed Data endpoint (admin only)
  app.post("/api/training/seed", requireAuth, async (req, res) => {
    try {
      const { program, phases } = req.body;
      if (!program || !phases) return res.status(400).json({ error: "program and phases are required" });

      const createdProgram = await storage.createTrainingProgram(program);

      for (const phaseData of phases) {
        const { modules, ...phaseFields } = phaseData;
        const createdPhase = await storage.createTrainingPhase({
          ...phaseFields,
          programId: createdProgram.id,
        });

        if (modules) {
          for (const modData of modules) {
            const { sections, ...modFields } = modData;
            const createdModule = await storage.createTrainingModule({
              ...modFields,
              phaseId: createdPhase.id,
            });

            if (sections) {
              for (const sectionData of sections) {
                await storage.createTrainingModuleSection({
                  ...sectionData,
                  moduleId: createdModule.id,
                });
              }
            }
          }
        }
      }

      res.status(201).json({ message: "Training program seeded successfully", programId: createdProgram.id });
    } catch (error) {
      console.error("Error seeding training program:", error);
      res.status(500).json({ error: "Failed to seed training program" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
