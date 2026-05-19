# Deployment Guide

## Environment
- Set backend `.env` with production values.
- Use managed PostgreSQL with pgvector and managed Redis.
- Store secrets in Vault/SSM/GCP Secret Manager.

## Build
- Backend: `npm ci && npm run build`
- Frontend: `npm ci && npm run build`

## Run
- Deploy backend and frontend containers.
- Put nginx or cloud ingress in front.
- Enable autoscaling for backend workers.

## Hardening
- Enable TLS 1.2+
- Add WAF and IP allowlists for admin routes
- Enable audit log shipping
- Set structured logs to ELK/OpenSearch
- Configure health checks `/health`

## Scaling
- Stateless backend pods behind load balancer
- Shared PostgreSQL + Redis
- Use Redis for distributed rate limits and optional chat stream fanout
- Partition memory/document tables by tenant if large scale
