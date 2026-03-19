COMPONENT_SPEC:
  id: component.modal
  design_path: "app/design/component/modal/"

  documentation_policy:
    source_of_truth: "When modal behavior/visual rules are changed in implementation, update this design.md in the same working session."
    preferred_structure: ["interactivity", "validation_feedback", "actions", "responsive_layout", "notes"]

  purpose:
    short: "Reusable modal for short system messages."
    types: ["info", "success", "warning", "error", "generic"]

  content_slots:
    title: string
    message: string_multiline
    extra: optional  # e.g. small icon or inline link/CTA
  
  UI_refer:
    background:
      colour: #F5F5F5
    border:
      weight: 1
      colour: black
    wrapper_container:
      corner: 10

  typography:
    title:
      family: "Poppins"
      size_px: 15
      weight: "SemiBold"
      padding_top: 20
      padding_left: 20
    body:
      family: "Poppins"
      size_px: 13
      weight: "Light"
      padding_left: 20
      padding_top_from_title: 20
      padding_bottom: 30

  shape:
    corner_radius_px: 10

  chrome:
    close_icon:
      type: "X"
      visible: true

  actions:
    modes:
      - id: close_only
        description: "Only X close icon is shown."
        visible_controls: ["icon_close"]
      - id: ok_cancel
        description: "Show X, OK, and Cancel buttons."
        visible_controls: ["icon_close", "button_ok", "button_cancel"]
    events:
      onOk:
        triggered_by: ["button_ok"]
      onDismiss:
        triggered_by: ["button_cancel", "icon_close"]

  runtime_options:
    # Decided by the caller / code, not by the component design
    placement:
      options: ["center_overlay", "bottom_sheet", "top_banner", "custom"]
    backdrop:
      options: ["none", "dimmed", "blurred", "custom"]
    animation:
      options: ["none", "fade", "slide", "custom"]

  responsive_layout:
    - "Use scaled dimensions for padding, corner radius, and typography so the modal looks consistent across devices; see app/design/responsive-ui.md."

  notes:
    - "Refer to modal.png for overall visual; use modal.svg for precise spacing."
    - "Keep layout responsive; avoid pixel-perfect absolute positioning from the SVG."
