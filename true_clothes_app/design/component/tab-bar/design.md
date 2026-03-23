COMPONENT_SPEC:
  id: component.tab_bar
  design_path: "design/component/tab-bar/"
  widget: "lib/widgets/true_tab_bar.dart → TrueTabBar"

  purpose:
    short: "Horizontal text tab row with a short coloured indicator under the active tab."

  params:
    labels:
      type: "List<String>"
      required: true
      description: "Tab label texts."
    selectedIndex:
      type: "int"
      required: true
    onSelected:
      type: "ValueChanged<int>"
      required: true
    activeFontWeight:
      type: "FontWeight"
      default: "bold"
    inactiveFontWeight:
      type: "FontWeight"
      default: "w400 (regular)"
    fontSizeSp:
      type: "double"
      default: 18
    activeColor:
      type: "Color"
      default: "#000000"
    inactiveOpacity:
      type: "double"
      default: 0.4
      description: "Opacity applied to activeColor for inactive tabs."
    indicatorColor:
      type: "Color"
      default: "#FFB432"
    indicatorThicknessDp:
      type: "double"
      default: 3
    indicatorWidthDp:
      type: "double"
      default: 30
    tabSpacingDp:
      type: "double"
      default: 28
      description: "Horizontal gap between tabs."

  visual:
    font_family: "Playfair Display"
    active_tab:
      color: "activeColor at full opacity"
      weight: "activeFontWeight"
      indicator: "short rounded bar below text, indicatorColor"
    inactive_tab:
      color: "activeColor at inactiveOpacity"
      weight: "inactiveFontWeight"
      indicator: "none"
    vertical_padding_dp: 8

  accessibility:
    - "Each tab: Semantics button=true, selected state, label with tab name."
    - "At 18sp bold, text qualifies as WCAG 'large text'; 3:1 contrast ratio is sufficient."
    - "Inactive opacity 0.4 on #F5F5F5 is ~2.7:1 — bump to 0.5 if AA compliance is required."

  used_in:
    - "design/screen/my-wardrobe/design.md (Closet / Collections / By tags)"

  notes:
    - "Caller wraps in Padding for horizontal margins."
    - "All dimensions scaled via scaleDp/scaleSp."
    - "The home screen has a different tab style (Poppins, white text, different indicator) — if that screen adopts this component, override the font/colour params."
