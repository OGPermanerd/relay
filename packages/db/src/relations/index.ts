import { relations } from "drizzle-orm";
import { skills, skillVersions, ratings, users, usageEvents } from "../schema";

/**
 * Skills relations
 * - author: one-to-one with users
 * - versions: one-to-many with skillVersions
 * - publishedVersion: one-to-one with skillVersions (nullable)
 * - draftVersion: one-to-one with skillVersions (nullable)
 * - ratings: one-to-many with ratings
 * - usageEvents: one-to-many with usageEvents
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
 */
export const usersRelations = relations(users, ({ many }) => ({
  skills: many(skills),
  skillVersions: many(skillVersions),
  ratings: many(ratings),
  usageEvents: many(usageEvents),
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
