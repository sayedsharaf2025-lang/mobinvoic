// ═══════════════════════════════════════════
// واجهة المستخدم - ui.js
// ═══════════════════════════════════════════

let pendingImport = null; // لتخزين بيانات الفاتورة مؤقتاً قبل التأكيد

const UI = {
    
    showTab(tabName, btnElement = null) {
        APP_STATE.currentTab = tabName;
        
        ['alerts', 'lines', 'upload', 'backup', 'settings'].forEach(tab => {
            const el = document.getElementById(`tab-${tab}`);
            if (el) el.classList.add('hidden');
        });
        
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) targetTab.classList.remove('hidden');
        
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        
        this.loadTabContent(tabName);
    },
    
    loadTabContent(tabName) {
        switch(tabName) {
            case 'alerts': this.generateAlerts(); break;
            case 'lines': this.renderLinesTab(); break;
            case 'upload': this.renderUploadTab(); break;
            case 'backup': this.renderBackupTab(); break;
            case 'settings': this.renderSettingsTab(); break;
        }
    },
    
    // ════════════════════════ تبويب الخطوط ════════════════════════
    
    renderLinesTab() {
        const container = document.getElementById('tab-lines');
        const months = Object.keys(App.data.months).sort().reverse();
        const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        
        container.innerHTML = `
            <div class="card">
                <div class="row-group">
                    <input type="month" id="monthPicker" onchange="App.loadMonth()" value="${currentMonth}">
                    <button class="btn-secondary" onclick="App.loadMonth()" style="margin-top:0;">عرض</button>
                </div>
                
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
                    <button class="btn-success" onclick="App.payAllLines()" style="margin:0; padding:8px 12px; font-size:12px; width:auto;">✅ دفع الكل</button>
                    <button class="btn-outline" onclick="UI.cancelAllPaymentsConfirm()" style="margin:0; padding:8px 12px; font-size:12px; width:auto;">↩️ إلغاء الكل</button>
                    <button class="btn-danger" onclick="App.deleteMonth(document.getElementById('monthPicker').value)" style="margin:0; padding:8px 12px; font-size:12px; width:auto;">🗑️ حذف الشهر</button>
                    ${months.length > 0 ? `<button class="btn-danger" onclick="App.deleteAllMonths()" style="margin:0; padding:8px 12px; font-size:12px; width:auto; background:#990000;">⚠️ حذف الكل</button>` : ''}
                </div>
                
                ${months.length > 1 ? `
                <div style="margin-top: 10px;">
                    <label style="font-size: 11px; color: var(--gray-dark);">🗑️ حذف شهر:</label>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                        ${months.map(m => `<button onclick="App.deleteMonth('${m}')" style="margin:0; padding:4px 10px; font-size:10px; width:auto; background:#ff4444; color:white; border-radius:12px;">❌ ${m}</button>`).join('')}
                    </div>
                </div>` : ''}
            </div>
            
            <div class="filter-chips">
                <button class="chip active" onclick="UI.filterTable('all', this)">الكل</button>
                <button class="chip" onclick="UI.filterTable('unpaid', this)">عليهم فلوس</button>
                <button class="chip" onclick="UI.filterTable('partially', this)">دفعوا جزء</button>
                <button class="chip" onclick="UI.filterTable('paid', this)">خلصوا</button>
            </div>
            <div id="statsGrid" class="stats-grid hidden"></div>
            <div id="lineCards" class="line-cards"></div>
            <div id="desktopTable" class="desktop-table"></div>
        `;
        
        App.loadMonth();
    },
    
    // ════════════════════════ تبويب رفع الملفات ════════════════════════
    
    renderUploadTab() {
        const container = document.getElementById('tab-upload');
        const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        
        container.innerHTML = `
            <div class="card">
                <div class="card-title">📤 رفع ملفات الفواتير والبيانات</div>
                
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">📊 رفع فاتورة Excel (Vodafone Business)</h4>
                    <label>اختر الشهر</label>
                    <input type="month" id="uploadMonth" value="${currentMonth}" style="margin-bottom:12px;">
                    <div class="upload-zone" id="excelInvoiceZone">
                        <input type="file" id="excelInvoiceInput" accept=".xlsx,.xls" onchange="UI.handleExcelInvoice(this)">
                        <div class="upload-zone-icon">📊</div>
                        <div class="upload-zone-text">فاتورة Vodafone Business - العمود A & J</div>
                    </div>
                </div>
                
                <hr style="margin: 16px 0; border-color: var(--gray-mid);">
                
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">📄 رفع فاتورة PDF</h4>
                    <div class="upload-zone" id="pdfUploadZone">
                        <input type="file" id="pdfInput" accept=".pdf">
                        <div class="upload-zone-icon">📄</div>
                        <div class="upload-zone-text" id="uploadFileName">فاتورة PDF</div>
                    </div>
                    <button class="btn-primary" onclick="UI.processPDF()">🔄 معالجة PDF</button>
                    <div id="uploadResult" style="margin-top:10px;"></div>
                </div>
                
                <hr style="margin: 16px 0; border-color: var(--gray-mid);">
                
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">💲 رفع خطة الأسعار Excel</h4>
                    <div class="upload-zone" id="excelPricesZone">
                        <input type="file" id="excelPricesInput" accept=".xlsx,.xls" onchange="UI.handleExcelPrices(this)">
                        <div class="upload-zone-icon">💲</div>
                        <div class="upload-zone-text">ملف تحديث الأسعار</div>
                    </div>
                </div>
                
                <hr style="margin: 16px 0; border-color: var(--gray-mid);">
                
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">👥 رفع ملف الأسماء Excel</h4>
                    <div class="upload-zone" id="excelNamesZone">
                        <input type="file" id="excelNamesInput" accept=".xlsx,.xls" onchange="UI.handleExcelNames(this)">
                        <div class="upload-zone-icon">👥</div>
                        <div class="upload-zone-text">ملف الأسماء والمخزن</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">⚠️ تنبيهات الأسعار المنخفضة</div>
                <div id="priceWarnings"></div>
            </div>
        `;
        
        document.getElementById('pdfInput')?.addEventListener('change', function() {
            document.getElementById('uploadFileName').textContent = this.files[0]?.name || 'فاتورة PDF';
        });
        
        this.showPriceWarnings();
    },
    
    // ════════════════════════ تبويب النسخ الاحتياطي ════════════════════════
    
    renderBackupTab() {
        const container = document.getElementById('tab-backup');
        container.innerHTML = `
            <div class="card">
                <div class="card-title">🤖 النسخ الاحتياطي التلقائي</div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span class="auto-backup-badge">⏰ آخر نسخة: <span id="lastAutoBackup">${Backup.getLastBackupTime()}</span></span>
                        <p style="font-size: 11px; color: var(--gray-dark); margin-top: 4px;">كل 24 ساعة</p>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-info" onclick="Backup.toggleAuto()" style="width: auto; margin: 0; padding: 8px 12px; font-size: 12px;">
                            <span id="autoBackupToggleText">${APP_STATE.autoBackupEnabled ? '⏸️ إيقاف' : '▶️ تفعيل'}</span>
                        </button>
                        <button class="btn-purple" onclick="Backup.createNow()" style="width: auto; margin: 0; padding: 8px 12px; font-size: 12px;">🔄 نسخ الآن</button>
                    </div>
                </div>
                <div id="backupProgress" style="margin-top: 8px;"></div>
            </div>
            
            <div class="card">
                <div class="card-title">💾 أدوات النسخ والاستعادة</div>
                <div class="backup-grid">
                    <div class="backup-card">
                        <span class="backup-icon">📥</span><div class="backup-title">تصدير Excel</div>
                        <button class="btn-success" onclick="Backup.exportToExcel()">📊 تصدير</button>
                    </div>
                    <div class="backup-card">
                        <span class="backup-icon">📄</span><div class="backup-title">تصدير JSON</div>
                        <button class="btn-info" onclick="Backup.exportToJSON()">💾 تصدير</button>
                    </div>
                    <div class="backup-card">
                        <span class="backup-icon">📤</span><div class="backup-title">استيراد JSON</div>
                        <input type="file" id="importFileInput" accept=".json" onchange="Backup.importFromJSON(this.files[0])" style="display:none;">
                        <button class="btn-warning" onclick="document.getElementById('importFileInput').click()">📂 استيراد</button>
                    </div>
                    <div class="backup-card">
                        <span class="backup-icon">☁️</span><div class="backup-title">نسخ سحابي</div>
                        <button class="btn-purple" onclick="Backup.uploadToCloud()">☁️ رفع</button>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">📋 سجل النسخ المحلية</div>
                <div class="backup-list" id="backupHistoryList"></div>
                <button class="btn-danger" onclick="Backup.clearAll()">🗑️ مسح الكل</button>
            </div>
            
            <div class="card">
                <div class="card-title">☁️ النسخ السحابية</div>
                <div class="backup-list" id="cloudBackupList"><div class="alert-item info">جاري التحميل...</div></div>
            </div>
        `;
        
        this.renderBackupHistory();
        this.renderCloudBackups();
    },
    
    // ════════════════════════ تبويب الإعدادات ════════════════════════
    
    renderSettingsTab() {
        const container = document.getElementById('tab-settings');
        container.innerHTML = `
            <div class="card">
                <div class="card-title">📋 إدارة مخزن الأسماء</div>
                <input type="text" id="searchNamesInput" placeholder="🔍 بحث..." oninput="UI.renderManageTable()">
                <div class="table-container">
                    <table>
                        <thead><tr><th>الاسم</th><th>الرقم</th><th>الباقة</th><th>السعر</th><th>إجراء</th></tr></thead>
                        <tbody id="manageTableBody"></tbody>
                    </table>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">➕ إضافة خط جديد</div>
                <input type="text" id="newName" placeholder="الاسم">
                <input type="text" id="newPhone" placeholder="الرقم بدون 0">
                <input type="text" id="newPackage" placeholder="الباقة">
                <input type="number" id="newPrice" placeholder="السعر">
                <button class="btn-success" onclick="UI.addNewLine()">➕ إضافة</button>
            </div>
            
            <div class="card">
                <div class="card-title">📝 استيراد/تصدير نصي</div>
                <textarea id="namesData" placeholder="الاسم,الرقم,السعر,الباقة"></textarea>
                <button class="btn-primary" onclick="UI.saveNamesFromTextarea()">💾 حفظ</button>
            </div>
        `;
        
        this.renderManageTable();
        this.updateNamesTextarea();
    },
    
    // ════════════════════════ عرض الخطوط ════════════════════════
    
    filterTable(type, el) {
        APP_STATE.currentFilter = type;
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
        this.renderLines();
    },
    
    renderLines() {
        let data = [...APP_STATE.currentMonthData];
        
        if (APP_STATE.currentFilter === 'paid') data = data.filter(d => d.status === 'paid');
        if (APP_STATE.currentFilter === 'unpaid') data = data.filter(d => d.status === 'unpaid');
        if (APP_STATE.currentFilter === 'partially') data = data.filter(d => d.status === 'partially');
        
        if (!data.length) {
            document.getElementById('lineCards').innerHTML = '<div class="alert-item info">لا توجد أرقام</div>';
            document.getElementById('desktopTable').innerHTML = '';
            return;
        }
        
        let cardsHtml = '';
        data.forEach(d => {
            const cardClass = d.status;
            const statusText = d.status === 'paid' ? '🟢 دفع' : (d.status === 'partially' ? '🟡 جزء' : '🔴 عليه');
            const statusBadge = d.status === 'paid' ? 'badge-paid' : (d.status === 'partially' ? 'badge-partially' : 'badge-unpaid');
            const remain = d.status === 'paid' ? 0 : (d.status === 'partially' ? d.myPrice - d.paidAmount : d.myPrice);
            const pkgInfo = CONFIG.PACKAGES[d.packageType];
            const priceWarning = pkgInfo && d.myPrice < pkgInfo.minPrice ? 
                `<div class="package-warning">⚠️ سعرك (${d.myPrice}) أقل من الحد الأدنى (${pkgInfo.minPrice})</div>` : '';
            
            cardsHtml += `
                <div class="line-card ${cardClass}">
                    <div class="line-card-top">
                        <div><div class="line-name">${d.name}</div><div class="line-phone">0${d.phone}</div></div>
                        <span class="line-status-badge ${statusBadge}">${statusText}</span>
                    </div>
                    <div class="line-card-package">📦 ${d.packageType} | فاتورة: ${d.invoicePrice} ج</div>
                    ${priceWarning}
                    <div class="line-card-body">
                        <div class="line-stat"><div class="ls-val">${d.myPrice}</div><div class="ls-lbl">سعرك</div></div>
                        <div class="line-stat"><div class="ls-val">${d.paidAmount || 0}</div><div class="ls-lbl">مدفوع</div></div>
                        <div class="line-stat"><div class="ls-val">${remain}</div><div class="ls-lbl">متبقي</div></div>
                    </div>
                    <div class="payment-actions">
                        ${d.status !== 'paid' ? `<button class="btn-success" onclick="App.setPaymentStatus('${d.phone}', 'paid')">✅ دفع</button>` : ''}
                        ${d.status !== 'paid' ? `<button class="btn-warning" onclick="UI.showPartialModal('${d.phone}', ${d.myPrice})">💵 جزء</button>` : ''}
                        ${d.status === 'paid' ? `<button class="btn-danger" onclick="App.cancelPayment('${d.phone}')">↩️ إلغاء</button>` : ''}
                        <button class="btn-danger" onclick="App.deleteLineFromMonth('${d.phone}')" style="font-size:10px; padding:4px;">🗑️</button>
                    </div>
                </div>`;
        });
        document.getElementById('lineCards').innerHTML = cardsHtml;
        
        let tableHtml = `<table class="d-table"><tr><th>الاسم</th><th>الرقم</th><th>الباقة</th><th>سعرك</th><th>فاتورة</th><th>مدفوع</th><th>متبقي</th><th>حالة</th><th>إجراء</th></tr>`;
        data.forEach(d => {
            const remain = d.status === 'paid' ? 0 : (d.status === 'partially' ? d.myPrice - d.paidAmount : d.myPrice);
            const statusText = d.status === 'paid' ? '🟢' : (d.status === 'partially' ? '🟡' : '🔴');
            const pkgInfo = CONFIG.PACKAGES[d.packageType];
            const warning = pkgInfo && d.myPrice < pkgInfo.minPrice ? '⚠️' : '';
            
            tableHtml += `<tr class="${d.status}">
                <td>${d.name}</td><td>0${d.phone}</td><td>${d.packageType}</td>
                <td>${d.myPrice}</td><td>${d.invoicePrice}</td><td>${d.paidAmount || 0}</td><td>${remain}</td>
                <td>${warning} ${statusText}</td>
                <td><div class="tbl-action-group">
                    ${d.status !== 'paid' ? `<button class="btn-success btn-sm" onclick="App.setPaymentStatus('${d.phone}', 'paid')">دفع</button>` : ''}
                    ${d.status === 'paid' ? `<button class="btn-danger btn-sm" onclick="App.cancelPayment('${d.phone}')">إلغاء</button>` : ''}
                    <button class="btn-danger btn-sm" onclick="App.deleteLineFromMonth('${d.phone}')">🗑️</button>
                </div></td>
            </tr>`;
        });
        document.getElementById('desktopTable').innerHTML = tableHtml + '</table>';
    },
    
    renderStats() {
        const data = APP_STATE.currentMonthData;
        const statsGrid = document.getElementById('statsGrid');
        if (!data.length) { statsGrid.classList.add('hidden'); return; }
        
        const totalInvoice = data.reduce((s, d) => s + d.invoicePrice, 0);
        const totalMy = data.reduce((s, d) => s + d.myPrice, 0);
        const totalPaid = data.reduce((s, d) => s + (d.paidAmount || 0), 0);
        
        statsGrid.innerHTML = `
            <div class="stat-box"><span class="stat-val">${totalInvoice.toFixed(0)} ج</span><div class="stat-lbl">فودافون</div></div>
            <div class="stat-box blue"><span class="stat-val">${totalMy.toFixed(0)} ج</span><div class="stat-lbl">تحصيل</div></div>
            <div class="stat-box green"><span class="stat-val">${(totalMy - totalInvoice).toFixed(0)} ج</span><div class="stat-lbl">أرباح</div></div>
            <div class="stat-box yellow"><span class="stat-val">${(totalMy - totalPaid).toFixed(0)} ج</span><div class="stat-lbl">باقي</div></div>`;
        statsGrid.classList.remove('hidden');
    },
    
    // ════════════════════════ تنبيهات ════════════════════════
    
    generateAlerts() {
        const container = document.getElementById('tab-alerts');
        const months = Object.keys(App.data.months).sort().reverse();
        
        if (!months.length) {
            container.innerHTML = '<div class="alert-item info">ℹ️ لا توجد فواتير مرفوعة</div>';
            return;
        }
        
        let html = '';
        const debtMap = new Map();
        
        months.forEach(m => {
            App.data.months[m].forEach(d => {
                const status = d.status || (d.paid ? 'paid' : 'unpaid');
                let unpaid = 0;
                if (status === 'unpaid') unpaid = d.myPrice;
                if (status === 'partially') unpaid = d.myPrice - (d.paidAmount || 0);
                
                if (unpaid > 0) {
                    if (!debtMap.has(d.phone)) debtMap.set(d.phone, { name: d.name, phone: d.phone, total: 0, details: [] });
                    const entry =
