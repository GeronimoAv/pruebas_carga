# Registro de Defectos -- Pruebas de Carga y Rendimiento

Curso: Testing y Validación de Software\
Proyecto: Pruebas de Carga y Rendimiento\
Equipo: \[Nombre del equipo\]\
Fecha: \[Fecha\]

------------------------------------------------------------------------

## Introducción

Este documento recopila los defectos identificados durante la ejecución
de pruebas de rendimiento (Baseline, Load, Stress, Spike, Soak y
Regresión).\
Cada defecto se documenta para garantizar trazabilidad, análisis técnico
y propuesta de mejora.

------------------------------------------------------------------------

# Formato 1: Lista detallada

## Defecto PERF-01 --- Incumplimiento de SLO de latencia bajo Load

- Capa afectada: Aplicación / Base de datos\
- Escenario: Load Test (200 VUs)\
- SLO definido: p95 \< 300 ms\
- Resultado esperado: Cumplimiento del SLO bajo carga nominal.\
- Resultado obtenido: p95 = 612 ms

### Evidencia

http_req_duration: avg=402ms\
p(95)=612ms\
p(99)=890ms

### Impacto

Incumplimiento del objetivo de nivel de servicio bajo carga esperada.

### Causa probable

-   Saturación del pool de conexiones.\
-   Consulta sin índice.

### Estado

Abierto

### Prioridad

Alta

------------------------------------------------------------------------

## Defecto PERF-02 --- Error rate elevado bajo Stress

-   Capa afectada: Servidor de aplicación\
-   Escenario: Stress Test (600 VUs)\
-   SLO definido: Error rate \< 1%\
-   Resultado obtenido: 3.8%

### Evidencia

http_req_failed: 3.8%\
status=500 detectado

### Impacto

Fallas del sistema bajo carga alta.

### Causa probable

-   Agotamiento de threads.\
-   Configuración insuficiente.

### Estado

En progreso

### Prioridad

Crítica

------------------------------------------------------------------------

## Defecto PERF-05 --- Alto porcentaje de registros rechazados en Stress

-   Capa afectada: Aplicación / Lógica de registro
-   Escenario: Stress Test (600 VUs)
-   SLO definido: error rate < 1% · p95 < 300 ms
-   Resultado obtenido: register_failed: passes=4,919,574 fails=6,275,029 (≈56.05% fallidos)

### Evidencia

Extraída de `perf/results/summary-stress.json` (carrera realizada):

```
iterations: 12,810,758
throughput (req/s): 20,910.45
http_req_duration.avg: 19.22480 ms
http_req_duration.p95: 29.35439 ms
http_req_duration.p99: 236.36143 ms
register_failed.rate: 0.96097 (≈96.10% failed)
checks.rate: 0.51951 (≈48.05% passes / ≈51.95% fails)
```

### Impacto

Alta tasa de rechazos funcionales bajo stress; el sistema no cumple el requisito de disponibilidad funcional en escenarios extremos.

### Causa probable

- Dataset insuficiente / colisiones de IDs generados por la estrategia original de `buildUniqueId`.
- BD H2 con datos persistentes entre corridas (no reinicio) → `DUPLICATED`.
- Lógica de verificación de existencia costosa bajo concurrencia; posible contención en transacciones.

### Acción tomada

- Se mejoró `buildUniqueId` en `perf/scripts/register_person_k6.js` para reducir colisiones.
- Se añadió `perf/scripts/generate_persons.py` para generar datasets grandes y evitar colisiones por escasez de IDs.
- Recomendación: reiniciar la app (H2) antes de cada escenario y re-ejecutar las corridas para validar la mitigación.

------------------------------------------------------------------------

## Defecto PERF-06 --- 100% Bad Requests en Load

- Capa afectada: API / Validación de entrada
- Escenario: Load Test (200 VUs)
- SLO definido: error rate < 1% · p95 < 300 ms
- Resultado obtenido: `register_failed` = 100% (todas las iteraciones fallaron)

### Evidencia

Extraída de `perf/results/summary-load.json`:

```
iterations: 2,342,105
throughput (req/s): 5,533.36
http_req_duration.avg: 30.26927 ms
http_req_duration.p95: 56.70712 ms
http_req_duration.p99: 75.05834 ms
status 200: passes=0 fails=2,342,105
register_failed.rate: 1.0 (100% failed)
```

### Impacto

El endpoint está rechazando todas las peticiones bajo el escenario de carga; la corrida no entrega información útil para medir latencia válida ni throughput funcional.

### Causa probable

- Payloads inválidos o parsing/validación fallando en el servidor bajo concurrencia.
- `DATA_FILE` no apuntado al CSV correcto al ejecutar k6 (usar el archivo generado).
- `buildUniqueId` generando IDs fuera del rango o con formato no esperado.

### Acción recomendada

1. Revisar `registraduria` logs para la causa exacta del 400 (stack trace / mensaje de validación).
2. Ejecutar `curl` con 2–5 entradas del CSV para reproducir el 400 fuera de k6.
3. Aumentar temporalmente el logging de payloads fallidos en k6 (imprimir payloads) y re-ejecutar un `load` corto (1 min) para capturar ejemplos.
4. Confirmar `DATA_FILE` y volver a correr. Si persiste, agregar validaciones del JSON en el cliente para asegurar formato.

### Estado

Abierto


### Estado

Abierto

### Prioridad

Crítica


## Defecto PERF-03 --- Degradación progresiva en Soak Test

-   Capa afectada: JVM / Memoria\
-   Escenario: Soak Test (2 horas)\
-   Resultado esperado: Latencia estable\
-   Resultado obtenido: Incremento progresivo de 210ms a 480ms

### Impacto

Posible fuga de memoria o acumulación de recursos.

### Estado

Abierto

### Prioridad

Media

------------------------------------------------------------------------

# Formato 2: Tabla de seguimiento

  ----------------------------------------------------------------------------------
## Defecto PERF-04 --- Alta tasa de registros rechazados en Load

-   Capa afectada: Aplicación / Lógica de registro
-   Escenario: Load Test (200 VUs)
-   SLO definido: error rate < 1% · p95 < 300 ms
-   Resultado obtenido: register_failed.rate = 0.6447 (64.47%) · checks.rate = 0.6776 (67.76%)

### Evidencia

Extraída de `perf/results/summary-load.json`:

```
iterations: 15433447
throughput (req/s): 18352.68
http_req_duration.avg: 8.845746 ms
http_req_duration.p95: 17.656987 ms
register_failed.rate: 0.6447144957312517
checks.rate: 0.6776419422051341
```

### Impacto

La mayoría de las solicitudes de registro son rechazadas (DUPLICATED o validaciones negativas), lo que provoca un error funcional masivo en el escenario nominal de carga.

### Causa probable

- Colisiones de IDs generados por `buildUniqueId` / dataset insuficiente.
- La BD H2 contiene registros previos (no se reinició la app) produciendo duplicados.
- Lógica de validación de existencia posiblemente costosa bajo concurrencia.

### Estado

Abierto

### Prioridad

Crítica

------------------------------------------------------------------------

  PERF-04   Load       Error funcional alto  register_failed ~64% Abierto     Crítica
  PERF-05   Stress     Error funcional alto  register_failed ~56% Abierto     Crítica
  ID        Escenario   Resultado Esperado Resultado Obtenido Estado     Prioridad
  --------- ----------- ------------------ ------------------ ---------- -----------
  PERF-01   Load        p95 \< 300ms       612ms              Abierto    Alta

  PERF-02   Stress      Error \< 1%        3.8%               En         Crítica
                                                              progreso   

  PERF-03   Soak        Latencia estable   Degradación        Abierto    Media
  ----------------------------------------------------------------------------------

------------------------------------------------------------------------

## Convenciones de Estado

Abierto: Defecto identificado sin corrección aplicada.\
En progreso: En proceso de corrección.\
Resuelto: Corregido y validado con nuevas pruebas.

------------------------------------------------------------------------

Universidad de La Sabana -- Facultad de Ingeniería\
Curso: Testing y Validación de Software (2025-1)
