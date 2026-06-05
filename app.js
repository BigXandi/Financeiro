/* ============================================================
 *  Finanças PWA - app.js
 *  Aplicação 100% client-side. Persistência em localStorage.
 *  ============================================================ */
(() => {
  "use strict";

  /* ------------------ Estado ------------------ */
  const STORAGE_KEY = "financas-pwa:v1";

  const DEFAULT_CATEGORIES = [
    { id: "salario",      name: "Salário",       type: "income",  color: "#10b981" },
    { id: "freelance",    name: "Freelance",     type: "income",  color: "#22d3ee" },
    { id: "investimentos",name: "Investimentos", type: "income",  color: "#6366f1" },
    { id: "presente",     name: "Presente",      type: "income",  color: "#f59e0b" },
    { id: "moradia",      name: "Moradia",       type: "expense", color: "#6366f1" },
    { id: "alimentacao",  name: "Alimentação",   type: "expense", color: "#10b981" },
    { id: "transporte",   name: "Transporte",    type: "expense", color: "#f59e0b" },
    { id: "lazer",        name: "Lazer",         type: "expense", color: "#ec4899" },
    { id: "saude",        name: "Saúde",         type: "expense", color: "#ef4444" },
    { id: "educacao",     name: "Educação",      type: "expense", color: "#8b5cf6" },
    { id: "compras",      name: "Compras",       type: "expense", color: "#22d3ee" },
    { id: "outros",       name: "Outros",        type: "expense", color: "#64748b" }
  ];

  const CATEGORY_ICONS = {
    salario: "💼", freelance: "🧑‍💻", investimentos: "📈", presente: "🎁",
    moradia: "🏠", alimentacao: "🍽️", transporte: "🚗", lazer: "🎮",
    saude: "💊", educacao: "📚", compras: "🛍️", outros: "🔹"
  };

  /** @typedef {{ id:string, type:"income"|"expense", amount:number, description:string, categoryId:string, date:string }} Tx */
  /** @typedef {{ id:string, name:string, target:number, current:number, deadline?:string }} Goal */

  let state = {
    userName: "",
    currency: "BRL",
    theme: "auto",
    transactions: /** @type {Tx[]} */ ([]),
    categories: DEFAULT_CATEGORIES.slice(),
    budgets: /** @type {Record<string, number>} */ ({}),
    goals: /** @type {Goal[]} */ ([]),
    currentMonth: monthKey(new Date())
  };

  /* ------------------ Persistência ------------------ */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state = { ...state, ...data };
      if (!state.categories || state.categories.length === 0) {
        state.categories = DEFAULT_CATEGORIES.slice();
      }
      state.currentMonth = monthKey(new Date());
    } catch (e) {
      console.error("Erro lendo localStorage", e);
    }
  }

  function saveState() {
    const { currentMonth, ...persist } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  }

  /* ------------------ Utilitários ------------------ */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }

  function parseAmount(str) {
    if (typeof str === "number") return str;
    if (!str) return 0;
    const cleaned = String(str).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function formatMoney(n) {
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: state.currency || "BRL"
      }).format(n || 0);
    } catch {
      return `R$ ${(n || 0).toFixed(2)}`;
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function categoryById(id) {
    return state.categories.find(c => c.id === id) || { id, name: id, type: "expense", color: "#64748b" };
  }

  function txInMonth(tx, mk) {
    return tx.date.startsWith(mk);
  }

  function toast(msg, ms = 2200) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), ms);
  }

  /* ------------------ Tema ------------------ */
  function applyTheme(theme) {
    state.theme = theme;
    if (theme === "auto") {
      document.documentElement.removeAttribute("data-theme");
      const dark = matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    saveState();
  }

  /* ------------------ Navegação ------------------ */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.dataset.screen === name));
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.go === name));
    const titles = { dashboard: "Resumo", transactions: "Transações", budgets: "Orçamentos & Metas", settings: "Configurações" };
    document.getElementById("screenTitle").textContent = titles[name] || "Finanças";
    window.scrollTo({ top: 0 });
  }

  /* ------------------ Render: cabeçalho ------------------ */
  function renderGreeting() {
    const h = new Date().getHours();
    const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const name = state.userName ? `, ${state.userName}` : "";
    document.getElementById("greeting").textContent = `${period}${name}!`;
  }

  /* ------------------ Render: dashboard ------------------ */
  function changeMonth(delta) {
    const [y, m] = state.currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    state.currentMonth = monthKey(d);
    renderDashboard();
  }

  function renderDashboard() {
    document.getElementById("monthLabel").textContent =
      monthLabel(state.currentMonth).replace(/^./, c => c.toUpperCase());

    const txs = state.transactions.filter(t => txInMonth(t, state.currentMonth));
    const income = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    document.getElementById("balanceValue").textContent = formatMoney(balance);
    document.getElementById("incomeValue").textContent = formatMoney(income);
    document.getElementById("expenseValue").textContent = formatMoney(expense);

    renderCategoryChart(txs);
    renderTrendChart();
    renderRecent();
  }

  function renderCategoryChart(monthTxs) {
    const el = document.getElementById("categoryChart");
    const legend = document.getElementById("categoryLegend");
    const expenses = monthTxs.filter(t => t.type === "expense");
    legend.innerHTML = "";
    if (expenses.length === 0) {
      el.innerHTML = `<p class="empty" style="margin:0">Sem despesas neste mês.</p>`;
      return;
    }

    const totals = {};
    expenses.forEach(t => {
      totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount;
    });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    const size = 200, r = 70, cx = size / 2, cy = size / 2, stroke = 28;
    let acc = 0;
    const C = 2 * Math.PI * r;
    let segs = "";
    entries.forEach(([catId, val]) => {
      const cat = categoryById(catId);
      const frac = val / total;
      const dash = frac * C;
      segs += `<circle cx="${cx}" cy="${cy}" r="${r}"
        stroke="${cat.color}" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${dash} ${C - dash}"
        stroke-dashoffset="${-acc}"
        transform="rotate(-90 ${cx} ${cy})" />`;
      acc += dash;

      legend.insertAdjacentHTML("beforeend", `
        <li>
          <span class="swatch" style="background:${cat.color}"></span>
          <span>${cat.name}</span>
          <span class="legend-amount">${(frac * 100).toFixed(0)}%</span>
        </li>`);
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" stroke="var(--surface-2)" stroke-width="${stroke}" fill="none"/>
        ${segs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--text-muted)" font-size="11">Total</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="var(--text)" font-size="16" font-weight="700">${formatMoney(total)}</text>
      </svg>`;
  }

  function renderTrendChart() {
    const el = document.getElementById("trendChart");
    const months = [];
    const [cy, cm] = state.currentMonth.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cy, cm - 1 - i, 1);
      months.push(monthKey(d));
    }
    const data = months.map(mk => {
      const txs = state.transactions.filter(t => txInMonth(t, mk));
      return {
        mk,
        income: txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      };
    });

    const max = Math.max(1, ...data.flatMap(d => [d.income, d.expense]));
    const W = 320, H = 180, padX = 14, padY = 24, gap = 8;
    const groupW = (W - padX * 2) / data.length;
    const barW = (groupW - gap) / 2;

    let bars = "";
    let labels = "";
    data.forEach((d, i) => {
      const x = padX + i * groupW;
      const hIn = ((H - padY * 2) * d.income) / max;
      const hOut = ((H - padY * 2) * d.expense) / max;
      bars += `
        <rect x="${x}" y="${H - padY - hIn}" width="${barW}" height="${hIn}" rx="3" fill="var(--income)" opacity=".85"/>
        <rect x="${x + barW + 2}" y="${H - padY - hOut}" width="${barW}" height="${hOut}" rx="3" fill="var(--expense)" opacity=".85"/>`;
      const label = new Date(...d.mk.split("-").map((v, idx) => idx === 1 ? Number(v) - 1 : Number(v)), 1)
        .toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      labels += `<text x="${x + groupW / 2 - gap / 2}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${label}</text>`;
    });

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <line x1="${padX}" y1="${H - padY}" x2="${W - padX}" y2="${H - padY}" stroke="var(--border)"/>
        ${bars}
        ${labels}
      </svg>
      <div class="row gap" style="justify-content:center;margin-top:4px;font-size:.78rem;color:var(--text-muted)">
        <span><span class="swatch" style="display:inline-block;width:10px;height:10px;background:var(--income);border-radius:2px;margin-right:4px"></span>Receitas</span>
        <span><span class="swatch" style="display:inline-block;width:10px;height:10px;background:var(--expense);border-radius:2px;margin-right:4px"></span>Despesas</span>
      </div>`;
  }

  function renderRecent() {
    const list = document.getElementById("recentList");
    const recent = state.transactions
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5);
    if (recent.length === 0) {
      list.innerHTML = `<li class="empty" style="padding:14px 0">Adicione sua primeira transação no botão +.</li>`;
      return;
    }
    list.innerHTML = recent.map(txItemHTML).join("");
    list.querySelectorAll("[data-tx]").forEach(el => {
      el.addEventListener("click", () => openTxModal(el.dataset.tx));
    });
  }

  function txItemHTML(tx) {
    const cat = categoryById(tx.categoryId);
    const icon = CATEGORY_ICONS[cat.id] || (tx.type === "income" ? "💰" : "💸");
    const sign = tx.type === "income" ? "+" : "−";
    return `
      <li class="tx-item" data-tx="${tx.id}">
        <div class="tx-icon ${tx.type}">${icon}</div>
        <div class="tx-body">
          <div class="tx-desc">${escapeHtml(tx.description)}</div>
          <div class="tx-meta">${cat.name} · ${formatDate(tx.date)}</div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${formatMoney(tx.amount)}</div>
      </li>`;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }

  /* ------------------ Render: transações ------------------ */
  let txFilter = { type: "all", q: "" };

  function renderTransactions() {
    const list = document.getElementById("allTransactions");
    const empty = document.getElementById("emptyTx");
    const q = txFilter.q.trim().toLowerCase();
    let txs = state.transactions.slice();
    if (txFilter.type !== "all") txs = txs.filter(t => t.type === txFilter.type);
    if (q) {
      txs = txs.filter(t => {
        const cat = categoryById(t.categoryId);
        return t.description.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q);
      });
    }
    txs.sort((a, b) => (a.date < b.date ? 1 : -1));

    if (txs.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    const groups = {};
    txs.forEach(t => {
      const k = t.date.slice(0, 7);
      (groups[k] = groups[k] || []).push(t);
    });

    list.innerHTML = Object.entries(groups).map(([k, arr]) => {
      const total = arr.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      const label = monthLabel(k).replace(/^./, c => c.toUpperCase());
      return `
        <li class="tx-group-header"><span>${label}</span><span>${formatMoney(total)}</span></li>
        ${arr.map(txItemHTML).join("")}
      `;
    }).join("");

    list.querySelectorAll("[data-tx]").forEach(el => {
      el.addEventListener("click", () => openTxModal(el.dataset.tx));
    });
  }

  /* ------------------ Modal transação ------------------ */
  function refreshTxCategorySelect() {
    const type = document.getElementById("txType").value;
    const sel = document.getElementById("txCategory");
    const opts = state.categories.filter(c => c.type === type);
    sel.innerHTML = opts.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  function openTxModal(id) {
    const modal = document.getElementById("txModal");
    const titleEl = document.getElementById("txModalTitle");
    const delBtn = document.getElementById("txDeleteBtn");
    const form = document.getElementById("txForm");
    form.reset();

    if (id) {
      const tx = state.transactions.find(t => t.id === id);
      if (!tx) return;
      titleEl.textContent = "Editar transação";
      delBtn.classList.remove("hidden");
      document.getElementById("txId").value = tx.id;
      setTxType(tx.type);
      document.getElementById("txAmount").value = tx.amount.toFixed(2).replace(".", ",");
      document.getElementById("txDescription").value = tx.description;
      refreshTxCategorySelect();
      document.getElementById("txCategory").value = tx.categoryId;
      document.getElementById("txDate").value = tx.date;
    } else {
      titleEl.textContent = "Nova transação";
      delBtn.classList.add("hidden");
      document.getElementById("txId").value = "";
      setTxType("expense");
      document.getElementById("txDate").value = todayIso();
      refreshTxCategorySelect();
    }
    openModal(modal);
  }

  function setTxType(type) {
    document.getElementById("txType").value = type;
    document.querySelectorAll("#txTypeSwitch button").forEach(b =>
      b.classList.toggle("active", b.dataset.type === type)
    );
    refreshTxCategorySelect();
  }

  function submitTx(e) {
    e.preventDefault();
    const id = document.getElementById("txId").value;
    const amount = parseAmount(document.getElementById("txAmount").value);
    if (amount <= 0) { toast("Informe um valor válido."); return; }
    const tx = {
      id: id || uid(),
      type: document.getElementById("txType").value,
      amount,
      description: document.getElementById("txDescription").value.trim() || "Sem descrição",
      categoryId: document.getElementById("txCategory").value,
      date: document.getElementById("txDate").value || todayIso()
    };
    if (id) {
      const idx = state.transactions.findIndex(t => t.id === id);
      state.transactions[idx] = tx;
      toast("Transação atualizada.");
    } else {
      state.transactions.push(tx);
      toast("Transação adicionada.");
    }
    saveState();
    closeAllModals();
    renderAll();
  }

  function deleteTx() {
    const id = document.getElementById("txId").value;
    if (!id) return;
    if (!confirm("Excluir esta transação?")) return;
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    closeAllModals();
    renderAll();
    toast("Transação excluída.");
  }

  /* ------------------ Orçamentos ------------------ */
  function renderBudgets() {
    const list = document.getElementById("budgetList");
    const empty = document.getElementById("emptyBudgets");
    const keys = Object.keys(state.budgets);
    if (keys.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    const cm = monthKey(new Date());
    list.innerHTML = keys.map(catId => {
      const limit = state.budgets[catId];
      const spent = state.transactions
        .filter(t => t.type === "expense" && t.categoryId === catId && txInMonth(t, cm))
        .reduce((s, t) => s + t.amount, 0);
      const pct = Math.min(100, (spent / limit) * 100);
      const over = spent > limit;
      const cat = categoryById(catId);
      return `
        <li class="budget-item" data-budget="${catId}">
          <div class="budget-head">
            <span>${CATEGORY_ICONS[cat.id] || "🔹"} ${cat.name}</span>
            <span style="color:${over ? "var(--expense)" : "var(--text)"}">${formatMoney(spent)} / ${formatMoney(limit)}</span>
          </div>
          <div class="bar ${over ? "over" : ""}"><span style="width:${pct}%"></span></div>
          <div class="budget-meta">
            <span>${over ? `Excedido em ${formatMoney(spent - limit)}` : `Restam ${formatMoney(limit - spent)}`}</span>
            <span>${pct.toFixed(0)}%</span>
          </div>
        </li>`;
    }).join("");

    list.querySelectorAll("[data-budget]").forEach(el => {
      el.addEventListener("click", () => openBudgetModal(el.dataset.budget));
    });
  }

  function openBudgetModal(categoryId) {
    const sel = document.getElementById("budgetCategory");
    sel.innerHTML = state.categories
      .filter(c => c.type === "expense")
      .map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    if (categoryId) {
      sel.value = categoryId;
      document.getElementById("budgetAmount").value = (state.budgets[categoryId] || 0).toFixed(2).replace(".", ",");
    } else {
      document.getElementById("budgetAmount").value = "";
    }
    openModal(document.getElementById("budgetModal"));
  }

  function submitBudget(e) {
    e.preventDefault();
    const cat = document.getElementById("budgetCategory").value;
    const amount = parseAmount(document.getElementById("budgetAmount").value);
    if (amount <= 0) {
      delete state.budgets[cat];
      toast("Orçamento removido.");
    } else {
      state.budgets[cat] = amount;
      toast("Orçamento salvo.");
    }
    saveState();
    closeAllModals();
    renderBudgets();
  }

  /* ------------------ Metas ------------------ */
  function renderGoals() {
    const list = document.getElementById("goalList");
    const empty = document.getElementById("emptyGoals");
    if (state.goals.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = state.goals.map(g => {
      const pct = Math.min(100, (g.current / g.target) * 100);
      return `
        <li class="goal-item" data-goal="${g.id}">
          <div class="goal-head">
            <span>🎯 ${escapeHtml(g.name)}</span>
            <span>${formatMoney(g.current)} / ${formatMoney(g.target)}</span>
          </div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="goal-meta">
            <span>${pct.toFixed(0)}% concluída</span>
            <span>${g.deadline ? "Até " + formatDate(g.deadline) : "Sem prazo"}</span>
          </div>
        </li>`;
    }).join("");

    list.querySelectorAll("[data-goal]").forEach(el => {
      el.addEventListener("click", () => openGoalModal(el.dataset.goal));
    });
  }

  function openGoalModal(id) {
    const form = document.getElementById("goalForm");
    const delBtn = document.getElementById("goalDeleteBtn");
    form.reset();
    if (id) {
      const g = state.goals.find(x => x.id === id);
      if (!g) return;
      document.getElementById("goalModalTitle").textContent = "Editar meta";
      document.getElementById("goalId").value = g.id;
      document.getElementById("goalName").value = g.name;
      document.getElementById("goalTarget").value = g.target.toFixed(2).replace(".", ",");
      document.getElementById("goalCurrent").value = g.current.toFixed(2).replace(".", ",");
      document.getElementById("goalDeadline").value = g.deadline || "";
      delBtn.classList.remove("hidden");
    } else {
      document.getElementById("goalModalTitle").textContent = "Nova meta";
      document.getElementById("goalId").value = "";
      delBtn.classList.add("hidden");
    }
    openModal(document.getElementById("goalModal"));
  }

  function submitGoal(e) {
    e.preventDefault();
    const id = document.getElementById("goalId").value;
    const goal = {
      id: id || uid(),
      name: document.getElementById("goalName").value.trim() || "Meta",
      target: parseAmount(document.getElementById("goalTarget").value),
      current: parseAmount(document.getElementById("goalCurrent").value),
      deadline: document.getElementById("goalDeadline").value || undefined
    };
    if (goal.target <= 0) { toast("Defina um valor alvo válido."); return; }
    if (id) {
      const idx = state.goals.findIndex(g => g.id === id);
      state.goals[idx] = goal;
      toast("Meta atualizada.");
    } else {
      state.goals.push(goal);
      toast("Meta criada.");
    }
    saveState();
    closeAllModals();
    renderGoals();
  }

  function deleteGoal() {
    const id = document.getElementById("goalId").value;
    if (!id) return;
    if (!confirm("Excluir esta meta?")) return;
    state.goals = state.goals.filter(g => g.id !== id);
    saveState();
    closeAllModals();
    renderGoals();
  }

  /* ------------------ Configurações ------------------ */
  function renderSettings() {
    document.getElementById("userName").value = state.userName || "";
    document.getElementById("currencySelect").value = state.currency || "BRL";
    renderCategoryEditor();
  }

  function renderCategoryEditor() {
    const ul = document.getElementById("categoryEditor");
    ul.innerHTML = state.categories.map(c => `
      <li>
        <span class="swatch" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c.color}"></span>
        <span>${escapeHtml(c.name)}</span>
        <span class="pill">${c.type === "income" ? "Receita" : "Despesa"}</span>
        <button class="remove" data-remove="${c.id}" aria-label="Remover">×</button>
      </li>
    `).join("");
    ul.querySelectorAll("[data-remove]").forEach(b => {
      b.addEventListener("click", () => removeCategory(b.dataset.remove));
    });
  }

  function addCategory() {
    const nameEl = document.getElementById("newCategory");
    const typeEl = document.getElementById("newCategoryType");
    const name = nameEl.value.trim();
    if (!name) { toast("Digite um nome para a categoria."); return; }
    const id = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 30) || uid();
    if (state.categories.some(c => c.id === id)) { toast("Já existe uma categoria com esse nome."); return; }
    const palette = ["#6366f1","#22d3ee","#10b981","#f59e0b","#ec4899","#8b5cf6","#ef4444","#64748b"];
    state.categories.push({ id, name, type: typeEl.value, color: palette[state.categories.length % palette.length] });
    saveState();
    nameEl.value = "";
    renderCategoryEditor();
    toast("Categoria adicionada.");
  }

  function removeCategory(id) {
    const used = state.transactions.some(t => t.categoryId === id);
    if (used) {
      if (!confirm("Existem transações nessa categoria. Excluir mesmo assim? Elas serão movidas para 'Outros'.")) return;
      state.transactions.forEach(t => { if (t.categoryId === id) t.categoryId = "outros"; });
    }
    state.categories = state.categories.filter(c => c.id !== id);
    delete state.budgets[id];
    saveState();
    renderCategoryEditor();
    renderAll();
    toast("Categoria removida.");
  }

  /* ------------------ Import / Export / Reset ------------------ */
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `financas-backup-${todayIso()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
    toast("Backup gerado.");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.transactions) throw new Error("formato inválido");
        if (!confirm("Substituir os dados atuais pelo arquivo importado?")) return;
        state = { ...state, ...data, currentMonth: monthKey(new Date()) };
        saveState();
        renderAll();
        toast("Dados importados!");
      } catch (e) {
        toast("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!confirm("Isso vai apagar TODAS as transações, orçamentos e metas. Confirmar?")) return;
    if (!confirm("Tem certeza? Esta ação é irreversível.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = {
      userName: "", currency: "BRL", theme: "auto",
      transactions: [], categories: DEFAULT_CATEGORIES.slice(),
      budgets: {}, goals: [], currentMonth: monthKey(new Date())
    };
    saveState();
    renderAll();
    toast("Dados apagados.");
  }

  /* ------------------ Modais ------------------ */
  function openModal(modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeAllModals() {
    document.querySelectorAll(".modal.open").forEach(m => {
      m.classList.remove("open");
      m.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "";
  }

  /* ------------------ Render geral ------------------ */
  function renderAll() {
    renderGreeting();
    renderDashboard();
    renderTransactions();
    renderBudgets();
    renderGoals();
    renderSettings();
  }

  /* ------------------ Eventos ------------------ */
  function bindEvents() {
    document.getElementById("themeToggle").addEventListener("click", toggleTheme);

    document.querySelectorAll("[data-go]").forEach(el => {
      el.addEventListener("click", () => showScreen(el.dataset.go));
    });

    document.getElementById("prevMonth").addEventListener("click", () => changeMonth(-1));
    document.getElementById("nextMonth").addEventListener("click", () => changeMonth(1));

    document.getElementById("fabAdd").addEventListener("click", () => openTxModal());

    document.querySelectorAll("#txTypeSwitch button").forEach(b => {
      b.addEventListener("click", () => setTxType(b.dataset.type));
    });

    document.getElementById("txForm").addEventListener("submit", submitTx);
    document.getElementById("txDeleteBtn").addEventListener("click", deleteTx);

    document.querySelectorAll("[data-close]").forEach(el => {
      el.addEventListener("click", closeAllModals);
    });

    document.getElementById("searchInput").addEventListener("input", e => {
      txFilter.q = e.target.value;
      renderTransactions();
    });
    document.querySelectorAll("#typeFilter .chip").forEach(c => {
      c.addEventListener("click", () => {
        document.querySelectorAll("#typeFilter .chip").forEach(x => x.classList.remove("active"));
        c.classList.add("active");
        txFilter.type = c.dataset.filter;
        renderTransactions();
      });
    });

    document.getElementById("addBudgetBtn").addEventListener("click", () => openBudgetModal());
    document.getElementById("budgetForm").addEventListener("submit", submitBudget);

    document.getElementById("addGoalBtn").addEventListener("click", () => openGoalModal());
    document.getElementById("goalForm").addEventListener("submit", submitGoal);
    document.getElementById("goalDeleteBtn").addEventListener("click", deleteGoal);

    document.getElementById("userName").addEventListener("change", e => {
      state.userName = e.target.value.trim(); saveState(); renderGreeting();
    });
    document.getElementById("currencySelect").addEventListener("change", e => {
      state.currency = e.target.value; saveState(); renderAll();
    });
    document.getElementById("addCategoryBtn").addEventListener("click", addCategory);

    document.getElementById("exportBtn").addEventListener("click", exportData);
    document.getElementById("importBtn").addEventListener("click", () =>
      document.getElementById("importFile").click()
    );
    document.getElementById("importFile").addEventListener("change", e => {
      const f = e.target.files?.[0]; if (f) importData(f);
      e.target.value = "";
    });
    document.getElementById("resetBtn").addEventListener("click", resetData);

    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
      if (state.theme === "auto") applyTheme("auto");
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeAllModals();
    });
  }

  /* ------------------ Boot ------------------ */
  function boot() {
    loadState();
    applyTheme(state.theme || "auto");
    bindEvents();
    renderAll();
    showScreen("dashboard");

    setTimeout(() => {
      const s = document.getElementById("splash");
      if (s) s.classList.add("hidden");
    }, 350);

    const action = new URLSearchParams(location.search).get("action");
    if (action === "new-expense") {
      setTimeout(() => { openTxModal(); setTxType("expense"); }, 400);
    } else if (action === "new-income") {
      setTimeout(() => { openTxModal(); setTxType("income"); }, 400);
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(err =>
          console.warn("SW registration failed:", err)
        );
      });
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
