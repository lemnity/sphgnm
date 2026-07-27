"use client";

import { useEffect, useRef, useState } from "react";

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

  const palette = dark
    ? ["#173026", "#1E4032", "#27543F", "#8FD3A8"]
    : ["#9DBFA4", "#87AE90", "#B7D2BB", "#2F6B4A"];

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
          <stop offset="0%" stopColor={dark ? "#1B3529" : "#D7E6DA"} />
          <stop offset="100%" stopColor={dark ? "#0C1B14" : "#A9C6AF"} />
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
              <svg viewBox="0 0 120 12" preserveAspectRatio="none" className="absolute -top-[7px] left-0 h-[10px] w-full" aria-hidden>
                <path d="M0 8 Q15 2 30 8 T60 8 T90 8 T120 8 V12 H0 Z" fill="rgba(104,186,206,.95)" />
              </svg>
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
            <svg viewBox="0 0 24 24" className="size-9 text-[#C3D45F] lg:size-10" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
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
