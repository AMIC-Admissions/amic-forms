/* ============================================================
   AMIC Forms – Dashboard Logic (dashboard.js)
   Manages document list and upload for admin dashboard.
   ============================================================ */

"use strict";

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function showMessage(message, type) {
  const errorEl   = document.getElementById("error-msg");
  const successEl = document.getElementById("success-msg");

  if (type === "error") {
    if (errorEl)   { errorEl.textContent   = message; errorEl.hidden   = false; }
    if (successEl) { successEl.hidden = true; }
  } else {
    if (successEl) { successEl.textContent = message; successEl.hidden = false; }
    if (errorEl)   { errorEl.hidden   = true; }
  }
}

function clearMessages() {
  const errorEl   = document.getElementById("error-msg");
  const successEl = document.getElementById("success-msg");
  if (errorEl)   errorEl.hidden   = true;
  if (successEl) successEl.hidden = true;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

async function upload() {
  const fileInput = document.getElementById("file");
  const file      = fileInput && fileInput.files[0];

  if (!file) {
    showMessage("يرجى اختيار ملف PDF أولاً.", "error");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    showMessage("يرجى اختيار ملف PDF فقط.", "error");
    return;
  }

  clearMessages();

  try {
    const response = await fetch("/_api/amic_documents", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ amic_name: file.name }),
    });

    if (!response.ok) {
      throw new Error(`فشل الرفع: ${await response.text()}`);
    }

    showMessage(`تم رفع "${file.name}" بنجاح.`, "success");
    fileInput.value = "";
    await load();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

// ─── Load Documents ───────────────────────────────────────────────────────────

async function load() {
  const tbody = document.getElementById("list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="2" class="empty-state">جاري التحميل...</td></tr>`;

  try {
    const response = await fetch("/_api/amic_documents?$select=amic_name,amic_documentid");

    if (!response.ok) {
      throw new Error(`فشل التحميل: ${await response.text()}`);
    }

    const data = await response.json();
    const docs = data.value || [];

    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="2" class="empty-state">لا توجد نماذج بعد. ارفع ملف PDF للبدء.</td></tr>`;
      return;
    }

    tbody.innerHTML = docs.map((d) => `
      <tr>
        <td>${escapeHtml(d.amic_name || "بدون اسم")}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="go('${escapeHtml(d.amic_documentid)}')">
            منشئ الحقول
          </button>
        </td>
      </tr>
    `).join("");

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty-state" style="color:#dc2626;">${error.message}</td></tr>`;
  }
}

function go(id) {
  location.href = `builder.html?id=${encodeURIComponent(id)}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Initialize ───────────────────────────────────────────────────────────────

load();
