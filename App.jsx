
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import {
  Wallet, Plus, Trash2, LogOut, RefreshCw, Pencil, ChartColumn,
  Tags, CalendarDays, IndianRupee, Sun, Moon, LayoutDashboard,
  History, Bell, Sparkles, TrendingUp, Menu, X
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000/api";
const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const currentMonth = () => today().slice(0, 7);
const money = (n = 0) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(n) || 0);
const COLORS = ["#8b7cff", "#42d9b1", "#ffb86b", "#ff78b7", "#66b9ff", "#b79aff", "#f27d72", "#90d68b"];

async function request(path, options = {}, token = "") {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { message: text || "Unexpected server response." }; }
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data;
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("expenseTheme") || "dark");
  const [token, setToken] = useState(() => localStorage.getItem("expenseToken") || "");
  const [email, setEmail] = useState(() => localStorage.getItem("expenseEmail") || "");
  const [isRegister, setIsRegister] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseMeta, setExpenseMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [summary, setSummary] = useState({
    month: currentMonth(), totalSpent: 0, overallBudget: 0,
    overallRemaining: 0, categories: []
  });
  const [budgets, setBudgets] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category: "", paymentMode: "", startDate: "", endDate: "" });
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [description, setDescription] = useState("");
  const [budgetCategory, setBudgetCategory] = useState("All");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("expenseTheme", theme);
  }, [theme]);

  const flash = useCallback((text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  }, []);

  const loadCategories = useCallback(async (authToken) => {
    const d = await request("/categories", {}, authToken);
    setCategories(Array.isArray(d) ? d : d.categories || []);
  }, []);

  const loadExpenses = useCallback(async (authToken, p, activeFilters) => {
    const params = new URLSearchParams({ page: String(p), limit: "10" });
    Object.entries(activeFilters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const d = await request(`/expenses?${params}`, {}, authToken);
    const items = Array.isArray(d) ? d : d.items || [];
    setExpenses(items);
    setExpenseMeta({ total: d.total ?? items.length, page: d.page ?? p, pages: d.pages ?? 1 });
  }, []);

  const loadReports = useCallback(async (authToken, selectedMonth) => {
    const [s, b] = await Promise.all([
      request(`/summary?month=${selectedMonth}`, {}, authToken),
      request(`/budgets?month=${selectedMonth}`, {}, authToken)
    ]);
    setSummary({
      month: s.month || selectedMonth,
      totalSpent: Number(s.totalSpent) || 0,
      overallBudget: Number(s.overallBudget) || 0,
      overallRemaining: Number(s.overallRemaining) || 0,
      categories: Array.isArray(s.categories) ? s.categories : []
    });
    setBudgets(Array.isArray(b) ? b : b.budgets || []);
  }, []);

  const refreshAll = useCallback(async (
    authToken = token, p = page, activeFilters = filters, selectedMonth = month
  ) => {
    if (!authToken) return;
    setPageLoading(true);
    try {
      await Promise.all([
        loadCategories(authToken),
        loadExpenses(authToken, p, activeFilters),
        loadReports(authToken, selectedMonth)
      ]);
    } catch (e) { flash(e.message, "error"); }
    finally { setPageLoading(false); }
  }, [token, page, filters, month, loadCategories, loadExpenses, loadReports, flash]);

  useEffect(() => {
    if (token) refreshAll(token, page, filters, month);
  }, [token]); // Restore session on startup.

  async function handleAuth(e) {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) return flash("Enter your email and password.", "error");
    setLoading(true);
    try {
      const d = await request(isRegister ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
      });
      if (!d.token) throw new Error("No login token received.");
      const userEmail = d.user?.email || authEmail.trim();
      localStorage.setItem("expenseToken", d.token);
      localStorage.setItem("expenseEmail", userEmail);
      setToken(d.token);
      setEmail(userEmail);
      setAuthPassword("");
      setMonth(currentMonth());
      setPage(1);
      flash(isRegister ? "Account created successfully!" : "Welcome back!", "success");
      await refreshAll(d.token, 1, filters, currentMonth());
    } catch (e) { flash(e.message, "error"); }
    finally { setLoading(false); }
  }

  function logout() {
    localStorage.removeItem("expenseToken");
    localStorage.removeItem("expenseEmail");
    setToken("");
    setEmail("");
    setExpenses([]);
    setCategories([]);
    setBudgets([]);
    setSummary({ month: currentMonth(), totalSpent: 0, overallBudget: 0, overallRemaining: 0, categories: [] });
    flash("Logged out successfully.", "success");
  }

  async function addExpense(e) {
    e.preventDefault();
    const n = Number(amount);
    if (!title.trim()) return flash("Enter an expense title.", "error");
    if (!Number.isFinite(n) || n <= 0) return flash("Enter a valid amount.", "error");
    if (!date || !category) return flash("Select a date and category.", "error");
    try {
      await request("/expenses", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), amount: n, date, category, paymentMode, description: description.trim() })
      }, token);
      setTitle(""); setAmount(""); setDate(today()); setDescription(""); setPage(1);
      await refreshAll(token, 1, filters, month);
      flash("Expense added successfully!");
    } catch (e) { flash(e.message, "error"); }
  }

  async function deleteExpense(id) {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await request(`/expenses/${id}`, { method: "DELETE" }, token);
      const p = expenses.length === 1 && page > 1 ? page - 1 : page;
      setPage(p);
      await refreshAll(token, p, filters, month);
      flash("Expense deleted.");
    } catch (e) { flash(e.message, "error"); }
  }

  async function saveBudget(e) {
    e.preventDefault();
    const n = Number(budgetAmount);
    if (!Number.isFinite(n) || n <= 0) return flash("Enter a budget greater than zero.", "error");
    try {
      await request("/budgets", {
        method: "PUT",
        body: JSON.stringify({ month, category: budgetCategory, amount: n })
      }, token);
      setBudgetAmount("");
      await loadReports(token, month);
      flash("Budget saved successfully!");
    } catch (e) { flash(e.message, "error"); }
  }

  async function deleteBudget(id) {
    if (!window.confirm("Delete this budget?")) return;
    try {
      await request(`/budgets/${id}`, { method: "DELETE" }, token);
      await loadReports(token, month);
      flash("Budget deleted.");
    } catch (e) { flash(e.message, "error"); }
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return flash("Enter a category name.", "error");
    try {
      await request("/categories", {
        method: "POST", body: JSON.stringify({ name: newCategory.trim() })
      }, token);
      setNewCategory("");
      await loadCategories(token);
      flash("Category added!");
    } catch (e) { flash(e.message, "error"); }
  }

  function startCategoryEdit(item) {
    setEditingCategoryId(item._id);
    setEditingCategoryName(item.name);
  }

  async function saveCategoryEdit(id) {
    if (!editingCategoryName.trim()) return flash("Category name cannot be empty.", "error");
    try {
      await request(`/categories/${id}`, {
        method: "PUT", body: JSON.stringify({ name: editingCategoryName.trim() })
      }, token);
      setEditingCategoryId("");
      setEditingCategoryName("");
      await refreshAll(token, page, filters, month);
      flash("Category updated.");
    } catch (e) { flash(e.message, "error"); }
  }

  async function deleteCategory(id) {
    if (!window.confirm("Delete this category?")) return;
    try {
      await request(`/categories/${id}`, { method: "DELETE" }, token);
      await refreshAll(token, page, filters, month);
      flash("Category deleted.");
    } catch (e) { flash(e.message, "error"); }
  }

  async function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    await refreshAll(token, 1, filters, month);
  }

  async function clearFilters() {
    const empty = { category: "", paymentMode: "", startDate: "", endDate: "" };
    setFilters(empty);
    setPage(1);
    await refreshAll(token, 1, empty, month);
  }

  async function changeMonth(value) {
    setMonth(value);
    await refreshAll(token, page, filters, value);
  }

  async function changePage(value) {
    setPage(value);
    await refreshAll(token, value, filters, month);
  }

  const chartData = useMemo(() => summary.categories.map(x => ({
    category: x.category, spent: Number(x.total) || 0, budget: Number(x.budget) || 0
  })), [summary.categories]);

  const alerts = useMemo(() => summary.categories
    .filter(x => Number(x.budget) > 0)
    .map(x => {
      const spent = Number(x.total) || 0;
      const budget = Number(x.budget) || 0;
      return { ...x, spent, budget, percentage: spent / budget * 100, exceeded: spent > budget, warning: spent / budget * 100 >= 80 && spent <= budget };
    }).filter(x => x.exceeded || x.warning), [summary.categories]);

  const overallPercentage = summary.overallBudget > 0 ? summary.totalSpent / summary.overallBudget * 100 : 0;

  const scrollTo = id => {
    setActiveSection(id);
    setMobileMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="auth-orb orb-one" />
          <div className="brand-icon"><Wallet size={30} /></div>
          <span className="eyebrow"><Sparkles size={14} /> YOUR MONEY, YOUR RULES</span>
          <h1>{isRegister ? "Create your space." : "Welcome back."}</h1>
          <p className="muted">A clearer view of your money starts here.</p>
          {message && <div className={`notice ${messageType}`}>{message}</div>}
          <form onSubmit={handleAuth} className="form-stack">
            <label htmlFor="authEmail">Email address</label>
            <input id="authEmail" type="email" placeholder="you@example.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required />
            <label htmlFor="authPassword">Password</label>
            <input id="authPassword" type="password" placeholder="At least 6 characters" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required minLength={6} />
            <button className="primary-btn auth-submit" disabled={loading}>{loading ? "Please wait..." : isRegister ? "Create account →" : "Login to dashboard →"}</button>
          </form>
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New here?"}{" "}
            <button type="button" className="text-btn" onClick={() => { setIsRegister(!isRegister); setMessage(""); }}>
              {isRegister ? "Login" : "Create an account"}
            </button>
          </p>
          <p className="auth-foot"><span /> Private by design · Personal finance made simple</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-layout">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon small"><Wallet size={22} /></div>
          <div><strong>pocket<span>wise.</span></strong><small>PERSONAL FINANCE</small></div>
          <button className="mobile-close" onClick={() => setMobileMenu(false)}><X size={19} /></button>
        </div>
        <div className="side-label">WORKSPACE</div>
        <button className={`nav-item ${activeSection === "dashboard" ? "active" : ""}`} onClick={() => scrollTo("dashboard")}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={`nav-item ${activeSection === "add-expense" ? "active" : ""}`} onClick={() => scrollTo("add-expense")}><Plus size={18} /> Add expense</button>
        <button className={`nav-item ${activeSection === "history" ? "active" : ""}`} onClick={() => scrollTo("history")}><History size={18} /> Transactions</button>
        <button className={`nav-item ${activeSection === "budgets" ? "active" : ""}`} onClick={() => scrollTo("budgets")}><Wallet size={18} /> Budgets</button>
        <button className={`nav-item ${activeSection === "categories" ? "active" : ""}`} onClick={() => scrollTo("categories")}><Tags size={18} /> Categories</button>
        <button className={`nav-item ${activeSection === "analytics" ? "active" : ""}`} onClick={() => scrollTo("analytics")}><ChartColumn size={18} /> Analytics</button>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><div className="tip-icon"><TrendingUp size={18} /></div><strong>Small steps add up.</strong><p>Build better money habits, one day at a time.</p></div>
          <button className="nav-item" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}{theme === "dark" ? "Light appearance" : "Dark appearance"}</button>
          <button className="nav-item logout-link" onClick={logout}><LogOut size={18} /> Log out</button>
        </div>
      </aside>

      {mobileMenu && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="topbar-title"><span className="live-dot" /> Your financial space</div>
          <div className="header-actions">
            <label className="month-picker"><CalendarDays size={17} /><input aria-label="Select month" type="month" value={month} onChange={e => changeMonth(e.target.value)} /></label>
            <button className="theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Toggle appearance" aria-label="Toggle appearance">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-btn refresh-btn" onClick={() => refreshAll()} disabled={pageLoading} title="Refresh"><RefreshCw size={17} className={pageLoading ? "spin" : ""} /></button>
            <div className="avatar">{(email[0] || "U").toUpperCase()}</div>
            <span className="user-email">{email}</span>
            <button className="icon-btn logout-icon" onClick={logout} title="Logout"><LogOut size={17} /></button>
          </div>
        </header>

        <div className="page-content">
          {message && <div className={`notice ${messageType}`}><span>{message}</span><button onClick={() => setMessage("")} type="button">×</button></div>}

          <section id="dashboard" className="welcome-row">
            <div><span className="eyebrow"><Sparkles size={14} /> YOUR MONTH, AT A GLANCE</span><h1>Make money <span>make sense.</span></h1><p className="muted">Welcome back, {email.split("@")[0]}. Here's your financial snapshot.</p></div>
            <div className="month-chip"><CalendarDays size={17} /> {new Date(`${month}-02T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
          </section>

          <section className="stats-grid">
            <article className="stat-card stat-spent"><div className="stat-top"><span className="stat-icon green"><IndianRupee size={20} /></span><span className="stat-kicker">THIS MONTH</span></div><p>Total spent</p><h2>{money(summary.totalSpent)}</h2><div className="stat-bottom"><span className="mini-dot green-dot" /> Across your recorded expenses</div></article>
            <article className="stat-card stat-budget"><div className="stat-top"><span className="stat-icon purple"><Wallet size={20} /></span><span className="stat-kicker">YOUR PLAN</span></div><p>Monthly budget</p><h2>{money(summary.overallBudget)}</h2><div className="mini-progress"><span style={{ width: `${Math.min(overallPercentage, 100)}%` }} /></div><div className="stat-bottom">{overallPercentage.toFixed(0)}% of budget used</div></article>
            <article className="stat-card stat-remaining"><div className="stat-top"><span className="stat-icon blue"><TrendingUp size={20} /></span><span className="stat-kicker">LEFT TO SPEND</span></div><p>Budget remaining</p><h2 className={summary.overallRemaining < 0 ? "danger-text" : ""}>{money(summary.overallRemaining)}</h2><div className="stat-bottom"><span className="mini-dot blue-dot" /> Budget minus spending</div></article>
            <article className="stat-card stat-transactions"><div className="stat-top"><span className="stat-icon orange"><Tags size={20} /></span><span className="stat-kicker">ACTIVITY</span></div><p>Transactions</p><h2>{expenseMeta.total}</h2><div className="stat-bottom"><span className="mini-dot orange-dot" /> Matching current filters</div></article>
          </section>

          {summary.overallBudget > 0 && <section className="panel overall-panel">
            <div className="panel-heading"><div><span className="section-kicker">BUDGET HEALTH</span><h3>You're making progress</h3><p className="muted">{overallPercentage.toFixed(1)}% of your monthly budget used</p></div><div className="budget-numbers"><strong>{money(summary.totalSpent)}</strong><span>of {money(summary.overallBudget)}</span></div></div>
            <div className="progress-track"><div className={`progress-fill ${overallPercentage > 100 ? "over-budget" : ""}`} style={{ width: `${Math.min(overallPercentage, 100)}%` }} /></div>
            {overallPercentage >= 80 && <p className={overallPercentage > 100 ? "danger-text" : "warning-text"}>{overallPercentage > 100 ? "You've exceeded your overall budget." : "You've used at least 80% of your overall budget."}</p>}
          </section>}

          <div className="dashboard-grid">
            <section className="panel analytics-panel" id="analytics">
              <div className="panel-heading"><div><span className="section-kicker">SPENDING BREAKDOWN</span><h3>Where it goes</h3><p className="muted">Category-wise spending for the selected month.</p></div><span className="heading-icon"><ChartColumn size={19} /></span></div>
              {chartData.length === 0 ? <div className="empty-state"><div className="empty-icon"><ChartColumn size={24} /></div><strong>Your insights will show up here</strong><p>Add expenses to see your spending breakdown.</p></div> : <>
                <div className="donut-layout"><div className="donut-chart"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={chartData} dataKey="spent" nameKey="category" innerRadius={64} outerRadius={88} paddingAngle={4} stroke="none">{chartData.map((x, i) => <Cell key={x.category} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={v => money(v)} /></PieChart></ResponsiveContainer><div className="donut-center"><small>TOTAL SPENT</small><strong>{money(summary.totalSpent)}</strong></div></div>
                  <div className="legend-list">{chartData.map((x, i) => <div className="legend-row" key={x.category}><span className="legend-name"><i style={{ background: COLORS[i % COLORS.length] }} />{x.category}</span><strong>{money(x.spent)}</strong></div>)}</div></div>
              </>}
            </section>

            <section className="panel alerts-panel">
              <div className="panel-heading"><div><span className="section-kicker">STAY ON TRACK</span><h3><Bell size={17} /> Budget alerts</h3><p className="muted">A little heads-up before you overspend.</p></div></div>
              {alerts.length === 0 ? <div className="calm-state"><span>✓</span><div><strong>All clear for now</strong><p>No category budget alerts this month.</p></div></div> : <div className="alert-list">{alerts.map(x => <div className={`alert-item ${x.exceeded ? "alert-danger" : "alert-warning"}`} key={x.category}><div><strong>{x.category}</strong><p>{money(x.spent)} spent of {money(x.budget)}</p><div className="progress-track"><div className={`progress-fill ${x.exceeded ? "over-budget" : ""}`} style={{ width: `${Math.min(x.percentage, 100)}%` }} /></div></div><span>{x.exceeded ? "Over budget" : `${x.percentage.toFixed(0)}% used`}</span></div>)}</div>}
            </section>
          </div>

          <div className="content-grid">
            <section className="panel" id="add-expense">
              <div className="panel-heading"><div><span className="section-kicker">NEW TRANSACTION</span><h3>Add an expense</h3><p className="muted">Capture it now, understand it later.</p></div><span className="heading-icon"><Plus size={19} /></span></div>
              <form onSubmit={addExpense} className="form-stack">
                <label htmlFor="expenseTitle">Expense title</label><input id="expenseTitle" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lunch with friends" required />
                <div className="two-column"><div><label htmlFor="expenseAmount">Amount (₹)</label><input id="expenseAmount" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></div><div><label htmlFor="expenseDate">Date</label><input id="expenseDate" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div></div>
                <label htmlFor="expenseCategory">Category</label><select id="expenseCategory" value={category} onChange={e => setCategory(e.target.value)} required><option value="">Choose a category</option>{categories.map(x => <option key={x._id || x.name} value={x.name}>{x.name}</option>)}</select>
                <label htmlFor="paymentMode">Payment method</label><select id="paymentMode" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>{PAYMENT_MODES.map(x => <option key={x}>{x}</option>)}</select>
                <label htmlFor="expenseDescription">Note <span className="optional">(optional)</span></label><textarea id="expenseDescription" value={description} onChange={e => setDescription(e.target.value)} placeholder="Anything worth remembering..." rows={3} />
                <button className="primary-btn full-btn" type="submit"><Plus size={17} /> Add expense</button>
              </form>
            </section>

            <section className="panel" id="budgets">
              <div className="panel-heading"><div><span className="section-kicker">PLAN AHEAD</span><h3>Monthly budgets</h3><p className="muted">Give your money a purpose.</p></div><span className="heading-icon"><Wallet size={19} /></span></div>
              <form onSubmit={saveBudget} className="form-stack">
                <label htmlFor="budgetCategory">Budget category</label><select id="budgetCategory" value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)}><option value="All">All expenses</option>{categories.map(x => <option key={x._id || x.name} value={x.name}>{x.name}</option>)}</select>
                <label htmlFor="budgetAmount">Monthly limit (₹)</label><input id="budgetAmount" type="number" min="0.01" step="0.01" value={budgetAmount} onChange={e => setBudgetAmount(e.target.value)} placeholder="Set your limit" required />
                <button className="primary-btn full-btn" type="submit">Save budget for {month}</button>
              </form>
              <div className="subsection"><div className="subsection-heading"><h4>Saved budgets</h4><span className="count-pill">{budgets.length}</span></div>
                {budgets.length === 0 ? <p className="empty-state compact-empty">No budgets set for this month.</p> : <div className="saved-budget-list">{budgets.map(x => <div className="saved-budget" key={x._id}><div><strong>{x.category}</strong><p>{money(x.amount)}</p></div><button className="icon-btn danger-icon" type="button" onClick={() => deleteBudget(x._id)} aria-label={`Delete ${x.category} budget`}><Trash2 size={16} /></button></div>)}</div>}
              </div>
            </section>
          </div>

          <section className="panel" id="categories">
            <div className="panel-heading"><div><span className="section-kicker">MAKE IT YOURS</span><h3>Categories</h3><p className="muted">Organise spending the way your life works.</p></div><span className="heading-icon"><Tags size={19} /></span></div>
            <form className="inline-form" onSubmit={addCategory}><input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Create a category..." aria-label="New category name" required /><button className="primary-btn" type="submit"><Plus size={17} /> Add category</button></form>
            {categories.length === 0 ? <p className="empty-state">No categories yet. Add one to get started.</p> : <div className="category-grid">{categories.map((x, i) => <div className="category-item" key={x._id || x.name}><span className="category-colour" style={{ background: COLORS[i % COLORS.length] }}><Tags size={17} /></span>{editingCategoryId === x._id ? <input className="category-edit-input" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} aria-label="Edit category name" /> : <strong>{x.name}</strong>}<div className="category-actions">{editingCategoryId === x._id ? <><button className="icon-btn" type="button" onClick={() => saveCategoryEdit(x._id)} title="Save"><span>✓</span></button><button className="icon-btn" type="button" onClick={() => setEditingCategoryId("")} title="Cancel"><X size={15} /></button></> : <><button className="icon-btn" type="button" onClick={() => startCategoryEdit(x)} title="Edit category"><Pencil size={15} /></button><button className="icon-btn danger-icon" type="button" onClick={() => deleteCategory(x._id)} title="Delete category"><Trash2 size={15} /></button></>}</div></div>)}</div>}
          </section>

          <section className="panel" id="history">
            <div className="panel-heading"><div><span className="section-kicker">YOUR MONEY TRAIL</span><h3>Transaction history</h3><p className="muted">Search, filter and review your spending.</p></div><span className="heading-icon"><History size={19} /></span></div>
            <form className="filters-grid" onSubmit={applyFilters}>
              <div><label htmlFor="filterCategory">Category</label><select id="filterCategory" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map(x => <option key={x._id || x.name} value={x.name}>{x.name}</option>)}</select></div>
              <div><label htmlFor="filterPayment">Payment method</label><select id="filterPayment" value={filters.paymentMode} onChange={e => setFilters({ ...filters, paymentMode: e.target.value })}><option value="">All methods</option>{PAYMENT_MODES.map(x => <option key={x}>{x}</option>)}</select></div>
              <div><label htmlFor="filterStart">From date</label><input id="filterStart" type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} /></div>
              <div><label htmlFor="filterEnd">To date</label><input id="filterEnd" type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} /></div>
              <div className="filter-actions"><button className="primary-btn" type="submit">Apply filters</button><button className="secondary-btn" type="button" onClick={clearFilters}>Clear all</button></div>
            </form>
            <div className="table-wrap"><table><thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Payment</th><th>Amount</th><th>Note</th><th>Action</th></tr></thead><tbody>{expenses.length === 0 ? <tr><td colSpan={7} className="empty-cell">{pageLoading ? "Loading transactions..." : "No expenses found."}</td></tr> : expenses.map(x => <tr key={x._id}><td>{x.date ? String(x.date).slice(0, 10) : "—"}</td><td><strong>{x.title}</strong></td><td><span className="category-badge">{x.category}</span></td><td>{x.paymentMode}</td><td className="amount-cell">{money(x.amount)}</td><td>{x.description || "—"}</td><td><button className="icon-btn danger-icon" type="button" onClick={() => deleteExpense(x._id)} title="Delete expense"><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
            <div className="pagination"><span className="muted">{expenseMeta.total} transaction(s) · Page {page} of {Math.max(1, expenseMeta.pages)}</span><div><button className="secondary-btn" disabled={page <= 1 || pageLoading} onClick={() => changePage(page - 1)} type="button">← Previous</button><button className="secondary-btn" disabled={page >= expenseMeta.pages || pageLoading} onClick={() => changePage(page + 1)} type="button">Next →</button></div></div>
          </section>
          <footer className="footer"><div className="footer-brand"><Wallet size={17} /> pocket<span>wise.</span></div><p>Your money, understood. Made for your next chapter.</p></footer>
        </div>
      </div>
    </main>
  );
}

export default App;
