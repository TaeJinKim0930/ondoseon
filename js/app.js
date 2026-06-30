// 온도썬 — 앱 컨트롤러. 의존(로드 순서): data → codec → engine → report → capture → app.

const $ = (id) => document.getElementById(id);
const state = {
  answers: new Array(20).fill(null),
  idx: 0,
  mbtiSel: {},
  mode: "solo",        // solo | pair
  partner: null,       // {answers, mbti} (A, 초대자)
  lastReport: null,
};

function show(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0, 0);
}
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
async function copy(text) {
  // 1) 표준 클립보드 API (보안 컨텍스트). iframe/비포커스에서 멈출 수 있어 타임아웃 레이스.
  try {
    if (navigator.clipboard && window.isSecureContext) {
      const done = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise((res) => setTimeout(() => res(false), 1200)),
      ]);
      if (done) { toast("링크 복사됐어요"); return true; }
    }
  } catch (e) { /* 권한 거부 → 폴백 */ }
  // 2) execCommand 폴백 (구형/iframe)
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.cssText = "position:absolute;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok) { toast("링크 복사됐어요"); return true; }
  } catch (e) { /* 폴백도 막힘 → 수동 복사 UI */ }
  // 3) 인페이지 링크 박스 (모달/prompt 미사용 → 어떤 환경에서도 에러 없음)
  showLinkBox(text);
  return false;
}

function showLinkBox(text) {
  let box = $("linkbox");
  if (!box) {
    box = document.createElement("div");
    box.id = "linkbox"; box.className = "linkbox";
    box.innerHTML = `<p>아래 링크를 길게 눌러 복사해서 보내주세요</p>
      <input type="text" readonly aria-label="공유 링크" />
      <button type="button" class="btn ghost row" id="linkbox-close">닫기</button>`;
    $("app").appendChild(box);
    box.querySelector("#linkbox-close").addEventListener("click", () => box.remove());
  }
  const input = box.querySelector("input");
  input.value = text;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  input.focus(); input.select();
}

async function shareOrCopy(link, text) {
  if (navigator.share) {
    try { await navigator.share({ title: SHARE.ogTitle, text, url: link }); return; }
    catch (e) { if (e && e.name === "AbortError") return; /* 그 외엔 복사로 폴백 */ }
  }
  copy(link);
}
function shareLinkBase() { return location.origin + location.pathname; }

// ---------- 초기화 / 라우팅 ----------
function init() {
  $("privacy-long").textContent = PRIVACY.long;
  $("result-disclaimer").textContent = "이 결과는 재미로 보는 거예요. 사람 사이는 점수로 다 설명되지 않고, 천생연분도 최악 궁합도 없어요. 진짜 중요한 건 직접 나누는 대화예요.";
  $("solo-note").textContent = MESSAGES.solo + " " + PRIVACY.beforeShare;
  $("result-privacy").textContent = PRIVACY.beforeShare;
  buildMbtiUI();
  bindEvents();
  try { runSelfTest(); } catch (e) { console.warn(e); }

  const params = new URLSearchParams(location.search);
  const p = params.get("p"), q = params.get("q");

  if (p && q) {                       // 합본: 누가 열어도 동일 결과
    const da = decodeToken(p), db = decodeToken(q);
    if (!da.ok || !db.ok) return showError(da.ok ? db.error : da.error);
    showResult(da, db);
  } else if (p) {                     // 초대: B 진입
    const da = decodeToken(p);
    if (!da.ok) return showError(da.error);
    state.mode = "pair";
    state.partner = da;
    state.partnerToken = p;
    show("screen-invite");
  } else if (q) {                     // q만 → 비정상
    showError("MALFORMED");
  } else {
    show("screen-landing");
  }
}

function showError(code) {
  const map = { MALFORMED: MESSAGES.errMalformed, LENGTH: MESSAGES.errLength, VERSION: MESSAGES.errVersion };
  $("error-msg").textContent = map[code] || MESSAGES.errMalformed;
  show("screen-error");
}

// ---------- 퀴즈 ----------
function startQuiz() {
  state.answers = new Array(20).fill(null);
  state.idx = 0;
  show("screen-quiz");
  renderQuestion();
}
function renderQuestion() {
  const q = QUESTIONS[state.idx];
  $("q-count").textContent = `${state.idx + 1} / 20`;
  $("q-progress").style.width = ((state.idx) / 20 * 100) + "%";
  $("q-cat").textContent = CATEGORIES[q.category].emoji + " " + CATEGORIES[q.category].label;
  $("q-prompt").textContent = q.prompt;
  const ca = $("choice-a"), cb = $("choice-b");
  ca.querySelector(".txt").textContent = q.a;
  cb.querySelector(".txt").textContent = q.b;
  ca.classList.toggle("sel", state.answers[state.idx] === 0);
  cb.classList.toggle("sel", state.answers[state.idx] === 1);
  $("q-back").disabled = state.idx === 0;
}
function answer(val) {
  state.answers[state.idx] = val;
  renderQuestion();
  setTimeout(() => {
    if (state.idx < 19) { state.idx++; renderQuestion(); }
    else { $("q-progress").style.width = "100%"; show("screen-mbti"); }
  }, 180);
}

// ---------- MBTI ----------
function buildMbtiUI() {
  const wrap = $("mbti-axes");
  wrap.innerHTML = MBTI_AXES.map((ax) => `
    <div class="mbti-axis">
      <div class="lbl">${axisLabel(ax.key)}</div>
      <div class="mbti-opts" data-axis="${ax.key}">
        <button data-val="0">${ax.a}</button>
        <button data-val="1">${ax.b}</button>
      </div>
    </div>`).join("");
  wrap.querySelectorAll(".mbti-opts").forEach((row) => {
    row.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ax = row.dataset.axis;
        state.mbtiSel[ax] = Number(btn.dataset.val);
        row.querySelectorAll("button").forEach((b) => b.classList.remove("sel"));
        btn.classList.add("sel");
      });
    });
  });
}
function axisLabel(k) {
  return { ei: "밖에서 충전(E) vs 혼자 충전(I)", sn: "현실·감각(S) vs 직관·가능성(N)",
    tf: "논리(T) vs 감정(F)", jp: "계획(J) vs 즉흥(P)" }[k];
}
function getMbti() {
  const keys = MBTI_AXES.map((a) => a.key);
  if (keys.every((k) => state.mbtiSel[k] === 0 || state.mbtiSel[k] === 1)) {
    return { ei: state.mbtiSel.ei, sn: state.mbtiSel.sn, tf: state.mbtiSel.tf, jp: state.mbtiSel.jp };
  }
  return null;
}
function finishMbti(skip) {
  const mbti = skip ? null : getMbti();
  if (!skip && !mbti) return toast("4개 다 골라주거나 'MBTI 없이'를 눌러줘");
  state.myMbti = mbti;
  if (state.mode === "pair") {
    const me = { ok: true, answers: state.answers, mbti };
    showResult(state.partner, me);
  } else {
    showSolo();
  }
}

// ---------- 솔로 결과 ----------
function showSolo() {
  const traits = soloTraits(state.answers);
  $("solo-traits").innerHTML = traits.map((t) =>
    `<div class="trait-card"><div class="k">${t.k}</div><div class="v">${t.v}</div></div>`).join("");
  state.myToken = encodeToken(state.answers, state.myMbti);
  show("screen-solo");
}
function soloTraits(ans) {
  const get = (id) => { const i = QUESTIONS.findIndex((q) => q.id === id); const q = QUESTIONS[i]; return ans[i] === 0 ? q.a : q.b; };
  return [
    { k: "갈등이 생기면", v: get("q3") },
    { k: "애정 표현은", v: get("q9") },
    { k: "돈은", v: get("q6") },
    { k: "쉬는 날엔", v: get("q1") },
    { k: "미래 결혼관은", v: get("q11") },
  ];
}

// ---------- 공동 결과 ----------
function showResult(a, b) {
  const mbtiPair = (a.mbti && b.mbti) ? { a: a.mbti, b: b.mbti } : null;
  const report = computeReport(a.answers, b.answers, mbtiPair);
  state.lastReport = report;
  state.combinedLink = `${shareLinkBase()}?p=${encodeToken(a.answers, a.mbti)}&q=${encodeToken(b.answers, b.mbti)}`;
  $("result-body").innerHTML = renderResult(report, a.answers, b.answers);
  show("screen-result");
  animateResult($("result-body"));
}

// ---------- 공유 ----------
function shareInvite() {
  shareOrCopy(`${shareLinkBase()}?p=${state.myToken}`, "내 답 맞춰볼래? 우리 온도 재보자");
}
function shareResult() {
  const cap = SHARE.caption[state.lastReport.band] || SHARE.viewAll;
  shareOrCopy(state.combinedLink, cap);
}

// ---------- 이벤트 바인딩 ----------
function bindEvents() {
  $("btn-start").addEventListener("click", () => { state.mode = "solo"; startQuiz(); });
  $("btn-invite-start").addEventListener("click", () => { state.mode = "pair"; startQuiz(); });
  $("choice-a").addEventListener("click", () => answer(0));
  $("choice-b").addEventListener("click", () => answer(1));
  $("q-back").addEventListener("click", () => { if (state.idx > 0) { state.idx--; renderQuestion(); } });
  $("btn-mbti-done").addEventListener("click", () => finishMbti(false));
  $("btn-mbti-skip").addEventListener("click", () => finishMbti(true));
  $("btn-share-invite").addEventListener("click", shareInvite);
  $("btn-copy-invite").addEventListener("click", () => copy(`${shareLinkBase()}?p=${state.myToken}`));
  $("btn-share-result").addEventListener("click", shareResult);
  $("btn-save-img").addEventListener("click", async () => { toast("이미지 만드는 중..."); await saveCard(state.lastReport); toast("저장됐어요!"); });
  const goHome = () => { const base = shareLinkBase(); if (location.href === base) location.reload(); else location.href = base; };
  $("btn-restart").addEventListener("click", goHome);
  $("btn-error-restart").addEventListener("click", goHome);
}

init();
