/**
 * Centralized API Fetch Helper that includes httpOnly session cookies automatically
 */
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export async function apiFetch(endpoint, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const defaultHeaders = {
    ...options.headers
  };

  if (!isFormData && !defaultHeaders["Content-Type"]) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const config = {
    ...options,
    headers: defaultHeaders,
    credentials: "include" // Always send httpOnly session cookies
  };

  const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, config);

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let errorMessage = "An unexpected error occurred.";
    if (data && data.error) {
      if (typeof data.error === "string") {
        errorMessage = data.error;
      } else if (data.error.message) {
        errorMessage = data.error.message;
      }
    }
    const err = new Error(errorMessage);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiFetchBlob(endpoint, options = {}) {
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...options.headers
  };

  const config = {
    ...options,
    headers: defaultHeaders,
    credentials: "include"
  };

  const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = "Failed to fetch media stream.";
    try {
      const data = await response.json();
      if (data?.error?.message) errorMessage = data.error.message;
    } catch {
      /* ignore */
    }
    const err = new Error(errorMessage);
    err.status = response.status;
    throw err;
  }

  return await response.blob();
}

