import React from 'react';

export function App() {
  return (
    <div className="min-h-screen bg-[#09080c] text-[#ece5d5] font-serif flex flex-col items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-[#131018] border-2 border-[#d4af37]/60 p-8 shadow-2xl">
        <div className="text-xs tracking-[0.25em] uppercase text-[#d4af37] mb-2">
          Godot Engine 4.3 Project • GDScript 2.0 • Android APK Release
        </div>
        <h1 className="text-3xl font-bold text-[#f3e5ab] tracking-wide mb-3">
          ASHEN FIELDS: CANTICLES OF THE SEVENTH STAR
        </h1>
        <p className="text-sm text-[#b8b0a0] leading-relaxed mb-6">
          This repository is a dedicated <strong>Godot Engine 4.3</strong> dark-fantasy 2D Action RPG project targeting Android APK release. All legacy web demo and Java fallback code has been removed.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
          <div className="bg-[#1b1622] border border-[#3a3248] p-4">
            <div className="text-[#d4af37] font-bold uppercase tracking-wider mb-2">
              Godot 4.3 Architecture
            </div>
            <ul className="space-y-1.5 text-[#cfc7b8] font-mono">
              <li>• godot/project.godot (4.3 Mobile Renderer)</li>
              <li>• godot/export_presets.cfg (Android APK)</li>
              <li>• godot/scenes/Main.tscn (Root Scene)</li>
              <li>• godot/scripts/GameWorld.gd (RPG Engine)</li>
              <li>• godot/scripts/PixelArtGenerator.gd</li>
              <li>• godot/scripts/AudioSynthesizer.gd</li>
            </ul>
          </div>

          <div className="bg-[#1b1622] border border-[#3a3248] p-4">
            <div className="text-[#d4af37] font-bold uppercase tracking-wider mb-2">
              Android APK Features
            </div>
            <ul className="space-y-1.5 text-[#cfc7b8]">
              <li>• Left-side multi-touch virtual analog thumbstick</li>
              <li>• Right-side 6-button ergonomic combat cluster</li>
              <li>• 6 populated Gothic regions &amp; tactical mini-map</li>
              <li>• 7 autonomous AI NPCs with combat &amp; recruitment</li>
              <li>• 6 magic schools, 3 synergies &amp; 7 temperable weapons</li>
              <li>• Native Android haptics (Input.vibrate_handheld)</li>
            </ul>
          </div>
        </div>

        <div className="bg-[#0d0a10] border border-[#2d2538] p-4 text-xs font-mono text-[#a8a090]">
          <div className="text-[#d4af37] mb-1">GitHub Releases Android APK Output:</div>
          <div>AshenFields-Godot4-v1.0.0.apk (Built automatically via GitHub Actions with Godot 4.3)</div>
        </div>
      </div>
    </div>
  );
}

export default App;
