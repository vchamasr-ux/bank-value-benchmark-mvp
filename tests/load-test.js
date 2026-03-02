import http from 'k6/http';
import { check, sleep } from 'k6';

// This is a k6 load test script.
// To run this, you need to have k6 installed on your machine (https://k6.io/docs/get-started/installation/)
// Run with: npx k6 run tests/load-test.js OR k6 run tests/load-test.js

export const options = {
    // 1. Define the load stages
    stages: [
        { duration: '5s', target: 10 },  // Ramp up to 10 virtual users
        { duration: '10s', target: 50 }, // Ramp up to 50 virtual users
        { duration: '5s', target: 0 },   // Ramp down
    ],
    // 2. Define performance thresholds
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
        http_req_failed: ['rate<0.01'],   // Less than 1% of requests can fail
    },
};

export default function () {
    // Point this to your actual API endpoint to test
    const url = 'http://localhost:5175/api/benchmarks';

    // Example payload (modify with your real API schema)
    const payload = JSON.stringify({
        assetRange: "1B-10B",
        region: "All",
        charter: "Commercial"
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    // Send the request
    const res = http.post(url, payload, params);

    // Assertions
    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });

    // Simulate user "think time" before sending the next round of requests
    sleep(1);
}
