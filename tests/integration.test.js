// tests/integration.test.js
const request = require('supertest');
const app = require('../index'); // your express app exported in index.js
const pool = require('../src/models/db');

let token;
let userId;

beforeAll(async () => {
  // Ensure test DB is present and clean a known email for repeatable tests.
  await pool.query("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'inttest%@example.com')");
  await pool.query("DELETE FROM users WHERE email LIKE 'inttest%@example.com'");
});

afterAll(async () => {
  // cleanup
  if (userId) {
    await pool.query("DELETE FROM transactions WHERE user_id = ?", [userId]);
    await pool.query("DELETE FROM users WHERE id = ?", [userId]);
  }
  await pool.end();
});

test('Register -> Login -> Profile flow', async () => {
  const email = `inttest${Date.now()}@example.com`;
  // register
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Int Test', email, password: 'secret123' })
    .expect(200);
  expect(reg.body.token).toBeDefined();
  // login
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'secret123' })
    .expect(200);
  expect(login.body.token).toBeDefined();
  token = login.body.token;
  userId = login.body.user.id;

  // profile
  const profile = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  expect(profile.body.email).toBe(email);
});

test('Deposit and withdraw', async () => {
  // deposit 100
  const deposit = await request(app)
    .post('/api/transactions/deposit')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 100.00 })
    .expect(200);
  expect(deposit.body.balance).toBeDefined();

  // withdraw 20
  const withdraw = await request(app)
    .post('/api/transactions/withdraw')
    .set('Authorization', `Bearer ${token}`)
    .send({ amount: 20.00 })
    .expect(200);
  expect(withdraw.body.balance).toBeDefined();
  expect(Number(withdraw.body.balance)).toBeGreaterThanOrEqual(0);
});
