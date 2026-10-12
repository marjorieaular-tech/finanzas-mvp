
import type {
  SavingsMovement,
  SavingsAllocation,
} from "./savingsTypes";

export function calculateSavingsBalance(
  movements: SavingsMovement[],
  allocations: SavingsAllocation[]
) {
  // Saldo total de dólares
  const totalUsd = movements.reduce(
    (total, movement) => total + movement.amountUsd,
    0
  );

  // Dólares reservados para objetivos
  const allocatedUsd = allocations.reduce(
    (total, allocation) => total + allocation.amountUsd,
    0
  );

  // Dólares disponibles sin asignar
  const unallocatedUsd = totalUsd - allocatedUsd;

  return {
    totalUsd,
    allocatedUsd,
    unallocatedUsd,
  };
}


export function canAllocateSavings(
  amountUsd: number,
  availableUsd: number
): boolean {
  return (
    Number.isFinite(amountUsd) &&
    Number.isFinite(availableUsd) &&
    amountUsd > 0 &&
    availableUsd >= amountUsd
  );
}


export function canWithdrawSavings(
  amountUsd: number,
  unallocatedUsd: number
): boolean {
  return (
    Number.isFinite(amountUsd) &&
    Number.isFinite(unallocatedUsd) &&
    amountUsd > 0 &&
    unallocatedUsd >= amountUsd
  );
}


export function calculateSavingsAdjustment(
  currentBalanceUsd: number,
  actualBalanceUsd: number
): number {
  return actualBalanceUsd - currentBalanceUsd;
}


export function canAdjustSavingsBalance(
  actualBalanceUsd: number,
  allocatedUsd: number
): boolean {
  return (
    Number.isFinite(actualBalanceUsd) &&
    Number.isFinite(allocatedUsd) &&
    actualBalanceUsd >= 0 &&
    allocatedUsd >= 0 &&
    actualBalanceUsd >= allocatedUsd
  );
}
