// ═══════════════════════════════════════════
// نظام النسخ الاحتياطي والاستعادة
// ═══════════════════════════════════════════

const Backup = {
    /**
     * الحصول على جميع النسخ الاحتياطية المحلية
     */
    getAll() {
        try {
            const backups = localStorage.getItem(CONFIG.STORAGE_KEYS.BACKUPS);
            return backups ? JSON.parse(backups) : [];
        } catch (e) {
            console.error('خطأ في قراءة النسخ الاحتياطية:', e);
            return [];
        }
    },
    
    /**
     * حفظ قائمة النسخ الاحتياطية
     */
    saveList(backups) {
        try {
            // الاحتفاظ بآخر عدد محدد فقط
            if (backups.length > CONFIG.BACKUP.MAX_LOCAL_BACKUPS) {
                backups = backups.slice(0, CONFIG.BACKUP.MAX_LOCAL_BACKUPS);
            }
            localStorage.setItem(CONFIG.STORAGE_KEYS.BACKUPS, JSON.stringify(backups));
        } catch (e) {
            console.error('خطأ في حفظ النسخ الاحتياطية:', e);
            UI.showToast('❌ فشل حفظ النسخة الاحتياطية - قد تكون الذاكرة ممتلئة', 'warning');
        }
    },
    
    /**
     * إنشاء نسخة احتياطية جديدة
     */
    create(type = 'manual') {
        const backup = {
            id: Date.now(),
            date: new Date().toISOString(),
            dateFormatted: new Date().toLocaleString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            type: type,
            data: {
                names: JSON.parse(JSON.stringify(App.data.names)),
                months: JSON.parse(JSON.stringify(App.data.months))
            },
            stats: {
                namesCount: Object.keys(App.data.names).length,
                monthsCount: Object.keys(App.data.months).length
            }
        };
        
        // حساب الحجم
        const jsonStr = JSON.stringify(backup.data);
        backup.size = new Blob([jsonStr]).size;
        
        return backup;
    },
    
    /**
     * حفظ نسخة محلياً
     */
    saveLocally(backup) {
        const backups = this.getAll();
        backups.unshift(backup);
        this.saveList(backups);
        this.updateLastBackupTime();
        return backup;
    },
    
    /**
     * إنشاء وحفظ نسخة فورية
     */
    createNow() {
        UI.showBackupProgress('جاري إنشاء النسخة الاحتياطية...');
        
        setTimeout(() => {
            const backup = this.create('manual');
            this.saveLocally(backup);
            UI.showBackupProgress('');
            UI.showToast('✅ تم إنشاء النسخة الاحتياطية بنجاح!');
            UI.renderBackupHistory();
        }, 500);
    },
    
    /**
     * النسخ الاحتياطي التلقائي
     */
    startAuto() {
        if (!APP_STATE.autoBackupEnabled) return;
        
        if (APP_STATE.autoBackupTimer) {
            clearInterval(APP_STATE.autoBackupTimer);
        }
        
        // نسخة أولى بعد تأخير بسيط
        setTimeout(() => {
            if (APP_STATE.autoBackupEnabled) {
                const backup = this.create('auto');
                this.saveLocally(backup);
                console.log('🔄 نسخ احتياطي تلقائي:', backup.dateFormatted);
            }
        }, CONFIG.BACKUP.INITIAL_DELAY);
        
        // نسخ دوري
        APP_STATE.autoBackupTimer = setInterval(() => {
            if (APP_STATE.autoBackupEnabled) {
                const backup = this.create('auto');
                this.saveLocally(backup);
                console.log('🔄 نسخ احتياطي تلقائي:', backup.dateFormatted);
            }
        }, CONFIG.BACKUP.AUTO_INTERVAL);
    },
    
    /**
     * إيقاف النسخ التلقائي
     */
    stopAuto() {
        if (APP_STATE.autoBackupTimer) {
            clearInterval(APP_STATE.autoBackupTimer);
            APP_STATE.autoBackupTimer = null;
        }
    },
    
    /**
     * تبديل حالة النسخ التلقائي
     */
    toggleAuto() {
        APP_STATE.autoBackupEnabled = !APP_STATE.autoBackupEnabled;
        App.saveSettings();
        UI.updateAutoBackupUI();
        
        if (APP_STATE.autoBackupEnabled) {
            this.startAuto();
            UI.showToast('✅ تم تفعيل النسخ الاحتياطي التلقائي');
        } else {
            this.stopAuto();
            UI.showToast('⏸️ تم إيقاف النسخ الاحتياطي التلقائي');
        }
    },
    
    /**
     * استعادة نسخة احتياطية
     */
    restore(backupId) {
        const backups = this.getAll();
        const backup = backups.find(b => b.id === backupId);
        
        if (!backup) {
            UI.showToast('❌ النسخة الاحتياطية غير موجودة', 'warning');
            return;
        }
        
        if (confirm(`⚠️ هل أنت متأكد من استعادة النسخة بتاريخ ${backup.dateFormatted}؟\n\nسيتم استبدال جميع البيانات الحالية!`)) {
            // نسخ احتياطي للحالة الحالية
            const currentBackup = this.create('pre_restore');
            this.saveLocally(currentBackup);
            
            // استعادة البيانات
            App.data.names = backup.data.names;
            App.data.months = backup.data.months;
            
            // حفظ في السحابة
            Firebase.saveNames(App.data.names);
            Firebase.request('/months', 'PUT', App.data.months);
            
            // تحديث الواجهة
            UI.updateAllViews();
            
            UI.showToast('✅ تم استعادة النسخة الاحتياطية بنجاح!');
        }
    },
    
    /**
     * حذف نسخة احتياطية
     */
    delete(backupId) {
        if (confirm('⚠️ هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) {
            let backups = this.getAll();
            backups = backups.filter(b => b.id !== backupId);
            this.saveList(backups);
            UI.renderBackupHistory();
            UI.showToast('🗑️ تم حذف النسخة الاحتياطية');
        }
    },
    
    /**
     * مسح جميع النسخ المحلية
     */
    clearAll() {
        if (confirm('⚠️ هل أنت متأكد من مسح جميع النسخ الاحتياطية المحلية؟')) {
            localStorage.removeItem(CONFIG.STORAGE_KEYS.BACKUPS);
            UI.renderBackupHistory();
            UI.showToast('🗑️ تم مسح جميع النسخ الاحتياطية المحلية');
        }
    },
    
    /**
     * تحديث وقت آخر نسخة
     */
    updateLastBackupTime() {
        const backups = this.getAll();
        if (backups.length > 0) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_BACKUP, backups[0].dateFormatted);
        }
    },
    
    /**
     * الحصول على وقت آخر نسخة
     */
    getLastBackupTime() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_BACKUP) || 'لم تتم بعد';
    },
    
    // ═══════════════════════════════════════
    // وظائف التصدير
    // ═══════════════════════════════════════
    
    /**
     * تصدير Excel
     */
    exportToExcel() {
        const wb = XLSX.utils.book_new();
        
        // ورقة الأسماء
        const namesData = [];
        for (let phone in App.data.names) {
            const d = App.data.names[phone];
            namesData.push({
                'الاسم': d.name,
                'الرقم': '0' + phone,
                'الباقة': d.packageType,
                'السعر': d.myPrice,
                'ملاحظات': d.notes || ''
            });
        }
        const namesWS = XLSX.utils.json_to_sheet(namesData);
        XLSX.utils.book_append_sheet(wb, namesWS, 'الأسماء والمخزن');
        
        // ورقة لكل شهر
        for (let month in App.data.months) {
            const monthData = App.data.months[month].map(d => ({
                'الاسم': d.name,
                'الرقم': '0' + d.phone,
                'الباقة': d.packageType,
                'سعرك': d.myPrice,
                'سعر الفاتورة': d.invoicePrice,
                'الحالة': d.status === 'paid' ? 'مدفوع' : (d.status === 'partially' ? 'مدفوع جزئياً' : 'غير مدفوع'),
                'المدفوع': d.paidAmount || 0,
                'المتبقي': d.status === 'paid' ? 0 : (d.status === 'partially' ? d.myPrice - d.paidAmount : d.myPrice),
                'الربح': d.myPrice - d.invoicePrice
            }));
            const monthWS = XLSX.utils.json_to_sheet(monthData);
            XLSX.utils.book_append_sheet(wb, monthWS, month);
        }
        
        // ورقة ملخص الأرباح
        const profitsData = [];
        for (let month in App.data.months) {
            const data = App.data.months[month];
            const totalInvoice = data.reduce((s, d) => s + d.invoicePrice, 0);
            const totalMy = data.reduce((s, d) => s + d.myPrice, 0);
            const totalPaid = data.reduce((s, d) => s + (d.paidAmount || 0), 0);
            const totalUnpaid = totalMy - totalPaid;
            const profit = totalMy - totalInvoice;
            
            profitsData.push({
                'الشهر': month,
                'المطلوب لفودافون': totalInvoice,
                'التحصيل المتوقع': totalMy,
                'المحصل': totalPaid,
                'المتبقي': totalUnpaid,
                'صافي الربح': profit
            });
        }
        const profitsWS = XLSX.utils.json_to_sheet(profitsData);
        XLSX.utils.book_append_sheet(wb, profitsWS, 'ملخص الأرباح');
        
        XLSX.writeFile(wb, `فودافون_نسخة_${new Date().toISOString().split('T')[0]}.xlsx`);
        UI.showToast('📊 تم تصدير البيانات بصيغة Excel بنجاح!');
    },
    
    /**
     * تصدير JSON
     */
    exportToJSON() {
        const backup = this.create('export');
        const jsonStr = JSON.stringify(backup.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `فودافون_نسخة_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        UI.showToast('💾 تم تصدير البيانات بصيغة JSON بنجاح!');
    },
    
    /**
     * استيراد JSON
     */
    importFromJSON(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.names || !data.months) {
                    throw new Error('ملف JSON غير صالح');
                }
                
                const namesCount = Object.keys(data.names).length;
                const monthsCount = Object.keys(data.months).length;
                
                if (confirm(`⚠️ تأكيد استيراد البيانات:\n\nالخطوط: ${namesCount}\nالشهور: ${monthsCount}\n\nسيتم استبدال جميع البيانات الحالية!`)) {
                    // نسخ احتياطي قبل الاستيراد
                    const currentBackup = Backup.create('pre_import');
                    Backup.saveLocally(currentBackup);
                    
                    App.data.names = data.names;
                    App.data.months = data.months;
                    
                    Firebase.saveNames(App.data.names);
                    Firebase.request('/months', 'PUT', App.data.months);
                    
                    UI.updateAllViews();
                    UI.showToast('✅ تم استيراد البيانات بنجاح!');
                }
            } catch (error) {
                UI.showToast('❌ خطأ في قراءة الملف. تأكد من صحة ملف JSON', 'warning');
            }
        };
        reader.readAsText(file);
    },
    
    /**
     * رفع نسخة للسحابة
     */
    async uploadToCloud() {
        UI.showBackupProgress('جاري رفع النسخة الاحتياطية للسحابة...');
        
        const backup = this.create('cloud');
        const result = await Firebase.saveCloudBackup(backup);
        
        UI.showBackupProgress('');
        
        if (result) {
            this.saveLocally(backup);
            UI.showToast('☁️ تم رفع النسخة الاحتياطية للسحابة بنجاح!');
            UI.renderCloudBackups();
        } else {
            UI.showToast('❌ فشل رفع النسخة الاحتياطية للسحابة', 'warning');
        }
    },
    
    /**
     * استعادة نسخة من السحابة
     */
    async restoreFromCloud(backupId) {
        if (confirm('⚠️ هل أنت متأكد من استعادة هذه النسخة السحابية؟')) {
            const cloudBackup = await Firebase.request(`/backups/${backupId}`);
            
            if (cloudBackup && cloudBackup.data) {
                const currentBackup = this.create('pre_cloud_restore');
                this.saveLocally(currentBackup);
                
                App.data.names = cloudBackup.data.names;
                App.data.months = cloudBackup.data.months;
                
                await Firebase.saveNames(App.data.names);
                await Firebase.request('/months', 'PUT', App.data.months);
                
                UI.updateAllViews();
                UI.showToast('✅ تم استعادة النسخة السحابية بنجاح!');
            }
        }
    }
};
