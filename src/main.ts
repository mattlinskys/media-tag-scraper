import { NestFactory } from '@nestjs/core';

import { MediaScrapperModule } from './media-scrapper.module';

const bootstrap = async () => {
  await NestFactory.createApplicationContext(MediaScrapperModule);
};

bootstrap();
