const API_BASE = "http://localhost:8000";
export const WS_BASE = "ws://localhost:8000";

function mapRun(row) {
  const [id, run_type, total_timesteps, starting_difficulty, status, created_at] = row;
  return { id, run_type, total_timesteps, starting_difficulty, status, created_at };
}

function mapEpisode(row) {
  const [id, run_id, episode_number, episode_length, difficulty, reward, success] = row;
  return { id, run_id, episode_number, episode_length, difficulty, reward, success };
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error(`Could not reach the API at ${API_BASE}${path}`);
  }
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchRuns() {
  const data = await request("/api/runs");
  return data.runs.map(mapRun);
}

export async function fetchEpisodes(runId) {
  const data = await request(`/api/runs/${runId}/episodes`);
  return data.episodes.map(mapEpisode);
}

export async function startRun({ runType, totalTimesteps, startingDifficulty }) {
  return request("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      run_type: runType,
      total_timesteps: totalTimesteps,
      starting_difficulty: startingDifficulty,
    }),
  });
}

export async function deleteRun(runId) {
  return request(`/api/runs/${runId}`, { method: "DELETE" });
}
