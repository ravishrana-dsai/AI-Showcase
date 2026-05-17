import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { RequestStatusBadge, SlaBadge } from "@/components/pipeline/status-badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { GitBranch, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    status?: string;
    courtId?: string;
    slaBreached?: string;
    stageId?: string;
    sortBy?: string;
    sortDir?: string;
  };
}

export default async function RequestsPage({ searchParams }: PageProps) {
  const page = parseInt(searchParams.page ?? "1");
  const pageSize = 25;
  const search = searchParams.search ?? "";
  const status = searchParams.status;
  const courtId = searchParams.courtId;
  const slaBreached = searchParams.slaBreached;
  const stageId = searchParams.stageId;
  const sortBy = searchParams.sortBy ?? "createdAt";
  const sortDir = (searchParams.sortDir ?? "desc") as "asc" | "desc";

  const where = {
    ...(courtId && { courtId }),
    ...(status && { status: status as never }),
    ...(stageId && { currentStageId: stageId }),
    ...(slaBreached !== undefined && { slaBreached: slaBreached === "true" }),
    ...(search && {
      OR: [
        { externalId: { contains: search, mode: "insensitive" as const } },
        { playerName: { contains: search, mode: "insensitive" as const } },
        { court: { name: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [requests, total, stages, courts] = await Promise.all([
    prisma.request.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortDir },
      include: {
        court: { select: { id: true, name: true, city: true } },
        stageLogs: {
          where: { status: { in: ["IN_PROGRESS", "FAILED"] } },
          include: { stage: { select: { displayName: true, color: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        slaAlerts: { where: { acknowledged: false }, select: { id: true } },
      },
    }),
    prisma.request.count({ where }),
    prisma.pipelineStage.findMany({ where: { isActive: true }, orderBy: { stageOrder: "asc" } }),
    prisma.court.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <Topbar title="Requests" subtitle={`${total} total requests`} />
      <div className="p-6 space-y-4">
        {/* Filters */}
        <form className="flex flex-wrap items-center gap-3">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search by ID, player, court..."
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
          />
          <select name="status" defaultValue={status ?? ""} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select name="courtId" defaultValue={courtId ?? ""} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">All Courts</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.city}</option>
            ))}
          </select>
          <select name="stageId" defaultValue={stageId ?? ""} className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option value="">All Stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.displayName}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" name="slaBreached" value="true" defaultChecked={slaBreached === "true"} className="rounded border-gray-300 text-purple-600" />
            SLA Breached only
          </label>
          <button type="submit" className="h-9 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
            Filter
          </button>
        </form>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Request ID</th>
                  <th className="px-4 py-3 font-medium">Court</th>
                  <th className="px-4 py-3 font-medium">Player</th>
                  <th className="px-4 py-3 font-medium">Current Stage</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">SLA</th>
                  <th className="px-4 py-3 font-medium">Alerts</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/requests/${req.id}`} className="font-mono text-xs text-purple-600 hover:underline">
                        {req.externalId ?? req.id.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/courts/${req.court.id}`} className="hover:text-purple-600 transition-colors">
                        <span className="font-medium text-gray-800">{req.court.name}</span>
                        <span className="text-gray-400"> · {req.court.city}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.playerName ?? req.playerId ?? "—"}</td>
                    <td className="px-4 py-3">
                      {req.stageLogs[0] ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: req.stageLogs[0].stage.color ?? "#3b82f6" }}
                          />
                          {req.stageLogs[0].stage.displayName}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3"><RequestStatusBadge status={req.status} /></td>
                    <td className="px-4 py-3"><SlaBadge breached={req.slaBreached} /></td>
                    <td className="px-4 py-3">
                      {req.slaAlerts.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {req.slaAlerts.length}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(req.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {requests.length === 0 && (
            <div className="py-12 text-center">
              <GitBranch className="mx-auto h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No requests found</p>
              <p className="text-sm text-gray-400 mt-1">Connect your app backend or import data to get started</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?page=${page - 1}&search=${search}&status=${status ?? ""}&courtId=${courtId ?? ""}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors">Prev</Link>
              )}
              {page < totalPages && (
                <Link href={`?page=${page + 1}&search=${search}&status=${status ?? ""}&courtId=${courtId ?? ""}`}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
