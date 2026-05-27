import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Landmark,
  Lock,
  LogOut,
  Mail,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
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

type UserProfile = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  force_password_reset: boolean;
};

type PlanStatus = "Successful" | "Loans Required" | "Short Fall";

type RegistryRow = {
  date: string;
  description: string;
  type: string;
  amount: string;
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

type RegistryResponse = {
  rows: RegistryRow[];
  groups: RegistryGroup[];
  plan_status: PlanStatus;
};

type ScheduleKind = "deposits" | "expenses";
type ScheduleWorkspaceView = "form" | "list";

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

export function App() {
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

export function AuthShell({
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
  const [showReset, setShowReset] = useState(false);
  const [form, setForm] = useState({
    email: "admin@example.com",
    first_name: "",
    last_name: "",
    password: "ChangeM3!"
  });
  const [resetForm, setResetForm] = useState({
    email: "admin@example.com",
    token: "",
    password: ""
  });
  const [resetMessage, setResetMessage] = useState("");

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

  async function requestReset(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResetMessage("");
    try {
      const response = await api<{ detail: string }>("/api/auth/password-reset/request", null, {
        method: "POST",
        body: JSON.stringify({ email: resetForm.email })
      });
      setResetMessage(response.detail);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to request reset");
    }
  }

  async function confirmReset(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setResetMessage("");
    try {
      const response = await api<{ detail: string }>("/api/auth/password-reset/confirm", null, {
        method: "POST",
        body: JSON.stringify({ token: resetForm.token, password: resetForm.password })
      });
      setResetMessage(response.detail);
      setShowReset(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to reset password");
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
        {showReset ? (
          <div className="stack">
            <form onSubmit={requestReset} className="stack">
              <label>
                Email
                <input value={resetForm.email} onChange={(event) => setResetForm({ ...resetForm, email: event.target.value })} />
              </label>
              <button className="primary" type="submit"><Mail size={18} /> Send reset email</button>
            </form>
            <form onSubmit={confirmReset} className="stack">
              <label>
                Reset token
                <input value={resetForm.token} onChange={(event) => setResetForm({ ...resetForm, token: event.target.value })} />
              </label>
              <label>
                New password
                <input type="password" value={resetForm.password} onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })} />
              </label>
              <button className="secondary" type="submit"><Lock size={18} /> Reset password</button>
            </form>
            {resetMessage && <p className="success">{resetMessage}</p>}
            {error && <p className="error">{error}</p>}
            <button className="link-button" onClick={() => setShowReset(false)}>Back to sign in</button>
          </div>
        ) : (
          <>
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
              {resetMessage && <p className="success">{resetMessage}</p>}
              <button className="primary" type="submit">
                {mode === "login" ? <Lock size={18} /> : <UserPlus size={18} />}
                {mode === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
            <button className="link-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "Register a new account" : "Use an existing account"}
            </button>
            {mode === "login" && (
              <button className="link-button" onClick={() => {
                setResetForm({ ...resetForm, email: form.email });
                setShowReset(true);
              }}>Forgot password?</button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export function PlannerApp({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [registry, setRegistry] = useState<RegistryResponse>({ rows: [], groups: [], plan_status: "Successful" });
  const [chartRows, setChartRows] = useState<RegistryRow[]>([]);
  const [planStatus, setPlanStatus] = useState<PlanStatus>("Successful");
  const [grouping, setGrouping] = useState("none");
  const [rowType, setRowType] = useState("");
  const [description, setDescription] = useState("");
  const [dateSort, setDateSort] = useState<"date_asc" | "date_desc">("date_asc");
  const [scheduleView, setScheduleView] = useState<ScheduleWorkspaceView | null>(null);
  const [balanceForm, setBalanceForm] = useState({
    adjustment_date: new Date().toISOString().slice(0, 10),
    balance: "",
    description: "Actual balance adjustment"
  });
  const [status, setStatus] = useState("");
  const selected = children.find((child) => child.id === selectedId) ?? children[0];

  const loadUser = useCallback(async () => {
    const data = await api<UserProfile>("/api/auth/me", token);
    setUser(data);
    return data;
  }, [token]);

  const loadChildren = useCallback(async () => {
    const data = await api<Child[]>("/api/children", token);
    setChildren(data);
    setSelectedId((currentId) => {
      if (!data.length) return null;
      if (currentId && data.some((child) => child.id === currentId)) return currentId;
      return data[0].id;
    });
    return data;
  }, [token]);

  const loadRegistry = useCallback(async () => {
    if (!selected) return;
    const query = new URLSearchParams({
      start_date: selected.college_start_date,
      end_date: selected.college_end_date,
      grouping,
      sort: dateSort
    });
    if (rowType) query.set("row_type", rowType);
    if (description) query.set("description", description);
    const chartQuery = new URLSearchParams({
      start_date: selected.college_start_date,
      end_date: selected.college_end_date,
      grouping: "none",
      sort: "date_asc"
    });
    const [data, chartData] = await Promise.all([
      api<RegistryResponse>(
        `/api/registry/${selected.account.id}?${query}`,
        token
      ),
      api<RegistryResponse>(
        `/api/registry/${selected.account.id}?${chartQuery}`,
        token
      )
    ]);
    setRegistry(data);
    setChartRows(chartData.rows);
    setPlanStatus(chartData.plan_status);
  }, [dateSort, description, grouping, rowType, selected, token]);

  useEffect(() => {
    Promise.all([loadUser(), loadChildren()]).catch((err) => setStatus(err.message));
  }, [loadChildren, loadUser]);

  useEffect(() => {
    loadRegistry().catch((err) => setStatus(err.message));
  }, [loadRegistry]);

  const totals = useMemo(() => {
    const rows = chartRows;
    const endingRow = rows[rows.length - 1];
    return {
      deposits: rows.reduce((sum, row) => sum + (row.type === "deposit" ? Number(row.amount) : 0), 0),
      expenses: rows.reduce((sum, row) => sum + (row.type === "expense" ? Math.abs(Number(row.amount)) : 0), 0),
      income: rows.reduce((sum, row) => sum + (row.type === "investment_income" ? Number(row.amount) : 0), 0),
      balance: endingRow?.running_balance ?? selected?.account.initial_balance ?? "0"
    };
  }, [chartRows, selected]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <Landmark aria-hidden="true" />
          <span>College Planner</span>
        </div>
        <ChildForm token={token} onCreated={loadChildren} />
        <ChildList
          children={children}
          selectedId={selected?.id ?? null}
          token={token}
          onSelect={setSelectedId}
          onChanged={loadChildren}
        />
        {user && (
          <AccountSettings
            token={token}
            user={user}
            onUserChanged={loadUser}
            onDeleted={onLogout}
          />
        )}
        {selected && (
          <>
            <ScheduleSidebarNav activeView={scheduleView} onChange={setScheduleView} />
            <BalanceAdjustmentPanel
              accountId={selected.account.id}
              token={token}
              balanceForm={balanceForm}
              setBalanceForm={setBalanceForm}
              onSaved={loadRegistry}
            />
          </>
        )}
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
              <Metric icon={<ShieldAlert />} label="Plan Status" value={planStatus} />
              <Metric icon={<Plus />} label="Deposits" value={money(totals.deposits)} />
              <Metric icon={<BarChart3 />} label="Investment income" value={money(totals.income)} />
              <Metric icon={<Landmark />} label="Expenses" value={money(totals.expenses)} />
            </section>
            {scheduleView && (
              <SchedulePanel
                token={token}
                accountId={selected.account.id}
                mode={scheduleView}
                onModeChange={setScheduleView}
                onSaved={loadRegistry}
              />
            )}
            <AvailableFundsChart rows={chartRows} />
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

export function AccountSettings({
  token,
  user,
  onUserChanged,
  onDeleted
}: {
  token: string;
  user: UserProfile;
  onUserChanged: () => Promise<UserProfile>;
  onDeleted: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: user.first_name, last_name: user.last_name });
  const [emailForm, setEmailForm] = useState({ email: user.email, current_password: "" });
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setProfileForm({ first_name: user.first_name, last_name: user.last_name });
    setEmailForm((current) => ({ ...current, email: user.email }));
  }, [user]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    await submitSettings(async () => {
      await api("/api/auth/me", token, {
        method: "PATCH",
        body: JSON.stringify(profileForm)
      });
      await onUserChanged();
      return "Profile updated.";
    });
  }

  async function saveEmail(event: React.FormEvent) {
    event.preventDefault();
    await submitSettings(async () => {
      await api("/api/auth/me", token, {
        method: "PATCH",
        body: JSON.stringify(emailForm)
      });
      setEmailForm({ email: emailForm.email, current_password: "" });
      await onUserChanged();
      return "Email updated.";
    });
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    await submitSettings(async () => {
      await api("/api/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify(passwordForm)
      });
      setPasswordForm({ current_password: "", new_password: "" });
      return "Password updated.";
    });
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm("Delete this account and all child plans?")) return;
    await submitSettings(async () => {
      await api("/api/auth/me", token, {
        method: "DELETE",
        body: JSON.stringify({ current_password: deletePassword })
      });
      onDeleted();
      return "Account deleted.";
    });
  }

  async function submitSettings(action: () => Promise<string>) {
    setError("");
    setMessage("");
    try {
      setMessage(await action());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Account update failed");
    }
  }

  return (
    <section className="sidebar-option account-settings">
      <button className="sidebar-option-toggle" type="button" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        <span>
          <Settings size={18} />
          Account settings
        </span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <div className="account-settings-body">
          <div className="account-summary">
            <CircleUserRound size={18} />
            <span>{user.first_name} {user.last_name}</span>
            <small>{user.email}</small>
          </div>
          <form className="mini-form" onSubmit={saveProfile}>
            <h3>Profile</h3>
            <label>First name<input value={profileForm.first_name} onChange={(event) => setProfileForm({ ...profileForm, first_name: event.target.value })} /></label>
            <label>Last name<input value={profileForm.last_name} onChange={(event) => setProfileForm({ ...profileForm, last_name: event.target.value })} /></label>
            <button className="secondary full" type="submit"><Save size={16} /> Save profile</button>
          </form>
          <form className="mini-form" onSubmit={saveEmail}>
            <h3>Email</h3>
            <label>Email<input type="email" value={emailForm.email} onChange={(event) => setEmailForm({ ...emailForm, email: event.target.value })} /></label>
            <label>Current password<input type="password" value={emailForm.current_password} onChange={(event) => setEmailForm({ ...emailForm, current_password: event.target.value })} /></label>
            <button className="secondary full" type="submit"><Mail size={16} /> Update email</button>
          </form>
          <form className="mini-form" onSubmit={changePassword}>
            <h3>Password</h3>
            <label>Current password<input type="password" value={passwordForm.current_password} onChange={(event) => setPasswordForm({ ...passwordForm, current_password: event.target.value })} /></label>
            <label>New password<input type="password" value={passwordForm.new_password} onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })} /></label>
            <button className="secondary full" type="submit"><Lock size={16} /> Change password</button>
          </form>
          <form className="mini-form danger-zone" onSubmit={deleteAccount}>
            <h3>Delete account</h3>
            <label>Current password<input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label>
            <button className="ghost danger full" type="submit"><Trash2 size={16} /> Delete account</button>
          </form>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </section>
  );
}

type BalanceForm = {
  adjustment_date: string;
  balance: string;
  description: string;
};

export function BalanceAdjustmentPanel({
  accountId,
  token,
  balanceForm,
  setBalanceForm,
  onSaved
}: {
  accountId: number;
  token: string;
  balanceForm: BalanceForm;
  setBalanceForm: React.Dispatch<React.SetStateAction<BalanceForm>>;
  onSaved: () => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api(`/api/registry/${accountId}/balance-adjustments`, token, {
      method: "POST",
      body: JSON.stringify(balanceForm)
    });
    setBalanceForm({ ...balanceForm, balance: "" });
    await onSaved();
  }

  return (
    <section className="sidebar-option">
      <button className="sidebar-option-toggle" type="button" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        <span>
          <Save size={18} />
          Set actual balance
        </span>
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {isOpen && (
        <form className="mini-form balance-adjustment-sidebar-form" onSubmit={submit}>
          <label>Actual date<input type="date" value={balanceForm.adjustment_date} onChange={(event) => setBalanceForm({ ...balanceForm, adjustment_date: event.target.value })} /></label>
          <label>Actual balance<input type="number" value={balanceForm.balance} onChange={(event) => setBalanceForm({ ...balanceForm, balance: event.target.value })} /></label>
          <label>Description<input value={balanceForm.description} onChange={(event) => setBalanceForm({ ...balanceForm, description: event.target.value })} /></label>
          <button className="secondary full" type="submit"><Save size={16} /> Set balance</button>
        </form>
      )}
    </section>
  );
}

export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function ScheduleSidebarNav({
  activeView,
  onChange
}: {
  activeView: ScheduleWorkspaceView | null;
  onChange: (view: ScheduleWorkspaceView) => void;
}) {
  return (
    <nav className="sidebar-option" aria-label="Schedules">
      <button
        className={activeView === "form" ? "sidebar-nav-button active" : "sidebar-nav-button"}
        type="button"
        onClick={() => onChange("form")}
      >
        <Pencil size={18} />
        <span>Add/edit expenses/deposits</span>
      </button>
      <button
        className={activeView === "list" ? "sidebar-nav-button active" : "sidebar-nav-button"}
        type="button"
        onClick={() => onChange("list")}
      >
        <CalendarDays size={18} />
        <span>Recurring schedules</span>
      </button>
    </nav>
  );
}

export function ChildForm({ token, onCreated }: { token: string; onCreated: () => void }) {
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

export function ChildList({
  children,
  selectedId,
  token,
  onSelect,
  onChanged
}: {
  children: Child[];
  selectedId: number | null;
  token: string;
  onSelect: (id: number) => void;
  onChanged: () => Promise<Child[]>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    college_start_date: "",
    college_end_date: "",
    initial_balance: "",
    expected_annual_return_rate: ""
  });

  function startEditing(child: Child) {
    setEditingId(child.id);
    setForm({
      first_name: child.first_name,
      college_start_date: child.college_start_date,
      college_end_date: child.college_end_date,
      initial_balance: child.account.initial_balance,
      expected_annual_return_rate: child.account.expected_annual_return_rate
    });
  }

  async function saveChild(childId: number) {
    await api(`/api/children/${childId}`, token, {
      method: "PATCH",
      body: JSON.stringify(form)
    });
    setEditingId(null);
    await onChanged();
  }

  async function deleteChild(childId: number) {
    const child = children.find((item) => item.id === childId);
    if (!window.confirm(`Delete ${child?.first_name ?? "this child"} and all account data?`)) return;
    await api(`/api/children/${childId}`, token, { method: "DELETE" });
    setEditingId(null);
    await onChanged();
  }

  return (
    <nav className="child-list" aria-label="Children">
      {children.map((child) => {
        const isEditing = editingId === child.id;
        return (
          <div className={child.id === selectedId ? "child-row active" : "child-row"} key={child.id}>
            {isEditing ? (
              <form className="mini-form child-edit-form" onSubmit={(event) => {
                event.preventDefault();
                saveChild(child.id);
              }}>
                <label>Name<input value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></label>
                <label>College start<input type="date" value={form.college_start_date} onChange={(event) => setForm({ ...form, college_start_date: event.target.value })} /></label>
                <label>College end<input type="date" value={form.college_end_date} onChange={(event) => setForm({ ...form, college_end_date: event.target.value })} /></label>
                <label>Balance<input type="number" value={form.initial_balance} onChange={(event) => setForm({ ...form, initial_balance: event.target.value })} /></label>
                <label>Return rate<input type="number" step="0.0001" value={form.expected_annual_return_rate} onChange={(event) => setForm({ ...form, expected_annual_return_rate: event.target.value })} /></label>
                <div className="child-row-actions">
                  <button className="icon-button" type="submit" aria-label={`Save ${child.first_name}`}><Save size={16} /></button>
                  <button className="icon-button" type="button" aria-label={`Cancel editing ${child.first_name}`} onClick={() => setEditingId(null)}><X size={16} /></button>
                </div>
              </form>
            ) : (
              <>
                <button className="child-select-button" type="button" onClick={() => onSelect(child.id)}>
                  <CalendarDays size={18} />
                  <span>{child.first_name}</span>
                </button>
                <div className="child-row-actions">
                  <button className="icon-button" type="button" aria-label={`Edit ${child.first_name}`} onClick={() => startEditing(child)}><Pencil size={16} /></button>
                  <button className="icon-button danger" type="button" aria-label={`Delete ${child.first_name}`} onClick={() => deleteChild(child.id)}><Trash2 size={16} /></button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </nav>
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

export function SchedulePanel({
  token,
  accountId,
  mode,
  onModeChange,
  onSaved
}: {
  token: string;
  accountId: number;
  mode: ScheduleWorkspaceView;
  onModeChange: (mode: ScheduleWorkspaceView) => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<ScheduleKind>("deposits");
  const [activeListKind, setActiveListKind] = useState<ScheduleKind>("deposits");
  const [deposits, setDeposits] = useState<Schedule[]>([]);
  const [expenses, setExpenses] = useState<Schedule[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<ScheduleKind | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
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
  const loadSchedules = useCallback(async () => {
    const [depositRows, expenseRows] = await Promise.all([
      api<Schedule[]>(`/api/schedules/deposits?account_id=${accountId}`, token),
      api<Schedule[]>(`/api/schedules/expenses?account_id=${accountId}`, token)
    ]);
    setDeposits(depositRows);
    setExpenses(expenseRows);
  }, [accountId, token]);

  useEffect(() => {
    loadSchedules().catch(() => undefined);
    setEditingKey(null);
    setEditingKind(null);
    setEditingScheduleId(null);
  }, [accountId, loadSchedules]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editingKind && editingScheduleId) {
      const scheduleBody = {
        ...editForm,
        end_date: editForm.frequency === "one_time" ? editForm.start_date : editForm.end_date,
        recurrence: recurrenceFor(editForm.frequency)
      };
      await api(`/api/schedules/${editingKind}/${editingScheduleId}`, token, {
        method: "PATCH",
        body: JSON.stringify(scheduleBody)
      });
      clearEditing();
      await loadSchedules();
      onSaved();
      return;
    }

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
    setEditingKind(scheduleKind);
    setEditingScheduleId(schedule.id);
    setKind(scheduleKind);
    setEditForm({
      start_date: schedule.start_date,
      end_date: schedule.end_date,
      amount: schedule.amount,
      description: schedule.description,
      frequency: schedule.frequency
    });
    onModeChange("form");
  }

  function clearEditing() {
    setEditingKey(null);
    setEditingKind(null);
    setEditingScheduleId(null);
  }

  async function deleteSchedule(schedule: Schedule, scheduleKind: ScheduleKind) {
    await api(`/api/schedules/${scheduleKind}/${schedule.id}`, token, { method: "DELETE" });
    if (editingKey === `${scheduleKind}-${schedule.id}`) {
      clearEditing();
    }
    await loadSchedules();
    onSaved();
  }

  const isEditing = Boolean(editingKind && editingScheduleId);
  const activeForm = isEditing ? editForm : form;
  const setActiveForm = isEditing ? setEditForm : setForm;

  if (mode === "list") {
    return (
      <section className="panel schedule-workspace">
        <div className="panel-heading">
          <h2>Recurring deposits/expenses</h2>
          <button className="secondary" type="button" onClick={() => {
            clearEditing();
            onModeChange("form");
          }}><Plus size={18} /> Add schedule</button>
        </div>
        <div className="schedule-tabs" role="tablist" aria-label="Recurring schedule type">
          <button className={activeListKind === "deposits" ? "active" : ""} type="button" role="tab" aria-selected={activeListKind === "deposits"} onClick={() => setActiveListKind("deposits")}>Deposits</button>
          <button className={activeListKind === "expenses" ? "active" : ""} type="button" role="tab" aria-selected={activeListKind === "expenses"} onClick={() => setActiveListKind("expenses")}>Expenses</button>
        </div>
        <div className="schedule-list-grid" aria-live="polite">
          {activeListKind === "deposits" ? (
            <ScheduleList
              title="Recurring deposits"
              kind="deposits"
              schedules={deposits}
              startEditing={startEditing}
              deleteSchedule={deleteSchedule}
            />
          ) : (
            <ScheduleList
              title="Recurring expenses"
              kind="expenses"
              schedules={expenses}
              startEditing={startEditing}
              deleteSchedule={deleteSchedule}
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel schedule-workspace">
      <div className="panel-heading">
        <h2>{isEditing ? "Edit expense/deposit" : "Add expense/deposit"}</h2>
        <button className="secondary" type="button" onClick={() => onModeChange("list")}><CalendarDays size={18} /> View recurring</button>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>Type<select value={kind} disabled={isEditing} onChange={(event) => setKind(event.target.value as ScheduleKind)}>
          <option value="deposits">Deposit</option>
          <option value="expenses">Expense</option>
        </select></label>
        <label>Frequency<select value={activeForm.frequency} onChange={(event) => setActiveForm({ ...activeForm, frequency: event.target.value })}>
          {frequencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <label>Start<input type="date" value={activeForm.start_date} onChange={(event) => setActiveForm({ ...activeForm, start_date: event.target.value })} /></label>
        {activeForm.frequency !== "one_time" && (
          <label>End<input type="date" value={activeForm.end_date} onChange={(event) => setActiveForm({ ...activeForm, end_date: event.target.value })} /></label>
        )}
        <label>Amount<input type="number" value={activeForm.amount} onChange={(event) => setActiveForm({ ...activeForm, amount: event.target.value })} /></label>
        <label className="wide">Description<input value={activeForm.description} onChange={(event) => setActiveForm({ ...activeForm, description: event.target.value })} /></label>
        <div className="schedule-form-actions wide">
          <button className="primary" type="submit">{isEditing ? <Save size={18} /> : <Plus size={18} />}{isEditing ? "Save schedule" : "Add schedule"}</button>
          {isEditing && <button className="ghost" type="button" onClick={clearEditing}><X size={18} /> Cancel edit</button>}
        </div>
      </form>
    </section>
  );
}

export function ScheduleList({
  title,
  kind,
  schedules,
  startEditing,
  deleteSchedule
}: {
  title: string;
  kind: ScheduleKind;
  schedules: Schedule[];
  startEditing: (schedule: Schedule, kind: ScheduleKind) => void;
  deleteSchedule: (schedule: Schedule, kind: ScheduleKind) => void;
}) {
  return (
    <div className="schedule-list">
      <h3>{title}</h3>
      {schedules.length === 0 && <p className="empty-state">No {kind === "deposits" ? "deposits" : "expenses"} created yet.</p>}
      {schedules.map((schedule) => {
        const key = `${kind}-${schedule.id}`;
        return (
          <article className="schedule-row" key={key}>
            <div>
              <strong>{schedule.description}</strong>
              <span>{scheduleDateSummary(schedule)}</span>
            </div>
            <div className="schedule-summary">
              <strong className={kind === "expenses" ? "expense-text" : ""}>{money(schedule.amount)}</strong>
              <button className="icon-button" type="button" aria-label={`Edit ${schedule.description}`} onClick={() => startEditing(schedule, kind)}><Pencil size={16} /></button>
              <button className="icon-button danger" type="button" aria-label={`Delete ${schedule.description}`} onClick={() => deleteSchedule(schedule, kind)}><Trash2 size={16} /></button>
            </div>
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

export function AvailableFundsChart({ rows }: { rows: RegistryRow[] }) {
  const monthlyBalances = useMemo(() => monthlyAvailableFunds(rows), [rows]);
  if (!monthlyBalances.length) {
    return (
      <section className="panel funds-chart-panel">
        <div className="panel-heading">
          <h2>Available funds by month</h2>
        </div>
        <p className="empty-state">No registry rows available yet.</p>
      </section>
    );
  }

  const values = monthlyBalances.map((point) => point.balance);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(maxValue - minValue, 1);
  const width = 720;
  const height = 230;
  const padding = { top: 16, right: 20, bottom: 36, left: 94 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const points = monthlyBalances.map((point, index) => {
    const x = padding.left + (monthlyBalances.length === 1 ? plotWidth / 2 : (index / (monthlyBalances.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - ((point.balance - minValue) / range) * plotHeight;
    return { ...point, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${padding.left},${padding.top + plotHeight} ${linePoints} ${padding.left + plotWidth},${padding.top + plotHeight}`;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const endingBalance = monthlyBalances[monthlyBalances.length - 1].balance;

  return (
    <section className="panel funds-chart-panel">
      <div className="panel-heading">
        <h2>Available funds by month</h2>
        <strong>{money(endingBalance)}</strong>
      </div>
      <svg className="funds-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Available funds by month">
        <line className="chart-axis" x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} />
        <line className="chart-axis" x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} />
        <text className="chart-value-label" x={padding.left - 12} y={padding.top + 4}>{money(maxValue)}</text>
        <text className="chart-value-label" x={padding.left - 12} y={padding.top + plotHeight}>{money(minValue)}</text>
        <polygon className="chart-area" points={areaPoints} />
        <polyline className="chart-line" points={linePoints} />
        {points.map((point, index) => (
          <g key={point.month}>
            <circle className="chart-point" cx={point.x} cy={point.y} r="3.5" />
            {index % labelEvery === 0 && (
              <text className="chart-month-label" x={point.x} y={height - 10}>{point.label}</text>
            )}
          </g>
        ))}
      </svg>
    </section>
  );
}

function monthlyAvailableFunds(rows: RegistryRow[]) {
  const byMonth = new Map<string, { month: string; label: string; balance: number }>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    byMonth.set(month, {
      month,
      label: monthLabel(row.date),
      balance: Number(row.running_balance)
    });
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function monthLabel(value: string) {
  const date = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function RegistryTable({
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
    if (row.type === "opening_balance") {
      await api(`/api/registry/${accountId}/opening-balance`, token, {
        method: "PATCH",
        body: JSON.stringify({ initial_balance: editForm.amount })
      });
      setEditingKey(null);
      await onSaved();
      return;
    }
    if (row.type === "balance_adjustment") {
      if (!row.override_id) return;
      await api(`/api/registry/${accountId}/balance-adjustments/${row.override_id}`, token, {
        method: "PATCH",
        body: JSON.stringify({
          adjustment_date: editForm.date,
          balance: editForm.amount,
          description: editForm.description
        })
      });
      setEditingKey(null);
      await onSaved();
      return;
    }
    if (row.type === "investment_income") {
      await api(`/api/registry/${accountId}/investment-income-overrides`, token, {
        method: "POST",
        body: JSON.stringify({
          income_date: row.date,
          amount: editForm.amount,
          description: editForm.description,
          is_deleted: false
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
        description: editForm.description,
        is_deleted: false
      })
    });
    setEditingKey(null);
    await onSaved();
  }

  async function deleteRegistryRow(row: RegistryRow) {
    if (row.type === "opening_balance") {
      await api(`/api/registry/${accountId}/opening-balance`, token, { method: "DELETE" });
      await onSaved();
      return;
    }
    if (row.type === "balance_adjustment") {
      if (!row.override_id) return;
      await api(`/api/registry/${accountId}/balance-adjustments/${row.override_id}`, token, { method: "DELETE" });
      await onSaved();
      return;
    }
    if (row.type === "investment_income") {
      await api(`/api/registry/${accountId}/investment-income-overrides`, token, {
        method: "POST",
        body: JSON.stringify({
          income_date: row.date,
          amount: "0",
          description: row.description,
          is_deleted: true
        })
      });
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
        override_date: row.date,
        amount: "0",
        description: row.description,
        is_deleted: true
      })
    });
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
      <thead><tr><th><button className="table-sort" type="button" onClick={onDateSortChange}>Date {dateSort === "date_asc" ? "↑" : "↓"}</button></th><th>Description</th><th>Amount</th><th>Balance</th><th>Adjust</th></tr></thead>
      <tbody>{rows.map((row, index) => {
        const key = registryEditKey(row, index);
        const isEditing = editingKey === key;
        return (
          <tr className={registryRowClass(row)} key={`${row.date}-${row.description}-${index}`}>
            {isEditing ? (
              <>
                <td><input className="table-input" type="date" value={editForm.date} disabled={row.type === "investment_income" || row.type === "opening_balance"} onChange={(event) => setEditForm({ ...editForm, date: event.target.value })} /></td>
                <td><input className="table-input" value={editForm.description} disabled={row.type === "opening_balance"} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} /></td>
                <td><input className="table-input" type="number" value={editForm.amount} onChange={(event) => setEditForm({ ...editForm, amount: event.target.value })} /></td>
                <td>{money(row.running_balance)}</td>
                <td className="row-actions"><button className="icon-button" type="button" aria-label="Save occurrence" onClick={() => saveOccurrence(row)}><Save size={16} /></button><button className="icon-button" type="button" aria-label="Cancel occurrence edit" onClick={() => setEditingKey(null)}><X size={16} /></button></td>
              </>
            ) : (
              <>
                <td>{row.date}</td><td>{row.description}</td><td>{money(row.amount)}</td><td>{money(row.running_balance)}</td>
                <td className="row-actions">
                  <button className="icon-button" type="button" aria-label={`Edit ${row.description} on ${row.date}`} onClick={() => startOccurrenceEdit(row, index)}><Pencil size={16} /></button>
                  <button className="icon-button danger" type="button" aria-label={`Delete ${row.description} on ${row.date}`} onClick={() => deleteRegistryRow(row)}><Trash2 size={16} /></button>
                </td>
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
  if (row.type === "deposit" || row.type === "investment_income") return row.amount;
  if (row.type === "expense") return String(Math.abs(Number(row.amount)));
  return row.running_balance;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
