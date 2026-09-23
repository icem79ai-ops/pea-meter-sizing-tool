var state = {
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
}