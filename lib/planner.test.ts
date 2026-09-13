import assert from "node:assert/strict";
import test from "node:test";
import {
  annualVest,
  bounds,
  calculate,
  federalTax,
  normalize,
  PROJECTED_2027,
  REFERENCE,
  taxes,
} from "./planner.ts";
import type { Award, PlannerInputs } from "./types.ts";

const AWARD: Award = {
  approvalPrice: 50,
  impliedShares: 400,
  vestDates: ["2027-02-15", "2028-02-15", "2028-08-15", "2029-02-15"],
};

function inputs(overrides: Partial<PlannerInputs> = {}): PlannerInputs {
  return {
    year: 2027,
    salary: 100_000,
    bonusPercent: 10,
    rsuPrice: 50,
    regular: 20_000,
    rothPercent: 0,
    hsa: 3_000,
    ira: 7_000,
    afterTax: 5_000,
    esppPercent: 10,
    esppSellPercent: 0,
    brokerage: 4_000,
    reserve: 2_000,
    living: 3_000,
    otherPayroll: 600,
    preTaxBenefits: 1_200,
    taxableBenefits: 500,
    waCaresRate: 0.58,
    stateRate: 0,
    stateKnown: true,
    hsaEligible: true,
    autoConvert: true,
    iraStatus: "none",
    ...PROJECTED_2027,
    ...overrides,
  };
}

function close(actual: number, expected: number, tolerance = 1e-8): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} was not within ${tolerance} of ${expected}`,
  );
}

test("reference values retain the provisional rounded 2027 model", () => {
  assert.equal(PROJECTED_2027.regularLimit, 25_000);
  assert.equal(PROJECTED_2027.totalLimit, 74_000);
  assert.equal(PROJECTED_2027.iraLimit, 7_500);
  assert.equal(PROJECTED_2027.standardDeduction, REFERENCE.standardDeduction);
});

test("federal tax applies each bracket marginally", () => {
  assert.equal(federalTax(0), 0);
  close(federalTax(12_400), 1_240);
  close(federalTax(50_400), 5_800);
  close(federalTax(105_700), 17_966);
  close(federalTax(106_700), 18_206);
});

test("traditional lowers income tax while Roth remains subject to FICA", () => {
  const s = inputs({
    salary: 100_000,
    bonusPercent: 0,
    taxableBenefits: 0,
    standardDeduction: 0,
    ssBase: 200_000,
    preTaxBenefits: 1_200,
    hsa: 3_000,
    waCaresRate: 0.58,
  });
  const traditional = taxes(100_000, 0, 0, 10_000, 3_000, s);
  const roth = taxes(100_000, 0, 0, 0, 3_000, s);

  assert.ok(traditional.federal < roth.federal);
  assert.equal(traditional.socialSecurity, roth.socialSecurity);
  assert.equal(traditional.medicare, roth.medicare);
  close(traditional.socialSecurity, 95_800 * 0.062);
  close(traditional.medicare, 95_800 * 0.0145);
  close(traditional.waCares, 100_000 * 0.0058);
});

test("editable deduction and Social Security base are honored", () => {
  const s = inputs({
    standardDeduction: 50_000,
    ssBase: 25_000,
    preTaxBenefits: 0,
    taxableBenefits: 0,
    hsa: 0,
    waCaresRate: 0,
  });
  const result = taxes(100_000, 0, 0, 0, 0, s);

  assert.equal(result.federal, federalTax(50_000));
  close(result.socialSecurity, 25_000 * 0.062);
});

test("imputed insurance is taxable without becoming cash compensation", () => {
  const s = inputs({
    salary: 0,
    bonusPercent: 0,
    taxableBenefits: 1_000,
    standardDeduction: 0,
    ssBase: 100_000,
    preTaxBenefits: 0,
    hsa: 0,
    waCaresRate: 0.58,
  });
  const result = taxes(0, 0, 0, 0, 0, s);

  assert.equal(result.federal, 100);
  close(result.socialSecurity, 62);
  close(result.medicare, 14.5);
  close(result.waCares, 5.8);
});

test("limits and contributions normalize to mutually consistent caps", () => {
  const raw = inputs({
    salary: 200_000,
    bonusPercent: 0,
    regularLimit: 40_000,
    totalLimit: 30_000,
    afterTaxLimit: 50_000,
    matchLimit: 50_000,
    regular: 25_000,
    afterTax: 50_000,
  });
  const s = normalize(raw, AWARD);
  const limits = bounds(raw, AWARD);

  assert.equal(s.regularLimit, 30_000);
  assert.equal(s.afterTaxLimit, 30_000);
  assert.equal(s.matchLimit, 30_000);
  assert.equal(s.regular, 25_000);
  assert.equal(limits.afterTax, 0);
  assert.equal(s.afterTax, 0);
  assert.equal(calculate(raw, AWARD).match, 5_000);
});

test("employer HSA funding shares the combined cap", () => {
  const eligible = calculate(
    inputs({
      hsaLimit: 4_000,
      employerHsa: 1_000,
      hsa: 4_000,
    }),
    AWARD,
  );
  assert.equal(eligible.s.hsa, 3_000);
  assert.equal(eligible.employerHsa, 1_000);
  assert.equal(eligible.s.hsa + eligible.employerHsa, 4_000);

  const ineligible = calculate(
    inputs({
      hsaEligible: false,
      hsa: 3_000,
      employerHsa: 1_000,
    }),
    AWARD,
  );
  assert.equal(ineligible.s.hsa, 0);
  assert.equal(ineligible.employerHsa, 0);
});

test("vesting uses only finite award dates in the selected year and price", () => {
  assert.equal(annualVest(2026, 50, AWARD), 0);
  assert.equal(annualVest(2027, 50, AWARD), 5_000);
  assert.equal(annualVest(2028, 75, AWARD), 15_000);
  assert.equal(
    calculate(inputs({ year: 2028, rsuPrice: 75 }), AWARD).s.rsu,
    15_000,
  );
});

test("ESPP cap, held shares, and sold proceeds remain distinct", () => {
  const common = {
    salary: 100_000,
    bonusPercent: 0,
    esppPercent: 15,
    esppFmvAllowance: 10_000,
    esppPriceRatio: 1,
  };
  const held = calculate(inputs({ ...common, esppSellPercent: 0 }), AWARD);
  const sold = calculate(inputs({ ...common, esppSellPercent: 100 }), AWARD);

  assert.equal(held.requestedEspp, 15_000);
  assert.equal(held.esppCap, 9_000);
  assert.equal(held.espp, 9_000);
  assert.equal(held.discount, 1_000);
  assert.equal(held.heldEspp, 9_000);
  assert.equal(held.saleProceeds, 0);
  assert.equal(held.esppCapped, true);

  assert.equal(sold.heldEspp, 0);
  assert.ok(sold.saleTax > 0);
  close(sold.saleProceeds, 10_000 - sold.saleTax);
  close(sold.spendable - held.spendable, sold.saleProceeds);
});

test("zero income produces finite zero rates and taxes", () => {
  const result = calculate(
    inputs({
      salary: 0,
      bonusPercent: 0,
      rsuPrice: 0,
      regular: 50_000,
      hsa: 0,
      ira: 50_000,
      afterTax: 50_000,
      esppPercent: 15,
      brokerage: 0,
      reserve: 0,
      living: null,
      otherPayroll: 0,
      preTaxBenefits: 0,
      taxableBenefits: 0,
      hsaEligible: false,
      employerHsa: 0,
      waCaresRate: 0,
    }),
    AWARD,
  );

  assert.equal(result.cash, 0);
  assert.equal(result.gross, 0);
  assert.equal(result.totalTax.total, 0);
  assert.equal(result.s.regular, 0);
  assert.equal(result.s.ira, 0);
  assert.equal(result.s.afterTax, 0);
  assert.equal(result.espp, 0);
  assert.equal(result.totalRate, 0);
  assert.equal(result.employeeRate, 0);
  assert.equal(result.msftRate, 0);
});

test("resources conserve cash, benefits, taxes, and retained assets", () => {
  const result = calculate(
    inputs({
      esppSellPercent: 50,
      preTaxBenefits: 1_350,
      otherPayroll: 725,
      taxableBenefits: 900,
      stateRate: 3,
    }),
    AWARD,
  );
  const allocated =
    result.employeeSavings +
    result.employer +
    result.netRsu +
    result.totalTax.total +
    result.spendable +
    result.s.otherPayroll +
    result.s.preTaxBenefits;

  close(allocated, result.resources, 1e-7);
  close(
    result.rsuTax,
    taxes(
      result.cash,
      result.s.rsu,
      0,
      result.traditional,
      result.s.hsa,
      result.s,
    ).total - result.baseTax.total,
  );
});

test("incremental vest tax is reserved from the finite RSU vest", () => {
  const withVest = calculate(inputs(), AWARD);
  const withoutVest = calculate(inputs(), {
    ...AWARD,
    vestDates: [],
  });

  assert.equal(withVest.baseTax.total, withoutVest.baseTax.total);
  assert.equal(withVest.payroll, withoutVest.payroll);
  close(withVest.netRsu + withVest.rsuTax, withVest.s.rsu);
});

test("malformed numeric inputs fail clearly and negatives normalize safely", () => {
  assert.throws(
    () => calculate(inputs({ salary: Number.NaN }), AWARD),
    /salary must be a finite number/,
  );
  assert.throws(
    () => federalTax(Number.POSITIVE_INFINITY),
    /taxable must be a finite number/,
  );
  assert.throws(
    () =>
      annualVest(2027, 50, {
        ...AWARD,
        vestDates: ["2027-02-30"],
      }),
    /must be an ISO date/,
  );
  assert.throws(
    () =>
      annualVest(2027, 50, {
        ...AWARD,
        impliedShares: Number.POSITIVE_INFINITY,
      }),
    /award.impliedShares must be a finite number/,
  );

  const result = calculate(
    inputs({
      salary: -1,
      regular: -1,
      hsa: -1,
      afterTax: -1,
      ira: -1,
      esppPercent: -1,
      regularLimit: -1,
      totalLimit: -1,
      hsaLimit: -1,
      employerHsa: -1,
      standardDeduction: -1,
      ssBase: -1,
      living: -1,
    }),
    AWARD,
  );
  assert.equal(result.cash, 0);
  assert.equal(result.s.regularLimit, 0);
  assert.equal(result.s.totalLimit, 0);
  assert.equal(result.s.hsaLimit, 0);
  assert.equal(result.s.standardDeduction, 0);
  assert.equal(result.s.ssBase, 0);
  assert.equal(result.s.living, 0);
  assert.ok(Number.isFinite(result.totalRate));
});
