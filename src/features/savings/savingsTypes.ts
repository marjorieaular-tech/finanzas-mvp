
export type SavingsGoal = {
  id: string;
  name: string;
  targetAmountUsd: number;
  createdAt: string;
  status: "active" | "completed" | "archived";
};

export type SavingsMovementType =
  | "initial_balance"
  | "purchase"
  | "withdrawal"
  | "adjustment";

export type SavingsMovement = {
  id: string;
  type: SavingsMovementType;
  date: string;
  amountUsd: number;
  amountArs?: number;
  goalId?: string | null;
  note?: string;
};


export type SavingsSettings = {
  id: string;
  monthlyTargetUsd: number;
  referenceExchangeRate?: number;
};


export type SavingsAllocation = {
  id: string;
  goalId: string;
  amountUsd: number;
  date: string;
  note?: string;
};
