"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Instagram, Play, X } from "lucide-react";

export type GalleryPhoto = {
  id: string;
  href: string;
  image: string;
  video: string | null;
  title: string;
  text: string;
  date: string;
};

/** Плитка-ролик: крутится без звука, только пока видна на экране, — как в
    ленте Instagram. При «уменьшить движение» остаётся постер. */
function TileVideo({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) element.play().catch(() => {});
        else element.pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-label={alt} className="block h-auto w-full transition-transform duration-700 group-hover:scale-[1.04]" />;
}

/** Сколько фото видно сразу; остальные — по кнопке «Show more». */
const INITIAL = 16;

/* Фотогалерея из Instagram — содержимое блока «Global portfolios»: masonry —
   колонки фото в их собственных пропорциях (1:1, 4:5), без обрезки в квадрат.
   Высота плиток разная, порядок — по рядам слева направо.
   По клику — просмотр на весь экран с листанием по всем фото. */
export function InstagramGallery({ photos, profile, username }: { photos: GalleryPhoto[]; profile: string; username: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const current = open === null ? null : photos[open];
  const visible = expanded ? photos : photos.slice(0, INITIAL);

  // Раскладка masonry по рядам: фото i уходит в колонку i % columns. CSS columns
  // заполняли бы колонки сверху вниз, и порядок (новые → старые) читался бы
  // столбцами. Число колонок — как у брейкпоинтов sm/lg.
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    const queries = [window.matchMedia("(min-width: 1024px)"), window.matchMedia("(min-width: 640px)")];
    const update = () => setColumns(queries[0].matches ? 4 : queries[1].matches ? 3 : 2);
    update();
    queries.forEach((query) => query.addEventListener("change", update));
    return () => queries.forEach((query) => query.removeEventListener("change", update));
  }, []);
  const lanes = Array.from({ length: columns }, (_, lane) => visible.map((photo, index) => ({ photo, index })).filter(({ index }) => index % columns === lane));

  const step = (direction: -1 | 1) => setOpen((index) => (index === null ? null : (index + direction + photos.length) % photos.length));

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    // Пока открыт просмотр, страница под ним не прокручивается.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
    // Подписка нужна на сам факт открытия; step меняет индекс через setOpen.
  }, [open === null]);

  if (photos.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(215,177,94,.35)] pb-5">
        <div>
          <p className="label inline-block border border-[color:var(--brand-gold)] px-3 py-2 text-[10px] text-[color:var(--brand-gold)]">Gallery</p>
          <h2 className="portfolio-title mt-6 text-[38px] leading-[1.02] sm:text-[48px]">Our <span className="text-[color:var(--brand-gold)]">Gallery</span></h2>
        </div>
        <a href={profile} target="_blank" rel="noopener noreferrer" className="label inline-flex items-center gap-2 border border-[color:var(--brand-gold)] px-4 py-3 text-[10px] text-[color:var(--brand-gold)] transition-colors hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-ink)]">
          <Instagram className="size-4" strokeWidth={1.6} aria-hidden />
          Follow @{username}
        </a>
      </div>

      <div className="mt-6 flex items-start gap-2 sm:gap-3">
        {lanes.map((lane, laneIndex) => (
          <ul key={laneIndex} className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-3">
            {lane.map(({ photo, index }) => (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setOpen(index)}
                  aria-label={`Open: ${photo.title}`}
                  className="group relative block w-full overflow-hidden rounded-lg bg-[#082117] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-gold)]"
                >
                  {photo.video ? (
                    <TileVideo src={photo.video} poster={photo.image} alt={photo.title} />
                  ) : (
                    <img src={photo.image} alt={photo.title} loading="lazy" className="block h-auto w-full transition-transform duration-700 group-hover:scale-[1.04]" />
                  )}
                  <span className="pointer-events-none absolute inset-0 flex items-end bg-[linear-gradient(to_top,rgba(0,11,7,.85),rgba(0,11,7,0)_55%)] p-3 text-left text-[12px] leading-snug text-[color:var(--brand-cream)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="line-clamp-3">{photo.title}</span>
                  </span>
                  {photo.video ? (
                    <span className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[rgba(0,11,7,.55)] text-[color:var(--brand-gold)]">
                      <Play className="size-3.5" strokeWidth={1.8} aria-hidden />
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>

      {photos.length > INITIAL ? (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => setExpanded((value) => !value)} className="label border border-[color:var(--brand-gold)] px-6 py-3 text-[10px] text-[color:var(--brand-gold)] transition-colors hover:bg-[color:var(--brand-gold)] hover:text-[color:var(--brand-ink)]">
            {expanded ? "Show less" : `Show more (${photos.length - INITIAL})`}
          </button>
        </div>
      ) : null}

      {current ? (
        <div role="dialog" aria-modal="true" aria-label={current.title} className="fixed inset-0 z-[900] flex items-center justify-center bg-[rgba(0,11,7,.92)] p-4 sm:p-8" onClick={() => setOpen(null)}>
          <div className="relative grid max-h-full w-full max-w-[1040px] overflow-hidden rounded-xl border border-[rgba(215,177,94,.35)] bg-[#082117] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex max-h-[62vh] items-center justify-center bg-black md:max-h-[86vh]">
              {current.video ? (
                <video key={current.id} src={current.video} poster={current.image} controls autoPlay loop playsInline className="max-h-[62vh] w-full object-contain md:max-h-[86vh]" />
              ) : (
                <img key={current.id} src={current.image} alt={current.title} className="max-h-[62vh] w-full object-contain md:max-h-[86vh]" />
              )}
            </div>
            <div className="flex max-h-[30vh] flex-col overflow-y-auto p-6 text-[color:var(--brand-cream)] md:max-h-[86vh]">
              <span className="label text-[10px] text-[color:var(--brand-gold)]">{current.date}</span>
              <h3 className="mt-3 text-[20px] leading-tight text-[color:var(--brand-gold)]">{current.title}</h3>
              {current.text ? <p className="mt-4 whitespace-pre-line text-[13.5px] leading-relaxed text-[color:var(--brand-cream-72)]">{current.text}</p> : null}
              <span className="label mt-auto pt-6 text-[10px] text-[color:var(--brand-cream-72)]">{open! + 1} / {photos.length}</span>
              <a href={current.href} target="_blank" rel="noopener noreferrer" className="label mt-3 inline-flex items-center gap-2 text-[10px] text-[color:var(--brand-gold)]">
                View on Instagram <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="absolute right-4 top-4 grid size-11 place-items-center border border-[color:var(--brand-gold)] text-[color:var(--brand-gold)]"><X /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); step(-1); }} aria-label="Previous photo" className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center border border-[color:var(--brand-gold)] bg-[rgba(0,11,7,.6)] text-[color:var(--brand-gold)] sm:left-4"><ArrowLeft /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); step(1); }} aria-label="Next photo" className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center bg-[color:var(--brand-gold)] text-[color:var(--brand-ink)] sm:right-4"><ArrowRight /></button>
        </div>
      ) : null}
    </div>
  );
}
