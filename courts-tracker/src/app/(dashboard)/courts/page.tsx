import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { CourtStatusBadge } from "@/components/pipeline/status-badge";
import { MapPin, Plus, Users, GitBranch, AlertTriangle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { page?: string; search?: string; status?: string; city?: string };
}

export default async function CourtsPage({ searchParams }: PageProps) {
  const session = await auth();
  const page = parseInt(searchParams.page ?? "1");
  const pageSize = 20;
  const search = searchParams.search ?? "";
  const status = searchParams.status;
  const city = searchParams.city;

  const where = {
    ...(status && { status: status as never }),
    ...(city && { city: { contains: city, mode: "insensitive" as const } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { city: { contains: search, mode: "insensitive" as const } },
        { partnerName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [courts, total, cities] = await Promise.all([
    prisma.court.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { requests: true } },
      },
    }),
    prisma.court.count({ where }),
    prisma.court.groupBy({ by: ["city"], orderBy: { city: "asc" } }),
  ]);

  const courtIds = courts.map((c) => c.id);
  const slaBreachCounts = await prisma.request.groupBy({
    by: ["courtId"],
    where: { courtId: { in: courtIds }, slaBreached: true },
    _count: { courtId: true },
  });
  const slaMap = Object.fromEntries(slaBreachCounts.map((s) => [s.courtId, s._count.courtId]));

  const canEdit = session?.user?.role && ["ADMIN", "OPS"].includes(session.user.role);

  return (
    <div>
      <Topbar title="Courts" subtitle={`${total} court${total !== 1 ? "s" : ""} in the network`} />
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <form className="flex items-center gap-3 flex-1 flex-wrap">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search courts, cities, partners..."
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-64"
            />
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <select
              name="city"
              defaultValue={city ?? ""}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Cities</option>
              {cities.map((c) => (
                <option key={c.city} value={c.city}>{c.city}</option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
              Filter
            </button>
          </form>
          {canEdit && (
            <Link
              href="/courts/new"
              className="flex items-center gap-2 h-9 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Court
            </Link>
          )}
        </div>

        {/* Courts Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courts.map((court) => (
            <Link
              key={court.id}
              href={`/courts/${court.id}`}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{court.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {court.city}{court.state ? `, ${court.state}` : ""}
                  </p>
                </div>
                <CourtStatusBadge status={court.status} />
              </div>

              {court.partnerName && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
                  <Users className="h-3.5 w-3.5" />
                  {court.partnerName}
                </p>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <GitBranch className="h-4 w-4 text-gray-400" />
                  {court._count.requests} requests
                </span>
                {slaMap[court.id] > 0 && (
                  <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {slaMap[court.id]} SLA breached
                  </span>
                )}
                {court.surfaceType && (
                  <span className="text-xs text-gray-400 capitalize">{court.surfaceType}</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {courts.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <MapPin className="mx-auto h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No courts found</p>
            <p className="text-sm text-gray-400 mt-1">Add courts manually or import from your sheets</p>
            {canEdit && (
              <Link href="/courts/new" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
                <Plus className="h-4 w-4" /> Add First Court
              </Link>
            )}
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`?page=${page - 1}&search=${search}&status=${status ?? ""}&city=${city ?? ""}`} className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors">Prev</Link>
              )}
              {page * pageSize < total && (
                <Link href={`?page=${page + 1}&search=${search}&status=${status ?? ""}&city=${city ?? ""}`} className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 transition-colors">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
