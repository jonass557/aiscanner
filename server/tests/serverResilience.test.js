import request from 'supertest';
import createApp from '../src/app.js';

describe('Server & Auth Resilience (Disconnected DB)', () => {
  const app = createApp();

  it('GET /health returns 503 degraded when MongoDB is disconnected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.database).toBe('disconnected');
  });

  it('POST /api/v1/auth/login returns 503 immediately instead of timing out', async () => {
    const start = Date.now();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'Password123!' });
    const duration = Date.now() - start;

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('base de données');
    expect(duration).toBeLessThan(1000); // Responds in < 1 second, NOT 60 seconds!
  });

  it('POST /api/v1/auth/register returns 503 immediately instead of timing out', async () => {
    const start = Date.now();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      });
    const duration = Date.now() - start;

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('base de données');
    expect(duration).toBeLessThan(1000); // Fast failure
  });
});
