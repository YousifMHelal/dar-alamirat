import { z } from "zod";

/**
 * Zod schemas for SEO mutations — authoritative server-side, mirrored by the
 * client. Covers per-product SeoMeta and the redirect manager.
 */

export const seoMetaSchema = z.object({
  productId: z.string().cuid(),
  metaTitle: z.string().trim().min(1, "metaTitleRequired").max(120),
  metaDescription: z.string().trim().min(1, "metaDescriptionRequired").max(320),
  keywords: z.string().trim().max(300).optional().or(z.literal("")),
});

export type SeoMetaInput = z.infer<typeof seoMetaSchema>;

/** A path must start with "/" (relative storefront path). */
const pathSchema = z
  .string()
  .trim()
  .min(1, "pathRequired")
  .max(400)
  .startsWith("/", "pathMustStartSlash");

export const redirectSchema = z.object({
  id: z.string().cuid().optional(),
  fromPath: pathSchema,
  toPath: pathSchema,
  type: z.enum(["PERMANENT_301", "TEMPORARY_302"]),
  active: z.boolean(),
});

export type RedirectInput = z.infer<typeof redirectSchema>;

/**
 * Bulk redirect import. Each line is "fromPath,toPath[,301|302]" — parsed
 * leniently on the client, but each resulting row is validated with
 * redirectSchema before insert.
 */
export const importRedirectsSchema = z.object({
  redirects: z
    .array(
      z.object({
        fromPath: pathSchema,
        toPath: pathSchema,
        type: z.enum(["PERMANENT_301", "TEMPORARY_302"]),
      }),
    )
    .min(1, "noRows")
    .max(500),
});

export type ImportRedirectsInput = z.infer<typeof importRedirectsSchema>;
