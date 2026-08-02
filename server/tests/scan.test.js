import { jest } from '@jest/globals';
import request from 'supertest';
import createApp from '../src/app.js';
import { connectTestDB, clearTestDB, closeTestDB } from './setup.js';
import User from '../src/models/User.js';

/**
 * Integration tests for the scan flow. The AI service falls back to the
 * deterministic MockProvider (no API key in the test env), so a scan returns
 * a full, schema-valid analysis without any network calls.
 *
 * A 1x1 PNG is uploaded as the chart image. Cloudinary is not configured in
 * tests, so uploadService returns an inline data URL — the flow still works.
 */
const app = createApp();

// Smallest valid PNG (1x1 transparent pixel).
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(connectTestDB, 120000);
afterEach(clearTestDB);
afterAll(closeTestDB);

const registerVerified = async () => {
  const res = await request(app).post('/api/v1/auth/register').send({
    email: 'scanner@example.com',
    password: 'StrongPass1',
  });
  const token = res.body.data.accessToken;
  // Verify the account directly (scan requires a verified email).
  await User.updateOne({ email: 'scanner@example.com' }, { isVerified: true });
  return token;
};

describe('Scan API', () => {
  it('rejects an unauthenticated scan', async () => {
    const res = await request(app).post('/api/v1/scan');
    expect(res.status).toBe(401);
  });

  it('analyzes a chart and returns a complete result', async () => {
    const token = await registerVerified();
    const res = await request(app)
      .post('/api/v1/scan')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 'chart.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const { analysis } = res.body.data;
    expect(analysis.symbol).toBeDefined();
    expect(['BUY', 'SELL', 'NO_TRADE']).toContain(analysis.decision);
    expect(analysis.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(analysis.confidenceScore).toBeLessThanOrEqual(100);
    expect(analysis.status).toBe('completed');
    expect(analysis.report.summary).toBeTruthy();
  });

  it('decrements scan credits after a successful scan', async () => {
    const token = await registerVerified();
    await request(app)
      .post('/api/v1/scan')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 'chart.png', contentType: 'image/png' });

    const user = await User.findOne({ email: 'scanner@example.com' });
    expect(user.subscription.scansUsed).toBe(1);
  });

  it('lists the analysis in history', async () => {
    const token = await registerVerified();
    await request(app)
      .post('/api/v1/scan')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 'chart.png', contentType: 'image/png' });

    const res = await request(app).get('/api/v1/analyses').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.analyses.length).toBe(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('blocks scanning when no credits remain', async () => {
    const token = await registerVerified();
    // Exhaust the free plan (5 scans) by setting usage to the limit.
    await User.updateOne({ email: 'scanner@example.com' }, { 'subscription.scansUsed': 5 });

    const res = await request(app)
      .post('/api/v1/scan')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, { filename: 'chart.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });
});
