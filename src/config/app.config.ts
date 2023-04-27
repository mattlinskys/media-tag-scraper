import { registerAs } from '@nestjs/config';

import { readEnvOrFileSync } from '../utils/config.utils';

export const appConfig = registerAs('app', () => ({
  isProd: process.env.NODE_ENV === 'production',
  redisNamespace: process.env.REDIS_NAMESPACE,
  socksProxyUrl: readEnvOrFileSync('SOCKS_PROXY_URL'),
}));
