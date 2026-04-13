<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import {
  mountFruitGame,
  type FruitGameApi,
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
const timerFillRef = ref<HTMLElement | null>(null);
const timerLabelRef = ref<HTMLElement | null>(null);

let api: FruitGameApi | null = null;

onMounted(() => {
  const boardEl = boardRef.value;
  const boardWrap = boardWrapRef.value;
  const selRect = selRectRef.value;
  const scoreEl = scoreRef.value;
  const forbiddenEl = forbiddenRef.value;
  const fruitNameEl = fruitNameRef.value;
  const fruitImgEl = fruitImgRef.value;
  const toastEl = toastRef.value;
  const newBtn = newBtnRef.value;
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
    !newBtn ||
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
    newBtn,
    timerFillEl,
    timerLabelEl,
  });
});

onBeforeUnmount(() => {
  api?.destroy();
});
</script>

<template>
  <div
    class="max-w-[min(1180px,calc(100%-1.75rem))] mx-auto px-3.5 pt-4 pb-8 box-border"
  >
    <div
      class="flex flex-col lg:flex-row gap-5 lg:gap-6 items-stretch lg:items-start"
    >
      <!-- 左：说明 -->
      <aside
        class="shrink-0 lg:w-[min(300px,34%)] order-2 lg:order-1 lg:pt-1"
      >
        <h1 class="text-[1.35rem] font-bold m-0 mb-2 tracking-wide">
          水果凑十
        </h1>
        <p class="text-[#8b9cb3] text-[0.85rem] leading-relaxed m-0">
          在棋盘上按住并拖出一个矩形区域，使框内水果上的数字之和恰好等于
          <strong class="text-[#e8eef5]">10</strong>
          即可消除并得分，且<strong class="text-[#e8eef5]">框内不能出现禁忌数字</strong>。每局随机一种水果主题，并有一个<strong
            class="text-[#e8eef5]"
            >禁忌数字</strong
          >：若<strong class="text-[#e8eef5]">点按</strong>（短按，不拖拽）该数字所在的格子，当前总分将清零。每局限时
          <strong class="text-[#e8eef5]">1 分 30 秒</strong>，右侧进度条会从左向右减短。
        </p>
      </aside>

      <!-- 中：水果盘 -->
      <div
        class="flex-1 min-w-0 flex justify-center items-start order-1 lg:order-2"
      >
        <div
          ref="boardWrapRef"
          class="relative touch-none rounded-2xl p-2.5 bg-black/25 border border-solid border-white/[0.08] w-fit max-w-full"
        >
          <div ref="selRectRef" class="selection-rect" />
          <div id="board" ref="boardRef" />
        </div>
      </div>

      <!-- 右：分数与进度条 -->
      <aside
        class="shrink-0 lg:w-[min(280px,32%)] flex flex-col gap-3 order-3"
      >
        <div
          class="round-timer bg-[#1a2332] rounded-xl py-3 px-3.5 border border-solid border-white/[0.06]"
        >
          <div class="round-timer__row">
            <span>本局剩余时间</span>
            <strong ref="timerLabelRef">1:30</strong>
          </div>
          <div class="round-timer__track">
            <div ref="timerFillRef" class="round-timer__fill" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div
            class="bg-[#1a2332] rounded-xl py-3 px-3.5 border border-solid border-white/[0.06]"
          >
            <div
              class="text-[0.7rem] uppercase tracking-wider text-[#8b9cb3] mb-1"
            >
              得分
            </div>
            <div ref="scoreRef" class="text-xl font-bold">0</div>
          </div>
          <div
            class="bg-[#1a2332] rounded-xl py-3 px-3.5 border border-solid border-white/[0.06]"
          >
            <div
              class="text-[0.7rem] uppercase tracking-wider text-[#8b9cb3] mb-1"
            >
              禁忌数字
            </div>
            <div
              ref="forbiddenRef"
              class="text-[1.6rem] font-bold text-[#ef476f] leading-none"
            >
              —
            </div>
            <div class="text-[0.65rem] text-[#8b9cb3] mt-1 leading-tight">
              点按清零
            </div>
          </div>
        </div>

        <div
          class="bg-[#1a2332] rounded-xl py-3 px-3.5 border border-solid border-white/[0.06]"
        >
          <div
            class="text-[0.7rem] uppercase tracking-wider text-[#8b9cb3] mb-1"
          >
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
            class="w-full border-none py-2.5 px-[18px] rounded-[10px] text-[0.9rem] font-semibold cursor-pointer text-white bg-gradient-to-b from-[#4361ee] to-[#3a56d4] shadow-[0_2px_12px_rgba(67,97,238,0.35)] active:scale-[0.98]"
          >
            新开一局
          </button>
          <span class="text-[0.75rem] text-[#8b9cb3] text-center leading-snug">
            拖拽框选 · 短按单格
          </span>
        </div>
      </aside>
    </div>
  </div>

  <div ref="toastRef" class="toast" role="status" aria-live="polite" />
</template>
