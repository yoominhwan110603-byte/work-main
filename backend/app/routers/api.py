import base64
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
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from ..schemas import (
    AddressApiKeyUpsert,
    AuthCheck,
    AuthLogin,
    AuthSignup,
    ChatMessageCreate,
    CommentCreate,
    EmailVerificationConfirm,
    EmailVerificationRequest,
    FindIdRequest,
    GoogleLogin,
    ListingCreate,
    ListingDraftUpsert,
    OfferCreate,
    OfferStatusUpdate,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileDraftUpsert,
    ReviewCreate,
    ReviewUpdate,
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
    if score >= 90:
        return "NM"
    if score >= 82:
        return "VG+"
    if score >= 72:
        return "VG"
    if score >= 62:
        return "G+"
    return "G"


def playback_impact(scratch_risk: str, reflection_risk: str) -> str:
    if scratch_risk == "high":
        return "높음"
    if scratch_risk == "medium" or reflection_risk == "high":
        return "주의"
    return "낮음"


MOCK_LISTINGS: list[dict[str, Any]] = []

ADDRESS_FALLBACKS: list[dict[str, str]] = []

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


RARITY_KEYWORDS = (
    "희귀",
    "rare",
    "초반",
    "first press",
    "firstpress",
    "오리지널",
    "original",
    "한정",
    "limited",
    "프로모",
    "promo",
    "테스트",
    "test pressing",
    "번호판",
    "numbered",
    "obi",
)


def clean_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    tags: list[str] = []
    for tag in value:
        text = str(tag).strip()
        if text:
            tags.append(text)
    return tags[:12]


def text_has_rarity_hint(value: str) -> bool:
    normalized = value.lower().replace("-", " ")
    return any(keyword in normalized for keyword in RARITY_KEYWORDS)


def listing_is_first_press(item: dict[str, Any], analysis_report: dict[str, Any] | None = None) -> bool:
    pressing = str(item.get("pressing") or (analysis_report or {}).get("pressing") or "")
    pressing_lower = pressing.lower()
    return bool(
        item.get("is_first_press")
        or item.get("isFirstPress")
        or "초반" in pressing
        or "first" in pressing_lower
    )


def listing_is_rare(item: dict[str, Any], tags: list[str] | None = None, analysis_report: dict[str, Any] | None = None) -> bool:
    if item.get("is_rare") or item.get("isRare") or item.get("is_first_press") or item.get("isFirstPress"):
        return True
    tag_text = " ".join(tags if tags is not None else clean_tags(item.get("tags")))
    pressing = str(item.get("pressing") or (analysis_report or {}).get("pressing") or "")
    return text_has_rarity_hint(f"{tag_text} {pressing}")


def listing_to_album(item: dict[str, Any]) -> dict[str, Any]:
    price = int(item.get("price") or 0)
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
    is_first_press = listing_is_first_press(item, analysis_report)
    is_rare = listing_is_rare(item, tags, analysis_report)
    return {
        "id": str(item.get("id") or stable_id("listing", json.dumps(item, ensure_ascii=False))),
        "title": item.get("title") or "Untitled",
        "artist": item.get("artist") or "Unknown artist",
        "year": int(item.get("year") or 0),
        "genre": item.get("genre") or "기타",
        "catalogNumber": item.get("catalog_number") or item.get("catalogNumber") or "",
        "price": price,
        "priceRange": {"min": int(price * 0.9), "max": int(price * 1.12)},
        "audioGrade": item.get("audio_grade") or item.get("audioGrade") or "VG",
        "audioScore": int(item.get("audio_score") or item.get("audioScore") or 0),
        "audioSamples": audio_samples if isinstance(audio_samples, dict) else {},
        "jacketGrade": item.get("jacket_grade") or item.get("jacketGrade") or "VG",
        "jacketScore": int(item.get("jacket_score") or item.get("jacketScore") or 0),
        "isRare": is_rare,
        "isFirstPress": is_first_press,
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
            "rating": float(seller.get("rating", 0) or 0),
            "transactionCount": int(seller.get("transactionCount", 0) or 0),
        },
        "location": item.get("location") or "서울",
        "views": int(item.get("views") or 0),
        "createdAt": item.get("created_at") or item.get("createdAt") or now_iso(),
        "status": item.get("status") or "published",
    }


def all_albums() -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for item in MOCK_LISTINGS:
        if str(item.get("status") or "published") != "hidden":
            merged[str(item.get("id") or stable_id("listing", json.dumps(item, ensure_ascii=False)))] = listing_to_album(item)
    for item in read_json(LISTINGS_PATH, []):
        if str(item.get("status") or "published") != "hidden":
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
    return {"token": stable_id("token", user["id"] + now_iso()), "user": public_user(user)}


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
    tokens[token_key] = {
        "type": "email-verification",
        "email": email,
        "code": code,
        "verified": False,
        "createdAt": now_iso(),
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }
    write_json(EMAIL_VERIFICATION_PATH, tokens)
    sent = send_mail(
        email,
        "[Vinyl-Check] 이메일 인증번호",
        f"Vinyl-Check 회원가입 이메일 인증번호입니다.\n\n{code}\n\n이 코드는 10분 후 만료됩니다.",
    )
    response = {"message": "인증번호를 이메일로 발송했습니다.", "sent": sent}
    if not sent:
        response["message"] = "메일 발송 설정이 없어 개발용 인증번호를 표시합니다."
        response["devVerificationCode"] = code
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
    return {"token": stable_id("token", user["id"] + now_iso()), "user": public_user(user)}


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
    return {"token": stable_id("token", user["id"] + now_iso()), "user": public_user(user)}


@router.post("/auth/find-id")
async def find_id(payload: FindIdRequest):
    email = normalize_email(payload.email)
    users = read_json(USERS_PATH, {})
    user = find_user_by_email(users, email)
    if not user:
        raise HTTPException(status_code=404, detail="해당 이메일로 가입된 계정을 찾지 못했습니다.")
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
    tokens[token_key] = {
        "type": "password-reset",
        "userId": user["id"],
        "email": email,
        "expiresAt": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "used": False,
    }
    write_json(RESET_TOKENS_PATH, tokens)
    mail_sent = send_mail(
        email,
        "[Vinyl-Check] 비밀번호 재설정 코드",
        f"아래 코드를 앱의 비밀번호 찾기 화면에 입력해 주세요.\n\n{reset_code}\n\n이 코드는 30분 후 만료됩니다.",
    )
    response = {
        "message": "가입된 이메일로 비밀번호 재설정 코드를 발송했습니다."
        if mail_sent
        else "메일 설정이 없어 앱 화면에 재설정 코드를 표시합니다."
    }
    if not mail_sent or os.getenv("ALLOW_DEV_RESET_CODE", "false").lower() in {"1", "true", "yes"}:
        response["devResetCode"] = reset_code
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
    if not isinstance(user_drafts, list):
        return {"deleted": False}
    next_drafts = [item for item in user_drafts if str(item.get("id")) != draft_id]
    drafts[user_id] = next_drafts
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
        return listings
    normalized = q.lower()
    return [item for item in listings if normalized in item["title"].lower() or normalized in item["artist"].lower()]


@router.post("/listings")
async def create_listing(payload: ListingCreate):
    listing = payload.model_dump()
    listing["tags"] = clean_tags(listing.get("tags"))
    listing["is_first_press"] = listing_is_first_press(listing, listing.get("analysis_report"))
    listing["is_rare"] = listing_is_rare(listing, listing["tags"], listing.get("analysis_report"))
    listing["id"] = f"listing-{uuid4().hex[:10]}"
    listing["seller_id"] = payload.user_id or "seller1"
    listing["created_at"] = now_iso()
    listing["views"] = 0
    listings = read_json(LISTINGS_PATH, [])
    listings.insert(0, listing)
    write_json(LISTINGS_PATH, listings)
    return {"status": "ok", "persisted": True, "listing": listing_to_album(listing)}


@router.put("/listings/{listing_id}")
async def update_listing(listing_id: str, payload: ListingCreate, user_id: str | None = None):
    listings = read_json(LISTINGS_PATH, [])
    updated: dict[str, Any] | None = None
    for listing in listings:
        if str(listing.get("id")) == listing_id:
            seller_id = str(listing.get("seller_id") or listing.get("user_id") or "")
            if user_id and seller_id and seller_id != user_id:
                raise HTTPException(status_code=403, detail="판매글을 수정할 권한이 없습니다.")
            listing.update(payload.model_dump())
            listing["tags"] = clean_tags(listing.get("tags"))
            listing["is_first_press"] = listing_is_first_press(listing, listing.get("analysis_report"))
            listing["is_rare"] = listing_is_rare(listing, listing["tags"], listing.get("analysis_report"))
            listing["id"] = listing_id
            listing["seller_id"] = seller_id or payload.user_id or "seller1"
            listing["updated_at"] = now_iso()
            updated = listing
            break
    if not updated:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    write_json(LISTINGS_PATH, listings)
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
    write_json(LISTINGS_PATH, listings)
    return {"status": "hidden", "listingId": listing_id}


def normalize_offer(payload: dict[str, Any]) -> dict[str, Any]:
    listing_id = str(payload.get("listingId") or payload.get("listing_id") or "")
    album = find_album(listing_id)
    buyer_id = str(payload.get("buyerId") or payload.get("buyer_id") or "guest")
    seller_id = str(payload.get("sellerId") or payload.get("seller_id") or "")
    return {
        "id": str(payload.get("id") or f"offer-{uuid4().hex[:10]}"),
        "listingId": listing_id,
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


@router.post("/offers")
async def create_offer(payload: OfferCreate):
    album = find_album(payload.listingId)
    if not album:
        raise HTTPException(status_code=404, detail="판매글을 찾을 수 없습니다.")
    if payload.offerPrice <= 0:
        raise HTTPException(status_code=400, detail="제안 금액을 확인해 주세요.")

    seller_id = str(album["seller"]["id"])
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
    return {"offers": [offer for offer in offers if offer["sellerId"] == user_id and offer["album"] is not None]}


@router.patch("/offers/{offer_id}")
async def update_offer_status(offer_id: str, payload: OfferStatusUpdate):
    status = payload.status if payload.status in {"pending", "accepted", "rejected"} else ""
    if not status:
        raise HTTPException(status_code=400, detail="상태값을 확인해 주세요.")
    offers = read_json(OFFERS_PATH, [])
    updated: dict[str, Any] | None = None
    for offer in offers:
        if str(offer.get("id")) == offer_id:
            offer["status"] = status
            offer["updatedAt"] = now_iso()
            updated = normalize_offer(offer)
            break
    if not updated:
        raise HTTPException(status_code=404, detail="가격 제안을 찾을 수 없습니다.")
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
                if not participant_id:
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
            album = find_album(listing_id)
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


@router.get("/users/{user_id}/notifications")
async def get_user_notifications(user_id: str):
    notifications: list[dict[str, Any]] = []
    for offer in [normalize_offer(item) for item in read_json(OFFERS_PATH, [])]:
        if offer["sellerId"] == user_id:
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
            for raw in reversed(room):
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
    notifications.sort(key=lambda item: item["timestamp"], reverse=True)
    return {"notifications": notifications[:50]}


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
    if not (content_type or "").lower().startswith("image/"):
        return None
    image = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return None
    height, width = image.shape[:2]
    if min(height, width) < 120:
        return None
    scale = min(1.0, 900 / max(height, width))
    if scale < 1.0:
        image = cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
        height, width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    min_side = min(height, width)
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    exposure = float(np.mean(hsv[:, :, 2]))
    reflection_mask = cv2.inRange(hsv, np.array([0, 0, 218]), np.array([179, 70, 255]))
    reflection_ratio = float(np.count_nonzero(reflection_mask)) / float(height * width)

    blurred = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=max(70, min_side // 3),
        param1=80,
        param2=22,
        minRadius=int(min_side * 0.14),
        maxRadius=int(min_side * 0.52),
    )
    disc_circle = None
    if circles is not None:
        candidates = np.round(circles[0]).astype(int).tolist()
        candidates.sort(key=lambda item: item[2], reverse=True)
        disc_circle = candidates[0]

    reflection_mask = cv2.dilate(reflection_mask, np.ones((5, 5), dtype=np.uint8), iterations=1)
    analysis_mask = np.ones((height, width), dtype=np.uint8) * 255
    if disc_circle:
        cx, cy, radius = disc_circle
        analysis_mask[:] = 0
        cv2.circle(analysis_mask, (cx, cy), max(1, radius - 10), 255, -1)
        cv2.circle(analysis_mask, (cx, cy), max(1, int(radius * 0.24)), 0, -1)
    analysis_mask = cv2.bitwise_and(analysis_mask, cv2.bitwise_not(reflection_mask))

    equalized = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    edges = cv2.Canny(equalized, 45, 125)
    edges = cv2.bitwise_and(edges, edges, mask=analysis_mask)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=42, minLineLength=max(38, min_side // 9), maxLineGap=7)
    scratch_count = 0
    scratch_regions: list[dict[str, Any]] = []
    if lines is not None:
        accepted: list[tuple[float, int, int, int, int]] = []
        for x1, y1, x2, y2 in lines[:, 0]:
            length = float(((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5)
            if length < min_side * 0.10:
                continue
            if analysis_mask[y1, x1] == 0 or analysis_mask[y2, x2] == 0:
                continue
            if disc_circle:
                cx, cy, _radius = disc_circle
                mx = (x1 + x2) / 2.0
                my = (y1 + y2) / 2.0
                radial_angle = np.arctan2(my - cy, mx - cx)
                line_angle = np.arctan2(y2 - y1, x2 - x1)
                tangent_delta = abs(((line_angle - radial_angle - np.pi / 2 + np.pi) % np.pi) - np.pi / 2)
                if tangent_delta < 0.18 and length < min_side * 0.22:
                    continue
            if any(abs(x1 - ax1) + abs(y1 - ay1) + abs(x2 - ax2) + abs(y2 - ay2) < min_side * 0.18 for _alen, ax1, ay1, ax2, ay2 in accepted):
                continue
            accepted.append((length, int(x1), int(y1), int(x2), int(y2)))
        accepted.sort(reverse=True)
        scratch_count = len(accepted)
        for length, x1, y1, x2, y2 in accepted[:14]:
            scratch_regions.append(
                {
                    "x1": round(x1 / width, 4),
                    "y1": round(y1 / height, 4),
                    "x2": round(x2 / width, 4),
                    "y2": round(y2 / height, 4),
                    "severity": "high" if length >= min_side * 0.34 else "medium" if length >= min_side * 0.20 else "low",
                }
            )

    scratch_risk = "high" if scratch_count >= 9 else "medium" if scratch_count >= 3 else "low"
    reflection_risk = risk_label(reflection_ratio, 0.025, 0.07)
    quality_penalty = 0
    if blur_variance < 45:
        quality_penalty += 10
    elif blur_variance < 90:
        quality_penalty += 5
    if exposure < 45 or exposure > 215:
        quality_penalty += 8
    elif exposure < 65 or exposure > 195:
        quality_penalty += 4

    surface_score = 88 - min(30, scratch_count * 3.2) - min(14, reflection_ratio * 180) - quality_penalty
    surface_score = int(max(42, min(90, round(surface_score))))
    confidence = int(max(45, min(92, surface_score + (4 if disc_circle else -6))))
    signals = [
        "LP 여부로 감정을 막지 않고, 판매 설명에 쓸 표면 상태를 계산했습니다.",
        f"스크래치 후보 {scratch_count}개, 반사 위험 {reflection_risk}로 집계했습니다.",
    ]
    if quality_penalty:
        signals.append("초점 흐림 또는 노출 문제가 있어 표면 점수를 보수적으로 낮췄습니다.")
    if scratch_regions:
        signals.append("표시된 스크래치 위치는 후보 영역이며 실제 먼지/반사와 함께 확인해야 합니다.")
    severity_counts = {
        "high": sum(1 for region in scratch_regions if region.get("severity") == "high"),
        "medium": sum(1 for region in scratch_regions if region.get("severity") == "medium"),
        "low": sum(1 for region in scratch_regions if region.get("severity") == "low"),
    }
    return {
        "isRecord": True,
        "confidence": confidence,
        "signals": signals,
        "source": "opencv",
        "persisted": False,
        "surfaceScore": surface_score,
        "scratchCount": scratch_count,
        "scratchRisk": scratch_risk,
        "reflectionRisk": reflection_risk,
        "scratchRegions": scratch_regions,
        "scratchDetails": {
            "displayedRegions": len(scratch_regions),
            "highSeverity": severity_counts["high"],
            "mediumSeverity": severity_counts["medium"],
            "lowSeverity": severity_counts["low"],
            "reflectionRatio": round(reflection_ratio, 4),
            "blurVariance": round(blur_variance, 1),
            "exposure": round(exposure, 1),
            "detectedDisc": bool(disc_circle),
        },
        "dustOrReflectionNote": "강한 조명 반사는 먼지나 스크래치처럼 보일 수 있어 각도를 바꾼 추가 촬영을 권장합니다.",
        "playbackImpact": playback_impact(scratch_risk, reflection_risk),
    }


def fallback_surface(content: bytes, media_type: str) -> dict[str, Any]:
    seed = int(hashlib.sha1(content[:200_000]).hexdigest()[:8], 16) if content else 0
    scratch_count = (seed % 8) + (2 if media_type == "video" else 0)
    reflection_bucket = (seed >> 4) % 4
    scratch_risk = "high" if scratch_count >= 9 else "medium" if scratch_count >= 3 else "low"
    reflection_risk = "high" if reflection_bucket >= 3 else "medium" if reflection_bucket else "low"
    surface_score = max(45, min(86, 84 - scratch_count * 3 - reflection_bucket * 5 - ((seed >> 8) % 7)))
    return {
        "isRecord": True,
        "confidence": min(90, surface_score + 3),
        "signals": [
            "서버가 이미지를 정밀 판독하지 못해 파일 특성 기반 보수 점수를 만들었습니다.",
            f"스크래치 후보 {scratch_count}개, 반사 위험 {reflection_risk}로 임시 집계했습니다.",
        ],
        "source": "fallback",
        "persisted": False,
        "surfaceScore": surface_score,
        "scratchCount": scratch_count,
        "scratchRisk": scratch_risk,
        "reflectionRisk": reflection_risk,
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
        "dustOrReflectionNote": "fallback 결과입니다. 실제 판매 전에는 밝은 환경에서 재촬영해 주세요.",
        "playbackImpact": playback_impact(scratch_risk, reflection_risk),
    }


@router.post("/analysis/lp-recognition")
async def analyze_lp_recognition(file: Annotated[UploadFile, File()], media_type: Annotated[str, Form()] = "image"):
    content = await file.read()
    if media_type == "image":
        result = surface_condition_from_image(content, file.content_type)
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


def analyze_audio_bytes(content: bytes, filename: str | None, label: str, ambient_noise_floor_db: float | None = None) -> dict[str, Any]:
    import librosa

    suffix = os.path.splitext(filename or "")[1] or ".webm"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name
        waveform, sr = librosa.load(temp_path, sr=22050, mono=False, duration=35)
        mono = waveform.astype(np.float32) if waveform.ndim == 1 else np.mean(waveform, axis=0).astype(np.float32)
        if mono.size < sr:
            raise ValueError("audio sample is too short")
        mono = mono - float(np.mean(mono))
        duration = float(mono.size / sr)
        peak = float(np.max(np.abs(mono)) + 1e-12)
        clipping_ratio = float(np.mean(np.abs(mono) >= 0.98))
        frame_rms = librosa.feature.rms(y=mono, frame_length=2048, hop_length=512)[0]
        frame_rms_db = librosa.amplitude_to_db(frame_rms + 1e-9, ref=1.0)
        noise_floor_db = float(np.percentile(frame_rms_db, 15))
        dynamic_range_db = float(np.percentile(frame_rms_db, 90) - np.percentile(frame_rms_db, 15))
        diff = np.abs(np.diff(mono))
        median_diff = float(np.median(diff))
        mad_diff = float(np.median(np.abs(diff - median_diff)) + 1e-9)
        transient_floor = median_diff + 10.0 * mad_diff
        percentile_floor = float(np.percentile(diff, 99.82))
        threshold = max(transient_floor, percentile_floor)
        raw_clicks = np.flatnonzero(diff > threshold)
        separated: list[int] = []
        min_gap = int(sr * 0.025)
        for index in raw_clicks:
            if not separated or int(index) - separated[-1] >= min_gap:
                separated.append(int(index))
        click_count = len(separated)
        clicks_per_minute = click_count / max(duration, 1.0) * 60
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(mono, frame_length=2048, hop_length=512)))
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=mono)))
        adjusted_noise_floor_db = noise_floor_db
        if ambient_noise_floor_db is not None:
            # Convert dB floors to linear power and subtract the measured room/microphone baseline.
            sample_power = 10 ** (noise_floor_db / 10)
            ambient_power = 10 ** (ambient_noise_floor_db / 10)
            adjusted_power = max(sample_power - ambient_power * 0.75, 1e-9)
            adjusted_noise_floor_db = float(10 * np.log10(adjusted_power))
        confidence = 88.0
        if duration < 8:
            confidence -= 22
        elif duration < 15:
            confidence -= 10
        if ambient_noise_floor_db is None and label != "ambient":
            confidence -= 16
        if clipping_ratio >= 0.01:
            confidence -= 12

        score = 94.0
        score -= min(24.0, clicks_per_minute * 0.95)
        score -= min(18.0, max(0.0, adjusted_noise_floor_db + 48) * 0.75)
        score -= min(12.0, clipping_ratio * 800)
        score -= max(0.0, 12 - dynamic_range_db) * 0.55
        score -= min(6.0, max(0.0, zcr - 0.18) * 30)
        score -= min(6.0, max(0.0, flatness - 0.08) * 45)
        if label == "noisy":
            score -= 2
        if label == "ambient":
            score = 0
        score = int(max(42, min(96, round(score))))
        scratch_risk = "high" if clicks_per_minute >= 16 else "medium" if clicks_per_minute >= 6 else "low"
        clipping_risk = "high" if clipping_ratio >= 0.01 else "medium" if clipping_ratio >= 0.002 else "low"
        return {
            "filename": filename or "audio-sample",
            "requestedSeconds": 30,
            "durationSeconds": round(duration, 1),
            "score": score,
            "estimatedNoiseLevel": "high" if noise_floor_db > -34 else "medium" if noise_floor_db > -46 else "low",
            "scratchRisk": scratch_risk,
            "usableForListingSample": label == "good" and score >= 78 and clipping_risk != "high",
            "clickCount": click_count,
            "clicksPerMinute": round(clicks_per_minute, 1),
            "noiseFloorDb": round(noise_floor_db, 1),
            "adjustedNoiseFloorDb": round(adjusted_noise_floor_db, 1),
            "dynamicRangeDb": round(dynamic_range_db, 1),
            "analysisConfidence": int(max(20, min(96, round(confidence)))),
            "peakDb": round(20 * np.log10(peak), 1),
            "clippingRisk": clipping_risk,
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
    good_sample: Annotated[UploadFile | None, File()] = None,
    noisy_sample: Annotated[UploadFile | None, File()] = None,
    ambient_sample: Annotated[UploadFile | None, File()] = None,
):
    try:
        ambient = await read_audio_upload(ambient_sample, "ambient")
        ambient_noise_floor = float(ambient["noiseFloorDb"]) if ambient and ambient.get("noiseFloorDb") is not None else None
        good = await read_audio_upload(good_sample, "good", ambient_noise_floor)
        noisy = await read_audio_upload(noisy_sample, "noisy", ambient_noise_floor)
    except Exception as exc:
        logger.warning("audio analysis fallback: %s", exc)
        seed = (getattr(good_sample, "size", 0) or 0) + (getattr(noisy_sample, "size", 0) or 0) + (getattr(ambient_sample, "size", 0) or 0)
        score = int(max(58, min(84, 78 - (seed % 13))))
        return {
            "source": "fallback",
            "audioScore": score,
            "audioGrade": grade_from_score(score),
            "playbackRisk": "medium" if score >= 70 else "high",
            "clickCount": 0,
            "noiseFloorDb": None,
            "ambientNoiseFloorDb": None,
            "adjustedNoiseFloorDb": None,
            "dynamicRangeDb": None,
            "analysisConfidence": 35,
            "warnings": ["오디오 파일을 직접 해석하지 못해 보수적인 fallback 점수를 적용했습니다."],
            "goodSample": None,
            "noisySample": None,
            "ambientSample": None,
            "summary": "녹음 파일을 직접 해석하지 못해 보수적인 fallback 점수를 적용했습니다.",
        }

    samples = [sample for sample in [good, noisy] if sample]
    if not samples:
        return {
            "source": "librosa",
            "audioScore": 0,
            "audioGrade": "미측정",
            "playbackRisk": "high",
            "clickCount": 0,
            "noiseFloorDb": None,
            "ambientNoiseFloorDb": ambient_noise_floor,
            "adjustedNoiseFloorDb": None,
            "dynamicRangeDb": None,
            "analysisConfidence": 0,
            "warnings": ["좋은 구간 또는 안 좋은 구간 녹음이 필요합니다."],
            "goodSample": None,
            "noisySample": None,
            "ambientSample": ambient,
            "summary": "좋은 구간 또는 안 좋은 구간 녹음이 필요합니다.",
        }
    if good and noisy:
        score = int(round(good["score"] * 0.68 + noisy["score"] * 0.32))
        if noisy["scratchRisk"] == "high":
            score -= 6
        elif noisy["scratchRisk"] == "medium":
            score -= 3
    else:
        score = int(samples[0]["score"] - 4)
    score = int(max(42, min(96, score)))
    click_count = int(sum(int(sample.get("clickCount", 0)) for sample in samples))
    noise_values = [float(sample["noiseFloorDb"]) for sample in samples if sample.get("noiseFloorDb") is not None]
    adjusted_noise_values = [float(sample["adjustedNoiseFloorDb"]) for sample in samples if sample.get("adjustedNoiseFloorDb") is not None]
    dynamic_values = [float(sample["dynamicRangeDb"]) for sample in samples if sample.get("dynamicRangeDb") is not None]
    avg_noise = round(float(np.mean(noise_values)), 1) if noise_values else None
    avg_adjusted_noise = round(float(np.mean(adjusted_noise_values)), 1) if adjusted_noise_values else avg_noise
    avg_dynamic = round(float(np.mean(dynamic_values)), 1) if dynamic_values else None
    warnings: list[str] = []
    if ambient_noise_floor is None:
        warnings.append("주변음 기준 샘플이 없어 노이즈 보정 신뢰도가 낮습니다.")
    elif ambient_noise_floor > -36:
        warnings.append("측정된 주변음이 큽니다. 조용한 환경에서 다시 측정하면 정확도가 올라갑니다.")
        score -= 3
    score = int(max(42, min(96, score)))
    playback_risk = "high" if score < 70 or any(sample.get("scratchRisk") == "high" for sample in samples) else "medium" if score < 82 or any(sample.get("scratchRisk") == "medium" for sample in samples) else "low"
    confidence_values = [int(sample.get("analysisConfidence", 70)) for sample in samples]
    analysis_confidence = int(max(20, min(96, round(float(np.mean(confidence_values)) if confidence_values else 50))))
    if ambient_noise_floor is not None:
        analysis_confidence = min(96, analysis_confidence + 8)
    return {
        "source": "librosa",
        "audioScore": score,
        "audioGrade": grade_from_score(score),
        "playbackRisk": playback_risk,
        "clickCount": click_count,
        "noiseFloorDb": avg_noise,
        "ambientNoiseFloorDb": round(ambient_noise_floor, 1) if ambient_noise_floor is not None else None,
        "adjustedNoiseFloorDb": avg_adjusted_noise,
        "dynamicRangeDb": avg_dynamic,
        "analysisConfidence": analysis_confidence,
        "warnings": warnings,
        "goodSample": good,
        "noisySample": noisy,
        "ambientSample": ambient,
        "summary": f"클릭/팝 후보 {click_count}개, 노이즈 플로어 {avg_noise if avg_noise is not None else '-'} dB, 다이내믹 레인지 {avg_dynamic if avg_dynamic is not None else '-'} dB",
    }


def discogs_candidate(result: dict[str, Any], catalog_number: str) -> dict[str, Any]:
    title_text = str(result.get("title") or "Unknown release")
    release_id = result.get("id")
    if " - " in title_text:
        artist, title = title_text.split(" - ", 1)
    else:
        artist, title = "Unknown artist", title_text
    labels = result.get("label") if isinstance(result.get("label"), list) else []
    return {
        "id": f"discogs-{release_id or uuid4().hex[:8]}",
        "releaseId": int(release_id or 0),
        "title": title,
        "artist": artist,
        "year": int(result.get("year") or 0),
        "label": str(labels[0]) if labels else "Unknown label",
        "catalogNumber": str(result.get("catno") or catalog_number),
        "country": str(result.get("country") or "Unknown"),
        "confidence": 88,
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
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get("https://api.discogs.com/database/search", params=params)
            response.raise_for_status()
            payload = response.json()
        candidates = [discogs_candidate(item, query) for item in payload.get("results", [])[:5]]
        return {"source": "discogs", "candidates": candidates}
    except Exception as exc:
        logger.warning("Discogs lookup failed: %s", exc)
        return {"source": "mock", "candidates": []}


def normalize_address_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def address_candidate_id(address: str, place_name: str, longitude: str, latitude: str) -> str:
    return stable_id("addr", "|".join([address, place_name, longitude, latitude]))


def read_env_value(key: str) -> str:
    value = os.getenv(key, "").strip().strip('"').strip("'")
    if value:
        return value
    if not os.path.exists(ENV_PATH):
        return ""
    try:
        with open(ENV_PATH, "r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                existing_key, existing_value = line.split("=", 1)
                if existing_key.strip() == key:
                    return existing_value.strip().strip('"').strip("'")
    except OSError:
        return ""
    return ""


def kakao_api_key() -> str:
    for key in ("KAKAO_REST_API_KEY", "KAKAO_MAP_API_KEY", "KAKAO_API_KEY"):
        value = read_env_value(key)
        if value:
            return value
    return ""


def write_env_value(key: str, value: str) -> None:
    lines: list[str] = []
    found = False
    if os.path.exists(ENV_PATH):
        try:
            with open(ENV_PATH, "r", encoding="utf-8") as file:
                lines = file.readlines()
        except OSError:
            lines = []

    next_lines: list[str] = []
    for raw_line in lines:
        line = raw_line.rstrip("\n")
        if line.strip().startswith("#") or "=" not in line:
            next_lines.append(raw_line)
            continue
        existing_key, _ = line.split("=", 1)
        if existing_key.strip() == key:
            next_lines.append(f"{key}={value}\n")
            found = True
        else:
            next_lines.append(raw_line)
    if not found:
        if next_lines and not next_lines[-1].endswith("\n"):
            next_lines[-1] = f"{next_lines[-1]}\n"
        next_lines.append(f"{key}={value}\n")

    with open(ENV_PATH, "w", encoding="utf-8") as file:
        file.writelines(next_lines)
    os.environ[key] = value


@router.get("/address/api-key")
async def address_api_key_status():
    return {"hasKey": bool(kakao_api_key()), "provider": "kakao"}


@router.put("/address/api-key")
async def save_address_api_key(payload: AddressApiKeyUpsert):
    api_key = payload.apiKey.strip()
    if len(api_key) < 8:
        raise HTTPException(status_code=400, detail="카카오 REST API 키를 입력해 주세요.")
    write_env_value("KAKAO_REST_API_KEY", api_key)
    return {"ok": True, "hasKey": True, "provider": "kakao", "message": "카카오 지도 API 키가 저장되었습니다."}


def kakao_local_candidate(item: dict[str, Any]) -> dict[str, str]:
    place_name = normalize_address_text(item.get("place_name"))
    road_address = normalize_address_text(item.get("road_address_name"))
    jibun_address = normalize_address_text(item.get("address_name"))
    address = road_address or jibun_address or place_name
    longitude = normalize_address_text(item.get("x"))
    latitude = normalize_address_text(item.get("y"))
    category = normalize_address_text(item.get("category_name"))
    return {
        "id": address_candidate_id(address, place_name, longitude, latitude),
        "roadAddress": road_address,
        "jibunAddress": jibun_address,
        "zipCode": "",
        "sido": "",
        "sigungu": "",
        "detail": place_name or category,
        "placeName": place_name,
        "address": address,
        "longitude": longitude,
        "latitude": latitude,
        "category": category,
    }


@router.get("/address/search")
async def search_address(keyword: str, count: int = 8, page: int = 1):
    query = keyword.strip()
    safe_count = max(1, min(count, 20))
    safe_page = max(1, page)
    if len(query) < 2:
        return {"source": "kakao", "candidates": [], "message": "검색어를 2글자 이상 입력해 주세요."}

    key = kakao_api_key()
    if not key:
        return {
            "source": "kakao",
            "candidates": [],
            "totalCount": 0,
            "message": "KAKAO_REST_API_KEY가 없어 카카오 지도 검색을 사용할 수 없습니다.",
        }

    try:
        params = {
            "query": query,
            "page": str(safe_page),
            "size": str(min(safe_count, 15)),
        }
        headers = {"Authorization": f"KakaoAK {key}"}
        async with httpx.AsyncClient(timeout=7) as client:
            response = await client.get("https://dapi.kakao.com/v2/local/search/keyword.json", params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
        candidates = [kakao_local_candidate(item) for item in payload.get("documents", [])]
        meta = payload.get("meta", {}) if isinstance(payload, dict) else {}
        return {
            "source": "kakao",
            "candidates": candidates,
            "totalCount": int(meta.get("total_count") or len(candidates)),
            "message": "카카오 지도 검색 결과입니다.",
        }
    except Exception as exc:
        logger.warning("Kakao local lookup failed: %s", exc)
        return {
            "source": "kakao",
            "candidates": [],
            "totalCount": 0,
            "message": "카카오 지도 검색에 실패했습니다. API 키와 네트워크 상태를 확인해 주세요.",
        }


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
    "Very Good Plus (VG+)",
    "Very Good (VG)",
    "Good Plus (G+)",
    "Good (G)",
    "Fair (F)",
    "Poor (P)",
]


def price_condition(surface_score: int | None, audio_score: int | None, scratch_risk: str | None, playback_risk: str | None) -> str:
    surface = int(surface_score or 0)
    audio = int(audio_score or 0)
    worst_risk = "high" if "high" in {scratch_risk, playback_risk} else "medium" if "medium" in {scratch_risk, playback_risk} else "low"
    combined = int(round((surface or 72) * 0.45 + (audio or 72) * 0.55))
    if combined >= 88 and worst_risk == "low":
        return "Near Mint (NM or M-)"
    if combined >= 80 and worst_risk != "high":
        return "Very Good Plus (VG+)"
    if combined >= 68:
        return "Very Good (VG)"
    if combined >= 55:
        return "Good Plus (G+)"
    return "Good (G)"


def quality_multiplier(
    surface_score: int | None,
    audio_score: int | None,
    scratch_risk: str | None,
    playback_risk: str | None,
    jacket_score: int | None = None,
    jacket_risk: str | None = None,
) -> float:
    surface = int(surface_score or 72)
    audio = int(audio_score or 72)
    jacket = int(jacket_score or 76)
    multiplier = 1.0
    if surface >= 88 and audio >= 86:
        multiplier += 0.05
    if surface < 70:
        multiplier -= 0.08
    if audio < 72:
        multiplier -= 0.08
    if scratch_risk == "high" or playback_risk == "high":
        multiplier -= 0.12
    elif scratch_risk == "medium" or playback_risk == "medium":
        multiplier -= 0.05
    if jacket >= 88:
        multiplier += 0.03
    elif jacket < 68:
        multiplier -= 0.08
    if jacket_risk == "high":
        multiplier -= 0.06
    elif jacket_risk == "medium":
        multiplier -= 0.03
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
    for condition in DISCOGS_CONDITION_ORDER:
        if condition not in suggestions:
            continue
        price, currency, original_price = suggestion_entry_details(suggestions.get(condition))
        if price:
            prices.append({
                "condition": condition,
                "price": price,
                "currency": currency,
                "originalPrice": original_price,
            })
    for condition, entry in suggestions.items():
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
    target_index = DISCOGS_CONDITION_ORDER.index(condition) if condition in DISCOGS_CONDITION_ORDER else 3
    available = [item for item in DISCOGS_CONDITION_ORDER if item in suggestions]
    if available:
        picked = min(available, key=lambda item: abs(DISCOGS_CONDITION_ORDER.index(item) - target_index))
        return suggestions.get(picked), picked
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
    jacket_score: int | None = None,
    scratch_risk: str | None = None,
    playback_risk: str | None = None,
    jacket_risk: str | None = None,
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

    adjusted_price = int(round(base_price * quality_multiplier(surface_score, audio_score, scratch_risk, playback_risk, jacket_score, jacket_risk) / 1000) * 1000)
    adjusted_price = max(1000, adjusted_price)
    sales_history_available = bool(suggested_krw or condition_prices)
    confidence = 92 if sales_history_available else 78 if marketplace_low_krw else 54
    if surface_score and audio_score:
        confidence += 4
    if jacket_score:
        confidence += 2
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
            f"Discogs 판매 이력 기반 가격표({condition_used})와 현재 최저가, 표면 {surface_score or '-'}점, 음질 {audio_score or '-'}점, 자켓 {jacket_score or '-'}점을 함께 반영했습니다."
            if sales_history_available
            else f"Discogs 판매 이력 가격표는 확인하지 못했지만 현재 판매 최저가와 표면 {surface_score or '-'}점, 음질 {audio_score or '-'}점, 자켓 {jacket_score or '-'}점을 함께 반영했습니다."
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
