"use client";

// Форма пароля. На странице входа после успеха уводит в кабинет, в окне
// «сессия истекла» — просто закрывает окно, черновик остаётся.
import { useEffect, useState } from "react";
import { ApiError, login } from "./api";

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return "Не удалось войти. Попробуйте ещё раз.";
  if (error.status === 401) return "Неверный пароль";
  if (error.status === 429) {
    const seconds = Number(error.data.retryAfter) || 900;
    return `Слишком много попыток. Попробуйте через ${Math.max(1, Math.ceil(seconds / 60))} мин.`;
  }
  if (error.status === 413) return "Слишком длинный пароль";
  return error.message;
}

export function LoginForm({ onSuccess, autoFocus = true }: { onSuccess: () => void; autoFocus?: boolean }) {
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
          setError(messageFor(failure));
          setBusy(false);
        }
      }}
    >
      <label className="adm-label" htmlFor="admin-password">
        Пароль
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
        {busy ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
