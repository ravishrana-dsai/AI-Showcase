import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? '',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const contextInputs = [
    // ── Brand ──
    { key: 'brand_name', label: 'Brand Name', value: '[Company]', category: 'brand' },
    {
      key: 'parent_group',
      label: 'Parent Group',
      value: '[Company] (parent group behind [Company], 260M+ users, 18 years in sports, 11+ countries)',
      category: 'brand',
    },
    { key: 'tagline', label: 'Brand Tagline', value: 'Your Game, Measured.', category: 'brand' },
    {
      key: 'brand_voice',
      label: 'Brand Voice',
      value:
        'Confident, data-backed, player-first. Never arrogant. Short punchy sentences. Use real numbers. Sportswear brand energy meets fintech precision. Always say "players" never "users".',
      category: 'brand',
    },
    { key: 'newsletter_name', label: 'Newsletter Name', value: 'The Padel Intel', category: 'brand' },
    {
      key: 'brand_positions',
      label: 'Brand Positions',
      value:
        '1) Category Creator: We invented the scientific skill rating for padel and pickleball. Player Rating is a term we own.\n2) Player\'s Champion: D2C first. Built for the player, not the court operator. The Strava of racquet sports.\n3) Data Authority: What took us 18 months and 1,000+ matches to build cannot be replicated with an API call.',
      category: 'brand',
    },
    {
      key: 'one_liner',
      label: 'One-Liner',
      value:
        'We turn raw match footage into structured performance intelligence, giving amateur players a scientific skill rating, game analysis, coaching insights, and personalised content.',
      category: 'brand',
    },

    // ── Product ──
    {
      key: 'dpr_description',
      label: 'Player Rating Description',
      value:
        'Player Rating ([Company] Rating) is a Video AI-powered scientific skill score for every player, generated from raw match video using in-house Vision Language Models and proprietary ML. Three pillars: TECH (Technical: Winner:Error Balance, Overhead proficiency, Shot selection), TACT (Tactical: Net Control Time, First-Phase Initiative, Side-role Efficiency), PHY (Physical: Movement Economy, Time-to-Net, Reactive Time, Acceleration).',
      category: 'product',
    },
    {
      key: 'product_capabilities',
      label: 'Product Capabilities',
      value:
        '1. Player Rating: Scientific skill score (objective, measurable, credible)\n2. Game Analysis & Insights: Shot-by-shot breakdowns, rally analysis, movement heatmaps\n3. Coaching: Structured improvement paths built from real match data\n4. Content & Matchmaking: Auto-generated highlights, fair brackets, skill-matched opponents',
      category: 'product',
    },
    {
      key: 'technology_stats',
      label: 'Technology Stats',
      value:
        '5M+ structured data points per match. Model stack: 20+ Classical + 10+ Deep Learning + 50+ fine-tuned VLMs. 16x accuracy advantage over generic AI (80% SkillScore accuracy via DreamLens vs <5% raw Gemini). 95%+ consistency vs <25% for generic LLMs. 10x lower compute cost.',
      category: 'product',
    },
    {
      key: 'data_assets',
      label: 'Data Assets',
      value:
        '20,000+ hours of video. 10,000+ matches. 3M+ annotated images. $200M+ dataset replacement cost.',
      category: 'product',
    },
    {
      key: 'platform_stack',
      label: 'Platform Stack',
      value:
        'Mobile App: React Native. Backend: Java Spring Boot on AWS. AI/ML: GCP Cloud Functions. Internal Ops: Web-based panel.',
      category: 'product',
    },
    {
      key: 'problem_we_solve',
      label: 'Problem We Solve',
      value:
        'Amateur players have no accurate, objective way to know their skill level. Existing ratings are self-assessed or based on basic win/loss records. Without a skill signal, matchmaking is poor, improvement slows, and the player journey breaks down.',
      category: 'product',
    },

    // ── Audience ──
    {
      key: 'target_audience',
      label: 'Target Audience',
      value:
        'Padel and Pickleball players (all levels) who want to measure, track, and improve their game. D2C first: the player, not the court operator. Similar motivation to Strava runners or chess ELO chasers.',
      category: 'audience',
    },
    {
      key: 'sports',
      label: 'Sports',
      value:
        'Padel and Pickleball: fastest growing amateur racket sports globally. Combined market (2025): ~50M players spending $15-20B/year. By 2030: ~110M players.',
      category: 'audience',
    },
    {
      key: 'content_pillars',
      label: '7 Content Pillars',
      value:
        '1. Player Rating Education (what it is, how it works)\n2. Player Stories (real players, real ratings)\n3. Tournament Coverage (pre/during/post)\n4. Padel & Pickleball Tips and Technique\n5. Data Insights (match stats, trends)\n6. Community and Culture\n7. Court Partner Spotlights',
      category: 'audience',
    },
    {
      key: 'player_journey',
      label: 'Player Journey',
      value:
        'Pick up sport -> Find players -> Play -> Improve. Player Rating fixes the "Improve" step by providing objective measurement. Without it, the journey breaks down.',
      category: 'audience',
    },

    // ── Traction ──
    {
      key: 'traction_numbers',
      label: 'Traction Numbers',
      value:
        'MVP launched 15 December 2025. 500+ registered users (140 repeat). 9 courts live in India (25 in pipeline). 1,200+ matches covered. 7-9 tournaments covered. 1,500+ user requests. 70-80 new sign-ups from each tournament.',
      category: 'traction',
    },
    {
      key: 'key_signals',
      label: 'Key Signals',
      value:
        'Invited to World Padel Summit. Invited to UK padel summits by leading aggregators. Strong inbound from South America, UK, Spain, Middle East.',
      category: 'traction',
    },
    {
      key: 'expansion_targets',
      label: 'Expansion Targets',
      value:
        'Court expansion: 1,700 Padel courts + 1,700 Pickleball courts globally. India: 600 courts, 25K subscribers, $70 ARPU, $1.75M target ARR. Global: 3,000 courts, 116K subscribers, $200 ARPU, $23.25M target ARR.',
      category: 'traction',
    },

    // ── Competitive ──
    {
      key: 'competitive_position',
      label: 'Competitive Position',
      value:
        'Market today is B2B infrastructure-first (PlaSight $80M+, SwingVision $40M+, Wingfield $25M+). [Company] is D2C-first: comparable to Strava building a consumer layer on wearable data. Goal: Own the consumer intelligence layer in racquet sports.',
      category: 'competitive',
    },
    {
      key: 'seo_owned_terms',
      label: 'SEO/GSO Owned Terms',
      value:
        'Player Rating, [Company] Rating, padel skill rating, padel rating system, pickleball rating, scientific skill score',
      category: 'competitive',
    },
    {
      key: 'key_narratives',
      label: 'Key Narratives',
      value:
        '1. Video AI is the foundation of a new Sports Intelligence Engine, not an incremental improvement\n2. Player Rating is the performance currency of the ecosystem\n3. Data moat: $200M+ replacement cost, 10x more annotated data than any public racquet dataset\n4. Strava of racquet sports: D2C consumer intelligence\n5. Padel and Pickleball at inflection point: 50M players today, 110M by 2030\n6. Flywheel: 500+ users, 9 courts, 1,200 matches in under 3 months of MVP',
      category: 'competitive',
    },

    // ── Team ──
    {
      key: 'leadership_team',
      label: 'Leadership Team',
      value:
        'Amit Sharma (CEO): CTO [Company], Netflix, Yahoo. Aditya Prasad Narisetty (Head of Data Science): Head of AI [Company], Craftsvilla. Abhinn Kothari (Head of Strategy): Principal Dream Capital, BCG, Amazon. Sumit Pandey (Head of Partnerships): COO [Company] Foundation, JSW Sports.',
      category: 'team',
    },
  ]

  for (const input of contextInputs) {
    await prisma.contextInput.upsert({
      where: { key: input.key },
      update: { label: input.label, value: input.value, category: input.category },
      create: input,
    })
  }

  console.log(`Seeded ${contextInputs.length} context inputs`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
