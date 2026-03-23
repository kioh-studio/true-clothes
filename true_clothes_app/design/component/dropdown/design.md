COMPONENT_SPEC:
  id: component.dropdown
  design_path: "design/component/dropdown/"
  widget: "lib/widgets/true_dropdown.dart → TrueDropdown"

  purpose:
    short: "Bordered dropdown selector for filtering or choosing a single value."

  params:
    options:
      type: "List<String>"
      required: true
    selected:
      type: "String"
      required: true
    onChanged:
      type: "ValueChanged<String>"
      required: true
    widthDp:
      type: "double"
      default: 132
    heightDp:
      type: "double"
      default: 33
    fontSizeSp:
      type: "double"
      default: 16
    alignment:
      type: "Alignment"
      default: "centerRight"

  visual:
    background: "#FFFFFF"
    border:
      color: "#000000"
      width_dp: 0.5
      radius_dp: 0
    label:
      font_family: "Poppins"
      font_weight: "Regular"
      color: "#000000"
    arrow_icon:
      type: "arrow_drop_down"
      color: "#1D1B20"
      size_dp: 20

  accessibility:
    - "Touch target expanded to 48dp minimum height (visual height is 33dp)."
    - "DropdownButton provides built-in semantics."

  used_in:
    - "design/screen/my-wardrobe/design.md (category filter: Top, Bottom, etc.)"

  notes:
    - "Caller wraps in Padding for horizontal margins."
    - "All dimensions scaled via scaleDp/scaleSp."
    - "Options list may grow; dropdown handles long labels via truncation with ellipsis."
