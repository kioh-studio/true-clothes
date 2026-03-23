COMPONENT_SPEC:
  id: component.back_button
  design_path: "design/component/back-button/"
  widget: "lib/widgets/true_back_button.dart → TrueBackButton"

  purpose:
    short: "Circular back-navigation button used across detail and sub-screens."

  params:
    onTap:
      type: "VoidCallback"
      required: true
      description: "Action when tapped (typically Navigator.pop)."
    diameterDp:
      type: "double"
      default: 40
      description: "Circle diameter in design dp."
    fill:
      type: "Color"
      default: "#FFFFFF"
      description: "Background fill of the circle."
    iconColor:
      type: "Color"
      default: "#000000"
      description: "Chevron icon colour."
    icon:
      type: "IconData"
      default: "chevron_left"
      description: "Override icon if needed (e.g. close)."
    semanticLabel:
      type: "String"
      default: "Back"

  visual:
    shape: "circle"
    icon_size: "60% of diameter"
    pressed_state: "GestureDetector default (opacity or ripple as platform dictates)."

  accessibility:
    - "Semantics: button=true, label from semanticLabel param."
    - "Min touch target met when diameterDp ≥ 48."

  used_in:
    - "design/screen/my-wardrobe/design.md (header back button)"
    - "design/screen/home/item/design.md (hero overlay back)"
    - "design/screen/home/outfit/design.md (header back)"

  notes:
    - "Responsive: diameter is scaled via scaleDp."
    - "For screens that overlay the button on an image (e.g. item detail), the caller adds a gradient scrim — not this component's responsibility."
