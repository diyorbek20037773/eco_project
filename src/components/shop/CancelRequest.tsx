"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelPickupRequest } from "@/server/actions/shop";
import { routes } from "@/lib/routes";
import { fmt } from "@/i18n/config";
import { SHOP_DICT } from "@/i18n/shop";
import { useDict } from "@/i18n/LocaleProvider";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Field";

export function CancelRequest({ requestId, number }: { requestId: string; number: number }) {
  const router = useRouter();
  const t = useDict(SHOP_DICT).cancel;
  const [open, setOpen] = useState(false);
  const form = useActionForm<{ reason: string }>({
    initialValues: { reason: "" },
    successMessage: fmt(t.success, { n: number }),
    onSuccess: () => router.push(routes.shop.home),
  });

  if (!open) {
    return (
      <Button variant="danger" block onClick={() => setOpen(true)}>
        {t.open}
      </Button>
    );
  }

  return (
    <form noValidate className="space-y-3"
      onSubmit={form.handleSubmit(({ values }) => cancelPickupRequest({ requestId, reason: values.reason.trim() || undefined }))}
    >
      <TextInput
        label={t.reason}
        optional
        value={form.values.reason}
        onChange={(e) => form.setValue("reason", e.target.value)}
        error={form.fieldErrors.reason}
      />
      <FormStatus form={form} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="danger" loading={form.pending}>
          {t.confirm}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={form.pending}>
          {t.keep}
        </Button>
      </div>
    </form>
  );
}
