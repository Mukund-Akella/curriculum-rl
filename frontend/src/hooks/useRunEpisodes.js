import { useEffect, useState } from "react";
import { fetchEpisodes, WS_BASE } from "../lib/api";

// Fetches episodes for the given run and, while the run is "running",
// keeps them live via the run's WebSocket feed.
export function useRunEpisodes(run) {
  const [episodes, setEpisodes] = useState(null);
  const [error, setError] = useState(null);
  const runId = run?.id ?? null;
  const status = run?.status;

  useEffect(() => {
    if (runId == null) {
      setEpisodes(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setEpisodes(null);
    setError(null);
    fetchEpisodes(runId)
      .then((data) => {
        if (!cancelled) setEpisodes(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (runId == null || status !== "running") return undefined;

    const ws = new WebSocket(`${WS_BASE}/ws/runs/${runId}`);

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      setEpisodes((prev) => {
        const base = prev ?? [];
        return [
          ...base,
          {
            id: null,
            run_id: msg.run_id,
            episode_number: base.length + 1,
            episode_length: msg.episode_length,
            difficulty: msg.difficulty,
            reward: msg.reward,
            success: msg.success,
          },
        ];
      });
    };

    ws.onerror = () => {
      // Non-fatal: leave already-loaded episodes on screen, just stop
      // expecting live updates for this connection attempt.
      console.error(`Live update connection failed for run ${runId}.`);
    };

    return () => {
      ws.close();
    };
  }, [runId, status]);

  return { episodes, error, loading: episodes === null && error === null };
}
