"use client";

// Язык кабинета в React: контекст, хук useT() и переключатель RU / EN.
// Смена языка — без перезагрузки: черновик в памяти страницы не теряется.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { formatDateTime, formatSize, langCookie, translate, type AdminLang, type MessageKey, type Params } from "@/lib/admin/i18n";
import { setApiLang } from "./api";

type LangContextValue = {
  lang: AdminLang;
  setLang: (lang: AdminLang) => void;
  t: (key: MessageKey, params?: Params) => string;
  /** Подпись из fields.ts: { ru, en } → строка на текущем языке. */
  pick: (text: { ru: string; en: string }) => string;
  date: (iso: string) => string;
  size: (bytes: number) => string;
};

const LangContext = createContext<LangContextValue | null>(null);

export function useT(): LangContextValue {
  const value = useContext(LangContext);
  if (!value) throw new Error("useT вне AdminLangProvider");
  return value;
}

/**
 * initial — язык, с которым страницу отрисовал сервер (из cookie), поэтому без мигания.
 * titleKey — заголовок вкладки, который нужно перевести при смене языка.
 */
export function AdminLangProvider({ initial, titleKey, children }: { initial: AdminLang; titleKey?: MessageKey; children: ReactNode }) {
  const [lang, setLangState] = useState<AdminLang>(() => {
    setApiLang(initial);
    return initial;
  });

  const setLang = useCallback((next: AdminLang) => {
    setApiLang(next);
    document.cookie = langCookie(next);
    setLangState(next);
  }, []);

  useEffect(() => {
    if (titleKey) document.title = translate(lang, titleKey);
  }, [lang, titleKey]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(lang, key, params),
      pick: (text) => text[lang],
      date: (iso) => formatDateTime(iso, lang),
      size: (bytes) => formatSize(bytes, lang),
    }),
    [lang, setLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/* Название языка — на нём самом, чтобы его узнал тот, кто другой язык не читает. */
const OPTIONS: { lang: AdminLang; short: string; name: string }[] = [
  { lang: "ru", short: "RU", name: "Русский" },
  { lang: "en", short: "EN", name: "English" },
];

export function LangSwitch({ onChange }: { onChange?: (lang: AdminLang) => void }) {
  const { lang, setLang, t } = useT();
  return (
    <div className="adm-segmented adm-lang" role="group" aria-label={t("lang.switch")}>
      {OPTIONS.map((option) => (
        <button
          key={option.lang}
          type="button"
          lang={option.lang}
          aria-label={option.name}
          title={option.name}
          aria-pressed={lang === option.lang}
          onClick={() => {
            if (option.lang === lang) return;
            setLang(option.lang);
            onChange?.(option.lang);
          }}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
