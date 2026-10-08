"use client";

// Редактор блока, собранный по описанию полей из lib/admin/fields.ts.
// Изменения идут функциями-обновлениями (prev → next): загрузка файла завершается
// позже, и её результат должен лечь на актуальный черновик, а не на снимок.
import { createContext, useContext, type ReactNode } from "react";
import { ICON_LABELS, ICON_NAMES, SECTION_ANCHORS, newListItem, type Field } from "@/lib/admin/fields";
import type { IconName } from "@/lib/content/schema";
import { ICONS } from "@/components/site-icons";
import { useT } from "./i18n";
import { MediaPathControl } from "./media";
import { useUi } from "./ui";

type Obj = Record<string, unknown>;
export type Update<T> = (fn: (prev: T) => T) => void;

/** Ошибки валидации от API по путям site.json ("hero.title"). */
export type ErrorsApi = { at: (path: string) => string[]; clear: (path: string) => void };
export const ErrorsContext = createContext<ErrorsApi>({ at: () => [], clear: () => {} });

/** id элемента по пути: "product.solutions[0].title" → "f-product-solutions-0-title". */
export function fieldId(path: string): string {
  return `f-${path.replace(/[^A-Za-z0-9]+/g, "-").replace(/-$/, "")}`;
}

export function FieldsEditor({ fields, value, update, path }: { fields: Field[]; value: Obj; update: Update<Obj>; path: string }) {
  return (
    <div className="adm-fields">
      {fields.map((field) => {
        const at = `${path}.${field.key}`;
        const updateField: Update<unknown> = (fn) => update((prev) => ({ ...prev, [field.key]: fn(prev[field.key]) }));
        return <FieldView key={field.key} field={field} value={value[field.key]} update={updateField} path={at} />;
      })}
    </div>
  );
}

function FieldView({ field, value, update, path }: { field: Field; value: unknown; update: Update<unknown>; path: string }) {
  const errors = useContext(ErrorsContext);
  const { pick } = useT();
  const id = fieldId(path);
  const set = (next: unknown) => {
    errors.clear(path);
    update(() => next);
  };

  switch (field.kind) {
    case "text":
    case "href":
    case "anchor":
      return (
        <Row field={field} path={path}>
          <input
            id={id}
            className="adm-input"
            type="text"
            value={String(value ?? "")}
            onChange={(event) => set(event.target.value)}
            list={field.kind === "anchor" ? "adm-anchors" : undefined}
            inputMode={field.kind === "href" ? "url" : undefined}
            spellCheck={field.kind === "text"}
            aria-describedby={describedBy(field, path, errors.at(path))}
            aria-invalid={errors.at(path).length > 0 || undefined}
          />
          {field.kind === "anchor" ? <AnchorNote value={String(value ?? "")} /> : null}
        </Row>
      );
    case "textarea":
      return (
        <Row field={field} path={path}>
          <textarea
            id={id}
            className="adm-input adm-textarea"
            rows={field.rows ?? 3}
            value={String(value ?? "")}
            onChange={(event) => set(event.target.value)}
            aria-describedby={describedBy(field, path, errors.at(path))}
            aria-invalid={errors.at(path).length > 0 || undefined}
          />
        </Row>
      );
    case "icon":
      return (
        <Row field={field} path={path}>
          <IconSelect id={id} value={String(value ?? "")} onChange={set} describedBy={describedBy(field, path, errors.at(path))} />
        </Row>
      );
    case "video":
      return (
        <Row field={field} path={path} asGroup>
          <MediaPathControl value={String(value ?? "")} onChange={set} accept="video" label={pick(field.label)} describedBy={describedBy(field, path, errors.at(path))} />
        </Row>
      );
    case "image":
      return <ImageView field={field} value={(value ?? { src: "", alt: "" }) as Obj} update={update as Update<Obj>} path={path} />;
    case "group":
      return (
        <fieldset className="adm-group">
          <legend>{pick(field.label)}</legend>
          {field.hint ? <p className="adm-hint">{pick(field.hint)}</p> : null}
          <FieldsEditor fields={field.fields} value={(value ?? {}) as Obj} update={update as Update<Obj>} path={path} />
        </fieldset>
      );
    case "list":
      return <ListView field={field} value={Array.isArray(value) ? value : []} update={update as Update<unknown[]>} path={path} />;
  }
}

function describedBy(field: Field, path: string, errors: string[]): string | undefined {
  const ids = [field.hint ? `${fieldId(path)}-hint` : "", errors.length ? `${fieldId(path)}-err` : ""].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

/** Подпись, подсказка и ошибки поля. asGroup — у контрола нет одного input, подпись не <label>. */
function Row({ field, path, children, asGroup = false, extraErrors = [] }: { field: Field; path: string; children: ReactNode; asGroup?: boolean; extraErrors?: string[] }) {
  const errors = [...useContext(ErrorsContext).at(path), ...extraErrors];
  const { pick } = useT();
  const id = fieldId(path);
  return (
    <div className={`adm-field${errors.length ? " adm-field--error" : ""}`} data-path={path}>
      {asGroup ? (
        <span className="adm-label" id={`${id}-label`}>
          {pick(field.label)}
        </span>
      ) : (
        <label className="adm-label" htmlFor={id}>
          {pick(field.label)}
        </label>
      )}
      {field.hint ? (
        <p className="adm-hint" id={`${id}-hint`}>
          {pick(field.hint)}
        </p>
      ) : null}
      {children}
      <FieldErrors id={`${id}-err`} errors={errors} />
    </div>
  );
}

export function FieldErrors({ id, errors }: { id: string; errors: string[] }) {
  if (!errors.length) return null;
  return (
    <ul className="adm-field__errors" id={id}>
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

function AnchorNote({ value }: { value: string }) {
  const { t, pick } = useT();
  const section = SECTION_ANCHORS.find((anchor) => anchor.id === value);
  return (
    <p className="adm-hint">
      {section ? t("field.anchorTarget", { label: pick(section.label) }) : t("field.anchorHelp", { ids: SECTION_ANCHORS.map((anchor) => anchor.id).join(", ") })}
    </p>
  );
}

/** Подсказки для полей «Раздел страницы» — один список на страницу. */
export function AnchorDatalist() {
  const { pick } = useT();
  return (
    <datalist id="adm-anchors">
      {SECTION_ANCHORS.map((anchor) => (
        <option key={anchor.id} value={anchor.id}>
          {pick(anchor.label)}
        </option>
      ))}
    </datalist>
  );
}

export function IconSelect({ id, value, onChange, describedBy }: { id: string; value: string; onChange: (value: string) => void; describedBy?: string }) {
  const { pick } = useT();
  const Icon = ICONS[value as IconName];
  return (
    <div className="adm-icon-select">
      <span className="adm-icon-select__preview" aria-hidden>
        {Icon ? <Icon size={22} strokeWidth={1.6} /> : "?"}
      </span>
      <select id={id} className="adm-input" value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy}>
        {ICON_NAMES.includes(value as IconName) ? null : <option value={value}>{value || "—"}</option>}
        {ICON_NAMES.map((name) => (
          <option key={name} value={name}>
            {pick(ICON_LABELS[name])}
          </option>
        ))}
      </select>
    </div>
  );
}

function ImageView({ field, value, update, path }: { field: Extract<Field, { kind: "image" }>; value: Obj; update: Update<Obj>; path: string }) {
  const errors = useContext(ErrorsContext);
  const { t, pick } = useT();
  const srcErrors = [...errors.at(`${path}.src`)];
  const altId = fieldId(`${path}.alt`);
  const altErrors = errors.at(`${path}.alt`);
  const setPart = (key: "src" | "alt", next: string) => {
    errors.clear(`${path}.${key}`);
    update((prev) => ({ ...prev, [key]: next }));
  };
  return (
    <Row field={field} path={path} asGroup extraErrors={srcErrors}>
      <div role="group" aria-labelledby={`${fieldId(path)}-label`} className="adm-image">
        <MediaPathControl
          value={String(value.src ?? "")}
          onChange={(next) => setPart("src", next)}
          accept="image"
          label={pick(field.label)}
          describedBy={srcErrors.length ? `${fieldId(path)}-err` : undefined}
        />
        {field.alt === "unused" ? null : (
          <div className={`adm-field adm-field--inline${altErrors.length ? " adm-field--error" : ""}`}>
            <label className="adm-label adm-label--small" htmlFor={altId}>
              {t("field.alt")}
            </label>
            <input
              id={altId}
              className="adm-input"
              type="text"
              value={String(value.alt ?? "")}
              placeholder={t("field.altPlaceholder")}
              onChange={(event) => setPart("alt", event.target.value)}
            />
            <FieldErrors id={`${altId}-err`} errors={altErrors} />
          </div>
        )}
      </div>
    </Row>
  );
}

function focusLater(selector: string) {
  window.requestAnimationFrame(() => {
    const element = document.querySelector<HTMLElement>(selector);
    element?.focus();
  });
}

function itemSummary(item: unknown, field: Extract<Field, { kind: "list" }>): string {
  if (typeof item === "string") return item;
  if (typeof field.item === "string" || !item || typeof item !== "object") return "";
  for (const inner of field.item) {
    const value = (item as Obj)[inner.key];
    if ((inner.kind === "text" || inner.kind === "textarea") && typeof value === "string" && value.trim()) return value.replace(/\s+/g, " ");
  }
  return "";
}

function ListView({ field, value, update, path }: { field: Extract<Field, { kind: "list" }>; value: unknown[]; update: Update<unknown[]>; path: string }) {
  const { confirm } = useUi();
  const { t, pick } = useT();
  const errors = useContext(ErrorsContext);
  const id = fieldId(path);
  const itemLabel = pick(field.itemLabel);
  const scalar = typeof field.item === "string";

  const move = (index: number, delta: -1 | 1, button: "up" | "down") => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    errors.clear(path);
    update((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    // Фокус едет вместе с элементом: можно жать стрелку несколько раз подряд.
    const edge = (button === "up" && target === 0) || (button === "down" && target === value.length - 1);
    focusLater(`#${fieldId(`${path}[${target}]`)}-${edge ? (button === "up" ? "down" : "up") : button}`);
  };

  const remove = async (index: number) => {
    const summary = itemSummary(value[index], field);
    const empty = scalar ? !summary : false;
    if (!empty) {
      const ok = await confirm({
        title: t("list.confirmRemove", { item: itemLabel.toLowerCase(), n: index + 1 }),
        text: summary ? <p>«{summary.length > 120 ? `${summary.slice(0, 120)}…` : summary}»</p> : undefined,
        confirmLabel: t("list.removeTitle"),
        danger: true,
      });
      if (!ok) return;
    }
    errors.clear(path);
    update((prev) => prev.filter((_, i) => i !== index));
    focusLater(`#${id}-add`);
  };

  const add = () => {
    const index = value.length;
    update((prev) => [...prev, newListItem(field)]);
    focusLater(`[data-item="${fieldId(`${path}[${index}]`)}"] :is(input, textarea, select)`);
  };

  const listErrors = errors.at(path);
  return (
    <fieldset className={`adm-list${scalar ? " adm-list--scalar" : ""}`}>
      <legend>
        {pick(field.label)} <span className="adm-count">{value.length}</span>
      </legend>
      {field.hint ? <p className="adm-hint">{pick(field.hint)}</p> : null}
      <FieldErrors id={`${id}-err`} errors={listErrors} />
      {value.length === 0 ? <p className="adm-empty">{t("list.empty")}</p> : null}
      <ol className="adm-list__items">
        {value.map((item, index) => {
          const itemPath = `${path}[${index}]`;
          const itemId = fieldId(itemPath);
          const number = t("list.number", { item: itemLabel, n: index + 1 });
          const controls = (
            <div className="adm-list__controls">
              <button type="button" id={`${itemId}-up`} className="adm-iconbtn" aria-label={t("list.up", { item: number })} title={t("list.upTitle")} disabled={index === 0} onClick={() => move(index, -1, "up")}>
                ↑
              </button>
              <button
                type="button"
                id={`${itemId}-down`}
                className="adm-iconbtn"
                aria-label={t("list.down", { item: number })}
                title={t("list.downTitle")}
                disabled={index === value.length - 1}
                onClick={() => move(index, 1, "down")}
              >
                ↓
              </button>
              <button type="button" className="adm-iconbtn adm-iconbtn--danger" aria-label={t("list.remove", { item: number })} title={t("list.removeTitle")} onClick={() => void remove(index)}>
                ✕
              </button>
            </div>
          );

          if (typeof field.item === "string") {
            const itemErrors = errors.at(itemPath);
            const input = {
              id: itemId,
              className: "adm-input",
              value: String(item ?? ""),
              "aria-label": number,
              "aria-invalid": itemErrors.length > 0 || undefined,
              onChange: (event: { target: { value: string } }) => {
                errors.clear(itemPath);
                const next = event.target.value;
                update((prev) => prev.map((old, i) => (i === index ? next : old)));
              },
            };
            return (
              <li key={index} className="adm-list__row" data-item={itemId}>
                <span className="adm-list__num" aria-hidden>
                  {index + 1}
                </span>
                {field.item === "textarea" ? <textarea rows={2} {...input} className="adm-input adm-textarea" /> : <input type="text" {...input} />}
                {controls}
                <FieldErrors id={`${itemId}-err`} errors={itemErrors} />
              </li>
            );
          }

          const summary = itemSummary(item, field);
          return (
            <li key={index} className="adm-card" data-item={itemId}>
              <div className="adm-card__head">
                <h4>
                  {number}
                  {summary ? <span className="adm-card__summary"> — {summary}</span> : null}
                </h4>
                {controls}
              </div>
              <FieldsEditor
                fields={field.item}
                value={(item ?? {}) as Obj}
                path={itemPath}
                update={(fn) => update((prev) => prev.map((old, i) => (i === index ? fn((old ?? {}) as Obj) : old)))}
              />
            </li>
          );
        })}
      </ol>
      <button type="button" id={`${id}-add`} className="adm-btn adm-btn--add" onClick={add}>
        {t("list.add", { item: itemLabel.toLowerCase() })}
      </button>
    </fieldset>
  );
}
