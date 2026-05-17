import time
from playwright.sync_api import sync_playwright

def setup_login():
    print("Launching browser for manual login...")
    with sync_playwright() as p:
        # Launch headful so user can see and interact
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        print("Navigating to Reddit...")
        page.goto("https://www.reddit.com/login")
        
        print("\n" + "="*50)
        print("ACTION REQUIRED: Please log in manually in the browser window.")
        print("Resolve any CAPTCHAs or 2FA if prompted.")
        print("Once you are fully logged in and can see your feed, press Enter here.")
        print("="*50 + "\n")
        
        input("Press Enter after you have successfully logged in...")
        
        # Save storage state
        print("Saving authentication state to 'auth.json'...")
        context.storage_state(path="auth.json")
        print("Success! Session saved.")
        
        browser.close()

if __name__ == "__main__":
    setup_login()
