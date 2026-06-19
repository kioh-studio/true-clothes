# Feature

## Clarifications

### Session 2026-06-07

- Q1: Auth methods for MVP → A: Phone and Email only ( no Apple / Google for MVP ).
- Q2: Session lifetime → A: Persistent until explicit logout ( no time-based expiry ).
- Q3: Multi-device sessions → A: Allow concurrent sessions across multiple devices.
- Q4: What is "username" → A: Non-unique display name.
- Q5: Age handling → A: Store DOB; soft 13+ age gate at signup.
- Q6: OTP channel priority → A: Email OTP is primary for launch; phone OTP deprioritized until an SMS provider is chosen.
- Q7: Measurement field set → A: 15-field set is canonical, upper_arm = bicep; each field gets a tap-to-open tooltip ( text + animation ) explaining what it is and how to measure.
- Q8: AI camera method → A: On-device pose estimation ( free, private ).
- Q9: AI camera output → A: Ratio-based editable best-guesses that pre-fill the measurement fields; user can correct.
- Q10: Scale anchor → A: Anchored on the user's entered height.
- Q11: AI camera pricing → A: Free for everyone.
- Q12: Body shape → A: Compute & store a body-shape classification used by the fit engine, with manual override.
- Q13: Personal color method → A: Questionnaire-based, on a separate screen that only opens when the user taps the detect button.
- Q14: Personal color taxonomy → A: Classic 4 seasons ( also store undertone ).
- Q15: Detected colors storage → A: Separate "personal palette" field, merged with manual favorites for display.
- Q16: Personal palette in engine → A: Feeds the fit engine ( boosts matching outfits ).
- Q17: Personal color pricing → A: Free for everyone.
- Q18: Style suggestions → A: Static curated related-styles for MVP plus behavior-event logging now to enable learned suggestions later; engine strictly prioritizes the user's selected styles.
- Q19: Style catalog → A: Server-driven ( Supabase table, expandable without an app release ).
- Q20: Style selection limits → A: Min 1, max 5.
- Q21: Clean-background extraction → A: On-device segmentation ( free, offline ).
- Q22: Worn-outfit extraction → A: Paid cloud AI, gated by the free-tier limit; draft the extraction prompt as a deliverable.
- Q23: AI provider → A: Multimodal LLM ( Claude vision ) for identification + attributes, paired with on-device segmentation for the PNGs.
- Q24: Free image limit semantics → A: 2 worn-outfit AI scans per month, counted per uploaded photo.
- Q25: Per-image notes → A: Free text appended verbatim, fenced as user context in the prompt.
- Q26: Per-item attributes → A: Mandatory: category, name, primary color, photo ( PNG ); optional: additional colors, material, brand, size, pattern, warmth / season, notes.
- Q27: Extraction failure → A: Show partial results, allow manual fix, one free retry on the same photo, do not consume a credit on failure.
- Q28: Original photo retention → A: Discard the original uploaded photo after successful extraction.
- Q29: Item categories → A: Add dress / one-piece ( engine builds one-piece + shoes combos ) and headwear under accessories; keep top / bottom / outerwear / footwear / accessory.
- Q30: Collections group → A: Wardrobe items ( reconcile code which currently uses outfits ).
- Q31: Collections & suggestions → A: Can optionally scope the suggestion pool; default = whole wardrobe.
- Q32: Collections persistence → A: Persist server-side ( new Supabase table ).
- Q33: Collection limits → A: No max collections, no minimum items, an item can belong to multiple collections ( many-to-many ).
- Q34: Cold start → A: Prompt to add items, with labeled demo looks so the screen isn't empty.
- Q35: Feed paging → A: Generate 10 outfits per request; on scrolling through all 10, request 10 more; keep a local cache of generated outfit IDs and send them so the engine excludes repeats.
- Q36: Feed performance → A: ~1.5s per batch of 10; cache last batch locally for instant paint + dedup; marking an outfit "worn today" suppresses it from suggestions for one week.
- Q37: Outfit rendering → A: Item-PNG collages for MVP; AI try-on deferred as a labeled future enhancement.
- Q38: AI chat parsing → A: LLM parses prompt → fills IntentContext → existing rule engine ranks.
- Q39: AI chat turns → A: Multi-turn conversation, accumulating intent across turns.
- Q40: AI chat provider → A: Claude, cheapest model ( Haiku ) for the parse; paid-tier feature with a small free monthly allowance.
- Q41: AI chat scope → A: Constrained to owned wardrobe items only; chat states when the wardrobe can't satisfy the request.
- Q42: AI chat phasing → A: Deferred to a fast-follow phase ( not MVP ); keep IntentContext scaffolding.
- Q43: Formula meaning → A: User-chosen generation strategy; single-select; global default in profile, overridable per-feed.
- Q44: Formula catalog → A: Server-driven; user-facing with plain-language names + one-line explanations.
- Q45: Location detection → A: Wire real GPS ( expo-location ) with manual city override; clear permission copy.
- Q46: Location fallback → A: On permission-denied, manual city entry ( no IP geolocation ); refresh weather on both significant location change and the 30-min timer.
- Q47: Tier model → A: Two tiers. Free: full wardrobe + CRUD, rule-engine feed, manual builder, collections, camera measurement, personal color, 2 worn-outfit AI scans / month, small AI-chat allowance. Paid: unlimited / higher worn-outfit AI scans, full AI chat, future premium ( AI try-on ).
- Q47a: Billing → A: App Store / Google Play in-app purchase ( subscription product ).
- Q48: Profile identity → A: Wire real display name; include avatar upload ( reuse wardrobe photo + Supabase Storage pattern ); default avatar if unset.
- Q49: Outfit persistence → A: Persist saved / worn / scheduled outfits server-side.
- Q50: Offline behavior → A: Read-only offline ( browse wardrobe + cached feed; server actions wait for connection ).
- Q51: Localization → A: i18n from the start — Vietnamese + English.
- Q52: Privacy → A: Add an explicit consent note at measurement / camera capture, and allow deleting measurements / photos separately from account deletion.


## Onboarding

- User can create new account, using their mobile phone number or Email ( these two only for MVP — no Apple / Google login yet ). The login uses OTP with 6 code
digits. Email OTP is the primary channel for launch; phone OTP is deprioritized until an SMS provider is chosen.
- Once they are login, next time they enter the app on the same device they will not have to login again — the session is persistent until explicit logout
( no time-based expiry ). Concurrent sessions across multiple devices are allowed, so logging in on another device does not log out the first one. After explicit
logout they have to login again.
- When create new account, user have to go through screen :
+ overview info : collect username, age, gender, location. Username is a non-unique display name. Age is stored as a date of birth ( DOB ), with a soft 13+ age gate
at signup. Location is collected to know where the user is, so we have more knowledge about the weather context to suggest clothes based on weather.
+ measurement : on this screen, we collect the user's required measurement as height and weight. Additional top and bottom detail measurement ( neck, inseam, sleeves,
bicep, ... ) are optional, used to determine the user's body shape and to give more detailed, better item suggestions. The canonical set is 15 fields ( height, weight,
bust, waist, hip, inseam, thigh, rise, shoulder width, sleeve length, upper body length, upper arm ( = bicep ), neck, foot length, foot width ) plus a preferred fit.
  + Each measurement field has a tap-to-open tooltip with explanatory text and a small animation showing what the measurement is and how to measure it.
  + From this body data we compute and store a body-shape classification that the fit engine uses; the user can manually override it.
  + We also provide a button for the user to use the app camera to auto-detect their measurement. This uses on-device pose estimation ( free and private, nothing
  leaves the device ) with a body skeleton-like shape to estimate the user. The camera produces ratio-based best-guesses, anchored on the user's entered height, that
  pre-fill the measurement fields as editable values so the user can correct them.
  + Because this collects sensitive body data, we show an explicit consent note at the measurement / camera capture step. The user can later delete their measurements
  and capture photos separately from deleting their account.
+ Color : we provide many colors for the user to pick what they favorite. At the end there is a button that opens a separate "detect personal color" screen ( only
opens when the user taps that button ). Detection is questionnaire-based ( eye color, natural hair, vein tone, ... — no photo required ). The result is a classic
4-season classification ( Spring / Summer / Autumn / Winter ) and we also store the undertone ( warm / cool / neutral ).
  + The detected colors are kept as a separate "personal palette" field, merged with the manually picked favorites for display. We help the user preview the palette
  before saving it. The personal palette feeds the fit engine to boost outfits that match it. Personal color detection is free for everyone.
+ Style : user picks their favourite styles here. Based on some basic and common styles, we suggest more related styles ( static curated suggestions for MVP ) so we
have more knowledge and tags on how the user would like. Selection is min 1, max 5 styles. We log lightweight behavior events from the start so we can move to learned
suggestions later. The fit engine strictly prioritizes the user's selected styles rather than weighting all styles equally. The style catalog is server-driven
( a Supabase table ) so it can expand without an app release.
+ Wardrobe, last screen for user to add their existing clothes items to their wardrobe so we can suggest based on their wardrobe. User can choose to import existing
images or use the camera to capture :
  + Capture an image of an item on a white or monochrome background — we run on-device segmentation ( free, offline ) to extract it into a no-background PNG.
  + OR the user uploads an existing image of an item ( maybe not on a monochrome background, or an image of the user wearing the outfit ). For this we use a paid cloud
  AI ( a multimodal LLM — Claude vision ) to identify each worn item and its attributes, paired with on-device segmentation to produce the per-item PNGs. This path is
  gated by the free-tier limit : a free user gets 2 worn-outfit AI scans per month, counted per uploaded photo.
  + After import or capture, the user goes to a preview screen showing their images in a list. Each image has a text box on its right for notes, where the user can
  describe the image ( Ex: which item to extract, measurement of items, how it is used, ... ). When AI is used, these notes are appended verbatim to its prompt, fenced
  as user context.
  + After AI or script handling, the user receives a list of items with the overview info detected ( color, item name, ... ). Each item carries mandatory attributes —
  category, name, primary color, and a PNG photo — plus optional attributes : additional colors, material, brand, size, pattern, warmth / season, and notes. User can
  click each item to add more information.
  + If extraction fails or is low-confidence, we show the partial results and let the user fix them manually. The user gets one free retry on the same photo, and a
  failure does not consume a scan credit.
  + After a successful extraction we discard the original uploaded photo and keep only the resulting item PNGs.
  + Item categories are : top, bottom, outerwear, footwear, accessory, plus dress / one-piece ( the engine builds one-piece + shoes combos ) and headwear ( grouped
  under accessories ).

- User can choose to skip the Color, Style and Wardrobe steps.
- The first 2 steps ( overview info and measurement ) are required.


## Wardrobe

- Each user has one wardrobe, which contains all the clothing items the user owns. Based on these items, the system can suggest outfits for the user
each time they enter the app.
- User can CRUD ( create, read, update, delete ) the items in their wardrobe.
- User can create collections from their wardrobe items. A collection is a group of wardrobe items the user thinks belong together ( Ex: items that match well, items
for a specific occasion, ... ), user can add a title and description to each collection.
  + An item can belong to multiple collections ( many-to-many ). There is no maximum number of collections and no minimum number of items per collection.
  + A collection can optionally scope the suggestion pool, so the feed only draws from that collection's items; by default suggestions use the whole wardrobe.
  + Collections are persisted server-side ( a Supabase table ).
- Each wardrobe item has its own detail page, containing its image, measurements, color, brand, ... so user can view and manage every detail of the item.


## Suggest Outfit

- Each time the user enters the app, they see outfits suggested for them, based on the weather context, their wardrobe, their style, their color ( including their
detected personal palette ) and their body shape.
- The feed generates 10 outfits per request. When the user scrolls through all 10, it requests 10 more. The app keeps a local cache of already-generated outfit IDs and
sends them with each request so the engine excludes them and never repeats. The target latency is ~1.5s per batch of 10, and the last batch is cached locally for
instant paint and dedup.
- Marking an outfit "worn today" suppresses it from suggestions for one week ( a cooldown ).
- On cold start ( empty or sparse wardrobe ), we prompt the user to add items, and show labeled demo looks so the screen isn't empty.
- Clicking an outfit leads to the Outfit Detail screen, where user can see the full outfit and all the items it is made of.
- Clicking an item inside the outfit detail leads to that item's detail page.
- Outfits are rendered as item-PNG collages for MVP. AI try-on rendering is a labeled future enhancement.
- Beside the suggested outfits, user can pick items themselves and build an outfit from those picked items.
- User can change their style / color to get new outfit suggestions tuned to the new choice.
- User can also choose a formula to guide how outfits are generated ( e.g. Color Harmony, Rule of Thirds, Proportion Balance ). Formula is single-select; it is a
global default set in the profile, overridable per-feed on the suggest screen. The formula catalog is server-driven and user-facing, with plain-language names and a
one-line explanation each.
- ( Fast-follow, not MVP ) User can also type into an AI chat so the engine builds an outfit for them based on their prompt
( Ex: "i wanna look good on my friend's wedding, better not a pure suit, i wanna look elegant but still modern and young" ). The chat is multi-turn and accumulates
intent across turns ( e.g. "swap the shoes" ), parsing the prompt into an IntentContext that the existing rule engine then ranks. It is constrained to the user's owned
wardrobe items, and states clearly when the wardrobe can't satisfy the request. It runs on Claude's cheapest model ( Haiku ) for the parse and is a paid-tier feature
with a small free monthly allowance. The IntentContext scaffolding ships in MVP even though the chat UI is deferred.


## Location & Weather

- We use real GPS ( expo-location ) to detect the user's location, with a manual city override and clear permission copy.
- If the location permission is denied, the user enters their city manually ( no IP geolocation ).
- Weather refreshes on both a significant location change and a 30-minute timer, and is used as context for outfit suggestions.


## Plans & Monetization

- Two-tier model, billed via App Store / Google Play in-app purchase ( a subscription product ).
- Free tier : full wardrobe + CRUD, the rule-engine outfit feed, the manual outfit builder, collections, camera measurement, personal color detection, 2 worn-outfit
AI scans per month, and a small AI-chat allowance.
- Paid tier : unlimited / higher worn-outfit AI scans, full AI chat, and future premium features ( e.g. AI try-on ).


## Platform & Data

- Profile : real, editable display name and an avatar upload ( reusing the wardrobe photo + Supabase Storage pattern ); a default avatar is used if the user doesn't set one.
- Persistence : saved, worn and scheduled outfits are persisted server-side ( not just locally ).
- Offline : read-only offline — the user can browse their wardrobe and the cached feed, while server actions wait for the connection to return.
- Localization : i18n from the start, supporting Vietnamese and English.
- Privacy : body measurements and capture photos are sensitive; we show an explicit consent note at capture, and the user can delete their measurements / photos
separately from deleting their account.


## Open / Deferred Work

- Schema drift : the Supabase migration files do not match the live database. The service layer ( wardrobeService ) reads a `wardrobes` table joined via
`clothing_items.wardrobe_id`, while the migrations reference `clothing_items.user_id` ( and there is no `wardrobes` migration ). We still need to apply the new
collections migration to the live project, and verify / reconcile the live schema against the migration files so they become the source of truth again.
- "Add to Collection" on the outfit detail screen : it still adds an outfit to a collection, which is inconsistent now that collections hold wardrobe items.
Decide whether to repurpose it to "add this outfit's items to a collection" ( with a collection picker ) or remove it.
- Collection management UI : the +/edit icons on the collection list and detail screens are visual-only. The store actions ( create / rename / delete / add item /
remove item ) exist, but the create / rename / add-item sheets are not wired yet — build them.
