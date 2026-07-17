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
import { useCSV } from "../hooks/useCSV";

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

function buildMergedData(curriculum, baseline) {
  const curriculumRate = rollingSuccessRate(curriculum);
  const baselineRate = rollingSuccessRate(baseline);
  const length = Math.min(curriculum.length, baseline.length);
  const merged = [];
  for (let i = 0; i < length; i++) {
    merged.push({
      episode: i + 1,
      curriculum_episode_length: curriculum[i].episode_length,
      curriculum_reward: curriculum[i].reward,
      curriculum_success_rate: curriculumRate[i],
      curriculum_difficulty: curriculum[i].difficulty,
      baseline_episode_length: baseline[i].episode_length,
      baseline_reward: baseline[i].reward,
      baseline_success_rate: baselineRate[i],
    });
  }
  return merged;
}

function findPromotions(curriculum) {
  const promotions = [];
  for (let i = 1; i < curriculum.length; i++) {
    if (curriculum[i].difficulty > curriculum[i - 1].difficulty) {
      promotions.push({ episode: i + 1, level: curriculum[i].difficulty });
    }
  }
  return promotions;
}

export default function TrainingCurves() {
  const { data: curriculum, error: curriculumError } = useCSV(
    "/training_logs_curriculum.csv",
  );
  const { data: baseline, error: baselineError } = useCSV(
    "/training_logs_baseline.csv",
  );
  const [metric, setMetric] = useState("episode_length");

  const merged = useMemo(() => {
    if (!curriculum || !baseline) return null;
    return buildMergedData(curriculum, baseline);
  }, [curriculum, baseline]);

  const promotions = useMemo(
    () => (curriculum ? findPromotions(curriculum) : []),
    [curriculum],
  );

  const activeMetric = METRICS.find((m) => m.key === metric);
  const error = curriculumError || baselineError;

  return (
    <Panel
      title="Training Curves"
      description="Episode-by-episode performance for curriculum vs. direct (baseline) training, with dashed markers showing where the curriculum agent was promoted to a harder difficulty level."
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
      {error && (
        <p className="text-sm text-[#e66767]">Failed to load training logs.</p>
      )}
      {!error && !merged && (
        <p className="text-sm text-[#898781]">Loading training logs…</p>
      )}
      {merged && (
        <div>
          <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={merged} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
                dataKey={`curriculum_${metric}`}
                name="Curriculum"
                stroke="#3987e5"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={`baseline_${metric}`}
                name="Baseline (direct)"
                stroke="#e66767"
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
