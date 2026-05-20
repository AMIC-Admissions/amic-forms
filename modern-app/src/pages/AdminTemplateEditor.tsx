import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Upload, Plus, Trash2, Save, ArrowLeft, User, GraduationCap,
  CreditCard, PenLine, Calendar, Paperclip, AlertCircle, Move,
  ChevronLeft, ChevronRight, Settings, EyeOff, Type,
  AlignLeft, CheckSquare, ChevronDown, ToggleLeft, Link2,
  GitBranch, X, GripVertical, Mail, Phone, Hash, Building2,
  Fingerprint, Circle, Stamp, Briefcase, UserCheck, Grid3x3
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { fileToBase64 } from '../lib/utils';
import { loadPDF, renderPageToCanvas } from '../lib/pdfUtils';
import type { FormField, FieldType, FormTemplate, RequiredAttachment, DropdownOption, ConditionalRule } from '../types';
import type * as pdfjsLib from 'pdfjs-dist';

interface FieldDef {
  type: FieldType;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  color: string;
  category: string;
  /** default width in PDF points */
  defaultWidth: number;
  /** default height in PDF points */
  defaultHeight: number;
}

const FIELD_DEFS: FieldDef[] = [
  // People
  { type: 'parentName',  label: 'Parent Name',       labelAr: 'اسم ولي الأمر',     icon: User,          color: 'blue',    category: 'People',   defaultWidth: 150, defaultHeight: 18 },
  { type: 'studentName', label: 'Student Name',      labelAr: 'اسم الطالب',        icon: GraduationCap, color: 'teal',    category: 'People',   defaultWidth: 150, defaultHeight: 18 },
  { type: 'fullName',    label: 'Full Name',          labelAr: 'الاسم الكامل',      icon: UserCheck,     color: 'cyan',    category: 'People',   defaultWidth: 150, defaultHeight: 18 },
  { type: 'idNumber',    label: 'ID Number',          labelAr: 'رقم الهوية',        icon: CreditCard,    color: 'amber',   category: 'People',   defaultWidth: 120, defaultHeight: 18 },
  { type: 'company',     label: 'Company',            labelAr: 'الشركة',            icon: Building2,     color: 'slate',   category: 'People',   defaultWidth: 140, defaultHeight: 18 },
  { type: 'title',       label: 'Title / Role',       labelAr: 'المسمى الوظيفي',   icon: Briefcase,     color: 'stone',   category: 'People',   defaultWidth: 120, defaultHeight: 18 },
  // Contact
  { type: 'email',       label: 'Email Address',      labelAr: 'البريد الإلكتروني', icon: Mail,          color: 'sky',     category: 'Contact',  defaultWidth: 160, defaultHeight: 18 },
  { type: 'phone',       label: 'Phone Number',       labelAr: 'رقم الهاتف',        icon: Phone,         color: 'emerald', category: 'Contact',  defaultWidth: 140, defaultHeight: 18 },
  // Input
  { type: 'text',        label: 'Text Field',         labelAr: 'حقل نص',            icon: Type,          color: 'indigo',  category: 'Input',    defaultWidth: 150, defaultHeight: 18 },
  { type: 'textarea',    label: 'Text Area',          labelAr: 'منطقة نص',          icon: AlignLeft,     color: 'violet',  category: 'Input',    defaultWidth: 200, defaultHeight: 42 },
  { type: 'number',      label: 'Number',             labelAr: 'رقم',               icon: Hash,          color: 'orange',  category: 'Input',    defaultWidth: 100, defaultHeight: 18 },
  { type: 'date',        label: 'Date',               labelAr: 'التاريخ',           icon: Calendar,      color: 'green',   category: 'Input',    defaultWidth: 110, defaultHeight: 18 },
  // Choice
  { type: 'checkbox',    label: 'Checkbox',           labelAr: 'مربع اختيار',       icon: CheckSquare,   color: 'lime',    category: 'Choice',   defaultWidth: 100, defaultHeight: 18 },
  { type: 'radio',       label: 'Radio Button',       labelAr: 'زر راديو',          icon: Circle,        color: 'pink',    category: 'Choice',   defaultWidth: 100, defaultHeight: 18 },
  { type: 'dropdown',    label: 'Dropdown',           labelAr: 'قائمة منسدلة',      icon: ChevronDown,   color: 'rose',    category: 'Choice',   defaultWidth: 150, defaultHeight: 18 },
  { type: 'yesno',       label: 'Yes / No',           labelAr: 'نعم / لا',          icon: ToggleLeft,    color: 'fuchsia', category: 'Choice',   defaultWidth: 110, defaultHeight: 18 },
  // Signature
  { type: 'signature',   label: 'Signature',          labelAr: 'التوقيع',           icon: PenLine,       color: 'red',     category: 'Signing',  defaultWidth: 140, defaultHeight: 40 },
  { type: 'initials',    label: 'Initials',           labelAr: 'الأحرف الأولى',     icon: Fingerprint,   color: 'orange',  category: 'Signing',  defaultWidth: 60,  defaultHeight: 30 },
  { type: 'stamp',       label: 'Stamp',              labelAr: 'ختم',               icon: Stamp,         color: 'amber',   category: 'Signing',  defaultWidth: 60,  defaultHeight: 60 },
  // Other
  { type: 'attachment',  label: 'Attachment',         labelAr: 'مرفق',              icon: Paperclip,     color: 'gray',    category: 'Other',    defaultWidth: 140, defaultHeight: 18 },
];

const CATEGORIES = ['People', 'Contact', 'Input', 'Choice', 'Signing', 'Other'];

const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  blue:    { border: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  teal:    { border: '#14b8a6', bg: '#f0fdfa', text: '#0f766e' },
  amber:   { border: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  green:   { border: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  cyan:    { border: '#06b6d4', bg: '#ecfeff', text: '#0e7490' },
  emerald: { border: '#10b981', bg: '#ecfdf5', text: '#065f46' },
  sky:     { border: '#0ea5e9', bg: '#f0f9ff', text: '#0369a1' },
  violet:  { border: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9' },
  indigo:  { border: '#6366f1', bg: '#eef2ff', text: '#4338ca' },
  orange:  { border: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  pink:    { border: '#ec4899', bg: '#fdf2f8', text: '#9d174d' },
  rose:    { border: '#f43f5e', bg: '#fff1f2', text: '#be123c' },
  lime:    { border: '#84cc16', bg: '#f7fee7', text: '#3f6212' },
  red:     { border: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  gray:    { border: '#6b7280', bg: '#f9fafb', text: '#374151' },
  slate:   { border: '#64748b', bg: '#f8fafc', text: '#334155' },
  stone:   { border: '#78716c', bg: '#fafaf9', text: '#44403c' },
  fuchsia: { border: '#d946ef', bg: '#fdf4ff', text: '#a21caf' },
};

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize',
  ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize',
};

const SNAP_PT = 8;

let fieldCounter = 0;

type FloatingPanel = 'palette' | 'settings' | 'docs' | null;

export default function AdminTemplateEditor() {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [requiredAttachments, setRequiredAttachments] = useState<RequiredAttachment[]>([]);
  const [excelWebhookUrl, setExcelWebhookUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfRendered, setPdfRendered] = useState(false);
  const [pdfRendering, setPdfRendering] = useState(false);
  /** CSS size of the rendered canvas */
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  /** PDF page dimensions at scale=1 (PDF points) */
  const [pdfPageSize, setPdfPageSize] = useState({ width: 0, height: 0 });
  /** Thumbnail data per page */
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [interacting, setInteracting] = useState<'drag' | 'resize' | null>(null);
  const [floatingPanel, setFloatingPanel] = useState<FloatingPanel>('palette');
  const [loading, setLoading] = useState(!!templateId);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [paletteCategory, setPaletteCategory] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!templateId) return;
    supabase.from('form_templates').select('*').eq('id', templateId).maybeSingle().then(({ data }) => {
      if (data) {
        const tmpl = data as FormTemplate;
        setName(tmpl.name);
        setNameAr(tmpl.name_ar);
        setPdfBase64(tmpl.pdf_data);
        setPdfFilename(tmpl.pdf_filename);
        setFields(tmpl.fields || []);
        setRequiredAttachments(tmpl.required_attachments || []);
        setExcelWebhookUrl(tmpl.excel_webhook_url || '');
      }
      setLoading(false);
    });
  }, [templateId]);

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      setErrors(p => ({ ...p, pdf: 'Please upload a valid PDF file' }));
      return;
    }
    setErrors(p => { const n = { ...p }; delete n.pdf; return n; });
    setPdfRendered(false);
    setPdfDoc(null);
    setCanvasSize({ width: 0, height: 0 });
    setPdfPageSize({ width: 0, height: 0 });
    setThumbnails({});
    const b64 = await fileToBase64(file);
    setPdfBase64(b64);
    setPdfFilename(file.name);
    if (!name) setName(file.name.replace('.pdf', ''));
    e.target.value = '';
  };

  useEffect(() => {
    if (!pdfBase64) return;
    setPdfRendered(false);
    setPdfRendering(true);
    loadPDF(pdfBase64).then(doc => {
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
    }).catch(() => {
      setPdfRendering(false);
    });
  }, [pdfBase64]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    setPdfRendering(true);
    setPdfRendered(false);

    const renderMain = async () => {
      const size = await renderPageToCanvas(pdfDoc, currentPage, canvasRef.current!, 1.5);
      const page = await pdfDoc.getPage(currentPage);
      const vp1 = page.getViewport({ scale: 1 });
      setPdfPageSize({ width: vp1.width, height: vp1.height });
      setCanvasSize(size);
      setPdfRendered(true);
      setPdfRendering(false);
    };

    renderMain().catch(() => setPdfRendering(false));
  }, [pdfDoc, currentPage]);

  // Generate thumbnails for all pages
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    const canvas = document.createElement('canvas');
    const gen = async () => {
      const newThumbs: Record<number, string> = {};
      for (let p = 1; p <= numPages; p++) {
        await renderPageToCanvas(pdfDoc, p, canvas, 0.2);
        newThumbs[p] = canvas.toDataURL('image/jpeg', 0.7);
      }
      setThumbnails(newThumbs);
    };
    gen().catch(() => {});
  }, [pdfDoc, numPages]);

  const snap = useCallback((v: number) => snapEnabled ? Math.round(v / SNAP_PT) * SNAP_PT : v, [snapEnabled]);

  const ptToScreen = useCallback((pt: number, axis: 'x' | 'y') => {
    if (!pdfPageSize.width || !pdfPageSize.height || !canvasSize.width) return 0;
    return axis === 'x'
      ? (pt / pdfPageSize.width) * canvasSize.width
      : (pt / pdfPageSize.height) * canvasSize.height;
  }, [pdfPageSize, canvasSize]);

  const screenToPt = useCallback((px: number, axis: 'x' | 'y') => {
    if (!pdfPageSize.width || !pdfPageSize.height || !canvasSize.width) return 0;
    return axis === 'x'
      ? (px / canvasSize.width) * pdfPageSize.width
      : (px / canvasSize.height) * pdfPageSize.height;
  }, [pdfPageSize, canvasSize]);

  const addField = (def: FieldDef) => {
    if (!pdfRendered) return;
    fieldCounter++;
    const newField: FormField = {
      id: `field_${Date.now()}_${fieldCounter}`,
      type: def.type,
      label: def.label,
      labelAr: def.labelAr,
      unit: 'pt',
      x: snap(50),
      y: snap(50 + (fields.filter(f => f.page === currentPage).length % 10) * (def.defaultHeight + 10)),
      width: def.defaultWidth,
      height: def.defaultHeight,
      page: currentPage,
      required: def.type !== 'attachment' && def.type !== 'checkbox',
      options: def.type === 'dropdown' || def.type === 'radio' ? [
        { value: 'option1', label: 'Option 1', labelAr: 'خيار 1' },
        { value: 'option2', label: 'Option 2', labelAr: 'خيار 2' },
      ] : undefined,
    };
    setFields(prev => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setFloatingPanel(null);
  };

  const removeField = (id: string) => {
    setFields(prev => {
      const next = prev.filter(f => f.id !== id);
      return next.map(f => {
        if (f.condition?.sourceFieldId === id) return { ...f, condition: undefined };
        return f;
      });
    });
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleDragMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let capturedWidth = 0, capturedHeight = 0, offsetX = 0, offsetY = 0;
    setFields(prev => {
      const field = prev.find(f => f.id === fieldId);
      if (!field) return prev;
      capturedWidth = field.width;
      capturedHeight = field.height;
      offsetX = (e.clientX - rect.left) - ptToScreen(field.x, 'x');
      offsetY = (e.clientY - rect.top) - ptToScreen(field.y, 'y');
      return prev;
    });
    setInteracting('drag');
    setSelectedFieldId(fieldId);
    const onMove = (me: MouseEvent) => {
      const rawX = screenToPt(me.clientX - rect.left - offsetX, 'x');
      const rawY = screenToPt(me.clientY - rect.top - offsetY, 'y');
      const newX = snap(Math.max(0, Math.min(pdfPageSize.width - capturedWidth, rawX)));
      const newY = snap(Math.max(0, Math.min(pdfPageSize.height - capturedHeight, rawY)));
      setFields(prev => prev.map(f => f.id === fieldId ? { ...f, x: newX, y: newY } : f));
    };
    const onUp = () => {
      setInteracting(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [ptToScreen, screenToPt, snap, pdfPageSize]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, fieldId: string, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startScreenX = e.clientX - rect.left;
    const startScreenY = e.clientY - rect.top;
    let origX = 0, origY = 0, origW = 0, origH = 0;
    setFields(prev => {
      const field = prev.find(f => f.id === fieldId);
      if (!field) return prev;
      origX = field.x; origY = field.y; origW = field.width; origH = field.height;
      return prev;
    });
    const MIN_PT = 10;
    setInteracting('resize');
    const onMove = (me: MouseEvent) => {
      const dxPt = screenToPt(me.clientX - rect.left - startScreenX, 'x');
      const dyPt = screenToPt(me.clientY - rect.top - startScreenY, 'y');
      let newX = origX, newY = origY, newW = origW, newH = origH;
      if (handle.includes('e')) newW = Math.max(MIN_PT, snap(origW + dxPt));
      if (handle.includes('w')) { const pw = Math.max(MIN_PT, snap(origW - dxPt)); newX = origX + origW - pw; newW = pw; }
      if (handle.includes('s')) newH = Math.max(MIN_PT, snap(origH + dyPt));
      if (handle.includes('n')) { const ph = Math.max(MIN_PT, snap(origH - dyPt)); newY = origY + origH - ph; newH = ph; }
      setFields(prev => prev.map(f => f.id === fieldId ? { ...f, x: newX, y: newY, width: newW, height: newH } : f));
    };
    const onUp = () => {
      setInteracting(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [screenToPt, snap]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedFieldId) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        removeField(selectedFieldId);
        return;
      }
      if (e.key === 'Escape') {
        setSelectedFieldId(null);
        return;
      }

      const STEP = e.shiftKey ? SNAP_PT * 4 : SNAP_PT;
      const dirs: Record<string, [number, number]> = {
        ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0],
        ArrowUp: [0, -STEP], ArrowDown: [0, STEP],
      };
      if (dirs[e.key]) {
        e.preventDefault();
        const [dx, dy] = dirs[e.key];
        setFields(prev => prev.map(f => {
          if (f.id !== selectedFieldId) return f;
          return {
            ...f,
            x: Math.max(0, Math.min(pdfPageSize.width - f.width, f.x + dx)),
            y: Math.max(0, Math.min(pdfPageSize.height - f.height, f.y + dy)),
          };
        }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFieldId, pdfPageSize, removeField]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Template name is required';
    if (!pdfBase64) errs.pdf = 'Please upload a PDF file';
    if (fields.length === 0) errs.fields = 'Add at least one field to the form';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        name_ar: nameAr.trim(),
        pdf_data: pdfBase64,
        pdf_filename: pdfFilename,
        fields,
        required_attachments: requiredAttachments,
        excel_webhook_url: excelWebhookUrl.trim(),
        is_active: true,
      };
      if (templateId) {
        const { error } = await supabase.from('form_templates').update(payload).eq('id', templateId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('form_templates').insert(payload);
        if (error) throw error;
      }
      navigate('/admin');
    } catch {
      setErrors(p => ({ ...p, _global: 'Something went wrong. Please try again.' }));
    } finally {
      setSaving(false);
    }
  };

  const addRequiredAttachment = () => {
    setRequiredAttachments(prev => [...prev, {
      id: `att_${Date.now()}`,
      label: 'Document',
      labelAr: 'وثيقة',
      required: true,
      accept: '.pdf,.jpg,.jpeg,.png',
    }]);
  };

  const pageFields = fields.filter(f => f.page === currentPage);
  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;

  const filteredDefs = FIELD_DEFS.filter(def => {
    const matchesSearch = !paletteSearch ||
      def.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
      def.labelAr.includes(paletteSearch);
    const matchesCat = !paletteCategory || def.category === paletteCategory;
    return matchesSearch && matchesCat;
  });

  let canvasCursor = 'default';
  if (interacting === 'drag') canvasCursor = 'grabbing';
  else if (interacting === 'resize') canvasCursor = 'crosshair';
  else if (pdfRendered) canvasCursor = 'default';

  const togglePanel = (p: FloatingPanel) => setFloatingPanel(prev => prev === p ? null : p);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeeed] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#222d64', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#e8e8e7' }}>

      {/* TOP HEADER */}
      <header style={{ background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0, zIndex: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 52 }}>
          <button
            onClick={() => navigate('/admin')}
            style={{ padding: '6px', borderRadius: 8, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <ArrowLeft style={{ width: 16, height: 16, transform: isRTL ? 'rotate(180deg)' : undefined }} />
          </button>

          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Template name…"
            style={{ border: `1px solid ${errors.name ? '#f87171' : '#d1d5db'}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, fontWeight: 600, color: '#222d64', width: 180, outline: 'none' }}
          />
          <input
            type="text"
            value={nameAr}
            onChange={e => setNameAr(e.target.value)}
            dir="rtl"
            placeholder="الاسم بالعربية"
            style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 13, color: '#6b7280', width: 150, outline: 'none' }}
          />
          {errors.name && <span style={{ color: '#ef4444', fontSize: 11 }}>{errors.name}</span>}

          <div style={{ flex: 1 }} />

          {/* Snap toggle */}
          <button
            onClick={() => setSnapEnabled(p => !p)}
            title={`Snap to grid ${SNAP_PT}pt (${snapEnabled ? 'on' : 'off'})`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: '1px solid', borderColor: snapEnabled ? '#222d64' : '#d1d5db', background: snapEnabled ? '#222d6412' : 'transparent', color: snapEnabled ? '#222d64' : '#9ca3af', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            <Grid3x3 style={{ width: 13, height: 13 }} />
            Snap {SNAP_PT}pt
          </button>

          {/* Show grid */}
          <button
            onClick={() => setShowGrid(p => !p)}
            title="Toggle grid overlay"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 8, border: '1px solid', borderColor: showGrid ? '#222d64' : '#d1d5db', background: showGrid ? '#222d6412' : 'transparent', color: showGrid ? '#222d64' : '#9ca3af', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            Grid
          </button>

          {pdfBase64 && (
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#222d64', background: '#222d6412', border: 'none', borderRadius: 8, padding: '6px 12px' }}>
              <Upload style={{ width: 14, height: 14 }} />
              Change PDF
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePDFUpload} />
            </label>
          )}

          <button
            onClick={() => togglePanel('docs')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: floatingPanel === 'docs' ? '#222d64' : 'transparent', color: floatingPanel === 'docs' ? 'white' : '#374151', transition: 'all 0.15s' }}
          >
            <Paperclip style={{ width: 14, height: 14 }} />
            Docs{requiredAttachments.length > 0 ? ` (${requiredAttachments.length})` : ''}
          </button>

          <button
            onClick={() => togglePanel('settings')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: floatingPanel === 'settings' ? '#222d64' : 'transparent', color: floatingPanel === 'settings' ? 'white' : '#374151', transition: 'all 0.15s' }}
          >
            <Settings style={{ width: 14, height: 14 }} />
            Settings
          </button>

          {errors._global && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 11, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 10px' }}>
              <AlertCircle style={{ width: 12, height: 12 }} />
              {errors._global}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#222d64', color: 'white', fontWeight: 600, fontSize: 13, padding: '7px 16px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', flexShrink: 0 }}
          >
            <Save style={{ width: 15, height: 15 }} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* LEFT PALETTE */}
        <div style={{ width: floatingPanel === 'palette' ? 220 : 48, flexShrink: 0, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 30, transition: 'width 0.2s ease' }}>
          <button
            onClick={() => togglePanel('palette')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: floatingPanel === 'palette' ? 'space-between' : 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, width: '100%' }}
            title="Field palette"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus style={{ width: 16, height: 16, color: '#222d64', flexShrink: 0 }} />
              {floatingPanel === 'palette' && <span style={{ fontSize: 11, fontWeight: 700, color: '#222d64', whiteSpace: 'nowrap' }}>Add Field</span>}
            </div>
            {floatingPanel === 'palette' && <ChevronLeft style={{ width: 14, height: 14, color: '#9ca3af' }} />}
          </button>

          {floatingPanel === 'palette' && (
            <div style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                type="text"
                value={paletteSearch}
                onChange={e => setPaletteSearch(e.target.value)}
                placeholder="Search fields…"
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <button
                  onClick={() => setPaletteCategory(null)}
                  style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', background: !paletteCategory ? '#222d64' : '#f3f4f6', color: !paletteCategory ? 'white' : '#6b7280' }}
                >All</button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setPaletteCategory(p => p === cat ? null : cat)}
                    style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer', background: paletteCategory === cat ? '#222d64' : '#f3f4f6', color: paletteCategory === cat ? 'white' : '#6b7280' }}
                  >{cat}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {!pdfRendered && floatingPanel === 'palette' && (
              <p style={{ fontSize: 11, color: '#9ca3af', padding: '8px 12px', textAlign: 'center', lineHeight: 1.5 }}>
                {!pdfBase64 ? 'Upload a PDF first' : 'Rendering PDF…'}
              </p>
            )}
            {errors.fields && floatingPanel === 'palette' && (
              <div style={{ margin: '4px 8px', fontSize: 11, color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle style={{ width: 10, height: 10 }} />{errors.fields}
              </div>
            )}
            {filteredDefs.map(def => {
              const clr = COLOR_MAP[def.color] || COLOR_MAP.gray;
              return (
                <button
                  key={def.type}
                  onClick={() => addField(def)}
                  disabled={!pdfBase64 || !pdfRendered}
                  title={def.label}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: floatingPanel === 'palette' ? '6px 12px' : '7px 0', justifyContent: floatingPanel === 'palette' ? 'flex-start' : 'center', background: 'none', border: 'none', cursor: !pdfBase64 || !pdfRendered ? 'not-allowed' : 'pointer', opacity: !pdfBase64 || !pdfRendered ? 0.4 : 1, transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (pdfRendered) e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: clr.bg, color: clr.text }}>
                    <def.icon style={{ width: 13, height: 13 }} />
                  </div>
                  {floatingPanel === 'palette' && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {floatingPanel === 'palette' && fields.length > 0 && (
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px', flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', padding: '0 4px 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {fields.length} field{fields.length !== 1 ? 's' : ''}
              </p>
              <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {fields.map(field => {
                  const def = FIELD_DEFS.find(d => d.type === field.type) || FIELD_DEFS[0];
                  const clr = COLOR_MAP[def.color] || COLOR_MAP.gray;
                  const isSel = selectedFieldId === field.id;
                  return (
                    <div
                      key={field.id}
                      onClick={() => { setSelectedFieldId(isSel ? null : field.id); setCurrentPage(field.page); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 4px', borderRadius: 6, cursor: 'pointer', background: isSel ? '#222d6410' : 'transparent' }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: clr.bg, color: clr.text }}>
                        <def.icon style={{ width: 10, height: 10 }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#4b5563', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.label}</span>
                      {numPages > 1 && <span style={{ fontSize: 9, color: '#9ca3af', background: '#f3f4f6', borderRadius: 3, padding: '1px 4px' }}>p{field.page}</span>}
                      <button
                        onClick={e => { e.stopPropagation(); removeField(field.id); }}
                        style={{ padding: 2, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', borderRadius: 4, display: 'flex', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; }}
                      >
                        <X style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* PDF CANVAS AREA */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {!pdfBase64 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', padding: 32 }}>
              <label
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 480, height: 380, border: '2px dashed #222d6440', borderRadius: 16, cursor: 'pointer', background: 'white', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <div style={{ width: 64, height: 64, borderRadius: 16, background: '#222d6415', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Upload style={{ width: 32, height: 32, color: '#222d64' }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#222d64' }}>Upload PDF Document</span>
                <span style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Click to browse or drag and drop</span>
                <span style={{ fontSize: 11, color: '#d1d5db', marginTop: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 12px' }}>PDF only · Multi-page supported</span>
                {errors.pdf && <span style={{ color: '#ef4444', fontSize: 11, marginTop: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px' }}>{errors.pdf}</span>}
                <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePDFUpload} />
              </label>
            </div>
          ) : (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* Ruler + Canvas */}
              <div style={{ position: 'relative' }}>
                {/* Top ruler */}
                {pdfRendered && pdfPageSize.width > 0 && (
                  <div style={{ position: 'absolute', top: -20, left: 0, width: canvasSize.width, height: 20, overflow: 'hidden', pointerEvents: 'none' }}>
                    <canvas
                      width={canvasSize.width}
                      height={20}
                      style={{ display: 'block' }}
                      ref={el => {
                        if (!el) return;
                        const ctx = el.getContext('2d')!;
                        ctx.clearRect(0, 0, el.width, 20);
                        ctx.fillStyle = '#f3f4f6';
                        ctx.fillRect(0, 0, el.width, 20);
                        ctx.fillStyle = '#9ca3af';
                        ctx.font = '8px monospace';
                        ctx.textAlign = 'center';
                        const step = 50;
                        for (let pt = 0; pt <= pdfPageSize.width; pt += step) {
                          const sx = (pt / pdfPageSize.width) * canvasSize.width;
                          ctx.fillRect(sx, pt % 100 === 0 ? 10 : 14, 1, pt % 100 === 0 ? 10 : 6);
                          if (pt % 100 === 0 && pt > 0) ctx.fillText(`${pt}`, sx, 9);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Left ruler */}
                {pdfRendered && pdfPageSize.height > 0 && (
                  <div style={{ position: 'absolute', top: 0, left: -20, width: 20, height: canvasSize.height, overflow: 'hidden', pointerEvents: 'none' }}>
                    <canvas
                      width={20}
                      height={canvasSize.height}
                      style={{ display: 'block' }}
                      ref={el => {
                        if (!el) return;
                        const ctx = el.getContext('2d')!;
                        ctx.clearRect(0, 0, 20, el.height);
                        ctx.fillStyle = '#f3f4f6';
                        ctx.fillRect(0, 0, 20, el.height);
                        ctx.fillStyle = '#9ca3af';
                        ctx.font = '8px monospace';
                        const step = 50;
                        for (let pt = 0; pt <= pdfPageSize.height; pt += step) {
                          const sy = (pt / pdfPageSize.height) * canvasSize.height;
                          ctx.fillRect(pt % 100 === 0 ? 10 : 14, sy, pt % 100 === 0 ? 10 : 6, 1);
                        }
                      }}
                    />
                  </div>
                )}

                <div style={{ position: 'relative', lineHeight: 0, display: 'inline-block', marginTop: 20, marginLeft: 20 }}>
                  {pdfRendering && !pdfRendered && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', zIndex: 30, minHeight: 400, minWidth: 300, borderRadius: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, border: '2px solid #222d64', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <p style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>Rendering PDF…</p>
                      </div>
                    </div>
                  )}

                  <canvas
                    ref={canvasRef}
                    style={{ display: 'block', visibility: pdfRendered ? 'visible' : 'hidden', borderRadius: 8, boxShadow: '0 4px 32px rgba(0,0,0,0.16)', border: '1px solid #e5e7eb' }}
                  />

                  {/* Grid overlay */}
                  {pdfRendered && showGrid && pdfPageSize.width > 0 && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 8, overflow: 'hidden' }}>
                      <svg width={canvasSize.width} height={canvasSize.height} style={{ position: 'absolute', top: 0, left: 0 }}>
                        {Array.from({ length: Math.floor(pdfPageSize.width / SNAP_PT) + 1 }, (_, i) => {
                          const x = (i * SNAP_PT / pdfPageSize.width) * canvasSize.width;
                          return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={canvasSize.height} stroke="#222d6418" strokeWidth={i % 8 === 0 ? 1 : 0.5} />;
                        })}
                        {Array.from({ length: Math.floor(pdfPageSize.height / SNAP_PT) + 1 }, (_, i) => {
                          const y = (i * SNAP_PT / pdfPageSize.height) * canvasSize.height;
                          return <line key={`h${i}`} x1={0} y1={y} x2={canvasSize.width} y2={y} stroke="#222d6418" strokeWidth={i % 8 === 0 ? 1 : 0.5} />;
                        })}
                      </svg>
                    </div>
                  )}

                  {pdfRendered && (
                    <div
                      ref={containerRef}
                      style={{ position: 'absolute', top: 0, left: 0, width: canvasSize.width, height: canvasSize.height, cursor: canvasCursor, pointerEvents: 'auto' }}
                      onClick={e => { if (interacting) return; if (e.target === containerRef.current) setSelectedFieldId(null); }}
                    >
                      {pageFields.map(field => (
                        <FieldOverlay
                          key={field.id}
                          field={field}
                          isSelected={selectedFieldId === field.id}
                          onSelect={() => setSelectedFieldId(field.id)}
                          onDragStart={e => handleDragMouseDown(e, field.id)}
                          onResizeStart={(e, handle) => handleResizeMouseDown(e, field.id, handle)}
                          onLabelChange={label => updateField(field.id, { label })}
                          interacting={interacting}
                          ptToScreen={ptToScreen}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Page navigation with thumbnails */}
              {numPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: 4, borderRadius: 8, border: 'none', background: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1, display: 'flex' }}>
                    <ChevronLeft style={{ width: 16, height: 16 }} />
                  </button>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {Array.from({ length: numPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px', borderRadius: 8, border: currentPage === i + 1 ? '2px solid #222d64' : '2px solid transparent', cursor: 'pointer', background: 'transparent', transition: 'border-color 0.15s' }}
                      >
                        {thumbnails[i + 1] ? (
                          <img
                            src={thumbnails[i + 1]}
                            alt={`Page ${i + 1}`}
                            style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4, display: 'block', background: '#f3f4f6' }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 56, borderRadius: 4, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>{i + 1}</span>
                          </div>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, color: currentPage === i + 1 ? '#222d64' : '#9ca3af' }}>{i + 1}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages} style={{ padding: 4, borderRadius: 8, border: 'none', background: 'none', cursor: currentPage === numPages ? 'not-allowed' : 'pointer', opacity: currentPage === numPages ? 0.3 : 1, display: 'flex' }}>
                    <ChevronRight style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              )}

              {pdfRendered && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9ca3af', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '6px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <Move style={{ width: 12, height: 12, flexShrink: 0 }} />
                  Drag to move · Handles to resize · Double-click to rename · Arrow keys nudge · Del removes
                  {pdfPageSize.width > 0 && (
                    <span style={{ marginLeft: 8, background: '#f3f4f6', borderRadius: 4, padding: '2px 6px' }}>
                      {Math.round(pdfPageSize.width)} × {Math.round(pdfPageSize.height)} pt
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SETTINGS OVERLAY */}
        {floatingPanel === 'settings' && (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, background: 'white', borderLeft: '1px solid #e5e7eb', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 40, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#222d64' }}>Settings</span>
              <button onClick={() => setFloatingPanel(null)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Template Info</p>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Template Name (English) *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', border: `1px solid ${errors.name ? '#f87171' : '#d1d5db'}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} placeholder="e.g. Permission Slip" />
                  {errors.name && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{errors.name}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Template Name (Arabic)</label>
                  <input type="text" value={nameAr} onChange={e => setNameAr(e.target.value)} dir="rtl" style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} placeholder="مثال: نموذج إذن" />
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Link2 style={{ width: 12, height: 12, color: '#16a34a' }} />
                  Excel / Power Automate
                </p>
                <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5, marginBottom: 10 }}>Paste a Power Automate webhook URL to add rows to Excel Online on submission.</p>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Webhook URL</label>
                <input type="url" value={excelWebhookUrl} onChange={e => setExcelWebhookUrl(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 10, padding: '8px 12px', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} placeholder="https://prod-xx.westus.logic.azure.com/..." />
              </div>
            </div>
          </div>
        )}

        {/* DOCS OVERLAY */}
        {floatingPanel === 'docs' && (
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, background: 'white', borderLeft: '1px solid #e5e7eb', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 40, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#222d64' }}>Required Documents</span>
              <button onClick={() => setFloatingPanel(null)} style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>Define documents parents must upload when submitting this form.</p>
              <button
                onClick={addRequiredAttachment}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#222d64', background: '#222d6410', border: '1px solid #222d6030', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', width: '100%' }}
              >
                <Plus style={{ width: 16, height: 16 }} />
                Add Required Document
              </button>
              {requiredAttachments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <Paperclip style={{ width: 32, height: 32, color: '#e5e7eb', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 12, color: '#9ca3af' }}>No required attachments defined</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {requiredAttachments.map((att, i) => (
                    <div key={att.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#f9fafb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Document {i + 1}</span>
                        <button onClick={() => setRequiredAttachments(prev => prev.filter(a => a.id !== att.id))} style={{ padding: 4, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', display: 'flex' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>Label (EN)</label>
                          <input type="text" value={att.label} onChange={e => setRequiredAttachments(prev => prev.map(a => a.id === att.id ? { ...a, label: e.target.value } : a))} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', background: 'white', boxSizing: 'border-box' }} placeholder="e.g. ID Card" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>Label (AR)</label>
                          <input type="text" dir="rtl" value={att.labelAr} onChange={e => setRequiredAttachments(prev => prev.map(a => a.id === att.id ? { ...a, labelAr: e.target.value } : a))} style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', background: 'white', boxSizing: 'border-box' }} placeholder="بطاقة الهوية" />
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={att.required} onChange={e => setRequiredAttachments(prev => prev.map(a => a.id === att.id ? { ...a, required: e.target.checked } : a))} style={{ width: 14, height: 14 }} />
                        <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>Required</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SELECTED FIELD BOTTOM PANEL */}
      {selectedField && (
        <div style={{ background: 'white', borderTop: '2px solid #222d6430', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 40, flexShrink: 0, maxHeight: '44vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            {(() => {
              const def = FIELD_DEFS.find(d => d.type === selectedField.type) || FIELD_DEFS[0];
              const clr = COLOR_MAP[def.color] || COLOR_MAP.gray;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: clr.bg, color: clr.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <def.icon style={{ width: 13, height: 13 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#222d64' }}>{selectedField.label}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 4, padding: '2px 6px' }}>{selectedField.type}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>page {selectedField.page}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                    {Math.round(selectedField.x)},{Math.round(selectedField.y)} · {Math.round(selectedField.width)}×{Math.round(selectedField.height)} pt
                  </span>
                </div>
              );
            })()}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => removeField(selectedField.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
                Delete
              </button>
              <button
                onClick={() => setSelectedFieldId(null)}
                style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <FieldEditor
              field={selectedField}
              allFields={fields}
              onChange={updates => updateField(selectedField.id, updates)}
            />
          </div>
        </div>
      )}

      {/* hidden canvas for thumbnails */}
      <canvas ref={thumbCanvasRef} style={{ display: 'none' }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function FieldOverlay({
  field, isSelected, onSelect, onDragStart, onResizeStart, onLabelChange, interacting, ptToScreen
}: {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent, handle: ResizeHandle) => void;
  onLabelChange: (label: string) => void;
  interacting: 'drag' | 'resize' | null;
  ptToScreen: (pt: number, axis: 'x' | 'y') => number;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const def = FIELD_DEFS.find(d => d.type === field.type) || FIELD_DEFS[0];
  const clr = COLOR_MAP[def.color] || COLOR_MAP.gray;
  const hasCondition = !!field.condition;
  const HANDLE_SIZE = 8;

  const screenX = ptToScreen(field.x, 'x');
  const screenY = ptToScreen(field.y, 'y');
  const screenW = ptToScreen(field.width, 'x');
  const screenH = ptToScreen(field.height, 'y');

  const handles: { id: ResizeHandle; style: React.CSSProperties }[] = [
    { id: 'nw', style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { id: 'n',  style: { top: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' } },
    { id: 'ne', style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { id: 'e',  style: { top: '50%', right: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' } },
    { id: 'se', style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 } },
    { id: 's',  style: { bottom: -HANDLE_SIZE / 2, left: '50%', transform: 'translateX(-50%)' } },
    { id: 'sw', style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2 } },
    { id: 'w',  style: { top: '50%', left: -HANDLE_SIZE / 2, transform: 'translateY(-50%)' } },
  ];

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) { onSelect(); return; }
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  };

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [editing]);

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        border: `2px solid ${isSelected ? clr.border : clr.border + '99'}`,
        backgroundColor: isSelected ? clr.bg + 'cc' : clr.bg + '88',
        borderRadius: 3,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: '0 4px',
        overflow: 'hidden',
        zIndex: isSelected ? 20 : 10,
        boxShadow: isSelected ? `0 0 0 2px ${clr.border}40, 0 2px 8px rgba(0,0,0,0.15)` : undefined,
        transition: interacting ? 'none' : 'border-color 0.15s, background-color 0.15s',
      }}
      onMouseDown={e => { if (!editing) onDragStart(e); }}
      onClick={e => { e.stopPropagation(); if (!editing) onSelect(); }}
      onDoubleClick={startEditing}
    >
      <GripVertical style={{ width: 9, height: 9, flexShrink: 0, opacity: 0.4, color: clr.text }} />
      <def.icon style={{ width: 9, height: 9, flexShrink: 0, color: clr.text }} />

      {editing ? (
        <input
          ref={inputRef}
          defaultValue={field.label}
          onBlur={e => { onLabelChange(e.target.value); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              onLabelChange((e.target as HTMLInputElement).value);
              setEditing(false);
            }
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          autoFocus
          style={{
            flex: 1, fontSize: 9, fontWeight: 600, color: clr.text,
            background: 'white', border: `1px solid ${clr.border}`,
            borderRadius: 3, padding: '1px 4px', outline: 'none', minWidth: 0,
          }}
        />
      ) : (
        <span style={{ fontSize: 9, fontWeight: 600, color: clr.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {field.label}
        </span>
      )}

      {!editing && field.linkedGroup && <Link2 style={{ width: 7, height: 7, flexShrink: 0, opacity: 0.6, color: clr.text }} />}
      {!editing && hasCondition && <GitBranch style={{ width: 7, height: 7, flexShrink: 0, opacity: 0.5, color: clr.text }} />}
      {!editing && field.required && <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 9, flexShrink: 0 }}>*</span>}

      {isSelected && !editing && handles.map(h => (
        <div
          key={h.id}
          onMouseDown={e => { e.stopPropagation(); onResizeStart(e, h.id); }}
          style={{
            position: 'absolute', width: HANDLE_SIZE, height: HANDLE_SIZE,
            backgroundColor: 'white', border: `2px solid ${clr.border}`,
            borderRadius: 2, cursor: HANDLE_CURSORS[h.id], zIndex: 40, ...h.style,
          }}
        />
      ))}
    </div>
  );
}

function FieldEditor({ field, allFields, onChange }: {
  field: FormField;
  allFields: FormField[];
  onChange: (updates: Partial<FormField>) => void;
}) {
  const otherFields = allFields.filter(f => f.id !== field.id);
  const def = FIELD_DEFS.find(d => d.type === field.type) || FIELD_DEFS[0];
  const clr = COLOR_MAP[def.color] || COLOR_MAP.gray;

  const addOption = () => {
    const opts = field.options || [];
    onChange({ options: [...opts, { value: `opt${opts.length + 1}`, label: `Option ${opts.length + 1}`, labelAr: `خيار ${opts.length + 1}` }] });
  };

  const updateOption = (idx: number, key: keyof DropdownOption, val: string) => {
    const opts = [...(field.options || [])];
    opts[idx] = { ...opts[idx], [key]: val };
    onChange({ options: opts });
  };

  const removeOption = (idx: number) => {
    onChange({ options: (field.options || []).filter((_, i) => i !== idx) });
  };

  const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 12, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>

      {/* Labels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Labels</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>EN</label>
            <input type="text" value={field.label} onChange={e => onChange({ label: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>AR</label>
            <input type="text" dir="rtl" value={field.labelAr} onChange={e => onChange({ labelAr: e.target.value })} style={inputStyle} />
          </div>
        </div>
        {(field.type === 'text' || field.type === 'textarea' || field.type === 'email' || field.type === 'phone' || field.type === 'fullName' || field.type === 'company' || field.type === 'title') && (
          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>Placeholder (EN)</label>
            <input type="text" value={field.placeholder || ''} onChange={e => onChange({ placeholder: e.target.value })} style={inputStyle} placeholder="Enter placeholder…" />
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={field.required} onChange={e => onChange({ required: e.target.checked })} style={{ width: 14, height: 14 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Required</span>
        </label>
      </div>

      {/* Position & Size in PDF points */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 190 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Position & Size (pt)</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {([['X (pt)', 'x'], ['Y (pt)', 'y'], ['W (pt)', 'width'], ['H (pt)', 'height']] as [string, keyof FormField][]).map(([lbl, key]) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>{lbl}</label>
              <input
                type="number"
                value={Math.round(field[key] as number)}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange({ [key]: v }); }}
                style={inputStyle}
                step="1"
                min={key === 'width' || key === 'height' ? '10' : '0'}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: clr.bg, border: `1px solid ${clr.border}40`, borderRadius: 8, padding: '6px 10px' }}>
          <def.icon style={{ width: 13, height: 13, color: clr.text, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: clr.text }}>{field.type}</span>
          <span style={{ fontSize: 10, color: clr.text, opacity: 0.6, marginLeft: 'auto', fontFamily: 'monospace' }}>
            {Math.round(field.width)}×{Math.round(field.height)}pt
          </span>
        </div>
      </div>

      {/* Number field: min/max */}
      {field.type === 'number' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Constraints</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>Min</label>
              <input type="number" value={field.minValue ?? ''} onChange={e => onChange({ minValue: e.target.value === '' ? undefined : parseFloat(e.target.value) })} style={inputStyle} placeholder="—" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: '#9ca3af', marginBottom: 3 }}>Max</label>
              <input type="number" value={field.maxValue ?? ''} onChange={e => onChange({ maxValue: e.target.value === '' ? undefined : parseFloat(e.target.value) })} style={inputStyle} placeholder="—" />
            </div>
          </div>
        </div>
      )}

      {/* Radio group */}
      {field.type === 'radio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Radio Group</p>
          <input type="text" value={field.radioGroup || ''} onChange={e => onChange({ radioGroup: e.target.value })} style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="e.g. group_gender" />
          <p style={{ fontSize: 10, color: '#6b7280', margin: 0, lineHeight: 1.5 }}>Radios with the same group ID are mutually exclusive.</p>
        </div>
      )}

      {/* Dropdown / Radio options */}
      {(field.type === 'dropdown' || field.type === 'radio') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Options</p>
            <button onClick={addOption} style={{ fontSize: 11, fontWeight: 600, color: '#222d64', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Plus style={{ width: 12, height: 12 }} /> Add
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
            {(field.options || []).map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="text" value={opt.label} onChange={e => updateOption(i, 'label', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Label EN" />
                <input type="text" dir="rtl" value={opt.labelAr} onChange={e => updateOption(i, 'labelAr', e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="AR" />
                <button onClick={() => removeOption(i)} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', display: 'flex' }} onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')} onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Group */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link2 style={{ width: 11, height: 11, color: '#222d64' }} />
            Linked Field
          </p>
          {field.linkedGroup ? (
            <button onClick={() => onChange({ linkedGroup: undefined })} style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Unlink</button>
          ) : (
            <button onClick={() => onChange({ linkedGroup: `group_${Date.now()}` })} style={{ fontSize: 11, fontWeight: 600, color: '#222d64', background: 'none', border: 'none', cursor: 'pointer' }}>Link</button>
          )}
        </div>
        {field.linkedGroup ? (
          <>
            <input type="text" value={field.linkedGroup} onChange={e => onChange({ linkedGroup: e.target.value })} style={{ ...inputStyle, fontFamily: 'monospace' }} placeholder="e.g. group_parentName" />
            <p style={{ fontSize: 10, color: '#3b82f6', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 8px', margin: 0, lineHeight: 1.5 }}>
              Fields with the same Group ID auto-fill together.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.5, margin: 0 }}>Enable to sync this field with repeated copies across pages.</p>
        )}

        {/* Conditional Logic */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <GitBranch style={{ width: 11, height: 11, color: '#222d64' }} />
              Condition
            </p>
            {field.condition ? (
              <button onClick={() => onChange({ condition: undefined })} style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
            ) : (
              <button onClick={() => otherFields.length > 0 && onChange({ condition: { sourceFieldId: otherFields[0].id, operator: 'equals', value: '' } })} disabled={otherFields.length === 0} style={{ fontSize: 11, fontWeight: 600, color: '#222d64', background: 'none', border: 'none', cursor: otherFields.length === 0 ? 'not-allowed' : 'pointer', opacity: otherFields.length === 0 ? 0.4 : 1 }}>Add</button>
            )}
          </div>
          {field.condition && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#222d64', margin: 0 }}>Show when:</p>
              <select value={field.condition.sourceFieldId} onChange={e => onChange({ condition: { ...field.condition!, sourceFieldId: e.target.value } })} style={{ ...inputStyle, background: 'white' }}>
                {otherFields.map(f => <option key={f.id} value={f.id}>{f.label} (p.{f.page})</option>)}
              </select>
              <select value={field.condition.operator} onChange={e => onChange({ condition: { ...field.condition!, operator: e.target.value as ConditionalRule['operator'] } })} style={{ ...inputStyle, background: 'white' }}>
                <option value="equals">equals</option>
                <option value="not_equals">does not equal</option>
                <option value="contains">contains</option>
                <option value="is_empty">is empty</option>
                <option value="is_not_empty">is not empty</option>
              </select>
              {field.condition.operator !== 'is_empty' && field.condition.operator !== 'is_not_empty' && (
                <input type="text" value={field.condition.value} onChange={e => onChange({ condition: { ...field.condition!, value: e.target.value } })} style={{ ...inputStyle, background: 'white' }} placeholder="e.g. Yes, true" />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 8px' }}>
                <EyeOff style={{ width: 12, height: 12, color: '#d97706', flexShrink: 0 }} />
                <p style={{ fontSize: 10, color: '#92400e', margin: 0 }}>Only required when visible.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}