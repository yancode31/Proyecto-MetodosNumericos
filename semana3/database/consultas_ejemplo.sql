-- Consultas de ejemplo para DB Browser for SQLite o `sqlite3 simtele_demo.sqlite`
PRAGMA foreign_keys = ON;

-- 1. Resumen de todas las simulaciones
SELECT * FROM vw_resumen_simulaciones ORDER BY simulacion_id;

-- 2. ¿Convergieron todos los métodos? (por caso y escenario)
SELECT caso, escenario, COUNT(*) AS metodos, SUM(convergio) AS convergieron
FROM vw_convergencia_metodos GROUP BY caso, escenario ORDER BY caso, escenario;

-- 3. Iteraciones de bisección del caso 2 NORMAL (simulación 4) y su error
SELECT i.numero, i.residual, i.error_abs
FROM iteracion_resultado i JOIN ejecucion_metodo m ON m.id = i.ejecucion_id
WHERE m.simulacion_id = 4 AND m.metodo = 'Bisección' ORDER BY i.numero;

-- 4. Iteraciones necesarias por método de sistemas lineales y escenario
SELECT e.tipo AS escenario, m.metodo, COUNT(i.id) - 1 AS iteraciones_registradas
FROM ejecucion_metodo m JOIN simulacion s ON s.id = m.simulacion_id JOIN escenario e ON e.id = s.escenario_id
JOIN iteracion_resultado i ON i.ejecucion_id = m.id
WHERE m.familia = 'Sistemas lineales' AND m.metodo IN ('Jacobi','Gauss-Seidel','LU','Gradiente conjugado') AND e.caso_id = 2
GROUP BY e.tipo, m.metodo ORDER BY e.tipo, m.metodo;

-- 5. Reproducibilidad
SELECT simulacion_id, tolerancia, aprobada FROM verificacion ORDER BY simulacion_id;

-- 6. Integridad referencial (debe devolver 0 filas)
PRAGMA foreign_key_check;
