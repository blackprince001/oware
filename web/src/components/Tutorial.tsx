import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface Props {
  onClose: () => void;
}

// --- Board layout constants (mini board) ---
const TOP_ROW_ABS = [11, 10, 9, 8, 7, 6];
const BOTTOM_ROW_ABS = [0, 1, 2, 3, 4, 5];

// --- Frame model ---
interface Frame {
  pits: number[]; // length 12
  stores: { south: number; north: number };
  emphasize?: number[]; // pit indices currently in action
  illegal?: number[]; // pit indices to mark illegal (red dashed)
  legal?: number[]; // pit indices to mark legal (green dashed)
  forfeit?: number[]; // pit indices a capture is being forfeited from
  hold: number;
}

// Sowing path = list of pit indices to drop into, in order.
function buildDemo(
  start: number[],
  from: number,
  sowPath: number[],
  captureChain: number[] = [],
  forfeit = false,
): Frame[] {
  const frames: Frame[] = [];
  const zeroStore = { south: 0, north: 0 };

  // 1. Show source
  frames.push({ pits: [...start], stores: { ...zeroStore }, emphasize: [from], hold: 700 });

  // 2. Pluck
  const plucked = [...start];
  plucked[from] = 0;
  frames.push({ pits: plucked, stores: { ...zeroStore }, emphasize: [from], hold: 350 });

  // 3. Sow each
  let cur = plucked;
  for (const t of sowPath) {
    cur = [...cur];
    cur[t] += 1;
    frames.push({ pits: cur, stores: { ...zeroStore }, emphasize: [t], hold: 380 });
  }

  // 4. Capture (or forfeit)
  let south = 0;
  if (forfeit && captureChain.length > 0) {
    frames.push({ pits: cur, stores: { south, north: 0 }, forfeit: captureChain, hold: 1600 });
  } else {
    for (const p of captureChain) {
      const next = [...cur];
      south += next[p];
      next[p] = 0;
      cur = next;
      frames.push({ pits: cur, stores: { south, north: 0 }, emphasize: [p], hold: 480 });
    }
  }

  // 5. Hold final
  frames.push({ pits: cur, stores: { south, north: 0 }, hold: 1500 });

  return frames;
}

interface Step {
  title: string;
  body: ReactNode;
  frames: Frame[];
}

const INITIAL_POSITION = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];

const STEPS: Step[] = [
  // 1. Board layout
  {
    title: "The board",
    body: (
      <>
        Your six pits are the <b>bottom row</b>. The opponent's pits are on top. Your store sits on
        the right. Each pit starts with <b>4 seeds</b>.
      </>
    ),
    frames: [
      {
        pits: [...INITIAL_POSITION],
        stores: { south: 0, north: 0 },
        legal: [0, 1, 2, 3, 4, 5],
        hold: 4000,
      },
    ],
  },

  // 2. Sowing
  {
    title: "Sowing",
    body: (
      <>
        Pick one of your pits. Scoop every seed and drop them one by one into the next pits going{" "}
        <b>anti-clockwise</b>. If you held 12+ seeds, you skip the source pit on the lap.
      </>
    ),
    frames: buildDemo(
      [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      1,
      [2, 3, 4],
      [],
    ),
  },

  // 3. Single capture
  {
    title: "Capture",
    body: (
      <>
        If your last seed lands in an <b>opponent pit</b> that now totals <b>2 or 3</b>, you take
        those seeds into your store.
      </>
    ),
    frames: buildDemo(
      [0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      2,
      [3, 4, 5, 6],
      [6],
    ),
  },

  // 4. Chain capture
  {
    title: "Chain capture",
    body: (
      <>
        After capturing, walk <b>backwards</b> through the opponent's row. Every adjacent pit also
        sitting at 2 or 3 is yours too. Stop at the first non-2/3 or at your own row.
      </>
    ),
    frames: buildDemo(
      [0, 0, 6, 0, 0, 0, 1, 2, 1, 0, 0, 0],
      2,
      [3, 4, 5, 6, 7, 8],
      [8, 7, 6],
    ),
  },

  // 5. Grand slam
  {
    title: "Grand slam",
    body: (
      <>
        If a capture would empty <b>every</b> opponent pit, the capture is <b>forfeited</b>. Sowing
        still happens, but nothing enters your store — the opponent must always have seeds to play.
      </>
    ),
    frames: buildDemo(
      [0, 0, 0, 0, 0, 2, 1, 1, 0, 0, 0, 0],
      5,
      [6, 7],
      [7, 6],
      true,
    ),
  },

  // 6. Must-feed
  {
    title: "Must feed",
    body: (
      <>
        If your opponent has <b>no seeds</b>, you must play a move that delivers at least one seed
        into their row. Moves that can't reach the opponent are illegal. If none of your moves can
        feed, the game ends.
      </>
    ),
    frames: [
      {
        pits: [1, 0, 0, 2, 0, 3, 0, 0, 0, 0, 0, 0],
        stores: { south: 0, north: 0 },
        illegal: [0, 3],
        legal: [5],
        hold: 4500,
      },
    ],
  },

  // 7. Winning
  {
    title: "Winning",
    body: (
      <>
        First player to capture <b>25 seeds</b> wins. <b>24–24</b> is a draw. If 100 plies pass
        without a capture, the game ends and each player keeps the seeds on their own side.
      </>
    ),
    frames: [
      {
        pits: [1, 0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 0],
        stores: { south: 25, north: 19 },
        hold: 4500,
      },
    ],
  },
];

function useFrameLoop(frames: Frame[]) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
    if (frames.length <= 1) return;
    let i = 0;
    let timer: number | null = null;
    const advance = () => {
      i = (i + 1) % frames.length;
      setIdx(i);
      timer = window.setTimeout(advance, frames[i].hold);
    };
    timer = window.setTimeout(advance, frames[0].hold);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [frames]);

  return frames[idx] ?? frames[0];
}

function MiniBoard({ frames }: { frames: Frame[] }) {
  const frame = useFrameLoop(frames);

  const PIT_R = 18;
  const GAP = 14;
  const ROW_W = 6 * (2 * PIT_R) + 5 * GAP;
  const STORE_W = 34;
  const STORE_GAP = 18; // horizontal gap between store and the nearest pit
  const SIDE = STORE_W + STORE_GAP;
  const STORE_H = 2 * PIT_R + 50;
  const W = ROW_W + 2 * SIDE;
  const H = 2 * (2 * PIT_R) + 44;

  const xFor = (col: number) => SIDE + col * (2 * PIT_R + GAP) + PIT_R;
  const topY = PIT_R + 6;
  const botY = topY + 2 * PIT_R + 28;

  const emphasize = new Set(frame.emphasize ?? []);
  const illegal = new Set(frame.illegal ?? []);
  const legal = new Set(frame.legal ?? []);
  const forfeit = new Set(frame.forfeit ?? []);

  function pitFill(abs: number) {
    if (emphasize.has(abs)) return "var(--pit-highlight-fill)";
    return "var(--pit-player-fill)";
  }
  function pitStroke(abs: number) {
    if (illegal.has(abs)) return "#dc2626";
    if (legal.has(abs)) return "#16a34a";
    if (forfeit.has(abs)) return "#dc2626";
    return BOTTOM_ROW_ABS.includes(abs)
      ? "var(--pit-player-stroke)"
      : "var(--pit-agent-stroke)";
  }
  function pitDash(abs: number): string | undefined {
    if (illegal.has(abs) || legal.has(abs) || forfeit.has(abs)) return "4 3";
    return undefined;
  }
  function pitStrokeWidth(abs: number) {
    if (illegal.has(abs) || legal.has(abs) || forfeit.has(abs)) return 2.25;
    return 1.25;
  }

  function renderPit(abs: number, cx: number, cy: number) {
    const struck = forfeit.has(abs);
    return (
      <g key={abs} transform={`translate(${cx} ${cy})`}>
        <circle
          r={PIT_R}
          fill={pitFill(abs)}
          stroke={pitStroke(abs)}
          strokeWidth={pitStrokeWidth(abs)}
          strokeDasharray={pitDash(abs)}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={12}
          fontFamily="ui-monospace, monospace"
          fill="var(--seed-color)"
          opacity={struck ? 0.45 : 1}
          textDecoration={struck ? "line-through" : undefined}
        >
          {frame.pits[abs] || ""}
        </text>
      </g>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      {/* North store (left) */}
      <g transform={`translate(0 ${(topY + botY) / 2 - STORE_H / 2})`}>
        <rect
          width={STORE_W}
          height={STORE_H}
          rx={10}
          fill="var(--store-agent-fill)"
          stroke="var(--store-agent-stroke)"
          strokeWidth={1.25}
        />
        <text
          x={STORE_W / 2}
          y={STORE_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fontWeight={600}
          fontFamily="ui-monospace, monospace"
          fill="var(--seed-color)"
        >
          {frame.stores.north}
        </text>
      </g>

      {/* North row */}
      {TOP_ROW_ABS.map((abs, col) => renderPit(abs, xFor(col), topY))}
      {/* South row */}
      {BOTTOM_ROW_ABS.map((abs, col) => renderPit(abs, xFor(col), botY))}

      {/* South store (right) */}
      <g
        transform={`translate(${SIDE + ROW_W + STORE_GAP} ${(topY + botY) / 2 - STORE_H / 2})`}
      >
        <rect
          width={STORE_W}
          height={STORE_H}
          rx={10}
          fill="var(--store-player-fill)"
          stroke="var(--store-player-stroke)"
          strokeWidth={1.25}
        />
        <text
          x={STORE_W / 2}
          y={STORE_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={13}
          fontWeight={600}
          fontFamily="ui-monospace, monospace"
          fill="var(--seed-color)"
        >
          {frame.stores.south}
        </text>
      </g>
    </svg>
  );
}

export function Tutorial({ onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How to play Oware"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-2xl dark:border-dark-line dark:bg-dark-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted dark:text-dark-muted">
              how to play · {String(stepIdx + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
            </div>
            <h2 className="font-mono text-lg text-ink dark:text-dark-ink">{step.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-ink hover:text-ink dark:border-dark-line dark:text-dark-muted dark:hover:border-dark-muted dark:hover:text-dark-ink"
          >
            skip
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-line p-4 dark:border-dark-line">
          <MiniBoard frames={step.frames} />
        </div>

        <p className="mb-5 min-h-[3.5rem] text-[13px] leading-relaxed text-ink dark:text-dark-ink">
          {step.body}
        </p>

        {/* Progress dots */}
        <div className="mb-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStepIdx(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx
                  ? "w-6 bg-ink dark:bg-dark-ink"
                  : "w-1.5 bg-line hover:bg-muted dark:bg-dark-line dark:hover:bg-dark-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0}
            className="rounded-lg border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted dark:border-dark-line dark:text-dark-muted dark:hover:border-dark-muted dark:hover:text-dark-ink"
          >
            ← back
          </button>
          {isLast ? (
            <button
              onClick={onClose}
              className="rounded-lg border border-ink bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:border-dark-ink dark:bg-dark-ink dark:text-dark-bg"
            >
              got it — let's play
            </button>
          ) : (
            <button
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              className="rounded-lg border border-ink bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-white transition-opacity hover:opacity-90 dark:border-dark-ink dark:bg-dark-ink dark:text-dark-bg"
            >
              next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
