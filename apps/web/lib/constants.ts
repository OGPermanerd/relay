/**
 * Standard USA FTE hours per year.
 * 40 hours/week * 52 weeks/year = 2,080 hours/year
 * Used for all "FTE Years Saved" calculations across the platform.
 */
export const FTE_HOURS_PER_YEAR = 2080;

/**
 * Standard USA FTE working days per year.
 * 2,080 hours / 8 hours per day = 260 working days/year
 * Used when converting "FTE days saved" (hours / 8) to years.
 */
export const FTE_DAYS_PER_YEAR = 260;
