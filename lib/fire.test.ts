import assert from "node:assert/strict";
import test from "node:test";
import { buildFirePlan } from "./fire.ts";
import type { FireContext, FireInputs } from "./types.ts";

function inputs(patch: Partial<FireInputs> = {}): FireInputs {
  return {
    currentAge: 30,
    targetAge: 35,
    coastRetirementAge: 65,
    housing: 1_000,
    food: 500,
    utilities: 200,
    transport: 300,
    healthcare: 400,
    other: 100,
    taxBuffer: 100,
    regularExtra: 400,
    fatExtra: 500,
    withdrawalRate: 4,
    realReturn: 5,
    partTimeHourly: 20,
    partTimeHours: 20,
    partTimeWeeks: 50,
    emergencyMonths: 6,
    emergencyCash: 10_000,
    includeHsa: true,
    reserveDebt: true,
    ...patch,
  };
}

function context(patch: Partial<FireContext> = {}): FireContext {
  return {
    startingPortfolio: 100_000,
    annualInvestment: 20_000,
    additionalByYear: {},
    startYear: 2026,
    partTimeAnnualNet: 12_000,
    ...patch,
  };
}

function target(
  result: ReturnType<typeof buildFirePlan>,
  id: "lean" | "fire" | "fat" | "coast" | "barista",
) {
  const found = result.targets.find((item) => item.id === id);
  assert.ok(found);
  return found;
}

function close(actual: number, expected: number, tolerance = 1e-8): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `expected ${actual} to be close to ${expected}`,
  );
}

test("builds all spending targets in real dollars", () => {
  const result = buildFirePlan(inputs(), context());

  assert.equal(result.leanMonthly, 2_600);
  assert.equal(result.regularMonthly, 3_000);
  assert.equal(result.fatMonthly, 3_500);
  assert.equal(target(result, "lean").annualSpending, 31_200);
  assert.equal(target(result, "lean").requiredPortfolio, 780_000);
  assert.equal(target(result, "fire").annualSpending, 36_000);
  assert.equal(target(result, "fire").requiredPortfolio, 900_000);
  assert.equal(target(result, "fat").annualSpending, 42_000);
  assert.equal(target(result, "fat").requiredPortfolio, 1_050_000);
  assert.equal(target(result, "barista").annualSpending, 24_000);
  assert.equal(target(result, "barista").requiredPortfolio, 600_000);
  close(target(result, "coast").requiredPortfolio, 900_000 / 1.05 ** 35);
  assert.match(target(result, "lean").description, /essentials/);
  assert.match(target(result, "fire").description, /lifestyle and flexibility/);
  assert.match(target(result, "fat").description, /additional spending/);
});

test("projects t0 through age 100 with end-of-year contributions", () => {
  const result = buildFirePlan(
    inputs({ currentAge: 28, targetAge: 30, realReturn: 10 }),
    context({
      startingPortfolio: 100,
      annualInvestment: 10,
      additionalByYear: { "2027": 50 },
      startYear: 2026,
    }),
  );

  assert.equal(result.points[0].age, 28);
  assert.equal(result.points[0].year, 2026);
  assert.equal(result.points[0].portfolio, 100);
  assert.equal(result.points[0].contribution, 0);
  assert.equal(result.points[1].age, 29);
  assert.equal(result.points[1].year, 2027);
  assert.equal(result.points[1].portfolio, 170);
  assert.equal(result.points[1].contribution, 60);
  assert.equal(result.points[2].age, 30);
  assert.equal(result.points[2].year, 2028);
  close(result.points[2].portfolio, 197);
  assert.equal(result.points[2].contribution, 10);
  assert.equal(result.points.at(-1)?.age, 100);
  assert.equal(result.points.length, 73);
});

test("does not repeat finite dated awards", () => {
  const result = buildFirePlan(
    inputs({ realReturn: 0 }),
    context({
      startingPortfolio: 0,
      annualInvestment: 0,
      additionalByYear: { "2027": 100 },
    }),
  );

  assert.equal(result.points[1].portfolio, 100);
  assert.equal(result.points[1].contribution, 100);
  assert.equal(result.points[2].portfolio, 100);
  assert.equal(result.points[2].contribution, 0);
  assert.equal(result.points[10].portfolio, 100);
});

test("uses a changing CoastFIRE threshold and detects achieved status", () => {
  const base = buildFirePlan(inputs(), context({ startingPortfolio: 0 }));
  const coastNow = base.coastRequiredNow;
  const achieved = buildFirePlan(
    inputs(),
    context({ startingPortfolio: coastNow, annualInvestment: 0 }),
  );

  assert.equal(target(achieved, "coast").firstAge, 30);
  close(achieved.points[0].coastThreshold, coastNow);
  assert.equal(
    achieved.points.find((point) => point.age === 65)?.coastThreshold,
    target(achieved, "fire").requiredPortfolio,
  );
  assert.equal(
    achieved.points.find((point) => point.age === 80)?.coastThreshold,
    target(achieved, "fire").requiredPortfolio,
  );

  const unachieved = buildFirePlan(
    inputs(),
    context({ startingPortfolio: 0, annualInvestment: 0 }),
  );
  assert.equal(target(unachieved, "coast").firstAge, null);
});

test("BaristaFIRE uses supplied annual net income as an ongoing offset", () => {
  const result = buildFirePlan(
    inputs(),
    context({ partTimeAnnualNet: 40_000 }),
  );
  const barista = target(result, "barista");

  assert.equal(barista.annualSpending, 0);
  assert.equal(barista.requiredPortfolio, 0);
  assert.equal(barista.firstAge, 30);
  assert.match(barista.description, /ongoing part-time net income/);
  assert.match(barista.description, /not full financial independence/);
  assert.match(barista.description, /not an income-until-65 model/);
});

test("zero spending produces finite zero targets", () => {
  const zero = inputs({
    housing: 0,
    food: 0,
    utilities: 0,
    transport: 0,
    healthcare: 0,
    other: 0,
    taxBuffer: 0,
    regularExtra: 0,
    fatExtra: 0,
  });
  const result = buildFirePlan(
    zero,
    context({
      startingPortfolio: 0,
      annualInvestment: 0,
      partTimeAnnualNet: 0,
    }),
  );

  for (const item of result.targets) {
    assert.equal(item.annualSpending, 0);
    assert.equal(item.requiredPortfolio, 0);
    assert.equal(item.progress, 1);
    assert.equal(item.firstAge, 30);
  }
  assert.equal(result.coastRequiredNow, 0);
});

test("supports zero and negative real returns", () => {
  const zero = buildFirePlan(
    inputs({ realReturn: 0 }),
    context({
      startingPortfolio: 100,
      annualInvestment: 20,
      additionalByYear: { "2027": 10 },
    }),
  );
  assert.equal(zero.points[1].portfolio, 130);
  assert.equal(zero.points[2].portfolio, 150);

  const negative = buildFirePlan(
    inputs({ realReturn: -50 }),
    context({ startingPortfolio: 100, annualInvestment: 0 }),
  );
  assert.equal(negative.points[1].portfolio, 50);
  assert.equal(negative.points[2].portfolio, 25);
  assert.ok(
    negative.coastRequiredNow > target(negative, "fire").requiredPortfolio,
  );
});

test("reports already achieved and unreachable static targets", () => {
  const achieved = buildFirePlan(
    inputs(),
    context({ startingPortfolio: 2_000_000, annualInvestment: 0 }),
  );
  for (const id of ["lean", "fire", "fat", "barista"] as const) {
    assert.equal(target(achieved, id).firstAge, 30);
  }

  const unreachable = buildFirePlan(
    inputs({ realReturn: 0 }),
    context({ startingPortfolio: 0, annualInvestment: 0 }),
  );
  for (const id of ["lean", "fire", "fat", "barista"] as const) {
    assert.equal(target(unreachable, id).firstAge, null);
  }
});

test("milestones are unique, sorted, and match projected accumulation", () => {
  const result = buildFirePlan(
    inputs({ currentAge: 27, targetAge: 30, realReturn: 5 }),
    context({
      startingPortfolio: 10_000,
      annualInvestment: 12_000,
      additionalByYear: { "2028": 5_000, "2030": 7_000 },
    }),
  );

  assert.deepEqual(
    result.milestones.map((item) => item.age),
    [28, 30, 35],
  );
  for (const milestone of result.milestones) {
    assert.equal(
      milestone.portfolio,
      result.points.find((point) => point.age === milestone.age)?.portfolio,
    );
  }

  const age30 = result.milestones.find((item) => item.age === 30);
  assert.ok(age30);
  const fireTarget = target(result, "fire").requiredPortfolio;
  let rebuilt = 10_000;
  for (let year = 2027; year <= 2029; year += 1) {
    rebuilt =
      rebuilt * 1.05 +
      (age30.requiredAnnualInvestment ?? 0) +
      ({ 2028: 5_000, 2030: 7_000 }[year as 2028 | 2030] ?? 0);
  }
  close(rebuilt, fireTarget);
});

test("current-age milestones return zero if funded and null if there is a gap", () => {
  const funded = buildFirePlan(
    inputs({ currentAge: 35, targetAge: 35 }),
    context({ startingPortfolio: 1_000_000 }),
  );
  assert.equal(funded.milestones[0].age, 35);
  assert.equal(funded.milestones[0].requiredAnnualInvestment, 0);

  const gap = buildFirePlan(
    inputs({ currentAge: 35, targetAge: 35 }),
    context({ startingPortfolio: 0, annualInvestment: 0 }),
  );
  assert.equal(gap.milestones[0].requiredAnnualInvestment, null);
});

test("zero-return required investment accounts for each award once", () => {
  const result = buildFirePlan(
    inputs({
      currentAge: 28,
      targetAge: 30,
      realReturn: 0,
      housing: 100,
      food: 0,
      utilities: 0,
      transport: 0,
      healthcare: 0,
      other: 0,
      taxBuffer: 0,
      regularExtra: 0,
      fatExtra: 0,
      withdrawalRate: 10,
    }),
    context({
      startingPortfolio: 100,
      annualInvestment: 0,
      additionalByYear: { "2027": 100, "2028": 200 },
      partTimeAnnualNet: 0,
    }),
  );
  const age30 = result.milestones.find((item) => item.age === 30);

  assert.ok(age30);
  assert.equal(target(result, "fire").requiredPortfolio, 12_000);
  assert.equal(age30.requiredAnnualInvestment, (12_000 - 100 - 300) / 2);
});

test("validates malformed and out-of-range inputs explicitly", () => {
  assert.throws(
    () => buildFirePlan(inputs({ housing: Number.NaN }), context()),
    /inputs\.housing must be a finite number/,
  );
  assert.throws(
    () => buildFirePlan(inputs({ withdrawalRate: 0 }), context()),
    /withdrawalRate must be greater than zero/,
  );
  assert.throws(
    () => buildFirePlan(inputs({ realReturn: -100 }), context()),
    /realReturn must be greater than -100/,
  );
  assert.throws(
    () => buildFirePlan(inputs({ currentAge: 101 }), context()),
    /currentAge/,
  );
  assert.throws(
    () => buildFirePlan(inputs({ targetAge: 29 }), context()),
    /targetAge cannot be less/,
  );
  assert.throws(
    () => buildFirePlan(inputs({ coastRetirementAge: 29 }), context()),
    /coastRetirementAge cannot be less/,
  );
  assert.throws(
    () =>
      buildFirePlan(
        inputs(),
        context({ annualInvestment: Number.POSITIVE_INFINITY }),
      ),
    /annualInvestment must be a finite number/,
  );
  assert.throws(
    () => buildFirePlan(inputs(), context({ additionalByYear: { soon: 100 } })),
    /must be an integer year/,
  );
  assert.throws(
    () =>
      buildFirePlan(
        inputs(),
        context({ additionalByYear: { "2027": Number.NaN } }),
      ),
    /must be a finite number/,
  );
});

test("returns no infinite displayed values", () => {
  const result = buildFirePlan(inputs(), context());
  const numbers = [
    result.leanMonthly,
    result.regularMonthly,
    result.fatMonthly,
    result.annualInvestment,
    result.partTimeAnnualNet,
    result.coastRequiredNow,
    ...result.targets.flatMap((item) => [
      item.annualSpending,
      item.requiredPortfolio,
      item.progress,
    ]),
    ...result.points.flatMap((point) => [
      point.age,
      point.year,
      point.portfolio,
      point.contribution,
      point.coastThreshold,
    ]),
    ...result.milestones.flatMap((item) => [
      item.age,
      item.portfolio,
      item.gapToFire,
      ...(item.requiredAnnualInvestment === null
        ? []
        : [item.requiredAnnualInvestment]),
    ]),
  ];
  assert.ok(numbers.every(Number.isFinite));
  assert.match(result.warnings[0], /not a guarantee or Monte Carlo/);
  assert.match(result.warnings[1], /today's dollars/);
});
