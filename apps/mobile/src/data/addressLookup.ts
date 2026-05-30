import { fetchApi } from './api';

export interface AddressCandidate {
  id: string;
  roadAddress: string;
  jibunAddress: string;
  zipCode: string;
  sido: string;
  sigungu: string;
  detail: string;
}

export interface AddressSearchResult {
  source: 'juso' | 'local';
  candidates: AddressCandidate[];
  totalCount?: number;
  message?: string;
}

export async function fetchAddressCandidates(keyword: string): Promise<AddressSearchResult> {
  const query = new URLSearchParams({
    keyword,
    count: '8',
  });
  const response = await fetchApi(`/address/search?${query.toString()}`, {}, 9000);
  if (!response.ok) throw new Error('주소 검색에 실패했습니다.');
  return await response.json() as AddressSearchResult;
}
