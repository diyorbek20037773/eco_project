-- Ma'lumot yaxlitligi: server tekshiruvidan tashqari DB darajasida ham.
-- Vazn — gramm, pul — butun so'm.

ALTER TABLE "Weighing"
  ADD CONSTRAINT "Weighing_gross_positive" CHECK ("grossGrams" > 0),
  ADD CONSTRAINT "Weighing_tare_nonnegative" CHECK ("tareGrams" >= 0),
  ADD CONSTRAINT "Weighing_tare_le_gross" CHECK ("tareGrams" <= "grossGrams"),
  ADD CONSTRAINT "Weighing_net_equals" CHECK ("netGrams" = "grossGrams" - "tareGrams"),
  ADD CONSTRAINT "Weighing_net_positive" CHECK ("netGrams" > 0);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "Obligation"
  ADD CONSTRAINT "Obligation_amount_nonnegative" CHECK ("amount" >= 0);

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_amount_nonnegative" CHECK ("amount" >= 0);

ALTER TABLE "BuyerAcceptance"
  ADD CONSTRAINT "BuyerAcceptance_accepted_positive" CHECK ("acceptedGrams" > 0),
  ADD CONSTRAINT "BuyerAcceptance_delivered_nonnegative" CHECK ("deliveredGrams" >= 0),
  ADD CONSTRAINT "BuyerAcceptance_discrepancy_equals" CHECK ("discrepancyGrams" = "acceptedGrams" - "deliveredGrams"),
  ADD CONSTRAINT "BuyerAcceptance_price_nonnegative" CHECK ("buyerPricePerKg" >= 0);

ALTER TABLE "Trip"
  ADD CONSTRAINT "Trip_prices_nonnegative" CHECK ("shopPricePerKg" >= 0 AND "buyerPricePerKg" >= 0 AND "serviceFee" >= 0),
  ADD CONSTRAINT "Trip_window_order" CHECK ("windowEnd" > "windowStart");

ALTER TABLE "Tariff"
  ADD CONSTRAINT "Tariff_prices_nonnegative" CHECK ("shopPricePerKg" >= 0 AND "buyerPricePerKg" >= 0 AND "serviceFee" >= 0);

ALTER TABLE "PickupRequest"
  ADD CONSTRAINT "PickupRequest_window_order" CHECK ("readyTo" > "readyFrom"),
  ADD CONSTRAINT "PickupRequest_estimate_positive" CHECK ("estimatedGrams" IS NULL OR "estimatedGrams" > 0);

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_claimed_positive" CHECK ("claimedNetGrams" IS NULL OR "claimedNetGrams" > 0),
  ADD CONSTRAINT "Dispute_decided_positive" CHECK ("decidedNetGrams" IS NULL OR "decidedNetGrams" > 0);

ALTER TABLE "Buyer"
  ADD CONSTRAINT "Buyer_min_batch_nonnegative" CHECK ("minBatchGrams" >= 0);

ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_size_positive" CHECK ("sizeBytes" > 0);
