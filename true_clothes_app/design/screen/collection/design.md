SCREEN_SPEC:
  id: wardrobe.collections
  route: "/wardrobe/collections"
  design_path: "design/screen/collection/"
  reference_assets:
    - "collection.svg"
    - "collection.png"

  screen:
    background_color: "#F5F5F5"

  purpose:
    short: "Display all user-created item collections, each showing a preview grid of its members."
    details:
      - "A collection is a user-defined group of wardrobe items based on any theme or aesthetic (e.g. 'Soft boy', 'Quiet luxury', 'Old money')."
      - "Collections are NOT outfits — they are loose groupings of items the user associates with an idea or style."
      - "An item can belong to many collections; a collection can have many items (many-to-many relationship)."
      - "Reached by tapping the 'Collections' tab on the My Wardrobe screen (design/screen/my-wardrobe/design.md)."
      - "The header, search bar, and tab bar are shared with the parent My Wardrobe screen — this view replaces the Closet content area when the Collections tab is active."

  layout:
    shared_chrome:
      description: "Header (back button + 'My Wardrobe' title), search bar, and tab bar are identical to the parent My Wardrobe screen."
      components:
        - "TrueBackButton (design/component/back-button/design.md)"
        - "TrueSearchBar (design/component/search-bar/design.md)"
        - "TrueTabBar (design/component/tab-bar/design.md) — 'Collections' tab is active with #FFB432 indicator."
      notes:
        - "When Collections tab is active, the category dropdown (used by Closet) is hidden."

    collection_list:
      type: "vertical_scroll"
      padding_horizontal_dp: 20
      spacing_between_cards_dp: 60
      padding_top_dp: 16
      padding_bottom_dp: 100
      purpose: "Vertically scrollable list of collection cards."

    collection_card:
      purpose: "A single collection — title + 2×2 grid of item thumbnails with an optional add-item slot."
      background_color: "#FFFFFF"
      width_dp: 350
      height_dp: 373
      border_radius_dp: 0
      alignment: "left-aligned at padding_horizontal (x=20 from screen edge)"

      title:
        position: "top-left inside card"
        padding_top_dp: 14
        padding_left_dp: 20
        style:
          font_family: "Playfair Display"
          font_weight: "Bold"
          size_sp: 18
          color: "#000000"
        behavior:
          - "Displays the user-given collection name."
          - "Single line; truncate with ellipsis if the name exceeds available width."

      item_grid:
        purpose: "2×2 preview grid of items belonging to this collection."
        columns: 2
        rows: 2
        padding_top_dp: 46
        padding_left_dp: 20
        padding_right_dp: 20
        item_thumbnail:
          width_dp: 140
          height_dp: 140
          background_color: "#D9D9D9"
          border_radius_dp: 0
          horizontal_gap_dp: 30
          vertical_gap_dp: 30
          image:
            fit: "cover"
            alignment: "center"
            source: "imageUrl — local asset or network URL (same pattern as Closet items)."
            placeholder: "neutral gray (#D9D9D9) while loading."
          behavior:
            - "Tapping a thumbnail navigates to the item detail screen (ItemDetailScreen)."

      add_item_slot:
        purpose: "Dashed-border placeholder in the grid indicating the user can add another item to this collection."
        position: "Fills the next empty slot in the 2×2 grid (e.g. bottom-right if 3 items exist)."
        width_dp: 140
        height_dp: 140
        border:
          style: "dashed"
          color: "#000000"
          dash_length_dp: 2
          gap_length_dp: 2
          width_dp: 1
        icon:
          type: "plus"
          color: "#1E1E1E"
          stroke_width_dp: 3.5
          stroke_linecap: "round"
        behavior:
          - "Tapping opens an item picker or add-item flow to assign an existing wardrobe item to this collection."
          - "Only shown when the collection has fewer than 4 items (i.e. the grid is not full)."
          - "If the collection already has 4+ items, the grid shows the first 4 items and the add-item slot is hidden."
        accessibility:
          - "Label: 'Add item to {collection name}'."

      overflow_behavior:
        - "The card always shows a 2×2 grid (max 4 visible slots)."
        - "If the collection has more than 4 items, only the first 4 are previewed."
        - "If the collection has fewer than 4 items, empty slots are either blank or occupied by the add-item slot (only one add-item slot shown, in the last empty position)."
        - "Tapping the card title or the card background (outside item thumbnails) could navigate to a full collection detail view (future scope)."

  behavior:
    navigation:
      entry:
        - "User taps the 'Collections' tab on the My Wardrobe screen."
        - "This is a tab view within My Wardrobe, not a separate pushed screen."
      item_tap:
        trigger: "User taps an item thumbnail inside a collection card."
        next_screen: "ItemDetailScreen (design/screen/home/item/design.md)"
        navigation_method: "Navigator.push"
        data_passed:
          - "OutfitItemInfo payload for the tapped item."
      add_item_tap:
        trigger: "User taps the dashed '+' placeholder in a collection card."
        next_screen: "Item picker / assign-to-collection flow (future spec)."
      search:
        - "Filters collections by name based on the query in the shared search bar."
        - "Items within collections are not searched — only the collection title is matched."
    data_model:
      collection:
        id: "String — unique identifier."
        name: "String — user-given collection name."
        items: "List<WardrobeItem> — items belonging to this collection (many-to-many with wardrobe items)."
      relationships:
        - "One item can belong to many collections."
        - "One collection can contain many items."
        - "Items are not duplicated; the collection holds references."
    data_loading:
      - "Fetch all collections with their items on tab activation."
      - "Show skeleton/shimmer cards while loading."
      - "Each collection card shows up to 4 item thumbnails from its item list."

  responsive_layout:
    - "Collection card width (350dp) scales with scaleDp; on narrow screens it may need to shrink slightly."
    - "Item thumbnail grid stays 2×2; thumbnail size scales proportionally."
    - "Scroll area includes bottom padding (~100dp) to clear the floating nav circles from MainNavShell."
    - "Avoid horizontal overflow: all content stays within the viewport."

  ux_skill_reference:
    note: "General UX rules: `.agents/skills/ui-ux-advicer/SKILL.md` in this repo."
    accessibility:
      - "Collection title: Semantics header=true for grouping."
      - "Item thumbnails: meaningful content descriptions (item name) for screen readers."
      - "Add-item slot: accessible label 'Add item to {collection name}'."
      - "Dashed border is decorative; do not rely on it alone for meaning — the '+' icon conveys the action."
    touch_and_interaction:
      - "Item thumbnails (140×140dp) exceed 48dp minimum touch target."
      - "Add-item slot (140×140dp) exceeds 48dp minimum touch target."
      - "Provide pressed states (ripple or opacity) on thumbnails, add-item slot, and collection title."
    performance:
      - "Lazy-load thumbnail images; use small thumbnails (≤ 300px) for the grid, full-res only on detail."
      - "Reserve 140×140dp space per thumbnail to prevent layout shift during load."
      - "Recycle off-screen collection cards if the list grows long."
    typography:
      - "Collection title (Playfair Display Bold 18sp) is consistent with the tab label size."
      - "No body text inside the card — the grid is the primary content."

  svg_reference_positions:
    # Exact element positions from collection.svg (402×874 canvas) for developer cross-check.
    tab_indicator:
      rect: { x: 136, y: 202, w: 6, h: 6, fill: "#FFB432" }
      line: { x1: 142, y1: 205.65, x2: 212, y2: 205.65, stroke: "#FFB432" }
    first_collection_card:
      transform: "translate(20, 256)"
      size: { w: 350, h: 373 }
      title_text: "Soft boy"
      items:
        - { x: 40, y: 302, w: 140, h: 140, fill: "#D9D9D9" }
        - { x: 210, y: 302, w: 140, h: 140, fill: "#D9D9D9" }
        - { x: 40, y: 472, w: 140, h: 140, fill: "#D9D9D9" }
        - { x: 210.5, y: 472.5, w: 139, h: 139, stroke_dasharray: "2 2", type: "add_item_slot" }
    second_collection_card:
      transform: "translate(20, 689)"
      size: { w: 350, h: 373 }
      title_text: "Quiet luxury"
      items:
        - { x: 40, y: 735, w: 140, h: 140, fill: "#D9D9D9" }
        - { x: 210, y: 735, w: 140, h: 140, fill: "#D9D9D9" }

  notes:
    - "Cross-check collection.svg and collection.png for fine spacing when implementing."
    - "The shared header/search/tab chrome is rendered by the parent My Wardrobe screen; this spec defines only the Collections tab content area."
    - "The 'By tags' tab content is separate future scope."
    - "Collection cards scroll vertically; the list can grow as the user creates more collections."
    - "Consider a 'Create new collection' button (e.g. a card with a dashed border and '+' icon, or a FAB) — not shown in the current reference design but likely needed."
    - "Title in the reference design reads 'My Wardorbe' (typo) — corrected to 'My Wardrobe' in implementation."
