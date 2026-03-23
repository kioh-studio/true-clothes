COMPONENT_SPEC:
  id: component.item_slider
  design_path: "design/component/item-slider/"
  widget: "lib/widgets/true_item_slider.dart → TrueItemSlider"

  purpose:
    short: "Horizontal carousel with primary/secondary card size contrast and snap-to-card behaviour."

  params:
    itemCount:
      type: "int"
      required: true
    itemBuilder:
      type: "Widget Function(BuildContext, int index, bool isPrimary)"
      required: true
      description: "Builds the content for each card. isPrimary indicates the active card."
    cardWidthDp:
      type: "double"
      default: 260
    primaryHeightDp:
      type: "double"
      default: 488
    secondaryHeightDp:
      type: "double"
      default: 408
    gapDp:
      type: "double"
      default: 24
    padLeftDp:
      type: "double"
      default: 20
    padBottomDp:
      type: "double"
      default: 89
    cardColor:
      type: "Color"
      default: "#DCDCDC"
    emptyText:
      type: "String"
      default: "No items yet — tap + to add your first piece."

  visual:
    primary_card:
      width_dp: 260
      height_dp: 488
      purpose: "Active/focused card — tallest in the slider."
    secondary_card:
      width_dp: 260
      height_dp: 408
      purpose: "Non-active cards — 80dp shorter for visual depth contrast."
      vertical_alignment: "centre (vertically centred relative to primary)"
    transition:
      - "Heights interpolate continuously during drag based on distance from active scroll position."
      - "AnimatedContainer with 200ms easeOut for smooth resize."

  behaviour:
    swipe:
      - "User swipes left/right to browse cards."
      - "BouncingScrollPhysics for overscroll feedback."
    snap:
      - "On scroll end, snaps to nearest card boundary."
      - "Snap animation: 300ms easeOut."
    empty:
      - "When itemCount is 0, displays emptyText centred."

  accessibility:
    - "Card content and tap handling are the caller's responsibility via itemBuilder."
    - "Min touch target met by card dimensions (260×408+)."

  used_in:
    - "design/screen/my-wardrobe/design.md (wardrobe item browsing)"

  notes:
    - "All dimensions scaled via scaleDp/scaleSp."
    - "Card width fixed at cardWidthDp; on tablets consider overriding to show more visible cards."
    - "The component handles scroll, snapping, and height animation. The caller provides content and handles tap navigation."
