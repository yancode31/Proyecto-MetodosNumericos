/** Integración numérica: trapecio compuesto, Simpson 1/3 compuesto, Romberg y referencia Gauss-Legendre. */
export function trapezoid(f, a, b, n) {
  const h = (b - a) / n; let s = 0.5 * (f(a) + f(b));
  for (let i = 1; i < n; i++) s += f(a + i * h);
  return h * s;
}
export function simpson(f, a, b, n) {
  if (n % 2) n += 1;
  const h = (b - a) / n; let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (h / 3) * s;
}
/** Tabla de Romberg R[i][j]; devuelve la tabla completa y el mejor valor. */
export function romberg(f, a, b, levels = 6) {
  const R = [];
  for (let i = 0; i < levels; i++) {
    const n = 2 ** i, row = [];
    row[0] = trapezoid(f, a, b, n);
    for (let j = 1; j <= i; j++) row[j] = row[j - 1] + (row[j - 1] - R[i - 1][j - 1]) / (4 ** j - 1);
    R.push(row);
  }
  return { table: R, value: R.at(-1).at(-1), evaluations: 2 ** (levels - 1) + 1 };
}
const GL10 = {
  x: [0.1488743389816312, 0.4333953941292472, 0.6794095682990244, 0.8650633666889845, 0.9739065285171717],
  w: [0.2955242247147529, 0.2692667193099963, 0.2190863625159820, 0.1494513491505806, 0.0666713443086881],
};
/** Referencia de alta precisión: Gauss-Legendre de 10 puntos compuesta en `panels` subintervalos. */
export function gaussLegendre(f, a, b, panels = 200) {
  const h = (b - a) / panels; let total = 0;
  for (let p = 0; p < panels; p++) {
    const lo = a + p * h, mid = lo + h / 2, half = h / 2; let s = 0;
    for (let i = 0; i < 5; i++) s += GL10.w[i] * (f(mid - half * GL10.x[i]) + f(mid + half * GL10.x[i]));
    total += s * half;
  }
  return total;
}
export function referenceIntegral(f, a, b) {
  const v1 = gaussLegendre(f, a, b, 200), v2 = gaussLegendre(f, a, b, 400);
  return { value: v2, check: Math.abs(v1 - v2) };
}
/** Integral de datos tabulados (malla uniforme) por trapecio y Simpson. */
export function trapezoidData(y, h) { let s = 0.5 * (y[0] + y.at(-1)); for (let i = 1; i < y.length - 1; i++) s += y[i]; return h * s; }
export function simpsonData(y, h) {
  const n = y.length - 1; if (n % 2) return NaN;
  let s = y[0] + y[n]; for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * y[i];
  return (h / 3) * s;
}
