"use client";

// Форма пароля. На странице входа после успеха уводит в кабинет, в окне
// «сессия истекла» — просто закрывает окно, черновик остаётся.
import { useEffect, useState } from "react";
import { ApiError, login } from "./api";
import { useT } from "./i18n";

type T = ReturnType<typeof useT>["t"];

/* Тексты частых отказов — свои: «Слишком большой запрос» в форме пароля звучало бы странно. */
function messageFor(error: unknown, t: T): string {
  if (!(error instanceof ApiError)) return t("login.failed");
  if (error.status === 401) return t("api.wrongPassword");
  if (error.status === 429) {
    const seconds = Number(error.data.retryAfter) || 900;
    return t("api.tooManyAttempts", { minutes: Math.max(1, Math.ceil(seconds / 60)) });
  }
  if (error.status === 413) return t("login.passwordTooLong");
  return error.message;
}

export function LoginForm({ onSuccess, autoFocus = true }: { onSuccess: () => void; autoFocus?: boolean }) {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  // До гидратации форма отправилась бы обычным GET с паролем в адресе.
  useEffect(() => setReady(true), []);

  return (
    <form
      className="adm-login__form"
      data-ready={ready || undefined}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!password || busy) return;
        setBusy(true);
        setError(null);
        try {
          await login(password);
          onSuccess();
        } catch (failure) {
          setError(messageFor(failure, t));
          setBusy(false);
        }
      }}
    >
      <label className="adm-label" htmlFor="admin-password">
        {t("login.password")}
      </label>
      <input
        id="admin-password"
        className="adm-input"
        type="password"
        name="password"
        autoComplete="current-password"
        autoFocus={autoFocus}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "admin-password-error" : undefined}
        required
      />
      {error ? (
        <p className="adm-error-text" id="admin-password-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="adm-btn adm-btn--primary adm-btn--block" disabled={!ready || busy}>
        {busy ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
