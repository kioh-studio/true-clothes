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
