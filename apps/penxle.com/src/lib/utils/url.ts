import { get } from 'svelte/store';
import { page } from '$app/stores';

export const absolutePath = (path: string) => {
  const { url } = get(page);
  url.pathname = '';
  return new URL(path, url).toString();
};

export const handleShare = (title: string, url: string) => {
  if (navigator.share) {
    navigator.share({
      title,
      url,
    });
  } else {
    navigator.clipboard.writeText(url);
  }
};
