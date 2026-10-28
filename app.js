(function () {
  "use strict";

  const DATA = window.AUDIT_DATA;
  if (!DATA) {
    console.error("AUDIT_DATA not loaded.");
    return;
  }

  const state = {
    selectedDate: "ALL",
    selectedTheme: "ALL",
    searchQuery: "",
    viewMode: "card", // 'card' | 'slide' | 'list'
    activeModalId: null,
    activeModalTab: "summary", // 'summary' | 'script'
    activeSlideIndex: 0
  };

  const STATION_META = {
    "1007": { stnCode: "1일차", stationName: "국토교통부", index: 0 },
    "1008": { stnCode: "2일차", stationName: "도로·교통안전", index: 1 },
    "1012": { stnCode: "3일차", stationName: "LH·안전관리", index: 2 },
    "1013": { stnCode: "4일차", stationName: "철도·코레일", index: 3 },
    "1015": { stnCode: "5일차", stationName: "부동산·HUG", index: 4 },
    "1022": { stnCode: "6일차", stationName: "인천·한국공항", index: 5 },
    "1023": { stnCode: "7일차", stationName: "종합감사", index: 6 }
  };

  const LINE_META = {
    housing: { lineName: "민생·주거", color: "#1D4ED8" },
    safety: { lineName: "국민안전·품질", color: "#B91C1C" },
    gangwon: { lineName: "강원·춘천", color: "#0F766E" },
    transport: { lineName: "교통·이동권", color: "#0369A1" },
    governance: { lineName: "공공기관 개혁", color: "#B45309" }
  };

  // 상단 주요 질의 카드
  const HIGHLIGHT_IDS = [
    "1023-9", // 경춘선 공용구간 열차 3배 급증
    "1013-8", // 29년 방치 춘천 강촌콘도
    "1008-4", // 서산영덕선 제설 2시간 공백
    "1022-2", // 인천공항 액체류 폐기
    "1007-5", // 스마트시티 2년 내 11개 중단
    "1007-2", // 리츠 활성화 미이행
    "1012-1", // LH 감리 입찰담합 2,941억 수주
    "1008-6", // 서울-춘천 가변차로 노면평가 누락
    "1023-8", // KTX 청년할인 빈자리 떨이
    "1023-3", // 건설공제조합 고정이하 90% 증가
    "1022-4", // 양양공항 상하이 재취항 관광상품 0건
    "1015-1"  // 저자본·고보증 PF
  ];

  const POPULAR_TAGS = [
    "GTX-B", "춘천", "강촌콘도", "다자녀", "KTX청년할인",
    "LH", "전세", "벽간소음", "도로살얼음", "인천공항", "양양공항", "한강버스"
  ];

  // DOM Elements
  const highlightTrackEl = document.getElementById("highlightTrack");
  const hlPrevBtn = document.getElementById("hlPrevBtn");
  const hlNextBtn = document.getElementById("hlNextBtn");

  const stationNodesEl = document.getElementById("stationNodesContainer");
  const stationSignboardEl = document.getElementById("stationSignboard");
  const railLineProgressEl = document.getElementById("railLineProgress");
  const btnAllStations = document.getElementById("btnAllStations");
  const btnPrevStation = document.getElementById("btnPrevStation");
  const btnNextStation = document.getElementById("btnNextStation");
  const headerResetBtn = document.getElementById("headerResetBtn");

  const themeGridEl = document.getElementById("themeGrid");
  const searchInputEl = document.getElementById("searchInput");
  const searchClearEl = document.getElementById("searchClear");
  const resultCountEl = document.getElementById("resultCount");
  const resetFilterBtn = document.getElementById("resetFilterBtn");
  const viewCardBtn = document.getElementById("viewCardBtn");
  const viewSlideBtn = document.getElementById("viewSlideBtn");
  const viewListBtn = document.getElementById("viewListBtn");
  const quickTagsEl = document.getElementById("quickTags");
  const resultsContainerEl = document.getElementById("resultsContainer");

  // Modal Elements
  const modalBackdropEl = document.getElementById("detailModal");
  const modalBadgesEl = document.getElementById("modalBadges");
  const modalTitleEl = document.getElementById("modalTitle");
  const modalMetricEl = document.getElementById("modalMetric");
  const modalTargetEl = document.getElementById("modalTarget");
  const modalTabSummaryBtn = document.getElementById("modalTabSummary");
  const modalTabScriptBtn = document.getElementById("modalTabScript");
  const modalContentEl = document.getElementById("modalContent");
  const modalPrevBtn = document.getElementById("modalPrevBtn");
  const modalNextBtn = document.getElementById("modalNextBtn");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalShareBtn = document.getElementById("modalShareBtn");
  const modalPrintBtn = document.getElementById("modalPrintBtn");
  const toastEl = document.getElementById("toast");

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.classList.remove("show");
    }, 2400);
  }

  function getShortDigest(item) {
    const raw = (item.problems && item.problems[0]) || item.summary || "";
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (cleaned.length <= 64) return cleaned;
    return cleaned.slice(0, 62) + "…";
  }

  function getFilteredItems() {
    const q = state.searchQuery.trim().toLowerCase();
    return DATA.items.filter((item) => {
      if (state.selectedDate !== "ALL" && item.dateCode !== state.selectedDate) {
        return false;
      }
      if (state.selectedTheme !== "ALL" && item.theme !== state.selectedTheme) {
        return false;
      }
      if (!q) return true;

      const haystack = [
        item.title,
        item.subtitle,
        item.agency,
        item.target,
        item.keyMetric,
        item.summary,
        item.themeName,
        ...(item.tags || []),
        ...(item.problems || []),
        ...(item.proposals || [])
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }

  // 0. 주요 질의 렌더링
  function renderHighlights() {
    if (!highlightTrackEl) return;

    const hlItems = HIGHLIGHT_IDS.map((id) => DATA.items.find((i) => i.id === id)).filter(Boolean);

    highlightTrackEl.innerHTML = hlItems
      .map((item) => {
        const stn = STATION_META[item.dateCode] || { stnCode: "감사" };
        const slide = (item.slides && item.slides[0]) || { src: item.thumb, caption: item.title };
        const slideCount = (item.slides && item.slides.length) || 1;

        return `
          <article class="hl-card" data-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}">
            <div class="hl-thumb-wrap">
              ${item.slides && item.slides.length ? `<img src="${escapeHtml(slide.src)}" alt="${escapeHtml(item.title)}" loading="lazy" />` : metricCardHtml(item)}
              ${slideCount > 1 ? `<span class="hl-slide-count">+${slideCount - 1}장</span>` : ""}
            </div>
            <div class="hl-body">
              <div class="hl-meta">
                <span class="hl-badge-date">${escapeHtml(stn.stnCode)} · ${escapeHtml(item.agency)}</span>
                <span class="hl-badge-theme">${escapeHtml(item.themeName)}</span>
              </div>
              <h3 class="hl-title">${escapeHtml(item.title)}</h3>
              <p class="hl-metric">${escapeHtml(item.keyMetric)}</p>
            </div>
          </article>
        `;
      })
      .join("");

    highlightTrackEl.querySelectorAll(".hl-card").forEach((card) => {
      card.addEventListener("click", () => openModal(card.getAttribute("data-id")));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(card.getAttribute("data-id"));
        }
      });
    });
  }

  // 1. 7개 일차 타임라인 렌더링
  function renderStationMap() {
    if (!stationNodesEl) return;

    const schedules = DATA.schedules;
    const activeIdx =
      state.selectedDate === "ALL"
        ? -1
        : STATION_META[state.selectedDate]
        ? STATION_META[state.selectedDate].index
        : -1;

    if (railLineProgressEl) {
      if (state.selectedDate === "ALL") {
        railLineProgressEl.style.width = "88%";
      } else {
        const pct = (activeIdx / Math.max(1, schedules.length - 1)) * 88;
        railLineProgressEl.style.width = `${pct}%`;
      }
    }

    if (btnAllStations) {
      btnAllStations.classList.toggle("active", state.selectedDate === "ALL");
    }

    stationNodesEl.innerHTML = schedules
      .map((s, idx) => {
        const meta = STATION_META[s.code] || { stnCode: `${idx + 1}일차`, stationName: s.title };
        const isActive = state.selectedDate === s.code;
        const isPassed = state.selectedDate === "ALL" || (activeIdx >= 0 && idx < activeIdx);

        return `
          <button
            type="button"
            class="station-node-btn ${isActive ? "active" : ""} ${isPassed ? "passed" : ""}"
            data-code="${escapeHtml(s.code)}"
            role="tab"
            aria-selected="${isActive}"
          >
            <div class="station-marker-ring">
              <span class="station-marker-core"></span>
            </div>
            <div class="station-card-plate">
              <span class="station-code">${escapeHtml(meta.stnCode)}</span>
              <span class="station-date">${escapeHtml(s.shortDate)}</span>
              <span class="station-name">${escapeHtml(meta.stationName)}</span>
              <span class="station-count-pill">${s.count}건</span>
            </div>
          </button>
        `;
      })
      .join("");

    stationNodesEl.querySelectorAll(".station-node-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.getAttribute("data-code");
        state.selectedDate = state.selectedDate === code ? "ALL" : code;
        updateAll();
      });
    });

    renderStationSignboard();
  }

  function renderStationSignboard() {
    if (!stationSignboardEl) return;

    if (state.selectedDate === "ALL") {
      stationSignboardEl.style.display = "none";
      return;
    }

    stationSignboardEl.style.display = "grid";
    const sched = DATA.schedules.find((s) => s.code === state.selectedDate);
    if (!sched) return;
    const meta = STATION_META[sched.code] || { stnCode: "일차", stationName: sched.title };

    stationSignboardEl.innerHTML = `
      <div class="signboard-badge-box">
        <span class="signboard-stn-num">${escapeHtml(meta.stnCode)}</span>
        <div class="signboard-stn-titles">
          <span class="signboard-stn-date">${escapeHtml(sched.date)}</span>
          <span class="signboard-stn-name">${escapeHtml(sched.title)}</span>
        </div>
      </div>
      <div class="signboard-center">
        <div class="signboard-agencies">
          ${(sched.agencies || [])
            .map((ag) => `<span class="signboard-agency-chip">${escapeHtml(ag)}</span>`)
            .join("")}
        </div>
      </div>
      <div class="signboard-right">
        <span class="signboard-count-num">${sched.count}건</span>
      </div>
    `;
  }

  // 2. 5대 분야 버튼 렌더링 (군더더기 설명 제거, 깔끔한 탭 카드 형태)
  function renderPolicyLines() {
    if (!themeGridEl) return;

    const counts = {};
    DATA.items.forEach((item) => {
      if (state.selectedDate === "ALL" || item.dateCode === state.selectedDate) {
        counts[item.theme] = (counts[item.theme] || 0) + 1;
      }
    });

    themeGridEl.innerHTML = DATA.themes
      .map((t) => {
        const line = LINE_META[t.id] || { lineName: t.name, color: t.color };
        const isActive = state.selectedTheme === t.id;
        const count = counts[t.id] || 0;

        return `
          <button
            type="button"
            class="line-card ${isActive ? "active" : ""}"
            style="--line-color: ${escapeHtml(line.color)}"
            data-theme="${escapeHtml(t.id)}"
            aria-pressed="${isActive}"
          >
            <h3 class="line-title">${escapeHtml(t.name)}</h3>
            <span class="line-count">${count}건</span>
          </button>
        `;
      })
      .join("");

    themeGridEl.querySelectorAll(".line-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const themeId = btn.getAttribute("data-theme");
        state.selectedTheme = state.selectedTheme === themeId ? "ALL" : themeId;
        updateAll();
      });
    });
  }

  // 3. 키워드 칩 렌더링
  function renderQuickTags() {
    if (!quickTagsEl) return;
    const currentQ = state.searchQuery.trim().toLowerCase();

    quickTagsEl.innerHTML = POPULAR_TAGS.map((tag) => {
      const isActive = currentQ === tag.toLowerCase();
      return `<button type="button" class="kw-chip ${isActive ? "active" : ""}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`;
    }).join("");

    quickTagsEl.querySelectorAll(".kw-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const tag = chip.getAttribute("data-tag");
        if (state.searchQuery.trim().toLowerCase() === tag.toLowerCase()) {
          state.searchQuery = "";
          searchInputEl.value = "";
        } else {
          state.searchQuery = tag;
          searchInputEl.value = tag;
        }
        searchClearEl.classList.toggle("visible", Boolean(state.searchQuery));
        updateAll();
      });
    });
  }

  // 4. 전체 목록 렌더링
  function renderResults() {
    const filtered = getFilteredItems();
    resultCountEl.innerHTML = `<strong>${filtered.length}</strong>건`;

    const hasActiveFilter =
      state.selectedDate !== "ALL" ||
      state.selectedTheme !== "ALL" ||
      state.searchQuery.trim() !== "";
    resetFilterBtn.style.display = hasActiveFilter ? "inline-block" : "none";

    if (filtered.length === 0) {
      resultsContainerEl.innerHTML = `
        <div class="empty-ledger">
          <h3>해당하는 질의가 없습니다</h3>
          <button type="button" class="btn-reset-header" id="emptyResetBtn">전체 보기</button>
        </div>
      `;
      const emptyBtn = document.getElementById("emptyResetBtn");
      if (emptyBtn) {
        emptyBtn.addEventListener("click", resetAllFilters);
      }
      return;
    }

    if (state.viewMode === "card") {
      renderVisualCardGrid(filtered);
    } else if (state.viewMode === "slide") {
      renderLargeSlideDeckView(filtered);
    } else {
      renderLedgerTableView(filtered);
    }
  }

  // 기본 카드 보기
  function renderVisualCardGrid(items) {
    resultsContainerEl.innerHTML = `
      <div class="ticket-grid">
        ${items
          .map((item) => {
            const stn = STATION_META[item.dateCode] || { stnCode: "감사" };
            const slides = item.slides || [];
            const firstSlide = slides[0] || { src: item.thumb, caption: item.title };
            const digest = getShortDigest(item);
            const newsCount = (item.news && item.news.length) || 0;

            return `
              <article class="ticket-card" data-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.title)}">
                <div class="card-thumb-box">
                  ${slides.length ? `<img
                    src="${escapeHtml(firstSlide.src)}"
                    alt="${escapeHtml(firstSlide.caption || item.title)}"
                    class="card-thumb-img"
                    loading="lazy"
                  />` : metricCardHtml(item)}
                  ${
                    slides.length > 1
                      ? `<div class="card-thumb-badges"><span></span><span class="thumb-slide-badge">+${slides.length - 1}장</span></div>`
                      : ""
                  }
                </div>

                <div class="card-content-box">
                  <div class="card-meta-row">
                    <span class="card-agency-pill">${escapeHtml(stn.stnCode)} · ${escapeHtml(item.agency)}</span>
                    <span class="card-theme-pill">${escapeHtml(item.themeName)}</span>
                  </div>

                  <h3 class="ticket-title">${escapeHtml(item.title)}</h3>

                  <div class="card-key-metric">
                    <span class="key-metric-dot" aria-hidden="true"></span>
                    <strong>${escapeHtml(item.keyMetric)}</strong>
                  </div>

                  <p class="card-digest-text">${escapeHtml(digest)}</p>
                </div>

                <div class="ticket-footer">
                  <div class="card-footer-left">
                    ${
                      newsCount > 0
                        ? `<a
                            href="${escapeHtml(item.news[0].url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="card-news-pill"
                            onclick="event.stopPropagation();"
                            title="${escapeHtml(item.news[0].title)}"
                          >
                            보도 ${newsCount}건 ↗
                          </a>`
                        : `<span class="card-tag-mini">#${escapeHtml((item.tags && item.tags[0]) || item.agency)}</span>`
                    }
                  </div>
                  <span class="ticket-open-label">더보기 →</span>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;

    bindCardClickEvents();
  }

  // 크게 보기 모드
  function renderLargeSlideDeckView(items) {
    resultsContainerEl.innerHTML = `
      <div class="slide-deck-grid">
        ${items
          .map((item) => {
            const stn = STATION_META[item.dateCode] || { stnCode: "감사" };
            const slides = item.slides || [];
            const firstSlide = slides[0] || { src: item.thumb, caption: item.title };

            return `
              <article class="deck-card" data-id="${escapeHtml(item.id)}" data-slide-idx="0">
                <div class="deck-stage" role="button" tabindex="0" aria-label="${escapeHtml(item.title)}">
                  ${slides.length ? `<img
                    src="${escapeHtml(firstSlide.src)}"
                    alt="${escapeHtml(firstSlide.caption || item.title)}"
                    class="deck-main-img"
                    loading="lazy"
                  />` : metricCardHtml(item)}
                  ${
                    slides.length > 1
                      ? `
                        <button type="button" class="deck-nav-btn deck-prev" data-dir="-1" title="이전" aria-label="이전">‹</button>
                        <button type="button" class="deck-nav-btn deck-next" data-dir="1" title="다음" aria-label="다음">›</button>
                        <span class="deck-counter-badge">1 / ${slides.length}</span>
                      `
                      : ""
                  }
                </div>

                <div class="deck-info-bar" role="button" tabindex="0">
                  <div class="deck-info-left">
                    <span class="card-agency-pill">${escapeHtml(stn.stnCode)} · ${escapeHtml(item.agency)}</span>
                    <h3 class="deck-title">${escapeHtml(item.title)}</h3>
                    <span class="deck-metric">${escapeHtml(item.keyMetric)}</span>
                  </div>
                  <span class="ticket-open-label">더보기 →</span>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;

    resultsContainerEl.querySelectorAll(".deck-card").forEach((card) => {
      const itemId = card.getAttribute("data-id");
      const item = DATA.items.find((i) => i.id === itemId);
      const slides = (item && item.slides) || [];

      card.querySelectorAll(".deck-nav-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (slides.length <= 1) return;
          const dir = parseInt(btn.getAttribute("data-dir"), 10);
          let curr = parseInt(card.getAttribute("data-slide-idx") || "0", 10);
          curr = (curr + dir + slides.length) % slides.length;
          card.setAttribute("data-slide-idx", String(curr));

          const imgEl = card.querySelector(".deck-main-img");
          const cntEl = card.querySelector(".deck-counter-badge");
          if (imgEl) imgEl.src = slides[curr].src;
          if (cntEl) cntEl.textContent = `${curr + 1} / ${slides.length}`;
        });
      });

      const openDetail = () => {
        const idx = parseInt(card.getAttribute("data-slide-idx") || "0", 10);
        openModal(itemId, "summary", idx);
      };

      const stageEl = card.querySelector(".deck-stage");
      const infoEl = card.querySelector(".deck-info-bar");
      if (stageEl) stageEl.addEventListener("click", openDetail);
      if (infoEl) infoEl.addEventListener("click", openDetail);
    });
  }

  function bindCardClickEvents() {
    resultsContainerEl.querySelectorAll(".ticket-card").forEach((card) => {
      card.addEventListener("click", () => {
        openModal(card.getAttribute("data-id"));
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(card.getAttribute("data-id"));
        }
      });
    });
  }

  function renderLedgerTableView(items) {
    resultsContainerEl.innerHTML = `
      <div class="ledger-table-wrap">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>일차 · 기관</th>
              <th>분야</th>
              <th>제목</th>
              <th>핵심 내용</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((item) => {
                const stn = STATION_META[item.dateCode] || { stnCode: "감사" };

                return `
                  <tr data-id="${escapeHtml(item.id)}" tabindex="0" role="button">
                    <td style="font-weight:700; white-space:nowrap;">${escapeHtml(stn.stnCode)} · ${escapeHtml(item.agency)}</td>
                    <td><span class="card-theme-pill">${escapeHtml(item.themeName)}</span></td>
                    <td>
                      <div class="ledger-title-main">${escapeHtml(item.title)}</div>
                    </td>
                    <td style="font-weight:700; color:var(--brand-700);">${escapeHtml(item.keyMetric)}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    resultsContainerEl.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        openModal(tr.getAttribute("data-id"));
      });
      tr.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(tr.getAttribute("data-id"));
        }
      });
    });
  }

  // 5. 상세 모달
  function updateModalTabs() {
    if (!modalTabSummaryBtn || !modalTabScriptBtn) return;
    const isSummary = state.activeModalTab === "summary";
    modalTabSummaryBtn.classList.toggle("active", isSummary);
    modalTabSummaryBtn.setAttribute("aria-selected", String(isSummary));
    modalTabScriptBtn.classList.toggle("active", !isSummary);
    modalTabScriptBtn.setAttribute("aria-selected", String(!isSummary));
  }

  function openModal(itemId, tabMode, initialSlideIdx) {
    const item = DATA.items.find((i) => i.id === itemId);
    if (!item) return;

    state.activeModalId = itemId;
    state.activeModalTab = tabMode || "summary";
    state.activeSlideIndex = initialSlideIdx || 0;
    updateModalTabs();

    const stn = STATION_META[item.dateCode] || { stnCode: "감사", stationName: item.shortDate };

    modalBadgesEl.innerHTML = `
      <span class="dossier-badge">${escapeHtml(stn.stnCode)} · ${escapeHtml(item.shortDate)}</span>
      <span class="dossier-badge">${escapeHtml(item.themeName)}</span>
    `;

    modalTitleEl.textContent = item.title;
    modalMetricEl.textContent = item.keyMetric || "-";
    modalTargetEl.textContent = item.target ? `${item.agency} (${item.target})` : item.agency;

    renderModalBody(item);
    updateModalPrevNext();

    modalBackdropEl.classList.add("open");
    document.body.style.overflow = "hidden";

    if (history.replaceState) {
      history.replaceState(null, "", `#item=${encodeURIComponent(itemId)}`);
    }
  }

  function metricCardHtml(item) {
    const stn = STATION_META[item.dateCode] || { stnCode: "감사" };
    return `<div class="metric-card"><span class="metric-card-label">${escapeHtml(stn.stnCode)} · ${escapeHtml(item.agency)}</span><strong>${escapeHtml(item.keyMetric || item.title)}</strong><span class="metric-card-foot">국회의원 허영</span></div>`;
  }

  function closeModal() {
    state.activeModalId = null;
    modalBackdropEl.classList.remove("open");
    document.body.style.overflow = "";
    if (history.replaceState && window.location.hash.startsWith("#item=")) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }

  function renderModalBody(item) {
    modalContentEl.scrollTop = 0;

    if (state.activeModalTab === "script") {
      const blocks = item.fullBlocks || [];
      const tablesHtml =
        item.tables && item.tables.length > 0
          ? `
          <div class="dossier-tables-section">
            <h4 class="dossier-subhead">관련 통계표 (${item.tables.length}건)</h4>
            ${item.tables
              .map((rows) => {
                if (!rows || rows.length === 0) return "";
                const headRow = rows[0];
                const bodyRows = rows.slice(1);
                return `
                  <div class="data-table-box">
                    <table class="audit-data-table">
                      <thead>
                        <tr>
                          ${headRow.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}
                        </tr>
                      </thead>
                      <tbody>
                        ${bodyRows
                          .map(
                            (r) => `
                          <tr>
                            ${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}
                          </tr>
                        `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
          : "";

      const scriptHtml =
        blocks.length > 0
          ? `<div class="script-document">
              <h4 class="dossier-subhead">질의서 원문</h4>
              ${blocks
                .map((b) => {
                  const txt = escapeHtml(b.text);
                  if (b.type === "h2" || b.type === "heading") {
                    return `<h4 class="script-h2">${txt}</h4>`;
                  }
                  if (b.type === "question" || b.type === "quote") {
                    return `<blockquote class="script-quote">${txt}</blockquote>`;
                  }
                  if (b.type === "bullet") {
                    return `<p class="script-bullet">• ${txt}</p>`;
                  }
                  if (b.type === "sub") {
                    return `<p class="script-sub">- ${txt}</p>`;
                  }
                  return `<p class="script-p">${txt}</p>`;
                })
                .join("")}
            </div>`
          : `<p class="script-p">수록된 원문이 없습니다.</p>`;

      modalContentEl.innerHTML = `${tablesHtml}${scriptHtml}`;
      return;
    }

    const slides = item.slides || [];
    const idx = Math.min(Math.max(0, state.activeSlideIndex), Math.max(0, slides.length - 1));
    const currentSlide = slides[idx] || { src: item.thumb, caption: item.title };

    const slideViewerHtml =
      slides.length > 0
        ? `
        <div class="modal-slide-viewer">
          <div class="modal-slide-stage">
            <img
              id="modalMainSlideImg"
              src="${escapeHtml(currentSlide.src)}"
              alt="${escapeHtml(currentSlide.caption || item.title)}"
              class="modal-slide-img"
            />
            ${
              slides.length > 1
                ? `
                  <button type="button" id="modalSlidePrev" class="modal-slide-arrow prev" aria-label="이전">‹</button>
                  <button type="button" id="modalSlideNext" class="modal-slide-arrow next" aria-label="다음">›</button>
                  <div class="modal-slide-counter">
                    <span id="modalSlideNum">${idx + 1} / ${slides.length}</span>
                  </div>
                `
                : ""
            }
          </div>

          <div class="modal-slide-caption-bar">
            <span id="modalSlideCaption" class="modal-slide-caption">${escapeHtml(currentSlide.caption || item.title)}</span>
            <a href="${escapeHtml(currentSlide.src)}" target="_blank" rel="noopener noreferrer" id="modalSlideOrigLink" class="slide-orig-link">원본 보기 ↗</a>
          </div>

          ${
            slides.length > 1
              ? `
                <div class="modal-thumb-strip" role="tablist">
                  ${slides
                    .map(
                      (s, sIdx) => `
                      <button
                        type="button"
                        class="modal-thumb-btn ${sIdx === idx ? "active" : ""}"
                        data-sidx="${sIdx}"
                      >
                        <img src="${escapeHtml(s.src)}" alt="${sIdx + 1}" loading="lazy" />
                        <span>${sIdx + 1}</span>
                      </button>
                    `
                    )
                    .join("")}
                </div>
              `
              : ""
          }
        </div>
      `
        : "";

    const problemsHtml = (item.problems || [])
      .slice(0, 3)
      .map((p) => `<li>${escapeHtml(p)}</li>`)
      .join("");
    const proposalsHtml = (item.proposals || [])
      .slice(0, 3)
      .map((p) => `<li>${escapeHtml(p)}</li>`)
      .join("");

    modalContentEl.innerHTML = `
      ${slideViewerHtml}

      <div class="dossier-exec-box">
        <p class="dossier-exec-text">${escapeHtml(item.summary)}</p>
      </div>

      <div class="dossier-two-col">
        <div class="dossier-panel dossier-panel-prob">
          <div class="dossier-panel-head">문제점</div>
          <ul class="dossier-list">${problemsHtml}</ul>
        </div>
        <div class="dossier-panel dossier-panel-prop">
          <div class="dossier-panel-head">개선 대안</div>
          <ul class="dossier-list">${proposalsHtml}</ul>
        </div>
      </div>

      ${
        item.news && item.news.length > 0
          ? `<div class="dossier-news-section">
              <div class="dossier-news-head">
                <h4 class="dossier-news-title">언론 보도 (${item.news.length}건)</h4>
                ${
                  item.naverSearchUrl
                    ? `<a href="${escapeHtml(item.naverSearchUrl)}" target="_blank" rel="noopener noreferrer" class="naver-more-link">더보기 ↗</a>`
                    : ""
                }
              </div>
              <div class="dossier-news-list">
                ${item.news
                  .map(
                    (n) => `
                  <a href="${escapeHtml(n.url)}" target="_blank" rel="noopener noreferrer" class="dossier-news-card">
                    <div class="news-card-left">
                      <span class="news-card-press">${escapeHtml(n.press)}</span>
                      <span class="news-card-headline">${escapeHtml(n.title)}</span>
                    </div>
                    <div class="news-card-right">
                      ${n.date ? `<span>${escapeHtml(n.date)}</span>` : ""}
                      <span class="news-card-go">↗</span>
                    </div>
                  </a>
                `
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }
    `;

    if (slides.length > 1) {
      const setModalSlide = (newIdx) => {
        state.activeSlideIndex = (newIdx + slides.length) % slides.length;
        const sl = slides[state.activeSlideIndex];
        const imgEl = document.getElementById("modalMainSlideImg");
        const numEl = document.getElementById("modalSlideNum");
        const capEl = document.getElementById("modalSlideCaption");
        const origEl = document.getElementById("modalSlideOrigLink");
        if (imgEl) imgEl.src = sl.src;
        if (numEl) numEl.textContent = `${state.activeSlideIndex + 1} / ${slides.length}`;
        if (capEl) capEl.textContent = sl.caption || item.title;
        if (origEl) origEl.href = sl.src;
        modalContentEl.querySelectorAll(".modal-thumb-btn").forEach((b, bIdx) => {
          b.classList.toggle("active", bIdx === state.activeSlideIndex);
        });
      };

      const prevSBtn = document.getElementById("modalSlidePrev");
      const nextSBtn = document.getElementById("modalSlideNext");
      if (prevSBtn) prevSBtn.addEventListener("click", () => setModalSlide(state.activeSlideIndex - 1));
      if (nextSBtn) nextSBtn.addEventListener("click", () => setModalSlide(state.activeSlideIndex + 1));

      modalContentEl.querySelectorAll(".modal-thumb-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          setModalSlide(parseInt(btn.getAttribute("data-sidx"), 10));
        });
      });
    }
  }

  function updateModalPrevNext() {
    const filtered = getFilteredItems();
    const idx = filtered.findIndex((i) => i.id === state.activeModalId);
    modalPrevBtn.disabled = idx <= 0;
    modalNextBtn.disabled = idx === -1 || idx >= filtered.length - 1;
  }

  function resetAllFilters() {
    state.selectedDate = "ALL";
    state.selectedTheme = "ALL";
    state.searchQuery = "";
    if (searchInputEl) searchInputEl.value = "";
    if (searchClearEl) searchClearEl.classList.remove("visible");
    updateAll();
  }

  function stepStation(direction) {
    const codes = DATA.schedules.map((s) => s.code);
    if (state.selectedDate === "ALL") {
      state.selectedDate = direction > 0 ? codes[0] : codes[codes.length - 1];
    } else {
      const currIdx = codes.indexOf(state.selectedDate);
      const nextIdx = currIdx + direction;
      if (nextIdx < 0 || nextIdx >= codes.length) {
        state.selectedDate = "ALL";
      } else {
        state.selectedDate = codes[nextIdx];
      }
    }
    updateAll();
  }

  function updateAll() {
    renderStationMap();
    renderPolicyLines();
    renderQuickTags();
    renderResults();
  }

  // Event Listeners
  if (hlPrevBtn && highlightTrackEl) {
    hlPrevBtn.addEventListener("click", () => {
      highlightTrackEl.scrollBy({ left: -420, behavior: "smooth" });
    });
  }
  if (hlNextBtn && highlightTrackEl) {
    hlNextBtn.addEventListener("click", () => {
      highlightTrackEl.scrollBy({ left: 420, behavior: "smooth" });
    });
  }

  if (btnAllStations) {
    btnAllStations.addEventListener("click", () => {
      state.selectedDate = "ALL";
      updateAll();
    });
  }

  if (btnPrevStation) {
    btnPrevStation.addEventListener("click", () => stepStation(-1));
  }

  if (btnNextStation) {
    btnNextStation.addEventListener("click", () => stepStation(1));
  }

  if (headerResetBtn) {
    headerResetBtn.addEventListener("click", () => {
      resetAllFilters();
    });
  }

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", resetAllFilters);
  }

  if (searchInputEl) {
    searchInputEl.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      searchClearEl.classList.toggle("visible", Boolean(state.searchQuery));
      renderQuickTags();
      renderResults();
    });
  }

  if (searchClearEl) {
    searchClearEl.addEventListener("click", () => {
      state.searchQuery = "";
      searchInputEl.value = "";
      searchClearEl.classList.remove("visible");
      renderQuickTags();
      renderResults();
      searchInputEl.focus();
    });
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    if (viewCardBtn) viewCardBtn.classList.toggle("active", mode === "card");
    if (viewSlideBtn) viewSlideBtn.classList.toggle("active", mode === "slide");
    if (viewListBtn) viewListBtn.classList.toggle("active", mode === "list");
    renderResults();
  }

  if (viewCardBtn) viewCardBtn.addEventListener("click", () => setViewMode("card"));
  if (viewSlideBtn) viewSlideBtn.addEventListener("click", () => setViewMode("slide"));
  if (viewListBtn) viewListBtn.addEventListener("click", () => setViewMode("list"));

  if (modalTabSummaryBtn && modalTabScriptBtn) {
    modalTabSummaryBtn.addEventListener("click", () => {
      if (state.activeModalTab === "summary") return;
      state.activeModalTab = "summary";
      updateModalTabs();
      const item = DATA.items.find((i) => i.id === state.activeModalId);
      if (item) renderModalBody(item);
    });

    modalTabScriptBtn.addEventListener("click", () => {
      if (state.activeModalTab === "script") return;
      state.activeModalTab = "script";
      updateModalTabs();
      const item = DATA.items.find((i) => i.id === state.activeModalId);
      if (item) renderModalBody(item);
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeModal);
  }

  if (modalBackdropEl) {
    modalBackdropEl.addEventListener("click", (e) => {
      if (e.target === modalBackdropEl) closeModal();
    });
  }

  if (modalPrevBtn) {
    modalPrevBtn.addEventListener("click", () => {
      const filtered = getFilteredItems();
      const idx = filtered.findIndex((i) => i.id === state.activeModalId);
      if (idx > 0) {
        openModal(filtered[idx - 1].id, state.activeModalTab);
      }
    });
  }

  if (modalNextBtn) {
    modalNextBtn.addEventListener("click", () => {
      const filtered = getFilteredItems();
      const idx = filtered.findIndex((i) => i.id === state.activeModalId);
      if (idx >= 0 && idx < filtered.length - 1) {
        openModal(filtered[idx + 1].id, state.activeModalTab);
      }
    });
  }

  if (modalShareBtn) {
    modalShareBtn.addEventListener("click", () => {
      const url = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast("링크가 복사되었습니다.");
        });
      }
    });
  }

  if (modalPrintBtn) {
    modalPrintBtn.addEventListener("click", () => {
      window.print();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (!state.activeModalId) return;
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "ArrowLeft") {
      const filtered = getFilteredItems();
      const idx = filtered.findIndex((i) => i.id === state.activeModalId);
      if (idx > 0) openModal(filtered[idx - 1].id, state.activeModalTab);
    } else if (e.key === "ArrowRight") {
      const filtered = getFilteredItems();
      const idx = filtered.findIndex((i) => i.id === state.activeModalId);
      if (idx >= 0 && idx < filtered.length - 1) openModal(filtered[idx + 1].id, state.activeModalTab);
    }
  });

  renderHighlights();
  updateAll();

  if (window.location.hash.startsWith("#item=")) {
    const targetId = decodeURIComponent(window.location.hash.slice(6));
    if (DATA.items.some((i) => i.id === targetId)) {
      openModal(targetId);
    }
  }
})();
