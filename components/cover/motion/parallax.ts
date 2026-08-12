/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PARALLAX — ОБЪЁМ И РЕАКЦИЯ НА УКАЗАТЕЛЬ (ТЗ п.5)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Два независимых эффекта в одной rAF-петле:
 *
 *   1. ГЛУБИННЫЙ PARALLAX. Три слоя стены смещаются на разное расстояние:
 *      передний сильнее, задний слабее, текстовая колонка — во встречную
 *      сторону. Мозг читает разную скорость как разную удалённость, и плоская
 *      вёрстка становится сценой.
 *
 *   2. ЖИВАЯ РЕАКЦИЯ РАСТЕНИЙ. Растения рядом с курсором отклоняются ОТ него и
 *      подкачиваются — как если провести рукой по настоящему мху. Сила зависит
 *      от расстояния и от СКОРОСТИ указателя: медленно ведёшь — стена мягко
 *      расступается, резко дёрнул — по ней проходит волна.
 *
 * ── ПОЧЕМУ ОДНА ПЕТЛЯ, А НЕ ДВА СЛУШАТЕЛЯ ──
 *
 * pointermove в браузере может стрелять чаще кадра (мыши 500–1000 Гц —
 * обычное дело). Обрабатывать каждое событие — значит считать и писать в DOM
 * по нескольку раз за кадр, и вся лишняя работа выбрасывается композитором.
 * Поэтому слушатель ТОЛЬКО записывает координаты в переменную, а вся математика
 * и все записи происходят один раз за кадр в rAF. Это же гарантирует, что
 * два эффекта пишут в DOM в одной фазе и не устраивают layout trashing.
 *
 * ── ИНЕРЦИЯ ──
 *
 * Позиция не прыгает в цель, а догоняет её линейной интерполяцией
 * (cur += (target − cur) × lerp). Это апериодическое звено первого порядка:
 * экспоненциальный доезд без перелёта. Пружина с колебанием тут выглядела бы
 * дёшево — стена должна быть тяжёлой, а не резиновой.
 *
 * ── ОСТАНОВКА ПЕТЛИ ──
 *
 * Когда всё доехало (дельты ниже epsilon) и цель нулевая, rAF СНИМАЕТСЯ.
 * Без этого вкладка держит 60 кадров в секунду на неподвижной картинке — это
 * реальный расход батареи ради нулевого результата. Петля поднимается заново
 * первым же движением указателя.
 */

import { PARALLAX } from "./config";
import { LIVE_LAYERS } from "./leaves";
import type { LayerSpec, Plant } from "./types";

export interface ParallaxHandle {
  destroy: () => void;
  /** Пересчитать геометрию: вызывается на resize и при смене контента. */
  refresh: () => void;
}

/* ───────────────────────────────────────────────────────────────────────────
 *  РЕАКЦИЯ РАСТЕНИЙ НА УКАЗАТЕЛЬ
 * ─────────────────────────────────────────────────────────────────────────── */

/** Радиус влияния курсора, px. Примерно две ширины крупного куста. */
const BRUSH_RADIUS = 230;
/** Максимальное отклонение растения от курсора, px. */
const BRUSH_PUSH = 17;
/** Максимальный доворот растения, °. Куст «ложится» в сторону от руки. */
const BRUSH_TILT = 13;
/** Инерция реакции: чуть резвее слоёв — листья легче стены. */
const BRUSH_LERP = 0.13;
/**
 * Вклад скорости указателя. При резком движении отклонение растёт примерно
 * вдвое: медленный проход — стена расступается, быстрый — по ней бежит волна.
 */
const BRUSH_SPEED_GAIN = 0.55;
/** Скорость (px/кадр), на которой вклад скорости выходит на максимум. */
const BRUSH_SPEED_CAP = 42;

/** Одно растение в рантайме: узел, кэш позиции и текущее состояние реакции. */
interface BrushTarget {
  node: HTMLElement;
  /** Позиция центра растения в % от габаритов стены — из раскладки, не из DOM. */
  px: number;
  py: number;
  /** Экранные координаты центра, пересчитываются из кэша прямоугольника стены. */
  sx: number;
  sy: number;
  /** Текущее (сглаженное) состояние. */
  x: number;
  y: number;
  rot: number;
  /** Цель этого кадра. */
  tx: number;
  ty: number;
  trot: number;
  /** Быстрая запись в transform без разбора строки на каждом кадре. */
  set: (value: string) => void;
}

export function createParallax(
  scope: HTMLElement,
  layers: LayerSpec[],
  plants: Plant[],
): ParallaxHandle {
  /* ── Слои глубины ────────────────────────────────────────────────────── */
  const layerNodes: { node: HTMLElement; depth: number; x: number; y: number }[] = [];
  for (const layer of layers) {
    const node = scope.querySelector<HTMLElement>(`[data-layer="${layer.id}"]`);
    if (node) layerNodes.push({ node, depth: layer.depth, x: 0, y: 0 });
  }

  // Текстовая колонка идёт во встречную сторону: она «дальше» стены, и
  // противоход усиливает ощущение объёма сильнее, чем просто меньший сдвиг.
  const textNode = scope.querySelector<HTMLElement>("[data-parallax-text]");

  /* ── Растения ────────────────────────────────────────────────────────── */
  const brush: BrushTarget[] = [];
  const wall = scope.querySelector<HTMLElement>("[data-wall]");

  for (const plant of plants) {
    // Дальний план под курсор не реагирует — по той же причине, по которой он
    // не живёт ambient'ом: он размыт, и движение внутри пересчитывает размытие
    // всего слоя. Расступается то, что зритель различает: средний и передний
    // планы. См. LIVE_LAYERS в leaves.ts.
    if (!LIVE_LAYERS.has(plant.layer)) continue;

    // Свой узел, не общий с ambient и не общий с reveal: три источника движения
    // на одной матрице перебивали бы друг друга. Здесь каждый пишет в свой слой
    // вложенности, а браузер перемножает матрицы сам — бесплатно.
    const node = scope.querySelector<HTMLElement>(`[data-pointer="${plant.id}"]`);
    if (!node) continue;
    brush.push({
      node,
      px: plant.pos.x,
      py: plant.pos.y,
      sx: 0,
      sy: 0,
      x: 0,
      y: 0,
      rot: 0,
      tx: 0,
      ty: 0,
      trot: 0,
      set: (v: string) => {
        node.style.transform = v;
      },
    });
  }

  /* ── Состояние указателя ─────────────────────────────────────────────── */
  // Нормированное положение курсора −1…1 от центра окна (для слоёв).
  let targetNX = 0;
  let targetNY = 0;
  let curNX = 0;
  let curNY = 0;
  // Абсолютные экранные координаты (для реакции растений).
  let pointerX = -9999;
  let pointerY = -9999;
  let prevPointerX = -9999;
  let prevPointerY = -9999;
  /** Сглаженная скорость указателя, px/кадр. */
  let speed = 0;
  let active = false;
  let rafId = 0;
  /** Кэш прямоугольника стены — чтобы не читать layout в каждом кадре. */
  let wallRect = { left: 0, top: 0, width: 0, height: 0 };

  /**
   * Пересчитывает экранные позиции растений.
   *
   * Читает layout ОДИН раз и раскладывает результат по кэшу. Считать
   * getBoundingClientRect на каждое растение в каждом кадре — это 38
   * принудительных пересчётов лэйаута за кадр, самый верный способ уронить
   * частоту вдвое. Проценты из раскладки уже известны, экранная позиция из
   * них выводится арифметикой.
   */
  function measure() {
    if (!wall) return;
    const r = wall.getBoundingClientRect();
    wallRect = { left: r.left, top: r.top, width: r.width, height: r.height };
    for (const b of brush) {
      b.sx = wallRect.left + (b.px / 100) * wallRect.width;
      b.sy = wallRect.top + (b.py / 100) * wallRect.height;
    }
  }

  function onPointerMove(e: PointerEvent) {
    // Обработчик НИЧЕГО не считает и ничего не пишет в DOM — только сохраняет
    // координаты. Вся работа делается один раз за кадр в tick().
    pointerX = e.clientX;
    pointerY = e.clientY;
    targetNX = (e.clientX / window.innerWidth) * 2 - 1;
    targetNY = (e.clientY / window.innerHeight) * 2 - 1;
    ensureRunning();
  }

  function onPointerLeave() {
    // Курсор ушёл — цели по нулям, стена плавно возвращается в покой.
    targetNX = 0;
    targetNY = 0;
    pointerX = -9999;
    pointerY = -9999;
    ensureRunning();
  }

  function ensureRunning() {
    if (active) return;
    active = true;
    rafId = requestAnimationFrame(tick);
  }

  function tick() {
    // ── 1. Скорость указателя ──
    let dx = 0;
    let dy = 0;
    if (prevPointerX > -9000 && pointerX > -9000) {
      dx = pointerX - prevPointerX;
      dy = pointerY - prevPointerY;
    }
    prevPointerX = pointerX;
    prevPointerY = pointerY;
    const instant = Math.min(Math.hypot(dx, dy), BRUSH_SPEED_CAP) / BRUSH_SPEED_CAP;
    // Скорость тоже сглаживаем: сырое значение скачет от кадра к кадру и
    // реакция получилась бы дёрганой. Спад медленнее подъёма — волна по стене
    // должна затухать, а не обрываться.
    speed += (instant - speed) * (instant > speed ? 0.4 : 0.06);

    // ── 2. Глубинный parallax слоёв ──
    curNX += (targetNX - curNX) * PARALLAX.lerp;
    curNY += (targetNY - curNY) * PARALLAX.lerp;

    let moving = Math.abs(targetNX - curNX) > PARALLAX.epsilon || Math.abs(targetNY - curNY) > PARALLAX.epsilon;

    for (const l of layerNodes) {
      // Амплитуда × глубина слоя: передний план (depth 1) ходит на полную,
      // задний (depth 0.2) — на пятую часть. Это и есть объём.
      const x = -curNX * PARALLAX.maxShiftX * l.depth;
      const y = -curNY * PARALLAX.maxShiftY * l.depth;
      // translate3d, а не translate: третья координата заставляет браузер
      // держать слой на GPU и не пересобирать растр при каждом сдвиге.
      l.node.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }

    if (textNode) {
      const x = -curNX * PARALLAX.textShift;
      const y = -curNY * PARALLAX.textShift * 0.6;
      textNode.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }

    // ── 3. Реакция растений на указатель ──
    const hasPointer = pointerX > -9000;
    // Быстрое движение усиливает отклонение примерно вдвое.
    const gain = 1 + speed * BRUSH_SPEED_GAIN * 2;

    for (const b of brush) {
      if (hasPointer) {
        const vx = b.sx - pointerX;
        const vy = b.sy - pointerY;
        const dist = Math.hypot(vx, vy);

        if (dist < BRUSH_RADIUS) {
          // Затухание по расстоянию. Возведение в квадрат делает границу зоны
          // мягкой: линейное затухание давало заметный «обрыв» на краю радиуса,
          // и было видно круг влияния.
          const f = (1 - dist / BRUSH_RADIUS) ** 2;
          // Нормаль от курсора к растению: направление, КУДА оно отклоняется.
          // max(dist, 1) — защита от деления на ноль ровно под курсором.
          const nx = vx / Math.max(dist, 1);
          const ny = vy / Math.max(dist, 1);

          b.tx = nx * f * BRUSH_PUSH * gain;
          // По вертикали слабее: куст скорее расступается вбок, чем подпрыгивает.
          b.ty = ny * f * BRUSH_PUSH * 0.55 * gain;
          // Наклон в сторону отклонения — растение «ложится» от руки.
          b.trot = -nx * f * BRUSH_TILT * gain;
        } else {
          b.tx = 0;
          b.ty = 0;
          b.trot = 0;
        }
      } else {
        b.tx = 0;
        b.ty = 0;
        b.trot = 0;
      }

      const ddx = b.tx - b.x;
      const ddy = b.ty - b.y;
      const ddr = b.trot - b.rot;

      // Растение уже стоит там, где надо, — не трогаем DOM вообще. На стене из
      // 38 кустов курсор задевает от силы пять; писать в остальные 33 узла
      // каждый кадр — это 33 бесполезные записи в стиль.
      if (Math.abs(ddx) < 0.01 && Math.abs(ddy) < 0.01 && Math.abs(ddr) < 0.01) continue;

      b.x += ddx * BRUSH_LERP;
      b.y += ddy * BRUSH_LERP;
      b.rot += ddr * BRUSH_LERP;

      b.set(
        `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${b.rot.toFixed(2)}deg)`,
      );
      moving = true;
    }

    if (moving || speed > 0.01) {
      rafId = requestAnimationFrame(tick);
    } else {
      // Всё доехало и указатель стоит — снимаем петлю. Поднимется на следующем
      // движении мыши.
      active = false;
      rafId = 0;
    }
  }

  /* ── Подписки ────────────────────────────────────────────────────────── */
  // pointermove покрывает и мышь, и трекпад, и перо — одним слушателем вместо
  // связки mousemove + touchmove. Тач сюда не попадает: модуль поднимается
  // только внутри matchMedia('(hover: hover) and (pointer: fine)').
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  window.addEventListener("blur", onPointerLeave);
  // Стена едет вместе со страницей, пока секция не залипла, — экранные
  // координаты растений надо обновлять. Читаем layout здесь, а не в tick().
  window.addEventListener("scroll", measure, { passive: true });
  window.addEventListener("resize", measure, { passive: true });

  measure();

  return {
    refresh: measure,
    destroy() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (rafId) cancelAnimationFrame(rafId);
      active = false;

      // Возвращаем узлы в покой: иначе после отключения parallax (например,
      // при переходе на узкий экран через matchMedia) слои останутся смещёнными
      // на последнее значение и композиция окажется съехавшей.
      for (const l of layerNodes) l.node.style.transform = "";
      for (const b of brush) b.node.style.transform = "";
      if (textNode) textNode.style.transform = "";
    },
  };
}
