SCREEN_SPEC:
  id: wardrobe_menu
  route: "/wardrobe-menu"
  design_path: "true_clothes_app/design/screen/build-wardrobe/"
  reference_assets:
    - "build.svg"
    - "build.png"    # located at true-clothes/design/screen/home/build-wardrobe/build.png

  # Layout reference: build.svg in this folder (402×874 reference canvas, #F5F5F5 background).
  # Implement responsively; preserve rhythm, not pixel-perfect absolute layout.

  purpose:
    short: "Central menu for all wardrobe and outfit management actions."
    details:
      - "Opened when the user taps the Wardrobe button in the main bottom navigation."
      - "Groups actions into two logical sections: Closet (item management) and Outfit (outfit management)."
      - "Each option is a tappable row with an icon and label; each navigates to a distinct sub-screen."
      - "Closet options manage the user's wardrobe items (add/update/delete)."
      - "Outfit options manage outfits (build/choose/delete/update/AI-generated)."

  screen:
    background_color: "#F5F5F5"
    padding_horizontal_dp: 22
    padding_top_dp: 75

  sections:
    - id: closet
      title: "Closet"
      purpose: "Manage wardrobe items — add, update, or remove clothing from the user's closet."
      options:
        - id: my_wardrobe
          label: "My wardrobe"
          icon: "closet / wardrobe icon (23×23dp)"
          action: "Navigate to wardrobe item list / management screen."
          notes:
            - "Currently the only visible option in the design reference."
            - "Future options may include: add item, update item, delete item."

    - id: outfit
      title: "Outfit"
      purpose: "Build and manage outfits — create, select, edit, delete, or AI-generate outfits."
      options:
        - id: build_your_outfit
          label: "Build your outfit"
          icon: "outfit / mannequin icon (23×23dp)"
          action: "Navigate to outfit builder screen."
          notes:
            - "Currently the only visible option in the design reference."
            - "Future options may include: choose outfit, update outfit, delete outfit, AI outfit."
            - "Each future option occupies its own row with the same styling."

  layout:
    section_title:
      style:
        font_family: "Poppins"
        font_weight: "Bold"
        size_sp: 24
        color: "#000000"
      spacing:
        padding_bottom_dp: 22
        # 22dp total vertical space below the title text, which includes the underline and the gap to the first option.

    section_underline:
      description: "Horizontal rule below each section title, acting as a visual separator."
      thickness_dp: 1
      width_dp: 100
      color: "#000000"
      spacing:
        gap_below_title_dp: 10
        # 10dp vertical gap between the title text baseline and the top of the underline.

    option_row:
      description: "Each tappable option within a section — icon on the left, label to its right."
      icon:
        size_dp: 23
        color: "#000000"
      label:
        font_family: "Poppins"
        font_weight: "Regular"
        size_sp: 14
        color: "#000000"
      icon_to_label_gap_dp: 10
      # Horizontal gap between the right edge of the icon and the start of the label text.
      row_min_height_dp: 48
      # Meets minimum touch target for accessibility.

    section_spacing:
      between_sections_dp: 34
      # Vertical gap between the bottom of the last option row in one section and the top of the next section's title.

    svg_reference_positions:
      # Exact element positions from build.svg (402×874 canvas) for developer cross-check.
      closet_title:
        x: 22
        y_baseline: 92
      closet_underline:
        x1: 22
        y1: 101.5
        x2: 122
        y2: 101.5
      closet_icon:
        x: 22
        y: 125
        width: 23
        height: 23
      closet_label:
        x: ~56
        y_baseline: ~142
      outfit_title:
        x: 22
        y_baseline: 199
      outfit_underline:
        x1: 22
        y1: 208.5
        x2: 122
        y2: 208.5
      outfit_icon:
        x: 22
        y: 232
        width: 23
        height: 23
      outfit_label:
        x: ~56
        y_baseline: ~249

  navigation:
    floating_nav_circles:
      description: "The 3 floating circular navigation buttons (Home / Wardrobe / Profile) from the main screen must appear on this screen with identical UI and behavior."
      implementation: "This screen lives inside MainNavShell's IndexedStack; the circles are overlaid by the shell, not by this screen."
      preview_note: "Previews must use MainNavShell(initialIndex: 1) so the circles render exactly as they do in the real app — never wrap WardrobeMenuContent in a standalone Scaffold for preview."
    background_consistency:
      description: "The page background (#F5F5F5) must cover the entire screen area with no seams or color splits from the MainNavShell scaffold."
      implementation: "MainNavShell uses IndexedStack(sizing: StackFit.expand) so each page receives tight constraints and fills the full area; the page's own background covers everything."
      bug_fix_note: "Previously IndexedStack used default StackFit.loose, causing pages to shrink-wrap to content size and exposing the scaffold background (#DCDCDC) around edges — fixed by setting sizing: StackFit.expand."

  behavior:
    - "Each option row is individually tappable; provide pressed-state feedback (ripple or opacity)."
    - "Tapping an option navigates to the corresponding sub-screen."
    - "The screen scrolls vertically if more options are added in the future."
    - "Sections are rendered in order: Closet first, Outfit second."
    - "The 3 floating nav circles (Home / Wardrobe / Profile) are always visible at the bottom, provided by MainNavShell."

  responsive_layout:
    - "Use scaled dimensions (scaleDp / scaleSp); see responsive-ui.md if present."
    - "Horizontal padding (22dp) and all spacing values scale with screen width."
    - "Content should be scrollable to accommodate future additions."
    - "Avoid horizontal overflow; all content stays within the viewport."

  accessibility:
    - "Each option row: expose label + action in semantics (e.g. 'My wardrobe, open wardrobe')."
    - "Section titles: announce section name for grouping."
    - "Touch target: minimum 48dp height for each option row."

  notes:
    - "Cross-check build.svg and build.png for fine spacing when implementing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "The two icon images in build.svg are embedded as base64 PNG (512×512 source, rendered 23×23dp)."
    - "Option rows within a section are separated by natural vertical rhythm; no explicit divider is shown between them."
    - "Future-proof: the layout should easily accommodate additional option rows per section without redesign."
    - "This is one of the 3 main screens (Home / Wardrobe / Profile); the floating nav circles are shared across all 3 via MainNavShell."
    - "All changes, discussion notes, and decisions must be recorded back to this design.md."
