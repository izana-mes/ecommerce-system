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

- `FRONTEND_URL` = your Vercel domain (e.g. `https://frontend-six-swart-65.vercel.app`)
- `APPLICATION_SERVER_URL` = your Render backend domain (e.g. `https://ecommerce-backend.onrender.com`)
- `SPRING_MAIL_USERNAME`
- `SPRING_MAIL_PASSWORD`
- `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID`
- `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET`
- `VNPAY_HASH_SECRET`

If you use Redis and RabbitMQ in production, also set:

- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`

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
