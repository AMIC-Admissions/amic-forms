import { useEffect, useRef, useState, useCallback } from 'react';
import { loadPDF, renderPageToCanvas } from '../lib/pdfUtils';
import type * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { FormField } from '../types';

interface PDFViewerProps {
  pdfBase64: string;
  fields?: FormField[];
  fieldValues?: Record<string, string>;
  signatureData?: string | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  visibleFieldIds?: Set<string>;
  onFieldChange?: (fieldId: string, value: string) => void;
  onMultiFieldChange?: (changes: Record<string, string>) => void;
  onSignatureClick?: () => void;
  errors?: Record<string, string>;
  submitAttempted?: boolean;
  interactive?: boolean;
}

function isLegacyField(field: FormField): boolean {
  return field.unit !== 'pt' && field.x <= 100 && field.width <= 100;
}

export default function PDFViewer({
  pdfBase64,
  fields = [],
  fieldValues = {},
  signatureData,
  currentPage: externalPage,
  onPageChange,
  visibleFieldIds,
  onFieldChange,
  onMultiFieldChange,
  onSignatureClick,
  errors = {},
  submitAttempted = false,
  interactive = false,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(externalPage || 1);
  const [rendered, setRendered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number } | null>(null);
  const [actualCanvasSize, setActualCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const renderToken = useRef(0);
  const { isRTL } = useLanguage();

  useEffect(() => {
    if (externalPage !== undefined) setCurrentPage(externalPage);
  }, [externalPage]);

  useEffect(() => {
    if (!pdfBase64) return;
    setLoading(true);
    setRendered(false);
    setActualCanvasSize(null);
    loadPDF(pdfBase64)
      .then(doc => {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      })
      .catch(() => setLoading(false));
  }, [pdfBase64]);

  // Track actual rendered canvas size via ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setActualCanvasSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [rendered]);

  const doRender = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    if (!canvasRef.current) return;
    const token = ++renderToken.current;
    setRendered(false);
    setActualCanvasSize(null);
    try {
      await renderPageToCanvas(doc, pageNum, canvasRef.current, 1.5);
      if (token !== renderToken.current) return;
      const page = await doc.getPage(pageNum);
      const vp1 = page.getViewport({ scale: 1 });
      setPdfPageSize({ width: vp1.width, height: vp1.height });
      setLoading(false);
      setRendered(true);
    } catch {
      if (token !== renderToken.current) return;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pdfDoc) return;
    doRender(pdfDoc, currentPage);
  }, [pdfDoc, currentPage, doRender]);

  const goTo = useCallback((p: number) => {
    setCurrentPage(p);
    onPageChange?.(p);
  }, [onPageChange]);

  const pageFields = fields.filter(f => {
    if ((f.page || 1) !== currentPage) return false;
    if (visibleFieldIds && !visibleFieldIds.has(f.id)) return false;
    return true;
  });

  const fieldToStyle = useCallback((field: FormField): React.CSSProperties => {
    if (isLegacyField(field)) {
      return {
        position: 'absolute',
        left: `${field.x}%`,
        top: `${field.y}%`,
        width: `${field.width}%`,
        height: `${field.height}%`,
        boxSizing: 'border-box',
        overflow: 'hidden',
      };
    }
    if (!pdfPageSize || !actualCanvasSize) return { position: 'absolute', left: 0, top: 0, width: 0, height: 0 };
    const left   = (field.x      / pdfPageSize.width)  * 100;
    const top    = (field.y      / pdfPageSize.height) * 100;
    const width  = (field.width  / pdfPageSize.width)  * 100;
    const height = (field.height / pdfPageSize.height) * 100;
    return {
      position: 'absolute',
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
      boxSizing: 'border-box',
      overflow: 'hidden',
    };
  }, [pdfPageSize, actualCanvasSize]);

  return (
    <div className="flex flex-col gap-3">
      <div style={{ minHeight: loading ? 400 : undefined, lineHeight: 0, background: 'white' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, backgroundColor: 'white' }}>
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
            <p className="text-sm text-gray-400 font-medium">Loading PDF…</p>
          </div>
        )}

        <div style={{ position: 'relative', display: 'block', lineHeight: 0, width: '100%' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: 'auto', opacity: rendered ? 1 : 0, transition: 'opacity 0.15s' }}
          />

          {rendered && actualCanvasSize && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: actualCanvasSize.width,
              height: actualCanvasSize.height,
              pointerEvents: interactive ? 'auto' : 'none',
              overflow: 'hidden',
            }}>
              {pageFields.map(field => (
                <FieldOverlay
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id] ?? ''}
                  allFieldValues={fieldValues}
                  allFields={fields}
                  signatureData={signatureData}
                  interactive={interactive}
                  hasError={submitAttempted && !!errors[field.id]}
                  onChange={val => onFieldChange?.(field.id, val)}
                  onMultiChange={onMultiFieldChange}
                  onSignatureClick={onSignatureClick}
                  isRTL={isRTL}
                  baseStyle={fieldToStyle(field)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {numPages > 1 && (
        <div className={`flex items-center gap-3 justify-center text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button onClick={() => goTo(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1">
            {Array.from({ length: numPages }, (_, i) => (
              <button
                key={i}
                onClick={() => goTo(i + 1)}
                className="w-7 h-7 rounded-lg text-xs font-bold transition-colors"
                style={currentPage === i + 1 ? { backgroundColor: '#222d64', color: 'white' } : { backgroundColor: 'transparent', color: '#6b7280' }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button onClick={() => goTo(Math.min(numPages, currentPage + 1))} disabled={currentPage === numPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function FieldOverlay({ field, value, allFieldValues, allFields, signatureData, interactive, hasError, onChange, onMultiChange, onSignatureClick, isRTL, baseStyle }: {
  field: FormField;
  value: string;
  allFieldValues: Record<string, string>;
  allFields: FormField[];
  signatureData?: string | null;
  interactive: boolean;
  hasError: boolean;
  onChange: (val: string) => void;
  onMultiChange?: (changes: Record<string, string>) => void;
  onSignatureClick?: () => void;
  isRTL: boolean;
  baseStyle: React.CSSProperties;
}) {
  const hasValue = field.type === 'signature' || field.type === 'stamp'
    ? !!signatureData
    : field.type === 'initials'
    ? !!value.trim()
    : field.type === 'checkbox' ? value === 'true'
    : !!value.trim();

  if (field.type === 'signature' || field.type === 'stamp') {
    if (signatureData) {
      return (
        <div style={baseStyle}>
          <img src={signatureData} alt="signature" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} draggable={false} />
          {interactive && (
            <button
              onClick={onSignatureClick}
              style={{ position: 'absolute', bottom: 2, right: 2, background: 'rgba(255,255,255,0.9)', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 9, padding: '1px 5px', cursor: 'pointer', color: '#374151', lineHeight: 1.5 }}
            >
              change
            </button>
          )}
        </div>
      );
    }
    if (interactive) {
      const label = field.type === 'stamp'
        ? (isRTL ? 'ختم' : 'Stamp')
        : (isRTL ? 'وقّع هنا' : 'Sign here');
      return (
        <div
          style={{
            ...baseStyle,
            border: `1.5px dashed ${hasError ? 'rgba(239,68,68,0.8)' : 'rgba(34,45,100,0.5)'}`,
            backgroundColor: hasError ? 'rgba(254,242,242,0.85)' : 'rgba(239,246,255,0.85)',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            gap: 4,
          }}
          onClick={onSignatureClick}
        >
          <PenLine style={{ width: 11, height: 11, color: hasError ? '#ef4444' : '#222d64', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: hasError ? '#ef4444' : '#222d64', fontWeight: 500 }}>{label}</span>
        </div>
      );
    }
    return null;
  }

  if (field.type === 'initials') {
    if (!interactive) {
      return (
        <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{value}</span>
        </div>
      );
    }
    return (
      <input
        type="text"
        value={value}
        maxLength={5}
        onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
        placeholder={isRTL ? 'أحرف' : 'ABC'}
        dir="ltr"
        style={{
          ...baseStyle,
          border: `1.5px solid ${hasValue ? 'rgba(22,163,74,0.6)' : hasError ? 'rgba(239,68,68,0.7)' : 'rgba(34,45,100,0.4)'}`,
          backgroundColor: hasValue ? 'rgba(240,253,244,0.92)' : hasError ? 'rgba(254,242,242,0.88)' : 'rgba(255,255,255,0.92)',
          borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: 2,
          textAlign: 'center', color: '#111827', padding: '0 4px',
          outline: 'none', fontFamily: 'inherit', textTransform: 'uppercase',
        }}
      />
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div
        style={{ ...baseStyle, display: 'flex', alignItems: 'center', paddingLeft: 3, cursor: interactive ? 'pointer' : 'default' }}
        onClick={interactive ? () => onChange(value === 'true' ? 'false' : 'true') : undefined}
      >
        <div style={{
          width: 13, height: 13, border: `1.5px solid ${value === 'true' ? '#222d64' : '#374151'}`,
          borderRadius: 2, backgroundColor: value === 'true' ? '#222d64' : 'rgba(255,255,255,0.9)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {value === 'true' && (
            <svg viewBox="0 0 10 8" fill="none" style={{ width: 8, height: 8 }}>
              <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>
    );
  }

  if (field.type === 'radio') {
    const isSelected = value === 'true';
    const handleRadioClick = () => {
      if (!interactive) return;
      if (field.radioGroup && onMultiChange) {
        const groupFields = allFields.filter(f => f.type === 'radio' && f.radioGroup === field.radioGroup);
        const changes: Record<string, string> = {};
        groupFields.forEach(f => { changes[f.id] = 'false'; });
        changes[field.id] = 'true';
        onMultiChange(changes);
      } else {
        onChange(isSelected ? 'false' : 'true');
      }
    };
    return (
      <div
        style={{ ...baseStyle, display: 'flex', alignItems: 'center', paddingLeft: 3, cursor: interactive ? 'pointer' : 'default' }}
        onClick={handleRadioClick}
      >
        <div style={{
          width: 13, height: 13, border: `1.5px solid ${isSelected ? '#222d64' : '#374151'}`,
          borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)',
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#222d64' }} />}
        </div>
      </div>
    );
  }

  if (field.type === 'yesno') {
    if (!interactive) {
      return (
        <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', paddingLeft: 4, paddingRight: 4 }}>
          <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600 }}>{value}</span>
        </div>
      );
    }
    return (
      <div style={{ ...baseStyle, display: 'flex', gap: 2, padding: '1px 2px' }}>
        {(['Yes', 'No'] as const).map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              flex: 1, border: `1.5px solid ${value === opt ? '#22c55e' : hasError ? 'rgba(239,68,68,0.5)' : 'rgba(34,45,100,0.3)'}`,
              borderRadius: 3, background: value === opt ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.9)',
              fontSize: 9, fontWeight: 700, cursor: 'pointer',
              color: value === opt ? '#15803d' : '#374151',
            }}
          >
            {isRTL ? (opt === 'Yes' ? 'نعم' : 'لا') : opt}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === 'dropdown') {
    if (!interactive) {
      return (
        <div style={{ ...baseStyle, display: 'flex', alignItems: 'center', paddingLeft: 4, paddingRight: 4, overflow: 'hidden' }}>
          <span style={{ fontSize: 10, color: '#15803d', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
        </div>
      );
    }
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          ...baseStyle,
          border: `1.5px solid ${hasValue ? 'rgba(22,163,74,0.6)' : hasError ? 'rgba(239,68,68,0.7)' : 'rgba(34,45,100,0.4)'}`,
          backgroundColor: hasValue ? 'rgba(240,253,244,0.92)' : hasError ? 'rgba(254,242,242,0.88)' : 'rgba(255,255,255,0.92)',
          borderRadius: 3, fontSize: 10, color: hasValue ? '#15803d' : '#374151',
          padding: '0 4px', outline: 'none', cursor: 'pointer', appearance: 'none',
        }}
      >
        <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
        {(field.options || []).map(opt => (
          <option key={opt.value} value={opt.value}>{isRTL ? opt.labelAr : opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    if (!interactive) {
      return (
        <div style={{ ...baseStyle, overflow: 'hidden', padding: '2px 4px' }}>
          <span style={{ fontSize: 9, color: '#15803d', fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.3 }}>{value}</span>
        </div>
      );
    }
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        dir={isRTL ? 'rtl' : 'ltr'}
        placeholder={isRTL ? field.labelAr : field.label}
        style={{
          ...baseStyle,
          border: `1.5px solid ${hasValue ? 'rgba(22,163,74,0.6)' : hasError ? 'rgba(239,68,68,0.7)' : 'rgba(34,45,100,0.4)'}`,
          backgroundColor: hasValue ? 'rgba(240,253,244,0.92)' : hasError ? 'rgba(254,242,242,0.88)' : 'rgba(255,255,255,0.92)',
          borderRadius: 3, fontSize: 10, color: '#111827',
          padding: '3px 5px', outline: 'none', resize: 'none',
          fontFamily: 'inherit', lineHeight: 1.4,
        }}
      />
    );
  }

  if (field.type === 'attachment') return null;

  if (!interactive) {
    return (
      <div style={{
        ...baseStyle,
        border: hasValue ? '1.5px solid rgba(22,163,74,0.7)' : '1.5px dashed rgba(59,130,246,0.6)',
        backgroundColor: hasValue ? 'rgba(34,197,94,0.08)' : 'rgba(219,234,254,0.7)',
        borderRadius: 3, display: 'flex', alignItems: 'center',
        overflow: 'hidden', paddingLeft: 4, paddingRight: 4,
      }}>
        <span style={{ fontSize: 10, color: hasValue ? '#15803d' : '#1d4ed8', fontWeight: hasValue ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'ltr' }}>
          {hasValue ? value : `[${field.label}]`}
        </span>
      </div>
    );
  }

  const isDate   = field.type === 'date';
  const isNumber = field.type === 'number';

  return (
    <input
      type={isDate ? 'date' : isNumber ? 'number' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
      value={value}
      min={isNumber ? field.minValue : undefined}
      max={isNumber ? field.maxValue : undefined}
      onChange={e => {
        if (field.type === 'phone') {
          onChange(e.target.value.replace(/[^\d+\s\-()\u0660-\u0669]/g, ''));
        } else {
          onChange(e.target.value);
        }
      }}
      dir={
        isRTL && !isDate && !isNumber &&
        field.type !== 'idNumber' && field.type !== 'email' && field.type !== 'phone'
          ? 'rtl' : 'ltr'
      }
      placeholder={isRTL ? field.labelAr : field.label}
      style={{
        ...baseStyle,
        border: `1.5px solid ${hasValue ? 'rgba(22,163,74,0.6)' : hasError ? 'rgba(239,68,68,0.7)' : 'rgba(34,45,100,0.4)'}`,
        backgroundColor: hasValue ? 'rgba(240,253,244,0.92)' : hasError ? 'rgba(254,242,242,0.88)' : 'rgba(255,255,255,0.92)',
        borderRadius: 3,
        fontSize: 10,
        color: '#111827',
        padding: '0 5px',
        outline: 'none',
        fontFamily: 'inherit',
        overflow: 'hidden',
        lineHeight: 'normal',
      }}
    />
  );
}
