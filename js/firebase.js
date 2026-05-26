// ═══════════════════════════════════════════
// التواصل مع Firebase
// ═══════════════════════════════════════════

const Firebase = {
    /**
     * إرسال طلب لـ Firebase
     */
    async request(path, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };
            
            if (body) {
                options.body = JSON.stringify(body);
            }
            
            const url = `${CONFIG.FIREBASE_URL}${path}.json`;
            const response = await fetch(url, options);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            UI.updateSyncStatus(true);
            return await response.json();
            
        } catch (error) {
            console.error('Firebase Error:', error);
            UI.updateSyncStatus(false);
            return null;
        }
    },
    
    /**
     * تحميل جميع البيانات من السحابة
     */
    async loadAllData() {
        const [names, months] = await Promise.all([
            this.request('/names'),
            this.request('/months')
        ]);
        
        return { names, months };
    },
    
    /**
     * حفظ الأسماء
     */
    async saveNames(names) {
        return await this.request('/names', 'PUT', names);
    },
    
    /**
     * حفظ بيانات شهر
     */
    async saveMonth(monthKey, data) {
        return await this.request(`/months/${monthKey}`, 'PUT', data);
    },
    
    /**
     * حفظ نسخة احتياطية للسحابة
     */
    async saveCloudBackup(backup) {
        return await this.request(`/backups/${backup.id}`, 'PUT', backup);
    },
    
    /**
     * تحميل النسخ الاحتياطية السحابية
     */
    async getCloudBackups() {
        return await this.request('/backups');
    },
    
    /**
     * حذف نسخة احتياطية سحابية
     */
    async deleteCloudBackup(backupId) {
        return await this.request(`/backups/${backupId}`, 'DELETE');
    },
    
    /**
     * حذف خط من الأسماء
     */
    async deleteName(phone) {
        return await this.request(`/names/${phone}`, 'DELETE');
    }
};
