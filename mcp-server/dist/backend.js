"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backendClient = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
const MCP_SERVICE_TOKEN = process.env.MCP_SERVICE_TOKEN || '';
const backendClient = axios_1.default.create({
    baseURL: `${BACKEND_URL}/api/chatbot/tools`,
    timeout: 15_000,
    headers: {
        'Content-Type': 'application/json',
        'X-MCP-Service-Token': MCP_SERVICE_TOKEN,
    },
});
exports.backendClient = backendClient;
backendClient.interceptors.response.use((res) => {
    logger_1.logger.debug('backend_response', { status: res.status, url: res.config.url });
    return res;
}, (err) => {
    logger_1.logger.warn('backend_error', {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
    });
    return Promise.reject(err);
});
