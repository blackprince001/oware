"""Export trained .pt checkpoints to .onnx for deployment.

Reads each family's latest.pt, builds the matching network, and writes
latest.onnx alongside it. Run after training; the .onnx artifacts are what
the production server loads (torch is not installed in the image).
"""

from __future__ import annotations

from pathlib import Path

import torch

from oware.agents.az.model import AZNetwork
from oware.agents.dqn.model import QNetwork
from oware.agents.ppo.model import PPONetwork

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
_OPSET = 17
# Inline weights as initializers (single file). Without this, torch.onnx
# externalises tensors above ~1 KB into a sibling .onnx.data — fine for
# huge models, awkward for a 1 MB net we want to ship as one artifact.
_EXPORT_KW = {"opset_version": _OPSET, "external_data": False, "dynamo": True}


def _export_dqn(ckpt_path: Path, out_path: Path) -> None:
  ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
  cfg = ckpt.get("config", {})
  net = QNetwork(dueling=cfg.get("dueling", True))
  net.load_state_dict(ckpt["model"])
  net.eval()
  dummy_obs = torch.zeros(1, 15)
  torch.onnx.export(
    net,
    (dummy_obs,),
    str(out_path),
    input_names=["obs"],
    output_names=["q"],
    dynamic_axes={"obs": {0: "batch"}, "q": {0: "batch"}},
    **_EXPORT_KW,
  )


class _PPOPolicyOnly(torch.nn.Module):
  """Wrap PPONetwork to export only the log_probs head (what the agent uses)."""

  def __init__(self, net: PPONetwork) -> None:
    super().__init__()
    self.net = net

  def forward(self, obs: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    log_probs, _, _ = self.net(obs, mask)
    return log_probs


def _export_ppo(ckpt_path: Path, out_path: Path) -> None:
  ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
  net = PPONetwork()
  net.load_state_dict(ckpt["model"])
  net.eval()
  wrapper = _PPOPolicyOnly(net).eval()
  dummy_obs = torch.zeros(1, 15)
  dummy_mask = torch.ones(1, 6)
  torch.onnx.export(
    wrapper,
    (dummy_obs, dummy_mask),
    str(out_path),
    input_names=["obs", "mask"],
    output_names=["log_probs"],
    dynamic_axes={
      "obs": {0: "batch"},
      "mask": {0: "batch"},
      "log_probs": {0: "batch"},
    },
    **_EXPORT_KW,
  )


def _export_az(ckpt_path: Path, out_path: Path) -> None:
  ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
  net = AZNetwork()
  net.load_state_dict(ckpt["model"])
  net.eval()
  dummy_obs = torch.zeros(1, 15)
  dummy_mask = torch.ones(1, 6)
  torch.onnx.export(
    net,
    (dummy_obs, dummy_mask),
    str(out_path),
    input_names=["obs", "mask"],
    output_names=["log_probs", "value"],
    dynamic_axes={
      "obs": {0: "batch"},
      "mask": {0: "batch"},
      "log_probs": {0: "batch"},
      "value": {0: "batch"},
    },
    **_EXPORT_KW,
  )


def main() -> None:
  jobs = [
    ("dqn", _export_dqn),
    ("ppo", _export_ppo),
    ("az", _export_az),
  ]
  for family, fn in jobs:
    ckpt = _PROJECT_ROOT / f"artifacts/{family}/latest.pt"
    if not ckpt.exists():
      print(f"skip {family}: {ckpt} not found")
      continue
    out = _PROJECT_ROOT / f"artifacts/{family}/latest.onnx"
    fn(ckpt, out)
    print(f"exported {family}: {out} ({out.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
  main()
