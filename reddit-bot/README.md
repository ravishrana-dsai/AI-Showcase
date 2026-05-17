# Reddit AI Bot

> An intelligent Reddit automation bot that monitors target subreddits, generates natural contextual replies using Claude AI, and tracks engagement through an analytics dashboard. Uses browser automation instead of the Reddit API, so no API approval is needed.

## AI Stack

| Component | Technology |
|---|---|
| Reply generation | Claude Sonnet 4 (Anthropic) |
| Browser automation | Playwright (Firefox) |
| Analytics | Python dashboard (analytics_dashboard.py) |

## Key Achievements

- Claude Sonnet generates natural, contextual replies that match subreddit tone and conversation thread, not templated responses
- Browser automation via Playwright handles login, navigation, and comment posting exactly as a human would, bypassing API rate limits and approval requirements
- 4:1 value-to-promotion ratio enforcement: the bot is configured to contribute genuine value in 4 out of 5 comments before any promotional mention
- Human-like behavior simulation: random delays, realistic typing cadence, session persistence to avoid detection
- Full analytics dashboard tracking post coverage, reply success rate, engagement metrics, and activity logs
- Visual mode (watch the bot work) or headless background mode

## Tech Stack

- **Language:** Python 3
- **AI:** Anthropic SDK (`anthropic`)
- **Browser automation:** Playwright (Firefox)
- **Analytics:** Custom Python dashboard (`analytics_dashboard.py`)

## How to Run

```bash
pip install -r requirements.txt
playwright install firefox

cp .env.example .env
# Set REDDIT_USERNAME, REDDIT_PASSWORD, ANTHROPIC_API_KEY

# Verify setup
python test_setup.py

# Run (visible browser)
python browser_bot.py

# Run (headless)
python browser_bot.py --headless

# Analytics dashboard
python analytics_dashboard.py
```
