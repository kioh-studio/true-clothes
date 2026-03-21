SCREEN_SPEC:
  id: home.item
  route: "/home/item/{itemId}"
  design_path: "app/design/screen/home/item/"
  reference_assets:
    - "item.png"
    - "item.svg"

  # Layout: Item detail screen. Hero image is full-bleed width; content scrolls below.
  screen:
    background_color: "#F5F5F5"

  purpose:
    short: "Show full item identity, purchase/source link, and category-specific product measurements."
    details:
      - "Opened when the user taps an item to see detail (e.g. from outfit detail or closet)."
      - "Item name is the full product title, not the shorter overview line used in lists."
      - "Measurements depend on item category (top, bottom, outwear, shoes, accessory); only show rows that apply."
      - "Item link opens the canonical product URL (in-app browser or external—implementation TBD)."

  layout:
    hero_banner:
      purpose: "Large product photo; primary visual anchor."
      width: "100% of screen width (edge-to-edge, no horizontal inset)."
      height_dp: 486
      image:
        fit: "cover preferred for banner feel; if product must never crop, use centerCrop with safe focal or fit with letterboxing (TBD)."
        scale_type_notes:
          - "Prefer consistent aspect treatment so the 486dp region does not jump between items."
      behavior:
        - "Optional: subtle parallax or pinned collapse on scroll is out of scope unless specified later."
        - "Hero is flush to the top of the scroll (no band above the image). Primary back control sits over the image with status-bar padding."
        - "Top gradient scrim (~140dp, black ~55% to transparent) under back affordance for contrast on varied photos; back label is white."

    content_scroll:
      type: "vertical_scroll"
      padding_horizontal_dp: 28
      sections_top_to_bottom:
        - item_identity
        - item_link
        - measurements

    item_identity:
      spacing_below_banner_dp: 24
      item_full_name:
        purpose: "Full product name (complete title)."
        style:
          font:
            family: "Playfair Display"
            weight: "Bold"
          color: "#000000"
          size_sp: 22
        behavior:
          - "Allow multiple lines; do not truncate for this screen."
      item_color:
        spacing_below_name_dp: 12
        style:
          font_family: "Poppins"
          font_weight: "Light"
          size_sp: 20
          color: "rgba(0,0,0,0.5)"
        presentation:
          - "Show color value only (no visible 'Color:' prefix), matching outfit-detail item row aesthetic."
          - "Expose 'Color: {value}' in accessibility text."
      brand_name:
        spacing_below_color_dp: 8
        style:
          font_family: "Poppins"
          font_weight: "Medium"
          size_sp: 15
          color: "#000000"
        label:
          pattern: "Brand: {value}"

    item_link:
      spacing_above_dp: 20
      spacing_below_dp: 28
      control:
        type: "text_button_or_underlined_link"
        text: "View product link"  # or "Open product page" — final copy TBD
      style:
        font_family: "Poppins"
        font_weight: "SemiBold"
        size_sp: 16
        color: "#000000"
        underline: true
      accessibility:
        - "Expose destination hostname or product title in semantics if helpful (e.g. contentDescription)."
      behavior:
        - "If URL missing, hide control or show disabled state with explanation (TBD)."

    measurements:
      purpose: "Readable, scannable specs; no dense spreadsheet on mobile."
      ux_recommendation:
        format: "sectioned_label_value_rows"
        rationale:
          - "Use one section titled 'Measurements' (or 'Size details') with a short unit line (e.g. 'All values in cm') when the API stores a single unit."
          - "Each measurement is one row: label left, value right-aligned on the same row (or value below label on very narrow widths if wrapping fights readability)."
          - "Show only fields that exist for this item’s category—omit empty rows to reduce noise."
          - "Avoid multi-column tables; they are hard to scan on phones and conflict with dynamic font sizes."
          - "Optional: group with a subtle divider between logical groups (e.g. upper body vs length) only if design needs it; default is a flat list ordered consistently per category."
        visual:
          row_min_height_dp: 48
          label_style:
            font_family: "Poppins"
            font_weight: "Regular"
            size_sp: 14
            color: "rgba(0,0,0,0.55)"
          value_style:
            font_family: "Poppins"
            font_weight: "Medium"
            size_sp: 14
            color: "#000000"
          divider_between_rows:
            thickness_dp: 0.3
            color: "#000000"
            opacity: 0.15
      category_fields:
        # Only render keys present in data for the item’s category.
        top:
          - key: chest
            label: "Chest"
          - key: sleeves
            label: "Sleeves"
          - key: shoulder
            label: "Shoulder"
          - key: bicep
            label: "Bicep"
          - key: length
            label: "Length"
        bottom:
          - key: waist
            label: "Waist"
          - key: inseam
            label: "Inseam"
          - key: thigh
            label: "Thigh"
          - key: knee
            label: "Knee"
          - key: leg_opening
            label: "Leg opening"
          - key: rise
            label: "Rise"
        outwear:
          - key: chest
            label: "Chest"
          - key: shoulder
            label: "Shoulder"
          - key: sleeves
            label: "Sleeves"
          - key: length
            label: "Length"
          - key: bicep
            label: "Bicep"
        shoes:
          - key: size_us
            label: "Size (US)"
          - key: size_eu
            label: "Size (EU)"
          - key: foot_length
            label: "Foot length"
          - key: width
            label: "Width"
          - key: instep
            label: "Instep"
        accessory:
          - key: length
            label: "Length"
          - key: width
            label: "Width"
          - key: height
            label: "Height"
          - key: circumference
            label: "Circumference"
          - key: strap_drop
            label: "Strap drop"
      empty_state:
        - "If no measurement data: show a short line 'No measurements added' (styled as secondary text), not an empty section title only."

  behavior:
    header:
      - "Back control aligns with screen title row; match outfit detail header alignment pattern."
    navigation:
      from_outfit_or_list:
        trigger: "User taps an item row/card."
        next_screen: "Item detail (this screen)"
    measurements:
      - "Resolve `item_category` (top | bottom | outwear | shoes | accessory) to pick which keys are eligible."
      - "Render rows in the order listed under that category; skip null/empty values."

  responsive_layout:
    - "Banner stays full width; height fixed at 486dp unless future spec adds breakpoint rules."
    - "Scale horizontal padding and typography with system/font scale; keep label/value rows readable (min touch height on any tappable measurement row if rows become interactive later)."
    - "Avoid horizontal overflow: content width must stay within viewport (skill: layout / no accidental horizontal scroll)."

  # Explicit alignment with `.agents/skills/ui-ux-advicer/SKILL.md` priority rules (implement + review against this).
  ux_skill_reference:
    accessibility:
      - "Normal text vs background: maintain at least 4.5:1 contrast (verify rgba(0,0,0,0.55) and 0.6 on #F5F5F5; adjust if large text only)."
      - "Hero image: meaningful photo → contentDescription summarizing the item; if purely decorative, mark decorative for TalkBack."
      - "Product link / back: visible focus state for keyboard/D-pad; tab order follows visual order (top → bottom)."
      - "Do not rely on color alone for state; disabled link needs reduced opacity + text or icon cue."
    touch_and_interaction:
      - "Product link hit area: minimum 48x48dp (Material) / 44x44pt guideline; extend touch target beyond underline if visual text is smaller."
      - "Primary action is tap; provide pressed state (ripple or opacity) on the link."
      - "If opening URL is async, disable or show loading on the control until navigation completes; surface errors inline near the control."
    performance:
      - "Hero: use appropriate resolution, caching, and (where supported) modern formats; avoid layout jump—reserve 486dp or show placeholder/skeleton in banner while loading."
      - "Respect prefers-reduced-motion: no non-essential banner motion, or substitute instant/crossfade."
    typography:
      - "Multi-line title (Playfair): comfortable line height (~1.5–1.6) for readability."
      - "Measurement body rows: 14sp is dense; prefer 15–16sp if contrast or aging eyes are a concern; keep label/value hierarchy clear."

  notes:
    - "Cross-check `item.png` / `item.svg` for fine spacing and typography tweaks when implementing."
    - "Unit conversion (cm vs in) is backend or settings concern; surface unit once per section if mixed units are possible."
    - "Long URLs should not be shown raw in the body; use the link control only."
