#!/usr/bin/env python3
"""
Reddit Cricket Browser Bot
Automates Reddit browsing and posting using browser automation.
No Reddit API required - uses your normal login credentials.
Uses Google Gemini API (FREE) for reply generation.
"""

import os
import json
import time
import random
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List, Any
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright, Browser, Page, BrowserContext
import google.generativeai as genai
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('browser_bot.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class RedditBrowserBot:
    """
    Browser-based Reddit bot that automates posting through the UI.
    Uses Playwright for browser automation and Google Gemini for reply generation.
    """
    
    # Subreddits to monitor
    SUBREDDITS = ['Cricket', 'ipl', 'IndiaCricket', 'cricketshitpost']
    
    # Post categories for classification
    CATEGORIES = {
        'match_thread': ['match thread', 'live thread', 'game thread', 'match day', 'playing xi'],
        'fantasy': ['dream11', 'fantasy', 'team selection', 'captain', 'vice captain', 'my team'],
        'stats': ['stats', 'statistics', 'average', 'strike rate', 'economy', 'records'],
        'prediction': ['predict', 'prediction', 'who will win', 'winner', 'forecast'],
        'news': ['news', 'breaking', 'announced', 'confirmed', 'official', 'update']
    }
    
    # Contextual RushLine promotion messages
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
    
    def __init__(self, headless: bool = False):
        """
        Initialize the browser bot.
        
        Args:
            headless: Run browser in headless mode (invisible). 
                     Set False to watch it work, True for background operation.
        """
        load_dotenv()
        
        self.username = os.getenv('REDDIT_USERNAME')
        self.password = os.getenv('REDDIT_PASSWORD')
        
        if not self.username or not self.password:
            raise ValueError("REDDIT_USERNAME and REDDIT_PASSWORD must be set in .env")
        
        # Initialize Google Gemini
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY must be set in .env")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.playwright = None
        
        # Bot state
        self.processed_posts: set = set()
        self.promotion_counter: int = 0
        self.promotion_interval: int = 4
        
        # Stats tracking
        self.stats: Dict[str, Any] = {
            'total_replies': 0,
            'promotional_replies': 0,
            'replies_by_subreddit': {},
            'replies_by_category': {},
            'session_start': datetime.now(timezone.utc).isoformat(),
            'errors': 0
        }
        
        # Timing configuration (human-like delays)
        self.min_action_delay = 2
        self.max_action_delay = 5
        self.typing_delay = 50
        self.post_delay_min = 60
        self.post_delay_max = 180
        self.check_interval = 900
        
        self._load_state()
        logger.info("RedditBrowserBot initialized with Gemini AI")
    
    def _load_state(self) -> None:
        """Load persistent state from files."""
        posts_file = Path('processed_posts.json')
        if posts_file.exists():
            try:
                with open(posts_file, 'r') as f:
                    data = json.load(f)
                    self.processed_posts = set(data.get('post_ids', []))
                    self.promotion_counter = data.get('promotion_counter', 0)
                logger.info(f"Loaded {len(self.processed_posts)} processed posts")
            except Exception as e:
                logger.error(f"Error loading state: {e}")
        
        stats_file = Path('bot_stats.json')
        if stats_file.exists():
            try:
                with open(stats_file, 'r') as f:
                    saved = json.load(f)
                    for key in ['total_replies', 'promotional_replies', 'errors']:
                        self.stats[key] = saved.get(key, 0)
                    self.stats['replies_by_subreddit'] = saved.get('replies_by_subreddit', {})
                    self.stats['replies_by_category'] = saved.get('replies_by_category', {})
            except Exception as e:
                logger.error(f"Error loading stats: {e}")
    
    def _save_state(self) -> None:
        """Save persistent state to files."""
        try:
            with open('processed_posts.json', 'w') as f:
                json.dump({
                    'post_ids': list(self.processed_posts),
                    'promotion_counter': self.promotion_counter,
                    'last_updated': datetime.now(timezone.utc).isoformat()
                }, f, indent=2)
            
            self.stats['last_updated'] = datetime.now(timezone.utc).isoformat()
            with open('bot_stats.json', 'w') as f:
                json.dump(self.stats, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving state: {e}")
    
    def _human_delay(self, min_sec: float = None, max_sec: float = None) -> None:
        """Add a human-like random delay."""
        min_sec = min_sec or self.min_action_delay
        max_sec = max_sec or self.max_action_delay
        delay = random.uniform(min_sec, max_sec)
        time.sleep(delay)
    
    def _type_like_human(self, element, text: str) -> None:
        """Type text with human-like delays between keystrokes."""
        element.click()
        self._human_delay(0.5, 1)
        
        for char in text:
            element.type(char, delay=random.randint(30, 100))
        
        self._human_delay(0.5, 1)
    
    def start_browser(self) -> None:
        """Start the browser and create a new context."""
        logger.info(f"Starting browser (headless={self.headless})")
        
        self.playwright = sync_playwright().start()
        
        self.browser = self.playwright.firefox.launch(
            headless=self.headless,
            slow_mo=100
        )
        
        self.context = self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        
        self.page = self.context.new_page()
        logger.info("Browser started successfully")
    
    def stop_browser(self) -> None:
        """Close the browser and clean up."""
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()
        logger.info("Browser closed")
    
    def login(self) -> bool:
        """Log into Reddit."""
        logger.info(f"Logging into Reddit as {self.username}")
        
        try:
            self.page.goto('https://www.reddit.com/login', wait_until='networkidle')
            self._human_delay(2, 4)
            
            username_field = self.page.locator('input[name="username"]')
            username_field.click()
            self._human_delay(0.5, 1)
            username_field.fill(self.username)
            
            self._human_delay(1, 2)
            
            password_field = self.page.locator('input[name="password"]')
            password_field.click()
            self._human_delay(0.5, 1)
            password_field.fill(self.password)
            
            self._human_delay(1, 2)
            
            login_button = self.page.locator('button[type="submit"]')
            login_button.click()
            
            self.page.wait_for_load_state('networkidle', timeout=30000)
            self._human_delay(3, 5)
            
            if 'login' not in self.page.url.lower():
                logger.info("Login successful!")
                return True
            else:
                logger.error("Login failed - still on login page")
                return False
                
        except Exception as e:
            logger.error(f"Login error: {e}")
            return False
    
    def _categorize_post(self, title: str, content: str = "") -> Optional[str]:
        """Categorize a post based on title and content."""
        text = f"{title} {content}".lower()
        
        for category, keywords in self.CATEGORIES.items():
            if any(keyword in text for keyword in keywords):
                return category
        
        cricket_terms = ['cricket', 'ipl', 'test', 'odi', 't20', 'innings', 'wicket',
                        'batsman', 'bowler', 'century', 'fifty', 'run', 'over']
        if any(term in text for term in cricket_terms):
            return 'news'
        
        return None
    
    def _should_include_promotion(self) -> bool:
        """Check if this reply should include RushLine promotion."""
        self.promotion_counter += 1
        return self.promotion_counter % self.promotion_interval == 0
    
    def _get_promotion_context(self, category: str) -> str:
        """Get a contextual promotion message."""
        contexts = self.PROMOTION_CONTEXTS.get(category, self.PROMOTION_CONTEXTS['news'])
        return random.choice(contexts)
    
    def _get_subreddit_tone(self, subreddit: str) -> str:
        """Get tone guidance for specific subreddit."""
        tones = {
            'Cricket': 'thoughtful and analytical, with respect for cricket traditions',
            'ipl': 'enthusiastic and engaged, with IPL-specific knowledge',
            'IndiaCricket': 'passionate about Indian cricket, knowledgeable about domestic cricket',
            'cricketshitpost': 'casual, humorous, and meme-aware while staying cricket-relevant'
        }
        return tones.get(subreddit, 'friendly and cricket-knowledgeable')
    
    def generate_reply(self, title: str, content: str, subreddit: str, 
                      category: str, include_promotion: bool) -> str:
        """
        Generate an AI-powered reply using Google Gemini.
        """
        tone = self._get_subreddit_tone(subreddit)
        
        promotion_instruction = ""
        if include_promotion:
            promo_context = self._get_promotion_context(category)
            promotion_instruction = f"""
IMPORTANT: Naturally incorporate this RushLine mention somewhere in your response: "{promo_context}"
Make it flow naturally as if you're a genuine user who happens to use RushLine.
Do NOT make it feel like an advertisement."""
        
        prompt = f"""You are an enthusiastic cricket fan engaging naturally in Reddit discussions.
Your personality: {tone}

Guidelines:
- Write 2-4 sentences ONLY, natural and conversational
- Provide genuine cricket insights or observations
- Use cricket terminology naturally
- Match the energy of r/{subreddit}
- NO hashtags, NO excessive emojis (max 1 if appropriate)
- Sound like a real cricket fan, not a brand account
- Be specific to the content being discussed
- Keep it SHORT - Reddit comments are brief
{promotion_instruction}

Category of post: {category}

Post Title: {title}

Post Content: {content[:500] if content else 'No text content - title only post'}

Write a natural, engaging comment for this r/{subreddit} post. Remember: 2-4 sentences MAX."""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error generating reply: {e}")
            raise
    
    def get_posts_from_subreddit(self, subreddit: str, sort: str = 'hot', 
                                  limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch posts from a subreddit."""
        logger.info(f"Fetching posts from r/{subreddit} ({sort})")
        
        posts = []
        
        try:
            url = f'https://www.reddit.com/r/{subreddit}/{sort}/'
            self.page.goto(url, wait_until='networkidle')
            self._human_delay(3, 5)
            
            for _ in range(3):
                self.page.evaluate('window.scrollBy(0, 1000)')
                self._human_delay(1, 2)
            
            post_selectors = [
                'shreddit-post',
                '[data-testid="post-container"]',
                'article',
                '.Post'
            ]
            
            post_elements = []
            for selector in post_selectors:
                post_elements = self.page.locator(selector).all()
                if post_elements:
                    break
            
            for element in post_elements[:limit]:
                try:
                    post_data = self._extract_post_data(element, subreddit)
                    if post_data and post_data['id'] not in self.processed_posts:
                        posts.append(post_data)
                except Exception as e:
                    logger.debug(f"Error extracting post: {e}")
                    continue
            
            logger.info(f"Found {len(posts)} eligible posts in r/{subreddit}")
            
        except Exception as e:
            logger.error(f"Error fetching from r/{subreddit}: {e}")
        
        return posts
    
    def _extract_post_data(self, element, subreddit: str) -> Optional[Dict[str, Any]]:
        """Extract post data from a post element."""
        try:
            post_id = None
            for attr in ['id', 'data-fullname', 'data-post-id']:
                try:
                    post_id = element.get_attribute(attr)
                    if post_id:
                        post_id = post_id.replace('t3_', '').replace('post-', '')
                        break
                except:
                    continue
            
            if not post_id:
                try:
                    link = element.locator('a[href*="/comments/"]').first
                    href = link.get_attribute('href')
                    if href:
                        parts = href.split('/comments/')
                        if len(parts) > 1:
                            post_id = parts[1].split('/')[0]
                except:
                    pass
            
            if not post_id:
                return None
            
            title = ""
            title_selectors = ['h3', '[slot="title"]', '.title', 'a[data-click-id="body"]']
            for sel in title_selectors:
                try:
                    title_el = element.locator(sel).first
                    title = title_el.inner_text()
                    if title:
                        break
                except:
                    continue
            
            if not title:
                return None
            
            score = 0
            score_selectors = ['[data-testid="post-score"]', '.score', 'faceplate-number']
            for sel in score_selectors:
                try:
                    score_el = element.locator(sel).first
                    score_text = score_el.inner_text()
                    score_text = score_text.lower().replace(',', '')
                    if 'k' in score_text:
                        score = int(float(score_text.replace('k', '')) * 1000)
                    else:
                        score = int(score_text)
                    break
                except:
                    continue
            
            comments = 0
            comment_selectors = ['[data-testid="comment-count"]', '.comments', 'a[href*="comments"]']
            for sel in comment_selectors:
                try:
                    comment_el = element.locator(sel).first
                    comment_text = comment_el.inner_text()
                    import re
                    numbers = re.findall(r'\d+', comment_text)
                    if numbers:
                        comments = int(numbers[0])
                    break
                except:
                    continue
            
            permalink = ""
            try:
                link = element.locator('a[href*="/comments/"]').first
                permalink = link.get_attribute('href')
                if permalink and not permalink.startswith('http'):
                    permalink = f"https://www.reddit.com{permalink}"
            except:
                permalink = f"https://www.reddit.com/r/{subreddit}/comments/{post_id}/"
            
            if score < 5 and comments < 3:
                return None
            if comments >= 200:
                return None
            
            category = self._categorize_post(title)
            if not category:
                return None
            
            return {
                'id': post_id,
                'title': title,
                'score': score,
                'comments': comments,
                'permalink': permalink,
                'subreddit': subreddit,
                'category': category
            }
            
        except Exception as e:
            logger.debug(f"Error in _extract_post_data: {e}")
            return None
    
    def reply_to_post(self, post: Dict[str, Any]) -> bool:
        """Navigate to a post and submit a reply."""
        logger.info(f"Replying to: {post['title'][:50]}...")
        
        try:
            self.page.goto(post['permalink'], wait_until='networkidle')
            self._human_delay(3, 5)
            
            content = ""
            try:
                content_selectors = ['[slot="text-body"]', '.md', '[data-testid="post-content"]']
                for sel in content_selectors:
                    try:
                        content_el = self.page.locator(sel).first
                        content = content_el.inner_text()
                        if content:
                            break
                    except:
                        continue
            except:
                pass
            
            include_promotion = self._should_include_promotion()
            
            reply_text = self.generate_reply(
                title=post['title'],
                content=content,
                subreddit=post['subreddit'],
                category=post['category'],
                include_promotion=include_promotion
            )
            
            logger.info(f"Generated reply: {reply_text[:100]}...")
            
            comment_box_selectors = [
                '[placeholder*="comment"]',
                '[aria-label*="comment"]',
                'div[contenteditable="true"]',
                'textarea',
                'shreddit-composer'
            ]
            
            comment_box = None
            for sel in comment_box_selectors:
                try:
                    comment_box = self.page.locator(sel).first
                    if comment_box.is_visible():
                        break
                except:
                    continue
            
            if not comment_box:
                try:
                    add_comment_btn = self.page.locator('button:has-text("Add a comment")').first
                    add_comment_btn.click()
                    self._human_delay(1, 2)
                    comment_box = self.page.locator('textarea, div[contenteditable="true"]').first
                except:
                    pass
            
            if not comment_box:
                logger.error("Could not find comment box")
                return False
            
            comment_box.click()
            self._human_delay(1, 2)
            
            comment_box.fill(reply_text)
            self._human_delay(2, 4)
            
            submit_selectors = [
                'button:has-text("Comment")',
                'button:has-text("Reply")',
                'button[type="submit"]',
                '[data-testid="comment-submission-form-submit"]'
            ]
            
            for sel in submit_selectors:
                try:
                    submit_btn = self.page.locator(sel).first
                    if submit_btn.is_visible():
                        submit_btn.click()
                        break
                except:
                    continue
            
            self._human_delay(3, 5)
            
            self.processed_posts.add(post['id'])
            self.stats['total_replies'] += 1
            
            if include_promotion:
                self.stats['promotional_replies'] += 1
            
            sub = post['subreddit']
            self.stats['replies_by_subreddit'][sub] = \
                self.stats['replies_by_subreddit'].get(sub, 0) + 1
            
            cat = post['category']
            self.stats['replies_by_category'][cat] = \
                self.stats['replies_by_category'].get(cat, 0) + 1
            
            self._save_state()
            
            logger.info(f"✓ Reply posted! (Promotional: {include_promotion})")
            return True
            
        except Exception as e:
            logger.error(f"Error replying to post: {e}")
            self.stats['errors'] += 1
            self._save_state()
            return False
    
    def run_once(self, max_replies: int = 3) -> int:
        """Run a single scan and reply cycle."""
        logger.info("Starting scan cycle...")
        
        all_posts = []
        
        for subreddit in self.SUBREDDITS:
            posts = self.get_posts_from_subreddit(subreddit, 'hot', 10)
            all_posts.extend(posts)
            self._human_delay(2, 4)
            
            new_posts = self.get_posts_from_subreddit(subreddit, 'new', 5)
            all_posts.extend(new_posts)
            self._human_delay(2, 4)
        
        all_posts.sort(key=lambda p: p['score'] + p['comments'], reverse=True)
        
        seen_ids = set()
        unique_posts = []
        for post in all_posts:
            if post['id'] not in seen_ids:
                seen_ids.add(post['id'])
                unique_posts.append(post)
        
        logger.info(f"Found {len(unique_posts)} eligible posts")
        
        replies_posted = 0
        
        for post in unique_posts:
            if replies_posted >= max_replies:
                break
            
            if self.reply_to_post(post):
                replies_posted += 1
                
                if replies_posted < max_replies:
                    delay = random.uniform(self.post_delay_min, self.post_delay_max)
                    logger.info(f"Waiting {delay:.0f}s before next reply...")
                    time.sleep(delay)
        
        logger.info(f"Cycle complete. Posted {replies_posted} replies.")
        return replies_posted
    
    def run(self, max_replies_per_cycle: int = 3) -> None:
        """Run the bot continuously."""
        logger.info("=" * 50)
        logger.info("Starting RedditBrowserBot in continuous mode")
        logger.info(f"Monitoring: {', '.join(self.SUBREDDITS)}")
        logger.info(f"Headless: {self.headless}")
        logger.info("=" * 50)
        
        try:
            self.start_browser()
            
            if not self.login():
                logger.error("Failed to login. Exiting.")
                return
            
            while True:
                self.run_once(max_replies_per_cycle)
                
                logger.info(f"Sleeping {self.check_interval}s until next cycle...")
                time.sleep(self.check_interval)
                
        except KeyboardInterrupt:
            logger.info("\nBot stopped by user")
        finally:
            self._save_state()
            self.stop_browser()
            logger.info("State saved. Goodbye!")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Reddit Cricket Browser Bot')
    parser.add_argument('--headless', action='store_true',
                       help='Run browser in headless mode (invisible)')
    parser.add_argument('--once', action='store_true',
                       help='Run single cycle then exit')
    parser.add_argument('--max-replies', type=int, default=3,
                       help='Maximum replies per cycle (default: 3)')
    
    args = parser.parse_args()
    
    bot = RedditBrowserBot(headless=args.headless)
    
    try:
        bot.start_browser()
        
        if not bot.login():
            print("❌ Login failed. Check your credentials in .env")
            return
        
        print("✓ Login successful!")
        
        if args.once:
            bot.run_once(args.max_replies)
        else:
            bot.run(args.max_replies)
            
    except KeyboardInterrupt:
        print("\n👋 Stopped by user")
    finally:
        bot.stop_browser()


if __name__ == '__main__':
    main()
