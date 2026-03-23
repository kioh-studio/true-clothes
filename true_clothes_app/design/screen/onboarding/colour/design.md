SCREEN_SPEC:
  id: onboarding.colour
  step_id: colour
  route: "/onboarding/colour"
  design_path: "design/screen/onboarding/colour/"

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
      required: true
      implementation_note: "The legacy Android app blocks Next until one of the two tiles is selected (server-side validation message: choose a colour preference)."
      options:
        - id: unknown
          label: "I dont know"
          ui_note: "Shown with a simple icon treatment (see colour.svg / implementation)."
        - id: custom_later
          label: "I’ll set this later"
          ui_note: "Second tile is visually minimal (placeholder); label may be omitted in UI but maps to this option when the empty tile is selected."

  layout:
    header:
      title: "Personal colour"
      subtitle: "Let us know if you have detected your personal colour"
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
            border:
              stroke_width: 1
              color: "black"
          tiles:
            - id: tile_unknown
              label: "I dont know"
              maps_to: colour_preference.unknown
              background_color: "#D5D5D5"
            - id: tile_custom_later
              label: ""
              maps_to: colour_preference.custom_later
              background_color: "#FFFFFF"
    footer:
      progress_bar:
        uses_global_stepper: true
        current_step_id: colour
      navigation:
        back_enabled: true
        next_enabled: true
        next_step_id: adding_wardrobe

  interactivity:
    validation_feedback:
      trigger: "User taps Next without selecting a tile."
      behavior: "Show a blocking message (e.g. dialog or snackbar) per app pattern; legacy app used a modal with short copy."

  responsive_layout:
    - "Body must be scrollable: put content (header + hint text + tiles) in a scrollable column so it never overflows."
    - "Footer must be fixed: keep progress/navigation fixed at the bottom, outside the scroll."
    - "Use scaled dimensions for all padding and elements (see design/responsive-ui.md)."

  notes:
    - "Refer to colour.svg in this folder for layout and spacing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "The second tile is a placeholder for future personal-colour selections; it is intentionally sparse in the reference implementation."
    - "Tile wrapper: each option uses a rectangle with border stroke width 1."
