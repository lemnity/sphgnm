/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ИНИЦИАЛИЗАЦИЯ — СБОРКА ВСЕЙ СИСТЕМЫ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Единственная точка входа. Компонент вызывает initCoverMotion() и получает
 * ручку с destroy/refresh; больше он о GSAP ничего не знает.
 *
 * Модуль отвечает за четыре вещи, каждая из которых — отдельный класс багов,
 * если её не сделать:
 *
 *  1. ЛЕНИВЫЙ СТАРТ. Регистрация плагина, построение таймлайнов и первый
 *     расчёт позиций — это работа на главном потоке. Выполненная синхронно при
 *     монтировании, она попадает ровно в окно отрисовки первого экрана и
 *     портит LCP/INP. Поэтому старт откладывается до готовности шрифтов и
 *     свободного кадра.
 *
 *  2. ГОТОВНОСТЬ ШРИФТОВ. ScrollTrigger запоминает позиции элементов в момент
 *     создания. Если посчитать их на подменном шрифте, а через 200 мс подъедет
 *     Playfair Display с другими метриками, вся хореография окажется сдвинутой
 *     относительно реальной вёрстки — на длинном заголовке это десятки
 *     пикселей. Ждём document.fonts.ready.
 *
 *  3. ПОЛНАЯ УБОРКА. ScrollTrigger живёт в глобальном реестре и переживает
 *     размонтирование React-компонента. Не снял — и он продолжает считать
 *     позиции удалённых узлов при каждой прокрутке. В SPA это накапливается.
 *
 *  4. ПОВТОРНАЯ ИНИЦИАЛИЗАЦИЯ. Сменился контент — меняются высоты, а значит
 *     и точки срабатывания. refresh() пересчитывает их, не пересобирая
 *     таймлайны.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { createAmbient, type AmbientHandle } from "./ambient";
import { MEDIA } from "./config";
import { createCounters, type CountersHandle } from "./counters";
import { createParallax, type ParallaxHandle } from "./parallax";
import { createScrollChoreography, type ScrollHandle } from "./scroll";
import type { CoverMotionHandle, WallLayout } from "./types";

/**
 * Плагин регистрируется ровно один раз за жизнь страницы.
 *
 * gsap.registerPlugin идемпотентен, но вызывать его на каждом монтировании —
 * лишняя работа и лишний повод для гонки при двух обложках на странице.
 */
let pluginReady = false;
function registerOnce() {
  if (pluginReady) return;
  gsap.registerPlugin(ScrollTrigger);
  pluginReady = true;
}

/**
 * Ждёт момента, когда измерять позиции безопасно.
 *
 * document.fonts.ready — обещание, которое резолвится после загрузки всех
 * подключённых шрифтов. Таймаут на 1.2 с обязателен: при заблокированном
 * Google Fonts (корпоративный прокси, Роскомнадзор, офлайн) обещание может не
 * выполниться никогда, и без таймаута обложка осталась бы навсегда в стартовом
 * состоянии — то есть невидимой. Лучше посчитать по подменному шрифту и
 * поправиться на refresh, чем не показать ничего.
 */
function whenFontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  return Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
  ]);
}

/** Свободный кадр: не занимаем поток, пока браузер рисует первый экран. */
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    // requestIdleCallback есть не везде (Safari до 17). Двойной rAF —
    // совместимый запасной вариант: он гарантирует, что мы попали ПОСЛЕ
    // ближайшей отрисовки, а не внутрь неё.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    if (typeof ric === "function") ric(() => resolve(), { timeout: 600 });
    else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * Дожидается, пока обложка окажется в пределах досягаемости прокрутки.
 *
 * На этом лендинге обложка стоит первой и видна сразу, так что наблюдатель
 * отработает мгновенно. Он здесь не ради текущей раскладки, а ради того, что
 * блок переносимый: поставят его в середину длинной страницы — и вся тяжёлая
 * инициализация не будет выполняться, пока до него не долистают.
 */
function whenNear(el: HTMLElement): Promise<void> {
  if (typeof IntersectionObserver === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            io.disconnect();
            resolve();
            return;
          }
        }
      },
      // Два экрана запаса: к моменту, когда блок реально доедет до кадра,
      // всё уже собрано и первый же кадр хореографии верный.
      { rootMargin: "200% 0px 200% 0px" },
    );
    io.observe(el);
  });
}

export function initCoverMotion(root: HTMLElement, layout: WallLayout): CoverMotionHandle {
  registerOnce();

  let disposed = false;

  let ambient: AmbientHandle | null = null;
  let counters: CountersHandle | null = null;
  let scroll: ScrollHandle | null = null;
  let parallaxMedia: gsap.MatchMedia | null = null;
  let parallax: ParallaxHandle | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let refreshTimer = 0;

  /** Ambient глушится, когда вкладка ушла в фон: считать синусы там незачем. */
  const onVisibility = () => {
    if (!ambient) return;
    if (document.hidden) ambient.pause();
    else ambient.play();
  };

  async function boot() {
    await whenNear(root);
    if (disposed) return;
    await whenFontsReady();
    if (disposed) return;
    await whenIdle();
    // Проверка после КАЖДОГО await: между ними компонент мог размонтироваться,
    // и продолжать сборку означало бы навесить триггеры на узлы вне документа.
    if (disposed) return;

    /* ── Ambient ──────────────────────────────────────────────────────
       Создаётся сразу, но на паузе: жизнь включается только когда стена
       выросла (ScrollTrigger в scroll.ts дёрнет onAmbientStart). Иначе
       нераскрытые растения качаются под маской впустую. */
    ambient = createAmbient(root, layout.plants, layout.glints);
    ambient.pause();

    /* ── Счётчики (ТЗ п.7) ───────────────────────────────────────────── */
    counters = createCounters(root);

    /* ── Хореография прокрутки (ТЗ п.1–3, 6, 9) ──────────────────────── */
    scroll = createScrollChoreography(root, layout.plants, {
      onAmbientStart: () => ambient?.play(),
      onAmbientPause: () => ambient?.pause(),
      onAmbientResume: () => {
        // Не поднимаем ambient, когда вкладка в фоне: возврат в кадр мог
        // произойти программно (restore scroll position) при скрытой вкладке.
        if (!document.hidden) ambient?.play();
      },
    });

    /* ── Parallax (ТЗ п.5) ────────────────────────────────────────────
       Живёт внутри matchMedia, потому что должен существовать ТОЛЬКО при
       наличии настоящего указателя. Через matchMedia он сам поднимется,
       если пользователь подключит мышь к планшету, и сам снимется, если
       переключится на тач — включая снятие слушателей и обнуление
       съехавших трансформов (см. destroy в parallax.ts). */
    parallaxMedia = gsap.matchMedia(root);
    parallaxMedia.add(`${MEDIA.pointerParallax} and ${MEDIA.motion}`, () => {
      parallax = createParallax(root, layout.layers, layout.plants);
      // Возвращённая функция — штатный механизм очистки matchMedia:
      // вызывается, когда медиа-запрос перестал совпадать.
      return () => {
        parallax?.destroy();
        parallax = null;
      };
    });

    /* ── Пересчёт при смене размеров ──────────────────────────────────
       ResizeObserver на корне вместо window.resize: он ловит и то, чего
       resize не видит, — например, изменение высоты обложки из-за
       переноса заголовка на другое число строк после подгрузки шрифта.

       Дребезг гасим таймером: ScrollTrigger.refresh() пересчитывает все
       триггеры разом, и дёргать его на каждый пиксель перетаскивания окна
       значит гарантированно уронить частоту кадров. */
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => {
          if (disposed) return;
          ScrollTrigger.refresh();
          parallax?.refresh();
        }, 180);
      });
      resizeObserver.observe(root);
    }

    document.addEventListener("visibilitychange", onVisibility);
  }

  // Отправляем в очередь и НЕ ждём: init() обязан вернуть ручку синхронно,
  // иначе React-эффект не сможет отдать функцию очистки.
  void boot();

  return {
    /**
     * Пересчёт под новый контент (ТЗ: «поддержка повторной инициализации при
     * смене контента»). Позиции триггеров и экранная геометрия растений
     * считаются заново; сами таймлайны и подписки остаются на месте.
     *
     * Если поменялась САМА раскладка стены (другой seed, другое число
     * растений), этого мало — надо пересоздать ручку целиком. Компонент делает
     * это сам: layout входит в зависимости эффекта.
     */
    refresh() {
      if (disposed) return;
      scroll?.refresh();
      parallax?.refresh();
    },

    destroy() {
      disposed = true;
      window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      resizeObserver?.disconnect();
      resizeObserver = null;
      // Порядок обратный сборке: сначала снимаем то, что дёргает колбэки
      // (scroll), потом то, что они дёргают (ambient). Иначе колбэк уже
      // снятого триггера может успеть обратиться к убитому ambient.
      scroll?.destroy();
      parallaxMedia?.revert();
      parallax?.destroy();
      counters?.destroy();
      ambient?.destroy();
      scroll = null;
      parallaxMedia = null;
      parallax = null;
      counters = null;
      ambient = null;
    },
  };
}
