#!/usr/bin/env python3
"""
Reddit Cricket Bot - Browser Automation Version (Gemini Powered)
Uses Playwright to interact with Reddit and Google Gemini for content.
"""

import os
import json
import time
import random
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Dict, List, Any

from playwright.sync_api import sync_playwright
import google.generativeai as genai
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('bot_activity.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class RedditCricketBot:
    """
    Main bot class for monitoring cricket subreddits using Browser Automation.
    """
    
    # Subreddits to monitor
    SUBREDDITS = ['Cricket', 'ipl', 'IndiaCricket', 'cricketshitpost']
    
    # Post categories
    CATEGORIES = {
        'match_thread': ['match thread', 'live thread', 'game thread', 'match day', 'playing xi'],
        'fantasy': ['dream11', 'fantasy', 'team selection', 'captain', 'vice captain', 'my team'],
        'stats': ['stats', 'statistics', 'average', 'strike rate', 'economy', 'records'],
        'prediction': ['predict', 'prediction', 'who will win', 'winner', 'forecast'],
        'news': ['news', 'breaking', 'announced', 'confirmed', 'official', 'update']
    }
    
    PROMOTION_CONTEXTS = {
        'prediction': [
            "RushLine's algorithm has been tracking this match-up closely.",
            "The data on RushLine suggests some interesting patterns here.",
            "RushLine's predictive model has some relevant insights on this."
        ],
        'fantasy': [
            "RushLine's data shows some interesting patterns for today's picks.",
            "Been using RushLine's analysis for my fantasy decisions lately.",
            "RushLine has some solid player form data if you're deciding on captaincy."
        ],
        'stats': [
            "Worth checking RushLine's analysis on this - they have detailed breakdowns.",
            "RushLine has been tracking these stats with some good visualizations.",
            "The numbers on RushLine align with this analysis."
        ],
        'match_thread': [
            "RushLine called this one based on their pitch analysis.",
            "The pre-match data on RushLine was pretty spot on here.",
            "RushLine's match preview had some good insights on this."
        ],
        'news': [
            "RushLine has been covering this story with some good context.",
            "Saw this on RushLine earlier with some detailed analysis.",
            "RushLine's take on this news is worth reading."
        ]
    }
    
    def __init__(self, headless: bool = True):
        """Initialize the bot."""
        load_dotenv()
        
        # Initialize Gemini
        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            try:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('models/gemini-2.0-flash')
                logger.info("Gemini AI initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
                self.model = None
        else:
            logger.error("Missing GEMINI_API_KEY")
            self.model = None
        
        # Bot state
        self.processed_posts: set = set()
        self.promotion_counter: int = 0
        self.promotion_interval: int = 4
        self.stats: Dict[str, Any] = {
            'total_replies': 0,
            'promotional_replies': 0,
            'replies_by_subreddit': {},
            'replies_by_category': {},
            'session_start': datetime.now(timezone.utc).isoformat(),
            'errors': 0
        }
        
        # Config
        self.headless = headless
        self.min_delay = 3
        self.max_delay = 8
        self.check_interval = 900
        
        self._load_processed_posts()
        self._load_stats()
        
        # Playwright objects
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    def start_browser(self):
        """Start the browser session."""
        self.playwright = sync_playwright().start()
        
        # More advanced stealth args
        browser_args = [
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--window-position=0,0",
        ]
        
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            channel="chrome",
            args=browser_args
        )
        
        # Use a real User-Agent but keep it consistent
        user_agent = os.getenv('REDDIT_USER_AGENT', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
        
        # Randomize viewport slightly to avoid fixed footprint
        import random
        vw = 1280 + random.randint(-40, 40)
        vh = 800 + random.randint(-30, 30)
        viewport = {'width': vw, 'height': vh}
        
        context_args = {
            "user_agent": user_agent,
            "viewport": viewport,
            "ignore_https_errors": True,
            "java_script_enabled": True,
        }
        
        if os.path.exists("auth.json"):
            logger.info("Loading saved authentication state from auth.json")
            context_args["storage_state"] = "auth.json"
            
        self.context = self.browser.new_context(**context_args)
        
        # Mask automation footprint
        self.page = self.context.new_page()
        self.page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        """)
        logger.info(f"Browser started with stealth and randomized viewport ({vw}x{vh})")

    def stop_browser(self):
        """Stop the browser session."""
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
        logger.info("Browser stopped")

    def login(self) -> bool:
        """Login to Reddit."""
        # Check for block screen first
        try:
            self.page.goto("https://www.reddit.com/", timeout=45000, wait_until='domcontentloaded')
            time.sleep(3)
            if "blocked by network security" in self.page.content().lower():
                logger.error("BOT BLOCKED: Reddit network security has flagged this session.")
                self.page.screenshot(path="debug_blocked.png")
                return False
        except Exception as e:
            logger.warning(f"Initial page load failed: {e}")

        # If we have a saved session, verify it instead of logging in again
        if os.path.exists("auth.json"):
            logger.info("Session file found. Verifying session...")
            try:
                # Wait for either a logged-in indicator or a logged-out indicator
                time.sleep(2)
                
                is_logged_in = self.page.evaluate("""() => {
                    // Indicators of being logged in
                    const userMenu = document.querySelector('shreddit-async-loader[bundlename="user_menu"]');
                    const profileAvatar = document.querySelector('img[alt*="Avatar"], #user-menu-button, .user-menu-wrapper');
                    const createBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Create'));
                    
                    if (userMenu || profileAvatar || createBtn) return true;
                    
                    const loginBtn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Log In'));
                    if (loginBtn) return false;
                    return null; // Uncertain
                }""")
                
                if is_logged_in is True:
                    logger.info("Session verified via user menu/avatar/Create button.")
                    return True
                elif is_logged_in is False:
                    logger.warning("Session expired. Log In button found.")
                else:
                    # Final fallback: look for username string
                    username_env = os.getenv('REDDIT_USERNAME', '').split('@')[0]
                    if username_env and username_env.lower() in self.page.content().lower():
                        logger.info("Session verified via username presence in content.")
                        return True
                    logger.warning("Session could not be verified definitively.")
            except Exception as e:
                logger.warning(f"Session verification failed: {e}")
        
        username = os.getenv('REDDIT_USERNAME')
        password = os.getenv('REDDIT_PASSWORD')
        
        if not username or not password:
            logger.error("Missing REDDIT_USERNAME or REDDIT_PASSWORD")
            return False
            
        try:
            logger.info("Navigating to login page...")
            self.page.goto("https://www.reddit.com/login", timeout=45000)
            time.sleep(5)
            
            # Check if we were redirected (means already logged in)
            if "login" not in self.page.url.lower() or self.page.locator('input[name="username"]').count() == 0:
                # Double check logged in state
                is_authed = self.page.evaluate("""() => {
                    return !!document.querySelector('shreddit-async-loader[bundlename="user_menu"], img[alt*="Avatar"]');
                }""")
                if is_authed:
                    logger.info("Already logged in (detected via redirect/avatar)")
                    return True

            logger.info("Entering credentials...")
            try:
                self.page.wait_for_selector('input[name="username"]', state='visible', timeout=15000)
                self.page.fill('input[name="username"]', username)
                self.page.fill('input[name="password"]', password)
                
                self.page.click('button[type="submit"]', timeout=5000)
                self.page.wait_for_url("https://www.reddit.com/", timeout=30000)
                logger.info(f"Login successful for user: {username}")
                return True
            except Exception as e:
                logger.error(f"Login UI missing or failed: {e}")
                self.page.screenshot(path="debug_login_failure.png")
                return False
            return True
            
        except Exception as e:
            logger.error(f"Login failed: {e}")
            try: 
                self.page.screenshot(path="login_error.png")
            except: pass
            return False

    def _load_processed_posts(self) -> None:
        filepath = Path('processed_posts.json')
        if filepath.exists():
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    self.processed_posts = set(data.get('post_ids', []))
                    self.promotion_counter = data.get('promotion_counter', 0)
            except Exception:
                self.processed_posts = set()
    
    def _save_processed_posts(self) -> None:
        try:
            with open('processed_posts.json', 'w') as f:
                json.dump({
                    'post_ids': list(self.processed_posts),
                    'promotion_counter': self.promotion_counter,
                    'last_updated': datetime.now(timezone.utc).isoformat()
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving processed posts: {e}")

    def _load_stats(self) -> None:
        filepath = Path('bot_stats.json')
        if filepath.exists():
            try:
                with open(filepath, 'r') as f:
                    saved = json.load(f)
                    for k in ['total_replies', 'promotional_replies', 'errors']:
                        self.stats[k] = saved.get(k, 0)
                    self.stats['replies_by_subreddit'] = saved.get('replies_by_subreddit', {})
                    self.stats['replies_by_category'] = saved.get('replies_by_category', {})
            except Exception:
                pass

    def _save_stats(self) -> None:
        try:
            self.stats['last_updated'] = datetime.now(timezone.utc).isoformat()
            with open('bot_stats.json', 'w') as f:
                json.dump(self.stats, f, indent=2)
        except Exception:
            pass

    def _categorize_post(self, title: str, content: str) -> Optional[str]:
        text = f"{title} {content}".lower()
        for category, keywords in self.CATEGORIES.items():
            if any(keyword in text for keyword in keywords):
                return category
        
        cricket_terms = ['cricket', 'ipl', 'test', 'odi', 't20', 'innings', 'wicket', 
                         'batsman', 'bowler', 'century', 'fifty', 'run', 'over']
        if any(term in text for term in cricket_terms):
            return 'news'
        return None

    def _generate_reply(self, title: str, content: str, subreddit: str, category: str, include_promotion: bool) -> str:
        """Generate reply using Gemini."""
        if not self.model:
            return "Interesting discussion! Thanks for sharing."
            
        subreddit_name = subreddit
        
        # Tone mapping
        tones = {
            'Cricket': 'thoughtful',
            'ipl': 'enthusiastic',
            'IndiaCricket': 'passionate',
            'cricketshitpost': 'humorous/casual'
        }
        tone = tones.get(subreddit_name, 'friendly')
        
        promotion_instruction = ""
        if include_promotion:
            context_list = self.PROMOTION_CONTEXTS.get(category, self.PROMOTION_CONTEXTS['news'])
            promo_text = random.choice(context_list)
            promotion_instruction = f"""
IMPORTANT: Naturally incorporate this RushLine mention: "{promo_text}"
Make it flow naturally. Do NOT sound like an ad."""

        prompt = f"""You are a cricket fan on Reddit.
Your personality: {tone}
Task: Write a comment for r/{subreddit_name}.
Guidelines:
- 2-4 sentences max
- Natural, conversational style
- No hashtags, limit emojis
{promotion_instruction}

Post Title: {title}
Post Content: {content[:500]}
Post Category: {category}"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"AI Generation failed: {e}")
            return "That's an interesting point! Looking forward to seeing how this plays out."

    def fetch_recent_posts(self, subreddit: str, limit: int = 10) -> List[Dict]:
        posts = []
        try:
            logger.info(f"Scanning r/{subreddit}...")
            self.page.goto(f"https://www.reddit.com/r/{subreddit}/new/")
            self.page.wait_for_load_state('domcontentloaded')
            time.sleep(3)
            
            self.page.evaluate("window.scrollTo(0, 1000)")
            time.sleep(1)

            extracted_posts = self.page.evaluate("""() => {
                const posts = [];
                const elements = document.querySelectorAll('shreddit-post');
                elements.forEach(el => {
                    posts.push({
                        id: el.getAttribute('id'),
                        title: el.getAttribute('post-title'),
                        author: el.getAttribute('author'),
                        permalink: el.getAttribute('permalink'),
                        created_timestamp: el.getAttribute('created-timestamp'),
                        score: el.getAttribute('score'),
                        comment_count: el.getAttribute('comment-count')
                    });
                });
                return posts;
            }""")

            logger.info(f"Found {len(extracted_posts)} raw posts")
            
            for p in extracted_posts:
                if len(posts) >= limit:
                    break
                try:
                    if not p['permalink'] or not p['title']:
                        continue
                    
                    if p.get('score') and int(p['score']) < 2: 
                        continue
                        
                    post_id = p['id'] or p['permalink'].split('/comments/')[1].split('/')[0]
                    if post_id in self.processed_posts:
                        continue
                        
                    posts.append(p)
                except Exception:
                    continue

        except Exception as e:
            logger.error(f"Error fetching r/{subreddit}: {e}")
            
        return posts

    def process_posts(self, posts: List[Dict]) -> None:
        for p in posts:
            try:
                url = f"https://www.reddit.com{p['permalink']}"
                logger.info(f"Processing: {p['title'][:30]}... ({url})")
                self.page.goto(url, timeout=45000, wait_until='load')
                
                # Wait for the post centerpiece to have actual height (prevents blank page)
                try:
                    logger.info("Waiting for post content to render...")
                    self.page.wait_for_function("""() => {
                        const post = document.querySelector('shreddit-post');
                        return post && post.offsetHeight > 100;
                    }""", timeout=20000)
                    logger.info("Post content detected in layout")
                except Exception as e:
                    logger.warning(f"Post layout wait timed out or failed: {e}")
                
                time.sleep(3)
                
                content = ""
                try:
                    content = self.page.evaluate("""() => {
                        const el = document.querySelector('div[slot="text-body"], shreddit-post-text-body');
                        return el ? el.innerText : "";
                    }""")
                except: pass
                
                category = self._categorize_post(p['title'], content)
                if not category:
                    logger.info("No clear category found, skipping post")
                    continue
                
                self.promotion_counter += 1
                include_promo = (self.promotion_counter % self.promotion_interval == 0)
                
                try: subreddit_from_link = p['permalink'].split('/r/')[1].split('/')[0]
                except: subreddit_from_link = "Cricket"

                reply_text = self._generate_reply(
                    p['title'], content, subreddit_from_link, 
                    category, include_promo
                )
                
                logger.info(f"Generated reply (Promo={include_promo}): {reply_text[:50]}...")
                
                bbox_found = False
                # Scroll to ensure elements trigger lazy load
                self.page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
                time.sleep(2)
                
                try:
                    # Pure JS based finding and clicking to bypass Playwright's visibility checks
                    clicked = self.page.evaluate("""() => {
                        const selectors = [
                            'shreddit-comment-composer',
                            'faceplate-textarea-input[placeholder*="conversation"]',
                            'faceplate-textarea-input[placeholder*="comment"]',
                            'textarea[placeholder*="conversation"]',
                            'textarea[placeholder*="comment"]',
                            '#comment-composer',
                        ];
                        
                        for (const sel of selectors) {
                            const el = document.querySelector(sel);
                            if (el) {
                                // Force scroll and click even if Playwright thinks it's hidden
                                el.scrollIntoView({behavior: 'instant', block: 'center'});
                                el.click();
                                el.focus();
                                return true;
                            }
                        }
                        return false;
                    }""")
                    
                    if clicked:
                        bbox_found = True
                        logger.info("Clicked comment box via pure JavaScript")
                        time.sleep(2)
                    else:
                        logger.warning("No comment box found via JS selectors")
                        # One last try with a broad search
                        found_broad = self.page.evaluate("""() => {
                            const all = document.querySelectorAll('*');
                            for (const el of all) {
                                if (el.shadowRoot) {
                                    const composer = el.shadowRoot.querySelector('shreddit-comment-composer, textarea');
                                    if (composer) {
                                        composer.scrollIntoView();
                                        composer.click();
                                        return true;
                                    }
                                }
                            }
                            return false;
                        }""")
                        if found_broad:
                            bbox_found = True
                            logger.info("Found comment box via broad shadow DOM search")
                            time.sleep(2)
                        
                except Exception as e:
                    logger.warning(f"Comment box interaction failed: {e}")
                
                if bbox_found:
                    time.sleep(1)
                    # Use direct JS injection to set the text and trigger events
                    self.page.evaluate("""(text) => {
                        const composer = document.querySelector('shreddit-comment-composer, faceplate-textarea-input');
                        if (!composer) return false;
                        
                        const inner = composer.querySelector('div[contenteditable="true"], textarea, input');
                        if (!inner) return false;
                        
                        inner.focus();
                        if (inner.tagName === 'DIV') {
                            inner.textContent = text;
                        } else {
                            inner.value = text;
                        }
                        
                        // Dispatch events so the UI updates
                        inner.dispatchEvent(new Event('input', { bubbles: true }));
                        inner.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }""", reply_text)
                    
                    time.sleep(1)
                    
                    # Dismiss any modal dialogs and log which one was hit
                    dismissed_modal = self.page.evaluate("""() => {
                        const modalSelectors = [
                            '#subredditPostingEligibilityModal button[aria-label="Close"]',
                            '#subredditPostingEligibilityModal button',
                            'div.rpl-dialog button[aria-label="Close"]',
                            'div[role="dialog"] button[aria-label="Close"]',
                            'button[aria-label="close"]',
                            '.modal button.close',
                        ];
                        for (const sel of modalSelectors) {
                            const btn = document.querySelector(sel);
                            if (btn && btn.offsetParent !== null) { // Check if visible
                                btn.click();
                                return sel;
                            }
                        }
                        return null;
                    }""")
                    if dismissed_modal:
                        logger.info(f"Dismissed modal: {dismissed_modal}")
                    
                    time.sleep(1)
                    
                    # Submit using a more robust Shadow DOM traversal
                    submission_result = self.page.evaluate("""() => {
                        const findButton = (root) => {
                            const buttons = Array.from(root.querySelectorAll('button'));
                            const submitBtn = buttons.filter(b => {
                                const txt = b.innerText.trim();
                                return txt === 'Comment' || txt === 'Post' || txt === 'Reply';
                            }).pop();
                            
                            if (submitBtn) return submitBtn;
                            
                            // Search Shadow DOMs
                            const all = root.querySelectorAll('*');
                            for (const el of all) {
                                if (el.shadowRoot) {
                                    const btn = findButton(el.shadowRoot);
                                    if (btn) return btn;
                                }
                            }
                            return null;
                        };
                        
                        // Also log all button texts for debugging
                        const allButtons = [];
                        const collectButtons = (root) => {
                            root.querySelectorAll('button').forEach(b => {
                                const txt = b.innerText.trim();
                                if (txt) allButtons.push(txt);
                            });
                            root.querySelectorAll('*').forEach(el => {
                                if (el.shadowRoot) collectButtons(el.shadowRoot);
                            });
                        };
                        collectButtons(document);
                        
                        const btn = findButton(document);
                        return { success: !!btn, allButtons };
                    }""")
                    
                    logger.info(f"Available buttons: {submission_result['allButtons']}")
                    
                    # Screenshot BEFORE click to see if text is in the box
                    self.page.screenshot(path="debug_before_comment_click.png")
                    
                    if submission_result['success']:
                        self.page.evaluate("""() => {
                            const findButton = (root) => {
                                const buttons = Array.from(root.querySelectorAll('button'));
                                const submitBtn = buttons.filter(b => {
                                    const txt = b.innerText.trim();
                                    return txt === 'Comment' || txt === 'Post' || txt === 'Reply';
                                }).pop();
                                if (submitBtn) return submitBtn;
                                
                                const all = root.querySelectorAll('*');
                                for (const el of all) {
                                    if (el.shadowRoot) {
                                        const btn = findButton(el.shadowRoot);
                                        if (btn) return btn;
                                    }
                                }
                                return null;
                            };
                            const btn = findButton(document);
                            if (btn) btn.click();
                        }""")
                        logger.info("Clicked Comment/Post/Reply button")
                    else:
                        logger.error("Submit button not found")
                    
                    time.sleep(5)
                    self.page.screenshot(path="debug_after_comment_click.png")
                    
                    if submission_result['success']:
                        # Check if we are still on the same page or if an error appeared
                        error_msg = self.page.evaluate("""() => {
                            const errorEl = document.querySelector('[role="alert"], .error, .ErrorMessage');
                            return errorEl ? errorEl.innerText : null;
                        }""")
                        if error_msg:
                            logger.error(f"Error after comment submission: {error_msg}")
                        
                        post_id = p['id'] or p['permalink'].split('/comments/')[1].split('/')[0]
                        logger.info(f"Comment successfully posted to: {post_id}")
                        self.processed_posts.add(post_id)
                        self._save_processed_posts()
                        
                        self.stats['total_replies'] += 1
                        if include_promo:
                            self.stats['promotional_replies'] += 1
                        self._save_stats()
                        
                        sleep_time = random.uniform(self.min_delay, self.max_delay)
                        logger.info(f"Waiting {sleep_time:.1f}s...")
                        time.sleep(sleep_time)
                    else:
                        logger.error("Skipping post due to submission failure")
                else:
                    logger.error("Could not find comment box")
                    self.page.screenshot(path="debug_comment_box_not_found.png")
                    with open("debug_post.html", "w") as f:
                        f.write(self.page.content())
            
            except Exception as e:
                logger.error(f"Failed processing post: {e}")

    def run(self):
        """Main run loop."""
        self.start_browser()
        if self.login():
            logger.info("Starting scan loop...")
            try:
                while True:
                    for sub in self.SUBREDDITS:
                        new_posts = self.fetch_recent_posts(sub, limit=2)
                        self.process_posts(new_posts)
                        time.sleep(5)
                        
                    logger.info(f"Cycle complete. Sleeping {self.check_interval}s...")
                    time.sleep(self.check_interval)
            except KeyboardInterrupt:
                logger.info("Stopping...")
            finally:
                self.stop_browser()
        else:
            logger.error("Login failed. Exiting.")
            self.stop_browser()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--headless', action='store_true', help='Run in headless mode')
    args = parser.parse_args()
    
    bot = RedditCricketBot(headless=args.headless)
    bot.run()
