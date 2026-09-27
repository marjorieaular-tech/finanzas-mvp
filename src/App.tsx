import { useState, type FormEvent } from "react";
import Dexie, { type Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  PartyPopper,
  Trash2,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

type View =
  | "summary"
  | "budget"
  | "cards"
  | "loans"
  | "projection";

type CreditCardExpense = {
  id: string;
  date: string;
  description: string;
  bank: string;
  cardName: string;
  category: string;
  totalAmount: number;
  installments: number;
  currentInstallment: number;
  currentInstallmentMonth: string;
  monthlyAmount: number;
  status: "active" | "finished";
};

type Loan = {
  id: string;
  bank: string;
  description: string;
  initialAmount: number;
  monthlyPayment: number;
  totalInstallments: number;
  currentInstallment: number;
  currentInstallmentMonth: string;
  status: "active" | "finished";
};

type BudgetConcept = {
  id: string;
  name: string;
  type: "fixed" | "variable";
  status: "active" | "inactive";
  sortOrder?: number;
};

type MonthlyBudgetAmount = {
  id: string;
  conceptId: string;
  month: string;
  budgetedAmount: number;
  actualAmount: number;
};

class FinanceDatabase extends Dexie {
  creditCardExpenses!: Table<CreditCardExpense, string>;
  loans!: Table<Loan, string>;
  budgetConcepts!: Table<BudgetConcept, string>;
  monthlyBudgetAmounts!: Table<MonthlyBudgetAmount, string>;

  constructor() {
    super("finanzas_mvp_db");

    this.version(1).stores({
      creditCardExpenses:
        "id, date, bank, cardName, category, currentInstallmentMonth, status",
    });

    this.version(2).stores({
      creditCardExpenses:
        "id, date, bank, cardName, category, currentInstallmentMonth, status",
      loans: "id, bank, currentInstallmentMonth, status",
    });

    this.version(3).stores({
  creditCardExpenses:
    "id, date, bank, cardName, category, currentInstallmentMonth, status",

  loans:
    "id, bank, currentInstallmentMonth, status",

  budgetConcepts:
    "id, name, type, status",

  monthlyBudgetAmounts:
    "id, conceptId, month, [conceptId+month]",
});
  }
}

const db = new FinanceDatabase();

function createId() {
  return crypto.randomUUID();
}

function getCurrentMonth() {
  const today = new Date();

  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

const currentMonth = getCurrentMonth();

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function addMonthsToMonthKey(
  monthKey: string,
  monthsToAdd: number
) {
  const [year, month] = monthKey.split("-").map(Number);

  const date = new Date(
    year,
    month - 1 + monthsToAdd,
    1
  );

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMonthIndex(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return year * 12 + month;
}

function getInstallmentForMonth(
  expense: CreditCardExpense,
  targetMonth: string
) {
  const difference =
    getMonthIndex(targetMonth) -
    getMonthIndex(expense.currentInstallmentMonth);

  const installmentNumber = expense.currentInstallment + difference;

  if (installmentNumber < 1) return null;
  if (installmentNumber > expense.installments) return null;

  return installmentNumber;
}

function getLoanInstallmentForMonth(
  loan: Loan,
  targetMonth: string
) {
  const difference =
    getMonthIndex(targetMonth) -
    getMonthIndex(loan.currentInstallmentMonth);

  const installmentNumber = loan.currentInstallment + difference;

  if (installmentNumber < 1) return null;
  if (installmentNumber > loan.totalInstallments) return null;

  return installmentNumber;
}

function CardForm() {
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [bank, setBank] = useState("");
  const [cardName, setCardName] = useState("");
  const [category, setCategory] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [currentInstallmentMonth, setCurrentInstallmentMonth] =
    useState(currentMonth);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [celebrationMessage, setCelebrationMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setCelebrationMessage("");

    const numericTotal = Number(totalAmount);
    const numericInstallments = Number(installments);
    const numericCurrentInstallment = Number(currentInstallment);

    const savedDescription = description.trim();

    if (
      !savedDescription ||
      !bank.trim() ||
      !cardName.trim() ||
      numericTotal <= 0 ||
      numericInstallments <= 0 ||
      numericCurrentInstallment <= 0 ||
      numericCurrentInstallment > numericInstallments
    ) {
      return;
    }

    const isLastInstallment =
      numericCurrentInstallment === numericInstallments;

    setIsSaving(true);

    try {
      await db.creditCardExpenses.add({
        id: createId(),
        date,
        description: savedDescription,
        bank: bank.trim(),
        cardName: cardName.trim(),
        category: category.trim() || "Sin categoría",
        totalAmount: numericTotal,
        installments: numericInstallments,
        currentInstallment: numericCurrentInstallment,
        currentInstallmentMonth,
        monthlyAmount: numericTotal / numericInstallments,
        status: "active",
      });

      setSuccessMessage("Compra guardada correctamente ✓");

      if (isLastInstallment) {
        setCelebrationMessage(
          `¡Felicitaciones! Última cuota de ${savedDescription} 🥳`
        );
      }

      setDescription("");
      setCategory("");
      setTotalAmount("");
      setInstallments("1");
      setCurrentInstallment("1");
      setCurrentInstallmentMonth(currentMonth);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Nueva compra
      </p>

      <h2 className="mt-1 text-xl font-bold text-slate-900">
        Registrar tarjeta de crédito
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        También podés cargar compras que ya tienen cuotas pagadas.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Descripción
          </span>

          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ej. Zapatillas"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Fecha de compra
          </span>

          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Banco
          </span>

          <input
            value={bank}
            onChange={(event) => setBank(event.target.value)}
            placeholder="Ej. Galicia"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Tarjeta
          </span>

          <input
            value={cardName}
            onChange={(event) => setCardName(event.target.value)}
            placeholder="Ej. Visa"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Categoría
          </span>

          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Ropa, hogar, tecnología..."
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Monto total
          </span>

          <input
            type="number"
            min="0"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            placeholder="120000"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Cantidad de cuotas
          </span>

          <input
            type="number"
            min="1"
            value={installments}
            onChange={(event) => setInstallments(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Número de cuota actual
          </span>

          <input
            type="number"
            min="1"
            value={currentInstallment}
            onChange={(event) =>
              setCurrentInstallment(event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-600">
            Mes de esa cuota
          </span>

          <input
            type="month"
            value={currentInstallmentMonth}
            onChange={(event) =>
              setCurrentInstallmentMonth(event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500 sm:max-w-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {isSaving ? "Guardando..." : "Guardar compra"}
      </button>

      {successMessage && (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {successMessage}
        </p>
      )}

      {celebrationMessage && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-amber-800">
          <PartyPopper size={20} className="shrink-0" />

          <p className="text-sm font-semibold">
            {celebrationMessage}
          </p>
        </div>
      )}
    </form>
  );
}

function LoanForm() {
  const [bank, setBank] = useState("");
  const [description, setDescription] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [currentInstallment, setCurrentInstallment] = useState("1");
  const [currentInstallmentMonth, setCurrentInstallmentMonth] =
    useState(currentMonth);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [celebrationMessage, setCelebrationMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setCelebrationMessage("");

    const numericInitialAmount = Number(initialAmount);
    const numericMonthlyPayment = Number(monthlyPayment);
    const numericTotalInstallments = Number(totalInstallments);
    const numericCurrentInstallment = Number(currentInstallment);

    const savedDescription = description.trim();

    if (
      !bank.trim() ||
      !savedDescription ||
      numericInitialAmount <= 0 ||
      numericMonthlyPayment <= 0 ||
      numericTotalInstallments <= 0 ||
      numericCurrentInstallment <= 0 ||
      numericCurrentInstallment > numericTotalInstallments
    ) {
      return;
    }

    const isLastInstallment =
      numericCurrentInstallment === numericTotalInstallments;

    setIsSaving(true);

    try {
      await db.loans.add({
        id: createId(),
        bank: bank.trim(),
        description: savedDescription,
        initialAmount: numericInitialAmount,
        monthlyPayment: numericMonthlyPayment,
        totalInstallments: numericTotalInstallments,
        currentInstallment: numericCurrentInstallment,
        currentInstallmentMonth,
        status: "active",
      });

      setSuccessMessage("Crédito guardado correctamente ✓");

      if (isLastInstallment) {
        setCelebrationMessage(
          `¡Felicitaciones! Última cuota de ${savedDescription} 🥳`
        );
      }

      setBank("");
      setDescription("");
      setInitialAmount("");
      setMonthlyPayment("");
      setTotalInstallments("");
      setCurrentInstallment("1");
      setCurrentInstallmentMonth(currentMonth);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Nuevo crédito
      </p>

      <h2 className="mt-1 text-xl font-bold text-slate-900">
        Registrar crédito personal
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        También podés cargar créditos que ya están en curso.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Banco / entidad
          </span>

          <input
            value={bank}
            onChange={(event) => setBank(event.target.value)}
            placeholder="Ej. Santander"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Descripción
          </span>

          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ej. Préstamo personal"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Monto inicial
          </span>

          <input
            type="number"
            min="0"
            value={initialAmount}
            onChange={(event) => setInitialAmount(event.target.value)}
            placeholder="1000000"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Cuota mensual
          </span>

          <input
            type="number"
            min="0"
            value={monthlyPayment}
            onChange={(event) =>
              setMonthlyPayment(event.target.value)
            }
            placeholder="85000"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Total de cuotas
          </span>

          <input
            type="number"
            min="1"
            value={totalInstallments}
            onChange={(event) =>
              setTotalInstallments(event.target.value)
            }
            placeholder="12"
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-600">
            Número de cuota actual
          </span>

          <input
            type="number"
            min="1"
            value={currentInstallment}
            onChange={(event) =>
              setCurrentInstallment(event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-sm font-medium text-slate-600">
            Mes de esa cuota
          </span>

          <input
            type="month"
            value={currentInstallmentMonth}
            onChange={(event) =>
              setCurrentInstallmentMonth(event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500 sm:max-w-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {isSaving ? "Guardando..." : "Guardar crédito"}
      </button>

      {successMessage && (
        <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {successMessage}
        </p>
      )}

      {celebrationMessage && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-3 text-amber-800">
          <PartyPopper size={20} className="shrink-0" />

          <p className="text-sm font-semibold">
            {celebrationMessage}
          </p>
        </div>
      )}
    </form>
  );
}
function BackupSection() {
  const [message, setMessage] = useState("");

  async function exportBackup() {
    const creditCardExpenses =
      await db.creditCardExpenses.toArray();

    const loans =
      await db.loans.toArray();

    const budgetConcepts =
      await db.budgetConcepts.toArray();

    const monthlyBudgetAmounts =
      await db.monthlyBudgetAmounts.toArray();

    const backup = {
      version: 2,
      exportedAt: new Date().toISOString(),
      creditCardExpenses,
      loans,
      budgetConcepts,
      monthlyBudgetAmounts,
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `finanzas-backup-${date}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setMessage("Respaldo exportado correctamente ✓");
  }

  async function importBackup(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (
        !backup ||
        !Array.isArray(backup.creditCardExpenses) ||
        !Array.isArray(backup.loans)
      ) {
        setMessage(
          "El archivo seleccionado no parece ser un respaldo válido."
        );
        event.target.value = "";
        return;
      }

      const budgetConcepts = Array.isArray(
        backup.budgetConcepts
      )
        ? backup.budgetConcepts
        : [];

      const monthlyBudgetAmounts = Array.isArray(
        backup.monthlyBudgetAmounts
      )
        ? backup.monthlyBudgetAmounts
        : [];

      const confirmed = window.confirm(
        "Este respaldo reemplazará los datos guardados actualmente en este dispositivo. ¿Querés continuar?"
      );

      if (!confirmed) {
        event.target.value = "";
        return;
      }

      await db.transaction(
        "rw",
        db.creditCardExpenses,
        db.loans,
        db.budgetConcepts,
        db.monthlyBudgetAmounts,
        async () => {
          await db.creditCardExpenses.clear();
          await db.loans.clear();
          await db.budgetConcepts.clear();
          await db.monthlyBudgetAmounts.clear();

          if (backup.creditCardExpenses.length > 0) {
            await db.creditCardExpenses.bulkPut(
              backup.creditCardExpenses
            );
          }

          if (backup.loans.length > 0) {
            await db.loans.bulkPut(
              backup.loans
            );
          }

          if (budgetConcepts.length > 0) {
            await db.budgetConcepts.bulkPut(
              budgetConcepts
            );
          }

          if (monthlyBudgetAmounts.length > 0) {
            await db.monthlyBudgetAmounts.bulkPut(
              monthlyBudgetAmounts
            );
          }
        }
      );

      setMessage(
        "Respaldo restaurado correctamente ✓"
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "No se pudo importar el respaldo. Revisá que sea el archivo correcto."
      );
    }

    event.target.value = "";
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-bold text-slate-900">
          Respaldo de datos
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Guardá una copia de tus datos para poder
          recuperarlos si cambiás de dispositivo.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportBackup}
          className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
        >
          Exportar respaldo
        </button>

        <label className="cursor-pointer rounded-xl border border-slate-200 px-3 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Importar respaldo

          <input
            type="file"
            accept=".json,application/json"
            onChange={importBackup}
            className="hidden"
          />
        </label>
      </div>

      {message && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          {message}
        </p>
      )}

      <p className="mt-3 text-xs text-slate-400">
        El respaldo contiene los datos financieros
        guardados por esta app.
      </p>
    </section>
  );
}

function SortableBudgetConcept({
  concept,
  amount,
  onEdit,
}: {
  concept: BudgetConcept;
  amount: number;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: concept.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 ${
        isDragging ? "opacity-70 shadow-md" : ""
      }`}
    >
      <button
  type="button"
  onClick={onEdit}
  className="min-w-0 flex-1 text-left"
>
  <p className="truncate text-sm font-semibold leading-tight text-slate-900">
    {concept.name}
  </p>

  <p className="mt-0.5 text-xs font-medium text-slate-500">
    {formatMoney(amount)}
  </p>
</button>

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${concept.name}`}
        className="touch-none rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
      >
        <GripVertical size={18} />
      </button>
    </div>
  );
}

function App() {
  const [selectedMonth, setSelectedMonth] =
    useState(currentMonth);

  const [activeView, setActiveView] =
    useState<View>("summary");

  const [showCardForm, setShowCardForm] =
    useState(false);

  const [showLoanForm, setShowLoanForm] =
    useState(false);

  const [expandedCardGroup, setExpandedCardGroup] =
    useState<string | null>(null);

  const [expandedLoanId, setExpandedLoanId] =
    useState<string | null>(null);

  const expenses =
    useLiveQuery(
      () =>
        db.creditCardExpenses
          .orderBy("date")
          .reverse()
          .toArray(),
      []
    ) ?? [];

  const loans =
    useLiveQuery(
      () => db.loans.toArray(),
      []
    ) ?? [];

    const budgetConcepts =
  useLiveQuery(
    () => db.budgetConcepts.toArray(),
    []
  ) ?? [];

  const monthlyBudgetAmounts =
  useLiveQuery(
    () =>
      db.monthlyBudgetAmounts
        .where("month")
        .equals(selectedMonth)
        .toArray(),
    [selectedMonth]
  ) ?? [];

  const fixedBudgetConcepts = budgetConcepts
  .filter(
    (concept) =>
      concept.type === "fixed" &&
      concept.status === "active"
  )
  .sort((a, b) => {
    const aOrder =
      a.sortOrder ?? budgetConcepts.indexOf(a);

    const bOrder =
      b.sortOrder ?? budgetConcepts.indexOf(b);

    return aOrder - bOrder;
  });

  const variableBudgetConcepts = budgetConcepts
  .filter(
    (concept) =>
      concept.type === "variable" &&
      concept.status === "active"
  )
  .sort((a, b) => {
    const aOrder =
      a.sortOrder ?? budgetConcepts.indexOf(a);

    const bOrder =
      b.sortOrder ?? budgetConcepts.indexOf(b);

    return aOrder - bOrder;
  });

  const fixedBudgetTotal = fixedBudgetConcepts.reduce(
  (total, concept) => {
    const monthlyAmount = monthlyBudgetAmounts.find(
      (item) => item.conceptId === concept.id
    );

    return total + (monthlyAmount?.budgetedAmount ?? 0);
  },
  0
);

const variableBudgetTotal = variableBudgetConcepts.reduce(
  (total, concept) => {
    const monthlyAmount = monthlyBudgetAmounts.find(
      (item) => item.conceptId === concept.id
    );

    return total + (monthlyAmount?.budgetedAmount ?? 0);
  },
  0
);

  const activeExpenses = expenses.filter(
    (expense) => expense.status === "active"
  );

  const activeLoans = loans.filter(
    (loan) => loan.status === "active"
  );

  const expensesForMonth = activeExpenses
    .map((expense) => ({
      expense,
      installment: getInstallmentForMonth(
        expense,
        selectedMonth
      ),
    }))
    .filter(
      (
        item
      ): item is {
        expense: CreditCardExpense;
        installment: number;
      } => item.installment !== null
    );

  const loansForMonth = activeLoans
    .map((loan) => ({
      loan,
      installment: getLoanInstallmentForMonth(
        loan,
        selectedMonth
      ),
    }))
    .filter(
      (
        item
      ): item is {
        loan: Loan;
        installment: number;
      } => item.installment !== null
    );

  const totalForMonth = expensesForMonth.reduce(
    (total, item) =>
      total + item.expense.monthlyAmount,
    0
  );

  const totalLoansForMonth = loansForMonth.reduce(
    (total, item) =>
      total + item.loan.monthlyPayment,
    0
  );

  const totalMonthlyCommitment =
    totalForMonth + totalLoansForMonth;

  const projectionMonths = Array.from(
  { length: 12 },
  (_, index) =>
    addMonthsToMonthKey(selectedMonth, index)
);

const projectionRows = projectionMonths.map(
  (month) => {
    const cardsTotal = activeExpenses.reduce(
      (total, expense) => {
        const installment =
          getInstallmentForMonth(expense, month);

        return installment !== null
          ? total + expense.monthlyAmount
          : total;
      },
      0
    );

    const loansTotal = activeLoans.reduce(
      (total, loan) => {
        const installment =
          getLoanInstallmentForMonth(loan, month);

        return installment !== null
          ? total + loan.monthlyPayment
          : total;
      },
      0
    );

    const cardsEnding = activeExpenses.filter(
      (expense) =>
        getInstallmentForMonth(expense, month) ===
        expense.installments
    ).length;

    const loansEnding = activeLoans.filter(
      (loan) =>
        getLoanInstallmentForMonth(loan, month) ===
        loan.totalInstallments
    ).length;

    return {
      month,
      cardsTotal,
      loansTotal,
      total: cardsTotal + loansTotal,
      endingCount: cardsEnding + loansEnding,
    };
  }
);  
  const cardGroups = Object.values(
    activeExpenses.reduce<
      Record<
        string,
        {
          key: string;
          bank: string;
          cardName: string;
          expenses: CreditCardExpense[];
        }
      >
    >((groups, expense) => {
      const key = `${expense.bank}__${expense.cardName}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          bank: expense.bank,
          cardName: expense.cardName,
          expenses: [],
        };
      }

      groups[key].expenses.push(expense);

      return groups;
    }, {})
  );

  const [showFixedConceptForm, setShowFixedConceptForm] =
  useState(false);
  const [fixedConceptName, setFixedConceptName] =
  useState("");

  const budgetDragSensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6,
    },
  })
);

const [editingBudgetConceptId, setEditingBudgetConceptId] =
  useState<string | null>(null);

const [budgetAmountInput, setBudgetAmountInput] =
  useState("");

  async function saveFixedConcept(
  event: FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  const name = fixedConceptName.trim();

  if (!name) return;

  await db.budgetConcepts.add({
    id: createId(),
    name,
    type: "fixed",
    status: "active",
  });

  setFixedConceptName("");
  setShowFixedConceptForm(false);
}

  async function deleteExpense(id: string) {
    await db.creditCardExpenses.delete(id);
  }

  async function finishExpense(
    expense: CreditCardExpense
  ) {
    await db.creditCardExpenses.update(expense.id, {
      status: "finished",
    });
  }

  async function deleteLoan(id: string) {
    await db.loans.delete(id);
  }

  async function finishLoan(loan: Loan) {
    await db.loans.update(loan.id, {
      status: "finished",
    });
  }

async function handleFixedConceptDragEnd(
  event: DragEndEvent
) {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  const oldIndex = fixedBudgetConcepts.findIndex(
    (concept) => concept.id === active.id
  );

  const newIndex = fixedBudgetConcepts.findIndex(
    (concept) => concept.id === over.id
  );

  if (oldIndex === -1 || newIndex === -1) return;

  const reorderedConcepts = arrayMove(
    fixedBudgetConcepts,
    oldIndex,
    newIndex
  );

  await db.transaction(
    "rw",
    db.budgetConcepts,
    async () => {
      await Promise.all(
        reorderedConcepts.map((concept, index) =>
          db.budgetConcepts.update(concept.id, {
            sortOrder: index,
          })
        )
      );
    }
  );
}

function openBudgetAmountEditor(
  concept: BudgetConcept
) {
  const currentAmount = monthlyBudgetAmounts.find(
    (item) => item.conceptId === concept.id
  );

  setEditingBudgetConceptId(concept.id);

  setBudgetAmountInput(
    currentAmount
      ? String(currentAmount.budgetedAmount)
      : ""
  );
}


async function saveBudgetAmount(
  event: FormEvent<HTMLFormElement>,
  concept: BudgetConcept
) {
  event.preventDefault();

  const amount =
    budgetAmountInput.trim() === ""
      ? 0
      : Number(budgetAmountInput);

  if (Number.isNaN(amount) || amount < 0) return;

  const existingAmount =
    await db.monthlyBudgetAmounts
      .where("[conceptId+month]")
      .equals([concept.id, selectedMonth])
      .first();

  await db.monthlyBudgetAmounts.put({
    id: existingAmount?.id ?? createId(),
    conceptId: concept.id,
    month: selectedMonth,
    budgetedAmount: amount,
    actualAmount: existingAmount?.actualAmount ?? 0,
  });

  setEditingBudgetConceptId(null);
  setBudgetAmountInput("");
}

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-3xl bg-slate-900 p-5 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Finanzas
          </p>

          <h1 className="mt-1 text-2xl font-bold">
            Tarjetas y créditos
          </h1>

          <p className="mt-1 text-sm text-slate-300">
            Control simple de cuotas y compromisos mensuales.
          </p>
        </header>

        <nav className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur">
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => setActiveView("summary")}
              className={`rounded-xl px-1 py-3 text-[11px] sm:px-2 sm:text-sm font-semibold ${
                activeView === "summary"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Resumen
            </button>

            <button
  type="button"
  onClick={() => setActiveView("budget")}
  className={`rounded-xl px-1 py-3 text-[11px] sm:px-2 sm:text-sm font-semibold sm:px-2 sm:text-sm ${
    activeView === "budget"
      ? "bg-slate-900 text-white"
      : "text-slate-500 hover:bg-slate-100"
  }`}
>
  Presupuesto
</button>

            <button
              type="button"
              onClick={() => setActiveView("cards")}
              className={`rounded-xl px-1 py-3 text-[11px] sm:px-2 sm:text-sm font-semibold ${
                activeView === "cards"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Tarjetas
            </button>

            <button
              type="button"
              onClick={() => setActiveView("loans")}
              className={`rounded-xl px-1 py-3 text-[11px] sm:px-2 sm:text-sm font-semibold ${
                activeView === "loans"
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              Créditos
            </button>

            <button
  type="button"
  onClick={() => setActiveView("projection")}
  className={`rounded-xl px-1 py-3 text-[11px] sm:px-2 sm:text-sm font-semibold sm:text-sm ${
    activeView === "projection"
      ? "bg-slate-900 text-white"
      : "text-slate-500 hover:bg-slate-100"
  }`}
>
  Proyección
</button>
          </div>
        </nav>

        {activeView === "summary" && (
          <section className="space-y-3">
            <div className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
              <p className="text-sm text-slate-300">
                Compromiso total en{" "}
                {formatMonth(selectedMonth)}
              </p>

              <p className="mt-1 text-3xl font-bold">
                {formatMoney(totalMonthlyCommitment)}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">
                    Tarjetas
                  </p>

                  <p className="mt-1 font-bold">
                    {formatMoney(totalForMonth)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-3">
                  <p className="text-xs text-slate-300">
                    Créditos
                  </p>

                  <p className="mt-1 font-bold">
                    {formatMoney(totalLoansForMonth)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="text-sm font-medium text-slate-600">
                Revisar otro mes
              </label>

              <input
                type="month"
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
              />
            </div>
            <BackupSection />
          </section>
        )}

        {activeView === "budget" && (
  <section className="space-y-3">
    <div>
      <h2 className="text-xl font-bold text-slate-900">
        Presupuesto mensual
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Planificá gastos fijos, variables, ahorro e inversión.
      </p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
  <label className="block">
    <span className="text-sm font-semibold text-slate-700">
      Mes de presupuesto
    </span>

    <input
      type="month"
      value={selectedMonth}
      onChange={(event) =>
        setSelectedMonth(event.target.value)
      }
      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
    />
  </label>
</div>
    </div>

    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex items-center justify-between gap-3">
    <div>
      <h3 className="font-bold text-slate-900">
        Gastos fijos
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {fixedBudgetConcepts.length}{" "}
        {fixedBudgetConcepts.length === 1
          ? "concepto activo"
          : "conceptos activos"}
      </p>

      <p className="mt-2 text-lg font-bold text-slate-900">
  {formatMoney(fixedBudgetTotal)}
</p>

<p className="text-xs text-slate-500">
  Total presupuestado del mes
</p>
    </div>

    <button
      type="button"
      onClick={() =>
        setShowFixedConceptForm(!showFixedConceptForm)
      }
      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
    >
      {showFixedConceptForm
        ? "Cerrar"
        : "+ Nuevo concepto"}
    </button>
  </div>

  {showFixedConceptForm && (
    <form
      onSubmit={saveFixedConcept}
      className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
    >
      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Nombre del gasto fijo
        </span>

        <input
          type="text"
          value={fixedConceptName}
          onChange={(event) =>
            setFixedConceptName(event.target.value)
          }
          placeholder="Ej: Alquiler"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
        />
      </label>

      <button
        type="submit"
        className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
      >
        Guardar concepto
      </button>
    </form>
  )}

{fixedBudgetConcepts.length > 0 && (
  <DndContext
    sensors={budgetDragSensors}
    collisionDetection={closestCenter}
    onDragEnd={handleFixedConceptDragEnd}
  >
    <SortableContext
      items={fixedBudgetConcepts.map(
        (concept) => concept.id
      )}
      strategy={verticalListSortingStrategy}
    >
      <div className="mt-4 space-y-2">
        {fixedBudgetConcepts.map((concept) => (
          <SortableBudgetConcept
  key={concept.id}
  concept={concept}
  amount={
    monthlyBudgetAmounts.find(
      (item) => item.conceptId === concept.id
    )?.budgetedAmount ?? 0
  }
onEdit={() => openBudgetAmountEditor(concept)}
/>
        ))}
      </div>
    </SortableContext>
  </DndContext>
)}

{editingBudgetConceptId && (
  <form
    onSubmit={(event) => {
      const concept = fixedBudgetConcepts.find(
        (item) =>
          item.id === editingBudgetConceptId
      );

      if (concept) {
        saveBudgetAmount(event, concept);
      }
    }}
    className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
  >
    <p className="text-sm font-semibold text-slate-900">
      {
        fixedBudgetConcepts.find(
          (item) =>
            item.id === editingBudgetConceptId
        )?.name
      }
    </p>

    <p className="mt-1 text-xs text-slate-500">
      {formatMonth(selectedMonth)}
    </p>

    <input
      type="number"
      min="0"
      step="1"
      value={budgetAmountInput}
      onChange={(event) =>
        setBudgetAmountInput(event.target.value)
      }
      placeholder="Monto presupuestado"
      autoFocus
      className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none"
    />

    <div className="mt-3 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => {
          setEditingBudgetConceptId(null);
          setBudgetAmountInput("");
        }}
        className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
      >
        Cancelar
      </button>

      <button
        type="submit"
        className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
      >
        Guardar monto
      </button>
    </div>
  </form>
)}

  {fixedBudgetConcepts.length === 0 && (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">
        Todavía no tenés gastos fijos cargados.
      </p>
    </div>
  )}
</div>

<div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex items-center justify-between gap-3">
    <div>
      <h3 className="font-bold text-slate-900">
        Gastos variables
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {variableBudgetConcepts.length}{" "}
        {variableBudgetConcepts.length === 1
          ? "concepto activo"
          : "conceptos activos"}
      </p>

      <p className="mt-2 text-lg font-bold text-slate-900">
        {formatMoney(variableBudgetTotal)}
      </p>

      <p className="text-xs text-slate-500">
        Total presupuestado del mes
      </p>
    </div>
  </div>

  {variableBudgetConcepts.length === 0 && (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">
        Todavía no tenés gastos variables cargados.
      </p>
    </div>
  )}
</div>

  </section>
)}
        
        {activeView === "projection" && (
  <section className="space-y-3">
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Próximos 12 meses
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Tarjetas + créditos proyectados mes a mes.
        </p>
      </div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-sm font-medium text-slate-600">
        Proyectar desde
      </label>

      <input
        type="month"
        value={selectedMonth}
        onChange={(event) =>
          setSelectedMonth(event.target.value)
        }
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-slate-500"
      />
    </div>

    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {projectionRows.map((row, index) => (
        <div
          key={row.month}
          className={`px-4 py-3 ${
            index !== projectionRows.length - 1
              ? "border-b border-slate-100"
              : ""
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold capitalize text-slate-900">
                {formatMonth(row.month)}
              </p>

              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                <span>
                  Tarjetas {formatMoney(row.cardsTotal)}
                </span>

                <span>
                  Créditos {formatMoney(row.loansTotal)}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xs text-slate-400">
                Total
              </p>

              <p className="text-lg font-bold text-slate-900">
                {formatMoney(row.total)}
              </p>
            </div>
          </div>

          {row.endingCount > 0 && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              🥳 {row.endingCount}{" "}
              {row.endingCount === 1
                ? "compromiso finaliza"
                : "compromisos finalizan"}{" "}
              este mes
            </p>
          )}
        </div>
      ))}
    </div>
  </section>
)}

        {activeView === "cards" && (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    Tarjetas
                  </h2>

                  <p className="text-sm text-slate-500">
                    Compras y cuotas activas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCardForm((current) => !current)
                  }
                  className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  {showCardForm
                    ? "Cerrar"
                    : "+ Nueva compra"}
                </button>
              </div>

              {showCardForm && <CardForm />}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">
                Mis tarjetas
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Tocá una tarjeta para ver sus compras.
              </p>

              {cardGroups.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Todavía no registraste compras.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {cardGroups.map((group) => {
                    const isExpanded =
                      expandedCardGroup === group.key;

                    const expensesThisMonth =
                      group.expenses
                        .map((expense) => ({
                          expense,
                          installment:
                            getInstallmentForMonth(
                              expense,
                              selectedMonth
                            ),
                        }))
                        .filter(
                          (item) =>
                            item.installment !== null
                        );

                    const totalThisMonth =
                      expensesThisMonth.reduce(
                        (total, item) =>
                          total +
                          item.expense.monthlyAmount,
                        0
                      );

                    return (
                      <div
                        key={group.key}
                        className="overflow-hidden rounded-2xl border border-slate-200"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCardGroup(
                              isExpanded
                                ? null
                                : group.key
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {group.bank} ·{" "}
                              {group.cardName}
                            </p>

                            <p className="text-xs text-slate-500">
                              {group.expenses.length}{" "}
                              {group.expenses.length === 1
                                ? "compra activa"
                                : "compras activas"}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm font-bold">
                                {formatMoney(
                                  totalThisMonth
                                )}
                              </p>

                              <p className="text-xs text-slate-400">
                                este mes
                              </p>
                            </div>

                            {isExpanded ? (
                              <ChevronUp
                                size={18}
                                className="text-slate-400"
                              />
                            ) : (
                              <ChevronDown
                                size={18}
                                className="text-slate-400"
                              />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 p-2">
                            <div className="space-y-1">
                              {group.expenses.map(
                                (expense) => {
                                  const installment =
                                    getInstallmentForMonth(
                                      expense,
                                      selectedMonth
                                    );

                                  return (
                                    <div
                                      key={expense.id}
                                      className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">
                                          {
                                            expense.description
                                          }
                                          <span className="font-normal text-slate-400">
                                            {" "}
                                            ·{" "}
                                            {
                                              expense.category
                                            }
                                          </span>
                                        </p>

                                        <p className="text-xs text-slate-500">
                                          {installment !==
                                          null
                                            ? `Cuota ${installment}/${expense.installments}`
                                            : "No impacta este mes"}
                                        </p>
                                      </div>

                                      <p className="shrink-0 text-sm font-bold">
                                        {formatMoney(
                                          expense.monthlyAmount
                                        )}
                                      </p>

                                      <div className="flex shrink-0 gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            finishExpense(
                                              expense
                                            )
                                          }
                                          title="Finalizar compra"
                                          aria-label="Finalizar compra"
                                          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                                        >
                                          <Check
                                            size={15}
                                          />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteExpense(
                                              expense.id
                                            )
                                          }
                                          title="Eliminar compra"
                                          aria-label="Eliminar compra"
                                          className="rounded-full p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                                        >
                                          <Trash2
                                            size={15}
                                          />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeView === "loans" && (
          <>
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    Créditos
                  </h2>

                  <p className="text-sm text-slate-500">
                    Préstamos y financiaciones activas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowLoanForm((current) => !current)
                  }
                  className="shrink-0 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                >
                  {showLoanForm
                    ? "Cerrar"
                    : "+ Nuevo crédito"}
                </button>
              </div>

              {showLoanForm && <LoanForm />}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold">
                Mis créditos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Tocá un crédito para ver más información.
              </p>

              {activeLoans.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  Todavía no registraste créditos.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {activeLoans.map((loan) => {
                    const isExpanded =
                      expandedLoanId === loan.id;

                    const installment =
                      getLoanInstallmentForMonth(
                        loan,
                        selectedMonth
                      );

                    const remainingInstallments =
                      Math.max(
                        loan.totalInstallments -
                          loan.currentInstallment +
                          1,
                        0
                      );

                    const estimatedRemaining =
                      remainingInstallments *
                      loan.monthlyPayment;

                    return (
                      <div
                        key={loan.id}
                        className="overflow-hidden rounded-2xl border border-slate-200"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLoanId(
                              isExpanded
                                ? null
                                : loan.id
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {loan.description}
                            </p>

                            <p className="text-xs text-slate-500">
                              {loan.bank}
                            </p>

                            <p className="text-xs text-slate-500">
                              {installment !== null
                                ? `Cuota ${installment}/${loan.totalInstallments}`
                                : `Cuota actual ${loan.currentInstallment}/${loan.totalInstallments}`}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right">
                              <p className="text-sm font-bold">
                                {formatMoney(
                                  loan.monthlyPayment
                                )}
                              </p>

                              <p className="text-xs text-slate-400">
                                por mes
                              </p>
                            </div>

                            {isExpanded ? (
                              <ChevronUp
                                size={18}
                                className="text-slate-400"
                              />
                            ) : (
                              <ChevronDown
                                size={18}
                                className="text-slate-400"
                              />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5">
                            <div className="flex items-end justify-between gap-3">
                              <div className="min-w-0 text-xs text-slate-500">
                                <p>
                                  Inicial:{" "}
                                  {formatMoney(
                                    loan.initialAmount
                                  )}
                                </p>

                                <p className="mt-0.5">
                                  Pendiente aprox.:{" "}
                                  {formatMoney(
                                    estimatedRemaining
                                  )}
                                </p>

                                <p className="mt-0.5 text-slate-400">
                                  Referencia:{" "}
                                  {formatMonth(
                                    loan.currentInstallmentMonth
                                  )}
                                </p>
                              </div>

                              <div className="flex shrink-0 gap-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    finishLoan(loan)
                                  }
                                  title="Finalizar crédito"
                                  aria-label="Finalizar crédito"
                                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                                >
                                  <Check size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteLoan(loan.id)
                                  }
                                  title="Eliminar crédito"
                                  aria-label="Eliminar crédito"
                                  className="rounded-full p-2 text-red-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <p className="pb-8 text-center text-xs text-slate-400">
          Los datos se guardan localmente en este dispositivo.
        </p>
      </div>
    </main>
  );
}

export default App;