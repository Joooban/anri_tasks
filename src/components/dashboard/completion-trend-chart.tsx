import type { CompletionTrendPoint } from "@/lib/dashboard-queries";

// Plain SVG bar chart — no charting library in this project yet, and one
// chart on one page doesn't justify adding a dependency.
export function CompletionTrendChart({ points }: { points: CompletionTrendPoint[] }) {
  const width = 640;
  const height = 160;
  const paddingBottom = 20;
  const gap = 4;
  const barWidth = points.length ? width / points.length - gap : 0;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full min-w-[480px]" role="img" aria-label="Completion rate trend">
        {points.map((p, i) => {
          const barHeight = (p.percent / 100) * (height - paddingBottom);
          const x = i * (barWidth + gap);
          const y = height - paddingBottom - barHeight;
          return (
            <g key={i}>
              <rect x={x} y={y} width={Math.max(barWidth, 1)} height={barHeight} rx={2} className="fill-zinc-900 dark:fill-zinc-100" />
              {p.total > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-zinc-600 text-[9px] dark:fill-zinc-300"
                >
                  {p.percent}%
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height - paddingBottom + 12}
                textAnchor="middle"
                className="fill-zinc-500 text-[9px] dark:fill-zinc-400"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
