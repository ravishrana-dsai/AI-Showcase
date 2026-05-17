"""
Battle card generator: per-competitor one-pager with win/lose conditions,
weaknesses, pricing, roadmap signals. Posts to Slack and updates in place.
"""

import json
from outputs.slack_client import (
    post_message, update_message, header_block, section_block,
    divider_block, context_block, bullet_list
)
from config.settings import settings
from db import database
from utils.logger import get_logger
from utils.diff_engine import compute_hash

logger = get_logger(__name__)


def _build_battle_card_blocks(competitor_id: str, competitor_name: str, data: dict) -> list[dict]:
    feature_gap = data.get("feature_gap", {})
    pricing = data.get("pricing", {})
    hiring = data.get("hiring", {})
    narrative = data.get("narrative", {})
    sentiment = data.get("sentiment", {})

    threat_level = feature_gap.get("threat_level", "unknown")
    threat_emoji = {"critical": ":rotating_light:", "high": ":warning:", "medium": ":yellow_circle:", "low": ":white_circle:"}.get(threat_level, "")

    blocks = [
        header_block(f"{threat_emoji} Battle Card: {competitor_name}"),
        section_block(
            f"*Positioning:* {narrative.get('their_positioning', 'Unknown')}\n"
            f"*Primary Audience:* {narrative.get('primary_audience', 'unknown').replace('_', ' ').title()}\n"
            f"*Threat Level:* {threat_level.upper()}"
        ),
        divider_block(),
    ]

    # Feature comparison
    advantages = feature_gap.get("features_only_dream_play_has", [])
    gaps = feature_gap.get("features_only_competitor_has", [])
    if advantages or gaps:
        blocks.append(section_block(
            f"*Where [Company] WINS:*\n{bullet_list(advantages or ['No clear gaps found'])}\n\n"
            f"*Where {competitor_name} leads:*\n{bullet_list(gaps or ['No significant gaps'])}"
        ))
        blocks.append(divider_block())

    # Pricing
    tiers = pricing.get("tiers", [])
    if tiers:
        pricing_text = "\n".join(
            f"• *{t.get('name', '?')}*: {t.get('price_monthly', '?')}/mo — {t.get('target_segment', '?')}"
            for t in tiers[:4]
        )
        arpu = pricing.get("estimated_consumer_arpu_monthly", "Unknown")
        vs_dp = pricing.get("pricing_vs_dream_play", "unknown")
        blocks.append(section_block(
            f"*Pricing:*\n{pricing_text}\n"
            f"_Est. consumer ARPU: {arpu} | vs [Company]: {vs_dp}_"
        ))
        blocks.append(divider_block())

    # Review pain points (their weaknesses = [Company] opportunities)
    pain_points = sentiment.get("pain_points", [])
    if pain_points:
        pp_list = [f"{p.get('theme', '?')} (x{p.get('frequency', '?')})" for p in pain_points[:5]]
        blocks.append(section_block(
            f"*User Pain Points (their weakness):*\n{bullet_list(pp_list)}"
        ))
        blocks.append(divider_block())

    # Roadmap signals
    inferences = hiring.get("roadmap_inferences", [])
    if inferences:
        inf_list = [f"{i.get('inference', '?')} _{i.get('confidence', '?')} confidence_" for i in inferences[:4]]
        blocks.append(section_block(
            f"*Roadmap Signals (from hiring):*\n{bullet_list(inf_list)}"
        ))
        blocks.append(divider_block())

    # Counter-claims
    claims = narrative.get("claims_to_counter", [])
    if claims:
        claim_list = [f"*\"{c.get('claim', '?')}\"* — {c.get('counter', '')}" for c in claims[:3]]
        blocks.append(section_block(
            f"*Claims to Counter:*\n{bullet_list(claim_list)}"
        ))
        blocks.append(divider_block())

    from datetime import datetime
    blocks.append(context_block(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M IST')} | {competitor_id}"))

    return blocks


def generate_battle_card(competitor_id: str) -> bool:
    """Generate and post/update battle card for a competitor."""
    from config.competitors import COMPETITORS
    competitor_name = COMPETITORS.get(competitor_id, {}).get("name", competitor_id)

    # Gather latest intelligence from DB
    data = {}
    for proc_type in ("feature_gap", "pricing", "hiring_signals", "narrative", "review_sentiment"):
        intel = database.get_latest_intelligence(competitor_id, proc_type)
        if intel:
            try:
                data[proc_type.replace("_signals", "").replace("review_", "")] = json.loads(intel["analysis_json"])
            except Exception:
                pass

    if not data:
        logger.info("No intelligence data for battle card", competitor=competitor_id)
        return False

    blocks = _build_battle_card_blocks(competitor_id, competitor_name, data)
    card_hash = compute_hash(json.dumps(data, sort_keys=True))

    channel = settings.slack_channel_ci
    if not channel:
        logger.warning("Slack channel not configured")
        return False

    # Check if we have an existing message to update
    existing = database.get_last_output(f"battle_card_{competitor_id}")

    if existing and existing.get("message_ts"):
        updated = update_message(
            channel=channel,
            ts=existing["message_ts"],
            text=f"Battle Card: {competitor_name}",
            blocks=blocks,
        )
        if updated:
            logger.info("Battle card updated", competitor=competitor_id)
            return True

    # Post new card
    ts = post_message(
        channel=channel,
        text=f"Battle Card: {competitor_name}",
        blocks=blocks,
    )
    if ts:
        database.track_output_sent(
            output_type=f"battle_card_{competitor_id}",
            slack_channel=channel,
            message_ts=ts,
            content_hash=card_hash,
        )
        logger.info("Battle card posted", competitor=competitor_id)
        return True

    return False


def regenerate_all_battle_cards(competitors: dict) -> int:
    count = 0
    for competitor_id, config in competitors.items():
        if config.get("active", False):
            if generate_battle_card(competitor_id):
                count += 1
    logger.info("Battle cards regenerated", count=count)
    return count
