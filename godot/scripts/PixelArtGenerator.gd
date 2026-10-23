extends RefCounted
class_name PixelArtGenerator

static var cache: Dictionary = {}

static func bake_grid(key: String, rows: Array, palette: Dictionary, scale_px: int = 3) -> ImageTexture:
	if cache.has(key):
		return cache[key]
	var h: int = rows.size()
	var w: int = (rows[0] as String).length()
	var img: Image = Image.create(w * scale_px, h * scale_px, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in range(h):
		var row: String = rows[y]
		for x in range(w):
			var ch: String = row.substr(x, 1)
			if ch == "." or not palette.has(ch):
				continue
			var col: Color = palette[ch]
			img.fill_rect(Rect2i(x * scale_px, y * scale_px, scale_px, scale_px), col)
	var tex: ImageTexture = ImageTexture.create_from_image(img)
	cache[key] = tex
	return tex

static func get_hero_texture(frame: int) -> ImageTexture:
	var pal := {
		"O": Color8(12, 14, 20),
		"H": Color8(148, 163, 184),
		"L": Color8(226, 232, 240),
		"E": Color8(56, 189, 248),
		"R": Color8(190, 18, 60),
		"C": Color8(30, 41, 59),
		"G": Color8(245, 158, 11),
		"B": Color8(28, 25, 23)
	}
	var rows_0 := [
		".....OOOOOO.....",
		"....OHLLLLHO....",
		"....OHLEELHO....",
		"....OHOOOOHO....",
		"...ORRRRRRRRO...",
		"..ORCHHHHHHCRO..",
		"..OCHLGGGGLHCO..",
		"..OCHHHHHHHHCO..",
		"..OCCGGGGGGCCO..",
		"...OCCHHHHCCO...",
		"...OCCCCCCCCO...",
		"...OCC.OO.CCO...",
		"....OBB..BBO....",
		"....OBB..BBO....",
		"....OOO..OOO...."
	]
	var rows_1 := [
		".....OOOOOO.....",
		"....OHLLLLHO....",
		"....OHLEELHO....",
		"....OHOOOOHO....",
		"...ORRRRRRRRO...",
		"..ORCHHHHHHCRO..",
		"..OCHLGGGGLHCO..",
		"..OCHHHHHHHHCO..",
		"..OCCGGGGGGCCO..",
		"...OCCHHHHCCO...",
		"..OCCCCCCCCCCO..",
		"...OBB.OO.CCO...",
		"...OOO....BBO...",
		"..........OOO...",
		"................"
	]
	return bake_grid("hero_" + str(frame), rows_1 if frame == 1 else rows_0, pal, 3)

static func get_npc_texture(npc_id: String, cloak: Color, accent: Color) -> ImageTexture:
	var pal := {
		"O": Color8(12, 14, 20),
		"C": cloak,
		"A": Color8(71, 85, 105),
		"G": accent,
		"F": Color8(231, 229, 228),
		"B": Color8(28, 25, 23)
	}
	var rows := [
		".....OOOOOO.....",
		"....OCCCCCCCO...",
		"....OCCFFCCCO...",
		"....OCCFFCCCO...",
		"...OCCCCCCCCO...",
		"..OCCAAAAAACC...",
		"..OCCAGGGGACCO..",
		"..OCCAAAAAACCO..",
		"...OCCCCCCCCO...",
		"...OCCCCCCCCO...",
		"...OCCCCCCCCO...",
		"....OBB..BBO....",
		"....OBB..BBO....",
		"....OOO..OOO...."
	]
	return bake_grid("npc_" + npc_id, rows, pal, 3)

static func get_creature_texture(role: String, is_boss: bool = false) -> ImageTexture:
	if is_boss:
		var bpal := {
			"O": Color8(12, 10, 18),
			"W": Color8(147, 51, 234),
			"F": Color8(244, 63, 94),
			"G": Color8(251, 191, 36),
			"S": Color8(226, 232, 240),
			"D": Color8(49, 46, 129)
		}
		var brows := [
			"........GGGGGGGG........",
			".......G........G.......",
			"..FFWW..OOOOOOOO..WWFF..",
			".FFWWWW.OSSSSSSO.WWWWFF.",
			"FFWWWWWWOSGGGGSOWWWWWWFF",
			".FFWWWWOOSSSSSSOOWWWWFF.",
			"..FFWW.OSSSSSSSSO.WWFF..",
			"...FF..OSSGGGGSSO..FF...",
			"..FFWW.OSSDDDDSSO.WWFF..",
			".FFWWWW.OSSSSSSO.WWWWFF.",
			"..FFWW..ODDDDDDO..WWFF..",
			"........ODDDDDDO........",
			"........OSS..SSO........",
			"........OOO..OOO........"
		]
		return bake_grid("boss_malakor", brows, bpal, 4)
	elif role == "prey":
		var spal := {
			"O": Color8(15, 23, 42),
			"A": Color8(253, 224, 71),
			"B": Color8(226, 232, 240),
			"S": Color8(148, 163, 184),
			"E": Color8(56, 189, 248)
		}
		var srows := [
			".........A..A...",
			"........AA.AA...",
			".........AAA....",
			".........OBEO...",
			"........OBBBO...",
			"..OOOOOOOBBBO...",
			".OBBBBBBBBBBO...",
			".OBBBBBSSSSBO...",
			"..OSSSSSSSO.....",
			"..OBO...OBO.....",
			"..OBO...OBO.....",
			"..OOO...OOO....."
		]
		return bake_grid("creature_prey", srows, spal, 3)
	elif role == "predator":
		var hpal := {
			"O": Color8(15, 10, 12),
			"R": Color8(153, 27, 27),
			"D": Color8(69, 10, 10),
			"G": Color8(16, 185, 129),
			"E": Color8(251, 191, 36)
		}
		var hrows := [
			"..........OOOO..",
			".........ORREEO.",
			"..OOOOOOOORRRRO.",
			".ORGRRRRRDRRRDO.",
			".ORRRRRGRRRRRD..",
			"..ODDDDDDDDDDO..",
			"..ORO.....ORO...",
			"..OOO.....OOO..."
		]
		return bake_grid("creature_predator", hrows, hpal, 3)
	else:
		var gpal := {
			"O": Color8(10, 12, 22),
			"I": Color8(99, 102, 241),
			"S": Color8(203, 213, 225),
			"G": Color8(245, 158, 11),
			"D": Color8(30, 27, 75)
		}
		var grows := [
			".....OOOOOO.....",
			"....OSSSSSSO....",
			"....OSGGGGSO....",
			"...OOSSSSSSOO...",
			"..OIIIIIIIIIIO..",
			"..OIDGGGGGGDIO..",
			"..OIDSSSSSSDIO..",
			"..OIDDDDDDDDIO..",
			"...ODDDDDDDDO...",
			"....OSS..SSO....",
			"....OOO..OOO...."
		]
		return bake_grid("creature_guard_" + role, grows, gpal, 3)
