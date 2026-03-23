SCREEN_SPEC:
  id: wardrobe.main
  route: "/wardrobe"
  design_path: "design/screen/my-wardrobe/"
  reference_assets:
    - "wardrobe.svg"
    - "wardrobe.png"

  screen:
    background_color: "#F5F5F5"

  purpose:
    short: "Display all wardrobe items the user owns, organised by clothing category."
    details:
      - "Opened when the user taps 'My wardrobe' in the Closet section of the build-wardrobe menu (/wardrobe-menu)."
      - "Central hub for browsing every item the user has added to their wardrobe."
      - "Items are filtered by category via a dropdown selector (Top, Bottom, Outerwear, Shoes, Accessory, Bag, etc.)."
      - "Three top-level views—Closet, Collections, By tags—give different lenses over the same data."
      - "Search bar allows free-text filtering of items within the current view."
      - "Floating action button lets the user add a new item directly from this screen."

  layout:
    header:
      back_button:
        position: "top-left"
        shape: "circle"
        diameter_dp: 40
        fill: "#FFFFFF"
        icon: "chevron_left"
        icon_color: "#000000"
        behavior:
          - "Navigates back to the previous screen (e.g. home)."
          - "Centre-aligned vertically with the screen title."
      title:
        text: "My Wardrobe"
        alignment: "center"
        style:
          font_family: "Playfair Display"
          font_weight: "Bold"
          size_sp: 22
          color: "#000000"

    search_bar:
      spacing_below_header_dp: 24
      alignment: "right"
      width: "~170dp (right-aligned, does not span full width)"
      placeholder_text: "Search anything..."
      placeholder_style:
        font_family: "Poppins"
        font_weight: "Regular"
        size_sp: 14
        color: "rgba(0,0,0,0.5)"
      underline:
        color: "#000000"
        opacity: 0.6
        thickness_dp: 1
      icon:
        type: "magnifying_glass"
        position: "trailing (right of text)"
        color: "#1E1E1E"
        size_dp: 20
      behavior:
        - "Tapping the search bar opens a text input; keyboard appears."
        - "Filters displayed items in real time as user types (debounce ~300ms recommended)."
        - "Search applies within the currently active tab and category filter."
        - "Empty query resets to unfiltered view."

    tab_bar:
      spacing_below_search_dp: 20
      tabs:
        - id: closet
          label: "Closet"
          default_selected: true
        - id: collections
          label: "Collections"
        - id: by_tags
          label: "By tags"
      style:
        active_tab:
          font_family: "Playfair Display"
          font_weight: "Bold"
          size_sp: 18
          color: "#000000"
          indicator:
            type: "short_line_below"
            color: "#FFB432"
            thickness_dp: 3
            width: "matches text width, capped ~30dp"
        inactive_tab:
          font_family: "Playfair Display"
          font_weight: "Regular"
          size_sp: 18
          color: "rgba(0,0,0,0.4)"
      behavior:
        - "Switching tab replaces the grid content below with the corresponding view."
        - "Closet: flat grid of all items, filterable by category dropdown."
        - "Collections: user-created groupings of items (future spec)."
        - "By tags: items grouped/filtered by user-applied tags (future spec)."

    category_dropdown:
      spacing_below_tabs_dp: 16
      alignment: "right"
      width_dp: 132
      height_dp: 33
      style:
        background: "#FFFFFF"
        border:
          color: "#000000"
          width_dp: 0.5
          radius_dp: 0
        label:
          font_family: "Poppins"
          font_weight: "Regular"
          size_sp: 16
          color: "#000000"
        arrow_icon:
          type: "triangle_down"
          color: "#1D1B20"
      options:
        - "Top"
        - "Bottom"
        - "Outerwear"
        - "Shoes"
        - "Accessory"
        - "Bag"
      default: "Top"
      behavior:
        - "Selecting a category re-filters the Closet grid to show only items of that type."
        - "Dropdown opens a standard platform popup/bottom-sheet picker."
        - "Selected value replaces the label text inside the dropdown."

    item_slider:
      spacing_below_dropdown_dp: 16
      type: "horizontal_slider"
      scroll_direction: "horizontal"
      purpose: "Horizontally swipeable list of item cards; user swipes left/right to browse items in the selected category."
      padding_left_dp: 20
      padding_bottom_dp: 89
      card_gap_dp: 24
      snap_behavior: "snap to nearest card edge after swipe gesture ends"
      image_source:
        description: "Each card displays a product photo loaded from imageUrl."
        supported_sources:
          - "Local asset path (e.g. 'assets/jeans.png') — used for demo/offline."
          - "Network URL (e.g. 'https://cdn.example.com/items/123.jpg') — returned by backend API."
        loading: "Show skeleton shimmer or neutral gray placeholder while image loads."
        error: "On load failure, show a placeholder icon (checkroom) on the #DCDCDC background."
        notes:
          - "imageUrl is nullable; when null, the placeholder icon is shown."
          - "Detect source type by checking URL prefix: 'http' = network, otherwise = local asset."
      primary_card:
        purpose: "The currently active/focused item card — tallest in the slider."
        background_color: "#DCDCDC"
        border_radius_dp: 0
        width_dp: 260
        height_dp: 488
        image:
          fit: "cover"
          alignment: "center"
      secondary_card:
        purpose: "Non-active cards — shorter height to create visual depth contrast with the primary card."
        background_color: "#DCDCDC"
        border_radius_dp: 0
        width_dp: 260
        height_dp: 408
        vertical_alignment: "center (vertically centred relative to the primary card)"
        notes:
          - "Height difference of 80dp (40dp top + 40dp bottom) creates a clear visual hierarchy."
      transition:
        - "When the user swipes, the incoming card smoothly animates from secondary (408dp) to primary (488dp) height."
        - "The outgoing card simultaneously shrinks from primary to secondary height."
        - "Height interpolation is continuous during drag — not a discrete jump."
        - "All cards are vertically centred within the slider area."
      behavior:
        - "Tapping a card navigates to the item detail screen (route: /home/item/{itemId})."
        - "User swipes left to reveal the next item, right to go back to the previous item."
        - "Swipe velocity determines whether the slider advances to the next card or springs back."
        - "Support both drag-and-release and quick flick gestures."
        - "No wrap-around: reaching the first or last item shows an overscroll indicator or bounce effect."
      empty_state:
        text: "No items yet — tap + to add your first piece."
        style:
          font_family: "Poppins"
          font_weight: "Regular"
          size_sp: 14
          color: "rgba(0,0,0,0.45)"
          alignment: "center"

    fab:
      purpose: "Floating action button to add a new item to the wardrobe."
      position: "bottom-right"
      margin_right_dp: 20
      margin_bottom_dp: 16
      width_dp: 73
      height_dp: 67
      border_radius_dp: 5
      style:
        background: "#FFFFFF"
        border:
          color: "#000000"
          width_dp: 0.3
        icon:
          type: "plus"
          color: "#1E1E1E"
          stroke_width_dp: 4.5
          stroke_linecap: "round"
      behavior:
        - "Tapping opens the add-item flow (route: /wardrobe/add-item or equivalent)."
        - "Button floats above the grid and does not scroll with content."
        - "Provide pressed/ripple feedback on tap."
      accessibility:
        - "Label: 'Add new item'."
        - "Min touch target 48x48dp is met by the 73x67 size."

  behavior:
    navigation:
      entry:
        - "User taps the 'My wardrobe' option under the Closet section in the build-wardrobe menu (route: /wardrobe-menu)."
        - "This screen is NOT a top-level nav destination; it is a sub-screen pushed from the wardrobe menu."
      item_tap:
        trigger: "User taps an item card in the slider."
        next_screen: "ItemDetailScreen (design/screen/home/item/design.md)"
        navigation_method: "Navigator.push — pushed on top of the wardrobe screen."
        data_passed:
          - "The full OutfitItemInfo payload (name, color, brand, category, measurements, imageSource, productUrl, etc.)."
          - "In production, this payload comes from the backend API; for demo, it is built from demoOutfitDetailPayload()."
        notes:
          - "If the item has no detail info (detailInfo is null), the tap is a no-op."
      add_item:
        trigger: "User taps the FAB (+) button."
        next_screen: "Add item flow"
      back:
        trigger: "User taps the back arrow."
        next_screen: "Previous screen (pop navigation stack)."
    data_loading:
      - "Fetch items for the selected category on first load and on category change."
      - "Show skeleton/shimmer placeholders while data is loading."
      - "Paginate or lazy-load if the item count is large (threshold TBD, e.g. >50)."
      - "Each item carries an imageUrl (local asset or network URL from backend API) and an OutfitItemInfo for navigation to the detail screen."
      - "For demo/offline mode, items are populated from demoOutfitDetailPayload() with local asset images."
    search:
      - "Client-side filtering if items are already in memory; server-side if dataset is large."
      - "Highlight matching text in item names if feasible (nice-to-have)."

  responsive_layout:
    - "Item card width scales proportionally (~65% of screen width); on tablets, consider showing more cards or reducing the percentage so two full cards are visible."
    - "FAB stays anchored to bottom-right regardless of scroll position."
    - "Search bar and dropdown scale with screen width; search expands on focus (optional enhancement)."
    - "Avoid horizontal overflow: all content stays within the viewport."
    - "Padding and spacing scale proportionally on larger screens."

  ux_skill_reference:
    note: "General UX rules: `.agents/skills/ui-ux-advicer/SKILL.md` in this repo."
    accessibility:
      - "Tab labels: ensure active/inactive contrast meets 3:1 minimum for large text (18sp bold qualifies as large)."
      - "Inactive tab color rgba(0,0,0,0.4) on #F5F5F5 is ~2.7:1—may need bump to rgba(0,0,0,0.5) for AA compliance; verify in implementation."
      - "Item card images: set meaningful content descriptions (item name) for screen readers."
      - "Search field: associate the placeholder with an accessible label so screen readers announce 'Search anything' on focus."
      - "FAB: ensure the '+' icon has an accessibility label ('Add new item')."
    touch_and_interaction:
      - "Item cards: minimum touch target is inherently met by grid card size."
      - "Dropdown: ensure 48dp minimum touch height (33dp visual height needs expanded hit area or padding)."
      - "Tab labels: hit area should span the full label width plus comfortable padding (~12dp each side)."
      - "Provide visual pressed states (ripple or opacity change) on cards, tabs, FAB, and dropdown."
    performance:
      - "Lazy-load item images; use thumbnails for grid view, full-res only on detail screen."
      - "Reserve card aspect ratio space to prevent layout shifts during image load."
      - "Cache category filter results to avoid re-fetching when switching back and forth."
      - "Respect reduced-motion preference: disable any grid entry animations if user prefers reduced motion."
    typography:
      - "Title (Playfair Display Bold 22sp) matches item detail screen header for visual consistency."
      - "Tab labels at 18sp qualify as large text per WCAG; 3:1 contrast ratio is sufficient for active state."
      - "Body/search text (Poppins 14-16sp) maintains readability across screen sizes."

  notes:
    - "Cross-check `wardrobe.svg` for fine spacing and typography tweaks when implementing."
    - "Collections and By tags tabs are specified structurally but their content views are future scope; show an appropriate placeholder or empty state."
    - "Category list may expand over time—design dropdown to handle long labels gracefully (truncate with ellipsis if needed)."
    - "Consider pull-to-refresh gesture for reloading wardrobe data."
    - "Title in the reference design reads 'My Wardorbe' (typo)—correct to 'My Wardrobe' in implementation."
