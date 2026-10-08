"use client";

// Общие куски интерфейса кабинета: уведомления, модальные окна, подтверждение.
// Окна — на нативном <dialog>: фокус внутри окна, Esc и возврат фокуса браузер
// делает сам.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useT } from "./i18n";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string; details?: string[] };
type ConfirmOptions = { title: string; text?: ReactNode; confirmLabel?: string; danger?: boolean };

type UiContextValue = {
  toast: (kind: ToastKind, text: string, details?: string[]) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi вне AdminUiProvider");
  return value;
}

export function AdminUiProvider({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const toast = useCallback(
    (kind: ToastKind, text: string, details?: string[]) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, text, details }]);
      // Ошибку надо успеть прочитать — она держится дольше.
      window.setTimeout(() => dismiss(id), kind === "error" ? 9000 : 4500);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="adm-toasts" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`adm-toast adm-toast--${item.kind}`}>
            <div className="adm-toast__body">
              <p>{item.text}</p>
              {item.details?.length ? (
                <ul>
                  {item.details.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button type="button" className="adm-iconbtn" aria-label={t("ui.closeToast")} onClick={() => dismiss(item.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <Dialog open={pending !== null} onClose={() => answer(false)} title={pending?.title ?? ""} size="small">
        {pending?.text ? <div className="adm-dialog__text">{pending.text}</div> : null}
        <div className="adm-dialog__actions">
          <button type="button" className="adm-btn" onClick={() => answer(false)}>
            {t("ui.cancel")}
          </button>
          <button
            type="button"
            className={`adm-btn ${pending?.danger ? "adm-btn--danger" : "adm-btn--primary"}`}
            onClick={() => answer(true)}
            autoFocus
          >
            {pending?.confirmLabel ?? t("ui.yes")}
          </button>
        </div>
      </Dialog>
    </UiContext.Provider>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  size = "medium",
  closable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "small" | "medium" | "large";
  closable?: boolean;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`adm-dialog adm-dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (closable) onClose();
      }}
      onMouseDown={(event) => {
        // Клик по подложке (сам <dialog>, а не его содержимое) закрывает окно.
        if (closable && event.target === event.currentTarget) onClose();
      }}
    >
      {open ? (
        <div className="adm-dialog__inner">
          <header className="adm-dialog__head">
            <h2 id={titleId}>{title}</h2>
            {closable ? (
              <button type="button" className="adm-iconbtn" aria-label={t("ui.close")} onClick={onClose}>
                ✕
              </button>
            ) : null}
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
