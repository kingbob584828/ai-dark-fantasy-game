extends Node
class_name AudioSynthesizer

var player: AudioStreamPlayer
var playback: AudioStreamGeneratorPlayback
var sample_rate: float = 22050.0
var active_tones: Array = []

func _ready() -> void:
	player = AudioStreamPlayer.new()
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = sample_rate
	gen.buffer_length = 0.1
	player.stream = gen
	add_child(player)
	player.play()
	playback = player.get_stream_playback() as AudioStreamGeneratorPlayback

func _process(_delta: float) -> void:
	if playback == null:
		return
	var frames: int = playback.get_frames_available()
	for _i in range(frames):
		var sample: float = 0.0
		for j in range(active_tones.size() - 1, -1, -1):
			var t: Dictionary = active_tones[j]
			var env: float = 1.0 - (t["elapsed"] / t["duration"])
			var freq: float = lerpf(t["f_start"], t["f_end"], t["elapsed"] / t["duration"])
			t["phase"] += (freq * TAU) / sample_rate
			var sig: float = sin(t["phase"])
			if t["noise"] > 0.0:
				sig = sig * (1.0 - t["noise"]) + randf_range(-1.0, 1.0) * t["noise"]
			sample += sig * env * t["amp"]
			t["elapsed"] += 1.0 / sample_rate
			if t["elapsed"] >= t["duration"]:
				active_tones.remove_at(j)
		sample = clampf(sample, -0.95, 0.95)
		playback.push_frame(Vector2(sample, sample))

func play_swing(heavy: bool) -> void:
	active_tones.append({
		"f_start": 240.0 if heavy else 360.0,
		"f_end": 75.0,
		"duration": 0.16 if heavy else 0.11,
		"elapsed": 0.0,
		"phase": 0.0,
		"amp": 0.25,
		"noise": 0.45
	})

func play_hit(heavy: bool) -> void:
	active_tones.append({
		"f_start": 150.0 if heavy else 210.0,
		"f_end": 42.0,
		"duration": 0.20 if heavy else 0.13,
		"elapsed": 0.0,
		"phase": 0.0,
		"amp": 0.35,
		"noise": 0.55
	})

func play_parry() -> void:
	active_tones.append({
		"f_start": 880.0,
		"f_end": 1320.0,
		"duration": 0.28,
		"elapsed": 0.0,
		"phase": 0.0,
		"amp": 0.30,
		"noise": 0.10
	})

func play_spell(synergy: bool) -> void:
	active_tones.append({
		"f_start": 260.0 if synergy else 380.0,
		"f_end": 980.0 if synergy else 620.0,
		"duration": 0.36 if synergy else 0.22,
		"elapsed": 0.0,
		"phase": 0.0,
		"amp": 0.28,
		"noise": 0.15
	})
