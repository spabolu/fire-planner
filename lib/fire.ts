import type { FireContext, FireInputs } from "./types.ts";

export type FireTargetId = "lean" | "fire" | "fat" | "coast" | "barista";

export interface FireTarget {
  id: FireTargetId;
  name: string;
  annualSpending: number;
  requiredPortfolio: number;
  progress: number;
  firstAge: number | null;
  description: string;
}

export interface FirePoint {
  age: number;
  year: number;
  portfolio: number;
  contribution: number;
  coastThreshold: number;
}

export interface FireMilestone {
  age: number;
  portfolio: number;
  gapToFire: number;
  requiredAnnualInvestment: number | null;
}

export interface FirePlan {
  targets: FireTarget[];
  points: FirePoint[];
  leanMonthly: number;
  regularMonthly: number;
  fatMonthly: number;
  annualInvestment: number;
  partTimeAnnualNet: number;
  coastRequiredNow: number;
  milestones: FireMilestone[];
  warnings: string[];
}

const inputNumberKeys = [
  "currentAge",
  "targetAge",
  "coastRetirementAge",
  "housing",
  "food",
  "utilities",
  "transport",
  "healthcare",
  "other",
  "taxBuffer",
  "regularExtra",
  "fatExtra",
  "withdrawalRate",
  "realReturn",
  "partTimeHourly",
  "partTimeHours",
  "partTimeWeeks",
  "emergencyMonths",
  "emergencyCash",
] as const satisfies readonly (keyof FireInputs)[];

const nonnegativeInputKeys = [
  "housing",
  "food",
  "utilities",
  "transport",
  "healthcare",
  "other",
  "taxBuffer",
  "regularExtra",
  "fatExtra",
  "partTimeHourly",
  "partTimeHours",
  "partTimeWeeks",
  "emergencyMonths",
  "emergencyCash",
] as const satisfies readonly (keyof FireInputs)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireFiniteNumber(
  object: Record<string, unknown>,
  key: string,
  owner: string,
): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${owner}.${key} must be a finite number`);
  }
  return value;
}

function requireIntegerAge(
  value: number,
  key: "currentAge" | "targetAge" | "coastRetirementAge",
): void {
  if (!Number.isInteger(value) || value < 18 || value > 100) {
    throw new RangeError(
      `inputs.${key} must be an integer from 18 through 100`,
    );
  }
}

function validateInputs(inputs: FireInputs, context: FireContext): void {
  if (!isRecord(inputs)) {
    throw new TypeError("inputs must be an object");
  }
  if (!isRecord(context)) {
    throw new TypeError("context must be an object");
  }

  for (const key of inputNumberKeys) {
    requireFiniteNumber(inputs, key, "inputs");
  }
  for (const key of nonnegativeInputKeys) {
    if (inputs[key] < 0) {
      throw new RangeError(`inputs.${key} must be nonnegative`);
    }
  }
  if (
    typeof inputs.includeHsa !== "boolean" ||
    typeof inputs.reserveDebt !== "boolean"
  ) {
    throw new TypeError(
      "inputs.includeHsa and inputs.reserveDebt must be boolean",
    );
  }

  requireIntegerAge(inputs.currentAge, "currentAge");
  requireIntegerAge(inputs.targetAge, "targetAge");
  requireIntegerAge(inputs.coastRetirementAge, "coastRetirementAge");
  if (inputs.targetAge < inputs.currentAge) {
    throw new RangeError(
      "inputs.targetAge cannot be less than inputs.currentAge",
    );
  }
  if (inputs.coastRetirementAge < inputs.currentAge) {
    throw new RangeError(
      "inputs.coastRetirementAge cannot be less than inputs.currentAge",
    );
  }
  if (inputs.withdrawalRate <= 0) {
    throw new RangeError("inputs.withdrawalRate must be greater than zero");
  }
  if (inputs.realReturn <= -100) {
    throw new RangeError("inputs.realReturn must be greater than -100");
  }

  requireFiniteNumber(context, "startingPortfolio", "context");
  requireFiniteNumber(context, "annualInvestment", "context");
  requireFiniteNumber(context, "startYear", "context");
  requireFiniteNumber(context, "partTimeAnnualNet", "context");
  if (!Number.isSafeInteger(context.startYear)) {
    throw new RangeError("context.startYear must be a safe integer");
  }
  if (context.annualInvestment < 0) {
    throw new RangeError("context.annualInvestment must be nonnegative");
  }
  if (context.partTimeAnnualNet < 0) {
    throw new RangeError("context.partTimeAnnualNet must be nonnegative");
  }
  if (!isRecord(context.additionalByYear)) {
    throw new TypeError("context.additionalByYear must be an object");
  }
  for (const [yearText, amount] of Object.entries(context.additionalByYear)) {
    if (!/^-?\d+$/.test(yearText) || !Number.isSafeInteger(Number(yearText))) {
      throw new TypeError(
        `context.additionalByYear key "${yearText}" must be an integer year`,
      );
    }
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      throw new TypeError(
        `context.additionalByYear["${yearText}"] must be a finite number`,
      );
    }
    if (amount < 0) {
      throw new RangeError(
        `context.additionalByYear["${yearText}"] must be nonnegative`,
      );
    }
  }
}

function finiteResult(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} exceeds the finite numeric range`);
  }
  return value;
}

function requiredPortfolio(
  annualSpending: number,
  withdrawalRate: number,
): number {
  return finiteResult(
    (annualSpending * 100) / withdrawalRate,
    "Required portfolio",
  );
}

function coastThreshold(
  fireTarget: number,
  age: number,
  retirementAge: number,
  growthFactor: number,
): number {
  if (age >= retirementAge || fireTarget === 0) return fireTarget;
  return finiteResult(
    fireTarget / growthFactor ** (retirementAge - age),
    "CoastFIRE threshold",
  );
}

function progress(portfolio: number, target: number): number {
  if (target === 0) return portfolio >= 0 ? 1 : 0;
  return finiteResult(Math.max(0, portfolio / target), "Target progress");
}

function firstReachedAge(
  points: FirePoint[],
  required: number | ((point: FirePoint) => number),
): number | null {
  const match = points.find((point) => {
    const threshold = typeof required === "number" ? required : required(point);
    return point.portfolio >= threshold;
  });
  return match?.age ?? null;
}

function requiredRecurringInvestment(
  startingPortfolio: number,
  target: number,
  years: number,
  startYear: number,
  additionalByYear: Record<string, number>,
  growthFactor: number,
  realReturn: number,
): number | null {
  if (years === 0) return startingPortfolio >= target ? 0 : null;

  if (realReturn === 0) {
    let additions = 0;
    for (let step = 1; step <= years; step += 1) {
      additions += additionalByYear[String(startYear + step)] ?? 0;
    }
    const required = (target - startingPortfolio - additions) / years;
    return finiteResult(Math.max(0, required), "Required annual investment");
  }

  let baseFutureValue = startingPortfolio;
  let recurringFutureValueFactor = 0;
  for (let step = 1; step <= years; step += 1) {
    baseFutureValue = finiteResult(
      baseFutureValue * growthFactor +
        (additionalByYear[String(startYear + step)] ?? 0),
      "Milestone base portfolio",
    );
    recurringFutureValueFactor = finiteResult(
      recurringFutureValueFactor * growthFactor + 1,
      "Recurring contribution factor",
    );
  }
  if (recurringFutureValueFactor <= 0) return null;
  return finiteResult(
    Math.max(0, (target - baseFutureValue) / recurringFutureValueFactor),
    "Required annual investment",
  );
}

export function buildFirePlan(
  inputs: FireInputs,
  context: FireContext,
): FirePlan {
  validateInputs(inputs, context);

  const leanMonthly = finiteResult(
    inputs.housing +
      inputs.food +
      inputs.utilities +
      inputs.transport +
      inputs.healthcare +
      inputs.other +
      inputs.taxBuffer,
    "Lean monthly spending",
  );
  const regularMonthly = finiteResult(
    leanMonthly + inputs.regularExtra,
    "Regular monthly spending",
  );
  const fatMonthly = finiteResult(
    regularMonthly + inputs.fatExtra,
    "Fat monthly spending",
  );
  const leanAnnual = finiteResult(leanMonthly * 12, "Lean annual spending");
  const regularAnnual = finiteResult(
    regularMonthly * 12,
    "Regular annual spending",
  );
  const fatAnnual = finiteResult(fatMonthly * 12, "Fat annual spending");
  const baristaAnnual = finiteResult(
    Math.max(0, regularAnnual - context.partTimeAnnualNet),
    "Barista annual spending",
  );
  const leanTarget = requiredPortfolio(leanAnnual, inputs.withdrawalRate);
  const fireTarget = requiredPortfolio(regularAnnual, inputs.withdrawalRate);
  const fatTarget = requiredPortfolio(fatAnnual, inputs.withdrawalRate);
  const baristaTarget = requiredPortfolio(baristaAnnual, inputs.withdrawalRate);
  const growthFactor = finiteResult(
    1 + inputs.realReturn / 100,
    "Real growth factor",
  );

  const points: FirePoint[] = [];
  let portfolio = context.startingPortfolio;
  for (let age = inputs.currentAge; age <= 100; age += 1) {
    const elapsedYears = age - inputs.currentAge;
    const year = context.startYear + elapsedYears;
    const contribution =
      elapsedYears === 0
        ? 0
        : finiteResult(
            context.annualInvestment +
              (context.additionalByYear[String(year)] ?? 0),
            "Annual contribution",
          );
    if (elapsedYears > 0) {
      portfolio = finiteResult(
        portfolio * growthFactor + contribution,
        "Projected portfolio",
      );
    }
    points.push({
      age,
      year,
      portfolio,
      contribution,
      coastThreshold: coastThreshold(
        fireTarget,
        age,
        inputs.coastRetirementAge,
        growthFactor,
      ),
    });
  }

  const coastRequiredNow = points[0].coastThreshold;
  const targetDefinitions: Omit<FireTarget, "progress" | "firstAge">[] = [
    {
      id: "lean",
      name: "LeanFIRE",
      annualSpending: leanAnnual,
      requiredPortfolio: leanTarget,
      description:
        "Covers your essentials, including healthcare and a retirement-tax allowance, without the extra lifestyle budget.",
    },
    {
      id: "fire",
      name: "FIRE",
      annualSpending: regularAnnual,
      requiredPortfolio: fireTarget,
      description:
        "Covers essentials plus your regular lifestyle and flexibility budget, without relying on employment income.",
    },
    {
      id: "fat",
      name: "FatFIRE",
      annualSpending: fatAnnual,
      requiredPortfolio: fatTarget,
      description:
        "Covers the regular lifestyle budget plus the additional spending you selected for more flexibility.",
    },
    {
      id: "coast",
      name: "CoastFIRE",
      annualSpending: regularAnnual,
      requiredPortfolio: coastRequiredNow,
      description: `CoastFIRE is the portfolio needed now to reach the Regular FIRE target at age ${inputs.coastRetirementAge} using real growth alone, with no further contributions.`,
    },
    {
      id: "barista",
      name: "BaristaFIRE",
      annualSpending: baristaAnnual,
      requiredPortfolio: baristaTarget,
      description:
        "BaristaFIRE assumes ongoing part-time net income; it is not full financial independence and is not an income-until-65 model.",
    },
  ];
  const targets = targetDefinitions.map(
    (target): FireTarget => ({
      ...target,
      progress: progress(context.startingPortfolio, target.requiredPortfolio),
      firstAge:
        target.id === "coast"
          ? firstReachedAge(points, (point) => point.coastThreshold)
          : firstReachedAge(points, target.requiredPortfolio),
    }),
  );

  const pointByAge = new Map(points.map((point) => [point.age, point]));
  const milestoneAges = [...new Set([28, 30, 35, inputs.targetAge])]
    .filter((age) => age >= inputs.currentAge && age <= 100)
    .sort((left, right) => left - right);
  const milestones = milestoneAges.map((age): FireMilestone => {
    const point = pointByAge.get(age);
    if (!point) {
      throw new RangeError(`Projection point for age ${age} is unavailable`);
    }
    return {
      age,
      portfolio: point.portfolio,
      gapToFire: finiteResult(
        Math.max(0, fireTarget - point.portfolio),
        "FIRE gap",
      ),
      requiredAnnualInvestment: requiredRecurringInvestment(
        context.startingPortfolio,
        fireTarget,
        age - inputs.currentAge,
        context.startYear,
        context.additionalByYear,
        growthFactor,
        inputs.realReturn,
      ),
    };
  });

  const projectionEndYear = context.startYear + (100 - inputs.currentAge);
  const ignoredPast = Object.keys(context.additionalByYear).some(
    (year) => Number(year) <= context.startYear,
  );
  const ignoredFuture = Object.keys(context.additionalByYear).some(
    (year) => Number(year) > projectionEndYear,
  );
  const warnings = [
    "Projection is deterministic and uses a constant annual real return; it is not a guarantee or Monte Carlo simulation.",
    "All targets, contributions, and portfolio values are expressed in today's dollars.",
  ];
  if (ignoredPast) {
    warnings.push(
      "Additional contributions dated at or before the start year are excluded because the starting portfolio is the t0 balance.",
    );
  }
  if (ignoredFuture) {
    warnings.push(
      "Additional contributions after age 100 are outside the projection horizon.",
    );
  }

  return {
    targets,
    points,
    leanMonthly,
    regularMonthly,
    fatMonthly,
    annualInvestment: context.annualInvestment,
    partTimeAnnualNet: context.partTimeAnnualNet,
    coastRequiredNow,
    milestones,
    warnings,
  };
}
