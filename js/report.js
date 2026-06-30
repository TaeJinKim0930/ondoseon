// 온도썬 — 공동 결과 DOM 렌더러. 의존: data.js (index.html에서 먼저 로드).

const TIP_Q = {
  future: "결혼이나 아이, 둘 다 어떻게 생각하는지 가볍게 물어볼까?",
  conflict: "싸우면 바로 풀고 싶어, 아니면 좀 식히고 싶어?",
  trust: "이성 친구 연락, 어디까지가 편하고 어디부터 불편해?",
  money: "돈은 모으는 쪽이 좋아, 지금 쓰는 쪽이 좋아?",
  lifestyle: "주말엔 나가고 싶어, 집에 있고 싶어?",
  intimacy: "넌 어떤 말이나 행동에서 사랑받는 느낌이 들어?",
  fun: "다음 데이트, 뭐 하고 싶은지 하나씩 말해볼까?",
};
const CORE_BY_CAT = { conflict: "q5", money: "q8", future: "q11", trust: "q13" };

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const bandObj = (key) => BANDS.find((b) => b.key === key);
const phraseBand = (score) => (score >= 70 ? "high" : score >= 40 ? "mid" : "low");
const barColor = (s) => (s >= 70 ? "var(--mint)" : s >= 45 ? "var(--sunny)" : "var(--coral)");

function renderResult(report, answersA, answersB) {
  const band = bandObj(report.band);
  const pct = report.finalPct;
  let html = "";

  // 게이트 배지
  if (report.gateFlag > 0) {
    const msg = report.gateFlag === 2 ? GATE_COPY.cap2 : GATE_COPY.cap1;
    html += `<div class="gate-badge"><span class="ic" aria-hidden="true">💬</span><div class="bd">
      <span class="tag">${GATE_COPY.badge}</span><p>${esc(msg)}</p>
      ${report.capped ? `<p class="note">${esc(GATE_COPY.note)}</p>` : ""}</div></div>`;
  }

  // 온도계 히어로
  html += `<div class="therm-hero" data-band="${band.key}" style="--temp:${band.temp}">
    <div class="caption">우리 궁합 온도</div>
    <div class="therm-wrap">
      <div class="thermometer" role="img" aria-label="궁합 온도 ${pct}도, ${band.name}">
        <div class="fill" style="height:0%" data-h="${pct}"></div>
      </div>
      <div class="therm-read">
        <div class="deg">${pct}°</div>
        <div class="band">${band.name} ${band.emoji}</div>
      </div>
    </div>
    <p class="therm-cap">${esc(band.catch)}</p>
  </div>`;

  // 레전드
  html += `<div class="legend"><span><i style="background:var(--sunny)"></i>나</span><span><i style="background:var(--coral)"></i>상대</span></div>`;

  // 카테고리 바
  html += `<div class="section"><h2>항목별로 보면</h2>`;
  for (const key of CATEGORY_ORDER) {
    const c = report.categories.find((x) => x.key === key);
    const s = Math.round(c.score);
    html += `<div class="bar-row"><div class="top"><span>${CATEGORIES[key].emoji} ${CATEGORIES[key].label}</span><span class="pct">${s}%</span></div>
      <div class="bar-track" role="img" aria-label="${CATEGORIES[key].label} ${s}퍼센트"><i style="width:0%;background:${barColor(s)}" data-w="${s}"></i></div></div>`;
  }
  html += `</div>`;

  // 잘 맞는 점
  const matches = report.topMatches.slice(0, 3);
  html += `<div class="section"><h2>💚 이런 건 찰떡</h2>`;
  if (matches.length === 0) html += `<div class="pill-card good"><div class="desc">${esc(MESSAGES.emptyMatch)}</div></div>`;
  for (const key of matches) {
    const c = report.categories.find((x) => x.key === key);
    html += `<div class="pill-card good"><div class="ttl">${CATEGORIES[key].emoji} ${CATEGORIES[key].label}</div>
      <div class="desc">${esc(CATEGORY_PHRASES[key][phraseBand(c.score)])}</div></div>`;
  }
  html += `</div>`;

  // 부딪힐 점 + 오늘 던질 질문
  const clashes = report.topClashes.slice(0, 3);
  html += `<div class="section"><h2>🚦 여긴 살짝 조심</h2>`;
  if (clashes.length === 0) html += `<div class="pill-card good"><div class="desc">${esc(MESSAGES.emptyClash)}</div></div>`;
  for (const key of clashes) {
    const c = report.categories.find((x) => x.key === key);
    const cls = c.score < 45 ? "bad" : "warn";
    // 핵심 문항이 실제로 갈렸으면 그 clash 문구를 우선 사용
    const coreId = CORE_BY_CAT[key];
    let desc = CATEGORY_PHRASES[key][phraseBand(c.score)];
    if (coreId && ITEM_PHRASES[coreId]) {
      const idx = report.items.findIndex((it) => it.id === coreId);
      if (idx >= 0 && !report.items[idx].match) desc = ITEM_PHRASES[coreId].clash;
    }
    html += `<div class="pill-card ${cls}"><div class="ttl">${CATEGORIES[key].emoji} ${CATEGORIES[key].label}</div>
      <div class="desc">${esc(desc)}</div>
      <div class="tip"><b>💬 오늘 던질 질문</b><span>${esc(TIP_Q[key])}</span></div></div>`;
  }
  html += `</div>`;

  // MBTI 카드
  if (report.mbti) {
    const typeStr = (who) => MBTI_AXES.map((ax) => report.mbti[ax.key][who] === 0 ? ax.a : ax.b).join("");
    html += `<div class="section"><div class="mbti-card">
      <div class="head"><span aria-hidden="true">🥄</span><span>MBTI로 한 스푼</span>
      <span class="types">&nbsp;·&nbsp;${typeStr("a")} × ${typeStr("b")}</span></div>`;
    for (const ax of MBTI_AXES) {
      const m = report.mbti[ax.key];
      const key = m.same ? `${ax.key}.same.${m.a === 0 ? ax.a : ax.b}` : `${ax.key}.diff`;
      html += `<div class="line">${esc(MBTI_PHRASES[key])}</div>`;
    }
    html += `<div class="disc">${esc(MBTI_PHRASES.disclaimer)}</div></div></div>`;
  }

  return html;
}

// 진입 애니메이션(바/온도계 채우기). reduced-motion이면 CSS가 transition 제거 → 즉시 최종값.
function animateResult(root) {
  requestAnimationFrame(() => {
    root.querySelectorAll(".thermometer .fill").forEach((el) => { el.style.height = el.dataset.h + "%"; });
    root.querySelectorAll(".bar-track > i").forEach((el, i) => {
      setTimeout(() => { el.style.width = el.dataset.w + "%"; }, 60 * i);
    });
  });
}
