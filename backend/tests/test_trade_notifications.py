import unittest
from copy import deepcopy
from unittest.mock import patch

import httpx
from fastapi import FastAPI

from app.routers import api
from app.services.market_pricing import find_matching_buy_orders, normalize_market_key


class TradeNotificationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.listing = {
            "id": "listing-a", "title": "Kind of Blue", "artist": "Miles Davis",
            "catalog_number": "CS 8163", "seller_id": "seller", "price": 50000,
            "audio_grade": "VG+", "status": "published", "created_at": api.now_iso(),
        }
        self.documents = {
            api.LISTINGS_PATH: [
                self.listing,
                {**self.listing, "id": "listing-b"},
                {**self.listing, "id": "listing-other", "seller_id": "other-seller"},
            ],
            api.USERS_PATH: {user_id: {"id": user_id, "username": user_id}
                             for user_id in ("seller", "buyer", "other-seller")},
        }
        self.read_patch = patch.object(api, "read_json", side_effect=lambda path, fallback: deepcopy(self.documents.get(path, fallback)))
        self.write_patch = patch.object(api, "write_json", side_effect=lambda path, payload: self.documents.__setitem__(path, deepcopy(payload)))
        self.read_patch.start()
        self.write_patch.start()
        self.addCleanup(self.read_patch.stop)
        self.addCleanup(self.write_patch.stop)
        self.headers = {user_id: {"Authorization": f"Bearer {api.create_session(user_id)}"}
                        for user_id in ("seller", "buyer", "other-seller")}
        app = FastAPI()
        app.include_router(api.router)
        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")
        self.addAsyncCleanup(self.client.aclose)

    async def create_order(self, **overrides):
        response = await self.client.post("/market/buy-orders", headers=self.headers["buyer"], json={
            "buyer_id": "buyer", "listing_id": "listing-a", "max_price": 45000, **overrides,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["buyOrder"]

    async def notifications(self, user_id="seller"):
        response = await self.client.get("/users/me/notifications", headers=self.headers[user_id])
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["notifications"]

    async def test_received_offers_are_scoped_to_listing_even_for_same_album(self):
        self.documents[api.OFFERS_PATH] = [
            {"id": "offer-a", "listingId": "listing-a", "sellerId": "seller", "buyerId": "buyer", "offerPrice": 40000},
            {"id": "offer-b", "listing_id": "listing-b", "seller_id": "seller", "buyer_id": "buyer", "offer_price": 45000},
            {"id": "offer-other", "listingId": "listing-other", "sellerId": "other-seller", "buyerId": "buyer", "offerPrice": 45000},
        ]
        path = "/users/seller/offers/received"
        scoped = await self.client.get(path, params={"listing_id": "listing-a"})
        self.assertEqual([offer["id"] for offer in scoped.json()["offers"]], ["offer-a"])
        second = await self.client.get(path, params={"listing_id": "listing-b"})
        self.assertEqual([offer["id"] for offer in second.json()["offers"]], ["offer-b"])
        empty = await self.client.get(path, params={"listing_id": "listing-other"})
        self.assertEqual(empty.json()["offers"], [])
        all_offers = await self.client.get(path)
        self.assertEqual({offer["id"] for offer in all_offers.json()["offers"]}, {"offer-a", "offer-b"})
        for notification in await self.notifications():
            self.assertEqual(notification["link"], f"/transaction/offers/received?listingId={notification['listingId']}")

    async def test_buy_order_notifies_only_target_seller_with_product_link(self):
        await self.create_order()
        notifications = await self.notifications()
        self.assertEqual(len(notifications), 1)
        notification = notifications[0]
        self.assertEqual(notification["type"], "buy_order")
        self.assertEqual(notification["listingId"], "listing-a")
        self.assertEqual(notification["link"], "/app/album/listing-a?mine=true&buyOrders=1")
        self.assertIn("45,000", notification["message"])
        self.assertIn("Kind of Blue", notification["message"])
        self.assertEqual(await self.notifications("buyer"), [])
        self.assertEqual(await self.notifications("other-seller"), [])
        count = await self.client.get("/notifications/unread-count", headers=self.headers["seller"])
        self.assertEqual(count.json()["unreadCount"], 1)
        for listing_id, expected in (("listing-a", 1), ("listing-b", 0), ("listing-other", 0)):
            matches = await self.client.get("/market/buy-orders/matches", params={"listing_id": listing_id})
            self.assertEqual(len(matches.json()["matches"]), expected)

    async def test_buy_order_notification_is_stable_readable_and_dismissible(self):
        await self.create_order()
        notification_id = (await self.notifications())[0]["id"]
        self.assertEqual((await self.notifications())[0]["id"], notification_id)
        marked = await self.client.patch(f"/notifications/{notification_id}/read", headers=self.headers["seller"])
        self.assertEqual(marked.status_code, 200)
        self.assertTrue((await self.notifications())[0]["isRead"])
        count = await self.client.get("/notifications/unread-count", headers=self.headers["seller"])
        self.assertEqual(count.json()["unreadCount"], 0)
        dismissed = await self.client.delete(f"/notifications/{notification_id}", headers=self.headers["seller"])
        self.assertEqual(dismissed.status_code, 200)
        self.assertEqual(await self.notifications(), [])

    async def test_paused_and_self_orders_do_not_notify_or_match(self):
        await self.create_order(status="paused")
        self.assertEqual(await self.notifications(), [])
        self.documents[api.BUY_ORDERS_PATH].append({
            "id": "legacy-self-order", "buyer_id": "seller", "listing_id": "listing-a",
            "market_key": normalize_market_key(self.listing), "max_price": 45000, "status": "active",
        })
        self.assertEqual(find_matching_buy_orders(self.listing, self.documents[api.BUY_ORDERS_PATH]), [])
        self.assertEqual(await self.notifications(), [])

    async def test_market_wide_order_still_matches_eligible_listings(self):
        await self.create_order(listing_id=None, market_key=normalize_market_key(self.listing))
        self.assertEqual({item["listingId"] for item in await self.notifications()}, {"listing-a", "listing-b"})
        self.assertEqual([item["listingId"] for item in await self.notifications("other-seller")], ["listing-other"])

    async def test_purchase_requires_buyer_identity_and_available_non_owned_listing(self):
        payload = {"buyer_id": "buyer", "listing_id": "listing-a", "max_price": 45000}
        anonymous = await self.client.post("/market/buy-orders", json=payload)
        self.assertEqual(anonymous.status_code, 401)
        impersonated = await self.client.post("/market/buy-orders", json=payload, headers=self.headers["other-seller"])
        self.assertEqual(impersonated.status_code, 403)
        own = await self.client.post("/market/buy-orders", json={**payload, "buyer_id": "seller"}, headers=self.headers["seller"])
        self.assertEqual(own.status_code, 400)
        self.documents[api.LISTINGS_PATH][0]["status"] = "sold"
        sold = await self.client.post("/market/buy-orders", json=payload, headers=self.headers["buyer"])
        self.assertEqual(sold.status_code, 400)
        self.assertEqual(self.documents.get(api.BUY_ORDERS_PATH, []), [])

    async def test_seller_approval_opens_buyer_chat_and_clears_pending_notification(self):
        order = await self.create_order()
        path = "/market/listings/listing-a/instant-sell"
        payload = {"seller_id": "seller", "buy_order_id": order["id"]}
        unauthorized = await self.client.post(path, json=payload, headers=self.headers["other-seller"])
        self.assertEqual(unauthorized.status_code, 403)
        response = await self.client.post(path, json=payload, headers=self.headers["seller"])
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result["listing"]["status"], "reserved")
        self.assertEqual(result["buyOrder"]["status"], "matched")
        self.assertEqual(result["transaction"]["price"], 45000)
        self.assertEqual(await self.notifications(), [])
        buyer_notifications = await self.notifications("buyer")
        self.assertEqual(len(buyer_notifications), 1)
        self.assertIn(result["chatId"], buyer_notifications[0]["link"])


if __name__ == "__main__":
    unittest.main()
