"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeft,
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
  Factory,
  FlaskConical,
  Headphones,
  Thermometer,
  CircleOff,
  Flower2,
  Globe2,
  HandHeart,
  Layers3,
  RefreshCcw,
  Shovel,
  Star,
  ThermometerSun,
  Waves,
} from "lucide-react";

// Статический импорт, а не путь /plants-wall-reception.webp из public: на GitHub
// Pages сайт живёт в подпапке (basePath /sphgnm), и абсолютный путь к public
// улетел бы в корень домена и вернул 404. Импорт отдаёт уже пре­фиксованный URL.
import receptionWall from "./assets/plants-wall-reception.webp";
import solutionMoss from "./assets/reference/crops/solution-moss-original.webp";
import solutionSoil from "./assets/reference/crops/solution-soil-original.webp";
import wetlandLandscape from "./assets/reference/crops/wetland-landscape.webp";
import livingWallWide from "./assets/reference/crops/living-wall-wide.jpg";
import rootZoneStrip from "./assets/reference/crops/root-zone-soil-strip.webp";
import portfolioBotanical from "./assets/reference/crops/portfolio-botanical-original.webp";
import portfolioDots from "./assets/reference/crops/portfolio-dots-original.webp";
import projectOasis from "./assets/reference/crops/portfolio-oasis-resort.webp";
import projectSkyline from "./assets/reference/crops/portfolio-skyline-business-centre.webp";
import projectValkyrie from "./assets/reference/crops/portfolio-valkyrie-residential-park.webp";
import applicationRoof from "./assets/reference/crops/application-green-roof-layers.webp";
import applicationWall from "./assets/reference/crops/application-vertical-garden.webp";
import applicationArid from "./assets/reference/crops/application-moisture-retaining-mat.webp";
import solutionsHangingVines from "./assets/reference/crops/solutions-hanging-vines-transparent.png";
import { SphagnumLogo } from "./sphagnum-logo";
import { SphagnumStyles } from "./sphagnum-styles";
import { LivingWall, MossTexture } from "./sphagnum-visuals";
import {
  ADVANTAGES,
  APPLICATIONS,
  CONTACT,
  FAQ,
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
  WETLAND_FACTS,
} from "./sphagnum-data";

/**
 * SPHAGNUM ECO — Natural Substrates. Одностраничный лендинг по ТЗ
 * «Struktura-saita_EN_shortened». Весь пользовательский текст — английский
 * (целевой рынок ОАЭ/КСА); комментарии в коде остаются русскими.
 *
 * Визуальный ряд собран из оптимизированных локальных assets, извлечённых из
 * согласованного макета; статические imports сохраняют basePath GitHub Pages.
 */

/**
 * Тонировка фона первого экрана. Вынесена в константу, потому что её носят ДВА
 * элемента — статическая CSS-подложка и живой холст поверх неё. Разойдутся —
 * и в момент появления холста фотография скачком поменяет тон.
 */
/*
  brightness(1) — то есть яркость кадра НЕ трогаем. Раньше стояло .80, и именно
  оно, а не скрим, гасило правую часть экрана: справа пелены почти нет, гасить
  там было нечему, кроме самой фотографии. Замер по правой трети: .80 давало
  0.098, единица даёт 0.169 — плюс 73%, при этом текст слева лежит под пеленой
  .92….86 и почти ничего не замечает.

  saturate/contrast остаются: они добавляют сочности, но не съедают света.
*/
const HERO_BG_FILTER = "brightness(1) saturate(1.20) contrast(1.08)";

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
  temperature: Thermometer,
  factory: Factory,
  flask: FlaskConical,
  headset: Headphones,
  circleOff: CircleOff,
  flower: Flower2,
  globe: Globe2,
  hand: HandHeart,
  layers3: Layers3,
  refresh: RefreshCcw,
  shovel: Shovel,
  star: Star,
  thermometerSun: ThermometerSun,
  waves: Waves,
} as const;

const SOLUTION_IMAGES = [solutionMoss, solutionSoil] as const;
const PROJECT_IMAGES = [projectOasis, projectSkyline, projectValkyrie] as const;
const APPLICATION_IMAGES = [applicationRoof, applicationWall, applicationArid] as const;
const TAG_ICONS = ["moss", "refresh", "circleOff", "flask", "hand", "globe"] as const;

const VINE_BRANCHES = [
  { clipPath: "inset(0 87% 72% 5%)", anchor: 0.09, x: 0.62, y: 0.82, rotate: 0.72, duration: 430 },
  { clipPath: "inset(0 76% 30% 12%)", anchor: 0.18, x: 0.78, y: 0.68, rotate: -0.86, duration: 520 },
  { clipPath: "inset(0 64% 9% 23%)", anchor: 0.295, x: 0.94, y: 0.76, rotate: 1.08, duration: 610 },
  { clipPath: "inset(0 53% 63% 38%)", anchor: 0.425, x: 0.7, y: 0.9, rotate: -0.74, duration: 470 },
  { clipPath: "inset(0 45% 23% 44%)", anchor: 0.495, x: 1.04, y: 0.72, rotate: 1.2, duration: 660 },
  { clipPath: "inset(0 37% 1% 51%)", anchor: 0.57, x: 1.14, y: 0.62, rotate: -1.28, duration: 720 },
  { clipPath: "inset(0 30% 33% 59%)", anchor: 0.645, x: 0.86, y: 0.84, rotate: 0.96, duration: 560 },
  { clipPath: "inset(0 21% 0 65%)", anchor: 0.72, x: 1.2, y: 0.66, rotate: -1.34, duration: 760 },
  { clipPath: "inset(0 7% 12% 78%)", anchor: 0.855, x: 0.9, y: 0.8, rotate: 1.04, duration: 620 },
  { clipPath: "inset(0 0 0 87%)", anchor: 0.935, x: 1.08, y: 0.7, rotate: -1.16, duration: 700 },
] as const;

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
  const hasLeafMark = kicker === "Our solutions" || kicker === "Substrate platform for outdoors";
  return (
    <div className="max-w-3xl">
      {kicker ? (
        <p className={`mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] ${light ? "text-[color:var(--brand-sage)]" : "text-[color:var(--brand-moss)]"}`}>
          {kicker}{hasLeafMark ? <Leaf className="size-4" strokeWidth={1.8} aria-hidden /> : null}
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
        className="h-12 w-full rounded-none border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] px-3.5 text-[15px] outline-none focus-visible:border-[color:var(--brand-moss)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-moss-40)]"
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
            className="w-full resize-y rounded-none border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] px-3.5 py-2.5 text-[15px] outline-none focus-visible:border-[color:var(--brand-moss)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-moss-40)]"
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
        className="h-12 w-full rounded-none border border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] px-3.5 text-[15px] outline-none focus-visible:border-[color:var(--brand-moss)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand-moss-40)]"
      />
    </div>
  );
}

function PdfAlignedSections({
  projectsRef,
  onScrollProjects,
}: {
  projectsRef: React.RefObject<HTMLDivElement | null>;
  onScrollProjects: (direction: -1 | 1) => void;
}) {
  const productSectionRef = useRef<HTMLElement | null>(null);
  const vinesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = productSectionRef.current;
    const vines = vinesRef.current;
    if (!section || !vines) return;
    const branches = [...vines.querySelectorAll<HTMLElement>("[data-vine-branch]")];

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let previousPointer: { x: number; y: number; time: number } | null = null;
    let gustTimers: number[] = [];

    const clearGustTimers = () => {
      gustTimers.forEach((timer) => window.clearTimeout(timer));
      gustTimers = [];
    };
    const setBranchPosition = (branch: HTMLElement, x: number, y: number, rotation: number) => {
      branch.style.setProperty("--vine-x", `${x.toFixed(2)}px`);
      branch.style.setProperty("--vine-y", `${y.toFixed(2)}px`);
      branch.style.setProperty("--vine-rotate", `${rotation.toFixed(2)}deg`);
    };
    const reset = () => {
      cancelAnimationFrame(animationFrame);
      clearGustTimers();
      previousPointer = null;
      branches.forEach((branch) => {
        branch.style.setProperty("--vine-x", "0px");
        branch.style.setProperty("--vine-y", "0px");
        branch.style.setProperty("--vine-rotate", "0deg");
      });
    };
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || reducedMotion.matches) {
        reset();
        return;
      }
      const bounds = section.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
      const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
      const now = performance.now();
      const elapsed = previousPointer ? Math.max(12, Math.min(180, now - previousPointer.time)) : 0;
      const velocityX = previousPointer && elapsed ? (event.clientX - previousPointer.x) / elapsed : 0;
      const velocityY = previousPointer && elapsed ? (event.clientY - previousPointer.y) / elapsed : 0;
      previousPointer = { x: event.clientX, y: event.clientY, time: now };
      const pointerX = event.clientX;
      const vineBounds = vines.getBoundingClientRect();
      const baseX = x * 7;
      const baseY = y * 4;
      const baseRotation = x * 0.7;
      const windX = Math.max(-18, Math.min(18, velocityX * 9));
      const windY = Math.max(-7, Math.min(7, velocityY * 5));

      cancelAnimationFrame(animationFrame);
      clearGustTimers();
      animationFrame = requestAnimationFrame(() => {
        branches.forEach((branch, index) => {
          const response = VINE_BRANCHES[index];
          const anchorX = vineBounds.left + vineBounds.width * response.anchor;
          const distance = Math.abs(pointerX - anchorX);
          const proximity = 0.28 + Math.max(0, 1 - distance / (vineBounds.width * 0.72)) * 0.72;
          const delay = Math.min(110, distance * 0.14);
          const restingX = baseX * response.x;
          const restingY = baseY * response.y;
          const restingRotation = baseRotation * response.rotate;
          const gustX = windX * proximity * response.x;
          const gustY = (windY - Math.abs(windX) * 0.08) * proximity * response.y;
          const gustRotation = windX * 0.13 * response.rotate * proximity;

          setBranchPosition(branch, restingX, restingY, restingRotation);
          gustTimers.push(window.setTimeout(() => {
            setBranchPosition(branch, restingX + gustX, restingY + gustY, restingRotation + gustRotation);
          }, delay));
          gustTimers.push(window.setTimeout(() => {
            setBranchPosition(branch, restingX - gustX * 0.24, restingY - gustY * 0.18, restingRotation - gustRotation * 0.28);
          }, delay + 190));
          gustTimers.push(window.setTimeout(() => {
            setBranchPosition(branch, restingX, restingY, restingRotation);
          }, delay + 480));
        });
      });
    };

    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", reset);
    reducedMotion.addEventListener("change", reset);
    finePointer.addEventListener("change", reset);
    reset();

    return () => {
      cancelAnimationFrame(animationFrame);
      clearGustTimers();
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", reset);
      reducedMotion.removeEventListener("change", reset);
      finePointer.removeEventListener("change", reset);
    };
  }, []);

  return (
    <>
      <section ref={productSectionRef} id="product" className="relative overflow-hidden bg-[#f8f7f2] py-20 lg:py-28">
        <div
          ref={vinesRef}
          aria-hidden
          data-vines-interactive
          className="pointer-events-none absolute right-0 top-0 hidden aspect-[1761/893] w-[min(39vw,650px)] lg:block"
        >
          <img
            src={solutionsHangingVines.src}
            alt=""
            data-reference-visual="solutions-vines"
            className="absolute inset-0 size-full object-contain object-right-top [clip-path:polygon(0_0,100%_0,100%_28%,92%_25%,83%_29%,72%_25%,60%_29%,48%_23%,36%_28%,24%_25%,12%_30%,0_24%)]"
          />
          {VINE_BRANCHES.map((branch, index) => (
            <img
              key={branch.clipPath}
              src={solutionsHangingVines.src}
              alt=""
              data-vine-branch={index}
              className="absolute inset-0 size-full object-contain object-right-top"
              style={{
                clipPath: branch.clipPath,
                transformOrigin: `${(index === 0 ? 9 : (index + 0.5) * 10)}% 2%`,
                "--vine-duration": `${branch.duration}ms`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="pdf-grid relative">
          <Reveal>
            <SectionHead kicker="Our solutions" title="Two solutions for urban greening at every scale" lead="Two product lines for roofs and urban landscapes." />
          </Reveal>
        </div>
        <div data-solution-grid className="solutions-reference-grid relative mt-12 grid gap-6 xl:grid-cols-2 xl:gap-10">
          {SOLUTIONS.map((solution, index) => (
            <Reveal key={solution.title} delay={index * 0.08} className="solution-frame h-full">
              <article className="group relative h-full overflow-hidden rounded-[22px] border border-[color:var(--brand-line)] bg-[#fbfaf6] p-7 shadow-[0_18px_55px_rgba(20,24,22,.07)] sm:p-8 xl:min-h-[560px]">
                <div data-solution-copy className="relative z-10">
                  <div className="flex items-center gap-7 xl:max-w-[74%]">
                    <span data-solution-icon className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-[color:var(--brand-moss)] text-white"><Icon name={solution.icon} className="size-8" /></span>
                    <p data-solution-kicker className="label text-[13px] leading-relaxed text-[color:var(--brand-moss)]">{solution.kicker}</p>
                  </div>
                  <h3 className="mt-5 text-[30px] font-bold leading-[1.08] xl:max-w-[58%] xl:text-[34px]">
                    {index === 0 ? <>Live Sphagnum<br />Fuscum</> : <>Substrate platform<br />for roofs and landscape</>}
                  </h3>
                  <span className="mt-6 block h-0.5 w-10 bg-[color:var(--brand-lime)]" aria-hidden />
                  <p className="mt-6 text-[15px] leading-[1.55] text-[color:var(--brand-muted)] xl:max-w-[62%] xl:text-[16px]">{solution.lead}</p>
                  <p className="label mt-9 text-[13px] text-[color:var(--brand-moss)] xl:max-w-[62%]">Key properties</p>
                  <ul className="mt-4 grid gap-3 xl:max-w-[62%]">
                    {solution.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-[14px] leading-snug xl:text-[15px]">
                        <Leaf className="mt-0.5 size-[18px] shrink-0 text-[color:var(--brand-moss)]" strokeWidth={1.7} aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <img
                  src={SOLUTION_IMAGES[index].src}
                  alt=""
                  aria-hidden
                  data-solution-image
                  className="relative -mr-7 ml-auto mt-8 h-[280px] w-full object-contain object-bottom object-right mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.03] sm:-mr-8 xl:absolute xl:bottom-0 xl:right-0 xl:mr-0 xl:mt-0 xl:h-[80%] xl:w-[58%]"
                />
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="fuscum" className="bg-[#f8f7f3] pb-16 lg:pb-24">
        <div className="pdf-grid grid overflow-hidden rounded-[24px] border border-[color:var(--brand-line)] bg-[#faf9f7] lg:min-h-[608px] lg:grid-cols-[1.08fr_.92fr]">
          <div className="relative min-h-[470px] overflow-hidden p-8 sm:p-12 lg:min-h-[608px]">
            <h2 className="label flex items-center gap-2 text-[12px] text-[color:var(--brand-moss)]"><Leaf className="size-5" strokeWidth={1.8} aria-hidden />Raw-material base</h2>
            <span className="mt-5 block h-0.5 w-12 bg-[color:var(--brand-moss)]" aria-hidden />
            <p className="mt-12 whitespace-nowrap text-[52px] font-bold leading-none tracking-[-.055em] sm:text-[76px] lg:text-[88px]">53,000 <span className="text-[.42em] tracking-normal text-[#5f792a]">km²</span></p>
            <p className="mt-3 text-[28px] font-bold leading-none sm:text-[34px]">of pristine wetland</p>
            <img src={wetlandLandscape.src} alt="Living sphagnum wetlands in Western Siberia" className="absolute inset-x-0 bottom-0 h-[44%] w-full object-cover" />
          </div>
          <div className="p-8 sm:p-12 lg:pt-16">
            <p className="text-[16px] leading-relaxed text-[color:var(--brand-ink-85)]">The Vasyugan wetlands of Western Siberia form the world&rsquo;s largest wetland system and the base of our raw material. Harvesting is deliberately shallow: the bog closes over and the same field is cut again a few years later. That is what makes it renewable, unlike peat, which takes thousands of years to form.</p>
            <dl className="mt-8">
              {WETLAND_FACTS.map((fact, index) => (
                <div key={fact.value} className="grid grid-cols-[48px_82px_1fr] items-center gap-3 border-b border-[color:var(--brand-line)] py-4 last:border-b-0 sm:grid-cols-[54px_100px_1fr] sm:gap-4">
                  <span className="grid size-12 place-items-center rounded-xl bg-[#f1f4e9] text-[color:var(--brand-moss)]"><Icon name={index === 0 ? "shovel" : index === 1 ? "refresh" : "hand"} /></span>
                  <dt className="text-[19px] font-bold text-[#5f792a] sm:text-[21px]">{fact.value}</dt>
                  <dd className="border-l border-[color:var(--brand-line)] pl-3 text-[13px] leading-snug text-[color:var(--brand-muted)] sm:pl-4 sm:text-[14px]">{fact.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="bg-[#fafafa] pb-20 lg:pb-[143px]">
        <figure className="pdf-grid living-wall-frame">
          <img src={livingWallWide.src} alt="Wide framed living wall composed of mosses, ferns and trailing plants" className="block h-auto w-full object-contain" />
        </figure>
      </section>

      <section
        className="relative overflow-hidden pt-20 lg:pt-28"
        style={{
          background:
            "radial-gradient(ellipse at 8% 82%, rgba(118,148,72,.24), transparent 32%), radial-gradient(ellipse at 92% 76%, rgba(151,175,91,.18), transparent 28%), #f8f9f4",
        }}
      >
        <div className="pdf-grid relative z-10 pb-40 lg:pb-[373px]">
          <Reveal><SectionHead kicker="Substrate platform for outdoors" title="Engineered root-zone performance" lead="Science-backed substrate technology for healthy plants and lasting green spaces." /></Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLATFORM_PILLARS.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 0.08}>
                <article className="h-full rounded-[18px] border border-[color:var(--brand-line)] bg-white/90 p-7 shadow-[0_14px_38px_rgba(20,24,22,.06)] backdrop-blur">
                  <div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-xl bg-[#edf3e6] text-[color:var(--brand-moss)]"><Icon name={pillar.icon} className="size-6" /></span><span className="text-[13px] font-semibold text-[color:var(--brand-line)]">0{index + 1}</span></div>
                  <h3 className="mt-5 text-[20px] font-bold">{pillar.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--brand-muted)]">{pillar.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
        <img data-reference-visual="root-zone-scene" src={rootZoneStrip.src} alt="Moss, seedlings and mineral substrate forming a healthy root-zone layer" className="absolute inset-x-0 bottom-0 h-auto w-full object-contain object-bottom [mask-image:linear-gradient(to_bottom,transparent_0%,#000_32%,#000_100%)]" />
      </section>

      <section data-reference-surface="benefits" className="w-full bg-[#fbfaf8]">
        <div className="pdf-grid py-14 lg:py-40">
          <h3 className="text-[28px] font-bold">Benefits</h3><span className="mt-4 block h-0.5 w-12 bg-[color:var(--brand-moss)]" aria-hidden />
          <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_BENEFITS.map((benefit, index) => (
              <article key={benefit.title} className="grid grid-cols-[48px_1fr] gap-4 border-b border-[color:var(--brand-line)] py-7 sm:px-5 lg:border-r lg:[&:nth-child(3n)]:border-r-0">
                <span className="grid size-11 place-items-center rounded-lg bg-[#f1f3ec] text-[color:var(--brand-moss)]"><Icon name={["shield", "droplet", "moss", "weight", "flask", "moss"][index]} /></span>
                <div><span className="text-[12px] font-semibold text-[color:var(--brand-moss)]">0{index + 1}</span><h4 className="mt-1 text-[16px] font-bold">{benefit.title}</h4><p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--brand-muted)]">{benefit.text}</p></div>
              </article>
            ))}
          </div>
          <h3 className="mt-12 text-[28px] font-bold">Product range</h3><span className="mt-4 block h-0.5 w-12 bg-[color:var(--brand-moss)]" aria-hidden />
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {PRODUCT_LINE.map((product, index) => (
              <article key={product.name} className="flex gap-5 rounded-xl border border-[color:var(--brand-line)] p-6"><span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#f1f3ec] text-[color:var(--brand-moss)]"><Icon name={["moss", "shield", "star"][index]} /></span><div><h4 className="text-[17px] font-bold">{product.name}</h4><p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--brand-muted)]">{product.text}</p><ArrowRight className="mt-4 size-4 text-[color:var(--brand-moss)]" aria-hidden /></div></article>
            ))}
          </div>
          <a href="#contact" className="btn btn-primary mt-7 inline-flex text-[13px]">Request Technical Details <ArrowUpRight className="size-4" /></a>
        </div>
      </section>

      <section id="projects" className="relative overflow-hidden bg-[#000b07] py-20 text-[color:var(--brand-cream)] lg:py-28">
        <img data-reference-visual="portfolio-botanical" src={portfolioBotanical.src} alt="" aria-hidden className="pointer-events-none absolute bottom-2 left-0 hidden h-auto w-[191.25px] mix-blend-lighten lg:block" />
        <img data-reference-visual="portfolio-dots" src={portfolioDots.src} alt="" aria-hidden className="pointer-events-none absolute bottom-2 left-[191.25px] hidden h-auto w-[212.5px] mix-blend-lighten lg:block" />
        <div data-reference-visual="portfolio-baseline" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2 bg-[linear-gradient(to_bottom,#8d782d_0%,#c4a239_45%,#c4a239_100%)]" />
        <div className="pdf-grid relative grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div><p className="label inline-block border border-[color:var(--brand-gold)] px-3 py-2 text-[10px] text-[color:var(--brand-gold)]">Global portfolios</p><h2 className="portfolio-title mt-8 text-[42px] leading-[1.02] sm:text-[54px]">Flagship <span className="block text-[color:var(--brand-gold)]">Installations</span></h2><span className="mt-8 block h-px w-16 bg-[color:var(--brand-gold)]" /><p className="mt-8 text-[15px] leading-relaxed text-[color:var(--brand-cream-72)]">Stunning green installations designed for reliable performance, visual impact and demanding climates.</p></div>
          <div className="min-w-0">
            <div ref={projectsRef} className="hide-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
              {PROJECTS.map((project, index) => (
                <article key={project.title} className="group flex w-[82vw] max-w-[360px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[rgba(215,177,94,.28)] bg-[#082117] first:border-[color:var(--brand-gold)] sm:w-[330px]">
                  <img src={PROJECT_IMAGES[index].src} alt={project.alt} className="h-[300px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  <div className="flex flex-1 flex-col p-6"><span className="grid size-10 place-items-center rounded-lg border border-[rgba(215,177,94,.55)] text-[color:var(--brand-gold)]"><Icon name={project.icon} /></span><h3 className="mt-5 text-[23px] leading-tight text-[color:var(--brand-gold)]">{project.title}</h3><span className="mt-4 h-px w-9 bg-[color:var(--brand-gold)]" /><p className="mt-4 flex-1 text-[13.5px] leading-relaxed text-[color:var(--brand-cream-72)]">{project.text}</p><a href="#contact" className="label mt-6 flex items-center gap-2 text-[10px] text-[color:var(--brand-gold)]">Discuss project <ArrowRight className="size-4" /></a></div>
                </article>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => onScrollProjects(-1)} aria-label="Previous projects" className="grid size-12 place-items-center border border-[color:var(--brand-gold)] text-[color:var(--brand-gold)] transition-colors hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-ink)]"><ArrowLeft /></button><button type="button" onClick={() => onScrollProjects(1)} aria-label="Next projects" className="grid size-12 place-items-center bg-[color:var(--brand-gold)] text-[color:var(--brand-ink)]"><ArrowRight /></button></div>
          </div>
        </div>
      </section>

      <section id="applications" className="bg-[#f7f4ef] py-20 lg:pb-[136px] lg:pt-28">
        <div className="pdf-grid">
          <Reveal><SectionHead kicker="Applications" title="Where our solutions perform" /></Reveal>
          <div className="mt-14 grid gap-20 lg:gap-28">
            {APPLICATIONS.map((application, index) => (
              <Reveal key={application.title} anim={index % 2 ? "right" : "left"}>
                <article className={`grid items-center gap-10 lg:gap-16 ${index === 0 ? "lg:min-h-[700px] lg:grid-cols-[1.08fr_.92fr]" : index === 1 ? "lg:min-h-[760px] lg:grid-cols-[.88fr_1.12fr]" : "lg:min-h-[780px] lg:grid-cols-[.96fr_1.04fr]"}`}>
                  <figure className={`overflow-hidden rounded-[18px] bg-white shadow-[0_18px_50px_rgba(20,24,22,.07)] ${index > 0 ? "lg:order-2" : ""}`}><img src={APPLICATION_IMAGES[index].src} alt={application.diagramAlt} className="h-auto w-full object-contain" /></figure>
                  <div><p className="label text-[11px] text-[color:var(--brand-moss)]">Applications</p><span className="mt-4 block h-px w-10 bg-[color:var(--brand-moss)]" /><span className="mt-8 block text-[13px] font-bold text-[#5f792a]">0{index + 1}</span><h3 className="mt-3 text-[33px] font-bold leading-[1.08] lg:text-[40px]">{application.title}</h3><p className="mt-5 text-[15px] leading-relaxed text-[color:var(--brand-muted)]">{application.text}</p>
                    <ul className={`mt-8 grid gap-4 ${application.benefits.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                      {application.benefits.map((benefit) => <li key={benefit.title} className="min-w-0"><span className="grid size-12 place-items-center rounded-xl bg-[#edf3e6] text-[color:var(--brand-moss)]"><Icon name={benefit.icon} /></span><span className="mt-3 block text-[13px] font-bold leading-tight">{benefit.title}</span>{"text" in benefit ? <span className="mt-1 block text-[12px] leading-snug text-[color:var(--brand-muted)]">{benefit.text}</span> : null}</li>)}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="advantages" className="bg-[#0f1314] py-20 text-[color:var(--brand-cream)] lg:py-28">
        <div className="pdf-grid">
          <div className="grid gap-8 border-b border-[rgba(215,177,94,.55)] pb-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end"><div><p className="label text-[11px] text-[color:var(--brand-gold)]">Why us</p><span className="mt-3 block h-px w-12 bg-[color:var(--brand-gold)]" aria-hidden /><h2 className="mt-5 text-[38px] font-bold leading-[1.03] sm:text-[52px]">Sphagnum Eco — <span className="block text-[color:var(--brand-gold)]">advantages</span></h2></div><p className="max-w-[42ch] text-[15px] leading-relaxed text-[color:var(--brand-cream-72)]">From raw material to finished substrate, we ensure quality, consistency, and support you can rely on for every project.</p></div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {ADVANTAGES.map((advantage) => <article key={advantage.num} className="grid gap-5 rounded-xl border border-[color:var(--brand-cream-15)] p-6 sm:grid-cols-[84px_1fr]"><span className="grid size-20 place-items-center rounded-full border border-[rgba(215,177,94,.45)] text-[color:var(--brand-gold)]"><Icon name={advantage.icon} className="size-9" /></span><div><span className="text-[13px] font-semibold text-[color:var(--brand-gold)]">{advantage.num}</span><h3 className="mt-1 text-[20px] font-bold">{advantage.title}</h3><span className="mt-3 block h-px w-10 bg-[color:var(--brand-gold)]" /><p className="mt-3 text-[13.5px] leading-relaxed text-[color:var(--brand-cream-72)]">{advantage.text}</p></div></article>)}
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{TAGS.map((tag, index) => <span key={tag} data-advantage-tag className="flex items-center justify-center gap-3 rounded-full border border-[rgba(215,177,94,.42)] px-4 py-2.5 text-[13px] text-[color:var(--brand-cream-85)]"><Icon name={TAG_ICONS[index]} className="size-5 shrink-0 text-[color:var(--brand-gold)]" />{tag}</span>)}</div>
        </div>
      </section>
    </>
  );
}

export default function SphagnumLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [stripCard, setStripCard] = useState(0);
  const heroRef = useRef<HTMLElement | null>(null);
  const projectsRef = useRef<HTMLDivElement | null>(null);

  const scrollProjects = (direction: -1 | 1) => {
    projectsRef.current?.scrollBy({
      left: direction * Math.min(projectsRef.current.clientWidth * 0.82, 430),
      behavior: "smooth",
    });
  };

  // Автокарусель нижней полосы героя — 3500 мс, как в референсе.
  useEffect(() => {
    const id = window.setInterval(() => setStripCard((c) => (c + 1) % STRIP_CARDS.length), 3500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const el = heroRef.current;
      const threshold = el ? Math.min(el.offsetHeight * 0.12, 96) : 24;
      setScrolled(window.scrollY > threshold);
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

      {/*
        ═══════════ ШАПКА (фиксированная) ═══════════
        Пока шапка не «прилипла», под ней лежит первый экран, и с него в правый
        верхний угол бьют лучи. Прозрачная шапка на этом свету теряет читаемость:
        замер дал 2.99:1 у ссылки «Contact» — провал AA. Поэтому в непрокрученном
        состоянии не bg-transparent, а мягкая тень-подложка сверху вниз: она
        держит подписи и при этом не читается панелью. После прокрутки шапка
        становится сплошь кремовой, и подложка не нужна.
        Замер после правки — в комментарии к затемнению первого экрана ниже.
      */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
          scrolled ? "border-b border-[color:var(--brand-line)] bg-[color:var(--brand-cream)] backdrop-blur" : ""
        }`}
        style={
          scrolled
            ? undefined
            : { background: "linear-gradient(180deg, rgba(20,24,22,.72) 0%, rgba(20,24,22,.42) 62%, rgba(20,24,22,0) 100%)" }
        }
      >
        {/* Верхний служебный ярус — как у референса: второстепенные ссылки и язык
            уводятся из основного меню, чтобы оно не разрасталось. */}
        <div
          className={`hidden border-b transition-colors lg:block ${
            scrolled ? "border-[color:var(--brand-line)] bg-[color:var(--brand-cream)]" : "border-[color:var(--brand-cream-15)] bg-[color:var(--brand-ink-45)]"
          }`}
        >
          <div className="flex items-center justify-end gap-7 py-2.5 pdf-grid">
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

        <div className="a-in flex items-center gap-6 py-4 pdf-grid">
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
        {/*
          Фон живёт ЗДЕСЬ, внутри флекс-области над полосой панелей, а не на всю
          высоту первого экрана. Раньше он был absolute inset-0 у всего экрана и
          уходил ПОД полосу: нижняя часть кадра со стойкой ресепшена честно
          рисовалась, но её закрывали панели, и стол не было видно. Теперь
          видимая коробка кадра — ровно то, что над полосой.
        */}
        <div className="relative flex flex-1 flex-col">
        <div
          // inset-0, а НЕ прежний запас -inset-y-[20%]: запас существовал ровно
          // ради параллакса — фон уезжал вверх, и без него оголилась бы полоса.
          // Параллакс убран, значит запас стал вредным: он растягивал кадр по
          // высоте на 140% экрана и срезал по бокам куда больше нужного. Теперь
          // высота кадра равна высоте первого экрана, ровно до нижней полосы.
          //
          // Привязка к правому НИЖНЕМУ углу. Стойка ресепшена стоит внизу
          // справа, и при верхней привязке её срезало ровно то, ради чего кадр
          // и выбран. Видимая коробка шире кадра (около 2.03 против 1.79),
          // поэтому обрезка идёт по высоте — и терять надо верх со стеклянной
          // кровлей, а не низ со столом. Срезается около 12% высоты.
          //
          // На узком экране привязка по горизонтали ДРУГАЯ: там cover срезает
          // по ширине почти всё, и кадр приколот к левому краю. Тот же порог
          // продублирован в LivingWall (matchMedia 1024px) — меняете здесь,
          // меняйте и там, иначе холст прыгнет относительно подложки.
          className="absolute inset-0 bg-cover bg-left-bottom bg-no-repeat lg:bg-right-bottom"
          style={{
            backgroundImage: `url("${receptionWall.src}")`,
            filter: HERO_BG_FILTER,
          }}
          aria-hidden
        />
        {/*
          Живой слой поверх статического фона: та же фотография, но листва
          шевелится под курсором. Классы и фильтр ОБЯЗАНЫ совпадать со
          статической подложкой выше — иначе в момент появления холста картинка
          прыгнет по кадру или по тону. Если WebGL нет, текстура не загрузилась
          или включено «меньше движения», холст остаётся прозрачным и виден
          статический фон: пустого экрана не бывает ни в одном из случаев.

          Слушатель курсора живёт на секции героя (heroRef), а не на холсте: холст
          pointer-events:none, да и ловить надо движение над всем первым экраном.
        */}
        <LivingWall
          src={receptionWall.src}
          pointerTargetRef={heroRef}
          className="absolute inset-0"
          style={{ filter: HERO_BG_FILTER }}
        />
        {/*
          Затемнение под текст. Раньше был один диагональный градиент — на
          десктопе он работал, но на узком экране контент занимает ВСЮ ширину,
          и правый край текста оказывался на прозрачной части (34%), где
          контраст рушился. Поэтому подложек две: вертикальная для мобильного,
          диагональная с lg. Цвет — глубокий зелёный rgb(9,26,17), не серый
          brand-ink: нейтрально-серая пелена поверх зелёной фотографии уводила
          цвет в хаки и была главным виновником «бледности» фона — даже там,
          где яркости хватало. Зелёный скрим держит тон стены.

          Правее текста пелена сходит на нет РАНО: .04 к 66% и 0 к 78%
          (было 78% и 92%). Клин сдвинут влево намеренно — сходил он слишком
          поздно, и на 60% ширины ещё держалось около .50, отчего правая
          половина читалась приглушённой. Двигались только эти два стопа:
          заголовок тянется до 56% ширины, поэтому всё левее 46% осталось
          нетронутым, и контраст текста этой правкой не оплачен.

          Средний стоп 46% — .84. ВАЖНО, чего он на самом деле стоит: ведущий
          абзац лежит на 4–24% ширины, то есть на участке, который тянет к себе
          НАЧАЛЬНЫЙ стоп (.90), а не средний. Замер по сетке (подмена градиента
          прямо в DOM, скриншот 1440×900, замер по фактическому фону под
          строкой): .78 → 5.70:1, .80 → 5.72:1, .82 → 5.74:1, .84 → 5.74:1,
          .86 → 5.75:1. Разброс 0.05 — рычаг практически нулевой. Хотите
          двигать контраст под ведущим абзацем — двигайте начальный стоп или
          яркость фона, средний тут почти ни при чём.

          Замер на новом кадре (скриншоты 1440×900 и 390×844 с ВКЛЮЧЁННЫМ живым
          холстом, фактический фон под рендером текста, маскированный метод —
          без пикселей самих глифов, формула WCAG): cream (#F4F1EA) под h1 —
          12.13:1 (минимум по двум ширинам), sage (#8AA18A) под ведущим абзацем
          — 5.02:1 (минимум, это мобильный). Оба выше порогов 3:1 и 4.5:1 на
          текущих filter: brightness(.80) saturate(1.20) contrast(1.08),
          десктопном скриме .90/.84/.18 и мобильном .90/.80.
          Мобильный скрим замером проходит (5.02:1) и не тронут.
        */}
        <div
          className="absolute inset-0 lg:hidden"
          aria-hidden
          style={{ background: "linear-gradient(180deg, rgba(9,26,17,.90) 0%, rgba(9,26,17,.80) 100%)" }}
        />
        <div
          className="absolute inset-0 hidden lg:block"
          aria-hidden
          style={{
            background:
              "linear-gradient(100deg, rgba(9,26,17,.92) 0%, rgba(9,26,17,.86) 46%, rgba(9,26,17,.04) 66%, rgba(9,26,17,0) 78%)",
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
            Лучи идут ДО текста намеренно: после текста они засветили бы
            заголовок. Отсчёт нужен от угла кадра, поэтому inset-0 по всей сцене.
          */}
          <div className="relative pdf-grid">
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
                  className="btn btn-gold inline-flex w-full whitespace-nowrap text-[13px] sm:w-auto sm:px-9 lg:py-[18px] lg:text-[14px]"
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
      <PdfAlignedSections projectsRef={projectsRef} onScrollProjects={scrollProjects} />


      {/* ═══════════ РАЗДЕЛ 11 — FAQ ═══════════ */}
      <section id="faq" className="bg-[color:var(--brand-cream)] py-24 lg:py-36">
        <div className="pdf-grid">
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

        <div className="relative grid gap-14 lg:grid-cols-[1fr_500px] lg:gap-20 pdf-grid">
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
        <div className="flex flex-col gap-2 text-[13px] sm:flex-row sm:items-center pdf-grid">
          <p>© 2026 Sphagnum Eco · Natural Substrates · All rights reserved.</p>
          <a href={`mailto:${CONTACT.email}`} className="hover:text-[color:var(--brand-cream)] sm:ml-auto">
            {CONTACT.email}
          </a>
        </div>
      </footer>
    </div>
  );
}
