'use client';

export type TabId = 'browse' | 'submit' | 'generator';

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  promptCount: number;
}

export default function TabBar({ activeTab, onTabChange, promptCount }: TabBarProps) {
  const tabClass = (tab: TabId) =>
    `px-5 py-3 text-sm font-medium transition-all flex items-center gap-1.5 relative ${
      activeTab === tab
        ? 'text-gradient tab-active-gradient font-semibold'
        : 'text-muted hover:text-foreground'
    }`;

  return (
    <div className="glass-strong">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 -mb-px">
          <button onClick={() => onTabChange('browse')} className={tabClass('browse')}>
            Browse Prompts
            <span className="px-2 py-0.5 text-xs rounded-full glass font-normal text-muted">
              {promptCount}
            </span>
          </button>
          <button onClick={() => onTabChange('submit')} className={tabClass('submit')}>
            Submit a Prompt
          </button>
          <button onClick={() => onTabChange('generator')} className={tabClass('generator')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
            Prompt Generator
          </button>
        </nav>
      </div>
    </div>
  );
}
