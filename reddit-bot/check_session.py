import os
import os
import time
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

def check_session():
    load_dotenv()
    username_env = os.getenv('REDDIT_USERNAME')
    if not username_env:
        print("Error: REDDIT_USERNAME not found in .env")
        return
        
    short_username = username_env.split('@')[0]
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            channel="chrome",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ]
        )
        if os.path.exists("auth.json"):
            context = browser.new_context(
                storage_state="auth.json",
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 800}
            )
            page = context.new_page()
            # Mask automation footprint
            page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                window.chrome = { runtime: {} };
            """)
            
            print(f"Verifying session for user: {short_username}...")
            page.goto("https://www.reddit.com/", wait_until="domcontentloaded")
            time.sleep(5)
            
            content = page.content().lower()
            is_logged_in = short_username.lower() in content
            
            if is_logged_in:
                print(f"VERIFIED: Logged in as {short_username}")
            else:
                print(f"FAILED: Session is NOT authenticated as {short_username}")
                if "blocked by network security" in content:
                    print("REASON: Blocked by network security.")
                else:
                    print("REASON: Generic logged-out state or different account.")
            
            page.screenshot(path="session_check_result.png")
            context.close()
        else:
            print("Error: auth.json not found. Run login_utility.py first.")
        browser.close()

if __name__ == "__main__":
    check_session()
