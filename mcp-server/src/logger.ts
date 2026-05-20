import winston from 'winston';

const level = process.env.LOG_LEVEL || 'info';
const redact = winston.format((info) => {
  const raw = JSON.stringify(info);
  const scrubbed = raw
    .replace(/(authorization|token|secret|api[_-]?key|password)\":\"[^\"]+\"/gi, '$1\":\"[REDACTED]\"')
    .replace(/(bearer\\s+)[A-Za-z0-9\\-._~+/]+=*/gi, '$1[REDACTED]');
  return JSON.parse(scrubbed);
});

export const logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    redact(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});
