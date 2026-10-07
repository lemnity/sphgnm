"use client";

import { LoginForm } from "./login-form";
import "./admin.css";

export function LoginPage({ next }: { next: string }) {
  return (
    <div className="adm adm-login" lang="ru">
      <main className="adm-login__card">
        <div className="adm-top__brand">
          <span className="adm-logo" aria-hidden>
            S
          </span>
          <span>
            <strong>Sphagnum Eco</strong>
            <span className="adm-top__sub">Кабинет</span>
          </span>
        </div>
        <h1>Вход в кабинет</h1>
        <p className="adm-lead">Здесь редактируются тексты, картинки и галерея сайта.</p>
        {/* Полная перезагрузка, а не роутер: страница кабинета проверяет cookie на сервере. */}
        <LoginForm onSuccess={() => window.location.assign(next)} />
      </main>
    </div>
  );
}
