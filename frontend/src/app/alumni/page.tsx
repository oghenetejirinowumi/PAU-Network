"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, MapPin, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Button, EmptyState, inputClass, PageHeader, Spinner, TierBadge, VerifiedBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatSlot, fullName } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Department, DirectoryUser, PageMeta } from "@/lib/types";

const INDUSTRIES = ["Fintech", "Technology", "Banking", "Investment", "Professional services", "Telecoms", "Media", "FMCG", "Energy", "Oil and gas", "Manufacturing", "Law"];

function AlumniCard({ alumnus }: { alumnus: DirectoryUser }) {
  return (
    <Link href={`/profile/${alumnus.id}`} className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-lg">
      {alumnus.bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={alumnus.bannerUrl} alt="" loading="lazy" decoding="async" className="h-16 w-full object-cover" />
      ) : (
        <div className="banner-default h-16" />
      )}
      <div className="-mt-8 flex flex-1 flex-col px-4 pb-4">
        <Avatar user={alumnus} size={64} className="border-4 border-surface" />
        <div className="mt-2 flex items-center gap-1">
          <p className="font-bold group-hover:underline">{fullName(alumnus)}</p>
          {alumnus.isVerified && <VerifiedBadge />}
        </div>
        <p className="text-sm">
          {alumnus.jobTitle} <span className="text-muted">at</span> {alumnus.company}
        </p>
        <p className="mt-1 text-xs text-muted">
          {alumnus.department.name} · Class of {alumnus.graduationYear}
        </p>
        {alumnus.location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3" /> {alumnus.location}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1">
          {alumnus.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-muted">
              {skill}
            </span>
          ))}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <TierBadge tier={alumnus.tier} />
          {alumnus.nextOpenSlot ? (
            <span className="flex items-center gap-1 font-medium text-success">
              <CalendarClock className="size-3.5" /> {formatSlot(alumnus.nextOpenSlot.startsAt).replace(" WAT", "")}
            </span>
          ) : (
            <span className="text-muted">No open slots</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function AlumniDirectoryPage() {
  const { user } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState({ search: "", departmentId: "", industry: "", graduationYearFrom: "", hasOpenSlots: false, sort: "RELEVANCE" });
  const [results, setResults] = useState<{ data: DirectoryUser[]; meta: PageMeta } | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<Department[]>("/departments").then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);

  // Students start with "my course" selected, the core of the challenge brief.
  useEffect(() => {
    if (user?.role === "STUDENT") setFilters((current) => ({ ...current, departmentId: user.department.id }));
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      api
        .get<DirectoryUser[], PageMeta>("/users", {
          role: "ALUMNI",
          search: filters.search || undefined,
          departmentId: filters.departmentId || undefined,
          industry: filters.industry || undefined,
          graduationYearFrom: filters.graduationYearFrom || undefined,
          hasOpenSlots: filters.hasOpenSlots ? "true" : undefined,
          sort: filters.sort,
          page,
          pageSize: 12,
        })
        .then(setResults)
        .catch(() => setResults({ data: [], meta: { page: 1, pageSize: 12, total: 0, totalPages: 0 } }));
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, page]);

  const update = (next: Partial<typeof filters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...next }));
  };
  const myDepartmentSelected = user && filters.departmentId === user.department.id;

  return (
    <AppShell wide>
      <PageHeader eyebrow="Alumni directory" title="Find alumni from your course" description="Filter by department, graduation year and industry, then book an open slot or send a message request." />

      <div className="mb-6 space-y-3 rounded-card border border-line bg-surface p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input className={`${inputClass} pl-9`} placeholder="Search by name, company, job title or skill…" value={filters.search} onChange={(event) => update({ search: event.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-5">
          <select className={inputClass} value={filters.departmentId} onChange={(event) => update({ departmentId: event.target.value })}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name} ({department.alumniCount})
              </option>
            ))}
          </select>
          <select className={inputClass} value={filters.industry} onChange={(event) => update({ industry: event.target.value })}>
            <option value="">All industries</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry}>{industry}</option>
            ))}
          </select>
          <select className={inputClass} value={filters.graduationYearFrom} onChange={(event) => update({ graduationYearFrom: event.target.value })}>
            <option value="">Any class year</option>
            <option value="2020">Class of 2020+</option>
            <option value="2015">Class of 2015+</option>
            <option value="2010">Class of 2010+</option>
          </select>
          <select className={inputClass} value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
            <option value="RELEVANCE">Sort: Recommended</option>
            <option value="POINTS">Sort: Most active</option>
            <option value="GRADUATION_YEAR">Sort: Most recent class</option>
            <option value="NAME">Sort: Name</option>
          </select>
          <label className="flex min-h-10 items-center gap-2 rounded-control border border-line px-3 text-sm coarse:min-h-11">
            <input type="checkbox" checked={filters.hasOpenSlots} onChange={(event) => update({ hasOpenSlots: event.target.checked })} className="accent-[var(--primary)]" />
            Open slots only
          </label>
        </div>
        {user?.role === "STUDENT" && (
          <button
            onClick={() => update({ departmentId: myDepartmentSelected ? "" : user.department.id })}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${myDepartmentSelected ? "border-primary bg-primary-soft text-primary" : "border-line text-muted"}`}
          >
            🎓 From my course: {user.department.name}
          </button>
        )}
      </div>

      {!results ? (
        <Spinner />
      ) : results.data.length === 0 ? (
        <EmptyState icon="🔍" title="No alumni match these filters yet" description="Try clearing a filter or searching a company name." action={<Button variant="secondary" onClick={() => update({ search: "", departmentId: "", industry: "", graduationYearFrom: "", hasOpenSlots: false })}>Clear filters</Button>} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {results.meta.total} alumni{myDepartmentSelected ? ` from ${user?.department.name}` : ""}
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15.5rem),1fr))] gap-4">
            {results.data.map((alumnus) => (
              <AlumniCard key={alumnus.id} alumnus={alumnus} />
            ))}
          </div>
          {results.meta.totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {page} of {results.meta.totalPages}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= results.meta.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
