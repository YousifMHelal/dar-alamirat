# Dar Al-Amirat Operations Portal — Demo Script

**Portal URL:** `https://<your-vercel-deployment>.vercel.app`  
**Duration:** ~15 minutes  
**Accounts required:** Admin (`admin@daramirat.sa`) · Ops (`ops@daramirat.sa`)

---

## 0. Prerequisites

1. `DATABASE_URL` points to the hosted Neon database.
2. `npx prisma migrate deploy` and `npx prisma db seed` have been run against prod.
3. `/api/health` returns `{ "status": "ok" }`.

---

## 1. Acceptance Criteria Walkthroughs

### 1A — Phone → CRM (Customer Capture)

**Scenario:** A walk-in customer gives their phone number; a sales op creates the CRM record.

1. Sign in as **ops@daramirat.sa** (password: `ops123`).
2. Navigate to **Orders → New Order**.
3. In the *Customer* step, enter phone `+966 50 000 1234` in the search box.
4. Confirm no match is found → click **Create new customer**.
5. Fill in `Name: Layla Al-Hassan`, `Email: layla@example.com`, save.
6. Observe the new customer appears in the customer autocomplete.
7. Complete the order with at least one product line, then submit.
8. ✅ **Pass:** Order is created and the customer record persists.

---

### 1B — B2B → Wholesale + MOQ

**Scenario:** A B2B account is flagged for wholesale pricing; system enforces minimum order quantity.

1. Navigate to **Catalog** → open any product (e.g., *Oud Royale Serum*).
2. Click the **Pricing tiers** tab.
3. Add a tier: *Min qty = 12, Price = 89.00 SAR* → Save.
4. ✅ Toast: "Prices saved".
5. Go back to **Orders → New Order**.
6. Select the same product and set quantity to `5`.
7. Observe the order total uses the standard price (tier not triggered).
8. Change quantity to `12`.
9. Observe the order total now reflects the tier price.
10. ✅ **Pass:** MOQ tier pricing kicks in at the configured threshold.

---

### 1C — Address → Routing

**Scenario:** An order's delivery address drives zone assignment for dispatch routing.

1. Still in **New Order**, complete the *Address* step.
2. Enter a Riyadh address: *Al Olaya, Riyadh 12241*.
3. In *Delivery zone*, observe the system auto-suggests **RUH-CENTRAL**.
4. Save the order.
5. Navigate to **Orders → [the new order]**.
6. Confirm the *Zone* field shows `RUH-CENTRAL` and the estimated delivery window.
7. ✅ **Pass:** Address correctly resolves to a routing zone.

---

## 2. ZATCA Phase 2 — E-Invoice QR

1. Navigate to **Financials → ZATCA**.
2. Select any completed order from the dropdown.
3. Click **Generate invoice XML + QR**.
4. ✅ Toast: "Invoice generated".
5. The generated QR renders on screen; scan it with any QR reader.
6. The decoded TLV payload will contain:
   - Seller name: *Dar Al-Amirat*
   - VAT registration: `300000000000003`
   - Invoice total (including 15% VAT)
7. Click **Download XML** and confirm a valid UBL 2.1 document is saved.

---

## 3. Reconciliation

1. Navigate to **Financials → Reconciliation**.
2. Use the date-range picker to select the last 30 days.
3. Click **Run reconciliation**.
4. ✅ Toast: "Reconciliation complete".
5. The table shows order lines with columns: Order, Gateway, Gross, Fee, Net, Status.
6. Lines with `RECONCILED` show a green tick; `PENDING` lines are amber.
7. Confirm amounts display in **SAR** with correct locale formatting:
   - Arabic locale: `١٢٣٫٤٥ ر.س.`
   - English locale: `SAR 123.45`

---

## 4. Bulk Product Import

1. Navigate to **Catalog → Import**.
2. Download the CSV template via the **Download template** button.
3. Open the CSV and fill in at least 3 rows (name_ar, name_en, sku, price_sar, stock).
4. Upload the completed CSV.
5. ✅ Toast: "X products imported" (skipped rows are listed below).
6. Navigate back to **Catalog** and confirm the new products appear.

---

## 5. RTL / LTR Toggle

1. Click the **EN → AR** language toggle in the top-right corner.
2. The entire portal flips: sidebar moves to the right, text is right-aligned, numbers use Arabic-Indic digits.
3. Navigate between pages and confirm layout stays correct in both directions.
4. Click **AR → EN** to return to English.
5. ✅ **Pass:** All pages render correctly in both locales with no layout breakage.

---

## 6. Responsive Spot-Check

| Breakpoint | What to verify |
|---|---|
| 375 px (mobile) | Topbar hamburger opens the drawer; no horizontal scroll; tables scroll inside their container |
| 768 px (tablet) | 2-column grids collapse to 1 column; sidebar drawer still used |
| 1024 px (desktop) | Sidebar appears statically; topbar hamburger hidden |
| 1440 px (wide) | Content caps at `max-w-6xl`; no orphaned whitespace |

---

## 7. Final Health Check

```
GET /api/health
→ 200 { "status": "ok", "db": "connected" }
```

---

## Credentials Summary

| Role | Email | Password |
|---|---|---|
| Admin | admin@daramirat.sa | admin123 |
| Ops | ops@daramirat.sa | ops123 |
| Viewer | viewer@daramirat.sa | viewer123 |

> Passwords are seeded only for demo; rotate before any production handoff.
