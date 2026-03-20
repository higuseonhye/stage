"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AGENTS } from "@/lib/agents";

function barColor(value: number): string {
  if (value >= 40) return "#22c55e";
  if (value >= 15) return "#f59e0b";
  return "#94a3b8";
}

const AGENT_FILL: Record<string, string> = {
  analyst: "#34d399",
  critic: "#fbbf24",
  strategist: "#a78bfa",
  executor: "#38bdf8",
};

type Props = {
  improvementSeries: number[];
  refinementByAgent: Record<string, number[]>;
  finalRound: number;
};

export function RefinementChart({
  improvementSeries,
  refinementByAgent,
  finalRound,
}: Props) {
  if (!improvementSeries.length) return null;

  const data = improvementSeries.map((overall, i) => {
    const row: Record<string, string | number> = {
      label: `→R${i + 2}`,
      Overall: overall,
    };
    for (const a of AGENTS) {
      row[a.id] = refinementByAgent[a.id]?.[i] ?? 0;
    }
    return row;
  });

  const fromR = 1;
  const toR = Math.min(finalRound, fromR + improvementSeries.length);

  return (
    <div className="border-border/60 bg-muted/15 rounded-lg border p-4">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
        Refinement quality — rounds {fromR}→{toR}
      </h3>
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              domain={[0, 100]}
              width={36}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Overall" name="Panel Δ" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={`cell-o-${i}`}
                  fill={barColor(Number(entry.Overall))}
                />
              ))}
            </Bar>
            {AGENTS.map((a) => (
              <Bar
                key={a.id}
                dataKey={a.id}
                name={a.name}
                fill={AGENT_FILL[a.id] ?? "#64748b"}
                radius={[2, 2, 0, 0]}
                opacity={0.9}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-muted-foreground mt-2 font-mono text-[10px] leading-relaxed">
        Improvement vs previous round (0–100). Panel bar uses green / amber /
        gray by strength; colored bars are per-actor deltas.
      </p>
    </div>
  );
}
