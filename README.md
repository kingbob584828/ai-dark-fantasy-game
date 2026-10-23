# Ashen Fields — Canticles of the Seventh Star (Godot Engine 4.3 Android RPG)

**Ashen Fields: Canticles of the Seventh Star** is a complete 2D dark-fantasy open-world Action RPG built purely in **Godot Engine 4.3** using **GDScript 2.0**, procedural 16-bit Gothic pixel art (`Image` / `ImageTexture`), real-time polyphonic audio synthesis (`AudioStreamGenerator`), and multi-touch Android controls.

---

## Download Signed Godot 4.3 Android APK

- **GitHub Releases (Latest Android APK)**: [https://github.com/kingbob584828/ai-dark-fantasy-game/releases](https://github.com/kingbob584828/ai-dark-fantasy-game/releases)
  - **`AshenFields-Godot4-v1.0.0.apk`** — Signed Android release APK exported directly by **Godot Engine 4.3 (`--export-release "Android"`)**.
  - **`AshenFields-Godot4-Engine-Project.zip`** — Complete Godot 4.3 project source archive.

---

## Godot 4.3 Project Structure

The project can be opened in **Godot Engine 4.3+** directly from either the repository root (`/project.godot`) or `/godot/project.godot`:

- `godot/project.godot` — Godot 4.3 configuration (`1280x720` landscape viewport with `canvas_items` scaling and `expand` aspect ratio, `gl_compatibility` mobile renderer, nearest-neighbor pixel filtering).
- `godot/export_presets.cfg` — Configured Android APK export preset (`com.ashenfields.rpg`, portrait/sensor-landscape support, vibration permission enabled).
- `godot/scenes/Main.tscn` — Primary `Node2D` scene running the full game world and HUD canvas.
- `godot/scripts/GameWorld.gd` — Complete 2D Action RPG engine featuring:
  - **6 Populated Regions**: *Oakhaven Vigil*, *The Weeping Woods*, *Drowned Fens*, *Whispering Barrow*, *Sunken Reliquary*, and *The Star-Crater*.
  - **Gothic World Architecture**: Multi-tile stone buildings, cobblestone roads, wooden bridges, water & lava pools, restoration shrines, Star-Iron anvils, lore monoliths, loot chests, and harvestable resource nodes.
  - **7 Autonomous AI NPCs**: Real-time waypoint schedules, overhead speech bubbles, active combat against nearby monsters, multi-branch dialogue trees, item bartering, and companion recruitment (`Sister Meridia`, `Garrick the Temperer`, `Blind Seer Oakhaven`, `Caelen theellsword`, `Mire-Witch Vespera`, `Scholar Orin`, `gravetender`).
  - **Deep RPG Systems**: 6 attributes (`Vigor`, `Endurance`, `Might`, `Dexterity`, `Arcana`, `Faith`), 7 weapons with Star-Iron tempering (`+1` to `+5`), 4 armors, 6 magic schools (`Pyromancy`, `Cryomancy`, `Stormcalling`, `Abyssal`, `Aetherial`, `Verdict`), and 3 cross-school spell synergies.
  - **Ergonomic Mobile Controls & HUD**: Bottom-left multi-touch virtual analog thumbstick with sprint ring, bottom-right 6-button combat cluster (`STRIKE`, `ROLL`, `CAST`, `CYCLE`, `HEAL`, `TALK`), top-right tactical mini-map radar, full-screen `CHAR`, `QUESTS`, and `MAP` modals, and persistent save/load (`user://ashen_fields_save.json`).
  - **Native Android Haptics**: Hardware vibration feedback via `Input.vibrate_handheld()` on melee swings, heavy crits, dodges, and damage impacts.
- `godot/scripts/PixelArtGenerator.gd` — Runtime procedural 16-bit dark-fantasy sprite sheet generator (`Image.create` + `ImageTexture.create_from_image`) with 2-frame walk animations and hit-flash states.
- `godot/scripts/AudioSynthesizer.gd` — Real-time procedural 44.1kHz PCM audio synthesizer (`AudioStreamGenerator`) generating ambient drones and combat SFX with zero external audio files required.

---

## Building the Android APK Locally with Godot 4.3

```bash
godot --headless --path ./godot --import
godot --headless --path ./godot --export-release "Android" ./AshenFields-Godot4-v1.0.0.apk
```
