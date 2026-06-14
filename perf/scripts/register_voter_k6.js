import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const DATA_FILE = __ENV.DATA_FILE || 'perf/data/voters.csv';
const TIMEOUT_MS = Number(__ENV.TIMEOUT_MS || 2000);
const SCENARIO = __ENV.SCENARIO || 'baseline';

const registerDuration = new Trend('register_duration');
const registerFailed = new Rate('register_failed');

const voters = new SharedArray('voters', function () {
  const text = open(DATA_FILE);
  const lines = text.trim().split('\n').slice(1);
  return lines.map(l => {
    const [documentId, fullName, age, gender, cityCode, address, phone, email] = l.split(',');
    return { documentId, fullName, age, gender, cityCode, address, phone, email };
  });
});

const scenarios = {
  baseline: {
    vus: Number(__ENV.VU_BASE || 50),
    duration: '10m',
  },
  load: {
    stages: [
      { duration: '2m', target: Number(__ENV.VU_BASE || 50) },
      { duration: '10m', target: Number(__ENV.VU_PEAK || 200) },
      { duration: '20m', target: Number(__ENV.VU_PEAK || 200) },
      { duration: '5m', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '5m', target: Number(__ENV.VU_BASE || 200) },
      { duration: '10m', target: Number(__ENV.VU_PEAK || 600) },
      { duration: '5m', target: 0 },
    ],
  },
};

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // FIX: tag válido de k6 es {status:200}, no {status:ok}
    'http_req_duration{status:200}': ['p(95)<300', 'p(99)<800'],
    register_failed: ['rate<0.01'],
  },
  // FIX: false para poder leer r.json() en el check de registrationId
  discardResponseBodies: false,
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  userAgent: 'k6-registrar-votante/1.0',
  ...(scenarios[SCENARIO] || scenarios['baseline']),
};

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  const v = pickOne(voters);
  const idem = Math.random().toString(36).slice(2);

  const payload = JSON.stringify({
    documentId: v.documentId,
    fullName: v.fullName,
    age: Number(v.age),
    gender: v.gender,
    cityCode: v.cityCode,
    address: v.address,
    phone: v.phone,
    email: v.email,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idem,
    },
    timeout: TIMEOUT_MS + 'ms',
    tags: { endpoint: 'register' },
  };

  // FIX: URL correcta — eliminar el sed del CI y usar el path real aquí
  const res = http.post(`${BASE_URL}/api/v1/voters/register`, payload, params);

  registerDuration.add(res.timings.duration);

  const ok = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'has registrationId': (r) => {
      // FIX: guard explícito — solo parsear si hay body
      if (!r.body || r.body.length === 0) return false;
      try {
        const j = r.json();
        return !!(j && (j.id || j.registrationId));
      } catch (e) {
        return false;
      }
    },
  });

  registerFailed.add(ok ? 0 : 1);
}