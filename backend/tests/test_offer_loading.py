import unittest
from collections import Counter
from copy import deepcopy
from unittest.mock import patch

from app.routers import api


class OfferLoadingTests(unittest.TestCase):
    def setUp(self):
        self.listing = {
            "id": "listing-a", "title": "Kind of Blue", "artist": "Miles Davis",
            "seller_id": "seller", "price": 50000, "created_at": "2026-09-05T00:00:00Z",
        }
        self.offer = {
            "id": "offer-a", "listingId": "listing-a", "sellerId": "seller",
            "buyerId": "buyer", "offerPrice": 45000, "timestamp": "2026-09-05T00:00:00Z",
        }
        self.documents = {
            api.LISTINGS_PATH: [self.listing],
            api.USERS_PATH: {"seller": {"username": "Seller"}},
        }
        self.reads = Counter()

        def read(path, fallback):
            self.reads[path] += 1
            return deepcopy(self.documents.get(path, fallback))

        read_patch = patch.object(api, "read_json", side_effect=read)
        read_patch.start()
        self.addCleanup(read_patch.stop)
        time_patch = patch.object(api, "now_iso", return_value="2026-09-05T00:00:00Z")
        time_patch.start()
        self.addCleanup(time_patch.stop)

    def test_distinct_listings_read_each_document_once(self):
        self.documents[api.LISTINGS_PATH] = [{**self.listing, "id": f"listing-{i}"} for i in range(40)]
        offers = [{**self.offer, "id": f"offer-{i}", "listingId": f"listing-{i}"} for i in range(40)]
        result = api.normalize_offers(offers)
        self.assertEqual(len(result), 40)
        self.assertEqual([item["album"]["id"] for item in result], [item["listingId"] for item in offers])
        self.assertEqual(self.reads, {api.LISTINGS_PATH: 1, api.USERS_PATH: 1, api.WISHLIST_PATH: 1})

    def test_repeated_listing_is_normalized_once(self):
        offers = [{**self.offer, "id": f"offer-{i}", "offerPrice": 40000 + i} for i in range(40)]
        with patch.object(api, "listing_to_album", wraps=api.listing_to_album) as normalize:
            result = api.normalize_offers(offers)
        self.assertEqual(normalize.call_count, 1)
        self.assertEqual([item["offerPrice"] for item in result], [item["offerPrice"] for item in offers])
        self.assertEqual(len({item["id"] for item in result}), 40)

    def test_batch_matches_single_normalization_for_legacy_and_missing_targets(self):
        self.documents[api.COLLECTIONS_PATH] = [{"id": "collection-a", "ownerId": "seller", "title": "Collection"}]
        offers = [
            self.offer,
            {"id": "legacy", "listing_id": "listing-a", "seller_id": "seller", "buyer_id": "buyer", "offer_price": 20000},
            {**self.offer, "listingId": "collection-a", "collectionId": "collection-a"},
            {**self.offer, "collection_id": "deleted-collection"},
            {**self.offer, "listingId": "deleted-listing"},
        ]
        if api.MOCK_LISTINGS:
            offers.append({**self.offer, "listingId": str(api.MOCK_LISTINGS[0]["id"])})
        expected = [api.normalize_offer(item) for item in offers]
        self.assertEqual(api.normalize_offers(offers), expected)

    def test_collections_share_owner_snapshot_without_loading_listings(self):
        self.documents[api.COLLECTIONS_PATH] = [
            {"id": f"collection-{i}", "ownerId": "seller", "title": f"Collection {i}"} for i in range(20)
        ]
        offers = [{**self.offer, "listingId": "", "collectionId": f"collection-{i}"} for i in range(20)]
        result = api.normalize_offers(offers)
        self.assertTrue(all(item["offerType"] == "collection" for item in result))
        self.assertTrue(all(item["album"]["seller"]["name"] == "Seller" for item in result))
        self.assertEqual(self.reads, {api.COLLECTIONS_PATH: 1, api.USERS_PATH: 1})

    def test_empty_batch_does_not_load_documents(self):
        self.assertEqual(api.normalize_offers([]), [])
        self.assertEqual(self.reads, {})

    def test_snapshots_are_not_reused_across_requests(self):
        first = api.normalize_offers([self.offer])[0]
        self.documents[api.LISTINGS_PATH][0]["status"] = "reserved"
        self.documents[api.USERS_PATH]["seller"]["username"] = "Updated Seller"
        second = api.normalize_offers([self.offer])[0]
        self.assertEqual(first["album"]["status"], "published")
        self.assertEqual(second["album"]["status"], "reserved")
        self.assertEqual(second["album"]["seller"]["name"], "Updated Seller")

    def test_unrelated_and_self_offers_are_excluded_before_album_loading(self):
        self.documents[api.OFFERS_PATH] = [
            {**self.offer, "sellerId": "someone-else"},
            {**self.offer, "buyerId": "seller"},
            {**self.offer, "listingId": "listing-b"},
        ]
        self.assertEqual(api.normalize_offers(api.received_offer_items("seller", "listing-a")), [])
        self.assertEqual(self.reads, {api.OFFERS_PATH: 1})

    def test_notifications_filter_before_scan_limit_and_share_snapshots(self):
        self.documents[api.OFFERS_PATH] = [
            {**self.offer, "id": f"unrelated-{i}", "sellerId": "someone-else"}
            for i in range(api.MAX_DYNAMIC_NOTIFICATION_SCAN)
        ] + [{**self.offer, "id": f"mine-{i}"} for i in range(3)]
        with patch.object(api, "listing_to_album", wraps=api.listing_to_album) as normalize:
            notifications = api.collect_user_notifications("seller")
        self.assertEqual({item["id"] for item in notifications}, {f"offer-mine-{i}" for i in range(3)})
        self.assertEqual(normalize.call_count, 1)
        self.assertEqual(self.reads[api.LISTINGS_PATH], 1)
        self.assertEqual(self.reads[api.USERS_PATH], 1)


if __name__ == "__main__":
    unittest.main()
