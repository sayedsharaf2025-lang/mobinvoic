// ==========================================
// تكوين Firebase (تم تعبئته بالفعل)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBfFRxvmhg8aqtuDgXAOofFGpVPklUF-gs",
    authDomain: "mobile-invoic-118d4.firebaseapp.com",
    databaseURL: "https://mobile-invoic-118d4-default-rtdb.firebaseio.com",
    projectId: "mobile-invoic-118d4",
    storageBucket: "mobile-invoic-118d4.firebasestorage.app",
    messagingSenderId: "795305971254",
    appId: "1:795305971254:web:7e8e874cfd805d33ec1297"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let loadedGlobalSettings = {};
let loadedAdvancePayments = {};
let currentParsedInvoice = [];
let currentStatementPhone = "";
let editTargetMonth = "";

// أدوات مساعدة
function formatPhone(num) {
    let s = num.toString().trim();
    if (s.length === 10 && (s.startsWith('1') || s.startsWith('2') || s.startsWith('5'))) s = '0' + s;
    return s;
}
function addPaymentLog(phone, month, amount, type) {
    let user = loadedGlobalSettings[phone] || { name: phone };
    db.ref('paymentHistory').push({
        phone, name: user.name, month, amount, type,
        date: new Date().toLocaleString('ar-EG'), timestamp: Date.now()
    });
}
// مزامنة البيانات
function syncSettings() {
    db.ref('settings').on('value', snap => { loadedGlobalSettings = snap.val() || {}; loadSettingsTable(); calculateFinancialReport(); });
}
function syncAdvance() {
    db.ref('advancePayments').on('value', snap => { loadedAdvancePayments = snap.val() || {}; });
}
function updateDropdowns() {
    db.ref('invoices').once('value', snap => {
        let months = Object.keys(snap.val() || {});
        ['delete-invoice-month-select', 'collection-month-select', 'export-month-select', 'search-month-select'].forEach(id => {
            let sel = document.getElementById(id);
            if (sel) {
                sel.innerHTML = '<option value="">اختر شهر</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
                if (id === 'search-month-select') sel.innerHTML = '<option value="all">كل الأشهر</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
            }
        });
        loadExtraFinancialsForSelectedMonth();
    });
}

// ========== 1. إدارة الفواتير ==========
function generateMonthlyInvoicesFromSettings() {
    let month = document.getElementById('invoice-month-select').value;
    if (!month) return alert("اختر الشهر");
    let phones = Object.keys(loadedGlobalSettings);
    if (!phones.length) return alert("لا يوجد مشتركين");
    let updates = {};
    phones.forEach(phone => {
        let u = loadedGlobalSettings[phone];
        updates[`invoices/${month}/${phone}`] = {
            ratePlan: u.ratePlan || '', packagePrice: u.price || 0,
            totalAfterTaxes: 0, paidAmount: 0, status: "غير مدفوع"
        };
    });
    db.ref().update(updates, () => { alert(`تم توليد كشوفات شهر ${month}`); updateDropdowns(); loadCollectionData(); });
}
function handleInvoiceImport(e) {
    let file = e.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = ev => {
        let data = new Uint8Array(ev.target.result);
        let wb = XLSX.read(data, { type: 'array' });
        let ws = wb.Sheets[wb.SheetNames[0]];
        processExcelData(XLSX.utils.sheet_to_json(ws));
    };
    reader.readAsArrayBuffer(file);
}
function processExcelData(rows) {
    currentParsedInvoice = [];
    let tbody = document.querySelector('#invoice-preview-table tbody');
    tbody.innerHTML = '';
    rows.forEach(row => {
        let phone = formatPhone(row['Mobile Number'] || row['رقم الهاتف'] || '');
        let ratePlan = row['Rate Plan'] || row['نظام الحساب'] || '';
        let totalTaxes = parseFloat(row['Total After Taxes'] || row['الاجمالي بعد الضريبة'] || 0);
        if (phone) {
            currentParsedInvoice.push({ phone, ratePlan, totalTaxes });
            let user = loadedGlobalSettings[phone];
            tbody.innerHTML += `<tr><td>${phone}</td><td>${ratePlan}</td><td>${totalTaxes.toFixed(2)}</td><td>${user ? `مسجل: ${user.name}` : 'رقم جديد'}</td></tr>`;
        }
    });
    if (currentParsedInvoice.length) document.getElementById('invoice-preview-card').style.display = 'block';
}
function saveProcessedInvoice() {
    let month = document.getElementById('invoice-month-select').value;
    if (!month || !currentParsedInvoice.length) return alert("اختر الشهر وارفع ملف");
    db.ref(`invoices/${month}`).once('value', snap => {
        let invs = snap.val() || {};
        let updates = {};
        currentParsedInvoice.forEach(item => {
            if (!loadedGlobalSettings[item.phone])
                db.ref('settings/' + item.phone).set({ name: "بدون اسم", price: 0, ratePlan: item.ratePlan });
            let pkg = loadedGlobalSettings[item.phone]?.price || 0;
            let adv = loadedAdvancePayments[item.phone] || 0;
            let paid = 0, status = "غير مدفوع";
            if (adv > 0 && pkg > 0) {
                if (adv >= pkg) { paid = pkg; adv -= pkg; status = "مدفوع بالكامل"; }
                else { paid = adv; adv = 0; status = "مدفوع جزئياً"; }
                db.ref('advancePayments/' + item.phone).set(adv);
                loadedAdvancePayments[item.phone] = adv;
            }
            if (invs[item.phone]) {
                updates[`invoices/${month}/${item.phone}/totalAfterTaxes`] = item.totalTaxes;
                updates[`invoices/${month}/${item.phone}/ratePlan`] = item.ratePlan;
            } else {
                updates[`invoices/${month}/${item.phone}`] = {
                    ratePlan: item.ratePlan, totalAfterTaxes: item.totalTaxes,
                    packagePrice: pkg, paidAmount: paid, status
                };
            }
        });
        db.ref().update(updates, () => {
            alert("تم اعتماد الفاتورة");
            currentParsedInvoice = [];
            document.getElementById('invoice-preview-card').style.display = 'none';
            updateDropdowns();
            calculateFinancialReport();
        });
    });
}
function deleteStoredInvoice() {
    let month = document.getElementById('delete-invoice-month-select').value;
    if (month && confirm("حذف الشهر؟")) db.ref(`invoices/${month}`).remove(() => { updateDropdowns(); loadCollectionData(); });
}

// ========== 2. شاشة التحصيل والإلغاء ==========
function loadCollectionData() {
    let month = document.getElementById('collection-month-select').value;
    let tbody = document.getElementById('collection-table-body');
    if (!month || !tbody) return;
    document.getElementById('collection-search-input').value = '';
    db.ref(`invoices/${month}`).once('value', snap => {
        let invs = snap.val() || {};
        tbody.innerHTML = '';
        for (let phone in invs) {
            let inv = invs[phone];
            let user = loadedGlobalSettings[phone] || { name: "بدون اسم", price: 0 };
            let paid = inv.paidAmount || 0;
            let pkg = inv.packagePrice !== undefined ? inv.packagePrice : user.price;
            let remaining = pkg - paid;
            let invoiceAmt = inv.totalAfterTaxes || 0;
            let diff = pkg - invoiceAmt;
            let isTarget = (invoiceAmt >= pkg || (diff >= 8.4 && diff <= 9.6));
            let fullyPaidSafe = (pkg > 0 && remaining <= 0 && !isTarget);
            let tr = document.createElement('tr');
            tr.dataset.fullyPaid = fullyPaidSafe ? '1' : '0';
            if (fullyPaidSafe) tr.style.display = 'none';
            let statusHtml = remaining > 0 ? `<span class="badge-red">مديونية: ${remaining.toFixed(2)}</span>` : `<span class="badge-green">مسدد</span>`;
            if (isTarget) statusHtml += `<div style="color:#dc2626;">⚠️ مراجعة الفارق</div>`;
            tr.innerHTML = `
                <td>${phone}</td><td>${user.name}</td><td>${pkg.toFixed(2)}</td>
                <td>${invoiceAmt.toFixed(2)}</td><td>${paid.toFixed(2)}</td><td>${statusHtml}</td>
                <td><input type="number" id="pay-amt-${phone}" value="${remaining > 0 ? remaining : 0}" style="width:70px;">
                <button class="btn btn-green" style="padding:4px 8px;" onclick="collectCustomPayment('${month}','${phone}',${pkg},${paid})">تسجيل</button>
                <button class="btn btn-outline" onclick="openEditModal('${phone}','${user.name}',${pkg},'${user.ratePlan || ''}','${month}')">تعديل</button>
                ${paid > 0 ? `<button class="btn btn-outline" onclick="cancelPayment('${month}','${phone}')">إلغاء</button>` : ''}
            `;
            tbody.appendChild(tr);
        }
        if (tbody.children.length === 0) tbody.innerHTML = '<tr><td colspan="7">لا توجد بيانات</td></tr>';
    });
}
function collectCustomPayment(month, phone, required, alreadyPaid) {
    let amt = parseFloat(document.getElementById(`pay-amt-${phone}`).value);
    if (isNaN(amt) || amt <= 0) return alert("أدخل مبلغاً صحيحاً");
    let newPaid = alreadyPaid + amt;
    let status = newPaid >= required ? "مدفوع بالكامل" : "مدفوع جزئياً";
    db.ref(`invoices/${month}/${phone}`).update({ paidAmount: newPaid, status }, () => {
        loadCollectionData();
        calculateFinancialReport();
        addPaymentLog(phone, month, amt, "تحصيل");
    });
}
function cancelPayment(month, phone) {
    db.ref(`invoices/${month}/${phone}`).once('value', snap => {
        let inv = snap.val();
        if (!inv || inv.paidAmount <= 0) return alert("لا يوجد سداد للإلغاء");
        let currentPaid = inv.paidAmount;
        let packageAmt = inv.packagePrice || 0;
        let amt = prompt(`المبلغ المراد إلغاؤه من ${currentPaid.toFixed(2)} ج.م (اتركه فارغاً للإلغاء الكامل)`, currentPaid);
        if (amt === null) return;
        let cancelAmt = amt === '' ? currentPaid : parseFloat(amt);
        if (isNaN(cancelAmt) || cancelAmt <= 0 || cancelAmt > currentPaid) return alert("مبلغ غير صحيح");
        let newPaid = currentPaid - cancelAmt;
        let status = "غير مدفوع";
        if (newPaid > 0 && newPaid < packageAmt) status = "مدفوع جزئياً";
        else if (newPaid >= packageAmt) status = "مدفوع بالكامل";
        db.ref(`invoices/${month}/${phone}`).update({ paidAmount: newPaid, status }, () => {
            loadCollectionData();
            calculateFinancialReport();
            addPaymentLog(phone, month, cancelAmt, "إلغاء سداد");
        });
    });
}
function payAllActiveInvoices() {
    let month = document.getElementById('collection-month-select').value;
    if (!month) return;
    db.ref(`invoices/${month}`).once('value', snap => {
        let updates = {}, count = 0;
        for (let phone in snap.val()) {
            let inv = snap.val()[phone];
            let pkg = inv.packagePrice || 0;
            let invoiceAmt = inv.totalAfterTaxes || 0;
            let diff = pkg - invoiceAmt;
            let needReview = (invoiceAmt >= pkg || (diff >= 8.4 && diff <= 9.6));
            if (!needReview && (inv.paidAmount || 0) < pkg) {
                updates[`invoices/${month}/${phone}/paidAmount`] = pkg;
                updates[`invoices/${month}/${phone}/status`] = "مدفوع بالكامل";
                count++;
            }
        }
        db.ref().update(updates, () => { alert(`تم تحصيل ${count} مشترك آمن`); loadCollectionData(); });
    });
}
function filterCollectionTable() {
    let q = document.getElementById('collection-search-input').value.trim().toLowerCase();
    document.querySelectorAll('#collection-table-body tr').forEach(row => {
        if (!q) row.style.display = row.dataset.fullyPaid === '1' ? 'none' : '';
        else row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ========== 3. الدفع المقدم والمحفظة ==========
function searchForAdvance() {
    let phone = formatPhone(document.getElementById('advance-search-input').value);
    if (!loadedGlobalSettings[phone]) return alert("غير موجود");
    document.getElementById('advance-user-name').innerText = loadedGlobalSettings[phone].name;
    document.getElementById('advance-user-phone').innerText = phone;
    document.getElementById('current-advance-balance').innerText = (loadedAdvancePayments[phone] || 0).toFixed(2);
    document.getElementById('advance-profile-card').style.display = 'block';
    window.curAdvPhone = phone;
}
function saveAdvancePayment() {
    let phone = window.curAdvPhone;
    let amt = parseFloat(document.getElementById('new-advance-amount').value);
    if (!phone || isNaN(amt) || amt <= 0) return;
    let newBal = (loadedAdvancePayments[phone] || 0) + amt;
    db.ref(`advancePayments/${phone}`).set(newBal, () => {
        alert("تم الشحن");
        searchForAdvance();
        addPaymentLog(phone, "-", amt, "شحن محفظة");
    });
}
function generateDetailedStatement() {
    let inp = document.getElementById('statement-search-input').value.trim();
    let targetPhone = null, targetUser = null;
    for (let p in loadedGlobalSettings) {
        if (p === inp || loadedGlobalSettings[p].name.includes(inp)) {
            targetPhone = p;
            targetUser = loadedGlobalSettings[p];
            break;
        }
    }
    if (!targetPhone) return alert("لم يجد");
    currentStatementPhone = targetPhone;
    db.ref('invoices').once('value', snap => {
        let all = snap.val() || {};
        let tbody = document.getElementById('statement-table-body');
        tbody.innerHTML = '';
        let totalReq = 0, totalPaid = 0, totalDebt = 0;
        for (let m in all) {
            if (all[m][targetPhone]) {
                let inv = all[m][targetPhone];
                let pkg = inv.packagePrice || 0;
                let paid = inv.paidAmount || 0;
                let debt = pkg - paid;
                totalReq += pkg; totalPaid += paid; totalDebt += debt;
                tbody.innerHTML += `<tr><td>${m}</td><td>${inv.ratePlan || ''}</td><td>${pkg.toFixed(2)}</td><td>${(inv.totalAfterTaxes || 0).toFixed(2)}</td><td>${paid.toFixed(2)}</td><td>${debt.toFixed(2)}</td><td>${debt <= 0 ? 'مدفوع' : 'مدين'}</td></tr>`;
            }
        }
        document.getElementById('statement-client-name').innerHTML = `الاسم: ${targetUser.name}`;
        document.getElementById('statement-client-phone').innerHTML = `الرقم: ${targetPhone}`;
        document.getElementById('statement-total-required').innerHTML = `${totalReq.toFixed(2)} ج.م`;
        document.getElementById('statement-total-paid').innerHTML = `${totalPaid.toFixed(2)} ج.م`;
        document.getElementById('statement-total-debt').innerHTML = `${totalDebt.toFixed(2)} ج.م`;
        let wallet = loadedAdvancePayments[targetPhone] || 0;
        document.getElementById('statement-wallet-balance').innerHTML = `${wallet.toFixed(2)} ج.م`;
        document.getElementById('statement-settle-btn').style.display = (totalDebt > 0 && wallet > 0) ? 'inline-flex' : 'none';
        document.getElementById('statement-output-area').style.display = 'block';
    });
}
function settleStatementDebtsWithWallet() {
    let phone = currentStatementPhone;
    let wallet = loadedAdvancePayments[phone] || 0;
    if (wallet <= 0) return;
    db.ref('invoices').once('value', snap => {
        let all = snap.val() || {};
        let updates = {};
        let remaining = wallet;
        for (let m in all) {
            if (all[m][phone] && remaining > 0) {
                let inv = all[m][phone];
                let pkg = inv.packagePrice || 0;
                let paid = inv.paidAmount || 0;
                let debt = pkg - paid;
                if (debt > 0) {
                    let pay = Math.min(debt, remaining);
                    let newPaid = paid + pay;
                    remaining -= pay;
                    updates[`invoices/${m}/${phone}/paidAmount`] = newPaid;
                    updates[`invoices/${m}/${phone}/status`] = newPaid >= pkg ? "مدفوع بالكامل" : "مدفوع جزئياً";
                    addPaymentLog(phone, m, pay, "سداد من المحفظة");
                }
            }
        }
        updates[`advancePayments/${phone}`] = remaining;
        db.ref().update(updates, () => {
            alert("تم التسوية من المحفظة");
            generateDetailedStatement();
            calculateFinancialReport();
        });
    });
}

// ========== 4. دليل الأفراد والإعدادات ==========
function loadSettingsTable() {
    let tbody = document.getElementById('settings-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (let p in loadedGlobalSettings) {
        let u = loadedGlobalSettings[p];
        tbody.innerHTML += `<tr><td>${u.name}</td><td>${p}</td><td>${u.price}</td><td>${u.ratePlan || ''}</td>
        <td><button class="btn btn-outline" onclick="openEditModal('${p}','${u.name}',${u.price},'${u.ratePlan || ''}','')">تعديل</button>
        <button class="btn btn-red" onclick="deleteUser('${p}')">حذف</button></td></tr>`;
    }
}
function addNewUserFromSettings() {
    let name = document.getElementById('new-user-name').value;
    let phone = formatPhone(document.getElementById('new-user-phone').value);
    let price = parseFloat(document.getElementById('new-user-price').value);
    let plan = document.getElementById('new-user-plan').value;
    if (!name || !phone) return;
    db.ref('settings/' + phone).set({ name, price, ratePlan: plan }, () => {
        alert("تم");
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-phone').value = '';
        document.getElementById('new-user-price').value = '';
        document.getElementById('new-user-plan').value = '';
    });
}
function deleteUser(phone) { if (confirm("حذف؟")) db.ref('settings/' + phone).remove(); }
function filterSettingsTable() {
    let q = document.getElementById('settings-table-search').value.toLowerCase();
    document.querySelectorAll('#settings-table-body tr').forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}
function openEditModal(phone, name, price, plan, month) {
    editTargetMonth = month;
    document.getElementById('edit-phone').value = phone;
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-plan').value = plan;
    let hintDiv = document.getElementById('edit-month-hint');
    if (month) {
        hintDiv.innerHTML = `سيتم تحديث الباقة في شهر ${month} والإعدادات`;
        hintDiv.style.display = 'block';
    } else hintDiv.style.display = 'none';
    document.getElementById('editClientModal').style.display = 'flex';
}
function closeEditModal() { editTargetMonth = ''; document.getElementById('editClientModal').style.display = 'none'; }
function saveClientEdits() {
    let phone = document.getElementById('edit-phone').value;
    let name = document.getElementById('edit-name').value;
    let price = parseFloat(document.getElementById('edit-price').value);
    let plan = document.getElementById('edit-plan').value;
    let updates = {};
    updates[`settings/${phone}/name`] = name;
    updates[`settings/${phone}/price`] = price;
    updates[`settings/${phone}/ratePlan`] = plan;
    if (editTargetMonth) {
        updates[`invoices/${editTargetMonth}/${phone}/packagePrice`] = price;
        updates[`invoices/${editTargetMonth}/${phone}/ratePlan`] = plan;
    }
    db.ref().update(updates, () => {
        alert("تم التحديث");
        closeEditModal();
        loadSettingsTable();
        if (editTargetMonth) loadCollectionData();
        calculateFinancialReport();
    });
}
function handleSettingsImport(e) {
    let file = e.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = ev => {
        let wb = XLSX.read(ev.target.result, { type: 'binary' });
        let ws = wb.Sheets[wb.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(ws);
        rows.forEach(row => {
            let phone = formatPhone(row['الرقم'] || row['رقم الهاتف'] || '');
            let name = row['الاسم'] || row['اسم المشترك'];
            let price = parseFloat(row['سعر الباقة'] || 0);
            let plan = row['خطة الاسعار'] || '';
            if (phone && name) db.ref('settings/' + phone).set({ name, price, ratePlan: plan });
        });
        alert("تم الاستيراد");
    };
    reader.readAsBinaryString(file);
}

// ========== 5. التقارير المالية ==========
function calculateFinancialReport() {
    db.ref('invoices').once('value', async snap => {
        let totalPkg = 0, totalInv = 0, totalPaid = 0;
        snap.forEach(m => {
            Object.values(m.val() || {}).forEach(inv => {
                totalPkg += inv.packagePrice || 0;
                totalInv += inv.totalAfterTaxes || 0;
                totalPaid += inv.paidAmount || 0;
            });
        });
        let extra = (await db.ref('extraFinancials/summaryData').once('value')).val() || {};
        let net = (totalPkg + (extra.additionalRevenue || 0)) - (totalInv + (extra.additionalExpenses || 0));
        document.getElementById('financial-report-results').innerHTML = `
            <div class="card">إجمالي الباقات: ${totalPkg.toFixed(2)}</div>
            <div class="card">تكلفة فودافون: ${totalInv.toFixed(2)}</div>
            <div class="card">التحصيل: ${totalPaid.toFixed(2)}</div>
            <div class="card">صافي الربح: ${net.toFixed(2)}</div>`;
        let monthly = {};
        snap.forEach(m => {
            let p = 0, i = 0, pa = 0;
            Object.values(m.val() || {}).forEach(inv => {
                p += inv.packagePrice || 0;
                i += inv.totalAfterTaxes || 0;
                pa += inv.paidAmount || 0;
            });
            monthly[m.key] = { pack: p, actual: i, paid: pa };
        });
        let monthlyHtml = '';
        for (let [m, d] of Object.entries(monthly))
            monthlyHtml += `<tr><td>${m}</td><td>${d.pack.toFixed(2)}</td><td>${d.actual.toFixed(2)}</td><td>${d.paid.toFixed(2)}</td><td>${(d.paid - d.actual).toFixed(2)}</td></tr>`;
        document.getElementById('monthly-reports-table').innerHTML = monthlyHtml;
        document.getElementById('reports-cards').innerHTML = `
            <div class="card">إجمالي الباقات: ${totalPkg.toFixed(2)}</div>
            <div class="card">التكلفة: ${totalInv.toFixed(2)}</div>
            <div class="card">التحصيل: ${totalPaid.toFixed(2)}</div>
            <div class="card">الربح: ${net.toFixed(2)}</div>`;
    });
}
function executeGlobalSearch() {
    let q = document.getElementById('global-search-input').value.trim().toLowerCase();
    let month = document.getElementById('search-month-select').value;
    db.ref('invoices').once('value', snap => {
        let html = '<div class="card"><h3>نتائج البحث</h3><table><thead><tr><th>الشهر</th><th>الاسم</th><th>الرقم</th><th>الباقة</th><th>الفاتورة</th><th>المدفوع</th></tr></thead><tbody>';
        let found = 0;
        snap.forEach(m => {
            if (month !== 'all' && m.key !== month) return;
            Object.entries(m.val() || {}).forEach(([phone, inv]) => {
                let user = loadedGlobalSettings[phone] || { name: '' };
                if (phone.includes(q) || user.name.toLowerCase().includes(q)) {
                    found++;
                    html += `<tr><td>${m.key}</td><td>${user.name}</td><td>${phone}</td><td>${inv.packagePrice || 0}</td><td>${inv.totalAfterTaxes || 0}</td><td>${inv.paidAmount || 0}</td></tr>`;
                }
            });
        });
        html += `</tbody></table></div>`;
        document.getElementById('search-results-area').innerHTML = found ? html : '<div class="card">لا نتائج</div>';
    });
}
function saveExtraFinancials() {
    let data = {
        manualInvoice: parseFloat(document.getElementById('manual-invoice-input').value) || 0,
        additionalRevenue: parseFloat(document.getElementById('additional-revenue-input').value) || 0,
        additionalExpenses: parseFloat(document.getElementById('additional-expenses-input').value) || 0
    };
    db.ref('extraFinancials/summaryData').set(data, () => { alert("تم"); calculateFinancialReport(); });
}
function loadExtraFinancialsForSelectedMonth() {
    db.ref('extraFinancials/summaryData').once('value', s => {
        let v = s.val() || {};
        document.getElementById('manual-invoice-input').value = v.manualInvoice || 0;
        document.getElementById('additional-revenue-input').value = v.additionalRevenue || 0;
        document.getElementById('additional-expenses-input').value = v.additionalExpenses || 0;
    });
}

// ========== 6. سجل الدفعات ==========
function loadPaymentsHistory() {
    db.ref('paymentHistory').once('value', snap => {
        let html = '';
        let arr = [];
        snap.forEach(c => arr.push(c.val()));
        arr.reverse().forEach(p => {
            let user = loadedGlobalSettings[p.phone] || { name: p.name || p.phone };
            html += `<tr><td>${p.date || ''}</td><td>${user.name}</td><td>${p.phone}</td><td>${p.month || ''}</td><td>${p.amount?.toFixed(2) || 0}</td><td>${p.type || ''}</td></tr>`;
        });
        document.getElementById('payments-history-body').innerHTML = html;
    });
}
function filterPaymentsHistory() {
    let q = document.getElementById('payment-history-search').value.toLowerCase();
    document.querySelectorAll('#payments-history-body tr').forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ========== 7. النسخ الاحتياطي والاستعادة ==========
function createBackup() {
    db.ref().once('value', s => {
        let a = document.createElement('a');
        let blob = new Blob([JSON.stringify(s.val())], { type: 'application/json' });
        a.href = URL.createObjectURL(blob);
        a.download = `backup_${Date.now()}.json`;
        a.click();
    });
}
function restoreBackup() {
    let file = document.getElementById('restore-file').files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = e => {
        let data = JSON.parse(e.target.result);
        if (confirm("سيتم استبدال كل البيانات الحالية")) db.ref().set(data, () => location.reload());
    };
    reader.readAsText(file);
}

// ========== 8. تصدير Excel ==========
function exportInvoicesExcel() {
    let month = document.getElementById('export-month-select').value;
    db.ref('invoices').once('value', snap => {
        let rows = [];
        for (let m in snap.val() || {}) {
            if (month && month !== m) continue;
            for (let p in snap.val()[m]) {
                let inv = snap.val()[m][p];
                let user = loadedGlobalSettings[p] || {};
                rows.push({
                    الشهر: m, الاسم: user.name, الرقم: p,
                    الباقة: inv.packagePrice, الفاتورة: inv.totalAfterTaxes,
                    المدفوع: inv.paidAmount, الحالة: inv.status
                });
            }
        }
        let ws = XLSX.utils.json_to_sheet(rows);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
        XLSX.writeFile(wb, 'VodafoneInvoices.xlsx');
    });
}

// ========== 9. التسويات الشهرية ==========
function saveMonthlySettlement() {
    let month = document.getElementById('settlement-month').value;
    if (!month) return;
    let rev = parseFloat(document.getElementById('settlement-revenue').value) || 0;
    let exp = parseFloat(document.getElementById('settlement-expenses').value) || 0;
    db.ref(`monthlySettlements/${month}`).set({ revenue: rev, expenses: exp }, () => {
        alert("تم"); loadMonthlySettlements();
    });
}
function loadMonthlySettlements() {
    db.ref('monthlySettlements').once('value', snap => {
        let html = '';
        for (let m in snap.val() || {}) {
            let s = snap.val()[m];
            html += `<tr><td>${m}</td><td>${s.revenue}</td><td>${s.expenses}</td><td><button class="btn btn-red" onclick="deleteSettlement('${m}')">حذف</button></td></tr>`;
        }
        document.getElementById('settlements-table-body').innerHTML = html;
    });
}
function deleteSettlement(month) {
    if (confirm("حذف التسوية؟")) db.ref(`monthlySettlements/${month}`).remove(() => loadMonthlySettlements());
}

// ========== تهيئة الصفحة والتنقل ==========
document.querySelectorAll('.nav-links li').forEach(li => {
    li.addEventListener('click', () => {
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        li.classList.add('active');
        let target = li.dataset.target;
        document.querySelectorAll('.app-screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById(target).classList.add('active-screen');
        if (target === 'collection-screen') loadCollectionData();
        if (target === 'reports-screen') calculateFinancialReport();
        if (target === 'payments-history-screen') loadPaymentsHistory();
        if (target === 'settlements-screen') loadMonthlySettlements();
        if (target === 'export-screen') updateDropdowns();
        if (target === 'settings-screen') loadSettingsTable();
    });
});
window.onload = () => {
    syncSettings();
    syncAdvance();
    updateDropdowns();
    calculateFinancialReport();
    loadPaymentsHistory();
    loadMonthlySettlements();
    document.getElementById('invoice-month-select').value = new Date().toISOString().slice(0, 7);
    document.getElementById('settlement-month').value = new Date().toISOString().slice(0, 7);
};
window.collectCustomPayment = collectCustomPayment;
window.cancelPayment = cancelPayment;
window.openEditModal = openEditModal;
