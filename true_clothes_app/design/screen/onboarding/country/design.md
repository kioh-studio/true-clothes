SCREEN_SPEC:
  id: onboarding.country
  step_id: country
  route: "/onboarding/country"
  design_path: "design/screen/onboarding/country/"

  purpose:
    short: "Collect user country so outfit suggestions match local weather."
    details:
      - "Outfits must match weather (e.g. no long jacket in 38°C summer). Country/location drives weather context."
      - "User selects country; app may request device location (OS handles allow/deny). Location is optional."

  behavior:
    - "User selects country from list (required)."
    - "On country selected, optionally call system to get precise location; user can allow or deny (OS permission)."
    - "Proceed with country (and location if granted); do not block on location."
    - "If location permission is granted and location is resolved, display detected location text in the country input as: city, country."
    - "Detected location text should replace default placeholder/current default until user manually selects another country."

  interactivity:
    location_autofill:
      trigger: "Permission granted + successful location/geocoder resolution."
      input_display_format: "city, country"
      fallback:
        - "If city is unavailable, display country only."
        - "If geocoder fails, keep manual country selection flow and show non-blocking error."

  fields:
    - key: country
      label: "Country"
      type: single_select
      required: true
      source: "Country list (locale-aware)."

  layout:
    header:
      title: "Where are you?"
      font:
        family: "Poppins"
        weight: "medium"
        size_px: 20
    body:
      type: vertical_form
    footer:
      progress_bar:
        uses_global_stepper: true
        current_step_id: country
      navigation:
        back_enabled: true
        next_enabled: "when country selected"
        next_step_id: body_measurement

  responsive_layout:
    - "Body scrollable with flexible height; footer (progress bar) fixed at bottom."
    - "Use scaled dimensions (design/responsive-ui.md)."

  notes:
    - "Use country.svg in this folder for layout reference; implement responsively."
