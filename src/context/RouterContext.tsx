import React, { createContext, useContext, useEffect, useState } from 'react';

export interface RouteMatch {
  route:
    | 'home'
    | 'discover'
    | 'artists'
    | 'artist_detail'
    | 'track_detail'
    | 'library'
    | 'studio'
    | 'admin'
    | 'admin_login'
    | 'admin_dashboard'
    | 'admin_access_denied'
    | 'login'
    | 'register'
    | 'forgot_password'
    | 'account'
    | 'search'
    | 'terms'
    | 'privacy'
    | 'copyright'
    | 'not_found'
    | 'server_error';
  params: Record<string, string>;
  pathname: string;
  searchQuery: string;
  hash: string;
}

interface RouterContextType {
  path: string;
  pathname: string;
  search: string;
  hash: string;
  searchParams: URLSearchParams;
  currentRoute: RouteMatch;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  goBack: () => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function parseRoute(pathname: string, search: string, hash: string = ''): RouteMatch {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const searchParams = new URLSearchParams(search);
  const searchQuery = searchParams.get('q') || '';

  // Legal Fullscreen Routes
  if (cleanPath === '/terms') {
    return { route: 'terms', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/privacy') {
    return { route: 'privacy', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/copyright') {
    return { route: 'copyright', params: {}, pathname: cleanPath, searchQuery, hash };
  }

  // Public & Listener Auth Routes
  if (cleanPath === '/login') {
    return { route: 'login', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/register') {
    return { route: 'register', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/forgot-password') {
    return { route: 'forgot_password', params: {}, pathname: cleanPath, searchQuery, hash };
  }

  // Dedicated Standalone Administration Page Routes (/administration) & /admin aliases
  if (cleanPath === '/administration/login' || cleanPath === '/admin/login') {
    return { route: 'admin_login', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/administration/access-denied' || cleanPath === '/admin/access-denied') {
    return { route: 'admin_access_denied', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (
    cleanPath === '/administration' ||
    cleanPath === '/administration/dashboard' ||
    cleanPath === '/admin' ||
    cleanPath === '/admin/dashboard'
  ) {
    return { route: 'admin_dashboard', params: {}, pathname: cleanPath, searchQuery, hash };
  }

  // Core Platform Navigation
  if (cleanPath === '/' || cleanPath === '') {
    return { route: 'home', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/discover') {
    return { route: 'discover', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/artists') {
    return { route: 'artists', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath.startsWith('/artists/')) {
    const slug = cleanPath.replace('/artists/', '');
    return { route: 'artist_detail', params: { slug }, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath.startsWith('/tracks/')) {
    const id = cleanPath.replace('/tracks/', '');
    return { route: 'track_detail', params: { id }, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/library') {
    return { route: 'library', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/studio') {
    return { route: 'studio', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/account') {
    return { route: 'account', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/search') {
    return { route: 'search', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/500') {
    return { route: 'server_error', params: {}, pathname: cleanPath, searchQuery, hash };
  }
  if (cleanPath === '/404') {
    return { route: 'not_found', params: {}, pathname: cleanPath, searchQuery, hash };
  }

  return { route: 'not_found', params: {}, pathname: cleanPath, searchQuery, hash };
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUrl, setCurrentUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return {
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
        hash: window.location.hash || '',
      };
    }
    return { pathname: '/', search: '', hash: '' };
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentUrl({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
        hash: window.location.hash || '',
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    const url = new URL(to, window.location.origin);
    const targetPath = url.pathname;
    const targetSearch = url.search;
    const targetHash = url.hash;

    if (options?.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }

    setCurrentUrl({ pathname: targetPath, search: targetSearch, hash: targetHash });
    if (!targetHash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  const goBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate('/');
      }
    }
  };

  const currentRoute = parseRoute(currentUrl.pathname, currentUrl.search, currentUrl.hash);
  const searchParams = new URLSearchParams(currentUrl.search);
  const fullPath = currentUrl.pathname + currentUrl.search + currentUrl.hash;

  return (
    <RouterContext.Provider
      value={{
        path: fullPath,
        pathname: currentUrl.pathname,
        search: currentUrl.search,
        hash: currentUrl.hash,
        searchParams,
        currentRoute,
        navigate,
        goBack,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
