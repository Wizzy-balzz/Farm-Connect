/**
 * Centralized API Fetch Helper that includes httpOnly session cookies automatically
 */
export async function apiFetch(endpoint, options = {}) {
  const defaultHeaders = {
    "Content-Type": "application/json",
    ...options.headers
  };

  const config = {
    ...options,
    headers: defaultHeaders,
    credentials: "include" // Always send httpOnly session cookies
  };

  const response = await fetch(endpoint, config);

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
