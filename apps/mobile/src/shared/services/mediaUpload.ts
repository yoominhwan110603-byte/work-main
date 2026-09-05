import { fetchApi, resolveApiUrl } from '@/shared/services/api';

const UPLOADED_IMAGE_PATH_PREFIX = '/uploaded-images/';

export function resolveUploadedImageUrl(value = '') {
  return value.startsWith(UPLOADED_IMAGE_PATH_PREFIX) ? resolveApiUrl(value) : value;
}

function dataUrlToImageFile(dataUrl: string, filename: string) {
  const [header, base64Data = ''] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+);base64/i)?.[1] || 'image/jpeg';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], filename, { type: mimeType });
}

export async function persistListingImage(value: string, filename: string) {
  if (!value || !value.startsWith('data:image/')) return value;

  try {
    const formData = new FormData();
    formData.append('file', dataUrlToImageFile(value, filename));
    const response = await fetchApi('/uploads/images', {
      method: 'POST',
      body: formData,
    }, 20_000);
    const payload = await response.json().catch(() => ({})) as { url?: string; detail?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.detail || '상품 사진을 서버에 저장하지 못했습니다.');
    }
    return payload.url;
  } catch (error) {
    const reason = error instanceof Error ? error.message : '알 수 없는 업로드 오류입니다.';
    throw new Error(`상품 사진 업로드가 실패해 게시가 취소되었습니다. ${reason}`);
  }
}
