# Description

Media tag scraper scraps posts from popular listings of imgur.com, 9gag.com, reddit.com for a specific list of tags. List of tags are fetched from redis set `tags`.

Make sure to set tags before running app as it's outside of scope of the scrapper, e.g.

```
redis-cli sadd tag1 tag2
```

When new post is found it'll transform it to media format (check `./src/media-scrapper.types.ts`) and send it to redis stream `medias`. With the help of redis sorted set `processed-media` media scraper makes sure media sent to stream are unique.

## Environment

Make sure you have redis instance running. You can configure connection with `REDIS_HOST` `REDIS_PORT` and `REDIS_PASSWORD`. You can also configure namespace for all redis keys used in the app using `REDIS_NAMESPACE` (e.g. for `REDIS_NAMESPACE="media-scrapper"` key `tags` will change to `media-scrapper:tags`)

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```
