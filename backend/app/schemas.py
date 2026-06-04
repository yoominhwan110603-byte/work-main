from typing import Any

from pydantic import BaseModel


class AuthLogin(BaseModel):
    username: str
    password: str
    rememberMe: bool = True


class AuthSignup(BaseModel):
    username: str
    email: str
    password: str
    genres: list[str] = []
    emailVerificationToken: str | None = None


class AuthCheck(BaseModel):
    username: str | None = None
    email: str | None = None


class GoogleLogin(BaseModel):
    credential: str | None = None
    email: str | None = None
    name: str | None = None


class FindIdRequest(BaseModel):
    email: str


class EmailVerificationRequest(BaseModel):
    email: str


class EmailVerificationConfirm(BaseModel):
    email: str
    code: str


class PasswordResetRequest(BaseModel):
    loginId: str


class PasswordResetConfirm(BaseModel):
    resetCode: str
    password: str


class AddressApiKeyUpsert(BaseModel):
    apiKey: str


class ListingCreate(BaseModel):
    title: str
    artist: str | None = None
    catalog_number: str | None = None
    price: int
    description: str | None = None
    tags: list[str] = []
    user_id: str | None = None
    images: list[str] = []
    cover_image_data_url: str | None = None
    record_image_data_url: str | None = None
    record_video_data_url: str | None = None
    genre: str | None = None
    year: int | None = None
    location: str | None = None
    audio_grade: str | None = None
    audio_score: int | None = None
    audio_samples: dict[str, Any] = {}
    jacket_grade: str | None = None
    jacket_score: int | None = None
    is_rare: bool = False
    is_first_press: bool = False
    analysis_report: dict[str, Any] = {}


class ChatMessageCreate(BaseModel):
    sender_id: str = "buyer1"
    sender_name: str = "사용자"
    content: str
    message_type: str = "text"
    recipient_id: str | None = None
    recipient_name: str | None = None
    listing_id: str | None = None


class ProfileDraftUpsert(BaseModel):
    username: str
    email: str | None = None
    rating: float = 5.0
    transactionCount: int = 0
    genres: list[str] = []
    emailVerified: bool = True


class ListingDraftUpsert(BaseModel):
    draft: dict[str, Any]
    draftId: str | None = None
    title: str | None = None


class ReviewCreate(BaseModel):
    revieweeId: str
    reviewerId: str
    reviewerName: str | None = None
    rating: int
    comment: str | None = None
    tags: list[str] = []
    albumId: str | None = None
    albumTitle: str | None = None
    transactionId: str | None = None


class ReviewUpdate(BaseModel):
    rating: int
    comment: str | None = None
    tags: list[str] = []


class CommentCreate(BaseModel):
    userId: str = "guest"
    userName: str = "게스트"
    role: str = "buyer"
    content: str
    parentId: str | None = None


class OfferCreate(BaseModel):
    listingId: str
    buyerId: str
    buyerName: str
    sellerId: str
    sellerName: str | None = None
    offerPrice: int


class OfferStatusUpdate(BaseModel):
    status: str
