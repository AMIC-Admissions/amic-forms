import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle, Download, MessageCircle, Home, Copy, Check,
  User, GraduationCap, CreditCard, Calendar, FileText, Link2
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { downloadDataURL, buildWhatsAppLink, formatDate } from '../lib/utils';
import type { Submission } from '../types';
import Navbar from '../components/Navbar';

export default function SuccessPage() {
  const { refNum } = useParams<{ refNum: string }>();
  const { t, isRTL, lang } = useLanguage();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  useEffect(() => {
    if (!refNum) return;
    const local = localStorage.getItem(`amic_sub_${refNum}`);
    if (local) {
      try { setSubmission(JSON.parse(local)); } catch (_) { /* ignore */ }
    }
    supabase
      .from('submissions')
      .select('*')
      .eq('reference_number', refNum)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSubmission(data as Submission);
      });
  }, [refNum]);

  const handleDownload = async () => {
    setDownloadLoading(true);
    const pdfData =
      submission?.signed_pdf_data ||
      localStorage.getItem(`amic_pdf_${refNum}`);
    if (pdfData) {
      downloadDataURL(pdfData, `AMIC-Form-${refNum}.pdf`);
    } else {
      alert(isRTL
        ? 'ملف PDF غير متاح. يرجى التواصل مع الإدارة.'
        : 'Signed PDF is not available. Please contact the admin.');
    }
    setDownloadLoading(false);
  };

  const submissionUrl = `${window.location.origin}/success/${refNum}`;

  const handleWhatsApp = () => {
    const msg = isRTL
      ? `تم تقديم النموذج بنجاح.\nرقم المرجع: ${refNum}\nرابط الطلب: ${submissionUrl}`
      : `Form submitted successfully.\nReference: ${refNum}\nLink: ${submissionUrl}`;
    window.open(buildWhatsAppLink(msg), '_blank');
  };

  const copyRef = () => {
    if (refNum) {
      navigator.clipboard.writeText(refNum).then(() => {
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2500);
      });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(submissionUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const detailRows = submission ? [
    submission.form_data?.parentName && { icon: User, label: t('parentName'), value: submission.form_data.parentName },
    submission.form_data?.studentName && { icon: GraduationCap, label: t('studentName'), value: submission.form_data.studentName },
    submission.form_data?.idNumber && { icon: CreditCard, label: t('idNumber'), value: submission.form_data.idNumber },
    submission.form_data?.date && { icon: Calendar, label: t('date'), value: submission.form_data.date },
    submission.template_name && { icon: FileText, label: isRTL ? 'اسم النموذج' : 'Form Name', value: submission.template_name },
    { icon: Calendar, label: t('submittedAt'), value: formatDate(submission.created_at, lang) },
  ].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-[#eeeeed]" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <div className="text-center mb-8">
          <div className="relative inline-flex mb-6">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center ring-8 ring-green-50">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <div
              className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: '#222d64' }}
            >
              <Check className="w-4 h-4 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold mb-3" style={{ color: '#222d64' }}>
            {t('successTitle')}
          </h1>
          <p className="text-gray-500 text-base max-w-sm mx-auto leading-relaxed">
            {t('successMessage')}
          </p>
        </div>

        <div className="bg-white rounded-2xl border-2 shadow-sm p-6 mb-5" style={{ borderColor: '#222d6420' }}>
          <p className={`text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ${isRTL ? 'text-right' : ''}`}>
            {t('referenceNumber')}
          </p>
          <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex-1 rounded-xl px-5 py-4 border" style={{ backgroundColor: '#222d640a', borderColor: '#222d6020' }}>
              <span className="font-mono font-black text-2xl tracking-widest" style={{ color: '#222d64' }}>
                {refNum}
              </span>
            </div>
            <button
              onClick={copyRef}
              className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                copiedRef
                  ? 'border-green-300 bg-green-50 text-green-600'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600'
              }`}
              title={isRTL ? 'نسخ رقم المرجع' : 'Copy reference number'}
            >
              {copiedRef ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          <button
            onClick={copyLink}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${
              copiedLink
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'
            } ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {copiedLink ? <Check className="w-4 h-4 flex-shrink-0" /> : <Link2 className="w-4 h-4 flex-shrink-0" />}
            <span className="flex-1 truncate text-xs" dir="ltr">{submissionUrl}</span>
            <span className="text-xs font-semibold flex-shrink-0">
              {copiedLink
                ? (isRTL ? 'تم النسخ' : 'Copied!')
                : (isRTL ? 'نسخ الرابط' : 'Copy Link')}
            </span>
          </button>

          <p className={`text-xs text-gray-400 mt-2 leading-relaxed ${isRTL ? 'text-right' : ''}`}>
            {isRTL
              ? 'احتفظ بهذا الرقم والرابط للرجوع إليهما لاحقاً'
              : 'Keep this reference number and link for your records'}
          </p>
        </div>

        {detailRows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
            <h3
              className={`font-bold text-sm mb-4 ${isRTL ? 'text-right' : ''}`}
              style={{ color: '#222d64' }}
            >
              {isRTL ? 'تفاصيل الإرسال' : 'Submission Details'}
            </h3>
            <div className="space-y-3">
              {(detailRows as Array<{ icon: React.ElementType; label: string; value: string }>).map((row, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#222d6410' }}
                  >
                    <row.icon className="w-4 h-4" style={{ color: '#222d64' }} />
                  </div>
                  <span className="text-gray-500 text-sm flex-1">{row.label}</span>
                  <span className="font-semibold text-gray-900 text-sm">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleDownload}
            disabled={downloadLoading}
            className={`w-full flex items-center justify-center gap-3 font-bold py-4 px-6 rounded-xl transition-all shadow-sm hover:shadow-md hover:brightness-110 disabled:opacity-60 text-base text-white ${isRTL ? 'flex-row-reverse' : ''}`}
            style={{ backgroundColor: '#222d64' }}
          >
            {downloadLoading
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Download className="w-5 h-5 flex-shrink-0" />}
            {t('downloadPDF')}
          </button>

          <button
            onClick={handleWhatsApp}
            className={`w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-sm hover:shadow-md text-base ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <MessageCircle className="w-5 h-5 flex-shrink-0" />
            {t('shareWhatsApp')}
          </button>

          <Link
            to="/"
            className={`w-full flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 font-semibold py-3 rounded-xl hover:bg-white transition-all text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <Home className="w-4 h-4" />
            {t('backHome')}
          </Link>
        </div>

        <div className="mt-8 rounded-2xl p-5 border" style={{ backgroundColor: '#222d640a', borderColor: '#222d6020' }}>
          <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: '#222d6415' }}
            >
              <CheckCircle className="w-4 h-4" style={{ color: '#222d64' }} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#222d64' }}>
                {isRTL ? 'ما الذي يحدث بعد ذلك؟' : 'What happens next?'}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {isRTL
                  ? 'ستتلقى تأكيداً من الإدارة. يمكنك تحميل نسخة PDF الموقعة للاحتفاظ بها.'
                  : 'The school administration will review your submission. Keep your signed PDF for your records.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
