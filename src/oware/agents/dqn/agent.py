from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from oware.agents.base import AgentInfo
from oware.agents.onnx_runner import OnnxRunner
from oware.engine import State, encode, legal_moves


class DQNAgent:
  info = AgentInfo(
    id="dqn",
    name="DQN",
    family="dqn",
    description="Deep Q-Network trained via self-play against Random and Minimax-d2.",
    est_elo=None,
  )

  def __init__(self, runner: OnnxRunner) -> None:
    self._runner = runner

  @classmethod
  def load(cls, path: Path) -> "DQNAgent":
    return cls(OnnxRunner(path))

  def choose_move(
    self,
    state: State,
    *,
    time_budget_ms: int | None = None,
  ) -> tuple[int, dict[str, Any]]:
    obs = encode(state)[None, :]
    mask = np.zeros(6, dtype=np.float32)
    for m in legal_moves(state):
      mask[m] = 1.0
    (q,) = self._runner.run(obs=obs)
    q = q[0]
    q[mask == 0] = -float("inf")
    action = int(np.argmax(q))
    scores = [float(q[i]) if mask[i] else None for i in range(6)]
    return action, {"scores": scores}
