// ═══════════════════════════════════════════
// إعدادات وثوابت نظام فودافون
// ═══════════════════════════════════════════

const CONFIG = {
    // إعدادات Firebase
    FIREBASE_URL: "https://mobile-invoic-default-rtdb.firebaseio.com/",
    
    // إعدادات التخزين المحلي
    STORAGE_KEYS: {
        BACKUPS: "vodafone_system_backups",
        SETTINGS: "vodafone_system_settings",
        LAST_BACKUP: "vodafone_last_backup"
    },
    
    // إعدادات النسخ الاحتياطي
    BACKUP: {
        AUTO_INTERVAL: 24 * 60 * 60 * 1000, // 24 ساعة
        MAX_LOCAL_BACKUPS: 20,
        INITIAL_DELAY: 10000 // 10 ثواني
    },
    
    // إعدادات الباقات المعروفة للمقارنة
    PACKAGES: {
        "FlexRevamp": { minPrice: 60, maxPrice: 100, name: "Flex Revamp" },
        "BusinessFlex": { minPrice: 110, maxPrice: 200, name: "Business Flex" },
        "BusinessFlex+": { minPrice: 160, maxPrice: 250, name: "Business Flex+" },
        "FreeSPOCFlex": { minPrice: 0, maxPrice: 20, name: "Free SPOC Flex" },
        "غير معروف": { minPrice: 0, maxPrice: 999, name: "غير معروف" }
    },
    
    // إعدادات الواجهة
    UI: {
        TOAST_DURATION: 3000,
        ANIMATION_DURATION: 300
    }
};

// حالة التطبيق العامة
const APP_STATE = {
    currentTab: 'alerts',
    currentFilter: 'all',
    currentMonthData: [],
    isDarkMode: false,
    autoBackupEnabled: true,
    autoBackupTimer: null,
    isOnline: navigator.onLine
};
