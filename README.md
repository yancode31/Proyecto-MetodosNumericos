# 🚡 SIMTELE-RISK | Proyecto de Métodos Numéricos
 
**Carrera:** Informática  
**Asignatura:** Métodos Numéricos  

> **Aviso académico:** SIMTELE-RISK es una simulación educativa de un sistema de transporte por cable inspirado en el contexto de La Paz, Bolivia. Todos los datos y parámetros son **sintéticos e hipotéticos**. El proyecto no usa telemetría real, no describe fallas verificadas de Mi Teleférico y no debe emplearse para tomar decisiones operativas de seguridad o mantenimiento.

## 🌐 Aplicación web

**[Abrir SIMTELE-RISK — Semana 1](https://yancode31.github.io/Proyecto-MetodosNumericos/semana1/)**

**[Ver repositorio en GitHub](https://github.com/yancode31/Proyecto-MetodosNumericos)**

## 📖 Descripción

SIMTELE-RISK es una plataforma web para **formular, simular y comparar modelos numéricos** aplicados a cuatro problemas hipotéticos relacionados con el transporte por cable. Permite modificar parámetros, seleccionar escenarios, visualizar resultados y analizar la precisión y estabilidad de los métodos.

El énfasis del proyecto está en la **corrección matemática, los errores, los residuales, la convergencia y la interpretación de los resultados**, no solamente en el diseño de la interfaz.

### Objetivo general

Desarrollar una aplicación web integrada que aplique y compare métodos numéricos en cuatro casos de estudio, con experimentos reproducibles y un análisis cuantitativo de sus errores.

### Objetivos específicos

- Formular modelos matemáticos con hipótesis, variables, unidades y parámetros documentados.
- Implementar y comparar algoritmos de sistemas lineales, raíces, interpolación, integración y ecuaciones diferenciales.
- Evaluar errores absolutos, relativos, porcentuales, residuales y sensibilidad numérica.
- Comparar escenarios **NORMAL**, **ESTRÉS** y **MAL CONDICIONADO** en cada módulo.
- Guardar y recuperar simulaciones para revisarlas y ejecutarlas nuevamente.
- Diferenciar la **conclusión numérica** de la **conclusión sobre el fenómeno modelado**.

## 🧩 Cuatro módulos de estudio

| Módulo | Caso | Modelo o problema central | Métodos relacionados |
|:--|:--|:--|:--|
| **1** | Detención de emergencia | Velocidad, distancia y tiempo de detención | RK2, RK4, métodos de raíces e integración |
| **2** | Deterioro mecánico y mantenimiento | Tiempo estimado para alcanzar un umbral hipotético | Bisección, Newton-Raphson, secante; Jacobi, Gauss-Seidel, LU y gradiente conjugado |
| **3** | Oscilaciones por viento | Modelo masa–resorte–amortiguador | RK2, RK4 e integración numérica |
| **4** | Reconstrucción de señales de sensores | Estimación de muestras faltantes y efecto del ruido | Lagrange, Newton por diferencias divididas y splines cúbicos |

### Escenarios experimentales

- **NORMAL:** condiciones sintéticas nominales, utilizadas como referencia.
- **ESTRÉS:** condiciones más exigentes dentro del modelo, como perturbaciones intensas o variaciones de parámetros.
- **MAL CONDICIONADO:** experimentos que ponen de manifiesto sensibilidad matemática o numérica, por ejemplo matrices con alto número de condición o nodos desfavorables.

**Importante:** un escenario físicamente más exigente no implica necesariamente que el problema matemático esté mal condicionado.


### Avance: Semana 1

La carpeta `semana1/` contiene un **prototipo web funcional** que permite:

- Acceder a las cuatro tarjetas de casos de estudio.
- Seleccionar los tres escenarios y modificar parámetros con validaciones.
- Ejecutar los cálculos disponibles y consultar tablas, gráficos, referencias y errores.
- Consultar por separado la interpretación numérica y la interpretación del caso.
- Comparar módulos y escenarios en un panel general.
- Guardar, buscar, abrir y relanzar experimentos desde el historial local.
- Revisar un DER inicial y un script SQL de diseño.

**Estado de implementación:** el historial de la Semana 1 utiliza **IndexedDB**, con alternativa a `localStorage` cuando corresponde. La base de datos SQL del repositorio es **un diseño inicial**, todavía **no conectado a un backend**. 

## 💻 Tecnologías utilizadas en la Semana 1

| Tecnología | Uso |
|:--|:--|
| HTML5 | Estructura de la aplicación |
| CSS3 | Diseño y adaptación a diferentes pantallas |
| JavaScript (módulos ES) | Algoritmos numéricos, navegación y gráficos |
| IndexedDB / `localStorage` | Almacenamiento local de experimentos |
| SQL | Propuesta de modelo de persistencia a futuro |
| Git y GitHub | Control de versiones y organización del trabajo |
| GitHub Pages | Publicación de la web estática |
| Node.js (opcional) | Ejecución de pruebas automatizadas |

La aplicación web de Semana 1 **no necesita instalar dependencias de npm** para funcionar.
