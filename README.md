# نظام فودافون للتحصيل المطور

نظام تحصيل فواتير فودافون مع Firebase — جاهز للرفع على GitHub Pages.

## هيكل الملفات

```
vodafone-system/
├── index.html          ← الصفحة الرئيسية
├── css/
│   └── style.css       ← التصميم الكامل
└── js/
    ├── config.js       ← إعدادات Firebase وقائمة الباقات
    ├── firebase-db.js  ← عمليات قاعدة البيانات
    ├── app.js          ← التحكم العام في التطبيق
    ├── search.js       ← شاشة البحث والتحصيل
    ├── invoices.js     ← شاشة الخطوط المفوترة
    ├── upload.js       ← شاشة رفع الفواتير
    ├── clients.js      ← شاشة بيانات الخطوط
    └── packages.js     ← شاشة أسعار الباقات
```

## خطوات الرفع على GitHub Pages

1. افتح GitHub وأنشئ Repository جديد (مثلاً: `vodafone-system`)
2. ارفع جميع الملفات والمجلدات كما هي
3. اذهب إلى **Settings → Pages**
4. اختر `main` branch و `/root` folder
5. احفظ — سيعطيك الرابط خلال دقيقة

## تعديل إعدادات Firebase

افتح `js/config.js` وعدّل `firebaseConfig` بإعداداتك الخاصة.

## إضافة باقة جديدة

افتح `js/config.js` وأضف اسم الباقة في مصفوفة `PACKAGE_LIST`.
