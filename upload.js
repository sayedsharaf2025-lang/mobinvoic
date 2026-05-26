// ─── Upload Invoices Screen ────────────────────────────────────────
const upload = {
  async processInvoices() {
    const files = document.getElementById('invoiceFiles').files;
    const month = document.getElementById('uploadMonth').value;
    const mode  = document.querySelector('input[name=uploadMode]:checked')?.value || 'cumulative';
    const status= document.getElementById('uploadStatus');

    if (!month) { showToast('اختر الشهر أولاً', 'error'); return; }
    if (!files.length) { showToast('اختر ملف Excel', 'error'); return; }

    status.innerHTML = `<div class="loader">جارٍ المعالجة...</div>`;

    let totalRows = 0;
    let errors    = 0;

    for (const file of Array.from(files)) {
      try {
        const rows = await this._parseExcel(file);
        const count = await dbImportInvoices(month, rows, mode);
        totalRows += count;
        status.innerHTML += `<div class="hint" style="color:#16a34a">✅ ${file.name}: ${count} سطر</div>`;
      } catch (e) {
        errors++;
        status.innerHTML += `<div class="hint" style="color:#dc2626">❌ ${file.name}: ${e.message}</div>`;
      }
    }

    showToast(`تم رفع ${totalRows} فاتورة بنجاح${errors ? ` (${errors} خطأ)` : ''}`, errors ? 'error' : 'success');
    document.getElementById('invoiceFiles').value = '';
  },

  _parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data     = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet    = workbook.Sheets[workbook.SheetNames[0]];
          const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const result = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[0]) continue;
            const phone  = normalizePhone(row[0]);
            const amount = parseFloat(row[1]) || 0;
            if (phone) result.push({ phone, amount });
          }
          resolve(result);
        } catch (err) {
          reject(new Error('فشل قراءة الملف: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('فشل فتح الملف'));
      reader.readAsArrayBuffer(file);
    });
  }
};
