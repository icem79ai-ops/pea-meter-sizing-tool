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
var METER_UTIL = 0.8; /* โหลดสูงสุดที่ยอมรับ = 80% ของพิกัดมิเตอร์ */