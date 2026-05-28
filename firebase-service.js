// ============================================================
// firebase-service.js
// خدمة Firebase الكاملة لنظام إدارة خطوط المحمول
// ============================================================

// ---------------------------------------------------------------
// 1. إعداد Firebase (ضع بياناتك هنا)
// ---------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc, query, where,
  orderBy, onSnapshot, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ---------------------------------------------------------------
// 2. بنية Firestore Collections
// ---------------------------------------------------------------
// lines/{lineId}        → name, number, plan, price, debt
// bills/{billId}        → number, name, month, amount, paidAmount, status, uploadDate
// settings/plans        → { plans: [{id, name, price}] }
// settings/alerts       → { alerts: [{id, lineNumber, ...}] }
// prepaid/{prepaidId}   → number, name, amount, note, date

// ---------------------------------------------------------------
// 3. خدمة الخطوط (Lines Service)
// ---------------------------------------------------------------
export const LinesService = {

  /** الاستماع للخطوط في الوقت الفعلي */
  onSnapshot(callback) {
    return onSnapshot(collection(db, "lines"), snap => {
      const lines = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(lines);
    });
  },

  /** جلب جميع الخطوط */
  async getAll() {
    const snap = await getDocs(collection(db, "lines"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /** إضافة خط جديد */
  async add(lineData) {
    const docRef = await addDoc(collection(db, "lines"), {
      name:      lineData.name      || "بدون اسم",
      number:    lineData.number,
      plan:      lineData.plan      || "",
      price:     lineData.price     || 0,
      debt:      lineData.debt      || 0,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  /** تحديث خط */
  async update(id, data) {
    await updateDoc(doc(db, "lines", id), { ...data, updatedAt: serverTimestamp() });
  },

  /** حذف خط */
  async delete(id) {
    await deleteDoc(doc(db, "lines", id));
  },

  /** تحديث المديونية */
  async updateDebt(id, debt) {
    await updateDoc(doc(db, "lines", id), { debt, updatedAt: serverTimestamp() });
  },

  /** استيراد مجموعة خطوط (batch) */
  async importBatch(linesArray) {
    const batch = writeBatch(db);
    linesArray.forEach(line => {
      const ref = doc(collection(db, "lines"));
      batch.set(ref, {
        name: line.name || "بدون اسم", number: line.number,
        plan: line.plan || "", price: line.price || 0,
        debt: 0, createdAt: serverTimestamp()
      });
    });
    await batch.commit();
  }
};

// ---------------------------------------------------------------
// 4. خدمة الفواتير (Bills Service)
// ---------------------------------------------------------------
export const BillsService = {

  /** الاستماع للفواتير في الوقت الفعلي */
  onSnapshot(callback) {
    return onSnapshot(query(collection(db, "bills"), orderBy("uploadDate", "desc")), snap => {
      const bills = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(bills);
    });
  },

  /** جلب فواتير شهر معين */
  async getByMonth(month) {
    const q = query(collection(db, "bills"), where("month", "==", month));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /** جلب فواتير رقم معين */
  async getByNumber(number) {
    const q = query(collection(db, "bills"), where("number", "==", number));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  /** التحقق من وجود فاتورة (لمنع التكرار) */
  async exists(number, month) {
    const q = query(collection(db, "bills"),
      where("number", "==", number), where("month", "==", month));
    const snap = await getDocs(q);
    return !snap.empty;
  },

  /** حفظ فاتورة */
  async add(billData) {
    const docRef = await addDoc(collection(db, "bills"), {
      number:      billData.number,
      name:        billData.name || "بدون اسم",
      month:       billData.month,
      amount:      billData.amount,
      paidAmount:  billData.paidAmount || 0,
      status:      billData.status || "unpaid",
      uploadDate:  serverTimestamp()
    });
    return docRef.id;
  },

  /** حفظ فواتير الشهر دفعة واحدة (Staging → Save) */
  async saveBatch(billsArray) {
    const batch = writeBatch(db);
    const ids = [];
    billsArray.forEach(bill => {
      const ref = doc(collection(db, "bills"));
      ids.push(ref.id);
      batch.set(ref, {
        number: bill.number, name: bill.name || "بدون اسم",
        month: bill.month, amount: bill.amount,
        paidAmount: 0, status: "unpaid",
        uploadDate: serverTimestamp()
      });
    });
    await batch.commit();
    return ids;
  },

  /** تحديث حالة الدفع */
  async updatePayment(id, { paidAmount, status }) {
    await updateDoc(doc(db, "bills", id), {
      paidAmount, status, updatedAt: serverTimestamp()
    });
  },

  /** حذف فواتير شهر كامل */
  async deleteByMonth(month) {
    const q = query(collection(db, "bills"), where("month", "==", month));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  },

  /** الدفع الجماعي */
  async bulkPay(month = null) {
    let q = collection(db, "bills");
    if (month) q = query(q, where("month", "==", month), where("status", "!=", "paid"));
    else q = query(q, where("status", "!=", "paid"));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, {
        paidAmount: d.data().amount,
        status: "paid",
        updatedAt: serverTimestamp()
      });
    });
    await batch.commit();
    return snap.size;
  }
};

// ---------------------------------------------------------------
// 5. خدمة الإعدادات (Settings Service)
// ---------------------------------------------------------------
export const SettingsService = {

  /** جلب خطط الأسعار */
  async getPlans() {
    const snap = await getDoc(doc(db, "settings", "plans"));
    return snap.exists() ? (snap.data().plans || []) : [];
  },

  /** حفظ خطط الأسعار */
  async savePlans(plans) {
    await setDoc(doc(db, "settings", "plans"), { plans, updatedAt: serverTimestamp() });
  },

  /** إضافة خطة */
  async addPlan(plan) {
    const plans = await this.getPlans();
    if (plans.find(p => p.name === plan.name)) throw new Error("الخطة موجودة مسبقاً");
    plans.push({ ...plan, id: crypto.randomUUID() });
    await this.savePlans(plans);
    return plans;
  },

  /** حذف خطة */
  async deletePlan(id) {
    let plans = await this.getPlans();
    plans = plans.filter(p => p.id !== id);
    await this.savePlans(plans);
    return plans;
  },

  /** جلب التنبيهات */
  async getAlerts() {
    const snap = await getDoc(doc(db, "settings", "alerts"));
    return snap.exists() ? (snap.data().alerts || []) : [];
  },

  /** حفظ التنبيهات */
  async saveAlerts(alerts) {
    await setDoc(doc(db, "settings", "alerts"), { alerts, updatedAt: serverTimestamp() });
  }
};

// ---------------------------------------------------------------
// 6. خدمة الدفع المقدم (Prepaid Service)
// ---------------------------------------------------------------
export const PrepaidService = {
  async add({ number, name, amount, note }) {
    const docRef = await addDoc(collection(db, "prepaid"), {
      number, name, amount, note: note || "",
      date: serverTimestamp()
    });
    return docRef.id;
  },

  async getByNumber(number) {
    const q = query(collection(db, "prepaid"), where("number", "==", number));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

// ---------------------------------------------------------------
// 7. خدمة المصادقة (Auth Service)
// ---------------------------------------------------------------
export const AuthService = {
  async login(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
  },
  async logout() {
    return await signOut(auth);
  },
  onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
  },
  getCurrentUser() {
    return auth.currentUser;
  }
};

// ---------------------------------------------------------------
// 8. مثال على الاستخدام في الكود الرئيسي
// ---------------------------------------------------------------
/*

// --- تهيئة عند تحميل الصفحة ---
import { LinesService, BillsService, SettingsService } from './firebase-service.js';

// الاستماع للخطوط في الوقت الفعلي
LinesService.onSnapshot(lines => {
  state.lines = lines;
  renderLines();
  updateStats();
});

// جلب الخطط عند البدء
SettingsService.getPlans().then(plans => {
  state.plans = plans;
  renderPlans();
});

// --- إضافة خط ---
await LinesService.add({ name: 'محمد أحمد', number: '0512345678', plan: 'خطة الأعمال', price: 200 });

// --- حفظ فاتورة ---
const stagingBills = state.staging.map(r => ({
  number: r.number, name: r.name, month: state.stagingMonth, amount: r.amount
}));
await BillsService.saveBatch(stagingBills);

// --- دفع فاتورة ---
await BillsService.updatePayment(billId, { paidAmount: bill.amount, status: 'paid' });
await LinesService.updateDebt(lineId, newDebt);

// --- حذف فواتير شهر ---
await BillsService.deleteByMonth('مايو 2025');

*/

export { db, auth };
