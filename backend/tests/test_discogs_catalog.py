import unittest
from unittest.mock import AsyncMock, patch

from app.routers import api
from app.services.discogs_catalog import (
    VersionCatalog,
    rank_album_results,
    select_representative_versions,
    version_candidate,
)


def lp_version(
    release_id: int,
    year: int,
    *,
    country: str = "US",
    label: str = "Label",
    have: int = 0,
    want: int = 0,
    format_name: str = "LP, Album",
) -> dict:
    return {
        "id": release_id,
        "title": "Artist - Album",
        "released": str(year),
        "country": country,
        "label": label,
        "catno": f"CAT-{release_id}",
        "major_formats": ["Vinyl"] if "LP" in format_name else ["CD"],
        "format": format_name,
        "thumb": f"https://example.com/{release_id}.jpg",
        "stats": {"community": {"in_collection": have, "in_wantlist": want}},
    }


class DiscogsRepresentativeTests(unittest.TestCase):
    def test_balanced_representative_slots_are_distinct(self):
        versions = [
            lp_version(1, 1959, country="US", label="Main", have=50, want=40),
            lp_version(2, 1958, country="UK", label="Early", have=20, want=100),
            lp_version(3, 1965, country="US", label="Popular", have=5000, want=200),
            lp_version(4, 1970, country="Japan", label="Wanted", have=100, want=6000),
            lp_version(5, 2020, country="Germany", label="Reissue", have=1000, want=800),
            lp_version(6, 2022, country="US", label="Reissue", have=200, want=100),
        ]

        selected, remaining = select_representative_versions(versions, main_release_id=1, master_year=1959)

        self.assertEqual([item[0]["id"] for item in selected], [1, 2, 3, 4, 5])
        self.assertEqual([item[1] for item in selected], ["Discogs 대표", "초기 발매", "많이 소장", "위시 인기", "대표 재발매"])
        self.assertEqual([item["id"] for item in remaining], [6])

    def test_non_lp_and_duplicate_releases_are_excluded(self):
        versions = [
            lp_version(10, 1970),
            lp_version(10, 1990, country="Japan"),
            lp_version(11, 1970, format_name="CD, Album"),
            lp_version(12, 1980),
        ]

        selected, remaining = select_representative_versions(versions, main_release_id=0, master_year=1970)
        ids = [item[0]["id"] for item in selected] + [item["id"] for item in remaining]

        self.assertEqual(sorted(ids), [10, 12])
        self.assertEqual(len(ids), len(set(ids)))

    def test_fewer_than_five_versions_returns_available_count(self):
        selected, remaining = select_representative_versions(
            [lp_version(20, 1970), lp_version(21, 1980)],
            main_release_id=20,
            master_year=1970,
        )
        self.assertEqual(len(selected), 2)
        self.assertEqual(remaining, [])

    def test_album_exact_match_ranks_before_popular_near_match(self):
        results = [
            {"id": 1, "title": "Miles Davis - Kind Of Blue (Remixes)", "community": {"have": 9000, "want": 8000}},
            {"id": 2, "title": "Miles Davis - Kind Of Blue", "community": {"have": 100, "want": 50}},
        ]
        ranked = rank_album_results(results, "Kind Of Blue", "Miles Davis")
        self.assertEqual(ranked[0]["masterId"], 2)
        self.assertTrue(ranked[0]["exactMatch"])


class DiscogsCatalogApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_album_search_proxies_pagination(self):
        expected = {
            "source": "discogs",
            "albums": [],
            "pagination": {"page": 1, "perPage": 10, "pages": 0, "total": 0},
        }
        with patch.object(api.discogs_catalog_service, "search_albums", AsyncMock(return_value=expected)) as mocked:
            result = await api.search_discogs_albums("Kind of Blue", "Miles Davis", 1, 10)
        self.assertEqual(result, expected)
        mocked.assert_awaited_once_with("Kind of Blue", "Miles Davis", 1, 10)

    async def test_more_versions_excludes_representatives_and_pages_twenty(self):
        master = {"masterId": 99, "title": "Album", "artist": "Artist", "coverImageUrl": ""}
        representative = [version_candidate(lp_version(index, 1970 + index), master, "균형 추천") for index in range(1, 6)]
        remaining = [version_candidate(lp_version(index, 1970 + index), master) for index in range(6, 31)]
        catalog = VersionCatalog(representative=representative, remaining=remaining, partial=False)
        with patch.object(api.discogs_catalog_service, "get_version_catalog", AsyncMock(return_value=catalog)):
            first = await api.get_discogs_master_versions(99, 0, 20)
            second = await api.get_discogs_master_versions(99, first["nextOffset"], 20)

        representative_ids = {item["releaseId"] for item in representative}
        self.assertEqual(len(first["versions"]), 20)
        self.assertEqual(len(second["versions"]), 5)
        self.assertFalse(representative_ids.intersection(item["releaseId"] for item in first["versions"]))
        self.assertEqual(first["remainingCount"], 5)
        self.assertFalse(second["hasMore"])

    async def test_representative_response_reports_partial_state(self):
        catalog = VersionCatalog(representative=[{"releaseId": 1}], remaining=[{"releaseId": 2}], partial=True)
        with patch.object(api.discogs_catalog_service, "get_version_catalog", AsyncMock(return_value=catalog)):
            result = await api.get_discogs_representative_versions(10)
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["remainingCount"], 1)
        self.assertTrue(result["partial"])


if __name__ == "__main__":
    unittest.main()
