import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLogo } from '../contexts/LogoContext';
import type { LogoSize } from '../contexts/LogoContext';
import { supabase } from '../lib/supabase';

const LOGO_NAV_H: Record<LogoSize, string> = { sm: 'h-8', md: 'h-12', lg: 'h-16' };
const NAV_H: Record<LogoSize, string> = { sm: 'h-14', md: 'h-16', lg: 'h-20' };

interface NavbarProps {
  isAdmin?: boolean;
}

export default function Navbar({ isAdmin }: NavbarProps) {
  const { t, lang, setLang, isRTL } = useLanguage();
  const { logoUrl, logoSize } = useLogo();
  const navigate = useNavigate();

  const handleLogout = () => {
    supabase.auth.signOut();
    navigate('/admin/login');
  };

  return (
    <header style={{ backgroundColor: '#222d64' }} className="sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex items-center justify-between ${NAV_H[logoSize]} ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link to="/" className={`flex items-center gap-3 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="School Logo"
                className={`${LOGO_NAV_H[logoSize]} w-auto max-w-[160px] object-contain`}
                style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))' }}
              />
            ) : (
              <div className={`leading-tight ${isRTL ? 'text-right' : ''}`}>
                <div className="font-extrabold text-white text-base tracking-tight">{t('appName')}</div>
                <div className="text-xs hidden sm:block font-medium" style={{ color: '#6fceb5' }}>
                  {isRTL ? 'نظام النماذج الرقمية' : 'Digital Forms System'}
                </div>
              </div>
            )}
          </Link>

          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all border border-white/20 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <Globe className="w-4 h-4" />
              <span>{lang === 'en' ? 'العربية' : 'English'}</span>
            </button>

            {isAdmin ? (
              <>
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('dashboard')}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-red-300 hover:text-white hover:bg-red-500/30 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm hover:brightness-110 active:scale-95 ${isRTL ? 'flex-row-reverse' : ''}`}
                style={{ backgroundColor: '#6fceb5', color: '#222d64' }}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">{t('login')}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
