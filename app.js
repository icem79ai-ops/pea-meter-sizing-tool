'use strict';
/* PEA Meter Sizing Tool */
var STORE_KEY = 'pea_meter_sizing_v1';
var V1D = 220;
var V3D = 380;

/* ค่า DF/PF เริ่มต้นต่อหมวด (วสท. โดยประมาณ) */
var CATS = {
  lighting: { name: 'แสงสว่าง', pf: 1.0, df: 1.0 },
  outlet: { name: 'ปลั๊กไฟ/เต้ารับ', pf: 1.0, df: 1.0 },
  ac: { name: 'เครื่องปรับอากาศ', pf: 0.8, df: 0.8 },
  heater: { name: 'เครื่องทำน้ำอุ่น', pf: 1.0, df: 0.75 },
  pump: { name: 'ปั๊มน้ำ/มอเตอร์', pf: 0.8, df: 1.0 },
  ev: { name: 'EV / ลิฟต์', pf: 1.0, df: 0.8 },
  other: { name: 'อื่นๆ', pf: 0.85, df: 0.7 }
};

/* สเปกกำลังไฟของแอร์ตาม BTU (W) — คำนวณจาก BTU ที่พิมพ์ */
var AC_BTU_W = {
  9000: 1000,
  12000: 1300,
  18000: 1900
};
function acWatts(btu) {
  var b = nnum(btu);
  if (AC_BTU_W[b]) return AC_BTU_W[b];
  var approx = Math.round(b / 12) * 12; /* interpolate หลักง่ายๆ */
  if (b > 0) return Math.max(600, Math.round(b / 9.5)); /* ~105 W ต่อ 1,000 BTU */
  return 0;
}

/* เครื่องใช้ที่มีเบรกเกอร์เฉพาะ — คิดโหลดจริง
   (เต้ารับและเครื่องที่เสียบปลั๊กธรรมดา คิดรวมเป็น "หมวดเต้ารับ" แล้ว ไม่แยกรายชิ้น) */
var PRESETS = [
  { id: 'led12', cat: 'lighting', name: 'หลอด LED 12W', w: 12, unit: 'ดวง' },
  { id: 'led20', cat: 'lighting', name: 'หลอด LED 20W', w: 20, unit: 'ดวง' },
  { id: 'outlet', cat: 'outlet', name: 'ปลั๊กไฟเต้ารับ', w: 180, va: true, unit: 'จุด' },
  { id: 'ac', cat: 'ac', name: 'แอร์', w: 1300, btu: 12000, unit: 'ตัว' },
  { id: 'wh100', cat: 'heater', name: 'เครื่องทำน้ำอุ่น' + '\u00a0' + '100' + '\u2009' + 'ล.', w: 4500, unit: 'เครื่อง' },
  { id: 'pump', cat: 'pump', name: 'ปั๊มน้ำอัตโนมัติ' + '\u00a0' + '1/2' + '\u2009' + 'แรงม้า', w: 370, unit: 'เครื่อง' },
  { id: 'pump1hp', cat: 'pump', name: 'ปั๊มน้ำบาดาล' + '\u00a0' + '1' + '\u2009' + 'แรงม้า', w: 750, unit: 'เครื่อง' },
  { id: 'ev37', cat: 'ev', name: 'EV' + '\u00a0' + 'Wallbox' + '\u00a0' + '3.7' + '\u2009' + 'kW', w: 3700, unit: 'เครื่อง' },
  { id: 'ev7', cat: 'ev', name: 'EV' + '\u00a0' + 'Wallbox' + '\u00a0' + '7' + '\u2009' + 'kW', w: 7000, unit: 'เครื่อง' },
  { id: 'lift', cat: 'ev', name: 'ลิฟต์บ้าน', w: 1800, unit: 'ตัว' }
];

/* หมวดเต้ารับ — คิดเป็นภาระโหลดสม่ำเสมอตามจำนวนจุด (มาตรฐาน วสท. ≈ 180 VA/จุด) */
var OUTLET_W_PER_POINT = 180; /* VA/จุด สำหรับรายงาน */

/* มิเตอร์ PEA: พิกัดกระแส (A)
   ใช้หลักการโหลดไม่เกิน 80% ของพิกัด → ตัวที่เหมาะสมคือ cap ที่ 0.8*cap >= โหลด */
var METER_1PH = [
  { amp: '5(15)A', cap: 15 },
  { amp: '15(45)A', cap: 45 },
  { amp: '30(100)A', cap: 100 }
];
var METER_3PH = [
  { amp: '15(45)A', cap: 45 },
  { amp: '30(100)A', cap: 100 }
];
var METER_UTIL = 0.8; /* โหลดสูงสุดที่ยอมรับ = 80% ของพิกัดมิเตอร์ */var state = {
  projects: [],
  currentId: null,
  chart: null
};

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function nnum(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}
function fmt(v, d) {
  d = d == null ? 2 : d;
  return nnum(v).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function uid() {
  return 'r' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}
function load() {
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.projects)) {
        state.projects = d.projects;
        state.currentId = d.currentId;
      }
    }
  } catch (e) { /* ignore */ }
}
function proj() {
  for (var i = 0; i < state.projects.length; i++) {
    if (state.projects[i].id === state.currentId) return state.projects[i];
  }
  return null;
}
function newProj() {
  var p = {
    id: uid(),
    name: 'โครงการใหม่',
    v1: V1D,
    v3: V3D,
    items: [],
    factors: {}
  };
  state.projects.push(p);
  state.currentId = p.id;
  return p;
}function itemPf(it) {
  if (it && it.pf != null) return Math.min(1, Math.max(0.1, nnum(it.pf)));
  var def = (CATS[it.cat] || {}).pf != null ? CATS[it.cat].pf : 0.85;
  return def;
}
function itemDf(it) {
  if (it && it.df != null) return Math.min(1.5, Math.max(0, nnum(it.df)));
  var def = (CATS[it.cat] || {}).df != null ? CATS[it.cat].df : 0.7;
  return def;
}
/* kVA ของอุปกรณ์หนึ่ง = W*จำนวน /1000 / PF (เก็บ PF ต่ออุปกรณ์) */
function itemKva(it) {
  return (nnum(it.w) * nnum(it.qty)) / 1000 / itemPf(it);
}
/* ดีมานด์ = kVA * DF (เก็บ DF ต่ออุปกรณ์) */
function itemDemand(it) {
  return itemKva(it) * itemDf(it);
}
/* รวม: kW/kVA/ดีมานด์ + กระแส 1&3 เฟส */
function totals() {
  var p = proj();
  var r = { connKw: 0, connKva: 0, demand: 0, rows: [] };
  if (!p) return r;
  var byCat = {};
  p.items.forEach(function (it) {
    if (!byCat[it.cat]) {
      byCat[it.cat] = { cat: it.cat, qty: 0, w: 0, kw: 0, kva: 0, dem: 0 };
    }
    byCat[it.cat].qty += nnum(it.qty);
    byCat[it.cat].w += nnum(it.w) * nnum(it.qty);
    byCat[it.cat].kw += (nnum(it.w) * nnum(it.qty)) / 1000;
    byCat[it.cat].kva += itemKva(it);
    byCat[it.cat].dem += itemDemand(it);
  });
  Object.keys(byCat).forEach(function (cat) {
    var g = byCat[cat];
    g.connKw = g.kw;
    g.connKva = g.kva;
    g.dem = g.dem;
    g.pf = g.kva > 0 ? g.kw / g.kva : (CATS[cat] ? CATS[cat].pf : 0.85);
    g.df = g.kva > 0 ? g.dem / g.kva : (CATS[cat] ? CATS[cat].df : 0.7);
    r.connKw += g.connKw;
    r.connKva += g.connKva;
    r.demand += g.dem;
    r.rows.push(g);
  });
  r.rows.sort(function (a, b) { return b.dem - a.dem; });
  r.i1 = r.demand * 1000 / (p.v1 || V1D);
  r.i3 = r.demand * 1000 / (Math.sqrt(3) * (p.v3 || V3D));
  r.i1Cap = r.i1 / METER_UTIL;
  r.i3Cap = r.i3 / METER_UTIL;
  return r;
}
/* เลือกมิเตอร์ตามระเบียบ: โหลดต้องไม่เกิน 80% ของพิกัดมิเตอร์
   → พิกัดที่ต้องการ = โหลด/0.8 แล้วเลือกตัวที่รองรับ */
function pickMeter(list, ampereCap) {
  for (var i = 0; i < list.length; i++) {
    if (ampereCap <= list[i].cap * METER_UTIL) {
      return { amp: list[i].amp, cap: list[i].cap, util: ampereCap / list[i].cap };
    }
  }
  return { amp: 'เกินพิกัด → ใช้ CT', cap: 99999, util: 1 };
}function render() {
  renderProjSelect();
  renderVolt();
  renderPresets();
  renderFactors();
  renderResults();
}
function renderProjSelect() {
  var sel = $('project-select');
  if (!sel) return;
  sel.innerHTML = '';
  state.projects.forEach(function (p) {
    var o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.name;
    if (p.id === state.currentId) o.selected = true;
    sel.appendChild(o);
  });
}
function renderVolt() {
  var p = proj();
  if (!$('set-v1') || !$('set-v3')) return;
  $('set-v1').value = p ? p.v1 : V1D;
  $('set-v3').value = p ? p.v3 : V3D;
}
function renderPresets() {
  var g = $('preset-grid');
  if (!g) return;
  g.innerHTML = '';
  PRESETS.forEach(function (pr) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset-btn';
    b.innerHTML = '<span class="preset-name">' + esc(pr.name) + '</span><span class="preset-w">' + fmt(pr.w, 0) + (pr.va ? ' VA/จุด' : ' W') + (pr.btu ? ' · ' + fmt(pr.btu, 0) + ' BTU' : '') + '</span>';
    b.addEventListener('click', function () { addItem(pr); });
    g.appendChild(b);
  });
}
/* แสดงทุกเครื่องใช้เป็นแถวในตาราง — แก้ค่าในตารางได้เลย */
function renderFactors() {
  var tbody = document.querySelector('#factor-table tbody');
  var cnt = $('appliance-count');
  if (!tbody) return;
  tbody.innerHTML = '';
  var p = proj();
  var totalQty = 0;
  if (p && p.items.length) {
    p.items.forEach(function (it) {
      totalQty += nnum(it.qty);
      var isAc = it.cat === 'ac';
      var isOutlet = it.cat === 'outlet';
      var btuCell;
      if (isAc) {
        btuCell = '<input class="f-btu" type="number" min="6000" step="1000" data-id="' + it.id + '" value="' + (it.btu || 12000) + '" title="พิมพ์ BTU แล้วกำลังไฟคำนวณให้">';
      } else {
        btuCell = '<span class="muted-dash">—</span>';
      }
      var wCell;
      if (isAc) {
        wCell = '<span class="ac-w">' + fmt(it.w, 0) + '</span>';
      } else if (isOutlet) {
        wCell = '<span class="ac-w">' + fmt(it.w, 0) + ' VA/จุด</span>';
      } else {
        wCell = '<input class="f-w" type="number" min="0" step="1" data-id="' + it.id + '" value="' + fmt(it.w, 0) + '">';
      }
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><div class="appliance-name">' + esc(it.name) + '</div>' +
        (isAc ? '<div class="appliance-meta">' + esc((CATS[it.cat] || {}).name || '') + '</div>' : '') + '</td>' +
        '<td class="num"><input class="f-qty" type="number" min="1" step="1" data-id="' + it.id + '" value="' + nnum(it.qty) + '"></td>' +
        '<td class="num">' + btuCell + '</td>' +
        '<td class="num">' + wCell + '</td>' +
        '<td class="num"><input class="f-pf" type="number" min="0.1" max="1" step="0.01" data-id="' + it.id + '" value="' + fmt(itemPf(it), 2) + '"></td>' +
        '<td class="num"><input class="f-df" type="number" min="0" max="150" step="1" data-id="' + it.id + '" value="' + fmt(itemDf(it) * 100, 0) + '"></td>' +
        '<td class="num">' + fmt(itemKva(it), 2) + '</td>' +
        '<td class="num demand">' + fmt(itemDemand(it), 2) + '</td>' +
        '<td class="num"><button class="delbtn" data-id="' + it.id + '" data-del="1" title="ลบแถว">✕</button></td>';
      tbody.appendChild(tr);
    });
    /* แถวรวม */
    var t = totals();
    var trt = document.createElement('tr');
    trt.className = 'total-row';
    trt.innerHTML =
      '<td><strong>รวมทั้งหมด</strong> (' + p.items.length + ' รายการ)</td>' +
      '<td class="num"><strong>' + totalQty + '</strong></td>' +
      '<td class="num"></td>' +
      '<td class="num"></td>' +
      '<td class="num"></td>' +
      '<td class="num"></td>' +
      '<td class="num"><strong>' + fmt(t.connKva, 2) + '</strong></td>' +
      '<td class="num demand"><strong>' + fmt(t.demand, 2) + '</strong></td>' +
      '<td class="num"></td>';
    tbody.appendChild(trt);
  } else {
    tbody.innerHTML = '<tr><td colspan="9"><span class="empty-hint">ยังไม่มีรายการ — จิ้มเลือกเครื่องใช้ไฟฟ้าด้านบน แล้วแก้ PF/DF/BTU ได้ในตารางนี้</span></td></tr>';
  }
  if (cnt) cnt.textContent = String(totalQty);
}function catName(cat) {
  return (CATS[cat] && CATS[cat].name) || cat;
}
function renderResults() {
  var r = totals();
  var p = proj();
  setText('m-conn-kw', fmt(r.connKw, 2));
  setText('m-conn-kva', fmt(r.connKva, 2));
  setText('m-demand-kva', fmt(r.demand, 2));
  setText('m-i1', fmt(r.i1, 1));
  setText('m-i3', fmt(r.i3, 1));
  setText('m-i1-label', 'กระแส 1 เฟส (A) @ ' + (p ? p.v1 : V1D) + 'V');
  setText('m-i3-label', 'กระแส 3 เฟส (A/เฟส) @ ' + (p ? p.v3 : V3D) + 'V');

  if (!p) {
    setText('meter-1ph', '—');
    setText('meter-3ph', '—');
    setText('meter-1ph-sub', 'โปรเจกต์ยังว่าง');
    setText('meter-3ph-sub', 'โปรเจกต์ยังว่าง');
    return;
  }
  var m1 = pickMeter(METER_1PH, r.i1);
  var m3 = pickMeter(METER_3PH, r.i3);
  setText('meter-1ph', m1.amp);
  setText('meter-3ph', m3.amp);
  setText('meter-1ph-sub', r.i1 <= 0 ? 'รอโหลด' : 'โหลด ' + fmt(r.i1, 1) + ' A ≤ 80% ของพิกัด ' + fmt(m1.cap, 0) + ' A');
  setText('meter-3ph-sub', r.i3 <= 0 ? 'รอโหลด' : 'โหลด ' + fmt(r.i3, 1) + ' A/เฟส ≤ 80% ของพิกัด ' + fmt(m3.cap, 0) + ' A');
  drawChart(r);
}
function setText(id, txt) {
  var el = $(id);
  if (el) el.textContent = txt;
}
function drawChart(r) {
  var cv = $('demand-chart');
  if (!cv || typeof Chart === 'undefined') return;
  if (state.chart) { state.chart.destroy(); state.chart = null; }
  state.chart = new Chart(cv, {
    type: 'bar',
    data: {
      labels: r.rows.map(function (g) { return catName(g.cat); }),
      datasets: [{
        label: 'ดีมานด์ (kVA)',
        data: r.rows.map(function (g) { return Math.round(g.dem * 100) / 100; }),
        backgroundColor: '#3b82f6',
        borderColor: '#1d4ed8',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });
}function addItem(pr) {
  var p = proj();
  if (!p) { newProj(); p = proj(); }
  var found = false;
  p.items.forEach(function (it) {
    if (it.name === pr.name && it.cat === pr.cat) { it.qty += 1; found = true; }
  });
  if (!found) {
    p.items.push({
      id: uid(),
      name: pr.name,
      w: pr.btu ? acWatts(pr.btu) : (pr.w || 0),
      btu: pr.btu || null,
      cat: pr.cat,
      qty: 1,
      pf: (CATS[pr.cat] ? CATS[pr.cat].pf : 0.85),
      df: (CATS[pr.cat] ? CATS[pr.cat].df : 0.7)
    });
  }
  save();
  render();
}
function itemById(id) {
  var p = proj();
  for (var i = 0; i < (p ? p.items.length : 0); i++) {
    if (p.items[i].id === id) return p.items[i];
  }
  return null;
}
function removeItem(id) {
  var p = proj();
  if (!p) return;
  p.items = p.items.filter(function (x) { return x.id !== id; });
  save();
  render();
}
function openCustomModal() {
  var p = proj();
  if (!p) { toast('สร้างโปรเจกต์ก่อน'); return; }
  var name = prompt('ชื่ออุปกรณ์ (เช่น สปอตไลท์ 100W / เตาอบ):');
  if (!name) return;
  var w = nnum(prompt('กำลังไฟฟ้า (W):', '1000'));
  if (!(w > 0)) { toast('กำลังต้องมากกว่า 0'); return; }
  var catIdx = prompt('หมวด (0=แสงสว่าง 1=แอร์ 2=ทำน้ำอุ่น 3=ปั๊ม 4=EV/ลิฟต์ 5=อื่นๆ):', '5');
  var cats = Object.keys(CATS);
  var cat = cats[Math.min(Math.max(Math.floor(nnum(catIdx)), 0), 5)] || 'other';
  addItem({ name: String(name).trim(), w: w, cat: cat });
}
function pageInit() {
  load();
  if (state.projects.length === 0) {
    newProj();
    save();
  }
  bindEvents();
  render();
}
function bindEvents() {
  bindProjSelect();
  bindProjBtns();
  bindVolt();
  bindTableFields();
  bindExport();
  bindBackup();
  bindModal();
}
function bindProjSelect() {
  var sel = $('project-select');
  if (!sel) return;
  sel.addEventListener('change', function (e) {
    state.currentId = e.target.value;
    save();
    render();
  });
}
function bindProjBtns() {
  var bNew = $('btn-new-project');
  if (bNew) bNew.addEventListener('click', function () {
    newProj();
    save();
    render();
    toast('สร้างโปรเจกต์ใหม่แล้ว');
  });
  var bCustom = $('btn-add-custom');
  if (bCustom) bCustom.addEventListener('click', openCustomModal);
  var bRename = $('btn-rename-project');
  if (bRename) bRename.addEventListener('click', openRenameModal);
  var bDel = $('btn-delete-project');
  if (bDel) bDel.addEventListener('click', function () {
    var p = proj();
    if (!p) return;
    if (!confirm('ลบโปรเจกต์ "' + p.name + '" ?')) return;
    state.projects = state.projects.filter(function (x) { return x.id !== p.id; });
    state.currentId = state.projects.length ? state.projects[0].id : null;
    save();
    render();
  });
}
function bindVolt() {
  var v1 = $('set-v1'), v3 = $('set-v3');
  if (v1) v1.addEventListener('change', function () {
    var p = proj();
    if (p) { p.v1 = nnum(v1.value) || V1D; }
    save(); render();
  });
  if (v3) v3.addEventListener('change', function () {
    var p = proj();
    if (p) { p.v3 = nnum(v3.value) || V3D; }
    save(); render();
  });
}
function bindExport() {
  var bc = $('btn-export-csv');
  if (bc) bc.addEventListener('click', exportCSV);
  var bx = $('btn-export-xlsx');
  if (bx) bx.addEventListener('click', exportXLSX);
}
function bindBackup() {
  var bb = $('btn-backup');
  if (bb) bb.addEventListener('click', backupAll);
  var br = $('btn-restore');
  if (br) br.addEventListener('click', function () {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.addEventListener('change', function () {
      if (inp.files && inp.files[0]) restoreBackup(inp.files[0]);
    });
    document.body.appendChild(inp);
    inp.click();
    document.body.removeChild(inp);
  });
}
/* จัดการทุกช่องแก้ไขในตารางเครื่องใช้ */
function bindTableFields() {
  var tb = document.querySelector('#factor-table');
  if (!tb) return;
  tb.addEventListener('change', function (e) {
    var t = e.target;
    var p = proj();
    if (!p) return;
    if (t.classList.contains('delbtn')) {
      removeItem(t.getAttribute('data-id'));
      return;
    }
    var it = itemById(t.getAttribute('data-id'));
    if (!it) return;
    if (t.classList.contains('f-qty')) {
      it.qty = Math.max(1, Math.floor(nnum(t.value) || 1));
    } else if (t.classList.contains('f-btu')) {
      var b = Math.max(5000, Math.floor(nnum(t.value) || 12000));
      it.btu = b;
      it.w = acWatts(b);
      it.name = 'แอร์ ' + fmt(b, 0) + ' BTU';
    } else if (t.classList.contains('f-w')) {
      it.w = Math.max(0, nnum(t.value));
    } else if (t.classList.contains('f-pf')) {
      it.pf = Math.min(1, Math.max(0.1, nnum(t.value) || 0.85));
    } else if (t.classList.contains('f-df')) {
      it.df = Math.min(1.5, Math.max(0, nnum(t.value) / 100 || 0));
    }
    save();
    render();
  });
  tb.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList.contains('delbtn')) {
      removeItem(t.getAttribute('data-id'));
    }
  });
}'use strict';
/* ===== Export (Excel ขาวนจัดระเบียบหลายชีต) ===== */
var XLS = {
  hdrFill: '1F4E79',
  totFill: 'DDEBF7',
  sumFill: 'F2F2F2',
  titleFill: '205375'
};
function sheetSetCell(ws, r, c, v, s, z) {
  var addr = XLSX.utils.encode_cell({ r: r, c: c });
  if (ws[addr] == null) ws[addr] = { t: 's', v: '' };
  ws[addr].v = v;
  ws[addr].t = typeof v === 'number' ? 'n' : 's';
  if (s) ws[addr].s = s;
  if (z) ws[addr].z = z;
  return ws[addr];
}
function sheetFixRef(ws) {
  var maxR = 0, maxC = 0;
  for (var k in ws) {
    if (k.charAt(0) === '!' || !/^[A-Z]\d+$/.test(k)) continue;
    var code = ws[k];
    if (code == null || code.v === '' || code.v == null) continue;
    var m = k.match(/^([A-Z]+)(\d+)$/);
    var c = 0;
    for (var i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64);
    c--;
    var r = parseInt(m[2], 10) - 1;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  return ws;
}
function sheetRowFill(ws, r, cFrom, cTo, rgb) {
  var c;
  for (c = cFrom; c <= cTo; c++) {
    var addr = XLSX.utils.encode_cell({ r: r, c: c });
    if (ws[addr] == null) ws[addr] = { t: 's', v: '' };
    ws[addr].s = ws[addr].s || {};
    ws[addr].s.fill = { patternType: 'solid', fgColor: { rgb: rgb } };
  }
}
function sheetTitle(ws, r, cFrom, cTo, text) {
  sheetSetCell(ws, r, cFrom, text, {
    font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
    fill: { patternType: 'solid', fgColor: { rgb: XLS.titleFill } },
    alignment: { horizontal: 'left', vertical: 'center' }
  });
  sheetRowFill(ws, r, cFrom + 1, cTo, XLS.titleFill);
}
function sheetHeader(ws, r, cFrom, cTo) {
  sheetRowFill(ws, r, cFrom, cTo, XLS.hdrFill);
  var c;
  for (c = cFrom; c <= cTo; c++) {
    var addr = XLSX.utils.encode_cell({ r: r, c: c });
    if (ws[addr] == null) ws[addr] = { t: 's', v: '' };
    ws[addr].s = ws[addr].s || {};
    ws[addr].s.font = { bold: true, color: { rgb: 'FFFFFF' } };
    ws[addr].s.alignment = { horizontal: 'center' };
  }
}
/* ===== ชีต 1: สรุป ===== */
function sheetSummary(ws, p, r) {
  var m1 = pickMeter(METER_1PH, r.i1);
  var m3 = pickMeter(METER_3PH, r.i3);
  var w = [14, 16, 6, 16, 6, 16];
  ws['!cols'] = w.map(function (n) { return { wch: n }; });

  sheetTitle(ws, 0, 0, 5, 'สรุปการคำนวณขนาดมิเตอร์ (โหลด ≤ 80% ของพิกัด)');
  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });

  sheetSetCell(ws, 2, 0, 'โปรเจกต์', { bold: true });
  sheetSetCell(ws, 2, 1, p.name);
  sheetSetCell(ws, 2, 3, 'วันที่', { bold: true });
  sheetSetCell(ws, 2, 4, new Date().toLocaleDateString('th-TH'));

  sheetSetCell(ws, 3, 0, 'แรงดัน 1 เฟส', { bold: true });
  sheetSetCell(ws, 3, 1, p.v1 + ' V');
  sheetSetCell(ws, 3, 3, 'แรงดัน 3 เฟส', { bold: true });
  sheetSetCell(ws, 3, 4, p.v3 + ' V');

  sheetHeader(ws, 5, 0, 1);
  sheetSetCell(ws, 5, 0, 'รายการ');
  sheetSetCell(ws, 5, 1, 'ค่า');

  sheetSetCell(ws, 6, 0, 'กำลังติดตั้งรวม (kW)');
  sheetSetCell(ws, 6, 1, Math.round(r.connKw * 100) / 100, null, '#,##0.00');
  sheetSetCell(ws, 7, 0, 'กำลังติดตั้งรวม (kVA)');
  sheetSetCell(ws, 7, 1, Math.round(r.connKva * 100) / 100, null, '#,##0.00');
  sheetSetCell(ws, 8, 0, 'ดีมานด์รวม (kVA)');
  sheetSetCell(ws, 8, 1, Math.round(r.demand * 100) / 100, null, '#,##0.00');
  sheetSetCell(ws, 9, 0, 'กระแส 1 เฟส (A)');
  sheetSetCell(ws, 9, 1, Math.round(r.i1 * 10) / 10, null, '#,##0.0');
  sheetSetCell(ws, 10, 0, 'กระแส 3 เฟส (A/เฟส)');
  sheetSetCell(ws, 10, 1, Math.round(r.i3 * 10) / 10, null, '#,##0.0');

  sheetHeader(ws, 12, 0, 1);
  sheetSetCell(ws, 12, 0, 'มิเตอร์แนะนำ');
  sheetSetCell(ws, 12, 1, '(โหลด ≤ 80% พิกัด)');
  sheetSetCell(ws, 13, 0, '1 เฟส');
  sheetSetCell(ws, 13, 1, m1.amp, { bold: true });
  sheetSetCell(ws, 14, 0, '3 เฟส');
  sheetSetCell(ws, 14, 1, m3.amp, { bold: true });
  sheetSetCell(ws, 15, 0, 'หมายเหตุ');
  sheetSetCell(ws, 15, 1, 'เกินพิกัด = ต้องใช้หม้อแปลง / CT');
}
/* ===== ชีต 2: รายการเครื่องใช้ (แถวต่ออุปกรณ์) ===== */
function sheetItems(ws, p) {
  var head = ['ลำดับ', 'เครื่องใช้', 'หมวด', 'จำนวน', 'BTU', 'W/ชิ้น', 'PF', 'DF (%)', 'ติดตั้ง (kVA)', 'ดีมานด์ (kVA)'];
  ws['!cols'] = [6, 24, 16, 8, 9, 10, 7, 9, 12, 13].map(function (n) { return { wch: n }; });

  sheetTitle(ws, 0, 0, 9, 'รายการเครื่องใช้ไฟฟ้า');
  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } });

  head.forEach(function (h, i) {
    sheetSetCell(ws, 2, i, h);
  });
  sheetHeader(ws, 2, 0, 9);

  var row = 3;
  p.items.forEach(function (it, idx) {
    sheetSetCell(ws, row, 0, idx + 1);
    sheetSetCell(ws, row, 1, it.name);
    sheetSetCell(ws, row, 2, catName(it.cat));
    sheetSetCell(ws, row, 3, nnum(it.qty), null, '0');
    sheetSetCell(ws, row, 4, it.btu || '—', null, '0');
    sheetSetCell(ws, row, 5, it.cat === 'outlet' ? nnum(it.w) + ' VA/จุด' : nnum(it.w), null, it.cat === 'outlet' ? null : '#,##0');
    sheetSetCell(ws, row, 6, Math.round(itemPf(it) * 100) / 100, null, '0.00');
    sheetSetCell(ws, row, 7, Math.round(itemDf(it) * 1000) / 10, null, '0.0');
    sheetSetCell(ws, row, 8, Math.round(itemKva(it) * 100) / 100, null, '#,##0.00');
    sheetSetCell(ws, row, 9, Math.round(itemDemand(it) * 100) / 100, null, '#,##0.00');
    row++;
  });
  sheetRowFill(ws, row, 0, 9, XLS.totFill);
  sheetSetCell(ws, row, 1, 'รวม ' + p.items.length + ' รายการ', { bold: true });
  sheetSetCell(ws, row, 3, p.items.reduce(function (a, it) { return a + nnum(it.qty); }, 0), { bold: true }, '0');
}
/* ===== ชีต 3: ตารางโหลดตามหมวด ===== */
function sheetLoad(ws, r) {
  var head = ['หมวด', 'จำนวน', 'ติดตั้ง (W)', 'PF', 'ติดตั้ง (kVA)', 'DF (%)', 'ดีมานด์ (kVA)'];
  ws['!cols'] = [20, 9, 12, 8, 13, 9, 13].map(function (n) { return { wch: n }; });

  sheetTitle(ws, 0, 0, 6, 'ตารางโหลด / ดีมานด์แฟกเตอร์ (ตามหมวด)');
  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } });

  head.forEach(function (h, i) {
    sheetSetCell(ws, 2, i, h);
  });
  sheetHeader(ws, 2, 0, 6);

  var row = 3;
  r.rows.forEach(function (g) {
    sheetSetCell(ws, row, 0, catName(g.cat));
    sheetSetCell(ws, row, 1, g.qty, null, '0');
    sheetSetCell(ws, row, 2, Math.round(g.w), null, '#,##0');
    sheetSetCell(ws, row, 3, Math.round(g.pf * 100) / 100, null, '0.00');
    sheetSetCell(ws, row, 4, Math.round(g.connKva * 100) / 100, null, '#,##0.00');
    sheetSetCell(ws, row, 5, Math.round(g.df * 1000) / 10, null, '0.0');
    sheetSetCell(ws, row, 6, Math.round(g.dem * 100) / 100, null, '#,##0.00');
    row++;
  });
  sheetRowFill(ws, row, 0, 6, XLS.totFill);
  sheetSetCell(ws, row, 0, 'รวมทั้งหมด', { bold: true });
  sheetSetCell(ws, row, 1, r.rows.reduce(function (a, g) { return a + g.qty; }, 0), { bold: true }, '0');
  sheetSetCell(ws, row, 2, '', { bold: true });
  sheetSetCell(ws, row, 4, Math.round(r.connKva * 100) / 100, { bold: true }, '#,##0.00');
  sheetSetCell(ws, row, 6, Math.round(r.demand * 100) / 100, { bold: true }, '#,##0.00');
}
function buildWorkbook() {
  var p = proj();
  var r = totals();
  var wb = XLSX.utils.book_new();
  var ws1 = {};
  sheetSummary(ws1, p, r);
  sheetFixRef(ws1);
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป');
  var ws2 = {};
  sheetItems(ws2, p);
  sheetFixRef(ws2);
  XLSX.utils.book_append_sheet(wb, ws2, 'รายการเครื่องใช้');
  var ws3 = {};
  sheetLoad(ws3, r);
  sheetFixRef(ws3);
  XLSX.utils.book_append_sheet(wb, ws3, 'ตารางโหลด');
  return wb;
}
function exportCSV() {
  var p = proj();
  if (!p) { toast('สร้างโปรเจกต์ก่อน'); return; }
  var rows = buildRows();
  if (!rows.length) { toast('ยังไม่มีข้อมูล'); return; }
  var csv = toCSV(rows);
  download(p.name + '_load.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('ส่งออก CSV แล้ว');
}
function exportXLSX() {
  var p = proj();
  if (!p) { toast('สร้างโปรเจกต์ก่อน'); return; }
  if (typeof XLSX === 'undefined') { toast('ไม่พบชุด Excel'); return; }
  var r = totals();
  if (!p.items.length) { toast('ยังไม่มีข้อมูล'); return; }
  var wb = buildWorkbook();
  XLSX.writeFile(wb, p.name + '_load.xlsx');
  toast('ส่งออก Excel แล้ว (3 ชีต)');
}
function buildRows() {
  var p = proj();
  var r = totals();
  if (!p) return [];
  var aoa = [];
  aoa.push(['โปรเจกต์', p.name]);
  aoa.push(['แรงดัน 1 เฟส', p.v1 + ' V', 'แรงดัน 3 เฟส', p.v3 + ' V']);
  aoa.push(['หมายเหตุ: โหลดดีมานด์ต้องไม่เกิน 80% ของพิกัดมิเตอร์']);
  aoa.push([]);
  aoa.push(['รายการเครื่องใช้', 'หมวด', 'จำนวน', 'BTU', 'W/ชิ้น', 'PF', 'DF (%)', 'ติดตั้ง (kVA)', 'ดีมานด์ (kVA)']);
  p.items.forEach(function (it) {
    aoa.push([
      it.name,
      catName(it.cat),
      it.qty,
      it.btu || '',
      it.cat === 'outlet' ? it.w + ' VA/จุด' : it.w,
      fmt(itemPf(it), 2),
      fmt(itemDf(it) * 100, 0),
      fmt(itemKva(it), 3),
      fmt(itemDemand(it), 3)
    ]);
  });
  aoa.push([]);
  aoa.push(['หมวด', 'จำนวน', 'ติดตั้ง (W)', 'PF', 'ติดตั้ง (kVA)', 'DF (%)', 'ดีมานด์ (kVA)']);
  r.rows.forEach(function (g) {
    aoa.push([catName(g.cat), g.qty, fmt(g.w, 0), fmt(g.pf, 2), fmt(g.connKva, 2), fmt(g.df * 100, 0), fmt(g.dem, 2)]);
  });
  aoa.push([]);
  aoa.push(['รวม kW', fmt(r.connKw, 2)]);
  aoa.push(['รวม kVA', fmt(r.connKva, 2)]);
  aoa.push(['ดีมานด์ kVA', fmt(r.demand, 2)]);
  aoa.push(['กระแส 1 เฟส (A)', fmt(r.i1, 1)]);
  aoa.push(['กระแส 3 เฟส (A/เฟส)', fmt(r.i3, 1)]);
  aoa.push(['มิเตอร์ 1 เฟส (โหลด ≤ 80% พิกัด)', pickMeter(METER_1PH, r.i1).amp]);
  aoa.push(['มิเตอร์ 3 เฟส (โหลด ≤ 80% พิกัด)', pickMeter(METER_3PH, r.i3).amp]);
  return aoa;
}
function toCSV(rows) {
  return rows.map(function (row) {
    return row.map(function (c) {
      var s = c == null ? '' : String(c);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(',');
  }).join('\r\n');
}
function download(name, content, mime) {
  var blob = new Blob([content], { type: mime });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
var modalMode = 'new';
function openRenameModal() {
  var p = proj();
  if (!p) return;
  modalMode = 'rename';
  var title = $('project-modal-title');
  var inp = $('project-name-input');
  if (title) title.textContent = 'เปลี่ยนชื่อโครงการ';
  if (inp) { inp.value = p.name; inp.focus(); inp.select(); }
  var ov = $('project-modal');
  if (ov) ov.classList.remove('hidden');
}
function bindModal() {
  var ov = $('project-modal');
  if (!ov) return;
  var cancel = $('btn-project-cancel');
  var ok = $('btn-project-ok');
  if (cancel) cancel.addEventListener('click', closeModal);
  if (ok) ok.addEventListener('click', function () {
    var p = proj();
    if (!p) return;
    var inp = $('project-name-input');
    var name = inp ? String(inp.value).trim() : '';
    if (!name) { toast('ใส่ชื่อโครงการ'); return; }
    p.name = name;
    save();
    render();
    closeModal();
  });
  ov.addEventListener('click', function (e) {
    if (e.target === ov) closeModal();
  });
}
function closeModal() {
  var ov = $('project-modal');
  if (ov) ov.classList.add('hidden');
}
function backupAll() {
  try {
    var payload = {
      app: STORE_KEY,
      exported: new Date().toISOString(),
      projects: state.projects
    };
    download('pea-meter-backup.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('สำรองข้อมูลเสร็จ');
  } catch (e) {
    toast('สำรองข้อมูลล้มเหลว');
  }
}
function restoreBackup(file) {
  var reader = new FileReader();
  reader.onload = function (ev) {
    try {
      var d = JSON.parse(ev.target.result);
      if (d && d.app === STORE_KEY && Array.isArray(d.projects)) {
        state.projects = d.projects;
        state.currentId = d.projects.length ? d.projects[0].id : null;
        save();
        render();
        toast('กู้คืน ' + d.projects.length + ' โครงการแล้ว');
      } else {
        toast('ไฟล์ไม่ใช่ข้อมูลสำรองของเครื่องมือนี้');
      }
    } catch (e) {
      toast('อ่านไฟล์ไม่ได้');
    }
  };
  reader.readAsText(file);
}
function toast(msg, ms) {
  var el = $('toast');
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () {
    el.classList.add('hidden');
    el.classList.remove('show');
  }, ms || 2200);
}
document.addEventListener('DOMContentLoaded', pageInit);