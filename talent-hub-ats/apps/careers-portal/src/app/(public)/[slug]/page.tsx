export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Sparkles, Quote, Linkedin, Twitter, Github, Instagram } from "lucide-react";
import { JobsDepartmentList } from "@/components/careers/jobs-department-list";
import { fetchOrgCareerBundle, hiringPortalLogoSrc } from "@/lib/hiring-portal";
import type { Metadata } from "next";

interface ContentCard { title: string; body: string }
interface Testimonial { quote: string; name: string; role: string; dept: string }
interface StatItem { value: string; label: string }
interface PageProps { params: Promise<{ slug: string }> }

/** Mirrors DB career_page_configs (loaded via hiring portal JSON). */
interface CareerCfg {
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  heroHeadline?: string | null;
  heroSubheadline?: string | null;
  heroDescription?: string | null;
  showValues?: boolean | null;
  showBenefits?: boolean | null;
  showTestimonials?: boolean | null;
  showStats?: boolean | null;
  values?: unknown;
  benefits?: unknown;
  testimonials?: unknown;
  stats?: unknown;
  footerText?: string | null;
  logoUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  githubUrl?: string | null;
  instagramUrl?: string | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchOrgCareerBundle(slug);
  if (!data) return {};
  const org = data.organization;
  const cfg = org.careerPageConfig as CareerCfg | null;
  return {
    title: cfg?.metaTitle ?? `Careers at ${org.name}`,
    description: cfg?.metaDescription ?? `Join the team at ${org.name}. Explore open roles.`,
    openGraph: {
      title: cfg?.metaTitle ?? `Careers at ${org.name}`,
      description: cfg?.metaDescription ?? undefined,
    },
  };
}

export default async function CareerPage({ params }: PageProps) {
  const { slug } = await params;

  const bundle = await fetchOrgCareerBundle(slug);
  if (!bundle) return notFound();

  const org = bundle.organization;
  const cfg = org.careerPageConfig as CareerCfg | null;

  const jobs = bundle.jobs;
  const normalizedJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    department: job.department?.name ?? "General",
    location: job.location?.name ?? null,
    employmentType: job.employmentType ?? null,
  }));

  // Config values with defaults
  const primaryColor = cfg?.primaryColor ?? "#7c3aed";
  const accentColor = cfg?.accentColor ?? "#6d28d9";
  const bgColor = cfg?.backgroundColor ?? "#000000";
  const heroHeadline = cfg?.heroHeadline ?? "Join Our Team.";
  const heroSubheadline = cfg?.heroSubheadline ?? "Build What Matters.";
  const heroDescription = cfg?.heroDescription ?? `We are looking for talented people to join ${org.name}.`;

  const showValues = cfg?.showValues ?? true;
  const showBenefits = cfg?.showBenefits ?? true;
  const showTestimonials = cfg?.showTestimonials ?? true;
  const showStats = cfg?.showStats ?? true;

  const values = ((cfg?.values ?? []) as unknown) as ContentCard[];
  const benefits = ((cfg?.benefits ?? []) as unknown) as ContentCard[];
  const testimonials = ((cfg?.testimonials ?? []) as unknown) as Testimonial[];
  const stats = ((cfg?.stats ?? []) as unknown) as StatItem[];

  const footerText = cfg?.footerText ?? `© ${new Date().getFullYear()} ${org.name}. All rights reserved.`;

  const logoSrc = hiringPortalLogoSrc(cfg?.logoUrl ?? null, org.logo);

  const hasSocial = cfg?.linkedinUrl || cfg?.twitterUrl || cfg?.githubUrl || cfg?.instagramUrl;

  // CSS variables for theming
  const cssVars = {
    "--cp-primary": primaryColor,
    "--cp-accent": accentColor,
    "--cp-bg": bgColor,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen text-white" style={{ ...cssVars, backgroundColor: bgColor }}>
      {/* customCss injection removed: CSS via dangerouslySetInnerHTML allows data exfiltration.
          Theming is handled via CSS variables above (--cp-primary, --cp-accent, --cp-bg). */}

      {/* ---- NAV ---- */}
      <nav
        className="fixed top-0 z-50 w-full border-b backdrop-blur-md"
        style={{ backgroundColor: bgColor + "cc", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${slug}`} className="flex items-center gap-2.5">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={org.name} className="h-8 w-auto object-contain brightness-200" />
            ) : (
              <span className="text-lg font-black text-white">{org.name}</span>
            )}
          </Link>
          <Link
            href="#openings"
            className="rounded-full px-5 py-2 text-sm font-semibold text-white transition hover:opacity-80"
            style={{ backgroundColor: primaryColor }}
          >
            View roles
          </Link>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16 text-center"
        style={{ backgroundColor: bgColor }}
      >
        {/* Gradient orbs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/4 h-[700px] w-[700px] rounded-full blur-3xl opacity-20" style={{ backgroundColor: primaryColor }} />
          <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full blur-3xl opacity-15" style={{ backgroundColor: accentColor }} />
          <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full blur-3xl opacity-15" style={{ backgroundColor: primaryColor }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: primaryColor + "50", backgroundColor: primaryColor + "1a", color: primaryColor }}
          >
            <Sparkles className="h-4 w-4" />
            Careers at {org.name}
          </div>

          <h1 className="text-6xl font-black leading-none tracking-tight text-white lg:text-8xl">
            {heroHeadline}
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(to right, ${primaryColor}, ${accentColor}, ${primaryColor})` }}
            >
              {heroSubheadline}
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/60">
            {heroDescription}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="#openings"
              className="rounded-full px-8 py-3.5 text-base font-semibold text-white transition hover:opacity-80"
              style={{ backgroundColor: primaryColor }}
            >
              See open roles
            </Link>
            {(showValues || showBenefits) && (
              <Link
                href={
                  showBenefits && benefits.length > 0
                    ? "#why-join-us"
                    : "#culture"
                }
                className="rounded-full border border-white/20 px-8 py-3.5 text-base font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
              >
                {showBenefits && benefits.length > 0 ? "Our Benefits" : "Our culture"}
              </Link>
            )}
          </div>

          {/* Stats row */}
          {showStats && stats.length > 0 && (
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 border-t border-white/10 pt-8 text-sm">
              <div className="flex flex-col items-center gap-1">
                <span className="text-2xl font-black text-white">{normalizedJobs.length}+</span>
                <span className="text-white/40">Open roles</span>
              </div>
              {stats.map((stat, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="h-8 w-px bg-white/10 hidden sm:block absolute" />
                  <span className="text-2xl font-black text-white">{stat.value}</span>
                  <span className="text-white/40">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
          {showStats && stats.length === 0 && (
            <div className="mt-16 border-t border-white/10 pt-8">
              <span className="text-2xl font-black text-white">{normalizedJobs.length}+</span>
              <span className="ml-2 text-white/40">Open roles</span>
            </div>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-white/30" />
        </div>
      </section>

      {/* ---- VALUES ---- */}
      {showValues && values.length > 0 && (
        <section id="culture" className="py-24" style={{ backgroundColor: bgColor === "#000000" ? "#0a0a0a" : bgColor }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: primaryColor }}>
                How we work
              </p>
              <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
                Our values.
              </h2>
            </div>
            <div className={`grid gap-4 sm:grid-cols-2 ${values.length > 2 ? "lg:grid-cols-" + Math.min(values.length, 4) : ""}`}>
              {values.map((v, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
                  style={{ "--hover-border": primaryColor + "50" } as React.CSSProperties}
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold"
                    style={{ backgroundColor: primaryColor + "33", color: primaryColor }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="mb-2 text-base font-bold text-white">{v.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{v.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- BENEFITS ---- */}
      {showBenefits && benefits.length > 0 && (
        <section id="why-join-us" className="py-24" style={{ backgroundColor: bgColor }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: primaryColor }}>
                Why join us
              </p>
              <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
                Built for builders.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((b, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
                >
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold"
                    style={{ backgroundColor: primaryColor + "33", color: primaryColor }}
                  >
                    {i + 1}
                  </div>
                  <h3 className="mb-2 text-base font-bold text-white">{b.title}</h3>
                  <p className="text-sm leading-relaxed text-white/50">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- TESTIMONIALS ---- */}
      {showTestimonials && testimonials.length > 0 && (
        <section className="py-24" style={{ backgroundColor: bgColor === "#000000" ? "#0a0a0a" : bgColor }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: primaryColor }}>
                From the team
              </p>
              <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
                Hear from our people.
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <div key={i} className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-8">
                  <Quote className="mb-4 h-6 w-6" style={{ color: primaryColor }} />
                  <p className="flex-1 text-sm leading-relaxed text-white/70">{t.quote}</p>
                  <div className="mt-6 border-t border-white/10 pt-6">
                    <p className="font-bold text-white">{t.name}</p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {t.role} {t.dept ? `· ${t.dept}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- OPEN POSITIONS ---- */}
      <section id="openings" className="py-24" style={{ backgroundColor: bgColor }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: primaryColor }}>
              Open positions
            </p>
            <h2 className="text-5xl font-black leading-tight text-white sm:text-6xl">
              Your next role at {org.name}.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/50">
              Find a role where you can do the best work of your career.
            </p>
          </div>

          {normalizedJobs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center">
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl"
                style={{ backgroundColor: primaryColor + "33" }}
              >
                <Sparkles className="h-10 w-10" style={{ color: primaryColor }} />
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">No open positions right now</h3>
              <p className="mx-auto max-w-md text-white/50">
                We do not have any open roles at the moment, but we are always growing. Check back soon.
              </p>
            </div>
          ) : (
            <JobsDepartmentList jobs={normalizedJobs} orgSlug={slug} />
          )}
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer
        className="border-t border-white/10 py-10"
        style={{ backgroundColor: bgColor === "#000000" ? "#0a0a0a" : bgColor }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={org.name} className="h-6 w-auto object-contain brightness-200 opacity-70" />
            ) : (
              <span className="text-sm font-bold text-white/70">{org.name}</span>
            )}

            <div className="flex items-center gap-4">
              {cfg?.linkedinUrl && (
                <a href={cfg.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/80 transition">
                  <Linkedin className="h-4 w-4" />
                </a>
              )}
              {cfg?.twitterUrl && (
                <a href={cfg.twitterUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/80 transition">
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {cfg?.githubUrl && (
                <a href={cfg.githubUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/80 transition">
                  <Github className="h-4 w-4" />
                </a>
              )}
              {cfg?.instagramUrl && (
                <a href={cfg.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white/80 transition">
                  <Instagram className="h-4 w-4" />
                </a>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 sm:items-end">
              <p className="text-xs text-white/30">{footerText}</p>
              {(cfg?.privacyPolicyUrl || cfg?.termsUrl) && (
                <div className="flex gap-3 text-xs text-white/30">
                  {cfg?.privacyPolicyUrl && (
                    <a href={cfg.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white/60">Privacy</a>
                  )}
                  {cfg?.termsUrl && (
                    <a href={cfg.termsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white/60">Terms</a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
