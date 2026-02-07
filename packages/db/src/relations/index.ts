import { relations } from "drizzle-orm";
import {
  skills,
  skillVersions,
  ratings,
  users,
  usageEvents,
  apiKeys,
  skillEmbeddings,
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
export const usersRelations = relations(users, ({ many }) => ({
  skills: many(skills),
  skillVersions: many(skillVersions),
  ratings: many(ratings),
  usageEvents: many(usageEvents),
  apiKeys: many(apiKeys),
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
