import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActiveModalTab,
  Attributes,
  AutonomousNPC,
  CorpseEntity,
  CreatureEntity,
  EquipSlot,
  GameItem,
  GameScreenState,
  InputDeviceMode,
  Projectile,
  Quest,
  RegionId,
  SpellDefinition,
  WorldSimulationState,
  ActiveSpellZone,
} from './types/game';
import {
  CRAFTING_RECIPES,
  INITIAL_SPELLS,
  ITEMS_CATALOG,
} from './data/itemsAndSpells';
import {
  INITIAL_CORPSES,
  INITIAL_CREATURES,
  INITIAL_NPCS,
  INITIAL_QUESTS,
  REGIONS,
} from './data/worldAndEntities';
import {
  FloatingDamageText,
  Particle,
  renderGameWorld,
  SlashEffect,
} from './systems/canvasRenderer';
import {
  evaluateEpistemicDialogueDeterministic,
  evaluateNPCUtilityAndTickWorld,
} from './systems/aiWorldSimulation';
import { audioEngine } from './systems/audioEngine';
import { GameModals } from './components/GameModals';

const SAVE_STORAGE_KEY = 'ashen_fields_save_v1';

const cloneItem = (id: string, quantity = 1): GameItem => ({
  ...ITEMS_CATALOG[id],
  quantity,
});

export default function App() {
  // Game Screen & Modal State
  const [screenState, setScreenState] = useState<GameScreenState>('TITLE_MENU');
  const [activeModal, setActiveModal] = useState<ActiveModalTab>('none');
  const [inputMode, setInputMode] = useState<InputDeviceMode>(() => {
    if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      return window.innerWidth < 960 ? 'touch' : 'keyboard_mouse';
    }
    return 'keyboard_mouse';
  });
  const [muted, setMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = useCallback(async () => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };

      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // If inside a restricted iframe without fullscreen attribute, inform user
      engineRef.current.bannerMessage =
        'Fullscreen blocked by preview frame · Open Shared App URL or GitHub Pages in a new tab for Fullscreen';
      engineRef.current.bannerTimer = 4.5;
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Player Progression & RPG State (Synced with mutable engine ref for 60fps loop)
  const [level, setLevel] = useState<number>(1);
  const [ash, setAsh] = useState<number>(180);
  const [attributes, setAttributes] = useState<Attributes>({
    vitality: 10,
    endurance: 10,
    strength: 11,
    dexterity: 11,
    intelligence: 11,
    willpower: 10,
    arcana: 10,
  });

  const [inventory, setInventory] = useState<GameItem[]>(() => [
    cloneItem('wpn_ashen_broadsword', 1),
    cloneItem('wpn_umbral_misericorde', 1),
    cloneItem('wpn_graviton_censer', 1),
    cloneItem('eq_watchman_helm', 1),
    cloneItem('eq_vigil_brigandine', 1),
    cloneItem('eq_iron_gauntlets', 1),
    cloneItem('eq_gravewalker_greaves', 1),
    cloneItem('eq_ring_of_cinders', 1),
    cloneItem('item_ashen_flask', 4),
    cloneItem('item_ether_phial', 3),
    cloneItem('item_purging_moss', 2),
    cloneItem('mat_star_iron_shard', 2),
  ]);

  const [equipped, setEquipped] = useState<Record<EquipSlot, GameItem | null>>(() => ({
    weapon: cloneItem('wpn_ashen_broadsword', 1),
    offhand: null,
    helmet: cloneItem('eq_watchman_helm', 1),
    armor: cloneItem('eq_vigil_brigandine', 1),
    gloves: cloneItem('eq_iron_gauntlets', 1),
    boots: cloneItem('eq_gravewalker_greaves', 1),
    ring: cloneItem('eq_ring_of_cinders', 1),
    talisman: null,
  }));

  const [spells, setSpells] = useState<SpellDefinition[]>(INITIAL_SPELLS);
  const [activeSpellId, setActiveSpellId] = useState<string>('spell_gravity_well');
  const [currentRegion, setCurrentRegion] = useState<RegionId>('oakhaven');
  const [npcs, setNpcs] = useState<AutonomousNPC[]>(INITIAL_NPCS);
  const [quests, setQuests] = useState<Quest[]>(INITIAL_QUESTS);
  const [activeNpcId, setActiveNpcId] = useState<string | null>(null);

  const [worldState, setWorldState] = useState<WorldSimulationState>({
    tickCount: 1,
    dayTime: 0.25,
    settlementFood: 58,
    settlementMedicine: 64,
    settlementMorale: 70,
    cinderCovenantPower: 52,
    umbralSynodPower: 48,
    bastionController: 'cinder_covenant',
    unlockedShortcuts: [],
    openedChests: [],
    discoveredLoreIds: [],
    reputation: {
      cinder_covenant: 10,
      umbral_synod: 0,
      oakhaven_survivors: 15,
    },
    events: [
      {
        id: 'evt_init_1',
        timestamp: 1,
        title: 'Ash-Frost Settles Over Oakhaven',
        description:
          'Survivors huddle near the First Ember Pyre while Cinder Covenant wardens and Umbral Synod agents contest the northern Bastion.',
        regionId: 'oakhaven',
        category: 'ecology',
        consequence: 'Living world simulation initialized',
      },
    ],
    endingUnlocked: null,
  });

  // HUD Readouts updated periodically from the 60fps engine
  const [hudStats, setHudStats] = useState({
    hp: 260,
    maxHp: 260,
    stamina: 180,
    maxStamina: 180,
    mana: 180,
    maxMana: 180,
    interactPrompt: null as string | null,
    bossName: null as string | null,
    bossTitle: null as string | null,
    bossHp: 0,
    bossMaxHp: 1,
    bossPhase: 1,
    bannerToast: null as string | null,
    statusSummary: [] as string[],
  });

  // Isolated Canvas & Mutable Engine State for 60fps Game Loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const engineRef = useRef({
    screenState: 'TITLE_MENU' as GameScreenState,
    activeModal: 'none' as ActiveModalTab,
    regionId: 'oakhaven' as RegionId,
    level: 1,
    ash: 180,
    attributes: {
      vitality: 10,
      endurance: 10,
      strength: 11,
      dexterity: 11,
      intelligence: 11,
      willpower: 10,
      arcana: 10,
    } as Attributes,
    equipped: {
      weapon: cloneItem('wpn_ashen_broadsword', 1),
      offhand: null,
      helmet: cloneItem('eq_watchman_helm', 1),
      armor: cloneItem('eq_vigil_brigandine', 1),
      gloves: cloneItem('eq_iron_gauntlets', 1),
      boots: cloneItem('eq_gravewalker_greaves', 1),
      ring: cloneItem('eq_ring_of_cinders', 1),
      talisman: null,
    } as Record<EquipSlot, GameItem | null>,
    spells: INITIAL_SPELLS,
    activeSpellId: 'spell_gravity_well',
    npcs: INITIAL_NPCS.map((n) => ({ ...n })),
    creatures: INITIAL_CREATURES.map((c) => ({ ...c })),
    corpses: INITIAL_CORPSES.map((c) => ({ ...c })),
    worldState: null as unknown as WorldSimulationState,
    // Player real-time physics & combat state
    player: {
      x: 900,
      y: 740,
      vx: 0,
      vy: 0,
      facing: -Math.PI / 2,
      hp: 260,
      maxHp: 260,
      stamina: 180,
      maxStamina: 180,
      mana: 180,
      maxMana: 180,
      poise: 45,
      maxPoise: 45,
      dodgeTimer: 0,
      dodgeCooldown: 0,
      attackTimer: 0,
      attackCooldown: 0,
      parryWindow: 0,
      isBlocking: false,
      hitFlash: 0,
      animTime: 0,
      umbralVeilTimer: 0,
      damageBuffTimer: 0,
      footstepTimer: 0,
      bloodSpotRegion: null as RegionId | null,
      bloodSpotX: null as number | null,
      bloodSpotY: null as number | null,
      bloodSpotAsh: 0,
      lastShrineRegion: 'oakhaven' as RegionId,
      lastShrineX: 900,
      lastShrineY: 710,
    },
    spellZones: [] as ActiveSpellZone[],
    projectiles: [] as Projectile[],
    particles: [] as Particle[],
    slashes: [] as SlashEffect[],
    floatingTexts: [] as FloatingDamageText[],
    spellCooldowns: {} as Record<string, number>,
    hitstopTimer: 0,
    shakeIntensity: 0,
    camX: 200,
    camY: 150,
    globalTime: 0,
    aiSimAccumulator: 0,
    bannerMessage: null as string | null,
    bannerTimer: 0,
    // Input State
    keysHeld: new Set<string>(),
    mouseWorldX: 900,
    mouseWorldY: 600,
    mouseScreenX: 600,
    mouseScreenY: 400,
    touchMoveX: 0,
    touchMoveY: 0,
    gamepadPrevButtons: [] as boolean[],
  });

  // Sync React state into engineRef
  useEffect(() => {
    engineRef.current.screenState = screenState;
    engineRef.current.activeModal = activeModal;
    engineRef.current.regionId = currentRegion;
    engineRef.current.level = level;
    engineRef.current.ash = ash;
    engineRef.current.attributes = attributes;
    engineRef.current.equipped = equipped;
    engineRef.current.spells = spells;
    engineRef.current.activeSpellId = activeSpellId;
    engineRef.current.worldState = worldState;

    // Recalculate Max HP / Stamina / Mana from Attributes + Equipment Stat Bonuses
    const bonusVit = Object.values(equipped).reduce((s, i) => s + (i?.statBonuses?.vitality || 0), 0);
    const bonusEnd = Object.values(equipped).reduce((s, i) => s + (i?.statBonuses?.endurance || 0), 0);
    const bonusWil = Object.values(equipped).reduce((s, i) => s + (i?.statBonuses?.willpower || 0), 0);

    const p = engineRef.current.player;
    p.maxHp = 100 + (attributes.vitality + bonusVit) * 16;
    p.maxStamina = 80 + (attributes.endurance + bonusEnd) * 10;
    p.maxMana = 60 + (attributes.willpower + bonusWil) * 12;
    p.hp = Math.min(p.hp, p.maxHp);
    p.stamina = Math.min(p.stamina, p.maxStamina);
    p.mana = Math.min(p.mana, p.maxMana);
  }, [
    screenState,
    activeModal,
    currentRegion,
    level,
    ash,
    attributes,
    equipped,
    spells,
    activeSpellId,
    worldState,
  ]);

  const showBanner = useCallback((msg: string) => {
    engineRef.current.bannerMessage = msg;
    engineRef.current.bannerTimer = 4.2;
  }, []);

  const addFloatingText = (x: number, y: number, text: string, color: string, isCrit = false) => {
    engineRef.current.floatingTexts.push({
      id: `${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      life: 1.1,
      isCrit,
    });
  };

  const spawnParticles = (
    x: number,
    y: number,
    count: number,
    color: string,
    speed = 90,
    size = 4
  ) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      engineRef.current.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size,
        color,
        alpha: 1,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
      });
    }
  };

  // ==================== CORE COMBAT & INTERACTION ACTIONS ====================
  const triggerPlayerAttack = useCallback((heavy: boolean) => {
    const eng = engineRef.current;
    if (eng.screenState !== 'PLAYING' || eng.activeModal !== 'none') return;
    const p = eng.player;
    if (p.attackCooldown > 0 || p.dodgeTimer > 0) return;

    const wpn = eng.equipped.weapon || ITEMS_CATALOG.wpn_ashen_broadsword;
    const stamCost = Math.round((wpn.staminaCost || 14) * (heavy ? 1.65 : 1.0));
    if (p.stamina < stamCost) {
      addFloatingText(p.x, p.y - 26, 'Low Stamina', '#94a3b8');
      return;
    }

    p.stamina -= stamCost;
    const speed = wpn.attackSpeed || 1.4;
    p.attackTimer = heavy ? 0.34 : 0.22;
    p.attackCooldown = (heavy ? 0.72 : 0.45) / speed;

    audioEngine.playSwing(heavy);

    // Calculate scaled damage
    const strScale =
      wpn.scaling?.strength === 'S'
        ? 2.2
        : wpn.scaling?.strength === 'A'
        ? 1.7
        : wpn.scaling?.strength === 'B'
        ? 1.3
        : 0.8;
    const dexScale =
      wpn.scaling?.dexterity === 'S'
        ? 2.2
        : wpn.scaling?.dexterity === 'A'
        ? 1.7
        : wpn.scaling?.dexterity === 'B'
        ? 1.3
        : 0.8;

    let totalDmg =
      (wpn.baseDamage || 30) +
      (wpn.magicDamage || 0) +
      (wpn.upgradeLevel || 0) * 8 +
      eng.attributes.strength * strScale +
      eng.attributes.dexterity * dexScale;

    if (heavy) totalDmg *= 1.55;
    if (p.damageBuffTimer > 0) totalDmg *= 1.25;

    let isUmbralAmbush = false;
    if (p.umbralVeilTimer > 0) {
      totalDmg *= 2.2;
      p.umbralVeilTimer = 0;
      isUmbralAmbush = true;
    }

    // If Ranged Bow -> spawn arrow projectile (which can also pass through Runic Sigils!)
    if (wpn.weaponCategory === 'bow') {
      eng.projectiles.push({
        id: `arrow_${Date.now()}_${Math.random()}`,
        regionId: eng.regionId,
        x: p.x + Math.cos(p.facing) * 18,
        y: p.y + Math.sin(p.facing) * 18,
        vx: Math.cos(p.facing) * (heavy ? 520 : 430),
        vy: Math.sin(p.facing) * (heavy ? 520 : 430),
        radius: heavy ? 7 : 5,
        damage: Math.round(totalDmg),
        poiseDamage: wpn.poiseDamage || 16,
        ownerId: 'player',
        isPlayer: true,
        color: heavy ? '#fbbf24' : '#e2e8f0',
        life: 1.2,
      });
      return;
    }

    const reach = (wpn.reach || 64) * (heavy ? 1.18 : 1.0);
    const arcRad = (((wpn.arcDegrees || 110) * Math.PI) / 180) * (heavy ? 1.2 : 1.0);

    eng.slashes.push({
      x: p.x,
      y: p.y,
      angle: p.facing,
      arc: arcRad,
      radius: reach * 0.85,
      color: isUmbralAmbush
        ? '#38bdf8'
        : heavy
        ? '#f59e0b'
        : '#e2e8f0',
      life: heavy ? 0.24 : 0.16,
      maxLife: heavy ? 0.24 : 0.16,
      heavy,
    });

    // Check melee hits against creatures in current region
    let hitAny = false;
    for (const c of eng.creatures) {
      if (c.regionId !== eng.regionId || c.hp <= 0) continue;
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= reach + 18 * c.scale) {
        let angleDiff = Math.atan2(dy, dx) - p.facing;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) <= arcRad * 0.62 || dist < 28) {
          hitAny = true;
          const isStaggerCrit = c.aiState === 'staggered';
          const finalDmg = Math.round(totalDmg * (isStaggerCrit ? 1.6 : 1.0));
          c.hp -= finalDmg;
          c.poise -= (wpn.poiseDamage || 20) * (heavy ? 1.6 : 1.0);
          c.hitFlash = 0.15;

          // Knockback impulse
          const kb = heavy ? 160 : 90;
          c.vx += Math.cos(p.facing) * kb;
          c.vy += Math.sin(p.facing) * kb;

          // Weapon status effect or passive
          if (wpn.statusInflict) {
            c.statusEffects.push({
              type: wpn.statusInflict.type,
              duration: 5.0,
              intensity: wpn.statusInflict.amount,
            });
          }
          if (wpn.id === 'wpn_blight_cleaver_axe' && heavy) {
            p.hp = Math.min(p.maxHp, p.hp + 8);
          }

          // Poise Break Stagger
          if (c.poise <= 0 && c.aiState !== 'staggered') {
            c.aiState = 'staggered';
            c.stateTimer = 2.0;
            c.poise = c.maxPoise;
            addFloatingText(c.x, c.y - 36, 'STAGGERED!', '#fbbf24', true);
            audioEngine.playParryClang();
          }

          spawnParticles(c.x, c.y, heavy ? 14 : 8, '#be123c', 120, 4);
          addFloatingText(
            c.x,
            c.y - 20,
            isUmbralAmbush
              ? `PHANTOM CRIT ${finalDmg}!`
              : isStaggerCrit
              ? `RIPOSTE ${finalDmg}!`
              : `${finalDmg}`,
            isUmbralAmbush ? '#38bdf8' : isStaggerCrit || heavy ? '#fbbf24' : '#f8fafc',
            isUmbralAmbush || isStaggerCrit || heavy
          );
        }
      }
    }

    if (hitAny) {
      audioEngine.playHit(heavy, isUmbralAmbush);
      eng.hitstopTimer = heavy || isUmbralAmbush ? 0.065 : 0.035;
      eng.shakeIntensity = heavy || isUmbralAmbush ? 7 : 3.5;
    }
  }, []);

  const triggerPlayerDodge = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screenState !== 'PLAYING' || eng.activeModal !== 'none') return;
    const p = eng.player;
    if (p.dodgeTimer > 0 || p.dodgeCooldown > 0) return;

    const hasBrigandine = eng.equipped.armor?.id === 'eq_vigil_brigandine';
    const cost = hasBrigandine ? 16 : 20;
    if (p.stamina < cost) return;

    p.stamina -= cost;
    p.dodgeTimer = 0.28; // i-frames active during dodgeTimer
    p.dodgeCooldown = 0.46;
    audioEngine.playDodge();
    spawnParticles(p.x, p.y + 10, 6, '#94a3b8', 60, 3);
  }, []);

  const triggerParryOrBlock = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screenState !== 'PLAYING' || eng.activeModal !== 'none') return;
    const p = eng.player;
    if (p.parryWindow <= 0 && p.stamina >= 12) {
      p.parryWindow = 0.26; // 260ms active parry deflection window
      p.stamina -= 10;
      audioEngine.playSwing(false);
    }
  }, []);

  const triggerCastSpell = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screenState !== 'PLAYING' || eng.activeModal !== 'none') return;
    const p = eng.player;
    const spell = eng.spells.find((s) => s.id === eng.activeSpellId) || eng.spells[0];
    if (!spell) return;

    const cd = eng.spellCooldowns[spell.id] || 0;
    if (cd > 0) {
      addFloatingText(p.x, p.y - 26, `${spell.name} (${cd.toFixed(1)}s)`, '#94a3b8');
      return;
    }

    const hasHollowStarRing = eng.equipped.ring?.id === 'eq_ring_of_hollow_star';
    const manaCost = Math.round(spell.manaCost * (hasHollowStarRing ? 0.85 : 1.0));
    if (p.mana < manaCost) {
      addFloatingText(p.x, p.y - 26, 'Insufficient Mana', '#38bdf8');
      return;
    }
    if (spell.healthCost > 0 && p.hp <= spell.healthCost + 5) {
      addFloatingText(p.x, p.y - 26, 'Too Weak for Blood Sacrifice', '#f43f5e');
      return;
    }

    p.mana -= manaCost;
    if (spell.healthCost > 0) {
      p.hp -= spell.healthCost;
      spawnParticles(p.x, p.y, 10, '#e11d48', 80, 4);
    }
    eng.spellCooldowns[spell.id] = spell.cooldown;

    const catalystBonus = eng.equipped.weapon?.weaponCategory === 'catalyst' ? 1.25 : 1.0;
    const statVal = eng.attributes[spell.scalingStat] || 10;
    const power = Math.round(
      (spell.basePower + (spell.masteryLevel - 1) * 12 + statVal * 2.4) * catalystBonus
    );

    const targetX = p.x + Math.cos(p.facing) * Math.min(spell.range, 165);
    const targetY = p.y + Math.sin(p.facing) * Math.min(spell.range, 165);

    if (spell.type === 'zone' || spell.type === 'glyph_trap') {
      const newZone: ActiveSpellZone = {
        id: `zone_${Date.now()}_${Math.random()}`,
        regionId: eng.regionId,
        x: spell.type === 'glyph_trap' ? p.x + Math.cos(p.facing) * 75 : targetX,
        y: spell.type === 'glyph_trap' ? p.y + Math.sin(p.facing) * 75 : targetY,
        radius: spell.radius * (eng.equipped.weapon?.weaponCategory === 'catalyst' ? 1.15 : 1.0),
        school: spell.school,
        spellId: spell.id,
        duration: 6.5,
        maxDuration: 6.5,
        ownerId: 'player',
        power,
      };

      // CHECK CROSS-SCHOOL MAGIC SYNERGY: Graviturgy + Pyromancy = Singularity Conflagration!
      for (const existing of eng.spellZones) {
        if (existing.regionId !== eng.regionId) continue;
        const dist = Math.hypot(existing.x - newZone.x, existing.y - newZone.y);
        const isGravPyro =
          (existing.school === 'graviturgy' && newZone.school === 'pyromancy') ||
          (existing.school === 'pyromancy' && newZone.school === 'graviturgy');

        if (isGravPyro && dist < existing.radius + newZone.radius) {
          existing.synergyTriggered = true;
          existing.synergyName = 'SINGULARITY CONFLAGRATION!';
          newZone.synergyTriggered = true;
          newZone.synergyName = 'SINGULARITY CONFLAGRATION!';
          audioEngine.playSpellCast(spell.school, true);
          eng.hitstopTimer = 0.075;
          eng.shakeIntensity = 12;
          spawnParticles(newZone.x, newZone.y, 32, '#f97316', 210, 6);
          spawnParticles(newZone.x, newZone.y, 24, '#a855f7', 180, 5);
          addFloatingText(
            newZone.x,
            newZone.y - 30,
            'SYNERGY: SINGULARITY CONFLAGRATION!',
            '#fef08a',
            true
          );

          // Deal massive AoE implosion damage + stagger to all nearby enemies
          for (const c of eng.creatures) {
            if (c.regionId !== eng.regionId || c.hp <= 0) continue;
            if (Math.hypot(c.x - newZone.x, c.y - newZone.y) <= newZone.radius * 1.65) {
              const synDmg = Math.round(power * 2.4);
              c.hp -= synDmg;
              c.poise -= 65;
              c.hitFlash = 0.25;
              c.statusEffects.push({ type: 'burning', duration: 6, intensity: 25 });
              addFloatingText(c.x, c.y - 24, `${synDmg}`, '#fb923c', true);
            }
          }
          break;
        }
      }

      eng.spellZones.push(newZone);
      audioEngine.playSpellCast(spell.school, false);
    } else if (spell.type === 'projectile') {
      // Bloodcraft Sanguine Lance
      eng.projectiles.push({
        id: `proj_${Date.now()}_${Math.random()}`,
        regionId: eng.regionId,
        x: p.x + Math.cos(p.facing) * 20,
        y: p.y + Math.sin(p.facing) * 20,
        vx: Math.cos(p.facing) * 460,
        vy: Math.sin(p.facing) * 460,
        radius: 8,
        damage: power,
        poiseDamage: 28,
        ownerId: 'player',
        isPlayer: true,
        school: spell.school,
        color: spell.colorPrimary,
        life: 1.1,
        statusInflict: 'bleeding',
      });
      audioEngine.playSpellCast(spell.school, false);
    } else if (spell.type === 'self_buff') {
      // Umbral Phantom Veil
      p.umbralVeilTimer = 4.5;
      p.x = Math.max(40, Math.min(REGIONS[eng.regionId].width - 40, p.x + Math.cos(p.facing) * 95));
      p.y = Math.max(40, Math.min(REGIONS[eng.regionId].height - 40, p.y + Math.sin(p.facing) * 95));
      spawnParticles(p.x, p.y, 18, '#38bdf8', 110, 4);
      addFloatingText(p.x, p.y - 26, 'UMBRAL VEIL ACTIVE', '#38bdf8', true);
      audioEngine.playSpellCast(spell.school, false);
    } else if (spell.type === 'nova') {
      // Vitalism Verdant Suture + Bloodcraft Synergy ("Hemorrhagic Harvest")
      let healAmt = power;
      let triggeredBloodSynergy = false;
      for (const c of eng.creatures) {
        if (c.regionId !== eng.regionId || c.hp <= 0) continue;
        if (Math.hypot(c.x - p.x, c.y - p.y) <= spell.radius * 1.45) {
          const isBleeding = c.statusEffects.some((s) => s.type === 'bleeding');
          if (isBleeding) {
            triggeredBloodSynergy = true;
            const burst = Math.round(power * 1.85);
            c.hp -= burst;
            c.poise -= 45;
            healAmt += 35;
            spawnParticles(c.x, c.y, 18, '#e11d48', 140, 5);
            addFloatingText(c.x, c.y - 28, `HEMORRHAGIC HARVEST ${burst}!`, '#f43f5e', true);
          }
        }
      }
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      // Also heal companion NPC if present
      for (const n of eng.npcs) {
        if (n.alive && n.isCompanion && n.regionId === eng.regionId) {
          n.hp = Math.min(n.maxHp, n.hp + healAmt);
        }
      }
      spawnParticles(p.x, p.y, 20, '#10b981', 100, 4);
      addFloatingText(
        p.x,
        p.y - 26,
        triggeredBloodSynergy ? `SYNERGY HEAL +${healAmt} HP!` : `+${healAmt} HP`,
        '#34d399',
        triggeredBloodSynergy
      );
      audioEngine.playSpellCast(spell.school, triggeredBloodSynergy);
    }
  }, []);

  const triggerQuickHeal = useCallback(() => {
    const flask = inventory.find((i) => i.id === 'item_ashen_flask' && i.quantity > 0);
    if (!flask) {
      addFloatingText(
        engineRef.current.player.x,
        engineRef.current.player.y - 26,
        'No Crimson Draughts Left',
        '#f43f5e'
      );
      return;
    }
    const p = engineRef.current.player;
    p.hp = Math.min(p.maxHp, p.hp + (flask.effectValue || 65));
    spawnParticles(p.x, p.y, 14, '#f59e0b', 80, 4);
    addFloatingText(p.x, p.y - 26, `+${flask.effectValue || 65} HP`, '#34d399', true);
    audioEngine.playShrineChime();
    setInventory((prev) =>
      prev
        .map((it) => (it.id === 'item_ashen_flask' ? { ...it, quantity: it.quantity - 1 } : it))
        .filter((it) => it.quantity > 0)
    );
  }, [inventory]);

  // Interact with nearby NPC, Shrine, Chest, Monolith, Shortcut, or Corpse
  const triggerInteract = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screenState !== 'PLAYING') return;
    if (eng.activeModal !== 'none') {
      setActiveModal('none');
      return;
    }

    const p = eng.player;
    const reg = REGIONS[eng.regionId];

    // 1. Check Recoverable Death Remnant Bloodstain
    if (
      p.bloodSpotRegion === eng.regionId &&
      p.bloodSpotX !== null &&
      p.bloodSpotY !== null &&
      Math.hypot(p.x - p.bloodSpotX, p.y - p.bloodSpotY) < 65
    ) {
      const recovered = p.bloodSpotAsh;
      p.bloodSpotAsh = 0;
      p.bloodSpotX = null;
      p.bloodSpotY = null;
      setAsh((prev) => prev + recovered);
      audioEngine.playShrineChime();
      showBanner(`RECOVERED ${recovered} REMNANT ASH`);
      return;
    }

    // 2. Check Autonomous NPCs
    for (const npc of eng.npcs) {
      if (npc.alive && npc.regionId === eng.regionId) {
        if (Math.hypot(p.x - npc.x, p.y - npc.y) < 85) {
          setActiveNpcId(npc.id);
          setNpcs([...eng.npcs]);
          setActiveModal('dialogue');
          return;
        }
      }
    }

    // 3. Check Corpses
    for (const corpse of eng.corpses) {
      if (
        corpse.regionId === eng.regionId &&
        !corpse.scavenged &&
        Math.hypot(p.x - corpse.x, p.y - corpse.y) < 75
      ) {
        corpse.scavenged = true;
        if (corpse.ashValue > 0) {
          setAsh((prev) => prev + corpse.ashValue);
        }
        if (corpse.lootItemIds.length > 0) {
          setInventory((prev) => {
            const next = [...prev];
            corpse.lootItemIds.forEach((id) => {
              const template = ITEMS_CATALOG[id];
              if (!template) return;
              const existing = next.find((i) => i.id === id && i.stackable);
              if (existing) {
                existing.quantity += 1;
              } else {
                next.push(cloneItem(id, 1));
              }
            });
            return next;
          });
        }
        if (corpse.id === 'corpse_catacomb_tomas') {
          setQuests((prev) =>
            prev.map((q) =>
              q.id === 'q_missing_apprentice'
                ? {
                    ...q,
                    stages: q.stages.map((s) =>
                      s.id === 'stage_find_tomas' ? { ...s, completed: true } : s
                    ),
                  }
                : q
            )
          );
        }
        audioEngine.playShrineChime();
        showBanner(
          corpse.loreText
            ? `${corpse.name}: ${corpse.loreText}`
            : `Looted ${corpse.name} (+${corpse.ashValue} Ash)`
        );
        return;
      }
    }

    // 4. Check Region Props (Shrines, Chests, Lore Monoliths, Shortcuts)
    for (const prop of reg.props) {
      if (!prop.interactable) continue;
      if (Math.hypot(p.x - prop.x, p.y - prop.y) < 88) {
        if (prop.type === 'bone_pyre_shrine') {
          p.hp = p.maxHp;
          p.stamina = p.maxStamina;
          p.mana = p.maxMana;
          p.lastShrineRegion = eng.regionId;
          p.lastShrineX = prop.x;
          p.lastShrineY = prop.y + 64;
          audioEngine.playShrineChime();
          setActiveModal('shrine');
          return;
        } else if (prop.type === 'treasure_chest') {
          if (!eng.worldState.openedChests.includes(prop.id)) {
            const nextChests = [...eng.worldState.openedChests, prop.id];
            setWorldState((prev) => ({ ...prev, openedChests: nextChests }));
            const lootNames: string[] = [];
            setInventory((prev) => {
              const next = [...prev];
              (prop.chestLootIds || []).forEach((id) => {
                const tmpl = ITEMS_CATALOG[id];
                if (!tmpl) return;
                lootNames.push(tmpl.name);
                const ex = next.find((i) => i.id === id && i.stackable);
                if (ex) ex.quantity += 1;
                else next.push(cloneItem(id, 1));
              });
              return next;
            });
            if ((prop.chestLootIds || []).includes('relic_first_choir_chalice')) {
              setQuests((prev) =>
                prev.map((q) =>
                  q.id === 'q_choked_hearth'
                    ? {
                        ...q,
                        stages: q.stages.map((s) =>
                          s.id === 'stage_chalice' ? { ...s, completed: true } : s
                        ),
                      }
                    : q
                )
              );
            }
            audioEngine.playShrineChime();
            showBanner(`Acquired: ${lootNames.join(' · ')}`);
            return;
          }
        } else if (prop.type === 'lore_monolith') {
          if (!eng.worldState.discoveredLoreIds.includes(prop.id)) {
            setWorldState((prev) => ({
              ...prev,
              discoveredLoreIds: [...prev.discoveredLoreIds, prop.id],
            }));
          }
          audioEngine.playShrineChime();
          showBanner(`${prop.loreTitle}: ${prop.loreText}`);
          return;
        } else if (prop.type === 'shortcut_gate' && prop.shortcutId) {
          if (!eng.worldState.unlockedShortcuts.includes(prop.shortcutId)) {
            setWorldState((prev) => ({
              ...prev,
              unlockedShortcuts: [...prev.unlockedShortcuts, prop.shortcutId!],
            }));
            audioEngine.playParryClang();
            showBanner('COUNTERWEIGHT GATE UNLOCKED: Oakhaven Crypt Shortcut Open');
          }
          return;
        }
      }
    }
  }, [showBanner]);

  // ==================== KEYBOARD, MOUSE, GAMEPAD & TOUCH INPUT LISTENERS ====================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }

      setInputMode('keyboard_mouse');
      const key = e.key.toLowerCase();
      engineRef.current.keysHeld.add(key);

      if (key === 'f11' || (e.altKey && key === 'enter')) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (engineRef.current.screenState === 'TITLE_MENU') {
        if (key === 'enter' || key === ' ') {
          e.preventDefault();
          setScreenState('PLAYING');
          audioEngine.updateAmbientDrone('oakhaven');
        }
        return;
      }

      if (key === 'escape') {
        e.preventDefault();
        if (engineRef.current.activeModal !== 'none') {
          setActiveModal('none');
        } else {
          setScreenState((prev) => (prev === 'PAUSED' ? 'PLAYING' : 'PAUSED'));
        }
        return;
      }

      if (key === 'i') {
        e.preventDefault();
        setNpcs([...engineRef.current.npcs]);
        setActiveModal((prev) => (prev === 'inventory' ? 'none' : 'inventory'));
        return;
      }
      if (key === 'c') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'character' ? 'none' : 'character'));
        return;
      }
      if (key === 'g') {
        e.preventDefault();
        setActiveModal((prev) => (prev === 'grimoire' ? 'none' : 'grimoire'));
        return;
      }
      if (key === 'm') {
        e.preventDefault();
        setNpcs([...engineRef.current.npcs]);
        setActiveModal((prev) => (prev === 'map' ? 'none' : 'map'));
        return;
      }
      if (key === 'tab') {
        e.preventDefault();
        setNpcs([...engineRef.current.npcs]);
        setActiveModal((prev) => (prev === 'world_ai' ? 'none' : 'world_ai'));
        return;
      }

      if (engineRef.current.activeModal !== 'none') return;

      if (key === ' ') {
        e.preventDefault();
        triggerPlayerDodge();
      } else if (key === 'j') {
        triggerPlayerAttack(e.shiftKey);
      } else if (key === 'k') {
        triggerPlayerAttack(true);
      } else if (key === 'q') {
        triggerCastSpell();
      } else if (key === 'f') {
        triggerParryOrBlock();
      } else if (key === 'r') {
        triggerQuickHeal();
      } else if (key === 'e') {
        triggerInteract();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      engineRef.current.keysHeld.delete(e.key.toLowerCase());
    };

    const handleBlur = () => {
      engineRef.current.keysHeld.clear();
      engineRef.current.touchMoveX = 0;
      engineRef.current.touchMoveY = 0;
    };

    const handleGamepadConnected = () => {
      setInputMode('gamepad');
      showBanner('Controller Detected · Gamepad Input Active');
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('gamepadconnected', handleGamepadConnected);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
    };
  }, [
    triggerPlayerDodge,
    triggerPlayerAttack,
    triggerCastSpell,
    triggerParryOrBlock,
    triggerQuickHeal,
    triggerInteract,
    showBanner,
  ]);

  // ==================== 60FPS MASTER SIMULATION & RENDER LOOP ====================
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let hudSyncCounter = 0;

    const stepSimulation = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      const eng = engineRef.current;
      eng.globalTime += dt;

      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }
      }

      const vw = canvas?.width || 1280;
      const vh = canvas?.height || 720;
      const reg = REGIONS[eng.regionId];

      // Title screen live atmospheric pan
      if (eng.screenState === 'TITLE_MENU') {
        eng.camX = 350 + Math.sin(eng.globalTime * 0.25) * 240;
        eng.camY = 250 + Math.cos(eng.globalTime * 0.18) * 140;
      }

      // Poll Gamepad API for seamless Controller Support & Autodetection
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];
      let gpMoveX = 0;
      let gpMoveY = 0;
      if (gp) {
        const ax0 = Math.abs(gp.axes[0] || 0) > 0.18 ? gp.axes[0] : 0;
        const ax1 = Math.abs(gp.axes[1] || 0) > 0.18 ? gp.axes[1] : 0;
        const ax2 = Math.abs(gp.axes[2] || 0) > 0.22 ? gp.axes[2] : 0;
        const ax3 = Math.abs(gp.axes[3] || 0) > 0.22 ? gp.axes[3] : 0;
        gpMoveX = ax0;
        gpMoveY = ax1;
        if (ax2 !== 0 || ax3 !== 0) {
          eng.player.facing = Math.atan2(ax3, ax2);
        }

        const btns = gp.buttons.map((b) => b.pressed);
        const prev = eng.gamepadPrevButtons;
        const justPressed = (idx: number) => btns[idx] && !prev[idx];

        if (btns.some((b) => b) || ax0 !== 0 || ax1 !== 0) {
          setInputMode('gamepad');
        }

        if (eng.screenState === 'TITLE_MENU' && (justPressed(0) || justPressed(9))) {
          setScreenState('PLAYING');
        } else if (eng.screenState === 'PLAYING' && eng.activeModal === 'none') {
          if (justPressed(0) || justPressed(1)) triggerPlayerDodge(); // A / B
          if (justPressed(2) || justPressed(5)) triggerPlayerAttack(false); // X / RB
          if (justPressed(3) || justPressed(7)) triggerPlayerAttack(true); // Y / RT
          if (justPressed(4)) triggerParryOrBlock(); // LB
          if (justPressed(6)) triggerCastSpell(); // LT
          if (justPressed(12)) triggerQuickHeal(); // D-Pad Up
          if (justPressed(13)) triggerInteract(); // D-Pad Down
        }
        eng.gamepadPrevButtons = btns;
      }

      // Advance active gameplay when not paused or in modal
      if (eng.screenState === 'PLAYING' && eng.activeModal === 'none') {
        if (eng.hitstopTimer > 0) {
          eng.hitstopTimer -= dt;
        } else {
          const p = eng.player;
          p.animTime += dt;

          // Tick cooldowns & timers
          if (p.dodgeTimer > 0) p.dodgeTimer -= dt;
          if (p.dodgeCooldown > 0) p.dodgeCooldown -= dt;
          if (p.attackTimer > 0) p.attackTimer -= dt;
          if (p.attackCooldown > 0) p.attackCooldown -= dt;
          if (p.parryWindow > 0) p.parryWindow -= dt;
          if (p.hitFlash > 0) p.hitFlash -= dt;
          if (p.umbralVeilTimer > 0) p.umbralVeilTimer -= dt;
          if (p.damageBuffTimer > 0) p.damageBuffTimer -= dt;
          if (eng.bannerTimer > 0) eng.bannerTimer -= dt;

          Object.keys(eng.spellCooldowns).forEach((k) => {
            if (eng.spellCooldowns[k] > 0) {
              eng.spellCooldowns[k] = Math.max(0, eng.spellCooldowns[k] - dt);
            }
          });

          // Stamina & Mana natural regeneration
          const hasCinderRing = eng.equipped.ring?.id === 'eq_ring_of_cinders';
          const stamRegen = (hasCinderRing ? 30 : 25) * (p.isBlocking ? 0.35 : 1.0);
          if (p.attackTimer <= 0 && p.dodgeTimer <= 0) {
            p.stamina = Math.min(p.maxStamina, p.stamina + stamRegen * dt);
          }
          p.mana = Math.min(p.maxMana, p.mana + (3.2 + eng.attributes.willpower * 0.25) * dt);

          // Movement vector from Keyboard, Gamepad, or Touch
          let mx = gpMoveX + eng.touchMoveX;
          let my = gpMoveY + eng.touchMoveY;
          if (eng.keysHeld.has('w') || eng.keysHeld.has('arrowup')) my -= 1;
          if (eng.keysHeld.has('s') || eng.keysHeld.has('arrowdown')) my += 1;
          if (eng.keysHeld.has('a') || eng.keysHeld.has('arrowleft')) mx -= 1;
          if (eng.keysHeld.has('d') || eng.keysHeld.has('arrowright')) mx += 1;

          p.isBlocking = eng.keysHeld.has('f');

          const mag = Math.hypot(mx, my);
          if (mag > 0.01) {
            mx /= mag;
            my /= mag;
            if (p.attackTimer <= 0) {
              p.facing = Math.atan2(my, mx);
            }
          }

          // Equip load effect on speed
          const totalWeight = Object.values(eng.equipped).reduce(
            (sum, it) => sum + (it?.weight || 0),
            0
          );
          const maxLoad = 28 + eng.attributes.endurance * 2.5;
          const loadFactor = totalWeight / maxLoad > 0.7 ? 0.8 : totalWeight / maxLoad < 0.35 ? 1.1 : 1.0;
          const baseMoveSpeed = 205 * loadFactor * (p.dodgeTimer > 0 ? 2.15 : p.isBlocking ? 0.55 : 1.0);

          if (p.dodgeTimer > 0) {
            p.vx = Math.cos(p.facing) * baseMoveSpeed;
            p.vy = Math.sin(p.facing) * baseMoveSpeed;
          } else {
            p.vx = mx * baseMoveSpeed;
            p.vy = my * baseMoveSpeed;
          }

          // Apply velocity & prop collision
          let nextX = Math.max(28, Math.min(reg.width - 28, p.x + p.vx * dt));
          let nextY = Math.max(28, Math.min(reg.height - 28, p.y + p.vy * dt));

          for (const prop of reg.props) {
            if (!prop.solid) {
              // Check spike trap damage
              if (prop.type === 'spike_trap') {
                const cycle = (eng.globalTime * 1.2) % 3.0;
                if (
                  cycle > 2.0 &&
                  p.dodgeTimer <= 0 &&
                  p.hitFlash <= 0 &&
                  Math.abs(nextX - prop.x) < prop.width / 2 &&
                  Math.abs(nextY - prop.y) < prop.height / 2
                ) {
                  p.hp -= 24;
                  p.hitFlash = 0.45;
                  audioEngine.playHit(true, false);
                  addFloatingText(p.x, p.y - 24, '-24 SPIKE TRAP', '#f43f5e');
                }
              }
              continue;
            }
            const halfW = prop.width / 2 + 14;
            const halfH = prop.height / 2 + 14;
            if (Math.abs(nextX - prop.x) < halfW && Math.abs(nextY - prop.y) < halfH) {
              if (Math.abs(p.x - prop.x) >= halfW) nextX = p.x;
              if (Math.abs(p.y - prop.y) >= halfH) nextY = p.y;
            }
          }

          p.x = nextX;
          p.y = nextY;

          if (mag > 0.1 && p.dodgeTimer <= 0) {
            p.footstepTimer -= dt;
            if (p.footstepTimer <= 0) {
              p.footstepTimer = 0.34;
              audioEngine.playFootstep();
            }
          }

          // Check Region Portals
          for (const portal of reg.portals) {
            if (Math.hypot(p.x - portal.x, p.y - portal.y) < portal.radius) {
              if (
                portal.shortcutId &&
                !eng.worldState.unlockedShortcuts.includes(portal.shortcutId)
              ) {
                continue;
              }
              eng.regionId = portal.targetRegion;
              p.x = portal.targetX;
              p.y = portal.targetY;
              // Move active companion with player
              eng.npcs.forEach((n) => {
                if (n.alive && n.isCompanion) {
                  n.regionId = portal.targetRegion;
                  n.x = portal.targetX + 42;
                  n.y = portal.targetY + 24;
                }
              });
              setCurrentRegion(portal.targetRegion);
              audioEngine.updateAmbientDrone(portal.targetRegion);
              showBanner(`ENTERED: ${REGIONS[portal.targetRegion].name.toUpperCase()}`);
              if (portal.targetRegion === 'crucible') {
                setQuests((prev) =>
                  prev.map((q) =>
                    q.id === 'q_hollowed_seraph'
                      ? {
                          ...q,
                          stages: q.stages.map((s) =>
                            s.id === 'stage_reach_crucible' ? { ...s, completed: true } : s
                          ),
                        }
                      : q
                  )
                );
              }
              break;
            }
          }

          // Update Active Spell Zones (Graviturgy Pull, Pyromancy Burn, Runic Trap)
          for (let i = eng.spellZones.length - 1; i >= 0; i--) {
            const z = eng.spellZones[i];
            z.duration -= dt;
            if (z.duration <= 0) {
              eng.spellZones.splice(i, 1);
              continue;
            }
            if (z.regionId !== eng.regionId) continue;

            for (const c of eng.creatures) {
              if (c.regionId !== eng.regionId || c.hp <= 0) continue;
              const dx = z.x - c.x;
              const dy = z.y - c.y;
              const dist = Math.hypot(dx, dy);
              if (dist <= z.radius) {
                if (z.school === 'graviturgy') {
                  // Pull enemies toward center of Singularity Well
                  const pullForce = 115 * dt;
                  c.x += (dx / Math.max(1, dist)) * pullForce;
                  c.y += (dy / Math.max(1, dist)) * pullForce;
                  c.hp -= z.power * 0.45 * dt;
                } else if (z.school === 'pyromancy') {
                  c.hp -= z.power * 0.75 * dt;
                  if (Math.random() < 0.08) {
                    spawnParticles(c.x, c.y, 2, '#f97316', 50, 3);
                  }
                } else if (z.school === 'runic_sorcery') {
                  c.hp -= z.power * 0.5 * dt;
                }
              }
            }
          }

          // Update Projectiles & Check Runic Sorcery Split-Cast Synergy!
          for (let i = eng.projectiles.length - 1; i >= 0; i--) {
            const proj = eng.projectiles[i];
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.life -= dt;
            if (proj.life <= 0) {
              eng.projectiles.splice(i, 1);
              continue;
            }

            // Check if player projectile passes through a Runic Sigil of Convergence!
            if (proj.isPlayer && !proj.runicEmpowered) {
              for (const z of eng.spellZones) {
                if (
                  z.regionId === eng.regionId &&
                  z.school === 'runic_sorcery' &&
                  Math.hypot(proj.x - z.x, proj.y - z.y) <= z.radius
                ) {
                  proj.runicEmpowered = true;
                  proj.damage = Math.round(proj.damage * 1.45);
                  proj.color = '#fef08a';
                  const baseAng = Math.atan2(proj.vy, proj.vx);
                  const spd = Math.hypot(proj.vx, proj.vy);
                  [-0.24, 0.24].forEach((offset) => {
                    eng.projectiles.push({
                      ...proj,
                      id: `runic_split_${Date.now()}_${Math.random()}`,
                      vx: Math.cos(baseAng + offset) * spd,
                      vy: Math.sin(baseAng + offset) * spd,
                      runicEmpowered: true,
                    });
                  });
                  audioEngine.playSpellCast('runic_sorcery', true);
                  addFloatingText(z.x, z.y - 20, 'RUNIC CONVERGENCE SPLIT ×3!', '#fef08a', true);
                  break;
                }
              }
            }

            if (proj.isPlayer) {
              for (const c of eng.creatures) {
                if (c.regionId !== eng.regionId || c.hp <= 0) continue;
                if (Math.hypot(proj.x - c.x, proj.y - c.y) <= proj.radius + 18 * c.scale) {
                  c.hp -= proj.damage;
                  c.poise -= proj.poiseDamage;
                  c.hitFlash = 0.14;
                  if (proj.statusInflict) {
                    c.statusEffects.push({
                      type: proj.statusInflict,
                      duration: 5.0,
                      intensity: 24,
                    });
                  }
                  spawnParticles(c.x, c.y, 8, proj.color, 90, 4);
                  addFloatingText(c.x, c.y - 20, `${proj.damage}`, proj.color, proj.runicEmpowered);
                  audioEngine.playHit(false, !!proj.runicEmpowered);
                  eng.projectiles.splice(i, 1);
                  break;
                }
              }
            } else {
              // Enemy / Boss Projectile hitting player
              if (Math.hypot(proj.x - p.x, proj.y - p.y) <= proj.radius + 15) {
                if (p.dodgeTimer <= 0) {
                  if (p.parryWindow > 0) {
                    // Deflect projectile back!
                    proj.isPlayer = true;
                    proj.vx = -proj.vx * 1.3;
                    proj.vy = -proj.vy * 1.3;
                    proj.color = '#fde047';
                    audioEngine.playParryClang();
                    addFloatingText(p.x, p.y - 28, 'SPELL PARRIED!', '#fde047', true);
                  } else {
                    const dmg = Math.max(6, Math.round(proj.damage * (p.isBlocking ? 0.45 : 1.0)));
                    p.hp -= dmg;
                    p.hitFlash = 0.2;
                    audioEngine.playHit(false, false);
                    addFloatingText(p.x, p.y - 24, `-${dmg}`, '#f43f5e');
                    eng.projectiles.splice(i, 1);
                  }
                }
              }
            }
          }

          // ==================== AUTONOMOUS CREATURE ECOLOGY & COMBAT AI ====================
          for (const c of eng.creatures) {
            if (c.regionId !== eng.regionId || c.hp <= 0) continue;
            c.animTime += dt;
            if (c.hitFlash > 0) c.hitFlash -= dt;

            // Apply velocity damping
            c.x = Math.max(36, Math.min(reg.width - 36, c.x + c.vx * dt));
            c.y = Math.max(36, Math.min(reg.height - 36, c.y + c.vy * dt));
            c.vx *= 0.86;
            c.vy *= 0.86;

            // Tick status effects on creature
            for (let sIdx = c.statusEffects.length - 1; sIdx >= 0; sIdx--) {
              const st = c.statusEffects[sIdx];
              st.duration -= dt;
              if (st.type === 'burning') {
                c.hp -= 12 * dt;
              } else if (st.type === 'bleeding') {
                c.hp -= 14 * dt;
              }
              if (st.duration <= 0) c.statusEffects.splice(sIdx, 1);
            }

            // Boss Phase Transitions for Malakor, the Hollowed Seraph
            if (c.isBoss) {
              const hpRatio = c.hp / c.maxHp;
              if (hpRatio <= 0.66 && c.bossPhase === 1) {
                c.bossPhase = 2;
                c.damage = 70;
                c.speed = 152;
                eng.shakeIntensity = 14;
                audioEngine.playSpellCast('graviturgy', true);
                showBanner('PHASE II: MALAKOR INVOKES THE GRAVITATIONAL SINGULARITY');
                // Spawn gravity zone around boss
                eng.spellZones.push({
                  id: `boss_zone_${Date.now()}`,
                  regionId: eng.regionId,
                  x: c.x,
                  y: c.y,
                  radius: 135,
                  school: 'graviturgy',
                  spellId: 'boss_grav',
                  duration: 6.0,
                  maxDuration: 6.0,
                  ownerId: c.id,
                  power: 22,
                });
              } else if (hpRatio <= 0.33 && c.bossPhase === 2) {
                c.bossPhase = 3;
                c.damage = 84;
                c.speed = 168;
                eng.shakeIntensity = 18;
                audioEngine.playSpellCast('pyromancy', true);
                showBanner('PHASE III: SERAPHIC BLOOD-PYRE UNLEASHED');
              }
            }

            // Check Creature Death
            if (c.hp <= 0) {
              spawnParticles(c.x, c.y, c.isBoss ? 45 : 18, '#be123c', 150, 5);
              setAsh((prev) => prev + c.ashReward);
              addFloatingText(c.x, c.y - 28, `+${c.ashReward} ASH`, '#fbbf24', true);

              // Talisman of the Weeping Martyr passive
              if (eng.equipped.talisman?.id === 'eq_talisman_blood_chalice') {
                p.hp = Math.min(p.maxHp, p.hp + 12);
              }

              // Spawn CorpseEntity for Scavengers & Player Looting!
              eng.corpses.push({
                id: `corpse_${c.id}_${Date.now()}`,
                name: `Remains of ${c.name}`,
                regionId: eng.regionId,
                x: c.x,
                y: c.y,
                ashValue: Math.round(c.ashReward * 0.35),
                lootItemIds: c.lootTable.slice(0, 1),
                scavenged: false,
                createdAt: eng.globalTime,
              });

              if (c.isBoss) {
                setQuests((prev) =>
                  prev.map((q) =>
                    q.id === 'q_hollowed_seraph'
                      ? {
                          ...q,
                          status: 'completed',
                          outcome: 'Malakor, the Hollowed Seraph was laid to rest.',
                          stages: q.stages.map((s) => ({ ...s, completed: true })),
                        }
                      : q
                  )
                );
                setTimeout(() => setScreenState('VICTORY'), 1200);
              }
              continue;
            }

            // AI State Machine by Ecology Role
            if (c.aiState === 'staggered') {
              c.stateTimer -= dt;
              if (c.stateTimer <= 0) c.aiState = 'chase';
              continue;
            }

            const hasUmbralShroud = eng.equipped.armor?.id === 'eq_umbral_vestments';
            const playerDetectRange =
              c.aggroRange * (p.umbralVeilTimer > 0 ? 0.35 : hasUmbralShroud ? 0.8 : 1.0);
            const distToPlayer = Math.hypot(p.x - c.x, p.y - c.y);

            // 1. PREY ECOLOGY (Ashen Stags graze and flee from Predators or Player)
            if (c.role === 'prey') {
              let nearestThreatDist = distToPlayer;
              let threatX = p.x;
              let threatY = p.y;
              for (const other of eng.creatures) {
                if (
                  other.regionId === eng.regionId &&
                  other.hp > 0 &&
                  other.role === 'predator'
                ) {
                  const d = Math.hypot(other.x - c.x, other.y - c.y);
                  if (d < nearestThreatDist) {
                    nearestThreatDist = d;
                    threatX = other.x;
                    threatY = other.y;
                  }
                }
              }
              if (nearestThreatDist < 210) {
                c.aiState = 'flee';
                const fleeAngle = Math.atan2(c.y - threatY, c.x - threatX);
                c.facing = fleeAngle;
                c.x = Math.max(40, Math.min(reg.width - 40, c.x + Math.cos(fleeAngle) * c.speed * dt));
                c.y = Math.max(40, Math.min(reg.height - 40, c.y + Math.sin(fleeAngle) * c.speed * dt));
              } else {
                c.aiState = 'graze';
              }
              continue;
            }

            // 2. SCAVENGER ECOLOGY (Carrion Ghouls seek corpses and mutate when feeding!)
            if (c.role === 'scavenger' && distToPlayer > playerDetectRange) {
              const targetCorpse = eng.corpses.find(
                (cp) => cp.regionId === eng.regionId && !cp.scavenged
              );
              if (targetCorpse) {
                c.aiState = 'scavenge_corpse';
                const dCorpse = Math.hypot(targetCorpse.x - c.x, targetCorpse.y - c.y);
                const ang = Math.atan2(targetCorpse.y - c.y, targetCorpse.x - c.x);
                c.facing = ang;
                if (dCorpse > 24) {
                  c.x += Math.cos(ang) * c.speed * dt;
                  c.y += Math.sin(ang) * c.speed * dt;
                } else {
                  // Consume corpse and mutate!
                  targetCorpse.scavenged = true;
                  c.corpseConsumedCount = (c.corpseConsumedCount || 0) + 1;
                  c.maxHp += 45;
                  c.hp = c.maxHp;
                  c.damage += 9;
                  c.scale = Math.min(1.45, c.scale + 0.14);
                  spawnParticles(c.x, c.y, 14, '#10b981', 90, 4);
                  addFloatingText(c.x, c.y - 26, 'CORPSE DEVOURED · MUTATED!', '#a3e635', true);
                }
                continue;
              }
            }

            // 3. PREDATOR HUNTING PREY OR FACTION WARFARE
            let targetX = p.x;
            let targetY = p.y;
            let targetDist = distToPlayer;
            let targetingOtherCreature: CreatureEntity | null = null;

            for (const other of eng.creatures) {
              if (other.id === c.id || other.regionId !== eng.regionId || other.hp <= 0) continue;
              const isPredatorVsPrey = c.role === 'predator' && other.role === 'prey';
              const isFactionClash =
                (c.faction === 'cinder_covenant' && other.faction === 'umbral_synod') ||
                (c.faction === 'umbral_synod' && other.faction === 'cinder_covenant');

              if (isPredatorVsPrey || isFactionClash) {
                const d = Math.hypot(other.x - c.x, other.y - c.y);
                if (d < 290 && d < targetDist) {
                  targetDist = d;
                  targetX = other.x;
                  targetY = other.y;
                  targetingOtherCreature = other;
                }
              }
            }

            // Combat state transitions (Chase -> Windup Telegraph -> Attack -> Recover)
            if (c.aiState === 'windup') {
              c.stateTimer -= dt;
              if (c.stateTimer <= 0) {
                c.aiState = 'attack';
                c.stateTimer = c.attackDuration;
                audioEngine.playSwing(true);

                // Boss radial projectile burst in Phase 2 & 3
                if (c.isBoss && (c.bossPhase || 1) >= 2) {
                  const boltCount = c.bossPhase === 3 ? 8 : 5;
                  for (let b = 0; b < boltCount; b++) {
                    const bAng = c.facing + ((b - Math.floor(boltCount / 2)) * 0.32);
                    eng.projectiles.push({
                      id: `boss_proj_${Date.now()}_${b}`,
                      regionId: eng.regionId,
                      x: c.x,
                      y: c.y,
                      vx: Math.cos(bAng) * 310,
                      vy: Math.sin(bAng) * 310,
                      radius: 8,
                      damage: Math.round(c.damage * 0.75),
                      poiseDamage: 25,
                      ownerId: c.id,
                      isPlayer: false,
                      color: c.bossPhase === 3 ? '#e11d48' : '#818cf8',
                      life: 1.8,
                    });
                  }
                }

                // Lunge forward slightly
                c.vx = Math.cos(c.facing) * 180;
                c.vy = Math.sin(c.facing) * 180;

                if (targetingOtherCreature) {
                  if (
                    Math.hypot(targetingOtherCreature.x - c.x, targetingOtherCreature.y - c.y) <=
                    c.attackRange + 18
                  ) {
                    targetingOtherCreature.hp -= c.damage;
                    targetingOtherCreature.hitFlash = 0.15;
                    spawnParticles(
                      targetingOtherCreature.x,
                      targetingOtherCreature.y,
                      8,
                      '#be123c',
                      90,
                      3
                    );
                  }
                } else if (distToPlayer <= c.attackRange + 16) {
                  // Check Player Dodge i-frames or Parry Window!
                  if (p.dodgeTimer > 0) {
                    addFloatingText(p.x, p.y - 24, 'DODGED', '#38bdf8');
                  } else if (p.parryWindow > 0) {
                    c.aiState = 'staggered';
                    c.stateTimer = 2.4;
                    eng.hitstopTimer = 0.08;
                    eng.shakeIntensity = 9;
                    audioEngine.playParryClang();
                    spawnParticles(p.x, p.y, 16, '#fde047', 130, 4);
                    addFloatingText(c.x, c.y - 32, 'PARRIED! RIPOSTE OPEN', '#fde047', true);
                  } else {
                    const physDef = Object.values(eng.equipped).reduce(
                      (s, it) => s + (it?.defensePhysical || 0),
                      0
                    );
                    const rawHit = Math.max(8, c.damage - physDef * 0.45);
                    const finalHit = Math.round(rawHit * (p.isBlocking ? 0.4 : 1.0));
                    p.hp -= finalHit;
                    p.hitFlash = 0.25;
                    eng.shakeIntensity = 6;
                    audioEngine.playHit(true, false);
                    spawnParticles(p.x, p.y, 10, '#be123c', 110, 4);
                    addFloatingText(
                      p.x,
                      p.y - 24,
                      p.isBlocking ? `BLOCKED -${finalHit}` : `-${finalHit}`,
                      '#f43f5e'
                    );
                  }
                }
              }
            } else if (c.aiState === 'attack') {
              c.stateTimer -= dt;
              if (c.stateTimer <= 0) {
                c.aiState = 'recover';
                c.stateTimer = c.recoveryDuration;
              }
            } else if (c.aiState === 'recover') {
              c.stateTimer -= dt;
              if (c.stateTimer <= 0) {
                c.aiState = 'chase';
              }
            } else {
              // Patrol or Chase
              if (targetDist <= (targetingOtherCreature ? 290 : playerDetectRange)) {
                c.aiState = 'chase';
                const ang = Math.atan2(targetY - c.y, targetX - c.x);
                c.facing = ang;
                if (targetDist <= c.attackRange * 0.85) {
                  c.aiState = 'windup';
                  c.stateTimer = c.windupDuration;
                } else {
                  c.x += Math.cos(ang) * c.speed * dt;
                  c.y += Math.sin(ang) * c.speed * dt;
                }
              } else {
                c.aiState = 'patrol';
                const patrolAng = Math.atan2(
                  c.homeY + Math.sin(eng.globalTime * 0.7 + c.homeX) * 65 - c.y,
                  c.homeX + Math.cos(eng.globalTime * 0.7 + c.homeY) * 65 - c.x
                );
                c.facing = patrolAng;
                c.x += Math.cos(patrolAng) * (c.speed * 0.45) * dt;
                c.y += Math.sin(patrolAng) * (c.speed * 0.45) * dt;
              }
            }
          }

          // ==================== AUTONOMOUS NPC LOCAL MOVEMENT & COMPANION COMBAT ====================
          for (const npc of eng.npcs) {
            if (!npc.alive || npc.regionId !== eng.regionId) continue;
            if (npc.combatCooldown > 0) npc.combatCooldown -= dt;

            // If Korvak is hunting Vane in Oakhaven!
            if (npc.id === 'npc_korvak' && npc.currentGoal === 'hunt_rival') {
              const vane = eng.npcs.find((n) => n.id === 'npc_vane' && n.alive && n.regionId === eng.regionId);
              if (vane) {
                const dVane = Math.hypot(vane.x - npc.x, vane.y - npc.y);
                const ang = Math.atan2(vane.y - npc.y, vane.x - npc.x);
                npc.facing = ang;
                if (dVane > 42) {
                  npc.x += Math.cos(ang) * 135 * dt;
                  npc.y += Math.sin(ang) * 135 * dt;
                } else if (npc.combatCooldown <= 0) {
                  npc.combatCooldown = 1.1;
                  vane.hp -= 55;
                  vane.hitFlash = 0.2;
                  audioEngine.playHit(true, true);
                  addFloatingText(vane.x, vane.y - 26, 'KORVAK’S VENGEANCE -55!', '#f97316', true);
                  if (vane.hp <= 0) {
                    vane.alive = false;
                    npc.currentGoal = 'forge_star_iron_weapons';
                    npc.currentAction = 'Avenged Apprentice Tomas';
                    showBanner('KORVAK SLEW VANE THE CROW-TONGUE FOR HIS BETRAYAL');
                  }
                }
              }
            }

            // Companion AI (e.g. Sir Gideon of the Ash fighting alongside player)
            if (npc.isCompanion) {
              let nearestEnemy: CreatureEntity | null = null;
              let nearestDist = 260;
              for (const c of eng.creatures) {
                if (c.regionId === eng.regionId && c.hp > 0 && c.role !== 'prey') {
                  const d = Math.hypot(c.x - npc.x, c.y - npc.y);
                  if (d < nearestDist) {
                    nearestDist = d;
                    nearestEnemy = c;
                  }
                }
              }

              if (nearestEnemy) {
                const ang = Math.atan2(nearestEnemy.y - npc.y, nearestEnemy.x - npc.x);
                npc.facing = ang;
                if (nearestDist > 56) {
                  npc.x += Math.cos(ang) * 148 * dt;
                  npc.y += Math.sin(ang) * 148 * dt;
                } else if (npc.combatCooldown <= 0) {
                  npc.combatCooldown = 1.05;
                  nearestEnemy.hp -= 38;
                  nearestEnemy.poise -= 22;
                  nearestEnemy.hitFlash = 0.15;
                  eng.slashes.push({
                    x: npc.x,
                    y: npc.y,
                    angle: ang,
                    arc: 1.4,
                    radius: 52,
                    color: '#fbbf24',
                    life: 0.18,
                    maxLife: 0.18,
                  });
                  addFloatingText(nearestEnemy.x, nearestEnemy.y - 20, '38', '#fde68a');
                }
              } else {
                const dPlayer = Math.hypot(p.x - npc.x, p.y - npc.y);
                if (dPlayer > 76) {
                  const ang = Math.atan2(p.y - npc.y, p.x - npc.x);
                  npc.facing = ang;
                  npc.x += Math.cos(ang) * 165 * dt;
                  npc.y += Math.sin(ang) * 165 * dt;
                }
              }
            }
          }

          // Check Player Death & Recoverable Bloodstain
          if (p.hp <= 0) {
            p.bloodSpotRegion = eng.regionId;
            p.bloodSpotX = p.x;
            p.bloodSpotY = p.y;
            p.bloodSpotAsh = eng.ash;
            setAsh(0);
            setScreenState('DEATH');
          }

          // Periodic Macro AI World Simulation Tick (Every 7.5 seconds)
          eng.aiSimAccumulator += dt;
          if (eng.aiSimAccumulator >= 7.5) {
            eng.aiSimAccumulator = 0;
            const simRes = evaluateNPCUtilityAndTickWorld(
              eng.npcs,
              eng.creatures,
              eng.corpses,
              eng.worldState,
              eng.regionId
            );
            eng.npcs = simRes.npcs;
            eng.worldState = simRes.worldState;
            setNpcs(simRes.npcs);
            setWorldState(simRes.worldState);
          }

          // Smooth Camera Tracking + Shake
          const targetCamX = Math.max(0, Math.min(reg.width - vw, p.x - vw / 2));
          const targetCamY = Math.max(0, Math.min(reg.height - vh, p.y - vh / 2));
          eng.camX += (targetCamX - eng.camX) * Math.min(1, dt * 8);
          eng.camY += (targetCamY - eng.camY) * Math.min(1, dt * 8);

          if (eng.shakeIntensity > 0.1) {
            eng.camX += (Math.random() - 0.5) * eng.shakeIntensity * 2;
            eng.camY += (Math.random() - 0.5) * eng.shakeIntensity * 2;
            eng.shakeIntensity *= Math.pow(0.04, dt);
          } else {
            eng.shakeIntensity = 0;
          }
        }
      }

      // Update Atmospheric Weather Particles (Ash, Spores, Moon Motes, Embers)
      if (eng.particles.length < 75 && Math.random() < 0.45) {
        const wColor =
          reg.weatherType === 'spores'
            ? '#34d399'
            : reg.weatherType === 'moon_motes'
            ? '#818cf8'
            : reg.weatherType === 'ember_storm'
            ? '#fb923c'
            : '#d6d3d1';
        eng.particles.push({
          x: eng.camX + Math.random() * vw,
          y: eng.camY + Math.random() * vh,
          vx: 14 + Math.random() * 18,
          vy: reg.weatherType === 'ember_storm' ? -24 : 18 + Math.random() * 15,
          size: 3,
          color: wColor,
          alpha: 0.45,
          life: 2.5,
          maxLife: 2.5,
        });
      }

      for (let i = eng.particles.length - 1; i >= 0; i--) {
        const pt = eng.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) eng.particles.splice(i, 1);
      }

      for (let i = eng.slashes.length - 1; i >= 0; i--) {
        eng.slashes[i].life -= dt;
        if (eng.slashes[i].life <= 0) eng.slashes.splice(i, 1);
      }

      for (let i = eng.floatingTexts.length - 1; i >= 0; i--) {
        const ft = eng.floatingTexts[i];
        ft.y -= 28 * dt;
        ft.life -= dt;
        if (ft.life <= 0) eng.floatingTexts.splice(i, 1);
      }

      // Render World Canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGameWorld(
            ctx,
            vw,
            vh,
            eng.camX,
            eng.camY,
            reg,
            eng.worldState?.dayTime || 0.25,
            {
              x: eng.player.x,
              y: eng.player.y,
              vx: eng.player.vx,
              vy: eng.player.vy,
              facing: eng.player.facing,
              hp: eng.player.hp,
              maxHp: eng.player.maxHp,
              isDodging: eng.player.dodgeTimer > 0,
              isBlocking: eng.player.isBlocking,
              isParrying: eng.player.parryWindow > 0,
              attackTimer: eng.player.attackTimer,
              hitFlash: eng.player.hitFlash,
              animTime: eng.player.animTime,
              equippedWeapon: eng.equipped.weapon,
              equippedArmor: eng.equipped.armor,
              umbralVeilActive: eng.player.umbralVeilTimer > 0,
              bloodSpotX:
                eng.player.bloodSpotRegion === eng.regionId ? eng.player.bloodSpotX : null,
              bloodSpotY:
                eng.player.bloodSpotRegion === eng.regionId ? eng.player.bloodSpotY : null,
              bloodSpotAsh: eng.player.bloodSpotAsh,
            },
            eng.npcs.filter((n) => n.regionId === eng.regionId),
            eng.creatures.filter((c) => c.regionId === eng.regionId),
            eng.corpses.filter((c) => c.regionId === eng.regionId),
            eng.spellZones.filter((z) => z.regionId === eng.regionId),
            eng.projectiles.filter((pr) => pr.regionId === eng.regionId),
            eng.particles,
            eng.slashes,
            eng.floatingTexts,
            eng.worldState?.unlockedShortcuts || [],
            eng.worldState?.openedChests || [],
            eng.globalTime
          );
        }
      }

      // Sync HUD readouts every ~6 frames so React never bottlenecks 60fps canvas
      hudSyncCounter++;
      if (hudSyncCounter % 6 === 0) {
        const p = eng.player;
        let interactPrompt: string | null = null;

        if (
          p.bloodSpotRegion === eng.regionId &&
          p.bloodSpotX !== null &&
          p.bloodSpotY !== null &&
          Math.hypot(p.x - p.bloodSpotX, p.y - p.bloodSpotY) < 65
        ) {
          interactPrompt = `Reclaim ${p.bloodSpotAsh} Remnant Ash`;
        } else {
          for (const npc of eng.npcs) {
            if (
              npc.alive &&
              npc.regionId === eng.regionId &&
              Math.hypot(p.x - npc.x, p.y - npc.y) < 85
            ) {
              interactPrompt = `Speak with ${npc.name}`;
              break;
            }
          }
          if (!interactPrompt) {
            for (const cp of eng.corpses) {
              if (
                cp.regionId === eng.regionId &&
                !cp.scavenged &&
                Math.hypot(p.x - cp.x, p.y - cp.y) < 75
              ) {
                interactPrompt = `Inspect ${cp.name}`;
                break;
              }
            }
          }
          if (!interactPrompt) {
            for (const prop of reg.props) {
              if (prop.interactable && Math.hypot(p.x - prop.x, p.y - prop.y) < 88) {
                interactPrompt = prop.label || 'Interact';
                break;
              }
            }
          }
        }

        // Check active Boss or Miniboss in region
        const activeBoss = eng.creatures.find(
          (c) =>
            c.regionId === eng.regionId &&
            c.hp > 0 &&
            (c.isBoss || (c.isMiniboss && Math.hypot(p.x - c.x, p.y - c.y) < 420))
        );

        const statuses: string[] = [];
        if (p.umbralVeilTimer > 0) statuses.push(`Umbral Veil (${p.umbralVeilTimer.toFixed(1)}s)`);
        if (p.damageBuffTimer > 0) statuses.push(`Ember Pitch (${p.damageBuffTimer.toFixed(1)}s)`);

        setHudStats({
          hp: Math.max(0, Math.round(p.hp)),
          maxHp: Math.round(p.maxHp),
          stamina: Math.max(0, Math.round(p.stamina)),
          maxStamina: Math.round(p.maxStamina),
          mana: Math.max(0, Math.round(p.mana)),
          maxMana: Math.round(p.maxMana),
          interactPrompt,
          bossName: activeBoss ? activeBoss.name : null,
          bossTitle: activeBoss?.title || null,
          bossHp: activeBoss ? Math.max(0, Math.round(activeBoss.hp)) : 0,
          bossMaxHp: activeBoss ? activeBoss.maxHp : 1,
          bossPhase: activeBoss?.bossPhase || 1,
          bannerToast: eng.bannerTimer > 0 ? eng.bannerMessage : null,
          statusSummary: statuses,
        });
      }

      animId = requestAnimationFrame(stepSimulation);
    };

    animId = requestAnimationFrame(stepSimulation);
    return () => cancelAnimationFrame(animId);
  }, [
    triggerPlayerDodge,
    triggerPlayerAttack,
    triggerParryOrBlock,
    triggerCastSpell,
    triggerQuickHeal,
    triggerInteract,
    showBanner,
  ]);

  // ==================== HANDLERS FOR MODALS, QUESTS, AI DIALOGUE & PERSISTENCE ====================
  const handleSendNpcDialogue = async (
    npcId: string,
    input: string,
    intent: string
  ): Promise<{ dialogue: string; innerThought: string; revealedFact?: string }> => {
    const npc = engineRef.current.npcs.find((n) => n.id === npcId);
    if (!npc) {
      return { dialogue: '...', innerThought: '' };
    }

    const hasMedallion = inventory.some((i) => i.id === 'relic_apprentice_medallion');
    const hasChalice = inventory.some((i) => i.id === 'relic_first_choir_chalice');

    // First attempt server-side Gemini API for rich natural dialogue grounded in NPC epistemic state
    let evalResult = evaluateEpistemicDialogueDeterministic(
      npc,
      input,
      intent,
      { level, attributes },
      hasMedallion,
      hasChalice
    );

    try {
      const response = await fetch('/api/npc-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          npc,
          playerInput: input,
          intent,
          playerStats: { level, reputation: worldState.reputation.oakhaven_survivors },
          worldContext: {
            settlementFood: Math.round(worldState.settlementFood),
            cinderPower: Math.round(worldState.cinderCovenantPower),
            umbralPower: Math.round(worldState.umbralSynodPower),
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (!data.fallback && data.result?.dialogue) {
          evalResult = data.result;
        }
      }
    } catch {
      // Deterministic epistemic evaluator already prepared
    }

    // Apply persistent epistemic memory, relationship shifts, and goal updates to the NPC
    const updatedNpcs = engineRef.current.npcs.map((n) => {
      if (n.id !== npcId) return n;
      const nextTrust = Math.max(-100, Math.min(100, n.trust + (evalResult.trustDelta || 0)));
      const nextFear = Math.max(0, Math.min(100, n.fearOfPlayer + (evalResult.fearDelta || 0)));
      const nextRespect = Math.max(-100, Math.min(100, n.respect + (evalResult.respectDelta || 0)));
      const isNowCompanion =
        intent === 'recruit' && (n.id === 'npc_gideon' || nextTrust >= 40) ? true : n.isCompanion;

      return {
        ...n,
        trust: nextTrust,
        fearOfPlayer: nextFear,
        respect: nextRespect,
        isCompanion: isNowCompanion,
        currentGoal: (evalResult.newGoal as AutonomousNPC['currentGoal']) || n.currentGoal,
        memories: [
          ...n.memories,
          {
            id: `mem_${Date.now()}`,
            timestamp: worldState.tickCount,
            type: 'interaction' as const,
            summary: evalResult.newMemorySummary || `Spoke with Wanderer: "${input.slice(0, 40)}"`,
            sentiment: Math.sign(evalResult.trustDelta || 1) * 4,
            actorId: 'player',
          },
        ].slice(-15),
      };
    });

    engineRef.current.npcs = updatedNpcs;
    setNpcs(updatedNpcs);

    return {
      dialogue: evalResult.dialogue,
      innerThought: evalResult.innerThought,
      revealedFact: evalResult.revealedFact,
    };
  };

  const handleQuestDecision = (actionId: string) => {
    if (actionId === 'donate_grain_verenice') {
      setInventory((prev) => prev.filter((i) => i.id !== 'mat_settlement_grain'));
      setWorldState((prev) => ({
        ...prev,
        settlementFood: Math.min(100, prev.settlementFood + 35),
        settlementMorale: Math.min(100, prev.settlementMorale + 20),
        cinderCovenantPower: Math.min(100, prev.cinderCovenantPower + 12),
      }));
      setAsh((prev) => prev + 220);
      setQuests((prev) =>
        prev.map((q) =>
          q.id === 'q_choked_hearth'
            ? {
                ...q,
                stages: q.stages.map((s) =>
                  s.id === 'stage_forage' ? { ...s, completed: true } : s
                ),
              }
            : q
        )
      );
      showBanner('OAKHAVEN GRANARIES RESTORED (+35% FOOD, +220 ASH)');
    } else if (actionId === 'give_chalice_verenice') {
      setInventory((prev) => prev.filter((i) => i.id !== 'relic_first_choir_chalice'));
      setWorldState((prev) => ({
        ...prev,
        cinderCovenantPower: 95,
        bastionController: 'cinder_covenant',
        endingUnlocked: 'cinder_age',
      }));
      setAsh((prev) => prev + 600);
      setQuests((prev) =>
        prev.map((q) =>
          q.id === 'q_choked_hearth'
            ? {
                ...q,
                status: 'completed',
                outcome: 'Allied with the Cinder Covenant and rekindled the First Ember.',
                stages: q.stages.map((s) => ({ ...s, completed: true })),
              }
            : q
        )
      );
      showBanner('CINDER COVENANT ASCENDANT (+600 ASH)');
    } else if (actionId === 'give_chalice_malrik') {
      setInventory((prev) => prev.filter((i) => i.id !== 'relic_first_choir_chalice'));
      setWorldState((prev) => ({
        ...prev,
        umbralSynodPower: 95,
        bastionController: 'umbral_synod',
        endingUnlocked: 'umbral_eclipse',
      }));
      setAsh((prev) => prev + 650);
      setQuests((prev) =>
        prev.map((q) =>
          q.id === 'q_choked_hearth'
            ? {
                ...q,
                status: 'completed',
                outcome: 'Delivered the Sacred Chalice to Whisperer Malrik and embraced the Umbral Eclipse.',
                stages: q.stages.map((s) => ({ ...s, completed: true })),
              }
            : q
        )
      );
      showBanner('UMBRAL SYNOD ASCENDANT (+650 ASH)');
    } else if (actionId === 'reveal_tomas_medallion_korvak') {
      setInventory((prev) => prev.filter((i) => i.id !== 'relic_apprentice_medallion'));
      const updated = engineRef.current.npcs.map((n) =>
        n.id === 'npc_korvak'
          ? {
              ...n,
              trust: 90,
              currentGoal: 'hunt_rival' as const,
              currentAction: 'Marching to execute Vane the Crow-Tongue!',
              knownFacts: [
                ...n.knownFacts,
                'Vane betrayed my apprentice Tomas in the Catacombs.',
              ],
            }
          : n
      );
      engineRef.current.npcs = updated;
      setNpcs(updated);
      setAsh((prev) => prev + 400);
      setQuests((prev) =>
        prev.map((q) =>
          q.id === 'q_missing_apprentice'
            ? {
                ...q,
                status: 'completed',
                outcome: 'Exposed Vane’s treachery to Korvak, triggering his righteous vengeance.',
                stages: q.stages.map((s) => ({ ...s, completed: true })),
              }
            : q
        )
      );
      showBanner('KORVAK HAS TAKEN UP HIS HAMMER TO HUNT VANE!');
    } else if (actionId === 'blackmail_vane_medallion') {
      setInventory((prev) => prev.filter((i) => i.id !== 'relic_apprentice_medallion'));
      setAsh((prev) => prev + 450);
      setQuests((prev) =>
        prev.map((q) =>
          q.id === 'q_missing_apprentice'
            ? {
                ...q,
                status: 'completed',
                outcome: 'Accepted Vane’s hush-money bribe to conceal Tomas’s fate.',
                stages: q.stages.map((s) => ({ ...s, completed: true })),
              }
            : q
        )
      );
      showBanner('ACCEPTED VANE’S BRIBE (+450 SOVEREIGN ASH)');
    }
  };

  const handleSaveGame = () => {
    const payload = {
      level,
      ash,
      attributes,
      inventory,
      equipped,
      spells,
      activeSpellId,
      currentRegion: engineRef.current.regionId,
      playerX: engineRef.current.player.x,
      playerY: engineRef.current.player.y,
      npcs: engineRef.current.npcs,
      worldState: engineRef.current.worldState,
      quests,
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    showBanner('WORLD STATE SAVED TO CHRONICLE');
  };

  const handleLoadGame = () => {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      showBanner('No Saved World Chronicle Found');
      return;
    }
    try {
      const data = JSON.parse(raw);
      setLevel(data.level || 1);
      setAsh(data.ash ?? 180);
      setAttributes(data.attributes);
      setInventory(data.inventory);
      setEquipped(data.equipped);
      setSpells(data.spells);
      setActiveSpellId(data.activeSpellId);
      setCurrentRegion(data.currentRegion || 'oakhaven');
      engineRef.current.regionId = data.currentRegion || 'oakhaven';
      engineRef.current.player.x = data.playerX || 900;
      engineRef.current.player.y = data.playerY || 740;
      engineRef.current.npcs = data.npcs || INITIAL_NPCS;
      setNpcs(data.npcs || INITIAL_NPCS);
      engineRef.current.worldState = data.worldState;
      setWorldState(data.worldState);
      setQuests(data.quests || INITIAL_QUESTS);
      setActiveModal('none');
      setScreenState('PLAYING');
      showBanner('CHRONICLE RESTORED');
    } catch {
      showBanner('Failed to parse saved chronicle');
    }
  };

  const handleRespawnFromDeath = () => {
    const eng = engineRef.current;
    const p = eng.player;
    eng.regionId = p.lastShrineRegion;
    setCurrentRegion(p.lastShrineRegion);
    p.x = p.lastShrineX;
    p.y = p.lastShrineY;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.mana = p.maxMana;
    eng.creatures = INITIAL_CREATURES.map((c) => ({ ...c }));
    setScreenState('PLAYING');
    showBanner('REBORN AT THE EMBER PYRE · RETRIEVE YOUR LOST ASH');
  };

  const attunedSpell = spells.find((s) => s.id === activeSpellId) || spells[0];
  const flaskCount = inventory.find((i) => i.id === 'item_ashen_flask')?.quantity || 0;
  const hasSavedGame =
    typeof window !== 'undefined' && Boolean(localStorage.getItem(SAVE_STORAGE_KEY));

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#0b0c10] select-none"
      onMouseDown={(e) => {
        if (screenState !== 'PLAYING' || activeModal !== 'none') return;
        if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
        setInputMode('keyboard_mouse');
        if (e.button === 0) {
          triggerPlayerAttack(e.shiftKey);
        } else if (e.button === 2) {
          triggerCastSpell();
        }
      }}
      onMouseMove={(e) => {
        if (screenState !== 'PLAYING' || activeModal !== 'none') return;
        const eng = engineRef.current;
        const worldX = e.clientX + eng.camX;
        const worldY = e.clientY + eng.camY;
        eng.mouseWorldX = worldX;
        eng.mouseWorldY = worldY;
        if (Math.hypot(eng.player.vx, eng.player.vy) < 15) {
          eng.player.facing = Math.atan2(worldY - eng.player.y, worldX - eng.player.x);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={() => {
        if (inputMode !== 'touch') setInputMode('touch');
      }}
    >
      {/* 1. ISOLATED FULL-VIEWPORT 60FPS GAME CANVAS */}
      <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" />

      {/* 2. TITLE SCREEN OVERLAY */}
      {screenState === 'TITLE_MENU' && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-between py-14 px-6 bg-gradient-to-t from-[#090a0f]/95 via-[#090a0f]/60 to-[#090a0f]/80">
          <div className="text-xs tracking-widest uppercase text-stone-400 font-mono-tabular">
            Autonomous Living World Dark Fantasy RPG
          </div>

          {/* Bespoke SVG Title Lockup over generous negative space */}
          <div className="flex flex-col items-center text-center max-w-2xl space-y-6 my-auto">
            <svg
              viewBox="0 0 600 150"
              className="w-full max-w-xl h-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]"
              aria-label="Ashen Fields"
            >
              <defs>
                <linearGradient id="ashGold" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="55%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
              </defs>
              {/* Shattered Crown & Eclipse Sigil */}
              <circle
                cx="300"
                cy="34"
                r="18"
                fill="#0b0c10"
                stroke="url(#ashGold)"
                strokeWidth="2.5"
              />
              <path
                d="M260 34 L340 34 M300 8 L300 60"
                stroke="url(#ashGold)"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <text
                x="300"
                y="102"
                textAnchor="middle"
                fill="url(#ashGold)"
                fontFamily="Cinzel, Georgia, serif"
                fontWeight="700"
                fontSize="54"
                letterSpacing="8"
              >
                ASHEN FIELDS
              </text>
              <text
                x="300"
                y="134"
                textAnchor="middle"
                fill="#a8a29e"
                fontFamily="Cinzel, Georgia, serif"
                fontWeight="500"
                fontSize="14"
                letterSpacing="5"
              >
                CANTICLES OF THE SEVENTH STAR
              </text>
            </svg>

            <p className="text-sm text-stone-300 leading-relaxed max-w-lg">
              Enter a decaying realm that breathes without you at its center. Factions wage war over Ironmire Bastion, predators stalk the Bramblewood, and inhabitants remember every mercy or betrayal.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => {
                  setScreenState('PLAYING');
                  audioEngine.updateAmbientDrone('oakhaven');
                }}
                className="px-8 py-3 text-sm font-display font-semibold tracking-wider bg-amber-700 hover:bg-amber-600 text-stone-100 border border-amber-500/60 rounded shadow-lg transition-transform active:scale-95 whitespace-nowrap shrink-0"
              >
                Enter the Ashen Fields
              </button>

              {hasSavedGame && (
                <button
                  onClick={handleLoadGame}
                  className="px-6 py-3 text-sm font-display font-semibold tracking-wider bg-[#1a1c24] hover:bg-[#252834] text-amber-200 border border-[#3a352b] rounded transition-colors whitespace-nowrap shrink-0"
                >
                  Continue Saved Chronicle
                </button>
              )}

              <button
                onClick={toggleFullscreen}
                className="px-5 py-3 text-sm font-display font-semibold tracking-wider bg-[#151720] hover:bg-[#202330] text-stone-200 border border-[#322e26] rounded transition-colors whitespace-nowrap shrink-0"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>

          {/* Flat Single-Line Control Hint */}
          <div className="text-xs text-stone-400 font-mono-tabular text-center">
            WASD Move · Space Dodge · Click/J Attack · Q Cast Spell · F Parry · E Interact · F11 Fullscreen
          </div>
        </div>
      )}

      {/* 3. LOW-OCCLUSION WORLD-MATCHED PERIMETER HUD (Playing State) */}
      {screenState === 'PLAYING' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 md:p-5 overflow-hidden">
          {/* Top Perimeter Row: Player Vital Bars (Left) · Boss Bar (Center) · Region & Quick Nav (Right) */}
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4 w-full">
            {/* Top-Left: Player Vital Bars, Weapon, Spell & Sovereign Ash */}
            <div className="pointer-events-auto bg-[#11131a]/92 border border-[#2d2820] rounded-lg p-2.5 sm:p-3 space-y-1.5 w-[210px] sm:w-[250px] max-w-[46vw] shadow-lg shrink-0">
              {/* HP Bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] sm:text-xs font-mono-tabular">
                  <span className="text-stone-300 font-medium">Vitality</span>
                  <span className="text-rose-300">
                    {hudStats.hp}/{hudStats.maxHp}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#090a0f] rounded overflow-hidden border border-rose-950/60">
                  <div
                    className="h-full bg-gradient-to-r from-rose-800 to-rose-500 transition-all duration-150"
                    style={{ width: `${(hudStats.hp / Math.max(1, hudStats.maxHp)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Stamina Bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] sm:text-xs font-mono-tabular">
                  <span className="text-stone-300 font-medium">Stamina</span>
                  <span className="text-emerald-300">
                    {hudStats.stamina}/{hudStats.maxStamina}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#090a0f] rounded overflow-hidden border border-emerald-950/60">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-800 to-emerald-500 transition-all duration-100"
                    style={{
                      width: `${(hudStats.stamina / Math.max(1, hudStats.maxStamina)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Mana Bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[11px] sm:text-xs font-mono-tabular">
                  <span className="text-stone-300 font-medium">Focus</span>
                  <span className="text-sky-300">
                    {hudStats.mana}/{hudStats.maxMana}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#090a0f] rounded overflow-hidden border border-sky-950/60">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-800 to-sky-400 transition-all duration-150"
                    style={{ width: `${(hudStats.mana / Math.max(1, hudStats.maxMana)) * 100}%` }}
                  />
                </div>
              </div>

              {/* Unboxed Equipment & Ash Metadata */}
              <div className="pt-1 border-t border-[#25221b] flex items-center justify-between gap-1.5 text-[11px] sm:text-xs font-mono-tabular text-stone-300">
                <span className="truncate max-w-[115px] sm:max-w-[140px]">
                  {equipped.weapon?.name || 'Unarmed'}
                </span>
                <span className="text-amber-400 shrink-0">{ash} Ash</span>
              </div>

              <div className="flex items-center justify-between gap-1.5 text-[11px] sm:text-xs font-mono-tabular text-stone-400">
                <button
                  onClick={() => {
                    const idx = spells.findIndex((s) => s.id === activeSpellId);
                    const next = spells[(idx + 1) % spells.length];
                    if (next) setActiveSpellId(next.id);
                  }}
                  className="text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline truncate"
                >
                  {attunedSpell?.name}
                </button>
                <button
                  onClick={triggerQuickHeal}
                  className="text-rose-300 hover:text-rose-200 whitespace-nowrap shrink-0"
                >
                  Flask ×{flaskCount}
                </button>
              </div>
            </div>

            {/* Top-Center: Boss / Miniboss Health Bar */}
            {hudStats.bossName && (
              <div className="flex-1 min-w-[180px] max-w-md mx-auto bg-[#11131a]/92 border border-rose-900/60 rounded-lg px-3 py-2 text-center shadow-xl">
                <div className="font-display text-xs sm:text-sm font-semibold text-amber-200 tracking-wide truncate">
                  {hudStats.bossName}
                  {hudStats.bossPhase > 1 ? ` · Phase ${hudStats.bossPhase}` : ''}
                </div>
                {hudStats.bossTitle && (
                  <div className="text-[10px] sm:text-[11px] text-stone-400 truncate">{hudStats.bossTitle}</div>
                )}
                <div className="w-full h-2.5 bg-[#090a0f] rounded overflow-hidden border border-rose-900/70 mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-rose-900 via-red-600 to-amber-500 transition-all duration-150"
                    style={{
                      width: `${(hudStats.bossHp / Math.max(1, hudStats.bossMaxHp)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Top-Right: Current Region & Clean Responsive Action Bar */}
            <div className="pointer-events-auto flex flex-col items-end gap-1.5 max-w-[50vw]">
              <div className="bg-[#11131a]/92 border border-[#2d2820] rounded-lg px-3 py-1.5 text-right max-w-full">
                <div className="font-display text-xs sm:text-sm font-semibold text-amber-300 truncate">
                  {REGIONS[currentRegion].name}
                </div>
                <div className="text-[10px] sm:text-xs text-stone-400 font-mono-tabular truncate">
                  <span>Food {Math.round(worldState.settlementFood)}%</span>
                  <span className="mx-1" aria-hidden="true">·</span>
                  <span>Cinder {Math.round(worldState.cinderCovenantPower)}</span>
                  <span className="mx-1" aria-hidden="true">·</span>
                  <span>Synod {Math.round(worldState.umbralSynodPower)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1 bg-[#11131a]/92 border border-[#2d2820] rounded-lg p-1">
                <button
                  onClick={() => setActiveModal('inventory')}
                  className="px-2 py-1 text-[11px] sm:text-xs font-medium text-stone-300 hover:text-amber-300 rounded whitespace-nowrap shrink-0"
                >
                  Gear
                </button>
                <button
                  onClick={() => setActiveModal('grimoire')}
                  className="px-2 py-1 text-[11px] sm:text-xs font-medium text-stone-300 hover:text-amber-300 rounded whitespace-nowrap shrink-0"
                >
                  Spells
                </button>
                <button
                  onClick={() => {
                    setNpcs([...engineRef.current.npcs]);
                    setActiveModal('world_ai');
                  }}
                  className="px-2 py-1 text-[11px] sm:text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-950/40 rounded whitespace-nowrap shrink-0"
                >
                  AI World
                </button>
                <button
                  onClick={() => setActiveModal('map')}
                  className="px-2 py-1 text-[11px] sm:text-xs font-medium text-stone-300 hover:text-amber-300 rounded whitespace-nowrap shrink-0"
                >
                  Map
                </button>
                <button
                  onClick={() =>
                    setInputMode((prev) => (prev === 'touch' ? 'keyboard_mouse' : 'touch'))
                  }
                  className={`px-2 py-1 text-[11px] sm:text-xs font-medium rounded whitespace-nowrap shrink-0 ${
                    inputMode === 'touch'
                      ? 'bg-amber-700 text-white'
                      : 'text-stone-300 hover:text-amber-300'
                  }`}
                >
                  Touch Pad
                </button>
                <button
                  onClick={() => setActiveModal('settings')}
                  className="px-2 py-1 text-[11px] sm:text-xs font-medium text-stone-300 hover:text-amber-300 rounded whitespace-nowrap shrink-0"
                >
                  System
                </button>
                <button
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen (F11)"
                  className="px-2 py-1 text-[11px] sm:text-xs font-medium text-amber-200 hover:text-white bg-[#1e1c17] hover:bg-amber-800/60 border border-[#383227] rounded whitespace-nowrap shrink-0"
                >
                  {isFullscreen ? 'Exit FS' : 'Fullscreen'}
                </button>
              </div>
            </div>
          </div>

          {/* Center Banner Toast (Region Discovery / Synergy / World Event) */}
          {hudStats.bannerToast && (
            <div className="mx-auto my-auto bg-[#0d0f15]/95 border border-amber-700/60 px-4 py-2.5 rounded-lg shadow-2xl text-center max-w-md">
              <div className="font-display text-xs sm:text-sm font-semibold tracking-wider text-amber-300">
                {hudStats.bannerToast}
              </div>
            </div>
          )}

          {/* Bottom-Center Context Interact Prompt */}
          {hudStats.interactPrompt && (
            <div className="pointer-events-auto mx-auto mb-2">
              <button
                onClick={triggerInteract}
                className="px-5 py-2.5 text-xs font-display font-semibold tracking-wider bg-amber-700 hover:bg-amber-600 text-white border border-amber-400/60 rounded-lg shadow-xl whitespace-nowrap shrink-0"
              >
                [ACT] {hudStats.interactPrompt}
              </button>
            </div>
          )}

          {/* Desktop-Only Living World Event Ticker (Hidden when Touch Pad is active so Left Movement Pad is never displaced) */}
          {inputMode !== 'touch' && (
            <div className="pointer-events-auto hidden lg:block max-w-sm bg-[#11131a]/88 border border-[#28241d] rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-center justify-between text-stone-400 font-mono-tabular">
                <span className="text-amber-400 font-medium truncate">
                  Living World · {worldState.events[0]?.title}
                </span>
              </div>
              <p className="text-stone-300 line-clamp-2 leading-snug">
                {worldState.events[0]?.description}
              </p>
            </div>
          )}

          {/* PINNED BOTTOM-LEFT MOVEMENT PAD & PINNED BOTTOM-RIGHT ACTION CLUSTER */}
          {inputMode === 'touch' && (
            <>
              {/* Bottom-Left: Dedicated Left-Hand Movement Pad (D-Pad + Analog Center) */}
              <div className="pointer-events-auto fixed bottom-4 left-4 z-30 flex flex-col items-center">
                <div className="grid grid-cols-3 gap-1.5 w-36 h-36 sm:w-40 sm:h-40 bg-[#11131a]/88 p-2.5 rounded-full border-2 border-[#443c2e] shadow-2xl">
                  <div />
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      engineRef.current.touchMoveY = -1;
                    }}
                    onTouchEnd={() => (engineRef.current.touchMoveY = 0)}
                    onMouseDown={() => (engineRef.current.touchMoveY = -1)}
                    onMouseUp={() => (engineRef.current.touchMoveY = 0)}
                    className="bg-[#23201a] active:bg-amber-700 border border-[#4a4233] rounded-lg text-sm text-stone-100 font-bold flex items-center justify-center"
                  >
                    ▲
                  </button>
                  <div />
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      engineRef.current.touchMoveX = -1;
                    }}
                    onTouchEnd={() => (engineRef.current.touchMoveX = 0)}
                    onMouseDown={() => (engineRef.current.touchMoveX = -1)}
                    onMouseUp={() => (engineRef.current.touchMoveX = 0)}
                    className="bg-[#23201a] active:bg-amber-700 border border-[#4a4233] rounded-lg text-sm text-stone-100 font-bold flex items-center justify-center"
                  >
                    ◄
                  </button>
                  <div className="bg-amber-500/80 border border-amber-200 rounded-full m-1.5 shadow-inner" />
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      engineRef.current.touchMoveX = 1;
                    }}
                    onTouchEnd={() => (engineRef.current.touchMoveX = 0)}
                    onMouseDown={() => (engineRef.current.touchMoveX = 1)}
                    onMouseUp={() => (engineRef.current.touchMoveX = 0)}
                    className="bg-[#23201a] active:bg-amber-700 border border-[#4a4233] rounded-lg text-sm text-stone-100 font-bold flex items-center justify-center"
                  >
                    ►
                  </button>
                  <div />
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      engineRef.current.touchMoveY = 1;
                    }}
                    onTouchEnd={() => (engineRef.current.touchMoveY = 0)}
                    onMouseDown={() => (engineRef.current.touchMoveY = 1)}
                    onMouseUp={() => (engineRef.current.touchMoveY = 0)}
                    className="bg-[#23201a] active:bg-amber-700 border border-[#4a4233] rounded-lg text-sm text-stone-100 font-bold flex items-center justify-center"
                  >
                    ▼
                  </button>
                  <div />
                </div>
                <span className="mt-1 text-[10px] font-mono-tabular uppercase tracking-wider text-stone-400">
                  Move
                </span>
              </div>

              {/* Bottom-Right: Dedicated Right-Hand Combat Action Cluster */}
              <div className="pointer-events-auto fixed bottom-4 right-4 z-30 grid grid-cols-3 gap-2 sm:gap-2.5 bg-[#11131a]/75 p-2.5 rounded-2xl border border-[#352f24]">
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerPlayerAttack(false);
                  }}
                  onClick={() => triggerPlayerAttack(false)}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-amber-800/90 active:bg-amber-600 border-2 border-amber-400/70 rounded-full text-xs font-bold text-white shadow-lg"
                >
                  Strike
                </button>
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerPlayerAttack(true);
                  }}
                  onClick={() => triggerPlayerAttack(true)}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-rose-900/90 active:bg-rose-700 border-2 border-rose-400/70 rounded-full text-xs font-bold text-white shadow-lg"
                >
                  Heavy
                </button>
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerPlayerDodge();
                  }}
                  onClick={triggerPlayerDodge}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-sky-900/90 active:bg-sky-700 border-2 border-sky-400/70 rounded-full text-xs font-bold text-white shadow-lg"
                >
                  Dodge
                </button>
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerCastSpell();
                  }}
                  onClick={triggerCastSpell}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-900/90 active:bg-indigo-700 border-2 border-indigo-400/70 rounded-full text-xs font-bold text-white shadow-lg"
                >
                  Spell
                </button>
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerParryOrBlock();
                  }}
                  onClick={triggerParryOrBlock}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-stone-800/90 active:bg-stone-600 border-2 border-stone-400/70 rounded-full text-xs font-bold text-white shadow-lg"
                >
                  Parry
                </button>
                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    triggerInteract();
                  }}
                  onClick={triggerInteract}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-900/90 active:bg-emerald-700 border-2 border-emerald-400/70 rounded-full text-xs font-bold text-white shadow-lg"
                >
                  Act
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. PAUSE / DEATH / VICTORY OVERLAYS */}
      {screenState === 'PAUSED' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-6">
          <div className="max-w-md w-full bg-[#11131a] border border-[#2e2a24] rounded p-8 text-center space-y-6">
            <h2 className="font-display text-2xl font-bold text-amber-400">Vigil Paused</h2>
            <p className="text-xs text-stone-400">
              The living world holds its breath. Inspect your panoply or return to the ash.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setScreenState('PLAYING')}
                className="w-full py-2.5 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded"
              >
                Resume Game
              </button>
              <button
                onClick={toggleFullscreen}
                className="w-full py-2.5 text-xs font-medium bg-[#1f1d18] hover:bg-[#2b2821] text-amber-200 border border-[#3a342a] rounded"
              >
                {isFullscreen ? 'Exit Fullscreen (F11)' : 'Enter Fullscreen (F11)'}
              </button>
              <button
                onClick={handleSaveGame}
                className="w-full py-2.5 text-xs font-medium bg-[#1f1d18] hover:bg-[#2b2821] text-stone-200 border border-[#3a342a] rounded"
              >
                Save Chronicle
              </button>
              <button
                onClick={() => setScreenState('TITLE_MENU')}
                className="w-full py-2.5 text-xs font-medium bg-[#181613] hover:bg-[#24201b] text-stone-400 rounded"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {screenState === 'DEATH' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
          <div className="max-w-lg w-full text-center space-y-6">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-widest text-rose-600">
              CLAIMED BY THE ASH
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Your flesh fails, yet the First Ember refuses to release your memory. Your Sovereign Ash ({engineRef.current.player.bloodSpotAsh}) remains where you fell—return to your bloodstain to reclaim it.
            </p>
            <button
              onClick={handleRespawnFromDeath}
              className="px-8 py-3 text-sm font-display font-semibold bg-rose-800 hover:bg-rose-700 text-white border border-rose-500/50 rounded shadow-xl"
            >
              Rise at Last Ember Pyre
            </button>
          </div>
        </div>
      )}

      {screenState === 'VICTORY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6">
          <div className="max-w-xl w-full bg-[#11131a] border border-amber-600/60 rounded p-8 text-center space-y-6 shadow-2xl">
            <div className="text-xs uppercase tracking-widest text-amber-400 font-mono-tabular">
              The Seventh Star Stilled
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-stone-100">
              {worldState.endingUnlocked === 'cinder_age'
                ? 'Age of the Rekindled Hearth'
                : worldState.endingUnlocked === 'umbral_eclipse'
                ? 'Age of the Umbral Eclipse'
                : 'Age of the Unbound Sovereign'}
            </h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              {worldState.endingUnlocked === 'cinder_age'
                ? 'With Malakor felled and the Sacred Chalice bestowed upon Sister Verenice, the First Ember roars skyward. Warmth returns to Oakhaven Vigil, though the Cinder Covenant’s zealotry now rules the realm.'
                : worldState.endingUnlocked === 'umbral_eclipse'
                ? 'Malakor’s vessel shatters, and Whisperer Malrik’s Umbral Synod drinks the last light of the Seventh Star. A tranquil, immortal shadow drapes the Ashen Fields forevermore.'
                : 'Having slain the Hollowed Seraph without bowing to either Covenant or Synod, you claim the Seventh Star’s remnant for yourself. The living world continues to breathe under your watch.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setScreenState('PLAYING')}
                className="px-6 py-2.5 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded"
              >
                Continue Exploring Living World
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="px-6 py-2.5 text-xs font-medium bg-[#22201b] hover:bg-[#2f2c25] text-stone-200 border border-[#3d382e] rounded"
              >
                Begin New Cycle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. RPG MODALS & AI SIMULATION INSPECTOR */}
      <GameModals
        activeTab={activeModal}
        onClose={() => setActiveModal('none')}
        onSelectTab={(tab) => setActiveModal(tab)}
        level={level}
        ash={ash}
        attributes={attributes}
        inventory={inventory}
        equipped={equipped}
        spells={spells}
        activeSpellId={activeSpellId}
        onSelectSpell={(id) => setActiveSpellId(id)}
        onUpgradeSpell={(id) => {
          const sp = spells.find((s) => s.id === id);
          if (!sp) return;
          const cost = sp.masteryLevel * 140;
          if (ash < cost) return;
          setAsh((prev) => prev - cost);
          setSpells((prev) =>
            prev.map((s) => (s.id === id ? { ...s, masteryLevel: s.masteryLevel + 1 } : s))
          );
          audioEngine.playShrineChime();
        }}
        onEquipItem={(item) => {
          if (!item.equipSlot) return;
          setEquipped((prev) => ({ ...prev, [item.equipSlot!]: item }));
          audioEngine.playSwing(false);
        }}
        onUnequipSlot={(slot) => {
          setEquipped((prev) => ({ ...prev, [slot]: null }));
        }}
        onUseItem={(item) => {
          const p = engineRef.current.player;
          if (item.effectType === 'heal_hp') {
            p.hp = Math.min(p.maxHp, p.hp + (item.effectValue || 65));
          } else if (item.effectType === 'restore_mana') {
            p.mana = Math.min(p.maxMana, p.mana + (item.effectValue || 55));
          } else if (item.effectType === 'restore_stamina') {
            p.stamina = p.maxStamina;
            p.damageBuffTimer = 20;
          } else if (item.effectType === 'cure_status') {
            p.hp = Math.min(p.maxHp, p.hp + 20);
          } else if (item.effectType === 'grant_ash') {
            setAsh((prev) => prev + (item.effectValue || 250));
          } else if (item.effectType === 'learn_spell' && item.spellIdToLearn) {
            setActiveSpellId(item.spellIdToLearn);
            showBanner(`ATTUNED ANCIENT TOME: ${item.name}`);
          }
          audioEngine.playShrineChime();
          setInventory((prev) =>
            prev
              .map((it) => (it.id === item.id ? { ...it, quantity: it.quantity - 1 } : it))
              .filter((it) => it.quantity > 0)
          );
        }}
        onUpgradeWeapon={(wpn) => {
          const nextLvl = (wpn.upgradeLevel || 0) + 1;
          const cost = nextLvl * 110;
          if (ash < cost) return;
          setAsh((prev) => prev - cost);
          setInventory((prev) =>
            prev
              .map((it) => {
                if (it.id === 'mat_star_iron_shard') {
                  return { ...it, quantity: it.quantity - 1 };
                }
                if (it.id === wpn.id) {
                  return { ...it, upgradeLevel: nextLvl };
                }
                return it;
              })
              .filter((it) => it.quantity > 0)
          );
          if (equipped.weapon?.id === wpn.id) {
            setEquipped((prev) => ({
              ...prev,
              weapon: prev.weapon ? { ...prev.weapon, upgradeLevel: nextLvl } : null,
            }));
          }
          audioEngine.playParryClang();
          showBanner(`TEMPERED ${wpn.name.toUpperCase()} TO +${nextLvl}`);
        }}
        onCraftRecipe={(recipeId) => {
          const rec = CRAFTING_RECIPES.find((r) => r.id === recipeId);
          if (!rec || ash < rec.ashCost) return;
          setAsh((prev) => prev - rec.ashCost);
          setInventory((prev) => {
            let next = [...prev];
            rec.ingredients.forEach((ing) => {
              next = next
                .map((it) =>
                  it.id === ing.itemId ? { ...it, quantity: it.quantity - ing.count } : it
                )
                .filter((it) => it.quantity > 0);
            });
            const ex = next.find((it) => it.id === rec.resultItemId && it.stackable);
            if (ex) {
              ex.quantity += rec.resultQuantity;
            } else {
              next.push(cloneItem(rec.resultItemId, rec.resultQuantity));
            }
            return next;
          });
          audioEngine.playShrineChime();
        }}
        onLevelUpStat={(stat) => {
          const cost = Math.round(90 + level * 45);
          if (ash < cost) return;
          setAsh((prev) => prev - cost);
          setLevel((prev) => prev + 1);
          setAttributes((prev) => ({ ...prev, [stat]: prev[stat] + 1 }));
          engineRef.current.player.hp = engineRef.current.player.maxHp + 16;
          audioEngine.playShrineChime();
        }}
        onRestAtShrine={() => {
          const p = engineRef.current.player;
          p.hp = p.maxHp;
          p.stamina = p.maxStamina;
          p.mana = p.maxMana;
          engineRef.current.creatures = INITIAL_CREATURES.map((c) => ({ ...c }));
          // Ensure minimum 4 Crimson Draughts replenished on rest
          setInventory((prev) => {
            const next = [...prev];
            const ex = next.find((i) => i.id === 'item_ashen_flask');
            if (ex) ex.quantity = Math.max(ex.quantity, 4);
            else next.push(cloneItem('item_ashen_flask', 4));
            return next;
          });
          audioEngine.playShrineChime();
          showBanner('RESTED AT EMBER PYRE · VITALITY & FLASKS RESTORED');
        }}
        onFastTravel={(targetRegion) => {
          const eng = engineRef.current;
          eng.regionId = targetRegion;
          setCurrentRegion(targetRegion);
          const shrine = REGIONS[targetRegion].props.find((pr) => pr.type === 'bone_pyre_shrine');
          eng.player.x = shrine ? shrine.x : REGIONS[targetRegion].width / 2;
          eng.player.y = shrine ? shrine.y + 64 : REGIONS[targetRegion].height / 2;
          eng.npcs.forEach((n) => {
            if (n.alive && n.isCompanion) {
              n.regionId = targetRegion;
              n.x = eng.player.x + 40;
              n.y = eng.player.y + 20;
            }
          });
          setActiveModal('none');
          audioEngine.updateAmbientDrone(targetRegion);
          showBanner(`TRAVERSED LEYLINE TO ${REGIONS[targetRegion].name.toUpperCase()}`);
        }}
        currentRegion={currentRegion}
        npcs={npcs}
        worldState={worldState}
        quests={quests}
        activeNpcId={activeNpcId}
        onSendNpcDialogue={handleSendNpcDialogue}
        onBuyFromNpc={(npcId, itemId) => {
          const npc = npcs.find((n) => n.id === npcId);
          const item = ITEMS_CATALOG[itemId];
          if (!npc || !item) return;
          const priceFactor =
            worldState.settlementFood < 35 ? 1.25 : npc.trust > 40 ? 0.85 : 1.0;
          const cost = Math.max(15, Math.round(item.value * priceFactor));
          if (ash < cost) return;
          setAsh((prev) => prev - cost);
          setInventory((prev) => {
            const next = [...prev];
            const ex = next.find((i) => i.id === itemId && i.stackable);
            if (ex) ex.quantity += 1;
            else next.push(cloneItem(itemId, 1));
            return next;
          });
          audioEngine.playShrineChime();
        }}
        onQuestDecision={handleQuestDecision}
        inputMode={inputMode}
        onSetInputMode={(m) => setInputMode(m)}
        muted={muted}
        onToggleMute={() => {
          const next = !muted;
          setMuted(next);
          audioEngine.setMuted(next);
        }}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onSaveGame={handleSaveGame}
        onLoadGame={handleLoadGame}
        onResetWorld={() => {
          localStorage.removeItem(SAVE_STORAGE_KEY);
          window.location.reload();
        }}
      />
    </div>
  );
}
