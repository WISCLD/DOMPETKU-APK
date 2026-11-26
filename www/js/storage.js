/* ==========================================================================
   DOMPETKU - Penyimpanan Lokal, Reset Data & Transisi Periode (js/storage.js)
   ========================================================================== */

const DompetkuStorage = (() => {
  const STORAGE_KEY = "dompetku_state_v1";

  function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getCurrentMonthKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function createDefaultState() {
    const today = getTodayISO();
    const monthKey = getCurrentMonthKey();

    return {
      meta: {
        version: 1,
        onboardingDone: false,
        tutorialDone: false,
        activePeriod: monthKey,
        lastOpenedDate: today,
        updatedAt: new Date().toISOString()
      },
      profile: {
        name: "Teman",
        monthlyIncome: 0,
        dailyLimit: 50000,
        leaks: [],
        customLeak: ""
      },
      goal: {
        title: "Dana Darurat",
        targetAmount: 1000000,
        savedAmount: 0,
        history: []
      },
      debts: [],
      transactions: []
    };
  }

  function mergeWithDefaults(raw) {
    const def = createDefaultState();
    if (!raw || typeof raw !== "object") return def;

    return {
      meta: {
        ...def.meta,
        ...(raw.meta || {}),
        version: def.meta.version
      },
      profile: {
        ...def.profile,
        ...(raw.profile || {}),
        monthlyIncome: Math.max(0, Number(raw.profile?.monthlyIncome) || 0),
        dailyLimit: Math.max(0, Number(raw.profile?.dailyLimit) || 0),
        leaks: Array.isArray(raw.profile?.leaks) ? raw.profile.leaks : []
      },
      goal: {
        ...def.goal,
        ...(raw.goal || {}),
        targetAmount: Math.max(0, Number(raw.goal?.targetAmount) || 0),
        savedAmount: Math.max(0, Number(raw.goal?.savedAmount) || 0),
        history: Array.isArray(raw.goal?.history) ? raw.goal.history : []
      },
      debts: Array.isArray(raw.debts) ? raw.debts : [],
      transactions: Array.isArray(raw.transactions) ? raw.transactions : []
    };
  }

  function checkAndHandlePeriodTransition(state) {
    const currentMonth = getCurrentMonthKey();
    const currentDate = getTodayISO();
    const periodChanged = Boolean(state.meta.activePeriod && state.meta.activePeriod !== currentMonth);

    state.meta.activePeriod = currentMonth;
    state.meta.lastOpenedDate = currentDate;

    return { state, periodChanged, currentMonth };
  }

  function loadState() {
    try {
      const rawStr = localStorage.getItem(STORAGE_KEY);
      if (!rawStr) {
        const fresh = createDefaultState();
        saveState(fresh);
        return { state: fresh, periodChanged: false, isNew: true };
      }

      const parsed = JSON.parse(rawStr);
      const merged = mergeWithDefaults(parsed);
      const { state, periodChanged } = checkAndHandlePeriodTransition(merged);
      saveState(state);

      return { state, periodChanged, isNew: false };
    } catch (err) {
      console.warn("Gagal membaca state lokal, membuat ulang state aman:", err);
      const fallback = createDefaultState();
      saveState(fallback);
      return { state: fallback, periodChanged: false, isNew: true };
    }
  }

  function saveState(state) {
    try {
      state.meta.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error("Gagal menyimpan state ke localStorage:", err);
      return false;
    }
  }

  function resetAllData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Gagal menghapus key localStorage:", err);
    }
    const fresh = createDefaultState();
    saveState(fresh);
    return fresh;
  }

  function parseRupiah(input) {
    if (typeof input === "number") return Number.isFinite(input) ? Math.max(0, Math.round(input)) : 0;
    const digitsOnly = String(input || "").replace(/[^\d]/g, "");
    const num = parseInt(digitsOnly, 10);
    return Number.isNaN(num) ? 0 : Math.max(0, num);
  }

  function formatNumberID(num) {
    const clean = Math.max(0, Math.round(Number(num) || 0));
    return clean.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function formatRupiah(num) {
    return `Rp${formatNumberID(num)}`;
  }

  function generateId(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  return {
    STORAGE_KEY,
    getTodayISO,
    getCurrentMonthKey,
    createDefaultState,
    loadState,
    saveState,
    resetAllData,
    parseRupiah,
    formatNumberID,
    formatRupiah,
    generateId
  };
})();

