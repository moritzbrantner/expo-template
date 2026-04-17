import { createAuthApiServer } from './app';

const PORT = Number(process.env.PORT ?? 4001);
const server = createAuthApiServer({
  adminEmails: String(process.env.AUTH_API_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  corsOrigin: process.env.CORS_ORIGIN,
  dataFile: process.env.DATA_FILE,
  enableTestEndpoints: process.env.AUTH_API_ENABLE_TEST_ENDPOINTS === 'true',
  smtpFrom: process.env.SMTP_FROM,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth API listening on http://0.0.0.0:${PORT}`);
});
