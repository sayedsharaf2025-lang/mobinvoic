// ─── Firebase DB Wrapper ───────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ─── Real-time listeners ───────────────────────────────────────────
function startListeners() {
  db.ref('clients').on('value', snap => {
    STATE.clients = snap.val() || {};
    clients.render();
    search.applyFilters();
  });

  db.ref('invoices').on('value', snap => {
    STATE.invoices = snap.val() || {};
    invoices.refresh();
    search.applyFilters();
  });

  db.ref('packagePrices').on('value', snap => {
    STATE.packagePrices = snap.val() || {};
    pkgs.render();
  });
}

// ─── Client CRUD ───────────────────────────────────────────────────
async function dbSaveClient(phone, data) {
  await db.ref(`clients/${phone}`).update(data);
}
async function dbDeleteClient(phone) {
  await db.ref(`clients/${phone}`).remove();
}

// ─── Invoice CRUD ──────────────────────────────────────────────────
async function dbSetInvoice(month, phone, data) {
  await db.ref(`invoices/${month}/${phone}`).update(data);
}
async function dbGetInvoice(month, phone) {
  const snap = await db.ref(`invoices/${month}/${phone}`).once('value');
  return snap.val();
}

// ─── Pay invoice ───────────────────────────────────────────────────
async function dbPayInvoice(month, phone, addedAmount) {
  const inv = await dbGetInvoice(month, phone);
  if (!inv) return;
  const paid = (parseFloat(inv.paidAmount) || 0) + parseFloat(addedAmount);
  const req  = parseFloat(inv.requiredAmount) || 0;
  const isPaid = paid >= req;
  await db.ref(`invoices/${month}/${phone}`).update({ paidAmount: paid, isPaid });
  await db.ref(`paymentHistory/${month}/${phone}`).push({
    type: 'payment', amount: addedAmount, date: new Date().toISOString()
  });
}

// ─── Cancel payment ────────────────────────────────────────────────
async function dbCancelPayment(month, phone) {
  await db.ref(`invoices/${month}/${phone}`).update({ paidAmount: 0, isPaid: false });
  await db.ref(`paymentHistory/${month}/${phone}`).push({
    type: 'cancel', date: new Date().toISOString()
  });
}

// ─── Pay all ───────────────────────────────────────────────────────
async function dbPayAll(month) {
  const data = STATE.invoices[month] || {};
  const updates = {};
  Object.keys(data).forEach(phone => {
    const inv = data[phone];
    if (!inv.isPaid) {
      updates[`invoices/${month}/${phone}/paidAmount`] = inv.requiredAmount;
      updates[`invoices/${month}/${phone}/isPaid`] = true;
    }
  });
  if (Object.keys(updates).length) await db.ref('/').update(updates);
}

// ─── Package prices ────────────────────────────────────────────────
async function dbSavePackagePrice(name, price) {
  await db.ref(`packagePrices/${name}`).set(parseFloat(price) || 0);
}
async function dbDeletePackage(name) {
  await db.ref(`packagePrices/${name}`).remove();
}

// ─── Import invoices ───────────────────────────────────────────────
async function dbImportInvoices(month, rows, mode) {
  const existing = (await db.ref(`invoices/${month}`).once('value')).val() || {};
  const updates  = {};

  for (const { phone, amount } of rows) {
    const old = existing[phone];

    if (mode === 'skip' && old) continue;

    const oldAmount = old ? (parseFloat(old.requiredAmount) || 0) : 0;
    const newAmount = mode === 'cumulative'
      ? oldAmount + (parseFloat(amount) || 0)
      : (parseFloat(amount) || 0);

    const client = STATE.clients[phone] || {};
    updates[`invoices/${month}/${phone}`] = {
      phone,
      name: client.name || old?.name || '',
      package: client.packageType || old?.package || '',
      requiredAmount: newAmount,
      paidAmount: old ? (parseFloat(old.paidAmount) || 0) : 0,
      isPaid: old ? (old.isPaid || false) : false,
      month
    };
  }

  await db.ref('/').update(updates);
  return Object.keys(updates).length;
}

// ─── Import clients ────────────────────────────────────────────────
async function dbImportClients(rows) {
  const updates = {};
  for (const r of rows) {
    if (!r.phone) continue;
    updates[`clients/${r.phone}`] = {
      name: r.name || '',
      packageType: r.packageType || '',
      basePrice: parseFloat(r.basePrice) || 0,
      prepaidBalance: 0
    };
  }
  await db.ref('/').update(updates);
  return Object.keys(updates).length;
}
