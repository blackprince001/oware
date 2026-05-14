from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from oware.agents.base import AgentInfo
from oware.agents.onnx_runner import OnnxRunner
from oware.engine import State, encode, legal_moves


class PPOAgent:
  info = AgentInfo(
    id="ppo",
    name="PPO",
    family="ppo",
    description="Proximal Policy Optimisation trained via self-play against Random and Minimax.",
    est_elo=None,
  )

  def __init__(self, runner: OnnxRunner) -> None:
    self._runner = runner

  @classmethod
  def load(cls, path: Path) -> "PPOAgent":
    return cls(OnnxRunner(path))

  def choose_move(
    self,
    state: State,
    *,
    time_budget_ms: int | None = None,
  ) -> tuple[int, dict[str, Any]]:
    obs = encode(state)[None, :]
    mask = np.zeros((1, 6), dtype=np.float32)
    for m in legal_moves(state):
      mask[0, m] = 1.0
    (log_probs,) = self._runner.run(obs=obs, mask=mask)
    lp = log_probs[0]
    action = int(np.argmax(lp))
    scores = [float(lp[i]) if mask[0, i] else None for i in range(6)]
    return action, {"scores": scores}
