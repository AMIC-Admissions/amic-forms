/* ============================================================
   AMIC Forms – Autofill Helper (autofill.js)
   Shared state helper for mirroring field values across the form.
   ============================================================ */

"use strict";

let values = {};

/**
 * Update a field value and mirror it to all DOM elements with matching data-key.
 * Handles text inputs, checkboxes, date inputs, and select elements.
 *
 * @param {string} key   - The field key (data-key attribute)
 * @param {*}      value - The new value
 */
function update(key, value) {
  values[key] = value;

  document.querySelectorAll(`[data-key="${key}"]`).forEach((element) => {
    const tag  = element.tagName.toLowerCase();
    const type = (element.type || "").toLowerCase();

    if (tag === "input" && type === "checkbox") {
      element.checked = Boolean(value);
    } else if (tag === "select" || (tag === "input" && (type === "text" || type === "date" || type === "email" || type === "tel" || type === "number"))) {
      if (element.value !== String(value)) {
        element.value = value;
      }
    } else if (element.value !== undefined) {
      element.value = value;
    }
  });
}
