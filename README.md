# Lumina Events

A React and Express application for discovering events, publishing events, reserving tickets, and managing bookings. Ticket amounts are reservation totals; this application does not collect payments or issue refunds.

## Requirements

- Node.js 24 LTS (see `.nvmrc`).
- MongoDB Atlas or a MongoDB replica set. A standalone MongoDB server cannot run the booking transactions and is rejected at startup.
- HTTPS at your production hosting provider or reverse proxy.

## Local development

```bash
npm ci
```

Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`. Generate a secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

For a disposable local MongoDB instance, start MongoDB with replication enabled and initialize it once:

```bash
mongod --replSet rs0 --bind_ip 127.0.0.1 --dbpath /your/development/database-directory
mongosh --eval 'rs.initiate()'
```

Create the database directory first. Atlas requires no local MongoDB installation.

```bash
npm run dev
```

The frontend runs at `http://localhost:3000`; Vite proxies `/api` to the backend port in `.env` (default 5000). Node's built-in watcher restarts the backend. These commands work on Windows, Linux and macOS.

Optional demo data **deletes all users, events and bookings in the configured development database**:

```bash
npm run seed -- --reset
```

Seeding refuses production mode and requires the explicit reset flag. Demo events start in the future and their reserved counts match real demo bookings.

## Production deployment

This is a single-service deployment: Express serves the frontend from `dist` and the API from `/api`. Deep links such as `/events/:id` serve the app; unknown API paths and missing assets return JSON errors.

Set these environment variables through your hosting provider's secret/configuration controls:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas or replica-set connection string, including the database name |
| `JWT_SECRET` | Unique generated secret, at least 32 bytes |
| `JWT_EXPIRE` | Token lifetime, default `7d` |
| `PORT` | Provider-assigned listening port, default `5000` |
| `HOST` | Default `0.0.0.0` |
| `CORS_ORIGINS` | Empty for this same-origin deployment; otherwise comma-separated exact HTTPS frontend origins |
| `TRUST_PROXY` | Exact number of trusted proxy hops; default `0`. Use `1` only when all traffic passes through one trusted proxy. |

For a typical managed Node host:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Readiness path: `/api/health/ready`
- Liveness path: `/api/health`

Install build dependencies during the build stage. A final runtime installation can use `npm ci --omit=dev`. The application waits for the database and additive indexes before listening, refuses missing frontend builds in production, and drains requests on SIGTERM/SIGINT.

A Dockerfile is included:

```bash
docker build -t lumina-events .
docker run --rm -p 5000:5000 --env-file /your/private/production.env lumina-events
```

The image builds the frontend in a separate stage, installs only production dependencies in its runtime stage, runs as a non-root user, and includes a readiness health check. Configuration files and local secrets are excluded from the image.

### Before upgrading an existing database

Back up the database and run:

```bash
npm run check:data
```

This read-only check compares `tickets_sold` with confirmed/pending booking ticket counts and reports missing events or invalid capacity. It exits nonzero when data is inconsistent. Older versions and the old demo seeder may have left inconsistent counters or orphan bookings; reconcile them against actual booking history before accepting production reservations. The command does not automatically change records. Startup adds the user, event and unique booking-request indexes without removing existing indexes.

The included rate limiters use per-process memory. The supplied deployment supports one application instance. Before running multiple instances, configure a shared rate-limit store and verify the proxy trust configuration; booking correctness itself uses MongoDB transactions and does not depend on process memory.

## Booking consistency and retry behavior

- Reservation and booking creation share one transaction with snapshot reads and majority writes. Failed inserts or population reads abort both writes; transient conflicts are retried by the database driver.
- Send `Idempotency-Key: <UUID v4>` when creating a booking. The frontend creates one key per booking modal and preserves it across retries. Keys are scoped to the user. A repeated identical request returns the original booking with HTTP 200; different details with the same key return HTTP 409. New bookings return HTTP 201. API clients should preserve the key if a response is interrupted. The key remains associated with the booking after cancellation.
- Cancellation is idempotent: repeated requests return HTTP 200, and status and ticket release commit together. Inconsistent legacy inventory returns HTTP 409 without making counters negative.
- Deletion writes the event inside its transaction before checking booking history. A concurrent reservation writes the same event, forcing a conflict/retry. Any confirmed, pending, or cancelled booking blocks deletion. Cancel the event instead; attendees can still view and cancel their bookings.
- Organizers cannot supply inventory or another organizer's ID. Capacity updates also transact against the event and cannot reduce capacity below current reservations.
- Draft, cancelled, completed and already-started events cannot accept reservations. Draft detail pages are visible only to the owner.
- Event snapshots preserve booking history if a legacy event is missing. Missing-event bookings remain readable; cancellation reports the inconsistency for an organizer to investigate.

## Validation

```bash
npm test
npm run build
npm audit
```

`npm run test:server` runs HTTP integration tests against a disposable MongoDB 8 replica set and runtime tests. It never uses `MONGO_URI` from your environment for integration-test data. The first test run downloads a MongoDB binary; network access and permission to start native processes are required. CI caches that binary.

Tests cover simultaneous last-seat bookings, creation/read failures, idempotent booking requests, cancellation retries and failures, authorization, negative inventory, booking/deletion races, capacity changes, event validation, private drafts, API errors, rate limits, and production frontend serving. Frontend tests cover booking retry keys, disabled submission, missing history records, header merging, response parsing, session expiry and request timeouts.

GitHub Actions runs the tests, build, production dependency audit and Docker build on PRs and pushes. Require the `test-and-build` and `container-build` jobs before merging. Server errors omit internal exception messages; request IDs help correlate failures. Health checks contain no credentials or user information.
