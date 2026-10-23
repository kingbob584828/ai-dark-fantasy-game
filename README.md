# Ashen Fields — Canticles of the Seventh Star

A cross-platform 2D dark fantasy action RPG set in an autonomous, AI-driven living world.

---

## 1. Live Web Preview (GitHub Pages + Fullscreen Mode)

The web edition features a dedicated **Fullscreen** button on the Title Screen, in the Top-Right HUD bar, and in the Pause/Settings menu (as well as the `F11` or `Alt+Enter` shortcut).

### Activate Your Live GitHub Pages Preview:
1. Open your repository on GitHub and go to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Once the **Build & Release Live Web Preview + Native Android APK** workflow finishes, your live web preview link (`https://<username>.github.io/<repo-name>/`) will be live.

---

## 2. Native Android APK (GitHub Releases — No WebView)

The `/android` directory contains a **100% Native Android application** written in **Kotlin + Jetpack Compose `Canvas` + Android `AudioTrack` PCM synthesis** (`com.ashenfields.rpg`). It does **not** use a WebView.

### Download the Native APK:
1. On every push to `main`/`master`, GitHub Actions automatically compiles and signs `AshenFields-Native-v1.0.0.apk` and publishes it to your repository's **Releases** section (`v1.0.0`).
2. Go to the **Releases** sidebar on your GitHub repository and download **`AshenFields-Native-v1.0.0.apk`** onto any Android phone, tablet, or handheld gaming device.

---

## 3. Controls (Auto-Detected Across Web & Native Android)

- **Keyboard & Mouse**: `WASD` Move · `Space` Dodge Roll (i-frames) · `Left-Click` / `J` Light Attack · `Shift+Click` / `K` Heavy Attack · `Q` / `Right-Click` Cast Spell · `F` Parry / Block · `R` Crimson Draught (Heal) · `E` Interact · `F11` Fullscreen · `Tab` AI Living World Inspector
- **Gamepad / Controller**: Left Stick Move · `X`/`RB` Light Attack · `Y`/`RT` Heavy Attack · `A`/`B` Dodge · `LB` Parry · `LT` Cast Spell · `D-Pad Up` Heal · `D-Pad Down` Interact
- **Touchscreen**: Virtual joystick and 6-button combat action cluster (`Strike`, `Heavy`, `Dodge`, `Spell`, `Parry`, `Act/Heal`).
