import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Download, FileText, User, GraduationCap, CreditCard,
  Calendar, Paperclip, PenLine, CheckCircle, Clock,
  TableProperties, Eye, X, MessageCircle, Link2, Check, ChevronDown,
  AlertCircle, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate, downloadFromUrl, buildWhatsAppLink } from '../lib/utils';
import { useLanguage } from '../contexts/LanguageContext';
import type { Submission, WorkflowStepState } from '../types';

export default function SubmissionDetail() {
  const { refNum } = useParams<{ refNum: string }>();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<{ name: string; data: string; type: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState(false);

  useEffect(() => {
    if (!refNum) return;
    supabase
      .from('submissions')
      .select('*')
      .eq('reference_number', refNum)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        else setSubmission(data as Submission);
        setLoading(false);
      });
  }, [refNum]);

  const handleDownloadPDF = async () => {
    if (!submission) return;
    const url = submission.signed_pdf_data || localStorage.getItem(`amic_pdf_${submission.reference_number}`);
    if (url) {
      await downloadFromUrl(url, `AMIC-Form-${submission.reference_number}.pdf`);
    } else {
      alert(isRTL
        ? 'ملف PDF غير متاح لهذا الطلب.'
        : 'No signed PDF available for this submission.');
    }
  };

  const submissionUrl = `${window.location.origin}/success/${refNum}`;

  const handleWhatsApp = () => {
    if (!submission) return;
    const msg = isRTL
      ? `تفاصيل طلب ${submission.reference_number}\nالنموذج: ${submission.template_name}\nرابط الطلب: ${submissionUrl}`
      : `Submission ${submission.reference_number}\nForm: ${submission.template_name}\nLink: ${submissionUrl}`;
    window.open(buildWhatsAppLink(msg), '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(submissionUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!submission || newStatus === submission.status) return;
    setStatusUpdating(true);
    const { error } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
        audit_log: [
          ...((submission as any).audit_log || []),
          { event: `status_changed_to_${newStatus}`, at: new Date().toISOString() },
        ],
      })
      .eq('id', submission.id);
    if (!error) {
      setSubmission(prev => prev ? { ...prev, status: newStatus } : prev);
      setStatusSuccess(true);
      setTimeout(() => setStatusSuccess(false), 2000);
    }
    setStatusUpdating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeeed] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (notFound || !submission) {
    return (
      <div className="min-h-screen bg-[#eeeeed] flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
          <FileText className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {isRTL ? 'الطلب غير موجود' : 'Submission Not Found'}
        </h2>
        <button onClick={() => navigate('/admin')} className="text-sm font-semibold hover:underline" style={{ color: '#222d64' }}>
          {isRTL ? 'العودة للوحة التحكم' : 'Back to Dashboard'}
        </button>
      </div>
    );
  }

  const fieldEntries = Object.entries(submission.form_data || {}).filter(
    ([key]) => !['parentName', 'studentName', 'idNumber'].includes(key)
  );

  return (
    <div className="min-h-screen bg-[#eeeeed]" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
          >
            <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-sm" style={{ color: '#222d64' }}>
              {isRTL ? 'تفاصيل الطلب' : 'Submission Details'}
            </h1>
          </div>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border transition-all ${
                copiedLink
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title={isRTL ? 'نسخ الرابط' : 'Copy link'}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{copiedLink ? (isRTL ? 'تم' : 'Copied') : (isRTL ? 'نسخ الرابط' : 'Copy Link')}</span>
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-xl transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 text-sm font-semibold text-white px-4 py-2 rounded-xl transition-colors shadow-sm hover:brightness-110"
              style={{ backgroundColor: '#222d64' }}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{isRTL ? 'تحميل PDF' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className={`flex items-start justify-between gap-4 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <div className={`flex items-center gap-3 mb-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span
                  className="font-mono font-bold text-lg px-3 py-1.5 rounded-xl tracking-wider border"
                  style={{ color: '#222d64', backgroundColor: '#222d640a', borderColor: '#222d6020' }}
                >
                  {submission.reference_number}
                </span>
                {submission.excel_synced && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <TableProperties className="w-3 h-3" />
                    Excel Synced
                  </span>
                )}
                {statusSuccess && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1 animate-pulse">
                    <Check className="w-3 h-3" />
                    {isRTL ? 'تم التحديث' : 'Updated'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{submission.template_name}</p>
              <p className={`text-xs text-gray-400 mt-1 flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-3.5 h-3.5" />
                {formatDate(submission.created_at, isRTL ? 'ar' : 'en')}
              </p>
            </div>

            {/* Status dropdown */}
            <div className={`flex flex-col gap-1 ${isRTL ? 'items-end' : ''}`}>
              <p className="text-xs text-gray-400 font-medium">{isRTL ? 'الحالة' : 'Status'}</p>
              <div className="relative">
                <select
                  value={submission.status}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={statusUpdating}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  className={`appearance-none text-sm font-bold px-3 py-2 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 transition-all disabled:opacity-60 ${
                    submission.status === 'completed'
                      ? 'bg-green-50 text-green-700 border-green-200 focus:ring-green-300'
                      : submission.status === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-300'
                      : submission.status === 'rejected'
                      ? 'bg-red-50 text-red-700 border-red-200 focus:ring-red-300'
                      : 'bg-gray-100 text-gray-600 border-gray-200 focus:ring-gray-300'
                  } ${isRTL ? 'pl-8 pr-3' : 'pr-8 pl-3'}`}
                >
                  <option value="pending">{isRTL ? 'قيد الانتظار' : 'Pending'}</option>
                  <option value="completed">{isRTL ? 'مكتمل' : 'Completed'}</option>
                  <option value="rejected">{isRTL ? 'مرفوض' : 'Rejected'}</option>
                  <option value="under_review">{isRTL ? 'قيد المراجعة' : 'Under Review'}</option>
                </select>
                <ChevronDown className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-60 ${isRTL ? 'left-2' : 'right-2'} ${
                  submission.status === 'completed' ? 'text-green-700' : submission.status === 'pending' ? 'text-amber-700' : 'text-gray-500'
                }`} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: User, label: isRTL ? 'اسم ولي الأمر' : 'Parent Name', value: submission.form_data?.parentName },
            { icon: GraduationCap, label: isRTL ? 'اسم الطالب' : 'Student Name', value: submission.form_data?.studentName },
            { icon: CreditCard, label: isRTL ? 'رقم الهوية' : 'ID Number', value: submission.form_data?.idNumber },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#222d6410' }}>
                <Icon className="w-5 h-5" style={{ color: '#222d64' }} />
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="font-bold text-gray-900 text-sm">{value || <span className="text-gray-300 font-normal">—</span>}</p>
            </div>
          ))}
        </div>

        {/* Workflow signing progress */}
        {submission.workflow_state && submission.workflow_state.length > 0 && (
          <WorkflowProgress steps={submission.workflow_state} isRTL={isRTL} />
        )}

        {fieldEntries.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#222d640a' }}>
              <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
                {isRTL ? 'بيانات النموذج' : 'Form Data'}
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {fieldEntries.map(([key, value]) => (
                <div key={key} className={`flex items-start gap-4 px-6 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-40 flex-shrink-0 pt-0.5">
                    {key}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 break-words">
                    {value === 'true' ? (
                      <span className={`flex items-center gap-1 text-green-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <CheckCircle className="w-3.5 h-3.5" /> {isRTL ? 'نعم' : 'Yes'}
                      </span>
                    ) : value === 'false' ? (
                      <span className="text-gray-400">{isRTL ? 'لا' : 'No'}</span>
                    ) : value || <span className="text-gray-300">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {submission.signature_data && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <PenLine className="w-4 h-4" style={{ color: '#222d64' }} />
              <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
                {isRTL ? 'التوقيع' : 'Signature'}
              </h2>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 inline-block">
              <img src={submission.signature_data} alt="Signature" className="h-20 object-contain" />
            </div>
          </div>
        )}

        {submission.attachments && submission.attachments.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ backgroundColor: '#222d640a' }}>
              <Paperclip className="w-4 h-4" style={{ color: '#222d64' }} />
              <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
                {isRTL ? `المرفقات (${submission.attachments.length})` : `Attachments (${submission.attachments.length})`}
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {submission.attachments.map((att, i) => {
                const isImage = att.type.startsWith('image/');
                const isPDF = att.type === 'application/pdf';
                // Support both Storage URL (new) and base64 data (legacy)
                const src = att.url || att.data || null;
                return (
                  <div key={i} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 group">
                    {isImage && src ? (
                      <div className="h-32 bg-white overflow-hidden">
                        <img src={src} alt={att.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-20 bg-gray-100 flex items-center justify-center">
                        <FileText className={`w-8 h-8 ${isPDF ? 'text-red-400' : 'text-gray-400'}`} />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs font-semibold text-gray-700 truncate">{att.name}</p>
                      <p className="text-xs text-gray-400">{(att.size / 1024).toFixed(0)} KB</p>
                      <div className="flex gap-2 mt-2">
                        {src && (
                          <>
                            {isImage && (
                              <button
                                onClick={() => setPreviewAtt({ name: att.name, data: src, type: att.type })}
                                className="flex items-center gap-1 text-xs font-semibold hover:underline"
                                style={{ color: '#222d64' }}
                              >
                                <Eye className="w-3 h-3" /> {isRTL ? 'عرض' : 'View'}
                              </button>
                            )}
                            <button
                              onClick={() => downloadFromUrl(src, att.name)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-semibold"
                            >
                              <Download className="w-3 h-3" /> {isRTL ? 'تحميل' : 'Download'}
                            </button>
                          </>
                        )}
                        {!src && (
                          <span className="text-xs text-gray-300">{isRTL ? 'غير متاح' : 'Not available'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Attachment preview modal */}
      {previewAtt && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewAtt(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewAtt(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm font-semibold text-gray-700 truncate">{previewAtt.name}</span>
                <button
                  onClick={() => downloadFromUrl(previewAtt.data, previewAtt.name)}
                  className="flex items-center gap-1.5 text-xs font-semibold hover:underline"
                  style={{ color: '#222d64' }}
                >
                  <Download className="w-3.5 h-3.5" /> {isRTL ? 'تحميل' : 'Download'}
                </button>
              </div>
              <img src={previewAtt.data} alt={previewAtt.name} className="w-full max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowProgress({ steps, isRTL }: { steps: WorkflowStepState[]; isRTL: boolean }) {
  const total = steps.length;
  const completed = steps.filter(s => !!s.completedAt).length;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`} style={{ backgroundColor: '#222d640a' }}>
        <Users className="w-4 h-4" style={{ color: '#222d64' }} />
        <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
          {isRTL ? `تقدم التوقيعات (${completed}/${total})` : `Signing Progress (${completed}/${total})`}
        </h2>
        <div className="flex-1" />
        {completed === total ? (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {isRTL ? 'مكتمل' : 'Complete'}
          </span>
        ) : (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {isRTL ? 'قيد الانتظار' : 'In Progress'}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-0 mb-4">
          {steps.map((step, i) => (
            <div key={step.key} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                step.completedAt
                  ? 'bg-green-500 border-green-500'
                  : i === completed
                  ? 'border-[#222d64] bg-white'
                  : 'border-gray-200 bg-gray-50'
              }`}>
                {step.completedAt ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-xs font-bold" style={{ color: i === completed ? '#222d64' : '#9ca3af' }}>{i + 1}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${step.completedAt ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={step.key} className={`flex items-start gap-3 p-3 rounded-xl border ${
              step.completedAt ? 'bg-green-50 border-green-200' : i === completed ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
            } ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                step.completedAt ? 'bg-green-500' : i === completed ? 'bg-[#222d64]' : 'bg-gray-200'
              }`}>
                {step.completedAt ? (
                  <CheckCircle className="w-4 h-4 text-white" />
                ) : (
                  <Clock className={`w-4 h-4 ${i === completed ? 'text-white' : 'text-gray-400'}`} />
                )}
              </div>
              <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                <p className="text-sm font-semibold text-gray-800 capitalize">{step.key}</p>
                {step.signerName && (
                  <p className="text-xs text-gray-500">{step.signerName}{step.signerEmail ? ` · ${step.signerEmail}` : ''}</p>
                )}
                {step.completedAt ? (
                  <p className="text-xs text-green-600 font-medium mt-0.5">
                    {isRTL ? 'وقّع في' : 'Signed'} {new Date(step.completedAt).toLocaleDateString()}
                  </p>
                ) : i === completed ? (
                  <p className="text-xs font-medium mt-0.5" style={{ color: '#222d64' }}>
                    {isRTL ? 'في انتظار التوقيع' : 'Awaiting signature'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isRTL ? 'لم يحن الدور بعد' : 'Pending previous step'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
