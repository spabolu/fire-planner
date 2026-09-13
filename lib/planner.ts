import type { Award, PlannerInputs } from "./types.ts";

export const REFERENCE = Object.freeze({
  regularLimit: 24_500,
  totalLimit: 72_000,
  afterTaxLimit: 35_250,
  matchLimit: 12_250,
  iraLimit: 7_500,
  hsaLimit: 4_400,
  employerHsa: 1_000,
  standardDeduction: 16_100,
  ssBase: 184_500,
  esppFmvAllowance: 25_000,
  esppPriceRatio: 1,
});

export const PROJECTED_2027 = Object.freeze({
  ...REFERENCE,
  regularLimit: Math.round((REFERENCE.regularLimit * 1.03) / 500) * 500,
  totalLimit: Math.round((REFERENCE.totalLimit * 1.03) / 1_000) * 1_000,
  iraLimit: Math.round((REFERENCE.iraLimit * 1.03) / 500) * 500,
  matchLimit: 12_500,
  afterTaxLimit: 36_500,
  hsaLimit: 4_500,
});

const BRACKETS = [
  [12_400, 0.1],
  [50_400, 0.12],
  [105_700, 0.22],
  [201_775, 0.24],
  [256_225, 0.32],
  [640_600, 0.35],
  [Number.POSITIVE_INFINITY, 0.37],
] as const;

const positive = (value: number): number => Math.max(0, value);

function finite(value: number, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function nonnegative(value: number, name: string): number {
  return positive(finite(value, name));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function percent(value: number, name: string, maximum = 100): number {
  return clamp(finite(value, name), 0, maximum);
}

function computed(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} is outside the supported numeric range`);
  }
  return value;
}

function validateAward(award: Award): number {
  if (!award || typeof award !== "object") {
    throw new TypeError("award must be an object");
  }
  nonnegative(award.approvalPrice, "award.approvalPrice");
  const impliedShares = nonnegative(award.impliedShares, "award.impliedShares");
  if (!Array.isArray(award.vestDates)) {
    throw new TypeError("award.vestDates must be an array");
  }
  return impliedShares;
}

function vestYear(date: string, index: number): number {
  if (typeof date !== "string") {
    throw new TypeError(`award.vestDates[${index}] must be an ISO date`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !match ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new TypeError(`award.vestDates[${index}] must be an ISO date`);
  }
  return Number(match[1]);
}

function validateFlags(s: PlannerInputs): void {
  for (const key of ["stateKnown", "hsaEligible", "autoConvert"] as const) {
    if (typeof s[key] !== "boolean") {
      throw new TypeError(`${key} must be a boolean`);
    }
  }
  if (!["unknown", "none", "present"].includes(s.iraStatus)) {
    throw new TypeError("iraStatus must be unknown, none, or present");
  }
}

function normalizedAssumptions(s: PlannerInputs): PlannerInputs {
  if (!s || typeof s !== "object") {
    throw new TypeError("planner inputs must be an object");
  }
  validateFlags(s);
  const year = finite(s.year, "year");
  if (!Number.isInteger(year)) {
    throw new TypeError("year must be an integer");
  }

  const totalLimit = nonnegative(s.totalLimit, "totalLimit");
  const hsaLimit = nonnegative(s.hsaLimit, "hsaLimit");
  const living = s.living === null ? null : nonnegative(s.living, "living");

  return {
    ...s,
    year,
    salary: nonnegative(s.salary, "salary"),
    bonusPercent: nonnegative(s.bonusPercent, "bonusPercent"),
    rsuPrice: nonnegative(s.rsuPrice, "rsuPrice"),
    regular: nonnegative(s.regular, "regular"),
    rothPercent: percent(s.rothPercent, "rothPercent"),
    hsa: nonnegative(s.hsa, "hsa"),
    ira: nonnegative(s.ira, "ira"),
    afterTax: nonnegative(s.afterTax, "afterTax"),
    esppPercent: percent(s.esppPercent, "esppPercent", 15),
    esppSellPercent: percent(s.esppSellPercent, "esppSellPercent"),
    brokerage: nonnegative(s.brokerage, "brokerage"),
    reserve: nonnegative(s.reserve, "reserve"),
    living,
    otherPayroll: nonnegative(s.otherPayroll, "otherPayroll"),
    preTaxBenefits: nonnegative(s.preTaxBenefits, "preTaxBenefits"),
    taxableBenefits: nonnegative(s.taxableBenefits, "taxableBenefits"),
    waCaresRate: percent(s.waCaresRate, "waCaresRate", 5),
    stateRate: percent(s.stateRate, "stateRate", 20),
    regularLimit: Math.min(
      nonnegative(s.regularLimit, "regularLimit"),
      totalLimit,
    ),
    totalLimit,
    afterTaxLimit: Math.min(
      nonnegative(s.afterTaxLimit, "afterTaxLimit"),
      totalLimit,
    ),
    matchLimit: Math.min(nonnegative(s.matchLimit, "matchLimit"), totalLimit),
    iraLimit: nonnegative(s.iraLimit, "iraLimit"),
    hsaLimit,
    employerHsa: Math.min(nonnegative(s.employerHsa, "employerHsa"), hsaLimit),
    standardDeduction: nonnegative(s.standardDeduction, "standardDeduction"),
    ssBase: nonnegative(s.ssBase, "ssBase"),
    esppFmvAllowance: nonnegative(s.esppFmvAllowance, "esppFmvAllowance"),
    esppPriceRatio: nonnegative(s.esppPriceRatio, "esppPriceRatio"),
  };
}

function cashCompensation(s: PlannerInputs): number {
  return computed(s.salary * (1 + s.bonusPercent / 100), "cash compensation");
}

function contributionBounds(
  s: PlannerInputs,
  rsu: number,
): {
  regular: number;
  afterTax: number;
  hsa: number;
  ira: number;
} {
  const cash = cashCompensation(s);
  const regular = Math.min(s.regularLimit, s.totalLimit, cash);
  const actualRegular = clamp(s.regular, 0, regular);
  const match = Math.min(
    actualRegular * 0.5,
    s.matchLimit,
    positive(s.totalLimit - actualRegular),
  );
  const hsa = s.hsaEligible ? positive(s.hsaLimit - s.employerHsa) : 0;
  const actualHsa = clamp(s.hsa, 0, hsa);
  const iraCompensation = computed(
    cash +
      rsu +
      s.taxableBenefits -
      actualRegular * (1 - s.rothPercent / 100) -
      actualHsa -
      s.preTaxBenefits,
    "IRA compensation",
  );

  return {
    regular,
    afterTax: Math.min(
      s.afterTaxLimit,
      positive(s.totalLimit - actualRegular - match),
      positive(cash - actualRegular),
    ),
    hsa,
    ira: Math.min(s.iraLimit, positive(iraCompensation)),
  };
}

export function annualVest(year: number, price: number, award: Award): number {
  const normalizedYear = finite(year, "year");
  if (!Number.isInteger(normalizedYear)) {
    throw new TypeError("year must be an integer");
  }
  const normalizedPrice = nonnegative(price, "price");
  const impliedShares = validateAward(award);
  const vestCount = award.vestDates.reduce(
    (count, date, index) =>
      count + Number(vestYear(date, index) === normalizedYear),
    0,
  );
  return computed(
    vestCount * impliedShares * 0.25 * normalizedPrice,
    "annual vest",
  );
}

export function federalTax(taxable: number): number {
  const income = nonnegative(taxable, "taxable");
  let tax = 0;
  let previous = 0;
  for (const [ceiling, rate] of BRACKETS) {
    tax += positive(Math.min(income, ceiling) - previous) * rate;
    if (income <= ceiling) {
      break;
    }
    previous = ceiling;
  }
  return computed(tax, "federal tax");
}

export function taxes(
  cash: number,
  rsu: number,
  esppIncome: number,
  traditional: number,
  hsa: number,
  input: PlannerInputs,
) {
  const s = normalizedAssumptions(input);
  const normalizedCash = nonnegative(cash, "cash");
  const normalizedRsu = nonnegative(rsu, "rsu");
  const normalizedEsppIncome = nonnegative(esppIncome, "esppIncome");
  const normalizedTraditional = nonnegative(traditional, "traditional");
  const normalizedHsa = nonnegative(hsa, "hsa");

  // Imputed insurance is taxable compensation but is not spendable cash.
  const wageBase = computed(
    normalizedCash + normalizedRsu + s.taxableBenefits,
    "taxable wage base",
  );
  const income = positive(
    wageBase +
      normalizedEsppIncome -
      normalizedTraditional -
      normalizedHsa -
      s.preTaxBenefits,
  );
  // Traditional and Roth 401(k) contributions remain subject to FICA.
  const ficaWages = positive(wageBase - normalizedHsa - s.preTaxBenefits);
  const result = {
    federal: federalTax(positive(income - s.standardDeduction)),
    socialSecurity: Math.min(ficaWages, s.ssBase) * 0.062,
    medicare: ficaWages * 0.0145,
    additionalMedicare: positive(ficaWages - 200_000) * 0.009,
    state: income * (s.stateKnown ? s.stateRate / 100 : 0),
    waCares: positive(wageBase) * (s.waCaresRate / 100),
  };
  return {
    ...result,
    total: computed(
      Object.values(result).reduce((sum, value) => sum + value, 0),
      "total tax",
    ),
  };
}

export function bounds(s: PlannerInputs, award: Award) {
  const next = normalizedAssumptions(s);
  const rsu = annualVest(next.year, next.rsuPrice, award);
  return contributionBounds(next, rsu);
}

export function normalize(
  input: PlannerInputs,
  award: Award,
): PlannerInputs & { rsu: number } {
  const next = normalizedAssumptions(input);
  const rsu = annualVest(next.year, next.rsuPrice, award);

  let limits = contributionBounds(next, rsu);
  next.regular = clamp(next.regular, 0, limits.regular);
  limits = contributionBounds(next, rsu);
  next.hsa = clamp(next.hsa, 0, limits.hsa);
  limits = contributionBounds(next, rsu);
  next.afterTax = clamp(next.afterTax, 0, limits.afterTax);
  next.ira = clamp(next.ira, 0, limits.ira);

  return { ...next, rsu };
}

export function calculate(input: PlannerInputs, award: Award) {
  const s = normalize(input, award);
  const cash = cashCompensation(s);
  const gross = computed(cash + s.rsu, "gross compensation");
  const traditional = s.regular * (1 - s.rothPercent / 100);
  const roth = s.regular - traditional;
  const employerHsa = s.hsaEligible ? s.employerHsa : 0;
  const match = Math.min(
    s.regular * 0.5,
    s.matchLimit,
    positive(s.totalLimit - s.regular),
  );
  const employer = match + employerHsa;
  const requestedEspp = computed(
    cash * (s.esppPercent / 100),
    "requested ESPP",
  );
  const esppCap = computed(
    s.esppFmvAllowance * 0.9 * s.esppPriceRatio,
    "ESPP cap",
  );
  const espp = Math.min(requestedEspp, esppCap);
  const saleFraction = s.esppSellPercent / 100;
  const discount = espp / 9;
  const saleIncome = discount * saleFraction;
  const baseTax = taxes(cash, 0, 0, traditional, s.hsa, s);
  const vestTax = taxes(cash, s.rsu, 0, traditional, s.hsa, s);
  const totalTax = taxes(cash, s.rsu, saleIncome, traditional, s.hsa, s);
  const rsuTax = positive(vestTax.total - baseTax.total);
  const saleTax = positive(totalTax.total - vestTax.total);
  const netRsu = s.rsu - rsuTax;
  const saleProceeds = espp * saleFraction + saleIncome - saleTax;
  const heldEspp = espp * (1 - saleFraction);
  const payroll =
    cash -
    baseTax.total -
    s.regular -
    s.hsa -
    s.afterTax -
    espp -
    s.otherPayroll -
    s.preTaxBenefits;
  const outsidePayroll = s.ira + s.brokerage + s.reserve;
  const holdCash = payroll - outsidePayroll;
  const spendable = holdCash + saleProceeds;
  const fullSaleTax = positive(
    taxes(cash, s.rsu, discount, traditional, s.hsa, s).total - vestTax.total,
  );
  const fullSaleProceeds = espp + discount - fullSaleTax;
  const fullSaleCash = holdCash + fullSaleProceeds;
  const employeeRetirement = s.regular + s.hsa + s.afterTax + s.ira;
  const employeeSavings =
    employeeRetirement + s.brokerage + s.reserve + heldEspp;
  const totalSavings = employeeSavings + employer + netRsu;
  const denominator = gross + employer;
  const resources = denominator + saleIncome;
  const residual = s.living === null ? null : spendable - s.living * 12;
  const taxWithout = taxes(cash, s.rsu, saleIncome, 0, 0, s).total;

  return {
    s,
    cash,
    gross,
    traditional,
    roth,
    employerHsa,
    match,
    employer,
    requestedEspp,
    esppCap,
    espp,
    discount,
    saleProceeds,
    saleTax,
    heldEspp,
    baseTax,
    rsuTax,
    totalTax,
    netRsu,
    payroll,
    outsidePayroll,
    holdCash,
    spendable,
    fullSaleCash,
    fullSaleProceeds,
    employeeRetirement,
    employeeSavings,
    totalSavings,
    denominator,
    resources,
    residual,
    totalRate: denominator ? totalSavings / denominator : 0,
    employeeRate: cash ? employeeSavings / cash : 0,
    msftRate: totalSavings ? (heldEspp + netRsu) / totalSavings : 0,
    taxSaved: taxWithout - totalTax.total,
    shortfall: positive(-spendable),
    esppCapped: requestedEspp > esppCap + 0.005,
  };
}

export type PlannerResult = ReturnType<typeof calculate>;
