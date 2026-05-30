
// ==========================================
// Vodafone Invoice Manager Pro
// app.js - Part 1
// Firebase + Navigation + Dashboard + Customers
// ==========================================

// ==========================================
// Firebase Config
// ==========================================

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "XXXXXXXX",
    appId: "XXXXXXXX"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();

// ==========================================
// Global Variables
// ==========================================

let allClients = {};
let allInvoices = {};
let allWallets = {};
let allPayments = {};

// ==========================================
// DOM Ready
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    initializeNavigation();

    initializeDarkMode();

    loadAllData();

});

// ==========================================
// Navigation
// ==========================================

function initializeNavigation() {

    const navItems =
        document.querySelectorAll(".nav-links li");

    navItems.forEach(item => {

        item.addEventListener("click", () => {

            navItems.forEach(nav =>
                nav.classList.remove("active")
            );

            item.classList.add("active");

            const target =
                item.dataset.target;

            document
                .querySelectorAll(".app-screen")
                .forEach(screen =>
                    screen.classList.remove("active-screen")
                );

            document
                .getElementById(target)
                .classList.add("active-screen");

        });

    });

}

// ==========================================
// Dark Mode
// ==========================================

function initializeDarkMode() {

    const darkBtn =
        document.getElementById("dark-mode-btn");

    const saved =
        localStorage.getItem("darkMode");

    if (saved === "true") {

        document.body.classList.add("dark-mode");

    }

    darkBtn.addEventListener("click", () => {

        document.body.classList.toggle("dark-mode");

        localStorage.setItem(
            "darkMode",
            document.body.classList.contains("dark-mode")
        );

    });

}

// ==========================================
// Load All Data
// ==========================================

function loadAllData() {

    loadClients();

    loadInvoices();

    loadWallets();

    loadPayments();

}

// ==========================================
// Load Clients
// ==========================================

function loadClients() {

    db.ref("settings").on("value", snapshot => {

        allClients =
            snapshot.val() || {};

        renderClientsTable();

        updateDashboard();

    });

}

// ==========================================
// Load Invoices
// ==========================================

function loadInvoices() {

    db.ref("invoices").on("value", snapshot => {

        allInvoices =
            snapshot.val() || {};

        updateDashboard();

    });

}

// ==========================================
// Load Wallets
// ==========================================

function loadWallets() {

    db.ref("wallets").on("value", snapshot => {

        allWallets =
            snapshot.val() || {};

        updateDashboard();

    });

}

// ==========================================
// Load Payments
// ==========================================

function loadPayments() {

    db.ref("payments").on("value", snapshot => {

        allPayments =
            snapshot.val() || {};

        updateDashboard();

    });

}

// ==========================================
// Format Phone
// ==========================================

function formatPhone(phone) {

    let p =
        phone.toString().trim();

    if (
        p.length === 10 &&
        p.startsWith("1")
    ) {
        p = "0" + p;
    }

    return p;

}

// ==========================================
// Add Client
// ==========================================

function addNewUser() {

    const name =
        document
        .getElementById("new-user-name")
        .value
        .trim();

    const phone =
        formatPhone(
            document
            .getElementById("new-user-phone")
            .value
            .trim()
        );

    const price =
        parseFloat(
            document
            .getElementById("new-user-price")
            .value
        ) || 0;

    const plan =
        document
        .getElementById("new-user-plan")
        .value
        .trim();

    if (!name || !phone) {

        alert("أدخل الاسم والرقم");

        return;
    }

    if (allClients[phone]) {

        alert("الرقم موجود مسبقاً");

        return;
    }

    db.ref("settings/" + phone)
        .set({
            name,
            phone,
            price,
            plan
        })
        .then(() => {

            clearClientForm();

            alert("تم إضافة العميل");

        });

}

// ==========================================
// Clear Form
// ==========================================

function clearClientForm() {

    document.getElementById(
        "new-user-name"
    ).value = "";

    document.getElementById(
        "new-user-phone"
    ).value = "";

    document.getElementById(
        "new-user-price"
    ).value = "";

    document.getElementById(
        "new-user-plan"
    ).value = "";

}

// ==========================================
// Render Clients Table
// ==========================================

function renderClientsTable() {

    const tbody =
        document.getElementById(
            "settings-table-body"
        );

    if (!tbody) return;

    tbody.innerHTML = "";

    Object.keys(allClients)
        .sort()
        .forEach(phone => {

            const client =
                allClients[phone];

            const tr =
                document.createElement("tr");

            tr.innerHTML = `

<td>${client.name || ""}</td>

<td>${phone}</td>

<td>${client.price || 0}</td>

<td>${client.plan || ""}</td>

<td>

<button
class="btn btn-outline"
onclick="editClient('${phone}')">

تعديل

</button>

<button
class="btn btn-red"
onclick="deleteClient('${phone}')">

حذف

</button>

</td>

`;

            tbody.appendChild(tr);

        });

}

// ==========================================
// Delete Client
// ==========================================

function deleteClient(phone) {

    if (
        !confirm("حذف العميل؟")
    ) return;

    db.ref("settings/" + phone)
        .remove();

}

// ==========================================
// Edit Client
// ==========================================

function editClient(phone) {

    const client =
        allClients[phone];

    document.getElementById(
        "edit-name"
    ).value =
        client.name || "";

    document.getElementById(
        "edit-phone"
    ).value =
        phone;

    document.getElementById(
        "edit-price"
    ).value =
        client.price || 0;

    document.getElementById(
        "edit-plan"
    ).value =
        client.plan || "";

    document.getElementById(
        "edit-modal"
    ).style.display =
        "flex";

}

// ==========================================
// Close Modal
// ==========================================

function closeEditModal() {

    document.getElementById(
        "edit-modal"
    ).style.display =
        "none";

}

// ==========================================
// Save Client Edit
// ==========================================

function saveClientEdits() {

    const phone =
        document.getElementById(
            "edit-phone"
        ).value;

    const name =
        document.getElementById(
            "edit-name"
        ).value;

    const price =
        parseFloat(
            document.getElementById(
                "edit-price"
            ).value
        ) || 0;

    const plan =
        document.getElementById(
            "edit-plan"
        ).value;

    db.ref("settings/" + phone)
        .update({
            name,
            price,
            plan
        })
        .then(() => {

            closeEditModal();

            alert(
                "تم التعديل بنجاح"
            );

        });

}

// ==========================================
// Dashboard
// ==========================================

function updateDashboard() {

    let totalClients =
        Object.keys(allClients).length;

    let totalInvoices = 0;

    let totalRevenue = 0;

    Object.values(allClients)
        .forEach(client => {

            totalRevenue +=
                Number(client.price || 0);

        });

    Object.keys(allInvoices)
        .forEach(month => {

            totalInvoices +=
                Object.keys(
                    allInvoices[month]
                ).length;

        });

    setText(
        "total-clients",
        totalClients
    );

    setText(
        "total-lines",
        totalClients
    );

    setText(
        "total-invoices",
        totalInvoices
    );

    setText(
        "net-profit",
        totalRevenue.toFixed(2)
    );

}

// ==========================================
// Helper
// ==========================================

function setText(id, value) {

    const el =
        document.getElementById(id);

    if (el)
        el.innerText = value;

}
// ======================================
// [2] إدارة العملاء
// ======================================

let clientsCache = {};

function loadClients() {

    const tbody = document.getElementById("clients-table-body");

    if (!tbody) return;

    db.ref("clients").on("value", snapshot => {

        tbody.innerHTML = "";

        clientsCache = snapshot.val() || {};

        let count = 0;

        Object.keys(clientsCache).forEach(phone => {

            const client = clientsCache[phone];

            count++;

            tbody.innerHTML += `
            <tr>
                <td>${count}</td>
                <td>${client.name || ""}</td>
                <td>${phone}</td>
                <td>${client.plan || "-"}</td>
                <td>${client.price || 0} ج.م</td>
                <td>

                    <button class="btn btn-primary"
                    onclick="editClient('${phone}')">
                        تعديل
                    </button>

                    <button class="btn btn-danger"
                    onclick="deleteClient('${phone}')">
                        حذف
                    </button>

                </td>
            </tr>
            `;

        });

        updateDashboardCounts();

    });

}


// ======================================
// إضافة عميل
// ======================================

function addClient() {

    const name =
        document.getElementById("client-name").value.trim();

    const phone =
        document.getElementById("client-phone").value.trim();

    const plan =
        document.getElementById("client-plan").value.trim();

    const price =
        parseFloat(
            document.getElementById("client-price").value
        ) || 0;

    if (!name)
        return alert("أدخل اسم العميل");

    if (!phone)
        return alert("أدخل رقم الهاتف");

    db.ref("clients/" + phone)
        .set({
            name,
            phone,
            plan,
            price,
            createdAt: Date.now()
        })
        .then(() => {

            alert("تم إضافة العميل");

            clearClientForm();

        });

}


// ======================================
// تنظيف النموذج
// ======================================

function clearClientForm() {

    document.getElementById("client-name").value = "";
    document.getElementById("client-phone").value = "";
    document.getElementById("client-plan").value = "";
    document.getElementById("client-price").value = "";

}


// ======================================
// حذف عميل
// ======================================

function deleteClient(phone) {

    if (!confirm("هل تريد حذف العميل؟"))
        return;

    db.ref("clients/" + phone)
        .remove()
        .then(() => {

            alert("تم الحذف");

        });

}


// ======================================
// تعديل عميل
// ======================================

function editClient(phone) {

    const client = clientsCache[phone];

    if (!client) return;

    document.getElementById("edit-name").value =
        client.name;

    document.getElementById("edit-phone").value =
        phone;

    document.getElementById("edit-plan").value =
        client.plan || "";

    document.getElementById("edit-price").value =
        client.price || 0;

    document
        .getElementById("editModal")
        .classList.add("show");

}


// ======================================
// حفظ التعديل
// ======================================

function saveClientEdit() {

    const phone =
        document.getElementById("edit-phone").value;

    const name =
        document.getElementById("edit-name").value;

    const plan =
        document.getElementById("edit-plan").value;

    const price =
        parseFloat(
            document.getElementById("edit-price").value
        ) || 0;

    db.ref("clients/" + phone)
        .update({
            name,
            plan,
            price
        })
        .then(() => {

            alert("تم التعديل");

            closeEditModal();

        });

}


// ======================================
// غلق المودال
// ======================================

function closeEditModal() {

    document
        .getElementById("editModal")
        .classList.remove("show");

}


// ======================================
// البحث داخل العملاء
// ======================================

function searchClients() {

    const search =
        document
            .getElementById("clients-search")
            .value
            .toLowerCase();

    const rows =
        document.querySelectorAll(
            "#clients-table-body tr"
        );

    rows.forEach(row => {

        if (
            row.innerText
                .toLowerCase()
                .includes(search)
        ) {

            row.style.display = "";

        } else {

            row.style.display = "none";

        }

    });

}


// ======================================
// عدادات Dashboard
// ======================================

function updateDashboardCounts() {

    const clientsCount =
        Object.keys(clientsCache).length;

    const el =
        document.getElementById("dashboardClients");

    if (el)
        el.innerText = clientsCount;

}


// ======================================
// تحميل تلقائي
// ======================================

document.addEventListener(
    "DOMContentLoaded",
    loadClients
);
// ==========================================
// [3] شاشة التحصيل Collection
// ==========================================

async function loadCollectionMonth() {

    const month = document.getElementById("collectionMonth").value;
    const tbody = document.getElementById("collectionTable");

    if (!month || !tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="8">جاري التحميل...</td>
        </tr>
    `;

    const snap = await db.ref(`invoices/${month}`).once("value");

    const invoices = snap.val() || {};

    tbody.innerHTML = "";

    let count = 0;

    for (const phone in invoices) {

        count++;

        const invoice = invoices[phone];

        const customerSnap = await db.ref(`customers/${phone}`).once("value");

        const customer = customerSnap.val() || {};

        const packagePrice =
            Number(invoice.packagePrice || customer.price || 0);

        const paid =
            Number(invoice.paidAmount || 0);

        const remaining =
            packagePrice - paid;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${phone}</td>
            <td>${customer.name || "-"}</td>
            <td>${packagePrice}</td>
            <td>${paid}</td>
            <td>${remaining}</td>
            <td>
                ${
                    remaining <= 0
                    ? '<span class="badge-success">مسدد</span>'
                    : '<span class="badge-danger">مديون</span>'
                }
            </td>

            <td>
                <input
                    type="number"
                    id="pay-${phone}"
                    value="${remaining > 0 ? remaining : 0}"
                    class="small-input"
                >
            </td>

            <td>

                <button
                    class="btn btn-success"
                    onclick="collectPayment('${month}','${phone}')"
                >
                    تحصيل
                </button>

            </td>
        `;

        tbody.appendChild(tr);
    }

    if (count === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    لا توجد بيانات
                </td>
            </tr>
        `;
    }
}

async function collectPayment(month, phone) {

    const amount =
        Number(document.getElementById(`pay-${phone}`).value);

    if (!amount || amount <= 0) {
        return alert("أدخل مبلغ صحيح");
    }

    const invoiceRef =
        db.ref(`invoices/${month}/${phone}`);

    const snap =
        await invoiceRef.once("value");

    const invoice =
        snap.val();

    const oldPaid =
        Number(invoice.paidAmount || 0);

    const newPaid =
        oldPaid + amount;

    const packagePrice =
        Number(invoice.packagePrice || 0);

    const status =
        newPaid >= packagePrice
            ? "مدفوع بالكامل"
            : "مدفوع جزئياً";

    await invoiceRef.update({
        paidAmount: newPaid,
        status
    });

    await savePaymentHistory(
        phone,
        month,
        amount,
        "تحصيل يدوي"
    );

    alert("تم تسجيل التحصيل");

    loadCollectionMonth();

    loadDashboard();
}

// ==========================================
// سجل المدفوعات
// ==========================================

async function savePaymentHistory(
    phone,
    month,
    amount,
    type
) {

    const key =
        db.ref("paymentHistory").push().key;

    await db.ref(
        `paymentHistory/${key}`
    ).set({

        phone,
        month,
        amount,
        type,

        createdAt:
            new Date().toISOString()

    });
}

async function loadPaymentHistory() {

    const tbody =
        document.getElementById(
            "paymentHistoryTable"
        );

    if (!tbody) return;

    const snap =
        await db.ref(
            "paymentHistory"
        ).once("value");

    const data =
        snap.val() || {};

    tbody.innerHTML = "";

    Object.keys(data)
        .reverse()
        .forEach(key => {

            const row = data[key];

            tbody.innerHTML += `
                <tr>
                    <td>${row.phone}</td>
                    <td>${row.month}</td>
                    <td>${row.amount}</td>
                    <td>${row.type}</td>
                    <td>${new Date(
                        row.createdAt
                    ).toLocaleString()}</td>
                </tr>
            `;
        });
}

// ==========================================
// المحفظة الذكية
// ==========================================

async function searchWalletCustomer() {

    const keyword =
        document.getElementById(
            "walletSearch"
        ).value.trim();

    if (!keyword)
        return alert("أدخل رقم أو اسم");

    const snap =
        await db.ref(
            "customers"
        ).once("value");

    const customers =
        snap.val() || {};

    let foundPhone = null;

    for (const phone in customers) {

        const c = customers[phone];

        if (
            phone.includes(keyword) ||
            c.name.includes(keyword)
        ) {

            foundPhone = phone;
            break;
        }
    }

    if (!foundPhone)
        return alert("غير موجود");

    const customer =
        customers[foundPhone];

    const walletSnap =
        await db.ref(
            `wallet/${foundPhone}`
        ).once("value");

    const balance =
        Number(walletSnap.val() || 0);

    document.getElementById(
        "walletCustomerName"
    ).innerText =
        customer.name;

    document.getElementById(
        "walletCustomerPhone"
    ).innerText =
        foundPhone;

    document.getElementById(
        "walletBalance"
    ).innerText =
        balance.toFixed(2);

    document
        .getElementById("walletCard")
        .setAttribute(
            "data-phone",
            foundPhone
        );

    document.getElementById(
        "walletCard"
    ).style.display = "block";
}

async function addWalletBalance() {

    const card =
        document.getElementById(
            "walletCard"
        );

    const phone =
        card.getAttribute(
            "data-phone"
        );

    const amount =
        Number(
            document.getElementById(
                "walletAmount"
            ).value
        );

    if (!phone)
        return alert("اختر عميل");

    if (!amount || amount <= 0)
        return alert("أدخل مبلغ");

    const snap =
        await db.ref(
            `wallet/${phone}`
        ).once("value");

    const current =
        Number(snap.val() || 0);

    const newBalance =
        current + amount;

    await db.ref(
        `wallet/${phone}`
    ).set(newBalance);

    await savePaymentHistory(
        phone,
        "رصيد مقدم",
        amount,
        "إيداع محفظة"
    );

    alert("تم الإيداع");

    searchWalletCustomer();
}

// ==========================================
// تسوية المحفظة تلقائياً
// ==========================================

async function settleWallet(phone) {

    const walletSnap =
        await db.ref(
            `wallet/${phone}`
        ).once("value");

    let balance =
        Number(walletSnap.val() || 0);

    if (balance <= 0)
        return alert(
            "لا يوجد رصيد"
        );

    const invoicesSnap =
        await db.ref(
            "invoices"
        ).once("value");

    const invoices =
        invoicesSnap.val() || {};

    let settled = 0;

    for (const month in invoices) {

        if (!invoices[month][phone])
            continue;

        const inv =
            invoices[month][phone];

        const packagePrice =
            Number(
                inv.packagePrice || 0
            );

        const paid =
            Number(
                inv.paidAmount || 0
            );

        const debt =
            packagePrice - paid;

        if (debt <= 0)
            continue;

        if (balance <= 0)
            break;

        let payNow =
            Math.min(balance, debt);

        balance -= payNow;

        const newPaid =
            paid + payNow;

        await db.ref(
            `invoices/${month}/${phone}`
        ).update({

            paidAmount: newPaid,

            status:
                newPaid >= packagePrice
                    ? "مدفوع بالكامل"
                    : "مدفوع جزئياً"
        });

        await savePaymentHistory(
            phone,
            month,
            payNow,
            "خصم من المحفظة"
        );

        settled++;
    }

    await db.ref(
        `wallet/${phone}`
    ).set(balance);

    alert(
        `تمت تسوية ${settled} فاتورة`
    );

    loadDashboard();
}

// ==========================================
// أحداث الصفحة
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const collectionMonth =
            document.getElementById(
                "collectionMonth"
            );

        if (collectionMonth) {

            collectionMonth
                .addEventListener(
                    "change",
                    loadCollectionMonth
                );
        }
    }
);
// ==========================================
// [4] Dashboard & Reports
// ==========================================

async function loadDashboard() {

    const totalCustomersEl =
        document.getElementById("dashCustomers");

    const totalInvoicesEl =
        document.getElementById("dashInvoices");

    const totalCollectedEl =
        document.getElementById("dashCollected");

    const totalDebtEl =
        document.getElementById("dashDebt");

    const totalProfitEl =
        document.getElementById("dashProfit");

    const customersSnap =
        await db.ref("customers").once("value");

    const customers =
        customersSnap.val() || {};

    const invoicesSnap =
        await db.ref("invoices").once("value");

    const invoices =
        invoicesSnap.val() || {};

    let customerCount = 0;
    let invoiceTotal = 0;
    let collectedTotal = 0;
    let debtTotal = 0;

    customerCount =
        Object.keys(customers).length;

    for (const month in invoices) {

        for (const phone in invoices[month]) {

            const inv =
                invoices[month][phone];

            const packagePrice =
                Number(
                    inv.packagePrice || 0
                );

            const paid =
                Number(
                    inv.paidAmount || 0
                );

            invoiceTotal += packagePrice;
            collectedTotal += paid;

            debtTotal +=
                Math.max(
                    packagePrice - paid,
                    0
                );
        }
    }

    const profit =
        collectedTotal - invoiceTotal;

    if (totalCustomersEl)
        totalCustomersEl.innerText =
            customerCount;

    if (totalInvoicesEl)
        totalInvoicesEl.innerText =
            invoiceTotal.toFixed(2);

    if (totalCollectedEl)
        totalCollectedEl.innerText =
            collectedTotal.toFixed(2);

    if (totalDebtEl)
        totalDebtEl.innerText =
            debtTotal.toFixed(2);

    if (totalProfitEl)
        totalProfitEl.innerText =
            profit.toFixed(2);

    loadRecentPayments();
}

// ==========================================
// أحدث المدفوعات
// ==========================================

async function loadRecentPayments() {

    const container =
        document.getElementById(
            "recentPayments"
        );

    if (!container) return;

    const snap =
        await db.ref(
            "paymentHistory"
        ).once("value");

    const history =
        snap.val() || {};

    container.innerHTML = "";

    Object.keys(history)
        .reverse()
        .slice(0, 10)
        .forEach(key => {

            const item =
                history[key];

            container.innerHTML += `
                <div class="recent-item">
                    <strong>${item.phone}</strong>
                    <span>${item.amount} ج.م</span>
                </div>
            `;
        });
}

// ==========================================
// تقرير الأرباح
// ==========================================

async function generateFinancialReport() {

    const reportBox =
        document.getElementById(
            "financialReport"
        );

    if (!reportBox) return;

    const invoicesSnap =
        await db.ref(
            "invoices"
        ).once("value");

    const invoices =
        invoicesSnap.val() || {};

    let revenue = 0;
    let cost = 0;

    for (const month in invoices) {

        for (const phone in invoices[month]) {

            const inv =
                invoices[month][phone];

            revenue +=
                Number(
                    inv.paidAmount || 0
                );

            cost +=
                Number(
                    inv.totalAfterTaxes || 0
                );
        }
    }

    const net =
        revenue - cost;

    reportBox.innerHTML = `
        <div class="report-card">
            <h3>إجمالي التحصيل</h3>
            <h2>${revenue.toFixed(2)} ج.م</h2>
        </div>

        <div class="report-card">
            <h3>إجمالي فواتير فودافون</h3>
            <h2>${cost.toFixed(2)} ج.م</h2>
        </div>

        <div class="report-card">
            <h3>صافي الربح</h3>
            <h2>${net.toFixed(2)} ج.م</h2>
        </div>
    `;
}

// ==========================================
// Backup
// ==========================================

async function exportBackup() {

    const customers =
        (
            await db.ref(
                "customers"
            ).once("value")
        ).val() || {};

    const invoices =
        (
            await db.ref(
                "invoices"
            ).once("value")
        ).val() || {};

    const wallet =
        (
            await db.ref(
                "wallet"
            ).once("value")
        ).val() || {};

    const history =
        (
            await db.ref(
                "paymentHistory"
            ).once("value")
        ).val() || {};

    const backup = {

        customers,
        invoices,
        wallet,
        history,

        exportDate:
            new Date()
            .toISOString()
    };

    const blob =
        new Blob(
            [
                JSON.stringify(
                    backup,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

    a.href = url;

    a.download =
        `backup-${Date.now()}.json`;

    a.click();

    URL.revokeObjectURL(url);
}

// ==========================================
// Restore
// ==========================================

function restoreBackup(event) {

    const file =
        event.target.files[0];

    if (!file) return;

    const reader =
        new FileReader();

    reader.onload =
        async function(e) {

        try {

            const data =
                JSON.parse(
                    e.target.result
                );

            if (
                !confirm(
                    "سيتم استبدال البيانات الحالية بالكامل"
                )
            ) {
                return;
            }

            await db.ref().set(data);

            alert(
                "تم استعادة النسخة الاحتياطية"
            );

            location.reload();

        } catch {

            alert(
                "ملف النسخة غير صالح"
            );
        }
    };

    reader.readAsText(file);
}

// ==========================================
// Dark Mode
// ==========================================

function toggleDarkMode() {

    document.body.classList.toggle(
        "dark-mode"
    );

    const enabled =
        document.body.classList.contains(
            "dark-mode"
        );

    localStorage.setItem(
        "darkMode",
        enabled
    );
}

function loadDarkMode() {

    const enabled =
        localStorage.getItem(
            "darkMode"
        );

    if (enabled === "true") {

        document.body.classList.add(
            "dark-mode"
        );
    }
}

// ==========================================
// Export Excel
// ==========================================

async function exportCustomersExcel() {

    const snap =
        await db.ref(
            "customers"
        ).once("value");

    const customers =
        snap.val() || {};

    const rows = [];

    for (const phone in customers) {

        rows.push({

            الاسم:
                customers[phone].name,

            الرقم:
                phone,

            سعر_الباقة:
                customers[phone].price,

            الخطة:
                customers[phone]
                    .ratePlan
        });
    }

    const ws =
        XLSX.utils.json_to_sheet(
            rows
        );

    const wb =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        "Customers"
    );

    XLSX.writeFile(
        wb,
        "customers.xlsx"
    );
}

// ==========================================
// Export Payment History Excel
// ==========================================

async function exportHistoryExcel() {

    const snap =
        await db.ref(
            "paymentHistory"
        ).once("value");

    const history =
        snap.val() || {};

    const rows = [];

    Object.values(history)
        .forEach(item => {

            rows.push({

                رقم:
                    item.phone,

                شهر:
                    item.month,

                مبلغ:
                    item.amount,

                نوع:
                    item.type,

                تاريخ:
                    item.createdAt
            });
        });

    const ws =
        XLSX.utils.json_to_sheet(
            rows
        );

    const wb =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        ws,
        "History"
    );

    XLSX.writeFile(
        wb,
        "payment-history.xlsx"
    );
}

// ==========================================
// إعدادات التشغيل
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadDarkMode();

        loadDashboard();

        generateFinancialReport();

        loadPaymentHistory();
    }
);
// ==========================================
// [5] البحث الشامل المتقدم
// ==========================================

async function globalSearch() {

    const keyword =
        document.getElementById("globalSearch")
        ?.value.trim()
        .toLowerCase();

    const container =
        document.getElementById("searchResults");

    if (!container) return;

    if (!keyword) {

        container.innerHTML = `
            <div class="empty-state">
                اكتب رقم أو اسم للبحث
            </div>
        `;
        return;
    }

    const customers =
        (
            await db.ref("customers")
            .once("value")
        ).val() || {};

    container.innerHTML = "";

    let found = false;

    for (const phone in customers) {

        const c = customers[phone];

        if (
            phone.includes(keyword) ||
            c.name.toLowerCase().includes(keyword)
        ) {

            found = true;

            container.innerHTML += `
                <div class="customer-card">

                    <h3>${c.name}</h3>

                    <p>${phone}</p>

                    <p>
                        الباقة:
                        ${c.price || 0}
                        ج.م
                    </p>

                    <button
                        class="btn btn-primary"
                        onclick="showAccountStatement('${phone}')"
                    >
                        كشف الحساب
                    </button>

                </div>
            `;
        }
    }

    if (!found) {

        container.innerHTML = `
            <div class="empty-state">
                لا توجد نتائج
            </div>
        `;
    }
}

// ==========================================
// كشف الحساب
// ==========================================

async function showAccountStatement(phone) {

    const modal =
        document.getElementById(
            "statementModal"
        );

    const body =
        document.getElementById(
            "statementBody"
        );

    if (!modal || !body) return;

    const customer =
        (
            await db.ref(
                `customers/${phone}`
            ).once("value")
        ).val();

    const invoices =
        (
            await db.ref(
                "invoices"
            ).once("value")
        ).val() || {};

    let rows = "";

    let totalDebt = 0;
    let totalPaid = 0;

    for (const month in invoices) {

        if (!invoices[month][phone])
            continue;

        const inv =
            invoices[month][phone];

        const packagePrice =
            Number(
                inv.packagePrice || 0
            );

        const paid =
            Number(
                inv.paidAmount || 0
            );

        const remain =
            packagePrice - paid;

        totalPaid += paid;
        totalDebt += remain;

        rows += `
            <tr>
                <td>${month}</td>
                <td>${packagePrice}</td>
                <td>${paid}</td>
                <td>${remain}</td>
                <td>${inv.status}</td>
            </tr>
        `;
    }

    body.innerHTML = `
        <div class="statement-header">

            <h2>
                ${customer.name}
            </h2>

            <p>${phone}</p>

            <div class="summary">

                <span>
                    المدفوع:
                    ${totalPaid}
                </span>

                <span>
                    المتبقي:
                    ${totalDebt}
                </span>

            </div>

        </div>

        <table class="table">

            <thead>

                <tr>
                    <th>الشهر</th>
                    <th>الباقة</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                    <th>الحالة</th>
                </tr>

            </thead>

            <tbody>
                ${rows}
            </tbody>

        </table>
    `;

    modal.style.display = "flex";
}

// ==========================================
// إغلاق كشف الحساب
// ==========================================

function closeStatement() {

    document.getElementById(
        "statementModal"
    ).style.display = "none";
}

// ==========================================
// تعديل سعر فاتورة تاريخية
// ==========================================

async function updateHistoricalPrice(
    month,
    phone,
    newPrice
) {

    newPrice =
        Number(newPrice);

    if (
        !newPrice ||
        newPrice <= 0
    ) {

        showToast(
            "سعر غير صحيح",
            "error"
        );

        return;
    }

    await db.ref(
        `invoices/${month}/${phone}`
    ).update({

        packagePrice:
            newPrice

    });

    showToast(
        "تم تعديل السعر",
        "success"
    );

    loadCollectionMonth();
    loadDashboard();
}

// ==========================================
// حذف شهر كامل
// ==========================================

async function deleteInvoiceMonth() {

    const month =
        document.getElementById(
            "deleteMonth"
        ).value;

    if (!month)
        return;

    if (
        !confirm(
            `حذف شهر ${month} ؟`
        )
    ) return;

    await db.ref(
        `invoices/${month}`
    ).remove();

    showToast(
        "تم حذف الشهر",
        "success"
    );

    loadDashboard();
}

// ==========================================
// حذف فاتورة عميل
// ==========================================

async function deleteInvoice(
    month,
    phone
) {

    if (
        !confirm(
            "تأكيد الحذف؟"
        )
    ) return;

    await db.ref(
        `invoices/${month}/${phone}`
    ).remove();

    showToast(
        "تم الحذف",
        "success"
    );

    loadCollectionMonth();
}

// ==========================================
// فلترة الشهور
// ==========================================

async function loadMonthsLists() {

    const invoices =
        (
            await db.ref(
                "invoices"
            ).once("value")
        ).val() || {};

    const selects =
        document.querySelectorAll(
            ".month-select"
        );

    selects.forEach(select => {

        select.innerHTML =
            `<option value="">
                اختر شهر
            </option>`;

        Object.keys(invoices)
            .sort()
            .reverse()
            .forEach(month => {

                select.innerHTML += `
                    <option value="${month}">
                        ${month}
                    </option>
                `;
            });
    });
}

// ==========================================
// Toast Notifications
// ==========================================

function showToast(
    message,
    type = "success"
) {

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.innerText =
        message;

    document.body.appendChild(
        toast
    );

    setTimeout(() => {

        toast.classList.add(
            "show"
        );

    }, 50);

    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

        setTimeout(() => {

            toast.remove();

        }, 300);

    }, 3000);
}

// ==========================================
// تحسين الأداء
// ==========================================

const cache = {};

async function getCachedData(path) {

    if (cache[path]) {
        return cache[path];
    }

    const snap =
        await db.ref(path)
        .once("value");

    const data =
        snap.val();

    cache[path] = data;

    return data;
}

function clearCache() {

    Object.keys(cache)
    .forEach(key => {

        delete cache[key];

    });
}

// ==========================================
// مراقبة الاتصال
// ==========================================

function monitorConnection() {

    const connectedRef =
        firebase.database()
        .ref(".info/connected");

    connectedRef.on(
        "value",
        snap => {

            if (
                snap.val() === true
            ) {

                showToast(
                    "تم الاتصال بالخادم",
                    "success"
                );

            } else {

                showToast(
                    "انقطاع الاتصال",
                    "error"
                );
            }
        }
    );
}

// ==========================================
// تحديث تلقائي Dashboard
// ==========================================

function enableLiveDashboard() {

    db.ref("invoices")
    .on("value", () => {

        loadDashboard();

    });

    db.ref("paymentHistory")
    .on("value", () => {

        loadRecentPayments();

    });
}

// ==========================================
// تشغيل النظام
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadMonthsLists();

        monitorConnection();

        enableLiveDashboard();

    }
);

// ==========================================
// Version
// ==========================================

const APP_VERSION =
    "Vodafone Billing Pro v1.0.0";

console.log(APP_VERSION);

