import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import Spinner from "./Spinner";

const STATUS_STYLES = {
  completed: "bg-[#0ca30c]/15 text-[#0ca30c]",
  running: "bg-[#3987e5]/15 text-[#3987e5]",
  pending: "bg-[#c98500]/15 text-[#c98500]",
  failed: "bg-[#e66767]/15 text-[#e66767]",
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? "bg-white/10 text-[#898781]";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>
      {status}
    </span>
  );
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3.5h10" />
      <path d="M5 3.5V2.3a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.2" />
      <path d="M3.2 3.5l.5 8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.5-8" />
      <path d="M5.7 6v4" />
      <path d="M8.3 6v4" />
    </svg>
  );
}

export default function RunManagement({
  runs,
  loading,
  error,
  selectedRunId,
  onSelectRun,
  onRunStarted,
  onRunDeleted,
}) {
  const [runType, setRunType] = useState("curriculum");
  const [totalTimesteps, setTotalTimesteps] = useState(50000);
  const [startingDifficulty, setStartingDifficulty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const confirmButtonRef = useRef(null);

  useEffect(() => {
    if (confirmingId == null) return undefined;
    function handleOutsideClick(e) {
      if (!confirmButtonRef.current || !confirmButtonRef.current.contains(e.target)) {
        setConfirmingId(null);
      }
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [confirmingId]);

  async function handleDeleteClick(e, run) {
    e.stopPropagation();
    if (confirmingId !== run.id) {
      setConfirmingId(run.id);
      return;
    }
    setConfirmingId(null);
    setDeleteError(null);
    try {
      await onRunDeleted(run.id);
    } catch (err) {
      setDeleteError(err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onRunStarted({
        runType,
        totalTimesteps: Number(totalTimesteps),
        startingDifficulty: Number(startingDifficulty),
      });
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel
      title="Training Runs"
      description="Select a run to inspect its episodes below, or start a new one."
    >
      {error && <p className="text-sm text-[#e66767]">Failed to load training runs.</p>}
      {!error && loading && <Spinner label="Loading runs…" />}
      {!error && runs && runs.length === 0 && (
        <p className="text-sm text-[#898781]">No training runs yet. Start one below.</p>
      )}
      {runs && runs.length > 0 && (
        <ul
          className={`flex max-h-64 flex-col divide-y divide-white/10 overflow-y-auto rounded-md border border-white/10 ${
            deleteError ? "mb-2" : "mb-6"
          }`}
        >
          {runs.map((run) => (
            <li key={run.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectRun(run.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectRun(run.id);
                }}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  run.id === selectedRunId ? "bg-[#3987e5]/10" : "hover:bg-white/5"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 text-[#898781]">#{run.id}</span>
                  <span className="shrink-0 capitalize text-white">{run.run_type}</span>
                  <StatusBadge status={run.status} />
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-[#898781]">{formatDate(run.created_at)}</span>
                  <button
                    ref={run.id === confirmingId ? confirmButtonRef : undefined}
                    type="button"
                    onClick={(e) => handleDeleteClick(e, run)}
                    aria-label={run.id === confirmingId ? "Confirm delete" : "Delete run"}
                    className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                      run.id === confirmingId
                        ? "bg-[#e66767] text-white"
                        : "text-[#e66767] hover:bg-[#e66767]/10"
                    }`}
                  >
                    {run.id === confirmingId ? "Confirm?" : <TrashIcon />}
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleteError && (
        <p className="mb-4 text-sm text-[#e66767]">Failed to delete run.</p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-4 border-t border-white/10 pt-4"
      >
        <label className="flex flex-col gap-1 text-xs text-[#898781]">
          Run type
          <select
            value={runType}
            onChange={(e) => setRunType(e.target.value)}
            className="rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-1.5 text-sm text-white"
          >
            <option value="curriculum">Curriculum</option>
            <option value="baseline">Baseline</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#898781]">
          Total timesteps
          <input
            type="number"
            min={1}
            step={1}
            value={totalTimesteps}
            onChange={(e) => setTotalTimesteps(e.target.value)}
            className="w-36 rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-1.5 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#898781]">
          Starting difficulty
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            value={startingDifficulty}
            onChange={(e) => setStartingDifficulty(e.target.value)}
            className="w-24 rounded-md border border-white/10 bg-[#0d0d0d] px-3 py-1.5 text-sm text-white"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[#3987e5] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2a78d6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Starting…" : "Start Training"}
        </button>
        {submitError && (
          <p className="text-sm text-[#e66767]">Failed to start training run.</p>
        )}
      </form>
    </Panel>
  );
}
