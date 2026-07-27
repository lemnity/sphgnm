/**
 * Шрифты, палитра и анимации лендинга SPHAGNUM ECO.
 * Визуальный язык выровнен по референсу sempergreen.com (ТЗ: «по аналогу Sempergreen»).
 * Держим отдельным компонентом, чтобы страница оставалась переносимой:
 * ничего не нужно дописывать в globals.css принимающего проекта.
 */
export function SphagnumStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Work+Sans:wght@400;500;600&display=swap');

.sph {
  /*
    Палитра снята с референса: акцент — олива rgb(150,164,55).
    ВАЖНО про контраст: у Sempergreen белый текст лежит прямо на #96A437,
    а это 2.7:1 — провал даже по смягчённому порогу 3:1. Поэтому яркая олива
    осталась для заливок и КРУПНОГО текста, а под мелкий текст и кнопки
    заведён затемнённый --olive-ink (#5F6B22, белым по нему 6.2:1).
  */
  --ink: #22261E;
  --ink-deep: #14180F;
  --olive: #96A437;
  --olive-ink: #5F6B22;
  --olive-soft: #EDF1DC;
  --sand: #F4F4EF;
  --line: #E3E5DB;
  --muted: #5A6154;

  font-family: 'Work Sans', system-ui, sans-serif;
  font-size: 16px;
  color: var(--ink);
  background: #fff;
  overflow-x: clip; /* clip, а НЕ hidden: hidden создал бы скролл-контейнер и сломал якоря */
}

/* Заголовки — Archivo вместо платного Apparat: та же плотная гротескная подача
   в верхнем регистре, доступен в Google Fonts. */
.sph h1, .sph h2, .sph h3, .sph .display {
  font-family: 'Archivo', system-ui, sans-serif;
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.005em;
}
/* Точечное исключение: там, где верхний регистр мешает читать (длинные абзацы,
   пункты FAQ), нормальный регистр возвращается классом .normal-case-h */
.sph .normal-case-h { text-transform: none; letter-spacing: -0.01em; }

/* Кнопки референса — прямые углы, верхний регистр, жирные */
.sph .btn {
  /* display НЕ задаём: селектор .sph .btn перебивал бы утилиту hidden
     (специфичность 0,2,0 против 0,1,0), и кнопки, спрятанные до md,
     вылезали на мобильном. Раскладку даёт класс inline-flex на кнопке.
     ВНИМАНИЕ: это внутри template literal — обратные кавычки тут запрещены. */
  align-items: center; justify-content: center; gap: .6rem;
  font-family: 'Archivo', system-ui, sans-serif;
  font-weight: 700; text-transform: uppercase; letter-spacing: .02em;
  border-radius: 0;
  padding: 14px 21px;
  transition: background-color .2s, color .2s, border-color .2s;
}
.sph .btn-primary { background: var(--olive-ink); color: #fff; }
.sph .btn-primary:hover { background: var(--ink); }
.sph .btn-accent { background: var(--olive); color: var(--ink-deep); }
.sph .btn-accent:hover { background: #A8B845; }
.sph .btn-ghost { border: 2px solid currentColor; }

/* Якорная навигация из фиксированной шапки: без отступа заголовок уезжает под неё. */
.sph section[id] { scroll-margin-top: 116px; }

@keyframes sphFadeUp   { from { opacity:0; transform: translateY(30px); } to { opacity:1; transform:none; } }
@keyframes sphFadeIn   { from { opacity:0; } to { opacity:1; } }
@keyframes sphSlideL   { from { opacity:0; transform: translateX(-40px); } to { opacity:1; transform:none; } }
@keyframes sphSlideR   { from { opacity:0; transform: translateX(40px); } to { opacity:1; transform:none; } }
@keyframes sphScaleIn  { from { opacity:0; transform: scale(0.9); } to { opacity:1; transform:none; } }
@keyframes sphWord     { from { opacity:0; transform: translateY(100%); filter: blur(4px); }
                         to   { opacity:1; transform:none; filter: blur(0); } }

.sph .a-up     { animation: sphFadeUp  .8s cubic-bezier(.16,1,.3,1) both; }
.sph .a-in     { animation: sphFadeIn  .7s cubic-bezier(.16,1,.3,1) both; }
.sph .a-left   { animation: sphSlideL  .8s cubic-bezier(.16,1,.3,1) both; }
.sph .a-right  { animation: sphSlideR  .8s cubic-bezier(.16,1,.3,1) both; }
.sph .a-scale  { animation: sphScaleIn 1s  cubic-bezier(.16,1,.3,1) both; }

/* Пословное раскрытие заголовка. Контейнер обрезает, внутренний span выезжает.
   padding/margin снизу — запас под хвосты «у», «р», «д»: line-height тут меньше кегля. */
.sph .word { display:inline-block; overflow:hidden; padding-bottom:.14em; margin-bottom:-.14em; vertical-align:bottom; }
.sph .word > span { display:inline-block; animation: sphWord .7s cubic-bezier(.16,1,.3,1) both; }

/* Появление секций при прокрутке: до входа в кадр держим скрытым.
   Вариант движения задаётся data-anim — тот же набор, что и у входных анимаций. */
.sph .reveal { opacity: 0; }
.sph .reveal.in                    { animation: sphFadeUp  .8s cubic-bezier(.16,1,.3,1) both; }
.sph .reveal[data-anim="left"].in  { animation: sphSlideL  .8s cubic-bezier(.16,1,.3,1) both; }
.sph .reveal[data-anim="right"].in { animation: sphSlideR  .8s cubic-bezier(.16,1,.3,1) both; }
.sph .reveal[data-anim="scale"].in { animation: sphScaleIn 1s  cubic-bezier(.16,1,.3,1) both; }
.sph .reveal[data-anim="in"].in    { animation: sphFadeIn  .7s cubic-bezier(.16,1,.3,1) both; }

/* Горизонтальные въезды до широкого экрана превращаются в вертикальные: на планшете
   блок занимает почти всю ширину, и translateX(±40px) на время анимации распирал
   страницу — замер показывал 8px горизонтальной прокрутки. */
@media (max-width: 1023px) {
  .sph .reveal[data-anim="left"].in,
  .sph .reveal[data-anim="right"].in { animation: sphFadeUp .8s cubic-bezier(.16,1,.3,1) both; }
}

.sph .d1{animation-delay:.1s} .sph .d2{animation-delay:.2s} .sph .d3{animation-delay:.3s}
.sph .d4{animation-delay:.4s} .sph .d5{animation-delay:.5s} .sph .d6{animation-delay:.6s}
.sph .d7{animation-delay:.7s} .sph .d8{animation-delay:.8s}

@media (prefers-reduced-motion: reduce) {
  .sph .a-up, .sph .a-in, .sph .a-left, .sph .a-right, .sph .a-scale,
  .sph .word > span, .sph .reveal.in { animation: none; }
  .sph .reveal, .sph .reveal.in { opacity: 1; }
  .sph * { scroll-behavior: auto !important; }
}
`}</style>
  );
}

/**
 * Фирменный знак Sempergreen — две угловые скобки. На референсе он стоит
 * над заголовками секций и внутри логотипа; здесь тот же приём.
 */
export function CornerMark({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden focusable="false" fill="none">
      <path d="M2 12V2h10" stroke={color} strokeWidth="4" />
      <path d="M32 22v10H22" stroke={color} strokeWidth="4" />
    </svg>
  );
}
