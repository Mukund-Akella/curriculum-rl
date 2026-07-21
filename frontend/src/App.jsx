import { useEffect, useState } from "react";
import Header from "./components/Header";
import RunManagement from "./components/RunManagement";
import TrainingCurves from "./components/TrainingCurves";
import DifficultyProgression from "./components/DifficultyProgression";
import RobotTrajectory from "./components/RobotTrajectory";
import { useRuns } from "./hooks/useRuns";
import { useRunEpisodes } from "./hooks/useRunEpisodes";
import { deleteRun, startRun } from "./lib/api";

export default function App() {
  const { runs, loading: runsLoading, error: runsError, refresh: refreshRuns } = useRuns();
  const [selectedRunId, setSelectedRunId] = useState(null);

  useEffect(() => {
    if (selectedRunId == null && runs && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const selectedRun = runs?.find((r) => r.id === selectedRunId) ?? null;
  const { episodes, loading: episodesLoading, error: episodesError } = useRunEpisodes(selectedRun);

  async function handleRunStarted({ runType, totalTimesteps, startingDifficulty }) {
    const result = await startRun({ runType, totalTimesteps, startingDifficulty });
    const refreshed = await refreshRuns();

    let newId =
      result && typeof result === "object" && !Array.isArray(result)
        ? result.run_id ?? result.id
        : undefined;
    if (newId == null && Array.isArray(result)) newId = result[0];
    if (newId == null && refreshed && refreshed.length > 0) {
      newId = refreshed.reduce((max, r) => (r.id > max ? r.id : max), refreshed[0].id);
    }
    if (newId != null) setSelectedRunId(newId);
  }

  async function handleRunDeleted(runId) {
    await deleteRun(runId);
    await refreshRuns();
    setSelectedRunId((current) => (current === runId ? null : current));
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <Header />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <RunManagement
          runs={runs}
          loading={runsLoading}
          error={runsError}
          selectedRunId={selectedRunId}
          onSelectRun={setSelectedRunId}
          onRunStarted={handleRunStarted}
          onRunDeleted={handleRunDeleted}
        />
        <TrainingCurves
          run={selectedRun}
          episodes={episodes}
          loading={episodesLoading}
          error={episodesError}
        />
        <DifficultyProgression
          run={selectedRun}
          episodes={episodes}
          loading={episodesLoading}
          error={episodesError}
        />
        <RobotTrajectory />
      </main>
    </div>
  );
}
