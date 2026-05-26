import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  Landmark,
  Lock,
  LogOut,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  X
} from "lucide-react";
import "./styles.css";

type Account = {
  id: number;
  initial_balance: string;
  expected_annual_return_rate: string;
};

type Child = {
  id: number;
  first_name: string;
  college_start_date: string;
  college_end_date: string;
  account: Account;
};

type RegistryRow = {
  date: string;
  description: string;
  type: string;
  deposit_amount: string;
  expense_amount: string;
  investment_income_amount: string;
  running_balance: string;
  source_schedule_id: number | null;
  source_schedule_kind: "deposit" | "expense" | null;
  original_date: string | null;
  override_id: number | null;
};

type RegistryGroup = {
  period: string;
  total_deposits: string;
  total_expenses: string;
  total_investment_income: string;
  ending_balance: string;
};

type ScheduleKind = "deposits" | "expenses";

type Schedule = {
  id: number;
  account_id: number;
  start_date: string;
  end_date: string;
  amount: string;
  description: string;
  frequency: string;
  recurrence: Record<string, unknown>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const frequencyOptions = [
  { value: "one_time", label: "One Time" },
  { value: "monthly", label: "Monthly" },
  { value: "every_two_weeks", label: "Every two weeks" },
  { value: "semi_monthly", label: "Semi-monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "semi_yearly", label: "Semi-yearly" }
];

function money(value: string | number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

async function api<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail ?? "Request failed");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("collegePlannerToken"));
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");

  function saveToken(value: string) {
    localStorage.setItem("collegePlannerToken", value);
    setToken(value);
  }

  if (!token) {
    return (
      <AuthShell
        mode={mode}
        setMode={setMode}
        onToken={saveToken}
        error={error}
        setError={setError}
      />
    );
  }

  return <PlannerApp token={token} onLogout={() => {
    localStorage.removeItem("collegePlannerToken");
    setToken(null);
  }} />;
}

function AuthShell({
  mode,
  setMode,
  onToken,
  error,
  setError
}: {
  mode: "login" | "register";
  setMode: (mode: "login" | "register") => void;
  onToken: (token: string) => void;
  error: string;
  setError: (error: string) => void;
}) {
  const [form, setForm] = useState({
    email: "admin@example.com",
    first_name: "",
    last_name: "",
    password: "ChangeM3!"
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "register") {
        await api("/api/auth/register", null, {
          method: "POST",
          body: JSON.stringify(form)
        });
      }
      const login = await api<{ access_token: string; force_password_reset: boolean }>(
        "/api/auth/login",
        null,
        { method: "POST", body: JSON.stringify({ email: form.email, password: form.password }) }
      );
      onToken(login.access_token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in");
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="brand-mark">
          <Landmark aria-hidden="true" />
        </div>
        <h1 id="auth-title">College Planner</h1>
        <p>Plan deposits, expenses, investment income, and future tuition pressure in one private account.</p>
        <form onSubmit={submit} className="stack">
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          {mode === "register" && (
            <div className="split">
              <label>
                First name
                <input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
              </label>
              <label>
                Last name
                <input value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
              </label>
            </div>
          )}
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">
            {mode === "login" ? <Lock size={18} /> : <UserPlus size={18} />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button className="link-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Register a new account" : "Use an existing account"}
        </button>
      </section>
    </main>
  );
}

function PlannerApp({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [registry, setRegistry] = useState<{ rows: RegistryRow[]; groups: RegistryGroup[] }>({ rows: [], groups: [] });
  const [grouping, setGrouping] = useState("none");
  const [rowType, setRowType] = useState("");
  const [description, setDescription] = useState("");
  const [dateSort, setDateSort] = useState<"date_asc" | "date_desc">("date_asc");
  const [balanceForm, setBalanceForm] = useState({
    adjustment_date: new Date().toISOString().slice(0, 10),
    balance: "",
    description: "Actual balance adjustment"
  });
  const [status, setStatus] = useState("");
  const selected = children.find((child) => child.id === selectedId) ?? children[0];

  async function loadChildren() {
    const data = await api<Child[]>("/api/children", token);
    setChildren(data);
    if (!selectedId && data.length) {
      setSelectedId(data[0].id);
    }
    return data;
  }

  async function loadRegistry() {
    if (!selected) return;
    const query = new URLSearchParams({
      start_date: "2026-01-01",
      end_date: selected.college_end_date,
      grouping,
      sort: dateSort
    });
    if (rowType) query.set("row_type", rowType);
    if (description) query.set("description", description);
    const data = await api<{ rows: RegistryRow[]; groups: RegistryGroup[] }>(
      `/api/registry/${selected.account.id}?${query}`,
      token
    );
    setRegistry(data);
  }

  useEffect(() => {
    loadChildren().catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    loadRegistry().catch((err) => setStatus(err.message));
  }, [selected?.id, selected?.college_end_date, grouping, rowType, dateSort]);

  const totals = useMemo(() => {
    const rows = registry.rows;
    const endingRow = dateSort === "date_asc" ? rows[rows.length - 1] : rows[0];
    return {
      deposits: rows.reduce((sum, row) => sum + Number(row.deposit_amount), 0),
      expenses: rows.reduce((sum, row) => sum + Number(row.expense_amount), 0),
      income: rows.reduce((sum, row) => sum + Number(row.investment_income_amount), 0),
      balance: endingRow?.running_balance ?? selected?.account.initial_balance ?? "0"
    };
  }, [dateSort, registry.rows, selected]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <Landmark aria-hidden="true" />
          <span>College Planner</span>
        </div>
        <ChildForm token={token} onCreated={loadChildren} />
        <nav className="child-list" aria-label="Children">
          {children.map((child) => (
            <button
              key={child.id}
              className={child.id === selected?.id ? "active" : ""}
              onClick={() => setSelectedId(child.id)}
            >
              <CalendarDays size={18} />
              <span>{child.first_name}</span>
            </button>
          ))}
        </nav>
        {selected && <ForecastPanel token={token} accountId={selected.account.id} />}
        <button className="ghost signout-button" onClick={onLogout}>
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Projected account</p>
            <h1>{selected ? `${selected.first_name}'s college plan` : "Create a child to begin"}</h1>
          </div>
          <button className="secondary" onClick={() => loadRegistry()}>
            <RefreshCcw size={18} /> Refresh
          </button>
        </header>
        {selected && (
          <>
            <section className="metrics-grid" aria-label="Account totals">
              <Metric icon={<PiggyBank />} label="Projected balance" value={money(totals.balance)} />
              <Metric icon={<Plus />} label="Deposits" value={money(totals.deposits)} />
              <Metric icon={<BarChart3 />} label="Investment income" value={money(totals.income)} />
              <Metric icon={<Landmark />} label="Expenses" value={money(totals.expenses)} />
            </section>
            <ChildDatesForm
              child={selected}
              token={token}
              onSaved={async () => {
                await loadChildren();
              }}
            />
            <SchedulePanel token={token} accountId={selected.account.id} onSaved={loadRegistry} />
            <section className="registry-panel">
              <div className="panel-heading">
                <h2>Registry</h2>
                <div className="toolbar">
                  <select value={grouping} onChange={(event) => setGrouping(event.target.value)} aria-label="Grouping">
                    <option value="none">Rows</option>
                    <option value="month">Month</option>
                    <option value="quarter">Quarter</option>
                    <option value="year">Year</option>
                  </select>
                  <select value={rowType} onChange={(event) => setRowType(event.target.value)} aria-label="Row type">
                    <option value="">All types</option>
                    <option value="deposit">Deposits</option>
                    <option value="expense">Expenses</option>
                    <option value="investment_income">Income</option>
                  </select>
                  <label className="search-field">
                    <Search size={16} />
                    <input value={description} onChange={(event) => setDescription(event.target.value)} onBlur={loadRegistry} placeholder="Description" />
                  </label>
                </div>
              </div>
              <form className="balance-adjustment-form" onSubmit={async (event) => {
                event.preventDefault();
                await api(`/api/registry/${selected.account.id}/balance-adjustments`, token, {
                  method: "POST",
                  body: JSON.stringify(balanceForm)
                });
                setBalanceForm({ ...balanceForm, balance: "" });
                await loadRegistry();
              }}>
                <label>Actual date<input type="date" value={balanceForm.adjustment_date} onChange={(event) => setBalanceForm({ ...balanceForm, adjustment_date: event.target.value })} /></label>
                <label>Actual balance<input type="number" value={balanceForm.balance} onChange={(event) => setBalanceForm({ ...balanceForm, balance: event.target.value })} /></label>
                <label>Description<input value={balanceForm.description} onChange={(event) => setBalanceForm({ ...balanceForm, description: event.target.value })} /></label>
                <button className="secondary" type="submit"><Save size={16} /> Set balance</button>
              </form>
              <RegistryTable
                rows={registry.rows}
                groups={registry.groups}
                dateSort={dateSort}
                onDateSortChange={() => setDateSort(dateSort === "date_asc" ? "date_desc" : "date_asc")}
                accountId={selected.account.id}
                token={token}
                onSaved={loadRegistry}
              />
            </section>
          </>
        )}
        {status && <p className="error">{status}</p>}
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChildForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", college_start_date: "", initial_balance: "0" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api("/api/children", token, { method: "POST", body: JSON.stringify(form) });
    setForm({ first_name: "", college_start_date: "", initial_balance: "0" });
    setOpen(false);
    onCreated();
  }

  if (!open) {
    return <button className="primary full" onClick={() => setOpen(true)}><Plus size={18} /> Add child</button>;
  }

  return (
    <form className="mini-form" onSubmit={submit}>
      <label>First name<input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
      <label>College start<input type="date" value={form.college_start_date} onChange={(event) => setForm({ ...form, college_start_date: event.target.value })} /></label>
      <label>Initial savings<input type="number" value={form.initial_balance} onChange={(event) => setForm({ ...form, initial_balance: event.target.value })} /></label>
      <button className="primary" type="submit"><Plus size={18} /> Save child</button>
    </form>
  );
}

function ChildDatesForm({ child, token, onSaved }: { child: Child; token: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    college_start_date: child.college_start_date,
    college_end_date: child.college_end_date
  });

  useEffect(() => {
    setForm({
      college_start_date: child.college_start_date,
      college_end_date: child.college_end_date
    });
  }, [child.id, child.college_start_date, child.college_end_date]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api(`/api/children/${child.id}`, token, {
      method: "PATCH",
      body: JSON.stringify(form)
    });
    await onSaved();
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>College dates</h2>
      </div>
      <form className="child-date-form" onSubmit={submit}>
        <label>Start date<input type="date" value={form.college_start_date} onChange={(event) => setForm({ ...form, college_start_date: event.target.value })} /></label>
        <label>End date<input type="date" value={form.college_end_date} onChange={(event) => setForm({ ...form, college_end_date: event.target.value })} /></label>
        <button className="secondary" type="submit"><Save size={16} /> Save dates</button>
      </form>
    </section>
  );
}

function recurrenceFor(frequency: string) {
  if (frequency === "semi_yearly") {
    return { months: [1, 8], day: 1 };
  }
  if (frequency === "semi_monthly") {
    return { days: [1, 15] };
  }
  return {};
}

function SchedulePanel({ token, accountId, onSaved }: { token: string; accountId: number; onSaved: () => void }) {
  const [kind, setKind] = useState<ScheduleKind>("deposits");
  const [deposits, setDeposits] = useState<Schedule[]>([]);
  const [expenses, setExpenses] = useState<Schedule[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    start_date: "",
    end_date: "",
    amount: "",
    description: "",
    frequency: "monthly"
  });
  const [form, setForm] = useState({
    start_date: "2026-01-01",
    end_date: "2026-12-31",
    amount: "100",
    description: "",
    frequency: "monthly"
  });
  async function loadSchedules() {
    const [depositRows, expenseRows] = await Promise.all([
      api<Schedule[]>(`/api/schedules/deposits?account_id=${accountId}`, token),
      api<Schedule[]>(`/api/schedules/expenses?account_id=${accountId}`, token)
    ]);
    setDeposits(depositRows);
    setExpenses(expenseRows);
  }

  useEffect(() => {
    loadSchedules().catch(() => undefined);
    setEditingKey(null);
  }, [accountId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const scheduleBody = {
      ...form,
      end_date: form.frequency === "one_time" ? form.start_date : form.end_date,
      account_id: accountId,
      recurrence: recurrenceFor(form.frequency)
    };
    await api(`/api/schedules/${kind}`, token, {
      method: "POST",
      body: JSON.stringify(scheduleBody)
    });
    setForm({ ...form, description: "" });
    await loadSchedules();
    onSaved();
  }

  function startEditing(schedule: Schedule, scheduleKind: ScheduleKind) {
    setEditingKey(`${scheduleKind}-${schedule.id}`);
    setEditForm({
      start_date: schedule.start_date,
      end_date: schedule.end_date,
      amount: schedule.amount,
      description: schedule.description,
      frequency: schedule.frequency
    });
  }

  async function saveSchedule(schedule: Schedule, scheduleKind: ScheduleKind) {
    const scheduleBody = {
      ...editForm,
      end_date: editForm.frequency === "one_time" ? editForm.start_date : editForm.end_date,
      recurrence: recurrenceFor(editForm.frequency)
    };
    await api(`/api/schedules/${scheduleKind}/${schedule.id}`, token, {
      method: "PATCH",
      body: JSON.stringify(scheduleBody)
    });
    setEditingKey(null);
    await loadSchedules();
    onSaved();
  }

  async function deleteSchedule(schedule: Schedule, scheduleKind: ScheduleKind) {
    await api(`/api/schedules/${scheduleKind}/${schedule.id}`, token, { method: "DELETE" });
    if (editingKey === `${scheduleKind}-${schedule.id}`) {
      setEditingKey(null);
    }
    await loadSchedules();
    onSaved();
  }

  return (
    <section className="panel schedule-workspace">
      <div className="panel-heading">
        <h2>Recurring deposits and expenses</h2>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>Type<select value={kind} onChange={(event) => setKind(event.target.value as ScheduleKind)}>
          <option value="deposits">Deposit</option>
          <option value="expenses">Expense</option>
        </select></label>
        <label>Frequency<select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
          {frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label>Start<input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label>
        {form.frequency !== "one_time" && (
          <label>End<input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></label>
        )}
        <label>Amount<input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="wide">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <button className="primary wide" type="submit"><Plus size={18} /> Add schedule</button>
      </form>
      <div className="schedule-list-grid" aria-live="polite">
        <ScheduleList
          title="Recurring deposits"
          kind="deposits"
          schedules={deposits}
          editingKey={editingKey}
          editForm={editForm}
          setEditForm={setEditForm}
          startEditing={startEditing}
          saveSchedule={saveSchedule}
          deleteSchedule={deleteSchedule}
          cancelEditing={() => setEditingKey(null)}
        />
        <ScheduleList
          title="Recurring expenses"
          kind="expenses"
          schedules={expenses}
          editingKey={editingKey}
          editForm={editForm}
          setEditForm={setEditForm}
          startEditing={startEditing}
          saveSchedule={saveSchedule}
          deleteSchedule={deleteSchedule}
          cancelEditing={() => setEditingKey(null)}
        />
      </div>
    </section>
  );
}

function ScheduleList({
  title,
  kind,
  schedules,
  editingKey,
  editForm,
  setEditForm,
  startEditing,
  saveSchedule,
  deleteSchedule,
  cancelEditing
}: {
  title: string;
  kind: ScheduleKind;
  schedules: Schedule[];
  editingKey: string | null;
  editForm: {
    start_date: string;
    end_date: string;
    amount: string;
    description: string;
    frequency: string;
  };
  setEditForm: (form: {
    start_date: string;
    end_date: string;
    amount: string;
    description: string;
    frequency: string;
  }) => void;
  startEditing: (schedule: Schedule, kind: ScheduleKind) => void;
  saveSchedule: (schedule: Schedule, kind: ScheduleKind) => void;
  deleteSchedule: (schedule: Schedule, kind: ScheduleKind) => void;
  cancelEditing: () => void;
}) {
  return (
    <div className="schedule-list">
      <h3>{title}</h3>
      {schedules.length === 0 && <p className="empty-state">No {kind === "deposits" ? "deposits" : "expenses"} created yet.</p>}
      {schedules.map((schedule) => {
        const key = `${kind}-${schedule.id}`;
        const isEditing = editingKey === key;
        return (
          <article className="schedule-row" key={key}>
            {isEditing ? (
              <div className="schedule-edit-grid">
                <label>Description<input value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></label>
                <label>Frequency<select value={editForm.frequency} onChange={(event) => setEditForm({ ...editForm, frequency: event.target.value })}>
                  {frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select></label>
                <label>Amount<input type="number" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} /></label>
                <label>Start<input type="date" value={editForm.start_date} onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })} /></label>
                {editForm.frequency !== "one_time" && (
                  <label>End<input type="date" value={editForm.end_date} onChange={(event) => setEditForm({ ...editForm, end_date: event.target.value })} /></label>
                )}
                <div className="schedule-actions">
                  <button className="secondary" type="button" onClick={() => saveSchedule(schedule, kind)}><Save size={16} /> Save</button>
                  <button className="ghost" type="button" onClick={cancelEditing}><X size={16} /> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <strong>{schedule.description}</strong>
                  <span>{scheduleDateSummary(schedule)}</span>
                </div>
                <div className="schedule-summary">
                  <strong className={kind === "expenses" ? "expense-text" : ""}>{money(schedule.amount)}</strong>
                  <button className="icon-button" type="button" aria-label={`Edit ${schedule.description}`} onClick={() => startEditing(schedule, kind)}><Pencil size={16} /></button>
                  <button className="icon-button danger" type="button" aria-label={`Delete ${schedule.description}`} onClick={() => deleteSchedule(schedule, kind)}><Trash2 size={16} /></button>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}

function scheduleDateSummary(schedule: Schedule) {
  const frequency = schedule.frequency.replace(/_/g, " ");
  if (schedule.frequency === "one_time") {
    return `${schedule.start_date} · ${frequency}`;
  }
  return `${schedule.start_date} to ${schedule.end_date} · ${frequency}`;
}

function ForecastPanel({ token, accountId }: { token: string; accountId: number }) {
  const [yearlyCost, setYearlyCost] = useState("30000");
  const [selectedMonthly, setSelectedMonthly] = useState("");
  const [result, setResult] = useState<{ recommended_monthly_contribution: string; projected_shortfall: string; commentary: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const data = await api<typeof result>("/api/forecast", token, {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        yearly_college_cost: yearlyCost,
        existing_savings: "0",
        yearly_contribution: "0",
        expected_annual_return_rate: "0.06",
        user_selected_monthly_contribution: selectedMonthly || null
      })
    });
    setResult(data);
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Forecast</h2>
        <Sparkles aria-hidden="true" />
      </div>
      <form className="stack" onSubmit={submit}>
        <label>Yearly college cost<input type="number" value={yearlyCost} onChange={(event) => setYearlyCost(event.target.value)} /></label>
        <label>Affordable monthly amount<input type="number" value={selectedMonthly} onChange={(event) => setSelectedMonthly(event.target.value)} /></label>
        <button className="secondary" type="submit"><Sparkles size={18} /> Forecast</button>
      </form>
      {result && (
        <div className="forecast-result">
          <strong>{money(result.recommended_monthly_contribution)} / month</strong>
          <span>Shortfall: {money(result.projected_shortfall)}</span>
          <p>{result.commentary}</p>
        </div>
      )}
    </section>
  );
}

function RegistryTable({
  rows,
  groups,
  dateSort,
  onDateSortChange,
  accountId,
  token,
  onSaved
}: {
  rows: RegistryRow[];
  groups: RegistryGroup[];
  dateSort: "date_asc" | "date_desc";
  onDateSortChange: () => void;
  accountId: number;
  token: string;
  onSaved: () => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ date: "", amount: "", description: "" });

  function startOccurrenceEdit(row: RegistryRow, index: number) {
    setEditingKey(registryEditKey(row, index));
    setEditForm({
      date: row.date,
      amount: registryRowAmount(row),
      description: row.description
    });
  }

  async function saveOccurrence(row: RegistryRow) {
    if (row.type === "investment_income") {
      await api(`/api/registry/${accountId}/investment-income-overrides`, token, {
        method: "POST",
        body: JSON.stringify({
          income_date: row.date,
          amount: editForm.amount,
          description: editForm.description
        })
      });
      setEditingKey(null);
      await onSaved();
      return;
    }
    if (!row.source_schedule_kind || !row.source_schedule_id || !row.original_date) return;
    await api("/api/schedules/occurrence-overrides", token, {
      method: "POST",
      body: JSON.stringify({
        account_id: accountId,
        schedule_kind: row.source_schedule_kind,
        schedule_id: row.source_schedule_id,
        original_date: row.original_date,
        override_date: editForm.date,
        amount: editForm.amount,
        description: editForm.description
      })
    });
    setEditingKey(null);
    await onSaved();
  }

  if (groups.length) {
    return (
      <table>
        <thead><tr><th>Period</th><th>Deposits</th><th>Expenses</th><th>Income</th><th>Balance</th></tr></thead>
        <tbody>{groups.map((group) => (
          <tr key={group.period}><td>{group.period}</td><td>{money(group.total_deposits)}</td><td className="expense-text">{money(group.total_expenses)}</td><td className="income-text">{money(group.total_investment_income)}</td><td>{money(group.ending_balance)}</td></tr>
        ))}</tbody>
      </table>
    );
  }
  return (
    <table>
      <thead><tr><th><button className="table-sort" type="button" onClick={onDateSortChange}>Date {dateSort === "date_asc" ? "↑" : "↓"}</button></th><th>Description</th><th>Deposit</th><th>Expense</th><th>Income</th><th>Balance</th><th>Adjust</th></tr></thead>
      <tbody>{rows.map((row, index) => {
        const key = registryEditKey(row, index);
        const canEdit = row.type === "deposit" || row.type === "expense" || row.type === "investment_income";
        const isEditing = editingKey === key;
        return (
          <tr className={registryRowClass(row)} key={`${row.date}-${row.description}-${index}`}>
            {isEditing ? (
              <>
                <td><input className="table-input" type="date" value={editForm.date} disabled={row.type === "investment_income"} onChange={(event) => setEditForm({ ...editForm, date: event.target.value })} /></td>
                <td><input className="table-input" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></td>
                <td colSpan={3}><input className="table-input" type="number" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} /></td>
                <td>{money(row.running_balance)}</td>
                <td className="row-actions"><button className="icon-button" type="button" aria-label="Save occurrence" onClick={() => saveOccurrence(row)}><Save size={16} /></button><button className="icon-button" type="button" aria-label="Cancel occurrence edit" onClick={() => setEditingKey(null)}><X size={16} /></button></td>
              </>
            ) : (
              <>
                <td>{row.date}</td><td>{row.description}</td><td>{money(row.deposit_amount)}</td><td>{money(row.expense_amount)}</td><td>{money(row.investment_income_amount)}</td><td>{money(row.running_balance)}</td>
                <td>{canEdit && <button className="icon-button" type="button" aria-label={`Edit ${row.description} on ${row.date}`} onClick={() => startOccurrenceEdit(row, index)}><Pencil size={16} /></button>}</td>
              </>
            )}
          </tr>
        );
      })}</tbody>
    </table>
  );
}

function registryRowClass(row: RegistryRow) {
  const classes = [];
  if (row.type === "investment_income") classes.push("investment-row");
  if (row.type === "expense") classes.push("expense-row");
  if (new Date(`${row.date}T00:00:00`) < startOfToday()) classes.push("past-row");
  return classes.join(" ");
}

function registryEditKey(row: RegistryRow, index: number) {
  if (row.type === "investment_income") {
    return `investment-income-${row.date}-${index}`;
  }
  return `${row.source_schedule_kind}-${row.source_schedule_id}-${row.original_date}-${index}`;
}

function registryRowAmount(row: RegistryRow) {
  if (row.type === "deposit") return row.deposit_amount;
  if (row.type === "expense") return row.expense_amount;
  return row.investment_income_amount;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
