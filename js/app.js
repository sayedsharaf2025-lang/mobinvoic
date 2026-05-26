// ─── Tab Management ────────────────────────────────────────────────
function showTab(tab, btn) {
  ['search','lines','upload','clients','packages'].forEach(t => {
    document.getElementById('tab-' + t).classList.add('hidden');
  });
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ─── Modal: Payment ────────────────────────────────────────────────
const modal = {
  _cb: null,
  open(title, info, cb) {
    document.getElementById('payModalTitle').textContent = title;
    document.getElementById('payModalInfo').textContent = info;
    document.getElementById('payAmount').value = '';
    document.getElementById('payModal').classList.remove('hidden');
    this._cb = cb;
    setTimeout(() => document.getElementById('payAmount').focus(), 100);
  },
  close() {
    document.getElementById('payModal').classList.add('hidden');
    this._cb = null;
  },
  confirm() {
    const amount = parseFloat(document.getElementById('payAmount').value);
    if (!amount || amount <= 0) { showToast('أدخل مبلغاً صحيحاً', 'error'); return; }
    if (this._cb) this._cb(amount);
    this.close();
  }
};

// ─── Modal: Delete Confirm ─────────────────────────────────────────
const deleteModal = {
  _cb: null,
  open(text, cb) {
    document.getElementById('deleteModalText').textContent = text;
    document.getElementById('deleteModal').classList.remove('hidden');
    this._cb = cb;
  },
  close() {
    document.getElementById('deleteModal').classList.add('hidden');
    this._cb = null;
  },
  confirm() {
    if (this._cb) this._cb();
    this.close();
  }
};

// ─── Init Package Selects ──────────────────────────────────────────
function initPackageSelects() {
  const sel = document.getElementById('clientPackage');
  sel.innerHTML = PACKAGE_LIST.map(p => `<option value="${p}">${p}</option>`).join('');
}

// ─── Update Header Month ───────────────────────────────────────────
function updateHeaderMonth(m) {
  const el = document.getElementById('headerMonth');
  el.textContent = m ? formatMonth(m) : '';
}

// ─── Enter key on payment modal ───────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('payModal').classList.contains('hidden')) {
    modal.confirm();
  }
  if (e.key === 'Escape') {
    modal.close();
    deleteModal.close();
  }
});

// ─── Init ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set default months to current month
  const cm = getCurrentMonth();
  document.getElementById('searchMonth').value = cm;
  document.getElementById('invoiceMonth').value = cm;
  document.getElementById('uploadMonth').value = cm;
  updateHeaderMonth(cm);

  initPackageSelects();
  startListeners();
});
