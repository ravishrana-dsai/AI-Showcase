from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    print("Navigating to google...")
    page.goto("https://www.google.com")
    print("Title:", page.title())
    browser.close()
    print("Done.")
