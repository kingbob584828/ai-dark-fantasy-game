extends RefCounted

static var cache: Dictionary = {}

static func c8(r: int, g: int, b: int, a: int = 255) -> Color:
	return Color(float(r) / 255.0, float(g) / 255.0, float(b) / 255.0, float(a) / 255.0)

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

static func get_hero_texture(frame: int, hit_flash: bool = false) -> ImageTexture:
	var key := "hero_" + str(frame) + ("_flash" if hit_flash else "")
	var pal := {
		"O": c8(12, 14, 20),
		"H": Color.WHITE if hit_flash else c8(148, 163, 184),
		"L": c8(226, 232, 240),
		"E": c8(56, 189, 248),
		"R": c8(190, 18, 60),
		"C": c8(30, 41, 59),
		"G": c8(245, 158, 11),
		"B": c8(28, 25, 23)
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
	return bake_grid(key, rows_1 if frame == 1 else rows_0, pal, 3)

static func get_npc_texture(npc_id: String, cloak: Color, accent: Color, frame: int = 0) -> ImageTexture:
	var key := "npc_" + npc_id + "_" + str(frame)
	var pal := {
		"O": c8(12, 14, 20),
		"C": cloak,
		"A": c8(71, 85, 105),
		"G": accent,
		"F": c8(231, 229, 228),
		"B": c8(28, 25, 23)
	}
	var rows_0 := [
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
	var rows_1 := [
		".....OOOOOO.....",
		"....OCCCCCCCO...",
		"....OCCFFCCCO...",
		"....OCCFFCCCO...",
		"...OCCCCCCCCO...",
		"..OCCAAAAAACC...",
		"..OCCAGGGGACCO..",
		"..OCCAAAAAACCO..",
		"...OCCCCCCCCO...",
		"..OCCCCCCCCCCO..",
		'...OBB.OO.CCO...',
		"...OOO....BBO...",
		"..........OOO...",
		"................"
	]
	return bake_grid(key, rows_1 if frame == 1 else rows_0, pal, 3)

static func get_creature_texture(role: String, is_boss: bool = false, phase: int = 1, hit_flash: bool = false) -> ImageTexture:
	var key := "cre_" + role + "_" + str(is_boss) + "_p" + str(phase) + ("_f" if hit_flash else "")
	if is_boss:
		var wing_col := c8(225, 29, 72) if phase == 3 else (c8(147, 51, 234) if phase == 2 else c8(79, 70, 229))
		var bpal := {
			"O": c8(12, 10, 18),
			"W": wing_col,
			"F": c8(244, 63, 94),
			"G": c8(251, 191, 36),
			"S": Color.WHITE if hit_flash else c8(226, 232, 240),
			"D": c8(49, 46, 129)
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
		return bake_grid(key, brows, bpal, 4)
	elif role == "prey":
		var spal := {
			"O": c8(15, 23, 42),
			"A": c8(253, 224, 71),
			"B": Color.WHITE if hit_flash else c8(226, 232, 240),
			"S": c8(148, 163, 184),
			"E": c8(56, 189, 248)
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
		return bake_grid(key, srows, spal, 3)
	elif role == "predator":
		var hpal := {
			"O": c8(15, 10, 12),
			"R": Color.WHITE if hit_flash else c8(153, 27, 27),
			"D": c8(69, 10, 10),
			"G": c8(16, 185, 129),
			"E": c8(251, 191, 36)
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
		return bake_grid(key, hrows, hpal, 3)
	elif role == "scavenger":
		var gpal := {
			"O": c8(12, 16, 12),
			"G": Color.WHITE if hit_flash else c8(101, 163, 13),
			"D": c8(54, 83, 20),
			"R": c8(225, 29, 72),
			"B": c8(214, 211, 209)
		}
		var grows := [
			"....OOOOOO......",
			"...OGGGGGGO.....",
			"...OGRGGRGO.....",
			"..OOBBBBBBOO....",
			".OGGDDDDDDGGO...",
			".OGDBBBBBBDGO...",
			"..ODDGGGGDDO....",
			"...OGG..GGO.....",
			"...OOO..OOO....."
		]
		return bake_grid(key, grows, gpal, 3)
	else:
		var kpal := {
			"O": c8(10, 12, 22),
			"I": Color.WHITE if hit_flash else (c8(16, 185, 129) if role == "miniboss" else c8(99, 102, 241)),
			"S": c8(203, 213, 225),
			"G": c8(245, 158, 11),
			"D": c8(30, 27, 75)
		}
		var krows := [
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
		return bake_grid(key, krows, kpal, 4 if role == "miniboss" else 3)
