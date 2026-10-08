"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_PATHS } from "./sphagnum-logo";

/* Экран загрузки: логотип вычерчивается по контуру, по каждому контуру бежит «перо»
   с искрящимся шлейфом. Искры — по мотивам Canvas Sparkly Circle Loader
   (codepen.io/jackrugile/pen/poGOqy, MIT): та же спиральная частица и шлейф, но
   эмиттер идёт по путям логотипа, а палитра фирменная вместо радуги.
   Контур рисует CSS-анимация, поэтому он идёт с первого байта HTML, ещё до гидратации.
   Лоадер держится, пока не придёт window.load, но не меньше одной прорисовки (MIN_MS);
   SAFETY_MS — страховка на случай зависшего ресурса, чтобы сайт не остался закрытым. */

const DRAW_MS = 1800; // вычерчивание контура, совпадает с CSS
const LOOP_MS = 2600; // круг пера по контуру после прорисовки
const MIN_MS = 2100;
const SAFETY_MS = 15000;
const STEP_MS = 2200; // смена фраз
const PAD = 36; // поле холста вокруг логотипа под разлёт искр
const VIEW_W = 313;
const VIEW_H = 49;

type Particle = { x: number; y: number; angle: number; speed: number; accel: number; life: number };

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function SphagnumLoader({ label, srLabel, phrases }: { label: string; srLabel: string; phrases: string[] }) {
  const [step, setStep] = useState(0);
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  // Когда прятать: после window.load и не раньше конца первой прорисовки.
  useEffect(() => {
    const started = performance.now();
    let hideTimer = 0;
    const hide = () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setHiding(true), Math.max(0, MIN_MS - (performance.now() - started)));
    };
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
    const safety = window.setTimeout(hide, SAFETY_MS);
    const first = window.setTimeout(() => setStep(1), 100);
    const interval = window.setInterval(() => setStep((value) => value + 1), STEP_MS);
    return () => {
      window.removeEventListener("load", hide);
      [hideTimer, safety, first].forEach(window.clearTimeout);
      window.clearInterval(interval);
    };
  }, []);

  // Искры по контуру логотипа.
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !box || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const paths = pathRefs.current.filter((p): p is SVGPathElement => p !== null);
    const lengths = paths.map((p) => p.getTotalLength());
    const trails: Particle[][] = paths.map(() => []);
    const angles = paths.map((_, i) => i);
    let width = 0;
    let height = 0;
    let scale = 1;

    const resize = () => {
      const rect = box.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width + PAD * 2;
      height = rect.height + PAD * 2;
      scale = rect.width / VIEW_W;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "lighter";
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);

    // Размер искры и разгон — от ширины логотипа, чтобы на телефоне шлейф не был огромным.
    const radius = () => Math.max(1.2, 2.6 * (scale / 1.8));
    const started = performance.now();
    let frame = 0;
    let last = 0;
    let tick = 0;

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 1000 / 60) return;
      last = now;
      tick++;
      const elapsed = now - started;
      const progress =
        elapsed < DRAW_MS ? easeInOut(elapsed / DRAW_MS) : ((elapsed - DRAW_MS) % LOOP_MS) / LOOP_MS;

      ctx.clearRect(0, 0, width, height);
      paths.forEach((path, i) => {
        const point = path.getPointAtLength(lengths[i] * progress);
        const trail = trails[i];
        trail.push({ x: PAD + point.x * scale, y: PAD + point.y * scale, angle: angles[i], speed: 0, accel: 0.006 * scale, life: 1 });
        angles[i] += Math.PI / 3;

        for (let j = trail.length - 1; j >= 0; j--) {
          const p = trail[j];
          p.speed += p.accel;
          p.x += Math.cos(p.angle) * p.speed;
          p.y += Math.sin(p.angle) * p.speed;
          p.angle += Math.PI / 64;
          p.accel *= 1.01;
          p.life -= 0.035;
          if (p.life <= 0) trail.splice(j, 1);
        }

        trail.forEach((p, j) => {
          const color = `hsla(${38 + p.life * 14}, 88%, ${56 + p.life * 16}%, ${p.life})`;
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          const prev = trail[j - 1];
          if (prev) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(prev.x, prev.y);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.001, p.life * radius()), 0, Math.PI * 2);
          ctx.fill();
          const size = Math.random() * 1.25;
          const spread = 18 * p.life * (scale / 1.8);
          ctx.fillRect(~~(p.x + (Math.random() - 0.5) * spread), ~~(p.y + (Math.random() - 0.5) * spread), size, size);
        });
      });
      if (tick % 600 === 0) angles.forEach((_, i) => (angles[i] %= Math.PI * 2));
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  if (gone) return null;

  // Три фразы в DOM: уехавшая влево, текущая и следующая справа.
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
      <div ref={boxRef} className="sph-loader__logo">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden focusable="false">
          <g className="sph-loader__fill">
            {LOGO_PATHS.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <g className="sph-loader__outline">
            {LOGO_PATHS.map((d, i) => (
              <path
                key={d}
                d={d}
                ref={(node) => {
                  pathRefs.current[i] = node;
                }}
                pathLength={1}
              />
            ))}
          </g>
        </svg>
        <canvas ref={canvasRef} className="sph-loader__sparks" aria-hidden />
      </div>
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
  background: radial-gradient(ellipse at center, #10261b 0%, #06120c 70%);
  transition: opacity .6s ease, visibility .6s ease;
}
.sph-loader.is-hiding { opacity: 0; visibility: hidden; pointer-events: none; }
.sph-loader__logo { position: relative; width: min(520px, 78vw); aspect-ratio: ${VIEW_W} / ${VIEW_H}; }
.sph-loader__logo svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.sph-loader__sparks { position: absolute; left: -${PAD}px; top: -${PAD}px; pointer-events: none; }
.sph-loader__fill path { fill: #F5F4F0; opacity: 0; animation: sph-loader-fill .7s ease ${DRAW_MS - 500}ms forwards; }
.sph-loader__outline path {
  fill: none; stroke: #D7B15E; stroke-width: .45; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: sph-loader-draw ${DRAW_MS}ms ease-in-out forwards;
}
@keyframes sph-loader-draw { to { stroke-dashoffset: 0; } }
@keyframes sph-loader-fill { to { opacity: 1; } }
.sph-loader__messages {
  position: relative; overflow: hidden;
  width: min(400px, 90vw); height: 1.5em; margin-top: 34px;
  font-family: Arial, Helvetica, sans-serif; font-size: 16px; letter-spacing: .02em; color: rgba(244, 241, 234, .72);
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
  .sph-loader__outline path { animation: none; stroke-dashoffset: 0; }
  .sph-loader__fill path { animation: none; opacity: 1; }
  .sph-loader__messages p { transition: none; }
}
`;
