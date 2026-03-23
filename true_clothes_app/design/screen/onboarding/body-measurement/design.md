SCREEN_SPEC:
  id: onboarding.body_measurement
  step_id: body_measurement
  route: "/onboarding/body-measurement"
  design_path: "design/screen/onboarding/body-measurement/"

  # Layout: use body-measurement.svg in this folder. It uses px and a 402px × 874px reference; implement responsively so all phone screens match that layout.
  # dp/sp/px → Flutter scaling: design/responsive-ui.md (section "dp, sp, and px in screen design.md").

  purpose:
    short: "Collect height and weight, then let user choose how to determine body measurements."
    details:
      - "Height and weight are used as baseline signals for fit and size recommendations."
      - "User can continue by manually entering measurements (top/bottom) or by letting AI estimate from camera."

  fields:
    - key: height
      label: "Height"
      type: number
      required: true
      validation:
        min: 0

    - key: height_unit
      label: "Height unit"
      type: enum_single
      required: true
      options:
        - id: cm
          label: "CM"
        - id: in
          label: "IN"

    - key: weight
      label: "Weight"
      type: number
      required: true
      validation:
        min: 0

    - key: weight_unit
      label: "Weight unit"
      type: enum_single
      required: true
      options:
        - id: kg
          label: "KG"
        - id: lb
          label: "LB"

    - key: measurement_method
      label: "Determine your body measurement"
      type: enum_single
      required: false
      options:
        - id: manual
          label: "Manual input"
        - id: ai_guess
          label: "Let our AI guess"

  behavior:
    - "Height and Weight are required before enabling Next."
    - "Height unit and Weight unit selectors are dropdowns next to each input (see SVG)."
    - "The '?' icon near each input opens short guidance for the corresponding field."
    - "Manual input: user chooses Top body or Bottom body to enter measurements (subflows return to this screen)."
    - "AI guess: user can open camera capture to estimate measurements; if unavailable/denied, fallback to manual input."

  layout:
    header:
      title: "Better understand your body"
      subtitle: "Before joining the fashion world, you better know about your body..."
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
        opacity: 70
    body:
      type: vertical_form
      sections:
        - id: basic_inputs
          order: [height, height_unit, weight, weight_unit]
        - id: determine_measurement
          title: "Determine your body measurement"
          options:
            - id: top_body
              label: "Top body"
              maps_to: measurement_method.manual
            - id: bottom_body
              label: "Bottom body"
              maps_to: measurement_method.manual
            - id: camera
              label: "Let our AI guess your measurement"
              maps_to: measurement_method.ai_guess
    footer:
      progress_bar:
        uses_global_stepper: true
        current_step_id: body_measurement
      navigation:
        back_enabled: true
        next_enabled: "when required fields valid"
        next_step_id: colour

  responsive_layout:
    - "Body must be scrollable: put content (header + inputs + determine section) in a scrollable column with flexible height so it never overflows."
    - "Footer must be fixed: keep progress/navigation fixed at the bottom, outside the scroll."
    - "Use scaled dimensions for all padding and elements (see design/responsive-ui.md)."

  notes:
    - "Refer to body-measurement.svg in this folder for layout and spacing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "Progress indicator: highlight the 3rd step (body_measurement) in the onboarding progress bar (the center dot filled), matching the reference SVG."
    - "Important: keep Next disabled until Height and Weight are valid (> 0)."
    - "Validation UX: when user taps Next and there are invalid fields, show red/error border on each invalid field and a short inline message directly below that field."
    - "Important: unit dropdown (CM/IN, KG/LB) should open as an overlay menu anchored to the unit button; it must not push other UI components down when expanded."
    - "Important: manual input buttons must navigate to subflows: Top body -> body_measurement_top screen; Bottom body -> body_measurement_bottom screen; both return to body_measurement after completion/cancel."
    - "Important: AI guess (camera) tile is a placeholder for now; no camera/permission flow is required yet."
