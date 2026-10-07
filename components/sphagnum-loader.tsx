"use client";

import { useEffect, useState } from "react";

/* Экран загрузки по мотивам tree-loader (codepen.io/lopis/pen/abqwyaV, MIT).
   Автор разрешает брать код, но НЕ рисунок деревьев — поэтому из пена взяты
   только механика (пружинящие силуэты с задержкой и уезжающие фразы), а
   силуэты нарисованы заново: кочка сфагнума, ель, лиственное дерево и росток,
   в цветах бренда.

   Лоадер есть в статическом HTML с первого байта и прячется по window.load —
   когда догрузились картинки первого экрана. Страховка: не дольше MAX_MS. */

const MIN_MS = 700;
const MAX_MS = 6000;
const STEP_MS = 2200;

export function SphagnumLoader({ label, srLabel, phrases }: { label: string; srLabel: string; phrases: string[] }) {
  const [step, setStep] = useState(0);
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const started = performance.now();
    let hideTimer = 0;
    const hide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setHiding(true), Math.max(0, MIN_MS - (performance.now() - started)));
    };
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
    const fallback = window.setTimeout(hide, MAX_MS);
    // Первая фраза въезжает сразу после гидратации, дальше — по таймеру.
    const first = window.setTimeout(() => setStep(1), 100);
    const interval = window.setInterval(() => setStep((value) => value + 1), STEP_MS);
    return () => {
      window.removeEventListener("load", hide);
      [hideTimer, fallback, first].forEach(window.clearTimeout);
      window.clearInterval(interval);
    };
  }, []);

  if (gone) return null;

  // Три фразы в DOM, как в оригинале: уехавшая влево, текущая и следующая справа.
  const visible = [step - 1, step, step + 1].filter((index) => index >= 0);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`sph-loader${hiding ? " is-hiding" : ""}`}
      onTransitionEnd={(event) => {
        if (hiding && event.target === event.currentTarget) setGone(true);
      }}
    >
      <style>{LOADER_CSS}</style>
      <svg className="sph-loader__plants" width="132" height="120" viewBox="0 0 147 134" fill="none" aria-hidden>
        {/* Кочка сфагнума: низкая подушка из округлых головок. */}
        <path
          className="p1"
          fill="#8AA18A"
          d="M2 132c-1-9 3-16 10-17-1-7 5-12 11-10 2-6 10-7 13-1 6-2 11 3 9 9 5 2 7 9 3 15-1 2-2 3-4 4H4c-1 0-2 0-2 0Z"
        />
        {/* Ель: три яруса и короткий ствол. */}
        <path
          className="p2"
          fill="#3E5042"
          d="M58 10 40 44h9L36 72h10L32 104h23v26c0 2 1 3 3 3h4c2 0 3-1 3-3v-26h23L74 72h10L71 44h9L62 10c-1-2-3-2-4 0Z"
        />
        {/* Лиственное дерево: округлая крона на тонком стволе. */}
        <path
          className="p3"
          fill="#D7B15E"
          d="M104 32c-15 0-24 11-22 23-8 4-11 13-7 21 3 7 11 10 19 9 2 0 4 2 4 4v42c0 1 1 2 2 2h8c1 0 2-1 2-2V89c0-2 2-4 4-4 8 1 16-2 19-9 4-8 1-17-7-21 2-12-7-23-22-23Z"
        />
        {/* Росток: стебель и два листа. */}
        <path
          className="p4"
          fill="#102B20"
          d="M136 132c-2 0-3-1-3-3 0-14 0-26 3-37-9 1-17-4-19-12 9-2 17 1 20 8 2-7 3-13 7-19-10-3-14-11-12-19 9 1 14 8 13 17-1 4-3 9-4 13-3 12-3 25-3 49 0 2-1 3-2 3Z"
        />
      </svg>
      <div className="sph-loader__messages" aria-hidden>
        {visible.map((index, position) => (
          <p key={index} data-pos={visible.length === 3 ? position : position + 1}>
            {phrases[index % phrases.length] ?? ""}
          </p>
        ))}
      </div>
      <span className="sph-loader__sr">{srLabel}</span>
    </div>
  );
}

const LOADER_CSS = `
.sph-loader {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #F5F4F0;
  transition: opacity .6s ease, visibility .6s ease;
}
.sph-loader.is-hiding { opacity: 0; visibility: hidden; pointer-events: none; }
.sph-loader__plants path { transform-box: fill-box; transform-origin: bottom; animation: sph-loader-bounce .8s infinite; }
.sph-loader__plants .p1 { animation-delay: .15s; }
.sph-loader__plants .p2 { animation-delay: .3s; }
.sph-loader__plants .p3 { animation-delay: .45s; }
.sph-loader__plants .p4 { animation-delay: .6s; }
@keyframes sph-loader-bounce {
  0% { transform: scaleY(1); }
  10% { transform: scaleY(1.2); }
  30% { transform: scaleY(.9); }
  40% { transform: scaleY(1); }
}
.sph-loader__messages {
  position: relative; overflow: hidden;
  width: min(400px, 90vw); height: 1.5em; margin-top: 18px;
  font-family: Arial, Helvetica, sans-serif; font-size: 18px; color: #3E5042;
}
.sph-loader__messages p {
  position: absolute; left: 0; width: 100%; margin: 0;
  line-height: 1.5; text-align: center; white-space: nowrap;
  transform: translateX(-200%);
  transition: transform 1s ease-in-out;
}
.sph-loader__messages p[data-pos="1"] { transform: translateX(0); }
.sph-loader__messages p[data-pos="2"] { transform: translateX(200%); }
.sph-loader__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (prefers-reduced-motion: reduce) {
  .sph-loader__plants path { animation: none; }
  .sph-loader__messages p { transition: none; }
}
`;
