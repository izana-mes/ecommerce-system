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
- `MAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME` (optional, example: `Shop`)
- `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_ID`
- `SPRING_SECURITY_OAUTH2_CLIENT_REGISTRATION_GOOGLE_CLIENT_SECRET`
- `SPRING_PROFILES_INCLUDE=oauth` (after Google client ID/secret are set)
- `VNPAY_HASH_SECRET`
- `INTERNAL_NOTIFY_TOKEN` — generate one secret value and reuse the exact same value in the frontend service
- `MOMO_ACCESS_KEY` — MoMo Sandbox access key from the MoMo Business Portal
- `MOMO_SECRET_KEY` — MoMo Sandbox secret key (used to verify IPN signatures)
- `CHATBOT_AI_ENABLED=true`
- `CHATBOT_AI_API_KEY` — API key for your OpenAI-compatible provider
- `CHATBOT_AI_BASE_URL` — default is `https://openrouter.ai/api/v1`
- `CHATBOT_AI_MODEL` — free model id to use, for example `google/gemma-3-4b-it:free`
- `CHATBOT_AI_REFERER` — your frontend URL, useful for providers like OpenRouter

If you prefer SMTP instead of Resend, set:

- `MAIL_PROVIDER=smtp`
- `SPRING_MAIL_USERNAME`
- `SPRING_MAIL_PASSWORD`

If you use Redis and RabbitMQ in production, also set:

- `REDIS_HOST`, `REDIS_PORT`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`

RabbitMQ is **disabled by default** in `application.yml` (`SPRING_RABBITMQ_ENABLED` defaults to `false`), so you should not see `localhost:5672` on Render unless you turned it on.

To use **CloudAMQP** (or any broker), set **`SPRING_RABBITMQ_ENABLED=true`** and **`SPRING_RABBITMQ_URI=amqps://...`** in Render.

## 3) Update Vercel Frontend Variables

In your Vercel project, set:

- `NEXT_PUBLIC_API_URL` = `https://<your-render-domain>/api`
- `BACKEND_URL` = `https://<your-render-domain>`
- `INTERNAL_NOTIFY_TOKEN` = exact same value as backend `INTERNAL_NOTIFY_TOKEN`

If you deploy the frontend on Render instead of Vercel, set `INTERNAL_NOTIFY_TOKEN`
on the `ecommerce-frontend` service to that same shared value as well.

For **MoMo Sandbox** payments set (in Vercel Environment Variables, not exposed to the browser):
- `MOMO_PARTNER_CODE` — your MoMo partner code
- `MOMO_ACCESS_KEY` — your MoMo access key
- `MOMO_SECRET_KEY` — your MoMo secret key
- `MOMO_REDIRECT_URL` = `https://<your-vercel-domain>/payment/momo-return`
- `MOMO_IPN_URL` = `https://<your-render-domain>/api/payments/momo/ipn`

For **VNPay Sandbox** payments set:
- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`
- `VNPAY_RETURN_URL` = `https://<your-vercel-domain>/payment/vnpay-return`

> [!IMPORTANT]
> `MOMO_IPN_URL` must point to your **public Render backend** URL. MoMo's servers
> need to reach it from the internet. A local `localhost` URL will not work.

> [!IMPORTANT]
> `VNPAY_RETURN_URL` must be a public frontend URL. If it still points to
> `http://localhost:3000`, VNPay will redirect users to a missing site after payment.

Then redeploy Vercel.

## 4) Smoke Test

- Open `https://<your-render-domain>/api/products`
- Test login/signup
- Test cart and checkout
- Test admin and payment return flow
