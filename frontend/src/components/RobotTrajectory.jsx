import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import Panel from "./Panel";
import { useCSV } from "../hooks/useCSV";
import { elevationColor, ELEVATION_SCALE } from "../lib/color";

const PLAYBACK_MS = 90;

function withPadding([min, max], fraction = 0.1) {
  const span = max - min || Math.abs(max) || 1;
  const pad = span * fraction;
  return [min - pad, max + pad];
}

function PathPoint({ cx, cy, payload, zMin, zMax }) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3} fill={elevationColor(payload.z, zMin, zMax)} />;
}

function EndpointMarker({ cx, cy, fill, label }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={fill} stroke="#0d0d0d" strokeWidth={2} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={11} fill={fill} fontWeight={600}>
        {label}
      </text>
    </g>
  );
}

function RobotMarker({ cx, cy }) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.9} />
      <circle cx={cx} cy={cy} r={4} fill="#ffffff" />
    </g>
  );
}

export default function RobotTrajectory() {
  const { data, error } = useCSV("/positions.csv");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!playing) return undefined;
    intervalRef.current = setInterval(() => {
      setIndex((i) => {
        if (!data || i >= data.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, PLAYBACK_MS);
    return () => clearInterval(intervalRef.current);
  }, [playing, data]);

  const points = useMemo(() => {
    if (!data) return null;
    return data.map((row, i) => ({ ...row, step: i }));
  }, [data]);

  const { xDomain, yDomain, zMin, zMax } = useMemo(() => {
    if (!points) return { xDomain: [0, 1], yDomain: [0, 1], zMin: 0, zMax: 1 };
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const zs = points.map((p) => p.z);
    return {
      xDomain: withPadding([Math.min(...xs), Math.max(...xs)]),
      yDomain: withPadding([Math.min(...ys), Math.max(...ys)]),
      zMin: Math.min(...zs),
      zMax: Math.max(...zs),
    };
  }, [points]);

  const current = points ? points[index] : null;

  return (
    <Panel
      title="Robot Trajectory"
      description="Top-down path of the robot base in the horizontal plane, colored by elevation (z). Scrub the slider to animate the robot moving along the recorded path."
    >
      {error && <p className="text-sm text-[#e66767]">Failed to load position log.</p>}
      {!error && !points && <p className="text-sm text-[#898781]">Loading trajectory…</p>}
      {points && (
        <>
          <div className="mb-2 flex items-center justify-end gap-2 text-xs text-[#898781]">
            <span>Low elevation</span>
            <span
              className="h-2 w-24 rounded-full"
              style={{
                background: `linear-gradient(to right, ${ELEVATION_SCALE.low}, ${ELEVATION_SCALE.high})`,
              }}
            />
            <span>High elevation</span>
          </div>
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={xDomain}
                  stroke="#898781"
                  tick={{ fill: "#898781", fontSize: 11 }}
                  tickFormatter={(v) => v.toFixed(3)}
                  label={{ value: "x (m)", position: "insideBottom", offset: -4, fill: "#898781", fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={yDomain}
                  stroke="#898781"
                  tick={{ fill: "#898781", fontSize: 11 }}
                  tickFormatter={(v) => v.toFixed(3)}
                  width={64}
                  label={{ value: "y (m)", angle: -90, position: "insideLeft", fill: "#898781", fontSize: 12 }}
                />
                <ZAxis type="number" dataKey="z" range={[0, 1]} />
                <Tooltip
                  cursor={{ stroke: "#898781", strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "#202120",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#ffffff" }}
                  formatter={(value, name) => [Number(value).toFixed(4), name]}
                />
                <Line
                  data={points}
                  dataKey="y"
                  stroke="#52514e"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                <Scatter
                  data={points}
                  dataKey="y"
                  isAnimationActive={false}
                  shape={(props) => (
                    <PathPoint {...props} zMin={zMin} zMax={zMax} />
                  )}
                />
                <Scatter
                  data={[points[0]]}
                  dataKey="y"
                  isAnimationActive={false}
                  shape={(props) => (
                    <EndpointMarker {...props} fill="#0ca30c" label="Start" />
                  )}
                />
                <Scatter
                  data={[points[points.length - 1]]}
                  dataKey="y"
                  isAnimationActive={false}
                  shape={(props) => (
                    <EndpointMarker {...props} fill="#e66767" label="End" />
                  )}
                />
                <Scatter
                  data={current ? [current] : []}
                  dataKey="y"
                  isAnimationActive={false}
                  shape={RobotMarker}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3987e5] text-white transition-colors hover:bg-[#2a78d6]"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="1" width="3.5" height="10" />
                  <rect x="7" y="1" width="3.5" height="10" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <polygon points="1,1 11,6 1,11" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={index}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
              className="flex-1"
            />
            <div className="w-40 shrink-0 text-right text-xs text-[#898781]">
              step {index + 1} / {points.length}
              {current && (
                <div className="text-[#c3c2b7]">
                  x {current.x.toFixed(4)} · y {current.y.toFixed(4)} · z {current.z.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-[#898781]">
            <span className="font-medium text-[#c3c2b7]">What this shows: </span>
            z is the chassis height off the ground, not altitude gained — the robot drives over a
            procedurally generated heightfield, so z rises as it climbs onto a bump or ridge (red)
            and drops back down as it settles into flatter or lower ground (blue). The high-to-low
            swings you see are the wheels riding over uneven terrain, not the robot descending
            toward a goal.
          </p>
        </>
      )}
    </Panel>
  );
}
