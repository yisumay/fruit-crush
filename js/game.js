(function () {
  const COLS = 8;
  const ROWS = 11;
  const DRAG_PX = 12;
  const SUM_TARGET = 10;

  const FRUITS = [
    { id: "apple", name: "苹果", file: "apple.svg" },
    { id: "orange", name: "橙子", file: "orange.svg" },
    { id: "grape", name: "葡萄", file: "grape.svg" },
    { id: "strawberry", name: "草莓", file: "strawberry.svg" },
    { id: "banana", name: "香蕉", file: "banana.svg" },
    { id: "cherry", name: "樱桃", file: "cherry.svg" },
    { id: "watermelon", name: "西瓜", file: "watermelon.svg" },
  ];

  const boardEl = document.getElementById("board");
  const boardWrap = document.getElementById("board-wrap");
  const selRect = document.getElementById("selection-rect");
  const scoreEl = document.getElementById("score");
  const forbiddenEl = document.getElementById("forbidden-num");
  const fruitNameEl = document.getElementById("fruit-name");
  const fruitImgEl = document.getElementById("fruit-preview");
  const toastEl = document.getElementById("toast");
  const newBtn = document.getElementById("btn-new");

  let grid = [];
  let theme = null;
  let forbidden = 1;
  let score = 0;

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startCell = null;
  let dragActive = false;
  let currentEndCell = null;

  function randomDigit() {
    return 1 + Math.floor(Math.random() * 9);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(randomDigit());
      grid.push(row);
    }
  }

  function setTheme(t) {
    theme = t;
    const url = `assets/fruits/${t.file}`;
    fruitNameEl.textContent = t.name;
    fruitImgEl.src = url;
    fruitImgEl.alt = t.name;
  }

  function newGame() {
    theme = pick(FRUITS);
    forbidden = randomDigit();
    score = 0;
    buildGrid();
    setTheme(theme);
    forbiddenEl.textContent = String(forbidden);
    scoreEl.textContent = "0";
    renderBoard();
    showToast(
      `本局水果：${theme.name}。禁忌数字：${forbidden}（短按该数字所在格会清零得分）`,
      "info"
    );
  }

  function showToast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = "toast show";
    if (kind === "bad") toastEl.classList.add("bad");
    else if (kind === "good") toastEl.classList.add("good");
    clearTimeout(showToast._t);
    const ms = kind === "info" ? 3600 : kind === "bad" ? 2800 : 2200;
    showToast._t = setTimeout(() => {
      toastEl.classList.remove("show", "bad", "good");
    }, ms);
  }

  function cellAt(r, c) {
    return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  }

  function renderBoard() {
    boardEl.style.setProperty("--cols", COLS);
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        const div = document.createElement("div");
        div.className = "cell";
        div.dataset.r = r;
        div.dataset.c = c;
        div.style.backgroundImage = `url(assets/fruits/${theme.file})`;
        const span = document.createElement("span");
        span.className = "num";
        span.textContent = String(v);
        div.appendChild(span);
        boardEl.appendChild(div);
      }
    }
  }

  function rectFromCells(r0, c0, r1, c1) {
    const top = Math.min(r0, r1);
    const bottom = Math.max(r0, r1);
    const left = Math.min(c0, c1);
    const right = Math.max(c0, c1);
    return { top, bottom, left, right };
  }

  function sumInRect(top, bottom, left, right) {
    let s = 0;
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) s += grid[r][c];
    }
    return s;
  }

  function countInRect(top, bottom, left, right) {
    return (bottom - top + 1) * (right - left + 1);
  }

  function updateSelectionOverlay(r0, c0, r1, c1) {
    const a = cellAt(r0, c0);
    const b = cellAt(r1, c1);
    if (!a || !b) {
      selRect.style.display = "none";
      return;
    }
    const wrap = boardWrap.getBoundingClientRect();
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const left = Math.min(ra.left, rb.left) - wrap.left + boardWrap.scrollLeft;
    const top = Math.min(ra.top, rb.top) - wrap.top + boardWrap.scrollTop;
    const right = Math.max(ra.right, rb.right) - wrap.left + boardWrap.scrollLeft;
    const bottom = Math.max(ra.bottom, rb.bottom) - wrap.top + boardWrap.scrollTop;
    selRect.style.display = "block";
    selRect.style.left = `${left}px`;
    selRect.style.top = `${top}px`;
    selRect.style.width = `${right - left}px`;
    selRect.style.height = `${bottom - top}px`;
  }

  function clearSelectionVisual() {
    boardEl.querySelectorAll(".cell.selected").forEach((el) => el.classList.remove("selected"));
    selRect.style.display = "none";
  }

  function highlightRect(top, bottom, left, right) {
    clearSelectionVisual();
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const el = cellAt(r, c);
        if (el) el.classList.add("selected");
      }
    }
  }

  function applyGravity() {
    for (let c = 0; c < COLS; c++) {
      const kept = [];
      for (let r = 0; r < ROWS; r++) kept.push(grid[r][c]);
      const nonNull = kept.filter((x) => x !== null);
      const missing = ROWS - nonNull.length;
      const topNew = Array.from({ length: missing }, () => randomDigit());
      const col = [...topNew, ...nonNull];
      for (let r = 0; r < ROWS; r++) grid[r][c] = col[r];
    }
  }

  function tryClearRect(top, bottom, left, right) {
    const s = sumInRect(top, bottom, left, right);
    if (s !== SUM_TARGET) {
      showToast(`区域内数字之和为 ${s}，需要恰好 ${SUM_TARGET}`, "bad");
      boardEl.querySelectorAll(".cell").forEach((el) => el.classList.add("shake"));
      setTimeout(() => {
        boardEl.querySelectorAll(".cell").forEach((el) => el.classList.remove("shake"));
      }, 500);
      return;
    }
    const n = countInRect(top, bottom, left, right);
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const el = cellAt(r, c);
        if (el) el.classList.add("pop");
      }
    }
    setTimeout(() => {
      for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) grid[r][c] = null;
      }
      applyGravity();
      score += n;
      scoreEl.textContent = String(score);
      showToast(`消除 ${n} 个，+${n} 分`, "good");
      renderBoard();
    }, 320);
  }

  function pointToCell(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cell = el.closest(".cell");
    if (!cell || !boardEl.contains(cell)) return null;
    return {
      r: parseInt(cell.dataset.r, 10),
      c: parseInt(cell.dataset.c, 10),
    };
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    pointerId = e.pointerId;
    boardWrap.setPointerCapture(pointerId);
    startX = e.clientX;
    startY = e.clientY;
    dragActive = false;
    startCell = pointToCell(e.clientX, e.clientY);
    currentEndCell = startCell;
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (pointerId !== e.pointerId || !startCell) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragActive && (dx * dx + dy * dy > DRAG_PX * DRAG_PX)) dragActive = true;
    if (!dragActive) return;
    const end = pointToCell(e.clientX, e.clientY);
    if (end) {
      currentEndCell = end;
      const { top, bottom, left, right } = rectFromCells(
        startCell.r,
        startCell.c,
        end.r,
        end.c
      );
      highlightRect(top, bottom, left, right);
      updateSelectionOverlay(startCell.r, startCell.c, end.r, end.c);
    }
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (pointerId !== e.pointerId) return;
    boardWrap.releasePointerCapture(pointerId);
    pointerId = null;

    if (!startCell) return;

    if (!dragActive) {
      const v = grid[startCell.r][startCell.c];
      if (v === forbidden) {
        score = 0;
        scoreEl.textContent = "0";
        const el = cellAt(startCell.r, startCell.c);
        if (el) {
          el.classList.add("shake");
          setTimeout(() => el.classList.remove("shake"), 500);
        }
        showToast(`点中了禁忌数字 ${forbidden}，得分已清零！`, "bad");
      }
      startCell = null;
      clearSelectionVisual();
      return;
    }

    const end = currentEndCell || startCell;
    const { top, bottom, left, right } = rectFromCells(
      startCell.r,
      startCell.c,
      end.r,
      end.c
    );
    clearSelectionVisual();
    tryClearRect(top, bottom, left, right);
    startCell = null;
    dragActive = false;
    e.preventDefault();
  }

  function onPointerCancel(e) {
    if (pointerId === e.pointerId) {
      pointerId = null;
      startCell = null;
      dragActive = false;
      clearSelectionVisual();
    }
  }

  boardWrap.addEventListener("pointerdown", onPointerDown);
  boardWrap.addEventListener("pointermove", onPointerMove);
  boardWrap.addEventListener("pointerup", onPointerUp);
  boardWrap.addEventListener("pointercancel", onPointerCancel);

  newBtn.addEventListener("click", newGame);

  newGame();
})();
