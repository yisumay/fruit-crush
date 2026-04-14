const COLS = 8;
const ROWS = 11;
const DRAG_PX = 12;
const SUM_TARGET = 10;
const ROUND_MS = 150 * 1000;

export interface FruitTheme {
  id: string;
  name: string;
  file: string;
}

const FRUITS: readonly FruitTheme[] = [
  { id: "apple", name: "苹果", file: "apple.svg" },
  { id: "orange", name: "橙子", file: "orange.svg" },
  { id: "strawberry", name: "草莓", file: "strawberry.svg" },
  { id: "cherry", name: "樱桃", file: "cherry.svg" },
  { id: "watermelon", name: "西瓜", file: "watermelon.svg" },
];

type GridCell = number | null;
type Grid = GridCell[][];
type ToastKind = "info" | "bad" | "good";

export interface RoundSettlePayload {
  score: number;
  fruitName: string;
  fruitFile: string;
  /** 禁用数字（仅高难度开启时有意义，否则为 0） */
  forbidden: number;
  /** 本局是否开启「禁用数字」高难度规则 */
  forbiddenEnabled: boolean;
}

export interface FruitGameElements {
  boardEl: HTMLElement;
  boardWrap: HTMLElement;
  selRect: HTMLElement;
  scoreEl: HTMLElement;
  forbiddenEl: HTMLElement;
  fruitNameEl: HTMLElement;
  fruitImgEl: HTMLImageElement;
  toastEl: HTMLElement;
  /** 点击后新开一局，可传多个按钮（如移动端顶栏 + 桌面侧栏） */
  newGameBtns: HTMLButtonElement[];
  timerFillEl: HTMLElement;
  timerLabelEl: HTMLElement;
  /** 时间耗尽时触发，用于展示结算 UI */
  onRoundSettle?: (payload: RoundSettlePayload) => void;
  /** 任意方式开启新一局时触发（含「新开一局」与结算后再来） */
  onNewRound?: () => void;
  /** 是否开启高难度：禁用数字 + 框内不可含该数字等 */
  isHardModeForbidden: () => boolean;
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
    newGameBtns,
    timerFillEl,
    timerLabelEl,
    onRoundSettle,
    onNewRound,
    isHardModeForbidden,
  } = els;

  /** 高难度下，棋盘上出现「禁用数字」格子的概率（约 4.5%，低于均匀随机的 1/9） */
  const HARD_MODE_FORBIDDEN_CELL_RATE = 0.045;

  /**
   * 按权重随机：较小数字（1～5）权重大，出现更多，矩形内更容易凑出 10。
   * 均匀 1～9 时大数偏多，可消组合会明显变少。
   */
  const PLAY_DIGIT_WEIGHT: readonly number[] = [
    0, 14, 14, 13, 12, 11, 9, 8, 6, 5,
  ];

  /** 标准模式：额外撒入的「相邻两格之和为 10」数对数量，保证盘面上总有一些直观看得到的解 */
  const SPRINKLE_SUM10_PAIR_COUNT = 16;

  const SUM10_ADJ_PAIRS: readonly (readonly [number, number])[] = [
    [1, 9],
    [9, 1],
    [2, 8],
    [8, 2],
    [3, 7],
    [7, 3],
    [4, 6],
    [6, 4],
    [5, 5],
  ];

  function hardOn(): boolean {
    return isHardModeForbidden();
  }

  let grid: Grid = [];
  let theme!: FruitTheme;
  let forbidden = 1;
  let score = 0;
  let roundEndTime = 0;
  let timerRaf: number | null = null;

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

  function weightPickFromPool(pool: readonly number[]): number {
    let sum = 0;
    for (const d of pool) sum += PLAY_DIGIT_WEIGHT[d] ?? 1;
    let r = Math.random() * sum;
    for (const d of pool) {
      r -= PLAY_DIGIT_WEIGHT[d] ?? 1;
      if (r <= 0) return d;
    }
    return pool[pool.length - 1]!;
  }

  /** 高难度：禁用数字在新生格中占比降低；其余格仍用偏「好凑十」的权重 */
  function randomDigitRareForbidden(fbd: number): number {
    if (Math.random() < HARD_MODE_FORBIDDEN_CELL_RATE) return fbd;
    const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== fbd);
    return weightPickFromPool(pool);
  }

  function rollNewCellDigit(): number {
    if (!hardOn()) return weightPickFromPool([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    return randomDigitRareForbidden(forbidden);
  }

  function cellKey(r: number, c: number): string {
    return `${r},${c}`;
  }

  /** 在标准模式下随机铺一些相邻两格之和为 10 的数对，降低「满盘无解感」 */
  function sprinkleSum10Pairs(pairCount: number): void {
    const used = new Set<string>();
    let placed = 0;
    for (let attempt = 0; attempt < 500 && placed < pairCount; attempt++) {
      const horizontal = Math.random() < 0.5;
      const pr = pick(SUM10_ADJ_PAIRS);
      if (horizontal) {
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * (COLS - 1));
        const k0 = cellKey(r, c);
        const k1 = cellKey(r, c + 1);
        if (used.has(k0) || used.has(k1)) continue;
        grid[r][c] = pr[0];
        grid[r][c + 1] = pr[1];
        used.add(k0);
        used.add(k1);
        placed++;
      } else {
        const r = Math.floor(Math.random() * (ROWS - 1));
        const c = Math.floor(Math.random() * COLS);
        const k0 = cellKey(r, c);
        const k1 = cellKey(r + 1, c);
        if (used.has(k0) || used.has(k1)) continue;
        grid[r][c] = pr[0];
        grid[r + 1][c] = pr[1];
        used.add(k0);
        used.add(k1);
        placed++;
      }
    }
  }

  function buildGrid(): void {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row: GridCell[] = [];
      for (let c = 0; c < COLS; c++) row.push(rollNewCellDigit());
      grid.push(row);
    }
    if (!hardOn()) sprinkleSum10Pairs(SPRINKLE_SUM10_PAIR_COUNT);
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
    const fe = hardOn();
    onRoundSettle?.({
      score: finalScore,
      fruitName: theme.name,
      fruitFile: theme.file,
      forbidden: fe ? forbidden : 0,
      forbiddenEnabled: fe,
    });
  }

  function setTheme(t: FruitTheme): void {
    theme = t;
    const url = `/assets/fruits/${t.file}`;
    fruitNameEl.textContent = t.name;
    fruitImgEl.src = url;
    fruitImgEl.alt = t.name;
  }

  function newGame(opts: NewGameOptions = {}): void {
    onNewRound?.();
    stopRoundTimer();
    theme = pick(FRUITS);
    if (hardOn()) {
      forbidden = randomDigit();
      forbiddenEl.textContent = String(forbidden);
    } else {
      forbidden = 0;
      forbiddenEl.textContent = "—";
    }
    score = 0;
    buildGrid();
    setTheme(theme);
    scoreEl.textContent = "0";
    renderBoard();
    startRoundTimer();
    if (!opts.silent) {
      if (hardOn()) {
        showToast(
          `本局水果：${theme.name}。【高难度】禁用数字：${forbidden}（点按仅提示；凑十框选区域内不可含该数字；棋盘上该数字出现较少）。每局限时 2 分 30 秒。`,
          "info"
        );
      } else {
        showToast(
          `本局水果：${theme.name}。简单模式：无禁用数字，凑十即可消除。可在侧栏开启「高难度 · 禁用数字」。每局限时 2 分 30 秒。`,
          "info"
        );
      }
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
      const topNew = Array.from({ length: missing }, () => rollNewCellDigit());
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
    if (hardOn() && rectContainsForbidden(top, bottom, left, right)) {
      showToast(
        `虽然区域之和为 ${SUM_TARGET}，但框内含有禁用数字 ${forbidden}，无法消除（得分不变）`,
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
      if (hardOn() && v === forbidden) {
        const el = cellAt(startCell.r, startCell.c);
        if (el) {
          el.classList.add("shake");
          setTimeout(() => el.classList.remove("shake"), 500);
        }
        showToast(
          `点按了禁用数字 ${forbidden}，得分不变；凑十框选区域内也不可包含该数字。`,
          "bad"
        );
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
  for (const btn of newGameBtns) {
    btn.addEventListener("click", onNewGameClick);
  }

  newGame();

  return {
    newGame,
    destroy() {
      boardWrap.removeEventListener("pointerdown", onPointerDown);
      boardWrap.removeEventListener("pointermove", onPointerMove);
      boardWrap.removeEventListener("pointerup", onPointerUp);
      boardWrap.removeEventListener("pointercancel", onPointerCancel);
      for (const btn of newGameBtns) {
        btn.removeEventListener("click", onNewGameClick);
      }
      stopRoundTimer();
      if (hideToastTimer !== undefined) clearTimeout(hideToastTimer);
    },
  };
}
