# 🚡 SIMTELE-RISK | Proyecto de Métodos Numéricos

**Universidad:** Universidad Mayor de San Andrés (UMSA)  
**Carrera:** Informática  
**Asignatura:** Métodos Numéricos  
**Menciones del equipo:** Ingeniería de Sistemas e Inteligencia Artificial  


> [!IMPORTANT]
> **Aviso académico.** SIMTELE-RISK es una plataforma de simulación educativa inspirada en un sistema de transporte por cable de La Paz, Bolivia. Utiliza **datos, parámetros y escenarios sintéticos**. No recibe telemetría real, no describe fallas verificadas de Mi Teleférico y **no debe utilizarse para tomar decisiones operativas de seguridad o mantenimiento**.

## 🌐 Aplicación web y repositorio

| Acceso | Enlace |
|---|---|
| 🚀 **Aplicación — Semana 2 (versión más reciente)** | [Abrir Semana 2](https://yancode31.github.io/Proyecto-MetodosNumericos/semana2/) |
| ✅ **Aplicación — Semana 1 | [Abrir Semana 1](https://yancode31.github.io/Proyecto-MetodosNumericos/semana1/) |
| 💻 **Código fuente** | [Repositorio GitHub](https://github.com/yancode31/Proyecto-MetodosNumericos) |

## 📖 Descripción del proyecto

**SIMTELE-RISK** es una aplicación web que permite **formular, resolver, simular y comparar métodos numéricos** en cuatro casos hipotéticos asociados al transporte por cable. Cada caso cuenta con parámetros modificables, escenarios experimentales, resultados verificables y herramientas de análisis de errores.

El objetivo del trabajo no es únicamente mostrar gráficas o una interfaz atractiva, sino **comprobar la precisión matemática, analizar convergencia y sensibilidad, conservar las simulaciones y explicar qué significan los resultados dentro de los límites del modelo**.

### Objetivo general

Desarrollar una plataforma web integrada que aplique y compare métodos numéricos en cuatro casos de estudio, con pruebas reproducibles, visualización de resultados y almacenamiento persistente de experimentos.

### Objetivos específicos

- Plantear modelos matemáticos con variables, unidades, hipótesis y parámetros documentados.
- Implementar y comparar métodos de sistemas lineales, raíces, interpolación, integración y ecuaciones diferenciales ordinarias.
- Calcular errores absolutos, relativos y porcentuales; residuales, convergencia y sensibilidad.
- Comparar los escenarios **NORMAL**, **ESTRÉS** y **MAL CONDICIONADO**.
- Guardar, buscar, consultar, recuperar y relanzar simulaciones.
- Diferenciar la **conclusión numérica** de la **interpretación del problema modelado**.
- Integrar aportes de **Ingeniería de Sistemas** e **Inteligencia Artificial**, sin sustituir los métodos numéricos obligatorios.

## 🧩 Los cuatro módulos de estudio

| Módulo | Caso de estudio | Modelo / finalidad | Métodos principales |
|---|---|---|---|
| **1** | Detención de emergencia | Velocidad, tiempo y distancia de frenado de una cabina hipotética | RK2, RK4; bisección, Newton-Raphson y secante; trapecio, Simpson y Romberg |
| **2** | Deterioro mecánico y mantenimiento | Tiempo de llegada a un umbral sintético de deterioro; calibración de parámetros | Bisección, Newton-Raphson, secante; Jacobi, Gauss-Seidel, LU y gradiente conjugado |
| **3** | Oscilaciones por viento | Sistema masa–resorte–amortiguador con excitación hipotética | RK2, RK4; trapecio, Simpson y Romberg |
| **4** | Reconstrucción de señales de sensores | Recuperación de muestras faltantes y análisis del efecto del ruido | Lagrange, Newton por diferencias divididas y splines cúbicos; comparación complementaria con k-NN |

### Escenarios experimentales

- **NORMAL:** parámetros nominales sintéticos y configuración numérica de referencia.
- **ESTRÉS:** condiciones más exigentes dentro de las hipótesis del modelo; permite estudiar cambios de resultados y errores.
- **MAL CONDICIONADO:** subexperimento diseñado para mostrar sensibilidad numérica, por ejemplo una matriz con número de condición elevado o nodos de interpolación desfavorables.

**Un problema matemáticamente mal condicionado no equivale necesariamente a un riesgo físico.** Los resultados no constituyen una evaluación operativa real.

### ✅ Semana 1 — Prototipo y bases matemáticas

- Cuatro módulos de estudio y escenarios configurables.
- Ejemplos numéricos, soluciones de referencia, tablas y gráficos.
- Métodos de sistemas lineales: **Jacobi, Gauss-Seidel, LU y gradiente conjugado**.
- Cálculo transversal de errores y residuales.
- Historial local de experimentos, DER inicial, script SQL y pruebas automatizadas.

**Persistencia de Semana 1:** IndexedDB, con alternativa local cuando corresponde; el SQL es un esquema inicial, no una conexión activa a un servidor.

### 🚀 Semana 2 — Integración matemática, persistencia e IA

**Integración matemática**

- **Raíces:** bisección, Newton-Raphson y secante.
- **Interpolación:** Lagrange, Newton por diferencias divididas y splines cúbicos.
- **Integración:** trapecio compuesto, Simpson 1/3 compuesto y Romberg.
- **EDO:** Runge-Kutta de segundo y cuarto orden (RK2 y RK4).
- Ejecución de los cuatro casos en condiciones nominales; escenarios NORMAL, ESTRÉS y MAL CONDICIONADO, con tablas, gráficos y métricas de error.
- Vista **«Base de datos»** y tabla de las simulaciones realmente guardadas.
- Visualización de **ID, fecha, módulo, escenario, parámetros y resultados**.
- Funciones para **buscar, abrir, recuperar, relanzar y exportar** experimentos (CSV/JSON).
- Recuperación de parámetros, resultados y gráficas para demostrar la persistencia después de actualizar la página.
- Opción de cargar demostraciones sintéticas y, cuando corresponda, importar registros de Semana 1.

**Aporte complementario de Inteligencia Artificial**

- Laboratorio de sensores con **regresión k-NN (`k = 2`)**.
- Comparación de la reconstrucción de señales frente a **Lagrange, Newton y splines cúbicos**.
- Separación de nodos observados y puntos sintéticos de evaluación.
- Medición de **MAE** (error absoluto medio) y **RMSE** (raíz del error cuadrático medio).

> k-NN es una **comparación adicional**, no reemplaza los métodos obligatorios ni se presenta como detector de averías reales.

## 👥 Aporte de ambas menciones

| Ingeniería de Sistemas | Inteligencia Artificial |
|---|---|
| Arquitectura, interfaz y organización de módulos | Preparación de datos sintéticos de sensores |
| Validación de entradas, persistencia y recuperación | Implementación del modelo k-NN de regresión |
| Modelo entidad–relación, script SQL y API local | Separación de observaciones y datos de evaluación |
| Pruebas, reproducibilidad y trazabilidad de simulaciones | Comparación de predicciones con interpolaciones numéricas |
| Dashboard, historial y exportación de resultados | Evaluación por MAE/RMSE e interpretación de limitaciones |

**Ambas menciones deben comprender y defender los fundamentos matemáticos comunes** del proyecto.

## 💾 Almacenamiento y base de datos

La Semana 2 dispone de **dos modos de almacenamiento**, según cómo se ejecute:

| Modo | ¿Dónde funciona? | ¿Qué guarda? | ¿Se comparte entre computadoras? |
|---|---|---|---|
| **IndexedDB** | GitHub Pages / navegador | Simulaciones e historial persistentes en ese navegador | **No** |
| **SQLite + servidor Python** | Ejecución local mediante `server.py` | Simulaciones en `database/simtele.db` con tablas relacionales | **No**, salvo que se despliegue un servidor accesible para otros equipos |

La base SQLite local utiliza estas **seis entidades**: `caso_estudio`, `escenario`, `simulacion`, `ejecucion_metodo`, `iteracion_resultado` y `resultado_resumen`.

**GitHub Pages publica archivos estáticos: no ejecuta Python ni SQLite.** En la versión pública, la pantalla «Base de datos» muestra el contenido real de **IndexedDB de ese navegador**, no las seis tablas del servidor local. El historial puede perderse al borrar los datos del sitio.

## 💻 Tecnologías utilizadas

| Tecnología | Uso en el proyecto |
|---|---|
| **HTML5 y CSS3** | Estructura, presentación y diseño adaptable |
| **JavaScript (ES Modules)** | Interfaz, simulaciones, gráficos y algoritmos numéricos |
| **IndexedDB** | Persistencia local de la versión pública |
| **Python 3.10+** | Servidor local y API de la Semana 2 |
| **SQLite / SQL** | Base de datos relacional local; estructura DER |
| **k-NN** | Modelo complementario de regresión para sensores sintéticos |
| **Node.js** | Pruebas automatizadas con `npm test` |
| **Git y GitHub** | Versionado y organización de entregas |
| **GitHub Pages** | Publicación gratuita de la versión estática |
