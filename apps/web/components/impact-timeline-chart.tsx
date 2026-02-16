"use client";

import {
  ComposedChart,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TimelineEvent } from "@/lib/portfolio-queries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineDataPoint {
  date: string;
  cumulativeHoursSaved: number;
  creationEvent?: number;
  forkEvent?: number;
  suggestionEvent?: number;
  artifactEvent?: number;
  eventLabel?: string;
}

interface ImpactTimelineChartProps {
  data: TimelineEvent[];
}

// ---------------------------------------------------------------------------
// Data transformation
// ---------------------------------------------------------------------------

function transformTimelineForChart(events: TimelineEvent[]): TimelineDataPoint[] {
  return events.map((event) => {
    const point: TimelineDataPoint = {
      date: event.date,
      cumulativeHoursSaved: event.cumulativeHoursSaved,
      eventLabel: event.skillName,
    };

    if (event.eventType === "creation") {
      point.creationEvent = event.cumulativeHoursSaved;
    } else if (event.eventType === "fork") {
      point.forkEvent = event.cumulativeHoursSaved;
    } else if (event.eventType === "suggestion") {
      point.suggestionEvent = event.cumulativeHoursSaved;
    } else if (event.eventType === "artifact") {
      point.artifactEvent = event.cumulativeHoursSaved;
    }

    return point;
  });
}

// ---------------------------------------------------------------------------
// UTC-safe date formatting (no toLocaleDateString — hydration risk)
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  return MONTHS[d.getUTCMonth()] + " " + d.getUTCDate();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpactTimelineChart({ data }: ImpactTimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-500">
          No impact data yet. Publish skills to see your timeline.
        </p>
      </div>
    );
  }

  const chartData = transformTimelineForChart(data);

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Skills Impact Timeline</h2>
      <div style={{ height: 350 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={formatDateShort} />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: "Hours Saved",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              labelFormatter={(label) => formatDateShort(String(label))}
              contentStyle={{ borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="cumulativeHoursSaved"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              strokeWidth={2}
              name="Cumulative Hours Saved"
            />
            <Scatter dataKey="creationEvent" fill="#10b981" name="Skill Created" />
            <Scatter dataKey="forkEvent" fill="#8b5cf6" name="Skill Forked" />
            <Scatter dataKey="suggestionEvent" fill="#f59e0b" name="Suggestion Implemented" />
            <Scatter dataKey="artifactEvent" fill="#d97706" name="Pre-platform Work" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
