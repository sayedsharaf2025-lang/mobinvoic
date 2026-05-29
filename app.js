// ==========================================
// [0] تكوين وبيانات قاعدة بيانات Firebase
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBfFRxvmhg8aqtuDgXAOofFGpVPklUF-gs",
    authDomain: "mobile-invoic-118d4.firebaseapp.com",
    databaseURL: "https://mobile-invoic-118d4-default-rtdb.firebaseio.com",
    projectId: "mobile-invoic-118d4",
    storageBucket: "mobile-invoic-118d4.firebasestorage.app",
    messagingSenderId: "795305971254",
    appId: "1:795305971254:web:7e8e874cfd805d33ec1297",
    measurementId: "G-YSV31DFCB4"
};

// تهيئة الاتصال بقاعدة البيانات
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentParsedInvoice = [];
let loadedGlobalSettings = {};
let loadedAdvancePayments = {};
let currentStatementPhone = "";

// ==========================================
// دالة تنسيق رقم الهاتف
// ==========================================
function formatPhoneNumber(num) {

    if (!num) return '';

    let s = num.toString().trim();

    if (s.endsWith('.0')) {
        s = s.substring(0, s.length - 2);
    }

    if (
        s.length === 10 &&
        (
            s.startsWith('1') ||
            s.startsWith('2') ||
            s.startsWith('5')
        )
    ) {
        s = '0' + s;
    }

    return s;
}

// ==========================================
// [1] التحميل والتنقل
// ==========================================
document.addEventListener("DOMContentLoaded", function () {

    const links = document.querySelectorAll('.sidebar .nav-links li');

    links.forEach(link => {

        link.addEventListener('click', function () {

            links.forEach(l => l.classList.remove('active'));

            this.classList.add('active');

            const target = this.getAttribute('data-target');

            document.querySelectorAll('.app-screen').forEach(screen => {
                screen.classList.remove('active-screen');
            });

            document
                .getElementById(target)
                .classList
                .add('active-screen');

            if (target === 'settings-screen') {
                loadSettingsTable();
            }

            if (target === 'collection-screen') {
                loadCollectionData();
            }

            updateInvoiceMonthsDropdowns();
        });
    });

    syncGlobalSettings();
    syncAdvancePayments();
    updateInvoiceMonthsDropdowns();
});

// ==========================================
// مزامنة الإعدادات
// ==========================================
function syncGlobalSettings() {

    db.ref('settings').on('value', snapshot => {

        loadedGlobalSettings = snapshot.val() || {};

        calculateFinancialReport();
    });
}

// ==========================================
// مزامنة المحفظة
// ==========================================
function syncAdvancePayments() {

    db.ref('advancePayments').on('value', snapshot => {

        loadedAdvancePayments = snapshot.val() || {};
    });
}

// ==========================================
// [2] استيراد الإعدادات
// ==========================================
function handleSettingsImport(e) {

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (evt) {

        const data = new Uint8Array(evt.target.result);

        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];

        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        processSettingsExcel(jsonData);
    };

    reader.readAsArrayBuffer(file);
}

function processSettingsExcel(data) {

    let importedCount = 0;

    data.forEach(row => {

        let name = row['الاسم'] || '';
        let rawPhone = row['الرقم'] || '';
        let price = row['سعر الباقه'] || 0;
        let plan = row['الاسعار'] || '';

        let phone = formatPhoneNumber(rawPhone);

        if (phone && name) {

            db.ref('settings/' + phone).set({
                name: name,
                price: parseFloat(price) || 0,
                ratePlan: plan
            });

            importedCount++;
        }
    });

    alert(`تم استيراد عدد (${importedCount}) مشترك بنجاح`);

    loadSettingsTable();
}

// ==========================================
// تحميل جدول الإعدادات
// ==========================================
function loadSettingsTable() {

    db.ref('settings').once('value', snapshot => {

        const data = snapshot.val() || {};

        const tbody =
            document.getElementById('settings-table-body');

        tbody.innerHTML = '';

        for (let phone in data) {

            const user = data[phone];

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${user.name}</td>
                <td>${phone}</td>
                <td>${user.price} ج.م</td>
                <td>${user.ratePlan || 'غير محدد'}</td>
                <td>
                    <button onclick="deleteUser('${phone}')">
                        حذف
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        }
    });
}

// ==========================================
// حذف مشترك
// ==========================================
function deleteUser(phone) {

    if (!confirm(`حذف ${phone} ؟`)) return;

    db.ref('settings/' + phone).remove(() => {

        loadSettingsTable();

        calculateFinancialReport();
    });
}

// ==========================================
// [3] استيراد الفواتير
// ==========================================
function handleInvoiceImport(e) {

    const file = e.target.files[0];

    if (!file) return;

    currentParsedInvoice = [];

    const reader = new FileReader();

    reader.onload = function (evt) {

        const data = new Uint8Array(evt.target.result);

        const workbook = XLSX.read(data, { type: 'array' });

        const sheetName = workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        processInvoiceExcel(jsonData);
    };

    reader.readAsArrayBuffer(file);
}

function processInvoiceExcel(data) {

    currentParsedInvoice = [];

    data.forEach(row => {

        let rawPhone = row['Mobile Number'] || '';
        let ratePlan = row['Rate Plan'] || '';
        let totalTaxes = row['Total After Taxes'] || 0;

        let phone = formatPhoneNumber(rawPhone);

        if (phone) {

            currentParsedInvoice.push({
                phone: phone,
                ratePlan: ratePlan,
                totalTaxes: parseFloat(totalTaxes) || 0
            });
        }
    });

    alert("تم تحليل الفاتورة بنجاح");
}

// ==========================================
// حفظ الفاتورة
// ==========================================
function saveProcessedInvoice() {

    const month =
        document.getElementById('invoice-month-select').value;

    if (!month) {
        return alert("اختر الشهر");
    }

    if (currentParsedInvoice.length === 0) {
        return alert("لا توجد بيانات");
    }

    currentParsedInvoice.forEach(item => {

        if (!loadedGlobalSettings[item.phone]) {

            db.ref('settings/' + item.phone).set({
                name: "بدون اسم",
                price: 0,
                ratePlan: item.ratePlan
            });
        }

        const user =
            loadedGlobalSettings[item.phone] || { price: 0 };

        const requiredAmount = user.price;

        db.ref(`invoices/${month}/${item.phone}`).set({
            ratePlan: item.ratePlan,
            totalAfterTaxes: item.totalTaxes,
            packagePrice: requiredAmount,
            paidAmount: 0,
            status: "غير مدفوع"
        });
    });

    alert("تم حفظ الفواتير");
}

// ==========================================
// [4] شاشة التحصيل
// ==========================================
function loadCollectionData() {

    const month =
        document.getElementById('collection-month-select').value;

    const tbody =
        document.getElementById('collection-table-body');

    tbody.innerHTML = '';

    if (!month) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {

        const invoices = snapshot.val() || {};

        for (let phone in invoices) {

            const inv = invoices[phone];

            const user =
                loadedGlobalSettings[phone] ||
                { name: "بدون اسم", price: 0 };

            const paid = inv.paidAmount || 0;

            const packageAmt =
                parseFloat(inv.packagePrice) || 0;

            const remaining = packageAmt - paid;

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${phone}</td>
                <td>${user.name}</td>
                <td>${packageAmt}</td>
                <td>${paid}</td>
                <td>${remaining}</td>
                <td>
                    <input
                        type="number"
                        id="pay-${phone}"
                        value="0"
                    >

                    <button
                        onclick="collectCustomPayment(
                            '${month}',
                            '${phone}',
                            ${packageAmt},
                            ${paid}
                        )">
                        تحصيل
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
        }
    });
}

// ==========================================
// تسجيل دفعة
// ==========================================
function collectCustomPayment(
    month,
    phone,
    requiredTotal,
    alreadyPaid
) {

    const amt =
        parseFloat(
            document.getElementById(`pay-${phone}`).value
        );

    if (isNaN(amt) || amt <= 0) {
        return alert("ادخل قيمة صحيحة");
    }

    const newPaid = alreadyPaid + amt;

    const newStatus =
        newPaid >= requiredTotal
            ? "مدفوع بالكامل"
            : "مدفوع جزئياً";

    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: newStatus
    }, () => {

        alert("تم التحصيل");

        loadCollectionData();

        calculateFinancialReport();
    });
}

// ==========================================
// [5] المحفظة
// ==========================================
function saveAdvancePayment() {

    const phone =
        document.getElementById('advance-phone').value;

    const amount =
        parseFloat(
            document.getElementById('advance-amount').value
        );

    if (!phone || isNaN(amount) || amount <= 0) {
        return alert("بيانات غير صحيحة");
    }

    db.ref(`advancePayments/${phone}`).once('value', snapshot => {

        const current = snapshot.val() || 0;

        db.ref(`advancePayments/${phone}`).set(
            current + amount,
            () => {
                alert("تم إضافة الرصيد");
            }
        );
    });
}

// ==========================================
// [6] التقارير
// ==========================================
function calculateFinancialReport() {

    const reportResults =
        document.getElementById('financial-report-results');

    if (!reportResults) return;

    db.ref('invoices').once('value', snapshot => {

        const allInvoices = snapshot.val() || {};

        let totalPackages = 0;
        let totalInvoices = 0;
        let totalPaid = 0;

        for (let month in allInvoices) {

            for (let phone in allInvoices[month]) {

                const inv = allInvoices[month][phone];

                totalPackages +=
                    parseFloat(inv.packagePrice) || 0;

                totalInvoices +=
                    parseFloat(inv.totalAfterTaxes) || 0;

                totalPaid +=
                    parseFloat(inv.paidAmount) || 0;
            }
        }

        const profit = totalPackages - totalInvoices;

        reportResults.innerHTML = `
            <div>
                <h3>إجمالي الباقات</h3>
                <strong>${totalPackages.toFixed(2)} ج.م</strong>
            </div>

            <div>
                <h3>إجمالي الفواتير</h3>
                <strong>${totalInvoices.toFixed(2)} ج.م</strong>
            </div>

            <div>
                <h3>إجمالي المدفوع</h3>
                <strong>${totalPaid.toFixed(2)} ج.م</strong>
            </div>

            <div>
                <h3>صافي الربح</h3>
                <strong>${profit.toFixed(2)} ج.م</strong>
            </div>
        `;
    });
}

// =========================================================================
// [8] كشف الحساب التفصيلي والسداد الذكي
// =========================================================================

function generateDetailedStatement() {

    const input =
        document
        .getElementById('statement-search-input')
        .value
        .trim()
        .toLowerCase();

    const outputArea =
        document.getElementById('statement-output-area');

    const tbody =
        document.getElementById('statement-table-body');

    if (!input) {
        return alert("يرجى إدخال اسم أو رقم");
    }

    let targetPhone = "";
    let targetName = "";

    for (let phone in loadedGlobalSettings) {

        if (
            phone === input ||
            loadedGlobalSettings[phone]
                .name
                .toLowerCase()
                .includes(input)
        ) {
            targetPhone = phone;
            targetName =
                loadedGlobalSettings[phone].name;

            break;
        }
    }

    if (!targetPhone) {

        outputArea.style.display = 'none';

        return alert("المشترك غير موجود");
    }

    currentStatementPhone = targetPhone;

    db.ref('invoices').once('value', snapshot => {

        const allInvoices = snapshot.val() || {};

        tbody.innerHTML = "";

        let totalRequired = 0;
        let totalPaid = 0;
        let totalDebt = 0;

        for (let month in allInvoices) {

            if (allInvoices[month][targetPhone]) {

                const inv =
                    allInvoices[month][targetPhone];

                const packagePrice =
                    parseFloat(inv.packagePrice) || 0;

                const actualBill =
                    parseFloat(inv.totalAfterTaxes) || 0;

                const paidAmount =
                    parseFloat(inv.paidAmount) || 0;

                const remainingDebt =
                    Math.max(0, packagePrice - paidAmount);

                totalRequired += packagePrice;
                totalPaid += paidAmount;
                totalDebt += remainingDebt;

                const tr = document.createElement('tr');

                tr.innerHTML = `
                    <td>${month}</td>
                    <td>${inv.ratePlan || ''}</td>
                    <td>${packagePrice}</td>
                    <td>${actualBill}</td>
                    <td>${paidAmount}</td>
                    <td>${remainingDebt}</td>
                `;

                tbody.appendChild(tr);
            }
        }

        const walletBalance =
            loadedAdvancePayments[targetPhone] || 0;

        document.getElementById(
            'statement-client-name'
        ).innerText = targetName;

        document.getElementById(
            'statement-client-phone'
        ).innerText = targetPhone;

        document.getElementById(
            'statement-total-required'
        ).innerText = totalRequired.toFixed(2);

        document.getElementById(
            'statement-total-paid'
        ).innerText = totalPaid.toFixed(2);

        document.getElementById(
            'statement-total-debt'
        ).innerText = totalDebt.toFixed(2);

        document.getElementById(
            'statement-wallet-balance'
        ).innerText = walletBalance.toFixed(2);

        const settleBtn =
            document.getElementById('statement-settle-btn');

        if (totalDebt > 0 && walletBalance > 0) {
            settleBtn.style.display = 'inline-flex';
        } else {
            settleBtn.style.display = 'none';
        }

        outputArea.style.display = 'block';
    });
}

// ==========================================
// السداد الذكي من المحفظة
// ==========================================
function settleStatementDebtsWithWallet() {

    if (!currentStatementPhone) return;

    let walletBalance =
        loadedAdvancePayments[currentStatementPhone] || 0;

    if (walletBalance <= 0) {
        return alert("رصيد المحفظة صفر");
    }

    db.ref('invoices').once('value', snapshot => {

        const allInvoices = snapshot.val() || {};

        let updates = {};

        for (let month in allInvoices) {

            if (
                allInvoices[month][currentStatementPhone]
                && walletBalance > 0
            ) {

                const inv =
                    allInvoices[month][currentStatementPhone];

                const packagePrice =
                    parseFloat(inv.packagePrice) || 0;

                const paidAmount =
                    parseFloat(inv.paidAmount) || 0;

                const remainingDebt =
                    packagePrice - paidAmount;

                if (remainingDebt > 0) {

                    if (walletBalance >= remainingDebt) {

                        walletBalance -= remainingDebt;

                        updates[
                            `invoices/${month}/${currentStatementPhone}/paidAmount`
                        ] = packagePrice;

                        updates[
                            `invoices/${month}/${currentStatementPhone}/status`
                        ] = "مدفوع بالكامل";

                    } else {

                        const newPaid =
                            paidAmount + walletBalance;

                        walletBalance = 0;

                        updates[
                            `invoices/${month}/${currentStatementPhone}/paidAmount`
                        ] = newPaid;

                        updates[
                            `invoices/${month}/${currentStatementPhone}/status`
                        ] = "مدفوع جزئياً";
                    }
                }
            }
        }

        updates[
            `advancePayments/${currentStatementPhone}`
        ] = walletBalance;

        db.ref().update(updates, () => {

            alert("تم السداد الذكي بنجاح");

            generateDetailedStatement();

            loadCollectionData();

            calculateFinancialReport();
        });
    });
}
