
# Taller de Pruebas de Carga y Rendimiento

**(TODA LA DOCUMENTACION SE ENCUENTRA EN LA WIKI)**

INTEGRANTES: Sadane Geronimo Miguel Santiago Acevedo Virgues
---

## estructura del proyecto

``` text
.
├── README.md
├── defectos.md
├── defectos_template.md
├── perf
│   ├── ci
│   │   └── github-actions.yml
│   ├── data
│   │   ├── persons.csv
│   │   └── voters.csv
│   ├── results
│   └── scripts
│       ├── register_person_k6.js
│       └── register_voter_k6.js
└── registraduria
    ├── pom.xml
    └── src
        ├── main
        │   └── java
        │       └── edu
        │           └── unisabana
        │               └── tyvs
        │                   └── registry
        │                       ├── RegistryApplication.java
        │                       ├── application
        │                       │   ├── port
        │                       │   │   └── out
        │                       │   │       └── RegistryRepositoryPort.java
        │                       │   └── usecase
        │                       │       └── Registry.java
        │                       ├── config
        │                       │   └── RegistryConfig.java
        │                       ├── delivery
        │                       │   └── rest
        │                       │       └── RegistryController.java
        │                       ├── domain
        │                       │   └── model
        │                       │       ├── Gender.java
        │                       │       ├── Person.java
        │                       │       ├── RegisterResult.java
        │                       │       └── rq
        │                       │           └── PersonDTO.java
        │                       └── infrastructure
        │                           └── persistence
        │                               ├── RegistryRecord.java
        │                               └── RegistryRepository.java
        └── test
            └── java
                └── edu
                    └── unisabana
                        └── tyvs
                            └── registry
                                ├── AppTest.java
                                ├── application
                                │   └── usecase
                                │       ├── RegistryTest.java
                                │       └── RegistryWithMockTest.java
                                └── delivery
                                    └── rest
                                        └── RegistryControllerIT.java
```

## Pre-requisitos

- Servicio **Spring Boot** corriendo localmente en `http://localhost:8080` (o URL base equivalente).
- **k6** instalado: <https://grafana.com/docs/k6/latest/get-started/installation/>
- (Opcional) Base de datos o perfil `perf` para datos sintéticos.

## Instalación de k6

### Linux / Mac

```bash
curl -s https://packagecloud.io/install/repositories/loadimpact/k6/script.deb.sh | sudo bash
sudo apt install k6
```

> Verifica siempre con `k6 version` que esté disponible globalmente.

---

## Escenarios de prueba

- **Escenario A – Baseline**: 5 min warmup + 10 min a 50 VUs, medir p50/p95/p99 y error rate.
- **Escenario B – Carga**: rampa 0→200 VUs en 10 min, sostener 20 min.
- **Escenario C – Estrés**: rampa 200→600 VUs, detectar punto de quiebre.
- **Escenario D – Spike**: saltos de 50→300 VUs por 1–2 min, recuperación a 50 VUs.
- **Escenario E – Soak**: 2 horas a 120 VUs, revisar GC, memoria y *leaks*.

---

## Métricas y criterios de aceptación

- **Latencias**: p50/p90/p95/p99, *max*.
- **Throughput**: req/s.
- **Errores**: 4xx, 5xx, timeouts, *connection reset*.
- **Recursos**: CPU, RAM, GC, FD, *threads*, conexiones DB, colas.
- **Capacidad**: utilización del 70–80% con SLO cumplidos.
- **Criterios**: aprobar si p95 ≤ SLO y errores ≤ 1%; reprobar si se exceden límites o hay *leaks*.

---

## Dataset mínimo `perf/data/persons.csv`

Ejemplo de **5 filas** (puedes ampliarlo a cientos/miles):

```csv
id,name,age,gender,alive
101,Juan,28,MALE,true
102,María,31,FEMALE,true
103,Carlos,25,MALE,true
104,Sofia,27,FEMALE,true
105,Andrés,35,MALE,true
```

---

## Script de prueba `perf/scripts/register_person_k6.js`

El script envía solicitudes `POST /register` con datos del CSV, valida **status 200** y que el cuerpo contenga `VALID`.  
Variables de entorno soportadas:

- `BASE_URL` (por defecto `http://localhost:8080`)
- `DATA_FILE` (por defecto `perf/data/persons.csv`)
- `SCENARIO`: `baseline` | `load` | `stress` (por defecto `baseline`)
- `TIMEOUT_MS`: timeout del cliente HTTP (por defecto `2000`)

> Si ya tienes el archivo desde el taller, úsalo tal cual. Si no, crea uno con el contenido proporcionado anteriormente.

---

## Paso a paso: **Ejecución básica**

### 1) Levanta el servicio

```bash
mvn -DskipTests spring-boot:run
# o
java -jar target/app.jar
```

Confirma que `/register` responde con `200 OK` y `VALID` para un JSON válido.

```bash
curl -X POST http://localhost:8080/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Ana\",\"id\":1,\"age\":30,\"gender\":\"FEMALE\",\"alive\":true}"
```

### 2) Baseline (calentamiento + medición corta)

```bash
export BASE_URL="http://localhost:8080" 
export SCENARIO="baseline" 
k6 run perf/scripts/register_person_k6.js -o json=perf/results/baseline.json
```

### 3) Carga (rampa hasta 200 VUs)

```bash
export BASE_URL="http://localhost:8080"
export SCENARIO='load' 
k6 run perf/scripts/register_person_k6.js -o json=perf/results/load.json
```

### estress

```bash
export BASE_URL="http://localhost:8080"
export SCENARIO="stress"
k6 run perf/scripts/register_person_k6.js -o json=perf/results/stress.json
```

### CI

La prueba de CI se ejecuta automáticamente en cada **push** y **merge a la rama principal** mediante **GitHub Actions**.

**Configuración**: `.github/workflows/perf-ci.yml`

**Flujo**:
1. Instala dependencias (Maven, k6).
2. Levanta el servicio Spring Boot.
3. Ejecuta escenarios de prueba de carga (`baseline`, `load`, `stress`).
4. Genera reporte en `perf/results/`.
5. Falla si p95 > SLO o error rate > 1%.

