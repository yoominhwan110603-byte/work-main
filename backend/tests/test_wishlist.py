import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.routers import api
from app.schemas import WishlistCreate, WishlistUpdate
from app.services.storage import read_json, write_json


class WishlistMatchingTests(unittest.TestCase):
    def test_release_id_has_priority(self):
        wish = {"status": "active", "discogs_release_id": 10, "catalog_number": "CS 8163"}
        self.assertTrue(api.wishlist_matches_listing(wish, {"status": "published", "discogs_release_id": 10, "catalog_number": "CS 8163"}))
        self.assertFalse(api.wishlist_matches_listing(wish, {"status": "published", "discogs_release_id": 11, "catalog_number": "CS 8163"}))

    def test_catalog_and_title_fallbacks(self):
        catalog_wish = {"status": "active", "catalog_number": "CS-8163"}
        self.assertTrue(api.wishlist_matches_listing(catalog_wish, {"status": "published", "catalog_number": "CS-8163"}))
        title_wish = {"status": "active", "title": "Kind of Blue", "artist": "Miles Davis", "year": 1959}
        self.assertTrue(api.wishlist_matches_listing(title_wish, {"status": "published", "title": "Kind of Blue", "artist": "Miles Davis", "year": 1959}))
        self.assertFalse(api.wishlist_matches_listing(title_wish, {"status": "published", "title": "Kind of Blue", "artist": "Miles Davis", "year": 1995}))

    def test_non_active_listing_does_not_match(self):
        wish = {"status": "active", "catalog_number": "CS 8163"}
        self.assertFalse(api.wishlist_matches_listing(wish, {"status": "sold", "catalog_number": "CS 8163"}))
        self.assertFalse(api.wishlist_matches_listing(wish, {"status": "hidden", "catalog_number": "CS 8163"}))


class WishlistApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.paths = {
            "WISHLIST_PATH": os.path.join(self.temp_dir.name, "wishlist.json"),
            "LISTINGS_PATH": os.path.join(self.temp_dir.name, "listings.json"),
            "NOTIFICATIONS_PATH": os.path.join(self.temp_dir.name, "notifications.json"),
            "NOTIFICATION_READS_PATH": os.path.join(self.temp_dir.name, "notification_reads.json"),
            "NOTIFICATION_DISMISSES_PATH": os.path.join(self.temp_dir.name, "notification_dismisses.json"),
            "SESSIONS_PATH": os.path.join(self.temp_dir.name, "sessions.json"),
            "USERS_PATH": os.path.join(self.temp_dir.name, "users.json"),
        }
        self.patchers = [patch.object(api, name, value) for name, value in self.paths.items()]
        for patcher in self.patchers:
            patcher.start()
        write_json(self.paths["USERS_PATH"], {
            "buyer": {"id": "buyer", "username": "buyer", "rating": 0, "transactionCount": 0},
            "seller": {"id": "seller", "username": "seller", "rating": 0, "transactionCount": 0},
        })

    async def asyncTearDown(self):
        for patcher in reversed(self.patchers):
            patcher.stop()
        self.temp_dir.cleanup()

    async def test_private_create_update_public_and_owner_checks(self):
        created = await api.create_wishlist_item(WishlistCreate(
            title="Kind of Blue",
            artist="Miles Davis",
            catalog_number="CS 8163",
            discogs_release_id=3841623,
            cover_image_url="https://example.com/cover.jpg",
            release_label="Columbia",
            release_country="US",
            year=1995,
        ), "buyer")
        item = created["wishlistItem"]
        self.assertEqual(item["visibility"], "private")
        self.assertEqual(item["coverImageUrl"], "https://example.com/cover.jpg")
        self.assertEqual((await api.get_public_wishlist("buyer"))["wishlist"], [])

        updated = await api.update_wishlist_item(item["id"], WishlistUpdate(visibility="public"), "buyer")
        self.assertEqual(updated["wishlistItem"]["visibility"], "public")
        self.assertEqual(len((await api.get_public_wishlist("buyer"))["wishlist"]), 1)

        with self.assertRaises(HTTPException):
            await api.delete_wishlist_item(item["id"], "other-user")

    async def test_existing_matches_and_new_listing_notification(self):
        created = await api.create_wishlist_item(WishlistCreate(
            title="Kind of Blue",
            artist="Miles Davis",
            catalog_number="CS 8163",
            discogs_release_id=3841623,
        ), "buyer")
        item = created["wishlistItem"]
        listing = {
            "id": "listing-1",
            "seller_id": "seller",
            "status": "published",
            "title": "Kind of Blue",
            "artist": "Miles Davis",
            "catalog_number": "CS 8163",
            "discogs_release_id": 3841623,
            "price": 50000,
            "created_at": api.now_iso(),
        }
        write_json(self.paths["LISTINGS_PATH"], [listing])
        matches = await api.get_wishlist_matches(item["id"], "buyer")
        self.assertEqual([match["id"] for match in matches["matches"]], ["listing-1"])
        self.assertEqual(read_json(self.paths["NOTIFICATIONS_PATH"], []), [])

        first = api.wishlist_notification_for_listing(listing)
        second = api.wishlist_notification_for_listing(listing)
        self.assertEqual(len(first), 1)
        self.assertEqual(second, [])

        notification_id = first[0]["id"]
        await api.mark_notification_read(notification_id, "buyer")
        notifications = api.collect_user_notifications("buyer")
        self.assertTrue(next(item for item in notifications if item["id"] == notification_id)["isRead"])

        dismissed = await api.dismiss_notification(notification_id, "buyer")
        self.assertTrue(dismissed["ok"])
        self.assertNotIn(notification_id, [item["id"] for item in api.collect_user_notifications("buyer")])
        self.assertIn(notification_id, read_json(self.paths["NOTIFICATION_DISMISSES_PATH"], {}).get("buyer", []))

    def test_session_round_trip(self):
        token = api.create_session("buyer")
        self.assertEqual(api.require_user_id(f"Bearer {token}"), "buyer")


if __name__ == "__main__":
    unittest.main()
