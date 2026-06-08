import { prisma } from "@/lib/prisma";

export const IMPORT_EXPORT_PAGE_SIZE = 15;

export type JobType = "IMPORT" | "EXPORT";
export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface JobsFilter {
  type?: JobType;
  page: number;
}

export async function listImportExportJobs(filter: JobsFilter) {
  const where = filter.type ? { type: filter.type } : {};
  const page = Math.max(1, filter.page);

  const [rows, total] = await Promise.all([
    prisma.importExportJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * IMPORT_EXPORT_PAGE_SIZE,
      take: IMPORT_EXPORT_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        status: true,
        fileName: true,
        rowCount: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    }),
    prisma.importExportJob.count({ where }),
  ]);

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / IMPORT_EXPORT_PAGE_SIZE)),
  };
}

export type JobListRow = Awaited<ReturnType<typeof listImportExportJobs>>["rows"][number];

export interface JobStats {
  totalImports: number;
  totalExports: number;
  failedJobs: number;
  lastJobAt: Date | null;
}

export async function getImportExportStats(): Promise<JobStats> {
  const [totalImports, totalExports, failedJobs, lastJob] = await Promise.all([
    prisma.importExportJob.count({ where: { type: "IMPORT" } }),
    prisma.importExportJob.count({ where: { type: "EXPORT" } }),
    prisma.importExportJob.count({ where: { status: "FAILED" } }),
    prisma.importExportJob.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  return { totalImports, totalExports, failedJobs, lastJobAt: lastJob?.createdAt ?? null };
}
