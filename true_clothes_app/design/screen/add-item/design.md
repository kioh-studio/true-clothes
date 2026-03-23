SCREEN_SPEC:
  id: add_item
  route: "/wardrobe/add-item"
  design_path: "design/screen/add-item/"
  reference_assets:
    - "add-item.svg"
    - "add-item.png"
    - "additional/addtional-1.svg"
    - "additional/additional-1.png"
    - "additional/additional-2.svg"
    - "additional/additional-2.png"

  screen:
    background_color: "#F5F5F5"

  purpose:
    short: "Two-step form for adding an existing wardrobe item to the user's closet."
    details:
      - "Users add items they already own in their physical closet — this is NOT a purchase flow."
      - "Step 1 (New Item): capture item photo, enter name, select type, and optionally write a description."
      - "Step 2 (Complete Item): enter brand, link product URL, record garment measurements, and add tags."
      - "Pressing 'Next' on step 1 navigates to step 2. Pressing 'Complete' on step 2 saves the item and returns to the wardrobe."
      - "This screen is reached from the FAB (+) button on the My Wardrobe screen, or potentially from other add-item entry points."

  flow:
    step_1:
      title: "New item"
      description: "Capture photo and basic info for the wardrobe item."
      next_action: "Navigate to step 2 (Complete Item)."

    step_2:
      title: "Complete item"
      description: "Add optional brand, product link, garment measurements, and tags."
      complete_action: "Save the item to the wardrobe and pop back to the wardrobe screen."

  # ═══════════════════════════════════════════════════════════════
  # STEP 1 — New Item
  # ═══════════════════════════════════════════════════════════════

  step_1_layout:
    header:
      components:
        - "TrueBackButton (design/component/back-button/design.md)"
      title:
        text: "New item"
        style:
          font_family: "Poppins"
          font_weight: "Bold"
          size_sp: 22
          color: "#000000"
        alignment: "center"
      back_button:
        position: "left"
        circle:
          radius_dp: 20
          fill: "#FFFEFE"
        behavior: "Navigator.pop — returns to previous screen."

    image_capture_area:
      purpose: "Tap to open camera / gallery to capture the item photo."
      position:
        x_dp: 76
        y_dp: 139
      size:
        width_dp: 250
        height_dp: 250
      background_color: "#D9D9D9"
      border_radius_dp: 0
      icon:
        type: "camera"
        color: "#000000"
        alignment: "center"
      behavior:
        - "Tapping opens a bottom sheet or system dialog to choose camera or gallery."
        - "After capture, the image replaces the placeholder."
        - "The image is stored locally until the item is saved."
      accessibility:
        label: "Take item photo"

    form_fields:
      padding_horizontal_dp: 30
      field_spacing_dp: 16

      name_field:
        label: "Name"
        required: true
        required_indicator: "* (red, #F81010)"
        label_style:
          font_family: "Poppins"
          font_weight: "SemiBold"
          size_sp: 14
          color: "#000000"
        input:
          type: "text"
          border:
            color: "#000000"
            width_dp: 0.5
          size:
            width_dp: 341.5
            height_dp: 39.5
          position_y_dp: 482
        validation:
          - "Required — must not be empty."
          - "Show inline error if user attempts to proceed without filling."

      type_field:
        label: "Type"
        required: true
        required_indicator: "* (red, #F81010)"
        label_style:
          font_family: "Poppins"
          font_weight: "SemiBold"
          size_sp: 14
          color: "#000000"
        input:
          type: "dropdown"
          border:
            color: "#000000"
            width_dp: 0.5
          size:
            width_dp: 341.5
            height_dp: 39.5
          position_y_dp: 587
          dropdown_arrow:
            icon: "triangle_down"
            color: "#1D1B20"
          options:
            - "Top item"
            - "Bottom item"
            - "Outerwear"
            - "Shoes"
            - "Accessory"
            - "Bag"
          default_value: "Bottom item"

      description_field:
        label: "Description"
        required: false
        label_style:
          font_family: "Poppins"
          font_weight: "SemiBold"
          size_sp: 14
          color: "#000000"
        input:
          type: "text"
          border:
            color: "#000000"
            width_dp: 0.5
          size:
            width_dp: 341.5
            height_dp: 39.5
          position_y_dp: 692

    next_button:
      purpose: "Navigate to step 2 when required fields are filled."
      position:
        x_dp: 312
        y_dp: 794
      size:
        width_dp: 60
        height_dp: 60
      border_radius_dp: 15
      background_color: "#FFFFFF"
      icon:
        type: "arrow_forward"
        color: "#000000"
      behavior:
        - "Enabled only when Name and Type are filled."
        - "Tapping navigates to the Complete Item screen (step 2)."
        - "Data from step 1 is passed forward."
      accessibility:
        label: "Next, go to complete item"

  # ═══════════════════════════════════════════════════════════════
  # STEP 2 — Complete Item
  # ═══════════════════════════════════════════════════════════════

  step_2_layout:
    header:
      components:
        - "TrueBackButton (design/component/back-button/design.md)"
      title:
        text: "Complete item"
        style:
          font_family: "Poppins"
          font_weight: "Bold"
          size_sp: 22
          color: "#000000"
        alignment: "center"
      back_button:
        behavior: "Navigator.pop — returns to step 1, preserving entered data."

    scrollable: true
    padding_horizontal_dp: 20

    brand_field:
      label: "Brand"
      required: false
      label_style:
        font_family: "Poppins"
        font_weight: "SemiBold"
        size_sp: 14
        color: "#000000"
      input:
        type: "text"
        placeholder: "e.g. Uniqlo"
        border:
          color: "#000000"
          width_dp: 0.5
        size:
          width_dp: 361.5
          height_dp: 39.5

    link_product_field:
      label: "Link product"
      required: false
      label_style:
        font_family: "Poppins"
        font_weight: "SemiBold"
        size_sp: 14
        color: "#000000"
      input:
        type: "url"
        placeholder: "e.g. shopee.com"
        border:
          color: "#000000"
          width_dp: 0.5
        size:
          width_dp: 361.5
          height_dp: 39.5

    separator:
      type: "horizontal_line"
      color: "#000000"
      opacity: 0.5
      margin_vertical_dp: 24

    measurement_section:
      purpose: "Optional garment measurements to help the system build better outfit recommendations."
      motivational_text:
        text: "Knowing your clothes measurement can help building best outfit as your desire"
        style:
          font_family: "Poppins"
          font_weight: "Regular"
          size_sp: 12
          color: "#000000"
          opacity: 0.5
        margin_bottom_dp: 24

      measurements:
        description: "Each measurement is context-dependent — shown based on the item Type selected in step 1."
        items_for_top:
          - "Shoulder width"
          - "Bicep"
          - "Sleeves"
        items_for_bottom:
          - "Waist"
          - "Hip"
          - "Inseam"
        items_for_shoes:
          - "Size (EU/US/UK)"

      measurement_row:
        purpose: "A single measurement input row: icon + label + value input + unit dropdown + help button."
        layout: "horizontal"
        spacing_dp: 12

        icon:
          size_dp: 45x50
          description: "Illustrative icon for the measurement (e.g. shoulder diagram, bicep diagram)."
          position: "left, above or inline with label"

        label:
          style:
            font_family: "Poppins"
            font_weight: "Bold"
            size_sp: 14
            color: "#000000"

        value_input:
          type: "number"
          placeholder: "our...secret........."
          placeholder_style:
            opacity: 0.5
          border:
            color: "#000000"
            width_dp: 0.5
          size:
            width_dp: 140.5
            height_dp: 29.5

        unit_dropdown:
          size:
            width_dp: 87
            height_dp: 34
          border_radius_dp: 6.5
          background_color: "#FFFAE0"
          border:
            color: "#000000"
            width_dp: 1
          default_value: "CM"
          options:
            - "CM"
            - "IN"
          dropdown_arrow:
            icon: "triangle_down"
            color: "#1D1B20"

        help_button:
          icon: "question_mark_circle"
          size_dp: 28
          behavior: "Tapping shows a tooltip or modal explaining how to measure this dimension."
          accessibility:
            label: "How to measure {measurement name}"

    tags_section:
      purpose: "User-defined tags to categorize the item (e.g. 'minimalism', 'menswear')."
      label:
        text: "Add tags"
        style:
          font_family: "Poppins"
          font_weight: "SemiBold"
          size_sp: 16
          color: "#000000"
      add_button:
        icon: "+"
        inline: true
        behavior: "Opens a text field or modal to type a new tag."
      tag_chip:
        padding_horizontal_dp: 12
        padding_vertical_dp: 6
        border:
          color: "#000000"
          width_dp: 0.5
          radius_dp: 16
        background_color: "transparent"
        text_style:
          font_family: "Poppins"
          font_weight: "Regular"
          size_sp: 12
          color: "#000000"
        behavior:
          - "Tap chip to remove it."
          - "Tags are free-form text entered by the user."
      demo_tags:
        - "minimalism"
        - "menswear"

    complete_button:
      purpose: "Save the item and return to the wardrobe."
      width_dp: 200
      height_dp: 50
      alignment: "center-bottom"
      margin_bottom_dp: 24
      background_color: "#000000"
      border_radius_dp: 25
      text:
        value: "Complete"
        style:
          font_family: "Poppins"
          font_weight: "SemiBold"
          size_sp: 16
          color: "#FFFFFF"
      behavior:
        - "Saves the full item (step 1 data + step 2 data) to the wardrobe."
        - "Pops back to the My Wardrobe screen."
        - "In production, this triggers an API call to persist the item on the backend."
      accessibility:
        label: "Complete and save item"

  behavior:
    navigation:
      entry:
        - "User taps the FAB (+) button on the My Wardrobe screen."
        - "Could also be reached from an 'Add item to collection' flow (future scope)."
      step_1_to_step_2:
        trigger: "User fills required fields (Name, Type) and taps the next button."
        navigation_method: "Navigator.push"
        data_passed:
          - "item_image: File? — captured photo (or null if skipped)."
          - "item_name: String — required."
          - "item_type: String — selected from dropdown."
          - "item_description: String? — optional."
      step_2_complete:
        trigger: "User taps the 'Complete' button."
        navigation_method: "Navigator.popUntil — returns to wardrobe screen."
        data_saved:
          - "All step 1 fields."
          - "brand: String? — optional."
          - "product_url: String? — optional."
          - "measurements: Map<String, MeasurementValue>? — optional, keyed by measurement name."
          - "tags: List<String> — user-defined tags."
      back_from_step_2:
        trigger: "User taps back button on step 2."
        behavior: "Returns to step 1 with previously entered data preserved."

    validation:
      step_1:
        - "Name is required."
        - "Type is required (has a default, so always valid)."
        - "Photo is strongly encouraged but not technically required (show a prompt if missing)."
      step_2:
        - "All fields are optional."
        - "Measurement values must be numeric if entered."
        - "Tags must be non-empty strings."

    data_model:
      new_item:
        image: "File? — local photo file."
        name: "String — item name (required)."
        type: "String — item category (required)."
        description: "String? — optional description."
        brand: "String? — optional brand name."
        productUrl: "String? — optional product link."
        measurements: "Map<String, MeasurementValue>? — optional garment measurements."
        tags: "List<String> — user-defined tags."
      measurement_value:
        value: "double — numeric measurement."
        unit: "String — 'CM' or 'IN'."

  responsive_layout:
    - "Form fields stretch to available width with horizontal padding (30dp step 1, 20dp step 2)."
    - "Image capture area is centered and scales proportionally."
    - "Step 2 is scrollable to accommodate varying numbers of measurement fields."
    - "Complete button stays fixed at the bottom or scrolls with content (prefer fixed)."
    - "All dimensions scale via scaleDp/scaleSp (design/responsive-ui.md)."

  ux_notes:
    accessibility:
      - "Required fields marked with red asterisk AND 'required' semantic attribute."
      - "Image capture area: accessible label 'Take item photo'."
      - "Measurement help buttons: accessible labels 'How to measure {name}'."
      - "Form inputs: proper labels for screen readers."
      - "Complete/Next buttons: meaningful accessible labels."
    interaction:
      - "Form inputs should auto-focus sequentially on 'Next' keyboard action."
      - "Dropdown for Type and Unit should use platform-native or custom picker."
      - "Tag chips should have a pressed/active state for removal."
      - "Provide feedback (snackbar/toast) on successful item save."
    performance:
      - "Image capture should be compressed before storage to save memory."
      - "Form state persists across step navigation (step 1 ↔ step 2)."

  svg_reference_positions:
    step_1:
      canvas: { w: 402, h: 874 }
      background: { fill: "#F5F5F5", stroke: "black" }
      back_button_circle: { cx: 40, cy: 40, r: 20, fill: "#FFFEFE" }
      image_area: { x: 76, y: 139, w: 250, h: 250, fill: "#D9D9D9" }
      camera_icon: { x: 175, y: 238, w: 51, h: 51 }
      name_input: { x: 30.25, y: 482.25, w: 341.5, h: 39.5 }
      name_asterisk: { fill: "#F81010" }
      type_input: { x: 30.25, y: 587.25, w: 341.5, h: 39.5 }
      type_asterisk: { fill: "#F81010" }
      type_dropdown_arrow: { fill: "#1D1B20" }
      description_input: { x: 30.25, y: 692.25, w: 341.5, h: 39.5 }
      next_button: { x: 312, y: 794, w: 60, h: 60, rx: 15, fill: "white" }

    step_2_additional_1:
      canvas: { w: 402, h: 874 }
      brand_input: { x: 20.25, y: 140.25, w: 361.5, h: 39.5 }
      link_product_input: { x: 20.25, y: 245.25, w: 361.5, h: 39.5 }
      separator_line: { x1: 20, y1: 352.5, x2: 382, y2: 352.5, stroke: "black", opacity: 0.5 }
      shoulder_icon: { x: 20, y: 449, w: 50, h: 50 }
      shoulder_input: { x: 20.25, y: 507.25, w: 140.5, h: 29.5 }
      shoulder_unit: { x: 176.5, y: 504.5, w: 87, h: 34, rx: 6.5, fill: "#FFFAE0" }
      shoulder_help: { x: 286, y: 505, w: 28, h: 28 }
      bicep_input: { x: 20.25, y: 641.25, w: 140.5, h: 29.5 }
      bicep_unit: { x: 176.5, y: 638.5, w: 87, h: 34, rx: 6.5, fill: "#FFFAE0" }
      bicep_help: { x: 286, y: 641, w: 28, h: 28 }
      sleeves_icon: { x: 20, y: 729, w: 45, h: 45 }
      sleeves_input: { x: 20.25, y: 785.25, w: 140.5, h: 29.5 }
      sleeves_unit: { x: 176.5, y: 782.5, w: 87, h: 34, rx: 6.5, fill: "#FFFAE0" }
      sleeves_help: { x: 286, y: 785, w: 28, h: 28 }

    step_2_additional_2:
      note: "Scrolled state of step 2 — shows measurements + tags + Complete button."
      shoulder_icon: { x: 21, y: 109, w: 50, h: 50 }
      shoulder_input: { x: 21.25, y: 167.25, w: 140.5, h: 29.5 }
      shoulder_unit: { x: 177.5, y: 164.5, w: 87, h: 34, rx: 6.5, fill: "#FFFAE0" }
      bicep_input: { x: 21.25, y: 301.25, w: 140.5, h: 29.5 }
      bicep_unit: { x: 177.5, y: 298.5, w: 87, h: 34, rx: 6.5, fill: "#FFFAE0" }
      sleeves_icon: { x: 21, y: 389, w: 45, h: 45 }
      sleeves_input: { x: 21.25, y: 445.25, w: 140.5, h: 29.5 }
      sleeves_unit: { x: 177.5, y: 442.5, w: 87, h: 34, rx: 6.5, fill: "#FFFAE0" }
      complete_button:
        description: "Black pill-shaped button centered at the bottom."
        style:
          background_color: "#000000"
          text_color: "#FFFFFF"
          border_radius_dp: 25
          font_family: "Poppins"
          font_weight: "SemiBold"

  notes:
    - "Step 1 and step 2 are separate screens connected by navigation, not tabs."
    - "The measurement fields shown depend on the item type selected in step 1 (e.g. tops show shoulder/bicep/sleeves, bottoms show waist/hip/inseam)."
    - "The placeholder text 'our...secret.........' in measurement inputs is a playful hint — replace with actual placeholder in implementation."
    - "The unit dropdown defaults to CM; user can switch to IN per measurement."
    - "Help (?) buttons next to each measurement open a visual guide explaining how to take that measurement."
    - "Tags section uses an inline '+' button to add new tags; existing tags appear as removable chips."
    - "Cross-check SVG positions with PNGs for fine spacing when implementing."
    - "The 'Complete item' title in the reference uses Poppins Bold (same as Kotlin implementation)."
