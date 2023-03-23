export interface IMedia {
  id: string;
  title: string;
  tags: string[];
  description?: string;
}

export interface IImageMedia extends IMedia {
  type: 'image';
  src: string;
}

export interface IVideoMedia extends IMedia {
  type: 'video';
  src: string;
}

export interface ITextMedia extends IMedia {
  type: 'text';
  text: string;
}

export type TMedia = IImageMedia | IVideoMedia | ITextMedia;

interface I9GagImage {
  url: string;
}

export interface I9GagPost {
  id: string;
  url: string;
  title: string;
  description?: string;
  type: 'Photo' | 'Animated';
  tags: { key: string; url: string }[];
  images: {
    image700: I9GagImage;
    image460: I9GagImage;
    image460sv?: I9GagImage;
  };
}

export interface IImgurPost {
  id: string;
  title: string;
  description: string;
  cover: {
    type: 'image' | 'video';
    url: string;
    ext: string;
    mime_type: string;
  };
}
