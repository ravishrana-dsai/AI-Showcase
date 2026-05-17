"use client";

import { useState, useRef } from "react";
import { Loader2, Plus, Trash2, Upload, X, ExternalLink } from "lucide-react";
import { getApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentCard {
  id: string;
  title: string;
  body: string;
}

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  dept: string;
}

interface StatItem {
  id: string;
  value: string;
  label: string;
}

interface CareerConfig {
  logoUrl?: string | null;
  bannerImageUrl?: string | null;
  ogImageUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  heroDescription?: string;
  showValues?: boolean;
  showBenefits?: boolean;
  showTestimonials?: boolean;
  showStats?: boolean;
  values?: ContentCard[];
  benefits?: ContentCard[];
  testimonials?: Testimonial[];
  stats?: StatItem[];
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  githubUrl?: string | null;
  instagramUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  customCss?: string | null;
  footerText?: string | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
}

interface Props {
  // Accept any object (Prisma CareerPageConfig or null) — JSON fields cast inside
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initial: any;
  orgSlug: string;
  orgName: string;
  careersPublicBaseUrl: string;
}

type Tab = "branding" | "content" | "sections" | "social" | "advanced";

const TABS: { key: Tab; label: string }[] = [
  { key: "branding", label: "Branding" },
  { key: "content", label: "Hero & Content" },
  { key: "sections", label: "Values & Benefits" },
  { key: "social", label: "Social & SEO" },
  { key: "advanced", label: "Advanced" },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function ensureId<T extends object>(arr: T[]): (T & { id: string })[] {
  return arr.map((item) => ({ id: uid(), ...item }));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-violet-600" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium mb-1.5">{children}</label>;
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring", className)}
    />
  );
}

function TextAreaInput({ value, onChange, placeholder, rows = 3 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
    />
  );
}

function ImageUpload({
  label,
  hint,
  currentUrl,
  field,
  onUploaded,
}: {
  label: string;
  hint: string;
  currentUrl?: string | null;
  field: "logo" | "banner" | "og";
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("field", field);
      const res = await fetch(getApiUrl("/api/settings/career-page/upload"), { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>
      <div className="flex items-center gap-3">
        {currentUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt={label} className="h-12 rounded-lg border object-contain bg-muted px-2" />
        )}
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {currentUrl ? "Replace" : "Upload"}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section editors
// ---------------------------------------------------------------------------

function ContentCardEditor({
  items,
  onChange,
  addLabel,
  titlePlaceholder,
  bodyPlaceholder,
}: {
  items: ContentCard[];
  onChange: (items: ContentCard[]) => void;
  addLabel: string;
  titlePlaceholder: string;
  bodyPlaceholder: string;
}) {
  function add() {
    onChange([...items, { id: uid(), title: "", body: "" }]);
  }
  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }
  function update(id: string, field: "title" | "body", value: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item {idx + 1}</span>
            <button type="button" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <TextInput value={item.title} onChange={(v) => update(item.id, "title", v)} placeholder={titlePlaceholder} />
          <TextAreaInput value={item.body} onChange={(v) => update(item.id, "body", v)} placeholder={bodyPlaceholder} rows={2} />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  );
}

function TestimonialsEditor({ items, onChange }: { items: Testimonial[]; onChange: (items: Testimonial[]) => void }) {
  function add() {
    onChange([...items, { id: uid(), quote: "", name: "", role: "", dept: "" }]);
  }
  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }
  function update(id: string, field: keyof Omit<Testimonial, "id">, value: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Testimonial {idx + 1}</span>
            <button type="button" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <TextAreaInput value={item.quote} onChange={(v) => update(item.id, "quote", v)} placeholder='e.g. "Working here changed my career trajectory."' rows={2} />
          <div className="grid grid-cols-3 gap-2">
            <TextInput value={item.name} onChange={(v) => update(item.id, "name", v)} placeholder="Name" />
            <TextInput value={item.role} onChange={(v) => update(item.id, "role", v)} placeholder="Role" />
            <TextInput value={item.dept} onChange={(v) => update(item.id, "dept", v)} placeholder="Department" />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        Add testimonial
      </button>
    </div>
  );
}

function StatsEditor({ items, onChange }: { items: StatItem[]; onChange: (items: StatItem[]) => void }) {
  function add() {
    onChange([...items, { id: uid(), value: "", label: "" }]);
  }
  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id));
  }
  function update(id: string, field: "value" | "label", value: string) {
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          <TextInput value={item.value} onChange={(v) => update(item.id, "value", v)} placeholder="e.g. 10M+" className="flex-1" />
          <TextInput value={item.label} onChange={(v) => update(item.id, "label", v)} placeholder="e.g. Users" className="flex-1" />
          <button type="button" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30"
      >
        <Plus className="w-4 h-4" />
        Add stat
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function CareerPageConfigForm({ initial, orgSlug, orgName, careersPublicBaseUrl }: Props) {
  const cfg = initial ?? {};

  const [activeTab, setActiveTab] = useState<Tab>("branding");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Branding
  const [logoUrl, setLogoUrl] = useState<string>(cfg.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState<string>(cfg.bannerImageUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(cfg.primaryColor ?? "#7c3aed");
  const [accentColor, setAccentColor] = useState(cfg.accentColor ?? "#6d28d9");
  const [bgColor, setBgColor] = useState(cfg.backgroundColor ?? "#000000");

  // Hero / content
  const [heroHeadline, setHeroHeadline] = useState(cfg.heroHeadline ?? "Join Our Team.");
  const [heroSubheadline, setHeroSubheadline] = useState(cfg.heroSubheadline ?? "Build What Matters.");
  const [heroDescription, setHeroDescription] = useState(
    cfg.heroDescription ?? "We are looking for talented people who want to do the best work of their careers."
  );

  // Section toggles
  const [showValues, setShowValues] = useState(cfg.showValues ?? true);
  const [showBenefits, setShowBenefits] = useState(cfg.showBenefits ?? true);
  const [showTestimonials, setShowTestimonials] = useState(cfg.showTestimonials ?? true);
  const [showStats, setShowStats] = useState(cfg.showStats ?? true);

  // Content arrays
  const [values, setValues] = useState<ContentCard[]>(ensureId((cfg.values as ContentCard[] | undefined) ?? []));
  const [benefits, setBenefits] = useState<ContentCard[]>(ensureId((cfg.benefits as ContentCard[] | undefined) ?? []));
  const [testimonials, setTestimonials] = useState<Testimonial[]>(ensureId((cfg.testimonials as Testimonial[] | undefined) ?? []));
  const [stats, setStats] = useState<StatItem[]>(ensureId((cfg.stats as StatItem[] | undefined) ?? []));

  // Social
  const [linkedinUrl, setLinkedinUrl] = useState(cfg.linkedinUrl ?? "");
  const [twitterUrl, setTwitterUrl] = useState(cfg.twitterUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(cfg.githubUrl ?? "");
  const [instagramUrl, setInstagramUrl] = useState(cfg.instagramUrl ?? "");

  // SEO
  const [metaTitle, setMetaTitle] = useState(cfg.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(cfg.metaDescription ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(cfg.ogImageUrl ?? "");

  // Advanced
  const [customCss, setCustomCss] = useState(cfg.customCss ?? "");
  const [footerText, setFooterText] = useState(cfg.footerText ?? "");
  const [privacyUrl, setPrivacyUrl] = useState(cfg.privacyPolicyUrl ?? "");
  const [termsUrl, setTermsUrl] = useState(cfg.termsUrl ?? "");

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/career-page"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: logoUrl || null,
          bannerImageUrl: bannerUrl || null,
          primaryColor,
          accentColor,
          backgroundColor: bgColor,
          heroHeadline,
          heroSubheadline,
          heroDescription,
          showValues,
          showBenefits,
          showTestimonials,
          showStats,
          values: values.map(({ title, body }) => ({ title, body })),
          benefits: benefits.map(({ title, body }) => ({ title, body })),
          testimonials: testimonials.map(({ quote, name, role, dept }) => ({ quote, name, role, dept })),
          stats: stats.map(({ value, label }) => ({ value, label })),
          linkedinUrl: linkedinUrl || null,
          twitterUrl: twitterUrl || null,
          githubUrl: githubUrl || null,
          instagramUrl: instagramUrl || null,
          metaTitle: metaTitle || null,
          metaDescription: metaDescription || null,
          ogImageUrl: ogImageUrl || null,
          customCss: customCss || null,
          footerText: footerText || null,
          privacyPolicyUrl: privacyUrl || null,
          termsUrl: termsUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
          Career page saved. Changes are live at{" "}
          <a
            href={`${careersPublicBaseUrl.replace(/\/$/, "")}/${orgSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-1 break-all"
          >
            {careersPublicBaseUrl.replace(/\/$/, "")}/{orgSlug} <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-violet-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card rounded-xl border p-6 space-y-6">

        {/* ---- BRANDING ---- */}
        {activeTab === "branding" && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold">Branding</h2>

            <ImageUpload
              label="Organization Logo"
              hint="Shown in the nav bar. JPEG, PNG, WebP, or SVG. Max 512 KB."
              field="logo"
              currentUrl={logoUrl || null}
              onUploaded={setLogoUrl}
            />

            <ImageUpload
              label="Hero Banner Image"
              hint="Optional background image for the hero section. Max 3 MB."
              field="banner"
              currentUrl={bannerUrl || null}
              onUploaded={setBannerUrl}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Primary color</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer"
                  />
                  <TextInput value={primaryColor} onChange={setPrimaryColor} placeholder="#7c3aed" className="flex-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Buttons, badges, highlights</p>
              </div>
              <div>
                <FieldLabel>Accent color</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer"
                  />
                  <TextInput value={accentColor} onChange={setAccentColor} placeholder="#6d28d9" className="flex-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Hover states, gradients</p>
              </div>
              <div>
                <FieldLabel>Background color</FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-10 w-12 rounded border cursor-pointer"
                  />
                  <TextInput value={bgColor} onChange={setBgColor} placeholder="#000000" className="flex-1" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Page background</p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium mb-2">Color preview</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Primary button
                </span>
                <span
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  Accent button
                </span>
                <span
                  className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: bgColor, border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  Background
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ---- HERO & CONTENT ---- */}
        {activeTab === "content" && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold">Hero Section</h2>
            <p className="text-sm text-muted-foreground -mt-3">This is the first thing candidates see when they visit your careers page.</p>

            <div>
              <FieldLabel>Main headline</FieldLabel>
              <TextInput value={heroHeadline} onChange={setHeroHeadline} placeholder="Game On." />
              <p className="text-xs text-muted-foreground mt-1">Large text shown at the top of the hero.</p>
            </div>

            <div>
              <FieldLabel>Subheadline</FieldLabel>
              <TextInput value={heroSubheadline} onChange={setHeroSubheadline} placeholder="Play Big." />
              <p className="text-xs text-muted-foreground mt-1">Shown below the headline in accent color gradient.</p>
            </div>

            <div>
              <FieldLabel>Description paragraph</FieldLabel>
              <TextAreaInput
                value={heroDescription}
                onChange={setHeroDescription}
                placeholder="Tell candidates why they should join your team..."
                rows={3}
              />
            </div>

            <div className="border-t pt-5">
              <h2 className="text-base font-semibold mb-4">Stats Row</h2>
              <Toggle checked={showStats} onChange={setShowStats} label="Show stats row in hero" />
              {showStats && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-3">These numbers appear as highlights in the hero section.</p>
                  <StatsEditor items={stats} onChange={setStats} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- VALUES & BENEFITS ---- */}
        {activeTab === "sections" && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Values</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">What your company stands for.</p>
                </div>
                <Toggle checked={showValues} onChange={setShowValues} label="Show section" />
              </div>
              {showValues && (
                <ContentCardEditor
                  items={values}
                  onChange={setValues}
                  addLabel="Add value"
                  titlePlaceholder="e.g. Move fast"
                  bodyPlaceholder="Short description of this value..."
                />
              )}
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Benefits</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Why candidates should join you.</p>
                </div>
                <Toggle checked={showBenefits} onChange={setShowBenefits} label="Show section" />
              </div>
              {showBenefits && (
                <ContentCardEditor
                  items={benefits}
                  onChange={setBenefits}
                  addLabel="Add benefit"
                  titlePlaceholder="e.g. Health and wellness"
                  bodyPlaceholder="Short description of this benefit..."
                />
              )}
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold">Testimonials</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Quotes from your team members.</p>
                </div>
                <Toggle checked={showTestimonials} onChange={setShowTestimonials} label="Show section" />
              </div>
              {showTestimonials && (
                <TestimonialsEditor items={testimonials} onChange={setTestimonials} />
              )}
            </div>
          </div>
        )}

        {/* ---- SOCIAL & SEO ---- */}
        {activeTab === "social" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold mb-4">Social Links</h2>
              <p className="text-sm text-muted-foreground mb-4">These appear in the footer of your careers page.</p>
              <div className="space-y-3">
                <div>
                  <FieldLabel>LinkedIn URL</FieldLabel>
                  <TextInput value={linkedinUrl} onChange={setLinkedinUrl} placeholder="https://linkedin.com/company/..." />
                </div>
                <div>
                  <FieldLabel>Twitter / X URL</FieldLabel>
                  <TextInput value={twitterUrl} onChange={setTwitterUrl} placeholder="https://twitter.com/..." />
                </div>
                <div>
                  <FieldLabel>GitHub URL</FieldLabel>
                  <TextInput value={githubUrl} onChange={setGithubUrl} placeholder="https://github.com/..." />
                </div>
                <div>
                  <FieldLabel>Instagram URL</FieldLabel>
                  <TextInput value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/..." />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-base font-semibold mb-4">SEO & Social Sharing</h2>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Page title</FieldLabel>
                  <TextInput value={metaTitle} onChange={setMetaTitle} placeholder={`Careers at ${orgSlug}`} />
                  <p className="text-xs text-muted-foreground mt-1">Shown in browser tab and search results. Leave blank to use the default.</p>
                </div>
                <div>
                  <FieldLabel>Meta description</FieldLabel>
                  <TextAreaInput
                    value={metaDescription}
                    onChange={setMetaDescription}
                    placeholder="Join our team and build something great..."
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Shown in search result snippets and social previews. Max 160 characters recommended.</p>
                </div>
                <ImageUpload
                  label="Social sharing image (OG image)"
                  hint="Shown when sharing your careers link on LinkedIn, Twitter, etc. 1200x630 recommended. Max 1 MB."
                  field="og"
                  currentUrl={ogImageUrl || null}
                  onUploaded={setOgImageUrl}
                />
              </div>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-base font-semibold mb-4">Footer</h2>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Footer copyright text</FieldLabel>
                  <TextInput value={footerText} onChange={setFooterText} placeholder={`© ${new Date().getFullYear()} Your Company. All rights reserved.`} />
                </div>
                <div>
                  <FieldLabel>Privacy policy URL</FieldLabel>
                  <TextInput value={privacyUrl} onChange={setPrivacyUrl} placeholder="https://..." />
                </div>
                <div>
                  <FieldLabel>Terms of service URL</FieldLabel>
                  <TextInput value={termsUrl} onChange={setTermsUrl} placeholder="https://..." />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- ADVANCED ---- */}
        {activeTab === "advanced" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold">Custom CSS</h2>
              <p className="text-sm text-muted-foreground mt-0.5 mb-4">
                Inject custom CSS into your careers page for fine-grained styling. Avoid using <code className="text-xs bg-muted px-1 rounded">!important</code> excessively.
              </p>
              <textarea
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                placeholder={`.career-hero {\n  /* custom styles */\n}`}
                rows={10}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Scripts, <code className="text-xs bg-muted px-1 rounded">@import</code>, and <code className="text-xs bg-muted px-1 rounded">expression()</code> are stripped for security.
              </p>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Career page URL</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your public careers page is live at:{" "}
                <a
                  href={`${careersPublicBaseUrl.replace(/\/$/, "")}/${orgSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-500 hover:underline inline-flex items-center gap-1 break-all"
                >
                  {careersPublicBaseUrl.replace(/\/$/, "")}/{orgSlug}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The URL slug is based on your organization name. It changes when you rename your organization in Organization Settings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
