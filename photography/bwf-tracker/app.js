/* ─────────────────────────────────────────────────────────────
   Shot list · BWF I
   Security notes follow OWASP (Open Worldwide Application Security Project) guidance:
   - No innerHTML with data: every name is inserted with textContent (prevents XSS (Cross-Site Scripting)).
   - All data coming back from Firebase is schema-checked before use; unknown keys are ignored.
   - Writes are rate limited per device here AND per user in database.rules.json.
   - No secrets in this file. Firebase settings live in config.js and are public by design;
     the real protection is the database rules plus the API (Application Programming Interface)
     key restrictions described in README.md.
   - Only accounts on the access list (bwf_tracker/allowed in the database) can read or write.
   ───────────────────────────────────────────────────────────── */
(() => {
  "use strict";

  /* ── Roster (coach's sheet order) ─────────────────────────── */
  // photo: true when the club site has a real face photo (files in img/thumb and img/full)
  const PLAYERS = Object.freeze([
    { id: "linus",           name: "Linus",           full: "Linus Valentin Wandzioch", photo: true,  a: true },
    { id: "daniel_gk",       name: "Daniel",          full: "Daniel Böneker",          photo: true,  a: true, role: "Goalkeeper" },
    { id: "christoph_a",     name: "Christoph A.",    full: "Christoph Auer",          photo: true,  a: true },
    { id: "youssef",         name: "Youssef",         full: "Youssef Elbosraty",       photo: true,  a: true },
    { id: "finn",            name: "Finn",            full: "Finn-Jordan Richter",     photo: true,  a: true },
    { id: "tobias",          name: "Tobias",          full: "Tobias Haltenhof",        photo: true,  a: true, role: "Trainer" },
    { id: "alex",            name: "Alex",            full: "Alexander Simmance",      photo: true,  a: true },
    { id: "robert",          name: "Robert",          full: "",                        photo: false },
    { id: "richard",         name: "Richard",         full: "Richard Lampel",          photo: true },
    { id: "balthasar",       name: "Balthasar",       full: "Balthasar Kaschula",      photo: true },
    { id: "marius",          name: "Marius",          full: "Marius Chibuike Ogowuihe", photo: true },
    { id: "devon",           name: "Devon",           full: "Devon Wolfe Allowitz",    photo: false },
    { id: "devin",           name: "Devin",           full: "Devin Akay",              photo: true },
    { id: "craig",           name: "Craig",           full: "Craig Brierly",           photo: true },
    { id: "mehtab",          name: "Mehtab",          full: "",                        photo: false },
    { id: "lukas_wenger",    name: "Lukas",           full: "Klaus Lukas Wenger-Oehn", photo: true,
      note: "Two players called Lukas on the club site. Check which one the coach means." },
    { id: "lukas_enzweiler", name: "Lukas",           full: "Lukas Enzweiler",         photo: true,
      note: "Two players called Lukas on the club site. Check which one the coach means." },
    { id: "christophe",      name: "Christophe",      full: "Christophe Gautier Bolz", photo: true },
    { id: "moritz_k",        name: "Moritz Kesseler", full: "Moritz Kesseler",         photo: true },
    { id: "moritz_a",        name: "Moritz A.",       full: "Moritz Aistermann",       photo: true },
    { id: "ivo",             name: "Ivo",             full: "Ivo Krappmann",           photo: true },
    { id: "sven",            name: "Sven",            full: "Sven Liebisch",           photo: true },
    { id: "joseph",          name: "Joseph",          full: "Joseph Pengel",           photo: true },
    { id: "philipp_weber",   name: "Philipp",         full: "Philipp Weber",           photo: true,
      note: "Two players called Philipp on the club site. Check which one the coach means." },
    { id: "philipp_saenger", name: "Philipp",         full: "Philipp Sänger",          photo: true,
      note: "Two players called Philipp on the club site. Check which one the coach means." },
    { id: "david",           name: "David",           full: "David Rauch",             photo: true },
    { id: "hamado",          name: "Hamado",          full: "Hamado Dene",             photo: true },
    { id: "bato",            name: "Bato",            full: "",                        photo: false },
    { id: "paul",            name: "Paul",            full: "Paul Kretschmer",         photo: true },
    { id: "hardy",           name: "Hardy",           full: "Hardy Ketteler",          photo: false },
    { id: "niclas_g",        name: "Niclas G.",       full: "Niclas Götzke",           photo: true },
    { id: "niklas_k",        name: "Niklas K.",       full: "",                        photo: false },
    { id: "trung",           name: "Trung",           full: "Trung Nguyen",            photo: false },
    { id: "florian_s",       name: "Florian S.",      full: "Florian Schulz",          photo: false },
    { id: "patrick_coach",   name: "Patrick",         full: "Patrick Waldner",         photo: true, role: "Coach" },
    { id: "christian_gk",    name: "Christian",       full: "Christian Hufnagel",      photo: true, role: "Goalkeeper" },
    { id: "pablo_gk",        name: "Pablo",           full: "",                        photo: false, role: "Goalkeeper" },
  ].map(Object.freeze));

  const BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
  const SHOTS = { a: "action", c: "celebration" };
  const LOCAL_KEY = "bwf-shotlist-v1";

  /* ── Rate limit settings (sensible defaults) ──────────────── */
  const WRITE_GAP_MS = 1200;        // at most one sync request per 1.2 s (rules enforce ≥ 1 s)
  const TAP_BUCKET_SIZE = 20;       // up to 20 quick taps in a burst…
  const TAP_REFILL_MS = 1000;       // …then one more tap per second
  const MAX_RETRY_MS = 15000;       // back-off ceiling after a rejected write
  const SEARCH_MAX_LEN = 40;

  /* ── State ────────────────────────────────────────────────── */
  const state = new Map(PLAYERS.map(p => [p.id, { a: !!p.a, c: false }]));
  let filter = "todo";
  let query = "";
  let mode = "local";               // "local" | "firebase"
  let dbRoot = null;
  let uid = null;

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const fold = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const initials = name => name.replace(/[^A-Za-zÀ-ÿ ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  // Validation: a stored record must be exactly {a: boolean, c: boolean} (a "t" timestamp is allowed from Firebase)
  function validRecord(r) {
    if (!r || typeof r !== "object" || Array.isArray(r)) return false;
    if (typeof r.a !== "boolean" || typeof r.c !== "boolean") return false;
    return Object.keys(r).every(k => k === "a" || k === "c" || k === "t");
  }

  // Validation: search input. Trim, strip control characters, cap length.
  function cleanQuery(raw) {
    if (typeof raw !== "string") return "";
    return raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, SEARCH_MAX_LEN);
  }

  /* ── Local storage (used when Firebase is not set up) ─────── */
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw || raw.length > 20000) return;           // length limit on stored data
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return;
      for (const [id, rec] of Object.entries(data)) {
        if (BY_ID.has(id) && validRecord(rec)) state.set(id, { a: rec.a, c: rec.c });
      }
    } catch { /* corrupt or blocked storage: keep defaults */ }
  }
  function saveLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(Object.fromEntries(state))); } catch { /* storage full or blocked */ }
  }

  /* ── Tap rate limit (token bucket, per device) ────────────── */
  let tokens = TAP_BUCKET_SIZE;
  let lastRefill = Date.now();
  function takeToken() {
    const now = Date.now();
    tokens = Math.min(TAP_BUCKET_SIZE, tokens + (now - lastRefill) / TAP_REFILL_MS);
    lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  }

  /* ── Firebase sync with write queue and back-off ──────────── */
  const pending = new Set();   // ids changed locally, not yet sent
  const inflight = new Set();  // ids currently being sent
  let lastWrite = 0;
  let flushTimer = null;
  let retryMs = 0;

  function queueWrite(id) {
    saveLocal();                     // always keep a copy on this phone
    if (mode !== "firebase") return;
    pending.add(id);
    scheduleFlush();
  }
  function scheduleFlush() {
    if (flushTimer || !pending.size) return;
    const wait = Math.max(0, lastWrite + WRITE_GAP_MS - Date.now()) + retryMs;
    flushTimer = setTimeout(flush, wait);
  }
  async function flush() {
    flushTimer = null;
    if (!pending.size || !dbRoot || !uid) return;
    const ids = [...pending];
    pending.clear();
    ids.forEach(id => inflight.add(id));

    const ts = firebase.database.ServerValue.TIMESTAMP;
    const update = {};
    for (const id of ids) {
      const s = state.get(id);
      update["players/" + id] = { a: s.a, c: s.c, t: ts };   // exactly the fields the rules allow
    }
    update["throttle/" + uid] = ts;                          // per-user rate limit marker
    lastWrite = Date.now();

    try {
      await dbRoot.update(update);
      retryMs = 0;
    } catch (err) {
      // Graceful equivalent of an HTTP (HyperText Transfer Protocol) 429: keep the change, wait, retry.
      ids.forEach(id => pending.add(id));
      retryMs = Math.min(retryMs ? retryMs * 2 : 1500, MAX_RETRY_MS);
      showToast("Saved on this phone. Sync is busy, retrying in " + Math.ceil(retryMs / 1000) + " s.");
    } finally {
      ids.forEach(id => inflight.delete(id));
      scheduleFlush();
    }
  }

  function applyRemote(data) {
    if (!data || typeof data !== "object") return;
    for (const [id, rec] of Object.entries(data)) {
      if (!BY_ID.has(id) || !validRecord(rec)) continue;     // ignore unknown or malformed rows
      if (pending.has(id) || inflight.has(id)) continue;     // local change wins until it is sent
      state.set(id, { a: rec.a, c: rec.c });
    }
  }

  function readConfig() {
    const cfg = window.BWF_CONFIG;
    if (!cfg || typeof cfg !== "object" || !cfg.firebase) return null;
    const f = cfg.firebase;
    const need = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
    for (const k of need) {
      if (typeof f[k] !== "string" || !f[k] || f[k].length > 200 || /PASTE_/.test(f[k])) return null;
    }
    if (!/^https:\/\/[a-z0-9-]+(-default-rtdb)?\.([a-z0-9-]+\.)?(firebaseio\.com|firebasedatabase\.app)\/?$/i.test(f.databaseURL)) return null;
    return cfg;
  }

  /* ── Sign-in (username + password) ────────────────────────
     Firebase needs an email-shaped login, so a username like "coach" becomes
     "coach@shotlist.arpithbinsa.com". No email is ever sent to it.            */
  const USERNAME_DOMAIN = "shotlist.arpithbinsa.com";
  const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;          // input validation: allowed characters + length
  const PASSWORD_MIN = 8, PASSWORD_MAX = 128;
  const LOCK_KEY = "bwf-signin-lock";

  let auth = null;
  let playersRef = null, connectedRef = null;

  function showScreen(which) {             // "app" | "signin"
    document.body.dataset.screen = which;
  }

  // Client-side login rate limit: after 3 failed tries, wait 15 s, then 30 s, 60 s … (max 15 min).
  // Firebase also blocks repeated failures on its side; this just keeps the UI (user interface) calm.
  function readLock() {
    try {
      const v = JSON.parse(sessionStorage.getItem(LOCK_KEY) || "{}");
      return { fails: Number.isInteger(v.fails) ? v.fails : 0, until: Number.isFinite(v.until) ? v.until : 0 };
    } catch { return { fails: 0, until: 0 }; }
  }
  function writeLock(l) { try { sessionStorage.setItem(LOCK_KEY, JSON.stringify(l)); } catch { /* ignore */ } }
  function registerFailure() {
    const l = readLock();
    l.fails += 1;
    if (l.fails >= 3) l.until = Date.now() + Math.min(15000 * 2 ** (l.fails - 3), 15 * 60 * 1000);
    writeLock(l);
    return l;
  }

  function signinError(text) {
    const e = $("signinError");
    e.textContent = text;
    e.hidden = !text;
  }

  async function handleSignIn(ev) {
    ev.preventDefault();
    if (!auth) return;
    const btn = $("signinBtn");
    const lock = readLock();
    if (lock.until > Date.now()) {
      signinError("Too many tries. Wait " + Math.ceil((lock.until - Date.now()) / 1000) + " seconds and try again.");
      return;
    }

    // Validate and normalise input. Reject anything outside the allowed shape before it leaves the phone.
    const username = String($("signinUser").value || "").trim().toLowerCase();
    const password = String($("signinPass").value || "");
    if (!USERNAME_RE.test(username)) { signinError("Usernames are 3\u201324 characters: letters, numbers, dots, dashes or underscores."); return; }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) { signinError("Password must be " + PASSWORD_MIN + "\u2013" + PASSWORD_MAX + " characters."); return; }

    btn.disabled = true;
    signinError("");
    try {
      await auth.signInWithEmailAndPassword(username + "@" + USERNAME_DOMAIN, password);
      writeLock({ fails: 0, until: 0 });
      $("signinPass").value = "";
    } catch (err) {
      const code = err && err.code;
      if (code === "auth/too-many-requests") {
        signinError("Too many tries from this phone. Wait a few minutes and try again.");     // graceful 429
      } else if (code === "auth/network-request-failed") {
        signinError("No connection. Check your signal and try again.");
      } else {
        const l = registerFailure();
        // Same message for wrong username and wrong password, so usernames can't be guessed.
        signinError(l.until > Date.now()
          ? "Wrong username or password. Wait " + Math.ceil((l.until - Date.now()) / 1000) + " seconds before trying again."
          : "Wrong username or password.");
      }
    } finally {
      btn.disabled = false;
    }
  }

  function stopListening() {
    if (playersRef) playersRef.off();
    if (connectedRef) connectedRef.off();
    playersRef = connectedRef = null;
    dbRoot = null;
    uid = null;
    mode = "local";
  }

  function startListening(user) {
    uid = user.uid;
    const db = firebase.database();
    dbRoot = db.ref("bwf_tracker");
    mode = "firebase";
    $("whoami").textContent = (user.email || "").split("@")[0];

    connectedRef = db.ref(".info/connected");
    connectedRef.on("value", snap => setSync(snap.val() ? "live" : "offline"));
    playersRef = dbRoot.child("players");
    playersRef.on("value",
      snap => { applyRemote(snap.val()); update(); },
      err => {
        if (err && /permission/i.test(String(err.code || err.message))) {
          // Signed in, but this account isn't on the access list.
          auth.signOut();
          signinError("This account doesn\u2019t have access to the shot list.");
        } else {
          setSync("offline");
          showToast("Couldn\u2019t read the shared list. Showing what this phone knows.");
        }
      }
    );
  }

  async function startFirebase(cfg) {
    if (typeof firebase === "undefined") throw new Error("Firebase scripts did not load");
    firebase.initializeApp(cfg.firebase);

    // Optional App Check (bot protection). Only runs if you add a reCAPTCHA v3 site key in config.js.
    if (typeof cfg.appCheckSiteKey === "string" && /^[A-Za-z0-9_-]{20,100}$/.test(cfg.appCheckSiteKey) && firebase.appCheck) {
      firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(cfg.appCheckSiteKey), true);
    }

    auth = firebase.auth();
    // Stay signed in on this phone until you sign out (Firebase renews the session automatically).
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    $("signinForm").addEventListener("submit", handleSignIn);
    $("signout").addEventListener("click", () => { auth.signOut(); });

    auth.onAuthStateChanged(user => {
      if (user && !user.isAnonymous) {
        showScreen("app");
        startListening(user);
      } else {
        stopListening();
        if (user && user.isAnonymous) auth.signOut();   // clear old anonymous sessions from the first version
        showScreen("signin");
        setSync("connecting");
        setTimeout(() => { try { $("signinUser").focus({ preventScroll: true }); } catch { /* ignore */ } }, 50);
      }
    });
  }

  function setSync(s) {
    const box = $("sync");
    box.dataset.state = s;
    $("syncText").textContent = {
      live: "Live with coach",
      offline: "Offline, will sync",
      local: "This phone only",
      connecting: "Connecting",
    }[s] || "";
  }

  /* ── Marking ──────────────────────────────────────────────── */
  let undoInfo = null;

  function setShot(id, shot, value, { silent = false, animate = true } = {}) {
    const s = state.get(id);
    if (!s || !(shot in SHOTS)) return;           // reject unexpected input
    s[shot] = !!value;
    queueWrite(id);
    update(animate ? { id, shot } : null);
    if (!silent) {
      const p = BY_ID.get(id);
      undoInfo = { id, shot, prev: !value };
      showToast(p.name + ": " + SHOTS[shot] + (value ? " marked" : " cleared"), true);
    }
  }

  /* ── Rendering (DOM (Document Object Model) built once, then updated) ── */
  const rows = new Map();

  function markSvg() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "mark");
    svg.setAttribute("viewBox", "0 0 60 44");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M5 25 C 10 28, 14 33, 19 39 C 27 25, 38 12, 56 4");
    svg.append(path);
    return svg;
  }

  function buildSheet() {
    const sheet = $("sheet");
    const reel = $("reel");
    for (const p of PLAYERS) {
      const li = el("li", "player");
      const head = el("div", "player-head");
      head.append(el("span", "player-name", p.name));
      if (p.role) head.append(el("span", "player-role", p.role));
      const fullText = p.full && p.full !== p.name ? p.full : "";
      const photoNote = p.photo ? "" : (p.full ? "No face photo on the club site" : "Not on the club site");
      const sub = [fullText, photoNote].filter(Boolean).join(". ");
      if (sub) head.append(el("span", "player-full", sub));
      if (p.note) head.append(el("span", "player-note", p.note));

      const strip = el("div", "strip");

      // Portrait frame
      let portrait;
      if (p.photo) {
        portrait = el("button", "frame frame-portrait has-photo");
        portrait.type = "button";
        portrait.dataset.zoom = p.id;
        portrait.setAttribute("aria-label", "Show larger photo of " + (p.full || p.name));
        const img = el("img");
        img.src = "./img/thumb/" + p.id + ".jpg";
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.width = 240; img.height = 240;
        portrait.append(img);
      } else {
        portrait = el("div", "frame frame-portrait");
        const np = el("div", "no-photo");
        np.append(el("b", null, initials(p.full || p.name) || "?"), el("small", null, "No photo"));
        portrait.append(np);
      }
      strip.append(portrait);

      // Shot frames
      const btns = {};
      for (const [shot, label] of Object.entries(SHOTS)) {
        const b = el("button", "frame frame-shot");
        b.type = "button";
        b.dataset.id = p.id;
        b.dataset.shot = shot;
        b.setAttribute("aria-label", label[0].toUpperCase() + label.slice(1) + " shot of " + p.name);
        b.append(markSvg(), el("span", "label", label === "action" ? "Action" : "Celebration"));
        strip.append(b);
        btns[shot] = b;
      }

      li.append(head, strip);
      sheet.append(li);

      const cell = el("span");
      const ia = el("i"), ic = el("i");
      cell.append(ia, ic);
      reel.append(cell);

      rows.set(p.id, { li, btns, ia, ic, search: fold([p.name, p.full, p.role || ""].join(" ")) });
    }
    document.querySelectorAll(".js-total").forEach(n => { n.textContent = String(PLAYERS.length); });
  }

  function matchesFilter(p, s) {
    switch (filter) {
      case "todo":    return !(s.a && s.c);
      case "done":    return s.a && s.c;
      case "clarify": return !!p.note;
      case "nophoto": return !p.photo;
      default:        return true;
    }
  }

  function update(justMarked = null) {
    let countA = 0, countC = 0, visible = 0;
    const counts = { todo: 0, done: 0, clarify: 0, nophoto: 0, all: PLAYERS.length };
    const q = fold(query);

    for (const p of PLAYERS) {
      const s = state.get(p.id);
      const r = rows.get(p.id);
      if (s.a) countA++;
      if (s.c) countC++;
      if (s.a && s.c) counts.done++; else counts.todo++;
      if (p.note) counts.clarify++;
      if (!p.photo) counts.nophoto++;

      for (const shot of Object.keys(SHOTS)) {
        const b = r.btns[shot];
        b.setAttribute("aria-pressed", String(s[shot]));
        b.classList.toggle("just-marked", !!justMarked && justMarked.id === p.id && justMarked.shot === shot);
      }
      r.li.classList.toggle("complete", s.a && s.c);
      r.ia.classList.toggle("on", s.a);
      r.ic.classList.toggle("on", s.c);

      const show = matchesFilter(p, s) && (!q || r.search.includes(q));
      r.li.hidden = !show;
      if (show) visible++;
    }

    $("countA").textContent = String(countA);
    $("countC").textContent = String(countC);
    for (const b of document.querySelectorAll("#filters button")) {
      b.querySelector(".n").textContent = String(counts[b.dataset.filter]);
    }

    const empty = $("empty");
    empty.hidden = visible > 0;
    if (!visible) {
      empty.textContent = query
        ? "No player matches \u201c" + query + "\u201d in this list."
        : { todo: "Everyone on the sheet has both shots. Nice work.",
            done: "Nobody has both shots yet.",
            clarify: "No names left to check.",
            nophoto: "Every player has a photo." }[filter] || "";
    }
  }

  /* ── Toast ────────────────────────────────────────────────── */
  let toastTimer = null;
  function showToast(text, withUndo = false) {
    $("toastText").textContent = text;
    $("toastUndo").hidden = !withUndo;
    if (!withUndo) undoInfo = null;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; undoInfo = null; }, 5000);
  }

  /* ── Photo viewer ─────────────────────────────────────────── */
  function openViewer(id) {
    const p = BY_ID.get(id);
    if (!p || !p.photo) return;
    const dlg = $("viewer");
    const img = $("viewerImg");
    $("viewerFrame").classList.remove("zoomed");
    img.src = "./img/full/" + p.id + ".jpg";
    img.alt = "Photo of " + (p.full || p.name);
    $("viewerName").textContent = p.full || p.name;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  function closeViewer() {
    const dlg = $("viewer");
    if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  }

  /* ── Events ───────────────────────────────────────────────── */
  function bind() {
    $("sheet").addEventListener("click", e => {
      const zoom = e.target.closest("[data-zoom]");
      if (zoom) { openViewer(zoom.dataset.zoom); return; }
      const b = e.target.closest(".frame-shot");
      if (!b) return;
      const { id, shot } = b.dataset;
      if (!BY_ID.has(id) || !(shot in SHOTS)) return;   // validate before acting
      if (!takeToken()) { showToast("That\u2019s a lot of taps. Give it a few seconds."); return; }
      setShot(id, shot, !state.get(id)[shot]);
    });

    $("filters").addEventListener("click", e => {
      const b = e.target.closest("button[data-filter]");
      if (!b) return;
      const f = b.dataset.filter;
      if (!["todo", "done", "clarify", "nophoto", "all"].includes(f)) return;
      filter = f;
      for (const x of document.querySelectorAll("#filters button")) x.setAttribute("aria-selected", String(x === b));
      update();
      window.scrollTo({ top: 0 });
    });

    let searchTimer = null;
    $("search").addEventListener("input", e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const clean = cleanQuery(e.target.value);
        if (clean !== e.target.value.trim()) e.target.value = clean;
        query = clean;
        update();
      }, 120);
    });

    $("toastUndo").addEventListener("click", () => {
      if (!undoInfo) return;
      const { id, shot, prev } = undoInfo;
      undoInfo = null;
      setShot(id, shot, prev, { silent: true, animate: false });
      showToast("Undone");
    });

    $("viewerClose").addEventListener("click", closeViewer);
    $("viewer").addEventListener("click", e => { if (e.target === e.currentTarget) closeViewer(); });
    $("viewerImg").addEventListener("click", () => $("viewerFrame").classList.toggle("zoomed"));
  }

  /* ── Start ────────────────────────────────────────────────── */
  let started = false;
  function init() {
    if (started) return;   // never build the sheet twice
    started = true;
    buildSheet();
    bind();
    loadLocal();          // show something instantly, even offline
    update();

    const cfg = readConfig();
    if (!cfg) {
      showScreen("app");
      setSync("local");
      const n = $("notice");
      n.hidden = false;
      n.textContent = "Syncing with the coach isn\u2019t set up yet, so ticks are saved on this phone only.";
      return;
    }
    setSync("connecting");
    showScreen("loading");
    startFirebase(cfg).catch(() => {
      showScreen("app");
      mode = "local";
      setSync("local");
      showToast("Couldn\u2019t reach the shared list. Ticks are saved on this phone for now.");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();