"""Test helpers: export torch nets to temporary .onnx files.

The production agents (DQN/PPO/AZ) load from .onnx and run via onnxruntime.
These helpers let tests drive them with freshly-initialised torch nets
without committing fixture files.
"""

from __future__ import annotations

from pathlib import Path

import torch

_OPSET = 17
_EXPORT_KW = {"opset_version": _OPSET, "external_data": False, "dynamo": True}


def export_dqn(net: torch.nn.Module, out: Path) -> Path:
  net.eval()
  torch.onnx.export(
    net,
    (torch.zeros(1, 15),),
    str(out),
    input_names=["obs"],
    output_names=["q"],
    dynamic_axes={"obs": {0: "batch"}, "q": {0: "batch"}},
    **_EXPORT_KW,
  )
  return out


class _PPOPolicyOnly(torch.nn.Module):
  def __init__(self, net: torch.nn.Module) -> None:
    super().__init__()
    self.net = net

  def forward(self, obs: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    log_probs, _, _ = self.net(obs, mask)
    return log_probs


def export_ppo(net: torch.nn.Module, out: Path) -> Path:
  wrapper = _PPOPolicyOnly(net).eval()
  torch.onnx.export(
    wrapper,
    (torch.zeros(1, 15), torch.ones(1, 6)),
    str(out),
    input_names=["obs", "mask"],
    output_names=["log_probs"],
    dynamic_axes={
      "obs": {0: "batch"},
      "mask": {0: "batch"},
      "log_probs": {0: "batch"},
    },
    **_EXPORT_KW,
  )
  return out


def export_az(net: torch.nn.Module, out: Path) -> Path:
  net.eval()
  torch.onnx.export(
    net,
    (torch.zeros(1, 15), torch.ones(1, 6)),
    str(out),
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
  return out
