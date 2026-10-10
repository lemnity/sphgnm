"use client";

// Почта сервера (Maildir) в кабинете — только чтение: ни ответа, ни пересылки, ни удаления.
// HTML письма показывается в <iframe sandbox=""> с CSP; картинки из сети — по кнопке.
import { Paperclip } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { buildSrcdoc } from "@/lib/mail/sanitize";
import { attachmentUrl, INBOX_ID, listMail, openMail, setMailRead, type MailList, type MailMessage } from "./api";
import { useT } from "./i18n";
import { useUi } from "./ui";

type Tab = "text" | "html";

export function MailView({ onUnreadChange }: { onUnreadChange: (count: number) => void }) {
  const { t, date, size } = useT();
  const { toast } = useUi();
  const [folder, setFolder] = useState(INBOX_ID);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MailList | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("text");
  const [showImages, setShowImages] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await listMail(folder, page);
      setData(next);
      setFailed(null);
      if (next.connected) onUnreadChange(next.folders.find((item) => item.id === INBOX_ID)?.unread ?? 0);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : t("mail.loadFailed"));
    }
  }, [folder, page, onUnreadChange, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (id: string) => {
    setOpening(id);
    try {
      const { message: opened } = await openMail(folder, id);
      setMessage(opened);
      setTab("text");
      setShowImages(false);
      window.requestAnimationFrame(() => document.getElementById("mail-detail-title")?.focus());
      void load();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : t("mail.openFailed"));
    } finally {
      setOpening(null);
    }
  };

  const back = () => {
    setMessage(null);
    void load();
  };

  const markUnread = async (current: MailMessage) => {
    try {
      await setMailRead(current.folder, current.id, false);
      toast("info", t("mail.markedUnread"));
      back();
    } catch (error) {
      toast("error", error instanceof Error ? error.message : t("mail.openFailed"));
    }
  };

  const folderName = (id: string, name: string) => (id === INBOX_ID ? t("mail.inbox") : name);

  const head = (
    <header className="adm-panel__head">
      <h1 id="adm-view-title" tabIndex={-1}>
        {t("mail.title")}
        <span className="adm-pill adm-pill--quiet">{t("inbox.readOnly")}</span>
      </h1>
      <p className="adm-lead">{t("mail.lead")}</p>
    </header>
  );

  if (data && !data.connected) {
    return (
      <section className="adm-panel adm-inbox" aria-labelledby="adm-view-title">
        {head}
        <div className="adm-note adm-mail-off" data-mail="not-connected">
          <p>
            <strong>{t("mail.notConnected")}</strong>
          </p>
          <p>{t("mail.notConnectedText")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="adm-panel adm-inbox" aria-labelledby="adm-view-title">
      {head}
      {failed ? <p className="adm-error-text">{failed}</p> : null}
      {data === null && !failed ? <p className="adm-muted">{t("inbox.loading")}</p> : null}

      {message ? (
        <article className="adm-mail" aria-labelledby="mail-detail-title">
          <button type="button" className="adm-link adm-inbox__back adm-inbox__back--always" onClick={back}>
            {t("inbox.back")}
          </button>
          <h2 id="mail-detail-title" tabIndex={-1} className="adm-mail__subject">
            {message.subject || t("mail.noSubject")}
          </h2>
          <dl className="adm-mail__headers">
            <div>
              <dt>{t("mail.from")}</dt>
              <dd>{message.from || "—"}</dd>
            </div>
            <div>
              <dt>{t("mail.to")}</dt>
              <dd>{message.to || "—"}</dd>
            </div>
            {message.cc ? (
              <div>
                <dt>{t("mail.cc")}</dt>
                <dd>{message.cc}</dd>
              </div>
            ) : null}
            <div>
              <dt>{t("mail.date")}</dt>
              <dd>{date(message.date)}</dd>
            </div>
          </dl>

          {message.html ? (
            <div className="adm-segmented adm-mail__tabs" role="group" aria-label={t("mail.view")}>
              <button type="button" aria-pressed={tab === "text"} onClick={() => setTab("text")}>
                {t("mail.tabText")}
              </button>
              <button type="button" aria-pressed={tab === "html"} onClick={() => setTab("html")}>
                {t("mail.tabHtml")}
              </button>
            </div>
          ) : null}

          {message.truncated ? <p className="adm-warning">{t("mail.truncated")}</p> : null}

          {tab === "html" && message.html ? (
            <>
              <div className="adm-mail__images">
                <p className="adm-muted">{showImages ? t("mail.imagesShown") : t("mail.imagesBlocked")}</p>
                {showImages ? null : (
                  <button type="button" className="adm-btn adm-btn--small" onClick={() => setShowImages(true)}>
                    {t("mail.showImages")}
                  </button>
                )}
              </div>
              {/* sandbox="" — без скриптов, форм, переходов и своего origin; CSP — первым тегом документа. */}
              <iframe
                key={`${message.id}:${showImages}`}
                className="adm-mail__frame"
                title={t("mail.frameTitle")}
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={buildSrcdoc(message.html, showImages)}
              />
              <p className="adm-hint">{t("mail.htmlNote")}</p>
            </>
          ) : message.text.trim() ? (
            <pre className="adm-mail__text">{message.text}</pre>
          ) : (
            <p className="adm-empty">{t("mail.emptyBody")}</p>
          )}

          {message.attachments.length ? (
            <div className="adm-mail__files">
              <h3>{t("mail.attachments")}</h3>
              <ul>
                {message.attachments.map((file) => (
                  <li key={file.index}>
                    <a href={attachmentUrl(message.folder, message.id, file.index)} download={file.name} aria-label={t("mail.download", { name: file.name })}>
                      <Paperclip size={14} aria-hidden /> {file.name}
                    </a>{" "}
                    <span className="adm-muted">
                      {file.type} · {size(file.size)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="adm-lead-card__actions">
            <button type="button" className="adm-btn adm-btn--small" onClick={() => void markUnread(message)}>
              {t("mail.markUnread")}
            </button>
          </div>
        </article>
      ) : data?.connected ? (
        <>
          <div className="adm-segmented adm-mail__folders" role="group" aria-label={t("mail.folders")}>
            {data.folders.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === data.folder}
                onClick={() => {
                  setFolder(item.id);
                  setPage(1);
                }}
              >
                {folderName(item.id, item.name)}
                {item.unread ? <span className="adm-count">{item.unread}</span> : null}
              </button>
            ))}
          </div>

          {data.messages.length === 0 ? (
            <p className="adm-empty">{t("mail.empty")}</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table adm-mail__list">
                <thead>
                  <tr>
                    <th scope="col">{t("mail.colFrom")}</th>
                    <th scope="col">{t("mail.colSubject")}</th>
                    <th scope="col">{t("mail.colDate")}</th>
                    <th scope="col">{t("mail.colSize")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.messages.map((row) => (
                    <tr key={row.id} className={row.read ? undefined : "adm-mail__unread"}>
                      <td className="adm-mail__from">
                        {row.read ? null : (
                          <span className="adm-inbox__dot">
                            <span className="adm-sr">{t("inbox.unread")}</span>
                          </span>
                        )}
                        {row.from || "—"}
                      </td>
                      <td>
                        <button type="button" className="adm-link adm-mail__open" disabled={opening !== null} onClick={() => void open(row.id)}>
                          {row.subject || t("mail.noSubject")}
                        </button>
                        {row.hasAttachments ? (
                          <span className="adm-mail__clip" title={t("mail.attachmentsSr")}>
                            <Paperclip size={13} aria-hidden />
                            <span className="adm-sr">{t("mail.attachmentsSr")}</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="adm-muted adm-nowrap">{date(row.date)}</td>
                      <td className="adm-muted adm-nowrap">{size(row.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.pages > 1 ? (
            <div className="adm-mail__pages">
              <button type="button" className="adm-btn adm-btn--small" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>
                {t("mail.newer")}
              </button>
              <span className="adm-muted">{t("mail.page", { page: data.page, pages: data.pages })}</span>
              <button type="button" className="adm-btn adm-btn--small" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>
                {t("mail.older")}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
