"use client";

import { Select } from "@fluentui/react-components";
import { useId, useState } from "react";
import { compactMoney, money } from "@/lib/format";

interface Allocation {
  label: string;
  value: number;
  color: string;
}
export function AllocationChart({
  allocations,
}: {
  allocations: Allocation[];
}) {
  const total = allocations.reduce(
    (sum, item) => sum + Math.max(0, item.value),
    0,
  );
  return (
    <div>
      <div
        className="allocation-bar"
        role="img"
        aria-label={allocations
          .map((item) => `${item.label}: ${money(item.value)}`)
          .join(". ")}
      >
        {allocations
          .filter((item) => item.value > 0)
          .map((item) => (
            <div
              key={item.label}
              style={{
                width: `${total ? (item.value / total) * 100 : 0}%`,
                background: item.color,
              }}
              title={`${item.label}: ${money(item.value)}`}
            />
          ))}
      </div>
      <div className="allocation-legend">
        {allocations.map((item) => (
          <div key={item.label}>
            <span className="swatch" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{money(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChartPoint {
  age: number;
  portfolio: number;
  contribution: number;
}
export function ProjectionChart({
  points,
  target,
  targetAge,
}: {
  points: ChartPoint[];
  target: number;
  targetAge: number;
}) {
  const id = useId();
  const [horizon, setHorizon] = useState(65);
  const [selectedAge, setSelectedAge] = useState(targetAge);
  const end = Math.max(points[0]?.age ?? 18, horizon);
  const visible = points.filter((point) => point.age <= end);
  const selected =
    points.find((point) => point.age === selectedAge) ?? visible.at(-1);
  const first = visible[0];
  if (!first) return <p>No projection points available.</p>;
  const max = Math.max(
    target * 1.15,
    ...visible.map((point) => point.portfolio),
    1,
  );
  const x = (age: number) =>
    74 + ((age - first.age) / Math.max(1, end - first.age)) * 688;
  const y = (value: number) => 230 - (value / max) * 195;
  const polyline = visible
    .map((point) => `${x(point.age)},${y(point.portfolio)}`)
    .join(" ");
  return (
    <div>
      <div className="chart-toolbar">
        <label htmlFor={`${id}-horizon`}>Chart through age</label>
        <Select
          id={`${id}-horizon`}
          value={String(horizon)}
          onChange={(_, data) => setHorizon(Number(data.value))}
        >
          {[40, 50, 65, 80, 100].map((age) => (
            <option key={age} value={age}>
              {age}
            </option>
          ))}
        </Select>
        <label htmlFor={`${id}-age`}>Inspect age</label>
        <Select
          id={`${id}-age`}
          value={String(selected?.age)}
          onChange={(_, data) => setSelectedAge(Number(data.value))}
        >
          {points.map((point) => (
            <option key={point.age} value={point.age}>
              {point.age}
            </option>
          ))}
        </Select>
      </div>
      <svg
        className="projection-chart"
        viewBox="0 0 800 270"
        role="img"
        aria-labelledby={`${id}-title`}
      >
        <title id={`${id}-title`}>
          Investment accumulation in today&apos;s dollars, compared with the
          regular FIRE target
        </title>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="74"
              x2="762"
              y1={y(max * fraction)}
              y2={y(max * fraction)}
              stroke="#e7e9ec"
            />
            <text x="64" y={y(max * fraction) + 4} textAnchor="end">
              {compactMoney(max * fraction)}
            </text>
          </g>
        ))}
        <line
          x1="74"
          x2="762"
          y1={y(target)}
          y2={y(target)}
          stroke="#a76818"
          strokeDasharray="6 5"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke="#0f6cbd"
          strokeWidth="3"
        />
        {visible
          .filter((point) => point.age % 5 === 0 || point.age === first.age)
          .map((point) => (
            <g key={point.age}>
              <text x={x(point.age)} y="254" textAnchor="middle">
                {point.age}
              </text>
            </g>
          ))}
        {selected && selected.age <= end && (
          <circle
            cx={x(selected.age)}
            cy={y(selected.portfolio)}
            r="5"
            fill="#0f6cbd"
            stroke="white"
            strokeWidth="2"
          />
        )}
      </svg>
      <div className="chart-caption">
        <span>
          <i style={{ background: "#0f6cbd" }} />
          Projected investments
        </span>
        <span>
          <i style={{ background: "#a76818" }} />
          Regular FIRE: {money(target)}
        </span>
        {selected && (
          <strong>
            Age {selected.age}: {money(selected.portfolio)}
          </strong>
        )}
      </div>
      <p className="muted">
        Accumulation while continuing this contribution plan, not a
        retirement-withdrawal simulation. Returns are constant real assumptions;
        actual outcomes will vary.
      </p>
    </div>
  );
}
