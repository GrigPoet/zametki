import { api } from "./api.js";

const form = document.getElementById("register-form");
const err = document.getElementById("error");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.textContent = "";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Регистрация...";

  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      redirectOn401: false,
    });
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
      redirectOn401: false,
    });
    window.location.href = "/static/index.html";
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    btn.textContent = "Зарегистрироваться";
  }
});