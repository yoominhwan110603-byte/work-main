import os
import json
import base64
import logging
import tempfile
from datetime import datetime
from typing import Annotated

import asyncpg
import httpx
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Form
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Vinyl-Check API")
db_pool: asyncpg.Pool | None = None
logger = logging.getLogger("vinyl_check")
SERVER_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
SERVER_LISTINGS_PATH = os.path.join(SERVER_DATA_DIR, "listings.json")
SERVER_CHATS_PATH = os.path.join(SERVER_DATA_DIR, "chats.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "capacitor://localhost",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+):517[3-9]",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ListingCreate(BaseModel):
    title: str
    artist: str | None = None
    catalog_number: str | None = None
    price: int
    description: str | None = None
    tags: list[str] = []
    user_id: str | None = None
    images: list[str] = []
    genre: str | None = None
    year: int | None = None
    location: str | None = None
    audio_grade: str | None = None
    audio_score: int | None = None
    jacket_grade: str | None = None
    jacket_score: int | None = None
    is_rare: bool = False
    is_first_press: bool = False
    analysis_report: dict = {}


class OfferCreate(BaseModel):
    listing_id: str
    offer_price: int


class CompletionUpdate(BaseModel):
    buyer_checked: bool
    seller_checked: bool


class ChatMessageCreate(BaseModel):
    sender_id: str = "buyer1"
    sender_name: str = "사용자"
    content: str
    message_type: str = "text"


class ProfileDraftUpsert(BaseModel):
    username: str
    email: str | None = None
    rating: float = 5.0
    transactionCount: int = 0
    genres: list[str] = []
    emailVerified: bool = True


class ListingDraftUpsert(BaseModel):
    draft: dict


class LpRecognitionResult(BaseModel):
    id: str | None = None
    isRecord: bool
    confidence: int
    signals: list[str]
    source: str
    persisted: bool = False
    surfaceScore: int = 0
    scratchCount: int = 0
    scratchRisk: str = "low"
    reflectionRisk: str = "low"
    scratchRegions: list[dict] = []
    dustOrReflectionNote: str = "먼지와 반사는 촬영 환경에 따라 함께 나타날 수 있습니다."
    playbackImpact: str = "낮음"


class JacketConditionResult(BaseModel):
    jacketScore: int
    jacketGrade: str
    cornerWear: str
    ringWear: str
    stainRisk: str
    tearOrCreaseRisk: str
    notes: list[str]


MOCK_LISTINGS = [
    {
        "id": "1",
        "title": "Kind of Blue",
        "artist": "Miles Davis",
        "catalog_number": "CL 1355",
        "price": 280000,
        "audio_grade": "NM",
        "audio_score": 92,
        "seller_id": "seller1",
    },
    {
        "id": "2",
        "title": "Abbey Road",
        "artist": "The Beatles",
        "catalog_number": "PCS 7088",
        "price": 420000,
        "audio_grade": "VG+",
        "audio_score": 85,
        "seller_id": "seller2",
    },
]


def normalize_tags(tags: list[str] | str | None) -> list[str]:
    if isinstance(tags, list):
        return [str(tag).strip() for tag in tags if str(tag).strip()]
    if isinstance(tags, str):
        return [tag.strip() for tag in tags.replace(",", " ").split() if tag.strip()]
    return []


def normalize_json_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return value if isinstance(value, list) else []


def normalize_json_dict(value) -> dict:
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return value if isinstance(value, dict) else {}


def listing_to_album(listing: dict) -> dict:
    seller_id = listing.get("seller_id") or listing.get("user_id") or "seller1"
    price = int(listing.get("price") or 0)
    created_at = listing.get("created_at") or datetime.now().date().isoformat()
    if isinstance(created_at, datetime):
        created_at = created_at.date().isoformat()
    tags = normalize_tags(listing.get("tags"))
    images = normalize_json_list(listing.get("images"))
    analysis_report = normalize_json_dict(listing.get("analysis_report"))
    audio_score = int(listing.get("audio_score") or analysis_report.get("audioScore") or 78)
    audio_grade = listing.get("audio_grade") or analysis_report.get("audioGrade") or "VG"
    jacket_grade = listing.get("jacket_grade") or analysis_report.get("jacketGrade") or "VG"
    jacket_score = listing.get("jacket_score") or analysis_report.get("jacketScore")
    return {
        "id": str(listing.get("id")),
        "title": listing.get("title") or "Untitled LP",
        "artist": listing.get("artist") or "Unknown Artist",
        "year": int(listing.get("year") or 0),
        "genre": listing.get("genre") or (tags[0].replace("#", "") if tags else "LP"),
        "catalogNumber": listing.get("catalog_number") or "",
        "catalog_number": listing.get("catalog_number") or "",
        "price": price,
        "priceRange": {
            "min": max(0, int(price * 0.85)),
            "max": int(price * 1.15) if price else 0,
        },
        "audioGrade": audio_grade,
        "audioScore": audio_score,
        "audio_grade": audio_grade,
        "audio_score": audio_score,
        "jacketGrade": jacket_grade,
        "jacketScore": jacket_score,
        "isRare": bool(listing.get("is_rare")),
        "isFirstPress": bool(listing.get("is_first_press")),
        "ownedByMe": bool(listing.get("owned_by_me")),
        "images": images,
        "description": listing.get("description") or "",
        "analysisReport": analysis_report,
        "seller": {
            "id": seller_id,
            "name": "내 판매글" if listing.get("owned_by_me") else seller_id,
            "rating": 5.0,
            "transactionCount": 0,
        },
        "seller_id": seller_id,
        "location": listing.get("location") or "지역 미입력",
        "views": int(listing.get("views") or 0),
        "createdAt": str(created_at),
    }


def read_file_listings() -> list[dict]:
    try:
        with open(SERVER_LISTINGS_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, list) else []
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def write_file_listings(listings: list[dict]) -> None:
    os.makedirs(SERVER_DATA_DIR, exist_ok=True)
    with open(SERVER_LISTINGS_PATH, "w", encoding="utf-8") as file:
        json.dump(listings, file, ensure_ascii=False, indent=2)


def read_file_chats() -> dict:
    try:
        with open(SERVER_CHATS_PATH, "r", encoding="utf-8") as file:
            data = json.load(file)
            return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_file_chats(chats: dict) -> None:
    os.makedirs(SERVER_DATA_DIR, exist_ok=True)
    with open(SERVER_CHATS_PATH, "w", encoding="utf-8") as file:
        json.dump(chats, file, ensure_ascii=False, indent=2)


def normalize_chat_message(message: dict) -> dict:
    return {
        "id": str(message.get("id") or f"msg-{int(datetime.now().timestamp() * 1000)}"),
        "chatId": str(message.get("chatId") or message.get("chat_id") or ""),
        "senderId": str(message.get("senderId") or message.get("sender_id") or ""),
        "senderName": str(message.get("senderName") or message.get("sender_name") or "사용자"),
        "message": str(message.get("message") or message.get("content") or ""),
        "timestamp": str(message.get("timestamp") or message.get("created_at") or datetime.now().isoformat()),
        "type": str(message.get("type") or message.get("message_type") or "text"),
    }


class ChatConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, chat_id: str, websocket: WebSocket):
        await websocket.accept()
        self.rooms.setdefault(chat_id, []).append(websocket)

    def disconnect(self, chat_id: str, websocket: WebSocket):
        room = self.rooms.get(chat_id)
        if not room:
            return
        if websocket in room:
            room.remove(websocket)
        if not room:
            self.rooms.pop(chat_id, None)

    async def broadcast(self, chat_id: str, payload: dict):
        stale: list[WebSocket] = []
        for websocket in self.rooms.get(chat_id, []):
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(chat_id, websocket)


chat_manager = ChatConnectionManager()

MOCK_DISCOGS_CANDIDATES = [
    {
        "id": "kind-of-blue-cl-1355",
        "title": "Kind of Blue",
        "artist": "Miles Davis",
        "year": 1959,
        "label": "Columbia 6-eye",
        "catalogNumber": "CL 1355",
        "country": "US",
        "confidence": 96,
    },
    {
        "id": "abbey-road-pcs-7088",
        "title": "Abbey Road",
        "artist": "The Beatles",
        "year": 1969,
        "label": "Apple",
        "catalogNumber": "PCS 7088",
        "country": "UK",
        "confidence": 94,
    },
    {
        "id": "blue-train-blp-1577",
        "title": "Blue Train",
        "artist": "John Coltrane",
        "year": 1957,
        "label": "Blue Note",
        "catalogNumber": "BLP 1577",
        "country": "US",
        "confidence": 91,
    },
]

MOCK_TRACKLISTS = {
    "CL 1355": [
        {"position": "A1", "title": "So What", "duration": "9:22"},
        {"position": "A2", "title": "Freddie Freeloader", "duration": "9:46"},
        {"position": "A3", "title": "Blue In Green", "duration": "5:37"},
        {"position": "B1", "title": "All Blues", "duration": "11:33"},
        {"position": "B2", "title": "Flamenco Sketches", "duration": "9:26"},
    ],
    "PCS 7088": [
        {"position": "A1", "title": "Come Together", "duration": "4:20"},
        {"position": "A2", "title": "Something", "duration": "3:03"},
        {"position": "A3", "title": "Maxwell's Silver Hammer", "duration": "3:27"},
        {"position": "B1", "title": "Here Comes The Sun", "duration": "3:05"},
        {"position": "B2", "title": "Because", "duration": "2:45"},
    ],
    "BLP 1577": [
        {"position": "A1", "title": "Blue Train", "duration": "10:43"},
        {"position": "A2", "title": "Moment's Notice", "duration": "9:10"},
        {"position": "B1", "title": "Locomotion", "duration": "7:12"},
        {"position": "B2", "title": "I'm Old Fashioned", "duration": "7:55"},
        {"position": "B3", "title": "Lazy Bird", "duration": "7:03"},
    ],
}


def seconds_from_duration(duration: str | None) -> int:
    if not duration or ":" not in duration:
        return 0
    parts = duration.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        return 0
    return 0


def normalize_track(item: dict, index: int) -> dict:
    return {
        "position": str(item.get("position") or f"T{index + 1}"),
        "title": str(item.get("title") or f"Track {index + 1}"),
        "duration": str(item.get("duration") or ""),
        "durationSeconds": seconds_from_duration(str(item.get("duration") or "")),
    }


def recommend_audio_tracks(tracklist: list[dict]) -> dict:
    tracks = [normalize_track(item, index) for index, item in enumerate(tracklist) if item.get("type_") in (None, "track")]
    if not tracks:
        tracks = [normalize_track(item, index) for index, item in enumerate(tracklist)]
    if not tracks:
        tracks = [{"position": "A1", "title": "첫 번째 트랙", "duration": "", "durationSeconds": 0}]

    excluded_words = ("intro", "outro", "interlude", "reprise", "skit")
    usable = [
        track for track in tracks
        if not any(word in track["title"].lower() for word in excluded_words)
        and (track["durationSeconds"] == 0 or 150 <= track["durationSeconds"] <= 720)
    ]
    if not usable:
        usable = tracks

    good_index = min(len(usable) - 1, max(0, len(usable) // 2))
    good_track = usable[good_index]
    noise_track = next((track for track in tracks if track["position"].upper().startswith("A1")), tracks[0])

    return {
        "tracks": tracks,
        "good": {
            **good_track,
            "label": "good",
            "guide": "음악이 안정적으로 이어지는 중간 15~20초를 녹음하세요.",
            "suggestedStart": "중간부",
            "recordSeconds": 20,
        },
        "noisy": {
            **noise_track,
            "label": "noisy",
            "guide": "트랙 시작 직후나 곡 사이 조용한 10~15초를 녹음하세요.",
            "suggestedStart": "시작부 0~15초",
            "recordSeconds": 15,
        },
    }


def mock_track_recommendations(catalog_number: str | None) -> dict:
    normalized = (catalog_number or "").strip().upper()
    tracklist = MOCK_TRACKLISTS.get(normalized) or MOCK_TRACKLISTS["CL 1355"]
    recommendations = recommend_audio_tracks(tracklist)
    return {
        **recommendations,
        "source": "mock",
        "releaseTitle": "Discogs 후보",
        "catalogNumber": catalog_number or "",
    }


@app.on_event("startup")
async def startup():
    global db_pool
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        db_pool = await asyncpg.create_pool(database_url, min_size=1, max_size=4)
        async with db_pool.acquire() as connection:
            await connection.execute(
                """
                create table if not exists user_profile_drafts (
                  user_id text primary key,
                  username text not null,
                  email text,
                  rating numeric(3, 1) not null default 5.0,
                  transaction_count integer not null default 0,
                  genres jsonb not null default '[]'::jsonb,
                  email_verified boolean not null default true,
                  updated_at timestamptz not null default now()
                )
                """
            )
            await connection.execute(
                """
                create table if not exists user_listing_drafts (
                  user_id text primary key,
                  draft jsonb not null default '{}'::jsonb,
                  updated_at timestamptz not null default now()
                )
                """
            )
            await connection.execute(
                """
                create table if not exists listings (
                  id text primary key,
                  seller_id text not null,
                  title text not null,
                  artist text,
                  catalog_number text,
                  price integer not null,
                  description text,
                  tags jsonb not null default '[]'::jsonb,
                  images jsonb not null default '[]'::jsonb,
                  genre text,
                  year integer,
                  location text,
                  audio_grade text,
                  audio_score integer,
                  jacket_grade text,
                  jacket_score integer,
                  is_rare boolean not null default false,
                  is_first_press boolean not null default false,
                  analysis_report jsonb not null default '{}'::jsonb,
                  views integer not null default 0,
                  created_at timestamptz not null default now()
                )
                """
            )
            await connection.execute(
                """
                create table if not exists realtime_chat_messages (
                  id text primary key,
                  chat_id text not null,
                  sender_id text not null,
                  sender_name text not null,
                  content text not null,
                  message_type text not null default 'text',
                  created_at timestamptz not null default now()
                )
                """
            )


@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()


def mock_discogs_candidates(catalog_number: str | None):
    normalized = (catalog_number or "").strip().lower()
    if not normalized:
        return []

    exact = [
        candidate
        for candidate in MOCK_DISCOGS_CANDIDATES
        if candidate["catalogNumber"].lower() == normalized
    ]
    if exact:
        return exact

    partial = [
        candidate
        for candidate in MOCK_DISCOGS_CANDIDATES
        if normalized in candidate["catalogNumber"].lower()
        or candidate["catalogNumber"].lower().split(" ")[0] in normalized
    ]
    if partial:
        return partial

    return []


def heuristic_lp_recognition(file_size: int, media_type: str, filename: str | None, content_type: str | None):
    normalized_name = (filename or "").lower()
    normalized_type = (content_type or "").lower()
    has_media = file_size > 120
    negative_hint = any(token in normalized_name for token in ["not-record", "book", "poster", "cd"])
    type_hint = normalized_type.startswith("image/") or normalized_type.startswith("video/")
    record_hint = any(token in normalized_name for token in ["lp", "vinyl", "record", "disc", "album"])

    confidence = 0
    if has_media and type_hint:
        confidence = 88 if media_type == "image" else 84
    if record_hint:
        confidence = min(97, confidence + 6)
    if negative_hint:
        confidence = 34

    is_record = has_media and type_hint
    signals = (
        [
            "업로드된 매체를 표면 상태 감정 자료로 접수했습니다.",
            "스크래치 후보, 반사, 먼지 가능성을 감정서 참고 항목으로 기록합니다.",
            "이 분석은 판매 차단이 아니라 상태 설명 보조 자료로 사용됩니다.",
        ]
        if is_record
        else [
            "표면 상태 분석에 사용할 매체가 충분하지 않습니다.",
            "자켓 사진 또는 음반 표면 이미지/동영상을 추가하면 감정서 품질이 높아집니다.",
        ]
    )
    return is_record, confidence, signals


def risk_level(value: float, medium: float, high: float) -> str:
    if value >= high:
        return "high"
    if value >= medium:
        return "medium"
    return "low"


def stable_text_seed(value: str) -> int:
    seed = 0
    for char in value:
        seed = ((seed * 31) + ord(char)) & 0xFFFFFFFF
    return seed


def grade_from_score(score: int) -> str:
    if score >= 92:
        return "NM"
    if score >= 84:
        return "VG+"
    if score >= 72:
        return "VG"
    return "G"


def normalize_json_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, list) else []
        except json.JSONDecodeError:
            return []
    return []


def normalize_json_object(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def playback_impact_from_risk(scratch_risk: str, reflection_risk: str) -> str:
    if scratch_risk == "high":
        return "높음"
    if scratch_risk == "medium" or reflection_risk == "high":
        return "주의"
    return "낮음"


def surface_condition_payload(
    *,
    confidence: int,
    scratch_count: int = 0,
    reflection_ratio: float = 0.0,
    quality_penalty: int = 0,
    source: str = "heuristic",
):
    scratch_risk = "high" if scratch_count >= 8 else "medium" if scratch_count >= 3 else "low"
    reflection_risk = risk_level(reflection_ratio, 0.025, 0.07)
    surface_score = max(45, min(92, 88 - scratch_count * 4 - round(reflection_ratio * 180) - quality_penalty))
    if source != "opencv":
        surface_score = max(58, min(84, confidence - 8))

    note = (
        "강한 반사가 있어 먼지나 얕은 흠집과 구분이 필요합니다."
        if reflection_risk == "high"
        else "일부 반사 가능성이 있어 실제 먼지와 표면 흠집을 함께 확인하세요."
        if reflection_risk == "medium"
        else "반사 영향은 낮아 보이며 스크래치 후보 중심으로 확인했습니다."
    )
    return {
        "surfaceScore": surface_score,
        "scratchCount": scratch_count,
        "scratchRisk": scratch_risk,
        "reflectionRisk": reflection_risk,
        "scratchRegions": [],
        "dustOrReflectionNote": note,
        "playbackImpact": playback_impact_from_risk(scratch_risk, reflection_risk),
    }


def heuristic_surface_condition_payload(
    *,
    file_size: int,
    media_type: str,
    filename: str | None,
    content_type: str | None,
    confidence: int,
):
    normalized = f"{filename or ''}|{content_type or ''}|{file_size}|{media_type}".lower()
    seed = stable_text_seed(normalized)
    size_bucket = min(10, file_size // 700_000)
    scratch_count = int(seed % 7) + (2 if media_type == "video" and file_size < 2_000_000 else 0)
    reflection_ratio = ((seed >> 5) % 9) / 100.0
    quality_penalty = int((seed >> 12) % 8)
    if media_type == "video":
        quality_penalty += 2
    condition = surface_condition_payload(
        confidence=confidence,
        scratch_count=scratch_count,
        reflection_ratio=reflection_ratio,
        quality_penalty=quality_penalty + max(0, 6 - size_bucket),
        source="opencv",
    )
    condition["surfaceScore"] = max(45, min(86, condition["surfaceScore"]))
    condition["playbackImpact"] = playback_impact_from_risk(condition["scratchRisk"], condition["reflectionRisk"])
    return condition


def normalize_visual_condition_result(is_record: bool, confidence: int, signals: list[str]):
    normalized_signals = [signal for signal in signals if signal]
    if not normalized_signals:
        normalized_signals = ["표면 상태 감정 자료로 접수했습니다."]

    normalized_signals = [
        signal.replace("판매 등록을 진행할 수 없습니다", "감정서 참고 자료로 기록합니다")
        .replace("판매 불가", "추가 확인 권장")
        .replace("차단", "참고")
        for signal in normalized_signals
    ]

    if not any("스크래치" in signal for signal in normalized_signals):
        normalized_signals.append("긴 선형 스크래치 후보와 얕은 표면 흠집을 함께 확인했습니다.")
    normalized_signals.append("촬영 각도나 조명 반사는 먼지/반사 가능성으로 분리해 해석해야 합니다.")

    normalized_confidence = max(45, min(92, confidence))
    return True, normalized_confidence, normalized_signals[:5]


def opencv_lp_recognition(content: bytes, content_type: str | None):
    normalized_type = (content_type or "").lower()
    if not normalized_type.startswith("image/"):
        return None

    image_array = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return None

    height, width = image.shape[:2]
    if height < 120 or width < 120:
        return False, 25, ["이미지 해상도가 낮아 LP 표면과 스크래치를 안정적으로 확인하기 어렵습니다."]

    max_side = 900
    scale = min(1.0, max_side / max(height, width))
    if scale < 1.0:
        image = cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
        height, width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.medianBlur(gray, 5)
    min_radius = int(min(width, height) * 0.18)
    max_radius = int(min(width, height) * 0.49)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=max(80, min(width, height) // 3),
        param1=90,
        param2=28,
        minRadius=min_radius,
        maxRadius=max_radius,
    )

    disc_circle = None
    label_circle = None
    if circles is not None:
        candidates = np.round(circles[0]).astype(int).tolist()
        candidates.sort(key=lambda item: item[2], reverse=True)
        disc_circle = candidates[0]
        for candidate in sorted(candidates, key=lambda item: item[2]):
            cx, cy, radius = candidate
            if disc_circle and radius < disc_circle[2] * 0.45:
                distance = ((cx - disc_circle[0]) ** 2 + (cy - disc_circle[1]) ** 2) ** 0.5
                if distance < disc_circle[2] * 0.2:
                    label_circle = candidate
                    break

    edges = cv2.Canny(gray, 60, 150)
    line_segments = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=55,
        minLineLength=max(35, min(width, height) // 9),
        maxLineGap=8,
    )

    scratch_candidates = 0
    scratch_regions: list[dict] = []
    if line_segments is not None:
        mask = np.ones((height, width), dtype=np.uint8) * 255
        if disc_circle:
            cx, cy, radius = disc_circle
            mask[:] = 0
            cv2.circle(mask, (cx, cy), max(1, radius - 8), 255, -1)
            cv2.circle(mask, (cx, cy), max(1, int(radius * 0.22)), 0, -1)
        for segment in line_segments[:, 0]:
            x1, y1, x2, y2 = segment
            length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
            if length < min(width, height) * 0.11:
                continue
            if mask[y1, x1] == 0 or mask[y2, x2] == 0:
                continue
            if disc_circle:
                cx, cy, _ = disc_circle
                mx, my = (x1 + x2) / 2, (y1 + y2) / 2
                radial_angle = np.degrees(np.arctan2(my - cy, mx - cx))
                line_angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
                angle_delta = abs(((line_angle - radial_angle + 90) % 180) - 90)
                if angle_delta < 12:
                    continue
            scratch_candidates += 1

    disc_score = 0
    signals: list[str] = []
    if disc_circle:
        _, _, radius = disc_circle
        coverage = radius / (min(width, height) / 2)
        disc_score += 48
        if coverage > 0.58:
            disc_score += 18
        signals.append("원형 음반 윤곽이 감지되었습니다.")
    else:
        signals.append("뚜렷한 원형 LP 윤곽은 감지되지 않았습니다.")

    if label_circle:
        disc_score += 18
        signals.append("중앙 라벨 후보가 감지되었습니다.")
    elif disc_circle:
        disc_score += 6
        signals.append("중앙 라벨은 약하게 보이거나 반사 때문에 불분명합니다.")

    if scratch_candidates >= 6:
        signals.append(f"표면에서 긴 선형 스크래치 후보가 {scratch_candidates}개 감지되었습니다.")
    elif scratch_candidates >= 2:
        signals.append(f"표면에서 약한 스크래치 후보가 {scratch_candidates}개 감지되었습니다.")
    else:
        signals.append("눈에 띄는 긴 스크래치 후보는 많지 않습니다.")

    confidence = max(20, min(96, disc_score + min(12, scratch_candidates)))
    is_record = bool(disc_circle and confidence >= 58)
    if not is_record:
        confidence = min(confidence, 55)

    return is_record, confidence, signals


def opencv_lp_recognition(content: bytes, content_type: str | None):
    normalized_type = (content_type or "").lower()
    if not normalized_type.startswith("image/"):
        return None

    image_array = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return None

    height, width = image.shape[:2]
    if height < 120 or width < 120:
        return False, 25, ["이미지 해상도가 낮아 LP 표면을 안정적으로 확인하기 어렵습니다."]

    max_side = 900
    scale = min(1.0, max_side / max(height, width))
    if scale < 1.0:
        image = cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
        height, width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    blurred = cv2.medianBlur(gray, 5)
    min_side = min(width, height)
    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    mean_value = float(np.mean(hsv[:, :, 2]))
    exposure_penalty = 0
    if mean_value < 45 or mean_value > 215:
        exposure_penalty = 8
    elif mean_value < 65 or mean_value > 195:
        exposure_penalty = 4
    blur_penalty = 10 if blur_variance < 45 else 5 if blur_variance < 90 else 0
    quality_penalty = exposure_penalty + blur_penalty

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
    label_circle = None
    if circles is not None:
        candidates = np.round(circles[0]).astype(int).tolist()
        candidates.sort(key=lambda item: item[2], reverse=True)
        disc_circle = candidates[0]
        for candidate in sorted(candidates, key=lambda item: item[2]):
            cx, cy, radius = candidate
            if radius < disc_circle[2] * 0.45:
                distance = ((cx - disc_circle[0]) ** 2 + (cy - disc_circle[1]) ** 2) ** 0.5
                if distance < disc_circle[2] * 0.25:
                    label_circle = candidate
                    break

    dark_mask = cv2.inRange(gray, 0, 110)
    reflection_mask = cv2.inRange(hsv, np.array([0, 0, 215]), np.array([179, 55, 255]))
    reflection_ratio = float(np.count_nonzero(reflection_mask)) / float(width * height)
    kernel = np.ones((7, 7), np.uint8)
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, kernel)
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel)
    dark_ratio = float(np.count_nonzero(dark_mask)) / float(width * height)
    contour_disc_hint = False

    if disc_circle is None:
        contours, _ = cv2.findContours(dark_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            area = cv2.contourArea(largest)
            perimeter = cv2.arcLength(largest, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                (cx, cy), radius = cv2.minEnclosingCircle(largest)
                center_distance = ((cx - width / 2) ** 2 + (cy - height / 2) ** 2) ** 0.5
                if area > width * height * 0.10 and radius > min_side * 0.15 and circularity > 0.38:
                    disc_circle = [int(cx), int(cy), int(radius)]
                    contour_disc_hint = center_distance < min_side * 0.40

    center_size = max(30, int(min_side * 0.18))
    center_crop = image[
        max(0, height // 2 - center_size): min(height, height // 2 + center_size),
        max(0, width // 2 - center_size): min(width, width // 2 + center_size),
    ]
    label_color_hint = False
    if center_crop.size:
        hsv_center = cv2.cvtColor(center_crop, cv2.COLOR_BGR2HSV)
        label_color_hint = float(np.mean(hsv_center[:, :, 1])) > 32 and float(np.mean(hsv_center[:, :, 2])) > 50

    edges = cv2.Canny(gray, 55, 145)
    line_segments = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=48,
        minLineLength=max(32, min_side // 10),
        maxLineGap=8,
    )

    scratch_candidates = 0
    scratch_regions: list[dict] = []
    if line_segments is not None:
        mask = np.ones((height, width), dtype=np.uint8) * 255
        if disc_circle:
            cx, cy, radius = disc_circle
            mask[:] = 0
            cv2.circle(mask, (cx, cy), max(1, radius - 8), 255, -1)
            cv2.circle(mask, (cx, cy), max(1, int(radius * 0.22)), 0, -1)
        for x1, y1, x2, y2 in line_segments[:, 0]:
            length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
            if length < min_side * 0.10:
                continue
            if mask[y1, x1] == 0 or mask[y2, x2] == 0:
                continue
            scratch_candidates += 1
            if len(scratch_regions) < 16:
                scratch_regions.append({
                    "x1": round(float(x1) / width, 4),
                    "y1": round(float(y1) / height, 4),
                    "x2": round(float(x2) / width, 4),
                    "y2": round(float(y2) / height, 4),
                    "severity": "high" if length >= min_side * 0.32 else "medium" if length >= min_side * 0.18 else "low",
                })

    score = 0
    signals: list[str] = []
    if disc_circle:
        _, _, radius = disc_circle
        coverage = radius / (min_side / 2)
        score += 46
        if coverage > 0.52:
            score += 16
        signals.append("어두운 원반형 영역이 LP 표면 후보로 감지되었습니다." if contour_disc_hint else "원형 음반 윤곽이 감지되었습니다.")
    else:
        signals.append("뚜렷한 원형 윤곽은 약하지만 사진 내 LP 후보 신호를 함께 확인했습니다.")

    if label_circle or label_color_hint:
        score += 18
        signals.append("중앙 라벨 또는 컬러 라벨 후보가 감지되었습니다.")
    elif disc_circle:
        score += 6
        signals.append("중앙 라벨은 약하게 보이거나 반사 때문에 불분명합니다.")

    if dark_ratio > 0.20:
        score += 12
        signals.append("LP 표면으로 볼 수 있는 어두운 영역 비율이 충분합니다.")

    if scratch_candidates >= 6:
        signals.append(f"표면에서 긴 선형 스크래치 후보가 {scratch_candidates}개 감지되었습니다.")
    elif scratch_candidates >= 2:
        signals.append(f"표면에서 약한 스크래치 후보가 {scratch_candidates}개 감지되었습니다.")
    else:
        signals.append("눈에 띄는 긴 스크래치 후보는 많지 않습니다.")

    confidence = max(20, min(96, score + min(10, scratch_candidates)))
    is_record = bool((disc_circle and confidence >= 50) or (dark_ratio > 0.26 and label_color_hint and confidence >= 46))
    if not is_record:
        confidence = min(confidence, 55)

    condition = surface_condition_payload(
        confidence=confidence,
        scratch_count=scratch_candidates,
        reflection_ratio=reflection_ratio,
        quality_penalty=quality_penalty,
        source="opencv",
    )
    condition["scratchRegions"] = scratch_regions
    if blur_penalty:
        signals.append("초점이 다소 약해 얕은 스크래치 후보는 보수적으로 해석했습니다.")
    if exposure_penalty:
        signals.append("노출이 강하거나 어두워 반사/먼지 구분 정확도가 낮아질 수 있습니다.")
    if condition["reflectionRisk"] != "low":
        signals.append(condition["dustOrReflectionNote"])

    return {
        "is_record": is_record,
        "confidence": confidence,
        "signals": signals,
        **condition,
    }


def opencv_video_surface_recognition(content: bytes, content_type: str | None):
    normalized_type = (content_type or "").lower()
    if not normalized_type.startswith("video/"):
        return None

    suffix = ".mp4"
    if "webm" in normalized_type:
        suffix = ".webm"
    elif "quicktime" in normalized_type or "mov" in normalized_type:
        suffix = ".mov"

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        capture = cv2.VideoCapture(temp_path)
        if not capture.isOpened():
            return None

        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if frame_count <= 0:
            sample_indices = [0, 8, 16, 24, 32]
        else:
            sample_indices = sorted(set(int(frame_count * ratio) for ratio in [0.12, 0.28, 0.44, 0.60, 0.76, 0.90]))

        frame_results: list[dict] = []
        for frame_index in sample_indices[:8]:
            if frame_count > 0:
                capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok or frame is None:
                continue
            ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 86])
            if not ok:
                continue
            result = opencv_lp_recognition(encoded.tobytes(), "image/jpeg")
            if isinstance(result, dict):
                frame_results.append(result)
        capture.release()

        if not frame_results:
            return None

        surface_scores = [int(result["surfaceScore"]) for result in frame_results]
        scratch_counts = [int(result["scratchCount"]) for result in frame_results]
        confidence_values = [int(result["confidence"]) for result in frame_results]
        representative_regions = max(
            (list(result.get("scratchRegions", [])) for result in frame_results),
            key=len,
            default=[],
        )[:16]
        reflection_weights = {"low": 0, "medium": 1, "high": 2}
        reflection_score = max(reflection_weights.get(str(result["reflectionRisk"]), 0) for result in frame_results)
        reflection_risk = "high" if reflection_score >= 2 else "medium" if reflection_score == 1 else "low"
        scratch_count = int(round(float(np.percentile(scratch_counts, 70))))
        scratch_risk = "high" if scratch_count >= 8 else "medium" if scratch_count >= 3 else "low"
        surface_score = int(round(float(np.percentile(surface_scores, 35))))
        confidence = min(int(round(float(np.mean(confidence_values)))), surface_score + 3)
        signals = [
            f"동영상 프레임 {len(frame_results)}개를 샘플링해 표면 상태를 비교했습니다.",
            f"프레임별 표면 점수 범위는 {min(surface_scores)}~{max(surface_scores)}점입니다.",
            f"스크래치 후보는 대표값 {scratch_count}개로 집계했습니다.",
        ]
        for result in frame_results[:2]:
            for signal in result.get("signals", [])[:1]:
                signals.append(str(signal))

        return {
            "is_record": any(bool(result["is_record"]) for result in frame_results),
            "confidence": confidence,
            "signals": signals[:5],
            "surfaceScore": max(45, min(88, surface_score)),
            "scratchCount": scratch_count,
            "scratchRisk": scratch_risk,
            "reflectionRisk": reflection_risk,
            "scratchRegions": representative_regions,
            "dustOrReflectionNote": (
                "동영상 일부 프레임에서 강한 반사가 보여 먼지/스크래치 구분을 보수적으로 반영했습니다."
                if reflection_risk == "high"
                else "동영상 프레임 간 반사 변화와 스크래치 후보를 함께 반영했습니다."
            ),
            "playbackImpact": playback_impact_from_risk(scratch_risk, reflection_risk),
        }
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def extract_response_text(payload: dict) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str):
        return output_text

    chunks: list[str] = []
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                chunks.append(content["text"])
    return "\n".join(chunks)


def parse_ai_lp_recognition(text: str):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    data = json.loads(cleaned)
    is_record = bool(data.get("isRecord"))
    confidence = int(data.get("confidence", 0))
    confidence = max(0, min(100, confidence))
    signals = data.get("signals")
    if not isinstance(signals, list):
        signals = []
    normalized_signals = [str(item) for item in signals[:5] if str(item).strip()]
    if not normalized_signals:
        normalized_signals = ["AI가 이미지의 형태, 중앙 라벨, 원형 윤곽, 표면 질감을 기준으로 판정했습니다."]
    return is_record, confidence, normalized_signals


async def ai_lp_recognition(content: bytes, filename: str | None, content_type: str | None):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    normalized_type = (content_type or "").lower()
    if not normalized_type.startswith("image/"):
        return None

    model = os.getenv("OPENAI_VISION_MODEL", "gpt-4.1-mini")
    image_b64 = base64.b64encode(content).decode("ascii")
    image_url = f"data:{content_type or 'image/jpeg'};base64,{image_b64}"
    prompt = (
        "You are Vinyl-Check's LP recognition engine. Analyze the uploaded image and decide "
        "whether it clearly contains a vinyl LP record, record surface, record sleeve with visible LP, "
        "or turntable record. Return only JSON with this exact shape: "
        '{"isRecord": boolean, "confidence": integer, "signals": string[]}. '
        "Use Korean for signals. Mention concrete visual evidence such as circular disc shape, center label, "
        "grooves, sleeve context, glare/reflection, or reasons it is not an LP. "
        "Set confidence from 0 to 100."
    )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "input": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "input_text", "text": prompt},
                                {"type": "input_image", "image_url": image_url, "detail": "low"},
                            ],
                        }
                    ],
                    "max_output_tokens": 300,
                },
            )
            response.raise_for_status()
        return parse_ai_lp_recognition(extract_response_text(response.json()))
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        logger.warning("OpenAI LP recognition failed; falling back to heuristic: %s", exc)
        return None


async def save_lp_recognition_analysis(
    *,
    media_type: str,
    filename: str | None,
    content_type: str | None,
    file_size: int,
    is_record: bool,
    confidence: int,
    signals: list[str],
    source: str,
):
    if not db_pool:
        return None

    try:
        async with db_pool.acquire() as connection:
            return await connection.fetchval(
                """
                insert into lp_recognition_analyses (
                  media_type, filename, content_type, file_size, is_record, confidence, signals, source
                )
                values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
                returning id::text
                """,
                media_type,
                filename,
                content_type,
                file_size,
                is_record,
                confidence,
                json.dumps(signals, ensure_ascii=False),
                source,
            )
    except asyncpg.PostgresError:
        return None


def discogs_result_to_candidate(result: dict, catalog_number: str):
    title_text = result.get("title") or "Unknown release"
    if " - " in title_text:
        artist, title = title_text.split(" - ", 1)
    else:
        artist, title = "Unknown artist", title_text

    label = "Unknown label"
    if result.get("label"):
        label = result["label"][0]

    country = result.get("country") or "Unknown"
    try:
        year = int(result.get("year") or 0)
    except (TypeError, ValueError):
        year = 0
    result_id = str(result.get("id") or result.get("resource_url") or title_text)

    return {
        "id": f"discogs-{result_id}",
        "title": title,
        "artist": artist,
        "year": year,
        "label": label,
        "catalogNumber": result.get("catno") or catalog_number,
        "country": country,
        "confidence": 88,
    }


async def fetch_discogs_results(
    client: httpx.AsyncClient,
    query: str,
    headers: dict[str, str],
    album_title: str | None = None,
    artist: str | None = None,
):
    title = (album_title or "").strip()
    artist_name = (artist or "").strip()
    combined_query = " ".join(part for part in [artist_name, title, query] if part).strip()
    search_attempts = []
    if query:
        search_attempts.append({"type": "release", "catno": query, "per_page": 8})
    if combined_query and combined_query != query:
        search_attempts.append({"type": "release", "q": combined_query, "per_page": 8})
    if title or artist_name:
        params = {"type": "release", "per_page": 8}
        if title:
            params["release_title"] = title
        if artist_name:
            params["artist"] = artist_name
        search_attempts.append(params)
    if query:
        search_attempts.append({"type": "release", "q": query, "per_page": 8})

    seen_ids: set[str] = set()
    merged_results: list[dict] = []
    for params in search_attempts:
        response = await client.get(
            "https://api.discogs.com/database/search",
            params=params,
            headers=headers,
        )
        response.raise_for_status()
        for item in response.json().get("results", []):
            result_id = str(item.get("id") or item.get("resource_url") or item.get("uri") or item.get("title"))
            if result_id in seen_ids:
                continue
            seen_ids.add(result_id)
            merged_results.append(item)
        if merged_results:
            break

    return merged_results


@app.get("/health")
async def health():
    return {"ok": True, "service": "vinyl-check-api"}


@app.get("/users/{user_id}/profile-draft")
async def get_profile_draft(user_id: str):
    if not db_pool:
        return {"persisted": False, "profile": None}

    try:
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                select user_id, username, email, rating, transaction_count, genres, email_verified, updated_at
                from user_profile_drafts
                where user_id = $1
                """,
                user_id,
            )
    except asyncpg.PostgresError:
        return {"persisted": False, "profile": None}

    if not row:
        return {"persisted": False, "profile": None}

    return {
        "persisted": True,
        "profile": {
            "id": row["user_id"],
            "username": row["username"],
            "email": row["email"],
            "rating": float(row["rating"]),
            "transactionCount": int(row["transaction_count"]),
            "genres": normalize_json_list(row["genres"]),
            "emailVerified": bool(row["email_verified"]),
            "updatedAt": row["updated_at"].isoformat(),
        },
    }


@app.put("/users/{user_id}/profile-draft")
async def upsert_profile_draft(user_id: str, payload: ProfileDraftUpsert):
    normalized_username = payload.username.strip() or "VinylLover"
    normalized_genres = [genre.strip() for genre in payload.genres if genre.strip()][:5]

    profile = {
        "id": user_id,
        "username": normalized_username,
        "email": payload.email,
        "rating": max(0.0, min(5.0, float(payload.rating))),
        "transactionCount": max(0, int(payload.transactionCount)),
        "genres": normalized_genres,
        "emailVerified": bool(payload.emailVerified),
    }

    if not db_pool:
        return {"persisted": False, "profile": profile}

    try:
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                insert into user_profile_drafts (
                  user_id, username, email, rating, transaction_count, genres, email_verified
                )
                values ($1, $2, $3, $4, $5, $6::jsonb, $7)
                on conflict (user_id) do update set
                  username = excluded.username,
                  email = excluded.email,
                  rating = excluded.rating,
                  transaction_count = excluded.transaction_count,
                  genres = excluded.genres,
                  email_verified = excluded.email_verified,
                  updated_at = now()
                returning updated_at
                """,
                user_id,
                profile["username"],
                profile["email"],
                profile["rating"],
                profile["transactionCount"],
                json.dumps(profile["genres"], ensure_ascii=False),
                profile["emailVerified"],
            )
    except asyncpg.PostgresError:
        return {"persisted": False, "profile": profile}

    return {
        "persisted": True,
        "profile": {
            **profile,
            "updatedAt": row["updated_at"].isoformat() if row else None,
        },
    }


@app.get("/users/{user_id}/listing-draft")
async def get_listing_draft(user_id: str):
    if not db_pool:
        return {"persisted": False, "draft": None}

    try:
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                select draft, updated_at
                from user_listing_drafts
                where user_id = $1
                """,
                user_id,
            )
    except asyncpg.PostgresError:
        return {"persisted": False, "draft": None}

    if not row:
        return {"persisted": False, "draft": None}

    return {
        "persisted": True,
        "draft": normalize_json_object(row["draft"]),
        "updatedAt": row["updated_at"].isoformat(),
    }


@app.put("/users/{user_id}/listing-draft")
async def upsert_listing_draft(user_id: str, payload: ListingDraftUpsert):
    draft = normalize_json_object(payload.draft)

    if not db_pool:
        return {"persisted": False, "draft": draft}

    try:
        async with db_pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                insert into user_listing_drafts (user_id, draft)
                values ($1, $2::jsonb)
                on conflict (user_id) do update set
                  draft = excluded.draft,
                  updated_at = now()
                returning updated_at
                """,
                user_id,
                json.dumps(draft, ensure_ascii=False),
            )
    except asyncpg.PostgresError:
        return {"persisted": False, "draft": draft}

    return {
        "persisted": True,
        "draft": draft,
        "updatedAt": row["updated_at"].isoformat() if row else None,
    }


@app.delete("/users/{user_id}/listing-draft")
async def delete_listing_draft(user_id: str):
    if not db_pool:
        return {"deleted": False}

    try:
        async with db_pool.acquire() as connection:
            result = await connection.execute(
                "delete from user_listing_drafts where user_id = $1",
                user_id,
            )
    except asyncpg.PostgresError:
        return {"deleted": False}

    return {"deleted": not result.endswith(" 0")}


async def load_chat_messages(chat_id: str) -> tuple[list[dict], bool]:
    if db_pool:
        try:
            async with db_pool.acquire() as connection:
                rows = await connection.fetch(
                    """
                    select id, chat_id, sender_id, sender_name, content, message_type, created_at
                    from realtime_chat_messages
                    where chat_id = $1
                    order by created_at asc
                    """,
                    chat_id,
                )
                return [normalize_chat_message(dict(row)) for row in rows], True
        except asyncpg.PostgresError as exc:
            logger.warning("Failed to load chat messages from PostgreSQL: %s", exc)

    chats = read_file_chats()
    messages = chats.get(chat_id, [])
    if not isinstance(messages, list):
        messages = []
    return [normalize_chat_message({**message, "chatId": chat_id}) for message in messages], True


async def save_chat_message(chat_id: str, payload: ChatMessageCreate) -> dict:
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="message content is required")

    message = normalize_chat_message({
        "id": f"msg-{int(datetime.now().timestamp() * 1000)}",
        "chatId": chat_id,
        "senderId": payload.sender_id.strip() or "buyer1",
        "senderName": payload.sender_name.strip() or "사용자",
        "message": content,
        "timestamp": datetime.now().isoformat(),
        "type": payload.message_type or "text",
    })

    if db_pool:
        try:
            async with db_pool.acquire() as connection:
                row = await connection.fetchrow(
                    """
                    insert into realtime_chat_messages (
                      id, chat_id, sender_id, sender_name, content, message_type
                    )
                    values ($1, $2, $3, $4, $5, $6)
                    returning id, chat_id, sender_id, sender_name, content, message_type, created_at
                    """,
                    message["id"],
                    chat_id,
                    message["senderId"],
                    message["senderName"],
                    message["message"],
                    message["type"],
                )
                return normalize_chat_message(dict(row))
        except asyncpg.PostgresError as exc:
            logger.warning("Failed to persist chat message to PostgreSQL: %s", exc)

    chats = read_file_chats()
    room = chats.setdefault(chat_id, [])
    if not isinstance(room, list):
        room = []
        chats[chat_id] = room
    room.append(message)
    write_file_chats(chats)
    return message


@app.get("/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str):
    messages, persisted = await load_chat_messages(chat_id)
    return {"chatId": chat_id, "persisted": persisted, "messages": messages}


@app.post("/chats/{chat_id}/messages")
async def post_chat_message(chat_id: str, payload: ChatMessageCreate):
    message = await save_chat_message(chat_id, payload)
    event = {"type": "message", "chatId": chat_id, "message": message}
    await chat_manager.broadcast(chat_id, event)
    return event


@app.websocket("/ws/chats/{chat_id}")
async def chat_websocket(websocket: WebSocket, chat_id: str):
    await chat_manager.connect(chat_id, websocket)
    try:
        history, _ = await load_chat_messages(chat_id)
        await websocket.send_json({"type": "history", "chatId": chat_id, "messages": history})
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type", "message")
            if event_type == "ping":
                await websocket.send_json({"type": "pong", "chatId": chat_id})
                continue
            if event_type != "message":
                await websocket.send_json({"type": "error", "message": "unsupported event type"})
                continue
            message = await save_chat_message(
                chat_id,
                ChatMessageCreate(
                    sender_id=str(payload.get("senderId") or payload.get("sender_id") or "buyer1"),
                    sender_name=str(payload.get("senderName") or payload.get("sender_name") or "사용자"),
                    content=str(payload.get("message") or payload.get("content") or ""),
                    message_type=str(payload.get("messageType") or payload.get("message_type") or "text"),
                ),
            )
            await chat_manager.broadcast(chat_id, {"type": "message", "chatId": chat_id, "message": message})
    except WebSocketDisconnect:
        chat_manager.disconnect(chat_id, websocket)
    except HTTPException as exc:
        await websocket.send_json({"type": "error", "message": exc.detail})
    finally:
        chat_manager.disconnect(chat_id, websocket)


@app.get("/listings")
async def list_listings(q: str | None = None):
    persisted: list[dict] = []
    if db_pool:
        try:
            async with db_pool.acquire() as connection:
                rows = await connection.fetch(
                    """
                    select id, seller_id, title, artist, catalog_number, price, description,
                           tags, images, genre, year, location, audio_grade, audio_score,
                           jacket_grade, jacket_score, is_rare, is_first_press,
                           analysis_report, views, created_at
                    from listings
                    order by created_at desc
                    """
                )
                persisted = [listing_to_album(dict(row)) for row in rows]
        except asyncpg.PostgresError:
            persisted = []
    else:
        persisted = [listing_to_album(item) for item in read_file_listings()]

    listings = persisted + [listing_to_album(item) for item in MOCK_LISTINGS]
    if not q:
        return listings

    normalized = q.lower()
    return [
        item
        for item in listings
        if normalized in item["title"].lower()
        or normalized in item["artist"].lower()
        or normalized in item["catalogNumber"].lower()
    ]


@app.post("/listings")
async def create_listing(payload: ListingCreate):
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if payload.price <= 0:
        raise HTTPException(status_code=400, detail="price must be positive")

    now = datetime.now()
    listing_id = f"listing-{int(now.timestamp() * 1000)}"
    listing = {
        "id": listing_id,
        "seller_id": payload.user_id or "seller1",
        "title": title,
        "artist": payload.artist or "",
        "catalog_number": payload.catalog_number or "",
        "price": payload.price,
        "description": payload.description or "",
        "tags": normalize_tags(payload.tags),
        "images": payload.images,
        "genre": payload.genre or "",
        "year": payload.year,
        "location": payload.location or "지역 미입력",
        "audio_grade": payload.audio_grade,
        "audio_score": payload.audio_score,
        "jacket_grade": payload.jacket_grade,
        "jacket_score": payload.jacket_score,
        "is_rare": payload.is_rare,
        "is_first_press": payload.is_first_press,
        "analysis_report": payload.analysis_report,
        "views": 0,
        "created_at": now.isoformat(),
        "owned_by_me": True,
    }

    persisted = False
    if db_pool:
        try:
            async with db_pool.acquire() as connection:
                await connection.execute(
                    """
                    insert into listings (
                      id, seller_id, title, artist, catalog_number, price, description,
                      tags, images, genre, year, location, audio_grade, audio_score,
                      jacket_grade, jacket_score, is_rare, is_first_press, analysis_report
                    )
                    values (
                      $1, $2, $3, $4, $5, $6, $7,
                      $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14,
                      $15, $16, $17, $18, $19::jsonb
                    )
                    """,
                    listing["id"],
                    listing["seller_id"],
                    listing["title"],
                    listing["artist"],
                    listing["catalog_number"],
                    listing["price"],
                    listing["description"],
                    json.dumps(listing["tags"], ensure_ascii=False),
                    json.dumps(listing["images"], ensure_ascii=False),
                    listing["genre"],
                    listing["year"],
                    listing["location"],
                    listing["audio_grade"],
                    listing["audio_score"],
                    listing["jacket_grade"],
                    listing["jacket_score"],
                    listing["is_rare"],
                    listing["is_first_press"],
                    json.dumps(listing["analysis_report"], ensure_ascii=False),
                )
                persisted = True
        except asyncpg.PostgresError as exc:
            logger.warning("Failed to persist listing to PostgreSQL: %s", exc)

    if not persisted:
        listings = read_file_listings()
        listings.insert(0, listing)
        write_file_listings(listings)
        persisted = True

    return {
        "status": "published",
        "persisted": persisted,
        "listing": listing_to_album(listing),
    }


@app.post("/uploads/images")
async def upload_image(file: Annotated[UploadFile, File()]):
    return {"filename": file.filename, "content_type": file.content_type, "url": f"/media/{file.filename}"}


def sample_analysis(file: UploadFile | None, noisy: bool):
    if not file:
        return None
    return {
        "filename": file.filename,
        "requestedSeconds": 30,
        "estimatedNoiseLevel": "medium" if noisy else "low",
        "scratchRisk": "visible-scratch-section" if noisy else "low",
        "usableForListingSample": not noisy,
    }


def audio_grade_from_score(score: int) -> str:
    if score >= 90:
        return "NM"
    if score >= 82:
        return "VG+"
    if score >= 72:
        return "VG"
    if score >= 62:
        return "G+"
    return "G"


def audio_risk_label(score: int) -> str:
    if score >= 84:
        return "low"
    if score >= 72:
        return "medium"
    return "high"


def analyze_audio_bytes(content: bytes, filename: str | None, content_type: str | None, label: str):
    import librosa

    suffix = os.path.splitext(filename or "")[1] or ".wav"
    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        waveform, sr = librosa.load(temp_path, sr=22050, mono=False, duration=35)
        if waveform.ndim == 1:
            mono = waveform.astype(np.float32)
            channel_imbalance_db = 0.0
        else:
            mono = np.mean(waveform, axis=0).astype(np.float32)
            channel_rms = np.sqrt(np.mean(np.square(waveform), axis=1) + 1e-12)
            channel_imbalance_db = float(abs(20 * np.log10((channel_rms[0] + 1e-9) / (channel_rms[-1] + 1e-9))))

        if mono.size < sr:
            raise ValueError("audio sample is too short")

        mono = mono - float(np.mean(mono))
        duration = float(mono.size / sr)
        rms = float(np.sqrt(np.mean(np.square(mono)) + 1e-12))
        peak = float(np.max(np.abs(mono)) + 1e-12)
        rms_db = float(20 * np.log10(rms + 1e-12))
        peak_db = float(20 * np.log10(peak + 1e-12))
        clipping_ratio = float(np.mean(np.abs(mono) >= 0.98))

        frame_rms = librosa.feature.rms(y=mono, frame_length=2048, hop_length=512)[0]
        frame_rms_db = librosa.amplitude_to_db(frame_rms + 1e-9, ref=1.0)
        noise_floor_db = float(np.percentile(frame_rms_db, 15))
        loud_floor_gap_db = float(np.percentile(frame_rms_db, 90) - np.percentile(frame_rms_db, 15))

        diff = np.abs(np.diff(mono))
        threshold = max(float(np.mean(diff) + 6.0 * np.std(diff)), float(np.percentile(diff, 99.75)))
        raw_click_indices = np.flatnonzero(diff > threshold)
        if raw_click_indices.size:
            separated = [int(raw_click_indices[0])]
            min_gap = int(sr * 0.025)
            for index in raw_click_indices[1:]:
                if int(index) - separated[-1] >= min_gap:
                    separated.append(int(index))
            click_count = len(separated)
        else:
            click_count = 0
        clicks_per_minute = float(click_count / max(duration, 1.0) * 60.0)

        zcr = float(np.mean(librosa.feature.zero_crossing_rate(mono, frame_length=2048, hop_length=512)))
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=mono, sr=sr)))
        spectral_flatness = float(np.mean(librosa.feature.spectral_flatness(y=mono)))

        score = 94.0
        score -= min(22.0, clicks_per_minute * 0.85)
        if noise_floor_db > -36:
            score -= min(18.0, (noise_floor_db + 36) * 1.6)
        elif noise_floor_db > -48:
            score -= min(8.0, (noise_floor_db + 48) * 0.55)
        score -= min(12.0, clipping_ratio * 800.0)
        score -= min(6.0, max(0.0, channel_imbalance_db - 1.5) * 1.2)
        if loud_floor_gap_db < 12:
            score -= (12 - loud_floor_gap_db) * 0.5
        if zcr > 0.18:
            score -= min(6.0, (zcr - 0.18) * 30.0)
        if spectral_flatness > 0.08:
            score -= min(6.0, (spectral_flatness - 0.08) * 45.0)
        score = int(max(45, min(96, round(score))))

        estimated_noise = "high" if noise_floor_db > -34 or clicks_per_minute >= 16 else "medium" if noise_floor_db > -46 or clicks_per_minute >= 6 else "low"
        scratch_risk = "high" if clicks_per_minute >= 16 else "medium" if clicks_per_minute >= 6 else "low"
        clipping_risk = "high" if clipping_ratio >= 0.01 else "medium" if clipping_ratio >= 0.002 else "low"
        usable = label == "good" and score >= 78 and clipping_risk != "high"

        return {
            "filename": filename or "audio-sample",
            "requestedSeconds": 30,
            "durationSeconds": round(duration, 1),
            "sampleRate": sr,
            "score": score,
            "estimatedNoiseLevel": estimated_noise,
            "scratchRisk": scratch_risk,
            "usableForListingSample": usable,
            "clickCount": click_count,
            "clicksPerMinute": round(clicks_per_minute, 1),
            "noiseFloorDb": round(noise_floor_db, 1),
            "dynamicRangeDb": round(loud_floor_gap_db, 1),
            "peakDb": round(peak_db, 1),
            "rmsDb": round(rms_db, 1),
            "clippingRisk": clipping_risk,
            "channelImbalanceDb": round(channel_imbalance_db, 1),
            "spectralCentroid": round(spectral_centroid, 0),
            "spectralFlatness": round(spectral_flatness, 4),
        }
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


async def analyze_audio_upload(file: UploadFile | None, label: str):
    if not file:
        return None
    content = await file.read()
    if not content:
        return None
    return analyze_audio_bytes(content, file.filename, file.content_type, label)


def analyze_jacket_condition_cv(content: bytes, content_type: str | None):
    normalized_type = (content_type or "").lower()
    if not normalized_type.startswith("image/"):
        return JacketConditionResult(
            jacketScore=78,
            jacketGrade="VG",
            cornerWear="medium",
            ringWear="medium",
            stainRisk="medium",
            tearOrCreaseRisk="medium",
            notes=["이미지 형식이 명확하지 않아 보수적인 자켓 상태 점수를 적용했습니다."],
        )

    image_array = np.frombuffer(content, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return JacketConditionResult(
            jacketScore=76,
            jacketGrade="VG",
            cornerWear="medium",
            ringWear="medium",
            stainRisk="medium",
            tearOrCreaseRisk="medium",
            notes=["자켓 이미지를 읽지 못해 실물 추가 확인을 권장합니다."],
        )

    height, width = image.shape[:2]
    max_side = 900
    scale = min(1.0, max_side / max(height, width))
    if scale < 1.0:
        image = cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)
        height, width = image.shape[:2]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    min_side = min(width, height)

    edge = max(10, int(min_side * 0.08))
    edge_mask = np.zeros((height, width), dtype=np.uint8)
    edge_mask[:edge, :] = 255
    edge_mask[-edge:, :] = 255
    edge_mask[:, :edge] = 255
    edge_mask[:, -edge:] = 255
    edges = cv2.Canny(gray, 55, 150)
    edge_density = float(np.count_nonzero(cv2.bitwise_and(edges, edges, mask=edge_mask))) / float(np.count_nonzero(edge_mask))

    corner = max(18, int(min_side * 0.16))
    corner_patches = [
        gray[:corner, :corner],
        gray[:corner, -corner:],
        gray[-corner:, :corner],
        gray[-corner:, -corner:],
    ]
    corner_variation = float(np.mean([np.std(patch) for patch in corner_patches if patch.size]))
    corner_wear = risk_level(edge_density + corner_variation / 260.0, 0.13, 0.22)

    blurred = cv2.medianBlur(gray, 5)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.25,
        minDist=max(80, min_side // 2),
        param1=80,
        param2=24,
        minRadius=int(min_side * 0.23),
        maxRadius=int(min_side * 0.48),
    )
    ring_wear = "medium" if circles is not None else "low"
    if circles is not None and len(circles[0]) >= 2:
        ring_wear = "high"

    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    low_sat_dark = cv2.inRange(hsv, np.array([0, 0, 35]), np.array([179, 70, 145]))
    stain_ratio = float(np.count_nonzero(low_sat_dark)) / float(width * height)
    value_std = float(np.std(value))
    stain_risk = risk_level(stain_ratio + value_std / 900.0, 0.12, 0.24)

    line_segments = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=70,
        minLineLength=max(45, min_side // 5),
        maxLineGap=10,
    )
    crease_count = 0
    if line_segments is not None:
        for x1, y1, x2, y2 in line_segments[:, 0]:
            length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
            if length >= min_side * 0.22:
                crease_count += 1
    tear_or_crease_risk = "high" if crease_count >= 8 else "medium" if crease_count >= 3 else "low"

    risk_penalty = {
        "low": 0,
        "medium": 7,
        "high": 15,
    }
    score = 94
    score -= risk_penalty[corner_wear]
    score -= risk_penalty[ring_wear]
    score -= risk_penalty[stain_risk]
    score -= risk_penalty[tear_or_crease_risk]
    score = max(55, min(96, score))
    grade = grade_from_score(score)

    notes: list[str] = []
    notes.append("모서리 마모가 낮게 보입니다." if corner_wear == "low" else "모서리/테두리 마모 후보가 감지되었습니다.")
    notes.append("링웨어가 약합니다." if ring_wear == "low" else "중앙 원형 링웨어 후보가 감지되었습니다.")
    notes.append("얼룩 또는 변색 후보가 적습니다." if stain_risk == "low" else "얼룩/변색 후보가 있어 실물 확인을 권장합니다.")
    notes.append("큰 접힘이나 찢김 후보는 적습니다." if tear_or_crease_risk == "low" else "긴 선형 접힘/찢김 후보가 감지되었습니다.")

    return JacketConditionResult(
        jacketScore=score,
        jacketGrade=grade,
        cornerWear=corner_wear,
        ringWear=ring_wear,
        stainRisk=stain_risk,
        tearOrCreaseRisk=tear_or_crease_risk,
        notes=notes,
    )


@app.post("/analysis/jacket-condition")
async def analyze_jacket_condition(file: Annotated[UploadFile, File()]):
    content = await file.read()
    return analyze_jacket_condition_cv(content, file.content_type)


@app.post("/analysis/audio")
async def analyze_audio(file: Annotated[UploadFile, File()]):
    sample = await analyze_audio_upload(file, "good")
    score = int(sample["score"]) if sample else 60
    return {
        "filename": file.filename,
        "audio_score": score,
        "audio_grade": audio_grade_from_score(score),
        "noise_level": sample["estimatedNoiseLevel"] if sample else "unknown",
        "certified": bool(sample and score >= 72),
        "sample": sample,
    }


@app.post("/analysis/lp-recognition")
async def analyze_lp_recognition(
    file: Annotated[UploadFile, File()],
    media_type: Annotated[str, Form()] = "image",
):
    safe_media_type = "video" if media_type == "video" else "image"
    content = await file.read()
    file_size = len(content)
    source = "heuristic"
    opencv_result = (
        opencv_lp_recognition(content, file.content_type)
        if safe_media_type == "image"
        else opencv_video_surface_recognition(content, file.content_type)
    )

    if opencv_result:
        if isinstance(opencv_result, dict):
            is_record = bool(opencv_result["is_record"])
            confidence = int(opencv_result["confidence"])
            signals = list(opencv_result["signals"])
            condition = {
                "surfaceScore": int(opencv_result["surfaceScore"]),
                "scratchCount": int(opencv_result["scratchCount"]),
                "scratchRisk": str(opencv_result["scratchRisk"]),
                "reflectionRisk": str(opencv_result["reflectionRisk"]),
                "scratchRegions": list(opencv_result.get("scratchRegions", [])),
                "dustOrReflectionNote": str(opencv_result["dustOrReflectionNote"]),
                "playbackImpact": str(opencv_result["playbackImpact"]),
            }
        else:
            is_record, confidence, signals = opencv_result
            condition = surface_condition_payload(confidence=confidence, source="opencv")
        source = "opencv"
    else:
        ai_result = None
        if safe_media_type == "image":
            ai_result = await ai_lp_recognition(content, file.filename, file.content_type)

        if ai_result:
            is_record, confidence, signals = ai_result
            source = os.getenv("OPENAI_VISION_MODEL", "gpt-4.1-mini")
            condition = heuristic_surface_condition_payload(
                file_size=file_size,
                media_type=safe_media_type,
                filename=file.filename,
                content_type=file.content_type,
                confidence=confidence,
            )
        else:
            is_record, confidence, signals = heuristic_lp_recognition(
                file_size=file_size,
                media_type=safe_media_type,
                filename=file.filename,
                content_type=file.content_type,
            )
            condition = heuristic_surface_condition_payload(
                file_size=file_size,
                media_type=safe_media_type,
                filename=file.filename,
                content_type=file.content_type,
                confidence=confidence,
            )
    is_record, confidence, signals = normalize_visual_condition_result(is_record, confidence, signals)
    confidence = min(confidence, condition["surfaceScore"] + 3)
    analysis_id = await save_lp_recognition_analysis(
        media_type=safe_media_type,
        filename=file.filename,
        content_type=file.content_type,
        file_size=file_size,
        is_record=is_record,
        confidence=confidence,
        signals=signals,
        source=source,
    )
    return LpRecognitionResult(
        id=analysis_id,
        isRecord=is_record,
        confidence=confidence,
        signals=signals,
        source=source,
        persisted=analysis_id is not None,
        **condition,
    )


@app.post("/analysis/audio-samples")
async def analyze_audio_samples(
    good_sample: Annotated[UploadFile | None, File()] = None,
    noisy_sample: Annotated[UploadFile | None, File()] = None,
):
    try:
        good_result = await analyze_audio_upload(good_sample, "good")
        noisy_result = await analyze_audio_upload(noisy_sample, "noisy")
    except Exception as exc:
        logger.warning("librosa audio analysis failed; falling back to heuristic: %s", exc)
        size_seed = (good_sample.size or 0 if good_sample else 0) + (noisy_sample.size or 0 if noisy_sample else 0)
        audio_score = max(62, min(86, 82 - round((size_seed % 17) / 2)))
        return {
            "source": "fallback",
            "audioScore": audio_score,
            "audioGrade": audio_grade_from_score(audio_score),
            "playbackRisk": audio_risk_label(audio_score),
            "clickCount": 0,
            "noiseFloorDb": None,
            "dynamicRangeDb": None,
            "goodSample": sample_analysis(good_sample, False),
            "noisySample": sample_analysis(noisy_sample, True),
            "summary": "오디오 파일을 직접 해석하지 못해 보수적인 fallback 점수를 적용했습니다.",
        }

    sample_scores = [item["score"] for item in [good_result, noisy_result] if item]
    if not sample_scores:
        audio_score = 0
    elif good_result and noisy_result:
        gap_penalty = max(0, good_result["score"] - noisy_result["score"] - 10) * 0.25
        audio_score = int(round(good_result["score"] * 0.62 + noisy_result["score"] * 0.38 - gap_penalty))
    else:
        audio_score = int(sample_scores[0])
    audio_score = max(45, min(96, audio_score))
    click_count = int((good_result or {}).get("clickCount", 0) + (noisy_result or {}).get("clickCount", 0))
    noise_values = [item["noiseFloorDb"] for item in [good_result, noisy_result] if item]
    dynamic_values = [item["dynamicRangeDb"] for item in [good_result, noisy_result] if item]
    playback_risk = audio_risk_label(audio_score)
    if noisy_result and noisy_result["scratchRisk"] == "high":
        playback_risk = "high"
    elif noisy_result and noisy_result["scratchRisk"] == "medium" and playback_risk == "low":
        playback_risk = "medium"

    summary_parts = [
        f"클릭/팝 후보 {click_count}개",
        f"노이즈 플로어 {round(float(np.mean(noise_values)), 1)} dB" if noise_values else "노이즈 플로어 미측정",
        f"다이내믹 레인지 {round(float(np.mean(dynamic_values)), 1)} dB" if dynamic_values else "다이내믹 레인지 미측정",
    ]
    return {
        "source": "librosa",
        "audioScore": audio_score,
        "audioGrade": audio_grade_from_score(audio_score),
        "playbackRisk": playback_risk,
        "clickCount": click_count,
        "noiseFloorDb": round(float(np.mean(noise_values)), 1) if noise_values else None,
        "dynamicRangeDb": round(float(np.mean(dynamic_values)), 1) if dynamic_values else None,
        "goodSample": good_result,
        "noisySample": noisy_result,
        "summary": " · ".join(summary_parts),
    }


@app.get("/pricing/recommendation")
async def recommend_price(catalog_number: str | None = None, title: str | None = None):
    match = next(
        (
            item
            for item in MOCK_LISTINGS
            if catalog_number and item["catalog_number"].lower() == catalog_number.lower()
        ),
        None,
    )
    if match:
        return {"recommended_price": match["price"], "reason": "catalog_number_match"}
    return {"recommended_price": 275000, "reason": "market_average"}


@app.get("/discogs/search")
async def search_discogs(
    catalog_number: str | None = None,
    album_title: str | None = None,
    artist: str | None = None,
):
    query = (catalog_number or "").strip()
    title = (album_title or "").strip()
    artist_name = (artist or "").strip()
    if not query and not title and not artist_name:
        return {"candidates": mock_discogs_candidates(catalog_number), "source": "mock"}

    token = os.getenv("DISCOGS_TOKEN")
    headers = {"User-Agent": "Vinyl-Check/0.1"}
    if token:
        headers["Authorization"] = f"Discogs token={token}"

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            results = await fetch_discogs_results(client, query, headers, title, artist_name)
    except httpx.HTTPError:
        return {"candidates": mock_discogs_candidates(catalog_number), "source": "mock"}

    fallback_catalog = query or " ".join(part for part in [artist_name, title] if part)
    candidates = [discogs_result_to_candidate(item, fallback_catalog) for item in results[:5]]
    return {
        "candidates": candidates or mock_discogs_candidates(catalog_number),
        "source": "discogs" if candidates else "mock",
    }


@app.get("/discogs/track-recommendations")
async def discogs_track_recommendations(catalog_number: str | None = None):
    query = (catalog_number or "").strip()
    if not query:
        return mock_track_recommendations(catalog_number)

    token = os.getenv("DISCOGS_TOKEN")
    headers = {"User-Agent": "VinylCheck/0.1"}
    if token:
        headers["Authorization"] = f"Discogs token={token}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            results = await fetch_discogs_results(client, query, headers)
            release = next((item for item in results if item.get("type") in (None, "release")), results[0] if results else None)
            release_id = release.get("id") if release else None
            if not release_id:
                return mock_track_recommendations(catalog_number)
            response = await client.get(f"https://api.discogs.com/releases/{release_id}", headers=headers)
            response.raise_for_status()
            release_data = response.json()
    except (httpx.HTTPError, IndexError, KeyError):
        return mock_track_recommendations(catalog_number)

    tracklist = release_data.get("tracklist") or []
    recommendations = recommend_audio_tracks(tracklist)
    return {
        **recommendations,
        "source": "discogs",
        "releaseTitle": release_data.get("title") or "",
        "catalogNumber": query,
    }


@app.post("/offers")
async def create_offer(payload: OfferCreate):
    return {"id": f"offer-{int(datetime.now().timestamp())}", "status": "pending", **payload.model_dump()}


@app.post("/transactions/{transaction_id}/completion")
async def update_completion(transaction_id: str, payload: CompletionUpdate):
    return {
        "transaction_id": transaction_id,
        "status": "completed" if payload.buyer_checked and payload.seller_checked else "selling",
        **payload.model_dump(),
    }
