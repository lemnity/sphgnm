/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SCROLLTRIGGER — ХОРЕОГРАФИЯ ПРОКРУТКИ (ТЗ п.1–3, 6, 9)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Обложка залипает на 1.4–2.4 экрана и за это время проигрывает пять актов,
 * привязанных к позиции прокрутки, а не к часам. Пользователь буквально
 * «прокручивает рост стены»: остановился — остановилось и оно.
 *
 * ── ДВА ТРИГГЕРА, А НЕ ОДИН ──
 *
 * Появление и уход живут в РАЗНЫХ ScrollTrigger'ах, и это принципиально.
 * Если запихнуть уход хвостом в общий таймлайн, он неизбежно наложится на
 * появление текста (тот заканчивается на 89% пина): блок начнёт растворяться
 * раньше, чем его успеют дочитать. Уход должен начинаться там, где ТЗ его и
 * ставит — когда секция реально уезжает из кадра, то есть уже ПОСЛЕ пина.
 *
 * ── ПОЧЕМУ АКТЫ ПЕРЕКРЫВАЮТСЯ ──
 *
 * Позиции в TIMELINE намеренно наезжают друг на друга: кромка роста ещё едет
 * вверх (0.10–0.60), а из-под неё уже лезут кусты (с 0.24), и на середине
 * стены начинает проявляться текст (с 0.40). Разведи акты встык — и вместо
 * одного процесса получится очередь из трёх отдельных анимаций.
 *
 * ── ЧТО АНИМИРУЕТСЯ ──
 *
 * Только transform, opacity и clip-path. Ни одного layout-свойства: ни top,
 * ни height, ни margin. Единственное исключение — filter: blur на входе и
 * выходе, и оно обложено ограничениями (см. `blurWindow` ниже).
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { EASE, EXIT, GROWTH, LEAVES, LIGHT, MEDIA, PIN_LENGTH, REVEAL, TEXT, TIMELINE } from "./config";
import type { Plant } from "./types";

export interface ScrollHandle {
  destroy: () => void;
  refresh: () => void;
}

export interface ScrollOptions {
  /** Вызывается, когда стена выросла и пора включать бесконечную жизнь. */
  onAmbientStart: () => void;
  /**
   * Вызывается при паузе/возобновлении ambient. Ambient глушится в двух
   * случаях: пока стена размыта (blur по движущемуся содержимому заставляет
   * браузер пересобирать растр каждый кадр) и когда обложка ушла из вьюпорта.
   */
  onAmbientPause: () => void;
  onAmbientResume: () => void;
}

/** Длина пина в высотах экрана — по фактической ширине окна. */
function pinLength(): number {
  const w = window.innerWidth;
  if (w < 640) return PIN_LENGTH.phone;
  if (w < 1024) return PIN_LENGTH.tablet;
  return PIN_LENGTH.desktop;
}

/**
 * Финальное состояние без единой анимации.
 *
 * Ветка prefers-reduced-motion. Здесь недостаточно «не запускать таймлайны»:
 * стартовые значения (opacity 0.04, blur 8px, clip-path 100%) прописаны в CSS,
 * и если их не снять, пользователь с уменьшенным движением увидит пустой
 * размытый прямоугольник вместо обложки. Просьба убрать анимацию — это просьба
 * показать РЕЗУЛЬТАТ сразу, а не спрятать содержимое.
 */
export function applyStaticState(scope: HTMLElement) {
  const set = (sel: string, vars: gsap.TweenVars) => {
    const nodes = scope.querySelectorAll(sel);
    if (nodes.length) gsap.set(nodes, vars);
  };

  set("[data-wall-blur]", { filter: "blur(0px)", opacity: 1 });
  set("[data-wall-scale]", { scale: 1, opacity: 1 });
  set("[data-substrate]", { clipPath: `inset(${GROWTH.insetTo}% 0% 0% 0%)` });
  set("[data-growth-front]", { opacity: 0, scaleY: 1 });
  set("[data-reveal]", { y: 0, scale: 1, rotation: 0, opacity: 1 });
  set("[data-text-step]", { y: 0, opacity: 1, filter: "blur(0px)" });
}

export function createScrollChoreography(
  scope: HTMLElement,
  plants: Plant[],
  opts: ScrollOptions,
): ScrollHandle {
  const triggers: ScrollTrigger[] = [];
  const timelines: gsap.core.Timeline[] = [];

  // matchMedia — штатный способ GSAP разводить поведение по медиа-запросам.
  // Его преимущество перед ручным window.matchMedia в том, что он сам убивает
  // всё созданное внутри ветки, когда запрос перестаёт совпадать: пользователь
  // включил «уменьшить движение» в системе прямо сейчас — анимация снялась,
  // reduced-ветка выставила финальное состояние, ничего не осталось висеть.
  const mm = gsap.matchMedia(scope);

  /* ═══════════════════════════════════════════════════════════════════════
   *  ВЕТКА БЕЗ ДВИЖЕНИЯ
   * ═══════════════════════════════════════════════════════════════════════ */
  mm.add(MEDIA.reduced, () => {
    applyStaticState(scope);
    // Ambient тоже не запускаем: покачивание листьев — это ровно то самое
    // «постоянное фоновое движение», от которого человек и защищается
    // настройкой ОС.
  });

  /* ═══════════════════════════════════════════════════════════════════════
   *  ОСНОВНАЯ ВЕТКА
   * ═══════════════════════════════════════════════════════════════════════ */
  mm.add(MEDIA.motion, () => {
    const section = scope.querySelector<HTMLElement>("[data-cover-section]");
    const pinTarget = scope.querySelector<HTMLElement>("[data-cover-pin]");
    if (!section || !pinTarget) return;

    /* ── ГЛАВНЫЙ ТАЙМЛАЙН (акты 1–8) ────────────────────────────────── */
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${window.innerHeight * pinLength()}`,
        pin: pinTarget,
        // Позиция головы таймлайна привязана к прокрутке напрямую, но с
        // сглаживанием 0.6 с. Голый scrub: true дёргается на колёсике мыши
        // (оно шлёт дискретные скачки по 100+ px), а число сглаживает их в
        // непрерывное движение, не разрывая связь «крутишь — растёт».
        scrub: 0.6,
        // Гасит характерный прыжок в момент захвата пина при быстрой прокрутке:
        // ScrollTrigger начинает пиновать чуть раньше расчётной точки.
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onLeave: opts.onAmbientPause,
        onEnterBack: opts.onAmbientResume,
      },
    });

    timelines.push(tl);

    /* ── АКТ 1. ПРОЯВЛЕНИЕ (ТЗ п.1) ─────────────────────────────────── */
    // Blur и масштаб разведены по РАЗНЫМ узлам намеренно. На одном элементе
    // браузер вынужден пересобирать размытый растр на каждом кадре, потому что
    // одновременно меняются и радиус размытия, и матрица. Разнесённые по
    // вложенным узлам, они считаются в две независимые GPU-операции.
    tl.fromTo(
      "[data-wall-blur]",
      { filter: `blur(${REVEAL.blurFrom}px)`, opacity: REVEAL.opacityFrom },
      { filter: "blur(0px)", opacity: 1, duration: REVEAL.duration, ease: EASE.reveal },
      TIMELINE.reveal,
    );

    tl.fromTo(
      "[data-wall-scale]",
      { scale: REVEAL.scaleFrom },
      { scale: 1, duration: REVEAL.duration * 1.4, ease: EASE.reveal },
      TIMELINE.reveal,
    );

    /* ── АКТ 2. РОСТ СНИЗУ ВВЕРХ (ТЗ п.2) ───────────────────────────── */
    // clip-path: inset(<сверху> 0 0 0). При 100% не видно ничего, при 0% —
    // всё, то есть видимая область раскрывается ОТ НИЖНЕГО КРАЯ вверх. Это и
    // есть рост. Обратный порядок (inset снизу) дал бы опускающуюся штору.
    tl.fromTo(
      "[data-substrate]",
      { clipPath: `inset(${GROWTH.insetFrom}% 0% 0% 0%)` },
      {
        clipPath: `inset(${GROWTH.insetTo}% 0% 0% 0%)`,
        duration: GROWTH.duration,
        ease: EASE.grow,
      },
      TIMELINE.growth,
    );

    // Светящийся фронт роста едет вверх вместе с кромкой. Он тут не для красоты:
    // без него срез маски читается как обрезка картинки, а не как растущая
    // кромка. Двигаем ТОЛЬКО transform — сама полоса статична.
    tl.fromTo(
      "[data-growth-front]",
      { yPercent: 0, opacity: 0 },
      {
        yPercent: -(100 / GROWTH.frontHeight) * 100,
        opacity: GROWTH.frontOpacity,
        duration: GROWTH.duration,
        ease: EASE.grow,
      },
      TIMELINE.growth,
    );
    // Гасим фронт на подходе к верху: дошедшая до потолка полоса света
    // выглядит забытой на экране.
    tl.to(
      "[data-growth-front]",
      { opacity: 0, duration: GROWTH.duration * 0.3, ease: "power2.in" },
      TIMELINE.growth + GROWTH.duration * 0.72,
    );

    /* ── АКТ 3. ГРУППЫ ЛИСТЬЕВ СО STAGGER'ОМ (ТЗ п.3) ───────────────── */
    // Порядок задаёт НЕ индекс в массиве, а высота растения на стене
    // (plant.growthOrder): нижние кусты появляются первыми, и стена
    // прорастает снизу вверх — так же, как едет маска.
    //
    // Не используем gsap stagger: он раздаёт задержки по порядку в выборке,
    // а нам нужен порядок по геометрии. Поэтому каждое растение ставится в
    // таймлайн на свою вычисленную позицию.
    for (const plant of plants) {
      const node = scope.querySelector(`[data-reveal="${plant.id}"]`);
      if (!node) continue;

      const at = TIMELINE.leaves + plant.growthOrder * LEAVES.stagger;

      tl.fromTo(
        node,
        {
          // Сдвиг по Y у каждого свой (20–40 px из конфига) — иначе группы
          // въезжают строем, и это сразу читается как CSS-анимация по классу.
          y: plant.yFrom,
          scale: LEAVES.scaleFrom,
          // Знак доворота зависит от того, в какой половине стены стоит куст:
          // растения «разворачиваются» наружу от центра, а не крутятся хором.
          rotation: plant.pos.x < 50 ? -LEAVES.rotateFrom : LEAVES.rotateFrom,
          opacity: 0,
        },
        {
          y: 0,
          scale: 1,
          rotation: 0,
          opacity: 1,
          duration: LEAVES.each,
          ease: EASE.reveal,
        },
        at,
      );
    }

    /* ── АКТ 6. ТЕКСТОВАЯ КОЛОНКА (ТЗ п.6) ──────────────────────────── */
    // Заголовок → описание → преимущества → кнопка → счётчики.
    // Порядок берётся из data-text-step, а не из порядка в DOM: так его можно
    // менять, не трогая разметку, и он переживает перестановку блоков.
    const steps = Array.from(scope.querySelectorAll<HTMLElement>("[data-text-step]")).sort(
      (a, b) => Number(a.dataset.textStep) - Number(b.dataset.textStep),
    );

    steps.forEach((step, i) => {
      tl.fromTo(
        step,
        { y: TEXT.yFrom, opacity: 0, filter: `blur(${TEXT.blurFrom}px)` },
        {
          y: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: TEXT.each,
          ease: EASE.reveal,
        },
        TIMELINE.text + i * TEXT.stagger,
      );
    });

    /* ── АКТ 8. ОБЩАЯ ОСВЕЩЁННОСТЬ (ТЗ п.8) ─────────────────────────── */
    // Стена «выходит на свет» по мере роста. Отдельный слой-подсветка, а не
    // filter: brightness на самой стене: brightness — это полноценный
    // фильтр, он заставил бы перерисовывать всё поддерево на каждом кадре.
    tl.fromTo(
      "[data-light-wash]",
      { opacity: LIGHT.scrollBrightness[0] - 0.6 },
      { opacity: LIGHT.scrollBrightness[1] - 0.6, duration: 0.8, ease: "none" },
      TIMELINE.growth,
    );

    /* ── ВКЛЮЧЕНИЕ AMBIENT ──────────────────────────────────────────── */
    // Отдельный триггер, а не колбэк в таймлайне: у scrub-таймлайна колбэк
    // сработает и при прокрутке НАЗАД через ту же точку, причём в обратном
    // направлении. Здесь нужен простой порог «стена доросла».
    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: () => `top+=${window.innerHeight * pinLength() * TIMELINE.ambientAt} top`,
        once: true,
        onEnter: opts.onAmbientStart,
      }),
    );

    /* ═════════════════════════════════════════════════════════════════
     *  АКТ 9. УХОД БЛОКА ИЗ КАДРА (ТЗ п.9)
     *
     *  Свой триггер и своё окно: начинается там, где пин уже отпустил
     *  секцию и она поехала вверх. Листья поднимаются, прозрачность падает,
     *  размытие нарастает — блок «уходит вглубь», а не выключается.
     * ═════════════════════════════════════════════════════════════════ */
    const exitTl = gsap.timeline({
      defaults: { ease: EASE.exit },
      scrollTrigger: {
        trigger: section,
        // Низ секции идёт от нижней кромки экрана к верхней — ровно то окно,
        // в котором блок покидает поле зрения.
        start: "bottom bottom",
        end: "bottom top",
        scrub: 0.4,
        onLeave: opts.onAmbientPause,
        onEnterBack: opts.onAmbientResume,
      },
    });

    timelines.push(exitTl);

    exitTl
      .to("[data-wall-scale]", { y: EXIT.y, scale: EXIT.scale, duration: EXIT.duration }, 0)
      .to(
        "[data-wall-blur]",
        { filter: `blur(${EXIT.blur}px)`, opacity: EXIT.opacity, duration: EXIT.duration },
        0,
      )
      // Текст уходит чуть раньше и быстрее стены: разнесённые по времени слои
      // читаются как глубина, синхронные — как один уезжающий слайд.
      .to("[data-parallax-text]", { y: EXIT.y * 0.55, opacity: 0.08, duration: EXIT.duration * 0.8 }, 0);
  });

  return {
    refresh: () => ScrollTrigger.refresh(),
    destroy() {
      // revert() у matchMedia снимает ВСЁ, что было создано внутри веток:
      // таймлайны, их ScrollTrigger'ы и — важно — откатывает инлайновые стили,
      // которые GSAP проставил элементам. Без этого узлы остались бы с
      // застывшим transform от последнего кадра.
      mm.revert();
      for (const t of triggers) t.kill();
      for (const t of timelines) t.kill();
      triggers.length = 0;
      timelines.length = 0;
    },
  };
}
