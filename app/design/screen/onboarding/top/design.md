SCREEN_SPEC:
  id: onboarding.body_measurement_top
  step_id: body_measurement_top
  route: "/onboarding/body-measurement/top"
  design_path: "app/design/screen/onboarding/top/"

  # Layout: use top.svg in this folder. It uses px and a 402px × 874px reference; implement responsively so all phone screens match that layout.

  purpose:
    short: "Let user optionally enter top-body measurements for better fit recommendations."
    details:
      - "These measurements help suggest better shirt/jacket sizing and fit."
      - "This is a subflow from body_measurement and returns back to it."

  fields:
    - key: shoulder_width
      label: "Shoulder width"
      type: number
      required: false
      validation:
        min: 0
    - key: shoulder_width_unit
      label: "Shoulder width unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: bicep
      label: "Bicep"
      type: number
      required: false
      validation:
        min: 0
    - key: bicep_unit
      label: "Bicep unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: sleeves
      label: "Sleeves"
      type: number
      required: false
      validation:
        min: 0
    - key: sleeves_unit
      label: "Sleeves unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: chest
      label: "Chest"
      type: number
      required: false
      validation:
        min: 0
    - key: chest_unit
      label: "Chest unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: neck
      label: "Neck"
      type: number
      required: false
      validation:
        min: 0
    - key: neck_unit
      label: "Neck unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

  behavior:
    - "Each measurement row has: left icon + label, numeric input, unit dropdown, and a '?' help icon (see SVG)."
    - "All unit selectors are dropdowns (CM/IN) next to their corresponding input."
    - "Unit dropdown opens as an overlay menu anchored to the unit button; it must not push other UI components down when expanded."
    - "The '?' icon opens short guidance for that specific measurement."
    - "All fields are optional; user can leave them blank and return to body_measurement."

  layout:
    header:
      title: "Better understand your body"
      subtitle: "The measurement bring you best shirts, jackets,.. that makes people change the way they see you"
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
        opacity: 70
    body:
      type: vertical_form
      sections:
        - id: top_measurements
          order:
            - shoulder_width
            - shoulder_width_unit
            - bicep
            - bicep_unit
            - sleeves
            - sleeves_unit
            - chest
            - chest_unit
            - neck
            - neck_unit
    footer:
      progress_bar:
        uses_global_stepper: true
        # Subflows are not shown as separate progress steps; keep the active step as body_measurement.
        current_step_id: body_measurement
      navigation:
        back_enabled: true
        next_enabled: true
        next_step_id: body_measurement

  responsive_layout:
    - "Body must be scrollable: put content (header + all rows) in a scrollable column so it never overflows."
    - "Footer must be fixed: keep progress/navigation fixed at the bottom, outside the scroll."
    - "Use scaled dimensions for all padding and elements (see app/design/responsive-ui.md)."

  notes:
    - "Refer to the PNG for overall visual layout; use the SVG for precise sizes and spacing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "Progress indicator: keep the onboarding progress bar on the 3rd step (body_measurement) while inside this top-body subflow."
    - "Validation UX: after user taps Next, invalid measurement inputs should show red/error border and short inline error text below each invalid input."
