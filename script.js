// @ts-nocheck

// =====================================
// 1. KONFIGURASI & DATA PENYIMPANAN
// =====================================
const STORAGE_KEYS = {
    transactions: "dompetku_transactions",
    savings: "dompetku_savings",
    savingsLogs: "dompetku_savings_logs",
    nickname: "dompetku_nickname",
    recentNames: "dompetku_recent_names"
};

const POSE_HALO = "./assets/pose-halo.png";
const POSE_HAI = "./assets/pose-hai.png";
const TARGET_SAVINGS = 15000000;
const MAX_RECENT_NAMES = 6;

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || "[]");
let currentSavings = Number(localStorage.getItem(STORAGE_KEYS.savings)) || 0;
let savingsLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.savingsLogs) || "[]");
let nickname = (localStorage.getItem(STORAGE_KEYS.nickname) || "").trim();
let recentNames = JSON.parse(localStorage.getItem(STORAGE_KEYS.recentNames) || "[]");

let currentType = "income";
let selectedCategory = "ALL";
let isEditingNickname = false;

// =====================================
// 2. ELEMENT HTML
// =====================================
const gameLoader = document.getElementById("gameLoader");
const loaderFill = document.getElementById("loaderFill");
const loaderStatus = document.getElementById("loaderStatus");
const loaderPercent = document.getElementById("loaderPercent");

const onboardingModal = document.getElementById("onboardingModal");
const charSpeech = document.getElementById("charSpeech");
const charPoseImg = document.getElementById("charPoseImg");
const charFallback = document.getElementById("charFallback");
const onboardingForm = document.getElementById("onboardingForm");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");

const greetingTitle = document.getElementById("greetingTitle");
const greetingSubtitle = document.getElementById("greetingSubtitle");
const editNicknameBtn = document.getElementById("editNicknameBtn");

const balanceAmount = document.getElementById("balanceAmount");
const totalIncome = document.getElementById("totalIncome");
const totalExpense = document.getElementById("totalExpense");
const transactionList = document.getElementById("transactionList");
const currentDateEl = document.getElementById("currentDate");
const filterCategory = document.getElementById("filterCategory");
const categorySummaryList = document.getElementById("categorySummaryList");

const trxTabIncome = document.getElementById("trxTabIncome");
const trxTabExpense = document.getElementById("trxTabExpense");
const trxTabCount = document.getElementById("trxTabCount");

const homeView = document.getElementById("homeView");
const savingsSection = document.getElementById("savingsSection");
const transactionSection = document.getElementById("transactionSection");
const navButtons = document.querySelectorAll(".bottom-nav .nav-item[data-nav]");

const modal = document.getElementById("transactionModal");
const modalTitle = document.getElementById("modalTitle");
const transactionForm = document.getElementById("transactionForm");
const descriptionInput = document.getElementById("description");
const recentNameChips = document.getElementById("recentNameChips");
const amountInput = document.getElementById("amount");
const categoryGroup = document.getElementById("categoryGroup");
const categoryInput = document.getElementById("category");
const closeModalButton = document.getElementById("closeModal");

const btnTabungan = document.getElementById("btnTabungan");
const quickDepositBtn = document.getElementById("quickDepositBtn");
const quickWithdrawBtn = document.getElementById("quickWithdrawBtn");
const savingsModal = document.getElementById("savingsModal");
const savingsForm = document.getElementById("savingsForm");
const savingsInput = document.getElementById("savingsInput");
const withdrawSavingsBtn = document.getElementById("withdrawSavingsBtn");
const closeSavingsModal = document.getElementById("closeSavingsModal");
const savingsProgress = document.getElementById("savingsProgress");
const savedAmountText = document.getElementById("savedAmountText");
const savingsRemainingText = document.getElementById("savingsRemainingText");
const savingsPercentText = document.getElementById("savingsPercentText");
const savingsHistoryList = document.getElementById("savingsHistoryList");

// =====================================
// 3. TEMA DINAMIS BERBASIS WAKTU
// =====================================
function getTimeTheme(hour) {
    if (hour >= 5 && hour < 11) return "pagi";
    if (hour >= 11 && hour < 16) return "siang";
    if (hour >= 16 && hour < 19) return "sore";
    return "malam";
}

function applyTimeTheme() {
    const now = new Date();
    const theme = getTimeTheme(now.getHours());
    document.documentElement.setAttribute("data-time-theme", theme);
    document.body.setAttribute("data-time-theme", theme);
}

// =====================================
// 4. FORMAT RUPIAH, ANGKA & JAM REAL-TIME
// =====================================
function formatRupiah(amount) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Math.round(amount));
}

function normalizeNumericInput(rawValue) {
    if (!rawValue) return "";
    // Ubah koma menjadi titik, lalu ambil hanya digit angka
    const converted = String(rawValue).replace(/,/g, ".");
    return converted.replace(/\D/g, "");
}

function formatThousandsInput(rawValue) {
    const digitsOnly = normalizeNumericInput(rawValue);
    if (!digitsOnly) return "";
    return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseFormattedAmount(rawValue) {
    const digitsOnly = normalizeNumericInput(rawValue);
    if (!digitsOnly) return 0;
    const num = Number(digitsOnly);
    return Number.isFinite(num) ? num : 0;
}

function attachAutoFormat(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => {
        const formatted = formatThousandsInput(inputEl.value);
        inputEl.value = formatted;
    });
}

attachAutoFormat(amountInput);
attachAutoFormat(savingsInput);

function updateHeaderClock() {
    if (!currentDateEl) return;
    const now = new Date();
    const datePart = now.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short"
    });
    const timePart = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).replace(":", ".");
    currentDateEl.textContent = `${datePart} • ${timePart}`;
}

// =====================================
// 5. SAPAAN & ONBOARDING KARAKTER 2D
// =====================================
function setPoseImage(src) {
    if (!charPoseImg) return;
    charPoseImg.style.display = "block";
    if (charFallback) charFallback.style.display = "none";
    charPoseImg.src = src;
}

function renderGreeting() {
    const activeName = nickname || "Sobat";
    if (greetingTitle) greetingTitle.textContent = `Hai, ${activeName}!`;
    if (greetingSubtitle) {
        greetingSubtitle.textContent = "Aku bakal nemenin kamu ngatur keuangan di sini.";
    }
}

function openOnboardingModal(editing = false) {
    if (!onboardingModal) return;
    isEditingNickname = Boolean(editing);
    setPoseImage(POSE_HALO);
    if (charSpeech) {
        charSpeech.textContent = isEditingNickname
            ? "Mau ganti nama panggilan? Tulis nama barumu di bawah ya!"
            : "Halo! Kenalan dulu yuk, nama panggilan kamu siapa?";
    }
    if (onboardingForm) onboardingForm.style.display = "flex";
    if (nicknameInput) {
        nicknameInput.value = isEditingNickname ? nickname : "";
    }
    onboardingModal.classList.add("show");
    setTimeout(() => nicknameInput?.focus(), 60);
}

onboardingForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const cleanName = (nicknameInput?.value || "").trim().slice(0, 24);
    if (!cleanName) return;

    nickname = cleanName;
    localStorage.setItem(STORAGE_KEYS.nickname, nickname);
    renderGreeting();

    // Transisi pose melambai -> pose rebahan sambil menyapa nama
    if (onboardingForm) onboardingForm.style.display = "none";
    setPoseImage(POSE_HAI);
    if (charSpeech) {
        charSpeech.textContent = `Hai, ${nickname}! Aku bakal nemenin kamu ngatur keuangan di sini.`;
    }

    setTimeout(() => {
        onboardingModal?.classList.remove("show");
        if (onboardingForm) onboardingForm.style.display = "flex";
    }, 1600);
});

editNicknameBtn?.addEventListener("click", () => openOnboardingModal(true));

// =====================================
// 6. LOADING SCREEN ALA GAME
// =====================================
function runGameLoader() {
    if (!gameLoader) {
        if (!nickname) openOnboardingModal(false);
        return;
    }

    let progress = 0;
    if (loaderFill) loaderFill.style.width = "0%";
    if (loaderPercent) loaderPercent.textContent = "0%";
    if (loaderStatus) loaderStatus.textContent = "Menyiapkan dompetmu...";

    const timer = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 9;
        if (progress > 100) progress = 100;

        if (loaderFill) loaderFill.style.width = `${progress}%`;
        if (loaderPercent) loaderPercent.textContent = `${progress}%`;

        if (loaderStatus) {
            if (progress >= 35 && progress < 75) {
                loaderStatus.textContent = "Merapikan catatan...";
            } else if (progress >= 75 && progress < 100) {
                loaderStatus.textContent = "Hampir siap...";
            } else if (progress === 100) {
                loaderStatus.textContent = "Siap!";
            }
        }

        if (progress === 100) {
            clearInterval(timer);
            setTimeout(() => {
                gameLoader.classList.add("done");
                if (!nickname) {
                    openOnboardingModal(false);
                }
            }, 300);
        }
    }, 105);
}

// =====================================
// 7. NAVIGASI BAWAH
// =====================================
function setActiveTab(tab) {
    navButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.getAttribute("data-nav") === tab);
    });

    if (tab === "home") {
        homeView?.classList.remove("hidden");
        savingsSection?.classList.remove("hidden");
        transactionSection?.classList.remove("hidden");
    } else if (tab === "transactions") {
        homeView?.classList.add("hidden");
        savingsSection?.classList.add("hidden");
        transactionSection?.classList.remove("hidden");
    } else if (tab === "savings") {
        homeView?.classList.add("hidden");
        transactionSection?.classList.add("hidden");
        savingsSection?.classList.remove("hidden");
    }
}

navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const nav = btn.getAttribute("data-nav");
        if (nav === "home" || nav === "transactions" || nav === "savings") {
            setActiveTab(nav);
        }
    });
});

// =====================================
// 8. SIMPAN, RIWAYAT NAMA & HITUNG DATA
// =====================================
function saveData() {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
    localStorage.setItem(STORAGE_KEYS.savings, String(currentSavings));
    localStorage.setItem(STORAGE_KEYS.savingsLogs, JSON.stringify(savingsLogs));
    localStorage.setItem(STORAGE_KEYS.recentNames, JSON.stringify(recentNames));
}

function recordRecentName(name) {
    const clean = name.trim();
    if (!clean) return;
    recentNames = [
        clean,
        ...recentNames.filter((item) => item.toLowerCase() !== clean.toLowerCase())
    ].slice(0, MAX_RECENT_NAMES);
}

function renderRecentNameChips() {
    if (!recentNameChips) return;
    recentNameChips.innerHTML = "";

    if (!recentNames.length) return;

    recentNames.forEach((name) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "recent-chip";
        chip.textContent = name;
        chip.addEventListener("click", () => {
            if (!descriptionInput) return;
            descriptionInput.value = name;
            descriptionInput.focus();
        });
        recentNameChips.appendChild(chip);
    });
}

function calculateIncome() {
    return transactions
        .filter((item) => item.type === "income")
        .reduce((total, item) => total + item.amount, 0);
}

function calculateExpense() {
    return transactions
        .filter((item) => item.type === "expense")
        .reduce((total, item) => total + item.amount, 0);
}

function updateDashboard() {
    const income = calculateIncome();
    const expense = calculateExpense();
    const balance = income - expense - currentSavings;

    if (balanceAmount) balanceAmount.textContent = formatRupiah(balance);
    if (totalIncome) totalIncome.textContent = formatRupiah(income);
    if (totalExpense) totalExpense.textContent = formatRupiah(expense);

    if (trxTabIncome) trxTabIncome.textContent = formatRupiah(income);
    if (trxTabExpense) trxTabExpense.textContent = formatRupiah(expense);
    if (trxTabCount) trxTabCount.textContent = `${transactions.length} trx`;

    const clampedSavings = Math.max(0, currentSavings);
    const percentage = Math.min((clampedSavings / TARGET_SAVINGS) * 100, 100);
    const remaining = Math.max(TARGET_SAVINGS - clampedSavings, 0);

    if (savedAmountText) savedAmountText.textContent = `${formatRupiah(clampedSavings)} terkumpul`;
    if (savingsRemainingText) {
        savingsRemainingText.textContent = remaining === 0
            ? "Target tercapai! Mantap!"
            : `Sisa target: ${formatRupiah(remaining)}`;
    }
    if (savingsPercentText) savingsPercentText.textContent = `${Math.floor(percentage)}%`;
    if (savingsProgress) savingsProgress.style.width = `${percentage}%`;

    renderCategorySummary();
    renderSavingsHistory();
}

// =====================================
// 9. MODAL TRANSAKSI (KATEGORI SEMBUNYI SAAT PEMASUKAN)
// =====================================
function syncTransactionFormByType(type) {
    currentType = type;
    const isIncome = type === "income";

    if (modalTitle) {
        modalTitle.textContent = isIncome ? "Tambah Pemasukan" : "Tambah Pengeluaran";
    }

    if (categoryGroup) {
        categoryGroup.classList.toggle("hidden", isIncome);
    }

    if (categoryInput) {
        categoryInput.required = !isIncome;
        if (isIncome) {
            categoryInput.value = "";
        }
    }
}

document.querySelectorAll(".menu-item[data-action]").forEach((item) => {
    item.addEventListener("click", () => {
        const action = item.getAttribute("data-action");
        if (action === "income" || action === "expense") {
            transactionForm?.reset();
            syncTransactionFormByType(action);
            renderRecentNameChips();
            modal?.classList.add("show");
            setTimeout(() => descriptionInput?.focus(), 60);
        }
    });
});

closeModalButton?.addEventListener("click", () => modal?.classList.remove("show"));

transactionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const description = (descriptionInput?.value || "").trim();
    const amount = parseFormattedAmount(amountInput?.value || "");
    const isIncome = currentType === "income";
    const category = isIncome ? "Pemasukan" : (categoryInput?.value || "").trim();

    if (!description || amount <= 0) return;
    if (!isIncome && !category) return;

    transactions.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        description,
        amount,
        category,
        type: currentType,
        date: new Date().toISOString()
    });

    recordRecentName(description);
    saveData();
    updateDashboard();
    renderTransactions();
    modal?.classList.remove("show");
});

// =====================================
// 10. MODAL & MUTASI TABUNGAN (ANTI BUG HAPUS PEMASUKAN)
// =====================================
function openSavingsModal(mode = "deposit") {
    savingsForm?.reset();
    savingsModal?.classList.add("show");
    setTimeout(() => savingsInput?.focus(), 60);
    if (mode === "withdraw" && savingsInput) {
        savingsInput.placeholder = "Nominal yang mau ditarik...";
    } else if (savingsInput) {
        savingsInput.placeholder = "Contoh: 100.000";
    }
}

btnTabungan?.addEventListener("click", () => openSavingsModal("deposit"));
quickDepositBtn?.addEventListener("click", () => openSavingsModal("deposit"));
quickWithdrawBtn?.addEventListener("click", () => openSavingsModal("withdraw"));
closeSavingsModal?.addEventListener("click", () => savingsModal?.classList.remove("show"));

savingsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = parseFormattedAmount(savingsInput?.value || "");
    const availableBalance = calculateIncome() - calculateExpense() - currentSavings;

    if (amount <= 0) return;

    if (amount > availableBalance) {
        alert("Saldo utama kamu tidak cukup untuk nominal tabungan ini!");
        return;
    }

    // Cari transaksi pemasukan terbaru yang masih punya sisa alokasi tersedia
    const latestIncome = transactions.find((trx) => trx.type === "income");

    currentSavings += amount;
    savingsLogs.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "deposit",
        amount,
        sourceTransactionId: latestIncome ? latestIncome.id : null,
        note: latestIncome ? `Dari: ${latestIncome.description}` : "Setoran tabungan",
        date: new Date().toISOString()
    });

    saveData();
    updateDashboard();
    savingsModal?.classList.remove("show");
});

withdrawSavingsBtn?.addEventListener("click", () => {
    const amount = parseFormattedAmount(savingsInput?.value || "");
    if (amount <= 0) {
        alert("Masukkan nominal tabungan yang ingin ditarik dulu di kolom atas.");
        savingsInput?.focus();
        return;
    }

    if (amount > currentSavings) {
        alert("Nominal penarikan melebihi tabungan yang terkumpul!");
        return;
    }

    currentSavings -= amount;
    savingsLogs.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "withdraw",
        amount,
        sourceTransactionId: null,
        note: "Ditarik ke saldo utama",
        date: new Date().toISOString()
    });

    saveData();
    updateDashboard();
    savingsModal?.classList.remove("show");
});

function renderSavingsHistory() {
    if (!savingsHistoryList) return;
    savingsHistoryList.innerHTML = "";

    if (!savingsLogs.length) {
        savingsHistoryList.innerHTML = `
            <div class="transaction-item">
                <p class="text-muted">Belum ada catatan tabungan.</p>
            </div>
        `;
        return;
    }

    savingsLogs.slice(0, 10).forEach((log) => {
        const isDeposit = log.type === "deposit";
        const formattedDate = new Date(log.date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short"
        });

        const item = document.createElement("div");
        item.className = "transaction-item";

        const details = document.createElement("div");
        details.className = "transaction-details";

        const title = document.createElement("strong");
        title.textContent = isDeposit ? "Setor Tabungan" : "Tarik Tabungan";

        const meta = document.createElement("small");
        meta.textContent = `${log.note || "Tabungan"} • ${formattedDate}`;

        details.append(title, meta);

        const right = document.createElement("div");
        right.className = "transaction-right";

        const amountEl = document.createElement("strong");
        amountEl.className = isDeposit ? "income" : "expense";
        amountEl.textContent = `${isDeposit ? "+" : "-"}${formatRupiah(log.amount)}`;

        right.append(amountEl);
        item.append(details, right);
        savingsHistoryList.appendChild(item);
    });
}

// =====================================
// 11. FILTER, RIWAYAT & HAPUS TRANSAKSI
// =====================================
filterCategory?.addEventListener("change", () => {
    selectedCategory = filterCategory.value;
    renderTransactions();
});

function renderTransactions() {
    if (!transactionList) return;
    transactionList.innerHTML = "";

    const filteredTransactions = selectedCategory === "ALL"
        ? transactions
        : transactions.filter((item) => item.category === selectedCategory);

    if (filteredTransactions.length === 0) {
        const emptyMessage = selectedCategory === "ALL"
            ? "Belum ada transaksi."
            : `Belum ada transaksi di kategori ${selectedCategory}.`;
        transactionList.innerHTML = `<div class="transaction-item"><p class="text-muted">${emptyMessage}</p></div>`;
        return;
    }

    filteredTransactions.forEach((item) => {
        const isIncome = item.type === "income";
        const formattedDate = new Date(item.date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });

        const element = document.createElement("div");
        element.className = "transaction-item";

        const details = document.createElement("div");
        details.className = "transaction-details";

        const title = document.createElement("strong");
        title.textContent = item.description;

        const meta = document.createElement("small");
        meta.textContent = `${item.category} • ${formattedDate}`;

        details.append(title, meta);

        const right = document.createElement("div");
        right.className = "transaction-right";

        const amountEl = document.createElement("strong");
        amountEl.className = isIncome ? "income" : "expense";
        amountEl.textContent = `${isIncome ? "+" : "-"}${formatRupiah(item.amount)}`;

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-transaction";
        deleteBtn.textContent = "Hapus";
        deleteBtn.addEventListener("click", () => deleteTransaction(item.id));

        right.append(amountEl, deleteBtn);
        element.append(details, right);
        transactionList.appendChild(element);
    });
}

function deleteTransaction(id) {
    const target = transactions.find((item) => item.id === id);
    if (!target) return;

    if (!confirm(`Yakin mau hapus transaksi "${target.description}"?`)) return;

    // Jika transaksi pemasukan punya catatan setoran tabungan terkait, kembalikan dana setoran tersebut
    if (target.type === "income") {
        const linkedDeposits = savingsLogs.filter(
            (log) => log.type === "deposit" && log.sourceTransactionId === id
        );
        const totalLinkedDeposit = linkedDeposits.reduce((sum, log) => sum + log.amount, 0);

        if (totalLinkedDeposit > 0) {
            const refundable = Math.min(totalLinkedDeposit, currentSavings);
            currentSavings = Math.max(0, currentSavings - refundable);
            savingsLogs = savingsLogs.filter(
                (log) => !(log.type === "deposit" && log.sourceTransactionId === id)
            );
        }
    }

    transactions = transactions.filter((item) => item.id !== id);
    saveData();
    updateDashboard();
    renderTransactions();
}

function renderCategorySummary() {
    if (!categorySummaryList) return;

    const expenseByCategory = transactions
        .filter((item) => item.type === "expense")
        .reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + item.amount;
            return acc;
        }, {});

    const entries = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

    categorySummaryList.innerHTML = "";

    if (entries.length === 0) {
        categorySummaryList.innerHTML = `
            <div class="transaction-item">
                <p class="text-muted">Belum ada pengeluaran.</p>
            </div>
        `;
        return;
    }

    entries.forEach(([category, total]) => {
        const row = document.createElement("div");
        row.className = "category-summary-item";

        const label = document.createElement("span");
        label.textContent = category;

        const value = document.createElement("strong");
        value.textContent = formatRupiah(total);

        row.append(label, value);
        categorySummaryList.appendChild(row);
    });
}

// =====================================
// 12. DAFTARKAN SERVICE WORKER (PWA OFFLINE)
// =====================================
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then(() => console.log("Service Worker terdaftar!"))
            .catch((err) => console.error("Gagal daftar SW:", err));
    });
}

// =====================================
// 13. JALANKAN APLIKASI
// =====================================
applyTimeTheme();
setInterval(applyTimeTheme, 60000);
updateHeaderClock();
setInterval(updateHeaderClock, 15000);
renderGreeting();
updateDashboard();
renderTransactions();
runGameLoader();
