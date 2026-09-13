export interface Award {
  approvalPrice: number;
  impliedShares: number;
  vestDates: string[];
}

export interface PlannerInputs {
  year: number;
  salary: number;
  bonusPercent: number;
  rsuPrice: number;
  regular: number;
  rothPercent: number;
  hsa: number;
  ira: number;
  afterTax: number;
  esppPercent: number;
  esppSellPercent: number;
  brokerage: number;
  reserve: number;
  living: number | null;
  otherPayroll: number;
  preTaxBenefits: number;
  taxableBenefits: number;
  waCaresRate: number;
  stateRate: number;
  stateKnown: boolean;
  hsaEligible: boolean;
  autoConvert: boolean;
  iraStatus: "unknown" | "none" | "present";
  regularLimit: number;
  totalLimit: number;
  afterTaxLimit: number;
  matchLimit: number;
  iraLimit: number;
  hsaLimit: number;
  employerHsa: number;
  standardDeduction: number;
  ssBase: number;
  esppFmvAllowance: number;
  esppPriceRatio: number;
}

export interface FireInputs {
  currentAge: number;
  targetAge: number;
  coastRetirementAge: number;
  housing: number;
  food: number;
  utilities: number;
  transport: number;
  healthcare: number;
  other: number;
  taxBuffer: number;
  regularExtra: number;
  fatExtra: number;
  withdrawalRate: number;
  realReturn: number;
  partTimeHourly: number;
  partTimeHours: number;
  partTimeWeeks: number;
  emergencyMonths: number;
  emergencyCash: number;
  includeHsa: boolean;
  reserveDebt: boolean;
}

export interface FireContext {
  startingPortfolio: number;
  annualInvestment: number;
  additionalByYear: Record<string, number>;
  startYear: number;
  partTimeAnnualNet: number;
}

export type AccountKind =
  | "cash"
  | "taxable"
  | "retirement"
  | "hsa"
  | "vehicle"
  | "property"
  | "other"
  | "debt";

export interface Account {
  id: string;
  name: string;
  type: string;
  kind: AccountKind;
  balance: number;
  clearedBalance: number;
  unclearedBalance: number;
  onBudget: boolean;
  closed: boolean;
  lastReconciledAt: string | null;
  importError: boolean;
  apr: number | null;
  minimumPayment: number | null;
}

export interface AccountSnapshot {
  planId: string;
  fetchedAt: string;
  source: "snapshot" | "live";
  accounts: Account[];
}

export interface AccountStatus {
  mode: "live" | "fallback";
  message: string | null;
}

export interface Profile {
  startDate: string;
  awardApprovalDate: string;
  latestPaystub: string;
  latestStubNetPay: number;
  notes: string[];
}

export interface AppSettings {
  planner: PlannerInputs;
  fire: FireInputs;
  accountKinds: Record<string, AccountKind>;
}

export interface PlanningData {
  settings: AppSettings;
  award: Award;
  profile: Profile;
  snapshot: AccountSnapshot;
}
