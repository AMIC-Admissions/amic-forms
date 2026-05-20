import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type LogoSize = 'sm' | 'md' | 'lg';

interface LogoContextValue {
  logoUrl: string | null;
  bgImageUrl: string | null;
  logoSize: LogoSize;
  refreshLogo: () => void;
}

const LogoContext = createContext<LogoContextValue>({
  logoUrl: null,
  bgImageUrl: null,
  logoSize: 'md',
  refreshLogo: () => {},
});

export function LogoProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('amic_logo') || null;
  });
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(() => {
    return localStorage.getItem('amic_bg_image') || null;
  });
  const [logoSize, setLogoSize] = useState<LogoSize>(() => {
    return (localStorage.getItem('amic_logo_size') as LogoSize) || 'md';
  });

  const refreshLogo = useCallback(() => {
    supabase
      .from('school_settings')
      .select('key, value')
      .in('key', ['school_logo', 'hero_bg_image', 'logo_size'])
      .then(({ data }) => {
        if (!data) return;
        const keys = data.map(r => r.key);

        data.forEach((row: { key: string; value: string }) => {
          if (row.key === 'school_logo') {
            if (row.value) {
              setLogoUrl(row.value);
              localStorage.setItem('amic_logo', row.value);
            } else {
              setLogoUrl(null);
              localStorage.removeItem('amic_logo');
            }
          }
          if (row.key === 'hero_bg_image') {
            if (row.value) {
              setBgImageUrl(row.value);
              localStorage.setItem('amic_bg_image', row.value);
            } else {
              setBgImageUrl(null);
              localStorage.removeItem('amic_bg_image');
            }
          }
          if (row.key === 'logo_size') {
            const size = (row.value as LogoSize) || 'md';
            setLogoSize(size);
            localStorage.setItem('amic_logo_size', size);
          }
        });

        if (!keys.includes('school_logo')) {
          setLogoUrl(null);
          localStorage.removeItem('amic_logo');
        }
        if (!keys.includes('hero_bg_image')) {
          setBgImageUrl(null);
          localStorage.removeItem('amic_bg_image');
        }
      });
  }, []);

  useEffect(() => {
    refreshLogo();
  }, [refreshLogo]);

  return (
    <LogoContext.Provider value={{ logoUrl, bgImageUrl, logoSize, refreshLogo }}>
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  return useContext(LogoContext);
}
