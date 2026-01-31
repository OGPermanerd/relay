import { describe, it, expect } from "vitest";
import {
  calculateQualityScore,
  getQualityTier,
  type QualityScoreInput,
  QUALITY_TIERS,
} from "../quality-score";

describe("Quality Score Calculation", () => {
  describe("calculateQualityScore", () => {
    it("returns 'unrated' tier when totalRatings < 3", () => {
      const input: QualityScoreInput = {
        totalUses: 0,
        averageRating: null,
        totalRatings: 0,
        hasDescription: true,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      expect(result.tier).toBe("unrated");
    });

    it("returns 'unrated' for 2 ratings even with high score potential", () => {
      const input: QualityScoreInput = {
        totalUses: 100,
        averageRating: 500,
        totalRatings: 2,
        hasDescription: true,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      expect(result.tier).toBe("unrated");
    });

    it("returns perfect score (100) and 'gold' tier for maxed inputs", () => {
      const input: QualityScoreInput = {
        totalUses: 100,
        averageRating: 500, // 5.0 stored as 500
        totalRatings: 5,
        hasDescription: true,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      expect(result.score).toBe(100);
      expect(result.tier).toBe("gold");
      expect(result.breakdown.usageScore).toBe(50);
      expect(result.breakdown.ratingScore).toBe(35);
      expect(result.breakdown.docsScore).toBe(15);
    });

    it("returns 'silver' tier for medium score (~64)", () => {
      const input: QualityScoreInput = {
        totalUses: 50,
        averageRating: 350, // 3.5 stored as 350
        totalRatings: 3,
        hasDescription: true,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      // Usage: (50/100) * 50 = 25
      // Rating: (350/500) * 35 = 24.5
      // Docs: 15
      // Total: 64.5
      expect(result.score).toBeCloseTo(64.5, 1);
      expect(result.tier).toBe("silver");
    });

    it("returns correct tier for low score with missing docs", () => {
      const input: QualityScoreInput = {
        totalUses: 10,
        averageRating: 200, // 2.0 stored as 200
        totalRatings: 3,
        hasDescription: false,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      // Usage: (10/100) * 50 = 5
      // Rating: (200/500) * 35 = 14
      // Docs: 0 (missing description)
      // Total: 19
      expect(result.score).toBeCloseTo(19, 1);
      expect(result.tier).toBe("none");
      expect(result.breakdown.docsScore).toBe(0);
    });

    it("caps usage score at 50 even with > 100 uses", () => {
      const input: QualityScoreInput = {
        totalUses: 200, // More than cap of 100
        averageRating: 250, // 2.5 stored as 250
        totalRatings: 10,
        hasDescription: true,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      // Usage: min(200/100, 1) * 50 = 50 (capped)
      // Rating: (250/500) * 35 = 17.5
      // Docs: 15
      // Total: 82.5
      expect(result.breakdown.usageScore).toBe(50);
      expect(result.score).toBeCloseTo(82.5, 1);
      expect(result.tier).toBe("gold");
    });

    it("handles null averageRating by treating rating component as 0", () => {
      const input: QualityScoreInput = {
        totalUses: 50,
        averageRating: null,
        totalRatings: 3,
        hasDescription: true,
        hasCategory: true,
      };

      const result = calculateQualityScore(input);

      expect(result.breakdown.ratingScore).toBe(0);
    });

    it("returns correct breakdown for partial documentation", () => {
      const input: QualityScoreInput = {
        totalUses: 100,
        averageRating: 500,
        totalRatings: 5,
        hasDescription: true,
        hasCategory: false, // Missing category
      };

      const result = calculateQualityScore(input);

      expect(result.breakdown.docsScore).toBe(0);
    });
  });

  describe("getQualityTier", () => {
    it("returns just the tier string", () => {
      const input: QualityScoreInput = {
        totalUses: 100,
        averageRating: 500,
        totalRatings: 5,
        hasDescription: true,
        hasCategory: true,
      };

      const tier = getQualityTier(input);

      expect(tier).toBe("gold");
    });

    it("returns 'unrated' for insufficient ratings", () => {
      const input: QualityScoreInput = {
        totalUses: 100,
        averageRating: 500,
        totalRatings: 2,
        hasDescription: true,
        hasCategory: true,
      };

      const tier = getQualityTier(input);

      expect(tier).toBe("unrated");
    });
  });

  describe("Tier boundaries", () => {
    const baseInput: Omit<QualityScoreInput, "totalUses" | "averageRating"> = {
      totalRatings: 10,
      hasDescription: true,
      hasCategory: true,
    };

    it("score >= 75 is gold", () => {
      const result = calculateQualityScore({
        ...baseInput,
        totalUses: 100, // 50 points
        averageRating: 360, // (360/500) * 35 = 25.2 points
        // 50 + 25.2 + 15 = 90.2
      });

      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.tier).toBe("gold");
    });

    it("score >= 50 and < 75 is silver", () => {
      const result = calculateQualityScore({
        ...baseInput,
        totalUses: 40, // (40/100) * 50 = 20 points
        averageRating: 400, // (400/500) * 35 = 28 points
        // 20 + 28 + 15 = 63
      });

      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(75);
      expect(result.tier).toBe("silver");
    });

    it("score >= 25 and < 50 is bronze", () => {
      const result = calculateQualityScore({
        ...baseInput,
        totalUses: 20, // (20/100) * 50 = 10 points
        averageRating: 300, // (300/500) * 35 = 21 points
        // 10 + 21 + 15 = 46 - needs adjustment
        hasDescription: false,
        hasCategory: true,
        // 10 + 21 + 0 = 31
      });

      expect(result.score).toBeGreaterThanOrEqual(25);
      expect(result.score).toBeLessThan(50);
      expect(result.tier).toBe("bronze");
    });

    it("score < 25 is none", () => {
      const result = calculateQualityScore({
        ...baseInput,
        totalUses: 5, // (5/100) * 50 = 2.5 points
        averageRating: 200, // (200/500) * 35 = 14 points
        hasDescription: false,
        hasCategory: false,
        // 2.5 + 14 + 0 = 16.5
      });

      expect(result.score).toBeLessThan(25);
      expect(result.tier).toBe("none");
    });
  });

  describe("QUALITY_TIERS constant", () => {
    it("has all five tiers defined", () => {
      expect(QUALITY_TIERS).toHaveProperty("gold");
      expect(QUALITY_TIERS).toHaveProperty("silver");
      expect(QUALITY_TIERS).toHaveProperty("bronze");
      expect(QUALITY_TIERS).toHaveProperty("none");
      expect(QUALITY_TIERS).toHaveProperty("unrated");
    });

    it("has threshold values for non-unrated tiers", () => {
      expect(QUALITY_TIERS.gold.threshold).toBe(75);
      expect(QUALITY_TIERS.silver.threshold).toBe(50);
      expect(QUALITY_TIERS.bronze.threshold).toBe(25);
      expect(QUALITY_TIERS.none.threshold).toBe(0);
    });

    it("has color information for each tier", () => {
      expect(QUALITY_TIERS.gold.color).toBeDefined();
      expect(QUALITY_TIERS.silver.color).toBeDefined();
      expect(QUALITY_TIERS.bronze.color).toBeDefined();
      expect(QUALITY_TIERS.none.color).toBeDefined();
      expect(QUALITY_TIERS.unrated.color).toBeDefined();
    });
  });
});
