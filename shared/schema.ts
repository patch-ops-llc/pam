import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  uuid,
  index,
  unique,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Force rebuild: timestamp

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("user"), // admin, manager, user
  employmentType: text("employment_type").notNull().default("full-time"), // full-time, part-time
  isActive: boolean("is_active").notNull().default(true),
  googleId: text("google_id").unique(), // Google OAuth ID for SSO
  profileImageUrl: text("profile_image_url"), // Profile picture from Google
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// White-label branding configuration
export const brandingConfig = pgTable("branding_config", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#2563eb"),
  secondaryColor: text("secondary_color").notNull().default("#64748b"),
  customDomain: text("custom_domain"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agencies - top level organizational unit (now referred to as "Clients" in UI)
export const agencies = pgTable("agencies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("agency"), // agency, direct
  description: text("description"),
  monthlyBillingTarget: decimal("monthly_billing_target", {
    precision: 10,
    scale: 2,
  }),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  retainerStartDay: integer("retainer_start_day").default(1), // Day of month retainer starts (1-31), defaults to 1st
  requireTimeTrackerConfirmation: boolean("require_time_tracker_confirmation")
    .notNull()
    .default(false), // Require confirmation that hours were logged in agency time tracker
  timeTrackingSystem: text("time_tracking_system"), // Name of the time tracking system (e.g., "Harvest", "Clockify")
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Accounts - agency clients
export const accounts = pgTable("accounts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  richTextContent: text("rich_text_content"),
  monthlyQuotaHours: decimal("monthly_quota_hours", { precision: 8, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Account notes - multiple tabs/pages per account for rich text notes
export const accountNotes = pgTable(
  "account_notes",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    accountId: varchar("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Tab name
    content: text("content"), // Rich text content
    order: integer("order").notNull().default(0), // Tab order
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    accountIdIdx: index("account_notes_account_id_idx").on(table.accountId),
  }),
);

// Projects - associated to accounts and agencies
export const projects = pgTable("projects", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  headline: text("headline"),
  status: text("status").notNull().default("active"), // active, completed, on-hold, cancelled
  // Enhanced project tracking fields
  stage: text("stage").notNull().default("proposal"), // proposal, in-progress, building, go-live, complete
  proposalStatus: text("proposal_status"), // complete, in-progress, pending
  sowPhase: text("sow_phase"), // phase-1, phase-2, etc
  goLiveDate: date("go_live_date"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedHours: decimal("estimated_hours", { precision: 8, scale: 2 }),
  fixedFee: decimal("fixed_fee", { precision: 10, scale: 2 }), // Fixed fee amount for forecasting
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"), // Soft delete - preserves audit trail for time logs
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project Attachments - file attachments for projects
export const projectAttachments = pgTable(
  "project_attachments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size").notNull(),
    fileType: text("file_type").notNull(),
    objectPath: text("object_path").notNull(), // Path in object storage
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("project_attachments_project_id_idx").on(
      table.projectId,
    ),
  }),
);

// Tasks - can be associated to projects OR directly to accounts
export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id").references(() => agencies.id, {
    onDelete: "cascade",
  }), // optional
  accountId: varchar("account_id").references(() => accounts.id, {
    onDelete: "cascade",
  }), // optional
  projectId: varchar("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }), // nullable for account-only tasks
  name: text("name").notNull(),
  description: text("description"),
  notes: text("notes"), // Rich text notes
  status: text("status").notNull().default("todo"), // todo, in-progress, completed, cancelled
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  size: text("size").notNull().default("medium"), // small, medium, large, xlarge
  category: text("category").notNull().default("standard"), // standard, recurring
  billingType: text("billing_type").notNull().default("billable"), // billable, prebilled
  estimatedHours: decimal("estimated_hours", { precision: 8, scale: 2 }),
  startDate: date("start_date"), // nullable - for timeline/gantt visualization
  dueDate: date("due_date"), // nullable - for timeline/gantt visualization
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  deletedAt: timestamp("deleted_at"), // Soft delete - preserves audit trail for time logs
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task labels - tags for organizing tasks
export const taskLabels = pgTable(
  "task_labels",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    color: text("color").notNull().default("#64748b"), // hex color for the label
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    nameUnique: unique("task_labels_name_unique").on(table.name),
  }),
);

// Task label assignments - many-to-many relationship between tasks and labels
export const taskLabelAssignments = pgTable(
  "task_label_assignments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    taskId: varchar("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: varchar("label_id")
      .notNull()
      .references(() => taskLabels.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index("task_label_assignments_task_id_idx").on(table.taskId),
    labelIdIdx: index("task_label_assignments_label_id_idx").on(table.labelId),
    taskLabelUnique: unique("task_label_assignments_task_label_unique").on(
      table.taskId,
      table.labelId,
    ),
  }),
);

// Task collaborators - many-to-many for users tagged/collaborating on tasks
export const taskCollaborators = pgTable(
  "task_collaborators",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    taskId: varchar("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    taskIdIdx: index("task_collaborators_task_id_idx").on(table.taskId),
    userIdIdx: index("task_collaborators_user_id_idx").on(table.userId),
    taskUserUnique: unique("task_collaborators_task_user_unique").on(
      table.taskId,
      table.userId,
    ),
  }),
);

// Time logs - dual tracking for billed vs actual hours
// CRITICAL: With soft deletes, time logs maintain relationships to soft-deleted projects/tasks for complete audit trails
export const timeLogs = pgTable("time_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agencyId: varchar("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  accountId: varchar("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").references(() => projects.id), // nullable - maintains relationship even when project soft-deleted
  taskId: varchar("task_id").references(() => tasks.id), // nullable - maintains relationship even when task soft-deleted
  taskName: text("task_name").notNull(),
  description: text("description"),
  actualHours: decimal("actual_hours", { precision: 8, scale: 2 }).notNull(),
  billedHours: decimal("billed_hours", { precision: 8, scale: 2 }).notNull(),
  billingType: text("billing_type").notNull().default("billed"), // billed, prebilled
  tier: text("tier").notNull().default("tier1"), // tier1, tier2, tier3
  agencyTimeTrackerLogged: boolean("agency_time_tracker_logged"), // Confirmation that hours were logged in agency time tracker
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  logDate: timestamp("log_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Calendar connections - stores Google OAuth tokens for calendar access
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    googleAccountEmail: text("google_account_email").notNull(),
    accessToken: text("access_token").notNull(), // TODO: Should be encrypted at rest
    refreshToken: text("refresh_token").notNull(), // TODO: Should be encrypted at rest
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
    }).notNull(),
    tokenScope: text("token_scope")
      .notNull()
      .default("https://www.googleapis.com/auth/calendar"),
    tokenType: text("token_type").notNull().default("Bearer"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("calendar_connections_user_id_idx").on(table.userId),
  }),
);

// Calendars - individual calendars from Google Calendar
export const calendars = pgTable(
  "calendars",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectionId: varchar("connection_id")
      .notNull()
      .references(() => calendarConnections.id, { onDelete: "cascade" }),
    googleCalendarId: text("google_calendar_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    timeZone: text("time_zone").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    backgroundColor: text("background_color"),
    foregroundColor: text("foreground_color"),
    etag: text("etag"), // For conflict detection and incremental sync
    isActive: boolean("is_active").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncToken: text("sync_token"), // For incremental sync
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    connectionIdIdx: index("calendars_connection_id_idx").on(
      table.connectionId,
    ),
    googleCalendarIdIdx: index("calendars_google_calendar_id_idx").on(
      table.googleCalendarId,
    ),
    connectionCalendarUnique: unique("calendars_connection_google_unique").on(
      table.connectionId,
      table.googleCalendarId,
    ),
  }),
);

// Calendar events - events synced from Google Calendar
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    calendarId: varchar("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    googleEventId: text("google_event_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // Timed events - use timestamptz for proper timezone handling
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    startTimeZone: text("start_time_zone"), // Per-event timezone override
    endTimeZone: text("end_time_zone"), // Per-event timezone override
    // All-day events - use date fields
    startDate: date("start_date"),
    endDate: date("end_date"),
    isAllDay: boolean("is_all_day").notNull().default(false),
    location: text("location"),
    attendees: text("attendees").array(), // Array of email addresses
    status: text("status").notNull().default("confirmed"), // confirmed, tentative, cancelled
    visibility: text("visibility").notNull().default("default"), // default, public, private
    // Recurring event support
    recurringEventId: text("recurring_event_id"), // For recurring events
    originalStartTime: timestamp("original_start_time", { withTimezone: true }), // For recurring instances
    isRecurring: boolean("is_recurring").notNull().default(false),
    // Conflict detection and versioning
    etag: text("etag"), // For conflict detection
    sequence: integer("sequence").default(0), // Version/sequence number
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    calendarIdIdx: index("calendar_events_calendar_id_idx").on(
      table.calendarId,
    ),
    calendarEventUnique: unique("calendar_events_calendar_google_unique").on(
      table.calendarId,
      table.googleEventId,
    ),
    startTimeIdx: index("calendar_events_start_time_idx").on(table.startTime),
    startDateIdx: index("calendar_events_start_date_idx").on(table.startDate),
  }),
);

// Slack configurations - allows targeting specific channels with updates from agencies/accounts
export const slackConfigurations = pgTable(
  "slack_configurations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Descriptive name for the configuration
    webhookUrl: text("webhook_url").notNull(), // Slack webhook URL
    channelName: text("channel_name").notNull(), // #channel-name
    agencyId: varchar("agency_id").references(() => agencies.id, {
      onDelete: "cascade",
    }), // nullable for all agencies
    accountId: varchar("account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }), // nullable for all accounts in agency
    eventTypes: text("event_types")
      .array()
      .notNull()
      .default(sql`ARRAY['task_created', 'task_completed', 'time_logged']`), // Events to trigger notifications
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("slack_configurations_user_id_idx").on(table.userId),
    agencyIdIdx: index("slack_configurations_agency_id_idx").on(table.agencyId),
    accountIdIdx: index("slack_configurations_account_id_idx").on(
      table.accountId,
    ),
  }),
);

// Quota configurations - configurable quota targets and visibility per agency
export const quotaConfigs = pgTable(
  "quota_configs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agencyId: varchar("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    monthlyTarget: decimal("monthly_target", { precision: 8, scale: 2 })
      .notNull()
      .default("160"),
    showBillable: boolean("show_billable").notNull().default(true),
    showPreBilled: boolean("show_pre_billed").notNull().default(true),
    noQuota: boolean("no_quota").notNull().default(false),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agencyIdIdx: index("quota_configs_agency_id_idx").on(table.agencyId),
    agencyIdUnique: unique("quota_configs_agency_id_key").on(table.agencyId),
  }),
);

// Resource quotas - individual quota targets for team members
export const resourceQuotas = pgTable(
  "resource_quotas",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    monthlyTarget: decimal("monthly_target", { precision: 8, scale: 2 })
      .notNull()
      .default("160"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("resource_quotas_user_id_idx").on(table.userId),
    userIdUnique: unique("resource_quotas_user_id_key").on(table.userId),
  }),
);

// Partner bonus policies - Team bonuses when partner quotas are hit
export const partnerBonusPolicies = pgTable(
  "partner_bonus_policies",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agencyId: varchar("agency_id")
      .notNull()
      .references(() => agencies.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Display name (e.g., "Domestique", "New Edge")
    monthlyTargetHours: decimal("monthly_target_hours", {
      precision: 8,
      scale: 2,
    }).notNull(),
    bonusFullTime: decimal("bonus_full_time", { precision: 10, scale: 2 })
      .notNull()
      .default("150"), // FT bonus when hit
    bonusPartTime: decimal("bonus_part_time", { precision: 10, scale: 2 })
      .notNull()
      .default("75"), // PT bonus when hit
    overageRate: decimal("overage_rate", { precision: 10, scale: 2 })
      .notNull()
      .default("2.50"), // Rate increase per hour over
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agencyIdIdx: index("partner_bonus_policies_agency_id_idx").on(
      table.agencyId,
    ),
    agencyIdUnique: unique("partner_bonus_policies_agency_id_key").on(
      table.agencyId,
    ),
  }),
);

// Individual quota bonus settings - Bonus for hitting personal quota and overage
export const individualQuotaBonusSettings = pgTable(
  "individual_quota_bonus_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    employmentType: text("employment_type").notNull(), // full-time, part-time
    monthlyTargetHours: decimal("monthly_target_hours", {
      precision: 8,
      scale: 2,
    }).notNull(),
    quotaBonus: decimal("quota_bonus", { precision: 10, scale: 2 }).notNull(), // $300 FT, $150 PT
    overageRate: decimal("overage_rate", { precision: 10, scale: 2 })
      .notNull()
      .default("5"), // $5/hour overage
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    employmentTypeUnique: unique("individual_quota_bonus_settings_type_key").on(
      table.employmentType,
    ),
  }),
);

// Monthly quota periods - Snapshot of quota calculations per month
export const quotaPeriods = pgTable(
  "quota_periods",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    yearMonth: text("year_month").notNull(), // YYYY-MM format
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
    partnerResults: text("partner_results"), // JSON: [{agencyId, name, targetHours, actualHours, quotaMet, bonusFT, bonusPT}]
    individualResults: text("individual_results"), // JSON: [{userId, targetHours, actualHours, quotaMet, quotaBonus, overageHours, overageBonus}]
    totalPartnerBonusesPaid: decimal("total_partner_bonuses_paid", {
      precision: 10,
      scale: 2,
    }),
    totalIndividualBonusesPaid: decimal("total_individual_bonuses_paid", {
      precision: 10,
      scale: 2,
    }),
    totalOverageBonusesPaid: decimal("total_overage_bonuses_paid", {
      precision: 10,
      scale: 2,
    }),
    isFinalized: boolean("is_finalized").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    yearMonthIdx: index("quota_periods_year_month_idx").on(table.yearMonth),
    yearMonthUnique: unique("quota_periods_year_month_key").on(table.yearMonth),
  }),
);

// Penguin hours tracker - tracks hours against a 50-hour bank
export const penguinHoursTracker = pgTable("penguin_hours_tracker", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id")
    .notNull()
    .references(() => agencies.id, { onDelete: "cascade" }),
  startDate: timestamp("start_date").notNull(),
  hourBank: decimal("hour_bank", { precision: 8, scale: 2 })
    .notNull()
    .default("50"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Forecasting - Manual invoices for revenue tracking
export const forecastInvoices = pgTable("forecast_invoices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("invoice"), // kept for backward compatibility
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(), // Invoice date (when invoice is generated)
  dueDate: date("due_date"), // When payment is due (e.g., Net 30)
  realizationDate: date("realization_date"), // When payment is expected to be received (used for forecasting)
  forecastMonth: date("forecast_month"), // Explicit month designation for forecasting (stores first day of month)
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, received
  agencyId: varchar("agency_id").references(() => agencies.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forecasting - Manual expenses (payroll, systems, etc)
export const forecastExpenses = pgTable("forecast_expenses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // payroll, systems, other
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  description: text("description"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceInterval: text("recurrence_interval"), // weekly, biweekly, monthly
  recurrenceEndDate: date("recurrence_end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forecasting - Individual payroll members for granular expense tracking
export const forecastPayrollMembers = pgTable("forecast_payroll_members", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  monthlyPay: decimal("monthly_pay", { precision: 10, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // nullable for ongoing employment
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Forecasting - Scenario planning
export const forecastScenarios = pgTable("forecast_scenarios", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  agencyQuotaChanges: text("agency_quota_changes"), // JSON string of {agencyId: newQuota}
  newAccounts: text("new_accounts"), // JSON string of account projections
  blendedRate: decimal("blended_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("90"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forecasting - Retainer revenue configuration
export const forecastRetainers = pgTable("forecast_retainers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id").references(() => agencies.id, {
    onDelete: "set null",
  }),
  monthlyAmount: decimal("monthly_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forecasting - Projected monthly fixed-fee revenue by agency/client or prospect
export const forecastAccountRevenue = pgTable("forecast_account_revenue", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id").references(() => agencies.id, {
    onDelete: "cascade",
  }), // nullable - can use prospectName instead
  prospectName: text("prospect_name"), // For forecasting prospects that don't exist as agencies yet
  monthlyAmount: decimal("monthly_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"), // nullable for recurring entries
  isRecurring: boolean("is_recurring").notNull().default(false), // true for ongoing monthly recurring revenue
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forecasting - Global settings for forecast calculations
export const forecastSettings = pgTable("forecast_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  blendedRate: decimal("blended_rate", { precision: 10, scale: 2 })
    .notNull()
    .default("90"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Forecasting - Capacity Resources (team members with billable/actual hours)
export const forecastCapacityResources = pgTable(
  "forecast_capacity_resources",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id, {
      onDelete: "set null",
    }), // optional link to user
    name: text("name").notNull(),
    defaultBillableHours: decimal("default_billable_hours", {
      precision: 8,
      scale: 2,
    }).notNull(), // How many hours they can bill per month
    defaultActualHours: decimal("default_actual_hours", {
      precision: 8,
      scale: 2,
    }).notNull(), // How many hours they actually work per month
    defaultEfficiencyPercent: decimal("default_efficiency_percent", {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default("100"), // Default efficiency % for this resource
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Forecasting - Capacity Allocations (monthly hour commitments to clients)
export const forecastCapacityAllocations = pgTable(
  "forecast_capacity_allocations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agencyId: varchar("agency_id").references(() => agencies.id, {
      onDelete: "cascade",
    }), // nullable for prospects
    prospectName: text("prospect_name"), // For prospects not yet in system
    resourceIds: text("resource_ids")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`), // Array of resource IDs for multiple resource assignment
    engagementType: text("engagement_type").notNull().default("project"), // project, retainer, ongoing
    monthlyBillableHours: decimal("monthly_billable_hours", {
      precision: 8,
      scale: 2,
    }).notNull(), // Billable hours committed
    description: text("description"),
    startMonth: date("start_month").notNull(), // First day of start month
    endMonth: date("end_month"), // nullable for ongoing
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agencyIdIdx: index("forecast_capacity_allocations_agency_id_idx").on(
      table.agencyId,
    ),
  }),
);

// Forecasting - Resources for capacity planning
export const forecastResources = pgTable("forecast_resources", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"), // e.g., "Developer", "Designer", "PM"
  employmentType: text("employment_type").notNull().default("full-time"), // full-time, part-time, contractor
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Forecasting - Monthly capacity per resource
export const resourceMonthlyCapacity = pgTable(
  "resource_monthly_capacity",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    resourceId: varchar("resource_id")
      .notNull()
      .references(() => forecastResources.id, { onDelete: "cascade" }),
    month: date("month").notNull(), // First day of month (e.g., 2025-01-01)
    availableHours: decimal("available_hours", {
      precision: 8,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    resourceIdIdx: index("resource_monthly_capacity_resource_id_idx").on(
      table.resourceId,
    ),
    monthIdx: index("resource_monthly_capacity_month_idx").on(table.month),
    resourceMonthUnique: unique(
      "resource_monthly_capacity_resource_month_unique",
    ).on(table.resourceId, table.month),
  }),
);

// Forecasting - Account allocations per resource per month
export const accountForecastAllocations = pgTable(
  "account_forecast_allocations",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    resourceId: varchar("resource_id")
      .notNull()
      .references(() => forecastResources.id, { onDelete: "cascade" }),
    agencyId: varchar("agency_id").references(() => agencies.id, {
      onDelete: "cascade",
    }), // can be null for prospects
    prospectName: text("prospect_name"), // For prospects not yet in system
    month: date("month").notNull(), // First day of month
    allocatedHours: decimal("allocated_hours", {
      precision: 8,
      scale: 2,
    }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    resourceIdIdx: index("account_forecast_allocations_resource_id_idx").on(
      table.resourceId,
    ),
    agencyIdIdx: index("account_forecast_allocations_agency_id_idx").on(
      table.agencyId,
    ),
    monthIdx: index("account_forecast_allocations_month_idx").on(table.month),
  }),
);

// Project team members - role assignments for projects (comms, PM, build)
export const projectTeamMembers = pgTable(
  "project_team_members",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // comms, pm, build, support
    actualHoursPerWeek: decimal("actual_hours_per_week", {
      precision: 8,
      scale: 2,
    }),
    billedHoursPerWeek: decimal("billed_hours_per_week", {
      precision: 8,
      scale: 2,
    }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("project_team_members_project_id_idx").on(
      table.projectId,
    ),
    userIdIdx: index("project_team_members_user_id_idx").on(table.userId),
    projectUserUnique: unique(
      "project_team_members_project_user_role_unique",
    ).on(table.projectId, table.userId, table.role),
  }),
);

// User availability - track out of office and availability
export const userAvailability = pgTable(
  "user_availability",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason"), // vacation, ooo, client-work, etc
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("user_availability_user_id_idx").on(table.userId),
    startDateIdx: index("user_availability_start_date_idx").on(table.startDate),
  }),
);

// Company-wide holidays - applies to all users for capacity calculations
export const holidays = pgTable(
  "holidays",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    date: date("date").notNull(),
    endDate: date("end_date"), // Optional - for multi-day holidays. If null, holiday is single day
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    dateIdx: index("holidays_date_idx").on(table.date),
  }),
);

// Proposals - quotes and proposals for clients/prospects
export const proposals = pgTable(
  "proposals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    companyName: text("company_name").notNull(), // Simple string field for company/prospect name
    projectId: varchar("project_id").references(() => projects.id, {
      onDelete: "set null",
    }), // optional link to existing project
    htmlContent: text("html_content"), // Nullable for drafts
    templateType: text("template_type").notNull().default("project"), // project, retainer
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    engagementTimeline: text("engagement_timeline"),
    whiteLabelLogoUrl: text("white_label_logo_url"), // Agency/white-label logo (defaults to PatchOps)
    prospectLogoUrl: text("prospect_logo_url"), // Client/prospect logo
    brandFont: text("brand_font").default("Inter"), // Custom font family
    brandPrimaryColor: text("brand_primary_color").default("#2563eb"), // Primary brand color
    brandSecondaryColor: text("brand_secondary_color").default("#64748b"), // Secondary brand color
    brandAccentColor: text("brand_accent_color").default("#f59e0b"), // Accent brand color
    status: text("status").notNull().default("draft"), // "draft" | "published"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastEditedAt: timestamp("last_edited_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("proposals_project_id_idx").on(table.projectId),
    slugIdx: index("proposals_slug_idx").on(table.slug),
    slugUnique: unique("proposals_slug_key").on(table.slug),
    statusIdx: index("proposals_status_idx").on(table.status),
  }),
);

// Proposal scope items - structured scope of work items for AI-generated proposals
export const proposalScopeItems = pgTable(
  "proposal_scope_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    proposalId: varchar("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    storyId: integer("story_id").notNull(), // Sequential ID within proposal
    workstreamName: text("workstream_name").notNull(),
    customerStory: text("customer_story").notNull(),
    recommendedApproach: text("recommended_approach").notNull(),
    assumptions: text("assumptions").notNull(),
    hours: decimal("hours", { precision: 8, scale: 2 }).notNull(),
    order: integer("order").notNull().default(0), // Display order
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    proposalIdIdx: index("proposal_scope_items_proposal_id_idx").on(
      table.proposalId,
    ),
    orderIdx: index("proposal_scope_items_order_idx").on(table.order),
  }),
);

// Knowledge base - old proposals and examples for AI learning
export const knowledgeBaseDocuments = pgTable(
  "knowledge_base_documents",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    companyName: text("company_name").notNull(),
    projectType: text("project_type"), // e.g., "CRM Implementation", "Integration", "Marketing Hub"
    htmlContent: text("html_content").notNull(), // Original HTML content
    extractedText: text("extracted_text"), // Cleaned text for AI context
    tags: text("tags").array(), // Searchable tags
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectTypeIdx: index("knowledge_base_documents_project_type_idx").on(
      table.projectType,
    ),
    tagsIdx: index("knowledge_base_documents_tags_idx").on(table.tags),
  }),
);

// Guidance settings - general rules and guidance for AI generation
export const guidanceSettings = pgTable(
  "guidance_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    content: text("content").notNull(), // Guidance text/rules
    category: text("category").notNull(), // e.g., "scoping", "estimation", "assumptions", "general"
    isActive: boolean("is_active").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("guidance_settings_category_idx").on(table.category),
    orderIdx: index("guidance_settings_order_idx").on(table.order),
  }),
);

// Chat transcripts - input for AI proposal generation
export const chatTranscripts = pgTable(
  "chat_transcripts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    proposalId: varchar("proposal_id").references(() => proposals.id, {
      onDelete: "set null",
    }), // optional link
    title: text("title").notNull(),
    content: text("content").notNull(), // Raw chat transcript
    companyName: text("company_name"),
    contactName: text("contact_name"),
    metadata: text("metadata"), // JSON string for additional context
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    proposalIdIdx: index("chat_transcripts_proposal_id_idx").on(
      table.proposalId,
    ),
  }),
);

// Pipeline stages - configurable stages for leads and deals
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    type: text("type").notNull(), // "lead" or "deal"
    order: integer("order").notNull(),
    color: text("color"), // optional color for visual representation
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index("pipeline_stages_type_idx").on(table.type),
    orderIdx: index("pipeline_stages_order_idx").on(table.order),
  }),
);

// Leads - prospect/opportunity tracking
export const leads = pgTable(
  "leads",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(), // Lead/opportunity name
    company: text("company").notNull(),
    contactName: text("contact_name"),
    contactTitle: text("contact_title"), // role/title of the contact
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    linkedInUrl: text("linkedin_url"),
    source: text("source"), // how the lead was acquired (referral, cold outreach, etc.)
    value: decimal("value", { precision: 12, scale: 2 }), // estimated deal value
    priority: text("priority").default("medium"), // low, medium, high
    nextStep: text("next_step"), // next action to take
    lastContactedAt: timestamp("last_contacted_at"),
    position: integer("position").default(0), // for kanban ordering within stage
    stageId: varchar("stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    assignedToUserId: varchar("assigned_to_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    stageIdIdx: index("leads_stage_id_idx").on(table.stageId),
    assignedToUserIdIdx: index("leads_assigned_to_user_id_idx").on(
      table.assignedToUserId,
    ),
    companyIdx: index("leads_company_idx").on(table.company),
    priorityIdx: index("leads_priority_idx").on(table.priority),
  }),
);

// Deals - qualified opportunities with financial tracking
export const deals = pgTable(
  "deals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    leadId: varchar("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }), // optional reference to originating lead
    name: text("name").notNull(), // Deal name
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    closeDate: date("close_date").notNull(),
    probability: integer("probability").notNull().default(50), // 0-100 percentage
    stageId: varchar("stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    assignedToUserId: varchar("assigned_to_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    leadIdIdx: index("deals_lead_id_idx").on(table.leadId),
    stageIdIdx: index("deals_stage_id_idx").on(table.stageId),
    assignedToUserIdIdx: index("deals_assigned_to_user_id_idx").on(
      table.assignedToUserId,
    ),
    closeDateIdx: index("deals_close_date_idx").on(table.closeDate),
  }),
);

// Lead activities - track interactions with leads
export const leadActivities = pgTable(
  "lead_activities",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    leadId: varchar("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // call, email, meeting, note, task
    description: text("description").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdByUserId: varchar("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    leadIdIdx: index("lead_activities_lead_id_idx").on(table.leadId),
    typeIdx: index("lead_activities_type_idx").on(table.type),
    occurredAtIdx: index("lead_activities_occurred_at_idx").on(
      table.occurredAt,
    ),
  }),
);

// API Keys - for external API access
export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    hashedKey: text("hashed_key").notNull(),
    keyPrefix: text("key_prefix").notNull(), // First 8 chars for identification
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
    keyPrefixIdx: index("api_keys_key_prefix_idx").on(table.keyPrefix),
  }),
);

// UAT Sessions - main container for a UAT review cycle
export const uatSessions = pgTable(
  "uat_sessions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: varchar("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    accountId: varchar("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("draft"), // draft, active, completed
    inviteToken: text("invite_token").notNull().unique(), // Token for invite link access
    createdById: varchar("created_by_id")
      .notNull()
      .references(() => users.id),
    ownerId: varchar("owner_id").references(() => users.id, {
      onDelete: "set null",
    }), // Assigned owner
    dueDate: timestamp("due_date"), // When the review should be completed
    priority: text("priority").default("medium"), // low, medium, high
    accessPassword: text("access_password"), // Hashed password for simple access control
    expiresAt: timestamp("expires_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("uat_sessions_project_id_idx").on(table.projectId),
    accountIdIdx: index("uat_sessions_account_id_idx").on(table.accountId),
    inviteTokenIdx: index("uat_sessions_invite_token_idx").on(
      table.inviteToken,
    ),
    ownerIdIdx: index("uat_sessions_owner_id_idx").on(table.ownerId),
  }),
);

// UAT Guests - external users who can access specific UAT sessions
export const uatGuests = pgTable(
  "uat_guests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .notNull()
      .references(() => uatSessions.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    accessToken: text("access_token").notNull().unique(), // Token for direct session access
    lastAccessedAt: timestamp("last_accessed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("uat_guests_session_id_idx").on(table.sessionId),
    emailIdx: index("uat_guests_email_idx").on(table.email),
    accessTokenIdx: index("uat_guests_access_token_idx").on(table.accessToken),
    uniqueSessionEmail: unique("uat_guests_session_email_unique").on(
      table.sessionId,
      table.email,
    ),
  }),
);

// UAT Session Collaborators - external PMs who can manage specific UAT sessions
export const uatSessionCollaborators = pgTable(
  "uat_session_collaborators",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .notNull()
      .references(() => uatSessions.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("pm"), // pm, editor, viewer
    accessToken: text("access_token").notNull().unique(),
    invitedById: varchar("invited_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastAccessedAt: timestamp("last_accessed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("uat_session_collaborators_session_id_idx").on(
      table.sessionId,
    ),
    accessTokenIdx: index("uat_session_collaborators_access_token_idx").on(
      table.accessToken,
    ),
    uniqueSessionEmail: unique("uat_session_collaborators_session_email_unique").on(
      table.sessionId,
      table.email,
    ),
  }),
);

// UAT Checklist Items - individual items to review in a session
export const uatChecklistItems = pgTable(
  "uat_checklist_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .notNull()
      .references(() => uatSessions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions"), // What to check/test
    imageUrl: text("image_url"), // Optional screenshot/reference image
    itemType: text("item_type").default("approval"), // approval, screenshot, url, text_feedback
    internalNote: text("internal_note"), // Internal notes visible only to staff (not reviewers)
    referenceUrl: text("reference_url"), // URL for reviewer to check
    order: integer("order").notNull().default(0),
    // Enhanced fields for detailed tracking
    status: text("status").default("pending"), // pending, in_progress, review, completed, blocked
    category: text("category"), // Design, Functionality, Content, etc.
    ownerId: varchar("owner_id").references(() => users.id), // Internal user responsible
    nextAction: text("next_action"), // What needs to happen next
    dueDate: timestamp("due_date"), // When this item should be resolved
    customFields:
      jsonb("custom_fields").$type<Record<string, string | number | boolean>>(), // Flexible custom fields
    lastReviewedAt: timestamp("last_reviewed_at"), // When last step was tested by a reviewer
    lastReviewedByName: text("last_reviewed_by_name"), // Name of last reviewer
    lastReviewedByType: text("last_reviewed_by_type"), // guest, developer, internal
    lastResolvedAt: timestamp("last_resolved_at"), // When issues were resolved (all steps passing after failure)
    lastResolvedByName: text("last_resolved_by_name"), // Name of person who resolved
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("uat_checklist_items_session_id_idx").on(
      table.sessionId,
    ),
    ownerIdIdx: index("uat_checklist_items_owner_id_idx").on(table.ownerId),
  }),
);

// UAT Responses - guest feedback/approval for each checklist item
export const uatResponses = pgTable(
  "uat_responses",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    checklistItemId: varchar("checklist_item_id")
      .notNull()
      .references(() => uatChecklistItems.id, { onDelete: "cascade" }),
    guestId: varchar("guest_id")
      .notNull()
      .references(() => uatGuests.id, { onDelete: "cascade" }),
    status: text("status").notNull(), // approved, changes_requested
    feedback: text("feedback"), // Required if changes_requested
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    checklistItemIdIdx: index("uat_responses_checklist_item_id_idx").on(
      table.checklistItemId,
    ),
    guestIdIdx: index("uat_responses_guest_id_idx").on(table.guestId),
    uniqueItemGuest: unique("uat_responses_item_guest_unique").on(
      table.checklistItemId,
      table.guestId,
    ),
  }),
);

// UAT Item Comments - threaded discussions on each checklist item
export const uatItemComments = pgTable(
  "uat_item_comments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    itemId: varchar("item_id")
      .notNull()
      .references(() => uatChecklistItems.id, { onDelete: "cascade" }),
    parentId: varchar("parent_id"), // For threading - null means top-level comment
    authorType: text("author_type").notNull(), // 'internal' (staff) or 'guest' (reviewer)
    authorId: varchar("author_id").notNull(), // userId for internal, guestId for guest
    authorName: text("author_name").notNull(), // Cached for display
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    itemIdIdx: index("uat_item_comments_item_id_idx").on(table.itemId),
    parentIdIdx: index("uat_item_comments_parent_id_idx").on(table.parentId),
  }),
);

// UAT Checklist Item Steps - ordered test steps for each checklist item
export const uatChecklistItemSteps = pgTable(
  "uat_checklist_item_steps",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    itemId: varchar("item_id")
      .notNull()
      .references(() => uatChecklistItems.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions"), // Detailed instructions for testing
    expectedResult: text("expected_result"), // What success looks like
    stepType: text("step_type").notNull().default("test"), // test, delay, info
    linkUrl: text("link_url"), // Clickable reference link
    notesRequired: boolean("notes_required").notNull().default(false), // Require reviewer to enter notes
    notesPrompt: text("notes_prompt"), // Prompt shown to reviewer when notes are required
    estimatedDurationMinutes: integer("estimated_duration_minutes"), // For delay steps
    order: integer("order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    itemIdIdx: index("uat_checklist_item_steps_item_id_idx").on(table.itemId),
  }),
);

// UAT Test Runs - versioned test runs for each checklist item
export const uatTestRuns = pgTable(
  "uat_test_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    itemId: varchar("item_id")
      .notNull()
      .references(() => uatChecklistItems.id, { onDelete: "cascade" }),
    runNumber: integer("run_number").notNull().default(1),
    status: text("status").notNull().default("active"), // active, completed, archived
    triggerReason: text("trigger_reason").notNull().default("initial"), // initial, remediation_retest
    triggeredById: varchar("triggered_by_id").references(() => users.id),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    itemIdIdx: index("uat_test_runs_item_id_idx").on(table.itemId),
    itemRunIdx: unique("uat_test_runs_item_run_unique").on(
      table.itemId,
      table.runNumber,
    ),
  }),
);

// UAT Test Step Results - pass/fail results for each step in a test run
export const uatTestStepResults = pgTable(
  "uat_test_step_results",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: varchar("run_id")
      .notNull()
      .references(() => uatTestRuns.id, { onDelete: "cascade" }),
    stepId: varchar("step_id")
      .notNull()
      .references(() => uatChecklistItemSteps.id, { onDelete: "cascade" }),
    guestId: varchar("guest_id").references(() => uatGuests.id, {
      onDelete: "cascade",
    }), // Nullable for internal testing
    testerId: varchar("tester_id"), // userId for internal, guestId for guest
    testerName: text("tester_name"), // Cached name of tester
    status: text("status"), // null (not tested), passed, failed, acknowledged (for delay/info steps)
    notes: text("notes"), // Required if failed
    testedAt: timestamp("tested_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    runIdIdx: index("uat_test_step_results_run_id_idx").on(table.runId),
    stepIdIdx: index("uat_test_step_results_step_id_idx").on(table.stepId),
    uniqueRunStep: unique("uat_test_step_results_run_step_unique").on(
      table.runId,
      table.stepId,
    ),
  }),
);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertBrandingConfigSchema = createInsertSchema(
  brandingConfig,
).omit({
  id: true,
  createdAt: true,
});

export const insertAgencySchema = createInsertSchema(agencies)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    type: z.enum(["agency", "direct"]).default("agency"),
  });

export const insertAccountSchema = createInsertSchema(accounts)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    monthlyQuotaHours: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = typeof val === "number" ? val : parseFloat(val);
        return isNaN(num) ? undefined : String(num);
      })
      .optional(),
  });

export const insertAccountNoteSchema = createInsertSchema(accountNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects)
  .omit({
    id: true,
    createdAt: true,
    deletedAt: true,
  })
  .extend({
    estimatedHours: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = typeof val === "number" ? val : parseFloat(val);
        return isNaN(num) ? undefined : num;
      })
      .optional(),
  });

export const insertProjectAttachmentSchema = createInsertSchema(
  projectAttachments,
).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
    deletedAt: true,
  })
  .extend({
    estimatedHours: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = typeof val === "number" ? val : parseFloat(val);
        return isNaN(num) ? undefined : num;
      })
      .optional(),
  });

export const insertTaskLabelSchema = createInsertSchema(taskLabels).omit({
  id: true,
  createdAt: true,
});

export const insertTaskLabelAssignmentSchema = createInsertSchema(
  taskLabelAssignments,
).omit({
  id: true,
  createdAt: true,
});

export const insertTaskCollaboratorSchema = createInsertSchema(
  taskCollaborators,
).omit({
  id: true,
  createdAt: true,
});

export const insertTimeLogSchema = createInsertSchema(timeLogs)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    taskName: z.enum([
      "Internal Meetings",
      "Client Meetings",
      "Project Management",
      "Building",
      "Testing",
      "Documentation",
      "Training",
    ]),
    tier: z.enum(["tier1", "tier2", "tier3"]).default("tier1"),
  });

export const insertCalendarConnectionSchema = createInsertSchema(
  calendarConnections,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarSchema = createInsertSchema(calendars).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarEventSchema = createInsertSchema(
  calendarEvents,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSlackConfigurationSchema = createInsertSchema(
  slackConfigurations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuotaConfigSchema = createInsertSchema(quotaConfigs)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    weeklyTarget: z.union([z.number(), z.string()]).transform((val) => {
      if (val === undefined || val === null || val === "") return "40";
      const num = typeof val === "number" ? val.toString() : val;
      return num;
    }),
    monthlyTarget: z.union([z.number(), z.string()]).transform((val) => {
      if (val === undefined || val === null || val === "") return "160";
      const num = typeof val === "number" ? val.toString() : val;
      return num;
    }),
  });

export const insertResourceQuotaSchema = createInsertSchema(
  resourceQuotas,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartnerBonusPolicySchema = createInsertSchema(
  partnerBonusPolicies,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    monthlyTargetHours: z.coerce.number().min(0),
    bonusFullTime: z.coerce.number().min(0),
    bonusPartTime: z.coerce.number().min(0),
    overageRate: z.coerce.number().min(0),
  });

export const insertIndividualQuotaBonusSettingsSchema = createInsertSchema(
  individualQuotaBonusSettings,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    employmentType: z.enum(["full-time", "part-time"]),
    monthlyTargetHours: z.coerce.number().min(0),
    quotaBonus: z.coerce.number().min(0),
    overageRate: z.coerce.number().min(0),
  });

export const insertQuotaPeriodSchema = createInsertSchema(quotaPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  calculatedAt: true,
});

export const insertPenguinHoursTrackerSchema = createInsertSchema(
  penguinHoursTracker,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    startDate: z.union([z.date(), z.string()]).transform((val) => {
      if (typeof val === "string") return new Date(val);
      return val;
    }),
  });

export const insertForecastInvoiceSchema = createInsertSchema(
  forecastInvoices,
).omit({
  id: true,
  createdAt: true,
});

export const insertForecastExpenseSchema = createInsertSchema(
  forecastExpenses,
).omit({
  id: true,
  createdAt: true,
});

export const insertForecastPayrollMemberSchema = createInsertSchema(
  forecastPayrollMembers,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForecastScenarioSchema = createInsertSchema(
  forecastScenarios,
).omit({
  id: true,
  createdAt: true,
});

export const insertForecastRetainerSchema = createInsertSchema(
  forecastRetainers,
).omit({
  id: true,
  createdAt: true,
});

export const insertForecastAccountRevenueSchema = createInsertSchema(
  forecastAccountRevenue,
).omit({
  id: true,
  createdAt: true,
});

export const insertForecastCapacityResourceSchema = createInsertSchema(
  forecastCapacityResources,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    defaultBillableHours: z.coerce.number().min(0),
    defaultActualHours: z.coerce.number().min(0),
    defaultEfficiencyPercent: z.coerce.number().min(0).max(500).default(100),
  });

export const insertForecastCapacityAllocationSchema = createInsertSchema(
  forecastCapacityAllocations,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    monthlyBillableHours: z.coerce.number().min(0),
    resourceIds: z.array(z.string()).default([]),
  });

export const insertForecastSettingsSchema = createInsertSchema(
  forecastSettings,
).omit({
  id: true,
  updatedAt: true,
});

export const insertForecastResourceSchema = createInsertSchema(
  forecastResources,
).omit({
  id: true,
  createdAt: true,
});

export const insertResourceMonthlyCapacitySchema = createInsertSchema(
  resourceMonthlyCapacity,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccountForecastAllocationSchema = createInsertSchema(
  accountForecastAllocations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectTeamMemberSchema = createInsertSchema(
  projectTeamMembers,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserAvailabilitySchema = createInsertSchema(
  userAvailability,
).omit({
  id: true,
  createdAt: true,
});

export const insertHolidaySchema = createInsertSchema(holidays).omit({
  id: true,
  createdAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    lastEditedAt: true,
  })
  .extend({
    templateType: z.enum(["project", "retainer"]).default("project"),
    status: z.enum(["draft", "published"]).default("draft"),
  });

export const insertProposalDraftSchema = insertProposalSchema.extend({
  htmlContent: z.string().optional(),
});

export const insertProposalPublishSchema = insertProposalSchema.extend({
  htmlContent: z.string().min(1, "Content is required for published proposals"),
  status: z.literal("published"),
});

export const insertProposalScopeItemSchema = createInsertSchema(
  proposalScopeItems,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    hours: z.union([z.number(), z.string()]).transform((val) => {
      if (val === undefined || val === null || val === "") return "0";
      const num = typeof val === "number" ? val : parseFloat(val);
      return isNaN(num) ? "0" : num;
    }),
  });

export const insertKnowledgeBaseDocumentSchema = createInsertSchema(
  knowledgeBaseDocuments,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGuidanceSettingSchema = createInsertSchema(guidanceSettings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    category: z
      .enum(["scoping", "estimation", "assumptions", "general"])
      .default("general"),
  });

export const insertChatTranscriptSchema = createInsertSchema(
  chatTranscripts,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPipelineStageSchema = createInsertSchema(
  pipelineStages,
).omit({
  id: true,
  createdAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit(
  {
    id: true,
    createdAt: true,
  },
);

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
});

export const insertUatSessionSchema = createInsertSchema(uatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertUatGuestSchema = createInsertSchema(uatGuests).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

export const insertUatSessionCollaboratorSchema = createInsertSchema(
  uatSessionCollaborators,
).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

export const insertUatChecklistItemSchema = createInsertSchema(
  uatChecklistItems,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUatResponseSchema = createInsertSchema(uatResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUatItemCommentSchema = createInsertSchema(
  uatItemComments,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUatChecklistItemStepSchema = createInsertSchema(
  uatChecklistItemSteps,
).omit({
  id: true,
  createdAt: true,
});

export const insertUatTestRunSchema = createInsertSchema(uatTestRuns).omit({
  id: true,
  startedAt: true,
});

export const insertUatTestStepResultSchema = createInsertSchema(
  uatTestStepResults,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBrandingConfig = z.infer<typeof insertBrandingConfigSchema>;
export type BrandingConfig = typeof brandingConfig.$inferSelect;

export type InsertAgency = z.infer<typeof insertAgencySchema>;
export type Agency = typeof agencies.$inferSelect;

export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export type InsertAccountNote = z.infer<typeof insertAccountNoteSchema>;
export type AccountNote = typeof accountNotes.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertProjectAttachment = z.infer<
  typeof insertProjectAttachmentSchema
>;
export type ProjectAttachment = typeof projectAttachments.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskLabel = z.infer<typeof insertTaskLabelSchema>;
export type TaskLabel = typeof taskLabels.$inferSelect;

export type InsertTaskLabelAssignment = z.infer<
  typeof insertTaskLabelAssignmentSchema
>;
export type TaskLabelAssignment = typeof taskLabelAssignments.$inferSelect;

export type InsertTaskCollaborator = z.infer<
  typeof insertTaskCollaboratorSchema
>;
export type TaskCollaborator = typeof taskCollaborators.$inferSelect;

export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;
export type TimeLog = typeof timeLogs.$inferSelect;

export type InsertCalendarConnection = z.infer<
  typeof insertCalendarConnectionSchema
>;
export type CalendarConnection = typeof calendarConnections.$inferSelect;

export type InsertCalendar = z.infer<typeof insertCalendarSchema>;
export type Calendar = typeof calendars.$inferSelect;

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export type InsertSlackConfiguration = z.infer<
  typeof insertSlackConfigurationSchema
>;
export type SlackConfiguration = typeof slackConfigurations.$inferSelect;

export type InsertQuotaConfig = z.infer<typeof insertQuotaConfigSchema>;
export type QuotaConfig = typeof quotaConfigs.$inferSelect;

export type InsertResourceQuota = z.infer<typeof insertResourceQuotaSchema>;
export type ResourceQuota = typeof resourceQuotas.$inferSelect;

export type InsertPartnerBonusPolicy = z.infer<
  typeof insertPartnerBonusPolicySchema
>;
export type PartnerBonusPolicy = typeof partnerBonusPolicies.$inferSelect;

export type InsertIndividualQuotaBonusSettings = z.infer<
  typeof insertIndividualQuotaBonusSettingsSchema
>;
export type IndividualQuotaBonusSettings =
  typeof individualQuotaBonusSettings.$inferSelect;

export type InsertQuotaPeriod = z.infer<typeof insertQuotaPeriodSchema>;
export type QuotaPeriod = typeof quotaPeriods.$inferSelect;

export type InsertPenguinHoursTracker = z.infer<
  typeof insertPenguinHoursTrackerSchema
>;
export type PenguinHoursTracker = typeof penguinHoursTracker.$inferSelect;

export type InsertForecastInvoice = z.infer<typeof insertForecastInvoiceSchema>;
export type ForecastInvoice = typeof forecastInvoices.$inferSelect;

export type InsertForecastExpense = z.infer<typeof insertForecastExpenseSchema>;
export type ForecastExpense = typeof forecastExpenses.$inferSelect;

export type InsertForecastPayrollMember = z.infer<
  typeof insertForecastPayrollMemberSchema
>;
export type ForecastPayrollMember = typeof forecastPayrollMembers.$inferSelect;

export type InsertForecastScenario = z.infer<
  typeof insertForecastScenarioSchema
>;
export type ForecastScenario = typeof forecastScenarios.$inferSelect;

export type InsertForecastRetainer = z.infer<
  typeof insertForecastRetainerSchema
>;
export type ForecastRetainer = typeof forecastRetainers.$inferSelect;

export type InsertForecastAccountRevenue = z.infer<
  typeof insertForecastAccountRevenueSchema
>;
export type ForecastAccountRevenue = typeof forecastAccountRevenue.$inferSelect;

export type InsertForecastCapacityResource = z.infer<
  typeof insertForecastCapacityResourceSchema
>;
export type ForecastCapacityResource =
  typeof forecastCapacityResources.$inferSelect;

export type InsertForecastCapacityAllocation = z.infer<
  typeof insertForecastCapacityAllocationSchema
>;
export type ForecastCapacityAllocation =
  typeof forecastCapacityAllocations.$inferSelect;

export type InsertForecastSettings = z.infer<
  typeof insertForecastSettingsSchema
>;
export type ForecastSettings = typeof forecastSettings.$inferSelect;

export type InsertForecastResource = z.infer<
  typeof insertForecastResourceSchema
>;
export type ForecastResource = typeof forecastResources.$inferSelect;

export type InsertResourceMonthlyCapacity = z.infer<
  typeof insertResourceMonthlyCapacitySchema
>;
export type ResourceMonthlyCapacity =
  typeof resourceMonthlyCapacity.$inferSelect;

export type InsertAccountForecastAllocation = z.infer<
  typeof insertAccountForecastAllocationSchema
>;
export type AccountForecastAllocation =
  typeof accountForecastAllocations.$inferSelect;

export type InsertProjectTeamMember = z.infer<
  typeof insertProjectTeamMemberSchema
>;
export type ProjectTeamMember = typeof projectTeamMembers.$inferSelect;

export type InsertUserAvailability = z.infer<
  typeof insertUserAvailabilitySchema
>;
export type UserAvailability = typeof userAvailability.$inferSelect;

export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidays.$inferSelect;

export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

export type InsertProposalScopeItem = z.infer<
  typeof insertProposalScopeItemSchema
>;
export type ProposalScopeItem = typeof proposalScopeItems.$inferSelect;

export type InsertKnowledgeBaseDocument = z.infer<
  typeof insertKnowledgeBaseDocumentSchema
>;
export type KnowledgeBaseDocument = typeof knowledgeBaseDocuments.$inferSelect;

export type InsertGuidanceSetting = z.infer<typeof insertGuidanceSettingSchema>;
export type GuidanceSetting = typeof guidanceSettings.$inferSelect;

export type InsertChatTranscript = z.infer<typeof insertChatTranscriptSchema>;
export type ChatTranscript = typeof chatTranscripts.$inferSelect;

export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

export type InsertUatSession = z.infer<typeof insertUatSessionSchema>;
export type UatSession = typeof uatSessions.$inferSelect;

export type InsertUatGuest = z.infer<typeof insertUatGuestSchema>;
export type UatGuest = typeof uatGuests.$inferSelect;

export type InsertUatSessionCollaborator = z.infer<
  typeof insertUatSessionCollaboratorSchema
>;
export type UatSessionCollaborator =
  typeof uatSessionCollaborators.$inferSelect;

export type InsertUatChecklistItem = z.infer<
  typeof insertUatChecklistItemSchema
>;
export type UatChecklistItem = typeof uatChecklistItems.$inferSelect;

export type InsertUatResponse = z.infer<typeof insertUatResponseSchema>;
export type UatResponse = typeof uatResponses.$inferSelect;

export type InsertUatItemComment = z.infer<typeof insertUatItemCommentSchema>;
export type UatItemComment = typeof uatItemComments.$inferSelect;

export type InsertUatChecklistItemStep = z.infer<
  typeof insertUatChecklistItemStepSchema
>;
export type UatChecklistItemStep = typeof uatChecklistItemSteps.$inferSelect;

export type InsertUatTestRun = z.infer<typeof insertUatTestRunSchema>;
export type UatTestRun = typeof uatTestRuns.$inferSelect;

export type InsertUatTestStepResult = z.infer<
  typeof insertUatTestStepResultSchema
>;
export type UatTestStepResult = typeof uatTestStepResults.$inferSelect;

// Extended types for joins
export type AccountWithAgency = Account & { agency: Agency };
export type ProjectWithAccountAndAgency = Project & {
  account: Account;
  agency: Agency;
};
export type TaskWithRelations = Task & {
  account: Account | null;
  agency: Agency | null;
  project?: Project | null;
  assignedToUser?: User;
  labels?: TaskLabel[];
  collaborators?: User[];
};

export type ProposalWithProject = Proposal & {
  project?: Project;
};

export type ProposalWithScopeItems = Proposal & {
  scopeItems: ProposalScopeItem[];
};
export type TimeLogWithRelations = TimeLog & {
  user: User;
  agency: Agency;
  account: Account;
  project?: Project;
  task?: Task;
};

export type CalendarEventWithRelations = CalendarEvent & {
  calendar: Calendar & {
    connection: CalendarConnection & {
      user: User;
    };
  };
};

export type ProjectTeamMemberWithUser = ProjectTeamMember & {
  user: User;
};

export type ProjectWithTeamAndRelations = Project & {
  account: Account;
  agency: Agency;
  teamMembers: ProjectTeamMemberWithUser[];
};

export type UserAvailabilityWithUser = UserAvailability & {
  user: User;
};

export type LeadWithStage = Lead & {
  stage: PipelineStage;
  assignedToUser?: User;
};

export type LeadActivityWithUser = LeadActivity & {
  createdByUser?: User;
};

// UAT extended types
export type UatSessionWithRelations = UatSession & {
  project?: Project;
  account?: Account;
  createdBy: User;
  checklistItems: UatChecklistItem[];
  guests: UatGuest[];
  responses?: UatResponse[];
};

export type UatChecklistItemWithResponses = UatChecklistItem & {
  responses: UatResponse[];
};

export type UatGuestWithResponses = UatGuest & {
  responses: UatResponse[];
};

// UAT Import Schema - for bulk importing items and steps from JSON (e.g., from Cursor AI)
export const uatImportStepSchema = z.object({
  title: z.string().min(1, "Step title is required"),
  instructions: z.string().optional(),
  expectedResult: z.string().optional(),
  stepType: z.enum(["test", "delay", "info"]).default("test"),
  linkUrl: z.string().url().optional().or(z.literal("")),
  notesRequired: z.boolean().optional(),
  notesPrompt: z.string().optional(),
  order: z.number().optional(),
});

export const uatImportItemSchema = z.object({
  title: z.string().min(1, "Item title is required"),
  instructions: z.string().optional(),
  itemType: z.enum(["approval", "screenshot", "url", "text_feedback"]).default("approval"),
  internalNote: z.string().optional(),
  referenceUrl: z.string().url().optional().or(z.literal("")),
  category: z.string().optional(),
  steps: z.array(uatImportStepSchema).optional(),
});

export const uatImportSchema = z.object({
  version: z.literal("1.0").optional(),
  items: z.array(uatImportItemSchema).min(1, "At least one item is required"),
});

export type UatImportStep = z.infer<typeof uatImportStepSchema>;
export type UatImportItem = z.infer<typeof uatImportItemSchema>;
export type UatImportPayload = z.infer<typeof uatImportSchema>;

// Template for Cursor AI to generate UAT recommendations
export const UAT_IMPORT_TEMPLATE = `{
  "version": "1.0",
  "items": [
    {
      "title": "Feature or Page Name",
      "instructions": "Description of what to test",
      "itemType": "approval",
      "category": "Functionality",
      "referenceUrl": "https://example.com/page-to-test",
      "steps": [
        {
          "title": "Step 1: Navigate to the page",
          "instructions": "Open the browser and go to the page",
          "expectedResult": "Page loads without errors",
          "stepType": "test",
          "linkUrl": "https://example.com/page-to-test"
        },
        {
          "title": "Step 2: Perform action and note results",
          "instructions": "Click the button or fill the form",
          "expectedResult": "Expected behavior occurs",
          "stepType": "test",
          "notesRequired": true,
          "notesPrompt": "Note what you observed"
        }
      ]
    }
  ]
}`;

export const UAT_CURSOR_PROMPT = `You are helping create User Acceptance Testing (UAT) checklist items for a web application. Generate a JSON document following this exact schema:

\`\`\`json
${UAT_IMPORT_TEMPLATE}
\`\`\`

**Field Descriptions:**
- **items**: Array of test items/features to verify
  - **title**: Brief name of the feature or page to test
  - **instructions**: Description of what the tester should verify
  - **itemType**: "approval" (default), "screenshot", "url", or "text_feedback"
  - **category**: Optional grouping like "Functionality", "Design", "Content", "Performance"
  - **referenceUrl**: URL to the page being tested (optional)
  - **steps**: Array of test steps within this item
    - **title**: Brief step description (e.g., "Click the Submit button")
    - **instructions**: Detailed instructions for the tester
    - **expectedResult**: What success looks like
    - **stepType**: "test" (action to verify), "delay" (wait period), or "info" (informational note)
    - **linkUrl**: Optional clickable reference link for the tester
    - **notesRequired**: Boolean - set to true if tester must enter notes
    - **notesPrompt**: Custom prompt shown when notes are required (e.g., "Note which rows you selected")

**Guidelines:**
1. Create clear, actionable test steps
2. Expected results should be specific and verifiable
3. Group related tests under a single item
4. Use "delay" stepType for steps that require waiting (e.g., "Wait 5 seconds for email")
5. Use "info" stepType for informational notes that don't require action
6. Use "linkUrl" when the step involves visiting an external system (e.g., HubSpot, Stripe)
7. Use "notesRequired: true" when you need the tester to document specific findings

Analyze the provided feature/requirements and generate comprehensive UAT items with detailed test steps.`;

// ==========================================
// Training / LMS Tables
// ==========================================

// Training Programs - top-level training programs
export const trainingPrograms = pgTable("training_programs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  philosophy: text("philosophy"),
  prerequisites: text("prerequisites"),
  estimatedHours: text("estimated_hours"),
  status: text("status").notNull().default("draft"), // draft, active, archived
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTrainingProgramSchema = createInsertSchema(trainingPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TrainingProgram = typeof trainingPrograms.$inferSelect;
export type InsertTrainingProgram = z.infer<typeof insertTrainingProgramSchema>;

// Training Phases - phases within a program
export const trainingPhases = pgTable("training_phases", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  programId: varchar("program_id")
    .notNull()
    .references(() => trainingPrograms.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  estimatedHours: text("estimated_hours"),
  milestoneReview: text("milestone_review"),
  passCriteria: text("pass_criteria"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingPhaseSchema = createInsertSchema(trainingPhases).omit({
  id: true,
  createdAt: true,
});
export type TrainingPhase = typeof trainingPhases.$inferSelect;
export type InsertTrainingPhase = z.infer<typeof insertTrainingPhaseSchema>;

// Training Modules - individual modules within a phase
export const trainingModules = pgTable("training_modules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id")
    .notNull()
    .references(() => trainingPhases.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  estimatedHours: text("estimated_hours"),
  clientStory: text("client_story"),
  assignment: text("assignment"),
  testingRequirements: text("testing_requirements"),
  deliverablesAndPresentation: text("deliverables_and_presentation"),
  beReadyToAnswer: text("be_ready_to_answer"),
  resourceLinks: jsonb("resource_links").$type<{ label: string; url: string; description?: string }[]>(),
  checklist: jsonb("checklist").$type<{ id: string; text: string }[]>(),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingModuleSchema = createInsertSchema(trainingModules).omit({
  id: true,
  createdAt: true,
});
export type TrainingModule = typeof trainingModules.$inferSelect;
export type InsertTrainingModule = z.infer<typeof insertTrainingModuleSchema>;

// Training Module Sections - flexible content sections within modules
export const trainingModuleSections = pgTable("training_module_sections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id")
    .notNull()
    .references(() => trainingModules.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sectionType: text("section_type").notNull().default("content"), // content, tip, warning, example
  content: text("content"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTrainingModuleSectionSchema = createInsertSchema(trainingModuleSections).omit({
  id: true,
  createdAt: true,
});
export type TrainingModuleSection = typeof trainingModuleSections.$inferSelect;
export type InsertTrainingModuleSection = z.infer<typeof insertTrainingModuleSectionSchema>;

// Training Enrollments - links users to programs with progress tracking
export const trainingEnrollments = pgTable(
  "training_enrollments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programId: varchar("program_id")
      .notNull()
      .references(() => trainingPrograms.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("not_started"), // not_started, in_progress, completed
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueEnrollment: unique("unique_enrollment").on(table.userId, table.programId),
  }),
);

export const insertTrainingEnrollmentSchema = createInsertSchema(trainingEnrollments).omit({
  id: true,
  createdAt: true,
});
export type TrainingEnrollment = typeof trainingEnrollments.$inferSelect;
export type InsertTrainingEnrollment = z.infer<typeof insertTrainingEnrollmentSchema>;

// Training Module Submissions - per-module progress and review
export const trainingModuleSubmissions = pgTable(
  "training_module_submissions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    enrollmentId: varchar("enrollment_id")
      .notNull()
      .references(() => trainingEnrollments.id, { onDelete: "cascade" }),
    moduleId: varchar("module_id")
      .notNull()
      .references(() => trainingModules.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("not_started"), // not_started, in_progress, submitted, under_review, passed, needs_revision
    submissionNotes: text("submission_notes"),
    checklistProgress: jsonb("checklist_progress").$type<Record<string, { completed: boolean; notes: string }>>(),
    reviewerNotes: text("reviewer_notes"),
    reviewerRating: text("reviewer_rating"), // passed, needs_revision
    reviewedBy: varchar("reviewed_by").references(() => users.id),
    submittedAt: timestamp("submitted_at"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueSubmission: unique("unique_submission").on(table.enrollmentId, table.moduleId),
  }),
);

export const insertTrainingModuleSubmissionSchema = createInsertSchema(trainingModuleSubmissions).omit({
  id: true,
  createdAt: true,
});
export type TrainingModuleSubmission = typeof trainingModuleSubmissions.$inferSelect;
export type InsertTrainingModuleSubmission = z.infer<typeof insertTrainingModuleSubmissionSchema>;

// Composite types for frontend consumption
export type TrainingPhaseWithModules = TrainingPhase & {
  modules: TrainingModule[];
};

export type TrainingProgramWithPhases = TrainingProgram & {
  phases: TrainingPhaseWithModules[];
};

export type TrainingModuleWithSections = TrainingModule & {
  sections: TrainingModuleSection[];
  programId: string;
};

export type TrainingEnrollmentWithProgress = TrainingEnrollment & {
  program: TrainingProgram;
  submissions: TrainingModuleSubmission[];
  totalModules: number;
  completedModules: number;
};

