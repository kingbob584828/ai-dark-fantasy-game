# Ashen Fields — Canticles of the Seventh Star

A complete, playable 2D dark fantasy action RPG set in an autonomous, AI-driven living world.

## Play Directly on GitHub (GitHub Pages)

This repository includes an automatic GitHub Pages deployment workflow (`.github/workflows/deploy.yml`) and relative asset bundling (`base: './'`).

To enable the live playable link on GitHub:
1. Open your repository on GitHub and go to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Wait ~60 seconds for the **Deploy Ashen Fields to GitHub Pages** action to finish in the **Actions** tab.
4. Click your live URL (`https://<your-username>.github.io/<your-repo-name>/`) to play in any browser on desktop, controller, or mobile touchscreen.

## Play Locally

```bash
npm install
npm run dev
```
Then open `http://localhost:3000` in your browser.

## Controls (Auto-Detected)

- **Keyboard & Mouse**: `WASD` Move · `Space` Dodge Roll (i-frames) · `Left-Click` / `J` Light Attack · `Shift+Click` / `K` Heavy Attack · `Q` / `Right-Click` Cast Spell · `F` Parry / Block · `R` Crimson Draught (Heal) · `E` Interact · `I` Inventory · `G` Grimoire · `M` World Map · `Tab` AI Living World Inspector
- **Gamepad / Controller**: Left Stick Move · `X`/`RB` Light Attack · `Y`/`RT` Heavy Attack · `A`/`B` Dodge · `LB` Parry · `LT` Cast Spell · `D-Pad Up` Heal · `D-Pad Down` Interact
- **Touchscreen**: Virtual directional pad and on-screen combat action cluster appear automatically on touch devices.
