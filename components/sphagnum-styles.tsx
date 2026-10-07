/**
 * Шрифт, палитра и анимации лендинга. Отдельным компонентом, чтобы страница
 * не требовала правок в globals.css.
 */
export function SphagnumStyles() {
  return (
    <style>{`
.sph {
  --font-reference: Arial, Helvetica, sans-serif;
  /* Фирменная палитра (гайдбук, раздел «Цвет»): Cream 65% · Ink 25% · Moss 10%,
       Sage — только акцент. Cream/Ink 16.2:1, Sage/Ink 6.6:1, Cream/Moss 7.6:1. */
  --brand-ink: #102b20;
  --brand-cream: #F5F4F0;
  --brand-moss: #3E5042;
  --brand-sage: #8AA18A;
  /* Лайм — акцент из присланной палитры. Живёт на ТЁМНОМ: по Ink это 11.4:1,
     по Cream всего 1.5:1, так что на светлых секциях его быть не должно. */
  --brand-lime: #BAE14B;

  /* Приглушённые оттенки — готовыми rgba: запись text-[color:var(--brand-cream)]/85
       невалидна (в переменной hex), и браузер выбрасывает декларацию целиком.
       Обратные кавычки в этом файле нельзя: он внутри template literal. */
  --brand-cream-85: rgba(244, 241, 234, .85);
  --brand-cream-72: rgba(244, 241, 234, .72);
  --brand-cream-15: rgba(244, 241, 234, .15);
  --brand-ink-85: rgba(20, 24, 22, .85);
  --brand-ink-45: rgba(20, 24, 22, .45);
  --brand-ink-20: rgba(20, 24, 22, .2);
  --brand-ink-10: rgba(20, 24, 22, .1);
  /* Приглушённый Sage. Держим как готовый уровень палитры под декоративную
     графику в фоне: в полную силу Sage на пол-экрана перебивает заголовок. */
  --brand-sage-45: rgba(138, 161, 138, .45);

  /* Золото — исключение из палитры: прорастающий знак, кнопка героя, полоса «53,000 km²».
       Текстом — только на тёмном (по Ink 8.4:1, по Cream 1.9:1), заливкой — с тёмным
       текстом (Ink 8.8:1). gold-light/deep — стопы градиента полосы, gold-line — её линейка. */
  --brand-gold: #D7B15E;
  --brand-gold-62: rgba(215, 177, 94, .62);
  --brand-gold-light: #E3C079;
  --brand-gold-deep: #CDA451;
  --brand-gold-line: rgba(20, 24, 22, .18);

  /* Производные под светлые секции — затемнения Ink, а не новые цвета. Акцент на светлом —
       Moss (8.7:1 по Cream): Sage по Cream даёт 2.5:1 и проваливает AA. */
  --brand-muted: #4A554E;
  --brand-line: #DEDACF;

  /* Готовые rgba под Sage — по той же причине, что и cream-* выше: запись
     bg-[color:var(--brand-sage)]/15 невалидна и роняет всю декларацию. */
  --brand-sage-40: rgba(138, 161, 138, .4);
  --brand-moss-40: rgba(62, 80, 66, .4);
  --brand-moss-10: rgba(62, 80, 66, .1);
  --brand-ink-90: rgba(20, 24, 22, .9);
  --brand-sage-15: rgba(138, 161, 138, .15);
  --brand-cream-07: rgba(244, 241, 234, .07);
  --brand-cream-04: rgba(244, 241, 234, .04);

  font-family: var(--font-reference);
  font-size: 16px;
  color: var(--brand-ink);
  background: var(--brand-cream);
  overflow-x: clip; /* clip, а НЕ hidden: hidden создал бы скролл-контейнер и сломал якоря */
}

/* Общий шрифт PDF-референса; иерархия задаётся размером и насыщенностью. */
.sph h2, .sph h3, .sph h4, .sph .display {
  font-family: var(--font-reference);
  text-transform: none;
  font-weight: 600;
  letter-spacing: -0.015em;
}
.sph h2.portfolio-title { font-weight: 400; }
/* Класс-пустышка: строчный регистр теперь по умолчанию, разметка на него ещё ссылается. */
.sph .normal-case-h { text-transform: none; letter-spacing: -0.015em; }

/* Общий шрифт PDF-референса; иерархия задаётся размером и насыщенностью. */
.sph .label {
  font-family: var(--font-reference);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.14em;
}

/* Общий шрифт PDF-референса; иерархия задаётся размером и насыщенностью. */
.sph .brand-serif {
  font-family: var(--font-reference);
  text-transform: none;
  font-weight: 500;
  letter-spacing: -0.015em;
}

/* Кнопка на фирменном акценте: Sage-заливка, текст Ink — 6.6:1, проходит AA.
   Белый текст по Sage дал бы 2.5:1, поэтому текст именно тёмный. */
.sph .btn-sage { background: var(--brand-sage); color: var(--brand-ink); }
.sph .btn-sage:hover { background: #9CB19C; }

/* Кнопка героя: текст Ink по золоту 8.8:1 (Cream дал бы 1.8:1). */
.sph .btn-gold { background: var(--brand-gold); color: var(--brand-ink); }
.sph .btn-gold:hover { background: #E2C078; }

/* Золотая полоса «53,000 km²»: градиент внутри одного тона, иначе сплошная заливка
   выглядит пластиком. Стопы подобраны по контрасту (ink-85 в тёмном углу — 5.94:1),
   темнее не делать. Прозрачный стоп — rgba золота, а не transparent: тот даёт серую кайму. */
.sph .band-gold {
  background:
    radial-gradient(115% 85% at 10% 0%, var(--brand-gold-light) 0%, rgba(227, 192, 121, 0) 60%),
    linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold) 45%, var(--brand-gold-deep) 100%);
}

/* Moss под кнопку в шапке: Cream по нему 7.6:1. */
.sph .btn-moss { background: var(--brand-moss); color: var(--brand-cream); }
.sph .btn-moss:hover { background: var(--brand-ink); }

/* Кнопки референса — прямые углы, верхний регистр, жирные */
.sph .btn {
  /* display НЕ задаём: селектор .sph .btn перебивал бы утилиту hidden
     (специфичность 0,2,0 против 0,1,0), и кнопки, спрятанные до md,
     вылезали на мобильном. Раскладку даёт класс inline-flex на кнопке.
     ВНИМАНИЕ: это внутри template literal — обратные кавычки тут запрещены. */
  align-items: center; justify-content: center; gap: .6rem;
  font-family: var(--font-reference);
  font-weight: 700; text-transform: uppercase; letter-spacing: .02em;
  border-radius: 0;
  padding: 14px 21px;
  transition: background-color .2s, color .2s, border-color .2s;
}
.sph .btn-primary { background: var(--brand-moss); color: var(--brand-cream); }
.sph .btn-primary:hover { background: var(--brand-ink); }
.sph .btn-accent { background: var(--brand-sage); color: var(--brand-ink); }
.sph .btn-accent:hover { background: #9CB19C; }
.sph .btn-ghost { border: 2px solid currentColor; }

/* Якорная навигация из фиксированной шапки: без отступа заголовок уезжает под неё. */
.sph section[id] { scroll-margin-top: 82px; }
.sph [data-reference-visual="portfolio-botanical"],
.sph [data-reference-visual="portfolio-dots"] { filter: contrast(1.2); }

/* Единая контентная сетка макета: 1550px на референсной ширине 1685px,
   безопасные поля на tablet/mobile. Фоны секций при этом остаются full-bleed. */
.sph .pdf-grid,
.sph .solutions-reference-grid {
  width: 100%;
  max-width: 1550px;
  margin-inline: auto;
  padding-inline: 20px;
}

.sph .solution-frame:first-child article { background: #f5f4f0; }
.sph .living-wall-frame { overflow: visible; }
.sph .living-wall-frame img {
  /* В фон секции растворяется только пустое поле под листьями. */
  mask-image: linear-gradient(to bottom, #000 94%, transparent 100%);
}
@media (min-width: 1024px) {
  .sph .living-wall-frame img {
    width: min(108%, calc(100vw - 24px));
    max-width: none;
    margin-left: 50%;
    transform: translateX(-50%);
  }
}
.sph .solution-frame:nth-child(2) article { background: #f1f2ed; }
.sph .solution-frame [data-solution-image] { mix-blend-mode: normal; }
.sph .solution-frame article { color: var(--brand-ink); }
.sph .solution-frame [data-solution-copy] h3,
.sph .solution-frame .label { font-family: inherit; }
.sph .solution-frame [data-solution-copy] li { color: #4e5350; }

/* Карточка масштабирует композицию целиком, включая шрифт и отступы;
   иллюстрация занимает свою правую зону, вне текста. */
@media (min-width: 1280px) {
  .sph .solution-frame { container-type: inline-size; }
  .sph .solution-frame article {
    min-height: 74.17cqw;
    padding: 4.24cqw;
    padding-top: 3.45cqw;
    border-color: #eeede5;
    box-shadow: 0 10px 22px rgba(20,24,22,.07);
  }
  .sph [data-solution-copy] > div { max-width: 100%; gap: 3cqw; }
  .sph [data-solution-icon] { width: 8.48cqw; height: 8.48cqw; }
  .sph [data-solution-icon] svg { width: 4.24cqw; height: 4.24cqw; }
  .sph [data-solution-kicker] {
    font-size: 2.12cqw;
    letter-spacing: 0;
    white-space: nowrap;
  }
  .sph [data-solution-copy] h3 {
    font-size: 4.5cqw;
    line-height: 1.14;
    max-width: 64%;
    white-space: nowrap;
    margin-top: 2.65cqw;
  }
  .sph [data-solution-copy] > span { margin-top: 3.18cqw; }
  .sph [data-solution-copy] > p:not(.label) {
    font-size: 2.12cqw;
    max-width: 51%;
    margin-top: 3.18cqw;
  }
  .sph [data-solution-copy] > p.label {
    font-size: 2.12cqw;
    letter-spacing: 0;
    margin-top: 4.5cqw;
  }
  .sph [data-solution-copy] ul { max-width: 64%; gap: 1.85cqw; margin-top: 2.12cqw; }
  .sph [data-solution-copy] li { font-size: 2.12cqw; gap: 2.12cqw; }
  .sph [data-solution-copy] li svg { width: 2.38cqw; height: 2.38cqw; }
  .sph .solution-frame [data-solution-image] {
    width: 47%;
    height: auto;
    bottom: 2.65cqw;
    object-fit: contain;
    transform: none;
  }
  .sph [data-solution-copy] > span { background: #8bab44; }
  .sph .solution-frame:nth-child(2) [data-solution-image] { bottom: 4.5cqw; }
  .sph .solution-frame:nth-child(2) [data-solution-copy] > p:not(.label) { max-width: 55%; }
}

.sph [data-vine-branch] {
  transform: translate3d(var(--vine-x, 0px), var(--vine-y, 0px), 0) rotate(var(--vine-rotate, 0deg));
  transition: transform var(--vine-duration, 520ms) cubic-bezier(.2, .75, .25, 1);
  will-change: transform;
}

@media (prefers-reduced-motion: reduce), (hover: none), (pointer: coarse) {
  .sph [data-vine-branch] {
    transform: none !important;
    transition: none;
    will-change: auto;
  }
}
@media (min-width: 640px) {
  .sph .pdf-grid, .sph .solutions-reference-grid { padding-inline: 32px; }
}
@media (min-width: 1024px) {
  .sph .pdf-grid, .sph .solutions-reference-grid {
    width: calc(100% - 80px);
    padding-inline: 0;
  }
}

/* Первый экран — ровно в высоту окна. */
.sph .hero-pin { height: auto; }
.sph .hero-pin-inner { position: relative; min-height: 100dvh; }
.sph .hide-scrollbar { scrollbar-width: none; }
.sph .hide-scrollbar::-webkit-scrollbar { display: none; }
/* «Водяная батарейка» (WaterBattery, сейчас на странице не используется). */
@keyframes sphWave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.sph .wb-wave { animation: sphWave 3.4s linear infinite; }

/* bottom в процентах: высота колбы меняется, translateY в px уносил бы пузырьки из воды. */
@keyframes sphBubble {
  0%   { bottom: 0%;  opacity: 0; transform: scale(.4); }
  15%  { opacity: .75; }
  80%  { opacity: .5; }
  100% { bottom: 94%; opacity: 0; transform: scale(1); }
}
.sph .wb-bubble {
  position: absolute; bottom: 0; border-radius: 999px; opacity: 0;
  background: radial-gradient(circle at 34% 32%, rgba(255,255,255,.9), rgba(255,255,255,.35) 62%, rgba(255,255,255,0) 70%);
  animation-name: sphBubble; animation-timing-function: ease-in; animation-iteration-count: infinite;
}

/* Капля в кольце: медленный вдох-выдох, чтобы правая половина блока не была мёртвой. */
@keyframes sphDrop { 0%, 100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.09); opacity: 1; } }
.sph .wb-drop { animation: sphDrop 3.8s ease-in-out infinite; }

/* Контейнеры шейдерных лучей и мохового холста (сейчас на странице не используются).
   screen прибавляет свет к фону, а не закрашивает его. */
.sph .moss-backdrop { display: block; width: 100%; height: 100%; mix-blend-mode: screen; opacity: .85; }

.sph .light-rays { inset: 0; overflow: hidden; mix-blend-mode: screen; }
.sph .light-rays-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

/* Пылинки в луче: без ореола (иначе это светлячок), почти без падения. */
.sph .mote {
  position: absolute; border-radius: 999px;
  background: rgba(255,252,240,.92);
  filter: blur(.5px);
  opacity: 0;
  animation-name: sphMote;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  /* will-change не ставить: двенадцать слоёв внутри группы screen просаживали прокрутку. */
}
@keyframes sphMote {
  0%   { opacity: 0; transform: translate3d(0, 0, 0); }
  22%  { opacity: var(--mo); }
  74%  { opacity: calc(var(--mo) * .7); }
  100% { opacity: 0; transform: translate3d(var(--mx), var(--my), 0); }
}

@media (prefers-reduced-motion: reduce) {
  .sph .hero-pin { height: auto; }
  .sph .hero-pin-inner { position: static; height: auto; min-height: 100dvh; }
}

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

/* До lg горизонтальные въезды — вертикальные: translateX(±40px) давал горизонтальную прокрутку. */
@media (max-width: 1023px) {
  .sph .reveal[data-anim="left"].in,
  .sph .reveal[data-anim="right"].in { animation: sphFadeUp .8s cubic-bezier(.16,1,.3,1) both; }
}

/* Дети .stagger выезжают по очереди только после .in у родителя: анимация прямо на детях
   отыграла бы при монтировании, пока блок ещё прозрачен. Задержки — до пятой строки. */
.sph .reveal.in .stagger > *              { animation: sphFadeUp .55s cubic-bezier(.16,1,.3,1) both; }
.sph .reveal.in .stagger > *:nth-child(1) { animation-delay: .10s; }
.sph .reveal.in .stagger > *:nth-child(2) { animation-delay: .19s; }
.sph .reveal.in .stagger > *:nth-child(3) { animation-delay: .28s; }
.sph .reveal.in .stagger > *:nth-child(4) { animation-delay: .37s; }
.sph .reveal.in .stagger > *:nth-child(n+5) { animation-delay: .46s; }

/* Образец мха парит над своей тенью: две петли в противофазе. Тень держит translateX(-50%)
   прямо в keyframes — анимация перебивает transform из класса Tailwind. */
@keyframes sphLedgeFloat {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(0, -11px, 0); }
}
@keyframes sphLedgeShade {
  0%, 100% { transform: translateX(-50%) scaleX(1);   opacity: 1; }
  50%      { transform: translateX(-50%) scaleX(.88); opacity: .7; }
}
.sph .ledge-float { animation: sphLedgeFloat 7.5s ease-in-out infinite; will-change: transform; }
.sph .ledge-shade { animation: sphLedgeShade 7.5s ease-in-out infinite; will-change: transform, opacity; }

/* Светлячки, бабочка и мотыльки: только transform и opacity, чтобы не отнимать кадры
   у прокрутки. Движение из двух слоёв (.drift — разлёт, .orbit — круг); режимы
   переключаются амплитудами из React, а не сменой keyframes — без рывка. */
@keyframes sphDrift {
  0%, 100% { transform: translate3d(0, 0, 0); }
  25%      { transform: translate3d(var(--dx), calc(var(--dy) * -1), 0); }
  50%      { transform: translate3d(calc(var(--dx) * .28), calc(var(--dy) * .55), 0); }
  75%      { transform: translate3d(calc(var(--dx) * -.8), calc(var(--dy) * -.45), 0); }
}

/* Восемь точек, а не четыре: по четырём получается ромб, а не круг. */
@keyframes sphOrbit {
  0%     { transform: translate3d(var(--orb), 0, 0); }
  12.5%  { transform: translate3d(calc(var(--orb) * .707), calc(var(--orb) * -.707), 0); }
  25%    { transform: translate3d(0, calc(var(--orb) * -1), 0); }
  37.5%  { transform: translate3d(calc(var(--orb) * -.707), calc(var(--orb) * -.707), 0); }
  50%    { transform: translate3d(calc(var(--orb) * -1), 0, 0); }
  62.5%  { transform: translate3d(calc(var(--orb) * -.707), calc(var(--orb) * .707), 0); }
  75%    { transform: translate3d(0, var(--orb), 0); }
  87.5%  { transform: translate3d(calc(var(--orb) * .707), calc(var(--orb) * .707), 0); }
  100%   { transform: translate3d(var(--orb), 0, 0); }
}

.sph .drift { position: absolute; display: block; animation: sphDrift ease-in-out infinite; will-change: transform; }
.sph .orbit { display: block; animation: sphOrbit linear infinite; will-change: transform; }

/* Мерцание вынесено на саму точку: на слоях выше живёт transform, а смешивать
   в одних keyframes движение и прозрачность значит связать их периоды. */
@keyframes sphGlow {
  0%, 100% { opacity: .15; transform: scale(.6); }
  45%      { opacity: .95; transform: scale(1); }
}
.sph .firefly {
  display: block;
  border-radius: 9999px;
  background: var(--brand-cream);
  /* Свечение — это и есть светлячок; без ореола точка читается как пылинка. */
  box-shadow: 0 0 6px 1px rgba(244, 241, 234, .55), 0 0 14px 3px rgba(138, 161, 138, .35);
  animation: sphGlow ease-in-out infinite;
}

/* Взмах крыла: сжатие поперёк, ось — линия тела. Так плоское крыло читается
   как повёрнутое в перспективе, без 3D-трансформаций и perspective на предке. */
@keyframes sphWing {
  0%, 100% { transform: scaleX(1); }
  50%      { transform: scaleX(.28); }
}
/* transform-box: fill-box обязателен — иначе процентный origin у SVG-фигуры
   считается от системы координат всего документа, и крыло улетает вбок. */
.sph .wing { transform-box: fill-box; animation: sphWing 1.6s ease-in-out infinite; }
.sph .wing-l { transform-origin: 100% 50%; }
.sph .wing-r { transform-origin: 0% 50%; animation-delay: -.04s; }

/* Бабочка сидит, но чуть переступает — иначе при живых крыльях тело выглядит приклеенным. */
@keyframes sphPerch {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50%      { transform: translate3d(0, -4%, 0) rotate(-1.6deg); }
}
.sph .butterfly { animation: sphPerch 3.2s ease-in-out infinite; }
/* У летящих покачивание сидящей отключено: две анимации на вложенных узлах
   складывались бы и давали дёрганый полёт. */
.sph .drift .butterfly { animation: none; }

.sph .d1{animation-delay:.1s} .sph .d2{animation-delay:.2s} .sph .d3{animation-delay:.3s}
.sph .d4{animation-delay:.4s} .sph .d5{animation-delay:.5s} .sph .d6{animation-delay:.6s}
.sph .d7{animation-delay:.7s} .sph .d8{animation-delay:.8s}

@media (prefers-reduced-motion: reduce) {
  .sph .a-up, .sph .a-in, .sph .a-left, .sph .a-right, .sph .a-scale,
  .sph .word > span, .sph .reveal.in { animation: none; }
  .sph .reveal, .sph .reveal.in { opacity: 1; }
  .sph * { scroll-behavior: auto !important; }
  /* animation:none снимает и заливку both — строки остаются с opacity 1. */
  .sph .reveal.in .stagger > * { animation: none; }
  /* Образец мха садится на тень; сдвиг тени остаётся из класса Tailwind. */
  .sph .ledge-float, .sph .ledge-shade { animation: none; }
  /* Светлячки прячутся, а не застывают: их keyframes стартуют с opacity 0. */
  .sph .butterfly, .sph .wing, .sph .drift, .sph .orbit { animation: none; }
  .sph .firefly { animation: none; opacity: 0; }

  /* Пузырьки прячутся по той же причине; волна и капля просто замирают. */
  .sph .wb-wave, .sph .wb-drop { animation: none; }
  .sph .wb-bubble { animation: none; opacity: 0; }
  /* Пылинки прячутся: keyframes стартуют с opacity 0. */
  .sph .mote { animation: none; opacity: 0; }
}
`}</style>
  );
}
