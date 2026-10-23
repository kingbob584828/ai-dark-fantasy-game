import {
  AutonomousNPC,
  CreatureEntity,
  CorpseEntity,
  WorldSimulationState,
  WorldEventRecord,
  NPCGoalType,
  Attributes,
} from '../types/game';
import { REGIONS } from '../data/worldAndEntities';

export interface SimulationTickResult {
  npcs: AutonomousNPC[];
  worldState: WorldSimulationState;
  newEvents: WorldEventRecord[];
}

export function evaluateNPCUtilityAndTickWorld(
  npcs: AutonomousNPC[],
  creatures: CreatureEntity[],
  corpses: CorpseEntity[],
  worldState: WorldSimulationState,
  playerRegion: string
): SimulationTickResult {
  const nextWorld: WorldSimulationState = {
    ...worldState,
    tickCount: worldState.tickCount + 1,
    dayTime: (worldState.dayTime + 0.015) % 1,
    settlementFood: Math.max(8, Math.min(100, worldState.settlementFood - 0.6)),
    settlementMedicine: Math.max(10, Math.min(100, worldState.settlementMedicine - 0.3)),
    events: [...worldState.events],
  };

  const newEvents: WorldEventRecord[] = [];
  const pushEvent = (
    title: string,
    description: string,
    regionId: WorldEventRecord['regionId'],
    category: WorldEventRecord['category'],
    consequence: string
  ) => {
    const evt: WorldEventRecord = {
      id: `evt_${nextWorld.tickCount}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nextWorld.tickCount,
      title,
      description,
      regionId,
      category,
      consequence,
    };
    newEvents.push(evt);
    nextWorld.events = [evt, ...nextWorld.events].slice(0, 40);
  };

  // Evaluate each NPC's Utility AI & Autonomous Goals
  const updatedNpcs = npcs.map((npc) => {
    if (!npc.alive) return npc;

    const u: Record<string, number> = { ...npc.utilityScores };
    const hpRatio = npc.hp / npc.maxHp;

    // 1. Survival / Flee check
    u.flee_to_safety = hpRatio < 0.35 ? 96 : Math.max(10, 45 - npc.personality.courage * 0.4);

    // 2. Companion override
    if (npc.isCompanion) {
      u.accompany_player = 99;
    } else {
      u.accompany_player = npc.trust > 55 && npc.personality.courage > 65 ? 78 : 15;
    }

    // 3. Scarcity & Foraging utility
    if (npc.id === 'npc_verenice') {
      u.preserve_settlement_supplies = nextWorld.settlementFood < 50 ? 92 : 75;
      u.forage_in_bramblewood = nextWorld.settlementFood < 35 ? 95 : 48;
    }

    // 4. Korvak's Apprentice & Vengeance utility
    if (npc.id === 'npc_korvak') {
      const knowsVaneBetrayal = npc.knownFacts.some((f) =>
        f.toLowerCase().includes('vane betrayed') || f.toLowerCase().includes('vane sold')
      );
      if (knowsVaneBetrayal) {
        u.hunt_rival = 97;
      } else {
        u.forge_star_iron_weapons = 80;
        u.search_catacombs_for_apprentice = nextWorld.tickCount % 9 === 0 ? 89 : 72;
      }
    }

    // 5. Lyra's Runic Research utility
    if (npc.id === 'npc_lyra') {
      u.decode_cathedral_runes = nextWorld.tickCount % 6 < 3 ? 93 : 68;
      u.forage_in_bramblewood = nextWorld.tickCount % 6 >= 3 ? 88 : 65;
    }

    // 6. Vane's Profit & Self-Preservation utility
    if (npc.id === 'npc_vane') {
      const korvakHunting = npcs.find((n) => n.id === 'npc_korvak')?.currentGoal === 'hunt_rival';
      u.flee_to_safety = korvakHunting ? 94 : u.flee_to_safety;
      u.maximize_relic_profits = 88;
    }

    // 7. Faction Commanders (Vael & Malrik)
    if (npc.id === 'npc_vael') {
      u.recruit_for_cinder_assault = nextWorld.cinderCovenantPower < 60 ? 91 : 74;
      u.purge_ironmire_bastion = nextWorld.cinderCovenantPower >= 60 ? 95 : 80;
    }
    if (npc.id === 'npc_malrik') {
      u.sabotage_oakhaven_stores = nextWorld.settlementFood > 45 ? 89 : 70;
      u.hunt_rival = nextWorld.umbralSynodPower >= 60 ? 93 : 72;
    }

    // Pick highest utility goal
    let bestGoal: NPCGoalType = npc.currentGoal;
    let bestScore = -1;
    Object.entries(u).forEach(([goalKey, score]) => {
      if (score > bestScore) {
        bestScore = score;
        bestGoal = goalKey as NPCGoalType;
      }
    });

    let nextRegion = npc.regionId;
    let nextX = npc.x;
    let nextY = npc.y;
    let nextAction = npc.currentAction;

    // Autonomous off-screen or cross-region goal execution
    if (npc.isCompanion) {
      nextAction = 'Fighting alongside the Sovereign Wanderer';
    } else if (bestGoal === 'forage_in_bramblewood') {
      if (npc.regionId !== 'bramblewood' && playerRegion !== npc.regionId) {
        nextRegion = 'bramblewood';
        nextX = 560;
        nextY = 720;
        pushEvent(
          `${npc.name} Departs to Forage`,
          `Driven by dwindling supplies (${Math.round(nextWorld.settlementFood)}%), ${npc.name} ventured into the Weeping Bramblewood to gather untainted roots and spores.`,
          'bramblewood',
          'scarcity',
          'Oakhaven Food +8%'
        );
      }
      nextWorld.settlementFood = Math.min(100, nextWorld.settlementFood + 4);
      nextAction = 'Foraging untainted herbs in Bramblewood';
    } else if (bestGoal === 'decode_cathedral_runes') {
      if (npc.regionId !== 'cathedral' && playerRegion !== npc.regionId && nextWorld.tickCount % 5 === 0) {
        nextRegion = 'cathedral';
        nextX = 480;
        nextY = 660;
        pushEvent(
          'Lyra Enters the Sunken Cathedral',
          'Lyra the Blight-Seer traveled to the Cathedral of the Sunken Choir to transcribe the Graviturgy tablets.',
          'cathedral',
          'npc_ambition',
          'Lyra unlocked new Runic insights'
        );
      }
      nextAction = 'Transcribing Runic convergence sigils';
    } else if (bestGoal === 'search_catacombs_for_apprentice') {
      if (npc.regionId !== 'catacombs' && playerRegion !== npc.regionId && nextWorld.tickCount % 7 === 0) {
        nextRegion = 'catacombs';
        nextX = 320;
        nextY = 300;
        pushEvent(
          'Korvak Descends into the Ossuary',
          'Unwilling to wait any longer, Master Blacksmith Korvak took up his hammer and entered the Catacombs to search for Tomas.',
          'catacombs',
          'npc_ambition',
          'Korvak is now in the Ossuary'
        );
      }
      nextAction = 'Searching the Ossuary shadows for Apprentice Tomas';
    } else if (bestGoal === 'hunt_rival' && npc.id === 'npc_korvak') {
      nextAction = 'Hunting Vane the Crow-Tongue for betraying Tomas';
    } else if (bestGoal === 'preserve_settlement_supplies') {
      if (npc.regionId !== 'oakhaven' && playerRegion !== npc.regionId) {
        nextRegion = 'oakhaven';
        nextX = 820;
        nextY = 560;
      }
      nextAction = 'Tending the First Ember & rationing stores';
    }

    return {
      ...npc,
      regionId: nextRegion,
      x: nextX,
      y: nextY,
      currentGoal: bestGoal,
      currentAction: nextAction,
      utilityScores: u,
      lastDecisionTick: nextWorld.tickCount,
    };
  });

  // Inter-NPC Rumor & Memory Propagation when in same region
  for (let i = 0; i < updatedNpcs.length; i++) {
    for (let j = i + 1; j < updatedNpcs.length; j++) {
      const a = updatedNpcs[i];
      const b = updatedNpcs[j];
      if (!a.alive || !b.alive || a.regionId !== b.regionId) continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 380) {
        const rel = a.relationships[b.id]?.affinity ?? 0;
        if (rel > -50 && a.memories.length > 0) {
          const latestMem = a.memories[a.memories.length - 1];
          const factStr = `Heard from ${a.name}: "${latestMem.summary}"`;
          if (!b.knownFacts.includes(factStr)) {
            b.knownFacts = [...b.knownFacts, factStr].slice(-12);
            b.trust = Math.max(-100, Math.min(100, b.trust + Math.sign(latestMem.sentiment) * 3));
          }
        }
      }
    }
  }

  // Emergent World Event Triggers based on Simulation Thresholds
  if (nextWorld.tickCount % 6 === 0) {
    if (nextWorld.settlementFood < 32) {
      nextWorld.settlementMorale = Math.max(10, nextWorld.settlementMorale - 8);
      pushEvent(
        'Famine Grips Oakhaven Vigil',
        'Food reserves have fallen below critical levels. Inhabitants grow desperate, merchant prices rise, and Blight Hounds prowl closer to the East Gate.',
        'oakhaven',
        'scarcity',
        'Morale -8%, Predator aggression increased'
      );
    } else if (nextWorld.cinderCovenantPower - nextWorld.umbralSynodPower > 18) {
      nextWorld.bastionController = 'cinder_covenant';
      pushEvent(
        'Cinder Covenant Advances in Ironmire',
        'Bolstered by supplies and high morale, Commander Vael’s templars seized the central courtyard of Ironmire Bastion.',
        'bastion',
        'faction_war',
        'Cinder Covenant controls Ironmire Bastion'
      );
    } else if (nextWorld.umbralSynodPower - nextWorld.cinderCovenantPower > 18) {
      nextWorld.bastionController = 'umbral_synod';
      pushEvent(
        'Umbral Synod Shadow-Raid Succeeds',
        'Whisperer Malrik’s Blood-Knights overran the Bastion barricades and tainted Oakhaven’s outer well.',
        'bastion',
        'faction_war',
        'Umbral Synod controls Ironmire Bastion'
      );
    } else {
      const unscavengedCorpses = corpses.filter((c) => !c.scavenged);
      if (unscavengedCorpses.length >= 3) {
        pushEvent(
          'Carrion Scavengers Feast on the Unburied',
          `The scent of ${unscavengedCorpses.length} unburied corpses has drawn Marrow-Gorged Ghouls out of the Ossuary vaults.`,
          unscavengedCorpses[0].regionId,
          'ecology',
          'Scavengers mutate upon consuming remains'
        );
      } else {
        const regName = REGIONS[playerRegion as keyof typeof REGIONS]?.name || 'Ashen Fields';
        pushEvent(
          'Shifting Winds of the Seventh Star',
          `Ash-clouds drift across ${regName} as predators stalk the perimeter and factions fortify their watchposts.`,
          playerRegion as WorldEventRecord['regionId'],
          'ecology',
          'Living world simulation active'
        );
      }
    }
  }

  return {
    npcs: updatedNpcs,
    worldState: nextWorld,
    newEvents,
  };
}

// Deterministic Epistemic Dialogue Fallback & Instant Evaluator
export interface DialogueEvaluation {
  dialogue: string;
  innerThought: string;
  trustDelta: number;
  fearDelta: number;
  respectDelta: number;
  newGoal: string;
  newMemorySummary: string;
  tradeAllowed: boolean;
  revealedFact: string;
}

export function evaluateEpistemicDialogueDeterministic(
  npc: AutonomousNPC,
  playerInput: string,
  intent: string,
  playerStats: { level: number; attributes: Attributes },
  hasMedallion: boolean,
  hasChalice: boolean
): DialogueEvaluation {
  const lower = playerInput.toLowerCase();
  let dialogue = '';
  let innerThought = `Evaluating player intent (${intent}) against goal "${npc.currentGoal}" and trust (${npc.trust}).`;
  let trustDelta = 0;
  let fearDelta = 0;
  let respectDelta = 0;
  let newGoal = '';
  let newMemorySummary = `Spoke with the Wanderer (${intent}): "${playerInput.slice(0, 48)}"`;
  let revealedFact = '';

  // Check if NPC refuses trade due to low trust
  if (npc.trust <= -35 && intent !== 'threaten') {
    return {
      dialogue: `"Keep your distance! I have not forgotten what you did. Until you make amends—or put a blade through me—we have nothing to discuss."`,
      innerThought: `My trust in the player is ${npc.trust}. I remember their past hostility and refuse cooperation.`,
      trustDelta: -2,
      fearDelta: 2,
      respectDelta: 0,
      newGoal: '',
      newMemorySummary: 'Refused to cooperate due to remembered betrayal.',
      tradeAllowed: false,
      revealedFact: '',
    };
  }

  // Specific Lore & Epistemic Checks
  if (npc.id === 'npc_korvak' && (lower.includes('tomas') || lower.includes('apprentice') || lower.includes('vane') || hasMedallion)) {
    if (hasMedallion) {
      dialogue = `"By the First Anvil... that’s Tomas’s hammer-medallion! And this scratch on the back—Vane sold him the trapped crypt cipher?! That crow-tongued rat dies by my hammer today!"`;
      innerThought = `The Wanderer brought undeniable proof of Tomas's death and Vane's treachery. My grief turns to righteous fury.`;
      trustDelta = 25;
      respectDelta = 20;
      newGoal = 'hunt_rival';
      newMemorySummary = 'Learned from the Wanderer that Vane betrayed Apprentice Tomas in the Catacombs.';
      revealedFact = 'Korvak has sworn vengeance against Vane the Crow-Tongue and gifted you his masterwork tempering loyalty.';
    } else {
      dialogue = `"Tomas took his pickaxe down into the Ossuary three nights back. Vane was whispering in his ear before he left. If you descend into those tombs, look for a boy in a smith’s apron."`;
      innerThought = `I only know what I saw before the crypt gate shut. I hope the Wanderer finds him alive.`;
      trustDelta = 5;
      respectDelta = 4;
    }
  } else if (intent === 'persuade') {
    const charismaScore = playerStats.attributes.willpower + playerStats.attributes.intelligence + npc.trust * 0.4;
    if (charismaScore >= 24) {
      trustDelta = 12;
      respectDelta = 8;
      revealedFact = npc.knownFacts[Math.floor(Math.random() * npc.knownFacts.length)] || '';
      dialogue = `"Your words carry weight, Wanderer. Perhaps I judged your cause too harshly. Listen closely: ${revealedFact}"`;
      innerThought = `Their Willpower and reasoning align with my core belief ("${npc.belief}"). Sharing limited knowledge.`;
      newMemorySummary = `Persuaded by the Wanderer to share confidential faction intelligence.`;
    } else {
      trustDelta = -3;
      dialogue = `"Pretty words do not fill empty granaries or turn aside a Blight Hound’s jaws. Prove your conviction through deeds, not rhetoric."`;
      innerThought = `Insufficient trust (${npc.trust}) and Willpower to sway my long-term goal.`;
    }
  } else if (intent === 'threaten') {
    const mightScore = playerStats.attributes.strength + playerStats.attributes.arcana - npc.personality.courage * 0.35;
    if (mightScore >= 12) {
      fearDelta = 22;
      trustDelta = -18;
      revealedFact = npc.knownFacts[npc.knownFacts.length - 1] || '';
      dialogue = `"Easy! Lower your weapon! You have made your point. Take what you want to know: ${revealedFact}"`;
      innerThought = `Fear (${npc.fearOfPlayer + 22}) overrides my courage (${npc.personality.courage}). Yielding information to survive, but I will remember this humiliation.`;
      newMemorySummary = `Threatened with violence by the Wanderer; yielded secrets out of fear.`;
    } else {
      trustDelta = -15;
      respectDelta = -10;
      dialogue = `"You dare bare your teeth at me, ${npc.title}? Many graves in the Ossuary are filled with fools who thought me easy prey."`;
      innerThought = `My courage (${npc.personality.courage}) far exceeds their intimidation attempt. My grudge deepens.`;
      newMemorySummary = `Resisted an intimidation attempt by the Wanderer.`;
    }
  } else if (intent === 'deceive') {
    const guileScore = playerStats.attributes.arcana + playerStats.attributes.dexterity - npc.personality.curiosity * 0.25;
    if (guileScore >= 18) {
      trustDelta = 8;
      revealedFact = npc.knownFacts[0] || '';
      dialogue = `"Is that truly what transpired at the Bastion? Then my plans must change immediately. Here—you should know this in return: ${revealedFact}"`;
      innerThought = `I have no direct witness memory contradicting their claim, so I update my epistemic model accordingly.`;
      newMemorySummary = `Deceived by the Wanderer's fabricated account of regional events.`;
    } else {
      trustDelta = -14;
      dialogue = `"Do not take me for a blind thrall. Your story contradicts what I have witnessed with my own eyes. Speak truth or walk away."`;
      innerThought = `Their fabrication conflicts with my known facts and curiosity (${npc.personality.curiosity}).`;
      newMemorySummary = `Caught the Wanderer in a clumsy lie.`;
    }
  } else if (intent === 'recruit') {
    if (npc.id === 'npc_gideon' || npc.trust >= 40) {
      trustDelta = 10;
      respectDelta = 10;
      newGoal = 'accompany_player';
      dialogue = `"My oath is bound to yours, Sovereign Wanderer. Lead on—whether into the Sunken Cathedral or the jaws of the Crucible, my steel follows."`;
      innerThought = `Trust (${npc.trust}) and mutual respect justify pledging my blade as an active combat companion.`;
      newMemorySummary = `Swore an oath to accompany the Wanderer in battle.`;
    } else {
      dialogue = `"March at your side? I barely know whether you serve the Ember or the Eclipse. Earn my trust first (Need 40+ Trust; currently ${npc.trust})."`;
      innerThought = `Current trust (${npc.trust}) is too low to risk my life as their companion.`;
    }
  } else {
    // General epistemic question / converse
    const matchedFact =
      npc.knownFacts.find((f) =>
        lower
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .some((word) => f.toLowerCase().includes(word))
      ) || npc.knownFacts[0];
    dialogue = `"${npc.belief} As for what I know of recent matters: ${matchedFact}"`;
    innerThought = `Responding from my personal belief system and epistemic memory bank (${npc.knownFacts.length} facts).`;
    trustDelta = 3;
    respectDelta = 2;
  }

  return {
    dialogue,
    innerThought,
    trustDelta,
    fearDelta,
    respectDelta,
    newGoal,
    newMemorySummary,
    tradeAllowed: npc.trust + trustDelta > -30,
    revealedFact,
  };
}
