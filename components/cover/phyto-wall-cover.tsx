"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";

import {
  COVER_BENEFITS,
  COVER_CTA,
  COVER_EYEBROW,
  COVER_LEAD,
  COVER_SCROLL_HINT,
  COVER_STATS,
  COVER_TITLE_LINES,
} from "./cover-content";
import { CoverStyles } from "./cover-styles";
import { WALL_SEED } from "./motion/config";
import { initCoverMotion } from "./motion/init";
import { buildWall } from "./motion/leaves";
import type { CoverMotionHandle, Plant } from "./motion/types";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ОБЛОЖКА «ЖИВАЯ СТЕНА»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Компонент отвечает ТОЛЬКО за разметку и жизненный цикл. Вся анимация живёт
 * в ./motion/* и общается с DOM через data-атрибуты — здесь нет ни одного
 * вызова gsap. Благодаря этому разметку можно переверстать, не трогая
 * хореографию, и наоборот.
 *
 * Контракт data-атрибутов (их читают модули motion):
 *   data-cover-section  — корень секции, триггер ScrollTrigger
 *   data-cover-pin      — то, что залипает (внутренний экран)
 *   data-wall-blur      — узел под filter: blur
 *   data-wall-scale     — узел под scale/translate
 *   data-wall           — габариты стены (по ним parallax считает позиции)
 *   data-substrate      — маска роста (clip-path)
 *   data-growth-front   — светящаяся кромка роста
 *   data-layer=<id>     — слой глубины (parallax)
 *   data-reveal=<id>    — узел появления растения (прокрутка)
 *   data-pointer=<id>   — узел реакции на курсор
 *   data-ambient=<id>   — узел бесконечной жизни
 *   data-glint=<id>     — солнечный блик
 *   data-parallax-text  — текстовая колонка (встречный parallax)
 *   data-text-step=<n>  — порядок появления текстового блока
 *   data-count-to       — конечное значение счётчика
 */

/* ── Цвет листа ────────────────────────────────────────────────────────────
   Оттенок считается на сборке и уходит в разметку готовым атрибутом fill.
   Ни CSS-фильтров, ни рантайм-вычислений: у 250+ путей это была бы заметная
   работа на каждом кадре ambient-движения. */

/* Две шкалы зелени: холодная (влажный мох в тени) и тёплая (охра).
   Sphagnum fuscum буквально «бурый» — подушки в природе уходят в охру и
   ржавчину. Ровная зелень по всей стене читается искусственным газоном. */
const COOL_DEEP = [0x1f, 0x2c, 0x1d] as const;
const COOL_LIGHT = [0x8f, 0xb5, 0x62] as const;
const WARM_DEEP = [0x2f, 0x2a, 0x18] as const;
const WARM_LIGHT = [0xb4, 0x92, 0x52] as const;

/**
 * Цвет субстрата, к которому «подмешиваются» дальние подушки.
 * Совпадает со средним тоном градиента .cover__substrate — если менять там,
 * менять и здесь, иначе дальний план начнёт отслаиваться от фона.
 */
const SUBSTRATE = [0x1b, 0x2a, 0x20] as const;

/**
 * Цвет куска мха.
 *
 * @param light  0…1 — светлота: у тела подушки ниже, у верхней бахромы выше.
 * @param layerOpacity  «прозрачность» слоя глубины, впечатанная в цвет
 *   вместо CSS-opacity (полупрозрачная группа стоит закадрового растра).
 */
function mossFill(plant: Plant, light: number, layerOpacity: number): string {
  const t = Math.min(1, plant.tone * 0.62 + light * 0.38);
  const ch = (i: number) => {
    const cool = COOL_DEEP[i]! + (COOL_LIGHT[i]! - COOL_DEEP[i]!) * t;
    const warm = WARM_DEEP[i]! + (WARM_LIGHT[i]! - WARM_DEEP[i]!) * t;
    const moss = cool + (warm - cool) * plant.warmth;
    return Math.round(moss * layerOpacity + SUBSTRATE[i]! * (1 - layerOpacity));
  };
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

export default function PhytoWallCover() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  /**
   * Раскладка считается ОДИН раз и совпадает на сервере и в браузере
   * (детерминированный seed, см. motion/rng.ts). Без useMemo React пересобирал
   * бы стену на каждом рендере — 250+ путей заново.
   */
  const wall = useMemo(() => buildWall(WALL_SEED), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let handle: CoverMotionHandle | null = initCoverMotion(root, wall);

    // Возврат функции очистки обязателен. ScrollTrigger живёт в глобальном
    // реестре и переживает размонтирование: не сняли — и он продолжает считать
    // позиции узлов, которых уже нет в документе, на каждой прокрутке.
    return () => {
      handle?.destroy();
      handle = null;
    };
    // wall стабилен благодаря useMemo. Если он когда-нибудь начнёт меняться
    // (другой seed, другая плотность) — эффект пересоберёт систему целиком,
    // и это ровно то, что нужно: изменилась стена, значит устарели все привязки.
  }, [wall]);

  return (
    <div ref={rootRef}>
      <CoverStyles />

      {/* Без JS хореография не отработает, и стартовые состояния из CSS
          (закрытая маска, opacity 0) оставили бы пустой экран. Раскрываем. */}
      <noscript>
        <style>{`.sph .cover__substrate{clip-path:none!important}.sph .cover-plant__reveal{opacity:1!important}`}</style>
      </noscript>

      <section id="top" data-cover-section className="cover">
        <div data-cover-pin className="cover__stage">
          {/* ── Фон и свет (ТЗ п.8) ─────────────────────────────────── */}
          <div className="cover__sky" aria-hidden />
          <div data-light-wash className="cover__wash" aria-hidden />

          {/* ── Стена. Целиком декоративна: смысл несёт текстовая колонка,
                 поэтому от скринридера скрыта одним атрибутом на корне. ── */}
          <div data-wall-blur className="cover__wall-blur" aria-hidden>
            <div data-wall-scale className="cover__wall-scale">
              <div data-wall className="cover__wall">
                {/* Маска роста: субстрат раскрывается снизу вверх (ТЗ п.2) */}
                <div data-substrate className="cover__substrate">
                  <div className="cover__grain" />
                </div>

                {/* Светящаяся кромка роста едет вместе с маской */}
                <div data-growth-front className="cover__front" />

                {/* Слои глубины: back → mid → front. Порядок в DOM = порядок
                    наложения, поэтому передний план идёт последним. */}
                {wall.layers.map((layer) => (
                  <div key={layer.id} data-layer={layer.id} className="cover-layer">
                    <div
                      className="cover-layer__inner"
                      style={{ "--layer-blur": `${layer.blur}px` } as React.CSSProperties}
                    >
                      {wall.plants
                        .filter((p) => p.layer === layer.id)
                        .map((plant) => (
                          <div
                            key={plant.id}
                            className="cover-plant"
                            data-tier={plant.tier}
                            style={
                              {
                                "--x": `${plant.pos.x}%`,
                                "--y": `${plant.pos.y}%`,
                                // Размер в % от ширины стены — подушка
                                // масштабируется вместе со сценой, без единого
                                // медиа-запроса. Подушки НАМЕРЕННО перекрывают
                                // друг друга: мох растёт сплошным ковром, и
                                // видимые зазоры выдали бы расставленные
                                // иконки вместо стены.
                                //
                                // Куст должен быть КРУПНЫМ настолько, чтобы
                                // читались отдельные листья: ниже ~120 px
                                // пластинка вырождается в пятно, и мы снова
                                // получаем кляксы вместо растений.
                                "--size": `${(plant.scale * 17).toFixed(2)}%`,
                              } as React.CSSProperties
                            }
                          >
                            {/* Три вложенных узла — по одному на источник
                                движения. Они пишут в transform одновременно,
                                и на общем узле затирали бы друг друга. */}
                            <div data-reveal={plant.id} className="cover-plant__reveal">
                              <div data-pointer={plant.id} className="cover-plant__pointer">
                                <div data-ambient={plant.id} className="cover-plant__ambient">
                                  <svg
                                    className="cover-plant__svg"
                                    viewBox="-100 -100 200 200"
                                    style={{ transform: `rotate(${plant.rotate}deg)` }}
                                    focusable="false"
                                  >
                                    {/* Листья куста. Порядок в массиве уже
                                        отсортирован по «верховости»: нижние
                                        рисуются первыми и уходят под верхние,
                                        поэтому куст читается объёмным. */}
                                    {plant.fronds.map((frond, i) => {
                                      // Сначала разворот листа в свой луч,
                                      // потом небольшой вынос от центра:
                                      // translate считается уже в повёрнутой
                                      // системе, поэтому черешок уезжает вдоль
                                      // направления роста, а не вбок.
                                      const t = `rotate(${frond.angle}) translate(${frond.offset} 0)`;
                                      // Верхние листья светлее нижних — на них
                                      // падает свет. Диапазон широкий: именно
                                      // перепад внутри куста даёт объём.
                                      const light = 0.24 + frond.depth * 0.62;
                                      return (
                                        <g key={i} transform={t}>
                                          <path d={frond.d} fill={mossFill(plant, light, layer.opacity)} />
                                          {/* Жилка. Только на переднем плане:
                                              на среднем и дальнем она тоньше
                                              пикселя и превращается в шум,
                                              стоя при этом лишнего узла. */}
                                          {layer.id === "front" ? (
                                            <path
                                              d={frond.midrib}
                                              fill="none"
                                              stroke={mossFill(plant, light - 0.22, layer.opacity)}
                                              strokeWidth={1.6}
                                              strokeLinecap="round"
                                            />
                                          ) : null}
                                        </g>
                                      );
                                    })}
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Солнечные блики — поверх стены, под текстом */}
          <div className="cover__glints" aria-hidden>
            {wall.glints.map((g) => (
              <div
                key={g.id}
                data-glint={g.id}
                data-warm={g.warm ? "1" : "0"}
                className="cover__glint"
                style={{
                  left: `${g.pos.x}%`,
                  top: `${g.pos.y}%`,
                  width: `${g.radius}%`,
                  aspectRatio: "1",
                  // Центрируем отрицательными полями, а НЕ через translate(-50%).
                  // transform у этого узла занят: ambient.ts гоняет по нему x/y,
                  // и GSAP переписывает свойство целиком — центрирующий сдвиг
                  // просто исчез бы на первом кадре дрейфа.
                  // Проценты в margin считаются от ШИРИНЫ контейнера, а высота
                  // здесь равна ширине (aspect-ratio: 1), поэтому одно и то же
                  // число верно центрирует по обеим осям.
                  marginLeft: `${-g.radius / 2}%`,
                  marginTop: `${-g.radius / 2}%`,
                }}
              />
            ))}
          </div>

          {/* Затемнение под текст */}
          <div className="cover__scrim" aria-hidden />

          {/* ── Текстовая колонка (ТЗ п.6) ──────────────────────────── */}
          <div data-parallax-text className="cover__content">
            <div className="cover__col">
              <p data-text-step="0" className="cover__eyebrow">
                {COVER_EYEBROW}
              </p>

              <h1 data-text-step="1" className="cover__title">
                {COVER_TITLE_LINES.map((line, i) => (
                  <span key={line}>
                    {/* Последняя строка курсивом и лаймом — единственный
                        акцент заголовка. Два акцента спорили бы. */}
                    {i === COVER_TITLE_LINES.length - 1 ? <em>{line}</em> : line}
                  </span>
                ))}
              </h1>

              <p data-text-step="2" className="cover__lead">
                {COVER_LEAD}
              </p>

              <ul data-text-step="3" className="cover__benefits">
                {COVER_BENEFITS.map((b) => (
                  <li key={b}>
                    <CheckCircle2 className="size-4" strokeWidth={1.7} aria-hidden />
                    {b}
                  </li>
                ))}
              </ul>

              <div data-text-step="4">
                <a href={COVER_CTA.href} className="cover__cta">
                  {COVER_CTA.label}
                  <ArrowUpRight className="size-[18px]" strokeWidth={1.8} aria-hidden />
                </a>
              </div>

              {/* ── Счётчики (ТЗ п.7) ─────────────────────────────────
                  В разметке стоит ГОТОВОЕ число: без JS и для поискового
                  робота показатель виден сразу, скрипт лишь переписывает
                  содержимое во время отсчёта.

                  aria-label на элементе списка несёт полную формулировку,
                  а визуальные потроха скрыты: иначе скринридер зачитывал бы
                  бегущее число по мере анимации. */}
              <ul data-text-step="5" data-counters className="cover__stats">
                {COVER_STATS.map((s) => (
                  <li key={s.label} aria-label={`${s.value}${s.suffix} — ${s.label}`}>
                    <div
                      aria-hidden
                      className="cover__stat-value"
                      data-count-to={s.value}
                      data-count-suffix={s.suffix}
                    >
                      {s.value.toLocaleString("en-US")}
                      {s.suffix}
                    </div>
                    <div aria-hidden className="cover__stat-label">
                      {s.label}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Подсказка прокрутки: у залипающего экрана нужно снять вопрос
              «страница зависла?» — бегущий блик отвечает на него без слов. */}
          <div className="cover__hint" aria-hidden>
            <span className="cover__hint-line" />
            {COVER_SCROLL_HINT}
          </div>
        </div>
      </section>
    </div>
  );
}
