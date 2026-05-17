#!/usr/bin/env python3
"""
Test Setup Script for Reddit Cricket Browser Bot
Verifies all credentials and connections before running the main bot.
"""

import os
import sys
from pathlib import Path

# Color support for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str) -> None:
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 50}")
    print(f"  {text}")
    print(f"{'=' * 50}{Colors.RESET}\n")


def print_success(text: str) -> None:
    print(f"  {Colors.GREEN}✓{Colors.RESET} {text}")


def print_error(text: str) -> None:
    print(f"  {Colors.RED}✗{Colors.RESET} {text}")


def print_warning(text: str) -> None:
    print(f"  {Colors.YELLOW}⚠{Colors.RESET} {text}")


def print_info(text: str) -> None:
    print(f"  {Colors.BLUE}ℹ{Colors.RESET} {text}")


def check_env_file() -> bool:
    """Check if .env file exists."""
    print_header("Checking Environment File")
    
    env_path = Path('.env')
    example_path = Path('.env.example')
    
    if not env_path.exists():
        print_error(".env file not found!")
        if example_path.exists():
            print_info("Copy .env.example to .env and fill in your credentials:")
            print(f"    cp .env.example .env")
        return False
    
    print_success(".env file found")
    return True


def check_dependencies() -> bool:
    """Check if required packages are installed."""
    print_header("Checking Dependencies")
    
    packages = {
        'playwright': 'playwright',
        'anthropic': 'anthropic',
        'dotenv': 'python-dotenv',
        'rich': 'rich'
    }
    
    all_installed = True
    
    for module, package in packages.items():
        try:
            __import__(module)
            print_success(f"{package} is installed")
        except ImportError:
            print_error(f"{package} is NOT installed")
            all_installed = False
    
    if not all_installed:
        print_info("Install missing packages with: pip install -r requirements.txt")
    
    return all_installed


def check_playwright_browsers() -> bool:
    """Check if Playwright browsers are installed."""
    print_header("Checking Playwright Browsers")
    
    try:
        from playwright.sync_api import sync_playwright
        
        with sync_playwright() as p:
            # Try to launch Firefox (we use this by default)
            browser = p.firefox.launch(headless=True)
            browser.close()
            print_success("Firefox browser is installed")
            return True
            
    except Exception as e:
        print_error(f"Playwright browsers not installed: {e}")
        print_info("Install browsers with: playwright install firefox")
        return False


def check_reddit_credentials() -> bool:
    """Verify Reddit credentials are set."""
    print_header("Checking Reddit Credentials")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    username = os.getenv('REDDIT_USERNAME')
    password = os.getenv('REDDIT_PASSWORD')
    
    if not username or username.startswith('your_'):
        print_error("REDDIT_USERNAME not set or is placeholder")
        return False
    print_success(f"REDDIT_USERNAME is set: {username}")
    
    if not password or password.startswith('your_'):
        print_error("REDDIT_PASSWORD not set or is placeholder")
        return False
    print_success("REDDIT_PASSWORD is set")
    
    print_warning("Login will be tested when you run the bot")
    print_info("If you have 2FA enabled, the bot may not be able to login")
    
    return True


def check_anthropic_credentials() -> bool:
    """Verify Anthropic API credentials work."""
    print_header("Testing Anthropic API Connection")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    api_key = os.getenv('ANTHROPIC_API_KEY')
    
    if not api_key or api_key.startswith('your_'):
        print_error("ANTHROPIC_API_KEY not set or is placeholder")
        print_info("Get your API key from: https://console.anthropic.com/")
        return False
    
    print_success("ANTHROPIC_API_KEY is set")
    
    # Test actual API call
    try:
        from anthropic import Anthropic
        
        client = Anthropic(api_key=api_key)
        
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=50,
            messages=[{"role": "user", "content": "Say 'API test successful' in exactly those words."}]
        )
        
        result = response.content[0].text
        print_success(f"API response received: {result[:50]}...")
        print_info("Model: claude-sonnet-4-20250514")
        
        return True
        
    except Exception as e:
        print_error(f"Anthropic API error: {e}")
        return False


def check_file_permissions() -> bool:
    """Check if bot can write necessary files."""
    print_header("Checking File Permissions")
    
    test_files = ['processed_posts.json', 'bot_stats.json', 'browser_bot.log']
    all_good = True
    
    for filename in test_files:
        path = Path(filename)
        try:
            with open(path, 'a') as f:
                pass
            print_success(f"Can write to {filename}")
        except Exception as e:
            print_error(f"Cannot write to {filename}: {e}")
            all_good = False
    
    return all_good


def run_sample_generation() -> bool:
    """Test generating a sample reply without posting."""
    print_header("Testing Reply Generation")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    try:
        from anthropic import Anthropic
        
        client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        
        sample_title = "Virat Kohli's form in IPL 2024 - Discussion"
        sample_content = "What do you think about Kohli's current form?"
        
        system_prompt = """You are an enthusiastic cricket fan engaging naturally in Reddit discussions.
Your personality: enthusiastic and engaged, with IPL-specific knowledge

Guidelines:
- Write 2-4 sentences, natural and conversational
- Provide genuine cricket insights
- Use cricket terminology naturally
- NO hashtags, NO excessive emojis"""

        user_prompt = f"""Post Title: {sample_title}
Post Content: {sample_content}

Write a natural, engaging comment for this r/ipl post."""

        print_info("Generating sample reply...")
        
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            temperature=0.8,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}]
        )
        
        reply = response.content[0].text.strip()
        
        print_success("Sample reply generated:")
        print(f"\n{Colors.YELLOW}    \"{reply}\"{Colors.RESET}\n")
        
        return True
        
    except Exception as e:
        print_error(f"Reply generation failed: {e}")
        return False


def main():
    """Run all setup tests."""
    print(f"\n{Colors.BOLD}🏏 Reddit Cricket Browser Bot - Setup Verification{Colors.RESET}")
    print("=" * 55)
    
    results = {}
    
    # Run tests
    results['env_file'] = check_env_file()
    
    if not results['env_file']:
        print(f"\n{Colors.RED}Setup incomplete. Create .env file first.{Colors.RESET}")
        sys.exit(1)
    
    results['dependencies'] = check_dependencies()
    
    if not results['dependencies']:
        print(f"\n{Colors.RED}Setup incomplete. Install dependencies first.{Colors.RESET}")
        print("Run: pip install -r requirements.txt")
        sys.exit(1)
    
    results['playwright_browsers'] = check_playwright_browsers()
    
    if not results['playwright_browsers']:
        print(f"\n{Colors.YELLOW}Playwright browsers not installed.{Colors.RESET}")
        print("Run: playwright install firefox")
        print("Then run this test again.")
        sys.exit(1)
    
    results['file_permissions'] = check_file_permissions()
    results['reddit'] = check_reddit_credentials()
    results['anthropic'] = check_anthropic_credentials()
    
    if results['anthropic']:
        results['generation'] = run_sample_generation()
    else:
        results['generation'] = False
    
    # Summary
    print_header("Setup Summary")
    
    all_passed = all(results.values())
    
    for test, passed in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if passed else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"  {test}: {status}")
    
    print()
    
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ All tests passed! Bot is ready to run.{Colors.RESET}")
        print(f"\nStart the bot with:")
        print(f"  python browser_bot.py              # Watch it work (visible browser)")
        print(f"  python browser_bot.py --headless   # Background mode (invisible)")
        print(f"  python browser_bot.py --once       # Single cycle only")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}✗ Some tests failed. Fix issues above before running bot.{Colors.RESET}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
