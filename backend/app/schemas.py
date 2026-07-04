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


class FindIdConfirm(BaseModel):
    email: str
    code: str


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


class ListingCreate(BaseModel):
    title: str
    artist: str | None = None
    catalog_number: str | None = None
    discogs_release_id: int | None = None
    discogs_cover_image_url: str | None = None
    release_label: str | None = None
    release_country: str | None = None
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


class BuyOrderCreate(BaseModel):
    buyer_id: str
    listing_id: str | None = None
    market_key: str | None = None
    max_price: int
    min_media_grade: str = "G"
    min_sleeve_grade: str = "G"
    pressing_condition: str | None = None
    is_first_press_only: bool = False
    region_preference: str | None = None
    status: str = "active"


class InstantSellRequest(BaseModel):
    seller_id: str | None = None


class WishlistCreate(BaseModel):
    listing_id: str | None = None
    market_key: str | None = None
    title: str | None = None
    artist: str | None = None
    catalog_number: str | None = None
    discogs_release_id: int | None = None
    cover_image_url: str | None = None
    release_label: str | None = None
    release_country: str | None = None
    year: int | None = None
    pressing_condition: str | None = None
    visibility: str = "private"


class WishlistUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    catalog_number: str | None = None
    discogs_release_id: int | None = None
    cover_image_url: str | None = None
    release_label: str | None = None
    release_country: str | None = None
    year: int | None = None
    pressing_condition: str | None = None
    visibility: str | None = None


class CollectionCreate(BaseModel):
    title: str
    artist: str = ""
    year: int = 0
    genre: str = "기타"
    catalogNumber: str = ""
    discogsReleaseId: int | None = None
    discogsCoverImageUrl: str | None = None
    releaseLabel: str | None = None
    releaseCountry: str | None = None
    pressingInfo: str | None = None
    ownershipStatus: str = "owned"
    purchasePrice: int | None = None
    notes: str = ""
    tags: list[str] = []
    images: list[str] = []
    coverImageDataUrl: str | None = None
    recordImageDataUrl: str | None = None
    recordVideoDataUrl: str | None = None
    audioGrade: str | None = None
    audioScore: int | None = None
    jacketGrade: str | None = None
    jacketScore: int | None = None
    isRare: bool = False
    isFirstPress: bool = False
    audioSamples: dict[str, Any] = {}
    visibility: str = "public"


class CollectionUpdate(CollectionCreate):
    pass


class CollectionOfferCreate(BaseModel):
    collectionId: str
    buyerId: str
    buyerName: str
    offerPrice: int
