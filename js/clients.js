// ─── Client Management Screen ──────────────────────────────────────
const clients = {
  _search: '',

  applySearch() {
    this._search = (document.getElementById('clientSearch')?.value || '').toLowerCase();
    this.render();
  },

  render() {
    const tbody = document.getElementById('clientsTable');
    if (!tbody) return;

    let rows = Object.keys(STATE.clients).map(phone => ({
      phone,
      ...STATE.clients[phone]
    }));

    // Search filter
    if (this._search) {
      rows = rows.filter(c =>
        (c.name || '').toLowerCase().includes(this._search) ||
        c.phone.includes(this._search)
      );
    }

    rows.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">لا توجد خطوط مسجلة</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(c => `
      <tr>
        <td>${c.name || '—'}</td>
        <td>0${c.phone}</td>
        <td><span style="font-size:11px">${c.packageType || '—'}</span></td>
        <td>${parseFloat(c.basePrice || 0).toFixed(0)}</td>
        <td>
          <button class="btn-outline" onclick="clients.edit('${c.phone}')">✏️</button>
          <button class="btn-danger"  onclick="clients.delete('${c.phone}')">🗑️</button>
        </td>
      </tr>`).join('');
  },

  openForm() {
    document.getElementById('clientFormTitle').textContent = '➕ إضافة خط جديد';
    document.getElementById('editClientPhone').value = '';
    document.getElementById('clientName').value  = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientPackage').value = PACKAGE_LIST[0];
    document.getElementById('clientPrice').value = '';
    document.getElementById('clientPhone').disabled = false;
    document.getElementById('clientFormCard').classList.remove('hidden');
    document.getElementById('clientImportCard').classList.add('hidden');
    setTimeout(() => document.getElementById('clientName').focus(), 100);
  },

  closeForm() {
    document.getElementById('clientFormCard').classList.add('hidden');
  },

  edit(phone) {
    const c = STATE.clients[phone];
    if (!c) return;
    document.getElementById('clientFormTitle').textContent = '✏️ تعديل بيانات الخط';
    document.getElementById('editClientPhone').value  = phone;
    document.getElementById('clientName').value       = c.name || '';
    document.getElementById('clientPhone').value      = phone;
    document.getElementById('clientPhone').disabled   = true;
    document.getElementById('clientPackage').value    = c.packageType || '';
    document.getElementById('clientPrice').value      = parseFloat(c.basePrice || 0).toFixed(0);
    document.getElementById('clientFormCard').classList.remove('hidden');
    document.getElementById('clientImportCard').classList.add('hidden');
    document.getElementById('clientName').focus();
  },

  async save() {
    const editPhone = document.getElementById('editClientPhone').value;
    const name      = document.getElementById('clientName').value.trim();
    let   phone     = normalizePhone(document.getElementById('clientPhone').value);
    const pkg       = document.getElementById('clientPackage').value;
    const price     = parseFloat(document.getElementById('clientPrice').value) || 0;

    if (!name) { showToast('أدخل الاسم', 'error'); return; }
    if (!phone) { showToast('أدخل رقم الخط', 'error'); return; }

    await dbSaveClient(phone, { name, packageType: pkg, basePrice: price, prepaidBalance: 0 });
    showToast('تم الحفظ ✅', 'success');
    this.closeForm();
  },

  delete(phone) {
    const name = STATE.clients[phone]?.name || `0${phone}`;
    deleteModal.open(`هل تريد حذف الخط: ${name}؟ لا يمكن التراجع عن هذا الإجراء.`, async () => {
      await dbDeleteClient(phone);
      showToast('تم الحذف', 'default');
    });
  },

  openImport() {
    document.getElementById('clientImportCard').classList.remove('hidden');
    document.getElementById('clientFormCard').classList.add('hidden');
    document.getElementById('importStatus').textContent = '';
  },

  closeImport() {
    document.getElementById('clientImportCard').classList.add('hidden');
  },

  async importExcel() {
    const file = document.getElementById('clientsExcel').files[0];
    if (!file) { showToast('اختر ملف Excel', 'error'); return; }

    const status = document.getElementById('importStatus');
    status.innerHTML = `<div class="loader">جارٍ الاستيراد...</div>`;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet    = workbook.Sheets[workbook.SheetNames[0]];
        const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const toImport = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0]) continue;
          const phone = normalizePhone(row[0]);
          // Match by phone — look up existing or use row data
          const existing = STATE.clients[phone] || {};
          toImport.push({
            phone,
            name:        row[1] || existing.name || '',
            packageType: row[2] || existing.packageType || '',
            basePrice:   parseFloat(row[3]) || parseFloat(existing.basePrice) || 0,
          });
        }

        const count = await dbImportClients(toImport);
        status.innerHTML = '';
        showToast(`تم استيراد ${count} خط بنجاح ✅`, 'success');
        this.closeImport();
        document.getElementById('clientsExcel').value = '';
      } catch (err) {
        status.innerHTML = `<div class="hint" style="color:#dc2626">❌ ${err.message}</div>`;
        showToast('فشل الاستيراد', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }
};
