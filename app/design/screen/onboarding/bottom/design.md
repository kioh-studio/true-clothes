SCREEN_SPEC:
  id: onboarding.body_measurement_bottom
  step_id: body_measurement_bottom
  route: "/onboarding/body-measurement/bottom"
  design_path: "app/design/screen/onboarding/bottom/"

  # Layout: use bottom.svg in this folder. It uses px and a 402px × 874px reference; implement responsively so all phone screens match that layout.

  purpose:
    short: "Let user optionally enter bottom-body measurements for better pants and shoe recommendations."
    details:
      - "These measurements help suggest better pants, skirts, and shoe combinations for the user’s silhouette."
      - "This is a subflow from body_measurement and returns back to it."

  fields:
    - key: waist
      label: "Waist"
      type: number
      required: false
      validation:
        min: 0
    - key: waist_unit
      label: "Waist unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: hip
      label: "Hip"
      type: number
      required: false
      validation:
        min: 0
    - key: hip_unit
      label: "Hip unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: inseam
      label: "Inseam"
      type: number
      required: false
      validation:
        min: 0
    - key: inseam_unit
      label: "Inseam unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: thigh
      label: "Thigh"
      type: number
      required: false
      validation:
        min: 0
    - key: thigh_unit
      label: "Thigh unit"
      type: enum_single
      required: false
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: ankle
      label: "Ankle"
      type: number
      required: false
      validation:
        min: 0
    - key: ankle_unit
      label: "Ankle unit"
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
      subtitle: "Under your bottom can guide you to choose best pants and shoes, which building your main silhouette"
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
        opacity: 70
    body:
      type: vertical_form
      sections:
        - id: bottom_measurements
          order:
            - waist
            - waist_unit
            - hip
            - hip_unit
            - inseam
            - inseam_unit
            - thigh
            - thigh_unit
            - ankle
            - ankle_unit
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
    - "Progress indicator: keep the onboarding progress bar on the 3rd step (body_measurement) while inside this bottom-body subflow."
    - "Validation UX: after user taps Next, invalid measurement inputs should show red/error border and short inline error text below each invalid input."

