const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

test('health endpoint is available', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('login endpoint authenticates admin user', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@gov.in', password: 'Admin@123' });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.role, 'ADMIN');
});

test('admin can fetch master data', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@gov.in', password: 'Admin@123' });

  const response = await request(app)
    .get('/api/assets/masters')
    .set('Authorization', `Bearer ${loginResponse.body.token}`);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.departments));
  assert.ok(Array.isArray(response.body.assetTypes));
  assert.ok(Array.isArray(response.body.inspectors));
});

test('admin can manage departments and asset types', async () => {
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@gov.in', password: 'Admin@123' });

  const departmentResponse = await request(app)
    .post('/api/departments')
    .set('Authorization', `Bearer ${loginResponse.body.token}`)
    .send({ name: 'Public Works', description: 'Infrastructure department' });

  assert.equal(departmentResponse.status, 201);
  assert.ok(departmentResponse.body.name);

  const assetTypeResponse = await request(app)
    .post('/api/asset-types')
    .set('Authorization', `Bearer ${loginResponse.body.token}`)
    .send({ name: 'Water Pump', description: 'Pump system asset type' });

  assert.equal(assetTypeResponse.status, 201);
  assert.ok(assetTypeResponse.body.name);
});
