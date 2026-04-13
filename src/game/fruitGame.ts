const COLS = 8;
const ROWS = 11;
const DRAG_PX = 12;
const SUM_TARGET = 10;
const ROUND_MS = 90 * 1000;

export interface FruitTheme {
  id: string;
  name: string;
  file: string;
}

const FRUITS: readonly FruitTheme[] = [
  { id: "apple", name: "苹果", file: "apple.svg" },
  { id: "orange", name: "橙子", file: "orange.svg" },
  { id: "grape", name: "葡萄", file: "grape.svg" },
  { id: "strawberry", name: "草莓", file: "strawberry.svg" },
  { id: "banana", name: "香蕉", file: "banana.svg" },
  { id: "cherry", name: "樱桃", file: "cherry.svg" },
  { id: "watermelon", name: "西瓜", file: "watermelon.svg" },
];

type GridCell = number | null;
type Grid = GridCell[][];
type ToastKind = "info" | "bad" | "good";

export interface FruitGameElements {
  boardEl: HTMLElement;
  boardWrap: HTMLElement;
  selRect: HTMLElement;
  scoreEl: HTMLElement;
  forbiddenEl: HTMLElement;
  fruitNameEl: HTMLElement;
  fruitImgEl: HTMLImageElement;
  toastEl: HTMLElement;
  newBtn: HTMLButtonElement;
  timerFillEl: HTMLElement;
  timerLabelEl: HTMLElement;
}

export interface NewGameOptions {
  silent?: boolean;
}

export interface FruitGameApi {
  newGame: (opts?: NewGameOptions) => void;
  destroy: () => void;
}

interface CellPos {
  r: number;
  c: number;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function mountFruitGame(els: FruitGameElements): FruitGameApi {
  const {
    boardEl,
    boardWrap,
    selRect,
    scoreEl,
    forbiddenEl,
    fruitNameEl,
    fruitImgEl,
    toastEl,
    newBtn,
    timerFillEl,
    timerLabelEl,
  } = els;

  let grid: Grid = [];
  let theme!: FruitTheme;
  let forbidden = 1;
  let score = 0;
  let roundEndTime = 0;
  let timerRaf: number | null = null;
  let pendingRoundTimeout: ReturnType<typeof setTimeout> | null = null;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startCell: CellPos | null = null;
  let dragActive = false;
  let currentEndCell: CellPos | null = null;

  let hideToastTimer: ReturnType<typeof setTimeout> | undefined;

  function randomDigit(): number {
    return 1 + Math.floor(Math.random() * 9);
  }

  function formatRemain(ms: number): string {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function stopRoundTimer(): void {
    if (timerRaf !== null) {
      cancelAnimationFrame(timerRaf);
      timerRaf = null;
    }
    if (pendingRoundTimeout !== null) {
      clearTimeout(pendingRoundTimeout);
      pendingRoundTimeout = null;
    }
  }

  function tickRoundTimer(): void {
    const now = Date.now();
    const left = Math.max(0, roundEndTime - now);
    const ratio = ROUND_MS > 0 ? left / ROUND_MS : 0;
    timerFillEl.style.transform = `scaleX(${ratio})`;
    timerLabelEl.textContent = formatRemain(left);
    if (left <= 0) {
      timerRaf = null;
      onRoundTimeUp();
      return;
    }
    timerRaf = requestAnimationFrame(tickRoundTimer);
  }

  function startRoundTimer(): void {
    stopRoundTimer();
    roundEndTime = Date.now() + ROUND_MS;
    timerFillEl.style.transform = "scaleX(1)";
    timerLabelEl.textContent = formatRemain(ROUND_MS);
    timerRaf = requestAnimationFrame(tickRoundTimer);
  }

  function onRoundTimeUp(): void {
    stopRoundTimer();
    const finalScore = score;
    showToast(`时间到！本局得分：${finalScore}。即将开始新一局…`, "bad", 5200);
    pendingRoundTimeout = setTimeout(() => {
      pendingRoundTimeout = null;
      newGame({ silent: true });
    }, 5300);
  }

  function buildGrid(): void {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row: GridCell[] = [];
      for (let c = 0; c < COLS; c++) row.push(randomDigit());
      grid.push(row);
    }
  }

  function setTheme(t: FruitTheme): void {
    theme = t;
    const url = `/assets/fruits/${t.file}`;
    fruitNameEl.textContent = t.name;
    fruitImgEl.src = url;
    fruitImgEl.alt = t.name;
  }

  function newGame(opts: NewGameOptions = {}): void {
    stopRoundTimer();
    theme = pick(FRUITS);
    forbidden = randomDigit();
    score = 0;
    buildGrid();
    setTheme(theme);
    forbiddenEl.textContent = String(forbidden);
    scoreEl.textContent = "0";
    renderBoard();
    startRoundTimer();
    if (!opts.silent) {
      showToast(
        `本局水果：${theme.name}。禁忌数字：${forbidden}（短按该数字所在格会清零得分；凑十框选区域内不可含该数字）。每局限时 1 分 30 秒（右侧进度条从左向右减短）。`,
        "info"
      );
    }
  }

  function showToast(msg: string, kind: ToastKind, durationMs?: number): void {
    toastEl.textContent = msg;
    toastEl.className = "toast show";
    if (kind === "bad") toastEl.classList.add("bad");
    else if (kind === "good") toastEl.classList.add("good");
    if (hideToastTimer !== undefined) clearTimeout(hideToastTimer);
    const ms =
      durationMs ??
      (kind === "info" ? 3600 : kind === "bad" ? 2800 : 2200);
    hideToastTimer = setTimeout(() => {
      toastEl.classList.remove("show", "bad", "good");
      hideToastTimer = undefined;
    }, ms);
  }

  function cellAt(r: number, c: number): HTMLElement | null {
    return boardEl.querySelector<HTMLElement>(
      `.cell[data-r="${r}"][data-c="${c}"]`
    );
  }

  function renderBoard(): void {
    boardEl.style.setProperty("--cols", String(COLS));
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        const div = document.createElement("div");
        div.className = "cell";
        div.dataset.r = String(r);
        div.dataset.c = String(c);
        div.style.backgroundImage = `url(/assets/fruits/${theme.file})`;
        const span = document.createElement("span");
        span.className = "num";
        span.textContent = v === null ? "" : String(v);
        div.appendChild(span);
        boardEl.appendChild(div);
      }
    }
  }

  function rectFromCells(
    r0: number,
    c0: number,
    r1: number,
    c1: number
  ): { top: number; bottom: number; left: number; right: number } {
    const top = Math.min(r0, r1);
    const bottom = Math.max(r0, r1);
    const left = Math.min(c0, c1);
    const right = Math.max(c0, c1);
    return { top, bottom, left, right };
  }

  function sumInRect(
    top: number,
    bottom: number,
    left: number,
    right: number
  ): number {
    let s = 0;
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const v = grid[r][c];
        if (v != null) s += v;
      }
    }
    return s;
  }

  function countInRect(
    top: number,
    bottom: number,
    left: number,
    right: number
  ): number {
    return (bottom - top + 1) * (right - left + 1);
  }

  function rectContainsForbidden(
    top: number,
    bottom: number,
    left: number,
    right: number
  ): boolean {
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        if (grid[r][c] === forbidden) return true;
      }
    }
    return false;
  }

  function shakeAllCells(): void {
    boardEl.querySelectorAll(".cell").forEach((el) => el.classList.add("shake"));
    setTimeout(() => {
      boardEl
        .querySelectorAll(".cell")
        .forEach((el) => el.classList.remove("shake"));
    }, 500);
  }

  function updateSelectionOverlay(
    r0: number,
    c0: number,
    r1: number,
    c1: number
  ): void {
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
    const right =
      Math.max(ra.right, rb.right) - wrap.left + boardWrap.scrollLeft;
    const bottom =
      Math.max(ra.bottom, rb.bottom) - wrap.top + boardWrap.scrollTop;
    selRect.style.display = "block";
    selRect.style.left = `${left}px`;
    selRect.style.top = `${top}px`;
    selRect.style.width = `${right - left}px`;
    selRect.style.height = `${bottom - top}px`;
  }

  function clearSelectionVisual(): void {
    boardEl
      .querySelectorAll(".cell.selected")
      .forEach((el) => el.classList.remove("selected"));
    selRect.style.display = "none";
  }

  function highlightRect(
    top: number,
    bottom: number,
    left: number,
    right: number
  ): void {
    clearSelectionVisual();
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const el = cellAt(r, c);
        if (el) el.classList.add("selected");
      }
    }
  }

  function applyGravity(): void {
    for (let c = 0; c < COLS; c++) {
      const kept: number[] = [];
      for (let r = 0; r < ROWS; r++) {
        const v = grid[r][c];
        if (v !== null) kept.push(v);
      }
      const missing = ROWS - kept.length;
      const topNew = Array.from({ length: missing }, () => randomDigit());
      const col = [...topNew, ...kept];
      for (let r = 0; r < ROWS; r++) grid[r][c] = col[r];
    }
  }

  function tryClearRect(
    top: number,
    bottom: number,
    left: number,
    right: number
  ): void {
    const s = sumInRect(top, bottom, left, right);
    if (s !== SUM_TARGET) {
      showToast(`区域内数字之和为 ${s}，需要恰好 ${SUM_TARGET}`, "bad");
      shakeAllCells();
      return;
    }
    if (rectContainsForbidden(top, bottom, left, right)) {
      showToast(
        `虽然区域之和为 ${SUM_TARGET}，但框内含有禁忌数字 ${forbidden}，无法消除`,
        "bad"
      );
      shakeAllCells();
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

  function pointToCell(clientX: number, clientY: number): CellPos | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cell = el.closest(".cell") as HTMLElement | null;
    if (!cell || !boardEl.contains(cell)) return null;
    const r = cell.dataset.r;
    const c = cell.dataset.c;
    if (r === undefined || c === undefined) return null;
    return {
      r: parseInt(r, 10),
      c: parseInt(c, 10),
    };
  }

  function onPointerDown(e: PointerEvent): void {
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

  function onPointerMove(e: PointerEvent): void {
    if (pointerId !== e.pointerId || !startCell) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragActive && dx * dx + dy * dy > DRAG_PX * DRAG_PX) dragActive = true;
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

  function onPointerUp(e: PointerEvent): void {
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

    const end = currentEndCell ?? startCell;
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

  function onPointerCancel(event: PointerEvent): void {
    if (pointerId === event.pointerId) {
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

  function onNewGameClick(): void {
    newGame();
  }
  newBtn.addEventListener("click", onNewGameClick);

  newGame();

  return {
    newGame,
    destroy() {
      boardWrap.removeEventListener("pointerdown", onPointerDown);
      boardWrap.removeEventListener("pointermove", onPointerMove);
      boardWrap.removeEventListener("pointerup", onPointerUp);
      boardWrap.removeEventListener("pointercancel", onPointerCancel);
      newBtn.removeEventListener("click", onNewGameClick);
      stopRoundTimer();
      if (hideToastTimer !== undefined) clearTimeout(hideToastTimer);
    },
  };
}
