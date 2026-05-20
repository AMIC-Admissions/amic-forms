import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle, ChevronRight, ChevronLeft, Upload, X, Paperclip,
  CheckCircle, PenLine, Check,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, uploadSignedPDF, uploadAttachment } from '../lib/supabase';
import { generateSignedPDF, pdfBase64ToBlob } from '../lib/pdfUtils';
import { generateReferenceNumber, getTodayString } from '../lib/utils';
import type { FormTemplate, FormField, AttachmentMeta, WorkflowStepState } from '../types';
import PDFViewer from '../components/PDFViewer';
import SignaturePad from '../components/SignaturePad';
import Navbar from '../components/Navbar';

type Step = 'fill' | 'review' | 'sign' | 'submit';
const STEPS: Step[] = ['fill', 'review', 'sign', 'submit'];

function stepIndex(s: Step) { return STEPS.indexOf(s); }

function evaluateCondition(field: FormField, values: Record<string, string>): boolean {
  if (!field.condition) return true;
  const { sourceFieldId, operator, value: condValue } = field.condition;
  const sourceValue = (values[sourceFieldId] || '').trim().toLowerCase();
  const target = condValue.trim().toLowerCase();
  if (operator === 'equals') return sourceValue === target;
  if (operator === 'not_equals') return sourceValue !== target;
  if (operator === 'contains') return sourceValue.includes(target);
  if (operator === 'is_empty') return sourceValue === '';
  if (operator === 'is_not_empty') return sourceValue !== '';
  return true;
}

function dedupeLinkedFields(fields: FormField[]): FormField[] {
  const seenGroups = new Set<string>();
  return fields.filter(f => {
    if (!f.linkedGroup) return true;
    if (seenGroups.has(f.linkedGroup)) return false;
    seenGroups.add(f.linkedGroup);
    return true;
  });
}

export default function FormPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { isRTL, lang } = useLanguage();

  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  // attachments: display metadata (no base64 data)
  const [attachments, setAttachments] = useState<Record<string, AttachmentMeta[]>>({});
  // rawFiles: actual File objects keyed by `${slotId}::${id}`
  const [rawFiles, setRawFiles] = useState<Record<string, File>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSignPad, setShowSignPad] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [step, setStep] = useState<Step>('fill');

  useEffect(() => {
    if (!templateId) return;
    supabase
      .from('form_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
        } else {
          const tmpl = data as FormTemplate;
          setTemplate(tmpl);
          const initial: Record<string, string> = {};
          tmpl.fields.forEach((f: FormField) => {
            if (f.type === 'date') initial[f.id] = getTodayString();
            if (f.type === 'checkbox') initial[f.id] = 'false';
          });
          setValues(initial);
        }
        setLoading(false);
      });
  }, [templateId]);

  const setValue = useCallback((fieldId: string, val: string, allFields?: FormField[]) => {
    setValues(prev => {
      const next = { ...prev, [fieldId]: val };
      if (allFields) {
        const changedField = allFields.find(f => f.id === fieldId);
        if (changedField?.linkedGroup) {
          allFields
            .filter(f => f.linkedGroup === changedField.linkedGroup && f.id !== fieldId)
            .forEach(linked => { next[linked.id] = val; });
        }
      }
      return next;
    });
    if (errors[fieldId]) setErrors(prev => { const e = { ...prev }; delete e[fieldId]; return e; });
  }, [errors]);

  const visibleFields = useCallback((fields: FormField[]): FormField[] => {
    return fields.filter(f => evaluateCondition(f, values));
  }, [values]);

  // Clear values for hidden fields when conditions change
  useEffect(() => {
    if (!template) return;
    const hidden = template.fields.filter(f => !evaluateCondition(f, values));
    const hasHiddenWithValue = hidden.some(f => values[f.id] !== undefined && values[f.id] !== '' && values[f.id] !== 'false');
    if (!hasHiddenWithValue) return;
    setValues(prev => {
      const next = { ...prev };
      hidden.forEach(f => {
        if (f.type === 'checkbox') next[f.id] = 'false';
        else delete next[f.id];
      });
      return next;
    });
  }, [template, values]);

  const validateFill = (): boolean => {
    if (!template) return false;
    const newErrors: Record<string, string> = {};
    const visible = visibleFields(template.fields);
    const dedupedVisible = dedupeLinkedFields(visible);

    // Track validated radio groups to avoid duplicating errors
    const validatedRadioGroups = new Set<string>();

    dedupedVisible.forEach(field => {
      if (!field.required) return;
      if (field.type === 'attachment' || field.type === 'checkbox' || field.type === 'signature') return;
      if (field.type === 'radio') {
        const group = field.radioGroup;
        if (group) {
          if (validatedRadioGroups.has(group)) return;
          validatedRadioGroups.add(group);
          const groupFields = visible.filter(f => f.type === 'radio' && f.radioGroup === group);
          const anySelected = groupFields.some(f => values[f.id] === 'true');
          if (!anySelected) {
            groupFields.forEach(f => { newErrors[f.id] = isRTL ? 'يرجى اختيار خيار' : 'Please select an option'; });
          }
        } else {
          if (values[field.id] !== 'true') newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
        }
        return;
      }
      if (field.type === 'number') {
        const v = values[field.id]?.trim() || '';
        if (!v) {
          newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
        } else {
          const num = parseFloat(v);
          if (isNaN(num)) {
            newErrors[field.id] = isRTL ? 'يرجى إدخال رقم صحيح' : 'Please enter a valid number';
          } else if (field.minValue !== undefined && num < field.minValue) {
            newErrors[field.id] = isRTL ? `الحد الأدنى ${field.minValue}` : `Minimum value is ${field.minValue}`;
          } else if (field.maxValue !== undefined && num > field.maxValue) {
            newErrors[field.id] = isRTL ? `الحد الأقصى ${field.maxValue}` : `Maximum value is ${field.maxValue}`;
          }
        }
        return;
      }
      if (field.type === 'yesno') {
        if (!values[field.id]) newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
      } else if (field.type === 'dropdown') {
        if (!values[field.id]?.trim()) newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
      } else if (field.type === 'email') {
        const v = values[field.id]?.trim() || '';
        if (!v) newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) newErrors[field.id] = isRTL ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address';
      } else if (field.type === 'phone') {
        const v = values[field.id]?.trim() || '';
        if (!v) newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
        else if (v.replace(/[\s\-()]/g, '').length < 7) newErrors[field.id] = isRTL ? 'يرجى إدخال رقم هاتف صحيح' : 'Please enter a valid phone number';
      } else {
        if (!values[field.id]?.trim()) newErrors[field.id] = isRTL ? 'هذا الحقل مطلوب' : 'This field is required';
      }
    });

    (template.required_attachments || []).forEach(reqAtt => {
      if (!reqAtt.required) return;
      if (!(attachments[reqAtt.id] || []).length) {
        newErrors[`att_${reqAtt.id}`] = isRTL ? `مطلوب: ${reqAtt.labelAr}` : `Required: ${reqAtt.label}`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSign = (): boolean => {
    if (!template) return false;
    const needsSig = visibleFields(template.fields).some(f => f.type === 'signature' && f.required);
    if (needsSig && !signatureData) {
      setErrors({ signature: isRTL ? 'التوقيع مطلوب' : 'Signature is required' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'fill') {
      setSubmitAttempted(true);
      if (!validateFill()) return;
      setErrors({});
      setStep('review');
    } else if (step === 'review') {
      setStep('sign');
    } else if (step === 'sign') {
      if (!validateSign()) return;
      handleSubmit();
    }
  };

  const handleBack = () => {
    const idx = stepIndex(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>, slotId: string) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newMeta: AttachmentMeta[] = files.map(f => ({
      id: `${Date.now()}_${f.name}`,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setAttachments(prev => ({ ...prev, [slotId]: [...(prev[slotId] || []), ...newMeta] }));
    // Store raw File objects for upload at submit time
    setRawFiles(prev => {
      const next = { ...prev };
      newMeta.forEach((meta, i) => { next[`${slotId}::${meta.id}`] = files[i]; });
      return next;
    });
    if (errors[`att_${slotId}`]) setErrors(prev => { const e = { ...prev }; delete e[`att_${slotId}`]; return e; });
    e.target.value = '';
  };

  const removeAttachment = (slotId: string, idx: number) => {
    setAttachments(prev => {
      const updated = (prev[slotId] || []).filter((_, i) => i !== idx);
      const removed = (prev[slotId] || [])[idx];
      if (removed) {
        setRawFiles(rf => { const n = { ...rf }; delete n[`${slotId}::${removed.id}`]; return n; });
      }
      return { ...prev, [slotId]: updated };
    });
  };

  const handleSubmit = async () => {
    if (!template) return;
    setSubmitting(true);
    try {
      const refNum = generateReferenceNumber();

      // 1. Generate signed PDF (base64) then upload to Storage
      let pdfStorageUrl: string | null = null;
      let pdfBase64: string | null = null;
      try {
        pdfBase64 = await generateSignedPDF(template.pdf_data, values, signatureData, template.fields, refNum);
        const pdfBlob = pdfBase64ToBlob(pdfBase64);
        const safeName = (template.pdf_filename || 'form').replace(/\.pdf$/i, '');
        pdfStorageUrl = await uploadSignedPDF(refNum, safeName, pdfBlob);
        // Keep base64 in localStorage for immediate success-page download
        localStorage.setItem(`amic_pdf_${refNum}`, pdfBase64);
      } catch (pdfErr) {
        console.warn('PDF generation/upload failed:', pdfErr);
      }

      // 2. Upload attachments to Storage
      const allAttachmentsMeta = Object.entries(attachments).flatMap(([slotId, metas]) =>
        metas.map(meta => ({ slotId, meta }))
      );
      const uploadedAttachments: AttachmentMeta[] = await Promise.all(
        allAttachmentsMeta.map(async ({ slotId, meta }) => {
          const rawFile = rawFiles[`${slotId}::${meta.id}`];
          if (rawFile) {
            const url = await uploadAttachment(refNum, slotId, rawFile);
            return { id: meta.id, name: meta.name, size: meta.size, type: meta.type, url: url ?? undefined };
          }
          return { id: meta.id, name: meta.name, size: meta.size, type: meta.type };
        })
      );

      const parentNameField = template.fields.find(f => f.type === 'parentName');
      const studentNameField = template.fields.find(f => f.type === 'studentName');
      const idNumberField = template.fields.find(f => f.type === 'idNumber');
      const emailField = template.fields.find(f => f.type === 'email');

      // Build workflow state if template has a signing workflow
      let workflowState: WorkflowStepState[] | null = null;
      let submissionStatus = 'completed';
      if (template.signing_workflow?.enabled && (template.signing_workflow.steps?.length ?? 0) > 0) {
        const steps = [...template.signing_workflow.steps].sort((a, b) => a.order - b.order);
        workflowState = steps.map((step, i) => ({
          key: step.key,
          completedAt: i === 0 ? new Date().toISOString() : null,
          signerName: i === 0 ? (values[parentNameField?.id ?? ''] || '') : undefined,
          signerEmail: i === 0 ? (emailField ? (values[emailField.id] || '') : '') : undefined,
          signatureData: i === 0 ? signatureData : null,
        }));
        const allDone = workflowState.every(s => !!s.completedAt);
        submissionStatus = allDone ? 'completed' : 'pending_signature';
      }

      const { data: sub, error } = await supabase
        .from('submissions')
        .insert({
          reference_number: refNum,
          template_id: template.id,
          template_name: lang === 'ar' ? (template.name_ar || template.name) : template.name,
          form_data: {
            ...values,
            parentName: parentNameField ? (values[parentNameField.id] || '') : '',
            studentName: studentNameField ? (values[studentNameField.id] || '') : '',
            idNumber: idNumberField ? (values[idNumberField.id] || '') : '',
          },
          signature_data: signatureData,
          // Store URL (or empty object) — no base64 blob data
          attachments: uploadedAttachments.map(a => ({
            id: a.id, name: a.name, size: a.size, type: a.type, url: a.url ?? null,
          })),
          // Store Storage URL; fallback to base64 if upload failed
          signed_pdf_data: pdfStorageUrl ?? pdfBase64,
          signer_email: emailField ? (values[emailField.id] || '') : '',
          status: submissionStatus,
          workflow_state: workflowState,
          audit_log: [{ event: 'submitted', at: new Date().toISOString() }],
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (sub) localStorage.setItem(`amic_sub_${refNum}`, JSON.stringify(sub));

      if (template.excel_webhook_url) {
        try {
          await fetch(template.excel_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referenceNumber: refNum,
              date: new Date().toLocaleDateString(),
              parentName: parentNameField ? (values[parentNameField.id] || '') : '',
              studentName: studentNameField ? (values[studentNameField.id] || '') : '',
              idNumber: idNumberField ? (values[idNumberField.id] || '') : '',
              email: emailField ? (values[emailField.id] || '') : '',
              phone: template.fields.find(f => f.type === 'phone')
                ? (values[template.fields.find(f => f.type === 'phone')!.id] || '') : '',
              templateName: lang === 'ar' ? (template.name_ar || template.name) : template.name,
              status: 'Completed',
            }),
          });
          if (sub) await supabase.from('submissions').update({ excel_synced: true }).eq('id', sub.id);
        } catch (webhookErr) {
          console.warn('Excel webhook failed:', webhookErr);
        }
      }

      navigate(`/success/${refNum}`);
    } catch (err) {
      console.error(err);
      setErrors({ _global: isRTL ? 'حدث خطأ ما. الرجاء المحاولة مرة أخرى.' : 'Something went wrong. Please try again.' });
      setStep('sign');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeeed]" dir={isRTL ? 'rtl' : 'ltr'}>
        <Navbar />
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-8 h-8 border-2 border-[#222d64] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">{isRTL ? 'جارٍ تحميل النموذج…' : 'Loading form…'}</p>
        </div>
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className="min-h-screen bg-[#eeeeed]" dir={isRTL ? 'rtl' : 'ltr'}>
        <Navbar />
        <div className="max-w-lg mx-auto text-center py-24 px-4">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isRTL ? 'النموذج غير متاح' : 'Form Not Found'}
          </h2>
          <p className="text-gray-500">
            {isRTL ? 'هذا النموذج غير متاح أو تم تعطيله.' : 'This form is not available or has been deactivated.'}
          </p>
        </div>
      </div>
    );
  }

  const visible = visibleFields(template.fields);
  const dedupedForForm = dedupeLinkedFields(visible);
  const hasAttachments = (template.required_attachments || []).length > 0 || visible.some(f => f.type === 'attachment');
  const hasSignatureField = visible.some(f => f.type === 'signature');

  const stepLabels = isRTL
    ? ['تعبئة النموذج', 'المراجعة', 'التوقيع', 'الإرسال']
    : ['Fill Form', 'Review', 'Sign', 'Submit'];

  const currentStepIdx = stepIndex(step);

  return (
    <div className="min-h-screen bg-[#eeeeed]" dir={isRTL ? 'rtl' : 'ltr'}>
      <Navbar />

      {/* Sticky stepper */}
      <div className="bg-white border-b border-gray-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <p className="text-xs font-semibold text-gray-400 text-center mb-3">
            {isRTL ? (template.name_ar || template.name) : template.name}
          </p>
          <div className="flex items-center justify-center">
            {STEPS.map((s, i) => {
              const done = i < currentStepIdx;
              const active = i === currentStepIdx;
              const isLast = i === STEPS.length - 1;
              return (
                <div key={s} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                        done ? 'bg-green-500 text-white' : active ? 'text-white shadow-md' : 'bg-gray-100 text-gray-400'
                      }`}
                      style={active ? { backgroundColor: '#222d64' } : {}}
                    >
                      {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-xs mt-1 font-medium hidden sm:block whitespace-nowrap ${active ? 'text-[#222d64]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                      {stepLabels[i]}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 flex flex-col gap-4">

        {/* STEP: FILL */}
        {step === 'fill' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm" style={{ overflow: 'hidden' }}>
              <div className={`flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs text-gray-400 ms-2">{template.pdf_filename}</span>
                <div className="flex-1" />
                <span className="text-xs text-gray-400">{isRTL ? 'انقر في الحقول للكتابة' : 'Click fields to type'}</span>
              </div>
              <PDFViewer
                pdfBase64={template.pdf_data}
                fields={template.fields}
                fieldValues={values}
                signatureData={signatureData}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                visibleFieldIds={new Set(visible.map(f => f.id))}
                interactive={true}
                onFieldChange={(fieldId, val) => setValue(fieldId, val, template.fields)}
                onMultiFieldChange={changes => {
                  setValues(prev => ({ ...prev, ...changes }));
                }}
                onSignatureClick={() => setShowSignPad(true)}
                errors={errors}
                submitAttempted={submitAttempted}
              />
            </div>

            {hasAttachments && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className={`text-sm font-bold text-gray-800 mb-4 ${isRTL ? 'text-right' : ''}`}>
                  {isRTL ? 'المستندات المطلوبة' : 'Required Documents'}
                </h3>
                <div className="space-y-4">
                  {(template.required_attachments || []).map(reqAtt => (
                    <AttachmentSlot
                      key={reqAtt.id}
                      label={isRTL ? reqAtt.labelAr : reqAtt.label}
                      required={reqAtt.required}
                      files={attachments[reqAtt.id] || []}
                      error={submitAttempted ? errors[`att_${reqAtt.id}`] : undefined}
                      onUpload={e => handleAttachment(e, reqAtt.id)}
                      onRemove={idx => removeAttachment(reqAtt.id, idx)}
                      isRTL={isRTL}
                    />
                  ))}
                  {visible.some(f => f.type === 'attachment') && (
                    <AttachmentSlot
                      label={isRTL ? 'مرفقات إضافية' : 'Additional Attachments'}
                      required={false}
                      files={attachments['_inline'] || []}
                      error={undefined}
                      onUpload={e => handleAttachment(e, '_inline')}
                      onRemove={idx => removeAttachment('_inline', idx)}
                      isRTL={isRTL}
                    />
                  )}
                </div>
              </div>
            )}

            {submitAttempted && Object.keys(errors).filter(k => k !== '_global').length > 0 && (
              <div className={`text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-semibold">{isRTL ? 'يرجى ملء الحقول المطلوبة قبل المتابعة' : 'Please complete all required fields before continuing'}</span>
              </div>
            )}
          </>
        )}

        {/* STEP: REVIEW */}
        {step === 'review' && (
          <ReviewStep template={template} values={values} dedupedFields={dedupedForForm} attachments={attachments} isRTL={isRTL} lang={lang} />
        )}

        {/* STEP: SIGN */}
        {step === 'sign' && (
          <SignStep
            template={template}
            signatureData={signatureData}
            hasSignatureField={hasSignatureField}
            isRTL={isRTL}
            errors={errors}
            onOpenPad={() => setShowSignPad(true)}
            onClear={() => setSignatureData(null)}
          />
        )}

        {/* Navigation bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          {currentStepIdx > 0 && (
            <button
              onClick={handleBack}
              disabled={submitting}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <ChevronLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              {isRTL ? 'رجوع' : 'Back'}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleNext}
            disabled={submitting}
            className={`flex items-center gap-2 text-sm font-bold px-6 py-2.5 rounded-xl text-white transition-all shadow-sm hover:brightness-110 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
            style={{ backgroundColor: '#222d64' }}
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{isRTL ? 'جارٍ الإرسال…' : 'Submitting…'}</span>
              </>
            ) : step === 'sign' ? (
              <>
                <span>{isRTL ? 'إرسال النموذج' : 'Submit Form'}</span>
                <Check className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>{isRTL ? 'التالي' : 'Continue'}</span>
                <ChevronRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
        </div>

        {errors._global && (
          <div className={`text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errors._global}</span>
          </div>
        )}
      </div>

      {/* Signature modal — fullscreen on mobile, centered modal on desktop */}
      {showSignPad && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={() => { if (signatureData) setShowSignPad(false); }}
        >
          <div
            className="w-full sm:max-w-[460px] bg-white sm:rounded-2xl overflow-hidden shadow-2xl"
            style={{ borderRadius: '20px 20px 0 0' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle on mobile */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100" style={{ background: '#222d64' }}>
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-white" />
                <span className="text-sm font-bold text-white">
                  {isRTL ? 'التوقيع الإلكتروني' : 'Electronic Signature'}
                </span>
              </div>
              {signatureData && (
                <button
                  onClick={() => setShowSignPad(false)}
                  className="p-2 rounded-lg bg-white/15 hover:bg-white/25 transition-colors text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <SignaturePad
              existingData={signatureData}
              onSave={data => { setSignatureData(data); setShowSignPad(false); }}
              onClear={() => setSignatureData(null)}
              onClose={() => { if (signatureData) setShowSignPad(false); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Review Step ─── */
function ReviewStep({
  template, values, dedupedFields, attachments, isRTL, lang,
}: {
  template: FormTemplate;
  values: Record<string, string>;
  dedupedFields: FormField[];
  attachments: Record<string, AttachmentMeta[]>;
  isRTL: boolean;
  lang: string;
}) {
  const displayFields = dedupedFields.filter(f => f.type !== 'signature' && f.type !== 'attachment');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100" style={{ backgroundColor: '#222d640a' }}>
          <h2 className="font-bold text-sm" style={{ color: '#222d64' }}>
            {isRTL ? 'مراجعة البيانات' : 'Review Your Information'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isRTL ? 'تأكد من صحة البيانات قبل التوقيع والإرسال' : 'Verify all information is correct before signing and submitting'}
          </p>
        </div>
        <div className="divide-y divide-gray-50">
          {displayFields.map(field => {
            const val = values[field.id];
            const label = lang === 'ar' ? field.labelAr : field.label;
            return (
              <div key={field.id} className={`flex items-start gap-4 px-5 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-36 flex-shrink-0 pt-0.5 truncate">{label}</span>
                <span className="text-sm text-gray-800 flex-1 break-words font-medium">
                  {field.type === 'checkbox'
                    ? (val === 'true'
                      ? <span className={`flex items-center gap-1 text-green-600 ${isRTL ? 'flex-row-reverse' : ''}`}><CheckCircle className="w-3.5 h-3.5" /> {isRTL ? 'نعم' : 'Yes'}</span>
                      : <span className="text-gray-400">{isRTL ? 'لا' : 'No'}</span>)
                    : (val || <span className="text-gray-300">—</span>)
                  }
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {Object.values(attachments).flat().length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className={`text-sm font-bold text-gray-800 mb-3 flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Paperclip className="w-4 h-4 text-gray-400" />
            {isRTL ? 'المرفقات' : 'Attachments'} ({Object.values(attachments).flat().length})
          </h3>
          <div className="space-y-1.5">
            {Object.values(attachments).flat().map((a, i) => (
              <div key={i} className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-700">{a.name}</span>
                <span className="text-gray-400">{(a.size / 1024).toFixed(0)}KB</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sign Step ─── */
function SignStep({
  signatureData, hasSignatureField, isRTL, errors, onOpenPad,
}: {
  template: FormTemplate;
  signatureData: string | null;
  hasSignatureField: boolean;
  isRTL: boolean;
  errors: Record<string, string>;
  onOpenPad: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100" style={{ backgroundColor: '#222d640a' }}>
          <h2 className="font-bold text-sm flex items-center gap-2" style={{ color: '#222d64' }}>
            <PenLine className="w-4 h-4" />
            {isRTL ? 'التوقيع الإلكتروني' : 'Electronic Signature'}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isRTL ? 'يرجى إضافة توقيعك لإتمام العملية' : 'Please add your signature to complete the process'}
          </p>
        </div>

        <div className="p-5">
          {signatureData ? (
            <div className="space-y-3">
              <div className="border-2 border-green-200 rounded-xl p-4 bg-green-50/50 relative">
                <div className={`absolute top-2 flex items-center gap-1.5 text-xs font-semibold text-green-600 ${isRTL ? 'left-2' : 'right-2'}`}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  {isRTL ? 'تم التوقيع' : 'Signed'}
                </div>
                <img src={signatureData} alt="Signature" className="h-20 object-contain mx-auto" />
              </div>
              <button
                onClick={onOpenPad}
                className="text-sm text-gray-500 hover:text-[#222d64] font-medium transition-colors flex items-center gap-1.5"
              >
                <PenLine className="w-3.5 h-3.5" />
                {isRTL ? 'تغيير التوقيع' : 'Change Signature'}
              </button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                errors.signature ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-[#222d64]/40 hover:bg-blue-50/30'
              }`}
              onClick={onOpenPad}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 ${errors.signature ? 'bg-red-100' : 'bg-gray-100'}`}>
                <PenLine className={`w-6 h-6 ${errors.signature ? 'text-red-400' : 'text-gray-400'}`} />
              </div>
              <p className={`font-semibold text-sm mb-1 ${errors.signature ? 'text-red-600' : 'text-gray-700'}`}>
                {isRTL ? 'انقر لإضافة توقيعك' : 'Click to Add Your Signature'}
              </p>
              <p className="text-xs text-gray-400">
                {isRTL ? 'ارسم أو اكتب أو ارفع صورة توقيعك' : 'Draw, type, or upload your signature'}
              </p>
              {errors.signature && (
                <p className="text-xs text-red-500 mt-2 flex items-center justify-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />{errors.signature}
                </p>
              )}
            </div>
          )}

          {!hasSignatureField && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
              {isRTL
                ? 'لا يوجد حقل توقيع مطلوب في هذا النموذج. يمكنك الإرسال مباشرة.'
                : 'No signature field required in this form. You may submit directly.'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-[#222d64]/5 border border-[#222d64]/10 rounded-xl px-4 py-3">
        <p className="text-xs text-[#222d64] font-medium text-center">
          {isRTL
            ? 'بالإرسال، تقر بأن المعلومات صحيحة وأن التوقيع صادر منك'
            : 'By submitting, you confirm that the information is accurate and the signature is your own'}
        </p>
      </div>
    </div>
  );
}

/* ─── Attachment Slot ─── */
function AttachmentSlot({ label, required, files, error, onUpload, onRemove, isRTL }: {
  label: string; required: boolean; files: AttachmentMeta[]; error?: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void; onRemove: (idx: number) => void; isRTL: boolean;
}) {
  return (
    <div>
      <label className={`flex items-center gap-2 text-sm font-semibold mb-2 ${isRTL ? 'flex-row-reverse' : ''} ${error ? 'text-red-600' : 'text-gray-800'}`}>
        <div className={`w-7 h-7 rounded-lg ${files.length > 0 ? 'bg-green-100' : 'bg-gray-50'} flex items-center justify-center flex-shrink-0`}>
          {files.length > 0 ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Paperclip className="w-4 h-4 text-gray-500" />}
        </div>
        <span>{label}{required && <span className="text-red-500 ms-0.5">*</span>}</span>
      </label>
      <label className={`w-full border-2 border-dashed rounded-xl py-3 px-4 flex items-center gap-3 cursor-pointer transition-all ${error ? 'border-red-300 bg-red-50' : files.length > 0 ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'} ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Upload className={`w-5 h-5 flex-shrink-0 ${files.length > 0 ? 'text-blue-600' : error ? 'text-red-400' : 'text-gray-400'}`} />
        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
          <p className={`text-sm font-medium ${files.length > 0 ? 'text-blue-700' : error ? 'text-red-500' : 'text-gray-500'}`}>
            {files.length > 0 ? `${files.length} ${isRTL ? 'ملف مرفق' : 'file(s) attached'}` : isRTL ? 'انقر للرفع' : 'Click to upload'}
          </p>
          <p className="text-xs text-gray-400">PDF, JPG, JPEG, PNG</p>
        </div>
        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={onUpload} />
      </label>
      {error && (
        <p className={`text-xs text-red-500 mt-1.5 flex items-center gap-1 font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </p>
      )}
      {files.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {files.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="flex-1 truncate text-gray-700">{a.name}</span>
              <span className="text-gray-400 flex-shrink-0">{(a.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => onRemove(i)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
