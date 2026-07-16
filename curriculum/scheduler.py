"""
Curriculum scheduler for terrain difficulty progression.
Tracks episode performance and automatically promotes or demotes
difficulty based on rolling success rate over a fixed window of 20 episodes.
Promotes when 70% of the last 20 episodes exceed the success threshold,
demotes when 70% of the last 20 episodes fall below it.
"""

MAX_DIFFICULTY = 5
MIN_DIFFICULTY = 1


class CurriculumScheduler:
    """
    Manages terrain difficulty progression during training.
    Every episode, checks the last 20 episodes. If 70% or more lasted
    longer than success_threshold steps, promotes to harder terrain.
    If 70% or more fell short, demotes to easier terrain.
    """

    def __init__(self, window_size=20, success_threshold=350, promotion_threshold=0.7, demotion_threshold=0.7, current_difficulty=1):
        """
        Args:
            window_size: number of recent episodes to evaluate. Default 20.
            success_threshold: minimum episode length in steps to count as success. Default 350.
            promotion_threshold: fraction of window that must succeed to promote. Default 0.7 (70%).
            demotion_threshold: fraction of window that must fail to demote. Default 0.7 (70%).
            current_difficulty: starting difficulty level between 1 and 5. Default 1.
        """
        self.window_size = window_size
        self.success_threshold = success_threshold
        self.promotion_threshold = promotion_threshold
        self.demotion_threshold = demotion_threshold
        self.current_difficulty = current_difficulty
        self.episode_lengths = []

    def record_episode(self, episode_length):
        """Record the length of a completed episode in steps."""
        self.episode_lengths.append(episode_length)

    def should_promote(self):
        """
        Returns True if at least 14 of the last 20 episodes lasted
        350 or more steps. Returns False if fewer than 20 episodes
        have been recorded.
        """
        recent_episodes = self.episode_lengths[-self.window_size:]
        if len(recent_episodes) < self.window_size:
            return False
        valid_episodes = sum(1 for length in recent_episodes if length >= self.success_threshold)
        return valid_episodes / self.window_size >= self.promotion_threshold

    def should_demote(self):
        """
        Returns True if at least 14 of the last 20 episodes lasted
        fewer than 350 steps. Returns False if fewer than 20 episodes
        have been recorded.
        """
        recent_episodes = self.episode_lengths[-self.window_size:]
        if len(recent_episodes) < self.window_size:
            return False
        valid_episodes = sum(1 for length in recent_episodes if length < self.success_threshold)
        return valid_episodes / self.window_size >= self.demotion_threshold

    def promote(self):
        """
        Increment difficulty by 1 up to a maximum of 5 and reset
        the episode history so the next window starts fresh.
        """
        self.current_difficulty = min(MAX_DIFFICULTY, self.current_difficulty + 1)
        self.episode_lengths = []

    def demote(self):
        """
        Decrement difficulty by 1 down to a minimum of 1 and reset
        the episode history so the next window starts fresh.
        """
        self.current_difficulty = max(MIN_DIFFICULTY, self.current_difficulty - 1)
        self.episode_lengths = []