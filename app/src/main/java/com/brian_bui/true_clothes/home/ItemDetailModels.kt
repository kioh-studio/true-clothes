package com.brian_bui.true_clothes.home

import com.brian_bui.true_clothes.shared.components.OutfitCompositionSources

/**
 * Product category drives which measurement keys are shown on the item detail screen
 * (see `app/design/screen/home/item/design.md`).
 */
enum class ItemCategory {
    Top,
    Bottom,
    Outwear,
    Shoes,
    Accessory,
}

/**
 * Full item payload for outfit rows and item detail until a database exists.
 * Later: home/outfit screens will hold [itemId] lists only; UI loads rows via repository.
 */
data class OutfitItemInfo(
    val itemId: String? = null,
    val name: String,
    val itemColor: String,
    val form: String,
    val aesthetic: String,
    val material: String,
    val imageSource: String?,
    val actionText: String,
    val fullName: String,
    val brand: String,
    val productUrl: String?,
    val category: ItemCategory,
    val measurements: Map<String, String>,
)

/**
 * What we pass from home → outfit detail. Later: load [items] by [outfitId] from DB instead.
 */
data class OutfitDetailPayload(
    val outfitId: String? = null,
    val title: String,
    val tags: List<String>,
    val items: List<OutfitItemInfo>,
)

/**
 * Maps items into the five composition slots for [OutfitCompositionCardPlaceholder].
 * Prefers category match; falls back to list index (demo order: bottom, outwear, top, accessory, shoes).
 */
fun OutfitDetailPayload.toCompositionSources(): OutfitCompositionSources {
    val byCategory = items.groupBy { it.category }
    fun firstImage(cat: ItemCategory, indexFallback: Int): String? =
        byCategory[cat]?.firstOrNull()?.imageSource ?: items.getOrNull(indexFallback)?.imageSource

    return OutfitCompositionSources(
        pants = firstImage(ItemCategory.Bottom, 0),
        jacket = firstImage(ItemCategory.Outwear, 1),
        shirt = firstImage(ItemCategory.Top, 2),
        bag = firstImage(ItemCategory.Accessory, 3),
        shoes = firstImage(ItemCategory.Shoes, 4),
    )
}

data class ItemDetailUi(
    val itemId: String? = null,
    val imageSource: String?,
    val fullName: String,
    val color: String,
    val brand: String,
    val productUrl: String?,
    val category: ItemCategory,
    val measurementUnitNote: String = "All values in cm",
    val measurements: Map<String, String>,
)

fun OutfitItemInfo.toItemDetailUi(): ItemDetailUi =
    ItemDetailUi(
        itemId = itemId,
        imageSource = imageSource,
        fullName = fullName,
        color = itemColor,
        brand = brand,
        productUrl = productUrl,
        category = category,
        measurements = measurements,
    )

/** Stand-in until outfits are loaded from the backend / local DB. */
fun demoOutfitDetailPayload(): OutfitDetailPayload =
    OutfitDetailPayload(
        outfitId = "demo-outfit-gentlemen",
        title = "The gentlemen",
        tags = listOf(
            "minimalism",
            "menswear",
            "classic",
            "sunny day",
            "formal",
            "quiet luxury",
        ),
        items = listOf(
            OutfitItemInfo(
                itemId = "demo-item-jeans",
                name = "Jean pants",
                itemColor = "NAVI",
                form = "Regular fit",
                aesthetic = "Quiet luxury",
                material = "50% polyester, 50% cotton",
                imageSource = "asset:images/jeans.png",
                actionText = "Go to closet",
                fullName = "Slim taper indigo stretch denim jeans",
                brand = "A.P.C.",
                productUrl = "https://example.com/products/slim-jeans",
                category = ItemCategory.Bottom,
                measurements = mapOf(
                    "waist" to "81 cm",
                    "inseam" to "81 cm",
                    "thigh" to "58 cm",
                    "knee" to "38 cm",
                    "leg_opening" to "34 cm",
                    "rise" to "26 cm",
                ),
            ),
            OutfitItemInfo(
                itemId = "demo-item-harrington",
                name = "Harrington Jacket",
                itemColor = "BEIGE",
                form = "Oversize",
                aesthetic = "Old money",
                material = "70% wool, 30% viscose",
                imageSource = "asset:images/harrington.png",
                actionText = "Go to closet",
                fullName = "Cotton-blend Harrington jacket",
                brand = "Baracuta",
                productUrl = "https://example.com/products/harrington",
                category = ItemCategory.Outwear,
                measurements = mapOf(
                    "chest" to "104 cm",
                    "shoulder" to "48 cm",
                    "sleeves" to "65 cm",
                    "length" to "68 cm",
                    "bicep" to "36 cm",
                ),
            ),
            OutfitItemInfo(
                itemId = "demo-item-shirt",
                name = "Shirt",
                itemColor = "Black",
                form = "Wide fit",
                aesthetic = "Formal",
                material = "100% cotton",
                imageSource = "asset:images/shirt.png",
                actionText = "Go to shop",
                fullName = "Poplin spread-collar dress shirt",
                brand = "Brooks Brothers",
                productUrl = "https://example.com/products/poplin-shirt",
                category = ItemCategory.Top,
                measurements = mapOf(
                    "chest" to "98 cm",
                    "sleeves" to "64 cm",
                    "shoulder" to "45 cm",
                    "bicep" to "34 cm",
                    "length" to "78 cm",
                ),
            ),
            OutfitItemInfo(
                itemId = "demo-item-bag",
                name = "Bag",
                itemColor = "Black",
                form = "Regular fit",
                aesthetic = "Casual",
                material = "100% leather",
                imageSource = "asset:images/bag.png",
                actionText = "Go to shop",
                fullName = "Crossbody leather mini bag",
                brand = "COS",
                productUrl = "https://example.com/products/crossbody-bag",
                category = ItemCategory.Accessory,
                measurements = mapOf(
                    "length" to "22 cm",
                    "width" to "18 cm",
                    "height" to "8 cm",
                    "strap_drop" to "55 cm",
                ),
            ),
            OutfitItemInfo(
                itemId = "demo-item-shoes",
                name = "Shoes",
                itemColor = "Black",
                form = "Regular fit",
                aesthetic = "Casual",
                material = "60% leather, 40% rubber",
                imageSource = "asset:images/shoes.png",
                actionText = "Go to closet",
                fullName = "Leather derby shoes",
                brand = "Dr. Martens",
                productUrl = "https://example.com/products/derby",
                category = ItemCategory.Shoes,
                measurements = mapOf(
                    "size_us" to "9",
                    "size_eu" to "42",
                    "foot_length" to "27 cm",
                    "width" to "D",
                    "instep" to "24 cm",
                ),
            ),
        ),
    )

private val MeasurementKeyOrder: Map<ItemCategory, List<String>> = mapOf(
    ItemCategory.Top to listOf("chest", "sleeves", "shoulder", "bicep", "length"),
    ItemCategory.Bottom to listOf("waist", "inseam", "thigh", "knee", "leg_opening", "rise"),
    ItemCategory.Outwear to listOf("chest", "shoulder", "sleeves", "length", "bicep"),
    ItemCategory.Shoes to listOf("size_us", "size_eu", "foot_length", "width", "instep"),
    ItemCategory.Accessory to listOf("length", "width", "height", "circumference", "strap_drop"),
)

private val MeasurementLabels: Map<String, String> = mapOf(
    "chest" to "Chest",
    "sleeves" to "Sleeves",
    "shoulder" to "Shoulder",
    "bicep" to "Bicep",
    "length" to "Length",
    "waist" to "Waist",
    "inseam" to "Inseam",
    "thigh" to "Thigh",
    "knee" to "Knee",
    "leg_opening" to "Leg opening",
    "rise" to "Rise",
    "size_us" to "Size (US)",
    "size_eu" to "Size (EU)",
    "foot_length" to "Foot length",
    "width" to "Width",
    "instep" to "Instep",
    "height" to "Height",
    "circumference" to "Circumference",
    "strap_drop" to "Strap drop",
)

/**
 * Ordered label/value rows for display; skips empty or missing values.
 */
fun measurementRowsFor(category: ItemCategory, measurements: Map<String, String>): List<Pair<String, String>> {
    val order = MeasurementKeyOrder[category].orEmpty()
    return order.mapNotNull { key ->
        val raw = measurements[key]?.trim().orEmpty()
        if (raw.isEmpty()) return@mapNotNull null
        val label = MeasurementLabels[key] ?: key
        label to raw
    }
}
