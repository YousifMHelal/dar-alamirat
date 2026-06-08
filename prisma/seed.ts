/**
 * Dar Al-Amirat Operations Portal — database seed.
 *
 * Generates a realistic but FIXED dataset for the demo. Two properties
 * matter and are guaranteed here:
 *
 *   1. Idempotent — the script clears every table (in FK-safe order)
 *      before inserting, so it is always safe to re-run.
 *   2. Reproducible — faker is seeded with a fixed value and every
 *      "random" choice flows through it, so the dataset is byte-stable
 *      across runs. The demo depends on consistent data (same order
 *      numbers, same warehouse assignments, etc.).
 *
 * Money is always handled with Prisma.Decimal; VAT is KSA's 15%.
 *
 * Run with:  npx prisma db seed
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

// ── Determinism ──────────────────────────────────────────────
// Fixed seed → identical dataset on every run.
const FAKER_SEED = 20260601;
faker.seed(FAKER_SEED);
faker.setDefaultRefDate("2026-06-01T00:00:00.000Z");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── Constants ────────────────────────────────────────────────
const VAT_RATE = 0.15; // KSA VAT
const DEV_PASSWORD = "DarAlAmirat#2026"; // dev-only, logged at the end

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

/** Deterministic pick of one element (flows through the seeded faker). */
const pick = <T>(arr: readonly T[]): T => faker.helpers.arrayElement(arr);

/** Deterministic int in [min, max]. */
const int = (min: number, max: number) => faker.number.int({ min, max });

/** Weighted boolean: true with probability p. */
const chance = (p: number) => faker.number.float({ min: 0, max: 1 }) < p;

// ── KSA geography ────────────────────────────────────────────
// Real-ish city centers; customer coords jitter around these so geo
// routing in Phase 3 has spread to work with.
const KSA_CITIES = [
  { city: "Jeddah", lat: 21.4858, lng: 39.1925 },
  { city: "Riyadh", lat: 24.7136, lng: 46.6753 },
  { city: "Dammam", lat: 26.4207, lng: 50.0888 },
  { city: "Makkah", lat: 21.3891, lng: 39.8579 },
  { city: "Madinah", lat: 24.5247, lng: 39.5692 },
  { city: "Khobar", lat: 26.2794, lng: 50.2083 },
  { city: "Taif", lat: 21.2854, lng: 40.4244 },
  { city: "Tabuk", lat: 28.3838, lng: 36.555 },
  { city: "Abha", lat: 18.2164, lng: 42.5053 },
  { city: "Buraidah", lat: 26.359, lng: 43.9818 },
] as const;

const jitter = () => faker.number.float({ min: -0.08, max: 0.08, fractionDigits: 5 });

// The four warehouses are fixed (the prompt names them exactly).
const WAREHOUSES = [
  { name: "Jeddah Central", code: "JED-C", city: "Jeddah", latitude: 21.5433, longitude: 39.1728 },
  { name: "Riyadh Distribution", code: "RUH-D", city: "Riyadh", latitude: 24.7743, longitude: 46.7386 },
  { name: "Eastern Region", code: "DMM-E", city: "Dammam", latitude: 26.4207, longitude: 50.0888 },
  { name: "Jeddah Branch Showroom", code: "JED-S", city: "Jeddah", latitude: 21.5826, longitude: 39.1653 },
] as const;

// ── Beauty catalog reference data ────────────────────────────
const CATEGORIES = [
  { slug: "skincare", nameEn: "Skincare", nameAr: "العناية بالبشرة" },
  { slug: "makeup", nameEn: "Makeup", nameAr: "مكياج" },
  { slug: "haircare", nameEn: "Haircare", nameAr: "العناية بالشعر" },
  { slug: "fragrance", nameEn: "Fragrance", nameAr: "عطور" },
  { slug: "tools-accessories", nameEn: "Tools & Accessories", nameAr: "أدوات وإكسسوارات" },
  { slug: "bath-body", nameEn: "Bath & Body", nameAr: "الاستحمام والجسم" },
  { slug: "nails", nameEn: "Nails", nameAr: "العناية بالأظافر" },
] as const;

const BRANDS = [
  "Amira Beauté",
  "Layali",
  "Noor Cosmetics",
  "Desert Rose",
  "Zahra",
  "Maison Dar",
  "Lumière KSA",
  "Yasmine",
  "Atelier Oud",
  "Bahar",
] as const;

// Per-category product-name building blocks (EN/AR) and variant axes.
const PRODUCT_DEFS: Record<
  string,
  {
    typesEn: readonly string[];
    typesAr: readonly string[];
    variant: "shade" | "capacity" | "none";
  }
> = {
  skincare: {
    typesEn: ["Hydrating Serum", "Vitamin C Serum", "Day Cream", "Night Cream", "Cleansing Gel", "Toner", "Eye Cream", "Face Mask", "SPF 50 Sunscreen", "Retinol Oil"],
    typesAr: ["سيروم مرطب", "سيروم فيتامين سي", "كريم نهاري", "كريم ليلي", "جل منظف", "تونر", "كريم العين", "ماسك للوجه", "واقي شمس", "زيت ريتينول"],
    variant: "capacity",
  },
  makeup: {
    typesEn: ["Matte Lipstick", "Liquid Foundation", "Concealer", "Eyeshadow Palette", "Mascara", "Blush", "Highlighter", "Eyeliner", "Lip Gloss", "Setting Spray"],
    typesAr: ["أحمر شفاه مطفي", "كريم أساس سائل", "خافي العيوب", "باليت ظلال", "ماسكارا", "بلاشر", "هايلايتر", "آيلاينر", "ملمع شفاه", "مثبت مكياج"],
    variant: "shade",
  },
  haircare: {
    typesEn: ["Argan Shampoo", "Repair Conditioner", "Hair Mask", "Leave-in Treatment", "Hair Oil", "Heat Protectant", "Curl Cream", "Dry Shampoo"],
    typesAr: ["شامبو أرغان", "بلسم إصلاح", "ماسك للشعر", "علاج بدون شطف", "زيت شعر", "حماية حرارية", "كريم تجعيد", "شامبو جاف"],
    variant: "capacity",
  },
  fragrance: {
    typesEn: ["Eau de Parfum", "Oud Perfume Oil", "Body Mist", "Rose Attar", "Musk Cologne", "Amber Eau de Toilette"],
    typesAr: ["ماء عطر", "دهن عود", "معطر للجسم", "عطر الورد", "كولونيا المسك", "ماء تواليت العنبر"],
    variant: "capacity",
  },
  "tools-accessories": {
    typesEn: ["Makeup Brush Set", "Beauty Blender", "Tweezers", "Eyelash Curler", "Facial Roller", "Hair Dryer", "Flat Iron", "Mirror Compact"],
    typesAr: ["طقم فرش مكياج", "إسفنجة مكياج", "ملقط", "أداة تجعيد الرموش", "رولر للوجه", "مجفف شعر", "مكواة شعر", "مرآة مدمجة"],
    variant: "none",
  },
  "bath-body": {
    typesEn: ["Shower Gel", "Body Lotion", "Body Scrub", "Hand Cream", "Bath Salts", "Body Butter", "Loofah Set"],
    typesAr: ["جل استحمام", "لوشن للجسم", "مقشر للجسم", "كريم اليدين", "أملاح الاستحمام", "زبدة الجسم", "طقم ليفة"],
    variant: "capacity",
  },
  nails: {
    typesEn: ["Gel Nail Polish", "Base Coat", "Top Coat", "Cuticle Oil", "Nail Strengthener", "Acetone Remover"],
    typesAr: ["طلاء أظافر جل", "طبقة أساس", "طبقة علوية", "زيت الأظافر", "مقوي الأظافر", "مزيل أسيتون"],
    variant: "shade",
  },
};

const CAPACITIES = ["15ml", "30ml", "50ml", "100ml", "150ml", "200ml"] as const;
const SHADES = [
  { name: "Rosewood", hex: "#a8576b" },
  { name: "Nude Beige", hex: "#d8b094" },
  { name: "Crimson", hex: "#9b1b30" },
  { name: "Coral Sunset", hex: "#f47c5d" },
  { name: "Mocha", hex: "#6b4423" },
  { name: "Champagne", hex: "#e6cfa3" },
  { name: "Plum", hex: "#5e3a52" },
  { name: "Soft Pink", hex: "#e7a9b6" },
  { name: "Espresso", hex: "#3b2417" },
  { name: "Golden Sand", hex: "#cda349" },
] as const;

// ── Helpers ──────────────────────────────────────────────────

/** Pad a counter into the DA-2026-XXXX order-number format. */
const orderNumber = (n: number) => `DA-2026-${String(n).padStart(4, "0")}`;

/** A short, unique-ish sku/barcode fragment from the global counter. */
let skuCounter = 1000;
const nextSku = (prefix: string) => `${prefix}-${++skuCounter}`;
const nextBarcode = () => faker.string.numeric({ length: 13, allowLeadingZeros: false });

/**
 * Clear every table in FK-safe order. Using deleteMany keeps this a
 * plain Prisma operation (no raw SQL) and makes the seed idempotent.
 */
async function clearAll() {
  // Children first, parents last.
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.coupon.deleteMany();

  await prisma.stockTransfer.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();

  await prisma.creditTransaction.deleteMany();
  await prisma.creditAccount.deleteMany();
  await prisma.tierPrice.deleteMany();

  await prisma.seoMeta.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  await prisma.customer.deleteMany();
  await prisma.pricingTier.deleteMany();
  await prisma.warehouse.deleteMany();

  await prisma.redirect.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

// ─────────────────────────────────────────────────────────────
// Seed
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Seeding Dar Al-Amirat portal (fixed faker seed = " + FAKER_SEED + ")…");
  await clearAll();

  // ── Users ──────────────────────────────────────────────────
  const hashed = await bcrypt.hash(DEV_PASSWORD, 10);
  await prisma.user.createMany({
    data: [
      { email: "admin@daralamirat.sa", name: "Admin Al-Amirat", role: "ADMIN", hashedPassword: hashed },
      { email: "manager@daralamirat.sa", name: "Operations Manager", role: "MANAGER", hashedPassword: hashed },
      { email: "salon@daralamirat.sa", name: "Salon Partner", role: "B2B_SALON", hashedPassword: hashed },
    ],
  });

  // ── Warehouses ─────────────────────────────────────────────
  const warehouses = [];
  for (const w of WAREHOUSES) {
    warehouses.push(await prisma.warehouse.create({ data: w }));
  }

  // ── Categories ─────────────────────────────────────────────
  const categories = [];
  for (const c of CATEGORIES) {
    categories.push(await prisma.category.create({ data: c }));
  }
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  // ── Products + variants ────────────────────────────────────
  const TARGET_PRODUCTS = 250;
  type SeededVariant = {
    id: string;
    productId: string;
    basePrice: Prisma.Decimal;
    priceOverride: Prisma.Decimal | null;
  };
  const allVariants: SeededVariant[] = [];
  const allProductIds: string[] = [];

  for (let i = 0; i < TARGET_PRODUCTS; i++) {
    const cat = pick(categories);
    // Every seeded category slug is a key in PRODUCT_DEFS (both come from
    // the same CATEGORIES list), so this is always defined.
    const def = PRODUCT_DEFS[cat.slug]!;
    const typeIdx = int(0, def.typesEn.length - 1);
    const brand = pick(BRANDS);
    const basePrice = faker.number.float({ min: 35, max: 480, fractionDigits: 2 });

    const nameEn = `${brand} ${def.typesEn[typeIdx]}`;
    const nameAr = `${def.typesAr[typeIdx]} ${brand}`;

    const product = await prisma.product.create({
      data: {
        nameEn,
        nameAr,
        descriptionEn: faker.commerce.productDescription(),
        descriptionAr: "وصف المنتج باللغة العربية — جودة عالية للعناية والجمال.",
        sku: nextSku("DA"),
        brand,
        basePrice: D(basePrice),
        active: chance(0.93),
        categoryId: cat.id,
      },
    });
    allProductIds.push(product.id);

    // 1–4 variants per product, shaped by the category's variant axis.
    const variantCount = int(1, 4);
    for (let v = 0; v < variantCount; v++) {
      let colorName: string | null = null;
      let colorHex: string | null = null;
      let capacity: string | null = null;
      // Small per-variant price delta so overrides are realistic.
      const override = chance(0.4) ? D(basePrice + faker.number.float({ min: -15, max: 40, fractionDigits: 2 })) : null;

      if (def.variant === "shade") {
        const shade = SHADES[(typeIdx + v) % SHADES.length]!;
        colorName = shade.name;
        colorHex = shade.hex;
      } else if (def.variant === "capacity") {
        capacity = CAPACITIES[(typeIdx + v) % CAPACITIES.length]!;
      }

      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          colorName,
          colorHex,
          capacity,
          variantSku: nextSku("V"),
          priceOverride: override,
          barcode: nextBarcode(),
        },
      });
      allVariants.push({
        id: variant.id,
        productId: product.id,
        basePrice: D(basePrice),
        priceOverride: override,
      });
    }
  }

  // ── Inventory matrix (every variant × every warehouse) ─────
  // Some rows are low/zero to make the stock matrix interesting.
  const inventoryRows: Prisma.InventoryItemCreateManyInput[] = [];
  for (const variant of allVariants) {
    for (const w of warehouses) {
      const roll = faker.number.float({ min: 0, max: 1 });
      let qty: number;
      if (roll < 0.08) qty = 0; // out of stock
      else if (roll < 0.22) qty = int(1, 9); // low
      else qty = int(20, 400);
      inventoryRows.push({
        warehouseId: w.id,
        variantId: variant.id,
        quantityOnHand: qty,
        reorderLevel: int(5, 25),
      });
    }
  }
  await prisma.inventoryItem.createMany({ data: inventoryRows });

  // ── A few stock transfers between warehouses ───────────────
  for (let i = 0; i < 12; i++) {
    const from = pick(warehouses);
    let to = pick(warehouses);
    while (to.id === from.id) to = pick(warehouses);
    await prisma.stockTransfer.create({
      data: {
        fromWarehouseId: from.id,
        toWarehouseId: to.id,
        variantId: pick(allVariants).id,
        quantity: int(5, 60),
        status: pick(["PENDING", "IN_TRANSIT", "COMPLETED"] as const),
        date: faker.date.recent({ days: 60 }),
      },
    });
  }

  // ── A few inbound purchase orders (basic procurement log) ──
  const PO_SUPPLIERS = ["Gulf Beauty Imports", "Levant Cosmetics Co.", "Riyadh Wholesale Depot", "Jeddah Trading House"] as const;
  for (let i = 0; i < 8; i++) {
    const wh = pick(warehouses);
    const lineCount = int(2, 5);
    const items: Array<{ sku: string; name: string; quantity: number; unitCost: number }> = [];
    let total = 0;
    for (let l = 0; l < lineCount; l++) {
      const qty = int(20, 200);
      const unitCost = faker.number.float({ min: 12, max: 220, fractionDigits: 2 });
      items.push({ sku: nextSku("PO"), name: faker.commerce.productName(), quantity: qty, unitCost });
      total += qty * unitCost;
    }
    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-2026-${String(i + 1).padStart(4, "0")}`,
        supplier: pick(PO_SUPPLIERS),
        warehouseId: wh.id,
        status: pick(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const),
        items,
        total: D(total),
        expectedAt: chance(0.7) ? faker.date.soon({ days: 30 }) : null,
        notes: chance(0.4) ? faker.lorem.sentence() : null,
      },
    });
  }

  // ── Pricing tiers + tier prices ────────────────────────────
  const tierDefs = [
    { name: "Silver Salon", description: "Entry wholesale tier for small salons." },
    { name: "Gold Salon", description: "Mid wholesale tier with better margins." },
    { name: "Platinum Salon", description: "Top wholesale tier for high-volume partners." },
  ];
  const tiers = [];
  for (const t of tierDefs) tiers.push(await prisma.pricingTier.create({ data: t }));

  // Each tier prices a good chunk of products (a deterministic subset).
  // Discount deepens with tier rank.
  const tierDiscount = [0.18, 0.27, 0.36]; // silver/gold/platinum off base
  const tierPriceRows: Prisma.TierPriceCreateManyInput[] = [];
  for (let ti = 0; ti < tiers.length; ti++) {
    const tier = tiers[ti]!;
    const discount = tierDiscount[ti]!;
    // Price ~70% of products per tier.
    for (const productId of allProductIds) {
      if (!chance(0.7)) continue;
      // Use the product's first variant base price as the reference.
      const variant = allVariants.find((v) => v.productId === productId)!;
      const ref = Number(variant.basePrice);
      const wholesale = ref * (1 - discount);
      tierPriceRows.push({
        pricingTierId: tier.id,
        productId,
        wholesalePrice: D(wholesale),
        moq: pick([3, 6, 12, 24] as const),
      });
    }
  }
  await prisma.tierPrice.createMany({ data: tierPriceRows });

  // Quick lookup: tier → (productId → {wholesale, moq}).
  const tierPriceMap = new Map<string, Map<string, { wholesale: Prisma.Decimal; moq: number }>>();
  for (const tier of tiers) tierPriceMap.set(tier.id, new Map());
  for (const row of tierPriceRows) {
    if (row.productId) {
      tierPriceMap.get(row.pricingTierId)!.set(row.productId, {
        wholesale: row.wholesalePrice as Prisma.Decimal,
        moq: row.moq,
      });
    }
  }

  // ── Customers (retail + B2B salons) ────────────────────────
  const TARGET_CUSTOMERS = 40;
  const TARGET_SALONS = 10;
  type SeededCustomer = {
    id: string;
    type: "RETAIL" | "B2B_SALON";
    pricingTierId: string | null;
  };
  const customers: SeededCustomer[] = [];
  let phoneCounter = 500000000;

  for (let i = 0; i < TARGET_CUSTOMERS; i++) {
    const isSalon = i < TARGET_SALONS;
    const loc = pick(KSA_CITIES);
    const tier = isSalon ? pick(tiers) : null;
    const name = isSalon
      ? `${pick(["Glow", "Elegance", "Royal", "Jasmine", "Pearl", "Velvet", "Orchid", "Amber", "Luxe", "Sahar"] as const)} Salon`
      : faker.person.fullName();

    const customer = await prisma.customer.create({
      data: {
        name,
        // Deterministic unique KSA-style phone.
        phone: `+9665${phoneCounter++}`,
        email: faker.internet.email().toLowerCase(),
        type: isSalon ? "B2B_SALON" : "RETAIL",
        city: loc.city,
        addressLine: `${faker.location.streetAddress()}, ${loc.city}`,
        latitude: loc.lat + jitter(),
        longitude: loc.lng + jitter(),
        crmNotes: chance(0.5) ? faker.lorem.sentence() : null,
        loyaltyPoints: int(0, 2500),
        pricingTierId: tier?.id ?? null,
      },
    });
    customers.push({ id: customer.id, type: customer.type as SeededCustomer["type"], pricingTierId: customer.pricingTierId });

    // ── Credit accounts for salons ──────────────────────────
    if (isSalon) {
      const creditLimit = pick([20000, 35000, 50000, 75000, 100000] as const);
      const balance = faker.number.float({ min: 0, max: creditLimit * 0.7, fractionDigits: 2 });
      const account = await prisma.creditAccount.create({
        data: {
          customerId: customer.id,
          creditLimit: D(creditLimit),
          balance: D(balance),
        },
      });
      // A few transactions per account (charges and payments).
      const txCount = int(3, 6);
      for (let t = 0; t < txCount; t++) {
        const isCharge = chance(0.6);
        await prisma.creditTransaction.create({
          data: {
            creditAccountId: account.id,
            type: isCharge ? "CHARGE" : "PAYMENT",
            amount: D(faker.number.float({ min: 500, max: 8000, fractionDigits: 2 })),
            note: isCharge ? "Wholesale order on credit" : "Partial settlement",
            date: faker.date.recent({ days: 120 }),
          },
        });
      }
    }
  }

  // ── Coupons (discount codes & campaigns) ───────────────────
  const NOW = new Date("2026-06-01T00:00:00.000Z");
  const couponSeeds = [
    {
      code: "WELCOME10",
      description: "10% off a customer's first order",
      type: "PERCENTAGE" as const,
      value: D(10),
      minOrder: D(100),
      usageLimit: 500,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: null,
      status: "ACTIVE" as const,
    },
    {
      code: "RAMADAN25",
      description: "Ramadan campaign — 25% off skincare & fragrance",
      type: "PERCENTAGE" as const,
      value: D(25),
      minOrder: D(150),
      usageLimit: 300,
      startsAt: new Date("2026-02-15T00:00:00.000Z"),
      endsAt: new Date("2026-03-20T00:00:00.000Z"),
      status: "EXPIRED" as const,
    },
    {
      code: "SAVE50",
      description: "Flat SAR 50 off orders above SAR 400",
      type: "FIXED_AMOUNT" as const,
      value: D(50),
      minOrder: D(400),
      usageLimit: 200,
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: null,
      status: "ACTIVE" as const,
    },
    {
      code: "B2BWHOLESALE5",
      description: "Loyalty incentive for repeat B2B salon orders",
      type: "PERCENTAGE" as const,
      value: D(5),
      minOrder: D(2000),
      usageLimit: null,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: null,
      status: "ACTIVE" as const,
    },
    {
      code: "FLASH20",
      description: "48-hour flash sale — 20% off storewide",
      type: "PERCENTAGE" as const,
      value: D(20),
      minOrder: null,
      usageLimit: 1000,
      startsAt: new Date("2026-05-20T00:00:00.000Z"),
      endsAt: new Date("2026-05-22T00:00:00.000Z"),
      status: "EXPIRED" as const,
    },
    {
      code: "EID2026",
      description: "Eid promotion — SAR 30 off any order",
      type: "FIXED_AMOUNT" as const,
      value: D(30),
      minOrder: D(120),
      usageLimit: 400,
      startsAt: new Date("2026-06-10T00:00:00.000Z"),
      endsAt: new Date("2026-06-25T00:00:00.000Z"),
      status: "SCHEDULED" as const,
    },
    {
      code: "VIP15",
      description: "Invite-only loyalty perk for top-tier customers",
      type: "PERCENTAGE" as const,
      value: D(15),
      minOrder: D(300),
      usageLimit: 150,
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      endsAt: null,
      status: "DISABLED" as const,
    },
  ];

  const coupons: { id: string; status: (typeof couponSeeds)[number]["status"] }[] = [];
  for (const c of couponSeeds) {
    const coupon = await prisma.coupon.create({
      data: {
        code: c.code,
        description: c.description,
        type: c.type,
        value: c.value,
        minOrder: c.minOrder,
        usageLimit: c.usageLimit,
        usageCount: 0, // bumped below as orders redeem the active codes
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        status: c.status,
      },
    });
    coupons.push({ id: coupon.id, status: c.status });
  }
  // Only ACTIVE/EXPIRED codes could realistically have been redeemed by past orders.
  const redeemableCoupons = coupons.filter((c) => c.status === "ACTIVE" || c.status === "EXPIRED");
  const couponRedemptions = new Map<string, number>();

  // ── Orders, items, shipments, payments ─────────────────────
  const TARGET_ORDERS = 200;
  const orderStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
  const carriers = ["ARAMEX", "SMSA", "SPL"] as const;
  const retailMethods = ["MADA", "TABBY", "TAMARA", "CREDIT_CARD"] as const;

  for (let i = 0; i < TARGET_ORDERS; i++) {
    const customer = pick(customers);
    const isWholesale = customer.type === "B2B_SALON";
    const status = pick(orderStatuses);
    const placedAt = faker.date.between({ from: "2026-01-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" });

    // Build line items from random variants.
    const lineCount = int(1, 6);
    const chosen = faker.helpers.arrayElements(allVariants, lineCount);
    const tierPrices = isWholesale && customer.pricingTierId ? tierPriceMap.get(customer.pricingTierId) : undefined;

    let subtotal = new Prisma.Decimal(0);
    const itemData: Prisma.OrderItemCreateManyOrderInput[] = [];
    for (const variant of chosen) {
      // Unit price: wholesale (if salon + tier has it) else base/override.
      let unit: Prisma.Decimal;
      let minQty = 1;
      const tierEntry = tierPrices?.get(variant.productId);
      if (isWholesale && tierEntry) {
        unit = tierEntry.wholesale;
        minQty = tierEntry.moq;
      } else {
        unit = variant.priceOverride ?? variant.basePrice;
      }
      const qty = isWholesale ? int(minQty, minQty + 30) : int(1, 4);
      const lineTotal = unit.mul(qty);
      subtotal = subtotal.add(lineTotal);
      itemData.push({ variantId: variant.id, quantity: qty, unitPrice: unit, lineTotal });
    }

    const vatAmount = subtotal.mul(VAT_RATE);
    const total = subtotal.add(vatAmount);

    // Warehouse assignment: most orders are routed; some left null to
    // exercise the "needs routing" state.
    const assigned = chance(0.85) ? pick(warehouses) : null;

    // ~18% of orders redeem one of the currently-redeemable coupon codes.
    const redeemedCoupon = chance(0.18) ? pick(redeemableCoupons) : null;
    if (redeemedCoupon) couponRedemptions.set(redeemedCoupon.id, (couponRedemptions.get(redeemedCoupon.id) ?? 0) + 1);

    const order = await prisma.order.create({
      data: {
        orderNumber: orderNumber(i + 1),
        customerId: customer.id,
        type: isWholesale ? "WHOLESALE" : "RETAIL",
        status,
        subtotal: D(Number(subtotal)),
        vatAmount: D(Number(vatAmount)),
        total: D(Number(total)),
        assignedWarehouseId: assigned?.id ?? null,
        couponId: redeemedCoupon?.id ?? null,
        placedAt,
        items: { createMany: { data: itemData } },
      },
    });

    // ── Shipments ────────────────────────────────────────────
    // Only orders past confirmation ship. ~20% split across two
    // warehouses to demo order splitting.
    const shipped = ["PROCESSING", "SHIPPED", "DELIVERED"].includes(status);
    if (shipped) {
      const split = chance(0.2) && warehouses.length >= 2;
      const shipStatus = status === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT";
      const w1 = assigned ?? pick(warehouses);
      await prisma.shipment.create({
        data: {
          orderId: order.id,
          warehouseId: w1.id,
          carrier: pick(carriers),
          waybillNumber: faker.string.alphanumeric({ length: 10 }).toUpperCase(),
          status: shipStatus,
          trackingUpdates: [
            { ts: placedAt.toISOString(), status: "picked_up", location: w1.city },
          ],
        },
      });
      if (split) {
        let w2 = pick(warehouses);
        while (w2.id === w1.id) w2 = pick(warehouses);
        await prisma.shipment.create({
          data: {
            orderId: order.id,
            warehouseId: w2.id,
            carrier: pick(carriers),
            waybillNumber: faker.string.alphanumeric({ length: 10 }).toUpperCase(),
            status: shipStatus,
            trackingUpdates: [
              { ts: placedAt.toISOString(), status: "picked_up", location: w2.city },
            ],
          },
        });
      }
    }

    // ── Payments ─────────────────────────────────────────────
    if (status !== "CANCELLED") {
      const method = isWholesale ? "B2B_CREDIT" : pick(retailMethods);
      // Payment status correlates with order progress.
      let payStatus: "PENDING" | "PAID" | "RECONCILED" | "FAILED";
      if (status === "DELIVERED") payStatus = chance(0.7) ? "RECONCILED" : "PAID";
      else if (status === "SHIPPED" || status === "PROCESSING") payStatus = chance(0.8) ? "PAID" : "PENDING";
      else payStatus = "PENDING";

      const settled = payStatus === "PAID" || payStatus === "RECONCILED";
      // Gateway fee ~1.8% for card-style methods, none for B2B credit.
      const gatewayFee = method === "B2B_CREDIT" ? null : D(Number(total) * 0.018);

      await prisma.payment.create({
        data: {
          orderId: order.id,
          method,
          amount: D(Number(total)),
          status: payStatus,
          gatewayFee,
          settledAt: settled ? faker.date.soon({ days: 5, refDate: placedAt }) : null,
        },
      });
    }
  }

  // Reflect actual redemptions back onto each coupon's usageCount.
  for (const [couponId, count] of couponRedemptions) {
    await prisma.coupon.update({ where: { id: couponId }, data: { usageCount: count } });
  }

  // ── Reviews (customer feedback on products, pending moderation queue) ──
  const TARGET_REVIEWS = 120;
  const reviewTitles = {
    5: ["Absolutely love it!", "Holy grail product", "Will repurchase for sure", "Exceeded expectations", "My new favourite"],
    4: ["Really good", "Happy with this", "Solid pick", "Works well for me", "Good value"],
    3: ["It's okay", "Does the job", "Average, nothing special", "Decent but pricey", "Mixed feelings"],
    2: ["Not what I expected", "Didn't work for my skin", "Disappointed", "Wouldn't buy again"],
    1: ["Waste of money", "Arrived damaged", "Terrible experience", "Not as described"],
  } satisfies Record<number, readonly string[]>;
  const reviewBodies = {
    5: [
      "Been using this for a month now and the results speak for themselves. Fast shipping too.",
      "Exactly as described, smells amazing, and a little goes a long way. Highly recommend to anyone in KSA.",
      "This has become a staple in my routine. Packaging is premium and it feels authentic.",
    ],
    4: [
      "Good quality for the price. Took a couple of weeks to see results but I'm satisfied overall.",
      "Nice texture and scent. Only wish the bottle was a bit bigger for the price.",
      "Works as expected, delivery was on time and the product matches the photos.",
    ],
    3: [
      "It's fine — does what it says but I didn't notice anything special compared to similar products.",
      "Average experience. The product is okay but the price feels a bit high for what you get.",
      "Neither great nor bad. Might try a different variant next time.",
    ],
    2: [
      "Caused a bit of irritation after a few uses, had to stop. Might just not suit my skin type.",
      "The scent was too strong for my liking and it felt heavier than expected.",
      "Took much longer to arrive than I hoped, and the seal was already broken.",
    ],
    1: [
      "The box arrived crushed and the product had leaked everywhere. Very disappointed with the packaging.",
      "Doesn't match the description at all — texture and scent are completely different from what's shown.",
      "Used it for two weeks with zero results. Returning it.",
    ],
  } satisfies Record<number, readonly string[]>;
  const reviewStatusByRating = (rating: number): "PENDING" | "APPROVED" | "REJECTED" => {
    if (rating >= 4) return chance(0.75) ? "APPROVED" : "PENDING";
    if (rating === 3) return pick(["PENDING", "APPROVED", "REJECTED"] as const);
    return chance(0.55) ? "REJECTED" : "PENDING";
  };

  const reviewerIds = customers.map((c) => c.id);
  for (let i = 0; i < TARGET_REVIEWS; i++) {
    const rating = pick([5, 5, 4, 4, 4, 3, 3, 2, 1] as const); // weighted toward positive, like real storefronts
    const productId = pick(allProductIds);
    const customerId = pick(reviewerIds);
    await prisma.review.create({
      data: {
        productId,
        customerId,
        rating,
        title: chance(0.8) ? pick(reviewTitles[rating]) : null,
        body: pick(reviewBodies[rating]),
        status: reviewStatusByRating(rating),
        createdAt: faker.date.between({ from: "2026-02-01T00:00:00.000Z", to: NOW }),
      },
    });
  }

  // ── Redirects (old Salla-style → new paths) ────────────────
  const redirects = [
    { fromPath: "/p/serum-vitamin-c", toPath: "/products/skincare/vitamin-c-serum", type: "PERMANENT_301" as const },
    { fromPath: "/category/makeup-old", toPath: "/category/makeup", type: "PERMANENT_301" as const },
    { fromPath: "/ar/منتجات/عطور", toPath: "/category/fragrance", type: "PERMANENT_301" as const },
    { fromPath: "/promo/summer", toPath: "/offers", type: "TEMPORARY_302" as const },
    { fromPath: "/p/hair-oil-argan", toPath: "/products/haircare/argan-hair-oil", type: "PERMANENT_301" as const },
    { fromPath: "/salla/checkout", toPath: "/cart", type: "TEMPORARY_302" as const },
  ];
  await prisma.redirect.createMany({ data: redirects });

  // ── SeoMeta for a sample of products ───────────────────────
  const seoSample = faker.helpers.arrayElements(allProductIds, 30);
  for (const productId of seoSample) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) continue;
    await prisma.seoMeta.create({
      data: {
        productId,
        metaTitle: `${product.nameEn} | Dar Al-Amirat`,
        metaDescription: `Shop ${product.nameEn} by ${product.brand}. Authentic beauty products with fast KSA delivery.`,
        keywords: [product.brand, product.nameEn, "beauty", "KSA", "skincare"].join(", "),
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.nameEn,
          brand: product.brand,
        },
      },
    });
  }

  // ── Settings (placeholder integration config) ──────────────
  // IMPORTANT: no real secrets. Real keys are wired in a later phase.
  const settingKeys = ["meta_whatsapp", "zatca", "tabby", "tamara", "aramex", "smsa", "spl", "mada"];
  await prisma.setting.createMany({
    data: settingKeys.map((key) => ({
      key,
      valueJson: { enabled: false, apiKey: "", secret: "", note: "placeholder — real credentials provided in a later phase" },
    })),
  });

  // ── Mobile-app sync status (read by the Overview "system sync" panel) ──
  // Real, structured rows describing the iOS/Android storefront apps'
  // last successful catalog/inventory/orders sync. Values are static here
  // (no live mobile backend yet) but the panel reads them as real data.
  await prisma.setting.createMany({
    data: [
      {
        key: "mobile_sync_ios",
        valueJson: {
          platform: "iOS",
          appVersion: "3.4.1",
          status: "healthy", // healthy | degraded | offline
          lastSyncAt: faker.date.recent({ days: 1 }).toISOString(),
          pendingPushes: 0,
          syncedEntities: { products: 250, inventory: 4000, orders: 200 },
        },
      },
      {
        key: "mobile_sync_android",
        valueJson: {
          platform: "Android",
          appVersion: "3.4.0",
          status: "degraded",
          lastSyncAt: faker.date.recent({ days: 2 }).toISOString(),
          pendingPushes: 12,
          syncedEntities: { products: 250, inventory: 3988, orders: 197 },
        },
      },
    ],
  });

  // ── Summary ────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    salons: await prisma.customer.count({ where: { type: "B2B_SALON" } }),
    categories: await prisma.category.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    warehouses: await prisma.warehouse.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    stockTransfers: await prisma.stockTransfer.count(),
    pricingTiers: await prisma.pricingTier.count(),
    tierPrices: await prisma.tierPrice.count(),
    creditAccounts: await prisma.creditAccount.count(),
    creditTransactions: await prisma.creditTransaction.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
    shipments: await prisma.shipment.count(),
    splitOrders: (await prisma.order.findMany({ select: { _count: { select: { shipments: true } } } })).filter(
      (o) => o._count.shipments > 1,
    ).length,
    payments: await prisma.payment.count(),
    coupons: await prisma.coupon.count(),
    reviews: await prisma.review.count(),
    redirects: await prisma.redirect.count(),
    seoMeta: await prisma.seoMeta.count(),
    settings: await prisma.setting.count(),
  };

  console.log("\n✅ Seed complete. Row counts:");
  console.table(counts);
  console.log("\n🔑 Dev login (all three users share this password):");
  console.log("   admin@daralamirat.sa   (ADMIN)");
  console.log("   manager@daralamirat.sa (MANAGER)");
  console.log("   salon@daralamirat.sa   (B2B_SALON)");
  console.log(`   password: ${DEV_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
