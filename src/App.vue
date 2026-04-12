<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { mountFruitGame } from "./game/fruitGame.js";

const boardRef = ref(null);
const boardWrapRef = ref(null);
const selRectRef = ref(null);
const scoreRef = ref(null);
const forbiddenRef = ref(null);
const fruitNameRef = ref(null);
const fruitImgRef = ref(null);
const toastRef = ref(null);
const newBtnRef = ref(null);

let api = null;

onMounted(() => {
  api = mountFruitGame({
    boardEl: boardRef.value,
    boardWrap: boardWrapRef.value,
    selRect: selRectRef.value,
    scoreEl: scoreRef.value,
    forbiddenEl: forbiddenRef.value,
    fruitNameEl: fruitNameRef.value,
    fruitImgEl: fruitImgRef.value,
    toastEl: toastRef.value,
    newBtn: newBtnRef.value,
  });
});

onBeforeUnmount(() => {
  api?.destroy();
});
</script>

<template>
  <div class="max-w-[560px] mx-auto px-3.5 pt-4 pb-8">
    <h1 class="text-[1.35rem] font-bold m-0 mb-1 tracking-wide">水果凑十</h1>
    <p class="text-[#8b9cb3] text-[0.85rem] leading-snug mb-4">
      在棋盘上按住并拖出一个矩形区域，使框内水果上的数字之和恰好等于
      <strong class="text-[#e8eef5]">10</strong>
      即可消除并得分。每局随机一种水果主题，并有一个<strong class="text-[#e8eef5]">禁忌数字</strong>：若<strong
        class="text-[#e8eef5]"
        >点按</strong
      >（短按，不拖拽）该数字所在的格子，当前总分将清零。
    </p>

    <div class="grid grid-cols-2 gap-2.5 mb-3.5">
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
          禁忌数字（点按清零）
        </div>
        <div ref="forbiddenRef" class="text-[1.6rem] font-bold text-[#ef476f]">
          —
        </div>
      </div>
      <div
        class="col-span-2 bg-[#1a2332] rounded-xl py-3 px-3.5 border border-solid border-white/[0.06]"
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
          <span ref="fruitNameRef" class="font-semibold text-[0.95rem]">—</span>
        </div>
      </div>
    </div>

    <div class="flex gap-2.5 mb-3 flex-wrap items-center">
      <button
        ref="newBtnRef"
        type="button"
        class="border-none py-2.5 px-[18px] rounded-[10px] text-[0.9rem] font-semibold cursor-pointer text-white bg-gradient-to-b from-[#4361ee] to-[#3a56d4] shadow-[0_2px_12px_rgba(67,97,238,0.35)] active:scale-[0.98]"
      >
        新开一局
      </button>
      <span class="text-[0.8rem] text-[#8b9cb3]">拖拽框选 · 短按单格</span>
    </div>

    <div
      ref="boardWrapRef"
      class="relative touch-none rounded-2xl p-2.5 bg-black/25 border border-solid border-white/[0.08]"
    >
      <div ref="selRectRef" class="selection-rect" />
      <div id="board" ref="boardRef" />
    </div>
  </div>

  <div ref="toastRef" class="toast" role="status" aria-live="polite" />
</template>
