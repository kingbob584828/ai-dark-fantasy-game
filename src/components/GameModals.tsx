import React, { useState } from 'react';
import {
  ActiveModalTab,
  Attributes,
  AutonomousNPC,
  EquipSlot,
  GameItem,
  InputDeviceMode,
  Quest,
  RegionId,
  SpellDefinition,
  WorldSimulationState,
} from '../types/game';
import { CRAFTING_RECIPES, ITEMS_CATALOG } from '../data/itemsAndSpells';
import { REGIONS } from '../data/worldAndEntities';

interface GameModalsProps {
  activeTab: ActiveModalTab;
  onClose: () => void;
  onSelectTab: (tab: ActiveModalTab) => void;
  // Player & Inventory
  level: number;
  ash: number;
  attributes: Attributes;
  inventory: GameItem[];
  equipped: Record<EquipSlot, GameItem | null>;
  spells: SpellDefinition[];
  activeSpellId: string;
  onSelectSpell: (spellId: string) => void;
  onUpgradeSpell: (spellId: string) => void;
  onEquipItem: (item: GameItem) => void;
  onUnequipSlot: (slot: EquipSlot) => void;
  onUseItem: (item: GameItem) => void;
  onUpgradeWeapon: (item: GameItem) => void;
  onCraftRecipe: (recipeId: string) => void;
  onLevelUpStat: (stat: keyof Attributes) => void;
  onRestAtShrine: () => void;
  onFastTravel: (regionId: RegionId) => void;
  // Living World & AI
  currentRegion: RegionId;
  npcs: AutonomousNPC[];
  worldState: WorldSimulationState;
  quests: Quest[];
  activeNpcId: string | null;
  onSendNpcDialogue: (
    npcId: string,
    input: string,
    intent: string
  ) => Promise<{
    dialogue: string;
    innerThought: string;
    revealedFact?: string;
  }>;
  onBuyFromNpc: (npcId: string, itemId: string) => void;
  onQuestDecision: (actionId: string) => void;
  // Settings & Persistence
  inputMode: InputDeviceMode;
  onSetInputMode: (mode: InputDeviceMode) => void;
  muted: boolean;
  onToggleMute: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onResetWorld: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  activeTab,
  onClose,
  onSelectTab,
  level,
  ash,
  attributes,
  inventory,
  equipped,
  spells,
  activeSpellId,
  onSelectSpell,
  onUpgradeSpell,
  onEquipItem,
  onUnequipSlot,
  onUseItem,
  onUpgradeWeapon,
  onCraftRecipe,
  onLevelUpStat,
  onRestAtShrine,
  onFastTravel,
  currentRegion,
  npcs,
  worldState,
  quests,
  activeNpcId,
  onSendNpcDialogue,
  onBuyFromNpc,
  onQuestDecision,
  inputMode,
  onSetInputMode,
  muted,
  onToggleMute,
  onSaveGame,
  onLoadGame,
  onResetWorld,
}) => {
  const [invFilter, setInvFilter] = useState<'all' | 'weapon' | 'equipment' | 'consumable' | 'material'>('all');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedInspectorNpcId, setSelectedInspectorNpcId] = useState<string>(npcs[0]?.id || 'npc_verenice');
  const [customDialogueText, setCustomDialogueText] = useState<string>('');
  const [dialogueIntent, setDialogueIntent] = useState<string>('converse');
  const [npcResponseText, setNpcResponseText] = useState<string>('');
  const [npcInnerThought, setNpcInnerThought] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);

  if (activeTab === 'none') return null;

  // Derived character stats
  const totalWeight = Object.values(equipped).reduce((sum, it) => sum + (it?.weight || 0), 0);
  const maxEquipLoad = 28 + attributes.endurance * 2.5;
  const loadRatio = totalWeight / maxEquipLoad;
  const rollClass = loadRatio < 0.35 ? 'Light Roll (Fast)' : loadRatio <= 0.7 ? 'Medium Roll' : 'Heavy Roll (Slow)';
  const levelUpCost = Math.round(90 + level * 45);

  const selectedItem =
    inventory.find((i) => i.id === selectedItemId) ||
    Object.values(equipped).find((i) => i && i.id === selectedItemId) ||
    inventory[0] ||
    null;

  const activeNpc = npcs.find((n) => n.id === activeNpcId) || npcs[0];
  const inspectedNpc = npcs.find((n) => n.id === selectedInspectorNpcId) || npcs[0];

  const handleTriggerDialogue = async (text: string, intent: string) => {
    if (!activeNpc || !text.trim()) return;
    setIsThinking(true);
    try {
      const res = await onSendNpcDialogue(activeNpc.id, text, intent);
      setNpcResponseText(res.dialogue);
      setNpcInnerThought(res.innerThought);
      setCustomDialogueText('');
    } finally {
      setIsThinking(false);
    }
  };

  const navTabs: { id: ActiveModalTab; label: string }[] = [
    { id: 'inventory', label: 'Inventory' },
    { id: 'character', label: 'Attributes' },
    { id: 'grimoire', label: 'Grimoire' },
    { id: 'crafting', label: 'Craft & Temper' },
    { id: 'world_ai', label: 'AI Living World' },
    { id: 'journal', label: 'Quests & Lore' },
    { id: 'map', label: 'World Map' },
    { id: 'settings', label: 'System' },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 md:p-8">
      <div className="relative flex flex-col w-full max-w-6xl h-[86vh] bg-[#11131a] border border-[#2e2a24] rounded-md shadow-2xl overflow-hidden text-[#e5e0d8]">
        {/* Modal Top Navigation Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#27241d] bg-[#0d0f14]">
          <div className="flex items-center gap-3 overflow-x-auto">
            {activeTab === 'dialogue' ? (
              <span className="font-display text-lg font-semibold text-amber-400 whitespace-nowrap shrink-0">
                Character Interaction · {activeNpc?.name}
              </span>
            ) : activeTab === 'shrine' ? (
              <span className="font-display text-lg font-semibold text-amber-400 whitespace-nowrap shrink-0">
                First Ember Pyre · Sanctuary Attunement
              </span>
            ) : (
              navTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelectTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === t.id
                      ? 'bg-[#262118] text-amber-300 border border-amber-700/50'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {t.label}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-6 shrink-0">
            <div className="text-xs text-stone-400 font-mono-tabular whitespace-nowrap">
              <span>Level {level}</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span className="text-amber-400">{ash} Sovereign Ash</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium bg-[#1f1c18] hover:bg-[#2c2720] text-stone-200 border border-[#3a3328] rounded transition-colors whitespace-nowrap shrink-0"
            >
              Resume Game (Esc)
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ==================== 1. INVENTORY & EQUIPMENT TAB ==================== */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
              {/* Left Column: Equipped Slots */}
              <div className="lg:col-span-4 space-y-4 border-r border-[#24211b] pr-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold text-stone-100">Equipped Panoply</h2>
                  <span className="text-xs font-mono-tabular text-stone-400">
                    Load {totalWeight.toFixed(1)} / {maxEquipLoad.toFixed(1)} ({rollClass})
                  </span>
                </div>

                <div className="space-y-2.5">
                  {(['weapon', 'helmet', 'armor', 'gloves', 'boots', 'ring', 'talisman'] as EquipSlot[]).map((slot) => {
                    const item = equipped[slot];
                    return (
                      <div
                        key={slot}
                        onClick={() => item && setSelectedItemId(item.id)}
                        className="flex items-center justify-between p-3 bg-[#171922] border border-[#27241e] rounded cursor-pointer hover:border-amber-700/50 transition-colors"
                      >
                        <div>
                          <div className="text-xs text-stone-400 capitalize">{slot}</div>
                          <div className="text-sm font-medium text-stone-100">
                            {item ? (
                              <>
                                {item.name}
                                {item.upgradeLevel ? ` +${item.upgradeLevel}` : ''}
                              </>
                            ) : (
                              <span className="text-stone-500">Unbound Slot</span>
                            )}
                          </div>
                        </div>
                        {item && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnequipSlot(slot);
                            }}
                            className="px-3 py-1 text-xs bg-[#242019] hover:bg-[#332c22] text-stone-300 rounded whitespace-nowrap shrink-0"
                          >
                            Unequip
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Center Column: Inventory Pack */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-stone-100">Pack Contents</h2>
                  <div className="flex items-center gap-1 bg-[#171922] p-1 rounded border border-[#27241e]">
                    {(['all', 'weapon', 'equipment', 'consumable', 'material'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setInvFilter(cat)}
                        className={`px-2.5 py-1 text-xs rounded capitalize transition-colors whitespace-nowrap shrink-0 ${
                          invFilter === cat
                            ? 'bg-amber-900/40 text-amber-300'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {inventory
                    .filter((item) => invFilter === 'all' || item.category === invFilter)
                    .map((item) => {
                      const isEquipped =
                        item.equipSlot && equipped[item.equipSlot]?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${
                            selectedItem?.id === item.id
                              ? 'bg-[#211e18] border-amber-600/60'
                              : 'bg-[#151720] border-[#25231d] hover:border-stone-700'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-medium text-stone-100">
                              {item.name}
                              {item.upgradeLevel ? ` +${item.upgradeLevel}` : ''}
                              {item.stackable && item.quantity > 1 ? ` (×${item.quantity})` : ''}
                            </div>
                            <div className="text-xs text-stone-400 font-mono-tabular">
                              <span>{item.category}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>Wt {item.weight}</span>
                              {isEquipped && (
                                <>
                                  <span className="mx-1.5" aria-hidden="true">·</span>
                                  <span className="text-amber-400">Equipped</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(item.category === 'weapon' || item.category === 'equipment') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEquipItem(item);
                                }}
                                className="px-3 py-1 text-xs font-medium bg-amber-900/40 hover:bg-amber-800/50 text-amber-200 border border-amber-700/40 rounded whitespace-nowrap shrink-0"
                              >
                                Equip
                              </button>
                            )}
                            {(item.category === 'consumable' || item.category === 'tome') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUseItem(item);
                                }}
                                className="px-3 py-1 text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50 rounded whitespace-nowrap shrink-0"
                              >
                                Use
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: Item Inspection & Lore Comparison */}
              <div className="lg:col-span-4 bg-[#151720] border border-[#27241e] rounded p-5 space-y-4">
                {selectedItem ? (
                  <>
                    <div>
                      <div className="text-xs text-stone-400 capitalize">
                        {selectedItem.category}
                        {selectedItem.weaponCategory ? ` · ${selectedItem.weaponCategory}` : ''}
                      </div>
                      <h3 className="font-display text-xl font-semibold text-amber-300 mt-0.5">
                        {selectedItem.name}
                        {selectedItem.upgradeLevel ? ` +${selectedItem.upgradeLevel}` : ''}
                      </h3>
                    </div>

                    <p className="text-sm text-stone-300 leading-relaxed">
                      {selectedItem.description}
                    </p>

                    <div className="border-t border-b border-[#26231d] py-3 space-y-1.5 text-xs font-mono-tabular text-stone-300">
                      {selectedItem.baseDamage !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Physical Damage:</span>
                          <span>
                            {selectedItem.baseDamage + (selectedItem.upgradeLevel || 0) * 7}
                          </span>
                        </div>
                      )}
                      {selectedItem.magicDamage !== undefined && selectedItem.magicDamage > 0 && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Astral / Magic Damage:</span>
                          <span className="text-indigo-300">
                            {selectedItem.magicDamage + (selectedItem.upgradeLevel || 0) * 5}
                          </span>
                        </div>
                      )}
                      {selectedItem.poiseDamage !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Poise Break:</span>
                          <span>{selectedItem.poiseDamage}</span>
                        </div>
                      )}
                      {selectedItem.reach !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Reach & Stamina Cost:</span>
                          <span>
                            {selectedItem.reach}px · {selectedItem.staminaCost} Stamina
                          </span>
                        </div>
                      )}
                      {selectedItem.scaling && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Attribute Scaling:</span>
                          <span className="text-amber-300">
                            {Object.entries(selectedItem.scaling)
                              .map(([k, v]) => `${k.slice(0, 3).toUpperCase()} ${v}`)
                              .join(' · ')}
                          </span>
                        </div>
                      )}
                      {selectedItem.defensePhysical !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Defense (Phys / Magic):</span>
                          <span>
                            +{selectedItem.defensePhysical} / +{selectedItem.defenseMagic || 0}
                          </span>
                        </div>
                      )}
                      {selectedItem.passiveEffect && (
                        <div className="flex justify-between">
                          <span className="text-stone-400">Passive Property:</span>
                          <span className="text-emerald-300">{selectedItem.passiveEffect}</span>
                        </div>
                      )}
                      {selectedItem.specialAbilityName && (
                        <div className="pt-1 text-amber-200">
                          Weapon Art — {selectedItem.specialAbilityName}: {selectedItem.specialAbilityDesc}
                        </div>
                      )}
                    </div>

                    <blockquote className="text-xs italic text-stone-400 leading-relaxed">
                      “{selectedItem.lore}”
                    </blockquote>
                  </>
                ) : (
                  <div className="text-sm text-stone-500">Select an item to inspect its stats and lore.</div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 2. CHARACTER ATTRIBUTES & LEVELING TAB ==================== */}
          {(activeTab === 'character' || activeTab === 'shrine') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-semibold text-stone-100">
                      Sovereign Attribute Ascension
                    </h2>
                    <p className="text-xs text-stone-400 mt-1">
                      Channel Sovereign Ash to permanently elevate attributes and unlock specialized builds.
                    </p>
                  </div>
                  {activeTab === 'shrine' && (
                    <button
                      onClick={onRestAtShrine}
                      className="px-4 py-2 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded transition-colors whitespace-nowrap shrink-0"
                    >
                      Rest & Restore All (Respawns Foes)
                    </button>
                  )}
                </div>

                <div className="p-3 bg-[#161822] border border-[#2a261f] rounded text-xs font-mono-tabular flex justify-between">
                  <span>Next Ascension Cost: {levelUpCost} Sovereign Ash</span>
                  <span className="text-amber-400">Held Ash: {ash}</span>
                </div>

                <div className="space-y-2.5">
                  {(
                    [
                      {
                        key: 'vitality',
                        label: 'Vitality',
                        desc: 'Increases Maximum Health (+16 HP/pt) and Bleed/Blight resistance.',
                      },
                      {
                        key: 'endurance',
                        label: 'Endurance',
                        desc: 'Increases Maximum Stamina (+10/pt) and Equipment Load capacity (+2.5/pt).',
                      },
                      {
                        key: 'strength',
                        label: 'Strength',
                        desc: 'Scales Greatswords, Axes & Halberds; boosts physical Poise.',
                      },
                      {
                        key: 'dexterity',
                        label: 'Dexterity',
                        desc: 'Scales Daggers, Bows, Spears & Rapiers; increases critical hit precision.',
                      },
                      {
                        key: 'intelligence',
                        label: 'Intelligence',
                        desc: 'Scales Graviturgy, Pyromancy & Runic Sorcery spell potency.',
                      },
                      {
                        key: 'willpower',
                        label: 'Willpower',
                        desc: 'Increases Maximum Mana (+12/pt), Vitalism healing, and persuasion power.',
                      },
                      {
                        key: 'arcana',
                        label: 'Arcana',
                        desc: 'Scales Bloodcraft & Umbral Arts; boosts hemorrhage buildup and guile.',
                      },
                    ] as { key: keyof Attributes; label: string; desc: string }[]
                  ).map((attr) => (
                    <div
                      key={attr.key}
                      className="flex items-center justify-between p-3 bg-[#151720] border border-[#25231d] rounded"
                    >
                      <div className="pr-4">
                        <div className="text-sm font-medium text-stone-100">
                          {attr.label}{' '}
                          <span className="font-mono-tabular text-amber-400 ml-2">
                            {attributes[attr.key]}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400">{attr.desc}</div>
                      </div>
                      <button
                        disabled={ash < levelUpCost}
                        onClick={() => onLevelUpStat(attr.key)}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          ash >= levelUpCost
                            ? 'bg-amber-700 hover:bg-amber-600 text-white'
                            : 'bg-[#22201b] text-stone-500 cursor-not-allowed'
                        }`}
                      >
                        Ascend (+1)
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-6 space-y-6">
                <div className="bg-[#151720] border border-[#27241e] rounded p-5 space-y-4">
                  <h3 className="font-display text-lg font-semibold text-stone-100">
                    Derived Combat Calculations
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono-tabular">
                    <div className="p-3 bg-[#101218] rounded border border-[#22201a]">
                      <div className="text-stone-400">Max Health</div>
                      <div className="text-lg font-semibold text-rose-400">
                        {100 + attributes.vitality * 16} HP
                      </div>
                    </div>
                    <div className="p-3 bg-[#101218] rounded border border-[#22201a]">
                      <div className="text-stone-400">Max Stamina</div>
                      <div className="text-lg font-semibold text-emerald-400">
                        {80 + attributes.endurance * 10} ST
                      </div>
                    </div>
                    <div className="p-3 bg-[#101218] rounded border border-[#22201a]">
                      <div className="text-stone-400">Max Mana / Focus</div>
                      <div className="text-lg font-semibold text-sky-400">
                        {60 + attributes.willpower * 12} MP
                      </div>
                    </div>
                    <div className="p-3 bg-[#101218] rounded border border-[#22201a]">
                      <div className="text-stone-400">Equip Load & Roll</div>
                      <div className="text-sm font-semibold text-amber-300">
                        {totalWeight.toFixed(1)}/{maxEquipLoad.toFixed(1)} · {rollClass}
                      </div>
                    </div>
                  </div>

                  {activeTab === 'shrine' && (
                    <div className="pt-4 border-t border-[#27241e] space-y-3">
                      <h4 className="font-display text-sm font-semibold text-amber-300">
                        Traverse the Ember Leylines (Fast Travel)
                      </h4>
                      <div className="grid grid-cols-2 gap-2.5">
                        {(Object.keys(REGIONS) as RegionId[]).map((rId) => (
                          <button
                            key={rId}
                            onClick={() => onFastTravel(rId)}
                            className={`px-3 py-2 text-xs font-medium rounded border text-left transition-colors whitespace-nowrap truncate ${
                              currentRegion === rId
                                ? 'bg-amber-900/30 border-amber-600 text-amber-200'
                                : 'bg-[#1a1c26] border-[#2d2921] text-stone-300 hover:border-amber-700/50'
                            }`}
                          >
                            {REGIONS[rId].name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 3. DEEP MAGIC GRIMOIRE & SYNERGIES TAB ==================== */}
          {activeTab === 'grimoire' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-stone-100">
                  Six Schools of the Shattered Firmament
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  Attune your active spell (Right-Click / Q / Controller LB) and combine persistent spell zones for cross-school reactions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {spells.map((spell) => {
                  const isSelected = spell.id === activeSpellId;
                  const upgradeCost = spell.masteryLevel * 140;
                  return (
                    <div
                      key={spell.id}
                      className={`flex flex-col justify-between p-4 rounded border transition-colors ${
                        isSelected
                          ? 'bg-[#1e1b29] border-indigo-500'
                          : 'bg-[#151720] border-[#26231d]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-stone-400 font-mono-tabular">
                          <span className="uppercase tracking-wider text-indigo-300">
                            {spell.school.replace('_', ' ')}
                          </span>
                          <span>Mastery Lv.{spell.masteryLevel}</span>
                        </div>
                        <h3 className="font-display text-base font-semibold text-stone-100">
                          {spell.name}
                        </h3>
                        <p className="text-xs text-stone-300 leading-relaxed">
                          {spell.description}
                        </p>
                        <div className="text-xs font-mono-tabular text-stone-400">
                          <span>MP {spell.manaCost}</span>
                          {spell.healthCost > 0 && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span className="text-rose-400">HP Sacrifice {spell.healthCost}</span>
                            </>
                          )}
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>Power {spell.basePower + (spell.masteryLevel - 1) * 10}</span>
                        </div>
                        <div className="p-2.5 bg-[#101219] border border-[#24221d] rounded text-xs text-amber-200/90 leading-relaxed">
                          {spell.synergyHint}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[#25231c]">
                        <button
                          onClick={() => onSelectSpell(spell.id)}
                          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-[#23201b] hover:bg-[#2f2b24] text-stone-200'
                          }`}
                        >
                          {isSelected ? 'Attuned Active Spell' : 'Attune Spell'}
                        </button>
                        <button
                          disabled={ash < upgradeCost}
                          onClick={() => onUpgradeSpell(spell.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                            ash >= upgradeCost
                              ? 'bg-amber-800/50 hover:bg-amber-700/60 text-amber-200 border border-amber-700/50'
                              : 'bg-[#1c1a17] text-stone-500 cursor-not-allowed'
                          }`}
                        >
                          Master ({upgradeCost} Ash)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== 4. CRAFTING & WEAPON TEMPERING TAB ==================== */}
          {activeTab === 'crafting' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Weapon Tempering */}
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    Star-Iron Weapon Tempering
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    Reinforce weapons up to +5 using Star-Iron Fragments and Sovereign Ash.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {inventory
                    .filter((i) => i.category === 'weapon')
                    .map((wpn) => {
                      const nextLvl = (wpn.upgradeLevel || 0) + 1;
                      const ashCost = nextLvl * 110;
                      const starIronHeld =
                        inventory.find((i) => i.id === 'mat_star_iron_shard')?.quantity || 0;
                      const canUpgrade =
                        nextLvl <= 5 && starIronHeld >= 1 && ash >= ashCost;

                      return (
                        <div
                          key={wpn.id}
                          className="flex items-center justify-between p-3.5 bg-[#151720] border border-[#27241e] rounded"
                        >
                          <div>
                            <div className="text-sm font-medium text-stone-100">
                              {wpn.name} +{wpn.upgradeLevel || 0}
                            </div>
                            <div className="text-xs text-stone-400 font-mono-tabular">
                              <span>
                                Base Dmg {(wpn.baseDamage || 20) + (wpn.upgradeLevel || 0) * 7} →{' '}
                                {(wpn.baseDamage || 20) + nextLvl * 7}
                              </span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>Requires 1 Star-Iron & {ashCost} Ash</span>
                            </div>
                          </div>
                          <button
                            disabled={!canUpgrade}
                            onClick={() => onUpgradeWeapon(wpn)}
                            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                              canUpgrade
                                ? 'bg-amber-700 hover:bg-amber-600 text-white'
                                : 'bg-[#22201b] text-stone-500 cursor-not-allowed'
                            }`}
                          >
                            {nextLvl > 5 ? 'Max Tempered' : `Temper to +${nextLvl}`}
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Alchemical Crafting */}
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    Field Alchemy & Distillation
                  </h2>
                  <p className="text-xs text-stone-400 mt-1">
                    Synthesize draughts, phials, and catalysts from harvested Bramblewood spores and Synod marrow.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {CRAFTING_RECIPES.map((rec) => {
                    const outItem = ITEMS_CATALOG[rec.resultItemId];
                    const hasIngredients = rec.ingredients.every((ing) => {
                      const held = inventory.find((i) => i.id === ing.itemId)?.quantity || 0;
                      return held >= ing.count;
                    });
                    const canCraft = hasIngredients && ash >= rec.ashCost;

                    return (
                      <div
                        key={rec.id}
                        className="flex items-center justify-between p-3.5 bg-[#151720] border border-[#27241e] rounded"
                      >
                        <div className="pr-4">
                          <div className="text-sm font-medium text-stone-100">
                            {outItem?.name} ×{rec.resultQuantity}
                          </div>
                          <div className="text-xs text-stone-400 mt-0.5">{rec.description}</div>
                          <div className="text-xs text-amber-300/90 font-mono-tabular mt-1">
                            {rec.ingredients
                              .map((ing) => {
                                const held =
                                  inventory.find((i) => i.id === ing.itemId)?.quantity || 0;
                                return `${ITEMS_CATALOG[ing.itemId]?.name}: ${held}/${ing.count}`;
                              })
                              .join(' · ')}{' '}
                            · {rec.ashCost} Ash
                          </div>
                        </div>

                        <button
                          disabled={!canCraft}
                          onClick={() => onCraftRecipe(rec.id)}
                          className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                            canCraft
                              ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                              : 'bg-[#22201b] text-stone-500 cursor-not-allowed'
                          }`}
                        >
                          Craft Item
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 5. AI-DRIVEN LIVING WORLD INSPECTOR & DEBUGGER ==================== */}
          {activeTab === 'world_ai' && (
            <div className="space-y-6">
              {/* Top Macro World Simulation Gauges */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono-tabular text-xs">
                <div className="p-3 bg-[#151720] border border-[#27241e] rounded">
                  <div className="text-stone-400">Oakhaven Food Supply</div>
                  <div className="text-base font-semibold text-amber-300 mt-0.5">
                    {Math.round(worldState.settlementFood)}% ·{' '}
                    {worldState.settlementFood < 35 ? 'Famine Risk' : 'Stable'}
                  </div>
                </div>
                <div className="p-3 bg-[#151720] border border-[#27241e] rounded">
                  <div className="text-stone-400">Oakhaven Morale</div>
                  <div className="text-base font-semibold text-emerald-300 mt-0.5">
                    {Math.round(worldState.settlementMorale)}%
                  </div>
                </div>
                <div className="p-3 bg-[#151720] border border-[#27241e] rounded">
                  <div className="text-stone-400">Cinder Covenant Power</div>
                  <div className="text-base font-semibold text-orange-400 mt-0.5">
                    {Math.round(worldState.cinderCovenantPower)}
                  </div>
                </div>
                <div className="p-3 bg-[#151720] border border-[#27241e] rounded">
                  <div className="text-stone-400">Umbral Synod Power</div>
                  <div className="text-base font-semibold text-rose-400 mt-0.5">
                    {Math.round(worldState.umbralSynodPower)}
                  </div>
                </div>
                <div className="p-3 bg-[#151720] border border-[#27241e] rounded">
                  <div className="text-stone-400">Bastion Control</div>
                  <div className="text-sm font-semibold text-sky-300 mt-0.5 capitalize">
                    {worldState.bastionController.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* NPC Selector & Utility AI Mind Inspector */}
                <div className="lg:col-span-7 bg-[#151720] border border-[#27241e] rounded p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold text-stone-100">
                      Autonomous NPC Epistemic & Utility Inspector
                    </h3>
                    <span className="text-xs font-mono-tabular text-stone-400">
                      Tick #{worldState.tickCount}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {npcs.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setSelectedInspectorNpcId(n.id)}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 ${
                          inspectedNpc?.id === n.id
                            ? 'bg-amber-900/40 border-amber-600 text-amber-200'
                            : 'bg-[#101219] border-[#25231c] text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {n.name} {!n.alive && '(Fallen)'}
                      </button>
                    ))}
                  </div>

                  {inspectedNpc && (
                    <div className="space-y-3 pt-2 border-t border-[#25231d] text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono-tabular text-stone-300">
                        <span>
                          Region: <strong className="text-amber-300">{REGIONS[inspectedNpc.regionId]?.name}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Trust: <strong className="text-emerald-300">{inspectedNpc.trust}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Fear: <strong className="text-rose-300">{inspectedNpc.fearOfPlayer}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Respect: <strong className="text-sky-300">{inspectedNpc.respect}</strong>
                        </span>
                      </div>

                      <div className="p-3 bg-[#101218] rounded border border-[#23211b] space-y-1">
                        <div className="text-stone-400">
                          Active Goal:{' '}
                          <span className="text-amber-300 font-semibold">
                            {inspectedNpc.currentGoal.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-stone-400">
                          Current Autonomous Action:{' '}
                          <span className="text-stone-200">{inspectedNpc.currentAction}</span>
                        </div>
                        <div className="text-stone-400">
                          Core Belief: <span className="italic text-stone-300">“{inspectedNpc.belief}”</span>
                        </div>
                        <div className="text-stone-400">
                          Deepest Fear: <span className="text-rose-300/90">{inspectedNpc.fear}</span>
                        </div>
                      </div>

                      {/* Utility AI Candidate Scores */}
                      <div>
                        <div className="text-stone-400 mb-1.5 font-medium">
                          Live Utility AI Goal Evaluation Scores:
                        </div>
                        <div className="space-y-1.5 font-mono-tabular">
                          {Object.entries(inspectedNpc.utilityScores).map(([gKey, score]) => (
                            <div key={gKey} className="flex items-center gap-3">
                              <span className="w-48 truncate text-stone-300">
                                {gKey.replace(/_/g, ' ')}
                              </span>
                              <div className="flex-1 h-2 bg-[#0b0c10] rounded overflow-hidden">
                                <div
                                  className="h-full bg-amber-500"
                                  style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-amber-300">{Math.round(score)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Epistemic Known Facts & Persistent Memories */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-3 bg-[#101218] rounded border border-[#23211b]">
                          <div className="text-stone-400 font-medium mb-1">
                            Epistemic Known Facts ({inspectedNpc.knownFacts.length}):
                          </div>
                          <ul className="space-y-1 text-stone-300 list-disc list-inside">
                            {inspectedNpc.knownFacts.map((f, idx) => (
                              <li key={idx} className="leading-snug">
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3 bg-[#101218] rounded border border-[#23211b]">
                          <div className="text-stone-400 font-medium mb-1">
                            Persistent Episodic Memories ({inspectedNpc.memories.length}):
                          </div>
                          <ul className="space-y-1 text-stone-300 list-disc list-inside">
                            {inspectedNpc.memories.slice(-5).map((m) => (
                              <li key={m.id} className="leading-snug">
                                {m.summary}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Emergent World Event Feed */}
                <div className="lg:col-span-5 bg-[#151720] border border-[#27241e] rounded p-5 space-y-4">
                  <h3 className="font-display text-base font-semibold text-stone-100">
                    Emergent World Events Chronicle
                  </h3>
                  <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
                    {worldState.events.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3 bg-[#101218] border border-[#24211b] rounded space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs font-mono-tabular text-stone-400">
                          <span className="text-amber-300 font-medium">{evt.title}</span>
                          <span>Tick #{evt.timestamp}</span>
                        </div>
                        <p className="text-xs text-stone-300 leading-relaxed">{evt.description}</p>
                        <div className="text-xs text-emerald-400/90 font-mono-tabular">
                          Consequence: {evt.consequence}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== 6. INTERACTIVE EPISTEMIC NPC DIALOGUE & TRADE ==================== */}
          {activeTab === 'dialogue' && activeNpc && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Conversation & AI Reasoning */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-4 bg-[#151720] border border-[#2a261e] rounded space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-amber-300">
                        {activeNpc.name}
                      </h2>
                      <div className="text-xs text-stone-400">
                        {activeNpc.title} · {activeNpc.faction.replace('_', ' ')} · Goal:{' '}
                        {activeNpc.currentGoal.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div className="text-xs font-mono-tabular text-stone-300">
                      <span>Trust {activeNpc.trust}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>Fear {activeNpc.fearOfPlayer}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>Respect {activeNpc.respect}</span>
                    </div>
                  </div>

                  <p className="text-sm text-stone-100 leading-relaxed pt-2 border-t border-[#26231c]">
                    {npcResponseText || `“${activeNpc.dialogueGreeting}”`}
                  </p>

                  {npcInnerThought && (
                    <div className="text-xs text-indigo-300/90 bg-[#101219] p-2.5 rounded border border-indigo-950/60">
                      Epistemic AI Inner Trace: {npcInnerThought}
                    </div>
                  )}
                </div>

                {/* Tactical Dialogue Actions */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-stone-400">
                    Tactical Social Actions (Grounded in NPC Knowledge, Personality & Memories):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={isThinking}
                      onClick={() =>
                        handleTriggerDialogue(
                          'What rumors or dangers do you know of in the surrounding regions?',
                          'converse'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-[#1d1f2b] hover:bg-[#282b3a] text-stone-200 border border-[#323546] rounded whitespace-nowrap shrink-0"
                    >
                      Ask Regional Knowledge
                    </button>
                    <button
                      disabled={isThinking}
                      onClick={() =>
                        handleTriggerDialogue(
                          'Share your deepest counsel with me; our survival depends on cooperation.',
                          'persuade'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 border border-emerald-800/50 rounded whitespace-nowrap shrink-0"
                    >
                      Persuade (Willpower/Trust)
                    </button>
                    <button
                      disabled={isThinking}
                      onClick={() =>
                        handleTriggerDialogue(
                          'I bring urgent intelligence from the Bastion front—tell me your faction plans.',
                          'deceive'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-800/50 rounded whitespace-nowrap shrink-0"
                    >
                      Deceive (Arcana/Dexterity)
                    </button>
                    <button
                      disabled={isThinking}
                      onClick={() =>
                        handleTriggerDialogue(
                          'Tell me everything you are hiding right now, or face my blade!',
                          'threaten'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-rose-950/50 hover:bg-rose-900/60 text-rose-200 border border-rose-800/50 rounded whitespace-nowrap shrink-0"
                    >
                      Threaten (Strength)
                    </button>
                    <button
                      disabled={isThinking}
                      onClick={() =>
                        handleTriggerDialogue(
                          'Join me as my sworn companion in the field.',
                          'recruit'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 border border-amber-700/50 rounded whitespace-nowrap shrink-0"
                    >
                      {activeNpc.isCompanion ? 'Companion Active' : 'Recruit Companion'}
                    </button>
                  </div>
                </div>

                {/* Quest & World Consequence Decisions */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-amber-300">
                    Consequential World & Quest Decisions:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeNpc.id === 'npc_verenice' &&
                      inventory.some((i) => i.id === 'mat_settlement_grain') && (
                        <button
                          onClick={() => {
                            onQuestDecision('donate_grain_verenice');
                            setNpcResponseText(
                              '“Bless the First Ember! These untainted rations will keep Oakhaven’s children alive through the ash-frost.”'
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded whitespace-nowrap shrink-0"
                        >
                          Deliver Untainted Rations (+Oakhaven Food & Cinder Power)
                        </button>
                      )}
                    {activeNpc.id === 'npc_verenice' &&
                      inventory.some((i) => i.id === 'relic_first_choir_chalice') && (
                        <button
                          onClick={() => {
                            onQuestDecision('give_chalice_verenice');
                            setNpcResponseText(
                              '“The Chalice of the Sunken Choir! Its warmth surges into the First Ember—the Cinder Covenant marches to victory!”'
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-orange-700 hover:bg-orange-600 text-white rounded whitespace-nowrap shrink-0"
                        >
                          Bestow Sacred Chalice upon Cinder Covenant
                        </button>
                      )}
                    {activeNpc.id === 'npc_malrik' &&
                      inventory.some((i) => i.id === 'relic_first_choir_chalice') && (
                        <button
                          onClick={() => {
                            onQuestDecision('give_chalice_malrik');
                            setNpcResponseText(
                              '“Magnificent... With the Choir Chalice drowned in shadow, the Umbral Synod claims dominion over Ironmire!”'
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-rose-700 hover:bg-rose-600 text-white rounded whitespace-nowrap shrink-0"
                        >
                          Deliver Sacred Chalice to Umbral Synod
                        </button>
                      )}
                    {activeNpc.id === 'npc_korvak' &&
                      inventory.some((i) => i.id === 'relic_apprentice_medallion') && (
                        <button
                          onClick={() => {
                            onQuestDecision('reveal_tomas_medallion_korvak');
                            setNpcResponseText(
                              '“Tomas’s medallion... Vane sold him to the Synod traps! Stand back—my hammer will settle this debt with Vane in blood!”'
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded whitespace-nowrap shrink-0"
                        >
                          Show Tomas’s Bloodied Medallion (Expose Vane)
                        </button>
                      )}
                    {activeNpc.id === 'npc_vane' &&
                      inventory.some((i) => i.id === 'relic_apprentice_medallion') && (
                        <button
                          onClick={() => {
                            onQuestDecision('blackmail_vane_medallion');
                            setNpcResponseText(
                              '“Keep your voice down! Take this pouch of 450 Sovereign Ash and forget you ever saw that boy’s trinket!”'
                            );
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-sky-800 hover:bg-sky-700 text-white rounded whitespace-nowrap shrink-0"
                        >
                          Extort Vane for Hush-Money (+450 Ash)
                        </button>
                      )}
                  </div>
                </div>

                {/* Natural Free-Form Dialogue Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleTriggerDialogue(customDialogueText, dialogueIntent);
                  }}
                  className="flex items-center gap-2 pt-2"
                >
                  <select
                    value={dialogueIntent}
                    onChange={(e) => setDialogueIntent(e.target.value)}
                    className="px-3 py-2 text-xs bg-[#151720] border border-[#2d2920] rounded text-stone-200"
                  >
                    <option value="converse">Speak / Ask</option>
                    <option value="persuade">Persuade</option>
                    <option value="deceive">Deceive</option>
                    <option value="threaten">Threaten</option>
                  </select>
                  <input
                    type="text"
                    value={customDialogueText}
                    onChange={(e) => setCustomDialogueText(e.target.value)}
                    placeholder={`Speak naturally to ${activeNpc.name}...`}
                    className="flex-1 px-3.5 py-2 text-xs bg-[#151720] border border-[#2d2920] rounded text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="submit"
                    disabled={isThinking || !customDialogueText.trim()}
                    className="px-4 py-2 text-xs font-medium bg-amber-700 hover:bg-amber-600 disabled:bg-[#22201b] text-white rounded transition-colors whitespace-nowrap shrink-0"
                  >
                    {isThinking ? 'Listening...' : 'Speak'}
                  </button>
                </form>
              </div>

              {/* Right Column: NPC Trade & Known Rumors */}
              <div className="lg:col-span-5 bg-[#151720] border border-[#27241e] rounded p-5 space-y-4">
                <h3 className="font-display text-base font-semibold text-stone-100">
                  Barter & Requisition ({ash} Ash Available)
                </h3>
                {activeNpc.trust <= -35 ? (
                  <div className="p-4 bg-rose-950/30 border border-rose-800/50 rounded text-xs text-rose-300">
                    {activeNpc.name} remembers your hostility (Trust {activeNpc.trust}) and refuses to trade with you.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeNpc.shopInventory.map((itemId) => {
                      const item = ITEMS_CATALOG[itemId];
                      if (!item) return null;
                      // Scarcity & Trust affect prices!
                      const priceFactor =
                        worldState.settlementFood < 35 ? 1.25 : activeNpc.trust > 40 ? 0.85 : 1.0;
                      const finalCost = Math.max(15, Math.round(item.value * priceFactor));
                      return (
                        <div
                          key={itemId}
                          className="flex items-center justify-between p-3 bg-[#101218] border border-[#24211b] rounded"
                        >
                          <div className="pr-3">
                            <div className="text-sm font-medium text-stone-100">{item.name}</div>
                            <div className="text-xs text-stone-400">{item.description}</div>
                          </div>
                          <button
                            disabled={ash < finalCost}
                            onClick={() => onBuyFromNpc(activeNpc.id, itemId)}
                            className={`px-3 py-1.5 text-xs font-mono-tabular font-medium rounded whitespace-nowrap shrink-0 ${
                              ash >= finalCost
                                ? 'bg-amber-800/60 hover:bg-amber-700 text-amber-100'
                                : 'bg-[#1f1d18] text-stone-500 cursor-not-allowed'
                            }`}
                          >
                            Buy ({finalCost} Ash)
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 7. QUEST JOURNAL & LORE COMPENDIUM ==================== */}
          {activeTab === 'journal' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Chronicle of Quests & Factions
                </h2>
                <div className="space-y-3">
                  {quests.map((q) => (
                    <div
                      key={q.id}
                      className="p-4 bg-[#151720] border border-[#27241e] rounded space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-base font-semibold text-amber-300">
                          {q.title}
                        </h3>
                        <span className="text-xs font-mono-tabular capitalize text-stone-400">
                          {q.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-300 leading-relaxed">{q.description}</p>
                      <ul className="space-y-1 text-xs">
                        {q.stages.map((st) => (
                          <li
                            key={st.id}
                            className={
                              st.completed ? 'text-emerald-400 line-through' : 'text-stone-300'
                            }
                          >
                            • {st.description}
                          </li>
                        ))}
                      </ul>
                      {q.outcome && (
                        <div className="text-xs text-amber-200 pt-1 border-t border-[#26231c]">
                          Outcome: {q.outcome}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Discovered Inscriptions & Ancient Lore
                </h2>
                <div className="space-y-3">
                  {Object.values(REGIONS)
                    .flatMap((r) => r.props)
                    .filter((p) => p.type === 'lore_monolith')
                    .map((mon) => {
                      const discovered = worldState.discoveredLoreIds.includes(mon.id);
                      return (
                        <div
                          key={mon.id}
                          className="p-4 bg-[#151720] border border-[#27241e] rounded space-y-1.5"
                        >
                          <div className="text-sm font-display font-semibold text-sky-300">
                            {mon.loreTitle}
                          </div>
                          <p className="text-xs text-stone-300 italic leading-relaxed">
                            {discovered
                              ? mon.loreText
                              : 'Inspect this ancient monolith in the world to transcribe its inscription (or read its known archive above).'}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 8. INTERCONNECTED WORLD MAP ==================== */}
          {activeTab === 'map' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold text-stone-100">
                  Cartography of the Ashen Fields
                </h2>
                <p className="text-xs text-stone-400 mt-1">
                  Inspect live NPC positions across all six interconnected regions or fast-travel between kindled Bone-Pyres.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(REGIONS) as RegionId[]).map((rId) => {
                  const reg = REGIONS[rId];
                  const npcsHere = npcs.filter((n) => n.alive && n.regionId === rId);
                  const isHere = currentRegion === rId;
                  return (
                    <div
                      key={rId}
                      className={`p-4 rounded border space-y-3 ${
                        isHere
                          ? 'bg-[#1e1b16] border-amber-600'
                          : 'bg-[#151720] border-[#27241e]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-display text-base font-semibold text-stone-100">
                            {reg.name}
                          </h3>
                          <div className="text-xs text-stone-400">{reg.subtitle}</div>
                        </div>
                        <span className="text-xs font-mono-tabular text-amber-400">
                          Danger {reg.dangerLevel}
                        </span>
                      </div>
                      <p className="text-xs text-stone-300 leading-relaxed">
                        {reg.loreDescription}
                      </p>
                      <div className="text-xs text-stone-400">
                        Inhabitants Present:{' '}
                        <span className="text-stone-200">
                          {npcsHere.length > 0
                            ? npcsHere.map((n) => n.name).join(' · ')
                            : 'None'}
                        </span>
                      </div>
                      <button
                        onClick={() => onFastTravel(rId)}
                        className="w-full px-3 py-1.5 text-xs font-medium bg-[#25211a] hover:bg-amber-800/50 text-amber-200 border border-amber-700/40 rounded transition-colors whitespace-nowrap"
                      >
                        {isHere ? 'Current Region' : `Travel to ${reg.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== 9. SETTINGS, CONTROLS & PERSISTENCE ==================== */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#151720] border border-[#27241e] rounded p-5 space-y-4">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  World Persistence & Save State
                </h2>
                <p className="text-xs text-stone-400">
                  Save or restore your complete character progression, inventory, unlocked shortcuts, NPC memories, and faction state.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onSaveGame}
                    className="px-4 py-2 text-xs font-medium bg-amber-700 hover:bg-amber-600 text-white rounded whitespace-nowrap shrink-0"
                  >
                    Save World State
                  </button>
                  <button
                    onClick={onLoadGame}
                    className="px-4 py-2 text-xs font-medium bg-[#24211b] hover:bg-[#322d25] text-stone-200 border border-[#3d372c] rounded whitespace-nowrap shrink-0"
                  >
                    Load Saved State
                  </button>
                  <button
                    onClick={onResetWorld}
                    className="px-4 py-2 text-xs font-medium bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-800/50 rounded whitespace-nowrap shrink-0"
                  >
                    Reset New Cycle
                  </button>
                </div>

                <div className="pt-4 border-t border-[#26231d] space-y-3">
                  <h3 className="font-display text-sm font-semibold text-stone-200">
                    Audio & Device Input Mode (Auto-Detected: {inputMode.replace('_', ' ')})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={onToggleMute}
                      className="px-3.5 py-1.5 text-xs font-medium bg-[#22201b] hover:bg-[#2e2b24] text-stone-200 rounded whitespace-nowrap shrink-0"
                    >
                      {muted ? 'Unmute Audio Synthesizer' : 'Mute Audio Synthesizer'}
                    </button>
                    {(['keyboard_mouse', 'gamepad', 'touch'] as InputDeviceMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => onSetInputMode(m)}
                        className={`px-3 py-1.5 text-xs font-medium rounded capitalize whitespace-nowrap shrink-0 ${
                          inputMode === m
                            ? 'bg-amber-700 text-white'
                            : 'bg-[#22201b] text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {m.replace('_', ' & ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#151720] border border-[#27241e] rounded p-5 space-y-3 text-xs text-stone-300">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Combat & Multi-Device Controls Reference
                </h2>
                <div className="space-y-2 font-mono-tabular">
                  <div>
                    <strong className="text-amber-300">Keyboard & Mouse:</strong> WASD Move · Left-Click / J Light Attack · Shift+Click / K Heavy Attack / Weapon Art · Space Dodge Roll (i-frames) · F / Right-Hold Block & Parry · Q / Right-Click Cast Spell · R Use Healing Flask · E Interact · I Inventory · Tab AI World Inspector
                  </div>
                  <div>
                    <strong className="text-amber-300">Controller (Gamepad):</strong> Left Stick Move · X / RB Light Attack · Y / RT Heavy Attack · A / B Dodge Roll · LB Block & Parry · LT Cast Attuned Spell · D-Pad Up Heal Flask · Y/A near NPC Interact
                  </div>
                  <div>
                    <strong className="text-amber-300">Touchscreen:</strong> Virtual Left Stick Move · Dedicated On-Screen Action Buttons (Light, Heavy, Dodge, Parry, Spell, Heal, Interact) automatically displayed when touch is active.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
