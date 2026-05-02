/* ============================================================
   AMIC Forms – API Helper (api.js)
   Shared utilities for API calls to the backend (Dataverse / Power Platform).
   ============================================================ */

"use strict";

const AmicAPI = (function () {

  const BASE_URL = "/_api";

  /**
   * Make a fetch request with JSON body and standard headers.
   */
  async function request(method, path, body, extraHeaders) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      extraHeaders || {}
    );

    const options = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);

    const response = await fetch(`${BASE_URL}${path}`, options);

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`API Error ${response.status}: ${text}`);
    }

    return response;
  }

  async function get(path) {
    const response = await request("GET", path);
    const text     = await response.text();
    return text.trim() ? JSON.parse(text) : null;
  }

  async function post(path, body) {
    return request("POST", path, body, { "Prefer": "return=representation" });
  }

  async function patch(path, body) {
    return request("PATCH", path, body, { "If-Match": "*" });
  }

  async function del(path) {
    return request("DELETE", path);
  }

  return { get, post, patch, delete: del, request };

})();
