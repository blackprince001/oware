from __future__ import annotations

from pathlib import Path

import numpy as np
import onnxruntime as ort


class OnnxRunner:
  """Thin wrapper around onnxruntime.InferenceSession.

  Forces single-threaded CPU execution — the server runs many concurrent
  game sessions and global thread pools cause contention, not speedup.
  """

  def __init__(self, path: Path) -> None:
    so = ort.SessionOptions()
    so.intra_op_num_threads = 1
    so.inter_op_num_threads = 1
    self._session = ort.InferenceSession(
      str(path), sess_options=so, providers=["CPUExecutionProvider"]
    )
    self._output_names = [o.name for o in self._session.get_outputs()]

  def run(self, **inputs: np.ndarray) -> list[np.ndarray]:
    return self._session.run(self._output_names, inputs)
