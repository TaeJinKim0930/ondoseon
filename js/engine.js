// 온도썬 — 점수 엔진(순수함수). 색/문구 미포함, key만 반환.
// 카테고리 귀속은 QUESTIONS[i].category가 유일한 진실원(SSOT)이다.
// 의존: data.js (QUESTIONS, CATEGORIES, CATEGORY_ORDER, GATE_CAP, BANDS) — index.html에서 먼저 로드.

const GATE_IDS = QUESTIONS.filter((q) => q.gate).map((q) => q.id); // ["q11","q12"]

// 문항 일치 점수: 일치=1, 불일치 → 보완축 0.5 / 유사축 0
function itemScore(q, a, b) {
  if (a === b) return 1;
  return q.axis === "보완" ? 0.5 : 0;
}

function bandOf(pct) {
  return BANDS.find((band) => pct >= band.min && pct <= band.max) || BANDS[0];
}

// answersA / answersB: number[20] (0|1). 반환: report 객체.
function computeReport(answersA, answersB, mbtiPair) {
  // 1) 카테고리별 가중평균
  const acc = {};
  for (const key of CATEGORY_ORDER) acc[key] = { sum: 0, w: 0 };
  const items = QUESTIONS.map((q, i) => {
    const s = itemScore(q, answersA[i], answersB[i]);
    acc[q.category].sum += s * q.weight;
    acc[q.category].w += q.weight;
    return { id: q.id, category: q.category, axis: q.axis, score: s, match: answersA[i] === answersB[i] };
  });

  const categories = CATEGORY_ORDER.map((key) => {
    const c = acc[key];
    const score = c.w > 0 ? (c.sum / c.w) * 100 : 0;
    return { key, score, weight: CATEGORIES[key].weight, bandKey: bandOf(Math.round(score)).key };
  });

  // 2) 총점(카테고리 가중평균) — 중간 반올림 금지
  let num = 0, den = 0;
  for (const c of categories) { num += c.score * c.weight; den += c.weight; }
  const raw = den > 0 ? num / den : 0;

  // 3) 게이트 캡 (반올림 후 정수에 적용), band는 finalPct로 판정
  let gateFlag = 0;
  for (const id of GATE_IDS) {
    const idx = QUESTIONS.findIndex((q) => q.id === id);
    if (answersA[idx] !== answersB[idx]) gateFlag++;
  }
  const rawRound = Math.round(raw);
  const finalPct = gateFlag > 0 ? Math.min(rawRound, GATE_CAP[gateFlag]) : rawRound;
  const band = bandOf(finalPct);

  // 4) 잘맞음/부딪힘 카테고리 정렬
  const sorted = [...categories].sort((x, y) => y.score - x.score);
  const topMatches = sorted.filter((c) => c.score >= 60).map((c) => c.key);
  const topClashes = [...categories].sort((x, y) => x.score - y.score).filter((c) => c.score < 60).map((c) => c.key);

  // 5) MBTI 해석(점수 0). 양쪽 다 입력됐을 때만.
  let mbti = null;
  if (mbtiPair && mbtiPair.a && mbtiPair.b) {
    mbti = {};
    for (const ax of ["ei", "sn", "tf", "jp"]) {
      mbti[ax] = { a: mbtiPair.a[ax], b: mbtiPair.b[ax], same: mbtiPair.a[ax] === mbtiPair.b[ax] };
    }
  }

  return {
    version: "v1",
    raw: Math.round(raw * 100) / 100,
    finalPct,
    band: band.key,
    gateFlag,
    gateCap: gateFlag > 0 ? GATE_CAP[gateFlag] : null,
    capped: gateFlag > 0 && rawRound > GATE_CAP[gateFlag],
    categories,
    items,
    topMatches,
    topClashes,
    mbti,
    badges: gateFlag > 0 ? ["talk_needed"] : [],
  };
}

// 골든 자기검증: 콘솔에서 실측으로 블로커3을 닫는다.
function runSelfTest() {
  const A0 = new Array(20).fill(0);
  const allMatch = computeReport(A0, A0.slice(), null);
  const allClash = computeReport(A0, new Array(20).fill(1), null);
  const idx11 = QUESTIONS.findIndex((q) => q.id === "q11");
  const oneGate = A0.slice(); const oneGateB = A0.slice(); oneGateB[idx11] = 1;
  const gate1 = computeReport(oneGate, oneGateB, null);

  const cases = [
    ["전부일치 → 100/high/gate0", allMatch.finalPct === 100 && allMatch.band === "high" && allMatch.gateFlag === 0],
    ["전부불일치 → lukewarm/gate2", allClash.band === "lukewarm" && allClash.gateFlag === 2],
    ["q11만 불일치 → 캡69/medium", gate1.gateFlag === 1 && gate1.finalPct === 69 && gate1.band === "medium" && gate1.capped === true],
  ];
  const results = cases.map(([name, pass]) => ({ name, pass }));
  const allPass = results.every((r) => r.pass);
  console.log("[온도썬 engine self-test]", allPass ? "ALL PASS ✅" : "FAIL ❌");
  console.table(results);
  console.log("golden values:", { allMatch: allMatch.finalPct, allClash: allClash.finalPct, gate1: gate1.finalPct });
  return allPass;
}
