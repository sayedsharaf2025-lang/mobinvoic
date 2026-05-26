// ─── Firebase Configuration ───────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBfFRxvmhg8aqtuDgXAOofFGpVPklUF-gs",
  authDomain: "mobile-invoic-118d4.firebaseapp.com",
  projectId: "mobile-invoic-118d4",
  databaseURL: "https://mobile-invoic-118d4-default-rtdb.firebaseio.com/",
  storageBucket: "mobile-invoic-118d4.firebasestorage.app",
  messagingSenderId: "795305971254",
  appId: "1:795305971254:web:7e8e874cfd805d33ec1297"
};

// ─── Package List ──────────────────────────────────────────────────
const PACKAGE_LIST = [
  "Flex 45 Revamp",
  "Flex 52 Revamp",
  "Flex 60 Revamp",
  "Flex 90 Revamp",
  "Flex 125 Revamp",
  "2022 Business Flex 65",
  "2025 Business Flex 70",
  "2025 Business Flex 100",
  "2025 Business Flex 150",
  "Free SPOC Flex45"
];

// ─── Global State ──────────────────────────────────────────────────
const STATE = {
  clients: {},
  invoices: {},
  packagePrices: {}
};

// ─── Current Month Helper ──────────────────────────────────────────
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Format Month ──────────────────────────────────────────────────
function formatMonth(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

// ─── Normalize phone (remove leading 0) ───────────────────────────
function normalizePhone(p) {
  return String(p || '').replace(/^0+/, '').trim();
}

// ─── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}
