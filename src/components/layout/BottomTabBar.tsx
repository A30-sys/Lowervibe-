import { FolderHeart, Home, PlusCircle, Search, User } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

export type MainTabType =
  | 'home'
  | 'search'
  | 'library'
  | 'upload'
  | 'profile'
  | 'discover'
  | 'studio'
  | 'account'
  | 'admin';

interface BottomTabBarProps {
  activeTab: MainTabType;
  onSelectTab: (tab: MainTabType) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onSelectTab }) => {
  const { t } = useLanguage();

  const normalizedActive: 'home' | 'search' | 'library' | 'upload' | 'profile' = (() => {
    if (activeTab === 'discover') return 'search';
    if (activeTab === 'studio') return 'upload';
    if (activeTab === 'account' || activeTab === 'admin') return 'profile';
    return activeTab;
  })();

  const TABS: {
    id: 'home' | 'search' | 'library' | 'upload' | 'profile';
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'home', label: t('home', 'Home'), icon: Home },
    { id: 'search', label: t('search', 'Search'), icon: Search },
    { id: 'library', label: t('library', 'Library'), icon: FolderHeart },
    { id: 'upload', label: t('upload', 'Upload'), icon: PlusCircle },
    { id: 'profile', label: t('profile', 'Profile'), icon: User },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg)]/[0.98] border-t border-[var(--border)] px-2 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom,0px))] transition-colors duration-200"
      aria-label="Primary mobile navigation"
    >
      <div className="max-w-lg mx-auto grid grid-cols-5 gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = normalizedActive === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center rounded-2xl min-h-[48px] px-1 py-1 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] cursor-pointer ${
                isActive
                  ? 'text-[var(--accent-text)] bg-[var(--surface-2)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  isActive ? 'stroke-[2.4] scale-105' : 'stroke-[1.8]'
                }`}
              />
              <span className={`text-[11px] leading-tight mt-0.5 truncate max-w-full ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
