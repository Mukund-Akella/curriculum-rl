
import csv
import gymnasium as gym
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from envs.terrain_env import TerrainEnv


model = PPO.load("ppo_terrain_model")
env = TerrainEnv(difficulty=5)
obs, _ = env.reset()
LOG_FILE = "logs/positions.csv"
for i in range(100):
    action, _ = model.predict(obs)
    obs, reward, terminated, truncated, info = env.step(action)
    x,y,z = env.data.qpos[:3]
    if terminated:
        break

    with open(LOG_FILE, 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow([x, y, z])