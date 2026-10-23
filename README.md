# Ashen Fields — Canticles of the Seventh Star

A cross-platform 2D dark fantasy action RPG set in an autonomous, AI-driven living world.

- **Play Live in Browser (GitHub Pages)**: [**https://kingbob584828.github.io/ai-dark-fantasy-game/**](https://kingbob584828.github.io/ai-dark-fantasy-game/)
- **Download Native Android APK (GitHub Releases)**: [**AshenFields-Native-v1.0.0.apk**](https://github.com/kingbob584828/ai-dark-fantasy-game/releases/latest/download/AshenFields-Native-v1.0.0.apk) · [View All Releases](https://github.com/kingbob584828/ai-dark-fantasy-game/releases)
- **Repository**: [https://github.com/kingbob584828/ai-dark-fantasy-game](https://github.com/kingbob584828/ai-dark-fantasy-game)

---

## 1. Live Web Preview (GitHub Pages + Fullscreen Mode)

- **Live URL**: [https://kingbob584828.github.io/ai-dark-fantasy-game/](https://kingbob584828.github.io/ai-dark-fantasy-game/)
- Features a dedicated **Fullscreen** toggle button on the Title Screen, in the Top-Right HUD bar, and in the Pause/Settings menu (plus `F11` or `Alt+Enter` keyboard shortcuts).
- If launching for the first time, ensure **Settings → Pages → Build and deployment → Source** is set to **GitHub Actions** (or **Deploy from a branch → `gh-pages`**).

---

## 2. Native Android APK (GitHub Releases — Zero WebView)

- **Direct APK Download**: [AshenFields-Native-v1.0.0.apk](https://github.com/kingbob584828/ai-dark-fantasy-game/releases/latest/download/AshenFields-Native-v1.0.0.apk)
- **Releases Page**: [https://github.com/kingbob584828/ai-dark-fantasy-game/releases](https://github.com/kingbob584828/ai-dark-fantasy-game/releases)
- The `/android` directory contains a **100% Native Android application** (`com.ashenfields.rpg`) built directly on Android's hardware-accelerated `android.graphics.Canvas`, `android.view.View`, and `android.media.AudioTrack` PCM synthesizer. It contains **zero WebView components** and **zero external Maven dependencies** for fast, deterministic builds.

---

## 3. Controls (Auto-Detected Across Web & Native Android)

- **Keyboard & Mouse**: `WASD` Move · `Space` Dodge Roll (i-frames) · `Left-Click` / `J` Light Attack · `Shift+Click` / `K` Heavy Attack · `Q` / `Right-Click` Cast Spell · `F` Parry / Block · `R` Crimson Draught (Heal) · `E` Interact · `F11` Fullscreen · `Tab` AI Living World Inspector
- **Gamepad / Controller**: Left Stick Move · `X`/`RB` Light Attack · `Y`/`RT` Heavy Attack · `A`/`B` Dodge · `LB` Parry · `LT` Cast Spell · `D-Pad Up` Heal · `D-Pad Down` Interact
- **Touchscreen**: Multi-touch virtual joystick (bottom-left) and 6-button combat action cluster (`Strike`, `Heavy`, `Dodge`, `Spell`, `Parry`, `Act/Heal` on bottom-right).
