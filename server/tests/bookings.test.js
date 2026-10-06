const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server-core');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');
const createApp = require('../app');
const Event = require('../models/Event');
const Booking = require('../models/Booking');
const User = require('../models/User');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-at-least-32-bytes-long';
let repl, server, base, attendee, other, organizer, attendeeToken, organizerToken;
const future = () => new Date(Date.now() + 7 * 86400000).toISOString();
const sign = user => jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

before(async () => {
  repl = await MongoMemoryReplSet.create({ binary: { version: '8.0.16' }, replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await connectDB(repl.getUri('lumina-test'));
  [attendee, other, organizer] = await User.create([
    { name: 'Attendee', email: 'attendee@test.example', password: 'password123', role: 'attendee' },
    { name: 'Other', email: 'other@test.example', password: 'password123', role: 'attendee' },
    { name: 'Organizer', email: 'organizer@test.example', password: 'password123', role: 'organizer' }
  ]);
  attendeeToken = sign(attendee);
  organizerToken = sign(organizer);
  const app = createApp({ mode: 'test', trustProxy: 0, allowedOrigins: ['http://localhost:3000'] });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 120000 });

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (repl) await repl.stop();
});

beforeEach(async () => {
  await Booking.deleteMany({});
  await Event.deleteMany({});
});

async function request(url, { method = 'GET', body, token = attendeeToken, key, headers = {} } = {}) {
  const response = await fetch(`${base}/api${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...(key && { 'Idempotency-Key': key }), ...headers },
    ...(body !== undefined && { body: JSON.stringify(body) })
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}

async function event(overrides = {}) {
  return Event.create({ title: 'Test event', event_type: 'workshop', venue_name: 'Hall', venue_city: 'Dehradun', start_date: future(), ticket_price: 19.95, total_capacity: 10, status: 'published', organizer: organizer.id, ...overrides });
}
const details = (e, n = 1) => ({ event: e.id, attendee_name: 'Attendee', attendee_email: 'attendee@test.example', number_of_tickets: n });
const book = (e, n = 1, key) => request('/bookings', { method: 'POST', body: details(e, n), key });
const cancel = id => request(`/bookings/${id}/cancel`, { method: 'PUT' });
const sold = async e => (await Event.findById(e.id)).tickets_sold;

// These assertions read MongoDB after real HTTP requests, including real commits and aborts.
test('concurrent bookings cannot oversell the last seats', async () => {
  const e = await event({ total_capacity: 3 });
  const results = await Promise.all(Array.from({ length: 10 }, () => book(e)));
  assert.equal(results.filter(r => r.status === 201).length, 3);
  assert.equal(results.filter(r => r.status === 409).length, 7);
  assert.equal(await sold(e), 3);
  assert.equal(await Booking.countDocuments({ event: e.id }), 3);
});

test('booking failures roll back the event reservation', async t => {
  const e = await event();
  const mock = t.mock.method(Booking, 'create', async () => { throw new Error('injected insert failure'); });
  const result = await book(e, 2);
  assert.equal(result.status, 500);
  assert.doesNotMatch(result.data.error, /injected/);
  assert.equal(await sold(e), 0);
  assert.equal(await Booking.countDocuments({}), 0);
  mock.mock.restore();
  assert.equal((await book(e, 2)).status, 201);
});

test('population failure also aborts the booking and reservation', async t => {
  const e = await event();
  t.mock.method(Booking.prototype, 'populate', async () => { throw new Error('injected read failure'); });
  assert.equal((await book(e, 2)).status, 500);
  assert.equal(await sold(e), 0);
  assert.equal(await Booking.countDocuments({}), 0);
});

test('same booking request key is retry-safe including simultaneous requests', async () => {
  const e = await event();
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 5 }, () => book(e, 2, key)));
  assert.ok(results.every(r => [200, 201].includes(r.status)), JSON.stringify(results));
  assert.equal(new Set(results.map(r => r.data.booking._id)).size, 1);
  assert.equal(await sold(e), 2);
  assert.equal(await Booking.countDocuments({}), 1);
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results[0].data.booking.total_amount, 39.9);
  assert.equal(results[0].data.booking.event_snapshot.title, e.title);
  assert.equal(results[0].data.booking.idempotency_key, undefined);
  assert.equal(results[0].data.booking.request_fingerprint, undefined);
  assert.equal((await book(e, 3, key)).status, 409);
  assert.equal(await sold(e), 2);
});

test('replaying a cancelled booking does not rebook seats', async () => {
  const e = await event();
  const key = randomUUID();
  const result = await book(e, 2, key);
  assert.equal((await cancel(result.data.booking._id)).status, 200);
  const replay = await book(e, 2, key);
  assert.equal(replay.status, 200);
  assert.equal(replay.data.booking.booking_status, 'cancelled');
  assert.equal(await sold(e), 0);
});

test('idempotency keys are scoped to the requesting user', async () => {
  const e = await event();
  const key = randomUUID();
  assert.equal((await book(e, 2, key)).status, 201);
  assert.equal((await request('/bookings', { method: 'POST', token: sign(other), body: details(e, 2), key })).status, 201);
  assert.equal(await sold(e), 4);
});

test('concurrent cancellation and repeated retries release tickets once', async () => {
  const e = await event();
  const created = await book(e, 3);
  const id = created.data.booking._id;
  const results = await Promise.all(Array.from({ length: 8 }, () => cancel(id)));
  assert.ok(results.every(r => r.status === 200));
  assert.equal(await sold(e), 0);
  assert.equal((await Booking.findById(id)).booking_status, 'cancelled');
  assert.equal((await cancel(id)).status, 200);
  assert.equal(await sold(e), 0);
});

test('event update failure leaves cancellation retryable', async t => {
  const e = await event();
  const created = await book(e, 2);
  const id = created.data.booking._id;
  const original = Event.findOneAndUpdate;
  const mock = t.mock.method(Event, 'findOneAndUpdate', function(filter, update, options) {
    if (update.$inc?.tickets_sold < 0) throw new Error('injected release failure');
    return original.call(this, filter, update, options);
  });
  assert.equal((await cancel(id)).status, 500);
  assert.equal(await sold(e), 2);
  assert.equal((await Booking.findById(id)).booking_status, 'confirmed');
  mock.mock.restore();
  assert.equal((await cancel(id)).status, 200);
  assert.equal(await sold(e), 0);
});

test('booking status save failure rolls back the ticket release', async t => {
  const e = await event();
  const created = await book(e, 2);
  const id = created.data.booking._id;
  t.mock.method(Booking.prototype, 'save', async () => { throw new Error('injected status failure'); });
  assert.equal((await cancel(id)).status, 500);
  assert.equal(await sold(e), 2);
  assert.equal((await Booking.findById(id)).booking_status, 'confirmed');
});

test('cancellation requires ownership and rejects missing or invalid IDs', async () => {
  const e = await event();
  const created = await book(e, 2);
  const id = created.data.booking._id;
  assert.equal((await request(`/bookings/${id}/cancel`, { method: 'PUT', token: sign(other) })).status, 403);
  assert.equal((await request(`/bookings/${id}/cancel`, { method: 'PUT', token: null })).status, 401);
  assert.equal((await cancel('bad-id')).status, 400);
  assert.equal((await cancel(new mongoose.Types.ObjectId().toString())).status, 404);
  assert.equal(await sold(e), 2);
});

test('inconsistent legacy inventory cannot become negative on cancellation', async () => {
  const e = await event();
  const created = await book(e, 2);
  const id = created.data.booking._id;
  await Event.updateOne({ _id: e.id }, { tickets_sold: 1 });
  assert.equal((await cancel(id)).status, 409);
  assert.equal(await sold(e), 1);
  assert.equal((await Booking.findById(id)).booking_status, 'confirmed');
});

test('concurrent booking and cancellation preserve the inventory sum', async () => {
  const e = await event({ total_capacity: 3 });
  const created = await book(e, 3);
  const [cancelled, booked] = await Promise.all([cancel(created.data.booking._id), book(e, 3)]);
  assert.equal(cancelled.status, 200);
  assert.ok([201, 409].includes(booked.status));
  const active = await Booking.find({ event: e.id, booking_status: { $ne: 'cancelled' } });
  assert.equal(await sold(e), active.reduce((sum, b) => sum + b.number_of_tickets, 0));
});

test('deletion preserves both confirmed and cancelled booking history', async () => {
  const e = await event();
  const created = await book(e);
  assert.equal((await request(`/events/${e.id}`, { method: 'DELETE', token: organizerToken })).status, 409);
  await cancel(created.data.booking._id);
  assert.equal((await request(`/events/${e.id}`, { method: 'DELETE', token: organizerToken })).status, 409);
  assert.ok(await Event.findById(e.id));
  assert.equal((await request(`/events/${e.id}`, { method: 'PUT', token: organizerToken, body: { status: 'cancelled' } })).status, 200);
});

test('deletion racing a new booking never leaves an orphan', async () => {
  for (let i = 0; i < 6; i++) {
    const e = await event();
    const [created, deleted] = await Promise.all([
      book(e, 2), request(`/events/${e.id}`, { method: 'DELETE', token: organizerToken })
    ]);
    assert.ok([201, 404, 409].includes(created.status), JSON.stringify(created));
    assert.ok([200, 409].includes(deleted.status), JSON.stringify(deleted));
    const storedEvent = await Event.findById(e.id);
    const count = await Booking.countDocuments({ event: e.id });
    if (created.status === 201) {
      assert.equal(deleted.status, 409);
      assert.ok(storedEvent);
      assert.equal(storedEvent.tickets_sold, 2);
      assert.equal(count, 1);
    } else {
      assert.equal(deleted.status, 200);
      assert.equal(storedEvent, null);
      assert.equal(count, 0);
    }
  }
});

test('capacity updates racing bookings cannot reduce capacity below reservations', async () => {
  const e = await event();
  const [created, updated] = await Promise.all([
    book(e, 8), request(`/events/${e.id}`, { method: 'PUT', token: organizerToken, body: { total_capacity: 5 } })
  ]);
  assert.ok([201, 409].includes(created.status));
  assert.ok([200, 409].includes(updated.status));
  const stored = await Event.findById(e.id);
  assert.ok(stored.tickets_sold <= stored.total_capacity);
});

test('unpublished, cancelled and past events reject reservations', async () => {
  for (const overrides of [{ status: 'draft' }, { status: 'cancelled' }, { start_date: new Date(Date.now() - 60000) }]) {
    const e = await event(overrides);
    assert.equal((await book(e)).status, 409);
    assert.equal(await sold(e), 0);
  }
  assert.equal((await book({ id: new mongoose.Types.ObjectId().toString() })).status, 404);
});

test('validation failures and injected client fields never reserve tickets', async () => {
  const e = await event();
  for (const value of [0, -1, 1.5, 'abc', 9007199254740992, [1], true]) {
    assert.equal((await request('/bookings', { method: 'POST', body: { ...details(e), number_of_tickets: value } })).status, 400);
  }
  assert.equal((await request('/bookings', { method: 'POST', body: { ...details(e), event: { $ne: null } } })).status, 400);
  assert.equal((await request('/bookings', { method: 'POST', body: { ...details(e), special_requirements: 'x'.repeat(501) } })).status, 400);
  assert.equal((await book(e, 1, 'not-a-uuid')).status, 400);
  assert.equal(await sold(e), 0);
  const result = await request('/bookings', { method: 'POST', body: { ...details(e), user: other.id, total_amount: 0, booking_status: 'cancelled' } });
  assert.equal(result.status, 201);
  assert.equal(result.data.booking.user, attendee.id);
  assert.equal(result.data.booking.total_amount, 19.95);
  assert.equal(result.data.booking.booking_status, 'confirmed');
});

test('organizer event creation and update protect inventory and organizer fields', async () => {
  const body = { title: 'Published test', event_type: 'workshop', venue_name: 'Hall', venue_city: 'City', start_date: future(), end_date: null, ticket_price: 0, total_capacity: 5, status: 'published', tickets_sold: 4, organizer: other.id, featured: true };
  assert.equal((await request('/events', { method: 'POST', body })).status, 403);
  const result = await request('/events', { method: 'POST', body, token: organizerToken });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal(result.data.event.tickets_sold, 0);
  assert.equal(result.data.event.organizer, organizer.id);
  assert.equal(result.data.event.featured, false);
  const id = result.data.event._id;
  assert.equal((await request(`/events/${id}`, { method: 'PUT', token: organizerToken, body: { tickets_sold: 5, organizer: other.id } })).status, 200);
  assert.equal((await Event.findById(id)).tickets_sold, 0);
  assert.equal((await Event.findById(id)).organizer.toString(), organizer.id);
  const secondOrganizer = await User.create({ name: 'Other host', email: 'otherhost@test.example', password: 'password123', role: 'organizer' });
  assert.equal((await request(`/events/${id}`, { method: 'DELETE', token: sign(secondOrganizer) })).status, 403);
});

test('event dates, capacity and safe literal search are validated', async () => {
  const e = await event();
  for (const body of [{ total_capacity: 1.5 }, { start_date: 'invalid' }, { end_date: new Date(Date.now() - 60000).toISOString() }, { ticket_price: 0.001 }]) {
    assert.equal((await request(`/events/${e.id}`, { method: 'PUT', token: organizerToken, body })).status, 400);
  }
  await event({ title: 'Literal (test)' });
  const result = await request('/events?search=%28test%29&limit=1', { token: null });
  assert.equal(result.status, 200);
  assert.equal(result.data.total, 1);
  assert.equal(result.data.events[0].title, 'Literal (test)');
  assert.equal(result.data.events[0].organizer.email, undefined);
  assert.equal((await request('/events?search[$ne]=x')).status, 200);
  assert.equal((await request('/events?limit=1000')).status, 400);
});

test('draft events are private and legacy missing event history remains readable', async () => {
  const e = await event({ status: 'draft' });
  assert.equal((await request(`/events/${e.id}`, { token: null })).status, 404);
  assert.equal((await request(`/events/${e.id}`, { token: organizerToken })).status, 200);
  assert.equal((await request('/events', { token: null })).data.events.length, 0);
  await Event.updateOne({ _id: e.id }, { status: 'published' });
  const created = await book(e);
  await Event.deleteOne({ _id: e.id }); // Simulate an orphan from an older application version.
  const history = await request('/bookings/my');
  assert.equal(history.status, 200);
  assert.equal(history.data.bookings[0].event, null);
  assert.equal(history.data.bookings[0].event_snapshot.title, e.title);
  assert.equal((await cancel(created.data.booking._id)).status, 409);
});

test('authentication normalizes email and limits bcrypt password input', async () => {
  const registered = await request('/auth/register', { method: 'POST', token: null, body: { name: 'New User', email: 'NEW@test.example', password: 'password123' } });
  assert.equal(registered.status, 201);
  const loggedIn = await request('/auth/login', { method: 'POST', token: null, body: { email: 'NEW@TEST.EXAMPLE', password: 'password123' } });
  assert.equal(loggedIn.status, 200);
  assert.equal(loggedIn.data.user.email, 'new@test.example');
  assert.equal(loggedIn.data.user.password, undefined);
  assert.equal((await request('/auth/register', { method: 'POST', token: null, body: { name: 'New User', email: 'new@test.example', password: 'password123' } })).status, 409);
  assert.equal((await request('/auth/register', { method: 'POST', token: null, body: { name: 'User', email: 'long@test.example', password: 'x'.repeat(73) } })).status, 400);
});

test('health, unknown API routes, malformed JSON and security headers are consistent', async () => {
  const health = await request('/health', { token: null });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(health.headers.get('x-request-id'));
  assert.equal((await request('/health/ready', { token: null })).status, 200);
  assert.equal((await request('/does-not-exist', { token: null })).status, 404);
  const invalid = await fetch(`${base}/api/bookings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error, 'Request body must contain valid JSON');
  assert.equal((await request('/bookings', { method: 'POST', body: details(await event()), headers: { 'Content-Type': 'text/plain' } })).status, 415);
});
