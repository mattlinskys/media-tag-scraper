import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  isProd: process.env.NODE_ENV === 'production',
  redisNamespace: process.env.REDIS_NAMESPACE,
  socksProxyUrl: process.env.SOCKS_PROXY_URL,
}));
