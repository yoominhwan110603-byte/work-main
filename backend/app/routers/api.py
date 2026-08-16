import base64
import asyncio
import hashlib
import hmac
import json
import logging
import os
import smtplib
import tempfile
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Annotated, Any
from urllib.parse import quote
from uuid import uuid4

import cv2
import httpx
import numpy as np
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from ..schemas import (
    AuthCheck,
    AuthLogin,
    AuthSignup,
    BuyOrderCreate,
    ChatMessageCreate,
    CollectionCreate,
    CollectionOfferCreate,
    CollectionUpdate,
    CommentCreate,
    EmailVerificationConfirm,
    EmailVerificationRequest,
    FindIdConfirm,
    FindIdRequest,
    GoogleLogin,
    InstantSellRequest,
    ListingCreate,
    ListingDraftUpsert,
    OfferCreate,
    OfferStatusUpdate,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileDraftUpsert,
    ReviewCreate,
    ReviewUpdate,
    WishlistCreate,
    WishlistUpdate,
)
from ..services.lp_analysis import analyze_record_surface_image
from ..services.discogs_catalog import discogs_catalog_service
from ..services.market_pricing import (
    build_market_advice,
    build_market_estimate,
    calculate_instant_sale_price,
    find_matching_buy_orders,
    normalize_market_key,
    validate_listing_price,
)
from ..services.storage import read_json, write_json

logger = logging.getLogger("vinyl_check")

router = APIRouter()

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, "data")
USERS_PATH = os.path.join(DATA_DIR, "users.json")
LISTINGS_PATH = os.path.join(DATA_DIR, "listings.json")
CHATS_PATH = os.path.join(DATA_DIR, "chats.json")
REVIEWS_PATH = os.path.join(DATA_DIR, "reviews.json")
COMMENTS_PATH = os.path.join(DATA_DIR, "comments.json")
OFFERS_PATH = os.path.join(DATA_DIR, "offers.json")
BUY_ORDERS_PATH = os.path.join(DATA_DIR, "buy_orders.json")
MARKET_PRICE_HISTORY_PATH = os.path.join(DATA_DIR, "market_price_history.json")
TRANSACTIONS_PATH = os.path.join(DATA_DIR, "transactions.json")
WISHLIST_PATH = os.path.join(DATA_DIR, "wishlist.json")
COLLECTIONS_PATH = os.path.join(DATA_DIR, "collections.json")
NOTIFICATIONS_PATH = os.path.join(DATA_DIR, "notifications.json")
NOTIFICATION_READS_PATH = os.path.join(DATA_DIR, "notification_reads.json")
NOTIFICATION_DISMISSES_PATH = os.path.join(DATA_DIR, "notification_dismisses.json")
SESSIONS_PATH = os.path.join(DATA_DIR, "sessions.json")
FIND_ID_TOKENS_PATH = os.path.join(DATA_DIR, "find_id_tokens.json")
RESET_TOKENS_PATH = os.path.join(DATA_DIR, "password_reset_tokens.json")
EMAIL_VERIFICATION_PATH = os.path.join(DATA_DIR, "email_verification_tokens.json")
ENV_PATH = os.path.join(BACKEND_DIR, ".env")


def load_local_env() -> None:
    if not os.path.exists(ENV_PATH):
        return
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'").strip()
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        return


load_local_env()


TRUE_ENV_VALUES = {"1", "true", "yes", "on"}


def env_flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in TRUE_ENV_VALUES


def allow_dev_auth_code(name: str) -> bool:
    return env_flag("ALLOW_DEV_AUTH_CODES") or env_flag(name)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def stable_id(prefix: str, value: str) -> str:
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def normalize_username(username: str) -> str:
    return username.strip().lower()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def decode_jwt_payload(token: str) -> dict[str, Any]:
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return {}
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        return json.loads(base64.urlsafe_b64decode(payload.encode("utf-8")).decode("utf-8"))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def hash_password(password: str, salt: str | None = None) -> str:
    password_salt = salt or base64.urlsafe_b64encode(os.urandom(16)).decode("utf-8")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt.encode("utf-8"), 100_000)
    return f"pbkdf2_sha256${password_salt}${base64.urlsafe_b64encode(digest).decode('utf-8')}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algorithm, salt, expected = password_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    return hmac.compare_digest(hash_password(password, salt), f"{algorithm}${salt}${expected}")


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key not in {"passwordHash"}}


def find_user_by_email(users: dict[str, Any], email: str) -> dict[str, Any] | None:
    target = normalize_email(email)
    return next((user for user in users.values() if normalize_email(str(user.get("email", ""))) == target), None)


def find_user_by_username(users: dict[str, Any], username: str) -> dict[str, Any] | None:
    target = normalize_username(username)
    return next((user for user in users.values() if normalize_username(str(user.get("username", ""))) == target), None)


def find_user_for_login(users: dict[str, Any], login_id: str) -> dict[str, Any] | None:
    if "@" in login_id:
        return find_user_by_email(users, login_id)
    return find_user_by_username(users, login_id)


def risk_label(value: float, medium: float, high: float) -> str:
    if value >= high:
        return "high"
    if value >= medium:
        return "medium"
    return "low"


def grade_from_score(score: int) -> str:
    if score >= 96:
        return "M"
    if score >= 88:
        return "NM"
    if score >= 80:
        return "EX"
    if score >= 70:
        return "VG+"
    if score >= 58:
        return "VG"
    if score >= 45:
        return "G"
    return "P"


MOCK_LISTINGS: list[dict[str, Any]] = [
    {
        "id": "listing-abbey-road-anniversary",
        "title": "Abbey Road (Anniversary Edition)",
        "artist": "The Beatles",
        "year": 2019,
        "genre": "록",
        "catalog_number": "0602577915123",
        "release_label": "Apple Records / Universal Music",
        "release_country": "EU",
        "pressing_condition": "2019 Anniversary Edition · New Mix by Giles Martin and Sam Okell",
        "price": 72000,
        "min_price": 62000,
        "max_price": 89000,
        "base_price": 74000,
        "recommended_price": 76000,
        "instant_sale_price": 69000,
        "seller_price": 72000,
        "audio_grade": "NM",
        "audio_score": 91,
        "jacket_grade": "NM",
        "jacket_score": 93,
        "is_rare": False,
        "is_first_press": False,
        "images": ["/images/the-beatles-abbey-road-anniversary.jpg"],
        "audio_samples": {
            "good": {
                "name": "Abbey Road Medley 안정 구간",
                "durationSeconds": 20,
                "dataUrl": "/audio-samples/abbey-road-medley-vinyl.mp3",
                "startSeconds": 35,
                "endSeconds": 55,
                "recordedAt": "2026-07-26T14:25:36.000+09:00",
            },
            "noisy": {
                "name": "Abbey Road Medley 도입 확인 구간",
                "durationSeconds": 15,
                "dataUrl": "/audio-samples/abbey-road-medley-vinyl.mp3",
                "startSeconds": 5,
                "endSeconds": 20,
                "recordedAt": "2026-07-26T14:25:36.000+09:00",
            },
        },
        "analysis_report": {
            "pressing": "2019 Anniversary Edition · 50주년 리믹스",
            "recordSurface": {"surfaceScore": 92, "surfaceGrade": "NM", "scratchCount": 0},
            "jacket": {"jacketGrade": "NM", "jacketScore": 93},
            "audio": {
                "summary": "음질 NM 등급, 91점입니다.",
                "playbackRisk": None,
            },
        },
        "description": "사용자가 제공한 실물 커버 이미지와 Abbey Road Medley 바이닐 MP3 샘플을 연결한 더미 판매글입니다.\n수축 비닐이 남아 있는 Anniversary Edition으로, 전면 스티커의 Giles Martin / Sam Okell New Mix 정보를 기준으로 등록했습니다.",
        "tags": ["The Beatles", "Abbey Road", "Anniversary Edition", "Giles Martin", "Sam Okell", "록", "LP"],
        "seller_id": "seller-apple-studio",
        "seller_name": "apple_studio",
        "seller_rating": 4.9,
        "seller_transaction_count": 38,
        "location": "서울 마포구",
        "views": 64,
        "view_count": 64,
        "favorite_count": 18,
        "buy_order_count": 3,
        "wishlist_count": 11,
        "market_key": "catalog:0602577915123|pressing:2019 anniversary edition new mix by giles martin and sam okell",
        "created_at": "2026-07-26T14:25:36.000+09:00",
        "status": "published",
    },
]

def user_payload(user_id: str, username: str, email: str, genres: list[str] | None = None) -> dict[str, Any]:
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "rating": 0.0,
        "transactionCount": 0,
        "genres": genres or [],
        "emailVerified": True,
    }


def save_user(user: dict[str, Any]) -> None:
    users = read_json(USERS_PATH, {})
    users[user["id"]] = {**users.get(user["id"], {}), **user}
    write_json(USERS_PATH, users)


def mask_username(username: str) -> str:
    if len(username) <= 2:
        return username[0] + "*" if username else ""
    return username[:2] + "*" * max(1, len(username) - 2)


def verification_code() -> str:
    return f"{int.from_bytes(os.urandom(4), 'big') % 1_000_000:06d}"


def prune_expired_tokens(tokens: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    next_tokens: dict[str, Any] = {}
    for key, token in tokens.items():
        try:
            expires_at = datetime.fromisoformat(str(token.get("expiresAt", "")))
        except (ValueError, AttributeError):
            continue
        if expires_at > now:
            next_tokens[key] = token
    return next_tokens


def prune_sessions(sessions: dict[str, Any]) -> dict[str, Any]:
    return prune_expired_tokens(sessions)


def create_session(user_id: str, remember_me: bool = True) -> str:
    sessions = prune_sessions(read_json(SESSIONS_PATH, {}))
    token = f"session-{uuid4().hex}"
    lifetime = timedelta(days=30 if remember_me else 1)
    sessions[token] = {
        "userId": user_id,
        "createdAt": now_iso(),
        "expiresAt": (datetime.now(timezone.utc) + lifetime).isoformat(),
    }
    write_json(SESSIONS_PATH, sessions)
    return token


def token_from_authorization(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    return token.strip() if scheme.lower() == "bearer" else ""


def require_user_id(authorization: Annotated[str | None, Header()] = None) -> str:
    token = token_from_authorization(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="로그인이 필요합니다.")
    sessions = prune_sessions(read_json(SESSIONS_PATH, {}))
    session = sessions.get(token)
    if not session:
        write_json(SESSIONS_PATH, sessions)
        raise HTTPException(status_code=401, detail="로그인 세션이 만료되었습니다. 다시 로그인해 주세요.")
    return str(session.get("userId") or "")


def revoke_session(authorization: str | None) -> None:
    token = token_from_authorization(authorization)
    if not token:
        return
    sessions = prune_sessions(read_json(SESSIONS_PATH, {}))
    if sessions.pop(token, None) is not None:
        write_json(SESSIONS_PATH, sessions)


def optional_user_id(authorization: str | None) -> str:
    token = token_from_authorization(authorization)
    if not token:
        return ""
    session = prune_sessions(read_json(SESSIONS_PATH, {})).get(token)
    return str((session or {}).get("userId") or "")


def send_mail(to_email: str, subject: str, body: str) -> bool:
    host = os.getenv("SMTP_HOST", "").strip()
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    sender = os.getenv("SMTP_FROM", user).strip()
    if not host or not sender:
        logger.info("SMTP is not configured; skipping mail to %s", to_email)
        return False

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            if user:
                smtp.login(user, password)
            smtp.send_message(message)
            return True
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("mail send failed: %s", exc)
        return False


def review_summary_for_user(user_id: str) -> dict[str, Any]:
    reviews = read_json(REVIEWS_PATH, [])
    user_reviews = [review for review in reviews if str(review.get("revieweeId")) == user_id]
    count = len(user_reviews)
    average = round(sum(float(review.get("rating", 0)) for review in user_reviews) / count, 1) if count else 0.0
    return {"average": average, "count": count}


def update_user_review_stats(user_id: str) -> dict[str, Any] | None:
    users = read_json(USERS_PATH, {})
    user = users.get(user_id)
    if not user:
        return None
    summary = review_summary_for_user(user_id)
    user["rating"] = summary["average"]
    user["transactionCount"] = summary["count"]
    user["updatedAt"] = now_iso()
    users[user_id] = user
    write_json(USERS_PATH, users)
    return public_user(user)


def kakao_rest_api_key() -> str:
    return os.getenv("KAKAO_REST_API_KEY", "").strip()


def kakao_place_candidate(document: dict[str, Any], fallback_keyword: str) -> dict[str, Any]:
    road_address = str(document.get("road_address_name") or "")
    jibun_address = str(document.get("address_name") or "")
    place_name = str(document.get("place_name") or "")
    category = str(document.get("category_name") or "")
    return {
        "id": str(document.get("id") or stable_id("kakao-place", json.dumps(document, ensure_ascii=False, sort_keys=True))),
        "placeName": place_name or road_address or jibun_address or fallback_keyword,
        "roadAddress": road_address,
        "jibunAddress": jibun_address,
        "address": road_address or jibun_address or place_name or fallback_keyword,
        "category": category,
        "latitude": str(document.get("y") or ""),
        "longitude": str(document.get("x") or ""),
    }


async def kakao_local_search(endpoint: str, keyword: str, count: int) -> list[dict[str, Any]]:
    key = kakao_rest_api_key()
    if not key:
        raise HTTPException(status_code=503, detail="KAKAO_REST_API_KEY is not configured.")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"https://dapi.kakao.com/v2/local/search/{endpoint}.json",
                headers={"Authorization": f"KakaoAK {key}"},
                params={"query": keyword, "size": max(1, min(count, 15))},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("kakao local search failed: %s", exc.response.text[:300])
        raise HTTPException(status_code=502, detail="Kakao local search failed.") from exc
    except httpx.HTTPError as exc:
        logger.warning("kakao local search request error: %s", exc)
        raise HTTPException(status_code=502, detail="Kakao local search request failed.") from exc
    return [kakao_place_candidate(item, keyword) for item in payload.get("documents", [])]


async def kakao_coord_to_address(lat: float, lng: float) -> dict[str, Any] | None:
    key = kakao_rest_api_key()
    if not key:
        raise HTTPException(status_code=503, detail="KAKAO_REST_API_KEY is not configured.")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                "https://dapi.kakao.com/v2/local/geo/coord2address.json",
                headers={"Authorization": f"KakaoAK {key}"},
                params={"x": lng, "y": lat},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        logger.warning("kakao coord2address failed: %s", exc.response.text[:300])
        raise HTTPException(status_code=502, detail="Kakao coord2address failed.") from exc
    except httpx.HTTPError as exc:
        logger.warning("kakao coord2address request error: %s", exc)
        raise HTTPException(status_code=502, detail="Kakao coord2address request failed.") from exc

    document = (payload.get("documents") or [None])[0]
    if not document:
        return None
    road = document.get("road_address") or {}
    address = document.get("address") or {}
    road_address = str(road.get("address_name") or "")
    jibun_address = str(address.get("address_name") or "")
    region = " ".join(
        str(address.get(key) or "")
        for key in ("region_1depth_name", "region_2depth_name", "region_3depth_name")
    ).strip()
    return {
        "placeName": region or road_address or jibun_address or "현재 위치",
        "roadAddress": road_address,
        "jibunAddress": jibun_address,
        "address": road_address or jibun_address or region,
        "latitude": f"{lat:.8f}",
        "longitude": f"{lng:.8f}",
    }


@router.get("/address/api-key")
async def address_api_key_status() -> dict[str, Any]:
    return {"hasKey": bool(kakao_rest_api_key()), "provider": "kakao"}


@router.get("/address/search")
async def search_address(keyword: str, count: int = 5) -> dict[str, Any]:
    query = keyword.strip()
    if len(query) < 2:
        return {"source": "kakao", "candidates": [], "message": "검색어를 2글자 이상 입력해 주세요."}

    candidates = await kakao_local_search("keyword", query, count)
    if not candidates:
        candidates = await kakao_local_search("address", query, count)
    return {
        "source": "kakao",
        "candidates": candidates[: max(1, min(count, 15))],
        "message": "" if candidates else "일치하는 장소가 없습니다.",
    }


@router.get("/address/reverse")
async def reverse_address(lat: float, lng: float) -> dict[str, Any]:
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    candidate = await kakao_coord_to_address(lat, lng)
    return {
        "source": "kakao",
        "candidate": candidate,
        "message": "" if candidate else "해당 좌표의 주소를 찾지 못했습니다.",
    }


async def google_profile_from_credential(credential: str) -> dict[str, Any]:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            response = await client.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": credential})
            response.raise_for_status()
            profile = response.json()
    except httpx.HTTPError as exc:
        if client_id:
            raise HTTPException(status_code=401, detail="Google 인증 토큰을 검증하지 못했습니다.") from exc
        profile = decode_jwt_payload(credential)

    email = normalize_email(str(profile.get("email", "")))
    if not email:
        raise HTTPException(status_code=401, detail="Google 계정 이메일을 확인하지 못했습니다.")
    if str(profile.get("email_verified", "true")).lower() not in {"true", "1"}:
        raise HTTPException(status_code=401, detail="Google 이메일 인증이 완료되지 않은 계정입니다.")
    if client_id and profile.get("aud") and str(profile["aud"]) != client_id:
        raise HTTPException(status_code=401, detail="Google 로그인 설정이 현재 앱과 일치하지 않습니다.")

    return {
        "email": email,
        "name": str(profile.get("name") or profile.get("given_name") or email.split("@")[0]),
        "googleSub": str(profile.get("sub") or stable_id("google-sub", email)),
        "picture": str(profile.get("picture") or ""),
    }


def clean_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    tags: list[str] = []
    for tag in value:
        text = str(tag).strip()
        if text:
            tags.append(text)
    return tags[:12]


def read_list(path: str) -> list[dict[str, Any]]:
    data = read_json(path, [])
    return data if isinstance(data, list) else []


INLINE_MEDIA_LIMIT = 120_000


def compact_inline_media(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    if value.startswith("data:") and len(value) > INLINE_MEDIA_LIMIT:
        return ""
    return value


def compact_listing_media_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    compacted = [compact_inline_media(item) for item in value]
    return [item for item in compacted if item][:5]


def compact_listing_audio_samples(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    compacted: dict[str, Any] = {}
    for key, sample in value.items():
        if not isinstance(sample, dict):
            continue
        next_sample = dict(sample)
        if "dataUrl" in next_sample:
            next_sample["dataUrl"] = compact_inline_media(next_sample.get("dataUrl"))
        compacted[str(key)] = {sample_key: sample_value for sample_key, sample_value in next_sample.items() if sample_value != ""}
    return compacted


def compact_listing_analysis_report(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    compacted = dict(value)
    for media_key in ("coverImageDataUrl", "recordImageDataUrl", "recordVideoDataUrl", "audioSamples"):
        compacted.pop(media_key, None)
    return compacted


def compact_listing_for_storage(listing: dict[str, Any]) -> dict[str, Any]:
    item = dict(listing)
    item["images"] = compact_listing_media_list(item.get("images"))
    for snake_key, camel_key in (
        ("cover_image_data_url", "coverImageDataUrl"),
        ("record_image_data_url", "recordImageDataUrl"),
        ("record_video_data_url", "recordVideoDataUrl"),
    ):
        item[snake_key] = compact_inline_media(item.get(snake_key) or item.get(camel_key))
        item.pop(camel_key, None)
    item["audio_samples"] = compact_listing_audio_samples(item.get("audio_samples") or item.get("audioSamples"))
    item.pop("audioSamples", None)
    item["analysis_report"] = compact_listing_analysis_report(item.get("analysis_report") or item.get("analysisReport"))
    item.pop("analysisReport", None)
    return item


def compact_listing_in_place(listing: dict[str, Any]) -> dict[str, Any]:
    compacted = compact_listing_for_storage(listing)
    listing.clear()
    listing.update(compacted)
    return listing


def compact_listing_storage_list(listings: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    compacted = [compact_listing_for_storage(item) for item in listings]
    return compacted, compacted != listings


def write_listings(listings: list[dict[str, Any]]) -> None:
    compacted, _ = compact_listing_storage_list(listings)
    write_json(LISTINGS_PATH, compacted)


def compact_persisted_listings() -> None:
    listings = read_list(LISTINGS_PATH)
    if not listings:
        return
    compacted, changed = compact_listing_storage_list(listings)
    if changed:
        write_json(LISTINGS_PATH, compacted)
        logger.info("Compacted stored listings media payloads: %s listings", len(compacted))


def market_validation_detail(message: str, estimate: dict[str, Any]) -> dict[str, Any]:
    return {
        "message": message,
        "priceEstimate": estimate,
        "base_price": estimate.get("basePrice"),
        "min_price": estimate.get("minPrice"),
        "max_price": estimate.get("maxPrice"),
        "recommended_price": estimate.get("recommendedPrice"),
    }


def apply_market_snapshot(listing: dict[str, Any], estimate: dict[str, Any]) -> dict[str, Any]:
    listing["market_key"] = estimate.get("marketKey") or estimate.get("market_key") or normalize_market_key(listing)
    listing["base_price"] = int(estimate.get("basePrice") or estimate.get("base_price") or 0)
    listing["min_price"] = int(estimate.get("minPrice") or estimate.get("min_price") or 0)
    listing["max_price"] = int(estimate.get("maxPrice") or estimate.get("max_price") or 0)
    listing["recommended_price"] = int(estimate.get("recommendedPrice") or estimate.get("recommended_price") or 0)
    listing["instant_sale_price"] = int(estimate.get("instantSalePrice") or estimate.get("instant_sale_price") or 0)
    listing["seller_price"] = int(listing.get("price") or estimate.get("sellerPrice") or 0)
    listing["view_count"] = int(listing.get("view_count") or listing.get("viewCount") or listing.get("views") or 0)
    listing["favorite_count"] = int(listing.get("favorite_count") or listing.get("favoriteCount") or 0)
    listing["buy_order_count"] = int((estimate.get("metrics") or {}).get("buyOrderCount") or 0)
    listing["wishlist_count"] = wishlist_count_for_listing(listing)
    return listing


def recalculate_listing_market(listing: dict[str, Any], listings: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    all_listings = listings if listings is not None else read_list(LISTINGS_PATH)
    buy_orders = read_list(BUY_ORDERS_PATH)
    history = read_list(MARKET_PRICE_HISTORY_PATH)
    estimate = build_market_estimate(listing, all_listings, buy_orders, history)
    return apply_market_snapshot(listing, estimate)


def wishlist_count_for_listing(listing: dict[str, Any]) -> int:
    return sum(
        1
        for item in read_list(WISHLIST_PATH)
        if wishlist_matches_listing(item, listing)
    )


def enrich_estimate_with_wishlist(estimate: dict[str, Any], listing: dict[str, Any]) -> dict[str, Any]:
    wishlist_count = wishlist_count_for_listing(listing)
    metrics = estimate.setdefault("metrics", {})
    metrics["wishlistCount"] = wishlist_count
    estimate["wishlistCount"] = wishlist_count
    estimate["wishlist_count"] = wishlist_count
    return estimate


def normalize_lookup_text(value: Any) -> str:
    return " ".join(
        "".join(char.lower() if char.isalnum() or char in {"+", "-", " "} else " " for char in str(value or "")).split()
    )


def wishlist_matches_listing(item: dict[str, Any], listing: dict[str, Any]) -> bool:
    if str(item.get("status") or "active") != "active":
        return False
    if str(listing.get("status") or "published").lower() not in {"published", "selling"}:
        return False

    wishlist_release_id = int(item.get("discogs_release_id") or item.get("discogsReleaseId") or 0)
    listing_release_id = int(listing.get("discogs_release_id") or listing.get("discogsReleaseId") or 0)
    if wishlist_release_id and listing_release_id:
        return wishlist_release_id == listing_release_id

    wishlist_catalog = normalize_lookup_text(item.get("catalog_number") or item.get("catalogNumber"))
    listing_catalog = normalize_lookup_text(listing.get("catalog_number") or listing.get("catalogNumber"))
    if wishlist_catalog:
        if not listing_catalog or wishlist_catalog != listing_catalog:
            return False
        if wishlist_release_id and not listing_release_id:
            wishlist_year = str(item.get("year") or "").strip()
            listing_year = str(listing.get("year") or "").strip()
            wishlist_country = normalize_lookup_text(item.get("release_country") or item.get("releaseCountry"))
            listing_country = normalize_lookup_text(listing.get("release_country") or listing.get("releaseCountry"))
            if wishlist_year and wishlist_year != listing_year:
                return False
            if wishlist_country and wishlist_country != listing_country:
                return False
        return True

    wishlist_title = normalize_lookup_text(item.get("title"))
    if not wishlist_title:
        listing_key = str(listing.get("market_key") or listing.get("marketKey") or normalize_market_key(listing))
        wishlist_key = str(item.get("market_key") or item.get("marketKey") or "")
        return bool(wishlist_key and wishlist_key == listing_key)
    listing_title = normalize_lookup_text(listing.get("title"))
    wishlist_artist = normalize_lookup_text(item.get("artist"))
    listing_artist = normalize_lookup_text(listing.get("artist"))
    wishlist_year = str(item.get("year") or "").strip()
    listing_year = str(listing.get("year") or "").strip()
    year_matches = not wishlist_year or wishlist_year == listing_year
    return listing_title == wishlist_title and (not wishlist_artist or listing_artist == wishlist_artist) and year_matches


def listing_identity_signature(listing: dict[str, Any]) -> tuple[str, ...]:
    return (
        str(listing.get("discogs_release_id") or listing.get("discogsReleaseId") or ""),
        normalize_lookup_text(listing.get("catalog_number") or listing.get("catalogNumber")),
        normalize_lookup_text(listing.get("title")),
        normalize_lookup_text(listing.get("artist")),
        str(listing.get("year") or ""),
        normalize_lookup_text(listing.get("release_country") or listing.get("releaseCountry")),
        str(listing.get("status") or "published").lower(),
    )


def wishlist_notification_for_listing(listing: dict[str, Any]) -> list[dict[str, Any]]:
    market_key = str(listing.get("market_key") or listing.get("marketKey") or normalize_market_key(listing))
    listing_id = str(listing.get("id") or "")
    seller_id = str(listing.get("seller_id") or listing.get("user_id") or "")
    if not listing_id or not market_key:
        return []
    wishlist_items = [
        item
        for item in read_list(WISHLIST_PATH)
        if wishlist_matches_listing(item, listing)
        and str(item.get("user_id") or item.get("userId") or "") != seller_id
    ]
    if not wishlist_items:
        return []
    notifications = read_list(NOTIFICATIONS_PATH)
    existing_ids = {str(item.get("id")) for item in notifications}
    created: list[dict[str, Any]] = []
    title = str(listing.get("title") or "위시리스트 LP")
    artist = str(listing.get("artist") or "")
    price = int(listing.get("price") or 0)
    for wish in wishlist_items:
        user_id = str(wish.get("user_id") or wish.get("userId") or "")
        wishlist_id = str(wish.get("id") or "")
        if not user_id:
            continue
        notification_id = stable_id("notif", f"wishlist:{user_id}:{wishlist_id}:{listing_id}")
        if notification_id in existing_ids:
            continue
        notification = {
            "id": notification_id,
            "userId": user_id,
            "type": "listing",
            "title": "위시리스트 앨범 입고",
            "message": f"{title}{f' - {artist}' if artist else ''} 판매글이 {price:,}원에 새로 올라왔습니다.",
            "timestamp": now_iso(),
            "isRead": False,
            "link": f"/app/album/{listing_id}",
            "listingId": listing_id,
            "wishlistId": wishlist_id,
            "marketKey": market_key,
        }
        notifications.insert(0, notification)
        existing_ids.add(notification_id)
        created.append(notification)
    if created:
        write_json(NOTIFICATIONS_PATH, notifications[:500])
    return created


def listing_to_album(item: dict[str, Any]) -> dict[str, Any]:
    price = int(item.get("price") or 0)
    min_price = int(item.get("min_price") or item.get("minPrice") or price * 0.9)
    max_price = int(item.get("max_price") or item.get("maxPrice") or price * 1.12)
    base_price = int(item.get("base_price") or item.get("basePrice") or 0)
    recommended_price = int(item.get("recommended_price") or item.get("recommendedPrice") or 0)
    instant_sale_price = int(item.get("instant_sale_price") or item.get("instantSalePrice") or 0)
    seller_price = int(item.get("seller_price") or item.get("sellerPrice") or price)
    audio_grade = item.get("audio_grade") or item.get("audioGrade") or ""
    audio_score = int(item.get("audio_score") or item.get("audioScore") or 0)
    favorite_count = int(item.get("favorite_count") or item.get("favoriteCount") or 0)
    view_count = int(item.get("view_count") or item.get("viewCount") or item.get("views") or 0)
    buy_order_count = int(item.get("buy_order_count") or item.get("buyOrderCount") or 0)
    market_key = item.get("market_key") or item.get("marketKey") or ""
    wishlist_count = wishlist_count_for_listing({**item, "market_key": market_key}) if market_key or item.get("title") else 0
    seller_id = item.get("seller_id") or item.get("user_id") or "seller1"
    users = read_json(USERS_PATH, {})
    seller = users.get(str(seller_id), {}) if isinstance(users, dict) else {}
    seller_name = (
        item.get("seller_name")
        or item.get("sellerName")
        or seller.get("username")
        or seller.get("name")
        or str(seller_id)
        or "판매자"
    )
    analysis_report = item.get("analysis_report") if isinstance(item.get("analysis_report"), dict) else {}
    audio_samples = item.get("audio_samples") or item.get("audioSamples") or analysis_report.get("audioSamples") or {}
    cover_image = item.get("cover_image_data_url") or item.get("coverImageDataUrl") or analysis_report.get("coverImageDataUrl")
    record_image = item.get("record_image_data_url") or item.get("recordImageDataUrl") or analysis_report.get("recordImageDataUrl")
    record_video = item.get("record_video_data_url") or item.get("recordVideoDataUrl") or analysis_report.get("recordVideoDataUrl")
    tags = clean_tags(item.get("tags"))
    return {
        "id": str(item.get("id") or stable_id("listing", json.dumps(item, ensure_ascii=False))),
        "title": item.get("title") or "Untitled",
        "artist": item.get("artist") or "Unknown artist",
        "year": int(item.get("year") or 0),
        "genre": item.get("genre") or "기타",
        "catalogNumber": item.get("catalog_number") or item.get("catalogNumber") or "",
        "discogsReleaseId": int(item.get("discogs_release_id") or item.get("discogsReleaseId") or 0) or None,
        "discogsCoverImageUrl": item.get("discogs_cover_image_url") or item.get("discogsCoverImageUrl") or "",
        "releaseLabel": item.get("release_label") or item.get("releaseLabel") or "",
        "releaseCountry": item.get("release_country") or item.get("releaseCountry") or "",
        "pressingCondition": item.get("pressing_condition") or item.get("pressingCondition") or analysis_report.get("pressing"),
        "price": price,
        "priceRange": {"min": min_price, "max": max_price},
        "audioGrade": audio_grade or "분석 불가",
        "audioScore": audio_score,
        "audioSamples": audio_samples if isinstance(audio_samples, dict) else {},
        "jacketGrade": item.get("jacket_grade") or item.get("jacketGrade") or "VG",
        "jacketScore": int(item.get("jacket_score") or item.get("jacketScore") or 0),
        "isRare": False,
        "isFirstPress": False,
        "tags": tags,
        "images": item.get("images") if isinstance(item.get("images"), list) else [],
        "coverImageDataUrl": cover_image or "",
        "recordImageDataUrl": record_image or "",
        "recordVideoDataUrl": record_video or "",
        "analysisReport": analysis_report,
        "description": item.get("description") or "",
        "seller": {
            "id": seller_id,
            "name": seller_name,
            "rating": float(item.get("seller_rating") or item.get("sellerRating") or seller.get("rating", 0) or 0),
            "transactionCount": int(item.get("seller_transaction_count") or item.get("sellerTransactionCount") or seller.get("transactionCount", 0) or 0),
        },
        "location": item.get("location") or "서울",
        "views": view_count,
        "viewCount": view_count,
        "favoriteCount": favorite_count,
        "buyOrderCount": buy_order_count,
        "wishlistCount": wishlist_count,
        "marketKey": market_key,
        "basePrice": base_price,
        "minPrice": min_price,
        "maxPrice": max_price,
        "recommendedPrice": recommended_price,
        "instantSalePrice": instant_sale_price,
        "sellerPrice": seller_price,
        "market": {
            "marketKey": market_key,
            "basePrice": base_price,
            "minPrice": min_price,
            "maxPrice": max_price,
            "recommendedPrice": recommended_price,
            "instantSalePrice": instant_sale_price,
            "instantSaleAvailable": instant_sale_price > 0,
            "sellerPrice": seller_price,
            "isValidPrice": min_price <= price <= max_price if price > 0 else True,
            "priceStatus": "below_range" if price < min_price else "above_range" if price > max_price else "within_range",
            "metrics": {
                "listingCount": 1,
                "buyOrderCount": buy_order_count,
                "favoriteCount": favorite_count,
                "wishlistCount": wishlist_count,
                "viewCount": view_count,
                "recentTradeCount": 0,
            },
        },
        "createdAt": item.get("created_at") or item.get("createdAt") or now_iso(),
        "status": item.get("status") or "published",
    }


def compact_listing_album(album: dict[str, Any]) -> dict[str, Any]:
    item = dict(album)

    def keep_small_inline_media(value: Any) -> str:
        if not isinstance(value, str):
            return ""
        if value.startswith("data:") and len(value) > 120_000:
            return ""
        return value

    item["images"] = [
        compact_image
        for image in item.get("images", [])
        if (compact_image := keep_small_inline_media(image))
    ][:1]
    item["coverImageDataUrl"] = keep_small_inline_media(item.get("coverImageDataUrl"))
    item["recordImageDataUrl"] = ""
    item["recordVideoDataUrl"] = ""
    item["analysisReport"] = {}

    audio_samples = item.get("audioSamples")
    if isinstance(audio_samples, dict):
        compact_samples: dict[str, Any] = {}
        for key, sample in audio_samples.items():
            if not isinstance(sample, dict):
                continue
            compact_sample: dict[str, Any] = {}
            for sample_key, value in sample.items():
                if sample_key == "dataUrl" and isinstance(value, str) and value.startswith("data:"):
                    continue
                compact_sample[sample_key] = value
            compact_samples[key] = compact_sample
        item["audioSamples"] = compact_samples
    else:
        item["audioSamples"] = {}

    return item


UNAVAILABLE_LISTING_STATUSES = {"hidden", "reserved", "sold", "deleted"}


def is_market_visible_listing(item: dict[str, Any]) -> bool:
    return str(item.get("status") or "published").lower() not in UNAVAILABLE_LISTING_STATUSES


def all_albums() -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for item in MOCK_LISTINGS:
        if is_market_visible_listing(item):
            merged[str(item.get("id") or stable_id("listing", json.dumps(item, ensure_ascii=False)))] = listing_to_album(item)
    for item in read_json(LISTINGS_PATH, []):
        if is_market_visible_listing(item):
            album = listing_to_album(item)
            merged[str(album.get("id"))] = album
    return list(merged.values())


def find_album(listing_id: str) -> dict[str, Any] | None:
    return next((album for album in all_albums() if str(album.get("id")) == str(listing_id)), None)


@router.get("/health")
async def health():
    return {"ok": True, "service": "vinyl-check-api"}


@router.post("/auth/login")
async def login(payload: AuthLogin):
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(status_code=400, detail="아이디와 비밀번호를 입력해 주세요.")
    users = read_json(USERS_PATH, {})
    user = find_user_for_login(users, username)
    if user and not user.get("passwordHash"):
        raise HTTPException(status_code=401, detail="이전 임시 계정입니다. 같은 아이디와 이메일로 회원가입을 다시 완료해 비밀번호를 등록해 주세요.")
    if not user or not verify_password(payload.password, user.get("passwordHash")):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")
    return {"token": create_session(str(user["id"]), payload.rememberMe), "user": public_user(user)}


@router.post("/auth/check")
async def check_auth_availability(payload: AuthCheck):
    users = read_json(USERS_PATH, {})
    username_taken = bool(payload.username and find_user_by_username(users, payload.username))
    email_taken = bool(payload.email and find_user_by_email(users, payload.email))
    return {"usernameTaken": username_taken, "emailTaken": email_taken, "available": not username_taken and not email_taken}


@router.post("/auth/email-verification/request")
async def request_email_verification(payload: EmailVerificationRequest):
    email = normalize_email(payload.email)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="올바른 이메일을 입력해 주세요.")
    users = read_json(USERS_PATH, {})
    if find_user_by_email(users, email):
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")

    code = verification_code()
    token_key = f"email:{email}:{code}"
    tokens = prune_expired_tokens(read_json(EMAIL_VERIFICATION_PATH, {}))
    token = {
        "type": "email-verification",
        "email": email,
        "code": code,
        "verified": False,
        "createdAt": now_iso(),
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }
    sent = send_mail(
        email,
        "[Vinyl-Check] 이메일 인증번호",
        f"Vinyl-Check 회원가입 이메일 인증번호입니다.\n\n{code}\n\n이 코드는 10분 후 만료됩니다.",
    )
    response = {"message": "인증번호를 이메일로 발송했습니다.", "sent": sent}
    if not sent:
        if not allow_dev_auth_code("ALLOW_DEV_EMAIL_VERIFICATION_CODE"):
            raise HTTPException(status_code=503, detail="메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요.")
        response["message"] = "메일 발송 설정이 없어 개발용 인증번호를 표시합니다."
        response["devVerificationCode"] = code
    tokens[token_key] = token
    write_json(EMAIL_VERIFICATION_PATH, tokens)
    return response


@router.post("/auth/email-verification/confirm")
async def confirm_email_verification(payload: EmailVerificationConfirm):
    email = normalize_email(payload.email)
    code = payload.code.strip()
    token_key = f"email:{email}:{code}"
    tokens = prune_expired_tokens(read_json(EMAIL_VERIFICATION_PATH, {}))
    token = tokens.get(token_key)
    if not token:
        write_json(EMAIL_VERIFICATION_PATH, tokens)
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않거나 만료되었습니다.")
    if str(token.get("email")) != email:
        raise HTTPException(status_code=400, detail="이메일과 인증번호가 일치하지 않습니다.")

    verification_token = f"email-verified-{uuid4().hex}"
    token["verified"] = True
    token["verificationToken"] = verification_token
    token["verifiedAt"] = now_iso()
    token["expiresAt"] = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    tokens[token_key] = token
    write_json(EMAIL_VERIFICATION_PATH, tokens)
    return {"message": "이메일 인증이 완료되었습니다.", "verificationToken": verification_token}


@router.post("/auth/signup")
async def signup(payload: AuthSignup):
    username = payload.username.strip()
    email = normalize_email(payload.email)
    if not username or not email:
        raise HTTPException(status_code=400, detail="아이디와 이메일을 입력해 주세요.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    users = read_json(USERS_PATH, {})
    username_user = find_user_by_username(users, username)
    email_user = find_user_by_email(users, email)
    existing = username_user or email_user
    if username_user and normalize_email(str(username_user.get("email", ""))) != email:
        raise HTTPException(status_code=409, detail="이미 사용 중인 아이디입니다.")
    if email_user and normalize_username(str(email_user.get("username", ""))) != normalize_username(username):
        raise HTTPException(status_code=409, detail="이미 사용 중인 이메일입니다.")
    if existing and existing.get("passwordHash"):
        raise HTTPException(status_code=409, detail="이미 가입된 계정입니다. 로그인해 주세요.")
    verification_token = (payload.emailVerificationToken or "").strip()
    tokens = prune_expired_tokens(read_json(EMAIL_VERIFICATION_PATH, {}))
    verified_key = next(
        (
            key for key, token in tokens.items()
            if token.get("verified")
            and str(token.get("email")) == email
            and str(token.get("verificationToken")) == verification_token
        ),
        "",
    )
    if not verified_key:
        write_json(EMAIL_VERIFICATION_PATH, tokens)
        raise HTTPException(status_code=400, detail="이메일 인증을 먼저 완료해 주세요.")
    user = user_payload(existing.get("id") if existing else stable_id("user", email), username, email, payload.genres[:5])
    user["passwordHash"] = hash_password(payload.password)
    user["authProvider"] = "password"
    user["emailVerified"] = True
    user["createdAt"] = existing.get("createdAt") if existing else now_iso()
    user["updatedAt"] = now_iso()
    save_user(user)
    tokens.pop(verified_key, None)
    write_json(EMAIL_VERIFICATION_PATH, tokens)
    return {"token": create_session(str(user["id"]), True), "user": public_user(user)}


@router.post("/auth/google")
async def google_login(payload: GoogleLogin):
    if payload.credential:
        profile = await google_profile_from_credential(payload.credential)
        email = profile["email"]
        name = profile["name"]
        google_sub = profile["googleSub"]
        picture = profile["picture"]
        email_verified = True
    else:
        if os.getenv("ALLOW_DEV_GOOGLE_LOGIN", "true").lower() not in {"1", "true", "yes"}:
            raise HTTPException(status_code=400, detail="Google Client ID 설정이 필요합니다.")
        email = normalize_email(payload.email or "google-user@vinyl-check.local")
        name = payload.name or email.split("@")[0] or "Google User"
        google_sub = stable_id("google-sub", email)
        picture = ""
        email_verified = True

    users = read_json(USERS_PATH, {})
    existing = find_user_by_email(users, email)
    user = user_payload(existing.get("id") if existing else stable_id("google", email), existing.get("username", name) if existing else name, email, existing.get("genres", ["재즈"]) if existing else ["재즈"])
    if existing and existing.get("passwordHash"):
        user["passwordHash"] = existing["passwordHash"]
        user["authProvider"] = "password,google" if existing.get("authProvider") == "password" else existing.get("authProvider", "google")
    else:
        user["authProvider"] = existing.get("authProvider", "google") if existing else "google"
    user["googleSub"] = google_sub
    if picture:
        user["avatarUrl"] = picture
    user["emailVerified"] = email_verified
    user["createdAt"] = existing.get("createdAt") if existing else now_iso()
    user["updatedAt"] = now_iso()
    save_user(user)
    return {"token": create_session(str(user["id"]), True), "user": public_user(user)}


@router.post("/auth/logout")
async def logout(
    _user_id: Annotated[str, Depends(require_user_id)],
    authorization: Annotated[str | None, Header()] = None,
):
    revoke_session(authorization)
    return {"ok": True}


@router.post("/auth/find-id")
async def find_id(payload: FindIdRequest):
    return await find_id_request(payload)


@router.post("/auth/find-id/request")
async def find_id_request(payload: FindIdRequest):
    email = normalize_email(payload.email)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="올바른 이메일을 입력해 주세요.")
    users = read_json(USERS_PATH, {})
    user = find_user_by_email(users, email)
    if not user:
        raise HTTPException(status_code=404, detail="해당 이메일로 가입된 계정을 찾지 못했습니다.")

    code = verification_code()
    token_key = f"find-id:{email}:{code}"
    tokens = prune_expired_tokens(read_json(FIND_ID_TOKENS_PATH, {}))
    token = {
        "type": "find-id",
        "email": email,
        "userId": user["id"],
        "code": code,
        "used": False,
        "createdAt": now_iso(),
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }
    mail_sent = send_mail(
        email,
        "[Vinyl-Check] 아이디 찾기 인증번호",
        f"아래 인증번호를 앱의 아이디 찾기 화면에 입력해 주세요.\n\n{code}\n\n이 코드는 10분 후 만료됩니다.",
    )
    if not mail_sent and not allow_dev_auth_code("ALLOW_DEV_FIND_ID_CODE"):
        raise HTTPException(status_code=503, detail="메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요.")
    response = {
        "message": "가입된 이메일로 아이디 찾기 인증번호를 발송했습니다."
        if mail_sent
        else "메일 설정이 없어 개발용 아이디 찾기 인증번호를 표시합니다.",
        "sent": mail_sent,
    }
    if not mail_sent and allow_dev_auth_code("ALLOW_DEV_FIND_ID_CODE"):
        response["devFindIdCode"] = code
    tokens[token_key] = token
    write_json(FIND_ID_TOKENS_PATH, tokens)
    return response


@router.post("/auth/find-id/confirm")
async def find_id_confirm(payload: FindIdConfirm):
    email = normalize_email(payload.email)
    code = payload.code.strip()
    token_key = f"find-id:{email}:{code}"
    tokens = prune_expired_tokens(read_json(FIND_ID_TOKENS_PATH, {}))
    token = tokens.get(token_key)
    if not token or token.get("used"):
        write_json(FIND_ID_TOKENS_PATH, tokens)
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않거나 만료되었습니다.")
    if str(token.get("email")) != email:
        raise HTTPException(status_code=400, detail="이메일과 인증번호가 일치하지 않습니다.")
    users = read_json(USERS_PATH, {})
    user = find_user_by_email(users, email) or users.get(str(token.get("userId") or ""))
    if not user:
        raise HTTPException(status_code=404, detail="해당 이메일로 가입된 계정을 찾지 못했습니다.")
    token["used"] = True
    token["usedAt"] = now_iso()
    tokens[token_key] = token
    write_json(FIND_ID_TOKENS_PATH, tokens)
    username = str(user.get("username", ""))
    return {"message": "가입된 아이디를 찾았습니다.", "username": username, "maskedUsername": mask_username(username)}


@router.post("/auth/password-reset/request")
async def password_reset_request(payload: PasswordResetRequest):
    login_id = payload.loginId.strip()
    users = read_json(USERS_PATH, {})
    user = find_user_for_login(users, login_id)
    if not user:
        raise HTTPException(status_code=404, detail="입력한 계정을 찾지 못했습니다.")
    email = normalize_email(str(user.get("email", "")))
    if not email:
        raise HTTPException(status_code=400, detail="계정에 이메일이 없어 비밀번호를 재설정할 수 없습니다.")
    reset_code = verification_code()
    tokens = read_json(RESET_TOKENS_PATH, {})
    token_key = f"password-reset:{reset_code}"
    token = {
        "type": "password-reset",
        "userId": user["id"],
        "email": email,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "used": False,
    }
    mail_sent = send_mail(
        email,
        "[Vinyl-Check] 비밀번호 재설정 코드",
        f"아래 코드를 앱의 비밀번호 찾기 화면에 입력해 주세요.\n\n{reset_code}\n\n이 코드는 30분 후 만료됩니다.",
    )
    if not mail_sent and not allow_dev_auth_code("ALLOW_DEV_RESET_CODE"):
        raise HTTPException(status_code=503, detail="메일 발송에 실패했습니다. SMTP 설정을 확인해 주세요.")
    response = {
        "message": "가입된 이메일로 비밀번호 재설정 코드를 발송했습니다."
        if mail_sent
        else "메일 설정이 없어 개발용 재설정 코드를 표시합니다."
    }
    if not mail_sent and allow_dev_auth_code("ALLOW_DEV_RESET_CODE"):
        response["devResetCode"] = reset_code
    tokens[token_key] = token
    write_json(RESET_TOKENS_PATH, tokens)
    return response


@router.post("/auth/password-reset/confirm")
async def password_reset_confirm(payload: PasswordResetConfirm):
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다.")
    tokens = read_json(RESET_TOKENS_PATH, {})
    reset_code = payload.resetCode.strip()
    token_key = f"password-reset:{reset_code}"
    token = tokens.get(token_key) or tokens.get(reset_code)
    if not token or token.get("used"):
        raise HTTPException(status_code=400, detail="유효하지 않은 재설정 코드입니다.")
    expires_at = datetime.fromisoformat(str(token["expiresAt"]))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="만료된 재설정 코드입니다.")
    users = read_json(USERS_PATH, {})
    user = users.get(token["userId"])
    if not user:
        raise HTTPException(status_code=404, detail="계정을 찾지 못했습니다.")
    user["passwordHash"] = hash_password(payload.password)
    auth_provider = str(user.get("authProvider") or "")
    user["authProvider"] = auth_provider if "password" in auth_provider else ",".join(part for part in [auth_provider, "password"] if part)
    user["updatedAt"] = now_iso()
    users[user["id"]] = user
    token["used"] = True
    tokens[token_key if token_key in tokens else reset_code] = token
    write_json(USERS_PATH, users)
    write_json(RESET_TOKENS_PATH, tokens)
    return {"message": "비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요."}


@router.get("/users/{user_id}/profile-draft")
async def get_profile_draft(user_id: str):
    users = read_json(USERS_PATH, {})
    profile = users.get(user_id)
    return {"persisted": bool(profile), "profile": public_user(profile) if profile else None}


@router.put("/users/{user_id}/profile-draft")
async def upsert_profile_draft(user_id: str, payload: ProfileDraftUpsert):
    profile = {
        "id": user_id,
        "username": payload.username.strip() or "VinylLover",
        "email": payload.email or "user@example.com",
        "rating": max(0.0, min(5.0, payload.rating)),
        "transactionCount": max(0, int(payload.transactionCount)),
        "genres": [genre.strip() for genre in payload.genres if genre.strip()][:5],
        "emailVerified": payload.emailVerified,
        "updatedAt": now_iso(),
    }
    save_user(profile)
    return {"persisted": True, "profile": profile}


@router.get("/users/{user_id}/listing-draft")
async def get_listing_draft(user_id: str):
    drafts = read_json(os.path.join(DATA_DIR, "drafts.json"), {})
    user_drafts = drafts.get(user_id)
    if isinstance(user_drafts, list):
        draft = user_drafts[0]["draft"] if user_drafts else None
    else:
        draft = user_drafts
    return {"persisted": bool(draft), "draft": draft}


@router.put("/users/{user_id}/listing-draft")
async def upsert_listing_draft(user_id: str, payload: ListingDraftUpsert):
    drafts_path = os.path.join(DATA_DIR, "drafts.json")
    drafts = read_json(drafts_path, {})
    user_drafts = drafts.get(user_id)
    if not isinstance(user_drafts, list):
        user_drafts = [{
            "id": f"draft-{uuid4().hex[:10]}",
            "title": "기존 임시저장",
            "draft": user_drafts,
            "updatedAt": now_iso(),
        }] if isinstance(user_drafts, dict) else []
    draft_id = payload.draftId or f"draft-{uuid4().hex[:10]}"
    title = (payload.title or str(payload.draft.get("formData", {}).get("title") or "") or "제목 없는 판매글").strip()
    entry = {"id": draft_id, "title": title, "draft": payload.draft, "updatedAt": now_iso()}
    user_drafts = [entry, *[item for item in user_drafts if str(item.get("id")) != draft_id]]
    drafts[user_id] = user_drafts[:20]
    write_json(drafts_path, drafts)
    return {"persisted": True, "draft": payload.draft, "draftEntry": entry, "drafts": drafts[user_id], "updatedAt": entry["updatedAt"]}


@router.get("/users/{user_id}/listing-drafts")
async def list_listing_drafts(user_id: str):
    drafts = read_json(os.path.join(DATA_DIR, "drafts.json"), {})
    user_drafts = drafts.get(user_id)
    if isinstance(user_drafts, dict):
        user_drafts = [{"id": "legacy", "title": "기존 임시저장", "draft": user_drafts, "updatedAt": now_iso()}]
    if not isinstance(user_drafts, list):
        user_drafts = []
    return {"persisted": bool(user_drafts), "drafts": user_drafts}


@router.get("/users/{user_id}/listing-drafts/{draft_id}")
async def get_listing_draft_by_id(user_id: str, draft_id: str):
    drafts = read_json(os.path.join(DATA_DIR, "drafts.json"), {})
    user_drafts = drafts.get(user_id)
    if isinstance(user_drafts, dict) and draft_id == "legacy":
        return {"persisted": True, "draft": user_drafts}
    if not isinstance(user_drafts, list):
        raise HTTPException(status_code=404, detail="임시저장을 찾을 수 없습니다.")
    entry = next((item for item in user_drafts if str(item.get("id")) == draft_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="임시저장을 찾을 수 없습니다.")
    return {"persisted": True, "draft": entry.get("draft"), "draftEntry": entry}


@router.delete("/users/{user_id}/listing-draft")
async def delete_listing_draft(user_id: str):
    drafts_path = os.path.join(DATA_DIR, "drafts.json")
    drafts = read_json(drafts_path, {})
    deleted = user_id in drafts
    drafts.pop(user_id, None)
    write_json(drafts_path, drafts)
    return {"deleted": deleted}


@router.delete("/users/{user_id}/listing-drafts/{draft_id}")
async def delete_listing_draft_by_id(user_id: str, draft_id: str):
    drafts_path = os.path.join(DATA_DIR, "drafts.json")
    drafts = read_json(drafts_path, {})
    user_drafts = drafts.get(user_id)
    if isinstance(user_drafts, dict):
        if draft_id == "legacy":
            drafts.pop(user_id, None)
            write_json(drafts_path, drafts)
            return {"deleted": True}
        return {"deleted": False}
    if not isinstance(user_drafts, list):
        return {"deleted": False}
    next_drafts = [item for item in user_drafts if str(item.get("id")) != draft_id]
    if next_drafts:
        drafts[user_id] = next_drafts
    else:
        drafts.pop(user_id, None)
    write_json(drafts_path, drafts)
    return {"deleted": len(next_drafts) != len(user_drafts)}


@router.post("/reviews")
async def create_review(payload: ReviewCreate):
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="리뷰 점수는 1점부터 5점까지 입력할 수 있습니다.")
    users = read_json(USERS_PATH, {})
    if payload.revieweeId not in users:
        users[payload.revieweeId] = user_payload(payload.revieweeId, payload.revieweeId, f"{payload.revieweeId}@vinyl-check.local", [])
        users[payload.revieweeId]["emailVerified"] = False
        write_json(USERS_PATH, users)
    reviewer_name = payload.reviewerName or users.get(payload.reviewerId, {}).get("username") or "Vinyl-Check user"
    review = {
        "id": f"review-{uuid4().hex[:12]}",
        "revieweeId": payload.revieweeId,
        "reviewerId": payload.reviewerId,
        "reviewerName": reviewer_name,
        "rating": int(payload.rating),
        "comment": (payload.comment or "").strip(),
        "tags": [tag.strip() for tag in payload.tags if tag.strip()][:8],
        "albumId": payload.albumId,
        "albumTitle": payload.albumTitle,
        "transactionId": payload.transactionId,
        "createdAt": now_iso(),
    }
    reviews = read_json(REVIEWS_PATH, [])
    reviews.append(review)
    write_json(REVIEWS_PATH, reviews)
    updated_user = update_user_review_stats(payload.revieweeId)
    return {"review": review, "summary": review_summary_for_user(payload.revieweeId), "user": updated_user}


@router.get("/users/{user_id}/reviews")
async def get_user_reviews(user_id: str):
    reviews = read_json(REVIEWS_PATH, [])
    user_reviews = [review for review in reviews if str(review.get("revieweeId")) == user_id]
    user_reviews.sort(key=lambda review: str(review.get("createdAt", "")), reverse=True)
    return {"reviews": user_reviews}


@router.get("/users/{user_id}/review-summary")
async def get_user_review_summary(user_id: str):
    user = update_user_review_stats(user_id)
    summary = review_summary_for_user(user_id)
    return {**summary, "user": user}


@router.put("/reviews/{review_id}")
async def update_review(review_id: str, payload: ReviewUpdate, reviewer_id: str | None = None):
    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(status_code=400, detail="리뷰 점수는 1점부터 5점까지 입력할 수 있습니다.")
    reviews = read_json(REVIEWS_PATH, [])
    updated: dict[str, Any] | None = None
    for review in reviews:
        if str(review.get("id")) == review_id:
            if reviewer_id and str(review.get("reviewerId")) != reviewer_id:
                raise HTTPException(status_code=403, detail="리뷰를 수정할 권한이 없습니다.")
            review["rating"] = int(payload.rating)
            review["comment"] = (payload.comment or "").strip()
            review["tags"] = [tag.strip() for tag in payload.tags if tag.strip()][:8]
            review["updatedAt"] = now_iso()
            updated = review
            break
    if not updated:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")
    write_json(REVIEWS_PATH, reviews)
    updated_user = update_user_review_stats(str(updated.get("revieweeId")))
    return {"review": updated, "summary": review_summary_for_user(str(updated.get("revieweeId"))), "user": updated_user}


@router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, reviewer_id: str | None = None):
    reviews = read_json(REVIEWS_PATH, [])
    target = next((review for review in reviews if str(review.get("id")) == review_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다.")
    if reviewer_id and str(target.get("reviewerId")) != reviewer_id:
        raise HTTPException(status_code=403, detail="리뷰를 삭제할 권한이 없습니다.")
    next_reviews = [review for review in reviews if str(review.get("id")) != review_id]
    write_json(REVIEWS_PATH, next_reviews)
    update_user_review_stats(str(target.get("revieweeId")))
    return {"deleted": True, "reviewId": review_id}


def normalize_chat_message(chat_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(payload.get("id") or f"msg-{uuid4().hex[:12]}"),
        "chatId": chat_id,
        "senderId": str(payload.get("senderId") or payload.get("sender_id") or "buyer1"),
        "senderName": str(payload.get("senderName") or payload.get("sender_name") or "사용자"),
        "recipientId": str(payload.get("recipientId") or payload.get("recipient_id") or ""),
        "recipientName": str(payload.get("recipientName") or payload.get("recipient_name") or ""),
        "listingId": str(payload.get("listingId") or payload.get("listing_id") or chat_id),
        "message": str(payload.get("message") or payload.get("content") or ""),
        "timestamp": str(payload.get("timestamp") or payload.get("created_at") or now_iso()),
        "type": str(payload.get("type") or payload.get("message_type") or "text"),
    }


CHAT_SEPARATOR = "__dm__"


def chat_part(value: str | None) -> str:
    raw = str(value or "unknown").strip() or "unknown"
    return quote(raw, safe="")


def make_one_to_one_chat_id(listing_id: str | None, user_a: str | None, user_b: str | None) -> str:
    users = sorted([chat_part(user_a), chat_part(user_b)])
    return f"{chat_part(listing_id)}{CHAT_SEPARATOR}{users[0]}__{users[1]}"


def listing_id_from_chat_id(chat_id: str) -> str:
    return str(chat_id).split(CHAT_SEPARATOR, 1)[0]


def participant_ids_from_chat_id(chat_id: str) -> list[str]:
    if CHAT_SEPARATOR not in chat_id:
        return []
    tail = str(chat_id).split(CHAT_SEPARATOR, 1)[1]
    return [part for part in tail.split("__") if part]


def canonical_chat_id(chat_id: str, payload: ChatMessageCreate) -> str:
    if CHAT_SEPARATOR in chat_id:
        return chat_id
    if payload.listing_id and payload.sender_id and payload.recipient_id:
        return make_one_to_one_chat_id(payload.listing_id, payload.sender_id, payload.recipient_id)
    return chat_id


class ChatConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, chat_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(chat_id, []).append(websocket)

    def disconnect(self, chat_id: str, websocket: WebSocket) -> None:
        room = self.rooms.get(chat_id, [])
        if websocket in room:
            room.remove(websocket)
        if not room:
            self.rooms.pop(chat_id, None)

    async def broadcast(self, chat_id: str, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for websocket in self.rooms.get(chat_id, []):
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(chat_id, websocket)


chat_manager = ChatConnectionManager()


async def load_chat_messages(chat_id: str) -> list[dict[str, Any]]:
    chats = read_json(CHATS_PATH, {})
    room = chats.get(chat_id, [])
    messages = [normalize_chat_message(chat_id, item) for item in room] if isinstance(room, list) else []
    participants = participant_ids_from_chat_id(chat_id)
    if CHAT_SEPARATOR in chat_id and len(participants) == 2:
        listing_id = listing_id_from_chat_id(chat_id)
        for legacy_chat_id, legacy_room in chats.items():
            if str(legacy_chat_id) == chat_id or not isinstance(legacy_room, list):
                continue
            for item in legacy_room:
                message = normalize_chat_message(str(legacy_chat_id), item)
                if (message["listingId"] or listing_id_from_chat_id(str(legacy_chat_id))) != listing_id:
                    continue
                pair = sorted([chat_part(message["senderId"]), chat_part(message["recipientId"])])
                if pair == sorted(participants):
                    message["chatId"] = chat_id
                    messages.append(message)
    unique = {message["id"]: message for message in messages}
    return sorted(unique.values(), key=lambda message: message["timestamp"])


async def save_chat_message(chat_id: str, payload: ChatMessageCreate) -> dict[str, Any]:
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="메시지를 입력해 주세요.")
    message = normalize_chat_message(
        chat_id,
        {
            "id": f"msg-{uuid4().hex[:12]}",
            "senderId": payload.sender_id,
            "senderName": payload.sender_name,
            "recipientId": payload.recipient_id or "",
            "recipientName": payload.recipient_name or "",
            "listingId": payload.listing_id or chat_id,
            "message": content,
            "type": payload.message_type,
            "timestamp": now_iso(),
        },
    )
    chats = read_json(CHATS_PATH, {})
    room = chats.setdefault(chat_id, [])
    if not isinstance(room, list):
        room = []
        chats[chat_id] = room
    room.append(message)
    chats[chat_id] = room[-300:]
    write_json(CHATS_PATH, chats)
    return message


@router.get("/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str):
    return {"chatId": chat_id, "persisted": True, "messages": await load_chat_messages(chat_id)}


@router.post("/chats/{chat_id}/messages")
async def post_chat_message(chat_id: str, payload: ChatMessageCreate):
    chat_id = canonical_chat_id(chat_id, payload)
    message = await save_chat_message(chat_id, payload)
    event = {"type": "message", "chatId": chat_id, "message": message}
    await chat_manager.broadcast(chat_id, event)
    return event


@router.websocket("/ws/chats/{chat_id}")
async def chat_websocket(websocket: WebSocket, chat_id: str):
    user_id = websocket.query_params.get("user_id") or ""
    recipient_id = websocket.query_params.get("recipient_id") or ""
    listing_id = websocket.query_params.get("listing_id") or listing_id_from_chat_id(chat_id)
    if CHAT_SEPARATOR not in chat_id and user_id and recipient_id:
        chat_id = make_one_to_one_chat_id(listing_id, user_id, recipient_id)
    await chat_manager.connect(chat_id, websocket)
    try:
        await websocket.send_json({"type": "history", "chatId": chat_id, "messages": await load_chat_messages(chat_id)})
        while True:
            payload = await websocket.receive_json()
            if payload.get("type") == "ping":
                await websocket.send_json({"type": "pong", "chatId": chat_id})
                continue
            message = await save_chat_message(
                chat_id,
                ChatMessageCreate(
                    sender_id=str(payload.get("senderId") or payload.get("sender_id") or "buyer1"),
                    sender_name=str(payload.get("senderName") or payload.get("sender_name") or "사용자"),
                    recipient_id=str(payload.get("recipientId") or payload.get("recipient_id") or ""),
                    recipient_name=str(payload.get("recipientName") or payload.get("recipient_name") or ""),
                    listing_id=str(payload.get("listingId") or payload.get("listing_id") or chat_id),
                    content=str(payload.get("message") or payload.get("content") or ""),
                    message_type=str(payload.get("messageType") or payload.get("message_type") or "text"),
                ),
            )
            await chat_manager.broadcast(chat_id, {"type": "message", "chatId": chat_id, "message": message})
    except WebSocketDisconnect:
        pass
    finally:
        chat_manager.disconnect(chat_id, websocket)


@router.get("/listings")
async def list_listings(q: str | None = None):
    listings = all_albums()
    if not q:
        return [compact_listing_album(item) for item in listings]
    normalized = q.lower()
    return [
        compact_listing_album(item)
        for item in listings
        if normalized in item["title"].lower()
    ]


@router.post("/listings")
async def create_listing(payload: ListingCreate):
    listing = payload.model_dump()
    listing["tags"] = clean_tags(listing.get("tags"))
    listing["is_first_press"] = False
    listing["is_rare"] = False
    listing["id"] = f"listing-{uuid4().hex[:10]}"
    listing["seller_id"] = payload.user_id or "seller1"
    listing["created_at"] = now_iso()
    listing["views"] = 0
    listing["view_count"] = 0
    listing["favorite_count"] = 0
    listings = read_list(LISTINGS_PATH)
    ok, estimate, message = validate_listing_price(listing, listings, read_list(BUY_ORDERS_PATH), read_list(MARKET_PRICE_HISTORY_PATH))
    if not ok:
        raise HTTPException(status_code=422, detail=market_validation_detail(message, estimate))
    apply_market_snapshot(listing, estimate)
    listing = compact_listing_for_storage(listing)
    listings.insert(0, listing)
    write_listings(listings)
    wishlist_notification_for_listing(listing)
    return {"status": "ok", "persisted": True, "listing": listing_to_album(listing)}


@router.put("/listings/{listing_id}")
async def update_listing(listing_id: str, payload: ListingCreate, user_id: str | None = None):
    listings = read_list(LISTINGS_PATH)
    updated: dict[str, Any] | None = None
    previous_signature: tuple[str, ...] | None = None
    for listing in listings:
        if str(listing.get("id")) == listing_id:
            previous_signature = listing_identity_signature(listing)
            seller_id = str(listing.get("seller_id") or listing.get("user_id") or "")
            if user_id and seller_id and seller_id != user_id:
                raise HTTPException(status_code=403, detail="판매글을 수정할 권한이 없습니다.")
            listing.update(payload.model_dump())
            listing["tags"] = clean_tags(listing.get("tags"))
            listing["is_first_press"] = False
            listing["is_rare"] = False
            listing["id"] = listing_id
            listing["seller_id"] = seller_id or payload.user_id or "seller1"
            listing["updated_at"] = now_iso()
            ok, estimate, message = validate_listing_price(listing, listings, read_list(BUY_ORDERS_PATH), read_list(MARKET_PRICE_HISTORY_PATH))
            if not ok:
                raise HTTPException(status_code=422, detail=market_validation_detail(message, estimate))
            apply_market_snapshot(listing, estimate)
            compact_listing_in_place(listing)
            updated = listing
            break
    if not updated:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    write_listings(listings)
    if previous_signature != listing_identity_signature(updated):
        wishlist_notification_for_listing(updated)
    return {"status": "ok", "persisted": True, "listing": listing_to_album(updated)}


@router.delete("/listings/{listing_id}")
async def hide_listing(listing_id: str, user_id: str | None = None):
    listings = read_json(LISTINGS_PATH, [])
    updated: dict[str, Any] | None = None
    for listing in listings:
        if str(listing.get("id")) == listing_id:
            if user_id and str(listing.get("seller_id") or listing.get("user_id")) != user_id:
                raise HTTPException(status_code=403, detail="판매글을 내릴 권한이 없습니다.")
            listing["status"] = "hidden"
            listing["hidden_at"] = now_iso()
            updated = listing
            break
    if not updated:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    write_listings(listings)
    return {"status": "hidden", "listingId": listing_id}


def find_raw_listing(listing_id: str, listings: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    source = listings if listings is not None else read_list(LISTINGS_PATH)
    for listing in source:
        if str(listing.get("id")) == str(listing_id):
            return listing
    return next((item for item in MOCK_LISTINGS if str(item.get("id")) == str(listing_id)), None)


def buy_order_buyer_alias(order: dict[str, Any], users: dict[str, Any] | None = None) -> str:
    buyer_id = str(order.get("buyer_id") or order.get("buyerId") or "")
    user = users.get(buyer_id, {}) if isinstance(users, dict) else {}
    username = str(order.get("buyer_name") or order.get("buyerName") or user.get("username") or "").strip()
    if username:
        return mask_username(username)
    return f"구매자 {buyer_id[-4:]}" if buyer_id else "구매자"


def compact_buy_order(order: dict[str, Any], users: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": str(order.get("id") or ""),
        "buyerId": str(order.get("buyer_id") or order.get("buyerId") or ""),
        "buyerAlias": buy_order_buyer_alias(order, users),
        "chatId": str(order.get("chat_id") or order.get("chatId") or ""),
        "listingId": order.get("listing_id") or order.get("listingId"),
        "marketKey": str(order.get("market_key") or order.get("marketKey") or ""),
        "maxPrice": int(order.get("max_price") or order.get("maxPrice") or 0),
        "minMediaGrade": str(order.get("min_media_grade") or order.get("minMediaGrade") or "G"),
        "minSleeveGrade": str(order.get("min_sleeve_grade") or order.get("minSleeveGrade") or "G"),
        "pressingCondition": order.get("pressing_condition") or order.get("pressingCondition"),
        "isFirstPressOnly": bool(order.get("is_first_press_only") or order.get("isFirstPressOnly") or False),
        "regionPreference": order.get("region_preference") or order.get("regionPreference"),
        "status": str(order.get("status") or "active"),
        "createdAt": str(order.get("created_at") or order.get("createdAt") or now_iso()),
        "updatedAt": order.get("updated_at") or order.get("updatedAt"),
    }


@router.get("/market/price-estimate")
async def get_market_price_estimate(
    listing_id: str | None = None,
    title: str | None = None,
    artist: str | None = None,
    catalog_number: str | None = None,
    price: int | None = None,
    year: int | None = None,
    audio_grade: str | None = None,
    jacket_grade: str | None = None,
    pressing_condition: str | None = None,
    is_first_press: bool = False,
    is_rare: bool = False,
    location: str | None = None,
):
    listings = read_list(LISTINGS_PATH)
    listing = find_raw_listing(listing_id, listings) if listing_id else None
    if listing is None:
        listing = {
            "id": listing_id or "draft",
            "title": title or "Untitled",
            "artist": artist or "Unknown artist",
            "catalog_number": catalog_number,
            "price": price or 0,
            "year": year,
            "audio_grade": audio_grade or "VG+",
            "jacket_grade": jacket_grade or audio_grade or "VG+",
            "pressing_condition": pressing_condition,
            "is_first_press": False,
            "is_rare": False,
            "location": location,
        }
    if price is not None:
        listing = {**listing, "price": price, "seller_price": price}
    estimate = build_market_estimate(listing, listings, read_list(BUY_ORDERS_PATH), read_list(MARKET_PRICE_HISTORY_PATH), seller_price=price)
    return enrich_estimate_with_wishlist(estimate, listing)


@router.post("/market/buy-orders")
async def create_buy_order(payload: BuyOrderCreate):
    if payload.max_price <= 0:
        raise HTTPException(status_code=400, detail="구매 대기 가격을 입력해 주세요.")
    listings = read_list(LISTINGS_PATH)
    listing = find_raw_listing(payload.listing_id, listings) if payload.listing_id else None
    market_key = payload.market_key or (normalize_market_key(listing) if listing else "")
    if not market_key:
        raise HTTPException(status_code=400, detail="listing_id 또는 market_key가 필요합니다.")
    order = {
        "id": f"buy-order-{uuid4().hex[:10]}",
        "buyer_id": payload.buyer_id,
        "listing_id": payload.listing_id,
        "market_key": market_key,
        "max_price": payload.max_price,
        "min_media_grade": payload.min_media_grade,
        "min_sleeve_grade": payload.min_sleeve_grade,
        "pressing_condition": payload.pressing_condition,
        "is_first_press_only": payload.is_first_press_only,
        "region_preference": payload.region_preference,
        "status": payload.status if payload.status in {"active", "paused"} else "active",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    buy_orders = read_list(BUY_ORDERS_PATH)
    buy_orders.insert(0, order)
    write_json(BUY_ORDERS_PATH, buy_orders)
    updated_listing = None
    if listing and listing in listings:
        recalculate_listing_market(listing, listings)
        compact_listing_in_place(listing)
        write_listings(listings)
        updated_listing = listing_to_album(listing)
    matches = find_matching_buy_orders(listing, buy_orders) if listing else []
    users = read_json(USERS_PATH, {})
    return {
        "status": "ok",
        "persisted": True,
        "buyOrder": compact_buy_order(order, users),
        "matches": [compact_buy_order(item, users) for item in matches],
        "listing": updated_listing,
    }


@router.get("/market/buy-orders/matches")
async def get_buy_order_matches(listing_id: str):
    listing = find_raw_listing(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    matches = find_matching_buy_orders(listing, read_list(BUY_ORDERS_PATH))
    users = read_json(USERS_PATH, {})
    return {
        "listingId": listing_id,
        "marketKey": normalize_market_key(listing),
        "matches": [compact_buy_order(item, users) for item in matches],
        "instantSalePrice": calculate_instant_sale_price(listing, matches),
    }


@router.post("/market/listings/{listing_id}/instant-sell")
async def instant_sell_listing(listing_id: str, payload: InstantSellRequest | None = None):
    listings = read_list(LISTINGS_PATH)
    listing = find_raw_listing(listing_id, listings)
    if not listing or listing not in listings:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    seller_id = str(listing.get("seller_id") or listing.get("user_id") or "")
    if payload and payload.seller_id and seller_id and payload.seller_id != seller_id:
        raise HTTPException(status_code=403, detail="즉시 판매 권한이 없습니다.")
    if str(listing.get("status") or "published") in UNAVAILABLE_LISTING_STATUSES:
        raise HTTPException(status_code=400, detail="판매 가능한 상태가 아닙니다.")

    buy_orders = read_list(BUY_ORDERS_PATH)
    matches = find_matching_buy_orders(listing, buy_orders)
    if not matches:
        raise HTTPException(status_code=404, detail="조건에 맞는 구매 대기가 없습니다.")
    selected_order_id = str(payload.buy_order_id or "").strip() if payload else ""
    order = next((item for item in matches if str(item.get("id")) == selected_order_id), None) if selected_order_id else matches[0]
    if order is None:
        raise HTTPException(status_code=404, detail="선택한 구매 대기를 찾을 수 없습니다.")
    sale_price = int(order.get("max_price") or order.get("maxPrice") or 0)
    buyer_id = str(order.get("buyer_id") or order.get("buyerId") or "")
    users = read_json(USERS_PATH, {})
    buyer = users.get(buyer_id, {}) if isinstance(users, dict) else {}
    seller = users.get(seller_id, {}) if isinstance(users, dict) else {}
    buyer_name = str(order.get("buyer_name") or order.get("buyerName") or buyer.get("username") or buyer.get("name") or buyer_id or "구매자")
    seller_name = str(
        listing.get("seller_name")
        or listing.get("sellerName")
        or seller.get("username")
        or seller.get("name")
        or seller_id
        or "판매자"
    )
    chat_id = make_one_to_one_chat_id(listing_id, buyer_id, seller_id)
    transaction_id = f"tx-{uuid4().hex[:10]}"
    now = now_iso()

    listing["status"] = "reserved"
    listing["reserved_at"] = now
    listing["buyer_id"] = buyer_id
    listing["instant_sale_price"] = sale_price
    listing["sold_price"] = sale_price
    recalculate_listing_market(listing, listings)

    for stored_order in buy_orders:
        if str(stored_order.get("id")) == str(order.get("id")):
            stored_order["status"] = "matched"
            stored_order["matched_listing_id"] = listing_id
            stored_order["matched_at"] = now
            stored_order["transaction_id"] = transaction_id
            stored_order["chat_id"] = chat_id
            stored_order["chatId"] = chat_id
            stored_order["updated_at"] = now
            order = stored_order
            break
    recalculate_listing_market(listing, listings)

    transaction = {
        "id": transaction_id,
        "type": "instant_sale",
        "chat_id": chat_id,
        "chatId": chat_id,
        "listing_id": listing_id,
        "listingId": listing_id,
        "buyer_id": buyer_id,
        "buyerId": buyer_id,
        "seller_id": seller_id,
        "sellerId": seller_id,
        "price": sale_price,
        "status": "matched",
        "created_at": now,
        "createdAt": now,
    }
    history_item = {
        "id": f"market-history-{uuid4().hex[:10]}",
        "market_key": normalize_market_key(listing),
        "listing_id": listing_id,
        "trade_price": sale_price,
        "event": "instant_sale",
        "created_at": now,
    }
    transactions = read_list(TRANSACTIONS_PATH)
    transactions.insert(0, transaction)
    history = read_list(MARKET_PRICE_HISTORY_PATH)
    history.append(history_item)
    compact_listing_in_place(listing)
    write_listings(listings)
    write_json(BUY_ORDERS_PATH, buy_orders)
    write_json(TRANSACTIONS_PATH, transactions)
    write_json(MARKET_PRICE_HISTORY_PATH, history)
    message = await save_chat_message(chat_id, ChatMessageCreate(
        sender_id=seller_id,
        sender_name=seller_name,
        recipient_id=buyer_id,
        recipient_name=buyer_name,
        listing_id=listing_id,
        content=f"구매 대기를 승인했습니다. {sale_price:,}원 거래를 채팅에서 이어가세요.",
        message_type="offer",
    ))
    await chat_manager.broadcast(chat_id, {"type": "message", "chatId": chat_id, "message": message})
    return {
        "status": "ok",
        "chatId": chat_id,
        "listing": listing_to_album(listing),
        "buyOrder": compact_buy_order(order, users),
        "transaction": transaction,
        "priceHistory": history_item,
    }


@router.get("/market/listings/{listing_id}/market-advice")
async def get_market_advice(listing_id: str):
    listing = find_raw_listing(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    result = build_market_advice(listing, read_list(LISTINGS_PATH), read_list(BUY_ORDERS_PATH), read_list(MARKET_PRICE_HISTORY_PATH))
    enrich_estimate_with_wishlist(result["estimate"], listing)
    return {"listingId": listing_id, **result}


@router.post("/market/listings/{listing_id}/view")
async def record_listing_view(listing_id: str):
    listings = read_list(LISTINGS_PATH)
    listing = find_raw_listing(listing_id, listings)
    if not listing or listing not in listings:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    next_count = int(listing.get("view_count") or listing.get("views") or 0) + 1
    listing["views"] = next_count
    listing["view_count"] = next_count
    recalculate_listing_market(listing, listings)
    compact_listing_in_place(listing)
    write_listings(listings)
    return {"status": "ok", "listing": listing_to_album(listing)}


@router.post("/market/listings/{listing_id}/favorite")
async def record_listing_favorite(listing_id: str, delta: int = 1):
    listings = read_list(LISTINGS_PATH)
    listing = find_raw_listing(listing_id, listings)
    if not listing or listing not in listings:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    next_count = max(0, int(listing.get("favorite_count") or listing.get("favoriteCount") or 0) + (1 if delta >= 0 else -1))
    listing["favorite_count"] = next_count
    recalculate_listing_market(listing, listings)
    compact_listing_in_place(listing)
    write_listings(listings)
    return {"status": "ok", "listing": listing_to_album(listing)}


def compact_wishlist_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("id") or ""),
        "userId": str(item.get("user_id") or item.get("userId") or ""),
        "listingId": item.get("listing_id") or item.get("listingId"),
        "marketKey": str(item.get("market_key") or item.get("marketKey") or ""),
        "title": str(item.get("title") or ""),
        "artist": str(item.get("artist") or ""),
        "catalogNumber": str(item.get("catalog_number") or item.get("catalogNumber") or ""),
        "discogsReleaseId": int(item.get("discogs_release_id") or item.get("discogsReleaseId") or 0) or None,
        "coverImageUrl": str(item.get("cover_image_url") or item.get("coverImageUrl") or ""),
        "releaseLabel": str(item.get("release_label") or item.get("releaseLabel") or ""),
        "releaseCountry": str(item.get("release_country") or item.get("releaseCountry") or ""),
        "year": item.get("year"),
        "pressingCondition": item.get("pressing_condition") or item.get("pressingCondition"),
        "visibility": "public" if str(item.get("visibility") or "private") == "public" else "private",
        "status": str(item.get("status") or "active"),
        "createdAt": str(item.get("created_at") or item.get("createdAt") or now_iso()),
        "updatedAt": item.get("updated_at") or item.get("updatedAt"),
    }


def wishlist_identity_key(item: dict[str, Any]) -> str:
    release_id = int(item.get("discogs_release_id") or item.get("discogsReleaseId") or 0)
    if release_id:
        return f"release:{release_id}"
    catalog = normalize_lookup_text(item.get("catalog_number") or item.get("catalogNumber"))
    if catalog:
        return f"catalog:{catalog}"
    title = normalize_lookup_text(item.get("title"))
    artist = normalize_lookup_text(item.get("artist"))
    year = str(item.get("year") or "")
    return f"album:{title}|artist:{artist}|year:{year}"


def wishlist_matches_for_item(item: dict[str, Any]) -> list[dict[str, Any]]:
    owner_id = str(item.get("user_id") or item.get("userId") or "")
    persisted = read_list(LISTINGS_PATH)
    source = [*persisted, *MOCK_LISTINGS]
    matches = [
        listing_to_album(listing)
        for listing in source
        if wishlist_matches_listing(item, listing)
        and is_market_visible_listing(listing)
        and str(listing.get("seller_id") or listing.get("user_id") or (listing.get("seller") or {}).get("id") or "") != owner_id
    ]
    matches.sort(key=lambda listing: str(listing.get("createdAt") or ""), reverse=True)
    return matches


@router.get("/market/wishlist")
async def get_wishlist(user_id: Annotated[str, Depends(require_user_id)]):
    items = [
        compact_wishlist_item(item)
        for item in read_list(WISHLIST_PATH)
        if str(item.get("user_id") or item.get("userId") or "") == user_id
        and str(item.get("status") or "active") == "active"
    ]
    return {"wishlist": items}


@router.get("/users/{profile_user_id}/wishlist/public")
async def get_public_wishlist(profile_user_id: str):
    items = [
        compact_wishlist_item(item)
        for item in read_list(WISHLIST_PATH)
        if str(item.get("user_id") or item.get("userId") or "") == profile_user_id
        and str(item.get("status") or "active") == "active"
        and str(item.get("visibility") or "private") == "public"
    ]
    return {"wishlist": items}


@router.post("/market/wishlist")
async def create_wishlist_item(payload: WishlistCreate, user_id: Annotated[str, Depends(require_user_id)]):
    listings = read_list(LISTINGS_PATH)
    listing = find_raw_listing(payload.listing_id, listings) if payload.listing_id else None
    draft_listing = listing or {
        "title": payload.title or "Untitled",
        "artist": payload.artist or "Unknown artist",
        "catalog_number": payload.catalog_number,
        "discogs_release_id": payload.discogs_release_id,
        "discogs_cover_image_url": payload.cover_image_url,
        "release_label": payload.release_label,
        "release_country": payload.release_country,
        "year": payload.year,
        "pressing_condition": payload.pressing_condition,
    }
    market_key = payload.market_key or normalize_market_key(draft_listing)
    if not market_key or (not payload.title and not payload.catalog_number and not payload.discogs_release_id and not listing):
        raise HTTPException(status_code=400, detail="앨범명, 카탈로그 번호 또는 Discogs 발매본 정보가 필요합니다.")
    visibility = "public" if payload.visibility == "public" else "private"
    candidate_item = {
        "discogs_release_id": (listing or draft_listing).get("discogs_release_id") or payload.discogs_release_id,
        "catalog_number": (listing or draft_listing).get("catalog_number") or payload.catalog_number,
        "title": (listing or draft_listing).get("title") or payload.title,
        "artist": (listing or draft_listing).get("artist") or payload.artist,
        "year": (listing or draft_listing).get("year") or payload.year,
    }
    identity_key = wishlist_identity_key(candidate_item)
    wishlist = read_list(WISHLIST_PATH)
    existing = next(
        (
            item
            for item in wishlist
            if str(item.get("user_id") or item.get("userId") or "") == user_id
            and wishlist_identity_key(item) == identity_key
            and str(item.get("status") or "active") == "active"
        ),
        None,
    )
    if existing:
        return {"status": "ok", "wishlistItem": compact_wishlist_item(existing), "listing": listing_to_album(listing) if listing else None}

    item = {
        "id": f"wishlist-{uuid4().hex[:10]}",
        "user_id": user_id,
        "listing_id": payload.listing_id,
        "market_key": market_key,
        "title": (listing or draft_listing).get("title") or payload.title or "",
        "artist": (listing or draft_listing).get("artist") or payload.artist or "",
        "catalog_number": (listing or draft_listing).get("catalog_number") or payload.catalog_number or "",
        "discogs_release_id": (listing or draft_listing).get("discogs_release_id") or payload.discogs_release_id,
        "cover_image_url": (listing or draft_listing).get("discogs_cover_image_url") or payload.cover_image_url or "",
        "release_label": (listing or draft_listing).get("release_label") or payload.release_label or "",
        "release_country": (listing or draft_listing).get("release_country") or payload.release_country or "",
        "year": (listing or draft_listing).get("year") or payload.year,
        "pressing_condition": (listing or draft_listing).get("pressing_condition") or payload.pressing_condition,
        "visibility": visibility,
        "status": "active",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    wishlist.insert(0, item)
    write_json(WISHLIST_PATH, wishlist)
    if listing and listing in listings:
        recalculate_listing_market(listing, listings)
        compact_listing_in_place(listing)
        write_listings(listings)
    return {"status": "ok", "wishlistItem": compact_wishlist_item(item), "listing": listing_to_album(listing) if listing else None}


@router.put("/market/wishlist/{wishlist_id}")
async def update_wishlist_item(wishlist_id: str, payload: WishlistUpdate, user_id: Annotated[str, Depends(require_user_id)]):
    wishlist = read_list(WISHLIST_PATH)
    item = next(
        (
            stored
            for stored in wishlist
            if str(stored.get("id")) == wishlist_id
            and str(stored.get("user_id") or stored.get("userId") or "") == user_id
            and str(stored.get("status") or "active") == "active"
        ),
        None,
    )
    if not item:
        raise HTTPException(status_code=404, detail="위시리스트 항목을 찾을 수 없습니다.")
    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "catalog_number": "catalog_number",
        "discogs_release_id": "discogs_release_id",
        "cover_image_url": "cover_image_url",
        "release_label": "release_label",
        "release_country": "release_country",
        "pressing_condition": "pressing_condition",
    }
    for key in ("title", "artist", "year"):
        if key in updates:
            item[key] = updates[key]
    for source_key, target_key in field_map.items():
        if source_key in updates:
            item[target_key] = updates[source_key]
    if "visibility" in updates:
        item["visibility"] = "public" if updates["visibility"] == "public" else "private"
    if not item.get("title") and not item.get("catalog_number") and not item.get("discogs_release_id"):
        raise HTTPException(status_code=400, detail="앨범명, 카탈로그 번호 또는 Discogs 발매본 정보가 필요합니다.")
    item["market_key"] = normalize_market_key(item)
    item["updated_at"] = now_iso()
    write_json(WISHLIST_PATH, wishlist)
    return {"status": "ok", "wishlistItem": compact_wishlist_item(item)}


@router.get("/market/wishlist/{wishlist_id}/matches")
async def get_wishlist_matches(wishlist_id: str, user_id: Annotated[str, Depends(require_user_id)]):
    item = next(
        (
            stored
            for stored in read_list(WISHLIST_PATH)
            if str(stored.get("id")) == wishlist_id
            and str(stored.get("user_id") or stored.get("userId") or "") == user_id
            and str(stored.get("status") or "active") == "active"
        ),
        None,
    )
    if not item:
        raise HTTPException(status_code=404, detail="위시리스트 항목을 찾을 수 없습니다.")
    return {"wishlistId": wishlist_id, "matches": wishlist_matches_for_item(item)}


@router.delete("/market/wishlist/{wishlist_id}")
async def delete_wishlist_item(wishlist_id: str, user_id: Annotated[str, Depends(require_user_id)]):
    wishlist = read_list(WISHLIST_PATH)
    updated: dict[str, Any] | None = None
    for item in wishlist:
        if str(item.get("id")) == wishlist_id and str(item.get("user_id") or item.get("userId") or "") == user_id:
            item["status"] = "inactive"
            item["updated_at"] = now_iso()
            updated = item
            break
    if not updated:
        raise HTTPException(status_code=404, detail="위시리스트 항목을 찾을 수 없습니다.")
    write_json(WISHLIST_PATH, wishlist)
    return {"status": "ok", "wishlistItem": compact_wishlist_item(updated)}


def collection_owner(user_id: str) -> dict[str, Any]:
    user = read_json(USERS_PATH, {}).get(user_id, {})
    return {
        "id": user_id,
        "name": str(user.get("username") or "사용자"),
        "rating": float(user.get("rating") or 0),
        "transactionCount": int(user.get("transactionCount") or 0),
    }


def normalize_collection(item: dict[str, Any]) -> dict[str, Any]:
    owner_id = str(item.get("ownerId") or item.get("owner_id") or "")
    normalized = dict(item)
    normalized["id"] = str(item.get("id") or f"collection-{uuid4().hex[:10]}")
    normalized["owner"] = item.get("owner") or collection_owner(owner_id)
    normalized["ownerId"] = owner_id
    normalized["ownershipStatus"] = "owned"
    normalized["visibility"] = "private" if item.get("visibility") == "private" else "public"
    normalized["contactCount"] = int(item.get("contactCount") or 0)
    normalized["createdAt"] = str(item.get("createdAt") or now_iso())
    normalized["updatedAt"] = str(item.get("updatedAt") or normalized["createdAt"])
    discogs_cover = str(item.get("discogsCoverImageUrl") or "").strip()
    if discogs_cover:
        record_image = str(item.get("recordImageDataUrl") or "").strip()
        normalized["coverImageDataUrl"] = None
        normalized["images"] = [image for image in (discogs_cover, record_image) if image]
    return normalized


def find_collection(collection_id: str) -> dict[str, Any] | None:
    return next(
        (normalize_collection(item) for item in read_list(COLLECTIONS_PATH) if str(item.get("id")) == collection_id),
        None,
    )


def collection_to_album(collection: dict[str, Any]) -> dict[str, Any]:
    price = int(collection.get("purchasePrice") or 0)
    images = collection.get("images") or []
    cover = collection.get("discogsCoverImageUrl") or collection.get("coverImageDataUrl") or ""
    if cover and cover not in images:
        images = [cover, *images]
    return {
        "id": collection["id"],
        "title": collection.get("title") or "컬렉션 LP",
        "artist": collection.get("artist") or "",
        "year": int(collection.get("year") or 0),
        "genre": collection.get("genre") or "기타",
        "catalogNumber": collection.get("catalogNumber") or "",
        "price": price,
        "priceRange": {"min": 0, "max": max(price, 0)},
        "images": images,
        "audioGrade": collection.get("audioGrade") or "-",
        "audioScore": int(collection.get("audioScore") or 0),
        "isRare": bool(collection.get("isRare")),
        "isFirstPress": bool(collection.get("isFirstPress")),
        "description": collection.get("notes") or "",
        "seller": collection["owner"],
        "location": "",
        "views": 0,
        "createdAt": collection["createdAt"],
    }


@router.get("/collections")
async def get_collections(
    owner_id: str | None = None,
    authorization: Annotated[str | None, Header()] = None,
):
    viewer_id = optional_user_id(authorization)
    collections = [normalize_collection(item) for item in read_list(COLLECTIONS_PATH)]
    visible = [
        item for item in collections
        if (not owner_id or item["ownerId"] == owner_id)
        and (item["visibility"] == "public" or item["ownerId"] == viewer_id)
    ]
    return {"collections": visible}


@router.post("/collections")
async def create_collection(payload: CollectionCreate, user_id: Annotated[str, Depends(require_user_id)]):
    item = payload.model_dump()
    if not item.get("discogsReleaseId") or not str(item.get("discogsCoverImageUrl") or "").strip():
        raise HTTPException(status_code=400, detail="Discogs 발매반과 커버 이미지를 선택해 주세요.")
    item["coverImageDataUrl"] = None
    item["images"] = [image for image in (item["discogsCoverImageUrl"], item.get("recordImageDataUrl")) if image]
    item["ownershipStatus"] = "owned"
    item.update({
        "id": f"collection-{uuid4().hex[:10]}",
        "ownerId": user_id,
        "owner": collection_owner(user_id),
        "contactCount": 0,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
    })
    collections = read_list(COLLECTIONS_PATH)
    collections.insert(0, item)
    write_json(COLLECTIONS_PATH, collections)
    return {"status": "ok", "collection": normalize_collection(item)}


@router.put("/collections/{collection_id}")
async def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
    user_id: Annotated[str, Depends(require_user_id)],
):
    collections = read_list(COLLECTIONS_PATH)
    updated: dict[str, Any] | None = None
    for item in collections:
        if str(item.get("id")) != collection_id:
            continue
        if str(item.get("ownerId") or item.get("owner_id")) != user_id:
            raise HTTPException(status_code=403, detail="컬렉션을 수정할 권한이 없습니다.")
        preserved = {key: item.get(key) for key in ("id", "ownerId", "owner", "contactCount", "createdAt")}
        updates = payload.model_dump()
        if not updates.get("discogsReleaseId") or not str(updates.get("discogsCoverImageUrl") or "").strip():
            raise HTTPException(status_code=400, detail="Discogs 발매반과 커버 이미지를 선택해 주세요.")
        updates["coverImageDataUrl"] = None
        updates["images"] = [image for image in (updates["discogsCoverImageUrl"], updates.get("recordImageDataUrl")) if image]
        updates["ownershipStatus"] = "owned"
        item.update(updates)
        item.update(preserved)
        item["updatedAt"] = now_iso()
        updated = item
        break
    if not updated:
        raise HTTPException(status_code=404, detail="컬렉션을 찾을 수 없습니다.")
    write_json(COLLECTIONS_PATH, collections)
    return {"status": "ok", "collection": normalize_collection(updated)}


def offer_album_for_listing(listing_id: str) -> dict[str, Any] | None:
    listing = find_raw_listing(listing_id)
    return listing_to_album(listing) if listing else None


def normalize_offer(payload: dict[str, Any]) -> dict[str, Any]:
    collection_id = str(payload.get("collectionId") or payload.get("collection_id") or "")
    listing_id = str(payload.get("listingId") or payload.get("listing_id") or collection_id)
    collection = find_collection(collection_id) if collection_id else None
    album = collection_to_album(collection) if collection else offer_album_for_listing(listing_id)
    buyer_id = str(payload.get("buyerId") or payload.get("buyer_id") or "guest")
    seller_id = str(payload.get("sellerId") or payload.get("seller_id") or "")
    return {
        "id": str(payload.get("id") or f"offer-{uuid4().hex[:10]}"),
        "listingId": listing_id,
        "collectionId": collection_id or None,
        "offerType": "collection" if collection else "listing",
        "album": album,
        "buyerId": buyer_id,
        "buyerName": str(payload.get("buyerName") or payload.get("buyer_name") or "게스트"),
        "sellerId": seller_id,
        "sellerName": str(payload.get("sellerName") or payload.get("seller_name") or ""),
        "offerPrice": int(payload.get("offerPrice") or payload.get("offer_price") or 0),
        "timestamp": str(payload.get("timestamp") or payload.get("created_at") or now_iso()),
        "status": str(payload.get("status") or "pending"),
        "chatId": str(payload.get("chatId") or payload.get("chat_id") or make_one_to_one_chat_id(listing_id, buyer_id, seller_id)),
    }


@router.post("/collection-offers")
async def create_collection_offer(payload: CollectionOfferCreate):
    collection = find_collection(payload.collectionId)
    if not collection or collection.get("visibility") != "public":
        raise HTTPException(status_code=404, detail="공개 컬렉션을 찾을 수 없습니다.")
    if payload.offerPrice <= 0:
        raise HTTPException(status_code=400, detail="제안 금액을 확인해 주세요.")
    seller_id = str(collection["owner"]["id"])
    if seller_id == payload.buyerId:
        raise HTTPException(status_code=400, detail="내 컬렉션에는 구매 제안을 보낼 수 없습니다.")
    offer = normalize_offer({
        "id": f"offer-{uuid4().hex[:10]}",
        "listingId": payload.collectionId,
        "collectionId": payload.collectionId,
        "buyerId": payload.buyerId,
        "buyerName": payload.buyerName,
        "sellerId": seller_id,
        "sellerName": collection["owner"]["name"],
        "offerPrice": payload.offerPrice,
        "timestamp": now_iso(),
        "status": "pending",
    })
    offers = read_list(OFFERS_PATH)
    offers.insert(0, {key: value for key, value in offer.items() if key != "album"})
    write_json(OFFERS_PATH, offers)
    for item in read_list(COLLECTIONS_PATH):
        if str(item.get("id")) == payload.collectionId:
            item["contactCount"] = int(item.get("contactCount") or 0) + 1
            collections = read_list(COLLECTIONS_PATH)
            for stored in collections:
                if str(stored.get("id")) == payload.collectionId:
                    stored["contactCount"] = item["contactCount"]
            write_json(COLLECTIONS_PATH, collections)
            break
    chat_id = offer["chatId"]
    message = await save_chat_message(chat_id, ChatMessageCreate(
        sender_id=offer["buyerId"], sender_name=offer["buyerName"],
        recipient_id=offer["sellerId"], recipient_name=offer["sellerName"],
        listing_id=payload.collectionId,
        content=f"컬렉션 LP에 구매 제안 {offer['offerPrice']:,}원을 보냈습니다.", message_type="offer",
    ))
    await chat_manager.broadcast(chat_id, {"type": "message", "chatId": chat_id, "message": message})
    return {"status": "ok", "persisted": True, "offer": offer}


@router.post("/offers")
async def create_offer(payload: OfferCreate):
    album = find_album(payload.listingId)
    if not album:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    if payload.offerPrice <= 0:
        raise HTTPException(status_code=400, detail="제안 금액을 확인해 주세요.")

    seller_id = str(album["seller"]["id"])
    if seller_id == payload.buyerId:
        raise HTTPException(status_code=400, detail="내 판매글에는 가격 제안을 보낼 수 없습니다.")
    offer = normalize_offer(
        {
            "id": f"offer-{uuid4().hex[:10]}",
            "listingId": payload.listingId,
            "buyerId": payload.buyerId,
            "buyerName": payload.buyerName,
            "sellerId": seller_id,
            "sellerName": album["seller"]["name"],
            "offerPrice": payload.offerPrice,
            "timestamp": now_iso(),
            "status": "pending",
        }
    )
    offers = read_json(OFFERS_PATH, [])
    offers.insert(0, {key: value for key, value in offer.items() if key != "album"})
    write_json(OFFERS_PATH, offers)
    chat_id = offer["chatId"]
    message = await save_chat_message(
        chat_id,
        ChatMessageCreate(
            sender_id=offer["buyerId"],
            sender_name=offer["buyerName"],
            recipient_id=offer["sellerId"],
            recipient_name=offer["sellerName"],
            listing_id=payload.listingId,
            content=f"가격 제안 {offer['offerPrice']:,}원을 보냈습니다.",
            message_type="offer",
        ),
    )
    await chat_manager.broadcast(chat_id, {"type": "message", "chatId": chat_id, "message": message})
    return {"status": "ok", "persisted": True, "offer": offer}


@router.get("/users/{user_id}/offers/received")
async def get_received_offers(user_id: str):
    offers = [normalize_offer(item) for item in read_json(OFFERS_PATH, [])]
    return {"offers": [offer for offer in offers if offer["sellerId"] == user_id and offer["buyerId"] != user_id and offer["album"] is not None]}


@router.patch("/offers/{offer_id}")
async def update_offer_status(offer_id: str, payload: OfferStatusUpdate):
    status = payload.status if payload.status in {"pending", "accepted", "rejected"} else ""
    if not status:
        raise HTTPException(status_code=400, detail="상태값을 확인해 주세요.")
    offers = read_json(OFFERS_PATH, [])
    updated: dict[str, Any] | None = None
    stored_offer: dict[str, Any] | None = None
    updated_at = now_iso()
    for offer in offers:
        if str(offer.get("id")) == offer_id:
            offer["status"] = status
            offer["updatedAt"] = updated_at
            stored_offer = offer
            updated = normalize_offer(offer)
            break
    if not updated:
        raise HTTPException(status_code=404, detail="가격 제안을 찾을 수 없습니다.")

    if status == "accepted" and updated["offerType"] == "listing":
        listings = read_list(LISTINGS_PATH)
        listing = find_raw_listing(updated["listingId"], listings)
        if not listing or listing not in listings:
            raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
        current_status = str(listing.get("status") or "published").lower()
        if current_status in {"hidden", "sold", "deleted"}:
            raise HTTPException(status_code=400, detail="판매 가능한 상태가 아닙니다.")
        reserved_buyer_id = str(listing.get("buyer_id") or listing.get("buyerId") or "")
        if current_status == "reserved" and reserved_buyer_id and reserved_buyer_id != updated["buyerId"]:
            raise HTTPException(status_code=400, detail="이미 다른 거래가 진행 중인 판매글입니다.")
        listing["status"] = "reserved"
        listing["reserved_at"] = updated_at
        listing["buyer_id"] = updated["buyerId"]
        listing["accepted_offer_id"] = updated["id"]
        listing["sold_price"] = updated["offerPrice"]
        listing["updated_at"] = updated_at
        recalculate_listing_market(listing, listings)
        compact_listing_in_place(listing)
        write_listings(listings)
        for offer in offers:
            if str(offer.get("id")) != offer_id and str(offer.get("listingId") or offer.get("listing_id")) == updated["listingId"] and str(offer.get("status") or "pending") == "pending":
                offer["status"] = "rejected"
                offer["updatedAt"] = updated_at
        if stored_offer is not None:
            updated = normalize_offer(stored_offer)

    write_json(OFFERS_PATH, offers)
    chat_id = updated["chatId"]
    message = await save_chat_message(
        chat_id,
        ChatMessageCreate(
            sender_id=updated["sellerId"],
            sender_name=updated["sellerName"] or "판매자",
            recipient_id=updated["buyerId"],
            recipient_name=updated["buyerName"],
            listing_id=updated["listingId"],
            content="가격 제안을 수락했습니다." if status == "accepted" else "가격 제안을 거절했습니다.",
            message_type="offer",
        ),
    )
    await chat_manager.broadcast(chat_id, {"type": "message", "chatId": chat_id, "message": message})
    return {"status": "ok", "offer": updated}


@router.get("/users/{user_id}/chat-requests")
async def get_user_chat_requests(user_id: str):
    grouped: dict[str, list[dict[str, Any]]] = {}
    chats = read_json(CHATS_PATH, {})
    if isinstance(chats, dict):
        for chat_id, room in chats.items():
            if not isinstance(room, list) or not room:
                continue
            normalized = [normalize_chat_message(str(chat_id), item) for item in room]
            for message in normalized:
                if message["senderId"] != user_id and message["recipientId"] != user_id:
                    continue
                participant_id = message["recipientId"] if message["senderId"] == user_id else message["senderId"]
                if not participant_id or participant_id == user_id:
                    continue
                listing_id = message["listingId"] or listing_id_from_chat_id(str(chat_id))
                canonical_id = make_one_to_one_chat_id(listing_id, user_id, participant_id)
                grouped.setdefault(canonical_id, []).append(message)

    requests: list[dict[str, Any]] = []
    for canonical_id, visible in grouped.items():
        visible.sort(key=lambda message: message["timestamp"])
        last = visible[-1]
        if last["senderId"] == user_id:
            participant_id = last["recipientId"]
            participant_name = last["recipientName"]
        else:
            participant_id = last["senderId"]
            participant_name = last["senderName"]
        listing_id = last["listingId"] or listing_id_from_chat_id(canonical_id)
        if participant_id:
            album = offer_album_for_listing(listing_id)
            requests.append({
                "id": canonical_id,
                "chatId": canonical_id,
                "listingId": listing_id,
                "album": album,
                "participantId": participant_id,
                "participantName": participant_name or participant_id or "사용자",
                "lastMessage": last["message"],
                "lastMessageType": last["type"],
                "timestamp": last["timestamp"],
                "isUnread": last["recipientId"] == user_id and last["senderId"] != user_id,
            })
    requests.sort(key=lambda item: item["timestamp"], reverse=True)
    return {"requests": requests[:50]}


def notification_read_ids(user_id: str) -> set[str]:
    reads = read_json(NOTIFICATION_READS_PATH, {})
    values = reads.get(user_id, []) if isinstance(reads, dict) else []
    return {str(value) for value in values}


def save_notification_read_ids(user_id: str, notification_ids: set[str]) -> None:
    reads = read_json(NOTIFICATION_READS_PATH, {})
    if not isinstance(reads, dict):
        reads = {}
    reads[user_id] = sorted(notification_ids)
    write_json(NOTIFICATION_READS_PATH, reads)


def notification_dismissed_ids(user_id: str) -> set[str]:
    dismisses = read_json(NOTIFICATION_DISMISSES_PATH, {})
    values = dismisses.get(user_id, []) if isinstance(dismisses, dict) else []
    return {str(value) for value in values}


def save_notification_dismissed_ids(user_id: str, notification_ids: set[str]) -> None:
    dismisses = read_json(NOTIFICATION_DISMISSES_PATH, {})
    if not isinstance(dismisses, dict):
        dismisses = {}
    dismisses[user_id] = sorted(notification_ids)
    write_json(NOTIFICATION_DISMISSES_PATH, dismisses)


MAX_DYNAMIC_NOTIFICATION_SCAN = 80


def collect_user_notifications(user_id: str, *, limit: int = 50) -> list[dict[str, Any]]:
    notifications: list[dict[str, Any]] = [
        dict(item)
        for item in read_list(NOTIFICATIONS_PATH)
        if str(item.get("userId") or item.get("user_id") or "") == user_id
    ]
    raw_offers = read_json(OFFERS_PATH, [])
    offer_items = raw_offers[:MAX_DYNAMIC_NOTIFICATION_SCAN] if isinstance(raw_offers, list) else []
    for offer in [normalize_offer(item) for item in offer_items]:
        if offer["sellerId"] == user_id and offer["buyerId"] != user_id:
            notifications.append({
                "id": f"offer-{offer['id']}",
                "type": "offer",
                "title": "새 가격 제안",
                "message": f"{offer['buyerName']}님이 {offer['album']['title'] if offer['album'] else '판매글'}에 {offer['offerPrice']:,}원을 제안했습니다.",
                "timestamp": offer["timestamp"],
                "isRead": False,
                "link": "/transaction/offers/received",
            })
    chats = read_json(CHATS_PATH, {})
    if isinstance(chats, dict):
        for chat_id, room in chats.items():
            if not isinstance(room, list):
                continue
            for raw in reversed(room[-MAX_DYNAMIC_NOTIFICATION_SCAN:]):
                message = normalize_chat_message(str(chat_id), raw)
                if message["recipientId"] == user_id and message["senderId"] != user_id:
                    notifications.append({
                        "id": f"chat-{message['id']}",
                        "type": "chat",
                        "title": "새 채팅",
                        "message": f"{message['senderName']}: {message['message']}",
                        "timestamp": message["timestamp"],
                        "isRead": False,
                        "link": f"/transaction/chat/{chat_id}?listingId={message['listingId'] or listing_id_from_chat_id(str(chat_id))}&recipientId={message['senderId']}&recipientName={message['senderName']}",
                    })
                    break
    unique = {str(item.get("id")): item for item in notifications}
    notifications = list(unique.values())
    dismissed_ids = notification_dismissed_ids(user_id)
    notifications = [item for item in notifications if str(item.get("id")) not in dismissed_ids]
    read_ids = notification_read_ids(user_id)
    for notification in notifications:
        notification["isRead"] = bool(notification.get("isRead") or str(notification.get("id")) in read_ids)
    notifications.sort(key=lambda item: item["timestamp"], reverse=True)
    return notifications[:limit]


@router.get("/users/me/notifications")
async def get_current_user_notifications(user_id: Annotated[str, Depends(require_user_id)]):
    return {"notifications": collect_user_notifications(user_id)}


@router.get("/users/{profile_user_id}/notifications")
async def get_user_notifications(profile_user_id: str, user_id: Annotated[str, Depends(require_user_id)]):
    if profile_user_id != user_id:
        raise HTTPException(status_code=403, detail="다른 사용자의 알림은 볼 수 없습니다.")
    return {"notifications": collect_user_notifications(user_id)}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user_id: Annotated[str, Depends(require_user_id)]):
    notifications = collect_user_notifications(user_id)
    if not any(str(item.get("id")) == notification_id for item in notifications):
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    read_ids = notification_read_ids(user_id)
    read_ids.add(notification_id)
    save_notification_read_ids(user_id, read_ids)
    return {"ok": True, "notificationId": notification_id}


@router.delete("/notifications/{notification_id}")
async def dismiss_notification(notification_id: str, user_id: Annotated[str, Depends(require_user_id)]):
    notifications = collect_user_notifications(user_id)
    if not any(str(item.get("id")) == notification_id for item in notifications):
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    dismissed_ids = notification_dismissed_ids(user_id)
    dismissed_ids.add(notification_id)
    save_notification_dismissed_ids(user_id, dismissed_ids)
    read_ids = notification_read_ids(user_id)
    if notification_id in read_ids:
        read_ids.remove(notification_id)
        save_notification_read_ids(user_id, read_ids)
    unread_count = sum(1 for item in collect_user_notifications(user_id) if not item.get("isRead"))
    return {"ok": True, "notificationId": notification_id, "unreadCount": unread_count}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(user_id: Annotated[str, Depends(require_user_id)]):
    read_ids = notification_read_ids(user_id)
    read_ids.update(str(item.get("id")) for item in collect_user_notifications(user_id))
    save_notification_read_ids(user_id, read_ids)
    return {"ok": True, "unreadCount": 0}


@router.get("/notifications/unread-count")
async def get_unread_notification_count(user_id: Annotated[str, Depends(require_user_id)]):
    count = sum(1 for item in collect_user_notifications(user_id) if not item.get("isRead"))
    return {"unreadCount": count}


@router.get("/listings/{listing_id}/comments")
async def list_comments(listing_id: str):
    comments = read_json(COMMENTS_PATH, [])
    return [
        {
            "id": str(comment.get("id")),
            "listingId": str(comment.get("listingId") or comment.get("listing_id") or listing_id),
            "userId": str(comment.get("userId") or comment.get("user_id") or "guest"),
            "userName": str(comment.get("userName") or comment.get("user_name") or "게스트"),
            "role": str(comment.get("role") or "buyer"),
            "content": str(comment.get("content") or ""),
            "timestamp": str(comment.get("timestamp") or comment.get("created_at") or now_iso()),
            "parentId": comment.get("parentId") or comment.get("parent_id"),
        }
        for comment in comments
        if str(comment.get("listingId") or comment.get("listing_id")) == listing_id
    ]


@router.post("/listings/{listing_id}/comments")
async def create_comment(listing_id: str, payload: CommentCreate):
    content = payload.content.strip()
    role = payload.role if payload.role in {"buyer", "seller"} else "buyer"
    if not content:
        raise HTTPException(status_code=400, detail="댓글 내용을 입력해 주세요.")

    comments = read_json(COMMENTS_PATH, [])
    comment = {
        "id": f"comment-{uuid4().hex[:10]}",
        "listingId": listing_id,
        "userId": payload.userId or "guest",
        "userName": payload.userName or "게스트",
        "role": role,
        "content": content,
        "timestamp": now_iso(),
        "parentId": payload.parentId,
    }
    comments.insert(0, comment)
    write_json(COMMENTS_PATH, comments)
    return {"status": "ok", "persisted": True, "comment": comment}


def surface_condition_from_image(content: bytes, content_type: str | None) -> dict[str, Any] | None:
    return analyze_record_surface_image(content, content_type)


def fallback_surface(content: bytes, media_type: str) -> dict[str, Any]:
    return {
        "isRecord": True,
        "analysisAvailable": False,
        "analysisUnavailableReason": "서버가 표면 이미지를 정밀 판독하지 못했습니다.",
        "confidence": 0,
        "signals": [
            "표면 정밀 분석이 완료되지 않아 점수와 등급을 표시하지 않습니다.",
        ],
        "source": "fallback",
        "persisted": False,
        "surfaceScore": 0,
        "surfaceGrade": None,
        "scratchCount": 0,
        "scratchRisk": None,
        "reflectionRisk": None,
        "scratchRegions": [],
        "scratchDetails": {
            "displayedRegions": 0,
            "highSeverity": 0,
            "mediumSeverity": 0,
            "lowSeverity": 0,
            "reflectionRatio": None,
            "blurVariance": None,
            "exposure": None,
            "detectedDisc": False,
        },
        "dustOrReflectionNote": "분석 불가 상태입니다. 실제 판매 전에는 밝은 환경에서 정면 사진을 다시 촬영해 주세요.",
        "playbackImpact": None,
    }


@router.post("/analysis/lp-recognition")
async def analyze_lp_recognition(file: Annotated[UploadFile, File()], media_type: Annotated[str, Form()] = "image"):
    content = await file.read()
    if media_type == "image":
        try:
            result = surface_condition_from_image(content, file.content_type)
        except Exception as exc:
            logger.warning("lp-recognition opencv fallback: %s", exc)
            result = None
        if result:
            return result
    return fallback_surface(content, "video" if media_type == "video" else "image")


@router.post("/analysis/jacket-condition")
async def analyze_jacket_condition(file: Annotated[UploadFile, File()]):
    content = await file.read()
    image = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return {
            "jacketScore": 70,
            "jacketGrade": "VG",
            "cornerWear": "medium",
            "ringWear": "medium",
            "stainRisk": "medium",
            "tearOrCreaseRisk": "medium",
            "jacketDetails": {
                "edgeDensity": None,
                "stainRatio": None,
                "creaseCount": None,
                "ringWearDetected": False,
            },
            "notes": ["자켓 이미지를 읽지 못해 보수적인 점수를 적용했습니다."],
        }
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    min_side = min(height, width)
    edge = max(12, int(min_side * 0.08))
    edge_mask = np.zeros((height, width), dtype=np.uint8)
    edge_mask[:edge, :] = 255
    edge_mask[-edge:, :] = 255
    edge_mask[:, :edge] = 255
    edge_mask[:, -edge:] = 255
    edges = cv2.Canny(gray, 55, 150)
    edge_density = float(np.count_nonzero(cv2.bitwise_and(edges, edges, mask=edge_mask))) / float(max(1, np.count_nonzero(edge_mask)))
    corner_wear = risk_label(edge_density, 0.10, 0.18)
    stain_ratio = float(np.count_nonzero(cv2.inRange(hsv, np.array([0, 0, 35]), np.array([179, 75, 145])))) / float(height * width)
    stain_risk = risk_label(stain_ratio, 0.10, 0.22)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=70, minLineLength=max(45, min_side // 5), maxLineGap=10)
    crease_count = 0 if lines is None else len(lines)
    tear_or_crease_risk = "high" if crease_count >= 10 else "medium" if crease_count >= 4 else "low"
    ring_wear = "medium" if cv2.HoughCircles(cv2.medianBlur(gray, 5), cv2.HOUGH_GRADIENT, 1.25, max(80, min_side // 2), param1=80, param2=24, minRadius=int(min_side * 0.23), maxRadius=int(min_side * 0.48)) is not None else "low"
    penalty = {"low": 0, "medium": 7, "high": 15}
    score = int(max(55, min(94, 94 - penalty[corner_wear] - penalty[ring_wear] - penalty[stain_risk] - penalty[tear_or_crease_risk])))
    return {
        "jacketScore": score,
        "jacketGrade": grade_from_score(score),
        "cornerWear": corner_wear,
        "ringWear": ring_wear,
        "stainRisk": stain_risk,
        "tearOrCreaseRisk": tear_or_crease_risk,
        "jacketDetails": {
            "edgeDensity": round(edge_density, 4),
            "stainRatio": round(stain_ratio, 4),
            "creaseCount": int(crease_count),
            "ringWearDetected": ring_wear != "low",
        },
        "notes": [
            "모서리 마모와 테두리 손상 후보를 확인했습니다.",
            "링웨어, 얼룩/변색, 접힘/찢김 위험도를 판매 설명용으로 요약했습니다.",
        ],
    }


def audio_db_from_amplitude(value: float) -> float:
    return float(20 * np.log10(max(float(value), 1e-12)))


def audio_db_from_power(value: float) -> float:
    return float(10 * np.log10(max(float(value), 1e-12)))


def worst_risk(values: list[str | None]) -> str:
    risks = {value for value in values if value}
    if "high" in risks:
        return "high"
    if "medium" in risks:
        return "medium"
    return "low"


def average_sample_metric(samples: list[dict[str, Any]], key: str) -> float | None:
    values = [float(sample[key]) for sample in samples if sample.get(key) is not None]
    return round(float(np.mean(values)), 2) if values else None


def environment_score_from_audio(
    ambient_noise_floor_db: float | None,
    clipping_risk: str,
    channel_imbalance_db: float | None,
) -> int:
    ambient_penalty = 18.0 if ambient_noise_floor_db is None else min(28.0, max(0.0, (ambient_noise_floor_db + 58) * 1.0))
    clipping_penalty = 12.0 if clipping_risk == "high" else 4.0 if clipping_risk == "medium" else 0.0
    imbalance_penalty = min(10.0, max(0.0, ((channel_imbalance_db or 0.0) - 3.0) * 1.8))
    return int(max(38, min(98, round(98 - ambient_penalty - clipping_penalty - imbalance_penalty))))


AUDIO_PROBLEM_FREQUENCY_RANGE_HZ = {"min": 4000, "max": 12000}
MIN_AUDIO_ANALYSIS_SECONDS = 60
AUDIO_CLICK_SCORE_MULTIPLIER = 300.0


def audio_score_from_clicks(click_count: int, duration_seconds: float) -> int:
    score = 100.0 - (AUDIO_CLICK_SCORE_MULTIPLIER * (float(click_count) / max(float(duration_seconds), 1.0)))
    return int(max(0, min(100, round(score))))


def summarize_spectral_issue_frames(issue_frames: np.ndarray, frame_seconds: float) -> tuple[int, float]:
    max_gap_frames = max(1, int(round(0.12 / max(frame_seconds, 0.001))))
    issue_count = 0
    issue_frame_count = 0
    inside_issue = False
    gap_frames = 0

    for flag in issue_frames.astype(bool):
        if flag:
            issue_frame_count += 1
            if not inside_issue:
                issue_count += 1
                inside_issue = True
            gap_frames = 0
            continue
        if inside_issue:
            gap_frames += 1
            if gap_frames > max_gap_frames:
                inside_issue = False
                gap_frames = 0

    return issue_count, issue_frame_count * frame_seconds


def analyze_audio_bytes(content: bytes, filename: str | None, label: str, ambient_noise_floor_db: float | None = None) -> dict[str, Any]:
    import librosa

    suffix = os.path.splitext(filename or "")[1] or ".webm"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        waveform, sr = librosa.load(temp_path, sr=44100, mono=False)
        channel_rms_values: list[float] = []
        if waveform.ndim == 1:
            channel_rms_values.append(float(np.sqrt(np.mean(np.square(waveform)))))
            mono = waveform.astype(np.float32)
        else:
            for channel in waveform:
                channel_rms_values.append(float(np.sqrt(np.mean(np.square(channel)))))
            mono = np.mean(waveform, axis=0).astype(np.float32)
        if mono.size < sr:
            raise ValueError("audio sample is too short")
        mono = mono - float(np.mean(mono))
        duration = float(mono.size / sr)
        peak = float(np.max(np.abs(mono)) + 1e-12)
        rms = float(np.sqrt(np.mean(np.square(mono))) + 1e-12)
        channel_imbalance_db = 0.0
        if len(channel_rms_values) >= 2:
            channel_imbalance_db = abs(audio_db_from_amplitude(channel_rms_values[0]) - audio_db_from_amplitude(channel_rms_values[1]))
        clipping_ratio = float(np.mean(np.abs(mono) >= 0.98))
        frame_rms = librosa.feature.rms(y=mono, frame_length=2048, hop_length=512)[0]
        frame_rms_db = librosa.amplitude_to_db(frame_rms + 1e-9, ref=1.0)
        noise_floor_db = float(np.percentile(frame_rms_db, 15))
        dynamic_range_db = float(np.percentile(frame_rms_db, 90) - np.percentile(frame_rms_db, 15))
        diff = np.abs(np.diff(mono))
        local_rms = librosa.feature.rms(y=mono, frame_length=1024, hop_length=256)[0]
        frame_positions = librosa.frames_to_samples(np.arange(local_rms.size), hop_length=256)
        median_diff = float(np.median(diff))
        mad_diff = float(np.median(np.abs(diff - median_diff)) + 1e-9)
        transient_floor = median_diff + 14.0 * mad_diff
        percentile_floor = float(np.percentile(diff, 99.93))
        threshold = max(transient_floor, percentile_floor, rms * 5.6)
        raw_clicks = np.flatnonzero(diff > threshold)
        separated: list[int] = []
        min_gap = int(sr * 0.045)
        for index in raw_clicks:
            local_rms_at_index = float(np.interp(index, frame_positions, local_rms)) if local_rms.size else rms
            window = mono[max(0, int(index) - 18):min(mono.size, int(index) + 19)]
            local_peak = float(np.max(np.abs(window))) if window.size else 0.0
            if local_peak < max(0.065, local_rms_at_index * 3.7):
                continue
            if not separated or int(index) - separated[-1] >= min_gap:
                separated.append(int(index))
        click_count = len(separated)
        clicks_per_minute = click_count / max(duration, 1.0) * 60
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(mono, frame_length=2048, hop_length=512)))
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=mono)))
        stft_hop = 1024
        spectrum = np.abs(librosa.stft(mono, n_fft=4096, hop_length=stft_hop)) ** 2
        freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
        problem_max_hz = min(float(AUDIO_PROBLEM_FREQUENCY_RANGE_HZ["max"]), sr / 2)
        problem_band = (freqs >= float(AUDIO_PROBLEM_FREQUENCY_RANGE_HZ["min"])) & (freqs <= problem_max_hz)
        if not np.any(problem_band):
            problem_band = freqs >= min(4000.0, sr / 2)
        frame_power = np.sum(spectrum, axis=0) + 1e-12
        problem_band_power = np.sum(spectrum[problem_band, :], axis=0) + 1e-12
        problem_ratio_by_frame = problem_band_power / frame_power
        total_power = float(np.sum(spectrum) + 1e-12)
        high_frequency_noise = float(np.sum(problem_band_power) / total_power)
        spectral_baseline = float(np.median(problem_ratio_by_frame))
        spectral_mad = float(np.median(np.abs(problem_ratio_by_frame - spectral_baseline)) + 1e-9)
        spectral_threshold = max(0.24, spectral_baseline + spectral_mad * 3.8)
        problem_band_power_db = 10 * np.log10(problem_band_power)
        issue_frames = (problem_ratio_by_frame >= spectral_threshold) & (problem_band_power_db >= np.percentile(problem_band_power_db, 70))
        if label == "ambient":
            issue_frames = np.zeros_like(issue_frames, dtype=bool)
        spectral_issue_count, spectral_issue_duration_seconds = summarize_spectral_issue_frames(issue_frames, stft_hop / sr)
        spectral_issue_rate = spectral_issue_count / max(duration, 1.0) * 60
        spectral_issue_duration_ratio = spectral_issue_duration_seconds / max(duration, 1.0)
        spectral_count_penalty = min(14.0, spectral_issue_rate * 0.45)
        spectral_duration_penalty = min(4.0, spectral_issue_duration_ratio * 12)
        spectral_penalty = spectral_count_penalty + spectral_duration_penalty
        adjusted_noise_floor_db = noise_floor_db
        if ambient_noise_floor_db is not None:
            # Convert dB floors to linear power and subtract the measured room/microphone baseline.
            sample_power = 10 ** (noise_floor_db / 10)
            ambient_power = 10 ** (ambient_noise_floor_db / 10)
            adjusted_power = max(sample_power - ambient_power * 0.9, 1e-9)
            adjusted_noise_floor_db = float(10 * np.log10(adjusted_power))
        confidence = 88.0
        if duration < 6:
            confidence -= 18
        elif duration < 12:
            confidence -= 8
        if ambient_noise_floor_db is None and label != "ambient":
            confidence -= 10
        if clipping_ratio >= 0.012:
            confidence -= 8
        if channel_imbalance_db >= 5:
            confidence -= 4

        score = 0 if label == "ambient" else audio_score_from_clicks(click_count, duration)
        clipping_risk = "high" if clipping_ratio >= 0.018 else "medium" if clipping_ratio >= 0.004 else "low"
        return {
            "filename": filename or "audio-sample",
            "requestedSeconds": 5 if label == "ambient" else MIN_AUDIO_ANALYSIS_SECONDS,
            "durationSeconds": round(duration, 1),
            "score": score,
            "estimatedNoiseLevel": None,
            "scratchRisk": None,
            "usableForListingSample": label == "good" and score >= 70,
            "clickCount": click_count,
            "clicksPerMinute": round(clicks_per_minute, 1),
            "noiseFloorDb": round(noise_floor_db, 1),
            "adjustedNoiseFloorDb": round(adjusted_noise_floor_db, 1),
            "dynamicRangeDb": round(dynamic_range_db, 1),
            "analysisConfidence": int(max(20, min(96, round(confidence)))),
            "peakDb": round(audio_db_from_amplitude(peak), 1),
            "rmsDb": round(audio_db_from_amplitude(rms), 1),
            "clippingRisk": None,
            "clippingRatio": round(clipping_ratio, 4),
            "channelImbalanceDb": round(channel_imbalance_db, 1),
            "transientDensity": round(clicks_per_minute / 60, 3),
            "highFrequencyNoise": round(high_frequency_noise, 3),
            "spectralIssueCount": int(spectral_issue_count),
            "spectralIssueDurationSeconds": round(float(spectral_issue_duration_seconds), 2),
            "spectralIssueRate": round(float(spectral_issue_rate), 1),
            "spectralIssueDurationRatio": round(float(spectral_issue_duration_ratio), 3),
            "spectralPenalty": round(float(spectral_penalty), 1),
            "problemFrequencyRangeHz": {"min": AUDIO_PROBLEM_FREQUENCY_RANGE_HZ["min"], "max": int(problem_max_hz)},
        }
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


async def read_audio_upload(file: UploadFile | None, label: str, ambient_noise_floor_db: float | None = None) -> dict[str, Any] | None:
    if not file:
        return None
    content = await file.read()
    if not content:
        return None
    return analyze_audio_bytes(content, file.filename, label, ambient_noise_floor_db)


@router.post("/analysis/audio-samples")
async def analyze_audio_samples(
    audio_sample: Annotated[UploadFile | None, File()] = None,
    good_sample: Annotated[UploadFile | None, File()] = None,
    noisy_sample: Annotated[UploadFile | None, File()] = None,
    ambient_sample: Annotated[UploadFile | None, File()] = None,
):
    try:
        ambient = await read_audio_upload(ambient_sample, "ambient")
        ambient_noise_floor = float(ambient["noiseFloorDb"]) if ambient and ambient.get("noiseFloorDb") is not None else None
        audio = await read_audio_upload(audio_sample, "sample", ambient_noise_floor)
        good = None if audio else await read_audio_upload(good_sample, "good", ambient_noise_floor)
        noisy = None if audio else await read_audio_upload(noisy_sample, "noisy", ambient_noise_floor)
    except Exception as exc:
        logger.warning("audio analysis fallback: %s", exc)
        return {
            "source": "fallback",
            "analysisAvailable": False,
            "analysisUnavailableReason": "오디오 파일을 직접 해석하지 못했습니다.",
            "audioScore": None,
            "audioGrade": None,
            "lpConditionScore": None,
            "lpConditionGrade": None,
            "environmentScore": None,
            "environmentGrade": None,
            "playbackRisk": None,
            "clickCount": None,
            "noiseFloorDb": None,
            "ambientNoiseFloorDb": None,
            "adjustedNoiseFloorDb": None,
            "dynamicRangeDb": None,
            "clippingRisk": None,
            "channelImbalanceDb": None,
            "highFrequencyNoise": None,
            "spectralIssueCount": None,
            "spectralIssueDurationSeconds": None,
            "spectralIssueRate": None,
            "spectralIssueDurationRatio": None,
            "spectralPenalty": None,
            "problemFrequencyRangeHz": None,
            "analysisConfidence": 0,
            "warnings": ["오디오 파일을 직접 해석하지 못해 분석 불가로 분리했습니다."],
            "audioSample": None,
            "goodSample": None,
            "noisySample": None,
            "ambientSample": None,
            "summary": "정밀 파형 해석이 불가능해 음질 점수와 등급을 표시하지 않습니다.",
        }

    samples = [sample for sample in ([audio] if audio else [good, noisy]) if sample]
    if not samples:
        return {
            "source": "librosa",
            "analysisAvailable": False,
            "analysisUnavailableReason": "음질 샘플 녹음이 없습니다.",
            "audioScore": None,
            "audioGrade": None,
            "lpConditionScore": None,
            "lpConditionGrade": None,
            "environmentScore": None,
            "environmentGrade": None,
            "playbackRisk": None,
            "clickCount": None,
            "noiseFloorDb": None,
            "ambientNoiseFloorDb": ambient_noise_floor,
            "adjustedNoiseFloorDb": None,
            "dynamicRangeDb": None,
            "clippingRisk": None,
            "channelImbalanceDb": None,
            "highFrequencyNoise": None,
            "spectralIssueCount": None,
            "spectralIssueDurationSeconds": None,
            "spectralIssueRate": None,
            "spectralIssueDurationRatio": None,
            "spectralPenalty": None,
            "problemFrequencyRangeHz": None,
            "analysisConfidence": 0,
            "warnings": ["음질 샘플 녹음이 필요합니다."],
            "audioSample": None,
            "goodSample": None,
            "noisySample": None,
            "ambientSample": ambient,
            "summary": "음질 샘플 녹음이 필요합니다.",
        }

    total_duration = float(sum(float(sample.get("durationSeconds") or 0.0) for sample in samples))
    click_count = int(sum(int(sample.get("clickCount", 0)) for sample in samples))
    if total_duration < MIN_AUDIO_ANALYSIS_SECONDS:
        noise_values = [float(sample["noiseFloorDb"]) for sample in samples if sample.get("noiseFloorDb") is not None]
        dynamic_values = [float(sample["dynamicRangeDb"]) for sample in samples if sample.get("dynamicRangeDb") is not None]
        return {
            "source": "librosa",
            "analysisAvailable": False,
            "analysisUnavailableReason": f"음질 샘플은 최소 {MIN_AUDIO_ANALYSIS_SECONDS}초 이상 녹음해야 합니다.",
            "audioScore": None,
            "audioGrade": None,
            "lpConditionScore": None,
            "lpConditionGrade": None,
            "environmentScore": None,
            "environmentGrade": None,
            "playbackRisk": None,
            "clickCount": click_count,
            "noiseFloorDb": round(float(np.mean(noise_values)), 1) if noise_values else None,
            "ambientNoiseFloorDb": round(ambient_noise_floor, 1) if ambient_noise_floor is not None else None,
            "adjustedNoiseFloorDb": None,
            "dynamicRangeDb": round(float(np.mean(dynamic_values)), 1) if dynamic_values else None,
            "clippingRisk": None,
            "channelImbalanceDb": average_sample_metric(samples, "channelImbalanceDb"),
            "highFrequencyNoise": average_sample_metric(samples, "highFrequencyNoise"),
            "spectralIssueCount": int(sum(int(sample.get("spectralIssueCount") or 0) for sample in samples)),
            "spectralIssueDurationSeconds": round(float(sum(float(sample.get("spectralIssueDurationSeconds") or 0.0) for sample in samples)), 2),
            "spectralIssueRate": None,
            "spectralIssueDurationRatio": None,
            "spectralPenalty": average_sample_metric(samples, "spectralPenalty"),
            "problemFrequencyRangeHz": AUDIO_PROBLEM_FREQUENCY_RANGE_HZ,
            "analysisConfidence": 0,
            "warnings": [f"음질 샘플이 {round(total_duration, 1)}초라서 최소 {MIN_AUDIO_ANALYSIS_SECONDS}초 기준을 충족하지 못했습니다."],
            "audioSample": audio or samples[0],
            "goodSample": good,
            "noisySample": noisy,
            "ambientSample": ambient,
            "summary": f"음질 샘플은 최소 {MIN_AUDIO_ANALYSIS_SECONDS}초 이상 녹음해야 합니다.",
        }
    score = audio_score_from_clicks(click_count, total_duration)
    noise_values = [float(sample["noiseFloorDb"]) for sample in samples if sample.get("noiseFloorDb") is not None]
    adjusted_noise_values = [float(sample["adjustedNoiseFloorDb"]) for sample in samples if sample.get("adjustedNoiseFloorDb") is not None]
    dynamic_values = [float(sample["dynamicRangeDb"]) for sample in samples if sample.get("dynamicRangeDb") is not None]
    avg_noise = round(float(np.mean(noise_values)), 1) if noise_values else None
    avg_adjusted_noise = round(float(np.mean(adjusted_noise_values)), 1) if adjusted_noise_values else avg_noise
    avg_dynamic = round(float(np.mean(dynamic_values)), 1) if dynamic_values else None
    channel_imbalance_db = average_sample_metric(samples, "channelImbalanceDb")
    high_frequency_noise = average_sample_metric(samples, "highFrequencyNoise")
    transient_density = average_sample_metric(samples, "transientDensity")
    peak_db = average_sample_metric(samples, "peakDb")
    rms_db = average_sample_metric(samples, "rmsDb")
    spectral_issue_count = int(sum(int(sample.get("spectralIssueCount") or 0) for sample in samples))
    spectral_issue_duration_seconds = round(float(sum(float(sample.get("spectralIssueDurationSeconds") or 0.0) for sample in samples)), 2)
    spectral_total_duration = float(sum(float(sample.get("durationSeconds") or 0.0) for sample in samples))
    spectral_issue_rate = round(spectral_issue_count / spectral_total_duration * 60, 1) if spectral_total_duration > 0 else None
    spectral_issue_duration_ratio = round(spectral_issue_duration_seconds / spectral_total_duration, 3) if spectral_total_duration > 0 else None
    spectral_penalty = average_sample_metric(samples, "spectralPenalty")
    warnings: list[str] = []
    confidence_values = [int(sample.get("analysisConfidence", 70)) for sample in samples]
    analysis_confidence = int(max(20, min(96, round(float(np.mean(confidence_values)) if confidence_values else 50))))
    if ambient_noise_floor is not None:
        analysis_confidence = min(96, analysis_confidence + 8)
    if good and noisy:
        analysis_confidence = min(96, analysis_confidence + 4)
    return {
        "source": "librosa",
        "analysisAvailable": True,
        "audioScore": score,
        "audioGrade": grade_from_score(score),
        "lpConditionScore": score,
        "lpConditionGrade": grade_from_score(score),
        "environmentScore": None,
        "environmentGrade": None,
        "playbackRisk": None,
        "clickCount": click_count,
        "noiseFloorDb": avg_noise,
        "ambientNoiseFloorDb": round(ambient_noise_floor, 1) if ambient_noise_floor is not None else None,
        "adjustedNoiseFloorDb": avg_adjusted_noise,
        "dynamicRangeDb": avg_dynamic,
        "clippingRisk": None,
        "channelImbalanceDb": channel_imbalance_db,
        "highFrequencyNoise": high_frequency_noise,
        "transientDensity": transient_density,
        "spectralIssueCount": spectral_issue_count,
        "spectralIssueDurationSeconds": spectral_issue_duration_seconds,
        "spectralIssueRate": spectral_issue_rate,
        "spectralIssueDurationRatio": spectral_issue_duration_ratio,
        "spectralPenalty": spectral_penalty,
        "problemFrequencyRangeHz": AUDIO_PROBLEM_FREQUENCY_RANGE_HZ,
        "peakDb": peak_db,
        "rmsDb": rms_db,
        "analysisConfidence": analysis_confidence,
        "warnings": warnings,
        "audioSample": audio or samples[0],
        "goodSample": good,
        "noisySample": noisy,
        "ambientSample": ambient,
        "summary": f"음질 {grade_from_score(score)} 등급, {score}점입니다. 감점은 뚝소리 후보 횟수와 녹음 시간만 반영했습니다.",
    }


def discogs_candidate(result: dict[str, Any], catalog_number: str) -> dict[str, Any]:
    title_text = str(result.get("title") or "Unknown release")
    release_id = result.get("id")
    if " - " in title_text:
        artist, title = title_text.split(" - ", 1)
    else:
        artist, title = "Unknown artist", title_text
    labels = result.get("label") if isinstance(result.get("label"), list) else []
    formats = result.get("format") if isinstance(result.get("format"), list) else []
    return {
        "id": f"discogs-{release_id or uuid4().hex[:8]}",
        "releaseId": int(release_id or 0),
        "title": title,
        "artist": artist,
        "year": int(result.get("year") or 0),
        "label": str(labels[0]) if labels else "Unknown label",
        "catalogNumber": str(result.get("catno") or catalog_number),
        "country": str(result.get("country") or "Unknown"),
        "coverImageUrl": str(result.get("cover_image") or result.get("thumb") or ""),
        "pressing": " · ".join(str(value) for value in formats),
        "confidence": 88,
    }


async def discogs_result_with_cover(client: httpx.AsyncClient, result: dict[str, Any]) -> dict[str, Any]:
    if result.get("cover_image") or result.get("thumb") or not result.get("id"):
        return result
    try:
        response = await client.get(f"https://api.discogs.com/releases/{result['id']}")
        response.raise_for_status()
        images = response.json().get("images", [])
        if images:
            enriched = dict(result)
            enriched["cover_image"] = images[0].get("uri") or images[0].get("uri150") or ""
            return enriched
    except httpx.HTTPError as exc:
        logger.info("Discogs cover lookup failed for %s: %s", result.get("id"), exc)
    return result


@router.get("/discogs/albums")
async def search_discogs_albums(
    album_title: str | None = None,
    artist: str | None = None,
    page: int = 1,
    per_page: int = 10,
):
    title_query = (album_title or "").strip()
    artist_query = (artist or "").strip()
    if not title_query and not artist_query:
        return {
            "source": "discogs",
            "albums": [],
            "pagination": {"page": 1, "perPage": min(max(per_page, 1), 20), "pages": 0, "total": 0},
        }
    try:
        return await discogs_catalog_service.search_albums(
            title_query,
            artist_query,
            max(page, 1),
            min(max(per_page, 1), 20),
        )
    except httpx.HTTPError as exc:
        logger.warning("Discogs album lookup failed: %s", exc)
        raise HTTPException(status_code=502, detail="Discogs 앨범 검색에 실패했습니다. 잠시 후 다시 시도해 주세요.") from exc


@router.get("/discogs/masters/{master_id}/representative-versions")
async def get_discogs_representative_versions(master_id: int, refresh: bool = False):
    try:
        catalog = await discogs_catalog_service.get_version_catalog(master_id, refresh=refresh)
    except httpx.HTTPError as exc:
        logger.warning("Discogs master version lookup failed for %s: %s", master_id, exc)
        raise HTTPException(status_code=502, detail="Discogs LP 판본을 불러오지 못했습니다. 다시 시도해 주세요.") from exc
    total = len(catalog.representative) + len(catalog.remaining)
    return {
        "masterId": master_id,
        "representative": catalog.representative,
        "total": total,
        "remainingCount": len(catalog.remaining),
        "partial": catalog.partial,
    }


@router.get("/discogs/masters/{master_id}/versions")
async def get_discogs_master_versions(master_id: int, offset: int = 0, limit: int = 20):
    try:
        catalog = await discogs_catalog_service.get_version_catalog(master_id)
    except httpx.HTTPError as exc:
        logger.warning("Discogs master version page failed for %s: %s", master_id, exc)
        raise HTTPException(status_code=502, detail="Discogs LP 판본을 불러오지 못했습니다. 다시 시도해 주세요.") from exc
    safe_offset = max(offset, 0)
    safe_limit = min(max(limit, 1), 20)
    versions = catalog.remaining[safe_offset:safe_offset + safe_limit]
    next_offset = safe_offset + len(versions)
    return {
        "masterId": master_id,
        "versions": versions,
        "offset": safe_offset,
        "limit": safe_limit,
        "total": len(catalog.representative) + len(catalog.remaining),
        "remainingCount": max(0, len(catalog.remaining) - next_offset),
        "nextOffset": next_offset,
        "hasMore": next_offset < len(catalog.remaining),
        "partial": catalog.partial,
    }


@router.get("/discogs/search")
async def search_discogs(catalog_number: str | None = None, album_title: str | None = None, artist: str | None = None):
    query = (catalog_number or album_title or artist or "").strip()
    if not query:
        return {"source": "mock", "candidates": []}
    try:
        params = {"type": "release", "per_page": "8"}
        if catalog_number:
            params["catno"] = catalog_number
        else:
            params["q"] = " ".join(part for part in [artist, album_title] if part)
        async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "VinylCheck/0.1 +https://vinyl-check.local"}) as client:
            response = await client.get("https://api.discogs.com/database/search", params=params)
            response.raise_for_status()
            payload = response.json()
            results = await asyncio.gather(*(discogs_result_with_cover(client, item) for item in payload.get("results", [])[:5]))
        candidates = [discogs_candidate(item, query) for item in results]
        return {"source": "discogs", "candidates": candidates}
    except Exception as exc:
        logger.warning("Discogs lookup failed: %s", exc)
        return {"source": "mock", "candidates": []}


def discogs_headers() -> dict[str, str]:
    headers = {"User-Agent": "VinylCheck/0.1 +https://vinyl-check.local"}
    token = os.getenv("DISCOGS_TOKEN", "").strip().strip('"').strip("'")
    if token:
        headers["Authorization"] = f"Discogs token={token}"
    return headers


def parse_money(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(",", "").strip()
    cleaned = "".join(char for char in text if char.isdigit() or char in ".-")
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def currency_to_krw(value: float, currency: str | None) -> int:
    rates = {
        "KRW": 1.0,
        "USD": float(os.getenv("USD_KRW_RATE", "1350")),
        "EUR": float(os.getenv("EUR_KRW_RATE", "1460")),
        "GBP": float(os.getenv("GBP_KRW_RATE", "1710")),
        "JPY": float(os.getenv("JPY_KRW_RATE", "9.0")),
    }
    return int(round(value * rates.get((currency or "USD").upper(), rates["USD"])))


DISCOGS_CONDITION_ORDER = [
    "Mint (M)",
    "Near Mint (NM or M-)",
    "Excellent (EX)",
    "Very Good Plus (VG+)",
    "Very Good (VG)",
    "Good (G)",
    "Poor (P)",
]

DISCOGS_CONDITION_ALIASES = {
    "Good Plus (G+)": "Good (G)",
    "Fair (F)": "Poor (P)",
}


def app_condition(condition: Any) -> str:
    return DISCOGS_CONDITION_ALIASES.get(str(condition), str(condition))


def price_condition(surface_score: int | None, audio_score: int | None, scratch_risk: str | None, playback_risk: str | None) -> str:
    surface = int(surface_score or 0)
    audio = int(audio_score or 0)
    combined = int(round((surface or 72) * 0.45 + (audio or 72) * 0.55))
    if combined >= 96:
        return "Mint (M)"
    if combined >= 88:
        return "Near Mint (NM or M-)"
    if combined >= 80:
        return "Excellent (EX)"
    if combined >= 70:
        return "Very Good Plus (VG+)"
    if combined >= 58:
        return "Very Good (VG)"
    if combined >= 45:
        return "Good (G)"
    return "Poor (P)"


def quality_multiplier(
    surface_score: int | None,
    audio_score: int | None,
    scratch_risk: str | None,
    playback_risk: str | None,
) -> float:
    surface = int(surface_score or 72)
    audio = int(audio_score or 72)
    multiplier = 1.0
    if surface >= 88 and audio >= 86:
        multiplier += 0.05
    if surface < 58:
        multiplier -= 0.06
    if audio < 58:
        multiplier -= 0.06
    return max(0.62, min(1.08, multiplier))


async def find_discogs_release_id(catalog_number: str, title: str, artist: str) -> tuple[int | None, str]:
    params = {"type": "release", "per_page": "3"}
    if catalog_number:
        params["catno"] = catalog_number
    else:
        params["q"] = " ".join(part for part in [artist, title] if part)
    if not params.get("catno") and not params.get("q"):
        return None, ""
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.get("https://api.discogs.com/database/search", params=params, headers=discogs_headers())
        response.raise_for_status()
        results = response.json().get("results", [])
    if not results:
        return None, ""
    first = results[0]
    return int(first.get("id") or 0), str(first.get("title") or "")


def suggestion_entry_details(entry: Any) -> tuple[int | None, str, float | None]:
    if isinstance(entry, dict):
        amount = parse_money(entry.get("value") or entry.get("price") or entry.get("amount"))
        currency = str(entry.get("currency") or "USD")
    else:
        amount = parse_money(entry)
        currency = "USD"
    if amount is None:
        return None, currency, None
    return currency_to_krw(amount, currency), currency, amount


def suggestion_entry_to_krw(entry: Any) -> tuple[int | None, str]:
    price, currency, _ = suggestion_entry_details(entry)
    return price, currency


def discogs_condition_prices(suggestions: dict[str, Any]) -> list[dict[str, Any]]:
    prices: list[dict[str, Any]] = []
    collapsed: dict[str, Any] = {}
    for condition, entry in suggestions.items():
        app_key = app_condition(condition)
        if app_key not in collapsed or app_key == condition:
            collapsed[app_key] = entry
    for condition in DISCOGS_CONDITION_ORDER:
        if condition not in collapsed:
            continue
        price, currency, original_price = suggestion_entry_details(collapsed.get(condition))
        if price:
            prices.append({
                "condition": condition,
                "price": price,
                "currency": currency,
                "originalPrice": original_price,
            })
    for condition, entry in collapsed.items():
        if condition in DISCOGS_CONDITION_ORDER:
            continue
        price, currency, original_price = suggestion_entry_details(entry)
        if price:
            prices.append({
                "condition": str(condition),
                "price": price,
                "currency": currency,
                "originalPrice": original_price,
            })
    return prices


def closest_condition_entry(suggestions: dict[str, Any], condition: str) -> tuple[Any, str]:
    if condition in suggestions:
        return suggestions.get(condition), condition
    if not suggestions:
        return None, condition
    for source_condition, entry in suggestions.items():
        if app_condition(source_condition) == condition:
            return entry, condition
    target_index = DISCOGS_CONDITION_ORDER.index(condition) if condition in DISCOGS_CONDITION_ORDER else 3
    available = [item for item in DISCOGS_CONDITION_ORDER if any(app_condition(source) == item for source in suggestions)]
    if available:
        picked = min(available, key=lambda item: abs(DISCOGS_CONDITION_ORDER.index(item) - target_index))
        source = next(source for source in suggestions if app_condition(source) == picked)
        return suggestions.get(source), picked
    picked = next(iter(suggestions.keys()))
    return suggestions.get(picked), str(picked)


@router.get("/pricing/recommendation")
async def recommend_price(
    catalog_number: str | None = None,
    title: str | None = None,
    artist: str | None = None,
    release_id: int | None = None,
    surface_score: int | None = None,
    audio_score: int | None = None,
    scratch_risk: str | None = None,
    playback_risk: str | None = None,
):
    catalog = (catalog_number or "").strip()
    release_title = ""
    source = "local"
    condition = price_condition(surface_score, audio_score, scratch_risk, playback_risk)
    suggested_krw: int | None = None
    marketplace_low_krw: int | None = None
    num_for_sale: int | None = None
    currency = "KRW"
    condition_used = condition
    condition_prices: list[dict[str, Any]] = []
    price_suggestion_error: str | None = None

    try:
        if not release_id:
            release_id, release_title = await find_discogs_release_id(catalog, (title or "").strip(), (artist or "").strip())
        if release_id:
            source = "discogs"
            async with httpx.AsyncClient(timeout=9) as client:
                suggestions_response = await client.get(
                    f"https://api.discogs.com/marketplace/price_suggestions/{release_id}",
                    headers=discogs_headers(),
                )
                if suggestions_response.status_code == 200:
                    suggestions = suggestions_response.json()
                    condition_prices = discogs_condition_prices(suggestions if isinstance(suggestions, dict) else {})
                    entry, condition_used = closest_condition_entry(suggestions if isinstance(suggestions, dict) else {}, condition)
                    suggested_krw, currency = suggestion_entry_to_krw(entry)
                elif suggestions_response.status_code in {401, 403}:
                    price_suggestion_error = "Discogs 판매 이력 기반 가격은 인증 토큰이 필요하거나 현재 토큰 권한이 부족합니다."
                else:
                    price_suggestion_error = f"Discogs price_suggestions 응답 오류: HTTP {suggestions_response.status_code}"
                stats_response = await client.get(
                    f"https://api.discogs.com/marketplace/stats/{release_id}",
                    headers=discogs_headers(),
                )
                if stats_response.status_code == 200:
                    stats = stats_response.json()
                    lowest = stats.get("lowest_price")
                    if isinstance(lowest, dict):
                        amount = parse_money(lowest.get("value"))
                        marketplace_low_krw = currency_to_krw(amount, str(lowest.get("currency") or currency)) if amount is not None else None
                    else:
                        amount = parse_money(lowest)
                        marketplace_low_krw = currency_to_krw(amount, currency) if amount is not None else None
                    num_for_sale = int(stats.get("num_for_sale") or 0)
    except Exception as exc:
        logger.warning("Discogs price recommendation failed: %s", exc)
        price_suggestion_error = str(exc)

    if suggested_krw and marketplace_low_krw:
        base_price = int(round(suggested_krw * 0.78 + marketplace_low_krw * 0.22))
    elif suggested_krw:
        base_price = suggested_krw
    elif marketplace_low_krw:
        base_price = int(round(marketplace_low_krw * 0.96))
    else:
        normalized = catalog.lower()
        match = next((item for item in MOCK_LISTINGS if normalized and item["catalog_number"].lower() == normalized), None)
        base_price = int(match["price"] if match else 275000)
        source = "local"

    adjusted_price = int(round(base_price * quality_multiplier(surface_score, audio_score, scratch_risk, playback_risk) / 1000) * 1000)
    adjusted_price = max(1000, adjusted_price)
    sales_history_available = bool(suggested_krw or condition_prices)
    confidence = 92 if sales_history_available else 78 if marketplace_low_krw else 54
    if surface_score and audio_score:
        confidence += 4
    confidence = int(max(0, min(98, confidence)))
    release_url = f"https://www.discogs.com/release/{release_id}" if release_id else None
    return {
        "recommended_price": adjusted_price,
        "price_range": {
            "min": int(round(adjusted_price * 0.9 / 1000) * 1000),
            "max": int(round(adjusted_price * 1.12 / 1000) * 1000),
        },
        "source": source,
        "condition": condition,
        "release_id": release_id,
        "release_title": release_title,
        "currency": "KRW",
        "confidence": confidence,
        "discogs": {
            "suggestedPrice": suggested_krw,
            "marketplaceLow": marketplace_low_krw,
            "numForSale": num_for_sale,
            "inputCurrency": currency,
            "releaseUrl": release_url,
            "conditionUsed": condition_used,
            "salesHistoryAvailable": sales_history_available,
            "salesHistorySource": "Discogs marketplace price_suggestions" if sales_history_available else "Discogs marketplace stats",
            "priceSuggestionError": price_suggestion_error,
            "conditionPrices": condition_prices,
        },
        "reason": (
            f"Discogs 판매 이력 기반 가격표({condition_used})와 현재 최저가, 표면 {surface_score or '-'}점, 음질 {audio_score or '-'}점을 함께 반영했습니다."
            if sales_history_available
            else f"Discogs 판매 이력 가격표는 확인하지 못했지만 현재 판매 최저가와 표면 {surface_score or '-'}점, 음질 {audio_score or '-'}점을 함께 반영했습니다."
        )
        if source == "discogs"
        else "Discogs 가격 데이터를 가져오지 못해 로컬 시세와 상품 품질 점수를 기준으로 계산했습니다.",
    }


@router.get("/discogs/track-recommendations")
async def track_recommendations(catalog_number: str):
    catalog = catalog_number.strip()
    tracks = [
        {"position": "A1", "title": "첫 트랙 도입부", "duration": "", "durationSeconds": 180},
        {"position": "A2", "title": "중간 안정 구간", "duration": "", "durationSeconds": 220},
    ]
    return {
        "source": "mock",
        "releaseTitle": "Discogs 트랙리스트 확인 필요",
        "catalogNumber": catalog,
        "tracks": tracks,
        "good": {**tracks[1], "label": "good", "suggestedStart": "중간부", "recordSeconds": 20, "guide": "음악이 안정적으로 이어지는 20초를 녹음하세요."},
        "noisy": {**tracks[0], "label": "noisy", "suggestedStart": "시작부 0~15초", "recordSeconds": 15, "guide": "무음부, 도입부, 조용한 부분처럼 상태가 안 좋은 구간을 확인하세요."},
    }


@router.post("/uploads/images")
async def upload_image(file: Annotated[UploadFile, File()]):
    content = await file.read()
    encoded = base64.b64encode(content).decode("ascii")
    return {"url": f"data:{file.content_type or 'image/jpeg'};base64,{encoded}"}
