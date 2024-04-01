import { RedisModule } from '@nestjs-modules/ioredis';
import { HttpModule } from '@nestjs/axios';
import {
  // CacheModule,
  Module,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SocksProxyAgent } from 'socks-proxy-agent';

import { appConfig } from './config/app.config';
import { redisConfig } from './config/redis.config';
import { MediaScrapperService } from './media-scrapper.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig, redisConfig],
    }),
    // CacheModule.register(),
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const socksProxyUrl = configService.get('app.socksProxyUrl');
        const proxyAgent = socksProxyUrl
          ? new SocksProxyAgent(socksProxyUrl)
          : null;

        return {
          ...(proxyAgent
            ? { httpAgent: proxyAgent, httpsAgent: proxyAgent }
            : {}),
        };
      },
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        config: configService.get('redis'),
      }),
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
  ],
  providers: [MediaScrapperService],
})
export class MediaScrapperModule {}
