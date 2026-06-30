// 온도썬 — 결과 카드 캡처(순수 canvas, 외부 라이브러리 없음). 1080x1920 PNG. 의존: data.js.

const FONT = "'Pretendard','Apple SD Gothic Neo',sans-serif";
const NUMF = "'Space Grotesk','Pretendard',sans-serif";

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(report) {
  const cv = document.getElementById("capture-canvas");
  const ctx = cv.getContext("2d");
  const W = 1080, H = 1920;
  const band = BANDS.find((b) => b.key === report.band);
  const pct = report.finalPct;

  ctx.fillStyle = "#FFF7F0"; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  // 헤더(블러시)
  ctx.fillStyle = "#FFD9E2"; rr(ctx, 60, 80, W - 120, 720, 56); ctx.fill();
  ctx.fillStyle = "#99506166"; ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = "#995061"; ctx.fillText("우리 궁합 온도", W / 2, 200);

  // 온도계
  const tx = 250, ty = 290, tw = 80, th = 360;
  ctx.fillStyle = "#fff"; rr(ctx, tx, ty, tw, th, 40); ctx.fill();
  const fh = Math.max(0, Math.min(1, pct / 100)) * th;
  ctx.fillStyle = band.temp; rr(ctx, tx, ty + th - fh, tw, fh, 40); ctx.fill();

  // 숫자/밴드
  ctx.textAlign = "left";
  ctx.fillStyle = "#3A2F38"; ctx.font = `700 150px ${NUMF}`;
  ctx.fillText(pct + "°", 400, 460);
  ctx.font = `800 70px ${FONT}`;
  ctx.fillText(band.name, 400, 560);
  ctx.font = `500 46px ${FONT}`;
  ctx.fillText(band.emoji, 400, 630);

  // 캐치 (2줄 래핑)
  ctx.textAlign = "center"; ctx.fillStyle = "#7a4a55"; ctx.font = `500 32px ${FONT}`;
  wrap(ctx, band.catch, W / 2, 720, W - 240, 44, 2);

  // 카테고리 바 (상위 가중 순 5개)
  let y = 920;
  ctx.textAlign = "left"; ctx.fillStyle = "#3A2F38"; ctx.font = `700 40px ${FONT}`;
  ctx.fillText("항목별로 보면", 80, y); y += 50;
  for (const key of CATEGORY_ORDER.slice(0, 5)) {
    const c = report.categories.find((x) => x.key === key);
    const s = Math.round(c.score);
    ctx.fillStyle = "#3A2F38"; ctx.font = `600 34px ${FONT}`;
    ctx.fillText(`${CATEGORIES[key].emoji} ${CATEGORIES[key].label}`, 80, y + 36);
    ctx.textAlign = "right"; ctx.font = `700 34px ${NUMF}`; ctx.fillText(s + "%", W - 80, y + 36);
    ctx.textAlign = "left";
    ctx.fillStyle = "#F0E4DC"; rr(ctx, 80, y + 56, W - 160, 26, 13); ctx.fill();
    ctx.fillStyle = s >= 70 ? "#7ED9A8" : s >= 45 ? "#FFCE5C" : "#FF8A8A";
    rr(ctx, 80, y + 56, (W - 160) * (s / 100), 26, 13); ctx.fill();
    y += 118;
  }

  // 한줄 요약
  y += 20;
  const topM = report.topMatches[0], topC = report.topClashes[0];
  if (topM) { ctx.fillStyle = "#1F9D6B"; ctx.font = `700 36px ${FONT}`; ctx.fillText(`💚 ${CATEGORIES[topM].label} 찰떡`, 80, y); y += 60; }
  if (topC) { ctx.fillStyle = "#D8604E"; ctx.font = `700 36px ${FONT}`; ctx.fillText(`🚦 ${CATEGORIES[topC].label} 조심`, 80, y); }

  // 워터마크
  ctx.textAlign = "center"; ctx.fillStyle = "#B4A89F"; ctx.font = `500 34px ${FONT}`;
  ctx.fillText("온도썬 · 우리 온도 재보기 #온도썬", W / 2, H - 70);

  return cv;
}

function wrap(ctx, text, cx, cy, maxW, lh, maxLines) {
  const words = text.split(" ");
  const lines = []; let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  lines.slice(0, maxLines).forEach((ln, i) => ctx.fillText(ln, cx, cy + i * lh));
}

async function saveCard(report) {
  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
  }
  const cv = drawCard(report);
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) return "error";
  const file = new File([blob], "ondoseon.png", { type: "image/png" });

  // 1) 모바일(아이폰/안드로이드): 파일 공유 시트 → "이미지 저장"으로 앨범에 저장
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "온도썬 결과" }); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancel"; /* 그 외엔 폴백 */ }
  }

  // 2) 데스크톱: 다운로드 폴더로 저장
  const url = URL.createObjectURL(blob);
  let downloaded = false;
  try {
    const a = document.createElement("a");
    a.href = url; a.download = "ondoseon-result.png";
    document.body.appendChild(a); a.click(); a.remove();
    downloaded = true;
  } catch (e) { /* 폴백으로 */ }

  // 3) 항상 인페이지 이미지로도 띄워줌 → 모바일에서 꾹 눌러 '사진에 추가'(앨범 저장)
  showImagePreview(url);
  return downloaded ? "download" : "preview";
}

function showImagePreview(url) {
  let box = document.getElementById("imgsave");
  if (!box) {
    box = document.createElement("div");
    box.id = "imgsave"; box.className = "imgsave";
    box.innerHTML = `<p class="hint"></p><img alt="온도썬 결과 카드" /><button type="button" class="btn ghost row" id="imgsave-close">닫기</button>`;
    document.getElementById("app").appendChild(box);
    box.querySelector("#imgsave-close").addEventListener("click", () => {
      const img = box.querySelector("img");
      if (img && img.src) URL.revokeObjectURL(img.src);
      box.remove();
    });
  }
  const touch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  box.querySelector(".hint").textContent = touch
    ? "이미지를 꾹 눌러 '사진에 추가'(저장)를 눌러주세요"
    : "이미지를 우클릭 → '이미지를 다른 이름으로 저장'";
  box.querySelector("img").src = url;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}
