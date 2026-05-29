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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentParsedInvoice = [];
let loadedGlobalSettings = {};
let loadedAdvancePayments = {};
let currentStatementPhone = "";

// دالة تنسيق وتنظيف رقم الهاتف (إعادة الصفر المفقود في البداية)
function formatPhoneNumber(num) {
    if (!num) return '';
    let s = num.toString().trim();
    if (s.endsWith('.0')) s = s.substring(0, s.length - 2);
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
            document.querySelectorAll('.app-screen').forEach(screen => screen.classList.remove('active-screen'));

            const currentScreen = document.getElementById(target);
            if (currentScreen) currentScreen.classList.add('active-screen');

            if (target === 'settings-screen') loadSettingsTable();
            if (target === 'collection-screen') loadCollectionData();
            updateInvoiceMonthsDropdowns();
        });
    });

    const searchSelect = document.getElementById('search-month-select');
    if (searchSelect) {
        searchSelect.addEventListener('change', loadExtraFinancialsForSelectedMonth);
    }

    const collSelect = document.getElementById('collection-month-select');
    if (collSelect) {
        collSelect.addEventListener('change', loadCollectionData);
    }

    syncGlobalSettings();
    syncAdvancePayments();
    updateInvoiceMonthsDropdowns();
});

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

        if (typeof loadExtraFinancialsForSelectedMonth === 'function') {
            loadExtraFinancialsForSelectedMonth();
        }
    });
}

// ==========================================
// [2] توليد الكشوفات الشهرية التلقائية بناءً على باقات الأفراد المعتمدة
// ==========================================
function generateMonthlyInvoicesFromSettings() {
    const month = document.getElementById('invoice-month-select').value;
    if (!month) return alert("خطأ: يرجى تحديد الشهر المالي أولاً لتوليد كشوفاته التلقائية.");

    const phones = Object.keys(loadedGlobalSettings);
    if (phones.length === 0) return alert("دليل الأفراد فارغ! يرجى إضافة مشتركين أولاً من شاشة الإعدادات.");

    if (!confirm(`هل تريد توليد مطالبات شهر ${month} تلقائياً لعدد (${phones.length}) مشترك مسجل بناءً على باقاتهم؟`)) return;

    let updates = {};
    phones.forEach(phone => {
        const user = loadedGlobalSettings[phone];
        updates[`invoices/${month}/${phone}`] = {
            ratePlan: user.ratePlan || 'غير محدد',
            packagePrice: parseFloat(user.price) || 0,
            totalAfterTaxes: 0,
            paidAmount: 0,
            status: "غير مدفوع"
        };
    });

    db.ref().update(updates, () => {
        alert(`تم توليد كشوفات شهر ${month} تلقائياً بنجاح تام وتصفير التحصيلات.`);
        updateInvoiceMonthsDropdowns();
        loadCollectionData();
    });
}

// ==========================================
// [3] شاشة استيراد ملف فودافون (تحديث خانة التكلفة الفعلية)
// ==========================================
function handleInvoiceImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    currentParsedInvoice = [];
    const tbody = document.querySelector('#invoice-preview-table tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> جاري معالجة وفحص أرقام الملف...</td></tr>';
    }

    const reader = new FileReader();
    reader.onload = function (evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        processInvoiceExcel(XLSX.utils.sheet_to_json(worksheet));
    };
    reader.readAsArrayBuffer(file);
}

function processInvoiceExcel(data) {
    currentParsedInvoice = [];
    const previewCard = document.getElementById('invoice-preview-card');
    const tbody = document.querySelector('#invoice-preview-table tbody');
    tbody.innerHTML = '';

    data.forEach(row => {
        let phone = formatPhoneNumber(row['Mobile Number'] || row['رقم الهاتف'] || '');
        let ratePlan = row['Rate Plan'] || row['نظام الحساب'] || '';
        let totalTaxes = row['Total After Taxes'] || row['الاجمالي بعد الضريبة'] || 0;

        if (phone) {
            currentParsedInvoice.push({ phone, ratePlan, totalTaxes: parseFloat(totalTaxes) || 0 });
            const userExists = loadedGlobalSettings[phone];

            let statusBadge = '';
            if (userExists) {
                statusBadge = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> مسجل باسم: ${userExists.name}</span>`;
            } else {
                statusBadge = `<span class="badge badge-orange"><i class="fa-solid fa-circle-exclamation"></i> رقم جديد (سينزل بدون اسم لتسعيره لاحقاً)</span>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${phone}</strong></td>
                <td>${ratePlan}</td>
                <td>${parseFloat(totalTaxes).toFixed(2)} ج.م</td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(tr);
        }
    });

    if (currentParsedInvoice.length > 0) {
        previewCard.style.display = 'block';
        alert(`تم تحليل الملف وعرض (${currentParsedInvoice.length}) سجل. اضغط على اعتماد لتحديث خانة التكلفة الفعلية.`);
    }
}

function saveProcessedInvoice() {
    const month = document.getElementById('invoice-month-select').value;
    if (!month) return alert("يرجى تحديد الشهر المستهدف أولاً.");
    if (currentParsedInvoice.length === 0) return alert("لا توجد بيانات مستوردة.");

    db.ref(`invoices/${month}`).once('value', snapshot => {
        let existingInvoices = snapshot.val() || {};
        let updates = {};

        currentParsedInvoice.forEach(item => {
            // إضافة مشترك جديد لدليل الأفراد إن لم يكن موجوداً
            if (!loadedGlobalSettings[item.phone]) {
                db.ref('settings/' + item.phone).set({
                    name: "بدون اسم",
                    price: 0,
                    ratePlan: item.ratePlan
                });
            }

            const user = loadedGlobalSettings[item.phone] || { price: 0 };
            const requiredAmount = parseFloat(user.price) || 0;
            let advanceBalance = loadedAdvancePayments[item.phone] || 0;

            let paid = 0;
            let newStatus = "غير مدفوع";

            // تطبيق الدفع المقدم تلقائياً إن وُجد
            if (advanceBalance > 0 && requiredAmount > 0) {
                if (advanceBalance >= requiredAmount) {
                    paid = requiredAmount;
                    advanceBalance -= requiredAmount;
                    newStatus = "مدفوع بالكامل";
                } else {
                    paid = advanceBalance;
                    advanceBalance = 0;
                    newStatus = "مدفوع جزئياً";
                }
                db.ref('advancePayments/' + item.phone).set(advanceBalance);
                loadedAdvancePayments[item.phone] = advanceBalance;
            }

            if (existingInvoices[item.phone]) {
                // تحديث بيانات مشترك موجود مسبقاً في الشهر
                updates[`invoices/${month}/${item.phone}/totalAfterTaxes`] = item.totalTaxes;
                updates[`invoices/${month}/${item.phone}/ratePlan`] = item.ratePlan;
            } else {
                // إضافة مشترك جديد في الشهر
                updates[`invoices/${month}/${item.phone}`] = {
                    ratePlan: item.ratePlan,
                    totalAfterTaxes: item.totalTaxes,
                    packagePrice: requiredAmount,
                    paidAmount: paid,
                    status: newStatus
                };
            }
        });

        db.ref().update(updates, () => {
            alert(`تم بنجاح اعتماد وحفظ فاتورة شهر (${month}) وتأمين أسعار الباقات التاريخية.`);
            currentParsedInvoice = [];
            const fileInput = document.getElementById('invoice-file-input');
            if (fileInput) fileInput.value = '';
            document.querySelector('#invoice-preview-table tbody').innerHTML = '';
            document.getElementById('invoice-preview-card').style.display = 'none';
            updateInvoiceMonthsDropdowns();
            calculateFinancialReport();
        });
    });
}

function deleteStoredInvoice() {
    const month = document.getElementById('delete-invoice-month-select').value;
    if (!month) return alert("يرجى اختيار شهر صالح.");
    if (!confirm(`هل أنت متأكد من مسح سجلات شهر ${month} نهائياً؟`)) return;
    db.ref(`invoices/${month}`).remove(() => {
        alert("تم حذف الشهر المالي بنجاح.");
        updateInvoiceMonthsDropdowns();
        calculateFinancialReport();
        loadCollectionData();
    });
}

// ==========================================
// [4] شاشة التحصيل ومراجعة فوارق الـ 9 جنيهات
// ==========================================

// بحث سريع داخل جدول التحصيل (يشمل المسددين لإمكانية الإلغاء)
function filterCollectionTable() {
    const searchInput = document.getElementById('collection-search-input');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const rows = document.querySelectorAll('#collection-table-body tr');
    rows.forEach(row => {
        if (!query) {
            // بدون بحث: إخفاء الصفوف المسددة الآمنة (السلوك الافتراضي)
            row.style.display = row.dataset.fullyPaid === '1' ? 'none' : '';
        } else {
            // مع البحث: عرض كل الصفوف المطابقة بما فيها المسددة
            row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
        }
    });
}

function loadCollectionData() {
    const month = document.getElementById('collection-month-select').value;
    const tbody = document.getElementById('collection-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!month) return;

    // مسح حقل البحث عند تغيير الشهر
    const searchInput = document.getElementById('collection-search-input');
    if (searchInput) searchInput.value = '';

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const invoices = snapshot.val() || {};
        let activeRowsCount = 0;
        let fullyPaidCount = 0;

        for (let phone in invoices) {
            const inv = invoices[phone];
            const user = loadedGlobalSettings[phone] || { name: "بدون اسم", price: 0 };

            const paid = parseFloat(inv.paidAmount) || 0;
            const packageAmt = inv.packagePrice !== undefined ? parseFloat(inv.packagePrice) : parseFloat(user.price) || 0;
            const remaining = packageAmt - paid;

            const invoiceAmt = parseFloat(inv.totalAfterTaxes) || 0;
            const diffAmt = packageAmt - invoiceAmt;

            const isTargetForReview = (invoiceAmt >= packageAmt || (diffAmt >= 8.4 && diffAmt <= 9.6));
            const isFullyPaidSafe = (packageAmt > 0 && remaining <= 0 && !isTargetForReview);

            // المسددون الآمنون يُضافون للجدول لكن مخفيون (يظهرون عند البحث فقط)
            if (isFullyPaidSafe) fullyPaidCount++;
            else activeRowsCount++;

            let rowBgColor = '';
            let comparisonHtml = '';

            if (packageAmt === 0) {
                rowBgColor = 'background-color: #f3f4f6; border-right: 4px solid #6b7280;';
                comparisonHtml = `<div style="color: #6b7280; font-size:11px; font-weight:bold;"><i class="fa-solid fa-circle-question"></i> خط غير مسعر (باقته 0 ج.م)</div>`;
            } else if (isTargetForReview) {
                rowBgColor = 'background-color: #fef2f2; border-right: 4px solid #dc2626;';
                if (invoiceAmt >= packageAmt) {
                    comparisonHtml = `<div style="color: #dc2626; font-size:11px; font-weight:bold; margin-top:3px;"><i class="fa-solid fa-triangle-exclamation"></i> تنبيه: الفاتورة أعلى أو تساوي الباقة (تعديل السعر مطلوب) ⚠️</div>`;
                } else {
                    comparisonHtml = `<div style="color: #b91c1c; font-size:11px; font-weight:bold; margin-top:3px;"><i class="fa-solid fa-circle-exclamation"></i> مراجعة: الفارق 9 جنيه تقريباً (تثبيت أو تعديل الباقة) ⚠️</div>`;
                }
            } else if (diffAmt > 0) {
                rowBgColor = 'background-color: #f0fdf4; border-right: 4px solid #16a34a;';
                comparisonHtml = `<div style="color: #16a34a; font-size:11px; font-weight:bold; margin-top:3px;"><i class="fa-solid fa-circle-check"></i> الباقة رابحة أعلى من الفاتورة بـ (${diffAmt.toFixed(2)} ج.م) ✨</div>`;
            }

            let statusHtml = '';
            if (remaining > 0) {
                statusHtml = `<span class="badge badge-red" style="font-weight:bold;"><i class="fa-solid fa-hand-holding-dollar"></i> مدين مديونية: ${remaining.toFixed(2)} ج.م</span>`;
            } else {
                statusHtml = `<span class="badge badge-green"><i class="fa-solid fa-square-check"></i> مسدد للباقة بالكامل</span>`;
            }
            statusHtml += comparisonHtml;

            let cancelBtn = '';
            if (paid > 0) {
                cancelBtn = `<button class="btn btn-outline" style="padding:4px 8px; color:orange; margin-right:4px;" onclick="cancelPayment('${month}', '${phone}')"><i class="fa-solid fa-rotate-left"></i> إلغاء</button>`;
            }

            const tr = document.createElement('tr');
            // حفظ حالة الصف كـ data attribute لاستخدامه في البحث والفلترة
            tr.dataset.fullyPaid = isFullyPaidSafe ? '1' : '0';
            // الصفوف المسددة الآمنة تُخفى افتراضياً وتظهر عند البحث
            if (isFullyPaidSafe) tr.style.display = 'none';
            if (rowBgColor) tr.style.cssText += rowBgColor;

            tr.innerHTML = `
                <td>${phone}</td>
                <td><strong>${user.name}</strong></td>
                <td><strong class="text-blue">${packageAmt.toFixed(2)} ج.م</strong></td>
                <td>${invoiceAmt.toFixed(2)} ج.م</td>
                <td>${paid.toFixed(2)} ج.م</td>
                <td>${statusHtml}</td>
                <td>
                    <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                        <input type="number" id="pay-amt-${phone}" value="${remaining > 0 ? remaining.toFixed(2) : 0}" class="form-control" style="width:80px; padding:5px; margin:0;">
                        <button class="btn btn-green" style="padding:5px 10px;" onclick="collectCustomPayment('${month}', '${phone}', ${packageAmt}, ${paid})">تسجيل</button>
                        <button class="btn btn-outline" style="padding:5px 10px; color:blue;" onclick="openEditModal('${phone}', '${user.name}', ${packageAmt}, '${user.ratePlan || ''}', '${month}')"><i class="fa-solid fa-pen"></i> تعديل</button>
                        ${cancelBtn}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        }

        if (activeRowsCount === 0 && fullyPaidCount > 0) {
            const infoRow = document.createElement('tr');
            infoRow.innerHTML = `<td colspan="7" style="text-align:center; color:var(--green-success); font-weight:bold; padding:25px; font-size:16px;">
                <i class="fa-solid fa-square-check"></i> ممتاز! تمت تسوية كل الحسابات لهذا الشهر!
                <div style="font-size:13px; font-weight:normal; color:#6b7280; margin-top:6px;">
                    ابحث باسم أو رقم لعرض سجل المسدد وإلغاء سداده إن لزم
                </div>
            </td>`;
            tbody.appendChild(infoRow);
        } else if (activeRowsCount === 0 && fullyPaidCount === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#6b7280; padding:35px;">لا توجد بيانات لهذا الشهر.</td></tr>`;
        }
    });
}

function collectCustomPayment(month, phone, requiredTotal, alreadyPaid) {
    const amt = parseFloat(document.getElementById(`pay-amt-${phone}`).value);
    if (isNaN(amt) || amt <= 0) return alert("يرجى إدخال مبلغ تحصيل صحيح أكبر من الصفر.");

    const newPaid = alreadyPaid + amt;
    const newStatus = newPaid >= requiredTotal ? "مدفوع بالكامل" : "مدفوع جزئياً";

    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: newStatus
    }, () => {
        alert(`تم تسجيل السداد بنجاح! [المبلغ الحالي المحصل: ${newPaid.toFixed(2)} من أصل ${requiredTotal.toFixed(2)}]`);
        loadCollectionData();
        if (document.getElementById('global-search-input') && document.getElementById('global-search-input').value) {
            executeGlobalSearch();
        }
        calculateFinancialReport();
    });
}

function cancelPayment(month, phone) {
    db.ref(`invoices/${month}/${phone}`).once('value', snapshot => {
        const inv = snapshot.val();
        if (!inv) return alert("لم يتم العثور على بيانات هذا السجل.");

        const currentPaid = parseFloat(inv.paidAmount) || 0;
        const packageAmt  = parseFloat(inv.packagePrice) || 0;
        const user        = loadedGlobalSettings[phone] || { name: phone };

        if (currentPaid <= 0) return alert("لا يوجد مبلغ مسدد لإلغائه.");

        // بناء نافذة الإلغاء الذكية
        const modalId = 'cancel-payment-modal';
        let existing = document.getElementById(modalId);
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,0.55);
            display:flex; align-items:center; justify-content:center; z-index:9999;
        `;
        modal.innerHTML = `
            <div style="background:#fff; border-radius:12px; padding:28px 24px; width:360px; max-width:95vw; box-shadow:0 8px 32px rgba(0,0,0,0.18); direction:rtl;">
                <h3 style="margin:0 0 6px; font-size:17px; color:#dc2626;">
                    <i class="fa-solid fa-rotate-left"></i> إلغاء سداد
                </h3>
                <p style="font-size:13px; color:#555; margin:0 0 18px;">
                    ${user.name} &nbsp;|&nbsp; ${phone}<br>
                    <span style="color:#2563eb; font-weight:bold;">المبلغ المسدد حالياً: ${currentPaid.toFixed(2)} ج.م</span>
                </p>

                <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:14px;">
                        <input type="radio" name="cancel-type" value="full" checked onchange="toggleCancelInput()">
                        إلغاء كامل المبلغ (${currentPaid.toFixed(2)} ج.م)
                    </label>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:14px;">
                        <input type="radio" name="cancel-type" value="partial" onchange="toggleCancelInput()">
                        إلغاء مبلغ جزئي محدد
                    </label>
                    <div id="partial-cancel-wrapper" style="display:none; margin-right:22px;">
                        <input type="number" id="cancel-partial-amount"
                            placeholder="أدخل المبلغ المراد إلغاؤه"
                            max="${currentPaid}"
                            min="0.01"
                            step="0.01"
                            style="width:100%; padding:8px 10px; border:1px solid #ddd; border-radius:7px; font-size:14px; direction:ltr; text-align:right;">
                        <small style="color:#6b7280; font-size:11px;">الحد الأقصى: ${currentPaid.toFixed(2)} ج.م</small>
                    </div>
                </div>

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button onclick="document.getElementById('${modalId}').remove()"
                        style="padding:8px 18px; border-radius:7px; border:1px solid #ddd; background:#f3f4f6; cursor:pointer; font-size:13px;">
                        تراجع
                    </button>
                    <button onclick="confirmCancelPayment('${month}', '${phone}', ${currentPaid}, ${packageAmt})"
                        style="padding:8px 18px; border-radius:7px; border:none; background:#dc2626; color:#fff; cursor:pointer; font-size:13px; font-weight:bold;">
                        <i class="fa-solid fa-check"></i> تأكيد الإلغاء
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // إغلاق بالضغط خارج النافذة
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    });
}

function toggleCancelInput() {
    const isPartial = document.querySelector('input[name="cancel-type"]:checked').value === 'partial';
    document.getElementById('partial-cancel-wrapper').style.display = isPartial ? 'block' : 'none';
}

function confirmCancelPayment(month, phone, currentPaid, packageAmt) {
    const type = document.querySelector('input[name="cancel-type"]:checked').value;
    let amountToCancel = 0;

    if (type === 'full') {
        amountToCancel = currentPaid;
    } else {
        amountToCancel = parseFloat(document.getElementById('cancel-partial-amount').value);
        if (isNaN(amountToCancel) || amountToCancel <= 0) {
            return alert("يرجى إدخال مبلغ إلغاء صحيح أكبر من الصفر.");
        }
        if (amountToCancel > currentPaid) {
            return alert(`لا يمكن إلغاء مبلغ (${amountToCancel.toFixed(2)}) أكبر من المبلغ المسدد (${currentPaid.toFixed(2)}).`);
        }
    }

    const newPaid   = currentPaid - amountToCancel;
    let newStatus   = "غير مدفوع";
    if (newPaid > 0 && newPaid < packageAmt) newStatus = "مدفوع جزئياً";
    else if (newPaid >= packageAmt)          newStatus = "مدفوع بالكامل";

    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: newStatus
    }, () => {
        document.getElementById('cancel-payment-modal').remove();
        alert(
            type === 'full'
                ? `تم إلغاء كامل السداد (${amountToCancel.toFixed(2)} ج.م) بنجاح.`
                : `تم إلغاء مبلغ (${amountToCancel.toFixed(2)} ج.م)، المتبقي المسدد: ${newPaid.toFixed(2)} ج.م.`
        );
        loadCollectionData();
        calculateFinancialReport();
    });
}

function payAllActiveInvoices() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return alert("اختر الشهر أولاً.");

    if (!confirm("هل تريد تسوية الحسابات الآمنة تلقائياً؟")) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const data = snapshot.val() || {};
        let updates = {};
        let skippedCount = 0;
        let processedCount = 0;

        for (let phone in data) {
            const inv = data[phone];
            const user = loadedGlobalSettings[phone] || { price: 0 };

            const invoiceAmt = parseFloat(inv.totalAfterTaxes) || 0;
            const packageAmt = inv.packagePrice !== undefined ? parseFloat(inv.packagePrice) : parseFloat(user.price) || 0;
            const diffAmt = packageAmt - invoiceAmt;

            // تخطي الخطوط التي تحتاج مراجعة
            if (invoiceAmt >= packageAmt || (diffAmt >= 8.4 && diffAmt <= 9.6)) {
                skippedCount++;
                continue;
            }

            const paid = parseFloat(inv.paidAmount) || 0;
            if (paid < packageAmt) {
                updates[`invoices/${month}/${phone}/paidAmount`] = packageAmt;
                updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
                processedCount++;
            }
        }

        if (Object.keys(updates).length > 0) {
            db.ref().update(updates, () => {
                alert(`تم تسوية وتحصيل عدد (${processedCount}) خط بنجاح وترك (${skippedCount}) خط للمراجعة.`);
                loadCollectionData();
                calculateFinancialReport();
            });
        } else {
            alert("لا توجد حسابات آمنة للتسوية التلقائية في هذا الشهر.");
        }
    });
}

// ==========================================
// [5] شاشة الدفع المقدم والمحافظ الرقمية
// ==========================================
function searchForAdvance() {
    const phone = formatPhoneNumber(document.getElementById('advance-search-input').value.trim());
    const profileCard = document.getElementById('advance-profile-card');
    if (!phone) return alert("أدخل رقم العميل المراد الاستعلام عنه.");

    const user = loadedGlobalSettings[phone];
    if (!user) {
        profileCard.style.display = 'none';
        return alert("هذا الرقم غير مدرج بدليل الأفراد الحالي.");
    }

    document.getElementById('advance-user-name').innerText = user.name;
    document.getElementById('advance-user-phone').innerText = `الرقم المالي: ${phone}`;
    document.getElementById('current-advance-balance').innerText = `${(loadedAdvancePayments[phone] || 0).toFixed(2)} ج.م`;
    profileCard.style.display = 'block';
}

function saveAdvancePayment() {
    const phone = formatPhoneNumber(document.getElementById('advance-search-input').value.trim());
    const amount = parseFloat(document.getElementById('new-advance-amount').value);
    if (!phone || isNaN(amount) || amount <= 0) return alert("يرجى كتابة مبالغ شحن صحيحة.");

    const newBalance = (loadedAdvancePayments[phone] || 0) + amount;
    db.ref(`advancePayments/${phone}`).set(newBalance, () => {
        alert("تم إيداع الدفعة المقدمة بالمحفظة الرقمية بنجاح.");
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

    if (!query) return alert("يرجى إدخال اسم أو رقم الهاتف لبدء الاستعلام.");

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        let html = `<div class="card"><h3>نتائج البحث والتحليل التراكمي</h3><div class="table-wrapper"><table><thead><tr><th>الشهر</th><th>الاسم</th><th>الرقم</th><th>الباقة</th><th>الفاتورة</th><th>المدفوع</th><th>الوضعية</th></tr></thead><tbody>`;
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
                        <td><span class="badge ${debt <= 0 ? 'badge-green' : 'badge-red'}">${debt <= 0 ? 'مسدد بالكامل' : 'متبقي: ' + debt.toFixed(2)}</span></td>
                    </tr>`;
                    matchesCount++;
                }
            }
        }
        html += `</tbody></table></div></div>`;
        resultsArea.innerHTML = matchesCount > 0 ? html : `<div class="card" style="text-align:center; padding:20px;">لم يتم العثور على أي نتائج مطابقة.</div>`;
    });
}

function saveExtraFinancials() {
    db.ref(`extraFinancials/summaryData`).set({
        manualInvoice: parseFloat(document.getElementById('manual-invoice-input').value) || 0,
        additionalRevenue: parseFloat(document.getElementById('additional-revenue-input').value) || 0,
        additionalExpenses: parseFloat(document.getElementById('additional-expenses-input').value) || 0
    }, () => {
        alert("تم حفظ التسويات المالية الإضافية للوحة الأرباح العام.");
        calculateFinancialReport();
    });
}

function loadExtraFinancialsForSelectedMonth() {
    db.ref(`extraFinancials/summaryData`).once('value', snapshot => {
        const extra = snapshot.val() || {};
        const manualInput = document.getElementById('manual-invoice-input');
        const revenueInput = document.getElementById('additional-revenue-input');
        const expensesInput = document.getElementById('additional-expenses-input');
        if (manualInput) manualInput.value = extra.manualInvoice || 0;
        if (revenueInput) revenueInput.value = extra.additionalRevenue || 0;
        if (expensesInput) expensesInput.value = extra.additionalExpenses || 0;
    });
}

function calculateFinancialReport() {
    const reportResults = document.getElementById('financial-report-results');
    if (!reportResults) return;

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        let totalPackages = 0, totalInvoices = 0, totalPaid = 0;

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
            const netProfit = (totalPackages + extra.additionalRevenue) - (totalInvoices + extra.additionalExpenses);

            reportResults.innerHTML = `
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center;">
                    <h4 style="font-size:12px; color:#555; margin-bottom:5px;">إجمالي الإيراد المتوقع (الباقات)</h4>
                    <strong style="font-size:16px;">${totalPackages.toFixed(2)} ج.م</strong>
                </div>
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center;">
                    <h4 style="font-size:12px; color:#555; margin-bottom:5px;">التكلفة الفعلية (فودافون)</h4>
                    <strong style="font-size:16px;">${totalInvoices.toFixed(2)} ج.م</strong>
                </div>
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center;">
                    <h4 style="font-size:12px; color:#555; margin-bottom:5px;">المبالغ المحصلة فعلياً</h4>
                    <strong style="font-size:16px; color:var(--green-success);">${totalPaid.toFixed(2)} ج.م</strong>
                </div>
                <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #ddd; text-align:center; border-top:4px solid #2563eb;">
                    <h4 style="font-size:12px; color:#2563eb; margin-bottom:5px;">صافي الأرباح للمنظومة</h4>
                    <strong style="font-size:18px; color:#2563eb;">${netProfit.toFixed(2)} ج.م</strong>
                </div>
            `;
        });
    });
}

// ==========================================
// [7] كشف الحساب التفصيلي والسداد التلقائي من المحفظة
// ==========================================
function generateDetailedStatement() {
    const input = document.getElementById('statement-search-input').value.trim().toLowerCase();
    const outputArea = document.getElementById('statement-output-area');
    const tbody = document.getElementById('statement-table-body');
    if (!input) return alert("يرجى إدخال اسم أو رقم لاستخراج كشف الحساب.");

    let targetPhone = "", targetName = "";
    for (let phone in loadedGlobalSettings) {
        if (phone === input || loadedGlobalSettings[phone].name.toLowerCase().includes(input)) {
            targetPhone = phone;
            targetName = loadedGlobalSettings[phone].name;
            break;
        }
    }
    if (!targetPhone) {
        outputArea.style.display = 'none';
        return alert("عذراً، المشترك غير موجود بسجلات المنظومة.");
    }

    currentStatementPhone = targetPhone;

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        tbody.innerHTML = "";
        let totalRequired = 0, totalPaid = 0, totalDebt = 0;

        for (let month in allInvoices) {
            if (allInvoices[month][targetPhone]) {
                const inv = allInvoices[month][targetPhone];
                const packagePrice = parseFloat(inv.packagePrice) || 0;
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
                    <td>${(parseFloat(inv.totalAfterTaxes) || 0).toFixed(2)} ج.م</td>
                    <td>${paidAmount.toFixed(2)} ج.م</td>
                    <td>${remainingDebt.toFixed(2)} ج.م</td>
                    <td><span class="badge ${remainingDebt <= 0 ? 'badge-green' : 'badge-red'}">${remainingDebt <= 0 ? 'مسدد ومقفل' : 'معلق مديونية'}</span></td>
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
        if (settleBtn) {
            settleBtn.style.display = (totalDebt > 0 && walletBalance > 0) ? 'inline-flex' : 'none';
        }
        outputArea.style.display = 'block';
    });
}

function settleStatementDebtsWithWallet() {
    if (!currentStatementPhone) return;
    let walletBalance = loadedAdvancePayments[currentStatementPhone] || 0;
    if (walletBalance <= 0) return alert("رصيد المحفظة صفر، لا يوجد دفع مقدم متاح لتسويته.");

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
                        updates[`invoices/${month}/${currentStatementPhone}/paidAmount`] = paidAmount + walletBalance;
                        updates[`invoices/${month}/${currentStatementPhone}/status`] = "مدفوع جزئياً";
                        walletBalance = 0;
                    }
                }
            }
        }

        updates[`advancePayments/${currentStatementPhone}`] = walletBalance;
        db.ref().update(updates, () => {
            alert("تم تنفيذ عملية التسوية الذكية من رصيد المحفظة بنجاح.");
            generateDetailedStatement();
            calculateFinancialReport();
        });
    });
}

// ==========================================
// [8] دليل الأفراد والإعدادات
// ==========================================
function handleSettingsImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        processSettingsExcel(XLSX.utils.sheet_to_json(worksheet));
    };
    reader.readAsArrayBuffer(file);
}

function processSettingsExcel(data) {
    let importedCount = 0;
    data.forEach(row => {
        let name = row['الاسم'] || row['اسم المشترك'] || '';
        let phone = formatPhoneNumber(row['الرقم'] || row['رقم الهاتف'] || '');
        let price = row['سعر الباقه'] || row['سعر الباقة'] || 0;
        let plan = row['الاسعار'] || row['خطة الاسعار'] || '';

        if (phone && name) {
            db.ref('settings/' + phone).set({ name, price: parseFloat(price) || 0, ratePlan: plan });
            importedCount++;
        }
    });
    alert(`تم استيراد (${importedCount}) مشترك بنجاح.`);
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
                <button class="btn btn-outline" style="padding:5px 10px; color:blue;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan || ''}', '')"><i class="fa-solid fa-pen"></i> تعديل</button>
                <button class="btn btn-red" style="padding:4px 10px; font-size:12px;" onclick="deleteUser('${phone}')"><i class="fa-solid fa-trash"></i> حذف</button>
            </td>
        `;
        tbody.appendChild(tr);
    }
}

function addNewUserFromSettings() {
    const name = document.getElementById('new-user-name').value.trim();
    const phone = formatPhoneNumber(document.getElementById('new-user-phone').value.trim());
    const price = parseFloat(document.getElementById('new-user-price').value);
    const plan = document.getElementById('new-user-plan').value.trim();

    if (!name || !phone || isNaN(price)) return alert("يرجى تعبئة الحقول الأساسية بشكل صحيح.");

    db.ref('settings/' + phone).set({ name, price, ratePlan: plan || 'غير محدد' }, () => {
        alert("تم إدراج العميل الجديد بنجاح.");
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-phone').value = '';
        document.getElementById('new-user-price').value = '';
        document.getElementById('new-user-plan').value = '';
        loadSettingsTable();
    });
}

function filterSettingsTable() {
    const query = document.getElementById('settings-table-search').value.toLowerCase();
    document.querySelectorAll('#settings-table-body tr').forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
}

function deleteUser(phone) {
    if (!confirm(`هل أنت متأكد من حذف المشترك صاحب الرقم ${phone}؟`)) return;
    db.ref('settings/' + phone).remove(() => {
        loadSettingsTable();
        if (document.getElementById('global-search-input') && document.getElementById('global-search-input').value) {
            executeGlobalSearch();
        }
        loadCollectionData();
        calculateFinancialReport();
    });
}

function openEditModal(phone, name, price, plan, month) {
    const user = loadedGlobalSettings[phone];
    if (!user && !name) return;
    document.getElementById('edit-phone').value = phone;
    document.getElementById('edit-name').value = name || (user ? user.name : '');
    document.getElementById('edit-price').value = price !== undefined ? price : (user ? user.price : 0);
    document.getElementById('edit-plan').value = plan || (user ? user.ratePlan : '');
    document.getElementById('editClientModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editClientModal').style.display = 'none';
}

function saveClientEdits() {
    const phone = document.getElementById('edit-phone').value;
    const name = document.getElementById('edit-name').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value);
    const plan = document.getElementById('edit-plan').value.trim();

    if (!name || isNaN(price)) return alert("يرجى إدخال بيانات صحيحة.");
    db.ref('settings/' + phone).update({ name, price, ratePlan: plan }, () => {
        alert("تم تحديث بيانات العميل بنجاح.");
        closeEditModal();
        loadSettingsTable();
        calculateFinancialReport();
    });
}
