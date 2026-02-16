"use client";

import { useQueryState, parseAsStringEnum, parseAsStringLiteral } from "nuqs";
import { useTransition } from "react";

// Employee table columns
export const EMPLOYEE_SORT_COLUMNS = [
  "name",
  "email",
  "skillsUsed",
  "usageFrequency",
  "hoursSaved",
  "lastActive",
  "topSkill",
] as const;
export type EmployeeSortColumn = (typeof EMPLOYEE_SORT_COLUMNS)[number];

// Skill table columns
export const SKILL_SORT_COLUMNS = ["name", "usageCount", "uniqueUsers", "hoursSaved"] as const;
export type SkillSortColumn = (typeof SKILL_SORT_COLUMNS)[number];

// IP Risk table columns
export const IP_RISK_SORT_COLUMNS = [
  "name",
  "atRiskSkillCount",
  "totalAtRiskUses",
  "totalAtRiskHoursSaved",
  "riskLevel",
] as const;
export type IpRiskSortColumn = (typeof IP_RISK_SORT_COLUMNS)[number];

const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/**
 * Sort state hook for employees analytics table
 *
 * Manages column sorting with URL persistence via nuqs.
 * Default: hoursSaved descending (highest impact first)
 *
 * @returns sortBy - current sort column
 * @returns sortDir - current sort direction
 * @returns isPending - transition pending state
 * @returns toggleSort - toggle sort on column
 */
export function useEmployeeSortState() {
  const [sortBy, setSortBy] = useQueryState(
    "empSort",
    parseAsStringEnum(EMPLOYEE_SORT_COLUMNS as unknown as string[]).withDefault("hoursSaved")
  );
  const [sortDir, setSortDir] = useQueryState(
    "empDir",
    parseAsStringLiteral(SORT_DIRECTIONS).withDefault("desc")
  );
  const [isPending, startTransition] = useTransition();

  const toggleSort = (column: EmployeeSortColumn) => {
    startTransition(() => {
      if (sortBy === column) {
        setSortDir(sortDir === "desc" ? "asc" : "desc");
      } else {
        setSortBy(column);
        setSortDir("desc");
      }
    });
  };

  return {
    sortBy: sortBy as EmployeeSortColumn,
    sortDir: sortDir as SortDirection,
    isPending,
    toggleSort,
  };
}

/**
 * Sort state hook for skills analytics table
 *
 * Manages column sorting with URL persistence via nuqs.
 * Default: hoursSaved descending (highest impact first)
 *
 * @returns sortBy - current sort column
 * @returns sortDir - current sort direction
 * @returns isPending - transition pending state
 * @returns toggleSort - toggle sort on column
 */
export function useSkillSortState() {
  const [sortBy, setSortBy] = useQueryState(
    "skillSort",
    parseAsStringEnum(SKILL_SORT_COLUMNS as unknown as string[]).withDefault("hoursSaved")
  );
  const [sortDir, setSortDir] = useQueryState(
    "skillDir",
    parseAsStringLiteral(SORT_DIRECTIONS).withDefault("desc")
  );
  const [isPending, startTransition] = useTransition();

  const toggleSort = (column: SkillSortColumn) => {
    startTransition(() => {
      if (sortBy === column) {
        setSortDir(sortDir === "desc" ? "asc" : "desc");
      } else {
        setSortBy(column);
        setSortDir("desc");
      }
    });
  };

  return {
    sortBy: sortBy as SkillSortColumn,
    sortDir: sortDir as SortDirection,
    isPending,
    toggleSort,
  };
}

/**
 * Sort state hook for IP risk table
 *
 * Manages column sorting with URL persistence via nuqs.
 * Default: totalAtRiskUses descending (highest exposure first)
 *
 * @returns sortBy - current sort column
 * @returns sortDir - current sort direction
 * @returns isPending - transition pending state
 * @returns toggleSort - toggle sort on column
 */
export function useIpRiskSortState() {
  const [sortBy, setSortBy] = useQueryState(
    "riskSort",
    parseAsStringEnum(IP_RISK_SORT_COLUMNS as unknown as string[]).withDefault("totalAtRiskUses")
  );
  const [sortDir, setSortDir] = useQueryState(
    "riskDir",
    parseAsStringLiteral(SORT_DIRECTIONS).withDefault("desc")
  );
  const [isPending, startTransition] = useTransition();

  const toggleSort = (column: IpRiskSortColumn) => {
    startTransition(() => {
      if (sortBy === column) {
        setSortDir(sortDir === "desc" ? "asc" : "desc");
      } else {
        setSortBy(column);
        setSortDir("desc");
      }
    });
  };

  return {
    sortBy: sortBy as IpRiskSortColumn,
    sortDir: sortDir as SortDirection,
    isPending,
    toggleSort,
  };
}
