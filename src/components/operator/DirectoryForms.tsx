"use client";

import { useId, useState } from "react";
import type { BuyerDTO } from "@/server/contract";
import { addPoint, addShopUser, createBuyer, createCollector, createShop, createTariff, updateBuyer } from "@/server/actions/operator";
import { parseSom } from "@/domain/money";
import { parseKgToGrams } from "@/domain/weight";
import { gramsToKgInput } from "@/lib/format";
import { useActionForm } from "@/lib/client/use-action-form";
import { FormStatus } from "@/lib/client/FormStatus";
import { Button } from "@/components/ui/Button";
import { Checkbox, KgInput, SomInput, TextInput, Textarea, sanitizeSom } from "@/components/ui/Field";

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/;

function req(v: string, label: string, errors: Record<string, string>, key: string, min = 2) {
  if (v.trim().length < min) errors[key] = `${label}ni kiriting.`;
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
  const listId = useId();
  return (
    <>
      <TextInput label="Hudud (mahalla)" required list={listId} value={value} onChange={(e) => onChange(e.target.value)} error={error} hint="Navbatni hudud bo‘yicha saralash uchun" />
      <datalist id={listId}>
        {districts.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </>
  );
}

function PasswordInput({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <TextInput
      label="Boshlang‘ich parol"
      type="text"
      autoComplete="new-password"
      required
      hint="Kamida 8 belgi. Foydalanuvchiga xavfsiz yo‘l bilan bering."
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
  const [withUser, setWithUser] = useState(true);
  const form = useActionForm<ShopValues, { shopId: string }>({
    draftKey: "dir-create-shop",
    initialValues: { name: "", contactName: "", phone: "", pointName: "", address: "", district: "", landmark: "", pointContact: "", pointPhone: "", login: "", userName: "", password: "" },
    successMessage: "Do‘kon qo‘shildi.",
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
        req(v.name, "Do‘kon nomi", e, "name");
        req(v.pointName, "Nuqta nomi", e, "point.name");
        req(v.address, "Manzil", e, "point.address", 3);
        req(v.district, "Hudud", e, "point.district");
        req(v.pointPhone, "Telefon", e, "point.contactPhone", 7);
        if (withUser) {
          if (!LOGIN_RE.test(v.login.trim())) e["user.login"] = "Login: 3–32 belgi, kichik lotin harflari, raqam, . _ -";
          req(v.userName, "Xodim ismi", e, "user.name");
          if (v.password.length < 8) e["user.password"] = "Parol kamida 8 belgi bo‘lsin.";
        }
        if (Object.keys(e).length) return form.fail("Formada xato bor — belgilangan maydonlarni tuzating.", e);
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
        <TextInput label="Do‘kon nomi" required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <TextInput label="Mas’ul shaxs" optional value={v.contactName} onChange={(e) => form.setValue("contactName", e.target.value)} error={fe.contactName} />
        <PhoneInput label="Do‘kon telefoni" optional value={v.phone} onChange={(x) => form.setValue("phone", x)} error={fe.phone} />
      </div>
      <fieldset className="space-y-3 rounded-xl border border-line p-3">
        <legend className="px-1 font-semibold">Birinchi olib ketish nuqtasi</legend>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Nuqta nomi" required placeholder="Masalan: Markaziy filial" value={v.pointName} onChange={(e) => form.setValue("pointName", e.target.value)} error={fe["point.name"]} />
          <DistrictInput value={v.district} onChange={(x) => form.setValue("district", x)} districts={districts} error={fe["point.district"]} />
          <TextInput label="Manzil" required value={v.address} onChange={(e) => form.setValue("address", e.target.value)} error={fe["point.address"]} />
          <TextInput label="Mo‘ljal" optional value={v.landmark} onChange={(e) => form.setValue("landmark", e.target.value)} error={fe["point.landmark"]} />
          <TextInput label="Nuqtadagi kontakt" optional value={v.pointContact} onChange={(e) => form.setValue("pointContact", e.target.value)} error={fe["point.contactName"]} />
          <PhoneInput label="Nuqta telefoni" required value={v.pointPhone} onChange={(x) => form.setValue("pointPhone", x)} error={fe["point.contactPhone"]} />
        </div>
      </fieldset>
      <Checkbox label="Do‘kon xodimi uchun akkaunt yaratish" checked={withUser} onChange={setWithUser} />
      {withUser ? (
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput label="Login" required autoCapitalize="none" spellCheck={false} value={v.login} onChange={(e) => form.setValue("login", e.target.value.toLowerCase())} error={fe["user.login"]} />
          <TextInput label="Xodim ismi" required value={v.userName} onChange={(e) => form.setValue("userName", e.target.value)} error={fe["user.name"]} />
          <PasswordInput value={v.password} onChange={(x) => form.setValue("password", x)} error={fe["user.password"]} />
        </div>
      ) : null}
      <FormStatus form={form} only="result" />
      <Button type="submit" loading={form.pending}>
        Do‘konni qo‘shish
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function AddPointForm({ shopId, districts }: { shopId: string; districts: string[] }) {
  const form = useActionForm<{ name: string; address: string; district: string; landmark: string; contactName: string; contactPhone: string }, { pointId: string }>({
    initialValues: { name: "", address: "", district: "", landmark: "", contactName: "", contactPhone: "" },
    successMessage: "Nuqta qo‘shildi.",
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
        req(v.name, "Nuqta nomi", e, "name");
        req(v.address, "Manzil", e, "address", 3);
        req(v.district, "Hudud", e, "district");
        req(v.contactPhone, "Telefon", e, "contactPhone", 7);
        if (Object.keys(e).length) return form.fail("Formada xato bor.", e);
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
        <TextInput label="Nuqta nomi" required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <DistrictInput value={v.district} onChange={(x) => form.setValue("district", x)} districts={districts} error={fe.district} />
        <TextInput label="Manzil" required value={v.address} onChange={(e) => form.setValue("address", e.target.value)} error={fe.address} />
        <TextInput label="Mo‘ljal" optional value={v.landmark} onChange={(e) => form.setValue("landmark", e.target.value)} error={fe.landmark} />
        <TextInput label="Kontakt" optional value={v.contactName} onChange={(e) => form.setValue("contactName", e.target.value)} error={fe.contactName} />
        <PhoneInput label="Telefon" required value={v.contactPhone} onChange={(x) => form.setValue("contactPhone", x)} error={fe.contactPhone} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        Nuqtani qo‘shish
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function AddShopUserForm({ shopId }: { shopId: string }) {
  const form = useActionForm<{ login: string; name: string; password: string }, { userId: string }>({
    initialValues: { login: "", name: "", password: "" },
    successMessage: "Xodim akkaunti yaratildi.",
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
        if (!LOGIN_RE.test(v.login.trim())) e.login = "Login: 3–32 belgi, kichik lotin harflari, raqam, . _ -";
        req(v.name, "Ism", e, "name");
        if (v.password.length < 8) e.password = "Parol kamida 8 belgi bo‘lsin.";
        if (Object.keys(e).length) return form.fail("Formada xato bor.", e);
        void form.submit(() => addShopUser({ shopId, login: v.login.trim(), name: v.name.trim(), password: v.password }));
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <TextInput label="Login" required autoCapitalize="none" spellCheck={false} value={v.login} onChange={(e) => form.setValue("login", e.target.value.toLowerCase())} error={fe.login} />
        <TextInput label="Ism" required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <PasswordInput value={v.password} onChange={(x) => form.setValue("password", x)} error={fe.password} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        Xodimni qo‘shish
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function CreateCollectorForm() {
  const form = useActionForm<{ name: string; phone: string; login: string; password: string }, { userId: string }>({
    draftKey: "dir-create-collector",
    initialValues: { name: "", phone: "", login: "", password: "" },
    successMessage: "Yig‘uvchi qo‘shildi.",
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
        req(v.name, "Ism", e, "name");
        req(v.phone, "Telefon", e, "phone", 7);
        if (!LOGIN_RE.test(v.login.trim())) e.login = "Login: 3–32 belgi, kichik lotin harflari, raqam, . _ -";
        if (v.password.length < 8) e.password = "Parol kamida 8 belgi bo‘lsin.";
        if (Object.keys(e).length) return form.fail("Formada xato bor.", e);
        void form.submit(() => createCollector({ name: v.name.trim(), phone: v.phone.trim(), login: v.login.trim(), password: v.password }));
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TextInput label="Ism" required value={v.name} onChange={(e) => form.setValue("name", e.target.value)} error={fe.name} />
        <PhoneInput label="Telefon" required value={v.phone} onChange={(x) => form.setValue("phone", x)} error={fe.phone} />
        <TextInput label="Login" required autoCapitalize="none" spellCheck={false} value={v.login} onChange={(e) => form.setValue("login", e.target.value.toLowerCase())} error={fe.login} />
        <PasswordInput value={v.password} onChange={(x) => form.setValue("password", x)} error={fe.password} />
      </div>
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        Yig‘uvchini qo‘shish
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
type BuyerValues = { name: string; contactName: string; phone: string; address: string; qualityTerms: string; minBatchKg: string };

function BuyerFields({ v, fe, set, withName }: { v: BuyerValues; fe: Record<string, string>; set: (k: keyof BuyerValues, x: string) => void; withName: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {withName ? <TextInput label="Xaridor nomi" required value={v.name} onChange={(e) => set("name", e.target.value)} error={fe.name} /> : null}
      <TextInput label="Kontakt shaxs" optional value={v.contactName} onChange={(e) => set("contactName", e.target.value)} error={fe.contactName} />
      <PhoneInput label="Telefon" optional value={v.phone} onChange={(x) => set("phone", x)} error={fe.phone} />
      <TextInput label="Manzil" optional value={v.address} onChange={(e) => set("address", e.target.value)} error={fe.address} />
      <KgInput label="Minimal partiya" required value={v.minBatchKg} onValueChange={(x) => set("minBatchKg", x)} error={fe.minBatchKg} />
      <Textarea
        label="Sifat sharti"
        required
        className="md:col-span-2"
        placeholder="Masalan: quruq, yog‘siz, plyonka va skotchsiz karton"
        value={v.qualityTerms}
        onChange={(e) => set("qualityTerms", e.target.value)}
        error={fe.qualityTerms}
      />
    </div>
  );
}

function validateBuyer(v: BuyerValues, withName: boolean) {
  const e: Record<string, string> = {};
  if (withName) req(v.name, "Xaridor nomi", e, "name");
  if (v.qualityTerms.trim().length < 3) e.qualityTerms = "Sifat shartini yozing.";
  if (parseKgToGrams(v.minBatchKg) === null) e.minBatchKg = "Minimal partiyani kg’da kiriting (0 bo‘lishi mumkin).";
  return e;
}

export function CreateBuyerForm() {
  const form = useActionForm<BuyerValues, { buyerId: string }>({
    draftKey: "dir-create-buyer",
    initialValues: { name: "", contactName: "", phone: "", address: "", qualityTerms: "", minBatchKg: "" },
    successMessage: "Xaridor qo‘shildi.",
  });
  const v = form.values;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validateBuyer(v, true);
        if (Object.keys(e).length) return form.fail("Formada xato bor.", e);
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
        Xaridorni qo‘shish
      </Button>
    </form>
  );
}

export function UpdateBuyerForm({ buyer }: { buyer: BuyerDTO }) {
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
    successMessage: "Xaridor ma’lumoti yangilandi.",
  });
  const v = form.values;
  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const e = validateBuyer(v, false);
        if (Object.keys(e).length) return form.fail("Formada xato bor.", e);
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
      <Checkbox label="Faol xaridor (reys tuzishda ko‘rinadi)" checked={active} onChange={setActive} />
      <FormStatus form={form} />
      <Button type="submit" variant="secondary" loading={form.pending}>
        O‘zgarishlarni saqlash
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function CreateTariffForm({ current }: { current: { shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number } | null }) {
  const form = useActionForm<{ shop: string; buyer: string; fee: string; note: string }, { tariffId: string }>({
    initialValues: {
      shop: current ? sanitizeSom(String(current.shopPricePerKg)) : "",
      buyer: current ? sanitizeSom(String(current.buyerPricePerKg)) : "",
      fee: current ? sanitizeSom(String(current.serviceFee)) : "0",
      note: "",
    },
    resetOnSuccess: false,
    successMessage: "Yangi tarif saqlandi. U faqat yangi reyslarga qo‘llanadi.",
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
        if (shop === null) e.shopPricePerKg = "Butun so‘mda kiriting.";
        if (buyer === null) e.buyerPricePerKg = "Butun so‘mda kiriting.";
        if (fee === null) e.serviceFee = "Butun so‘mda kiriting (0 bo‘lishi mumkin).";
        if (shop === null || buyer === null || fee === null) return form.fail("Formada xato bor.", e);
        void form.submit(() => createTariff({ shopPricePerKg: shop, buyerPricePerKg: buyer, serviceFee: fee, note: v.note.trim() || undefined }));
      }}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <SomInput label="Do‘konga, 1 kg" required value={v.shop} onValueChange={(x) => form.setValue("shop", x)} error={fe.shopPricePerKg} />
        <SomInput label="Xaridor, 1 kg" required value={v.buyer} onValueChange={(x) => form.setValue("buyer", x)} error={fe.buyerPricePerKg} />
        <SomInput label="Xizmat haqi, reys" required value={v.fee} onValueChange={(x) => form.setValue("fee", x)} error={fe.serviceFee} />
      </div>
      <TextInput label="Izoh" optional value={v.note} onChange={(e) => form.setValue("note", e.target.value)} error={fe.note} />
      <FormStatus form={form} />
      <Button type="submit" loading={form.pending}>
        Tarifni saqlash
      </Button>
    </form>
  );
}
