import {
  // CACHE_MANAGER,
  // Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis, Redis } from '@nestjs-modules/ioredis';
import { lastValueFrom } from 'rxjs';
import { JSDOM } from 'jsdom';
// import { Cache } from 'cache-manager';

import {
  MEDIAS_STREAM,
  PROCESSED_MEDIA_SORTED_LIST,
  TAGS_SET_KEY,
} from './constants/redis.constants';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from './constants/ext.constants';
import type {
  I9GagPost,
  IImgurPost,
  IMedia,
  TMedia,
} from './media-scrapper.types';

@Injectable()
export class MediaScrapperService implements OnModuleInit {
  private readonly scrapPostListingCount = 25;
  private readonly logger = new Logger(MediaScrapperService.name);

  constructor(
    private readonly configService: ConfigService,
    // @Inject(CACHE_MANAGER)
    // private readonly cacheService: Cache,
    @InjectRedis()
    private readonly redis: Redis,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit() {
    if (!this.configService.get('app.isProd')) {
      await this.handleCron();
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    this.logger.verbose('Running cron job');

    const tags = await this.getTags();

    await Promise.all([
      this.scrapReddit(tags),
      this.scrap9Gag(tags),
      this.scrapImgur(tags),
    ]);
  }

  private getRedisKey(key: string) {
    const namespace = this.configService.get('app.redisNamespace') as string;
    return namespace ? `${namespace}:${key}` : key;
  }

  private getTags() {
    return this.redis.smembers(this.getRedisKey(TAGS_SET_KEY));
  }

  private getRedditTagListingPage(tag: string) {
    return `https://old.reddit.com/r/${tag}/top`;
  }

  private get9GagTagListingPage(tag: string, offset = 0) {
    return `https://9gag.com/v1/tag-posts/tag/${tag}/type/hot?c=${offset}`;
  }

  private getImgurTagListingPage(tag: string) {
    return `https://api.imgur.com/post/v1/posts/t/${tag}?client_id=546c25a59c58ad7&filter%5Bwindow%5D=week&include=adtiles%2Cadconfig%2Ccover&page=1&sort=-viral`;
  }

  private async scrapMediaFromRedditPost(href: string): Promise<TMedia> {
    const res = await lastValueFrom(
      this.httpService.get(`https://old.reddit.com${href}`),
    );
    const dom = new JSDOM(res.data);

    const postEl = dom.window.document.querySelector('#siteTable .thing');
    const id = postEl.getAttribute('id');
    const tags = [href.match(/^\/r\/(.+?)\//)[1]];
    const title = postEl.querySelector('a.title').textContent;

    const mediaBase: IMedia = { id, title, tags };

    let text: string | undefined;
    const userTextEl = postEl.querySelector('.usertext-body');
    if (userTextEl) {
      text = userTextEl.textContent;
    }

    const mediaPreviewEl = postEl.querySelector('.media-preview');
    if (mediaPreviewEl) {
      const mediaEl =
        (mediaPreviewEl.querySelector('img.preview') as HTMLImageElement) ||
        (mediaPreviewEl.querySelector('video.preview') as HTMLVideoElement);

      if (mediaEl) {
        let src = mediaEl.src;
        if (!src) {
          const source = mediaEl.querySelector('source');
          if (source) {
            src = source.src;
          }
        }

        if (src) {
          const mediaType =
            mediaEl.tagName === 'IMG' ||
            (mediaEl.tagName === 'VIDEO' &&
              new URL(src).pathname.endsWith('.gif'))
              ? 'image'
              : 'video';

          return {
            ...mediaBase,
            type: mediaType,
            src,
            description: text,
          };
        }
      }
    }

    if (text) {
      return {
        ...mediaBase,
        type: 'text',
        text,
      };
    }
  }

  private async publishMedia(medias: TMedia[]) {
    for (const media of medias) {
      const [score] = await this.redis.zmscore(
        this.getRedisKey(PROCESSED_MEDIA_SORTED_LIST),
        media.id,
      );
      if (!score) {
        await this.redis
          .multi()
          .zadd(
            this.getRedisKey(PROCESSED_MEDIA_SORTED_LIST),
            'GT',
            Date.now(),
            media.id,
          )
          .xadd(
            this.getRedisKey(MEDIAS_STREAM),
            '*',
            ...Object.entries(media).flat(),
          )
          .exec();
      }
    }
  }

  // Delay between tag requests to prevent triggering limiters
  private async loopWithRandDelay<T>(
    items: T[],
    process: (item: T) => Promise<any>,
    [min, max]: [number, number] = [1000, 2000],
  ) {
    for (const item of items) {
      await process(item);
      await new Promise((resolve) =>
        setTimeout(resolve, min + Math.random() * (max - min)),
      );
    }
  }

  async scrapReddit(tags: string[]) {
    await this.loopWithRandDelay(tags, async (tag) => {
      try {
        const res = await lastValueFrom(
          this.httpService.get(this.getRedditTagListingPage(tag)),
        );
        const dom = new JSDOM(res.data);

        const list = dom.window.document.querySelectorAll(
          '.linklisting > .thing',
        );
        const medias: TMedia[] = [];

        for (const post of list.values()) {
          const a = post.querySelector('a.title');
          if (!a) {
            continue;
          }

          const href = a.getAttribute('href');
          if (!href.startsWith('/')) {
            continue;
          }

          try {
            const media = await this.scrapMediaFromRedditPost(href);
            if (media) {
              medias.push(media);
            }
          } catch (err) {
            this.logger.error('Scraping reddit post failed', err);
          }
        }

        if (medias.length > 0) {
          await this.publishMedia(medias);
        }
      } catch (err) {
        this.logger.error('Scraping reddit tag failed', err);
      }
    });
  }

  async scrap9Gag(tags: string[]) {
    await this.loopWithRandDelay(tags, async (tag) => {
      try {
        let posts: I9GagPost[] = [];
        while (posts.length < this.scrapPostListingCount) {
          const {
            data: { data },
          } = await lastValueFrom(
            this.httpService.get<{ data: { posts: I9GagPost[] } }>(
              this.get9GagTagListingPage(tag, posts.length),
              {
                headers: {
                  Accept:
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                  'Accept-Encoding': 'gzip, deflate, br',
                  'Accept-Language': 'en-US,en;q=0.5',
                  Connection: 'keep-alive',
                  Host: '9gag.com',
                  'Sec-Fetch-Dest': 'document',
                  'Sec-Fetch-Mode': 'navigate',
                  'Sec-Fetch-Site': 'none',
                  'Sec-Fetch-User': '?1',
                  'Upgrade-Insecure-Requests': '1',
                  'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/111.0',
                },
              },
            ),
          );
          posts = [...posts, ...data.posts];
        }

        const medias: TMedia[] = [];

        for (const post of posts) {
          const image =
            post.images.image460sv ||
            post.images.image700 ||
            post.images.image460;
          const imageExt = image.url.split('.').pop().toLowerCase();
          if (
            !IMAGE_EXTENSIONS.includes(imageExt) &&
            !VIDEO_EXTENSIONS.includes(imageExt)
          ) {
            continue;
          }

          const media: TMedia = {
            id: post.id,
            title: post.title,
            description: post.description,
            type: VIDEO_EXTENSIONS.includes(imageExt) ? 'video' : 'image',
            src: image.url,
            tags: post.tags.map(({ key }) => key),
          };
          medias.push(media);
        }

        if (medias.length > 0) {
          await this.publishMedia(medias);
        }
      } catch (err) {
        this.logger.error('Scraping 9gag tag failed', err);
      }
    });
  }

  async scrapImgur(tags: string[]) {
    await this.loopWithRandDelay(tags, async (tag) => {
      try {
        const {
          data: { posts },
        } = await lastValueFrom(
          this.httpService.get<{ posts: IImgurPost[] }>(
            this.getImgurTagListingPage(tag),
          ),
        );

        const medias: TMedia[] = [];

        for (const post of posts) {
          const ext = post.cover.url.split('.').pop();
          if (
            !IMAGE_EXTENSIONS.includes(ext) &&
            !VIDEO_EXTENSIONS.includes(ext)
          ) {
            continue;
          }

          const media: TMedia = {
            id: post.id,
            title: post.title,
            type: post.cover.type,
            description: post.description,
            src: post.cover.url,
            tags: [tag],
          };
          medias.push(media);
        }

        if (medias.length > 0) {
          await this.publishMedia(medias);
        }
      } catch (err) {
        this.logger.error('Scraping imgur tag failed', err);
      }
    });
  }
}
