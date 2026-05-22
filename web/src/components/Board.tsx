import { BoardView } from "./BoardView";
import { useBoardAnimation } from "../hooks/useBoardAnimation";
import type { Pace } from "../hooks/useBoardAnimation";
import type { GameState } from "../lib/protocol";

interface Props {
  state: GameState;
  onPlay: (pit: number) => void;
  disabled: boolean;
  pace?: Pace;
  source?: { stateSeq: number; drainStates: () => GameState[] };
}

export function Board({ state, onPlay, disabled, pace, source }: Props) {
  const anim = useBoardAnimation(state, pace, source);
  const view = anim.displayed ?? state;
  const isAnimating = anim.animating;

  return (
    <BoardView
      frame={{
        pits: view.pits,
        stores: view.stores,
        last_move: view.last_move ? { by: view.last_move.by, pit: view.last_move.pit } : null,
      }}
      legalMoves={view.legal_moves}
      onPlay={onPlay}
      disabled={disabled || isAnimating}
      flyingPit={anim.flyingPit}
      flyingTo={anim.flyingTo}
    />
  );
}
