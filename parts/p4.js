function render() {
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
}