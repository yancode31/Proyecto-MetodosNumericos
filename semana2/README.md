# SIMTELE-RISK — Semana 2
**Menciones del equipo:** Ingeniería de Sistemas e Inteligencia Artificial.  

> Proyecto académico. Todos los parámetros, señales, fallas y casos son sintéticos. No se utilizan datos operativos de Mi Teleférico ni se emiten recomendaciones de seguridad reales.

## Alcance de Semana 2: 

| Requisito oficial | Evidencia en la aplicación |
|---|---|
| Bisección, Newton-Raphson, secante | Módulos 1 y 2, tablas de iteraciones y convergencia |
| Lagrange, Newton dividido, splines cúbicos | Módulo 4, comparación en dos muestras ocultas y evaluación extendida |
| Trapecio, Simpson 1/3, Romberg | Módulos 1 y 3; integración de velocidad y de x(t)² |
| EDO RK2 y RK4 | Módulos 1 y 3, contraste contra referencias |
| 4 módulos ejecutan NORMAL | Botones y valores nominales por módulo |
| Tres escenarios por módulo | NORMAL, ESTRÉS, MAL CONDICIONADO; 12 experimentos predefinidos |
| Tablas, errores y dos gráficos por módulo | Cada módulo incluye ≥2 tablas y ≥2 gráficos |
| Persistencia y recuperación | IndexedDB (GitHub Pages) **o SQLite (ejecución local con Python)** |
| Corrección del docente | Tabla de datos realmente guardados en inicio y pantalla «Base de datos» |
| Enfoque dual de menciones | Arquitectura, BD y pruebas (Sistemas); k-NN, evaluación e interpretación (IA) |


## Módulos y métodos

| Módulo | Referencia | Métodos obligatorios o pertinentes |
|---|---|---|
| 1. Detención | `v(t)=v0-at`, `x(t)=v0t-at²/2` | Bisección, Newton, secante; RK2/RK4; trapecio, Simpson, Romberg |
| 2. Deterioro | `D(t)=D0+αt+βt²` | Raíces; calibración SPD 4×4 con Jacobi, Gauss-Seidel, LU y gradiente conjugado |
| 3. Oscilaciones | `mx''+cx'+kx=F(t)` | RK2, RK4; integración de `∫x²dt` por trapecio, Simpson y Romberg |
| 4. Sensores | `s(t)=A sen(t)` | Lagrange, Newton dividido y spline natural; comparación **adicional** con k-NN |

**Importante sobre escenarios mal condicionados:** un número de condición grande, una raíz múltiple o nodos mal escalados no demuestran riesgos físicos. Los ensayos mal condicionados son subexperimentos matemáticos explícitos.

## Aportes de las dos menciones

### Ingeniería de Sistemas

- Diseño de la arquitectura del sistema, separación de interfaz / algoritmos / persistencia.
- Navegación integrada de cuatro módulos, validaciones, reglas de reproducibilidad y calidad.
- DER, esquema SQL de seis tablas, servidor Python, API JSON, SQLite local y respaldo IndexedDB en la web pública.
- Evidencias de guardado, lectura, reejecución, pruebas unitarias y exportación de datos.

### Inteligencia Artificial

- Aplicación real, pero **complementaria**, de k-NN de regresión (`k=2`) sobre muestras de sensores sintéticos.
- Separación de cuatro nodos observados (entrenamiento) y 41 puntos sintéticos ocultos (evaluación).
- Cálculo de MAE y RMSE de k-NN y de los tres interpolantes numéricos.
- Comparación de la distorsión bajo ruido, análisis de limitaciones y no extrapolación a datos reales.

No se presenta el modelo k-NN como detector de averías reales ni como un sistema predictivo industrial entrenado.
