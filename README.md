# 🚡 SIMTELE-RISK | Proyecto de Métodos Numéricos

**Universidad:** Universidad Mayor de San Andrés (UMSA)  
**Carrera:** Informática  
**Asignatura:** Métodos Numéricos  
**Menciones del equipo:** Ingeniería de Sistemas e Inteligencia Artificial  
**Gestión:** 2026

> [!IMPORTANT]
> **Aviso académico:** SIMTELE-RISK es una plataforma educativa inspirada en el transporte por cable de La Paz, Bolivia. Todos los datos, parámetros y escenarios son sintéticos e hipotéticos. No utiliza telemetría real, no describe fallas verificadas de Mi Teleférico y no debe emplearse para tomar decisiones operativas de seguridad o mantenimiento.

## 🌐 Aplicación web

| Acceso | Enlace |
|---|---|
| **Semana 2 — Versión integrada 2.1** | [Abrir aplicación](https://yancode31.github.io/Proyecto-MetodosNumericos/semana2/) |
| Semana 1 | [Consultar prototipo](https://yancode31.github.io/Proyecto-MetodosNumericos/semana1/) |
| Página principal | [SIMTELE-RISK](https://yancode31.github.io/Proyecto-MetodosNumericos/) |
| Código fuente | [Repositorio GitHub](https://github.com/yancode31/Proyecto-MetodosNumericos) |

## 📖 Descripción

**SIMTELE-RISK** permite formular, resolver, simular y comparar modelos numéricos de cuatro casos hipotéticos relacionados con el transporte por cable. Integra parámetros configurables, escenarios experimentales, soluciones de referencia, tablas de iteraciones, gráficos de resultados y análisis de errores.

El proyecto combina la implementación de algoritmos numéricos con una arquitectura web que permite conservar y reproducir experimentos, y técnicas complementarias de Inteligencia Artificial para estudiar la reconstrucción de señales y la incertidumbre asociada al ruido.

### Objetivo general

Desarrollar una aplicación web integrada que implemente y compare métodos numéricos en cuatro casos de estudio, con experimentos reproducibles, persistencia de resultados y análisis cuantitativo de sus errores.

### Objetivos específicos

- Formular modelos matemáticos con variables, unidades, hipótesis y parámetros documentados.
- Implementar métodos de sistemas lineales, raíces, interpolación, integración y ecuaciones diferenciales ordinarias.
- Analizar errores absolutos, relativos y porcentuales, residuales, convergencia y sensibilidad.
- Comparar los escenarios NORMAL, ESTRÉS y MAL CONDICIONADO.
- Guardar, consultar, recuperar, relanzar y verificar simulaciones.
- Diferenciar las conclusiones numéricas de las interpretaciones del fenómeno modelado.
- Integrar aportes de Ingeniería de Sistemas e Inteligencia Artificial sin sustituir los métodos numéricos obligatorios.

## 🧩 Módulos de estudio

| N.º | Caso de estudio | Modelo o finalidad | Métodos principales |
|---|---|---|---|
| 1 | Detención de emergencia | Tiempo, velocidad y distancia de frenado | RK2, RK4; bisección, Newton-Raphson, secante; trapecio, Simpson y Romberg |
| 2 | Deterioro mecánico y mantenimiento | Umbral hipotético de deterioro y calibración | Bisección, Newton-Raphson, secante; Jacobi, Gauss-Seidel, LU y gradiente conjugado |
| 3 | Oscilaciones por viento | Sistema masa–resorte–amortiguador | RK2, RK4; trapecio, Simpson y Romberg |
| 4 | Reconstrucción de señales de sensores | Recuperación de muestras faltantes y efecto del ruido | Lagrange, Newton por diferencias divididas y spline cúbico natural; k-NN complementario |

La **teoría de errores es transversal**. El panel de comparación, el historial, la base de datos y el Laboratorio IA son funciones de apoyo, no casos de estudio adicionales.

### Modelos de referencia

| Caso | Modelo |
|---|---|
| Detención | `v(t) = v₀ − at`; `x(t) = x₀ + v₀t − at²/2` |
| Deterioro | `D(t) = D₀ + αt + βt²` |
| Oscilaciones | `mx″(t) + cx′(t) + kx(t) = F(t)` |
| Sensores | `s(t) = A sin(t)` con muestras observadas y puntos de evaluación ocultos |

### Escenarios experimentales

- **NORMAL:** condiciones sintéticas nominales y configuración numérica de referencia.
- **ESTRÉS:** condiciones más exigentes dentro de las hipótesis del modelo, para comparar resultados y sensibilidad.
- **MAL CONDICIONADO:** subexperimentos que evidencian sensibilidad matemática, como matrices con números de condición elevados o nodos de interpolación desfavorables.

Se consideran **12 combinaciones de caso y escenario**. Una condición físicamente más exigente no implica necesariamente mal condicionamiento matemático.

## 📅 Avance por semanas

| Semana | Alcance | Puntaje de la consigna | Estado |
|---|---|---:|---|
| 1 | Modelos, teoría de errores, sistemas lineales y prototipo | 6 | Aprobada: 6/6 |
| 2 | Integración matemática, escenarios, gráficos y persistencia | 9 | Versión 2.1 preparada para presentación |
| 3 | Validación final, conclusiones, informe, video y defensa | 10 | Pendiente |
| | **Total** | **25** | |

### ✅ Semana 1 — Modelos y primeros algoritmos

- Prototipo web con los cuatro casos y escenarios configurables.
- Sistemas lineales de dimensión 4×4 con solución de referencia: Jacobi, Gauss-Seidel, LU y gradiente conjugado.
- Teoría de errores, primeras comparaciones, tablas y gráficos.
- Historial local, DER inicial, script SQL y pruebas automatizadas.

La persistencia de esta versión se realiza en el navegador; el script SQL constituye el diseño inicial.

### 🚀 Semana 2 — Integración matemática, datos e IA

La versión **2.1.0** integra las dos propuestas del equipo y conserva los vínculos y funcionalidades de la aplicación anterior.

#### Cobertura matemática

- **Raíces:** bisección, Newton-Raphson y secante.
- **Interpolación:** Lagrange, Newton por diferencias divididas y splines cúbicos naturales.
- **Integración:** trapecio compuesto, Simpson 1/3 compuesto y Romberg.
- **EDO:** Runge-Kutta de segundo orden (punto medio) y cuarto orden (RK2/RK4).
- **Sistemas lineales:** conservación de los cuatro métodos de Semana 1.
- Tres escenarios por módulo, soluciones de referencia, tablas, errores y al menos dos gráficos por caso.
- Interpretación numérica y del problema diferenciadas.

#### Mejoras de la versión integrada

| Mejora | Funcionalidad |
|---|---|
| Dashboard de datos | Visualiza registros realmente almacenados: ID, fecha, caso, escenario, parámetros y resultado |
| Historial | Busca, abre, recupera, relanza y exporta simulaciones en CSV/JSON |
| Verificación de experimentos | Repite el cálculo con los parámetros guardados y contrasta resultados, referencias, tablas y gráficos |
| Regresión k-NN | Compara la reconstrucción de sensores con los tres interpolantes obligatorios |
| Monte Carlo | Analiza la incertidumbre mediante ruido gaussiano sintético, ensayos configurables y semilla reproducible |
| Persistencia | Conserva el almacenamiento de Semana 2 (`SIMTELE_RISK_S2`) y el esquema SQLite de seis entidades |
| Calidad | Añade pruebas de integración, reproducibilidad y detección de cambios en registros |

## 👥 Enfoque 

| Ingeniería de Sistemas | Inteligencia Artificial |
|---|---|
| Arquitectura y separación de interfaz, cálculo y persistencia | Preparación de señales sintéticas y datos de evaluación |
| Diseño relacional, DER y script SQL | Regresión supervisada k-NN (`k = 2`) |
| API local, IndexedDB y SQLite | Comparación con Lagrange, Newton y spline cúbico |
| Validación de parámetros y gestión de errores | Métricas MAE y RMSE en puntos no usados para el ajuste |
| Dashboard, historial y trazabilidad | Monte Carlo, ruido sintético e incertidumbre |
| Pruebas automatizadas y reproducibilidad | Interpretación de resultados y limitaciones del modelo |

Ambos integrantes deben comprender los fundamentos matemáticos y defender los cuatro casos, además de explicar los aportes desde su propia mención.

### 🧠 Laboratorio IA

La regresión **k-NN (k = 2)** se utiliza como comparación complementaria de los métodos de interpolación. Los datos observados se separan de los puntos sintéticos de evaluación. La precisión se mide con:

- **MAE:** error absoluto medio.
- **RMSE:** raíz del error cuadrático medio.

La ampliación **Monte Carlo** repite el experimento con perturbaciones gaussianas independientes sobre las muestras observadas.

| Configuración | Valores |
|---|---|
| Número de ensayos | 20–2000 (200 por defecto) |
| Desviación del ruido sintético, σ | 0–0.5 |
| Semilla | Entera y configurable |
| Métodos comparados | Lagrange, Newton dividido, spline natural y k-NN |
| Resultados | MAE medio, percentil 95 del MAE, dispersión y curvas de error |

El percentil 95 describe la distribución empírica del error bajo las perturbaciones elegidas. No representa una probabilidad de falla o accidente. No se presupone que k-NN supere a los interpolantes.
## 💻 Tecnologías utilizadas

| Tecnología | Uso |
|---|---|
| HTML5 y CSS3 | Interfaz web adaptable |
| JavaScript (ES Modules) | Métodos numéricos, gráficos, navegación e IA |
| IndexedDB / localStorage | Persistencia en el navegador |
| Python 3.10+ | Servidor y API local |
| SQLite / SQL | Base de datos relacional, consultas y relaciones |
| Node.js | Ejecución de pruebas automatizadas |
| Git y GitHub | Control de versiones |
| GitHub Pages | Publicación de la aplicación estática |
