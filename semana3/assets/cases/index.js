/** Registro de los cuatro casos, escenarios, validación y despacho de simulaciones. */
import * as c1 from './case1.js';
import * as c2 from './case2.js';
import * as c3 from './case3.js';
import * as c4 from './case4.js';
import { SCENARIOS } from './common.js';
export { SCENARIOS };
export { nfmt } from '../core/errors.js';

const MODS = [null, c1, c2, c3, c4];
export const CASES = MODS.slice(1).map((m) => m.meta);
export const PARAM_DEFS = Object.fromEntries(MODS.slice(1).map((m) => [m.meta.id, m.params]));
export const PRESETS = Object.fromEntries(MODS.slice(1).map((m) => [m.meta.id, m.presets]));
export const ENGINE_VERSION = 'semana3-v1.0';

export function validate(caseId, scenario, params) {
  if (!SCENARIOS.includes(scenario)) throw Error('Escenario no válido.');
  const defs = PARAM_DEFS[caseId]; if (!defs) throw Error('Caso no válido.');
  for (const d of defs) {
    const v = params[d.key];
    if (d.type === 'select') { if (!d.options.some(([val]) => Number(val) === Number(v))) throw Error(`Selecciona un valor válido en «${d.label}».`); continue; }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < d.min - 1e-12 || v > d.max + 1e-12) throw Error(`Verifica «${d.label}»: debe estar entre ${d.min} y ${d.max} ${d.unit}.`);
  }
  MODS[caseId].validate(params, scenario);
}
export function simulateCase(caseId, scenario, params) {
  const id = Number(caseId); validate(id, scenario, params);
  const result = MODS[id].simulate(scenario, params);
  return { ...result, caseId: id, scenario, params: { ...params }, model: CASES[id - 1].model, engine: ENGINE_VERSION };
}
export const defaultParams = (caseId, scenario) => ({ ...PRESETS[caseId][scenario] });

/** Cobertura de métodos exigida por la consigna → dónde se ejecuta cada uno. */
export const COVERAGE = [
  { family: 'Errores (transversal)', method: 'Absoluto, relativo, porcentual, residual, sensibilidad', modules: [1, 2, 3, 4] },
  { family: 'Sistemas lineales', method: 'Jacobi', modules: [2, 3, 4] }, { family: 'Sistemas lineales', method: 'Gauss-Seidel', modules: [2, 3] },
  { family: 'Sistemas lineales', method: 'LU', modules: [2, 3, 4] }, { family: 'Sistemas lineales', method: 'Gradiente conjugado', modules: [2, 3] },
  { family: 'Sistemas lineales', method: 'Solución directa de referencia', modules: [2, 3, 4] },
  { family: 'Interpolación', method: 'Lagrange', modules: [4] }, { family: 'Interpolación', method: 'Newton (diferencias divididas)', modules: [4] }, { family: 'Interpolación', method: 'Spline cúbico natural', modules: [4] },
  { family: 'Raíces', method: 'Bisección', modules: [1, 2, 4] }, { family: 'Raíces', method: 'Newton-Raphson', modules: [1, 2, 4] }, { family: 'Raíces', method: 'Secante', modules: [1, 2, 4] },
  { family: 'Integración', method: 'Trapecio compuesto', modules: [1, 2, 3] }, { family: 'Integración', method: 'Simpson 1/3 compuesto', modules: [1, 2, 3] }, { family: 'Integración', method: 'Romberg', modules: [1, 2, 3] },
  { family: 'EDO', method: 'Runge-Kutta 2.º orden (punto medio)', modules: [1, 3] }, { family: 'EDO', method: 'Runge-Kutta 4.º orden', modules: [1, 3] },
];
