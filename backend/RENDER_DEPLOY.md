# Deploy Backend On Render

This project is prepared for Render using the root `render.yaml` blueprint.

## 1) Create Backend Service

- Push your latest code to GitHub.
- In Render, choose **New +** -> **Blueprint**.
- Select this repository.
- Render will detect `render.yaml` and create:
  - `ecommerce-backend` (Docker web service)
  - `ecommerce-postgres` (PostgreSQL)

## 2) Required Environment Variables

After the service is created, open the backend service and set these vars:

- `FRONTEND_URL` = your main Vercel URL (e.g. `https://frontend-six-swart-65.vercel.app`)
- `CORS_ALLOWED_ORIGINS` = **required if the browser address bar does not match `FRONTEND_URL`** (common with Vercel preview deployments). Use a comma-separated list with **no trailing slashes**, e.g. `https://your-main.vercel.app,https://frontend-xxx-your-team.vercel.app`
- `APPLICATION_SERVER_URL` = your Render backend domain (must be **https**, e.g. `https://ecommerce-backend.onrender.com`). This enables `SameSite=None` on the auth cookie so order history and other authenticated API calls work from the Vercel origin.
- `SPRING_MAIL_USERNAME`
- `SPRING_MAIL_PASSWORD`
- `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID`
- `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET`
- `SPRING_PROFILES_INCLUDE=oauth` (after Google client ID/secret are set)
- `VNPAY_HASH_SECRET`

If you use Redis and RabbitMQ in production, also set:

- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`

RabbitMQ is **disabled by default** in `application.yml` (`SPRING_RABBITMQ_ENABLED` defaults to `false`), so you should not see `localhost:5672` on Render unless you turned it on.

To use **CloudAMQP** (or any broker), set **`SPRING_RABBITMQ_ENABLED=true`** and **`SPRING_RABBITMQ_URI=amqps://...`** in Render.

## 3) Update Vercel Frontend Variables

In your Vercel project, set:

- `NEXT_PUBLIC_API_URL` = `https://<your-render-domain>/api`
- `BACKEND_URL` = `https://<your-render-domain>`
- `INTERNAL_NOTIFY_TOKEN` = same value as backend `INTERNAL_NOTIFY_TOKEN`

Then redeploy Vercel.

## 4) Smoke Test

- Open `https://<your-render-domain>/api/products`
- Test login/signup
- Test cart and checkout
- Test admin and payment return flow
