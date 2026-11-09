// Ochiq kirish rejimi (OPEN_ACCESS=true): login/parol formasi o‘rniga rol tanlash — bosilganda darhol kiriladi.
// Demo/taqdimot uchun. Rollar va obyekt ruxsatlari ichkarida o‘z holicha ishlaydi (sessiya baribir yaratiladi).
export function isOpenAccess(): boolean {
  return process.env.OPEN_ACCESS === "true";
}

/** Demo akkauntlar production’da faqat ochiq kirish rejimida ishlaydi. */
export function demoAccountsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || isOpenAccess();
}
