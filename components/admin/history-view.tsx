"use client";

// История версий: список сохранённых копий и «Вернуть».
import { useCallback, useEffect, useState } from "react";
import { HISTORY_LIMIT } from "@/lib/admin/limits";
import { ApiError, listHistory, restoreHistory, type HistoryEntry } from "./api";
import { useT } from "./i18n";
import { useUi } from "./ui";

export function HistoryView({ dirty, onRestored }: { dirty: { site: boolean; gallery: boolean }; onRestored: (name: "site" | "gallery") => Promise<void> }) {
  const { toast, confirm } = useUi();
  const { t, date, size } = useT();
  const section = (name: HistoryEntry["name"]) => t(name === "site" ? "history.site" : "history.gallery");
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      setEntries((await listHistory()).entries);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : t("history.loadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restore = async (entry: HistoryEntry) => {
    const ok = await confirm({
      title: t("history.confirmTitle"),
      text: (
        <>
          <p>{t("history.confirmText", { section: section(entry.name), date: date(entry.savedAt) })}</p>
          <p>{t("history.confirmKeep")}</p>
          {dirty[entry.name] ? <p className="adm-warning">{t("history.confirmDirty")}</p> : null}
        </>
      ),
      confirmLabel: t("history.restore"),
    });
    if (!ok) return;
    setBusy(entry.id);
    setProblems([]);
    try {
      await restoreHistory(entry.id);
      await onRestored(entry.name);
      toast("success", t("history.restored", { date: date(entry.savedAt) }));
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setProblems(error.errors);
      toast("error", error instanceof Error ? error.message : t("history.restoreFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="adm-panel" aria-labelledby="history-title">
      <header className="adm-panel__head">
        <h2 id="history-title">{t("history.title")}</h2>
        <p className="adm-lead">{t("history.lead", { limit: HISTORY_LIMIT })}</p>
      </header>
      {problems.length ? (
        <div className="adm-summary" role="alert">
          <p>{t("history.problems")}</p>
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {failed ? <p className="adm-error-text">{failed}</p> : null}
      {entries === null && !failed ? <p className="adm-muted">{t("history.loading")}</p> : null}
      {entries?.length === 0 ? <p className="adm-empty">{t("history.empty")}</p> : null}
      {entries?.length ? (
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">{t("history.colSaved")}</th>
              <th scope="col">{t("history.colSection")}</th>
              <th scope="col">{t("history.colSize")}</th>
              <th scope="col">
                <span className="adm-sr">{t("history.colAction")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{date(entry.savedAt)}</td>
                <td>
                  <span className={`adm-tag adm-tag--${entry.name}`}>{section(entry.name)}</span>
                </td>
                <td className="adm-muted">{size(entry.size)}</td>
                <td className="adm-table__action">
                  <button
                    type="button"
                    className="adm-btn adm-btn--small"
                    onClick={() => void restore(entry)}
                    disabled={busy !== null}
                    aria-label={t("history.restoreAria", { section: section(entry.name), date: date(entry.savedAt) })}
                  >
                    {busy === entry.id ? t("history.restoring") : t("history.restore")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
