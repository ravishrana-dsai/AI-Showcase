# Your First Autonomous AI Agent: A Hello World Guide

> No coding background needed. Build something that runs on its own, does useful work, and sends you updates — automatically.

---

## What Is an Autonomous Agent?

A regular AI chat is reactive. You ask, it answers. Done.

An autonomous agent is different. You set it up once and it keeps working in the background. It wakes up on a schedule, collects information, decides what to do, and takes action — without you lifting a finger.

Every agent has the same three parts:

```
COLLECT  →  THINK  →  ACT
```

| Part | What it does |
|------|-------------|
| **Collect** | Gathers raw information from somewhere |
| **Think** | Decides what to do with it (logic or AI) |
| **Act** | Sends you the result |

---

## Phase 1: No AI API Needed

Start here. These agents use simple logic in the Think step — just conditions and comparisons, no AI required. Free to run, easy to build.

---

### 1. Price Drop Alert
You want to buy something but only when it goes on sale.

- **Collect:** Check the price of a product on a website once a day
- **Think:** Is today's price more than 5% lower than yesterday's? (pure logic)
- **Act:** Send a WhatsApp or email only if yes. Stay silent if nothing changed.

---

### 2. Match Result Notifier
You want to know your team's result as soon as the match ends, without checking your phone all evening.

- **Collect:** Check last night's match result from a free sports API (like API-Football)
- **Think:** Did your team play? Did they win, draw, or lose? (pure logic)
- **Act:** Send a one-line result to your WhatsApp every morning — "Arsenal 2-1 Chelsea. Win."

---

### 3. Fixture Reminder
You keep missing kickoffs because you forgot the time.

- **Collect:** Check today's fixtures from a sports API each morning
- **Think:** Does your team play today? If yes, what time? (pure logic)
- **Act:** Send yourself a reminder 2 hours before kickoff — "Heads up: Arsenal vs Chelsea kicks off at 8pm tonight."

---

These three need nothing more than Python, a scheduler, and a free API. No AI key, no cost.

---

## Phase 2: Add an AI API

Once a Phase 1 agent is running, add an AI to the Think step. This is where the agent goes from reporting facts to actually understanding them.

You will need an API key from one of these:
- **Google Gemini** — has a generous free tier, good starting point
- **Anthropic (Claude)** — strong reasoning, free credits on signup
- **OpenAI (ChatGPT)** — widely used, pay-per-use

All three work the same way: you send text in, you get a smart response back.

---

### 4. Match Results Digest
Same as the Match Result Notifier, but instead of a raw score you get a proper recap.

- **Collect:** Pull last night's scores and key stats from a sports API
- **Think:** Ask an AI to write a 3-sentence match summary and name the standout player
- **Act:** Send the digest to your WhatsApp or email every morning

---

### 5. Competitor Blog Monitor
You want to know when a competitor publishes something new, without checking their site every day.

- **Collect:** Check a competitor's blog RSS feed daily for new posts
- **Think:** Ask an AI to summarise each new post and flag anything strategically interesting
- **Act:** Send a Slack or email alert only when something new is published

---

### 6. App Store Review Digest
You have an app and want to know what users are actually saying, without reading hundreds of reviews.

- **Collect:** Pull your app's latest reviews from the App Store or Play Store every week
- **Think:** Ask an AI to group them by theme — bugs, praise, feature requests — and highlight the most common complaints
- **Act:** Send a weekly digest to your team every Monday morning

---

### 7. Book or Movie Recommendation Agent
You want a genuinely personalised pick every Friday, not a generic top-10 list.

- **Collect:** Pull trending books or films from a public API (Goodreads, TMDB) every Friday
- **Think:** Tell the AI your taste once ("I like slow-burn thrillers, not horror") and ask it to pick the best match and explain why
- **Act:** Send you one recommendation with a 3-sentence reason every Friday evening

---

## How to Build It: The Prompt to Give Claude

Use this template. Fill in the blanks and paste it directly into Claude Code.

```
I want to build a simple autonomous agent. I am not a developer.

COLLECT: [what should it fetch, and from where?]
THINK:   [what logic or AI reasoning should it apply?]
ACT:     [what should it send, and where?]

Schedule: [how often? e.g. every day at 8am, every Friday]
Output:   [WhatsApp, email, Slack, a text file?]

Before writing any code:
1. Show me the plan and the files you will create
2. List every API key or account I need to set up
3. Wait for my confirmation before writing code
```

**If you are building a Phase 2 agent**, add this line:

```
Use [Gemini / Anthropic Claude / OpenAI] for the AI reasoning step.
```

---

## The 7 Build Steps (same for both phases)

1. **Paste the prompt above** into Claude Code. Let it ask clarifying questions.
2. **Review the plan** before any code is written.
3. **Get your API keys** — Claude will tell you exactly which ones.
4. **Ask Claude to write the code** in a single Python file.
5. **Add the scheduler** — ask Claude to use APScheduler.
6. **Test manually first** — ask Claude to add a `--run-now` flag.
7. **Add basic error handling** — ask Claude to retry on failure and log each run.

---

## Shortcut: Use the First Agent Skill

Instead of writing the prompt yourself, there is a skill that has this whole conversation with you — one question at a time — and produces the final prompt at the end.

### What the skill does

You tell it what you want to build in plain English. It asks you a few simple questions (which phase, what schedule, where to send the output) and then writes the complete Claude Code prompt for you. No template to fill in.

### How to install it

The skill comes as a single file: `first-agent.skill`

Open Claude Code and run:

```
/install-skill first-agent.skill
```

That is it. Claude handles the rest.

### How to use it

In any Claude Code session, just say something like:

> "Help me build my first agent"

or

> "I want to automate checking my team's results"

or

> "I want to build an agent that monitors a competitor's blog"

Claude will pick up the skill automatically and guide you through the rest — one question at a time. At the end, it hands you a complete, ready-to-run prompt.

---

## Common Mistakes

**Skip Phase 2 until Phase 1 works.** Get one loop running end-to-end before adding an AI API.

**Never hardcode API keys.** Always use a `.env` file. Claude will set this up for you.

**One output channel only.** Email, WhatsApp, or Slack. Not all three. Pick one.

**Test before scheduling.** Always run `python agent.py --run-now` before leaving it on a timer.

---

## What a Finished Agent Looks Like

```
my-agent/
  agent.py          ← collect, think, act, schedule — all in one file
  .env              ← API keys (never share this file)
  logs/             ← one entry per run
  requirements.txt  ← Python packages needed
```

Total code for Phase 1: around 60 to 80 lines.
Total code for Phase 2: around 100 to 130 lines.

Start with one loop. Get it working. Then grow it.
