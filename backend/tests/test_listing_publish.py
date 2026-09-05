import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.routers import api
from app.schemas import ListingCreate


class ListingPublishTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_listing_normalizes_uploaded_images(self):
        documents = {
            api.LISTINGS_PATH: [],
            api.BUY_ORDERS_PATH: [],
            api.MARKET_PRICE_HISTORY_PATH: [],
            api.WISHLIST_PATH: [],
            api.NOTIFICATIONS_PATH: [],
            api.USERS_PATH: {
                "seller-1": {
                    "id": "seller-1",
                    "username": "seller",
                    "rating": 4.8,
                    "transactionCount": 7,
                },
            },
        }

        def read_json(path, fallback):
            return documents.get(path, fallback)

        def write_json(path, payload):
            documents[path] = payload

        with patch.object(api, "read_json", side_effect=read_json), patch.object(api, "write_json", side_effect=write_json):
            result = await api.create_listing(ListingCreate(
                title="Kind of Blue",
                artist="Miles Davis",
                catalog_number="CS 8163",
                price=50000,
                user_id="seller-1",
                images=["/uploaded-images/cover.jpg"],
                cover_image_data_url="/uploaded-images/cover.jpg",
                record_image_data_url="/uploaded-images/surface.jpg",
                tags=[" jazz ", "#lp"],
                location="서울 마포구",
            ))

        stored = documents[api.LISTINGS_PATH][0]
        self.assertEqual(result["status"], "ok")
        self.assertEqual(stored["seller_id"], "seller-1")
        self.assertEqual(stored["location"], "서울 마포구")
        self.assertEqual(stored["cover_image_data_url"], "/uploaded-images/cover.jpg")
        self.assertIn("/uploaded-images/surface.jpg", stored["images"])
        self.assertEqual(result["listing"]["seller"]["name"], "seller")

    async def test_create_listing_rejects_out_of_range_price_with_estimate(self):
        documents = {
            api.LISTINGS_PATH: [],
            api.BUY_ORDERS_PATH: [],
            api.MARKET_PRICE_HISTORY_PATH: [],
            api.WISHLIST_PATH: [],
            api.USERS_PATH: {},
        }

        estimate = {
            "marketKey": "test-market",
            "basePrice": 100000,
            "minPrice": 90000,
            "maxPrice": 110000,
            "recommendedPrice": 100000,
            "instantSalePrice": 85000,
            "metrics": {},
        }

        with (
            patch.object(api, "read_json", side_effect=lambda path, fallback: documents.get(path, fallback)),
            patch.object(api, "validate_listing_price", return_value=(False, estimate, "가격 범위를 확인해 주세요.")),
        ):
            with self.assertRaises(HTTPException) as raised:
                await api.create_listing(ListingCreate(title="Overpriced LP", price=999999, user_id="seller-1"))

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail["message"], "가격 범위를 확인해 주세요.")
        self.assertEqual(raised.exception.detail["priceEstimate"], estimate)


if __name__ == "__main__":
    unittest.main()
