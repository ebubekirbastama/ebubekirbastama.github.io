"use strict";
const EBS_BUILD = "20260904-1125";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const enc = new TextEncoder();
const dec = new TextDecoder();

const MAX_CHAT_USERS = 40;
const MAX_VIDEO_CALL_USERS = 6;
const MAX_AUDIO_CALL_USERS = 10;
const MAX_FILE = 6 * 1024 * 1024;
const PROFILE_STORAGE_KEY = "ebs_secure_chat_profile_v1";
const PBKDF2_ITERATIONS = 350000;
const DEFAULT_AVATAR = "assets/img/logo.png";


function readStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return {
      firstName:String(p.firstName || "").slice(0, 32),
      lastName:String(p.lastName || "").slice(0, 32),
      username:String(p.username || "").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 24),
      avatar:typeof p.avatar === "string" && p.avatar.startsWith("data:image/") ? p.avatar : ""
    };
  } catch {
    return null;
  }
}
const STORED_PROFILE = readStoredProfile();

const state = {
  peer: null,
  role: null,
  hostPeerId: null,
  myPeerId: null,
  roomName: "Güvenli Oda",
  roomPassword: "",
  encKey: null,
  authKey: null,
  verified: false,
  selfProfile: STORED_PROFILE || { firstName: "", lastName: "", username: `misafir_${Math.random().toString(36).slice(2, 7)}`, avatar: "" },
  participants: new Map(),
  guests: new Map(),
  hostConn: null,
  hostChunks: new Map(),
  pendingReply: null,
  recorder: null,
  recordStream: null,
  recordChunks: [],
  recordCancelled: false,
  recordStarted: 0,
  recordTimer: null,
  pendingCallInvite: null,

  // Oda içi roller ve mesajlar yalnız RAM'de tutulur.
  roles: new Map(),
  messages: new Map(),
  selectedParticipantId: null,
  selectedMessageId: null,

  // Grup medya: GitHub Pages üzerinde backend gerektirmeyen PeerJS/WebRTC mesh.
  groupCall: null,
  callCoordinator: null,
  localStream: null,
  screenStream: null,
  mediaCalls: new Map()
};

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
}
function showStatus(sel, text) {
  const el = $(sel);
  el.textContent = text;
  el.classList.add("show");
}
function setPresence(text) {
  $("#presence").textContent = text;
}
function setConnection(kind, title, detail) {
  $("#connectionDot").className = `dot ${kind}`;
  $("#connectionTitle").textContent = title;
  $("#connectionDetail").textContent = detail;
}
function randomId(len = 22) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}
function randomPassword(len = 22) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%+-_";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => chars[b % chars.length]).join("");
}
function bytesToB64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(str);
}
function b64ToBytes(str) {
  const raw = atob(str);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[m]));
}
function fmtTime(ts = Date.now()) {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function parseInvite() {
  return new URLSearchParams(location.hash.replace(/^#/, "")).get("peer");
}
function buildInvite(peerId) {
  return `${location.origin}${location.pathname}#peer=${encodeURIComponent(peerId)}`;
}
function displayName(profile) {
  const full = `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim();
  return full || (profile?.username ? `@${profile.username}` : "Misafir");
}
function safeProfile(profile) {
  const username = String(profile?.username || "").trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 24);
  const avatar = typeof profile?.avatar === "string" && /^data:image\/(?:jpeg|png|webp);base64,/i.test(profile.avatar) && profile.avatar.length < 180000
    ? profile.avatar : "";
  return {
    firstName: String(profile?.firstName || "").trim().slice(0, 32),
    lastName: String(profile?.lastName || "").trim().slice(0, 32),
    username: username || `user_${randomId(5).toLowerCase()}`,
    avatar
  };
}
function avatarOf(profile) {
  return profile?.avatar || DEFAULT_AVATAR;
}
function roleOf(peerId) {
  if (!peerId) return "member";
  if (peerId === state.hostPeerId) return "owner";
  return state.roles.get(peerId) || "member";
}
function roleLabel(role) {
  return ({ owner:"Yönetici", moderator:"Moderatör", member:"Üye" })[role] || "Üye";
}
function canModeratePeer(actorId, targetId, action) {
  if (!actorId || !targetId || actorId === targetId) return false;
  const actor = roleOf(actorId);
  const target = roleOf(targetId);

  if (action === "promote" || action === "demote") return actor === "owner" && target !== "owner";
  if (actor === "owner") return target !== "owner";
  if (actor === "moderator") return target === "member";
  return false;
}
function canDeleteMessage(actorId, message) {
  if (!actorId || !message) return false;
  if (message.senderId === actorId) return true;
  const actorRole = roleOf(actorId);
  const senderRole = roleOf(message.senderId);
  if (actorRole === "owner") return senderRole !== "owner" || actorId === message.senderId;
  if (actorRole === "moderator") return senderRole === "member";
  return false;
}

async function deriveKeys(password, context) {
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = await crypto.subtle.digest("SHA-256", enc.encode(`EBS-MULTI|${context}`));
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt, iterations:PBKDF2_ITERATIONS }, material, 512));
  const encRaw = bits.slice(0, 32);
  const authRaw = bits.slice(32, 64);
  state.encKey = await crypto.subtle.importKey("raw", encRaw, "AES-GCM", false, ["encrypt", "decrypt"]);
  state.authKey = await crypto.subtle.importKey("raw", authRaw, { name:"HMAC", hash:"SHA-256" }, false, ["sign", "verify"]);
  bits.fill(0); encRaw.fill(0); authRaw.fill(0);
}
async function encryptObject(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv }, state.encKey, enc.encode(JSON.stringify(obj))));
  return { v:1, iv:bytesToB64(iv), data:bytesToB64(cipher) };
}
async function decryptObject(envelope) {
  const plain = await crypto.subtle.decrypt({ name:"AES-GCM", iv:b64ToBytes(envelope.iv) }, state.encKey, b64ToBytes(envelope.data));
  return JSON.parse(dec.decode(plain));
}
async function hmac(text) {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", state.authKey, enc.encode(text)));
  return bytesToB64(sig);
}
async function verifyHmac(text, sig) {
  return crypto.subtle.verify("HMAC", state.authKey, b64ToBytes(sig), enc.encode(text));
}

function makePeer(customId) {
  const options = {
    debug: 1,
    config: {
      iceServers: [{ urls:"stun:stun.l.google.com:19302" }],
      sdpSemantics: "unified-plan"
    }
  };
  return customId ? new Peer(customId, options) : new Peer(options);
}

function currentRoster() {
  return [...state.participants.entries()].map(([id, profile]) => ({
    id,
    profile,
    role: roleOf(id)
  }));
}
function refreshParticipantUI() {
  const list = currentRoster();
  if (!list.length) list.push({ id:"self-temp", profile:state.selfProfile, role:state.role === "host" ? "owner" : "member" });

  $("#participantCount").textContent = list.length;
  $("#participantsModalCount").textContent = list.length;
  $("#sidePresence").textContent = list.length > 1 ? `${list.length} kişi odada` : "yalnızsınız";

  const side = $("#participantsList");
  const modal = $("#participantsModalList");
  side.innerHTML = "";
  modal.innerHTML = "";

  for (const item of list) {
    const me = item.id === state.myPeerId || item.id === "self-temp";
    const role = item.role || roleOf(item.id);

    const mini = document.createElement("div");
    mini.className = "participant-mini";
    mini.dataset.peerId = item.id;
    mini.innerHTML = `
      <img src="${avatarOf(item.profile)}" alt="">
      <span><strong>${esc(displayName(item.profile))}</strong><small>@${esc(item.profile.username)}</small></span>
      <span class="role-badge ${esc(role)}">${esc(roleLabel(role))}</span>`;
    mini.addEventListener("click", () => openParticipantProfile(item.id));
    side.appendChild(mini);

    const row = document.createElement("div");
    row.className = "participant-row";
    row.dataset.peerId = item.id;
    row.innerHTML = `
      <img src="${avatarOf(item.profile)}" alt="">
      <span>
        <strong>${esc(displayName(item.profile))}</strong>
        <small class="participant-meta">@${esc(item.profile.username)} <span class="role-badge ${esc(role)}">${esc(roleLabel(role))}</span></small>
      </span>
      <em>${me ? "Siz" : "çevrimiçi"}</em>`;
    row.addEventListener("click", () => openParticipantProfile(item.id));
    modal.appendChild(row);
  }
}
function updateSelfProfileUI() {
  const p = state.selfProfile;
  $("#sideAvatar").src = avatarOf(p);
  $("#sideProfileName").textContent = displayName(p);
  $("#sideProfileUser").textContent = `@${p.username}`;
  $("#profilePreview").src = avatarOf(p);
  $("#profileFirstName").value = p.firstName;
  $("#profileLastName").value = p.lastName;
  $("#profileUsername").value = p.username;
}
function setSelfParticipant() {
  if (!state.myPeerId) return;
  state.participants.set(state.myPeerId, state.selfProfile);
  if (!state.roles.has(state.myPeerId)) {
    state.roles.set(state.myPeerId, state.role === "host" ? "owner" : "member");
  }
  refreshParticipantUI();
}

function cleanupPeer() {
  try { leaveGroupCall(false); } catch {}
  try { state.hostConn?.close(); } catch {}
  for (const entry of state.guests.values()) {
    try { entry.conn.close(); } catch {}
  }
  try { state.peer?.destroy(); } catch {}
  state.peer = null;
  state.hostConn = null;
  state.guests.clear();
  state.verified = false;
  state.participants.clear();
  state.roles.clear();
  state.messages.clear();
  if (state.myPeerId) {
    state.participants.set(state.myPeerId, state.selfProfile);
    state.roles.set(state.myPeerId, state.role === "host" ? "owner" : "member");
  }
  leaveGroupCall(false);
  refreshParticipantUI();
}

function bindPeerEvents(peer) {
  peer.on("error", (err) => {
    console.error(err);
    if (err.type === "peer-unavailable") {
      setConnection("bad", "Oda çevrimdışı", "Davet sahibinin sayfası açık olmalıdır.");
      toast("Oda bulunamadı veya davet sahibi çevrimdışı.");
    } else if (err.type === "unavailable-id") {
      setConnection("bad", "Kimlik kullanılamıyor", "Yeni bir oda oluşturun.");
    } else {
      setConnection("bad", "PeerJS hatası", err.type || "Bağlantı hatası");
    }
  });

  peer.on("call", (call) => {
    handleIncomingMediaCall(call).catch(console.error);
  });

  peer.on("disconnected", () => {
    if (state.verified && (
      state.hostConn?.open ||
      [...state.guests.values()].some((entry) => entry.verified && entry.conn?.open)
    )) {
      setConnection("ok", "Güvenli P2P bağlı", "WebRTC bağlantısı aktif • signaling yeniden bağlanıyor.");
    } else {
      setConnection("warn", "Signaling koptu", "PeerJS yeniden bağlanmayı deneyecek.");
    }
    try { peer.reconnect(); } catch {}
  });
}

async function createRoom() {
  const password = $("#createPassword").value;
  $("#enterChatBtn").textContent = "Sohbete geç";
  if (password.length < 10) {
    showStatus("#createStatus", "Parola en az 10 karakter olmalı.");
    return;
  }

  cleanupPeer();
  const hostId = `ebs-${randomId(30)}`;
  state.hostPeerId = hostId;
  state.roomPassword = password;
  state.roomName = $("#roomNameInput").value.trim().slice(0, 40) || "Güvenli Oda";
  state.role = "host";
  state.verified = true;
  state.roles.clear();
  state.roles.set(hostId, "owner");
  await deriveKeys(password, hostId);

  const peer = makePeer(hostId);
  state.peer = peer;
  bindPeerEvents(peer);
  setConnection("warn", "Oda hazırlanıyor", "PeerJS bağlantısı kuruluyor…");

  peer.on("open", (id) => {
    state.myPeerId = id;
    state.participants.clear();
    state.participants.set(id, state.selfProfile);
    state.roles.set(id, "owner");
    $("#roomTitle").textContent = state.roomName;
    const link = buildInvite(id);
    $("#inviteLink").value = link;
    $("#invitePassword").value = password;
    $("#inviteOutput").classList.remove("hidden");
    // Host URL'sine davet hash'i yazılmaz.
    // Davet linki yalnız aşağıdaki kutudan paylaşılır.
    showStatus("#createStatus", "Oda hazır. Linki ve parolayı paylaşın; sonra Sohbete geç'e basın.");
    setConnection("ok", "Oda hazır", "Katılımcılar bekleniyor.");
    setPresence("katılımcılar bekleniyor");
    refreshParticipantUI();
  });

  peer.on("connection", (conn) => attachHostGuestConnection(conn));
}

async function joinRoom() {
  const password = $("#joinPassword").value;
  if (password.length < 10) {
    showStatus("#joinStatus", "Davet parolasını girin.");
    return;
  }

  cleanupPeer();
  state.roomPassword = password;
  state.role = "guest";
  state.verified = false;
  state.roles.clear();
  await deriveKeys(password, state.hostPeerId);

  const peer = makePeer();
  state.peer = peer;
  bindPeerEvents(peer);
  setConnection("warn", "Bağlanıyor", "Oda sahibine güvenli bağlantı kuruluyor…");

  peer.on("open", (id) => {
    state.myPeerId = id;
    state.participants.clear();
    state.participants.set(id, state.selfProfile);
    state.roles.set(id, "member");
    refreshParticipantUI();

    const conn = peer.connect(state.hostPeerId, {
      reliable: true,
      serialization: "json",
      metadata: { app:"EBS Güvenli WhatsApp", version:2 }
    });
    attachGuestHostConnection(conn);
  });

  $("#joinModal").classList.add("hidden");
}

function attachHostGuestConnection(conn) {
  if (state.guests.size >= MAX_CHAT_USERS - 1) {
    conn.on("open", () => {
      conn.send({ type:"room-full" });
      setTimeout(() => conn.close(), 100);
    });
    return;
  }

  const entry = {
    conn,
    peerId: conn.peer,
    verified: false,
    profile: safeProfile({ username:`user_${randomId(5).toLowerCase()}` }),
    challenge: null,
    chunks: new Map()
  };
  state.guests.set(conn.peer, entry);

  conn.on("open", () => {
    entry.challenge = randomId(30);
    conn.send({ type:"auth-challenge", nonce:entry.challenge });
  });

  conn.on("data", (frame) => {
    handleHostFrame(entry, frame).catch((err) => {
      console.error(err);
      toast("Bir katılımcının güvenli paketi doğrulanamadı.");
    });
  });

  conn.on("close", () => {
    state.guests.delete(conn.peer);
    state.participants.delete(conn.peer);
    state.roles.delete(conn.peer);
    hostCallLeave(conn.peer).catch(() => {});
    refreshParticipantUI();
    broadcastRoomState().catch(() => {});
    const count = state.participants.size;
    if (count > 1) {
      setConnection("ok", "Güvenli P2P bağlı", `${count} kişi odada • şifreli bağlantı aktif.`);
      setPresence(`${count} kişi odada • şifreli`);
      $("#enterChatBtn").textContent = `Sohbete geç • ${count} kişi bağlı`;
    } else {
      setConnection("ok", "Oda hazır", "Katılımcılar bekleniyor.");
      setPresence("katılımcılar bekleniyor");
      $("#enterChatBtn").textContent = "Sohbete geç";
    }
  });

  conn.on("error", console.error);
}

function attachGuestHostConnection(conn) {
  state.hostConn = conn;
  state.hostChunks = new Map();

  conn.on("open", () => {
    setConnection("warn", "P2P bağlantı kuruldu", "Oda sahibiyle veri kanalı açık • parola doğrulanıyor…");
    setPresence("P2P bağlı • parola doğrulanıyor…");

    clearTimeout(state.guestAuthTimer);
    state.guestAuthTimer = setTimeout(() => {
      if (!state.verified && state.hostConn?.open) {
        setConnection("warn", "P2P bağlı • onay bekleniyor", "Parola kanıtı gönderildi; oda sahibinin doğrulama yanıtı bekleniyor.");
        setPresence("P2P bağlı • doğrulama bekleniyor…");
      }
    }, 7000);
  });

  conn.on("data", (frame) => {
    handleGuestFrame(frame).catch((err) => {
      console.error(err);
      toast("Güvenli paket çözülemedi.");
    });
  });

  conn.on("close", () => {
    clearTimeout(state.guestAuthTimer);
    state.verified = false;
    setConnection("bad", "Oda kapandı", "Davet sahibi bağlantıyı kapattı.");
    setPresence("bağlantı kapandı");
    leaveGroupCall(false);
  });
}

async function handleHostFrame(entry, frame) {
  if (!frame || typeof frame !== "object") return;

  if (frame.type === "auth-proof") {
    if (frame.nonce !== entry.challenge) return;
    const text = `EBS-AUTH|${frame.nonce}|${state.hostPeerId}`;
    const ok = await verifyHmac(text, frame.proof).catch(() => false);
    if (!ok) {
      entry.conn.send({ type:"auth-fail" });
      setTimeout(() => entry.conn.close(), 80);
      return;
    }
    entry.verified = true;
    state.participants.set(entry.peerId, entry.profile);
    state.roles.set(entry.peerId, "member");

    entry.conn.send({
      type:"auth-ok",
      roomName:state.roomName,
      participantCount:state.participants.size
    });

    const connectedCount = state.participants.size;
    setConnection(
      "ok",
      "Güvenli P2P bağlı",
      `${connectedCount} kişi odada • parola doğrulandı • şifreli bağlantı aktif.`
    );
    setPresence(`${connectedCount} kişi odada • şifreli`);
    $("#enterChatBtn").textContent = `Sohbete geç • ${connectedCount} kişi bağlı`;

    await sendEncryptedToConn(entry.conn, {
      kind:"room-state",
      roomName:state.roomName,
      participants:currentRoster()
    });
    await broadcastRoomState();
    return;
  }

  if (frame.type === "guest-ready" && entry.verified) {
    entry.profile = safeProfile(frame.profile || entry.profile);
    state.participants.set(entry.peerId, entry.profile);

    const connectedCount = state.participants.size;
    setConnection(
      "ok",
      "Güvenli P2P bağlı",
      `${connectedCount} kişi odada • iki taraflı bağlantı onaylandı.`
    );
    setPresence(`${connectedCount} kişi odada • şifreli`);
    $("#enterChatBtn").textContent = `Sohbete geç • ${connectedCount} kişi bağlı`;

    await sendEncryptedToConn(entry.conn, {
      kind:"room-state",
      roomName:state.roomName,
      participants:currentRoster()
    });
    await broadcastRoomState();
    return;
  }

  if (!entry.verified) return;

  const payload = await consumeSecureFrame(entry.chunks, frame);
  if (!payload) return;
  await hostHandlePayload(entry, payload);
}

async function handleGuestFrame(frame) {
  if (!frame || typeof frame !== "object") return;

  if (frame.type === "room-full") {
    setConnection("bad", "Oda dolu", `Bu P2P oda en fazla ${MAX_CHAT_USERS} kullanıcı destekliyor.`);
    toast("Oda kullanıcı sınırına ulaştı.");
    return;
  }

  if (frame.type === "auth-challenge") {
    setConnection("warn", "Parola doğrulanıyor", "Oda sahibinden güvenlik isteği alındı.");
    setPresence("parola doğrulanıyor…");
    const proof = await hmac(`EBS-AUTH|${frame.nonce}|${state.hostPeerId}`);
    state.hostConn.send({ type:"auth-proof", nonce:frame.nonce, proof });
    return;
  }

  if (frame.type === "auth-ok") {
    clearTimeout(state.guestAuthTimer);
    state.verified = true;

    if (frame.roomName) {
      state.roomName = String(frame.roomName).slice(0, 40);
      $("#roomTitle").textContent = state.roomName;
    }

    const count = Math.max(2, Number(frame.participantCount || state.participants.size || 2));
    setConnection(
      "ok",
      "Güvenli P2P bağlı",
      `${count} kişi odada • parola doğrulandı • bağlantı aktif.`
    );
    setPresence(`${count} kişi odada • şifreli`);
    $("#joinModal").classList.add("hidden");

    state.hostConn.send({
      type:"guest-ready",
      profile:state.selfProfile
    });

    await routeOutgoing({ kind:"profile", profile:state.selfProfile });
    return;
  }

  if (frame.type === "auth-fail") {
    state.verified = false;
    setConnection("bad", "Parola yanlış", "Davet sahibinden doğru parolayı alın.");
    toast("Parola eşleşmiyor.");
    return;
  }

  if (!state.verified) return;
  const payload = await consumeSecureFrame(state.hostChunks, frame);
  if (!payload) return;
  await handleRoomPayload(payload);
}

async function consumeSecureFrame(chunkMap, frame) {
  if (frame.type === "secure") return decryptObject(frame.payload);
  if (frame.type !== "secure-chunk") return null;

  let item = chunkMap.get(frame.id);
  if (!item) {
    item = { parts:new Array(frame.total), count:0, created:Date.now() };
    chunkMap.set(frame.id, item);
  }
  if (item.parts[frame.i] == null) {
    item.parts[frame.i] = frame.data;
    item.count++;
  }
  if (item.count === item.parts.length) {
    chunkMap.delete(frame.id);
    return decryptObject(JSON.parse(item.parts.join("")));
  }

  const cutoff = Date.now() - 120000;
  for (const [id, buffered] of chunkMap) if (buffered.created < cutoff) chunkMap.delete(id);
  return null;
}

async function waitConnBuffer(conn) {
  const dc = conn?.dataChannel;
  if (!dc || dc.bufferedAmount < 512 * 1024) return;
  await new Promise((resolve) => {
    dc.bufferedAmountLowThreshold = 128 * 1024;
    const done = () => {
      dc.removeEventListener("bufferedamountlow", done);
      resolve();
    };
    dc.addEventListener("bufferedamountlow", done, { once:true });
  });
}

async function sendEnvelopeToConn(conn, envelope) {
  if (!conn?.open) return;
  const raw = JSON.stringify(envelope);
  const chunkSize = 12000;
  if (raw.length <= chunkSize) {
    await waitConnBuffer(conn);
    conn.send({ type:"secure", payload:envelope });
    return;
  }

  const id = randomId(14);
  const total = Math.ceil(raw.length / chunkSize);
  for (let i = 0; i < total; i++) {
    await waitConnBuffer(conn);
    conn.send({ type:"secure-chunk", id, i, total, data:raw.slice(i * chunkSize, (i + 1) * chunkSize) });
    if (i % 30 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

async function sendEncryptedToConn(conn, payload) {
  await sendEnvelopeToConn(conn, await encryptObject(payload));
}

async function hostBroadcast(payload, excludePeerId = null) {
  const envelope = await encryptObject(payload);
  const jobs = [];
  for (const [peerId, entry] of state.guests) {
    if (!entry.verified || peerId === excludePeerId) continue;
    jobs.push(sendEnvelopeToConn(entry.conn, envelope));
  }
  await Promise.allSettled(jobs);
}

function stampPayload(payload, senderId, profile) {
  return {
    ...payload,
    senderId,
    senderName:displayName(profile),
    senderUsername:profile?.username || "",
    senderAvatar:profile?.avatar || ""
  };
}

async function routeOutgoing(payload) {
  if (!state.myPeerId) return;
  const stamped = stampPayload(payload, state.myPeerId, state.selfProfile);

  if (state.role === "host") {
    if (payload.kind === "profile") {
      state.participants.set(state.myPeerId, state.selfProfile);
      refreshParticipantUI();
      await broadcastRoomState();
      return;
    }
    if (payload.kind === "moderation-request") {
      await hostExecuteModeration(state.myPeerId, payload);
      return;
    }
    if (payload.kind === "message-edit-request") {
      await hostProcessMessageEdit(state.myPeerId, payload);
      return;
    }
    if (payload.kind === "message-delete-request") {
      await hostProcessMessageDelete(state.myPeerId, payload);
      return;
    }
    if (payload.kind === "call-join") {
      await hostCallJoin(state.myPeerId, payload);
      return;
    }
    if (payload.kind === "call-leave") {
      await hostCallLeave(state.myPeerId, payload.callId);
      return;
    }
    await handleRoomPayload(stamped);
    await hostBroadcast(stamped);
    return;
  }

  if (!state.hostConn?.open || !state.verified) throw new Error("Room connection unavailable");
  await sendEncryptedToConn(state.hostConn, stamped);
}

async function hostHandlePayload(entry, payload) {
  if (payload.kind === "profile") {
    entry.profile = safeProfile(payload.profile);
    state.participants.set(entry.peerId, entry.profile);
    refreshParticipantUI();
    await broadcastRoomState();
    setPresence(`${state.participants.size} kişi odada`);
    return;
  }

  if (payload.kind === "moderation-request") {
    await hostExecuteModeration(entry.peerId, payload);
    return;
  }
  if (payload.kind === "message-edit-request") {
    await hostProcessMessageEdit(entry.peerId, payload);
    return;
  }
  if (payload.kind === "message-delete-request") {
    await hostProcessMessageDelete(entry.peerId, payload);
    return;
  }
  if (payload.kind === "call-join") {
    await hostCallJoin(entry.peerId, payload);
    return;
  }
  if (payload.kind === "call-leave") {
    await hostCallLeave(entry.peerId, payload.callId);
    return;
  }

  const stamped = stampPayload(payload, entry.peerId, entry.profile);
  await handleRoomPayload(stamped);
  await hostBroadcast(stamped, entry.peerId);
}

async function broadcastRoomState() {
  if (state.role !== "host") return;
  const payload = {
    kind:"room-state",
    roomName:state.roomName,
    participants:currentRoster()
  };
  await hostBroadcast(payload);
}

async function handleRoomPayload(p) {
  if (p.kind === "room-state") {
    state.roomName = p.roomName || "Güvenli Oda";
    $("#roomTitle").textContent = state.roomName;
    const next = new Map();
    for (const item of p.participants || []) {
      if (!item?.id) continue;
      next.set(item.id, safeProfile(item.profile));
      state.roles.set(item.id, item.role || (item.id === state.hostPeerId ? "owner" : "member"));
    }
    state.participants = next;
    if (state.myPeerId && !state.participants.has(state.myPeerId)) state.participants.set(state.myPeerId, state.selfProfile);
    if (state.hostPeerId) state.roles.set(state.hostPeerId, "owner");
    refreshParticipantUI();
    if (state.verified) {
      const count = state.participants.size;
      setConnection("ok", "Güvenli P2P bağlı", `${count} kişi odada • şifreli bağlantı aktif.`);
      setPresence(`${count} kişi odada • şifreli`);
    } else {
      setPresence(`${state.participants.size} kişi odada`);
    }
    return;
  }

  if (p.kind === "typing") {
    if (p.senderId !== state.myPeerId) setPresence(p.active ? `${p.senderName} yazıyor…` : `${state.participants.size} kişi odada`);
    return;
  }

  if (p.kind === "read") {
    const tick = document.querySelector(`[data-id="${CSS.escape(p.target)}"] .ticks`);
    if (tick) tick.textContent = "✓✓";
    return;
  }

  if (p.kind === "reaction") {
    applyReaction(p.target, p.emoji);
    return;
  }


  if (p.kind === "message-edit") {
    applyMessageEdit(p.target, p.text, p.editedAt || Date.now());
    return;
  }

  if (p.kind === "message-delete") {
    applyMessageDelete(p.target, p.deletedBy || p.senderId || "");
    return;
  }

  if (p.kind === "moderation-mute") {
    if (p.target === state.myPeerId) {
      if (p.source === "microphone" || p.source === "all") {
        const t = state.localStream?.getAudioTracks()[0];
        if (t) t.enabled = false;
        $("#muteBtn").classList.add("off");
      }
      if (p.source === "camera" || p.source === "all") {
        const t = state.localStream?.getVideoTracks()[0];
        if (t) t.enabled = false;
        $("#cameraBtn").classList.add("off");
      }
      toast("Bir moderatör canlı görüşme cihazınızı kapattı.");
    }
    return;
  }

  if (p.kind === "kicked") {
    if (p.target === state.myPeerId) {
      toast("Oda yöneticisi/moderatörü tarafından odadan çıkarıldınız.");
      leaveGroupCall(false);
      try { state.hostConn?.close(); } catch {}
      setConnection("bad", "Odadan çıkarıldınız", "Bu oturum için bağlantınız kapatıldı.");
      setPresence("odadan çıkarıldı");
    }
    return;
  }

  if (p.kind === "call-state") {
    if (state.groupCall?.id === p.callId) {
      state.groupCall.joiners = new Set(p.joiners || []);
      syncMediaPeers();
      updateCallCount();
    }
    return;
  }

  if (p.kind === "call-full") {
    if (state.groupCall?.id === p.callId) leaveGroupCall(false);
    toast(`Görüşme kapasitesi dolu. Maksimum ${p.max} aktif kullanıcı.`);
    return;
  }

  if (p.kind === "call-invite") {
    if (p.senderId === state.myPeerId) return;
    state.pendingCallInvite = { callId:p.callId, mode:p.mode, from:p.senderName };
    $("#incomingCallText").textContent = `${p.senderName} sizi ${p.mode === "video" ? "görüntülü" : "sesli"} grup görüşmesine davet ediyor.`;
    $("#incomingCallModal").classList.remove("hidden");
    return;
  }


  if (p.senderId === state.myPeerId) return;
  renderMessage(p, "in");
  routeOutgoing({ kind:"read", target:p.id }).catch(() => {});
}

function messageContentHtml(p) {
  if (p.deleted) return `<span class="message-content deleted">🚫 Bu mesaj silindi</span>`;

  if (p.kind === "text") {
    return `<span class="message-content">${esc(p.text || "").replace(/\n/g, "<br>")}</span>`;
  }

  if (["image", "video", "audio", "file"].includes(p.kind)) {
    const bytes = b64ToBytes(p.data);
    const blob = new Blob([bytes], { type:p.mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    if (p.kind === "image") return `<span class="message-content"><img src="${url}" alt="${esc(p.name || "Görsel")}"></span>`;
    if (p.kind === "video") return `<span class="message-content"><video src="${url}" controls playsinline></video></span>`;
    if (p.kind === "audio") {
      return `<span class="message-content"><audio src="${url}" controls preload="metadata"></audio><div class="audio-actions"><a class="audio-download" href="${url}" download="${esc(p.name || "sesli-mesaj.mp3")}">⬇ MP3 indir</a></div></span>`;
    }
    return `<span class="message-content"><a class="file-card" href="${url}" download="${esc(p.name || "dosya")}"><span style="font-size:24px">📄</span><span><b>${esc(p.name || "Dosya")}</b><small>${fmtSize(bytes.length)}</small></span></a></span>`;
  }

  return `<span class="message-content"></span>`;
}

function renderMessage(p, dir) {
  if (!["text", "image", "video", "audio", "file"].includes(p.kind)) return;
  $("#emptyState").classList.add("hidden");

  const stored = { ...p, dir };
  state.messages.set(p.id, stored);

  const el = document.createElement("div");
  el.className = `msg ${dir}`;
  el.dataset.id = p.id || randomId(12);

  let html = "";
  if (dir === "in") {
    html += `<span class="sender-name">${esc(p.senderName || "Katılımcı")} <small>@${esc(p.senderUsername || "")}</small></span>`;
  }
  if (p.reply?.text) html += `<div class="reply-quote">${esc(p.reply.text.slice(0, 110))}</div>`;
  html += messageContentHtml(p);
  html += `<span class="meta">${fmtTime(p.ts)} <span class="edited-label">${p.edited ? "düzenlendi" : ""}</span> ${dir === "out" ? '<span class="ticks">✓</span>' : ""}</span>`;

  el.innerHTML = html;

  const menu = document.createElement("button");
  menu.type = "button";
  menu.className = "msg-menu-btn";
  menu.textContent = "⋮";
  menu.setAttribute("aria-label", "Mesaj işlemleri");
  menu.addEventListener("click", (event) => {
    event.stopPropagation();
    openMessageActions(p.id);
  });
  el.appendChild(menu);

  el.addEventListener("dblclick", () => setReply(state.messages.get(p.id) || p));
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openMessageActions(p.id);
  });

  $("#messages").appendChild(el);
  $("#chatArea").scrollTop = $("#chatArea").scrollHeight;
}

function applyMessageEdit(target, text, editedAt = Date.now()) {
  const item = state.messages.get(target);
  if (!item || item.deleted || item.kind !== "text") return;
  item.text = String(text || "").slice(0, 6000);
  item.edited = true;
  item.editedAt = editedAt;
  state.messages.set(target, item);

  const el = document.querySelector(`[data-id="${CSS.escape(target)}"]`);
  if (!el) return;
  const content = el.querySelector(".message-content");
  if (content) {
    content.classList.remove("deleted");
    content.innerHTML = esc(item.text).replace(/\n/g, "<br>");
  }
  const edited = el.querySelector(".edited-label");
  if (edited) edited.textContent = "düzenlendi";
}

function applyMessageDelete(target, deletedBy = "") {
  const item = state.messages.get(target);
  if (!item) return;
  item.deleted = true;
  item.deletedBy = deletedBy;
  state.messages.set(target, item);

  const el = document.querySelector(`[data-id="${CSS.escape(target)}"]`);
  if (!el) return;

  const content = el.querySelector(".message-content");
  if (content) {
    content.className = "message-content deleted";
    content.innerHTML = "🚫 Bu mesaj silindi";
  }
  el.querySelector(".reply-quote")?.remove();
  const edited = el.querySelector(".edited-label");
  if (edited) edited.textContent = "";
}

function openMessageActions(messageId) {
  const message = state.messages.get(messageId);
  if (!message) return;

  state.selectedMessageId = messageId;
  const own = message.senderId === state.myPeerId;
  const canEdit = own && message.kind === "text" && !message.deleted;
  const canDelete = !message.deleted && canDeleteMessage(state.myPeerId, message);

  $("#messageEditAction").classList.toggle("hidden", !canEdit);
  $("#messageDeleteAction").classList.toggle("hidden", !canDelete);
  $("#messageReplyAction").classList.toggle("hidden", !!message.deleted);
  $("#messageReactAction").classList.toggle("hidden", !!message.deleted);
  $("#messageActionsModal").classList.remove("hidden");
}

async function requestMessageEdit(target, text) {
  const message = state.messages.get(target);
  if (!message || message.senderId !== state.myPeerId || message.kind !== "text" || message.deleted) return;
  const clean = String(text || "").trim().slice(0, 6000);
  if (!clean) return;

  if (state.role === "host") {
    await hostProcessMessageEdit(state.myPeerId, { target, text:clean });
  } else {
    await routeOutgoing({ kind:"message-edit-request", target, text:clean });
  }
}

async function requestMessageDelete(target) {
  const message = state.messages.get(target);
  if (!message || !canDeleteMessage(state.myPeerId, message)) return;

  if (state.role === "host") {
    await hostProcessMessageDelete(state.myPeerId, { target });
  } else {
    await routeOutgoing({ kind:"message-delete-request", target });
  }
}

async function hostProcessMessageEdit(actorId, payload) {
  const message = state.messages.get(payload.target);
  if (!message || message.deleted || message.kind !== "text" || message.senderId !== actorId) return;

  const clean = String(payload.text || "").trim().slice(0, 6000);
  if (!clean) return;

  const event = {
    kind:"message-edit",
    target:payload.target,
    text:clean,
    editedAt:Date.now(),
    senderId:actorId
  };
  applyMessageEdit(event.target, event.text, event.editedAt);
  await hostBroadcast(event);
}

async function hostProcessMessageDelete(actorId, payload) {
  const message = state.messages.get(payload.target);
  if (!message || message.deleted || !canDeleteMessage(actorId, message)) return;

  const event = {
    kind:"message-delete",
    target:payload.target,
    deletedBy:actorId,
    ts:Date.now()
  };
  applyMessageDelete(event.target, actorId);
  await hostBroadcast(event);
}

async function sendPayload(payload) {
  const canSend = state.role === "host" ? state.guests.size > 0 : state.verified;
  if (!canSend) {
    toast("Önce en az bir katılımcı bağlanmalı.");
    return;
  }

  const p = {
    ...payload,
    id:payload.id || randomId(16),
    ts:Date.now(),
    ...(state.pendingReply ? { reply:state.pendingReply } : {})
  };
  const stamped = stampPayload(p, state.myPeerId, state.selfProfile);
  renderMessage(stamped, "out");
  state.pendingReply = null;
  $("#replyBar").classList.remove("show");
  await routeOutgoing(p);
}

async function sendText() {
  const input = $("#messageInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  await sendPayload({ kind:"text", text });
}

function setReply(p) {
  if (!p || p.deleted) return;
  state.pendingReply = {
    id:p.id,
    text:p.text || p.name || ({ image:"Fotoğraf", video:"Video", audio:"Sesli mesaj", file:"Dosya" }[p.kind] || p.kind)
  };
  $("#replyPreview").textContent = state.pendingReply.text;
  $("#replyBar").classList.add("show");
}

function applyReaction(target, emoji) {
  const msg = document.querySelector(`[data-id="${CSS.escape(target)}"]`);
  if (!msg) return;
  let r = msg.querySelector(".reaction");
  if (!r) {
    r = document.createElement("span");
    r.className = "reaction";
    msg.appendChild(r);
  }
  r.textContent = emoji;
}

async function reactTo(target) {
  const emoji = prompt("Tepki emojisi:", "❤️");
  if (!emoji) return;
  const value = emoji.slice(0, 8);
  applyReaction(target, value);
  await routeOutgoing({ kind:"reaction", target, emoji:value });
}

async function fileToMessage(file, forcedKind = "auto") {
  if (!file) return;
  if (file.size > MAX_FILE) {
    toast(`Performans için dosya sınırı ${fmtSize(MAX_FILE)}.`);
    return;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let kind = forcedKind;
  if (kind === "auto") {
    if (file.type.startsWith("image/")) kind = "image";
    else if (file.type.startsWith("video/")) kind = "video";
    else if (file.type.startsWith("audio/")) kind = "audio";
    else kind = "file";
  }
  await sendPayload({ kind, name:file.name, mime:file.type || "application/octet-stream", data:bytesToB64(bytes) });
}

function floatTo16Bit(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function blobToMp3(blob) {
  if (!window.lamejs?.Mp3Encoder) throw new Error("lamejs unavailable");
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error("AudioContext unavailable");

  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = Math.min(2, buffer.numberOfChannels || 1);
    const rate = Math.min(48000, Math.max(8000, buffer.sampleRate));
    const left = floatTo16Bit(buffer.getChannelData(0));
    const right = channels === 2 ? floatTo16Bit(buffer.getChannelData(1)) : null;
    const encoder = new lamejs.Mp3Encoder(channels, rate, 96);
    const chunks = [];
    const block = 1152;

    for (let i = 0; i < left.length; i += block) {
      const l = left.subarray(i, i + block);
      const mp3buf = channels === 2 ? encoder.encodeBuffer(l, right.subarray(i, i + block)) : encoder.encodeBuffer(l);
      if (mp3buf.length) chunks.push(new Int8Array(mp3buf));
    }
    const end = encoder.flush();
    if (end.length) chunks.push(new Int8Array(end));
    return new Blob(chunks, { type:"audio/mpeg" });
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function startRecording(kind) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast("Tarayıcı kayıt özelliğini desteklemiyor.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === "video"
        ? { audio:true, video:{ facingMode:"user", width:{ ideal:720 }, height:{ ideal:720 } } }
        : { audio:true }
    );

    state.recordStream = stream;
    state.recordChunks = [];
    state.recordCancelled = false;
    state.recordStarted = Date.now();

    const candidates = kind === "video"
      ? ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

    const recorder = new MediaRecorder(stream, mime ? { mimeType:mime } : undefined);
    state.recorder = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size) state.recordChunks.push(e.data); };
    recorder.onstop = async () => {
      clearInterval(state.recordTimer);
      $("#recordBar").classList.add("hidden");
      stream.getTracks().forEach((t) => t.stop());
      if (state.recordCancelled) return;

      const sourceBlob = new Blob(state.recordChunks, { type:mime || recorder.mimeType });
      if (sourceBlob.size > MAX_FILE) {
        toast("Kayıt dosya sınırını aştı.");
        return;
      }

      if (kind === "audio") {
        toast("Sesli mesaj MP3'e dönüştürülüyor…");
        try {
          const mp3 = await blobToMp3(sourceBlob);
          if (mp3.size > MAX_FILE) throw new Error("mp3 too large");
          await sendPayload({
            kind:"audio",
            name:`sesli-mesaj-${Date.now()}.mp3`,
            mime:"audio/mpeg",
            data:bytesToB64(new Uint8Array(await mp3.arrayBuffer()))
          });
        } catch (err) {
          console.error(err);
          toast("Bu tarayıcıda MP3 dönüştürme başarısız oldu.");
        }
      } else {
        await sendPayload({
          kind:"video",
          name:`video-mesaj-${Date.now()}.webm`,
          mime:sourceBlob.type,
          data:bytesToB64(new Uint8Array(await sourceBlob.arrayBuffer()))
        });
      }
    };

    recorder.start(250);
    $("#recordBar").classList.remove("hidden");
    $("#recordLabel").textContent = kind === "video" ? "Görüntülü mesaj kaydediliyor…" : "Sesli mesaj kaydediliyor…";
    const tick = () => {
      const s = Math.floor((Date.now() - state.recordStarted) / 1000);
      $("#recordTime").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };
    tick();
    state.recordTimer = setInterval(tick, 500);
  } catch {
    toast("Mikrofon/kamera izni verilmedi.");
  }
}

async function processAvatar(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("image required");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = 180;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/jpeg", 0.76);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function saveProfile() {
  const next = safeProfile({
    firstName:$("#profileFirstName").value,
    lastName:$("#profileLastName").value,
    username:$("#profileUsername").value,
    avatar:state.selfProfile.avatar
  });
  state.selfProfile = next;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    toast("Profil tarayıcıya kaydedilemedi; depolama alanı dolu olabilir.");
  }
  updateSelfProfileUI();
  setSelfParticipant();
  $("#profileModal").classList.add("hidden");

  if (state.myPeerId) {
    try { await routeOutgoing({ kind:"profile", profile:next }); } catch {}
  }
  toast("Profil güncellendi.");
}


function openParticipantProfile(peerId) {
  if (!peerId || peerId === "self-temp") peerId = state.myPeerId;
  const profile = state.participants.get(peerId) || (peerId === state.myPeerId ? state.selfProfile : null);
  if (!profile) return;

  state.selectedParticipantId = peerId;
  const role = roleOf(peerId);
  $("#viewProfileAvatar").src = avatarOf(profile);
  $("#viewProfileName").textContent = displayName(profile);
  $("#viewProfileUsername").textContent = `@${profile.username || "kullanici"}`;
  $("#viewProfileRole").className = `role-badge ${role}`;
  $("#viewProfileRole").textContent = roleLabel(role);
  $("#viewProfileStatus").textContent = peerId === state.myPeerId ? "Siz" : "Çevrimiçi";

  const localRole = roleOf(state.myPeerId);
  const targetIsSelf = peerId === state.myPeerId;
  const canAnyModerate = !targetIsSelf && (
    localRole === "owner" ||
    (localRole === "moderator" && role === "member")
  );

  $("#participantAdminActions").classList.toggle("hidden", !canAnyModerate);

  if (localRole === "owner" && !targetIsSelf && role !== "owner") {
    $("#roleToggleBtn").classList.remove("hidden");
    $("#roleToggleBtn").textContent = role === "moderator" ? "Moderatörlüğü kaldır" : "Moderatör yap";
    $("#roleToggleBtn").dataset.action = role === "moderator" ? "demote" : "promote";
  } else {
    $("#roleToggleBtn").classList.add("hidden");
  }

  $("#muteParticipantAudioBtn").classList.toggle("hidden", !canAnyModerate);
  $("#muteParticipantVideoBtn").classList.toggle("hidden", !canAnyModerate);
  $("#kickParticipantBtn").classList.toggle("hidden", !canAnyModerate);

  $("#participantProfileModal").classList.remove("hidden");
}

async function requestModeration(action, targetId, extra = {}) {
  if (!targetId || !canModeratePeer(state.myPeerId, targetId, action)) {
    toast("Bu işlem için yetkiniz yok.");
    return;
  }

  const payload = { kind:"moderation-request", action, target:targetId, ...extra };
  if (state.role === "host") {
    await hostExecuteModeration(state.myPeerId, payload);
  } else {
    await routeOutgoing(payload);
  }
}

async function hostExecuteModeration(actorId, payload) {
  const action = String(payload.action || "");
  const targetId = String(payload.target || "");
  if (!canModeratePeer(actorId, targetId, action)) return;

  if (action === "promote" || action === "demote") {
    if (roleOf(actorId) !== "owner") return;
    state.roles.set(targetId, action === "promote" ? "moderator" : "member");
    await broadcastRoomState();
    refreshParticipantUI();
    if (state.selectedParticipantId === targetId) openParticipantProfile(targetId);
    toast(action === "promote" ? "Katılımcı moderatör yapıldı." : "Moderatör yetkisi kaldırıldı.");
    return;
  }

  if (action === "kick") {
    const targetEntry = state.guests.get(targetId);
    if (targetEntry?.verified) {
      await sendEncryptedToConn(targetEntry.conn, {
        kind:"kicked",
        target:targetId,
        by:actorId
      }).catch(() => {});
    }

    // Backend yok: çıkarma işlemi host'un şifreli PeerJS bağlantısını kapatmasıyla uygulanır.
    // Kullanıcı link+parolaya hâlâ sahipse yeni bir geçici Peer ID ile tekrar katılabilir.
    setTimeout(() => {
      try { targetEntry?.conn.close(); } catch {}
      state.guests.delete(targetId);
      state.participants.delete(targetId);
      state.roles.delete(targetId);
      refreshParticipantUI();
      broadcastRoomState().catch(() => {});
    }, 120);

    $("#participantProfileModal").classList.add("hidden");
    toast("Katılımcı odadan çıkarıldı.");
    return;
  }

  if (action === "mute-audio" || action === "mute-video") {
    const source = action === "mute-audio" ? "microphone" : "camera";
    const targetEntry = state.guests.get(targetId);
    if (targetEntry?.verified) {
      await sendEncryptedToConn(targetEntry.conn, {
        kind:"moderation-mute",
        target:targetId,
        source,
        by:actorId
      }).catch(() => {});
    }
    // Backend yok: hedef istemciye AES şifreli moderasyon komutu gönderilir.
    toast(source === "microphone" ? "Katılımcının mikrofonu kapatma komutu gönderildi." : "Katılımcının kamera kapatma komutu gönderildi.");
  }
}

async function captureScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast("Ekran yakalama desteklenmiyor.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:false });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 250));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    stream.getTracks().forEach((t) => t.stop());
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.84));
    if (!blob || blob.size > MAX_FILE) throw new Error("too large");
    await sendPayload({ kind:"image", name:"ekran-goruntusu.jpg", mime:"image/jpeg", data:bytesToB64(new Uint8Array(await blob.arrayBuffer())) });
  } catch {}
}

/* ===== v5 GitHub Pages-only: PeerJS/WebRTC P2P grup medya ===== */
async function inviteGroupCall(mode) {
  const total = state.participants.size;
  const max = mode === "video" ? MAX_VIDEO_CALL_USERS : MAX_AUDIO_CALL_USERS;
  if (total < 2) {
    toast("Grup görüşmesi için en az iki kişi olmalı.");
    return;
  }
  if (total > max) {
    toast(`${mode === "video" ? "Görüntülü" : "Sesli"} P2P görüşme bu sürümde en fazla ${max} aktif kullanıcı için sınırlandırıldı.`);
    return;
  }

  const callId = `call-${randomId(18)}`;
  state.pendingCallInvite = null;
  await joinGroupCall(callId, mode, true);
  await routeOutgoing({ kind:"call-invite", callId, mode });
}

async function joinGroupCall(callId, mode, initiator = false) {
  if (state.groupCall?.joined) leaveGroupCall(true);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:mode === "video" });
    state.localStream = stream;
    state.groupCall = { id:callId, mode, joined:true, joiners:new Set([state.myPeerId]), initiator };
    state.callMode = mode;
    $("#localVideo").srcObject = stream;
    $("#localVideo").classList.toggle("hidden", mode !== "video");
    $("#callLayer").classList.remove("hidden");
    $("#callTitle").textContent = mode === "video" ? "Grup görüntülü görüşme" : "Grup sesli görüşme";
    $("#callStatus").textContent = initiator ? "Katılımcılar bekleniyor…" : "Görüşmeye katıldınız";
    $("#cameraBtn").style.display = mode === "video" ? "" : "none";
    $("#screenShareBtn").style.display = mode === "video" ? "" : "none";
    updateCallCount();
    await routeOutgoing({ kind:"call-join", callId, mode });
  } catch {
    toast("Mikrofon/kamera izni verilmedi.");
  }
}

async function hostCallJoin(peerId, payload) {
  const max = payload.mode === "video" ? MAX_VIDEO_CALL_USERS : MAX_AUDIO_CALL_USERS;
  if (!state.callCoordinator || state.callCoordinator.id !== payload.callId) {
    state.callCoordinator = { id:payload.callId, mode:payload.mode, joiners:new Set() };
  }
  if (state.callCoordinator.joiners.size >= max && !state.callCoordinator.joiners.has(peerId)) {
    const entry = state.guests.get(peerId);
    if (entry?.verified) {
      await sendEncryptedToConn(entry.conn, { kind:"call-full", callId:payload.callId, max });
    }
    return;
  }
  state.callCoordinator.joiners.add(peerId);
  if (state.groupCall?.id === payload.callId) {
    state.groupCall.joiners = new Set(state.callCoordinator.joiners);
    syncMediaPeers();
  }
  await hostBroadcast({
    kind:"call-state",
    callId:payload.callId,
    mode:payload.mode,
    joiners:[...state.callCoordinator.joiners]
  });
}

async function hostCallLeave(peerId, callId = null) {
  if (!state.callCoordinator) return;
  if (callId && state.callCoordinator.id !== callId) return;
  state.callCoordinator.joiners.delete(peerId);
  if (state.groupCall?.id === state.callCoordinator.id) {
    state.groupCall.joiners = new Set(state.callCoordinator.joiners);
    syncMediaPeers();
  }
  if (state.callCoordinator.joiners.size === 0) {
    state.callCoordinator = null;
    return;
  }
  await hostBroadcast({
    kind:"call-state",
    callId:state.callCoordinator.id,
    mode:state.callCoordinator.mode,
    joiners:[...state.callCoordinator.joiners]
  });
}

function updateCallCount() {
  const count = state.groupCall?.joiners?.size || 1;
  $("#callMemberCount").textContent = `${count} kişi`;
}

function syncMediaPeers() {
  if (!state.groupCall?.joined) return;
  const joiners = state.groupCall.joiners || new Set();
  updateCallCount();

  for (const peerId of joiners) {
    if (peerId === state.myPeerId) continue;
    if (state.myPeerId.localeCompare(peerId) < 0 && !state.mediaCalls.has(peerId)) {
      callMediaPeer(peerId).catch(console.error);
    }
  }

  for (const [peerId, call] of [...state.mediaCalls]) {
    if (!joiners.has(peerId)) {
      try { call.close(); } catch {}
      removeRemoteTile(peerId);
      state.mediaCalls.delete(peerId);
    }
  }
}

async function callMediaPeer(peerId) {
  if (!state.peer || !state.localStream || !state.groupCall?.joined) return;
  const call = state.peer.call(peerId, state.localStream, {
    metadata:{ app:"EBS Güvenli WhatsApp", group:true, callId:state.groupCall.id, mode:state.groupCall.mode }
  });
  bindMediaCall(call, peerId);
}

async function handleIncomingMediaCall(call) {
  const meta = call.metadata || {};
  const validParticipant = state.participants.has(call.peer);
  if (!meta.group || !state.groupCall?.joined || meta.callId !== state.groupCall.id || !validParticipant || !state.localStream) {
    call.close();
    return;
  }
  bindMediaCall(call, call.peer);
  call.answer(state.localStream);
}

function bindMediaCall(call, peerId) {
  if (state.mediaCalls.has(peerId)) {
    try { call.close(); } catch {}
    return;
  }
  state.mediaCalls.set(peerId, call);
  call.on("stream", (stream) => createRemoteTile(peerId, stream));
  call.on("close", () => {
    state.mediaCalls.delete(peerId);
    removeRemoteTile(peerId);
  });
  call.on("error", () => {
    state.mediaCalls.delete(peerId);
    removeRemoteTile(peerId);
  });
}

function createRemoteTile(peerId, stream) {
  let tile = document.querySelector(`[data-call-peer="${CSS.escape(peerId)}"]`);
  if (!tile) {
    tile = document.createElement("div");
    tile.className = "remote-tile";
    tile.dataset.callPeer = peerId;
    $("#remoteGrid").appendChild(tile);
  }
  tile.innerHTML = "";
  const profile = state.participants.get(peerId) || { username:"katilimci" };
  const hasVideo = stream.getVideoTracks().length > 0 && state.groupCall?.mode === "video";

  if (hasVideo) {
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    tile.appendChild(video);
  } else {
    const avatar = document.createElement("img");
    avatar.className = "audio-avatar";
    avatar.src = avatarOf(profile);
    avatar.alt = "";
    tile.appendChild(avatar);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.srcObject = stream;
    tile.appendChild(audio);
  }

  const name = document.createElement("span");
  name.className = "tile-name";
  name.textContent = displayName(profile);
  tile.appendChild(name);
}

function removeRemoteTile(peerId) {
  document.querySelector(`[data-call-peer="${CSS.escape(peerId)}"]`)?.remove();
}

function leaveGroupCall(sendNotice = true) {
  if (!state.groupCall) return;
  const callId = state.groupCall.id;
  if (sendNotice && state.myPeerId) routeOutgoing({ kind:"call-leave", callId }).catch(() => {});

  for (const call of state.mediaCalls.values()) {
    try { call.close(); } catch {}
  }
  state.mediaCalls.clear();
  state.localStream?.getTracks().forEach((t) => t.stop());
  state.screenStream?.getTracks().forEach((t) => t.stop());
  state.localStream = null;
  state.screenStream = null;
  state.groupCall = null;
  $("#remoteGrid").innerHTML = "";
  $("#localVideo").srcObject = null;
  $("#localVideo").classList.add("hidden");
  $("#callLayer").classList.add("hidden");
}

async function toggleScreenShare() {
  if (!state.groupCall?.joined || state.groupCall.mode !== "video" || !navigator.mediaDevices?.getDisplayMedia) return;

  try {
    if (state.screenStream) {
      const camTrack = state.localStream?.getVideoTracks()[0];
      for (const call of state.mediaCalls.values()) {
        const sender = call.peerConnection?.getSenders().find((s) => s.track?.kind === "video");
        if (sender && camTrack) await sender.replaceTrack(camTrack);
      }
      state.screenStream.getTracks().forEach((t) => t.stop());
      state.screenStream = null;
      $("#screenShareBtn").classList.remove("off");
      return;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({ video:true });
    const screenTrack = stream.getVideoTracks()[0];
    for (const call of state.mediaCalls.values()) {
      const sender = call.peerConnection?.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);
    }
    state.screenStream = stream;
    $("#screenShareBtn").classList.add("off");
    screenTrack.onended = () => { if (state.screenStream) toggleScreenShare().catch(() => {}); };
  } catch {}
}


function closePopovers() {
  $("#emojiPopover").classList.add("hidden");
  $("#attachPopover").classList.add("hidden");
}

const emojiList = ("😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😎 🤓 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 🤗 🤔 🫡 🤭 🤫 😶 😐 😬 🙄 😴 🤤 😷 🤒 🤕 🤢 🤮 🤧 😈 👿 💀 👻 👽 🤖 💩 😺 😸 😹 😻 😼 🙀 😿 😾 🙌 👏 👍 👎 👊 ✊ 🤞 ✌️ 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 💪 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 🔥 ✨ 🎉 🎊 ✅ ❌ ⚠️ 🚀 📞 📹 🎙️ 🔒").split(" ");
for (const emoji of emojiList) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = emoji;
  b.onclick = () => {
    $("#messageInput").value += emoji;
    $("#messageInput").focus();
  };
  $("#emojiGrid").appendChild(b);
}

$("#sendBtn").onclick = sendText;
$("#messageInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendText();
  }
});

let typingTimer;
$("#messageInput").addEventListener("input", () => {
  const connected = state.role === "host" ? state.guests.size > 0 : state.verified;
  if (!connected) return;
  routeOutgoing({ kind:"typing", active:true }).catch(() => {});
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => routeOutgoing({ kind:"typing", active:false }).catch(() => {}), 900);
});

$("#cancelReplyBtn").onclick = () => {
  state.pendingReply = null;
  $("#replyBar").classList.remove("show");
};

$("#emojiBtn").onclick = () => {
  $("#emojiPopover").classList.toggle("hidden");
  $("#attachPopover").classList.add("hidden");
};
$("#attachBtn").onclick = () => {
  $("#attachPopover").classList.toggle("hidden");
  $("#emojiPopover").classList.add("hidden");
};
$$('.close-pop').forEach((b) => b.onclick = closePopovers);

$("#photoBtn").onclick = () => { closePopovers(); $("#photoInput").click(); };
$("#videoBtn").onclick = () => { closePopovers(); $("#videoInput").click(); };
$("#fileBtn").onclick = () => { closePopovers(); $("#fileInput").click(); };
$("#gifBtn").onclick = () => { closePopovers(); $("#gifInput").click(); };
$("#videoNoteBtn").onclick = () => { closePopovers(); startRecording("video"); };
$("#screenShotBtn").onclick = () => { closePopovers(); captureScreen(); };

$("#photoInput").onchange = (e) => e.target.files[0] && fileToMessage(e.target.files[0], "image");
$("#videoInput").onchange = (e) => e.target.files[0] && fileToMessage(e.target.files[0], "video");
$("#gifInput").onchange = (e) => e.target.files[0] && fileToMessage(e.target.files[0], "image");
$("#fileInput").onchange = (e) => e.target.files[0] && fileToMessage(e.target.files[0], "auto");

$("#voiceNoteBtn").onclick = () => startRecording("audio");
$("#sendRecordBtn").onclick = () => state.recorder?.stop();
$("#cancelRecordBtn").onclick = () => {
  state.recordCancelled = true;
  state.recorder?.stop();
};

$("#profileBtn").onclick = () => {
  updateSelfProfileUI();
  $("#profileModal").classList.remove("hidden");
};
$("#avatarPickBtn").onclick = () => $("#profileImageInput").click();
$("#profileImageInput").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    state.selfProfile.avatar = await processAvatar(file);
    $("#profilePreview").src = state.selfProfile.avatar;
  } catch {
    toast("Profil resmi işlenemedi.");
  }
};
$("#saveProfileBtn").onclick = saveProfile;
$("#clearStoredProfileBtn").onclick = async () => {
  if (!confirm("Bu tarayıcıda kayıtlı profil bilgileri silinsin mi?")) return;
  try { localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
  state.selfProfile = {
    firstName:"",
    lastName:"",
    username:`misafir_${Math.random().toString(36).slice(2, 7)}`,
    avatar:""
  };
  updateSelfProfileUI();
  setSelfParticipant();
  $("#profileFirstName").value = "";
  $("#profileLastName").value = "";
  $("#profileUsername").value = state.selfProfile.username;
  $("#profilePreview").src = DEFAULT_AVATAR;
  if (state.myPeerId) {
    try { await routeOutgoing({ kind:"profile", profile:state.selfProfile }); } catch {}
  }
  toast("Tarayıcıdaki profil bilgileri silindi.");
};
$("#closeProfileBtn").onclick = () => $("#profileModal").classList.add("hidden");

$("#participantsBtn").onclick = () => {
  refreshParticipantUI();
  $("#participantsModal").classList.remove("hidden");
};
$("#closeParticipantsBtn").onclick = () => $("#participantsModal").classList.add("hidden");


$("#closeParticipantProfileBtn").onclick = () => $("#participantProfileModal").classList.add("hidden");
$("#roleToggleBtn").onclick = async () => {
  const target = state.selectedParticipantId;
  const action = $("#roleToggleBtn").dataset.action;
  if (!target || !action) return;
  await requestModeration(action, target);
};
$("#muteParticipantAudioBtn").onclick = async () => {
  if (state.selectedParticipantId) await requestModeration("mute-audio", state.selectedParticipantId);
};
$("#muteParticipantVideoBtn").onclick = async () => {
  if (state.selectedParticipantId) await requestModeration("mute-video", state.selectedParticipantId);
};
$("#kickParticipantBtn").onclick = async () => {
  const target = state.selectedParticipantId;
  if (!target) return;
  if (!confirm("Bu kullanıcı odadan çıkarılsın mı?")) return;
  await requestModeration("kick", target);
};

$("#closeMessageActionsBtn").onclick = () => $("#messageActionsModal").classList.add("hidden");
$("#messageReplyAction").onclick = () => {
  const message = state.messages.get(state.selectedMessageId);
  $("#messageActionsModal").classList.add("hidden");
  if (message) setReply(message);
};
$("#messageReactAction").onclick = async () => {
  const id = state.selectedMessageId;
  $("#messageActionsModal").classList.add("hidden");
  if (id) await reactTo(id);
};
$("#messageEditAction").onclick = () => {
  const message = state.messages.get(state.selectedMessageId);
  $("#messageActionsModal").classList.add("hidden");
  if (!message || message.kind !== "text" || message.deleted) return;
  $("#editMessageInput").value = message.text || "";
  $("#editMessageModal").classList.remove("hidden");
  $("#editMessageInput").focus();
};
$("#messageDeleteAction").onclick = async () => {
  const id = state.selectedMessageId;
  $("#messageActionsModal").classList.add("hidden");
  if (!id || !confirm("Bu mesaj silinsin mi?")) return;
  await requestMessageDelete(id);
};
$("#saveMessageEditBtn").onclick = async () => {
  const id = state.selectedMessageId;
  const text = $("#editMessageInput").value;
  if (!id) return;
  await requestMessageEdit(id, text);
  $("#editMessageModal").classList.add("hidden");
};
$("#cancelMessageEditBtn").onclick = () => $("#editMessageModal").classList.add("hidden");

$("#voiceCallBtn").onclick = () => inviteGroupCall("audio");
$("#videoCallBtn").onclick = () => inviteGroupCall("video");
$("#acceptCallBtn").onclick = async () => {
  const invite = state.pendingCallInvite;
  $("#incomingCallModal").classList.add("hidden");
  if (!invite) return;
  state.pendingCallInvite = null;
  await joinGroupCall(invite.callId, invite.mode, false);
};
$("#rejectCallBtn").onclick = () => {
  state.pendingCallInvite = null;
  $("#incomingCallModal").classList.add("hidden");
};
$("#hangupBtn").onclick = () => leaveGroupCall(true);
$("#muteBtn").onclick = () => {
  const track = state.localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  $("#muteBtn").classList.toggle("off", !track.enabled);
};
$("#cameraBtn").onclick = () => {
  const track = state.localStream?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  $("#cameraBtn").classList.toggle("off", !track.enabled);
};
$("#screenShareBtn").onclick = toggleScreenShare;

$("#createRoomBtn").onclick = createRoom;
$("#generatePasswordBtn").onclick = () => $("#createPassword").value = randomPassword();
$("#copyGeneratedPasswordBtn").onclick = async () => {
  const input = $("#createPassword");
  const value = input.value;
  if (!value) {
    toast("Önce parola üretin veya yazın.");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    toast("Parola kopyalandı.");
  } catch {
    input.type = "text";
    input.select();
    document.execCommand("copy");
    input.type = "password";
    toast("Parola kopyalandı.");
  }
};
$("#newChatBtn").onclick = () => $("#createModal").classList.remove("hidden");
$("#joinBtn").onclick = joinRoom;

$("#copyLinkBtn").onclick = async () => {
  await navigator.clipboard.writeText($("#inviteLink").value);
  toast("Davet bağlantısı kopyalandı.");
};
$("#copyPasswordBtn").onclick = async () => {
  await navigator.clipboard.writeText($("#invitePassword").value);
  toast("Parola kopyalandı.");
};
$("#shareLinkBtn").onclick = async () => {
  const url = $("#inviteLink").value;
  if (navigator.share) {
    await navigator.share({ title:"EBS Güvenli WhatsApp", text:"Güvenli oda bağlantısı:", url }).catch(() => {});
  } else {
    await navigator.clipboard.writeText(url);
    toast("Bağlantı kopyalandı.");
  }
};
$("#enterChatBtn").onclick = () => {
  $("#createModal").classList.add("hidden");
  const count = state.participants.size;
  if (count > 1) {
    setConnection("ok", "Güvenli P2P bağlı", `${count} kişi odada • şifreli bağlantı aktif.`);
    setPresence(`${count} kişi odada • şifreli`);
  } else {
    setConnection("ok", "Oda hazır", "Katılımcılar bekleniyor.");
    setPresence("katılımcılar bekleniyor");
  }
  $("#messageInput").focus();
};
$("#inviteInfoBtn").onclick = () => {
  if (!state.hostPeerId) {
    $("#createModal").classList.remove("hidden");
    return;
  }
  $("#inviteLink").value = buildInvite(state.hostPeerId);
  $("#invitePassword").value = state.roomPassword;
  $("#inviteOutput").classList.remove("hidden");
  $("#createModal").classList.remove("hidden");
};

$("#securityBtn").onclick = () => $("#securityModal").classList.remove("hidden");
$("#moreBtn").onclick = () => $("#securityModal").classList.remove("hidden");
$("#closeSecurityBtn").onclick = () => $("#securityModal").classList.add("hidden");

$("#chatArea").addEventListener("dragover", (e) => e.preventDefault());
$("#chatArea").addEventListener("drop", (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) fileToMessage(file, "auto");
});
$("#messageInput").addEventListener("paste", (e) => {
  const file = [...(e.clipboardData?.files || [])][0];
  if (file && file.type.startsWith("image/")) {
    e.preventDefault();
    fileToMessage(file, "image");
  }
});

window.addEventListener("beforeunload", cleanupPeer);

(async function init() {
  updateSelfProfileUI();
  refreshParticipantUI();
  const hostPeerId = parseInvite();
  if (hostPeerId) {
    state.hostPeerId = hostPeerId;
    $("#createModal").classList.add("hidden");
    $("#joinModal").classList.remove("hidden");
    $("#hostPeerIdInput").value = hostPeerId;
    setConnection("warn", "Davet bağlantısı açıldı", "Parolayı girerek odaya katılın.");
  } else {
    $("#createModal").classList.remove("hidden");
  }
})();
