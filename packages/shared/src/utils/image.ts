export interface EntryPictureLike {
  id?: string;
  name?: string;
  filename?: string;
  fileurl?: string;
  thumbUrl?: string;
  imageType?: string;
  dimension?: any;
}

export interface EntrySoundLike {
  id?: string;
  name?: string;
  filename?: string;
  fileurl?: string;
  ext?: string;
  duration?: number;
}

/**
 * 엔트리 이미지/모양 리소스의 실제 로드 가능한 절대 URL을 반환합니다.
 * - fileurl이 상대경로(/lib/...)일 때: https://playentry.org/lib/...
 * - filename(32자리 해시)일 때: https://playentry.org/uploads/{first2}/{next2}/image/{filename}.{ext}
 * - thumb 우선 필요 시: https://playentry.org/uploads/{first2}/{next2}/thumb/{filename}.png
 */
export function formatAssetImageUrl(
  target?: string | EntryPictureLike | null,
  options?: { thumb?: boolean }
): string | undefined {
  if (!target) return undefined;

  let url = '';
  let filename = '';
  let imageType = 'png';

  if (typeof target === 'string') {
    url = target.trim();
  } else if (typeof target === 'object') {
    url = (target.fileurl || target.thumbUrl || '').trim();
    filename = (target.filename || '').trim();
    imageType = target.imageType || 'png';
  }

  // 1. 이미 완전한 HTTP URL이나 data URI인 경우
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  // 2. filename이 존재하는 경우 (엔트리 업로드 해시 경로)
  // 예: 4a7c98bbmvf2mhf50006400aae70eesf -> https://playentry.org/uploads/4a/7c/image/4a7c98bbmvf2mhf50006400aae70eesf.png
  if (filename && filename.length >= 4) {
    const f1 = filename.substring(0, 2);
    const f2 = filename.substring(2, 4);
    const ext = imageType ? imageType.replace(/^\./, '') : 'png';
    const folder = options?.thumb ? 'thumb' : 'image';
    return `https://playentry.org/uploads/${f1}/${f2}/${folder}/${filename}.${ext}`;
  }

  // 3. url이 존재할 때
  if (url) {
    // 절대경로 (/lib/..., /uploads/...)
    if (url.startsWith('/')) {
      return `https://playentry.org${url}`;
    }

    // 슬래시가 없는 32자리 이상의 해시 파일명일 경우 uploads 경로 매핑
    if (!url.includes('/') && url.length >= 20) {
      const f1 = url.substring(0, 2);
      const f2 = url.substring(2, 4);
      const dotIdx = url.lastIndexOf('.');
      const pureName = dotIdx !== -1 ? url.substring(0, dotIdx) : url;
      const ext = dotIdx !== -1 ? url.substring(dotIdx + 1) : 'png';
      return `https://playentry.org/uploads/${f1}/${f2}/image/${pureName}.${ext}`;
    }

    // 엔트리 기본 내장 미디어 파일명 (예: entrybot1.svg)
    if (!url.includes('/')) {
      const hasExt = /\.(png|jpe?g|svg|gif|webp)$/i.test(url);
      const filenameWithExt = hasExt ? url : `${url}.png`;
      return `https://playentry.org/lib/entry-js/images/media/${filenameWithExt}`;
    }

    return `https://playentry.org/${url}`;
  }

  return undefined;
}

/**
 * 엔트리 사운드 리소스의 실제 재생 가능한 절대 URL을 반환합니다.
 */
export function formatAssetSoundUrl(target?: string | EntrySoundLike | null): string | undefined {
  if (!target) return undefined;

  let url = '';
  let filename = '';
  let ext = 'mp3';

  if (typeof target === 'string') {
    url = target.trim();
  } else if (typeof target === 'object') {
    url = (target.fileurl || '').trim();
    filename = (target.filename || '').trim();
    ext = target.ext || 'mp3';
  }

  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  if (filename && filename.length >= 4) {
    const f1 = filename.substring(0, 2);
    const f2 = filename.substring(2, 4);
    const cleanExt = ext ? ext.replace(/^\./, '') : 'mp3';
    return `https://playentry.org/uploads/${f1}/${f2}/sound/${filename}.${cleanExt}`;
  }

  if (url) {
    if (url.startsWith('/')) {
      return `https://playentry.org${url}`;
    }
    return `https://playentry.org/${url}`;
  }

  return undefined;
}


