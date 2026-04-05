// ============================================
// ASSBOY.COM — Central Configuration
// ============================================

export const site = {
  name: 'AssBoy.com',
  tagline: "The Internet's Chillest Hangout Spot",
  domain: 'assboy.com',
  contactEmail: 'domains@assboy.com',
  copyright: `© ${new Date().getFullYear()} AssBoy.com`,
  description: 'Premium domains for sale.',
} as const;

export const supabase = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  storageBucket: 'logos',
} as const;

export const stripeConfig = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  secretKey: process.env.STRIPE_SECRET_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  currency: 'usd' as const,
} as const;

export const grok = {
  apiKey: process.env.XAI_API_KEY!,
  imageModel: 'grok-imagine-image',
  textModel: 'grok-3',
  logoPromptTemplate: (domainName: string) =>
    `You are a world-class brand designer. Create a professional, brandable logo for the brand name "${domainName}". The logo should be memorable, modern, and work as a standalone brand mark. Do not include any domain extension like .com or .ai in the logo.`,
} as const;

export const admin = {
  password: process.env.ADMIN_PASSWORD!,
} as const;

export const domainDefaults = {
  tldOptions: ['.com', '.net', '.org', '.io', '.co', '.ai', '.dev', '.app'],
  statuses: ['available', 'pending', 'sold'] as const,
  orderStatuses: ['pending', 'paid', 'transfer_initiated', 'completed', 'cancelled', 'refunded'] as const,
} as const;

export const pricing = {
  systemPrompt: `You are a senior domain name broker with 15 years experience at Sedo and Afternic. You specialize in valuing brandable domains for the aftermarket. You consider: domain length, pronounceability, dictionary words, brandability, industry demand, TLD strength, and comparable recent sales. You price domains realistically for the aftermarket — not wishful thinking, not firesale.`,
  promptTemplate: (domainName: string) =>
    `Price this domain for aftermarket sale: "${domainName}"

Return ONLY a JSON object with no markdown, no explanation:
{"price": <number in USD>, "reasoning": "<one sentence why>"}`,
} as const;

export const transfer = {
  // How long (hours) before an unpaid checkout releases the domain back
  checkoutExpiryHours: 1,
  // Default transfer instructions template
  instructionsTemplate: (domainName: string, authCode: string) =>
    `Domain Transfer Instructions for ${domainName}:

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Start a domain transfer for: ${domainName}
3. Enter the authorization/EPP code: ${authCode}
4. Approve the transfer via email confirmation
5. Transfer typically completes within 5-7 days

Questions? Email ${site.contactEmail}`,
} as const;
