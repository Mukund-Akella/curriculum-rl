"""
MuJoCo terrain environment for wheeled robot locomotion.
Defines a four-wheeled robot on a procedurally generated heightfield terrain.
Difficulty level controls terrain roughness from flat (1) to highly uneven (5).
"""

import mujoco
import numpy as np
import gymnasium as gym
import scipy.ndimage

TERRAIN_GRID_SIZE = 100
TERRAIN_HALF_EXTENT = 5     # terrain spans -5..5 meters in x and y
TERRAIN_ELEVATION_Z = 0.15  # max terrain height in meters
TERRAIN_BASE_Z = 0.1
TERMINATION_W_THRESHOLD = 0.7
MAX_VELOCITY_REWARD = 0.7

# Body-origin height above the local terrain surface to spawn at. The wheels sit
# 0.03m below the chassis origin (0.02m body offset + 0.01m wheel half-height), so
# this needs to clear that plus a small margin or the robot spawns embedded in the
# terrain and gets violently pushed out by contact resolution on the first step.
ROBOT_SPAWN_CLEARANCE = 0.05

# Elevation color scale: low -> mid -> high, used to texture the terrain
# so relative height is readable at a glance in the viewer.
ELEVATION_COLOR_STOPS = np.array([
    [30, 100, 30],    # low: dark green
    [200, 200, 40],   # mid: yellow
    [180, 30, 30],    # high: red
])


class TerrainEnv(gym.Env):
    """
    A four-wheeled robot environment with procedurally generated terrain.
    The robot receives reward for moving forward and staying upright.
    Terrain difficulty increases from 1 (flat) to 5 (rough and uneven).
    """

    def __init__(self, difficulty=1):
        super().__init__()
        self.difficulty = difficulty

        xml = f"""
        <mujoco model="terrain_world">
            <asset>
                <hfield name="terrain" nrow="{TERRAIN_GRID_SIZE}" ncol="{TERRAIN_GRID_SIZE}" size="{TERRAIN_HALF_EXTENT} {TERRAIN_HALF_EXTENT} {TERRAIN_ELEVATION_Z} {TERRAIN_BASE_Z}"/>
                <texture name="height_tex" type="2d" builtin="flat" rgb1="0 0 0" width="{TERRAIN_GRID_SIZE}" height="{TERRAIN_GRID_SIZE}"/>
                <material name="terrain_mat" texture="height_tex" texuniform="true" texrepeat="1 1" shininess="0.1" specular="0.1"/>
            </asset>
            <worldbody>
                <light diffuse="1 1 1" pos="0 0 10" dir="0 0 -1" castshadow="false"/>
                <light diffuse=".5 .5 .5" pos="10 10 5" dir="-1 -1 -1" castshadow="false"/>
                <light diffuse=".5 .5 .5" pos="-10 10 5" dir="1 -1 -1" castshadow="false"/>
                <geom name="floor" type="hfield" hfield="terrain" pos="0 0 0" rgba="1 1 1 1" material="terrain_mat"/>
                <body name="robot" pos="0 0 0.07">
                    <freejoint/>
                    <geom name="robot_geom" type="box" size=".1 .06 .02" rgba="1 0 0 1"/>
                    <inertial pos="0 0 0" mass=".5" diaginertia=".1 .1 .1"/>
                    <body name="front_left_wheel" pos=".07 .07 -.02">
                        <joint name="front_left_joint" type="hinge" axis="0 1 0"/>
                        <geom name="fl_wheel" type="cylinder" size=".03 .01" rgba="0 0 0 1"/>
                    </body>
                    <body name="front_right_wheel" pos=".07 -.07 -.02">
                        <joint name="front_right_joint" type="hinge" axis="0 1 0"/>
                        <geom name="fr_wheel" type="cylinder" size=".03 .01" rgba="0 0 0 1"/>
                    </body>
                    <body name="rear_left_wheel" pos="-.07 .07 -.02">
                        <joint name="rear_left_joint" type="hinge" axis="0 1 0"/>
                        <geom name="rl_wheel" type="cylinder" size=".03 .01" rgba="0 0 0 1"/>
                    </body>
                    <body name="rear_right_wheel" pos="-.07 -.07 -.02">
                        <joint name="rear_right_joint" type="hinge" axis="0 1 0"/>
                        <geom name="rr_wheel" type="cylinder" size=".03 .01" rgba="0 0 0 1"/>
                    </body>
                </body>
            </worldbody>
            <actuator>
                <motor joint="front_left_joint" gear="10"/>
                <motor joint="front_right_joint" gear="10"/>
                <motor joint="rear_left_joint" gear="10"/>
                <motor joint="rear_right_joint" gear="10"/>
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
            low=np.array([-1, -1, -1, -1]),
            high=np.array([1, 1, 1, 1]),
            shape=(4,),
            dtype=np.float32
        )

        self._tex_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_TEXTURE, "height_tex")
        self._generate_terrain(self.difficulty)

    def reset(self, seed=None, options=None):
        """Reset the simulation and regenerate terrain."""
        super().reset(seed=seed)
        mujoco.mj_resetData(self.model, self.data)
        self._generate_terrain(self.difficulty)
        self.data.qpos[2] = self._terrain_height_at(0.0, 0.0) + ROBOT_SPAWN_CLEARANCE
        mujoco.mj_forward(self.model, self.data)
        return self._get_obs(), {}

    def step(self, action):
        """
        Apply action and advance simulation one timestep.
        Returns obs, reward, terminated, truncated, info.
        """
        self.data.ctrl[:] = action
        mujoco.mj_step(self.model, self.data)
        obs = self._get_obs()
        reward = self._compute_reward()
        terminated = self._is_terminated()
        return obs, reward, terminated, False, {}

    def _get_obs(self):
        """
        Return 7-dimensional observation:
        [z, vx, vy, qw, qx, qy, qz]
        """
        return np.concatenate((
            np.array([self.data.qpos[2], self.data.qvel[0], self.data.qvel[1]]),
            self.data.qpos[3:7]
        )).astype(np.float32)

    def _compute_reward(self):
        """
        Velocity reward (forward speed clipped at 0.7) plus
        stability reward (quaternion w, 1.0 when upright).
        Max reward per step: 1.7
        """
        velocity_reward = np.clip(self.data.qvel[1], 0, MAX_VELOCITY_REWARD)
        stability_reward = self.data.qpos[3]
        return velocity_reward + stability_reward

    def _is_terminated(self):
        """
        End episode when quaternion w drops below 0.7
        corresponding to roughly 90 degrees of tilt.
        """
        return bool(self.data.qpos[3] <= TERMINATION_W_THRESHOLD)

    def _generate_terrain(self, difficulty):
        """
        Generate heightfield terrain at given difficulty.
        Higher difficulty = more noise + less smoothing = sharper bumps.
        difficulty 1: sigma=5 (smooth)
        difficulty 5: sigma=1 (rough)
        """
        self.difficulty = difficulty
        noise = np.random.rand(TERRAIN_GRID_SIZE, TERRAIN_GRID_SIZE) * difficulty
        smoothed = scipy.ndimage.gaussian_filter(noise, sigma=(6 - difficulty))
        normalized = (smoothed - np.min(smoothed)) / (np.max(smoothed) - np.min(smoothed))
        self.model.hfield_data = normalized.flatten().astype(np.float64)
        self._update_elevation_texture(normalized)
        self._height_grid = normalized
        self.model.hfield_data = normalized.flatten().astype(np.float64)

    def _terrain_height_at(self, x, y):
        """World-space terrain height in meters at (x, y), via nearest grid cell."""
        col = int(round((x + TERRAIN_HALF_EXTENT) / (2 * TERRAIN_HALF_EXTENT) * (TERRAIN_GRID_SIZE - 1)))
        row = int(round((y + TERRAIN_HALF_EXTENT) / (2 * TERRAIN_HALF_EXTENT) * (TERRAIN_GRID_SIZE - 1)))
        col = int(np.clip(col, 0, TERRAIN_GRID_SIZE - 1))
        row = int(np.clip(row, 0, TERRAIN_GRID_SIZE - 1))
        return self._height_grid[row, col] * TERRAIN_ELEVATION_Z

    def _update_elevation_texture(self, normalized):
        """
        Color the terrain texture by elevation (dark green -> yellow -> red,
        low to high) so relative height is visible at a glance in the viewer.
        """
        low, mid, high = ELEVATION_COLOR_STOPS
        t = np.clip(normalized * 2, 0, 1)[..., None]
        lower_half = low * (1 - t) + mid * t
        t2 = np.clip(normalized * 2 - 1, 0, 1)[..., None]
        upper_half = mid * (1 - t2) + high * t2
        colors = np.where(normalized[..., None] < 0.5, lower_half, upper_half)

        adr = self.model.tex_adr[self._tex_id]
        w = self.model.tex_width[self._tex_id]
        h = self.model.tex_height[self._tex_id]
        n = self.model.tex_nchannel[self._tex_id]
        self.model.tex_data[adr:adr + w * h * n] = colors.astype(np.uint8).flatten()

    def plot_terrain_3d(self, path="terrain_3d.png", vertical_exaggeration=3, elev=45, azim=-60):
        """
        Render the current terrain as a shaded 3D surface plot and save it to `path`.

        The live MuJoCo terrain is only TERRAIN_ELEVATION_Z (0.15m) tall relative to a
        10x10m map, so hill shapes barely read from a normal viewing distance. This
        plots the same height data with the z-axis independently auto-scaled (matplotlib's
        default 3D behavior) plus an extra multiplier, so the hills are clearly visible,
        using the same green->yellow->red elevation coloring as the in-sim heatmap.

        Args:
            path: file path to save the PNG to
            vertical_exaggeration: extra multiplier applied to the height data on top
                of matplotlib's default axis auto-scaling, for more/less dramatic relief
            elev, azim: matplotlib 3D camera elevation/azimuth in degrees
        """
        import matplotlib.pyplot as plt
        from matplotlib.colors import LinearSegmentedColormap

        cmap = LinearSegmentedColormap.from_list("elevation", ELEVATION_COLOR_STOPS / 255)

        axis = np.linspace(-TERRAIN_HALF_EXTENT, TERRAIN_HALF_EXTENT, TERRAIN_GRID_SIZE)
        x, y = np.meshgrid(axis, axis)
        z = self._height_grid * TERRAIN_ELEVATION_Z * vertical_exaggeration

        fig = plt.figure(figsize=(8, 6))
        ax = fig.add_subplot(111, projection="3d")
        ax.plot_surface(x, y, z, cmap=cmap, rstride=1, cstride=1,
                         linewidth=0, antialiased=True)
        ax.set_xlabel("x (m)")
        ax.set_ylabel("y (m)")
        ax.set_zlabel(f"height (m x{vertical_exaggeration})")
        ax.set_title(f"Terrain — difficulty {self.difficulty} (z exaggerated {vertical_exaggeration}x)")
        ax.view_init(elev=elev, azim=azim)
        fig.savefig(path, dpi=150, bbox_inches="tight")
        plt.close(fig)
        return path