export const dynamic = 'force-dynamic';

import Image from "next/image";
import Link from "next/link";
import {
  Zap,
  Trophy,
  Target,
  Users,
  Sparkles,
  TrendingUp,
  Heart,
  ChevronDown,
  Quote,
  Cpu,
} from "lucide-react";
import { prisma } from "@talent-hub/db";
import { JobsDepartmentList } from "@/components/careers/jobs-department-list";
import { publicCareersJobWhere } from "@/lib/public-careers-job-filter";

export const metadata = {
  title: "Careers at [Company]",
  description:
    "Join the team building the future of sports gaming. Explore open roles at [Company].",
};

const VALUES = [
  {
    icon: Zap,
    title: "Move fast",
    body: "We ship constantly, learn from real users, and iterate without fear. Slow is smooth, but fast wins.",
  },
  {
    icon: Trophy,
    title: "Play to win",
    body: "We compete hard, celebrate wins together, and hold ourselves to the highest standard of craft.",
  },
  {
    icon: Target,
    title: "Own the outcome",
    body: "Every person here is an owner. If something is broken, you fix it. If an opportunity exists, you seize it.",
  },
  {
    icon: Users,
    title: "Build for millions",
    body: "Our products reach fans across the globe. We take that scale seriously and design for real people.",
  },
] as const;

const BENEFITS = [
  {
    icon: Heart,
    title: "Health and wellness",
    body: "Full medical, dental, and vision. Plus a wellness stipend so you can stay sharp.",
  },
  {
    icon: TrendingUp,
    title: "Accelerated growth",
    body: "Learning budget, mentorship from operators, and a fast track to senior leadership.",
  },
  {
    icon: Cpu,
    title: "Best-in-class stack",
    body: "We pick the right tool for the job. TypeScript, Rust, Postgres, and whatever ships fastest.",
  },
  {
    icon: Users,
    title: "A+ teammates",
    body: "Work alongside engineers, designers, and operators who have built products used by tens of millions.",
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      "I have shipped more meaningful product here in six months than I did in three years at my previous company. The pace is real.",
    name: "Arjun Mehta",
    role: "Senior Engineer",
    dept: "Platform",
  },
  {
    quote:
      "[Company] gave me ownership from day one. There is no waiting for permission. You see a problem, you fix it.",
    name: "Priya Sharma",
    role: "Product Manager",
    dept: "Growth",
  },
  {
    quote:
      "The culture here is genuinely collaborative. Everyone wants each other to succeed. That is rare.",
    name: "Rohit Nair",
    role: "Design Lead",
    dept: "Design Systems",
  },
] as const;

export default async function PublicJobsPage() {
  const jobs = await prisma.job.findMany({
    where: publicCareersJobWhere,
    select: {
      id: true,
      title: true,
      employmentType: true,
      location: { select: { name: true } },
      department: { select: { name: true } },
      organization: { select: { name: true, slug: true } },
      publishedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const normalizedJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    department: job.department?.name ?? "General",
    location: job.location?.name ?? null,
    employmentType: job.employmentType ?? null,
    orgSlug: job.organization?.slug ?? null,
    orgName: job.organization?.name ?? null,
  }));

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ---- NAV ---- */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/jobs" className="flex items-center gap-2.5">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
              alt="[Company]"
              width={120}
              height={32}
              className="h-8 w-auto object-contain brightness-200"
              priority
            />
          </Link>
          <Link
            href="#openings"
            className="rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            View roles
          </Link>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-black pt-16 text-center">
        {/* Gradient orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 left-1/4 h-[700px] w-[700px] rounded-full bg-violet-700/20 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-purple-700/20 blur-3xl" />
          <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-violet-900/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-300">
            <Sparkles className="h-4 w-4" />
            Careers
          </div>

          {/* Headline */}
          <h1 className="text-7xl font-black leading-none tracking-tight text-white lg:text-8xl">
            Game On.
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-violet-300 bg-clip-text text-transparent">
              Play Big.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/60">
            We are building the most immersive sports gaming platform on the
            planet. Fast teams, real ownership, and products that reach millions
            of fans every day.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="#openings"
              className="rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-violet-700"
            >
              Join the Dream Team
            </Link>
            <Link
              href="#values"
              className="rounded-full border border-white/20 px-8 py-3.5 text-base font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Our culture
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 border-t border-white/10 pt-8 text-sm">
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-white">
                {normalizedJobs.length}+
              </span>
              <span className="text-white/40">Open roles</span>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-white">10M+</span>
              <span className="text-white/40">Users</span>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-white">4+</span>
              <span className="text-white/40">Sports</span>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-white/30" />
        </div>
      </section>

      {/* ---- VALUES ---- */}
      <section id="values" className="bg-neutral-950 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-violet-400">
              How we work
            </p>
            <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
              Built on four beliefs.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-violet-500/30"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20">
                  <Icon className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- BENEFITS ---- */}
      <section className="bg-black py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-violet-400">
              Why [Company]
            </p>
            <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
              Built for builders.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-violet-500/40"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/20">
                  <Icon className="h-5 w-5 text-violet-400" />
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- TESTIMONIALS ---- */}
      <section className="bg-neutral-950 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-violet-400">
              From the team
            </p>
            <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
              Hear from our players.
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map(({ quote, name, role, dept }) => (
              <div
                key={name}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8"
              >
                <Quote className="mb-4 h-6 w-6 text-violet-400" />
                <p className="flex-1 text-sm leading-relaxed text-white/70">
                  {quote}
                </p>
                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="font-bold text-white">{name}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {role} &middot; {dept}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- OPEN POSITIONS ---- */}
      <section id="openings" className="bg-black py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-violet-400">
              Open positions
            </p>
            <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
              Your way into [Company].
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/50">
              Find a role where you can do the best work of your career. Every
              team is hiring builders who care.
            </p>
          </div>

          {normalizedJobs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-500/20">
                <Sparkles className="h-10 w-10 text-violet-400" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">
                No open positions right now
              </h3>
              <p className="mx-auto max-w-md text-white/50">
                We do not have any open roles at the moment, but we are always
                growing. Follow us or check back soon.
              </p>
            </div>
          ) : (
            <JobsDepartmentList jobs={normalizedJobs} />
          )}
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="border-t border-white/10 bg-neutral-950 py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <Image
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/[Company] logo purple.png`}
              alt="[Company]"
              width={96}
              height={24}
              className="h-6 w-auto object-contain brightness-200 opacity-70"
            />
            <p className="text-center text-xs text-white/30 sm:text-right">
              &copy; {new Date().getFullYear()} [Company]. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
