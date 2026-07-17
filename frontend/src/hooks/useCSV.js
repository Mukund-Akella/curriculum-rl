import { useEffect, useState } from "react";
import { fetchCSV } from "../lib/csv";

export function useCSV(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCSV(path)
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, error, loading: data === null && error === null };
}
