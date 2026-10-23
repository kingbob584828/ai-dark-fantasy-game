extends Node2D

const PixelArt = preload("res://scripts/PixelArtGenerator.gd")
const AudioSynth = preload("res://scripts/AudioSynthesizer.gd")
const SAVE_PATH := "user://ashen_fields_save.json"

var sfx: Node
var global_time: float = 0.0
var ai_tick_timer: float = 0.0
var shake_intensity: float = 0.0

var screen_state: String = "TITLE" # TITLE, PLAYING, DEATH, VICTORY
var active_modal: String = "NONE"  # NONE, PANOPLY, GRIMOIRE, QUESTS, AI_WORLD, DIALOGUE, MAP
var region_id: String = "oakhaven"

var region_keys: Array[String] = ["oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible"]
var region_titles: Dictionary = {
	"oakhaven": "Oakhaven Vigil",
	"bramblewood": "Weeping Bramblewood",
	"cathedral": "Sunken Cathedral of the Astral Choir",
	"catacombs": "Whispering Catacombs",
	"bastion": "Ironmire Bastion",
	"crucible": "The Ashen Crucible"
}
var region_subtitles: Dictionary = {
	"oakhaven": "Sanctuary of the First Ember",
	"bramblewood": "Blight-Choked Hunting Grounds",
	"cathedral": "Flooded Nave of the Fallen Seraphs",
	"catacombs": "Subterranean Ossuary of the Synod",
	"bastion": "Contested Fortress of Cinder & Shadow",
	"crucible": "Throne of Malakor, the Hollowed Seraph"
}
var region_colors: Dictionary = {
	"oakhaven": [Color(0.10, 0.11, 0.14), Color(0.13, 0.14, 0.18)],
	"bramblewood": [Color(0.07, 0.12, 0.10), Color(0.09, 0.15, 0.13)],
	"cathedral": [Color(0.08, 0.09, 0.16), Color(0.11, 0.13, 0.21)],
	"catacombs": [Color(0.10, 0.08, 0.11), Color(0.13, 0.11, 0.15)],
	"bastion": [Color(0.13, 0.09, 0.09), Color(0.18, 0.11, 0.12)],
	"crucible": [Color(0.11, 0.07, 0.14), Color(0.15, 0.10, 0.19)]
}

# Player Progression & 6 Attributes
var level: int = 1
var ash: int = 260
var flasks: int = 4
var star_iron: int = 3
var untainted_grain: int = 1
var has_chalice: bool = false
var has_medallion: bool = false
var ending_unlocked: String = "unbound_sovereign"

var attrs: Dictionary = {
	"Vitality": 12,
	"Endurance": 11,
	"Strength": 13,
	"Dexterity": 12,
	"Willpower": 11,
	"Arcana": 10
}
var attr_keys: Array[String] = ["Vitality", "Endurance", "Strength", "Dexterity", "Willpower", "Arcana"]

var player_hp: float = 292.0
var player_max_hp: float = 292.0
var player_stam: float = 190.0
var player_max_stam: float = 190.0
var player_mana: float = 172.0
var player_max_mana: float = 172.0
var player_pos: Vector2 = Vector2(680.0, 500.0)
var player_facing: float = 0.0
var is_moving: bool = false
var dodge_timer: float = 0.0
var dodge_cd: float = 0.0
var parry_timer: float = 0.0
var slash_timer: float = 0.0
var attack_cd: float = 0.0
var umbral_timer: float = 0.0
var blessing_timer: float = 0.0
var hit_flash_timer: float = 0.0
var cam_pos: Vector2 = Vector2.ZERO

# Living World Macro State
var settlement_food: float = 64.0
var settlement_morale: float = 68.0
var cinder_power: float = 52.0
var umbral_power: float = 48.0
var world_banner: String = "Oakhaven Vigil · Rest at the First Ember Pyre"
var banner_timer: float = 4.5

# Multi-Touch & Pointer State
var touch_move_vec: Vector2 = Vector2.ZERO
var move_touch_index: int = -1
var mouse_dragging_stick: bool = false
var stick_origin: Vector2 = Vector2(118.0, 602.0)

var weapons: Array[Dictionary] = []
var equipped_weapon_idx: int = 0
var armors: Array[Dictionary] = []
var equipped_armor_idx: int = 0
var spells: Array[Dictionary] = []
var active_spell_idx: int = 0
var quests: Array[Dictionary] = []

var npcs: Array[Dictionary] = []
var selected_npc_idx: int = 0
var dialogue_text: String = ""
var dialogue_thought: String = ""

var creatures: Array[Dictionary] = []
var props: Array[Dictionary] = []
var spell_zones: Array[Dictionary] = []
var projectiles: Array[Dictionary] = []
var corpses: Array[Dictionary] = []
var floating_texts: Array[Dictionary] = []
var particles: Array[Dictionary] = []

func _ready() -> void:
	sfx = AudioSynth.new()
	add_child(sfx)
	init_world()
	load_game_if_exists()

func c8(r: int, g: int, b: int, a: int = 255) -> Color:
	return Color(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0, float(a) / 255.0)

func trigger_haptic(duration_ms: int) -> void:
	Input.vibrate_handheld(duration_ms)

func show_toast(msg: String) -> void:
	world_banner = msg
	banner_timer = 4.0

func recalc_max_vitals() -> void:
	player_max_hp = 100.0 + float(int(attrs["Vitality"])) * 16.0 + float(int(armors[equipped_armor_idx]["hp_bonus"]))
	player_max_stam = 80.0 + float(int(attrs["Endurance"])) * 10.0
	player_max_mana = 60.0 + float(int(attrs["Willpower"])) * 10.0
	player_hp = minf(player_hp, player_max_hp)
	player_stam = minf(player_stam, player_max_stam)
	player_mana = minf(player_mana, player_max_mana)

func spawn_burst(pos: Vector2, count: int, col: Color, speed: float = 95.0) -> void:
	for _i in range(count):
		var ang: float = randf() * TAU
		var spd: float = speed * (0.4 + randf() * 0.8)
		particles.append({
			"pos": pos,
			"vel": Vector2.from_angle(ang) * spd,
			"size": 3.0 + randf() * 2.5,
			"color": col,
			"life": 0.45 + randf() * 0.35
		})

func init_world() -> void:
	weapons = [
		{"name": "Vigilant Broadsword", "category": "Sword", "base_dmg": 44, "reach": 84.0, "stam": 14.0, "upgrade": 0},
		{"name": "Penitent Greatsword", "category": "Greatsword", "base_dmg": 72, "reach": 110.0, "stam": 22.0, "upgrade": 0},
		{"name": "Whispering Misericorde", "category": "Dagger", "base_dmg": 35, "reach": 64.0, "stam": 8.0, "upgrade": 0},
		{"name": "Choir-Guard Partisan", "category": "Spear", "base_dmg": 54, "reach": 120.0, "stam": 16.0, "upgrade": 0},
		{"name": "Blight-Cleaver Greataxe", "category": "Greataxe", "base_dmg": 66, "reach": 96.0, "stam": 20.0, "upgrade": 0},
		{"name": "Ashen Hunter Longbow", "category": "Bow", "base_dmg": 42, "reach": 320.0, "stam": 12.0, "upgrade": 0},
		{"name": "Astral Choir Catalyst", "category": "Catalyst", "base_dmg": 34, "reach": 90.0, "stam": 11.0, "upgrade": 0}
	]
	armors = [
		{"name": "Ashen Vigil Brigandine", "def": 18, "hp_bonus": 25, "desc": "Balanced scout armor (-20% dodge cost)"},
		{"name": "Cathedral Choir Plate", "def": 32, "hp_bonus": 60, "desc": "Heavy silver-chased plate of the Choir"},
		{"name": "Umbral Shroud Vestments", "def": 14, "hp_bonus": 20, "desc": "Soundless shadow-woven liturgical robes"},
		{"name": "Cinder-Forged Cuirass", "def": 26, "hp_bonus": 45, "desc": "Warm ember-quenched breastplate"}
	]
	spells = [
		{"id": "grav", "name": "Singularity Well", "school": "Graviturgy", "mana": 20.0, "hp": 0.0, "power": 42, "lv": 1, "color": c8(99, 102, 241), "desc": "Creates a gravity vortex that pulls enemies inward."},
		{"id": "pyro", "name": "Cinder Tempest", "school": "Pyromancy", "mana": 18.0, "hp": 0.0, "power": 48, "lv": 1, "color": c8(249, 115, 22), "desc": "Searing firestorm. Combine with Graviturgy for Singularity Conflagration!"},
		{"id": "runic", "name": "Sigil of Convergence", "school": "Runic Sorcery", "mana": 15.0, "hp": 0.0, "power": 34, "lv": 1, "color": c8(245, 158, 11), "desc": "Runic prism. Projectiles fired through it split into 3 empowered bolts!"},
		{"id": "blood", "name": "Sanguine Lance", "school": "Bloodcraft", "mana": 8.0, "hp": 14.0, "power": 82, "lv": 1, "color": c8(225, 29, 72), "desc": "Sacrifices vitality to hurl a high-velocity blood spear that inflicts Bleed."},
		{"id": "vital", "name": "Verdant Suture", "school": "Vitalism", "mana": 22.0, "hp": 0.0, "power": 72, "lv": 1, "color": c8(16, 185, 129), "desc": "Restores HP to you & your companion; detonates bleeding foes for bonus heal!"},
		{"id": "umbral", "name": "Umbral Phantom Step", "school": "Umbral Arts", "mana": 16.0, "hp": 0.0, "power": 38, "lv": 1, "color": c8(56, 189, 248), "desc": "Phase-dash forward and cloak in shadow; next melee strike deals 2.2x CRIT!"}
	]
	quests = [
		{
			"id": "q_hearth", "title": "The Choked Hearth of Oakhaven", "status": "Active",
			"desc": "Forage Untainted Grain for Oakhaven and recover the Sacred Chalice in the Sunken Cathedral.",
			"outcome": "In Progress"
		},
		{
			"id": "q_tomas", "title": "The Blacksmith's Missing Apprentice", "status": "Active",
			"desc": "Search the Whispering Catacombs for Apprentice Tomas and uncover who sold him the forged map.",
			"outcome": "In Progress"
		},
		{
			"id": "q_seraph", "title": "Canticles of the Hollowed Seraph", "status": "Active",
			"desc": "Breach the Ashen Crucible beyond Ironmire Bastion and slay Malakor, the Hollowed Seraph.",
			"outcome": "In Progress"
		}
	]
	npcs = [
		{
			"id": "verenice", "name": "Sister Verenice", "title": "Keeper of the First Ember",
			"region": "oakhaven", "pos": Vector2(610, 410), "target": Vector2(610, 410),
			"alive": true, "companion": false, "goal": "Preserve Supplies",
			"action": "Tending the First Ember Pyre", "trust": 35,
			"belief": "Only the warmth of the First Ember saves our souls from the Blight.",
			"fact": "The Sacred Chalice of the First Choir lies within the Sunken Cathedral.",
			"cloak": c8(153, 27, 27), "accent": c8(251, 191, 36),
			"speech": "The First Ember flickers, yet Oakhaven endures.", "speech_timer": 4.5, "cd": 0.0, "moving": false
		},
		{
			"id": "korvak", "name": "Master Smith Korvak", "title": "Star-Iron Forger",
			"region": "oakhaven", "pos": Vector2(430, 365), "target": Vector2(430, 365),
			"alive": true, "companion": false, "goal": "Forge Star-Iron",
			"action": "Hammering star-iron at the anvil", "trust": 30,
			"belief": "Prayer never stopped a Blight-Hound's jaw. Star-tempered steel does.",
			"fact": "My apprentice Tomas vanished after buying a crypt map from Vane.",
			"cloak": c8(68, 64, 60), "accent": c8(249, 115, 22),
			"speech": "Bring me Star-Iron and I will temper your blade.", "speech_timer": 4.0, "cd": 0.0, "moving": false
		},
		{
			"id": "gideon", "name": "Sir Gideon", "title": "Penitent Paladin",
			"region": "oakhaven", "pos": Vector2(920, 410), "target": Vector2(1140, 480),
			"alive": true, "companion": false, "goal": "Patrol Gates",
			"action": "Patrolling Oakhaven East Gate", "trust": 40,
			"belief": "A knight's vow does not expire when the kingdom falls to ash.",
			"fact": "Recruit me in dialogue and my greatsword will fight beside you!",
			"cloak": c8(180, 83, 9), "accent": c8(226, 232, 240),
			"speech": "My greatsword stands ready for the Vigil.", "speech_timer": 4.0, "cd": 0.0, "moving": false
		},
		{
			"id": "vane", "name": "Vane the Crow-Tongue", "title": "Relic Broker",
			"region": "oakhaven", "pos": Vector2(980, 620), "target": Vector2(980, 620),
			"alive": true, "companion": false, "goal": "Broker Relics",
			"action": "Appraising catacomb relics at the bazaar", "trust": 5,
			"belief": "Every covenant is a transaction; only the shrewd survive the ash.",
			"fact": "A hidden counterweight gate links Oakhaven to the Whispering Catacombs.",
			"cloak": c8(76, 29, 149), "accent": c8(56, 189, 248),
			"speech": "Relics, maps, secrets—all for a modest price in Ash.", "speech_timer": 3.8, "cd": 0.0, "moving": false
		},
		{
			"id": "lyra", "name": "Herbalist Lyra", "title": "Choir Scholar",
			"region": "bramblewood", "pos": Vector2(450, 480), "target": Vector2(540, 660),
			"alive": true, "companion": false, "goal": "Decode Runes",
			"action": "Sampling luminescent spores", "trust": 28,
			"belief": "Combine Graviturgy and Pyromancy for Singularity Conflagration!",
			"fact": "Cast Sanguine Lance or arrows through a Runic Sigil to split them x3!",
			"cloak": c8(6, 95, 70), "accent": c8(52, 211, 153),
			"speech": "These luminescent spores react to graviturgy!", "speech_timer": 4.0, "cd": 0.0, "moving": false
		},
		{
			"id": "vael", "name": "Commander Vael", "title": "Cinder Marshal",
			"region": "bastion", "pos": Vector2(480, 640), "target": Vector2(680, 520),
			"alive": true, "companion": false, "goal": "Hold Bastion",
			"action": "Directing Siege Trench defenses", "trust": 25,
			"belief": "Ironmire Bastion guards the threshold of the Ashen Crucible.",
			"fact": "Malakor fights in three deadly phases in the Crucible.",
			"cloak": c8(180, 83, 9), "accent": c8(234, 88, 12),
			"speech": "Hold the line against the Synod!", "speech_timer": 4.0, "cd": 0.0, "moving": false
		},
		{
			"id": "malrik", "name": "Whisperer Malrik", "title": "Synod Envoy",
			"region": "bastion", "pos": Vector2(1040, 640), "target": Vector2(960, 520),
			"alive": true, "companion": false, "goal": "Umbral Eclipse",
			"action": "Coordinating Synod Blood-Knights", "trust": 15,
			"belief": "The First Ember is a fading lie; embrace the tranquil Umbral Eclipse.",
			"fact": "Bestow the Sacred Chalice upon me to usher in the Age of Eclipse.",
			"cloak": c8(30, 41, 59), "accent": c8(225, 29, 72),
			"speech": "The Seventh Star belongs to the shadow.", "speech_timer": 4.0, "cd": 0.0, "moving": false
		}
	]

	props.clear()
	for rk in region_keys:
		# Cobblestone Crossroads & Mire/Lava Streams + Bridges
		props.append({"region": rk, "type": "water", "pos": Vector2(1140, 480), "size": Vector2(110, 840), "label": "", "opened": false, "sub": "lava" if rk == "crucible" else "mire"})
		props.append({"region": rk, "type": "road", "pos": Vector2(720, 480), "size": Vector2(1340, 86), "label": "", "opened": false, "sub": ""})
		props.append({"region": rk, "type": "road", "pos": Vector2(680, 460), "size": Vector2(92, 780), "label": "", "opened": false, "sub": ""})
		props.append({"region": rk, "type": "bridge", "pos": Vector2(1140, 480), "size": Vector2(150, 96), "label": "", "opened": false, "sub": ""})

		if rk == "oakhaven":
			props.append({"region": rk, "type": "building", "pos": Vector2(330, 230), "size": Vector2(230, 140), "label": "Korvak's Star-Iron Smithy", "opened": false, "sub": "smithy"})
			props.append({"region": rk, "type": "anvil", "pos": Vector2(455, 345), "size": Vector2(56, 36), "label": "Use Star-Iron Anvil & Forge", "opened": false, "sub": ""})
			props.append({"region": rk, "type": "building", "pos": Vector2(340, 720), "size": Vector2(220, 135), "label": "Sanctuary Granary & Apothecary", "opened": false, "sub": "granary"})
			props.append({"region": rk, "type": "building", "pos": Vector2(890, 230), "size": Vector2(190, 135), "label": "North Garrison Watchtower", "opened": false, "sub": "watchtower"})
			props.append({"region": rk, "type": "building", "pos": Vector2(990, 720), "size": Vector2(200, 135), "label": "Crow's Perch Relic Bazaar", "opened": false, "sub": "bazaar"})
		elif rk == "bramblewood":
			props.append({"region": rk, "type": "building", "pos": Vector2(350, 240), "size": Vector2(210, 135), "label": "Abandoned Ranger Lodge", "opened": false, "sub": "granary"})
			props.append({"region": rk, "type": "building", "pos": Vector2(960, 720), "size": Vector2(200, 135), "label": "Overgrown Druid Sanctum", "opened": false, "sub": "chapel"})
		elif rk == "cathedral":
			props.append({"region": rk, "type": "building", "pos": Vector2(360, 230), "size": Vector2(230, 140), "label": "Astral Choir Scriptorium", "opened": false, "sub": "chapel"})
			props.append({"region": rk, "type": "building", "pos": Vector2(960, 230), "size": Vector2(220, 140), "label": "Sunken Sacristy Reliquary", "opened": false, "sub": "chapel"})
		else:
			props.append({"region": rk, "type": "building", "pos": Vector2(350, 235), "size": Vector2(215, 135), "label": "Fortified Garrison Keep", "opened": false, "sub": "watchtower"})
			props.append({"region": rk, "type": "building", "pos": Vector2(980, 720), "size": Vector2(205, 135), "label": "Ancient Synod Vault", "opened": false, "sub": "bazaar"})

		props.append({"region": rk, "type": "shrine", "pos": Vector2(680, 455), "size": Vector2(64, 64), "label": "Rest at First Ember Pyre", "opened": false, "sub": ""})
		props.append({"region": rk, "type": "chest", "pos": Vector2(940, 350), "size": Vector2(48, 36), "label": "Open Sacred Relic Chest", "opened": false, "sub": rk})
		props.append({"region": rk, "type": "monolith", "pos": Vector2(540, 340), "size": Vector2(40, 64), "label": "Transcribe Ancient Lore Stele", "opened": false, "sub": rk})
		props.append({"region": rk, "type": "harvest", "pos": Vector2(510, 670), "size": Vector2(42, 42), "label": "Harvest Untainted Grain & Star-Iron", "opened": false, "sub": "grain"})
		props.append({"region": rk, "type": "harvest", "pos": Vector2(840, 640), "size": Vector2(42, 42), "label": "Harvest Luminescent Spore Cluster", "opened": false, "sub": "spore"})

		for i in range(8):
			var tx: float = 160.0 + fmod(float(i) * 165.0, 1180.0)
			var ty: float = 135.0 if (i % 2 == 0) else 835.0
			props.append({"region": rk, "type": "tree", "pos": Vector2(tx, ty), "size": Vector2(56, 64), "label": "", "opened": false, "sub": ""})

	reset_creatures()

	corpses = [
		{"region": "bramblewood", "pos": Vector2(620, 690), "name": "Fallen Oakhaven Forager", "ash": 85, "scavenged": false, "item": "grain"},
		{"region": "catacombs", "pos": Vector2(520, 560), "name": "Apprentice Tomas's Remains", "ash": 150, "scavenged": false, "item": "medallion"}
	]

	particles.clear()
	for i in range(44):
		particles.append({
			"pos": Vector2(randf() * 1280.0, randf() * 720.0),
			"vel": Vector2(-14.0 - randf() * 18.0, 10.0 + randf() * 14.0),
			"size": 2.5 + randf() * 2.5,
			"color": c8(245, 158, 11, 180) if (i % 4 == 0) else c8(214, 211, 209, 120),
			"life": 999.0
		})
	recalc_max_vitals()

func reset_creatures() -> void:
	creatures = [
		{"name": "Ash-Stalker Hound", "role": "predator", "region": "oakhaven", "pos": Vector2(1240, 510), "hp": 95.0, "max_hp": 95.0, "dmg": 18, "speed": 132.0, "range": 54.0, "state": "patrol", "timer": 0.0, "ash": 65, "scale": 1.0, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Ashen White-Stag", "role": "prey", "region": "bramblewood", "pos": Vector2(440, 680), "hp": 65.0, "max_hp": 65.0, "dmg": 10, "speed": 125.0, "range": 45.0, "state": "patrol", "timer": 0.0, "ash": 50, "scale": 1.0, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Blight-Maw Hound", "role": "predator", "region": "bramblewood", "pos": Vector2(780, 560), "hp": 115.0, "max_hp": 115.0, "dmg": 24, "speed": 145.0, "range": 58.0, "state": "patrol", "timer": 0.0, "ash": 85, "scale": 1.0, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Marrow-Gorged Ghoul", "role": "scavenger", "region": "bramblewood", "pos": Vector2(890, 710), "hp": 130.0, "max_hp": 130.0, "dmg": 26, "speed": 122.0, "range": 56.0, "state": "patrol", "timer": 0.0, "ash": 95, "scale": 1.05, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Vaelen, Stag-Lord", "role": "miniboss", "region": "bramblewood", "pos": Vector2(1190, 480), "hp": 360.0, "max_hp": 360.0, "dmg": 40, "speed": 138.0, "range": 82.0, "state": "patrol", "timer": 0.0, "ash": 420, "scale": 1.35, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Astral Choir Warden", "role": "guard", "region": "cathedral", "pos": Vector2(780, 500), "hp": 165.0, "max_hp": 165.0, "dmg": 32, "speed": 120.0, "range": 70.0, "state": "patrol", "timer": 0.0, "ash": 125, "scale": 1.1, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Arch-Cantor Oakhart", "role": "miniboss", "region": "cathedral", "pos": Vector2(1150, 480), "hp": 450.0, "max_hp": 450.0, "dmg": 46, "speed": 126.0, "range": 86.0, "state": "patrol", "timer": 0.0, "ash": 550, "scale": 1.4, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Synod Bone-Sentinel", "role": "guard", "region": "catacombs", "pos": Vector2(760, 460), "hp": 155.0, "max_hp": 155.0, "dmg": 34, "speed": 124.0, "range": 66.0, "state": "patrol", "timer": 0.0, "ash": 120, "scale": 1.1, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Crypt Corpse-Eater", "role": "scavenger", "region": "catacombs", "pos": Vector2(960, 620), "hp": 145.0, "max_hp": 145.0, "dmg": 30, "speed": 132.0, "range": 58.0, "state": "patrol", "timer": 0.0, "ash": 115, "scale": 1.1, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Cinder Templar", "role": "guard", "region": "bastion", "pos": Vector2(730, 480), "hp": 195.0, "max_hp": 195.0, "dmg": 36, "speed": 126.0, "range": 68.0, "state": "patrol", "timer": 0.0, "ash": 140, "scale": 1.15, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Synod Blood-Knight", "role": "guard", "region": "bastion", "pos": Vector2(970, 480), "hp": 200.0, "max_hp": 200.0, "dmg": 38, "speed": 130.0, "range": 68.0, "state": "patrol", "timer": 0.0, "ash": 145, "scale": 1.15, "boss": false, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0},
		{"name": "Malakor, Hollowed Seraph", "role": "boss", "region": "crucible", "pos": Vector2(940, 480), "hp": 1150.0, "max_hp": 1150.0, "dmg": 56, "speed": 136.0, "range": 108.0, "state": "patrol", "timer": 0.0, "ash": 2500, "scale": 1.6, "boss": true, "phase": 1, "dead": false, "bleed": 0.0, "flash": 0.0}
	]

func save_game() -> void:
	var data := {
		"level": level,
		"ash": ash,
		"flasks": flasks,
		"star_iron": star_iron,
		"untainted_grain": untainted_grain,
		"has_chalice": has_chalice,
		"has_medallion": has_medallion,
		"region_id": region_id,
		"equipped_weapon_idx": equipped_weapon_idx,
		"equipped_armor_idx": equipped_armor_idx,
		"active_spell_idx": active_spell_idx,
		"attrs": attrs,
		"settlement_food": settlement_food,
		"cinder_power": cinder_power,
		"umbral_power": umbral_power
	}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(data))
		f.close()
		show_toast("Chronicle Saved to Device Storage")

func load_game_if_exists() -> void:
	if not FileAccess.file_exists(SAVE_PATH):
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return
	var txt: String = f.get_as_text()
	f.close()
	var parsed = JSON.parse_string(txt)
	if typeof(parsed) == TYPE_DICTIONARY:
		var d: Dictionary = parsed
		level = int(d.get("level", level))
		ash = int(d.get("ash", ash))
		flasks = int(d.get("flasks", flasks))
		star_iron = int(d.get("star_iron", star_iron))
		untainted_grain = int(d.get("untainted_grain", untainted_grain))
		has_chalice = bool(d.get("has_chalice", has_chalice))
		has_medallion = bool(d.get("has_medallion", has_medallion))
		region_id = str(d.get("region_id", region_id))
		equipped_weapon_idx = clampi(int(d.get("equipped_weapon_idx", 0)), 0, weapons.size() - 1)
		equipped_armor_idx = clampi(int(d.get("equipped_armor_idx", 0)), 0, armors.size() - 1)
		active_spell_idx = clampi(int(d.get("active_spell_idx", 0)), 0, spells.size() - 1)
		if d.has("attrs") and typeof(d["attrs"]) == TYPE_DICTIONARY:
			for k in attr_keys:
				if d["attrs"].has(k):
					attrs[k] = int(d["attrs"][k])
		recalc_max_vitals()
		player_hp = player_max_hp

func get_nearby_prompt() -> String:
	for n in npcs:
		if n["alive"] and n["region"] == region_id and player_pos.distance_to(n["pos"]) < 95.0:
			return "Speak with " + str(n["name"])
	for pr in props:
		if pr["region"] != region_id:
			continue
		var d: float = player_pos.distance_to(pr["pos"])
		var ptype: String = pr["type"]
		if ptype == "shrine" and d < 92.0:
			return "Rest at First Ember Pyre"
		elif ptype == "anvil" and d < 88.0:
			return "Use Star-Iron Anvil & Forge"
		elif ptype == "monolith" and d < 88.0:
			return "Read Ancient Lore Stele"
		elif ptype == "chest" and not pr["opened"] and d < 85.0:
			return "Open Sacred Relic Chest"
		elif ptype == "harvest" and not pr["opened"] and d < 85.0:
			return str(pr["label"])
	for cp in corpses:
		if not cp["scavenged"] and cp["region"] == region_id and player_pos.distance_to(cp["pos"]) < 85.0:
			return "Inspect " + str(cp["name"])
	return ""

func do_attack(heavy: bool) -> void:
	if attack_cd > 0.0 or dodge_timer > 0.0:
		return
	var wpn: Dictionary = weapons[equipped_weapon_idx]
	var cost: float = float(wpn["stam"]) * (1.55 if heavy else 1.0)
	if player_stam < cost:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "Low Stamina", "color": c8(148, 163, 184), "life": 1.0})
		return
	player_stam -= cost
	slash_timer = 0.28 if heavy else 0.20
	attack_cd = 0.44 if heavy else 0.28
	sfx.play_swing(heavy)
	trigger_haptic(85 if heavy else 40)

	var str_bonus: float = float(int(attrs["Strength"])) * 1.8 + float(int(attrs["Dexterity"])) * 1.3
	var raw_dmg: float = (float(wpn["base_dmg"]) + float(wpn["upgrade"]) * 9.0 + str_bonus) * (1.58 if heavy else 1.0)
	if blessing_timer > 0.0:
		raw_dmg *= 1.25
	var ambush := false
	if umbral_timer > 0.0:
		raw_dmg *= 2.2
		umbral_timer = 0.0
		ambush = true
	var dmg: int = int(raw_dmg)

	if wpn["category"] == "Bow":
		projectiles.append({
			"region": region_id, "pos": player_pos + Vector2.from_angle(player_facing) * 18.0,
			"vel": Vector2.from_angle(player_facing) * (500.0 if heavy else 420.0),
			"dmg": dmg, "life": 1.2, "color": c8(251, 191, 36) if heavy else c8(226, 232, 240),
			"split": false, "is_player": true, "bleed": false
		})
		return

	var reach: float = float(wpn["reach"]) * (1.22 if heavy else 1.0)
	var hit_any := false
	for c in creatures:
		if c["region"] != region_id or float(c["hp"]) <= 0.0:
			continue
		if player_pos.distance_to(c["pos"]) <= reach + 26.0 * float(c["scale"]):
			hit_any = true
			c["hp"] = float(c["hp"]) - float(dmg)
			c["flash"] = 0.16
			if wpn["category"] == "Dagger" or wpn["category"] == "Greataxe":
				c["bleed"] = 5.0
			spawn_burst(c["pos"], 10 if heavy else 6, c8(190, 18, 60))
			var label_prefix := "PHANTOM CRIT -" if ambush else ("HEAVY -" if heavy else "-")
			floating_texts.append({
				"pos": (c["pos"] as Vector2) + Vector2(0, -28),
				"text": label_prefix + str(dmg),
				"color": c8(56, 189, 248) if ambush else (c8(251, 191, 36) if heavy else Color.WHITE),
				"life": 1.05
			})
	if hit_any:
		sfx.play_hit(heavy or ambush)
		trigger_haptic(120 if (heavy or ambush) else 55)
		shake_intensity = 7.0 if (heavy or ambush) else 3.5
		process_creature_deaths()

func do_dodge() -> void:
	if dodge_timer > 0.0 or dodge_cd > 0.0:
		return
	var cost: float = 15.0 if equipped_armor_idx == 0 else 19.0
	if player_stam < cost:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "Low Stamina", "color": c8(148, 163, 184), "life": 0.9})
		return
	player_stam -= cost
	dodge_timer = 0.30
	dodge_cd = 0.45
	sfx.play_swing(false)
	trigger_haptic(35)
	spawn_burst(player_pos, 6, c8(148, 163, 184), 60.0)

func do_parry() -> void:
	if parry_timer <= 0.0 and player_stam >= 12.0:
		player_stam -= 10.0
		parry_timer = 0.28
		sfx.play_parry()
		trigger_haptic(40)

func do_use_flask() -> void:
	if flasks > 0 and player_hp < player_max_hp:
		flasks -= 1
		var heal_amt: float = 95.0 + float(int(attrs["Vitality"])) * 2.5
		player_hp = minf(player_max_hp, player_hp + heal_amt)
		spawn_burst(player_pos, 12, c8(52, 211, 153), 75.0)
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "+" + str(int(heal_amt)) + " HP (Flask)", "color": c8(52, 211, 153), "life": 1.1})
		sfx.play_spell(false)
		trigger_haptic(45)
	elif flasks <= 0:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "No Crimson Draughts Left", "color": c8(244, 63, 94), "life": 1.0})

func do_cast_spell() -> void:
	var sp: Dictionary = spells[active_spell_idx]
	var mana_cost: float = float(sp["mana"])
	var hp_cost: float = float(sp["hp"])
	if player_mana < mana_cost:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "Insufficient Focus", "color": c8(56, 189, 248), "life": 1.0})
		return
	if hp_cost > 0.0 and player_hp <= hp_cost + 5.0:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "HP Too Low for Bloodcraft", "color": c8(244, 63, 94), "life": 1.0})
		return
	player_mana -= mana_cost
	player_hp -= hp_cost

	var cat_mult: float = 1.25 if weapons[equipped_weapon_idx]["category"] == "Catalyst" else 1.0
	var arc_bonus: int = int((float(int(attrs["Willpower"])) * 1.6 + float(int(attrs["Arcana"])) * 1.8) * cat_mult)
	var power: int = int(float(int(sp["power"]) + int(sp["lv"]) * 12 + arc_bonus) * cat_mult)
	var target_pos: Vector2 = player_pos + Vector2.from_angle(player_facing) * 140.0
	var sp_id: String = sp["id"]

	if sp_id == "grav" or sp_id == "pyro" or sp_id == "runic":
		var new_zone := {
			"region": region_id, "pos": target_pos, "radius": 96.0,
			"school": sp["school"], "duration": 6.5, "power": power, "synergy": false
		}
		var syn_hit := false
		for ez in spell_zones:
			if ez["region"] != region_id:
				continue
			var combo: bool = (ez["school"] == "Graviturgy" and sp["school"] == "Pyromancy") or (ez["school"] == "Pyromancy" and sp["school"] == "Graviturgy")
			if combo and (ez["pos"] as Vector2).distance_to(target_pos) < 170.0:
				ez["synergy"] = true
				new_zone["synergy"] = true
				syn_hit = true
				shake_intensity = 12.0
				show_toast("SYNERGY: SINGULARITY CONFLAGRATION!")
				trigger_haptic(150)
				spawn_burst(target_pos, 26, c8(249, 115, 22), 180.0)
				for c in creatures:
					if c["region"] == region_id and float(c["hp"]) > 0.0 and (c["pos"] as Vector2).distance_to(target_pos) < 190.0:
						var s_dmg: int = int(float(power) * 2.5)
						c["hp"] = float(c["hp"]) - float(s_dmg)
						c["flash"] = 0.25
						floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -34), "text": "CONFLAGRATION -" + str(s_dmg) + "!", "color": c8(254, 240, 138), "life": 1.3})
		spell_zones.append(new_zone)
		sfx.play_spell(syn_hit)
		process_creature_deaths()
	elif sp_id == "blood":
		projectiles.append({
			"region": region_id, "pos": player_pos + Vector2.from_angle(player_facing) * 18.0,
			"vel": Vector2.from_angle(player_facing) * 450.0,
			"dmg": power, "life": 1.2, "color": sp["color"], "split": false, "is_player": true, "bleed": true
		})
		sfx.play_spell(false)
	elif sp_id == "vital":
		var heal: int = power
		var blood_harvest := false
		for c in creatures:
			if c["region"] == region_id and float(c["hp"]) > 0.0 and player_pos.distance_to(c["pos"]) < 185.0 and float(c["bleed"]) > 0.0:
				blood_harvest = true
				var burst_dmg: int = int(float(power) * 1.8)
				c["hp"] = float(c["hp"]) - float(burst_dmg)
				heal += 45
				spawn_burst(c["pos"], 14, c8(225, 29, 72), 120.0)
				floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -32), "text": "HEMORRHAGIC HARVEST -" + str(burst_dmg) + "!", "color": c8(244, 63, 94), "life": 1.25})
		player_hp = minf(player_max_hp, player_hp + float(heal))
		spawn_burst(player_pos, 14, c8(16, 185, 129), 90.0)
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": ("SYNERGY +" if blood_harvest else "+") + str(heal) + " HP", "color": c8(52, 211, 153), "life": 1.1})
		sfx.play_spell(blood_harvest)
		process_creature_deaths()
	elif sp_id == "umbral":
		dodge_timer = 0.40
		umbral_timer = 4.5
		player_pos += Vector2.from_angle(player_facing) * 110.0
		player_pos.x = clampf(player_pos.x, 60.0, 1380.0)
		player_pos.y = clampf(player_pos.y, 60.0, 860.0)
		spawn_burst(player_pos, 14, c8(56, 189, 248), 100.0)
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "UMBRAL VEIL ACTIVE", "color": c8(56, 189, 248), "life": 1.1})
		sfx.play_spell(false)

func do_interact() -> void:
	for i in range(npcs.size()):
		var n: Dictionary = npcs[i]
		if n["alive"] and n["region"] == region_id and player_pos.distance_to(n["pos"]) < 95.0:
			selected_npc_idx = i
			dialogue_text = "\"" + str(n["belief"]) + " " + str(n["fact"]) + "\""
			dialogue_thought = "Observing Wanderer (Trust " + str(n["trust"]) + " · Goal: " + str(n["goal"]) + ")"
			active_modal = "DIALOGUE"
			return
	for pr in props:
		if pr["region"] != region_id:
			continue
		var d: float = player_pos.distance_to(pr["pos"])
		var ptype: String = pr["type"]
		if ptype == "shrine" and d < 92.0:
			player_hp = player_max_hp
			player_stam = player_max_stam
			player_mana = player_max_mana
			flasks = maxi(flasks, 4)
			reset_creatures()
			save_game()
			show_toast("Rested at First Ember Pyre · Vitals, Flasks & Chronicle Saved")
			sfx.play_parry()
			return
		elif ptype == "anvil" and d < 88.0:
			sfx.play_parry()
			active_modal = "PANOPLY"
			return
		elif ptype == "monolith" and d < 88.0:
			sfx.play_parry()
			show_toast("Ancient Stele: 'Before the Seventh Star fell, the Astral Choir wove Graviturgy and Flame as one.'")
			return
		elif ptype == "chest" and not pr["opened"] and d < 85.0:
			pr["opened"] = true
			ash += 180
			star_iron += 2
			if region_id == "cathedral":
				has_chalice = true
				show_toast("Acquired Sacred Chalice of the First Choir (+180 Ash, +2 Star-Iron)!")
			else:
				show_toast("Opened Sacred Relic Chest (+180 Ash, +2 Star-Iron Shards)")
			sfx.play_parry()
			return
		elif ptype == "harvest" and not pr["opened"] and d < 85.0:
			pr["opened"] = true
			ash += 50
			star_iron += 1
			untainted_grain += 1
			settlement_food = minf(100.0, settlement_food + 8.0)
			spawn_burst(pr["pos"], 12, c8(16, 185, 129), 80.0)
			show_toast("Harvested Resource Node (+50 Ash, +1 Star-Iron, +1 Untainted Grain)")
			sfx.play_parry()
			return
	for cp in corpses:
		if not cp["scavenged"] and cp["region"] == region_id and player_pos.distance_to(cp["pos"]) < 85.0:
			cp["scavenged"] = true
			ash += int(cp["ash"])
			star_iron += 1
			if cp["item"] == "medallion":
				has_medallion = true
				show_toast("Recovered Apprentice Tomas's Bloodied Medallion (Vane's Seal)!")
			else:
				untainted_grain += 1
				show_toast("Looted " + str(cp["name"]) + " (+" + str(cp["ash"]) + " Ash, +1 Grain)")
			sfx.play_parry()
			return
	do_use_flask()

func process_creature_deaths() -> void:
	for c in creatures:
		if float(c["hp"]) <= 0.0 and not c["dead"]:
			c["dead"] = true
			var reward: int = int(c["ash"])
			ash += reward
			spawn_burst(c["pos"], 28 if c["boss"] else 14, c8(190, 18, 60), 140.0)
			corpses.append({
				"region": c["region"], "pos": c["pos"],
				"name": "Remains of " + str(c["name"]),
				"ash": maxi(25, reward / 3), "scavenged": false, "item": "iron"
			})
			floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -32), "text": "+" + str(reward) + " ASH", "color": c8(251, 191, 36), "life": 1.3})
			show_toast("Felled " + str(c["name"]) + " (+" + str(reward) + " Sovereign Ash)")
			if c["boss"]:
				quests[2]["status"] = "Completed"
				quests[2]["outcome"] = "Malakor, the Hollowed Seraph was laid to rest."
				save_game()
				screen_state = "VICTORY"

func toggle_fullscreen() -> void:
	var mode := DisplayServer.window_get_mode()
	DisplayServer.window_set_mode(
		DisplayServer.WINDOW_MODE_WINDOWED if mode == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN
	)

func _process(dt: float) -> void:
	global_time += dt
	if banner_timer > 0.0:
		banner_timer -= dt
	if shake_intensity > 0.1:
		shake_intensity = lerpf(shake_intensity, 0.0, minf(1.0, dt * 10.0))
	else:
		shake_intensity = 0.0

	for i in range(particles.size() - 1, -1, -1):
		var pt: Dictionary = particles[i]
		var p: Vector2 = (pt["pos"] as Vector2) + (pt["vel"] as Vector2) * dt
		var lf: float = float(pt["life"])
		if lf < 100.0:
			lf -= dt
			pt["life"] = lf
			if lf <= 0.0:
				particles.remove_at(i)
				continue
		else:
			if p.x < 0.0:
				p.x += 1280.0
			if p.y > 720.0:
				p.y -= 720.0
		pt["pos"] = p

	if screen_state == "PLAYING" and active_modal == "NONE":
		if dodge_timer > 0.0:
			dodge_timer -= dt
		if dodge_cd > 0.0:
			dodge_cd -= dt
		if parry_timer > 0.0:
			parry_timer -= dt
		if slash_timer > 0.0:
			slash_timer -= dt
		if attack_cd > 0.0:
			attack_cd -= dt
		if umbral_timer > 0.0:
			umbral_timer -= dt
		if blessing_timer > 0.0:
			blessing_timer -= dt
		if hit_flash_timer > 0.0:
			hit_flash_timer -= dt

		player_stam = minf(player_max_stam, player_stam + 32.0 * dt)
		player_mana = minf(player_max_mana, player_mana + (5.0 + float(int(attrs["Willpower"])) * 0.3) * dt)

		var mv: Vector2 = touch_move_vec
		if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
			mv.y -= 1.0
		if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
			mv.y += 1.0
		if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
			mv.x -= 1.0
		if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
			mv.x += 1.0

		is_moving = mv.length() > 0.05
		if is_moving or dodge_timer > 0.0:
			if is_moving:
				mv = mv.normalized()
				if slash_timer <= 0.0:
					player_facing = mv.angle()
			var spd: float = 410.0 if dodge_timer > 0.0 else 210.0
			var move_dir: Vector2 = Vector2.from_angle(player_facing) if dodge_timer > 0.0 else mv
			var next_pos: Vector2 = player_pos + move_dir * spd * dt
			next_pos.x = clampf(next_pos.x, 48.0, 1392.0)
			next_pos.y = clampf(next_pos.y, 56.0, 864.0)
			for pr in props:
				if pr["region"] == region_id and pr["type"] == "building":
					var bpos: Vector2 = pr["pos"]
					var bsz: Vector2 = pr["size"]
					var hw: float = bsz.x * 0.5 + 15.0
					var hh: float = bsz.y * 0.5 + 15.0
					var dx: float = next_pos.x - bpos.x
					var dy: float = next_pos.y - bpos.y
					if absf(dx) < hw and absf(dy) < hh:
						var ox: float = hw - absf(dx)
						var oy: float = hh - absf(dy)
						if ox < oy:
							next_pos.x += ox if dx >= 0.0 else -ox
						else:
							next_pos.y += oy if dy >= 0.0 else -oy
			player_pos = next_pos

		# Portal transitions at East / West gates
		if player_pos.x > 1365.0:
			var idx: int = region_keys.find(region_id)
			region_id = region_keys[(idx + 1) % region_keys.size()]
			player_pos.x = 95.0
			for n in npcs:
				if n["companion"] and n["alive"]:
					n["region"] = region_id
					n["pos"] = player_pos + Vector2(42, 16)
			show_toast("Entered " + str(region_titles[region_id]))
		elif player_pos.x < 70.0 and region_id != "oakhaven":
			var idx: int = region_keys.find(region_id)
			region_id = region_keys[maxi(0, idx - 1)]
			player_pos.x = 1320.0
			for n in npcs:
				if n["companion"] and n["alive"]:
					n["region"] = region_id
					n["pos"] = player_pos + Vector2(-42, 16)
			show_toast("Entered " + str(region_titles[region_id]))

		# Update Spell Zones
		for i in range(spell_zones.size() - 1, -1, -1):
			var z: Dictionary = spell_zones[i]
			var dur: float = float(z["duration"]) - dt
			z["duration"] = dur
			if dur <= 0.0:
				spell_zones.remove_at(i)
			elif z["region"] == region_id:
				for c in creatures:
					if c["region"] == region_id and float(c["hp"]) > 0.0:
						var d: float = (z["pos"] as Vector2).distance_to(c["pos"])
						if d <= float(z["radius"]):
							if z["school"] == "Graviturgy":
								c["pos"] = (c["pos"] as Vector2).move_toward(z["pos"], 95.0 * dt)
							c["hp"] = float(c["hp"]) - float(z["power"]) * 0.65 * dt

		# Update Projectiles & Runic Split-Cast Synergy
		var split_add: Array[Dictionary] = []
		for i in range(projectiles.size() - 1, -1, -1):
			var pr: Dictionary = projectiles[i]
			var ppos: Vector2 = (pr["pos"] as Vector2) + (pr["vel"] as Vector2) * dt
			pr["pos"] = ppos
			var plife: float = float(pr["life"]) - dt
			pr["life"] = plife
			if plife <= 0.0:
				projectiles.remove_at(i)
				continue
			if pr["is_player"] and not pr["split"]:
				for z in spell_zones:
					if z["region"] == region_id and z["school"] == "Runic Sorcery" and ppos.distance_to(z["pos"]) <= float(z["radius"]):
						pr["split"] = true
						pr["dmg"] = int(float(pr["dmg"]) * 1.4)
						var ang: float = (pr["vel"] as Vector2).angle()
						var spd: float = (pr["vel"] as Vector2).length()
						for off in [-0.24, 0.24]:
							split_add.append({
								"region": region_id, "pos": ppos,
								"vel": Vector2.from_angle(ang + off) * spd,
								"dmg": pr["dmg"], "life": plife,
								"color": c8(254, 240, 138), "split": true, "is_player": true, "bleed": pr["bleed"]
							})
						show_toast("SYNERGY: RUNIC CONVERGENCE SPLIT x3!")
						sfx.play_spell(true)
						break
			if pr["is_player"]:
				for c in creatures:
					if c["region"] == region_id and float(c["hp"]) > 0.0 and ppos.distance_to(c["pos"]) <= 28.0 * float(c["scale"]):
						c["hp"] = float(c["hp"]) - float(pr["dmg"])
						c["flash"] = 0.15
						if pr["bleed"]:
							c["bleed"] = 5.0
						spawn_burst(c["pos"], 7, pr["color"], 85.0)
						floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -26), "text": "-" + str(pr["dmg"]), "color": c8(254, 240, 138), "life": 1.0})
						sfx.play_hit(pr["split"])
						projectiles.remove_at(i)
						break
			else:
				if ppos.distance_to(player_pos) <= 22.0 and dodge_timer <= 0.0:
					if parry_timer > 0.0:
						pr["is_player"] = true
						pr["vel"] = -(pr["vel"] as Vector2) * 1.3
						pr["color"] = c8(253, 224, 71)
						sfx.play_parry()
						trigger_haptic(90)
						floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "SPELL PARRIED!", "color": c8(253, 224, 71), "life": 1.1})
					else:
						var dmg_in: int = maxi(8, int(pr["dmg"]) - int(armors[equipped_armor_idx]["def"]) / 2)
						player_hp -= float(dmg_in)
						hit_flash_timer = 0.2
						sfx.play_hit(false)
						trigger_haptic(100)
						floating_texts.append({"pos": player_pos + Vector2(0, -28), "text": "-" + str(dmg_in), "color": c8(244, 63, 94), "life": 1.0})
						projectiles.remove_at(i)
						if player_hp <= 0.0:
							screen_state = "DEATH"
		projectiles.append_array(split_add)

		# Update Creatures (Prey Flee, Scavenger Corpse Mutation, Boss Phases & Telegraph Windup)
		for c in creatures:
			if c["region"] != region_id or float(c["hp"]) <= 0.0:
				continue
			if float(c["flash"]) > 0.0:
				c["flash"] = float(c["flash"]) - dt
			if float(c["bleed"]) > 0.0:
				c["bleed"] = float(c["bleed"]) - dt
				c["hp"] = float(c["hp"]) - 14.0 * dt

			if c["boss"]:
				var ratio: float = float(c["hp"]) / float(c["max_hp"])
				if ratio <= 0.66 and int(c["phase"]) == 1:
					c["phase"] = 2
					c["dmg"] = 68
					c["speed"] = 152.0
					shake_intensity = 14.0
					show_toast("PHASE II: MALAKOR INVOKES THE GRAVITATIONAL SINGULARITY!")
				elif ratio <= 0.33 and int(c["phase"]) == 2:
					c["phase"] = 3
					c["dmg"] = 82
					c["speed"] = 166.0
					shake_intensity = 18.0
					show_toast("PHASE III: SERAPHIC BLOOD-PYRE UNLEASHED!")

			var cpos: Vector2 = c["pos"]
			var d_player: float = player_pos.distance_to(cpos)
			var detect_r: float = 135.0 if umbral_timer > 0.0 else 330.0

			if c["role"] == "prey":
				if d_player < 200.0:
					var dir: Vector2 = (cpos - player_pos).normalized()
					cpos += dir * float(c["speed"]) * dt
					cpos.x = clampf(cpos.x, 55.0, 1380.0)
					cpos.y = clampf(cpos.y, 65.0, 855.0)
					c["pos"] = cpos
			elif c["role"] == "scavenger" and d_player > detect_r:
				for cp in corpses:
					if not cp["scavenged"] and cp["region"] == region_id:
						var cp_pos: Vector2 = cp["pos"]
						if cpos.distance_to(cp_pos) > 24.0:
							c["pos"] = cpos.move_toward(cp_pos, float(c["speed"]) * dt)
						else:
							cp["scavenged"] = true
							c["max_hp"] = float(c["max_hp"]) + 50.0
							c["hp"] = c["max_hp"]
							c["dmg"] = int(c["dmg"]) + 10
							c["scale"] = minf(1.45, float(c["scale"]) + 0.15)
							spawn_burst(cpos, 12, c8(16, 185, 129), 90.0)
							floating_texts.append({"pos": cpos + Vector2(0, -28), "text": "CORPSE DEVOURED · MUTATED!", "color": c8(163, 230, 53), "life": 1.3})
						break
			elif d_player < detect_r:
				if c["state"] == "windup":
					var t_rem: float = float(c["timer"]) - dt
					c["timer"] = t_rem
					if t_rem <= 0.0:
						if c["boss"] and int(c["phase"]) >= 2:
							var bolts: int = 7 if int(c["phase"]) == 3 else 5
							var base_a: float = (player_pos - cpos).angle()
							for b in range(bolts):
								var ba: float = base_a + float(b - bolts / 2) * 0.30
								projectiles.append({
									"region": region_id, "pos": cpos,
									"vel": Vector2.from_angle(ba) * 300.0,
									"dmg": 38, "life": 1.6, "color": c8(225, 29, 72) if int(c["phase"]) == 3 else c8(129, 140, 248),
									"split": true, "is_player": false, "bleed": false
								})
						if d_player <= float(c["range"]) + 24.0:
							if parry_timer > 0.0:
								c["state"] = "recover"
								c["timer"] = 2.2
								shake_intensity = 9.0
								spawn_burst(player_pos, 14, c8(253, 224, 71), 115.0)
								floating_texts.append({"pos": cpos + Vector2(0, -34), "text": "PARRIED! RIPOSTE OPEN", "color": c8(253, 224, 71), "life": 1.2})
								sfx.play_parry()
								trigger_haptic(95)
							elif dodge_timer <= 0.0:
								var mit: int = int(armors[equipped_armor_idx]["def"]) / 2
								var hit_dmg: int = maxi(8, int(c["dmg"]) - mit)
								player_hp -= float(hit_dmg)
								hit_flash_timer = 0.22
								shake_intensity = 6.5
								spawn_burst(player_pos, 10, c8(190, 18, 60), 100.0)
								floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "-" + str(hit_dmg), "color": c8(244, 63, 94), "life": 1.0})
								sfx.play_hit(false)
								trigger_haptic(125)
								if player_hp <= 0.0:
									screen_state = "DEATH"
						c["state"] = "recover"
						c["timer"] = 0.85
				elif c["state"] == "recover":
					var r_rem: float = float(c["timer"]) - dt
					c["timer"] = r_rem
					if r_rem <= 0.0:
						c["state"] = "patrol"
				else:
					if d_player <= float(c["range"]):
						c["state"] = "windup"
						c["timer"] = 0.65
					else:
						c["pos"] = cpos.move_toward(player_pos, float(c["speed"]) * dt)

		# Update Autonomous NPCs (Korvak Vengeance, Hostile Defense Combat, Companion Follow, Waypoints & Speech Bubbles)
		for npc in npcs:
			if not npc["alive"] or npc["region"] != region_id:
				continue
			if float(npc["cd"]) > 0.0:
				npc["cd"] = float(npc["cd"]) - dt
			if float(npc["speech_timer"]) > 0.0:
				npc["speech_timer"] = float(npc["speech_timer"]) - dt

			var npos: Vector2 = npc["pos"]

			# Korvak hunting Vane if Tomas's betrayal was exposed!
			if npc["id"] == "korvak" and npc["goal"] == "Hunt Vane":
				for other in npcs:
					if other["id"] == "vane" and other["alive"] and other["region"] == region_id:
						var vpos: Vector2 = other["pos"]
						if npos.distance_to(vpos) > 42.0:
							npc["pos"] = npos.move_toward(vpos, 138.0 * dt)
							npc["moving"] = true
						elif float(npc["cd"]) <= 0.0:
							npc["cd"] = 1.0
							other["alive"] = false
							npc["goal"] = "Forge Star-Iron"
							npc["action"] = "Avenged Apprentice Tomas"
							npc["speech"] = "Tomas is avenged! That traitor Vane will deceive no one else."
							npc["speech_timer"] = 5.0
							spawn_burst(vpos, 20, c8(249, 115, 22), 130.0)
							show_toast("KORVAK EXECUTED VANE THE CROW-TONGUE FOR BETRAYING TOMAS!")
						break
				continue

			var nearest_c = null
			var best_d: float = 280.0 if npc["companion"] else 235.0
			for c in creatures:
				if c["region"] == region_id and float(c["hp"]) > 0.0 and c["role"] != "prey":
					var dc: float = npos.distance_to(c["pos"])
					if dc < best_d:
						best_d = dc
						nearest_c = c
			if nearest_c != null:
				if best_d > 52.0:
					npc["pos"] = npos.move_toward(nearest_c["pos"], 145.0 * dt)
					npc["moving"] = true
				elif float(npc["cd"]) <= 0.0:
					npc["cd"] = 1.0
					npc["moving"] = false
					var ndmg: float = 42.0 if (npc["id"] == "korvak" or npc["id"] == "gideon" or npc["id"] == "vael") else 34.0
					nearest_c["hp"] = float(nearest_c["hp"]) - ndmg
					nearest_c["flash"] = 0.14
					spawn_burst(nearest_c["pos"], 6, c8(251, 191, 36), 80.0)
					floating_texts.append({"pos": (nearest_c["pos"] as Vector2) + Vector2(0, -24), "text": "-" + str(int(ndmg)), "color": c8(253, 230, 138), "life": 1.0})
					if float(npc["speech_timer"]) <= 0.0:
						npc["speech"] = "Back to the ash, " + str(nearest_c["name"]) + "!"
						npc["speech_timer"] = 3.2
			elif npc["companion"]:
				if npos.distance_to(player_pos) > 74.0:
					npc["pos"] = npos.move_toward(player_pos, 170.0 * dt)
					npc["moving"] = true
				else:
					npc["moving"] = false
			else:
				var tpos: Vector2 = npc["target"]
				if npos.distance_to(tpos) > 14.0:
					npc["pos"] = npos.move_toward(tpos, 74.0 * dt)
					npc["moving"] = true
				else:
					npc["moving"] = false

		process_creature_deaths()

		# Macro AI World Simulation Tick (NPC Waypoints, Forge Sparks & Rumor Speech Bubbles)
		ai_tick_timer += dt
		if ai_tick_timer >= 6.0:
			ai_tick_timer = 0.0
			settlement_food = clampf(settlement_food - 0.8, 15.0, 100.0)
			for npc in npcs:
				if not npc["alive"] or npc["companion"]:
					continue
				if npc["id"] == "korvak":
					npc["target"] = Vector2(445.0, 355.0) if randf() < 0.65 else Vector2(640.0, 460.0)
					spawn_burst(npc["pos"], 6, c8(249, 115, 22), 65.0)
				elif npc["id"] == "verenice":
					npc["target"] = Vector2(610.0, 415.0) if randf() < 0.6 else Vector2(420.0, 650.0)
				elif npc["id"] == "gideon":
					npc["target"] = Vector2(1120.0, 480.0) if randf() < 0.5 else Vector2(880.0, 360.0)
				else:
					npc["target"] = Vector2(360.0 + randf() * 680.0, 320.0 + randf() * 320.0)
				npc["speech"] = npc["belief"] if randf() < 0.5 else npc["fact"]
				npc["speech_timer"] = 4.2

	for i in range(floating_texts.size() - 1, -1, -1):
		var ft: Dictionary = floating_texts[i]
		var fp: Vector2 = ft["pos"]
		fp.y -= 28.0 * dt
		ft["pos"] = fp
		var fl: float = float(ft["life"]) - dt
		ft["life"] = fl
		if fl <= 0.0:
			floating_texts.remove_at(i)

	queue_redraw()

func handle_ui_or_action_tap(mp: Vector2) -> bool:
	var vp: Vector2 = get_viewport_rect().size
	if screen_state == "TITLE":
		screen_state = "PLAYING"
		return true
	elif screen_state == "DEATH" or screen_state == "VICTORY":
		player_hp = player_max_hp
		player_stam = player_max_stam
		player_mana = player_max_mana
		flasks = maxi(flasks, 4)
		player_pos = Vector2(680, 500)
		region_id = "oakhaven"
		reset_creatures()
		screen_state = "PLAYING"
		return true

	# Active Modal Interaction
	if active_modal != "NONE":
		var card_w: float = minf(760.0, vp.x - 32.0)
		var card_h: float = minf(460.0, vp.y - 32.0)
		var card_l: float = (vp.x - card_w) * 0.5
		var card_t: float = (vp.y - card_h) * 0.5
		if mp.x < card_l or mp.x > card_l + card_w or mp.y < card_t or mp.y > card_t + card_h or (mp.x > card_l + card_w - 92.0 and mp.y < card_t + 46.0):
			active_modal = "NONE"
			return true

		if active_modal == "PANOPLY":
			# Left half: Weapons & Tempering | Right half: Attributes & Armor
			if mp.x < card_l + card_w * 0.54:
				var w_row: int = int((mp.y - (card_t + 68.0)) / 42.0)
				if w_row >= 0 and w_row < weapons.size():
					if mp.x > card_l + card_w * 0.54 - 115.0:
						var wpn: Dictionary = weapons[w_row]
						var cost: int = (int(wpn["upgrade"]) + 1) * 90
						if ash >= cost and star_iron >= 1:
							ash -= cost
							star_iron -= 1
							wpn["upgrade"] = int(wpn["upgrade"]) + 1
							sfx.play_parry()
							show_toast("Tempered " + str(wpn["name"]) + " to +" + str(wpn["upgrade"]))
						else:
							show_toast("Need " + str(cost) + " Ash & 1 Star-Iron to Temper")
					else:
						equipped_weapon_idx = w_row
						sfx.play_swing(false)
			else:
				var a_row: int = int((mp.y - (card_t + 68.0)) / 38.0)
				if a_row >= 0 and a_row < attr_keys.size():
					var k: String = attr_keys[a_row]
					var lv_cost: int = 85 + level * 40
					if ash >= lv_cost:
						ash -= lv_cost
						level += 1
						attrs[k] = int(attrs[k]) + 1
						recalc_max_vitals()
						player_hp = player_max_hp
						sfx.play_parry()
						show_toast("Ascended Level " + str(level) + " (+1 " + k + ")")
					else:
						show_toast("Need " + str(lv_cost) + " Sovereign Ash to Ascend")
				elif mp.y > card_t + 310.0:
					equipped_armor_idx = (equipped_armor_idx + 1) % armors.size()
					recalc_max_vitals()
					sfx.play_swing(false)
					show_toast("Equipped " + str(armors[equipped_armor_idx]["name"]))
		elif active_modal == "GRIMOIRE":
			var s_row: int = int((mp.y - (card_t + 68.0)) / 52.0)
			if s_row >= 0 and s_row < spells.size():
				if mp.x > card_l + card_w - 165.0:
					var sp: Dictionary = spells[s_row]
					var u_cost: int = int(sp["lv"]) * 120
					if ash >= u_cost:
						ash -= u_cost
						sp["lv"] = int(sp["lv"]) + 1
						sfx.play_spell(true)
						show_toast("Mastered " + str(sp["name"]) + " Lv." + str(sp["lv"]))
				else:
					active_spell_idx = s_row
					sfx.play_spell(false)
		elif active_modal == "MAP":
			var m_row: int = int((mp.y - (card_t + 68.0)) / 46.0)
			if m_row >= 0 and m_row < region_keys.size():
				region_id = region_keys[m_row]
				player_pos = Vector2(680, 500)
				for n in npcs:
					if n["companion"] and n["alive"]:
						n["region"] = region_id
						n["pos"] = player_pos + Vector2(42, 16)
				active_modal = "NONE"
				sfx.play_spell(false)
				show_toast("Traversed Leyline to " + str(region_titles[region_id]))
			elif mp.y > card_t + card_h - 62.0:
				save_game()
		elif active_modal == "DIALOGUE" and selected_npc_idx >= 0 and selected_npc_idx < npcs.size():
			var npc: Dictionary = npcs[selected_npc_idx]
			var bw: float = (card_w - 56.0) / 3.0
			# Row 1: Persuade / Recruit Companion / Blessing or Forge
			if mp.y >= card_t + card_h - 126.0 and mp.y <= card_t + card_h - 80.0:
				var col: int = clampi(int((mp.x - (card_l + 20.0)) / (bw + 8.0)), 0, 2)
				if col == 0:
					npc["trust"] = mini(100, int(npc["trust"]) + 14)
					dialogue_text = "\"Your resolve honors the Vigil. Listen closely: " + str(npc["fact"]) + "\""
					sfx.play_parry()
				elif col == 1:
					npc["companion"] = not npc["companion"]
					dialogue_text = "\"My blade is yours in the field, Wanderer!\"" if npc["companion"] else "\"I will guard this post until you call.\""
					sfx.play_swing(false)
				else:
					if npc["id"] == "korvak":
						active_modal = "PANOPLY"
						return true
					player_hp = player_max_hp
					player_mana = player_max_mana
					blessing_timer = 45.0
					sfx.play_spell(true)
					dialogue_text = "\"May the First Ember mend your wounds and empower your strikes (+25% DMG)!\""
			# Row 2: Buy Flask (50 Ash) / Buy Star-Iron (90 Ash) / Quest Consequence Action
			elif mp.y > card_t + card_h - 74.0 and mp.y <= card_t + card_h - 24.0:
				var col2: int = clampi(int((mp.x - (card_l + 20.0)) / (bw + 8.0)), 0, 2)
				if col2 == 0:
					if ash >= 50:
						ash -= 50
						flasks += 1
						sfx.play_parry()
						dialogue_text = "\"A fresh Crimson Draught for the road ahead.\""
				elif col2 == 1:
					if ash >= 90:
						ash -= 90
						star_iron += 1
						sfx.play_parry()
						dialogue_text = "\"Meteoritic Star-Iron—use it well at the anvil.\""
				else:
					if npc["id"] == "korvak" and has_medallion:
						has_medallion = false
						ash += 400
						npc["trust"] = 95
						npc["goal"] = "Hunt Vane"
						npc["action"] = "Marching to execute Vane!"
						quests[1]["status"] = "Completed"
						quests[1]["outcome"] = "Exposed Vane's betrayal to Korvak."
						dialogue_text = "\"Tomas's medallion... Vane sold him to the Synod traps! Stand back—my hammer will settle this in blood!\""
						sfx.play_hit(true)
					elif npc["id"] == "vane" and has_medallion:
						has_medallion = false
						ash += 450
						quests[1]["status"] = "Completed"
						quests[1]["outcome"] = "Extorted 450 Ash hush-money from Vane."
						dialogue_text = "\"Keep your voice down! Take this 450 Sovereign Ash and forget you ever saw that trinket!\""
						sfx.play_parry()
					elif npc["id"] == "verenice" and has_chalice:
						has_chalice = false
						ash += 600
						cinder_power = 95.0
						ending_unlocked = "cinder_age"
						quests[0]["status"] = "Completed"
						quests[0]["outcome"] = "Rekindled the First Ember with Sister Verenice."
						dialogue_text = "\"The Sacred Chalice of the First Choir! Warmth surges back into Oakhaven Vigil!\""
						sfx.play_spell(true)
					elif npc["id"] == "malrik" and has_chalice:
						has_chalice = false
						ash += 650
						umbral_power = 95.0
						ending_unlocked = "umbral_eclipse"
						quests[0]["status"] = "Completed"
						quests[0]["outcome"] = "Delivered the Sacred Chalice to Whisperer Malrik."
						dialogue_text = "\"Magnificent... The Umbral Eclipse claims dominion over the realm!\""
						sfx.play_spell(true)
					elif untainted_grain > 0:
						untainted_grain -= 1
						ash += 180
						settlement_food = minf(100.0, settlement_food + 25.0)
						dialogue_text = "\"Bless you! These untainted rations will sustain Oakhaven (+180 Ash)!\""
						sfx.play_parry()
		return true

	# Top-Right HUD Menu Bar (Panoply, Grimoire, Quests, AI World, Map, FullScr)
	if mp.y <= 48.0 and mp.x >= vp.x - 498.0:
		var idx: int = clampi(int((mp.x - (vp.x - 498.0)) / 82.0), 0, 5)
		match idx:
			0: active_modal = "PANOPLY"
			1: active_modal = "GRIMOIRE"
			2: active_modal = "QUESTS"
			3: active_modal = "AI_WORLD"
			4: active_modal = "MAP"
			5: toggle_fullscreen()
		return true

	# Bottom-Center Context Interact Banner
	var prompt: String = get_nearby_prompt()
	if prompt != "" and mp.y > vp.y - 76.0 and absf(mp.x - vp.x * 0.5) < 145.0:
		do_interact()
		return true

	# Bottom-Right Ergonomic 6-Button Combat Cluster
	if mp.x > vp.x - 270.0 and mp.y > vp.y - 185.0:
		var col: int = clampi(int((mp.x - (vp.x - 260.0)) / 82.0), 0, 2)
		var row: int = clampi(int((mp.y - (vp.y - 170.0)) / 78.0), 0, 1)
		var btn_idx: int = row * 3 + col
		match btn_idx:
			0: do_attack(false)
			1: do_attack(true)
			2: do_dodge()
			3: do_cast_spell()
			4: do_parry()
			5: do_interact()
		return true

	return false

func _input(event: InputEvent) -> void:
	var vp: Vector2 = get_viewport_rect().size
	var default_stick := Vector2(118.0, vp.y - 118.0)

	if event is InputEventKey and event.pressed and not event.echo:
		if screen_state == "TITLE":
			screen_state = "PLAYING"
			return
		match event.keycode:
			KEY_ESCAPE:
				active_modal = "NONE"
			KEY_I:
				active_modal = "NONE" if active_modal == "PANOPLY" else "PANOPLY"
			KEY_G:
				active_modal = "NONE" if active_modal == "GRIMOIRE" else "GRIMOIRE"
			KEY_J:
				do_attack(false)
			KEY_K:
				do_attack(true)
			KEY_SPACE:
				do_dodge()
			KEY_F:
				do_parry()
			KEY_Q:
				do_cast_spell()
			KEY_R:
				do_use_flask()
			KEY_E:
				do_interact()
			KEY_TAB:
				active_modal = "NONE" if active_modal == "AI_WORLD" else "AI_WORLD"
			KEY_M:
				active_modal = "NONE" if active_modal == "MAP" else "MAP"
			KEY_F11:
				toggle_fullscreen()

	# Multi-Touch Screen Input for Android (Floating/Fixed Left Quadrant Thumbstick + Right Action Cluster)
	if event is InputEventScreenTouch:
		if event.pressed:
			if screen_state == "PLAYING" and active_modal == "NONE" and event.position.x < 285.0 and event.position.y > vp.y - 265.0:
				move_touch_index = event.index
				stick_origin = default_stick
				var dv: Vector2 = event.position - stick_origin
				touch_move_vec = dv.normalized() if dv.length() > 8.0 else Vector2.ZERO
			else:
				handle_ui_or_action_tap(event.position)
		else:
			if event.index == move_touch_index:
				move_touch_index = -1
				touch_move_vec = Vector2.ZERO
	elif event is InputEventScreenDrag:
		if event.index == move_touch_index:
			var dv: Vector2 = event.position - stick_origin
			touch_move_vec = dv.normalized() if dv.length() > 8.0 else Vector2.ZERO

	# Mouse Fallback
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if screen_state == "PLAYING" and active_modal == "NONE" and event.position.x < 285.0 and event.position.y > vp.y - 265.0:
				mouse_dragging_stick = true
				stick_origin = default_stick
				var dv: Vector2 = event.position - stick_origin
				touch_move_vec = dv.normalized() if dv.length() > 8.0 else Vector2.ZERO
			else:
				handle_ui_or_action_tap(event.position)
		else:
			mouse_dragging_stick = false
			touch_move_vec = Vector2.ZERO
	elif event is InputEventMouseMotion and mouse_dragging_stick:
		var dv: Vector2 = event.position - stick_origin
		touch_move_vec = dv.normalized() if dv.length() > 8.0 else Vector2.ZERO

func _draw() -> void:
	var vp: Vector2 = get_viewport_rect().size
	var font: Font = ThemeDB.fallback_font
	var shake_off := Vector2(randf_range(-shake_intensity, shake_intensity), randf_range(-shake_intensity, shake_intensity))
	cam_pos.x = clampf(player_pos.x - vp.x * 0.5, 0.0, maxf(0.0, 1440.0 - vp.x)) + shake_off.x
	cam_pos.y = clampf(player_pos.y - vp.y * 0.5, 0.0, maxf(0.0, 920.0 - vp.y)) + shake_off.y

	var cols: Array = region_colors[region_id]
	draw_rect(Rect2(Vector2.ZERO, vp), cols[0], true)

	# 1. Floor Flagstones with Cracks & Regional Moss
	var start_c: int = maxi(0, int(cam_pos.x / 64.0))
	var end_c: int = mini(22, int((cam_pos.x + vp.x) / 64.0) + 1)
	var start_r: int = maxi(0, int(cam_pos.y / 64.0))
	var end_r: int = mini(14, int((cam_pos.y + vp.y) / 64.0) + 1)
	for r in range(start_r, end_r + 1):
		for c in range(start_c, end_c + 1):
			var tx: float = c * 64.0 - cam_pos.x
			var ty: float = r * 64.0 - cam_pos.y
			if (r + c) % 2 == 0:
				draw_rect(Rect2(Vector2(tx + 2.0, ty + 2.0), Vector2(60, 60)), cols[1], true)
			if ((c * 37) ^ (r * 19)) % 7 == 0:
				draw_rect(Rect2(Vector2(tx + 16.0, ty + 22.0), Vector2(14, 4)), Color(0, 0, 0, 0.25), true)

	# 2. Ground Infrastructure: Mire/Lava Streams, Cobblestone Crossroads, Timber Bridges
	for pr in props:
		if pr["region"] != region_id:
			continue
		var ptype: String = pr["type"]
		if ptype != "water" and ptype != "road" and ptype != "bridge":
			continue
		var p_pos: Vector2 = (pr["pos"] as Vector2) - cam_pos
		var sz: Vector2 = pr["size"]
		var tl: Vector2 = p_pos - sz * 0.5
		if ptype == "water":
			var is_lava: bool = pr["sub"] == "lava"
			draw_rect(Rect2(tl, sz), c8(127, 29, 29) if is_lava else c8(6, 78, 59), true)
			draw_rect(Rect2(tl + Vector2(6, 6), sz - Vector2(12, 12)), c8(220, 38, 38) if is_lava else c8(4, 120, 87), true)
		elif ptype == "road":
			draw_rect(Rect2(tl, sz), c8(41, 37, 36), true)
			draw_rect(Rect2(tl, sz), c8(68, 64, 60), false, 2.0)
		elif ptype == "bridge":
			draw_rect(Rect2(tl + Vector2(4, 6), sz), Color(0, 0, 0, 0.5), true)
			draw_rect(Rect2(tl, sz), c8(120, 53, 15), true)
			draw_rect(Rect2(tl, Vector2(sz.x, 6)), c8(87, 83, 78), true)
			draw_rect(Rect2(tl + Vector2(0, sz.y - 6), Vector2(sz.x, 6)), c8(87, 83, 78), true)

	# 3. East & West Leyline Portals
	var pulse: float = sin(global_time * 3.5) * 4.0
	draw_circle(Vector2(1375.0 - cam_pos.x, 480.0 - cam_pos.y), 34.0 + pulse, Color(0.22, 0.74, 0.97, 0.22))
	draw_arc(Vector2(1375.0 - cam_pos.x, 480.0 - cam_pos.y), 34.0 + pulse, 0.0, TAU, 28, c8(56, 189, 248), 2.5)
	if region_id != "oakhaven":
		draw_circle(Vector2(65.0 - cam_pos.x, 480.0 - cam_pos.y), 34.0 + pulse, Color(0.22, 0.74, 0.97, 0.22))
		draw_arc(Vector2(65.0 - cam_pos.x, 480.0 - cam_pos.y), 34.0 + pulse, 0.0, TAU, 28, c8(56, 189, 248), 2.5)

	# 4. Gothic Buildings, Shrines, Forges, Monoliths, Chests, Harvest Nodes & Trees
	for pr in props:
		if pr["region"] != region_id:
			continue
		var ptype: String = pr["type"]
		if ptype == "water" or ptype == "road" or ptype == "bridge":
			continue
		var p_pos: Vector2 = (pr["pos"] as Vector2) - cam_pos
		var sz: Vector2 = pr["size"]
		var tl: Vector2 = p_pos - sz * 0.5
		if ptype == "building":
			draw_rect(Rect2(tl + Vector2(10, 12), sz), Color(0, 0, 0, 0.6), true)
			draw_rect(Rect2(tl, sz), c8(28, 25, 23), true)
			draw_rect(Rect2(tl + Vector2(4, 4), sz - Vector2(8, 8)), c8(41, 37, 36), true)
			var roof_col := c8(127, 29, 29) if pr["sub"] == "smithy" else (c8(49, 46, 129) if pr["sub"] == "chapel" else (c8(76, 29, 149) if pr["sub"] == "bazaar" else c8(120, 53, 15)))
			var roof_h: float = sz.y * 0.56
			draw_rect(Rect2(tl - Vector2(4, 6), Vector2(sz.x + 8.0, roof_h)), roof_col, true)
			draw_rect(Rect2(Vector2(p_pos.x - 14.0, tl.y + sz.y - 32.0), Vector2(28, 32)), c8(9, 9, 11), true)
			draw_rect(Rect2(tl + Vector2(22, roof_h + 6.0), Vector2(18, 18)), c8(251, 191, 36), true)
			draw_rect(Rect2(tl + Vector2(sz.x - 40.0, roof_h + 6.0), Vector2(18, 18)), c8(251, 191, 36), true)
			if font != null and pr["label"] != "":
				draw_rect(Rect2(Vector2(p_pos.x - 95.0, tl.y - 24.0), Vector2(190, 16)), Color(0.04, 0.04, 0.06, 0.85), true)
				draw_string(font, Vector2(p_pos.x - 90.0, tl.y - 12.0), str(pr["label"]), HORIZONTAL_ALIGNMENT_CENTER, 180.0, 11, c8(253, 230, 138))
		elif ptype == "anvil":
			draw_rect(Rect2(tl, sz), c8(28, 25, 23), true)
			draw_rect(Rect2(tl + Vector2(6, 6), Vector2(18, sz.y - 12.0)), c8(234, 88, 12), true)
			draw_rect(Rect2(p_pos + Vector2(2, -6), Vector2(20, 12)), c8(148, 163, 184), true)
		elif ptype == "shrine":
			draw_circle(p_pos, 54.0 + sin(global_time * 8.0) * 4.0, Color(0.96, 0.62, 0.04, 0.22))
			draw_rect(Rect2(p_pos - Vector2(22, 12), Vector2(44, 28)), c8(68, 64, 60), true)
			draw_circle(p_pos + Vector2(0, -6), 14.0, c8(245, 158, 11))
			draw_circle(p_pos + Vector2(0, -6), 7.0, c8(254, 240, 138))
		elif ptype == "monolith":
			draw_rect(Rect2(tl + Vector2(6, 0), Vector2(sz.x - 12.0, sz.y)), c8(39, 39, 42), true)
			draw_rect(Rect2(p_pos - Vector2(6, 12), Vector2(12, 4)), c8(56, 189, 248), true)
			draw_rect(Rect2(p_pos - Vector2(8, 2), Vector2(16, 4)), c8(56, 189, 248), true)
		elif ptype == "harvest" and not pr["opened"]:
			draw_circle(p_pos, 14.0 + sin(global_time * 5.0) * 2.5, c8(16, 185, 129) if pr["sub"] == "spore" else c8(245, 158, 11))
			draw_circle(p_pos, 6.0, c8(254, 240, 138))
		elif ptype == "chest":
			draw_rect(Rect2(p_pos - Vector2(20, 14), Vector2(40, 28)), c8(68, 64, 60) if pr["opened"] else c8(146, 64, 14), true)
			draw_rect(Rect2(p_pos - Vector2(20, 2), Vector2(40, 4)), c8(120, 113, 108) if pr["opened"] else c8(251, 191, 36), true)
		elif ptype == "tree":
			draw_rect(Rect2(p_pos - Vector2(10, 6), Vector2(20, 34)), c8(28, 25, 23), true)
			draw_circle(p_pos + Vector2(0, -16), 24.0, c8(28, 37, 32))

	# 5. Corpses
	for cp in corpses:
		if cp["region"] != region_id or cp["scavenged"]:
			continue
		var cpos: Vector2 = (cp["pos"] as Vector2) - cam_pos
		draw_circle(cpos, 14.0, Color(0.55, 0.08, 0.12, 0.65))
		draw_circle(cpos + Vector2(0, -6.0 + sin(global_time * 5.0) * 2.0), 4.5, c8(56, 189, 248) if cp["item"] == "medallion" else c8(251, 191, 36))

	# 6. Spell Zones & Projectiles
	for z in spell_zones:
		if z["region"] == region_id:
			var zcol := c8(254, 240, 138, 145) if z["synergy"] else (c8(249, 115, 22, 130) if z["school"] == "Pyromancy" else c8(99, 102, 241, 130))
			draw_circle((z["pos"] as Vector2) - cam_pos, float(z["radius"]), zcol)
			draw_arc((z["pos"] as Vector2) - cam_pos, float(z["radius"]), 0.0, TAU, 32, Color.WHITE, 2.0)
	for pr in projectiles:
		if pr["region"] == region_id:
			draw_circle((pr["pos"] as Vector2) - cam_pos, 6.5, pr["color"])

	# 7. Autonomous Creatures & Bosses
	for c in creatures:
		if c["region"] != region_id or float(c["hp"]) <= 0.0:
			continue
		var cpos: Vector2 = (c["pos"] as Vector2) - cam_pos
		if c["state"] == "windup":
			draw_circle(cpos, float(c["range"]), Color(0.94, 0.27, 0.27, 0.24))
			draw_arc(cpos, float(c["range"]), 0.0, TAU, 28, c8(239, 68, 68), 2.0)
		var ctex: ImageTexture = PixelArt.get_creature_texture(c["role"], c["boss"], int(c["phase"]), float(c["flash"]) > 0.0)
		draw_texture(ctex, cpos - ctex.get_size() * 0.5 + Vector2(0, sin(global_time * 6.0 + cpos.x) * 2.0))
		var bw: float = 84.0 if c["boss"] else 46.0
		var ratio: float = clampf(float(c["hp"]) / float(c["max_hp"]), 0.0, 1.0)
		draw_rect(Rect2(cpos + Vector2(-bw * 0.5, -36), Vector2(bw, 5)), c8(9, 10, 15), true)
		draw_rect(Rect2(cpos + Vector2(-bw * 0.5, -36), Vector2(bw * ratio, 5)), c8(56, 189, 248) if c["role"] == "prey" else c8(239, 68, 68), true)
		if font != null:
			draw_string(font, cpos + Vector2(-65, -40), str(c["name"]), HORIZONTAL_ALIGNMENT_CENTER, 130.0, 11, c8(229, 224, 216))

	# 8. Autonomous NPCs + Overhead Speech Bubbles
	for n in npcs:
		if not n["alive"] or n["region"] != region_id:
			continue
		var npos: Vector2 = (n["pos"] as Vector2) - cam_pos
		var nframe: int = 1 if (n["moving"] and int(global_time * 7.0) % 2 == 1) else 0
		var ntex: ImageTexture = PixelArt.get_npc_texture(n["id"], n["cloak"], n["accent"], nframe)
		draw_texture(ntex, npos - ntex.get_size() * 0.5)
		if font != null:
			var ncol := c8(52, 211, 153) if n["companion"] else c8(253, 230, 138)
			draw_string(font, npos + Vector2(-75, -32), str(n["name"]), HORIZONTAL_ALIGNMENT_CENTER, 150.0, 12, ncol)
			draw_string(font, npos + Vector2(-85, -21), str(n["action"]), HORIZONTAL_ALIGNMENT_CENTER, 170.0, 10, c8(168, 162, 158))
			if float(n["speech_timer"]) > 0.0 and str(n["speech"]) != "":
				draw_rect(Rect2(npos + Vector2(-115, -58), Vector2(230, 20)), Color(0.04, 0.05, 0.08, 0.92), true)
				draw_rect(Rect2(npos + Vector2(-115, -58), Vector2(230, 20)), ncol, false, 1.2)
				draw_string(font, npos + Vector2(-110, -44), str(n["speech"]).substr(0, 38), HORIZONTAL_ALIGNMENT_CENTER, 220.0, 10, Color.WHITE)

	# 9. Player Character & Weapon Slash
	var p_screen: Vector2 = player_pos - cam_pos
	var h_frame: int = 1 if (is_moving and int(global_time * 8.0) % 2 == 1) else 0
	var htex: ImageTexture = PixelArt.get_hero_texture(h_frame, hit_flash_timer > 0.0)
	if dodge_timer > 0.0:
		draw_circle(p_screen - Vector2.from_angle(player_facing) * 16.0, 14.0, Color(0.22, 0.74, 0.97, 0.35))
	draw_texture(htex, p_screen - htex.get_size() * 0.5)
	if slash_timer > 0.0:
		draw_arc(p_screen, 58.0, player_facing - 0.95, player_facing + 0.95, 20, c8(251, 191, 36), 5.5)
	if parry_timer > 0.0:
		draw_arc(p_screen, 28.0, 0.0, TAU, 24, c8(253, 224, 71), 3.0)

	# 10. Floating Combat Numbers & Particles
	if font != null:
		for ft in floating_texts:
			draw_string(font, (ft["pos"] as Vector2) - cam_pos, str(ft["text"]), HORIZONTAL_ALIGNMENT_CENTER, 120.0, 13, ft["color"])
	for pt in particles:
		var p_draw: Vector2 = (pt["pos"] as Vector2) - cam_pos if float(pt["life"]) < 100.0 else (pt["pos"] as Vector2)
		draw_rect(Rect2(p_draw, Vector2(pt["size"], pt["size"])), pt["color"], true)

	# ==================== TITLE / DEATH / VICTORY SCREENS ====================
	if screen_state != "PLAYING":
		draw_rect(Rect2(Vector2.ZERO, vp), Color(0.03, 0.04, 0.06, 0.88), true)
		var cw: float = minf(600.0, vp.x - 40.0)
		var ch: float = 340.0
		var cl: float = (vp.x - cw) * 0.5
		var ct: float = (vp.y - ch) * 0.5
		draw_rect(Rect2(Vector2(cl, ct), Vector2(cw, ch)), c8(16, 18, 26), true)
		draw_rect(Rect2(Vector2(cl, ct), Vector2(cw, ch)), c8(180, 83, 9), false, 2.5)
		draw_texture(PixelArt.get_hero_texture(0, false), Vector2(vp.x * 0.5 - 100.0, ct + 28.0))
		draw_texture(PixelArt.get_creature_texture("boss", true, 1, false), Vector2(vp.x * 0.5 + 24.0, ct + 18.0))
		if font != null:
			var main_title := "ASHEN FIELDS" if screen_state == "TITLE" else ("CLAIMED BY THE ASH" if screen_state == "DEATH" else "THE SEVENTH STAR STILLED")
			var sub_line := "CANTICLES OF THE SEVENTH STAR · GODOT 4.3 ENGINE" if screen_state == "TITLE" else ("Your flesh fails, yet the First Ember remembers your vow." if screen_state == "DEATH" else "Malakor is felled. The " + ending_unlocked.replace("_", " ").to_upper() + " begins!")
			draw_string(font, Vector2(cl, ct + 140.0), main_title, HORIZONTAL_ALIGNMENT_CENTER, cw, 32, c8(245, 158, 11) if screen_state != "DEATH" else c8(244, 63, 94))
			draw_string(font, Vector2(cl + 20.0, ct + 172.0), sub_line, HORIZONTAL_ALIGNMENT_CENTER, cw - 40.0, 13, c8(214, 211, 209))
			draw_string(font, Vector2(cl + 20.0, ct + 202.0), "6 Populated Regions · 7 Autonomous AI NPCs · 6 Magic Schools & Synergies", HORIZONTAL_ALIGNMENT_CENTER, cw - 40.0, 12, c8(168, 162, 158))
			draw_rect(Rect2(Vector2(cl + 70.0, ct + 240.0), Vector2(cw - 140.0, 50.0)), c8(180, 83, 9), true)
			draw_string(font, Vector2(cl + 70.0, ct + 271.0), "TAP ANYWHERE TO AWAKEN AT THE FIRST EMBER", HORIZONTAL_ALIGNMENT_CENTER, cw - 140.0, 14, Color.WHITE)
		return

	# ==================== PLAYING HUD & TACTICAL MINI-MAP ====================
	# Top-Left Vitals & Active Equipment Card
	draw_rect(Rect2(Vector2(12, 10), Vector2(276, 86)), Color(0.05, 0.06, 0.09, 0.92), true)
	draw_rect(Rect2(Vector2(12, 10), Vector2(276, 86)), c8(68, 64, 60), false, 1.5)
	draw_rect(Rect2(Vector2(22, 18), Vector2(180.0, 10)), c8(28, 25, 23), true)
	draw_rect(Rect2(Vector2(22, 18), Vector2(180.0 * clampf(player_hp / player_max_hp, 0.0, 1.0), 10)), c8(225, 29, 72), true)
	draw_rect(Rect2(Vector2(22, 33), Vector2(180.0, 8)), c8(28, 25, 23), true)
	draw_rect(Rect2(Vector2(22, 33), Vector2(180.0 * clampf(player_stam / player_max_stam, 0.0, 1.0), 8)), c8(16, 185, 129), true)
	draw_rect(Rect2(Vector2(22, 46), Vector2(180.0, 8)), c8(28, 25, 23), true)
	draw_rect(Rect2(Vector2(22, 46), Vector2(180.0 * clampf(player_mana / player_max_mana, 0.0, 1.0), 8)), c8(56, 189, 248), true)
	if font != null:
		draw_string(font, Vector2(208, 27), str(int(player_hp)) + " HP", HORIZONTAL_ALIGNMENT_LEFT, 75.0, 10, c8(253, 164, 175))
		draw_string(font, Vector2(22, 68), "Lv." + str(level) + " · Ash: " + str(ash) + " · Flasks: " + str(flasks) + " · Iron: " + str(star_iron), HORIZONTAL_ALIGNMENT_LEFT, 260.0, 11, c8(251, 191, 36))
		draw_string(font, Vector2(22, 85), str(weapons[equipped_weapon_idx]["name"]) + " +" + str(weapons[equipped_weapon_idx]["upgrade"]) + " · " + str(spells[active_spell_idx]["name"]), HORIZONTAL_ALIGNMENT_LEFT, 260.0, 10, c8(199, 210, 254))

	# Top-Right Menu Bar (Panoply, Grimoire, Quests, AI World, Map, FullScr)
	var labels := ["Panoply", "Grimoire", "Quests", "AI World", "Map/Save", "FullScr"]
	for i in range(labels.size()):
		var bx: float = vp.x - 498.0 + i * 82.0
		draw_rect(Rect2(Vector2(bx, 10), Vector2(76, 34)), Color(0.07, 0.08, 0.12, 0.92), true)
		draw_rect(Rect2(Vector2(bx, 10), Vector2(76, 34)), c8(180, 83, 9), false, 1.5)
		if font != null:
			draw_string(font, Vector2(bx, 31), labels[i], HORIZONTAL_ALIGNMENT_CENTER, 76.0, 11, c8(253, 230, 138))

	# Top-Right Tactical Mini-Map Radar
	var map_w := 124.0
	var map_h := 80.0
	var map_x := vp.x - map_w - 14.0
	var map_y := 52.0
	var sx := map_w / 1440.0
	var sy := map_h / 920.0
	draw_rect(Rect2(Vector2(map_x, map_y), Vector2(map_w, map_h)), Color(0.04, 0.05, 0.08, 0.88), true)
	draw_rect(Rect2(Vector2(map_x, map_y), Vector2(map_w, map_h)), c8(180, 83, 9), false, 1.5)
	for pr in props:
		if pr["region"] == region_id:
			var bp: Vector2 = pr["pos"]
			if pr["type"] == "building":
				draw_rect(Rect2(Vector2(map_x + bp.x * sx - 4, map_y + bp.y * sy - 3), Vector2(8, 6)), c8(120, 53, 15), true)
			elif pr["type"] == "shrine":
				draw_circle(Vector2(map_x + bp.x * sx, map_y + bp.y * sy), 2.5, c8(245, 158, 11))
	for c in creatures:
		if c["region"] == region_id and float(c["hp"]) > 0.0:
			var cp: Vector2 = c["pos"]
			draw_circle(Vector2(map_x + cp.x * sx, map_y + cp.y * sy), 2.4, c8(239, 68, 68))
	for n in npcs:
		if n["region"] == region_id and n["alive"]:
			var np: Vector2 = n["pos"]
			draw_circle(Vector2(map_x + np.x * sx, map_y + np.y * sy), 2.5, c8(52, 211, 153))
	draw_circle(Vector2(map_x + player_pos.x * sx, map_y + player_pos.y * sy), 3.2, Color.WHITE)
	if font != null:
		draw_string(font, Vector2(map_x - 140.0, map_y + 18.0), str(region_titles[region_id]), HORIZONTAL_ALIGNMENT_RIGHT, 132.0, 12, c8(253, 230, 138))
		draw_string(font, Vector2(map_x - 140.0, map_y + 34.0), str(region_subtitles[region_id]), HORIZONTAL_ALIGNMENT_RIGHT, 132.0, 10, c8(168, 162, 158))

	# Center Banner Toast
	if banner_timer > 0.0 and font != null:
		draw_rect(Rect2(Vector2(vp.x * 0.5 - 220.0, 52.0), Vector2(440.0, 28.0)), Color(0.05, 0.06, 0.09, 0.92), true)
		draw_rect(Rect2(Vector2(vp.x * 0.5 - 220.0, 52.0), Vector2(440.0, 28.0)), c8(180, 83, 9), false, 1.2)
		draw_string(font, Vector2(vp.x * 0.5 - 210.0, 70.0), world_banner, HORIZONTAL_ALIGNMENT_CENTER, 420.0, 12, c8(253, 230, 138))

	# Bottom-Center Context Interact Button
	var prompt: String = get_nearby_prompt()
	if prompt != "" and font != null:
		draw_rect(Rect2(Vector2(vp.x * 0.5 - 140.0, vp.y - 60.0), Vector2(280.0, 40.0)), c8(180, 83, 9), true)
		draw_rect(Rect2(Vector2(vp.x * 0.5 - 140.0, vp.y - 60.0), Vector2(280.0, 40.0)), c8(253, 230, 138), false, 1.5)
		draw_string(font, Vector2(vp.x * 0.5 - 135.0, vp.y - 35.0), "[ACT] " + prompt, HORIZONTAL_ALIGNMENT_CENTER, 270.0, 13, Color.WHITE)

	# Bottom-Left Ergonomic Virtual Analog Stick
	var stick_c := Vector2(118.0, vp.y - 118.0)
	draw_circle(stick_c, 76.0, Color(0.06, 0.07, 0.10, 0.88))
	draw_arc(stick_c, 76.0, 0.0, TAU, 36, c8(120, 53, 15), 2.5)
	if font != null:
		draw_string(font, stick_c + Vector2(-12, -52), "▲", HORIZONTAL_ALIGNMENT_CENTER, 24.0, 12, c8(168, 162, 158))
		draw_string(font, stick_c + Vector2(-12, 62), "▼", HORIZONTAL_ALIGNMENT_CENTER, 24.0, 12, c8(168, 162, 158))
		draw_string(font, stick_c + Vector2(-64, 5), "◄", HORIZONTAL_ALIGNMENT_CENTER, 24.0, 12, c8(168, 162, 158))
		draw_string(font, stick_c + Vector2(40, 5), "►", HORIZONTAL_ALIGNMENT_CENTER, 24.0, 12, c8(168, 162, 158))
	draw_circle(stick_c + touch_move_vec * 32.0, 26.0, c8(245, 158, 11))
	draw_arc(stick_c + touch_move_vec * 32.0, 26.0, 0.0, TAU, 24, c8(254, 240, 138), 2.0)

	# Bottom-Right Ergonomic 6-Button Combat Cluster
	var act_names := ["STRIKE", "HEAVY", "DODGE", "SPELL", "PARRY", "ACT/HEAL"]
	var act_cols := [c8(180, 83, 9), c8(190, 18, 60), c8(2, 132, 199), c8(79, 70, 229), c8(87, 83, 78), c8(5, 150, 105)]
	for r in range(2):
		for c in range(3):
			var idx: int = r * 3 + c
			var bc := Vector2(vp.x - 216.0 + c * 80.0, vp.y - 132.0 + r * 76.0)
			draw_circle(bc, 32.0, act_cols[idx])
			draw_arc(bc, 32.0, 0.0, TAU, 28, Color(1, 1, 1, 0.45), 1.8)
			if font != null:
				draw_string(font, bc + Vector2(-32, 4), act_names[idx], HORIZONTAL_ALIGNMENT_CENTER, 64.0, 10, Color.WHITE)

	# ==================== MODAL OVERLAYS ====================
	if active_modal != "NONE" and font != null:
		draw_rect(Rect2(Vector2.ZERO, vp), Color(0, 0, 0, 0.82), true)
		var card_w: float = minf(760.0, vp.x - 32.0)
		var card_h: float = minf(460.0, vp.y - 32.0)
		var card_l: float = (vp.x - card_w) * 0.5
		var card_t: float = (vp.y - card_h) * 0.5
		draw_rect(Rect2(Vector2(card_l, card_t), Vector2(card_w, card_h)), c8(16, 18, 26), true)
		draw_rect(Rect2(Vector2(card_l, card_t), Vector2(card_w, card_h)), c8(180, 83, 9), false, 2.0)
		draw_string(font, Vector2(card_l + 22.0, card_t + 34.0), active_modal + " · Ash: " + str(ash) + " · Star-Iron: " + str(star_iron) + " · Grain: " + str(untainted_grain), HORIZONTAL_ALIGNMENT_LEFT, card_w - 120.0, 15, c8(245, 158, 11))
		draw_rect(Rect2(Vector2(card_l + card_w - 86.0, card_t + 10.0), Vector2(72.0, 30.0)), c8(153, 27, 27), true)
		draw_string(font, Vector2(card_l + card_w - 86.0, card_t + 30.0), "CLOSE [X]", HORIZONTAL_ALIGNMENT_CENTER, 72.0, 11, Color.WHITE)

		if active_modal == "PANOPLY":
			var split_x: float = card_l + card_w * 0.54
			for i in range(weapons.size()):
				var w: Dictionary = weapons[i]
				var ry: float = card_t + 64.0 + i * 42.0
				draw_rect(Rect2(Vector2(card_l + 18.0, ry), Vector2(card_w * 0.54 - 28.0, 36.0)), c8(46, 36, 24) if i == equipped_weapon_idx else c8(22, 24, 34), true)
				draw_string(font, Vector2(card_l + 26.0, ry + 23.0), str(w["name"]) + " +" + str(w["upgrade"]) + " (" + str(w["base_dmg"]) + " DMG)", HORIZONTAL_ALIGNMENT_LEFT, 260.0, 11, Color.WHITE)
				draw_rect(Rect2(Vector2(split_x - 104.0, ry + 4.0), Vector2(88.0, 28.0)), c8(180, 83, 9), true)
				draw_string(font, Vector2(split_x - 104.0, ry + 22.0), "TEMPER +1", HORIZONTAL_ALIGNMENT_CENTER, 88.0, 10, Color.WHITE)

			var lv_cost: int = 85 + level * 40
			for i in range(attr_keys.size()):
				var k: String = attr_keys[i]
				var ay: float = card_t + 64.0 + i * 38.0
				draw_rect(Rect2(Vector2(split_x + 8.0, ay), Vector2(card_w * 0.46 - 26.0, 32.0)), c8(22, 24, 34), true)
				draw_string(font, Vector2(split_x + 18.0, ay + 21.0), k + ": " + str(attrs[k]), HORIZONTAL_ALIGNMENT_LEFT, 160.0, 12, c8(253, 230, 138))
				draw_rect(Rect2(Vector2(card_l + card_w - 118.0, ay + 3.0), Vector2(94.0, 26.0)), c8(6, 95, 70), true)
				draw_string(font, Vector2(card_l + card_w - 118.0, ay + 20.0), "+1 (" + str(lv_cost) + ")", HORIZONTAL_ALIGNMENT_CENTER, 94.0, 10, Color.WHITE)

			var arm: Dictionary = armors[equipped_armor_idx]
			draw_rect(Rect2(Vector2(split_x + 8.0, card_t + 312.0), Vector2(card_w * 0.46 - 26.0, 56.0)), c8(30, 41, 59), true)
			draw_string(font, Vector2(split_x + 16.0, card_t + 334.0), "Armor: " + str(arm["name"]) + " (DEF " + str(arm["def"]) + ")", HORIZONTAL_ALIGNMENT_LEFT, 310.0, 12, Color.WHITE)
			draw_string(font, Vector2(split_x + 16.0, card_t + 354.0), "Tap Here to Cycle Equipped Armor Set", HORIZONTAL_ALIGNMENT_LEFT, 310.0, 10, c8(56, 189, 248))

		elif active_modal == "GRIMOIRE":
			for i in range(spells.size()):
				var sp: Dictionary = spells[i]
				var ry: float = card_t + 64.0 + i * 52.0
				draw_rect(Rect2(Vector2(card_l + 20.0, ry), Vector2(card_w - 40.0, 46.0)), c8(46, 36, 66) if i == active_spell_idx else c8(22, 24, 34), true)
				draw_string(font, Vector2(card_l + 30.0, ry + 19.0), str(sp["name"]) + " [" + str(sp["school"]) + "] · Lv." + str(sp["lv"]) + " · PWR " + str(sp["power"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 200.0, 12, c8(253, 230, 138))
				draw_string(font, Vector2(card_l + 30.0, ry + 37.0), str(sp["desc"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 200.0, 10, c8(214, 211, 209))
				var u_cost: int = int(sp["lv"]) * 120
				draw_rect(Rect2(Vector2(card_l + card_w - 155.0, ry + 8.0), Vector2(125.0, 30.0)), c8(79, 70, 229), true)
				draw_string(font, Vector2(card_l + card_w - 155.0, ry + 27.0), "UPGRADE (" + str(u_cost) + ")", HORIZONTAL_ALIGNMENT_CENTER, 125.0, 10, Color.WHITE)

		elif active_modal == "QUESTS":
			for i in range(quests.size()):
				var q: Dictionary = quests[i]
				var ry: float = card_t + 68.0 + i * 96.0
				draw_rect(Rect2(Vector2(card_l + 20.0, ry), Vector2(card_w - 40.0, 84.0)), c8(22, 24, 34), true)
				draw_string(font, Vector2(card_l + 32.0, ry + 24.0), str(q["title"]) + " [" + str(q["status"]) + "]", HORIZONTAL_ALIGNMENT_LEFT, card_w - 64.0, 14, c8(251, 191, 36))
				draw_string(font, Vector2(card_l + 32.0, ry + 48.0), str(q["desc"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 64.0, 11, Color.WHITE)
				draw_string(font, Vector2(card_l + 32.0, ry + 70.0), "Outcome: " + str(q["outcome"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 64.0, 11, c8(52, 211, 153))

		elif active_modal == "AI_WORLD":
			draw_string(font, Vector2(card_l + 22.0, card_t + 62.0), "Oakhaven Food: " + str(int(settlement_food)) + "% · Cinder Covenant: " + str(int(cinder_power)) + "% · Umbral Synod: " + str(int(umbral_power)) + "%", HORIZONTAL_ALIGNMENT_LEFT, card_w - 44.0, 12, c8(52, 211, 153))
			for i in range(npcs.size()):
				var n: Dictionary = npcs[i]
				var ry: float = card_t + 80.0 + i * 48.0
				draw_rect(Rect2(Vector2(card_l + 20.0, ry), Vector2(card_w - 40.0, 42.0)), c8(22, 24, 34), true)
				var st_txt := "ALIVE" if n["alive"] else "FALLEN"
				draw_string(font, Vector2(card_l + 30.0, ry + 18.0), str(n["name"]) + " [" + st_txt + "] · Region: " + str(region_titles[n["region"]]) + " · Trust: " + str(n["trust"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 60.0, 12, c8(253, 230, 138))
				draw_string(font, Vector2(card_l + 30.0, ry + 35.0), "Autonomous Goal: " + str(n["goal"]) + " — " + str(n["action"]), HORIZONTAL_ALIGNMENT_LEFT, card_w - 60.0, 10, c8(214, 211, 209))

		elif active_modal == "MAP":
			for i in range(region_keys.size()):
				var rk: String = region_keys[i]
				var ry: float = card_t + 64.0 + i * 46.0
				draw_rect(Rect2(Vector2(card_l + 20.0, ry), Vector2(card_w - 40.0, 38.0)), c8(180, 83, 9) if rk == region_id else c8(22, 24, 34), true)
				draw_string(font, Vector2(card_l + 32.0, ry + 24.0), "Fast Travel -> " + str(region_titles[rk]) + " (" + str(region_subtitles[rk]) + ")", HORIZONTAL_ALIGNMENT_LEFT, card_w - 64.0, 12, Color.WHITE)
			draw_rect(Rect2(Vector2(card_l + 20.0, card_t + card_h - 54.0), Vector2(card_w - 40.0, 38.0)), c8(6, 95, 70), true)
			draw_string(font, Vector2(card_l + 20.0, card_t + card_h - 30.0), "SAVE CHRONICLE TO DEVICE STORAGE", HORIZONTAL_ALIGNMENT_CENTER, card_w - 40.0, 13, Color.WHITE)

		elif active_modal == "DIALOGUE" and selected_npc_idx >= 0 and selected_npc_idx < npcs.size():
			var npc: Dictionary = npcs[selected_npc_idx]
			draw_string(font, Vector2(card_l + 24.0, card_t + 76.0), str(npc["name"]) + " — " + str(npc["title"]) + " (Trust " + str(npc["trust"]) + ")", HORIZONTAL_ALIGNMENT_LEFT, card_w - 48.0, 15, c8(253, 230, 138))
			draw_string(font, Vector2(card_l + 24.0, card_t + 102.0), "Epistemic State: " + dialogue_thought, HORIZONTAL_ALIGNMENT_LEFT, card_w - 48.0, 11, c8(168, 162, 158))
			draw_rect(Rect2(Vector2(card_l + 24.0, card_t + 118.0), Vector2(card_w - 48.0, 86.0)), c8(22, 24, 34), true)
			draw_string(font, Vector2(card_l + 34.0, card_t + 154.0), dialogue_text, HORIZONTAL_ALIGNMENT_LEFT, card_w - 68.0, 12, Color.WHITE)

			var bw: float = (card_w - 56.0) / 3.0
			var by1: float = card_t + card_h - 122.0
			var by2: float = card_t + card_h - 68.0
			draw_rect(Rect2(Vector2(card_l + 20.0, by1), Vector2(bw, 40.0)), c8(6, 95, 70), true)
			draw_string(font, Vector2(card_l + 20.0, by1 + 25.0), "Persuade (+Trust & Lore)", HORIZONTAL_ALIGNMENT_CENTER, bw, 11, Color.WHITE)
			draw_rect(Rect2(Vector2(card_l + 28.0 + bw, by1), Vector2(bw, 40.0)), c8(180, 83, 9), true)
			draw_string(font, Vector2(card_l + 28.0 + bw, by1 + 25.0), "Dismiss Companion" if npc["companion"] else "Recruit Companion", HORIZONTAL_ALIGNMENT_CENTER, bw, 11, Color.WHITE)
			draw_rect(Rect2(Vector2(card_l + 36.0 + bw * 2.0, by1), Vector2(bw, 40.0)), c8(30, 58, 138), true)
			var srv_label := "Open Star-Iron Forge" if npc["id"] == "korvak" else "Ember Blessing (Heal)"
			draw_string(font, Vector2(card_l + 36.0 + bw * 2.0, by1 + 25.0), srv_label, HORIZONTAL_ALIGNMENT_CENTER, bw, 11, Color.WHITE)

			draw_rect(Rect2(Vector2(card_l + 20.0, by2), Vector2(bw, 40.0)), c8(120, 53, 15), true)
			draw_string(font, Vector2(card_l + 20.0, by2 + 25.0), "Buy Flask (50 Ash)", HORIZONTAL_ALIGNMENT_CENTER, bw, 11, Color.WHITE)
			draw_rect(Rect2(Vector2(card_l + 28.0 + bw, by2), Vector2(bw, 40.0)), c8(76, 29, 149), true)
			draw_string(font, Vector2(card_l + 28.0 + bw, by2 + 25.0), "Buy Star-Iron (90 Ash)", HORIZONTAL_ALIGNMENT_CENTER, bw, 11, Color.WHITE)
			draw_rect(Rect2(Vector2(card_l + 36.0 + bw * 2.0, by2), Vector2(bw, 40.0)), c8(190, 18, 60), true)
			var q_label := "Deliver Grain (+180 Ash)"
			if npc["id"] == "korvak" and has_medallion:
				q_label = "Show Tomas's Medallion!"
			elif npc["id"] == "vane" and has_medallion:
				q_label = "Extort Vane (+450 Ash)"
			elif (npc["id"] == "verenice" or npc["id"] == "malrik") and has_chalice:
				q_label = "Bestow Sacred Chalice!"
			draw_string(font, Vector2(card_l + 36.0 + bw * 2.0, by2 + 25.0), q_label, HORIZONTAL_ALIGNMENT_CENTER, bw, 11, Color.WHITE)
