import { firebaseConfig } from "./firebase-config.js";

const STATUSES = [
  { value: "new", label: "Mới" },
  { value: "considering", label: "Đang cân nhắc" },
  { value: "chosen", label: "Đã chốt" },
  { value: "dropped", label: "Loại" },
];
const statusLabel = (v) => (STATUSES.find((s) => s.value === v) || STATUSES[0]).label;

const SEED = {
  id: "seed-cafe-multitenant",
  title: "Web quản lý quán cafe đa chi nhánh (multi-tenant) + AI agent",
  author: "Minh Phúc",
  description: "Dành cho doanh nghiệp quản lý quán, không phải khách hàng. Nhiều chi nhánh; nhân viên vào ca phải chọn chi nhánh mình làm. Dữ liệu chia theo từng tenant, phân quyền theo tài khoản (chủ / quản lý / nhân viên). Có kết nối DB. Agent hỗ trợ thêm/sửa/xoá, gọi món, order giúp nhân viên. Cần cân nhắc: tính doanh thu thế nào, bảo mật dữ liệu từng tenant.",
  tech: "Web app, DB, multi-tenant, RBAC, AI agent",
  difficulty: 4,
  status: "new",
  voters: [],
  createdAt: 1764000000000,
};

// Mỗi trình duyệt có 1 mã ẩn danh để tính vote.
const voterId = localStorage.getItem("voterId") || (() => {
  const id = crypto.randomUUID();
  localStorage.setItem("voterId", id);
  return id;
})();

const $ = (s) => document.querySelector(s);
const els = {
  list: $("#list"), form: $("#ideaForm"), search: $("#search"),
  filter: $("#filterStatus"), sort: $("#sortBy"), mode: $("#modeBadge"), toast: $("#toast"),
};

let ideas = [];
let store;

/* ---------- Lưu trữ: Firebase (chung) hoặc localStorage (thử) ---------- */

async function createFirebaseStore() {
  const v = "10.12.2";
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`);
  const db = fs.getFirestore(initializeApp(firebaseConfig));
  const col = fs.collection(db, "ideas");
  return {
    shared: true,
    subscribe(cb) {
      return fs.onSnapshot(col, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => toast("Lỗi tải dữ liệu: " + err.message));
    },
    add: (idea) => fs.addDoc(col, { ...idea, createdAt: Date.now() }),
    update: (id, data) => fs.updateDoc(fs.doc(db, "ideas", id), data),
    remove: (id) => fs.deleteDoc(fs.doc(db, "ideas", id)),
    async seed(idea) {
      const ref = fs.doc(db, "ideas", idea.id);
      const { id, ...data } = idea;
      if (!(await fs.getDoc(ref)).exists()) await fs.setDoc(ref, data);
    },
    toggleVote: (id, has) => fs.updateDoc(fs.doc(db, "ideas", id), {
      voters: has ? fs.arrayRemove(voterId) : fs.arrayUnion(voterId),
    }),
  };
}

function createLocalStore() {
  const KEY = "ideas-local";
  let listener = () => {};
  const read = () => JSON.parse(localStorage.getItem(KEY) || "[]");
  const write = (arr) => { localStorage.setItem(KEY, JSON.stringify(arr)); listener(arr); };
  return {
    shared: false,
    subscribe(cb) { listener = cb; cb(read()); },
    async add(idea) { write([...read(), { ...idea, id: crypto.randomUUID(), createdAt: Date.now() }]); },
    async update(id, data) { write(read().map((i) => (i.id === id ? { ...i, ...data } : i))); },
    async remove(id) { write(read().filter((i) => i.id !== id)); },
    async seed(idea) { if (!read().some((i) => i.id === idea.id)) write([...read(), idea]); },
    async toggleVote(id, has) {
      write(read().map((i) => {
        if (i.id !== id) return i;
        const voters = new Set(i.voters || []);
        has ? voters.delete(voterId) : voters.add(voterId);
        return { ...i, voters: [...voters] };
      }));
    },
  };
}

/* ---------- Hiển thị ---------- */

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function visibleIdeas() {
  const q = els.search.value.trim().toLowerCase();
  const st = els.filter.value;
  const list = ideas.filter((i) => {
    if (st && (i.status || "new") !== st) return false;
    if (!q) return true;
    return [i.title, i.description, i.tech, i.author].join(" ").toLowerCase().includes(q);
  });
  const votes = (i) => (i.voters || []).length;
  const sorters = {
    votes: (a, b) => votes(b) - votes(a) || b.createdAt - a.createdAt,
    newest: (a, b) => b.createdAt - a.createdAt,
    easy: (a, b) => a.difficulty - b.difficulty || votes(b) - votes(a),
    hard: (a, b) => b.difficulty - a.difficulty || votes(b) - votes(a),
  };
  return list.sort(sorters[els.sort.value]);
}

function render() {
  const list = visibleIdeas();
  if (!list.length) {
    els.list.innerHTML = `<div class="empty">${ideas.length ? "Không có ý tưởng nào khớp bộ lọc." : "Chưa có ý tưởng nào. Bấm “+ Thêm ý tưởng” để bắt đầu!"}</div>`;
    return;
  }
  els.list.innerHTML = list.map((i) => {
    const voters = i.voters || [];
    const has = voters.includes(voterId);
    const status = i.status || "new";
    return `
    <article class="card idea status-${status}" data-id="${i.id}">
      <div class="vote">
        <button data-act="vote" class="${has ? "voted" : ""}" title="${has ? "Bỏ vote" : "Vote"}">▲</button>
        <span class="count">${voters.length}</span>
      </div>
      <div class="body">
        <h3>${escapeHtml(i.title)}</h3>
        ${i.description ? `<p>${escapeHtml(i.description)}</p>` : ""}
        <div class="meta">
          <span class="chip">Độ khó ${i.difficulty}/5</span>
          ${i.tech ? `<span class="chip">${escapeHtml(i.tech)}</span>` : ""}
          <span>bởi ${escapeHtml(i.author)}</span>
          <select data-act="status">
            ${STATUSES.map((s) => `<option value="${s.value}" ${s.value === status ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
          <button class="link" data-act="delete">Xoá</button>
        </div>
      </div>
    </article>`;
  }).join("");
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => els.toast.classList.remove("show"), 2500);
}

/* ---------- Sự kiện ---------- */

function showForm(show) {
  els.form.classList.toggle("hidden", !show);
  if (show) {
    els.form.author.value = localStorage.getItem("authorName") || "";
    els.form.title.focus();
  }
}

$("#toggleForm").onclick = () => showForm(els.form.classList.contains("hidden"));
$("#cancelForm").onclick = () => { els.form.reset(); showForm(false); };

els.form.onsubmit = async (e) => {
  e.preventDefault();
  const f = els.form;
  const idea = {
    title: f.title.value.trim(),
    author: f.author.value.trim(),
    description: f.description.value.trim(),
    tech: f.tech.value.trim(),
    difficulty: Number(f.difficulty.value),
    status: "new",
    voters: [],
  };
  if (!idea.title || !idea.author) return;
  localStorage.setItem("authorName", idea.author);
  try {
    await store.add(idea);
    f.reset();
    f.author.value = idea.author;
    toast("Đã thêm ý tưởng!");
  } catch (err) {
    toast("Không lưu được: " + err.message);
  }
};

els.list.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn || btn.tagName === "SELECT") return;
  const id = btn.closest(".idea").dataset.id;
  const idea = ideas.find((i) => i.id === id);
  try {
    if (btn.dataset.act === "vote") {
      await store.toggleVote(id, (idea.voters || []).includes(voterId));
    } else if (btn.dataset.act === "delete") {
      if (confirm(`Xoá ý tưởng "${idea.title}"?`)) await store.remove(id);
    }
  } catch (err) { toast("Lỗi: " + err.message); }
});

els.list.addEventListener("change", async (e) => {
  if (e.target.dataset.act !== "status") return;
  const id = e.target.closest(".idea").dataset.id;
  try { await store.update(id, { status: e.target.value }); }
  catch (err) { toast("Lỗi: " + err.message); }
});

[els.search, els.filter, els.sort].forEach((el) => el.addEventListener("input", render));

$("#copySheet").onclick = async () => {
  const clean = (s = "") => String(s).replace(/[\t\r\n]+/g, " ").trim();
  const rows = [["Tên ý tưởng", "Mô tả", "Công nghệ", "Độ khó", "Người đề xuất", "Vote", "Trạng thái"]];
  visibleIdeas().forEach((i) => rows.push([
    clean(i.title), clean(i.description), clean(i.tech), i.difficulty,
    clean(i.author), (i.voters || []).length, statusLabel(i.status),
  ]));
  try {
    await navigator.clipboard.writeText(rows.map((r) => r.join("\t")).join("\n"));
    toast("Đã copy! Dán vào Google Sheets / Excel.");
  } catch {
    toast("Trình duyệt không cho copy.");
  }
};

/* ---------- Khởi động ---------- */

els.form.author.value = localStorage.getItem("authorName") || "";
STATUSES.forEach((s) => els.filter.insertAdjacentHTML("beforeend", `<option value="${s.value}">${s.label}</option>`));

(async () => {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    try {
      store = await createFirebaseStore();
    } catch (err) {
      console.error(err);
      toast("Không kết nối được Firebase, dùng chế độ lưu trên máy.");
    }
  }
  if (!store) store = createLocalStore();

  els.mode.textContent = store.shared
    ? "● Đang đồng bộ với cả nhóm"
    : "⚠ Chế độ thử: dữ liệu chỉ lưu trên máy này. Cấu hình Firebase để cả nhóm dùng chung (xem README).";
  els.mode.classList.toggle("local", !store.shared);

  store.subscribe((data) => { ideas = data; render(); });

  // Thêm sẵn ý tưởng đầu tiên (chỉ một lần, xoá rồi sẽ không tự thêm lại).
  if (!localStorage.getItem("seeded:" + (store.shared ? "fb:" : "local:") + SEED.id)) {
    try {
      await store.seed(SEED);
      localStorage.setItem("seeded:" + (store.shared ? "fb:" : "local:") + SEED.id, "1");
    } catch (err) { console.error(err); }
  }
})();
