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
import Spinner from "./Spinner";

function buildData(episodes) {
  return episodes.map((ep) => ({
    episode: ep.episode_number,
    episode_length: ep.episode_length,
    difficulty: ep.difficulty,
  }));
}

function findPromotions(rows) {
  const promotions = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].difficulty > rows[i - 1].difficulty) {
      promotions.push({ episode: rows[i].episode, level: rows[i].difficulty });
    }
  }
  return promotions;
}

export default function DifficultyProgression({ run, episodes, loading, error }) {
  const data = useMemo(() => (episodes ? buildData(episodes) : null), [episodes]);
  const promotions = useMemo(() => (data ? findPromotions(data) : []), [data]);
  const seriesColor = run?.run_type === "baseline" ? "#e66767" : "#3987e5";
  const seriesName = run
    ? `${run.run_type.charAt(0).toUpperCase()}${run.run_type.slice(1)} Episode Length`
    : "Episode Length";

  return (
    <Panel
      title="Difficulty Progression"
      description="Terrain difficulty (right axis, step function) alongside episode length (left axis) for the selected run, showing how survival time responds each time the agent is promoted to a harder level."
    >
      {!run && (
        <p className="text-sm text-[#898781]">Select a training run to view its difficulty progression.</p>
      )}
      {run && error && (
        <p className="text-sm text-[#e66767]">Failed to load episodes for this run.</p>
      )}
      {run && !error && loading && <Spinner label="Loading episodes…" />}
      {run && !error && !loading && data && data.length === 0 && (
        <p className="text-sm text-[#898781]">No episodes recorded yet for this run.</p>
      )}
      {run && data && data.length > 0 && (
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
                dataKey="episode_length"
                name={seriesName}
                stroke={seriesColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="stepAfter"
                dataKey="difficulty"
                name="Difficulty"
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
