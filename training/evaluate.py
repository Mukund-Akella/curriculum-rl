import csv
import numpy as np
import mujoco
import mujoco.viewer
import time
from stable_baselines3 import PPO
from envs.terrain_env import TerrainEnv
from curriculum.scheduler import CurriculumScheduler

LOG_FILE = "logs/positions.csv"
MODEL_PATH = "ppo_curriculum_model"

model = PPO.load(MODEL_PATH)

scheduler = CurriculumScheduler(
    window_size=20,
    success_threshold=350,
    promotion_threshold=0.7,
    demotion_threshold=0.7
)

env = TerrainEnv(difficulty=1)
obs, _ = env.reset()

trajectory = []
episode_count = 0

with mujoco.viewer.launch_passive(env.model, env.data) as viewer:
    viewer.cam.distance = 1.5
    viewer.cam.elevation = -30
    viewer.cam.azimuth = 135

    while viewer.is_running():
        action, _ = model.predict(obs)
        obs, reward, terminated, truncated, info = env.step(action)
        x, y, z = env.data.qpos[:3]
        trajectory.append([x, y, z])

        viewer.cam.lookat[0] = x
        viewer.cam.lookat[1] = y
        viewer.cam.lookat[2] = z

        viewer.sync()
        time.sleep(0.005)

        if terminated:
            episode_count += 1
            episode_length = len([t for t in trajectory])

            scheduler.record_episode(episode_length)

            if scheduler.should_promote():
                scheduler.promote()
                env.difficulty = scheduler.current_difficulty
                env._generate_terrain(scheduler.current_difficulty)
                print(f"Promoted to difficulty {scheduler.current_difficulty}")

            obs, _ = env.reset()

with open(LOG_FILE, 'w', newline='') as csvfile:
    writer = csv.writer(csvfile)
    for row in trajectory:
        writer.writerow(row)

print(f"Trajectory saved to {LOG_FILE}")
print(f"Total episodes: {episode_count}")
print(f"Final difficulty: {scheduler.current_difficulty}")