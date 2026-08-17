"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

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

/* ═══════════════ Моховой фон ═══════════════ */

/**
 * Фон первого экрана: мох, нарастающий броуновским движением.
 *
 * Основа: CodePen «Moss by Brownian Motion» (Johan Karlsson / DonKarlssonSan,
 * MIT, лежит в moss-by-brownian-motion/). Оригинал написан на p5.js; здесь
 * чистый canvas 2D — тянуть 300 КБ библиотеки ради ста частиц и рисования
 * отрезков незачем, а весь эффект это и есть сто частиц и отрезки.
 *
 * Как это работает. Сто точек блуждают случайным шагом и оставляют за собой
 * едва заметные штрихи. Холст НИКОГДА не очищается, поэтому штрихи копятся, и
 * фон медленно зарастает мхом — отсюда и название.
 *
 * ЧТО ИЗМЕНЕНО ПРОТИВ ОРИГИНАЛА:
 * 1. Холст прозрачный, а не чёрный: под ним фирменный Ink, и мох нарастает
 *    поверх него. Чёрная заливка выбила бы Ink из палитры.
 * 2. Шагов за кадр 8, а не 50 — фон должен зарастать МЕДЛЕННО. Заодно это
 *    вшестеро меньше работы на кадр.
 * 3. Есть предел: после FILL_FRAMES кадров цикл останавливается совсем.
 *    Иначе холст зарастает в сплошное пятно, а процессор занят вечно.
 * 4. Оттенки сужены к фирменной зелени (жёлтая часть диапазона убрана) и
 *    сгруппированы в шесть корзин — см. комментарий у MOSS_HUES.
 */
const MOSS_PARTICLES = 100;
const MOSS_STEP_MAX = 5;
const MOSS_STEPS_PER_FRAME = 8;
/** Через сколько кадров фон считается заросшим и цикл останавливается. */
const MOSS_FILL_FRAMES = 2600;

type MossParticle = { x: number; y: number; bucket: number };

/*
  Оттенки СГРУППИРОВАНЫ в корзины, и это не про цвет, а про скорость.
  В оригинале каждая частица красится в свой оттенок, то есть на каждый штрих
  идёт свой stroke(): сто частиц на восемь шагов — восемьсот вызовов за кадр,
  и это главный расход всей страницы. Замер прокрутки: 59 кадров за 2.2 с
  против 131 без холста вовсе.

  С шестью корзинами все штрихи одного оттенка собираются в ОДИН путь и
  рисуются одним вызовом: 48 вызовов за кадр вместо 800. На глаз разницы нет —
  шесть зелёных на полупрозрачных штрихах неотличимы от ста.
*/
const MOSS_HUES = [98, 108, 118, 128, 136, 142];

function drawMossFrame(
  ctx: CanvasRenderingContext2D,
  parts: MossParticle[],
  w: number,
  h: number,
  steps: number
) {
  ctx.lineWidth = 1;
  for (let i = 0; i < steps; i++) {
    for (let b = 0; b < MOSS_HUES.length; b++) {
      ctx.strokeStyle = "hsla(" + MOSS_HUES[b] + ", 48%, 64%, .075)";
      ctx.beginPath();
      let drew = false;
      for (const p of parts) {
        if (p.bucket !== b) continue;
        const ox = p.x;
        const oy = p.y;
        p.x += (Math.random() * 2 - 1) * MOSS_STEP_MAX;
        p.y += (Math.random() * 2 - 1) * MOSS_STEP_MAX;
        // Ушедшую за край возвращаем в кадр, иначе половина частиц разбредается
        // наружу и фон зарастает только в середине.
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          continue;
        }
        ctx.moveTo(ox, oy);
        ctx.lineTo(p.x, p.y);
        drew = true;
      }
      if (drew) ctx.stroke();
    }
  }
}

export function MossBackdrop({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let parts: MossParticle[] = [];
    let raf = 0;
    let drawn = 0;
    let visible = true;

    const seed = (w: number, h: number) => {
      parts = Array.from({ length: MOSS_PARTICLES }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        // Фирменная зелень: жёлтая часть исходного диапазона (70…150) убрана,
        // иначе фон уходит в салатовый и спорит с лаймовыми бабочками.
        bucket: Math.floor(Math.random() * MOSS_HUES.length),
      }));
    };

    // Плотность пикселей 1: это шумовая текстура, на удвоенной сетке она
    // выглядит так же, а работы вчетверо больше.
    const size = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth));
      const h = Math.max(1, Math.round(canvas.clientHeight));
      if (canvas.width === w && canvas.height === h) return false;
      canvas.width = w;
      canvas.height = h;
      seed(w, h);
      drawn = 0;
      return true;
    };
    size();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      // При «меньше движения» фон не зарастает на глазах, а сразу готов:
      // текстура осмысленна сама по себе, её нарастание — украшение.
      drawMossFrame(ctx, parts, canvas.width, canvas.height, 220);
      return;
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      if (drawn >= MOSS_FILL_FRAMES) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      drawn += 1;
      drawMossFrame(ctx, parts, canvas.width, canvas.height, MOSS_STEPS_PER_FRAME);
    };

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(canvas);
    // Пересев при смене размера: холст очищается сменой width/height, и
    // нарастание начинается заново — иначе текстура растянулась бы.
    const ro = new ResizeObserver(() => { if (size()) drawn = 0; });
    ro.observe(canvas);
    raf = requestAnimationFrame(loop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={`moss-backdrop ${className}`} style={style} aria-hidden />;
}

/* ═══════════════ Лучи света ═══════════════ */

/*
  Лучи — фрагментный шейдер на WebGL.

  Основа: CodePen «2025-08-10 light rays» (Loïc Laudet, MIT, лежит в
  2025-08-10light-rays/), сам он по мотивам ElusivePete на Shadertoy.
  Лицензия MIT — файл LICENSE.txt в той же папке, авторство ниже в коде.

  Почему шейдер, а не CSS. Столб света — это не фигура, а ПОЛЕ яркости: она
  зависит от угла к солнцу и от расстояния до него в каждой точке кадра. CSS
  умеет рисовать фигуры, поэтому там приходилось собирать луч из двух
  прямоугольников, клина-обрезки, маски-колокола и размытия — и всё равно
  оставались стыки, ступеньки и пересчёт blur на каждом кадре. Здесь яркость
  считается прямо для каждого пикселя, а анимация — это сдвиг фазы синуса,
  то есть ровно то самое «плавное свечение».

  ЧТО ИЗМЕНЕНО ПРОТИВ ОРИГИНАЛА (и зачем):
  1. Источник вынесен в uniform и стоит в правом верхнем углу, а не по центру.
  2. Добавлено затухание с расстоянием от солнца. В оригинале фон чёрный и
     ровная засветка всего кадра выглядит туманом; у нас под лучами лежит
     заголовок, и такая засветка съедала бы ему контраст.
  3. Добавлен порог (raw - 0.58): в оригинале яркость лучей никогда не падает
     до нуля, промежутки между ними светлые. Без тёмных промежутков пучок
     читается сплошным конусом — фонарём, а не солнцем.
  4. Добавлен ореол вокруг источника (u_glow) — то самое пятно солнца.
  5. Тёплый разбор по каналам: к низу свет холоднее и слабее.
*/
const RAY_VERTEX_SHADER = `
precision mediump float;
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  // y переворачивается здесь: в кадре ноль сверху, у clip-space — снизу.
  vUv = vec2(0.5 * (a_position.x + 1.0), 0.5 * (1.0 - a_position.y));
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const RAY_FRAGMENT_SHADER = `
precision mediump float;
varying vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_source;
uniform float u_intensity;
uniform float u_glow;

/*
  Яркость луча в точке. cosAngle — косинус угла между направлением на точку и
  опорным направлением; синусы от него и дают чередование лучей и промежутков.
  Время сдвигает фазу: рисунок медленно перетекает, лучи «дышат».
*/
float rayStrength(vec2 src, vec2 refDir, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - src;
  float cosAngle = dot(normalize(sourceToCoord), refDir);
  float raw =
    (0.45 + 0.15 * sin(cosAngle * seedA + u_time * speed)) +
    (0.30 + 0.20 * cos(-cosAngle * seedB + u_time * speed));
  // Порог: без него промежутки между лучами никогда не темнеют.
  return clamp((raw - 0.58) / 0.52, 0.0, 1.0);
}

void main() {
  vec2 frag = vUv * u_resolution;
  float dist = length(frag - u_source);

  /*
    Частоты 36.2 / 21.1 — как в исходном пене. Держать их в связке с тем, где
    стоит вершина: рисунок задан через КОСИНУС УГЛА на точку кадра, и если
    унести источник далеко за край, угол по кадру меняется мало, синус успевает
    сделать пол-колебания и вместо веера остаётся один размазанный луч.
    Вершина рядом с кадром — эти частоты правильные.
  */
  float rays = rayStrength(u_source, normalize(vec2(-0.78, 1.0)), frag, 36.2214, 21.11349, 0.32);

  // Затухание с расстоянием от солнца — квадратичное, чтобы дальний край кадра
  // оставался тёмным и заголовок не терял контраст.
  float fall = 1.0 - smoothstep(0.0, u_resolution.x * 1.15, dist);
  fall *= fall;

  // Ореол солнца.
  float glow = exp(-dist / (u_resolution.x * u_glow));

  float v = (rays * fall * 0.62 + glow * 0.5) * u_intensity;

  // Тёплый, к золоту. depth: вверху кадра свет теплее и сильнее, книзу
  // рассеивается и холоднеет — так ведёт себя свет в толще воздуха.
  float depth = 1.0 - vUv.y;
  vec3 tint = vec3(0.56 + 0.44 * depth, 0.50 + 0.40 * depth, 0.32 + 0.30 * depth);

  /*
    Холст ПРОЗРАЧНЫЙ: альфа равна самой яркости света, а цвет уже умножен на
    неё (контекст создан с premultipliedAlpha). Там, где света нет, пиксель
    полностью прозрачен.

    Так было не сразу. Сначала холст был непрозрачным по образцу оригинального
    пена (там под ним чёрный фон страницы, и это незаметно). Расчёт был на
    mix-blend-mode: screen у контейнера — screen с чёрным ничего не меняет.
    На деле кадр потемнел: замер показал слева rgb(4,4,3) против rgb(34,40,26)
    без лучей, то есть чёрный холст ЗАКРАШИВАЛ сцену, а не смешивался с ней.
    С прозрачным холстом вопрос снят вовсе — он не зависит от того, дошло ли
    смешивание, и лишний слой краски в кадр не попадает.
  */
  gl_FragColor = vec4(tint * v, v);
}
`;

/**
 * Положение солнца и сила свечения по ширине экрана.
 *
 * ВЕРШИНА ПОДНЯТА НАД ВЕРХНЕЙ КРОМКОЙ (sy отрицательный), но недалеко.
 * Смысл в том, чтобы в кадре не было видно точки, ОТКУДА расходятся лучи:
 * видимая вершина сразу читается лампой. При этом уносить источник далеко
 * нельзя — рисунок задан косинусом угла на точку кадра, и с дальней вершины
 * угол по всему кадру почти не меняется: веер вырождается в один размазанный
 * луч. Проверено: sy около -0.35 уже даёт ровно это.
 *
 * На узком экране уступ с мхом не выводится вовсе, а заголовок занимает всю
 * ширину — поэтому там солнце ещё дальше за краем и заметно тусклее.
 */
function rayTuning(width: number) {
  if (width < 768) return { sx: 1.02, sy: -0.16, intensity: 0.5, glow: 0.15 };
  if (width < 1280) return { sx: 0.99, sy: -0.15, intensity: 0.75, glow: 0.16 };
  return { sx: 0.95, sy: -0.14, intensity: 1, glow: 0.18 };
}

/**
 * Пылинки в столбах света.
 *
 * Главный признак того, что свет ОБЪЁМНЫЙ, а не нарисован поверх кадра: столб
 * виден только потому, что в нём висит взвесь. Без неё это градиент, с ней —
 * воздух.
 *
 * Это НЕ светлячки: у тех есть ореол (см. .firefly в стилях), и он же делает их
 * живностью. У пылинки ореола нет намеренно — только точка на грани видимости.
 *
 * Координаты держат пылинки в правом верхнем углу, где идут столбы: россыпь по
 * всему кадру читалась бы шумом или снегом. Таблица, а не генератор: анимация
 * бесконечная, случайные значения при гидрации разошлись бы с серверными.
 *
 * dx/dy — куда пылинку сносит за период. Снос вниз слабый и вбок разный:
 * пыль в воздухе не падает, а плавает. Периоды 21–37 с взаимно не кратны.
 */
const MOTES = [
  { top: "9%", right: "7%", s: "2.6px", o: 0.34, dx: "-1.6vw", dy: "7vh", dur: "27s", delay: "0s" },
  { top: "16%", right: "18%", s: "1.8px", o: 0.24, dx: "1.1vw", dy: "9vh", dur: "34s", delay: "-11s" },
  { top: "6%", right: "26%", s: "2.1px", o: 0.2, dx: "-0.9vw", dy: "6vh", dur: "23s", delay: "-6s" },
  { top: "24%", right: "5%", s: "3px", o: 0.3, dx: "1.4vw", dy: "8vh", dur: "31s", delay: "-19s" },
  { top: "31%", right: "14%", s: "1.6px", o: 0.22, dx: "-1.2vw", dy: "5vh", dur: "37s", delay: "-3s" },
  { top: "12%", right: "33%", s: "2.3px", o: 0.18, dx: "0.8vw", dy: "10vh", dur: "29s", delay: "-14s" },
  { top: "38%", right: "22%", s: "2px", o: 0.26, dx: "-1.5vw", dy: "6vh", dur: "25s", delay: "-8s" },
  { top: "44%", right: "9%", s: "1.7px", o: 0.2, dx: "1vw", dy: "7vh", dur: "33s", delay: "-21s" },
  { top: "20%", right: "40%", s: "1.5px", o: 0.15, dx: "-0.7vw", dy: "8vh", dur: "21s", delay: "-5s" },
  { top: "52%", right: "16%", s: "2.4px", o: 0.24, dx: "1.3vw", dy: "5vh", dur: "35s", delay: "-16s" },
  { top: "3%", right: "13%", s: "1.9px", o: 0.28, dx: "-1vw", dy: "9vh", dur: "26s", delay: "-24s" },
  { top: "35%", right: "31%", s: "1.6px", o: 0.16, dx: "0.9vw", dy: "6vh", dur: "30s", delay: "-9s" },
];

export function LightRays({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // alpha: true + premultipliedAlpha — холст прозрачен там, где нет света
    // (см. конец фрагментного шейдера). depth/stencil не нужны: рисуем один
    // прямоугольник без глубины.
    const gl =
      canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
      }) ?? canvas.getContext("experimental-webgl", { alpha: true });
    // Без WebGL просто не рисуем: лучи — украшение, а не содержание. Никаких
    // alert, как в оригинальном пене.
    if (!gl || !(gl instanceof WebGLRenderingContext)) return;

    const compile = (src: string, type: number) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("light rays: shader", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(RAY_VERTEX_SHADER, gl.VERTEX_SHADER);
    const fs = compile(RAY_FRAGMENT_SHADER, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("light rays: link", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uSrc = gl.getUniformLocation(program, "u_source");
    const uInt = gl.getUniformLocation(program, "u_intensity");
    const uGlow = gl.getUniformLocation(program, "u_glow");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Размер берём от СВОЕЙ коробки, а не от окна: холст лежит внутри героя,
    // а не на весь экран, и по окну он растянулся бы мимо.
    const resize = () => {
      /*
        Считаем в ПОЛОВИНУ экранного разрешения и растягиваем: картинка — сплошь
        плавные градиенты, ступенек на них взяться неоткуда, а фрагментов вчетверо
        меньше. Это страховка для машин без аппаратного ускорения: там шейдер
        считает процессор, и полное разрешение обходится дорого.
      */
      const dpr = 0.5;
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      const t = rayTuning(canvas.clientWidth);
      gl.uniform2f(uSrc, w * t.sx, h * t.sy);
      gl.uniform1f(uInt, t.intensity);
      gl.uniform1f(uGlow, t.glow);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let visible = true;
    gl.clearColor(0, 0, 0, 0);
    const draw = (timeSec: number) => {
      // Очистка обязательна: холст прозрачный, и без неё поверх прозрачных
      // мест остаётся предыдущий кадр — свет копится в грязное пятно.
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, timeSec);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    if (still) {
      // При «меньше движения» кадр рисуется один раз и замирает: сами лучи
      // осмысленны, дышать им не обязательно.
      draw(0);
    } else {
      /*
        Не чаще 30 кадров в секунду. Свечение здесь — медленный дрейф фазы
        синуса, разницы между 30 и 60 кадрами на нём не видно, а работы вдвое
        меньше. Прокрутке это отдаёт половину бюджета обратно.
      */
      const MIN_FRAME_MS = 1000 / 30;
      let lastDraw = 0;
      const loop = () => {
        frame = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        const now = performance.now();
        if (now - lastDraw < MIN_FRAME_MS) return;
        lastDraw = now;
        draw(now * 0.001);
      };
      // Пока герой не в кадре, считать нечего: шейдер крутится вхолостую и
      // отъедает кадровый бюджет у прокрутки остальной страницы.
      const io2 = new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
        },
        { threshold: 0 }
      );
      io2.observe(canvas);
      frame = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(frame);
        io2.disconnect();
        ro.disconnect();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    }

    return () => {
      ro.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div className={`light-rays pointer-events-none absolute ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="light-rays-canvas" />
      {/* Пылинки поверх лучей: они висят в свету, а не под ним. */}
      {MOTES.map((m, i) => (
        <span
          key={`mote-${i}`}
          className="mote"
          style={
            {
              top: m.top,
              right: m.right,
              width: m.s,
              height: m.s,
              "--mo": m.o.toFixed(2),
              "--mx": m.dx,
              "--my": m.dy,
              animationDuration: m.dur,
              animationDelay: m.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ═══════════════ Живая фитостена ═══════════════ */

/*
  ЖИВАЯ ФИТОСТЕНА — фотография первого экрана, у которой листва шевелится от
  курсора.

  Роль в кадре: это единственный броский элемент первого экрана, всё остальное
  вокруг держится тихо. Возмущение идёт ОТ КУРСОРА, а не от прокрутки —
  прокрутка уже двигает фон параллаксом, и мешать эти два движения нельзя.

  Холст ложится ПОВЕРХ статического CSS-фона и рисует ту же картинку. Отсюда
  вся деградация бесплатно: нет WebGL, не загрузилась текстура, включено
  «меньше движения» — холст просто остаётся прозрачным, и виден статический
  фон под ним. Пустого экрана не бывает ни в одном из случаев.

  Каркас (getContext → compile → link → ResizeObserver → полная отписка) взят
  из LightRays выше: в этом файле он канон, изобретать второй незачем.
*/
const WALL_VERTEX_SHADER = `
precision mediump float;
attribute vec2 a_position;
varying vec2 vUv;
void main() {
  // y НЕ переворачивается (в отличие от лучей): текстура заливается с
  // UNPACK_FLIP_Y_WEBGL, и у неё ноль тоже снизу.
  vUv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/*
  Фрагментный шейдер.

  Три вещи, на которых всё держится:

  1. КАДРИРОВАНИЕ. Подложка под холстом — обычный background-size: cover +
     background-position: center. Холст обязан кадрировать ровно так же, иначе
     в момент его появления картинка заметно прыгнет. Поэтому cover считается
     здесь честно из u_resolution и u_texSize, а не «на глаз».

  2. МАСШТАБ ЛИСТА. Домен-варп идёт по шумовой сетке с ячейкой u_cell —
     это десятки пикселей, размер листа. На пиксельной сетке получилось бы
     дрожание плёнки, а не шелест.

  3. МАСКА ЗЕЛЕНИ. На кадре есть мраморная стойка, деревянные панели, рамы
     остекления, пол и золотой знак. Если они поплывут вместе с листьями,
     эффект сразу читается как сломанный: камень не колышется. Поэтому
     смещение умножается на «зелёность» пикселя — зелёный канал против
     максимума из красного и синего, нормированный на саму зелень, чтобы
     тёмный лист в тени считался таким же листом, как освещённый.

  highp там, где он есть: hash на sin(dot(...)) в mediump на части мобильных
  GPU вырождается в полосы.
*/
const WALL_FRAGMENT_SHADER = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform vec2 u_texSize;
uniform vec2 u_anchor;
uniform vec2 u_pointer;
uniform float u_energy;
uniform float u_time;
uniform float u_radius;
uniform float u_amp;
uniform float u_cell;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

/* Обычный value-noise со сглаживанием — внешних текстур не требует. */
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

/*
  Множитель cover: во сколько раз ужимается видимая часть картинки по каждой
  оси. Ровно то, что делает background-size: cover. Привязку к нужному краю
  кадра даёт уже вызывающий код (см. base в main).
*/
vec2 coverScale() {
  float rc = u_resolution.x / u_resolution.y;
  float ri = u_texSize.x / u_texSize.y;
  // Холст шире картинки — режем по высоте, иначе по ширине.
  return rc > ri ? vec2(1.0, ri / rc) : vec2(rc / ri, 1.0);
}

/*
  Насколько пиксель — листва. Числитель нормируется на сам зелёный канал, и
  порог перестаёт зависеть от освещённости: лист в тени rgb(30,45,25) даёт то
  же значение, что освещённый rgb(60,90,45). Мрамор и стекло дают ноль
  (каналы равны), дерево и золото — отрицательное (красного больше зелёного).
  Второй множитель гасит почти чёрные пиксели: там отношение шумит.
*/
float leafMask(vec2 uv) {
  vec3 c = texture2D(u_tex, uv).rgb;
  float g = c.g - max(c.r, c.b);
  float gn = g / max(c.g, 0.12);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return smoothstep(0.05, 0.20, gn) * smoothstep(0.03, 0.09, lum);
}

void main() {
  vec2 scale = coverScale();
  /*
    Точка привязки кадра — та же, что background-position у подложки.
    В точке vUv == u_anchor картинка «приколота»: там base совпадает с
    anchor, а по сторонам расходится на scale. u_anchor = (1,1) — правый
    верхний угол, (0,1) — левый верхний. У текстуры залит UNPACK_FLIP_Y_WEBGL,
    поэтому её v=1 — это ВЕРХ картинки.
  */
  vec2 base = (vUv - u_anchor) * scale + u_anchor;
  vec2 uvPerPx = scale / u_resolution;

  // Спад по расстоянию до курсора: возмущение локальное, «под ладонью».
  vec2 frag = vUv * u_resolution;
  float d = distance(frag, u_pointer);
  float drive = u_energy * exp(-(d * d) / (u_radius * u_radius));

  // Ранний выход: вдали от курсора и в покое считать нечего — а это почти
  // весь кадр.
  if (drive < 0.004) {
    gl_FragColor = vec4(texture2D(u_tex, base).rgb, 1.0);
    return;
  }

  /*
    Маска берётся крестом из пяти отсчётов в ~3 экранных пикселях друг от
    друга. По одному отсчёту край листа рвался бы на границе с камнем, и
    смещение отрезалось бы ступенькой.
  */
  float m = 0.2 * (
    leafMask(base) +
    leafMask(base + vec2(uvPerPx.x * 3.0, 0.0)) +
    leafMask(base - vec2(uvPerPx.x * 3.0, 0.0)) +
    leafMask(base + vec2(0.0, uvPerPx.y * 3.0)) +
    leafMask(base - vec2(0.0, uvPerPx.y * 3.0))
  );
  if (m < 0.01) {
    gl_FragColor = vec4(texture2D(u_tex, base).rgb, 1.0);
    return;
  }

  /*
    Домен-варп. Два шумовых поля задают НАПРАВЛЕНИЕ (клочок листвы едет
    целиком, а не каждый пиксель врозь), а сумма двух синусов с разными
    частотами по осям — знак и величину. Без синусов листва один раз уехала бы
    вбок и застыла; с ними она качается, и качается не в такт по кадру.

    Направление нормировано, поэтому |смещение| ≤ u_amp ровно, а не «в среднем
    примерно»: потолок амплитуды тут важнее заметности.
  */
  vec2 p = frag / u_cell;
  float n1 = vnoise(p + vec2(u_time * 0.33, u_time * 0.21));
  float n2 = vnoise(p.yx * 1.19 + vec2(-u_time * 0.27, u_time * 0.17) + 31.4);
  vec2 v = vec2(n1, n2) * 2.0 - 1.0;
  vec2 dir = v / max(length(v), 0.15);
  float wobble = 0.6 * sin(p.y * 1.7 + u_time * 2.3) + 0.4 * sin(p.x * 2.3 + u_time * 1.7);

  vec2 uv = base + dir * (wobble * u_amp * drive * m) * uvPerPx;
  gl_FragColor = vec4(texture2D(u_tex, uv).rgb, 1.0);
}
`;

/**
 * Потолок смещения в пикселях ИСХОДНОЙ картинки. На первом экране 1440×900
 * кадр растянут в 1.175 раза, то есть это ровно 5.9 экранных пикселя.
 *
 * Именно потолок, а не «в среднем примерно»: направление в шейдере
 * нормировано, а качание — сумма двух синусов с весами 0.6/0.4, по модулю не
 * больше единицы. Потолок здесь важнее заметности: на десятке пикселей
 * фотография начинает плыть резиной, и эффект мгновенно читается дешёвым.
 */
const WALL_AMP_IMAGE_PX = 5;
/** Радиус спада — доля меньшей стороны холста. Возмущение локальное. */
const WALL_RADIUS_RATIO = 0.2;
/** Ячейка шума в пикселях ИСХОДНОЙ картинки: примерно один лист. */
const WALL_CELL_IMAGE_PX = 34;
/** Постоянная времени затухания энергии, с. */
const WALL_DECAY_TAU = 0.6;
/** Скорость курсора (CSS px/с), на которой накачка выходит на максимум. */
const WALL_FULL_SPEED = 2600;
/** Постоянная времени накачки на максимальной скорости, с. */
const WALL_RISE_TAU = 0.14;

export function LivingWall({
  src,
  pointerTargetRef,
  className = "",
  style,
}: {
  src: string;
  /** Секция героя: движение курсора ловим над ней, а не над самим холстом. */
  pointerTargetRef: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Холст показывается только после первого удачного кадра. Это единственный
  // выключатель на все виды деградации сразу.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // «Меньше движения» — холст не поднимаем вовсе: под ним корректный
    // статический фон, и он же был единственным содержимым до этой правки.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // alpha: false — холст непрозрачен, он рисует саму фотографию, а не
    // подсветку поверх неё. depth/stencil не нужны: один прямоугольник.
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
    });
    // Без WebGL просто не рисуем — виден статический фон.
    if (!gl || !(gl instanceof WebGLRenderingContext)) return;

    const compile = (source: string, type: number) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error("living wall: shader", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(WALL_VERTEX_SHADER, gl.VERTEX_SHADER);
    const fs = compile(WALL_FRAGMENT_SHADER, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("living wall: link", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uTexSize = gl.getUniformLocation(program, "u_texSize");
    const uAnchor = gl.getUniformLocation(program, "u_anchor");
    const uPointer = gl.getUniformLocation(program, "u_pointer");
    const uEnergy = gl.getUniformLocation(program, "u_energy");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uRadius = gl.getUniformLocation(program, "u_radius");
    const uAmp = gl.getUniformLocation(program, "u_amp");
    const uCell = gl.getUniformLocation(program, "u_cell");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    let texW = 0;
    let texH = 0;
    let texLoaded = false;

    /*
      Половинное разрешение, как у лучей, здесь НЕ годится: там сплошь плавные
      градиенты, а тут фотография с мелкой деталью, и в половине она станет
      мылом. Потолок 2 — выше глазу уже нечего забирать.
    */
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      /*
        Точка привязки кадра ОБЯЗАНА совпадать с background-position статической
        подложки — иначе в момент появления холста картинка прыгнет. Порог 1024
        px — это Tailwind-брейкпоинт lg, на котором подложка переключается с
        bg-left-top на bg-right-top. Держать оба места в согласии: поменяли
        класс — поменяйте и здесь.

        Почему вообще два кадра. У кадра соотношение 1.79, и на узком экране
        cover срезает по ширине почти всё: видно около 18% кадра. Справа это
        тёмная стена с золотым знаком — на телефоне вместо стены получался бы
        размытый логотип во весь экран. Слева там сплошная листва, поэтому на
        узком экране кадр приколот к левому краю.
      */
      const wide = window.matchMedia("(min-width: 1024px)").matches;
      gl.uniform2f(uAnchor, wide ? 1 : 0, 1);
      gl.uniform1f(uRadius, WALL_RADIUS_RATIO * Math.min(w, h));
      if (texLoaded) {
        /*
          И ячейка шума, и амплитуда заданы в пикселях ИСХОДНИКА, а на экран
          переводятся тем же cover-множителем, каким растянута сама картинка.
          Считать их от ширины окна было бы неверно: на широком экране кадр
          растянут не сильнее (cover упирается в высоту), лист на экране того же
          размера — значит и качаться он должен на столько же.
        */
        const cover = Math.max(w / texW, h / texH);
        gl.uniform1f(uCell, WALL_CELL_IMAGE_PX * cover);
        gl.uniform1f(uAmp, WALL_AMP_IMAGE_PX * cover);
      }
    };

    // Энергия возмущения живёт здесь, а не в шейдере: шейдер не помнит кадров.
    let energy = 0;
    // Курсор в координатах окна; в пиксели холста переводим в момент отрисовки,
    // потому что холст ещё и едет по вертикали от параллакса.
    let clientX: number | null = null;
    let clientY: number | null = null;

    const draw = (timeSec: number) => {
      if (!texLoaded) return;
      if (clientX === null || clientY === null) {
        gl.uniform2f(uPointer, -1e5, -1e5);
      } else {
        const rect = canvas.getBoundingClientRect();
        const kx = canvas.width / Math.max(rect.width, 1);
        const ky = canvas.height / Math.max(rect.height, 1);
        // y переворачивается: в шейдере считаем в системе с нулём снизу.
        gl.uniform2f(uPointer, (clientX - rect.left) * kx, (rect.bottom - clientY) * ky);
      }
      gl.uniform1f(uEnergy, energy);
      gl.uniform1f(uTime, timeSec);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    let inView = true;
    let frame = 0;
    let running = false;
    let last = 0;

    /*
      Крутить rAF при неподвижном курсоре незачем: стена в покое статична, и
      кадр от кадра не меняется. Цикл живёт ровно столько, сколько догорает
      энергия, и гасит её последним кадром ровно в ноль.
    */
    const loop = (now: number) => {
      // Потолок 0.25 с, а не один кадр: затухание должно идти по РЕАЛЬНОМУ
      // времени. Зажми dt покадрово — и на машине, где кадры редкие, стена
      // успокаивалась бы в разы дольше, чем задумано.
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      energy *= Math.exp(-dt / WALL_DECAY_TAU);
      if (energy > 0.003 && inView && !document.hidden) {
        draw(now * 0.001);
        frame = requestAnimationFrame(loop);
        return;
      }
      energy = 0;
      running = false;
      frame = 0;
      draw(now * 0.001);
    };

    const kick = () => {
      if (running || !inView || document.hidden || !texLoaded) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    };

    let lastMoveAt = 0;
    const onMove = (e: PointerEvent) => {
      // Секция героя выше экрана (залипание), и курсор может ходить над ней,
      // когда холст уже уехал из кадра. Копить энергию в этот момент нельзя:
      // при возврате прокруткой стена вздрогнула бы ни с того ни с сего.
      if (!inView) return;
      const now = performance.now();
      const prevX = clientX;
      const prevY = clientY;
      clientX = e.clientX;
      clientY = e.clientY;
      if (prevX === null || prevY === null) {
        lastMoveAt = now;
        return;
      }
      // dt зажат: первый кадр после паузы иначе даёт скорость в единицы px/с,
      // а слипшиеся события — бесконечную.
      const dt = Math.min(Math.max((now - lastMoveAt) / 1000, 0.004), 0.1);
      lastMoveAt = now;
      const speed = Math.hypot(e.clientX - prevX, e.clientY - prevY) / dt;
      // Накачка пропорциональна скорости: медленное ведение даёт равновесие
      // где-то на половине шкалы, резкое — выводит на максимум.
      energy = Math.min(1, energy + Math.min(speed / WALL_FULL_SPEED, 1) * (dt / WALL_RISE_TAU));
      kick();
    };

    const target = pointerTargetRef.current;
    target?.addEventListener("pointermove", onMove, { passive: true });
    // pointerleave энергию НЕ обнуляет: рывок читался бы как баг. Стена
    // успокаивается тем же затуханием, что и при остановке курсора.

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now() * 0.001);
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        if (inView) kick();
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const image = new Image();
    image.decoding = "async";
    const onLoad = () => {
      texW = image.naturalWidth;
      texH = image.naturalHeight;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // Картинка не степень двойки, поэтому только CLAMP + LINEAR: с
      // mipmap/REPEAT текстура вышла бы чёрной.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      gl.uniform2f(uTexSize, texW, texH);
      texLoaded = true;
      resize();
      draw(performance.now() * 0.001);
      // Только теперь холст можно показать: до этого кадра он пустой, и
      // проявись он раньше — на месте фотографии была бы дыра.
      setReady(true);
    };
    // Текстура не загрузилась — холст остаётся прозрачным, виден фон.
    const onError = () => console.error("living wall: texture failed", src);
    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);
    image.src = src;

    resize();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      target?.removeEventListener("pointermove", onMove);
      ro.disconnect();
      io.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      setReady(false);
    };
  }, [src, pointerTargetRef]);

  return (
    // Обёртка, а не голый canvas: холст — замещаемый элемент, и при width: auto
    // он берёт СВОЙ размер (300×150), сколько ему ни ставь left/right/top/bottom.
    // Коробку задаёт div, холст растягивается по ней.
    <div
      className={`pointer-events-none ${className}`}
      style={{ ...style, opacity: ready ? 1 : 0, transition: "opacity 320ms ease-out" }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="living-wall-canvas block h-full w-full" />
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

/* ═══════════════════ СХЕМЫ ПРИМЕНЕНИЯ ═══════════════════
   Раздел «Where our solutions perform» состоял из трёх пустых слотов под фото:
   больше половины его площади занимали серо-зелёные прямоугольники с подписью
   «какой кадр нужен». Фотографий объектов у нас нет и взять их неоткуда — сток
   в продающий блок здесь запрещён осознанно (см. шапку sphagnum-landing.tsx).

   Поэтому вместо кадра — СХЕМА. Она честна по определению: схему нельзя принять
   за чужой объект, выданный за свой, а инженеру-заказчику разрез сборки говорит
   больше, чем красивая терраса из стока. Плюс схема — это ровно тот язык, на
   котором лендинг уже обещает «технический паспорт».

   Сделаны на HTML/CSS, а не в SVG, и это не вкусовщина: подписи внутри SVG
   масштабируются вместе с картинкой, и на 390px «Sphagnum substrate» ужалось бы
   до 8px. В разметке текст остаётся текстом — читается, доступен скринридеру,
   ищется поиском по странице. SVG остался только там, где нужна форма: пучки
   растительности, дерево, корни.

   Как только приедут настоящие кадры, схемы уйдут сами: слот показывает фото,
   если в APPLICATIONS[].photo лежит URL. */

/** Сборка зелёной кровли снизу вверх. Порядок слоёв — отраслевой стандарт
    (озеленение → субстрат → фильтр и дренаж → гидроизоляция → плита), нашего
    в нём только один слой, он и подсвечен. */
const ROOF_BUILDUP = [
  // Слой растительности БЕЗ подписи, и это не пропуск. Подпись пересекалась с
  // пучками травы и становилась нечитаемой в обоих направлениях: и текст, и
  // рисунок. А называть траву травой незачем — она узнаётся с первого взгляда.
  // Подписываем только то, что без подписи не читается. Ключ строки поэтому
  // kind, а не label: пустых label может стать больше одного.
  { label: "", grow: 20, kind: "veg" },
  { label: "Sphagnum substrate", grow: 27, kind: "substrate" },
  { label: "Filter and drainage", grow: 17, kind: "drain" },
  { label: "Waterproofing", grow: 10, kind: "proof" },
  { label: "Structural deck", grow: 22, kind: "deck" },
] as const;

/** Подпись слоя. Вынесена, чтобы кегль и трекинг не разъехались между слоями. */
function LayerLabel({ children, onDark = false }: { children: string; onDark?: boolean }) {
  return (
    <span
      className={`label relative z-10 text-[10px] leading-none sm:text-[11px] ${
        onDark ? "text-[color:var(--brand-cream)]" : "text-[color:var(--brand-ink)]"
      }`}
    >
      {children}
    </span>
  );
}

function RoofBuildUp() {
  const { ref, on, reduced } = useEnter<HTMLDivElement>();
  const N = ROOF_BUILDUP.length;
  return (
    <div ref={ref} className="flex h-full flex-col overflow-hidden rounded-xl">
      {ROOF_BUILDUP.map((l, i) => (
        <div
          key={l.kind}
          style={{
            flexGrow: l.grow,
            flexBasis: 0,
            // Слои появляются СНИЗУ ВВЕРХ — в том порядке, в котором кровлю
            // собирают на объекте: плита, гидроизоляция, дренаж, субстрат,
            // растительность. Поэтому задержка считается от конца массива, а не
            // от начала: сверху вниз получилась бы сборка вверх ногами.
            opacity: on ? 1 : 0,
            transform: on ? "none" : "translateY(14px)",
            transition: reduced
              ? "none"
              : `opacity .5s ease-out ${(N - 1 - i) * 0.09}s, transform .5s cubic-bezier(.16,1,.3,1) ${(N - 1 - i) * 0.09}s`,
          }}
          className={`relative flex items-center px-4 sm:px-6 ${
            l.kind === "substrate"
              ? "bg-[color:var(--brand-moss)]"
              : l.kind === "proof"
                ? "bg-[color:var(--brand-ink)]"
                : "bg-[color:var(--brand-cream)]"
          }`}
        >
          {/* Растительность: ряд пучков по верхней кромке субстрата. Прорастает
              последней и из нуля по высоте (transformOrigin снизу) — то есть
              буквально всходит на уже собранной кровле. */}
          {l.kind === "veg" && (
            <svg
              viewBox="0 0 300 40"
              preserveAspectRatio="none"
              className="absolute inset-x-0 bottom-0 h-full w-full"
              style={{
                transformOrigin: "bottom",
                transform: on ? "scaleY(1)" : "scaleY(0)",
                transition: reduced ? "none" : "transform .85s cubic-bezier(.16,1,.3,1) .5s",
              }}
              aria-hidden
            >
              {Array.from({ length: 24 }, (_, i) => {
                const x = 6 + i * 12.2;
                const h = 12 + ((i * 7) % 16); // детерминированно, без Math.random
                return (
                  <g key={i} stroke="var(--brand-moss)" strokeWidth={1.6} strokeLinecap="round" fill="none">
                    <path d={`M${x} 40 C ${x - 1} ${40 - h / 2}, ${x - 3} ${40 - h}, ${x - 4} ${40 - h - 3}`} />
                    <path d={`M${x} 40 C ${x + 1} ${40 - h / 2}, ${x + 3} ${40 - h + 2}, ${x + 5} ${40 - h - 1}`} />
                  </g>
                );
              })}
            </svg>
          )}
          {/* Дренаж: гранулы. repeating-radial-gradient, а не 40 узлов в разметке.
              Зерно мельче и бледнее, чем просилось на глаз: крупные тёмные точки
              шли прямо сквозь буквы подписи и рвали её на части. */}
          {l.kind === "drain" && (
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, var(--brand-sage) 0 1.9px, transparent 2px) 0 0/16px 16px",
                opacity: 0.5,
              }}
            />
          )}
          {/* Плита: штриховка под углом — узнаваемое обозначение бетона в разрезе. */}
          {l.kind === "deck" && (
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(45deg, var(--brand-line) 0 1.5px, transparent 1.5px 11px)",
              }}
            />
          )}
          <LayerLabel onDark={l.kind === "substrate" || l.kind === "proof"}>{l.label}</LayerLabel>
        </div>
      ))}
    </div>
  );
}

/**
 * Вход схемы в кадр одним значением.
 *
 * `on` — «показывать конечное состояние». Обрати внимание, что при включённом
 * «меньше движения» он true СРАЗУ, ещё до попадания в кадр: схема обязана быть
 * видна, даже если IntersectionObserver почему-то не сработал. Анимации при этом
 * гасятся отдельно, через `reduced` — то есть выключается движение, а не контент.
 * Обратный порядок (гасить через opacity) оставил бы часть схем невидимыми.
 */
function useEnter<T extends HTMLElement>() {
  const reduced = useReducedMotion();
  const { ref, seen } = useInView<T>();
  return { ref, on: reduced || seen, reduced };
}

/** Ячейка стены, из которой вынут модуль (0-based: 3-й ряд, 2-й столбец). */
const WALL_SOCKET = 9;

function WallPanels() {
  // 4×4 стена модулей. Тон панели детерминирован её индексом: одинаковые
  // квадраты читались бы плиткой санузла, а не живой стеной.
  const TONES = ["var(--brand-moss)", "var(--brand-sage)", "#6E8570", "#9DB29C"];
  const { ref, on, reduced } = useEnter<HTMLDivElement>();
  // Стена набирается по ДИАГОНАЛИ (столбец + ряд), а не построчно: построчно
  // читается как загрузка таблицы, по диагонали — как кладка.
  const cellDelay = (i: number) => ((i % 4) + Math.floor(i / 4)) * 0.045;
  // Модуль выезжает ПОСЛЕ того, как сложилась вся стена: сначала объект целый,
  // потом из него достают деталь. Наоборот — и приём не читается.
  const PULL_DELAY = 0.62;
  const cellStyle = (i: number) => ({
    opacity: on ? 1 : 0,
    transform: on ? "none" : "scale(.86)",
    transition: reduced
      ? "none"
      : `opacity .4s ease-out ${cellDelay(i)}s, transform .45s cubic-bezier(.16,1,.3,1) ${cellDelay(i)}s`,
  });
  return (
    <div className="relative h-full w-full p-5 sm:p-7">
      <div ref={ref} className="relative grid h-full grid-cols-4 grid-rows-4 gap-1.5 sm:gap-2">
        {Array.from({ length: 16 }, (_, i) =>
          i === WALL_SOCKET ? (
            // Гнездо: модуль отсюда вынут. Внутренняя тень, а не просто светлый
            // прямоугольник, — иначе пустая ячейка читается «ещё одной панелью
            // другого оттенка», и приём с вынутым модулем не прочитывается.
            // z-10, чтобы вынутый модуль внутри лёг ПОВЕРХ соседних ячеек: они
            // идут дальше по разметке и иначе перекрыли бы его.
            <span
              key={i}
              aria-hidden
              className="relative z-10 rounded-[3px]"
              style={{
                background: "var(--brand-cream)",
                boxShadow: "inset 0 3px 7px rgba(20,24,22,.28)",
                ...cellStyle(i),
              }}
            >
              {/* Вынутый модуль — РЕБЁНОК гнезда (absolute inset-0), а не ещё
                  один элемент сетки. Так он получает ровно геометрию ячейки без
                  единого вычисления. Прошлый заход ставил ему gridColumn/gridRow:
                  элемент с явной позицией размещается ПЕРВЫМ и сдвигает все
                  автоматически размещённые ячейки на одну, из-за чего гнездо
                  уезжало в соседний столбец, а снизу отрастал пятый ряд. */}
              <span
                className="absolute inset-0 rounded-[4px] border-2 border-[color:var(--brand-cream)]"
                style={{
                  background: "var(--brand-moss)",
                  // В покое модуль СИДИТ В ГНЕЗДЕ (нулевой сдвиг, без тени) и
                  // выглядит обычной панелью стены. Потом выезжает и обзаводится
                  // тенью — тень появляется вместе с отрывом, а не заранее, иначе
                  // модуль с самого начала висел бы над плоскостью.
                  transform: on ? "translate(34%, -34%)" : "translate(0, 0)",
                  boxShadow: on ? "0 16px 26px -8px rgba(20,24,22,.5)" : "0 0 0 rgba(20,24,22,0)",
                  transition: reduced
                    ? "none"
                    : `transform .85s cubic-bezier(.16,1,.3,1) ${PULL_DELAY}s, box-shadow .85s ease-out ${PULL_DELAY}s`,
                }}
              />
            </span>
          ) : (
            <span
              key={i}
              className="rounded-[3px]"
              style={{
                background: TONES[(i * 5 + Math.floor(i / 4)) % 4],
                ...cellStyle(i),
                // opacity перебивает то, что положил cellStyle: у панели она 0.92,
                // а не 1. Порядок ключей здесь значим — спред идёт ВЫШЕ.
                opacity: on ? 0.92 : 0,
              }}
              aria-hidden
            />
          ),
        )}

        {/* Зерно мха поверх всей стены: без него сетка выглядит выкраской
            палитры, а не растительной поверхностью. multiply — чтобы тёмные
            модули не выцветали, а светлые получили фактуру. */}
        <MossTexture
          seed={17}
          density={220}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.28] mix-blend-multiply"
        />
      </div>
    </div>
  );
}

function AridRootZone() {
  const { ref, on, reduced } = useEnter<HTMLDivElement>();
  // Порядок кадров рассказывает историю схемы: сначала дерево, потом корни идут
  // в песок, и только затем в корневую зону ложится мат. То есть «вот задача —
  // вот что мы туда кладём», а не набор фигур, возникших одновременно.
  const ease = "cubic-bezier(.16,1,.3,1)";
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden rounded-xl bg-[color:var(--brand-cream)]">
      {/* Песок ниже уровня земли. Тон тёплый, но в пределах палитры: это
          затемнение крема, а не новый цвет. */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[62%]" style={{ background: "#E6E0D2" }} />
      <span aria-hidden className="absolute inset-x-0 bottom-[62%] h-px" style={{ background: "var(--brand-ink-20)" }} />
      {/* Зерно песка */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[62%]"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(20,24,22,.22) 0 1.1px, transparent 1.2px) 0 0/9px 9px",
        }}
      />
      {/* Дерево над землёй. Растёт из линии земли — transformOrigin по низу. */}
      <svg
        viewBox="0 0 200 120"
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-0 top-[4%] h-[36%] w-full"
        style={{
          transformOrigin: "bottom center",
          opacity: on ? 1 : 0,
          transform: on ? "scale(1)" : "scale(.86)",
          transition: reduced ? "none" : `opacity .5s ease-out .05s, transform .7s ${ease} .05s`,
        }}
        aria-hidden
      >
        <path d="M100 120 V64" stroke="var(--brand-ink)" strokeWidth={3.4} strokeLinecap="round" />
        <path d="M100 84 L84 70 M100 76 L116 62" stroke="var(--brand-ink)" strokeWidth={2.2} strokeLinecap="round" />
        <circle cx="100" cy="44" r="27" fill="var(--brand-moss)" />
        <circle cx="78" cy="56" r="16" fill="var(--brand-moss)" opacity=".85" />
        <circle cx="122" cy="55" r="14" fill="var(--brand-moss)" opacity=".85" />
      </svg>
      {/* Корни уходят сквозь мат в песок. Рисуются ДО мата, чтобы мат лёг
          поверх них: иначе корни проступали через подпись.
          Прорастают штриховкой: pathLength={1} нормирует длину контура к единице,
          поэтому dasharray/dashoffset задаются числом 1 и не зависят от реальной
          длины кривой — иначе под каждую пришлось бы мерить getTotalLength(). */}
      <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="absolute inset-x-0 top-[52%] h-[42%] w-full" aria-hidden>
        <g stroke="var(--brand-muted)" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity=".7">
          {[
            "M100 0 C 100 26, 84 40, 72 64",
            "M100 0 C 100 30, 116 44, 130 70",
            "M100 0 V 52 M100 30 C 92 42, 88 52, 86 70 M100 34 C 110 46, 112 58, 114 76",
          ].map((d, i) => (
            <path
              key={d}
              d={d}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={on ? 0 : 1}
              style={{
                transition: reduced ? "none" : `stroke-dashoffset .9s ease-out ${0.32 + i * 0.08}s`,
              }}
            />
          ))}
        </g>
      </svg>
      {/* Мат в корневой зоне — единственный подписанный элемент схемы, и подпись
          лежит ПРЯМО НА нём кремом. Раньше она стояла под матом и пересекалась с
          корнями. Заодно это тот же приём, что у подписи субстрата в схеме
          кровли: две соседние схемы подписаны одинаково. */}
      <span
        className="absolute left-[12%] right-[12%] top-[45%] flex h-[14%] items-center justify-center rounded-full px-3"
        style={{
          background: "var(--brand-moss)",
          // Мат ЛОЖИТСЯ на корневую зону: раскрывается от центра по горизонтали,
          // уже после того, как корни дорисовались. Растёт по X, а не всплывает
          // по Y, — так читается «уложили полосу», а не «прилетел прямоугольник».
          transformOrigin: "center",
          opacity: on ? 1 : 0,
          transform: on ? "scaleX(1)" : "scaleX(.55)",
          transition: reduced ? "none" : `opacity .4s ease-out 1.05s, transform .6s ${ease} 1.05s`,
        }}
      >
        <span className="label text-[10px] leading-none text-[color:var(--brand-cream)] sm:text-[11px]">
          Moisture-retaining mat
        </span>
      </span>
    </div>
  );
}

/**
 * Схема применения. Держит пропорцию слота под фото (16/10), чтобы при подмене
 * на настоящий кадр раскладка раздела не дрогнула.
 */
export function ApplicationDiagram({ kind, label }: { kind: "roof" | "wall" | "arid"; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ aspectRatio: "16/10" }}
      className="relative w-full overflow-hidden rounded-2xl border border-[color:var(--brand-line)]"
      // Та же светлая подложка, что у витрины материала в разделе «Why»: два
      // соседних раздела не должны выглядеть сделанными разными руками.
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 14%, #FBFAF6 0%, rgba(251,250,246,0) 68%), linear-gradient(180deg, var(--brand-cream) 0%, var(--brand-sage-15) 100%)",
        }}
      />
      <div className="relative h-full w-full p-4 sm:p-6">
        {kind === "roof" ? <RoofBuildUp /> : kind === "wall" ? <WallPanels /> : <AridRootZone />}
      </div>
    </div>
  );
}
