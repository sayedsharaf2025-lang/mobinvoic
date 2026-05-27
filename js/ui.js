// ═══════════════════════════════════════════
// واجهة المستخدم
// ═══════════════════════════════════════════

const UI = {
    /**
     * عرض تبويب معين
     */
    showTab(tabName, btnElement = null) {
        APP_STATE.currentTab = tabName;
        
        // إخفاء كل التبويبات
        const tabs = ['alerts', 'lines', 'upload', 'backup', 'settings'];
        tabs.forEach(tab => {
            const el = document.getElementById(`tab-${tab}`);
            if (el) el.classList.add('hidden');
        });
        
        // إظهار التبويب المطلوب
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) targetTab.classList.remove('hidden');
        
        // تحديث الأزرار
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        
        // تحميل محتوى التبويب
        this.loadTabContent(tabName);
    },
    
    /**
     * تحميل محتوى التبويب
     */
    loadTabContent(tabName) {
        switch(tabName) {
            case 'alerts':
                this.generateAlerts();
                break;
            case 'lines':
                this.renderLinesTab();
                break;
            case 'upload':
                this.renderUploadTab();
                break;
            case 'backup':
                this.renderBackupTab();
                break;
            case 'settings':
                this.renderSettingsTab();
                break;
        }
    },
    
    /**
     * عرض تبويب الخطوط
     */
    renderLinesTab() {
    const container = document.getElementById('tab-lines');
    
    // ⬇️ الحصول على قائمة الشهور
    const months = Object.keys(App.data.months).sort().reverse();
    const currentMonth = new Date().getFullYear() + '-' + 
        String(new Date().getMonth() + 1).padStart(2, '0');
    
    container.innerHTML = `
        <div class="card">
            <div class="row-group">
                <input type="month" id="monthPicker" onchange="App.loadMonth()" value="${currentMonth}">
                <button class="btn-secondary" onclick="App.loadMonth()" style="margin-top:0;">عرض</button>
            </div>
            
            <!-- ⬇️ أزرار الحذف ⬇️ -->
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <button class="btn-danger" onclick="App.deleteMonth(document.getElementById('monthPicker').value)" 
                    style="margin: 0; padding: 8px 12px; font-size: 12px; width: auto;">
                    🗑️ حذف هذا الشهر
                </button>
                ${months.length > 0 ? `
                <button class="btn-danger" onclick="App.deleteAllMonths()" 
                    style="margin: 0; padding: 8px 12px; font-size: 12px; width: auto; background: #990000;">
                    ⚠️ حذف الكل
                </button>
                ` : ''}
            </div>
            
            <!-- ⬇️ قائمة الشهور للحذف السريع ⬇️ -->
            ${months.length > 1 ? `
            <div style="margin-top: 10px;">
                <label style="font-size: 11px;">🗑️ حذف شهر محدد:</label>
                <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">
                    ${months.map(m => `
                        <button onclick="App.deleteMonth('${m}')" 
                            style="margin: 0; padding: 4px 10px; font-size: 10px; width: auto; background: #ff4444; color: white; border-radius: 12px;">
                            ❌ ${m}
                        </button>
                    `).join('')}
                </div>
            </div>
            ` : ''}
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
}
        `;
        
        // تعيين الشهر الحالي
        const now = new Date();
        document.getElementById('monthPicker').value = 
            now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        
        App.loadMonth();
    },
    
    /**
     * عرض تبويب رفع الملفات
     */
    renderUploadTab() {
        const container = document.getElementById('tab-upload');
        container.innerHTML = `
            <div class="card">
                <div class="card-title">📤 رفع ملفات الفواتير والبيانات</div>
                
                <!-- رفع فاتورة PDF -->
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">📄 رفع فاتورة PDF</h4>
                    <label>اختر الشهر</label>
                    <input type="month" id="uploadMonth" style="margin-bottom:12px;">
                    <div class="upload-zone" id="pdfUploadZone">
                        <input type="file" id="pdfInput" accept=".pdf">
                        <div class="upload-zone-icon">📄</div>
                        <div class="upload-zone-text" id="uploadFileName">فاتورة PDF</div>
                    </div>
                    <button class="btn-primary" onclick="UI.processPDF()">🔄 معالجة PDF</button>
                    <div id="uploadResult" style="margin-top:10px;"></div>
                </div>
                
                <hr style="margin: 16px 0; border-color: var(--gray-mid);">
                
                <!-- رفع فاتورة Excel -->
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">📊 رفع فاتورة Excel</h4>
                    <div class="upload-zone" id="excelInvoiceZone">
                        <input type="file" id="excelInvoiceInput" accept=".xlsx,.xls" onchange="UI.handleExcelInvoice(this)">
                        <div class="upload-zone-icon">📊</div>
                        <div class="upload-zone-text">فاتورة شهرية Excel</div>
                    </div>
                </div>
                
                <hr style="margin: 16px 0; border-color: var(--gray-mid);">
                
                <!-- رفع خطة أسعار Excel -->
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">💰 رفع خطة الأسعار Excel</h4>
                    <div class="upload-zone" id="excelPricesZone">
                        <input type="file" id="excelPricesInput" accept=".xlsx,.xls" onchange="UI.handleExcelPrices(this)">
                        <div class="upload-zone-icon">💲</div>
                        <div class="upload-zone-text">ملف تحديث الأسعار</div>
                    </div>
                </div>
                
                <hr style="margin: 16px 0; border-color: var(--gray-mid);">
                
                <!-- رفع أسماء Excel -->
                <div style="margin-bottom: 16px;">
                    <h4 style="margin-bottom: 8px;">👥 رفع ملف الأسماء Excel</h4>
                    <div class="upload-zone" id="excelNamesZone">
                        <input type="file" id="excelNamesInput" accept=".xlsx,.xls" onchange="UI.handleExcelNames(this)">
                        <div class="upload-zone-icon">👥</div>
                        <div class="upload-zone-text">ملف الأسماء والمخزن</div>
                    </div>
                </div>
            </div>
            
            <!-- تنبيهات الأسعار -->
            <div class="card">
                <div class="card-title">⚠️ تنبيهات الأسعار المنخفضة</div>
                <div id="priceWarnings"></div>
            </div>
        `;
        
        // تعيين الشهر الحالي
        const now = new Date();
        document.getElementById('uploadMonth').value = 
            now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        
        // مستمع ملف PDF
        document.getElementById('pdfInput').addEventListener('change', function() {
            document.getElementById('uploadFileName').textContent = 
                this.files[0]?.name || 'فاتورة PDF';
        });
        
        // عرض تحذيرات الأسعار
        this.showPriceWarnings();
    },
    
    /**
     * عرض تبويب النسخ الاحتياطي
     */
    renderBackupTab() {
        const container = document.getElementById('tab-backup');
        container.innerHTML = `
            <!-- حالة النسخ التلقائي -->
            <div class="card">
                <div class="card-title">🤖 النسخ الاحتياطي التلقائي</div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span class="auto-backup-badge" id="autoBackupBadge">
                            ⏰ آخر نسخة: <span id="lastAutoBackup">${Backup.getLastBackupTime()}</span>
                        </span>
                        <p style="font-size: 11px; color: var(--gray-dark); margin-top: 4px;">
                            كل 24 ساعة تلقائياً
                        </p>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-info" onclick="Backup.toggleAuto()" style="width: auto; margin: 0; padding: 8px 12px; font-size: 12px;">
                            <span id="autoBackupToggleText">${APP_STATE.autoBackupEnabled ? '⏸️ إيقاف' : '▶️ تفعيل'}</span>
                        </button>
                        <button class="btn-purple" onclick="Backup.createNow()" style="width: auto; margin: 0; padding: 8px 12px; font-size: 12px;">
                            🔄 نسخ الآن
                        </button>
                    </div>
                </div>
                <div id="backupProgress" style="margin-top: 8px;"></div>
            </div>
            
            <!-- أدوات النسخ -->
            <div class="card">
                <div class="card-title">💾 أدوات النسخ والاستعادة</div>
                <div class="backup-grid">
                    <div class="backup-card">
                        <span class="backup-icon">📥</span>
                        <div class="backup-title">تصدير Excel</div>
                        <div class="backup-desc">كل البيانات في ملف Excel</div>
                        <button class="btn-success" onclick="Backup.exportToExcel()">📊 تصدير</button>
                    </div>
                    <div class="backup-card">
                        <span class="backup-icon">📄</span>
                        <div class="backup-title">تصدير JSON</div>
                        <div class="backup-desc">بيانات خام كاملة</div>
                        <button class="btn-info" onclick="Backup.exportToJSON()">💾 تصدير</button>
                    </div>
                    <div class="backup-card">
                        <span class="backup-icon">📤</span>
                        <div class="backup-title">استيراد JSON</div>
                        <div class="backup-desc">استعادة من ملف</div>
                        <input type="file" id="importFileInput" accept=".json" onchange="Backup.importFromJSON(this.files[0])" style="display:none;">
                        <button class="btn-warning" onclick="document.getElementById('importFileInput').click()">📂 استيراد</button>
                    </div>
                    <div class="backup-card">
                        <span class="backup-icon">☁️</span>
                        <div class="backup-title">نسخ سحابي</div>
                        <div class="backup-desc">رفع نسخة للسحابة</div>
                        <button class="btn-purple" onclick="Backup.uploadToCloud()">☁️ رفع</button>
                    </div>
                </div>
            </div>
            
            <!-- سجل النسخ المحلية -->
            <div class="card">
                <div class="card-title">📋 سجل النسخ المحلية</div>
                <div class="backup-list" id="backupHistoryList"></div>
                <button class="btn-danger" onclick="Backup.clearAll()">🗑️ مسح الكل</button>
            </div>
            
            <!-- النسخ السحابية -->
            <div class="card">
                <div class="card-title">☁️ النسخ السحابية</div>
                <div class="backup-list" id="cloudBackupList">
                    <div class="alert-item info">جاري التحميل...</div>
                </div>
            </div>
        `;
        
        this.renderBackupHistory();
        this.renderCloudBackups();
        this.updateAutoBackupUI();
    },
    
    /**
     * عرض تبويب الإعدادات
     */
    renderSettingsTab() {
        const container = document.getElementById('tab-settings');
        container.innerHTML = `
            <div class="card">
                <div class="card-title">📋 إدارة مخزن الأسماء</div>
                <input type="text" id="searchNamesInput" placeholder="🔍 بحث..." oninput="UI.renderManageTable()">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>الاسم</th><th>الرقم</th><th>الباقة</th><th>السعر</th><th>إجراء</th></tr>
                        </thead>
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
    
    // ═══════════════════════════════════════
    // عرض الخطوط
    // ═══════════════════════════════════════
    
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
            document.getElementById('lineCards').innerHTML = 
                '<div class="alert-item info">لا توجد أرقام تطابق التصفية</div>';
            document.getElementById('desktopTable').innerHTML = '';
            return;
        }
        
        // كروت الموبايل
        let cardsHtml = '';
        data.forEach(d => {
            const cardClass = d.status;
            const statusText = d.status === 'paid' ? '🟢 دفع' : (d.status === 'partially' ? '🟡 جزء' : '🔴 عليه');
            const statusBadge = d.status === 'paid' ? 'badge-paid' : (d.status === 'partially' ? 'badge-partially' : 'badge-unpaid');
            const remain = d.status === 'paid' ? 0 : (d.status === 'partially' ? d.myPrice - d.paidAmount : d.myPrice);
            
            // تحذير السعر
            const pkgInfo = CONFIG.PACKAGES[d.packageType];
            const priceWarning = pkgInfo && d.myPrice < pkgInfo.minPrice ? 
                `<div class="package-warning">⚠️ سعرك (${d.myPrice}) أقل من الحد الأدنى للباقة (${pkgInfo.minPrice})</div>` : '';
            
            cardsHtml += `
                <div class="line-card ${cardClass}">
                    <div class="line-card-top">
                        <div>
                            <div class="line-name">${d.name}</div>
                            <div class="line-phone">0${d.phone}</div>
                        </div>
                        <span class="line-status-badge ${statusBadge}">${statusText}</span>
                    </div>
                    <div class="line-card-package">📦 ${d.packageType} | فاتورة: ${d.invoicePrice} ج</div>
                    ${priceWarning}
                    <div class="line-card-body">
                        <div class="line-stat"><div class="ls-val">${d.myPrice}</div><div class="ls-lbl">سعرك</div></div>
                        <div class="line-stat"><div class="ls-val">${d.paidAmount || 0}</div><div class="ls-lbl">المدفوع</div></div>
                        <div class="line-stat"><div class="ls-val">${remain}</div><div class="ls-lbl">المتبقي</div></div>
                    </div>
                    <div class="payment-actions">
                        ${d.status !== 'paid' ? `<button class="btn-success" onclick="App.setPaymentStatus('${d.phone}', 'paid')">✅ دفع</button>` : ''}
                        ${d.status !== 'paid' ? `<button class="btn-warning" onclick="UI.showPartialModal('${d.phone}', ${d.myPrice})">💵 جزء</button>` : ''}
                        ${d.status === 'paid' ? `<button class="btn-danger" onclick="App.cancelPayment('${d.phone}')">↩️ إلغاء</button>` : ''}
                        ${d.status !== 'unpaid' && d.status !== 'paid' ? `<button class="btn-danger" onclick="App.setPaymentStatus('${d.phone}', 'unpaid')">❌ عليه</button>` : ''}
                    </div>
                </div>`;
        });
        document.getElementById('lineCards').innerHTML = cardsHtml;
        
        // جدول الديسكتوب
        let tableHtml = `<table class="d-table">
            <tr><th>الاسم</th><th>الرقم</th><th>الباقة</th><th>سعرك</th><th>الفاتورة</th><th>مدفوع</th><th>متبقي</th><th>تنبيه</th><th>إجراء</th></tr>`;
        
        data.forEach(d => {
            const remain = d.status === 'paid' ? 0 : (d.status === 'partially' ? d.myPrice - d.paidAmount : d.myPrice);
            const statusText = d.status === 'paid' ? '🟢' : (d.status === 'partially' ? '🟡' : '🔴');
            
            const pkgInfo = CONFIG.PACKAGES[d.packageType];
            const warning = pkgInfo && d.myPrice < pkgInfo.minPrice ? '⚠️' : '';
            
            tableHtml += `<tr class="${d.status}">
                <td>${d.name}</td>
                <td>0${d.phone}</td>
                <td>${d.packageType}</td>
                <td>${d.myPrice}</td>
                <td>${d.invoicePrice}</td>
                <td>${d.paidAmount || 0}</td>
                <td>${remain}</td>
                <td>${warning} ${statusText}</td>
                <td>
                    <div class="tbl-action-group">
                        ${d.status !== 'paid' ? `<button class="btn-success btn-sm" onclick="App.setPaymentStatus('${d.phone}', 'paid')">دفع</button>` : ''}
                        ${d.status === 'paid' ? `<button class="btn-danger btn-sm" onclick="App.cancelPayment('${d.phone}')">إلغاء</button>` : ''}
                    </div>
                </td>
            </tr>`;
        });
        tableHtml += '</table>';
        document.getElementById('desktopTable').innerHTML = tableHtml;
    },
    
    renderStats() {
        const data = APP_STATE.currentMonthData;
        const statsGrid = document.getElementById('statsGrid');
        
        if (!data.length) {
            statsGrid.classList.add('hidden');
            return;
        }
        
        const totalInvoice = data.reduce((s, d) => s + d.invoicePrice, 0);
        const totalMy = data.reduce((s, d) => s + d.myPrice, 0);
        const totalPaid = data.reduce((s, d) => s + (d.paidAmount || 0), 0);
        const totalUnpaid = totalMy - totalPaid;
        const profit = totalMy - totalInvoice;
        
        statsGrid.innerHTML = `
            <div class="stat-box"><span class="stat-val">${totalInvoice.toFixed(0)} ج</span><div class="stat-lbl">فودافون</div></div>
            <div class="stat-box blue"><span class="stat-val">${totalMy.toFixed(0)} ج</span><div class="stat-lbl">التحصيل</div></div>
            <div class="stat-box green"><span class="stat-val">${profit.toFixed(0)} ج</span><div class="stat-lbl">الأرباح</div></div>
            <div class="stat-box yellow"><span class="stat-val">${totalUnpaid.toFixed(0)} ج</span><div class="stat-lbl">باقي</div></div>`;
        statsGrid.classList.remove('hidden');
    },
    
    // ═══════════════════════════════════════
    // التنبيهات
    // ═══════════════════════════════════════
    
    generateAlerts() {
        const container = document.getElementById('tab-alerts');
        const months = Object.keys(App.data.months).sort().reverse();
        
        if (!months.length) {
            container.innerHTML = '<div class="alert-item info">ℹ️ لا توجد فواتير مرفوعة بعد</div>';
            return;
        }
        
        let html = '';
        
        // تنبيهات المديونيات
        const debtMap = new Map();
        months.forEach(m => {
            App.data.months[m].forEach(d => {
                const status = d.status || (d.paid ? 'paid' : 'unpaid');
                let unpaid = 0;
                if (status === 'unpaid') unpaid = d.myPrice;
                if (status === 'partially') unpaid = d.myPrice - (d.paidAmount || 0);
                
                if (unpaid > 0) {
                    if (!debtMap.has(d.phone)) {
                        debtMap.set(d.phone, { name: d.name, phone: d.phone, total: 0, details: [] });
                    }
                    const entry = debtMap.get(d.phone);
                    entry.total += unpaid;
                    entry.details.push(`${m}: ${unpaid} ج`);
                }
            });
        });
        
        html += '<div class="card"><div class="card-title">💰 المديونيات</div>';
        if (debtMap.size === 0) {
            html += '<div class="alert-item success">✅ تم تحصيل كل المبالغ</div>';
        } else {
            debtMap.forEach(debt => {
                html += `<div class="alert-item danger">
                    <strong>👤 ${debt.name} (0${debt.phone})</strong>
                    ${debt.details.join(' | ')}<br>
                    <span class="alert-badge badge-red">الإجمالي: ${debt.total.toFixed(0)} ج</span>
                </div>`;
            });
        }
        html += '</div>';
        
        // تنبيهات الأسعار المنخفضة
        const priceWarnings = App.checkPackagePrices();
        if (priceWarnings.length > 0) {
            html += '<div class="card"><div class="card-title">⚠️ تحذيرات الأسعار</div>';
            priceWarnings.forEach(w => {
                html += `<div class="alert-item warning">
                    <strong>💰 ${w.name} (0${w.phone})</strong>
                    الباقة: ${w.packageType} | سعرك: ${w.yourPrice} ج<br>
                    <span class="alert-badge badge-yellow">السعر أقل من الحد الأدنى بـ ${w.difference} ج</span>
                </div>`;
            });
            html += '</div>';
        }
        
        container.innerHTML = html;
    },
    
    showPriceWarnings() {
        const container = document.getElementById('priceWarnings');
        if (!container) return;
        
        const warnings = App.checkPackagePrices();
        
        if (warnings.length === 0) {
            container.innerHTML = '<div class="alert-item success">✅ جميع الأسعار مناسبة للباقات</div>';
            return;
        }
        
        let html = '';
        warnings.forEach(w => {
            html += `<div class="alert-item warning">
                <strong>⚠️ ${w.name} - ${w.packageType}</strong>
                سعرك: <span class="price-low">${w.yourPrice} ج</span> | 
                الحد الأدنى: ${w.minPrice} ج | 
                الفرق: <span class="price-low">${w.difference} ج</span>
            </div>`;
        });
        
        container.innerHTML = html;
    },
    
    // ═══════════════════════════════════════
    // إدارة الأسماء
    // ═══════════════════════════════════════
    
    renderManageTable() {
        const tbody = document.getElementById('manageTableBody');
        if (!tbody) return;
        
        const term = (document.getElementById('searchNamesInput')?.value || '').toLowerCase();
        
        let html = '';
        for (let phone in App.data.names) {
            const d = App.data.names[phone];
            if (term && !d.name.toLowerCase().includes(term) && !phone.includes(term)) continue;
            
            const pkgInfo = CONFIG.PACKAGES[d.packageType];
            const priceWarning = pkgInfo && d.myPrice < pkgInfo.minPrice ? ' ⚠️' : '';
            
            html += `<tr>
                <td>${d.name}</td>
                <td dir="ltr">0${phone}</td>
                <td>${d.packageType}</td>
                <td>${d.myPrice} ج${priceWarning}</td>
                <td>
                    <button class="btn-sm btn-info" onclick="UI.editLine('${phone}')">✏️</button>
                    <button class="btn-sm btn-danger" onclick="UI.deleteLine('${phone}')">❌</button>
                </td>
            </tr>`;
        }
        
        tbody.innerHTML = html || '<tr><td colspan="5">لا توجد نتائج</td></tr>';
    },
    
    updateNamesTextarea() {
        const textarea = document.getElementById('namesData');
        if (!textarea) return;
        
        const lines = [];
        for (let phone in App.data.names) {
            const d = App.data.names[phone];
            lines.push(`${d.name},0${phone},${d.myPrice},${d.packageType}`);
        }
        textarea.value = lines.join('\n');
    },
    
    async saveNamesFromTextarea() {
        const textarea = document.getElementById('namesData');
        if (!textarea) return;
        
        const lines = textarea.value.trim().split('\n');
        const newNames = {};
        
        lines.forEach(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length >= 4) {
                const phone = parts[1].replace(/^0+/, '');
                newNames[phone] = {
                    name: parts[0],
                    myPrice: parseFloat(parts[2]) || 0,
                    packageType: parts[3]
                };
            }
        });
        
        App.data.names = newNames;
        await Firebase.saveNames(App.data.names);
        
        this.showToast('✅ تم تحديث المخزن');
        this.renderManageTable();
        App.refreshMonthNames();
    },
    
    addNewLine() {
        const name = document.getElementById('newName').value.trim();
        const phone = document.getElementById('newPhone').value.trim().replace(/^0+/, '');
        const packageType = document.getElementById('newPackage').value.trim();
        const price = parseFloat(document.getElementById('newPrice').value);
        
        if (!name || !phone || !packageType || isNaN(price)) {
            this.showToast('⚠️ املأ جميع الحقول', 'warning');
            return;
        }
        
        App.data.names[phone] = { name, myPrice: price, packageType };
        Firebase.saveNames(App.data.names);
        
        ['newName', 'newPhone', 'newPackage', 'newPrice'].forEach(id => {
            document.getElementById(id).value = '';
        });
        
        this.showToast('✅ تمت الإضافة');
        this.renderManageTable();
        this.updateNamesTextarea();
    },
    
    editLine(phone) {
        const d = App.data.names[phone];
        
        const modal = document.getElementById('modalContainer');
        modal.innerHTML = `
            <div class="modal-overlay" id="editModal">
                <div class="modal-card">
                    <div class="card-title">✏️ تعديل الخط</div>
                    <label>الاسم</label>
                    <input type="text" id="editName" value="${d.name}">
                    <label>الرقم</label>
                    <input type="text" id="editPhone" value="0${phone}">
                    <label>الباقة</label>
                    <input type="text" id="editPackage" value="${d.packageType}">
                    <label>السعر</label>
                    <input type="number" id="editPrice" value="${d.myPrice}">
                    <div class="flex gap-2 mt-2">
                        <button class="btn-info" onclick="UI.submitEdit('${phone}')">💾 حفظ</button>
                        <button class="btn-secondary" onclick="UI.closeModal('editModal')">إلغاء</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    async submitEdit(oldPhone) {
        const name = document.getElementById('editName').value.trim();
        const phone = document.getElementById('editPhone').value.trim().replace(/^0+/, '');
        const packageType = document.getElementById('editPackage').value.trim();
        const price = parseFloat(document.getElementById('editPrice').value) || 0;
        
        if (!name || !phone) {
            this.showToast('⚠️ املأ الحقول المطلوبة', 'warning');
            return;
        }
        
        if (oldPhone !== phone) {
            await Firebase.deleteName(oldPhone);
            delete App.data.names[oldPhone];
        }
        
        App.data.names[phone] = { name, myPrice: price, packageType };
        await Firebase.saveNames(App.data.names);
        
        this.closeModal('editModal');
        this.showToast('✅ تم التحديث');
        this.renderManageTable();
        this.updateNamesTextarea();
        App.refreshMonthNames();
    },
    
    async deleteLine(phone) {
        if (confirm('⚠️ حذف هذا الخط؟')) {
            await Firebase.deleteName(phone);
            delete App.data.names[phone];
            
            this.showToast('🗑️ تم الحذف');
            this.renderManageTable();
            this.updateNamesTextarea();
        }
    },
    
    // ═══════════════════════════════════════
    // المودالات
    // ═══════════════════════════════════════
    
    showPartialModal(phone, myPrice) {
        const modal = document.getElementById('modalContainer');
        modal.innerHTML = `
            <div class="modal-overlay" id="partialModal">
                <div class="modal-card">
                    <div class="card-title">💰 دفعة جزئية</div>
                    <p>السعر: ${myPrice} ج</p>
                    <label>المبلغ المدفوع</label>
                    <input type="number" id="partialAmount" placeholder="المبلغ">
                    <div class="flex gap-2 mt-2">
                        <button class="btn-warning" onclick="UI.submitPartial('${phone}')">💾 تأكيد</button>
                        <button class="btn-secondary" onclick="UI.closeModal('partialModal')">إلغاء</button>
                    </div>
                </div>
            </div>
        `;
    },
    
    submitPartial(phone) {
        const amount = parseFloat(document.getElementById('partialAmount').value);
        if (isNaN(amount) || amount <= 0) {
            this.showToast('⚠️ أدخل مبلغ صحيح', 'warning');
            return;
        }
        
        App.submitPartialPayment(phone, amount);
        this.closeModal('partialModal');
    },
    
    cancelAllPaymentsConfirm() {
        if (confirm('⚠️ إلغاء جميع المدفوعات لهذا الشهر؟')) {
            APP_STATE.currentMonthData.forEach(d => {
                d.status = 'unpaid';
                d.paidAmount = 0;
                d.paid = false;
            });
            
            const monthKey = document.getElementById('monthPicker').value;
            App.data.months[monthKey] = APP_STATE.currentMonthData;
            Firebase.saveMonth(monthKey, APP_STATE.currentMonthData);
            
            this.renderLines();
            this.renderStats();
            this.generateAlerts();
            this.showToast('↩️ تم إلغاء جميع المدفوعات');
        }
    },
    
    closeModal(modalId) {
        document.getElementById('modalContainer').innerHTML = '';
    },
    
    // ═══════════════════════════════════════
    // معالجة الملفات
    // ═══════════════════════════════════════
    
    async processPDF() {
        const fileInput = document.getElementById('pdfInput');
        const month = document.getElementById('uploadMonth').value;
        const resultDiv = document.getElementById('uploadResult');
        
        if (!fileInput.files.length || !month) {
            this.showToast('⚠️ اختر الملف والشهر', 'warning');
            return;
        }
        
        resultDiv.innerHTML = '<div class="alert-item info">⏳ جاري المعالجة...</div>';
        
        try {
            const buffer = await fileInput.files[0].arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
            let text = '';
            
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(it => it.str).join(' ') + ' ';
            }
            
            const tokens = text.split(/\s+/);
            const uniqueMap = new Map();
            
            for (let i = 0; i < tokens.length; i++) {
                if (/^1[0-9]{9}$/.test(tokens[i])) {
                    const phone = tokens[i];
                    let invoiceVal = 0;
                    let pkg = 'غير معروف';
                    let pkgCost = 0;
                    
                    for (let o = 1; o <= 5; o++) {
                        const next = tokens[i + o];
                        if (next && /^[0-9]+(\.[0-9]+)?$/.test(next)) {
                            invoiceVal = parseFloat(next);
                            break;
                        }
                    }
                    
                    const context = tokens.slice(Math.max(0, i - 15), Math.min(tokens.length, i + 15)).join(' ');
                    const pkgMatch = context.match(/(BusinessFlex\+?|Business\s*Flex|Flex\s*Revamp|Flex|FreeSPOCFlex|SPOC)/i);
                    if (pkgMatch) {
                        pkg = pkgMatch[0];
                        const costMatch = context.match(/(?:Flex|Business|Revamp)\s*([0-9]{2,3})/i);
                        if (costMatch) pkgCost = parseFloat(costMatch[1]);
                    }
                    
                    uniqueMap.set(phone, { invoicePrice: invoiceVal, packageType: pkg, packageCost: pkgCost });
                }
            }
            
            const monthData = [];
            let newNames = false;
            
            uniqueMap.forEach((extracted, phone) => {
                if (!App.data.names[phone]) {
                    App.data.names[phone] = {
                        name: '(بدون اسم)',
                        myPrice: extracted.packageCost || extracted.invoicePrice,
                        packageType: extracted.packageType
                    };
                    newNames = true;
                }
                
                monthData.push({
                    phone,
                    name: App.data.names[phone].name,
                    myPrice: App.data.names[phone].myPrice,
                    invoicePrice: extracted.invoicePrice,
                    packageType: App.data.names[phone].packageType,
                    status: 'unpaid',
                    paidAmount: 0
                });
            });
            
            if (newNames) await Firebase.saveNames(App.data.names);
            await Firebase.saveMonth(month, monthData);
            App.data.months[month] = monthData;
            
            resultDiv.innerHTML = `<div class="alert-item success">✅ تم استخراج ${monthData.length} خط بنجاح</div>`;
            this.showTab('lines');
            this.renderLinesTab();
            
        } catch (e) {
            resultDiv.innerHTML = `<div class="alert-item danger">❌ خطأ: ${e.message}</div>`;
        }
    },
    
    handleExcelNames(input) {
        if (input.files[0]) {
            App.importNamesFromExcel(input.files[0]);
        }
    },
    
    handleExcelPrices(input) {
        if (input.files[0]) {
            App.importPricesFromExcel(input.files[0]);
        }
    },
    
    handleExcelInvoice(input) {
        if (input.files[0]) {
            App.importInvoiceFromExcel(input.files[0]);
        }
    },
    
    // ═══════════════════════════════════════
    // النسخ الاحتياطي - واجهة
    // ═══════════════════════════════════════
    
    renderBackupHistory() {
        const container = document.getElementById('backupHistoryList');
        if (!container) return;
        
        const backups = Backup.getAll();
        
        if (backups.length === 0) {
            container.innerHTML = '<div class="alert-item info">لا توجد نسخ محلية</div>';
            return;
        }
        
        container.innerHTML = backups.map(b => `
            <div class="backup-item">
                <div>
                    <div class="backup-date">${b.type === 'auto' ? '🤖' : '👤'} ${b.dateFormatted}</div>
                    <div class="backup-size">${(b.size / 1024).toFixed(1)} ك.ب | ${b.stats?.namesCount || 0} خط</div>
                </div>
                <div class="backup-actions">
                    <button class="btn-sm btn-success" onclick="Backup.restore(${b.id})">استعادة</button>
                    <button class="btn-sm btn-danger" onclick="Backup.delete(${b.id})">حذف</button>
                </div>
            </div>
        `).join('');
    },
    
    async renderCloudBackups() {
        const container = document.getElementById('cloudBackupList');
        if (!container) return;
        
        container.innerHTML = '<div class="alert-item info">⏳ جاري التحميل...</div>';
        
        const cloudBackups = await Firebase.getCloudBackups();
        
        if (!cloudBackups || Object.keys(cloudBackups).length === 0) {
            container.innerHTML = '<div class="alert-item info">لا توجد نسخ سحابية</div>';
            return;
        }
        
        const sorted = Object.values(cloudBackups).sort((a, b) => b.id - a.id);
        container.innerHTML = sorted.map(b => `
            <div class="backup-item">
                <div>
                    <div class="backup-date">☁️ ${b.dateFormatted}</div>
                    <div class="backup-size">${(b.size / 1024).toFixed(1)} ك.ب</div>
                </div>
                <div class="backup-actions">
                    <button class="btn-sm btn-info" onclick="Backup.restoreFromCloud(${b.id})">تحميل</button>
                </div>
            </div>
        `).join('');
    },
    
    updateAutoBackupUI() {
        const toggleText = document.getElementById('autoBackupToggleText');
        if (toggleText) {
            toggleText.textContent = APP_STATE.autoBackupEnabled ? '⏸️ إيقاف' : '▶️ تفعيل';
        }
    },
    
    showBackupProgress(msg) {
        const container = document.getElementById('backupProgress');
        if (container) {
            container.innerHTML = msg ? `<div class="alert-item info backup-in-progress">⏳ ${msg}</div>` : '';
        }
    },
    
    // ═══════════════════════════════════════
    // عام
    // ═══════════════════════════════════════
    
    updateSyncStatus(online) {
        const el = document.getElementById('syncStatus');
        if (el) {
            el.textContent = online ? '☁️ متصل' : '❌ غير متصل';
            el.style.background = online ? 'rgba(255,255,255,0.2)' : 'rgba(255,0,0,0.3)';
        }
    },
    
    toggleDarkMode() {
        APP_STATE.isDarkMode = !APP_STATE.isDarkMode;
        document.body.classList.toggle('dark-mode');
        
        const btn = document.querySelector('.dark-toggle');
        if (btn) btn.textContent = APP_STATE.isDarkMode ? '☀️' : '🌙';
        
        App.saveSettings();
        this.showToast(APP_STATE.isDarkMode ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري');
    },
    
    showToast(msg, type = 'success') {
        const existing = document.querySelector('.custom-toast');
        if (existing) existing.remove();
        
        const bgColor = type === 'warning' ? '#f0a500' : '#1a9e4a';
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: ${bgColor}; color: white; padding: 12px 24px; border-radius: 20px;
            z-index: 9999; font-size: 13px; font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); min-width: 250px; text-align: center;
        `;
        toast.innerHTML = `${msg}<div class="toast-progress"></div>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), CONFIG.UI.TOAST_DURATION);
    },
    
    updateAllViews() {
        this.renderManageTable();
        this.updateNamesTextarea();
        this.generateAlerts();
        if (APP_STATE.currentTab === 'lines') {
            this.renderLines();
            this.renderStats();
        }
    }
};
