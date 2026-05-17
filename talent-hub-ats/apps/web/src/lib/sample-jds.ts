// Sample job description templates for [Company]
// Use these to seed realistic open roles in dev/demo environments.

export interface SampleJdTemplate {
  title: string;
  department: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  experienceLevel: "ENTRY" | "MID" | "SENIOR" | "LEAD" | "EXECUTIVE";
  description: string;
  requirements: string[];
  responsibilities: string[];
}

export const SAMPLE_JD_TEMPLATES: SampleJdTemplate[] = [
  // -------------------------------------------------------------------
  // 1. Senior Product Manager
  // -------------------------------------------------------------------
  {
    title: "Senior Product Manager",
    department: "Product",
    employmentType: "FULL_TIME",
    experienceLevel: "SENIOR",
    description: `
## About the role

[Company] is looking for a Senior Product Manager to own and evolve core product areas within our gaming platform. You will sit at the intersection of player experience, engineering, and business strategy — driving features from discovery through launch and beyond.

You will work with a tight, cross-functional squad of engineers, designers, and data scientists to ship experiences that millions of sports gaming fans enjoy every day. This is a high-impact, high-autonomy role for someone who thrives on clarity in ambiguity.

## Responsibilities

- Define and own the product roadmap for your area, grounded in user research, data, and business goals
- Write crisp PRDs, user stories, and success metrics that give your squad clear direction
- Partner with design and engineering to ship polished, high-quality features on a fast release cadence
- Drive alignment across stakeholders including Marketing, Commercial, and Leadership
- Instrument features with the right metrics and use data to guide iteration
- Lead discovery: conduct user interviews, analyse player behaviour, synthesise competitive intelligence

## Requirements

- 5+ years of product management experience at a consumer-facing tech company
- Track record of shipping products used by large audiences (1M+ users preferred)
- Strong analytical instincts: comfortable with SQL, analytics dashboards, and A/B test design
- Excellent written and verbal communication; can write a PRD that engineers love
- Experience working in agile squads with short release cycles

## Nice to have

- Background in gaming, sports, or entertainment products
- Experience with growth loops, monetisation mechanics, or live-ops features
- Prior experience scaling a product from MVP to maturity
    `.trim(),
    requirements: [
      "5+ years of product management experience at a consumer-facing tech company",
      "Track record of shipping products used by 1M+ users",
      "Strong analytical instincts: comfortable with SQL and A/B test design",
      "Excellent written and verbal communication",
      "Experience working in agile squads with short release cycles",
    ],
    responsibilities: [
      "Define and own the product roadmap for your area",
      "Write crisp PRDs, user stories, and success metrics",
      "Partner with design and engineering to ship polished features",
      "Drive alignment across stakeholders including Marketing and Leadership",
      "Lead discovery through user interviews and competitive analysis",
      "Instrument features with metrics and guide iteration with data",
    ],
  },

  // -------------------------------------------------------------------
  // 2. Staff Software Engineer (Backend)
  // -------------------------------------------------------------------
  {
    title: "Staff Software Engineer (Backend)",
    department: "Engineering",
    employmentType: "FULL_TIME",
    experienceLevel: "LEAD",
    description: `
## About the role

[Company] is hiring a Staff Software Engineer to help us scale the backend systems that power real-time sports gaming at scale. You will be a technical leader, an individual contributor, and a mentor — guiding architectural decisions, reviewing critical designs, and shipping code that matters.

Our backend stack is TypeScript/Node.js with PostgreSQL, Redis, and a growing event-driven architecture on AWS. We care deeply about reliability, performance, and maintainability.

## Responsibilities

- Architect and build highly reliable, low-latency backend services and APIs
- Influence technical direction across the engineering organisation through RFCs and design reviews
- Partner with Product and Platform teams to balance feature velocity with system health
- Lead code reviews and establish engineering standards and best practices
- Mentor senior and mid-level engineers; grow the team's capability
- Own incidents and drive root-cause analysis and systemic improvements

## Requirements

- 8+ years of software engineering experience, with 3+ years at a senior or staff level
- Deep expertise in Node.js or another server-side language (Go, Python, Java)
- Strong experience with relational databases (PostgreSQL preferred) and caching (Redis)
- Experience designing distributed systems and event-driven architectures
- Excellent communication: can explain complex technical concepts to non-engineers
- Proven ability to drive engineering initiatives across teams

## Nice to have

- Experience with real-time systems (WebSockets, SSE, or pub-sub)
- Familiarity with AWS (ECS, RDS, SQS, Lambda)
- Background in high-traffic consumer products
    `.trim(),
    requirements: [
      "8+ years of software engineering experience, 3+ years at staff/senior level",
      "Deep expertise in Node.js or another server-side language",
      "Strong experience with PostgreSQL and Redis",
      "Experience designing distributed systems and event-driven architectures",
      "Excellent communication skills across technical and non-technical audiences",
    ],
    responsibilities: [
      "Architect and build highly reliable, low-latency backend services",
      "Influence technical direction through RFCs and design reviews",
      "Partner with Product and Platform teams to balance velocity and health",
      "Lead code reviews and establish engineering standards",
      "Mentor senior and mid-level engineers",
      "Own incidents and drive systemic improvements",
    ],
  },

  // -------------------------------------------------------------------
  // 3. Senior Data Scientist
  // -------------------------------------------------------------------
  {
    title: "Senior Data Scientist",
    department: "Data & Analytics",
    employmentType: "FULL_TIME",
    experienceLevel: "SENIOR",
    description: `
## About the role

We are looking for a Senior Data Scientist to join [Company]'s Data team and help us build the intelligence layer that makes our gaming platform smarter, fairer, and more engaging for players.

You will design and own ML models that touch personalisation, odds modelling, fraud detection, and player lifecycle management. You will work closely with Product, Engineering, and Commercial teams to move from idea to production quickly.

## Responsibilities

- Design, build, and deploy machine learning models that directly impact the player experience
- Own the full ML lifecycle: problem framing, data exploration, modelling, validation, deployment, and monitoring
- Collaborate with product and engineering to integrate ML outputs into live product features
- Build scalable data pipelines and feature stores in collaboration with the Data Engineering team
- Communicate findings clearly to non-technical stakeholders; translate uncertainty into business decisions
- Mentor junior data scientists and establish best practices for model development

## Requirements

- 5+ years of experience in data science or ML engineering in a production environment
- Strong Python skills: proficiency with pandas, scikit-learn, and at least one deep learning framework (PyTorch or TensorFlow)
- Experience deploying models to production and monitoring model drift
- Solid understanding of statistical inference, experimentation (A/B tests), and causal analysis
- Experience querying large datasets with SQL
- Strong communicator who can present complex results to executives

## Nice to have

- Experience in sports analytics, gaming, or real-time prediction systems
- Familiarity with MLflow, Feast, or similar ML tooling
- Knowledge of Bayesian methods or probabilistic programming
    `.trim(),
    requirements: [
      "5+ years of data science or ML engineering experience in production",
      "Strong Python skills with pandas, scikit-learn, and a deep learning framework",
      "Experience deploying and monitoring production ML models",
      "Solid understanding of statistical inference and A/B testing",
      "Proficiency in SQL for large dataset analysis",
    ],
    responsibilities: [
      "Design, build, and deploy ML models impacting the player experience",
      "Own the full ML lifecycle from problem framing to monitoring",
      "Integrate ML outputs into live product features with Engineering",
      "Build scalable data pipelines and feature stores",
      "Communicate findings clearly to non-technical stakeholders",
      "Mentor junior data scientists and establish best practices",
    ],
  },

  // -------------------------------------------------------------------
  // 4. Head of Design / UX Lead
  // -------------------------------------------------------------------
  {
    title: "Head of Design / UX Lead",
    department: "Design",
    employmentType: "FULL_TIME",
    experienceLevel: "EXECUTIVE",
    description: `
## About the role

[Company] is hiring a Head of Design to lead our design function and shape the visual identity, interaction patterns, and overall experience of our gaming products. You will manage a small, talented team of product designers while also staying close to the craft.

You will set the bar for design excellence at [Company], establish our design system, and partner with Product and Engineering to deliver world-class player experiences. This is a player-coach role: you lead and you do.

## Responsibilities

- Define and own the design vision, strategy, and roadmap for [Company]'s products
- Lead, coach, and grow a team of product and visual designers
- Establish and evolve our design system, component library, and brand guidelines
- Partner with Product Managers and Engineers to ship high-quality features on time
- Drive user research and usability testing to ground design decisions in real player needs
- Present design strategy and vision to executive leadership
- Recruit, interview, and hire top design talent

## Requirements

- 8+ years of product design experience, including 3+ years in a design leadership role
- Strong portfolio demonstrating expertise in interaction design, visual design, and systems thinking
- Experience building or scaling a design system from scratch
- Proven ability to manage and grow a design team
- Deep user research skills: interviews, usability testing, and synthesis
- Excellent cross-functional communication and stakeholder management

## Nice to have

- Experience designing for gaming, sports, or entertainment products
- Familiarity with motion design and animation
- Background in brand identity or marketing design
- Experience with Figma at an advanced level (variables, auto layout, component APIs)
    `.trim(),
    requirements: [
      "8+ years of product design experience, 3+ years in design leadership",
      "Strong portfolio in interaction design, visual design, and systems thinking",
      "Experience building or scaling a design system from scratch",
      "Proven ability to manage and grow a design team",
      "Deep user research skills including usability testing",
    ],
    responsibilities: [
      "Define and own design vision, strategy, and roadmap",
      "Lead, coach, and grow a team of product and visual designers",
      "Establish and evolve the design system and brand guidelines",
      "Partner with PM and Engineering to ship high-quality features",
      "Drive user research and usability testing",
      "Present design strategy to executive leadership and recruit top talent",
    ],
  },

  // -------------------------------------------------------------------
  // 5. Engineering Manager
  // -------------------------------------------------------------------
  {
    title: "Engineering Manager",
    department: "Engineering",
    employmentType: "FULL_TIME",
    experienceLevel: "LEAD",
    description: `
## About the role

[Company] is looking for an Engineering Manager to lead one of our product squads. You will be responsible for the health, growth, and output of a team of 6-8 engineers building core features of our gaming platform.

This role is 70% people leadership and 30% technical involvement. You will not be shipping code daily, but you will be deeply involved in architecture reviews, technical strategy, and hands-on debugging when it matters. You care about your team as much as the product.

## Responsibilities

- Lead and manage a squad of 6-8 engineers across all seniority levels
- Run effective 1:1s, performance reviews, career conversations, and feedback cycles
- Partner with Product Management to plan, prioritise, and deliver roadmap commitments
- Own team health: hiring, onboarding, culture, and retention
- Set clear expectations for engineering quality, velocity, and operational excellence
- Remove blockers and create an environment where engineers do their best work
- Represent your team's technical needs and trade-offs to leadership

## Requirements

- 3+ years of engineering management experience leading product squads
- Strong engineering background with 5+ years of hands-on software development experience
- Experience managing hiring pipelines, running interviews, and building diverse teams
- Excellent communication: can translate between business goals and technical trade-offs
- Track record of growing engineers and promoting from within
- Comfort with ambiguity and the ability to make decisions with incomplete information

## Nice to have

- Experience in high-growth consumer tech or gaming companies
- Familiarity with agile delivery frameworks (Scrum, Shape Up, or similar)
- Prior experience as a technical lead or senior engineer before moving into management
    `.trim(),
    requirements: [
      "3+ years of engineering management experience leading product squads",
      "Strong engineering background with 5+ years of hands-on development",
      "Experience managing hiring pipelines and building diverse teams",
      "Excellent communication between business goals and technical trade-offs",
      "Track record of growing engineers and promoting from within",
    ],
    responsibilities: [
      "Lead and manage a squad of 6-8 engineers across all seniority levels",
      "Run effective 1:1s, performance reviews, and feedback cycles",
      "Partner with Product Management to plan and deliver roadmap commitments",
      "Own team health including hiring, onboarding, culture, and retention",
      "Set expectations for engineering quality, velocity, and operational excellence",
      "Represent team technical needs and trade-offs to leadership",
    ],
  },

  // -------------------------------------------------------------------
  // 6. Senior Growth Marketing Manager
  // -------------------------------------------------------------------
  {
    title: "Senior Growth Marketing Manager",
    department: "Marketing",
    employmentType: "FULL_TIME",
    experienceLevel: "SENIOR",
    description: `
## About the role

[Company] is hiring a Senior Growth Marketing Manager to own and scale our player acquisition and retention engine. You will build and run multi-channel growth campaigns, drive experimentation, and work cross-functionally to grow our active player base sustainably.

You will own targets, budgets, and channels. This is a hands-on role for someone who is equally comfortable pulling data, designing campaigns, and pitching strategy to leadership.

## Responsibilities

- Own end-to-end growth strategy across paid, owned, and earned channels
- Plan and execute acquisition campaigns across Meta, Google, TikTok, programmatic, and influencer partnerships
- Design and run rigorous A/B experiments on messaging, creative, landing pages, and funnels
- Build and manage lifecycle marketing programs: onboarding, activation, re-engagement, and win-back
- Collaborate with Product on in-product growth loops, referral mechanics, and notification strategy
- Report weekly on growth metrics: CAC, LTV, ROAS, D1/D7/D30 retention, and payback period
- Manage agency relationships and a significant performance marketing budget

## Requirements

- 5+ years of growth or performance marketing experience at a consumer technology company
- Proven record of driving measurable user growth and improving key retention metrics
- Deep expertise in paid social and search advertising platforms
- Strong analytical skills: comfortable with attribution models, cohort analysis, and SQL
- Experience designing and interpreting A/B and multivariate experiments
- Excellent project management: can run multiple campaigns in parallel without dropping quality

## Nice to have

- Experience marketing gaming, sports, or entertainment products
- Familiarity with mobile attribution tools (AppsFlyer, Adjust, or similar)
- Background in content marketing, SEO, or community-led growth
- Experience with CRM and lifecycle tools (Braze, Iterable, or Klaviyo)
    `.trim(),
    requirements: [
      "5+ years of growth or performance marketing at a consumer tech company",
      "Proven record of driving measurable user growth and retention improvements",
      "Deep expertise in paid social and search advertising platforms",
      "Strong analytical skills including attribution models and cohort analysis",
      "Experience designing and interpreting A/B experiments",
    ],
    responsibilities: [
      "Own end-to-end growth strategy across paid, owned, and earned channels",
      "Plan and execute acquisition campaigns across major advertising platforms",
      "Design and run rigorous A/B experiments on messaging, creative, and funnels",
      "Build and manage lifecycle marketing programs from onboarding to win-back",
      "Collaborate with Product on in-product growth loops and referral mechanics",
      "Report weekly on growth metrics including CAC, LTV, ROAS, and retention",
    ],
  },
];
