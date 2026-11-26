# 🚡 SIMTELE-RISK | Proyecto de Métodos Numéricos

**Universidad:** Universidad Mayor de San Andrés (UMSA)  
**Facultad:** Ciencias Puras y Naturales  
**Carrera:** Informática  
**Asignatura:** Métodos Numéricos  
**Menciones del equipo:** Ingeniería de Sistemas e Inteligencia Artificial y Ciencia de Datos  
**Gestión:** 2026  
**Versión:** 3.0 · Entrega final (Semanas 1, 2 y 3)

> [!IMPORTANT]
> **Aviso académico:** SIMTELE-RISK es una simulación educativa inspirada en el transporte por cable de La Paz, Bolivia. Todos los datos, parámetros y escenarios son **sintéticos e hipotéticos**. No utiliza telemetría real, no describe fallas verificadas de Mi Teleférico y **no debe emplearse para decisiones operativas de seguridad o mantenimiento**.

## 🌐 Aplicación y documentación

| Recurso | Enlace |
|---|---|
| **🚀 Aplicación final — Semana 3** | [Abrir SIMTELE-RISK](https://yancode31.github.io/Proyecto-MetodosNumericos/) |
| Semana 2 — Entrega anterior | [Consultar Semana 2](https://yancode31.github.io/Proyecto-MetodosNumericos/semana2/) |
| Semana 1 — Prototipo inicial | [Consultar Semana 1](https://yancode31.github.io/Proyecto-MetodosNumericos/semana1/) |
| Repositorio | [Ver código en GitHub](https://github.com/yancode31/Proyecto-MetodosNumericos) |
| Informe académico final | [Ver informe PDF](docs/Informe_Final_SIMTELE_RISK.pdf) |
| Diseño entidad–relación | [Ver documentación DER](docs/DER.md) |
| Actualización dinámica | [Ver documentación técnica](docs/ACTUALIZACION_DINAMICA.md) |

> La **aplicación final está en el `index.html` de la raíz**. Las carpetas `semana1/` y `semana2/` se mantienen para documentar el progreso histórico; no son la versión final.

## 📖 Descripción

**SIMTELE-RISK** es una plataforma web de simulación y análisis matemático para cuatro problemas hipotéticos asociados al transporte por cable. Permite ajustar parámetros, ejecutar algoritmos numéricos, comparar tres escenarios por caso y examinar resultados, referencias, errores, residuales, convergencia y sensibilidad.

La versión final reúne los avances de las tres semanas y añade **conclusiones diferenciadas**, una base de datos relacional educativa, recuperación y verificación de experimentos, documentación y una interfaz simplificada para la presentación académica.

### Objetivo general

Desarrollar una aplicación web integrada que implemente, compare y valide métodos numéricos sobre cuatro casos de estudio sintéticos, con experimentos reproducibles, persistencia y análisis cuantitativo de errores.

### Objetivos específicos

- Formular modelos matemáticos con variables, unidades, hipótesis y parámetros definidos.
- Implementar métodos para sistemas lineales, raíces, interpolación, integración y ecuaciones diferenciales ordinarias.
- Analizar errores absolutos, relativos y porcentuales, residuales, convergencia, estabilidad y sensibilidad.
- Comparar escenarios **NORMAL**, **ESTRÉS** y **MAL CONDICIONADO** en los cuatro módulos.
- Garantizar que gráficos, tablas y métricas correspondan a los parámetros de cada ejecución.
- Guardar, consultar, recuperar, repetir y comprobar simulaciones dentro de una tolerancia numérica.
- Presentar por separado las **conclusiones numéricas** y la **interpretación del fenómeno modelado**.
- Documentar los aportes de Ingeniería de Sistemas e Inteligencia Artificial y Ciencia de Datos.

## 🧩 Cuatro módulos de estudio

| N.º | Caso | Modelo o finalidad | Métodos relacionados |
|---|---|---|---|
| **1** | Detención de emergencia | Tiempo y distancia de detención bajo un modelo hipotético de frenado | RK2, RK4; bisección, Newton-Raphson, secante; trapecio, Simpson y Romberg |
| **2** | Deterioro mecánico y mantenimiento | Tiempo de cruce de un umbral sintético y calibración de parámetros | Métodos de raíces; Jacobi, Gauss-Seidel, LU y gradiente conjugado |
| **3** | Oscilaciones por viento | Respuesta de un sistema masa–resorte–amortiguador | RK2, RK4 e integración numérica |
| **4** | Reconstrucción de señales de sensores | Estimación de muestras faltantes y estudio del ruido | Lagrange, Newton por diferencias divididas y splines cúbicos naturales |

### Modelos matemáticos de referencia

| Caso | Modelo básico |
|---|---|
| Detención | `v(t) = v₀ − at`; `x(t) = x₀ + v₀t − at²/2` |
| Deterioro | `D(t) = D₀ + αt + βt²` |
| Oscilaciones | `mx″(t) + cx′(t) + kx(t) = F(t)` |
| Sensores | `s(t) = A·sin(t)` y variantes sintéticas con muestras incompletas y ruido |

Los modelos base pueden ampliarse dentro de cada módulo para estudiar problemas numéricos específicos. **La teoría de errores se aplica transversalmente** a todos los casos.

### Escenarios experimentales

- **NORMAL:** condiciones nominales sintéticas y referencias numéricas.
- **ESTRÉS:** variaciones más exigentes de los parámetros dentro de las hipótesis del modelo.
- **MAL CONDICIONADO:** configuraciones que permiten estudiar sensibilidad matemática, como números de condición elevados, raíces problemáticas o nodos desfavorables.

La plataforma contempla **12 combinaciones**: cuatro casos por tres escenarios. Un escenario físicamente exigente **no implica necesariamente** mal condicionamiento matemático.

## 🖥️ Funciones principales de la aplicación final

| Sección | Función |
|---|---|
| **Panel general** | Resumen del laboratorio y acceso a los cuatro casos |
| **Las 3 fases** | Evolución académica del proyecto, desde el prototipo hasta la validación final |
| **Comparación** | Contraste de métodos, resultados y escenarios |
| **Historial** | Consulta y recuperación de experimentos realizados |
| **Base de datos** | Gestión de registros, representación del modelo de datos, integridad y respaldos |
| **Conclusiones** | Análisis numérico y explicación del comportamiento de cada caso |
| **Validación** | Comprobación de reproducibilidad y pruebas con referencias conocidas |
| **Detención, Deterioro, Oscilaciones y Sensores** | Formularios, cálculos, tablas y gráficas específicas |

### Parámetros y actualización de gráficos

La aplicación distingue entre los **parámetros editados** y los resultados de la **última ejecución**. Cuando los valores cambian, se muestra un aviso para evitar interpretar curvas antiguas como si fueran nuevas. Al pulsar **Ejecutar**, el motor vuelve a calcular los resultados y reconstruye las visualizaciones que dependen matemáticamente de esos parámetros.

> No se alteran artificialmente las gráficas: si un parámetro no afecta una determinada curva según las ecuaciones, esa curva puede permanecer igual. Lo importante es que cada visualización sea consistente con el cálculo ejecutado.

## 💾 Base de datos y persistencia

La entrega final tiene dos implementaciones complementarias:

| Entorno | Tecnología | Alcance |
|---|---|---|
| Aplicación web pública / archivo HTML | **IndexedDB** y motor relacional educativo en JavaScript | Guarda y recupera experimentos en el navegador del usuario |
| Herramientas Python | **SQLite** | Ejecuta y almacena experimentos de referencia en una base relacional local |

**GitHub Pages no ejecuta Python ni SQLite.** Los registros creados en la aplicación pública son locales a cada navegador y no se comparten automáticamente entre computadoras.


## 💻 Tecnologías

| Tecnología | Uso |
|---|---|
| **HTML5 y CSS3** | Interfaz web y diseño adaptable |
| **JavaScript (ES Modules)** | Métodos numéricos, casos de estudio, navegación y gráficas |
| **IndexedDB** | Persistencia en el navegador de la aplicación final |
| **Python** | Segunda implementación de los cálculos, línea de comandos y verificación |
| **SQLite / SQL** | Modelo relacional y registros de referencia locales |
| **Node.js** | Ejecución de pruebas y servidor local de desarrollo |
| **Git y GitHub** | Control de versiones y entregas |
| **GitHub Pages** | Publicación estática del sitio web |

## 👥 Aportes de las menciones

| Ingeniería de Sistemas | Inteligencia Artificial y Ciencia de Datos |
|---|---|
| Arquitectura e integración de componentes | Análisis de datos y señales sintéticas |
| Diseño de entidades, relaciones y persistencia | Calibración y estudio de sensibilidad |
| Gestión de registros, recuperación y respaldos | Experimentos con ruido e incertidumbre |
| Validación de entradas, trazabilidad y pruebas | Comparación cuantitativa de métodos |
| Publicación web, documentación y reproducibilidad | Evaluación e interpretación de resultados |

La distribución de módulos documentada en esta entrega es **1 (Detención) y 3 (Oscilaciones)** para Ingeniería de Sistemas, y **2 (Deterioro) y 4 (Sensores)** para Inteligencia Artificial y Ciencia de Datos. **Ambos integrantes deben comprender y defender los fundamentos numéricos de los cuatro módulos.**

## ⚠️ Limitaciones del proyecto

- Los datos, modelos y escenarios son hipotéticos; **no existe conexión con sensores operativos reales**.
- Los modelos simplifican la dinámica física y no representan todas las interacciones de un transporte por cable real.
- Las estimaciones de deterioro no constituyen calendarios de mantenimiento.
- El análisis de Monte Carlo describe la incertidumbre de las perturbaciones sintéticas elegidas, **no probabilidades reales de accidentes o averías**.
- Los experimentos guardados en la web permanecen en el navegador que los creó; utiliza la sección **Respaldo** para conservar una copia.

---

**SIMTELE-RISK · UMSA · Métodos Numéricos · Gestión 2026**  
*Proyecto académico de simulación, análisis de errores y verificación de resultados numéricos.*
