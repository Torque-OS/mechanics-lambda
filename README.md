<p align="center">
  <img src="logo.png" alt="Torque-OS" width="220"/>
</p>

# mechanics-lambda

Serverless authentication service for the Torque-OS Mechanics Software platform. Two AWS Lambda functions deployed from a single package:

| Function name | Handler | Role |
|---|---|---|
| `mechanics-lambda` | `src/handler.handler` | **Token issuer** — `POST /auth`, validates CPF, returns JWT |
| `mechanics-lambda-authorizer` | `src/authorizer.handler` | **API Gateway authorizer** — validates JWT on every protected route |

> **Part of the [Torque-OS](https://github.com/Torque-OS) platform** — see [how repos link together](#platform-overview) below.

---

## Platform Overview

```
Internet
  │
  └─ API Gateway (HTTP API v2)         ← mechanics-infra-k8s
        │
        ├── POST /auth  ─────────────── mechanics-lambda (handler.js)
        │                                     │
        │                     1. Validate CPF (format + check digits)
        │                     2. Query RDS → customer exists & active?
        │                     3. Sign JWT (HS256, role=CUSTOMER)
        │                     4. Return { token }
        │
        └── ANY /{proxy+} ──────────── mechanics-lambda-authorizer (authorizer.js)
                  │                          │
                  │             1. Extract Bearer token from Authorization header
                  │             2. Verify JWT signature, iss, aud, exp
                  │             3. Return { isAuthorized, context: { cpf, role } }
                  │
                  ▼ (authorized)
               VPC Link ── NLB ── EKS Pods    ← mechanics-software
```

**This repo must be deployed before `mechanics-infra-k8s` (pass 2)** — the API Gateway Terraform reads both Lambda names via `data "aws_lambda_function"`, which fails if the functions don't exist yet.

---

## What This Repo Does

- Validates Brazilian CPF numbers (11 digits + two check digit algorithm).
- Looks up the customer in the RDS database by CPF.
- Issues a signed JWT (`HS256`) with claims `sub`, `cpf`, `role`, `iss`, `aud`, `jti`.
- Validates JWTs on behalf of API Gateway for every protected route — no database access at this stage.
- The `role` claim distinguishes customers (`CUSTOMER`) from shop staff (`ADMIN`, `ATTENDANT`, `MECHANIC`) — staff tokens are issued by `mechanics-software` at `POST /api/auth/login`.

---

## Tech Stack

- **Runtime:** Node.js 20 (ESM — `"type": "module"`)
- **Dependencies:** `jsonwebtoken`, `pg`
- **Test framework:** Jest 29 with `--experimental-vm-modules` (required for ESM)
- **Cloud:** AWS Lambda + API Gateway

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| AWS CLI | ≥ 2 (for deploy only) |

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

Copy and fill in `.env` for local runs (the tests mock all external dependencies, so you only need this for manual invocations):

```bash
cp .env.example .env   # or create manually
```

```env
DATABASE_URL=postgresql://mechanic_admin:password@localhost:5432/mechanicssoftware
JWT_SECRET=dev-secret-change-in-production-min-32-chars!!
JWT_EXPIRATION=3600
JWT_ISSUER=torque-os
JWT_AUDIENCE=mechanics-software-api
```

> `JWT_SECRET`, `JWT_ISSUER`, and `JWT_AUDIENCE` **must match exactly** what is configured in `mechanics-software`. Both sides sign and verify with the same values.

### 3. Run locally (manual invocation)

You can invoke a handler directly with Node.js to test end-to-end against a real database:

```bash
# Test the CPF auth handler
node -e "
  import('./src/handler.js').then(({ handler }) =>
    handler({ cpf: '529.982.247-25' }).then(console.log)
  )
"

# Test the authorizer
node -e "
  import('./src/authorizer.js').then(({ handler }) =>
    handler({ headers: { authorization: 'Bearer <your-jwt>' } }).then(console.log)
  )
"
```

---

## Testing

All tests run in isolation with mocked external dependencies (`db.js`, `jwt.js`). No database or AWS connection is required.

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

### What is tested

| Test file | Covers |
|---|---|
| `tests/cpf.test.js` | CPF format validation, all-same-digit rejection, valid/invalid check digit scenarios |
| `tests/handler.test.js` | Missing CPF, invalid CPF, customer not found, inactive customer, happy path |
| `tests/authorizer.test.js` | Missing header, malformed header, invalid token, expired token, valid token with context |
| `tests/jwt.test.js` | Token generation, expiration, missing secret |

### Example test run output

```
 PASS  tests/cpf.test.js
 PASS  tests/handler.test.js
 PASS  tests/authorizer.test.js
 PASS  tests/jwt.test.js

Test Suites: 4 passed, 4 total
Tests:       18 passed, 18 total
```

### Valid CPF for testing

The test suite uses `529.982.247-25` — a mathematically valid CPF (not a real person).

```bash
# Other valid test CPFs:
# 111.444.777-35
# 871.595.540-60
```

---

## Project Structure

```
src/
  handler.js      # POST /auth — CPF auth → JWT issuance
  authorizer.js   # API Gateway REQUEST authorizer — JWT validation
  config.js       # Shared JWT config (secret, issuer, audience, expiration)
  cpf.js          # CPF validation: format + check digit algorithm
  db.js           # pg Pool — customer lookup by CPF against RDS
  jwt.js          # jsonwebtoken wrapper — sign and return JWT

tests/
  cpf.test.js
  handler.test.js
  authorizer.test.js
  jwt.test.js

.github/
  workflows/
    ci-cd.yml     # Test on PR, deploy both functions on merge to main
```

---

## Environment Variables

| Variable | Used by | Description | Default |
|---|---|---|---|
| `DATABASE_URL` | `handler.js` only | PostgreSQL connection string for customer lookup | — (required) |
| `JWT_SECRET` | both | Shared secret for signing/verifying tokens. **Minimum 32 chars.** Must be identical to `mechanics-software`. | — (required) |
| `JWT_EXPIRATION` | `handler.js` only | Token lifetime **in seconds** | `3600` |
| `JWT_ISSUER` | both | `iss` claim in the token. Must match on both sides. | `torque-os` |
| `JWT_AUDIENCE` | both | `aud` claim in the token. Must match on both sides. | `mechanics-software-api` |

> **Unit difference:** this repo uses `JWT_EXPIRATION` in **seconds**. The `mechanics-software` API uses `JWT_EXPIRATION_MINUTES` in **minutes**. Default of `3600 s` = `60 min` — they match.

---

## Token Claims

Tokens issued by the `handler` (CPF auth — customer tokens):

| Claim | Value | Notes |
|---|---|---|
| `sub` | Customer UUID | Identifies the customer |
| `cpf` | CPF digits only (no punctuation) | Used for tracing |
| `role` | `CUSTOMER` | API authorizes resources by role |
| `iss` | `torque-os` | Must match authorizer config |
| `aud` | `mechanics-software-api` | Must match authorizer config |
| `jti` | Random UUID | Prevents replay (stateless — not stored) |
| `exp` | Now + `JWT_EXPIRATION` | Unix timestamp |

Staff tokens (`ADMIN`, `ATTENDANT`, `MECHANIC`) are issued by `mechanics-software` at `POST /api/auth/login`. The authorizer validates both token types identically — it only checks signature, expiry, issuer, and audience.

---

## CI/CD

Pipeline defined in `.github/workflows/ci-cd.yml`:

| Trigger | Jobs |
|---|---|
| Pull Request → `main` | `npm ci` + `npm test` |
| Push → `main` (merge) | tests + zip `src/ node_modules/ package.json` + deploy both functions |

### Deploy logic

The pipeline uses `aws lambda get-function` to detect whether each function already exists:

- **Exists:** `update-function-code` + `update-function-configuration`
- **Does not exist:** `create-function` with runtime, handler, role, memory, timeout

Both functions are deployed from the **same zip file** but with **different handlers**:

| Function | Handler | Memory | Timeout |
|---|---|---|---|
| `mechanics-lambda` | `src/handler.handler` | 256 MB | 15 s |
| `mechanics-lambda-authorizer` | `src/authorizer.handler` | 128 MB | 5 s |

### Secrets required in this repo

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS Academy key |
| `AWS_SECRET_ACCESS_KEY` | AWS Academy secret |
| `AWS_SESSION_TOKEN` | AWS Academy session token (rotate each lab session) |
| `LAMBDA_ROLE_ARN` | IAM role ARN for Lambda execution (from AWS Academy console) |
| `DATABASE_URL` | Full PostgreSQL URL to the RDS instance (from `mechanics-infra-db` output) |
| `JWT_SECRET` | Shared secret — **must match `mechanics-software`** |

### Setting secrets

```bash
gh secret set AWS_ACCESS_KEY_ID     --repo Torque-OS/mechanics-lambda
gh secret set AWS_SECRET_ACCESS_KEY --repo Torque-OS/mechanics-lambda
gh secret set AWS_SESSION_TOKEN     --repo Torque-OS/mechanics-lambda
gh secret set LAMBDA_ROLE_ARN       --repo Torque-OS/mechanics-lambda
gh secret set DATABASE_URL          --repo Torque-OS/mechanics-lambda
gh secret set JWT_SECRET            --repo Torque-OS/mechanics-lambda
```

### Getting the Lambda Role ARN (AWS Academy)

```
AWS Console → IAM → Roles → search "LabRole" → copy ARN
```

---

## How to Call the API

### Get a customer token (CPF auth)

```http
POST https://<api-gateway-url>/auth
Content-Type: application/json

{
  "cpf": "529.982.247-25"
}
```

Response:
```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Use the token as `Authorization: Bearer <token>` on all subsequent requests.

### Error responses

| Status | Condition |
|---|---|
| `400` | CPF missing or invalid format/check digit |
| `403` | Customer exists but `active = false` |
| `404` | No customer found with this CPF |

---

## Related Repositories

| Repo | Role |
|---|---|
| [mechanics-software](https://github.com/Torque-OS/mechanics-software) | Main API — issues staff tokens, enforces roles |
| [mechanics-infra-k8s](https://github.com/Torque-OS/mechanics-infra-k8s) | Wires both Lambda functions into the API Gateway |
| [mechanics-infra-db](https://github.com/Torque-OS/mechanics-infra-db) | RDS instance this Lambda queries for customer lookup |
