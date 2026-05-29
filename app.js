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

// ==========================================
// [1] التحكم في التنقل والأحداث الرئيسية بالتحميل
// ==========================================
document.addEventListener("DOMContentLoaded", function() {
    // محرك التنقل بين الشاشات بمرونة (SPA)
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
            if (target === 'collection-screen') loadCollectionData();
            if (target === 'advance-screen') loadAdvanceBillingData();
            updateInvoiceMonthsDropdowns();
        });
    });

    // ربط حدث تغيير الشهر في شاشة البحث والتقرير لتحميل الإيرادات والمصاريف المحفوظة تلقائياً
    const searchSelect = document.getElementById('search-month-select');
    if (searchSelect) {
        searchSelect.addEventListener('change', loadExtraFinancialsForSelectedMonth);
    }

    // ربط حدث تغيير الشهر في شاشة التحصيل لتحديث الجدول فورياً
    const collSelect = document.getElementById('collection-month-select');
    if (collSelect) {
        collSelect.addEventListener('change', loadCollectionData);
    }

    // ربط التقاط تاريخ الدفع المقدم لتهيئة الجدول تلقائياً عند التغيير
    const advMonthPicker = document.getElementById('advance-month-picker');
    if (advMonthPicker) {
        let today = new Date();
        advMonthPicker.value = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2);
        advMonthPicker.addEventListener('change', loadAdvanceBillingData);
    }

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
// [2] شاشة الإعدادات واستيراد الأفراد والباقات
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
            loadCollectionData();
            calculateFinancialReport();
        });
    }
}

// ==========================================
// [3] شاشة استيراد ومعالجة الفواتير الشهرية
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
                statusBadge = `<span class="badge badge-orange"><i class="fa-solid fa-circle-exclamation"></i> رقم جديد (سينزل بدون اسم لتسعيره لاحقاً)</span>`;
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

    alert(`تم بنجاح اعتماد وحفظ فاتورة شهر (${month}) بالكامل لعمليات جرد الأرباح والمتابعة.`);
    
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
        
        loadExtraFinancialsForSelectedMonth();
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
// [4] شاشة التحصيل المالي (الرقابة الذكية والمديونية والـ 9 جنيهات)
// ==========================================
function loadCollectionData() {
    const month = document.getElementById('collection-month-select').value;
    const tbody = document.getElementById('collection-table-body');
    tbody.innerHTML = '';
    if (!month) return;

    db.ref(`invoices/${month}`).once('value', snapshot => {
        const invoices = snapshot.val() || {};
        let activeRowsCount = 0;

        for (let phone in invoices) {
            const inv = invoices[phone];
            const user = loadedGlobalSettings[phone] || { name: "بدون اسم", price: 0 };
            
            const paid = inv.paidAmount || 0;
            const requiredAmount = user.price; // السعر المعتمد للباقة
            const remaining = requiredAmount - paid; // المتبقي كمديونية

            const invoiceAmt = parseFloat(inv.totalAfterTaxes) || 0;
            const packageAmt = parseFloat(user.price) || 0;
            const diffAmt = packageAmt - invoiceAmt; // صافي الفرق قبل التحصيل

            // الشرط الصارم الصادر منك: الفاتورة أعلى أو تساوي الباقة، أو الفارق 9 جنيه تقريباً (من 8.4 إلى 9.6 للكسور)
            const isTargetForReview = (invoiceAmt >= packageAmt || (diffAmt >= 8.4 && diffAmt <= 9.6));
            
            // شرط الاختفاء عند التسوية: يختفي فقط إذا تم السداد بالكامل ولم يكن هناك تنبيه مراجعة أو عجز معلق
            if (packageAmt > 0 && remaining <= 0 && !isTargetForReview) continue; 

            activeRowsCount++;
            
            let rowBgColor = ''; 
            let comparisonHtml = '';
            
            if (packageAmt === 0) {
                rowBgColor = 'background-color: #f3f4f6; border-right: 4px solid #6b7280;'; 
                comparisonHtml = `<div style="color: #6b7280; font-size:11px; font-weight:bold;"><i class="fa-solid fa-circle-question"></i> خط غير مسعر (باقته 0 ج.م)</div>`;
            } else if (isTargetForReview) {
                // تلوين السطر باللون الأحمر التنبيهي ليبقى ظاهراً لحين اتخاذ إجراء التعديل للباقة
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
            
            // منظومة المديونية (مدين مديونية معلقة في حالة الدفع الجزئي)
            let statusHtml = '';
            if (remaining > 0) {
                statusHtml = `<span class="badge badge-red" style="font-weight:bold;"><i class="fa-solid fa-hand-holding-dollar"></i> مدين مديونية: ${remaining.toFixed(2)} ج.م</span>`;
            } else {
                statusHtml = `<span class="badge badge-green"><i class="fa-solid fa-square-check"></i> مسدد للباقة بالكامل</span>`;
            }
            statusHtml += `${comparisonHtml}`;
            
            let cancelBtn = '';
            if (paid > 0) {
                cancelBtn = `<button class="btn btn-outline" style="padding:4px 8px; color:orange; margin-right:4px;" onclick="cancelPayment('${month}', '${phone}')"><i class="fa-solid fa-rotate-left"></i> إلغاء</button>`;
            }

            const tr = document.createElement('tr');
            if (rowBgColor) tr.setAttribute('style', rowBgColor);
            
            tr.innerHTML = `
                <td>${phone}</td>
                <td><strong>${user.name}</strong></td>
                <td><strong class="text-blue">${packageAmt} ج.م</strong></td>
                <td>${invoiceAmt} ج.م</td>
                <td>${paid} ج.م</td>
                <td>${statusHtml}</td>
                <td>
                    <input type="number" id="pay-amt-${phone}" value="${remaining > 0 ? remaining.toFixed(2) : 0}" class="form-control" style="width:75px; display:inline-block; padding:4px;">
                    <button class="btn btn-green" style="padding:5px 10px;" onclick="collectCustomPayment('${month}', '${phone}', ${requiredAmount}, ${paid})">تسجيل</button>
                    <button class="btn btn-outline" style="padding:5px 10px; color:blue;" onclick="openEditModal('${phone}', '${user.name}', ${packageAmt}, '${user.ratePlan || ''}')"><i class="fa-solid fa-pen"></i> تعديل الباقة</button>
                    ${cancelBtn}
                </td>
            `;
            tbody.appendChild(tr);
        }
        
        if (activeRowsCount === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--green-success); font-weight:bold; padding:35px; font-size:16px;"><i class="fa-solid fa-square-check"></i> ممتاز! تمت تسوية كل الحسابات المتاحة ولا توجد مديونيات أو خطوط مراجعة معلقة لهذا الشهر!</td></tr>`;
        }
    });
}

// دالة الدفع الجماعي لاستثناء خطوط العجز وفارق الـ 9 جنيهات
function payAllActiveInvoices() {
    const month = document.getElementById('collection-month-select').value;
    if (!month) return alert("اختر الشهر أولاً.");
    
    if (confirm("هل تريد تسوية الحسابات الآمنة تلقائياً؟\n\n⚠️ ملاحظة: النظام سيستثني تلقائياً ويترك باللون الأحمر الحسابات التي تعاني من عجز (الفاتورة أعلى أو تساوي الباقة) أو الفارق بينهما 9 جنيهات لمراجعتها وتعديل باقتها يدوياً.")) {
        db.ref(`invoices/${month}`).once('value', snapshot => {
            const data = snapshot.val() || {};
            let updates = {};
            let skippedCount = 0;
            let processedCount = 0;

            for (let phone in data) {
                const inv = data[phone];
                const user = loadedGlobalSettings[phone] || { price: 0 };
                
                const invoiceAmt = parseFloat(inv.totalAfterTaxes) || 0;
                const packageAmt = parseFloat(user.price) || 0;
                const diffAmt = packageAmt - invoiceAmt;

                // حظر الحسابات المستهدفة بالمراجعة لتبقى باللون الأحمر ولا تختفي
                if (invoiceAmt >= packageAmt || (diffAmt >= 8.4 && diffAmt <= 9.6)) {
                    skippedCount++;
                    continue; 
                }

                const paid = inv.paidAmount || 0;
                if (paid < packageAmt) {
                    updates[`invoices/${month}/${phone}/paidAmount`] = packageAmt;
                    updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
                    processedCount++;
                }
            }

            if (Object.keys(updates).length > 0) {
                db.ref().update(updates, () => {
                    let msg = `تم تسوية وتحصيل عدد (${processedCount}) خط آمن بنجاح.`;
                    if (skippedCount > 0) {
                        msg += `\n\n⚠️ تم الإبقاء على عدد (${skippedCount}) خط باللون الأحمر لوجود عجز مالي أو فارق 9ج، لتتخذ معها إجراءً بتعديل أسعار الباقات المعتمدة.`;
                    }
                    alert(msg);
                    loadCollectionData();
                    calculateFinancialReport();
                });
            } else {
                alert(`لم يتم تحصيل أي خط جماعياً. جميع الخطوط المتبقية (${skippedCount}) مستثناة لوجود تنبيهات أسعار أو تم سدادها بالكامل سابقاً.`);
            }
        });
    }
}

// تسجيل دفع جزئي مخصص مع إبقاء المتبقي دين مدين على صاحب الخط
function collectCustomPayment(month, phone, requiredTotal, alreadyPaid) {
    const amt = parseFloat(document.getElementById(`pay-amt-${phone}`).value);
    if (isNaN(amt) || amt < 0) return alert("برجاء إدخال قيمة صحيحة وموجبة.");

    const newPaid = alreadyPaid + amt;
    const netDebt = requiredTotal - newPaid;

    db.ref(`invoices/${month}/${phone}`).update({
        paidAmount: newPaid,
        status: netDebt <= 0 ? "مدفوع بالكامل" : "مدفوع جزئياً"
    }, () => {
        if (netDebt > 0) {
            alert(`تم تسجيل دفع جزئي بقيمة (${amt} ج.م).\nالفرق المتبقي وقدره (${netDebt.toFixed(2)} ج.م) تم ترحيله وإبقائه كـ "مدين مديونية معلقة" على صاحب الخط بنجاح.`);
        } else {
            alert("تم تسوية الحساب بالكامل وإغلاق المديونية لهذا الشهر.");
        }
        loadCollectionData();
        if (document.getElementById('global-search-input').value) executeGlobalSearch();
        calculateFinancialReport();
    });
}

// ==========================================
// [5] شاشة الدفع المقدم والتحكم في الرصيد والكشوفات التلقائية
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

// التعديل المضاف: توليد كشوفات وجدولة الدفع المقدم التلقائية من الإعدادات
function generateAdvanceMonthlyBilling() {
    const month = document.getElementById('advance-month-picker').value;
    if (!month) return alert("يرجى تحديد الشهر المستهدف لتوليد الفواتير المقدمة.");

    if (Object.keys(loadedGlobalSettings).length === 0) {
        return alert("دليل المشتركين بالإعدادات فارغ! يرجى إدخال أفراد وتثبيت باقاتهم أولاً.");
    }

    db.ref(`advanceBilling/${month}`).once('value', snapshot => {
        const existingData = snapshot.val();
        if (existingData && !confirm(`كشف شهر (${month}) تم جدولته مسبقاً ولديه بيانات مخزنة بالفعل. هل تريد إضافة وإدراج الخطوط الجديدة المضافة حديثاً بالإعدادات؟`)) {
            return;
        }

        let updates = {};
        let addedCount = 0;

        for (let phone in loadedGlobalSettings) {
            if (existingData && existingData[phone]) continue; // تلافي المكرر المجدول سابقاً

            const user = loadedGlobalSettings[phone];
            updates[`advanceBilling/${month}/${phone}`] = {
                name: user.name,
                ratePlan: user.ratePlan || 'غير محدد',
                requiredAmount: parseFloat(user.price) || 0,
                paidAmount: 0,
                status: "غير مدفوع"
            };
            addedCount++;
        }

        if (addedCount > 0) {
            db.ref().update(updates, () => {
                alert(`🚀 تم بنجاح توليد وجدولة كشف الدفع المقدم لشهر (${month}) لعدد (${addedCount}) خط باشتراكاتهم المعتمدة.`);
                loadAdvanceBillingData();
            });
        } else {
            alert("جميع الأفراد المسجلين بالإعدادات مدرجون حالياً بكشف هذا الشهر، لا يوجد خطوط جديدة لإدراجها.");
        }
    });
}

function loadAdvanceBillingData() {
    const month = document.getElementById('advance-month-picker').value;
    const tbody = document.getElementById('advance-billing-tbody');
    if (!tbody) return;
    if (!month) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888; padding:20px;">يرجى تحديد الشهر لعرض الجدول</td></tr>';
        return;
    }

    db.ref(`advanceBilling/${month}`).once('value', snapshot => {
        const data = snapshot.val() || {};
        tbody.innerHTML = '';
        let count = 0;

        for (let phone in data) {
            count++;
            const item = data[phone];
            const req = parseFloat(item.requiredAmount) || 0;
            const paid = parseFloat(item.paidAmount) || 0;
            const rem = req - paid;

            let badgeHtml = '';
            if (rem <= 0) {
                badgeHtml = '<span class="badge badge-green"><i class="fa-solid fa-square-check"></i> مدفوع بالكامل</span>';
            } else if (paid > 0) {
                badgeHtml = `<span class="badge badge-orange"><i class="fa-solid fa-circle-notch fa-spin"></i> دفع جزئي (متبقي: ${rem.toFixed(2)})</span>`;
            } else {
                badgeHtml = '<span class="badge badge-red"><i class="fa-solid fa-hand-holding-dollar"></i> لم يتم الدفع</span>';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>${phone}</td>
                <td>${item.ratePlan}</td>
                <td><strong class="text-blue">${req.toFixed(2)} ج.م</strong></td>
                <td>${paid.toFixed(2)} ج.م</td>
                <td>${badgeHtml}</td>
                <td>
                    <input type="number" id="adv-pay-amt-${phone}" value="${rem > 0 ? rem.toFixed(2) : 0}" class="form-control" style="width:75px; display:inline-block; padding:4px; margin-left:4px;">
                    <button class="btn btn-green" style="padding:5px 10px; font-size:12px;" onclick="collectAdvanceBillingPayment('${month}', '${phone}', ${req}, ${paid}, false)">جزئي</button>
                    <button class="btn btn-red" style="padding:5px 10px; font-size:12px;" onclick="collectAdvanceBillingPayment('${month}', '${phone}', ${req}, ${paid}, true)">كلي</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

        if (count === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red; font-weight:bold; padding:25px;"><i class="fa-solid fa-triangle-exclamation"></i> لا يوجد أي كشف تم توليده لشهر البحث الحالي. اضغط زر التوليد السحري بالأعلى لبنائه.</td></tr>';
        }
    });
}

function filterAdvanceBillingTable() {
    const filter = document.getElementById('advance-billing-search').value.toLowerCase();
    const rows = document.querySelectorAll('#advance-billing-table tbody tr');
    rows.forEach(row => {
        if(row.cells.length > 1) {
            row.style.display = row.innerText.toLowerCase().includes(filter) ? '' : 'none';
        }
    });
}

function collectAdvanceBillingPayment(month, phone, req, alreadyPaid, isFullPayment) {
    let amtToPay = 0;
    if (isFullPayment) {
        amtToPay = req - alreadyPaid;
    } else {
        amtToPay = parseFloat(document.getElementById(`adv-pay-amt-${phone}`).value);
    }

    if (isNaN(amtToPay) || amtToPay <= 0) return alert("برجاء إدخال قيمة سداد صحيحة وموجبة.");

    const finalPaid = alreadyPaid + amtToPay;
    const status = finalPaid >= req ? "مدفوع بالكامل" : "مدفوع جزئياً";

    db.ref(`advanceBilling/${month}/${phone}`).update({
        paidAmount: finalPaid,
        status: status
    }, () => {
        alert("تم بنجاح تسجيل وتحصيل عملية الدفع المقدم للخط.");
        loadAdvanceBillingData();
    });
}

// ==========================================
// [6] شاشة البحث الشامل وحفظ الحسابات الإضافية والتقرير المالي المحترف
// ==========================================
function saveExtraFinancials() {
    const selectedMonth = document.getElementById('search-month-select').value;
    if (!selectedMonth || selectedMonth === 'all') {
        return alert("⚠️ يرجى اختيار شهر محدد من القائمة لحفظ المدخلات اليدوية الخاصة به. لا يمكن الحفظ على وضع 'كل الأشهر'.");
    }

    const manualInvoiceInput = parseFloat(document.getElementById('manual-invoice-input').value) || 0;
    const additionalRevenue = parseFloat(document.getElementById('additional-revenue-input').value) || 0;
    const additionalExpenses = parseFloat(document.getElementById('additional-expenses-input').value) || 0;

    db.ref(`extraFinancials/${selectedMonth}`).set({
        manualInvoice: manualInvoiceInput,
        additionalRevenue: additionalRevenue,
        additionalExpenses: additionalExpenses
    }, (error) => {
        if (error) {
            alert("حدث خطأ أثناء حفظ البيانات المالية!");
        } else {
            alert(`✨ تم بنجاح حفظ الإيرادات والمصاريف المضافة لشهر (${selectedMonth}) وتثبيت الأرباح بقاعدة البيانات.`);
            calculateFinancialReport();
        }
    });
}

function loadExtraFinancialsForSelectedMonth() {
    const selectedMonth = document.getElementById('search-month-select').value;
    
    if (!selectedMonth || selectedMonth === 'all') {
        document.getElementById('manual-invoice-input').value = 0;
        document.getElementById('additional-revenue-input').value = 0;
        document.getElementById('additional-expenses-input').value = 0;
        calculateFinancialReport();
        return;
    }

    db.ref(`extraFinancials/${selectedMonth}`).once('value', snapshot => {
        const extra = snapshot.val() || { manualInvoice: 0, additionalRevenue: 0, additionalExpenses: 0 };
        
        document.getElementById('manual-invoice-input').value = extra.manualInvoice || 0;
        document.getElementById('additional-revenue-input').value = extra.additionalRevenue || 0;
        document.getElementById('additional-expenses-input').value = extra.additionalExpenses || 0;
        
        calculateFinancialReport();
    });
}

function calculateFinancialReport() {
    const selectedMonth = document.getElementById('search-month-select').value;
    const reportResults = document.getElementById('financial-report-results');
    if (!reportResults) return;

    db.ref('invoices').once('value', snapshot => {
        const allInvoices = snapshot.val() || {};
        
        let totalExcelInvoices = 0;
        let totalApprovedPackages = 0;

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

        const manualInvoiceInput = parseFloat(document.getElementById('manual-invoice-input').value) || 0;
        const additionalRevenue = parseFloat(document.getElementById('additional-revenue-input').value) || 0;
        const additionalExpenses = parseFloat(document.getElementById('additional-expenses-input').value) || 0;

        const finalTotalPackages = totalApprovedPackages + additionalRevenue;
        const finalTotalInvoice = totalExcelInvoices + additionalExpenses;
        const netProfit = finalTotalPackages - finalTotalInvoice;

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

        reportResults.innerHTML = `
            <div style="background: #ffffff; padding: 15px; border-radius: 8px; border-right: 5px solid #2563eb; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <span style="font-size: 11px; color: #666; display: block; font-weight: bold;">إجمالي الباقات المسعرة (+ إيراد إضافي)</span>
                <strong style="font-size: 18px; color: #2563eb; display:block; margin-top:5px;">${finalTotalPackages.toFixed(2)} ج.م</strong>
                <small style="font-size: 10px; color:#888;">الأساسي من الدليل: ${totalApprovedPackages.toFixed(2)}</small>
            </div>
            <div style="background: #ffffff; padding: 15px; border-radius: 8px; border-right: 5px solid #dc2626; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <span style="font-size: 11px; color: #666; display: block; font-weight: bold;">إجمالي فواتير فودافون المرفوعة (+ مصاريف)</span>
                <strong style="font-size: 18px; color: #dc2626; display:block; margin-top:5px;">${finalTotalInvoice.toFixed(2)} ج.م</strong>
                <small style="font-size: 10px; color:#888;">من ملف إكسيل: ${totalExcelInvoices.toFixed(2)}</small>
                ${comparisonBadge}
            </div>
            <div style="background: ${netProfit >= 0 ? '#f0fdf4' : '#fef2f2'}; padding: 15px; border-radius: 8px; border-right: 5px solid ${netProfit >= 0 ? '#16a34a' : '#dc2626'}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <span style="font-size: 11px; color: #666; display: block; font-weight: bold;">صافي أرباح الحساب التراكمية</span>
                <strong style="font-size: 21px; color: ${netProfit >= 0 ? '#16a34a' : '#dc2626'}; display:block; margin-top:3px;">${netProfit.toFixed(2)} ج.م</strong>
                <span style="font-size: 10px; font-weight:bold; color: ${netProfit >= 0 ? '#16a34a' : '#dc2626'};">${netProfit >= 0 ? '📈 صافي ربح إيجابي' : '📉 عجز مالي بالخلفية'}</span>
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
                    <h3><i class="fa-solid fa-id-card text-red"></i> المشترك: ${user.name}</h3>
                    <div>
                        <button class="btn btn-outline" style="color:blue; padding:5px 10px; margin-left:5px;" onclick="openEditModal('${phone}', '${user.name}', ${user.price}, '${user.ratePlan}')"><i class="fa-solid fa-pen"></i> تعديل البيانات</button>
                        <button class="btn btn-outline" style="color:red; padding:5px 10px;" onclick="deleteUser('${phone}')"><i class="fa-solid fa-trash"></i> حذف</button>
                    </div>
                </div>
                <p><strong>رقم الموبايل:</strong> ${phone} | <strong>الخطة الأساسية:</strong> ${user.ratePlan || 'غير مححدد'} | <strong>سعر الباقة المعتمد للدفع:</strong> <span class="text-green">${user.price} ج.م</span></p>
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
                    <span style="font-size: 13px; color: #555; display: block;">إجمالي قيمة الباقات المعتمدة للمشتركين الظاهرين بالبحث الحالية (${matchedCount} خطوط):</span>
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
                const remaining = user.price - (inv.paidAmount || 0);
                
                let statusBadge = '';
                let cancelBtnHtml = '';

                if (remaining <= 0) {
                    statusBadge = '<span class="badge badge-green">تم سداد الباقة بالكامل</span>';
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
                        <td>${user.price} ج.م (الباقة)</td>
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
                <h4 style="font-size:13px; margin-bottom:5px; color:#555;">سجل مطالبات باقة الحساب:</h4>
                <table style="width:100%; font-size:12px;">
                    <thead>
                        <tr>
                            <th>الشهر المالي</th>
                            <th>قيمة الباقة المعتمدة</th>
                            <th>المبلغ المدفوع فعلياً</th>
                            <th>حالة السداد للعميل</th>
                            <th style="text-align: center;">إجراءات إلغاء السداد</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        }
    });
}

function cancelPayment(month, phone) {
    if (confirm(`هل أنت متأكد من إلغاء سداد فاتورة الرقم (${phone}) لشهر (${month})؟ سيتم تصفير المبلغ المدفوع وإعادة الحساب لوضع الاستحقاق المعلق للباقة.`)) {
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

// ==========================================
// [7] التعديل المضاف: شاشة كشف حساب المشتركين المعمق
// ==========================================
function executeCustomerStatement() {
    const filter = document.getElementById('statement-search-input').value.trim().toLowerCase();
    if (!filter) return alert("برجاء كتابة الاسم أو رقم الموبايل المطلوب تتبع كشف حسابه.");

    let targetPhone = null;
    let targetName = "";

    for (let phone in loadedGlobalSettings) {
        if (phone === filter || loadedGlobalSettings[phone].name.toLowerCase().includes(filter)) {
            targetPhone = phone;
            targetName = loadedGlobalSettings[phone].name;
            break;
        }
    }

    if (!targetPhone) {
        document.getElementById('statement-results-wrapper').style.display = 'none';
        return alert("لم يتم العثور على أي مشترك مطابق لبيانات البحث!");
    }

    document.getElementById('stmt-user-name').innerText = targetName;
    document.getElementById('stmt-user-phone').innerText = "رقم الهاتف المسجل: " + targetPhone;
    document.getElementById('statement-results-wrapper').style.display = 'block';

    // 1. استخراج رصيد محفظة الإيداع المسبق
    db.ref('advancePayments/' + targetPhone).once('value', walletSnapshot => {
        const walletBalance = walletSnapshot.val() || 0;
        document.getElementById('stmt-wallet-balance').innerText = walletBalance.toFixed(2) + " ج.م";

        // 2. استخراج وفحص مديونيات فواتير إكسيل
        db.ref('invoices').once('value', invSnapshot => {
            const allInvoices = invSnapshot.val() || {};
            const invTbody = document.getElementById('stmt-invoices-tbody');
            invTbody.innerHTML = '';
            
            let totalExcelDebt = 0;

            for (let m in allInvoices) {
                if (allInvoices[m][targetPhone]) {
                    const inv = allInvoices[m][targetPhone];
                    const userPrice = loadedGlobalSettings[targetPhone]?.price || 0;
                    const paid = inv.paidAmount || 0;
                    const rem = userPrice - paid;
                    
                    if (rem > 0) totalExcelDebt += rem;

                    let badge = rem <= 0 ? '<span class="badge badge-green">مسدد بالكامل</span>' : `<span class="badge badge-red">متبقي مديونية: ${rem.toFixed(2)} ج.م</span>`;
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${m}</td>
                        <td>${(inv.totalAfterTaxes || 0).toFixed(2)} ج.م</td>
                        <td>${userPrice.toFixed(2)} ج.m</td>
                        <td>${paid.toFixed(2)} ج.م</td>
                        <td>${badge}</td>
                    `;
                    invTbody.appendChild(tr);
                }
            }
            if (invTbody.innerHTML === '') {
                invTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:10px;">لا توجد فواتير إكسيل مرفوعة لهذا الخط سابقاً</td></tr>';
            }

            // 3. استخراج وفحص سجل وجدولة كشوفات الدفع المقدم التلقائية لشهور النظام
            db.ref('advanceBilling').once('value', advSnapshot => {
                const allAdvBilling = advSnapshot.val() || {};
                const advTbody = document.getElementById('stmt-advance-tbody');
                advTbody.innerHTML = '';
                
                let totalAdvanceDebt = 0;

                for (let m in allAdvBilling) {
                    if (allAdvBilling[m][targetPhone]) {
                        const advItem = allAdvBilling[m][targetPhone];
                        const req = parseFloat(advItem.requiredAmount) || 0;
                        const paid = parseFloat(advItem.paidAmount) || 0;
                        const rem = req - paid;

                        if (rem > 0) totalAdvanceDebt += rem;

                        let badge = rem <= 0 ? '<span class="badge badge-green">مدفوع بالكامل</span>' : `<span class="badge badge-red">متبقي عجز: ${rem.toFixed(2)} ج.م</span>`;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${m}</td>
                            <td>${req.toFixed(2)} ج.م</td>
                            <td>${paid.toFixed(2)} ج.م</td>
                            <td>${rem.toFixed(2)} ج.م</td>
                            <td>${badge}</td>
                        `;
                        advTbody.appendChild(tr);
                    }
                }
                if (advTbody.innerHTML === '') {
                    advTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#999; padding:10px;">لا يوجد سجل مطالبات دفع مقدم مجدول لهذا الخط</td></tr>';
                }

                // 4. تجميع الموقف المالي وتحديد الحالة النهائية بوضوح (عليه مبالغ أم دفع مقدم)
                const totalSystemDebt = totalExcelDebt + totalAdvanceDebt;
                const finalFinancialPosition = walletBalance - totalSystemDebt;

                const statusCard = document.getElementById('stmt-status-card');
                const netStatusText = document.getElementById('stmt-net-status');
                const badgeContainer = document.getElementById('stmt-status-badge');

                if (finalFinancialPosition === 0) {
                    statusCard.style.borderRightColor = "#6b7280";
                    netStatusText.style.color = "#333333";
                    netStatusText.innerText = "0.00 ج.م";
                    badgeContainer.innerHTML = '<span class="badge" style="background:#e5e7eb; color:#374151;"><i class="fa-solid fa-scale-balanced"></i> الحساب متزن ومصفي بالكامل</span>';
                } else if (finalFinancialPosition > 0) {
                    statusCard.style.borderRightColor = "var(--green-success)";
                    netStatusText.style.color = "var(--green-success)";
                    netStatusText.innerText = ` له رصيد: +${finalFinancialPosition.toFixed(2)} ج.م`;
                    badgeContainer.innerHTML = '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> يمتلك دفع مقدم / فائض رصيد بمحفظته</span>';
                } else {
                    statusCard.style.borderRightColor = "var(--primary-color)";
                    netStatusText.style.color = "var(--primary-color)";
                    netStatusText.innerText = ` عليه مبالغ: ${finalFinancialPosition.toFixed(2)} ج.م`;
                    badgeContainer.innerHTML = `<span class="badge badge-red"><i class="fa-solid fa-triangle-exclamation"></i> العميل مدين ومطالب بسداد عجز مستحق مالي</span>`;
                }
            });
        });
    });
}

// ==========================================
// [8] النوافذ المنبثقة (Modals) لتعديل وحفظ بيانات العميل
// ==========================================
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
        loadCollectionData(); 
        if(document.getElementById('global-search-input').value) executeGlobalSearch();
        calculateFinancialReport();
    });
}
