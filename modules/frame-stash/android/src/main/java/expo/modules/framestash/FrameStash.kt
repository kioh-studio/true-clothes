package expo.modules.framestash

class StashedFrame(val id: Int, val width: Int, val height: Int, val bytes: ByteArray)

/** Holds at most 2 frames; a new put evicts the oldest. In RAM only, never written to disk. */
object FrameStash {
  private const val MAX = 2
  private val entries = ArrayList<StashedFrame>()
  private var nextId = 1

  @Synchronized
  fun put(width: Int, height: Int, bytes: ByteArray): Int {
    val id = nextId++
    entries.add(StashedFrame(id, width, height, bytes))
    while (entries.size > MAX) entries.removeAt(0)
    return id
  }

  @Synchronized
  fun take(id: Int): StashedFrame? {
    val i = entries.indexOfFirst { it.id == id }
    return if (i < 0) null else entries.removeAt(i)
  }

  @Synchronized
  fun clear() = entries.clear()
}
