package expo.modules.framestash

import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS side: take(id) -> Uint8Array RGBA (removes the entry) | null; clear(). */
class FrameStashModule : Module() {
  companion object {
    init {
      // Registered when this class loads (app start), before any frame processor binds.
      FrameProcessorPluginRegistry.addFrameProcessorPlugin("stashFrame") { _, _ -> StashFramePlugin() }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("FrameStash")
    Function("take") { id: Int -> FrameStash.take(id)?.bytes }
    Function("clear") { FrameStash.clear() }
  }
}
