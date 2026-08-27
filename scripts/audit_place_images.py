#!/usr/bin/env python3
"""Audit local place images without publishing unlicensed source material."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image


PRIMARY_OVERRIDES = {
    "先农坛": "先农坛(1).png",
    "北京展览馆": "北京展览馆(1).png",
    "宣武艺园": "宣武艺园(1).png",
    "梅兰芳纪念馆": "梅兰芳纪念馆.png",
    "白云观": "白云观(1).png",
    "西什库教堂": "西什库教堂(1).png",
}

VISIBLE_OVERLAY_FILES = {
    "北京工人体育场.png",
    "西什库教堂.png",
}


def base_name(filename: str) -> str:
    return re.sub(r"\(\d+\)$", "", Path(filename).stem)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def image_flags(width: int, height: int, filename: str) -> list[str]:
    flags: list[str] = []
    if width < 800 or height < 400:
        flags.append("分辨率偏低")
    ratio = width / height
    if ratio < 1.2:
        flags.append("竖图或近方图")
    if ratio > 3.0:
        flags.append("画幅过宽")
    if filename in VISIBLE_OVERLAY_FILES:
        flags.append("可见水印或来源文字")
    return flags


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--places",
        type=Path,
        default=Path("data/processed/places.zh-CN.json"),
    )
    parser.add_argument(
        "--images",
        type=Path,
        default=Path("data/50景点图片附件"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/image-audit.json"),
    )
    args = parser.parse_args()

    places = json.loads(args.places.read_text(encoding="utf-8"))
    place_names = {item["name"] for item in places}
    place_ids = {item["name"]: item["id"] for item in places}

    grouped: dict[str, list[dict]] = defaultdict(list)
    hashes: Counter[str] = Counter()
    for path in sorted(args.images.glob("*.png")):
        with Image.open(path) as image:
            width, height = image.size
            mode = image.mode
        digest = sha256(path)
        hashes[digest] += 1
        grouped[base_name(path.name)].append(
            {
                "filename": path.name,
                "width": width,
                "height": height,
                "mode": mode,
                "bytes": path.stat().st_size,
                "sha256": digest,
                "flags": image_flags(width, height, path.name),
            }
        )

    missing = sorted(place_names - set(grouped))
    extra = sorted(set(grouped) - place_names)
    if missing or extra:
        raise ValueError(f"Image mapping mismatch, missing={missing}, extra={extra}")

    records: list[dict] = []
    for place_name in sorted(place_names):
        images = grouped[place_name]
        preferred = PRIMARY_OVERRIDES.get(place_name)
        if preferred is None:
            preferred = max(
                images,
                key=lambda item: (
                    "可见水印或来源文字" not in item["flags"],
                    item["width"] * item["height"],
                ),
            )["filename"]
        if preferred not in {item["filename"] for item in images}:
            raise ValueError(f"Invalid preferred image for {place_name}: {preferred}")
        records.append(
            {
                "place_id": place_ids[place_name],
                "place_name": place_name,
                "preferred_filename": preferred,
                "rights_status": "blocked_missing_source_and_license",
                "publishable": False,
                "images": images,
            }
        )

    result = {
        "summary": {
            "places": len(records),
            "files": sum(len(item["images"]) for item in records),
            "places_with_alternatives": sum(len(item["images"]) > 1 for item in records),
            "exact_duplicate_files": sum(count - 1 for count in hashes.values() if count > 1),
            "publishable_files": 0,
            "rights_blocked_files": sum(len(item["images"]) for item in records),
        },
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(result["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
