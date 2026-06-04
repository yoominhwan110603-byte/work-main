import { fetchApi } from '@/shared/services/api';

export interface AddressCandidate {
  id: string;
  roadAddress: string;
  jibunAddress: string;
  zipCode: string;
  sido: string;
  sigungu: string;
  detail: string;
  placeName?: string;
  address?: string;
  longitude?: string;
  latitude?: string;
  category?: string;
}

export interface AddressSearchResult {
  source: 'kakao';
  candidates: AddressCandidate[];
  totalCount?: number;
  message?: string;
}

export interface AddressApiKeyStatus {
  hasKey: boolean;
  provider?: 'kakao';
  message?: string;
}

export async function fetchAddressCandidates(keyword: string): Promise<AddressSearchResult> {
  const query = new URLSearchParams({
    keyword,
    count: '8',
  });
  const response = await fetchApi(`/address/search?${query.toString()}`, {}, 9000);
  if (!response.ok) throw new Error('카카오 지도 검색에 실패했습니다.');
  return await response.json() as AddressSearchResult;
}

export async function fetchAddressApiKeyStatus(): Promise<AddressApiKeyStatus> {
  const response = await fetchApi('/address/api-key', {}, 5000);
  if (!response.ok) throw new Error('카카오 API 키 상태를 확인하지 못했습니다.');
  return await response.json() as AddressApiKeyStatus;
}

export async function saveAddressApiKey(apiKey: string): Promise<AddressApiKeyStatus> {
  const response = await fetchApi('/address/api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  }, 7000);
  const payload = await response.json().catch(() => ({})) as AddressApiKeyStatus & { detail?: string };
  if (!response.ok) throw new Error(payload.detail || '카카오 API 키를 저장하지 못했습니다.');
  return payload;
}
