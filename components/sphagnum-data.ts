// Landing copy for SPHAGNUM ECO — kept out of the JSX so text edits never touch markup.
// Source of truth: «Struktura-saita_EN_shortened» brief. That revision deliberately
// hedges claims ("can reduce", "help extend") and drops unverifiable specifics
// (Abu Dhabi energy modelling, LEED v5, VOC uptake, the Growplant brand name).
// Do NOT re-add them without a written source — this is a commercial page.

export const NAV_LINKS = [
  { id: "product", label: "Products" },
  { id: "applications", label: "Applications" },
  { id: "fuscum", label: "Sphagnum Fuscum" },
  { id: "projects", label: "Projects" },
  { id: "advantages", label: "Why Us" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
] as const;

/** Shared across the header widget and the closing form — brief §12 dropdown. */
export const PROJECT_TYPES = [
  "Green roof / podium",
  "Vertical garden / green wall",
  "Interior planting",
  "Urban landscaping / park",
  "Research / pilot project",
  "Other",
] as const;

export const VOLUME_RANGES = [
  "Up to 500 m²",
  "500–2,000 m²",
  "2,000–10,000 m²",
  "Over 10,000 m²",
] as const;

/* ───────────── Section 1 — Hero ───────────── */

export const HERO_BULLETS = [
  "Live sphagnum moss for interiors and shaded outdoor spaces",
  "Lightweight substrates for green roofs and podium decks",
  "Fertile growing media for parks, streetscapes and urban planting",
] as const;

export const HERO_DESIGNED_FOR = [
  { icon: "droplet", label: "Moisture control" },
  { icon: "wind", label: "Air purification" },
  { icon: "sprout", label: "Healthy, stable plant growth" },
] as const;

/* ───────────── Section 2 — Our solutions ───────────── */

export const SOLUTIONS = [
  {
    icon: "moss",
    kicker: "Vertical gardens · Green walls · Interiors",
    title: "Live Sphagnum Fuscum",
    lead: "Hand-harvested in Siberian nature reserves for vertical gardens, green walls, interior planting and arid-climate projects.",
    features: [
      "Absorbs 20–25× its own weight in water",
      "97% porosity for aeration and moisture retention",
      "12–16× lighter than soil",
      "Naturally antimicrobial; no chemical treatment",
    ],
  },
  {
    icon: "roof",
    kicker: "Green Roofs & Urban Landscapes",
    title: "Substrate platform for roofs and landscape",
    lead: "A mineral-organic substrate platform for intensive and extensive roofs, podium decks and accessible roof gardens.",
    features: [
      "Balances water retention and drainage",
      "Bulk density from 625 kg/m³ at natural moisture",
      "Resists compaction; premium pH approximately 6.5",
      "Economy, Standard and Premium versions",
    ],
  },
] as const;

export const CLIMATE_BENEFITS = [
  { icon: "sun", title: "Hot climates", text: "Formulated for extreme temperatures" },
  { icon: "droplet", title: "Water scarcity", text: "Can reduce irrigation needs by 60–80%" },
  { icon: "weight", title: "Structural load", text: "Bulk density from 625 kg/m³" },
] as const;

/* ───────────── Section 4 — Sphagnum Fuscum ───────────── */

export const FUSCUM_METRICS = [
  { value: "20–25×", label: "water absorption by weight" },
  { value: "97%", label: "pore volume for air and water" },
  { value: "12–16×", label: "lighter than soil (bulk density approximately 100 kg/m³)" },
  { value: "2–3 years", label: "service life without replacement" },
] as const;

export const FUSCUM_PROPERTIES = [
  {
    icon: "battery",
    title: "Natural water reservoir",
    text: "Its capillary structure stores and distributes moisture evenly, keeping roots hydrated for days and extending irrigation intervals.",
  },
  {
    icon: "wind",
    title: "Root-zone aeration",
    text: "Its fibrous structure preserves air pockets even when wet, helping prevent root rot.",
  },
  {
    icon: "shield",
    title: "Natural antimicrobial protection",
    text: "Its acidic environment and sphagnan compounds help inhibit bacteria and fungi.",
  },
  {
    icon: "recycle",
    title: "Renewable resource",
    text: "Only the upper 5–7 cm is hand-harvested; the bog naturally regenerates within 5–7 years.",
  },
] as const;

/* ───────────── Section 5 — Substrate platform for outdoors ───────────── */

export const PLATFORM_PILLARS = [
  {
    icon: "layers",
    title: "Lightweight mineral structure",
    text: "Expanded clay or foamed glass forms a stable base, reducing roof and podium loads while supporting plant roots.",
  },
  {
    icon: "porosity",
    title: "Smart porosity",
    text: "The substrate retains essential moisture while draining excess water, protecting roots and roof layers during irregular irrigation.",
  },
  {
    icon: "stable",
    title: "Long-term stability",
    text: "Designed to resist settlement, it maintains aeration and predictable plant performance over the system’s lifespan.",
  },
] as const;

export const PLATFORM_BENEFITS = [
  { title: "Stability", text: "Resists compaction so the landscape retains its finished appearance over time." },
  { title: "Moisture management", text: "Drains excess water to reduce root stress and protect waterproofing layers." },
  { title: "Aeration and drainage", text: "Balanced porosity delivers oxygen to roots and supports healthy soil biology." },
  { title: "Weight / bulk density", text: "Lightweight aggregates reduce structural requirements, with clear dry and saturated density data." },
  { title: "Chemical composition (pH and nutrition)", text: "Premium blends maintain a pH of approximately 6.5 and include starter NPK nutrition, with customisation available." },
  { title: "Natural components only", text: "No chemical additives; quality and environmental safety are verified by laboratory testing." },
] as const;

export const PRODUCT_LINE = [
  { name: "Economy", text: "A reliable solution for cost-sensitive projects" },
  { name: "Standard", text: "Consistent performance, verified quality and environmental safety" },
  { name: "Premium", text: "The lightest option with the lowest project-risk profile" },
] as const;

/* ───────────── Photography ─────────────
   Three fields per image, and they are NOT interchangeable:
     shot  — the brief for whoever produces the picture; shown inside the
             placeholder while `photo` is empty.
     alt   — what a screen reader and a crawler get. Written as a description
             of the final image, never as "photo of…".
     photo — the URL. Empty string = not delivered yet, PhotoSlot falls back
             to the captioned placeholder. Filling it in is a one-line change. */

export const APPLICATIONS = [
  {
    title: "Green roofs and podium decks",
    text: "For intensive and extensive roofs, accessible podium decks and parking-garage gardens. The substrate can lower roof-surface temperatures, reduce cooling demand and help extend waterproofing life.",
    shot: "accessible green roof terrace with lawn, shrubs and seating above a city",
    alt: "Accessible green roof terrace planted with lawn and shrubs above a city skyline",
    photo: "",
  },
  {
    title: "Vertical gardens and green walls",
    text: "For interior and façade green walls, ceiling gardens and mobile partitions. Sphagnum Fuscum is 12–16× lighter than soil, enabling designs that conventional substrates cannot support. It also contributes to air filtration, passive humidification and cooling.",
    shot: "full-height interior living green wall in a bright lobby",
    alt: "Full-height interior living green wall in a bright office lobby",
    photo: "",
  },
  {
    title: "Parks, streetscapes and arid landscaping",
    text: "Moisture-retaining mats improve tree and shrub survival in sandy soils and can reduce irrigation by 60–80%. Suitable for desert landscaping, erosion control, cooler surfaces and soil restoration.",
    shot: "landscaped street planting with young trees in an arid desert city",
    alt: "Landscaped street planting with young trees in an arid desert city",
    photo: "",
  },
] as const;

/* ───────────── Section 7 — Completed projects ─────────────
   Titles condense each case description from the brief; no new claims added.
   The brief also flags «OPTION TO ADD MORE CASE STUDIES» — append here. */

export const PROJECTS = [
  {
    tag: "Industrial park",
    title: "A garden on the third level",
    text: "A complete garden was created on the third level of an industrial park. Evergreen trees and bright planting formed a natural transition between nature and the urban setting, despite challenging high-level conditions.",
    shot: "rooftop garden with evergreen trees on an industrial park building",
    alt: "Rooftop garden with evergreen trees on the upper level of an industrial park",
    photo: "",
  },
  {
    tag: "Residential development",
    title: "A courtyard that stays attractive year-round",
    text: "A durable, welcoming courtyard landscape designed to remain attractive year-round and meet handover quality standards without rework.",
    shot: "landscaped residential courtyard with mature planting and walkways",
    alt: "Landscaped residential courtyard with mature planting and walkways",
    photo: "",
  },
  {
    tag: "Global IT company office",
    title: "Internal courtyards and rooftop areas",
    text: "Greening of internal courtyards and rooftop areas created a more vibrant workplace, supporting employee wellbeing and employer branding.",
    shot: "planted internal office courtyard with greenery and workplace seating",
    alt: "Planted internal office courtyard with greenery and seating for employees",
    photo: "",
  },
  {
    tag: "Business centre",
    title: "Entrance areas and an accessible roof",
    text: "Representative planting for entrance areas and an accessible roof, delivering lasting visual impact without costly remediation.",
    shot: "representative planting at the entrance of a modern business centre",
    alt: "Representative planting at the glazed entrance of a modern business centre",
    photo: "",
  },
] as const;

/* ───────────── Section 3 — supporting photo ───────────── */

export const WHY_PHOTO = {
  shot: "landscaped roof terrace of a residential development, wide shot",
  alt: "Landscaped roof terrace of a residential development",
  photo: "",
} as const;

/* ───────────── Section 8 — Advantages ───────────── */

export const ADVANTAGES = [
  {
    num: "01",
    title: "End-to-end production",
    text: "In-house production using advanced Premier Tech equipment, with capacity up to 80 m³/hour. We control every stage, from natural raw materials to finished substrate.",
  },
  {
    num: "02",
    title: "Laboratory quality control",
    text: "Every production batch is tested for composition and performance. All products are supplied with quality certificates and contain only natural components.",
  },
  {
    num: "03",
    title: "Custom formulations",
    text: "We develop blends for your climate, structure, plant palette and maintenance strategy. Technical consultation is included.",
  },
  {
    num: "04",
    title: "Reliable supply and support",
    text: "We meet delivery timelines and provide technical passports, laboratory reports and structural calculation data. Substrate-selection advice is included.",
  },
] as const;

export const TAGS = [
  "100% Natural",
  "Renewable",
  "Peat-Free",
  "Chemical-Free",
  "Hand-Harvested",
  "Carbon-Conscious",
] as const;

/* ───────────── Section 11 — FAQ ───────────── */

export const FAQ = [
  {
    q: "Can Sphagnum Eco substrates be used in hot climates such as Saudi Arabia and the UAE?",
    a: "Yes. Our products are designed for extreme temperatures. Sphagnum Fuscum can reduce irrigation demand by 60–80%, making it especially valuable in arid regions. Green-roof substrates are also tested for high surface temperatures.",
  },
  {
    q: "What structural load should be considered for green-roof substrates?",
    a: "Depending on the formulation, dry bulk density is 625–660 kg/m³ and fully saturated density is 850–910 kg/m³. Full design data is provided in the technical passport for structural engineers.",
  },
  {
    q: "How is Sphagnum Fuscum different from peat?",
    a: "Peat is decomposed, non-living organic matter formed over thousands of years. Sphagnum Fuscum is live moss that retains its natural structure, antimicrobial properties and water-holding capacity. Harvested areas regenerate within 5–7 years. The product is peat-free.",
  },
  {
    q: "Is an automatic irrigation system required when using Sphagnum Fuscum?",
    a: "It is recommended. Sphagnum retains moisture far longer than soil, allowing substantially longer irrigation intervals. For large interior installations, we recommend drip irrigation with moisture sensors to save water and maintenance time.",
  },
  {
    q: "Are quality certificates available?",
    a: "Yes. We provide quality certificates and laboratory reports for all products. Full technical passports are available on request, including density, pH, CEC, porosity and heavy-metal data.",
  },
  {
    q: "What are the minimum order quantity and delivery time?",
    a: "They depend on the product and destination. Contact us for a commercial offer within 24 hours.",
  },
] as const;

/* ───────────── Section 12 — Contacts ───────────── */

export const CONTACT = {
  person: "Vadim Tychkin",
  role: "Chief Sales Officer",
  phone: "+971 50 764 2603",
  phoneHref: "tel:+971507642603",
  email: "sales@sphagnum.ae",
} as const;

/* ───────────── Hero: per-word reveal with dimmed connectives ─────────────
   dim = grammatical glue drops to 45% opacity so a long headline reads as a
   rhythmic phrase instead of a wall of uppercase. */
export const HERO_WORDS: { text: string; dim?: boolean }[] = [
  { text: "Living" },
  { text: "substrates" },
  { text: "for", dim: true },
  { text: "green" },
  { text: "roofs,", dim: true },
  { text: "vertical", dim: true },
  { text: "gardens" },
  { text: "and", dim: true },
  { text: "interiors" },
];

/* ───────────── Hero: three-panel strip under the fold ───────────── */

export const STRIP_PANEL_1 = {
  text: "We will match a substrate to your project and climate",
  linkLabel: "Technical passport",
  linkHref: "#contact",
} as const;

/** Panel 2 — auto-rotating. Circle colour encodes the property type. */
export const STRIP_CARDS = [
  { icon: "battery", circle: "bg-[#0E1C15]", text: "Absorbs 20–25× its own weight in water" },
  { icon: "wind", circle: "bg-emerald-800", text: "97% porosity for aeration and moisture retention" },
  { icon: "shield", circle: "bg-cyan-800", text: "Naturally antimicrobial — no chemical treatment" },
  { icon: "recycle", circle: "bg-amber-700", text: "Renewable — the bog regenerates within 5–7 years" },
] as const;

export const STRIP_PANEL_3 = {
  value: "53,000 km²",
  text: "The Vasyugan wetlands — the world’s largest wetland system and our raw-material base",
} as const;

/* ───────────── Section 12: what the client receives after enquiring ─────────────
   Answers the unspoken «what happens next?» right before the submit button.
   Every item is promised elsewhere in the brief (technical passport, structural
   calculation data, trial delivery, included consultation). */
export const CONTACT_DELIVERABLES = [
  { icon: "doc", title: "Technical passport", text: "Density, pH, CEC, porosity and heavy-metal data" },
  { icon: "calc", title: "Structural calculation", text: "Dry and saturated load figures for your structural engineer" },
  { icon: "box", title: "Trial delivery", text: "A sample matched to your site and climate, with technologist recommendations" },
] as const;
