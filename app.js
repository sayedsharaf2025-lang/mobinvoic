// تكوين وبيانات اتصال قاعدة بيانات Firebase الخاصة بك بالكامل
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

// تهيئة تطبيق الفايربيس والاستدعاءات الداخلية للقاعدة
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// متغيرات عامة ومؤقتة لإدارة العمليات الحالية على الشاشة
let currentParsedInvoice = [];
let loadedGlobalSettings = {};

document.addEventListener("DOMContentLoaded", function() {
    // 1. نظام تحويل الشاشات الفوري والديناميكي (Single Page Application Navigation)
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
            
            // تنفيذ كود التحضير لكل شاشة أثناء فتحها
            if (target === 'settings-screen') loadSettingsTable();
            if (target === 'collection-screen' || target === 'invoices-screen') updateInvoiceMonthsDropdowns();
        });
    });

    // استدعاء البيانات من النظام لأول مرة
    syncGlobalSettings();
});

// مزامنة مستمرة مع إعدادات الأفراد لضمان الكفاءة والسرعة التلقائية في المعالجة
function syncGlobalSettings() {
    db.ref('settings').on('value', snapshot => {
        loadedGlobalSettings = snapshot.val() || {};
    });
}

// ==========================================
// [1] شاشة الإعدادات والأفراد (SETTINGS & IMPORT)
// ==========================================

// قراءة وتحويل ملف الـ CSV المرفوع للأفراد والباقات
function handleSettingsImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        const text = evt.target.result;
        parseSettingsCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
}

// دالة تفكيك البيانات وتنظيف ملف CSV بدقة
function parseSettingsCSV(text) {
    const lines = text.split('\n');
    let importedCount = 0;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');
        
        let name = cols[0] ? cols[0].trim() : '';
        let phone = cols[1] ? cols[1].trim() : '';
        let price = cols[2] ? parseFloat(cols[2].trim()) : 0;
        let plan = cols[3] ? cols[3].trim() : '';

        // تنظيف أسطر الشفرات التالفة أو البيانات الفارغة غير الصحيحة
        if (phone && phone !== '0' && name) {
            db.ref('settings/' + phone).set({
                name: name,
                price: price,
                ratePlan: plan
            });
            importedCount++;
        }
    }
    alert(`تم بنجاح استيراد وتحديث عدد (${importedCount}) فرد في قاعدة البيانات!`);
    loadSettingsTable();
}

// تحميل وعرض جدول الإعدادات الشامل مع تفعيل الحذف والتعديل
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
                    <button class="btn btn-outline" style="padding: 5px 10px; color: blue;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn btn-outline" style="padding: 5px 10px; color: red;" onclick="deleteUser('${phone}')"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

// تصفية حية وديناميكية لجدول الإعدادات
function filterSettingsTable() {
    const filter = document.getElementById('settings-table-search').value.toLowerCase();
    const rows = document.querySelectorAll('#settings-main-table tbody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}

// إضافة فرد يدويًا من الحقول السريعة بالواجهة
function addNewUserFromSettings() {
    const name = document.getElementById('new-user-name').value.trim();
    const phone = document.getElementById('new-user-phone').value.trim();
    const price = parseFloat(document.getElementById('new-user-price').value) || 0;
    const plan = document.getElementById('new-user-plan').value.trim();

    if (!name || !phone) {
        alert("برجاء إدخال الاسم ورقم الهاتف على الأقل كبيانات أساسية لحفظ الفرد!");
        return;
    }

    db.ref('settings/' + phone).set({ name, price, ratePlan: plan }, () => {
        alert("تم حفظ الفرد الجديد يدويًا داخل قاعدة البيانات!");
        loadSettingsTable();
        // تفريغ الحقول
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-phone').value = '';
        document.getElementById('new-user-price').value = '';
        document.getElementById('new-user-plan').value = '';
    });
}

// إزالة مستخدم نهائيًا من لوحة الإعدادات
function deleteUser(phone) {
    if (confirm(`هل أنت متأكد من رغبتك في حذف الرقم (${phone}) نهائياً من إعدادات المنظومة؟`)) {
        db.ref('settings/' + phone).remove(() => {
            loadSettingsTable();
        });
    }
}

// النوافذ المنبثقة للتعديل السريع (Modal Controller)
function openEditModal(phone, name, price, plan) {
    document.getElementById('edit-old-phone').value = phone;
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

    db.ref('settings/' + phone).update({
        name: name,
        price: price,
        ratePlan: plan
    }, () => {
        alert("تم تحديث البيانات بالنجاح!");
        closeEditModal();
        loadSettingsTable();
    });
}

// ==========================================
// [2] شاشة معالجة وإدارة الفواتير (INVOICES)
// ==========================================

function handleInvoiceImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const text = evt.target.result;
        processInvoiceCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
}

function processInvoiceCSV(text) {
    const lines = text.split('\n');
    currentParsedInvoice = [];
    const tbody = document.querySelector('#invoice-preview-table tbody');
    tbody.innerHTML = '';

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = lines[i].split(',');

        let phone = cols[0] ? cols[0].trim() : '';
        let ratePlan = cols[1] ? cols[1].trim() : '';
        let totalTaxes = cols[2] ? parseFloat(cols[2].trim()) : 0;

        if (phone && phone !== '0' && !isNaN(totalTaxes)) {
            currentParsedInvoice.push({ phone, ratePlan, totalTaxes });

            // إضافة معاينة مرئية سريعة بالجدول للمستخدم
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${phone}</td><td>${ratePlan}</td><td>${totalTaxes} ج.م</td>`;
            tbody.appendChild(tr);
        }
    }
    document.getElementById('invoice-preview-card').style.display = 'block';
}

// تنفيذ المنطق المطلوب: حفظ الفاتورة وإضافة الأرقام غير المسجلة بدون اسم تلقائيًا بالإعدادات
function saveProcessedInvoice() {
    const month = document.getElementById('invoice-month-select').value;
    if (!month) {
        alert("برجاء تحديد الشهر والسنة المراد الحفظ عليهما أولاً قبل الاعتماد!");
        return;
    }

    if (currentParsedInvoice.length === 0) {
        alert("لا توجد بيانات فاتورة صالحة للمعالجة والحفظ.");
        return;
    }

    currentParsedInvoice.forEach(item => {
        // فحص هل الرقم مسجل مسبقًا في لوحة الأفراد
        if (!loadedGlobalSettings[item.phone]) {
            // إضافة فورية بدون اسم وتعيين خطة الأسعار المتاحة
            db.ref('settings/' + item.phone).set({
                name: "بدون اسم",
                price: 0,
                ratePlan: item.ratePlan
            });
        }

        // حفظ تفاصيل الفاتورة لشهر الاستحقاق المعين
        db.ref(`invoices/${month}/${item.phone}`).set({
            ratePlan: item.ratePlan,
            totalAfterTaxes: item.totalTaxes,
            paidAmount: 0,
            status: "غير مدفوع"
        });
    });

    alert(`تم بنجاح معالجة وحفظ فاتورة شهر (${month})، وتلقائياً تم إنشاء حسابات للأرقام الجديدة بالإعدادات بدون اسم لتعديلها لاحقاً!`);
    document.getElementById('invoice-preview-card').style.display = 'none';
    updateInvoiceMonthsDropdowns();
}

function updateInvoiceMonthsDropdowns() {
    db.ref('invoices').once('value', snapshot => {
        const monthsData = snapshot.val() || {};
        const deleteSelect = document.getElementById('delete-invoice-month-select');
        const collectSelect = document.getElementById('collection-month-select');
        
        deleteSelect.innerHTML = '<option value="">-- اختر الشهر --</option>';
        collectSelect.innerHTML = '<option value="">-- اختر الشهر --</option>';

        for (let m in monthsData) {
            let opt1 = document.createElement('option'); opt1.value = m; opt1.innerText = m;
            let opt2 = document.createElement('option'); opt2.value = m; opt2.innerText = m;
            deleteSelect.appendChild(opt1);
            collectSelect.appendChild(opt2);
        }
    });
}

function deleteStoredInvoice() {
    const month = document.getElementById('delete-invoice-month-select').value;
    if (!month) return alert("برجاء تحديد الشهر المراد حذفه.");
    
    if (confirm(`هل أنت متأكد تماماً من رغبتك في حذف بيانات فاتورة شهر (${month}) بالكامل نهائياً؟`)) {
        db.ref(`invoices/${month}`).remove(() => {
            alert("تم إزالة بيانات الشهر المذكور بنجاح.");
            updateInvoiceMonthsDropdowns();
        });
    }
}

// ==========================================
// [3] شاشة التحصيل المالي (COLLECTION SCREEN)
// ==========================================

function loadCollectionData() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const invoices = snapshot.val() || {};
        const tbody = document.getElementById('collection-table-body');
        tbody.innerHTML = '';

        for (let phone in invoices) {
            const inv = invoices[phone];
            const userConf = loadedGlobalSettings[phone] || { name: "بدون اسم", price: 0 };
            
            const tr = document.createElement('tr');
            const remaining = inv.totalAfterTaxes - (inv.paidAmount || 0);
            const statusBadge = remaining <= 0 ? '<span class="badge badge-green">مدفوع بالكامل</span>' : `<span class="badge badge-red">متبقي: ${remaining.toFixed(2)}</span>`;

            tr.innerHTML = `
                <td>${phone}</td>
                <td>${userConf.name}</td>
                <td>${userConf.price} ج.م</td>
                <td>${inv.totalAfterTaxes} ج.م</td>
                <td>${inv.paidAmount || 0} ج.م</td>
                <td>${statusBadge}</td>
                <td>
                    <input type="number" placeholder="المبلغ" id="pay-amt-${phone}" class="form-control" style="width:90px; display:inline-block; padding:5px;">
                    <button class="btn btn-green" style="padding:5px 10px;" onclick="collectPayment('${month}', '${phone}', ${inv.totalAfterTaxes}, ${inv.paidAmount || 0})">تسجيل دفعة</button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function collectPayment(month, phone, total, alreadyPaid) {
    const inputAmt = parseFloat(document.getElementById(`pay-amt-${phone}`).value);
    if (isNaN(inputAmt) || inputAmt <= 0) return alert("برجاء إدخال قيمة مالية صحيحة!");

    const newTotalPaid = alreadyPaid + inputAmt;
    const status = newTotalPaid >= total ? "مدفوع بالكامل" : "مدفوع جزئياً";

    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newTotalPaid,
        status: status
    }, () => {
        alert("تم قيد وتحصيل المبلغ وتحديث الحالة!");
        loadCollectionData();
    });
}

// تحصيل ودفع كلي لكل الأرقام الظاهرة في فاتورة الشهر دفعة واحدة بنقرة زر واحدة
function payAllActiveInvoices() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return alert("اختر الشهر أولاً لتطبيق عملية الدفع الجماعي!");

    if (confirm(`هل أنت متأكد من تسوية كافة الحسابات والخطوط لشهر (${month}) واحتسابها مدفوعة بالكامل؟`)) {
        db.ref(`invoices/${month}`).once('value', snapshot => {
            const invoices = snapshot.val() || {};
            let updates = {};
            for (let phone in invoices) {
                updates[`invoices/${month}/${phone}/paidAmount`] = invoices[phone].totalAfterTaxes;
                updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
            }
            db.ref().update(updates, () => {
                alert("تمت جدولة وتحديث كافّة الفواتير للشهر كمدفوعة بالكامل بنجاح مالي تام!");
                loadCollectionData();
            });
        });
    }
}

// ==========================================
// [4] شاشة الدفع المقدم والرصيد المسبق (ADVANCE PAYMENTS)
// ==========================================

function searchForAdvance() {
    const searchVal = document.getElementById('advance-search-input').value.trim();
    if (!searchVal) return alert("يرجى إدخال رقم أو اسم المستعلم.");

    let targetPhone = null;
    let targetName = "بدون اسم";

    // البحث في كائن التكوين العام المتاح لدينا للأفراد
    for (let phone in loadedGlobalSettings) {
        if (phone === searchVal || loadedGlobalSettings[phone].name.includes(searchVal)) {
            targetPhone = phone;
            targetName = loadedGlobalSettings[phone].name;
            break;
        }
    }

    if (!targetPhone) {
        alert("لم يتم العثور على أي هاتف متطابق مع بيانات البحث الحالية بالمنظومة.");
        return;
    }

    document.getElementById('advance-user-name').innerText = targetName;
    document.getElementById('advance-user-phone').innerText = "الرقم المسجل: " + targetPhone;

    // استدعاء قيمة الرصيد الدفتري التراكمي المسبق من الفايربيس للرقم المختار
    db.ref('advancePayments/' + targetPhone).once('value', snapshot => {
        const balance = snapshot.val() || 0;
        document.getElementById('current-advance-balance').innerText = balance.toFixed(2) + " ج.م";
        document.getElementById('advance-profile-card').setAttribute('data-current-phone', targetPhone);
        document.getElementById('advance-profile-card').style.display = 'block';
    });
}

function saveAdvancePayment() {
    const phone = document.getElementById('advance-profile-card').getAttribute('data-current-phone');
    const amount = parseFloat(document.getElementById('new-advance-amount').value);

    if (!phone || isNaN(amount) || amount <= 0) return alert("برجاء إدخال قيمة مبلغ صحيحة ومؤكدة للإيداع.");

    db.ref('advancePayments/' + phone).once('value', snapshot => {
        const currentBalance = snapshot.val() || 0;
        const nextBalance = currentBalance + amount;

        db.ref('advancePayments/' + phone).set(nextBalance, () => {
            alert("تم إدراج الدفعة النقدية وإضافتها لرصيد المحفظة المقدم بنجاح!");
            document.getElementById('new-advance-amount').value = '';
            searchForAdvance(); // تحديث فوري مرئي للرصيد على الشاشة
        });
    });
}

// ==========================================
// [5] شاشة البحث الشامل والديناميكي (GLOBAL DASHBOARD SEARCH)
// ==========================================

function executeGlobalSearch() {
    const filter = document.getElementById('global-search-input').value.trim();
    const resultsArea = document.getElementById('search-results-area');
    resultsArea.innerHTML = '';

    if (!filter) return alert("يرجى كتابة مدخلات صالحة في صندوق الاستعلام أولاً!");

    let foundMatch = false;

    for (let phone in loadedGlobalSettings) {
        const user = loadedGlobalSettings[phone];
        if (phone.includes(filter) || user.name.includes(filter)) {
            foundMatch = true;
            
            // إنشاء كارت البيانات الشامل للعميل المكتشف
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h3><i class="fa-solid fa-address-card text-red"></i> ${user.name}</h3>
                    <span class="badge badge-green" style="font-size:14px;">سعر الباقة المعتمدة: ${user.price} ج.م</span>
                </div>
                <p style="margin: 5px 0;"><strong>رقم الهاتف:</strong> ${phone} | <strong>خطة الاشتراك:</strong> ${user.ratePlan || 'غير محددة'}</p>
                <div id="history-area-${phone}" style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
                    <p style="font-size:13px; color:#777;"><i class="fa-solid fa-spinner fa-spin"></i> جاري استدعاء سجل الفواتير والمطالبات المالية التاريخية...</p>
                </div>
            `;
            resultsArea.appendChild(card);
            
            // سحب كافّة السجلات المرتبطة بالرقم من الفواتير الشهرية المودعة ديناميكيًا
            fetchUserFinancialHistory(phone);
        }
    }

    if (!foundMatch) {
        resultsArea.innerHTML = `<div class="card" style="text-align:center; color:red;">عذراً، لم نجد أي بيانات مطابقة لـ (${filter})</div>`;
    }
}

function fetchUserFinancialHistory(phone) {
    db.ref('invoices').once('value', snapshot => {
        const allMonths = snapshot.val() || {};
        const historyDiv = document.getElementById(`history-area-${phone}`);
        if (!historyDiv) return;
        
        let rowsHtml = '';
        
        for (let month in allMonths) {
            if (allMonths[month][phone]) {
                const invoiceDetails = allMonths[month][phone];
                const isPaid = (invoiceDetails.paidAmount >= invoiceDetails.totalAfterTaxes);
                rowsHtml += `
                    <tr>
                        <td>${month}</td>
                        <td>${invoiceDetails.totalAfterTaxes} ج.م</td>
                        <td>${invoiceDetails.paidAmount || 0} ج.م</td>
                        <td>${isPaid ? '<span class="badge badge-green">مستوفى</span>' : '<span class="badge badge-red">مستحق المعالجة</span>'}</td>
                    </tr>
                `;
            }
        }

        if (rowsHtml === '') {
            historyDiv.innerHTML = `<p style="color:orange; font-size:13px;"><i class="fa-solid fa-triangle-exclamation"></i> لا يوجد فواتير شهرية سابقة مسجلة لهذا الرقم حتى الآن.</p>`;
        } else {
            historyDiv.innerHTML = `
                <h4 style="margin-bottom:8px; font-size:14px;">الملخص المالي الشامل للفواتير والأشهر:</h4>
                <table style="min-width:100%; font-size:12px;">
                    <thead>
                        <tr><th>الشهر</th><th>إجمالي المستحق بالضريبة</th><th>المبلغ المدفوع</th><th>الحالة</th></tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            `;
        }
    });
}
