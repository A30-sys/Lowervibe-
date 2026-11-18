import React, { createContext, useContext, useEffect, useState } from 'react';

export type Language = 'en' | 'ny';

export interface LanguageOption {
  code: Language;
  label: string;
  native: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ny', label: 'Chichewa', native: 'Chichewa' },
];

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // Core Navigation
    home: 'Home',
    search: 'Search',
    library: 'Library',
    upload: 'Upload',
    profile: 'Profile',
    explore: 'Home',
    trending: 'Trending',
    new_albums: 'New Releases',
    artists: 'Artists',
    history: 'History',
    playlists: 'Playlists',
    share_as_artist: 'Upload Music',
    search_placeholder: 'Search songs, artists, or playlists...',
    install_app: 'Install App',

    // Home & Discovery
    continue_listening: 'Continue listening',
    featured_releases: 'New Releases',
    all_vibes: 'All Songs',
    vibe_frequencies: 'Browse by Genre',
    vibe_subheading: 'Explore sounds across Malawi, Nigeria, and Africa',
    submit_as_artist: 'Become an Artist',

    // Player
    now_playing: 'Now Playing',
    play: 'Play',
    pause: 'Pause',
    shuffle: 'Shuffle',
    sleep_timer: 'Sleep Timer',

    // Settings & Profile
    settings: 'Settings',
    appearance: 'Appearance',
    language: 'Language',
    playback: 'Playback',
    data_storage: 'Data & Storage',
    notifications: 'Notifications',
    privacy: 'Privacy',
    creator: 'Creator',
    support_about: 'Support & About',
    sign_out: 'Sign out',
    saved: 'Saved',

    // Install prompt
    install_headline: 'Install LOWERVIBE on your device',
    install_body: 'Get faster access, smooth background playback, and offline listening.',
    install_button: 'Install app',
    maybe_later: 'Not now',
  },
  ny: {
    // Core Navigation (Chichewa)
    home: 'Kunyumba',
    search: 'Sakani',
    library: 'Laibulale',
    upload: 'Kwezani',
    profile: 'Mbiri Yanga',
    explore: 'Kunyumba',
    trending: 'Zotchuka',
    new_albums: 'Zatsopano',
    artists: 'Oimba',
    history: 'Mbiri Yakale',
    playlists: 'Mindandanda',
    share_as_artist: 'Kwezani Nyimbo',
    search_placeholder: 'Sakani nyimbo, oimba, kapena mindandanda...',
    install_app: 'Ikani Pulogalamu',

    // Home & Discovery
    continue_listening: 'Pitirizani kumvera',
    featured_releases: 'Nyimbo Zatsopano',
    all_vibes: 'Nyimbo Zonse',
    vibe_frequencies: 'Sankhani Mtundu wa Nyimbo',
    vibe_subheading: 'Pezani nyimbo za ku Malawi, Nigeria ndi Africa yonse',
    submit_as_artist: 'Khalani Woimba',

    // Player
    now_playing: 'Ikulira Tsopano',
    play: 'Liza',
    pause: 'Imitsani',
    shuffle: 'Sakanizani',
    sleep_timer: 'Nthawi Yoimitsa',

    // Settings & Profile
    settings: 'Zokonda',
    appearance: 'Maonekedwe',
    language: 'Chilankhulo',
    playback: 'Malizidwe',
    data_storage: 'Deta & Malo Osungira',
    notifications: 'Zidziwitso',
    privacy: 'Chinsinsi',
    creator: 'Woimba',
    support_about: 'Thandizo & Zambiri',
    sign_out: 'Tulukani',
    saved: 'Zasungidwa',

    // Install prompt
    install_headline: 'Ikani LOWERVIBE pa foni yanu',
    install_body: 'Mverani nyimbo mosavuta komanso popanda intaneti mukasunga nyimbo.',
    install_button: 'Ikani tsopano',
    maybe_later: 'Pambuyo pake',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  currentLanguage: LanguageOption;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const LANG_STORAGE_KEY = 'lowervibe_preferred_lang_v2';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'ny') return saved;
    } catch {}
    return 'en';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language === 'ny' ? 'ny' : 'en';
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {}
  };

  const t = (key: string, fallback?: string): string => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS.en[key] || fallback || key;
  };

  const currentLanguage = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        currentLanguage,
        availableLanguages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: 'en' as Language,
      setLanguage: () => {},
      t: (key: string, fallback?: string) => TRANSLATIONS.en[key] || fallback || key,
      currentLanguage: LANGUAGES[0],
      availableLanguages: LANGUAGES,
    };
  }
  return context;
};
