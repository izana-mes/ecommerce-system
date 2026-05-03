import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from './logger';
import { backendClient } from './backend';
import { z } from 'zod';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3100', 10);
const MCP_SERVICE_TOKEN = process.env.MCP_SERVICE_TOKEN || '';

// -------------------------------------------------------------------------
// Auth middleware — validates Bearer token from LLM / ChatbotAiClient
// -------------------------------------------------------------------------
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!MCP_SERVICE_TOKEN) {
    logger.error('mcp_service_token_not_configured');
    res.status(500).json({ success: false, message: 'MCP service token not configured' });
    return;
  }
  if (token !== MCP_SERVICE_TOKEN) {
    logger.warn('mcp_auth_failed', { method: req.method, path: req.path, ip: req.ip });
    res.status(401).json({ success: false, message: 'Invalid or missing MCP service token' });
    return;
  }
  next();
}

// -------------------------------------------------------------------------
// Rate limiting — 30 requests / 60s per IP
// -------------------------------------------------------------------------
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('mcp_rate_limit_exceeded', { ip: req.ip, path: req.path });
    res.status(429).json({ success: false, message: 'Too many requests. Please retry later.' });
  },
});

app.use('/tools', limiter, authMiddleware);

// -------------------------------------------------------------------------
// Request logging
// -------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

// -------------------------------------------------------------------------
// Input sanitization helper — prevents prompt injection via tool args
// -------------------------------------------------------------------------
function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // remove control characters
    .trim();
}

// -------------------------------------------------------------------------
// Tool: POST /tools/getUserOrders
// -------------------------------------------------------------------------
const getUserOrdersSchema = z.object({
  email: z.string().email(),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

app.post('/tools/getUserOrders', async (req, res) => {
  const parsed = getUserOrdersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }
  try {
    const { email, limit } = parsed.data;
    const response = await backendClient.get('/orders', {
      params: { email: sanitizeString(email, 320), limit },
    });
    res.json(response.data);
  } catch (err: any) {
    logger.error('tool_error', { tool: 'getUserOrders', error: err.message });
    res.status(err.response?.status || 500).json(
      err.response?.data || { success: false, message: err.message }
    );
  }
});

// -------------------------------------------------------------------------
// Tool: POST /tools/getOrderDetail
// -------------------------------------------------------------------------
const getOrderDetailSchema = z.object({
  email: z.string().email(),
  orderNumber: z.string().min(1).max(80),
});

app.post('/tools/getOrderDetail', async (req, res) => {
  const parsed = getOrderDetailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }
  try {
    const { email, orderNumber } = parsed.data;
    const response = await backendClient.get(`/orders/${encodeURIComponent(sanitizeString(orderNumber, 80))}`, {
      params: { email: sanitizeString(email, 320) },
    });
    res.json(response.data);
  } catch (err: any) {
    logger.error('tool_error', { tool: 'getOrderDetail', error: err.message });
    res.status(err.response?.status || 500).json(
      err.response?.data || { success: false, message: err.message }
    );
  }
});

// -------------------------------------------------------------------------
// Tool: POST /tools/searchProducts
// -------------------------------------------------------------------------
const searchProductsSchema = z.object({
  q: z.string().max(200).optional().default(''),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  category: z.string().max(100).optional(),
  page: z.number().int().min(0).optional().default(0),
  size: z.number().int().min(1).max(20).optional().default(8),
});

app.post('/tools/searchProducts', async (req, res) => {
  const parsed = searchProductsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }
  try {
    const { q, minPrice, maxPrice, page, size } = parsed.data;
    const params: Record<string, unknown> = { page, size };
    if (q) params['q'] = sanitizeString(q, 200);
    if (minPrice !== undefined) params['minPrice'] = minPrice;
    if (maxPrice !== undefined) params['maxPrice'] = maxPrice;

    const response = await backendClient.get('/products', { params });
    res.json(response.data);
  } catch (err: any) {
    logger.error('tool_error', { tool: 'searchProducts', error: err.message });
    res.status(err.response?.status || 500).json(
      err.response?.data || { success: false, message: err.message }
    );
  }
});

// -------------------------------------------------------------------------
// Tool: POST /tools/recommendProducts
// -------------------------------------------------------------------------
const recommendProductsSchema = z.object({
  email: z.string().email().optional(),
});

app.post('/tools/recommendProducts', async (req, res) => {
  const parsed = recommendProductsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }
  try {
    const { email } = parsed.data;
    const response = await backendClient.get('/products/recommend', {
      params: email ? { email: sanitizeString(email, 320) } : {},
    });
    res.json(response.data);
  } catch (err: any) {
    logger.error('tool_error', { tool: 'recommendProducts', error: err.message });
    res.status(err.response?.status || 500).json(
      err.response?.data || { success: false, message: err.message }
    );
  }
});

// -------------------------------------------------------------------------
// Tool: POST /tools/cancelOrder
// -------------------------------------------------------------------------
const cancelOrderSchema = z.object({
  email: z.string().email(),
  orderNumber: z.string().min(1).max(80),
});

app.post('/tools/cancelOrder', async (req, res) => {
  const parsed = cancelOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }
  try {
    const { email, orderNumber } = parsed.data;
    const response = await backendClient.post(
      `/orders/${encodeURIComponent(sanitizeString(orderNumber, 80))}/cancel`,
      { email: sanitizeString(email, 320) }
    );
    res.json(response.data);
  } catch (err: any) {
    logger.error('tool_error', { tool: 'cancelOrder', error: err.message });
    res.status(err.response?.status || 500).json(
      err.response?.data || { success: false, message: err.message }
    );
  }
});

// -------------------------------------------------------------------------
// Tool: POST /tools/createReturnRequest
// -------------------------------------------------------------------------
const createReturnRequestSchema = z.object({
  email: z.string().email(),
  orderNumber: z.string().min(1).max(80),
  reason: z.string().min(5).max(2000),
});

app.post('/tools/createReturnRequest', async (req, res) => {
  const parsed = createReturnRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.message });
    return;
  }
  try {
    const { email, orderNumber, reason } = parsed.data;
    const response = await backendClient.post(
      `/orders/${encodeURIComponent(sanitizeString(orderNumber, 80))}/return`,
      {
        email: sanitizeString(email, 320),
        reason: sanitizeString(reason, 2000),
      }
    );
    res.json(response.data);
  } catch (err: any) {
    logger.error('tool_error', { tool: 'createReturnRequest', error: err.message });
    res.status(err.response?.status || 500).json(
      err.response?.data || { success: false, message: err.message }
    );
  }
});

// -------------------------------------------------------------------------
// Health endpoint (unauthenticated)
// -------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ecommerce-mcp-server', timestamp: new Date().toISOString() });
});

// -------------------------------------------------------------------------
// MCP Server Info — lists available tools (unauthenticated)
// -------------------------------------------------------------------------
app.get('/tools', (_req, res) => {
  res.json({
    server: 'ecommerce-mcp-server',
    version: '1.0.0',
    tools: [
      { name: 'getUserOrders',       description: 'Get a customer\'s recent orders by email' },
      { name: 'getOrderDetail',      description: 'Get detailed info for a specific order' },
      { name: 'searchProducts',      description: 'Search products by keyword and price range' },
      { name: 'recommendProducts',   description: 'Get product recommendations' },
      { name: 'cancelOrder',         description: 'Cancel a pending order' },
      { name: 'createReturnRequest', description: 'Submit a return request for an order' },
    ],
  });
});

// -------------------------------------------------------------------------
// Global error handler
// -------------------------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('unhandled_error', { message: err.message, stack: err.stack });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// -------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------
app.listen(PORT, () => {
  logger.info('mcp_server_started', {
    port: PORT,
    backendUrl: process.env.BACKEND_URL || 'http://localhost:8080',
    tokenConfigured: !!MCP_SERVICE_TOKEN,
  });
});

export default app;
