(function () {
  'use strict';

  // ========== 工具函数（弹窗、提示、格式化、安全输出） ==========
  function on(el, ev, fn) {
    if (el) el.addEventListener(ev, fn);
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
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

  // ========== 状态与存储（localStorage 键、默认分类、state） ==========
  const STORAGE_KEYS = {
    parts: 'aw_part_stock_parts',
    products: 'aw_products',
    batches: 'aw_batches',
    transactions: 'aw_part_stock_transactions',
    models: 'aw_part_models',
    mainTypes: 'aw_part_mainTypes',
    subTypes: 'aw_part_subTypes',
    settings: 'aw_part_settings',
    suppliers: 'aw_part_suppliers',
    customers: 'aw_part_customers',
  };
  const QUALITY_GRADES = ['正常', '好', '差'];

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
    models: [],
    mainTypes: [],
    subTypes: [],
    suppliers: [],
    customers: [],
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
        unit: part.unit || 'KIP',
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
    var el = document.getElementById('unsaved-banner');
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

  // ========== 业务工具（金额格式化、产品/批次查询、分类名） ==========
  /** 价格统一以 KIP 三位小数显示，如 100.000 */
  function formatKip(num) {
    if (num == null || num === '' || (typeof num === 'number' && isNaN(num))) return '';
    var n = Number(num);
    if (isNaN(n)) return '';
    return n.toFixed(3);
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
  function partByCode(code) {
    return productByCode(code);
  }

  function addProductIfNeeded(record) {
    var existing = productByCode(record.code);
    if (existing) {
      if (record.salePrice != null && record.salePrice !== '') existing.salePrice = parseFloat(record.salePrice);
      if (record.imageUrl != null) existing.imageUrl = String(record.imageUrl).trim() || undefined;
      existing.updatedAt = now();
      return existing;
    }
    var time = now();
    var product = {
      id: id(),
      code: (record.code || '').trim(),
      name: (record.name || '').trim(),
      brand: (record.brand || '').trim(),
      modelId: record.modelId || '',
      mainTypeId: record.mainTypeId || '',
      subTypeId: record.subTypeId || '',
      unit: (record.unit || 'KIP').trim() || 'KIP',
      salePrice: record.salePrice != null && record.salePrice !== '' ? parseFloat(record.salePrice) : undefined,
      imageUrl: (record.imageUrl != null && String(record.imageUrl).trim()) ? String(record.imageUrl).trim() : undefined,
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
    state.transactions.push({
      id: id(),
      batchId: batch.id,
      productId: batch.productId,
      partCode: batch.partCode,
      type: 'out',
      quantity: qty,
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
      state.transactions.push({
        id: id(),
        batchId: batch.id,
        productId: productId,
        partCode: product.code || batch.partCode,
        type: 'out',
        quantity: deduct,
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

  function fillSelect(sel, options, valueKey, labelKey) {
    if (!sel) return;
    const val = sel.value;
    const html = options.map((o) => '<option value="' + (String(o[valueKey] ?? '').replace(/"/g, '&quot;')) + '">' + (String(o[labelKey] ?? '').replace(/</g, '&lt;')) + '</option>').join('');
    sel.innerHTML = html;
    if (val && options.some((o) => String(o[valueKey] ?? '') === val)) sel.value = val;
  }

  function showPanel(panelId) {
    document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    var panel = document.getElementById('panel-' + panelId);
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
      else if (panelId === 'out') { fillOutPartSelect(); fillCustomerSelect(); var qEl = document.getElementById('out-qty'); if (qEl) qEl.value = '1'; updateOutStockDisplay(); updateOutPreview(); }
      else if (panelId === 'stock') {
        fillFilterSelects();
        if (last.stock !== v) { renderStock(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.stock = v; }
      } else if (panelId === 'records') {
        fillRecordsFilters();
        if (last.records !== v) { renderRecords(); updateRecordsStats(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.records = v; }
      } else if (panelId === 'customerStats') {
        if (last.customerStats !== v) { renderCustomerStats(); state.lastRenderedVersion = state.lastRenderedVersion || {}; state.lastRenderedVersion.customerStats = v; }
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

  function renderDashboard() {
    var threshold = state.settings.lowStockThreshold || 5;
    var totalSku = state.products.length;
    var totalQty = 0;
    var totalAmount = 0;
    var lowCount = 0;
    state.batches.forEach(function (b) {
      var q = b.quantity || 0;
      totalQty += q;
      totalAmount += q * (b.costPrice || 0);
      if (q < threshold) lowCount++;
    });
    var cardsEl = document.getElementById('dashboard-cards');
    if (cardsEl) {
      cardsEl.innerHTML =
        '<div class="dashboard-card"><span class="dashboard-card-label">总 SKU</span><div class="dashboard-card-value">' + totalSku + '</div></div>' +
        '<div class="dashboard-card"><span class="dashboard-card-label">总库存数量</span><div class="dashboard-card-value">' + totalQty.toLocaleString() + '</div></div>' +
        '<div class="dashboard-card amount"><span class="dashboard-card-label">库存总金额(KIP)</span><div class="dashboard-card-value">' + (totalAmount ? formatKip(totalAmount) : '0.000') + '</div></div>' +
        '<div class="dashboard-card danger"><span class="dashboard-card-label">低库存数量</span><div class="dashboard-card-value">' + lowCount + '</div></div>';
    }
    var thresholdEl = document.getElementById('dashboard-threshold-value');
    if (thresholdEl) thresholdEl.textContent = String(threshold);
    var lowList = state.batches.filter(function (b) { return (b.quantity || 0) < threshold; })
      .sort(function (a, b) { return (a.quantity || 0) - (b.quantity || 0); }).slice(0, 5);
    var lowTbody = document.getElementById('dashboard-low-tbody');
    if (lowTbody) {
      lowTbody.innerHTML = lowList.map(function (b) {
        var status = (b.quantity || 0) === 0 ? '缺货' : '低库存';
        return '<tr class="row-low"><td>' + (b.partCode || '-') + '</td><td>' + escapeHtml(b.partName || '-') + (b.supplier ? ' · ' + escapeHtml(b.supplier) : '') + '</td><td class="cell-num-danger">' + (b.quantity ?? 0) + '</td><td>' + status + '</td></tr>';
      }).join('');
    }
    var lowMore = document.getElementById('dashboard-low-more');
    if (lowMore) lowMore.textContent = lowList.length === 0 ? '暂无低库存' : (state.batches.filter(function (b) { return (b.quantity || 0) < threshold; }).length > 5 ? '仅显示前5条，请到库存管理查看全部' : '');
    var outList = state.transactions.filter(function (t) { return t.type === 'out'; }).slice(-5).reverse();
    var outTbody = document.getElementById('dashboard-out-tbody');
    if (outTbody) {
      outTbody.innerHTML = outList.map(function (t) {
        var name = getPartName(t.productId || t.batchId);
        var customer = (t.supplierOrCustomer || '').trim();
        if (!customer) customer = '未填客户';
        return '<tr><td>' + formatTimeShort(t.time) + '</td><td>' + (t.partCode || '') + ' ' + escapeHtml(name) + '</td><td>' + (t.quantity ?? 0) + '</td><td>' + escapeHtml(customer) + '</td></tr>';
      }).join('');
    }
  }

  function getProfitDateRange() {
    var fromEl = document.getElementById('profit-dateFrom');
    var toEl = document.getElementById('profit-dateTo');
    var from = (fromEl && fromEl.value) || '';
    var to = (toEl && toEl.value) || '';
    if (!from || !to) return null;
    return { from: from, to: to };
  }

  function setProfitDateRange(from, to) {
    var fromEl = document.getElementById('profit-dateFrom');
    var toEl = document.getElementById('profit-dateTo');
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

    var hintEl = document.getElementById('profit-range-hint');
    if (hintEl) hintEl.textContent = '统计范围：' + range.from + ' 至 ' + range.to + '，共 ' + stats.count + ' 笔出库';

    var cardsEl = document.getElementById('profit-cards');
    if (cardsEl) {
      cardsEl.innerHTML =
        '<div class="dashboard-card"><span class="dashboard-card-label">销售额(KIP)</span><div class="dashboard-card-value amount">' + formatKip(stats.sales) + '</div></div>' +
        '<div class="dashboard-card"><span class="dashboard-card-label">总成本(KIP)</span><div class="dashboard-card-value">' + formatKip(stats.cost) + '</div></div>' +
        '<div class="dashboard-card"><span class="dashboard-card-label">毛利润(KIP)</span><div class="dashboard-card-value ' + (stats.profit >= 0 ? 'amount' : 'danger') + '">' + formatKip(stats.profit) + '</div></div>' +
        '<div class="dashboard-card"><span class="dashboard-card-label">出库笔数</span><div class="dashboard-card-value">' + stats.count.toLocaleString() + '</div></div>' +
        '<div class="dashboard-card"><span class="dashboard-card-label">出库总数量</span><div class="dashboard-card-value">' + stats.qty.toLocaleString() + '</div></div>';
    }

    var tbody = document.getElementById('profit-daily-tbody');
    if (tbody) {
      if (daily.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">该时间段内无出库记录</td></tr>';
      } else {
        tbody.innerHTML = daily.map(function (row) {
          return '<tr><td>' + row.date + '</td><td>' + row.count + '</td><td>' + row.qty.toLocaleString() + '</td><td class="cell-amount">' + formatKip(row.sales) + '</td><td class="cell-amount">' + formatKip(row.cost) + '</td><td class="cell-amount ' + (row.profit >= 0 ? 'amount' : 'danger') + '">' + formatKip(row.profit) + '</td></tr>';
        }).join('');
      }
    }
  }

  on(document.getElementById('profit-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderProfit();
  });
  document.querySelectorAll('.profit-quick').forEach(function (btn) {
    btn.addEventListener('click', function () {
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
      var range = this.getAttribute('data-range');
      if (range === 'today') setProfitDateRange(today, today);
      else if (range === 'week') setProfitDateRange(ws, today);
      else if (range === 'month') setProfitDateRange(monthStart, today);
      renderProfit();
    });
  });

  on(document.getElementById('sidebar-toggle'), 'click', function (e) {
    e.preventDefault();
    toggleSidebar();
  });
  on(document.getElementById('sidebar-overlay'), 'click', closeSidebar);

  on(document.getElementById('content'), 'click', function (e) {
    var goto = e.target.closest('.dashboard-goto-stock');
    if (goto && goto.getAttribute('data-panel')) {
      e.preventDefault();
      showPanel(goto.getAttribute('data-panel'));
      closeSidebar();
    }
  });

  on(document.querySelector('.sidebar-nav'), 'click', function (e) {
    var item = e.target.closest('.nav-item');
    if (!item) return;
    e.preventDefault();
    var panelId = item.getAttribute('data-panel');
    if (panelId) {
      showPanel(panelId);
      closeSidebar();
    }
  });

  document.querySelectorAll('.collapsible').forEach((card) => {
    const head = card.querySelector('.collapsible-head');
    if (head) {
      head.addEventListener('click', function () {
        card.classList.toggle('open');
      });
    }
  });

  function fillInFormSelects() {
    fillSelect(document.getElementById('in-model'), [{ id: '', name: '请选择车型' }, ...state.models], 'id', 'name');
    fillSelect(document.getElementById('in-mainType'), [{ id: '', name: '请选择主件' }, ...state.mainTypes], 'id', 'name');
    const mainId = document.getElementById('in-mainType').value;
    const subs = state.subTypes.filter((s) => s.mainTypeId === mainId);
    fillSelect(document.getElementById('in-subType'), [{ id: '', name: '请选择子件' }, ...subs], 'id', 'name');
  }

  function fillSupplierSelect() {
    const sel = document.getElementById('in-supplier-select');
    if (!sel) return;
    const opts = [{ id: '', name: '-- 选择或手动输入 --' }, ...state.suppliers.map((s) => ({ id: s.name, name: s.name }))];
    fillSelect(sel, opts, 'id', 'name');
  }

  function fillCustomerSelect() {
    const sel = document.getElementById('out-customer-select');
    if (!sel) return;
    var outTxs = state.transactions.filter(function (t) { return t.type === 'out' && (t.supplierOrCustomer || '').trim(); });
    var lastByCustomer = {};
    outTxs.forEach(function (t) {
      var name = t.supplierOrCustomer.trim();
      if (!lastByCustomer[name] || (t.time || '') > lastByCustomer[name]) lastByCustomer[name] = t.time || '';
    });
    var names = state.customers.map(function (c) { return c.name; });
    var recent5 = Object.keys(lastByCustomer)
      .sort(function (a, b) { return (lastByCustomer[b] || '').localeCompare(lastByCustomer[a] || ''); })
      .slice(0, 5);
    var rest = names.filter(function (n) { return recent5.indexOf(n) === -1; });
    var ordered = recent5.concat(rest);
    var opts = [{ id: '', name: '-- 选择或手动输入 --' }].concat(ordered.map(function (n) { return { id: n, name: n }; }));
    fillSelect(sel, opts, 'id', 'name');
  }

  on(document.getElementById('in-mainType'), 'change', function () {
    const subs = state.subTypes.filter((s) => s.mainTypeId === this.value);
    fillSelect(document.getElementById('in-subType'), [{ id: '', name: '请选择子件' }, ...subs], 'id', 'name');
  });

  var stateInboundMode = 'existing';
  var selectedInPart = null;

  function getInboundMode() {
    var r = document.querySelector('input[name="in-mode"]:checked');
    return (r && r.value) || 'existing';
  }

  function initInboundPanel() {
    stateInboundMode = getInboundMode();
    var existingBlock = document.getElementById('in-existing-block');
    var newBlock = document.getElementById('in-new-block');
    var advancedWrap = document.getElementById('in-advanced-wrap');
    if (stateInboundMode === 'existing') {
      if (existingBlock) existingBlock.style.display = 'block';
      if (newBlock) newBlock.style.display = 'none';
      if (advancedWrap) advancedWrap.style.display = 'none';
      selectedInPart = null;
      document.getElementById('in-selected-part-id').value = '';
      document.getElementById('in-part-search').value = '';
      document.getElementById('in-part-summary').textContent = '';
    } else {
      if (existingBlock) existingBlock.style.display = 'none';
      if (newBlock) newBlock.style.display = 'block';
      if (advancedWrap) advancedWrap.style.display = 'block';
      document.getElementById('in-code').value = '';
      document.getElementById('in-name').value = '';
    }
    document.getElementById('in-qty').value = '';
    document.getElementById('in-costPrice').value = '';
    document.getElementById('in-salePrice').value = '';
    var inQuality = document.getElementById('in-quality');
    if (inQuality) inQuality.value = '正常';
  }

  document.querySelectorAll('input[name="in-mode"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
      stateInboundMode = getInboundMode();
      initInboundPanel();
    });
  });

  function renderInPartDropdown(keyword) {
    var kw = (keyword || '').toLowerCase().trim();
    var list = state.products.filter(function (p) {
      return (p.code || '').toLowerCase().includes(kw) || (p.name || '').toLowerCase().includes(kw);
    }).slice(0, 20);
    var el = document.getElementById('in-part-dropdown');
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

  on(document.getElementById('in-part-search'), 'input', function () {
    renderInPartDropdown(this.value);
  });
  on(document.getElementById('in-part-search'), 'focus', function () {
    if (this.value.trim()) renderInPartDropdown(this.value);
  });
  on(document.getElementById('in-part-dropdown'), 'click', function (e) {
    var item = e.target.closest('.in-part-dropdown-item');
    if (!item) return;
    var id = item.dataset.id;
    var product = state.products.find(function (p) { return p.id === id; });
    if (!product) return;
    selectedInPart = product;
    document.getElementById('in-selected-part-id').value = product.id;
    document.getElementById('in-part-search').value = (product.code || '') + ' ' + (product.name || '');
    document.getElementById('in-part-dropdown').style.display = 'none';
    var summary = document.getElementById('in-part-summary');
    var batchCount = state.batches.filter(function (b) { return b.productId === product.id; }).length;
    summary.innerHTML = '已选：<strong>' + escapeHtml(product.code || '') + ' ' + escapeHtml(product.name || '') + '</strong>' + (batchCount ? ' · 已有 ' + batchCount + ' 个批次' : '');
    document.getElementById('in-salePrice').value = formatKip(product.salePrice);
    var qtyEl = document.getElementById('in-qty');
    if (qtyEl) qtyEl.focus();
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.in-part-search-wrap')) document.getElementById('in-part-dropdown').style.display = 'none';
  });

  (function () {
    var w = document.getElementById('in-advanced-wrap');
    var h = w && w.querySelector('.in-advanced-head');
    if (h) h.addEventListener('click', function () {
      document.getElementById('in-advanced-wrap').classList.toggle('open');
    });
  })();

  function getInSupplierValue() {
    const sel = document.getElementById('in-supplier-select');
    const input = document.getElementById('in-supplier');
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

  on(document.getElementById('in-imageFile'), 'change', function () {
    var file = this.files && this.files[0];
    var preview = document.getElementById('in-imagePreview');
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

  on(document.getElementById('form-in'), 'submit', function (e) {
    e.preventDefault();
    var mode = getInboundMode();
    var qty = (document.getElementById('in-qty').value || '').trim();
    var costPrice = (document.getElementById('in-costPrice') && document.getElementById('in-costPrice').value);
    var salePrice = (document.getElementById('in-salePrice') && document.getElementById('in-salePrice').value);
    var supplier = getInSupplierValue();
    var operator = ((document.getElementById('in-operator') && document.getElementById('in-operator').value) || '').trim() || state.settings.defaultOperator;

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

    var qualityGrade = ((document.getElementById('in-quality') && document.getElementById('in-quality').value) || '').trim();

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
        unit: 'KIP',
        supplier: supplier,
        qualityGrade: qualityGrade,
        costPrice: costPrice,
        salePrice: salePrice || undefined,
        operator: operator,
      });
      this.reset();
      document.getElementById('in-operator').value = state.settings.defaultOperator;
      document.getElementById('in-quality').value = '正常';
      selectedInPart = null;
      document.getElementById('in-selected-part-id').value = '';
      document.getElementById('in-part-search').value = '';
      document.getElementById('in-part-summary').innerHTML = '';
      fillSupplierSelect();
      showSettingsHint('入库成功', true);
      return;
    }

    var code = ((document.getElementById('in-code') && document.getElementById('in-code').value) || '').trim();
    var name = ((document.getElementById('in-name') && document.getElementById('in-name').value) || '').trim();
    if (!code || !name) {
      showSettingsHint('请填写配件编码和名称', false);
      return;
    }
    var existing = productByCode(code);
    if (existing) {
      if (!confirm('该编码已存在（' + (existing.name || '') + '），是否改为现有产品入库？')) return;
      addBatch({
        code: existing.code,
        name: existing.name,
        brand: existing.brand || '',
        modelId: existing.modelId || '',
        mainTypeId: existing.mainTypeId || '',
        subTypeId: existing.subTypeId || '',
        quantity: qty,
        unit: 'KIP',
        supplier: supplier,
        qualityGrade: qualityGrade,
        costPrice: costPrice,
        salePrice: salePrice || undefined,
        operator: operator,
      });
    } else {
      if (!confirm('编码不存在，是否新建产品并入库？')) return;
      addBatch({
        code: code,
        name: name,
        brand: ((document.getElementById('in-brand') && document.getElementById('in-brand').value) || '').trim(),
        modelId: (document.getElementById('in-model') && document.getElementById('in-model').value) || '',
        mainTypeId: (document.getElementById('in-mainType') && document.getElementById('in-mainType').value) || '',
        subTypeId: (document.getElementById('in-subType') && document.getElementById('in-subType').value) || '',
        quantity: qty,
        unit: 'KIP',
        supplier: supplier,
        qualityGrade: qualityGrade,
        costPrice: costPrice,
        salePrice: salePrice || undefined,
        imageUrl: pendingInboundImage || undefined,
        operator: operator,
      });
    }
    this.reset();
    document.getElementById('in-operator').value = state.settings.defaultOperator;
    document.getElementById('in-quality').value = '正常';
    pendingInboundImage = '';
    var preview = document.getElementById('in-imagePreview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    var fileInput = document.getElementById('in-imageFile');
    if (fileInput) fileInput.value = '';
    document.getElementById('in-code').value = '';
    document.getElementById('in-name').value = '';
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
    var sel = document.getElementById('out-part');
    var searchKw = ((document.getElementById('out-search') && document.getElementById('out-search').value) || '').toLowerCase().trim();
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
    on(document.getElementById('out-search'), 'input', debouncedFillOutPartSelect);
    on(document.getElementById('out-search'), 'change', fillOutPartSelect);
  })();

  on(document.getElementById('out-part'), 'change', function () {
    updateOutStockDisplay();
    var qEl = document.getElementById('out-qty');
    if (qEl) qEl.focus();
  });
  on(document.getElementById('out-qty'), 'input', function () { updateOutStockDisplay(); updateOutPreview(); });
  on(document.getElementById('out-customer-select'), 'change', updateOutPreview);
  on(document.getElementById('out-customer'), 'input', updateOutPreview);

  function updateOutStockDisplay() {
    var productId = (document.getElementById('out-part') && document.getElementById('out-part').value);
    var totalQty = productId ? getProductTotalQty(productId) : 0;
    var threshold = state.settings.lowStockThreshold || 5;
    var currentEl = document.getElementById('out-stock-current');
    var thresholdEl = document.getElementById('out-stock-threshold');
    var statusEl = document.getElementById('out-stock-status');
    var cardEl = document.getElementById('out-stock-card');
    var warnEl = document.getElementById('out-insufficient-warn');

    if (!productId) {
      if (currentEl) currentEl.textContent = '—';
      if (thresholdEl) thresholdEl.textContent = '最低警戒：— 件';
      if (statusEl) statusEl.textContent = '—';
      if (cardEl) cardEl.classList.remove('out-stock-status-normal', 'out-stock-status-low');
      if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
      updateOutPreview();
      return;
    }
    if (currentEl) currentEl.textContent = totalQty + ' 件';
    if (thresholdEl) thresholdEl.textContent = '最低警戒：' + threshold + ' 件 · 按先进先出';
    if (statusEl) {
      if (totalQty === 0) statusEl.textContent = '缺货';
      else if (totalQty < threshold) statusEl.textContent = '低库存';
      else statusEl.textContent = '正常';
    }
    if (cardEl) {
      cardEl.classList.remove('out-stock-status-normal', 'out-stock-status-low');
      if (totalQty === 0 || totalQty < threshold) cardEl.classList.add('out-stock-status-low');
      else cardEl.classList.add('out-stock-status-normal');
    }
    if (warnEl) {
      var qty = parseInt((document.getElementById('out-qty') && document.getElementById('out-qty').value), 10) || 0;
      if (qty > totalQty) {
        warnEl.style.display = 'block';
        warnEl.textContent = '库存不足！当前共 ' + totalQty + ' 件，请减少出库数量。';
      } else {
        warnEl.style.display = 'none';
        warnEl.textContent = '';
      }
    }
    updateOutPreview();
  }

  function updateOutPreview() {
    var bodyEl = document.getElementById('out-preview-body');
    if (!bodyEl) return;
    var productId = (document.getElementById('out-part') && document.getElementById('out-part').value);
    var product = productId ? getProductById(productId) : null;
    var qty = ((document.getElementById('out-qty') && document.getElementById('out-qty').value) || '').trim();
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
    state.contactsSearch = (document.getElementById('contacts-search') && document.getElementById('contacts-search').value) ?? state.contactsSearch;
    var list = getContactsFilteredList();
    var total = list.length;
    var pageSize = state.contactsPageSize;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(state.contactsPage, totalPages);
    state.contactsPage = page;
    var start = (page - 1) * pageSize;
    var rows = list.slice(start, start + pageSize);
    var isSupplier = state.contactsTab === 'suppliers';

    var theadRow = document.getElementById('contacts-thead-row');
    if (theadRow) {
      if (isSupplier) {
        theadRow.innerHTML = '<th data-sort="name">供应商 <span class="sort-icon"></span></th><th data-sort="contact">联系人 <span class="sort-icon"></span></th><th>地址</th><th data-sort="phone">联系电话 <span class="sort-icon"></span></th><th>备注</th><th data-sort="createdAt">创建时间 <span class="sort-icon"></span></th><th>操作</th>';
      } else {
        theadRow.innerHTML = '<th data-sort="name">客户名 <span class="sort-icon"></span></th><th>地址</th><th data-sort="phone">联系电话 <span class="sort-icon"></span></th><th>备注</th><th data-sort="createdAt">创建时间 <span class="sort-icon"></span></th><th>操作</th>';
      }
      theadRow.querySelectorAll('th').forEach(function (th) {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === state.contactsSortKey) th.classList.add(state.contactsSortDir === 1 ? 'sort-asc' : 'sort-desc');
      });
    }

    var tbody = document.getElementById('contacts-tbody');
    if (tbody) {
      if (rows.length === 0) {
        var colCount = isSupplier ? 7 : 6;
        var emptyText = isSupplier ? '暂无供应商信息' : '暂无客户信息';
        tbody.innerHTML = '<tr class="contacts-empty-row"><td colspan="' + colCount + '">' + emptyText + '</td></tr>';
      } else if (isSupplier) {
        tbody.innerHTML = rows.map(function (s) {
          var created = (s.createdAt && new Date(s.createdAt).toLocaleString('zh-CN')) || '-';
          return '<tr><td>' + escapeHtml(s.name || '') + '</td><td>' + escapeHtml(s.contact || '') + '</td><td>' + escapeHtml(s.address || '') + '</td><td>' + escapeHtml(s.phone || '') + '</td><td>' + escapeHtml(s.remark || '') + '</td><td>' + created + '</td><td><button type="button" class="btn btn-outline btn-sm btn-contact-edit" data-id="' + s.id + '">编辑</button> <button type="button" class="btn-delete btn-contact-delete" data-id="' + s.id + '">删除</button></td></tr>';
        }).join('');
      } else {
        tbody.innerHTML = rows.map(function (c) {
          var created = (c.createdAt && new Date(c.createdAt).toLocaleString('zh-CN')) || '-';
          return '<tr><td>' + escapeHtml(c.name || '') + '</td><td>' + escapeHtml(c.address || '') + '</td><td>' + escapeHtml(c.phone || '') + '</td><td>' + escapeHtml(c.remark || '') + '</td><td>' + created + '</td><td><button type="button" class="btn btn-outline btn-sm btn-contact-edit" data-id="' + c.id + '">编辑</button> <button type="button" class="btn-delete btn-contact-delete" data-id="' + c.id + '">删除</button></td></tr>';
        }).join('');
      }
    }

    var paginationEl = document.getElementById('contacts-pagination');
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

  document.querySelectorAll('.contacts-nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.contactsTab = this.dataset.tab;
      state.contactsPage = 1;
      document.querySelectorAll('.contacts-nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === state.contactsTab); });
      document.getElementById('contacts-search').value = '';
      state.contactsSearch = '';
      renderContacts();
    });
  });

  on(document.getElementById('contacts-search'), 'input', function () {
    state.contactsPage = 1;
    renderContacts();
  });

  on(document.getElementById('contacts-btn-add'), 'click', function () {
    document.getElementById('contacts-modal-id').value = '';
    document.getElementById('contacts-modal-title').textContent = state.contactsTab === 'suppliers' ? '添加供应商' : '添加客户';
    document.getElementById('contacts-modal-name-label').textContent = state.contactsTab === 'suppliers' ? '供应商' : '客户名';
    document.getElementById('contacts-modal-form').reset();
    document.getElementById('contacts-modal-created-wrap').style.display = 'none';
    document.getElementById('contacts-field-contact-wrap').style.display = state.contactsTab === 'suppliers' ? 'block' : 'none';
    openModal(document.getElementById('contacts-modal'));
  });

  on(document.getElementById('contacts-modal-cancel'), 'click', function () {
    closeModal(document.getElementById('contacts-modal'));
  });
  on(document.querySelector('.modal-overlay'), 'click', function () {
    closeModal(document.getElementById('contacts-modal'));
  });

  on(document.getElementById('contacts-modal-form'), 'submit', function (e) {
    e.preventDefault();
    var editId = document.getElementById('contacts-modal-id').value.trim();
    var name = (document.getElementById('contacts-modal-name').value || '').trim();
    if (!name) return;
    if (state.contactsTab === 'suppliers') {
      var contact = (document.getElementById('contacts-modal-contact').value || '').trim();
      var phone = (document.getElementById('contacts-modal-phone').value || '').trim();
      var address = (document.getElementById('contacts-modal-address').value || '').trim();
      var remark = (document.getElementById('contacts-modal-remark').value || '').trim();
      if (editId) {
        var s = state.suppliers.find(function (x) { return x.id === editId; });
        if (s) { s.name = name; s.contact = contact; s.phone = phone; s.address = address; s.remark = remark; }
      } else {
        state.suppliers.push({ id: id(), name: name, contact: contact, phone: phone, address: address, remark: remark, createdAt: now() });
      }
      fillSupplierSelect();
    } else {
      var address2 = (document.getElementById('contacts-modal-address').value || '').trim();
      var phone2 = (document.getElementById('contacts-modal-phone').value || '').trim();
      var remark2 = (document.getElementById('contacts-modal-remark').value || '').trim();
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
    closeModal(document.getElementById('contacts-modal'));
    renderContacts();
  });

  on(document.getElementById('contacts-tbody'), 'click', function (e) {
    var editBtn = e.target.closest('.btn-contact-edit');
    var delBtn = e.target.closest('.btn-contact-delete');
    if (editBtn) {
      var id = editBtn.dataset.id;
      var list = getContactsList();
      var item = list.find(function (x) { return x.id === id; });
      if (!item) return;
      document.getElementById('contacts-modal-id').value = item.id;
      document.getElementById('contacts-modal-title').textContent = state.contactsTab === 'suppliers' ? '编辑供应商' : '编辑客户';
      document.getElementById('contacts-modal-name-label').textContent = state.contactsTab === 'suppliers' ? '供应商' : '客户名';
      document.getElementById('contacts-modal-name').value = item.name || '';
      document.getElementById('contacts-modal-phone').value = item.phone || '';
      document.getElementById('contacts-modal-remark').value = item.remark || '';
      document.getElementById('contacts-modal-contact').value = (item.contact || '');
      document.getElementById('contacts-modal-address').value = (item.address || '');
      document.getElementById('contacts-modal-created-text').textContent = (item.createdAt && new Date(item.createdAt).toLocaleString('zh-CN')) || '-';
      document.getElementById('contacts-modal-created-wrap').style.display = 'block';
      document.getElementById('contacts-field-contact-wrap').style.display = state.contactsTab === 'suppliers' ? 'block' : 'none';
      openModal(document.getElementById('contacts-modal'));
    }
    if (delBtn) {
      var id = delBtn.dataset.id;
      var name = (state.contactsTab === 'suppliers' ? state.suppliers : state.customers).find(function (x) { return x.id === id; });
      var displayName = name ? (name.name || '该项') : '该项';
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
      renderContacts();
    }
  });

  on(document.getElementById('contacts-table'), 'click', function (e) {
    var th = e.target.closest('th[data-sort]');
    if (!th) return;
    var key = th.dataset.sort;
    if (!key) return;
    if (state.contactsSortKey === key) state.contactsSortDir = -state.contactsSortDir;
    else { state.contactsSortKey = key; state.contactsSortDir = 1; }
    state.contactsPage = 1;
    renderContacts();
  });

  on(document.getElementById('contacts-pagination'), 'click', function (e) {
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
    const sel = document.getElementById('out-customer-select');
    const input = document.getElementById('out-customer');
    if (sel && sel.value && sel.value.trim()) return sel.value.trim();
    return input ? input.value.trim() : '';
  }

  on(document.getElementById('form-out'), 'submit', function (e) {
    e.preventDefault();
    var productId = (document.getElementById('out-part') && document.getElementById('out-part').value);
    var qty = (document.getElementById('out-qty') && document.getElementById('out-qty').value);
    var customer = getOutCustomerValue();
    var operator = (document.getElementById('out-operator') && document.getElementById('out-operator').value.trim()) || state.settings.defaultOperator;
    var paymentStatus = (document.getElementById('out-payment-status') && document.getElementById('out-payment-status').value) || 'booked';
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
      if (document.getElementById('out-operator')) document.getElementById('out-operator').value = state.settings.defaultOperator;
      if (document.getElementById('out-payment-status')) document.getElementById('out-payment-status').value = 'booked';
      var qEl = document.getElementById('out-qty');
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

  function showToast(text, success) {
    var el = document.getElementById('toast');
    var textEl = document.getElementById('toast-text');
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
    var el = document.getElementById('settings-hint');
    if (!el) return;
    el.textContent = text;
    el.className = 'hint' + (success === false ? ' error' : '');
    setTimeout(function () {
      el.textContent = '';
      el.className = 'hint';
    }, 2500);
  }

  function getFilteredStockList() {
    var keyword = ((document.getElementById('search-input') && document.getElementById('search-input').value) || '').toLowerCase().trim();
    var filterModel = (document.getElementById('filter-model') && document.getElementById('filter-model').value) || '';
    var filterMain = (document.getElementById('filter-mainType') && document.getElementById('filter-mainType').value) || '';
    var filterBrand = (document.getElementById('filter-brand') && document.getElementById('filter-brand').value) || '';
    var filterSupplier = (document.getElementById('filter-supplier') && document.getElementById('filter-supplier').value) || '';
    var stockMin = parseInt((document.getElementById('filter-stock-min') && document.getElementById('filter-stock-min').value), 10);
    var stockMax = parseInt((document.getElementById('filter-stock-max') && document.getElementById('filter-stock-max').value), 10);
    var lowOnly = (document.getElementById('filter-low-only') && document.getElementById('filter-low-only').classList).contains('active');
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
    if (lowOnly) list = list.filter(function (row) { return (row.batch.quantity || 0) < threshold; });
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
        if (key === 'brand') { va = pa.brand; vb = pb.brand; return dir * (String(va || '').localeCompare(String(vb || ''))); }
        if (key === 'quantity') { va = ba.quantity || 0; vb = bb.quantity || 0; return dir * (va - vb); }
        return 0;
      });
    }
    return list;
  }

  function getStockStatus(batchOrRow, threshold) {
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
    var threshold = state.settings.lowStockThreshold || 5;
    var tbody = document.getElementById('stock-tbody');
    if (!tbody) return;
    var html = list
      .map(function (row, i) {
        var b = row.batch;
        var p = row.product;
        var isLastRow = i >= list.length - 3;
        var status = getStockStatus(b, threshold);
        var cost = b.costPrice != null ? Number(b.costPrice) : null;
        var sale = (p.salePrice != null ? p.salePrice : b.salePrice) != null ? Number(p.salePrice != null ? p.salePrice : b.salePrice) : null;
        var stockVal = (b.quantity || 0) * (cost || 0);
        var costStr = cost != null ? formatKip(cost) : '-';
        var saleStr = sale != null ? formatKip(sale) : '-';
        var stockValStr = stockVal ? formatKip(stockVal) : '-';
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
        return (
          '<tr class="' + status.rowClass + '">' +
          '<td>' + (b.partCode || '-') + '</td>' +
          '<td>' + escapeHtml(b.partName || '-') + '</td>' +
          '<td>' + (p.brand || '-') + '</td>' +
          '<td class="' + (status.qtyClass || '') + '">' + (b.quantity ?? 0) + '</td>' +
          '<td>' + costStr + '</td>' +
          '<td>' + saleStr + '</td>' +
          '<td class="cell-amount">' + stockValStr + '</td>' +
          '<td><span class="tag tag-' + (status.rowClass === 'row-high' ? 'success' : status.rowClass === 'row-low' || status.rowClass === 'row-out' ? 'danger' : 'normal') + '">' + status.text + '</span></td>' +
          '<td>' + opCell + '</td>' +
          '</tr>'
        );
      })
      .join('');
    var sortKey = state.stockSort.key;
    var sortDir = state.stockSort.dir;
    requestAnimationFrame(function () {
      tbody.innerHTML = html;
      document.querySelectorAll('#stock-table th').forEach(function (th) {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortKey) {
          th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
        }
      });
    });
  }

  function openStockLog(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    var product = getProductById(batch.productId);
    var txList = state.transactions.filter(function (t) { return t.batchId === batchId || t.partId === batch.productId; }).sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); });
    document.getElementById('stock-log-title').textContent = '库存流水：' + (batch.partCode || '') + ' ' + (batch.partName || '') + (batch.supplier ? ' · ' + batch.supplier : '');
    document.getElementById('stock-log-summary').innerHTML = '当前库存 <strong>' + (batch.quantity ?? 0) + '</strong> 件，共 <strong>' + txList.length + '</strong> 条记录';
    document.getElementById('stock-log-tbody').innerHTML = txList.slice(0, 50).map(function (t) {
      return '<tr><td>' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</td><td>' + (t.type === 'in' ? '入库' : '出库') + '</td><td>' + (t.quantity ?? 0) + '</td><td>' + escapeHtml(t.supplierOrCustomer || '-') + '</td><td>' + escapeHtml(t.operator || '-') + '</td></tr>';
    }).join('');
    openModal(document.getElementById('stock-log-modal'));
  }

  on(document.getElementById('stock-log-close'), 'click', function () {
    closeModal(document.getElementById('stock-log-modal'));
  });
  on((document.getElementById('stock-log-modal') && document.getElementById('stock-log-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(document.getElementById('stock-log-modal'));
  });

  var imageViewerScale = 1;
  var IMAGE_VIEWER_SCALE_MIN = 0.5;
  var IMAGE_VIEWER_SCALE_MAX = 3;
  var IMAGE_VIEWER_SCALE_STEP = 0.25;

  function openImageViewer(src) {
    if (!src || !src.trim()) return;
    var imgEl = document.getElementById('image-viewer-img');
    var scaleEl = document.getElementById('image-viewer-scale');
    if (!imgEl || !scaleEl) return;
    imgEl.src = src;
    imageViewerScale = 1;
    imgEl.style.transform = 'scale(1)';
    scaleEl.textContent = '100%';
    openModal(document.getElementById('image-viewer-modal'));
  }

  function applyImageViewerScale() {
    var imgEl = document.getElementById('image-viewer-img');
    var scaleEl = document.getElementById('image-viewer-scale');
    if (imgEl) imgEl.style.transform = 'scale(' + imageViewerScale + ')';
    if (scaleEl) scaleEl.textContent = Math.round(imageViewerScale * 100) + '%';
  }

  on(document.getElementById('image-viewer-zoom-in'), 'click', function () {
    if (imageViewerScale < IMAGE_VIEWER_SCALE_MAX) {
      imageViewerScale = Math.min(IMAGE_VIEWER_SCALE_MAX, imageViewerScale + IMAGE_VIEWER_SCALE_STEP);
      applyImageViewerScale();
    }
  });
  on(document.getElementById('image-viewer-zoom-out'), 'click', function () {
    if (imageViewerScale > IMAGE_VIEWER_SCALE_MIN) {
      imageViewerScale = Math.max(IMAGE_VIEWER_SCALE_MIN, imageViewerScale - IMAGE_VIEWER_SCALE_STEP);
      applyImageViewerScale();
    }
  });
  on(document.getElementById('image-viewer-close'), 'click', function () {
    closeModal(document.getElementById('image-viewer-modal'));
  });
  on((document.getElementById('image-viewer-modal') && document.getElementById('image-viewer-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(document.getElementById('image-viewer-modal'));
  });

  function openStockDetail(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    var p = getProductById(batch.productId);
    if (!p) p = {};
    var cost = batch.costPrice != null ? Number(batch.costPrice) : null;
    var sale = (p.salePrice != null ? p.salePrice : batch.salePrice) != null ? Number(p.salePrice != null ? p.salePrice : batch.salePrice) : null;
    var stockValue = (batch.quantity || 0) * (cost || 0);
    document.getElementById('stock-detail-title').textContent = (batch.partCode || '') + ' ' + (batch.partName || '') + (batch.supplier ? ' · ' + batch.supplier : '');
    var imgWrap = document.getElementById('stock-detail-image-wrap');
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
    document.getElementById('stock-detail-body').innerHTML =
      '<dt>厂家</dt><dd>' + (batch.supplier || '-') + '</dd>' +
      '<dt>质量</dt><dd>' + (batch.qualityGrade || '-') + '</dd>' +
      '<dt>车型</dt><dd>' + getModelName(p.modelId) + '</dd>' +
      '<dt>主件 / 子件</dt><dd>' + getMainTypeName(p.mainTypeId) + ' / ' + getSubTypeName(p.subTypeId) + '</dd>' +
      '<dt>单位</dt><dd>' + (p.unit || 'KIP') + '</dd>' +
      '<dt>成本价(KIP)</dt><dd>' + (cost != null ? formatKip(cost) : '-') + '</dd>' +
      '<dt>参考售价(KIP)</dt><dd>' + (sale != null ? formatKip(sale) : '-') + '</dd>' +
      '<dt>库存金额(KIP)</dt><dd>' + (stockValue ? formatKip(stockValue) : '-') + '</dd>' +
      '<dt>最后更新</dt><dd>' + (batch.updatedAt ? new Date(batch.updatedAt).toLocaleString('zh-CN') : '-') + '</dd>';
    var modal = document.getElementById('stock-detail-modal');
    if (modal) modal.setAttribute('data-batch-id', String(batchId));
    openModal(modal);
  }

  on(document.getElementById('stock-detail-close'), 'click', function () {
    closeModal(document.getElementById('stock-detail-modal'));
  });
  on((document.getElementById('stock-detail-modal') && document.getElementById('stock-detail-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(document.getElementById('stock-detail-modal'));
  });
  on(document.getElementById('stock-detail-btn-log'), 'click', function () {
    var modal = document.getElementById('stock-detail-modal');
    var id = modal && modal.getAttribute('data-batch-id');
    if (id) { openStockLog(id); closeModal(modal); }
  });
  on(document.getElementById('stock-detail-btn-edit'), 'click', function () {
    var modal = document.getElementById('stock-detail-modal');
    var id = modal && modal.getAttribute('data-batch-id');
    if (id) { closeModal(modal); openStockEdit(id); }
  });
  on(document.getElementById('stock-detail-btn-delete'), 'click', function () {
    var modal = document.getElementById('stock-detail-modal');
    var id = modal && modal.getAttribute('data-batch-id');
    if (id && confirm('确定删除该批次库存？删除后不可恢复。')) {
      deleteStockPart(id);
      closeModal(modal);
      renderStock();
    }
  });

  var pendingEditImage = '';

  function fillStockEditSelects(part) {
    fillSelect(document.getElementById('stock-edit-model'), [{ id: '', name: '请选择车型' }].concat(state.models.map(function (m) { return { id: m.id, name: m.name }; })), 'id', 'name');
    fillSelect(document.getElementById('stock-edit-mainType'), [{ id: '', name: '请选择主件' }].concat(state.mainTypes.map(function (t) { return { id: t.id, name: t.name }; })), 'id', 'name');
    var mainId = part ? (part.mainTypeId || '') : (document.getElementById('stock-edit-mainType') && document.getElementById('stock-edit-mainType').value);
    var subs = state.subTypes.filter(function (s) { return s.mainTypeId === mainId; });
    fillSelect(document.getElementById('stock-edit-subType'), [{ id: '', name: '请选择子件' }].concat(subs.map(function (s) { return { id: s.id, name: s.name }; })), 'id', 'name');
    fillSelect(document.getElementById('stock-edit-quality'), [{ id: '', name: '请选择' }].concat(QUALITY_GRADES.map(function (g) { return { id: g, name: g }; })), 'id', 'name');
    if (part) {
      document.getElementById('stock-edit-model').value = part.modelId || '';
      document.getElementById('stock-edit-mainType').value = part.mainTypeId || '';
      document.getElementById('stock-edit-subType').value = part.subTypeId || '';
    }
  }

  on(document.getElementById('stock-edit-mainType'), 'change', function () {
    var subs = state.subTypes.filter(function (s) { return s.mainTypeId === this.value; });
    fillSelect(document.getElementById('stock-edit-subType'), [{ id: '', name: '请选择子件' }, ...subs], 'id', 'name');
  });

  function openStockEdit(batchId) {
    var batch = getBatchById(batchId);
    if (!batch) return;
    var p = getProductById(batch.productId);
    if (!p) p = {};
    pendingEditImage = '';
    document.getElementById('stock-edit-id').value = batch.id;
    document.getElementById('stock-edit-product-id').value = p.id || '';
    document.getElementById('stock-edit-code').value = batch.partCode || '';
    document.getElementById('stock-edit-name').value = p.name || batch.partName || '';
    document.getElementById('stock-edit-brand').value = p.brand || '';
    document.getElementById('stock-edit-unit').value = p.unit || 'KIP';
    document.getElementById('stock-edit-costPrice').value = formatKip(batch.costPrice);
    document.getElementById('stock-edit-salePrice').value = formatKip(p.salePrice);
    document.getElementById('stock-edit-supplier').value = batch.supplier || '';
    document.getElementById('stock-edit-quality').value = batch.qualityGrade || '';
    document.getElementById('stock-edit-qty').value = batch.quantity ?? '';
    fillStockEditSelects(p);
    var preview = document.getElementById('stock-edit-imagePreview');
    if (preview) {
      preview.src = (p.imageUrl || '').trim() || '';
      preview.style.display = (p.imageUrl || '').trim() ? 'block' : 'none';
    }
    var fileInput = document.getElementById('stock-edit-imageFile');
    if (fileInput) fileInput.value = '';
    openModal(document.getElementById('stock-edit-modal'));
  }

  on(document.getElementById('stock-edit-imageFile'), 'change', function () {
    var file = this.files && this.files[0];
    var preview = document.getElementById('stock-edit-imagePreview');
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

  on(document.getElementById('stock-edit-form'), 'submit', function (e) {
    e.preventDefault();
    var batchId = document.getElementById('stock-edit-id').value;
    var productId = document.getElementById('stock-edit-product-id').value;
    var batch = getBatchById(batchId);
    var product = productId ? getProductById(productId) : null;
    if (!batch) return;
    if (product) {
      product.name = document.getElementById('stock-edit-name').value.trim();
      product.brand = document.getElementById('stock-edit-brand').value.trim();
      product.unit = (document.getElementById('stock-edit-unit').value || 'KIP').trim();
      var saleVal = document.getElementById('stock-edit-salePrice').value;
      product.salePrice = saleVal === '' ? undefined : Number(saleVal);
      product.modelId = document.getElementById('stock-edit-model').value || undefined;
      product.mainTypeId = document.getElementById('stock-edit-mainType').value || undefined;
      product.subTypeId = document.getElementById('stock-edit-subType').value || undefined;
      if (pendingEditImage) product.imageUrl = pendingEditImage;
      product.updatedAt = now();
      batch.partName = product.name;
    }
    var costVal = document.getElementById('stock-edit-costPrice').value;
    batch.costPrice = costVal === '' ? undefined : Number(costVal);
    batch.supplier = document.getElementById('stock-edit-supplier').value.trim() || undefined;
    batch.qualityGrade = document.getElementById('stock-edit-quality').value.trim() || undefined;
    var qtyVal = document.getElementById('stock-edit-qty').value;
    batch.quantity = qtyVal === '' ? 0 : Math.max(0, parseInt(qtyVal, 10));
    batch.updatedAt = now();
    bumpDataVersion();
    persistState();
    pendingEditImage = '';
    closeModal(document.getElementById('stock-edit-modal'));
    renderStock();
    showSettingsHint('已保存', true);
  });

  on(document.getElementById('stock-edit-cancel'), 'click', function () {
    closeModal(document.getElementById('stock-edit-modal'));
  });
  on((document.getElementById('stock-edit-modal') && document.getElementById('stock-edit-modal').querySelector('.modal-overlay')), 'click', function () {
    closeModal(document.getElementById('stock-edit-modal'));
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

  on(document.getElementById('stock-tbody'), 'click', function (e) {
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

  on(document.getElementById('stock-table'), 'click', function (e) {
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
  on(document.getElementById('search-input'), 'input', function () {
    if (stockSearchDebounceTimer) clearTimeout(stockSearchDebounceTimer);
    stockSearchDebounceTimer = setTimeout(function () {
      stockSearchDebounceTimer = null;
      renderStock();
    }, STOCK_SEARCH_DEBOUNCE_MS);
  });
  on(document.getElementById('btn-search'), 'click', function () {
    if (stockSearchDebounceTimer) clearTimeout(stockSearchDebounceTimer);
    stockSearchDebounceTimer = null;
    renderStock();
  });
  on(document.getElementById('filter-low-only'), 'click', function () {
    this.classList.toggle('active');
    renderStock();
  });
  on(document.getElementById('btn-reset'), 'click', function () {
    var searchInput = document.getElementById('search-input');
    var filterModel = document.getElementById('filter-model');
    var filterMain = document.getElementById('filter-mainType');
    var filterBrand = document.getElementById('filter-brand');
    var filterSupplier = document.getElementById('filter-supplier');
    var filterStockMin = document.getElementById('filter-stock-min');
    var filterStockMax = document.getElementById('filter-stock-max');
    var lowBtn = document.getElementById('filter-low-only');
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
        model: getModelName(p.modelId),
        mainType: getMainTypeName(p.mainTypeId),
        subType: getSubTypeName(p.subTypeId),
        supplier: b.supplier,
        qualityGrade: b.qualityGrade,
        quantity: b.quantity,
        unit: p.unit || 'KIP',
        costPrice: b.costPrice,
        salePrice: p.salePrice != null ? p.salePrice : b.salePrice,
        stockValue: (b.quantity || 0) * (b.costPrice || 0),
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
    var headers = ['编码', '名称', '品牌', '车型', '主件', '子件', '厂家', '质量', '库存数量', '单位', '成本价', '销售价', '库存金额', '最后更新'];
    var rows = list.map(function (row) {
      var b = row.batch;
      var p = row.product;
      var stockValue = (b.quantity || 0) * (b.costPrice || 0);
      var sale = p.salePrice != null ? p.salePrice : b.salePrice;
      return [
        b.partCode || '',
        b.partName || '',
        p.brand || '',
        getModelName(p.modelId),
        getMainTypeName(p.mainTypeId),
        getSubTypeName(p.subTypeId),
        b.supplier || '',
        b.qualityGrade || '',
        b.quantity ?? '',
        p.unit || 'KIP',
        formatKip(b.costPrice) || '',
        formatKip(sale) || '',
        formatKip(stockValue) || '',
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

  on(document.getElementById('btn-export-stock-json'), 'click', exportStockListJson);
  on(document.getElementById('btn-export-stock-csv'), 'click', exportStockListCsv);

  function fillFilterSelects() {
    fillSelect(document.getElementById('filter-model'), [{ id: '', name: '全部车型' }, ...state.models], 'id', 'name');
    fillSelect(document.getElementById('filter-mainType'), [{ id: '', name: '全部主件' }, ...state.mainTypes], 'id', 'name');
    var brands = [];
    var seenBrand = {};
    state.products.forEach(function (p) {
      var b = (p.brand || '').trim();
      if (b && !seenBrand[b]) { seenBrand[b] = true; brands.push({ id: b, name: b }); }
    });
    fillSelect(document.getElementById('filter-brand'), [{ id: '', name: '全部品牌' }, ...brands], 'id', 'name');
    var suppliers = [];
    var seenSup = {};
    state.batches.forEach(function (b) {
      var s = (b.supplier || '').trim();
      if (s && !seenSup[s]) { seenSup[s] = true; suppliers.push({ id: s, name: s }); }
    });
    fillSelect(document.getElementById('filter-supplier'), [{ id: '', name: '全部厂家' }, ...suppliers], 'id', 'name');
  }

  function fillRecordsFilters() {
    fillSelect(document.getElementById('records-model'), [{ id: '', name: '全部车型' }, ...state.models], 'id', 'name');
    var suppliers = state.suppliers.map(function (s) { return s.name; }).filter(Boolean);
    var custSet = {};
    state.transactions.forEach(function (t) {
      if (t.type === 'out' && (t.supplierOrCustomer || '').trim()) custSet[t.supplierOrCustomer.trim()] = 1;
    });
    var customers = Object.keys(custSet);
    fillSelect(document.getElementById('records-supplier'), [{ id: '', name: '全部供应商' }, ...suppliers.map(function (n) { return { id: n, name: n }; })], 'id', 'name');
    fillSelect(document.getElementById('records-customer'), [{ id: '', name: '全部客户' }, ...customers.map(function (n) { return { id: n, name: n }; })], 'id', 'name');
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
    var tbody = document.getElementById('records-tbody');
    if (!tbody) return;
    var html = list
      .map(function (t) {
        var partName = getPartName(t.productId || t.partId);
        if (partName === '-' && !t.partCode) return '';
        var rowClass = t.type === 'in' ? 'record-row-in' : 'record-row-out';
        return (
          '<tr class="record-row ' + rowClass + '" data-tx-id="' + (t.id || '') + '" role="button" tabindex="0" title="点击查看详情">' +
          '<td>' + (t.partCode || '-') + '</td>' +
          '<td>' + (partName || '-') + '</td>' +
          '<td>' + (t.type === 'in' ? '入库' : '出库') + '</td>' +
          '<td>' + (t.quantity ?? 0) + '</td>' +
          '<td>' + (t.supplierOrCustomer || '-') + '</td>' +
          '<td>' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</td></tr>'
        );
      })
      .join('');
    requestAnimationFrame(function () { tbody.innerHTML = html; });
  }

  function openRecordDetail(txId) {
    var t = state.transactions.find(function (x) { return x.id === txId; });
    if (!t) return;
    var partName = getPartName(t.productId || t.partId);
    var body = document.getElementById('record-detail-body');
    if (!body) return;
    var salePriceStr = t.type === 'out' && t.salePrice != null ? (typeof formatKip === 'function' ? formatKip(t.salePrice) : t.salePrice) : '-';
    body.innerHTML =
      '<dt>时间</dt><dd>' + (t.time ? new Date(t.time).toLocaleString('zh-CN') : '-') + '</dd>' +
      '<dt>类型</dt><dd>' + (t.type === 'in' ? '入库' : '出库') + '</dd>' +
      '<dt>配件编码</dt><dd>' + (t.partCode || '-') + '</dd>' +
      '<dt>配件名称</dt><dd>' + (partName || '-') + '</dd>' +
      '<dt>数量</dt><dd>' + (t.quantity ?? '-') + '</dd>' +
      '<dt>供应商/客户</dt><dd>' + (t.supplierOrCustomer || '-') + '</dd>' +
      '<dt>操作人员</dt><dd>' + (t.operator || '-') + '</dd>' +
      '<dt>销售价(出库)</dt><dd>' + salePriceStr + '</dd>';
    var modal = document.getElementById('record-detail-modal');
    if (modal) openModal(modal);
  }

  function closeRecordDetailModal() {
    var modal = document.getElementById('record-detail-modal');
    if (modal) closeModal(modal);
  }

  document.querySelectorAll('.records-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.recordsType = this.dataset.recordType;
      document.querySelectorAll('.records-tab').forEach(function (b) {
        b.classList.toggle('active', b.dataset.recordType === state.recordsType);
      });
      renderRecords();
      updateRecordsStats();
    });
  });

  on(document.getElementById('records-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderRecords();
    updateRecordsStats();
  });

  on(document.getElementById('btn-records-reset'), 'click', function () {
    document.getElementById('records-keyword').value = '';
    document.getElementById('records-model').value = '';
    document.getElementById('records-supplier').value = '';
    document.getElementById('records-customer').value = '';
    document.getElementById('records-dateFrom').value = '';
    document.getElementById('records-dateTo').value = '';
    renderRecords();
    updateRecordsStats();
  });

  on(document.getElementById('records-tbody'), 'click', function (e) {
    var row = e.target.closest('tr.record-row');
    if (row) {
      var txId = row.getAttribute('data-tx-id');
      if (txId) openRecordDetail(txId);
    }
  });

  on(document.getElementById('records-tbody'), 'keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var row = e.target.closest('tr.record-row');
    if (row) {
      e.preventDefault();
      var txId = row.getAttribute('data-tx-id');
      if (txId) openRecordDetail(txId);
    }
  });

  on(document.querySelector('.record-detail-close'), 'click', closeRecordDetailModal);
  on((document.getElementById('record-detail-modal') && document.getElementById('record-detail-modal').querySelector('.modal-overlay')), 'click', closeRecordDetailModal);

  function getRecordsFilterParams() {
    return {
      keyword: ((document.getElementById('records-keyword') && document.getElementById('records-keyword').value) || '').toLowerCase().trim(),
      modelId: (document.getElementById('records-model') && document.getElementById('records-model').value) || '',
      supplier: ((document.getElementById('records-supplier') && document.getElementById('records-supplier').value) || '').trim(),
      customer: ((document.getElementById('records-customer') && document.getElementById('records-customer').value) || '').trim(),
      dateFrom: (document.getElementById('records-dateFrom') && document.getElementById('records-dateFrom').value) || '',
      dateTo: (document.getElementById('records-dateTo') && document.getElementById('records-dateTo').value) || '',
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
    var el = document.getElementById('records-stats');
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
    html += '<tr><th>编码</th><th>名称</th><th>数量</th><th>单价(KIP)</th><th>总价(KIP)</th></tr>';
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

  on(document.getElementById('btn-records-print-outbound'), 'click', printOutboundSlipFromRecords);

  function getCustomerStatsList() {
    var keyword = ((document.getElementById('customerStats-keyword') && document.getElementById('customerStats-keyword').value) || '').trim().toLowerCase();
    var dateFrom = (document.getElementById('customerStats-dateFrom') && document.getElementById('customerStats-dateFrom').value) || '';
    var dateTo = (document.getElementById('customerStats-dateTo') && document.getElementById('customerStats-dateTo').value) || '';
    var list = state.transactions.filter(function (t) { return t.type === 'out'; });
    if (dateFrom) list = list.filter(function (t) { return t.time && t.time.slice(0, 10) >= dateFrom; });
    if (dateTo) list = list.filter(function (t) { return t.time && t.time.slice(0, 10) <= dateTo; });
    var byCustomer = {};
    list.forEach(function (t) {
      var name = (t.supplierOrCustomer || '').trim() || '（未填客户）';
      if (!byCustomer[name]) byCustomer[name] = { count: 0, qty: 0, sales: 0, debt: 0, cost: 0, firstTime: '', lastTime: '' };
      byCustomer[name].count += 1;
      var q = t.quantity || 0;
      var sale = t.salePrice != null ? t.salePrice : 0;
      var cost = t.costPrice != null ? t.costPrice : 0;
      byCustomer[name].qty += q;
      byCustomer[name].sales += q * sale;
      byCustomer[name].cost += q * cost;
      if (t.paymentStatus === 'booked') byCustomer[name].debt += q * sale;
      if (t.time) {
        if (!byCustomer[name].firstTime || t.time < byCustomer[name].firstTime) byCustomer[name].firstTime = t.time;
        if (!byCustomer[name].lastTime || t.time > byCustomer[name].lastTime) byCustomer[name].lastTime = t.time;
      }
    });
    var rows = Object.keys(byCustomer).map(function (name) {
      var o = byCustomer[name];
      var profit = (o.sales || 0) - (o.cost || 0);
      return { name: name, count: o.count, qty: o.qty, sales: o.sales, debt: o.debt || 0, profit: profit, firstTime: o.firstTime, lastTime: o.lastTime };
    }).sort(function (a, b) { return (b.sales - a.sales); });
    if (keyword) rows = rows.filter(function (r) { return (r.name || '').toLowerCase().indexOf(keyword) !== -1; });
    return rows;
  }

  function renderCustomerStats() {
    var list = getCustomerStatsList();
    var tbody = document.getElementById('customerStats-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(function (row) {
      var salesStr = row.sales != null ? formatKip(row.sales) : '0.000';
      var debtStr = row.debt != null ? formatKip(row.debt) : '0.000';
      var profitStr = row.profit != null ? formatKip(row.profit) : '0.000';
      var firstStr = row.firstTime ? new Date(row.firstTime).toLocaleDateString('zh-CN') : '';
      var lastStr = row.lastTime ? new Date(row.lastTime).toLocaleDateString('zh-CN') : '';
      var rangeStr = firstStr && lastStr ? (firstStr === lastStr ? firstStr : firstStr + ' 至 ' + lastStr) : (lastStr || firstStr || '-');
      return '<tr><td>' + escapeHtml(row.name) + '</td><td>' + row.count + '</td><td>' + row.qty + '</td><td class="cell-amount">' + salesStr + '</td><td class="cell-amount">' + debtStr + '</td><td class="cell-amount">' + profitStr + '</td><td>' + rangeStr + '</td></tr>';
    }).join('');
  }

  on(document.getElementById('btn-customerStats-search'), 'click', renderCustomerStats);
  on(document.getElementById('btn-customerStats-reset'), 'click', function () {
    var kw = document.getElementById('customerStats-keyword');
    var from = document.getElementById('customerStats-dateFrom');
    var to = document.getElementById('customerStats-dateTo');
    if (kw) kw.value = '';
    if (from) from.value = '';
    if (to) to.value = '';
    renderCustomerStats();
  });
  on(document.getElementById('customerStats-filter-form'), 'submit', function (e) {
    e.preventDefault();
    renderCustomerStats();
  });

  function renderSettings() {
    const listModels = document.getElementById('list-models');
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

    const listMain = document.getElementById('list-mainTypes');
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

    const parentSel = document.getElementById('sub-parent');
    if (parentSel) {
      fillSelect(parentSel, state.mainTypes, 'id', 'name');
      const mainId = parentSel.value;
      const subs = state.subTypes.filter((s) => s.mainTypeId === mainId);
      const listSub = document.getElementById('list-subTypes');
      if (listSub) {
        listSub.innerHTML = subs
          .map(
            (s) =>
              '<li><span>' +
              escapeHtml(s.name) +
              '</span><button type="button" class="btn-delete" data-id="' +
              s.id +
              '" data-type="subType">删除</button></li>'
          )
          .join('');
      }
    }

    on(parentSel, 'change', function () {
      const mainId = this.value;
      const subs = state.subTypes.filter((s) => s.mainTypeId === mainId);
      const listSub = document.getElementById('list-subTypes');
      if (listSub) {
        listSub.innerHTML = subs
          .map(
            (s) =>
              '<li><span>' +
              escapeHtml(s.name) +
              '</span><button type="button" class="btn-delete" data-id="' +
              s.id +
              '" data-type="subType">删除</button></li>'
          )
          .join('');
      }
    });
  }

  function confirmDeleteCategory(type, name) {
    return confirm('确定要删除分类「' + name + '」吗？删除后相关配件的该分类将显示为空。');
  }

  on(document.getElementById('add-model'), 'click', function () {
    const input = document.getElementById('new-model');
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

  on(document.getElementById('add-mainType'), 'click', function () {
    const input = document.getElementById('new-mainType');
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

  on(document.getElementById('add-subType'), 'click', function () {
    const parentId = document.getElementById('sub-parent').value;
    const input = document.getElementById('new-subType');
    const name = (input.value || '').trim();
    if (!name || !parentId) return;
    state.subTypes.push({ id: id(), mainTypeId: parentId, name });
    bumpDataVersion();
    persistState();
    input.value = '';
    fillInFormSelects();
    renderSettings();
  });

  on(document.getElementById('list-models'), 'click', function (e) {
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

  on(document.getElementById('list-mainTypes'), 'click', function (e) {
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

  on(document.getElementById('list-subTypes'), 'click', function (e) {
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
      models: state.models,
      mainTypes: state.mainTypes,
      subTypes: state.subTypes,
      suppliers: state.suppliers,
      customers: state.customers,
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

  on(document.getElementById('btn-export'), 'click', exportJson);

  on(document.getElementById('file-import'), 'change', function () {
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
          if (data.settings && typeof data.settings === 'object') state.settings = data.settings;
          if (state.products.length === 0 && state.batches.length === 0 && Array.isArray(data.parts) && data.parts.length > 0) {
            state.parts = data.parts;
            migratePartsToProductsBatches();
          }
        }
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
      document.getElementById('file-import').value = '';
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
          models: state.models,
          mainTypes: state.mainTypes,
          subTypes: state.subTypes,
          suppliers: state.suppliers,
          customers: state.customers,
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
