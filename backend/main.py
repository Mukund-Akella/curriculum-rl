"""
FastAPI web server — the middleman between the React frontend and all backend services.
Exposes REST endpoints for training runs, episodes, and trajectory data.
Includes a WebSocket endpoint for live training updates via Redis pub/sub.
"""

import redis
import json
import os
from fastapi import FastAPI, WebSocket
from database import *
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from trainer import run_training, evaluate_run

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunConfig(BaseModel):
    run_type: str
    total_timesteps: int
    starting_difficulty: int


class EpisodeData(BaseModel):
    episode_number: int
    episode_length: int
    difficulty: int
    reward: float
    success: bool


class TrajectoryData(BaseModel):
    step: int
    x: float
    y: float
    z: float


class StatusUpdate(BaseModel):
    status: str


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/api/runs")
def get_all_runs():
    runs = get_runs()
    return {"runs": runs}


@app.get("/api/runs/{run_id}/episodes")
def get_all_episodes(run_id: int):
    episodes = get_episodes(run_id)
    return {"episodes": episodes}


@app.get("/api/runs/{run_id}/trajectory")
def get_run_trajectory(run_id: int):
    trajectory = get_trajectory(run_id)
    return {"trajectory": trajectory}


@app.post("/api/runs")
def create_new_run(config: RunConfig):
    run_id = create_run(config.run_type, config.total_timesteps, config.starting_difficulty)
    run_training.delay(run_id, config.run_type, config.total_timesteps, config.starting_difficulty)
    return {"run_id": run_id}


@app.post("/api/runs/{run_id}/evaluate")
def start_evaluation(run_id: int):
    evaluate_run.delay(run_id)
    return {"message": "Evaluation started"}


@app.post("/api/runs/{run_id}/episodes")
def add_episode(run_id: int, episode: EpisodeData):
    insert_episode(run_id, episode.episode_number, episode.episode_length, episode.difficulty, episode.reward, episode.success)
    return {"message": "Episode added successfully."}


@app.post("/api/runs/{run_id}/trajectory")
def add_trajectory(run_id: int, point: TrajectoryData):
    insert_trajectory(run_id, point.step, point.x, point.y, point.z)
    return {"message": "Trajectory point added successfully."}


@app.patch("/api/runs/{run_id}/status")
def update_run(run_id: int, update: StatusUpdate):
    update_run_status(run_id, update.status)
    return {"message": "Run status updated successfully."}


@app.delete("/api/runs/{run_id}")
def delete_run_endpoint(run_id: int):
    delete_run(run_id)
    return {"message": "Run deleted successfully."}


@app.websocket("/ws/runs/{run_id}")
async def training_websocket(websocket: WebSocket, run_id: int):
    await websocket.accept()
    redis_client = redis.Redis.from_url(os.environ["REDIS_URL"])
    pubsub = redis_client.pubsub()
    pubsub.subscribe("training_updates")
    for message in pubsub.listen():
        if message["type"] == "message":
            data = json.loads(message["data"])
            if data["run_id"] == run_id:
                await websocket.send_json(data)