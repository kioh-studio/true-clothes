SCREEN_SPEC:
  id: onboarding.gender
  step_id: gender
  route: "/onboarding/gender"
  design_path: "app/design/screen/onboarding/gender/"

  # Layout: use gender.svg in this folder. It uses px and a 402px × 874px reference; implement responsively so all phone screens match that layout.

  purpose:
    short: "Collect user name, date of birth, email, and gender."
    details:
      - "Name and gender help personalize addressing and outfit suggestions."
      - "DOB is used to infer age to help choose suitable outfits."
      - "Email is stored for potential future notifications or communication."

  fields:
    - key: name
      label: "Name"
      type: text
      required: true
      validation:
        max_length: 100

    - key: dob
      label: "Date of birth"
      type: date
      required: true
      format: "DD-MM-YYYY"
      validation:
        age_min_years: 0
        age_max_years: 150
      interaction:
        input_mode: "picker_only"
        trigger: "Tap/click anywhere on the DOB input box to open date picker."
        typing_allowed: false
        future_date_allowed: false

    - key: email
      label: "Email"
      type: email
      required: false
      validation:
        email_format: true

    - key: gender
      label: "Gender"
      type: enum_single
      required: true
      options:
        - id: man
          label: "Man"
        - id: woman
          label: "Woman"
        - id: other
          label: "Others"

  layout:
    order: [name, dob, email, gender]
    header:
      title: "Tell us about you"
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
    body:
      type: vertical_form
    footer:
      progress_bar:
        uses_global_stepper: true
        current_step_id: gender
      navigation:
        back_enabled: false
        next_enabled: false
        next_step_id: country

  interactivity:
    datepicker:
      applies_to: dob
      open_behavior:
        - "Open native/standard date picker when user taps the DOB input box."
        - "Do not require a separate icon/button to open the picker."
      close_behavior:
        - "If user confirms a date, populate field in DD-MM-YYYY format."
        - "If user cancels, keep current value unchanged."
      constraints:
        max_date: "today"
    validation_feedback:
      trigger: "After user taps Next."
      field_error_ui:
        - "Invalid input shows red/error border."
        - "Show a short, field-specific message directly below the invalid input."
      clear_behavior:
        - "Remove error state/message for a field once that field becomes valid."

  responsive_layout:
    - "Body must be scrollable: put form content (header + fields + gender) in a scrollable column (e.g. weight(1f) + verticalScroll) so it never overflows."
    - "Footer must be fixed: keep the progress bar in a fixed footer at the bottom, outside the scroll; do not place it inside the scrollable content."
    - "Use scaled dimensions for all padding and elements (see app/design/responsive-ui.md)."

  notes:
    - "Refer to the PNG for overall visual layout; use the SVG for precise sizes and spacing."
    - "Use responsive layout; avoid hard-coding exact pixel positions from the SVG."
    - "Validation UX: after user taps Next, any invalid field must show error styling (red border) and a short inline message below the related field."
