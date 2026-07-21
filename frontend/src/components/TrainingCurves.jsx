import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Panel from "./Panel";
import Spinner from "./Spinner";

const ROLLING_WINDOW = 10;

const METRICS = [
  {
    key: "episode_length",
    label: "Episode Length",
    format: (v) => v.toFixed(0),
    insight:
      "Episode length is how many steps the robot survived before falling or timing out. Longer episodes mean the robot traversed more of the terrain without failing — the clearest signal of a policy that's actually getting better.",
  },
  {
    key: "reward",
    label: "Reward",
    format: (v) => v.toFixed(0),
    insight:
      "Reward is dominated by forward progress and survival, so it tracks episode length closely — more reward roughly means more distance covered before the episode ended. Watch for reward rising faster than episode length, which would suggest the agent is also moving more efficiently per step.",
  },
  {
    key: "success_rate",
    label: "Success Rate",
    format: (v) => `${(v * 100).toFixed(0)}%`,
    insight:
      "Success rate (10-episode rolling average) measures how often an episode ends in success rather than failure, regardless of how long it lasted. A high success rate with a short episode length would mean the agent is completing easy, short episodes reliably rather than surviving long, hard ones.",
  },
];

function rollingSuccessRate(rows) {
  const rates = [];
  let windowSum = 0;
  for (let i = 0; i < rows.length; i++) {
    windowSum += rows[i].success ? 1 : 0;
    if (i >= ROLLING_WINDOW) windowSum -= rows[i - ROLLING_WINDOW].success ? 1 : 0;
    const count = Math.min(i + 1, ROLLING_WINDOW);
    rates.push(windowSum / count);
  }
  return rates;
}

function buildData(episodes) {
  const rates = rollingSuccessRate(episodes);
  return episodes.map((ep, i) => ({
    episode: ep.episode_number,
    episode_length: ep.episode_length,
    reward: ep.reward,
    success_rate: rates[i],
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

export default function TrainingCurves({ run, episodes, loading, error }) {
  const [metric, setMetric] = useState("episode_length");

  const data = useMemo(() => (episodes ? buildData(episodes) : null), [episodes]);
  const promotions = useMemo(() => (data ? findPromotions(data) : []), [data]);
  const activeMetric = METRICS.find((m) => m.key === metric);
  const seriesColor = run?.run_type === "baseline" ? "#e66767" : "#3987e5";
  const seriesName = run ? `${run.run_type.charAt(0).toUpperCase()}${run.run_type.slice(1)}` : "";

  return (
    <Panel
      title="Training Curves"
      description="Episode-by-episode performance for the selected run, with dashed markers showing where the agent was promoted to a harder difficulty level."
      controls={
        <div className="flex gap-1 rounded-md border border-white/10 bg-[#0d0d0d] p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === m.key
                  ? "bg-[#3987e5] text-white"
                  : "text-[#898781] hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {!run && (
        <p className="text-sm text-[#898781]">Select a training run to view its curves.</p>
      )}
      {run && error && (
        <p className="text-sm text-[#e66767]">Failed to load episodes for this run.</p>
      )}
      {run && !error && loading && <Spinner label="Loading episodes…" />}
      {run && !error && !loading && data && data.length === 0 && (
        <p className="text-sm text-[#898781]">No episodes recorded yet for this run.</p>
      )}
      {run && data && data.length > 0 && (
        <div>
          <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" vertical={false} />
              <XAxis
                dataKey="episode"
                stroke="#898781"
                tick={{ fill: "#898781", fontSize: 12 }}
                label={{ value: "Episode", position: "insideBottom", offset: -4, fill: "#898781", fontSize: 12 }}
              />
              <YAxis
                stroke="#898781"
                tick={{ fill: "#898781", fontSize: 12 }}
                tickFormatter={activeMetric.format}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "#202120",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#ffffff" }}
                formatter={(value, name) => [activeMetric.format(value), name]}
                labelFormatter={(label) => `Episode ${label}`}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#c3c2b7" }} />
              {promotions.map((p) => (
                <ReferenceLine
                  key={p.episode}
                  x={p.episode}
                  stroke="#c98500"
                  strokeDasharray="4 4"
                  strokeOpacity={0.8}
                  label={{
                    value: `L${p.level}`,
                    position: "top",
                    fill: "#c98500",
                    fontSize: 11,
                  }}
                />
              ))}
              <Line
                type="monotone"
                dataKey={metric}
                name={seriesName}
                stroke={seriesColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
          <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-[#898781]">
            <span className="font-medium text-[#c3c2b7]">What this shows: </span>
            {activeMetric.insight}
          </p>
        </div>
      )}
    </Panel>
  );
}
