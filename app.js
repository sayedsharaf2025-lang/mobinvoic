// تكوين بيانات قاعدة بيانات Firebase الخاصة بك
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

// دالة لتصحيح أرقام الهواتف المجلوبة من إكسيل (إعادة الصفر المفقود في البداية)
function formatPhoneNumber(num) {
    if (!num) return '';
    let s = num.toString().trim();
    if (s.endsWith('.0')) s = s.substring(0, s.length - 2);
    if (s.length === 10 && (s.startsWith('1') || s.startsWith('2') || s.startsWith('5'))) {
        s = '0' + s;
    }
    return s;
}

document.addEventListener("DOMContentLoaded", function() {
    // محرك التنقل بين الشاشات الخمس بمرونة (SPA)
    const links = document.querySelectorAll('.sidebar .nav-links li');
    links.forEach(link => {
        link.addEventListener('click', function() {
            links.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            const target = this.getAttribute('data-target');
            document.querySelectorAll('.app-screen').forEach(screen => {
                screen.classList.remove('active-screen');
            });
            document.getElementById(target).classList.add('active-screen');
            
            if (target === 'settings-screen') loadSettingsTable();
            updateInvoiceMonthsDropdowns();
        });
    });

    syncGlobalSettings();
    updateInvoiceMonthsDropdowns();
});

// مزامنة حية ومستمرة لبيانات الأفراد المسجلين مع تحديث التقرير تلقائياً عند أي تعديل
function syncGlobalSettings() {
    db.ref('settings').on('value', snapshot => {
        loadedGlobalSettings = snapshot.val() || {};
        calculateFinancialReport(); // تحديث تقرير الأرباح تلقائياً فور تعديل أي باقة
    });
}

// ==========================================
// [1] شاشة الإعدادات واستيراد الأفراد والباقات
// ==========================================
function handleSettingsImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
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
    alert(`تم بنجاح استيراد وتحديث دليل عدد (${importedCount}) فرد من ملف الاكسيل.`);
    loadSettingsTable();
}

function loadSettingsTable() {
    db.ref('settings').once('value', snapshot => {
        const data = snapshot.val() || {};
        const tbody = document.getElementById('settings-table-body');
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
                    <button class="btn btn-outline" style="padding:5px 10px; color:blue;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                    <button class="btn btn-outline" style="padding:5px 10px; color:red;" onclick="deleteUser('${phone}')"><i class="fa-solid fa-trash"></i> حذف</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function filterSettingsTable() {
    const filter = document.getElementById('settings-table-search').value.toLowerCase();
    const rows = document.querySelectorAll('#settings-main-table tbody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(filter) ? '' : 'none';
    });
}

function addNewUserFromSettings() {
    const name = document.getElementById('new-user-name').value.trim();
    const phone = formatPhoneNumber(document.getElementById('new-user-phone').value.trim());
    const price = parseFloat(document.getElementById('new-user-price').value) || 0;
    const plan = document.getElementById('new-user-plan').value.trim();

    if (!name || !phone) return alert("الرجاء تعبئة الاسم ورقم الهاتف على الأقل!");

    db.ref('settings/' + phone).set({ name, price, ratePlan: plan }, () => {
        alert("تم الحفظ بنجاح.");
        loadSettingsTable();
    });
}

function deleteUser(phone) {
    if (confirm(`هل ترغب بحذف الرقم (${phone}) نهائياً من النظام؟`)) {
        db.ref('settings/' + phone).remove(() => {
            loadSettingsTable();
            if(document.getElementById('global-search-input').value) executeGlobalSearch();
            calculateFinancialReport();
        });
    }
}

// ==========================================
// [2] شاشة استيراد ومعالجة الفواتير (إصلاح مشكلة التداخل)
// ==========================================
function handleInvoiceImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentParsedInvoice = [];
    document.querySelector('#invoice-preview-table tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> جاري معالجة وفحص أرقام الملف...</td></tr>';

    const reader = new FileReader();
    reader.onload = function(evt) {
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
    const tbody = document.querySelector('#invoice-preview-table tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        let rawPhone = row['Mobile Number'] || '';
        let ratePlan = row['Rate Plan'] || '';
        let totalTaxes = row['Total After Taxes'] || 0;

        let phone = formatPhoneNumber(rawPhone);

        if (phone) {
            const matchedUser = loadedGlobalSettings[phone];
            let statusBadge = '';

            if (matchedUser) {
                statusBadge = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> مسجل باسم: ${matchedUser.name}</span>`;
            } else {
                statusBadge = `<span class="badge badge-orange"><i class="fa-solid fa-circle-exclamation"></i> رقم جديد (سينزل بدون اسم للتعديل لاحقاً)</span>`;
            }

            currentParsedInvoice.push({
                phone: phone,
                ratePlan: ratePlan,
                totalTaxes: parseFloat(totalTaxes) || 0
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${phone}</strong></td>
                <td>${ratePlan}</td>
                <td>${totalTaxes} ج.م</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    document.getElementById('invoice-preview-card').style.display = 'block';
}

function saveProcessedInvoice() {
    const month = document.getElementById('invoice-month-select').value;
    if (!month) return alert("برجاء تحديد الشهر المالي للفاتورة أولاً.");
    if (currentParsedInvoice.length === 0) return alert("لا توجد بيانات صالحة للحفظ.");

    currentParsedInvoice.forEach(item => {
        if (!loadedGlobalSettings[item.phone]) {
            db.ref('settings/' + item.phone).set({
                name: "بدون اسم",
                price: 0,
                ratePlan: item.ratePlan
            });
        }

        db.ref(`invoices/${month}/${item.phone}`).set({
            ratePlan: item.ratePlan,
            totalAfterTaxes: item.totalTaxes,
            paidAmount: 0,
            status: "غير مدفوع"
        });
    });

    alert(`تم بنجاح اعتماد وحفظ فاتورة شهر (${month}) بالكامل.`);
    
    currentParsedInvoice = [];
    document.getElementById('invoice-file-input').value = '';
    document.querySelector('#invoice-preview-table tbody').innerHTML = '';
    document.getElementById('invoice-preview-card').style.display = 'none';
    updateInvoiceMonthsDropdowns();
}

function updateInvoiceMonthsDropdowns() {
    db.ref('invoices').once('value', snapshot => {
        const months = snapshot.val() || {};
        const delSelect = document.getElementById('delete-invoice-month-select');
        const collSelect = document.getElementById('collection-month-select');
        const searchSelect = document.getElementById('search-month-select');
        
        if (delSelect) delSelect.innerHTML = '<option value="">-- اختر الشهر --</option>';
        if (collSelect) collSelect.innerHTML = '<option value="">-- اختر الشهر --</option>';
        if (searchSelect) searchSelect.innerHTML = '<option value="all">كل الأشهر المتاحة</option>';

        for (let m in months) {
            if (delSelect) delSelect.innerHTML += `<option value="${m}">${m}</option>`;
            if (collSelect) collSelect.innerHTML += `<option value="${m}">${m}</option>`;
            if (searchSelect) searchSelect.innerHTML += `<option value="${m}">${m}</option>`;
        }
        calculateFinancialReport();
    });
}

function deleteStoredInvoice() {
    const month = document.getElementById('delete-invoice-month-select').value;
    if (!month) return alert("برجاء تحديد الشهر المراد حذفه.");
    if (confirm(`هل أنت متأكد من رغبتك بحذف فاتورة شهر (${month}) نهائياً؟`)) {
        db.ref(`invoices/${month}`).remove(() => {
            alert("تم الحذف بنجاح.");
            updateInvoiceMonthsDropdowns();
            loadCollectionData();
        });
    }
}

// ==========================================
// [3] شاشة التحصيل المالي (تعديل: الدفع بالباقة + تنبيه العجز وقفل السطر)
// ==========================================
function loadCollectionData() {
    const month = document.getElementById('collection-month-select').value;
    const tbody = document.getElementById('collection-table-body');
    tbody.innerHTML = '';
    if (!month) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const invoices = snapshot.val() || {};
        let unpaidCount = 0;

        for (let phone in invoices) {
            const inv = invoices[phone];
            const user = loadedGlobalSettings[phone] || { name: "بدون اسم", price: 0 };
            
            const paid = inv.paidAmount || 0;
            const hasAlert = user.price < inv.totalAfterTaxes; // التنبيه: الباقة المعتمدة أقل من الفاتورة المرفوعة

            // تحديد المبلغ المطلوب بناءً على حال التنبيه لضمان عدم اختفاء السطر إلا بعد الإجراء
            let requiredAmount = hasAlert ? inv.totalAfterTaxes : user.price;
            let remaining = requiredAmount - paid;
            
            if (remaining <= 0) continue; // يختفي الخط تماماً عند اكتمال السداد المطلوب للشرطين

            unpaidCount++;
            
            let statusHtml = '';
            let rowStyle = '';
            
            if (hasAlert) {
                rowStyle = 'style="background-color: #fff4ee; border-right: 4px solid orange;"';
                statusHtml = `
                    <span class="badge badge-red">المستحق (الفاتورة): ${remaining.toFixed(2)} ج.م</span>
                    <div style="color: #d97706; font-size:11px; font-weight:bold; margin-top:4px; line-height:1.3;">
                        ⚠️ تنبيه: الباقة المعتمدة (${user.price}) أقل من الفاتورة (${inv.totalAfterTaxes})! قم بتعديل الباقة أو سدد يدويًا كامل قيمة الفاتورة.
                    </div>`;
            } else {
                statusHtml = `<span class="badge badge-red">متبقي من الباقة: ${remaining.toFixed(2)} ج.م</span>`;
            }
            
            let cancelBtn = '';
            if (paid > 0) {
                cancelBtn = `<button class="btn btn-outline" style="padding:4px 8px; color:orange; margin-right:4px;" onclick="cancelPayment('${month}', '${phone}')"><i class="fa-solid fa-rotate-left"></i> إلغاء</button>`;
            }

            const tr = document.createElement('tr');
            if (rowStyle) tr.setAttribute('style', 'background-color: #fff3cd;');
            
            tr.innerHTML = `
                <td>${phone}</td>
                <td><strong>${user.name}</strong></td>
                <td><strong class="text-green">${user.price} ج.م</strong></td>
                <td>${inv.totalAfterTaxes} ج.م</td>
                <td>${paid} ج.م</td>
                <td>${statusHtml}</td>
                <td>
                    <input type="number" id="pay-amt-${phone}" value="${remaining.toFixed(2)}" class="form-control" style="width:75px; display:inline-block; padding:4px;">
                    <button class="btn btn-green" style="padding:5px 10px;" onclick="collectPayment('${month}', '${phone}', ${requiredAmount}, ${paid})">تسجيل</button>
                    <button class="btn btn-outline" style="padding:5px 10px; color:blue;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan || ''}')"><i class="fa-solid fa-pen"></i> تعديل الباقة</button>
                    ${cancelBtn}
                </td>
            `;
            tbody.appendChild(tr);
        }
        
        if (unpaidCount === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--green-success); font-weight:bold; padding:35px; font-size:16px;"><i class="fa-solid fa-square-check"></i> ممتاز! جميع الأرقام قامت بالدفع بالكامل لهذا الشهر! لا توجد مستحقات معلقة.</td></tr>`;
        }
    });
}

function collectPayment(month, phone, requiredTotal, alreadyPaid) {
    const amt = parseFloat(document.getElementById(`pay-amt-${phone}`).value);
    if (isNaN(amt) || amt <= 0) return alert("برجاء إدخال قيمة صحيحة.");

    const newPaid = alreadyPaid + amt;
    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: newPaid >= requiredTotal ? "مدفوع بالكامل" : "مدفوع جزئياً"
    }, () => {
        alert("تم تسجيل دفعة التحصيل بنجاح!");
        loadCollectionData();
        if (document.getElementById('global-search-input').value) executeGlobalSearch();
        calculateFinancialReport();
    });
}

function payAllActiveInvoices() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return alert("اختر الشهر أولاً.");
    if (confirm("هل تريد تسوية وحفظ جميع الأرقام المتبقية لشهر كمدفوعة بالكامل طبقاً للمستحق الفعلي؟")) {
        db.ref(`invoices/${month}`).once('value', snapshot => {
            const data = snapshot.val() || {};
            let updates = {};
            for (let phone in data) {
                const inv = data[phone];
                const user = loadedGlobalSettings[phone] || { price: 0 };
                // السداد الإجمالي يسدد القيمة المطلوبة أيهما أكبر لحل التنبيهات تلقائياً
                const required = user.price < inv.totalAfterTaxes ? inv.totalAfterTaxes : user.price;
                
                updates[`invoices/${month}/${phone}/paidAmount`] = required;
                updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
            }
            db.ref().update(updates, () => {
                alert("تم تحويل كافة الحسابات إلى مدفوعة بالكامل.");
                loadCollectionData();
                calculateFinancialReport();
            });
        });
    }
}

// ==========================================
// [4] شاشة الدفع المقدم والتحكم في الرصيد
// ==========================================
function searchForAdvance() {
    const filter = document.getElementById('advance-search-input').value.trim();
    if (!filter) return alert("يرجى كتابة رقم الهاتف للاستعلام.");

    let targetPhone = null;
    let targetName = "بدون اسم";

    for (let phone in loadedGlobalSettings) {
        if (phone === filter || loadedGlobalSettings[phone].name.includes(filter)) {
            targetPhone = phone;
            targetName = loadedGlobalSettings[phone].name;
            break;
        }
    }

    if (!targetPhone) return alert("لم يتم العثور على الرقم بقاعدة البيانات!");

    document.getElementById('advance-user-name').innerText = targetName;
    document.getElementById('advance-user-phone').innerText = "رقم الحساب: " + targetPhone;

    db.ref('advancePayments/' + targetPhone).once('value', snapshot => {
        const bal = snapshot.val() || 0;
        document.getElementById('current-advance-balance').innerText = bal.toFixed(2) + " ج.م";
        document.getElementById('advance-profile-card').setAttribute('data-current-phone', targetPhone);
        document.getElementById('advance-profile-card').style.display = 'block';
    });
}

function saveAdvancePayment() {
    const phone = document.getElementById('advance-profile-card').getAttribute('data-current-phone');
    const amount = parseFloat(document.getElementById('new-advance-amount').value);

    if (!phone || isNaN(amount) || amount <= 0) return alert("برجاء إدخال قيمة صحيحة.");

    db.ref('advancePayments/' + phone).once('value', snapshot => {
        const cur = snapshot.val() || 0;
        db.ref('advancePayments/' + phone).set(cur + amount, () => {
            alert("تم حفظ وإيداع الرصيد المقدم للحساب!");
            document.getElementById('new-advance-amount').value = '';
            searchForAdvance();
        });
    });
}

// ==========================================
// [5] شاشة البحث الشامل وحساب الأرباح التلقائي واليدوي
// ==========================================
function calculateFinancialReport() {
    const selectedMonth = document.getElementById('search-month-select').value;
    const reportResults = document.getElementById('financial-report-results');
    if (!reportResults) return;

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        
        let totalExcelInvoices = 0;
        let totalApprovedPackages = 0;

        // تجميع الحسابات بناءً على الشهر المختار أو جميع الأشهر المتاحة
        for (let m in allInvoices) {
            if (selectedMonth !== 'all' && m !== selectedMonth) continue;
            
            const monthData = allInvoices[m];
            for (let phone in monthData) {
                const inv = monthData[phone];
                const user = loadedGlobalSettings[phone] || { price: 0 };
                
                totalExcelInvoices += parseFloat(inv.totalAfterTaxes) || 0;
                totalApprovedPackages += parseFloat(user.price) || 0;
            }
        }

        // جلب قيم الخانات اليدوية والمصاريف المضافة حديثاً
        const manualInvoiceInput = parseFloat(document.getElementById('manual-invoice-input').value) || 0;
        const additionalRevenue = parseFloat(document.getElementById('additional-revenue-input').value) || 0;
        const additionalExpenses = parseFloat(document.getElementById('additional-expenses-input').value) || 0;

        // الحساب النهائي الشامل
        const finalTotalPackages = totalApprovedPackages + additionalRevenue;
        const finalTotalInvoice = totalExcelInvoices + additionalExpenses;
        const netProfit = finalTotalPackages - finalTotalInvoice;

        // منطق المقارنة الذكي مع الفاتورة اليدوية المدخلة
        let comparisonBadge = '';
        if (manualInvoiceInput > 0) {
            const difference = manualInvoiceInput - totalExcelInvoices;
            if (Math.abs(difference) < 0.1) {
                comparisonBadge = `<div style="background:#d1e7dd; color:#0f5132; padding:4px; font-size:11px; font-weight:bold; border-radius:4px; margin-top:5px; text-align:center;"><i class="fa-solid fa-square-check"></i> متطابق مع الفاتورة اليدوية</div>`;
            } else if (difference > 0) {
                comparisonBadge = `<div style="background:#f8d7da; color:#842029; padding:4px; font-size:11px; font-weight:bold; border-radius:4px; margin-top:5px; text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> عجز باليدوية أكبر بـ ${difference.toFixed(2)} ج.م</div>`;
            } else {
                comparisonBadge = `<div style="background:#fff3cd; color:#664d03; padding:4px; font-size:11px; font-weight:bold; border-radius:4px; margin-top:5px; text-align:center;"><i class="fa-solid fa-info-circle"></i> وفر باليدوية أقل بـ ${Math.abs(difference).toFixed(2)} ج.م</div>`;
            }
        }

        // حقن الكروت المالية الحية في واجهة المستخدم بأسلوب عصري
        reportResults.innerHTML = `
            <div style="background: #ffffff; padding: 15px; border-radius: 8px; border-right: 5px solid #2563eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <span style="font-size: 11px; color: #666; display: block; font-weight: bold;">إجمالي الباقات (+ الإيرادات الإضافية)</span>
                <strong style="font-size: 18px; color: #2563eb; display:block; margin-top:5px;">${finalTotalPackages.toFixed(2)} ج.م</strong>
                <small style="font-size: 10px; color:#888;">الأساسي من الدليل: ${totalApprovedPackages.toFixed(2)}</small>
            </div>
            <div style="background: #ffffff; padding: 15px; border-radius: 8px; border-right: 5px solid #dc2626; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <span style="font-size: 11px; color: #666; display: block; font-weight: bold;">إجمالي الفاتورة المرفوعة (+ المصاريف)</span>
                <strong style="font-size: 18px; color: #dc2626; display:block; margin-top:5px;">${finalTotalInvoice.toFixed(2)} ج.م</strong>
                <small style="font-size: 10px; color:#888;">من ملف إكسيل: ${totalExcelInvoices.toFixed(2)}</small>
                ${comparisonBadge}
            </div>
            <div style="background: ${netProfit >= 0 ? '#f0fdf4' : '#fef2f2'}; padding: 15px; border-radius: 8px; border-right: 5px solid ${netProfit >= 0 ? '#16a34a' : '#dc2626'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <span style="font-size: 11px; color: #666; display: block; font-weight: bold;">صافي الأرباح المتوقعة لشهر الحساب</span>
                <strong style="font-size: 21px; color: ${netProfit >= 0 ? '#16a34a' : '#dc2626'}; display:block; margin-top:3px;">${netProfit.toFixed(2)} ج.م</strong>
                <span style="font-size: 10px; font-weight:bold; color: ${netProfit >= 0 ? '#16a34a' : '#dc2626'};">${netProfit >= 0 ? '📈 صافي ربح إيجابي' : '📉 عجز / خسارة مالية'}</span>
            </div>
        `;
    });
}

function executeGlobalSearch() {
    const filter = document.getElementById('global-search-input').value.trim().toLowerCase();
    const selectedMonth = document.getElementById('search-month-select').value;
    const resultsArea = document.getElementById('search-results-area');
    const summaryArea = document.getElementById('search-summary-area');
    
    resultsArea.innerHTML = '';
    summaryArea.innerHTML = '';
    summaryArea.style.display = 'none';

    if (!filter) return alert("برجاء إدخال كلمة البحث أولاً.");
    
    let matchedCount = 0;
    let totalPackagesSum = 0;

    for (let phone in loadedGlobalSettings) {
        const user = loadedGlobalSettings[phone];
        const isMatch = phone.includes(filter) || user.name.toLowerCase().includes(filter);
        
        if (isMatch) {
            matchedCount++;
            totalPackagesSum += parseFloat(user.price) || 0;

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                    <h3><i class="fa-solid fa-id-card text-red"></i> الاسم الحالي: ${user.name}</h3>
                    <div>
                        <button class="btn btn-outline" style="color:blue; padding:5px 10px; margin-left:5px;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan}')"><i class="fa-solid fa-pen"></i> تعديل البيانات</button>
                        <button class="btn btn-outline" style="color:red; padding:5px 10px;" onclick="deleteUser('${phone}')"><i class="fa-solid fa-trash"></i> حذف</button>
                    </div>
                </div>
                <p><strong>رقم الموبايل:</strong> ${phone} | <strong>خطة الاشتراك:</strong> ${user.ratePlan || 'غير حددة'} | <strong>سعر الباقة الأساسي:</strong> ${user.price} ج.م</p>
                <div id="history-box-${phone}" style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                     <span style="font-size:12px; color:#999;"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل السجل المالي...</span>
                </div>
            `;
            resultsArea.appendChild(card);
            fetchUserFinancialHistory(phone, selectedMonth);
        }
    }

    if (matchedCount > 0) {
        summaryArea.innerHTML = `
            <div class="card" style="background-color: #E2F6EE; border-color: var(--green-success); padding: 15px; display: flex; align-items: center; gap: 15px;">
                <i class="fa-solid fa-calculator text-green" style="font-size: 24px;"></i>
                <div>
                    <span style="font-size: 13px; color: #555; display: block;">إجمالي سعر الباقة المعتمد للأرقام الناتجة عن البحث الحالية (${matchedCount} خطوط):</span>
                    <strong style="font-size: 18px; color: var(--green-success);">${totalPackagesSum.toFixed(2)} ج.م</strong>
                </div>
            </div>`;
        summaryArea.style.display = 'block';
    } else {
        resultsArea.innerHTML = `<div class="card" style="text-align:center; color:red; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> لا توجد أي نتائج مطابقة للبحث.</div>`;
    }
}

function fetchUserFinancialHistory(phone, selectedMonth) {
    db.ref('invoices').once('value', snapshot => {
        const months = snapshot.val() || {};
        const targetDiv = document.getElementById(`history-box-${phone}`);
        if (!targetDiv) return;
        
        let rows = '';
        for (let m in months) {
            if (selectedMonth !== 'all' && m !== selectedMonth) continue;

            if (months[m][phone]) {
                const inv = months[m][phone];
                const user = loadedGlobalSettings[phone] || { price: 0 };
                const remaining = user.price < inv.totalAfterTaxes ? (inv.totalAfterTaxes - (inv.paidAmount || 0)) : (user.price - (inv.paidAmount || 0));
                
                let statusBadge = '';
                let cancelBtnHtml = '';

                if (remaining <= 0) {
                    statusBadge = '<span class="badge badge-green">مدفوع بالكامل</span>';
                } else if ((inv.paidAmount || 0) > 0) {
                    statusBadge = `<span class="badge badge-orange">مدفوع جزئياً (متبقي: ${remaining.toFixed(2)})</span>`;
                } else {
                    statusBadge = '<span class="badge badge-red">غير مدفوع</span>';
                }

                if ((inv.paidAmount || 0) > 0) {
                    cancelBtnHtml = `<button class="btn btn-outline" style="padding:2px 8px; font-size:11px; color:var(--primary-color); border-color:var(--primary-color);" onclick="cancelPayment('${m}', '${phone}')"><i class="fa-solid fa-rotate-left"></i> إلغاء السداد</button>`;
                } else {
                    cancelBtnHtml = `<span style="color:#aaa; font-size:11px;">لم يسدد بعد</span>`;
                }

                rows += `
                    <tr>
                        <td>${m}</td>
                        <td>${inv.totalAfterTaxes} ج.م</td>
                        <td>${inv.paidAmount || 0} ج.م</td>
                        <td>${statusBadge}</td>
                        <td style="text-align: center;">${cancelBtnHtml}</td>
                    </tr>`;
            }
        }
        
        if (rows === '') {
            targetDiv.innerHTML = `<p style="font-size:12px; color:orange;"><i class="fa-solid fa-triangle-exclamation"></i> لا توجد فواتير مسجلة لهذا الرقم في النطاق المفلتر.</p>`;
        } else {
            targetDiv.innerHTML = `
                <h4 style="font-size:13px; margin-bottom:5px; color:#555;">سجل مطالبات الحساب التفصيلي:</h4>
                <table style="width:100%; font-size:12px;">
                    <thead>
                        <tr>
                            <th>الشهر المالي</th>
                            <th>قيمة الفاتورة بالضريبة</th>
                            <th>المبلغ المدفوع</th>
                            <th>الحالة</th>
                            <th style="text-align: center;">إجراءات إلغاء السداد</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }
    });
}

function cancelPayment(month, phone) {
    if (confirm(`هل أنت متأكد من إلغاء سداد فاتورة الرقم (${phone}) لشهر (${month})؟ سيتم تصفير المبلغ المدفوع وإعادة الحساب لوضع الاستحقاق المعلق.`)) {
        db.ref(`invoices/${month}/${phone}`).update({
            paidAmount: 0,
            status: "غير مدفوع"
        }, () => {
            alert("تم إلغاء السداد بنجاح وتصفير المبالغ للحساب.");
            if (document.getElementById('global-search-input').value) executeGlobalSearch();
            loadCollectionData();
            calculateFinancialReport();
        });
    }
}

// التحكم بنوافذ التعديل العائمة
function openEditModal(phone, name, price, plan) {
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-phone').value = phone;
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-plan').value = plan;
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function saveClientEdits() {
    const phone = document.getElementById('edit-phone').value;
    const name = document.getElementById('edit-name').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value) || 0;
    const plan = document.getElementById('edit-plan').value.trim();

    db.ref('settings/' + phone).update({ name, price, ratePlan: plan }, () => {
        alert("تم تعديل وحفظ بيانات العميل وتحديث الأرباح فورياً!");
        closeEditModal();
        loadSettingsTable();
        loadCollectionData(); // إعادة تحميل التحصيل لتحديث حالة التنبيه إذا تم حلها
        if(document.getElementById('global-search-input').value) executeGlobalSearch();
        calculateFinancialReport();
    });
}
