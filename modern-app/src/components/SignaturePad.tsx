import { useRef, useEffect, useCallback, useState } from 'react';
import { PenLine, Type, Upload, X, RefreshCw, Check } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type SignatureTab = 'draw' | 'type' | 'upload';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  onClose?: () => void;
  existingData?: string | null;
}

export default function SignaturePad({ onSave, onClear, onClose, existingData }: SignaturePadProps) {
  const { isRTL } = useLanguage();
  const [tab, setTab] = useState<SignatureTab>('draw');

  const handleConfirm = (dataUrl: string) => {
    onSave(dataUrl);
    onClose?.();
  };

  const tabs: { id: SignatureTab; label: string; labelAr: string; icon: typeof PenLine }[] = [
    { id: 'draw', label: 'Draw', labelAr: 'ارسم', icon: PenLine },
    { id: 'type', label: 'Type', labelAr: 'اكتب', icon: Type },
    { id: 'upload', label: 'Upload', labelAr: 'رفع', icon: Upload },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 bg-gray-50">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-b-2 ${
              tab === t.id
                ? 'border-[#222d64] text-[#222d64] bg-white'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {isRTL ? t.labelAr : t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'draw' && (
          <DrawTab
            existingData={existingData}
            onConfirm={handleConfirm}
            onClear={onClear}
            isRTL={isRTL}
          />
        )}
        {tab === 'type' && (
          <TypeTab onConfirm={handleConfirm} isRTL={isRTL} />
        )}
        {tab === 'upload' && (
          <UploadTab onConfirm={handleConfirm} isRTL={isRTL} />
        )}
      </div>
    </div>
  );
}

/* ─── Draw Tab ─── */
function DrawTab({
  existingData,
  onConfirm,
  onClear,
  isRTL,
}: {
  existingData?: string | null;
  onConfirm: (url: string) => void;
  onClear?: () => void;
  isRTL: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!existingData);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const CANVAS_W = 380;
  const CANVAS_H = 160;

  useEffect(() => {
    if (existingData && canvasRef.current) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current!.getContext('2d')!;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        setIsEmpty(false);
      };
      img.src = existingData;
    }
  }, [existingData]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setIsEmpty(false);
    lastPos.current = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const pos = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleClear = () => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setIsEmpty(true);
    onClear?.();
  };

  const handleConfirm = () => {
    if (!canvasRef.current || isEmpty) return;
    onConfirm(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400 text-center">
        {isRTL ? 'ارسم توقيعك في المربع أدناه' : 'Draw your signature in the box below'}
      </p>
      <div className="relative border-2 border-dashed border-gray-200 rounded-xl bg-white overflow-hidden cursor-crosshair hover:border-[#222d64]/40 transition-colors">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%', height: 'auto', touchAction: 'none' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <PenLine className="w-6 h-6 text-gray-200 mx-auto mb-1" />
              <p className="text-gray-300 text-sm">{isRTL ? 'وقّع هنا' : 'Sign here'}</p>
            </div>
          </div>
        )}
      </div>
      <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {!isEmpty && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isRTL ? 'مسح' : 'Clear'}
          </button>
        )}
        <button
          onClick={handleConfirm}
          disabled={isEmpty}
          className="ms-auto flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
          style={{ backgroundColor: '#222d64' }}
        >
          <Check className="w-4 h-4" />
          {isRTL ? 'حفظ التوقيع' : 'Save Signature'}
        </button>
      </div>
    </div>
  );
}

/* ─── Type Tab ─── */
function TypeTab({ onConfirm, isRTL }: { onConfirm: (url: string) => void; isRTL: boolean }) {
  const [name, setName] = useState('');
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!name.trim()) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fontSize = Math.min(52, Math.max(28, 380 / (name.length * 0.6)));
    ctx.font = `${fontSize}px 'Dancing Script', cursive`;
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  }, [name]);

  const handleConfirm = () => {
    if (!name.trim() || !previewRef.current) return;
    onConfirm(previewRef.current.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400 text-center">
        {isRTL ? 'اكتب اسمك وسيظهر كتوقيع' : 'Type your name and it will appear as a signature'}
      </p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={isRTL ? 'اكتب اسمك هنا…' : 'Type your full name…'}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-gray-50"
        style={{ '--tw-ring-color': '#222d64' } as React.CSSProperties}
      />
      <div className="border-2 border-dashed border-gray-200 rounded-xl bg-white overflow-hidden" style={{ minHeight: 100 }}>
        {name.trim() ? (
          <canvas
            ref={previewRef}
            width={380}
            height={120}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        ) : (
          <div className="flex items-center justify-center h-24">
            <p className="text-gray-300 text-sm italic">{isRTL ? 'معاينة التوقيع' : 'Signature preview'}</p>
          </div>
        )}
      </div>
      <button
        onClick={handleConfirm}
        disabled={!name.trim()}
        className="flex items-center justify-center gap-2 w-full text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        style={{ backgroundColor: '#222d64' }}
      >
        <Check className="w-4 h-4" />
        {isRTL ? 'استخدام هذا التوقيع' : 'Use This Signature'}
      </button>
    </div>
  );
}

/* ─── Upload Tab ─── */
function UploadTab({ onConfirm, isRTL }: { onConfirm: (url: string) => void; isRTL: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-400 text-center">
        {isRTL ? 'ارفع صورة توقيعك' : 'Upload an image of your signature'}
      </p>
      <div
        className={`border-2 border-dashed rounded-xl transition-colors cursor-pointer ${dragOver ? 'border-[#222d64] bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-[#222d64]/40'}`}
        style={{ minHeight: 130 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {preview ? (
          <div className="relative p-3">
            <img src={preview} alt="signature preview" className="max-h-28 mx-auto object-contain" />
            <button
              className="absolute top-2 right-2 p-1 rounded-full bg-white shadow text-gray-400 hover:text-red-500 transition-colors"
              onClick={e => { e.stopPropagation(); setPreview(null); }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-28 gap-2">
            <Upload className="w-6 h-6 text-gray-300" />
            <p className="text-sm text-gray-400">{isRTL ? 'انقر أو اسحب الصورة هنا' : 'Click or drag image here'}</p>
            <p className="text-xs text-gray-300">PNG, JPG, SVG</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
      <button
        onClick={() => preview && onConfirm(preview)}
        disabled={!preview}
        className="flex items-center justify-center gap-2 w-full text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
        style={{ backgroundColor: '#222d64' }}
      >
        <Check className="w-4 h-4" />
        {isRTL ? 'استخدام هذا التوقيع' : 'Use This Signature'}
      </button>
    </div>
  );
}
