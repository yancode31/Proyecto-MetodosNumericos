/** EDO de primer orden en forma vectorial y' = f(t, y): RK2 punto medio (variante declarada) y RK4 clásico. */
export function rkStep(order, f, t, y, h) {
  const add = (a, b, s) => a.map((v, i) => v + s * b[i]);
  const k1 = f(t, y);
  if (order === 2) { const k2 = f(t + h / 2, add(y, k1, h / 2)); return add(y, k2, h); }
  const k2 = f(t + h / 2, add(y, k1, h / 2)), k3 = f(t + h / 2, add(y, k2, h / 2)), k4 = f(t + h, add(y, k3, h));
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** Integra en [0,T] con N = ceil(T/h) pasos iguales. Devuelve filas [t, ...y]. */
export function integrate(order, f, y0, T, h) {
  const N = Math.max(1, Math.ceil(T / h - 1e-12)), dt = T / N, out = [[0, ...y0]]; let y = y0.slice();
  for (let i = 0; i < N; i++) { y = rkStep(order, f, i * dt, y, dt); out.push([(i + 1) * dt, ...y]); }
  return { rows: out, h: dt, steps: N };
}
export const maxAbsError = (rows, col, ref) => rows.reduce((m, r) => Math.max(m, Math.abs(r[col] - ref(r[0]))), 0);
