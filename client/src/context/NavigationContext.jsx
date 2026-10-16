import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [searchParams, setSearchParams] = useState(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  );

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to, options = {}) => {
    let path = to;
    let search = '';
    if (to.includes('?')) {
      const parts = to.split('?');
      path = parts[0];
      search = '?' + parts[1];
    }

    if (options.replace) {
      window.history.replaceState({}, '', path + search);
    } else {
      window.history.pushState({}, '', path + search);
    }

    setCurrentPath(path);
    setSearchParams(new URLSearchParams(search));
    window.scrollTo(0, 0);
  }, []);

  return (
    <NavigationContext.Provider value={{ currentPath, searchParams, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
