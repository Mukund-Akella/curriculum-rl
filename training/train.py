"""
Curriculum training script — trains PPO on terrain starting at difficulty 1,
automatically promoting to harder terrain as the policy improves.
The curriculum scheduler promotes difficulty when 70% of the last 20 episodes
exceed 350 steps. Results are logged to logs/training_logs_curriculum.csv.
"""

import csv
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from envs.terrain_env import TerrainEnv
from curriculum.scheduler import CurriculumScheduler

TOTAL_TIMESTEPS = 50000
LOG_FILE = "logs/training_logs_curriculum.csv"


class CurriculumCallback(BaseCallback):
    """
    Wires the curriculum scheduler into the PPO training loop.
    After every episode, records the result, checks for promotion,
    updates terrain difficulty if promoted, and logs to CSV.
    """

    def __init__(self, scheduler):
        """
        Args:
            scheduler: CurriculumScheduler instance managing difficulty progression
        """
        super().__init__()
        self.scheduler = scheduler

    def _on_step(self):
        """
        Called every timestep. When an episode ends:
        1. Records episode length in the scheduler
        2. Promotes difficulty if 70% of last 20 episodes exceeded 350 steps
        3. Regenerates terrain at new difficulty if promoted
        4. Logs episode result to CSV
        """
        if self.locals["dones"][0]:
            episode_length = self.locals["infos"][0]["episode"]["l"]
            episode_reward = self.locals["infos"][0]["episode"]["r"]
            env = self.training_env.envs[0].env

            self.scheduler.record_episode(episode_length)

            if self.scheduler.should_promote():
                self.scheduler.promote()
                env.difficulty = self.scheduler.current_difficulty
                env._generate_terrain(self.scheduler.current_difficulty)

            success = episode_length >= self.scheduler.success_threshold

            with open(LOG_FILE, 'a', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow([episode_length, env.difficulty, episode_reward, success])

        return True


if __name__ == "__main__":
    scheduler = CurriculumScheduler(
        window_size=20,
        success_threshold=350,
        promotion_threshold=0.7,
        demotion_threshold=0.7
    )

    env = TerrainEnv()
    model = PPO("MlpPolicy", env, verbose=1)
    model.learn(
        total_timesteps=TOTAL_TIMESTEPS,
        callback=CurriculumCallback(scheduler)
    )
    model.save("ppo_curriculum_model")