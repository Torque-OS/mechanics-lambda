<p align="center">
  <img src="logo.png" alt="Torque-OS" width="220"/>
</p>

# mechanics-lambda

Serverless Function for CPF-based authentication — part of the [Torque-OS](https://github.com/Torque-OS) Mechanics Software platform.

## Overview

Two Lambda functions built from this single package, deployed from the same zip with
different entry points:

**`mechanics-lambda`** — token issuer, exposed at `POST /auth`:
1. Validates the CPF format and check digits
2. Queries the database to verify the customer exists and is active
3. Returns a signed JWT for consumption of protected API routes

**`mechanics-lambda-authorizer`** — API Gateway REQUEST authorizer, in front of every
protected route. Verifies the JWT signature, issuer, audience and expiry. No database
access, so it stays cheap enough to sit on the hot path.

The native JWT authorizer of the HTTP API is not usable here: it requires an OIDC issuer
with a JWKS endpoint, and these tokens are HS256 signed with a shared symmetric secret.

## Tech Stack

- **Runtime:** Node.js 20
- **Cloud:** AWS Lambda + AWS API Gateway
- **IaC:** Terraform (see [mechanics-infra-k8s](https://github.com/Torque-OS/mechanics-infra-k8s))
- **CI/CD:** GitHub Actions

## Architecture

```
Client
  │
  └─→ AWS API Gateway
            │
            ├─→ POST /auth ─→ mechanics-lambda (this repo)
            │                     │
            │                     ├─ Validate CPF (format + check digits)
            │                     ├─ Query RDS → customer exists & active?
            │                     └─ Return JWT
            │
            └─→ ANY /{proxy+}
                      │
                      ├─ mechanics-lambda-authorizer (this repo) ─→ allow / deny
                      │
                      └─→ EKS (mechanics-software API) — revalidates the same token
```

## Project Structure

```
src/
  handler.js       # Entry point — POST /auth, issues the token
  authorizer.js    # Entry point — API Gateway authorizer, verifies the token
  config.js        # Token settings shared by both entry points
  cpf.js           # CPF validation logic
  db.js            # RDS connection and customer lookup
  jwt.js           # JWT generation
tests/
  cpf.test.js
  handler.test.js
  authorizer.test.js
  jwt.test.js
```

## Token Claims

Both this repo and `mechanics-software` sign with the same secret, issuer and audience,
so either side accepts the other's tokens. The `role` claim is what separates a customer
from a shop employee.

| Claim | Issued by this repo | Notes |
|-------|--------------------|-------|
| `sub` | Customer id | `ClaimTypes` equivalent on the API side |
| `cpf` | Customer CPF (digits only) | Absent on staff tokens |
| `role` | `CUSTOMER` | Staff tokens carry `ADMIN`, `ATTENDANT` or `MECHANIC` |
| `iss` | `torque-os` | Must match on both sides |
| `aud` | `mechanics-software-api` | Must match on both sides |
| `jti` | Random UUID | |

## Local Development

```bash
npm install
npm test
```

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `DATABASE_URL` | issuer | RDS PostgreSQL connection string |
| `JWT_SECRET` | both | Secret for signing/verifying tokens (min 32 chars). Must be identical to the one in `mechanics-software` |
| `JWT_EXPIRATION` | issuer | Token lifetime **in seconds** (default `3600`). Note the API side uses `JWT_EXPIRATION_MINUTES` — different unit, same one hour |
| `JWT_ISSUER` | both | Defaults to `torque-os` |
| `JWT_AUDIENCE` | both | Defaults to `mechanics-software-api` |

## CI/CD

GitHub Actions pipeline on every push/PR to `main`:
- Lint + unit tests
- Deploy both functions to AWS Lambda from the same zip

Because the Terraform in `mechanics-infra-k8s` reads both functions through
`data "aws_lambda_function"`, this repo has to be merged **before** the Terraform is
applied — otherwise the plan fails on a function that does not exist yet.

## Related Repositories

| Repo | Purpose |
|------|---------|
| [mechanics-software](https://github.com/Torque-OS/mechanics-software) | Main API application |
| [mechanics-infra-k8s](https://github.com/Torque-OS/mechanics-infra-k8s) | Terraform — VPC + EKS |
| [mechanics-infra-db](https://github.com/Torque-OS/mechanics-infra-db) | Terraform — RDS PostgreSQL |
