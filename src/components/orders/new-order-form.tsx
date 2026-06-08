"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Loader2,
  UserCheck,
  UserPlus,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Split,
  PackageCheck,
  Phone,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatSar, formatNumber, VAT_RATE_NUMBER } from "@/lib/format";
import {
  lookupCustomerByPhone,
  createCustomer,
  searchVariants,
  createOrder,
  type CustomerProfile,
  type VariantSearchItem,
  type CreateOrderResult,
} from "@/lib/orders/actions";

/**
 * The hero order-entry form. Orchestrates all three acceptance criteria
 * client-side, delegating every data decision to the server actions:
 *
 *   AC#1 — phone lookup auto-populates the customer's CRM profile, or lets
 *          you create one inline.
 *   AC#2 — adding a variant resolves its price for THIS customer (whole-
 *          sale for B2B salons, base for retail) and shows/enforces MOQ.
 *   AC#3 — on save the server geo-routes to the nearest in-stock warehouse
 *          and splits into multiple shipments when needed; the result panel
 *          shows the chosen warehouse(s) and distance.
 *
 * All money math shown here is a live PREVIEW; the server recomputes it
 * authoritatively in the transaction, so the two always agree.
 */

interface Line {
  variant: VariantSearchItem;
  quantity: number;
}

/** Known server-action error keys → orders.form.errors.* message keys. */
const ERROR_KEYS = [
  "phoneInvalid",
  "phoneTooShort",
  "phoneTaken",
  "nameRequired",
  "emailInvalid",
  "cityRequired",
  "addressRequired",
  "noLines",
  "moqViolation",
  "outOfStock",
  "customerNotFound",
  "variantNotFound",
  "unknown",
] as const;

type ErrorKey = (typeof ERROR_KEYS)[number];

/** Map a server-action error string to a localised message, with fallback. */
function translateError(
  t: ReturnType<typeof useTranslations<"orders">>,
  error: string,
): string {
  const key: ErrorKey = (ERROR_KEYS as readonly string[]).includes(error)
    ? (error as ErrorKey)
    : "unknown";
  return t(`form.errors.${key}`);
}

const PAYMENT_METHODS = ["MADA", "TABBY", "TAMARA", "CREDIT_CARD", "B2B_CREDIT"] as const;

export function NewOrderForm({
  locale,
  tiers,
}: {
  locale: string;
  tiers: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("orders");
  const router = useRouter();

  // ── Customer state ──────────────────────────────────────────────────
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "notFound">("idle");
  const [showCreate, setShowCreate] = useState(false);

  // ── Line items ──────────────────────────────────────────────────────
  const [lines, setLines] = useState<Line[]>([]);

  // ── Payment + submission ────────────────────────────────────────────
  const isWholesale = customer?.type === "B2B_SALON";
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("MADA");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<CreateOrderResult, { ok: true }> | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // ── AC#1: phone lookup ──────────────────────────────────────────────
  const onLookup = async () => {
    setLookupState("loading");
    setShowCreate(false);
    const res = await lookupCustomerByPhone(phone);
    if (res.ok && res.found) {
      setCustomer(res.customer);
      setLookupState("idle");
      // Salons pay on B2B credit by default; retail uses mada.
      setPaymentMethod(res.customer.type === "B2B_SALON" ? "B2B_CREDIT" : "MADA");
      setLines([]); // prices depend on the customer; reset on change
    } else {
      setCustomer(null);
      setLookupState("notFound");
    }
  };

  const resetCustomer = () => {
    setCustomer(null);
    setLines([]);
    setLookupState("idle");
    setShowCreate(false);
    setResult(null);
    setSubmitError(null);
  };

  // ── Totals preview (mirrors lib/money on the server) ────────────────
  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, l) => sum + Number(l.variant.unitPrice) * l.quantity,
      0,
    );
    const vatAmount = subtotal * VAT_RATE_NUMBER;
    return { subtotal, vatAmount, total: subtotal + vatAmount };
  }, [lines]);

  const moqViolations = useMemo(
    () => lines.filter((l) => l.variant.mode === "WHOLESALE" && l.quantity < l.variant.moq),
    [lines],
  );

  const addLine = useCallback(
    (variant: VariantSearchItem) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.variant.variantId === variant.variantId);
        if (existing) {
          return prev.map((l) =>
            l.variant.variantId === variant.variantId
              ? { ...l, quantity: l.quantity + Math.max(1, variant.moq) }
              : l,
          );
        }
        // New lines start at the MOQ (so wholesale lines are valid by default).
        return [...prev, { variant, quantity: Math.max(1, variant.moq) }];
      });
    },
    [],
  );

  const setQty = (variantId: string, qty: number) =>
    setLines((prev) =>
      prev.map((l) => (l.variant.variantId === variantId ? { ...l, quantity: Math.max(1, qty) } : l)),
    );

  const removeLine = (variantId: string) =>
    setLines((prev) => prev.filter((l) => l.variant.variantId !== variantId));

  // ── Place order ─────────────────────────────────────────────────────
  const canSubmit = customer && lines.length > 0 && moqViolations.length === 0 && !isSubmitting;

  const onPlaceOrder = () => {
    if (!customer) return;
    setSubmitError(null);
    startSubmit(async () => {
      const res = await createOrder({
        customerId: customer.id,
        lines: lines.map((l) => ({ variantId: l.variant.variantId, quantity: l.quantity })),
        paymentMethod,
      });
      if (res.ok) {
        setResult(res);
      } else {
        setSubmitError(translateError(t, res.error));
      }
    });
  };

  // ── Success state ───────────────────────────────────────────────────
  if (result) {
    return (
      <SuccessPanel
        result={result}
        locale={locale}
        onView={() => router.push(`/orders/${result.orderId}`)}
        onAnother={resetCustomer}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* ── Left: customer + items ───────────────────────────────────── */}
      <div className="flex flex-col gap-6 lg:col-span-2">
        {/* Step 1 — customer */}
        <Section step="1" title={t("form.step1")}>
          {!customer ? (
            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="phone">{t("form.phoneLabel")}</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1" dir="ltr">
                    <Phone className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && phone.trim() && onLookup()}
                      placeholder={t("form.phonePlaceholder")}
                      className="ps-9"
                    />
                  </div>
                  <Button onClick={onLookup} disabled={!phone.trim() || lookupState === "loading"}>
                    {lookupState === "loading" ? <Loader2 className="animate-spin" /> : <Search />}
                    {lookupState === "loading" ? t("form.lookingUp") : t("form.lookup")}
                  </Button>
                </div>
              </div>

              {lookupState === "notFound" && !showCreate && (
                <div className="border-warning/40 bg-warning/10 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <p className="text-warning-foreground text-sm">{t("form.notFound")}</p>
                  <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                    <UserPlus />
                    {t("form.createCustomer")}
                  </Button>
                </div>
              )}

              {showCreate && (
                <InlineCustomerCreate
                  initialPhone={phone}
                  tiers={tiers}
                  onCreated={(c) => {
                    setCustomer(c);
                    setShowCreate(false);
                    setLookupState("idle");
                    setPaymentMethod(c.type === "B2B_SALON" ? "B2B_CREDIT" : "MADA");
                  }}
                  onCancel={() => setShowCreate(false)}
                />
              )}
            </div>
          ) : (
            <CustomerPanel customer={customer} locale={locale} onChange={resetCustomer} />
          )}
        </Section>

        {/* Step 2 — items */}
        <Section step="2" title={t("form.step2")} disabled={!customer}>
          {!customer ? (
            <p className="text-muted-foreground text-sm">{t("form.selectCustomerFirst")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <VariantPicker customerId={customer.id} locale={locale} onAdd={addLine} />

              {lines.length === 0 ? (
                <p className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                  {t("form.noItems")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {lines.map((line) => {
                    const violated =
                      line.variant.mode === "WHOLESALE" && line.quantity < line.variant.moq;
                    return (
                      <li
                        key={line.variant.variantId}
                        className="border-border flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-foreground truncate text-sm font-medium">
                            {line.variant.label}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span className="tabular-nums">
                              {formatSar(line.variant.unitPrice, locale)}
                            </span>
                            {line.variant.mode === "WHOLESALE" && (
                              <Badge tone="primary">{t("form.moqLabel", { moq: line.variant.moq })}</Badge>
                            )}
                          </div>
                          {violated && (
                            <p className="text-destructive mt-1 inline-flex items-center gap-1 text-xs">
                              <AlertTriangle className="size-3" />
                              {t("form.moqWarning", { moq: line.variant.moq })}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              setQty(line.variant.variantId, Number(e.target.value) || 1)
                            }
                            aria-label={t("form.qty")}
                            aria-invalid={violated}
                            className="border-input bg-surface text-foreground h-9 w-20 rounded-lg border px-2 text-end text-sm tabular-nums shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-destructive"
                          />
                          <span className="text-foreground w-24 text-end text-sm font-medium tabular-nums">
                            {formatSar(Number(line.variant.unitPrice) * line.quantity, locale)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(line.variant.variantId)}
                            aria-label={t("form.remove")}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </Section>
      </div>

      {/* ── Right: live summary + place ──────────────────────────────── */}
      <div className="lg:col-span-1">
        <div className="bg-card shadow-soft border-border sticky top-24 flex flex-col gap-4 rounded-2xl border p-5">
          <h2 className="text-foreground text-sm font-semibold">{t("form.step3")}</h2>

          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t("form.subtotal")}</dt>
              <dd className="text-foreground tabular-nums">{formatSar(totals.subtotal, locale)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t("form.vat")}</dt>
              <dd className="text-foreground tabular-nums">{formatSar(totals.vatAmount, locale)}</dd>
            </div>
            <div className="border-border mt-1 flex items-center justify-between border-t pt-3">
              <dt className="text-foreground text-base font-semibold">{t("form.total")}</dt>
              <dd className="text-foreground text-base font-semibold tabular-nums">
                {formatSar(totals.total, locale)}
              </dd>
            </div>
          </dl>

          <div>
            <Label htmlFor="payment">{t("form.paymentMethod")}</Label>
            <select
              id="payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as (typeof PAYMENT_METHODS)[number])}
              className="border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`paymentMethod.${m}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Guard messages */}
          {!customer && <Hint>{t("form.selectCustomerFirst")}</Hint>}
          {customer && lines.length === 0 && <Hint>{t("form.addItemsFirst")}</Hint>}
          {moqViolations.length > 0 && (
            <p className="text-destructive inline-flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" />
              {t("form.fixMoq")}
            </p>
          )}
          {submitError && (
            <p role="alert" className="text-destructive inline-flex items-center gap-1.5 text-xs">
              <AlertTriangle className="size-3.5" />
              {submitError}
            </p>
          )}

          <Button onClick={onPlaceOrder} disabled={!canSubmit} className="w-full">
            {isSubmitting ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            {isSubmitting ? t("form.placing") : t("form.placeOrder")}
          </Button>

          {isWholesale && (
            <p className="text-muted-foreground text-center text-xs">
              {t("form.wholesaleBanner", { tier: customer?.pricingTierName ?? "" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function Section({
  step,
  title,
  disabled,
  children,
}: {
  step: string;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-card shadow-soft border-border rounded-2xl border p-5 ${disabled ? "opacity-70" : ""}`}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
          {step}
        </span>
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-center text-xs">{children}</p>;
}

function CustomerPanel({
  customer,
  locale,
  onChange,
}: {
  customer: CustomerProfile;
  locale: string;
  onChange: () => void;
}) {
  const t = useTranslations("orders");
  const isWholesale = customer.type === "B2B_SALON";
  return (
    <div className="flex flex-col gap-3">
      <div className="border-success/40 bg-success/10 flex items-start justify-between gap-3 rounded-xl border px-4 py-3">
        <div className="flex items-start gap-3">
          <UserCheck className="text-success mt-0.5 size-5 shrink-0" />
          <div>
            <div className="text-foreground font-medium">{customer.name}</div>
            <div className="text-muted-foreground text-sm" dir="ltr">
              {customer.phone} · {customer.city}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onChange}>
          {t("form.cancelCreate")}
        </Button>
      </div>

      {/* AC#1: CRM details auto-populated */}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Field label={t("detail.loyalty")} value={formatNumber(customer.loyaltyPoints, locale)} />
        <Field label={t("form.customerType")} value={t(`type.${isWholesale ? "WHOLESALE" : "RETAIL"}`)} />
        {customer.pricingTierName && (
          <Field label={t("detail.pricingTier")} value={customer.pricingTierName} />
        )}
        {customer.email && <Field label={t("form.email")} value={customer.email} />}
      </div>

      {customer.crmNotes && (
        <p className="bg-surface-muted/50 border-border text-foreground rounded-xl border px-3 py-2 text-sm">
          {customer.crmNotes}
        </p>
      )}

      {/* AC#2 mode banner */}
      <div
        className={`rounded-xl px-4 py-2.5 text-sm ${
          isWholesale
            ? "bg-primary-soft text-sidebar-active-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isWholesale
          ? t("form.wholesaleBanner", { tier: customer.pricingTierName ?? "" })
          : t("form.retailBanner")}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground truncate font-medium">{value}</dd>
    </div>
  );
}

function VariantPicker({
  customerId,
  locale,
  onAdd,
}: {
  customerId: string;
  locale: string;
  onAdd: (v: VariantSearchItem) => void;
}) {
  const t = useTranslations("orders");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<VariantSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  const runSearch = (q: string) => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      if (q.trim().length < 2) {
        setItems([]);
        setOpen(false);
        return;
      }
      setSearching(true);
      setOpen(true);
      const res = await searchVariants(q, customerId);
      setItems(res.ok ? res.items : []);
      setSearching(false);
    }, 300);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
        {searching && (
          <Loader2 className="text-muted-foreground absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin" />
        )}
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder={t("form.itemSearchPlaceholder")}
          className="ps-9"
        />
      </div>

      {open && (
        <div className="bg-card shadow-elevated border-border absolute z-20 mt-2 max-h-80 w-full overflow-y-auto scrollbar-subtle rounded-xl border">
          {items.length === 0 && !searching ? (
            <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("form.noResults")}</p>
          ) : (
            <ul className="py-1">
              {items.map((item) => (
                <li key={item.variantId}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(item);
                      setOpen(false);
                      setQuery("");
                      setItems([]);
                    }}
                    className="hover:bg-muted flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {item.colorHex && (
                        <span
                          className="border-border size-3.5 shrink-0 rounded-full border"
                          style={{ backgroundColor: item.colorHex }}
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-foreground truncate text-sm font-medium">
                          {item.label}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatNumber(item.totalStock, locale)} {t("form.stock")}
                          {item.mode === "WHOLESALE" && ` · ${t("form.moqLabel", { moq: item.moq })}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-foreground text-sm font-medium tabular-nums">
                        {formatSar(item.unitPrice, locale)}
                      </span>
                      <span className="bg-primary-soft text-primary flex size-7 items-center justify-center rounded-lg">
                        <Plus className="size-4" />
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function InlineCustomerCreate({
  initialPhone,
  tiers,
  onCreated,
  onCancel,
}: {
  initialPhone: string;
  tiers: Array<{ id: string; name: string }>;
  onCreated: (c: CustomerProfile) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("orders");
  const [form, setForm] = useState({
    name: "",
    phone: initialPhone,
    email: "",
    type: "RETAIL" as "RETAIL" | "B2B_SALON",
    city: "",
    addressLine: "",
    latitude: "",
    longitude: "",
    pricingTierId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = () => {
    setError(null);
    startSave(async () => {
      const res = await createCustomer({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        type: form.type,
        city: form.city,
        addressLine: form.addressLine,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        pricingTierId: form.type === "B2B_SALON" && form.pricingTierId ? form.pricingTierId : null,
      });
      if (res.ok) onCreated(res.customer);
      else setError(translateError(t, res.error));
    });
  };

  const inputClass =
    "border-input bg-surface text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-soft focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <div className="border-border bg-surface-muted/40 flex flex-col gap-3 rounded-xl border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">{t("form.customerName")}</Label>
          <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-phone">{t("form.phoneLabel")}</Label>
          <Input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="c-type">{t("form.customerType")}</Label>
          <select
            id="c-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className={inputClass}
          >
            <option value="RETAIL">{t("type.RETAIL")}</option>
            <option value="B2B_SALON">{t("type.WHOLESALE")}</option>
          </select>
        </div>
        {form.type === "B2B_SALON" && (
          <div>
            <Label htmlFor="c-tier">{t("form.tier")}</Label>
            <select
              id="c-tier"
              value={form.pricingTierId}
              onChange={(e) => set("pricingTierId", e.target.value)}
              className={inputClass}
            >
              <option value="">{t("form.selectTier")}</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="c-city">{t("form.customerCity")}</Label>
          <Input id="c-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-email">{t("form.email")}</Label>
          <Input id="c-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="c-addr">{t("form.customerAddress")}</Label>
          <Input id="c-addr" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-lat">{t("form.latitude")}</Label>
          <Input
            id="c-lat"
            type="number"
            step="any"
            value={form.latitude}
            onChange={(e) => set("latitude", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="c-lng">{t("form.longitude")}</Label>
          <Input
            id="c-lng"
            type="number"
            step="any"
            value={form.longitude}
            onChange={(e) => set("longitude", e.target.value)}
          />
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={saving} size="sm">
          {saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
          {saving ? t("form.saving") : t("form.save")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("form.cancelCreate")}
        </Button>
      </div>
    </div>
  );
}

function SuccessPanel({
  result,
  locale,
  onView,
  onAnother,
}: {
  result: Extract<CreateOrderResult, { ok: true }>;
  locale: string;
  onView: () => void;
  onAnother: () => void;
}) {
  const t = useTranslations("orders");
  return (
    <div className="bg-card shadow-soft border-border mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-2xl border p-8 text-center">
      <span className="bg-success/12 text-success flex size-14 items-center justify-center rounded-2xl">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <h2 className="font-display text-foreground text-2xl font-semibold">{t("form.successTitle")}</h2>
        <p className="text-foreground mt-1 text-lg font-medium tabular-nums">{result.orderNumber}</p>
      </div>

      {/* AC#3 result: routing + split */}
      {result.split ? (
        <div className="w-full text-start">
          <p className="text-foreground mb-2 inline-flex items-center gap-1.5 text-sm font-medium">
            <Split className="text-primary size-4" />
            {t("form.successSplit", { count: result.shipments.length })}
          </p>
          <ul className="flex flex-col gap-2">
            {result.shipments.map((s, i) => (
              <li
                key={i}
                className="border-border flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm"
              >
                <span className="text-foreground inline-flex items-center gap-2">
                  <MapPin className="text-muted-foreground size-4" />
                  {s.warehouseName}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {formatNumber(s.distanceKm, locale)} km · {formatNumber(s.variantCount, locale)}×
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <MapPin className="size-4" />
          {t("form.successRouted", {
            warehouse: result.assignedWarehouse.name,
            distance: formatNumber(result.assignedWarehouse.distanceKm, locale),
          })}
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={onView}>{t("form.viewOrder")}</Button>
        <Button variant="outline" onClick={onAnother}>
          {t("form.placeAnother")}
        </Button>
      </div>
    </div>
  );
}
