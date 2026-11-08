// ============================================================================
// UMUMIY SERVIS KONTRAKTI (orkestrator belgilagan).
// UI (interface-engineer) faqat shu turlarga tayanadi; backend (operations-engineer)
// aynan shu nomlar va imzolar bilan amalga oshiradi:
//   - so'rovlar (server-only): src/server/queries/{session,shop,collector,operator}.ts
//   - mutatsiyalar ("use server"): src/server/actions/{auth,upload,shop,collector,operator}.ts
// Kontraktni o'zgartirish faqat orkestrator orqali.
// Vazn — gramm (number, Int); pul — butun so'm (number, Int); vaqt — Date (UTC).
// ============================================================================

export type Role = "SHOP" | "COLLECTOR" | "OPERATOR";
export type Party = "ECO_POINT" | "COLLECTOR" | "BUYER" | "SHOP" | "OTHER";
export type VolumeSize = "SMALL" | "MEDIUM" | "LARGE";
export type RequestStatus = "NEW" | "PLANNED" | "COLLECTED" | "SKIPPED" | "CONFIRMED" | "DISPUTED" | "SETTLED" | "CANCELLED";
export type TripStatus = "PLANNED" | "IN_PROGRESS" | "COLLECTED" | "ACCEPTED" | "AWAITING_PAYMENT" | "CLOSED" | "CANCELLED";
export type StopStatus = "PENDING" | "COLLECTED" | "SKIPPED" | "REMOVED";
export type ConfirmationStatus = "CONFIRMED" | "DISPUTED";
export type DisputeStatus = "OPEN" | "DECIDED" | "RESOLVED";
export type Quality = "GOOD" | "ACCEPTABLE" | "POOR";
export type DiscrepancyDecision = "TRIP_ABSORBS" | "OTHER";
export type ExpenseType = "TRANSPORT" | "LOADING" | "OTHER";
export type ObligationType = "BUYER_MATERIAL" | "SHOP_PAYOUT" | "SERVICE_FEE";
export type PaymentKind = "PAYMENT" | "REFUND";
export type AttachmentKind = "REQUEST_PHOTO" | "SCALE_PHOTO" | "ACCEPTANCE_DOC";
/** Majburiyat bo'yicha to'lov holati (hisoblangan): */
export type PayState = "UNPAID" | "PARTIAL" | "PAID" | "OVERPAID";

// ---------------------------------------------------------------------------
// Amal natijasi. Xato matni o'zbekcha, foydalanuvchiga to'g'ridan-to'g'ri ko'rsatiladi.
// `code` — mashina uchun (testlar shunga tayanadi).
// ---------------------------------------------------------------------------
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "INVALID_TRANSITION"
  | "CONFLICT"
  | "DUPLICATE"
  | "OVERPAYMENT"
  | "UPLOAD_INVALID"
  | "INTERNAL";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string; /** idempotent takror bo'lsa true */ replayed?: boolean }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string> };

// ---------------------------------------------------------------------------
// Sessiya
// ---------------------------------------------------------------------------
export interface SessionUser {
  id: string;
  name: string;
  login: string;
  role: Role;
  shopId: string | null;
  shopName: string | null;
  isDemo: boolean;
}

export interface AppInfo {
  demoMode: boolean; // DEMO_MODE=true va NODE_ENV!=production
  appUrl: string;
}

export interface DemoAccount {
  login: string;
  password: string;
  role: Role;
  label: string; // "Do'kon xodimi — Nur market"
}

// ---------------------------------------------------------------------------
// Umumiy DTO'lar
// ---------------------------------------------------------------------------
export interface AttachmentDTO {
  id: string;
  kind: AttachmentKind;
  url: string; // /api/files/<id> — sessiya va obyekt ruxsati tekshiriladi
  mimeType: string;
  createdAt: Date;
}

export interface PointDTO {
  id: string;
  shopId: string;
  shopName: string;
  name: string;
  address: string;
  district: string;
  landmark: string | null;
  contactName: string | null;
  contactPhone: string;
}

export interface PaymentDTO {
  id: string;
  kind: PaymentKind;
  amount: number;
  paidAt: Date;
  method: string | null;
  reference: string | null;
  recordedByName: string;
}

export interface ObligationDTO {
  id: string;
  type: ObligationType;
  payer: Party;
  payee: Party;
  shopId: string | null;
  shopName: string | null;
  stopId: string | null;
  amount: number; // hisoblangan
  paid: number; // haqiqatda (PAYMENT − REFUND)
  remaining: number; // amount − paid (manfiy = ortiqcha to'langan)
  state: PayState;
  payments: PaymentDTO[];
}

export interface WeighingDTO {
  id: string;
  grossGrams: number;
  tareGrams: number;
  netGrams: number;
  recordedAt: Date;
  recordedByName: string;
  photos: AttachmentDTO[];
}

export interface DisputeDTO {
  id: string;
  stopId: string;
  status: DisputeStatus;
  reason: string;
  claimedNetGrams: number | null;
  openedByName: string;
  createdAt: Date;
  decisionText: string | null;
  decidedNetGrams: number | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  shopAckAt: Date | null;
  collectorAckAt: Date | null;
  lastRejectComment: string | null;
  resolvedAt: Date | null;
}

export interface StopDTO {
  id: string;
  tripId: string;
  tripNumber: number;
  sequence: number;
  status: StopStatus;
  request: { id: string; number: number; readyFrom: Date; readyTo: Date; estimatedGrams: number | null; volume: VolumeSize | null; note: string | null; photos: AttachmentDTO[] };
  point: PointDTO;
  weighing: WeighingDTO | null;
  confirmation: { status: ConfirmationStatus; reason: string | null; at: Date; byName: string } | null;
  disputes: DisputeDTO[];
  /** Hisob uchun amaldagi sof vazn: hal qilingan bahs qarori yoki tortish. */
  effectiveNetGrams: number | null;
  skipReason: string | null;
  skippedAt: Date | null;
  collectedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Do'kon
// ---------------------------------------------------------------------------
export interface ShopRequestSummary {
  id: string;
  number: number;
  status: RequestStatus;
  point: PointDTO;
  readyFrom: Date;
  readyTo: Date;
  estimatedGrams: number | null;
  volume: VolumeSize | null;
  note: string | null;
  createdAt: Date;
  /** Faol yoki oxirgi bekat (bo'lsa) */
  trip: { id: string; number: number; status: TripStatus; windowStart: Date; windowEnd: Date; collectorName: string; collectorPhone: string | null } | null;
  stop: { id: string; status: StopStatus; skipReason: string | null } | null;
  netGrams: number | null; // amaldagi sof vazn
  needsConfirmation: boolean; // tortilgan, lekin do'kon hali tasdiqlamagan
}

export interface ShopReceipt {
  requestId: string;
  requestNumber: number;
  stopId: string;
  tripNumber: number;
  pointName: string;
  collectedAt: Date | null;
  netGrams: number;
  pricePerKg: number; // reysdagi narx nusxasi
  amount: number; // hisoblangan (obligation bo'lsa — uning summasi, aks holda taxminiy)
  amountIsFinal: boolean; // obligation yaratilganmi (xaridor qabulidan keyin)
  paid: number;
  remaining: number;
  payState: PayState;
  confirmation: ConfirmationStatus | null;
  disputeStatus: DisputeStatus | null;
}

export interface ShopHome {
  shop: { id: string; name: string };
  points: PointDTO[];
  /** Eng yaqin rejalashtirilgan olib ketish (PLANNED/COLLECTED emas, hali olinmagan) */
  nextPickup: ShopRequestSummary | null;
  /** Tasdiq kutayotgan tortishlar */
  pendingConfirmations: ShopRequestSummary[];
  /** Hal qilinishi kerak bo'lgan bahs qarorlari (DECIDED, do'kon hali rozi bo'lmagan) */
  disputesAwaitingAck: (DisputeDTO & { requestNumber: number; pointName: string })[];
  activeRequests: ShopRequestSummary[];
  lastReceipt: ShopReceipt | null;
  totals: { accrued: number; paid: number; remaining: number };
}

export interface ShopRequestDetail extends ShopRequestSummary {
  photos: AttachmentDTO[];
  stops: StopDTO[]; // tarix: qoldirilgan bekatlar ham
  receipt: ShopReceipt | null;
  canCancel: boolean;
  canConfirm: boolean; // canDispute ham shu
}

export interface ShopHistory {
  receipts: ShopReceipt[];
  requests: ShopRequestSummary[];
}

// ---------------------------------------------------------------------------
// Yig'uvchi
// ---------------------------------------------------------------------------
export interface CollectorTripSummary {
  id: string;
  number: number;
  status: TripStatus;
  windowStart: Date;
  windowEnd: Date;
  buyer: { name: string; address: string | null; phone: string | null };
  vehicle: string | null;
  note: string | null;
  stops: StopDTO[];
  nextStopId: string | null; // birinchi PENDING bekat
  doneCount: number;
  totalCount: number;
  collectedGrams: number;
}

export interface CollectorToday {
  today: string; // YYYY-MM-DD (Toshkent)
  trips: CollectorTripSummary[]; // bugungi va o'tgan kundan qolgan tugallanmaganlar
  upcoming: CollectorTripSummary[]; // keyingi kunlar
  disputesAwaitingAck: (DisputeDTO & { tripNumber: number; pointName: string })[];
}

export interface CollectorTripDetail extends CollectorTripSummary {
  settlement: SettlementDTO | null; // hamkor o'z reysi iqtisodini ko'radi (qabuldan keyin)
}

export interface CollectorStopDetail {
  stop: StopDTO;
  trip: { id: string; number: number; status: TripStatus };
  canRecord: boolean; // PENDING va reys faol
}

// ---------------------------------------------------------------------------
// Operator
// ---------------------------------------------------------------------------
export interface QueueItem {
  id: string;
  number: number;
  status: RequestStatus; // NEW yoki SKIPPED
  point: PointDTO;
  readyFrom: Date;
  readyTo: Date;
  estimatedGrams: number | null;
  volume: VolumeSize | null;
  note: string | null;
  hasPhoto: boolean;
  createdAt: Date;
  lastSkipReason: string | null; // qoldirilgan bo'lsa
  isLate: boolean; // readyTo o'tib ketgan
}

export interface QueueFilters {
  date?: string; // YYYY-MM-DD; bo'sh bo'lsa — barcha ochiq
  district?: string;
}

export interface OperatorQueue {
  filters: QueueFilters;
  districts: string[];
  items: QueueItem[];
}

export interface PersonOption {
  id: string;
  name: string;
  phone: string | null;
}

export interface BuyerDTO {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  qualityTerms: string;
  minBatchGrams: number;
  isActive: boolean;
}

export interface TariffDTO {
  id: string;
  shopPricePerKg: number;
  buyerPricePerKg: number;
  serviceFee: number;
  validFrom: Date;
  note: string | null;
}

export interface TripBuilderOptions {
  collectors: PersonOption[];
  buyers: BuyerDTO[];
  currentTariff: TariffDTO | null;
  /** Tanlangan buyurtmalar (ids query parametri bo'yicha), tanlangan tartibda */
  selected: QueueItem[];
}

export interface TripListItem {
  id: string;
  number: number;
  status: TripStatus;
  windowStart: Date;
  windowEnd: Date;
  collectorName: string;
  buyerName: string;
  stopCount: number;
  doneCount: number;
  deliveredGrams: number;
  acceptedGrams: number | null;
  openDisputes: number;
  remainingToPay: number; // barcha majburiyatlar qoldig'i
}

export interface SettlementDTO {
  // Vaznlar
  deliveredGrams: number; // topshirishlar (amaldagi sof) yig'indisi
  acceptedGrams: number;
  discrepancyGrams: number; // accepted − delivered
  // Pul (hisoblangan)
  buyerPricePerKg: number;
  shopPricePerKg: number;
  buyerRevenue: number; // xaridorning material uchun to'lovi
  shopPayouts: { stopId: string; shopId: string; shopName: string; netGrams: number; amount: number }[];
  shopPayoutTotal: number;
  expensesTotal: number;
  tripContribution: number; // revenue − shops − expenses (butun reys hissasi)
  serviceFee: number; // Eco Point xizmat haqi (hamkor to'laydi)
  partnerShareAfterFee: number; // tripContribution − serviceFee
  ecoPointServiceIncome: number; // = serviceFee (reys iqtisodiga qayta qo'shilmaydi)
}

export interface CloseCheck {
  key: "STOPS_RESOLVED" | "CONFIRMED" | "ACCEPTANCE" | "DISPUTES" | "PAID";
  ok: boolean;
  label: string; // o'zbekcha tavsif
}

export interface ExpenseDTO {
  id: string;
  type: ExpenseType;
  amount: number;
  payer: Party;
  recipient: string | null;
  note: string | null;
  createdAt: Date;
  createdByName: string;
}

export interface AcceptanceDTO {
  id: string;
  acceptedGrams: number;
  deliveredGrams: number;
  discrepancyGrams: number;
  quality: Quality;
  qualityNote: string | null;
  discrepancyReason: string | null;
  decision: DiscrepancyDecision | null;
  decisionNote: string | null;
  buyerPricePerKg: number;
  buyerReference: string;
  acceptedAt: Date;
  recordedByName: string;
  documents: AttachmentDTO[];
}

export interface AuditDTO {
  id: string;
  at: Date;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  tripNumber: number | null;
  reason: string | null;
  before: unknown;
  after: unknown;
}

export interface TripDetail {
  id: string;
  number: number;
  status: TripStatus;
  windowStart: Date;
  windowEnd: Date;
  collector: PersonOption;
  buyer: BuyerDTO;
  prices: { shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number; tariffId: string | null };
  responsibleParty: Party;
  vehicle: string | null;
  note: string | null;
  cancelReason: string | null;
  closedAt: Date | null;
  stops: StopDTO[];
  acceptance: AcceptanceDTO | null;
  expenses: ExpenseDTO[];
  obligations: ObligationDTO[];
  settlement: SettlementDTO | null; // qabuldan keyin
  /** Qabuldan oldin ham ko'rsatish uchun: topshirishlar yig'indisi */
  deliveredGrams: number;
  closeChecks: CloseCheck[];
  audit: AuditDTO[];
  allowed: {
    reorder: boolean; // PLANNED
    cancel: boolean; // PLANNED
    recordAcceptance: boolean; // COLLECTED (va hali qabul yo'q)
    addExpense: boolean; // CLOSED/CANCELLED emas
    recordPayment: boolean; // ACCEPTED/AWAITING_PAYMENT/CLOSED(ortiqcha bo'lsa)
    close: boolean; // ACCEPTED/AWAITING_PAYMENT
    correct: boolean; // ACCEPTED/AWAITING_PAYMENT/CLOSED
  };
  shareUrl: string; // APP_URL/operator/trips/<id>
}

export interface ShopAdminDTO {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  points: PointDTO[];
  users: { id: string; login: string; name: string }[];
}

export interface OperatorDirectory {
  shops: ShopAdminDTO[];
  collectors: (PersonOption & { login: string; activeTrips: number })[];
  buyers: BuyerDTO[];
  tariffs: TariffDTO[]; // yangi → eski
  districts: string[];
}

export interface OperatorDashboardCounts {
  queue: number;
  activeTrips: number;
  awaitingAcceptance: number;
  awaitingPayment: number;
  openDisputes: number;
}

// ---------------------------------------------------------------------------
// SO'ROVLAR (server-only; sessiyani o'zi o'qiydi; ruxsat bo'lmasa
// rolga mos sahifada redirect('/login') yoki notFound() chaqiradi)
// ---------------------------------------------------------------------------
// src/server/queries/session.ts
//   getSessionUser(): Promise<SessionUser | null>
//   requireUser(role?: Role): Promise<SessionUser>     // yo'q bo'lsa redirect('/login'); boshqa rol → redirect(homeFor(role))
//   getAppInfo(): AppInfo
//   getDemoAccounts(): DemoAccount[]                   // demoMode=false bo'lsa []
// src/server/queries/shop.ts
//   getShopHome(): Promise<ShopHome>
//   getShopRequest(id: string): Promise<ShopRequestDetail>   // begona → notFound()
//   getShopHistory(): Promise<ShopHistory>
// src/server/queries/collector.ts
//   getCollectorToday(): Promise<CollectorToday>
//   getCollectorTrip(id: string): Promise<CollectorTripDetail>   // begona → notFound()
//   getCollectorStop(stopId: string): Promise<CollectorStopDetail>
// src/server/queries/operator.ts
//   getOperatorCounts(): Promise<OperatorDashboardCounts>
//   getQueue(filters: QueueFilters): Promise<OperatorQueue>
//   getTripBuilderOptions(requestIds: string[]): Promise<TripBuilderOptions>
//   getTrips(filter: { status?: TripStatus | "ACTIVE" | "ALL" }): Promise<TripListItem[]>
//   getTripDetail(id: string): Promise<TripDetail>
//   getDirectory(): Promise<OperatorDirectory>
//   getAudit(filter: { tripId?: string; limit?: number }): Promise<AuditDTO[]>

// ---------------------------------------------------------------------------
// MUTATSIYALAR ("use server"). Har biri: sessiya + rol + obyekt ruxsati,
// zod validatsiya, tranzaksiya, audit, revalidatePath. clientKey — formaning
// mount paytida yaratilgan UUID (idempotentlik: takroriy yuborish bir xil natija).
// ---------------------------------------------------------------------------
export interface LoginState { error?: string; login?: string }
// src/server/actions/auth.ts
//   loginAction(prev: LoginState, formData: FormData): Promise<LoginState>  // muvaffaqiyatda redirect(homeFor(role))
//   logoutAction(): Promise<void>                                          // redirect('/login')

// src/server/actions/upload.ts
//   uploadImage(formData: FormData /* file: File, kind: AttachmentKind */): Promise<ActionResult<{ attachmentId: string; url: string }>>
//   Qoidalar: ≤ 5 MB, haqiqiy JPEG/PNG/WebP (magic bytes), yopiq STORAGE_DIR.
//   Yuklangan fayl keyingi amalda attachmentId orqali bog'lanadi (faqat yuklagan o'zi bog'lay oladi).

export interface CreatePickupRequestInput {
  clientKey: string;
  pointId: string;
  readyDate: string; // YYYY-MM-DD
  fromTime: string; // HH:mm
  toTime: string; // HH:mm
  estimatedKg?: string; // "45" | "45,5" — ixtiyoriy (tarozisiz do'kon uchun bo'sh)
  volume?: VolumeSize; // tarozisiz: taxminiy hajm
  note?: string;
  photoAttachmentId?: string;
}
// src/server/actions/shop.ts
//   createPickupRequest(input: CreatePickupRequestInput): Promise<ActionResult<{ requestId: string }>>
//   cancelPickupRequest(input: { requestId: string; reason?: string }): Promise<ActionResult>
//   confirmStopWeight(input: { stopId: string }): Promise<ActionResult>
//   disputeStopWeight(input: { stopId: string; reason: string; claimedKg?: string }): Promise<ActionResult<{ disputeId: string }>>
//   acknowledgeDispute(input: { disputeId: string; agree: boolean; comment?: string }): Promise<ActionResult<{ status: DisputeStatus }>>
//     ^ do'kon ham, yig'uvchi ham chaqiradi (o'z tomonini belgilaydi); src/server/actions/shop.ts dan eksport.

export interface RecordWeighingInput {
  stopId: string;
  clientKey: string;
  grossKg: string;
  tareKg: string; // bo'sh = 0
  photoAttachmentId?: string;
}
// src/server/actions/collector.ts
//   recordWeighing(input: RecordWeighingInput): Promise<ActionResult<{ netGrams: number; nextStopId: string | null }>>
//   skipStop(input: { stopId: string; reason: string }): Promise<ActionResult<{ nextStopId: string | null }>>

export interface CreateTripInput {
  clientKey: string;
  requestIds: string[]; // to'xtash tartibida
  collectorId: string;
  buyerId: string;
  date: string; // YYYY-MM-DD
  fromTime: string;
  toTime: string;
  shopPricePerKg: number;
  buyerPricePerKg: number;
  serviceFee: number;
  vehicle?: string;
  note?: string;
}

export interface RecordAcceptanceInput {
  tripId: string;
  clientKey: string;
  acceptedKg: string;
  quality: Quality;
  qualityNote?: string;
  discrepancyReason?: string; // tafovut ≠ 0 bo'lsa majburiy
  decision?: DiscrepancyDecision; // tafovut ≠ 0 bo'lsa majburiy
  decisionNote?: string; // decision=OTHER bo'lsa majburiy
  buyerPricePerKg: number;
  buyerReference: string; // xaridor tasdig'i: nakladnoy raqami / qabul qilgan shaxs
  acceptedDate: string; // YYYY-MM-DD
  acceptedTime: string; // HH:mm
  documentAttachmentIds?: string[];
}

export interface AddExpenseInput {
  tripId: string;
  clientKey: string;
  type: ExpenseType;
  amount: number;
  payer: Party;
  recipient?: string;
  note?: string;
}

export interface RecordPaymentInput {
  obligationId: string;
  clientKey: string;
  kind?: PaymentKind; // default PAYMENT; REFUND faqat ortiqcha to'langan bo'lsa
  amount: number;
  paidDate: string; // YYYY-MM-DD
  method?: string;
  reference?: string;
}

export type CorrectionInput =
  | { tripId: string; target: "WEIGHING"; weighingId: string; grossKg: string; tareKg: string; reason: string }
  | { tripId: string; target: "ACCEPTANCE"; acceptedKg: string; reason: string }
  | { tripId: string; target: "EXPENSE"; expenseId: string; amount: number; reason: string };

// src/server/actions/operator.ts
//   createTrip(input: CreateTripInput): Promise<ActionResult<{ tripId: string }>>
//   reorderTripStops(input: { tripId: string; requestIds: string[] /* yangi tartib; tushirib qoldirilgan = olib tashlanadi */ }): Promise<ActionResult>
//   cancelTrip(input: { tripId: string; reason: string }): Promise<ActionResult>
//   decideDispute(input: { disputeId: string; decisionText: string; decidedKg: string }): Promise<ActionResult>
//   recordAcceptance(input: RecordAcceptanceInput): Promise<ActionResult<{ discrepancyGrams: number }>>
//   addExpense(input: AddExpenseInput): Promise<ActionResult<{ expenseId: string }>>
//   recordPayment(input: RecordPaymentInput): Promise<ActionResult<{ paymentId: string; remaining: number }>>
//   closeTrip(input: { tripId: string }): Promise<ActionResult<{ status: TripStatus; failed: CloseCheck[] }>>
//     ^ shartlar bajarilmasa ok:false, code INVALID_TRANSITION. Faqat to'lov qolgan bo'lsa → status AWAITING_PAYMENT, ok:true.
//   correctRecord(input: CorrectionInput): Promise<ActionResult>
//   createShop(input: { name: string; contactName?: string; phone?: string; point: { name: string; address: string; district: string; landmark?: string; contactName?: string; contactPhone: string }; user?: { login: string; name: string; password: string } }): Promise<ActionResult<{ shopId: string }>>
//   addPoint(input: { shopId: string; name: string; address: string; district: string; landmark?: string; contactName?: string; contactPhone: string }): Promise<ActionResult<{ pointId: string }>>
//   addShopUser(input: { shopId: string; login: string; name: string; password: string }): Promise<ActionResult<{ userId: string }>>
//   createCollector(input: { name: string; phone: string; login: string; password: string }): Promise<ActionResult<{ userId: string }>>
//   createBuyer(input: { name: string; contactName?: string; phone?: string; address?: string; qualityTerms: string; minBatchKg: string }): Promise<ActionResult<{ buyerId: string }>>
//   updateBuyer(input: { buyerId: string; contactName?: string; phone?: string; address?: string; qualityTerms: string; minBatchKg: string; isActive: boolean }): Promise<ActionResult>
//   createTariff(input: { shopPricePerKg: number; buyerPricePerKg: number; serviceFee: number; note?: string }): Promise<ActionResult<{ tariffId: string }>>

// ---------------------------------------------------------------------------
// HTTP (route handlers, src/app/api/**) — operations-engineer
//   GET /api/health                  → { ok: true }
//   GET /api/files/:id               → rasm (Cache-Control: private, no-store); begona → 404
//   GET /api/requests/:id            → JSON (rolga ko'ra ruxsat); begona → 404
//   GET /api/trips/:id               → JSON; do'kon/boshqa yig'uvchi → 404
// ---------------------------------------------------------------------------
