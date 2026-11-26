/* ==========================================================================
   DOMPETKU - Kontroler UI, Kalender, Menu Titik Tiga & Tema Waktu (js/app.js)
   ========================================================================== */

(() => {
  const {
    getTodayISO,
    getCurrentMonthKey,
    loadState,
    saveState,
    resetAllData,
    parseRupiah,
    formatNumberID,
    formatRupiah,
    generateId
  } = DompetkuStorage;

  const {
    getCategoryLabel,
    formatRecurringPreview,
    suggestDailyLimit,
    computeBalances,
    computeDailyGuardrail,
    computeGoalProgress,
    computeMonthStats
  } = DompetkuFinance;

  let appState = null;
  let currentTab = "home";
  let calendarMonthKey = getCurrentMonthKey();
  let selectedCalendarDate = getTodayISO();
  let tutorialIndex = 0;
  let onboardingStep = 1;
  const selectedLeaks = new Set();
  let currentTxType = "expense";
  let toastTimer = null;

  const TUTORIAL_STEPS = [
    {
      visual: "💰",
      title: "Uang Siap Pakai vs Ditahan",
      desc: "Saldo utama adalah uang bebas pakaimu. Tabungan ditahan dan catatan utang dipisah agar tidak ikut terpakai."
    },
    {
      visual: "🛑",
      title: "Rem Tangan Batas Harian",
      desc: "Indikator aman, hampir habis, dan lewat batas muncul langsung saat kamu mencatat pengeluaran."
    },
    {
      visual: "🎯",
      title: "Target Tabungan & Estimasi Jujur",
      desc: "Pantau progres target tabunganmu. Estimasi tercapai baru dihitung setelah minimal 2 kali setoran."
    },
    {
      visual: "⋮",
      title: "Menu Titik Tiga di Pojok Atas",
      desc: "Dipakai untuk ubah batas harian, target tabungan, catatan utang, ulangi panduan, atau reset data."
    }
  ];

  // ---------- Tema Waktu & Jam ----------
  function detectTimeTheme(dateObj = new Date()) {
    const minutes = dateObj.getHours() * 60 + dateObj.getMinutes();
    if (minutes >= 270 && minutes < 660) return "morning";     // 04:30 - 10:59
    if (minutes >= 660 && minutes < 900) return "afternoon";   // 11:00 - 14:59
    if (minutes >= 900 && minutes < 1080) return "evening";    // 15:00 - 17:59
    return "night";                                            // 18:00 - 04:29
  }

  function applyTimeTheme() {
    const now = new Date();
    const theme = detectTimeTheme(now);
    document.documentElement.setAttribute("data-time-theme", theme);

    const metaTheme = document.getElementById("metaThemeColor");
    const themeColors = {
      morning: "#0284c7",
      afternoon: "#1d4ed8",
      evening: "#c2410c",
      night: "#0b1120"
    };
    if (metaTheme) metaTheme.setAttribute("content", themeColors[theme] || "#0f172a");

    const greetings = {
      morning: "Selamat Pagi",
      afternoon: "Selamat Siang",
      evening: "Selamat Sore",
      night: "Selamat Malam"
    };
    const greetText = greetings[theme] || "Halo";

    const greetEl = document.getElementById("timeGreetingText");
    if (greetEl) greetEl.textContent = greetText;

    const loadGreetEl = document.getElementById("loadingGreeting");
    if (loadGreetEl) loadGreetEl.textContent = `${greetText}! Menyiapkan catatan keuanganmu...`;

    const clockEl = document.getElementById("liveClockBadge");
    if (clockEl) {
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      clockEl.textContent = `${hh}:${mm}`;
    }
  }

  // ---------- Karakter 2D + Fallback Aman ----------
  const MASCOT_FALLBACK_EMOJI = {
    neutral: "👋",
    happy: "😊",
    warn: "😬",
    danger: "🛑",
    proud: "🤩"
  };

  function setMascotState(imgId, fallbackId, stateKey) {
    const img = document.getElementById(imgId);
    const fb = document.getElementById(fallbackId);
    const safeKey = MASCOT_FALLBACK_EMOJI[stateKey] ? stateKey : "neutral";

    if (fb) fb.textContent = MASCOT_FALLBACK_EMOJI[safeKey];
    if (!img) return;

    img.dataset.state = safeKey;
    img.onerror = () => {
      img.classList.add("hidden");
      if (fb) fb.classList.remove("hidden");
    };
    img.onload = () => {
      img.classList.remove("hidden");
      if (fb) fb.classList.add("hidden");
    };
    img.src = `assets/mascot/${safeKey}.png`;
  }

  function updateCompanionBanner(balances, guardrail, goalProg) {
    const moodTag = document.getElementById("companionMoodTag");
    const msgEl = document.getElementById("companionMessage");
    const name = appState.profile.name || "Teman";

    let stateKey = "happy";
    let tag = "Aman Terkendali";
    let msg = `Halo ${name}, cek sisa napas uangmu dulu sebelum jajan.`;

    if (goalProg.isAchieved) {
      stateKey = "proud";
      tag = "Target Tercapai";
      msg = `Mantap ${name}! Target "${appState.goal.title}" sudah tercapai.`;
    } else if (balances.usableBalance < 0) {
      stateKey = "danger";
      tag = "Saldo Minus";
      msg = `Perhatian ${name}: uang siap pakai tercatat minus. Cek lagi transaksi atau tabungan ditahan.`;
    } else if (guardrail.status === "danger") {
      stateKey = "danger";
      tag = "Lewat Batas Hari Ini";
      msg = `Rem dulu ${name}! Pengeluaran hari ini melewati batas ${formatRupiah(guardrail.limit)}.`;
    } else if (guardrail.status === "warn") {
      stateKey = "warn";
      tag = "Hampir Habis";
      msg = `Hati-hati ${name}, sisa batas aman hari ini tinggal ${formatRupiah(Math.max(0, guardrail.remaining))}.`;
    } else if (appState.transactions.length === 0) {
      stateKey = "neutral";
      tag = "Siap Dimulai";
      msg = `Halo ${name}, tekan + Catat untuk mulai mencatat pemasukan atau pengeluaran.`;
    }

    setMascotState("mainMascotImg", "mainMascotFallback", stateKey);
    if (moodTag) moodTag.textContent = tag;
    if (msgEl) msgEl.textContent = msg;
  }

  // ---------- Toast & Format Input Rupiah ----------
  function showToast(message) {
    const toast = document.getElementById("toastBanner");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 2600);
  }

  function bindCurrencyInputs() {
    document.querySelectorAll("input[data-currency]").forEach((input) => {
      input.addEventListener("input", () => {
        const raw = parseRupiah(input.value);
        input.value = raw > 0 ? formatNumberID(raw) : "";
      });
    });
  }

  function setCurrencyInput(id, num) {
    const el = document.getElementById(id);
    if (!el) return;
    const clean = parseRupiah(num);
    el.value = clean > 0 ? formatNumberID(clean) : "";
  }

  function escapeText(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Render Daftar & Tab ----------
  function renderTxItem(tx, allowEdit = true) {
    const li = document.createElement("li");
    li.className = "tx-item";
    const isInc = tx.type === "income";
    const freqMap = {
      daily: "Tiap hari",
      every3days: "±3–4 hari sekali",
      weekly: "Mingguan"
    };
    const freqNote = tx.frequency && freqMap[tx.frequency] ? ` • Rutin: ${freqMap[tx.frequency]}` : "";
    const catNote = !isInc ? ` • ${getCategoryLabel(tx.category)}` : " • Pemasukan";

    li.innerHTML = `
      <div class="tx-info">
        <div class="tx-title">${escapeText(tx.title || "Catatan")}</div>
        <div class="tx-meta">${escapeText(tx.date)}${escapeText(catNote)}${escapeText(freqNote)}</div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${isInc ? "text-income" : "text-expense"}">${isInc ? "+" : "-"}${formatRupiah(tx.amount)}</span>
        ${
          allowEdit
            ? `<div class="tx-actions">
                <button type="button" class="mini-btn edit" data-edit-tx="${escapeText(tx.id)}">Edit</button>
                <button type="button" class="mini-btn del" data-del-tx="${escapeText(tx.id)}">Hapus</button>
              </div>`
            : ""
        }
      </div>`;
    return li;
  }

  function renderHome() {
    const balances = computeBalances(appState);
    const guardrail = computeDailyGuardrail(appState, getTodayISO());
    const goalProg = computeGoalProgress(appState.goal);

    document.getElementById("headerUserName").textContent = appState.profile.name || "DOMPETKU";
    document.getElementById("currentMonthBadge").textContent = getCurrentMonthKey();
    document.getElementById("usableBalanceAmount").textContent =
      (balances.usableBalance < 0 ? "-" : "") + formatRupiah(Math.abs(balances.usableBalance));
    document.getElementById("lockedSavingsAmount").textContent = formatRupiah(balances.lockedSavings);
    document.getElementById("activeDebtAmount").textContent = formatRupiah(balances.unpaidDebtTotal);

    document.getElementById("dailyLimitSub").textContent =
      guardrail.limit > 0
        ? `Terpakai ${formatRupiah(guardrail.spent)} dari ${formatRupiah(guardrail.limit)}`
        : `Terpakai ${formatRupiah(guardrail.spent)} (batas belum diatur)`;

    const badge = document.getElementById("dailyStatusBadge");
    badge.className = `status-badge ${guardrail.badgeClass}`;
    badge.textContent = guardrail.badgeText;

    const bar = document.getElementById("dailyProgressBar");
    bar.className = `progress-fill ${guardrail.barClass}`;
    bar.style.width = `${guardrail.percent}%`;

    document.getElementById("dailyRemainingText").textContent =
      guardrail.limit > 0
        ? guardrail.remaining >= 0
          ? `Sisa aman hari ini: ${formatRupiah(guardrail.remaining)}`
          : `Lewat batas: ${formatRupiah(Math.abs(guardrail.remaining))}`
        : "Atur batas harian agar rem tangan aktif";

    document.getElementById("homeGoalTitle").textContent = appState.goal.title || "Belum ada target";
    document.getElementById("homeGoalSaved").textContent = formatRupiah(goalProg.saved);
    document.getElementById("homeGoalTarget").textContent = `dari ${formatRupiah(goalProg.target)}`;
    document.getElementById("homeGoalBar").style.width = `${goalProg.percent}%`;
    document.getElementById("homeGoalEta").textContent = goalProg.summaryText;

    const todayList = document.getElementById("todayTxList");
    const todayEmpty = document.getElementById("todayEmptyState");
    const todayTxs = appState.transactions.filter((t) => t.date === getTodayISO());
    todayList.innerHTML = "";
    todayEmpty.classList.toggle("hidden", todayTxs.length > 0);
    todayTxs.forEach((tx) => todayList.appendChild(renderTxItem(tx, true)));

    updateCompanionBanner(balances, guardrail, goalProg);
  }

  function renderSavings() {
    const goalProg = computeGoalProgress(appState.goal);
    document.getElementById("savGoalName").textContent = appState.goal.title || "Target Tabungan";
    document.getElementById("savCurrentAmount").textContent = formatRupiah(goalProg.saved);
    document.getElementById("savTargetSub").textContent = `Target: ${formatRupiah(goalProg.target)} (${goalProg.percent}%)`;
    document.getElementById("savProgressBar").style.width = `${goalProg.percent}%`;
    document.getElementById("savEtaDetail").textContent = goalProg.detailText;

    const debtList = document.getElementById("debtList");
    const debtEmpty = document.getElementById("debtEmptyState");
    debtList.innerHTML = "";
    debtEmpty.classList.toggle("hidden", appState.debts.length > 0);

    appState.debts.forEach((d) => {
      const li = document.createElement("li");
      li.className = "debt-item";
      const safeTitle = escapeText(d.title);
      li.innerHTML = `
        <div class="tx-info">
          <div class="tx-title">${d.paid ? `<s>${safeTitle}</s>` : safeTitle}</div>
          <div class="tx-meta">${d.dueDate ? `Tenggat: ${escapeText(d.dueDate)}` : "Tanpa tenggat"} • ${d.paid ? "Lunas" : "Aktif"}</div>
        </div>
        <div class="tx-right">
          <span class="tx-amount">${formatRupiah(d.amount)}</span>
          <button type="button" class="mini-btn" data-toggle-debt="${escapeText(d.id)}">${d.paid ? "Buka" : "Lunas"}</button>
          <button type="button" class="mini-btn del" data-del-debt="${escapeText(d.id)}">Hapus</button>
        </div>`;
      debtList.appendChild(li);
    });

    const histList = document.getElementById("savingsHistoryList");
    histList.innerHTML = "";
    [...(appState.goal.history || [])].reverse().forEach((h) => {
      const li = document.createElement("li");
      li.className = "tx-item";
      const isDep = h.type === "deposit";
      li.innerHTML = `
        <div class="tx-info">
          <div class="tx-title">${escapeText(h.note || (isDep ? "Setor Tabungan" : "Tarik ke Saldo"))}</div>
          <div class="tx-meta">${escapeText(h.date)}</div>
        </div>
        <span class="tx-amount ${isDep ? "text-income" : "text-expense"}">${isDep ? "+" : "-"}${formatRupiah(h.amount)}</span>`;
      histList.appendChild(li);
    });
  }

  function renderCalendarAndStats() {
    const stats = computeMonthStats(appState, calendarMonthKey);
    const [yStr, mStr] = calendarMonthKey.split("-");
    const year = parseInt(yStr, 10);
    const monthIdx = parseInt(mStr, 10) - 1;
    const monthLabel = new Date(year, monthIdx, 1).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });

    document.getElementById("statsMonthTitle").textContent = monthLabel;
    document.getElementById("monthIncomeTotal").textContent = formatRupiah(stats.income);
    document.getElementById("monthExpenseTotal").textContent = formatRupiah(stats.expense);
    document.getElementById("monthRecurringEst").textContent = formatRupiah(stats.recurringMonthly);
    document.getElementById("topLeakCategoryBox").innerHTML = stats.topCategoryLabel
      ? `Kategori paling banyak keluar di periode ini: <strong>${escapeText(stats.topCategoryLabel)}</strong> (${formatRupiah(stats.topCategoryAmount)})`
      : `Kategori paling banyak keluar di periode ini: <strong>-</strong>`;

    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    const firstDay = new Date(year, monthIdx, 1).getDay();
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();
    const datesWithTx = new Set(appState.transactions.map((t) => t.date));
    const todayISO = getTodayISO();

    for (let i = 0; i < firstDay; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-day empty";
      grid.appendChild(blank);
    }

    for (let d = 1; d <= totalDays; d++) {
      const iso = `${yStr}-${mStr}-${String(d).padStart(2, "0")}`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      if (iso === todayISO) btn.classList.add("today");
      if (iso === selectedCalendarDate) btn.classList.add("selected");
      btn.innerHTML = `<span>${d}</span>${datesWithTx.has(iso) ? '<span class="cal-dot"></span>' : ""}`;
      btn.addEventListener("click", () => {
        selectedCalendarDate = iso;
        renderCalendarAndStats();
      });
      grid.appendChild(btn);
    }

    const dayTxs = appState.transactions.filter((t) => t.date === selectedCalendarDate);
    const dayNet = dayTxs.reduce(
      (sum, t) => sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)),
      0
    );
    document.getElementById("selectedDateHeading").textContent = `Transaksi ${selectedCalendarDate}`;
    document.getElementById("selectedDateNet").textContent =
      (dayNet < 0 ? "-" : "") + formatRupiah(Math.abs(dayNet));

    const listEl = document.getElementById("selectedDateTxList");
    const emptyEl = document.getElementById("selectedDateEmpty");
    listEl.innerHTML = "";
    emptyEl.classList.toggle("hidden", dayTxs.length > 0);
    dayTxs.forEach((tx) => listEl.appendChild(renderTxItem(tx, true)));
  }

  function renderAll() {
    renderHome();
    renderSavings();
    renderCalendarAndStats();
  }
   // ---------- Navigasi, Modal & Menu Titik Tiga ----------
  function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll(".view-section").forEach((sec) => sec.classList.add("hidden"));

    const viewMap = {
      home: "viewHome",
      savings: "viewSavings",
      calendar: "viewCalendar"
    };
    const target = document.getElementById(viewMap[tabName] || "viewHome");
    if (target) target.classList.remove("hidden");

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.nav === tabName);
    });

    renderAll();
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  }

  function openTxModal(editTx = null) {
    document.getElementById("txForm").reset();
    document.getElementById("txEditId").value = editTx ? editTx.id : "";
    document.getElementById("txModalTitle").textContent = editTx ? "Edit Transaksi" : "Catat Transaksi";
    currentTxType = editTx ? editTx.type : "expense";

    document.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.txType === currentTxType);
    });

    const isIncome = currentTxType === "income";
    document.getElementById("txCategoryGroup").classList.toggle("hidden", isIncome);
    document.getElementById("txRecurringGroup").classList.toggle("hidden", isIncome);

    if (editTx) {
      setCurrencyInput("txAmount", editTx.amount);
      document.getElementById("txTitle").value = editTx.title || "";
      document.getElementById("txCategory").value = editTx.category || "makan";
      document.getElementById("txFrequency").value = editTx.frequency || "once";
      document.getElementById("txDate").value = editTx.date || getTodayISO();
    } else {
      document.getElementById("txDate").value = selectedCalendarDate || getTodayISO();
      document.getElementById("txFrequency").value = "once";
    }

    const chipWrap = document.getElementById("quickTitleChips");
    const uniqueTitles = [
      ...new Set(appState.transactions.map((t) => (t.title || "").trim()).filter(Boolean))
    ].slice(0, 6);
    chipWrap.innerHTML = "";

    uniqueTitles.forEach((title) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip-btn";
      chip.textContent = title;
      chip.addEventListener("click", () => {
        document.getElementById("txTitle").value = title;
      });
      chipWrap.appendChild(chip);
    });

    document.getElementById("txRecurringPreview").textContent = formatRecurringPreview(
      document.getElementById("txAmount").value,
      document.getElementById("txFrequency").value
    );

    openModal("txModal");
  }

  function openSavingsActionModal(mode) {
    const bal = computeBalances(appState);
    document.getElementById("savActionMode").value = mode;
    document.getElementById("savModalTitle").textContent =
      mode === "deposit" ? "Setor ke Tabungan" : "Tarik ke Saldo";
    document.getElementById("savAvailableHint").textContent =
      mode === "deposit"
        ? `Uang siap pakai tersedia: ${formatRupiah(Math.max(0, bal.usableBalance))}`
        : `Saldo tabungan ditahan: ${formatRupiah(appState.goal.savedAmount)}`;
    document.getElementById("savActionAmount").value = "";
    document.getElementById("savActionNote").value = "";
    openModal("savingsModal");
  }

  // ---------- Tutorial Singkat ----------
  function renderTutorialStep() {
    const step = TUTORIAL_STEPS[tutorialIndex] || TUTORIAL_STEPS[0];
    document.getElementById("tutStepBadge").textContent = `Panduan ${tutorialIndex + 1}/${TUTORIAL_STEPS.length}`;
    document.getElementById("tutVisual").textContent = step.visual;
    document.getElementById("tutTitle").textContent = step.title;
    document.getElementById("tutDesc").textContent = step.desc;
    document.getElementById("btnNextTutorial").textContent =
      tutorialIndex === TUTORIAL_STEPS.length - 1 ? "Selesai" : "Mengerti, Lanjut";
  }

  function startTutorial() {
    tutorialIndex = 0;
    renderTutorialStep();
    document.getElementById("tutorialOverlay").classList.remove("hidden");
  }

  function finishTutorial() {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    appState.meta.tutorialDone = true;
    saveState(appState);
  }

  // ---------- Onboarding ----------
  function setOnboardingStep(stepNum) {
    onboardingStep = stepNum;
    document.querySelectorAll(".onboarding-step").forEach((el) => {
      el.classList.toggle("hidden", Number(el.dataset.step) !== stepNum);
    });
    const mascotByStep = { 1: "neutral", 2: "happy", 3: "warn" };
    setMascotState("onboardingMascotImg", "onboardingMascotFallback", mascotByStep[stepNum] || "neutral");
  }

  // ---------- Aksi Menu Titik Tiga (⋮) ----------
  function handleMoreMenuAction(action) {
    const menuDrop = document.getElementById("moreMenuDropdown");
    const btnMore = document.getElementById("btnMoreMenu");
    menuDrop.classList.add("hidden");
    btnMore.setAttribute("aria-expanded", "false");

    if (action === "open-settings") {
      document.getElementById("setUserName").value = appState.profile.name || "";
      setCurrencyInput("setMonthlyIncome", appState.profile.monthlyIncome);
      setCurrencyInput("setDailyLimit", appState.profile.dailyLimit);
      const sug = suggestDailyLimit(appState.profile, appState.debts);
      document.getElementById("autoLimitSuggestion").textContent =
        sug > 0 ? `Saran otomatis: ${formatRupiah(sug)}/hari` : "Saran otomatis: isi pemasukan bulanan dulu";
      openModal("settingsModal");
    } else if (action === "open-goal-modal") {
      document.getElementById("goalNameInput").value = appState.goal.title || "";
      setCurrencyInput("goalTargetInput", appState.goal.targetAmount);
      openModal("goalModal");
    } else if (action === "open-debt-modal") {
      document.getElementById("debtForm").reset();
      openModal("debtModal");
    } else if (action === "replay-tutorial") {
      startTutorial();
    } else if (action === "reset-data") {
      if (confirm("Reset semua data DOMPETKU dan mulai dari awal?")) {
        appState = resetAllData();
        selectedLeaks.clear();
        document.querySelectorAll("#obLeakChips .chip-btn").forEach((c) => c.classList.remove("active"));
        calendarMonthKey = getCurrentMonthKey();
        selectedCalendarDate = getTodayISO();
        renderAll();
        document.getElementById("onboardingOverlay").classList.remove("hidden");
        setOnboardingStep(1);
        showToast("Semua data telah direset bersih.");
      }
    }
  }

  // ---------- Event Listeners ----------
  function bindEvents() {
    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", () => switchTab(el.dataset.nav));
    });

    const btnMore = document.getElementById("btnMoreMenu");
    const menuDrop = document.getElementById("moreMenuDropdown");

    btnMore.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = menuDrop.classList.contains("hidden");
      menuDrop.classList.toggle("hidden", !willOpen);
      btnMore.setAttribute("aria-expanded", String(willOpen));
    });

    document.addEventListener("click", () => {
      menuDrop.classList.add("hidden");
      btnMore.setAttribute("aria-expanded", "false");
    });

    document.querySelectorAll("#moreMenuDropdown [data-action]").forEach((item) => {
      item.addEventListener("click", () => handleMoreMenuAction(item.dataset.action));
    });

    document.querySelectorAll('[data-action="open-settings"]').forEach((btn) => {
      btn.addEventListener("click", () => handleMoreMenuAction("open-settings"));
    });

    document.querySelectorAll('[data-action="open-goal-modal"]').forEach((btn) => {
      btn.addEventListener("click", () => handleMoreMenuAction("open-goal-modal"));
    });

    document.querySelectorAll('[data-action="open-debt-modal"]').forEach((btn) => {
      btn.addEventListener("click", () => handleMoreMenuAction("open-debt-modal"));
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });

    document.getElementById("btnOpenAddTx").addEventListener("click", () => openTxModal(null));

    document.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTxType = btn.dataset.txType;
        document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
        const isIncome = currentTxType === "income";
        document.getElementById("txCategoryGroup").classList.toggle("hidden", isIncome);
        document.getElementById("txRecurringGroup").classList.toggle("hidden", isIncome);
      });
    });

    ["txAmount", "txFrequency"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        document.getElementById("txRecurringPreview").textContent = formatRecurringPreview(
          document.getElementById("txAmount").value,
          document.getElementById("txFrequency").value
        );
      });
    });

    document.getElementById("txForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseRupiah(document.getElementById("txAmount").value);
      const title = document.getElementById("txTitle").value.trim();
      const date = document.getElementById("txDate").value || getTodayISO();
      const editId = document.getElementById("txEditId").value;

      if (amount <= 0) return showToast("Masukkan nominal lebih dari Rp0.");
      if (!title) return showToast("Isi keterangan singkat transaksinya.");

      const payload = {
        id: editId || generateId("tx"),
        type: currentTxType,
        amount,
        title,
        category: currentTxType === "expense" ? document.getElementById("txCategory").value : "pemasukan",
        frequency: currentTxType === "expense" ? document.getElementById("txFrequency").value : "once",
        date
      };

      if (editId) {
        const idx = appState.transactions.findIndex((t) => t.id === editId);
        if (idx !== -1) appState.transactions[idx] = payload;
        showToast("Catatan diperbarui.");
      } else {
        appState.transactions.unshift(payload);
        showToast("Catatan tersimpan.");
      }

      saveState(appState);
      renderAll();
      closeModal("txModal");
    });

    document.body.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-tx]");
      if (editBtn) {
        const found = appState.transactions.find((t) => t.id === editBtn.dataset.editTx);
        if (found) openTxModal(found);
        return;
      }

      const delBtn = e.target.closest("[data-del-tx]");
      if (delBtn) {
        appState.transactions = appState.transactions.filter((t) => t.id !== delBtn.dataset.delTx);
        saveState(appState);
        renderAll();
        showToast("Catatan dihapus.");
        return;
      }

      const togDebt = e.target.closest("[data-toggle-debt]");
      if (togDebt) {
        const debt = appState.debts.find((item) => item.id === togDebt.dataset.toggleDebt);
        if (debt) {
          debt.paid = !debt.paid;
          saveState(appState);
          renderAll();
        }
        return;
      }

      const delDebt = e.target.closest("[data-del-debt]");
      if (delDebt) {
        appState.debts = appState.debts.filter((item) => item.id !== delDebt.dataset.delDebt);
        saveState(appState);
        renderAll();
        showToast("Catatan utang dihapus.");
      }
    });

    document.getElementById("btnQuickSave").addEventListener("click", () => openSavingsActionModal("deposit"));
    document.getElementById("btnOpenDeposit").addEventListener("click", () => openSavingsActionModal("deposit"));
    document.getElementById("btnOpenWithdraw").addEventListener("click", () => openSavingsActionModal("withdraw"));

    document.getElementById("savingsActionForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const mode = document.getElementById("savActionMode").value;
      const amount = parseRupiah(document.getElementById("savActionAmount").value);
      const note = document.getElementById("savActionNote").value.trim();

      if (amount <= 0) return showToast("Masukkan nominal lebih dari Rp0.");
      if (mode === "withdraw" && amount > appState.goal.savedAmount) {
        return showToast("Nominal tarik melebihi saldo tabungan.");
      }

      appState.goal.savedAmount =
        mode === "deposit"
          ? appState.goal.savedAmount + amount
          : Math.max(0, appState.goal.savedAmount - amount);

      appState.goal.history.push({
        id: generateId("sav"),
        type: mode,
        amount,
        note: note || (mode === "deposit" ? "Setor tabungan" : "Tarik ke saldo"),
        date: getTodayISO()
      });

      saveState(appState);
      renderAll();
      closeModal("savingsModal");
      showToast(mode === "deposit" ? "Dana masuk ke tabungan ditahan." : "Dana ditarik ke saldo siap pakai.");
    });

    document.querySelectorAll("#obGoalPresets .chip-btn, #modalGoalPresets .chip-btn").forEach((chip) => {
      chip.addEventListener("click", () => {
        const inputEl = chip.closest("#obGoalPresets")
          ? document.getElementById("obGoalName")
          : document.getElementById("goalNameInput");
        if (inputEl) inputEl.value = chip.dataset.goal;
      });
    });

    document.getElementById("goalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("goalNameInput").value.trim();
      const targetAmount = parseRupiah(document.getElementById("goalTargetInput").value);
      if (!title) return showToast("Isi nama target tabungan.");

      appState.goal.title = title;
      appState.goal.targetAmount = targetAmount;
      saveState(appState);
      renderAll();
      closeModal("goalModal");
      showToast("Target tabungan diperbarui.");
    });

    document.getElementById("btnApplyAutoLimit").addEventListener("click", () => {
      const inc = parseRupiah(document.getElementById("setMonthlyIncome").value) || appState.profile.monthlyIncome;
      const sug = suggestDailyLimit({ ...appState.profile, monthlyIncome: inc }, appState.debts);
      if (sug > 0) setCurrencyInput("setDailyLimit", sug);
      else showToast("Isi perkiraan pemasukan bulanan dulu.");
    });

    document.getElementById("settingsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("setUserName").value.trim();
      if (name) appState.profile.name = name;
      appState.profile.monthlyIncome = parseRupiah(document.getElementById("setMonthlyIncome").value);
      appState.profile.dailyLimit = parseRupiah(document.getElementById("setDailyLimit").value);
      saveState(appState);
      renderAll();
      closeModal("settingsModal");
      showToast("Pengaturan tersimpan.");
    });

    document.getElementById("debtForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("debtTitle").value.trim();
      const amount = parseRupiah(document.getElementById("debtAmount").value);
      const dueDate = document.getElementById("debtDueDate").value || "";
      if (!title || amount <= 0) return showToast("Lengkapi nama dan nominal utang/cicilan.");

      appState.debts.push({
        id: generateId("debt"),
        title,
        amount,
        dueDate,
        paid: false
      });

      saveState(appState);
      renderAll();
      closeModal("debtModal");
      showToast("Catatan kewajiban disimpan.");
    });

    document.getElementById("btnPrevMonth").addEventListener("click", () => {
      const [y, m] = calendarMonthKey.split("-").map(Number);
      const prev = new Date(y, m - 2, 1);
      calendarMonthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      renderCalendarAndStats();
    });

    document.getElementById("btnNextMonth").addEventListener("click", () => {
      const [y, m] = calendarMonthKey.split("-").map(Number);
      const next = new Date(y, m, 1);
      calendarMonthKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      renderCalendarAndStats();
    });

    document.getElementById("btnNextTutorial").addEventListener("click", () => {
      if (tutorialIndex < TUTORIAL_STEPS.length - 1) {
        tutorialIndex += 1;
        renderTutorialStep();
      } else {
        finishTutorial();
      }
    });

    document.getElementById("btnSkipTutorial").addEventListener("click", finishTutorial);

    document.getElementById("btnObNext1").addEventListener("click", () => {
      const name = document.getElementById("obUserName").value.trim();
      if (name) appState.profile.name = name;
      appState.profile.monthlyIncome = parseRupiah(document.getElementById("obMonthlyIncome").value);
      const sug = suggestDailyLimit(appState.profile, appState.debts);
      if (sug > 0) appState.profile.dailyLimit = sug;
      setOnboardingStep(2);
    });

    document.getElementById("btnObSkip2").addEventListener("click", () => setOnboardingStep(3));

    document.getElementById("btnObNext2").addEventListener("click", () => {
      const gName = document.getElementById("obGoalName").value.trim();
      const gAmt = parseRupiah(document.getElementById("obGoalAmount").value);
      if (gName) appState.goal.title = gName;
      if (gAmt > 0) appState.goal.targetAmount = gAmt;
      setOnboardingStep(3);
    });

    document.querySelectorAll("#obLeakChips .chip-btn").forEach((chip) => {
      chip.addEventListener("click", () => {
        const leakKey = chip.dataset.leak;
        if (selectedLeaks.has(leakKey)) {
          selectedLeaks.delete(leakKey);
          chip.classList.remove("active");
        } else {
          selectedLeaks.add(leakKey);
          chip.classList.add("active");
        }
      });
    });

    const completeOnboarding = () => {
      appState.profile.leaks = [...selectedLeaks];
      appState.profile.customLeak = document.getElementById("obCustomLeak").value.trim();
      appState.meta.onboardingDone = true;
      saveState(appState);
      document.getElementById("onboardingOverlay").classList.add("hidden");
      renderAll();
      if (!appState.meta.tutorialDone) startTutorial();
    };

    document.getElementById("btnObFinishSkip").addEventListener("click", completeOnboarding);
    document.getElementById("btnObFinish").addEventListener("click", completeOnboarding);
  }

  // ---------- Inisialisasi ----------
  function init() {
    applyTimeTheme();
    setInterval(applyTimeTheme, 30000);
    bindCurrencyInputs();

    const loaded = loadState();
    appState = loaded.state;
    renderAll();
    bindEvents();

    setTimeout(() => {
      const loader = document.getElementById("loadingScreen");
      loader.classList.add("fade-out");
      setTimeout(() => loader.classList.add("hidden"), 350);

      document.getElementById("appShell").classList.remove("hidden");

      if (!appState.meta.onboardingDone) {
        setOnboardingStep(1);
        document.getElementById("onboardingOverlay").classList.remove("hidden");
      } else if (!appState.meta.tutorialDone) {
        startTutorial();
      }

      if (loaded.periodChanged) {
        showToast(`Periode bulan baru (${getCurrentMonthKey()}) aktif. Riwayat kalender tetap aman.`);
      }
    }, 550);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

