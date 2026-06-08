/*
 * Default example servers — loaded on first run (empty localStorage).
 * Replace these with your real EC2 instances via the "Add Server" UI,
 * or edit this file directly and clear localStorage to reset.
 *
 * Health endpoint conventions
 * ───────────────────────────
 *  Java (Spring Boot)   healthPath: /actuator/health
 *    Config: management.endpoints.web.exposure.include=health
 *
 *  Node.js (Express)    healthPath: /health
 *    Example: app.get('/health', (_, res) => res.json({ status: 'ok' }))
 *
 *  Python (Flask/FastAPI) healthPath: /health
 *    FastAPI:  @app.get("/health") → return {"status":"ok"}
 *    Flask:    @app.route("/health") → return jsonify(status="ok")
 *
 *  Go                   healthPath: /healthz
 *    Follows Kubernetes liveness-probe convention.
 *
 * Service URL is derived at runtime: http://{privateIp}:{port}{healthPath}
 * Changing a server's privateIp field updates all its service URLs.
 */

export function defaultServers() {
  return [
    {
      id: 'example-web-1',
      name: 'prod-web-1',
      privateIp: '10.0.1.42',
      region: 'us-east-1',
      sshUser: 'ec2-user',
      services: [
        { name: 'api-gateway',      language: 'java',   port: 8080, healthPath: '/actuator/health' },
        { name: 'auth-service',     language: 'node',   port: 3001, healthPath: '/health' },
        { name: 'report-builder',   language: 'python', port: 5000, healthPath: '/health' },
        { name: 'metrics-collector',language: 'go',     port: 9090, healthPath: '/healthz' },
      ],
    },
    {
      id: 'example-worker-1',
      name: 'prod-worker-1',
      privateIp: '10.0.2.17',
      region: 'us-east-1',
      sshUser: 'ec2-user',
      services: [
        { name: 'job-scheduler',   language: 'java',   port: 8080, healthPath: '/actuator/health' },
        { name: 'notification-svc',language: 'node',   port: 3002, healthPath: '/health' },
        { name: 'ml-inference',    language: 'python', port: 5001, healthPath: '/health' },
      ],
    },
    {
      id: 'example-data-1',
      name: 'prod-data-1',
      privateIp: '10.0.3.88',
      region: 'us-west-2',
      sshUser: 'ec2-user',
      services: [
        { name: 'data-ingestion', language: 'go',     port: 8081, healthPath: '/healthz' },
        { name: 'cache-warmer',   language: 'python', port: 5002, healthPath: '/health' },
        { name: 'event-stream',   language: 'java',   port: 8082, healthPath: '/actuator/health' },
        { name: 'query-router',   language: 'node',   port: 3003, healthPath: '/health' },
      ],
    },
  ]
}
