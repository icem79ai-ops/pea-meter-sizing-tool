function catName(cat) {
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
}