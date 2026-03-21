SCREEN_SPEC:
  id: home.main
  route: "/home"
  design_path: "app/design/screen/home/main/"

  # Layout reference: main.svg in this folder (402×874 reference). Implement responsively; preserve rhythm, not pixel-perfect absolute layout.

  # Polished, luxury, high-end fashion—consistent with home.outfit and home.item.
  aesthetic_direction:
    intent: "Editorial home: calm gradient field, logotype as jewelry, tabs as quiet navigation, outfit as hero object."
    principles:
      - "Restraint: no drop shadows on tabs; cards float via soft translucency and hairline edges, not heavy chrome."
      - "Hierarchy: Playfair logotype is the single serif anchor; Poppins tabs stay light and tracked."
      - "Background: gradient suggests atmosphere (dusk/studio), not a rainbow promo—keep stops muted."
      - "Touch targets: tabs and tappable rows meet minimum comfort sizes even when glyphs look delicate."
      - "Motion: prefer none or subtle crossfade when switching tabs; respect reduced motion."
    background:
      current_gradient:
        type: "linear"
        direction: "top_to_bottom"
        stops:
          - position: 0
            color: "#4D5051"
            opacity: 0.35
          - position: 24
            color: "#DCDCDC"
            opacity: 1.0
        # Positions are 0–100 scale; 24 = 24% from top. Remainder of viewport uses bottom color.
      luxury_alt:
        description: "Optional warmer, softer atmosphere—use if brand shifts to cream/studio."
        top: "#5C5856 @ 28% opacity"
        bottom: "#E8E4E0 @ 100%"
    typography:
      logotype:
        - "Playfair Display Bold; optional slight positive letter-spacing (+0.04–0.08em) for all-caps wordmark—verify legibility."
        - "Comfortable line height if title ever wraps (rare)."
      tabs:
        - "Poppins Thin; 14sp; white @ 100% active, 70% inactive; letter-spacing 10% (0.10em)."

  purpose:
    short: "Show suggested outfits and the user's wardrobe-driven collections."
    details:
      - "Home is the first screen after onboarding is completed."
      - "Outfit suggestions should be based on the user's closet (for now)."
      - "Favourite shows outfits the user marked as favourite."
      - "Closet shows the outfits built from the user's closet items."

  screen:
    status_bar:
      - "Reserve top inset so logotype clears status bar and notch (statusBarsPadding on header column)."
    safe_areas:
      - "Horizontal padding 24dp for scroll content; tabs use wider side inset (40dp) per layout rhythm."

  sections:
    - id: outfit
      title: "Outfit"
      role: "Suggested outfits"
      data_source:
        current_impl: "Only outfits from the user’s closet."
        future: "May include mixes and/or items from online stores/brands/shops."
      cards:
        visual:
          background: "Gradient field + composition card (see composition_placeholder)."
          assets: "Item images in fixed slots; neutral slot backgrounds read as gallery matting."
          composition_placeholder:
            slot_reference_canvas_px:
              width: 500
              height: 570
            scaling_behavior:
              - "Canvas scales uniformly to fit card width and available height so the full 5-slot outfit is visible without inner scroll."
            slots:
              - id: 1
                role: "pants"
                label: "1 Pants"
                size_px: { w: 350, h: 468 }
                position_px: { x: 0, y: 0 }
              - id: 2
                role: "jacket"
                label: "2 Jacket"
                size_px: { w: 150, h: 206 }
                position_px: { x: 350, y: 0 }
              - id: 3
                role: "shirt"
                label: "3 Shirt"
                size_px: { w: 150, h: 206 }
                position_px: { x: 350, y: 206 }
              - id: 4
                role: "bag"
                label: "4 Bag"
                size_px: { w: 102, h: 140 }
                position_px: { x: 350, y: 412 }
              - id: 5
                role: "shoes"
                label: "5 Shoes"
                size_px: { w: 102, h: 102 }
                position_px: { x: 0, y: 468 }
            debug_labels:
              enabled: true
              show_text_inside_each_slot: true
            image_source_support:
              - "URL (http/https) / local file path / file:// URI / content:// URI"
              - "`asset:` scheme for app bundled assets (example: `asset:jeans.png` or `asset:images/jeans.png`)"
        interaction:
          - "Entire outfit card is tappable; semantics: open outfit details (pass payload / id)."
          - "Minimum touch height for the tappable outfit row: 48dp inclusive of padding."
        content:
          - "Render each suggested outfit as a card/row of item images."
          - "For MVP: show only closet-based outfits."

    - id: favourite
      title: "Favourite"
      role: "User curated outfits"
      data_source:
        current_impl: "User-selected/favourited outfits."
      cards:
        content:
          - "Render favourited outfits using the same outfit card visuals where possible."
        placeholder_luxury:
          - "List rows: translucent panel + hairline border (white ~25% opacity), rounded corners ~12dp, min height ~180dp; label in Poppins Semibold 14sp white."

    - id: closet
      title: "Closet"
      role: "User's built outfits"
      data_source:
        current_impl: "Outfits built from items in the user’s closet."
      cards:
        content:
          - "Render closet outfits using the same outfit card visuals where possible."
        placeholder_luxury:
          - "Same placeholder treatment as Favourite for consistency."

  layout:
    header:
      title: "TRUE CLOTHES"
      style:
        font:
          family: "Playfair Display"
          weight: "Bold"
        color: "#FFFAFA"
        size_sp: 28
        line_height_sp: 40
        optional_letter_spacing_em: 0.06
    body:
      type: "menu_sections"
      tabs:
        - id: outfit
          label: "Outfit"
          style:
            font:
              family: "Poppins"
              weight: "Thin"
              color_active: "#FFFFFF"
              color_inactive: "#FFFFFF"
              inactive_opacity: 0.7
        - id: favourite
          label: "Favourite"
          style:
            font:
              family: "Poppins"
              weight: "Thin"
              color_active: "#FFFFFF"
              color_inactive: "#FFFFFF"
              inactive_opacity: 0.7
        - id: closet
          label: "Closet"
          style:
            font:
              family: "Poppins"
              weight: "Thin"
              color_active: "#FFFFFF"
              color_inactive: "#FFFFFF"
              inactive_opacity: 0.7
      tabs_layout:
        horizontal_padding_dp: 40
        vertical_padding_dp: 70
        letter_spacing_em: 0.10
        font_size_sp: 14
        selection_indicator:
          description: "Active tab only: white hairline under label."
          gap_below_text_dp: 5
          stroke_width_dp: 1.5
          color: "#FFFFFF"
          length: "From line start to the left edge of the final glyph (does not sit under the last letter); derived from text layout."
        touch:
          min_height_dp: 48
          horizontal_padding_each_tab_dp: 4
      active_content: "Show the list/cards for the selected tab."
    footer:
      type: "none_for_mvp"

  behavior:
    - "The 3 buttons represent 3 different menus: Outfit, Favourite, Closet."
    - "Tapping a menu button switches the content below to the corresponding section."
    - "Tapping an outfit card/button in the Outfit section navigates to the outfit detail screen (`/home/outfit/{outfitId}`) with outfit payload."
    - "Active tab: full-opacity white; inactive: 70% opacity."
    - "Tabs expose selected state to accessibility (e.g. 'Outfit, selected')."
    - "For MVP, outfit suggestions are limited to closet-based outfits only."

  responsive_layout:
    - "Keep header and tabs visible; body scrolls (LazyColumn)."
    - "Use scaled dimensions; see app/design/responsive-ui.md if present."
    - "Avoid horizontal scroll; composition card scales down uniformly on narrow widths."
    - "Verify ~320dp width: tabs do not collide—allow wrap only if spec later changes (default single row with SpaceBetween)."

  # Alignment with `.agents/skills/ui-ux-advicer/SKILL.md` (Compose translation).
  ux_skill_reference:
    accessibility:
      - "Logotype and tabs on gradient: verify contrast for white/thin text on upper gradient stop."
      - "Tab row: merge or label semantics so screen reader announces selected tab."
      - "Tappable outfit card: contentDescription names action (open outfit) not only 'image'."
    touch_and_interaction:
      - "Each tab: minimum 48dp hit height; expand width with horizontal padding on label."
      - "Ripple or alpha feedback on tab and card press (Material defaults acceptable)."
    performance:
      - "LazyColumn for lists; prefer keys when outfit ids exist."
    typography:
      - "Thin tab labels at 14sp: if contrast fails on devices, bump weight to ExtraLight or increase inactive opacity floor to 0.75."
    motion:
      - "Tab switch: content swap without aggressive animation; respect reduced motion."

  notes:
    - "Home background gradient (default): linear top→bottom; `#4D5051` @ 35% at stop 0; `#DCDCDC` @ 100% at stop 24 (0–100); solid `#DCDCDC` below that."
    - "Once backend data is connected, sections reuse the same card UI for instant tab switches."
    - "Luxury is consistency with outfit/item detail: same font pairing discipline and quiet surfaces."
