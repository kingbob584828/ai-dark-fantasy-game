export type RegionId =
  | 'oakhaven'
  | 'bramblewood'
  | 'cathedral'
  | 'catacombs'
  | 'bastion'
  | 'crucible';

export type InputDeviceMode = 'keyboard_mouse' | 'gamepad' | 'touch';

export type GameScreenState =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'DEATH'
  | 'VICTORY';

export type ActiveModalTab =
  | 'none'
  | 'inventory'
  | 'character'
  | 'grimoire'
  | 'world_ai'
  | 'journal'
  | 'map'
  | 'crafting'
  | 'settings'
  | 'dialogue'
  | 'shrine';

export type FactionId =
  | 'cinder_covenant'
  | 'umbral_synod'
  | 'oakhaven_survivors'
  | 'blight_wilds'
  | 'ancient_dead';

export type MagicSchool =
  | 'graviturgy'
  | 'bloodcraft'
  | 'pyromancy'
  | 'umbral_arts'
  | 'vitalism'
  | 'runic_sorcery';

export type WeaponCategory =
  | 'sword'
  | 'greatsword'
  | 'dagger'
  | 'spear'
  | 'axe'
  | 'bow'
  | 'catalyst';

export type EquipSlot =
  | 'weapon'
  | 'offhand'
  | 'helmet'
  | 'armor'
  | 'gloves'
  | 'boots'
  | 'ring'
  | 'talisman';

export type ItemCategory =
  | 'weapon'
  | 'equipment'
  | 'consumable'
  | 'material'
  | 'key'
  | 'relic'
  | 'tome';

export interface Attributes {
  vitality: number;     // Max HP & Bleed/Blight resist
  endurance: number;    // Max Stamina & Max Equip Load
  strength: number;     // Heavy melee scaling & physical poise
  dexterity: number;    // Agile weapon scaling, attack/cast speed, crit chance
  intelligence: number; // Graviturgy, Runic & Pyromancy scaling
  willpower: number;    // Max Mana, Vitalism scaling & focus regen
  arcana: number;       // Bloodcraft, Umbral scaling & item discovery
}

export interface ScalingGrades {
  strength?: 'S' | 'A' | 'B' | 'C' | 'D';
  dexterity?: 'S' | 'A' | 'B' | 'C' | 'D';
  intelligence?: 'S' | 'A' | 'B' | 'C' | 'D';
  willpower?: 'S' | 'A' | 'B' | 'C' | 'D';
  arcana?: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface GameItem {
  id: string;
  name: string;
  category: ItemCategory;
  equipSlot?: EquipSlot;
  weaponCategory?: WeaponCategory;
  description: string;
  lore: string;
  weight: number;
  value: number;
  stackable: boolean;
  quantity: number;
  upgradeLevel?: number;
  // Weapon specific
  baseDamage?: number;
  magicDamage?: number;
  reach?: number;          // pixels
  arcDegrees?: number;     // swing arc
  attackSpeed?: number;    // attacks per sec
  staminaCost?: number;
  poiseDamage?: number;
  scaling?: ScalingGrades;
  specialAbilityName?: string;
  specialAbilityDesc?: string;
  statusInflict?: { type: StatusEffectType; amount: number };
  // Armor / Ring / Talisman specific
  defensePhysical?: number;
  defenseMagic?: number;
  poiseBonus?: number;
  passiveEffect?: string;
  statBonuses?: Partial<Attributes>;
  // Consumable / Tome / Crafting
  effectType?: 'heal_hp' | 'restore_mana' | 'restore_stamina' | 'cure_status' | 'buff_damage' | 'learn_spell' | 'grant_ash';
  effectValue?: number;
  spellIdToLearn?: string;
}

export type StatusEffectType = 'burning' | 'bleeding' | 'blighted' | 'gravitied' | 'umbral_veil' | 'regenerating';

export interface ActiveStatusEffect {
  type: StatusEffectType;
  duration: number;
  intensity: number;
}

export interface SpellDefinition {
  id: string;
  name: string;
  school: MagicSchool;
  manaCost: number;
  healthCost: number;
  staminaCost: number;
  cooldown: number;
  castTime: number;
  basePower: number;
  range: number;
  radius: number;
  description: string;
  lore: string;
  synergyHint: string;
  unlocked: boolean;
  masteryLevel: number;
  scalingStat: keyof Attributes;
  type: 'projectile' | 'zone' | 'self_buff' | 'glyph_trap' | 'nova' | 'beam';
  colorPrimary: string;
  colorSecondary: string;
}

export interface ActiveSpellZone {
  id: string;
  regionId: RegionId;
  x: number;
  y: number;
  radius: number;
  school: MagicSchool;
  spellId: string;
  duration: number;
  maxDuration: number;
  ownerId: string;
  power: number;
  synergyTriggered?: boolean;
  synergyName?: string;
}

export interface Projectile {
  id: string;
  regionId: RegionId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  poiseDamage: number;
  ownerId: string;
  isPlayer: boolean;
  school?: MagicSchool;
  color: string;
  life: number;
  runicEmpowered?: boolean;
  statusInflict?: StatusEffectType;
}

export type CreatureEcologyRole =
  | 'prey'
  | 'predator'
  | 'scavenger'
  | 'faction_guard'
  | 'spirit'
  | 'miniboss'
  | 'boss';

export type CreatureAIState =
  | 'idle'
  | 'patrol'
  | 'graze'
  | 'stalk_prey'
  | 'scavenge_corpse'
  | 'investigate'
  | 'flee'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'staggered';

export interface CreatureEntity {
  id: string;
  name: string;
  title?: string;
  archetype: string;
  role: CreatureEcologyRole;
  faction: FactionId;
  regionId: RegionId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  facing: number; // radians
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  damage: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  aiState: CreatureAIState;
  stateTimer: number;
  windupDuration: number;
  attackDuration: number;
  recoveryDuration: number;
  targetId: string | null;
  statusEffects: ActiveStatusEffect[];
  ashReward: number;
  lootTable: string[];
  isBoss?: boolean;
  isMiniboss?: boolean;
  bossPhase?: 1 | 2 | 3;
  corpseConsumedCount?: number;
  colorPrimary: string;
  colorSecondary: string;
  scale: number;
  hitFlash: number;
  animTime: number;
  attackPatternIndex?: number;
}

export interface CorpseEntity {
  id: string;
  name: string;
  regionId: RegionId;
  x: number;
  y: number;
  ashValue: number;
  lootItemIds: string[];
  scavenged: boolean;
  createdAt: number;
  isLoreCorpse?: boolean;
  loreText?: string;
}

export interface NPCMemory {
  id: string;
  timestamp: number;
  type: 'interaction' | 'combat' | 'world_event' | 'rumor' | 'betrayal' | 'gift';
  summary: string;
  sentiment: number; // -10 to +10
  actorId: string;
}

export type NPCGoalType =
  | 'preserve_settlement_supplies'
  | 'forage_in_bramblewood'
  | 'forge_star_iron_weapons'
  | 'search_catacombs_for_apprentice'
  | 'maximize_relic_profits'
  | 'purge_ironmire_bastion'
  | 'accompany_player'
  | 'decode_cathedral_runes'
  | 'recruit_for_cinder_assault'
  | 'sabotage_oakhaven_stores'
  | 'flee_to_safety'
  | 'hunt_rival';

export interface AutonomousNPC {
  id: string;
  name: string;
  title: string;
  faction: FactionId;
  regionId: RegionId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  isCompanion: boolean;
  // AI Mind & Epistemic State
  personality: {
    courage: number;    // 0-100
    greed: number;      // 0-100
    piety: number;      // 0-100
    empathy: number;    // 0-100
    curiosity: number;  // 0-100
  };
  belief: string;
  fear: string;
  desire: string;
  currentGoal: NPCGoalType;
  currentAction: string;
  utilityScores: Record<string, number>;
  trust: number;        // -100 to 100 toward player
  fearOfPlayer: number; // 0 to 100
  respect: number;      // -100 to 100
  relationships: Record<string, { affinity: number; label: string }>; // other NPC ids
  knownFacts: string[];
  memories: NPCMemory[];
  shopInventory: string[];
  colorCloak: string;
  colorArmor: string;
  colorAccent: string;
  dialogueGreeting: string;
  lastDecisionTick: number;
  hitFlash: number;
  combatCooldown: number;
}

export interface WorldEventRecord {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  regionId: RegionId;
  category: 'scarcity' | 'faction_war' | 'ecology' | 'npc_ambition' | 'reputation' | 'discovery';
  consequence: string;
}

export interface QuestStage {
  id: string;
  description: string;
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  giverNpcId: string;
  faction: FactionId;
  description: string;
  status: 'active' | 'completed' | 'failed';
  outcome?: string;
  stages: QuestStage[];
  rewardAsh: number;
  rewardItemIds: string[];
}

export interface RegionPortal {
  id: string;
  x: number;
  y: number;
  radius: number;
  targetRegion: RegionId;
  targetX: number;
  targetY: number;
  label: string;
  locked?: boolean;
  requiredKeyId?: string;
  shortcutId?: string;
}

export interface RegionProp {
  id: string;
  type:
    | 'ruined_pillar'
    | 'dead_tree'
    | 'torch_brazier'
    | 'moon_altar'
    | 'gothic_arch'
    | 'catacomb_sarcophagus'
    | 'spike_trap'
    | 'fortress_barricade'
    | 'bone_pyre_shrine'
    | 'lore_monolith'
    | 'treasure_chest'
    | 'shortcut_gate';
  x: number;
  y: number;
  width: number;
  height: number;
  solid: boolean;
  interactable?: boolean;
  label?: string;
  loreTitle?: string;
  loreText?: string;
  chestLootIds?: string[];
  opened?: boolean;
  shortcutId?: string;
  lightColor?: string;
  lightRadius?: number;
}

export interface RegionDefinition {
  id: RegionId;
  name: string;
  subtitle: string;
  loreDescription: string;
  width: number;
  height: number;
  ambientColor: string;
  groundColorPrimary: string;
  groundColorSecondary: string;
  fogColor: string;
  weatherType: 'ash' | 'spores' | 'moon_motes' | 'ember_storm' | 'catacomb_dust';
  dangerLevel: number;
  portals: RegionPortal[];
  props: RegionProp[];
}

export interface WorldSimulationState {
  tickCount: number;
  dayTime: number; // 0 to 1 (cycle of dusk, midnight, eclipse, pale dawn)
  settlementFood: number;     // 0 to 100
  settlementMedicine: number; // 0 to 100
  settlementMorale: number;   // 0 to 100
  cinderCovenantPower: number; // 0 to 100
  umbralSynodPower: number;    // 0 to 100
  bastionController: FactionId;
  unlockedShortcuts: string[];
  openedChests: string[];
  discoveredLoreIds: string[];
  reputation: {
    cinder_covenant: number;
    umbral_synod: number;
    oakhaven_survivors: number;
  };
  events: WorldEventRecord[];
  endingUnlocked?: 'cinder_age' | 'umbral_eclipse' | 'sovereign_of_ash' | null;
}

export interface CraftingRecipe {
  id: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: { itemId: string; count: number }[];
  ashCost: number;
  description: string;
}
