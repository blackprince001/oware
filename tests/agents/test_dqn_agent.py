from pathlib import Path

from oware.agents.dqn.agent import DQNAgent
from oware.agents.dqn.model import QNetwork
from oware.engine import initial_state, legal_moves

from tests.agents.conftest import export_dqn


def _make_agent(tmp_path: Path, *, zero_weights: bool = False) -> DQNAgent:
  net = QNetwork(dueling=True)
  if zero_weights:
    for p in net.parameters():
      p.data.fill_(0.0)
  onnx_path = export_dqn(net, tmp_path / "dqn.onnx")
  return DQNAgent.load(onnx_path)


def test_choose_move_returns_legal_action(tmp_path: Path):
  agent = _make_agent(tmp_path)
  s = initial_state()
  action, extras = agent.choose_move(s)
  assert action in legal_moves(s)
  assert "scores" in extras
  assert len(extras["scores"]) == 6


def test_choose_move_never_illegal_with_uniform_q(tmp_path: Path):
  """Even with uniform Q-values, the legality mask must hold."""
  agent = _make_agent(tmp_path, zero_weights=True)
  s = initial_state()
  for _ in range(20):
    action, _ = agent.choose_move(s)
    assert action in legal_moves(s)
