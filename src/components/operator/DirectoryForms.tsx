"use client";

import { useId, useState } from "react";
import type { BuyerDTO } from "@/server/contract";
import { addPoint, addShopUser, createBuyer, createCollector, createShop, createTariff, updateBuyer } from "@/server/actions/operator";
import { parseSom } from "@/domain/money";
import { parseKgToGrams } from "@/domain/weight";
import { fmt } from "@/i18n/config";
import { useDict } from "@/i18n/LocaleProvider";
import { OPERATOR_DICT } from "@/i18n/operator";
import { gramsToKgInput } from "@/lib/format";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { Checkbox, KgInput, SomInput, TextInput, Textarea, sanitizeSom } from "@/components/ui/Field";

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;

/** Majburiy maydon: `label` — lug‘atdagi nom, xabar `dirForms.required` shabloni bilan. */
function req(v: string, label: string, errors: Record<string, string>, key: string, template: string, min = 2) {
  if (v.trim().length < min) errors[key] = fmt(template, { label });
}

function useDirT() {
  return useDict(OPERATOR_DICT).dirForms;
}

function PhoneInput(props: { label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; optional?: boolean }) {
  return (
    <TextInput
      label={props.label}
      type="tel"
      inputMode="tel"
      autoComplete="off"
      placeholder="+998 90 123 45 67"
      required={props.required}
      optional={props.optional}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      error={props.error}
    />
  );
}

function DistrictInput({ value, onChange, districts, error }: { value: string; onChange: (v: string) => void; districts: string[]; error?: string }) {
  const t = useDirT();
  const listId = useId();
  return (
    <>
      <TextInput label={t.district} required list={listId} value={value} onChange={(e) => onChange(e.target.value)} error={error} hint={t.districtHint} />
      <datalist id={listId}>
        {districts.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </>
  );
}

function PasswordInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const t = useDirT();
  return (
    <TextInput
      label={t.password}
      type="text"
      autoComplete="new-password"
      required
      hint={t.passwordHint}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
    />
  );
}

// ---------------------------------------------------------------------------
type ShopValues = {
  name: string;
  contactName: string;
  phone: string;
  pointName: string;
  address: string;
  district: string;
  landmark: string;
  pointContact: string;
  pointPhone: string;
  login: string;
  userName: string;
  password: string;
};

export function CreateShopForm({ districts }: { districts: string[] }) {
  const t = useDirT();
  const n = t.names;
  const [withUser, setWithUser] = useState(true);
  const form = useActionForm<ShopValues, { shopId: string }>({
    draftKey: "dir-create-shop",
    initialValues: { name: "", contactName: "", phone: "", pointName: "", address: "", district: "", landmark: "", pointContact: "", pointPhone: "", login: "", userName: "", password: "" },
    successMessage: t.shopSuccess,
  });
  const v = form.values;
  const fe = form.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e: Record<string, string> = {};
        req(v.name, n.shopName, e, "name", t.required);
        req(v.pointName, n.pointName, e, "point.name", t.required);
        req(v.address, n.address, e, "point.address", t.required, 3);
        req(v.district, n.district, e, "point.district", t.required);
        req(v.pointPhone, n.phone, e, "point.contactPhone", t.required, 7);
        if (withUser) {
          if (!LOGIN_RE.test(v.login.trim())) e["user.login"] = t.loginErr;
          req(v.userName, n.staffName, e, "user.name", t.required);
          if (v.password.length < 8) e["user.password"] = t.passwordErr;
        }
        if (Object.keys(e).length) return form.fail(t.formErrorLong, e);
        void form.submit(() =>
          createShop({
            name: v.name.trim(),
            contactName: v.contactName.trim() || undefined,
            phone: v.phone.trim() || undefined,
            point: {
              name: v.pointName.trim(),
              address: v.address.trim(),
              district: v.district.trim(),
              landmark: v.landmark.trim() || undefined,
              contactName: v.pointContact.trim() || undefined,
              contactPhone: v.pointPhone.trim(),
            },
            user: withUser ? { login: v.login.trim(), name: v.userName.trim(), password: v.password } : undefined,
          }),
        );
      }}
    >
      <FormStatus form={form} only="draft" />
      <div className="grid gap-3 md:grid-cols-3">
        <TextInput label={t.shopName} required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <TextInput label={t.responsible} optional value={v.contactName} onChange={(e) => form.setValue("contactName", e.target.value)} error={fe.contactName} />
        <PhoneInput label={t.shopPhone} optional value={v.phone} onChange={(x) => form.setValue("phone", x)} error={fe.phone} />
      </div>
      <fieldset className="space-y-3 rounded-xl border border-line p-3">
        <legend className="px-1 font-semibold">{t.firstPoint}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label={t.pointName} required placeholder={t.pointNamePh} value={v.pointName} onChange={(e) => form.setValue("pointName", e.target.value)} error={fe["point.name"]} />
          <DistrictInput value={v.district} onChange={(x) => form.setValue("district", x)} districts={districts} error={fe["point.district"]} />
          <TextInput label={t.address} required value={v.address} onChange={(e) => form.setValue("address", e.target.value)} error={fe["point.address"]} />
          <TextInput label={t.landmark} optional value={v.landmark} onChange={(e) => form.setValue("landmark", e.target.value)} error={fe["point.landmark"]} />
          <TextInput label={t.pointContact} optional value={v.pointContact} onChange={(e) => form.setValue("pointContact", e.target.value)} error={fe["point.contactName"]} />
          <PhoneInput label={t.pointPhone} required value={v.pointPhone} onChange={(x) => form.setValue("pointPhone", x)} error={fe["point.contactPhone"]} />
        </div>
      </fieldset>
      <Checkbox label={t.createAccount} checked={withUser} onChange={setWithUser} />
      {withUser ? (
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput label={t.login} required autoCapitalize="none" spellCheck={false} value={v.login} onChange={(e) => form.setValue("login", e.target.value.toLowerCase())} error={fe["user.login"]} />
          <TextInput label={t.staffName} required value={v.userName} onChange={(e) => form.setValue("userName", e.target.value)} error={fe["user.name"]} />
          <PasswordInput value={v.password} onChange={(x) => form.setValue("password", x)} error={fe["user.password"]} />
        </div>
      ) : null}
      <FormStatus form={form} only="result" />
      <Button type="submit" loading={form.pending}>
        {t.addShopBtn}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function AddPointForm({ shopId, districts }: { shopId: string; districts: string[] }) {
  const t = useDirT();
  const n = t.names;
  const form = useActionForm<{ name: string; address: string; district: string; landmark: string; contactName: string; contactPhone: string }, { pointId: string }>({
    initialValues: { name: "", address: "", district: "", landmark: "", contactName: "", contactPhone: "" },
    successMessage: t.pointSuccess,
  });
  const v = form.values;
  const fe = form.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e: Record<string, string> = {};
        req(v.name, n.pointName, e, "name", t.required);
        req(v.address, n.address, e, "address", t.required, 3);
        req(v.district, n.district, e, "district", t.required);
        req(v.contactPhone, n.phone, e, "contactPhone", t.required, 7);
        if (Object.keys(e).length) return form.fail(t.formError, e);
        void form.submit(() =>
          addPoint({
            shopId,
            name: v.name.trim(),
            address: v.address.trim(),
            district: v.district.trim(),
            landmark: v.landmark.trim() || undefined,
            contactName: v.contactName.trim() || undefined,
            contactPhone: v.contactPhone.trim(),
          }),
        );
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput label={t.pointName} required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <DistrictInput value={v.district} onChange={(x) => form.setValue("district", x)} districts={districts} error={fe.district} />
        <TextInput label={t.address} required value={v.address} onChange={(e) => form.setValue("address", e.target.value)} error={fe.address} />
        <TextInput label={t.landmark} optional value={v.landmark} onChange={(e) => form.setValue("landmark", e.target.value)} error={fe.landmark} />
        <TextInput label={t.contact} optional value={v.contactName} onChange={(e) => form.setValue("contactName", e.target.value)} error={fe.contactName} />
        <PhoneInput label={t.phone} required value={v.contactPhone} onChange={(x) => form.setValue("contactPhone", x)} error={fe.contactPhone} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        {t.addPointBtn}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function AddShopUserForm({ shopId }: { shopId: string }) {
  const t = useDirT();
  const form = useActionForm<{ login: string; name: string; password: string }, { userId: string }>({
    initialValues: { login: "", name: "", password: "" },
    successMessage: t.userSuccess,
  });
  const v = form.values;
  const fe = form.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e: Record<string, string> = {};
        if (!LOGIN_RE.test(v.login.trim())) e.login = t.loginErr;
        req(v.name, t.names.name, e, "name", t.required);
        if (v.password.length < 8) e.password = t.passwordErr;
        if (Object.keys(e).length) return form.fail(t.formError, e);
        void form.submit(() => addShopUser({ shopId, login: v.login.trim(), name: v.name.trim(), password: v.password }));
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TextInput label={t.login} required autoCapitalize="none" spellCheck={false} value={v.login} onChange={(e) => form.setValue("login", e.target.value.toLowerCase())} error={fe.login} />
        <TextInput label={t.name} required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <PasswordInput value={v.password} onChange={(x) => form.setValue("password", x)} error={fe.password} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        {t.addUserBtn}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function CreateCollectorForm() {
  const t = useDirT();
  const form = useActionForm<{ name: string; phone: string; login: string; password: string }, { userId: string }>({
    draftKey: "dir-create-collector",
    initialValues: { name: "", phone: "", login: "", password: "" },
    successMessage: t.collectorSuccess,
  });
  const v = form.values;
  const fe = form.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e: Record<string, string> = {};
        req(v.name, t.names.name, e, "name", t.required);
        req(v.phone, t.names.phone, e, "phone", t.required, 7);
        if (!LOGIN_RE.test(v.login.trim())) e.login = t.loginErr;
        if (v.password.length < 8) e.password = t.passwordErr;
        if (Object.keys(e).length) return form.fail(t.formError, e);
        void form.submit(() => createCollector({ name: v.name.trim(), phone: v.phone.trim(), login: v.login.trim(), password: v.password }));
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput label={t.name} required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <PhoneInput label={t.phone} required value={v.phone} onChange={(x) => form.setValue("phone", x)} error={fe.phone} />
        <TextInput label={t.login} required autoCapitalize="none" spellCheck={false} value={v.login} onChange={(e) => form.setValue("login", e.target.value.toLowerCase())} error={fe.login} />
        <PasswordInput value={v.password} onChange={(x) => form.setValue("password", x)} error={fe.password} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        {t.addCollectorBtn}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
type BuyerValues = { name: string; contactName: string; phone: string; address: string; qualityTerms: string; minBatchKg: string };

function BuyerFields({ v, fe, set, withName }: { v: BuyerValues; fe: Record<string, string>; set: (k: keyof BuyerValues, x: string) => void; withName: boolean }) {
  const t = useDirT();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {withName ? <TextInput label={t.buyerName} required value={v.name} onChange={(e) => set("name", e.target.value)} error={fe.name} /> : null}
      <TextInput label={t.contactPerson} optional value={v.contactName} onChange={(e) => set("contactName", e.target.value)} error={fe.contactName} />
      <PhoneInput label={t.phone} optional value={v.phone} onChange={(x) => set("phone", x)} error={fe.phone} />
      <TextInput label={t.address} optional value={v.address} onChange={(e) => set("address", e.target.value)} error={fe.address} />
      <KgInput label={t.minBatch} required value={v.minBatchKg} onValueChange={(x) => set("minBatchKg", x)} error={fe.minBatchKg} />
      <Textarea
        label={t.qualityTerms}
        required
        className="md:col-span-2"
        placeholder={t.qualityPh}
        value={v.qualityTerms}
        onChange={(e) => set("qualityTerms", e.target.value)}
        error={fe.qualityTerms}
      />
    </div>
  );
}

function validateBuyer(v: BuyerValues, withName: boolean, t: ReturnType<typeof useDirT>) {
  const e: Record<string, string> = {};
  if (withName) req(v.name, t.names.buyerName, e, "name", t.required);
  if (v.qualityTerms.trim().length < 3) e.qualityTerms = t.qualityErr;
  if (parseKgToGrams(v.minBatchKg) === null) e.minBatchKg = t.minBatchErr;
  return e;
}

export function CreateBuyerForm() {
  const t = useDirT();
  const form = useActionForm<BuyerValues, { buyerId: string }>({
    draftKey: "dir-create-buyer",
    initialValues: { name: "", contactName: "", phone: "", address: "", qualityTerms: "", minBatchKg: "" },
    successMessage: t.buyerSuccess,
  });
  const v = form.values;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validateBuyer(v, true, t);
        if (Object.keys(e).length) return form.fail(t.formError, e);
        void form.submit(() =>
          createBuyer({
            name: v.name.trim(),
            contactName: v.contactName.trim() || undefined,
            phone: v.phone.trim() || undefined,
            address: v.address.trim() || undefined,
            qualityTerms: v.qualityTerms.trim(),
            minBatchKg: v.minBatchKg,
          }),
        );
      }}
    >
      <BuyerFields v={v} fe={form.fieldErrors} set={(k, x) => form.setValue(k, x)} withName />
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        {t.addBuyerBtn}
      </Button>
    </form>
  );
}

export function UpdateBuyerForm({ buyer }: { buyer: BuyerDTO }) {
  const t = useDirT();
  const [active, setActive] = useState(buyer.isActive);
  const form = useActionForm<BuyerValues>({
    initialValues: {
      name: buyer.name,
      contactName: buyer.contactName ?? "",
      phone: buyer.phone ?? "",
      address: buyer.address ?? "",
      qualityTerms: buyer.qualityTerms,
      minBatchKg: gramsToKgInput(buyer.minBatchGrams),
    },
    resetOnSuccess: false,
    successMessage: t.buyerUpdated,
  });
  const v = form.values;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validateBuyer(v, false, t);
        if (Object.keys(e).length) return form.fail(t.formError, e);
        void form.submit(() =>
          updateBuyer({
            buyerId: buyer.id,
            contactName: v.contactName.trim() || undefined,
            phone: v.phone.trim() || undefined,
            address: v.address.trim() || undefined,
            qualityTerms: v.qualityTerms.trim(),
            minBatchKg: v.minBatchKg,
            isActive: active,
          }),
        );
      }}
    >
      <BuyerFields v={v} fe={form.fieldErrors} set={(k, x) => form.setValue(k, x)} withName={false} />
      <Checkbox label={t.activeBuyer} checked={active} onChange={setActive} />
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        {t.saveChanges}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function CreateTariffForm({ current }: { current: { shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number } | null }) {
  const t = useDirT();
  const form = useActionForm<{ shop: string; buyer: string; fee: string; note: string }, { tariffId: string }>({
    initialValues: {
      shop: current ? sanitizeSom(String(current.shopPricePerKg)) : "",
      buyer: current ? sanitizeSom(String(current.buyerPricePerKg)) : "",
      fee: current ? sanitizeSom(String(current.serviceFee)) : "0",
      note: "",
    },
    resetOnSuccess: false,
    successMessage: t.tariffSuccess,
  });
  const v = form.values;
  const fe = form.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const shop = parseSom(v.shop);
        const buyer = parseSom(v.buyer);
        const fee = parseSom(v.fee);
        const e: Record<string, string> = {};
        if (shop === null) e.shopPricePerKg = t.wholeSom;
        if (buyer === null) e.buyerPricePerKg = t.wholeSom;
        if (fee === null) e.serviceFee = t.wholeSomZero;
        if (shop === null || buyer === null || fee === null) return form.fail(t.formError, e);
        void form.submit(() => createTariff({ shopPricePerKg: shop, buyerPricePerKg: buyer, serviceFee: fee, note: v.note.trim() || undefined }));
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <SomInput label={t.shopPerKg} required value={v.shop} onValueChange={(x) => form.setValue("shop", x)} error={fe.shopPricePerKg} />
        <SomInput label={t.buyerPerKg} required value={v.buyer} onValueChange={(x) => form.setValue("buyer", x)} error={fe.buyerPricePerKg} />
        <SomInput label={t.feePerTrip} required value={v.fee} onValueChange={(x) => form.setValue("fee", x)} error={fe.serviceFee} />
      </div>
      <TextInput label={t.note} optional value={v.note} onChange={(e) => form.setValue("note", e.target.value)} error={fe.note} />
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        {t.saveTariff}
      </Button>
    </form>
  );
}
