
import { strict as assert } from "node:assert";





import {
  canAllocateSavings,
  calculateSavingsBalance,
  canWithdrawSavings,
  calculateSavingsAdjustment,
  canAdjustSavingsBalance,
} from "./savingsCalculations";





assert.equal(
  canAllocateSavings(100, 200),
  true,
  "Debe permitir asignar USD 100"
);

assert.equal(
  canAllocateSavings(200, 200),
  true,
  "Debe permitir asignar todo el disponible"
);

assert.equal(
  canAllocateSavings(250, 200),
  false,
  "No debe permitir asignar más del disponible"
);

assert.equal(
  canAllocateSavings(0, 200),
  false,
  "No debe permitir asignar cero"
);

console.log("✅ Pruebas de asignación superadas");


const balance = calculateSavingsBalance(
  [
    {
      id: "purchase-1",
      type: "purchase",
      date: "2026-10-10",
      amountUsd: 500,
      amountArs: 750000,
    },
  ],
  [
    {
      id: "allocation-1",
      goalId: "ortodoncia",
      amountUsd: 300,
      date: "2026-10-10",
    },
  ]
);

assert.equal(balance.totalUsd, 500);
assert.equal(balance.allocatedUsd, 300);
assert.equal(balance.unallocatedUsd, 200);

console.log("✅ Pruebas de saldos superadas");

const balanceAfterWithdrawal = calculateSavingsBalance(
  [
    {
      id: "initial-1",
      type: "initial_balance",
      date: "2026-10-10",
      amountUsd: 500,
    },
    {
      id: "withdrawal-1",
      type: "withdrawal",
      date: "2026-10-11",
      amountUsd: -100,
    },
  ],
  []
);

assert.equal(balanceAfterWithdrawal.totalUsd, 400);
assert.equal(balanceAfterWithdrawal.allocatedUsd, 0);
assert.equal(balanceAfterWithdrawal.unallocatedUsd, 400);

console.log("✅ Prueba de retiro superada");


const availableForWithdrawal = 200;

assert.equal(
  canWithdrawSavings(100, availableForWithdrawal),
  true,
  "Debe permitir retirar USD 100"
);

assert.equal(
  canWithdrawSavings(200, availableForWithdrawal),
  true,
  "Debe permitir retirar todo el ahorro general"
);

assert.equal(
  canWithdrawSavings(250, availableForWithdrawal),
  false,
  "No debe permitir retirar dinero reservado"
);

assert.equal(
  canWithdrawSavings(0, availableForWithdrawal),
  false,
  "No debe permitir retirar USD 0"
);

assert.equal(
  canWithdrawSavings(-50, availableForWithdrawal),
  false,
  "No debe permitir retiros negativos"
);

console.log("✅ Validaciones de retiro superadas");


assert.equal(
  calculateSavingsAdjustment(500, 480),
  -20,
  "Debe calcular un ajuste negativo de USD 20"
);

assert.equal(
  calculateSavingsAdjustment(500, 550),
  50,
  "Debe calcular un ajuste positivo de USD 50"
);

assert.equal(
  calculateSavingsAdjustment(500, 500),
  0,
  "No debe generar diferencias cuando los saldos coinciden"
);

console.log("✅ Pruebas de ajustes de saldo superadas");


assert.equal(
  canAdjustSavingsBalance(480, 300),
  true,
  "Debe permitir ajustes que respeten el dinero reservado"
);

assert.equal(
  canAdjustSavingsBalance(300, 300),
  true,
  "Debe permitir un saldo igual al dinero reservado"
);

assert.equal(
  canAdjustSavingsBalance(280, 300),
  false,
  "No debe permitir reducir el saldo por debajo de lo reservado"
);

assert.equal(
  canAdjustSavingsBalance(-20, 0),
  false,
  "No debe permitir saldos negativos"
);

assert.equal(
  canAdjustSavingsBalance(500, -100),
  false,
  "No debe aceptar importes reservados negativos"
);

console.log("✅ Protección de ajustes de saldo superada");
