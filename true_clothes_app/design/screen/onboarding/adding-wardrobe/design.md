SCREEN_SPEC:
  id: onboarding.adding_wardrobe
  step_id: adding_wardrobe
  route: "/onboarding/adding-wardrobe"
  design_path: "design/screen/onboarding/adding-wardrobe/"

  # Layout: use wardrobe.svg in this folder. It uses px and a 402px × 874px reference; implement responsively so all phone screens match that layout.

  purpose:
    short: "Let user add existing wardrobe items to build outfit recommendations."
    details:
      - "User builds a wardrobe so fit/size and styling recommendations can be generated from real items."
      - "This final onboarding step focuses on collecting existing items first; Next completes onboarding and navigates home."

  fields:
    - key: wardrobe_items
      label: "Wardrobe items"
      type: custom_upload_area
      required: false
      validation:
        note: "Placeholder for now; exact upload flow will be defined later."

  layout:
    header:
      title: "Building your wardrobe"
      subtitle: "Let us know about your existing items and building outstanding outfits together"
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
        opacity: 70

    body:
      type: vertical_form
      sections:
        - id: wardrobe_drop_zone
          title: "Add items"
          ui:
            dashed_upload_rect:
              description: "Large dashed rectangle placeholder (tap opens informational message until upload exists)."
              # wardrobe.svg uses stroke-dasharray="2 2" on the placeholder rect.

    footer:
      progress_bar:
        uses_global_stepper: true
        current_step_id: adding_wardrobe
      navigation:
        back_enabled: true
        next_enabled: true
        next_step_id: home.main
        next_behavior: "Advances to home shell (Outfit / Favourite / Closet); no wardrobe upload required for MVP."

  responsive_layout:
    - "Body must be scrollable: keep the main content in a vertical layout that does not overlap the fixed footer."
    - "Footer must be fixed: keep progress/navigation fixed at the bottom, outside the scroll."
    - "Use scaled dimensions for all padding and elements (see design/responsive-ui.md)."

  notes:
    - "Refer to wardrobe.svg in this folder for layout and spacing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "The main interaction is currently a placeholder dashed rectangle; implement the actual item upload flow in a later iteration."
