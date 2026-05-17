#!/usr/bin/env python3
"""
Analytics Dashboard for Reddit Cricket Bot
Displays bot performance statistics with rich formatting.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    from rich.layout import Layout
    from rich.text import Text
    from rich import box
    from rich.live import Live
    from rich.progress import Progress, SpinnerColumn, TextColumn
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    print("Note: Install 'rich' for better dashboard display: pip install rich")


class AnalyticsDashboard:
    """Dashboard for viewing bot performance metrics."""
    
    def __init__(self, stats_file: str = 'bot_stats.json', 
                 posts_file: str = 'processed_posts.json'):
        self.stats_file = Path(stats_file)
        self.posts_file = Path(posts_file)
        self.console = Console() if RICH_AVAILABLE else None
    
    def load_stats(self) -> Optional[Dict[str, Any]]:
        """Load statistics from file."""
        if not self.stats_file.exists():
            return None
        
        try:
            with open(self.stats_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading stats: {e}")
            return None
    
    def load_processed_posts(self) -> Optional[Dict[str, Any]]:
        """Load processed posts data."""
        if not self.posts_file.exists():
            return None
        
        try:
            with open(self.posts_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading posts: {e}")
            return None
    
    def calculate_metrics(self, stats: Dict[str, Any], 
                         posts_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate derived metrics from raw stats."""
        total_replies = stats.get('total_replies', 0)
        promo_replies = stats.get('promotional_replies', 0)
        
        promo_rate = (promo_replies / max(1, total_replies)) * 100
        organic_rate = 100 - promo_rate
        
        # Parse session time
        session_start = stats.get('session_start')
        if session_start:
            try:
                start_dt = datetime.fromisoformat(session_start.replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)
                uptime = now - start_dt
                uptime_str = str(uptime).split('.')[0]  # Remove microseconds
            except:
                uptime_str = "Unknown"
        else:
            uptime_str = "Unknown"
        
        posts_count = len(posts_data.get('post_ids', [])) if posts_data else 0
        
        return {
            'total_replies': total_replies,
            'promotional_replies': promo_replies,
            'organic_replies': total_replies - promo_replies,
            'promotion_rate': promo_rate,
            'organic_rate': organic_rate,
            'posts_processed': posts_count,
            'errors': stats.get('errors', 0),
            'uptime': uptime_str,
            'replies_by_subreddit': stats.get('replies_by_subreddit', {}),
            'replies_by_category': stats.get('replies_by_category', {}),
            'last_updated': stats.get('last_updated', 'Unknown')
        }
    
    def display_rich(self, metrics: Dict[str, Any]) -> None:
        """Display dashboard using rich library."""
        console = self.console
        
        # Clear screen
        console.clear()
        
        # Header
        header = Panel(
            Text("🏏 Reddit Cricket Bot Analytics", style="bold cyan", justify="center"),
            box=box.DOUBLE,
            border_style="cyan"
        )
        console.print(header)
        console.print()
        
        # Overview stats table
        overview = Table(title="📊 Overview", box=box.ROUNDED, 
                        border_style="green", show_header=True)
        overview.add_column("Metric", style="cyan", width=25)
        overview.add_column("Value", style="white", width=20)
        
        overview.add_row("Total Replies", str(metrics['total_replies']))
        overview.add_row("Organic Replies", str(metrics['organic_replies']))
        overview.add_row("Promotional Replies", str(metrics['promotional_replies']))
        overview.add_row("Promotion Rate", f"{metrics['promotion_rate']:.1f}%")
        overview.add_row("Posts Processed", str(metrics['posts_processed']))
        overview.add_row("Errors", str(metrics['errors']))
        overview.add_row("Session Uptime", metrics['uptime'])
        
        console.print(overview)
        console.print()
        
        # Subreddit breakdown
        if metrics['replies_by_subreddit']:
            sub_table = Table(title="📍 Replies by Subreddit", box=box.ROUNDED,
                            border_style="blue")
            sub_table.add_column("Subreddit", style="cyan")
            sub_table.add_column("Replies", style="white", justify="right")
            sub_table.add_column("% of Total", style="green", justify="right")
            
            total = metrics['total_replies']
            for sub, count in sorted(metrics['replies_by_subreddit'].items(), 
                                    key=lambda x: x[1], reverse=True):
                pct = (count / max(1, total)) * 100
                sub_table.add_row(f"r/{sub}", str(count), f"{pct:.1f}%")
            
            console.print(sub_table)
            console.print()
        
        # Category breakdown
        if metrics['replies_by_category']:
            cat_table = Table(title="🏷️ Replies by Category", box=box.ROUNDED,
                            border_style="magenta")
            cat_table.add_column("Category", style="cyan")
            cat_table.add_column("Replies", style="white", justify="right")
            cat_table.add_column("% of Total", style="green", justify="right")
            
            total = metrics['total_replies']
            for cat, count in sorted(metrics['replies_by_category'].items(),
                                    key=lambda x: x[1], reverse=True):
                pct = (count / max(1, total)) * 100
                cat_table.add_row(cat.replace('_', ' ').title(), str(count), f"{pct:.1f}%")
            
            console.print(cat_table)
            console.print()
        
        # Promotion strategy insight
        promo_panel = Panel(
            f"[green]Organic Content:[/green] {metrics['organic_rate']:.1f}% | "
            f"[yellow]RushLine Mentions:[/yellow] {metrics['promotion_rate']:.1f}%\n\n"
            f"Target ratio is 4:1 (25% promotional). "
            f"Current: {4 if metrics['promotion_rate'] == 25 else 'adjusting'}:1",
            title="📈 Promotion Strategy",
            border_style="yellow",
            box=box.ROUNDED
        )
        console.print(promo_panel)
        console.print()
        
        # Footer
        console.print(f"[dim]Last updated: {metrics['last_updated']}[/dim]")
    
    def display_simple(self, metrics: Dict[str, Any]) -> None:
        """Display dashboard using simple print statements."""
        print("\n" + "=" * 50)
        print("🏏 Reddit Cricket Bot Analytics")
        print("=" * 50)
        
        print("\n📊 OVERVIEW")
        print("-" * 30)
        print(f"  Total Replies:       {metrics['total_replies']}")
        print(f"  Organic Replies:     {metrics['organic_replies']}")
        print(f"  Promotional Replies: {metrics['promotional_replies']}")
        print(f"  Promotion Rate:      {metrics['promotion_rate']:.1f}%")
        print(f"  Posts Processed:     {metrics['posts_processed']}")
        print(f"  Errors:              {metrics['errors']}")
        print(f"  Session Uptime:      {metrics['uptime']}")
        
        if metrics['replies_by_subreddit']:
            print("\n📍 REPLIES BY SUBREDDIT")
            print("-" * 30)
            total = metrics['total_replies']
            for sub, count in sorted(metrics['replies_by_subreddit'].items(),
                                    key=lambda x: x[1], reverse=True):
                pct = (count / max(1, total)) * 100
                print(f"  r/{sub:<20} {count:>4} ({pct:.1f}%)")
        
        if metrics['replies_by_category']:
            print("\n🏷️ REPLIES BY CATEGORY")
            print("-" * 30)
            total = metrics['total_replies']
            for cat, count in sorted(metrics['replies_by_category'].items(),
                                    key=lambda x: x[1], reverse=True):
                pct = (count / max(1, total)) * 100
                print(f"  {cat.replace('_', ' ').title():<20} {count:>4} ({pct:.1f}%)")
        
        print("\n📈 PROMOTION STRATEGY")
        print("-" * 30)
        print(f"  Organic Content:    {metrics['organic_rate']:.1f}%")
        print(f"  RushLine Mentions:  {metrics['promotion_rate']:.1f}%")
        print(f"  Target: 4:1 ratio (25% promotional)")
        
        print(f"\n[Last updated: {metrics['last_updated']}]")
        print("=" * 50 + "\n")
    
    def display(self) -> None:
        """Display the analytics dashboard."""
        stats = self.load_stats()
        posts = self.load_processed_posts()
        
        if stats is None:
            print("\n⚠️  No statistics found. Run the bot first to generate data.")
            print("   Stats file expected at: bot_stats.json")
            return
        
        metrics = self.calculate_metrics(stats, posts)
        
        if RICH_AVAILABLE and self.console:
            self.display_rich(metrics)
        else:
            self.display_simple(metrics)
    
    def export_csv(self, filename: str = 'bot_analytics.csv') -> None:
        """Export statistics to CSV format."""
        stats = self.load_stats()
        posts = self.load_processed_posts()
        
        if stats is None:
            print("No statistics to export.")
            return
        
        metrics = self.calculate_metrics(stats, posts)
        
        with open(filename, 'w') as f:
            f.write("Metric,Value\n")
            f.write(f"Total Replies,{metrics['total_replies']}\n")
            f.write(f"Organic Replies,{metrics['organic_replies']}\n")
            f.write(f"Promotional Replies,{metrics['promotional_replies']}\n")
            f.write(f"Promotion Rate,{metrics['promotion_rate']:.1f}%\n")
            f.write(f"Posts Processed,{metrics['posts_processed']}\n")
            f.write(f"Errors,{metrics['errors']}\n")
            
            f.write("\nSubreddit,Replies\n")
            for sub, count in metrics['replies_by_subreddit'].items():
                f.write(f"r/{sub},{count}\n")
            
            f.write("\nCategory,Replies\n")
            for cat, count in metrics['replies_by_category'].items():
                f.write(f"{cat},{count}\n")
        
        print(f"✓ Exported analytics to {filename}")
    
    def live_monitor(self, refresh_interval: int = 30) -> None:
        """Display live updating dashboard (requires rich)."""
        if not RICH_AVAILABLE:
            print("Live monitoring requires 'rich' library: pip install rich")
            return
        
        console = self.console
        
        try:
            while True:
                self.display()
                console.print(f"\n[dim]Auto-refreshing every {refresh_interval}s. Press Ctrl+C to exit.[/dim]")
                
                import time
                time.sleep(refresh_interval)
                
        except KeyboardInterrupt:
            console.print("\n[yellow]Live monitoring stopped.[/yellow]")


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Reddit Cricket Bot Analytics Dashboard')
    parser.add_argument('--export', action='store_true',
                       help='Export statistics to CSV')
    parser.add_argument('--live', action='store_true',
                       help='Live monitoring mode (auto-refresh)')
    parser.add_argument('--refresh', type=int, default=30,
                       help='Refresh interval for live mode (seconds)')
    parser.add_argument('--stats-file', default='bot_stats.json',
                       help='Path to bot statistics file')
    parser.add_argument('--posts-file', default='processed_posts.json',
                       help='Path to processed posts file')
    
    args = parser.parse_args()
    
    dashboard = AnalyticsDashboard(args.stats_file, args.posts_file)
    
    if args.export:
        dashboard.export_csv()
    elif args.live:
        dashboard.live_monitor(args.refresh)
    else:
        dashboard.display()


if __name__ == '__main__':
    main()
