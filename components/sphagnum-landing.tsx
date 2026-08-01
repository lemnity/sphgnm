"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Droplets,
  Layers,
  Leaf,
  Mail,
  Menu,
  Phone,
  Recycle,
  ShieldCheck,
  Sprout,
  Sun,
  Wind,
  X,
  Battery,
  Building2,
  Ruler,
  Weight,
  Grid2x2,
  Plus,
  Minus,
} from "lucide-react";

// Статический импорт, а не путь /moss-ledge.png из public: на GitHub Pages сайт
// живёт в подпапке (basePath /sphgnm), и абсолютный путь к public улетел бы в
// корень домена и вернул 404. Импорт отдаёт уже пре­фиксованный URL.
import mossLedge from "./assets/moss-ledge.png";
import { SphagnumLogo, SphagnumMark } from "./sphagnum-logo";
import { SphagnumStyles } from "./sphagnum-styles";
import { CountUp, Fireflies, MossButterfly, MossMoths, MossTexture, WaterBattery } from "./sphagnum-visuals";
import {
  ADVANTAGES,
  APPLICATIONS,
  CLIMATE_BENEFITS,
  CONTACT,
  FAQ,
  FUSCUM_METRICS,
  FUSCUM_PROPERTIES,
  HERO_BULLETS,
  // HERO_DESIGNED_FOR больше не выводится: ряд чипов дублировал HERO_BULLETS.
  // Данные оставлены в sphagnum-data.ts — пригодятся в секции ниже.
  HERO_WORDS,
  NAV_LINKS,
  PLATFORM_BENEFITS,
  PLATFORM_PILLARS,
  PRODUCT_LINE,
  PROJECTS,
  PROJECT_TYPES,
  CONTACT_DELIVERABLES,
  SOLUTIONS,
  STRIP_CARDS,
  STRIP_PANEL_1,
  STRIP_PANEL_3,
  TAGS,
  VOLUME_RANGES,
  WHY_PHOTO,
} from "./sphagnum-data";

/**
 * SPHAGNUM ECO — Natural Substrates. Одностраничный лендинг по ТЗ
 * «Struktura-saita_EN_shortened». Весь пользовательский текст — английский
 * (целевой рынок ОАЭ/КСА); комментарии в коде остаются русскими.
 *
 * Фото задаются в sphagnum-data.ts полем `photo`. Пока его нет, PhotoSlot рисует
 * подписанную заглушку с текстурой мха — НЕ случайный сток: сток подсовывал
 * Статую Свободы в кейс «Бизнес-центр», а ложная иллюстрация в продающем блоке
 * хуже честной заглушки.
 */

const HERO_BG =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_110248_b62f758d-f68c-4045-a7b4-91771d6d0a0f.png&w=1280&q=85";

/** Один и тот же слот всегда рисует одну текстуру — seed из описания кадра. */
function seedFromCaption(c: string) {
  let h = 0;
  for (let i = 0; i < c.length; i++) h = (h * 31 + c.charCodeAt(i)) >>> 0;
  return h % 997;
}

/**
 * Фото секции. Есть `src` — рисуем <img> с осмысленным alt (он же уходит в SEO).
 * Нет — подписанная заглушка: видно, какой кадр нужен и в каком соотношении.
 */
function PhotoSlot({
  shot,
  alt,
  ratio = "16/10",
  src,
  className = "",
}: {
  shot: string;
  alt: string;
  ratio?: string;
  src?: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ aspectRatio: ratio }}
        className={`w-full object-cover ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      style={{ aspectRatio: ratio }}
      className={`relative grid w-full place-items-center overflow-hidden ${className}`}
    >
      {/* Текстура мха вместо плоской заливки: слот перестаёт выглядеть «дырой» */}
      <MossTexture seed={seedFromCaption(shot)} className="absolute inset-0 h-full w-full" />
      <span className="relative flex max-w-[300px] flex-col items-center gap-2.5 px-6 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-[color:var(--brand-cream-85)] backdrop-blur-sm">
          <Leaf className="size-5 text-[color:var(--brand-moss)]" strokeWidth={1.6} aria-hidden />
        </span>
        <span className="rounded-md bg-[color:var(--brand-cream-85)] px-3 py-1.5 text-[12px] font-semibold leading-snug text-[color:var(--brand-ink)] backdrop-blur-sm">
          {shot}
        </span>
      </span>
    </div>
  );
}

const ICONS = {
  droplet: Droplets,
  wind: Wind,
  sprout: Sprout,
  sun: Sun,
  weight: Weight,
  moss: Leaf,
  roof: Building2,
  battery: Battery,
  shield: ShieldCheck,
  recycle: Recycle,
  layers: Layers,
  porosity: Grid2x2,
  stable: Ruler,
} as const;

function Icon({ name, className = "size-5" }: { name: string; className?: string }) {
  const C = ICONS[name as keyof typeof ICONS] ?? Leaf;
  return <C className={className} strokeWidth={1.6} aria-hidden />;
}

/** Тип входной анимации — тот же набор, что и у keyframes в sphagnum-styles. */
type Anim = "up" | "left" | "right" | "scale" | "in";

/** Появление блока при попадании в кадр. Один наблюдатель на элемент, отписка после срабатывания. */
function Reveal({
  children,
  className = "",
  delay = 0,
  anim = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  anim?: Anim;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Без IntersectionObserver (старые браузеры, SSR-снапшоты) показываем сразу,
    // иначе контент останется невидимым — хуже, чем отсутствие анимации.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-anim={anim} className={`reveal ${className}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}

function SectionHead({
  kicker,
  title,
  lead,
  light,
}: {
  kicker?: string;
  title: string;
  lead?: string;
  light?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      {kicker ? (
        <p className={`mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] ${light ? "text-[color:var(--brand-sage)]" : "text-[color:var(--brand-moss)]"}`}>
          {kicker}
        </p>
      ) : null}
      <h2
        className={`text-[28px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[38px] lg:text-[46px] ${light ? "text-[color:var(--brand-cream)]" : ""}`}
      >
        {title}
      </h2>
      {lead ? (
        <p className={`mt-4 text-base leading-relaxed sm:text-lg ${light ? "text-[color:var(--brand-cream-72)]" : "text-[color:var(--brand-muted)]"}`}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function LeadForm({ id, compact }: { id: string; compact?: boolean }) {
  const [sent, setSent] = useState(false);

  const select = (key: string, label: string, options: readonly string[], placeholder: string) => (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-${key}`} className="text-[13px] font-semibold text-[color:var(--brand-ink)]">
        {label}
      </label>
      <select
        id={`${id}-${key}`}
        defaultValue=""
        className="h-12 w-full rounded-none border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] px-3.5 text-[15px] outline-none focus-visible:border-[color:var(--brand-moss)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-moss)]/25"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Бэкенда нет — показываем подтверждение, submit не уходит никуда.
        setSent(true);
      }}
      className="grid gap-4"
      aria-label="Request a sample or quote"
    >
      {/* Короткие поля парами: семь полей подряд читались как анкета и отпугивали.
          На узком экране пары схлопываются в одну колонку. */}
      {compact ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-name`} label="Name and company" required />
            <Field id={`${id}-email`} label="Email" type="email" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${id}-phone`} label="Phone / WhatsApp" type="tel" />
            <Field id={`${id}-region`} label="Region / country" />
          </div>
        </>
      )}

      {/* Виджет в шапке спрашивает объём списком (бриф: «[ Area, m² ▾ ]»),
          развёрнутая форма — свободным полем («Estimated area (m²)»). */}
      <div className={compact ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        {select("type", "Project type", PROJECT_TYPES, "Select project type")}
        {compact ? (
          select("volume", "Area, m²", VOLUME_RANGES, "Select area")
        ) : (
          <Field id={`${id}-area`} label="Estimated area (m²)" type="text" />
        )}
      </div>

      {compact ? null : (
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-msg`} className="text-[13px] font-semibold text-[color:var(--brand-ink)]">
            Message <span className="font-normal text-[color:var(--brand-muted)]">— optional</span>
          </label>
          <textarea
            id={`${id}-msg`}
            rows={3}
            className="w-full resize-y rounded-none border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] px-3.5 py-2.5 text-[15px] outline-none focus-visible:border-[color:var(--brand-moss)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-moss)]/25"
          />
        </div>
      )}

      <button type="submit" className="btn btn-primary mt-1 flex w-full text-[13px]">
        {compact ? "Request" : "Submit Enquiry"}
        <ArrowRight className="size-4" strokeWidth={2} />
      </button>

      {/* aria-live: скринридер должен услышать результат, не теряя фокус */}
      <p aria-live="polite" className="min-h-[20px] text-[13px] font-medium text-[color:var(--brand-moss)]">
        {sent ? "Enquiry sent — we will respond within 24 hours." : ""}
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  required,
}: {
  id: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      {/* Цвет НЕ наследуем: на тёмной секции (text-[color:var(--brand-cream)]) подпись внутри белой
          карточки становилась белой по белому и пропадала. */}
      <label htmlFor={id} className="text-[13px] font-semibold text-[color:var(--brand-ink)]">
        {label}
        {required ? <span className="ml-0.5 text-[color:var(--brand-moss)]">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={type === "email" ? "email" : type === "tel" ? "tel" : "on"}
        className="h-12 w-full rounded-none border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] px-3.5 text-[15px] outline-none focus-visible:border-[color:var(--brand-moss)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-moss)]/25"
      />
    </div>
  );
}

export default function SphagnumLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [stripCard, setStripCard] = useState(0);
  const [heroShift, setHeroShift] = useState(0);
  /** 0…1 — насколько «пророс» фирменный знак справа от героя. */
  const [heroGrow, setHeroGrow] = useState(0);
  const heroRef = useRef<HTMLElement | null>(null);

  // Автокарусель нижней полосы героя — 3500 мс, как в референсе.
  useEffect(() => {
    const id = window.setInterval(() => setStripCard((c) => (c + 1) % STRIP_CARDS.length), 3500);
    return () => window.clearInterval(id);
  }, []);

  // Параллакс фона героя + прорастание знака справа. Оба считаются от прокрутки,
  // поэтому живут в одном rAF-обработчике: два независимых слушателя scroll
  // дёргали бы layout дважды за кадр.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Знак показываем целиком: при отключённом движении он должен просто
      // быть на месте, а не остаться навсегда «непроросшим» (то есть невидимым).
      setHeroGrow(1);
      return;
    }
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = heroRef.current;
        const vh = window.innerHeight;
        // Сколько секция «держит» экран. На залипающей раскладке это лишняя
        // высота сверх экрана, на обычной (мобильный, reduced-motion) — ноль,
        // и тогда прогресс считается от прокрутки, как раньше.
        const pinned = el ? el.offsetHeight - vh : 0;
        const p =
          pinned > 8 && el
            ? Math.min(Math.max(-el.getBoundingClientRect().top / pinned, 0), 1)
            : Math.min(Math.max(window.scrollY / vh, 0), 1);
        setHeroGrow(p);
        // 0.16, а не прежние 0.28: запас фона по вертикали 20%, и больший сдвиг
        // на залипшем экране оголил бы полосу сверху — раньше это скрывал уезд секции.
        setHeroShift(p * vh * 0.16);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = heroRef.current;
      // Пока первый экран залип, страница визуально стоит на месте. Перекрашивать
      // шапку в белое в этот момент — значит сообщать о прокрутке, которой не
      // видно. Поэтому порог сдвинут за конец залипания; там, где залипания нет
      // (мобильный, reduced-motion), pinned = 0 и порог прежний — 24 px.
      const pinned = el ? Math.max(el.offsetHeight - window.innerHeight, 0) : 0;
      setScrolled(window.scrollY > pinned + 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="sph scroll-smooth">
      <SphagnumStyles />

      {/* ═══════════ ШАПКА (фиксированная) ═══════════ */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
          scrolled ? "border-b border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] backdrop-blur" : "bg-transparent"
        }`}
      >
        {/* Верхний служебный ярус — как у референса: второстепенные ссылки и язык
            уводятся из основного меню, чтобы оно не разрасталось. */}
        <div
          className={`hidden border-b transition-colors lg:block ${
            scrolled ? "border-[color:var(--brand-line)] bg-[color:var(--brand-cream)]" : "border-[color:var(--brand-cream-15)] bg-[color:var(--brand-ink-45)]"
          }`}
        >
          <div className="flex items-center justify-end gap-7 py-2.5 mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
            <a
              href={CONTACT.phoneHref}
              className={`text-[13px] font-medium transition-colors ${
                scrolled ? "text-[color:var(--brand-muted)] hover:text-[color:var(--brand-ink)]" : "text-[color:var(--brand-cream-72)] hover:text-[color:var(--brand-cream)]"
              }`}
            >
              {CONTACT.phone}
            </a>
            <a
              href={`mailto:${CONTACT.email}`}
              className={`text-[13px] font-medium transition-colors ${
                scrolled ? "text-[color:var(--brand-muted)] hover:text-[color:var(--brand-ink)]" : "text-[color:var(--brand-cream-72)] hover:text-[color:var(--brand-cream)]"
              }`}
            >
              {CONTACT.email}
            </a>
            {/* Переключатель языка убран: сайт одноязычный (EN), а кнопка, которая
                ни на что не переключает, — дефект, а не украшение. Вернуть, когда
                появится вторая локаль. */}
          </div>
        </div>

        <div className="a-in flex items-center gap-6 py-4 mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          {/*
            Фирменный логотип заказчика. Дескриптор «NATURAL SUBSTRATES» убран:
            логотип уже содержит знак и словесную часть, а охранное поле вокруг
            него равно высоте литеры S — подпись вплотную снизу в него заходить
            не может.
            Высота 28/32 px даёт ширину 143/164 px — обе выше минимума 120 px;
            32 px — ровно та высота, которую гайд задаёт для шапки сайта.
          */}
          <a
            href="#top"
            className={`a-left d2 shrink-0 ${
              scrolled ? "text-[color:var(--brand-ink)]" : "text-[color:var(--brand-cream)]"
            }`}
          >
            <SphagnumLogo className="h-7 w-auto lg:h-8" />
          </a>

          <nav className="a-in d4 ml-auto hidden items-center gap-5 xl:flex 2xl:gap-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={`whitespace-nowrap text-[14px] font-medium transition-colors ${
                  scrolled ? "text-[color:var(--brand-muted)] hover:text-[color:var(--brand-ink)]" : "text-[color:var(--brand-cream-85)] hover:text-[color:var(--brand-cream)]"
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Moss, а не олива: шапка висит над ВСЕМИ секциями, и брендовый Sage
              спорил бы с оливковыми блоками ниже, а олива — с брендовым первым
              экраном. Тёмно-зелёный Moss из гайда спокойно работает поверх обоих. */}
          <a
            href="#contact"
            className="btn btn-moss a-right d3 ml-auto hidden shrink-0 whitespace-nowrap text-[12px] md:inline-flex lg:text-[13px] xl:ml-0"
          >
            Get Expert Advice
            <ArrowRight className="size-4" strokeWidth={2} />
          </a>

          {/* ml-auto только пока кнопка CTA скрыта. С md она появляется и сама
              несёт ml-auto — два auto-отступа подряд делили свободное место
              пополам, и на планшете кнопка «Get Expert Advice» повисала
              посередине шапки вместо правого края. */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className={`ml-auto md:ml-5 xl:hidden ${
              scrolled ? "text-[color:var(--brand-ink)]" : "text-[color:var(--brand-cream)]"
            }`}
          >
            <Menu className="size-6" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[color:var(--brand-ink)] px-6 py-5 xl:hidden">
          <div className="flex items-center">
            <SphagnumLogo className="h-7 w-auto text-[color:var(--brand-cream)]" />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="ml-auto text-[color:var(--brand-cream)]"
            >
              <X className="size-6" strokeWidth={1.6} />
            </button>
          </div>
          <nav className="mt-10 flex flex-col gap-5">
            {NAV_LINKS.map((l) => (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={() => setMenuOpen(false)}
                className="display text-2xl font-bold text-[color:var(--brand-cream)]"
              >
                {l.label}
              </a>
            ))}
          </nav>
          {/* Здесь Sage, а не Moss как в шапке: Moss по Ink даёт всего 2.1:1 и на
              тёмной подложке меню кнопка бы утонула. Sage по Ink — 6.6:1. */}
          <a
            href="#contact"
            onClick={() => setMenuOpen(false)}
            className="btn btn-sage mt-auto flex w-full text-[14px]"
          >
            Get Expert Advice <ArrowRight className="size-4" strokeWidth={2} />
          </a>
        </div>
      ) : null}

      {/* ═══════════ РАЗДЕЛ 1 — HERO (структура TerraElix: полноэкранный блок,
           пословный заголовок, CTA-ряд и полоса из трёх панелей внизу экрана) ═══════════ */}
      <section id="top" ref={heroRef} className="hero-pin relative">
        {/* Внутренний слой и есть «экран»: он прилипает к верху окна, пока идёт
            прорастание, поэтому вся начинка героя переехала внутрь него.
            overflow-hidden оставлен ЗДЕСЬ, а не на секции: скролл-контейнер на
            родителе сломал бы sticky. */}
        <div className="hero-pin-inner relative flex min-h-dvh flex-col overflow-hidden bg-[color:var(--brand-ink)]">
        <div
          // Запас 20%: при залипании секция больше не уезжает вверх, и сдвиг
          // фона стал бы виден как оголённая полоса сверху. Сдвиг ограничен 16%.
          className="absolute -inset-y-[20%] inset-x-0 bg-cover bg-center bg-no-repeat will-change-transform"
          style={{ backgroundImage: `url("${HERO_BG}")`, transform: `translate3d(0, ${heroShift}px, 0)` }}
          aria-hidden
        />
        {/*
          Затемнение под текст. Раньше был один диагональный градиент — на
          десктопе он работал, но на узком экране контент занимает ВСЮ ширину,
          и правый край текста оказывался на прозрачной части (34%), где
          контраст рушился. Поэтому подложек две: вертикальная для мобильного,
          диагональная с lg. Цвет — брендовый Ink, а не прежний rgb(8,20,14).
        */}
        <div
          className="absolute inset-0 lg:hidden"
          aria-hidden
          style={{ background: "linear-gradient(180deg, rgba(20,24,22,.90) 0%, rgba(20,24,22,.80) 100%)" }}
        />
        <div
          className="absolute inset-0 hidden lg:block"
          aria-hidden
          style={{
            background:
              "linear-gradient(100deg, rgba(20,24,22,.94) 0%, rgba(20,24,22,.80) 46%, rgba(20,24,22,.38) 100%)",
          }}
        />

        {/*
          Одна колонка вместо прежних двух. Белая карточка формы занимала правую
          треть, а вместе с ней в экран набивались заголовок, подзаголовок,
          кнопка, три буллета, три чипа и сама форма — семь конкурирующих блоков.
          Теперь контент прижат влево, а правая часть отдана фотографии: под неё
          и построен диагональный градиент.
        */}
        <div className="relative z-10 flex flex-1 items-center pb-12 pt-28 lg:pb-14 lg:pt-32">
          {/*
            Моховой уступ в правом нижнем углу, из него по мере прокрутки
            прорастает фирменный знак. Порядок в разметке важен: знак идёт
            ПЕРВЫМ, уступ — вторым и перекрывает его корень, поэтому росток
            выглядит выходящим из мха, а не приклеенным сверху.

            Живёт внутри контентного блока, а не рядом с ним: bottom-0 здесь —
            это граница с нижней полосой, то есть уступ стоит ровно на ней.
            Соседним слоем пришлось бы подбирать отступ под высоту полосы.

            Только с xl: на 1024–1279 px уступ шириной в треть экрана заезжал
            бы под буллеты. Фото приглушено фильтром — в полную силу яркая
            зелень спорила с заголовком и выбивалась из палитры героя.
          */}
          {/*
            Ширина растёт тремя ступенями, а не одной: контейнер текста
            центрирован и с ростом экрана отъезжает от правого края, поэтому
            свободное поле справа увеличивается быстрее ширины окна. С одним
            размером уступ либо наезжал на буллеты на 1280 px, либо оставлял
            пустое поле в 200+ px на 1500. Промежуточная ступень 1440 добавлена
            под распространённые 15" ноутбуки — между xl и 2xl их иначе нет.

            Зазор между правым краем текста и левым краем уступа: 1280 → 8 px,
            1440 → 48 px, 1536 → 26 px. Отрицательный right уводит правый край
            за пределы экрана, поэтому уступ читается как элемент сбоку.
          */}
          {/*
            Сдвиг именно translate, а не right/bottom: проценты в right/bottom
            считаются от размеров РОДИТЕЛЯ, а нужны доли самой картинки.
            У PNG по краям прозрачные поля (замерено по альфе: справа 3.8%,
            снизу 13.4%), их надо компенсировать, иначе уступ висит, не доставая
            ни до края экрана, ни до полосы.

            По горизонтали сдвиг 32% — это 3.8% компенсации плюс ещё 28% ширины,
            которые намеренно уезжают за правый край: крупная кочка, показанная
            целиком, читается как вырезанная картинка, а обрезанная краем — как
            продолжающийся за экраном ландшафт.

            Ширина растёт тремя ступенями. Ограничение одно: видимый левый край
            уступа (= экран − W × 0.647) обязан оставаться правее колонки текста.
            Отсюда запас на каждой ступени: 1280 → 11 px, 1440 → 42 px,
            1536 → 9 px. Увеличивать ширину дальше нельзя, не сдвигая текст.

            Выехавший вниз край закрывает полоса: она идёт следом в разметке при
            том же z-10, поэтому уступ выглядит стоящим на ней.
          */}
          <div
            className="pointer-events-none absolute bottom-0 right-0 hidden w-[700px] translate-x-[32%] translate-y-[13.4%] xl:block min-[1440px]:w-[900px] 2xl:w-[1040px]"
            aria-hidden
          >
            <div className="relative">
              {/*
                Знак вычерчивается линией, а не открывается обрезкой: прежний
                clip-path шёл прямоугольной шторкой снизу вверх и на изогнутом
                контуре читался как срез, а не как рост.

                Прогресс пропущен через smoothstep — прокрутка линейна, и без
                сглаживания вычерчивание стартовало и обрывалось рывком.
              */}
              <div className="absolute bottom-[36%] right-[42%] w-[28%]">
                <SphagnumMark
                  className="w-full text-[color:var(--brand-sage-45)]"
                  draw={heroGrow * heroGrow * (3 - 2 * heroGrow)}
                />
              </div>
              <img
                src={mossLedge.src}
                alt=""
                width={mossLedge.width}
                height={mossLedge.height}
                className="relative w-full select-none"
                style={{ filter: "brightness(.62) saturate(.72) contrast(1.05)" }}
              />

              {/*
                Бабочка и светлячки — ПОСЛЕ картинки, иначе уступ перекрыл бы их
                собой. Координаты в процентах от обёртки, поэтому живность едет
                вместе с уступом на всех трёх его размерах.

                Бабочка посажена на 34% снизу: у PNG нижние 13.4% прозрачны, а
                кромка кочки идёт примерно на 30–40%, так что тут она сидит на
                мху, а не висит над ним и не тонет в нём.
              */}
              <MossButterfly className="absolute bottom-[34%] left-[30%] w-[6%] text-[color:var(--brand-cream)] opacity-80" />

              {/*
                Рой стартует из одной точки — центра ростка (см. SWARM_ORIGIN),
                поэтому зона задаётся просто inset-0: разброс даёт не раскладка,
                а амплитуда разлёта. Пока ростка нет, она максимальна и рой
                рассеян; по мере вычерчивания разлёт гаснет, а радиус орбиты
                растёт — и живность собирается кружить вокруг ростка.

                Тот же heroGrow, что и у знака, но БЕЗ smoothstep: у знака он
                сглаживает вычерчивание, а здесь линейная доля читается как
                равномерное стягивание роя.
              */}
              <Fireflies className="inset-0" orbit={heroGrow} />
              <MossMoths className="inset-0" orbit={heroGrow} />
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
            <div className="max-w-[560px] lg:max-w-[760px]">
              {/*
                Антиква в нормальном регистре. Прежний вариант был в капсе, и
                часть слов гасилась до 45% белого — гасились при этом не
                служебные слова, а существительные («roofs, vertical»), из-за
                чего фраза читалась обрывками. Поле `dim` в HERO_WORDS осталось
                в данных, но больше не используется: заголовок одноцветный.
              */}
              <h1
                className="brand-serif leading-[1.08] text-[32px] text-[color:var(--brand-cream)] sm:text-[42px] md:text-[50px] lg:text-[56px] xl:text-[64px]"
              >
                {HERO_WORDS.map((w, i) => (
                  // Пробел настоящим текстовым узлом: margin-left между словами
                  // сдвигал вправо ПЕРВОЕ слово каждой перенесённой строки.
                  <span key={`${w.text}-${i}`}>
                    <span className="word">
                      <span style={{ animationDelay: `${0.3 + i * 0.06}s` }}>{w.text}</span>
                    </span>{" "}
                  </span>
                ))}
              </h1>

              <p className="a-in d6 mt-5 text-base font-medium text-[color:var(--brand-sage)] sm:text-lg lg:mt-6">
                Resilient greenery in any climate
              </p>

              {/*
                Единственное действие на экране — якорь на секцию Contact, где
                стоит развёрнутая форма. Раньше первый экран нёс сразу три
                равнозначных призыва (кнопка в шапке, кнопка в теле и форма
                справа); остались два, и они разнесены по ролям: постоянный —
                в шапке, основной — здесь.
              */}
              <div className="a-up d7 mt-8 lg:mt-10">
                <a
                  href="#contact"
                  className="btn btn-sage inline-flex w-full whitespace-nowrap text-[13px] sm:w-auto sm:px-9 lg:py-[18px] lg:text-[14px]"
                >
                  Get Expert Advice
                  <ArrowUpRight className="size-5" strokeWidth={1.8} />
                </a>
              </div>

              {/*
                Три продуктовые линейки. Прежде рядом с ними стоял ещё ряд чипов
                («Moisture control», «Air purification», «Healthy growth») —
                второй список преимуществ подряд, дублировавший этот по смыслу.
                Оставлена одна пара: что продаём, без повтора зачем.
              */}
              <ul className="a-up d8 mt-9 grid gap-3 border-t border-[color:var(--brand-cream-15)] pt-7 lg:mt-11 lg:grid-cols-3 lg:gap-x-8">
                {HERO_BULLETS.map((b) => (
                  <li
                    key={b}
                    className="flex gap-2.5 text-[14px] leading-snug text-[color:var(--brand-cream-85)]"
                  >
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[color:var(--brand-sage)]"
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/*
          ── Полоса из трёх панелей внизу экрана ──
          Раньше панели стояли на #ECEDEC, #FEFDF9 и чистом чёрном: первые два
          оттенка почти совпадали, но не в точности, и разница читалась как
          случайность, а не как решение. Теперь два светлых блока — один и тот же
          брендовый Cream, разделённый линией, третий — Ink. Пропорция Cream/Ink
          в полосе примерно 65/35, как и требует гайд.
        */}
        {/* Три колонки — только с lg. На планшете (834 px) средняя занимала
            ~110 px внутренней ширины, и текст ломался по одному слову в строку.
            Теперь на md две колонки, а третья панель растянута на всю ширину. */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr]">
          {/* Панель 1 */}
          <div className="a-up d8 relative flex flex-col justify-between overflow-hidden bg-[color:var(--brand-cream)] p-7 text-[color:var(--brand-ink)] lg:p-9">
            <p className="brand-serif max-w-[350px] text-xl leading-[1.12] sm:text-[24px] lg:text-[28px]">
              {STRIP_PANEL_1.text}
            </p>
            <a
              href={STRIP_PANEL_1.linkHref}
              className="mt-5 inline-block text-base underline underline-offset-4 hover:text-[color:var(--brand-moss)] lg:text-lg"
              style={{ letterSpacing: "-0.03em" }}
            >
              {STRIP_PANEL_1.linkLabel}
            </a>
          </div>

          {/* Панель 2 — автокарусель */}
          <div className="a-up d8 flex flex-col justify-between bg-[color:var(--brand-cream)] p-7 text-[color:var(--brand-ink)] md:border-l md:border-[color:var(--brand-ink-10)] lg:p-8">
            <div className="relative min-h-[84px] flex-1 sm:min-h-[96px]">
              {STRIP_CARDS.map((c, i) => {
                const active = i === stripCard;
                return (
                  <div
                    key={c.text}
                    aria-hidden={!active}
                    // Уходящая гаснет вдвое быстрее приходящей — иначе два текста
                    // накладываются и полсекунды нечитаемы.
                    style={{
                      transitionDuration: active ? "500ms" : "220ms",
                      transitionDelay: active ? "180ms" : "0ms",
                    }}
                    className={`absolute inset-0 flex items-start gap-3 transition-all ease-out sm:gap-4 ${
                      active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
                    }`}
                  >
                    {/* Кружок всегда Moss. Поле `circle` в данных задавало cyan и
                        amber — цвета вне фирменной палитры, а «кодировка типа
                        свойства цветом» всё равно не считывалась: легенды нет,
                        и по §«не только цветом» смысл обязан быть в тексте. */}
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color:var(--brand-moss)] text-[color:var(--brand-cream)] sm:size-12">
                      <Icon name={c.icon} className="size-[18px]" />
                    </span>
                    <p
                      className="text-sm leading-[1.25] text-[color:var(--brand-ink-85)] sm:text-base lg:text-lg"
                      style={{ letterSpacing: "-0.03em" }}
                    >
                      {c.text}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex gap-1.5" aria-hidden>
              {STRIP_CARDS.map((c, i) => (
                <span
                  key={c.text}
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                    i === stripCard ? "bg-[color:var(--brand-ink)]" : "bg-[color:var(--brand-ink-20)]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Панель 3. Подпись была на white/60 — это 6.4:1 по чёрному, но по
              брендовому Ink уже 5.8:1; поднято до 75%, чтобы держать запас. */}
          <div className="a-up d8 flex items-center gap-5 bg-[color:var(--brand-ink)] p-7 lg:gap-7 lg:p-9">
            <p className="brand-serif shrink-0 text-2xl text-[color:var(--brand-cream)] sm:text-3xl lg:text-[35px]">
              {STRIP_PANEL_3.value}
            </p>
            <p className="text-sm leading-[1.3] text-[color:var(--brand-cream-72)] sm:text-base lg:text-lg">
              {STRIP_PANEL_3.text}
            </p>
          </div>
        </div>
        </div>
      </section>
      {/* ═══════════ РАЗДЕЛ 2 — НАШИ РЕШЕНИЯ ═══════════ */}
      <section id="product" className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead
              kicker="Our solutions"
              title="Two solutions for urban greening at every scale"
              lead="Two product lines for roofs and urban landscapes."
            />
          </Reveal>

          <div className="mt-14 grid gap-7 lg:mt-20 lg:grid-cols-2 lg:gap-9">
            {SOLUTIONS.map((s, i) => (
              <Reveal key={s.title} anim={i === 0 ? "left" : "right"} delay={i * 0.1}>
                <div className="flex h-full flex-col rounded-2xl border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--brand-moss)]/40 hover:shadow-xl lg:p-9">
                  <span className="grid size-12 place-items-center rounded-xl bg-[color:var(--brand-moss)] text-[color:var(--brand-cream)]">
                    <Icon name={s.icon} className="size-6" />
                  </span>
                  <p className="label mt-5 text-[13px] text-[color:var(--brand-moss)]">
                    {s.kicker}
                  </p>
                  <h3 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em] lg:text-[26px]">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--brand-muted)]">{s.lead}</p>

                  <p className="label mt-6 text-[13px] text-[color:var(--brand-ink)]">
                    Key properties
                  </p>
                  <ul className="mt-3 grid gap-2.5">
                    {s.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[14.5px] leading-snug">
                        <Leaf className="mt-0.5 size-4 shrink-0 text-[color:var(--brand-moss)]" strokeWidth={1.8} aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <h3 className="mt-14 text-[22px] font-bold tracking-[-0.02em] lg:mt-16 lg:text-[26px]">Benefits</h3>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {CLIMATE_BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.08}>
                <div className="flex h-full items-start gap-3.5 rounded-xl border border-[color:var(--brand-line)] p-5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color:var(--brand-moss)]/10 text-[color:var(--brand-moss)]">
                    <Icon name={b.icon} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-bold">{b.title}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-[color:var(--brand-muted)]">{b.text}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ Полноширинный акцентный блок (приём референса:
           крупная цифра на сплошной оливе) ═══════════ */}
      <section className="relative overflow-hidden bg-[color:var(--brand-moss)] py-20 lg:py-32">
        <MossTexture seed={13} density={260} className="absolute inset-0 h-full w-full opacity-25" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20 mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <div>
            {/* Крупный текст на оливе — тёмным: белый по var(--brand-sage) даёт 2.7:1 и не проходит контраст */}
            <p className="display text-[42px] leading-[1.02] text-[color:var(--brand-ink)] sm:text-[56px] lg:text-[68px]">
              <CountUp value="53,000 km²" />
            </p>
            <p className="display mt-2 text-[26px] leading-[1.08] text-[color:var(--brand-ink)] sm:text-[32px] lg:text-[38px]">
              of pristine wetland — our raw-material base
            </p>
          </div>
          <p className="text-[15.5px] leading-relaxed text-[color:var(--brand-ink)]/85 sm:text-base">
            The Vasyugan wetlands of Western Siberia form the world&rsquo;s largest wetland system. The moss is
            hand-harvested: only the upper 5–7 cm is cut, and the bog naturally regenerates within 5–7 years. It is a
            renewable resource — not peat, which takes thousands of years to form.
          </p>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 3 — ПОЧЕМУ ЗЕЛЕНЬ ИМЕЕТ ЗНАЧЕНИЕ ═══════════ */}
      <section className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20 mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal anim="left">
            <SectionHead kicker="Why greenery matters" title="Why conventional soils fail" />
            <p className="mt-5 text-[15.5px] leading-relaxed text-[color:var(--brand-muted)] sm:text-base">
              Poor substrate selection is a leading cause of landscape failure. Inconsistent soil mixes stress plants,
              increase replacement costs and create handover risks. The result is a weaker appearance and lower
              perceived project quality.
            </p>

            <blockquote className="my-7 border-l-[3px] border-[color:var(--brand-moss)] pl-5">
              <p className="display text-[19px] font-semibold leading-snug tracking-[-0.01em] sm:text-[22px]">
                &ldquo;Landscape quality is visible quality. Residents and visitors judge a development by the condition
                of its greenery.&rdquo;
              </p>
            </blockquote>

            <p className="text-[15.5px] leading-relaxed text-[color:var(--brand-muted)] sm:text-base">
              For developers, architects and asset managers, landscape performance affects reputation, rental appeal and
              resident satisfaction. Greenery survives only with the right substrate. Standard soils are not designed
              for hot climates, roof-load limits or water scarcity.
            </p>
          </Reveal>

          <Reveal anim="right" delay={0.12}>
            <figure className="overflow-hidden rounded-2xl">
              <PhotoSlot ratio="4/3" shot={WHY_PHOTO.shot} alt={WHY_PHOTO.alt} src={WHY_PHOTO.photo || undefined} />
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 4 — SPHAGNUM FUSCUM ═══════════ */}
      <section id="fuscum" className="relative overflow-hidden bg-[color:var(--brand-ink)] py-20 text-[color:var(--brand-cream)] lg:py-28">
        {/* Живая текстура мха фоном секции — генерируется, а не берётся из стока */}
        <MossTexture dark seed={41} density={320} className="absolute inset-0 h-full w-full opacity-40" />
        {/* Скрим поверх текстуры: зерно шло прямо под абзацами и мешало читать */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(14,28,21,.72) 0%, rgba(14,28,21,.55) 45%, rgba(14,28,21,.78) 100%)" }}
        />
        <div className="relative mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead
              light
              kicker="Flagship product"
              title="Sphagnum Fuscum — live moss that performs where soil cannot"
            />
            <p className="mt-5 max-w-3xl text-[15.5px] leading-relaxed text-[color:var(--brand-cream-72)] sm:text-base">
              Sphagnum fuscum grows in the pristine Vasyugan wetlands of Western Siberia, the world&rsquo;s largest
              wetland system, spanning 53,000 km². Unlike peat, it is harvested alive, retaining its natural structure,
              antimicrobial compounds and exceptional moisture-holding capacity.
            </p>
          </Reveal>

          <div className="mt-14 grid overflow-hidden rounded-2xl border border-[color:var(--brand-cream-15)] sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
            {FUSCUM_METRICS.map((m, i) => (
              <Reveal key={m.value} anim="scale" delay={i * 0.08} className="h-full">
                <div
                  className={`h-full bg-[color:var(--brand-ink)]/90 p-6 backdrop-blur-sm lg:p-8 ${
                    // Границы только между ячейками: у первой в ряду её быть не должно,
                    // иначе она удвоит внешнюю рамку контейнера.
                    i % 2 === 1 ? "sm:border-l sm:border-[color:var(--brand-cream-15)]" : ""
                  } ${i > 0 ? "border-t border-[color:var(--brand-cream-15)] sm:border-t-0 lg:border-l lg:border-[color:var(--brand-cream-15)]" : ""} ${
                    i >= 2 ? "sm:border-t sm:border-[color:var(--brand-cream-15)] lg:border-t-0" : ""
                  }`}
                >
                  <p className="display text-[34px] font-extrabold leading-none tracking-[-0.03em] text-[color:var(--brand-sage)] lg:text-[42px]">
                    <CountUp value={m.value} />
                  </p>
                  <p className="mt-3 text-[14px] leading-snug text-[color:var(--brand-cream-72)]">{m.label}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Ключевое заявление продукта — картинкой, а не строкой в списке */}
          <Reveal anim="scale" delay={0.05}>
            <div className="mt-8 lg:mt-10">
              <WaterBattery />
            </div>
          </Reveal>

          {/* battery отфильтрован: он показан выносным блоком выше, в сетке был дублем */}
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FUSCUM_PROPERTIES.filter((p) => p.icon !== "battery").map((p, i) => (
              <Reveal key={p.title} delay={i * 0.08}>
                <div className="flex h-full gap-4 rounded-2xl border border-[color:var(--brand-cream-15)] bg-[color:var(--brand-cream-04)] p-6 transition-colors duration-300 hover:border-[color:var(--brand-sage-40)] hover:bg-[color:var(--brand-cream-07)]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[color:var(--brand-sage-15)] text-[color:var(--brand-sage)]">
                    <Icon name={p.icon} />
                  </span>
                  <span>
                    <span className="block text-[16px] font-bold">{p.title}</span>
                    <span className="mt-1.5 block text-[14px] leading-relaxed text-[color:var(--brand-cream-72)]">{p.text}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <a
              href="#contact"
              className="btn btn-accent mt-10 inline-flex text-[14px]"
            >
              Request a Sample and Specification
              <ArrowUpRight className="size-5" strokeWidth={2} />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 5 — SUBSTRATE PLATFORM ═══════════ */}
      <section className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead
              kicker="Substrate platform for outdoors"
              title="Engineered root-zone performance"
            />
          </Reveal>

          <div className="mt-14 grid gap-7 lg:mt-20 lg:grid-cols-3">
            {PLATFORM_PILLARS.map((p, i) => (
              <Reveal key={p.title} anim="scale" delay={i * 0.1}>
                <div className="h-full rounded-2xl bg-[color:var(--brand-cream)] p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg lg:p-8">
                  <span className="grid size-12 place-items-center rounded-xl bg-[color:var(--brand-cream)] text-[color:var(--brand-moss)] shadow-sm">
                    <Icon name={p.icon} className="size-6" />
                  </span>
                  <h3 className="mt-5 text-[19px] font-bold leading-tight tracking-[-0.01em]">{p.title}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[color:var(--brand-muted)]">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <h3 className="display mt-16 text-[24px] font-bold tracking-[-0.02em] lg:text-[30px]">Benefits</h3>
          </Reveal>
          {/* Нумерация в олива-акценте: раньше шесть одинаковых блоков с одной
              лишь верхней линейкой сливались в серую сетку без точек входа. */}
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 0.07}>
                <div className="group border-t-2 border-[color:var(--brand-line)] pt-5 transition-colors duration-300 hover:border-[color:var(--brand-moss)]">
                  <span className="display block text-[13px] font-extrabold tracking-[0.08em] text-[color:var(--brand-moss)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h4 className="mt-2 text-[16px] font-bold">{b.title}</h4>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--brand-muted)]">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <h3 className="display mt-16 text-[24px] font-bold tracking-[-0.02em] lg:text-[30px]">Product range</h3>
          </Reveal>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {PRODUCT_LINE.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div className="flex h-full items-baseline gap-4 rounded-xl border border-[color:var(--brand-line)] p-6">
                  <span className="display shrink-0 text-[20px] font-extrabold tracking-[-0.02em] text-[color:var(--brand-moss)]">
                    {p.name}
                  </span>
                  <span className="text-[14.5px] leading-snug text-[color:var(--brand-muted)]">{p.text}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <a
              href="#contact"
              className="btn btn-primary mt-10 inline-flex text-[14px]"
            >
              Request Technical Details
              <ArrowUpRight className="size-5" strokeWidth={2} />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 6 — ПРИМЕНЕНИЕ ═══════════ */}
      <section id="applications" className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead kicker="Applications" title="Where our solutions perform" />
          </Reveal>

          <div className="mt-14 grid gap-10 lg:mt-20">
            {APPLICATIONS.map((a, i) => (
              <Reveal key={a.title} anim={i % 2 === 0 ? "left" : "right"} delay={0.05}>
                <article
                  className={`grid items-center gap-6 overflow-hidden rounded-2xl bg-[color:var(--brand-cream)] lg:grid-cols-2 lg:gap-0 ${
                    i % 2 === 1 ? "lg:[&>figure]:order-2" : ""
                  }`}
                >
                  <figure className="m-0 overflow-hidden">
                    <PhotoSlot
                      ratio="16/10"
                      shot={a.shot}
                      alt={a.alt}
                      src={a.photo || undefined}
                      className="h-full transition-transform duration-700 ease-out hover:scale-[1.03]"
                    />
                  </figure>
                  <div className="p-6 sm:p-8 lg:p-12">
                    <span className="display text-[13px] font-bold tracking-[0.1em] text-[color:var(--brand-moss)]">
                      0{i + 1}
                    </span>
                    <h3 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em] lg:text-[28px]">
                      {a.title}
                    </h3>
                    <p className="mt-3.5 text-[15px] leading-relaxed text-[color:var(--brand-muted)]">{a.text}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 7 — ПРОЕКТЫ ═══════════ */}
      <section id="projects" className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead kicker="Completed projects" title="Sites where our solutions already perform" />
          </Reveal>

          <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:mt-20">
            {PROJECTS.map((p, i) => (
              <Reveal key={p.tag} anim="scale" delay={(i % 2) * 0.1}>
                <article className="group h-full overflow-hidden rounded-2xl border border-[color:var(--brand-line)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--brand-moss)]/40 hover:shadow-xl">
                  <PhotoSlot
                    ratio="16/10"
                    shot={p.shot}
                    alt={p.alt}
                    src={p.photo || undefined}
                    className="transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="p-6 lg:p-7">
                    <span className="inline-block rounded-full bg-[color:var(--brand-moss)]/10 px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-moss)]">
                      {p.tag}
                    </span>
                    <h3 className="mt-3 text-[19px] font-bold leading-tight tracking-[-0.01em]">{p.title}</h3>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--brand-muted)]">{p.text}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <a
              href="#contact"
              className="btn btn-primary mt-10 inline-flex text-[14px]"
            >
              Discuss Your Project
              <ArrowUpRight className="size-5" strokeWidth={2} />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 8 — ADVANTAGES ═══════════ */}
      <section id="advantages" className="bg-[color:var(--brand-ink)] py-20 text-[color:var(--brand-cream)] lg:py-28">
        <div className="mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead light kicker="Why us" title="Sphagnum Eco — advantages" />
          </Reveal>

          <div className="mt-14 grid gap-x-14 gap-y-12 sm:grid-cols-2 lg:mt-20">
            {ADVANTAGES.map((a, i) => (
              <Reveal key={a.num} delay={(i % 2) * 0.1}>
                <div className="border-t border-[color:var(--brand-cream-15)] pt-6">
                  <span className="display block text-[15px] font-extrabold tracking-[0.06em] text-[color:var(--brand-sage)]">
                    {a.num}
                  </span>
                  <h3 className="mt-2.5 text-[20px] font-bold leading-tight tracking-[-0.01em]">{a.title}</h3>
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[color:var(--brand-cream-72)]">{a.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-14 flex flex-wrap gap-2.5">
              {TAGS.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[color:var(--brand-cream-15)] px-4 py-2 text-[13px] font-medium text-[color:var(--brand-cream-85)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 11 — FAQ ═══════════ */}
      <section id="faq" className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <Reveal>
            <SectionHead kicker="FAQ" title="Frequently asked questions" />
          </Reveal>

          {/* Ширина строки для чтения — здесь, а не на контейнере: иначе левый
              край секции не совпадал с остальной страницей. */}
          <div className="mt-10 max-w-[860px] lg:mt-14">
            {FAQ.map((f, i) => {
              const open = openFaq === i;
              return (
                <Reveal key={f.q} delay={0.04}>
                  <div className="border-b border-[color:var(--brand-line)]">
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                        aria-controls={`faq-panel-${i}`}
                        className="flex w-full items-start gap-4 py-5 text-left"
                      >
                        <span className="normal-case-h flex-1 text-[16px] font-bold leading-snug sm:text-[17px]">{f.q}</span>
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand-cream)] text-[color:var(--brand-moss)]">
                          {open ? <Minus className="size-4" strokeWidth={2.2} /> : <Plus className="size-4" strokeWidth={2.2} />}
                        </span>
                      </button>
                    </h3>
                    {/* grid-rows 0fr→1fr — анимация высоты без фиксированных значений */}
                    <div
                      id={`faq-panel-${i}`}
                      role="region"
                      className="grid transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="pb-5 pr-11 text-[15px] leading-relaxed text-[color:var(--brand-muted)]">{f.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ РАЗДЕЛ 12 — КОНТАКТЫ ═══════════ */}
      <section id="contact" className="relative overflow-hidden bg-[color:var(--brand-ink)] py-24 text-[color:var(--brand-cream)] lg:py-36">
        <MossTexture dark seed={77} density={280} className="absolute inset-0 h-full w-full opacity-30" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(20,24,15,.80) 0%, rgba(20,24,15,.62) 50%, rgba(20,24,15,.86) 100%)" }}
        />

        <div className="relative grid gap-14 lg:grid-cols-[1fr_500px] lg:gap-20 mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <div>
            <Reveal anim="left">
              <SectionHead
                light
                kicker="Contact"
                title="Let’s discuss your project"
                lead="Send us your enquiry and we will recommend the right substrate, provide a technical passport and arrange a trial delivery. We respond within 24 hours."
              />
            </Reveal>

            {/* Раньше под карточкой контакта зияло ~300px пустоты. Теперь там то,
                что снимает возражение «а что я получу, если оставлю заявку». */}
            <Reveal anim="left" delay={0.08}>
              <ul className="mt-10 grid gap-5 lg:mt-12">
                {CONTACT_DELIVERABLES.map((d) => (
                  <li key={d.title} className="flex gap-4 border-t border-[color:var(--brand-cream-15)] pt-5">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[color:var(--brand-sage)]" strokeWidth={1.7} aria-hidden />
                    <span>
                      <span className="block text-[15.5px] font-bold">{d.title}</span>
                      <span className="mt-1 block text-[14px] leading-relaxed text-[color:var(--brand-cream-72)]">{d.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal anim="left" delay={0.16}>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-[color:var(--brand-cream-15)] pt-7">
                <div>
                  <p className="display text-[16px] leading-none">{CONTACT.person}</p>
                  <p className="mt-1.5 text-[13.5px] text-[color:var(--brand-cream-72)]">{CONTACT.role}</p>
                </div>
                <a
                  href={CONTACT.phoneHref}
                  className="flex items-center gap-2.5 text-[15px] font-semibold transition-colors hover:text-[color:var(--brand-sage)]"
                >
                  <Phone className="size-[18px] text-[color:var(--brand-sage)]" strokeWidth={1.7} aria-hidden />
                  {CONTACT.phone}
                </a>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="flex items-center gap-2.5 text-[15px] font-semibold transition-colors hover:text-[color:var(--brand-sage)]"
                >
                  <Mail className="size-[18px] text-[color:var(--brand-sage)]" strokeWidth={1.7} aria-hidden />
                  {CONTACT.email}
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal anim="right" delay={0.12}>
            <div className="bg-[color:var(--brand-cream)] p-7 text-[color:var(--brand-ink)] shadow-2xl sm:p-9">
              <p className="display text-[19px] leading-tight text-[color:var(--brand-ink)]">Send an enquiry</p>
              <p className="mb-6 mt-2 text-[13.5px] leading-snug text-[color:var(--brand-muted)]">
                We reply within 24 hours with a commercial offer.
              </p>
              <LeadForm id="contact" />
              <p className="mt-1 border-t border-[color:var(--brand-line)] pt-4 text-[12.5px] leading-snug text-[color:var(--brand-muted)]">
                By submitting this form you consent to the processing of your personal data. We never share your
                contact details with third parties.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ ПОДВАЛ ═══════════ */}
      <footer className="bg-[color:var(--brand-ink)] py-8 text-[color:var(--brand-cream-72)]">
        <div className="flex flex-col gap-2 text-[13px] sm:flex-row sm:items-center mx-auto w-full max-w-[1460px] px-5 sm:px-8 lg:px-14">
          <p>© 2026 Sphagnum Eco · Natural Substrates · All rights reserved.</p>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-[color:var(--brand-cream)] sm:ml-auto">
            {CONTACT.email}
          </a>
        </div>
      </footer>
    </div>
  );
}
