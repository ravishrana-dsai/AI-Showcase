import os
import time
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()

def guided_login():
    """Establish a valid, verified Reddit session."""
    print("\n" + "="*60)
    print("REDDIT GUIDED LOGIN UTILITY")
    print("="*60)
    
    username = os.getenv('REDDIT_USERNAME')
    if not username:
        print("Error: REDDIT_USERNAME not found in .env")
        return

    # Extract short username for verification (e.g., 'ravishrana91' from email or directly)
    short_username = username.split('@')[0]
    
    with sync_playwright() as p:
        # ALWAYS headful for setup
        browser = p.chromium.launch(headless=False, channel="chrome")
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()
        
        # Stealth init
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)
        
        print(f"Navigating to Reddit login page...")
        page.goto("https://www.reddit.com/login", wait_until="networkidle")
        
        print("\nACTION REQUIRED:")
        print(f"1. Log in manually as '{username}' if not already handled.")
        print("2. Solve any CAPTCHAs or 'Blocked by security' screens.")
        print("3. Wait until you are on the home feed and your profile is visible.")
        print("-" * 30)
        
        input("Press ENTER here once you are fully logged in and see the Reddit home feed...")
        
        # Verification
        print("Verifying session...")
        page.goto("https://www.reddit.com/", wait_until="domcontentloaded")
        time.sleep(3)
        
        # Check for username in content
        if short_username.lower() in page.content().lower():
            print(f"Success! Found '{short_username}' in page content.")
            context.storage_state(path="auth.json")
            print("Authentication state saved to 'auth.json'.")
        else:
            print(f"WARNING: Could not definitively find '{short_username}' on the page.")
            print("Check the browser window. Are you logged in?")
            retry = input("Try saving anyway? (y/n): ")
            if retry.lower() == 'y':
                context.storage_state(path="auth.json")
                print("State saved (force).")
        
        browser.close()
    print("Done.")

if __name__ == "__main__":
    guided_login()
