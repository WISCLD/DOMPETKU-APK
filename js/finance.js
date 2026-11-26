/* ==========================================================================
   DOMPETKU - Logika Keuangan, Batas Harian, Estimasi & Beban Rutin (js/finance.js)
   ========================================================================== */

const DompetkuFinance = (() => {
  const CATEGORY_LABELS = {
    makan: "🍜 Makan & Minum",
    transport: "⛽ Transport & Bensin",
    jajan: "☕ Jajan & Nongkrong",
    kebutuhan: "🛒 Kebutuhan Harian",
    tagihan: "🧾 Tagihan & Pulsa",
    lainnya: "📦 Lainnya"
  };

  function getCategoryLabel(category) {
    return CATEGORY_LABELS[category] || "📦 Lainnya";
  }

  // Hitung estimasi bulanan dari pengeluaran berulang unik
  function estimateMonthlyRecurring(transactions) {
    if (!Array.isArray(transactions) || transactions.length === 0) return 0;

    const uniquePatterns = new Map();

    transactions.forEach((tx) => {
      if (!tx || tx.type !== "expense") return;
      const freq = tx.frequency || "once";
      if (freq === "once") return;

      const amt = Number(tx.amount) || 0;
      if (amt <= 0) return;

      const key = `${(tx.title || "").trim().toLowerCase()}|${tx.category || "lainnya"}|${freq}`;
      uniquePatterns.set(key, { amount: amt, frequency: freq });
    });

    let monthlyTotal = 0;
    uniquePatterns.forEach(({ amount, frequency }) => {
      if (frequency === "daily") monthlyTotal += amount * 30;
      else if (frequency === "every3days") monthlyTotal += amount * 10;
      else if (frequency === "weekly") monthlyTotal += amount * 4;
    });

    return Math.round(monthlyTotal);
  }

  function formatRecurringPreview(amount, frequency) {
    const cleanAmt = DompetkuStorage.parseRupiah(amount);
    if (!cleanAmt || !frequency || frequency === "once") return "";

    let estMonthly = 0;
    let label = "";

    if (frequency === "daily") {
      estMonthly = cleanAmt * 30;
      label = "tiap hari";
    } else if (frequency === "every3days") {
      estMonthly = cleanAmt * 10;
      label = "±3–4 hari sekali";
    } else if (frequency === "weekly") {
      estMonthly = cleanAmt * 4;
      label = "mingguan";
    }

    return `Perkiraan beban jika ${label}: ±${DompetkuStorage.formatRupiah(estMonthly)}/bulan.`;
  }

  // Saran batas harian otomatis dari pemasukan bulanan & kewajiban aktif
  function suggestDailyLimit(profile, debts) {
    const income = Math.max(0, Number(profile?.monthlyIncome) || 0);
    if (income <= 0) return 0;

    const unpaidDebt = (Array.isArray(debts) ? debts : [])
      .filter((d) => d && !d.paid)
      .reduce((sum, d) => sum + (Math.max(0, Number(d.amount) || 0)), 0);

    const netForMonth = Math.max(0, income - unpaidDebt * 0.5);
    const rawDaily = Math.round((netForMonth * 0.7) / 30);
    return Math.max(10000, Math.round(rawDaily / 5000) * 5000);
  }

  // Hitung saldo siap pakai, tabungan ditahan, dan kewajiban aktif
  function computeBalances(state) {
    const txs = Array.isArray(state?.transactions) ? state.transactions : [];
    const debts = Array.isArray(state?.debts) ? state.debts : [];
    const lockedSavings = Math.max(0, Number(state?.goal?.savedAmount) || 0);

    let totalIncome = 0;
    let totalExpense = 0;

    txs.forEach((tx) => {
      if (!tx) return;
      const amt = Math.max(0, Number(tx.amount) || 0);
      if (tx.type === "income") totalIncome += amt;
      else if (tx.type === "expense") totalExpense += amt;
    });

    const unpaidDebtTotal = debts
      .filter((d) => d && !d.paid)
      .reduce((sum, d) => sum + Math.max(0, Number(d.amount) || 0), 0);

    const usableBalance = totalIncome - totalExpense - lockedSavings;
    const netAfterDebt = usableBalance - unpaidDebtTotal;

    return {
      totalIncome,
      totalExpense,
      lockedSavings,
      unpaidDebtTotal,
      usableBalance,
      netAfterDebt
    };
  }

  // Pantau batas pengeluaran harian untuk tanggal tertentu (default hari ini)
  function computeDailyGuardrail(state, dateISO) {
    const targetDate = dateISO || DompetkuStorage.getTodayISO();
    const limit = Math.max(0, Number(state?.profile?.dailyLimit) || 0);
    const txs = Array.isArray(state?.transactions) ? state.transactions : [];

    const spent = txs
      .filter((tx) => tx && tx.type === "expense" && tx.date === targetDate)
      .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount) || 0), 0);

    if (limit <= 0) {
      return {
        spent,
        limit: 0,
        remaining: 0,
        ratio: 0,
        percent: 0,
        status: "unset",
        badgeText: "Belum Diatur",
        badgeClass: "status-safe",
        barClass: ""
      };
    }

    const ratio = spent / limit;
    const percent = Math.min(100, Math.round(ratio * 100));
    const remaining = limit - spent;

    let status = "safe";
    let badgeText = "Aman";
    let badgeClass = "status-safe";
    let barClass = "";

    if (spent > limit) {
      status = "danger";
      badgeText = "Lewat Batas";
      badgeClass = "status-danger";
      barClass = "danger";
    } else if (ratio >= 0.75) {
      status = "warn";
      badgeText = "Hampir Habis";
      badgeClass = "status-warn";
      barClass = "warn";
    }

    return {
      spent,
      limit,
      remaining,
      ratio,
      percent,
      status,
      badgeText,
      badgeClass,
      barClass
    };
  }

  // Estimasi jujur target tabungan (tidak menebak saat riwayat setoran < 2 kali)
  function computeGoalProgress(goal) {
    const target = Math.max(0, Number(goal?.targetAmount) || 0);
    const saved = Math.max(0, Number(goal?.savedAmount) || 0);
    const history = Array.isArray(goal?.history) ? goal.history : [];

    const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const remaining = Math.max(0, target - saved);

    if (target <= 0) {
      return {
        target,
        saved,
        remaining,
        percent,
        isAchieved: false,
        hasEnoughData: false,
        summaryText: "Target belum diatur.",
        detailText: "Atur nama dan nominal target tabunganmu dulu."
      };
    }

    if (saved >= target) {
      return {
        target,
        saved,
        remaining: 0,
        percent: 100,
        isAchieved: true,
        hasEnoughData: true,
        summaryText: "Target tabungan sudah tercapai!",
        detailText: "Mantap! Tabunganmu sudah menyentuh nominal target."
      };
    }

    const deposits = history.filter(
      (h) => h && h.type === "deposit" && (Number(h.amount) || 0) > 0
    );

    if (deposits.length < 2) {
      return {
        target,
        saved,
        remaining,
        percent,
        isAchieved: false,
        hasEnoughData: false,
        summaryText: "Estimasi belum cukup data (minimal 2x setor).",
        detailText:
          "Data setoran masih minim. Setor minimal 2 kali agar estimasi tercapai bisa dihitung secara jujur."
      };
    }

    const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
    const avgDeposit = totalDeposited / deposits.length;

    const sortedTimestamps = deposits
      .map((d) => new Date(`${d.date}T00:00:00`).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);

    const spanDays =
      sortedTimestamps.length >= 2
        ? Math.max(1, Math.round((sortedTimestamps[sortedTimestamps.length - 1] - sortedTimestamps[0]) / 86400000))
        : 7;

    const avgIntervalDays = Math.max(1, spanDays / (deposits.length - 1));
    const depositsNeeded = Math.ceil(remaining / avgDeposit);
    const estimatedDays = Math.max(1, Math.round(depositsNeeded * avgIntervalDays));

    const etaDate = new Date();
    etaDate.setDate(etaDate.getDate() + estimatedDays);
    const etaFormatted = etaDate.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    return {
      target,
      saved,
      remaining,
      percent,
      isAchieved: false,
      hasEnoughData: true,
      summaryText: `Perkiraan tercapai ±${estimatedDays} hari lagi (${etaFormatted})`,
      detailText: `Dari ${deposits.length}x setor (rata-rata ${DompetkuStorage.formatRupiah(
        Math.round(avgDeposit)
      )} tiap ±${Math.round(avgIntervalDays)} hari), sisa ${DompetkuStorage.formatRupiah(
        remaining
      )} diperkirakan tercapai sekitar ${etaFormatted}.`
    };
  }

  // Statistik bulanan (pemasukan, pengeluaran, beban rutin, kategori terboros)
  function computeMonthStats(state, monthKey) {
    const targetMonth = monthKey || DompetkuStorage.getCurrentMonthKey();
    const txs = (Array.isArray(state?.transactions) ? state.transactions : []).filter((tx) =>
      (tx?.date || "").startsWith(targetMonth)
    );

    let income = 0;
    let expense = 0;
    const categoryTotals = {};

    txs.forEach((tx) => {
      const amt = Math.max(0, Number(tx.amount) || 0);
      if (tx.type === "income") {
        income += amt;
      } else if (tx.type === "expense") {
        expense += amt;
        const cat = tx.category || "lainnya";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }
    });

    let topCategory = null;
    let topCategoryAmount = 0;

    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > topCategoryAmount) {
        topCategoryAmount = amt;
        topCategory = cat;
      }
    });

    const recurringMonthly = estimateMonthlyRecurring(state?.transactions || []);

    return {
      monthKey: targetMonth,
      income,
      expense,
      recurringMonthly,
      topCategoryLabel: topCategory ? getCategoryLabel(topCategory) : null,
      topCategoryAmount,
      txCount: txs.length
    };
  }

  return {
    getCategoryLabel,
    estimateMonthlyRecurring,
    formatRecurringPreview,
    suggestDailyLimit,
    computeBalances,
    computeDailyGuardrail,
    computeGoalProgress,
    computeMonthStats
  };
})();
