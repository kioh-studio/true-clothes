export const meta = {
  name: 'body-shape-verify-continue',
  description: 'Continue body-shape research: Sonnet-verify remaining claims + synthesize report',
  phases: [
    { title: 'Verify', detail: '1 Sonnet skeptic vote per remaining claim', model: 'sonnet' },
    { title: 'Synthesize', detail: 'Sonnet merges all verified claims into cited report', model: 'sonnet' },
  ],
}
// State embedded at authoring time (2026-07-06) from docs/research/body-shape-research-state.json.
// Workflow scripts have no filesystem access, so the data is inlined.
const STATE = {
"question": "How important is body shape (hourglass/pear/apple/rectangle/inverted-triangle) as a criterion in outfit styling and clothing recommendations, according to professional stylists, fashion educators, and fashion industry practice? Cover: (1) the classic body-shape dressing framework (balance/proportion rules like A-line for pear, defined waist for hourglass) and how much weight professional stylists actually give it versus other factors (color, personal style, fit preference, occasion, proportion, current trends); (2) modern critiques — is \"dress for your body type\" considered outdated/harmful by contemporary stylists, and what do they use instead (Kibbe body types, proportion/line theory, style essence, body neutrality)? (3) evidence on what consumers/users actually respond to in fit/styling advice and what drives purchase-fit satisfaction; (4) how fashion-tech apps and styling services (Stitch Fix, personal styling AI apps) weight body shape in their recommendation algorithms if known. Goal: decide how much weight a fashion recommendation app should give body shape when scoring outfits (currently ~1% of composite score) and when evaluating a prospective purchase (currently ~2.5-5%). Vietnamese market context is a plus but global/Western stylist practice is the main interest.",
"confirmed": [
{
"claim": "In a survey of 316 South African women evaluating casual clothing, fit/sizing and comfort were the most important evaluative criteria across all three clothing categories (blouse/top, skirt/trousers, dress), statistically outweighing style/design, colour/pattern, appearance, appropriateness and material.",
"source": "https://intellectdiscover.com/content/journals/10.1386/fspc_00117_1",
"quote": "Across all three clothing categories, fit/sizing and comfort were the most important evaluative criteria, statistically equally important and differ significantly from the proportions of other evaluative criteria for a casual blouse, skirt/trousers and dress.",
"vote": "3-0"
},
{
"claim": "The statistically significant associations found between a woman's perceived body shape and which evaluative criteria she prioritizes were small in effect size, indicating body shape only modestly modulates purchase criteria relative to universal factors like fit and comfort.",
"source": "https://intellectdiscover.com/content/journals/10.1386/fspc_00117_1",
"quote": "These associations were small but significant, and South African fashion designers may need to consider that women with these body shapes may be less satisfied with current casual retail clothing designs",
"vote": "3-0"
},
{
"claim": "According to this apparel-industry chapter, poor clothing fit is a major consumer frustration and a barrier to online apparel sales growth, and the root cause is brands' failure to understand and address body SHAPE, not deficiencies in size/measurement systems — implying body shape is a materially important variable for purchase-fit satisfaction.",
"source": "https://www.sciencedirect.com/science/article/abs/pii/B9781782422105500013",
"quote": "Apparel fit remains a major consumer frustration and barrier to online sales growth, not because of sizes and measurements, but because few brands and retailers properly understand and address body shape.",
"vote": "3-0"
},
{
"claim": "In a study of 107 female consumers, the correlation between lower-body fit satisfaction and lower-body cathexis (feelings about one's own body) was statistically significant, indicating that satisfaction with clothing fit is driven partly by body image/psychology, not only by garment geometry — relevant evidence that fit-satisfaction interventions must account for how users feel about specific body areas.",
"source": "https://journals.sagepub.com/doi/10.1177/0887302X9000800206",
"quote": "Correlation for lower body fit satisfaction and lower body cathexis was statistically significant, confirming a relationship between the respondents' satisfaction with fit and feelings towards personal body.",
"vote": "3-0"
},
{
"claim": "Song & Ashdown (2013) argue that consumers' self-determined body size and shape is not reliable, because self-assessment rests on subjective perception rather than measurement — implying an app should not fully trust user-declared body shape as a scoring input.",
"source": "https://www.researchgate.net/publication/274167953_Female_Apparel_Consumers'_Understanding_of_Body_Size_and_Shape_Relationship_Among_Body_Measurements_Fit_Satisfaction_and_Body_Cathexis",
"quote": "\"response to their body shape is based on personal perceptions and subjective judgments of their own body which may impact reliability\" (Song & Ashdown, 2013; quoted verbatim in Monge, NCSU thesis)",
"vote": "3-0"
},
{
"claim": "The study explicitly modeled garment fit satisfaction as related to body cathexis (feelings about one's body) and self-perception at each body location, motivated by apparel companies' difficulty understanding fit from the consumer's perspective — i.e., fit satisfaction is driven by body attitudes, not just objective measurement match.",
"source": "https://www.researchgate.net/publication/274167953_Female_Apparel_Consumers'_Understanding_of_Body_Size_and_Shape_Relationship_Among_Body_Measurements_Fit_Satisfaction_and_Body_Cathexis",
"quote": "This study also analyzed the relationship between garment fit satisfaction, body cathexis, and self-perception for each body location because apparel companies have had difficulty in understanding fit from the consumer's perspective. (abstract, reconstructed from OpenAlex)",
"vote": "3-0"
},
{
"claim": "Stitch Fix models fit not as a categorical body-shape label but as a multidimensional latent feature of each client and each garment, learned by the algorithm.",
"source": "https://algorithms-tour.stitchfix.com/",
"quote": "in this illustration we're treating fit as unidimensional for simplicity, but in fact at Stitch Fix we treat it as multidimensional",
"vote": "3-0"
},
{
"claim": "Fit placement for clients and styles is inferred from behavioral data (fit feedback and purchase histories) rather than from declared sizes or body-shape self-reports alone.",
"source": "https://algorithms-tour.stitchfix.com/",
"quote": "With clients' fit feedback and purchase histories, we can learn where particular clients and styles fall along this spectrum.",
"vote": "3-0"
},
{
"claim": "Declared size information is treated as insufficiently precise for fit matching, motivating learned fit preferences over static body/size categories.",
"source": "https://algorithms-tour.stitchfix.com/",
"quote": "a new client may tell us that she wears medium-sized blouses, but where exactly would her preference fall along the spectrum of smallish mediums to largish mediums?",
"vote": "2-0"
}
],
"refuted": [
{
"claim": "Stitch Fix's own 2023 description of its generative-AI styling pipeline lists client textual feedback about fit, style preferences, and occasion as key recommendation inputs, but never mentions body-shape categories (hourglass/pear/apple/rectangle) or body measurements as inputs — suggesting the company frames personalization around expressed fit/style feedback rather than a geometric body-shape framework.",
"vote": "0-3",
"source": "https://newsroom.stitchfix.com/blog/how-were-revolutionizing-personal-styling-with-generative-ai/"
}
],
"unverified": [
{
"claim": "In quantitative evaluation on real catalog data, body-shape-aware recommendation (ViBE) outperformed a body-agnostic embedding by roughly 7-10 AUC points on garment suitability prediction for unseen persons and garments (dresses: 0.65 vs 0.55 AUC; tops: 0.60 vs 0.53 AUC), indicating body shape carries measurable but moderate signal beyond shape-agnostic features.",
"source": "https://arxiv.org/pdf/1912.06697"
},
{
"claim": "The paper asserts that mainstream fashion recommendation systems as of 2019-2020 largely ignored body shape entirely, taking a 'one shape fits all' approach driven by dataset bias toward thin/tall models.",
"source": "https://arxiv.org/pdf/1912.06697"
},
{
"claim": "Fit problems are claimed to be the leading cause of online apparel returns and a frequent determinant of purchase decisions, supporting a higher body-shape/fit weight in purchase evaluation than in general outfit styling.",
"source": "https://arxiv.org/pdf/1912.06697"
},
{
"claim": "The advantage of body-shape-aware recommendation is not uniform: it grows substantially for 'body-specific' garments (e.g., fitted dresses) and is smaller for garments that suit most bodies, implying body shape should be weighted conditionally by garment type rather than as a flat score component.",
"source": "https://arxiv.org/pdf/1912.06697"
},
{
"claim": "David Kibbe's 1987 book Metamorphosis introduced an alternative system of 13 body types organized on a yin/yang (curved vs. angular) spectrum across 5 categories (dramatics, classics, naturals, gamines, romantics), and this system resurfaced in popularity in the 2020s via social media — supporting the premise that Kibbe types are a live alternative to the fruit-shape framework.",
"source": "https://en.wikipedia.org/wiki/Dressing_by_body_type_in_women"
},
{
"claim": "A professional fashion educator (founder of the Australian Style Institute) says classic body-shape categories have only limited value: knowing your category can be helpful but only as a generalised guide, not as a customised styling solution or strategy.",
"source": "https://fashionjournal.com.au/fashion/dressing-for-body-type/"
},
{
"claim": "Contemporary stylists view body-shape dressing rules as psychologically burdensome and unrealistic for consumers, i.e., the 'dress for your body type' framework is considered harmful, not just outdated.",
"source": "https://fashionjournal.com.au/fashion/dressing-for-body-type/"
},
{
"claim": "Stylists argue generalised body-shape rules should be replaced by personalised information matched to current fashion sizing and availability — implying a recommendation system should weight individualised fit data over body-shape category rules.",
"source": "https://fashionjournal.com.au/fashion/dressing-for-body-type/"
},
{
"claim": "The classic fruit body-shape system (hourglass/pear/apple/rectangle/inverted-triangle) is built on the premise that the hourglass is the ideal silhouette and that dressing well means approximating it, making all its advice corrective in nature.",
"source": "https://www.joellecq.co/post/your-body-shape-and-your-kibbe-type-are-not-the-same-thing"
},
{
"claim": "A single traditional body shape category is not sufficient to determine styling: people with the same fruit-shape classification can belong to several different Kibbe types because their lines, proportions, and visual impression genuinely differ — implying body-shape category alone has low predictive value for what will look good.",
"source": "https://www.joellecq.co/post/your-body-shape-and-your-kibbe-type-are-not-the-same-thing"
},
{
"claim": "Contemporary stylist practice (as represented by this author) replaces deficit-based body-shape correction with line-based analysis (Kibbe yin/yang), which asks what lines the body naturally creates and aims to align clothing with the body's natural balance rather than override it.",
"source": "https://www.joellecq.co/post/your-body-shape-and-your-kibbe-type-are-not-the-same-thing"
},
{
"claim": "Stitch Fix collects body shape as one explicit input among roughly five categories in its onboarding style profile (measurements, sizes, body shape, style/fit preferences, price), gathered via a ten-minute questionnaire — i.e., body shape is a first-class but non-dominant profile feature.",
"source": "https://digit.hbs.org/submission/stitch-fix-a-marriage-of-art-and-science"
},
{
"claim": "In Stitch Fix's system the algorithm's recommendations (which include body-shape-informed matching) are not final: a human stylist reviews the AI output and makes the ultimate item selection, showing that even a data-heavy styling service does not let profile attributes like body shape mechanically drive outcomes.",
"source": "https://digit.hbs.org/submission/stitch-fix-a-marriage-of-art-and-science"
},
{
"claim": "Even this dedicated body-shape dressing guide explicitly qualifies the framework's importance, stating that body shape theory is outdated to some degree and is best treated as a limited tool for concealing or balancing specific body parts rather than a comprehensive styling system.",
"source": "https://theconceptwardrobe.com/build-a-wardrobe/hourglass-body-shape"
},
{
"claim": "The classic dressing rule for the hourglass shape is balance-based: maintain the body's natural proportions by dressing the top and bottom proportionally and accentuating the defined waist.",
"source": "https://theconceptwardrobe.com/build-a-wardrobe/hourglass-body-shape"
}
]
}

const VERDICT = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    evidence: { type: 'string' },
  },
  required: ['refuted', 'evidence'],
}

phase('Verify')
const votes = await parallel(STATE.unverified.map((c, i) => () =>
  agent(
    `## Adversarial claim verifier (single vote — be balanced, not trigger-happy)

` +
    `Research question: ${STATE.question.slice(0, 400)}...

` +
    `CLAIM to check:
"${c.claim}"

Source: ${c.source}

` +
    `Try to verify this claim against its source (WebFetch the URL; if paywalled/unreachable, search for the abstract or secondary coverage). ` +
    `Mark refuted=true ONLY if the source clearly does not support the claim or contradicts it. ` +
    `If the source supports it (even partially, note caveats in evidence), refuted=false. ` +
    `Return evidence: 1-3 sentences with what you actually found.`,
    { label: `verify:${i}`, phase: 'Verify', schema: VERDICT, model: 'sonnet', effort: 'low' }
  ).then(v => ({ ...c, vote: v }))
))

const verified = votes.filter(Boolean).filter(v => v.vote && !v.vote.refuted)
const newlyRefuted = votes.filter(Boolean).filter(v => v.vote && v.vote.refuted)
log(`Verify done: ${verified.length} upheld, ${newlyRefuted.length} refuted of ${STATE.unverified.length}`)

phase('Synthesize')
const report = await agent(
  `## Synthesis: cited research report (viết bằng TIẾNG VIỆT, quotes giữ tiếng Anh)

` +
  `Question: ${STATE.question}

` +
  `CONFIRMED CLAIMS (3-0 adversarial votes, high confidence):
${JSON.stringify(STATE.confirmed)}

` +
  `NEWLY VERIFIED (1 Sonnet vote, medium confidence):
${JSON.stringify(verified)}

` +
  `REFUTED (do not use as support):
${JSON.stringify(STATE.refuted.concat(newlyRefuted.map(r => ({claim: r.claim, source: r.source, evidence: r.vote.evidence}))))}

` +
  `Write a decision-ready report for the MIEN app team answering: how much weight should body shape get ` +
  `(a) in outfit-composite scoring (currently ~1/100 points) and (b) in prospective-purchase evaluation (currently ~2.5/100)? ` +
  `Structure: TL;DR recommendation with concrete weight ranges -> evidence by theme (stylist practice, modern critiques, consumer research, fashion-tech practice incl. Stitch Fix + ViBE) -> ` +
  `confidence notes (which claims are 3-0 vs 1-0 verified) -> concrete engine suggestions for MIEN. Mark every claim with its source URL. Be honest about limits of the evidence.`,
  { label: 'synthesize', phase: 'Synthesize', model: 'sonnet' }
)

return { report, upheld: verified.length, refuted: newlyRefuted.length, details: { verified, newlyRefuted } }
