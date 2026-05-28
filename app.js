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
    updateInvoiceMonthsDropdowns(); // ملء التواريخ فور فتح المنظومة مباشرة
});

// مزامنة حية ومستمرة لبيانات الأفراد المسجلين
function syncGlobalSettings() {
    db.ref('settings').on('value', snapshot => {
        loadedGlobalSettings = snapshot.val() || {};
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
        });
    }
}

// ==========================================
// [2] شاشة استيراد ومعالجة الفواتير (إصلاح مشكلة التداخل)
// ==========================================
function handleInvoiceImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    // تصفير أولي للجدول والمصفوفة لمنع ظهور الفاتورة السابقة كلياً
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
    
    // الحل الجذري لمنع تكرار أو بقاء الملف السابق ظاهرًا بعد الرفع:
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
// [3] شاشة التحصيل المالي (عرض أرقام لم تدفع فقط)
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
            const remaining = inv.totalAfterTaxes - (inv.paidAmount || 0);
            
            // التعديل: يتم عرض الأرقام التي لم تدفع فقط (المتبقي أكبر من صفر)
            if (remaining <= 0) continue; 
            
            unpaidCount++;
            const statusHtml = `<span class="badge badge-red">متبقي: ${remaining.toFixed(2)} ج.م</span>`;
            
            // إضافة زر إلغاء سداد فرعي في حال الدفع الجزئي للحساب
            let cancelBtn = '';
            if ((inv.paidAmount || 0) > 0) {
                cancelBtn = `<button class="btn btn-outline" style="padding:5px 10px; color:orange; margin-right:5px;" onclick="cancelPayment('${month}', '${phone}')"><i class="fa-solid fa-rotate-left"></i> إلغاء</button>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${phone}</td>
                <td><strong>${user.name}</strong></td>
                <td>${user.price} ج.م</td>
                <td>${inv.totalAfterTaxes} ج.م</td>
                <td>${inv.paidAmount || 0} ج.م</td>
                <td>${statusHtml}</td>
                <td>
                    <input type="number" placeholder="المبلغ" id="pay-amt-${phone}" class="form-control" style="width:80px; display:inline-block; padding:5px;">
                    <button class="btn btn-green" style="padding:5px 10px;" onclick="collectPayment('${month}', '${phone}', ${inv.totalAfterTaxes}, ${inv.paidAmount || 0})">تسجيل</button>
                    ${cancelBtn}
                </td>
            `;
            tbody.appendChild(tr);
        }
        
        // التعديل: إذا قامت كل الأرقام بالدفع لا يظهر أي شيء عدا رسالة اكتمال التحصيل
        if (unpaidCount === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--green-success); font-weight:bold; padding:35px; font-size:16px;"><i class="fa-solid fa-square-check"></i> ممتاز! جميع الأرقام قامت بالدفع بالكامل لهذا الشهر! لا توجد مستحقات معلقة.</td></tr>`;
        }
    });
}

function collectPayment(month, phone, total, alreadyPaid) {
    const amt = parseFloat(document.getElementById(`pay-amt-${phone}`).value);
    if (isNaN(amt) || amt <= 0) return alert("برجاء إدخال قيمة صحيحة.");

    const newPaid = alreadyPaid + amt;
    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: newPaid >= total ? "مدفوع بالكامل" : "مدفوع جزئياً"
    }, () => {
        alert("تم تسجيل دفعة التحصيل بنجاح!");
        loadCollectionData();
    });
}

function payAllActiveInvoices() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return alert("اختر الشهر أولاً.");
    if (confirm("هل تريد تسوية وحفظ جميع الأرقام المتبقية لشهر كمدفوعة بالكامل؟")) {
        db.ref(`invoices/${month}`).once('value', snapshot => {
            const data = snapshot.val() || {};
            let updates = {};
            for (let phone in data) {
                updates[`invoices/${month}/${phone}/paidAmount`] = data[phone].totalAfterTaxes;
                updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
            }
            db.ref().update(updates, () => {
                alert("تم تحول كافة الحسابات إلى مدفوعة بالكامل.");
                loadCollectionData();
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
// [5] شاشة البحث الشامل (تفعيل فلتر الشهر وتجميع أسعار الباقات)
// ==========================================
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
            // التعديل: جمع سعر الباقة الإجمالي لكل الأرقام التي تقع تحت البحث تلقائياً
            totalPackagesSum += parseFloat(user.price) || 0;

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                    <h3><i class="fa-solid fa-id-card text-red"></i> الاسم الحالي: ${user.name}</h3>
                    <div>
                        <button class="btn btn-outline" style="color:blue; padding:5px 10px; margin-left:5px;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan}')"><i class="fa-solid fa-pen"></i> تعديل</button>
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

    // التعديل: عرض إجمالي أسعار الباقات المجمعة في كارت مميز بالأعلى
    if (matchedCount > 0) {
        summaryArea.innerHTML = `
            <div class="card" style="background-color: #E2F6EE; border-color: var(--green-success); padding: 15px; display: flex; align-items: center; gap: 15px;">
                <i class="fa-solid fa-calculator text-green" style="font-size: 24px;"></i>
                <div>
                    <span style="font-size: 13px; color: #555; display: block;">إجمالي سعر الباقة المعتمد لكافة الأرقام الناتجة عن البحث (${matchedCount} خطوط):</span>
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
            // التعديل: تفعيل فلتر اختيار الشهر المعين إذا لم يكن الخيار "all"
            if (selectedMonth !== 'all' && m !== selectedMonth) continue;

            if (months[m][phone]) {
                const inv = months[m][phone];
                const remaining = inv.totalAfterTaxes - (inv.paidAmount || 0);
                
                let statusBadge = '';
                let cancelBtnHtml = '';

                if (remaining <= 0) {
                    statusBadge = '<span class="badge badge-green">مدفوع بالكامل</span>';
                } else if ((inv.paidAmount || 0) > 0) {
                    statusBadge = `<span class="badge badge-orange">مدفوع جزئياً (متبقي: ${remaining.toFixed(2)})</span>`;
                } else {
                    statusBadge = '<span class="badge badge-red">غير مدفوع</span>';
                }

                // التعديل: إضافة إمكانية إلغاء سداد فاتورة أي رقم في شهر معين وتصفير الحساب
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
            targetDiv.innerHTML = `<p style="font-size:12px; color:orange;"><i class="fa-solid fa-triangle-exclamation"></i> لا توجد فواتير مسجلة لهذا الشهر المالي المفلتر.</p>`;
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

// التعديل: دالة إلغاء سداد فاتورة الحساب كلياً وتصفير المبالغ المالية المدفوعة
function cancelPayment(month, phone) {
    if (confirm(`هل أنت متأكد من إلغاء سداد فاتورة الرقم (${phone}) لشهر (${month})؟ سيتم إعادة تعيين المبلغ المدفوع ليكون (0 ج.م) وتتحول الفاتورة لحالة مستحقة.`)) {
        db.ref(`invoices/${month}/${phone}`).update({
            paidAmount: 0,
            status: "غير مدفوع"
        }, () => {
            alert("تم إلغاء السداد بنجاح وتصفير المبالغ المدفوعة لهذا الشهر.");
            // تحديث الشاشات النشطة فورياً طبقاً لمكان الضغط
            if (document.getElementById('global-search-input').value) {
                executeGlobalSearch();
            }
            loadCollectionData();
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

// إغلاق المودال
function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function saveClientEdits() {
    const phone = document.getElementById('edit-phone').value;
    const name = document.getElementById('edit-name').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value) || 0;
    const plan = document.getElementById('edit-plan').value.trim();

    db.ref('settings/' + phone).update({ name, price, ratePlan: plan }, () => {
        alert("تم تعديل وحفظ بيانات العميل بنجاح!");
        closeEditModal();
        loadSettingsTable();
        if(document.getElementById('global-search-input').value) executeGlobalSearch();
    });
}
