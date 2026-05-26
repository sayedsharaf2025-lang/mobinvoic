// ═══════════════════════════════════════════
// المنطق الرئيسي للتطبيق
// ═══════════════════════════════════════════

const App = {
    data: {
        names: {},
        months: {}
    },
    
    /**
     * تهيئة التطبيق
     */
    async init() {
        // تحميل الإعدادات
        this.loadSettings();
        
        // تحميل البيانات من السحابة
        await this.loadCloudData();
        
        // بدء النسخ الاحتياطي التلقائي
        Backup.startAuto();
        
        // عرض التبويب الافتراضي
        UI.showTab('alerts');
        
        // تعيين الشهر الحالي
        const now = new Date();
        const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        document.getElementById('monthPicker').value = currentMonth;
        document.getElementById('uploadMonth').value = currentMonth;
        
        // مستمع تغيير الملف
        document.getElementById('pdfInput').addEventListener('change', function() {
            document.getElementById('uploadFileName').textContent = 
                this.files[0]?.name || 'اضغط لاختيار ملف PDF الفاتورة الأصلي';
        });
        
        console.log('✅ تم تهيئة نظام فودافون السحابي بنجاح');
    },
    
    /**
     * تحميل الإعدادات المحفوظة
     */
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
    
    /**
     * حفظ الإعدادات
     */
    saveSettings() {
        const settings = {
            darkMode: APP_STATE.isDarkMode,
            autoBackup: APP_STATE.autoBackupEnabled
        };
        localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },
    
    /**
     * تحميل البيانات السحابية
     */
    async loadCloudData() {
        const cloudData = await Firebase.loadAllData();
        
        if (cloudData.names && Object.keys(cloudData.names).length > 0) {
            this.data.names = cloudData.names;
        } else {
            // استخدام البيانات الافتراضية
            this.data.names = DEFAULT_DATA.names;
            await Firebase.saveNames(this.data.names);
        }
        
        if (cloudData.months) {
            this.data.months = cloudData.months;
        }
        
        UI.updateAllViews();
    },
    
    /**
     * تحديث أسماء شهر معين
     */
    async refreshMonthNames() {
        const monthKey = document.getElementById('monthPicker').value;
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
    
    /**
     * تحميل بيانات شهر
     */
    loadMonth() {
        const monthKey = document.getElementById('monthPicker').value;
        APP_STATE.currentMonthData = this.data.months[monthKey] || [];
        
        // إصلاح البيانات القديمة
        APP_STATE.currentMonthData.forEach(d => {
            if (!d.status) {
                d.status = d.paid ? 'paid' : 'unpaid';
                d.paidAmount = d.paid ? d.myPrice : 0;
            }
        });
        
        UI.renderLines();
        UI.renderStats();
    },
    
    /**
     * تعيين حالة الدفع
     */
    async setPaymentStatus(phone, status) {
        const monthKey = document.getElementById('monthPicker').value;
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
    
    /**
     * تسجيل دفعة جزئية
     */
    async submitPartialPayment(phone, amount) {
        const monthKey = document.getElementById('monthPicker').value;
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
    
    /**
     * إلغاء الدفع وإرجاعه للحالة السابقة
     */
    async cancelPayment(phone) {
        const monthKey = document.getElementById('monthPicker').value;
        const idx = APP_STATE.currentMonthData.findIndex(d => d.phone === phone);
        
        if (idx !== -1) {
            const line = APP_STATE.currentMonthData[idx];
            const previousStatus = line.previousStatus || 'unpaid';
            const previousAmount = line.previousPaidAmount || 0;
            
            line.status = previousStatus;
            line.paidAmount = previousAmount;
            line.paid = previousStatus === 'paid';
            
            // حفظ الحالة السابقة للتراجع
            delete line.previousStatus;
            delete line.previousPaidAmount;
            
            this.data.months[monthKey] = APP_STATE.currentMonthData;
            await Firebase.saveMonth(monthKey, APP_STATE.currentMonthData);
            
            UI.renderLines();
            UI.renderStats();
            UI.generateAlerts();
            UI.showToast("↩️ تم إلغاء الدفع وإرجاعه للحالة السابقة");
        }
    },
    
    /**
     * التحقق من أسعار الباقات
     */
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
    
    /**
     * رفع ملف Excel للأسماء
     */
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
                    let phone = row['الرقم'] || row['الرقم بدون 0'] || row['phone'] || row['Phone'] || '';
                    const packageType = row['الباقة'] || row['package'] || row['Package'] || 'غير معروف';
                    const price = parseFloat(row['السعر'] || row['price'] || row['Price'] || row['سعرك']) || 0;
                    
                    // تنظيف الرقم
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
                    UI.showToast(`✅ تم استيراد ${importedCount} خط بنجاح من ملف Excel`);
                } else {
                    UI.showToast('⚠️ لم يتم العثور على بيانات صالحة في الملف', 'warning');
                }
                
            } catch (error) {
                UI.showToast('❌ خطأ في قراءة ملف Excel', 'warning');
            }
        };
        reader.readAsArrayBuffer(file);
    },
    
    /**
     * رفع ملف Excel لخطة الأسعار
     */
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
                    UI.showToast(`✅ تم تحديث أسعار ${updatedCount} خط بنجاح`);
                } else {
                    UI.showToast('⚠️ لم يتم العثور على أرقام مطابقة في المخزن', 'warning');
                }
                
            } catch (error) {
                UI.showToast('❌ خطأ في قراءة ملف Excel', 'warning');
            }
        };
        reader.readAsArrayBuffer(file);
    },
    
    /**
     * رفع فاتورة شهرية بصيغة Excel
     */
    importInvoiceFromExcel(file) {
        const monthKey = document.getElementById('uploadMonth').value;
        if (!monthKey) {
            UI.showToast('⚠️ اختر الشهر أولاً', 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet);
                
                const monthData = [];
                let newNamesAdded = false;
                
                rows.forEach(row => {
                    let phone = row['الرقم'] || row['phone'] || row['Phone'] || '';
                    const invoicePrice = parseFloat(row['الفاتورة'] || row['invoice'] || row['سعر الفاتورة'] || row['amount']) || 0;
                    let packageType = row['الباقة'] || row['package'] || row['Package'] || '';
                    
                    phone = String(phone).replace(/^0+/, '').replace(/\s/g, '');
                    
                    if (phone && /^1[0-9]{9}$/.test(phone)) {
                        // إضافة للاسماء لو مش موجود
                        if (!App.data.names[phone]) {
                            App.data.names[phone] = {
                                name: row['الاسم'] || row['name'] || '(بدون اسم)',
                                myPrice: invoicePrice,
                                packageType: packageType || 'غير معروف'
                            };
                            newNamesAdded = true;
                        } else if (packageType) {
                            App.data.names[phone].packageType = packageType;
                        }
                        
                        monthData.push({
                            phone: phone,
                            name: App.data.names[phone].name,
                            myPrice: App.data.names[phone].myPrice,
                            invoicePrice: invoicePrice,
                            packageType: App.data.names[phone].packageType,
                            status: 'unpaid',
                            paidAmount: 0
                        });
                    }
                });
                
                if (monthData.length > 0) {
                    if (newNamesAdded) {
                        await Firebase.saveNames(App.data.names);
                    }
                    
                    await Firebase.saveMonth(monthKey, monthData);
                    App.data.months[monthKey] = monthData;
                    
                    UI.updateAllViews();
                    UI.showTab('lines');
                    UI.showToast(`✅ تم رفع فاتورة شهر ${monthKey} بنجاح (${monthData.length} خط)`);
                } else {
                    UI.showToast('⚠️ لم يتم العثور على بيانات صالحة في الملف', 'warning');
                }
                
            } catch (error) {
                UI.showToast('❌ خطأ في قراءة ملف Excel', 'warning');
            }
        };
        reader.readAsArrayBuffer(file);
    }
};

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
