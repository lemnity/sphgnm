"use client";

// Заявки с формы: список, карточка, «не прочитано», удаление, CSV. Только чтение:
// ни ссылок mailto:/tel:, ни ответа — почту и телефон можно выделить и скопировать.
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MessageKey } from "@/lib/admin/i18n";
import { deleteLead, LEADS_CSV_URL, listLeads, setLeadRead, type StoredLead } from "./api";
import { useT } from "./i18n";
import { useUi } from "./ui";

const EMPTY = "—";
const FIELDS: { key: keyof StoredLead; label: MessageKey; copy?: boolean; long?: boolean }[] = [
  { key: "name", label: "leads.col.name" },
  { key: "email", label: "leads.col.email", copy: true },
  { key: "phone", label: "leads.col.phone", copy: true },
  { key: "region", label: "leads.col.region" },
  { key: "projectType", label: "leads.col.projectType" },
  { key: "area", label: "leads.col.area" },
  { key: "message", label: "leads.col.message", long: true },
];

const STATUS: Record<StoredLead["mailStatus"], MessageKey> = { sent: "leads.mailSent", failed: "leads.mailFailedLong", pending: "leads.mailPending" };

export function LeadsView({ onUnreadChange }: { onUnreadChange: (count: number) => void }) {
  const { t, date } = useT();
  const { toast, confirm } = useUi();
  const [leads, setLeads] = useState<StoredLead[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Значок в меню — по текущему списку; после первой загрузки.
  useEffect(() => {
    if (leads) onUnreadChange(leads.filter((lead) => !lead.read).length);
  }, [leads, onUnreadChange]);

  const refresh = useCallback(async () => {
    try {
      setLeads((await listLeads()).leads);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : t("leads.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!leads || !needle) return leads ?? [];
    return leads.filter((lead) =>
      [lead.id, lead.name, lead.email, lead.phone, lead.region, lead.projectType, lead.area, lead.message].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [leads, query]);

  const selected = leads?.find((lead) => lead.id === selectedId) ?? null;

  const patchRead = async (lead: StoredLead, read: boolean) => {
    const updated = (await setLeadRead(lead.id, read)).lead;
    setLeads((prev) => (prev ?? []).map((item) => (item.id === updated.id ? updated : item)));
  };

  // Открытие заявки сразу отмечает её прочитанной.
  const open = (lead: StoredLead) => {
    setSelectedId(lead.id);
    if (!lead.read) patchRead(lead, true).catch((error) => toast("error", error instanceof Error ? error.message : t("leads.updateFailed")));
    window.requestAnimationFrame(() => document.getElementById("lead-detail-title")?.focus());
  };

  const markUnread = async (lead: StoredLead) => {
    setBusy(true);
    try {
      await patchRead(lead, false);
      setSelectedId(null);
      toast("info", t("leads.markedUnread"));
    } catch (error) {
      toast("error", error instanceof Error ? error.message : t("leads.updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (lead: StoredLead) => {
    const ok = await confirm({
      title: t("leads.confirmTitle"),
      text: <p>{t("leads.confirmText", { id: lead.id, name: lead.name || EMPTY })}</p>,
      confirmLabel: t("leads.delete"),
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteLead(lead.id);
      setSelectedId(null);
      setLeads((prev) => (prev ?? []).filter((item) => item.id !== lead.id));
      toast("success", t("leads.deleted"));
    } catch (error) {
      toast("error", error instanceof Error ? error.message : t("leads.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-panel adm-inbox" aria-labelledby="adm-view-title">
      <header className="adm-panel__head">
        <h1 id="adm-view-title" tabIndex={-1}>
          {t("leads.title")}
          <span className="adm-pill adm-pill--quiet">{t("inbox.readOnly")}</span>
        </h1>
        <p className="adm-lead">{t("leads.lead")}</p>
      </header>

      <div className="adm-inbox__bar">
        <label className="adm-inbox__search">
          <span className="adm-sr">{t("leads.filter")}</span>
          <input type="search" className="adm-input" placeholder={t("leads.filterPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {leads ? <span className="adm-muted">{t("leads.count", { count: leads.length })}</span> : null}
        <button type="button" className="adm-btn adm-btn--small" onClick={() => void refresh()}>
          {t("inbox.refresh")}
        </button>
        <a className="adm-btn adm-btn--small" href={LEADS_CSV_URL} download>
          {t("leads.export")}
        </a>
      </div>

      {failed ? <p className="adm-error-text">{failed}</p> : null}
      {leads === null && !failed ? <p className="adm-muted">{t("inbox.loading")}</p> : null}
      {leads?.length === 0 ? <p className="adm-empty">{t("leads.empty")}</p> : null}
      {leads?.length && !visible.length ? <p className="adm-empty">{t("leads.noMatch", { query: query.trim() })}</p> : null}

      {leads?.length ? (
        <div className={`adm-inbox__split${selected ? " adm-inbox__split--open" : ""}`}>
          <ul className="adm-inbox__list" aria-label={t("leads.title")}>
            {visible.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  className={`adm-inbox__row${lead.read ? "" : " adm-inbox__row--unread"}`}
                  aria-current={lead.id === selectedId ? "true" : undefined}
                  onClick={() => open(lead)}
                >
                  <span className="adm-inbox__line">
                    {lead.read ? null : (
                      <span className="adm-inbox__dot">
                        <span className="adm-sr">{t("inbox.unread")}</span>
                      </span>
                    )}
                    <strong className="adm-inbox__who">{lead.name || EMPTY}</strong>
                    {lead.mailStatus === "failed" ? (
                      <span className="adm-inbox__warn" title={t("leads.mailFailed")}>
                        <TriangleAlert size={14} aria-hidden />
                        <span className="adm-sr">{t("leads.mailFailed")}</span>
                      </span>
                    ) : null}
                    <time className="adm-inbox__date" dateTime={lead.submittedAt}>
                      {date(lead.submittedAt)}
                    </time>
                  </span>
                  <span className="adm-inbox__meta">{[lead.projectType, lead.area ? t("leads.areaValue", { area: lead.area }) : "", lead.region].filter(Boolean).join(" · ") || EMPTY}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="adm-inbox__detail">
            {selected ? (
              <article className="adm-lead-card" aria-labelledby="lead-detail-title">
                <button type="button" className="adm-link adm-inbox__back" onClick={() => setSelectedId(null)}>
                  {t("inbox.back")}
                </button>
                <header className="adm-lead-card__head">
                  <h2 id="lead-detail-title" tabIndex={-1}>
                    {t("leads.number", { id: selected.id })}
                  </h2>
                  <p className="adm-muted">{date(selected.submittedAt)}</p>
                  <p className={`adm-lead-card__status adm-lead-card__status--${selected.mailStatus}`}>
                    {selected.mailStatus === "failed" ? <TriangleAlert size={14} aria-hidden /> : null}
                    {t(STATUS[selected.mailStatus])}
                  </p>
                </header>
                <dl className="adm-lead-card__fields">
                  {FIELDS.map((field) => {
                    const value = String(selected[field.key] ?? "").trim();
                    return (
                      <div key={field.key} className={field.long ? "adm-lead-card__long" : undefined}>
                        <dt>{t(field.label)}</dt>
                        <dd className={field.copy && value ? "adm-copyable" : undefined} data-field={field.key}>
                          {value || EMPTY}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <div className="adm-lead-card__actions">
                  <button type="button" className="adm-btn adm-btn--small" disabled={busy} onClick={() => void markUnread(selected)}>
                    {t("leads.markUnread")}
                  </button>
                  <button type="button" className="adm-btn adm-btn--small adm-btn--ghost-danger" disabled={busy} onClick={() => void remove(selected)}>
                    {t("leads.delete")}
                  </button>
                </div>
              </article>
            ) : (
              <p className="adm-muted adm-inbox__hint">{t("leads.select")}</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
