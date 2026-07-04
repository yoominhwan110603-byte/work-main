import asyncio
import math
import os
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx


DISCOGS_API_URL = "https://api.discogs.com"
REPRESENTATIVE_LIMIT = 5
CACHE_TTL_SECONDS = 15 * 60


def discogs_headers() -> dict[str, str]:
    headers = {"User-Agent": "VinylCheck/0.1 +https://vinyl-check.local"}
    token = os.getenv("DISCOGS_TOKEN", "").strip().strip('"').strip("'")
    if token:
        headers["Authorization"] = f"Discogs token={token}"
    return headers


def normalize_name(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip().casefold()
    return re.sub(r"\s*\(\d+\)$", "", text)


def split_release_title(value: Any) -> tuple[str, str]:
    text = str(value or "Unknown release").strip()
    if " - " in text:
        return tuple(part.strip() for part in text.split(" - ", 1))  # type: ignore[return-value]
    return "Unknown artist", text


def release_year(value: Any) -> int:
    match = re.search(r"(?:19|20)\d{2}", str(value or ""))
    return int(match.group(0)) if match else 0


def community_counts(item: dict[str, Any]) -> tuple[int, int]:
    community = (item.get("stats") or {}).get("community") or item.get("community") or {}
    have = community.get("in_collection", community.get("have", 0))
    want = community.get("in_wantlist", community.get("want", 0))
    return int(have or 0), int(want or 0)


def is_lp_version(item: dict[str, Any]) -> bool:
    major_formats = item.get("major_formats") or item.get("format") or []
    if isinstance(major_formats, str):
        major_formats = [major_formats]
    major_text = " ".join(str(value) for value in major_formats).casefold()
    format_text = str(item.get("format") or "").casefold()
    return "vinyl" in major_text and bool(re.search(r"(?:^|[,\s])lp(?:$|[,\s])", format_text))


def _label(item: dict[str, Any]) -> str:
    value = item.get("label") or "Unknown label"
    if isinstance(value, list):
        return str(value[0]) if value else "Unknown label"
    return str(value)


def version_candidate(item: dict[str, Any], master: dict[str, Any], reason: str | None = None) -> dict[str, Any]:
    artist, version_title = split_release_title(item.get("title"))
    master_artist = str(master.get("artist") or artist)
    master_title = str(master.get("title") or version_title)
    have, want = community_counts(item)
    result = {
        "id": f"discogs-{int(item.get('id') or 0)}",
        "releaseId": int(item.get("id") or 0),
        "masterId": int(master.get("masterId") or 0),
        "title": master_title,
        "artist": master_artist,
        "year": release_year(item.get("released") or item.get("year")),
        "label": _label(item),
        "catalogNumber": str(item.get("catno") or ""),
        "country": str(item.get("country") or "Unknown"),
        "coverImageUrl": str(item.get("cover_image") or item.get("thumb") or master.get("coverImageUrl") or ""),
        "pressing": str(item.get("format") or "LP"),
        "confidence": 92,
        "communityHave": have,
        "communityWant": want,
    }
    if reason:
        result["representativeReason"] = reason
    return result


def _information_score(item: dict[str, Any]) -> float:
    fields = [item.get("thumb") or item.get("cover_image"), item.get("label"), item.get("country"), item.get("catno"), item.get("released")]
    return 2.0 * sum(bool(value) for value in fields)


def _base_scores(items: list[dict[str, Any]]) -> dict[int, float]:
    counts = [(item, *community_counts(item)) for item in items]
    max_have = max((math.log1p(have) for _, have, _ in counts), default=0.0)
    max_want = max((math.log1p(want) for _, _, want in counts), default=0.0)
    return {
        int(item.get("id") or 0): (
            (45.0 * math.log1p(have) / max_have if max_have else 0.0)
            + (30.0 * math.log1p(want) / max_want if max_want else 0.0)
            + _information_score(item)
        )
        for item, have, want in counts
    }


def _diversity_score(item: dict[str, Any], selected: list[dict[str, Any]]) -> float:
    if not selected:
        return 15.0
    countries = {normalize_name(value.get("country")) for value in selected}
    labels = {normalize_name(_label(value)) for value in selected}
    decades = {release_year(value.get("released")) // 10 for value in selected if release_year(value.get("released"))}
    year = release_year(item.get("released"))
    score = 0.0
    if normalize_name(item.get("country")) not in countries:
        score += 8.0
    if normalize_name(_label(item)) not in labels:
        score += 5.0
    if year and year // 10 not in decades:
        score += 2.0
    return score


def select_representative_versions(
    raw_versions: list[dict[str, Any]],
    *,
    main_release_id: int = 0,
    master_year: int = 0,
) -> tuple[list[tuple[dict[str, Any], str]], list[dict[str, Any]]]:
    unique: dict[int, dict[str, Any]] = {}
    for item in raw_versions:
        release_id = int(item.get("id") or 0)
        if release_id and is_lp_version(item):
            unique.setdefault(release_id, item)
    versions = list(unique.values())
    if not versions:
        return [], []

    base_scores = _base_scores(versions)
    selected: list[tuple[dict[str, Any], str]] = []
    used: set[int] = set()

    def add(item: dict[str, Any] | None, reason: str) -> None:
        if not item or len(selected) >= REPRESENTATIVE_LIMIT:
            return
        release_id = int(item.get("id") or 0)
        if release_id and release_id not in used:
            selected.append((item, reason))
            used.add(release_id)

    add(next((item for item in versions if int(item.get("id") or 0) == main_release_id), None), "Discogs 대표")
    dated = [item for item in versions if release_year(item.get("released"))]
    add(min(dated, key=lambda item: (release_year(item.get("released")), -base_scores[int(item.get("id") or 0)]), default=None), "초기 발매")
    add(max(versions, key=lambda item: (community_counts(item)[0], base_scores[int(item.get("id") or 0)]), default=None), "많이 소장")
    add(max(versions, key=lambda item: (community_counts(item)[1], base_scores[int(item.get("id") or 0)]), default=None), "위시 인기")

    reissues = [
        item for item in versions
        if int(item.get("id") or 0) not in used
        and release_year(item.get("released")) > master_year
    ]
    if reissues:
        chosen_items = [item for item, _ in selected]
        add(max(reissues, key=lambda item: base_scores[int(item.get("id") or 0)] + _diversity_score(item, chosen_items)), "대표 재발매")

    while len(selected) < min(REPRESENTATIVE_LIMIT, len(versions)):
        available = [item for item in versions if int(item.get("id") or 0) not in used]
        if not available:
            break
        chosen_items = [item for item, _ in selected]
        add(max(available, key=lambda item: base_scores[int(item.get("id") or 0)] + _diversity_score(item, chosen_items)), "균형 추천")

    chosen_items = [item for item, _ in selected]
    remaining = [item for item in versions if int(item.get("id") or 0) not in used]
    remaining.sort(
        key=lambda item: (
            base_scores[int(item.get("id") or 0)] + _diversity_score(item, chosen_items),
            community_counts(item)[0],
            community_counts(item)[1],
            release_year(item.get("released")),
        ),
        reverse=True,
    )
    return selected, remaining


def album_summary(item: dict[str, Any], album_title: str = "", artist: str = "") -> dict[str, Any]:
    result_artist, result_title = split_release_title(item.get("title"))
    exact_title = not album_title or normalize_name(result_title) == normalize_name(album_title)
    exact_artist = not artist or normalize_name(result_artist) == normalize_name(artist)
    have, want = community_counts(item)
    return {
        "masterId": int(item.get("id") or item.get("master_id") or 0),
        "title": result_title,
        "artist": result_artist,
        "year": int(item.get("year") or 0),
        "coverImageUrl": str(item.get("cover_image") or item.get("thumb") or ""),
        "communityHave": have,
        "communityWant": want,
        "exactMatch": exact_title and exact_artist,
    }


def rank_album_results(items: list[dict[str, Any]], album_title: str = "", artist: str = "") -> list[dict[str, Any]]:
    summaries = [album_summary(item, album_title, artist) for item in items]

    def score(item: dict[str, Any]) -> tuple[int, int, int, int]:
        title_score = 2 if album_title and normalize_name(item["title"]) == normalize_name(album_title) else 1 if album_title and normalize_name(album_title) in normalize_name(item["title"]) else 0
        artist_score = 2 if artist and normalize_name(item["artist"]) == normalize_name(artist) else 1 if artist and normalize_name(artist) in normalize_name(item["artist"]) else 0
        return title_score, artist_score, int(item["communityHave"]), int(item["communityWant"])

    summaries.sort(key=score, reverse=True)
    return summaries


@dataclass
class VersionCatalog:
    representative: list[dict[str, Any]]
    remaining: list[dict[str, Any]]
    partial: bool


class DiscogsCatalogService:
    def __init__(self, ttl_seconds: int = CACHE_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._cache: dict[int, tuple[float, VersionCatalog]] = {}
        self._locks: dict[int, asyncio.Lock] = {}

    async def search_albums(self, album_title: str, artist: str, page: int, per_page: int) -> dict[str, Any]:
        params: dict[str, str] = {
            "type": "master",
            "page": str(page),
            "per_page": str(per_page),
        }
        if album_title:
            params["release_title"] = album_title
        if artist:
            params["artist"] = artist
        async with httpx.AsyncClient(timeout=10, headers=discogs_headers()) as client:
            response = await client.get(f"{DISCOGS_API_URL}/database/search", params=params)
            response.raise_for_status()
            payload = response.json()
        pagination = payload.get("pagination") or {}
        return {
            "source": "discogs",
            "albums": rank_album_results(payload.get("results") or [], album_title, artist),
            "pagination": {
                "page": int(pagination.get("page") or page),
                "perPage": int(pagination.get("per_page") or per_page),
                "pages": int(pagination.get("pages") or 0),
                "total": int(pagination.get("items") or 0),
            },
        }

    async def get_version_catalog(self, master_id: int, refresh: bool = False) -> VersionCatalog:
        cached = self._cache.get(master_id)
        if cached and not refresh and cached[0] > time.monotonic():
            return cached[1]
        lock = self._locks.setdefault(master_id, asyncio.Lock())
        async with lock:
            cached = self._cache.get(master_id)
            if cached and not refresh and cached[0] > time.monotonic():
                return cached[1]
            catalog = await self._load_version_catalog(master_id)
            self._cache[master_id] = (time.monotonic() + self.ttl_seconds, catalog)
            return catalog

    async def _load_version_catalog(self, master_id: int) -> VersionCatalog:
        versions: list[dict[str, Any]] = []
        partial = False
        async with httpx.AsyncClient(timeout=12, headers=discogs_headers()) as client:
            master_response = await client.get(f"{DISCOGS_API_URL}/masters/{master_id}")
            master_response.raise_for_status()
            master_payload = master_response.json()
            artists = master_payload.get("artists") or []
            master = {
                "masterId": master_id,
                "title": str(master_payload.get("title") or "Unknown release"),
                "artist": str((artists[0] if artists else {}).get("name") or "Unknown artist"),
                "coverImageUrl": str((master_payload.get("images") or [{}])[0].get("uri150") or (master_payload.get("images") or [{}])[0].get("uri") or ""),
            }
            first_response = await client.get(
                f"{DISCOGS_API_URL}/masters/{master_id}/versions",
                params={"format": "Vinyl", "page": "1", "per_page": "100"},
            )
            first_response.raise_for_status()
            first_payload = first_response.json()
            versions.extend(first_payload.get("versions") or [])
            pages = int((first_payload.get("pagination") or {}).get("pages") or 1)
            for start in range(2, pages + 1, 4):
                page_numbers = list(range(start, min(start + 4, pages + 1)))
                try:
                    responses = await asyncio.gather(*(
                        client.get(
                            f"{DISCOGS_API_URL}/masters/{master_id}/versions",
                            params={"format": "Vinyl", "page": str(page), "per_page": "100"},
                        )
                        for page in page_numbers
                    ))
                    for response in responses:
                        response.raise_for_status()
                        versions.extend(response.json().get("versions") or [])
                except httpx.HTTPError:
                    partial = True
                    break

        selected, remaining = select_representative_versions(
            versions,
            main_release_id=int(master_payload.get("main_release") or 0),
            master_year=int(master_payload.get("year") or 0),
        )
        return VersionCatalog(
            representative=[version_candidate(item, master, reason) for item, reason in selected],
            remaining=[version_candidate(item, master) for item in remaining],
            partial=partial,
        )


discogs_catalog_service = DiscogsCatalogService()
