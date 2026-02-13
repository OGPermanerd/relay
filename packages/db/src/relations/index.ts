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
 * AuditLogs relations
 * (no FK relations — actorId and tenantId are nullable text fields for flexibility)
 */
export const auditLogsRelations = relations(auditLogs, () => ({}));
