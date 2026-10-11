"use client";

// Превью встроенных картинок сайта для полей «своя картинка»: пока поле пустое,
// на сайте стоят именно они.
import type { ReactNode } from "react";
import type { BuiltInImage } from "@/lib/admin/fields";
import portfolioBotanical from "@/components/assets/reference/crops/portfolio-botanical-original.webp";
import portfolioDots from "@/components/assets/reference/crops/portfolio-dots-original.webp";
import solutionsHangingVines from "@/components/assets/reference/crops/solutions-hanging-vines-transparent.png";
import { SphagnumLogo } from "@/components/sphagnum-logo";

const picture = (src: string) => <img src={src} alt="" loading="lazy" />;

export const BUILT_IN_PREVIEW: Record<BuiltInImage, () => ReactNode> = {
  vines: () => picture(solutionsHangingVines.src),
  // Ботаника и точки — светлые на тёмной секции: превью на тёмной подложке.
  botanical: () => <span className="adm-preview__dark">{picture(portfolioBotanical.src)}</span>,
  dots: () => <span className="adm-preview__dark">{picture(portfolioDots.src)}</span>,
  logo: () => (
    <span className="adm-preview__dark adm-preview__logo">
      <SphagnumLogo className="adm-preview__svg" />
    </span>
  ),
  logoOnLight: () => (
    <span className="adm-preview__light adm-preview__logo">
      <SphagnumLogo className="adm-preview__svg" />
    </span>
  ),
};
