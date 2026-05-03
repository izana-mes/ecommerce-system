import axios, { AxiosInstance } from 'axios';
import { logger } from './logger';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/+$/, '');
const MCP_SERVICE_TOKEN = process.env.MCP_SERVICE_TOKEN || '';

const backendClient: AxiosInstance = axios.create({
  baseURL: `${BACKEND_URL}/api/chatbot/tools`,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'X-MCP-Service-Token': MCP_SERVICE_TOKEN,
  },
});

backendClient.interceptors.response.use(
  (res) => {
    logger.debug('backend_response', { status: res.status, url: res.config.url });
    return res;
  },
  (err) => {
    logger.warn('backend_error', {
      url: err.config?.url,
      status: err.response?.status,
      data: err.response?.data,
    });
    return Promise.reject(err);
  }
);

export { backendClient };
