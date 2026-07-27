import type { Config } from "tailwindcss";

/**
 * Тема не расширяется намеренно: палитра лендинга живёт в CSS-переменных внутри
 * components/sphagnum-styles.tsx (--ink, --olive, --sand и т.д.), а разметка
 * обращается к ним через произвольные значения вида bg-[color:var(--sand)].
 * Так весь визуальный язык лежит в одном файле, а не размазан по конфигу.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
