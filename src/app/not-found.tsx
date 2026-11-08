import { LinkButton } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10">
      <Logo />
      <h1 className="text-2xl font-bold">Sahifa topilmadi</h1>
      <p className="text-muted">
        Bunday sahifa yo‘q yoki uni ko‘rishga ruxsatingiz yo‘q. Havolani tekshiring yoki bosh sahifaga qayting.
      </p>
      <LinkButton href="/" size="lg">
        Bosh sahifaga
      </LinkButton>
    </main>
  );
}
