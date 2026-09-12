"""
Tests for curriculum-rl project.
Run with: PYTHONPATH=. pytest tests/ -v
"""

import pytest
import numpy as np
from unittest.mock import patch, MagicMock


# ============================================================
# SECTION 1 — Curriculum Scheduler Tests
# These test the core algorithm of the project
# ============================================================

from curriculum.scheduler import CurriculumScheduler

class TestCurriculumScheduler:

    def setup_method(self):
        """Create a fresh scheduler before each test."""
        self.scheduler = CurriculumScheduler(
            window_size=20,
            success_threshold=350,
            promotion_threshold=0.7,
            demotion_threshold=0.7
        )

    def test_should_not_promote_with_empty_window(self):
        """
        Should not promote when fewer than 20 episodes recorded.
        Prevents premature promotion on insufficient data.
        """
        for _ in range(19):
            self.scheduler.record_episode(400)
        assert self.scheduler.should_promote() == False

    def test_should_promote_when_70_percent_succeed(self):
        """
        Should promote when exactly 14 of 20 episodes exceed 350 steps.
        14/20 = 70% which meets the promotion threshold.
        """
        for _ in range(14):
            self.scheduler.record_episode(400)
        for _ in range(6):
            self.scheduler.record_episode(200)
        assert self.scheduler.should_promote() == True

    def test_should_not_promote_when_below_threshold(self):
        """
        Should not promote when only 13 of 20 episodes succeed.
        13/20 = 65% which is below the 70% threshold.
        """
        for _ in range(13):
            self.scheduler.record_episode(400)
        for _ in range(7):
            self.scheduler.record_episode(200)
        assert self.scheduler.should_promote() == False

    def test_promote_increments_difficulty(self):
        """
        Promoting should increment difficulty by exactly 1.
        """
        assert self.scheduler.current_difficulty == 1
        self.scheduler.promote()
        assert self.scheduler.current_difficulty == 2

    def test_promote_caps_at_max_difficulty(self):
        """
        Difficulty should never exceed 5 regardless of how many times
        promote is called.
        """
        for _ in range(10):
            self.scheduler.promote()
        assert self.scheduler.current_difficulty == 5

    def test_promote_resets_episode_history(self):
        """
        After promotion, episode history should be empty so the next
        window starts fresh at the new difficulty level.
        """
        for _ in range(20):
            self.scheduler.record_episode(400)
        self.scheduler.promote()
        assert len(self.scheduler.episode_lengths) == 0

    def test_demote_decrements_difficulty(self):
        """
        Demoting should decrement difficulty by exactly 1.
        """
        self.scheduler.promote()
        assert self.scheduler.current_difficulty == 2
        self.scheduler.demote()
        assert self.scheduler.current_difficulty == 1

    def test_demote_floors_at_difficulty_1(self):
        """
        Difficulty should never go below 1 regardless of how many times
        demote is called.
        """
        for _ in range(10):
            self.scheduler.demote()
        assert self.scheduler.current_difficulty == 1

    def test_should_demote_when_70_percent_fail(self):
        """
        Should demote when 14 of 20 episodes fall below 350 steps.
        """
        for _ in range(14):
            self.scheduler.record_episode(200)
        for _ in range(6):
            self.scheduler.record_episode(400)
        assert self.scheduler.should_demote() == True

    def test_promote_and_demote_mutually_exclusive(self):
        """
        Should never be able to promote and demote simultaneously.
        If 70% succeed, cannot also have 70% fail.
        """
        for _ in range(14):
            self.scheduler.record_episode(400)
        for _ in range(6):
            self.scheduler.record_episode(200)
        assert not (self.scheduler.should_promote() and self.scheduler.should_demote())


# ============================================================
# SECTION 2 — Terrain Generation Tests
# These test that terrain output is valid for MuJoCo
# ============================================================

from envs.terrain_env import TerrainEnv, ROBOT_SPAWN_CLEARANCE

class TestTerrainGeneration:

    def setup_method(self):
        """Create environment once per test."""
        self.env = TerrainEnv(difficulty=1)

    def test_terrain_values_between_0_and_1(self):
        """
        All heightfield values must be between 0 and 1.
        MuJoCo scales these by the size attribute — values outside
        this range produce incorrect terrain heights.
        """
        terrain = self.env.model.hfield_data
        assert np.all(terrain >= 0.0)
        assert np.all(terrain <= 1.0)

    def test_terrain_shape_is_correct(self):
        """
        Heightfield must be exactly 10000 elements (100x100 flattened).
        MuJoCo uses nrow and ncol to interpret the flat array.
        """
        terrain = self.env.model.hfield_data
        assert len(terrain) == 10000

    def test_terrain_dtype_is_float32(self):
        """
        MuJoCo expects float64 for heightfield data.
        Wrong dtype causes incorrect physics calculations.
        """
        terrain = self.env.model.hfield_data
        assert terrain.dtype == np.float32

    def test_difficulty_5_has_less_smoothing_than_difficulty_1(self):
        """
        Higher difficulty uses lower sigma (less smoothing).
        Difficulty 5 terrain should have sharper transitions between
        adjacent grid points than difficulty 1.
        """
        results = []
        for _ in range(20):
            env1 = TerrainEnv(difficulty=1)
            env5 = TerrainEnv(difficulty=5)
            terrain1 = env1.model.hfield_data.reshape(100, 100)
            terrain5 = env5.model.hfield_data.reshape(100, 100)
            diff1 = np.mean(np.abs(np.diff(terrain1)))
            diff5 = np.mean(np.abs(np.diff(terrain5)))
            results.append(diff5 > diff1)
        assert sum(results) > 15

    def test_terrain_regenerates_on_reset(self):
        """
        Terrain should be different after reset due to random generation.
        This verifies domain randomization is working.
        """
        terrain_before = self.env.model.hfield_data.copy()
        self.env.reset()
        terrain_after = self.env.model.hfield_data.copy()
        assert not np.array_equal(terrain_before, terrain_after)


# ============================================================
# SECTION 3 — Environment Tests
# These test the observation space and action space
# ============================================================

class TestEnvironment:

    def setup_method(self):
        self.env = TerrainEnv(difficulty=1)

    def test_observation_shape(self):
        """
        Observation must be exactly 7 values.
        [z, vx, vy, qw, qx, qy, qz]
        """
        obs, _ = self.env.reset()
        assert obs.shape == (7,)

    def test_observation_dtype(self):
        """
        Observation must be float32 to match observation_space definition.
        Type mismatch causes stable-baselines3 to crash.
        """
        obs, _ = self.env.reset()
        assert obs.dtype == np.float32

    def test_action_space_shape(self):
        """
        Action space must have 4 dimensions — one per wheel.
        """
        assert self.env.action_space.shape == (4,)

    def test_action_space_bounds(self):
        """
        All wheel torques must be bounded between -1 and 1.
        Unbounded actions cause unstable training.
        """
        assert np.all(self.env.action_space.low == -1)
        assert np.all(self.env.action_space.high == 1)

    def test_reset_returns_valid_observation(self):
        """
        Reset must return observation within defined bounds.
        """
        obs, info = self.env.reset()
        assert self.env.observation_space.contains(obs)
        assert isinstance(info, dict)

    def test_step_returns_correct_format(self):
        """
        Step must return exactly 5 values in correct types.
        Gymnasium requires (obs, reward, terminated, truncated, info).
        """
        self.env.reset()
        action = self.env.action_space.sample()
        result = self.env.step(action)
        assert len(result) == 5
        obs, reward, terminated, truncated, info = result
        assert isinstance(reward, float)
        assert isinstance(terminated, bool)
        assert isinstance(truncated, bool)
        assert isinstance(info, dict)

    def test_termination_on_tip(self):
        """
        Episode should terminate when robot tips beyond 90 degrees.
        Directly set quaternion w below threshold and verify termination.
        """
        self.env.reset()
        self.env.data.qpos[3] = 0.5
        assert self.env._is_terminated() == True

    def test_no_termination_when_upright(self):
        """
        Episode should not terminate when robot is upright.
        """
        self.env.reset()
        assert self.env._is_terminated() == False

    def test_spawn_height_matches_local_terrain(self):
        """
        Robot should spawn ROBOT_SPAWN_CLEARANCE above the terrain height at
        its own (x, y), not at a fixed height regardless of terrain.

        Regression test: a hardcoded spawn height caused the robot to spawn
        embedded in the terrain whenever the randomly generated terrain was
        taller than that fixed height, which the contact solver then resolved
        by pushing the robot straight up out of the ground over many steps —
        visible as bouncing in place with no lateral movement.
        """
        obs, _ = self.env.reset()
        expected_z = self.env._terrain_height_at(0.0, 0.0) + ROBOT_SPAWN_CLEARANCE
        assert self.env.data.qpos[2] == pytest.approx(expected_z, abs=1e-6)

    def test_no_deep_penetration_at_spawn(self):
        """
        No contact should show significant penetration depth right after
        reset. A large negative `dist` here means the robot spawned inside
        the terrain rather than resting on top of it.
        """
        self.env.reset()
        for i in range(self.env.data.ncon):
            assert self.env.data.contact[i].dist > -0.01