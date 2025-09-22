from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

import re

import yaml

from ..utils import slugify


@dataclass
class PreparedFrontMatter:
    front_matter: dict[str, Any]
    content: str
    body: str
    tags: list[str]
    description: str | None
    links: list[dict[str, str]]


def extract_front_matter(content: str) -> tuple[dict[str, Any], str]:
    if not content:
        return {}, ""
    text = content.lstrip('\ufeff')  # strip BOM if present
    if not text.startswith('---'):
        return {}, content
    lines = text.splitlines()
    if not lines or lines[0].strip() != '---':
        return {}, content
    closing_index: int | None = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == '---':
            closing_index = idx
            break
    if closing_index is None:
        return {}, content
    metadata_block = '\n'.join(lines[1:closing_index])
    body = '\n'.join(lines[closing_index + 1 :])
    try:
        parsed = yaml.safe_load(metadata_block) or {}
    except Exception:
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    return parsed, body.lstrip('\n')


def _normalize_tags(raw: Iterable[Any] | Any | None) -> list[str]:
    if raw is None:
        return []
    values: list[str] = []
    if isinstance(raw, str):
        raw_values = [part.strip() for part in raw.replace(';', ',').split(',')]
    elif isinstance(raw, (list, tuple, set)):
        raw_values = []
        for item in raw:
            if isinstance(item, str):
                raw_values.append(item.strip())
            elif isinstance(item, dict):
                label = item.get('label') if isinstance(item, dict) else None
                if isinstance(label, str):
                    raw_values.append(label.strip())
    else:
        raw_values = []
    for value in raw_values:
        if value:
            values.append(value)
    # De-duplicate preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(value)
    return unique


def _normalize_links(raw: Any) -> list[dict[str, str]]:
    if raw is None:
        return []
    items: list[dict[str, str]] = []
    values = raw if isinstance(raw, (list, tuple)) else [raw]
    for entry in values:
        if isinstance(entry, str):
            url = entry.strip()
            if url:
                items.append({'url': url, 'label': url})
        elif isinstance(entry, dict):
            url = str(entry.get('url') or '').strip()
            if not url:
                continue
            label = entry.get('label')
            if not isinstance(label, str) or not label.strip():
                label = url
            items.append({'url': url, 'label': label.strip()})
    # Deduplicate on url
    seen: set[str] = set()
    result: list[dict[str, str]] = []
    for item in items:
        if item['url'] in seen:
            continue
        seen.add(item['url'])
        result.append(item)
    return result


def compose_markdown(front_matter: dict[str, Any], body: str) -> str:
    clean_meta = {k: v for k, v in front_matter.items() if v not in (None, '', [], {}, ())}
    if not clean_meta:
        return body.lstrip('\n')
    yaml_block = yaml.safe_dump(clean_meta, sort_keys=True).strip()
    body_content = body.lstrip('\n')
    if body_content:
        return f"---\n{yaml_block}\n---\n\n{body_content.rstrip()}\n"
    return f"---\n{yaml_block}\n---\n"


def prepare_front_matter(
    content: str,
    incoming_meta: dict[str, Any] | None = None,
    tags_override: list[str] | None = None,
) -> PreparedFrontMatter:
    existing_meta, body = extract_front_matter(content)
    merged: dict[str, Any] = {}
    merged.update(existing_meta or {})
    if incoming_meta:
        merged.update({k: v for k, v in incoming_meta.items() if v is not None})

    tags_value = tags_override if tags_override is not None else merged.get('tags')
    tags = _normalize_tags(tags_value)
    if tags:
        merged['tags'] = tags
    elif 'tags' in merged:
        merged.pop('tags')

    links = _normalize_links(merged.get('links'))
    if links:
        merged['links'] = links
    elif 'links' in merged:
        merged.pop('links')

    description_raw = merged.get('description')
    if isinstance(description_raw, str):
        description = description_raw.strip() or None
    else:
        description = None
    if description:
        merged['description'] = description
    elif 'description' in merged:
        merged.pop('description')

    icon_value = merged.get('icon')
    if icon_value and not isinstance(icon_value, str):
        merged.pop('icon')

    content_with_meta = compose_markdown(merged, body)

    return PreparedFrontMatter(
        front_matter=merged,
        content=content_with_meta,
        body=body,
        tags=tags,
        description=description,
        links=links,
    )


def build_tag_details(tags: Iterable[str] | None, tag_lookup: dict[str, Any] | None) -> list[dict[str, Any]]:
    details: list[dict[str, Any]] = []
    if not tags:
        return details
    for label in tags:
        if not isinstance(label, str):
            continue
        slug = slugify(label)
        if not slug:
            continue
        record = tag_lookup.get(slug) if tag_lookup else None
        if record:
            details.append(
                {
                    'slug': record.slug,
                    'label': record.label,
                    'color': getattr(record, 'color', None),
                    'emoji': getattr(record, 'emoji', None),
                }
            )
        else:
            details.append({'slug': slug, 'label': label, 'color': None, 'emoji': None})
    return details


def summarize_markdown(content: str, limit: int = 180) -> str | None:
    if not content:
        return None
    snippet = re.sub(r"```[\s\S]*?```", "", content)
    snippet = re.sub(r"`([^`]+)`", r"\1", snippet)
    snippet = re.sub(r"!\[[^\]]*\]\([^\)]*\)", "", snippet)
    snippet = re.sub(r"\[[^\]]*\]\([^\)]*\)", r"\1", snippet)
    lines = [line.strip() for line in snippet.splitlines() if line.strip()]
    if not lines:
        return None
    text = " ".join(lines)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"
