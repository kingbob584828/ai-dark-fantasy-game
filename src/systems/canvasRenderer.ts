import {
  RegionDefinition,
  AutonomousNPC,
  CreatureEntity,
  CorpseEntity,
  ActiveSpellZone,
  Projectile,
  GameItem,
} from '../types/game';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatingDamageText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  isCrit?: boolean;
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  heavy?: boolean;
}

export interface PlayerRenderState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  isDodging: boolean;
  isBlocking: boolean;
  isParrying: boolean;
  attackTimer: number;
  hitFlash: number;
  animTime: number;
  equippedWeapon: GameItem | null;
  equippedArmor: GameItem | null;
  umbralVeilActive: boolean;
  bloodSpotX: number | null;
  bloodSpotY: number | null;
  bloodSpotAsh: number;
}

// Snap helper for crisp pixel-cluster feel
const px = (n: number) => Math.round(n / 2) * 2;

export function renderGameWorld(
  ctx: CanvasRenderingContext2D,
  viewportW: number,
  viewportH: number,
  camX: number,
  camY: number,
  region: RegionDefinition,
  dayTime: number,
  player: PlayerRenderState,
  npcs: AutonomousNPC[],
  creatures: CreatureEntity[],
  corpses: CorpseEntity[],
  spellZones: ActiveSpellZone[],
  projectiles: Projectile[],
  particles: Particle[],
  slashes: SlashEffect[],
  floatingTexts: FloatingDamageText[],
  unlockedShortcuts: string[],
  openedChests: string[],
  globalTime: number
) {
  ctx.save();

  // 1. Base Sky / Void Backdrop with Multi-Layer Parallax
  ctx.fillStyle = region.ambientColor;
  ctx.fillRect(0, 0, viewportW, viewportH);

  // Distant Parallax Architectural / Forest Horizon Silhouettes (Layer 0.25x)
  ctx.save();
  ctx.fillStyle = 'rgba(10, 12, 18, 0.55)';
  const parallaxOffsetX = -(camX * 0.2) % 320;
  for (let i = -1; i < Math.ceil(viewportW / 320) + 2; i++) {
    const bx = px(i * 320 + parallaxOffsetX);
    // Distant spire / monolith silhouette
    ctx.fillRect(bx + 40, 0, 48, 95);
    ctx.fillRect(bx + 54, 0, 20, 130);
    ctx.fillRect(bx + 180, 0, 70, 75);
  }
  ctx.restore();

  // Translate to World Camera Coordinates
  ctx.translate(-Math.round(camX), -Math.round(camY));

  // 2. Region Arena Floor & Textured Pixel Flagstones / Moss / Cracks
  ctx.fillStyle = region.groundColorPrimary;
  ctx.fillRect(0, 0, region.width, region.height);

  // Checker / Stone Tile Cluster Pattern (culled to camera viewport)
  const tileSize = 64;
  const startCol = Math.max(0, Math.floor(camX / tileSize));
  const endCol = Math.min(Math.ceil(region.width / tileSize), Math.ceil((camX + viewportW) / tileSize));
  const startRow = Math.max(0, Math.floor(camY / tileSize));
  const endRow = Math.min(Math.ceil(region.height / tileSize), Math.ceil((camY + viewportH) / tileSize));

  for (let r = startRow; r < endRow; r++) {
    for (let c = startCol; c < endCol; c++) {
      const tx = c * tileSize;
      const ty = r * tileSize;
      const hash = ((c * 73856093) ^ (r * 19349663)) & 0xff;

      if ((r + c) % 2 === 0) {
        ctx.fillStyle = region.groundColorSecondary;
        ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
      }

      // Deliberate pixel-cluster stone cracks, moss tufts, or ash drifts
      if (hash < 45) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.fillRect(tx + 12, ty + 18, 16, 4);
        ctx.fillRect(tx + 24, ty + 22, 4, 12);
      } else if (hash > 210) {
        ctx.fillStyle =
          region.id === 'bramblewood'
            ? 'rgba(16, 185, 129, 0.14)'
            : region.id === 'cathedral'
            ? 'rgba(99, 102, 241, 0.12)'
            : 'rgba(214, 211, 209, 0.07)';
        ctx.fillRect(tx + 20, ty + 28, 12, 8);
        ctx.fillRect(tx + 28, ty + 24, 8, 6);
      }
    }
  }

  // Outer Perimeter Stone Border Wall
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, region.width - 12, region.height - 12);

  // 3. Portals & Region Transitions
  for (const portal of region.portals) {
    const isShortcutLocked =
      portal.shortcutId && !unlockedShortcuts.includes(portal.shortcutId);
    const pulse = Math.sin(globalTime * 3) * 4;

    ctx.save();
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, portal.radius + pulse, 0, Math.PI * 2);
    ctx.fillStyle = isShortcutLocked
      ? 'rgba(127, 29, 29, 0.28)'
      : 'rgba(56, 189, 248, 0.22)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isShortcutLocked ? '#ef4444' : '#38bdf8';
    ctx.stroke();

    // Inner runic threshold ring
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, portal.radius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = isShortcutLocked ? '#991b1b' : '#bae6fd';
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isShortcutLocked ? '#fca5a5' : '#e0f2fe';
    ctx.fillText(
      isShortcutLocked ? `Locked: ${portal.label}` : portal.label,
      portal.x,
      portal.y - portal.radius - 10
    );
    ctx.restore();
  }

  // 4. Active Magic Spell Zones (Graviturgy Wells, Pyromancy Tempests, Runic Sigils, Synergies)
  for (const zone of spellZones) {
    ctx.save();
    const pulse = Math.sin(globalTime * 8) * 5;
    const grad = ctx.createRadialGradient(
      zone.x,
      zone.y,
      8,
      zone.x,
      zone.y,
      zone.radius + pulse
    );

    if (zone.synergyTriggered) {
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
      grad.addColorStop(0.5, 'rgba(234, 88, 12, 0.5)');
      grad.addColorStop(1, 'rgba(147, 51, 234, 0)');
    } else if (zone.school === 'graviturgy') {
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
      grad.addColorStop(0.6, 'rgba(99, 102, 241, 0.45)');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    } else if (zone.school === 'pyromancy') {
      grad.addColorStop(0, 'rgba(251, 146, 60, 0.65)');
      grad.addColorStop(0.65, 'rgba(220, 38, 38, 0.4)');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    } else {
      grad.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
      grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.28)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Geometric Runic Ring
    ctx.strokeStyle =
      zone.school === 'graviturgy'
        ? '#818cf8'
        : zone.school === 'pyromancy'
        ? '#fb923c'
        : '#fde047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius * 0.82, globalTime * 2, globalTime * 2 + Math.PI * 1.65);
    ctx.stroke();

    if (zone.synergyName) {
      ctx.font = '700 11px "Cinzel", serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(zone.synergyName, zone.x, zone.y - zone.radius - 6);
    }
    ctx.restore();
  }

  // 5. Props, Ruins, Trees, Traps, Shrines, Monoliths & Chests
  for (const prop of region.props) {
    ctx.save();
    const x = px(prop.x - prop.width / 2);
    const y = px(prop.y - prop.height / 2);

    if (prop.type === 'bone_pyre_shrine') {
      // Stone altar base
      ctx.fillStyle = '#292524';
      ctx.fillRect(x, y + 16, prop.width, prop.height - 16);
      ctx.fillStyle = '#57534e';
      ctx.fillRect(x + 6, y + 10, prop.width - 12, 12);
      // Coiled sword in bone ash
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(prop.x - 3, y - 14, 6, 28);
      ctx.fillRect(prop.x - 11, y - 6, 22, 4);
      // Flickering ember flame
      const flameH = 18 + Math.sin(globalTime * 11) * 5;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(prop.x - 10, y + 4 - flameH * 0.5, 20, flameH);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(prop.x - 5, y + 8 - flameH * 0.4, 10, flameH * 0.6);
    } else if (prop.type === 'torch_brazier') {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(x + 4, y + 10, prop.width - 8, prop.height - 10);
      const flicker = Math.sin(globalTime * 14 + prop.x) * 4;
      ctx.fillStyle = prop.lightColor || '#f97316';
      ctx.fillRect(x + 6, y - 4 + flicker * 0.3, prop.width - 12, 16);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 10, y, prop.width - 20, 10);
    } else if (prop.type === 'moon_altar') {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(x, y + 8, prop.width, prop.height - 8);
      ctx.fillStyle = '#38bdf8';
      const floatY = Math.sin(globalTime * 4) * 4;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y - 8 + floatY, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (prop.type === 'dead_tree') {
      // Gnarled trunk & spore pods
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(prop.x - 12, prop.y - 10, 24, 42);
      ctx.fillStyle = '#292524';
      ctx.fillRect(prop.x - 28, prop.y - 28, 56, 20);
      ctx.fillRect(prop.x - 20, prop.y - 42, 40, 16);
      // Glowing blight spore clusters
      ctx.fillStyle = '#10b981';
      ctx.fillRect(prop.x - 18, prop.y - 24, 6, 6);
      ctx.fillRect(prop.x + 12, prop.y - 32, 6, 6);
    } else if (prop.type === 'lore_monolith') {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(x + 4, y, prop.width - 8, prop.height);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(prop.x - 6, y + 14, 12, 4);
      ctx.fillRect(prop.x - 8, y + 24, 16, 4);
      ctx.fillRect(prop.x - 5, y + 34, 10, 4);
    } else if (prop.type === 'treasure_chest') {
      const isOpened = openedChests.includes(prop.id);
      ctx.fillStyle = isOpened ? '#292524' : '#78350f';
      ctx.fillRect(x, y + 6, prop.width, prop.height - 6);
      ctx.fillStyle = isOpened ? '#57534e' : '#f59e0b';
      ctx.fillRect(x, y + 14, prop.width, 4);
      ctx.fillRect(prop.x - 4, y + 12, 8, 8);
    } else if (prop.type === 'spike_trap') {
      const cycle = (globalTime * 1.2) % 3.0;
      const spikesUp = cycle > 2.0;
      const warning = cycle > 1.3 && cycle <= 2.0;
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x, y, prop.width, prop.height);
      ctx.strokeStyle = warning ? '#f59e0b' : spikesUp ? '#ef4444' : '#3f3f46';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, prop.width, prop.height);
      for (let sx = x + 12; sx < x + prop.width - 8; sx += 18) {
        for (let sy = y + 12; sy < y + prop.height - 8; sy += 18) {
          ctx.fillStyle = spikesUp ? '#e11d48' : warning ? '#fbbf24' : '#52525b';
          ctx.fillRect(sx - 3, sy - (spikesUp ? 10 : 3), 6, spikesUp ? 14 : 6);
        }
      }
    } else if (prop.type === 'shortcut_gate') {
      const unlocked = prop.shortcutId && unlockedShortcuts.includes(prop.shortcutId);
      ctx.fillStyle = unlocked ? '#10b981' : '#f59e0b';
      ctx.fillRect(x + 8, y + 8, prop.width - 16, prop.height - 16);
    } else {
      // Ruined pillars, gothic arches, sarcophagi, fortress barricades
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 6, y + 8, prop.width, prop.height);
      ctx.fillStyle = '#27272a';
      ctx.fillRect(x, y, prop.width, prop.height);
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, prop.width, prop.height);
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(x + 6, y + 6, prop.width - 12, 8);
    }
    ctx.restore();
  }

  // 6. Corpses (with Environmental Lore & Scavenger status)
  for (const corpse of corpses) {
    ctx.save();
    ctx.fillStyle = corpse.scavenged ? 'rgba(127, 29, 29, 0.45)' : 'rgba(153, 27, 27, 0.7)';
    ctx.beginPath();
    ctx.ellipse(corpse.x, corpse.y + 4, 18, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ribcage / cloak pixel clusters
    ctx.fillStyle = corpse.scavenged ? '#78716c' : '#d6d3d1';
    ctx.fillRect(px(corpse.x - 10), px(corpse.y - 4), 20, 8);
    ctx.fillStyle = '#44403c';
    ctx.fillRect(px(corpse.x - 6), px(corpse.y - 6), 12, 10);

    if (!corpse.scavenged && (corpse.lootItemIds.length > 0 || corpse.ashValue > 0)) {
      const lootGlow = Math.sin(globalTime * 5) * 3;
      ctx.fillStyle = corpse.isLoreCorpse ? '#38bdf8' : '#fbbf24';
      ctx.beginPath();
      ctx.arc(corpse.x, corpse.y - 10 + lootGlow, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 7. Player Recoverable Death Bloodstain (if any)
  if (player.bloodSpotX !== null && player.bloodSpotY !== null && player.bloodSpotAsh > 0) {
    ctx.save();
    const pulse = Math.sin(globalTime * 6) * 4;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(player.bloodSpotX, player.bloodSpotY, 22 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Remnant Ash (${player.bloodSpotAsh})`, player.bloodSpotX, player.bloodSpotY - 28);
    ctx.restore();
  }

  // 8. Autonomous Creatures & Bosses
  for (const c of creatures) {
    if (c.hp <= 0) continue;
    ctx.save();
    const bob = Math.sin(c.animTime * 6) * 3;
    const r = 18 * c.scale;

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + r * 0.85, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Attack Telegraph Windup Ring & Cone!
    if (c.aiState === 'windup') {
      const progress = Math.min(1, 1 - c.stateTimer / Math.max(0.1, c.windupDuration));
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.arc(c.x, c.y, c.attackRange, c.facing - 0.65, c.facing + 0.65);
      ctx.closePath();
      ctx.fillStyle = `rgba(239, 68, 68, ${0.18 + progress * 0.35})`;
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Creature Silhouette by Role/Archetype
    ctx.fillStyle = c.hitFlash > 0 ? '#ffffff' : c.colorPrimary;
    if (c.isBoss) {
      // Malakor, the Hollowed Seraph: 6-Winged Corrupted Seraphic Silhouette + Phase Halo
      const wingSpread = 36 + Math.sin(globalTime * 5) * 6;
      ctx.fillStyle = c.bossPhase === 3 ? '#e11d48' : c.bossPhase === 2 ? '#9333ea' : '#4f46e5';
      // 3 pairs of jagged wings
      for (let w = -1; w <= 1; w++) {
        ctx.fillRect(px(c.x - wingSpread), px(c.y + w * 12 - 8 + bob), wingSpread * 2, 8);
      }
      // Armored torso
      ctx.fillStyle = c.hitFlash > 0 ? '#ffffff' : '#e7e5e4';
      ctx.fillRect(px(c.x - 16), px(c.y - 24 + bob), 32, 44);
      // Burning Crown Halo
      ctx.strokeStyle = c.bossPhase === 3 ? '#f43f5e' : '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 30 + bob, 16, 0, Math.PI * 2);
      ctx.stroke();
    } else if (c.role === 'prey') {
      // Antlered Ashen Stag
      ctx.fillRect(px(c.x - 14), px(c.y - 8 + bob), 28, 16);
      ctx.fillStyle = c.colorSecondary;
      ctx.fillRect(px(c.x + 8), px(c.y - 22 + bob), 6, 16);
      // Antlers
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px(c.x + 4), px(c.y - 28 + bob), 14, 3);
    } else if (c.role === 'predator') {
      // Blight Hound with glowing spore pustules
      ctx.fillRect(px(c.x - 16), px(c.y - 9 + bob), 32, 18);
      ctx.fillStyle = c.colorSecondary;
      ctx.fillRect(px(c.x - 8), px(c.y - 12 + bob), 6, 6);
      ctx.fillRect(px(c.x + 4), px(c.y - 11 + bob), 6, 6);
    } else {
      // Humanoid Knight / Ghoul / Spirit / Miniboss
      const w = px(22 * c.scale);
      const h = px(30 * c.scale);
      ctx.fillRect(px(c.x - w / 2), px(c.y - h / 2 + bob), w, h);
      ctx.fillStyle = c.colorSecondary;
      ctx.fillRect(px(c.x - w / 3), px(c.y - h / 2 - 6 + bob), px((w * 2) / 3), 8);
    }

    // Health bar & AI State Tag above creature
    if (c.hp < c.maxHp || c.isMiniboss || c.aiState !== 'patrol') {
      const barW = c.isMiniboss ? 68 : 44;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(c.x - barW / 2, c.y - r - 18, barW, 5);
      ctx.fillStyle = c.role === 'prey' ? '#38bdf8' : '#ef4444';
      ctx.fillRect(c.x - barW / 2, c.y - r - 18, barW * Math.max(0, c.hp / c.maxHp), 5);
    }
    ctx.restore();
  }

  // 9. Autonomous NPCs
  for (const npc of npcs) {
    if (!npc.alive) continue;
    ctx.save();
    const bob = Math.sin(globalTime * 4 + npc.x) * 2;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(npc.x, npc.y + 16, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cloak & Armor
    ctx.fillStyle = npc.hitFlash > 0 ? '#ffffff' : npc.colorCloak;
    ctx.fillRect(px(npc.x - 12), px(npc.y - 14 + bob), 24, 28);
    ctx.fillStyle = npc.colorArmor;
    ctx.fillRect(px(npc.x - 8), px(npc.y - 10 + bob), 16, 18);
    // Head & Hood
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(px(npc.x - 6), px(npc.y - 22 + bob), 12, 10);
    ctx.fillStyle = npc.colorAccent;
    ctx.fillRect(px(npc.x - 7), px(npc.y - 24 + bob), 14, 4);

    // NPC Nameplate & Live Autonomous Action
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = npc.isCompanion ? '#34d399' : '#fde68a';
    ctx.fillText(npc.name, npc.x, npc.y - 34);
    ctx.font = '500 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#a8a29e';
    ctx.fillText(npc.currentAction, npc.x, npc.y - 23);
    ctx.restore();
  }

  // 10. Player Character
  ctx.save();
  if (player.umbralVeilActive) {
    ctx.globalAlpha = 0.48;
  }
  const pBob = Math.hypot(player.vx, player.vy) > 5 ? Math.sin(player.animTime * 12) * 3 : Math.sin(globalTime * 4) * 1.5;

  // Dodge afterimage
  if (player.isDodging) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.fillRect(px(player.x - player.vx * 0.04 - 11), px(player.y - player.vy * 0.04 - 16), 22, 32);
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 17, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cloak & Armor Silhouette
  ctx.fillStyle = player.hitFlash > 0 ? '#ffffff' : '#1e293b';
  ctx.fillRect(px(player.x - 12), px(player.y - 14 + pBob), 24, 28);
  ctx.fillStyle = player.hitFlash > 0 ? '#ffffff' : '#94a3b8';
  ctx.fillRect(px(player.x - 8), px(player.y - 10 + pBob), 16, 18);
  // Head & Tarnished Helm
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(px(player.x - 7), px(player.y - 23 + pBob), 14, 11);
  // Crimson scarf accent
  ctx.fillStyle = '#be123c';
  ctx.fillRect(px(player.x - 9), px(player.y - 12 + pBob), 18, 4);

  // Equipped Weapon rendered along facing angle
  ctx.save();
  ctx.translate(player.x, player.y + pBob);
  const swingOffset = player.attackTimer > 0 ? Math.sin(player.attackTimer * 22) * 0.85 : 0;
  ctx.rotate(player.facing + swingOffset);
  const wpnCat = player.equippedWeapon?.weaponCategory || 'sword';
  ctx.fillStyle = wpnCat === 'catalyst' ? '#818cf8' : '#e2e8f0';
  const bladeLen =
    wpnCat === 'greatsword' || wpnCat === 'spear'
      ? 36
      : wpnCat === 'dagger'
      ? 18
      : 26;
  ctx.fillRect(10, -2, bladeLen, 4);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(8, -6, 4, 12);
  ctx.restore();

  // Parry / Block Shield Aura
  if (player.isBlocking || player.isParrying) {
    ctx.strokeStyle = player.isParrying ? '#fde047' : '#38bdf8';
    ctx.lineWidth = player.isParrying ? 3 : 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 24, player.facing - 1.1, player.facing + 1.1);
    ctx.stroke();
  }
  ctx.restore();

  // 11. Weapon Slash Arcs & Projectiles
  for (const s of slashes) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.heavy ? 8 : 5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, s.angle - s.arc / 2, s.angle + s.arc / 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const proj of projectiles) {
    ctx.save();
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    if (proj.runicEmpowered) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 12. Atmospheric Particles (Ash, Spores, Embers, Blood drops)
  for (const pt of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.alpha * (pt.life / pt.maxLife));
    ctx.fillStyle = pt.color;
    ctx.fillRect(px(pt.x), px(pt.y), pt.size, pt.size);
    ctx.restore();
  }

  // 13. Floating Combat Numbers & Status Callouts
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.font = ft.isCrit ? '700 14px "JetBrains Mono", monospace' : '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  // 14. Dynamic Lighting & Contrast Pass (Warm Torchlight vs Cold Moonlight)
  ctx.save();
  for (const prop of region.props) {
    if (!prop.lightColor || !prop.lightRadius) continue;
    const flicker = Math.sin(globalTime * 10 + prop.x) * 8;
    const rad = prop.lightRadius + flicker;
    const grad = ctx.createRadialGradient(prop.x, prop.y, 6, prop.x, prop.y, rad);
    grad.addColorStop(0, prop.lightColor + '44');
    grad.addColorStop(0.5, prop.lightColor + '18');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player personal lantern warm rim glow
  const pGlow = ctx.createRadialGradient(player.x, player.y, 8, player.x, player.y, 190);
  pGlow.addColorStop(0, 'rgba(251, 191, 36, 0.16)');
  pGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = pGlow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // 15. Screen-Space Atmospheric Vignette (Low-occlusion, preserves 85%+ clear viewport)
  const vig = ctx.createRadialGradient(
    viewportW / 2,
    viewportH / 2,
    viewportW * 0.32,
    viewportW / 2,
    viewportH / 2,
    viewportW * 0.65
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(6, 7, 10, 0.62)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, viewportW, viewportH);
}
