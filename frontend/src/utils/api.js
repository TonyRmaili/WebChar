/* One way to talk to the backend.

     const me = await api.get("/me");
     await api.patch(`/character/${id}`, { changes: { exp: 300 } });
     await api.post("/login", formData, { auth: false });

   Every call:
   - adds the base URL and the login token,
   - sends objects as JSON (FormData is sent as a form),
   - gives back the answer already read (JSON, text, or null for "no content"),
   - throws an ApiError when it didn't work, with `status` (0 = the server
     couldn't be reached) and `message` (FastAPI's `detail` when there is one).

   A 401 on a logged-in call means the token is no longer valid; the handler
   AuthStore registers then logs out.

   Debugging: set LOG_REQUESTS to true to see every request and its answer
   in the browser console. */

// The backend's address. To change it without touching code, put
// VITE_API_URL=http://... in frontend/.env (Vite reads it at start-up).
export const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:8000";

const LOG_REQUESTS = false;

/* ── the login token ──
   The only thing kept in localStorage besides UI preferences. */

const TOKEN_KEY = "token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage blocked
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked: the login lasts until the page is reloaded */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}

/* ── errors ── */

export class ApiError extends Error {
  constructor(status, message, body = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// FastAPI says what went wrong in `detail`: a string, or a list of
// validation problems ({ msg, loc }).
function messageOf(body, status) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 200);
  return `server said ${status}`;
}

let onUnauthorized = null;

// AuthStore calls this once, so a dead token logs the user out.
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

/* ── the request itself ── */

async function request(method, path, { body, query, auth = true, keepalive = false } = {}) {
  let url = `${API_BASE}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) params.append(k, String(v));
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {};
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  if (LOG_REQUESTS) console.log(`→ ${method} ${url}`, body ?? "");

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new ApiError(0, "couldn't reach the server");
  }

  // Read the answer once: JSON when it is JSON, otherwise text.
  let data = null;
  if (res.status !== 204) {
    const text = await res.text().catch(() => "");
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
  }

  if (LOG_REQUESTS) console.log(`← ${res.status} ${method} ${url}`, data);

  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    throw new ApiError(res.status, messageOf(data, res.status), data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request("GET", path, opts),
  post: (path, body, opts) => request("POST", path, { ...opts, body }),
  put: (path, body, opts) => request("PUT", path, { ...opts, body }),
  patch: (path, body, opts) => request("PATCH", path, { ...opts, body }),
  del: (path, opts) => request("DELETE", path, opts),
};

export default api;