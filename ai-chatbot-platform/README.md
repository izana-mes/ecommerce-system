# Production AI Chatbot Platform (OpenAI + MCP)

## 1. Folder Structure

```text
ai-chatbot-platform/
  backend/
    prisma/
      schema.prisma
      seed.ts
      migrations.sql
    src/
      modules/
      services/
      repositories/
      agents/
      mcp/
      memory/
      rag/
      auth/
      tools/
      api/
      websocket/
      utils/
      config/
      types/
      server.ts
  frontend/
    app/
    components/
    hooks/
    stores/
    services/
    lib/
  nginx/
  docs/
```

## 2. Implemented Capabilities
- OpenAI Responses API with multi-step tool-calling agent loop
- Dynamic MCP tool discovery registry + OpenAI tool schema conversion
- MCP transports modeled: `stdio`, `websocket`, `http`
- Tool execution logging, dedupe, loop guard, and permission checks
- Real-time streaming via SSE (`/api/chat/stream`)
- Persistent memory and chat history in PostgreSQL
- Long-term semantic memory and RAG retrieval with pgvector
- File ingestion for PDF/txt/md/code via `/api/rag/ingest`
- JWT auth, rate limiting, DTO-style validation (zod), centralized error handling
- Docker + compose + nginx reverse proxy + deployment guide

## 3. MCP Server Examples
Seeded server templates:
- `filesystem` over `stdio`
- `github` over `stdio`
- `browser` over `websocket`

## 4. Environment Files
- Backend: `backend/.env.example`
- Frontend: `frontend/.env.example`

## 5. Run Locally
1. `cd ai-chatbot-platform/backend && cp .env.example .env`
2. Set `OPENAI_API_KEY` and strong `JWT_SECRET`
3. `cd /home/izana/Projects/ecommerce-system`
4. `docker compose -f ai-chatbot-platform/docker-compose.yml up --build`

## 6. Notes
- Run `npx prisma migrate dev` and `npx prisma db seed` in backend container or locally.
- Production OAuth callback wiring is scaffolded via env vars.
