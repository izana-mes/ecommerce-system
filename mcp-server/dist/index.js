"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("./logger");
const backend_1 = require("./backend");
const zod_1 = require("zod");
const prom_client_1 = __importDefault(require("prom-client"));
const crypto_1 = __importDefault(require("crypto"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
const registry = new prom_client_1.default.Registry();
prom_client_1.default.collectDefaultMetrics({ register: registry, prefix: 'mcp_' });
const toolExecutions = new prom_client_1.default.Counter({
    name: 'mcp_tool_executions_total',
    help: 'Count of MCP tool executions',
    labelNames: ['tool', 'status'],
    registers: [registry],
});
const toolLatency = new prom_client_1.default.Histogram({
    name: 'mcp_tool_execution_latency_seconds',
    help: 'Latency of MCP tool executions',
    labelNames: ['tool', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [registry],
});
const PORT = parseInt(process.env.PORT || '3100', 10);
const MCP_SERVICE_TOKEN = process.env.MCP_SERVICE_TOKEN || '';
// -------------------------------------------------------------------------
// Auth middleware — validates Bearer token from LLM / ChatbotAiClient
// -------------------------------------------------------------------------
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!MCP_SERVICE_TOKEN) {
        logger_1.logger.error('mcp_service_token_not_configured');
        res.status(500).json({ success: false, message: 'MCP service token not configured' });
        return;
    }
    if (token !== MCP_SERVICE_TOKEN) {
        logger_1.logger.warn('mcp_auth_failed', { method: req.method, path: req.path, ip: req.ip });
        res.status(401).json({ success: false, message: 'Invalid or missing MCP service token' });
        return;
    }
    next();
}
// -------------------------------------------------------------------------
// Rate limiting — 30 requests / 60s per IP
// -------------------------------------------------------------------------
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.logger.warn('mcp_rate_limit_exceeded', { ip: req.ip, path: req.path });
        res.status(429).json({ success: false, message: 'Too many requests. Please retry later.' });
    },
});
app.use('/tools', limiter, authMiddleware);
// -------------------------------------------------------------------------
// Request logging
// -------------------------------------------------------------------------
app.use((req, res, next) => {
    const start = Date.now();
    const requestId = String(req.headers['x-request-id'] || crypto_1.default.randomUUID());
    const correlationId = String(req.headers['x-correlation-id'] || requestId);
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);
    res.on('finish', () => {
        logger_1.logger.info('request', {
            requestId,
            correlationId,
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
function sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string')
        return '';
    return value
        .slice(0, maxLength)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // remove control characters
        .trim();
}
// -------------------------------------------------------------------------
// Tool: POST /tools/getUserOrders
// -------------------------------------------------------------------------
const getUserOrdersSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    limit: zod_1.z.number().int().min(1).max(20).optional().default(5),
});
app.post('/tools/getUserOrders', async (req, res) => {
    const end = toolLatency.startTimer({ tool: 'getUserOrders', status: 'ok' });
    const parsed = getUserOrdersSchema.safeParse(req.body);
    if (!parsed.success) {
        end({ tool: 'getUserOrders', status: 'validation_error' });
        toolExecutions.inc({ tool: 'getUserOrders', status: 'validation_error' });
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
    }
    try {
        const { email, limit } = parsed.data;
        const response = await backend_1.backendClient.get('/orders', {
            params: { email: sanitizeString(email, 320), limit },
        });
        end({ tool: 'getUserOrders', status: 'success' });
        toolExecutions.inc({ tool: 'getUserOrders', status: 'success' });
        res.json(response.data);
    }
    catch (err) {
        end({ tool: 'getUserOrders', status: 'failure' });
        toolExecutions.inc({ tool: 'getUserOrders', status: 'failure' });
        logger_1.logger.error('tool_error', { tool: 'getUserOrders', error: err.message });
        res.status(err.response?.status || 500).json(err.response?.data || { success: false, message: err.message });
    }
});
// -------------------------------------------------------------------------
// Tool: POST /tools/getOrderDetail
// -------------------------------------------------------------------------
const getOrderDetailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    orderNumber: zod_1.z.string().min(1).max(80),
});
app.post('/tools/getOrderDetail', async (req, res) => {
    const end = toolLatency.startTimer({ tool: 'getOrderDetail', status: 'ok' });
    const parsed = getOrderDetailSchema.safeParse(req.body);
    if (!parsed.success) {
        end({ tool: 'getOrderDetail', status: 'validation_error' });
        toolExecutions.inc({ tool: 'getOrderDetail', status: 'validation_error' });
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
    }
    try {
        const { email, orderNumber } = parsed.data;
        const response = await backend_1.backendClient.get(`/orders/${encodeURIComponent(sanitizeString(orderNumber, 80))}`, {
            params: { email: sanitizeString(email, 320) },
        });
        end({ tool: 'getOrderDetail', status: 'success' });
        toolExecutions.inc({ tool: 'getOrderDetail', status: 'success' });
        res.json(response.data);
    }
    catch (err) {
        end({ tool: 'getOrderDetail', status: 'failure' });
        toolExecutions.inc({ tool: 'getOrderDetail', status: 'failure' });
        logger_1.logger.error('tool_error', { tool: 'getOrderDetail', error: err.message });
        res.status(err.response?.status || 500).json(err.response?.data || { success: false, message: err.message });
    }
});
// -------------------------------------------------------------------------
// Tool: POST /tools/searchProducts
// -------------------------------------------------------------------------
const searchProductsSchema = zod_1.z.object({
    q: zod_1.z.string().max(200).optional().default(''),
    minPrice: zod_1.z.number().min(0).optional(),
    maxPrice: zod_1.z.number().min(0).optional(),
    category: zod_1.z.string().max(100).optional(),
    page: zod_1.z.number().int().min(0).optional().default(0),
    size: zod_1.z.number().int().min(1).max(20).optional().default(8),
});
app.post('/tools/searchProducts', async (req, res) => {
    const end = toolLatency.startTimer({ tool: 'searchProducts', status: 'ok' });
    const parsed = searchProductsSchema.safeParse(req.body);
    if (!parsed.success) {
        end({ tool: 'searchProducts', status: 'validation_error' });
        toolExecutions.inc({ tool: 'searchProducts', status: 'validation_error' });
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
    }
    try {
        const { q, minPrice, maxPrice, page, size } = parsed.data;
        const params = { page, size };
        if (q)
            params['q'] = sanitizeString(q, 200);
        if (minPrice !== undefined)
            params['minPrice'] = minPrice;
        if (maxPrice !== undefined)
            params['maxPrice'] = maxPrice;
        const response = await backend_1.backendClient.get('/products', { params });
        end({ tool: 'searchProducts', status: 'success' });
        toolExecutions.inc({ tool: 'searchProducts', status: 'success' });
        res.json(response.data);
    }
    catch (err) {
        end({ tool: 'searchProducts', status: 'failure' });
        toolExecutions.inc({ tool: 'searchProducts', status: 'failure' });
        logger_1.logger.error('tool_error', { tool: 'searchProducts', error: err.message });
        res.status(err.response?.status || 500).json(err.response?.data || { success: false, message: err.message });
    }
});
// -------------------------------------------------------------------------
// Tool: POST /tools/recommendProducts
// -------------------------------------------------------------------------
const recommendProductsSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
});
app.post('/tools/recommendProducts', async (req, res) => {
    const end = toolLatency.startTimer({ tool: 'recommendProducts', status: 'ok' });
    const parsed = recommendProductsSchema.safeParse(req.body);
    if (!parsed.success) {
        end({ tool: 'recommendProducts', status: 'validation_error' });
        toolExecutions.inc({ tool: 'recommendProducts', status: 'validation_error' });
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
    }
    try {
        const { email } = parsed.data;
        const response = await backend_1.backendClient.get('/products/recommend', {
            params: email ? { email: sanitizeString(email, 320) } : {},
        });
        end({ tool: 'recommendProducts', status: 'success' });
        toolExecutions.inc({ tool: 'recommendProducts', status: 'success' });
        res.json(response.data);
    }
    catch (err) {
        end({ tool: 'recommendProducts', status: 'failure' });
        toolExecutions.inc({ tool: 'recommendProducts', status: 'failure' });
        logger_1.logger.error('tool_error', { tool: 'recommendProducts', error: err.message });
        res.status(err.response?.status || 500).json(err.response?.data || { success: false, message: err.message });
    }
});
// -------------------------------------------------------------------------
// Tool: POST /tools/cancelOrder
// -------------------------------------------------------------------------
const cancelOrderSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    orderNumber: zod_1.z.string().min(1).max(80),
});
app.post('/tools/cancelOrder', async (req, res) => {
    const end = toolLatency.startTimer({ tool: 'cancelOrder', status: 'ok' });
    const parsed = cancelOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        end({ tool: 'cancelOrder', status: 'validation_error' });
        toolExecutions.inc({ tool: 'cancelOrder', status: 'validation_error' });
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
    }
    try {
        const { email, orderNumber } = parsed.data;
        const response = await backend_1.backendClient.post(`/orders/${encodeURIComponent(sanitizeString(orderNumber, 80))}/cancel`, { email: sanitizeString(email, 320) });
        end({ tool: 'cancelOrder', status: 'success' });
        toolExecutions.inc({ tool: 'cancelOrder', status: 'success' });
        res.json(response.data);
    }
    catch (err) {
        end({ tool: 'cancelOrder', status: 'failure' });
        toolExecutions.inc({ tool: 'cancelOrder', status: 'failure' });
        logger_1.logger.error('tool_error', { tool: 'cancelOrder', error: err.message });
        res.status(err.response?.status || 500).json(err.response?.data || { success: false, message: err.message });
    }
});
// -------------------------------------------------------------------------
// Tool: POST /tools/createReturnRequest
// -------------------------------------------------------------------------
const createReturnRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    orderNumber: zod_1.z.string().min(1).max(80),
    reason: zod_1.z.string().min(5).max(2000),
});
app.post('/tools/createReturnRequest', async (req, res) => {
    const end = toolLatency.startTimer({ tool: 'createReturnRequest', status: 'ok' });
    const parsed = createReturnRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        end({ tool: 'createReturnRequest', status: 'validation_error' });
        toolExecutions.inc({ tool: 'createReturnRequest', status: 'validation_error' });
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
    }
    try {
        const { email, orderNumber, reason } = parsed.data;
        const response = await backend_1.backendClient.post(`/orders/${encodeURIComponent(sanitizeString(orderNumber, 80))}/return`, {
            email: sanitizeString(email, 320),
            reason: sanitizeString(reason, 2000),
        });
        end({ tool: 'createReturnRequest', status: 'success' });
        toolExecutions.inc({ tool: 'createReturnRequest', status: 'success' });
        res.json(response.data);
    }
    catch (err) {
        end({ tool: 'createReturnRequest', status: 'failure' });
        toolExecutions.inc({ tool: 'createReturnRequest', status: 'failure' });
        logger_1.logger.error('tool_error', { tool: 'createReturnRequest', error: err.message });
        res.status(err.response?.status || 500).json(err.response?.data || { success: false, message: err.message });
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
            { name: 'getUserOrders', description: 'Get a customer\'s recent orders by email' },
            { name: 'getOrderDetail', description: 'Get detailed info for a specific order' },
            { name: 'searchProducts', description: 'Search products by keyword and price range' },
            { name: 'recommendProducts', description: 'Get product recommendations' },
            { name: 'cancelOrder', description: 'Cancel a pending order' },
            { name: 'createReturnRequest', description: 'Submit a return request for an order' },
        ],
    });
});
app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});
// -------------------------------------------------------------------------
// Global error handler
// -------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
    logger_1.logger.error('unhandled_error', { message: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Internal server error' });
});
// -------------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------------
app.listen(PORT, () => {
    logger_1.logger.info('mcp_server_started', {
        port: PORT,
        backendUrl: process.env.BACKEND_URL || 'http://localhost:8080',
        tokenConfigured: !!MCP_SERVICE_TOKEN,
    });
});
exports.default = app;
