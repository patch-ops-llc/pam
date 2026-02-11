import { 
  users, agencies, accounts, accountNotes, projects, projectAttachments, tasks, taskLabels, taskLabelAssignments, taskCollaborators, timeLogs,
  calendarConnections, calendars, calendarEvents, slackConfigurations, quotaConfigs, resourceQuotas,
  partnerBonusPolicies, individualQuotaBonusSettings, quotaPeriods,
  penguinHoursTracker, forecastInvoices, forecastExpenses, forecastPayrollMembers, forecastScenarios, forecastRetainers,
  forecastAccountRevenue, forecastSettings, forecastCapacityResources, forecastCapacityAllocations, forecastResources, resourceMonthlyCapacity, accountForecastAllocations,
  projectTeamMembers, userAvailability, holidays, proposals,
  proposalScopeItems, knowledgeBaseDocuments, guidanceSettings, chatTranscripts,
  pipelineStages, leads, deals, leadActivities, brandingConfig, apiKeys,
  uatSessions, uatGuests, uatSessionCollaborators, uatChecklistItems, uatResponses, uatItemComments,
  uatChecklistItemSteps, uatTestRuns, uatTestStepResults,
  type User, type InsertUser, type BrandingConfig, type InsertBrandingConfig, type Agency, type InsertAgency,
  type Account, type InsertAccount, type AccountNote, type InsertAccountNote,
  type Project, type InsertProject,
  type ProjectAttachment, type InsertProjectAttachment,
  type Task, type InsertTask, type TaskLabel, type InsertTaskLabel,
  type TaskLabelAssignment, type InsertTaskLabelAssignment,
  type TaskCollaborator, type InsertTaskCollaborator,
  type TimeLog, type InsertTimeLog,
  type CalendarConnection, type InsertCalendarConnection,
  type Calendar, type InsertCalendar,
  type CalendarEvent, type InsertCalendarEvent,
  type SlackConfiguration, type InsertSlackConfiguration,
  type QuotaConfig, type InsertQuotaConfig,
  type ResourceQuota, type InsertResourceQuota,
  type PartnerBonusPolicy, type InsertPartnerBonusPolicy,
  type IndividualQuotaBonusSettings, type InsertIndividualQuotaBonusSettings,
  type QuotaPeriod, type InsertQuotaPeriod,
  type PenguinHoursTracker, type InsertPenguinHoursTracker,
  type ForecastInvoice, type InsertForecastInvoice,
  type ForecastExpense, type InsertForecastExpense,
  type ForecastPayrollMember, type InsertForecastPayrollMember,
  type ForecastScenario, type InsertForecastScenario,
  type ForecastRetainer, type InsertForecastRetainer,
  type ForecastAccountRevenue, type InsertForecastAccountRevenue,
  type ForecastSettings, type InsertForecastSettings,
  type ForecastCapacityResource, type InsertForecastCapacityResource,
  type ForecastCapacityAllocation, type InsertForecastCapacityAllocation,
  type ForecastResource, type InsertForecastResource,
  type ResourceMonthlyCapacity, type InsertResourceMonthlyCapacity,
  type AccountForecastAllocation, type InsertAccountForecastAllocation,
  type ProjectTeamMember, type InsertProjectTeamMember,
  type UserAvailability, type InsertUserAvailability,
  type Holiday, type InsertHoliday,
  type Proposal, type InsertProposal,
  type ProposalScopeItem, type InsertProposalScopeItem,
  type KnowledgeBaseDocument, type InsertKnowledgeBaseDocument,
  type GuidanceSetting, type InsertGuidanceSetting,
  type ChatTranscript, type InsertChatTranscript,
  type PipelineStage, type InsertPipelineStage,
  type Lead, type InsertLead, type LeadWithStage,
  type Deal, type InsertDeal,
  type LeadActivity, type InsertLeadActivity, type LeadActivityWithUser,
  type ApiKey, type InsertApiKey,
  type UatSession, type InsertUatSession, type UatSessionWithRelations,
  type UatGuest, type InsertUatGuest,
  type UatSessionCollaborator, type InsertUatSessionCollaborator,
  type UatChecklistItem, type InsertUatChecklistItem,
  type UatResponse, type InsertUatResponse,
  type UatItemComment, type InsertUatItemComment,
  type UatChecklistItemStep, type InsertUatChecklistItemStep,
  type UatTestRun, type InsertUatTestRun,
  type UatTestStepResult, type InsertUatTestStepResult,
  type AccountWithAgency, type ProjectWithAccountAndAgency, type TaskWithRelations, type TimeLogWithRelations,
  type CalendarEventWithRelations, type ProjectTeamMemberWithUser, type ProjectWithTeamAndRelations, type UserAvailabilityWithUser,
  type ProposalWithProject, type ProposalWithScopeItems,
  trainingPrograms, trainingPhases, trainingModules, trainingModuleSections, trainingEnrollments, trainingModuleSubmissions,
  type TrainingProgram, type InsertTrainingProgram,
  type TrainingPhase, type InsertTrainingPhase,
  type TrainingModule, type InsertTrainingModule,
  type TrainingModuleSection, type InsertTrainingModuleSection,
  type TrainingEnrollment, type InsertTrainingEnrollment,
  type TrainingModuleSubmission, type InsertTrainingModuleSubmission,
  type TrainingProgramWithPhases, type TrainingEnrollmentWithProgress
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, gte, lte, sql, isNull, isNotNull } from "drizzle-orm";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";

export interface IStorage {
  // Session store for authentication
  sessionStore: session.SessionStore;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  upsertUserByGoogleId(googleProfile: { googleId: string; email: string; firstName: string; lastName: string; profileImageUrl?: string }): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<Omit<InsertUser, "password">>): Promise<User>;
  getUsers(): Promise<User[]>;

  // Branding Configs
  getBrandingConfig(id: string): Promise<BrandingConfig | undefined>;
  getBrandingConfigs(): Promise<BrandingConfig[]>;
  createBrandingConfig(config: InsertBrandingConfig): Promise<BrandingConfig>;
  updateBrandingConfig(id: string, updates: Partial<InsertBrandingConfig>): Promise<BrandingConfig>;
  deleteBrandingConfig(id: string): Promise<void>;

  // Agencies
  getAgency(id: string): Promise<Agency | undefined>;
  createAgency(agency: InsertAgency): Promise<Agency>;
  getAgencies(): Promise<Agency[]>;
  updateAgency(id: string, agency: Partial<InsertAgency>): Promise<Agency>;

  // Accounts
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: InsertAccount): Promise<Account>;
  getAccounts(): Promise<Account[]>;
  getAccountsWithAgency(): Promise<AccountWithAgency[]>;
  getAccountsByAgency(agencyId: string): Promise<Account[]>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account>;
  deleteAccount(id: string): Promise<void>;

  // Account Notes
  getAccountNote(id: string): Promise<AccountNote | undefined>;
  getAccountNotesByAccount(accountId: string): Promise<AccountNote[]>;
  createAccountNote(note: InsertAccountNote): Promise<AccountNote>;
  updateAccountNote(id: string, updates: Partial<InsertAccountNote>): Promise<AccountNote>;
  deleteAccountNote(id: string): Promise<void>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject> & { deletedAt?: Date }): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  getProjects(): Promise<Project[]>;
  getProjectsWithRelations(): Promise<ProjectWithAccountAndAgency[]>;
  getProjectsByAccount(accountId: string): Promise<Project[]>;

  // Project Attachments
  getProjectAttachment(id: string): Promise<ProjectAttachment | undefined>;
  getProjectAttachmentsByProject(projectId: string): Promise<ProjectAttachment[]>;
  createProjectAttachment(attachment: InsertProjectAttachment): Promise<ProjectAttachment>;
  deleteProjectAttachment(id: string): Promise<void>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask> & { deletedAt?: Date }): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getTasks(): Promise<Task[]>;
  getTasksWithRelations(): Promise<TaskWithRelations[]>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTasksByAccount(accountId: string): Promise<Task[]>;

  // Task Labels
  getTaskLabels(): Promise<TaskLabel[]>;
  createTaskLabel(label: InsertTaskLabel): Promise<TaskLabel>;
  updateTaskLabel(id: string, updates: Partial<InsertTaskLabel>): Promise<TaskLabel>;
  deleteTaskLabel(id: string): Promise<void>;

  // Task Label Assignments
  assignLabelToTask(taskId: string, labelId: string): Promise<TaskLabelAssignment>;
  removeLabelFromTask(taskId: string, labelId: string): Promise<void>;
  getTaskLabelsByTask(taskId: string): Promise<TaskLabel[]>;

  // Task Collaborators
  addTaskCollaborator(taskId: string, userId: string): Promise<TaskCollaborator>;
  removeTaskCollaborator(taskId: string, userId: string): Promise<void>;
  getTaskCollaboratorsByTask(taskId: string): Promise<User[]>;

  // Time Logs
  getTimeLog(id: string): Promise<TimeLog | undefined>;
  createTimeLog(timeLog: InsertTimeLog): Promise<TimeLog>;
  updateTimeLog(id: string, updates: Partial<InsertTimeLog>): Promise<TimeLog>;
  deleteTimeLog(id: string): Promise<void>;
  getTimeLogs(): Promise<TimeLog[]>;
  getTimeLogsWithRelations(): Promise<TimeLogWithRelations[]>;
  getTimeLogsByUser(userId: string): Promise<TimeLog[]>;
  getTimeLogsByRange(startDate: Date, endDate: Date, userId?: string): Promise<TimeLogWithRelations[]>;
  getMonthlyTimeLogReport(year: number, month: number): Promise<Array<{
    agencyId: string;
    agencyName: string;
    accountId: string;
    accountName: string;
    projectId: string | null;
    projectName: string | null;
    tier: string;
    totalBilledHours: number;
  }>>;

  // Calendar Connections
  createCalendarConnection(connection: InsertCalendarConnection): Promise<CalendarConnection>;
  getCalendarConnectionsByUser(userId: string): Promise<CalendarConnection[]>;
  updateCalendarConnection(id: string, updates: Partial<InsertCalendarConnection>): Promise<CalendarConnection>;
  deleteCalendarConnection(id: string): Promise<void>;

  // Calendars
  createCalendar(calendar: InsertCalendar): Promise<Calendar>;
  getCalendarsByConnection(connectionId: string): Promise<Calendar[]>;
  updateCalendar(id: string, updates: Partial<InsertCalendar>): Promise<Calendar>;
  deleteCalendar(id: string): Promise<void>;

  // Calendar Events
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  getCalendarEventsByCalendar(calendarId: string): Promise<CalendarEvent[]>;
  getCalendarEventsByDateRange(startDate: Date, endDate: Date): Promise<CalendarEventWithRelations[]>;
  updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: string): Promise<void>;

  // Analytics
  getHoursByAgency(): Promise<Array<{
    type: 'agency';
    id: string;
    name: string;
    weeklyBillable: number;
    monthlyBillable: number;
    weeklyPreBilled: number;
    monthlyPreBilled: number;
    weeklyTarget: number;
    monthlyTarget: number;
    showBillable: boolean;
    showPreBilled: boolean;
    noQuota: boolean;
    isVisible: boolean;
  }>>;

  // Slack Configurations
  createSlackConfiguration(config: InsertSlackConfiguration): Promise<SlackConfiguration>;
  getSlackConfigurationById(id: string): Promise<SlackConfiguration | undefined>;
  getSlackConfigurationsByUser(userId: string): Promise<SlackConfiguration[]>;
  getSlackConfigurationsByAgency(agencyId: string): Promise<SlackConfiguration[]>;
  getSlackConfigurationsByAccount(accountId: string): Promise<SlackConfiguration[]>;
  getSlackConfigurations(): Promise<SlackConfiguration[]>;
  updateSlackConfiguration(id: string, updates: Partial<InsertSlackConfiguration>): Promise<SlackConfiguration>;
  deleteSlackConfiguration(id: string): Promise<void>;
  getActiveSlackConfigurationsForEvent(eventType: string, agencyId?: string, accountId?: string): Promise<SlackConfiguration[]>;

  // Quota Configurations
  createQuotaConfig(config: InsertQuotaConfig): Promise<QuotaConfig>;
  getQuotaConfigByAgency(agencyId: string): Promise<QuotaConfig | undefined>;
  getAllQuotaConfigs(): Promise<QuotaConfig[]>;
  updateQuotaConfig(id: string, updates: Partial<InsertQuotaConfig>): Promise<QuotaConfig>;
  upsertQuotaConfig(agencyId: string, config: Partial<InsertQuotaConfig>): Promise<QuotaConfig>;
  deleteQuotaConfig(id: string): Promise<void>;

  // Resource Quotas
  getAllResourceQuotas(): Promise<ResourceQuota[]>;
  createResourceQuota(quota: InsertResourceQuota): Promise<ResourceQuota>;
  updateResourceQuota(id: string, updates: Partial<InsertResourceQuota>): Promise<ResourceQuota>;
  deleteResourceQuota(id: string): Promise<void>;

  // Partner Bonus Policies
  getPartnerBonusPolicies(): Promise<PartnerBonusPolicy[]>;
  getPartnerBonusPolicyByAgency(agencyId: string): Promise<PartnerBonusPolicy | undefined>;
  createPartnerBonusPolicy(policy: InsertPartnerBonusPolicy): Promise<PartnerBonusPolicy>;
  updatePartnerBonusPolicy(id: string, updates: Partial<InsertPartnerBonusPolicy>): Promise<PartnerBonusPolicy>;
  deletePartnerBonusPolicy(id: string): Promise<void>;

  // Individual Quota Bonus Settings
  getIndividualQuotaBonusSettings(): Promise<IndividualQuotaBonusSettings[]>;
  getIndividualQuotaBonusByType(employmentType: string): Promise<IndividualQuotaBonusSettings | undefined>;
  updateIndividualQuotaBonusSettings(id: string, updates: Partial<InsertIndividualQuotaBonusSettings>): Promise<IndividualQuotaBonusSettings>;

  // Quota Periods
  getQuotaPeriods(): Promise<QuotaPeriod[]>;
  getQuotaPeriodByMonth(yearMonth: string): Promise<QuotaPeriod | undefined>;
  createQuotaPeriod(period: InsertQuotaPeriod): Promise<QuotaPeriod>;
  updateQuotaPeriod(id: string, updates: Partial<InsertQuotaPeriod>): Promise<QuotaPeriod>;

  // Quota Tracking
  getResourceQuotaTracker(month: string): Promise<Array<{
    user: User;
    monthlyTarget: number;
    adjustedTarget: number;
    expectedHours: number;
    billedHours: number;
    percentageComplete: number;
  }>>;
  getClientQuotaTracker(month: string): Promise<Array<{
    agency: Agency;
    monthlyTarget: number;
    actualHours: number;
    expectedHours: number;
    percentageComplete: number;
  }>>;

  // Analytics
  getHoursSummaryByWeek(startDate: Date, endDate: Date): Promise<{ date: string; actualHours: number; billedHours: number }[]>;
  getHoursSummaryByMonth(startDate: Date, endDate: Date): Promise<{ month: string; actualHours: number; billedHours: number }[]>;
  getTargetProgressByAgency(): Promise<{ agency: Agency; weeklyActual: number; monthlyActual: number; weeklyBillable: number; monthlyBillable: number; weeklyPreBilled: number; monthlyPreBilled: number; weeklyTarget: number; monthlyTarget: number; showBillable: boolean; showPreBilled: boolean; noQuota: boolean }[]>;
  getEfficiencyRatesByAccount(): Promise<{ account: Account; agency: Agency; actualHours: number; billedHours: number; efficiency: number }[]>;
  getEfficiencyRatesByAgency(): Promise<{ agency: Agency; actualHours: number; billedHours: number; efficiency: number }[]>;
  getWeeklyBonusEligibility(): Promise<Array<{
    agency: Agency;
    monthlyTarget: number;
    weeks: Array<{
      weekNumber: number;
      startDate: Date;
      endDate: Date;
      billedHours: number;
      weeklyTarget: number;
      hitTarget: boolean;
    }>;
    weeksHit: number;
    totalWeeks: number;
    eligibleForBonus: boolean;
  }>>;

  // Penguin Hours Tracker
  getPenguinHoursTracker(agencyId: string): Promise<PenguinHoursTracker | undefined>;
  createPenguinHoursTracker(tracker: InsertPenguinHoursTracker): Promise<PenguinHoursTracker>;
  resetPenguinHoursTracker(agencyId: string): Promise<PenguinHoursTracker>;
  getPenguinHoursUsed(agencyId: string, startDate: Date): Promise<number>;

  // Forecasting - Invoices
  createForecastInvoice(invoice: InsertForecastInvoice): Promise<ForecastInvoice>;
  getForecastInvoices(): Promise<ForecastInvoice[]>;
  updateForecastInvoice(id: string, updates: Partial<InsertForecastInvoice>): Promise<ForecastInvoice>;
  deleteForecastInvoice(id: string): Promise<void>;

  // Forecasting - Expenses
  createForecastExpense(expense: InsertForecastExpense): Promise<ForecastExpense>;
  getForecastExpenses(): Promise<ForecastExpense[]>;
  updateForecastExpense(id: string, updates: Partial<InsertForecastExpense>): Promise<ForecastExpense>;
  deleteForecastExpense(id: string): Promise<void>;

  // Forecasting - Payroll Members
  createForecastPayrollMember(member: InsertForecastPayrollMember): Promise<ForecastPayrollMember>;
  getForecastPayrollMembers(): Promise<ForecastPayrollMember[]>;
  updateForecastPayrollMember(id: string, updates: Partial<InsertForecastPayrollMember>): Promise<ForecastPayrollMember>;
  deleteForecastPayrollMember(id: string): Promise<void>;

  // Forecasting - Scenarios
  createForecastScenario(scenario: InsertForecastScenario): Promise<ForecastScenario>;
  getForecastScenarios(): Promise<ForecastScenario[]>;
  updateForecastScenario(id: string, updates: Partial<InsertForecastScenario>): Promise<ForecastScenario>;
  deleteForecastScenario(id: string): Promise<void>;

  // Forecasting - Retainers
  createForecastRetainer(retainer: InsertForecastRetainer): Promise<ForecastRetainer>;
  getForecastRetainers(): Promise<ForecastRetainer[]>;
  updateForecastRetainer(id: string, updates: Partial<InsertForecastRetainer>): Promise<ForecastRetainer>;
  deleteForecastRetainer(id: string): Promise<void>;

  // Forecasting - Account Revenue (projected monthly fixed-fee revenue)
  createForecastAccountRevenue(revenue: InsertForecastAccountRevenue): Promise<ForecastAccountRevenue>;
  getForecastAccountRevenue(): Promise<ForecastAccountRevenue[]>;
  updateForecastAccountRevenue(id: string, updates: Partial<InsertForecastAccountRevenue>): Promise<ForecastAccountRevenue>;
  deleteForecastAccountRevenue(id: string): Promise<void>;

  // Forecasting - Settings
  getForecastSettings(): Promise<ForecastSettings | null>;
  upsertForecastSettings(settings: InsertForecastSettings): Promise<ForecastSettings>;

  // Forecasting - Capacity Resources
  createForecastCapacityResource(resource: InsertForecastCapacityResource): Promise<ForecastCapacityResource>;
  getForecastCapacityResources(): Promise<ForecastCapacityResource[]>;
  updateForecastCapacityResource(id: string, updates: Partial<InsertForecastCapacityResource>): Promise<ForecastCapacityResource>;
  deleteForecastCapacityResource(id: string): Promise<void>;

  // Forecasting - Capacity Allocations
  createForecastCapacityAllocation(allocation: InsertForecastCapacityAllocation): Promise<ForecastCapacityAllocation>;
  getForecastCapacityAllocations(): Promise<ForecastCapacityAllocation[]>;
  updateForecastCapacityAllocation(id: string, updates: Partial<InsertForecastCapacityAllocation>): Promise<ForecastCapacityAllocation>;
  deleteForecastCapacityAllocation(id: string): Promise<void>;

  // Forecasting - Resources (capacity planning)
  createForecastResource(resource: InsertForecastResource): Promise<ForecastResource>;
  getForecastResources(): Promise<ForecastResource[]>;
  updateForecastResource(id: string, updates: Partial<InsertForecastResource>): Promise<ForecastResource>;
  deleteForecastResource(id: string): Promise<void>;

  // Forecasting - Resource Monthly Capacity
  upsertResourceMonthlyCapacity(capacity: InsertResourceMonthlyCapacity): Promise<ResourceMonthlyCapacity>;
  getResourceMonthlyCapacity(resourceId: string, month: string): Promise<ResourceMonthlyCapacity | undefined>;
  getResourceMonthlyCapacityByMonth(month: string): Promise<ResourceMonthlyCapacity[]>;
  getAllResourceMonthlyCapacity(): Promise<ResourceMonthlyCapacity[]>;
  deleteResourceMonthlyCapacity(id: string): Promise<void>;

  // Forecasting - Account Allocations
  createAccountForecastAllocation(allocation: InsertAccountForecastAllocation): Promise<AccountForecastAllocation>;
  getAccountForecastAllocations(): Promise<AccountForecastAllocation[]>;
  getAccountForecastAllocationsByMonth(month: string): Promise<AccountForecastAllocation[]>;
  getAccountForecastAllocationsByResource(resourceId: string): Promise<AccountForecastAllocation[]>;
  updateAccountForecastAllocation(id: string, updates: Partial<InsertAccountForecastAllocation>): Promise<AccountForecastAllocation>;
  deleteAccountForecastAllocation(id: string): Promise<void>;

  // Project Team Members
  createProjectTeamMember(member: InsertProjectTeamMember): Promise<ProjectTeamMember>;
  getProjectTeamMembers(projectId: string): Promise<ProjectTeamMemberWithUser[]>;
  getProjectTeamMembersByUser(userId: string): Promise<ProjectTeamMemberWithUser[]>;
  updateProjectTeamMember(id: string, updates: Partial<InsertProjectTeamMember>): Promise<ProjectTeamMember>;
  deleteProjectTeamMember(id: string): Promise<void>;
  getProjectsWithTeam(): Promise<ProjectWithTeamAndRelations[]>;

  // User Availability
  createUserAvailability(availability: InsertUserAvailability): Promise<UserAvailability>;
  getUserAvailability(userId: string): Promise<UserAvailabilityWithUser[]>;
  getAllUserAvailability(): Promise<UserAvailabilityWithUser[]>;
  getUserAvailabilityByDateRange(startDate: Date, endDate: Date): Promise<UserAvailabilityWithUser[]>;
  updateUserAvailability(id: string, updates: Partial<InsertUserAvailability>): Promise<UserAvailability>;
  deleteUserAvailability(id: string): Promise<void>;

  // Company Holidays
  createHoliday(holiday: InsertHoliday): Promise<Holiday>;
  getHolidays(): Promise<Holiday[]>;
  getHolidaysByDateRange(startDate: Date, endDate: Date): Promise<Holiday[]>;
  updateHoliday(id: string, updates: Partial<InsertHoliday>): Promise<Holiday>;
  deleteHoliday(id: string): Promise<void>;

  // Proposals
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  getProposal(id: string): Promise<Proposal | undefined>;
  getProposalBySlug(slug: string): Promise<ProposalWithProject | undefined>;
  getProposals(): Promise<ProposalWithProject[]>;
  updateProposal(id: string, updates: Partial<InsertProposal>): Promise<Proposal>;
  deleteProposal(id: string): Promise<void>;
  getProposalWithScopeItems(id: string): Promise<ProposalWithScopeItems | undefined>;

  // Proposal Scope Items
  createProposalScopeItem(item: InsertProposalScopeItem): Promise<ProposalScopeItem>;
  getProposalScopeItem(id: string): Promise<ProposalScopeItem | undefined>;
  getProposalScopeItemsByProposal(proposalId: string): Promise<ProposalScopeItem[]>;
  updateProposalScopeItem(id: string, updates: Partial<InsertProposalScopeItem>): Promise<ProposalScopeItem>;
  deleteProposalScopeItem(id: string): Promise<void>;
  bulkCreateProposalScopeItems(items: InsertProposalScopeItem[]): Promise<ProposalScopeItem[]>;
  deleteProposalScopeItemsByProposal(proposalId: string): Promise<void>;

  // Knowledge Base Documents
  createKnowledgeBaseDocument(doc: InsertKnowledgeBaseDocument): Promise<KnowledgeBaseDocument>;
  getKnowledgeBaseDocument(id: string): Promise<KnowledgeBaseDocument | undefined>;
  getKnowledgeBaseDocuments(): Promise<KnowledgeBaseDocument[]>;
  updateKnowledgeBaseDocument(id: string, updates: Partial<InsertKnowledgeBaseDocument>): Promise<KnowledgeBaseDocument>;
  deleteKnowledgeBaseDocument(id: string): Promise<void>;

  // Guidance Settings
  createGuidanceSetting(setting: InsertGuidanceSetting): Promise<GuidanceSetting>;
  getGuidanceSetting(id: string): Promise<GuidanceSetting | undefined>;
  getGuidanceSettings(): Promise<GuidanceSetting[]>;
  getGuidanceSettingsByCategory(category: string): Promise<GuidanceSetting[]>;
  updateGuidanceSetting(id: string, updates: Partial<InsertGuidanceSetting>): Promise<GuidanceSetting>;
  deleteGuidanceSetting(id: string): Promise<void>;

  // Chat Transcripts
  createChatTranscript(transcript: InsertChatTranscript): Promise<ChatTranscript>;
  getChatTranscript(id: string): Promise<ChatTranscript | undefined>;
  getChatTranscripts(): Promise<ChatTranscript[]>;
  updateChatTranscript(id: string, updates: Partial<InsertChatTranscript>): Promise<ChatTranscript>;
  deleteChatTranscript(id: string): Promise<void>;

  // Pipeline Stages
  getPipelineStages(): Promise<PipelineStage[]>;
  getPipelineStagesByType(type: string): Promise<PipelineStage[]>;
  createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage>;
  updatePipelineStage(id: string, updates: Partial<InsertPipelineStage>): Promise<PipelineStage>;
  deletePipelineStage(id: string): Promise<void>;

  // Leads
  getLeads(): Promise<Lead[]>;
  getLeadsWithStage(): Promise<LeadWithStage[]>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadWithStage(id: string): Promise<LeadWithStage | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: string): Promise<void>;

  // Lead Activities
  getLeadActivities(leadId: string): Promise<LeadActivityWithUser[]>;
  createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity>;
  deleteLeadActivity(id: string): Promise<void>;

  // Deals
  getDeals(): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;

  // API Keys
  getApiKeysByUser(userId: string): Promise<ApiKey[]>;
  getApiKeyById(id: string): Promise<ApiKey | undefined>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  revokeApiKey(id: string): Promise<void>;
  deleteApiKey(id: string): Promise<void>;
  validateApiKey(keyPrefix: string, hashedKey: string): Promise<{ apiKey: ApiKey; user: User } | undefined>;

  // UAT Sessions
  getUatSessions(): Promise<UatSession[]>;
  getUatSession(id: string): Promise<UatSession | undefined>;
  getUatSessionByInviteToken(token: string): Promise<UatSession | undefined>;
  getUatSessionWithRelations(id: string): Promise<UatSessionWithRelations | undefined>;
  createUatSession(session: InsertUatSession): Promise<UatSession>;
  updateUatSession(id: string, updates: Partial<InsertUatSession>): Promise<UatSession>;
  deleteUatSession(id: string): Promise<void>;

  // UAT Guests
  getUatGuests(sessionId: string): Promise<UatGuest[]>;
  getUatGuest(id: string): Promise<UatGuest | undefined>;
  getUatGuestByAccessToken(token: string): Promise<UatGuest | undefined>;
  createUatGuest(guest: InsertUatGuest): Promise<UatGuest>;
  updateUatGuestLastAccessed(id: string): Promise<void>;
  deleteUatGuest(id: string): Promise<void>;

  // UAT Session Collaborators
  getUatSessionCollaborators(sessionId: string): Promise<UatSessionCollaborator[]>;
  getUatSessionCollaboratorByToken(token: string): Promise<UatSessionCollaborator | undefined>;
  createUatSessionCollaborator(collaborator: InsertUatSessionCollaborator): Promise<UatSessionCollaborator>;
  updateUatSessionCollaboratorLastAccessed(id: string): Promise<void>;
  deleteUatSessionCollaborator(id: string): Promise<void>;

  // UAT Checklist Items
  getUatChecklistItems(sessionId: string): Promise<UatChecklistItem[]>;
  getUatChecklistItem(id: string): Promise<UatChecklistItem | undefined>;
  createUatChecklistItem(item: InsertUatChecklistItem): Promise<UatChecklistItem>;
  updateUatChecklistItem(id: string, updates: Partial<InsertUatChecklistItem>): Promise<UatChecklistItem>;
  deleteUatChecklistItem(id: string): Promise<void>;
  reorderUatChecklistItems(sessionId: string, itemIds: string[]): Promise<void>;

  // UAT Responses
  getUatResponses(checklistItemId: string): Promise<UatResponse[]>;
  getUatResponsesByGuest(guestId: string): Promise<UatResponse[]>;
  getUatResponsesBySession(sessionId: string): Promise<UatResponse[]>;
  getUatResponse(checklistItemId: string, guestId: string): Promise<UatResponse | undefined>;
  createUatResponse(response: InsertUatResponse): Promise<UatResponse>;
  updateUatResponse(id: string, updates: Partial<InsertUatResponse>): Promise<UatResponse>;
  
  // UAT Item Comments
  getUatItemComments(itemId: string): Promise<UatItemComment[]>;
  getUatItemComment(id: string): Promise<UatItemComment | undefined>;
  createUatItemComment(comment: InsertUatItemComment): Promise<UatItemComment>;
  updateUatItemComment(id: string, updates: Partial<InsertUatItemComment>): Promise<UatItemComment>;
  deleteUatItemComment(id: string): Promise<void>;
  
  // UAT Checklist Item Steps
  getUatChecklistItemSteps(itemId: string): Promise<UatChecklistItemStep[]>;
  getUatChecklistItemStep(id: string): Promise<UatChecklistItemStep | undefined>;
  createUatChecklistItemStep(step: InsertUatChecklistItemStep): Promise<UatChecklistItemStep>;
  updateUatChecklistItemStep(id: string, updates: Partial<InsertUatChecklistItemStep>): Promise<UatChecklistItemStep>;
  deleteUatChecklistItemStep(id: string): Promise<void>;
  reorderUatChecklistItemSteps(itemId: string, stepIds: string[]): Promise<void>;
  
  // UAT Test Runs
  getUatTestRun(id: string): Promise<UatTestRun | undefined>;
  getUatTestRuns(itemId: string): Promise<UatTestRun[]>;
  getActiveUatTestRun(itemId: string): Promise<UatTestRun | undefined>;
  createUatTestRun(run: InsertUatTestRun): Promise<UatTestRun>;
  updateUatTestRun(id: string, updates: Partial<InsertUatTestRun>): Promise<UatTestRun>;
  createNewTestRunForRetest(itemId: string, triggeredById?: string): Promise<UatTestRun>;
  
  // UAT Test Step Results
  getUatTestStepResults(runId: string): Promise<UatTestStepResult[]>;
  updateUatTestStepResult(runId: string, stepId: string, updates: Partial<InsertUatTestStepResult>): Promise<UatTestStepResult>;

  // Training Programs
  getTrainingPrograms(): Promise<TrainingProgram[]>;
  getTrainingProgram(id: string): Promise<TrainingProgram | undefined>;
  getTrainingProgramWithPhases(id: string): Promise<TrainingProgramWithPhases | undefined>;
  createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram>;
  updateTrainingProgram(id: string, updates: Partial<InsertTrainingProgram>): Promise<TrainingProgram>;
  deleteTrainingProgram(id: string): Promise<void>;

  // Training Phases
  getTrainingPhases(programId: string): Promise<TrainingPhase[]>;
  getTrainingPhase(id: string): Promise<TrainingPhase | undefined>;
  createTrainingPhase(phase: InsertTrainingPhase): Promise<TrainingPhase>;
  updateTrainingPhase(id: string, updates: Partial<InsertTrainingPhase>): Promise<TrainingPhase>;
  deleteTrainingPhase(id: string): Promise<void>;

  // Training Modules
  getTrainingModules(phaseId: string): Promise<TrainingModule[]>;
  getTrainingModule(id: string): Promise<TrainingModule | undefined>;
  createTrainingModule(module: InsertTrainingModule): Promise<TrainingModule>;
  updateTrainingModule(id: string, updates: Partial<InsertTrainingModule>): Promise<TrainingModule>;
  deleteTrainingModule(id: string): Promise<void>;

  // Training Module Sections
  getTrainingModuleSections(moduleId: string): Promise<TrainingModuleSection[]>;
  createTrainingModuleSection(section: InsertTrainingModuleSection): Promise<TrainingModuleSection>;
  updateTrainingModuleSection(id: string, updates: Partial<InsertTrainingModuleSection>): Promise<TrainingModuleSection>;
  deleteTrainingModuleSection(id: string): Promise<void>;

  // Training Enrollments
  getTrainingEnrollments(userId: string): Promise<TrainingEnrollmentWithProgress[]>;
  getTrainingEnrollmentsByProgram(programId: string): Promise<(TrainingEnrollmentWithProgress & { user: User })[]>;
  getTrainingEnrollment(id: string): Promise<TrainingEnrollment | undefined>;
  getTrainingEnrollmentByUserAndProgram(userId: string, programId: string): Promise<TrainingEnrollment | undefined>;
  createTrainingEnrollment(enrollment: InsertTrainingEnrollment): Promise<TrainingEnrollment>;
  updateTrainingEnrollment(id: string, updates: Partial<InsertTrainingEnrollment>): Promise<TrainingEnrollment>;
  deleteTrainingEnrollment(id: string): Promise<void>;

  // Training Module Submissions
  getTrainingModuleSubmissions(enrollmentId: string): Promise<TrainingModuleSubmission[]>;
  getTrainingModuleSubmission(enrollmentId: string, moduleId: string): Promise<TrainingModuleSubmission | undefined>;
  createTrainingModuleSubmission(submission: InsertTrainingModuleSubmission): Promise<TrainingModuleSubmission>;
  updateTrainingModuleSubmission(id: string, updates: Partial<InsertTrainingModuleSubmission>): Promise<TrainingModuleSubmission>;
  getAllPendingReviews(): Promise<(TrainingModuleSubmission & { module: TrainingModule; enrollment: TrainingEnrollment; user: User })[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    // Set up PostgreSQL session store using the existing database connection
    const PostgresSessionStore = ConnectPgSimple(session);
    this.sessionStore = new PostgresSessionStore({ 
      pool: pool,
      createTableIfMissing: true 
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async upsertUserByGoogleId(googleProfile: { googleId: string; email: string; firstName: string; lastName: string; profileImageUrl?: string }): Promise<User> {
    // Check if user exists by Google ID
    let existingUser = await this.getUserByGoogleId(googleProfile.googleId);
    
    if (existingUser) {
      // Update existing user's profile picture if changed
      if (googleProfile.profileImageUrl && existingUser.profileImageUrl !== googleProfile.profileImageUrl) {
        const [updated] = await db
          .update(users)
          .set({ profileImageUrl: googleProfile.profileImageUrl })
          .where(eq(users.id, existingUser.id))
          .returning();
        return updated;
      }
      return existingUser;
    }

    // Check if user exists by email (linking accounts)
    existingUser = await this.getUserByEmail(googleProfile.email);
    
    if (existingUser) {
      // Link Google ID to existing email account
      const [updated] = await db
        .update(users)
        .set({ 
          googleId: googleProfile.googleId,
          profileImageUrl: googleProfile.profileImageUrl 
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated;
    }

    // Create new user with Google ID - generate a random hashed password
    const { randomBytes, scrypt } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    const randomPassword = randomBytes(32).toString("hex");
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(randomPassword, salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;
    
    const username = googleProfile.email.split('@')[0] + '_' + Date.now();
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        email: googleProfile.email,
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        password: hashedPassword, // Properly hashed random password
        googleId: googleProfile.googleId,
        profileImageUrl: googleProfile.profileImageUrl,
        role: 'user',
        isActive: true,
      })
      .returning();
    return newUser;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<Omit<InsertUser, "password">>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Branding Configs
  async getBrandingConfig(id: string): Promise<BrandingConfig | undefined> {
    const [config] = await db.select().from(brandingConfig).where(eq(brandingConfig.id, id));
    return config || undefined;
  }

  async getBrandingConfigs(): Promise<BrandingConfig[]> {
    return await db.select().from(brandingConfig);
  }

  async createBrandingConfig(insertConfig: InsertBrandingConfig): Promise<BrandingConfig> {
    const [config] = await db
      .insert(brandingConfig)
      .values(insertConfig)
      .returning();
    return config;
  }

  async updateBrandingConfig(id: string, updates: Partial<InsertBrandingConfig>): Promise<BrandingConfig> {
    const [config] = await db
      .update(brandingConfig)
      .set(updates)
      .where(eq(brandingConfig.id, id))
      .returning();
    return config;
  }

  async deleteBrandingConfig(id: string): Promise<void> {
    await db.delete(brandingConfig).where(eq(brandingConfig.id, id));
  }

  // Agencies
  async getAgency(id: string): Promise<Agency | undefined> {
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
    return agency || undefined;
  }

  async createAgency(insertAgency: InsertAgency): Promise<Agency> {
    const [agency] = await db
      .insert(agencies)
      .values(insertAgency)
      .returning();
    return agency;
  }

  async getAgencies(): Promise<Agency[]> {
    return await db.select().from(agencies).where(eq(agencies.isActive, true));
  }

  async updateAgency(id: string, updateData: Partial<InsertAgency>): Promise<Agency> {
    const [agency] = await db
      .update(agencies)
      .set(updateData)
      .where(eq(agencies.id, id))
      .returning();
    return agency;
  }

  async deleteAgency(id: string): Promise<void> {
    await db.delete(agencies).where(eq(agencies.id, id));
  }

  // Accounts
  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account || undefined;
  }

  async createAccount(insertAccount: InsertAccount): Promise<Account> {
    const [account] = await db
      .insert(accounts)
      .values(insertAccount)
      .returning();
    return account;
  }

  async getAccounts(): Promise<Account[]> {
    return await db.select().from(accounts).where(eq(accounts.isActive, true));
  }

  async getAccountsWithAgency(): Promise<AccountWithAgency[]> {
    return await db
      .select({
        id: accounts.id,
        agencyId: accounts.agencyId,
        name: accounts.name,
        description: accounts.description,
        contactEmail: accounts.contactEmail,
        contactPhone: accounts.contactPhone,
        richTextContent: accounts.richTextContent,
        isActive: accounts.isActive,
        createdAt: accounts.createdAt,
        agency: {
          id: agencies.id,
          name: agencies.name,
          description: agencies.description,
          monthlyBillingTarget: agencies.monthlyBillingTarget,
          contactEmail: agencies.contactEmail,
          contactPhone: agencies.contactPhone,
          isActive: agencies.isActive,
          createdAt: agencies.createdAt,
        }
      })
      .from(accounts)
      .innerJoin(agencies, eq(accounts.agencyId, agencies.id))
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.createdAt);
  }

  async getAccountsByAgency(agencyId: string): Promise<Account[]> {
    return await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.agencyId, agencyId), eq(accounts.isActive, true)));
  }

  async updateAccount(id: string, updateData: Partial<InsertAccount>): Promise<Account> {
    const [account] = await db
      .update(accounts)
      .set(updateData)
      .where(eq(accounts.id, id))
      .returning();
    return account;
  }

  async deleteAccount(id: string): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  }

  // Account Notes
  async getAccountNote(id: string): Promise<AccountNote | undefined> {
    const [note] = await db.select().from(accountNotes).where(eq(accountNotes.id, id));
    return note || undefined;
  }

  async getAccountNotesByAccount(accountId: string): Promise<AccountNote[]> {
    return await db
      .select()
      .from(accountNotes)
      .where(eq(accountNotes.accountId, accountId))
      .orderBy(accountNotes.order);
  }

  async createAccountNote(insertNote: InsertAccountNote): Promise<AccountNote> {
    const [note] = await db
      .insert(accountNotes)
      .values(insertNote)
      .returning();
    return note;
  }

  async updateAccountNote(id: string, updates: Partial<InsertAccountNote>): Promise<AccountNote> {
    const [note] = await db
      .update(accountNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(accountNotes.id, id))
      .returning();
    return note;
  }

  async deleteAccountNote(id: string): Promise<void> {
    await db.delete(accountNotes).where(eq(accountNotes.id, id));
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    // Soft delete: set deletedAt timestamp instead of hard delete
    await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, id));
  }

  async hardDeleteProject(id: string): Promise<void> {
    // Hard delete: permanently remove project from database
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).where(and(eq(projects.isActive, true), isNull(projects.deletedAt)));
  }

  async getProjectsWithRelations(): Promise<ProjectWithAccountAndAgency[]> {
    return await db
      .select({
        id: projects.id,
        agencyId: projects.agencyId,
        accountId: projects.accountId,
        name: projects.name,
        description: projects.description,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        estimatedHours: projects.estimatedHours,
        fixedFee: projects.fixedFee,
        isActive: projects.isActive,
        createdAt: projects.createdAt,
        account: {
          id: accounts.id,
          agencyId: accounts.agencyId,
          name: accounts.name,
          description: accounts.description,
          contactEmail: accounts.contactEmail,
          contactPhone: accounts.contactPhone,
          isActive: accounts.isActive,
          createdAt: accounts.createdAt,
        },
        agency: {
          id: agencies.id,
          name: agencies.name,
          description: agencies.description,
          monthlyBillingTarget: agencies.monthlyBillingTarget,
          contactEmail: agencies.contactEmail,
          contactPhone: agencies.contactPhone,
          isActive: agencies.isActive,
          createdAt: agencies.createdAt,
        }
      })
      .from(projects)
      .innerJoin(accounts, eq(projects.accountId, accounts.id))
      .innerJoin(agencies, eq(projects.agencyId, agencies.id))
      .where(and(eq(projects.isActive, true), isNull(projects.deletedAt)));
  }

  async getProjectsByAccount(accountId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(and(eq(projects.accountId, accountId), eq(projects.isActive, true), isNull(projects.deletedAt)));
  }

  // Project Attachments
  async getProjectAttachment(id: string): Promise<ProjectAttachment | undefined> {
    const [attachment] = await db.select().from(projectAttachments).where(eq(projectAttachments.id, id));
    return attachment || undefined;
  }

  async getProjectAttachmentsByProject(projectId: string): Promise<ProjectAttachment[]> {
    return await db
      .select()
      .from(projectAttachments)
      .where(eq(projectAttachments.projectId, projectId))
      .orderBy(desc(projectAttachments.createdAt));
  }

  async createProjectAttachment(attachment: InsertProjectAttachment): Promise<ProjectAttachment> {
    const [newAttachment] = await db
      .insert(projectAttachments)
      .values(attachment)
      .returning();
    return newAttachment;
  }

  async deleteProjectAttachment(id: string): Promise<void> {
    await db.delete(projectAttachments).where(eq(projectAttachments.id, id));
  }

  // Tasks
  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(and(eq(tasks.isActive, true), isNull(tasks.deletedAt)));
  }

  async getTasksWithRelations(): Promise<TaskWithRelations[]> {
    const rows = await db
      .select({
        id: tasks.id,
        agencyId: tasks.agencyId,
        accountId: tasks.accountId,
        projectId: tasks.projectId,
        name: tasks.name,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        category: tasks.category,
        size: tasks.size,
        notes: tasks.notes,
        billingType: tasks.billingType,
        estimatedHours: tasks.estimatedHours,
        startDate: tasks.startDate,
        dueDate: tasks.dueDate,
        assignedToUserId: tasks.assignedToUserId,
        isActive: tasks.isActive,
        createdAt: tasks.createdAt,
        account: {
          id: accounts.id,
          agencyId: accounts.agencyId,
          name: accounts.name,
          description: accounts.description,
          contactEmail: accounts.contactEmail,
          contactPhone: accounts.contactPhone,
          isActive: accounts.isActive,
          createdAt: accounts.createdAt,
        },
        agency: {
          id: agencies.id,
          name: agencies.name,
          description: agencies.description,
          monthlyBillingTarget: agencies.monthlyBillingTarget,
          contactEmail: agencies.contactEmail,
          contactPhone: agencies.contactPhone,
          isActive: agencies.isActive,
          createdAt: agencies.createdAt,
        },
        project: projects || undefined
      })
      .from(tasks)
      .leftJoin(accounts, eq(tasks.accountId, accounts.id))
      .leftJoin(agencies, eq(tasks.agencyId, agencies.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(tasks.isActive, true), isNull(tasks.deletedAt)));

    // Normalize null joins (tasks without agency/account) to undefined for type consistency
    return rows.map((row) => ({
      ...row,
      account: row.account?.id ? row.account : null,
      agency: row.agency?.id ? row.agency : null,
    })) as TaskWithRelations[];
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.isActive, true), isNull(tasks.deletedAt)));
  }

  async getTasksByAccount(accountId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.accountId, accountId), eq(tasks.isActive, true), isNull(tasks.deletedAt)));
  }

  // Task Labels
  async getTaskLabels(): Promise<TaskLabel[]> {
    return await db.select().from(taskLabels);
  }

  async createTaskLabel(label: InsertTaskLabel): Promise<TaskLabel> {
    const [newLabel] = await db.insert(taskLabels).values(label).returning();
    return newLabel;
  }

  async updateTaskLabel(id: string, updates: Partial<InsertTaskLabel>): Promise<TaskLabel> {
    const [label] = await db
      .update(taskLabels)
      .set(updates)
      .where(eq(taskLabels.id, id))
      .returning();
    return label;
  }

  async deleteTaskLabel(id: string): Promise<void> {
    await db.delete(taskLabels).where(eq(taskLabels.id, id));
  }

  // Task Label Assignments
  async assignLabelToTask(taskId: string, labelId: string): Promise<TaskLabelAssignment> {
    const [assignment] = await db
      .insert(taskLabelAssignments)
      .values({ taskId, labelId })
      .onConflictDoNothing()
      .returning();
    return assignment;
  }

  async removeLabelFromTask(taskId: string, labelId: string): Promise<void> {
    await db
      .delete(taskLabelAssignments)
      .where(and(eq(taskLabelAssignments.taskId, taskId), eq(taskLabelAssignments.labelId, labelId)));
  }

  async getTaskLabelsByTask(taskId: string): Promise<TaskLabel[]> {
    const result = await db
      .select({
        id: taskLabels.id,
        name: taskLabels.name,
        color: taskLabels.color,
        createdAt: taskLabels.createdAt,
      })
      .from(taskLabelAssignments)
      .innerJoin(taskLabels, eq(taskLabelAssignments.labelId, taskLabels.id))
      .where(eq(taskLabelAssignments.taskId, taskId));
    return result;
  }

  // Task Collaborators
  async addTaskCollaborator(taskId: string, userId: string): Promise<TaskCollaborator> {
    const [collaborator] = await db
      .insert(taskCollaborators)
      .values({ taskId, userId })
      .onConflictDoNothing()
      .returning();
    return collaborator;
  }

  async removeTaskCollaborator(taskId: string, userId: string): Promise<void> {
    await db
      .delete(taskCollaborators)
      .where(and(eq(taskCollaborators.taskId, taskId), eq(taskCollaborators.userId, userId)));
  }

  async getTaskCollaboratorsByTask(taskId: string): Promise<User[]> {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(taskCollaborators)
      .innerJoin(users, eq(taskCollaborators.userId, users.id))
      .where(eq(taskCollaborators.taskId, taskId));
    return result as User[];
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    // Soft delete: set deletedAt timestamp instead of hard delete
    await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id));
  }

  // Time Logs
  async getTimeLog(id: string): Promise<TimeLog | undefined> {
    const [timeLog] = await db.select().from(timeLogs).where(eq(timeLogs.id, id));
    return timeLog || undefined;
  }

  async createTimeLog(insertTimeLog: InsertTimeLog): Promise<TimeLog> {
    const [timeLog] = await db
      .insert(timeLogs)
      .values(insertTimeLog)
      .returning();
    return timeLog;
  }

  async getTimeLogs(): Promise<TimeLog[]> {
    return await db.select().from(timeLogs).orderBy(desc(timeLogs.createdAt));
  }

  async getTimeLogsWithRelations(): Promise<TimeLogWithRelations[]> {
    return await db
      .select({
        id: timeLogs.id,
        userId: timeLogs.userId,
        agencyId: timeLogs.agencyId,
        accountId: timeLogs.accountId,
        projectId: timeLogs.projectId,
        taskId: sql<string | null>`NULL`,
        taskName: timeLogs.taskName,
        description: timeLogs.description,
        actualHours: timeLogs.actualHours,
        billedHours: timeLogs.billedHours,
        tier: timeLogs.tier,
        billingType: timeLogs.billingType,
        startTime: timeLogs.startTime,
        endTime: timeLogs.endTime,
        logDate: timeLogs.logDate,
        createdAt: timeLogs.createdAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          createdAt: users.createdAt,
        },
        agency: {
          id: agencies.id,
          name: agencies.name,
          description: agencies.description,
          monthlyBillingTarget: agencies.monthlyBillingTarget,
          contactEmail: agencies.contactEmail,
          contactPhone: agencies.contactPhone,
          isActive: agencies.isActive,
          createdAt: agencies.createdAt,
        },
        account: {
          id: accounts.id,
          agencyId: accounts.agencyId,
          name: accounts.name,
          description: accounts.description,
          contactEmail: accounts.contactEmail,
          contactPhone: accounts.contactPhone,
          isActive: accounts.isActive,
          createdAt: accounts.createdAt,
        },
        project: projects || undefined,
        task: sql<null>`NULL`
      })
      .from(timeLogs)
      .innerJoin(users, eq(timeLogs.userId, users.id))
      .innerJoin(agencies, eq(timeLogs.agencyId, agencies.id))
      .innerJoin(accounts, eq(timeLogs.accountId, accounts.id))
      .leftJoin(projects, eq(timeLogs.projectId, projects.id))
      .orderBy(desc(timeLogs.createdAt));
  }

  async getTimeLogsByUser(userId: string): Promise<TimeLog[]> {
    return await db
      .select()
      .from(timeLogs)
      .where(eq(timeLogs.userId, userId))
      .orderBy(desc(timeLogs.createdAt));
  }

  async updateTimeLog(id: string, updates: Partial<InsertTimeLog>): Promise<TimeLog> {
    // If projectId is being updated, also update accountId and agencyId
    if (updates.projectId) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, updates.projectId))
        .limit(1);
      
      if (project) {
        updates.accountId = project.accountId;
        updates.agencyId = project.agencyId;
      }
    }
    // If accountId is being updated, sync agencyId and clear projectId
    else if (updates.accountId) {
      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, updates.accountId))
        .limit(1);
      
      if (account) {
        updates.agencyId = account.agencyId;
        updates.projectId = null;
      }
    }
    // If only agencyId is being updated, find first account in that agency and use it
    else if (updates.agencyId) {
      const [firstAccount] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.agencyId, updates.agencyId), eq(accounts.isActive, true)))
        .limit(1);
      
      if (firstAccount) {
        updates.accountId = firstAccount.id;
        updates.projectId = null;
      } else {
        throw new Error("No active accounts found for the selected agency");
      }
    }
    
    const [timeLog] = await db
      .update(timeLogs)
      .set(updates)
      .where(eq(timeLogs.id, id))
      .returning();
    return timeLog;
  }

  async deleteTimeLog(id: string): Promise<void> {
    await db
      .delete(timeLogs)
      .where(eq(timeLogs.id, id));
  }

  async getTimeLogsByRange(startDate: Date, endDate: Date, userId?: string): Promise<TimeLogWithRelations[]> {
    let query = db
      .select({
        id: timeLogs.id,
        userId: timeLogs.userId,
        agencyId: timeLogs.agencyId,
        accountId: timeLogs.accountId,
        projectId: timeLogs.projectId,
        taskId: sql<string | null>`NULL`,
        taskName: timeLogs.taskName,
        description: timeLogs.description,
        actualHours: timeLogs.actualHours,
        billedHours: timeLogs.billedHours,
        tier: timeLogs.tier,
        billingType: timeLogs.billingType,
        startTime: timeLogs.startTime,
        endTime: timeLogs.endTime,
        logDate: timeLogs.logDate,
        createdAt: timeLogs.createdAt,
        user: {
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          createdAt: users.createdAt,
        },
        account: {
          id: accounts.id,
          agencyId: accounts.agencyId,
          name: accounts.name,
          description: accounts.description,
          contactEmail: accounts.contactEmail,
          contactPhone: accounts.contactPhone,
          isActive: accounts.isActive,
          createdAt: accounts.createdAt,
        },
        agency: {
          id: agencies.id,
          name: agencies.name,
          description: agencies.description,
          monthlyBillingTarget: agencies.monthlyBillingTarget,
          contactEmail: agencies.contactEmail,
          contactPhone: agencies.contactPhone,
          isActive: agencies.isActive,
          createdAt: agencies.createdAt,
        },
        project: projects || undefined,
        task: sql<null>`NULL`
      })
      .from(timeLogs)
      .innerJoin(users, eq(timeLogs.userId, users.id))
      .innerJoin(accounts, eq(timeLogs.accountId, accounts.id))
      .innerJoin(agencies, eq(timeLogs.agencyId, agencies.id))
      .leftJoin(projects, eq(timeLogs.projectId, projects.id));

    const whereConditions = [
      gte(timeLogs.logDate, startDate),
      lte(timeLogs.logDate, endDate)
    ];

    if (userId) {
      whereConditions.push(eq(timeLogs.userId, userId));
    }

    return await query
      .where(and(...whereConditions))
      .orderBy(desc(timeLogs.createdAt));
  }

  async getMonthlyTimeLogReport(year: number, month: number): Promise<Array<{
    agencyId: string;
    agencyName: string;
    accountId: string;
    accountName: string;
    projectId: string | null;
    projectName: string | null;
    tier: string;
    totalBilledHours: number;
  }>> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const results = await db
      .select({
        agencyId: timeLogs.agencyId,
        agencyName: agencies.name,
        accountId: timeLogs.accountId,
        accountName: accounts.name,
        projectId: timeLogs.projectId,
        projectName: projects.name,
        tier: timeLogs.tier,
        totalBilledHours: sql<number>`CAST(SUM(CAST(${timeLogs.billedHours} AS NUMERIC)) AS NUMERIC)`
      })
      .from(timeLogs)
      .innerJoin(agencies, eq(timeLogs.agencyId, agencies.id))
      .innerJoin(accounts, eq(timeLogs.accountId, accounts.id))
      .leftJoin(projects, eq(timeLogs.projectId, projects.id))
      .where(
        and(
          gte(timeLogs.logDate, startDate),
          lte(timeLogs.logDate, endDate),
          eq(timeLogs.billingType, 'billed')
        )
      )
      .groupBy(timeLogs.agencyId, agencies.name, timeLogs.accountId, accounts.name, timeLogs.projectId, projects.name, timeLogs.tier)
      .orderBy(agencies.name, accounts.name, projects.name, timeLogs.tier);

    return results.map(r => ({
      agencyId: r.agencyId,
      agencyName: r.agencyName,
      accountId: r.accountId,
      accountName: r.accountName,
      projectId: r.projectId,
      projectName: r.projectName,
      tier: r.tier,
      totalBilledHours: parseFloat(r.totalBilledHours.toString())
    }));
  }

  // Calendar Connections
  async createCalendarConnection(insertConnection: InsertCalendarConnection): Promise<CalendarConnection> {
    const [connection] = await db
      .insert(calendarConnections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async getCalendarConnectionsByUser(userId: string): Promise<CalendarConnection[]> {
    return await db
      .select()
      .from(calendarConnections)
      .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.isActive, true)))
      .orderBy(desc(calendarConnections.createdAt));
  }

  async updateCalendarConnection(id: string, updates: Partial<InsertCalendarConnection>): Promise<CalendarConnection> {
    const [connection] = await db
      .update(calendarConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendarConnections.id, id))
      .returning();
    return connection;
  }

  async deleteCalendarConnection(id: string): Promise<void> {
    await db
      .delete(calendarConnections)
      .where(eq(calendarConnections.id, id));
  }

  // Calendars
  async createCalendar(insertCalendar: InsertCalendar): Promise<Calendar> {
    const [calendar] = await db
      .insert(calendars)
      .values(insertCalendar)
      .returning();
    return calendar;
  }

  async getCalendarsByConnection(connectionId: string): Promise<Calendar[]> {
    return await db
      .select()
      .from(calendars)
      .where(and(eq(calendars.connectionId, connectionId), eq(calendars.isActive, true)))
      .orderBy(calendars.name);
  }

  async updateCalendar(id: string, updates: Partial<InsertCalendar>): Promise<Calendar> {
    const [calendar] = await db
      .update(calendars)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendars.id, id))
      .returning();
    return calendar;
  }

  async deleteCalendar(id: string): Promise<void> {
    await db
      .delete(calendars)
      .where(eq(calendars.id, id));
  }

  // Calendar Events
  async createCalendarEvent(insertEvent: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db
      .insert(calendarEvents)
      .values(insertEvent)
      .returning();
    return event;
  }

  async getCalendarEventsByCalendar(calendarId: string): Promise<CalendarEvent[]> {
    return await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.calendarId, calendarId))
      .orderBy(calendarEvents.startTime, calendarEvents.startDate);
  }

  async getCalendarEventsByDateRange(startDate: Date, endDate: Date): Promise<CalendarEventWithRelations[]> {
    return await db
      .select({
        id: calendarEvents.id,
        calendarId: calendarEvents.calendarId,
        googleEventId: calendarEvents.googleEventId,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startTime: calendarEvents.startTime,
        endTime: calendarEvents.endTime,
        startTimeZone: calendarEvents.startTimeZone,
        endTimeZone: calendarEvents.endTimeZone,
        startDate: calendarEvents.startDate,
        endDate: calendarEvents.endDate,
        isAllDay: calendarEvents.isAllDay,
        location: calendarEvents.location,
        attendees: calendarEvents.attendees,
        status: calendarEvents.status,
        visibility: calendarEvents.visibility,
        recurringEventId: calendarEvents.recurringEventId,
        originalStartTime: calendarEvents.originalStartTime,
        isRecurring: calendarEvents.isRecurring,
        etag: calendarEvents.etag,
        sequence: calendarEvents.sequence,
        createdAt: calendarEvents.createdAt,
        updatedAt: calendarEvents.updatedAt,
        calendar: {
          id: calendars.id,
          connectionId: calendars.connectionId,
          googleCalendarId: calendars.googleCalendarId,
          name: calendars.name,
          description: calendars.description,
          timeZone: calendars.timeZone,
          isPrimary: calendars.isPrimary,
          backgroundColor: calendars.backgroundColor,
          foregroundColor: calendars.foregroundColor,
          etag: calendars.etag,
          isActive: calendars.isActive,
          lastSyncAt: calendars.lastSyncAt,
          syncToken: calendars.syncToken,
          createdAt: calendars.createdAt,
          updatedAt: calendars.updatedAt,
          connection: {
            id: calendarConnections.id,
            userId: calendarConnections.userId,
            googleAccountEmail: calendarConnections.googleAccountEmail,
            accessToken: calendarConnections.accessToken,
            refreshToken: calendarConnections.refreshToken,
            tokenExpiresAt: calendarConnections.tokenExpiresAt,
            tokenScope: calendarConnections.tokenScope,
            tokenType: calendarConnections.tokenType,
            isActive: calendarConnections.isActive,
            createdAt: calendarConnections.createdAt,
            updatedAt: calendarConnections.updatedAt,
            user: {
              id: users.id,
              username: users.username,
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
              role: users.role,
              password: users.password,
              createdAt: users.createdAt,
            }
          }
        }
      })
      .from(calendarEvents)
      .innerJoin(calendars, eq(calendarEvents.calendarId, calendars.id))
      .innerJoin(calendarConnections, eq(calendars.connectionId, calendarConnections.id))
      .innerJoin(users, eq(calendarConnections.userId, users.id))
      .where(
        and(
          eq(calendarConnections.isActive, true),
          eq(calendars.isActive, true),
          // Match events that overlap with the date range
          // For timed events
          // For all-day events  
          // This is a simplified check - proper date range filtering would need more complex logic
          gte(calendarEvents.startTime, startDate)
        )
      )
      .orderBy(calendarEvents.startTime, calendarEvents.startDate);
  }

  async updateCalendarEvent(id: string, updates: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [event] = await db
      .update(calendarEvents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return event;
  }

  async deleteCalendarEvent(id: string): Promise<void> {
    await db
      .delete(calendarEvents)
      .where(eq(calendarEvents.id, id));
  }

  // Slack Configuration methods
  async createSlackConfiguration(config: InsertSlackConfiguration): Promise<SlackConfiguration> {
    const [slackConfig] = await db
      .insert(slackConfigurations)
      .values(config)
      .returning();
    return slackConfig;
  }

  async getSlackConfigurationById(id: string): Promise<SlackConfiguration | undefined> {
    const [config] = await db
      .select()
      .from(slackConfigurations)
      .where(eq(slackConfigurations.id, id))
      .limit(1);
    return config;
  }

  async getSlackConfigurationsByUser(userId: string): Promise<SlackConfiguration[]> {
    return await db
      .select()
      .from(slackConfigurations)
      .where(eq(slackConfigurations.userId, userId))
      .orderBy(desc(slackConfigurations.createdAt));
  }

  async getSlackConfigurationsByAgency(agencyId: string): Promise<SlackConfiguration[]> {
    return await db
      .select()
      .from(slackConfigurations)
      .where(and(eq(slackConfigurations.agencyId, agencyId), eq(slackConfigurations.isActive, true)))
      .orderBy(desc(slackConfigurations.createdAt));
  }

  async getSlackConfigurationsByAccount(accountId: string): Promise<SlackConfiguration[]> {
    return await db
      .select()
      .from(slackConfigurations)
      .where(and(eq(slackConfigurations.accountId, accountId), eq(slackConfigurations.isActive, true)))
      .orderBy(desc(slackConfigurations.createdAt));
  }

  async getSlackConfigurations(): Promise<SlackConfiguration[]> {
    return await db
      .select()
      .from(slackConfigurations)
      .where(eq(slackConfigurations.isActive, true))
      .orderBy(desc(slackConfigurations.createdAt));
  }

  async updateSlackConfiguration(id: string, updates: Partial<InsertSlackConfiguration>): Promise<SlackConfiguration> {
    const [slackConfig] = await db
      .update(slackConfigurations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(slackConfigurations.id, id))
      .returning();
    return slackConfig;
  }

  async deleteSlackConfiguration(id: string): Promise<void> {
    await db
      .delete(slackConfigurations)
      .where(eq(slackConfigurations.id, id));
  }

  async getActiveSlackConfigurationsForEvent(eventType: string, agencyId?: string, accountId?: string): Promise<SlackConfiguration[]> {
    const conditions = [
      eq(slackConfigurations.isActive, true),
      sql`${slackConfigurations.eventTypes} @> ARRAY[${eventType}]::text[]`
    ];

    // Build targeting hierarchy: account-specific > agency-specific > global
    if (accountId) {
      // For account-specific events, match: specific account OR agency OR global
      conditions.push(
        sql`(${slackConfigurations.accountId} = ${accountId} OR 
             (${slackConfigurations.accountId} IS NULL AND ${slackConfigurations.agencyId} = ${agencyId}) OR
             (${slackConfigurations.accountId} IS NULL AND ${slackConfigurations.agencyId} IS NULL))`
      );
    } else if (agencyId) {
      // For agency-specific events, match: agency OR global (exclude account-specific)
      conditions.push(
        sql`(${slackConfigurations.agencyId} = ${agencyId} OR 
             (${slackConfigurations.agencyId} IS NULL AND ${slackConfigurations.accountId} IS NULL)) AND 
             ${slackConfigurations.accountId} IS NULL`
      );
    } else {
      // For global events, only match global configurations
      conditions.push(
        sql`${slackConfigurations.agencyId} IS NULL AND ${slackConfigurations.accountId} IS NULL`
      );
    }

    return await db
      .select()
      .from(slackConfigurations)
      .where(and(...conditions))
      .orderBy(desc(slackConfigurations.createdAt));
  }

  // Quota Configuration methods
  async createQuotaConfig(config: InsertQuotaConfig): Promise<QuotaConfig> {
    const [quotaConfig] = await db
      .insert(quotaConfigs)
      .values(config)
      .returning();
    return quotaConfig;
  }

  async getQuotaConfigByAgency(agencyId: string): Promise<QuotaConfig | undefined> {
    const [config] = await db
      .select()
      .from(quotaConfigs)
      .where(eq(quotaConfigs.agencyId, agencyId));
    return config || undefined;
  }

  async getAllQuotaConfigs(): Promise<QuotaConfig[]> {
    return await db
      .select()
      .from(quotaConfigs)
      .orderBy(quotaConfigs.createdAt);
  }

  async updateQuotaConfig(id: string, updates: Partial<InsertQuotaConfig>): Promise<QuotaConfig> {
    const [config] = await db
      .update(quotaConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotaConfigs.id, id))
      .returning();
    return config;
  }

  async upsertQuotaConfig(agencyId: string, config: Partial<InsertQuotaConfig>): Promise<QuotaConfig> {
    const existing = await this.getQuotaConfigByAgency(agencyId);
    
    if (existing) {
      return await this.updateQuotaConfig(existing.id, config);
    } else {
      return await this.createQuotaConfig({ ...config, agencyId } as InsertQuotaConfig);
    }
  }

  async deleteQuotaConfig(id: string): Promise<void> {
    await db
      .delete(quotaConfigs)
      .where(eq(quotaConfigs.id, id));
  }

  // Resource Quota methods
  async getAllResourceQuotas(): Promise<ResourceQuota[]> {
    return await db
      .select()
      .from(resourceQuotas)
      .orderBy(resourceQuotas.createdAt);
  }

  async createResourceQuota(quota: InsertResourceQuota): Promise<ResourceQuota> {
    const [created] = await db
      .insert(resourceQuotas)
      .values(quota)
      .returning();
    return created;
  }

  async updateResourceQuota(id: string, updates: Partial<InsertResourceQuota>): Promise<ResourceQuota> {
    const [updated] = await db
      .update(resourceQuotas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(resourceQuotas.id, id))
      .returning();
    return updated;
  }

  async deleteResourceQuota(id: string): Promise<void> {
    await db
      .delete(resourceQuotas)
      .where(eq(resourceQuotas.id, id));
  }

  // Partner Bonus Policy methods
  async getPartnerBonusPolicies(): Promise<PartnerBonusPolicy[]> {
    return await db
      .select()
      .from(partnerBonusPolicies)
      .where(eq(partnerBonusPolicies.isActive, true))
      .orderBy(partnerBonusPolicies.name);
  }

  async getPartnerBonusPolicyByAgency(agencyId: string): Promise<PartnerBonusPolicy | undefined> {
    const [policy] = await db
      .select()
      .from(partnerBonusPolicies)
      .where(eq(partnerBonusPolicies.agencyId, agencyId));
    return policy;
  }

  async createPartnerBonusPolicy(policy: InsertPartnerBonusPolicy): Promise<PartnerBonusPolicy> {
    const [created] = await db
      .insert(partnerBonusPolicies)
      .values(policy)
      .returning();
    return created;
  }

  async updatePartnerBonusPolicy(id: string, updates: Partial<InsertPartnerBonusPolicy>): Promise<PartnerBonusPolicy> {
    const [updated] = await db
      .update(partnerBonusPolicies)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(partnerBonusPolicies.id, id))
      .returning();
    return updated;
  }

  async deletePartnerBonusPolicy(id: string): Promise<void> {
    await db
      .delete(partnerBonusPolicies)
      .where(eq(partnerBonusPolicies.id, id));
  }

  // Individual Quota Bonus Settings methods
  async getIndividualQuotaBonusSettings(): Promise<IndividualQuotaBonusSettings[]> {
    return await db
      .select()
      .from(individualQuotaBonusSettings)
      .orderBy(individualQuotaBonusSettings.employmentType);
  }

  async getIndividualQuotaBonusByType(employmentType: string): Promise<IndividualQuotaBonusSettings | undefined> {
    const [settings] = await db
      .select()
      .from(individualQuotaBonusSettings)
      .where(eq(individualQuotaBonusSettings.employmentType, employmentType));
    return settings;
  }

  async updateIndividualQuotaBonusSettings(id: string, updates: Partial<InsertIndividualQuotaBonusSettings>): Promise<IndividualQuotaBonusSettings> {
    const [updated] = await db
      .update(individualQuotaBonusSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(individualQuotaBonusSettings.id, id))
      .returning();
    return updated;
  }

  // Quota Periods methods
  async getQuotaPeriods(): Promise<QuotaPeriod[]> {
    return await db
      .select()
      .from(quotaPeriods)
      .orderBy(desc(quotaPeriods.yearMonth));
  }

  async getQuotaPeriodByMonth(yearMonth: string): Promise<QuotaPeriod | undefined> {
    const [period] = await db
      .select()
      .from(quotaPeriods)
      .where(eq(quotaPeriods.yearMonth, yearMonth));
    return period;
  }

  async createQuotaPeriod(period: InsertQuotaPeriod): Promise<QuotaPeriod> {
    const [created] = await db
      .insert(quotaPeriods)
      .values(period)
      .returning();
    return created;
  }

  async updateQuotaPeriod(id: string, updates: Partial<InsertQuotaPeriod>): Promise<QuotaPeriod> {
    const [updated] = await db
      .update(quotaPeriods)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotaPeriods.id, id))
      .returning();
    return updated;
  }

  // Helper: Count working days in a date range (excluding weekends and holidays)
  private countWorkingDays(startDate: Date, endDate: Date, holidays: Date[]): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current < endDate) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidays.some(h => 
        h.getFullYear() === current.getFullYear() &&
        h.getMonth() === current.getMonth() &&
        h.getDate() === current.getDate()
      );
      
      if (!isWeekend && !isHoliday) {
        count++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  // Quota Tracking methods
  async getResourceQuotaTracker(month: string): Promise<Array<{
    user: User;
    monthlyTarget: number;
    adjustedTarget: number;
    expectedHours: number;
    billedHours: number;
    prebilledHours: number;
    percentageComplete: number;
  }>> {
    // Parse month (format: "YYYY-MM")
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1); // Start of next month (exclusive)
    const today = new Date();
    const currentDate = today < endDate ? today : new Date(endDate.getTime() - 1);

    // Get all users
    const allUsers = await this.getUsers();

    // Get all resource quotas (note: there is one current quota per user, not versioned/historical records)
    const allQuotas = await this.getAllResourceQuotas();

    // Get holidays for the month
    // Include holidays that:
    // 1. Start within the month, OR
    // 2. Started before the month but extend into it (endDate >= startDate of month)
    const monthHolidays = await db
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.isActive, true),
          or(
            // Holidays starting within the month
            and(
              gte(holidays.date, startDate.toISOString().split('T')[0]),
              sql`${holidays.date} < ${endDate.toISOString().split('T')[0]}`
            ),
            // Holidays starting before but extending into the month
            and(
              sql`${holidays.date} < ${startDate.toISOString().split('T')[0]}`,
              sql`COALESCE(${holidays.endDate}, ${holidays.date}) >= ${startDate.toISOString().split('T')[0]}`
            )
          )
        )
      );

    // Convert holiday dates to Date objects (parse in local time to avoid timezone issues)
    // Only include dates that fall within the current month range
    const holidayDates = monthHolidays.flatMap(h => {
      const dates: Date[] = [];
      // Parse dates in local time by splitting the string (avoids UTC parsing)
      const startParts = h.date.split('-').map(Number);
      const holidayStart = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      
      let holidayEnd = holidayStart;
      if (h.endDate) {
        const endParts = h.endDate.split('-').map(Number);
        holidayEnd = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      }
      
      // Clamp to month boundaries - only include dates within the month
      const effectiveStart = holidayStart < startDate ? startDate : holidayStart;
      const monthEnd = new Date(endDate.getTime() - 1); // endDate is exclusive
      const effectiveEnd = holidayEnd > monthEnd ? monthEnd : holidayEnd;
      
      const current = new Date(effectiveStart);
      
      while (current <= effectiveEnd) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      return dates;
    });

    // Get all user availability for the month
    const userTimeOff = await db
      .select()
      .from(userAvailability)
      .where(
        and(
          eq(userAvailability.isActive, true),
          gte(userAvailability.startDate, startDate.toISOString().split('T')[0]),
          sql`${userAvailability.startDate} < ${endDate.toISOString().split('T')[0]}`
        )
      );

    // Get time logs for the month grouped by user (break out billed and prebilled hours)
    const results = await db
      .select({
        userId: timeLogs.userId,
        totalBilledHours: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.billingType} = 'billed' THEN CAST(${timeLogs.billedHours} AS DECIMAL) ELSE 0 END), 0)`,
        totalPrebilledHours: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.billingType} = 'prebilled' THEN CAST(${timeLogs.billedHours} AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(timeLogs)
      .where(
        and(
          gte(timeLogs.logDate, startDate),
          sql`${timeLogs.logDate} < ${endDate}`
        )
      )
      .groupBy(timeLogs.userId);

    // Calculate working days (with and without holidays for proper adjustment calculation)
    // Standard working days = baseline for quota (excluding weekends only, NOT holidays)
    const standardWorkingDays = this.countWorkingDays(startDate, endDate, []);
    // Actual working days after holidays
    const totalWorkingDays = this.countWorkingDays(startDate, endDate, holidayDates);
    const workingDaysElapsed = this.countWorkingDays(startDate, currentDate, holidayDates);

    // Build tracker data only for users with active quotas configured
    const usersWithQuotas = allUsers.filter(user => 
      allQuotas.some(q => q.userId === user.id && q.isActive)
    );

    return usersWithQuotas.map(user => {
      const quota = allQuotas.find(q => q.userId === user.id && q.isActive)!; // safe because we filtered
      const monthlyTarget = parseFloat(quota.monthlyTarget);

      // Get user's time off for this month
      const userDaysOff = userTimeOff.filter(uto => uto.userId === user.id);
      const userDaysOffCount = userDaysOff.reduce((count, timeOff) => {
        const offStart = new Date(Math.max(new Date(timeOff.startDate).getTime(), startDate.getTime()));
        const offEnd = new Date(Math.min(new Date(timeOff.endDate).getTime(), endDate.getTime()));
        return count + this.countWorkingDays(offStart, offEnd, holidayDates);
      }, 0);

      // Calculate adjusted target based on available working days
      // Use standardWorkingDays (no holidays) as baseline since monthlyTarget assumes a standard month
      const availableWorkingDays = totalWorkingDays - userDaysOffCount;
      const adjustedTarget = standardWorkingDays > 0 
        ? (monthlyTarget * availableWorkingDays) / standardWorkingDays 
        : monthlyTarget;

      // Calculate expected hours based on working days elapsed (excluding user's time off)
      const userDaysOffElapsed = userDaysOff.reduce((count, timeOff) => {
        const offStart = new Date(Math.max(new Date(timeOff.startDate).getTime(), startDate.getTime()));
        const offEnd = new Date(Math.min(new Date(timeOff.endDate).getTime(), currentDate.getTime()));
        if (offEnd > offStart) {
          return count + this.countWorkingDays(offStart, offEnd, holidayDates);
        }
        return count;
      }, 0);

      const effectiveWorkingDaysElapsed = workingDaysElapsed - userDaysOffElapsed;
      // Give users 24 hours buffer - use previous day's expected hours for pacing
      // This means pacing only counts as "behind" the next day
      const effectiveDaysForPacing = Math.max(0, effectiveWorkingDaysElapsed - 1);
      const expectedHours = availableWorkingDays > 0 
        ? (adjustedTarget * effectiveDaysForPacing) / availableWorkingDays 
        : 0;

      const hoursData = results.find(r => r.userId === user.id);
      const billedHours = hoursData ? parseFloat(hoursData.totalBilledHours) : 0;
      const prebilledHours = hoursData ? parseFloat(hoursData.totalPrebilledHours) : 0;

      const percentageComplete = adjustedTarget > 0 ? (billedHours / adjustedTarget) * 100 : 0;

      return {
        user,
        monthlyTarget,
        adjustedTarget: Math.round(adjustedTarget * 10) / 10,
        expectedHours: Math.round(expectedHours * 10) / 10,
        billedHours,
        prebilledHours,
        percentageComplete: Math.round(percentageComplete * 10) / 10,
      };
    });
  }

  async getClientQuotaTracker(month: string): Promise<Array<{
    agency: Agency;
    monthlyTarget: number;
    billedHours: number;
    expectedHours: number;
    percentageComplete: number;
  }>> {
    // Parse month (format: "YYYY-MM")
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1); // Start of next month (exclusive)
    const today = new Date();
    const currentDate = today < endDate ? today : new Date(endDate.getTime() - 1);

    // Get all agencies
    const allAgencies = await this.getAgencies();

    // Get all quota configs (note: there is one current config per agency, not versioned/historical records)
    const allConfigs = await this.getAllQuotaConfigs();

    // Get holidays for the month to calculate working days
    // Include holidays that start within the month OR started before but extend into it
    const monthHolidays = await db
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.isActive, true),
          or(
            and(
              gte(holidays.date, startDate.toISOString().split('T')[0]),
              sql`${holidays.date} < ${endDate.toISOString().split('T')[0]}`
            ),
            and(
              sql`${holidays.date} < ${startDate.toISOString().split('T')[0]}`,
              sql`COALESCE(${holidays.endDate}, ${holidays.date}) >= ${startDate.toISOString().split('T')[0]}`
            )
          )
        )
      );

    // Convert holiday dates to Date objects (parse in local time to avoid timezone issues)
    // Only include dates that fall within the current month range
    const holidayDates = monthHolidays.flatMap(h => {
      const dates: Date[] = [];
      // Parse dates in local time by splitting the string (avoids UTC parsing)
      const startParts = h.date.split('-').map(Number);
      const holidayStart = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      
      let holidayEnd = holidayStart;
      if (h.endDate) {
        const endParts = h.endDate.split('-').map(Number);
        holidayEnd = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      }
      
      // Clamp to month boundaries - only include dates within the month
      const effectiveStart = holidayStart < startDate ? startDate : holidayStart;
      const monthEnd = new Date(endDate.getTime() - 1);
      const effectiveEnd = holidayEnd > monthEnd ? monthEnd : holidayEnd;
      
      const current = new Date(effectiveStart);
      
      while (current <= effectiveEnd) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      return dates;
    });

    // Calculate working days (with and without holidays for proper adjustment calculation)
    // Standard working days = baseline for quota (excluding weekends only, NOT holidays)
    const standardWorkingDays = this.countWorkingDays(startDate, endDate, []);
    // Actual working days after holidays
    const totalWorkingDays = this.countWorkingDays(startDate, endDate, holidayDates);
    const workingDaysElapsed = this.countWorkingDays(startDate, currentDate, holidayDates);

    // Get time logs for the month grouped by agency (using agencyId directly to include logs without projects)
    const results = await db
      .select({
        agencyId: timeLogs.agencyId,
        totalBilledHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} AS DECIMAL)), 0)`,
      })
      .from(timeLogs)
      .where(
        and(
          isNotNull(timeLogs.agencyId),
          gte(timeLogs.logDate, startDate),
          sql`${timeLogs.logDate} < ${endDate}`
        )
      )
      .groupBy(timeLogs.agencyId);

    // Build tracker data only for agencies with explicit quota configs
    return allAgencies
      .filter(agency => agency.isActive && allConfigs.some(c => c.agencyId === agency.id))
      .map(agency => {
        const config = allConfigs.find(c => c.agencyId === agency.id)!; // safe because we filtered
        const monthlyTarget = parseFloat(config.monthlyTarget);

        // Calculate expected hours based on working days elapsed
        const expectedHours = totalWorkingDays > 0 
          ? (monthlyTarget * workingDaysElapsed) / totalWorkingDays 
          : 0;

        const hoursData = results.find(r => r.agencyId === agency.id);
        const billedHours = hoursData ? parseFloat(hoursData.totalBilledHours) : 0;

        const percentageComplete = monthlyTarget > 0 ? (billedHours / monthlyTarget) * 100 : 0;

        return {
          agency,
          monthlyTarget,
          billedHours,
          expectedHours: Math.round(expectedHours * 10) / 10,
          percentageComplete: Math.round(percentageComplete * 10) / 10,
        };
      });
  }

  async getAccountQuotaTracker(month: string, agencyId?: string): Promise<Array<{
    account: Account;
    agency: Agency;
    monthlyTarget: number;
    billedHours: number;
    expectedHours: number;
    percentageComplete: number;
  }>> {
    // Parse month (format: "YYYY-MM")
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 1);
    const today = new Date();
    const currentDate = today < endDate ? today : new Date(endDate.getTime() - 1);

    // Get all accounts (optionally filtered by agency)
    let allAccounts = await this.getAccounts();
    if (agencyId) {
      allAccounts = allAccounts.filter(a => a.agencyId === agencyId);
    }

    // Get all agencies for mapping
    const allAgencies = await this.getAgencies();

    // Get holidays for the month to calculate working days
    const monthHolidays = await db
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.isActive, true),
          gte(holidays.date, startDate.toISOString().split('T')[0]),
          sql`${holidays.date} < ${endDate.toISOString().split('T')[0]}`
        )
      );

    const holidayDates = monthHolidays.flatMap(h => {
      const dates: Date[] = [];
      const startParts = h.date.split('-').map(Number);
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      
      let end = start;
      if (h.endDate) {
        const endParts = h.endDate.split('-').map(Number);
        end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      }
      
      const current = new Date(start);
      while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      return dates;
    });

    const totalWorkingDays = this.countWorkingDays(startDate, endDate, holidayDates);
    const workingDaysElapsed = this.countWorkingDays(startDate, currentDate, holidayDates);

    // Get billed hours per account for the month
    const results = await db
      .select({
        accountId: timeLogs.accountId,
        totalBilledHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} AS DECIMAL)), 0)`,
      })
      .from(timeLogs)
      .where(
        and(
          isNotNull(timeLogs.accountId),
          gte(timeLogs.logDate, startDate),
          sql`${timeLogs.logDate} < ${endDate}`
        )
      )
      .groupBy(timeLogs.accountId);

    // Build tracker data for accounts with quota set
    return allAccounts
      .filter(account => account.isActive && account.monthlyQuotaHours)
      .map(account => {
        const agency = allAgencies.find(a => a.id === account.agencyId)!;
        const monthlyTarget = parseFloat(account.monthlyQuotaHours || '0');

        const expectedHours = totalWorkingDays > 0 
          ? (monthlyTarget * workingDaysElapsed) / totalWorkingDays 
          : 0;

        const hoursData = results.find(r => r.accountId === account.id);
        const billedHours = hoursData ? parseFloat(hoursData.totalBilledHours) : 0;

        const percentageComplete = monthlyTarget > 0 ? (billedHours / monthlyTarget) * 100 : 0;

        return {
          account,
          agency,
          monthlyTarget,
          billedHours,
          expectedHours: Math.round(expectedHours * 10) / 10,
          percentageComplete: Math.round(percentageComplete * 10) / 10,
        };
      });
  }

  // Analytics methods
  async getHoursSummaryByWeek(startDate: Date, endDate: Date): Promise<{ date: string; actualHours: number; billedHours: number }[]> {
    // Generate week boundaries
    const results = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekData = await db
        .select({
          actualHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.actualHours} as DECIMAL)), 0)`,
          billedHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} as DECIMAL)), 0)`
        })
        .from(timeLogs)
        .where(
          and(
            gte(timeLogs.logDate, weekStart),
            lte(timeLogs.logDate, weekEnd)
          )
        );
      
      results.push({
        date: weekStart.toISOString().split('T')[0],
        periodStart: weekStart.toISOString().split('T')[0], // ISO date for proper sorting
        actualHours: parseFloat(weekData[0]?.actualHours || '0'),
        billedHours: parseFloat(weekData[0]?.billedHours || '0')
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return results;
  }

  async getHoursSummaryByMonth(startDate: Date, endDate: Date): Promise<{ month: string; actualHours: number; billedHours: number }[]> {
    const results = [];
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    while (currentDate <= endDate) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const monthData = await db
        .select({
          actualHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.actualHours} as DECIMAL)), 0)`,
          billedHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} as DECIMAL)), 0)`
        })
        .from(timeLogs)
        .where(
          and(
            gte(timeLogs.logDate, monthStart),
            lte(timeLogs.logDate, monthEnd)
          )
        );
      
      results.push({
        month: currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        periodStart: currentDate.toISOString().split('T')[0], // ISO date for proper sorting
        actualHours: parseFloat(monthData[0]?.actualHours || '0'),
        billedHours: parseFloat(monthData[0]?.billedHours || '0')
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return results;
  }

  async getTargetProgressByAgency(): Promise<{ agency: Agency; weeklyActual: number; monthlyActual: number; weeklyBillable: number; monthlyBillable: number; weeklyPreBilled: number; monthlyPreBilled: number; weeklyTarget: number; monthlyTarget: number; showBillable: boolean; showPreBilled: boolean; noQuota: boolean }[]> {
    const now = new Date();
    // Calculate Monday-Sunday week (weekStartsOn: 1)
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days to Monday
    let startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0); // Start of Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // Monday + 6 days = Sunday
    endOfWeek.setHours(23, 59, 59, 999); // Include the entire Sunday
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999); // Include the entire last day
    
    // IMPORTANT: Clamp week start to current month to avoid including previous month hours
    // This ensures weekly pacing only shows hours from the current month
    if (startOfWeek < startOfMonth) {
      startOfWeek = new Date(startOfMonth);
      startOfWeek.setHours(0, 0, 0, 0);
    }
    
    // Calculate prorated weekly target based on days in month that fall within the current week
    const daysInMonth = endOfMonth.getDate();
    const weekStartInMonth = startOfWeek < startOfMonth ? startOfMonth : startOfWeek;
    const weekEndInMonth = endOfWeek > endOfMonth ? endOfMonth : endOfWeek;
    const daysInWeek = Math.floor((weekEndInMonth.getTime() - weekStartInMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const agencyStats = await db
      .select({
        agency: agencies,
        quotaConfig: quotaConfigs,
        weeklyActual: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyActual: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        weeklyBillable: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} AND ${timeLogs.billingType} = 'billed' THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyBillable: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} AND ${timeLogs.billingType} = 'billed' THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        weeklyPreBilled: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} AND ${timeLogs.billingType} = 'prebilled' THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyPreBilled: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} AND ${timeLogs.billingType} = 'prebilled' THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`
      })
      .from(agencies)
      .leftJoin(quotaConfigs, eq(agencies.id, quotaConfigs.agencyId))
      .leftJoin(timeLogs, eq(agencies.id, timeLogs.agencyId))
      .where(and(
        eq(agencies.isActive, true),
        or(
          eq(quotaConfigs.isVisible, true),
          isNull(quotaConfigs.isVisible)
        )
      ))
      .groupBy(agencies.id, quotaConfigs.id);
    
    return agencyStats
      .filter(stat => stat.quotaConfig?.isVisible !== false)
      .map(stat => {
        const monthlyTarget = parseFloat(stat.quotaConfig?.monthlyTarget || '160');
        const dailyRate = monthlyTarget / daysInMonth;
        const proratedWeeklyTarget = Math.round(dailyRate * daysInWeek);
        
        return {
          agency: stat.agency,
          weeklyActual: parseFloat(stat.weeklyActual || '0'),
          monthlyActual: parseFloat(stat.monthlyActual || '0'),
          weeklyBillable: parseFloat(stat.weeklyBillable || '0'),
          monthlyBillable: parseFloat(stat.monthlyBillable || '0'),
          weeklyPreBilled: parseFloat(stat.weeklyPreBilled || '0'),
          monthlyPreBilled: parseFloat(stat.monthlyPreBilled || '0'),
          weeklyTarget: proratedWeeklyTarget,
          monthlyTarget: monthlyTarget,
          showBillable: stat.quotaConfig?.showBillable ?? true,
          showPreBilled: stat.quotaConfig?.showPreBilled ?? true,
          noQuota: stat.quotaConfig?.noQuota ?? false
        };
      });
  }

  async getHoursByAccount(): Promise<{ account: { id: string; name: string; agencyId: string }; agency: { id: string; name: string }; weeklyActual: number; monthlyActual: number; weeklyBilled: number; monthlyBilled: number }[]> {
    const now = new Date();
    // Calculate Monday-Sunday week (weekStartsOn: 1)
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days to Monday
    let startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // Monday + 6 days = Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    // Clamp week start to current month to avoid including previous month hours
    if (startOfWeek < startOfMonth) {
      startOfWeek = new Date(startOfMonth);
      startOfWeek.setHours(0, 0, 0, 0);
    }
    
    const accountStats = await db
      .select({
        accountId: accounts.id,
        accountName: accounts.name,
        accountAgencyId: accounts.agencyId,
        agencyId: agencies.id,
        agencyName: agencies.name,
        weeklyActual: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} THEN CAST(${timeLogs.actualHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyActual: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} THEN CAST(${timeLogs.actualHours} as DECIMAL) ELSE 0 END), 0)`,
        weeklyBilled: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyBilled: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`
      })
      .from(accounts)
      .innerJoin(agencies, eq(accounts.agencyId, agencies.id))
      .leftJoin(timeLogs, eq(accounts.id, timeLogs.accountId))
      .where(and(eq(accounts.isActive, true), eq(agencies.isActive, true)))
      .groupBy(accounts.id, accounts.name, accounts.agencyId, agencies.id, agencies.name);
    
    return accountStats.map(stat => ({
      account: {
        id: stat.accountId,
        name: stat.accountName,
        agencyId: stat.accountAgencyId
      },
      agency: {
        id: stat.agencyId,
        name: stat.agencyName
      },
      weeklyActual: parseFloat(stat.weeklyActual || '0'),
      monthlyActual: parseFloat(stat.monthlyActual || '0'),
      weeklyBilled: parseFloat(stat.weeklyBilled || '0'),
      monthlyBilled: parseFloat(stat.monthlyBilled || '0')
    }));
  }

  async getHoursByAgency(): Promise<Array<{
    type: 'agency';
    id: string;
    name: string;
    weeklyBillable: number;
    monthlyBillable: number;
    weeklyPreBilled: number;
    monthlyPreBilled: number;
    weeklyTarget: number;
    monthlyTarget: number;
    showBillable: boolean;
    showPreBilled: boolean;
    noQuota: boolean;
    isVisible: boolean;
  }>> {
    const now = new Date();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Calculate prorated weekly target based on days in month that fall within the current week
    const daysInMonth = endOfMonth.getDate();
    const weekStartInMonth = startOfWeek < startOfMonth ? startOfMonth : startOfWeek;
    const weekEndInMonth = endOfWeek > endOfMonth ? endOfMonth : endOfWeek;
    const daysInWeek = Math.floor((weekEndInMonth.getTime() - weekStartInMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Get agency-level aggregations with quota configs
    const agencyStats = await db
      .select({
        agencyId: agencies.id,
        agencyName: agencies.name,
        weeklyBillable: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyBillable: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`,
        weeklyActual: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfWeek} AND ${timeLogs.logDate} <= ${endOfWeek} THEN CAST(${timeLogs.actualHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyActual: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.logDate} >= ${startOfMonth} AND ${timeLogs.logDate} <= ${endOfMonth} THEN CAST(${timeLogs.actualHours} as DECIMAL) ELSE 0 END), 0)`,
        monthlyTarget: quotaConfigs.monthlyTarget,
        showBillable: quotaConfigs.showBillable,
        showPreBilled: quotaConfigs.showPreBilled,
        noQuota: quotaConfigs.noQuota,
        isVisible: quotaConfigs.isVisible
      })
      .from(agencies)
      .leftJoin(timeLogs, eq(agencies.id, timeLogs.agencyId))
      .leftJoin(quotaConfigs, eq(agencies.id, quotaConfigs.agencyId))
      .where(eq(agencies.isActive, true))
      .groupBy(agencies.id, agencies.name, quotaConfigs.monthlyTarget, quotaConfigs.showBillable, quotaConfigs.showPreBilled, quotaConfigs.noQuota, quotaConfigs.isVisible);

    // Transform to consistent format with configuration
    return agencyStats.map(stat => {
      const weeklyActual = parseFloat(stat.weeklyActual || '0');
      const monthlyActual = parseFloat(stat.monthlyActual || '0');
      const weeklyBillable = parseFloat(stat.weeklyBillable || '0');
      const monthlyBillable = parseFloat(stat.monthlyBillable || '0');
      const weeklyPreBilled = weeklyActual - weeklyBillable;
      const monthlyPreBilled = monthlyActual - monthlyBillable;

      const monthlyTarget = parseFloat(stat.monthlyTarget || '160');
      const dailyRate = monthlyTarget / daysInMonth;
      const proratedWeeklyTarget = Math.round(dailyRate * daysInWeek);

      return {
        type: 'agency' as const,
        id: stat.agencyId,
        name: stat.agencyName,
        weeklyBillable,
        monthlyBillable,
        weeklyPreBilled,
        monthlyPreBilled,
        weeklyTarget: proratedWeeklyTarget,
        monthlyTarget: monthlyTarget,
        showBillable: stat.showBillable ?? true,
        showPreBilled: stat.showPreBilled ?? true,
        noQuota: stat.noQuota ?? false,
        isVisible: stat.isVisible ?? true
      };
    });
  }

  async getEfficiencyRatesByAccount(): Promise<{ account: Account; agency: Agency; actualHours: number; billedHours: number; efficiency: number }[]> {
    const accountStats = await db
      .select({
        account: accounts,
        agency: agencies,
        actualHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.actualHours} as DECIMAL)), 0)`,
        billedHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} as DECIMAL)), 0)`
      })
      .from(accounts)
      .innerJoin(agencies, eq(accounts.agencyId, agencies.id))
      .leftJoin(timeLogs, eq(accounts.id, timeLogs.accountId))
      .where(and(eq(accounts.isActive, true), eq(agencies.isActive, true)))
      .groupBy(accounts.id, agencies.id);
    
    return accountStats.map(stat => {
      const actualHours = parseFloat(stat.actualHours || '0');
      const billedHours = parseFloat(stat.billedHours || '0');
      const efficiency = actualHours > 0 ? (billedHours / actualHours) * 100 : 0;
      
      return {
        account: stat.account,
        agency: stat.agency,
        actualHours,
        billedHours,
        efficiency: Math.round(efficiency * 100) / 100
      };
    });
  }

  async getEfficiencyRatesByAgency(): Promise<{ agency: Agency; actualHours: number; billedHours: number; efficiency: number }[]> {
    const agencyStats = await db
      .select({
        agency: agencies,
        actualHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.actualHours} as DECIMAL)), 0)`,
        billedHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} as DECIMAL)), 0)`
      })
      .from(agencies)
      .leftJoin(timeLogs, eq(agencies.id, timeLogs.agencyId))
      .where(eq(agencies.isActive, true))
      .groupBy(agencies.id);
    
    return agencyStats.map(stat => {
      const actualHours = parseFloat(stat.actualHours || '0');
      const billedHours = parseFloat(stat.billedHours || '0');
      const efficiency = actualHours > 0 ? (billedHours / actualHours) * 100 : 0;
      
      return {
        agency: stat.agency,
        actualHours,
        billedHours,
        efficiency: Math.round(efficiency * 100) / 100
      };
    });
  }

  async getWeeklyBonusEligibility(): Promise<Array<{
    agency: Agency;
    monthlyTarget: number;
    weeks: Array<{
      weekNumber: number;
      startDate: Date;
      endDate: Date;
      billedHours: number;
      weeklyTarget: number;
      hitTarget: boolean;
    }>;
    weeksHit: number;
    totalWeeks: number;
    eligibleForBonus: boolean;
  }>> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get first and last day of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    
    // Calculate all weeks in the current month (Monday to Sunday)
    // Keep full week boundaries for accurate hour calculations
    const weeks: Array<{ weekNumber: number; startDate: Date; endDate: Date }> = [];
    let weekNumber = 1;
    let currentDate = new Date(startOfMonth);
    
    // Find the first Monday on or after the start of the month
    const firstDayOfWeek = currentDate.getDay();
    // If it's already Monday (1), stay; if Sunday (0), advance 1 day; otherwise advance to next Monday
    const daysToMonday = firstDayOfWeek === 1 ? 0 : (firstDayOfWeek === 0 ? 1 : 8 - firstDayOfWeek);
    currentDate.setDate(currentDate.getDate() + daysToMonday);
    
    while (currentDate <= endOfMonth) {
      const weekStart = new Date(currentDate);
      const weekEnd = new Date(currentDate);
      weekEnd.setDate(weekEnd.getDate() + 6); // Monday + 6 days = Sunday
      weekEnd.setHours(23, 59, 59, 999);
      
      // Include all weeks that start on or before the last day of the month
      // Time log queries are already clamped to [startOfMonth, endOfMonth]
      // and weekly targets are prorated by actual days in month
      weeks.push({
        weekNumber,
        startDate: weekStart,
        endDate: weekEnd
      });
      weekNumber++;
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    // Get all active agencies with quota configs, excluding those with noQuota = true
    const agenciesData = await db
      .select({
        agency: agencies,
        quotaConfig: quotaConfigs
      })
      .from(agencies)
      .leftJoin(quotaConfigs, eq(agencies.id, quotaConfigs.agencyId))
      .where(and(
        eq(agencies.isActive, true),
        or(
          isNull(quotaConfigs.noQuota),
          eq(quotaConfigs.noQuota, false)
        )
      ));
    
    // Calculate days in month for prorating weekly targets
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // For each agency, calculate weekly hours across all accounts and check targets
    const results = await Promise.all(agenciesData.map(async ({ agency, quotaConfig }) => {
      const monthlyTarget = parseFloat(quotaConfig?.monthlyTarget || '160');
      const dailyRate = monthlyTarget / daysInMonth;
      
      const weekResults = await Promise.all(weeks.map(async (week) => {
        // Calculate how many days of this month fall in this week
        const weekStartInMonth = week.startDate < startOfMonth ? startOfMonth : week.startDate;
        const weekEndInMonth = week.endDate > endOfMonth ? endOfMonth : week.endDate;
        
        const daysInWeek = Math.floor((weekEndInMonth.getTime() - weekStartInMonth.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Prorated weekly target based on days in this week
        const weeklyTarget = dailyRate * daysInWeek;
        
        // Clamp the query to only pull data from within the current month
        // This prevents October data from bleeding into November calculations
        const queryStartDate = week.startDate < startOfMonth ? startOfMonth : week.startDate;
        const queryEndDate = week.endDate > endOfMonth ? endOfMonth : week.endDate;
        
        const [hourData] = await db
          .select({
            billedHours: sql<string>`COALESCE(SUM(CASE WHEN ${timeLogs.billingType} = 'billed' THEN CAST(${timeLogs.billedHours} as DECIMAL) ELSE 0 END), 0)`
          })
          .from(timeLogs)
          .where(
            and(
              eq(timeLogs.agencyId, agency.id),
              gte(timeLogs.logDate, queryStartDate),
              lte(timeLogs.logDate, queryEndDate)
            )
          );
        
        const billedHours = parseFloat(hourData?.billedHours || '0');
        const hitTarget = billedHours >= weeklyTarget;
        
        return {
          weekNumber: week.weekNumber,
          startDate: week.startDate,
          endDate: week.endDate,
          billedHours,
          weeklyTarget,
          hitTarget
        };
      }));
      
      const weeksHit = weekResults.filter(w => w.hitTarget).length;
      const totalWeeks = weeks.length;
      const eligibleForBonus = weeksHit === totalWeeks && totalWeeks >= 4;
      
      return {
        agency,
        monthlyTarget,
        weeks: weekResults,
        weeksHit,
        totalWeeks,
        eligibleForBonus
      };
    }));
    
    return results.sort((a, b) => a.agency.name.localeCompare(b.agency.name));
  }

  async getMonthlyBreakdownByPerson(): Promise<{ agency: Agency; account: Account; project: Project | null; user: User; actualHours: number; billedHours: number }[]> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get first and last day of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);

    const result = await db
      .select({
        agency: agencies,
        account: accounts,
        project: projects,
        user: users,
        totalActual: sql<string>`COALESCE(SUM(CAST(${timeLogs.actualHours} as DECIMAL)), 0)`,
        totalBilled: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} as DECIMAL)), 0)`,
      })
      .from(timeLogs)
      .innerJoin(users, eq(timeLogs.userId, users.id))
      .leftJoin(projects, eq(timeLogs.projectId, projects.id))
      .innerJoin(accounts, eq(timeLogs.accountId, accounts.id))
      .innerJoin(agencies, eq(timeLogs.agencyId, agencies.id))
      .where(
        and(
          gte(timeLogs.logDate, startOfMonth),
          lte(timeLogs.logDate, endOfMonth)
        )
      )
      .groupBy(
        agencies.id, agencies.name, agencies.description, agencies.monthlyBillingTarget, agencies.contactEmail, agencies.contactPhone, agencies.isActive, agencies.createdAt,
        accounts.id, accounts.agencyId, accounts.name, accounts.description, accounts.contactEmail, accounts.contactPhone, accounts.isActive, accounts.createdAt,
        projects.id, projects.agencyId, projects.accountId, projects.name, projects.description, projects.status, projects.startDate, projects.endDate, projects.estimatedHours, projects.isActive, projects.createdAt, projects.deletedAt,
        users.id, users.username, users.password, users.email, users.firstName, users.lastName, users.role, users.createdAt
      )
      .orderBy(
        agencies.name,
        accounts.name,
        sql`COALESCE(${projects.name}, 'No Project')`,
        users.firstName,
        users.lastName
      )
      .execute();

    return result.map(row => ({
      agency: row.agency,
      account: row.account,
      project: row.project,
      user: row.user,
      actualHours: parseFloat(row.totalActual?.toString() || '0'),
      billedHours: parseFloat(row.totalBilled?.toString() || '0'),
    }));
  }

  // Penguin Hours Tracker
  async getPenguinHoursTracker(agencyId: string): Promise<PenguinHoursTracker | undefined> {
    const [tracker] = await db
      .select()
      .from(penguinHoursTracker)
      .where(eq(penguinHoursTracker.agencyId, agencyId))
      .orderBy(desc(penguinHoursTracker.createdAt))
      .limit(1);
    return tracker || undefined;
  }

  async createPenguinHoursTracker(insertTracker: InsertPenguinHoursTracker): Promise<PenguinHoursTracker> {
    const [tracker] = await db
      .insert(penguinHoursTracker)
      .values(insertTracker)
      .returning();
    return tracker;
  }

  async resetPenguinHoursTracker(agencyId: string): Promise<PenguinHoursTracker> {
    const [tracker] = await db
      .insert(penguinHoursTracker)
      .values({
        agencyId,
        startDate: new Date(),
        hourBank: "50"
      })
      .returning();
    return tracker;
  }

  async getPenguinHoursUsed(agencyId: string, startDate: Date): Promise<number> {
    const [result] = await db
      .select({
        totalHours: sql<string>`COALESCE(SUM(CAST(${timeLogs.billedHours} as DECIMAL)), 0)`
      })
      .from(timeLogs)
      .where(
        and(
          eq(timeLogs.agencyId, agencyId),
          gte(timeLogs.logDate, startDate)
        )
      );
    
    return parseFloat(result?.totalHours || '0');
  }

  // Forecasting - Invoices
  async createForecastInvoice(invoice: InsertForecastInvoice): Promise<ForecastInvoice> {
    const [created] = await db.insert(forecastInvoices).values(invoice).returning();
    return created;
  }

  async getForecastInvoices(): Promise<ForecastInvoice[]> {
    return await db.select().from(forecastInvoices).orderBy(desc(forecastInvoices.date));
  }

  async updateForecastInvoice(id: string, updates: Partial<InsertForecastInvoice>): Promise<ForecastInvoice> {
    const [updated] = await db.update(forecastInvoices).set(updates).where(eq(forecastInvoices.id, id)).returning();
    return updated;
  }

  async deleteForecastInvoice(id: string): Promise<void> {
    await db.delete(forecastInvoices).where(eq(forecastInvoices.id, id));
  }

  // Forecasting - Expenses
  async createForecastExpense(expense: InsertForecastExpense): Promise<ForecastExpense> {
    const [created] = await db.insert(forecastExpenses).values(expense).returning();
    return created;
  }

  async getForecastExpenses(): Promise<ForecastExpense[]> {
    return await db.select().from(forecastExpenses).orderBy(desc(forecastExpenses.date));
  }

  async updateForecastExpense(id: string, updates: Partial<InsertForecastExpense>): Promise<ForecastExpense> {
    const [updated] = await db.update(forecastExpenses).set(updates).where(eq(forecastExpenses.id, id)).returning();
    return updated;
  }

  async deleteForecastExpense(id: string): Promise<void> {
    await db.delete(forecastExpenses).where(eq(forecastExpenses.id, id));
  }

  // Forecasting - Payroll Members
  async createForecastPayrollMember(member: InsertForecastPayrollMember): Promise<ForecastPayrollMember> {
    const [created] = await db.insert(forecastPayrollMembers).values(member).returning();
    return created;
  }

  async getForecastPayrollMembers(): Promise<ForecastPayrollMember[]> {
    return await db.select().from(forecastPayrollMembers).where(eq(forecastPayrollMembers.isActive, true)).orderBy(forecastPayrollMembers.name);
  }

  async updateForecastPayrollMember(id: string, updates: Partial<InsertForecastPayrollMember>): Promise<ForecastPayrollMember> {
    const [updated] = await db.update(forecastPayrollMembers).set({...updates, updatedAt: new Date()}).where(eq(forecastPayrollMembers.id, id)).returning();
    return updated;
  }

  async deleteForecastPayrollMember(id: string): Promise<void> {
    await db.delete(forecastPayrollMembers).where(eq(forecastPayrollMembers.id, id));
  }

  // Forecasting - Scenarios
  async createForecastScenario(scenario: InsertForecastScenario): Promise<ForecastScenario> {
    const [created] = await db.insert(forecastScenarios).values(scenario).returning();
    return created;
  }

  async getForecastScenarios(): Promise<ForecastScenario[]> {
    return await db.select().from(forecastScenarios).orderBy(desc(forecastScenarios.createdAt));
  }

  async updateForecastScenario(id: string, updates: Partial<InsertForecastScenario>): Promise<ForecastScenario> {
    const [updated] = await db.update(forecastScenarios).set(updates).where(eq(forecastScenarios.id, id)).returning();
    return updated;
  }

  async deleteForecastScenario(id: string): Promise<void> {
    await db.delete(forecastScenarios).where(eq(forecastScenarios.id, id));
  }

  // Forecasting - Retainers
  async createForecastRetainer(retainer: InsertForecastRetainer): Promise<ForecastRetainer> {
    const [created] = await db.insert(forecastRetainers).values(retainer).returning();
    return created;
  }

  async getForecastRetainers(): Promise<ForecastRetainer[]> {
    return await db.select().from(forecastRetainers).where(eq(forecastRetainers.isActive, true)).orderBy(desc(forecastRetainers.startDate));
  }

  async updateForecastRetainer(id: string, updates: Partial<InsertForecastRetainer>): Promise<ForecastRetainer> {
    const [updated] = await db.update(forecastRetainers).set(updates).where(eq(forecastRetainers.id, id)).returning();
    return updated;
  }

  async deleteForecastRetainer(id: string): Promise<void> {
    await db.delete(forecastRetainers).where(eq(forecastRetainers.id, id));
  }

  // Forecasting - Account Revenue
  async createForecastAccountRevenue(revenue: InsertForecastAccountRevenue): Promise<ForecastAccountRevenue> {
    const [created] = await db.insert(forecastAccountRevenue).values(revenue).returning();
    return created;
  }

  async getForecastAccountRevenue(): Promise<ForecastAccountRevenue[]> {
    return await db.select().from(forecastAccountRevenue).where(eq(forecastAccountRevenue.isActive, true)).orderBy(desc(forecastAccountRevenue.startDate));
  }

  async updateForecastAccountRevenue(id: string, updates: Partial<InsertForecastAccountRevenue>): Promise<ForecastAccountRevenue> {
    const [updated] = await db.update(forecastAccountRevenue).set(updates).where(eq(forecastAccountRevenue.id, id)).returning();
    return updated;
  }

  async deleteForecastAccountRevenue(id: string): Promise<void> {
    await db.delete(forecastAccountRevenue).where(eq(forecastAccountRevenue.id, id));
  }

  // Forecasting - Settings
  async getForecastSettings(): Promise<ForecastSettings | null> {
    const [settings] = await db.select().from(forecastSettings).limit(1);
    return settings || null;
  }

  async upsertForecastSettings(settings: InsertForecastSettings): Promise<ForecastSettings> {
    const existing = await this.getForecastSettings();
    if (existing) {
      const [updated] = await db.update(forecastSettings)
        .set({ ...settings, updatedAt: sql`NOW()` })
        .where(eq(forecastSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(forecastSettings).values(settings).returning();
      return created;
    }
  }

  // Forecasting - Capacity Resources
  async createForecastCapacityResource(resource: InsertForecastCapacityResource): Promise<ForecastCapacityResource> {
    const [created] = await db.insert(forecastCapacityResources).values(resource).returning();
    return created;
  }

  async getForecastCapacityResources(): Promise<ForecastCapacityResource[]> {
    return await db.select().from(forecastCapacityResources).where(eq(forecastCapacityResources.isActive, true)).orderBy(forecastCapacityResources.name);
  }

  async updateForecastCapacityResource(id: string, updates: Partial<InsertForecastCapacityResource>): Promise<ForecastCapacityResource> {
    const [updated] = await db.update(forecastCapacityResources).set({ ...updates, updatedAt: new Date() }).where(eq(forecastCapacityResources.id, id)).returning();
    return updated;
  }

  async deleteForecastCapacityResource(id: string): Promise<void> {
    await db.delete(forecastCapacityResources).where(eq(forecastCapacityResources.id, id));
  }

  // Forecasting - Capacity Allocations
  async createForecastCapacityAllocation(allocation: InsertForecastCapacityAllocation): Promise<ForecastCapacityAllocation> {
    const [created] = await db.insert(forecastCapacityAllocations).values(allocation).returning();
    return created;
  }

  async getForecastCapacityAllocations(): Promise<ForecastCapacityAllocation[]> {
    return await db.select().from(forecastCapacityAllocations).where(eq(forecastCapacityAllocations.isActive, true)).orderBy(desc(forecastCapacityAllocations.startMonth));
  }

  async updateForecastCapacityAllocation(id: string, updates: Partial<InsertForecastCapacityAllocation>): Promise<ForecastCapacityAllocation> {
    const [updated] = await db.update(forecastCapacityAllocations).set({ ...updates, updatedAt: new Date() }).where(eq(forecastCapacityAllocations.id, id)).returning();
    return updated;
  }

  async deleteForecastCapacityAllocation(id: string): Promise<void> {
    await db.delete(forecastCapacityAllocations).where(eq(forecastCapacityAllocations.id, id));
  }

  // Forecasting - Resources (capacity planning)
  async createForecastResource(resource: InsertForecastResource): Promise<ForecastResource> {
    const [created] = await db.insert(forecastResources).values(resource).returning();
    return created;
  }

  async getForecastResources(): Promise<ForecastResource[]> {
    return await db.select().from(forecastResources).where(eq(forecastResources.isActive, true));
  }

  async updateForecastResource(id: string, updates: Partial<InsertForecastResource>): Promise<ForecastResource> {
    const [updated] = await db.update(forecastResources).set(updates).where(eq(forecastResources.id, id)).returning();
    return updated;
  }

  async deleteForecastResource(id: string): Promise<void> {
    await db.delete(forecastResources).where(eq(forecastResources.id, id));
  }

  // Forecasting - Resource Monthly Capacity
  async upsertResourceMonthlyCapacity(capacity: InsertResourceMonthlyCapacity): Promise<ResourceMonthlyCapacity> {
    const existing = await this.getResourceMonthlyCapacity(capacity.resourceId, capacity.month);
    if (existing) {
      const [updated] = await db.update(resourceMonthlyCapacity)
        .set({ ...capacity, updatedAt: sql`NOW()` })
        .where(eq(resourceMonthlyCapacity.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(resourceMonthlyCapacity).values(capacity).returning();
      return created;
    }
  }

  async getResourceMonthlyCapacity(resourceId: string, month: string): Promise<ResourceMonthlyCapacity | undefined> {
    const [result] = await db.select().from(resourceMonthlyCapacity)
      .where(and(eq(resourceMonthlyCapacity.resourceId, resourceId), eq(resourceMonthlyCapacity.month, month)));
    return result;
  }

  async getResourceMonthlyCapacityByMonth(month: string): Promise<ResourceMonthlyCapacity[]> {
    return await db.select().from(resourceMonthlyCapacity).where(eq(resourceMonthlyCapacity.month, month));
  }

  async getAllResourceMonthlyCapacity(): Promise<ResourceMonthlyCapacity[]> {
    return await db.select().from(resourceMonthlyCapacity).orderBy(desc(resourceMonthlyCapacity.month));
  }

  async deleteResourceMonthlyCapacity(id: string): Promise<void> {
    await db.delete(resourceMonthlyCapacity).where(eq(resourceMonthlyCapacity.id, id));
  }

  // Forecasting - Account Allocations
  async createAccountForecastAllocation(allocation: InsertAccountForecastAllocation): Promise<AccountForecastAllocation> {
    const [created] = await db.insert(accountForecastAllocations).values(allocation).returning();
    return created;
  }

  async getAccountForecastAllocations(): Promise<AccountForecastAllocation[]> {
    return await db.select().from(accountForecastAllocations).orderBy(desc(accountForecastAllocations.month));
  }

  async getAccountForecastAllocationsByMonth(month: string): Promise<AccountForecastAllocation[]> {
    return await db.select().from(accountForecastAllocations).where(eq(accountForecastAllocations.month, month));
  }

  async getAccountForecastAllocationsByResource(resourceId: string): Promise<AccountForecastAllocation[]> {
    return await db.select().from(accountForecastAllocations).where(eq(accountForecastAllocations.resourceId, resourceId));
  }

  async updateAccountForecastAllocation(id: string, updates: Partial<InsertAccountForecastAllocation>): Promise<AccountForecastAllocation> {
    const [updated] = await db.update(accountForecastAllocations).set({...updates, updatedAt: sql`NOW()`}).where(eq(accountForecastAllocations.id, id)).returning();
    return updated;
  }

  async deleteAccountForecastAllocation(id: string): Promise<void> {
    await db.delete(accountForecastAllocations).where(eq(accountForecastAllocations.id, id));
  }

  // Project Team Members
  async createProjectTeamMember(member: InsertProjectTeamMember): Promise<ProjectTeamMember> {
    const [created] = await db.insert(projectTeamMembers).values(member).returning();
    return created;
  }

  async getProjectTeamMembers(projectId: string): Promise<ProjectTeamMemberWithUser[]> {
    const members = await db
      .select()
      .from(projectTeamMembers)
      .leftJoin(users, eq(projectTeamMembers.userId, users.id))
      .where(eq(projectTeamMembers.projectId, projectId));
    
    return members.map(({ project_team_members, users: user }) => ({
      ...project_team_members,
      user: user!
    }));
  }

  async getProjectTeamMembersByUser(userId: string): Promise<ProjectTeamMemberWithUser[]> {
    const members = await db
      .select()
      .from(projectTeamMembers)
      .leftJoin(users, eq(projectTeamMembers.userId, users.id))
      .where(eq(projectTeamMembers.userId, userId));
    
    return members.map(({ project_team_members, users: user }) => ({
      ...project_team_members,
      user: user!
    }));
  }

  async updateProjectTeamMember(id: string, updates: Partial<InsertProjectTeamMember>): Promise<ProjectTeamMember> {
    const [updated] = await db
      .update(projectTeamMembers)
      .set(updates)
      .where(eq(projectTeamMembers.id, id))
      .returning();
    return updated;
  }

  async deleteProjectTeamMember(id: string): Promise<void> {
    await db.delete(projectTeamMembers).where(eq(projectTeamMembers.id, id));
  }

  async getProjectsWithTeam(): Promise<ProjectWithTeamAndRelations[]> {
    const allProjects = await db
      .select()
      .from(projects)
      .leftJoin(accounts, eq(projects.accountId, accounts.id))
      .leftJoin(agencies, eq(projects.agencyId, agencies.id))
      .where(and(eq(projects.isActive, true), isNull(projects.deletedAt)));

    const projectsWithTeam: ProjectWithTeamAndRelations[] = [];

    for (const { projects: project, accounts: account, agencies: agency } of allProjects) {
      const teamMembers = await this.getProjectTeamMembers(project.id);
      
      projectsWithTeam.push({
        ...project,
        account: account!,
        agency: agency!,
        teamMembers
      });
    }

    return projectsWithTeam;
  }

  // User Availability
  async createUserAvailability(availability: InsertUserAvailability): Promise<UserAvailability> {
    const [created] = await db.insert(userAvailability).values(availability).returning();
    return created;
  }

  async getUserAvailability(userId: string): Promise<UserAvailabilityWithUser[]> {
    const availability = await db
      .select()
      .from(userAvailability)
      .leftJoin(users, eq(userAvailability.userId, users.id))
      .where(eq(userAvailability.userId, userId))
      .orderBy(desc(userAvailability.startDate));
    
    return availability.map(({ user_availability, users: user }) => ({
      ...user_availability,
      user: user!
    }));
  }

  async getAllUserAvailability(): Promise<UserAvailabilityWithUser[]> {
    const availability = await db
      .select()
      .from(userAvailability)
      .leftJoin(users, eq(userAvailability.userId, users.id))
      .orderBy(desc(userAvailability.startDate));
    
    return availability.map(({ user_availability, users: user }) => ({
      ...user_availability,
      user: user!
    }));
  }

  async getUserAvailabilityByDateRange(startDate: Date, endDate: Date): Promise<UserAvailabilityWithUser[]> {
    const availability = await db
      .select()
      .from(userAvailability)
      .leftJoin(users, eq(userAvailability.userId, users.id))
      .where(
        and(
          gte(userAvailability.endDate, startDate.toISOString().split('T')[0]),
          lte(userAvailability.startDate, endDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(userAvailability.startDate));
    
    return availability.map(({ user_availability, users: user }) => ({
      ...user_availability,
      user: user!
    }));
  }

  async updateUserAvailability(id: string, updates: Partial<InsertUserAvailability>): Promise<UserAvailability> {
    const [updated] = await db
      .update(userAvailability)
      .set(updates)
      .where(eq(userAvailability.id, id))
      .returning();
    return updated;
  }

  async deleteUserAvailability(id: string): Promise<void> {
    await db.delete(userAvailability).where(eq(userAvailability.id, id));
  }

  // Company Holidays
  async createHoliday(holiday: InsertHoliday): Promise<Holiday> {
    const [created] = await db.insert(holidays).values(holiday).returning();
    return created;
  }

  async getHolidays(): Promise<Holiday[]> {
    return await db.select().from(holidays).where(eq(holidays.isActive, true)).orderBy(holidays.date);
  }

  async getHolidaysByDateRange(startDate: Date, endDate: Date): Promise<Holiday[]> {
    // Use toISOString to get UTC date, which is consistent with how database date fields work
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    return await db
      .select()
      .from(holidays)
      .where(
        and(
          eq(holidays.isActive, true),
          // Holiday overlaps with query range if:
          // - Holiday start date <= query end date
          // - Holiday end date (or start date if null) >= query start date
          lte(holidays.date, endStr),
          or(
            gte(holidays.endDate, startStr),
            and(
              isNull(holidays.endDate),
              gte(holidays.date, startStr)
            )
          )
        )
      )
      .orderBy(holidays.date);
  }

  async updateHoliday(id: string, updates: Partial<InsertHoliday>): Promise<Holiday> {
    const [updated] = await db
      .update(holidays)
      .set(updates)
      .where(eq(holidays.id, id))
      .returning();
    return updated;
  }

  async deleteHoliday(id: string): Promise<void> {
    await db.delete(holidays).where(eq(holidays.id, id));
  }

  // Proposals
  async createProposal(proposal: InsertProposal): Promise<Proposal> {
    const [created] = await db.insert(proposals).values(proposal).returning();
    return created;
  }

  async getProposal(id: string): Promise<Proposal | undefined> {
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
    return proposal;
  }

  async getProposalBySlug(slug: string): Promise<ProposalWithProject | undefined> {
    const results = await db
      .select()
      .from(proposals)
      .leftJoin(projects, eq(proposals.projectId, projects.id))
      .where(eq(proposals.slug, slug));

    if (results.length === 0) return undefined;

    const { proposals: proposal, projects: project } = results[0];
    return {
      ...proposal,
      project: project || undefined
    };
  }

  async getProposals(): Promise<ProposalWithProject[]> {
    const results = await db
      .select()
      .from(proposals)
      .leftJoin(projects, eq(proposals.projectId, projects.id))
      .orderBy(desc(proposals.createdAt));

    return results.map(({ proposals: proposal, projects: project }) => ({
      ...proposal,
      project: project || undefined
    }));
  }

  async updateProposal(id: string, updates: Partial<InsertProposal>): Promise<Proposal> {
    const [updated] = await db
      .update(proposals)
      .set({ ...updates, updatedAt: new Date(), lastEditedAt: new Date() })
      .where(eq(proposals.id, id))
      .returning();
    return updated;
  }

  async deleteProposal(id: string): Promise<void> {
    await db.delete(proposals).where(eq(proposals.id, id));
  }

  async getProposalWithScopeItems(id: string): Promise<ProposalWithScopeItems | undefined> {
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
    if (!proposal) return undefined;

    const scopeItems = await db
      .select()
      .from(proposalScopeItems)
      .where(eq(proposalScopeItems.proposalId, id))
      .orderBy(proposalScopeItems.order);

    return {
      ...proposal,
      scopeItems
    };
  }

  // Proposal Scope Items
  async createProposalScopeItem(item: InsertProposalScopeItem): Promise<ProposalScopeItem> {
    const [created] = await db.insert(proposalScopeItems).values(item).returning();
    return created;
  }

  async getProposalScopeItem(id: string): Promise<ProposalScopeItem | undefined> {
    const [item] = await db.select().from(proposalScopeItems).where(eq(proposalScopeItems.id, id));
    return item;
  }

  async getProposalScopeItemsByProposal(proposalId: string): Promise<ProposalScopeItem[]> {
    return await db
      .select()
      .from(proposalScopeItems)
      .where(eq(proposalScopeItems.proposalId, proposalId))
      .orderBy(proposalScopeItems.order);
  }

  async updateProposalScopeItem(id: string, updates: Partial<InsertProposalScopeItem>): Promise<ProposalScopeItem> {
    const [updated] = await db
      .update(proposalScopeItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(proposalScopeItems.id, id))
      .returning();
    return updated;
  }

  async deleteProposalScopeItem(id: string): Promise<void> {
    await db.delete(proposalScopeItems).where(eq(proposalScopeItems.id, id));
  }

  async bulkCreateProposalScopeItems(items: InsertProposalScopeItem[]): Promise<ProposalScopeItem[]> {
    if (items.length === 0) return [];
    const created = await db.insert(proposalScopeItems).values(items).returning();
    return created;
  }

  async deleteProposalScopeItemsByProposal(proposalId: string): Promise<void> {
    await db.delete(proposalScopeItems).where(eq(proposalScopeItems.proposalId, proposalId));
  }

  // Knowledge Base Documents
  async createKnowledgeBaseDocument(doc: InsertKnowledgeBaseDocument): Promise<KnowledgeBaseDocument> {
    const [created] = await db.insert(knowledgeBaseDocuments).values(doc).returning();
    return created;
  }

  async getKnowledgeBaseDocument(id: string): Promise<KnowledgeBaseDocument | undefined> {
    const [doc] = await db.select().from(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, id));
    return doc;
  }

  async getKnowledgeBaseDocuments(): Promise<KnowledgeBaseDocument[]> {
    return await db
      .select()
      .from(knowledgeBaseDocuments)
      .where(eq(knowledgeBaseDocuments.isActive, true))
      .orderBy(desc(knowledgeBaseDocuments.createdAt));
  }

  async updateKnowledgeBaseDocument(id: string, updates: Partial<InsertKnowledgeBaseDocument>): Promise<KnowledgeBaseDocument> {
    const [updated] = await db
      .update(knowledgeBaseDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(knowledgeBaseDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBaseDocument(id: string): Promise<void> {
    await db.delete(knowledgeBaseDocuments).where(eq(knowledgeBaseDocuments.id, id));
  }

  // Guidance Settings
  async createGuidanceSetting(setting: InsertGuidanceSetting): Promise<GuidanceSetting> {
    const [created] = await db.insert(guidanceSettings).values(setting).returning();
    return created;
  }

  async getGuidanceSetting(id: string): Promise<GuidanceSetting | undefined> {
    const [setting] = await db.select().from(guidanceSettings).where(eq(guidanceSettings.id, id));
    return setting;
  }

  async getGuidanceSettings(): Promise<GuidanceSetting[]> {
    return await db
      .select()
      .from(guidanceSettings)
      .where(eq(guidanceSettings.isActive, true))
      .orderBy(guidanceSettings.order);
  }

  async getGuidanceSettingsByCategory(category: string): Promise<GuidanceSetting[]> {
    return await db
      .select()
      .from(guidanceSettings)
      .where(and(eq(guidanceSettings.category, category), eq(guidanceSettings.isActive, true)))
      .orderBy(guidanceSettings.order);
  }

  async updateGuidanceSetting(id: string, updates: Partial<InsertGuidanceSetting>): Promise<GuidanceSetting> {
    const [updated] = await db
      .update(guidanceSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(guidanceSettings.id, id))
      .returning();
    return updated;
  }

  async deleteGuidanceSetting(id: string): Promise<void> {
    await db.delete(guidanceSettings).where(eq(guidanceSettings.id, id));
  }

  // Chat Transcripts
  async createChatTranscript(transcript: InsertChatTranscript): Promise<ChatTranscript> {
    const [created] = await db.insert(chatTranscripts).values(transcript).returning();
    return created;
  }

  async getChatTranscript(id: string): Promise<ChatTranscript | undefined> {
    const [transcript] = await db.select().from(chatTranscripts).where(eq(chatTranscripts.id, id));
    return transcript;
  }

  async getChatTranscripts(): Promise<ChatTranscript[]> {
    return await db.select().from(chatTranscripts).orderBy(desc(chatTranscripts.createdAt));
  }

  async updateChatTranscript(id: string, updates: Partial<InsertChatTranscript>): Promise<ChatTranscript> {
    const [updated] = await db
      .update(chatTranscripts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chatTranscripts.id, id))
      .returning();
    return updated;
  }

  async deleteChatTranscript(id: string): Promise<void> {
    await db.delete(chatTranscripts).where(eq(chatTranscripts.id, id));
  }

  // Pipeline Stages
  async getPipelineStages(): Promise<PipelineStage[]> {
    return await db.select().from(pipelineStages).orderBy(pipelineStages.order);
  }

  async getPipelineStagesByType(type: string): Promise<PipelineStage[]> {
    return await db.select().from(pipelineStages)
      .where(eq(pipelineStages.type, type))
      .orderBy(pipelineStages.order);
  }

  async createPipelineStage(stage: InsertPipelineStage): Promise<PipelineStage> {
    const [created] = await db.insert(pipelineStages).values(stage).returning();
    return created;
  }

  async updatePipelineStage(id: string, updates: Partial<InsertPipelineStage>): Promise<PipelineStage> {
    const [updated] = await db
      .update(pipelineStages)
      .set(updates)
      .where(eq(pipelineStages.id, id))
      .returning();
    return updated;
  }

  async deletePipelineStage(id: string): Promise<void> {
    await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
  }

  // Leads
  async getLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead> {
    const [updated] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updated;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leads).where(eq(leads.id, id));
  }

  async getLeadsWithStage(): Promise<LeadWithStage[]> {
    const result = await db
      .select({
        id: leads.id,
        name: leads.name,
        company: leads.company,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        contactPhone: leads.contactPhone,
        linkedInUrl: leads.linkedInUrl,
        source: leads.source,
        value: leads.value,
        priority: leads.priority,
        nextStep: leads.nextStep,
        lastContactedAt: leads.lastContactedAt,
        position: leads.position,
        stageId: leads.stageId,
        assignedToUserId: leads.assignedToUserId,
        notes: leads.notes,
        isActive: leads.isActive,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        stage: {
          id: pipelineStages.id,
          name: pipelineStages.name,
          type: pipelineStages.type,
          order: pipelineStages.order,
          color: pipelineStages.color,
          isActive: pipelineStages.isActive,
          createdAt: pipelineStages.createdAt,
        },
        assignedToUser: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(leads)
      .innerJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
      .leftJoin(users, eq(leads.assignedToUserId, users.id))
      .where(eq(leads.isActive, true))
      .orderBy(desc(leads.updatedAt));
    
    return result as LeadWithStage[];
  }

  async getLeadWithStage(id: string): Promise<LeadWithStage | undefined> {
    const [result] = await db
      .select({
        id: leads.id,
        name: leads.name,
        company: leads.company,
        contactName: leads.contactName,
        contactEmail: leads.contactEmail,
        contactPhone: leads.contactPhone,
        linkedInUrl: leads.linkedInUrl,
        source: leads.source,
        value: leads.value,
        priority: leads.priority,
        nextStep: leads.nextStep,
        lastContactedAt: leads.lastContactedAt,
        position: leads.position,
        stageId: leads.stageId,
        assignedToUserId: leads.assignedToUserId,
        notes: leads.notes,
        isActive: leads.isActive,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        stage: {
          id: pipelineStages.id,
          name: pipelineStages.name,
          type: pipelineStages.type,
          order: pipelineStages.order,
          color: pipelineStages.color,
          isActive: pipelineStages.isActive,
          createdAt: pipelineStages.createdAt,
        },
        assignedToUser: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(leads)
      .innerJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
      .leftJoin(users, eq(leads.assignedToUserId, users.id))
      .where(eq(leads.id, id));
    
    return result as LeadWithStage | undefined;
  }

  // Lead Activities
  async getLeadActivities(leadId: string): Promise<LeadActivityWithUser[]> {
    const result = await db
      .select({
        id: leadActivities.id,
        leadId: leadActivities.leadId,
        type: leadActivities.type,
        description: leadActivities.description,
        occurredAt: leadActivities.occurredAt,
        createdByUserId: leadActivities.createdByUserId,
        createdAt: leadActivities.createdAt,
        createdByUser: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(leadActivities)
      .leftJoin(users, eq(leadActivities.createdByUserId, users.id))
      .where(eq(leadActivities.leadId, leadId))
      .orderBy(desc(leadActivities.occurredAt));
    
    return result as LeadActivityWithUser[];
  }

  async createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity> {
    const [created] = await db.insert(leadActivities).values(activity).returning();
    return created;
  }

  async deleteLeadActivity(id: string): Promise<void> {
    await db.delete(leadActivities).where(eq(leadActivities.id, id));
  }

  // Deals
  async getDeals(): Promise<Deal[]> {
    return await db.select().from(deals).orderBy(desc(deals.createdAt));
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  async updateDeal(id: string, updates: Partial<InsertDeal>): Promise<Deal> {
    const [updated] = await db
      .update(deals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    return updated;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  // API Keys
  async getApiKeysByUser(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyById(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }

  async createApiKey(apiKey: InsertApiKey): Promise<ApiKey> {
    const [created] = await db.insert(apiKeys).values(apiKey).returning();
    return created;
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async revokeApiKey(id: string): Promise<void> {
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async validateApiKey(keyPrefix: string, hashedKey: string): Promise<{ apiKey: ApiKey; user: User } | undefined> {
    const [result] = await db
      .select({
        apiKey: apiKeys,
        user: users,
      })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(
        and(
          eq(apiKeys.keyPrefix, keyPrefix),
          eq(apiKeys.hashedKey, hashedKey),
          isNull(apiKeys.revokedAt)
        )
      );
    
    if (!result) return undefined;
    
    // Check expiration
    if (result.apiKey.expiresAt && new Date(result.apiKey.expiresAt) < new Date()) {
      return undefined;
    }
    
    return result;
  }

  // UAT Sessions
  async getUatSessions(): Promise<UatSession[]> {
    return await db.select().from(uatSessions).orderBy(desc(uatSessions.createdAt));
  }

  async getUatSession(id: string): Promise<UatSession | undefined> {
    const [session] = await db.select().from(uatSessions).where(eq(uatSessions.id, id));
    return session;
  }

  async getUatSessionByInviteToken(token: string): Promise<UatSession | undefined> {
    const [session] = await db.select().from(uatSessions).where(eq(uatSessions.inviteToken, token));
    return session;
  }

  async getUatSessionWithRelations(id: string): Promise<UatSessionWithRelations | undefined> {
    const [session] = await db.select().from(uatSessions).where(eq(uatSessions.id, id));
    if (!session) return undefined;

    const [createdBy] = await db.select().from(users).where(eq(users.id, session.createdById));
    const project = session.projectId 
      ? (await db.select().from(projects).where(eq(projects.id, session.projectId)))[0]
      : undefined;
    const account = session.accountId
      ? (await db.select().from(accounts).where(eq(accounts.id, session.accountId)))[0]
      : undefined;
    const checklistItems = await db.select().from(uatChecklistItems)
      .where(eq(uatChecklistItems.sessionId, id))
      .orderBy(uatChecklistItems.order);
    const guests = await db.select().from(uatGuests).where(eq(uatGuests.sessionId, id));

    return {
      ...session,
      createdBy,
      project,
      account,
      checklistItems,
      guests,
    };
  }

  async createUatSession(session: InsertUatSession): Promise<UatSession> {
    const [created] = await db.insert(uatSessions).values(session).returning();
    return created;
  }

  async updateUatSession(id: string, updates: Partial<InsertUatSession>): Promise<UatSession> {
    const [updated] = await db
      .update(uatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uatSessions.id, id))
      .returning();
    return updated;
  }

  async deleteUatSession(id: string): Promise<void> {
    await db.delete(uatSessions).where(eq(uatSessions.id, id));
  }

  // UAT Guests
  async getUatGuests(sessionId: string): Promise<UatGuest[]> {
    return await db.select().from(uatGuests).where(eq(uatGuests.sessionId, sessionId));
  }

  async getUatGuest(id: string): Promise<UatGuest | undefined> {
    const [guest] = await db.select().from(uatGuests).where(eq(uatGuests.id, id));
    return guest;
  }

  async getUatGuestByAccessToken(token: string): Promise<UatGuest | undefined> {
    const [guest] = await db.select().from(uatGuests).where(eq(uatGuests.accessToken, token));
    return guest;
  }

  async createUatGuest(guest: InsertUatGuest): Promise<UatGuest> {
    const [created] = await db.insert(uatGuests).values(guest).returning();
    return created;
  }

  async updateUatGuestLastAccessed(id: string): Promise<void> {
    await db.update(uatGuests).set({ lastAccessedAt: new Date() }).where(eq(uatGuests.id, id));
  }

  async deleteUatGuest(id: string): Promise<void> {
    await db.delete(uatGuests).where(eq(uatGuests.id, id));
  }

  // UAT Session Collaborators
  async getUatSessionCollaborators(sessionId: string): Promise<UatSessionCollaborator[]> {
    return await db.select().from(uatSessionCollaborators).where(eq(uatSessionCollaborators.sessionId, sessionId));
  }

  async getUatSessionCollaboratorByToken(token: string): Promise<UatSessionCollaborator | undefined> {
    const [collaborator] = await db.select().from(uatSessionCollaborators).where(eq(uatSessionCollaborators.accessToken, token));
    return collaborator;
  }

  async createUatSessionCollaborator(collaborator: InsertUatSessionCollaborator): Promise<UatSessionCollaborator> {
    const [created] = await db.insert(uatSessionCollaborators).values(collaborator).returning();
    return created;
  }

  async updateUatSessionCollaboratorLastAccessed(id: string): Promise<void> {
    await db.update(uatSessionCollaborators).set({ lastAccessedAt: new Date() }).where(eq(uatSessionCollaborators.id, id));
  }

  async deleteUatSessionCollaborator(id: string): Promise<void> {
    await db.delete(uatSessionCollaborators).where(eq(uatSessionCollaborators.id, id));
  }

  // UAT Checklist Items
  async getUatChecklistItems(sessionId: string): Promise<UatChecklistItem[]> {
    return await db.select().from(uatChecklistItems)
      .where(eq(uatChecklistItems.sessionId, sessionId))
      .orderBy(uatChecklistItems.order);
  }

  async getUatChecklistItem(id: string): Promise<UatChecklistItem | undefined> {
    const [item] = await db.select().from(uatChecklistItems).where(eq(uatChecklistItems.id, id));
    return item;
  }

  async createUatChecklistItem(item: InsertUatChecklistItem): Promise<UatChecklistItem> {
    const [created] = await db.insert(uatChecklistItems).values(item).returning();
    return created;
  }

  async updateUatChecklistItem(id: string, updates: Partial<InsertUatChecklistItem>): Promise<UatChecklistItem> {
    const [updated] = await db
      .update(uatChecklistItems)
      .set(updates)
      .where(eq(uatChecklistItems.id, id))
      .returning();
    return updated;
  }

  async deleteUatChecklistItem(id: string): Promise<void> {
    await db.delete(uatChecklistItems).where(eq(uatChecklistItems.id, id));
  }

  async reorderUatChecklistItems(sessionId: string, itemIds: string[]): Promise<void> {
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(uatChecklistItems)
        .set({ order: i })
        .where(and(
          eq(uatChecklistItems.id, itemIds[i]),
          eq(uatChecklistItems.sessionId, sessionId)
        ));
    }
  }

  // UAT Responses
  async getUatResponses(checklistItemId: string): Promise<UatResponse[]> {
    return await db.select().from(uatResponses).where(eq(uatResponses.checklistItemId, checklistItemId));
  }

  async getUatResponsesByGuest(guestId: string): Promise<UatResponse[]> {
    return await db.select().from(uatResponses).where(eq(uatResponses.guestId, guestId));
  }

  async getUatResponsesBySession(sessionId: string): Promise<UatResponse[]> {
    // Get all checklist items for the session, then get all responses for those items
    const items = await db.select().from(uatChecklistItems).where(eq(uatChecklistItems.sessionId, sessionId));
    if (items.length === 0) return [];
    
    const itemIds = items.map(item => item.id);
    const allResponses: UatResponse[] = [];
    for (const itemId of itemIds) {
      const responses = await db.select().from(uatResponses).where(eq(uatResponses.checklistItemId, itemId));
      allResponses.push(...responses);
    }
    return allResponses;
  }

  async getUatResponse(checklistItemId: string, guestId: string): Promise<UatResponse | undefined> {
    const [response] = await db.select().from(uatResponses)
      .where(and(
        eq(uatResponses.checklistItemId, checklistItemId),
        eq(uatResponses.guestId, guestId)
      ));
    return response;
  }

  async createUatResponse(response: InsertUatResponse): Promise<UatResponse> {
    const [created] = await db.insert(uatResponses).values(response).returning();
    return created;
  }

  async updateUatResponse(id: string, updates: Partial<InsertUatResponse>): Promise<UatResponse> {
    const [updated] = await db
      .update(uatResponses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uatResponses.id, id))
      .returning();
    return updated;
  }

  // UAT Item Comments
  async getUatItemComments(itemId: string): Promise<UatItemComment[]> {
    return await db.select().from(uatItemComments).where(eq(uatItemComments.itemId, itemId)).orderBy(uatItemComments.createdAt);
  }

  async getUatItemComment(id: string): Promise<UatItemComment | undefined> {
    const [comment] = await db.select().from(uatItemComments).where(eq(uatItemComments.id, id));
    return comment;
  }

  async createUatItemComment(comment: InsertUatItemComment): Promise<UatItemComment> {
    const [created] = await db.insert(uatItemComments).values(comment).returning();
    return created;
  }

  async updateUatItemComment(id: string, updates: Partial<InsertUatItemComment>): Promise<UatItemComment> {
    const [updated] = await db
      .update(uatItemComments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(uatItemComments.id, id))
      .returning();
    return updated;
  }

  async deleteUatItemComment(id: string): Promise<void> {
    await db.delete(uatItemComments).where(eq(uatItemComments.id, id));
  }

  // UAT Checklist Item Steps
  async getUatChecklistItemSteps(itemId: string): Promise<UatChecklistItemStep[]> {
    return await db.select().from(uatChecklistItemSteps).where(eq(uatChecklistItemSteps.itemId, itemId)).orderBy(uatChecklistItemSteps.order);
  }

  async getUatChecklistItemStep(id: string): Promise<UatChecklistItemStep | undefined> {
    const [step] = await db.select().from(uatChecklistItemSteps).where(eq(uatChecklistItemSteps.id, id));
    return step;
  }

  async createUatChecklistItemStep(step: InsertUatChecklistItemStep): Promise<UatChecklistItemStep> {
    const [created] = await db.insert(uatChecklistItemSteps).values(step).returning();
    return created;
  }

  async updateUatChecklistItemStep(id: string, updates: Partial<InsertUatChecklistItemStep>): Promise<UatChecklistItemStep> {
    const [updated] = await db
      .update(uatChecklistItemSteps)
      .set(updates)
      .where(eq(uatChecklistItemSteps.id, id))
      .returning();
    return updated;
  }

  async deleteUatChecklistItemStep(id: string): Promise<void> {
    await db.delete(uatChecklistItemSteps).where(eq(uatChecklistItemSteps.id, id));
  }

  async reorderUatChecklistItemSteps(itemId: string, stepIds: string[]): Promise<void> {
    for (let i = 0; i < stepIds.length; i++) {
      await db.update(uatChecklistItemSteps)
        .set({ order: i })
        .where(and(eq(uatChecklistItemSteps.id, stepIds[i]), eq(uatChecklistItemSteps.itemId, itemId)));
    }
  }

  // UAT Test Runs
  async getUatTestRun(id: string): Promise<UatTestRun | undefined> {
    const [run] = await db.select().from(uatTestRuns).where(eq(uatTestRuns.id, id));
    return run;
  }

  async getUatTestRuns(itemId: string): Promise<UatTestRun[]> {
    return await db.select().from(uatTestRuns).where(eq(uatTestRuns.itemId, itemId)).orderBy(desc(uatTestRuns.runNumber));
  }

  async getActiveUatTestRun(itemId: string): Promise<UatTestRun | undefined> {
    const [run] = await db.select().from(uatTestRuns)
      .where(and(eq(uatTestRuns.itemId, itemId), eq(uatTestRuns.status, "active")))
      .orderBy(desc(uatTestRuns.runNumber))
      .limit(1);
    return run;
  }

  async createUatTestRun(run: InsertUatTestRun): Promise<UatTestRun> {
    const [created] = await db.insert(uatTestRuns).values(run).returning();
    return created;
  }

  async updateUatTestRun(id: string, updates: Partial<InsertUatTestRun>): Promise<UatTestRun> {
    const [updated] = await db
      .update(uatTestRuns)
      .set(updates)
      .where(eq(uatTestRuns.id, id))
      .returning();
    return updated;
  }

  async createNewTestRunForRetest(itemId: string, triggeredById?: string): Promise<UatTestRun> {
    // Archive all existing active runs
    await db.update(uatTestRuns)
      .set({ status: "archived" })
      .where(and(eq(uatTestRuns.itemId, itemId), eq(uatTestRuns.status, "active")));
    
    // Get the next run number
    const existingRuns = await db.select().from(uatTestRuns).where(eq(uatTestRuns.itemId, itemId));
    const nextRunNumber = existingRuns.length > 0 
      ? Math.max(...existingRuns.map(r => r.runNumber)) + 1 
      : 1;
    
    // Create new test run
    const [newRun] = await db.insert(uatTestRuns).values({
      itemId,
      runNumber: nextRunNumber,
      status: "active",
      triggerReason: existingRuns.length > 0 ? "remediation_retest" : "initial",
      triggeredById: triggeredById || null,
    }).returning();
    
    // Create empty step results for all steps
    const steps = await this.getUatChecklistItemSteps(itemId);
    for (const step of steps) {
      await db.insert(uatTestStepResults).values({
        runId: newRun.id,
        stepId: step.id,
        status: null,
      });
    }
    
    return newRun;
  }

  // UAT Test Step Results
  async getUatTestStepResults(runId: string): Promise<UatTestStepResult[]> {
    return await db.select().from(uatTestStepResults).where(eq(uatTestStepResults.runId, runId));
  }

  async updateUatTestStepResult(runId: string, stepId: string, updates: Partial<InsertUatTestStepResult>): Promise<UatTestStepResult> {
    const [existing] = await db.select().from(uatTestStepResults)
      .where(and(eq(uatTestStepResults.runId, runId), eq(uatTestStepResults.stepId, stepId)));
    
    if (existing) {
      const [updated] = await db.update(uatTestStepResults)
        .set({ ...updates, updatedAt: new Date(), testedAt: new Date() })
        .where(eq(uatTestStepResults.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(uatTestStepResults).values({
        runId,
        stepId,
        ...updates,
        testedAt: new Date(),
      }).returning();
      return created;
    }
  }

  // ==========================================
  // Training / LMS
  // ==========================================

  // Training Programs
  async getTrainingPrograms(): Promise<TrainingProgram[]> {
    return await db.select().from(trainingPrograms).orderBy(trainingPrograms.order);
  }

  async getTrainingProgram(id: string): Promise<TrainingProgram | undefined> {
    const [program] = await db.select().from(trainingPrograms).where(eq(trainingPrograms.id, id));
    return program;
  }

  async getTrainingProgramWithPhases(id: string): Promise<TrainingProgramWithPhases | undefined> {
    const program = await this.getTrainingProgram(id);
    if (!program) return undefined;

    const phases = await db.select().from(trainingPhases)
      .where(eq(trainingPhases.programId, id))
      .orderBy(trainingPhases.order);

    const phasesWithModules = await Promise.all(
      phases.map(async (phase) => {
        const modules = await db.select().from(trainingModules)
          .where(eq(trainingModules.phaseId, phase.id))
          .orderBy(trainingModules.order);
        return { ...phase, modules };
      })
    );

    return { ...program, phases: phasesWithModules };
  }

  async createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram> {
    const [created] = await db.insert(trainingPrograms).values(program).returning();
    return created;
  }

  async updateTrainingProgram(id: string, updates: Partial<InsertTrainingProgram>): Promise<TrainingProgram> {
    const [updated] = await db.update(trainingPrograms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(trainingPrograms.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingProgram(id: string): Promise<void> {
    await db.delete(trainingPrograms).where(eq(trainingPrograms.id, id));
  }

  // Training Phases
  async getTrainingPhases(programId: string): Promise<TrainingPhase[]> {
    return await db.select().from(trainingPhases)
      .where(eq(trainingPhases.programId, programId))
      .orderBy(trainingPhases.order);
  }

  async getTrainingPhase(id: string): Promise<TrainingPhase | undefined> {
    const [phase] = await db.select().from(trainingPhases).where(eq(trainingPhases.id, id));
    return phase;
  }

  async createTrainingPhase(phase: InsertTrainingPhase): Promise<TrainingPhase> {
    const [created] = await db.insert(trainingPhases).values(phase).returning();
    return created;
  }

  async updateTrainingPhase(id: string, updates: Partial<InsertTrainingPhase>): Promise<TrainingPhase> {
    const [updated] = await db.update(trainingPhases)
      .set(updates)
      .where(eq(trainingPhases.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingPhase(id: string): Promise<void> {
    await db.delete(trainingPhases).where(eq(trainingPhases.id, id));
  }

  // Training Modules
  async getTrainingModules(phaseId: string): Promise<TrainingModule[]> {
    return await db.select().from(trainingModules)
      .where(eq(trainingModules.phaseId, phaseId))
      .orderBy(trainingModules.order);
  }

  async getTrainingModule(id: string): Promise<TrainingModule | undefined> {
    const [mod] = await db.select().from(trainingModules).where(eq(trainingModules.id, id));
    return mod;
  }

  async createTrainingModule(mod: InsertTrainingModule): Promise<TrainingModule> {
    const [created] = await db.insert(trainingModules).values(mod).returning();
    return created;
  }

  async updateTrainingModule(id: string, updates: Partial<InsertTrainingModule>): Promise<TrainingModule> {
    const [updated] = await db.update(trainingModules)
      .set(updates)
      .where(eq(trainingModules.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingModule(id: string): Promise<void> {
    await db.delete(trainingModules).where(eq(trainingModules.id, id));
  }

  // Training Module Sections
  async getTrainingModuleSections(moduleId: string): Promise<TrainingModuleSection[]> {
    return await db.select().from(trainingModuleSections)
      .where(eq(trainingModuleSections.moduleId, moduleId))
      .orderBy(trainingModuleSections.order);
  }

  async createTrainingModuleSection(section: InsertTrainingModuleSection): Promise<TrainingModuleSection> {
    const [created] = await db.insert(trainingModuleSections).values(section).returning();
    return created;
  }

  async updateTrainingModuleSection(id: string, updates: Partial<InsertTrainingModuleSection>): Promise<TrainingModuleSection> {
    const [updated] = await db.update(trainingModuleSections)
      .set(updates)
      .where(eq(trainingModuleSections.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingModuleSection(id: string): Promise<void> {
    await db.delete(trainingModuleSections).where(eq(trainingModuleSections.id, id));
  }

  // Training Enrollments
  async getTrainingEnrollments(userId: string): Promise<TrainingEnrollmentWithProgress[]> {
    const enrollments = await db.select().from(trainingEnrollments)
      .where(eq(trainingEnrollments.userId, userId))
      .orderBy(desc(trainingEnrollments.createdAt));

    return await Promise.all(
      enrollments.map(async (enrollment) => {
        const program = await this.getTrainingProgram(enrollment.programId);
        const submissions = await this.getTrainingModuleSubmissions(enrollment.id);

        // Count total modules in this program
        const phases = await db.select().from(trainingPhases)
          .where(eq(trainingPhases.programId, enrollment.programId));
        let totalModules = 0;
        for (const phase of phases) {
          const modules = await db.select().from(trainingModules)
            .where(eq(trainingModules.phaseId, phase.id));
          totalModules += modules.length;
        }

        const completedModules = submissions.filter(s => s.status === "passed").length;

        return {
          ...enrollment,
          program: program!,
          submissions,
          totalModules,
          completedModules,
        };
      })
    );
  }

  async getTrainingEnrollmentsByProgram(programId: string): Promise<(TrainingEnrollmentWithProgress & { user: User })[]> {
    const enrollments = await db.select().from(trainingEnrollments)
      .where(eq(trainingEnrollments.programId, programId))
      .orderBy(desc(trainingEnrollments.createdAt));

    return await Promise.all(
      enrollments.map(async (enrollment) => {
        const program = await this.getTrainingProgram(enrollment.programId);
        const user = await this.getUser(enrollment.userId);
        const submissions = await this.getTrainingModuleSubmissions(enrollment.id);

        const phases = await db.select().from(trainingPhases)
          .where(eq(trainingPhases.programId, enrollment.programId));
        let totalModules = 0;
        for (const phase of phases) {
          const modules = await db.select().from(trainingModules)
            .where(eq(trainingModules.phaseId, phase.id));
          totalModules += modules.length;
        }

        const completedModules = submissions.filter(s => s.status === "passed").length;

        return {
          ...enrollment,
          program: program!,
          user: user!,
          submissions,
          totalModules,
          completedModules,
        };
      })
    );
  }

  async getTrainingEnrollment(id: string): Promise<TrainingEnrollment | undefined> {
    const [enrollment] = await db.select().from(trainingEnrollments)
      .where(eq(trainingEnrollments.id, id));
    return enrollment;
  }

  async getTrainingEnrollmentByUserAndProgram(userId: string, programId: string): Promise<TrainingEnrollment | undefined> {
    const [enrollment] = await db.select().from(trainingEnrollments)
      .where(and(
        eq(trainingEnrollments.userId, userId),
        eq(trainingEnrollments.programId, programId)
      ));
    return enrollment;
  }

  async createTrainingEnrollment(enrollment: InsertTrainingEnrollment): Promise<TrainingEnrollment> {
    const [created] = await db.insert(trainingEnrollments).values(enrollment).returning();
    return created;
  }

  async updateTrainingEnrollment(id: string, updates: Partial<InsertTrainingEnrollment>): Promise<TrainingEnrollment> {
    const [updated] = await db.update(trainingEnrollments)
      .set(updates)
      .where(eq(trainingEnrollments.id, id))
      .returning();
    return updated;
  }

  async deleteTrainingEnrollment(id: string): Promise<void> {
    await db.delete(trainingEnrollments).where(eq(trainingEnrollments.id, id));
  }

  // Training Module Submissions
  async getTrainingModuleSubmissions(enrollmentId: string): Promise<TrainingModuleSubmission[]> {
    return await db.select().from(trainingModuleSubmissions)
      .where(eq(trainingModuleSubmissions.enrollmentId, enrollmentId))
      .orderBy(trainingModuleSubmissions.createdAt);
  }

  async getTrainingModuleSubmission(enrollmentId: string, moduleId: string): Promise<TrainingModuleSubmission | undefined> {
    const [submission] = await db.select().from(trainingModuleSubmissions)
      .where(and(
        eq(trainingModuleSubmissions.enrollmentId, enrollmentId),
        eq(trainingModuleSubmissions.moduleId, moduleId)
      ));
    return submission;
  }

  async createTrainingModuleSubmission(submission: InsertTrainingModuleSubmission): Promise<TrainingModuleSubmission> {
    const [created] = await db.insert(trainingModuleSubmissions).values(submission).returning();
    return created;
  }

  async updateTrainingModuleSubmission(id: string, updates: Partial<InsertTrainingModuleSubmission>): Promise<TrainingModuleSubmission> {
    const [updated] = await db.update(trainingModuleSubmissions)
      .set(updates)
      .where(eq(trainingModuleSubmissions.id, id))
      .returning();
    return updated;
  }

  async getAllPendingReviews(): Promise<(TrainingModuleSubmission & { module: TrainingModule; enrollment: TrainingEnrollment; user: User })[]> {
    const submissions = await db.select().from(trainingModuleSubmissions)
      .where(or(
        eq(trainingModuleSubmissions.status, "submitted"),
        eq(trainingModuleSubmissions.status, "under_review")
      ))
      .orderBy(trainingModuleSubmissions.submittedAt);

    return await Promise.all(
      submissions.map(async (sub) => {
        const mod = await this.getTrainingModule(sub.moduleId);
        const enrollment = await this.getTrainingEnrollment(sub.enrollmentId);
        const user = await this.getUser(enrollment!.userId);
        return { ...sub, module: mod!, enrollment: enrollment!, user: user! };
      })
    );
  }
}

export const storage = new DatabaseStorage();
