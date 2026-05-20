# CI/CD Architecture

## Pipelines

1. `backend-ci.yml`
- Maven cached build/test pipeline
- Unit + integration tests
- Checkstyle + SpotBugs
- OWASP dependency scan

2. `frontend-ci.yml`
- Node/npm cache
- TypeScript type checks
- ESLint
- Next.js build validation
- bundle size threshold gate

3. `ai-mcp-ci.yml`
- MCP server build/audit
- AI backend build/prisma/audit
- AI frontend typecheck/build/audit

4. `security.yml`
- Gitleaks secret scan
- npm dependency audits
- Trivy filesystem scan with SARIF upload

5. `docker-build-publish.yml`
- Multi-image Buildx builds
- deterministic tags (`sha-*`, branch, semver, latest)
- GHCR push
- post-build image vulnerability scan

6. `deploy.yml`
- Manual staged deployment
- environment-specific approval gates
- post-deploy health checks
- smoke tests
- automatic rollback hook on failure

## Versioning Strategy

- Immutable runtime artifact tag: `sha-<git_sha>`
- Human-facing release tag: `vX.Y.Z`
- `latest` only for default branch convenience; never use as deployment source of truth

## Promotion Strategy

- Build once per commit SHA.
- Promote same image digest from staging to production.
- Avoid rebuilding for production to preserve supply-chain integrity.

## Rollback Strategy

- Keep previous deployment metadata in the target platform.
- Roll back to previous stable image tag/digest with `ROLLBACK_CMD`.
- Re-run health and smoke tests after rollback.
