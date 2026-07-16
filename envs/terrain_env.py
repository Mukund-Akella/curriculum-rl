"""
MuJoCo terrain environment for wheeled robot locomotion.
Defines a two-wheeled robot on a procedurally generated heightfield terrain.
Difficulty level controls terrain roughness from flat (1) to highly uneven (5).
"""

import mujoco
import numpy as np
import gymnasium as gym
import scipy.ndimage

# Terrain resolution — number of grid points in each dimension
TERRAIN_GRID_SIZE = 100

# Robot spawns at this height so wheels just contact the ground
ROBOT_SPAWN_HEIGHT = 0.07

# Episode ends if quaternion w drops below this value
# w=1.0 means perfectly upright, w=0.7 corresponds to ~90 degrees of tilt
TERMINATION_W_THRESHOLD = 0.7

# Maximum forward velocity reward clipped per step
MAX_VELOCITY_REWARD = 0.7


class TerrainEnv(gym.Env):
    """
    A two-wheeled robot environment with procedurally generated heightfield terrain.
    The robot receives reward for moving forward and staying upright.
    Terrain difficulty increases from 1 (flat) to 5 (rough and uneven).
    """

    def __init__(self, difficulty=1):
        """
        Args:
            difficulty: starting terrain difficulty between 1 and 5. Default 1.
        """
        super().__init__()
        self.difficulty = difficulty

        xml = """
        <mujoco model="terrain_world">
            <asset>
                <hfield name="terrain" nrow="100" ncol="100" size="5 5 1 0.1"/>
            </asset>
            <worldbody>
                <light diffuse=".5 .5 .5" pos="0 0 3" dir="0 0 -1"/>
                <geom name="floor" type="hfield" hfield="terrain" pos="0 0 0"/>
                <body name="robot" pos="0 0 0.07">
                    <freejoint/>
                    <geom name="robot_geom" type="box" size=".05 .02 .02" rgba="1 0 0 1"/>
                    <inertial pos="0 0 0" mass=".1" diaginertia=".1 .1 .1"/>
                    <body name="left_wheel" pos="0 .05 -.02">
                        <joint name="base_to_left_wheel" type="hinge" axis="1 0 0"/>
                        <geom name="left_wheel_geom" type="cylinder" size=".03 .01" rgba="0 0 0 1"/>
                    </body>
                    <body name="right_wheel" pos="0 -.05 -0.02">
                        <joint name="base_to_right_wheel" type="hinge" axis="1 0 0"/>
                        <geom name="right_wheel_geom" type="cylinder" size=".03 .01" rgba="0 0 0 1"/>
                    </body>
                </body>
            </worldbody>
            <actuator>
                <motor joint="base_to_left_wheel" gear="10"/>
                <motor joint="base_to_right_wheel" gear="10"/>
            </actuator>
        </mujoco>
        """

        self.model = mujoco.MjModel.from_xml_string(xml)
        self.data = mujoco.MjData(self.model)

        self.observation_space = gym.spaces.Box(
            low=np.array([0, -np.inf, -np.inf, -1, -1, -1, -1]),
            high=np.array([np.inf, np.inf, np.inf, 1, 1, 1, 1]),
            shape=(7,),
            dtype=np.float32
        )

        self.action_space = gym.spaces.Box(
            low=np.array([-1, -1]),
            high=np.array([1, 1]),
            shape=(2,),
            dtype=np.float32
        )

        self._generate_terrain(self.difficulty)

    def reset(self, seed=None, options=None):
        """Reset the simulation to its initial state and regenerate terrain."""
        super().reset(seed=seed)
        mujoco.mj_resetData(self.model, self.data)
        self._generate_terrain(self.difficulty)
        return self._get_obs(), {}

    def step(self, action):
        """
        Apply action to the robot and advance the simulation one timestep.

        Args:
            action: numpy array of shape (2,) containing left and right wheel torques in [-1, 1]

        Returns:
            obs: current observation vector of shape (7,)
            reward: scalar reward for this timestep
            terminated: True if robot has tipped beyond recovery
            truncated: always False, no time limit enforced here
            info: empty dict
        """
        self.data.ctrl[:] = action
        mujoco.mj_step(self.model, self.data)
        obs = self._get_obs()
        reward = self._compute_reward()
        terminated = self._is_terminated()
        return obs, reward, terminated, False, {}

    def _get_obs(self):
        """
        Return the current observation vector.

        Observation layout:
            [0]   z position — height of chassis off the ground
            [1]   vx — linear velocity in x direction
            [2]   vy — linear velocity in y direction (forward)
            [3:7] quaternion (w, qx, qy, qz) — chassis orientation
        """
        return np.concatenate((
            np.array([self.data.qpos[2], self.data.qvel[0], self.data.qvel[1]]),
            self.data.qpos[3:7]
        )).astype(np.float32)

    def _compute_reward(self):
        """
        Compute the per-step reward.

        Two components:
            velocity reward — forward velocity (vy) clipped to MAX_VELOCITY_REWARD (0.7)
            stability reward — quaternion w value, high when upright, low when tipping

        Returns:
            scalar reward between 0 and 1.7
        """
        velocity_reward = np.clip(self.data.qvel[1], 0, MAX_VELOCITY_REWARD)
        stability_reward = self.data.qpos[3]
        return velocity_reward + stability_reward

    def _is_terminated(self):
        """
        Return True if the robot has tipped beyond recovery.
        Termination occurs when quaternion w drops below 0.7,
        corresponding to roughly 90 degrees of tilt.
        """
        return bool(self.data.qpos[3] <= TERMINATION_W_THRESHOLD)

    def _generate_terrain(self, difficulty):
        """
        Procedurally generate a heightfield terrain at the given difficulty level.

        Higher difficulty produces rougher terrain with sharper elevation changes:
            difficulty 1 — nearly flat, heavy smoothing (sigma=5)
            difficulty 5 — rough and uneven, light smoothing (sigma=1)

        Args:
            difficulty: integer between 1 and 5
        """
        self.difficulty = difficulty
        noise = np.random.rand(TERRAIN_GRID_SIZE, TERRAIN_GRID_SIZE) * difficulty
        smoothed = scipy.ndimage.gaussian_filter(noise, sigma=(6 - difficulty))
        normalized = smoothed / np.max(smoothed)
        self.model.hfield_data = normalized.flatten().astype(np.float64)