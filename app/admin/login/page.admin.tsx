import type { Metadata } from "next";
import { LoginPage } from "@/components/admin/login-page";
import { pageLang } from "@/lib/admin/guard";
import { translate } from "@/lib/admin/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate(await pageLang(), "meta.loginTitle"), robots: { index: false, follow: false } };
}

/* Куда вернуться после входа. Только пути кабинета: ?next=https://… не должен
   увести на чужой сайт. */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && /^\/admin(\/[\w/-]*)?$/.test(next) ? next : "/admin";
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next } = await searchParams;
  return <LoginPage next={safeNext(next)} lang={await pageLang()} />;
}
