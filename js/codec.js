// 온도썬 — 답안 URL 코덱. 20bit 답 + (선택) 4bit MBTI = 24bit(3byte) → base64url.
// prefix: v1 = MBTI 포함, v1n = MBTI 없음. 사람 단위 all-or-nothing.

const PREFIX_MBTI = "v1";
const PREFIX_NOMBTI = "v1n";

function bytesToB64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const out = [];
  for (let i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
  return out;
}

// answers: number[20] (0=A, 1=B). mbti: null | {ei,sn,tf,jp} (0|1).
function encodeToken(answers, mbti) {
  if (!Array.isArray(answers) || answers.length !== 20) throw new Error("answers must be length 20");
  const bits = new Array(24).fill(0);
  for (let i = 0; i < 20; i++) bits[i] = answers[i] ? 1 : 0;
  const hasMbti = mbti && [mbti.ei, mbti.sn, mbti.tf, mbti.jp].every((v) => v === 0 || v === 1);
  if (hasMbti) {
    bits[20] = mbti.ei; bits[21] = mbti.sn; bits[22] = mbti.tf; bits[23] = mbti.jp;
  }
  const bytes = [0, 0, 0];
  for (let i = 0; i < 24; i++) if (bits[i]) bytes[i >> 3] |= 1 << (7 - (i & 7));
  return (hasMbti ? PREFIX_MBTI : PREFIX_NOMBTI) + bytesToB64url(bytes);
}

// 반환: { ok, answers, mbti } | { ok:false, error: "MALFORMED"|"LENGTH"|"VERSION" }
function decodeToken(token) {
  if (typeof token !== "string" || token.length < 3) return { ok: false, error: "MALFORMED" };
  let hasMbti, body;
  if (token.startsWith(PREFIX_NOMBTI)) { hasMbti = false; body = token.slice(PREFIX_NOMBTI.length); }
  else if (token.startsWith(PREFIX_MBTI)) { hasMbti = true; body = token.slice(PREFIX_MBTI.length); }
  else return { ok: false, error: "VERSION" };

  if (!/^[A-Za-z0-9\-_]{4}$/.test(body)) return { ok: false, error: "LENGTH" };
  let bytes;
  try { bytes = b64urlToBytes(body); } catch { return { ok: false, error: "MALFORMED" }; }
  if (bytes.length < 3) return { ok: false, error: "LENGTH" };

  const bits = [];
  for (let i = 0; i < 24; i++) bits.push((bytes[i >> 3] >> (7 - (i & 7))) & 1);
  const answers = bits.slice(0, 20);
  const mbti = hasMbti ? { ei: bits[20], sn: bits[21], tf: bits[22], jp: bits[23] } : null;
  return { ok: true, answers, mbti };
}
