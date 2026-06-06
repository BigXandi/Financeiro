/* ============================================================
 *  Finanças PWA - app.js
 *  Aplicação 100% client-side. Persistência em localStorage.
 *  ============================================================ */
(() => {
  "use strict";

  /* ------------------ Estado ------------------ */
  const STORAGE_KEY = "financas-pwa:v2";

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

  /** @typedef {{ id:string, type:"income"|"expense", amount:number, description:string, categoryId:string, date:string, status?:"paid"|"pending", cardId?:string, installmentGroupId?:string, installmentNumber?:number, installmentTotal?:number }} Tx */
  /** @typedef {{ id:string, name:string, target:number, current:number, deadline?:string }} Goal */
  /** @typedef {{ id:string, name:string, limit:number, statementBalance:number, dueDay:number }} CreditCard */

  let state = {
    userName: "",
    currency: "BRL",
    theme: "auto",
    transactions: /** @type {Tx[]} */ ([]),
    categories: DEFAULT_CATEGORIES.slice(),
    budgets: /** @type {Record<string, number>} */ ({}),
    goals: /** @type {Goal[]} */ ([]),
    creditCards: /** @type {CreditCard[]} */ ([]),
    currentMonth: monthKey(new Date()),
    selectedCalDay: /** @type {number|null} */ (null)
  };

  /* ------------------ Persistência ------------------ */
  function loadState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        raw = localStorage.getItem("financas-pwa:v1");
        if (raw) {
          const data = JSON.parse(raw);
          state = { ...state, ...data, creditCards: data.creditCards || [] };
          state.transactions = (state.transactions || []).map(t => ({ ...t, status: t.status || "paid" }));
          saveState();
          return;
        }
        return;
      }
      const data = JSON.parse(raw);
      state = { ...state, ...data };
      if (!state.categories || state.categories.length === 0) {
        state.categories = DEFAULT_CATEGORIES.slice();
      }
      if (!state.creditCards) state.creditCards = [];
      state.transactions = (state.transactions || []).map(t => ({ ...t, status: t.status || "paid" }));
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

  function cardById(id) {
    return state.creditCards.find(c => c.id === id);
  }

  function txStatus(tx) {
    return tx.status || "paid";
  }

  function isPending(tx) {
    return txStatus(tx) === "pending";
  }

  function isOverdue(tx) {
    return isPending(tx) && tx.date < todayIso();
  }

  function txInMonth(tx, mk) {
    return tx.date.startsWith(mk);
  }

  function monthTotals(mk) {
    const txs = state.transactions.filter(t => txInMonth(t, mk));
    const paid = txs.filter(t => !isPending(t));
    const pending = txs.filter(t => isPending(t));
    const incomePaid = paid.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expensePaid = paid.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const incomePending = pending.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expensePending = pending.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return {
      incomePaid, expensePaid, balancePaid: incomePaid - expensePaid,
      incomePending, expensePending,
      balanceProjected: (incomePaid + incomePending) - (expensePaid + expensePending)
    };
  }

  function addMonthsIso(iso, months) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1 + months, d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  }

  function isoFromParts(y, m, d) {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function cardPendingTotal(cardId) {
    return state.transactions
      .filter(t => t.cardId === cardId && t.type === "expense" && isPending(t))
      .reduce((s, t) => s + t.amount, 0);
  }

  function cardProjectedBalance(card) {
    return (card.statementBalance || 0) + cardPendingTotal(card.id);
  }

  function nextCardDueIso(card, ref = new Date()) {
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const day = Math.min(card.dueDay, 28);
    let due = new Date(y, m, day);
    if (due < ref) due = new Date(y, m + 1, day);
    return isoFromParts(due.getFullYear(), due.getMonth() + 1, due.getDate());
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
    const titles = { dashboard: "Resumo", transactions: "Transações", planning: "Planejamento", settings: "Configurações" };
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
    state.selectedCalDay = null;
    renderDashboard();
    renderPlanning();
  }

  function renderDashboard() {
    document.getElementById("monthLabel").textContent =
      monthLabel(state.currentMonth).replace(/^./, c => c.toUpperCase());

    const totals = monthTotals(state.currentMonth);
    document.getElementById("balanceValue").textContent = formatMoney(totals.balancePaid);
    document.getElementById("incomeValue").textContent = formatMoney(totals.incomePaid);
    document.getElementById("expenseValue").textContent = formatMoney(totals.expensePaid);

    const projEl = document.getElementById("balanceProjection");
    const pendingCount = state.transactions.filter(t => isPending(t) && txInMonth(t, state.currentMonth)).length;
    if (pendingCount > 0 || totals.balanceProjected !== totals.balancePaid) {
      const diff = totals.balanceProjected - totals.balancePaid;
      const sign = diff >= 0 ? "+" : "−";
      projEl.innerHTML = `Projeção com agendados: <strong>${formatMoney(totals.balanceProjected)}</strong> (${sign}${formatMoney(Math.abs(diff))}) · ${pendingCount} pendente${pendingCount !== 1 ? "s" : ""}`;
    } else {
      projEl.textContent = "";
    }

    const monthTxs = state.transactions.filter(t => txInMonth(t, state.currentMonth) && !isPending(t));
    renderCategoryChart(monthTxs);
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
      const t = monthTotals(mk);
      return { mk, income: t.incomePaid, expense: t.expensePaid };
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

  function txStatusBadge(tx) {
    if (!isPending(tx)) return "";
    const cls = isOverdue(tx) ? "overdue" : "pending";
    const label = isOverdue(tx) ? "Atrasado" : "Agendado";
    return `<span class="tx-badge ${cls}">${label}</span>`;
  }

  function txItemHTML(tx) {
    const cat = categoryById(tx.categoryId);
    const icon = CATEGORY_ICONS[cat.id] || (tx.type === "income" ? "💰" : "💸");
    const sign = tx.type === "income" ? "+" : "−";
    const card = tx.cardId ? cardById(tx.cardId) : null;
    const inst = tx.installmentTotal > 1 ? ` · ${tx.installmentNumber}/${tx.installmentTotal}` : "";
    const dateLabel = isPending(tx) ? `Vence ${formatDate(tx.date)}` : formatDate(tx.date);
    const pendingCls = isPending(tx) ? " pending" : "";
    return `
      <li class="tx-item${pendingCls}" data-tx="${tx.id}">
        <div class="tx-icon ${tx.type}">${icon}</div>
        <div class="tx-body">
          <div class="tx-desc">${escapeHtml(tx.description)}${txStatusBadge(tx)}</div>
          <div class="tx-meta">${cat.name}${card ? " · " + escapeHtml(card.name) : ""}${inst} · ${dateLabel}</div>
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
    if (txFilter.type === "pending") txs = txs.filter(t => isPending(t));
    else if (txFilter.type !== "all") txs = txs.filter(t => t.type === txFilter.type);
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

  function refreshTxCardSelect() {
    const sel = document.getElementById("txCard");
    sel.innerHTML = `<option value="">Nenhum</option>` +
      state.creditCards.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  }

  function setTxStatus(status) {
    document.getElementById("txStatusSwitch").dataset.status = status;
    document.querySelectorAll("#txStatusSwitch button").forEach(b =>
      b.classList.toggle("active", b.dataset.status === status)
    );
    const pending = status === "pending";
    document.getElementById("txDateLabel").textContent = pending ? "Data de vencimento" : "Data";
    document.getElementById("txInstallmentFields").classList.toggle("hidden", !pending);
    document.getElementById("txCardField").classList.toggle("hidden", document.getElementById("txType").value === "income");
  }

  function openTxModal(id, opts = {}) {
    const modal = document.getElementById("txModal");
    const titleEl = document.getElementById("txModalTitle");
    const delBtn = document.getElementById("txDeleteBtn");
    const payBtn = document.getElementById("txPayBtn");
    const form = document.getElementById("txForm");
    form.reset();
    refreshTxCardSelect();

    if (id) {
      const tx = state.transactions.find(t => t.id === id);
      if (!tx) return;
      titleEl.textContent = isPending(tx) ? "Editar agendamento" : "Editar transação";
      delBtn.classList.remove("hidden");
      payBtn.classList.toggle("hidden", !isPending(tx));
      document.getElementById("txId").value = tx.id;
      setTxType(tx.type);
      document.getElementById("txAmount").value = tx.amount.toFixed(2).replace(".", ",");
      document.getElementById("txDescription").value = tx.description;
      refreshTxCategorySelect();
      document.getElementById("txCategory").value = tx.categoryId;
      document.getElementById("txDate").value = tx.date;
      setTxStatus(txStatus(tx));
      document.getElementById("txCard").value = tx.cardId || "";
      document.getElementById("txInstallments").value = "1";
      document.getElementById("txInstallmentFields").classList.add("hidden");
    } else {
      titleEl.textContent = opts.planned ? "Agendar conta" : "Nova transação";
      delBtn.classList.add("hidden");
      payBtn.classList.add("hidden");
      document.getElementById("txId").value = "";
      setTxType(opts.type || "expense");
      document.getElementById("txDate").value = todayIso();
      setTxStatus(opts.planned ? "pending" : "paid");
      refreshTxCategorySelect();
      document.getElementById("txInstallments").value = "1";
    }
    document.getElementById("txCardField").classList.toggle("hidden", document.getElementById("txType").value === "income");
    openModal(modal);
  }

  function setTxType(type) {
    document.getElementById("txType").value = type;
    document.querySelectorAll("#txTypeSwitch button").forEach(b =>
      b.classList.toggle("active", b.dataset.type === type)
    );
    refreshTxCategorySelect();
    document.getElementById("txCardField").classList.toggle("hidden", type === "income");
  }

  function buildTxFromForm() {
    const status = document.getElementById("txStatusSwitch").dataset.status || "paid";
    const cardId = document.getElementById("txCard").value || undefined;
    return {
      type: document.getElementById("txType").value,
      amount: parseAmount(document.getElementById("txAmount").value),
      description: document.getElementById("txDescription").value.trim() || "Sem descrição",
      categoryId: document.getElementById("txCategory").value,
      date: document.getElementById("txDate").value || todayIso(),
      status,
      cardId: status === "pending" ? cardId : (cardId || undefined)
    };
  }

  function updateCardStatement(cardId, delta) {
    const card = cardById(cardId);
    if (card) card.statementBalance = Math.max(0, (card.statementBalance || 0) + delta);
  }

  function submitTx(e) {
    e.preventDefault();
    const id = document.getElementById("txId").value;
    const base = buildTxFromForm();
    if (base.amount <= 0) { toast("Informe um valor válido."); return; }

    if (id) {
      const prev = state.transactions.find(t => t.id === id);
      const tx = { ...prev, ...base, id };
      const idx = state.transactions.findIndex(t => t.id === id);
      state.transactions[idx] = tx;
      if (prev?.cardId && prev.type === "expense" && !isPending(prev)) {
        updateCardStatement(prev.cardId, -prev.amount);
      }
      if (tx.cardId && tx.type === "expense" && !isPending(tx)) {
        updateCardStatement(tx.cardId, tx.amount);
      }
      toast(isPending(tx) ? "Agendamento atualizado." : "Transação atualizada.");
    } else {
      const installments = Math.max(1, parseInt(document.getElementById("txInstallments").value, 10) || 1);
      const isPlanned = base.status === "pending" && installments > 1;
      if (isPlanned) {
        const groupId = uid();
        const parcel = Math.round((base.amount / installments) * 100) / 100;
        let remainder = base.amount;
        for (let i = 0; i < installments; i++) {
          const amt = i === installments - 1 ? remainder : parcel;
          remainder -= amt;
          state.transactions.push({
            id: uid(),
            ...base,
            amount: amt,
            description: `${base.description} (${i + 1}/${installments})`,
            date: addMonthsIso(base.date, i),
            installmentGroupId: groupId,
            installmentNumber: i + 1,
            installmentTotal: installments
          });
        }
        toast(`${installments} parcelas agendadas.`);
      } else {
        const tx = { id: uid(), ...base };
        state.transactions.push(tx);
        if (tx.cardId && tx.type === "expense" && !isPending(tx)) {
          updateCardStatement(tx.cardId, tx.amount);
        }
        if (isPending(tx) && tx.cardId) {
          const card = cardById(tx.cardId);
          toast(`Agendado. Projeção ${card?.name}: ${formatMoney(cardProjectedBalance(card))}.`);
        } else {
          toast(isPending(tx) ? "Conta agendada." : "Transação adicionada.");
        }
      }
    }
    saveState();
    closeAllModals();
    renderAll();
  }

  function markTxAsPaid() {
    const id = document.getElementById("txId").value;
    if (!id) return;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx || !isPending(tx)) return;
    tx.status = "paid";
    tx.date = todayIso();
    if (tx.cardId && tx.type === "expense") {
      updateCardStatement(tx.cardId, tx.amount);
    }
    saveState();
    closeAllModals();
    renderAll();
    toast(tx.type === "income" ? "Recebimento confirmado." : "Pagamento confirmado.");
  }

  function deleteTx() {
    const id = document.getElementById("txId").value;
    if (!id) return;
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    const msg = tx.installmentGroupId
      ? "Excluir todas as parcelas deste agendamento?"
      : "Excluir esta transação?";
    if (!confirm(msg)) return;
    if (tx.installmentGroupId) {
      state.transactions = state.transactions.filter(t => t.installmentGroupId !== tx.installmentGroupId);
    } else {
      if (tx.cardId && tx.type === "expense" && !isPending(tx)) {
        updateCardStatement(tx.cardId, -tx.amount);
      }
      state.transactions = state.transactions.filter(t => t.id !== id);
    }
    saveState();
    closeAllModals();
    renderAll();
    toast("Excluído.");
  }

  /* ------------------ Planejamento ------------------ */
  function renderPlanning() {
    const mk = state.currentMonth;
    const totals = monthTotals(mk);
    document.getElementById("planningMonthLabel").textContent =
      monthLabel(mk).replace(/^./, c => c.toUpperCase());
    document.getElementById("planRealized").textContent = formatMoney(totals.balancePaid);
    document.getElementById("planProjected").textContent = formatMoney(totals.balanceProjected);
    document.getElementById("planPendingOut").textContent = formatMoney(totals.expensePending);
    document.getElementById("planPendingIn").textContent = formatMoney(totals.incomePending);
    renderPlannedList();
    renderCreditCards();
    renderCalendar();
  }

  function getCalendarEvents(mk) {
    const [y, m] = mk.split("-").map(Number);
    /** @type {{ date:string, kind:string, label:string, amount?:number, type?:string, id?:string, overdue?:boolean }[]} */
    const events = [];

    state.transactions.filter(t => txInMonth(t, mk)).forEach(tx => {
      events.push({
        date: tx.date,
        kind: isPending(tx) ? (isOverdue(tx) ? "overdue" : tx.type) : "paid-" + tx.type,
        label: tx.description,
        amount: tx.amount,
        type: tx.type,
        id: tx.id,
        overdue: isOverdue(tx)
      });
    });

    state.creditCards.forEach(card => {
      const day = Math.min(card.dueDay, 28);
      const date = isoFromParts(y, m, day);
      const projected = cardProjectedBalance(card);
      events.push({
        date,
        kind: "card",
        label: `Fatura ${card.name}`,
        amount: projected,
        type: "card",
        id: card.id
      });
    });

    return events.sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderCalendar() {
    const calEl = document.getElementById("dueCalendar");
    const labelEl = document.getElementById("calMonthLabel");
    if (!calEl) return;

    const mk = state.currentMonth;
    const [y, m] = mk.split("-").map(Number);
    labelEl.textContent = monthLabel(mk).replace(/^./, c => c.toUpperCase());

    const events = getCalendarEvents(mk);
    const byDay = {};
    events.forEach(ev => {
      const day = parseInt(ev.date.split("-")[2], 10);
      (byDay[day] = byDay[day] || []).push(ev);
    });

    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startPad = first.getDay();
    const today = todayIso();
    const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    let html = weekdays.map(w => `<div class="cal-weekday">${w}</div>`).join("");
    for (let i = 0; i < startPad; i++) html += `<div class="cal-day empty" aria-hidden="true"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = isoFromParts(y, m, day);
      const dayEvents = byDay[day] || [];
      const classes = ["cal-day"];
      if (iso === today) classes.push("today");
      if (state.selectedCalDay === day) classes.push("selected");
      if (dayEvents.length) classes.push("has-events");

      const dots = dayEvents.slice(0, 4).map(ev => {
        let cls = "expense";
        if (ev.kind === "card") cls = "card";
        else if (ev.kind === "income") cls = "income";
        else if (ev.overdue || ev.kind === "overdue") cls = "overdue";
        return `<span class="cal-dot ${cls}"></span>`;
      }).join("");

      html += `
        <button type="button" class="${classes.join(" ")}" data-cal-day="${day}" aria-label="Dia ${day}">
          <span>${day}</span>
          ${dots ? `<span class="cal-dots">${dots}</span>` : ""}
        </button>`;
    }

    calEl.innerHTML = html;
    calEl.querySelectorAll("[data-cal-day]").forEach(btn => {
      btn.addEventListener("click", () => selectCalDay(parseInt(btn.dataset.calDay, 10)));
    });

    if (state.selectedCalDay) renderCalDayDetail(state.selectedCalDay);
    else document.getElementById("calDayDetail").classList.add("hidden");
  }

  function selectCalDay(day) {
    state.selectedCalDay = state.selectedCalDay === day ? null : day;
    renderCalendar();
  }

  function renderCalDayDetail(day) {
    const wrap = document.getElementById("calDayDetail");
    const title = document.getElementById("calDayTitle");
    const list = document.getElementById("calDayList");
    const [y, m] = state.currentMonth.split("-").map(Number);
    const iso = isoFromParts(y, m, day);
    const events = getCalendarEvents(state.currentMonth).filter(ev => ev.date === iso);

    if (!state.selectedCalDay || events.length === 0) {
      wrap.classList.toggle("hidden", !state.selectedCalDay);
      if (state.selectedCalDay && events.length === 0) {
        title.textContent = `${formatDate(iso)} — sem vencimentos`;
        list.innerHTML = "";
        wrap.classList.remove("hidden");
      }
      return;
    }

    wrap.classList.remove("hidden");
    title.textContent = formatDate(iso);
    list.innerHTML = events.map(ev => {
      if (ev.type === "card") {
        const card = cardById(ev.id);
        const pending = card ? cardPendingTotal(card.id) : 0;
        const current = card ? card.statementBalance : 0;
        return `
          <li data-card="${ev.id}">
            <div>
              <span class="cal-ev-label">💳 ${escapeHtml(ev.label)}</span>
              ${pending > 0 ? `<span class="muted" style="font-size:.75rem;display:block;margin-top:2px">${formatMoney(current)} + ${formatMoney(pending)} agendado</span>` : ""}
            </div>
            <span class="cal-ev-amount">${formatMoney(ev.amount)}</span>
          </li>`;
      }
      const sign = ev.type === "income" ? "+" : "−";
      const status = ev.overdue ? " (atrasado)" : (ev.kind.startsWith("paid") ? "" : " (agendado)");
      return `
        <li class="${ev.overdue ? "overdue" : ""}" data-tx="${ev.id}">
          <span class="cal-ev-label">${ev.type === "income" ? "📥" : "📤"} ${escapeHtml(ev.label)}${status}</span>
          <span class="cal-ev-amount">${sign}${formatMoney(ev.amount)}</span>
        </li>`;
    }).join("");

    list.querySelectorAll("[data-tx]").forEach(el => {
      el.addEventListener("click", () => openTxModal(el.dataset.tx));
    });
    list.querySelectorAll("[data-card]").forEach(el => {
      el.addEventListener("click", () => openCardModal(el.dataset.card));
    });
  }

  function renderPlannedList() {
    const list = document.getElementById("plannedList");
    const empty = document.getElementById("emptyPlanned");
    const pending = state.transactions
      .filter(t => isPending(t))
      .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

    if (pending.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = pending.map(tx => {
      const cat = categoryById(tx.categoryId);
      const card = tx.cardId ? cardById(tx.cardId) : null;
      const overdue = isOverdue(tx);
      const inst = tx.installmentTotal > 1 ? `Parcela ${tx.installmentNumber}/${tx.installmentTotal}` : "";
      return `
        <li class="planned-item${overdue ? " overdue" : ""}" data-planned="${tx.id}">
          <div class="planned-head">
            <span>${tx.type === "income" ? "📥" : "📤"} ${escapeHtml(tx.description)}</span>
            <span class="${tx.type}">${tx.type === "income" ? "+" : "−"}${formatMoney(tx.amount)}</span>
          </div>
          <div class="planned-meta">
            <span>${cat.name}${card ? " · " + escapeHtml(card.name) : ""}</span>
            <span>${overdue ? "⚠ Atrasado · " : ""}Vence ${formatDate(tx.date)}${inst ? " · " + inst : ""}</span>
          </div>
          <div class="planned-actions">
            <button type="button" class="btn success" data-pay="${tx.id}">${tx.type === "income" ? "Recebi" : "Paguei"}</button>
            <button type="button" class="btn ghost" data-edit="${tx.id}">Editar</button>
          </div>
        </li>`;
    }).join("");

    list.querySelectorAll("[data-pay]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        quickPay(btn.dataset.pay);
      });
    });
    list.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        openTxModal(btn.dataset.edit);
      });
    });
    list.querySelectorAll("[data-planned]").forEach(el => {
      el.addEventListener("click", () => openTxModal(el.dataset.planned));
    });
  }

  function quickPay(id) {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx || !isPending(tx)) return;
    tx.status = "paid";
    tx.date = todayIso();
    if (tx.cardId && tx.type === "expense") {
      updateCardStatement(tx.cardId, tx.amount);
    }
    saveState();
    renderAll();
    toast(tx.type === "income" ? "Recebimento confirmado." : "Pagamento confirmado.");
  }

  function renderCreditCards() {
    const list = document.getElementById("cardList");
    const empty = document.getElementById("emptyCards");
    if (state.creditCards.length === 0) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    list.innerHTML = state.creditCards.map(card => {
      const used = card.statementBalance || 0;
      const pending = cardPendingTotal(card.id);
      const projected = used + pending;
      const limit = card.limit || 1;
      const pct = Math.min(100, (projected / limit) * 100);
      const available = limit - projected;
      const over = projected > limit;
      const dueIso = nextCardDueIso(card);
      const dueLabel = `Próx. vencimento: ${formatDate(dueIso)}`;
      const projectionHtml = pending > 0
        ? `<div class="card-projection">Projeção: <strong>${formatMoney(projected)}</strong> (${formatMoney(used)} fatura + ${formatMoney(pending)} agendado) · Disponível projetado: <strong>${formatMoney(available)}</strong></div>`
        : "";
      return `
        <li class="credit-card-item" data-card="${card.id}">
          <div class="card-head">
            <span>💳 ${escapeHtml(card.name)}</span>
            <span>${formatMoney(pending > 0 ? projected : used)}</span>
          </div>
          <div class="card-limit-bar${over ? " over" : ""}"><span style="width:${pct}%"></span></div>
          <div class="card-meta">
            <span>Fatura / Limite: ${formatMoney(used)} / ${formatMoney(limit)}</span>
            <span>Disponível: ${formatMoney(limit - (pending > 0 ? projected : used))}</span>
          </div>
          <div class="card-meta"><span>${dueLabel}</span></div>
          ${projectionHtml}
        </li>`;
    }).join("");

    list.querySelectorAll("[data-card]").forEach(el => {
      el.addEventListener("click", () => openCardModal(el.dataset.card));
    });
  }

  function populateDueDaySelect() {
    const sel = document.getElementById("cardDueDay");
    if (sel.options.length) return;
    sel.innerHTML = Array.from({ length: 28 }, (_, i) => {
      const d = i + 1;
      return `<option value="${d}">Dia ${d}</option>`;
    }).join("");
  }

  function openCardModal(id) {
    populateDueDaySelect();
    const form = document.getElementById("cardForm");
    const delBtn = document.getElementById("cardDeleteBtn");
    form.reset();
    if (id) {
      const card = cardById(id);
      if (!card) return;
      document.getElementById("cardModalTitle").textContent = "Editar cartão";
      document.getElementById("cardId").value = card.id;
      document.getElementById("cardName").value = card.name;
      document.getElementById("cardLimit").value = card.limit.toFixed(2).replace(".", ",");
      document.getElementById("cardStatement").value = card.statementBalance.toFixed(2).replace(".", ",");
      document.getElementById("cardDueDay").value = String(card.dueDay);
      delBtn.classList.remove("hidden");
    } else {
      document.getElementById("cardModalTitle").textContent = "Novo cartão";
      document.getElementById("cardId").value = "";
      document.getElementById("cardDueDay").value = "10";
      delBtn.classList.add("hidden");
    }
    openModal(document.getElementById("cardModal"));
  }

  function submitCard(e) {
    e.preventDefault();
    const id = document.getElementById("cardId").value;
    const card = {
      id: id || uid(),
      name: document.getElementById("cardName").value.trim() || "Cartão",
      limit: parseAmount(document.getElementById("cardLimit").value),
      statementBalance: parseAmount(document.getElementById("cardStatement").value),
      dueDay: parseInt(document.getElementById("cardDueDay").value, 10) || 10
    };
    if (card.limit <= 0) { toast("Informe um limite válido."); return; }
    if (id) {
      const idx = state.creditCards.findIndex(c => c.id === id);
      state.creditCards[idx] = card;
      toast("Cartão atualizado.");
    } else {
      state.creditCards.push(card);
      toast("Cartão cadastrado.");
    }
    saveState();
    closeAllModals();
    renderPlanning();
    refreshTxCardSelect();
  }

  function deleteCard() {
    const id = document.getElementById("cardId").value;
    if (!id) return;
    if (!confirm("Excluir este cartão? Transações vinculadas perderão a referência.")) return;
    state.creditCards = state.creditCards.filter(c => c.id !== id);
    state.transactions.forEach(t => { if (t.cardId === id) delete t.cardId; });
    saveState();
    closeAllModals();
    renderAll();
    toast("Cartão excluído.");
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
        .filter(t => t.type === "expense" && !isPending(t) && t.categoryId === catId && txInMonth(t, cm))
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
      budgets: {}, goals: [], creditCards: [], currentMonth: monthKey(new Date()), selectedCalDay: null
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
    renderPlanning();
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
    document.getElementById("calPrevMonth").addEventListener("click", () => changeMonth(-1));
    document.getElementById("calNextMonth").addEventListener("click", () => changeMonth(1));

    document.getElementById("fabAdd").addEventListener("click", () => openTxModal());

    document.querySelectorAll("#txTypeSwitch button").forEach(b => {
      b.addEventListener("click", () => setTxType(b.dataset.type));
    });

    document.querySelectorAll("#txStatusSwitch button").forEach(b => {
      b.addEventListener("click", () => setTxStatus(b.dataset.status));
    });

    document.getElementById("txForm").addEventListener("submit", submitTx);
    document.getElementById("txDeleteBtn").addEventListener("click", deleteTx);
    document.getElementById("txPayBtn").addEventListener("click", markTxAsPaid);

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

    document.getElementById("addPlannedBtn").addEventListener("click", () => openTxModal(null, { planned: true }));
    document.getElementById("addCardBtn").addEventListener("click", () => openCardModal());
    document.getElementById("cardForm").addEventListener("submit", submitCard);
    document.getElementById("cardDeleteBtn").addEventListener("click", deleteCard);

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
      setTimeout(() => { openTxModal(null, { type: "expense" }); }, 400);
    } else if (action === "new-income") {
      setTimeout(() => { openTxModal(null, { type: "income" }); }, 400);
    } else if (action === "new-planned") {
      setTimeout(() => { openTxModal(null, { planned: true }); }, 400);
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
