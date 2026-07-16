"""
Baseline training script — trains PPO directly on difficulty 5 terrain
with no curriculum. Used as a comparison against the curriculum training run.
Results are logged to training_logs_baseline.csv.
"""

import csv
import gymnasium as gym
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from envs.terrain_env import TerrainEnv

# Must match the success threshold used in the curriculum run for fair comparison
SUCCESS_THRESHOLD = 350
TOTAL_TIMESTEPS = 50000
LOG_FILE = "logs/training_logs_baseline.csv"


class BaselineCallback(BaseCallback):
    """
    Logs episode results to CSV after every episode.
    No curriculum logic — just records what happened.
    """

    def __init__(self):
        super().__init__()

    def _on_step(self):
        """
        Called every timestep. When an episode ends, logs episode length,
        difficulty, total reward, and whether the episode was a success.
        """
        if self.locals["dones"][0]:
            episode_length = self.locals["infos"][0]["episode"]["l"]
            episode_reward = self.locals["infos"][0]["episode"]["r"]
            env = self.training_env.envs[0].env
            success = episode_length >= SUCCESS_THRESHOLD

            with open(LOG_FILE, 'a', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow([episode_length, env.difficulty, episode_reward, success])

        return True


if __name__ == "__main__":
    env = TerrainEnv(difficulty=5)
    model = PPO("MlpPolicy", env, verbose=1)
    model.learn(total_timesteps=TOTAL_TIMESTEPS, callback=BaselineCallback())
    model.save("ppo_baseline_model")