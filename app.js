(function () {
  'use strict';

  /* =======================================================================
   * 阿伟汽配 - 出入库管理（本地存储 + JSON 导入导出）
   * 结构：1 工具 2 存储与状态 3 领域逻辑 4 面板渲染 5 事件绑定
   * 不改变 localStorage 键名与 JSON 数据结构
   * ======================================================================= */

  // ========== 1. 工具函数（弹窗、提示、格式化、安全输出） ==========
  function on(el, ev, fn) {
    if (el) el.addEventListener(ev, fn);
  }

  /** 获取元素，避免重复写 document.getElementById */
  function getEl(id) {
    return id ? document.getElementById(id) : null;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** 表格无数据时：大块留白 + 图标 + 文案 */
  function renderTableEmptyRow(colspan, text) {
    return '<tr class="table-empty-row"><td colspan="' + colspan + '"><div class="table-empty-state"><span class="table-empty-icon" aria-hidden="true">📋</span><p>' + escapeHtml(text) + '</p></div></td></tr>';
  }

  function openModal(modalEl) {
    if (modalEl) {
      modalEl.classList.add('is-open');
      document.body.classList.add('modal-open');
    }
  }

  function closeModal(modalEl) {
    if (modalEl) {
      modalEl.classList.remove('is-open');
      if (!document.querySelector('.modal.is-open')) {
        document.body.classList.remove('modal-open');
      }
    }
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
  }

  function showToast(text, success) {
    var el = getEl('toast');
    var textEl = getEl('toast-text');
    if (!el || !textEl) return;
    textEl.textContent = text;
    el.classList.remove('toast-success', 'toast-error');
    el.classList.add(success === false ? 'toast-error' : 'toast-success');
    el.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      el.classList.remove('show');
    }, 2500);
  }

  function showSettingsHint(text, success) {
    showToast(text, success);
    var el = getEl('settings-hint');
    if (!el) return;
    el.textContent = text;
    el.className = 'settings-hint settings-hint-block hint' + (success === false ? ' error' : '');
    setTimeout(function () {
      el.textContent = '';
      el.className = 'settings-hint settings-hint-block hint';
    }, 2500);
  }

  // ========== 2. 存储与状态（localStorage 键、默认分类、state） ==========
  const STORAGE_KEYS = {
    parts: 'aw_part_stock_parts',
    products: 'aw_products',
    batches: 'aw_batches',
    transactions: 'aw_part_stock_transactions',
    payments: 'aw_part_payments',
    models: 'aw_part_models',
    mainTypes: 'aw_part_mainTypes',
    subTypes: 'aw_part_subTypes',
    settings: 'aw_part_settings',
    suppliers: 'aw_part_suppliers',
    customers: 'aw_part_customers',
    favoriteCustomerIds: 'aw_part_favoriteCustomerIds',
  };
  const QUALITY_GRADES = ['正常', '好', '差'];
  /** 数量单位：仅用于数量，与货币 KIP 分离；老数据缺省为 个 */
  const UNIT_OPTIONS = ['个', '件', '套', '只', '台', '支', '箱', '条'];
  const DEFAULT_UNIT = '个';

  function normalizeUnit(u) {
    if (u == null || typeof u !== 'string') return DEFAULT_UNIT;
    var s = String(u).trim();
    return UNIT_OPTIONS.indexOf(s) >= 0 ? s : DEFAULT_UNIT;
  }

  /** 数量+单位展示，如 "36 个" */
  function formatQtyWithUnit(qty, unit) {
    var n = qty != null ? Number(qty) : 0;
    var u = normalizeUnit(unit);
    return (isNaN(n) ? 0 : n) + ' ' + u;
  }

  const DEFAULT_MODELS = [
    { id: 'm1', name: 'Toyota Hilux Vigo' },
    { id: 'm2', name: 'Toyota Hilux Revo' },
    { id: 'm3', name: '其他车型' },
  ];

  const DEFAULT_MAIN_TYPES = [
    { id: 't1', name: '发动机系统' },
    { id: 't2', name: '底盘传动' },
    { id: 't3', name: '制动系统' },
    { id: 't4', name: '电气系统' },
    { id: 't5', name: '车身外观' },
    { id: 't6', name: '空调冷却' },
    { id: 't7', name: '悬挂转向' },
    { id: 't8', name: '其他' },
  ];

  const DEFAULT_SUB_TYPES = [
    { id: 's1', mainTypeId: 't1', name: '发动机总成' },
    { id: 's2', mainTypeId: 't1', name: '进排气' },
    { id: 's3', mainTypeId: 't1', name: '燃油系统' },
    { id: 's4', mainTypeId: 't2', name: '变速箱' },
    { id: 's5', mainTypeId: 't2', name: '传动轴/半轴' },
    { id: 's6', mainTypeId: 't3', name: '刹车片/盘' },
    { id: 's7', mainTypeId: 't3', name: '制动泵/分泵' },
    { id: 's8', mainTypeId: 't4', name: '蓄电池/发电机' },
    { id: 's9', mainTypeId: 't4', name: '灯光/线束' },
    { id: 's10', mainTypeId: 't5', name: '保险杠/饰条' },
    { id: 's11', mainTypeId: 't6', name: '压缩机/冷凝器' },
    { id: 's12', mainTypeId: 't8', name: '其他' },
  ];

  function load(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (defaultValue !== undefined ? defaultValue : []);
    } catch {
      return defaultValue !== undefined ? defaultValue : [];
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function id() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function now() {
    return new Date().toISOString();
  }

  let state = {
    parts: [],
    products: [],
    batches: [],
    transactions: [],
    payments: [],
    models: [],
    mainTypes: [],
    subTypes: [],
    suppliers: [],
    customers: [],
    favoriteCustomerIds: [],
    settings: { lowStockThreshold: 5, defaultOperator: '管理员' },
    stockSort: { key: '', dir: 1 },
    recordsType: 'in',
    contactsTab: 'suppliers',
    contactsSearch: '',
    contactsPage: 1,
    contactsPageSize: 10,
    contactsSortKey: 'createdAt',
    contactsSortDir: -1,
    unsavedToJsonFile: false,
    dataVersion: 0,
    lastRenderedVersion: {},
  };

  function bumpDataVersion() {
    state.dataVersion = (state.dataVersion || 0) + 1;
  }

  function loadState() {
    state.parts = load(STORAGE_KEYS.parts, []);
    state.products = load(STORAGE_KEYS.products, []);
    state.batches = load(STORAGE_KEYS.batches, []);
    state.transactions = load(STORAGE_KEYS.transactions, []);
    state.payments = load(STORAGE_KEYS.payments, []);
    state.favoriteCustomerIds = load(STORAGE_KEYS.favoriteCustomerIds, []);
    migratePartsToProductsBatches();
    state.models = load(STORAGE_KEYS.models, DEFAULT_MODELS);
    state.mainTypes = load(STORAGE_KEYS.mainTypes, DEFAULT_MAIN_TYPES);
    state.subTypes = load(STORAGE_KEYS.subTypes, DEFAULT_SUB_TYPES);
    state.suppliers = load(STORAGE_KEYS.suppliers, []);
    state.customers = load(STORAGE_KEYS.customers, []);
    const savedSettings = load(STORAGE_KEYS.settings, null);
    if (savedSettings) {
      state.settings = { ...state.settings, ...savedSettings };
    }
    state.products.forEach(function (p) { p.unit = normalizeUnit(p.unit); });
    recalcBatchQuantitiesFromTransactions();
    persistState(true);
  }

  function migratePartsToProductsBatches() {
    if (state.products.length > 0 || state.batches.length > 0) return;
    if (state.parts.length === 0) return;
    var partIdToBatchId = {};
    state.parts.forEach(function (part) {
      var product = {
        id: id(),
        code: part.code || '',
        name: part.name || '',
        brand: part.brand || '',
        modelId: part.modelId || '',
        mainTypeId: part.mainTypeId || '',
        subTypeId: part.subTypeId || '',
        unit: normalizeUnit(part.unit),
        imageUrl: part.imageUrl,
        createdAt: part.createdAt || now(),
        updatedAt: part.updatedAt || now(),
      };
      state.products.push(product);
      var batch = {
        id: id(),
        productId: product.id,
        partCode: product.code,
        partName: product.name,
        supplier: part.supplier || '',
        qualityGrade: '',
        costPrice: part.costPrice,
        quantity: part.quantity || 0,
        salePrice: part.salePrice,
        createdAt: part.createdAt || now(),
        updatedAt: part.updatedAt || now(),
      };
      state.batches.push(batch);
      partIdToBatchId[part.id] = batch.id;
    });
    state.transactions.forEach(function (tx) {
      if (tx.partId && partIdToBatchId[tx.partId]) tx.batchId = partIdToBatchId[tx.partId];
    });
    persistState(true);
  }

  function persistStateImmediate(skipUnsavedFlag) {
    save(STORAGE_KEYS.parts, state.parts);
    save(STORAGE_KEYS.products, state.products);
    save(STORAGE_KEYS.batches, state.batches);
    save(STORAGE_KEYS.transactions, state.transactions);
    save(STORAGE_KEYS.payments, state.payments);
    save(STORAGE_KEYS.favoriteCustomerIds, state.favoriteCustomerIds);
    save(STORAGE_KEYS.models, state.models);
    save(STORAGE_KEYS.mainTypes, state.mainTypes);
    save(STORAGE_KEYS.subTypes, state.subTypes);
    save(STORAGE_KEYS.suppliers, state.suppliers);
    save(STORAGE_KEYS.customers, state.customers);
    save(STORAGE_KEYS.settings, state.settings);
    if (!skipUnsavedFlag) {
      state.unsavedToJsonFile = true;
      updateUnsavedBanner();
    }
  }

  var persistStateTimer = null;
  function persistState(skipUnsavedFlag) {
    if (persistStateTimer) clearTimeout(persistStateTimer);
    persistStateTimer = setTimeout(function () {
      persistStateTimer = null;
      persistStateImmediate(skipUnsavedFlag);
    }, 600);
  }

  function updateUnsavedBanner() {
    var el = getEl('unsaved-banner');
    if (el) el.style.display = state.unsavedToJsonFile ? 'block' : 'none';
  }

  function getModelName(id) {
    const m = state.models.find((x) => x.id === id);
    return m ? m.name : '-';
  }

  function getMainTypeName(id) {
    const t = state.mainTypes.find((x) => x.id === id);
    return t ? t.name : '-';
  }

  function getSubTypeName(id) {
    const s = state.subTypes.find((x) => x.id === id);
    return s ? s.name : '-';
  }

  // ========== 3. 领域逻辑（产品/批次/流水、分类名、金额与单位格式化） ==========
  /** 价格：存为纯数字，展示时三位小数、千分位；货币单位 KIP 仅在界面文案中显示 */
  function formatKip(num) {
    if (num == null || num === '' || (typeof num === 'number' && isNaN(num))) return '';
    var n = Number(num);
    if (isNaN(n)) return '';
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function getProductById(productId) {
    return state.products.find(function (x) { return x.id === productId; });
  }
  function getBatchById(batchId) {
    return state.batches.find(function (x) { return x.id === batchId; });
  }
  function getProductName(productId) {
    var p = getProductById(productId);
    return p ? p.name : '-';
  }
  function getPartName(partId) {
    var p = state.products.find(function (x) { return x.id === partId; });
    if (p) return p.name;
    var b = state.batches.find(function (x) { return x.id === partId; });
    if (b) return b.partName || '-';
    var oldPart = state.parts.find(function (x) { return x.id === partId; });
    return oldPart ? oldPart.name : '-';
  }
  function productByCode(code) {
    return state.products.find(function (p) { return (p.code || '').toLowerCase() === (code || '').toLowerCase(); });
  }

  function addProductIfNeeded(record) {
    var existing = productByCode(record.code);
    if (existing) {
      if (record.salePrice != null && record.salePrice !== '') existing.salePrice = parseFloat(record.salePrice);
      if (record.imageUrl != null) existing.imageUrl = String(record.imageUrl).trim() || undefined;
      if (record.spec != null) existing.spec = (String(record.spec) || '').trim();
      existing.updatedAt = now();
      return existing;
    }
    var time = now();
    var product = {
      id: id(),
      code: (record.code || '').trim(),
      name: (record.name || '').trim(),
      brand: (record.brand || '').trim(),
      spec: (record.spec || '').trim(),
      modelId: record.modelId || '',
      mainTypeId: record.mainTypeId || '',
      subTypeId: record.subTypeId || '',
      unit: normalizeUnit(record.unit),
      salePrice: record.salePrice != null && record.salePrice !== '' ? parseFloat(record.salePrice) : undefined,
      imageUrl: (record.imageUrl != null && String(record.imageUrl).trim()) ? String(record.imageUrl).trim() : undefined,
      lowStockThreshold: record.lowStockThreshold != null && record.lowStockThreshold !== '' ? Math.max(0, parseInt(record.lowStockThreshold, 10) || 0) : undefined,
      createdAt: time,
      updatedAt: time,
    };
    state.products.push(product);
    return product;
  }

  function addBatch(record) {
    var product = addProductIfNeeded(record);
    var qty = Math.max(0, parseInt(record.quantity, 10) || 0);
    var time = now();
    var batch = {
      id: id(),
      productId: product.id,
      partCode: product.code,
      partName: product.name,
      supplier: (record.supplier || '').trim(),
      qualityGrade: (record.qualityGrade || '').trim(),
      costPrice: record.costPrice != null && record.costPrice !== '' ? parseFloat(record.costPrice) : undefined,
      quantity: qty,
      salePrice: product.salePrice,
      createdAt: time,
      updatedAt: time,
    };
    state.batches.push(batch);
    state.transactions.push({
      id: id(),
      batchId: batch.id,
      productId: product.id,
      partCode: product.code,
      type: 'in',
      quantity: qty,
      unit: product.unit || DEFAULT_UNIT,
      supplierOrCustomer: record.supplier || '',
      operator: record.operator || state.settings.defaultOperator,
      time: time,
    });
    bumpDataVersion();
    persistState();
  }

  function outBatch(batchId, quantity, customer, operator, paymentStatus) {
    var batch = getBatchById(batchId);
    if (!batch) return false;
    var product = getProductById(batch.productId);
    var qty = Math.max(0, parseInt(quantity, 10) || 0);
    if (qty <= 0 || (batch.quantity || 0) < qty) return false;
    batch.quantity = (batch.quantity || 0) - qty;
    batch.updatedAt = now();
    var costAtOut = batch.costPrice != null ? batch.costPrice : 0;
    var saleAtOut = product && product.salePrice != null ? product.salePrice : batch.salePrice;
    var unitOut = (product && product.unit) ? product.unit : DEFAULT_UNIT;
    state.transactions.push({
      id: id(),
      batchId: batch.id,
      productId: batch.productId,
      partCode: batch.partCode,
      type: 'out',
      quantity: qty,
      unit: unitOut,
      costPrice: costAtOut,
      salePrice: saleAtOut,
      supplierOrCustomer: customer || '',
      operator: operator || state.settings.defaultOperator,
      time: batch.updatedAt,
      paymentStatus: paymentStatus || 'booked',
    });
    bumpDataVersion();
    persistState();
    return true;
  }

  /** 按产品 FIFO 出库：从最早批次开始扣减，可能产生多笔流水 */
  function outByProductFIFO(productId, quantity, customer, operator, paymentStatus) {
    var product = getProductById(productId);
    if (!product) return false;
    var need = Math.max(0, parseInt(quantity, 10) || 0);
    if (need <= 0) return false;
    var batches = state.batches
      .filter(function (b) { return b.productId === productId && (b.quantity || 0) > 0; })
      .sort(function (a, b) { return (a.createdAt || '').localeCompare(b.createdAt || ''); });
    var total = batches.reduce(function (sum, b) { return sum + (b.quantity || 0); }, 0);
    if (total < need) return false;
    var time = now();
    var remain = need;
    for (var i = 0; i < batches.length && remain > 0; i++) {
      var batch = batches[i];
      var deduct = Math.min(batch.quantity || 0, remain);
      if (deduct <= 0) continue;
      batch.quantity = (batch.quantity || 0) - deduct;
      batch.updatedAt = time;
      remain -= deduct;
      var costAtOut = batch.costPrice != null ? batch.costPrice : 0;
      var saleAtOut = product.salePrice != null ? product.salePrice : batch.salePrice;
      var unitOut = (product && product.unit) ? product.unit : DEFAULT_UNIT;
      state.transactions.push({
        id: id(),
        batchId: batch.id,
        productId: productId,
        partCode: product.code || batch.partCode,
        type: 'out',
        quantity: deduct,
        unit: unitOut,
        costPrice: costAtOut,
        salePrice: saleAtOut,
        supplierOrCustomer: customer || '',
        operator: operator || state.settings.defaultOperator,
        time: time,
        paymentStatus: paymentStatus || 'booked',
      });
    }
    bumpDataVersion();
    persistState();
    return true;
  }

  /** 根据流水重算各批次当前数量（入库-出库），保证与流水一致 */
  function recalcBatchQuantitiesFromTransactions() {
    var byBatch = {};
    state.transactions.forEach(function (t) {
      var bid = t.batchId;
      if (!bid) return;
      if (!byBatch[bid]) byBatch[bid] = { in: 0, out: 0 };
      if (t.type === 'in') byBatch[bid].in += (t.quantity || 0);
      else if (t.type === 'out') byBatch[bid].out += (t.quantity || 0);
    });
    state.batches.forEach(function (b) {
      var q = byBatch[b.id];
      b.quantity = q ? Math.max(0, q.in - q.out) : (b.quantity || 0);
    });
  }

  function fillSelect(sel, options, valueKey, labelKey) {
    if (!sel) return;
    const val = sel.value;
    const html = options.map((o) => '<option value="' + (String(o[valueKey] ?? '').replace(/"/g, '&quot;')) + '">' + (String(o[labelKey] ?? '').replace(/</g, '&lt;')) + '</option>').join('');
    sel.innerHTML = html;
    if (val && options.some((o) => String(o[valueKey] ?? '') === val)) sel.value = val;
  }

  // ========== 4. 面板切换与各模块渲染（dashboard / stock / records / contacts / profit） ==========
  function showPanel(panelId) {
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    var panel = getEl('panel-' + panelId);
    var navItem = document.querySelector('.nav-item[data-panel="' + panelId + '"]');
    if (panel) panel.classList.add('active');
    if (navItem) navItem.classList.add('active');
    var v = state.dataVersion || 0;
    var last = state.lastRenderedVersion || {};
    requestAnimationFrame(function () {
      if (panelId === 'dashboard') {
        if (last.dashboard !== v) { renderDashboard(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.dashboard = v; }
      } else if (panelId === 'contacts') {
        if (last.contacts !== v) { renderContacts(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.contacts = v; }
      } else if (panelId === 'in') { fillInFormSelects(); fillSupplierSelect(); initInboundPanel(); }
      else if (panelId === 'out') { fillOutPartSelect(); fillCustomerSelect(); var qEl = getEl('out-qty'); if (qEl) qEl.value = '1'; updateOutStockDisplay(); updateOutPreview(); }
      else if (panelId === 'stock') {
        fillFilterSelects();
        if (last.stock !== v) { renderStock(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.stock = v; }
      } else if (panelId === 'records') {
        fillRecordsFilters();
        if (last.records !== v) { renderRecords(); updateRecordsStats(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.records = v; }
      } else if (panelId === 'customerStats') {
        if (last.customerStats !== v) { renderCustomerStats(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.customerStats = v; }
      } else if (panelId === 'debt') {
        if (last.debt !== v) { renderDebtList(); renderPaymentsList(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.debt = v; }
      } else if (panelId === 'profit') {
        if (!getProfitDateRange()) {
          var now = new Date();
          var todayStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
          setProfitDateRange(now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-01', todayStr);
        }
        if (last.profit !== v) { renderProfit(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.profit = v; }
      } else if (panelId === 'categories') renderSettings();
    });
  }

  function formatTimeShort(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    var h = ('0' + d.getHours()).slice(-2);
    var min = ('0' + d.getMinutes()).slice(-2);
    return m + '-' + day + ' ' + h + ':' + min;
  }

  function getDashboardStats() {
    var totalSku = state.products.length;
    var totalQty = 0, totalAmount = 0, lowCount = 0;
    state.batches.forEach(function (b) {
      var q = b.quantity || 0;
      var p = getProductById(b.productId);
      var th = getEffectiveThreshold(p);
      totalQty += q;
      totalAmount += q * (b.costPrice || 0);
      if (q < th) lowCount++;
    });
    return { totalSku: totalSku, totalQty: totalQty, totalAmount: totalAmount, lowCount: lowCount };
  }

  function getDashboardLowList() {
    return state.batches
      .map(function (b) { var p = getProductById(b.productId); return { batch: b, product: p, th: getEffectiveThreshold(p) }; })
      .filter(function (x) { return (x.batch.quantity || 0) < x.th; })
      .sort(function (a, b) { return (a.batch.quantity || 0) - (b.batch.quantity || 0); })
      .slice(0, 5);
  }

  function getDashboardOutList() {
    return state.transactions.filter(function (t) { return t.type === 'out'; }).slice(-5).reverse();
  }

  function getDashboardTopSalesAndProfit() {
    var nowMs = Date.now();
    var day30 = 30 * 24 * 60 * 60 * 1000;
    var out30 = state.transactions.filter(function (t) { return t.type === 'out' && t.time && (nowMs - new Date(t.time).getTime() < day30); });
    var byProduct = {};
    out30.forEach(function (t) {
      var pid = t.productId || (getBatchById(t.batchId) && getBatchById(t.batchId).productId);
      if (!pid) return;
      if (!byProduct[pid]) byProduct[pid] = { productId: pid, qty: 0, sales: 0, cost: 0 };
      var q = t.quantity || 0;
      byProduct[pid].qty += q;
      byProduct[pid].sales += q * (t.salePrice != null ? t.salePrice : 0);
      byProduct[pid].cost += q * (t.costPrice != null ? t.costPrice : 0);
    });
    var topSales = Object.keys(byProduct).map(function (pid) { var o = byProduct[pid]; o.profit = o.sales - o.cost; return o; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 10);
    var topProfit = Object.keys(byProduct).map(function (pid) { return byProduct[pid]; }).sort(function (a, b) { return (b.sales - b.cost) - (a.sales - a.cost); }).slice(0, 10);
    return { topSales: topSales, topProfit: topProfit };
  }

  function getDashboardSlowList() {
    var nowMs = Date.now();
    var slowDays = 60;
    var slowCutoff = new Date(nowMs - slowDays * 24 * 60 * 60 * 1000).toISOString();
    var lastOutByProduct = {};
    state.transactions.filter(function (t) { return t.type === 'out' && t.time; }).forEach(function (t) {
      var pid = t.productId || (getBatchById(t.batchId) && getBatchById(t.batchId).productId);
      if (!pid) return;
      if (!lastOutByProduct[pid] || t.time > lastOutByProduct[pid]) lastOutByProduct[pid] = t.time;
    });
    var productTotalQty = {};
    state.batches.forEach(function (b) {
      var pid = b.productId;
      productTotalQty[pid] = (productTotalQty[pid] || 0) + (b.quantity || 0);
    });
    var slowList = [];
    state.products.forEach(function (p) {
      var total = productTotalQty[p.id] || 0;
      if (total <= 0) return;
      var lastOut = lastOutByProduct[p.id];
      if (lastOut && lastOut >= slowCutoff) return;
      slowList.push({ product: p, total: total, lastOut: lastOut || '' });
    });
    slowList.sort(function (a, b) { return (a.lastOut || '').localeCompare(b.lastOut || ''); });
    return slowList;
  }

  function renderDashboardCards(cardsEl, stats) {
    if (!cardsEl) return;
    cardsEl.innerHTML =
      '<div class="dashboard-card"><span class="dashboard-card-label">总 SKU</span><div class="dashboard-card-value">' + stats.totalSku.toLocaleString('zh-CN') + '</div></div>' +
      '<div class="dashboard-card"><span class="dashboard-card-label">总库存数量</span><div class="dashboard-card-value">' + stats.totalQty.toLocaleString('zh-CN') + '</div></div>' +
      '<div class="dashboard-card amount"><span class="dashboard-card-label">库存总金额（KIP）</span><div class="dashboard-card-value">' + (stats.totalAmount ? formatKip(stats.totalAmount) : '0.000') + '</div></div>' +
      '<div class="dashboard-card danger"><span class="dashboard-card-label">低库存数量</span><div class="dashboard-card-value">' + stats.lowCount.toLocaleString('zh-CN') + '</div></div>';
  }

  function renderDashboardLow(lowTbody, lowCardList, lowList, lowTotal) {
    if (lowTbody) {
      lowTbody.innerHTML = lowList.length === 0 ? renderTableEmptyRow(5, '暂无低库存') : lowList.map(function (x) {
        var b = x.batch, p = x.product;
        var status = (b.quantity || 0) === 0 ? '缺货' : '低库存';
        return '<tr class="row-low"><td>' + (b.partCode || '-') + '</td><td>' + escapeHtml(b.supplier || '-') + '</td><td>' + escapeHtml(b.partName || '-') + '</td><td class="cell-num-danger">' + formatQtyWithUnit(b.quantity ?? 0, p && p.unit) + '</td><td>' + status + '</td></tr>';
      }).join('');
    }
    if (lowCardList) {
      lowCardList.innerHTML = lowList.length === 0 ? '<li class="mobile-card-empty">暂无低库存</li>' : lowList.map(function (x) {
        var b = x.batch, p = x.product;
        var status = (b.quantity || 0) === 0 ? '缺货' : '低库存';
        return '<li class="mobile-card"><span class="mobile-card-main">' + escapeHtml(b.partName || b.partCode || '-') + '</span><span class="mobile-card-meta">' + (b.partCode || '') + ' · ' + escapeHtml(b.supplier || '-') + '</span><span class="mobile-card-extra">' + formatQtyWithUnit(b.quantity ?? 0, p && p.unit) + ' · ' + status + '</span></li>';
      }).join('');
    }
    var lowMore = getEl('dashboard-low-more');
    if (lowMore) lowMore.textContent = lowList.length === 0 ? '暂无低库存' : (lowTotal > 5 ? '仅显示前5条，请到库存管理查看全部' : '');
  }

  function renderDashboardOut(outTbody, outCardList, outList) {
    if (outTbody) {
      outTbody.innerHTML = outList.length === 0 ? renderTableEmptyRow(6, '暂无出库记录') : outList.map(function (t) {
        var batch = getBatchById(t.batchId);
        var supplier = (batch && batch.supplier) ? batch.supplier : '-';
        var name = getPartName(t.productId || t.batchId);
        var customer = (t.supplierOrCustomer || '').trim() || '未填客户';
        var u = t.unit ? normalizeUnit(t.unit) : (getProductById(t.productId) && getProductById(t.productId).unit) ? normalizeUnit(getProductById(t.productId).unit) : DEFAULT_UNIT;
        return '<tr><td>' + (t.partCode || '-') + '</td><td>' + escapeHtml(supplier) + '</td><td>' + escapeHtml(name) + '</td><td>' + formatQtyWithUnit(t.quantity ?? 0, u) + '</td><td>' + escapeHtml(customer) + '</td><td>' + formatTimeShort(t.time) + '</td></tr>';
      }).join('');
    }
    if (outCardList) {
      outCardList.innerHTML = outList.length === 0 ? '<li class="mobile-card-empty">暂无出库</li>' : outList.map(function (t) {
        var name = getPartName(t.productId || t.batchId);
        var customer = (t.supplierOrCustomer || '').trim() || '未填客户';
        var u = t.unit ? normalizeUnit(t.unit) : (getProductById(t.productId) && getProductById(t.productId).unit) ? normalizeUnit(getProductById(t.productId).unit) : DEFAULT_UNIT;
        return '<li class="mobile-card"><span class="mobile-card-main">' + escapeHtml(name) + '</span><span class="mobile-card-meta">' + escapeHtml(customer) + ' · ' + formatQtyWithUnit(t.quantity ?? 0, u) + '</span><span class="mobile-card-extra">' + formatTimeShort(t.time) + '</span></li>';
      }).join('');
    }
  }

  function renderDashboardTopLists(salesListEl, profitListEl, topSales, topProfit) {
    if (salesListEl) salesListEl.innerHTML = topSales.length === 0 ? '<li class="empty">暂无</li>' : topSales.map(function (o, i) {
      var p = getProductById(o.productId);
      var name = (p && (p.code || p.name)) ? (p.code + ' ' + (p.name || '')).trim() : '—';
      return '<li><span class="rank">' + (i + 1) + '</span> ' + escapeHtml(name) + ' <span class="qty">' + o.qty + '</span></li>';
    }).join('');
    if (profitListEl) profitListEl.innerHTML = topProfit.length === 0 ? '<li class="empty">暂无</li>' : topProfit.map(function (o, i) {
      var p = getProductById(o.productId);
      var name = (p && (p.code || p.name)) ? (p.code + ' ' + (p.name || '')).trim() : '—';
      return '<li><span class="rank">' + (i + 1) + '</span> ' + escapeHtml(name) + ' <span class="amount">' + formatKip(o.sales - o.cost) + '</span></li>';
    }).join('');
  }

  function renderDashboardSlow(slowTbody, slowCardList, slowMoreEl, slowList) {
    var slowSlice = slowList.slice(0, 8);
    if (slowTbody) {
      slowTbody.innerHTML = slowList.length === 0 ? renderTableEmptyRow(4, '暂无滞销') : slowSlice.map(function (x) {
        var lastStr = x.lastOut ? new Date(x.lastOut).toLocaleDateString('zh-CN') : '从未出库';
        return '<tr><td>' + (x.product.code || '-') + '</td><td>' + escapeHtml(x.product.name || '-') + '</td><td>' + x.total + '</td><td>' + lastStr + '</td></tr>';
      }).join('');
    }
    if (slowCardList) {
      slowCardList.innerHTML = slowList.length === 0 ? '<li class="mobile-card-empty">暂无滞销</li>' : slowSlice.map(function (x) {
        var lastStr = x.lastOut ? new Date(x.lastOut).toLocaleDateString('zh-CN') : '从未出库';
        return '<li class="mobile-card"><span class="mobile-card-main">' + escapeHtml(x.product.name || x.product.code || '-') + '</span><span class="mobile-card-meta">' + (x.product.code || '') + ' · 库存 ' + x.total + '</span><span class="mobile-card-extra">最后出库 ' + lastStr + '</span></li>';
      }).join('');
    }
    if (slowMoreEl) slowMoreEl.textContent = slowList.length > 8 ? '共 ' + slowList.length + ' 个，仅显示前8条' : '';
  }

  function renderDashboard() {
    var stats = getDashboardStats();
    renderDashboardCards(getEl('dashboard-cards'), stats);
    var thresholdEl = getEl('dashboard-threshold-value');
    if (thresholdEl) thresholdEl.textContent = String(state.settings.lowStockThreshold || 5);
    var lowList = getDashboardLowList();
    var lowTotal = state.batches.filter(function (b) {
      var p = getProductById(b.productId);
      return (b.quantity || 0) < getEffectiveThreshold(p);
    }).length;
    renderDashboardLow(getEl('dashboard-low-tbody'), getEl('dashboard-low-card-list'), lowList, lowTotal);
    var outList = getDashboardOutList();
    renderDashboardOut(getEl('dashboard-out-tbody'), getEl('dashboard-out-card-list'), outList);
    var top = getDashboardTopSalesAndProfit();
    renderDashboardTopLists(getEl('dashboard-top-sales'), getEl('dashboard-top-profit'), top.topSales, top.topProfit);
    var slowList = getDashboardSlowList();
    renderDashboardSlow(getEl('dashboard-slow-tbody'), getEl('dashboard-slow-card-list'), getEl('dashboard-slow-more'), slowList);
  }

  function getProfitDateRange() {
    var fromEl = getEl('profit-dateFrom');
    var toEl = getEl('profit-dateTo');
    var from = (fromEl && fromEl.value) || '';
    var to = (toEl && toEl.value) || '';
    if (!from || !to) return null;
    return { from: from, to: to };
  }

  function setProfitDateRange(from, to) {
    var fromEl = getEl('profit-dateFrom');
    var toEl = getEl('profit-dateTo');
    if (fromEl) fromEl.value = from;
    if (toEl) toEl.value = to;
  }

  function getProfitStats(dateFrom, dateTo) {
    var outTxs = state.transactions.filter(function (t) { return t.type === 'out' && t.time; });
    if (dateFrom) outTxs = outTxs.filter(function (t) { return (t.time || '').slice(0, 10) >= dateFrom; });
    if (dateTo) outTxs = outTxs.filter(function (t) { return (t.time || '').slice(0, 10) <= dateTo; });
    var sales = 0, cost = 0, qty = 0;
    outTxs.forEach(function (t) {
      var q = t.quantity || 0;
      var sale = (t.salePrice != null ? t.salePrice : 0) * q;
      var batch = getBatchById(t.batchId);
      var costPer = t.costPrice != null ? t.costPrice : (batch && batch.costPrice != null ? batch.costPrice : 0);
      sales += sale;
      cost += costPer * q;
      qty += q;
    });
    return { sales: sales, cost: cost, profit: sales - cost, qty: qty, count: outTxs.length };
  }

  function getProfitDailyBreakdown(dateFrom, dateTo) {
    var outTxs = state.transactions.filter(function (t) { return t.type === 'out' && t.time; });
    if (dateFrom) outTxs = outTxs.filter(function (t) { return (t.time || '').slice(0, 10) >= dateFrom; });
    if (dateTo) outTxs = outTxs.filter(function (t) { return (t.time || '').slice(0, 10) <= dateTo; });
    var byDay = {};
    outTxs.forEach(function (t) {
      var date = (t.time || '').slice(0, 10);
      if (!byDay[date]) byDay[date] = { count: 0, qty: 0, sales: 0, cost: 0 };
      var q = t.quantity || 0;
      var sale = (t.salePrice != null ? t.salePrice : 0) * q;
      var batch = getBatchById(t.batchId);
      var costPer = t.costPrice != null ? t.costPrice : (batch && batch.costPrice != null ? batch.costPrice : 0);
      byDay[date].count += 1;
      byDay[date].qty += q;
      byDay[date].sales += sale;
      byDay[date].cost += costPer * q;
    });
    var rows = Object.keys(byDay).sort();
    return rows.map(function (date) {
      var o = byDay[date];
      return { date: date, count: o.count, qty: o.qty, sales: o.sales, cost: o.cost, profit: o.sales - o.cost };
    }).reverse();
  }

  function renderProfitCards(cardsEl, stats) {
    if (!cardsEl) return;
    cardsEl.innerHTML =
      '<div class="dashboard-card"><span class="dashboard-card-label">销售额（KIP）</span><div class="dashboard-card-value amount">' + formatKip(stats.sales) + '</div></div>' +
      '<div class="dashboard-card"><span class="dashboard-card-label">总成本（KIP）</span><div class="dashboard-card-value">' + formatKip(stats.cost) + '</div></div>' +
      '<div class="dashboard-card"><span class="dashboard-card-label">毛利润（KIP）</span><div class="dashboard-card-value ' + (stats.profit >= 0 ? 'amount' : 'danger') + '">' + formatKip(stats.profit) + '</div></div>' +
      '<div class="dashboard-card"><span class="dashboard-card-label">出库笔数</span><div class="dashboard-card-value">' + stats.count.toLocaleString('zh-CN') + '</div></div>' +
      '<div class="dashboard-card"><span class="dashboard-card-label">出库总数量</span><div class="dashboard-card-value">' + stats.qty.toLocaleString('zh-CN') + '</div></div>';
  }

  function renderProfitDaily(tbody, dailyCardList, daily) {
    if (tbody) {
      tbody.innerHTML = daily.length === 0 ? renderTableEmptyRow(6, '该时间段内无出库记录') : daily.map(function (row) {
        return '<tr><td>' + row.date + '</td><td>' + row.count + '</td><td>' + row.qty.toLocaleString() + '</td><td class="cell-amount">' + formatKip(row.sales) + '</td><td class="cell-amount">' + formatKip(row.cost) + '</td><td class="cell-amount ' + (row.profit >= 0 ? 'amount' : 'danger') + '">' + formatKip(row.profit) + '</td></tr>';
      }).join('');
    }
    if (dailyCardList) {
      dailyCardList.innerHTML = daily.length === 0 ? '<li class="mobile-card-empty">该时间段内无出库记录</li>' : daily.map(function (row) {
        var profitClass = row.profit >= 0 ? 'amount' : 'danger';
        return '<li class="mobile-card"><span class="mobile-card-main">' + row.date + '</span><span class="mobile-card-meta">' + row.count + ' 笔 · ' + row.qty.toLocaleString() + ' 件</span><span class="mobile-card-extra mobile-card-amount ' + profitClass + '">利润 ' + formatKip(row.profit) + ' KIP</span></li>';
      }).join('');
    }
  }

  function renderProfit() {
    var range = getProfitDateRange();
    var now = new Date();
    var todayStr = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
    var monthStart = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-01';
    if (!range) {
      setProfitDateRange(monthStart, todayStr);
      range = { from: monthStart, to: todayStr };
    }
    var stats = getProfitStats(range.from, range.to);
    var daily = getProfitDailyBreakdown(range.from, range.to);
    var hintEl = getEl('profit-range-hint');
    if (hintEl) hintEl.textContent = '统计范围：' + range.from + ' 至 ' + range.to + '，共 ' + stats.count + ' 笔出库';
    renderProfitCards(getEl('profit-cards'), stats);
    renderProfitDaily(getEl('profit-daily-tbody'), getEl('profit-daily-card-list'), daily);
  }

  // ========== 5. 事件绑定（集中管理，统一使用 on(el, ev, fn)） ==========
  on(getEl('profit-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderProfit();
  });
  on(getEl('profit-filter-form'), 'click', function (e) {
    var btn = e.target.closest('.profit-quick');
    if (!btn) return;
    e.preventDefault();
    var now = new Date();
    var y = now.getFullYear();
    var m = ('0' + (now.getMonth() + 1)).slice(-2);
    var d = ('0' + now.getDate()).slice(-2);
    var today = y + '-' + m + '-' + d;
    var day = now.getDay();
    var weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    var ws = weekStart.getFullYear() + '-' + ('0' + (weekStart.getMonth() + 1)).slice(-2) + '-' + ('0' + weekStart.getDate()).slice(-2);
    var monthStart = y + '-' + m + '-01';
    var range = btn.getAttribute('data-range');
    if (range === 'today') setProfitDateRange(today, today);
    else if (range === 'week') setProfitDateRange(ws, today);
    else if (range === 'month') setProfitDateRange(monthStart, today);
    renderProfit();
  });

  on(getEl('sidebar-toggle'), 'click', function (e) {
    e.preventDefault();
    toggleSidebar();
  });
  on(getEl('sidebar-overlay'), 'click', closeSidebar);

  (function () {
    var sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.addEventListener('wheel', function (e) {
      var nav = e.target.closest('.sidebar-nav');
      if (nav) nav.scrollTop += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  })();

  on(getEl('content'), 'click', function (e) {
    var goto = e.target.closest('.dashboard-goto-stock');
    if (goto && goto.getAttribute('data-panel')) {
      e.preventDefault();
      showPanel(goto.getAttribute('data-panel'));
      closeSidebar();
    }
  });

  on(getEl('sidebar-nav'), 'click', function (e) {
    var item = e.target.closest('.nav-item');
    if (!item) return;
    e.preventDefault();
    var panelId = item.getAttribute('data-panel');
    if (panelId) {
      showPanel(panelId);
      closeSidebar();
    }
  });

  on(document.body, 'click', function (e) {
    var head = e.target.closest('.collapsible-head');
    if (!head) return;
    var card = head.closest('.collapsible');
    if (card) card.classList.toggle('open');
  });

  function fillInFormSelects() {
    fillSelect(getEl('in-model'), [{ id: '', name: '请选择车型' }, ...state.models], 'id', 'name');
    fillSelect(getEl('in-mainType'), [{ id: '', name: '请选择主件' }, ...state.mainTypes], 'id', 'name');
    const mainId = getEl('in-mainType').value;
    const subs = state.subTypes.filter((s) => s.mainTypeId === mainId);
    fillSelect(getEl('in-subType'), [{ id: '', name: '请选择子件' }, ...subs], 'id', 'name');
  }

  function fillSupplierSelect() {
    const sel = getEl('in-supplier-select');
    if (!sel) return;
    const opts = [{ id: '', name: '-- 选择或手动输入 --' }, ...state.suppliers.map((s) => ({ id: s.name, name: s.name }))];
    fillSelect(sel, opts, 'id', 'name');
  }

  function fillCustomerSelect() {
    const sel = getEl('out-customer-select');
    if (!sel) return;
    var outTxs = state.transactions.filter(function (t) { return t.type === 'out' && (t.supplierOrCustomer || '').trim(); });
    var lastByCustomer = {};
    outTxs.forEach(function (t) {
      var name = t.supplierOrCustomer.trim();
      if (!lastByCustomer[name] || (t.time || '') > lastByCustomer[name]) lastByCustomer[name] = t.time || '';
    });
    var names = state.customers.map(function (c) { return c.name; });
    var allNames = Object.keys(lastByCustomer).concat(names.filter(function (n) { return !lastByCustomer[n]; }));
    var uniq = [];
    var seen = {};
    allNames.forEach(function (n) { if (n && !seen[n]) { seen[n] = true; uniq.push(n); } });
    var favorites = (state.favoriteCustomerIds || []).filter(function (n) { return seen[n]; });
    var recent5 = uniq.sort(function (a, b) { return (lastByCustomer[b] || '').localeCompare(lastByCustomer[a] || ''); }).slice(0, 5);
    var rest = uniq.filter(function (n) { return favorites.indexOf(n) === -1 && recent5.indexOf(n) === -1; });
    var ordered = favorites.concat(recent5.filter(function (n) { return favorites.indexOf(n) === -1; })).concat(rest);
    var opts = [{ id: '', name: '-- 选择或手动输入 --' }].concat(ordered.map(function (n) { return { id: n, name: n }; }));
    fillSelect(sel, opts, 'id', 'name');
  }

  function toggleFavoriteCustomer(name) {
    if (!(name || '').trim()) return false;
    name = name.trim();
    var arr = state.favoriteCustomerIds || [];
    var i = arr.indexOf(name);
    if (i >= 0) {
      state.favoriteCustomerIds = arr.filter(function (_, idx) { return idx !== i; });
    } else {
      state.favoriteCustomerIds = arr.concat([name]);
    }
    bumpDataVersion();
    persistState();
    fillCustomerSelect();
    return true;
  }

  function isFavoriteCustomer(name) {
    return (state.favoriteCustomerIds || []).indexOf((name || '').trim()) >= 0;
  }

  on(getEl('in-mainType'), 'change', function () {
    const subs = state.subTypes.filter((s) => s.mainTypeId === this.value);
    fillSelect(getEl('in-subType'), [{ id: '', name: '请选择子件' }, ...subs], 'id', 'name');
  });

  var stateInboundMode = 'existing';
  var selectedInPart = null;

  function getInboundMode() {
    var r = document.querySelector('input[name="in-mode"]:checked');
    return (r && r.value) || 'existing';
  }

  function initInboundPanel() {
    stateInboundMode = getInboundMode();
    var existingBlock = getEl('in-existing-block');
    var newBlock = getEl('in-new-block');
    var advancedWrap = getEl('in-advanced-wrap');
    if (stateInboundMode === 'existing') {
      if (existingBlock) existingBlock.style.display = 'block';
      if (newBlock) newBlock.style.display = 'none';
      if (advancedWrap) advancedWrap.style.display = 'none';
      selectedInPart = null;
      getEl('in-selected-part-id').value = '';
      getEl('in-part-search').value = '';
      getEl('in-part-summary').textContent = '';
    } else {
      if (existingBlock) existingBlock.style.display = 'none';
      if (newBlock) newBlock.style.display = 'block';
      if (advancedWrap) advancedWrap.style.display = 'block';
      getEl('in-code').value = '';
      getEl('in-name').value = '';
    }
    getEl('in-qty').value = '';
    getEl('in-costPrice').value = '';
    getEl('in-salePrice').value = '';
    var inQuality = getEl('in-quality');
    if (inQuality) inQuality.value = '正常';
    setInUnitFromProduct();
  }

  on(getEl('form-in'), 'change', function (e) {
    if (e.target.name === 'in-mode') {
      stateInboundMode = (e.target.value || 'existing');
      initInboundPanel();
    }
  });

  function renderInPartDropdown(keyword) {
    var kw = (keyword || '').toLowerCase().trim();
    var list = state.products.filter(function (p) {
      return (p.code || '').toLowerCase().includes(kw) || (p.name || '').toLowerCase().includes(kw);
    }).slice(0, 20);
    var el = getEl('in-part-dropdown');
    if (!el) return;
    if (list.length === 0) {
      el.style.display = 'none';
      return;
    }
    el.innerHTML = list.map(function (p) {
      var batchCount = state.batches.filter(function (b) { return b.productId === p.id; }).length;
      return '<div class="in-part-dropdown-item" data-id="' + p.id + '">' + escapeHtml(p.code || '') + ' · ' + escapeHtml(p.name || '') + (batchCount ? '（' + batchCount + ' 批次）' : '') + '</div>';
    }).join('');
    el.style.display = 'block';
  }

  on(getEl('in-part-search'), 'input', function () {
    renderInPartDropdown(this.value);
  });
  on(getEl('in-part-search'), 'focus', function () {
    if (this.value.trim()) renderInPartDropdown(this.value);
  });
  on(getEl('in-part-dropdown'), 'click', function (e) {
    var item = e.target.closest('.in-part-dropdown-item');
    if (!item) return;
    var id = item.dataset.id;
    var product = state.products.find(function (p) { return p.id === id; });
    if (!product) return;
    selectedInPart = product;
    getEl('in-selected-part-id').value = product.id;
    getEl('in-part-search').value = (product.code || '') + ' ' + (product.name || '');
    getEl('in-part-dropdown').style.display = 'none';
    var summary = getEl('in-part-summary');
    var batchCount = state.batches.filter(function (b) { return b.productId === product.id; }).length;
    summary.innerHTML = '已选：<strong>' + escapeHtml(product.code || '') + ' ' + escapeHtml(product.name || '') + '</strong>' + (batchCount ? ' · 已有 ' + batchCount + ' 个批次' : '');
    getEl('in-salePrice').value = product.salePrice != null && product.salePrice !== '' ? product.salePrice : '';
    setInUnitFromProduct();
    var qtyEl = getEl('in-qty');
    if (qtyEl) qtyEl.focus();
  });

  /** 入库单位下拉：与库存管理对接，现有配件时同步为产品单位，新建时默认 个 */
  function setInUnitFromProduct() {
    var sel = getEl('in-unit');
    if (!sel || sel.tagName !== 'SELECT') return;
    var mode = getInboundMode();
    if (mode === 'existing' && selectedInPart) {
      sel.value = normalizeUnit(selectedInPart.unit);
    } else {
      sel.value = DEFAULT_UNIT;
    }
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.in-part-search-wrap')) getEl('in-part-dropdown').style.display = 'none';
  });

  (function () {
    var w = getEl('in-advanced-wrap');
    var h = w && w.querySelector('.in-advanced-head');
    if (h) h.addEventListener('click', function () {
      getEl('in-advanced-wrap').classList.toggle('open');
    });
  })();

  function getInSupplierValue() {
    const sel = getEl('in-supplier-select');
    const input = getEl('in-supplier');
    if (sel && sel.value && sel.value.trim()) return sel.value.trim();
    return input ? input.value.trim() : '';
  }

  var pendingInboundImage = '';

  function compressImageFile(file, maxSize, quality, callback) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (w <= maxSize && h <= maxSize) {
        var reader = new FileReader();
        reader.onload = function () { callback(reader.result); };
        reader.readAsDataURL(file);
        return;
      }
      var scale = maxSize / Math.max(w, h);
      var cw = Math.round(w * scale);
      var ch = Math.round(h * scale);
      var canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      var dataUrl = canvas.toDataURL('image/jpeg', quality);
      callback(dataUrl);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      var reader = new FileReader();
      reader.onload = function () { callback(reader.result); };
      reader.readAsDataURL(file);
    };
    img.src = url;
  }

  on(getEl('in-imageFile'), 'change', function () {
    var file = this.files && this.files[0];
    var preview = getEl('in-imagePreview');
    if (!file || !file.type.startsWith('image/')) {
      pendingInboundImage = '';
      if (preview) preview.src = '';
      return;
    }
    compressImageFile(file, 1000, 0.88, function (dataUrl) {
      pendingInboundImage = dataUrl;
      if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
    });
  });

  on(getEl('form-in'), 'submit', function (e) {
    e.preventDefault();
    var mode = getInboundMode();
    var qty = (getEl('in-qty').value || '').trim();
    var costPrice = (getEl('in-costPrice') && getEl('in-costPrice').value);
    var salePrice = (getEl('in-salePrice') && getEl('in-salePrice').value);
    var supplier = getInSupplierValue();
    var operator = ((getEl('in-operator') && getEl('in-operator').value) || '').trim() || state.settings.defaultOperator;

    if (!qty || parseInt(qty, 10) < 1) {
      showSettingsHint('请填写入库数量', false);
      return;
    }
    if (costPrice === '' || costPrice == null) {
      showSettingsHint('请填写成本价', false);
      return;
    }
    if (!supplier || !supplier.trim()) {
      showSettingsHint('请选择或填写供应商', false);
      return;
    }

    var qualityGrade = ((getEl('in-quality') && getEl('in-quality').value) || '').trim();

    if (mode === 'existing') {
      if (!selectedInPart) {
        showSettingsHint('请先选择配件', false);
        return;
      }
      addBatch({
        code: selectedInPart.code,
        name: selectedInPart.name,
        brand: selectedInPart.brand || '',
        modelId: selectedInPart.modelId || '',
        mainTypeId: selectedInPart.mainTypeId || '',
        subTypeId: selectedInPart.subTypeId || '',
        quantity: qty,
        unit: normalizeUnit(getEl('in-unit') && getEl('in-unit').value),
        supplier: supplier,
        qualityGrade: qualityGrade,
        costPrice: costPrice,
        salePrice: salePrice || undefined,
        operator: operator,
      });
      var newUnit = normalizeUnit(getEl('in-unit') && getEl('in-unit').value);
      if (selectedInPart && selectedInPart.unit !== newUnit) {
        selectedInPart.unit = newUnit;
        selectedInPart.updatedAt = now();
        bumpDataVersion();
        persistState();
      }
      this.reset();
      getEl('in-operator').value = state.settings.defaultOperator;
      getEl('in-quality').value = '正常';
      selectedInPart = null;
      getEl('in-selected-part-id').value = '';
      getEl('in-part-search').value = '';
      getEl('in-part-summary').innerHTML = '';
      fillSupplierSelect();
      showSettingsHint('入库成功', true);
      return;
    }

    var code = ((getEl('in-code') && getEl('in-code').value) || '').trim();
    var name = ((getEl('in-name') && getEl('in-name').value) || '').trim();
    if (!code || !name) {
      showSettingsHint('请填写配件编码和名称', false);
      return;
    }
    var existing = productByCode(code);
    if (existing) {
      if (!confirm('该编码已存在（' + (existing.name || '') + '），是否改为现有产品入库？')) return;
      var inUnitVal = normalizeUnit(getEl('in-unit') && getEl('in-unit').value);
      addBatch({
        code: existing.code,
        name: existing.name,
        brand: existing.brand || '',
        spec: existing.spec || '',
        modelId: existing.modelId || '',
        mainTypeId: existing.mainTypeId || '',
        subTypeId: existing.subTypeId || '',
        quantity: qty,
        unit: inUnitVal,
        supplier: supplier,
        qualityGrade: qualityGrade,
        costPrice: costPrice,
        salePrice: salePrice || undefined,
        operator: operator,
      });
      if (existing.unit !== inUnitVal) {
        existing.unit = inUnitVal;
        existing.updatedAt = now();
        bumpDataVersion();
        persistState();
      }
    } else {
      if (!confirm('编码不存在，是否新建产品并入库？')) return;
      addBatch({
        code: code,
        name: name,
        brand: ((getEl('in-brand') && getEl('in-brand').value) || '').trim(),
        spec: ((getEl('in-spec') && getEl('in-spec').value) || '').trim(),
        modelId: (getEl('in-model') && getEl('in-model').value) || '',
        mainTypeId: (getEl('in-mainType') && getEl('in-mainType').value) || '',
        subTypeId: (getEl('in-subType') && getEl('in-subType').value) || '',
        quantity: qty,
        unit: normalizeUnit(getEl('in-unit') && getEl('in-unit').value) || DEFAULT_UNIT,
        supplier: supplier,
        qualityGrade: qualityGrade,
        costPrice: costPrice,
        salePrice: salePrice || undefined,
        imageUrl: pendingInboundImage || undefined,
        operator: operator,
      });
    }
    this.reset();
    getEl('in-operator').value = state.settings.defaultOperator;
    getEl('in-quality').value = '正常';
    pendingInboundImage = '';
    var preview = getEl('in-imagePreview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    var fileInput = getEl('in-imageFile');
    if (fileInput) fileInput.value = '';
    getEl('in-code').value = '';
    getEl('in-name').value = '';
    fillInFormSelects();
    fillSupplierSelect();
    showSettingsHint('入库成功', true);
  });

  function getProductTotalQty(productId) {
    return state.batches
      .filter(function (b) { return b.productId === productId; })
      .reduce(function (sum, b) { return sum + (b.quantity || 0); }, 0);
  }

  function fillOutPartSelect() {
    var sel = getEl('out-part');
    var searchKw = ((getEl('out-search') && getEl('out-search').value) || '').toLowerCase().trim();
    if (!sel) return;
    var products = state.products.filter(function (p) {
      var total = getProductTotalQty(p.id);
      if (total <= 0) return false;
      if (!searchKw) return true;
      return (p.code || '').toLowerCase().includes(searchKw) ||
        (p.name || '').toLowerCase().includes(searchKw);
    });
    var opts = products.map(function (p) {
      var total = getProductTotalQty(p.id);
      var label = (p.code || '') + ' ' + (p.name || '') + ' · 库存 ' + total;
      return { id: p.id, label: label };
    });
    var withPlaceholder = [{ id: '', label: '请选择配件（按先进先出）' }, ...opts];
    fillSelect(sel, withPlaceholder, 'id', 'label');
    updateOutStockDisplay();
  }

  (function () {
    var outSearchDebounce = null;
    function debouncedFillOutPartSelect() {
      if (outSearchDebounce) clearTimeout(outSearchDebounce);
      outSearchDebounce = setTimeout(function () {
        outSearchDebounce = null;
        fillOutPartSelect();
      }, 200);
    }
    on(getEl('out-search'), 'input', debouncedFillOutPartSelect);
    on(getEl('out-search'), 'change', fillOutPartSelect);
    on(getEl('out-search'), 'keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var code = (this.value || '').trim();
      if (!code) return;
      var product = productByCode(code);
      if (!product || getProductTotalQty(product.id) <= 0) return;
      var partSel = getEl('out-part');
      if (partSel && partSel.options.length) {
        for (var i = 0; i < partSel.options.length; i++) {
          if (partSel.options[i].value === product.id) {
            partSel.selectedIndex = i;
            partSel.dispatchEvent(new Event('change'));
            var qEl = getEl('out-qty');
            if (qEl) qEl.focus();
            break;
          }
        }
      }
    });
  })();

  on(getEl('out-part'), 'change', function () {
    updateOutStockDisplay();
    var qEl = getEl('out-qty');
    if (qEl) qEl.focus();
  });
  on(getEl('out-qty'), 'input', function () { updateOutStockDisplay(); updateOutPreview(); });
  on(getEl('out-customer-select'), 'change', function () {
    updateOutPreview();
    var favBtn = getEl('out-customer-favorite');
    if (favBtn) {
      var name = getOutCustomerValue();
      favBtn.textContent = isFavoriteCustomer(name) ? '已常用' : '⭐ 常用';
      favBtn.title = isFavoriteCustomer(name) ? '取消常用' : '设为常用客户（置顶）';
    }
  });
  on(getEl('out-customer'), 'input', function () {
    updateOutPreview();
    var favBtn = getEl('out-customer-favorite');
    if (favBtn) {
      var name = getOutCustomerValue();
      favBtn.textContent = isFavoriteCustomer(name) ? '已常用' : '⭐ 常用';
    }
  });
  on(getEl('out-customer-favorite'), 'click', function () {
    var name = getOutCustomerValue();
    if (!name || !name.trim()) { showSettingsHint('请先选择或输入客户', false); return; }
    toggleFavoriteCustomer(name);
    this.textContent = isFavoriteCustomer(name) ? '已常用' : '⭐ 常用';
    this.title = isFavoriteCustomer(name) ? '取消常用' : '设为常用客户（置顶）';
    showSettingsHint(isFavoriteCustomer(name) ? '已设为常用客户' : '已取消常用', true);
  });

  function updateOutStockDisplay() {
    var productId = (getEl('out-part') && getEl('out-part').value);
    var product = productId ? getProductById(productId) : null;
    var unit = product ? normalizeUnit(product.unit) : DEFAULT_UNIT;
    var totalQty = productId ? getProductTotalQty(productId) : 0;
    var currentEl = getEl('out-stock-current');
    var thresholdEl = getEl('out-stock-threshold');
    var statusEl = getEl('out-stock-status');
    var cardEl = getEl('out-stock-card');
    var warnEl = getEl('out-insufficient-warn');
    var outUnitSel = getEl('out-unit');

    if (!productId) {
      if (currentEl) currentEl.textContent = '—';
      if (thresholdEl) thresholdEl.textContent = '最低警戒：—';
      if (statusEl) statusEl.textContent = '—';
      if (outUnitSel) { outUnitSel.value = DEFAULT_UNIT; outUnitSel.disabled = true; }
      if (cardEl) cardEl.classList.remove('out-stock-status-normal', 'out-stock-status-low');
      if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
      updateOutPreview();
      return;
    }
    if (outUnitSel) { outUnitSel.value = unit; outUnitSel.disabled = true; }
    var th = getEffectiveThreshold(product);
    if (currentEl) currentEl.textContent = formatQtyWithUnit(totalQty, unit);
    if (thresholdEl) thresholdEl.textContent = '最低警戒：' + th + ' ' + unit + ' · 按先进先出';
    if (statusEl) {
      if (totalQty === 0) statusEl.textContent = '缺货';
      else if (totalQty < th) statusEl.textContent = '低库存';
      else statusEl.textContent = '正常';
    }
    if (cardEl) {
      cardEl.classList.remove('out-stock-status-normal', 'out-stock-status-low');
      if (totalQty === 0 || totalQty < th) cardEl.classList.add('out-stock-status-low');
      else cardEl.classList.add('out-stock-status-normal');
    }
    if (warnEl) {
      var qty = parseInt((getEl('out-qty') && getEl('out-qty').value), 10) || 0;
      if (qty > totalQty) {
        warnEl.style.display = 'block';
        warnEl.textContent = '库存不足！当前共 ' + formatQtyWithUnit(totalQty, unit) + '，请减少出库数量。';
      } else {
        warnEl.style.display = 'none';
        warnEl.textContent = '';
      }
    }
    updateOutPreview();
  }

  function updateOutPreview() {
    var bodyEl = getEl('out-preview-body');
    if (!bodyEl) return;
    var productId = (getEl('out-part') && getEl('out-part').value);
    var product = productId ? getProductById(productId) : null;
    var qty = ((getEl('out-qty') && getEl('out-qty').value) || '').trim();
    var customer = getOutCustomerValue();
    if (!product || !qty || parseInt(qty, 10) < 1) {
      bodyEl.textContent = '请先选择配件、填写数量与客户';
      return;
    }
    var desc = (product.code || '') + ' ' + (product.name || '');
    var lines = [desc, '数量：' + qty, '客户：' + (customer || '—')];
    bodyEl.textContent = lines.join('\n');
  }

  function getContactsList() {
    return state.contactsTab === 'suppliers' ? state.suppliers : state.customers;
  }

  function getContactsFilteredList() {
    var list = getContactsList().slice();
    var kw = (state.contactsSearch || '').toLowerCase().trim();
    if (kw) {
      list = list.filter(function (item) {
        var name = (item.name || '').toLowerCase();
        var phone = (item.phone || '').toLowerCase();
        var contact = (item.contact || '').toLowerCase();
        var address = (item.address || '').toLowerCase();
        var remark = (item.remark || '').toLowerCase();
        return name.indexOf(kw) >= 0 || phone.indexOf(kw) >= 0 || contact.indexOf(kw) >= 0 || address.indexOf(kw) >= 0 || remark.indexOf(kw) >= 0;
      });
    }
    var key = state.contactsSortKey;
    var dir = state.contactsSortDir;
    list.sort(function (a, b) {
      var va = key === 'createdAt' ? (a.createdAt || '') : (a[key] || '');
      var vb = key === 'createdAt' ? (b.createdAt || '') : (b[key] || '');
      if (va === vb) return 0;
      return dir * (va < vb ? -1 : 1);
    });
    return list;
  }

  function renderContacts() {
    state.contactsSearch = (getEl('contacts-search') && getEl('contacts-search').value) ?? state.contactsSearch;
    var list = getContactsFilteredList();
    var total = list.length;
    var pageSize = state.contactsPageSize;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(state.contactsPage, totalPages);
    state.contactsPage = page;
    var start = (page - 1) * pageSize;
    var rows = list.slice(start, start + pageSize);
    var isSupplier = state.contactsTab === 'suppliers';

    var addBtn = getEl('contacts-btn-add');
    if (addBtn) addBtn.textContent = isSupplier ? '+ 新增供应商' : '+ 新增客户';

    var emptyHint = getEl('contacts-panel-empty');
    if (emptyHint) emptyHint.querySelector('p').textContent = isSupplier ? '选择左侧供应商查看或编辑，或点击右上角「+ 新增供应商」' : '选择左侧客户查看或编辑，或点击右上角「+ 新增客户」';

    var listEl = getEl('contacts-card-list');
    if (listEl) {
      if (rows.length === 0) {
        var emptyText = isSupplier ? '暂无供应商信息' : '暂无客户信息';
        listEl.innerHTML = '<li class="contacts-card-empty">' + emptyText + '</li>';
      } else {
        listEl.innerHTML = rows.map(function (item) {
          var name = escapeHtml(item.name || '');
          var phone = escapeHtml(item.phone || '');
          var address = escapeHtml(item.address || '');
          var contact = escapeHtml(item.contact || '');
          var created = (item.createdAt && new Date(item.createdAt).toLocaleString('zh-CN')) || '-';
          var addressLine = address || '—';
          var phoneLine = phone || '—';
          if (isSupplier && contact) phoneLine = phone ? (contact + ' · ' + phone) : contact;
          return '<li class="contact-card" data-id="' + item.id + '">' +
            '<div class="contact-card-body">' +
              '<div class="contact-card-name">' + name + '</div>' +
              '<div class="contact-card-phone">' + phoneLine + '</div>' +
              (address ? '<div class="contact-card-address">' + addressLine + '</div>' : '') +
              '<div class="contact-card-time">' + created + '</div>' +
            '</div>' +
            '<div class="contact-card-menu">' +
              '<button type="button" class="contact-card-menu-btn" data-id="' + item.id + '" aria-label="更多操作">⋯</button>' +
              '<div class="contact-card-dropdown" role="menu">' +
                '<button type="button" class="contact-card-menu-edit" data-id="' + item.id + '">编辑</button>' +
                '<button type="button" class="contact-card-menu-delete" data-id="' + item.id + '">删除</button>' +
              '</div>' +
            '</div>' +
          '</li>';
        }).join('');
      }
    }

    var paginationEl = getEl('contacts-pagination');
    if (paginationEl) {
      if (total === 0) {
        paginationEl.innerHTML = '';
      } else {
        var prevDisabled = page <= 1;
        var nextDisabled = page >= totalPages;
        paginationEl.innerHTML = '<div class="contacts-pagination-btns"><button type="button" id="contacts-page-prev" ' + (prevDisabled ? 'disabled' : '') + '>上一页</button><span>第 ' + page + ' / ' + totalPages + ' 页</span><button type="button" id="contacts-page-next" ' + (nextDisabled ? 'disabled' : '') + '>下一页</button></div>';
      }
    }
  }

  function openContactsPanelForm(mode, item) {
    var emptyEl = getEl('contacts-panel-empty');
    var formEl = getEl('contacts-panel-form');
    if (!emptyEl || !formEl) return;
    emptyEl.style.display = 'none';
    formEl.style.display = 'block';
    var titleEl = getEl('contacts-panel-title');
    var isSupplier = state.contactsTab === 'suppliers';
    if (mode === 'add') {
      getEl('contacts-modal-id').value = '';
      if (titleEl) titleEl.textContent = isSupplier ? '添加供应商' : '添加客户';
      getEl('contacts-modal-name-label').textContent = isSupplier ? '供应商' : '客户名';
      getEl('contacts-modal-form').reset();
      getEl('contacts-modal-created-wrap').style.display = 'none';
      getEl('contacts-field-contact-wrap').style.display = isSupplier ? 'block' : 'none';
    } else {
      if (titleEl) titleEl.textContent = isSupplier ? '编辑供应商' : '编辑客户';
      getEl('contacts-modal-name-label').textContent = isSupplier ? '供应商' : '客户名';
      getEl('contacts-modal-id').value = item.id;
      getEl('contacts-modal-name').value = item.name || '';
      getEl('contacts-modal-phone').value = item.phone || '';
      getEl('contacts-modal-remark').value = item.remark || '';
      getEl('contacts-modal-contact').value = item.contact || '';
      getEl('contacts-modal-address').value = item.address || '';
      getEl('contacts-modal-created-text').textContent = (item.createdAt && new Date(item.createdAt).toLocaleString('zh-CN')) || '-';
      getEl('contacts-modal-created-wrap').style.display = 'block';
      getEl('contacts-field-contact-wrap').style.display = isSupplier ? 'block' : 'none';
    }
  }

  function closeContactsPanelForm() {
    var emptyEl = getEl('contacts-panel-empty');
    var formEl = getEl('contacts-panel-form');
    if (emptyEl) emptyEl.style.display = 'block';
    if (formEl) formEl.style.display = 'none';
  }

  on(getEl('panel-contacts'), 'click', function (e) {
    var btn = e.target.closest('.contacts-nav-item');
    if (!btn) return;
    state.contactsTab = btn.dataset.tab;
    state.contactsPage = 1;
    document.querySelectorAll('.contacts-nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === state.contactsTab); });
    getEl('contacts-search').value = '';
    state.contactsSearch = '';
    renderContacts();
  });

  on(getEl('contacts-search'), 'input', function () {
    state.contactsPage = 1;
    renderContacts();
  });

  on(getEl('contacts-btn-add'), 'click', function () {
    openContactsPanelForm('add');
  });

  on(getEl('contacts-modal-cancel'), 'click', function () {
    closeContactsPanelForm();
  });

  on(getEl('contacts-modal-form'), 'submit', function (e) {
    e.preventDefault();
    var editId = getEl('contacts-modal-id').value.trim();
    var name = (getEl('contacts-modal-name').value || '').trim();
    if (!name) return;
    if (state.contactsTab === 'suppliers') {
      var contact = (getEl('contacts-modal-contact').value || '').trim();
      var phone = (getEl('contacts-modal-phone').value || '').trim();
      var address = (getEl('contacts-modal-address').value || '').trim();
      var remark = (getEl('contacts-modal-remark').value || '').trim();
      if (editId) {
        var s = state.suppliers.find(function (x) { return x.id === editId; });
        if (s) { s.name = name; s.contact = contact; s.phone = phone; s.address = address; s.remark = remark; }
      } else {
        state.suppliers.push({ id: id(), name: name, contact: contact, phone: phone, address: address, remark: remark, createdAt: now() });
      }
      fillSupplierSelect();
    } else {
      var address2 = (getEl('contacts-modal-address').value || '').trim();
      var phone2 = (getEl('contacts-modal-phone').value || '').trim();
      var remark2 = (getEl('contacts-modal-remark').value || '').trim();
      if (editId) {
        var c = state.customers.find(function (x) { return x.id === editId; });
        if (c) { c.name = name; c.address = address2; c.phone = phone2; c.remark = remark2; }
      } else {
        state.customers.push({ id: id(), name: name, address: address2, phone: phone2, remark: remark2, createdAt: now() });
      }
      fillCustomerSelect();
    }
    bumpDataVersion();
    persistState();
    renderContacts();
  });

  on(getEl('contacts-card-list'), 'click', function (e) {
    var card = e.target.closest('.contact-card');
    var menuBtn = e.target.closest('.contact-card-menu-btn');
    var editBtn = e.target.closest('.contact-card-menu-edit');
    var delBtn = e.target.closest('.contact-card-menu-delete');
    var dropdown = e.target.closest('.contact-card-dropdown');

    if (menuBtn) {
      e.stopPropagation();
      var menu = menuBtn.closest('.contact-card-menu');
      var open = document.querySelector('.contact-card-dropdown.is-open');
      if (open && open !== menu.querySelector('.contact-card-dropdown')) open.classList.remove('is-open');
      menu.querySelector('.contact-card-dropdown').classList.toggle('is-open');
      return;
    }
    if (editBtn) {
      e.stopPropagation();
      var id = editBtn.dataset.id;
      var list = getContactsList();
      var item = list.find(function (x) { return x.id === id; });
      if (item) { openContactsPanelForm('edit', item); }
      document.querySelectorAll('.contact-card-dropdown.is-open').forEach(function (d) { d.classList.remove('is-open'); });
      return;
    }
    if (delBtn) {
      e.stopPropagation();
      var id = delBtn.dataset.id;
      var list = getContactsList();
      var item = list.find(function (x) { return x.id === id; });
      var displayName = item ? (item.name || '该项') : '该项';
      if (!confirm('确定删除「' + displayName + '」？')) return;
      if (state.contactsTab === 'suppliers') {
        state.suppliers = state.suppliers.filter(function (x) { return x.id !== id; });
        fillSupplierSelect();
      } else {
        state.customers = state.customers.filter(function (x) { return x.id !== id; });
        fillCustomerSelect();
      }
      bumpDataVersion();
      persistState();
      var panelId = getEl('contacts-modal-id').value;
      if (panelId === id) closeContactsPanelForm();
      renderContacts();
      document.querySelectorAll('.contact-card-dropdown.is-open').forEach(function (d) { d.classList.remove('is-open'); });
      return;
    }
    if (card && !dropdown) {
      var id = card.dataset.id;
      var list = getContactsList();
      var item = list.find(function (x) { return x.id === id; });
      if (item) openContactsPanelForm('edit', item);
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#contacts-panel-col') || e.target.closest('.contact-card-menu')) return;
    document.querySelectorAll('.contact-card-dropdown.is-open').forEach(function (d) { d.classList.remove('is-open'); });
  });

  on(getEl('contacts-pagination'), 'click', function (e) {
    if (e.target.id === 'contacts-page-prev' && !e.target.disabled) {
      state.contactsPage = Math.max(1, state.contactsPage - 1);
      renderContacts();
    }
    if (e.target.id === 'contacts-page-next' && !e.target.disabled) {
      state.contactsPage = state.contactsPage + 1;
      renderContacts();
    }
  });

  function getOutCustomerValue() {
    const sel = getEl('out-customer-select');
    const input = getEl('out-customer');
    if (sel && sel.value && sel.value.trim()) return sel.value.trim();
    return input ? input.value.trim() : '';
  }

  on(getEl('form-out'), 'submit', function (e) {
    e.preventDefault();
    var productId = (getEl('out-part') && getEl('out-part').value);
    var qty = (getEl('out-qty') && getEl('out-qty').value);
    var customer = getOutCustomerValue();
    var operator = (getEl('out-operator') && getEl('out-operator').value.trim()) || state.settings.defaultOperator;
    var paymentStatus = (getEl('out-payment-status') && getEl('out-payment-status').value) || 'booked';
    if (!productId) {
      showSettingsHint('请选择配件', false);
      return;
    }
    if (!customer || !customer.trim()) {
      showSettingsHint('请选择或填写客户', false);
      return;
    }
    var ok = outByProductFIFO(productId, qty, customer, operator, paymentStatus);
    if (ok) {
      this.reset();
      if (getEl('out-operator')) getEl('out-operator').value = state.settings.defaultOperator;
      if (getEl('out-payment-status')) getEl('out-payment-status').value = 'booked';
      var qEl = getEl('out-qty');
      if (qEl) qEl.value = '1';
      fillOutPartSelect();
      fillCustomerSelect();
      updateOutStockDisplay();
      updateOutPreview();
      showSettingsHint('出库成功', true);
    } else {
      showSettingsHint('出库失败：库存不足或数量无效', false);
    }
  });

  function getFilteredStockList() {
    var keyword = ((getEl('search-input') && getEl('search-input').value) || '').toLowerCase().trim();
    var filterModel = (getEl('filter-model') && getEl('filter-model').value) || '';
    var filterMain = (getEl('filter-mainType') && getEl('filter-mainType').value) || '';
    var filterBrand = (getEl('filter-brand') && getEl('filter-brand').value) || '';
    var filterSupplier = (getEl('filter-supplier') && getEl('filter-supplier').value) || '';
    var stockMin = parseInt((getEl('filter-stock-min') && getEl('filter-stock-min').value), 10);
    var stockMax = parseInt((getEl('filter-stock-max') && getEl('filter-stock-max').value), 10);
    var lowOnly = (getEl('filter-low-only') && getEl('filter-low-only').classList).contains('active');
    var threshold = state.settings.lowStockThreshold || 5;
    var list = state.batches.map(function (b) {
      var product = getProductById(b.productId);
      return { batch: b, product: product || {} };
    });
    if (keyword) {
      list = list.filter(function (row) {
        var p = row.product;
        var b = row.batch;
        return (b.partCode || '').toLowerCase().includes(keyword) ||
          (b.partName || '').toLowerCase().includes(keyword) ||
          (p.brand || '').toLowerCase().includes(keyword) ||
          (p.spec || '').toLowerCase().includes(keyword) ||
          getModelName(p.modelId).toLowerCase().includes(keyword) ||
          (b.supplier || '').toLowerCase().includes(keyword) ||
          (b.qualityGrade || '').toLowerCase().includes(keyword);
      });
    }
    if (filterModel) list = list.filter(function (row) { return row.product.modelId === filterModel; });
    if (filterMain) list = list.filter(function (row) { return row.product.mainTypeId === filterMain; });
    if (filterBrand) list = list.filter(function (row) { return (row.product.brand || '') === filterBrand; });
    if (filterSupplier) list = list.filter(function (row) { return (row.batch.supplier || '') === filterSupplier; });
    if (!isNaN(stockMin)) list = list.filter(function (row) { return (row.batch.quantity || 0) >= stockMin; });
    if (!isNaN(stockMax)) list = list.filter(function (row) { return (row.batch.quantity || 0) <= stockMax; });
    if (lowOnly) {
      list = list.filter(function (row) {
        var th = getEffectiveThreshold(row.product);
        return (row.batch.quantity || 0) < th;
      });
      if (!state.stockSort.key) state.stockSort = { key: 'quantity', dir: 1 };
    }
    var key = state.stockSort.key;
    var dir = state.stockSort.dir;
    if (key) {
      list.sort(function (a, b) {
        var ba = a.batch;
        var bb = b.batch;
        var pa = a.product;
        var pb = b.product;
        var va, vb;
        if (key === 'model') { va = getModelName(pa.modelId); vb = getModelName(pb.modelId); return dir * (String(va).localeCompare(String(vb))); }
        if (key === 'stockValue') {
          va = (ba.quantity || 0) * (ba.costPrice || 0);
          vb = (bb.quantity || 0) * (bb.costPrice || 0);
          return dir * (va - vb);
        }
        if (key === 'costPrice') { va = ba.costPrice != null ? ba.costPrice : -1; vb = bb.costPrice != null ? bb.costPrice : -1; return dir * (va - vb); }
        if (key === 'salePrice') { va = pa.salePrice != null ? pa.salePrice : -1; vb = pb.salePrice != null ? pb.salePrice : -1; return dir * (va - vb); }
        if (key === 'code') { va = ba.partCode; vb = bb.partCode; return dir * (String(va || '').localeCompare(String(vb || ''))); }
        if (key === 'name') { va = ba.partName; vb = bb.partName; return dir * (String(va || '').localeCompare(String(vb || ''))); }
        if (key === 'unit') { va = pa.unit || ''; vb = pb.unit || ''; return dir * (String(va).localeCompare(String(vb))); }
        if (key === 'brand') { va = pa.brand; vb = pb.brand; return dir * (String(va || '').localeCompare(String(vb || ''))); }
        if (key === 'spec') { va = pa.spec; vb = pb.spec; return dir * (String(va || '').localeCompare(String(vb || ''))); }
        if (key === 'quantity') { va = ba.quantity || 0; vb = bb.quantity || 0; return dir * (va - vb); }
        return 0;
      });
    }
    return list;
  }

  function getEffectiveThreshold(product) {
    if (product && product.lowStockThreshold != null && product.lowStockThreshold !== '') {
      var n = parseInt(product.lowStockThreshold, 10);
      if (!isNaN(n) && n >= 0) return n;
    }
    return state.settings.lowStockThreshold || 5;
  }

  function getStockStatus(batchOrRow, threshold, product) {
    var q = batchOrRow.quantity != null ? batchOrRow.quantity : (batchOrRow.batch && batchOrRow.batch.quantity) ? batchOrRow.batch.quantity : 0;
    var safeThreshold = Math.max(1, threshold);
    var highLimit = safeThreshold * 2;
    if (q === 0) return { text: '缺货', rowClass: 'row-out', qtyClass: 'cell-qty-danger' };
    if (q < safeThreshold) return { text: '低库存', rowClass: 'row-low', qtyClass: 'cell-qty-danger' };
    if (q >= highLimit) return { text: '充足', rowClass: 'row-high', qtyClass: 'cell-qty-ok' };
    return { text: '正常', rowClass: 'row-normal', qtyClass: 'cell-qty-normal' };
  }

  function renderStock() {
    var list = getFilteredStockList();
    var tbody = getEl('stock-tbody');
    var cardList = getEl('stock-card-list');
    var sortKey = state.stockSort.key;
    var sortDir = state.stockSort.dir;
    var html = list
      .map(function (row, i) {
        var b = row.batch;
        var p = row.product;
        var th = getEffectiveThreshold(p);
        var isLastRow = i >= list.length - 3;
        var status = getStockStatus(b, th, p);
        var sale = (p.salePrice != null ? p.salePrice : b.salePrice) != null ? Number(p.salePrice != null ? p.salePrice : b.salePrice) : null;
        var saleStr = sale != null ? formatKip(sale) : '-';
        var wrapClass = 'dropdown-wrap' + (isLastRow ? ' dropdown-up' : '');
        var opCell =
          '<span class="stock-op-cell">' +
          '<div class="' + wrapClass + '" data-id="' + b.id + '">' +
          '<button type="button" class="btn btn-outline btn-sm btn-dropdown-toggle">更多 ▼</button>' +
          '<div class="dropdown-menu">' +
          '<button type="button" class="dropdown-item btn-stock-view" data-id="' + b.id + '">查看</button>' +
          '<button type="button" class="dropdown-item btn-stock-edit" data-id="' + b.id + '">编辑</button>' +
          '<button type="button" class="dropdown-item btn-stock-delete" data-id="' + b.id + '">删除</button>' +
          '<button type="button" class="dropdown-item btn-stock-log" data-id="' + b.id + '">查看流水</button>' +
          '</div></div></span>';
        var unitText = normalizeUnit(p.unit);
        var qtyNum = b.quantity != null ? Number(b.quantity) : 0;
        return (
          '<tr class="' + status.rowClass + '">' +
          '<td>' + (b.partCode || '-') + '</td>' +
          '<td>' + (p.brand || '-') + '</td>' +
          '<td>' + escapeHtml(p.spec || '-') + '</td>' +
          '<td>' + escapeHtml(b.partName || '-') + '</td>' +
          '<td class="' + (status.qtyClass || '') + '">' + (isNaN(qtyNum) ? 0 : qtyNum) + '</td>' +
          '<td>' + escapeHtml(unitText) + '</td>' +
          '<td class="cell-amount">' + saleStr + '</td>' +
          '<td><span class="tag tag-' + (status.rowClass === 'row-high' ? 'success' : status.rowClass === 'row-low' || status.rowClass === 'row-out' ? 'danger' : 'normal') + '">' + status.text + '</span></td>' +
          '<td>' + opCell + '</td>' +
          '</tr>'
        );
      })
      .join('');
    requestAnimationFrame(function () {
      if (tbody) tbody.innerHTML = list.length === 0 ? renderTableEmptyRow(9, '暂无库存数据') : html;
      document.querySelectorAll('#stock-table th').forEach(function (th) {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortKey) {
          th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
        }
      });
    });
    if (cardList) {
      var tagClass = function (status) { return status.rowClass === 'row-high' ? 'success' : status.rowClass === 'row-low' || status.rowClass === 'row-out' ? 'danger' : 'normal'; };
      var dropdownHtml = function (b) {
        return '<div class="dropdown-wrap dropdown-up" data-id="' + b.id + '">' +
          '<button type="button" class="btn btn-outline btn-sm btn-dropdown-toggle">更多 ▼</button>' +
          '<div class="dropdown-menu">' +
          '<button type="button" class="dropdown-item btn-stock-view" data-id="' + b.id + '">查看</button>' +
          '<button type="button" class="dropdown-item btn-stock-edit" data-id="' + b.id + '">编辑</button>' +
          '<button type="button" class="dropdown-item btn-stock-delete" data-id="' + b.id + '">删除</button>' +
          '<button type="button" class="dropdown-item btn-stock-log" data-id="' + b.id + '">查看流水</button>' +
          '</div></div>';
      };
      cardList.innerHTML = list.length === 0 ? '<li class="mobile-card-empty">暂无库存数据</li>' : list.map(function (row) {
        var b = row.batch;
        var p = row.product;
        var status = getStockStatus(b, getEffectiveThreshold(p), p);
        var qtyNum = b.quantity != null ? Number(b.quantity) : 0;
        return '<li class="mobile-card mobile-card-stock">' +
          '<span class="mobile-card-main">' + escapeHtml(b.partName || b.partCode || '-') + '</span>' +
          '<span class="mobile-card-meta">' + (b.partCode || '') + (p && p.brand ? ' · ' + escapeHtml(p.brand) : '') + '</span>' +
          '<span class="mobile-card-extra">库存 ' + (isNaN(qtyNum) ? 0 : qtyNum) + ' ' + normalizeUnit(p && p.unit) + ' · <span class="tag tag-' + tagClass(status) + '">' + status.text + '</span></span>' +
          '<div class="mobile-card-actions">' + dropdownHtml(b) + '</div></li>';
      }).join('');
    }
  }

  function openStockLog(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    var product = getProductById(batch.productId);
    var txList = state.transactions.filter(function (t) { return t.batchId === batchId || t.partId === batch.productId; }).sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
    getEl('stock-log-title').textContent = '库存流水：' + (batch.partCode || '') + ' ' + (batch.partName || '') + (batch.supplier ? ' · ' + batch.supplier : '');
    var unitLabel = normalizeUnit(product && product.unit);
    getEl('stock-log-summary').innerHTML = '当前库存 <strong>' + formatQtyWithUnit(batch.quantity ?? 0, unitLabel) + '</strong>，共 <strong>' + txList.length + '</strong> 条记录';
    getEl('stock-log-tbody').innerHTML = txList.slice(0, 50).map(function (t) {
      var qty = formatQtyWithUnit(t.quantity ?? 0, t.unit || unitLabel);
      return '<tr><td>' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</td><td>' + (t.type === 'in' ? '入库' : '出库') + '</td><td>' + qty + '</td><td>' + escapeHtml(t.supplierOrCustomer || '-') + '</td><td>' + escapeHtml(t.operator || '-') + '</td></tr>';
    }).join('');
    openModal(getEl('stock-log-modal'));
  }

  on(getEl('stock-log-close'), 'click', function () {
    closeModal(getEl('stock-log-modal'));
  });
  on((getEl('stock-log-modal') && getEl('stock-log-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(getEl('stock-log-modal'));
  });

  var imageViewerScale = 1;
  var IMAGE_VIEWER_SCALE_MIN = 0.5;
  var IMAGE_VIEWER_SCALE_MAX = 3;
  var IMAGE_VIEWER_SCALE_STEP = 0.25;

  function openImageViewer(src) {
    if (!src || !src.trim()) return;
    var imgEl = getEl('image-viewer-img');
    var scaleEl = getEl('image-viewer-scale');
    if (!imgEl || !scaleEl) return;
    imgEl.src = src;
    imageViewerScale = 1;
    imgEl.style.transform = 'scale(1)';
    scaleEl.textContent = '100%';
    openModal(getEl('image-viewer-modal'));
  }

  function applyImageViewerScale() {
    var imgEl = getEl('image-viewer-img');
    var scaleEl = getEl('image-viewer-scale');
    if (imgEl) imgEl.style.transform = 'scale(' + imageViewerScale + ')';
    if (scaleEl) scaleEl.textContent = Math.round(imageViewerScale * 100) + '%';
  }

  on(getEl('image-viewer-zoom-in'), 'click', function () {
    if (imageViewerScale < IMAGE_VIEWER_SCALE_MAX) {
      imageViewerScale = Math.min(IMAGE_VIEWER_SCALE_MAX, imageViewerScale + IMAGE_VIEWER_SCALE_STEP);
      applyImageViewerScale();
    }
  });
  on(getEl('image-viewer-zoom-out'), 'click', function () {
    if (imageViewerScale > IMAGE_VIEWER_SCALE_MIN) {
      imageViewerScale = Math.max(IMAGE_VIEWER_SCALE_MIN, imageViewerScale - IMAGE_VIEWER_SCALE_STEP);
      applyImageViewerScale();
    }
  });
  on(getEl('image-viewer-close'), 'click', function () {
    closeModal(getEl('image-viewer-modal'));
  });
  on((getEl('image-viewer-modal') && getEl('image-viewer-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(getEl('image-viewer-modal'));
  });

  function openStockDetail(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    var p = getProductById(batch.productId);
    if (!p) p = {};
    var cost = batch.costPrice != null ? Number(batch.costPrice) : null;
    var sale = (p.salePrice != null ? p.salePrice : batch.salePrice) != null ? Number(p.salePrice != null ? p.salePrice : batch.salePrice) : null;
    var stockValue = (batch.quantity || 0) * (cost || 0);
    getEl('stock-detail-title').textContent = (batch.partCode || '') + ' ' + (batch.partName || '') + (batch.supplier ? ' · ' + batch.supplier : '');
    var imgWrap = getEl('stock-detail-image-wrap');
    if (imgWrap) {
      var imgUrl = (p.imageUrl || '').trim();
      if (imgUrl) {
        var img = document.createElement('img');
        img.className = 'stock-detail-img';
        img.alt = '配件图';
        img.src = imgUrl;
        img.onerror = function () { imgWrap.innerHTML = '<span class="no-pic">暂无图片</span>'; };
        img.onclick = function () { openImageViewer(imgUrl); };
        imgWrap.innerHTML = '';
        imgWrap.appendChild(img);
      } else {
        imgWrap.innerHTML = '<span class="no-pic">暂无图片</span>';
      }
    }
    getEl('stock-detail-body').innerHTML =
      '<dt>厂家</dt><dd>' + (batch.supplier || '-') + '</dd>' +
      '<dt>质量</dt><dd>' + (batch.qualityGrade || '-') + '</dd>' +
      '<dt>车型</dt><dd>' + getModelName(p.modelId) + '</dd>' +
      '<dt>主件 / 子件</dt><dd>' + getMainTypeName(p.mainTypeId) + ' / ' + getSubTypeName(p.subTypeId) + '</dd>' +
      '<dt>单位</dt><dd>' + escapeHtml(normalizeUnit(p.unit)) + '</dd>' +
      '<dt>成本价（KIP）</dt><dd>' + (cost != null ? formatKip(cost) : '-') + '</dd>' +
      '<dt>参考售价（KIP）</dt><dd>' + (sale != null ? formatKip(sale) : '-') + '</dd>' +
      '<dt>库存金额（KIP）</dt><dd>' + (stockValue ? formatKip(stockValue) : '-') + '</dd>' +
      '<dt>最后更新</dt><dd>' + (batch.updatedAt ? new Date(batch.updatedAt).toLocaleString('zh-CN') : '-') + '</dd>';
    var modal = getEl('stock-detail-modal');
    if (modal) modal.setAttribute('data-batch-id', String(batchId));
    openModal(modal);
  }

  on(getEl('stock-detail-close'), 'click', function () {
    closeModal(getEl('stock-detail-modal'));
  });
  on((getEl('stock-detail-modal') && getEl('stock-detail-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(getEl('stock-detail-modal'));
  });
  on(getEl('stock-detail-btn-log'), 'click', function () {
    var modal = getEl('stock-detail-modal');
    var id = modal && modal.getAttribute('data-batch-id');
    if (id) { openStockLog(id); closeModal(modal); }
  });
  on(getEl('stock-detail-btn-edit'), 'click', function () {
    var modal = getEl('stock-detail-modal');
    var id = modal && modal.getAttribute('data-batch-id');
    if (id) { closeModal(modal); openStockEdit(id); }
  });
  on(getEl('stock-detail-btn-delete'), 'click', function () {
    var modal = getEl('stock-detail-modal');
    var id = modal && modal.getAttribute('data-batch-id');
    if (id && confirm('确定删除该批次库存？删除后不可恢复。')) {
      deleteStockPart(id);
      closeModal(modal);
      renderStock();
    }
  });

  var pendingEditImage = '';

  function fillStockEditSelects(part) {
    fillSelect(getEl('stock-edit-model'), [{ id: '', name: '请选择车型' }].concat(state.models.map(function (m) { return { id: m.id, name: m.name }; })), 'id', 'name');
    fillSelect(getEl('stock-edit-mainType'), [{ id: '', name: '请选择主件' }].concat(state.mainTypes.map(function (t) { return { id: t.id, name: t.name }; })), 'id', 'name');
    var mainId = part ? (part.mainTypeId || '') : (getEl('stock-edit-mainType') && getEl('stock-edit-mainType').value);
    var subs = state.subTypes.filter(function (s) { return s.mainTypeId === mainId; });
    fillSelect(getEl('stock-edit-subType'), [{ id: '', name: '请选择子件' }].concat(subs.map(function (s) { return { id: s.id, name: s.name }; })), 'id', 'name');
    fillSelect(getEl('stock-edit-quality'), [{ id: '', name: '请选择' }].concat(QUALITY_GRADES.map(function (g) { return { id: g, name: g }; })), 'id', 'name');
    if (part) {
      getEl('stock-edit-model').value = part.modelId || '';
      getEl('stock-edit-mainType').value = part.mainTypeId || '';
      getEl('stock-edit-subType').value = part.subTypeId || '';
    }
  }

  on(getEl('stock-edit-mainType'), 'change', function () {
    var subs = state.subTypes.filter(function (s) { return s.mainTypeId === this.value; });
    fillSelect(getEl('stock-edit-subType'), [{ id: '', name: '请选择子件' }, ...subs], 'id', 'name');
  });

  function openStockEdit(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    var p = getProductById(batch.productId);
    if (!p) p = {};
    pendingEditImage = '';
    getEl('stock-edit-id').value = batch.id;
    getEl('stock-edit-product-id').value = p.id || '';
    getEl('stock-edit-code').value = batch.partCode || '';
    getEl('stock-edit-name').value = p.name || batch.partName || '';
    getEl('stock-edit-brand').value = p.brand || '';
    getEl('stock-edit-spec').value = p.spec || '';
    var lowThEl = getEl('stock-edit-lowStockThreshold');
    if (lowThEl) lowThEl.value = (p.lowStockThreshold != null && p.lowStockThreshold !== '') ? p.lowStockThreshold : '';
    var unitSel = getEl('stock-edit-unit');
    if (unitSel && unitSel.tagName === 'SELECT') {
      fillSelect(unitSel, UNIT_OPTIONS.map(function (u) { return { id: u, name: u }; }), 'id', 'name');
      unitSel.value = normalizeUnit(p.unit);
    } else if (unitSel) unitSel.value = normalizeUnit(p.unit);
    getEl('stock-edit-costPrice').value = batch.costPrice != null && batch.costPrice !== '' ? batch.costPrice : '';
    getEl('stock-edit-salePrice').value = p.salePrice != null && p.salePrice !== '' ? p.salePrice : '';
    getEl('stock-edit-supplier').value = batch.supplier || '';
    getEl('stock-edit-quality').value = batch.qualityGrade || '';
    var qtyEl = getEl('stock-edit-qty');
    if (qtyEl) { qtyEl.value = batch.quantity ?? ''; qtyEl.readOnly = true; qtyEl.title = '由入库/出库自动计算'; }
    fillStockEditSelects(p);
    var preview = getEl('stock-edit-imagePreview');
    if (preview) {
      preview.src = (p.imageUrl || '').trim() || '';
      preview.style.display = (p.imageUrl || '').trim() ? 'block' : 'none';
    }
    var fileInput = getEl('stock-edit-imageFile');
    if (fileInput) fileInput.value = '';
    openModal(getEl('stock-edit-modal'));
  }

  on(getEl('stock-edit-imageFile'), 'change', function () {
    var file = this.files && this.files[0];
    var preview = getEl('stock-edit-imagePreview');
    if (!file || !file.type.startsWith('image/')) {
      pendingEditImage = '';
      if (preview) preview.src = '';
      return;
    }
    compressImageFile(file, 1000, 0.88, function (dataUrl) {
      pendingEditImage = dataUrl;
      if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
    });
  });

  on(getEl('stock-edit-form'), 'submit', function (e) {
    e.preventDefault();
    var batchId = getEl('stock-edit-id').value;
    var productId = getEl('stock-edit-product-id').value;
    var batch = getBatchById(batchId);
    var product = productId ? getProductById(productId) : null;
    if (!batch) return;
    if (product) {
      product.name = getEl('stock-edit-name').value.trim();
      product.brand = getEl('stock-edit-brand').value.trim();
      product.spec = getEl('stock-edit-spec').value.trim();
      product.unit = normalizeUnit(getEl('stock-edit-unit').value);
      var saleVal = getEl('stock-edit-salePrice').value;
      product.salePrice = saleVal === '' ? undefined : Number(saleVal);
      product.modelId = getEl('stock-edit-model').value || undefined;
      product.mainTypeId = getEl('stock-edit-mainType').value || undefined;
      product.subTypeId = getEl('stock-edit-subType').value || undefined;
      var lowThVal = getEl('stock-edit-lowStockThreshold').value.trim();
      product.lowStockThreshold = lowThVal === '' ? undefined : Math.max(0, parseInt(lowThVal, 10) || 0);
      if (pendingEditImage) product.imageUrl = pendingEditImage;
      product.updatedAt = now();
      batch.partName = product.name;
    }
    var costVal = getEl('stock-edit-costPrice').value;
    batch.costPrice = costVal === '' ? undefined : Number(costVal);
    batch.supplier = getEl('stock-edit-supplier').value.trim() || undefined;
    batch.qualityGrade = getEl('stock-edit-quality').value.trim() || undefined;
    /* 库存数量由流水自动计算，不在此编辑 */
    batch.updatedAt = now();
    bumpDataVersion();
    persistState();
    pendingEditImage = '';
    closeModal(getEl('stock-edit-modal'));
    renderStock();
    showSettingsHint('已保存', true);
  });

  on(getEl('stock-edit-cancel'), 'click', function () {
    closeModal(getEl('stock-edit-modal'));
  });
  on((getEl('stock-edit-modal') && getEl('stock-edit-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(getEl('stock-edit-modal'));
  });

  function deleteStockPart(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    if (!confirm('确定要删除该批次「' + (batch.partCode || '') + ' ' + (batch.partName || '') + (batch.supplier ? ' · ' + batch.supplier : '') + '」吗？删除后该批次将从库存列表移除，流水记录会保留。')) return;
    state.batches = state.batches.filter(function (b) { return b.id !== batchId; });
    bumpDataVersion();
    persistState();
    renderStock();
    showSettingsHint('已删除', true);
  }

  on(getEl('panel-stock'), 'click', function (e) {
    var thumb = e.target.closest('.stock-thumb');
    if (thumb && thumb.src) {
      openImageViewer(thumb.src);
      return;
    }
    var toggle = e.target.closest('.btn-dropdown-toggle');
    if (toggle) {
      var wrap = toggle.closest('.dropdown-wrap');
      document.querySelectorAll('.dropdown-wrap.open').forEach(function (w) { if (w !== wrap) w.classList.remove('open'); });
      if (wrap) wrap.classList.toggle('open');
      return;
    }
    var logBtn = e.target.closest('.btn-stock-log');
    var viewBtn = e.target.closest('.btn-stock-view');
    var detailBtn = e.target.closest('.btn-stock-detail');
    var editBtn = e.target.closest('.btn-stock-edit');
    var deleteBtn = e.target.closest('.btn-stock-delete');
    if (viewBtn) { openStockDetail(viewBtn.dataset.id); return; }
    if (logBtn) { openStockLog(logBtn.dataset.id); var _w = logBtn.closest('.dropdown-wrap'); if (_w) _w.classList.remove('open'); return; }
    if (detailBtn) { openStockDetail(detailBtn.dataset.id); var _w = detailBtn.closest('.dropdown-wrap'); if (_w) _w.classList.remove('open'); return; }
    if (editBtn) { openStockEdit(editBtn.dataset.id); var _w = editBtn.closest('.dropdown-wrap'); if (_w) _w.classList.remove('open'); return; }
    if (deleteBtn) {
      if (confirm('确定删除该批次库存？删除后不可恢复。')) {
        deleteStockPart(deleteBtn.dataset.id);
        var _w = deleteBtn.closest('.dropdown-wrap'); if (_w) _w.classList.remove('open');
        renderStock();
      }
      return;
    }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.dropdown-wrap')) document.querySelectorAll('.dropdown-wrap.open').forEach(function (w) { w.classList.remove('open'); });
  });

  on(getEl('stock-table'), 'click', function (e) {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const key = th.dataset.sort;
    if (!key) return;
    if (state.stockSort.key === key) {
      state.stockSort.dir = -state.stockSort.dir;
    } else {
      state.stockSort.key = key;
      state.stockSort.dir = 1;
    }
    renderStock();
  });

  var stockSearchDebounceTimer = null;
  var STOCK_SEARCH_DEBOUNCE_MS = 280;
  on(getEl('search-input'), 'input', function () {
    if (stockSearchDebounceTimer) clearTimeout(stockSearchDebounceTimer);
    stockSearchDebounceTimer = setTimeout(function () {
      stockSearchDebounceTimer = null;
      renderStock();
    }, STOCK_SEARCH_DEBOUNCE_MS);
  });
  /* 下拉框选择后自动刷新列表，无需点搜索 */
  on(getEl('filter-model'), 'change', function () { renderStock(); });
  on(getEl('filter-mainType'), 'change', function () { renderStock(); });
  on(getEl('filter-brand'), 'change', function () { renderStock(); });
  on(getEl('filter-supplier'), 'change', function () { renderStock(); });
  var stockRangeDebounceTimer = null;
  function scheduleStockRangeRefresh() {
    if (stockRangeDebounceTimer) clearTimeout(stockRangeDebounceTimer);
    stockRangeDebounceTimer = setTimeout(function () {
      stockRangeDebounceTimer = null;
      renderStock();
    }, 320);
  }
  on(getEl('filter-stock-min'), 'input', scheduleStockRangeRefresh);
  on(getEl('filter-stock-max'), 'input', scheduleStockRangeRefresh);
  on(getEl('btn-search'), 'click', function () {
    if (stockSearchDebounceTimer) clearTimeout(stockSearchDebounceTimer);
    stockSearchDebounceTimer = null;
    renderStock();
  });
  on(getEl('filter-low-only'), 'click', function () {
    this.classList.toggle('active');
    renderStock();
  });
  on(getEl('btn-reset'), 'click', function () {
    var searchInput = getEl('search-input');
    var filterModel = getEl('filter-model');
    var filterMain = getEl('filter-mainType');
    var filterBrand = getEl('filter-brand');
    var filterSupplier = getEl('filter-supplier');
    var filterStockMin = getEl('filter-stock-min');
    var filterStockMax = getEl('filter-stock-max');
    var lowBtn = getEl('filter-low-only');
    if (searchInput) searchInput.value = '';
    if (filterModel) filterModel.value = '';
    if (filterMain) filterMain.value = '';
    if (filterBrand) filterBrand.value = '';
    if (filterSupplier) filterSupplier.value = '';
    if (filterStockMin) filterStockMin.value = '';
    if (filterStockMax) filterStockMax.value = '';
    if (lowBtn) lowBtn.classList.remove('active');
    renderStock();
  });

  function exportStockListJson() {
    var list = getFilteredStockList().map(function (row) {
      var b = row.batch;
      var p = row.product;
      return {
        code: b.partCode,
        name: b.partName,
        brand: p.brand,
        spec: p.spec,
        model: getModelName(p.modelId),
        mainType: getMainTypeName(p.mainTypeId),
        subType: getSubTypeName(p.subTypeId),
        supplier: b.supplier,
        qualityGrade: b.qualityGrade,
        quantity: b.quantity,
        unit: normalizeUnit(p.unit),
        costPrice: b.costPrice,
        salePrice: p.salePrice != null ? p.salePrice : b.salePrice,
        updatedAt: b.updatedAt,
      };
    });
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aw_stock_list_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportStockListCsv() {
    var list = getFilteredStockList();
    var headers = ['编码', '品牌', '型号', '名称', '库存', '单位', '成本价', '销售价', '车型', '主件', '子件', '厂家', '质量', '最后更新'];
    var rows = list.map(function (row) {
      var b = row.batch;
      var p = row.product;
      var sale = p.salePrice != null ? p.salePrice : b.salePrice;
      return [
        b.partCode || '',
        p.brand || '',
        p.spec || '',
        b.partName || '',
        b.quantity ?? '',
        normalizeUnit(p.unit),
        formatKip(b.costPrice) || '',
        formatKip(sale) || '',
        getModelName(p.modelId),
        getMainTypeName(p.mainTypeId),
        getSubTypeName(p.subTypeId),
        b.supplier || '',
        b.qualityGrade || '',
        b.updatedAt ? new Date(b.updatedAt).toLocaleString('zh-CN') : '',
      ];
    });
    const BOM = '\uFEFF';
    const csv = BOM + [headers.join(','), ...rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); })].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aw_stock_list_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  on(getEl('btn-export-stock-csv'), 'click', exportStockListCsv);

  function fillFilterSelects() {
    fillSelect(getEl('filter-model'), [{ id: '', name: '全部车型' }, ...state.models], 'id', 'name');
    fillSelect(getEl('filter-mainType'), [{ id: '', name: '全部主件' }, ...state.mainTypes], 'id', 'name');
    var brands = [];
    var seenBrand = {};
    state.products.forEach(function (p) {
      var b = (p.brand || '').trim();
      if (b && !seenBrand[b]) { seenBrand[b] = true; brands.push({ id: b, name: b }); }
    });
    fillSelect(getEl('filter-brand'), [{ id: '', name: '全部品牌' }, ...brands], 'id', 'name');
    var suppliers = [];
    var seenSup = {};
    state.batches.forEach(function (b) {
      var s = (b.supplier || '').trim();
      if (s && !seenSup[s]) { seenSup[s] = true; suppliers.push({ id: s, name: s }); }
    });
    fillSelect(getEl('filter-supplier'), [{ id: '', name: '全部厂家' }, ...suppliers], 'id', 'name');
  }

  function fillRecordsFilters() {
    fillSelect(getEl('records-model'), [{ id: '', name: '全部车型' }, ...state.models], 'id', 'name');
    var suppliers = state.suppliers.map(function (s) { return s.name; }).filter(Boolean);
    var custSet = {};
    state.transactions.forEach(function (t) {
      if (t.type === 'out' && (t.supplierOrCustomer || '').trim()) custSet[t.supplierOrCustomer.trim()] = 1;
    });
    var customers = Object.keys(custSet);
    fillSelect(getEl('records-supplier'), [{ id: '', name: '全部供应商' }, ...suppliers.map(function (n) { return { id: n, name: n }; })], 'id', 'name');
    fillSelect(getEl('records-customer'), [{ id: '', name: '全部客户' }, ...customers.map(function (n) { return { id: n, name: n }; })], 'id', 'name');
  }

  function getFilteredRecords() {
    var type = state.recordsType;
    var params = getRecordsFilterParams();
    var list = state.transactions.filter(function (t) {
      if (t.type !== type) return false;
      if (params.keyword) {
        var name = getPartName(t.productId || t.partId);
        if (!(t.partCode || '').toLowerCase().includes(params.keyword) && !(name || '').toLowerCase().includes(params.keyword)) return false;
      }
      if (params.modelId) {
        var product = getProductById(t.productId || t.partId);
        if (!product || product.modelId !== params.modelId) return false;
      }
      if (params.supplier && t.type === 'in' && (t.supplierOrCustomer || '').trim() !== params.supplier) return false;
      if (params.customer && t.type === 'out' && (t.supplierOrCustomer || '').trim() !== params.customer) return false;
      if (params.dateFrom && t.time && t.time.slice(0, 10) < params.dateFrom) return false;
      if (params.dateTo && t.time && t.time.slice(0, 10) > params.dateTo) return false;
      return true;
    });
    list = list.slice().sort(function (a, b) {
      return (b.time || '').localeCompare(a.time || '');
    });
    return list;
  }

  function renderRecords() {
    var list = getFilteredRecords();
    var tbody = getEl('records-tbody');
    var cardList = getEl('records-card-list');
    var html = list
      .map(function (t) {
        var partName = getPartName(t.productId || t.partId);
        if (partName === '-' && !t.partCode) return '';
        var product = getProductById(t.productId || t.partId);
        var unitLabel = t.unit ? normalizeUnit(t.unit) : (product ? normalizeUnit(product.unit) : DEFAULT_UNIT);
        var qtyStr = formatQtyWithUnit(t.quantity ?? 0, unitLabel);
        var rowClass = t.type === 'in' ? 'record-row-in' : 'record-row-out';
        return (
          '<tr class="record-row ' + rowClass + '" data-tx-id="' + (t.id || '') + '" role="button" tabindex="0" title="点击查看详情">' +
          '<td>' + (t.partCode || '-') + '</td>' +
          '<td>' + (partName || '-') + '</td>' +
          '<td>' + (t.type === 'in' ? '入库' : '出库') + '</td>' +
          '<td>' + qtyStr + '</td>' +
          '<td>' + (t.supplierOrCustomer || '-') + '</td>' +
          '<td>' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</td></tr>'
        );
      })
      .join('');
    requestAnimationFrame(function () {
      if (tbody) tbody.innerHTML = list.length === 0 ? renderTableEmptyRow(6, '当前筛选条件下暂无出入库记录') : html;
    });
    if (cardList) {
      cardList.innerHTML = list.length === 0 ? '<li class="mobile-card-empty">暂无记录</li>' : list.filter(function (t) {
        var partName = getPartName(t.productId || t.partId);
        return partName !== '-' || t.partCode;
      }).map(function (t) {
        var partName = getPartName(t.productId || t.partId);
        var product = getProductById(t.productId || t.partId);
        var unitLabel = t.unit ? normalizeUnit(t.unit) : (product ? normalizeUnit(product.unit) : DEFAULT_UNIT);
        var qtyStr = formatQtyWithUnit(t.quantity ?? 0, unitLabel);
        var typeLabel = t.type === 'in' ? '入库' : '出库';
        return '<li class="mobile-card record-card" data-tx-id="' + (t.id || '') + '" role="button" tabindex="0" title="点击查看详情">' +
          '<span class="mobile-card-main">' + escapeHtml(partName || t.partCode || '-') + '</span>' +
          '<span class="mobile-card-meta">' + typeLabel + ' · ' + qtyStr + '</span>' +
          '<span class="mobile-card-extra">' + escapeHtml(t.supplierOrCustomer || '-') + ' · ' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</span></li>';
      }).join('');
    }
  }

  function openRecordDetail(txId) {
    var t = state.transactions.find(function (x) { return x.id === txId; });
    if (!t) return;
    var partName = getPartName(t.productId || t.partId);
    var product = getProductById(t.productId || t.partId);
    var unitLabel = t.unit ? normalizeUnit(t.unit) : (product ? normalizeUnit(product.unit) : DEFAULT_UNIT);
    var qtyStr = t.quantity != null ? formatQtyWithUnit(t.quantity, unitLabel) : '-';
    var body = getEl('record-detail-body');
    if (!body) return;
    var salePriceStr = t.type === 'out' && t.salePrice != null ? (typeof formatKip === 'function' ? formatKip(t.salePrice) : t.salePrice) : '-';
    body.innerHTML =
      '<dt>时间</dt><dd>' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</dd>' +
      '<dt>类型</dt><dd>' + (t.type === 'in' ? '入库' : '出库') + '</dd>' +
      '<dt>配件编码</dt><dd>' + (t.partCode || '-') + '</dd>' +
      '<dt>配件名称</dt><dd>' + (partName || '-') + '</dd>' +
      '<dt>数量</dt><dd>' + qtyStr + '</dd>' +
      '<dt>供应商/客户</dt><dd>' + (t.supplierOrCustomer || '-') + '</dd>' +
      '<dt>操作人员</dt><dd>' + (t.operator || '-') + '</dd>' +
      '<dt>销售价（出库，KIP）</dt><dd>' + salePriceStr + '</dd>';
    var modal = getEl('record-detail-modal');
    if (modal) openModal(modal);
  }

  function closeRecordDetailModal() {
    var modal = getEl('record-detail-modal');
    if (modal) closeModal(modal);
  }

  on(getEl('panel-records'), 'click', function (e) {
    var btn = e.target.closest('.records-tab');
    if (!btn) return;
    state.recordsType = btn.dataset.recordType;
    document.querySelectorAll('.records-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.recordType === state.recordsType); });
    renderRecords();
    updateRecordsStats();
  });

  on(getEl('records-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderRecords();
    updateRecordsStats();
  });

  on(getEl('btn-records-reset'), 'click', function () {
    getEl('records-keyword').value = '';
    getEl('records-model').value = '';
    getEl('records-supplier').value = '';
    getEl('records-customer').value = '';
    getEl('records-dateFrom').value = '';
    getEl('records-dateTo').value = '';
    renderRecords();
    updateRecordsStats();
  });

  function handleRecordRowClick(e) {
    var row = e.target.closest('tr.record-row');
    var card = e.target.closest('.record-card');
    var el = row || card;
    if (el) {
      var txId = el.getAttribute('data-tx-id');
      if (txId) openRecordDetail(txId);
    }
  }
  on(getEl('records-tbody'), 'click', handleRecordRowClick);
  on(getEl('records-card-list'), 'click', handleRecordRowClick);
  on(getEl('records-tbody'), 'keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('tr.record-row');
    if (row) {
      e.preventDefault();
      var txId = row.getAttribute('data-tx-id');
      if (txId) openRecordDetail(txId);
    }
  });
  on(getEl('records-card-list'), 'keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.record-card');
    if (card) {
      e.preventDefault();
      var txId = card.getAttribute('data-tx-id');
      if (txId) openRecordDetail(txId);
    }
  });

  on(getEl('record-detail-close'), 'click', closeRecordDetailModal);
  on((getEl('record-detail-modal') && getEl('record-detail-modal').querySelector('.modal-overlay')), 'click', closeRecordDetailModal);

  function getRecordsFilterParams() {
    return {
      keyword: ((getEl('records-keyword') && getEl('records-keyword').value) || '').toLowerCase().trim(),
      modelId: (getEl('records-model') && getEl('records-model').value) || '',
      supplier: ((getEl('records-supplier') && getEl('records-supplier').value) || '').trim(),
      customer: ((getEl('records-customer') && getEl('records-customer').value) || '').trim(),
      dateFrom: (getEl('records-dateFrom') && getEl('records-dateFrom').value) || '',
      dateTo: (getEl('records-dateTo') && getEl('records-dateTo').value) || '',
    };
  }

  function filterTransactionsByParams(list, params) {
    return list.filter(function (t) {
      if (params.keyword) {
        var name = getPartName(t.productId || t.partId);
        if (!(t.partCode || '').toLowerCase().includes(params.keyword) && !(name || '').toLowerCase().includes(params.keyword)) return false;
      }
      if (params.modelId) {
        var product = getProductById(t.productId || t.partId);
        if (!product || product.modelId !== params.modelId) return false;
      }
      if (params.supplier && t.type === 'in' && (t.supplierOrCustomer || '').trim() !== params.supplier) return false;
      if (params.customer && t.type === 'out' && (t.supplierOrCustomer || '').trim() !== params.customer) return false;
      if (params.dateFrom && t.time && t.time.slice(0, 10) < params.dateFrom) return false;
      if (params.dateTo && t.time && t.time.slice(0, 10) > params.dateTo) return false;
      return true;
    });
  }

  function updateRecordsStats() {
    var el = getEl('records-stats');
    if (!el) return;
    var params = getRecordsFilterParams();
    var inList = filterTransactionsByParams(state.transactions.filter(function (t) { return t.type === 'in'; }), params);
    var outList = filterTransactionsByParams(state.transactions.filter(function (t) { return t.type === 'out'; }), params);
    var inQty = inList.reduce(function (sum, t) { return sum + (t.quantity || 0); }, 0);
    var outQty = outList.reduce(function (sum, t) { return sum + (t.quantity || 0); }, 0);
    var html = '<div class="records-stats-line"><strong>出入库汇总（当前筛选）：</strong> 总入库 ' + inList.length + ' 笔 / ' + inQty + ' 件；总出库 ' + outList.length + ' 笔 / ' + outQty + ' 件。</div>';
    if (params.supplier) html += '<div class="records-stats-line">按供应商：' + escapeHtml(params.supplier) + '</div>';
    if (params.customer) html += '<div class="records-stats-line">按客户：' + escapeHtml(params.customer) + '</div>';
    el.innerHTML = html;
  }

  /** 出库记录：按当前筛选条件打印该时间段内所有出库明细 */
  function getFilteredOutRecords() {
    var params = getRecordsFilterParams();
    var list = state.transactions.filter(function (t) {
      if (t.type !== 'out') return false;
      if (params.keyword) {
        var name = getPartName(t.productId || t.partId);
        if (!(t.partCode || '').toLowerCase().includes(params.keyword) && !(name || '').toLowerCase().includes(params.keyword)) return false;
      }
      if (params.modelId) {
        var product = getProductById(t.productId || t.partId);
        if (!product || product.modelId !== params.modelId) return false;
      }
      if (params.customer && (t.supplierOrCustomer || '').trim() !== params.customer) return false;
      if (params.dateFrom && t.time && t.time.slice(0, 10) < params.dateFrom) return false;
      if (params.dateTo && t.time && t.time.slice(0, 10) > params.dateTo) return false;
      return true;
    });
    return list.slice().sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
  }

  function openPrintOutboundWindow(rows, customerName, timeLabel) {
    var cust = state.customers.find(function (c) { return (c.name || '').trim() === (customerName || '').trim(); });
    var phone = (cust && cust.phone) ? cust.phone : '—';
    var totalQty = 0;
    var totalAmount = 0;
    rows.forEach(function (r) { totalQty += r.qty; totalAmount += r.total; });
    var html = '<h2 style="font-size:16px;margin:0 0 12px;">出库单</h2>';
    html += '<table border="0" cellpadding="4" cellspacing="0" style="font-size:12px;width:100%;margin-bottom:12px;">';
    html += '<tr><td style="padding:2px 12px 2px 0;">客户</td><td>' + escapeHtml(customerName || '—') + '</td></tr>';
    html += '<tr><td style="padding:2px 12px 2px 0;">时间</td><td>' + escapeHtml(timeLabel) + '</td></tr>';
    html += '<tr><td style="padding:2px 12px 2px 0;">联系电话</td><td>' + escapeHtml(phone) + '</td></tr>';
    html += '</table>';
    html += '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:12px;width:100%;">';
    html += '<tr><th>编码</th><th>名称</th><th>数量</th><th>单价（KIP）</th><th>总价（KIP）</th></tr>';
    rows.forEach(function (r) {
      html += '<tr><td>' + escapeHtml(r.code) + '</td><td>' + escapeHtml(r.name) + '</td><td>' + r.qty + '</td><td>' + formatKip(r.unitPrice) + '</td><td>' + formatKip(r.total) + '</td></tr>';
    });
    html += '<tr style="font-weight:bold;"><td colspan="2">合计</td><td>' + totalQty + '</td><td></td><td>' + formatKip(totalAmount) + '</td></tr>';
    html += '</table>';
    var win = window.open('', '_blank');
    win.document.write('<html><head><title>出库单</title><style>body{font-family:inherit;padding:20px;}</style></head><body>' + html + '</body></html>');
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); win.close(); }, 300);
  }

  function printOutboundSlipFromRecords() {
    var list = getFilteredOutRecords();
    if (list.length === 0) {
      showSettingsHint('当前筛选条件下没有出库记录', false);
      return;
    }
    var params = getRecordsFilterParams();
    var timeLabel = params.dateFrom && params.dateTo ? params.dateFrom + ' 至 ' + params.dateTo : (params.dateFrom || params.dateTo || '全部');
    var customerName = params.customer ? params.customer : (list.length && list.every(function (t) { return (t.supplierOrCustomer || '').trim() === (list[0].supplierOrCustomer || '').trim(); }) ? (list[0].supplierOrCustomer || '').trim() : '多客户');
    var rows = list.map(function (t) {
      var u = t.salePrice != null ? Number(t.salePrice) : 0;
      var q = t.quantity || 0;
      return {
        code: t.partCode || '',
        name: getPartName(t.productId || t.partId) || '',
        qty: q,
        unitPrice: u,
        total: q * u,
      };
    });
    openPrintOutboundWindow(rows, customerName, timeLabel);
  }

  on(getEl('btn-records-print-outbound'), 'click', printOutboundSlipFromRecords);

  function getCustomerStatsList() {
    var keyword = ((getEl('customerStats-keyword') && getEl('customerStats-keyword').value) || '').trim().toLowerCase();
    var list = state.transactions.filter(function (t) { return t.type === 'out'; });
    var byCustomer = {};
    list.forEach(function (t) {
      var name = (t.supplierOrCustomer || '').trim() || '（未填客户）';
      if (!byCustomer[name]) byCustomer[name] = { count: 0, qty: 0, sales: 0, debt: 0, cost: 0 };
      byCustomer[name].count += 1;
      var q = t.quantity || 0;
      var sale = t.salePrice != null ? t.salePrice : 0;
      var cost = t.costPrice != null ? t.costPrice : 0;
      byCustomer[name].qty += q;
      byCustomer[name].sales += q * sale;
      byCustomer[name].cost += q * cost;
      if (t.paymentStatus === 'booked') byCustomer[name].debt += q * sale;
    });
    var rows = Object.keys(byCustomer).map(function (name) {
      var o = byCustomer[name];
      var profit = (o.sales || 0) - (o.cost || 0);
      return { name: name, count: o.count, qty: o.qty, sales: o.sales, debt: o.debt || 0, profit: profit };
    });
    var sortBy = (getEl('customerStats-sortBy') && getEl('customerStats-sortBy').value) || 'sales';
    if (sortBy === 'debt') rows.sort(function (a, b) { return (b.debt || 0) - (a.debt || 0); });
    else rows.sort(function (a, b) { return b.sales - a.sales; });
    if (keyword) rows = rows.filter(function (r) { return (r.name || '').toLowerCase().indexOf(keyword) !== -1; });
    return rows;
  }

  function renderCustomerStats() {
    var list = getCustomerStatsList();
    var tbody = getEl('customerStats-tbody');
    var cardList = getEl('customerStats-card-list');
    if (tbody) {
      tbody.innerHTML = list.length === 0 ? renderTableEmptyRow(6, '暂无客户数据，请先添加客户并产生出库') : list.map(function (row) {
        var salesStr = row.sales != null ? formatKip(row.sales) : '0.000';
        var debtStr = row.debt != null ? formatKip(row.debt) : '0.000';
        var profitStr = row.profit != null ? formatKip(row.profit) : '0.000';
        return '<tr><td>' + escapeHtml(row.name) + '</td><td>' + row.count + '</td><td>' + row.qty + '</td><td class="cell-amount">' + salesStr + '</td><td class="cell-amount cell-debt">' + debtStr + '</td><td class="cell-amount">' + profitStr + '</td></tr>';
      }).join('');
    }
    if (cardList) {
      cardList.innerHTML = list.length === 0 ? '<li class="mobile-card-empty">暂无客户数据</li>' : list.map(function (row) {
        var salesStr = row.sales != null ? formatKip(row.sales) : '0.000';
        var debtStr = row.debt != null ? formatKip(row.debt) : '0.000';
        return '<li class="mobile-card"><span class="mobile-card-main">' + escapeHtml(row.name) + '</span><span class="mobile-card-meta">' + row.count + ' 笔 · ' + row.qty + ' 件</span><span class="mobile-card-extra">销售额 ' + salesStr + ' KIP · 欠款 ' + debtStr + ' KIP</span></li>';
      }).join('');
    }
  }

  on(getEl('btn-customerStats-search'), 'click', renderCustomerStats);
  on(getEl('btn-customerStats-reset'), 'click', function () {
    var kw = getEl('customerStats-keyword');
    if (kw) kw.value = '';
    renderCustomerStats();
  });
  on(getEl('customerStats-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderCustomerStats();
  });
  on(getEl('customerStats-sortBy'), 'change', renderCustomerStats);

  /** 欠款管理：未收款出库明细 + 单笔标记已收款（按出库时间从旧到新） */
  function getUnpaidOutTransactions(keyword) {
    var list = state.transactions.filter(function (t) {
      return t.type === 'out' && (t.paymentStatus === 'booked' || !t.paymentStatus);
    });
    list.sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
    if (keyword) {
      var kw = keyword.toLowerCase();
      list = list.filter(function (t) { return ((t.supplierOrCustomer || '').trim()).toLowerCase().indexOf(kw) !== -1; });
    }
    return list;
  }

  function markTransactionPaid(txId) {
    var tx = state.transactions.find(function (t) { return t.id === txId; });
    if (!tx || tx.type !== 'out') return false;
    tx.paymentStatus = 'paid';
    bumpDataVersion();
    persistState();
    return true;
  }

  function renderDebtList() {
    var keyword = (getEl('debt-keyword') && getEl('debt-keyword').value) || '';
    var list = getUnpaidOutTransactions(keyword.trim());
    var tbody = getEl('debt-tbody');
    var cardList = getEl('debt-card-list');
    var summaryEl = getEl('debt-summary');
    var totalDebt = 0;
    list.forEach(function (t) {
      totalDebt += (t.quantity || 0) * (t.salePrice != null ? t.salePrice : 0);
    });

    if (tbody) {
      if (list.length === 0) {
        tbody.innerHTML = renderTableEmptyRow(9, '暂无欠款记录（或已按客户筛选无结果）');
      } else {
        tbody.innerHTML = list.map(function (t) {
          var customer = (t.supplierOrCustomer || '').trim() || '（未填客户）';
          var timeStr = t.time ? new Date(t.time).toLocaleString('zh-CN') : '-';
          var partCode = t.partCode || '-';
          var product = getProductById(t.productId);
          var batch = getBatchById(t.batchId);
          var brand = (product && product.brand) ? product.brand : '-';
          var supplier = (batch && batch.supplier) ? batch.supplier : '-';
          var partName = getPartName(t.productId) || '-';
          var qty = t.quantity || 0;
          var unit = t.unit ? normalizeUnit(t.unit) : (product && product.unit) ? normalizeUnit(product.unit) : DEFAULT_UNIT;
          var amount = qty * (t.salePrice != null ? t.salePrice : 0);
          return '<tr data-tx-id="' + escapeHtml(t.id) + '">' +
            '<td>' + escapeHtml(partCode) + '</td>' +
            '<td>' + escapeHtml(brand) + '</td>' +
            '<td>' + escapeHtml(supplier) + '</td>' +
            '<td>' + escapeHtml(partName) + '</td>' +
            '<td>' + qty + ' ' + escapeHtml(unit) + '</td>' +
            '<td class="cell-amount">' + formatKip(amount) + '</td>' +
            '<td>' + escapeHtml(customer) + '</td>' +
            '<td>' + timeStr + '</td>' +
            '<td><button type="button" class="btn btn-sm btn-outline btn-mark-paid" data-tx-id="' + escapeHtml(t.id) + '">标记已收款</button></td></tr>';
        }).join('');
      }
    }

    if (cardList) {
      if (list.length === 0) {
        cardList.innerHTML = '<li class="debt-card-empty">暂无欠款记录（或已按客户筛选无结果）</li>';
      } else {
        cardList.innerHTML = list.map(function (t) {
          var customer = (t.supplierOrCustomer || '').trim() || '（未填客户）';
          var timeStr = t.time ? new Date(t.time).toLocaleString('zh-CN') : '-';
          var partCode = t.partCode || '-';
          var product = getProductById(t.productId);
          var batch = getBatchById(t.batchId);
          var brand = (product && product.brand) ? product.brand : '-';
          var supplier = (batch && batch.supplier) ? batch.supplier : '-';
          var partName = getPartName(t.productId) || '-';
          var qty = t.quantity || 0;
          var unit = t.unit ? normalizeUnit(t.unit) : (product && product.unit) ? normalizeUnit(product.unit) : DEFAULT_UNIT;
          var amount = qty * (t.salePrice != null ? t.salePrice : 0);
          return '<li class="debt-card" data-tx-id="' + escapeHtml(t.id) + '">' +
            '<div class="debt-card-head">' +
              '<span class="debt-card-customer">' + escapeHtml(partCode) + ' ' + escapeHtml(partName) + '</span>' +
              '<span class="debt-card-amount">' + formatKip(amount) + ' KIP</span>' +
            '</div>' +
            '<div class="debt-card-row">' + escapeHtml(brand) + ' · ' + escapeHtml(supplier) + ' · ' + qty + ' ' + escapeHtml(unit) + ' · ' + escapeHtml(customer) + '</div>' +
            '<div class="debt-card-row debt-card-meta">' + timeStr + '</div>' +
            '<div class="debt-card-actions">' +
              '<button type="button" class="btn btn-sm btn-primary btn-mark-paid" data-tx-id="' + escapeHtml(t.id) + '">标记已收款</button>' +
            '</div>' +
          '</li>';
        }).join('');
      }
    }

    if (summaryEl) summaryEl.textContent = '共 ' + list.length + ' 笔欠款，应收合计：' + formatKip(totalDebt) + ' KIP';
  }

  on(getEl('btn-debt-search'), 'click', function () {
    renderDebtList();
  });
  on(getEl('btn-debt-reset'), 'click', function () {
    var el = getEl('debt-keyword');
    if (el) el.value = '';
    renderDebtList();
  });
  on(getEl('debt-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderDebtList();
  });
  function handleMarkPaidClick(e) {
    var btn = e.target.closest('.btn-mark-paid');
    if (!btn) return;
    var txId = btn.getAttribute('data-tx-id');
    if (!txId) return;
    if (!confirm('确定将该笔出库标记为「已收款」？')) return;
    if (markTransactionPaid(txId)) {
      renderDebtList();
      renderPaymentsList();
      if (state.lastRenderedVersion && state.lastRenderedVersion.customerStats !== undefined) state.lastRenderedVersion.customerStats = null;
      renderCustomerStats();
      showSettingsHint('已标记为已收款', true);
    }
  }
  on(getEl('debt-tbody'), 'click', handleMarkPaidClick);
  on(getEl('debt-card-list'), 'click', handleMarkPaidClick);

  function renderPaymentsList() {
    var tbody = getEl('payments-tbody');
    var cardList = getEl('payments-card-list');
    var list = (state.payments || []).slice().sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });

    if (tbody) {
      tbody.innerHTML = list.length === 0 ? renderTableEmptyRow(4, '暂无收款记录') : list.map(function (p) {
        var timeStr = p.time ? new Date(p.time).toLocaleString('zh-CN') : '-';
        return '<tr><td>' + timeStr + '</td><td>' + escapeHtml(p.customerName || '-') + '</td><td class="cell-amount">' + formatKip(p.amount || 0) + '</td><td>' + (p.txIds && p.txIds.length ? p.txIds.length : 0) + '</td></tr>';
      }).join('');
    }

    if (cardList) {
      if (list.length === 0) {
        cardList.innerHTML = '<li class="payments-card-empty">暂无收款记录</li>';
      } else {
        cardList.innerHTML = list.map(function (p) {
          var timeStr = p.time ? new Date(p.time).toLocaleString('zh-CN') : '-';
          return '<li class="payments-card">' +
            '<div class="payments-card-head">' +
              '<span class="payments-card-customer">' + escapeHtml(p.customerName || '-') + '</span>' +
              '<span class="payments-card-amount">' + formatKip(p.amount || 0) + ' KIP</span>' +
            '</div>' +
            '<div class="payments-card-row">' + timeStr + '</div>' +
            '<div class="payments-card-row payments-card-meta">核销 ' + (p.txIds && p.txIds.length ? p.txIds.length : 0) + ' 笔</div>' +
          '</li>';
        }).join('');
      }
    }
  }

  function openPaymentModal() {
    var custInput = getEl('payment-customer');
    var amountInput = getEl('payment-amount');
    var listEl = getEl('payment-customer-list');
    if (custInput) custInput.value = '';
    if (amountInput) amountInput.value = '';
    var names = [];
    state.transactions.filter(function (t) { return t.type === 'out' && (t.paymentStatus === 'booked' || !t.paymentStatus) && (t.supplierOrCustomer || '').trim(); }).forEach(function (t) {
      var n = t.supplierOrCustomer.trim();
      if (names.indexOf(n) === -1) names.push(n);
    });
    if (listEl) listEl.innerHTML = names.map(function (n) { return '<option value="' + escapeHtml(n) + '">'; }).join('');
    getEl('payment-tx-tbody').innerHTML = renderTableEmptyRow(5, '请先输入客户名称并回车/失焦后加载欠款明细');
    getEl('payment-unpaid-hint').textContent = '';
    getEl('payment-select-all').checked = false;
    openModal(getEl('payment-modal'));
    if (custInput) custInput.focus();
  }

  function loadPaymentModalUnpaid(customerName) {
    var name = (customerName || '').trim();
    if (!name) {
      getEl('payment-tx-tbody').innerHTML = renderTableEmptyRow(5, '请先输入客户名称');
      getEl('payment-unpaid-hint').textContent = '';
      return;
    }
    var list = getUnpaidOutTransactions(name);
    var hintEl = getEl('payment-unpaid-hint');
    var tbody = getEl('payment-tx-tbody');
    if (list.length === 0) {
      tbody.innerHTML = renderTableEmptyRow(5, '该客户暂无欠款');
      if (hintEl) hintEl.textContent = '该客户暂无未收款出库。';
      return;
    }
    if (hintEl) hintEl.textContent = '勾选要核销的出库单，填写本次收款金额后点击「确认收款」。';
    tbody.innerHTML = list.map(function (t) {
      var timeStr = t.time ? new Date(t.time).toLocaleString('zh-CN') : '-';
      var partLabel = (t.partCode || '') + ' ' + (getPartName(t.productId) || '');
      var amount = (t.quantity || 0) * (t.salePrice != null ? t.salePrice : 0);
      return '<tr><td><input type="checkbox" class="payment-tx-cb" data-tx-id="' + escapeHtml(t.id) + '"></td><td>' + timeStr + '</td><td>' + escapeHtml(partLabel) + '</td><td>' + (t.quantity || 0) + '</td><td class="cell-amount">' + formatKip(amount) + '</td></tr>';
    }).join('');
  }

  on(getEl('btn-payment-register'), 'click', openPaymentModal);
  on(getEl('payment-customer'), 'change', function () { loadPaymentModalUnpaid(this.value); });
  on(getEl('payment-customer'), 'blur', function () { loadPaymentModalUnpaid(this.value); });
  on(getEl('payment-select-all'), 'change', function () {
    document.querySelectorAll('.payment-tx-cb').forEach(function (cb) { cb.checked = this.checked; }.bind(this));
  });
  on(getEl('payment-modal-form'), 'submit', function (e) {
    e.preventDefault();
    var customerName = (getEl('payment-customer').value || '').trim();
    var amount = parseFloat((getEl('payment-amount').value || '').replace(/,/g, ''), 10);
    if (!customerName) { showSettingsHint('请填写客户', false); return; }
    if (isNaN(amount) || amount <= 0) { showSettingsHint('请填写有效收款金额', false); return; }
    var checked = [];
    document.querySelectorAll('.payment-tx-cb:checked').forEach(function (cb) {
      var txId = cb.getAttribute('data-tx-id');
      if (txId) checked.push(txId);
    });
    if (checked.length === 0) { showSettingsHint('请勾选要核销的出库单', false); return; }
    checked.forEach(function (txId) { markTransactionPaid(txId); });
    state.payments = state.payments || [];
    state.payments.push({
      id: id(),
      customerName: customerName,
      amount: amount,
      time: now(),
      txIds: checked,
    });
    bumpDataVersion();
    persistState();
    closeModal(getEl('payment-modal'));
    renderDebtList();
    renderPaymentsList();
    if (state.lastRenderedVersion) state.lastRenderedVersion.customerStats = null;
    renderCustomerStats();
    showSettingsHint('收款已登记，已核销 ' + checked.length + ' 笔', true);
  });
  on(getEl('payment-modal-cancel'), 'click', function () { closeModal(getEl('payment-modal')); });
  on(getEl('payment-modal') && getEl('payment-modal').querySelector('.modal-overlay'), 'click', function () { closeModal(getEl('payment-modal')); });

  function renderSettings() {
    const listModels = getEl('list-models');
    if (listModels) {
      listModels.innerHTML = state.models
        .map(
          (m) =>
            '<li><span>' +
            escapeHtml(m.name) +
            '</span><button type="button" class="btn-delete" data-id="' +
            m.id +
            '" data-type="model">删除</button></li>'
        )
        .join('');
    }

    const listMain = getEl('list-mainTypes');
    if (listMain) {
      listMain.innerHTML = state.mainTypes
        .map(
          (t) =>
            '<li><span>' +
            escapeHtml(t.name) +
            '</span><button type="button" class="btn-delete" data-id="' +
            t.id +
            '" data-type="mainType">删除</button></li>'
        )
        .join('');
    }

    const parentSel = getEl('sub-parent');
    if (parentSel) {
      fillSelect(parentSel, state.mainTypes, 'id', 'name');
      refreshSubTypeList();
    }
  }

  function refreshSubTypeList() {
    var parentSel = getEl('sub-parent');
    if (!parentSel) return;
    var mainId = parentSel.value;
    var subs = state.subTypes.filter(function (s) { return s.mainTypeId === mainId; });
    var listSub = getEl('list-subTypes');
    if (listSub) {
      listSub.innerHTML = subs.map(function (s) {
        return '<li><span>' + escapeHtml(s.name) + '</span><button type="button" class="btn-delete" data-id="' + s.id + '" data-type="subType">删除</button></li>';
      }).join('');
    }
  }

  function confirmDeleteCategory(type, name) {
    return confirm('确定要删除分类「' + name + '」吗？删除后相关配件的该分类将显示为空。');
  }

  on(getEl('add-model'), 'click', function () {
    const input = getEl('new-model');
    const name = (input.value || '').trim();
    if (!name) return;
    state.models.push({ id: id(), name });
    bumpDataVersion();
    persistState();
    input.value = '';
    fillInFormSelects();
    fillFilterSelects();
    fillRecordsFilters();
    renderSettings();
  });

  on(getEl('add-mainType'), 'click', function () {
    const input = getEl('new-mainType');
    const name = (input.value || '').trim();
    if (!name) return;
    state.mainTypes.push({ id: id(), name });
    bumpDataVersion();
    persistState();
    input.value = '';
    fillInFormSelects();
    fillFilterSelects();
    renderSettings();
  });

  on(getEl('add-subType'), 'click', function () {
    const parentId = getEl('sub-parent').value;
    const input = getEl('new-subType');
    const name = (input.value || '').trim();
    if (!name || !parentId) return;
    state.subTypes.push({ id: id(), mainTypeId: parentId, name });
    bumpDataVersion();
    persistState();
    input.value = '';
    fillInFormSelects();
    renderSettings();
  });

  on(getEl('sub-parent'), 'change', refreshSubTypeList);

  on(getEl('list-models'), 'click', function (e) {
    const btn = e.target.closest('.btn-delete[data-type="model"]');
    if (!btn) return;
    const mid = btn.dataset.id;
    const m = state.models.find((x) => x.id === mid);
    if (!m || !confirmDeleteCategory('model', m.name)) return;
    state.models = state.models.filter((x) => x.id !== mid);
    bumpDataVersion();
    persistState();
    fillInFormSelects();
    fillFilterSelects();
    fillRecordsFilters();
    renderSettings();
  });

  on(getEl('list-mainTypes'), 'click', function (e) {
    const btn = e.target.closest('.btn-delete[data-type="mainType"]');
    if (!btn) return;
    const tid = btn.dataset.id;
    const t = state.mainTypes.find((x) => x.id === tid);
    if (!t || !confirmDeleteCategory('mainType', t.name)) return;
    state.mainTypes = state.mainTypes.filter((x) => x.id !== tid);
    state.subTypes = state.subTypes.filter((s) => s.mainTypeId !== tid);
    bumpDataVersion();
    persistState();
    fillInFormSelects();
    fillFilterSelects();
    renderSettings();
  });

  on(getEl('list-subTypes'), 'click', function (e) {
    const btn = e.target.closest('.btn-delete[data-type="subType"]');
    if (!btn) return;
    const sid = btn.dataset.id;
    const s = state.subTypes.find((x) => x.id === sid);
    if (!s || !confirmDeleteCategory('subType', s.name)) return;
    state.subTypes = state.subTypes.filter((x) => x.id !== sid);
    bumpDataVersion();
    persistState();
    fillInFormSelects();
    renderSettings();
  });

  function exportJson() {
    var data = {
      exportTime: now(),
      products: state.products,
      batches: state.batches,
      transactions: state.transactions,
      payments: state.payments || [],
      models: state.models,
      mainTypes: state.mainTypes,
      subTypes: state.subTypes,
      suppliers: state.suppliers,
      customers: state.customers,
      favoriteCustomerIds: state.favoriteCustomerIds || [],
      settings: state.settings,
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aw_part_stock_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    state.unsavedToJsonFile = false;
    updateUnsavedBanner();
    showSettingsHint('已导出 JSON', true);
  }

  on(getEl('btn-export'), 'click', exportJson);

  on(getEl('file-import'), 'change', function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const data = JSON.parse(reader.result);
        var merge = confirm('是否合并到当前数据？取消则覆盖全部。');
        if (merge) {
          var existingIds = {
            products: new Set(state.products.map(function (p) { return p.id; })),
            batches: new Set(state.batches.map(function (b) { return b.id; })),
            models: new Set(state.models.map(function (m) { return m.id; })),
            mainTypes: new Set(state.mainTypes.map(function (t) { return t.id; })),
            subTypes: new Set(state.subTypes.map(function (s) { return s.id; })),
            suppliers: new Set(state.suppliers.map(function (s) { return s.id; })),
            customers: new Set(state.customers.map(function (c) { return c.id; })),
          };
          if (Array.isArray(data.products)) {
            data.products.forEach(function (p) {
              if (!existingIds.products.has(p.id)) {
                state.products.push(p);
                existingIds.products.add(p.id);
              } else {
                var idx = state.products.findIndex(function (x) { return x.id === p.id; });
                if (idx >= 0) state.products[idx] = Object.assign({}, state.products[idx], p, { id: state.products[idx].id });
              }
            });
          }
          if (Array.isArray(data.batches)) {
            data.batches.forEach(function (b) {
              if (!existingIds.batches.has(b.id)) {
                state.batches.push(b);
                existingIds.batches.add(b.id);
              } else {
                var idx = state.batches.findIndex(function (x) { return x.id === b.id; });
                if (idx >= 0) state.batches[idx] = Object.assign({}, state.batches[idx], b, { id: state.batches[idx].id });
              }
            });
          }
          if (Array.isArray(data.transactions)) {
            state.transactions = state.transactions.concat(data.transactions);
          }
          if (Array.isArray(data.models)) {
            data.models.forEach((m) => {
              if (!existingIds.models.has(m.id)) {
                state.models.push(m);
                existingIds.models.add(m.id);
              }
            });
          }
          if (Array.isArray(data.mainTypes)) {
            data.mainTypes.forEach((t) => {
              if (!existingIds.mainTypes.has(t.id)) {
                state.mainTypes.push(t);
                existingIds.mainTypes.add(t.id);
              }
            });
          }
          if (Array.isArray(data.subTypes)) {
            data.subTypes.forEach((s) => {
              if (!existingIds.subTypes.has(s.id)) {
                state.subTypes.push(s);
                existingIds.subTypes.add(s.id);
              }
            });
          }
          if (data.settings && typeof data.settings === 'object') {
            state.settings = { ...state.settings, ...data.settings };
          }
          if (Array.isArray(data.payments)) state.payments = state.payments.concat(data.payments);
          if (Array.isArray(data.favoriteCustomerIds)) state.favoriteCustomerIds = Array.from(new Set((state.favoriteCustomerIds || []).concat(data.favoriteCustomerIds)));
          if (Array.isArray(data.suppliers)) {
            data.suppliers.forEach(function (s) {
              if (!existingIds.suppliers.has(s.id)) { state.suppliers.push(s); existingIds.suppliers.add(s.id); }
            });
          }
          if (Array.isArray(data.customers)) {
            data.customers.forEach(function (c) {
              if (!existingIds.customers.has(c.id)) { state.customers.push(c); existingIds.customers.add(c.id); }
            });
          }
        } else {
          if (Array.isArray(data.products)) state.products = data.products; else state.products = [];
          if (Array.isArray(data.batches)) state.batches = data.batches; else state.batches = [];
          if (Array.isArray(data.transactions)) state.transactions = data.transactions; else state.transactions = [];
          if (Array.isArray(data.models)) state.models = data.models; else state.models = [];
          if (Array.isArray(data.mainTypes)) state.mainTypes = data.mainTypes; else state.mainTypes = [];
          if (Array.isArray(data.subTypes)) state.subTypes = data.subTypes; else state.subTypes = [];
          if (Array.isArray(data.suppliers)) state.suppliers = data.suppliers; else state.suppliers = [];
          if (Array.isArray(data.customers)) state.customers = data.customers; else state.customers = [];
          state.payments = Array.isArray(data.payments) ? data.payments : [];
          state.favoriteCustomerIds = Array.isArray(data.favoriteCustomerIds) ? data.favoriteCustomerIds : [];
          if (data.settings && typeof data.settings === 'object') state.settings = data.settings;
          if (state.products.length === 0 && state.batches.length === 0 && Array.isArray(data.parts) && data.parts.length > 0) {
            state.parts = data.parts;
            migratePartsToProductsBatches();
          }
        }
        state.products.forEach(function (p) { p.unit = normalizeUnit(p.unit); });
        state.transactions.forEach(function (t) {
          if (!t.unit) { var p = getProductById(t.productId); t.unit = (p && p.unit) ? p.unit : DEFAULT_UNIT; }
        });
        recalcBatchQuantitiesFromTransactions();
        bumpDataVersion();
        persistState();
        fillInFormSelects();
        fillFilterSelects();
        fillOutPartSelect();
        fillRecordsFilters();
        fillSupplierSelect();
        fillCustomerSelect();
        renderStock();
        renderSettings();
        renderRecords();
        renderContacts();
        updateRecordsStats();
        showSettingsHint('导入成功', true);
      } catch (err) {
        showSettingsHint('导入失败：' + (err.message || '无效 JSON'), false);
      }
      getEl('file-import').value = '';
    };
    reader.readAsText(file, 'UTF-8');
  });

  loadState();
  state.unsavedToJsonFile = false;
  updateUnsavedBanner();

  (function startAutoBackup() {
    var BACKUP_KEY = 'aw_auto_backup';
    var BACKUP_TIME_KEY = 'aw_auto_backup_time';
    var INTERVAL_MS = 5 * 60 * 1000;
    function doAutoBackup() {
      try {
        var data = {
          exportTime: now(),
          products: state.products,
          batches: state.batches,
          transactions: state.transactions,
          payments: state.payments || [],
          models: state.models,
          mainTypes: state.mainTypes,
          subTypes: state.subTypes,
          suppliers: state.suppliers,
          customers: state.customers,
          favoriteCustomerIds: state.favoriteCustomerIds || [],
          settings: state.settings,
        };
        localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
        localStorage.setItem(BACKUP_TIME_KEY, new Date().toISOString());
      } catch (e) {}
    }
    setInterval(doAutoBackup, INTERVAL_MS);
    doAutoBackup();
  })();

  function flushPersistState() {
    if (persistStateTimer) {
      clearTimeout(persistStateTimer);
      persistStateTimer = null;
      persistStateImmediate(true);
    }
  }
  function onBeforeUnload(e) {
    flushPersistState();
    if (state.unsavedToJsonFile) {
      e.preventDefault();
      e.returnValue = '您有未保存的修改，请先导出 JSON 后再关闭。';
      return e.returnValue;
    }
  }
  window.addEventListener('beforeunload', onBeforeUnload);
  window.onbeforeunload = onBeforeUnload;

  showPanel('dashboard');
})();
