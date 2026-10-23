extends Node2D

var sfx: AudioSynthesizer
var global_time: float = 0.0
var ai_tick_timer: float = 0.0

var screen_state: String = "TITLE" # TITLE, PLAYING, DEATH, VICTORY
var active_modal: String = "NONE"  # NONE, INVENTORY, GRIMOIRE, AI_WORLD, DIALOGUE, MAP
var region_id: String = "oakhaven"

var region_keys: Array[String] = ["oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible"]
var region_titles: Dictionary = {
	"oakhaven": "Oakhaven Vigil",
	"bramblewood": "Weeping Bramblewood",
	"cathedral": "Sunken Cathedral",
	"catacombs": "Synod Catacombs",
	"bastion": "Ironmire Bastion",
	"crucible": "The Ashen Crucible"
}
var region_colors: Dictionary = {
	"oakhaven": [Color8(26, 28, 36), Color8(34, 37, 46)],
	"bramblewood": [Color8(18, 30, 27), Color8(24, 39, 35)],
	"cathedral": [Color8(20, 24, 40), Color8(28, 33, 54)],
	"catacombs": [Color8(25, 21, 27), Color8(34, 29, 37)],
	"bastion": [Color8(34, 22, 24), Color8(45, 29, 32)],
	"crucible": [Color8(28, 18, 36), Color8(38, 25, 48)]
}

# Player State
var level: int = 1
var ash: int = 240
var flasks: int = 4
var star_iron: int = 3
var player_hp: float = 280.0
var player_max_hp: float = 280.0
var player_stam: float = 180.0
var player_max_stam: float = 180.0
var player_mana: float = 160.0
var player_max_mana: float = 160.0
var player_pos: Vector2 = Vector2(680.0, 480.0)
var player_facing: float = 0.0
var is_moving: bool = false
var dodge_timer: float = 0.0
var parry_timer: float = 0.0
var slash_timer: float = 0.0
var cam_pos: Vector2 = Vector2.ZERO

# Living World Macro State
var settlement_food: float = 64.0
var cinder_power: float = 52.0
var umbral_power: float = 48.0
var world_banner: String = "Oakhaven Vigil · Powered by Godot 4.3 Engine"
var banner_timer: float = 4.5

# Touch & Input State
var touch_move_vec: Vector2 = Vector2.ZERO
var move_touch_idx: int = -1

var weapons: Array[Dictionary] = []
var equipped_weapon_idx: int = 0
var spells: Array[Dictionary] = []
var active_spell_idx: int = 0

var npcs: Array[Dictionary] = []
var selected_npc_idx: int = -1
var dialogue_text: String = ""

var creatures: Array[Dictionary] = []
var props: Array[Dictionary] = []
var spell_zones: Array[Dictionary] = []
var projectiles: Array[Dictionary] = []
var corpses: Array[Dictionary] = []
var floating_texts: Array[Dictionary] = []
var ash_particles: Array[Dictionary] = []

func _ready() -> void:
	sfx = AudioSynthesizer.new()
	add_child(sfx)
	init_world()

func trigger_haptic(duration_ms: int) -> void:
	Input.vibrate_handheld(duration_ms)

func show_toast(msg: String) -> void:
	world_banner = msg
	banner_timer = 4.0

func init_world() -> void:
	weapons = [
		{"name": "Vigilant Broadsword", "category": "Sword", "base_dmg": 44, "reach": 84.0, "stam": 14.0, "upgrade": 0},
		{"name": "Penitent Greatsword", "category": "Greatsword", "base_dmg": 70, "reach": 108.0, "stam": 22.0, "upgrade": 0},
		{"name": "Whispering Misericorde", "category": "Dagger", "base_dmg": 34, "reach": 62.0, "stam": 8.0, "upgrade": 0},
		{"name": "Choir-Guard Partisan", "category": "Spear", "base_dmg": 52, "reach": 118.0, "stam": 16.0, "upgrade": 0},
		{"name": "Astral Choir Catalyst", "category": "Catalyst", "base_dmg": 32, "reach": 90.0, "stam": 11.0, "upgrade": 0}
	]
	spells = [
		{"id": "grav", "name": "Singularity Well", "school": "Graviturgy", "mana": 20.0, "hp": 0.0, "power": 40, "color": Color8(99, 102, 241)},
		{"id": "pyro", "name": "Cinder Tempest", "school": "Pyromancy", "mana": 18.0, "hp": 0.0, "power": 46, "color": Color8(249, 115, 22)},
		{"id": "runic", "name": "Sigil of Convergence", "school": "Runic Sorcery", "mana": 15.0, "hp": 0.0, "power": 32, "color": Color8(245, 158, 11)},
		{"id": "blood", "name": "Sanguine Lance", "school": "Bloodcraft", "mana": 8.0, "hp": 15.0, "power": 78, "color": Color8(225, 29, 72)},
		{"id": "vital", "name": "Verdant Suture", "school": "Vitalism", "mana": 22.0, "hp": 0.0, "power": 70, "color": Color8(16, 185, 129)},
		{"id": "umbral", "name": "Umbral Phantom Step", "school": "Umbral Arts", "mana": 16.0, "hp": 0.0, "power": 36, "color": Color8(56, 189, 248)}
	]
	npcs = [
		{
			"id": "verenice", "name": "Sister Verenice", "title": "Keeper of the First Ember",
			"region": "oakhaven", "pos": Vector2(600, 410), "target": Vector2(600, 410),
			"alive": true, "companion": false, "goal": "Preserve Supplies",
			"action": "Tending the First Ember Pyre", "trust": 35,
			"belief": "Only the warmth of the First Ember saves our souls.",
			"fact": "The Sacred Chalice rests inside the Sunken Cathedral.",
			"cloak": Color8(153, 27, 27), "accent": Color8(251, 191, 36),
			"speech": "The First Ember flickers, yet Oakhaven endures.", "speech_timer": 4.0, "cd": 0.0
		},
		{
			"id": "korvak", "name": "Master Smith Korvak", "title": "Star-Iron Forger",
			"region": "oakhaven", "pos": Vector2(420, 380), "target": Vector2(420, 380),
			"alive": true, "companion": false, "goal": "Forge Star-Iron",
			"action": "Hammering star-iron at the anvil", "trust": 30,
			"belief": "Star-tempered steel keeps a breath inside your ribs.",
			"fact": "Vane sold my apprentice Tomas a trapped crypt map.",
			"cloak": Color8(68, 64, 60), "accent": Color8(249, 115, 22),
			"speech": "Bring me Star-Iron and I will temper your blade.", "speech_timer": 3.5, "cd": 0.0
		},
		{
			"id": "gideon", "name": "Sir Gideon", "title": "Penitent Paladin",
			"region": "oakhaven", "pos": Vector2(880, 380), "target": Vector2(880, 380),
			"alive": true, "companion": false, "goal": "Patrol Gates",
			"action": "Guarding Oakhaven East Gate", "trust": 40,
			"belief": "A knight's vow never burns out in the ash.",
			"fact": "Recruit me in dialogue and I will fight beside you!",
			"cloak": Color8(180, 83, 9), "accent": Color8(226, 232, 240),
			"speech": "My greatsword stands ready for the Vigil.", "speech_timer": 3.5, "cd": 0.0
		},
		{
			"id": "lyra", "name": "Herbalist Lyra", "title": "Choir Scholar",
			"region": "bramblewood", "pos": Vector2(460, 500), "target": Vector2(460, 500),
			"alive": true, "companion": false, "goal": "Decode Runes",
			"action": "Sampling luminescent spores", "trust": 28,
			"belief": "Combine Graviturgy and Pyromancy for Singularity Conflagration.",
			"fact": "Cast Sanguine Lance through a Runic Sigil to split it x3!",
			"cloak": Color8(49, 46, 129), "accent": Color8(56, 189, 248),
			"speech": "These luminescent spores react to graviturgy!", "speech_timer": 4.0, "cd": 0.0
		},
		{
			"id": "vael", "name": "Commander Vael", "title": "Cinder Marshal",
			"region": "bastion", "pos": Vector2(480, 640), "target": Vector2(480, 640),
			"alive": true, "companion": false, "goal": "Hold Bastion",
			"action": "Directing Siege Trench defenses", "trust": 25,
			"belief": "Ironmire Bastion guards the threshold of the Crucible.",
			"fact": "Malakor fights in three deadly phases in the Crucible.",
			"cloak": Color8(180, 83, 9), "accent": Color8(234, 88, 12),
			"speech": "Hold the line against the Synod!", "speech_timer": 4.0, "cd": 0.0
		},
		{
			"id": "malrik", "name": "Whisperer Malrik", "title": "Synod Envoy",
			"region": "bastion", "pos": Vector2(1040, 640), "target": Vector2(1040, 640),
			"alive": true, "companion": false, "goal": "Umbral Eclipse",
			"action": "Coordinating Synod Blood-Knights", "trust": 15,
			"belief": "The First Ember is a fading lie; embrace the Eclipse.",
			"fact": "The Synod rewards those who claim the Seraph's crown.",
			"cloak": Color8(30, 41, 59), "accent": Color8(225, 29, 72),
			"speech": "The Seventh Star belongs to the shadow.", "speech_timer": 4.0, "cd": 0.0
		}
	]

	props.clear()
	for rk in region_keys:
		props.append({"region": rk, "type": "road", "pos": Vector2(720, 480), "size": Vector2(1320, 84), "label": "", "opened": false})
		props.append({"region": rk, "type": "road", "pos": Vector2(680, 460), "size": Vector2(92, 760), "label": "", "opened": false})
		if rk == "oakhaven":
			props.append({"region": rk, "type": "building", "pos": Vector2(340, 240), "size": Vector2(220, 140), "label": "Korvak's Star-Iron Smithy", "opened": false})
			props.append({"region": rk, "type": "building", "pos": Vector2(350, 710), "size": Vector2(210, 130), "label": "Sanctuary Granary", "opened": false})
			props.append({"region": rk, "type": "building", "pos": Vector2(890, 240), "size": Vector2(180, 130), "label": "North Garrison Watchtower", "opened": false})
			props.append({"region": rk, "type": "building", "pos": Vector2(1040, 710), "size": Vector2(190, 130), "label": "Crow's Perch Bazaar", "opened": false})
		else:
			props.append({"region": rk, "type": "building", "pos": Vector2(360, 240), "size": Vector2(210, 135), "label": "Ancient Sanctuary Keep", "opened": false})
			props.append({"region": rk, "type": "building", "pos": Vector2(1040, 710), "size": Vector2(200, 130), "label": "Ruined Outpost Hall", "opened": false})

		props.append({"region": rk, "type": "shrine", "pos": Vector2(680, 460), "size": Vector2(64, 64), "label": "Rest at First Ember Pyre", "opened": false})
		props.append({"region": rk, "type": "chest", "pos": Vector2(960, 340), "size": Vector2(48, 36), "label": "Open Relic Chest", "opened": false})
		props.append({"region": rk, "type": "harvest", "pos": Vector2(520, 680), "size": Vector2(40, 40), "label": "Harvest Star-Iron / Grain", "opened": false})
		props.append({"region": rk, "type": "harvest", "pos": Vector2(860, 640), "size": Vector2(40, 40), "label": "Harvest Luminescent Spore", "opened": false})
		for i in range(8):
			var tx: float = 180.0 + fmod(float(i) * 175.0, 1240.0)
			var ty: float = 150.0 if (i % 2 == 0) else 815.0
			props.append({"region": rk, "type": "tree", "pos": Vector2(tx, ty), "size": Vector2(56, 64), "label": "", "opened": false})

	reset_creatures()

	corpses = [
		{"region": "bramblewood", "pos": Vector2(620, 690), "name": "Fallen Oakhaven Forager", "ash": 75, "scavenged": false},
		{"region": "catacombs", "pos": Vector2(520, 560), "name": "Apprentice Tomas's Remains", "ash": 130, "scavenged": false}
	]

	ash_particles.clear()
	for i in range(44):
		ash_particles.append({
			"pos": Vector2(randf() * 1280.0, randf() * 720.0),
			"vel": Vector2(-14.0 - randf() * 18.0, 10.0 + randf() * 14.0),
			"size": 2.5 + randf() * 2.5,
			"color": Color8(245, 158, 11, 180) if (i % 4 == 0) else Color8(214, 211, 209, 120)
		})

func reset_creatures() -> void:
	creatures = [
		{"name": "Ash-Stalker Hound", "role": "predator", "region": "oakhaven", "pos": Vector2(1240, 520), "hp": 95.0, "max_hp": 95.0, "dmg": 18, "speed": 130.0, "range": 54.0, "state": "patrol", "timer": 0.0, "ash": 65, "scale": 1.0, "boss": false, "phase": 1, "dead": false},
		{"name": "Ashen White-Stag", "role": "prey", "region": "bramblewood", "pos": Vector2(440, 680), "hp": 65.0, "max_hp": 65.0, "dmg": 10, "speed": 125.0, "range": 45.0, "state": "patrol", "timer": 0.0, "ash": 45, "scale": 1.0, "boss": false, "phase": 1, "dead": false},
		{"name": "Blight-Maw Hound", "role": "predator", "region": "bramblewood", "pos": Vector2(780, 560), "hp": 110.0, "max_hp": 110.0, "dmg": 24, "speed": 145.0, "range": 58.0, "state": "patrol", "timer": 0.0, "ash": 80, "scale": 1.0, "boss": false, "phase": 1, "dead": false},
		{"name": "Marrow-Gorged Ghoul", "role": "scavenger", "region": "bramblewood", "pos": Vector2(890, 720), "hp": 125.0, "max_hp": 125.0, "dmg": 26, "speed": 122.0, "range": 56.0, "state": "patrol", "timer": 0.0, "ash": 90, "scale": 1.05, "boss": false, "phase": 1, "dead": false},
		{"name": "Vaelen, Stag-Lord", "role": "miniboss", "region": "bramblewood", "pos": Vector2(1180, 480), "hp": 360.0, "max_hp": 360.0, "dmg": 40, "speed": 138.0, "range": 82.0, "state": "patrol", "timer": 0.0, "ash": 420, "scale": 1.35, "boss": false, "phase": 1, "dead": false},
		{"name": "Astral Choir Warden", "role": "guard", "region": "cathedral", "pos": Vector2(780, 500), "hp": 160.0, "max_hp": 160.0, "dmg": 32, "speed": 120.0, "range": 70.0, "state": "patrol", "timer": 0.0, "ash": 125, "scale": 1.1, "boss": false, "phase": 1, "dead": false},
		{"name": "Arch-Cantor Oakhart", "role": "miniboss", "region": "cathedral", "pos": Vector2(1140, 480), "hp": 440.0, "max_hp": 440.0, "dmg": 46, "speed": 126.0, "range": 86.0, "state": "patrol", "timer": 0.0, "ash": 550, "scale": 1.4, "boss": false, "phase": 1, "dead": false},
		{"name": "Synod Bone-Sentinel", "role": "guard", "region": "catacombs", "pos": Vector2(760, 460), "hp": 155.0, "max_hp": 155.0, "dmg": 34, "speed": 124.0, "range": 66.0, "state": "patrol", "timer": 0.0, "ash": 120, "scale": 1.1, "boss": false, "phase": 1, "dead": false},
		{"name": "Cinder Templar", "role": "guard", "region": "bastion", "pos": Vector2(740, 480), "hp": 190.0, "max_hp": 190.0, "dmg": 36, "speed": 126.0, "range": 68.0, "state": "patrol", "timer": 0.0, "ash": 135, "scale": 1.15, "boss": false, "phase": 1, "dead": false},
		{"name": "Synod Blood-Knight", "role": "guard", "region": "bastion", "pos": Vector2(980, 480), "hp": 195.0, "max_hp": 195.0, "dmg": 38, "speed": 130.0, "range": 68.0, "state": "patrol", "timer": 0.0, "ash": 140, "scale": 1.15, "boss": false, "phase": 1, "dead": false},
		{"name": "Malakor, Hollowed Seraph", "role": "boss", "region": "crucible", "pos": Vector2(920, 480), "hp": 1100.0, "max_hp": 1100.0, "dmg": 54, "speed": 135.0, "range": 105.0, "state": "patrol", "timer": 0.0, "ash": 2500, "scale": 1.6, "boss": true, "phase": 1, "dead": false}
	]

func do_attack(heavy: bool) -> void:
	var wpn: Dictionary = weapons[equipped_weapon_idx]
	var cost: float = float(wpn["stam"]) * (1.5 if heavy else 1.0)
	if player_stam < cost:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "Low Stamina", "color": Color8(148, 163, 184), "life": 1.0})
		return
	player_stam -= cost
	slash_timer = 0.28 if heavy else 0.20
	sfx.play_swing(heavy)
	trigger_haptic(80 if heavy else 35)

	var dmg: int = int((float(wpn["base_dmg"]) + float(wpn["upgrade"]) * 9.0 + float(level) * 4.0) * (1.55 if heavy else 1.0))
	var reach: float = float(wpn["reach"]) * (1.22 if heavy else 1.0)

	for c in creatures:
		if c["region"] != region_id or float(c["hp"]) <= 0.0:
			continue
		if player_pos.distance_to(c["pos"]) <= reach + 26.0 * float(c["scale"]):
			c["hp"] = float(c["hp"]) - float(dmg)
			sfx.play_hit(heavy)
			trigger_haptic(110 if heavy else 50)
			floating_texts.append({
				"pos": (c["pos"] as Vector2) + Vector2(0, -28),
				"text": ("CRIT -" if heavy else "-") + str(dmg),
				"color": Color8(251, 191, 36) if heavy else Color.WHITE,
				"life": 1.0
			})
	process_creature_deaths()

func do_cast_spell() -> void:
	var sp: Dictionary = spells[active_spell_idx]
	var mana_cost: float = float(sp["mana"])
	var hp_cost: float = float(sp["hp"])
	if player_mana < mana_cost:
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "Low Focus", "color": Color8(56, 189, 248), "life": 1.0})
		return
	if hp_cost > 0.0 and player_hp <= hp_cost + 5.0:
		return
	player_mana -= mana_cost
	player_hp -= hp_cost

	var target_pos: Vector2 = player_pos + Vector2.from_angle(player_facing) * 135.0
	var sp_id: String = sp["id"]
	var power: int = int(sp["power"]) + level * 4

	if sp_id == "grav" or sp_id == "pyro" or sp_id == "runic":
		var new_zone := {
			"region": region_id, "pos": target_pos, "radius": 92.0,
			"school": sp["school"], "duration": 6.0, "power": power, "synergy": false
		}
		var syn_hit := false
		for ez in spell_zones:
			if ez["region"] != region_id:
				continue
			var combo: bool = (ez["school"] == "Graviturgy" and sp["school"] == "Pyromancy") or (ez["school"] == "Pyromancy" and sp["school"] == "Graviturgy")
			if combo and (ez["pos"] as Vector2).distance_to(target_pos) < 165.0:
				ez["synergy"] = true
				new_zone["synergy"] = true
				syn_hit = true
				show_toast("SYNERGY: SINGULARITY CONFLAGRATION!")
				trigger_haptic(140)
				for c in creatures:
					if c["region"] == region_id and float(c["hp"]) > 0.0 and (c["pos"] as Vector2).distance_to(target_pos) < 185.0:
						var s_dmg: int = power * 3
						c["hp"] = float(c["hp"]) - float(s_dmg)
						floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -32), "text": "SYNERGY -" + str(s_dmg), "color": Color8(254, 240, 138), "life": 1.2})
		spell_zones.append(new_zone)
		sfx.play_spell(syn_hit)
		process_creature_deaths()
	elif sp_id == "blood":
		projectiles.append({
			"region": region_id, "pos": player_pos,
			"vel": Vector2.from_angle(player_facing) * 440.0,
			"dmg": power + level * 5, "life": 1.2, "color": sp["color"], "split": false
		})
		sfx.play_spell(false)
	elif sp_id == "vital":
		var heal: int = power + level * 6
		player_hp = minf(player_max_hp, player_hp + float(heal))
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "+" + str(heal) + " HP", "color": Color8(52, 211, 153), "life": 1.0})
		sfx.play_spell(false)
	elif sp_id == "umbral":
		dodge_timer = 0.45
		player_pos += Vector2.from_angle(player_facing) * 115.0
		player_pos.x = clampf(player_pos.x, 60.0, 1380.0)
		player_pos.y = clampf(player_pos.y, 60.0, 860.0)
		sfx.play_spell(false)

func do_interact() -> void:
	for i in range(npcs.size()):
		var n: Dictionary = npcs[i]
		if n["alive"] and n["region"] == region_id and player_pos.distance_to(n["pos"]) < 95.0:
			selected_npc_idx = i
			dialogue_text = "\"" + str(n["belief"]) + " " + str(n["fact"]) + "\""
			active_modal = "DIALOGUE"
			return
	for pr in props:
		if pr["region"] != region_id:
			continue
		var d: float = player_pos.distance_to(pr["pos"])
		if pr["type"] == "shrine" and d < 90.0:
			player_hp = player_max_hp
			player_stam = player_max_stam
			player_mana = player_max_mana
			flasks = 4
			reset_creatures()
			show_toast("Rested at First Ember Pyre · Vitals & Flasks Restored")
			sfx.play_parry()
			return
		elif pr["type"] == "chest" and not pr["opened"] and d < 85.0:
			pr["opened"] = true
			ash += 150
			star_iron += 2
			show_toast("Opened Relic Chest (+150 Ash, +2 Star-Iron)")
			sfx.play_parry()
			return
		elif pr["type"] == "harvest" and not pr["opened"] and d < 85.0:
			pr["opened"] = true
			ash += 45
			star_iron += 1
			settlement_food = minf(100.0, settlement_food + 8.0)
			show_toast("Harvested Resource Node (+45 Ash, +1 Star-Iron, +Food)")
			sfx.play_parry()
			return
	for cp in corpses:
		if not cp["scavenged"] and cp["region"] == region_id and player_pos.distance_to(cp["pos"]) < 85.0:
			cp["scavenged"] = true
			ash += int(cp["ash"])
			star_iron += 1
			show_toast("Looted " + str(cp["name"]) + " (+" + str(cp["ash"]) + " Ash)")
			sfx.play_parry()
			return
	if flasks > 0 and player_hp < player_max_hp:
		flasks -= 1
		player_hp = minf(player_max_hp, player_hp + 85.0)
		floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "+85 HP (Flask)", "color": Color8(52, 211, 153), "life": 1.0})
		sfx.play_spell(false)

func process_creature_deaths() -> void:
	for c in creatures:
		if float(c["hp"]) <= 0.0 and not c["dead"]:
			c["dead"] = true
			var reward: int = int(c["ash"])
			ash += reward
			corpses.append({
				"region": c["region"], "pos": c["pos"],
				"name": "Remains of " + str(c["name"]),
				"ash": maxi(20, reward / 3), "scavenged": false
			})
			show_toast("Felled " + str(c["name"]) + " (+" + str(reward) + " Ash)")
			if c["boss"]:
				screen_state = "VICTORY"

func _process(dt: float) -> void:
	global_time += dt
	if banner_timer > 0.0:
		banner_timer -= dt

	for pt in ash_particles:
		pt["pos"] = (pt["pos"] as Vector2) + (pt["vel"] as Vector2) * dt
		if pt["pos"].x < 0.0:
			pt["pos"].x += 1280.0
		if pt["pos"].y > 720.0:
			pt["pos"].y -= 720.0

	if screen_state == "PLAYING" and active_modal == "NONE":
		if dodge_timer > 0.0:
			dodge_timer -= dt
		if parry_timer > 0.0:
			parry_timer -= dt
		if slash_timer > 0.0:
			slash_timer -= dt

		player_stam = minf(player_max_stam, player_stam + 30.0 * dt)
		player_mana = minf(player_max_mana, player_mana + 6.0 * dt)

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
		if is_moving:
			mv = mv.normalized()
			player_facing = mv.angle()
			var spd: float = 390.0 if dodge_timer > 0.0 else 205.0
			player_pos += mv * spd * dt
			player_pos.x = clampf(player_pos.x, 50.0, 1390.0)
			player_pos.y = clampf(player_pos.y, 60.0, 860.0)

		# Portal transitions
		if player_pos.x > 1365.0:
			var idx: int = region_keys.find(region_id)
			region_id = region_keys[(idx + 1) % region_keys.size()]
			player_pos.x = 95.0
			for n in npcs:
				if n["companion"] and n["alive"]:
					n["region"] = region_id
					n["pos"] = player_pos + Vector2(40, 0)
			show_toast("Entered " + str(region_titles[region_id]))
		elif player_pos.x < 70.0 and region_id != "oakhaven":
			var idx: int = region_keys.find(region_id)
			region_id = region_keys[maxi(0, idx - 1)]
			player_pos.x = 1320.0
			for n in npcs:
				if n["companion"] and n["alive"]:
					n["region"] = region_id
					n["pos"] = player_pos + Vector2(-40, 0)
			show_toast("Entered " + str(region_titles[region_id]))

		# Update Spell Zones
		for i in range(spell_zones.size() - 1, -1, -1):
			var z: Dictionary = spell_zones[i]
			z["duration"] = float(z["duration"]) - dt
			if float(z["duration"]) <= 0.0:
				spell_zones.remove_at(i)
			elif z["region"] == region_id:
				for c in creatures:
					if c["region"] == region_id and float(c["hp"]) > 0.0:
						var d: float = (z["pos"] as Vector2).distance_to(c["pos"])
						if d <= float(z["radius"]):
							if z["school"] == "Graviturgy":
								c["pos"] = (c["pos"] as Vector2).move_toward(z["pos"], 90.0 * dt)
							c["hp"] = float(c["hp"]) - float(z["power"]) * 0.6 * dt

		# Update Projectiles
		var split_add: Array[Dictionary] = []
		for i in range(projectiles.size() - 1, -1, -1):
			var pr: Dictionary = projectiles[i]
			pr["pos"] = (pr["pos"] as Vector2) + (pr["vel"] as Vector2) * dt
			pr["life"] = float(pr["life"]) - dt
			if float(pr["life"]) <= 0.0:
				projectiles.remove_at(i)
				continue
			if not pr["split"]:
				for z in spell_zones:
					if z["region"] == region_id and z["school"] == "Runic Sorcery" and (pr["pos"] as Vector2).distance_to(z["pos"]) <= float(z["radius"]):
						pr["split"] = true
						var ang: float = (pr["vel"] as Vector2).angle()
						var spd: float = (pr["vel"] as Vector2).length()
						for off in [-0.25, 0.25]:
							split_add.append({
								"region": region_id, "pos": pr["pos"],
								"vel": Vector2.from_angle(ang + off) * spd,
								"dmg": pr["dmg"], "life": pr["life"],
								"color": Color8(254, 240, 138), "split": true
							})
						show_toast("SYNERGY: RUNIC CONVERGENCE SPLIT x3!")
						break
			for c in creatures:
				if c["region"] == region_id and float(c["hp"]) > 0.0 and (pr["pos"] as Vector2).distance_to(c["pos"]) <= 28.0 * float(c["scale"]):
					c["hp"] = float(c["hp"]) - float(pr["dmg"])
					floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -26), "text": "-" + str(pr["dmg"]), "color": Color8(254, 240, 138), "life": 1.0})
					sfx.play_hit(pr["split"])
					projectiles.remove_at(i)
					break
		projectiles.append_array(split_add)

		# Update Creatures
		for c in creatures:
			if c["region"] != region_id or float(c["hp"]) <= 0.0:
				continue
			var d_player: float = player_pos.distance_to(c["pos"])
			if c["role"] == "prey":
				if d_player < 190.0:
					var dir: Vector2 = ((c["pos"] as Vector2) - player_pos).normalized()
					c["pos"] = (c["pos"] as Vector2) + dir * float(c["speed"]) * dt
			elif d_player < 320.0:
				if c["state"] == "windup":
					c["timer"] = float(c["timer"]) - dt
					if float(c["timer"]) <= 0.0:
						if d_player <= float(c["range"]) + 22.0:
							if parry_timer > 0.0:
								floating_texts.append({"pos": (c["pos"] as Vector2) + Vector2(0, -34), "text": "PARRIED!", "color": Color8(253, 224, 71), "life": 1.0})
								sfx.play_parry()
								trigger_haptic(95)
							elif dodge_timer <= 0.0:
								player_hp -= float(c["dmg"])
								floating_texts.append({"pos": player_pos + Vector2(0, -30), "text": "-" + str(c["dmg"]), "color": Color8(244, 63, 94), "life": 1.0})
								sfx.play_hit(false)
								trigger_haptic(120)
								if player_hp <= 0.0:
									screen_state = "DEATH"
						c["state"] = "recover"
						c["timer"] = 0.85
				elif c["state"] == "recover":
					c["timer"] = float(c["timer"]) - dt
					if float(c["timer"]) <= 0.0:
						c["state"] = "patrol"
				else:
					if d_player <= float(c["range"]):
						c["state"] = "windup"
						c["timer"] = 0.65
					else:
						c["pos"] = (c["pos"] as Vector2).move_toward(player_pos, float(c["speed"]) * dt)

		# Update Autonomous NPCs (Combat, Companion Follow, Waypoints, Speech Bubbles)
		for npc in npcs:
			if not npc["alive"] or npc["region"] != region_id:
				continue
			if float(npc["cd"]) > 0.0:
				npc["cd"] = float(npc["cd"]) - dt
			if float(npc["speech_timer"]) > 0.0:
				npc["speech_timer"] = float(npc["speech_timer"]) - dt

			var nearest_c = null
			var best_d: float = 260.0 if npc["companion"] else 230.0
			for c in creatures:
				if c["region"] == region_id and float(c["hp"]) > 0.0 and c["role"] != "prey":
					var dc: float = (npc["pos"] as Vector2).distance_to(c["pos"])
					if dc < best_d:
						best_d = dc
						nearest_c = c
			if nearest_c != null:
				if best_d > 52.0:
					npc["pos"] = (npc["pos"] as Vector2).move_toward(nearest_c["pos"], 140.0 * dt)
				elif float(npc["cd"]) <= 0.0:
					npc["cd"] = 1.0
					nearest_c["hp"] = float(nearest_c["hp"]) - 36.0
					floating_texts.append({"pos": (nearest_c["pos"] as Vector2) + Vector2(0, -24), "text": "-36", "color": Color8(253, 230, 138), "life": 1.0})
					npc["speech"] = "Back to the ash, " + str(nearest_c["name"]) + "!"
					npc["speech_timer"] = 3.0
			elif npc["companion"]:
				if (npc["pos"] as Vector2).distance_to(player_pos) > 72.0:
					npc["pos"] = (npc["pos"] as Vector2).move_toward(player_pos, 165.0 * dt)
			else:
				if (npc["pos"] as Vector2).distance_to(npc["target"]) > 14.0:
					npc["pos"] = (npc["pos"] as Vector2).move_toward(npc["target"], 72.0 * dt)

		process_creature_deaths()

		# Macro AI World Simulation Tick
		ai_tick_timer += dt
		if ai_tick_timer >= 6.5:
			ai_tick_timer = 0.0
			for npc in npcs:
				if npc["alive"] and not npc["companion"]:
					npc["target"] = Vector2(280.0 + randf() * 820.0, 240.0 + randf() * 440.0)
					npc["speech"] = npc["belief"]
					npc["speech_timer"] = 4.0

	for i in range(floating_texts.size() - 1, -1, -1):
		floating_texts[i]["pos"].y -= 28.0 * dt
		floating_texts[i]["life"] = float(floating_texts[i]["life"]) - dt
		if float(floating_texts[i]["life"]) <= 0.0:
			floating_texts.remove_at(i)

	queue_redraw()

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if screen_state == "TITLE":
			screen_state = "PLAYING"
			return
		match event.keycode:
			KEY_J:
				do_attack(false)
			KEY_K:
				do_attack(true)
			KEY_SPACE:
				if player_stam >= 18.0:
					player_stam -= 18.0
					dodge_timer = 0.34
					sfx.play_swing(false)
			KEY_F:
				parry_timer = 0.28
				sfx.play_parry()
			KEY_Q:
				do_cast_spell()
			KEY_E:
				do_interact()
			KEY_F11:
				var mode := DisplayServer.window_get_mode()
				DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if mode == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)

	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var vp: Vector2 = get_viewport_rect().size
		var mp: Vector2 = event.position
		if screen_state == "TITLE":
			screen_state = "PLAYING"
			return
		elif screen_state == "DEATH" or screen_state == "VICTORY":
			player_hp = player_max_hp
			player_pos = Vector2(680, 480)
			region_id = "oakhaven"
			reset_creatures()
			screen_state = "PLAYING"
			return
		# Check Bottom-Right Action Buttons
		if mp.x > vp.x - 240.0 and mp.y > vp.y - 160.0:
			var col: int = int((mp.x - (vp.x - 220.0)) / 70.0)
			var row: int = int((mp.y - (vp.y - 145.0)) / 68.0)
			var btn_idx: int = clampi(row * 3 + col, 0, 5)
			match btn_idx:
				0: do_attack(false)
				1: do_attack(true)
				2:
					if player_stam >= 18.0:
						player_stam -= 18.0
						dodge_timer = 0.34
				3: do_cast_spell()
				4: parry_timer = 0.28
				5: do_interact()
			return
		# Check Bottom-Left Analog Stick
		var stick_center := Vector2(96.0, vp.y - 96.0)
		if mp.distance_to(stick_center) <= 84.0:
			touch_move_vec = (mp - stick_center).normalized()
			return
	elif event is InputEventMouseButton and not event.pressed:
		touch_move_vec = Vector2.ZERO

func _draw() -> void:
	var vp: Vector2 = get_viewport_rect().size
	cam_pos.x = clampf(player_pos.x - vp.x * 0.5, 0.0, maxf(0.0, 1440.0 - vp.x))
	cam_pos.y = clampf(player_pos.y - vp.y * 0.5, 0.0, maxf(0.0, 920.0 - vp.y))

	var cols: Array = region_colors[region_id]
	draw_rect(Rect2(Vector2.ZERO, vp), cols[0], true)

	# Draw Floor Flagstones
	var start_c: int = maxi(0, int(cam_pos.x / 64.0))
	var end_c: int = mini(22, int((cam_pos.x + vp.x) / 64.0) + 1)
	var start_r: int = maxi(0, int(cam_pos.y / 64.0))
	var end_r: int = mini(14, int((cam_pos.y + vp.y) / 64.0) + 1)
	for r in range(start_r, end_r + 1):
		for c in range(start_c, end_c + 1):
			if (r + c) % 2 == 0:
				draw_rect(Rect2(Vector2(c * 64.0 - cam_pos.x + 2.0, r * 64.0 - cam_pos.y + 2.0), Vector2(60, 60)), cols[1], true)

	# Draw Roads, Buildings, Shrines, Chests, Harvest Nodes
	for pr in props:
		if pr["region"] != region_id:
			continue
		var p_pos: Vector2 = (pr["pos"] as Vector2) - cam_pos
		var sz: Vector2 = pr["size"]
		if pr["type"] == "road":
			draw_rect(Rect2(p_pos - sz * 0.5, sz), Color8(41, 37, 36), true)
		elif pr["type"] == "building":
			var tl: Vector2 = p_pos - sz * 0.5
			draw_rect(Rect2(tl + Vector2(8, 10), sz), Color(0, 0, 0, 0.55), true)
			draw_rect(Rect2(tl, sz), Color8(28, 25, 23), true)
			draw_rect(Rect2(tl - Vector2(4, 4), Vector2(sz.x + 8.0, sz.y * 0.56)), Color8(127, 29, 29), true)
			draw_rect(Rect2(tl + Vector2(20, sz.y * 0.62), Vector2(16, 16)), Color8(251, 191, 36), true)
			draw_rect(Rect2(tl + Vector2(sz.x - 36.0, sz.y * 0.62), Vector2(16, 16)), Color8(251, 191, 36), true)
		elif pr["type"] == "shrine":
			draw_circle(p_pos, 22.0, Color8(245, 158, 11))
			draw_circle(p_pos, 10.0, Color8(254, 240, 138))
		elif pr["type"] == "harvest" and not pr["opened"]:
			draw_circle(p_pos, 12.0 + sin(global_time * 5.0) * 2.0, Color8(16, 185, 129))
		elif pr["type"] == "chest":
			draw_rect(Rect2(p_pos - Vector2(18, 12), Vector2(36, 24)), Color8(87, 83, 78) if pr["opened"] else Color8(217, 119, 6), true)

	# Draw Spell Zones
	for z in spell_zones:
		if z["region"] == region_id:
			var zcol := Color8(254, 240, 138, 140) if z["synergy"] else Color8(99, 102, 241, 120)
			draw_circle((z["pos"] as Vector2) - cam_pos, float(z["radius"]), zcol)

	# Draw Creatures
	for c in creatures:
		if c["region"] != region_id or float(c["hp"]) <= 0.0:
			continue
		var cpos: Vector2 = (c["pos"] as Vector2) - cam_pos
		var ctex: ImageTexture = PixelArtGenerator.get_creature_texture(c["role"], c["boss"])
		draw_texture(ctex, cpos - ctex.get_size() * 0.5)
		var bw: float = 72.0 if c["boss"] else 44.0
		var ratio: float = clampf(float(c["hp"]) / float(c["max_hp"]), 0.0, 1.0)
		draw_rect(Rect2(cpos + Vector2(-bw * 0.5, -34), Vector2(bw, 5)), Color8(9, 10, 15), true)
		draw_rect(Rect2(cpos + Vector2(-bw * 0.5, -34), Vector2(bw * ratio, 5)), Color8(239, 68, 68), true)

	# Draw Autonomous NPCs
	for n in npcs:
		if not n["alive"] or n["region"] != region_id:
			continue
		var npos: Vector2 = (n["pos"] as Vector2) - cam_pos
		var ntex: ImageTexture = PixelArtGenerator.get_npc_texture(n["id"], n["cloak"], n["accent"])
		draw_texture(ntex, npos - ntex.get_size() * 0.5)

	# Draw Player
	var p_screen: Vector2 = player_pos - cam_pos
	var h_frame: int = 1 if (is_moving and int(global_time * 8.0) % 2 == 1) else 0
	var htex: ImageTexture = PixelArtGenerator.get_hero_texture(h_frame)
	draw_texture(htex, p_screen - htex.get_size() * 0.5)

	# Draw HUD Vitals Bar (Top-Left)
	draw_rect(Rect2(Vector2(14, 14), Vector2(240, 68)), Color(0.06, 0.07, 0.10, 0.90), true)
	draw_rect(Rect2(Vector2(24, 24), Vector2(220.0 * clampf(player_hp / player_max_hp, 0.0, 1.0), 10)), Color8(225, 29, 72), true)
	draw_rect(Rect2(Vector2(24, 40), Vector2(220.0 * clampf(player_stam / player_max_stam, 0.0, 1.0), 8)), Color8(16, 185, 129), true)
	draw_rect(Rect2(Vector2(24, 54), Vector2(220.0 * clampf(player_mana / player_max_mana, 0.0, 1.0), 8)), Color8(56, 189, 248), true)

	# Draw Bottom-Left Analog Stick & Bottom-Right Combat Cluster
	var stick_c := Vector2(96.0, vp.y - 96.0)
	draw_circle(stick_c, 64.0, Color(0.07, 0.08, 0.11, 0.85))
	draw_circle(stick_c + touch_move_vec * 26.0, 22.0, Color8(245, 158, 11))

	for r in range(2):
		for c in range(3):
			var bc := Vector2(vp.x - 190.0 + c * 68.0, vp.y - 115.0 + r * 64.0)
			draw_circle(bc, 26.0, Color(0.12, 0.11, 0.09, 0.90))
