"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Model colors for up to 4 models (extend if needed)
const MODEL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

interface ModelDimensionData {
  modelName: string;
  avgFaithfulness: number;
  avgRelevancy: number;
  avgPrecision: number;
  avgRecall: number;
}

interface RadarDimensionChartProps {
  models: ModelDimensionData[];
  height?: number;
}

// Short model name (matches benchmark-tab.tsx helper)
function shortModel(name: string): string {
  return name.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

export function RadarDimensionChart({ models, height = 300 }: RadarDimensionChartProps) {
  // Build radar data: one entry per dimension with a key per model
  const dimensions = ["Faithfulness", "Relevancy", "Precision", "Recall"] as const;
  const dimensionKeys: Record<(typeof dimensions)[number], keyof ModelDimensionData> = {
    Faithfulness: "avgFaithfulness",
    Relevancy: "avgRelevancy",
    Precision: "avgPrecision",
    Recall: "avgRecall",
  };

  const data = dimensions.map((dim) => {
    const point: Record<string, string | number> = { dimension: dim };
    for (const model of models) {
      point[shortModel(model.modelName)] = model[dimensionKeys[dim]];
    }
    return point;
  });

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          {models.map((model, i) => (
            <Radar
              key={model.modelName}
              name={shortModel(model.modelName)}
              dataKey={shortModel(model.modelName)}
              stroke={MODEL_COLORS[i % MODEL_COLORS.length]}
              fill={MODEL_COLORS[i % MODEL_COLORS.length]}
              fillOpacity={0.15}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
