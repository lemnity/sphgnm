"use client";

import type { AdminLang } from "@/lib/admin/i18n";
import { AdminLangProvider, LangSwitch, useT } from "./i18n";
import { LoginForm } from "./login-form";
import "./admin.css";

export function LoginPage({ next, lang }: { next: string; lang: AdminLang }) {
  return (
    <AdminLangProvider initial={lang} titleKey="meta.loginTitle">
      <Login next={next} />
    </AdminLangProvider>
  );
}

function Login({ next }: { next: string }) {
  const { lang, t } = useT();
  return (
    <div className="adm adm-login" lang={lang}>
      <main className="adm-login__card">
        <div className="adm-login__top">
          <div className="adm-top__brand">
            <span className="adm-logo" aria-hidden>
              S
            </span>
            <span>
              <strong>Sphagnum Eco</strong>
              <span className="adm-top__sub">{t("brand.sub")}</span>
            </span>
          </div>
          <LangSwitch />
        </div>
        <h1>{t("login.heading")}</h1>
        <p className="adm-lead">{t("login.lead")}</p>
        {/* Полная перезагрузка, а не роутер: страница кабинета проверяет cookie на сервере. */}
        <LoginForm onSuccess={() => window.location.assign(next)} />
      </main>
    </div>
  );
}
