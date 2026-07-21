import { useCallback, useEffect, useState } from "react";
import { fetchRuns } from "../lib/api";

const POLL_MS = 3000;

export function useRuns() {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchRuns();
      setRuns(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { runs, error, loading: runs === null && error === null, refresh };
}
