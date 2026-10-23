# Ashen Fields — Canticles of the Seventh Star

A cross-platform 2D dark fantasy action RPG set in an autonomous, AI-driven living world—built with a **Godot 4.3 Engine Project (`/godot/`)**, a **100% Native Android Engine (`/android/`)**, and a **Phaser 3 / HTML5 Live Web Build**.

- **Play Live in Browser (GitHub Pages)**: [**https://kingbob584828.github.io/ai-dark-fantasy-game/**](https://kingbob584828.github.io/ai-dark-fantasy-game/)
- **Play Godot 4.3 WebAssembly Export**: [**https://kingbob584828.github.io/ai-dark-fantasy-game/godot/**](https://kingbob584828.github.io/ai-dark-fantasy-game/godot/)
- **Download Godot 4.3 Android APK (GitHub Releases)**: [**AshenFields-Godot4-v1.0.0.apk**](https://github.com/kingbob584828/ai-dark-fantasy-game/releases/latest/download/AshenFields-Godot4-v1.0.0.apk)
- **Download Native Android APK (GitHub Releases)**: [**AshenFields-Native-v1.0.0.apk**](https://github.com/kingbob584828/ai-dark-fantasy-game/releases/latest/download/AshenFields-Native-v1.0.0.apk) · [View All Releases](https://github.com/kingbob584828/ai-dark-fantasy-game/releases)
- **Download Godot 4.3 Engine Project**: [**AshenFields-Godot4-Engine-Project.zip**](https://github.com/kingbob584828/ai-dark-fantasy-game/releases/latest/download/AshenFields-Godot4-Engine-Project.zip)
- **Repository**: [https://github.com/kingbob584828/ai-dark-fantasy-game](https://github.com/kingbob584828/ai-dark-fantasy-game)

---

## 1. Godot 4.3 Engine Project (`/godot/`)

The `/godot` directory contains a complete, standalone **Godot Engine 4.3** project written in **GDScript (`.gd`)**:
- `/godot/project.godot` — Godot 4.3 project configuration (`GL Compatibility` renderer, 1280×720 expandable viewport, nearest-neighbor pixel filtering).
- `/godot/export_presets.cfg` — Pre-configured Web (WASM) and Android APK export presets.
- `/godot/scenes/Main.tscn` — Root scene node.
- `/godot/scripts/GameWorld.gd` — Core 2D RPG simulation (6 populated regions with Gothic buildings, cobblestone roads, harvestable resource nodes, autonomous NPCs with real-time waypoints/speech bubbles/combat, multi-role creature ecology, and cross-school magic synergies).
- `/godot/scripts/PixelArtGenerator.gd` — Procedural `Image` / `ImageTexture` pixel-art sprite baker (zero external `.import` cache required).
- `/godot/scripts/AudioSynthesizer.gd` — Real-time `AudioStreamGenerator` procedural dark-fantasy audio synthesizer.

To open or export locally in **Godot 4.3**:
```bash
godot --path ./godot
# Or headless export:
godot --headless --path ./godot --export-release "Web" ../dist/godot/index.html
godot --headless --path ./godot --export-release "Android" ../AshenFields-Godot4-Android.apk
```

---

## 2. Live Web Preview (GitHub Pages + Fullscreen Mode)

- **Live URL**: [https://kingbob584828.github.io/ai-dark-fantasy-game/](https://kingbob584828.github.io/ai-dark-fantasy-game/)
- Features a dedicated **Fullscreen** toggle button on the Title Screen, in the Top-Right HUD bar, and in the Pause/Settings menu (plus `F11` or `Alt+Enter` keyboard shortcuts), a live **Tactical Mini-Map Radar**, and an interactive world populated with Gothic buildings, cobblestone crossroads, harvestable resource nodes, and autonomous NPCs.

---

## 3. Native Android APK (GitHub Releases — Zero WebView)

- **Direct APK Download**: [AshenFields-Native-v1.0.0.apk](https://github.com/kingbob584828/ai-dark-fantasy-game/releases/latest/download/AshenFields-Native-v1.0.0.apk)
- **Releases Page**: [https://github.com/kingbob584828/ai-dark-fantasy-game/releases](https://github.com/kingbob584828/ai-dark-fantasy-game/releases)
- The `/android` directory contains a **100% Native Android application** (`com.ashenfields.rpg`) built directly on Android's hardware-accelerated `android.graphics.Canvas`, `android.view.View`, `HapticFeedbackConstants`, and `android.media.AudioTrack` PCM synthesizer. It contains **zero WebView components**.

---

## 4. Controls (Auto-Detected Across Godot 4, Web & Native Android)

- **Keyboard & Mouse**: `WASD` Move · `Space` Dodge Roll (i-frames) · `Left-Click` / `J` Light Attack · `Shift+Click` / `K` Heavy Attack · `Q` / `Right-Click` Cast Spell · `F` Parry / Block · `R` Crimson Draught (Heal) · `E` Interact / Harvest · `F11` Fullscreen · `Tab` AI Living World Inspector
- **Gamepad / Controller**: Left Stick Move · `X`/`RB` Light Attack · `Y`/`RT` Heavy Attack · `A`/`B` Dodge · `LB` Parry · `LT` Cast Spell · `D-Pad Up` Heal · `D-Pad Down` Interact
- **Touchscreen**: 8-way analog virtual thumbstick (bottom-left) and 6-button combat action cluster (`Strike`, `Heavy`, `Dodge`, `Spell`, `Parry`, `Act` on bottom-right).
