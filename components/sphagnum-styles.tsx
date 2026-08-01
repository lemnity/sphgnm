/**
 * Шрифты, палитра и анимации лендинга SPHAGNUM ECO.
 * Визуальный язык выровнен по референсу sempergreen.com (ТЗ: «по аналогу Sempergreen»).
 * Держим отдельным компонентом, чтобы страница оставалась переносимой:
 * ничего не нужно дописывать в globals.css принимающего проекта.
 */
export function SphagnumStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Playfair+Display:wght@400;500;600;700&family=Work+Sans:wght@400;500;600&display=swap');

.sph {
  /*
    ── ФИРМЕННАЯ ПАЛИТРА (Brand Identity Guidebook v1.0, раздел «Цвет») ──
    Пропорция по гайду: Cream 65% · Ink 25% · Moss 10% · Sage только акцент.
    Гайд прямо запрещает «перекрашивать в любые цвета вне палитры», поэтому
    новые блоки берут ТОЛЬКО эти четыре токена.

    Контраст проверен (WCAG): Cream на Ink 16.2:1 · Sage на Ink 6.6:1 ·
    Cream на Moss 7.6:1 — все проходят AA даже для мелкого текста.
  */
  --brand-ink: #141816;
  --brand-cream: #F4F1EA;
  --brand-moss: #3E5042;
  --brand-sage: #8AA18A;
  /* Лайм — акцент из присланной палитры. Живёт на ТЁМНОМ: по Ink это 11.4:1,
     по Cream всего 1.5:1, так что на светлых секциях его быть не должно. */
  --brand-lime: #BAE14B;

  /*
    Приглушённые оттенки — ГОТОВЫМИ rgba, а не утилитой прозрачности Tailwind.
    Причина конкретная: запись вида text-[color:var(--brand-cream)]/85
    собирается в rgb(#F4F1EA / 0.85) — переменная хранит готовый hex, разложить
    его на каналы Tailwind не может. Значение невалидно, браузер выбрасывает всю
    декларацию, и цвет падает на унаследованный --ink: тёмный текст по тёмному
    фону, буквально невидимый. Ловилось скриншотом, а не типами.
    (Обратные кавычки в этом файле запрещены — он внутри template literal.)

    Контраст поверх Ink: cream-85 — 11.9:1, cream-72 — 8.8:1.
  */
  --brand-cream-85: rgba(244, 241, 234, .85);
  --brand-cream-72: rgba(244, 241, 234, .72);
  --brand-cream-15: rgba(244, 241, 234, .15);
  --brand-ink-85: rgba(20, 24, 22, .85);
  --brand-ink-45: rgba(20, 24, 22, .45);
  --brand-ink-20: rgba(20, 24, 22, .2);
  --brand-ink-10: rgba(20, 24, 22, .1);
  /* Приглушённый Sage под декоративный знак в фоне героя: в полную силу
     он на пол-экрана перебивал бы заголовок. */
  --brand-sage-45: rgba(138, 161, 138, .45);

  /*
    ── ПРОИЗВОДНЫЕ ПОД СВЕТЛЫЕ СЕКЦИИ ──
    Легаси-палитры (олива с референса Sempergreen) больше нет: весь макет
    переведён на четыре фирменных токена. Здесь только то, чего в гайде нет
    физически, — текст пониженной важности и разделительная линия. Оба взяты
    как затемнения Ink, а не как новые цвета, чтобы палитра осталась закрытой.

    ВАЖНО, откуда берётся акцент на светлом. Sage по Cream даёт 2.5:1 и для
    мелкого текста НЕ годится — это провал AA. Поэтому на светлых секциях
    акцент всегда Moss (8.7:1 по Cream), а Sage работает акцентом только по
    Ink (6.6:1). Перепутать местами нельзя: проверено расчётом контраста.

    --brand-muted по Cream: 7.4:1. Линия декоративная, порог к ней не применим.
  */
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

  font-family: 'Work Sans', system-ui, sans-serif;
  font-size: 16px;
  color: var(--brand-ink);
  background: var(--brand-cream);
  overflow-x: clip; /* clip, а НЕ hidden: hidden создал бы скролл-контейнер и сломал якоря */
}

/*
  ── ЗАГОЛОВКИ: ФИРМЕННАЯ АНТИКВА ──
  Раньше здесь стоял Archivo в верхнем регистре — подача с референса
  Sempergreen. Гайдбук описывает другую пару: антиква для заголовков,
  гротеск для текста, регистр СТРОЧНЫЙ (в самом гайде все заголовки набраны
  строчными). Первый экран уже был на антикве, секции ниже — нет, и страница
  читалась как два разных сайта. Теперь правило одно на весь макет.

  Archivo при этом остался — но только там, где он и уместен: мелкие капсовые
  метки (кикеры, глазки) и кнопки. Это класс .label и .btn.
*/
.sph h1, .sph h2, .sph h3, .sph .display {
  font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  text-transform: none;
  font-weight: 500;
  letter-spacing: -0.015em;
}
/* Класс сохранён: разметка ссылается на него в местах, где капс мешал читать.
   Теперь строчный регистр — поведение по умолчанию, и класс стал пустышкой,
   но удалять его из десятка мест ради нуля визуальной разницы незачем. */
.sph .normal-case-h { text-transform: none; letter-spacing: -0.015em; }

/* Мелкая капсовая метка — единственное место, где остаётся гротеск. */
.sph .label {
  font-family: 'Archivo', system-ui, sans-serif;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.14em;
}

/*
  ── ФИРМЕННАЯ АНТИКВА (гайд, раздел «Типографика») ──
  Гайд называет Georgia: «высокий контраст, классическая антиква». Georgia —
  системный шрифт Microsoft: на macOS и Windows он есть, а на Android НЕТ, и
  половина трафика получила бы произвольную подстановку. Поэтому берём Playfair
  Display — та же конструкция и заметно более выраженный контраст штриха,
  одинаково на всех платформах. Откатить на Georgia = заменить одну строку.

  Регистр НОРМАЛЬНЫЙ, а не верхний: в самом гайдбуке все заголовки набраны
  строчными («Мох, который держит воду»), и антиква в капсе с плотным трекингом
  теряет читаемость. Поэтому класс перебивает общее правило .sph h1/h2/h3.
*/
.sph .brand-serif {
  font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  text-transform: none;
  font-weight: 500;
  letter-spacing: -0.015em;
}

/* Кнопка на фирменном акценте: Sage-заливка, текст Ink — 6.6:1, проходит AA.
   Белый текст по Sage дал бы 2.5:1, поэтому текст именно тёмный. */
.sph .btn-sage { background: var(--brand-sage); color: var(--brand-ink); }
.sph .btn-sage:hover { background: #9CB19C; }

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
  font-family: 'Archivo', system-ui, sans-serif;
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
.sph section[id] { scroll-margin-top: 116px; }

/*
  ── ЗАЛИПАНИЕ ПЕРВОГО ЭКРАНА ──
  Секция вдвое выше экрана, внутренний слой прилипает к верху: первую половину
  прокрутки картинка стоит на месте и растёт знак, дальше экран уезжает обычным
  порядком. Высота задаётся классом, а не утилитой, чтобы её можно было снять
  медиа-запросом ниже.

  При отключённом движении залипание выключается целиком: пользователь, который
  просил меньше анимации, не должен упираться в экран, который «не скроллится».
  Кто-то воспримет это как зависшую страницу, а не как приём.
*/
@media (min-width: 1024px) {
  .sph .hero-pin { height: 200dvh; }
  .sph .hero-pin-inner { position: sticky; top: 0; height: 100dvh; }
}
/*
  ── «ВОДЯНАЯ БАТАРЕЙКА» ──
  Наполнение колбы идёт по прокрутке (useProgress), а эти три анимации живут
  по часам и не прекращаются: без них заполнившаяся колба замирает и читается
  картинкой, а не работающим накопителем.
*/
@keyframes sphWave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.sph .wb-wave { animation: sphWave 3.4s linear infinite; }

/* Пузырёк всплывает к поверхности. Анимируем bottom в ПРОЦЕНТАХ: колба меняет
   высоту по брейкпойнтам, а слой воды — ещё и по прокрутке, поэтому фиксированный
   translateY в px уносил бы пузырьки за уровень воды. */
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

/*
  ── ЛУЧИ СВЕТА НА МОХ ──
  Падают из правого верхнего угла на уступ. mix-blend-mode: screen, потому что
  свет должен ПРИБАВЛЯТЬСЯ к тёмному фону: обычная полупрозрачная заливка на
  Ink давала грязно-серые полосы вместо свечения.

  Поворот сидит ВНУТРИ ключевых кадров и берётся из --rot. Если задать его
  инлайновым transform, анимация transform его перезапишет, и веер схлопнется
  в вертикальный пучок.
*/
.sph .light-rays { inset: 0; overflow: hidden; mix-blend-mode: screen; }

.sph .light-rays .ray {
  position: absolute; top: -24%; right: 13%; height: 132%;
  transform-origin: 50% 0;
  border-radius: 999px;
  background: linear-gradient(180deg,
    rgba(186,225,75,.62) 0%, rgba(186,225,75,.2) 40%, rgba(186,225,75,0) 78%);
  /* Размытие маленькое НАМЕРЕННО: на 11px соседние столбы сливались в одно
     зарево, и вместо лучей получалось просто светлое пятно в углу. */
  filter: blur(6px);
  /* Сглаживание синусоидой, а не ease-in-out: у последнего заметны остановки
     в крайних точках, и луч на них «клюёт». Здесь скорость меняется плавно,
     петля читается непрерывной. */
  animation-name: sphRay;
  animation-timing-function: cubic-bezier(.37, 0, .63, 1);
  animation-iteration-count: infinite;
}
/*
  Кадры 0% и 100% одинаковые — иначе на стыке петли будет рывок.
  Амплитуды намеренно маленькие: свет должен ЖИТЬ, а не мигать. Прозрачность
  ходит 72–100% (было 50–100 и читалось пульсом), ширина ±6%, плюс лёгкий
  разворот на ±--sw — он и даёт ощущение текучести, которого одна прозрачность
  не давала.
*/
@keyframes sphRay {
  0%   { opacity: calc(var(--ro) * .72); transform: rotate(calc(var(--rot) - var(--sw))) scaleX(.94); }
  50%  { opacity: var(--ro);             transform: rotate(calc(var(--rot) + var(--sw))) scaleX(1.06); }
  100% { opacity: calc(var(--ro) * .72); transform: rotate(calc(var(--rot) - var(--sw))) scaleX(.94); }
}

/* Источник: мягкое пятно у самого угла, иначе лучи начинаются ниоткуда. */
.sph .light-source {
  position: absolute; top: -12%; right: 1%; width: 20vw; height: 20vw;
  border-radius: 999px;
  /* Пятно только обозначает исток. Крупное и яркое, оно перебивало сами лучи
     и заливало шапку жёлтым. */
  background: radial-gradient(circle, rgba(186,225,75,.13) 0%, rgba(186,225,75,.04) 45%, rgba(186,225,75,0) 70%);
  filter: blur(12px);
  animation: sphGlow 26s cubic-bezier(.37, 0, .63, 1) infinite;
}
/* Исток дышит ВТРОЕ медленнее лучей и почти незаметно: совпади он с ними по
   темпу — весь угол мигал бы разом, и вместо света получился бы маячок. */
@keyframes sphGlow { 0%, 100% { opacity: .82; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } }

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

/* Горизонтальные въезды до широкого экрана превращаются в вертикальные: на планшете
   блок занимает почти всю ширину, и translateX(±40px) на время анимации распирал
   страницу — замер показывал 8px горизонтальной прокрутки. */
@media (max-width: 1023px) {
  .sph .reveal[data-anim="left"].in,
  .sph .reveal[data-anim="right"].in { animation: sphFadeUp .8s cubic-bezier(.16,1,.3,1) both; }
}

/*
  ── ЖИВНОСТЬ НАД МОХОВЫМ УСТУПОМ ──
  Светлячки, бабочка и мотыльки. Анимируются ТОЛЬКО transform и opacity: оба
  свойства композитор считает без пересчёта раскладки, поэтому десяток
  бесконечных циклов не отъедает кадры у прокрутки (а она несёт залипание героя).

  Движение собрано из ДВУХ вложенных слоёв, а не из одной анимации:
    .drift — разлёт от общей точки, у каждого своё направление;
    .orbit — круг вокруг этой же точки.
  Обе крутятся всегда, а переключение режимов идёт амплитудами (--dx/--dy и
  --orb), которые считает React от прогресса прорастания. Так «разлетелись» и
  «кружат вокруг ростка» — это плавная растяжка одного движения, тогда как смена
  самих keyframes на пороге давала бы рывок с потерей фазы.

  Общая точка у всех одна — центр ростка. Пока ростка нет, разброс задаёт только
  дрейф, поэтому рой выглядит рассеянным; когда росток вычерчен, дрейф гаснет,
  и все сходятся на орбиты разного радиуса вокруг него.
*/
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

/*
  ── «ВОДЯНАЯ БАТАРЕЙКА» ──
  Наполнение колбы идёт по прокрутке (useProgress), а эти три анимации живут
  по часам и не прекращаются: без них заполнившаяся колба замирает и читается
  картинкой, а не работающим накопителем.
*/
@keyframes sphWave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.sph .wb-wave { animation: sphWave 3.4s linear infinite; }

/* Пузырёк всплывает к поверхности. Анимируем bottom в ПРОЦЕНТАХ: колба меняет
   высоту по брейкпойнтам, а слой воды — ещё и по прокрутке, поэтому фиксированный
   translateY в px уносил бы пузырьки за уровень воды. */
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

/*
  ── ЛУЧИ СВЕТА НА МОХ ──
  Падают из правого верхнего угла на уступ. mix-blend-mode: screen, потому что
  свет должен ПРИБАВЛЯТЬСЯ к тёмному фону: обычная полупрозрачная заливка на
  Ink давала грязно-серые полосы вместо свечения.

  Поворот сидит ВНУТРИ ключевых кадров и берётся из --rot. Если задать его
  инлайновым transform, анимация transform его перезапишет, и веер схлопнется
  в вертикальный пучок.
*/
.sph .light-rays { inset: 0; overflow: hidden; mix-blend-mode: screen; }

.sph .light-rays .ray {
  position: absolute; top: -24%; right: 13%; height: 132%;
  transform-origin: 50% 0;
  border-radius: 999px;
  background: linear-gradient(180deg,
    rgba(186,225,75,.62) 0%, rgba(186,225,75,.2) 40%, rgba(186,225,75,0) 78%);
  /* Размытие маленькое НАМЕРЕННО: на 11px соседние столбы сливались в одно
     зарево, и вместо лучей получалось просто светлое пятно в углу. */
  filter: blur(6px);
  /* Сглаживание синусоидой, а не ease-in-out: у последнего заметны остановки
     в крайних точках, и луч на них «клюёт». Здесь скорость меняется плавно,
     петля читается непрерывной. */
  animation-name: sphRay;
  animation-timing-function: cubic-bezier(.37, 0, .63, 1);
  animation-iteration-count: infinite;
}
/*
  Кадры 0% и 100% одинаковые — иначе на стыке петли будет рывок.
  Амплитуды намеренно маленькие: свет должен ЖИТЬ, а не мигать. Прозрачность
  ходит 72–100% (было 50–100 и читалось пульсом), ширина ±6%, плюс лёгкий
  разворот на ±--sw — он и даёт ощущение текучести, которого одна прозрачность
  не давала.
*/
@keyframes sphRay {
  0%   { opacity: calc(var(--ro) * .72); transform: rotate(calc(var(--rot) - var(--sw))) scaleX(.94); }
  50%  { opacity: var(--ro);             transform: rotate(calc(var(--rot) + var(--sw))) scaleX(1.06); }
  100% { opacity: calc(var(--ro) * .72); transform: rotate(calc(var(--rot) - var(--sw))) scaleX(.94); }
}

/* Источник: мягкое пятно у самого угла, иначе лучи начинаются ниоткуда. */
.sph .light-source {
  position: absolute; top: -12%; right: 1%; width: 20vw; height: 20vw;
  border-radius: 999px;
  /* Пятно только обозначает исток. Крупное и яркое, оно перебивало сами лучи
     и заливало шапку жёлтым. */
  background: radial-gradient(circle, rgba(186,225,75,.13) 0%, rgba(186,225,75,.04) 45%, rgba(186,225,75,0) 70%);
  filter: blur(12px);
  animation: sphGlow 26s cubic-bezier(.37, 0, .63, 1) infinite;
}
/* Исток дышит ВТРОЕ медленнее лучей и почти незаметно: совпади он с ними по
   темпу — весь угол мигал бы разом, и вместо света получился бы маячок. */
@keyframes sphGlow { 0%, 100% { opacity: .82; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } }

@media (prefers-reduced-motion: reduce) {
  .sph .a-up, .sph .a-in, .sph .a-left, .sph .a-right, .sph .a-scale,
  .sph .word > span, .sph .reveal.in { animation: none; }
  .sph .reveal, .sph .reveal.in { opacity: 1; }
  .sph * { scroll-behavior: auto !important; }
  /* Живность замирает целиком. Светлячки при этом ПРЯЧУТСЯ, а не застывают:
     их keyframes стартуют с opacity 0, и без анимации остались бы висеть
     статичные точки без всякого смысла. Бабочка просто перестаёт махать. */
  .sph .butterfly, .sph .wing, .sph .drift, .sph .orbit { animation: none; }
  .sph .firefly { animation: none; opacity: 0; }

  /* «Водяная батарейка» и лучи. Пузырьки, как и светлячки, ПРЯЧУТСЯ, а не
     застывают: их keyframes стартуют с opacity 0, и без анимации в колбе
     повисли бы неподвижные точки. Волна, капля и лучи просто замирают —
     их статичное состояние осмысленно. */
  /* Селектор луча ПОЛНЫЙ (.light-rays .ray), а не короткий: базовое правило
     состоит из трёх классов, и «.sph .ray» проигрывало ему по специфичности —
     луч продолжал мигать при включённом «меньше движения». */
  .sph .wb-wave, .sph .wb-drop, .sph .light-rays .ray, .sph .light-source { animation: none; }
  .sph .wb-bubble { animation: none; opacity: 0; }
}
`}</style>
  );
}

