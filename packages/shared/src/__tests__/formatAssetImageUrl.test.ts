import { describe, it, expect } from 'vitest';
import { formatAssetImageUrl } from '../utils/image';

describe('formatAssetImageUrl (이미지 경로 복원 검증)', () => {
  it('엔트리 해시 파일명(32자리)을 공식 uploads 경로로 변환해야 한다', () => {
    const filename = 'd3683652mw9a7xkw0rc8ed592b00npy0';
    const result = formatAssetImageUrl({
      filename,
      imageType: 'svg',
    });

    expect(result).toBe('https://playentry.org/uploads/d3/68/image/d3683652mw9a7xkw0rc8ed592b00npy0.svg');
  });

  it('기존의 완전한 http/https URL은 그대로 보존해야 한다', () => {
    const url = 'https://playentry.org/lib/entry-js/images/media/entrybot1.svg';
    expect(formatAssetImageUrl(url)).toBe(url);
  });

  it('엔트리 상대 경로(/lib/...)는 도메인을 조합해야 한다', () => {
    const relative = '/lib/entry-js/images/media/cat.png';
    expect(formatAssetImageUrl(relative)).toBe('https://playentry.org/lib/entry-js/images/media/cat.png');
  });

  it('null이나 빈 값은 undefined를 반환해야 한다', () => {
    expect(formatAssetImageUrl(null)).toBeUndefined();
    expect(formatAssetImageUrl('')).toBeUndefined();
  });
});

