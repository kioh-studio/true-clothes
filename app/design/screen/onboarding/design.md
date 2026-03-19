APP_PURPOSE:
  short: "Help users combine existing wardrobe items into the best outfits for their body and aesthetic."
  details:
    - "Use the user’s body measurements and each garment’s measurements to reason about fit and size."
    - "Use personal colour profile and preferred styles/aesthetics to rank and suggest outfits."
    - "Current focus: outfits from the user’s existing wardrobe."
    - "Future: suggest new items from the market that match the recommended outfits (size, measurement, colour, vibe)."

ONBOARDING_FLOW:
  version: 1

  documentation_policy:
    source_of_truth: "Relevant design.md files must be updated in the same working session whenever onboarding requirements/behavior/UI rules change."
    required_updates:
      - "If screen behavior changes, update that screen's design.md first (or in the same change)."
      - "If a shared rule changes (validation, navigation, responsiveness), update this file and any affected screen design.md files."
      - "Use structured keys where possible (e.g. interactivity, validation_feedback, datepicker) rather than only free-text notes."

  entry_screen: onboarding.gender
  exit_screen: TBD  # TODO: decide final post-onboarding destination (home, summary, etc.)

  resource_policy:
    note: "If required design resources are missing or inaccessible, stop and ask the owner before substituting."
    applies_to: ["fonts", "images", "icons", "third_party_assets", "external_references"]
    guidelines:
      - "Do not assume access to proprietary fonts or image libraries that are not present in the repo."
      - "If an asset path, font name, or external reference cannot be resolved, pause implementation and inform the owner."
      - "Prefer explicit confirmation before replacing missing resources with alternatives."

  ui_responsiveness:
    target_devices: ["mobile_phones_all_sizes"]
    layout_guidelines:
      - "Treat PNG/SVG sizes as reference only, not as fixed pixels."
      - "Use responsive units and flexible layout (e.g. flexbox, percentage-based widths, safe-area insets)."
      - "Avoid hard-coding exact pixel positions from the SVG; preserve hierarchy and relative spacing instead."
      - "Ensure all onboarding screens look good on common mobile widths and heights."
    responsive_layout:
      - "Screens with a footer (e.g. progress bar): make the main content scrollable (e.g. weight(1f) + verticalScroll) and keep the footer fixed at the bottom so content never overflows or overlaps the footer."
      - "Use scaled dimensions for padding and elements; see app/design/responsive-ui.md."

  theme_colors:
    main_background: "#F5F5F5"

  progress_bar:
    includes_subflows: false  # Subflows (e.g. body_measurement_top/bottom) are not shown as separate steps.

  navigation_rules:
    first_step:
      back_enabled: false
      next_enabled: false

  main_steps:
    - id: gender
      order: 1
      title: "Gender"
      description: "Select user gender."
      design_path: "app/design/onboarding/gender/"
      next: country

    - id: country
      order: 2
      title: "Country"
      description: "Select user country of residence."
      design_path: "app/design/onboarding/country/"
      next: body_measurement

    - id: body_measurement
      order: 3
      title: "Body Measurement"
      description: "Optionally collect top and bottom body measurements."
      design_path: "app/design/onboarding/body-measurement/"
      next: colour
      subflows:
        - id: body_measurement_top
          type: optional
          title: "Top measurement"
          design_path: "app/design/onboarding/top/"
          returns_to: body_measurement
        - id: body_measurement_bottom
          type: optional
          title: "Bottom measurement"
          design_path: "TBD"  # TODO: add folder/path for bottom measurement design if needed
          returns_to: body_measurement

    - id: colour
      order: 4
      title: "Colour"
      description: "Collect colour preferences."
      design_path: "app/design/onboarding/colour/"
      next: adding_wardrobe

    - id: adding_wardrobe
      order: 5
      title: "Adding Wardrobe"
      description: "Let user add existing wardrobe items."
      design_path: "app/design/onboarding/adding-wardrobe/"
      next: TBD

  data_storage:
    strategy: "local_device_first"
    layer: "mobile_local_store"
    notes:
      - "Onboarding data is stored locally on the device (e.g. mobile local storage / local data store)."
      - "Concrete storage library/implementation will be chosen later."

  validation_strategy:
    per_step_specs: true
    note: "All field-level validation rules live in the corresponding screen design files (e.g. app/design/screen/onboarding/gender/design.md)."
    ux_rule:
      trigger: "Show validation feedback after user taps Next/submit on the current screen."
      invalid_field_style: "Invalid input controls must show red/error border state."
      inline_message: "Each invalid field must show a short error message directly below that field."
      scope: ["text_input", "number_input", "date_input", "single_select_groups"]
