function addItem(pr) {
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
}