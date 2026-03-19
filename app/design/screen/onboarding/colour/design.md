SCREEN_SPEC:
  id: onboarding.colour
  step_id: colour
  route: "/onboarding/colour"
  design_path: "app/design/screen/onboarding/colour/"

  # Layout: use colour.svg in this folder. It uses px and a 402px × 874px reference; implement responsively so all phone screens match that layout.

  purpose:
    short: "Capture the user’s personal colour preference or whether they know their personal colour."
    details:
      - "Personal colour influences which outfit colours feel best on the user."
      - "This step can be very simple initially (e.g. “I don’t know yet”), and extended later with more detailed colour profiles."

  fields:
    - key: colour_preference
      label: "Personal colour preference"
      type: enum_single
      required: false
      options:
        - id: unknown
          label: "I don’t know"
        - id: custom_later
          label: "I’ll set this later"  # Placeholder for a future more detailed selector

  layout:
    header:
      title: "Personal colour"
      subtitle: "Let we know if you have detected your personal colour"
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
        opacity: 70
    body:
      type: custom
      sections:
        - id: colour_options
          title: "I like to be looking as..."
          tile_wrapper:
            # Higher-level wrapper around each option tile (icon + label inside a rectangle).
            border:
              stroke_width: 1
              color: "black"
            background:
              default: "#D5D5D5"
          tiles:
            - id: tile_unknown
              label: "I dont know"
              maps_to: colour_preference.unknown
              background_color: "#D5D5D5"
            - id: tile_custom_later
              label: ""  # empty tile for now; can become a concrete preference option later
              maps_to: colour_preference.custom_later
    footer:
      progress_bar:
        uses_global_stepper: true
        current_step_id: colour
      navigation:
        back_enabled: true
        next_enabled: true
        next_step_id: adding_wardrobe

  responsive_layout:
    - "Body must be scrollable: put content (header + hint text + tiles) in a scrollable column so it never overflows."
    - "Footer must be fixed: keep progress/navigation fixed at the bottom, outside the scroll."
    - "Use scaled dimensions for all padding and elements (see app/design/responsive-ui.md)."

  notes:
    - "Refer to the PNG for overall visual layout; use the SVG for precise sizes and spacing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "The second tile is a placeholder for future personal-colour selections; keep it visually present but functionally simple for now."
    - "Tile wrapper: each option is wrapped in a rectangle tile with border stroke width `1`."

