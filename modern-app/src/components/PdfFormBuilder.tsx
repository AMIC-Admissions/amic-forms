import PdfFormBuilder from "./components/PdfFormBuilder";

export default function App() {
  return <PdfFormBuilder />;
} 
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// مهم جدًا
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const FIELD_DEFAULTS = {
  text: { width: 180, height: 24, label: "Text Field" },
  email: { width: 220, height: 24, label: "Email Address" },
  phone: { width: 180, height: 24, label: "Phone Number" },
  date: { width: 150, height: 24, label: "Date" },
  checkbox: { width: 14, height: 14, label: "Checkbox" },
  signature: { width: 220, height: 50, label: "Signature" },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyField(type, pageNumber) {
  const d = FIELD_DEFAULTS[type] || FIELD_DEFAULTS.text;
  return {
    id: uid(),
    type,
    label: d.label,
    linkedKey: "",
    required: false,
    pageNumber,
    x: 40,
    y: 40,
    width: d.width,
    height: d.height,
    value: "",
  };
}

export default function PdfFormBuilder() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState([]); // [{ pageNumber, width, height, dataUrl }]
  const [currentPage, setCurrentPage] = useState(1);
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scale] = useState(1.4);

  const fileInputRef = useRef(null);

  const currentPageFields = useMemo(
    () => fields.filter((f) => f.pageNumber === currentPage),
    [fields, currentPage]
  );

  useEffect(() => {
    if (!pdfFile) return;

    let revokedUrl = null;

    async function loadPdf() {
      try {
        setLoading(true);
        const arrayBuffer = await pdfFile.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setPageCount(doc.numPages);

        const renderedPages = [];
        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
          const page = await doc.getPage(pageNumber);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { alpha: false });
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const dataUrl = canvas.toDataURL("image/png");
          renderedPages.push({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            dataUrl,
          });
        }

        setPages(renderedPages);
        setCurrentPage(1);
      } catch (error) {
        console.error("PDF load/render error:", error);
        alert("فشل في تحميل ملف PDF. جربي ملف آخر أو أعيدي حفظه كـ PDF.");
      } finally {
        setLoading(false);
        if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      }
    }

    loadPdf();
  }, [pdfFile, scale]);

  const currentPageMeta = pages.find((p) => p.pageNumber === currentPage);

  function updateField(fieldId, patch) {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, ...patch } : f))
    );
  }

  function deleteField(fieldId) {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  }

  function addField(type) {
    if (!currentPageMeta) {
      alert("ارفعي ملف PDF أولًا");
      return;
    }
    const field = emptyField(type, currentPage);
    if (type === "checkbox") {
      field.value = false;
    }
    setFields((prev) => [...prev, field]);
    setSelectedFieldId(field.id);
  }

  function onFieldValueChange(fieldId, nextValue) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    if (field.linkedKey && field.linkedKey.trim()) {
      setFields((prev) =>
        prev.map((f) =>
          f.linkedKey === field.linkedKey ? { ...f, value: nextValue } : f
        )
      );
    } else {
      updateField(fieldId, { value: nextValue });
    }
  }

  return (
    <div style={styles.app}>
      <div style={styles.topBar}>
        <div style={styles.leftTools}>
          <button style={styles.primaryBtn} onClick={() => fileInputRef.current?.click()}>
            رفع PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPdfFile(file);
            }}
          />
          <button style={styles.toolBtn} onClick={() => addField("text")}>Text</button>
          <button style={styles.toolBtn} onClick={() => addField("email")}>Email</button>
          <button style={styles.toolBtn} onClick={() => addField("phone")}>Phone</button>
          <button style={styles.toolBtn} onClick={() => addField("date")}>Date</button>
          <button style={styles.toolBtn} onClick={() => addField("checkbox")}>Checkbox</button>
          <button style={styles.toolBtn} onClick={() => addField("signature")}>Signature</button>
        </div>

        <div style={styles.rightTools}>
          <button
            style={styles.toolBtn}
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </button>
          <div style={styles.pageInfo}>
            صفحة {currentPage} / {pageCount || 0}
          </div>
          <button
            style={styles.toolBtn}
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
          >
            التالي
          </button>
        </div>
      </div>

      <div style={styles.body}>
        <div style={styles.canvasWrap}>
          {loading && <div style={styles.loading}>جاري تحميل الـ PDF...</div>}

          {!loading && currentPageMeta && (
            <div
              style={{
                ...styles.pageStage,
                width: currentPageMeta.width,
                height: currentPageMeta.height,
              }}
            >
              <img
                src={currentPageMeta.dataUrl}
                alt={`PDF page ${currentPage}`}
                style={{
                  width: currentPageMeta.width,
                  height: currentPageMeta.height,
                  display: "block",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  ...styles.overlay,
                  width: currentPageMeta.width,
                  height: currentPageMeta.height,
                }}
              >
                {currentPageFields.map((field) => (
                  <Rnd
                    key={field.id}
                    size={{ width: field.width, height: field.height }}
                    position={{ x: field.x, y: field.y }}
                    bounds="parent"
                    minWidth={field.type === "checkbox" ? 1 : 18}
                    minHeight={field.type === "checkbox" ? 1 : 18}
                    onDragStop={(e, d) => {
                      updateField(field.id, { x: d.x, y: d.y });
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      updateField(field.id, {
                        width: parseInt(ref.style.width, 10),
                        height: parseInt(ref.style.height, 10),
                        x: position.x,
                        y: position.y,
                      });
                    }}
                    onClick={() => setSelectedFieldId(field.id)}
                    style={{
                      ...styles.fieldBox,
                      ...(selectedFieldId === field.id ? styles.fieldSelected : {}),
                    }}
                    enableResizing={
                      field.type === "checkbox"
                        ? {
                            bottomRight: true,
                            bottomLeft: true,
                            topRight: true,
                            topLeft: true,
                          }
                        : true
                    }
                  >
                    <FieldPreview
                      field={field}
                      onChange={(v) => onFieldValueChange(field.id, v)}
                    />
                  </Rnd>
                ))}
              </div>
            </div>
          )}

          {!loading && !currentPageMeta && (
            <div style={styles.emptyState}>ارفعي ملف PDF لبدء التصميم</div>
          )}
        </div>

        <div style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>خصائص الحقل</h3>

          {!selectedFieldId ? (
            <div style={styles.muted}>اختاري حقلًا للتعديل</div>
          ) : (
            <FieldEditor
              field={fields.find((f) => f.id === selectedFieldId)}
              onPatch={(patch) => updateField(selectedFieldId, patch)}
              onDelete={() => deleteField(selectedFieldId)}
            />
          )}

          <div style={{ marginTop: 24 }}>
            <h3 style={styles.sidebarTitle}>كل الحقول</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setCurrentPage(f.pageNumber);
                    setSelectedFieldId(f.id);
                  }}
                  style={{
                    ...styles.fieldListBtn,
                    ...(selectedFieldId === f.id ? styles.fieldListBtnActive : {}),
                  }}
                >
                  {f.label} — صفحة {f.pageNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldPreview({ field, onChange }) {
  const common = {
    width: "100%",
    height: "100%",
    fontSize: 13,
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "6px 8px",
    boxSizing: "border-box",
    outline: "none",
    background: "#fff",
  };

  if (field.type === "checkbox") {
    return (
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          margin: 0,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={!!field.value}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            width: 16,
            height: 16,
            margin: 0,
            accentColor: "#347cbb",
            cursor: "pointer",
          }}
        />
      </label>
    );
  }

  if (field.type === "signature") {
    return (
      <div
        style={{
          ...common,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontStyle: "italic",
        }}
      >
        {field.label || "Signature"}
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <input
        type="date"
        value={field.value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={common}
      />
    );
  }

  if (field.type === "email") {
    return (
      <input
        type="email"
        placeholder={field.label || "Email Address"}
        value={field.value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={common}
      />
    );
  }

  if (field.type === "phone") {
    return (
      <input
        type="tel"
        placeholder={field.label || "Phone Number"}
        value={field.value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={common}
      />
    );
  }

  return (
    <input
      type="text"
      placeholder={field.label || "Text Field"}
      value={field.value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={common}
    />
  );
}

function FieldEditor({ field, onPatch, onDelete }) {
  if (!field) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={styles.label}>
        اسم الحقل
        <input
          style={styles.input}
          value={field.label}
          onChange={(e) => onPatch({ label: e.target.value })}
        />
      </label>

      <label style={styles.label}>
        مفتاح التكرار
        <input
          style={styles.input}
          value={field.linkedKey || ""}
          onChange={(e) => onPatch({ linkedKey: e.target.value })}
          placeholder="مثال: parent_name"
        />
      </label>

      <label style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={!!field.required}
          onChange={(e) => onPatch({ required: e.target.checked })}
        />
        حقل مطلوب
      </label>

      <div style={styles.grid2}>
        <label style={styles.label}>
          العرض
          <input
            type="number"
            style={styles.input}
            value={field.width}
            onChange={(e) => onPatch({ width: Number(e.target.value || 0) })}
          />
        </label>

        <label style={styles.label}>
          الارتفاع
          <input
            type="number"
            style={styles.input}
            value={field.height}
            onChange={(e) => onPatch({ height: Number(e.target.value || 0) })}
          />
        </label>
      </div>

      <div style={styles.grid2}>
        <label style={styles.label}>
          X
          <input
            type="number"
            style={styles.input}
            value={field.x}
            onChange={(e) => onPatch({ x: Number(e.target.value || 0) })}
          />
        </label>

        <label style={styles.label}>
          Y
          <input
            type="number"
            style={styles.input}
            value={field.y}
            onChange={(e) => onPatch({ y: Number(e.target.value || 0) })}
          />
        </label>
      </div>

      <button style={styles.deleteBtn} onClick={onDelete}>
        حذف الحقل
      </button>
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    borderBottom: "1px solid #e2e8f0",
    background: "#ffffff",
    position: "sticky",
    top: 0,
    zIndex: 30,
  },
  leftTools: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  rightTools: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  primaryBtn: {
    border: 0,
    background: "#222d64",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  toolBtn: {
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    padding: "9px 12px",
    borderRadius: 8,
    cursor: "pointer",
  },
  pageInfo: {
    fontWeight: 700,
    color: "#334155",
    minWidth: 90,
    textAlign: "center",
  },
  body: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 16,
    padding: 16,
  },
  canvasWrap: {
    background: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    minHeight: 700,
    overflow: "auto",
  },
  pageStage: {
    position: "relative",
    margin: "0 auto",
    boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
    background: "#fff",
  },
  overlay: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  fieldBox: {
    position: "absolute",
    border: "1px dashed #94a3b8",
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "blur(2px)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  fieldSelected: {
    border: "2px solid #347cbb",
    boxShadow: "0 0 0 2px rgba(52,124,187,0.15)",
  },
  sidebar: {
    background: "#fff",
    borderRadius: 14,
    padding: 16,
    border: "1px solid #e2e8f0",
    height: "fit-content",
    position: "sticky",
    top: 88,
  },
  sidebarTitle: {
    margin: "0 0 12px",
    fontSize: 18,
  },
  muted: {
    color: "#64748b",
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    height: 38,
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    fontSize: 14,
    outline: "none",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 700,
    color: "#334155",
  },
  deleteBtn: {
    border: 0,
    background: "#b9120d",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
  },
  fieldListBtn: {
    textAlign: "right",
    border: "1px solid #e2e8f0",
    background: "#fff",
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
  },
  fieldListBtnActive: {
    border: "1px solid #347cbb",
    background: "#eff6ff",
  },
  loading: {
    textAlign: "center",
    padding: 40,
    color: "#475569",
    fontWeight: 700,
  },
  emptyState: {
    minHeight: 500,
    display: "grid",
    placeItems: "center",
    color: "#64748b",
    background: "#fff",
    borderRadius: 12,
    border: "2px dashed #cbd5e1",
  },
};