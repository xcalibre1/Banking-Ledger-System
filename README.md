# Ledger Banking System

A take-home banking / ledger application with concurrent-safe transfers, compensating reversals, and append-only audit logging. Built with **NestJS**, **PostgreSQL**, **Prisma**, and a **React** web UI.

## Quick start

### Prerequisites

- Node.js 20+
- PostgreSQL — **Neon** (cloud) or **Docker** (local)

### 1. Database

#### Option A — Neon (cloud)

1. Create a project at [neon.tech](https://neon.tech).
2. Open **Connection details** in the Neon console.
3. Copy both connection strings into `.env`:

```bash
cp .env.example .env
```

```env
# Pooled — used by the app at runtime
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Direct — required for Prisma migrations (no -pooler in host)
DIRECT_URL="postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
```

Use the **Pooled connection** for `DATABASE_URL` and the **Direct connection** for `DIRECT_URL`. Both must include `?sslmode=require`.

#### Option B — Local Docker

```bash
docker compose up -d
```

PostgreSQL runs on **port 5433**. Set the same URL for both variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/ledger_banking?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/ledger_banking?schema=public"
```

### 2. Install dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your Neon or local connection strings (see step 1)
```

### 4. Run migrations

```bash
npm run db:generate
npm run db:migrate:deploy
```

For local development with migration prompts:

```bash
npm run db:migrate
```

### 5. Start the app

**Terminal 1 — API (port 3001)**

```bash
npm run dev:server
```

**Terminal 2 — Web UI (port 5173)**

```bash
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to the Nest API.

### Production build

```bash
npm run build
npm run build:client
npm start
```

## Assumptions

These are explicit simplifications for the take-home scope:

| Assumption | Detail |
|------------|--------|
| **Single currency** | USD only; no FX or multi-currency support |
| **No authentication** | Anyone with API access can transfer or reverse; suitable for local demo only |
| **Balance floor** | Accounts cannot go below **$0.00** (no overdraft) |
| **Money representation** | Amounts are positive decimals stored as `NUMERIC(19,4)` in PostgreSQL; API uses string decimals (e.g. `"50.00"`) to avoid JavaScript float errors |
| **Account creation** | `POST /accounts` is a demo seeding endpoint; initial balance is set directly on the account (not via a formal deposit transaction/ledger entry) |
| **Deposit / withdrawal** | Not implemented as separate API flows; schema enums exist for future extension |
| **Reversal policy** | Reversal debits the original destination account. If that account no longer has enough funds, reversal fails with `INSUFFICIENT_FUNDS` |
| **One reversal per transfer** | Enforced by unique `reverses_transaction_id` and domain checks |
| **Idempotency** | Client must send `Idempotency-Key` header on transfers and reversals; keys are persisted indefinitely (no TTL cleanup) |
| **Request tracing** | Optional `X-Request-Id` header; server generates a UUID if omitted |
| **Closed accounts** | Transfers to/from closed accounts are rejected |

## Architecture

```
Browser (React + RTK Query)
        │  REST /api/v1/*
        ▼
NestJS controllers
        │
        ▼
Domain services (transfers, reversals, accounts)
        │
        ▼
Repositories (Prisma)
        │
        ▼
PostgreSQL (accounts, transactions, ledger_entries, audit_events, idempotency_keys)
```

### Core design choices

**Append-only ledger + cached balance**

Each completed transfer writes:

1. A `transactions` row
2. Two `ledger_entries` (debit source, credit destination)
3. Updated `accounts.balance` for both parties

`accounts.balance` is a performance cache updated inside the same database transaction as the ledger entries. The ledger is the audit trail for money movement; balance is derived and kept in sync atomically.

**Concurrency: ordered pessimistic locking**

Transfers and reversals run inside a single `prisma.$transaction`. Affected accounts are locked with `SELECT … FOR UPDATE` in **deterministic UUID order** to prevent deadlocks while serializing concurrent writers on the same account.

**Reversal: compensating transaction**

Reversals do not delete history. A new `reversal` transaction applies opposite ledger entries, marks the original as `reversed`, and is idempotent via `Idempotency-Key`.

**Audit: append-only**

Every balance-changing operation and validation failure at the service layer writes to `audit_events`. Success rows commit in the same transaction as the business write. Failure rows commit in a separate transaction so they survive rollbacks.

## API

Base path: `/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/accounts` | List accounts with balances |
| `POST` | `/accounts` | Create account (optional `initialBalance`) |
| `POST` | `/transfers` | Transfer between accounts (`Idempotency-Key` required) |
| `GET` | `/transactions` | Recent completed transfers |
| `POST` | `/transactions/:id/reverse` | Reverse a completed transfer (`Idempotency-Key` required) |
| `GET` | `/health` | Health check |

### Headers

| Header | Required | Purpose |
|--------|----------|---------|
| `Idempotency-Key` | Transfers, reversals | Deduplicate retries |
| `X-Request-Id` | Optional | Correlation ID for audit events |

### Error codes

| Code | HTTP | When |
|------|------|------|
| `INVALID_REQUEST` | 400 | Bad input, missing idempotency key |
| `ACCOUNT_NOT_FOUND` | 404 | Unknown account |
| `TRANSACTION_NOT_FOUND` | 404 | Unknown transaction |
| `INSUFFICIENT_FUNDS` | 409 | Would breach balance floor |
| `ACCOUNT_CLOSED` | 409 | Account not active |
| `NOT_REVERSIBLE` | 409 | Transaction not in reversible state |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key, different request body |

## Audit logging

Audit events are stored in `audit_events` and can be inspected via Prisma Studio:

```bash
npm run db:studio
```

| Operation | `operation_type` | When logged |
|-----------|------------------|-------------|
| Account create | `CREATE_ACCOUNT` | Success (in txn) and validation failures |
| Transfer | `TRANSFER` | Success (in txn) and failures (e.g. insufficient funds) |
| Reversal | `REVERSE` | Success (in txn) and failures |

Each event includes: operation type, involved accounts, amount, outcome (`success` / `failure`), timestamp, `request_id`, and optional error details.

## Testing

### Smoke test (transfer + idempotency)

Verifies a basic transfer, idempotent replay, and final balances:

```bash
npm run test:smoke
```

Requires PostgreSQL running and migrations applied.

### Concurrency test (recommended)

The assignment requires **scripts, a load test, or documented manual steps** to demonstrate concurrent transfer safety. A small automated script is the simplest option — no separate load-testing tool required.

```bash
npm run test:concurrency
```

**What it does:**

1. Creates a source account with **$100.00**
2. Fires **20 parallel transfers** of **$10.00** each from the same source
3. Asserts:
   - Exactly **10** transfers succeed (only $100 available)
   - Final source balance is **$0.00** (never negative)
   - Final destination balance is **$100.00**
   - Remaining requests fail with `INSUFFICIENT_FUNDS` or, under heavy parallel load, occasional deadlock retries

This proves that concurrent transfers cannot overdraw the source account. The important invariant is **balance correctness**, not that every HTTP request succeeds on the first try.

#### Manual concurrency check (alternative)

If you prefer not to run the script:

1. Create an account with **$100** via the UI
2. Open browser devtools and run 20 parallel `fetch` calls to `POST /api/v1/transfers` with unique `Idempotency-Key` values
3. Refresh accounts — source should be **$0.00**, destination **$100.00**

Example (replace account IDs):

```javascript
const from = "<source-account-id>";
const to = "<destination-account-id>";
await Promise.all(
  Array.from({ length: 20 }, () =>
    fetch("/api/v1/transfers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({ fromAccountId: from, toAccountId: to, amount: "10.00" }),
    }),
  ),
);
```

## Frontend

React + Vite + RTK Query feature modules:

- **Accounts** — list balances, create accounts
- **Transfers** — move money with clear error messages
- **Transactions** — history with reverse action

After mutations, RTK Query tag invalidation refreshes account balances automatically.

## Project structure

```
src/
  accounts/          # Account CRUD
  transfers/         # Transfer service + controller
  transactions/      # History + reversal
  repositories/      # Prisma data access
  models/            # Domain types and errors
  scripts/           # Smoke and concurrency tests
client/
  src/features/      # Feature-based React modules
prisma/
  schema.prisma      # Data model
  migrations/        # SQL migrations
```

## Deployment (Render + Vercel)

Split deploy: **Render** hosts the API, **Vercel** hosts the React client.

### Render (backend)

| Setting | Value |
|---------|--------|
| Root Directory | *(empty — repo root)* |
| Build Command | `npm install --include=dev && npm run db:generate && npm run db:migrate:deploy && npm run build` |
| Start Command | `npm run start` |
| Health Check | `/api/health` |

**Environment variables:**

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `CORS_ORIGIN` | Your Vercel URL(s), comma-separated |

Example:

```env
CORS_ORIGIN=https://banking-ledger-system.vercel.app,https://banking-ledger-system-git-main.vercel.app
```

### Vercel (frontend)

| Setting | Value |
|---------|--------|
| Root Directory | `client` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

**Environment variable:**

| Key | Value | Environments |
|-----|--------|--------------|
| `VITE_API_URL` | `https://YOUR-RENDER-APP.onrender.com/api/v1` | Production, Preview |

Local dev: leave `VITE_API_URL` unset — the client uses `/api/v1` and Vite proxies to `localhost:3001`.

## Trade-offs and known limitations

| Topic | Choice | Limitation |
|-------|--------|------------|
| Concurrency | `FOR UPDATE` row locks + deadlock retry | Hot accounts serialize; PostgreSQL deadlocks are retried up to 3 times |
| Account seeding | Direct balance set | No ledger entry for initial balance; audited via `CREATE_ACCOUNT` |
| Reversal | Strict balance check | Cannot reverse if destination spent the funds |
| Auth | None | Not production-ready |
| Idempotency | Persisted forever | Table grows without TTL cleanup |

## Scripts reference

| Command | Description |
|---------|-------------|
| `npm run dev:server` | Nest API with hot reload |
| `npm run dev:client` | Vite dev server |
| `npm run db:migrate:deploy` | Apply migrations (CI / fresh setup) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:smoke` | Basic transfer smoke test |
| `npm run test:concurrency` | Parallel transfer concurrency test |
