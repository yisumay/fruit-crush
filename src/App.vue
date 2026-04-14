<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  mountFruitGame,
  type FruitGameApi,
  type RoundSettlePayload,
} from "./game/fruitGame";

const boardRef = ref<HTMLElement | null>(null);
const boardWrapRef = ref<HTMLElement | null>(null);
const selRectRef = ref<HTMLElement | null>(null);
const scoreRef = ref<HTMLElement | null>(null);
const forbiddenRef = ref<HTMLElement | null>(null);
const fruitNameRef = ref<HTMLElement | null>(null);
const fruitImgRef = ref<HTMLImageElement | null>(null);
const toastRef = ref<HTMLElement | null>(null);
const newBtnRef = ref<HTMLButtonElement | null>(null);
const newBtnHeaderRef = ref<HTMLButtonElement | null>(null);
const timerFillRef = ref<HTMLElement | null>(null);
const timerLabelRef = ref<HTMLElement | null>(null);

let api: FruitGameApi | null = null;

/** 默认关闭：标准凑十；开启后为高难度（禁用数字，且该数字在棋盘上更少见） */
const hardModeForbidden = ref(false);

const settleOpen = ref(false);
const settlePayload = ref<RoundSettlePayload | null>(null);

type SettleTier = "genius" | "awesome" | "excellent" | "retry";

function tierFromScore(score: number): SettleTier {
  if (score >= 90) return "genius";
  if (score >= 80) return "awesome";
  if (score >= 70) return "excellent";
  return "retry";
}

const settleTier = computed(() => {
  const p = settlePayload.value;
  if (!p) return "retry" as SettleTier;
  return tierFromScore(p.score);
});

const settlePresentation = computed(() => {
  const t = settleTier.value;
  const map = {
    genius: {
      headline: "天才",
      tagline: "反应与心算已拉满，这一局堪称教科书级别。",
      emoji: "🧠",
      ring: "from-[#f72585] via-[#b5179e] to-[#4361ee]",
      badge:
        "bg-gradient-to-r from-[#ffd166] via-[#ff9e00] to-[#ff6b6b] text-[#1a0a00]",
      cardBorder: "border-[#ffd166]/55 shadow-[0_0_0_1px_rgba(255,209,102,0.2),0_24px_80px_rgba(114,9,183,0.35)]",
      glow: "bg-[#b5179e]/25",
    },
    awesome: {
      headline: "真棒",
      tagline: "节奏稳、判断准，再冲一把就能触摸满分线。",
      emoji: "🌟",
      ring: "from-[#ff9e00] to-[#ff6b6b]",
      badge:
        "bg-gradient-to-r from-[#ff9e00] to-[#ff6b6b] text-white shadow-lg shadow-orange-500/30",
      cardBorder: "border-[#ff9e00]/45 shadow-[0_20px_60px_rgba(255,158,0,0.22)]",
      glow: "bg-[#ff6b6b]/15",
    },
    excellent: {
      headline: "优秀",
      tagline: "发挥出色，保持专注还能更上一层楼。",
      emoji: "✨",
      ring: "from-[#4cc9f0] to-[#4361ee]",
      badge:
        "bg-gradient-to-r from-[#4cc9f0] to-[#3a86ff] text-[#0a1628] shadow-lg shadow-cyan-500/25",
      cardBorder: "border-[#4cc9f0]/40 shadow-[0_18px_50px_rgba(76,201,240,0.18)]",
      glow: "bg-[#4361ee]/12",
    },
    retry: {
      headline: "再接再厉",
      tagline: "分数只是过程，调整节奏、多练凑十，下一局会更好。",
      emoji: "💪",
      ring: "from-[#8b9cb3] to-[#5c6f82]",
      badge: "bg-[#2d3a4d] text-[#e8eef5] border border-white/10",
      cardBorder: "border-white/[0.12] shadow-[0_16px_48px_rgba(0,0,0,0.35)]",
      glow: "bg-[#8b9cb3]/08",
    },
  } as const;
  return map[t];
});

const settleFruitUrl = computed(() => {
  const f = settlePayload.value?.fruitFile;
  if (!f) return "";
  return `/assets/fruits/${f}`;
});

function openSettlement(p: RoundSettlePayload): void {
  settlePayload.value = p;
  settleOpen.value = true;
}

function closeSettlement(): void {
  settleOpen.value = false;
}

function playAgain(): void {
  closeSettlement();
  api?.newGame({ silent: true });
}

function onHardModeChange(): void {
  api?.newGame({ silent: true });
}

onMounted(() => {
  const boardEl = boardRef.value;
  const boardWrap = boardWrapRef.value;
  const selRect = selRectRef.value;
  const scoreEl = scoreRef.value;
  const forbiddenEl = forbiddenRef.value;
  const fruitNameEl = fruitNameRef.value;
  const fruitImgEl = fruitImgRef.value;
  const toastEl = toastRef.value;
  const newGameBtns = [newBtnHeaderRef.value, newBtnRef.value].filter(
    (b): b is HTMLButtonElement => b != null
  );
  const timerFillEl = timerFillRef.value;
  const timerLabelEl = timerLabelRef.value;
  if (
    !boardEl ||
    !boardWrap ||
    !selRect ||
    !scoreEl ||
    !forbiddenEl ||
    !fruitNameEl ||
    !fruitImgEl ||
    !toastEl ||
    newGameBtns.length === 0 ||
    !timerFillEl ||
    !timerLabelEl
  ) {
    return;
  }
  api = mountFruitGame({
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
    onRoundSettle: openSettlement,
    onNewRound: closeSettlement,
    isHardModeForbidden: () => hardModeForbidden.value,
  });
});

onBeforeUnmount(() => {
  api?.destroy();
});
</script>

<template>
  <div
    class="max-w-[min(1180px,calc(100%-1rem))] mx-auto px-2 sm:px-3.5 pt-3 sm:pt-4 pb-6 sm:pb-8 box-border flex flex-col"
  >
    <!-- 顶部品牌：移动端首屏可见；桌面端同样置顶，下方为三栏 -->
    <header
      class="flex items-center justify-between gap-2 sm:gap-3 mb-12px sm:mb-3 lg:mb-4 shrink-0"
    >
      <div class="flex items-center gap-2 sm:gap-2.5 lg:gap-3 min-w-0 flex-1">
        <img
          src="/logo-mark.svg"
          width="36"
          height="36"
          alt=""
          class="w-24px h-24px sm:w-10 sm:h-10 lg:w-12 lg:h-12 shrink-0 rounded-lg sm:rounded-xl lg:rounded-2xl shadow-[0_4px_16px_rgba(67,97,238,0.32)] lg:shadow-[0_6px_20px_rgba(67,97,238,0.35)]"
          decoding="async"
        />
        <h1
          class="app-title text-[1rem] sm:text-[1.15rem] lg:text-26px font-bold m-0 tracking-wide leading-tight min-w-0"
        >
          水果凑十
        </h1>
      </div>
      <button
        ref="newBtnHeaderRef"
        type="button"
        class="lg:hidden shrink-0 whitespace-nowrap border-none py-1.5 px-2.5 sm:px-3 rounded-lg text-[0.68rem] sm:text-[0.74rem] font-semibold cursor-pointer text-white bg-gradient-to-b from-[#5b73ff] via-[#4f6cf5] to-[#3d52d4] shadow-[0_2px_10px_rgba(99,102,241,0.4)] active:scale-[0.96]"
      >
        新开一局
      </button>
    </header>

    <div
      class="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch lg:items-start flex-1 min-h-0"
    >
      <!-- 规则说明：移动端在棋盘与数据栏之下；桌面仍在左侧 -->
      <aside
        class="shrink-0 lg:w-[min(300px,34%)] order-3 lg:order-1 lg:pt-1 w-full max-w-full"
      >
        <p class="app-muted text-[0.8125rem] sm:text-15px leading-relaxed m-0">
          在棋盘上按住并拖出一个矩形区域，使框内水果上的数字之和恰好等于
          <strong class="text-[#e8eef5]">10</strong>
          即可消除并得分。默认<strong class="text-[#e8eef5]">简单模式</strong>无其它限制。在棋盘下方区域勾选
          <strong class="text-[#e8eef5]">高难度 · 禁用数字</strong>
          后，本局会随机一个禁用数字：凑十框选区域内<strong class="text-[#e8eef5]">不可含</strong>该数字。每局限时
          <strong class="text-[#e8eef5]">2 分 30 秒</strong>。
        </p>
      </aside>

      <!-- 中：水果盘（移动端紧跟标题，减少首屏滚动） -->
      <div
        class="flex-1 min-w-0 flex justify-center items-start order-1 lg:order-2 w-full"
      >
        <div
          ref="boardWrapRef"
          class="board-shell relative touch-none rounded-2xl p-2 sm:p-2.5 w-full max-w-full mx-auto lg:w-fit"
        >
          <div ref="selRectRef" class="selection-rect" />
          <div id="board" ref="boardRef" />
        </div>
      </div>

      <!-- 计时 / 得分等：移动端在棋盘下、规则上；桌面仍在右侧 -->
      <aside
        class="shrink-0 lg:w-[min(280px,32%)] flex flex-col gap-2.5 sm:gap-3 order-2 lg:order-3 w-full max-w-full lg:max-w-none"
      >
        <div class="round-timer app-panel rounded-xl py-2 sm:py-3 px-3.5">
          <div class="round-timer__row">
            <span>本局剩余时间</span>
            <strong ref="timerLabelRef">2:30</strong>
          </div>
          <div class="round-timer__track">
            <div ref="timerFillRef" class="round-timer__fill" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="app-panel rounded-xl  py-2 sm:py-3 px-3.5">
            <div
              class="app-muted text-[0.7rem] uppercase tracking-wider mb-1"
            >
              得分
            </div>
            <div ref="scoreRef" class="text-25px lh-30px font-bold">0</div>
          </div>
          <div class="app-panel rounded-xl  py-2 sm:py-3 px-3.5">
            <div
              class="app-muted text-[0.7rem] uppercase tracking-wider mb-1"
            >
              禁用数字
            </div>
            <div
              ref="forbiddenRef"
              class="text-[1.6rem] font-bold leading-none transition-colors"
              :class="
                hardModeForbidden ? 'text-[#ef476f]' : 'text-[#94a8c4]'
              "
            >
              —
            </div>
            <div class="app-muted text-[0.65rem] mt-1 leading-tight">
              {{ hardModeForbidden ? "点按仅提示" : "简单模式未启用" }}
            </div>
          </div>
        </div>

        <label
          class="app-panel rounded-xl py-2.5 px-3.5 flex items-center gap-2.5 cursor-pointer select-none hover:border-white/20 transition-colors"
        >
          <input
            v-model="hardModeForbidden"
            type="checkbox"
            class="w-4 h-4 rounded border-white/30 accent-[#5b73ff] shrink-0"
            @change="onHardModeChange"
          />
          <span class="text-[0.85rem] font-semibold text-[#e8eef5] leading-snug">
            高难度 · 禁用数字
          </span>
        </label>

        <div class="app-panel rounded-xl py-3 px-3.5">
          <div class="app-muted text-[0.7rem] uppercase tracking-wider mb-1">
            本局水果
          </div>
          <div class="flex items-center gap-2.5 mt-1.5">
            <img
              ref="fruitImgRef"
              src=""
              alt=""
              width="40"
              height="40"
              class="w-10 h-10 object-contain drop-shadow-md"
            />
            <span ref="fruitNameRef" class="font-semibold text-[0.95rem]"
              >—</span
            >
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <button
            ref="newBtnRef"
            type="button"
            class="hidden lg:flex w-full border-none py-2.5 px-[18px] rounded-[10px] text-[0.9rem] font-semibold cursor-pointer text-white bg-gradient-to-b from-[#5b73ff] via-[#4f6cf5] to-[#3d52d4] shadow-[0_4px_20px_rgba(99,102,241,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] active:scale-[0.98]"
          >
            新开一局
          </button>
          <span
            class="app-muted text-[0.75rem] text-center leading-snug hidden lg:block"
          >
            拖拽框选 · 短按单格
          </span>
        </div>
      </aside>
    </div>
  </div>

  <div ref="toastRef" class="toast" role="status" aria-live="polite" />

  <!-- 本局结算 -->
  <Teleport to="body">
    <div
      v-if="settleOpen && settlePayload"
      class="settle-backdrop fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settle-title"
    >
      <div
        class="absolute inset-0 bg-[#0a0f14]/75 backdrop-blur-md"
        aria-hidden="true"
        @click.self="playAgain"
      />
      <!-- 背景光斑 -->
      <div
        class="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          class="absolute -top-24 -left-16 w-[min(420px,70vw)] h-[min(420px,70vw)] rounded-full blur-[80px] opacity-90"
          :class="settlePresentation.glow"
        />
        <div
          class="absolute -bottom-32 -right-20 w-[min(380px,65vw)] h-[min(380px,65vw)] rounded-full bg-[#4cc9f0]/10 blur-[90px]"
        />
      </div>

      <div
        class="settle-card-anim relative w-full max-w-[min(420px,calc(100vw-2rem))] rounded-[22px] border border-solid bg-[#141c28]/92 overflow-hidden"
        :class="settlePresentation.cardBorder"
      >
        <div class="settle-shine opacity-80" aria-hidden="true" />
        <div
          class="relative px-6 pt-7 pb-6 sm:px-8 sm:pt-8 sm:pb-7 border-b border-white/[0.06]"
        >
          <div class="flex items-start justify-between gap-3 mb-5">
            <div>
              <p
                class="text-[0.72rem] uppercase tracking-[0.2em] text-[#8b9cb3] m-0 mb-1.5"
              >
                本局结束
              </p>
              <h2
                id="settle-title"
                class="text-[1.65rem] sm:text-[1.85rem] font-extrabold m-0 tracking-tight text-[#e8eef5]"
              >
                时间到 · 结算
              </h2>
            </div>
            <div
              class="relative w-[52px] h-[52px] shrink-0 flex items-center justify-center"
            >
              <span
                class="settle-pulse-ring absolute inset-0 rounded-2xl bg-gradient-to-br opacity-40"
                :class="settlePresentation.ring"
              />
              <span
                class="settle-float relative text-[1.85rem] leading-none drop-shadow-lg"
                aria-hidden="true"
                >{{ settlePresentation.emoji }}</span
              >
            </div>
          </div>

          <div class="flex flex-wrap items-end gap-2 mb-4">
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-[0.78rem] font-bold tracking-wide"
              :class="settlePresentation.badge"
            >
              {{ settlePresentation.headline }}
            </span>
            <span class="text-[0.8rem] text-[#8b9cb3] leading-snug max-w-[100%]">
              {{ settlePresentation.tagline }}
            </span>
          </div>

          <div
            class="relative rounded-2xl bg-black/28 border border-white/[0.07] px-5 py-6 text-center"
          >
            <p class="text-[0.75rem] text-[#8b9cb3] m-0 mb-1">本局得分</p>
            <p
              class="text-[clamp(2.75rem,12vw,3.75rem)] font-black tabular-nums leading-none m-0 bg-gradient-to-b from-white to-[#b8c9dc] bg-clip-text text-transparent drop-shadow-sm"
            >
              {{ settlePayload.score }}
            </p>
            <div
              class="mt-4 flex flex-wrap items-center justify-center gap-3 text-[0.82rem]"
            >
              <div
                class="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 border border-white/[0.06]"
              >
                <img
                  :src="settleFruitUrl"
                  :alt="settlePayload.fruitName"
                  width="36"
                  height="36"
                  class="w-9 h-9 object-contain"
                />
                <div class="text-left">
                  <div class="text-[0.65rem] text-[#8b9cb3]">本局水果</div>
                  <div class="font-semibold text-[#e8eef5]">
                    {{ settlePayload.fruitName }}
                  </div>
                </div>
              </div>
              <div
                class="flex items-center gap-2 rounded-xl bg-white/[0.05] px-3 py-2 border border-white/[0.06]"
              >
                <div
                  class="w-9 h-9 rounded-lg bg-[#ef476f]/15 flex items-center justify-center text-lg font-black text-[#ef476f]"
                >
                  {{ settlePayload.forbiddenEnabled ? settlePayload.forbidden : "—" }}
                </div>
                <div class="text-left">
                  <div class="text-[0.65rem] text-[#8b9cb3]">禁用数字</div>
                  <div class="font-semibold text-[#e8eef5]">
                    {{
                      settlePayload.forbiddenEnabled
                        ? "高难度 · 点按不扣分"
                        : "简单模式 · 未启用"
                    }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="relative px-6 py-4 sm:px-8 bg-[#0f1419]/80">
          <button
            type="button"
            class="w-full py-3 rounded-xl text-[0.92rem] font-bold text-white bg-gradient-to-b from-[#4361ee] to-[#3651d4] shadow-[0_4px_24px_rgba(67,97,238,0.45)] border border-white/10 hover:brightness-105 active:scale-[0.99] transition-all"
            @click="playAgain"
          >
            再来一局
          </button>
          <p class="text-center text-[0.72rem] text-[#6b7c90] m-0 mt-2.5">
            点击遮罩空白处也可快速开新局
          </p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
