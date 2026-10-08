"use client";

// История версий: список сохранённых копий и «Вернуть».
import { useCallback, useEffect, useState } from "react";
import { ApiError, formatDateTime, formatSize, listHistory, restoreHistory, type HistoryEntry } from "./api";
import { useUi } from "./ui";

const NAMES: Record<HistoryEntry["name"], string> = { site: "Тексты и картинки", gallery: "Галерея" };

export function HistoryView({ dirty, onRestored }: { dirty: { site: boolean; gallery: boolean }; onRestored: (name: "site" | "gallery") => Promise<void> }) {
  const { toast, confirm } = useUi();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      setEntries((await listHistory()).entries);
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Не удалось загрузить историю");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restore = async (entry: HistoryEntry) => {
    const ok = await confirm({
      title: "Вернуть эту версию?",
      text: (
        <>
          <p>
            Раздел «{NAMES[entry.name]}» вернётся к версии от {formatDateTime(entry.savedAt)}. Изменения сразу появятся на сайте.
          </p>
          <p>Текущая версия не пропадёт: она тоже ляжет в историю, и её можно будет вернуть.</p>
          {dirty[entry.name] ? <p className="adm-warning">Несохранённые правки в этом разделе будут потеряны.</p> : null}
        </>
      ),
      confirmLabel: "Вернуть",
    });
    if (!ok) return;
    setBusy(entry.id);
    setProblems([]);
    try {
      await restoreHistory(entry.id);
      await onRestored(entry.name);
      toast("success", `Версия от ${formatDateTime(entry.savedAt)} возвращена`);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) setProblems(error.errors);
      toast("error", error instanceof Error ? error.message : "Не удалось вернуть версию");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="adm-panel" aria-labelledby="history-title">
      <header className="adm-panel__head">
        <h2 id="history-title">История версий</h2>
        <p className="adm-lead">
          При каждом сохранении прежняя версия попадает сюда. Дата у строки — когда эту версию сохранили; то, что сейчас на
          сайте, в списке не показано. Хранятся 30 последних версий текстов и столько же — галереи.
        </p>
      </header>
      {problems.length ? (
        <div className="adm-summary" role="alert">
          <p>Эта версия не подходит под текущую структуру сайта:</p>
          <ul>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {failed ? <p className="adm-error-text">{failed}</p> : null}
      {entries === null && !failed ? <p className="adm-muted">Загружаем…</p> : null}
      {entries?.length === 0 ? <p className="adm-empty">Сохранённых версий пока нет — они появятся после первого сохранения.</p> : null}
      {entries?.length ? (
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Версия сохранена</th>
              <th scope="col">Раздел</th>
              <th scope="col">Размер</th>
              <th scope="col">
                <span className="adm-sr">Действие</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.savedAt)}</td>
                <td>
                  <span className={`adm-tag adm-tag--${entry.name}`}>{NAMES[entry.name]}</span>
                </td>
                <td className="adm-muted">{formatSize(entry.size)}</td>
                <td className="adm-table__action">
                  <button
                    type="button"
                    className="adm-btn adm-btn--small"
                    onClick={() => void restore(entry)}
                    disabled={busy !== null}
                    aria-label={`Вернуть: ${NAMES[entry.name]}, ${formatDateTime(entry.savedAt)}`}
                  >
                    {busy === entry.id ? "Возвращаем…" : "Вернуть"}
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
