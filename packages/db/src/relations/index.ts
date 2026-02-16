import { relations } from "drizzle-orm";
import {
  skills,
  skillVersions,
  ratings,
  users,
  usageEvents,
  apiKeys,
  skillEmbeddings,
  tenants,
  auditLogs,
  skillMessages,
  notifications,
  notificationPreferences,
  reviewDecisions,
  userPreferences,
  searchQueries,
  gmailTokens,
  emailDiagnostics,
  skillFeedback,
  tokenMeasurements,
  benchmarkRuns,
  benchmarkResults,
  resumeShares,
  workArtifacts,
  userSkillViews,
  skillCommunities,
} from "../schema";

/**
 * Skills relations
 * - author: one-to-one with users
 * - versions: one-to-many with skillVersions
 * - publishedVersion: one-to-one with skillVersions (nullable)
 * - draftVersion: one-to-one with skillVersions (nullable)
 * - ratings: one-to-many with ratings
 * - usageEvents: one-to-many with usageEvents
 * - forkedFrom: one-to-one with skills (parent, nullable)
 * - forks: one-to-many with skills (children)
 */
export const skillsRelations = relations(skills, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [skills.tenantId],
    references: [tenants.id],
  }),
  author: one(users, {
    fields: [skills.authorId],
    references: [users.id],
  }),
  versions: many(skillVersions),
  publishedVersion: one(skillVersions, {
    fields: [skills.publishedVersionId],
    references: [skillVersions.id],
    relationName: "publishedVersion",
  }),
  draftVersion: one(skillVersions, {
    fields: [skills.draftVersionId],
    references: [skillVersions.id],
    relationName: "draftVersion",
  }),
  ratings: many(ratings),
  usageEvents: many(usageEvents),
  forkedFrom: one(skills, {
    fields: [skills.forkedFromId],
    references: [skills.id],
    relationName: "forks",
  }),
  forks: many(skills, { relationName: "forks" }),
  reviewDecisions: many(reviewDecisions),
  approvedByUser: one(users, {
    fields: [skills.approvedBy],
    references: [users.id],
    relationName: "approvedSkills",
  }),
  feedback: many(skillFeedback),
  tokenMeasurements: many(tokenMeasurements),
  benchmarkRuns: many(benchmarkRuns),
  views: many(userSkillViews),
  communities: many(skillCommunities),
}));

/**
 * SkillVersions relations
 * - skill: many-to-one with skills
 * - createdByUser: one-to-one with users
 */
export const skillVersionsRelations = relations(skillVersions, ({ one }) => ({
  skill: one(skills, {
    fields: [skillVersions.skillId],
    references: [skills.id],
  }),
  createdByUser: one(users, {
    fields: [skillVersions.createdBy],
    references: [users.id],
  }),
}));

/**
 * Ratings relations
 * - skill: many-to-one with skills
 * - user: many-to-one with users
 */
export const ratingsRelations = relations(ratings, ({ one }) => ({
  skill: one(skills, {
    fields: [ratings.skillId],
    references: [skills.id],
  }),
  user: one(users, {
    fields: [ratings.userId],
    references: [users.id],
  }),
}));

/**
 * Users relations
 * - skills: one-to-many skills authored
 * - skillVersions: one-to-many versions created
 * - ratings: one-to-many ratings given
 * - usageEvents: one-to-many usage events
 * - apiKeys: one-to-many API keys
 */
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  skills: many(skills),
  skillVersions: many(skillVersions),
  ratings: many(ratings),
  usageEvents: many(usageEvents),
  apiKeys: many(apiKeys),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
  userPreferences: many(userPreferences),
  reviewDecisions: many(reviewDecisions),
  searchQueries: many(searchQueries),
  gmailToken: one(gmailTokens),
  emailDiagnostics: many(emailDiagnostics),
  skillFeedback: many(skillFeedback),
  reviewedFeedback: many(skillFeedback, { relationName: "reviewedFeedback" }),
  tokenMeasurements: many(tokenMeasurements),
  benchmarkRuns: many(benchmarkRuns),
  resumeShares: many(resumeShares),
  workArtifacts: many(workArtifacts),
  skillViews: many(userSkillViews),
}));

/**
 * UsageEvents relations
 * - skill: many-to-one with skills (nullable)
 * - user: many-to-one with users (nullable)
 */
export const usageEventsRelations = relations(usageEvents, ({ one }) => ({
  skill: one(skills, {
    fields: [usageEvents.skillId],
    references: [skills.id],
  }),
  user: one(users, {
    fields: [usageEvents.userId],
    references: [users.id],
  }),
}));

/**
 * ApiKeys relations
 * - user: many-to-one with users
 */
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

/**
 * SkillEmbeddings relations
 * - skill: one-to-one with skills
 */
export const skillEmbeddingsRelations = relations(skillEmbeddings, ({ one }) => ({
  skill: one(skills, {
    fields: [skillEmbeddings.skillId],
    references: [skills.id],
  }),
}));

/**
 * Tenants relations
 * - users: one-to-many users belonging to this tenant
 * - skills: one-to-many skills owned by this tenant
 * - apiKeys: one-to-many API keys issued under this tenant
 */
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  skills: many(skills),
  apiKeys: many(apiKeys),
  notifications: many(notifications),
  notificationPreferences: many(notificationPreferences),
  userPreferences: many(userPreferences),
  reviewDecisions: many(reviewDecisions),
  searchQueries: many(searchQueries),
  gmailTokens: many(gmailTokens),
  emailDiagnostics: many(emailDiagnostics),
  skillFeedback: many(skillFeedback),
  tokenMeasurements: many(tokenMeasurements),
  benchmarkRuns: many(benchmarkRuns),
  benchmarkResults: many(benchmarkResults),
  resumeShares: many(resumeShares),
  workArtifacts: many(workArtifacts),
  userSkillViews: many(userSkillViews),
  skillCommunities: many(skillCommunities),
}));

/**
 * SkillMessages relations
 * - tenant: many-to-one with tenants
 * - fromUser: many-to-one with users (sender)
 * - toUser: many-to-one with users (recipient)
 * - subjectSkill: many-to-one with skills (skill being discussed)
 * - proposedParentSkill: many-to-one with skills (proposed parent, nullable)
 */
export const skillMessagesRelations = relations(skillMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [skillMessages.tenantId],
    references: [tenants.id],
  }),
  fromUser: one(users, {
    fields: [skillMessages.fromUserId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  toUser: one(users, {
    fields: [skillMessages.toUserId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
  subjectSkill: one(skills, {
    fields: [skillMessages.subjectSkillId],
    references: [skills.id],
    relationName: "subjectMessages",
  }),
  proposedParentSkill: one(skills, {
    fields: [skillMessages.proposedParentSkillId],
    references: [skills.id],
    relationName: "parentMessages",
  }),
}));

/**
 * Notifications relations
 * - tenant: many-to-one with tenants
 * - user: many-to-one with users
 */
export const notificationsRelations = relations(notifications, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

/**
 * NotificationPreferences relations
 * - tenant: many-to-one with tenants
 * - user: many-to-one with users (one row per user)
 */
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [notificationPreferences.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

/**
 * UserPreferences relations
 * - tenant: many-to-one with tenants
 * - user: many-to-one with users (one row per user)
 */
export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [userPreferences.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

/**
 * ReviewDecisions relations
 * - tenant: many-to-one with tenants
 * - skill: many-to-one with skills
 * - reviewer: many-to-one with users
 */
export const reviewDecisionsRelations = relations(reviewDecisions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reviewDecisions.tenantId],
    references: [tenants.id],
  }),
  skill: one(skills, {
    fields: [reviewDecisions.skillId],
    references: [skills.id],
  }),
  reviewer: one(users, {
    fields: [reviewDecisions.reviewerId],
    references: [users.id],
  }),
}));

/**
 * SearchQueries relations
 * - tenant: many-to-one with tenants
 * - user: many-to-one with users (nullable)
 */
export const searchQueriesRelations = relations(searchQueries, ({ one }) => ({
  tenant: one(tenants, {
    fields: [searchQueries.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [searchQueries.userId],
    references: [users.id],
  }),
}));

/**
 * GmailTokens relations
 * - user: one-to-one with users (one gmail token per user)
 * - tenant: many-to-one with tenants
 */
export const gmailTokensRelations = relations(gmailTokens, ({ one }) => ({
  user: one(users, {
    fields: [gmailTokens.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [gmailTokens.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * EmailDiagnostics relations
 * - user: many-to-one with users
 * - tenant: many-to-one with tenants
 */
export const emailDiagnosticsRelations = relations(emailDiagnostics, ({ one }) => ({
  user: one(users, {
    fields: [emailDiagnostics.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [emailDiagnostics.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * SkillFeedback relations
 * - skill: many-to-one with skills
 * - user: many-to-one with users (nullable, for anonymous MCP feedback)
 * - reviewer: many-to-one with users (nullable, for reviewed feedback)
 * - skillVersion: many-to-one with skillVersions (nullable)
 */
export const skillFeedbackRelations = relations(skillFeedback, ({ one }) => ({
  tenant: one(tenants, { fields: [skillFeedback.tenantId], references: [tenants.id] }),
  skill: one(skills, { fields: [skillFeedback.skillId], references: [skills.id] }),
  user: one(users, { fields: [skillFeedback.userId], references: [users.id] }),
  skillVersion: one(skillVersions, {
    fields: [skillFeedback.skillVersionId],
    references: [skillVersions.id],
  }),
  reviewer: one(users, {
    fields: [skillFeedback.reviewedBy],
    references: [users.id],
    relationName: "reviewedFeedback",
  }),
  implementedBySkill: one(skills, {
    fields: [skillFeedback.implementedBySkillId],
    references: [skills.id],
    relationName: "implementedBySuggestion",
  }),
}));

/**
 * TokenMeasurements relations
 * - skill: many-to-one with skills
 * - user: many-to-one with users (nullable)
 */
export const tokenMeasurementsRelations = relations(tokenMeasurements, ({ one }) => ({
  tenant: one(tenants, { fields: [tokenMeasurements.tenantId], references: [tenants.id] }),
  skill: one(skills, { fields: [tokenMeasurements.skillId], references: [skills.id] }),
  user: one(users, { fields: [tokenMeasurements.userId], references: [users.id] }),
}));

/**
 * BenchmarkRuns relations
 * - skill: many-to-one with skills
 * - skillVersion: many-to-one with skillVersions (nullable)
 * - triggeredByUser: many-to-one with users
 * - results: one-to-many with benchmarkResults
 */
export const benchmarkRunsRelations = relations(benchmarkRuns, ({ one, many }) => ({
  tenant: one(tenants, { fields: [benchmarkRuns.tenantId], references: [tenants.id] }),
  skill: one(skills, { fields: [benchmarkRuns.skillId], references: [skills.id] }),
  skillVersion: one(skillVersions, {
    fields: [benchmarkRuns.skillVersionId],
    references: [skillVersions.id],
  }),
  triggeredByUser: one(users, { fields: [benchmarkRuns.triggeredBy], references: [users.id] }),
  results: many(benchmarkResults),
}));

/**
 * BenchmarkResults relations
 * - benchmarkRun: many-to-one with benchmarkRuns
 */
export const benchmarkResultsRelations = relations(benchmarkResults, ({ one }) => ({
  tenant: one(tenants, { fields: [benchmarkResults.tenantId], references: [tenants.id] }),
  benchmarkRun: one(benchmarkRuns, {
    fields: [benchmarkResults.benchmarkRunId],
    references: [benchmarkRuns.id],
  }),
}));

/**
 * ResumeShares relations
 * - user: many-to-one with users
 * - tenant: many-to-one with tenants
 */
export const resumeSharesRelations = relations(resumeShares, ({ one }) => ({
  user: one(users, {
    fields: [resumeShares.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [resumeShares.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * WorkArtifacts relations
 * - user: many-to-one with users
 * - tenant: many-to-one with tenants
 */
export const workArtifactsRelations = relations(workArtifacts, ({ one }) => ({
  user: one(users, {
    fields: [workArtifacts.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [workArtifacts.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * AuditLogs relations
 * (no FK relations — actorId and tenantId are nullable text fields for flexibility)
 */
export const auditLogsRelations = relations(auditLogs, () => ({}));

/**
 * UserSkillViews relations
 * - user: many-to-one with users
 * - skill: many-to-one with skills
 * - tenant: many-to-one with tenants
 */
export const userSkillViewsRelations = relations(userSkillViews, ({ one }) => ({
  user: one(users, {
    fields: [userSkillViews.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkillViews.skillId],
    references: [skills.id],
  }),
  tenant: one(tenants, {
    fields: [userSkillViews.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * SkillCommunities relations
 * - skill: many-to-one with skills
 * - tenant: many-to-one with tenants
 */
export const skillCommunitiesRelations = relations(skillCommunities, ({ one }) => ({
  skill: one(skills, {
    fields: [skillCommunities.skillId],
    references: [skills.id],
  }),
  tenant: one(tenants, {
    fields: [skillCommunities.tenantId],
    references: [tenants.id],
  }),
}));
