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

// Waypoint stations per NPC & Goal so NPCs physically walk between real buildings, shrines, gates & resource nodes
const NPC_GOAL_WAYPOINTS: Record<
  string,
   { regionId: WorldEventRecord['regionId']; points: { x: number; y: number; action: string; speech: string }[] }
> = {
  preserve_settlement_supplies: {
    regionId: 'oakhaven',
    points: [
      { x: 840, y: 580, action: 'Tending the First Ember Pyre', speech: 'May the First Ember hold back the ash-frost...' },
      { x: 680, y: 510, action: 'Inspecting Granary & Apothecary stores', speech: 'Our untainted grain runs dangerously thin.' },
      { x: 560, y: 460, action: 'Sorting salvaged herb rations', speech: 'Every bundle of purging moss saves a watchman’s life.' },
    ],
  },
  forage_in_bramblewood: {
    regionId: 'bramblewood',
    points: [
      { x: 620, y: 540, action: 'Harvesting wild untainted grain', speech: 'Untainted roots! Oakhaven will eat tonight.' },
      { x: 810, y: 820, action: 'Gathering luminescent spore-sacs', speech: 'Careful around the Blight Hounds...' },
      { x: 520, y: 690, action: 'Resting by the Hollowed Root Pyre', speech: 'These spores glow with fallen starlight.' },
    ],
  },
  forge_star_iron_weapons: {
    regionId: 'oakhaven',
    points: [
      { x: 650, y: 795, action: 'Hammering star-iron at the anvil', speech: 'Ring true, star-iron! One more temper!' },
      { x: 540, y: 865, action: 'Stoking the smithy smelting furnace', speech: 'The bellows need hotter cinders for this blade.' },
      { x: 380, y: 1010, action: 'Checking the South Crypt gate for Tomas', speech: 'Three nights in that Ossuary... Tomas, lad, where are you?' },
    ],
  },
  search_catacombs_for_apprentice: {
    regionId: 'catacombs',
    points: [
      { x: 860, y: 310, action: 'Searching the Ossuary threshold for Tomas', speech: 'Tomas! Answer me, boy! My hammer is ready!' },
      { x: 520, y: 560, action: 'Inspecting crypt sarcophagi', speech: 'If Synod traps took him, someone will pay in blood.' },
    ],
  },
  maximize_relic_profits: {
    regionId: 'oakhaven',
    points: [
      { x: 1210, y: 895, action: 'Appraising contraband at Crow’s Perch Bazaar', speech: 'Relics, ciphers, alibis—lowest prices in the Vigil!' },
      { x: 1020, y: 660, action: 'Eavesdropping near the Ember Plaza', speech: 'Everyone has a secret worth its weight in Sovereign Ash...' },
      { x: 420, y: 1060, action: 'Checking the Crypt Lift lock', speech: 'Best make sure Korvak never finds that crypt map...' },
    ],
  },
  purge_ironmire_bastion: {
    regionId: 'oakhaven',
    points: [
      { x: 960, y: 280, action: 'Patrolling the North Causeway barricade', speech: 'Hold the North Gate! No Synod assassin passes!' },
      { x: 1460, y: 640, action: 'Guarding the East Bramblewood Gate', speech: 'Blight Hounds prowl the eastern treeline—stay sharp!' },
      { x: 960, y: 580, action: 'Warming gauntlets at the First Ember Pyre', speech: 'Seek me out if you need a sworn blade at your side.' },
    ],
  },
  decode_cathedral_runes: {
    regionId: 'bramblewood',
    points: [
      { x: 580, y: 620, action: 'Sampling luminescent spores near Root Pyre', speech: 'Graviturgy + Pyromancy triggers Singularity Conflagration!' },
      { x: 1360, y: 440, action: 'Measuring leyline resonance at the Moon Altar', speech: 'Fire a Sanguine Lance through a Runic Sigil to split it ×3!' },
      { x: 1420, y: 340, action: 'Cataloguing Choir tablets at the Field-Station', speech: 'The Sunken Choir’s equations are breathtaking...' },
    ],
  },
  recruit_for_cinder_assault: {
    regionId: 'bastion',
    points: [
      { x: 520, y: 980, action: 'Directing Cinder defences at the Siege Trench', speech: 'Stand fast, Templars! Ironmire will not fall to the Synod!' },
      { x: 690, y: 740, action: 'Assaulting the central Bastion barricade', speech: 'For the First Ember! Drive Malrik’s Blood-Knights back!' },
    ],
  },
  sabotage_oakhaven_stores: {
    regionId: 'bastion',
    points: [
      { x: 1440, y: 940, action: 'Coordinating Synod Blood-Knights from East Keep', speech: 'Soon the First Ember will choke on its own ash...' },
      { x: 1120, y: 720, action: 'Skirmishing along the eastern parapet', speech: 'Bring me the Choir Chalice and claim the Eclipse!' },
    ],
  },
};

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
    settlementFood: Math.max(8, Math.min(100, worldState.settlementFood - 0.5)),
    settlementMedicine: Math.max(10, Math.min(100, worldState.settlementMedicine - 0.25)),
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

  // Evaluate each NPC's Utility AI & Autonomous Goals + Waypoint Schedules
  const updatedNpcs = npcs.map((npc, idx) => {
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
      u.preserve_settlement_supplies = nextWorld.settlementFood >= 40 ? 92 : 74;
      u.forage_in_bramblewood = nextWorld.settlementFood < 40 ? 95 : 52;
    }

    // 4. Korvak's Apprentice & Vengeance utility
    if (npc.id === 'npc_korvak') {
      const knowsVaneBetrayal = npc.knownFacts.some(
        (f) => f.toLowerCase().includes('vane betrayed') || f.toLowerCase().includes('vane sold')
      );
      if (knowsVaneBetrayal && npcs.some((n) => n.id === 'npc_vane' && n.alive)) {
        u.hunt_rival = 98;
      } else {
        u.hunt_rival = 10;
        u.forge_star_iron_weapons = 88;
        u.search_catacombs_for_apprentice = nextWorld.tickCount % 8 === 0 ? 91 : 72;
      }
    }

    // 5. Lyra's Runic Research utility
    if (npc.id === 'npc_lyra') {
      u.decode_cathedral_runes = 93;
      u.forage_in_bramblewood = nextWorld.tickCount % 5 === 0 ? 89 : 68;
    }

    // 6. Vane's Profit & Self-Preservation utility
    if (npc.id === 'npc_vane') {
      const korvakHunting = npcs.find((n) => n.id === 'npc_korvak')?.currentGoal === 'hunt_rival';
      u.flee_to_safety = korvakHunting ? 96 : u.flee_to_safety;
      u.maximize_relic_profits = 89;
    }

    // 7. Faction Commanders (Vael & Malrik)
    if (npc.id === 'npc_vael') {
      u.recruit_for_cinder_assault = nextWorld.cinderCovenantPower < 60 ? 91 : 78;
      u.purge_ironmire_bastion = nextWorld.cinderCovenantPower >= 60 ? 95 : 84;
    }
    if (npc.id === 'npc_malrik') {
      u.sabotage_oakhaven_stores = nextWorld.settlementFood > 45 ? 90 : 72;
      u.hunt_rival = nextWorld.umbralSynodPower >= 60 ? 94 : 76;
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
    let nextTargetX = npc.targetX ?? npc.x;
    let nextTargetY = npc.targetY ?? npc.y;
    let nextAction = npc.currentAction;
    let nextSpeech = npc.speechBubble;
    let nextSpeechTimer = npc.speechTimer || 0;

    if (npc.isCompanion) {
      nextAction = 'Fighting alongside the Sovereign Wanderer';
      if (nextWorld.tickCount % 3 === 0) {
        nextSpeech = 'My blade is with you, Wanderer! Lead the charge!';
        nextSpeechTimer = 4.5;
      }
    } else if (bestGoal === 'hunt_rival' && npc.id === 'npc_korvak') {
      const vane = npcs.find((n) => n.id === 'npc_vane' && n.alive);
      if (vane) {
        nextRegion = vane.regionId;
        nextTargetX = vane.x;
        nextTargetY = vane.y;
        nextAction = 'Charging to execute Vane the Crow-Tongue for betraying Tomas!';
        nextSpeech = 'VANE! You sold Tomas to those crypt traps! Face my hammer!';
        nextSpeechTimer = 6.0;
      }
    } else {
      const schedule = NPC_GOAL_WAYPOINTS[bestGoal];
      if (schedule) {
        // If NPC needs to change region for this high-utility goal
        if (npc.regionId !== schedule.regionId && nextWorld.tickCount % 4 === 0) {
          nextRegion = schedule.regionId;
          const pt0 = schedule.points[0];
          nextX = pt0.x;
          nextY = pt0.y;
          nextTargetX = pt0.x;
          nextTargetY = pt0.y;
          nextAction = pt0.action;
          nextSpeech = pt0.speech;
          nextSpeechTimer = 5.0;
          pushEvent(
            `${npc.name} Travels to ${REGIONS[nextRegion].name}`,
            `${npc.name} departed for ${REGIONS[nextRegion].name} to pursue goal "${bestGoal.replace(/_/g, ' ')}".`,
            nextRegion,
            'npc_ambition',
            pt0.action
          );
        } else if (npc.regionId === schedule.regionId) {
          // Cycle through physical waypoints in the region so NPCs actively walk & work!
          const wpIndex = (nextWorld.tickCount + idx) % schedule.points.length;
          const wp = schedule.points[wpIndex];
          nextTargetX = wp.x;
          nextTargetY = wp.y;
          nextAction = wp.action;
          if ((nextWorld.tickCount + idx) % 2 === 0) {
            nextSpeech = wp.speech;
            nextSpeechTimer = 4.8;
          }
        }
      }
      if (bestGoal === 'forage_in_bramblewood') {
        nextWorld.settlementFood = Math.min(100, nextWorld.settlementFood + 3.5);
      }
    }

    return {
      ...npc,
      regionId: nextRegion,
      x: nextX,
      y: nextY,
      targetX: nextTargetX,
      targetY: nextTargetY,
      currentGoal: bestGoal,
      currentAction: nextAction,
      speechBubble: nextSpeech,
      speechTimer: nextSpeechTimer,
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
      if (dist < 340) {
        const rel = a.relationships[b.id]?.affinity ?? 0;
        if (rel > -50 && a.memories.length > 0) {
          const latestMem = a.memories[a.memories.length - 1];
          const factStr = `Heard from ${a.name}: "${latestMem.summary}"`;
          if (!b.knownFacts.includes(factStr)) {
            b.knownFacts = [...b.knownFacts, factStr].slice(-12);
            b.trust = Math.max(-100, Math.min(100, b.trust + Math.sign(latestMem.sentiment) * 3));
            b.speechBubble = `Speaking with ${a.name.split(' ')[0]} about recent tidings...`;
            b.speechTimer = 4.2;
          }
        }
      }
    }
  }

  // Emergent World Event Triggers based on Simulation Thresholds
  if (nextWorld.tickCount % 5 === 0) {
    if (nextWorld.settlementFood < 32) {
      nextWorld.settlementMorale = Math.max(10, nextWorld.settlementMorale - 6);
      pushEvent(
        'Famine Grips Oakhaven Vigil',
        'Food reserves have fallen below critical levels. Inhabitants grow desperate, merchant prices rise, and Blight Hounds prowl closer to the East Gate.',
        'oakhaven',
        'scarcity',
        'Morale -6%, Sister Verenice dispatched to forage'
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
          'Patrols Clash Along the Ash-Roads',
          `Watchmen and faction scouts maneuver across ${regName} as the Seventh Star’s eclipse deepens.`,
          playerRegion as WorldEventRecord['regionId'],
          'ecology',
          'Autonomous NPC schedules updated'
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
