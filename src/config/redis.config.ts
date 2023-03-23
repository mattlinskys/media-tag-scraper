import { registerAs } from '@nestjs/config';

import { readEnvOrFileSync } from '../utils/config.utils';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: readEnvOrFileSync('REDIS_PASSWORD'),
}));
