function itemPf(it) {
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
}