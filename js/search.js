// ─── Search & Collection Screen ────────────────────────────────────
const search = {
  filter: 'all',

  setFilter(f, btn) {
    this.filter = f;
    document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.applyFilters();
  },

  applyFilters() {
    const q     = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const month = document.getElementById('searchMonth')?.value || '';
    updateHeaderMonth(month);

    const container = document.getElementById('searchResults');
    if (!container) return;

    // Group by name — show all clients if no query, else filter
    const matchedPhones = Object.keys(STATE.clients).filter(phone => {
      const c = STATE.clients[phone];
      if (!q) return true;
      return (c.name || '').toLowerCase().includes(q) || phone.includes(q);
    });

    if (!matchedPhones.length) {
      container.innerHTML = `<div class="empty-state">لا توجد نتائج</div>`;
      return;
    }

    // Group by name for multi-line clients
    const groups = {};
    matchedPhones.forEach(phone => {
      const c  = STATE.clients[phone];
      const nm = c.name || phone;
      if (!groups[nm]) groups[nm] = [];
      groups[nm].push(phone);
    });

    let html = '';
    Object.keys(groups).forEach(name => {
      const phones = groups[name];

      // Collect invoices for this name across all months (or selected month)
      let monthsToShow = month
        ? [month]
        : Object.keys(STATE.invoices).sort().reverse();

      let allInvoices = [];
      phones.forEach(phone => {
        monthsToShow.forEach(m => {
          const inv = STATE.invoices[m]?.[phone];
          if (inv) {
            allInvoices.push({ ...inv, month: m, phone, clientPhone: phone });
          }
        });
      });

      // Apply status filter
      allInvoices = allInvoices.filter(inv => this._matchFilter(inv));

      if (this.filter !== 'all' && !allInvoices.length) return;

      // Summary totals
      let totalReq = 0, totalPaid = 0;
      allInvoices.forEach(inv => {
        totalReq  += parseFloat(inv.requiredAmount) || 0;
        totalPaid += parseFloat(inv.paidAmount) || 0;
      });
      const totalRem = totalReq - totalPaid;
      const balance  = totalPaid - totalReq; // positive = credit

      // Determine display phone
      const displayPhone = phones.length === 1 ? `0${phones[0]}` : `${phones.length} خطوط`;
      const client = STATE.clients[phones[0]] || {};

      html += `<div class="client-result">`;

      // Header
      html += `<div class="client-result-header">
        <div>
          <div class="client-result-name">${name}</div>
          <div class="client-result-phone">${displayPhone} ${client.packageType ? '· ' + client.packageType : ''}</div>
        </div>
        <div>${this._overallBadge(allInvoices)}</div>
      </div>`;

      // Summary (only if multi-line or multi-month)
      if (phones.length > 1 || allInvoices.length > 1) {
        const isCredit = balance > 0;
        html += `<div class="summary-row ${isCredit ? 'summary-credit' : ''}">
          <div class="summary-item">إجمالي المطلوب: <strong>${totalReq.toFixed(0)} ج</strong></div>
          <div class="summary-item">إجمالي المدفوع: <strong>${totalPaid.toFixed(0)} ج</strong></div>
          <div class="summary-item">
            ${isCredit
              ? `رصيد دائن: <strong>${Math.abs(balance).toFixed(0)} ج</strong>`
              : `متبقي: <strong>${Math.abs(totalRem).toFixed(0)} ج</strong>`}
          </div>
        </div>`;
      }

      // Invoice rows
      if (allInvoices.length === 0) {
        html += `<div class="invoice-row"><span class="hint">لا توجد فواتير للشهر المحدد</span></div>`;
      }

      allInvoices.forEach(inv => {
        const req = parseFloat(inv.requiredAmount) || 0;
        const paid= parseFloat(inv.paidAmount) || 0;
        const rem = req - paid;
        const pct = req > 0 ? Math.min((paid / req) * 100, 100) : 0;
        const badge = this._badge(inv);
        const isFullyPaid = inv.isPaid;

        html += `<div class="invoice-row">
          <div class="invoice-row-top">
            <span class="invoice-month">${formatMonth(inv.month)}</span>
            ${phones.length > 1 ? `<span class="hint">0${inv.phone}</span>` : ''}
            ${badge}
          </div>
          <div class="invoice-amounts">
            <span>المطلوب: <strong>${req.toFixed(0)}</strong></span>
            <span>المدفوع: <strong>${paid.toFixed(0)}</strong></span>
            <span>المتبقي: <strong>${rem.toFixed(0)}</strong></span>
          </div>
          <div class="progress-wrap">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${pct >= 100 ? 'full' : ''}" style="width:${pct}%"></div>
            </div>
            <div class="progress-label">${pct.toFixed(0)}%</div>
          </div>
          <div class="invoice-actions">
            ${!isFullyPaid
              ? `<button class="btn-primary" onclick="search.pay('${inv.month}','${inv.phone}',${req},${paid})">💰 دفع</button>`
              : `<button class="btn-outline" onclick="search.pay('${inv.month}','${inv.phone}',${req},${paid})">✏️ تعديل</button>`
            }
            <button class="btn-outline" onclick="search.cancel('${inv.month}','${inv.phone}')">↩️ إلغاء</button>
          </div>
        </div>`;
      });

      html += `</div>`;
    });

    container.innerHTML = html || `<div class="empty-state">لا توجد نتائج مطابقة</div>`;
  },

  pay(month, phone, req, paid) {
    const rem = req - paid;
    modal.open(
      'تسجيل دفعة',
      `المطلوب: ${req} | المدفوع: ${paid} | المتبقي: ${rem.toFixed(0)}`,
      async (amount) => {
        await dbPayInvoice(month, phone, amount);
        showToast('تم تسجيل الدفعة بنجاح ✅', 'success');
      }
    );
  },

  cancel(month, phone) {
    deleteModal.open('هل تريد إلغاء الدفع وإعادة الفاتورة لغير مدفوع؟', async () => {
      await dbCancelPayment(month, phone);
      showToast('تم إلغاء الدفع', 'default');
    });
  },

  _matchFilter(inv) {
    const f = this.filter;
    if (f === 'all') return true;
    const paid = parseFloat(inv.paidAmount) || 0;
    const req  = parseFloat(inv.requiredAmount) || 0;
    if (f === 'paid')    return inv.isPaid;
    if (f === 'unpaid')  return paid === 0;
    if (f === 'partial') return paid > 0 && !inv.isPaid;
    if (f === 'prepaid') return paid > req;
    return true;
  },

  _badge(inv) {
    const paid = parseFloat(inv.paidAmount) || 0;
    const req  = parseFloat(inv.requiredAmount) || 0;
    if (paid > req)     return `<span class="badge badge-prepaid">مقدم</span>`;
    if (inv.isPaid)     return `<span class="badge badge-paid">مدفوع</span>`;
    if (paid > 0)       return `<span class="badge badge-partial">جزئي</span>`;
    return `<span class="badge badge-unpaid">لم يدفع</span>`;
  },

  _overallBadge(invs) {
    if (!invs.length) return '';
    const allPaid    = invs.every(i => i.isPaid);
    const anyPartial = invs.some(i => parseFloat(i.paidAmount) > 0 && !i.isPaid);
    if (allPaid)    return `<span class="badge badge-paid">مدفوع</span>`;
    if (anyPartial) return `<span class="badge badge-partial">جزئي</span>`;
    return `<span class="badge badge-unpaid">لم يدفع</span>`;
  }
};
