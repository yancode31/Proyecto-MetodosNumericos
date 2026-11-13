# Diagrama Entidad–Relación (DER inicial)

Diseño de base de datos exigido en la **Semana 1**. La aplicación estática actual conserva simulaciones por `IndexedDB` para permitir recuperar experimentos tras actualizar o cerrar el navegador. Este DER y el script `database/schema.sql` preparan una migración futura a SQLite/PostgreSQL mediante un backend.

```mermaid
erDiagram
    CASO_ESTUDIO ||--o{ ESCENARIO : dispone
    ESCENARIO ||--o{ SIMULACION : configura
    SIMULACION ||--o{ EJECUCION_METODO : contiene
    EJECUCION_METODO ||--o{ ITERACION_RESULTADO : registra
    EJECUCION_METODO ||--o| RESULTADO_RESUMEN : produce

    CASO_ESTUDIO {
        int id PK
        string nombre
        string modelo_version
    }
    ESCENARIO {
        int id PK
        int caso_id FK
        string tipo
        string parametros_json
        string fuente_datos
    }
    SIMULACION {
        string id PK
        int escenario_id FK
        string fecha
        string usuario_equipo
        string estado
    }
    EJECUCION_METODO {
        int id PK
        string simulacion_id FK
        string metodo
        float tolerancia
        float paso
        int max_iter
        bool convergio
        float tiempo_ms
    }
    ITERACION_RESULTADO {
        int id PK
        int ejecucion_id FK
        int numero
        string aproximacion_json
        float residual
        float error_abs
        float error_rel
    }
    RESULTADO_RESUMEN {
        int id PK
        int ejecucion_id FK
        string referencia
        string valor_json
        string metrica_error_json
        string interpretacion
    }
```

## Modelo relacional

- `caso_estudio(id PK, nombre, modelo_version)`.
- `escenario(id PK, caso_id FK, tipo, parametros_json, fuente_datos)`.
- `simulacion(id PK, escenario_id FK, fecha, usuario_equipo, estado)`.
- `ejecucion_metodo(id PK, simulacion_id FK, metodo, tolerancia, paso, max_iter, convergio, tiempo_ms)`.
- `iteracion_resultado(id PK, ejecucion_id FK, numero, aproximacion_json, residual, error_abs, error_rel)`.
- `resultado_resumen(id PK, ejecucion_id FK, referencia, valor_json, metrica_error_json, interpretacion)`.

El diseño almacena **parámetros, escenario, métodos, iteraciones, errores y conclusiones** para garantizar trazabilidad. La implementación actual guarda un objeto integral en IndexedDB; *no se presenta como una BD relacional implementada*.
