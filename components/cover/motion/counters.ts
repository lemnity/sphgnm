/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  СЧЁТЧИКИ — ОТСЧЁТ ОТ НУЛЯ ДО ЗНАЧЕНИЯ (ТЗ п.7)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Три показателя обложки («500+ проектов», «12 лет опыта», «1500 м² фитостен»)
 * добегают до своих чисел ровно ОДИН РАЗ — при первом попадании в кадр.
 *
 * ── ПОЧЕМУ НЕ SCRUB ──
 *
 * Соблазн привязать счётчик к прокрутке, как всю остальную хореографию. Так
 * делать нельзя: scrub двусторонний, и при скролле вверх цифры побегут НАЗАД.
 * «12 лет опыта» превращается в 7, потом в 3 — это выглядит как сброс данных,
 * а не как анимация. Поэтому счётчик живёт в РЕАЛЬНОМ времени и срабатывает
 * один раз (ScrollTrigger `once: true`).
 *
 * ── ПОЧЕМУ ЧИСЛО ЖИВЁТ В РАЗМЕТКЕ ──
 *
 * Конечное значение стоит в атрибуте `data-count-to`, а внутри узла уже
 * отрендерено ГОТОВОЕ число. Пользователь без JS (и поисковый робот) видит
 * «1,500», а не пустое место или ноль. Скрипт лишь переписывает содержимое во
 * время отсчёта — прогрессивное улучшение, а не зависимость.
 *
 * ── ДРОЖАНИЕ ШИРИНЫ ──
 *
 * У пропорционального шрифта цифры разной ширины, и бегущее число дёргает
 * вёрстку соседей десятки раз в секунду. Лечится не здесь, а в CSS:
 * `font-variant-numeric: tabular-nums` на .cover-stat__value. Без него
 * анимация выглядит дёшево независимо от качества самого отсчёта.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { COUNTERS, EASE } from "./config";

export interface CountersHandle {
  destroy: () => void;
}

/** Разбор одного счётчика из data-атрибутов. */
interface CounterSpec {
  node: HTMLElement;
  to: number;
  decimals: number;
  prefix: string;
  suffix: string;
  format: Intl.NumberFormat;
}

function parse(node: HTMLElement): CounterSpec | null {
  const to = Number(node.dataset.countTo);
  // NaN отсеиваем молча: лишний data-атрибут на соседнем узле не должен
  // ронять всю обложку.
  if (!Number.isFinite(to)) return null;

  const decimals = Number(node.dataset.countDecimals ?? 0) || 0;

  return {
    node,
    to,
    decimals,
    prefix: node.dataset.countPrefix ?? "",
    suffix: node.dataset.countSuffix ?? "",
    // Разделитель разрядов — часть «дорогого» вида: 1500 читается ощутимо
    // хуже, чем 1,500. Локаль en-US зашита осознанно: лендинг одноязычный
    // (см. lang="en" в layout), и брать локаль браузера значило бы показывать
    // русскому пользователю «1 500», а рядом — английский текст.
    format: new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  };
}

function render(spec: CounterSpec, value: number) {
  spec.node.textContent = spec.prefix + spec.format.format(value) + spec.suffix;
}

export function createCounters(scope: HTMLElement): CountersHandle {
  const nodes = Array.from(scope.querySelectorAll<HTMLElement>("[data-count-to]"));
  const specs = nodes.map(parse).filter((s): s is CounterSpec => s !== null);
  if (specs.length === 0) return { destroy: () => {} };

  const triggers: ScrollTrigger[] = [];
  const tweens: gsap.core.Tween[] = [];

  // Один общий триггер на всю группу, а не по триггеру на цифру: показатели
  // стоят в одной строке и попадают в кадр одновременно, а stagger между ними
  // задаётся задержкой твина. Три отдельных ScrollTrigger'а считали бы
  // практически одинаковые позиции и лишь утяжеляли пересчёт на resize.
  const groupRoot = specs[0]!.node.closest("[data-counters]") ?? specs[0]!.node;

  const trigger = ScrollTrigger.create({
    trigger: groupRoot as Element,
    // triggerAt = 0.85 → верхние 85% вьюпорта. Цифра стартует чуть раньше,
    // чем блок встанет по центру, и к моменту прочтения уже показывает итог.
    start: `top ${COUNTERS.triggerAt * 100}%`,
    // Один раз и навсегда: ScrollTrigger сам снимет себя после срабатывания.
    once: true,
    onEnter: () => {
      specs.forEach((spec, i) => {
        // Анимируем ПРОКСИ-объект, а не сам узел. GSAP не умеет твинить
        // textContent, да и не должен: значение — это число, а его печать —
        // отдельная забота onUpdate. Заодно форматирование остаётся в одном месте.
        const proxy = { v: 0 };
        tweens.push(
          gsap.to(proxy, {
            v: spec.to,
            duration: COUNTERS.duration,
            delay: i * COUNTERS.stagger,
            // expo.out: почти весь путь пробегается в первой трети времени,
            // дальше — долгий доводчик. Читается как «быстро набрал и точно
            // остановился», а не как равномерный барабан одометра.
            ease: EASE.reveal,
            onUpdate: () => render(spec, proxy.v),
            // Финальное значение проставляем явно: при некратной длительности
            // последний кадр может не попасть ровно в цель, и счётчик замрёт
            // на 1,499 — дефект, который замечают все.
            onComplete: () => render(spec, spec.to),
          }),
        );
      });
    },
  });

  triggers.push(trigger);

  return {
    destroy() {
      for (const t of tweens) t.kill();
      for (const t of triggers) t.kill();
      tweens.length = 0;
      triggers.length = 0;
    },
  };
}
