// ==========================================
// Vodafone Invoice Manager Pro
// app.js - Fixed & Cleaned
// ==========================================

// ==========================================
// Firebase Config
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyBfFRxvmhg8aqtuDgXAOofFGpVPklUF",
    authDomain: "mobile-invoic-118d4.firebaseapp.com",
    databaseURL: "https://mobile-invoic-118d4-default-rtdb.firebaseio.com",
    projectId: "mobile-invoic-118d4",
    storageBucket: "mobile-invoic-118d4.firebasestorage.app",
    messagingSenderId: "795305971254",
    appId: "1:795305971254:web:7e8e874cfd805d33ec1297"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();

// ==========================================
// Global Variables
// ==========================================

let allClients   = {};
let allInvoices  = {};
let allWallets   = {};
let allPayments  = {};

// ==========================================
// DOM Ready
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    initializeNavigation();
    initializeDarkMode();
    loadAllData();

    // ربط ملف الفواتير
    const fileInput = document.getElementById("invoice-file-input");
    if (fileInput) {
        fileInput.addEventListener("change", function () {
            previewInvoiceFile(this);
        });
    }

    // ربط ملف العملاء
    const settingsFile = document.getElementById("settings-file-input");
    if (settingsFile) {
        settingsFile.addEventListener("change", function () {
            importClientsFromExcel(this);
        });
    }

    // ربط select التحصيل
    const collectionSel = document.getElementById("collection-month-select");
    if (collectionSel) {
        collectionSel.addEventListener("change", loadCollectionScreen);
    }

});

// ==========================================
// Navigation
// ==========================================

function initializeNavigation() {

    const navItems = document.querySelectorAll(".nav-links li");

    navItems.forEach(item => {

        item.addEventListener("click", () => {

            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            const target = item.dataset.target;

            document.querySelectorAll(".app-screen")
                .forEach(screen => screen.classList.remove("active-screen"));

            const targetScreen = document.getElementById(target);
            if (targetScreen) targetScreen.classList.add("active-screen");

            // تحميل البيانات عند الانتقال للشاشات
            if (target === "history-screen")  loadPaymentHistory();
            if (target === "collection-screen") populateCollectionMonths();
            if (target === "invoice-screen")    populateInvoiceMonths();

        });

    });

}

// ==========================================
// Dark Mode
// ==========================================

function initializeDarkMode() {

    const darkBtn = document.getElementById("dark-mode-btn");
    if (!darkBtn) return;

    if (localStorage.getItem("darkMode") === "true") {
        document.body.classList.add("dark-mode");
    }

    darkBtn.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
    });

}

// ==========================================
// Load All Data
// ==========================================

function loadAllData() {

    db.ref("settings").on("value", snapshot => {
        allClients = snapshot.val() || {};
        renderClientsTable();
        updateDashboard();
    }, err => console.error("❌ settings:", err));

    db.ref("invoices").on("value", snapshot => {
        allInvoices = snapshot.val() || {};
        updateDashboard();
        // تحديث شاشة التحصيل لو مفتوحة
        const activeCol = document.querySelector("#collection-screen.active-screen");
        if (activeCol) loadCollectionScreen();
    }, err => console.error("❌ invoices:", err));

    db.ref("wallets").on("value", snapshot => {
        allWallets = snapshot.val() || {};
        updateDashboard();
    }, err => console.error("❌ wallets:", err));

    db.ref("payments").on("value", snapshot => {
        allPayments = snapshot.val() || {};
        updateDashboard();
    }, err => console.error("❌ payments:", err));

}

// ==========================================
// Format Phone
// ==========================================

function formatPhone(phone) {

    let p = phone.toString().trim();
    if (p.length === 10 && p.startsWith("1")) p = "0" + p;
    return p;

}

// ==========================================
// Add Client
// ==========================================

function addNewUser() {

    const name  = document.getElementById("new-user-name").value.trim();
    const phone = formatPhone(document.getElementById("new-user-phone").value.trim());
    const price = parseFloat(document.getElementById("new-user-price").value) || 0;
    const plan  = document.getElementById("new-user-plan").value.trim();

    if (!name || !phone) {
        alert("أدخل الاسم والرقم");
        return;
    }

    if (allClients[phone]) {
        alert("الرقم موجود مسبقاً");
        return;
    }

    db.ref("settings/" + phone)
        .set({ name, phone, price, plan })
        .then(() => {
            clearClientForm();
            alert("تم إضافة العميل");
        })
        .catch(err => alert("خطأ: " + err.message));

}

// ==========================================
// Clear Client Form
// ==========================================

function clearClientForm() {

    document.getElementById("new-user-name").value  = "";
    document.getElementById("new-user-phone").value = "";
    document.getElementById("new-user-price").value = "";
    document.getElementById("new-user-plan").value  = "";

}

// ==========================================
// Render Clients Table
// ==========================================

function renderClientsTable() {

    const tbody = document.getElementById("settings-table-body");
    if (!tbody) return;

    const search = (document.getElementById("settings-table-search")?.value || "").toLowerCase();

    tbody.innerHTML = "";

    Object.keys(allClients).sort().forEach(phone => {

        const client = allClients[phone];

        if (
            search &&
            !client.name?.toLowerCase().includes(search) &&
            !phone.includes(search)
        ) return;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${client.name  || ""}</td>
            <td>${phone}</td>
            <td>${client.price || 0}</td>
            <td>${client.plan  || ""}</td>
            <td>
                <button class="btn btn-outline" onclick="editClient('${phone}')">تعديل</button>
                <button class="btn btn-red"     onclick="deleteClient('${phone}')">حذف</button>
            </td>
        `;

        tbody.appendChild(tr);

    });

    // ربط البحث الفوري
    const searchInput = document.getElementById("settings-table-search");
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = "1";
        searchInput.addEventListener("input", renderClientsTable);
    }

}

// ==========================================
// Delete Client
// ==========================================

function deleteClient(phone) {

    if (!confirm("حذف العميل؟")) return;

    db.ref("settings/" + phone)
        .remove()
        .catch(err => alert("خطأ: " + err.message));

}

// ==========================================
// Edit Client  — يفتح المودال
// ==========================================

function editClient(phone) {

    const client = allClients[phone];
    if (!client) return;

    document.getElementById("edit-name").value  = client.name  || "";
    document.getElementById("edit-phone").value = phone;
    document.getElementById("edit-price").value = client.price || 0;
    document.getElementById("edit-plan").value  = client.plan  || "";

    document.getElementById("edit-modal").style.display = "flex";

}

// ==========================================
// Close Modal
// ==========================================

function closeEditModal() {

    document.getElementById("edit-modal").style.display = "none";

}

// ==========================================
// Save Client Edits
// ==========================================

function saveClientEdits() {

    const phone = document.getElementById("edit-phone").value;
    const name  = document.getElementById("edit-name").value.trim();
    const price = parseFloat(document.getElementById("edit-price").value) || 0;
    const plan  = document.getElementById("edit-plan").value.trim();

    if (!name) { alert("أدخل الاسم"); return; }

    db.ref("settings/" + phone)
        .update({ name, price, plan })
        .then(() => {
            closeEditModal();
            alert("تم التعديل بنجاح");
        })
        .catch(err => alert("خطأ: " + err.message));

}

// ==========================================
// Dashboard
// ==========================================

function updateDashboard() {

    // العملاء والخطوط
    const totalClients = Object.keys(allClients).length;
    setText("total-clients", totalClients);
    setText("total-lines",   totalClients);

    // الفواتير
    let totalInvoices = 0;
    Object.keys(allInvoices).forEach(month => {
        totalInvoices += Object.keys(allInvoices[month]).length;
    });
    setText("total-invoices", totalInvoices);

    // المدفوعات والمديونيات
    let totalPaid  = 0;
    let totalDebts = 0;

    Object.keys(allInvoices).forEach(month => {
        Object.values(allInvoices[month]).forEach(inv => {
            const pkg  = Number(inv.packagePrice || 0);
            const paid = Number(inv.paidAmount   || 0);
            totalPaid  += paid;
            if (paid < pkg) totalDebts += (pkg - paid);
        });
    });

    setText("total-payments", totalPaid.toFixed(2));
    setText("total-debts",    totalDebts.toFixed(2));

    // صافي الربح = مجموع أسعار الباقات للعملاء
    let totalRevenue = 0;
    Object.values(allClients).forEach(c => {
        totalRevenue += Number(c.price || 0);
    });
    setText("net-profit", totalRevenue.toFixed(2));

    // الرسم البياني
    renderProfitChart();

}

// ==========================================
// Profit Chart
// ==========================================

let profitChartInstance = null;

function renderProfitChart() {

    const ctx = document.getElementById("profitChart");
    if (!ctx) return;

    const months = Object.keys(allInvoices).sort();
    const revenues = months.map(month => {
        let sum = 0;
        Object.values(allInvoices[month]).forEach(inv => {
            sum += Number(inv.paidAmount || 0);
        });
        return sum;
    });

    if (profitChartInstance) profitChartInstance.destroy();

    profitChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: months,
            datasets: [{
                label: "المدفوعات الشهرية",
                data: revenues,
                backgroundColor: "#e60000",
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true }
            }
        }
    });

}

// ==========================================
// Populate Month Selects
// ==========================================

function populateCollectionMonths() {

    const sel = document.getElementById("collection-month-select");
    if (!sel) return;

    sel.innerHTML = '<option value="">اختر الشهر</option>';

    Object.keys(allInvoices).sort().forEach(month => {
        sel.innerHTML += `<option value="${month}">${month}</option>`;
    });

}

function populateInvoiceMonths() {

    const sel = document.getElementById("invoice-month-select");
    if (!sel) return;

    sel.innerHTML = '<option value="">اختر الشهر</option>';

    // شهور افتراضية للاستيراد (12 شهر من الحالي)
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        sel.innerHTML += `<option value="${label}">${label}</option>`;
    }

}

// ==========================================
// Invoice Import (XLSX)
// ==========================================

let parsedInvoiceData = [];

function previewInvoiceFile(input) {

    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {

        const workbook = XLSX.read(e.target.result, { type: "binary" });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        parsedInvoiceData = [];

        const tbody = document.querySelector("#invoice-preview-table tbody");
        if (tbody) tbody.innerHTML = "";

        // ترتيب أعمدة الملف: A=الرقم | B=الاسم | C=سعر الباقة | D=الخطة
        rows.slice(1).forEach(row => {

            if (!row[0]) return;

            const phone = formatPhone(String(row[0]));
            const name  = row[1] ? String(row[1]).trim() : "";
            const price = parseFloat(row[2]) || 0;
            const plan  = row[3] ? String(row[3]).trim() : "";

            parsedInvoiceData.push({ phone, name, price, plan });

            const client  = allClients[phone];
            const matched = client ? "متطابق ✅" : "غير موجود ❌";

            if (tbody) {
                tbody.innerHTML += `
                    <tr>
                        <td>${phone}</td>
                        <td>${plan}</td>
                        <td>${price}</td>
                        <td>${matched}</td>
                    </tr>
                `;
            }

        });

    };

    reader.readAsBinaryString(file);

}

function saveProcessedInvoice() {

    const month = document.getElementById("invoice-month-select").value;

    if (!month) { alert("اختر الشهر"); return; }

    if (parsedInvoiceData.length === 0) { alert("لا توجد بيانات للحفظ"); return; }

    const updates = {};

    parsedInvoiceData.forEach(item => {
        updates[`invoices/${month}/${item.phone}`] = {
            phone:        item.phone,
            name:         item.name  || "",
            plan:         item.plan  || "",
            packagePrice: item.price,
            paidAmount:   0,
            status:       "غير مدفوع"
        };
    });

    db.ref().update(updates)
        .then(() => alert("تم حفظ الفواتير بنجاح"))
        .catch(err => alert("خطأ: " + err.message));

}

// ==========================================
// Import Clients from Excel
// ==========================================

function importClientsFromExcel(input) {

    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {

        const workbook = XLSX.read(e.target.result, { type: "binary" });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const updates = {};

        // ترتيب أعمدة الملف: A=الرقم | B=الاسم | C=سعر الباقة | D=الخطة
        rows.slice(1).forEach(row => {
            if (!row[0]) return;
            const phone = formatPhone(String(row[0]));
            updates["settings/" + phone] = {
                name:  row[1] ? String(row[1]).trim() : "",
                phone: phone,
                price: parseFloat(row[2]) || 0,
                plan:  row[3] ? String(row[3]).trim() : ""
            };
        });

        db.ref().update(updates)
            .then(() => alert("تم استيراد العملاء بنجاح"))
            .catch(err => alert("خطأ: " + err.message));

    };

    reader.readAsBinaryString(file);

}

// ==========================================
// Collection Screen
// ==========================================

function loadCollectionScreen() {

    const month = document.getElementById("collection-month-select").value;
    if (!month) return;

    const tbody  = document.getElementById("collection-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const invoices = allInvoices[month] || {};

    if (Object.keys(invoices).length === 0) {
        tbody.innerHTML = `<tr><td colspan="7">لا توجد فواتير لهذا الشهر</td></tr>`;
        return;
    }

    Object.keys(invoices).sort().forEach(phone => {

        const inv     = invoices[phone];
        const client  = allClients[phone] || {};
        const pkg     = Number(inv.packagePrice || client.price || 0);
        const paid    = Number(inv.paidAmount   || 0);
        const remain  = pkg - paid;

        const badgeClass = remain <= 0 ? "badge-green" : "badge-red";
        const statusText = remain <= 0 ? "مسدد" : "مديون";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${phone}</td>
            <td>${client.name || "-"}</td>
            <td>${pkg}</td>
            <td>${paid}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td>
                <input type="number" id="pay-${phone}"
                    value="${remain > 0 ? remain : 0}"
                    style="width:100px;padding:6px;border-radius:8px;border:1px solid var(--border)">
            </td>
            <td>
                <button class="btn btn-green"
                    onclick="collectPayment('${month}','${phone}')">
                    تحصيل
                </button>
            </td>
        `;

        tbody.appendChild(tr);

    });

}

// ==========================================
// Collect Payment
// ==========================================

async function collectPayment(month, phone) {

    const input  = document.getElementById(`pay-${phone}`);
    const amount = Number(input?.value || 0);

    if (!amount || amount <= 0) {
        alert("أدخل مبلغ صحيح");
        return;
    }

    try {

        const snap    = await db.ref(`invoices/${month}/${phone}`).once("value");
        const invoice = snap.val() || {};

        const oldPaid = Number(invoice.paidAmount   || 0);
        const pkg     = Number(invoice.packagePrice || 0);
        const newPaid = oldPaid + amount;

        const status = newPaid >= pkg ? "مدفوع بالكامل" : "مدفوع جزئياً";

        await db.ref(`invoices/${month}/${phone}`).update({
            paidAmount: newPaid,
            status
        });

        await savePaymentHistory(phone, month, amount, "تحصيل يدوي");

        alert("تم تسجيل التحصيل");

        loadCollectionScreen();

    } catch (err) {
        alert("خطأ: " + err.message);
    }

}

// ==========================================
// Pay All Active Invoices
// ==========================================

async function payAllActiveInvoices() {

    const month = document.getElementById("collection-month-select").value;
    if (!month) { alert("اختر الشهر"); return; }

    const invoices = allInvoices[month] || {};
    const updates  = {};
    const histTasks = [];

    Object.keys(invoices).forEach(phone => {

        const inv    = invoices[phone];
        const pkg    = Number(inv.packagePrice || 0);
        const paid   = Number(inv.paidAmount   || 0);
        const remain = pkg - paid;

        if (remain > 0) {
            updates[`invoices/${month}/${phone}/paidAmount`] = pkg;
            updates[`invoices/${month}/${phone}/status`]     = "مدفوع بالكامل";
            histTasks.push(savePaymentHistory(phone, month, remain, "تحصيل جماعي"));
        }

    });

    if (Object.keys(updates).length === 0) {
        alert("جميع الفواتير مسددة");
        return;
    }

    try {
        await db.ref().update(updates);
        await Promise.all(histTasks);
        alert("تم تحصيل جميع الفواتير");
        loadCollectionScreen();
    } catch (err) {
        alert("خطأ: " + err.message);
    }

}

// ==============
