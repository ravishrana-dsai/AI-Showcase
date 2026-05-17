import Link from 'next/link';
import { Brain, Layout, Download, Palette, ArrowRight, Sparkles, Presentation, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              AI-Powered Presentation Generator
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Transform Ideas into{' '}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Stunning Presentations
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600 sm:text-xl">
              Create professional presentation decks in minutes. Simply provide your bullet points,
              and our AI will generate beautifully designed slides tailored to your needs.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/generator">
                <Button size="lg" className="group">
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="secondary" size="lg" className="group">
                  Browse Templates
                  <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-purple-200/30 blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Powerful Features
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Everything you need to create professional presentations effortlessly
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1 */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-500 hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                AI-Powered Content
              </h3>
              <p className="text-sm text-gray-600">
                Our advanced AI understands your content and generates coherent, professional
                slide content automatically.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-500 hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                <Layout className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                Professional Templates
              </h3>
              <p className="text-sm text-gray-600">
                Choose from dozens of professionally designed templates across various categories
                and visual styles.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-500 hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 transition-colors group-hover:bg-green-600 group-hover:text-white">
                <Download className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Dual Export</h3>
              <p className="text-sm text-gray-600">
                Export your presentations in multiple formats: PowerPoint (PPTX) or Google Slides
                for maximum compatibility.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-blue-500 hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 transition-colors group-hover:bg-purple-600 group-hover:text-white">
                <Palette className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Beautiful Design</h3>
              <p className="text-sm text-gray-600">
                Every slide is crafted with attention to detail, ensuring your presentations look
                polished and professional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gray-50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
              Create stunning presentations in three simple steps
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Step 1 */}
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white shadow-lg">
                    1
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">
                    Enter Bullet Points
                  </h3>
                  <p className="text-gray-600">
                    Simply paste or type your key points, ideas, or content. Our AI will analyze
                    and understand the structure of your presentation.
                  </p>
                </div>
                {false && (
                  <div className="absolute right-0 top-8 hidden h-0.5 w-full bg-gray-300 lg:block" />
                )}
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-2xl font-bold text-white shadow-lg">
                    2
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">
                    AI Generates Deck
                  </h3>
                  <p className="text-gray-600">
                    Our AI selects the perfect templates, generates content, and creates a
                    cohesive presentation deck tailored to your purpose and style.
                  </p>
                </div>
                {false && (
                  <div className="absolute right-0 top-8 hidden h-0.5 w-full bg-gray-300 lg:block" />
                )}
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-2xl font-bold text-white shadow-lg">
                    3
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-gray-900">
                    Export & Present
                  </h3>
                  <p className="text-gray-600">
                    Download your presentation as PowerPoint or export directly to Google Slides.
                    Edit, customize, and present with confidence.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/generator">
              <Button size="lg" className="group">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Presentation className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-bold text-gray-900">
                Deck<span className="text-blue-600">Gen</span>
              </span>
            </div>
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} DeckGen. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
