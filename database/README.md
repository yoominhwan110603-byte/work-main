# Vinyl-Check database structure

This repository currently runs the FastAPI server with JSON files in `backend/data`.
The SQL files in this folder are the target relational structure for the mobile APK
flow, not the active runtime storage yet.

## Current runtime storage

- `backend/data/users.json`: login, signup, Google login, profile draft fields.
- `backend/data/listings.json`: seller listings returned to the Android APK.
- `backend/data/drafts.json`: per-user listing draft from the sell flow.
- `backend/data/chats.json`: chat rooms keyed by chat/listing id.
- `backend/data/reviews.json`: seller reviews and profile rating source.
- `backend/data/password_reset_tokens.json`: password reset code state.

## Target SQL groups

- Auth: `users`, `user_genres`, `password_reset_tokens`.
- Profile drafts: `user_profile_drafts`.
- Listings: `listings`, `listing_images`, `user_listing_drafts`.
- Analysis: `lp_recognition_analyses`, `jacket_condition_analyses`, `audio_sample_analyses`.
- Engagement: `favorites`, `comments`, `offers`, `notifications`.
- Trade and messaging: `transactions`, `chats`, `messages`.
- Reviews: `reviews`.

## Mobile API coverage

- `/auth/*` maps to `users` and `password_reset_tokens`.
- `/users/{user_id}/profile-draft` maps to `user_profile_drafts`.
- `/users/{user_id}/listing-draft` maps to `user_listing_drafts`.
- `/listings` maps to `listings` and `listing_images`.
- `/chats/{chat_id}/messages` and `/ws/chats/{chat_id}` map to `chats` and `messages`.
- `/reviews` and `/users/{user_id}/reviews` map to `reviews`.
- `/analysis/*` maps to the three analysis tables.

## Notes before migration

- The Android APK uses string ids such as `user-*`, `listing-*`, and route ids.
  The target SQL schema keeps ids as `text` for compatibility.
- The old root React web app has been removed. `apps/mobile` is now the only
  frontend application.
- Mock albums may still exist in the mobile app as a fallback path, but server
  listings are the primary source for APK flows.
