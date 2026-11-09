import type { Metadata } from "next";
import { getLocale } from "@/i18n/server";
import { COMMON_DICT } from "@/i18n/common";
import { LinkButton } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: COMMON_DICT[locale].notFound.metaTitle };
}

export default async function NotFound() {
  const t = COMMON_DICT[await getLocale()].notFound;
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <Logo />
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="text-muted">{t.body}</p>
      <LinkButton href="/" size="lg">
        {t.home}
      </LinkButton>
    </main>
  );
}
