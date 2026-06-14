# Registro de Defectos — Pruebas de Carga y Rendimiento

Curso: Testing y Validación de Software
Proyecto: Pruebas de Carga y Rendimiento
Equipo: [Nombre del equipo]
Fecha: 2026-06-14

---

Este documento recoge los defectos confirmados durante las corridas
baseline, load y stress y las acciones recomendadas.

---

## Resumen ejecutivo

- PERF-01 (Baseline): margen funcional aceptable pero cercano al SLO (register_failed ≈ 0.97%).
- PERF-02 (Load): 100% de rechazos funcionales (400 Bad Request) — bloqueo crítico de la corrida.
- PERF-03 (Stress): rechazo funcional ≈ 2.14% (> 1% SLO) y p99 elevado (~349 ms).

---

## Defecto PERF-01 — Error funcional marginal en Baseline

- Capa afectada: Lógica de negocio / Validaciones
- Escenario: Baseline (20 VUs, 5 min)
- SLO definido: error rate < 1%
- Resultado obtenido: `register_failed.rate` = 0.009707150065404508 (≈ 0.97%)

### Evidencia
Extraída de `perf/results/summary-baseline.json`:
```
iterations: 3,907,223
http_reqs.rate: 12725.35
http_req_duration.avg: 1.34499 ms
http_req_duration.p95: 2.472797 ms
register_failed.rate: 0.009707150065404508
checks.rate: 0.9951464249672978
```

### Impacto
Bajo impacto funcional (por debajo del umbral 1%), pero merecedor de seguimiento por proximidad al límite.

### Causa probable
- Pequeñas colisiones de datos de prueba o validaciones puntuales.

### Acción recomendada
- Aumentar tamaño del dataset de prueba (usar `perf/scripts/generate_persons.py`).
- Volver a ejecutar baseline tras limpiar la BD H2.

### Estado
Abierto — Prioridad: Media

---

## Defecto PERF-02 — 100% Bad Requests en Load (bloqueante)

- Capa afectada: API / Validación de entrada
- Escenario: Load (0→200 VUs, 14 min total)
- SLO definido: error rate < 1% · p95 < 300 ms
- Resultado obtenido: `register_failed.rate` = 1.0 (100% de fallos)

### Evidencia
Extraída de `perf/results/summary-load.json`:
```
iterations: 2,342,105
http_reqs.rate: 5533.36
http_req_duration.avg: 30.26927 ms
http_req_duration.p95: 56.7071172 ms
status 200: passes=0 fails=2,342,105
body VALID: passes=0 fails=2,342,105
register_failed.rate: 1.0
```

### Impacto
La corrida no entrega métricas funcionales válidas; el endpoint rechaza todas las peticiones bajo este escenario (no se puede medir latencia funcional ni throughput válido).

### Causa probable
- Payloads inválidos o campos fuera de formato/alcance esperados por `PersonDTO`.
- `DATA_FILE` apuntando a un CSV incorrecto o desalineado con el script.
- `buildUniqueId` generando IDs que el servidor considera inválidos (ej.: overflow o formato inesperado).
- Posible validación en servidor que se dispara bajo concurrencia (race condition en parsing/serialización).

### Acciones recomendadas (prioritarias)
1. Extraer entradas de payload que fallan: aumentar temporalmente `console.error` en `perf/scripts/register_person_k6.js` y re-ejecutar un `load` corto (1 min) para capturar ejemplos.
2. Revisar `registraduria.log` para obtener el mensaje/stacktrace exacto que causa los `400`.
3. Reproducir manualmente (curl) 5–10 payloads extraídos para confirmar el 400 fuera de k6.
4. Confirmar `DATA_FILE` y que los IDs generados caben en `int` (<= 2,147,483,647). Adaptar `generate_persons.py` si es necesario.

### Estado
Abierto — Prioridad: Crítica

---

## Defecto PERF-03 — Rechazos y latencia elevada en Stress

- Capa afectada: Aplicación / Pool DB / JVM
- Escenario: Stress (200→600 VUs)
- Resultado obtenido: `register_failed.rate` = 0.021409477381561473 (≈ 2.14%) · p99 ≈ 348.71 ms

### Evidencia
Extraída de `perf/results/summary-stress.json`:
```
iterations: 8,697,550
http_reqs.rate: 14115.72
http_req_duration.avg: 30.08808 ms
http_req_duration.p95: 72.3202861 ms
http_req_duration.p99: 348.71078288 ms
register_failed.rate: 0.021409477381561473
```

### Impacto
Error rate por encima del SLO y p99 alto; indica contención en recursos bajo carga extrema.

### Causa probable
- Contención en la BD (consultas sin índice o bloqueo en comprobación de duplicados).
- Pool de conexiones JDBC insuficiente.
- Operaciones sin optimización en la ruta de registro.

### Acción recomendada
- Añadir índice en la columna `id` de la tabla de persistencia.
- Aumentar el pool de conexiones (HikariCP) para pruebas de carga.
- Re-ejecutar stress tras aplicar cambios y comparar resultados.

### Estado
Abierto — Prioridad: Alta

---

## Registro de cambios y próximos pasos

- Se mejoró `perf/scripts/register_person_k6.js` (`buildUniqueId` hashing).
- Se añadió `perf/scripts/generate_persons.py` para generar datasets grandes.
- Próximo paso: capturar payloads fallidos y revisar `registraduria.log` para PERF-02.

---

Universidad de La Sabana — Facultad de Ingeniería
Curso: Testing y Validación de Software
