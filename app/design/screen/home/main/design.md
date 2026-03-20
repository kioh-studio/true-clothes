SCREEN_SPEC:
  id: home.main
  route: "/home"
  design_path: "app/design/screen/home/main/"

  # Layout reference: use main.svg in this folder (px + 402px × 874px reference). Implement responsively so all phone screens match that layout.

  purpose:
    short: "Show suggested outfits and the user's wardrobe-driven collections."
    details:
      - "Home is the first screen after onboarding is completed."
      - "Outfit suggestions should be based on the user's closet (for now)."
      - "Favourite shows outfits the user marked as favourite."
      - "Closet shows the outfits built from the user's closet items."

  sections:
    - id: outfit
      title: "Outfit"
      role: "Suggested outfits"
      data_source:
        current_impl: "Only outfits from the user’s closet."
        future: "May include mixes and/or items from online stores/brands/shops."
      cards:
        visual:
          background: "Fixed cloud background + linear colour treatment (from main.svg)."
          assets: "PNG items placed on the fixed cloud background."
          composition_placeholder:
            slot_reference_canvas_px:
              width: 500
              height: 570
            scaling_behavior:
              - "The outfit composition canvas scales uniformly to fit within the visible card/container area (both width and height), so the whole 5-slot outfit is visible without needing to scroll to see the bottom part."
            slots:
              - id: 1
                role: "pants"
                label: "1 Pants"
                size_px: { w: 350, h: 468 }
                position_px: { x: 0, y: 0 }
              - id: 2
                role: "jacket"
                label: "2 Jacket"
                size_px: { w: 150, h: 206 }
                position_px: { x: 350, y: 0 }
              - id: 3
                role: "shirt"
                label: "3 Shirt"
                size_px: { w: 150, h: 206 }
                position_px: { x: 350, y: 206 }
              - id: 4
                role: "bag"
                label: "4 Bag"
                size_px: { w: 102, h: 140 }
                position_px: { x: 350, y: 412 }
              - id: 5
                role: "shoes"
                label: "5 Shoes"
                size_px: { w: 102, h: 102 }
                position_px: { x: 0, y: 468 }
            debug_labels:
              enabled: true
              show_text_inside_each_slot: true
            image_source_support:
              - "URL (http/https) / local file path / file:// URI / content:// URI"
              - "`asset:` scheme for app bundled assets (example: `asset:jeans.png` or `asset:images/jeans.png`)"
        content:
          - "Render each suggested outfit as a card/row of item images."
          - "For MVP: show only closet-based outfits."

    - id: favourite
      title: "Favourite"
      role: "User curated outfits"
      data_source:
        current_impl: "User-selected/favourited outfits."
      cards:
        content:
          - "Render favourited outfits using the same outfit card visuals."

    - id: closet
      title: "Closet"
      role: "User's built outfits"
      data_source:
        current_impl: "Outfits built from items in the user’s closet."
      cards:
        content:
          - "Render closet outfits using the same outfit card visuals."

  layout:
    header:
      title: "TRUE CLOTHES"
      style:
        font:
          family: "Playfair Display"
          weight: "Bold"
        color: "#FFFAFA"
    body:
      type: "menu_sections"
      tabs:
        - id: outfit
          label: "Outfit"
          style:
            font:
              family: Poppins
              weight: Thin
              colorr: #FFFFFF
        - id: favourite
          label: "Favourite"
          style:
            font:
              family: Poppins
              weight: Thin
              colorr: #FFFFFF
        - id: closet
          label: "Closet"
          style:
            font:
              family: Poppins
              weight: Thin
              color: #FFFFFF


      active_content: "Show the list/cards for the selected tab."
    footer:
      type: "none_for_mvp"  # The main page uses only header + content in MVP.

  behavior:
    - "The 3 buttons represent 3 different menus: Outfit, Favourite, Closet."
    - "Tapping a menu button switches the content below to the corresponding section."
    - "Tapping an outfit card/button in the Outfit section navigates to the outfit detail screen (`/home/outfit/{outfitId}`)."
    - "Tab button color base: `#FFFFFF`."
    - "Active tab: `#FFFFFF` at full opacity (100%)."
    - "Inactive tabs: `#FFFFFF` at `70%` opacity."
    - "Tab label letter spacing: `10%`."
    - "For MVP, outfit suggestions are limited to closet-based outfits only."

  responsive_layout:
    - "Keep header visible; the body content (outfit cards) can scroll."
    - "Use scaled dimensions for all padding and elements; see app/design/responsive-ui.md."
    - "Avoid pixel-perfect absolute positioning; preserve relative spacing from main.svg."

  notes:
    - "Outfit card visuals: PNG item images on a fixed cloud background from main.svg, with a linear colour look."
    - "Home background gradient (top to bottom): `#4D5051` at `35%` opacity -> `#DCDCDC` at `100%` opacity."
    - "Once backend data is connected, sections should still reuse the same card UI so switching tabs is instant and consistent."
