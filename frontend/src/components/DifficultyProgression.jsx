import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Panel from "./Panel";
import { useCSV } from "../hooks/useCSV";

function buildData(curriculum, baseline) {
  const length = Math.min(curriculum.length, baseline.length);
  const data = [];
  for (let i = 0; i < length; i++) {
    data.push({
      episode: i + 1,
      curriculum_episode_length: curriculum[i].episode_length,
      baseline_episode_length: baseline[i].episode_length,
      difficulty: curriculum[i].difficulty,
    });
  }
  return data;
}

function findPromotions(rows) {
  const promotions = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].difficulty > rows[i - 1].difficulty) {
      promotions.push({ episode: i + 1, level: rows[i].difficulty });
    }
  }
  return promotions;
}

export default function DifficultyProgression() {
  const { data: curriculum, error: curriculumError } = useCSV(
    "/training_logs_curriculum.csv",
  );
  const { data: baseline, error: baselineError } = useCSV(
    "/training_logs_baseline.csv",
  );

  const data = useMemo(
    () => (curriculum && baseline ? buildData(curriculum, baseline) : null),
    [curriculum, baseline],
  );
  const promotions = useMemo(
    () => (curriculum ? findPromotions(curriculum) : []),
    [curriculum],
  );
  const error = curriculumError || baselineError;

  return (
    <Panel
      title="Difficulty Progression"
      description="Terrain difficulty (right axis, step function) alongside episode length (left axis) for curriculum vs. baseline, showing how survival time responds each time the curriculum agent is promoted to a harder level."
    >
      {error && (
        <p className="text-sm text-[#e66767]">Failed to load training logs.</p>
      )}
      {!error && !data && <p className="text-sm text-[#898781]">Loading training logs…</p>}
      {data && (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" vertical={false} />
              <XAxis
                dataKey="episode"
                stroke="#898781"
                tick={{ fill: "#898781", fontSize: 12 }}
                label={{ value: "Episode", position: "insideBottom", offset: -4, fill: "#898781", fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                stroke="#3987e5"
                tick={{ fill: "#3987e5", fontSize: 12 }}
                width={56}
                label={{
                  value: "Episode Length",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#3987e5",
                  fontSize: 12,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                stroke="#9085e9"
                tick={{ fill: "#9085e9", fontSize: 12 }}
                width={44}
                label={{
                  value: "Difficulty",
                  angle: 90,
                  position: "insideRight",
                  fill: "#9085e9",
                  fontSize: 12,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#202120",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#ffffff" }}
                labelFormatter={(label) => `Episode ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="curriculum_episode_length"
                name="Curriculum Episode Length"
                stroke="#3987e5"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="baseline_episode_length"
                name="Baseline Episode Length"
                stroke="#e66767"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="stepAfter"
                dataKey="difficulty"
                name="Curriculum Difficulty"
                stroke="#9085e9"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {promotions.map((p) => (
                <ReferenceDot
                  key={p.episode}
                  yAxisId="right"
                  x={p.episode}
                  y={p.level}
                  r={4}
                  fill="#9085e9"
                  stroke="#0d0d0d"
                  label={{
                    value: `Promoted to level ${p.level}`,
                    position: "top",
                    fill: "#9085e9",
                    fontSize: 10,
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
