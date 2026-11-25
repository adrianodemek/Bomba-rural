// Formata números grandes: 1234 → "1,23K".
const UNITS = [['K', 1e3], ['M', 1e6], ['B', 1e9], ['T', 1e12]];

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  let suffix = '';
  let v = n;
  for (const [s, val] of UNITS) {
    if (n >= val) { suffix = s; v = n / val; }
  }
  const str = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.floor(v));
  return str.replace('.', ',') + suffix;
}

// Versão curta para números redondos: "50,0K" → "50K", "6,20B" → "6,2B".
export function fmtShort(n) {
  return fmt(n).replace(/(,\d*?)0+([KMBT])$/, '$1$2').replace(/,([KMBT])$/, '$1');
}
