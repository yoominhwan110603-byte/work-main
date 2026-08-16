from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np


@dataclass(frozen=True)
class DiscCandidate:
    cx: int
    cy: int
    radius: int
    score: float
    detected: bool
    method: str


@dataclass(frozen=True)
class ScratchCandidate:
    x1: int
    y1: int
    x2: int
    y2: int
    length: float
    contrast: float
    edge_support: float
    radial_score: float
    score: float
    severity: str


def analyze_record_surface_image(content: bytes, content_type: str | None = None) -> dict[str, Any] | None:
    if not content:
        return None
    if content_type and content_type.lower().startswith(("audio/", "video/")):
        return None

    image = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return None

    height, width = image.shape[:2]
    if min(height, width) < 120:
        return None

    image = _resize_for_analysis(image)
    height, width = image.shape[:2]
    min_side = min(height, width)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    exposure = float(np.mean(hsv[:, :, 2]))
    disc = _detect_disc(gray, hsv)
    reflection_mask = _build_reflection_mask(hsv, disc)
    center_label_radius, center_hole_confidence = _estimate_center_label(gray, disc)
    analysis_mask = _build_analysis_mask(gray.shape, disc, center_label_radius, reflection_mask)

    mask_pixels = int(np.count_nonzero(analysis_mask))
    if mask_pixels <= max(300, int(height * width * 0.025)):
        return None

    equalized = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8)).apply(gray)
    dust_ratio = _particle_ratio(equalized, analysis_mask)
    groove_contrast = _groove_contrast(equalized, analysis_mask)
    scratch_candidates, scratch_density = _detect_scratches(equalized, gray, analysis_mask, disc)
    scratch_regions = [_region_payload(candidate, width, height) for candidate in scratch_candidates[:14]]

    severity_counts = {
        "high": sum(1 for candidate in scratch_candidates if candidate.severity == "high"),
        "medium": sum(1 for candidate in scratch_candidates if candidate.severity == "medium"),
        "low": sum(1 for candidate in scratch_candidates if candidate.severity == "low"),
    }
    scratch_count = len(scratch_candidates)

    reflection_ratio = float(np.count_nonzero(reflection_mask)) / float(height * width)
    quality_penalty = _quality_penalty(blur_variance, exposure, disc.detected)
    surface_score = _surface_score(
        scratch_count=scratch_count,
        high_count=severity_counts["high"],
        medium_count=severity_counts["medium"],
        reflection_ratio=reflection_ratio,
        dust_ratio=dust_ratio,
        quality_penalty=quality_penalty,
    )
    confidence = _confidence(surface_score, disc, blur_variance, exposure, mask_pixels / float(height * width))
    surface_grade = _grade_from_score(surface_score)

    return {
        "isRecord": True,
        "analysisAvailable": True,
        "confidence": confidence,
        "signals": _signals(scratch_count, surface_score, surface_grade, disc.detected, quality_penalty),
        "source": "opencv",
        "persisted": False,
        "surfaceScore": surface_score,
        "surfaceGrade": surface_grade,
        "scratchCount": scratch_count,
        "scratchRisk": None,
        "reflectionRisk": None,
        "scratchRegions": scratch_regions,
        "scratchDetails": {
            "displayedRegions": len(scratch_regions),
            "highSeverity": severity_counts["high"],
            "mediumSeverity": severity_counts["medium"],
            "lowSeverity": severity_counts["low"],
            "reflectionRatio": round(reflection_ratio, 4),
            "blurVariance": round(blur_variance, 1),
            "exposure": round(exposure, 1),
            "dustRatio": round(dust_ratio, 4),
            "grooveContrast": round(groove_contrast, 4),
            "scratchDensity": round(scratch_density, 4),
            "centerHoleConfidence": round(center_hole_confidence, 3),
            "detectedDisc": disc.detected,
            "discCenterX": round(disc.cx / width, 4),
            "discCenterY": round(disc.cy / height, 4),
            "discRadius": round(disc.radius / min_side, 4),
            "centerLabelRadius": round(center_label_radius / max(1, disc.radius), 4),
            "analysisMaskRatio": round(mask_pixels / float(height * width), 4),
        },
        "dustOrReflectionNote": "강한 조명 반사, 중앙 라벨/홀, 원판 바깥 배경은 스크래치 후보에서 제외했습니다. 먼지와 얕은 홈 자국은 실제 판매 전 육안 확인을 함께 권장합니다.",
        "playbackImpact": None,
    }


def _resize_for_analysis(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    scale = min(1.0, 1100 / max(height, width))
    if scale >= 1.0:
        return image
    next_size = (max(1, int(width * scale)), max(1, int(height * scale)))
    return cv2.resize(image, next_size, interpolation=cv2.INTER_AREA)


def _detect_disc(gray: np.ndarray, hsv: np.ndarray) -> DiscCandidate:
    height, width = gray.shape[:2]
    min_side = min(height, width)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 45, 135)
    candidates: list[DiscCandidate] = []

    hough_gray = cv2.medianBlur(gray, 5)
    hough_gray = cv2.equalizeHist(hough_gray)
    for param2 in (36, 30, 24, 19):
        circles = cv2.HoughCircles(
            hough_gray,
            cv2.HOUGH_GRADIENT,
            dp=1.18,
            minDist=max(80, min_side // 3),
            param1=92,
            param2=param2,
            minRadius=int(min_side * 0.24),
            maxRadius=int(min_side * 0.54),
        )
        if circles is None:
            continue
        for cx, cy, radius in np.round(circles[0]).astype(int):
            candidate = _score_disc_candidate(gray, hsv, edges, int(cx), int(cy), int(radius), "hough")
            if candidate is not None:
                candidates.append(candidate)

    candidates.extend(_contour_disc_candidates(gray, hsv, edges))
    if candidates:
        candidates.sort(key=lambda item: item.score, reverse=True)
        best = candidates[0]
        if best.score >= 0.36:
            return best

    return DiscCandidate(width // 2, height // 2, int(min_side * 0.46), 0.0, False, "center_fallback")


def _contour_disc_candidates(gray: np.ndarray, hsv: np.ndarray, edges: np.ndarray) -> list[DiscCandidate]:
    height, width = gray.shape[:2]
    min_side = min(height, width)
    value = hsv[:, :, 2]
    saturation = hsv[:, :, 1]
    dark_or_colored = np.where(((value < 190) | (saturation > 45)), 255, 0).astype(np.uint8)
    dark_or_colored = cv2.morphologyEx(dark_or_colored, cv2.MORPH_CLOSE, np.ones((13, 13), dtype=np.uint8), iterations=2)
    dark_or_colored = cv2.morphologyEx(dark_or_colored, cv2.MORPH_OPEN, np.ones((5, 5), dtype=np.uint8), iterations=1)
    contours, _hierarchy = cv2.findContours(dark_or_colored, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates: list[DiscCandidate] = []
    min_area = np.pi * (min_side * 0.20) ** 2
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area:
            continue
        (cx, cy), radius = cv2.minEnclosingCircle(contour)
        radius_int = int(round(radius))
        if radius_int < int(min_side * 0.22) or radius_int > int(min_side * 0.58):
            continue
        circularity = area / max(1.0, np.pi * radius * radius)
        if circularity < 0.42:
            continue
        candidate = _score_disc_candidate(gray, hsv, edges, int(round(cx)), int(round(cy)), radius_int, "contour")
        if candidate is not None:
            candidates.append(candidate)
    return candidates


def _score_disc_candidate(
    gray: np.ndarray,
    hsv: np.ndarray,
    edges: np.ndarray,
    cx: int,
    cy: int,
    radius: int,
    method: str,
) -> DiscCandidate | None:
    height, width = gray.shape[:2]
    min_side = min(height, width)
    if radius <= 0:
        return None
    if cx < -radius * 0.15 or cy < -radius * 0.15 or cx > width + radius * 0.15 or cy > height + radius * 0.15:
        return None

    center_dist = float(np.hypot(cx - width / 2.0, cy - height / 2.0))
    center_score = max(0.0, 1.0 - center_dist / max(1.0, min_side * 0.42))
    radius_ratio = radius / float(min_side)
    radius_score = max(0.0, 1.0 - abs(radius_ratio - 0.45) / 0.24)
    edge_support = _circle_edge_support(edges, cx, cy, radius)
    frame_score = _circle_frame_score(width, height, cx, cy, radius)

    circle_mask = np.zeros_like(gray, dtype=np.uint8)
    inner_mask = np.zeros_like(gray, dtype=np.uint8)
    cv2.circle(circle_mask, (cx, cy), int(radius * 0.95), 255, -1)
    cv2.circle(inner_mask, (cx, cy), int(radius * 0.45), 255, -1)
    circle_values = gray[circle_mask > 0]
    inner_values = gray[inner_mask > 0]
    if circle_values.size == 0 or inner_values.size == 0:
        return None
    value_std = float(np.std(circle_values)) / 80.0
    record_darkness = max(0.0, 1.0 - float(np.mean(inner_values)) / 205.0)
    saturation_signal = float(np.mean(hsv[:, :, 1][circle_mask > 0])) / 180.0
    tone_score = min(1.0, max(record_darkness, saturation_signal * 0.8, value_std))

    score = (
        center_score * 0.23
        + radius_score * 0.21
        + edge_support * 0.28
        + frame_score * 0.14
        + tone_score * 0.14
    )
    if method == "contour":
        score += 0.03
    return DiscCandidate(cx, cy, radius, float(score), True, method)


def _circle_edge_support(edges: np.ndarray, cx: int, cy: int, radius: int) -> float:
    height, width = edges.shape[:2]
    samples = 256
    hits = 0
    valid = 0
    for angle in np.linspace(0, 2 * np.pi, samples, endpoint=False):
        cos_a = float(np.cos(angle))
        sin_a = float(np.sin(angle))
        found = False
        for offset in (-3, -1, 1, 3):
            x = int(round(cx + (radius + offset) * cos_a))
            y = int(round(cy + (radius + offset) * sin_a))
            if 0 <= x < width and 0 <= y < height:
                valid += 1
                if edges[y, x] > 0:
                    found = True
                    break
        if found:
            hits += 1
    return hits / max(1, samples if valid else 1)


def _circle_frame_score(width: int, height: int, cx: int, cy: int, radius: int) -> float:
    left = max(0.0, min(width - 1.0, cx - radius))
    right = max(0.0, min(width - 1.0, cx + radius))
    top = max(0.0, min(height - 1.0, cy - radius))
    bottom = max(0.0, min(height - 1.0, cy + radius))
    visible_area = max(0.0, right - left) * max(0.0, bottom - top)
    bbox_area = max(1.0, float((radius * 2) ** 2))
    return min(1.0, visible_area / bbox_area + 0.2)


def _build_reflection_mask(hsv: np.ndarray, disc: DiscCandidate) -> np.ndarray:
    value = hsv[:, :, 2]
    saturation = hsv[:, :, 1]
    bright_low_sat = ((value >= 218) & (saturation <= 92)).astype(np.uint8) * 255
    very_bright = ((value >= 242) & (saturation <= 135)).astype(np.uint8) * 255
    local_hot = ((value.astype(np.float32) - cv2.GaussianBlur(value, (0, 0), 9).astype(np.float32)) > 34).astype(np.uint8) * 255
    mask = cv2.bitwise_or(bright_low_sat, very_bright)
    mask = cv2.bitwise_or(mask, cv2.bitwise_and(local_hot, very_bright))

    disc_mask = np.zeros(value.shape, dtype=np.uint8)
    cv2.circle(disc_mask, (disc.cx, disc.cy), max(1, int(disc.radius * 0.98)), 255, -1)
    mask = cv2.bitwise_and(mask, mask, mask=disc_mask)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    mask = _filter_reflection_components(mask, disc)
    mask = cv2.dilate(mask, kernel, iterations=1)
    return mask


def _filter_reflection_components(mask: np.ndarray, disc: DiscCandidate) -> np.ndarray:
    filtered = np.zeros_like(mask, dtype=np.uint8)
    component_count, labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, 8)
    min_area = max(90, int(mask.size * 0.00028))
    thin_limit = max(5, int(disc.radius * 0.028))
    for label in range(1, component_count):
        left, top, width, height, area = stats[label]
        if area < min_area:
            continue
        min_dimension = max(1, min(int(width), int(height)))
        aspect = max(int(width), int(height)) / float(min_dimension)
        fill_ratio = float(area) / float(max(1, int(width) * int(height)))
        if fill_ratio <= 0.08:
            continue
        if min_dimension <= thin_limit and aspect >= 6.0:
            continue
        filtered[labels == label] = 255
    return filtered


def _estimate_center_label(gray: np.ndarray, disc: DiscCandidate) -> tuple[int, float]:
    default_radius = int(disc.radius * 0.285)
    min_radius = int(disc.radius * 0.16)
    max_radius = int(disc.radius * 0.36)
    if max_radius <= min_radius:
        return default_radius, 0.0

    crop_margin = int(disc.radius * 0.42)
    x1 = max(0, disc.cx - crop_margin)
    y1 = max(0, disc.cy - crop_margin)
    x2 = min(gray.shape[1], disc.cx + crop_margin)
    y2 = min(gray.shape[0], disc.cy + crop_margin)
    crop = gray[y1:y2, x1:x2]
    if crop.size == 0:
        return default_radius, 0.0

    crop_blur = cv2.medianBlur(crop, 5)
    circles = cv2.HoughCircles(
        crop_blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=max(20, disc.radius // 5),
        param1=80,
        param2=18,
        minRadius=max(8, min_radius),
        maxRadius=max(10, max_radius),
    )
    if circles is None:
        return default_radius, 0.18

    best_radius = default_radius
    best_score = 0.18
    for local_cx, local_cy, radius in np.round(circles[0]).astype(int):
        cx = int(local_cx + x1)
        cy = int(local_cy + y1)
        center_error = float(np.hypot(cx - disc.cx, cy - disc.cy)) / max(1.0, disc.radius)
        if center_error > 0.16:
            continue
        radius = int(radius)
        score = max(0.0, 1.0 - center_error / 0.16)
        if score > best_score:
            best_score = score
            best_radius = int(max(default_radius, min(radius * 1.08, disc.radius * 0.38)))
    return best_radius, best_score


def _build_analysis_mask(
    shape: tuple[int, int],
    disc: DiscCandidate,
    center_label_radius: int,
    reflection_mask: np.ndarray,
) -> np.ndarray:
    height, width = shape
    mask = np.zeros((height, width), dtype=np.uint8)
    outer_margin = max(10, int(disc.radius * 0.035))
    cv2.circle(mask, (disc.cx, disc.cy), max(1, disc.radius - outer_margin), 255, -1)
    cv2.circle(mask, (disc.cx, disc.cy), max(1, center_label_radius), 0, -1)

    edge_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.erode(mask, edge_kernel, iterations=1)
    mask = cv2.bitwise_and(mask, cv2.bitwise_not(reflection_mask))
    return mask


def _particle_ratio(equalized: np.ndarray, mask: np.ndarray) -> float:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    top_hat = cv2.morphologyEx(equalized, cv2.MORPH_TOPHAT, kernel)
    black_hat = cv2.morphologyEx(equalized, cv2.MORPH_BLACKHAT, kernel)
    particles = (((top_hat > 24) | (black_hat > 28)).astype(np.uint8) * 255)
    particles = cv2.bitwise_and(particles, particles, mask=mask)
    particles = cv2.morphologyEx(particles, cv2.MORPH_OPEN, np.ones((2, 2), dtype=np.uint8), iterations=1)
    return float(np.count_nonzero(particles)) / float(max(1, np.count_nonzero(mask)))


def _groove_contrast(equalized: np.ndarray, mask: np.ndarray) -> float:
    masked = equalized[mask > 0]
    if masked.size == 0:
        return 0.0
    gradient_x = cv2.Sobel(equalized, cv2.CV_32F, 1, 0, ksize=3)
    gradient_y = cv2.Sobel(equalized, cv2.CV_32F, 0, 1, ksize=3)
    gradient = cv2.magnitude(gradient_x, gradient_y)
    gradient_values = gradient[mask > 0]
    contrast = (float(np.std(masked)) / 70.0) * 0.55 + (float(np.percentile(gradient_values, 78)) / 95.0) * 0.45
    return max(0.0, min(1.0, contrast))


def _detect_scratches(
    equalized: np.ndarray,
    gray: np.ndarray,
    analysis_mask: np.ndarray,
    disc: DiscCandidate,
) -> tuple[list[ScratchCandidate], float]:
    min_side = min(equalized.shape[:2])
    radius = max(1, disc.radius)
    denoised = cv2.bilateralFilter(equalized, 7, 35, 35)
    median = float(np.median(denoised[analysis_mask > 0])) if np.count_nonzero(analysis_mask) else 90.0
    lower = int(max(34, min(88, median * 0.58)))
    upper = int(max(104, min(175, median * 1.45)))
    edges = cv2.Canny(denoised, lower, upper)
    edges = cv2.bitwise_and(edges, edges, mask=analysis_mask)

    line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, line_kernel, iterations=1)
    raw_edge_density = float(np.count_nonzero(edges)) / float(max(1, np.count_nonzero(analysis_mask)))

    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=max(28, int(radius * 0.07)),
        minLineLength=max(34, int(radius * 0.13)),
        maxLineGap=max(5, int(radius * 0.018)),
    )
    if lines is None:
        return [], 0.0

    candidates: list[ScratchCandidate] = []
    for raw_line in lines[:, 0]:
        x1, y1, x2, y2 = [int(value) for value in raw_line]
        candidate = _score_scratch_line(x1, y1, x2, y2, equalized, gray, edges, analysis_mask, disc)
        if candidate is None:
            continue
        candidates.append(candidate)

    candidates.sort(key=lambda item: item.score, reverse=True)
    clustered: list[ScratchCandidate] = []
    for candidate in candidates:
        if _is_duplicate_line(candidate, clustered, min_side):
            continue
        clustered.append(candidate)
        if len(clustered) >= 24:
            break

    clustered.sort(key=lambda item: (item.severity == "high", item.score, item.length), reverse=True)
    scratch_line_mask = np.zeros_like(analysis_mask, dtype=np.uint8)
    thickness = max(2, int(radius * 0.012))
    for candidate in clustered:
        cv2.line(
            scratch_line_mask,
            (candidate.x1, candidate.y1),
            (candidate.x2, candidate.y2),
            255,
            thickness,
        )
    scratch_density = float(np.count_nonzero(cv2.bitwise_and(scratch_line_mask, scratch_line_mask, mask=analysis_mask))) / float(max(1, np.count_nonzero(analysis_mask)))
    if not clustered and raw_edge_density >= 0.04:
        scratch_density = 0.0
    return clustered, scratch_density


def _score_scratch_line(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    equalized: np.ndarray,
    gray: np.ndarray,
    edges: np.ndarray,
    analysis_mask: np.ndarray,
    disc: DiscCandidate,
) -> ScratchCandidate | None:
    height, width = equalized.shape[:2]
    dx = x2 - x1
    dy = y2 - y1
    length = float(np.hypot(dx, dy))
    if length < max(32.0, disc.radius * 0.11):
        return None

    xs = np.linspace(x1, x2, max(18, int(length // 3))).astype(np.int32)
    ys = np.linspace(y1, y2, max(18, int(length // 3))).astype(np.int32)
    if np.any(xs < 0) or np.any(xs >= width) or np.any(ys < 0) or np.any(ys >= height):
        return None
    mask_values = analysis_mask[ys, xs]
    in_mask_ratio = float(np.mean(mask_values > 0))
    if in_mask_ratio < 0.88:
        return None

    edge_support = float(np.mean(edges[ys, xs] > 0))
    if edge_support < 0.08:
        return None

    line_angle = float(np.arctan2(dy, dx))
    mx = (x1 + x2) / 2.0
    my = (y1 + y2) / 2.0
    radial_angle = float(np.arctan2(my - disc.cy, mx - disc.cx))
    tangent_angle = radial_angle + np.pi / 2
    tangent_delta = _axis_angle_delta(line_angle, tangent_angle)
    tangent_like = tangent_delta < 0.20
    radial_score = min(1.0, tangent_delta / 0.9)

    contrast = _line_contrast(equalized, xs, ys, line_angle)
    gray_contrast = _line_contrast(gray, xs, ys, line_angle)
    contrast = max(contrast, gray_contrast * 0.85)
    if contrast < 7.0 and length < disc.radius * 0.28:
        return None
    if tangent_like and (length < disc.radius * 0.38 or contrast < 15.0):
        return None

    length_score = min(1.0, length / max(1.0, disc.radius * 0.62))
    contrast_score = min(1.0, contrast / 42.0)
    score = length_score * 0.42 + contrast_score * 0.32 + edge_support * 0.16 + radial_score * 0.10
    if tangent_like:
        score *= 0.74
    if score < 0.29:
        return None

    if score >= 0.67 or (length >= disc.radius * 0.42 and contrast >= 16.0):
        severity = "high"
    elif score >= 0.43 or length >= disc.radius * 0.25:
        severity = "medium"
    else:
        severity = "low"

    return ScratchCandidate(
        x1=x1,
        y1=y1,
        x2=x2,
        y2=y2,
        length=length,
        contrast=contrast,
        edge_support=edge_support,
        radial_score=radial_score,
        score=float(score),
        severity=severity,
    )


def _line_contrast(image: np.ndarray, xs: np.ndarray, ys: np.ndarray, angle: float) -> float:
    height, width = image.shape[:2]
    normal_x = -float(np.sin(angle))
    normal_y = float(np.cos(angle))
    line_values = image[ys, xs].astype(np.float32)
    side_values: list[np.ndarray] = []
    for offset in (-5, -3, 3, 5):
        sx = np.clip(np.round(xs + normal_x * offset).astype(np.int32), 0, width - 1)
        sy = np.clip(np.round(ys + normal_y * offset).astype(np.int32), 0, height - 1)
        side_values.append(image[sy, sx].astype(np.float32))
    sides = np.concatenate(side_values)
    return float(abs(np.median(line_values) - np.median(sides)) + np.std(line_values) * 0.18)


def _axis_angle_delta(first: float, second: float) -> float:
    return float(abs(((first - second + np.pi / 2) % np.pi) - np.pi / 2))


def _is_duplicate_line(candidate: ScratchCandidate, accepted: list[ScratchCandidate], min_side: int) -> bool:
    angle = np.arctan2(candidate.y2 - candidate.y1, candidate.x2 - candidate.x1)
    midpoint = np.array([(candidate.x1 + candidate.x2) / 2.0, (candidate.y1 + candidate.y2) / 2.0])
    for other in accepted:
        other_angle = np.arctan2(other.y2 - other.y1, other.x2 - other.x1)
        angle_delta = abs(((angle - other_angle + np.pi / 2) % np.pi) - np.pi / 2)
        other_midpoint = np.array([(other.x1 + other.x2) / 2.0, (other.y1 + other.y2) / 2.0])
        midpoint_distance = float(np.linalg.norm(midpoint - other_midpoint))
        endpoint_distance = min(
            float(np.hypot(candidate.x1 - other.x1, candidate.y1 - other.y1) + np.hypot(candidate.x2 - other.x2, candidate.y2 - other.y2)),
            float(np.hypot(candidate.x1 - other.x2, candidate.y1 - other.y2) + np.hypot(candidate.x2 - other.x1, candidate.y2 - other.y1)),
        )
        if angle_delta < 0.14 and (midpoint_distance < min_side * 0.055 or endpoint_distance < min_side * 0.16):
            return True
    return False


def _normalized_coordinate(value: int, limit: int) -> float:
    ratio = float(value) / float(max(1, limit))
    return round(max(0.0, min(1.0, ratio)), 4)


def _region_payload(candidate: ScratchCandidate, width: int, height: int) -> dict[str, Any]:
    return {
        "x1": _normalized_coordinate(candidate.x1, width),
        "y1": _normalized_coordinate(candidate.y1, height),
        "x2": _normalized_coordinate(candidate.x2, width),
        "y2": _normalized_coordinate(candidate.y2, height),
        "severity": candidate.severity,
    }


def _surface_score(
    scratch_count: int,
    high_count: int,
    medium_count: int,
    reflection_ratio: float,
    dust_ratio: float,
    quality_penalty: int,
) -> int:
    score = 91.0
    score -= min(27.0, scratch_count * 2.5)
    score -= min(12.0, high_count * 4.2 + medium_count * 1.4)
    score -= min(14.0, reflection_ratio * 185.0)
    score -= min(8.0, dust_ratio * 120.0)
    score -= quality_penalty
    return int(max(42, min(94, round(score))))


def _grade_from_score(score: int) -> str:
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


def _quality_penalty(blur_variance: float, exposure: float, detected_disc: bool) -> int:
    penalty = 0
    if blur_variance < 45:
        penalty += 10
    elif blur_variance < 90:
        penalty += 5
    if exposure < 45 or exposure > 218:
        penalty += 8
    elif exposure < 64 or exposure > 198:
        penalty += 4
    if not detected_disc:
        penalty += 5
    return penalty


def _confidence(surface_score: int, disc: DiscCandidate, blur_variance: float, exposure: float, mask_ratio: float) -> int:
    confidence = 62.0 + disc.score * 26.0
    if disc.detected:
        confidence += 8.0
    else:
        confidence -= 10.0
    if blur_variance < 45:
        confidence -= 13.0
    elif blur_variance < 90:
        confidence -= 6.0
    if exposure < 45 or exposure > 218:
        confidence -= 8.0
    if mask_ratio < 0.16:
        confidence -= 8.0
    confidence = max(confidence, surface_score - 16)
    return int(max(45, min(94, round(confidence))))


def _signals(
    scratch_count: int,
    surface_score: int,
    surface_grade: str,
    detected_disc: bool,
    quality_penalty: int,
) -> list[str]:
    signals = [
        "OpenCV로 원판 영역을 찾고 라벨/홀, 외부 배경, 강한 반사광을 제외한 뒤 표면만 분석했습니다.",
        f"선분/엣지/밝기 대비 기준으로 스크래치 후보 {scratch_count}개를 감지했습니다.",
        f"스크래치 분석은 {surface_grade} 등급, {surface_score}점입니다.",
    ]
    if not detected_disc:
        signals.append("원판 외곽 검출 신뢰도가 낮아 화면 중앙 기준의 보수적 원형 마스크를 사용했습니다.")
    if quality_penalty:
        signals.append("초점 또는 노출 조건 때문에 표면 점수와 신뢰도를 보수적으로 조정했습니다.")
    return signals

