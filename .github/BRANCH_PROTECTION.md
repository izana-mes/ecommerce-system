# Branch Protection and Deployment Gates

## Protect `main`

Enable branch protection on `main` with:
- Require pull request before merging
- Require approvals: 2
- Dismiss stale pull request approvals when new commits are pushed
- Require conversation resolution before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Restrict who can push directly to `main`

## Required Status Checks

Mark these checks as required:
- `backend-quality`
- `frontend-quality`
- `mcp-server-ci`
- `ai-backend-ci`
- `ai-frontend-ci`
- `secret-scan`
- `dependency-scan`
- `trivy-fs`
- `build-and-push`

## Environment Gates

Use GitHub Environments:
- `staging`
  - required reviewers: 1
  - deployment wait timer: 0-5 minutes
- `production`
  - required reviewers: 2
  - deployment wait timer: 10 minutes
  - restrict to release managers

## Deployment Strategy

- Staging deploy on-demand with production-like config.
- Production deploy only from signed tags (`vX.Y.Z`) or approved manual run.
- Rollback via `ROLLBACK_CMD` secret using prior known-good release.

## Secret Management

Store sensitive values as GitHub Actions secrets:
- `DEPLOY_CMD`
- `HEALTHCHECK_URL`
- `SMOKE_BASE_URL`
- `ROLLBACK_CMD`
- cloud credentials and kubeconfig (if used)

Do not store credentials in repository files.
