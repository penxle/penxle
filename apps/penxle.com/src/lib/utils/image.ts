import { toast } from '$lib/notification';
import { fileMime } from './file';

export const validImageMimes = ['image/jpeg', 'image/png'];
const maxSize = 100 * 1024 * 1024; // 100MB

export const isValidImageFile = async (file: File) => {
  if (file.size > maxSize) {
    toast(`100MB를 초과하는 파일은 업로드할 수 없어요 (${file.name})`);
    return false;
  }

  const mime = await fileMime(file);
  if (!validImageMimes.includes(mime)) {
    toast(`허용되지 않는 파일 타입이에요 (${file.name})`);
    return false;
  }

  return true;
};

export type ImageBounds = {
  left: number;
  top: number;
  width: number;
  height: number;

  translateX: number;
  translateY: number;
  scale: number;
};
