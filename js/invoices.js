// ─── Invoiced Lines Screen ─────────────────────────────────────────
const invoices = {
  _filter: 'all',

  load() {
    const month = document.getElementById('invoiceMonth').value;
    updateHeaderMonth(month);
    this.render(month);
  },

  refresh() {
    const month = document.getElementById('invoiceMonth')?.value;
    if (month) this.render(month);
  },

  applyFilter() {
    this._filter = document.getElementById('invoiceFilter').value;
    this.load();
  },

  render(month) {
    const data = STATE.invoices[month] || {};
    const list = document.getElementById('invoicesList');
    const payAllBar = document.getElementById('payAllBar');

    let rows = Object.keys(data).map(phone => ({
      phone,
      ...data[phone],
      requiredAmount: parseFloat(data[phone].requiredAmount) || 0,
      paidAmount: parseFloat(data[phone].paidAmount) || 0,
    }));

    // Filter
    rows = rows.filter(inv => this._matchFilter(inv));

    // Sort: unpaid first, then partial, then paid
    rows.sort((a, b) => {
      const score = inv => inv.isPaid ? 2 : (inv.paidAmount > 0 ? 1 : 0);
      return score(a) - score(b);
    });

    // Show "pay all" bar if there are unpaid rows
    const hasUnpaid = Object.values(data).some(inv => !inv.isPaid);
    payAllBar.classList.toggle('hidden', !hasUnpaid || this._filter === 'paid');

    if (!rows.length) {
      list.innerHTML = `<div class="empty-state">لا توجد فواتير${month ? ' لشهر ' + formatMonth(month) : ''}</div>`;
      return;
    }

    list.innerHTML = rows.map(inv => this._card(inv, month)).join('');
  },

  _card(inv, month) {
    const req = inv.requiredAmount;
    const paid = inv.paidAmount;
    const rem = req - paid;
    const pct = req > 0 ? Math.min((paid / req) * 100, 100) : 0;
    const badge = this._badge(inv);

    return `
    <div class="invoice-card" id="inv-${inv.phone}">
      <div class="invoice-card-header">
        <div>
          <div class="invoice-card-name">${inv.name || '—'}</div>
          <div class="invoice-card-phone">📱 0${inv.phone}</div>
          <div class="invoice-card-pkg">${inv.package || ''}</div>
        </div>
        ${badge}
      </div>
      <div class="invoice-card-body">
        <div class="amounts-grid">
          <div class="amount-box">
            <div class="label">المطلوب</div>
            <div class="value">${req.toFixed(0)}</div>
          </div>
          <div class="amount-box paid">
            <div class="label">المدفوع</div>
            <div class="value">${paid.toFixed(0)}</div>
          </div>
          <div class="amount-box remaining">
            <div class="label">المتبقي</div>
            <div class="value">${rem.toFixed(0)}</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill ${pct >= 100 ? 'full' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="progress-label">${pct.toFixed(0)}% مدفوع</div>
        </div>
        <div class="invoice-card-actions">
          ${!inv.isPaid
            ? `<button class="btn-primary" onclick="invoices.pay('${month}','${inv.phone}',${req},${paid})">💰 تسجيل دفعة</button>`
            : `<button class="btn-outline" onclick="invoices.pay('${month}','${inv.phone}',${req},${paid})">✏️ تعديل الدفع</button>`
          }
          <button class="btn-outline" onclick="invoices.cancel('${month}','${inv.phone}')">↩️ إلغاء الدفع</button>
        </div>
      </div>
    </div>`;
  },

  pay(month, phone, req, paid) {
    const rem = req - paid;
    modal.open(
      'تسجيل دفعة',
      `${STATE.clients[phone]?.name || ''} | المطلوب: ${req} | المتبقي: ${rem.toFixed(0)}`,
      async (amount) => {
        await dbPayInvoice(month, phone, amount);
        showToast('تم تسجيل الدفعة ✅', 'success');
      }
    );
  },

  cancel(month, phone) {
    const name = STATE.clients[phone]?.name || `0${phone}`;
    deleteModal.open(`إلغاء دفع ${name}؟ سيتم إعادة الفاتورة لـ "غير مدفوع"`, async () => {
      await dbCancelPayment(month, phone);
      showToast('تم إلغاء الدفع', 'default');
    });
  },

  async payAll() {
    const month = document.getElementById('invoiceMonth').value;
    if (!month) { showToast('اختر الشهر أولاً', 'error'); return; }
    const data = STATE.invoices[month] || {};
    const count = Object.values(data).filter(i => !i.isPaid).length;
    deleteModal.open(`سيتم تحصيل ${count} خط غير مدفوع — هل تريد المتابعة؟`, async () => {
      await dbPayAll(month);
      showToast(`تم تحصيل ${count} خط بنجاح ✅`, 'success');
    });
  },

  _matchFilter(inv) {
    const f = this._filter;
    if (f === 'all') return true;
    const paid = inv.paidAmount;
    if (f === 'paid')    return inv.isPaid;
    if (f === 'unpaid')  return paid === 0;
    if (f === 'partial') return paid > 0 && !inv.isPaid;
    return true;
  },

  _badge(inv) {
    const paid = inv.paidAmount;
    if (inv.isPaid)   return `<span class="badge badge-paid">مدفوع</span>`;
    if (paid > 0)     return `<span class="badge badge-partial">جزئي</span>`;
    return `<span class="badge badge-unpaid">غير مدفوع</span>`;
  }
};
