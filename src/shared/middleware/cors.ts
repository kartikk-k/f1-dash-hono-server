import { cors } from 'hono/cors';

export const corsMiddleware = () => {
  const origins = process.env.ORIGIN?.split(';').filter(Boolean) || ['http://localhost:3000'];

  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept-Encoding'],
    exposeHeaders: ['Content-Length', 'Content-Encoding'],
    credentials: true,
  });
};
