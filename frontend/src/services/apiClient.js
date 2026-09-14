const DEFAULT_BASE_URL = "http://localhost:5000/api";
const AUTH_TOKEN_KEY = "revalue_auth_token";

function getBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;
}

function getToken() {
  if (typeof window === "undefined") return null;

  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function buildUrl(path, params) {
  const normalizedBase = getBaseUrl().replace(/\/$/, "");
  const normalizedPath = String(path || "").replace(/^\/+/, "");

  const url = new URL(normalizedPath, `${normalizedBase}/`);

  if (params && typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return;
      }

      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

async function parseResponse(response) {
  const contentType =
    response.headers.get("content-type") || "";

  const isJson =
    contentType.includes("application/json");

  const payload = isJson
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object"
        ? payload.message ||
          payload.detail ||
          `Request failed with status ${response.status}`
        : `Request failed with status ${response.status}`;

    const error = new Error(message);

    error.status = response.status;
    error.body = payload;

    throw error;
  }

  return payload;
}

async function request(
  path,
  {
    method = "GET",
    body,
    params,
    headers = {},
  } = {}
) {
  const url = buildUrl(path, params);

  const options = {
    method,
    headers: {},
  };

  const isBodyAllowed =
    method !== "GET" &&
    method !== "DELETE";

  if (
    isBodyAllowed &&
    body !== undefined &&
    body !== null
  ) {
    const isFormData =
      typeof FormData !== "undefined" &&
      body instanceof FormData;

    if (isFormData) {
      /*
       * IMPORTANT:
       * Do not manually set multipart/form-data.
       *
       * The browser automatically adds the correct
       * multipart boundary.
       */
      options.body = body;
    } else if (typeof body === "string") {
      options.body = body;

      options.headers["Content-Type"] =
        "application/json";
    } else {
      options.body = JSON.stringify(body);

      options.headers["Content-Type"] =
        "application/json";
    }
  }

  const token = getToken();

  if (token) {
    options.headers.Authorization =
      `Bearer ${token}`;
  }

  Object.entries(headers).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null
      ) {
        options.headers[key] = value;
      }
    }
  );

  const response =
    await fetch(url, options);

  return parseResponse(response);
}

export default {
  get(path, options = {}) {
    return request(path, {
      ...options,
      method: "GET",
    });
  },

  post(path, body, options = {}) {
    return request(path, {
      ...options,
      method: "POST",
      body,
    });
  },

  put(path, body, options = {}) {
    return request(path, {
      ...options,
      method: "PUT",
      body,
    });
  },

  delete(path, options = {}) {
    return request(path, {
      ...options,
      method: "DELETE",
    });
  },
};