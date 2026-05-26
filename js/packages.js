// ─── Package Prices Screen ─────────────────────────────────────────
const pkgs = {
  render() {
    const list = document.getElementById('packagesList');
    if (!list) return;

    // Merge hardcoded list with any saved prices + custom packages
    const allNames = new Set([
      ...PACKAGE_LIST,
      ...Object.keys(STATE.packagePrices)
    ]);

    let html = '';
    allNames.forEach(name => {
      const price = STATE.packagePrices[name] ?? '';
      const safeId = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      html += `
      <div class="pkg-item">
        <div class="pkg-name">${name}</div>
        <input
          class="pkg-price-input"
          type="number"
          id="pkg_${safeId}"
          value="${price}"
          placeholder="السعر"
          onchange="pkgs.savePrice('${name}', this.value)"
          onkeydown="if(event.key==='Enter') pkgs.savePrice('${name}', this.value)"
        >
      </div>`;
    });

    list.innerHTML = html;
  },

  async savePrice(name, value) {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) {
      showToast('أدخل سعراً صحيحاً', 'error');
      return;
    }
    await dbSavePackagePrice(name, price);
    showToast(`تم حفظ سعر ${name} ✅`, 'success');
  },

  openAdd() {
    const form = document.getElementById('addPackageForm');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) {
      document.getElementById('newPackageName').value  = '';
      document.getElementById('newPackagePrice').value = '';
      setTimeout(() => document.getElementById('newPackageName').focus(), 100);
    }
  },

  closeAdd() {
    document.getElementById('addPackageForm').classList.add('hidden');
  },

  async addNew() {
    const name  = document.getElementById('newPackageName').value.trim();
    const price = parseFloat(document.getElementById('newPackagePrice').value) || 0;

    if (!name) { showToast('أدخل اسم الباقة', 'error'); return; }

    await dbSavePackagePrice(name, price);
    showToast(`تم إضافة الباقة: ${name} ✅`, 'success');
    this.closeAdd();
  }
};
