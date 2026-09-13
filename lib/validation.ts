import { ACCOUNT_KINDS } from "./accounts.ts";
import type {
  Account,
  AccountKind,
  AccountSnapshot,
  AppSettings,
  Award,
  FireInputs,
  PlannerInputs,
  PlanningData,
  Profile,
} from "./types.ts";

export class InputError extends Error {}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const nonnegative = (value: unknown) =>
  finite(value) && value >= 0 && value <= 1e10;
export const isAccountKind = (value: unknown): value is AccountKind =>
  ACCOUNT_KINDS.some((kind) => kind === value);

const plannerNumbers = [
  "year",
  "salary",
  "bonusPercent",
  "rsuPrice",
  "regular",
  "rothPercent",
  "hsa",
  "ira",
  "afterTax",
  "esppPercent",
  "esppSellPercent",
  "brokerage",
  "reserve",
  "otherPayroll",
  "preTaxBenefits",
  "taxableBenefits",
  "waCaresRate",
  "stateRate",
  "regularLimit",
  "totalLimit",
  "afterTaxLimit",
  "matchLimit",
  "iraLimit",
  "hsaLimit",
  "employerHsa",
  "standardDeduction",
  "ssBase",
  "esppFmvAllowance",
  "esppPriceRatio",
];
function isPlanner(value: unknown): value is PlannerInputs {
  if (
    !isRecord(value) ||
    !plannerNumbers.every((key) => nonnegative(value[key]))
  )
    return false;
  return (
    (value.year === 2026 || value.year === 2027) &&
    finite(value.bonusPercent) &&
    value.bonusPercent <= 100 &&
    finite(value.rothPercent) &&
    value.rothPercent <= 100 &&
    finite(value.esppPercent) &&
    value.esppPercent <= 15 &&
    finite(value.esppSellPercent) &&
    value.esppSellPercent <= 100 &&
    finite(value.esppPriceRatio) &&
    value.esppPriceRatio > 0 &&
    (value.living === null || nonnegative(value.living)) &&
    ["stateKnown", "hsaEligible", "autoConvert"].every(
      (key) => typeof value[key] === "boolean",
    ) &&
    ["unknown", "none", "present"].some((status) => status === value.iraStatus)
  );
}
const fireNumbers = [
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
  "partTimeHourly",
  "partTimeHours",
  "partTimeWeeks",
  "emergencyMonths",
  "emergencyCash",
];
function isFire(value: unknown): value is FireInputs {
  if (!isRecord(value) || !fireNumbers.every((key) => nonnegative(value[key])))
    return false;
  return (
    finite(value.currentAge) &&
    value.currentAge >= 18 &&
    value.currentAge <= 100 &&
    Number.isInteger(value.currentAge) &&
    finite(value.targetAge) &&
    value.targetAge >= value.currentAge &&
    value.targetAge <= 100 &&
    Number.isInteger(value.targetAge) &&
    finite(value.coastRetirementAge) &&
    value.coastRetirementAge >= value.currentAge &&
    value.coastRetirementAge <= 100 &&
    Number.isInteger(value.coastRetirementAge) &&
    finite(value.withdrawalRate) &&
    value.withdrawalRate > 0 &&
    value.withdrawalRate <= 20 &&
    finite(value.realReturn) &&
    value.realReturn > -100 &&
    value.realReturn <= 30 &&
    finite(value.partTimeWeeks) &&
    value.partTimeWeeks <= 52 &&
    finite(value.partTimeHours) &&
    value.partTimeHours <= 80 &&
    typeof value.includeHsa === "boolean" &&
    typeof value.reserveDebt === "boolean"
  );
}
export function isSettings(value: unknown): value is AppSettings {
  return (
    isRecord(value) &&
    isPlanner(value.planner) &&
    isFire(value.fire) &&
    isRecord(value.accountKinds) &&
    Object.values(value.accountKinds).every(isAccountKind)
  );
}
function isAward(value: unknown): value is Award {
  return (
    isRecord(value) &&
    nonnegative(value.approvalPrice) &&
    nonnegative(value.impliedShares) &&
    Array.isArray(value.vestDates) &&
    value.vestDates.length > 0 &&
    value.vestDates.every(date)
  );
}
function isAccount(value: unknown): value is Account {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    isAccountKind(value.kind) &&
    finite(value.balance) &&
    finite(value.clearedBalance) &&
    finite(value.unclearedBalance) &&
    ["onBudget", "closed", "importError"].every(
      (key) => typeof value[key] === "boolean",
    ) &&
    (value.lastReconciledAt === null || date(value.lastReconciledAt)) &&
    (value.apr === null || nonnegative(value.apr)) &&
    (value.minimumPayment === null || nonnegative(value.minimumPayment))
  );
}
export function isSnapshot(value: unknown): value is AccountSnapshot {
  return (
    isRecord(value) &&
    typeof value.planId === "string" &&
    date(value.fetchedAt) &&
    (value.source === "snapshot" || value.source === "live") &&
    Array.isArray(value.accounts) &&
    value.accounts.every(isAccount) &&
    new Set(value.accounts.map((account) => account.id)).size ===
      value.accounts.length
  );
}
function isProfile(value: unknown): value is Profile {
  return (
    isRecord(value) &&
    date(value.startDate) &&
    date(value.awardApprovalDate) &&
    date(value.latestPaystub) &&
    nonnegative(value.latestStubNetPay) &&
    Array.isArray(value.notes) &&
    value.notes.every((note) => typeof note === "string")
  );
}
export function parsePlanningData(value: unknown): PlanningData {
  if (
    !isRecord(value) ||
    !isSettings(value.settings) ||
    !isAward(value.award) ||
    !isProfile(value.profile) ||
    !isSnapshot(value.snapshot)
  ) {
    throw new InputError(
      "Local planning data is missing or invalid. Restore .local/seed.json.",
    );
  }
  return {
    settings: value.settings,
    award: value.award,
    profile: value.profile,
    snapshot: value.snapshot,
  };
}
