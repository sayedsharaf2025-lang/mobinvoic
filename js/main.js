// ═══════════════════════════════════════════
// المنطق الرئيسي للتطبيق - main.js
// ═══════════════════════════════════════════

const App = {
    data: {
        names: {},
        months: {}
    },
    
    async init() {
        this.loadSettings();
        await this.loadCloudData();
        Backup.startAuto();
        UI.showTab('alerts');
        
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        
        setTimeout(() => {
            const monthPicker = document.getElementById('monthPicker');
            const uploadMonth = document.getElementById('uploadMonth');
            if (monthPicker) monthPicker.value = currentMonth;
            if (uploadMonth) uploadMonth.value = currentMonth;
        }, 500);
        
        console.log('✅ تم تهيئة نظام فودافون السحابي بنجاح');
    },
    
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS) || '{}');
            APP_STATE.isDarkMode = settings.darkMode || false;
            APP_STATE.autoBackupEnabled = settings.autoBackup !== false;
            
            if (APP_STATE.isDarkMode) {
                document.body.classList.add('dark-mode');
            }
        } catch (e) {
            console.error('خطأ في تحميل الإعدادات:', e);
        }
    },
    
    saveSettings() {
        const settings = {
            darkMode: APP_STATE.isDarkMode,
            autoBackup: APP_STATE.autoBackupEnabled
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },
    
    async loadCloudData() {
        const cloudData = await Firebase.loadAllData();
        
        if (cloudData.names && Object.keys(cloudData.names).length > 0) {
            this.data.names = cloudData.names;
        } else {
            this.data.names = DEFAULT_DATA.names;
            await Firebase.saveNames(this.data.names);
        }
        
        if (cloudData.months) {
            this.data.months = cloudData.months;
        }
        
        UI.updateAllViews();
    },
    
    async refreshMonthNames() {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        
        const monthKey = monthPicker.value;
        if (!monthKey || !this.data.months[monthKey]) return;
        
        const updatedData = this.data.months[monthKey].map(item => {
            const contact = this.data.names[item.phone];
            if (contact) {
                return {
                    ...item,
                    name: contact.name,
                    myPrice: contact.myPrice,
                    packageType: contact.packageType
                };
            }
            return item;
        });
        
        this.data.months[monthKey] = updatedData;
        await Firebase.saveMonth(monthKey, updatedData);
        
        if (APP_STATE.currentTab === 'lines') {
            UI.renderLines();
        }
        UI.generateAlerts();
    },
    
    loadMonth() {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        
        const monthKey = monthPicker.value;
        APP_STATE.currentMonthData = this.data.months[monthKey] || [];
        
        APP_STATE.currentMonthData.forEach(d => {
            if (!d.status) {
                d.status = d.paid ? 'paid' : 'unpaid';
                d.paidAmount = d.paid ? d.myPrice : 0;
            }
        });
        
        UI.renderLines();
        UI.renderStats();
    },
    
    async setPaymentStatus(phone, status) {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        
        const monthKey = monthPicker.value;
        const idx = APP_STATE.currentMonthData.findIndex(d => d.phone === phone);
        
        if (idx !== -1) {
            const line = APP_STATE.currentMonthData[idx];
            
            if (status === 'paid') {
                line.status = 'paid';
                line.paidAmount = line.myPrice;
                line.paid = true;
            } else if (status === 'unpaid') {
                line.status = 'unpaid';
                line.paidAmount = 0;
                line.paid = false;
            }
            
            this.data.months[monthKey] = APP_STATE.currentMonthData;
            await Firebase.saveMonth(monthKey, APP_STATE.currentMonthData);
            
            UI.renderLines();
            UI.renderStats();
            UI.generateAlerts();
        }
    },
    
    async submitPartialPayment(phone, amount) {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        
        const monthKey = monthPicker.value;
        const idx = APP_STATE.currentMonthData.findIndex(d => d.phone === phone);
        
        if (idx !== -1) {
            const line = APP_STATE.currentMonthData[idx];
            
            if (amount >= line.myPrice) {
                line.status = 'paid';
                line.paidAmount = line.myPrice;
                line.paid = true;
            } else {
                line.status = 'partially';
                line.paidAmount = amount;
                line.paid = false;
            }
            
            this.data.months[monthKey] = APP_STATE.currentMonthData;
            await Firebase.saveMonth(monthKey, APP_STATE.currentMonthData);
            
            UI.renderLines();
            UI.renderStats();
            UI.generateAlerts();
            UI.showToast("💾 تم تسجيل سداد الجزء سحابياً بنجاح");
        }
    },
    
    async cancelPayment(phone) {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        
        const monthKey = monthPicker.value;
        const idx = APP_STATE.currentMonthData.findIndex(d => d.phone === phone);
        
        if (idx !== -1) {
            const line = APP_STATE.currentMonthData[idx];
            line.status = 'unpaid';
            line.paidAmount = 0;
            line.paid = false;
            
            this.data.months[monthKey] = APP_STATE.currentMonthData;
            await Firebase.saveMonth(monthKey, APP_STATE.currentMonthData);
            
            UI.renderLines();
            UI.renderStats();
            UI.generateAlerts();
            UI.showToast("↩️ تم إلغاء الدفع وإرجاعه للحالة السابقة");
        }
    },
    
    checkPackagePrices() {
        const warnings = [];
        
        for (let phone in this.data.names) {
            const line = this.data.names[phone];
            const packageInfo = CONFIG.PACKAGES[line.packageType];
            
            if (packageInfo && line.myPrice < packageInfo.minPrice) {
                warnings.push({
                    phone: phone,
                    name: line.name,
                    packageType: line.packageType,
                    yourPrice: line.myPrice,
                    minPrice: packageInfo.minPrice,
                    difference: packageInfo.minPrice - line.myPrice
                });
            }
        }
        
        return warnings;
    },
    
    // ═══════════════════════════════════════
    // 🗑️ حذف الفواتير
    // ═══════════════════════════════════════
    
    async deleteMonth(monthKey) {
        if (!monthKey) {
            UI.showToast('⚠️ اختر الشهر الأول', 'warning');
            return;
        }
        
        if (!this.data.months[monthKey]) {
            UI.showToast('⚠️ هذا الشهر غير موجود', 'warning');
            return;
        }
        
        const lineCount = this.data.months[monthKey].length;
        
        if (confirm(`⚠️ هل أنت متأكد من حذف فاتورة شهر ${monthKey}؟\n\nعدد الخطوط: ${lineCount}\n\nلا يمكن التراجع عن هذا الإجراء!`)) {
            const backup = Backup.create('pre_delete');
            Backup.saveLocally(backup);
            
            await Firebase.request(`/months/${monthKey}`, 'DELETE');
            delete this.data.months[monthKey];
            
            if (document.getElementById('monthPicker')?.value === monthKey) {
                APP_STATE.currentMonthData = [];
                UI.renderLines();
                UI.renderStats();
            }
            
            UI.generateAlerts();
            UI.renderLinesTab();
            UI.showToast(`🗑️ تم حذف فاتورة شهر ${monthKey} بنجاح`);
        }
    },
    
    async deleteAllMonths() {
        const monthsCount = Object.keys(this.data.months).length;
        const totalLines = Object.values(this.data.months).reduce((sum, m) => sum + m.length, 0);
        
        if (confirm(`⚠️⚠️ تحذير خطير ⚠️⚠️\n\nحذف جميع الفواتير:\nعدد الشهور: ${monthsCount}\nإجمالي الخطوط: ${totalLines}\n\nلا يمكن التراجع! متأكد؟`)) {
            const backup = Backup.create('pre_delete_all');
            Backup.saveLocally(backup);
            
            await Firebase.request('/months', 'PUT', {});
            this.data.months = {};
            APP_STATE.currentMonthData = [];
            
            UI.renderLines();
            UI.renderStats();
            UI.generateAlerts();
            UI.renderLinesTab();
            
            UI.showToast('🗑️ تم حذف جميع الفواتير بنجاح');
        }
    },

    // ═══════════════════════════════════════
    // 🎯 حذف خط معين من الشهر
    // ═══════════════════════════════════════
    async deleteLineFromMonth(phone) {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        const monthKey = monthPicker.value;
        if (!this.data.months[monthKey]) return;
        
        const line = this.data.months[monthKey].find(d => d.phone === phone);
        if (!line) {
            UI.showToast('⚠️ الخط غير موجود في هذا الشهر', 'warning');
            return;
        }
        
        if (!confirm(`⚠️ حذف الخط ${line.name} (0${phone}) من شهر ${monthKey}؟`)) return;
        
        this.data.months[monthKey] = this.data.months[monthKey].filter(d => d.phone !== phone);
        APP_STATE.currentMonthData = this.data.months[monthKey];
        
        await Firebase.saveMonth(monthKey, this.data.months[monthKey]);
        UI.renderLines();
        UI.renderStats();
        UI.generateAlerts();
        UI.showToast('🗑️ تم حذف الخط من الفاتورة');
    },

    // ═══════════════════════════════════════
    // ✅ دفع جميع الخطوط دفعة واحدة
    // ═══════════════════════════════════════
    async payAllLines() {
        const monthPicker = document.getElementById('monthPicker');
        if (!monthPicker) return;
        const monthKey = monthPicker.value;
        if (!this.data.months[monthKey] || this.data.months[monthKey].length === 0) {
            UI.showToast('⚠️ لا يوجد خطوط في هذا الشهر', 'warning');
            return;
        }
        
        const unpaidCount = this.data.months[monthKey].filter(d => d.status !== 'paid').length;
        if (unpaidCount === 0) {
            UI.showToast('✅ جميع الخطوط مدفوعة بالفعل');
            return;
        }
        
        if (!confirm(`⚠️ تأكيد دفع ${unpaidCount} خط غير مدفوع؟`)) return;
        
        this.data.months[monthKey].forEach(d => {
            d.status = 'paid';
            d.paidAmount = d.myPrice;
            d.paid = true;
        });
        APP_STATE.currentMonthData = this.data.months[monthKey];
        
        await Firebase.saveMonth(monthKey, this.data.months[monthKey]);
        UI.renderLines();
        UI.renderStats();
        UI.generateAlerts();
        UI.showToast('✅ تم دفع جميع الخطوط بنجاح');
    },
    
    // ═══════════════════════════════════════
    // 📊 استيراد الأسماء من Excel
    // ═══════════════════════════════════════
    
    importNamesFromExcel(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet);
                
                let importedCount = 0;
                
                rows.forEach(row => {
                    const name = row['الاسم'] || row['name'] || row['Name'];
                    let phone = row['الرقم'] || row['phone'] || row['Phone'] || '';
                    const packageType = row['الباقة'] || row['package'] || row['Package'] || 'غير معروف';
                    const price = parseFloat(row['السعر'] || row['price'] || row['Price'] || row['سعرك']) || 0;
                    
                    phone = String(phone).replace(/^0+/, '').replace(/\s/g, '');
                    
                    if (name && phone && /^1[0-9]{9}$/.test(phone)) {
                        App.data.names[phone] = {
                            name: name,
                            myPrice: price,
                            packageType: packageType
                        };
                        importedCount++;
                    }
                });
                
                if (importedCount > 0) {
                    Firebase.saveNames(App.data.names);
                    UI.updateAllViews();
                    UI.showToast(`✅ تم استيراد ${importedCount} خط بنجاح`);
                } else {
                    UI.showToast('⚠️ لم يتم العثور على بيانات صالحة', 'warning');
                }
                
            } catch (error) {
                UI.showToast('❌ خطأ في قراءة ملف Excel', 'warning');
            }
        };
        reader.readAsArrayBuffer(file);
    },
    
    // ═══════════════════════════════════════
    // 💲 استيراد الأسعار من Excel
    // ═══════════════════════════════════════
    
    importPricesFromExcel(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet);
                
                let updatedCount = 0;
                
                rows.forEach(row => {
                    let phone = row['الرقم'] || row['phone'] || row['Phone'] || '';
                    const price = parseFloat(row['السعر'] || row['price'] || row['Price'] || row['سعرك']) || 0;
                    const packageType = row['الباقة'] || row['package'] || row['Package'] || '';
                    
                    phone = String(phone).replace(/^0+/, '').replace(/\s/g, '');
                    
                    if (phone && App.data.names[phone] && price > 0) {
                        App.data.names[phone].myPrice = price;
                        if (packageType) {
                            App.data.names[phone].packageType = packageType;
                        }
                        updatedCount++;
                    }
                });
                
                if (updatedCount > 0) {
                    Firebase.saveNames(App.data.names);
                    App.refreshMonthNames();
                    UI.updateAllViews();
                    UI.showToast(`✅ تم تحديث ${updatedCount} خط`);
                } else {
                    UI.showToast('⚠️ لم يتم العثور على أرقام مطابقة', 'warning');
                }
                
            } catch (error) {
                UI.showToast('❌ خطأ في قراءة ملف Excel', 'warning');
            }
        };
        reader.readAsArrayBuffer(file);
    },
    
    // ═══════════════════════════════════════
    // 🎯 استيراد فاتورة Vodafone Business (async + تحقق)
    // ═══════════════════════════════════════
    
    async importInvoiceFromExcel(file) {
        const uploadMonth = document.getElementById('uploadMonth');
        if (!uploadMonth) return;
        
        const monthKey = uploadMonth.value;
        if (!monthKey) {
            UI.showToast('⚠️ اختر الشهر أولاً', 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                let targetSheet = null;
                const sheetNames = [
                    'Vodafone Business Voice Lines Charges Summary',
                    'Business Voice Lines Charges',
                    'Charges Summary',
                    'Sheet1'
                ];
                
                for (let name of sheetNames) {
                    if (workbook.Sheets[name]) {
                        targetSheet = workbook.Sheets[name];
                        break;
                    }
                }
                if (!targetSheet) targetSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                const rows = XLSX.utils.sheet_to_json(targetSheet, { header: 1, defval: '' });
                if (!rows.length) throw new Error('الملف فارغ');
                
                let headerRowIndex = -1;
                let phoneColIndex = -1;
                let amountColIndex = -1;
                
                for (let i = 3; i < Math.min(15, rows.length); i++) {
                    const row = rows[i];
                    if (!row) continue;
                    
                    for (let j = 0; j < row.length; j++) {
                        const cell = String(row[j]).toLowerCase().trim();
                        if (cell.includes('mobile') || cell.includes('رقم') || cell.includes('number') || cell.includes('phone') || cell.includes('msisdn')) {
                            phoneColIndex = j;
                        }
                        if (cell.includes('total') || cell.includes('charge') || cell.includes('amount') || cell.includes('المبلغ') || cell.includes('فاتورة') || cell.includes('taxes')) {
                            amountColIndex = j;
                        }
                    }
                    
                    if (phoneColIndex >= 0 && amountColIndex >= 0) {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    phoneColIndex = 0;
                    amountColIndex = 9;
                    headerRowIndex = 3;
                    console.warn('⚠️ لم يتم العثور على عناوين، تم استخدام الأعمدة الافتراضية A & J');
                }
                
                console.log(`📊 الأعمدة: رقم=${phoneColIndex+1}, فاتورة=${amountColIndex+1}, صف العناوين=${headerRowIndex+1}`);
                
                const extractedLines = [];
                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length <= Math.max(phoneColIndex, amountColIndex)) continue;
                    
                    let phone = String(row[phoneColIndex] || '').trim();
                    phone = phone.replace(/^0+/, '').replace(/[\s\-\(\)]/g, '');
                    if (!/^1[0-9]{9}$/.test(phone)) continue;
                    
                    let rawAmount = String(row[amountColIndex] || '0').replace(/[^\d.]/g, '');
                    let invoicePrice = parseFloat(rawAmount) || 0;
                    if (invoicePrice === 0) continue;
                    
                    const existing = App.data.names[phone];
                    extractedLines.push({
                        phone,
                        name: existing ? existing.name : '(بدون اسم)',
                        myPrice: existing ? existing.myPrice : invoicePrice,
                        invoicePrice,
                        packageType: existing ? existing.packageType : 'غير مع
