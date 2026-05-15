interface Props {
  count: number;
  size?: "pit" | "store";
  storeOffsetY?: number;
}

const PIT_LAYOUT: ReadonlyArray<readonly [number, number]> = [
  [0, -18],
  [-18, -6],
  [18, -6],
  [-12, 14],
  [12, 14],
  [0, 2],
  [-22, 10],
  [22, 10],
  [-16, -16],
  [16, -16],
  [0, 22],
  [0, -28],
];

const STORE_LAYOUT: ReadonlyArray<readonly [number, number]> = (() => {
  const pts: Array<[number, number]> = [];
  const rows = 3;
  const cols = 10;
  const dx = 11;
  const dy = 10;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offsetX = row === 1 ? dx / 2 : 0;
      pts.push([(col - (cols - 1) / 2) * dx + offsetX, (row - (rows - 1) / 2) * dy]);
    }
  }
  return pts;
})();

const PIT_COUNT_THRESHOLD = 7;

export function Seeds({ count, size = "pit", storeOffsetY = 0 }: Props) {
  if (count <= 0) return null;
  const yShift = size === "store" ? storeOffsetY : 0;

  const layout = size === "pit" ? PIT_LAYOUT : STORE_LAYOUT;
  const dotR = size === "pit" ? 6 : 3.2;
  const visible = Math.min(count, layout.length);
  const showPitNumber = size === "pit" && count >= PIT_COUNT_THRESHOLD;

  return (
    <g transform={`translate(0 ${yShift})`}>
      {Array.from({ length: visible }, (_, i) => {
        const [dx, dy] = layout[i];
        return <circle key={i} cx={dx} cy={dy} r={dotR} fill="var(--seed-color)" />;
      })}
      {showPitNumber && (
        <text
          x={0}
          y={44}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--seed-color)"
          className="font-mono font-bold text-[20px]"
        >
          {count}
        </text>
      )}
      {size === "store" && count > layout.length && (
        <text
          x={layout[layout.length - 1][0] + 16}
          y={4}
          textAnchor="start"
          fill="var(--seed-color)"
          className="font-mono text-[10px]"
        >
          {`+${count - layout.length}`}
        </text>
      )}
    </g>
  );
}
