/**
 * Стили обложки «живая стена».
 *
 * Отдельным компонентом со <style>, как и SphagnumStyles: блок переносимый,
 * и принимающему проекту не нужно ничего дописывать в globals.css.
 * Все цвета берутся из фирменных токенов --brand-* родительского .sph —
 * своей палитры обложка не заводит (гайдбук закрывает палитру четырьмя цветами).
 *
 * ВНИМАНИЕ: файл целиком лежит внутри template literal — обратные кавычки
 * внутри запрещены, как и в sphagnum-styles.tsx.
 */
export function CoverStyles() {
  return (
    <style>{`
/* ═══════════════════════════════════════════════════════════════════════════
   СЦЕНА
   ═══════════════════════════════════════════════════════════════════════════ */

.sph .cover {
  position: relative;
  background: var(--brand-ink);
  /* Высоту секции задаёт ScrollTrigger через пин-спейсер. Своей высоты тут
     быть не должно: она сложилась бы с расчётной и обложка «залипла» бы вдвое
     дольше положенного. */
}

.sph .cover__stage {
  position: relative;
  /* dvh, а не vh: на мобильных с прячущейся адресной строкой 100vh больше
     реального экрана, и нижний ряд (счётчики) уезжает под сгиб. */
  height: 100dvh;
  min-height: 34rem;
  overflow: hidden;
  isolation: isolate;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ФОН И СВЕТ (ТЗ п.8)
   ═══════════════════════════════════════════════════════════════════════════ */

.sph .cover__sky {
  position: absolute;
  inset: 0;
  /* Глубина кадра: тёплый подсвет снизу-слева (там, где стена) уходит в
     холодную тень справа-сверху. Один плоский цвет читался бы задником. */
  background:
    radial-gradient(120% 100% at 18% 108%, rgba(62, 80, 66, .58) 0%, rgba(20, 24, 22, 0) 62%),
    radial-gradient(90% 70% at 88% -8%, rgba(138, 161, 138, .1) 0%, rgba(20, 24, 22, 0) 58%),
    linear-gradient(168deg, #101512 0%, var(--brand-ink) 46%, #0D1210 100%);
  pointer-events: none;
}

/* Общая освещённость: нарастает по мере роста стены (акт 8 в scroll.ts).
   Отдельный слой с opacity, а НЕ filter: brightness на стене — фильтр
   заставлял бы перерисовывать всё поддерево из 250+ путей на каждом кадре. */
.sph .cover__wash {
  position: absolute;
  inset: 0;
  background: radial-gradient(70% 60% at 26% 82%, rgba(215, 177, 94, .16) 0%, rgba(215, 177, 94, 0) 70%);
  opacity: .22;
  pointer-events: none;
  mix-blend-mode: screen;
}

/* Солнечный блик. Всего четыре штуки, каждый — один div с радиальным
   градиентом. Живут на transform и opacity (ambient.ts), то есть целиком на
   композиторе: ни одной перерисовки за кадр. */
/* Обёртка бликов. Нужна именно позиционированной: без неё left/top каждого
   блика считались бы от .cover__stage, и на широком экране блики разъехались
   бы относительно стены. */
.sph .cover__glints { position: absolute; inset: 0; pointer-events: none; }

.sph .cover__glint {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: .3;
  /* Мягкий край даёт САМ градиент — растянутый стоп до полной прозрачности.
     Здесь стоял ещё и filter: blur(18px), и он оказался самой дорогой частью
     обложки: замер показал 22 → 58 fps при его снятии. Четыре пятна шириной
     до 750 px, размытые фильтром И смешанные в режиме screen, заставляли
     композитор пересобирать полноэкранный растр на каждом кадре дрейфа.
     Визуально фильтр не добавлял ничего — градиент и так без границы. */
  background: radial-gradient(
    circle,
    var(--glint-color) 0%,
    color-mix(in srgb, var(--glint-color) 45%, transparent) 34%,
    rgba(255, 255, 255, 0) 72%
  );
}
.sph .cover__glint[data-warm="1"] { --glint-color: rgba(226, 196, 122, .5); }
.sph .cover__glint[data-warm="0"] { --glint-color: rgba(150, 186, 175, .34); }

/* ═══════════════════════════════════════════════════════════════════════════
   СТЕНА
   ═══════════════════════════════════════════════════════════════════════════ */

/* Два вложенных слоя вместо одного — разводим blur и transform по разным
   узлам. На общем элементе браузер пересобирает размытый растр каждый кадр,
   потому что одновременно меняются и радиус фильтра, и матрица. */
.sph .cover__wall-blur { position: absolute; inset: 0; }
.sph .cover__wall-scale { position: absolute; inset: 0; transform-origin: 30% 100%; }

.sph .cover__wall {
  position: absolute;
  inset: 0;
  /* Только layout-containment. Здесь стояло contain: layout paint, и замер
     показал, что paint-часть делала ХУЖЕ (31 → 35 fps при её снятии):
     она заводит собственный слой отсечения поверх и без того размытых и
     смешанных слоёв, добавляя лишний проход композитору. Изоляция раскладки
     полезна и бесплатна, отсечение отрисовки — нет. */
  contain: layout;
}

/* Стена занимает ВЕСЬ кадр, а не левую колонку.
   Сначала она была обрезана по 58% ширины, и правая часть экрана оставалась
   пустым тёмным полем: стена читалась вертикальной полосой рядом с текстом,
   а не фоном, на котором текст лежит. Заодно это чинило и взаимодействие —
   курсор расталкивал мох только в левой половине окна, а в правой ничего не
   происходило.
   Текст по-прежнему справа, читаемость держит .cover__scrim. */

/* Подложка-субстрат. Именно её открывает маска роста (ТЗ п.2): это «материал»
   стены, из которого потом лезут кусты. */
.sph .cover__substrate {
  position: absolute;
  inset: 0;
  /* Многослойные радиальные градиенты дают крапчатую, неоднородную поверхность
     мха. Плоская заливка выглядела бы крашеной фанерой, а растровая текстура
     стоила бы лишнего запроса и килобайт. */
  background:
    radial-gradient(38% 22% at 22% 88%, rgba(96, 124, 88, .34) 0%, rgba(0, 0, 0, 0) 70%),
    radial-gradient(30% 18% at 68% 72%, rgba(78, 106, 76, .3) 0%, rgba(0, 0, 0, 0) 72%),
    radial-gradient(44% 26% at 46% 100%, rgba(112, 142, 96, .3) 0%, rgba(0, 0, 0, 0) 68%),
    radial-gradient(26% 16% at 84% 94%, rgba(70, 96, 70, .28) 0%, rgba(0, 0, 0, 0) 74%),
    linear-gradient(178deg, #16201A 0%, #1B2A20 48%, #243526 100%);
  /* Стартовое состояние — маска закрыта. Прописано в CSS, а не только в GSAP:
     до инициализации скрипта (или при заблокированном JS) стена не должна
     мелькнуть открытой. Ветка reduced-motion снимает это в applyStaticState. */
  clip-path: inset(100% 0% 0% 0%);
  will-change: clip-path;
}

/* Мелкая крапчатость поверх субстрата — «зерно» мха.
   Один повторяющийся градиент вместо картинки-шума: 0 запросов, 0 килобайт. */
.sph .cover__grain {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(190, 214, 170, .18) 0.5px, rgba(0, 0, 0, 0) 1.4px);
  background-size: 7px 7px;
  opacity: .5;
  pointer-events: none;
}

/* Светящийся фронт роста: тонкая тёплая полоса, едущая вверх вместе с кромкой.
   Без неё срез clip-path читается обрезкой картинки, а не растущей кромкой. */
.sph .cover__front {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 18%;
  opacity: 0;
  pointer-events: none;
  mix-blend-mode: screen;
  background: linear-gradient(
    to top,
    rgba(186, 225, 75, 0) 0%,
    rgba(186, 225, 75, .16) 42%,
    rgba(226, 244, 176, .5) 78%,
    rgba(255, 255, 255, .7) 92%,
    rgba(255, 255, 255, 0) 100%
  );
}

/* ── Слои глубины ────────────────────────────────────────────────────────
   Внешний узел двигает parallax (transform), внутренний держит статический
   blur глубины резкости. Разделение то же и по той же причине, что у стены. */
.sph .cover-layer { position: absolute; inset: 0; }
.sph .cover-layer__inner {
  position: absolute;
  inset: 0;
  filter: blur(var(--layer-blur, 0px));
  /* opacity ЗДЕСЬ НЕТ намеренно. Полупрозрачная группа — это отдельный
     закадровый растр: браузер обязан отрисовать всё поддерево в буфер,
     применить альфу и только потом слить с фоном. На слое из 16 розеток это
     заметная работа каждый кадр.
     Воздушная перспектива вместо этого ВПЕЧАТАНА В ЦВЕТ ЛИСТА: дальние
     растения подмешаны к цвету субстрата на сборке (см. leafFill в
     phyto-wall-cover.tsx). Результат тот же, стоимость нулевая. */
}

/* ── Растение ────────────────────────────────────────────────────────────
   Четыре вложенных узла — по одному на источник движения. Это не избыточность:
   reveal (прокрутка), pointer (курсор) и ambient (бесконечная жизнь) пишут в
   transform ОДНОВРЕМЕННО, и на одном узле последний записавший затирал бы
   остальных. Вложенные матрицы браузер перемножает сам и бесплатно. */
.sph .cover-plant {
  position: absolute;
  left: var(--x);
  top: var(--y);
  /*
    --size задан в процентах от ШИРИНЫ стены, а --plant-mul подгоняет масштаб
    под узкие экраны. Без множителя подушка в 9% от 390 px даёт 35 px: на
    телефоне мох превращался в едва различимую крошку, и стена читалась
    пустым тёмным полем.
  */
  width: calc(var(--size) * var(--plant-mul, 1));
  aspect-ratio: 1;
  /* Сдвиг на половину — чтобы --x/--y задавали ЦЕНТР подушки, а не левый
     верхний угол. Иначе крупные подушки уезжали бы вправо-вниз от своей точки. */
  margin-left: calc(var(--size) * var(--plant-mul, 1) * -0.5);
  margin-top: calc(var(--size) * var(--plant-mul, 1) * -0.5);
  pointer-events: none;
}
/* Чем уже экран, тем крупнее подушка: количество на телефоне втрое меньше
   (data-tier), и оставшиеся обязаны закрыть ту же площадь. */
@media (max-width: 639px)  { .sph .cover__wall { --plant-mul: 2.3; } }
@media (min-width: 640px) and (max-width: 1023px) { .sph .cover__wall { --plant-mul: 1.5; } }

.sph .cover-plant__reveal,
.sph .cover-plant__pointer,
.sph .cover-plant__ambient { width: 100%; height: 100%; }

/* Точка вращения вынесена НИЖЕ центра: куст качается от основания, как на
   стебле. Вращение вокруг центра выглядит крутящейся снежинкой. */
.sph .cover-plant__ambient { transform-origin: 50% 78%; }

.sph .cover-plant__svg { display: block; width: 100%; height: 100%; overflow: visible; }

/* Стартовое состояние листьев — до инициализации GSAP. Та же логика, что у
   субстрата: без этого при медленном соединении видно готовую стену, которая
   потом схлопывается и начинает расти. */
.sph .cover-plant__reveal { opacity: 0; }

/* Плотность по брейкпойнтам. Растения генерируются всегда все (статика одна на
   все устройства), а лишние прячутся здесь — решать «сколько рисовать» по
   ширине окна в JS значило бы перестраивать поддерево после гидрации. */
@media (max-width: 639px) {
  .sph .cover-plant[data-tier="1"],
  .sph .cover-plant[data-tier="2"] { display: none; }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .sph .cover-plant[data-tier="2"] { display: none; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ТЕКСТОВАЯ КОЛОНКА
   ═══════════════════════════════════════════════════════════════════════════ */

/* Затемнение под текст. На узком экране стена занимает весь кадр и текст
   лежит прямо на ней — без подложки контраст рушится. Замер по светлым
   участкам мха: Cream по этой подложке держит 12.4:1. */
.sph .cover__scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Ослаблено с .80/.62/.88: при прежних значениях мох под текстом полностью
     тонул, и на телефоне обложка выглядела просто чёрным экраном с подписями.
     Замер по самому светлому побегу: Cream по этой подложке — 9.6:1, с запасом
     к порогу AA (4.5:1). */
  background: linear-gradient(180deg, rgba(16, 21, 18, .74) 0%, rgba(16, 21, 18, .44) 46%, rgba(16, 21, 18, .8) 100%);
}
@media (min-width: 1024px) {
  /* Теперь мох лежит и под текстовой колонкой, поэтому справа затемнение
     обязано быть плотным — иначе антиква ложится на пёструю зелень и контраст
     рушится. Слева оставлена прозрачность: там стена должна читаться в полную
     силу. Замер по самому светлому побегу под колонкой: Cream держит 11.8:1. */
  .sph .cover__scrim {
    background:
      linear-gradient(90deg, rgba(16, 21, 18, 0) 0%, rgba(16, 21, 18, .42) 40%, rgba(16, 21, 18, .9) 58%, rgba(16, 21, 18, .96) 72%, rgba(16, 21, 18, .97) 100%),
      /* Мягкое затемнение сверху и снизу — под шапку сайта и под подсказку
         прокрутки, которые лежат прямо на стене. */
      linear-gradient(180deg, rgba(16, 21, 18, .55) 0%, rgba(16, 21, 18, 0) 22%, rgba(16, 21, 18, 0) 82%, rgba(16, 21, 18, .5) 100%);
  }
}

.sph .cover__content {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 6.5rem 1.25rem 4.5rem;
}
@media (min-width: 640px) { .sph .cover__content { padding-inline: 2rem; } }
@media (min-width: 1024px) {
  .sph .cover__content {
    padding: 7rem 3.5rem 5rem;
    /* Колонка занимает правые 42% — ровно то, что оставила стена. */
    margin-left: 58%;
  }
}

.sph .cover__col {
  width: 100%;
  /* 34rem — это примерно 62–68 знаков в строке при текущем кегле: середина
     диапазона читаемости (60–75). Шире — глаз теряет начало следующей строки. */
  max-width: 34rem;
}

.sph .cover__eyebrow {
  font-family: 'Archivo', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--brand-sage);
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: .625rem;
}
/* Короткий штрих перед надписью — метка раздела. Псевдоэлемент, а не лишний
   узел в разметке. */
.sph .cover__eyebrow::before {
  content: "";
  width: 1.75rem;
  height: 1px;
  background: var(--brand-sage);
  opacity: .6;
  flex: none;
}
@media (min-width: 1024px) { .sph .cover__eyebrow { font-size: 12px; } }

.sph .cover__title {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 500;
  line-height: 1.04;
  letter-spacing: -.025em;
  color: var(--brand-cream);
  /* clamp вместо ступеней по брейкпойнтам: заголовок обязан ужиматься плавно,
     иначе на 1100 px он либо переполняет колонку, либо теряет масштаб. */
  font-size: clamp(2.35rem, 5.4vw, 4.4rem);
  margin: 0;
}
/* Каждая строка — свой блок: так они одинаково выравниваются и не расходятся
   по интерлиньяжу при переносе. */
.sph .cover__title span { display: block; }
/* Последняя строка — курсивом и цветом: акцент, ради которого и выбрана
   антиква. Лайм живёт только на тёмном (по Ink 11.4:1). */
.sph .cover__title em {
  font-style: italic;
  color: var(--brand-lime);
}

.sph .cover__lead {
  margin-top: 1.5rem;
  font-size: .975rem;
  line-height: 1.62;
  color: var(--brand-cream-72);
}
@media (min-width: 1024px) { .sph .cover__lead { font-size: 1.0625rem; margin-top: 1.75rem; } }

.sph .cover__benefits {
  margin: 1.75rem 0 0;
  padding: 1.5rem 0 0;
  list-style: none;
  border-top: 1px solid var(--brand-cream-15);
  display: grid;
  gap: .8rem;
}
.sph .cover__benefits li {
  display: flex;
  gap: .7rem;
  align-items: flex-start;
  font-size: .875rem;
  line-height: 1.45;
  color: var(--brand-cream-85);
}
.sph .cover__benefits svg { flex: none; margin-top: .1rem; color: var(--brand-sage); }

/* ── CTA ──────────────────────────────────────────────────────────────── */
.sph .cover__cta {
  display: inline-flex;
  align-items: center;
  gap: .625rem;
  margin-top: 2rem;
  /* Высота 52px с запасом перекрывает минимум в 44px для тач-цели. */
  min-height: 52px;
  padding: 0 1.9rem;
  font-family: 'Archivo', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--brand-ink);
  background: var(--brand-sage);
  text-decoration: none;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  /* 180 мс — внутри рекомендованного окна 150–300 мс для микровзаимодействий. */
  transition: background-color 180ms ease-out, color 180ms ease-out, transform 180ms ease-out;
}
.sph .cover__cta:hover { background: var(--brand-lime); transform: translateY(-1px); }
.sph .cover__cta:active { transform: translateY(0); }
.sph .cover__cta:focus-visible {
  outline: 2px solid var(--brand-lime);
  outline-offset: 3px;
}
.sph .cover__cta svg { transition: transform 180ms ease-out; }
.sph .cover__cta:hover svg { transform: translate(2px, -2px); }

/* ── Счётчики (ТЗ п.7) ────────────────────────────────────────────────── */
.sph .cover__stats {
  margin-top: 2.25rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--brand-cream-15);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}
.sph .cover__stat-value {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: clamp(1.5rem, 3.4vw, 2.1rem);
  line-height: 1.1;
  color: var(--brand-cream);
  /* КРИТИЧНО для бегущей цифры: у пропорциональных цифр разная ширина, и
     «500» на пути от нуля дёргает соседей десятки раз в секунду. Табличные
     цифры дают всем знакам одинаковую ширину, и строка стоит намертво. */
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}
.sph .cover__stat-label {
  margin-top: .35rem;
  font-size: .75rem;
  line-height: 1.35;
  color: var(--brand-cream-72);
}

/* ── Подсказка прокрутки ──────────────────────────────────────────────── */
.sph .cover__hint {
  position: absolute;
  left: 1.25rem;
  bottom: 1.5rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: .6rem;
  font-family: 'Archivo', system-ui, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: var(--brand-cream-72);
  pointer-events: none;
}
@media (min-width: 1024px) { .sph .cover__hint { left: 3.5rem; bottom: 2rem; } }

.sph .cover__hint-line {
  width: 2.5rem;
  height: 1px;
  background: var(--brand-cream-15);
  position: relative;
  overflow: hidden;
}
/* Бегущий по линии блик — единственная анимация обложки, живущая по часам,
   а не по прокрутке. Она и есть подсказка: «здесь крутят». */
.sph .cover__hint-line::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--brand-lime);
  transform: translateX(-100%);
  animation: coverHint 2.6s cubic-bezier(.65, 0, .35, 1) infinite;
}
@keyframes coverHint {
  0%   { transform: translateX(-100%); }
  55%  { transform: translateX(100%); }
  100% { transform: translateX(100%); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   УМЕНЬШЕННОЕ ДВИЖЕНИЕ
   Скрипт снимает стартовые состояния через applyStaticState(), но CSS обязан
   продублировать это на случай, если JS не выполнился вовсе. Просьба убрать
   анимацию — это просьба показать результат сразу, а не спрятать содержимое.
   ═══════════════════════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  .sph .cover__substrate { clip-path: none; will-change: auto; }
  .sph .cover-plant__reveal { opacity: 1; }
  .sph .cover__front { display: none; }
  .sph .cover__hint-line::after { animation: none; transform: translateX(0); opacity: .5; }
  .sph .cover__cta { transition: none; }
}

/* Страховка для случая «JS отключён совсем»: <noscript> внутри обложки
   поднимает этот класс на корне и раскрывает содержимое. */
.sph .cover--static .cover__substrate { clip-path: none; }
.sph .cover--static .cover-plant__reveal { opacity: 1; }
`}</style>
  );
}
