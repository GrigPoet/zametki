const MESSAGES = {
  "Invalid credentials": "Неверный логин или пароль",
  "Username already taken": "Такой логин уже занят",
  "Not authenticated": "Требуется вход",
  "User not found": "Пользователь не найден",
  "Note not found": "Заметка не найдена",
  "Tag not found": "Тег не найден",
  "Tag already exists": "Такой тег уже есть",
  "Some tag_ids are invalid": "Выбраны недоступные теги",
  "Tag name must not be empty": "Название тега не может быть пустым",
  "Username must be at least 3 characters": "Логин должен быть не короче 3 символов",
};

export async function api(path, options = {}) {
  const { redirectOn401 = true, ...rest } = options;

  const headers = { ...(rest.headers || {}) };
  if (rest.body !== undefined && rest.body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(path, {
    credentials: "same-origin",
    ...rest,
    headers,
  });

  if (res.status === 401 && redirectOn401) {
    window.location.href = "/static/login.html";
    throw new Error("Требуется вход");
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    if (data.detail) {
      if (typeof data.detail === "string") {
        msg = MESSAGES[data.detail] || data.detail;
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
