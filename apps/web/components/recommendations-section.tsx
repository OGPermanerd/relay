"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRecommendations } from "@/app/actions/recommendations";
import { RecommendationCard } from "./recommendation-card";
import type { SkillRecommendation } from "@/lib/skill-recommendations";

export function RecommendationsSection() {
  const [recommendations, setRecommendations] = useState<SkillRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await getRecommendations();
        if (cancelled) return;

        if ("error" in result && result.error) {
          setError(result.error);
        } else if ("recommendations" in result && result.recommendations) {
          setRecommendations(result.recommendations);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load recommendations.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading state: 3 skeleton cards
  if (loading) {
    return (
      <div>
        <div className="mb-4">
          <div className="h-7 w-56 animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-5 w-80 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">{error}</p>
      </div>
    );
  }

  // Empty state
  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">
          No skill recommendations found yet. Run an email diagnostic scan to get personalized
          suggestions.
        </p>
      </div>
    );
  }

  // Success state
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Recommended Skills</h2>
        <p className="mt-1 text-sm text-gray-600">
          Based on your email patterns, these skills could save you time
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {recommendations.map((rec) => (
          <RecommendationCard key={rec.skillId} recommendation={rec} />
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link
          href="/my-leverage/deployment-plan"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          View Full Deployment Plan &rarr;
        </Link>
      </div>
    </div>
  );
}
