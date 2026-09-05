import unittest

from app.routers import api


class ListingImageRoleTests(unittest.TestCase):
    cover = "/uploaded-images/cover.jpg"
    record = "/uploaded-images/surface.jpg"
    extra = "/uploaded-images/extra.jpg"

    def round_trip(self, payload):
        listing = api.normalize_listing_payload(payload, "listing-images", "seller")
        stored = api.compact_listing_for_storage(listing)
        album = api.listing_to_album(stored, users={}, wishlist_items=[])
        return stored, album, api.compact_listing_album(album)

    def test_surface_only_does_not_become_cover_after_storage_or_list_response(self):
        stored, album, summary = self.round_trip({
            "images": [self.record], "cover_image_data_url": "", "record_image_data_url": self.record,
        })
        self.assertEqual(stored["cover_image_data_url"], "")
        for result in (album, summary):
            self.assertEqual(result["coverImageDataUrl"], "")
            self.assertEqual(result["recordImageDataUrl"], self.record)

    def test_cover_only_does_not_turn_an_extra_image_into_a_surface(self):
        stored, album, _ = self.round_trip({
            "images": [self.cover, self.extra], "cover_image_data_url": self.cover, "record_image_data_url": "",
        })
        self.assertEqual(stored["record_image_data_url"], "")
        self.assertEqual(album["coverImageDataUrl"], self.cover)
        self.assertEqual(album["recordImageDataUrl"], "")

    def test_distinct_images_retain_roles_regardless_of_gallery_order(self):
        stored, album, summary = self.round_trip({
            "images": [self.record, self.extra, self.cover],
            "cover_image_data_url": self.cover, "record_image_data_url": self.record,
        })
        self.assertEqual(stored["cover_image_data_url"], self.cover)
        self.assertEqual(stored["record_image_data_url"], self.record)
        for result in (album, summary):
            self.assertEqual(result["coverImageDataUrl"], self.cover)
            self.assertEqual(result["recordImageDataUrl"], self.record)

    def test_cleared_slots_do_not_reappear_from_old_analysis_or_gallery(self):
        stored, album, _ = self.round_trip({
            "images": [self.extra], "cover_image_data_url": "", "record_image_data_url": "",
            "analysis_report": {"coverImageDataUrl": self.cover, "recordImageDataUrl": self.record},
        })
        self.assertEqual(stored["images"], [self.extra])
        self.assertEqual(album["coverImageDataUrl"], "")
        self.assertEqual(album["recordImageDataUrl"], "")

    def test_camel_case_named_slots_preserve_empty_cover(self):
        _, album, _ = self.round_trip({
            "images": [self.record], "coverImageDataUrl": "", "recordImageDataUrl": self.record,
        })
        self.assertEqual(album["coverImageDataUrl"], "")
        self.assertEqual(album["recordImageDataUrl"], self.record)

    def test_legacy_gallery_and_sparse_slots_are_read_before_compaction(self):
        _, album, _ = self.round_trip({"images": [self.cover, self.record]})
        self.assertEqual(album["coverImageDataUrl"], self.cover)
        self.assertEqual(album["recordImageDataUrl"], self.record)
        _, sparse, _ = self.round_trip({"images": ["", self.record]})
        self.assertEqual(sparse["coverImageDataUrl"], "")
        self.assertEqual(sparse["recordImageDataUrl"], self.record)

    def test_unset_cover_does_not_promote_an_explicit_surface(self):
        _, album, _ = self.round_trip({
            "images": [self.record], "cover_image_data_url": None, "record_image_data_url": self.record,
        })
        self.assertEqual(album["coverImageDataUrl"], "")
        self.assertEqual(album["recordImageDataUrl"], self.record)


if __name__ == "__main__":
    unittest.main()
