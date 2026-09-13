"use client";

import { Field, Input, Slider } from "@fluentui/react-components";
import { useId, useState } from "react";
import { money } from "@/lib/format";

interface NumberControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
  slider?: boolean;
}
export function NumberControl({
  label,
  value,
  onChange,
  min = 0,
  max = 1000000,
  step = 100,
  suffix = "$",
  hint,
  slider = false,
}: NumberControlProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div className={slider ? "contribution-control" : "number-control"}>
      <Field
        label={{ children: label, htmlFor: id }}
        hint={hint}
        validationMessage={error}
        validationState={error ? "error" : "none"}
      >
        <Input
          id={id}
          type="number"
          value={draft ?? String(value)}
          min={min}
          max={max}
          step={step}
          contentAfter={suffix}
          onChange={(_, data) => {
            setDraft(data.value);
            const next = Number(data.value);
            if (
              data.value !== "" &&
              Number.isFinite(next) &&
              next >= min &&
              next <= max
            ) {
              setError("");
              onChange(next);
            }
          }}
          onBlur={() => {
            if (draft !== null) {
              const next = Number(draft);
              if (
                draft === "" ||
                !Number.isFinite(next) ||
                next < min ||
                next > max
              ) {
                setError(
                  `Enter ${min} to ${max}. The previous value was kept.`,
                );
              }
            }
            setDraft(null);
          }}
        />
      </Field>
      {slider && (
        <>
          <Slider
            aria-label={`${label} slider`}
            aria-valuetext={
              suffix === "$" ? `${money(value)} annually` : `${value} ${suffix}`
            }
            min={min}
            max={Math.max(min, max)}
            step={step}
            value={value}
            disabled={max <= min}
            onChange={(_, data) => {
              setDraft(null);
              setError("");
              onChange(data.value);
            }}
          />
          <div className="range-labels">
            <span>
              {min}
              {suffix === "%" ? "%" : ""}
            </span>
            <span>{suffix === "$" ? money(max) : `${max}${suffix}`}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = "",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "" | "accent" | "danger";
}) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
