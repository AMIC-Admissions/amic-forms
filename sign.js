let values = {};
let signatureFields = [];
const signaturePads = new Map();

const FIELD_COLUMNS = [
  "amic_fieldid",
  "amic_key",
  "amic_type",
  "amic_pagenumber",
  "amic_metadata",
];

document.addEventListener("DOMContentLoaded", () => {
  const documentId = getDocumentId();

  if (!documentId) {
    showMessage("Document id is required before signatures can be loaded.");
    return;
  }

  loadSignatureFields(documentId).catch((error) => showMessage(error.message));
});

function update(key, value) {
  values[key] = value;
  document.querySelectorAll(`[data-key="${key}"]`).forEach((element) => {
    if (element.value !== undefined) {
      element.value = value;
    }
  });
}

function getDocumentId() {
  return sanitizeId(new URLSearchParams(location.search).get("id"));
}

function sanitizeId(id) {
  return (id || "").replace(/[{}]/g, "");
}

function createMetadata(type, metadata) {
  return Object.assign(
    {
      label: type,
      required: false,
      unit: "percent",
    },
    metadata || {}
  );
}

function parseMetadata(value, type) {
  if (!value) {
    return createMetadata(type);
  }

  if (typeof value === "object") {
    return createMetadata(type, value);
  }

  try {
    return createMetadata(type, JSON.parse(value));
  } catch (_error) {
    return createMetadata(type, { raw: value });
  }
}

function getSignatureImage(metadata) {
  return (
    metadata.signatureImage ||
    (metadata.signature && metadata.signature.image) ||
    (metadata.signature && metadata.signature.dataUrl) ||
    ""
  );
}

function getFieldsQuery(documentId) {
  const filter = `_amic_documentid_value eq ${sanitizeId(documentId)} and amic_type eq 'signature'`;

  return `/_api/amic_fields?$select=${FIELD_COLUMNS.join(",")}&$filter=${encodeURIComponent(filter)}`;
}

async function loadSignatureFields(documentId) {
  const response = await fetch(getFieldsQuery(documentId));

  if (!response.ok) {
    throw new Error(`Unable to load signature fields: ${await response.text()}`);
  }

  const data = await response.json();
  signatureFields = (data.value || []).map(fieldFromBackend);
  window.amicSignatureFields = signatureFields;
  renderSignatureFields();
}

function fieldFromBackend(row) {
  const type = row.amic_type || "signature";
  const metadata = parseMetadata(row.amic_metadata, type);

  return {
    id: row.amic_fieldid || "",
    key: row.amic_key || `${type}${Date.now()}`,
    type,
    page: Number(row.amic_pagenumber || 1),
    metadata,
    image: getSignatureImage(metadata),
  };
}

function showMessage(message) {
  const container = document.getElementById("signature-fields");
  container.innerHTML = "";

  const messageEl = document.createElement("div");
  messageEl.className = "message";
  messageEl.textContent = message;
  container.appendChild(messageEl);
}

function renderSignatureFields() {
  const container = document.getElementById("signature-fields");
  container.innerHTML = "";
  signaturePads.clear();

  if (signatureFields.length === 0) {
    showMessage("No signature fields were found for this document.");
    return;
  }

  signatureFields.forEach((field) => {
    const card = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("div");
    const meta = document.createElement("div");
    const padWrap = document.createElement("div");
    const canvas = document.createElement("canvas");
    const actions = document.createElement("div");
    const clearButton = document.createElement("button");

    card.className = "signature-card";
    title.className = "signature-title";
    title.textContent = field.metadata.label || "Signature";
    meta.className = "signature-meta";
    meta.textContent = `Page ${field.page}`;
    padWrap.className = "signature-pad-wrap";
    canvas.className = "signature-pad";
    canvas.dataset.key = field.key;
    canvas.dataset.fieldId = field.id;
    actions.className = "signature-actions";
    clearButton.type = "button";
    clearButton.textContent = "Clear";
    clearButton.addEventListener("click", () => {
      const pad = signaturePads.get(field.key);
      pad.clear();
      field.image = "";
    });

    header.append(title, meta);
    padWrap.appendChild(canvas);
    actions.appendChild(clearButton);
    card.append(header, padWrap, actions);
    container.appendChild(card);

    initializeSignaturePad(field, canvas);
  });
}

function initializeSignaturePad(field, canvas) {
  resizeSignatureCanvas(canvas);

  const pad = new SignaturePad(canvas, {
    backgroundColor: "rgb(255, 255, 255)",
    penColor: "rgb(15, 23, 42)",
  });

  if (field.image) {
    pad.fromDataURL(field.image);
  }

  pad.addEventListener("endStroke", () => {
    field.image = pad.toDataURL("image/png");
    values[field.key] = {
      fieldId: field.id,
      image: field.image,
    };
  });

  signaturePads.set(field.key, pad);
}

function resizeSignatureCanvas(canvas) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));

  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").scale(ratio, ratio);
}

function getSignedImage(field) {
  const pad = signaturePads.get(field.key);

  if (!pad) {
    return field.image || "";
  }

  if (!pad.isEmpty()) {
    return pad.toDataURL("image/png");
  }

  return field.image || "";
}

function buildSignatureMetadata(field, image, signedAt) {
  return Object.assign({}, field.metadata, {
    signatureImage: image,
    signature: {
      fieldId: field.id,
      fieldKey: field.key,
      image,
      mimeType: "image/png",
      signedAt,
      signerName: values.parent || "",
    },
  });
}

async function patchField(field, payload) {
  const response = await fetch(`/_api/amic_fields(${sanitizeId(field.id)})`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": "*",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function saveSignatureField(field) {
  const signedAt = new Date().toISOString();
  const image = getSignedImage(field);

  if (!image) {
    throw new Error(`${field.metadata.label || "Signature"} is required.`);
  }

  const metadata = buildSignatureMetadata(field, image, signedAt);
  const payloads = [
    {
      amic_signatureimage: image,
      amic_value: image,
      amic_signedat: signedAt,
      amic_signername: values.parent || "",
      amic_metadata: JSON.stringify(metadata),
    },
    {
      amic_signatureimage: image,
      amic_metadata: JSON.stringify(metadata),
    },
    {
      amic_metadata: JSON.stringify(metadata),
    },
  ];

  for (const payload of payloads) {
    try {
      await patchField(field, payload);
      field.image = image;
      field.metadata = metadata;
      values[field.key] = {
        fieldId: field.id,
        image,
        signedAt,
      };
      return;
    } catch (error) {
      if (payload === payloads[payloads.length - 1]) {
        throw new Error(`Unable to save ${field.metadata.label || "signature"}: ${error.message}`);
      }
    }
  }
}

async function submitForm() {
  if (signatureFields.length === 0) {
    alert("No signature fields are available to submit.");
    return;
  }

  try {
    for (const field of signatureFields) {
      await saveSignatureField(field);
    }

    alert("Saved");
  } catch (error) {
    alert(error.message);
  }
}
