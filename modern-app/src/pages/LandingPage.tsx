import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Shield, Zap, Globe as Globe2, ArrowRight, CheckCircle, Clock, GitBranch } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLogo } from '../contexts/LogoContext';
import type { LogoSize } from '../contexts/LogoContext';
import { supabase } from '../lib/supabase';
import type { FormTemplate } from '../types';
import Navbar from '../components/Navbar';

const LOGO_HERO_H: Record<LogoSize, string> = { sm: 'h-12', md: 'h-20', lg: 'h-28' };

export default function LandingPage() {
  const { t, isRTL } = useLanguage();
  const { logoUrl, bgImageUrl, logoSize } = useLogo();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('form_templates')
      .select('id, name, name_ar, pdf_filename, is_active, created_at, fields')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates((data as FormTemplate[]) || []);
        setLoading(false);
      });
  }, []);

  const features = [
    {
      icon: FileText,
      title: isRTL ? 'رفع أي نموذج PDF' : 'Upload Any PDF Form',
      desc: isRTL ? 'ارفع أي نموذج مدرسي وأضف الحقول في مكانها الصحيح' : 'Upload any school form PDF and position fields precisely where needed',
      accent: '#222d64',
    },
    {
      icon: Shield,
      title: isRTL ? 'توقيع رقمي آمن' : 'Secure Digital Signature',
      desc: isRTL ? 'ارسم توقيعك الإلكتروني وتلقَّ رقم مرجعي فوراً' : 'Draw your signature and receive an instant reference number',
      accent: '#347cbb',
    },
    {
      icon: Zap,
      title: isRTL ? 'تحميل فوري' : 'Instant Download',
      desc: isRTL ? 'حمّل نسخة PDF موقعة فور إكمال النموذج' : 'Download your completed, signed PDF immediately after submission',
      accent: '#6fceb5',
    },
    {
      icon: Globe2,
      title: isRTL ? 'عربي وإنجليزي' : 'Arabic & English',
      desc: isRTL ? 'دعم كامل للغتين مع تخطيط RTL صحيح' : 'Full bilingual support with proper right-to-left layout',
      accent: '#222d64',
    },
    {
      icon: GitBranch,
      title: isRTL ? 'منطق شرطي' : 'Conditional Logic',
      desc: isRTL ? 'إظهار وإخفاء الحقول بناءً على إجابات المستخدم' : 'Show or hide fields dynamically based on user responses',
      accent: '#347cbb',
    },
    {
      icon: CheckCircle,
      title: isRTL ? 'مزامنة Excel' : 'Excel Integration',
      desc: isRTL ? 'إرسال بيانات الطلب مباشرة إلى Excel Online تلقائياً' : 'Auto-send submission data to Excel Online via Power Automate',
      accent: '#6fceb5',
    },
  ];

  return (
    <div className="min-h-screen bg-[#eeeeed]" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <section
        className="relative overflow-hidden"
        style={bgImageUrl ? {
          backgroundImage: `url(${bgImageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        } : {
          background: 'linear-gradient(135deg, #222d64 0%, #1a2350 60%, #11183c 100%)',
        }}
      >
        {bgImageUrl ? (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" />
        ) : (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: '#6fceb5' }} />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: '#347cbb' }} />
          </div>
        )}

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 flex flex-col items-center text-center">
          {logoUrl && (
            <div className="mb-10">
              <img
                src={logoUrl}
                alt="School Logo"
                className={`${LOGO_HERO_H[logoSize]} w-auto object-contain mx-auto`}
                style={{ filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.5))' }}
              />
            </div>
          )}
          <div className={`max-w-3xl w-full ${isRTL ? 'text-right' : ''}`}>
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold mb-8 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ backgroundColor: '#6fceb5', color: '#222d64' }}>
              <FileText className="w-3.5 h-3.5" />
              <span>{isRTL ? 'نظام النماذج الرقمية المدرسية' : 'School Digital Forms System'}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6">
              {isRTL ? (
                <>نماذج مدرسية <span style={{ color: '#6fceb5' }}>ذكية</span></>
              ) : (
                <>Smart School <span style={{ color: '#6fceb5' }}>Forms</span></>
              )}
            </h1>
            <p className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {t('heroSubtitle')}
            </p>
            <div className={`flex flex-wrap gap-4 ${isRTL ? 'justify-end' : 'justify-center'}`}>
              <a
                href="#forms"
                className={`inline-flex items-center gap-2.5 font-bold px-7 py-3.5 rounded-xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 text-base ${isRTL ? 'flex-row-reverse' : ''}`}
                style={{ backgroundColor: '#6fceb5', color: '#222d64' }}
              >
                {t('startFilling')}
                <ArrowRight className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
              </a>
              <Link
                to="/admin/login"
                className="inline-flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-7 py-3.5 rounded-xl transition-all backdrop-blur-sm text-base"
              >
                {t('adminAccess')}
              </Link>
            </div>

            <div className={`flex flex-wrap gap-6 mt-12 ${isRTL ? 'justify-end' : 'justify-center'}`}>
              {[
                isRTL ? 'آمن 100%' : '100% Secure',
                isRTL ? 'سهل الاستخدام' : 'Easy to Use',
                isRTL ? 'يعمل على جميع الأجهزة' : 'Works on All Devices',
              ].map(label => (
                <div key={label} className={`flex items-center gap-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`} style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#6fceb5' }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold mb-2" style={{ color: '#222d64' }}>
              {isRTL ? 'لماذا AMIC Forms؟' : 'Why AMIC Forms?'}
            </h2>
            <p className="text-gray-500 text-sm">
              {isRTL ? 'كل ما تحتاجه لإدارة نماذج مدرستك رقمياً' : 'Everything you need to manage school forms digitally'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-[#eeeeed] rounded-2xl p-6 border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-sm" style={{ backgroundColor: f.accent }}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className={`font-bold text-sm mb-2 ${isRTL ? 'text-right' : ''}`} style={{ color: '#222d64' }}>{f.title}</h3>
                <p className={`text-xs text-gray-500 leading-relaxed ${isRTL ? 'text-right' : ''}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="forms" className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mb-12 ${isRTL ? 'text-right' : ''}`}>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4" style={{ backgroundColor: '#222d64', color: '#6fceb5' }}>
            <FileText className="w-3.5 h-3.5" />
            {isRTL ? 'النماذج المتاحة' : 'Available Forms'}
          </div>
          <h2 className="text-3xl font-extrabold mb-3" style={{ color: '#222d64' }}>{t('formTemplates')}</h2>
          <p className="text-gray-500">
            {isRTL ? 'اختر النموذج الذي تريد ملؤه وتوقيعه رقمياً' : 'Select a form to fill out and sign digitally'}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 rounded-2xl h-40 animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#eeeeed' }}>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-semibold mb-1">
              {isRTL ? 'لا توجد نماذج متاحة حالياً' : 'No forms available yet'}
            </p>
            <p className="text-gray-400 text-sm">
              {isRTL ? 'تواصل مع الإدارة للحصول على رابط النموذج' : 'Contact the admin to receive a form link'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map(template => (
              <Link
                key={template.id}
                to={`/form/${template.id}`}
                className="group bg-white rounded-2xl border-2 border-gray-200 hover:shadow-xl transition-all p-6 flex flex-col gap-5"
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#347cbb')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              >
                <div className={`flex items-start gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#222d6412' }}>
                    <FileText className="w-6 h-6" style={{ color: '#222d64' }} />
                  </div>
                  <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                    <h3 className="font-bold text-gray-900 leading-tight mb-1 transition-colors" style={{ color: '#333333' }}>
                      {isRTL ? (template.name_ar || template.name) : template.name}
                    </h3>
                    <p className="text-xs text-gray-400 truncate">{template.pdf_filename}</p>
                  </div>
                </div>

                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center gap-1.5 text-sm font-bold transition-all group-hover:gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ color: '#347cbb' }}>
                    <span>{t('startFilling')}</span>
                    <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs text-gray-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Clock className="w-3 h-3" />
                    <span>{isRTL ? 'دقيقة واحدة' : '1 min'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer style={{ backgroundColor: '#222d64' }} className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-7 w-auto object-contain max-w-[100px]" style={{ filter: 'brightness(0) invert(1)' }} />
            ) : (
              <span className="font-bold text-white">{t('appName')}</span>
            )}
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)' }}>
            © {new Date().getFullYear()} {isRTL ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
