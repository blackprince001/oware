from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from oware.agents.az.mcts import Evaluator, search
from oware.agents.base import AgentInfo
from oware.agents.onnx_runner import OnnxRunner
from oware.engine import State


def _make_onnx_evaluator(runner: OnnxRunner) -> Evaluator:
  def evaluate(obs: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, float]:
    log_probs, value = runner.run(obs=obs, mask=mask)
    return np.exp(log_probs[0]), float(value[0])

  return evaluate


class AZAgent:
  info = AgentInfo(
    id="az",
    name="AlphaZero",
    family="az",
    description="MCTS with a policy-value ResNet, trained via self-play.",
    est_elo=None,
  )

  def __init__(self, evaluator: Evaluator, n_sims: int = 100) -> None:
    self._evaluator = evaluator
    self._n_sims = n_sims

  @classmethod
  def load(cls, path: Path, n_sims: int = 100) -> "AZAgent":
    return cls(_make_onnx_evaluator(OnnxRunner(path)), n_sims)

  def choose_move(
    self,
    state: State,
    *,
    time_budget_ms: int | None = None,
  ) -> tuple[int, dict[str, Any]]:
    pi = search(state, self._evaluator, self._n_sims, add_noise=False)
    action = int(np.argmax(pi))
    scores = [float(pi[i]) if pi[i] > 0 else None for i in range(6)]
    return action, {"scores": scores, "sims": self._n_sims}
