# Revenue and monetization benchmarks for consumer wardrobe / styling subscription apps (as of Oct 2026)

Research note: ~14 tool calls; search tool is US-only and returned mostly aggregators. Many requested data points (Whering/Indyx/Acloset/Stylebook revenue, LTK/Awin yield, Vietnam CPI, Vinted/Depop APIs) were NOT found. Gaps are listed explicitly rather than filled.

## 1. Published revenue estimates and pricing of comparable apps (Whering, Indyx, Acloset, Stylebook, etc.)

### Takeaway
No credible Sensor Tower/Appfigures/AppMagic revenue figures for any named wardrobe app surfaced (paywalled, not indexed). Only anecdotal, self-reported indie data points exist.

### Cited Findings
- Indyx: founded 2021, SF; cataloguing and outfit styling are free and the founders said they do not plan to charge for those foundational features; a paid "Insider" tier adds extras (dashboard, community). No revenue figure found. — [Indyx blog](https://myindyx.com/blog/why-we-are-launching-insider); [CB Insights](https://www.cbinsights.com/company/indyx)
- Acloset: founded 2020, Seoul; total funding listed $2.57M. No revenue found. — [CB Insights](https://www.cbinsights.com/company/a-closet/)
- Fitted (AI closet app, founder Reid Moncada): 600K+ downloads, ~500M video views, 2M+ closet items uploaded; downloads driven at roughly $0.01-$0.15 each via boosted organic TikTok; app currently has NO paywall (removed to prioritise growth); revenue not disclosed in the article body (the page headline claims $150k, unconfirmed); high churn acknowledged. — [Superwall](https://superwall.dev/blog/how-reid-moncada-built-a-viral-ai-fashion-app-that-hit-600k)
- Fitted Laundry (AI digital closet): growth entirely organic TikTok/Instagram, top video 3.5M+ views, typical 30K+; no MRR given. — [Playkit](https://playkit.beehiiv.com/p/fitted-laundry)
- A solo-founder virtual try-on app listed for sale: $887 MRR after 2 months, 47 paying subscribers, 6 organic TikTok accounts, high early trial churn (self-reported sale listing, unverified). — [Microns listing](https://microns.io/startup-listings/virtual-try-on-app-for-ios-and-android)
- Generic claim "fashion subscription apps can reach $5-10k MRR in year one" is unsourced marketing copy; do not rely on it. — [Anything blog](https://www.anything.com/blog/fashion-app-ideas)

### Inferences
- Incumbents (Indyx) keep core features free; Fitted removed its paywall. The pure "catalogue wardrobe" job appears hard to charge for; MIEN's paid hooks are better placed on AI-cost features (try-on, verdict, color analysis).
- A realistic solo outcome is probably low hundreds to low thousands USD MRR unless a viral TikTok channel exists (inference from section 2).

### Gaps
- No Sensor Tower/Appfigures/AppMagic estimates for Whering, Indyx, Acloset, Stylebook, Style DNA, Alta, Combyne, Getwardrobe, Pureple. Their pricing and paywall design were not retrievable; check each store listing's IAP list and free Appfigures/Sensor Tower profiles manually.

## 2. Subscription benchmarks (RevenueCat 2026, Adapty 2026)

### Takeaway
Freemium converts far worse than hard paywalls; revenue is hugely concentrated; Lifestyle is one of the weakest categories by install LTV ($0.70 year-1); only ~3.5% of subscription apps reached $10k/month in the 2024 edition.

### Cited Findings
- RevenueCat SoSA 2026 (115k+ apps, $16B+ revenue, reference year 2025): Day-35 trial-to-paid median 10.7% for hard paywall vs 2.1% for freemium; hard paywall fell from 12.1% prior year. — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- Revenue per install at Day 60: $3.09 hard paywall vs $0.38 freemium (~8x); Day 14: $2.32 vs $0.27. — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- 12-month retention of yearly subscribers: 28% freemium, 27% hard paywall; ~72% of annual subscribers cancelled in year 1 in 2026 (vs ~56% in 2025); month 1 accounts for 35% of annual cancellations. — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- AI apps: year-1 realized LTV median $30.16 vs $21.37 non-AI (+41%), but AI monthly plans retain ~36% worse over 12 months; 12-month payer retention for AI apps 9.2% (App Store) / 11.5% (Google Play). — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026); [PPC Land](https://ppc.land/ai-apps-earn-41-more-per-user-but-churn-30-faster-revenuecat-finds/)
- 31% of Google Play cancellations are involuntary billing failures vs 14% on App Store. — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- Median YoY MRR growth 5.3%; top 25% grew 80%+; bottom 25% shrank 33%+. — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- Earlier RevenueCat edition via TechCrunch (Mar 2024, OLDER): 17.2% of apps reach $1,000 monthly revenue; 3.5% reach $10,000. — [TechCrunch](https://techcrunch.com/2024/03/12/most-subscription-mobile-apps-dont-make-money-new-report-shows/)
- A secondary guide claims the median new subscription app earns under $50/month after 12 months (unverified secondary). — [theswiftk.it](https://theswiftk.it.com/blog/how-much-do-indie-ios-developers-make)
- Adapty 2026 Lifestyle: median 1-year install LTV $0.70 (7th of 8 categories; Health & Fitness $1.21, Productivity $1.10); top 10% of Lifestyle apps take 97.9% of revenue; all-category median $492 monthly revenue per new app in 2025. — [Adapty Lifestyle benchmarks](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- Adapty Lifestyle: install-to-trial below ~12% (global median 11.2%); Lifestyle monthly/annual direct conversion below 4% at all price tiers; weekly no-trial ~5% of installs convert, ~35% of those reach first renewal (chart read). — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- Adapty also cites 18-38% "install-to-paid" for Lifestyle with a well-positioned direct paywall; this conflicts with the <4% monthly/annual figure on the same page, so treat 18-38% as an unrealistic upper bound, not a planning number. — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- Global renewal retention (all categories): 59.2% first renewal, 45.1% second, 37.1% third; day-380 retention annual 19.9%, monthly 14.2%, weekly 5.5%. — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- Lifestyle revenue mix 2025: weekly 31%, monthly 29%, one-time purchases 26%. — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)

### Inferences
- Rough model: the $0.70 median lifestyle install LTV implies ~$700 gross per 1,000 installs before store fees; at 2-4% payers that is 20-40 payers per 1,000 installs.
- The freemium vs hard paywall gap (~8x RPI) is the largest lever; MIEN is freemium and should expect the low end unless AI features are hard-gated.

### Gaps
- Fashion-specific conversion, Photo/Shopping category ARPU, refund rates, month-1 retention, and the 2026 edition's share of apps at $1k/$10k MRR not retrievable.

## 3. Price points and elasticity

### Takeaway
Adapty global medians: $7.48/week, $12.99/month, $38.42/year. In Lifestyle, weekly plans with short trials win on one-year LTV, and higher-priced annual plans beat low-priced ones.

### Cited Findings
- 2025 global medians: $7.48 weekly, $12.99 monthly, $38.42 annual; Europe 29-39% pricier than North America; UK weekly 1.3x US, Turkey 0.5x. — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- Best Lifestyle paywall by 1-year LTV: weekly, 3-day trial, $5.99. Worst by conversion: monthly, 7-day trial, $19.99. — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- 12-month LTV by plan (no trial): annual ~$45, monthly ~$35 (text also gives $42.8), weekly ~$22; high-priced annual ~$50 vs ~$22.3 for low-priced; trial users' LTV is 21.2% lower than direct buyers in Lifestyle. — [Adapty](https://adapty.io/blog/lifestyle-app-subscription-benchmarks/)
- Trial length: 17-32 day trials convert 42.5% median vs 25.5% for under 4 days (all categories). — [RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)

### Inferences
- The $29-79/yr band is consistent with the $38 global median; no evidence found that a sub-$30 annual price raises LTV. Vietnam/SEA pricing should sit well below the US index (no Vietnam elasticity data found).

### Gaps
- No evidence on lifetime-offer or credit-pack conversion in fashion apps; Vietnam willingness to pay unsourced.

## 4. Cost side: AI inference and store fees

### Takeaway
Image generation costs ~$0.04 (Gemini 2.5 Flash Image) to ~$0.13-0.24 (Gemini 3 Pro Image) per image; text/vision extraction on Flash is a fraction of a cent. Figures come from third-party aggregators, not Google's page.

### Cited Findings
- Gemini 2.5 Flash Image about $0.039 per image (batch about half); Gemini 3 Pro Image about $0.134 per 1K-2K image and $0.24 per 4K (batch $0.067 / $0.12). — [getmaxim calculator](https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/gemini/model/gemini-2.5-flash-image.md); [laozhang.ai](https://blog.laozhang.ai/en/posts/gemini-3-pro-image-api-cost-per-image)
- Gemini 2.5 Flash text: $0.30 / M input, $2.50 / M output tokens; cached input $0.03 / M; batch 50% off; Flash-Lite $0.10 / $0.40. — [pricepertoken](https://pricepertoken.com/pricing-page/model/google-gemini-2.5-flash); [anotherwrapper](https://anotherwrapper.com/llm-pricing/gemini-2.5-flash)

### Inferences
- My arithmetic: a vision call of ~1.5k input + 500 output tokens is ~$0.0017. A try-on on 3 Pro Image is ~$0.14. At $38/yr gross, a 15% store fee (program terms not verified here) leaves ~$32; 20 Pro try-ons/yr = ~$2.8 (~9% of net), 100 = ~$14 (~44%). Credit caps on the Pro tier are essential; Flash Image is ~3.4x cheaper.
- Free users are the real cost risk: 3 free Pro try-ons per install = ~$0.40, against a $0.70 median lifestyle install LTV.

### Gaps
- Official Google/OpenAI/Anthropic pricing pages not fetched; GPT-4.1 mini and Claude per-call costs not gathered. Gemini 3.1 Flash Image listings conflict ($0.25/$1.50 vs $0.50/$3.00 per M).

## 5. Alternative revenue streams

### Takeaway
Only generic affiliate commission ranges and SMB size-API prices found; no per-user yield, no LTK/Awin/Vinted/Depop API data.

### Cited Findings
- Fashion affiliate commissions typically 8.5-15% per sale, some brands up to 25%; Mytheresa 8% with 30-day cookie. — [impact.com](https://impact.com/affiliate/fashion-affiliate-programs/)
- Kiwi Sizing (Shopify size recommender, buyer is the merchant): Free, $6.99, $12.49, $24.49/month tiers with order-based surcharges; one comparison estimates $72-144/month all-in for stores with 2k-6k orders. — [Kiwi Sizing](https://app.kiwisizing.com/kiwiSizing/admin/signUp); [size.ly comparison](https://www.size.ly/blog/size-recommendation-apps-compared)
- Virtusize: one unverified listing at $39/month "pay as you grow". — [PickYourApp](https://pickyourapp.com/collections/store-design/products/virtusize-app)

### Inferences
- Illustrative, not sourced: 10% commission x $60 basket x 2% of MAU buying per month = ~$0.12 per MAU-month, additive but below subscription ARPU.
- B2B size-API pricing is SMB-scale ($7-$40/month plans), so licensing is small money for a solo studio.

### Gaps
- LTK, Awin, Amazon Associates fashion rates and app-publisher approval terms; per-user affiliate yield; Vinted/Depop/Poshmark API availability; brand partnership rates.

## 6. CAC and organic channels

### Takeaway
Paid CPI is roughly $1-4 generic; Apple Ads CPA ~$2.5-3 for Lifestyle; organic TikTok produced sub-$0.15 installs for one AI closet app. Against $0.70 median lifestyle install LTV, paid acquisition is hard to make profitable.

### Cited Findings
- Apple Ads 2025 average search-results CPA $2.51 (2024: $2.76); 2024 Lifestyle CPA $2.99 (up from $2.53), Shopping $1.74. — [MobileAction](https://www.mobileaction.co/report/apple-ads-2026-benchmark-report/executive-summary/)
- Average CPT in top-15 markets rose from $1.60 (2024) to $2.90 (2025); global median CPT ~ $0.92. — [SplitMetrics](https://splitmetrics.com/apple-search-ads-search-results-benchmarks/); [AppTweak](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- Vietnam and Philippines have lower CPI than US/Japan (no number given). — [AppTweak](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- Generic app CPI $1-4+ by category/region; Meta ~$2.09 and TikTok ~$2.50 (low confidence, no methodology). — [nogood.io](https://nogood.io/blog/tiktok-advertising); [Adapty](https://adapty.io/blog/markdown/how-to-increase-app-downloads.md)
- TikTok ecommerce CPA (purchase, not install): Apparel ~$21.85, Lifestyle/Boutique ~$25.43. — [Triple Whale](https://www.triplewhale.com/blog/tiktok-benchmarks)
- Organic: Fitted and Fitted Laundry grew via founder-led TikTok (section 1).

### Inferences
- With ~2-4% payers and ~$30-40 revenue each, break-even CPI is roughly $0.60-1.60 gross; US paid CPI of $2+ loses money, and low SEA prices worsen it. Organic content and ASO are the only plausible channels for a solo studio.

### Gaps
- No Vietnam CPI numbers; no fashion-specific CPI; no ASO case studies for wardrobe apps found.
