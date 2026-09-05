from __future__ import annotations

import re
from statistics import mean
from typing import Any


GRADE_RANK = {
    "M": 7,
    "NM": 6,
    "NM-": 6,
    "EX": 5,
    "VG+": 4,
    "VG": 3,
    "G": 2,
    "F": 1,
    "P": 1,
}

GRADE_BANDS = {
    "M": (1.02, 1.35),
    "NM": (0.92, 1.25),
    "NM-": (0.92, 1.25),
    "EX": (0.82, 1.12),
    "VG+": (0.70, 0.98),
    "VG": (0.55, 0.82),
    "G": (0.35, 0.60),
    "F": (0.18, 0.38),
    "P": (0.18, 0.38),
}


def _value(item: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in item and item.get(key) not in (None, ""):
            return item.get(key)
    return default


def _int_value(item: dict[str, Any], *keys: str, default: int = 0) -> int:
    value = _value(item, *keys, default=default)
    try:
        return int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return default


def _bool_value(item: dict[str, Any], *keys: str) -> bool:
    value = _value(item, *keys, default=False)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "first", "only"}
    return bool(value)


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return re.sub(r"[^0-9a-z가-힣+ -]+", "", text).strip()


def round_price(value: float, unit: int = 1000) -> int:
    if value <= 0:
        return unit
    return max(unit, int(round(value / unit) * unit))


def normalize_grade(grade: Any, score: Any = None) -> str:
    raw = str(grade or "").strip().upper().replace(" ", "")
    aliases = {
        "MINT": "M",
        "NEARMINT": "NM",
        "NM/M-": "NM",
        "EXCELLENT": "EX",
        "VERYGOODPLUS": "VG+",
        "VERYGOOD": "VG",
        "G+": "G",
        "GOODPLUS": "G",
        "GOOD": "G",
        "F": "P",
        "FAIR": "P",
        "POOR": "P",
    }
    if raw in aliases:
        raw = aliases[raw]
    if raw in GRADE_RANK:
        return raw
    try:
        numeric_score = int(float(str(score)))
    except (TypeError, ValueError):
        numeric_score = 0
    if numeric_score >= 96:
        return "M"
    if numeric_score >= 88:
        return "NM"
    if numeric_score >= 80:
        return "EX"
    if numeric_score >= 70:
        return "VG+"
    if numeric_score >= 58:
        return "VG"
    if numeric_score >= 45:
        return "G"
    return "P"


def grade_rank(grade: Any) -> int:
    return GRADE_RANK.get(normalize_grade(grade), 0)


def grade_midpoint(grade: Any) -> float:
    lower, upper = GRADE_BANDS.get(normalize_grade(grade), GRADE_BANDS["G"])
    return (lower + upper) / 2


def effective_media_grade(listing: dict[str, Any]) -> str:
    return normalize_grade(
        _value(listing, "audio_grade", "audioGrade", "media_grade", "mediaGrade"),
        _value(listing, "audio_score", "audioScore", "media_score", "mediaScore"),
    )


def effective_sleeve_grade(listing: dict[str, Any]) -> str:
    return normalize_grade(
        _value(listing, "jacket_grade", "jacketGrade", "sleeve_grade", "sleeveGrade"),
        _value(listing, "jacket_score", "jacketScore", "sleeve_score", "sleeveScore"),
    )


def normalize_market_key(listing: dict[str, Any]) -> str:
    analysis = listing.get("analysis_report") if isinstance(listing.get("analysis_report"), dict) else {}
    pressing = _normalize_text(_value(listing, "pressing", "pressing_condition", "pressingCondition", default=analysis.get("pressing"))) or "standard"
    catalog = _normalize_text(_value(listing, "catalog_number", "catalogNumber"))
    if catalog:
        return f"catalog:{catalog}|pressing:{pressing}"
    title = _normalize_text(_value(listing, "title", default="untitled"))
    artist = _normalize_text(_value(listing, "artist", default="unknown"))
    year = str(_value(listing, "year", default="")).strip()
    return f"album:{title}|artist:{artist}|year:{year}|pressing:{pressing}"


def _status(item: dict[str, Any]) -> str:
    return str(_value(item, "status", default="published")).lower()


def _same_market_items(listing: dict[str, Any], listings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    target_key = normalize_market_key(listing)
    target_id = str(_value(listing, "id", default=""))
    return [
        item
        for item in listings
        if str(_value(item, "id", default="")) != target_id
        and _status(item) not in {"hidden", "deleted", "sold"}
        and normalize_market_key(item) == target_key
    ]


def _same_market_history(listing: dict[str, Any], price_history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    target_key = normalize_market_key(listing)
    return [item for item in price_history if str(_value(item, "market_key", "marketKey", default="")) == target_key]


def _active_buy_orders_for_key(market_key: str, buy_orders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        order
        for order in buy_orders
        if str(_value(order, "status", default="active")).lower() == "active"
        and str(_value(order, "market_key", "marketKey", default="")) == market_key
    ]


def _condition_seed_base(listing: dict[str, Any]) -> int:
    price = _int_value(listing, "seller_price", "sellerPrice", "price")
    if price <= 0:
        return 30000
    midpoint = max(0.3, grade_midpoint(effective_media_grade(listing)))
    return round_price(price / midpoint)


def _catalog_seed_base(listing: dict[str, Any]) -> int:
    """App-owned fallback so a first listing does not fully define its own market."""
    base = 48000.0
    year = _int_value(listing, "year")
    if 1900 <= year <= 1979:
        base *= 1.45
    elif 1980 <= year <= 1999:
        base *= 1.18
    elif year >= 2015:
        base *= 0.92
    if _value(listing, "catalog_number", "catalogNumber"):
        base *= 1.08
    tags = " ".join(str(tag) for tag in (_value(listing, "tags", default=[]) or []))
    if any(keyword in _normalize_text(tags) for keyword in ("limited", "promo", "obi", "signed", "mono", "한정")):
        base *= 1.18
    return round_price(base)


def _weighted_average(parts: list[tuple[float, float]]) -> float:
    valid = [(value, weight) for value, weight in parts if value > 0 and weight > 0]
    total_weight = sum(weight for _, weight in valid)
    if total_weight <= 0:
        return 0
    return sum(value * weight for value, weight in valid) / total_weight


def calculate_base_price(
    listing: dict[str, Any],
    listings: list[dict[str, Any]],
    buy_orders: list[dict[str, Any]],
    price_history: list[dict[str, Any]],
) -> int:
    market_key = normalize_market_key(listing)
    same_listings = _same_market_items(listing, listings)
    same_history = _same_market_history(listing, price_history)
    active_orders = _active_buy_orders_for_key(market_key, buy_orders)

    listing_prices = [_int_value(item, "seller_price", "sellerPrice", "price") for item in same_listings]
    listing_prices = [price for price in listing_prices if price > 0]
    history_prices = [_int_value(item, "trade_price", "tradePrice", "price") for item in same_history[-12:]]
    history_prices = [price for price in history_prices if price > 0]
    order_prices = [_int_value(order, "max_price", "maxPrice") for order in active_orders]
    order_prices = [price for price in order_prices if price > 0]

    persisted_base = _int_value(listing, "base_price", "basePrice")
    seller_seed_base = _condition_seed_base(listing)
    catalog_seed_base = _catalog_seed_base(listing)
    raw_base = _weighted_average(
        [
            (mean(history_prices) if history_prices else 0, 0.45),
            (mean(listing_prices) if listing_prices else 0, 0.30),
            (mean(order_prices) if order_prices else 0, 0.15),
            (persisted_base, 0.25),
            (catalog_seed_base, 0.20 if not persisted_base else 0.05),
            (seller_seed_base, 0.10),
        ]
    ) or catalog_seed_base

    media_factor = {"M": 1.12, "NM": 1.08, "NM-": 1.08, "EX": 1.03, "VG+": 1.0, "VG": 0.92, "G": 0.72, "F": 0.50, "P": 0.50}.get(effective_media_grade(listing), 0.9)
    supply_count = len(same_listings) + 1
    demand_factor = 1.0
    demand_factor += min(0.14, len(active_orders) * 0.025)
    demand_factor += min(0.06, _int_value(listing, "favorite_count", "favoriteCount") * 0.004)
    demand_factor += min(0.05, _int_value(listing, "view_count", "viewCount", "views") * 0.0005)
    if supply_count <= 1:
        demand_factor += 0.04
    elif supply_count >= 4:
        demand_factor -= min(0.15, (supply_count - 3) * 0.035)

    return round_price(raw_base * media_factor * demand_factor)


def calculate_price_range(base_price: int, media_grade: Any) -> dict[str, int]:
    lower, upper = GRADE_BANDS.get(normalize_grade(media_grade), GRADE_BANDS["G"])
    return {"minPrice": round_price(base_price * lower), "maxPrice": round_price(base_price * upper)}


def calculate_recommended_price(
    base_price: int,
    listing: dict[str, Any],
    listings: list[dict[str, Any]] | None = None,
    price_history: list[dict[str, Any]] | None = None,
) -> int:
    price_range = calculate_price_range(base_price, effective_media_grade(listing))
    recommendation = base_price * grade_midpoint(effective_media_grade(listing))
    recommended = round_price(recommendation)
    return min(price_range["maxPrice"], max(price_range["minPrice"], recommended))


def _order_matches_listing(order: dict[str, Any], listing: dict[str, Any]) -> bool:
    if str(_value(order, "status", default="active")).lower() != "active":
        return False
    listing_id = str(_value(order, "listing_id", "listingId", default=""))
    if listing_id and listing_id != str(listing.get("id") or ""):
        return False
    buyer_id = str(_value(order, "buyer_id", "buyerId", default=""))
    seller_id = str(_value(listing, "seller_id", "user_id", default=""))
    if buyer_id and buyer_id == seller_id:
        return False
    if str(_value(order, "market_key", "marketKey", default="")) != normalize_market_key(listing):
        return False
    if grade_rank(effective_media_grade(listing)) < grade_rank(_value(order, "min_media_grade", "minMediaGrade", default="G")):
        return False
    pressing_condition = _normalize_text(_value(order, "pressing_condition", "pressingCondition"))
    if pressing_condition and pressing_condition not in normalize_market_key(listing):
        return False
    region = _normalize_text(_value(order, "region_preference", "regionPreference"))
    listing_region = _normalize_text(_value(listing, "location", default=""))
    if region and listing_region and region not in listing_region:
        return False
    return _int_value(order, "max_price", "maxPrice") > 0


def find_matching_buy_orders(listing: dict[str, Any], buy_orders: list[dict[str, Any]]) -> list[dict[str, Any]]:
    matches = [order for order in buy_orders if _order_matches_listing(order, listing)]
    return sorted(matches, key=lambda order: (_int_value(order, "max_price", "maxPrice"), str(_value(order, "created_at", "createdAt", default=""))), reverse=True)


def calculate_instant_sale_price(listing: dict[str, Any], buy_orders: list[dict[str, Any]]) -> int:
    matches = find_matching_buy_orders(listing, buy_orders)
    if not matches:
        return 0
    return _int_value(matches[0], "max_price", "maxPrice")


def build_market_estimate(
    listing: dict[str, Any],
    listings: list[dict[str, Any]],
    buy_orders: list[dict[str, Any]],
    price_history: list[dict[str, Any]],
    seller_price: int | None = None,
) -> dict[str, Any]:
    market_key = normalize_market_key(listing)
    listing_for_calc = {**listing, "seller_price": seller_price if seller_price is not None else _int_value(listing, "seller_price", "sellerPrice", "price")}
    base_price = calculate_base_price(listing_for_calc, listings, buy_orders, price_history)
    price_range = calculate_price_range(base_price, effective_media_grade(listing_for_calc))
    recommended_price = calculate_recommended_price(base_price, listing_for_calc, listings, price_history)
    instant_sale_price = calculate_instant_sale_price(listing_for_calc, buy_orders)
    current_price = seller_price if seller_price is not None else _int_value(listing_for_calc, "price", "seller_price", "sellerPrice")
    is_valid = price_range["minPrice"] <= current_price <= price_range["maxPrice"] if current_price > 0 else True
    price_status = "within_range"
    if current_price > 0 and current_price < price_range["minPrice"]:
        price_status = "below_range"
    elif current_price > 0 and current_price > price_range["maxPrice"]:
        price_status = "above_range"
    same_listings = _same_market_items(listing_for_calc, listings)
    matching_orders = find_matching_buy_orders(listing_for_calc, buy_orders)
    metrics = {
        "listingCount": len(same_listings) + 1,
        "buyOrderCount": len(matching_orders),
        "favoriteCount": _int_value(listing_for_calc, "favorite_count", "favoriteCount"),
        "viewCount": _int_value(listing_for_calc, "view_count", "viewCount", "views"),
        "recentTradeCount": len(_same_market_history(listing_for_calc, price_history)),
    }
    estimate = {
        "marketKey": market_key,
        "basePrice": base_price,
        "minPrice": price_range["minPrice"],
        "maxPrice": price_range["maxPrice"],
        "recommendedPrice": recommended_price,
        "instantSalePrice": instant_sale_price,
        "instantSaleAvailable": instant_sale_price > 0,
        "sellerPrice": current_price,
        "isValidPrice": is_valid,
        "priceStatus": price_status,
        "metrics": metrics,
        "reason": "규칙 기반 시세: 최근 거래, 유사 매물, 상태 등급, 수요/공급 지표를 반영했습니다.",
    }
    estimate.update(
        {
            "market_key": market_key,
            "base_price": base_price,
            "min_price": price_range["minPrice"],
            "max_price": price_range["maxPrice"],
            "recommended_price": recommended_price,
            "instant_sale_price": instant_sale_price,
            "instant_sale_available": instant_sale_price > 0,
            "seller_price": current_price,
            "is_valid_price": is_valid,
            "price_status": price_status,
        }
    )
    return estimate


def validate_listing_price(
    listing: dict[str, Any],
    listings: list[dict[str, Any]],
    buy_orders: list[dict[str, Any]],
    price_history: list[dict[str, Any]],
) -> tuple[bool, dict[str, Any], str]:
    seller_price = _int_value(listing, "price", "seller_price", "sellerPrice")
    estimate = build_market_estimate(listing, listings, buy_orders, price_history, seller_price=seller_price)
    if seller_price <= 0:
        return False, estimate, "판매 가격을 입력해 주세요."
    return True, estimate, ""


def build_market_advice(
    listing: dict[str, Any],
    listings: list[dict[str, Any]],
    buy_orders: list[dict[str, Any]],
    price_history: list[dict[str, Any]],
) -> dict[str, Any]:
    estimate = build_market_estimate(listing, listings, buy_orders, price_history)
    price = _int_value(listing, "price", "seller_price", "sellerPrice")
    advice: list[dict[str, str]] = []
    if price > estimate["recommendedPrice"] and estimate["recommendedPrice"] > 0:
        delta = round(((price - estimate["recommendedPrice"]) / estimate["recommendedPrice"]) * 100)
        advice.append({"type": "price", "severity": "warning", "message": f"현재 가격은 추천 판매가보다 {delta}% 높습니다."})
    if price > estimate["maxPrice"]:
        advice.append({"type": "range", "severity": "high", "message": "상태 등급 대비 가격이 상한가를 넘었습니다."})
    views = _int_value(listing, "view_count", "viewCount", "views")
    favorites = _int_value(listing, "favorite_count", "favoriteCount")
    if views >= 30 and favorites <= max(1, views // 20):
        advice.append({"type": "conversion", "severity": "info", "message": "조회수 대비 찜이 낮습니다. 대표 사진이나 설명 보강이 도움이 됩니다."})
    if favorites >= 3 and estimate["metrics"]["buyOrderCount"] == 0:
        advice.append({"type": "demand", "severity": "info", "message": "찜은 있지만 구매 대기가 없습니다. 추천 가격에 가까울수록 전환 가능성이 높습니다."})
    if not advice:
        advice.append({"type": "normal", "severity": "positive", "message": "현재 가격은 시세 범위 안에 있습니다."})
    return {"estimate": estimate, "advice": advice}
