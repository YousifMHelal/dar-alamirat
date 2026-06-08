"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { importCatalog as runImport, type ImportResult } from "@/lib/catalog/import/actions";

/**
 * Wraps the existing catalog importer to also record an ImportExportJob —
 * giving the import-export module a real history without changing the
 * underlying parse/upsert logic in lib/catalog/import.
 */
export async function importCatalogWithJob(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  const file = formData.get("file");
  const fileName = file instanceof File ? file.name : "upload.xlsx";

  const job = await prisma.importExportJob.create({
    data: { type: "IMPORT", status: "PROCESSING", fileName, createdById: user.id },
    select: { id: true },
  });

  const result = await runImport(formData);

  if (result.ok) {
    await prisma.importExportJob.update({
      where: { id: job.id },
      data: {
        status: result.summary.errors.length > 0 ? "FAILED" : "COMPLETED",
        rowCount: result.summary.totalRows,
        errorLog: result.summary.errors.length > 0 ? JSON.parse(JSON.stringify(result.summary.errors)) : undefined,
      },
    });
  } else {
    await prisma.importExportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorLog: { error: result.error } },
    });
  }

  revalidatePath("/catalog/import-export");
  return result;
}

export interface ExportFilters {
  categorySlug?: string;
  active?: boolean;
}

export type ExportJobResult = { ok: true; jobId: string } | { ok: false; error: string };

/** Records an EXPORT job before the client streams the actual file from the API route. */
export async function recordExportJob(filters: ExportFilters): Promise<ExportJobResult> {
  const user = await requireUser();

  const where: { categoryId?: string; active?: boolean } = {};
  if (filters.active != null) where.active = filters.active;
  if (filters.categorySlug) {
    const category = await prisma.category.findUnique({ where: { slug: filters.categorySlug }, select: { id: true } });
    if (category) where.categoryId = category.id;
  }

  const rowCount = await prisma.productVariant.count({ where: { product: where } });

  const job = await prisma.importExportJob.create({
    data: {
      type: "EXPORT",
      status: "COMPLETED",
      fileName: `dar-alamirat-catalog-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
      rowCount,
      createdById: user.id,
    },
    select: { id: true },
  });

  revalidatePath("/catalog/import-export");
  return { ok: true, jobId: job.id };
}
