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
// دالة تنسيق رقم الهاتف (تنظيف الأرقام)
// ==========================================
function formatPhoneNumber(num) {
    if (!num) return '';
    let s = num.toString().trim();
    if (s.endsWith('.0')) {
        s = s.substring(0, s.length - 2);
    }
    if (s.length === 10 && (s.startsWith('1') || s.startsWith('2') || s.startsWith('5'))) {
        s = '0' + s;
    }
    return s;
}

// ==========================================
// [1] التحميل والتنقل وتوثيق الشاشات
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

            const currentScreen = document.getElementById(target);
            if(currentScreen) {
                currentScreen.classList.add('active-screen');
            }

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
// مزامنة البيانات اللحظية من السيرفر
// ==========================================
function syncGlobalSettings() {
    db.ref('settings').on('value', snapshot => {
        loadedGlobalSettings = snapshot.val() || {};
        calculateFinancialReport();
    });
}

function syncAdvancePayments() {
    db.ref('advancePayments').on('value', snapshot => {
        loadedAdvancePayments = snapshot.val() || {};
    });
}

// تحديث قوائم الأشهر ديناميكياً في الواجهات
function updateInvoiceMonthsDropdowns() {
    db.ref('invoices').once('value', snapshot => {
        const invoices = snapshot.val() || {};
        const months = Object.keys(invoices);
        
        const selectors = ['search-month-select', 'delete-invoice-month-select', 'collection-month-select'];
        selectors.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            
            let html = id === 'search-month-select' ? '<option value="all">كل الأشهر المتاحة</option>' : '';
            if (months.length === 0) {
                html += '<option value="">لا توجد أشهر مسجلة</option>';
            } else {
                months.forEach(m => {
                    html += `<option value="${m}">${m}</option>`;
                });
            }
            el.innerHTML = html;
        });
    });
}

// ==========================================
// [2] شاشة الإعدادات والأفراد (دليل المشتركين)
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
        let name = row['الاسم'] || row['اسم المشترك'] || '';
        let rawPhone = row['الرقم'] || row['رقم الهاتف'] || '';
        let price = row['سعر الباقه'] || row['سعر الباقة'] || 0;
        let plan = row['الاسعار'] || row['خطة الاسعار'] || '';

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
    alert(`تم استيراد عدد (${importedCount}) مشترك بنجاح مالي لدليل النظام.`);
    loadSettingsTable();
}

function loadSettingsTable() {
    const tbody = document.getElementById('settings-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    for (let phone in loadedGlobalSettings) {
        const user = loadedGlobalSettings[phone];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${phone}</td>
            <td>${user.price} ج.م</td>
            <td>${user.ratePlan || 'غير محدد'}</td>
            <td>
                <button class="btn btn-red" style="padding: 4px 10px; font-size:12px;" onclick="deleteUser('${phone}')">حذف</button>
                <button class="btn btn-green" style="padding: 4px 10px; font-size:12px;" onclick="openEditModal('${phone}')">تعديل</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function addNewUserFromSettings() {
    const name = document.getElementById('new-user-name').value.trim();
    const rawPhone = document.getElementById('new-user-phone').value.trim();
    const price = parseFloat(document.getElementById('new-user-price').value);
    const plan = document.getElementById('new-user-plan').value.trim();

    const phone = formatPhoneNumber(rawPhone);
    if (!name || !phone || isNaN(price)) {
        return alert("يرجى تعبئة كافة الحقول الأساسية بشكل صحيح لإدراج المشترك.");
    }

    db.ref('settings/' + phone).set({
        name: name,
        price: price,
        ratePlan: plan || 'غير محدد'
    }, () => {
        alert("تم إدراج العميل الجديد بنجاح صريح.");
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-phone').value = '';
        document.getElementById('new-user-price').value = '';
        document.getElementById('new-user-plan').value = '';
        loadSettingsTable();
    });
}

function filterSettingsTable() {
    const query = document.getElementById('settings-table-search').value.toLowerCase();
    const rows = document.querySelectorAll('#settings-table-body tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

function deleteUser(phone) {
    if (!confirm(`هل أنت متأكد تماماً من إزالة المشترك صاحب الرقم ${phone} من قاعدة البيانات؟`)) return;
    db.ref('settings/' + phone).remove(() => {
        loadSettingsTable();
        calculateFinancialReport();
    });
}

// ==========================================
// [3] شاشة معالجة الفواتير (الرفع والاستيراد)
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
    const previewCard = document.getElementById('invoice-preview-card');
    const tbody = document.querySelector('#invoice-preview-table tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        let rawPhone = row['Mobile Number'] || row['رقم الهاتف'] || '';
        let ratePlan = row['Rate Plan'] || row['نظام الحساب'] || '';
        let totalTaxes = row['Total After Taxes'] || row['الاجمالي بعد الضريبة'] || 0;

        let phone = formatPhoneNumber(rawPhone);
        if (phone) {
            currentParsedInvoice.push({
                phone: phone,
                ratePlan: ratePlan,
                totalTaxes: parseFloat(totalTaxes) || 0
            });

            const userExists = loadedGlobalSettings[phone];
            const badgeHTML = userExists 
                ? `<span class="badge badge-green">${loadedGlobalSettings[phone].name}</span>`
                : `<span class="badge badge-orange">رقم غير مسجل (سيتم إدراجه تلقائياً)</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${phone}</td>
                <td>${ratePlan}</td>
                <td>${parseFloat(totalTaxes).toFixed(2)} ج.م</td>
                <td>${badgeHTML}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (currentParsedInvoice.length > 0) {
        previewCard.style.display = 'block';
        alert(`تم تحليل الملف البرمجي وعرض عدد (${currentParsedInvoice.length}) سجل بنجاح للمراجعة والتدقيق قبل الاعتماد.`);
    } else {
        alert("تنبيه: لم يتم العثور على حقول مطابقة للبيانات المطلوبة بداخل ملف الـ Excel المرفوع.");
    }
}

function saveProcessedInvoice() {
    const month = document.getElementById('invoice-month-select').value;
    if (!month) return alert("خطأ: يرجى تحديد الشهر المستهدف لمعالجة وحفظ الفاتورة.");
    if (currentParsedInvoice.length === 0) return alert("لا توجد بيانات مستوردة لحفظها.");

    currentParsedInvoice.forEach(item => {
        if (!loadedGlobalSettings[item.phone]) {
            db.ref('settings/' + item.phone).set({
                name: "بدون اسم (مستورد)",
                price: 0,
                ratePlan: item.ratePlan
            });
        }
        const user = loadedGlobalSettings[item.phone] || { price: 0 };
        db.ref(`invoices/${month}/${item.phone}`).set({
            ratePlan: item.ratePlan,
            totalAfterTaxes: item.totalTaxes,
            packagePrice: user.price,
            paidAmount: 0,
            status: "غير مدفوع"
        });
    });

    alert(`تم حفظ واعتماد الفاتورة الشهرية لشهر ${month} بنجاح تصفيري تام وبناء المطالبات للحسابات.`);
    document.getElementById('invoice-preview-card').style.display = 'none';
    updateInvoiceMonthsDropdowns();
}

function deleteStoredInvoice() {
    const month = document.getElementById('delete-invoice-month-select').value;
    if (!month) return alert("يرجى اختيار شهر صالح للمسح.");
    if (!confirm(`تحذير قطعي: هل أنت متأكد من مسح كافة فواتير وتحصيلات شهر ${month} نهائياً؟`)) return;

    db.ref(`invoices/${month}`).remove(() => {
        alert(`تم مسح سجلات فواتير شهر ${month} بنجاح تام من خادم المنظومة.`);
        updateInvoiceMonthsDropdowns();
        calculateFinancialReport();
    });
}

// ==========================================
// [4] شاشة التحصيل المالي والسداد الجماعي
// ==========================================
function loadCollectionData() {
    const month = document.getElementById('collection-month-select').value;
    const tbody = document.getElementById('collection-table-body');
    tbody.innerHTML = '';
    if (!month) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const invoices = snapshot.val() || {};
        for (let phone in invoices) {
            const inv = invoices[phone];
            const user = loadedGlobalSettings[phone] || { name: "بدون اسم", price: 0 };
            const paid = inv.paidAmount || 0;
            const packageAmt = parseFloat(inv.packagePrice) || 0;
            const remaining = packageAmt - paid;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${phone}</td>
                <td>${user.name}</td>
                <td>${packageAmt.toFixed(2)} ج.م</td>
                <td>${(parseFloat(inv.totalAfterTaxes) || 0).toFixed(2)} ج.م</td>
                <td>${paid.toFixed(2)} ج.م</td>
                <td>
                    <span class="badge ${remaining <= 0 ? 'badge-green' : 'badge-red'}">
                        ${remaining <= 0 ? 'مسدد بالكامل' : 'متبقي: ' + remaining.toFixed(2) + ' ج.م'}
                    </span>
                </td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center;">
                        <input type="number" id="pay-${phone}" value="${remaining > 0 ? remaining : 0}" class="form-control" style="width:80px; padding:5px; margin:0;">
                        <button class="btn btn-green" style="padding: 5px 10px;" onclick="collectCustomPayment('${month}', '${phone}', ${packageAmt}, ${paid})">تحصيل</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function collectCustomPayment(month, phone, requiredTotal, alreadyPaid) {
    const amt = parseFloat(document.getElementById(`pay-${phone}`).value);
    if (isNaN(amt) || amt <= 0) return alert("يرجى إدخال مبالغ تحصيل صحيحة أكبر من الصفر.");

    const newPaid = alreadyPaid + amt;
    const newStatus = newPaid >= requiredTotal ? "مدفوع بالكامل" : "مدفوع جزئياً";

    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: newStatus
    }, () => {
        alert("تم توثيق السداد المالي بنجاح.");
        loadCollectionData();
        calculateFinancialReport();
    });
}

function payAllActiveInvoices() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return alert("اختر شهر مستهدف أولاً.");
    if (!confirm("تنبيه سداد جماعي: هل أنت متأكد من تسوية وتحصيل كافة المبالغ المعلقة لجميع الأرقام بهذا الشهر؟")) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const invoices = snapshot.val() || {};
        let updates = {};
        for (let phone in invoices) {
            const inv = invoices[phone];
            updates[`invoices/${month}/${phone}/paidAmount`] = parseFloat(inv.packagePrice) || 0;
            updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
        }
        db.ref().update(updates, () => {
            alert("تم إقفال وتحصيل حسابات الشهر بالكامل بنجاح مالي.");
            loadCollectionData();
            calculateFinancialReport();
        });
    });
}

// ==========================================
// [5] شاشة الدفع المقدم والمحافظ الرقمية
// ==========================================
function searchForAdvance() {
    const phoneInput = document.getElementById('advance-search-input').value.trim();
    const formattedPhone = formatPhoneNumber(phoneInput);
    const profileCard = document.getElementById('advance-profile-card');

    if (!formattedPhone) return alert("أدخل رقم العميل المراد الاستعلام عنه.");

    const user = loadedGlobalSettings[formattedPhone];
    if (!user) {
        profileCard.style.display = 'none';
        return alert("هذا الرقم غير مدرج بدليل الأفراد الحالي، يرجى تسجيله أولاً.");
    }

    document.getElementById('advance-user-name').innerText = user.name;
    document.getElementById('advance-user-phone').innerText = `الرقم المالي الثابت: ${formattedPhone}`;
    
    const balance = loadedAdvancePayments[formattedPhone] || 0;
    document.getElementById('current-advance-balance').innerText = `${balance.toFixed(2)} ج.م`;
    profileCard.style.display = 'block';
}

function saveAdvancePayment() {
    const phoneInput = document.getElementById('advance-search-input').value.trim();
    const phone = formatPhoneNumber(phoneInput);
    const amount = parseFloat(document.getElementById('new-advance-amount').value);

    if (!phone || isNaN(amount) || amount <= 0) {
        return alert("خطأ بالبيانات: يرجى كتابة مبالغ شحن صحيحة موجبة.");
    }

    const currentBalance = loadedAdvancePayments[phone] || 0;
    const newBalance = currentBalance + amount;

    db.ref(`advancePayments/${phone}`).set(newBalance, () => {
        alert("تم إيداع الدفعة المقدمة بنجاح وتحديث المحفظة الإلكترونية للعميل.");
        document.getElementById('new-advance-amount').value = '';
        searchForAdvance();
    });
}

// ==========================================
// [6] شاشة البحث الشامل والتقارير المالية والأرباح
// ==========================================
function executeGlobalSearch() {
    const query = document.getElementById('global-search-input').value.trim().toLowerCase();
    const monthFilter = document.getElementById('search-month-select').value;
    const resultsArea = document.getElementById('search-results-area');

    if (!query) return alert("يرجى إدخال اسم أو رقم الهاتف لبدء الاستعلام التراكمي الشامل.");

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        let html = `<div class="card"><h3>نتائج البحث والتحليل التراكمي للمشترك المالي</h3><div class="table-wrapper"><table><thead><tr><th>الشهر المالي</th><th>الاسم</th><th>الرقم</th><th>الباقة المعتمدة</th><th>فاتورة الإكسيل</th><th>المدفوع</th><th>الوضعية والمديونية</th></tr></thead><tbody>`;
        let matchesCount = 0;

        for (let month in allInvoices) {
            if (monthFilter !== 'all' && month !== monthFilter) continue;

            for (let phone in allInvoices[month]) {
                const user = loadedGlobalSettings[phone] || { name: 'بدون اسم' };
                if (phone.includes(query) || user.name.toLowerCase().includes(query)) {
                    const inv = allInvoices[month][phone];
                    const pack = parseFloat(inv.packagePrice) || 0;
                    const paid = parseFloat(inv.paidAmount) || 0;
                    const debt = pack - paid;

                    html += `<tr>
                        <td>${month}</td>
                        <td>${user.name}</td>
                        <td>${phone}</td>
                        <td>${pack.toFixed(2)} ج.م</td>
                        <td>${(parseFloat(inv.totalAfterTaxes) || 0).toFixed(2)} ج.م</td>
                        <td>${paid.toFixed(2)} ج.م</td>
                        <td><span class="badge ${debt <= 0 ? 'badge-green' : 'badge-red'}">${debt <= 0 ? 'خالص السداد' : 'متبقي مديونية: ' + debt.toFixed(2) + ' ج.م'}</span></td>
                    </tr>`;
                    matchesCount++;
                }
            }
        }
        html += `</tbody></table></div></div>`;
        resultsArea.innerHTML = matchesCount > 0 ? html : `<div class="card" style="text-align:center; padding:30px; color:#666;">لم يتم العثور على أي فواتير مطابقة لخيارات البحث المذكورة.</div>`;
    });
}

function saveExtraFinancials() {
    const manualInvoice = parseFloat(document.getElementById('manual-invoice-input').value) || 0;
    const extraRev = parseFloat(document.getElementById('additional-revenue-input').value) || 0;
    const extraExp = parseFloat(document.getElementById('additional-expenses-input').value) || 0;

    // حفظ التسويات تحت عقدة عامة مؤقتة أو ربطها بتقرير الأرباح التراكمي العام للشهر
    db.ref(`extraFinancials/summaryData`).set({
        manualInvoice: manualInvoice,
        additionalRevenue: extraRev,
        additionalExpenses: extraExp
    }, () => {
        alert("تم حفظ التسويات المالية والمدخلات اليدوية الإضافية للوحة الأرباح بنجاح بنية حاسبة.");
        calculateFinancialReport();
    });
}

function calculateFinancialReport() {
    const reportResults = document.getElementById('financial-report-results');
    if (!reportResults) return;

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        let totalPackages = 0;
        let totalInvoices = 0;
        let totalPaid = 0;

        for (let month in allInvoices) {
            for (let phone in allInvoices[month]) {
                const inv = allInvoices[month][phone];
                totalPackages += parseFloat(inv.packagePrice) || 0;
                totalInvoices += parseFloat(inv.totalAfterTaxes) || 0;
                totalPaid += parseFloat(inv.paidAmount) || 0;
            }
        }

        db.ref(`extraFinancials/summaryData`).once('value', extraSnap => {
            const extra = extraSnap.val() || { manualInvoice: 0, additionalRevenue: 0, additionalExpenses: 0 };
            
            const adjustedRevenue = totalPackages + (parseFloat(extra.additionalRevenue) || 0);
            const adjustedCost = totalInvoices + (parseFloat(extra.additionalExpenses) || 0);
            const netProfit = adjustedRevenue - adjustedCost;

            reportResults.innerHTML = `
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center;">
                    <h4 style="font-size:13px; color:#555; margin-bottom:5px;">إجمالي الباقات المسجلة</h4>
                    <strong style="font-size:18px; color:var(--text-color);">${totalPackages.toFixed(2)} ج.م</strong>
                </div>
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center;">
                    <h4 style="font-size:13px; color:#555; margin-bottom:5px;">التكلفة الفعلية (إكسيل فودافون)</h4>
                    <strong style="font-size:18px; color:var(--text-color);">${totalInvoices.toFixed(2)} ج.م</strong>
                </div>
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center;">
                    <h4 style="font-size:13px; color:#555; margin-bottom:5px;">المبالغ المحصلة فعلياً</h4>
                    <strong style="font-size:18px; color:var(--green-success);">${totalPaid.toFixed(2)} ج.م</strong>
                </div>
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center; border-top: 4px solid #2563eb;">
                    <h4 style="font-size:13px; color:#2563eb; margin-bottom:5px;">صافي الربح العام للمنظومة</h4>
                    <strong style="font-size:20px; color:#2563eb;">${netProfit.toFixed(2)} ج.م</strong>
                </div>
            `;
        });
    });
}

// ==========================================
// [7] كشف الحساب التفصيلي والسداد التلقائي التراكمي
// ==========================================
function generateDetailedStatement() {
    const input = document.getElementById('statement-search-input').value.trim().toLowerCase();
    const outputArea = document.getElementById('statement-output-area');
    const tbody = document.getElementById('statement-table-body');

    if (!input) return alert("يرجى إدخال اسم أو رقم لاستخراج كشف الحساب.");

    let targetPhone = "";
    let targetName = "";

    for (let phone in loadedGlobalSettings) {
        if (phone === input || loadedGlobalSettings[phone].name.toLowerCase().includes(input)) {
            targetPhone = phone;
            targetName = loadedGlobalSettings[phone].name;
            break;
        }
    }

    if (!targetPhone) {
        outputArea.style.display = 'none';
        return alert("عذراً، العميل المشترك غير موجود بسجلات المنظومة الأساسية.");
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
                const inv = allInvoices[month][targetPhone];
                const packagePrice = parseFloat(inv.packagePrice) || 0;
                const actualBill = parseFloat(inv.totalAfterTaxes) || 0;
                const paidAmount = parseFloat(inv.paidAmount) || 0;
                const remainingDebt = Math.max(0, packagePrice - paidAmount);

                totalRequired += packagePrice;
                totalPaid += paidAmount;
                totalDebt += remainingDebt;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${month}</td>
                    <td>${inv.ratePlan || 'غير محدد'}</td>
                    <td>${packagePrice.toFixed(2)} ج.م</td>
                    <td>${actualBill.toFixed(2)} ج.م</td>
                    <td>${paidAmount.toFixed(2)} ج.م</td>
                    <td>${remainingDebt.toFixed(2)} ج.م</td>
                    <td>
                        <span class="badge ${remainingDebt <= 0 ? 'badge-green' : 'badge-red'}">
                            ${remainingDebt <= 0 ? 'مسدد ومقفل' : 'معلق مديونية'}
                        </span>
                    </td>
                `;
                tbody.appendChild(tr);
            }
        }

        const walletBalance = loadedAdvancePayments[targetPhone] || 0;

        document.getElementById('statement-client-name').innerText = `اسم المشترك: ${targetName}`;
        document.getElementById('statement-client-phone').innerText = `رقم الهاتف: ${targetPhone}`;
        document.getElementById('statement-total-required').innerText = `${totalRequired.toFixed(2)} ج.م`;
        document.getElementById('statement-total-paid').innerText = `${totalPaid.toFixed(2)} ج.م`;
        document.getElementById('statement-total-debt').innerText = `${totalDebt.toFixed(2)} ج.م`;
        document.getElementById('statement-wallet-balance').innerText = `${walletBalance.toFixed(2)} ج.م`;

        const settleBtn = document.getElementById('statement-settle-btn');
        if (totalDebt > 0 && walletBalance > 0) {
            settleBtn.style.display = 'inline-flex';
        } else {
            settleBtn.style.display = 'none';
        }

        outputArea.style.display = 'block';
    });
}

function settleStatementDebtsWithWallet() {
    if (!currentStatementPhone) return;
    let walletBalance = loadedAdvancePayments[currentStatementPhone] || 0;

    if (walletBalance <= 0) return alert("رصيد المحفظة صفر، لا يوجد دفع مقدم متاح لتسويته مديونياً.");

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        let updates = {};

        for (let month in allInvoices) {
            if (allInvoices[month][currentStatementPhone] && walletBalance > 0) {
                const inv = allInvoices[month][currentStatementPhone];
                const packagePrice = parseFloat(inv.packagePrice) || 0;
                const paidAmount = parseFloat(inv.paidAmount) || 0;
                const remainingDebt = packagePrice - paidAmount;

                if (remainingDebt > 0) {
                    if (walletBalance >= remainingDebt) {
                        walletBalance -= remainingDebt;
                        updates[`invoices/${month}/${currentStatementPhone}/paidAmount`] = packagePrice;
                        updates[`invoices/${month}/${currentStatementPhone}/status`] = "مدفوع بالكامل";
                    } else {
                        const newPaid = paidAmount + walletBalance;
                        walletBalance = 0;
                        updates[`invoices/${month}/${currentStatementPhone}/paidAmount`] = newPaid;
                        updates[`invoices/${month}/${currentStatementPhone}/status`] = "مدفوع جزئياً";
                    }
                }
            }
        }

        updates[`advancePayments/${currentStatementPhone}`] = walletBalance;

        db.ref().update(updates, () => {
            alert("تم تنفيذ عملية السداد والتسوية الذكية الشاملة من رصيد محفظة العميل بنجاح.");
            generateDetailedStatement();
            calculateFinancialReport();
        });
    });
}

// ==========================================
// [8] نافذة التعديل المنبثقة (Modal Actions)
// ==========================================
function openEditModal(phone) {
    const user = loadedGlobalSettings[phone];
    if(!user) return;

    document.getElementById('edit-phone').value = phone;
    document.getElementById('edit-name').value = user.name || '';
    document.getElementById('edit-price').value = user.price || 0;
    document.getElementById('edit-plan').value = user.ratePlan || '';
    
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function saveClientEdits() {
    const phone = document.getElementById('edit-phone').value;
    const name = document.getElementById('edit-name').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value);
    const plan = document.getElementById('edit-plan').value.trim();

    if(!name || isNaN(price)) return alert("يرجى إدخال بيانات صحيحة للتعديل.");

    db.ref('settings/' + phone).update({
        name: name,
        price: price,
        ratePlan: plan
    }, () => {
        alert("تم تحديث وحفظ بيانات العميل بنجاح مالي تام.");
        closeEditModal();
        loadSettingsTable();
        calculateFinancialReport();
    });
}
