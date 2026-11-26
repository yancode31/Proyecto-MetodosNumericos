# Diagrama Entidad–Relación y modelo relacional (esquema v2)

La base se implementa en `assets/db/` (motor `SimteleDB`, persistido en IndexedDB) y se exporta a SQLite con el mismo esquema (`database/schema.sql`). El panel **Base de datos** de la aplicación permite ver, insertar, modificar y eliminar registros, ejecutar consultas SQL, exportar/importar y verificar la integridad.

```mermaid
erDiagram
    CASO_ESTUDIO ||--o{ ESCENARIO : "tiene (CASCADE)"
    ESCENARIO ||--o{ SIMULACION : "configura (RESTRICT)"
    SIMULACION ||--o{ EJECUCION_METODO : "contiene (CASCADE)"
    SIMULACION ||--o{ VERIFICACION : "se verifica (CASCADE)"
    EJECUCION_METODO ||--o{ ITERACION_RESULTADO : "registra (CASCADE)"
    EJECUCION_METODO ||--o| RESULTADO_RESUMEN : "produce (CASCADE)"

    CASO_ESTUDIO { int id PK
      string nombre UK
      string modelo_version
      string descripcion }
    ESCENARIO { int id PK
      int caso_id FK
      string tipo "NORMAL | ESTRÉS | MAL CONDICIONADO"
      json parametros_json
      string fuente_datos }
    SIMULACION { int id PK
      int escenario_id FK
      datetime fecha
      string usuario_equipo
      string estado
      string etiqueta
      string notas
      string version_motor
      string metrica_nombre
      float metrica_valor
      float duracion_ms
      json snapshot_json }
    EJECUCION_METODO { int id PK
      int simulacion_id FK
      string familia
      string metodo
      float tolerancia
      float paso
      int max_iter
      bool convergio
      float tiempo_ms }
    ITERACION_RESULTADO { int id PK
      int ejecucion_id FK
      int numero
      json aproximacion_json
      float residual
      float error_abs
      float error_rel }
    RESULTADO_RESUMEN { int id PK
      int ejecucion_id FK
      string referencia
      json valor_json
      json metrica_error_json
      string interpretacion }
    VERIFICACION { int id PK
      int simulacion_id FK
      datetime fecha
      float tolerancia
      bool aprobada
      json detalle_json }
    AUDITORIA { int id PK
      datetime fecha
      string tabla
      string registro_id
      string operacion
      string detalle }
```

## Modelo relacional

- `caso_estudio(id PK, nombre UNIQUE, modelo_version, descripcion)`
- `escenario(id PK, caso_id FK→caso_estudio, tipo CHECK, parametros_json, fuente_datos, UNIQUE(caso_id, tipo, parametros_json))`
- `simulacion(id PK, escenario_id FK→escenario, fecha, usuario_equipo, estado CHECK, etiqueta, notas, version_motor, metrica_nombre, metrica_valor, metrica_unidad, duracion_ms, snapshot_json)`
- `ejecucion_metodo(id PK, simulacion_id FK→simulacion, familia, metodo, tolerancia, paso, max_iter, convergio, tiempo_ms)`
- `iteracion_resultado(id PK, ejecucion_id FK→ejecucion_metodo, numero, aproximacion_json, residual, error_abs, error_rel, UNIQUE(ejecucion_id, numero))`
- `resultado_resumen(id PK, ejecucion_id UNIQUE FK→ejecucion_metodo, referencia, valor_json, metrica_error_json, interpretacion)`
- `verificacion(id PK, simulacion_id FK→simulacion, fecha, tolerancia, aprobada, detalle_json)`
- `auditoria(id PK, fecha, tabla, registro_id, operacion CHECK, detalle)`

Integridad: claves foráneas con `ON DELETE CASCADE` (salvo `escenario → simulacion`, que es `RESTRICT` para no perder experimentos al borrar un escenario), `CHECK` en `tipo`, `estado`, `operacion` y booleanos, `UNIQUE` en nombres y en (ejecución, número), y validación de JSON.
