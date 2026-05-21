import { useEffect, useRef, useState } from "react";
import type { GameState, Side } from "../lib/protocol";
import { thock, tick } from "../lib/audio";

export type Pace = "human" | "match";

interface Timing {
  hop: number;
  capture: number;
  settle: number;
  pluck: number;
  agentLead: number;
}

// Human vs AI: deliberate pacing so each agent move is readable.
// AI vs AI: original tight timing — the match page's own speed control handles cadence.
const TIMING: Record<Pace, Timing> = {
  human: { hop: 170, capture: 260, settle: 220, pluck: 120, agentLead: 380 },
  match: { hop: 110, capture: 180, settle: 120, pluck: 60, agentLead: 0 },
};

export interface AnimatedBoard {
  displayed: GameState | null;
  flyingPit: number | null;
  flyingTo: "store-south" | "store-north" | null;
  animating: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function sowPath(src: number, seeds: number): number[] {
  const path: number[] = [];
  let idx = src;
  while (path.length < seeds) {
    idx = (idx + 1) % 12;
    if (idx === src) continue;
    path.push(idx);
  }
  return path;
}

function absFromAction(action: number, by: Side): number {
  return by === "south" ? action : 6 + action;
}

export function useBoardAnimation(latest: GameState | null, pace: Pace = "human"): AnimatedBoard {
  const t = TIMING[pace];
  const [displayed, setDisplayed] = useState<GameState | null>(latest);
  const [flyingPit, setFlyingPit] = useState<number | null>(null);
  const [flyingTo, setFlyingTo] = useState<"store-south" | "store-north" | null>(null);
  const [animating, setAnimating] = useState(false);

  const queue = useRef<GameState[]>([]);
  const running = useRef(false);
  const current = useRef<GameState | null>(latest);
  const cancelled = useRef(false);

  useEffect(() => {
    if (latest === null) {
      cancelled.current = true;
      queue.current = [];
      running.current = false;
      current.current = null;
      setDisplayed(null);
      setFlyingPit(null);
      setFlyingTo(null);
      setAnimating(false);
      return;
    }
    if (current.current === null || current.current.game_id !== latest.game_id) {
      cancelled.current = true;
      queue.current = [];
      running.current = false;
      current.current = latest;
      setDisplayed(latest);
      setFlyingPit(null);
      setFlyingTo(null);
      setAnimating(false);
      return;
    }
    if (latest.ply <= current.current.ply) return;
    queue.current.push(latest);
    if (!running.current) {
      cancelled.current = false;
      void run();
    }
  }, [latest]);

  async function run() {
    running.current = true;
    setAnimating(true);
    while (queue.current.length > 0 && !cancelled.current) {
      const target = queue.current.shift()!;
      await animateOne(current.current!, target);
      if (cancelled.current) break;
      current.current = target;
    }
    running.current = false;
    setAnimating(false);
    setFlyingPit(null);
    setFlyingTo(null);
  }

  async function animateOne(from: GameState, to: GameState) {
    const lm = to.last_move;
    if (!lm) {
      setDisplayed(to);
      return;
    }
    const src = absFromAction(lm.pit, lm.by);
    const seeds = from.pits[src];
    const path = sowPath(src, seeds);

    // Give the agent's move a beat of lead-in so it doesn't trail the player instantly.
    if (lm.by === "north" && t.agentLead > 0) {
      await sleep(t.agentLead);
      if (cancelled.current) return;
    }

    const pits = [...from.pits];
    const stores = { ...from.stores };
    pits[src] = 0;
    setDisplayed({ ...from, pits: [...pits] });
    setFlyingPit(src);
    await sleep(t.pluck);
    if (cancelled.current) return;

    for (const dest of path) {
      setFlyingPit(dest);
      await sleep(t.hop);
      if (cancelled.current) return;
      pits[dest] += 1;
      setDisplayed({ ...from, pits: [...pits], stores: { ...stores } });
      tick();
    }
    setFlyingPit(null);
    await sleep(t.settle);
    if (cancelled.current) return;

    const captures: number[] = [];
    for (let i = 0; i < 12; i++) {
      if (pits[i] > 0 && to.pits[i] === 0) captures.push(i);
    }
    const moverStore: "store-south" | "store-north" =
      lm.by === "south" ? "store-south" : "store-north";

    for (const c of captures) {
      setFlyingTo(moverStore);
      setFlyingPit(c);
      const gained = pits[c];
      pits[c] = 0;
      if (lm.by === "south") stores.south += gained;
      else stores.north += gained;
      setDisplayed({ ...from, pits: [...pits], stores: { ...stores } });
      thock();
      await sleep(t.capture);
      if (cancelled.current) return;
    }
    setFlyingTo(null);
    setFlyingPit(null);
    setDisplayed(to);
  }

  return { displayed, flyingPit, flyingTo, animating };
}
