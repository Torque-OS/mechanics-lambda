<p align="center">
  <img src="logo.png" alt="Torque-OS" width="220"/>
</p>

# mechanics-lambda

Serverless Function for CPF-based authentication — part of the [Torque-OS](https://github.com/Torque-OS) Mechanics Software platform.

## Overview

AWS Lambda function that acts as an API Gateway Authorizer:
1. Validates the CPF format and check digits
2. Queries the database to verify the customer exists and is active
3. Returns a signed JWT for consumption of protected API routes

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
            ├─→ Lambda Authorizer (this repo)
            │         │
            │         ├─ Validate CPF (format + check digits)
            │         ├─ Query RDS → customer exists & active?
            │         └─ Return JWT
            │
            └─→ EKS (mechanics-software API)
```

## Project Structure

```
src/
  handler.js       # Lambda entry point
  cpf.js           # CPF validation logic
  db.js            # RDS connection and customer lookup
  jwt.js           # JWT generation
tests/
  cpf.test.js
  handler.test.js
```

## Local Development

```bash
npm install
npm test
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | RDS PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) |
| `JWT_EXPIRATION` | Token expiration (e.g. `3600`) |

## CI/CD

GitHub Actions pipeline on every push/PR to `main`:
- Lint + unit tests
- Deploy to AWS Lambda

## Related Repositories

| Repo | Purpose |
|------|---------|
| [mechanics-software](https://github.com/Torque-OS/mechanics-software) | Main API application |
| [mechanics-infra-k8s](https://github.com/Torque-OS/mechanics-infra-k8s) | Terraform — VPC + EKS |
| [mechanics-infra-db](https://github.com/Torque-OS/mechanics-infra-db) | Terraform — RDS PostgreSQL |
