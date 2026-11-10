import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.ACCESS_TOKEN || '';
const TIME_SLOT_ID = __ENV.TIME_SLOT_ID || '';

export default function () {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `load-${__VU}-${__ITER}`,
  };

  const list = http.get(`${BASE_URL}/appointments?page=1&limit=20`, { headers });
  check(list, { 'listado 200': (res) => res.status === 200 });

  if (TIME_SLOT_ID) {
    const body = JSON.stringify({ timeSlotId: TIME_SLOT_ID });
    const created = http.post(`${BASE_URL}/appointments`, body, { headers });
    check(created, { 'creación 201/409': (res) => [201, 409].includes(res.status) });
  }

  sleep(1);
}
