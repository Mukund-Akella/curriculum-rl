"""
Celery background tasks for running PPO training and evaluation.
Writes results to PostgreSQL and publishes live updates to Redis.
"""

from celery import Celery
import redis
import os
import json
from stable_baselines3 import PPO
from envs.terrain_env import TerrainEnv
from curriculum.scheduler import CurriculumScheduler
from stable_baselines3.common.callbacks import BaseCallback
from database import insert_episode, update_run_status, insert_trajectory

SUCCESS_THRESHOLD = 350
MODELS_DIR = "/app/models"

celery_app = Celery(
    "trainer",
    broker=os.environ["REDIS_URL"],
    backend=os.environ["REDIS_URL"]
)


class CurriculumCallback(BaseCallback):
    """
    Wires the curriculum scheduler into the PPO training loop.
    After every episode, records the result, checks for promotion,
    updates terrain difficulty if promoted, and writes to PostgreSQL and Redis.
    """

    def __init__(self, run_id, scheduler, redis_connection):
        """
        Args:
            run_id: Unique identifier for the training run
            scheduler: CurriculumScheduler instance managing difficulty progression
            redis_connection: Redis connection instance for live updates
        """
        super().__init__()
        self.scheduler = scheduler
        self.run_id = run_id
        self.redis_connection = redis_connection
        self.episode_number = 0

    def _on_step(self):
        """
        Called every timestep. When an episode ends:
        1. Records episode length in the scheduler
        2. Promotes difficulty if 70% of last 20 episodes exceeded 350 steps
        3. Regenerates terrain at new difficulty if promoted
        4. Writes episode result to PostgreSQL and publishes update to Redis
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

            self.episode_number += 1
            insert_episode(self.run_id, self.episode_number, episode_length, env.difficulty, episode_reward, success)

            self.redis_connection.publish("training_updates", json.dumps({
                "run_id": self.run_id,
                "episode_length": episode_length,
                "difficulty": env.difficulty,
                "reward": episode_reward,
                "success": success
            }))

        return True


class BaselineCallback(BaseCallback):
    """
    Logs episode results to PostgreSQL and Redis after every episode.
    No curriculum logic — just records what happened.
    """

    def __init__(self, redis_connection, run_id):
        super().__init__()
        self.redis_connection = redis_connection
        self.run_id = run_id
        self.episode_number = 0

    def _on_step(self):
        if self.locals["dones"][0]:
            episode_length = self.locals["infos"][0]["episode"]["l"]
            episode_reward = self.locals["infos"][0]["episode"]["r"]
            env = self.training_env.envs[0].env
            success = episode_length >= SUCCESS_THRESHOLD

            self.episode_number += 1
            insert_episode(self.run_id, self.episode_number, episode_length, env.difficulty, episode_reward, success)
            self.redis_connection.publish("training_updates", json.dumps({
                "run_id": self.run_id,
                "episode_length": episode_length,
                "difficulty": env.difficulty,
                "reward": episode_reward,
                "success": success
            }))

        return True


@celery_app.task
def run_training(run_id, run_type, total_timesteps, starting_difficulty):
    try:
        os.makedirs(MODELS_DIR, exist_ok=True)
        redis_connection = redis.Redis.from_url(os.environ["REDIS_URL"])
        update_run_status(run_id, "running")
        env = TerrainEnv(difficulty=starting_difficulty)

        if run_type == "curriculum":
            scheduler = CurriculumScheduler(
                window_size=20,
                success_threshold=350,
                promotion_threshold=0.7,
                demotion_threshold=0.7
            )
            callback = CurriculumCallback(run_id, scheduler, redis_connection)
        else:
            callback = BaselineCallback(redis_connection, run_id)

        model = PPO("MlpPolicy", env, verbose=1)
        model.learn(total_timesteps=total_timesteps, callback=callback)
        model.save(f"{MODELS_DIR}/run_{run_id}")
        update_run_status(run_id, "completed")

    except Exception as e:
        update_run_status(run_id, "failed")
        raise e


@celery_app.task
def evaluate_run(run_id):
    try:
        update_run_status(run_id, "evaluating")
        model = PPO.load(f"{MODELS_DIR}/run_{run_id}")
        env = TerrainEnv(difficulty=5)
        obs, _ = env.reset()

        for step in range(500):
            action, _ = model.predict(obs)
            obs, reward, terminated, truncated, info = env.step(action)
            x, y, z = env.data.qpos[:3]
            insert_trajectory(run_id, step, float(x), float(y), float(z))
            if terminated:
                break

        update_run_status(run_id, "completed")

    except Exception as e:
        update_run_status(run_id, "failed")
        raise e