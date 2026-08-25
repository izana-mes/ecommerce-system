# Test Architecture

## Scope
- Backend: unit, controller, repository, auth, payment, security tests.
- Frontend: component, route, integration tests.
- E2E: Playwright smoke for login/checkout/payment/chatbot/MCP surfaces.
- AI: prompt-injection, tool execution, hallucination fallback, token overflow.

## Backend Stack
- JUnit 5 + Mockito + Testcontainers Postgres.
- JaCoCo coverage at `backend/target/site/jacoco/index.html`.
- Test layout:
  - `backend/src/test/java/.../service/*Test.java`
  - `backend/src/test/java/.../controller/*Test.java`
  - `backend/src/test/java/.../repository/*IT.java`
  - `backend/src/test/java/.../security/*Test.java`
  - `backend/src/test/java/com/example/shop/testutil/*`

## Frontend Stack
- Vitest + React Testing Library + jsdom.
- Coverage at `frontend/coverage`.
- Test layout:
  - `frontend/test/components/*.test.tsx`
  - `frontend/test/routes/*.test.ts`
  - `frontend/test/integration/*.test.ts`
  - Shared factories/mocks in `frontend/test/factories` and `frontend/test/mocks`.

## E2E Stack
- Playwright config at `frontend/playwright.config.ts`.
- Critical flows in `frontend/e2e/critical-flows.spec.ts`.
- Use `E2E_BASE_URL` for deployed/staging environment.

## AI and MCP Test Strategy
- `ai-chatbot-platform/backend/test/ai/mcp-executor.test.ts`
  - tool permission deny
  - tool success execution and logging
- `ai-chatbot-platform/backend/test/ai/agent-guardrails.test.ts`
  - prompt injection sanitization
  - hallucination-safe fallback
  - token overflow detection

## Security Test Strategy
- Backend integration checks in `SecurityIntegrationTest`:
  - auth bypass
  - CSRF enforcement
  - rate-limit behavior
  - permission checks

## CI/CD Integration
- Backend workflow runs unit/integration/security checks + JaCoCo.
- Frontend workflow runs Vitest coverage + Playwright smoke.
- AI workflow runs backend AI tests and includes coverage artifacts.

## Commands
- Backend: `cd backend && mvn clean verify`
- Frontend: `cd frontend && npm test`
- Frontend E2E: `cd frontend && npm run test:e2e`
- AI backend: `cd ai-chatbot-platform/backend && npm test`
