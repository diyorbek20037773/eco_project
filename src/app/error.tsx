"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-10">
      <ErrorState error={error} retry={retry} homeHref="/" />
    </main>
  );
}
