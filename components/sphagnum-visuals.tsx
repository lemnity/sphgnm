"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Визуальные элементы SPHAGNUM ECO: живая текстура мха, счётчики цифр и
 * «водяная батарея» — анимированная иллюстрация ключевого заявления продукта
 * (водопоглощение 20–25× собственного веса).
 *
 * Всё детерминировано: генераторы форм работают от seed, а не Math.random —
 * иначе SSR и клиент нарисуют разное и React ругнётся на несовпадение.
 */

/** Детерминированный PRNG (mulberry32): один seed → всегда одна картинка. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Уважает системную настройку «меньше движения». */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Срабатывает один раз, когда элемент попал в кадр. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
}

/* ═══════════════ Росток ═══════════════ */

/**
 * Побег с четырьмя ланцетными листьями — декоративный элемент первого экрана,
 * который «прорастает» из мохового уступа по мере прокрутки.
 *
 * Почему нарисован заново, а не вырезан из фирменного знака: в знаке растение и
 * литера S — ОДИН непрерывный контур (проверено: у пути ровно один субпуть,
 * стебель внизу переходит в нижнюю дугу буквы). Отделить побег обрезкой viewBox
 * тоже нельзя — через центр знака проходит диагональ S. Поэтому здесь отдельная
 * форма, повторяющая мотив: узкие листья с острым кончиком и тонкий изогнутый
 * стебель. Сам логотип при этом остаётся нетронутым.
 *
 * Пути статичны — считать их на рендере незачем, а SSR и клиент обязаны выдать
 * побайтово одинаковую разметку.
 */
const SPROUT_LEAVES = [
  "M70 110C62.8 73.9 39.7 41.3 20 24C28.8 53.4 46.3 89.2 70 110Z",
  "M70 86C81 56.4 105 32 124 20C112.6 43.7 92.9 71.6 70 86Z",
  "M69 164C81.8 133 108.7 108.9 130 98C116.8 122.6 94.5 150.9 69 164Z",
  "M68 198C57 167.6 32 143.4 12 132C23.7 156.2 44 184.3 68 198Z",
];

export function SphagnumSprout({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 -14 142 288" className={className} fill="currentColor" aria-hidden focusable="false">
      <path
        d="M70 258C66 216 66 172 68 132C69.5 100 70 64 70 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {SPROUT_LEAVES.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/* ═══════════════ Живность над моховым уступом ═══════════════ */

/**
 * Общая точка, вокруг которой собирается рой, — центр вычерчиваемого ростка.
 * Считается из его посадки в разметке: bottom 36%, ширина 28% от обёртки при
 * пропорции картинки 1.5 дают высоту 70.8% и центр на 71.4% снизу.
 * Меняете посадку ростка — правьте и это, иначе рой закружится мимо него.
 */
const SWARM_ORIGIN = { left: "44%", top: "29%" };

/** Насколько гасится разлёт при полностью выросшем ростке (0.15 = остаётся 15%). */
const DRIFT_AT_FULL = 0.15;

/** Плавно стягивает разлёт к центру по мере прорастания. */
function driftScale(orbit: number) {
  return 1 - (1 - DRIFT_AT_FULL) * Math.min(Math.max(orbit, 0), 1);
}

/**
 * Светлячки над мхом.
 *
 * Таблица, а не PRNG: анимация бесконечная, случайные значения при гидрации
 * разошлись бы с серверными. Периоды разной длины и отрицательные задержки
 * разводят фазы — синхронный рой читается как гирлянда, а не как насекомые.
 *
 * Амплитуды в vw, а НЕ в процентах: процент в translate берётся от размера
 * самого элемента, а светлячок 4–6 px — он смещался бы на пять пикселей.
 */
const FIREFLIES = [
  { id: "f1", size: 5, driftDur: 11, driftDelay: -1.2, dx: "7vw", dy: "9vw", orbDur: 14, orbDelay: -2, orb: 6.5, glow: 3.1 },
  { id: "f2", size: 4, driftDur: 14, driftDelay: -5.5, dx: "-9vw", dy: "6vw", orbDur: 18, orbDelay: -7, orb: 9, glow: 4.4 },
  { id: "f3", size: 6, driftDur: 9.5, driftDelay: -3.1, dx: "5vw", dy: "-7vw", orbDur: 11, orbDelay: -4, orb: 4.5, glow: 2.6 },
  { id: "f4", size: 4, driftDur: 16, driftDelay: -8.4, dx: "-6vw", dy: "-9vw", orbDur: 21, orbDelay: -11, orb: 11, glow: 5.2 },
  { id: "f5", size: 5, driftDur: 12.5, driftDelay: -6.2, dx: "8vw", dy: "4vw", orbDur: 16, orbDelay: -6, orb: 7.8, glow: 3.7 },
];

export function Fireflies({
  className = "",
  /** 0…1 — прогресс прорастания. 0: рассеянный разлёт, 1: орбиты вокруг ростка. */
  orbit = 0,
}: {
  className?: string;
  orbit?: number;
}) {
  const k = driftScale(orbit);
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden>
      {FIREFLIES.map((f) => (
        <span
          key={f.id}
          className="drift"
          style={
            {
              left: SWARM_ORIGIN.left,
              top: SWARM_ORIGIN.top,
              animationDuration: `${f.driftDur}s`,
              animationDelay: `${f.driftDelay}s`,
              "--dx": `calc(${f.dx} * ${k.toFixed(3)})`,
              "--dy": `calc(${f.dy} * ${k.toFixed(3)})`,
            } as CSSProperties
          }
        >
          <span
            className="orbit"
            style={
              {
                animationDuration: `${f.orbDur}s`,
                animationDelay: `${f.orbDelay}s`,
                "--orb": `${(f.orb * orbit).toFixed(2)}vw`,
              } as CSSProperties
            }
          >
            <span
              className="firefly"
              style={{
                width: f.size,
                height: f.size,
                animationDuration: `${f.glow}s`,
                animationDelay: `${f.driftDelay}s`,
              }}
            />
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Бабочка: сидящая на мху или летящая. Крылья — два зеркальных пути; взмах
 * делается сжатием поперёк (scaleX) с осью по линии тела, см. keyframes sphWing.
 * Это дешевле 3D-поворота, не требует perspective на родителе и на таком
 * размере читается одинаково.
 */
export function MossButterfly({
  className = "",
  /** Период взмаха. Сидящая машет лениво, летящая — вдвое чаще. */
  flapMs = 1600,
}: {
  className?: string;
  flapMs?: number;
}) {
  const wing = { animationDuration: `${flapMs}ms` };
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden focusable="false">
      <g className="butterfly">
        {/* Усики — до крыльев, чтобы крыло при взмахе не резало линию пополам */}
        <path
          d="M31 19C29 14 25 11 21 10M33 19C35 14 39 11 43 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity=".75"
        />
        <path
          className="wing wing-l"
          style={wing}
          d="M32 24C24 8 12 2 7 10C3 17 16 23 32 24ZM32 26C25 33 18 42 13 36C9 31 20 27 32 26Z"
          fill="currentColor"
        />
        <path
          className="wing wing-r"
          style={wing}
          d="M32 24C40 8 52 2 57 10C61 17 48 23 32 24ZM32 26C39 33 46 42 51 36C55 31 44 27 32 26Z"
          fill="currentColor"
        />
        <ellipse cx="32" cy="26" rx="1.7" ry="8" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * Мотыльки. Как и светлячки, стартуют из общей точки и переходят от разлёта
 * к орбите вокруг ростка. Периоды взаимно непериодичны (13 / 17 / 21 с) —
 * с кратными значениями рой каждые несколько секунд собирается в строй.
 */
const MOTHS = [
  { id: "m1", w: "4.6%", driftDur: 13, driftDelay: -2.5, dx: "8vw", dy: "5vw", orbDur: 15, orbDelay: -3, orb: 8, flap: 320, opacity: 0.7 },
  { id: "m2", w: "3.8%", driftDur: 17, driftDelay: -8, dx: "-7vw", dy: "-6vw", orbDur: 20, orbDelay: -9, orb: 11.5, flap: 380, opacity: 0.55 },
  { id: "m3", w: "5.2%", driftDur: 21, driftDelay: -14, dx: "6vw", dy: "-8vw", orbDur: 12, orbDelay: -5, orb: 5.5, flap: 290, opacity: 0.8 },
];

export function MossMoths({
  className = "",
  orbit = 0,
}: {
  className?: string;
  orbit?: number;
}) {
  const k = driftScale(orbit);
  return (
    <div className={`pointer-events-none absolute ${className}`} aria-hidden>
      {MOTHS.map((m) => (
        <span
          key={m.id}
          className="drift"
          style={
            {
              left: SWARM_ORIGIN.left,
              top: SWARM_ORIGIN.top,
              width: m.w,
              opacity: m.opacity,
              animationDuration: `${m.driftDur}s`,
              animationDelay: `${m.driftDelay}s`,
              "--dx": `calc(${m.dx} * ${k.toFixed(3)})`,
              "--dy": `calc(${m.dy} * ${k.toFixed(3)})`,
            } as CSSProperties
          }
        >
          <span
            className="orbit"
            style={
              {
                animationDuration: `${m.orbDur}s`,
                animationDelay: `${m.orbDelay}s`,
                "--orb": `${(m.orb * orbit).toFixed(2)}vw`,
              } as CSSProperties
            }
          >
            <MossButterfly className="w-full text-[color:var(--brand-lime)]" flapMs={m.flap} />
          </span>
        </span>
      ))}
    </div>
  );
}

/* ═══════════════ Лучи света ═══════════════ */

/**
 * Столбы света из правого верхнего угла на моховой уступ.
 *
 * Таблица, а не генератор: анимация бесконечная, случайные значения при
 * гидрации разошлись бы с серверными. Углы 9–41° разведены неравномерно —
 * равный шаг читается как веер жалюзи, а не как свет сквозь листву.
 *
 * Периоды 19–34 с и взаимно НЕ кратные: на кратных лучи периодически сходятся
 * в фазе и весь веер вспыхивает разом. Отрицательные задержки разносят старт,
 * иначе первые секунды после загрузки все шесть идут синхронно.
 * sw — размах разворота: чем уже луч, тем он подвижнее.
 */
const RAYS = [
  { rot: "9deg", w: "3.4vw", op: 0.3, dur: "29s", sw: "1.1deg", delay: "0s" },
  { rot: "15deg", w: "1.5vw", op: 0.2, dur: "19s", sw: "1.6deg", delay: "-7s" },
  { rot: "22deg", w: "4.6vw", op: 0.26, dur: "34s", sw: "0.8deg", delay: "-13s" },
  { rot: "27deg", w: "2.1vw", op: 0.15, dur: "23s", sw: "1.9deg", delay: "-3s" },
  { rot: "34deg", w: "3.1vw", op: 0.22, dur: "31s", sw: "1.2deg", delay: "-17s" },
  { rot: "41deg", w: "1.3vw", op: 0.13, dur: "21s", sw: "2.2deg", delay: "-11s" },
];

export function LightRays({ className = "" }: { className?: string }) {
  return (
    <div className={`light-rays pointer-events-none absolute ${className}`} aria-hidden>
      <span className="light-source" />
      {RAYS.map((r, i) => (
        <span
          key={i}
          className="ray"
          style={
            {
              width: r.w,
              animationDuration: r.dur,
              animationDelay: r.delay,
              "--rot": r.rot,
              "--ro": r.op.toFixed(2),
              "--sw": r.sw,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ═══════════════ Живая текстура мха ═══════════════ */

/**
 * Органическая текстура из сотен «кочек» — заменяет плоский градиент в слотах
 * под фото и работает фоном тёмных секций. Рисуется один раз, чистый SVG.
 */
export function MossTexture({
  seed = 7,
  density = 190,
  className = "",
  dark,
}: {
  seed?: number;
  density?: number;
  className?: string;
  dark?: boolean;
}) {
  // viewBox 400×400 при мелких радиусах: в viewBox 100×100 те же радиусы после
  // растягивания на всю секцию читались гигантскими пузырями, а не мхом.
  const r = rng(seed);
  const blobs = Array.from({ length: density }, () => ({
    cx: r() * 400,
    cy: r() * 400,
    rad: 1 + r() * 3.4,
    tone: r(),
  }));

  // Тона — ступени между Ink, Moss и Sage, а не отдельные цвета: гайд запрещает
  // выходить за палитру, а текстуре нужна именно градация, не разнообразие.
  const palette = dark
    ? ["#1B231E", "#28352B", "#3E5042", "#8AA18A"]
    : ["#A9B6A8", "#8AA18A", "#C2CBBF", "#3E5042"];

  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id={`moss-bg-${seed}`} cx="35%" cy="30%">
          <stop offset="0%" stopColor={dark ? "#28352B" : "#E4E3D9"} />
          <stop offset="100%" stopColor={dark ? "#141816" : "#A9B6A8"} />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#moss-bg-${seed})`} />
      {blobs.map((b, i) => (
        <circle
          key={i}
          cx={b.cx}
          cy={b.cy}
          r={b.rad}
          fill={palette[Math.floor(b.tone * palette.length)]}
          opacity={0.18 + b.tone * 0.3}
        />
      ))}
    </svg>
  );
}

/* ═══════════════ Счётчик числа ═══════════════ */

/**
 * Досчитывает число при появлении в кадре. Принимает готовую строку вида
 * «20–25×» / «97%» / «53 000 км²»: анимируем ПОСЛЕДНЕЕ число, остальное
 * (диапазон, знак, единицы) отдаём как есть — иначе «2–3 года» превратится в кашу.
 */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const reduced = useReducedMotion();
  const { ref, seen } = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState<string>(value);

  useEffect(() => {
    if (!seen || reduced) {
      setShown(value);
      return;
    }
    // Берём последнее целое в строке — именно его «крутим».
    // Внутри числа допускаем разделитель разрядов — пробел, неразрывный пробел
    // ИЛИ ЗАПЯТУЮ: страница англоязычная, и «53,000 km²» без запятой в классе
    // распадался на «53» + «000», а анимировался только хвост «000».
    // Но разделитель НЕ должен захватываться с конца: иначе «2–3 years» → «2–3years».
    const m = value.match(/(\d[\d\s ,]*\d|\d)(?!.*\d)/);
    if (!m) {
      setShown(value);
      return;
    }
    const raw = m[1];
    const target = parseInt(raw.replace(/[\s ,]/g, ""), 10);
    if (!Number.isFinite(target) || target === 0) {
      setShown(value);
      return;
    }
    const grouped = /[\s ,]/.test(raw);
    const start = performance.now();
    const DUR = 1100;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUR);
      // easeOutExpo — быстро набирает и мягко доводит до финального числа
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const cur = Math.round(target * eased);
      const text = grouped ? cur.toLocaleString("en-US") : String(cur);
      setShown(value.replace(raw, text));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, reduced, value]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {shown}
    </span>
  );
}

/* ═══════════════ «Водяная батарея» ═══════════════ */

/**
 * Ключевое заявление продукта в картинке: кочка мха набирает воду до 20–25×
 * собственного веса. Столбик заполняется при появлении в кадре, рядом бежит
 * множитель. Это не декор — это главная причина покупать.
 */
/**
 * Плавный прогон 0→1 при появлении в кадре. Общий для колбы и кольца.
 */
function useProgress(durationMs: number) {
  const reduced = useReducedMotion();
  const { ref, seen } = useInView<HTMLDivElement>();
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!seen) return;
    if (reduced) {
      setT(1);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / durationMs);
      setT(1 - Math.pow(1 - raw, 3));
      if (raw < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, reduced, durationMs]);

  return { ref, t };
}

/**
 * Два ключевых заявления продукта рядом, оба из ТЗ:
 *   • водопоглощение 20–25× собственного веса — колба наполняется водой;
 *   • снижение полива на 60–80% — кольцо-индикатор.
 *
 * Раньше здесь стоял один визуал слева, и правые ~60% ширины пустовали.
 * Цифры конкурентов (торф, обычный грунт) СОЗНАТЕЛЬНО не выдуманы: в ТЗ их нет,
 * а на коммерческом лендинге придуманное сравнение — фактическое заявление.
 */
/**
 * Пузырьки в колбе. Таблица, а не генератор: анимация бесконечная, и случайные
 * значения при гидрации разошлись бы с серверными. Разные периоды и
 * отрицательные задержки разводят фазы — синхронный подъём читался бы как
 * механизм, а не как вода.
 */
const BUBBLES = [
  { left: "22%", size: "5px", dur: "3.6s", delay: "-0.2s" },
  { left: "58%", size: "4px", dur: "4.4s", delay: "-1.7s" },
  { left: "38%", size: "3px", dur: "3.1s", delay: "-2.6s" },
  { left: "74%", size: "5px", dur: "5.0s", delay: "-3.4s" },
  { left: "12%", size: "3px", dur: "4.1s", delay: "-0.9s" },
  { left: "64%", size: "3px", dur: "3.4s", delay: "-4.2s" },
];

export function WaterBattery() {
  const water = useProgress(1800);
  const dry = useProgress(1500);

  const mult = Math.round(20 + water.t * 5); // 0 → 20 → 25

  // Кольцо: длина окружности для dasharray
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <div className="grid overflow-hidden rounded-2xl border border-white/12 bg-[#101E17]/85 backdrop-blur-sm lg:grid-cols-2">
      {/* ── Водопоглощение ── */}
      <div ref={water.ref} className="flex items-center gap-6 border-b border-white/12 p-6 lg:border-b-0 lg:border-r lg:gap-8 lg:p-8">
        <div className="relative h-[150px] w-[64px] shrink-0 sm:h-[176px] sm:w-[76px] lg:h-[208px] lg:w-[88px]">
          <div className="absolute inset-0 overflow-hidden rounded-[16px] border-2 border-white/25 bg-[#0A150F]">
            {/* Уровень воды */}
            <div
              className="absolute inset-x-0 bottom-0"
              style={{
                height: `${water.t * 100}%`,
                background: "linear-gradient(180deg, rgba(104,186,206,.95) 0%, rgba(42,120,148,.92) 100%)",
              }}
            >
              {/* Волна едет влево ровно на один период (половину удвоенной
                  ширины), поэтому склейка незаметна и петля бесшовная. */}
              <svg
                viewBox="0 0 240 12"
                preserveAspectRatio="none"
                className="wb-wave absolute -top-[7px] left-0 h-[10px] w-[200%]"
                aria-hidden
              >
                <path
                  d="M0 8 Q15 2 30 8 T60 8 T90 8 T120 8 T150 8 T180 8 T210 8 T240 8 V12 H0 Z"
                  fill="rgba(104,186,206,.95)"
                />
              </svg>

              {/* Пузырьки лежат ВНУТРИ водяного слоя, поэтому поднимаются ровно до
                  текущего уровня воды и не висят в пустой части колбы. */}
              {BUBBLES.map((b, i) => (
                <span
                  key={i}
                  className="wb-bubble"
                  style={{ left: b.left, width: b.size, height: b.size, animationDuration: b.dur, animationDelay: b.delay }}
                />
              ))}
            </div>

            {/* Волокна мха: короткие штрихи пучками, а не россыпь точек —
                россыпь читалась пузырьками газировки, а не мхом. */}
            <svg viewBox="0 0 60 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
              {Array.from({ length: 46 }, (_, i) => {
                const r = rng(i * 13 + 7);
                const x = 4 + r() * 52;
                const y = 8 + r() * 134;
                const a = -0.5 + r() * 1.0; // почти вертикально, лёгкий разброс
                const len = 4 + r() * 6;
                const bend = (r() - 0.5) * 3; // слабый изгиб — волокно, а не палка
                return (
                  <path
                    key={i}
                    d={`M${x} ${y} Q${x + bend} ${y - len / 2} ${x + Math.sin(a) * len} ${y - len}`}
                    stroke="#C3D45F"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.4 + r() * 0.4}
                  />
                );
              })}
            </svg>
          </div>
          <div className="absolute -top-[7px] left-1/2 h-[7px] w-7 -translate-x-1/2 rounded-t-md bg-white/25" />
        </div>

        <div className="min-w-0">
          {/* «×» тем же кеглем и цветом, что цифра: серый мелкий знак читался
              как чужой символ, а не как часть значения. */}
          <p className="display whitespace-nowrap text-[34px] leading-none text-[#C3D45F] sm:text-[42px] lg:text-[54px]">
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{mult}</span>×
          </p>
          <p className="mt-3 text-[15px] font-bold text-white">Natural water reservoir</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/65">
            A single hummock holds up to 20–25× its own weight in water and releases it to the roots gradually.
          </p>
        </div>
      </div>

      {/* ── Снижение полива ── */}
      <div ref={dry.ref} className="flex items-center gap-6 p-6 lg:gap-8 lg:p-8">
        <div className="relative size-[104px] shrink-0 sm:size-[132px] lg:size-[150px]">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="#C3D45F"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - dry.t * 0.8)}
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            {/* Капля вместо числа: цифра дублировала заголовок «60–80%» */}
            <svg viewBox="0 0 24 24" className="wb-drop size-9 text-[#C3D45F] lg:size-10" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M12 3s6 6.6 6 10.5a6 6 0 0 1-12 0C6 9.6 12 3 12 3z" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="min-w-0">
          <p className="display whitespace-nowrap text-[34px] leading-none text-[#C3D45F] sm:text-[42px] lg:text-[54px]">60–80%</p>
          <p className="mt-3 text-[15px] font-bold text-white">Less irrigation</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/65">
            This is what makes the moss valuable in arid regions: water use and maintenance effort drop sharply.
          </p>
        </div>
      </div>
    </div>
  );
}
