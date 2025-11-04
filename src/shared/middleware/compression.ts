import { compress } from 'hono/compress';

// Gzip compression middleware
export const compressionMiddleware = () => {
  return compress({
    encoding: 'gzip',
  });
};
