COMPONENT_SPEC:
  id: component.search_bar
  design_path: "design/component/search-bar/"
  widget: "lib/widgets/true_search_bar.dart → TrueSearchBar"

  purpose:
    short: "Underlined text input with trailing magnifying glass icon for search/filter."

  params:
    controller:
      type: "TextEditingController"
      required: true
    focusNode:
      type: "FocusNode"
      required: true
    onChanged:
      type: "ValueChanged<String>"
      required: true
      description: "Called on every keystroke with the current query."
    hintText:
      type: "String"
      default: "Search anything..."
    widthDp:
      type: "double"
      default: 170
      description: "Component width in design dp."
    alignment:
      type: "Alignment"
      default: "centerRight"
      description: "Horizontal alignment within the parent."

  visual:
    placeholder:
      font_family: "Poppins"
      font_weight: "Regular"
      size_sp: 14
      color: "rgba(0,0,0,0.5)"
    input_text:
      font_family: "Poppins"
      font_weight: "Regular"
      size_sp: 14
      color: "#000000"
    underline:
      enabled_color: "rgba(0,0,0,0.6)"
      focused_color: "rgba(0,0,0,0.8)"
      enabled_thickness_dp: 1
      focused_thickness_dp: 1.5
    icon:
      type: "search (magnifying glass)"
      color: "#1E1E1E"
      size_dp: 20
      position: "trailing (suffix)"

  accessibility:
    - "Semantics: textField=true, label from hintText."
    - "Focus visible: underline thickens on focus."

  used_in:
    - "design/screen/my-wardrobe/design.md"

  notes:
    - "All dimensions scaled via scaleDp/scaleSp."
    - "Caller wraps in Padding for horizontal margins — the component does not add its own outer padding."
