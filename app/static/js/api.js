export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = "/static/login.html";
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    if (data.detail) {
      if (typeof data.detail === "string") {
        msg = data.detail;
      } else if (Array.isArray(data.detail)) {
        msg = data.detail
          .map((e) => e.msg || JSON.stringify(e))
          .join("; ");
      } else {
        msg = JSON.stringify(data.detail);
      }
    }
    throw new Error(msg);
  }

  return data;
}