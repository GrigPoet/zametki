import { api } from "./api.js";

const els = {
  user: document.getElementById("current-user"),
  avatar: document.getElementById("user-avatar"),
  logout: document.getElementById("logout-btn"),
  search: document.getElementById("search"),
  tagFilter: document.getElementById("tag-filter"),
  sort: document.getElementById("sort"),
  applyFilters: document.getElementById("apply-filters"),
  pinnedOnly: document.getElementById("pinned-only"),
  exportCsv: document.getElementById("export-csv"),
  statsList: document.getElementById("stats-list"),
  newTagName: document.getElementById("new-tag-name"),
  createTag: document.getElementById("create-tag"),
  tagsList: document.getElementById("tags-list"),
  tagError: document.getElementById("tag-error"),
  createForm: document.getElementById("create-form"),
  title: document.getElementById("title"),
  content: document.getElementById("content"),
  isPinned: document.getElementById("is-pinned"),
  tagsSelect: document.getElementById("tags-select"),
  createError: document.getElementById("create-error"),
  loading: document.getElementById("loading"),
  empty: document.getElementById("empty"),
  listError: document.getElementById("list-error"),
  notesList: document.getElementById("notes-list"),
  loadMore: document.getElementById("load-more"),
};

const state = {
  limit: 10,
  offset: 0,
  search: "",
  tagId: "",
  pinnedOnly: false,
  sort: "created_desc",
  tags: [],
  totalLoaded: 0,
  hasMore: true,
};

async function init() {
  try {
    const me = await api("/api/auth/me");
    els.user.textContent = me.username;
    if (els.avatar) {
      els.avatar.textContent = me.username.charAt(0).toUpperCase();
    }
  } catch {
    return;
  }

  bindEvents();
  await loadTags();
  await loadStats();
  await reloadNotes();
}

function bindEvents() {
  els.logout.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/static/login.html";
    }
  });

  els.applyFilters.addEventListener("click", () => {
    state.search = els.search.value.trim();
    state.tagId = els.tagFilter.value;
    state.pinnedOnly = els.pinnedOnly.checked;
    state.sort = els.sort.value;
    reloadNotes();
  });

  els.pinnedOnly.addEventListener("change", () => els.applyFilters.click());

  els.exportCsv.addEventListener("click", onExportCsv);

  els.search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.applyFilters.click();
    }
  });

  els.loadMore.addEventListener("click", () => loadNotes(false));

  els.createForm.addEventListener("submit", onCreateNote);
  els.createTag.addEventListener("click", onCreateTag);
}

function onExportCsv() {
  const params = new URLSearchParams();
  if (state.search) params.set("search", state.search);
  if (state.tagId) params.set("tag_id", state.tagId);
  if (state.pinnedOnly) params.set("pinned_only", "true");
  const qs = params.toString();
  window.location.href = "/api/notes/export" + (qs ? `?${qs}` : "");
}

async function loadTags() {
  const tags = await api("/api/tags");
  state.tags = tags;
  renderTagsSelect(tags);
  renderTagFilter(tags);
  renderTagsList(tags);
}

function renderTagFilter(tags) {
  const current = els.tagFilter.value;
  els.tagFilter.innerHTML = '<option value="">Все теги</option>';
  for (const t of tags) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    els.tagFilter.appendChild(opt);
  }
  els.tagFilter.value = current;
}

function renderTagsSelect(tags) {
  els.tagsSelect.innerHTML = "";
  if (tags.length === 0) {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "Сначала создайте теги.";
    els.tagsSelect.appendChild(span);
    return;
  }
  for (const t of tags) {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "6px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = t.id;
    cb.dataset.tag = "create";
    const span = document.createElement("span");
    span.textContent = t.name;
    label.appendChild(cb);
    label.appendChild(span);
    els.tagsSelect.appendChild(label);
  }
}

function renderTagsList(tags) {
  els.tagsList.innerHTML = "";
  if (tags.length === 0) {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "Тегов пока нет.";
    els.tagsList.appendChild(span);
    return;
  }
  for (const t of tags) {
    const wrap = document.createElement("span");
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";
    wrap.style.margin = "0 8px 8px 0";

    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = t.name;

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.className = "tag-del";
    del.title = "Удалить тег";
    del.setAttribute("aria-label", `Удалить тег ${t.name}`);
    del.addEventListener("click", () => onDeleteTag(t.id));

    wrap.appendChild(tag);
    wrap.appendChild(del);
    els.tagsList.appendChild(wrap);
  }
}

async function onCreateTag() {
  els.tagError.textContent = "";
  const name = els.newTagName.value.trim();
  if (!name) return;
  try {
    await api("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    els.newTagName.value = "";
    await loadTags();
    await loadStats();
  } catch (e) {
    els.tagError.textContent = e.message;
  }
}

async function onDeleteTag(id) {
  if (!confirm("Удалить тег? Он исчезнет из всех заметок.")) return;
  try {
    await api(`/api/tags/${id}`, { method: "DELETE" });
    await loadTags();
    await loadStats();
    await reloadNotes();
  } catch (e) {
    els.tagError.textContent = e.message;
  }
}

async function loadStats() {
  try {
    const stats = await api("/api/notes/stats");
    els.statsList.innerHTML = "";
    if (stats.length === 0) {
      els.statsList.textContent = "Нет данных.";
      return;
    }
    for (const s of stats) {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = `${s.tag}: ${s.count}`;
      els.statsList.appendChild(span);
    }
  } catch (e) {
    els.statsList.textContent = "Не удалось загрузить статистику.";
  }
}

async function reloadNotes() {
  state.offset = 0;
  state.hasMore = true;
  state.totalLoaded = 0;
  els.notesList.innerHTML = "";
  await loadNotes(true);
}

async function loadNotes(reset) {
  if (reset) {
    els.loading.classList.remove("hidden");
    els.empty.classList.add("hidden");
    els.loadMore.classList.add("hidden");
    els.listError.textContent = "";
  }

  const params = new URLSearchParams({
    limit: state.limit,
    offset: state.offset,
    sort: state.sort,
  });
  if (state.search) params.set("search", state.search);
  if (state.tagId) params.set("tag_id", state.tagId);
  if (state.pinnedOnly) params.set("pinned_only", "true");

  try {
    const notes = await api(`/api/notes?${params.toString()}`);

    if (reset) els.loading.classList.add("hidden");

    if (reset && notes.length === 0) {
      els.empty.classList.remove("hidden");
      return;
    }

    for (const n of notes) {
      els.notesList.appendChild(renderNote(n));
    }

    state.offset += notes.length;
    state.totalLoaded += notes.length;
    state.hasMore = notes.length === state.limit;

    els.loadMore.classList.toggle("hidden", !state.hasMore);
  } catch (e) {
    els.loading.classList.add("hidden");
    els.listError.textContent = e.message;
  }
}

function renderNote(note) {
  const card = document.createElement("div");
  card.className = "note" + (note.is_pinned ? " pinned" : "");

  const h3 = document.createElement("h3");
  h3.textContent = note.title;
  card.appendChild(h3);

  const meta = document.createElement("div");
  meta.className = "meta";
  const created = new Date(note.created_at).toLocaleString();
  meta.textContent = `Создано: ${created}`;
  if (note.tags.length > 0) {
    const tagsWrap = document.createElement("div");
    tagsWrap.style.marginTop = "4px";
    for (const t of note.tags) {
      const tEl = document.createElement("span");
      tEl.className = "tag";
      tEl.textContent = t.name;
      tagsWrap.appendChild(tEl);
    }
    meta.appendChild(tagsWrap);
  }
  card.appendChild(meta);

  const content = document.createElement("div");
  content.className = "content";
  content.textContent = note.content;
  card.appendChild(content);

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.textContent = "Изменить";
  editBtn.addEventListener("click", () => startEdit(card, note));

  const pinBtn = document.createElement("button");
  pinBtn.type = "button";
  pinBtn.textContent = note.is_pinned ? "Открепить" : "Закрепить";
  pinBtn.addEventListener("click", () => onTogglePin(note));

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "danger";
  delBtn.textContent = "Удалить";
  delBtn.addEventListener("click", () => onDeleteNote(note.id));

  actions.appendChild(editBtn);
  actions.appendChild(pinBtn);
  actions.appendChild(delBtn);
  card.appendChild(actions);

  return card;
}

function startEdit(card, note) {
  card.innerHTML = "";

  const form = document.createElement("form");
  form.className = "edit-form";

  const titleInput = document.createElement("input");
  titleInput.value = note.title;
  titleInput.maxLength = 200;
  titleInput.required = true;

  const contentInput = document.createElement("textarea");
  contentInput.value = note.content;
  contentInput.required = true;

  const pinnedLabel = document.createElement("label");
  pinnedLabel.className = "inline";
  const pinnedInput = document.createElement("input");
  pinnedInput.type = "checkbox";
  pinnedInput.checked = note.is_pinned;
  pinnedLabel.appendChild(pinnedInput);
  pinnedLabel.appendChild(document.createTextNode("Закрепить"));

  const tagsTitle = document.createElement("div");
  tagsTitle.className = "muted";
  tagsTitle.textContent = "Теги:";

  const tagsBox = document.createElement("div");
  tagsBox.className = "tags-checkboxes";
  const selected = new Set(note.tags.map((t) => t.id));

  if (state.tags.length === 0) {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "Тегов пока нет.";
    tagsBox.appendChild(span);
  } else {
    for (const t of state.tags) {
      const label = document.createElement("label");
      label.className = "inline";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = t.id;
      cb.checked = selected.has(t.id);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(t.name));
      tagsBox.appendChild(label);
    }
  }

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.textContent = "Сохранить";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "secondary";
  cancelBtn.textContent = "Отмена";
  cancelBtn.addEventListener("click", () => {
    card.replaceWith(renderNote(note));
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  const err = document.createElement("p");
  err.className = "error";

  form.appendChild(titleInput);
  form.appendChild(contentInput);
  form.appendChild(pinnedLabel);
  form.appendChild(tagsTitle);
  form.appendChild(tagsBox);
  form.appendChild(actions);
  form.appendChild(err);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    if (!title || !content) {
      err.textContent = "Заполните заголовок и текст.";
      return;
    }

    const tag_ids = Array.from(
      tagsBox.querySelectorAll("input[type=checkbox]:checked")
    ).map((cb) => parseInt(cb.value, 10));

    saveBtn.disabled = true;
    saveBtn.textContent = "Сохранение...";

    try {
      await api(`/api/notes/${note.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          content,
          is_pinned: pinnedInput.checked,
          tag_ids,
        }),
      });
      await loadStats();
      await reloadNotes();
    } catch (ex) {
      err.textContent = ex.message;
      saveBtn.disabled = false;
      saveBtn.textContent = "Сохранить";
    }
  });

  card.appendChild(form);
  titleInput.focus();
}

async function onCreateNote(e) {
  e.preventDefault();
  els.createError.textContent = "";

  const tag_ids = Array.from(
    els.tagsSelect.querySelectorAll('input[type=checkbox]:checked')
  ).map((cb) => parseInt(cb.value, 10));

  const payload = {
    title: els.title.value.trim(),
    content: els.content.value.trim(),
    is_pinned: els.isPinned.checked,
    tag_ids,
  };

  if (!payload.title || !payload.content) {
    els.createError.textContent = "Заполните заголовок и текст.";
    return;
  }

  const btn = els.createForm.querySelector("button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Создание...";

  try {
    await api("/api/notes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    els.createForm.reset();
    await loadStats();
    await reloadNotes();
  } catch (e) {
    els.createError.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Создать заметку";
  }
}

async function onTogglePin(note) {
  try {
    await api(`/api/notes/${note.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_pinned: !note.is_pinned }),
    });
    await reloadNotes();
  } catch (e) {
    els.listError.textContent = e.message;
  }
}

async function onDeleteNote(id) {
  if (!confirm("Удалить заметку?")) return;
  try {
    await api(`/api/notes/${id}`, { method: "DELETE" });
    await loadStats();
    await reloadNotes();
  } catch (e) {
    els.listError.textContent = e.message;
  }
}

function initSpotlight() {
  if (window.matchMedia("(hover: none)").matches) return;

  let frame = 0;
  let x = window.innerWidth / 2;
  let y = 0;

  window.addEventListener(
    "pointermove",
    (e) => {
      x = e.clientX;
      y = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        document.body.style.setProperty("--mx", `${x}px`);
        document.body.style.setProperty("--my", `${y}px`);
        frame = 0;
      });
    },
    { passive: true }
  );
}

initSpotlight();
init();