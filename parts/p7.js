'use strict';
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