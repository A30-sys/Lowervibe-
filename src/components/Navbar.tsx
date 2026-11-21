import {
  Activity,
  BarChart3,
  ChevronDown,
  Compass,
  Download,
  Eye,
  Flame,
  Globe,
  History,
  ListMusic,
  LogOut,
  Moon,
  Music,
  Radio,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  UserCheck,
  UserCircle2,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { LANGUAGES, Language, useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  currentTab: 'explore' | 'artists' | 'history' | 'playlists' | 'admin';
  onSelectTab: (tab: 'explore' | 'artists' | 'history' | 'playlists' | 'admin') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
  onOpenArtistGate?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
  activeCategory = 'all',
  onSelectCategory,
  onOpenArtistGate,
}) => {
  const {
    playHistory,
    setIsArtistSubmitModalOpen,
    openAuthModal,
    isVisualizerActive,
    toggleVisualizer,
    openLegalModal,
    artists,
    setSelectedArtistModal,
    openAnalyticsModal,
  } = useAudio();
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { language, setLanguage, currentLanguage, t } = useLanguage();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleInstallClick = () => {
    window.dispatchEvent(new CustomEvent('lowervibe:open-install-prompt'));
  };

  const handleTabClick = (tab: 'explore' | 'artists' | 'history' | 'playlists' | 'admin') => {
    setIsUserMenuOpen(false);
    onSelectTab(tab);
  };

  const handleCategoryNav = (cat: string) => {
    setIsUserMenuOpen(false);
    onSelectTab('explore');
    onSelectCategory?.(cat);
  };

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div
          onClick={() => {
            onSelectTab('explore');
            onSelectCategory?.('all');
          }}
          className="flex items-center gap-2.5 cursor-pointer shrink-0 select-none group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-black tracking-wider text-white font-heading">
                LOWER<span className="text-amber-400">VIBE</span>
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700 hidden sm:inline">
                PWA
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase block -mt-1">
              Underground & Ambient
            </span>
          </div>
        </div>

        {/* Center Nav Links & Categories */}
        <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-2xl border border-zinc-800/80">
          <button
            onClick={() => {
              onSelectTab('explore');
              onSelectCategory?.('all');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentTab === 'explore' && activeCategory === 'all'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t('explore', 'Explore')}</span>
          </button>

          {/* Quick Header Category: Trending */}
          <button
            onClick={() => handleCategoryNav('trending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentTab === 'explore' && activeCategory === 'trending'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('trending', 'Trending')}</span>
          </button>

          {/* Quick Header Category: New Albums / Releases */}
          <button
            onClick={() => handleCategoryNav('new_albums')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              currentTab === 'explore' && activeCategory === 'new_albums'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('new_albums', 'New Albums')}</span>
          </button>

          <button
            onClick={() => handleTabClick('artists')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'artists'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t('artists', 'Artists')}</span>
          </button>

          <button
            onClick={() => handleTabClick('history')}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'history'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('history', 'History')}</span>
            {playHistory.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  currentTab === 'history'
                    ? 'bg-zinc-950 text-amber-400'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {playHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('playlists')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              currentTab === 'playlists'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-bold'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>{t('playlists', 'Playlists')}</span>
          </button>
        </nav>

        {/* Right Section: Search, Visualizer, Theme, PWA Install, Submit Music & Unified Profile Hub */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Quick Search Bar */}
          <div className="relative hidden xl:block w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder={t('search_placeholder', 'Search sounds...')}
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Quick Visualizer Toggle in Header */}
          <button
            onClick={toggleVisualizer}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition ${
              isVisualizerActive
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
            title="Toggle Live Audio Visualizer (V)"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold">{isVisualizerActive ? t('vis_on', 'VIS ON') : t('vis_off', 'VIS OFF')}</span>
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-amber-400 border border-zinc-800 transition shadow-sm active:scale-95"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* PWA Install Button (Approved Artists Only) */}
          {(currentUser?.role === 'artist' ||
            currentUser?.applicationStatus === 'approved' ||
            currentUser?.role === 'admin') && (
            <button
              onClick={handleInstallClick}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition text-xs font-medium"
              title="Install LOWERVIBE Artist WebApp"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('install_app', 'Install App')}</span>
            </button>
          )}

          {/* Artist Submission Trigger with Permission Gate */}
          <button
            onClick={() => {
              if (currentUser?.role === 'artist') {
                setIsArtistSubmitModalOpen(true);
              } else {
                onOpenArtistGate?.();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 active:scale-95 shrink-0"
            title="Upload Music & Album (Requires Artist Account)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share as Artist</span>
            <span className="sm:hidden text-xs">Share</span>
          </button>

          {/* Unified Profile Hub & Authentication Dropdown */}
          <div className="relative shrink-0">
            {currentUser ? (
              <button
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                className="flex items-center gap-2 p-1 sm:pl-2.5 sm:pr-2 bg-zinc-900 hover:bg-zinc-850 rounded-2xl border border-zinc-800 hover:border-amber-500/40 transition shadow-sm active:scale-95 group"
                title={`${currentUser.name} (${currentUser.role})`}
                aria-label="User Account Menu"
              >
                <div className="hidden sm:block text-left mr-0.5">
                  <div className="text-xs font-bold text-white truncate max-w-[95px] leading-tight">
                    {currentUser.name}
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 capitalize flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    {currentUser.role}
                  </span>
                </div>

                <div className="relative shrink-0">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-8 h-8 rounded-xl object-cover border border-amber-500/60 shadow-sm"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-900 shadow-sm" />
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 transition" />
              </button>
            ) : (
              <button
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 hover:text-amber-400 border border-zinc-800 hover:border-amber-500/50 transition text-xs font-semibold shadow-sm group active:scale-95"
                title="Account: Sign In or Create Account"
                aria-label="User Profile & Sign In Hub"
              >
                <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/30 group-hover:bg-amber-500/20 transition">
                  <UserCircle2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <span className="hidden sm:inline font-bold">Profile / Sign In</span>
                <ChevronDown className="w-3 h-3 text-zinc-400 group-hover:text-amber-400 transition" />
              </button>
            )}

            {/* Dropdown Menu when Signed In */}
            {isUserMenuOpen && currentUser && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-2 z-50 animate-fadeIn"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="px-3 py-2 border-b border-zinc-800/80 mb-1">
                  <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">{currentUser.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono uppercase font-bold">
                      {currentUser.role}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {currentUser.likedTrackIds.length} likes
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const targetArtist = (currentUser.artistId && artists.find(a => a.id === currentUser.artistId)) || artists[0];
                    if (targetArtist) {
                      setSelectedArtistModal(targetArtist);
                    }
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-800 hover:text-amber-400 transition text-left"
                >
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span>My Profile & Catalog</span>
                </button>

                <button
                  onClick={() => {
                    setIsArtistSubmitModalOpen(true);
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-800 hover:text-amber-400 transition text-left"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload & Share Music</span>
                </button>

                {currentUser.role === 'artist' && (
                  <button
                    onClick={() => {
                      const targetArtist = (currentUser.artistId && artists.find(a => a.id === currentUser.artistId)) || artists[0];
                      if (targetArtist) {
                        openAnalyticsModal(targetArtist);
                      }
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-800 hover:text-amber-400 transition text-left"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Studio Analytics</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onSelectTab('history');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:bg-zinc-800 hover:text-amber-400 transition text-left"
                >
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  <span>Exploration History</span>
                </button>

                {/* Legal and compliance links */}
                <div className="border-t border-zinc-800/80 my-1 pt-1">
                  <button
                    onClick={() => {
                      openLegalModal('terms');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition text-left"
                  >
                    <Scale className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Terms & Creator License</span>
                  </button>
                  <button
                    onClick={() => {
                      openLegalModal('privacy');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition text-left"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Privacy & Rights Policy</span>
                  </button>
                </div>

                <div className="border-t border-zinc-800/80 my-1 pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-950/40 transition text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}

            {/* Dropdown Menu when Signed Out */}
            {isUserMenuOpen && !currentUser && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-3 z-50 animate-fadeIn"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="px-2 py-1 mb-2 border-b border-zinc-800/80">
                  <p className="text-xs font-bold text-white font-heading">LOWERVIBE ACCOUNT</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Sign in or create your free account to upload music & albums</p>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      openAuthModal('login');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-95"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Sign In to Account</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      openAuthModal('register');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-white font-semibold text-xs border border-zinc-700 transition flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Create Free Account</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onOpenArtistGate?.();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium text-xs border border-amber-500/30 transition flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Upload & Share as Artist</span>
                  </button>

                </div>

                <div className="border-t border-zinc-800/80 mt-2 pt-2 text-[10px] text-zinc-500 space-y-1">
                  <p>100% Artist Retained Rights • No Ad Tracking</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openLegalModal('terms');
                      }}
                      className="text-zinc-400 hover:text-amber-400"
                    >
                      Terms
                    </button>
                    <span>•</span>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openLegalModal('privacy');
                      }}
                      className="text-zinc-400 hover:text-emerald-400"
                    >
                      Privacy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Links Row */}
      <div className="flex lg:hidden items-center justify-around pt-2.5 border-t border-zinc-800/60 mt-2">
        <button
          onClick={() => {
            onSelectTab('explore');
            onSelectCategory?.('all');
          }}
          className={`flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg ${
            currentTab === 'explore' && activeCategory === 'all' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>{t('explore', 'Explore')}</span>
        </button>

        <button
          onClick={() => handleCategoryNav('trending')}
          className={`flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg ${
            currentTab === 'explore' && activeCategory === 'trending' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('trending', 'Trending')}</span>
        </button>

        <button
          onClick={() => onSelectTab('artists')}
          className={`flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg ${
            currentTab === 'artists' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{t('artists', 'Artists')}</span>
        </button>

        <button
          onClick={() => onSelectTab('history')}
          className={`flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg ${
            currentTab === 'history' ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t('history', 'History')} ({playHistory.length})</span>
        </button>

        {(currentUser?.role === 'artist' ||
          currentUser?.applicationStatus === 'approved' ||
          currentUser?.role === 'admin') && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1 text-xs font-semibold py-1 px-2 rounded-lg text-amber-400 bg-amber-500/10"
            title="Install Artist App"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        )}
      </div>
    </header>
  );
};
