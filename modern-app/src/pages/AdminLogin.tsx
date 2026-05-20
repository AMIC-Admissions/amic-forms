import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Globe, ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLogo } from '../contexts/LogoContext';
import { supabase } from '../lib/supabase';
import { ensureUserRole } from '../lib/auth';

export default function AdminLogin() {
  const { t, lang, setLang, isRTL } = useLanguage();
  const { logoUrl } = useLogo();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@amic.school',
      password,
    });
    if (authError) {
      setError(t('invalidPassword'));
    } else {
      if (data.user) await ensureUserRole(data.user.id, 'staff');
      navigate('/admin');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" dir={isRTL ? 'rtl' : 'ltr'}>
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 text-white"
        style={{ background: 'linear-gradient(135deg, #222d64 0%, #1a2350 60%, #11183c 100%)' }}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: '#6fceb5' }} />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: '#347cbb' }} />
        </div>

        <div className="relative z-10 max-w-sm text-center">
          <div className="mb-8">
            {logoUrl ? (
              <div className="bg-white rounded-2xl p-4 inline-block shadow-xl mb-2">
                <img
                  src={logoUrl}
                  alt="School Logo"
                  className="h-16 w-auto object-contain max-w-[160px]"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xl border border-white/20" style={{ backgroundColor: 'rgba(111,206,181,0.15)' }}>
                <FileText className="w-10 h-10" style={{ color: '#6fceb5' }} />
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold mb-5" style={{ backgroundColor: '#6fceb5', color: '#222d64' }}>
            <span>{isRTL ? 'لوحة التحكم الإدارية' : 'Admin Control Panel'}</span>
          </div>

          <h2 className="text-3xl font-extrabold mb-3 text-white">{t('appName')}</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-10">{t('appTagline')}</p>

          <div className="space-y-3 text-start">
            {[
              isRTL ? 'إدارة نماذج PDF المدرسية' : 'Manage school PDF forms',
              isRTL ? 'عرض وتحميل الطلبات' : 'View and download submissions',
              isRTL ? 'إنشاء قوالب قابلة للمشاركة' : 'Create shareable form templates',
            ].map(item => (
              <div key={item} className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#6fceb5' }} />
                <span className="text-white/80 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex flex-col bg-[#eeeeed]">
        <div className={`flex items-center justify-between p-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link
            to="/"
            className={`flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors text-sm font-medium ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
            {isRTL ? 'الرئيسية' : 'Home'}
          </Link>
          <button
            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-white transition-colors border border-gray-300 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Globe className="w-4 h-4" />
            <span>{lang === 'en' ? 'العربية' : 'English'}</span>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-8">
          <div className="w-full max-w-sm">
            <div className={`mb-8 ${isRTL ? 'text-right' : ''}`}>
              {logoUrl ? (
                <div className="lg:hidden mb-6 flex items-center gap-3">
                  <img
                    src={logoUrl}
                    alt="School Logo"
                    className="h-12 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 shadow-md lg:hidden" style={{ backgroundColor: '#222d64' }}>
                  <Lock className="w-6 h-6 text-white" />
                </div>
              )}
              <h1 className="text-2xl font-extrabold mb-2" style={{ color: '#222d64' }}>{t('login')}</h1>
              <p className="text-gray-500 text-sm">
                {isRTL ? 'أدخل كلمة مرور المشرف للدخول' : 'Enter your admin password to continue'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className={`block text-sm font-semibold mb-2 ${isRTL ? 'text-right' : ''}`} style={{ color: '#222d64' }}>
                  {t('password')}
                </label>
                <div className="relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'}`}>
                    <Lock className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder={t('adminPasswordHint')}
                    className={`w-full bg-white border-2 rounded-xl py-3 text-gray-900 focus:outline-none transition-all ${
                      error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#222d64]'
                    } ${isRTL ? 'pe-10 ps-4 text-right' : 'ps-10 pe-10'}`}
                    dir="ltr"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors ${isRTL ? 'left-3.5' : 'right-3.5'}`}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {error && (
                  <p className={`text-red-500 text-sm mt-2 font-medium ${isRTL ? 'text-right' : ''}`}>{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full font-bold py-3.5 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-white disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110"
                style={{ backgroundColor: '#222d64' }}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : t('loginBtn')}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-8 text-center leading-relaxed">
              {isRTL
                ? 'حساب المشرف: admin@amic.school — يُنصح بتغيير كلمة المرور في الإنتاج'
                : 'Admin account: admin@amic.school — Change the password in production'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
