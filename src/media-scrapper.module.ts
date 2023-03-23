import { RedisModule } from '@nestjs-modules/ioredis';
import { HttpModule } from '@nestjs/axios';
import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { appConfig } from './config/app.config';
import { redisConfig } from './config/redis.config';
import { MediaScrapperService } from './media-scrapper.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [appConfig, redisConfig],
    }),
    CacheModule.register(),
    HttpModule,
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
