package com.ashenfields.rpg

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Bundle
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlin.concurrent.thread
import kotlin.math.*
import kotlin.random.Random

// ==================== NATIVE PCM SYNTHESIZER (NO WEBVIEW, PURE ANDROID AUDIOTRACK) ====================
object NativeSynthAudio {
    var muted: Boolean = false

    fun playTone(startFreq: Double, endFreq: Double, durationMs: Int, volume: Float = 0.25f) {
        if (muted) return
        thread {
            try {
                val sampleRate = 22050
                val numSamples = (sampleRate * durationMs) / 1000
                val buffer = ShortArray(numSamples)
                var phase = 0.0
                for (i in 0 until numSamples) {
                    val progress = i.toDouble() / numSamples
                    val freq = startFreq + (endFreq - startFreq) * progress
                    val env = (1.0 - progress).pow(1.4)
                    phase += 2.0 * Math.PI * freq / sampleRate
                    val sample = (sin(phase) * env * volume * Short.MAX_VALUE).toInt()
                    buffer[i] = sample.coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
                }
                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_GAME)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(buffer.size * 2)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()
                track.write(buffer, 0, buffer.size)
                track.play()
                Thread.sleep(durationMs.toLong() + 40)
                track.release()
            } catch (_: Exception) {
            }
        }
    }

    fun playSwing(heavy: Boolean) = playTone(if (heavy) 180.0 else 280.0, 52.0, if (heavy) 210 else 130, 0.28f)
    fun playHit(crit: Boolean) = playTone(if (crit) 160.0 else 110.0, 32.0, if (crit) 260 else 160, 0.35f)
    fun playParry() = playTone(880.0, 1320.0, 320, 0.30f)
    fun playSpell(synergy: Boolean) = playTone(if (synergy) 360.0 else 220.0, if (synergy) 48.0 else 440.0, if (synergy) 480 else 280, 0.32f)
}

// ==================== DATA STRUCTURES ====================
data class NativeWeapon(
    val id: String,
    val name: String,
    val category: String,
    val baseDamage: Int,
    val reach: Float,
    val staminaCost: Float,
    var upgradeLevel: Int = 0
)

data class NativeSpell(
    val id: String,
    val name: String,
    val school: String,
    val manaCost: Float,
    val hpCost: Float,
    val power: Int,
    val colorHex: Long,
    val desc: String
)

data class NativeNPC(
    val id: String,
    val name: String,
    val title: String,
    val faction: String,
    var regionId: String,
    var x: Float,
    var y: Float,
    var hp: Float,
    val maxHp: Float,
    var alive: Boolean = true,
    var isCompanion: Boolean = false,
    var currentGoal: String,
    var currentAction: String,
    var trust: Int,
    val belief: String,
    val knownFact: String,
    val cloakColor: Long
)

data class NativeCreature(
    val id: String,
    val name: String,
    val role: String, // prey, predator, scavenger, guard, miniboss, boss
    val faction: String,
    val regionId: String,
    var x: Float,
    var y: Float,
    val homeX: Float,
    val homeY: Float,
    var hp: Float,
    var maxHp: Float,
    var damage: Int,
    val speed: Float,
    val attackRange: Float,
    var aiState: String = "patrol",
    var stateTimer: Float = 0f,
    var facing: Float = 0f,
    val ashReward: Int,
    val colorHex: Long,
    var scale: Float = 1f,
    val isBoss: Boolean = false,
    var bossPhase: Int = 1
)

data class NativeSpellZone(
    val regionId: String,
    val x: Float,
    val y: Float,
    val radius: Float,
    val school: String,
    var duration: Float,
    val power: Int,
    var synergyTriggered: Boolean = false
)

data class NativeProjectile(
    val regionId: String,
    var x: Float,
    var y: Float,
    var vx: Float,
    var vy: Float,
    var damage: Int,
    var isPlayer: Boolean,
    var life: Float,
    var colorHex: Long,
    var runicSplit: Boolean = false
)

data class NativeCorpse(
    val regionId: String,
    val x: Float,
    val y: Float,
    val name: String,
    val ashValue: Int,
    var scavenged: Boolean = false
)

class MainActivity : ComponentActivity() {
    // Hardware Controller / Keyboard state shared with 60fps loop
    private var stickX by mutableFloatStateOf(0f)
    private var stickY by mutableFloatStateOf(0f)
    private val keysHeld = mutableStateListOf<Int>()
    private var pendingAttackLight by mutableStateOf(false)
    private var pendingAttackHeavy by mutableStateOf(false)
    private var pendingDodge by mutableStateOf(false)
    private var pendingParry by mutableStateOf(false)
    private var pendingSpell by mutableStateOf(false)
    private var pendingInteract by mutableStateOf(false)
    private var pendingHeal by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Native Immersive Fullscreen Mode
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        setContent {
            Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF0B0C10)) {
                AshenFieldsNativeApp(
                    context = this,
                    hwStickX = stickX,
                    hwStickY = stickY,
                    keysHeld = keysHeld,
                    consumeLight = { if (pendingAttackLight) { pendingAttackLight = false; true } else false },
                    consumeHeavy = { if (pendingAttackHeavy) { pendingAttackHeavy = false; true } else false },
                    consumeDodge = { if (pendingDodge) { pendingDodge = false; true } else false },
                    consumeParry = { if (pendingParry) { pendingParry = false; true } else false },
                    consumeSpell = { if (pendingSpell) { pendingSpell = false; true } else false },
                    consumeInteract = { if (pendingInteract) { pendingInteract = false; true } else false },
                    consumeHeal = { if (pendingHeal) { pendingHeal = false; true } else false }
                )
            }
        }
    }

    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        if ((event.source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK &&
            event.action == MotionEvent.ACTION_MOVE
        ) {
            val lx = event.getAxisValue(MotionEvent.AXIS_X)
            val ly = event.getAxisValue(MotionEvent.AXIS_Y)
            stickX = if (abs(lx) > 0.18f) lx else 0f
            stickY = if (abs(ly) > 0.18f) ly else 0f
            return true
        }
        return super.onGenericMotionEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (!keysHeld.contains(keyCode)) {
            keysHeld.add(keyCode)
        }
        when (keyCode) {
            KeyEvent.KEYCODE_BUTTON_X, KeyEvent.KEYCODE_BUTTON_R1, KeyEvent.KEYCODE_J -> {
                pendingAttackLight = true; return true
            }
            KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.KEYCODE_BUTTON_R2, KeyEvent.KEYCODE_K -> {
                pendingAttackHeavy = true; return true
            }
            KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_SPACE -> {
                pendingDodge = true; return true
            }
            KeyEvent.KEYCODE_BUTTON_L1, KeyEvent.KEYCODE_F -> {
                pendingParry = true; return true
            }
            KeyEvent.KEYCODE_BUTTON_L2, KeyEvent.KEYCODE_Q -> {
                pendingSpell = true; return true
            }
            KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_E -> {
                pendingInteract = true; return true
            }
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_R -> {
                pendingHeal = true; return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
        keysHeld.remove(keyCode)
        return super.onKeyUp(keyCode, event)
    }
}

@Composable
fun AshenFieldsNativeApp(
    context: Context,
    hwStickX: Float,
    hwStickY: Float,
    keysHeld: List<Int>,
    consumeLight: () -> Boolean,
    consumeHeavy: () -> Boolean,
    consumeDodge: () -> Boolean,
    consumeParry: () -> Boolean,
    consumeSpell: () -> Boolean,
    consumeInteract: () -> Boolean,
    consumeHeal: () -> Boolean
) {
    var screenState by remember { mutableStateOf("TITLE") } // TITLE, PLAYING,DEATH, VICTORY
    var activeModal by remember { mutableStateOf("NONE") } // NONE, INVENTORY, AI_WORLD, DIALOGUE, MAP
    var regionId by remember { mutableStateOf("oakhaven") }

    // RPG Stats
    var level by remember { mutableIntStateOf(1) }
    var ash by remember { mutableIntStateOf(200) }
    var flasks by remember { mutableIntStateOf(4) }
    var starIron by remember { mutableIntStateOf(2) }
    var playerHp by remember { mutableFloatStateOf(260f) }
    var playerMaxHp by remember { mutableFloatStateOf(260f) }
    var playerStam by remember { mutableFloatStateOf(180f) }
    var playerMaxStam by remember { mutableFloatStateOf(180f) }
    var playerMana by remember { mutableFloatStateOf(160f) }
    var playerMaxMana by remember { mutableFloatStateOf(160f) }

    var playerX by remember { mutableFloatStateOf(700f) }
    var playerY by remember { mutableFloatStateOf(520f) }
    var playerFacing by remember { mutableFloatStateOf(0f) }
    var dodgeTimer by remember { mutableFloatStateOf(0f) }
    var parryTimer by remember { mutableFloatStateOf(0f) }
    var slashTimer by remember { mutableFloatStateOf(0f) }
    var touchMoveX by remember { mutableFloatStateOf(0f) }
    var touchMoveY by remember { mutableFloatStateOf(0f) }

    var settlementFood by remember { mutableFloatStateOf(58f) }
    var cinderPower by remember { mutableFloatStateOf(52f) }
    var umbralPower by remember { mutableFloatStateOf(48f) }
    var worldBanner by remember { mutableStateOf("Oakhaven Vigil · The First Ember Flickers") }

    val weapons = remember {
        mutableStateListOf(
            NativeWeapon("wpn_sword", "Vigilant Broadsword", "Sword", 36, 75f, 14f, 0),
            NativeWeapon("wpn_greatsword", "Penitent Greatsword", "Greatsword", 64, 100f, 24f, 0),
            NativeWeapon("wpn_dagger", "Whispering Misericorde", "Dagger", 26, 52f, 8f, 0),
            NativeWeapon("wpn_spear", "Choir-Guard Partisan", "Spear", 44, 110f, 16f, 0),
            NativeWeapon("wpn_catalyst", "Astral Choir Catalyst", "Catalyst", 24, 80f, 12f, 0)
        )
    }
    var equippedWeaponIdx by remember { mutableIntStateOf(0) }

    val spells = remember {
        listOf(
            NativeSpell("grav", "Singularity Well", "Graviturgy", 22f, 0f, 32, 0xFF6366F1, "Pulls foes inward. Combine with Cinder Tempest for Singularity Conflagration!"),
            NativeSpell("pyro", "Cinder Tempest", "Pyromancy", 20f, 0f, 38, 0xFFF97316, "Persistent fire zone. Detonates Graviturgy wells!"),
            NativeSpell("runic", "Sigil of Convergence", "Runic Sorcery", 16f, 0f, 26, 0xFFF59E0B, "Rune trap that splits Sanguine Lance projectiles into 3 bolts!"),
            NativeSpell("blood", "Sanguine Lance", "Bloodcraft", 8f, 18f, 68, 0xFFE11D48, "Sacrifices 18 HP to hurl a high-velocity blood spear."),
            NativeSpell("vital", "Verdant Suture", "Vitalism", 24f, 0f, 58, 0xFF10B981, "Restores Vitality to yourself and your sworn companion."),
            NativeSpell("umbral", "Umbral Phantom Step", "Umbral Arts", 18f, 0f, 30, 0xFF38BDF8, "Shadow blink across hazards with invulnerability frames.")
        )
    }
    var activeSpellIdx by remember { mutableIntStateOf(0) }

    val npcs = remember {
        mutableStateListOf(
            NativeNPC("verenice", "Sister Verenice", "Keeper of the Hearth-Ash", "Cinder Covenant", "oakhaven", 640f, 440f, 180f, 180f, true, false, "Preserve Supplies", "Tending the First Ember Pyre", 30, "Only the warmth of the First Ember saves our souls.", "The Sacred Chalice rests in the Sunken Cathedral.", 0xFF991B1B),
            NativeNPC("korvak", "Master Blacksmith Korvak", "Iron-Forger", "Oakhaven", "oakhaven", 500f, 560f, 260f, 260f, true, false, "Forge Star-Iron", "Hammering star-iron at the anvil", 25, "Only star-tempered steel keeps a breath in your ribs.", "Vane sold my apprentice Tomas a trapped crypt map!", 0xFF57534E),
            NativeNPC("vane", "Vane the Crow-Tongue", "Relic Broker", "Umbral Synod", "oakhaven", 920f, 560f, 160f, 160f, true, false, "Maximize Profit", "Appraising scavenged relics", 5, "Empires burn; the clever walk away with the silver.", "A lever in the Catacombs unlocks the Oakhaven shortcut.", 0xFF1E293B),
            NativeNPC("gideon", "Sir Gideon of the Ash", "Penitent Paladin", "Cinder Covenant", "oakhaven", 780f, 360f, 310f, 310f, true, false, "Purge Bastion", "Standing watch near the North Gate", 35, "A knight's oath never burns out.", "Recruit me and my halberd will fight beside you across all regions!", 0xFFB45309),
            NativeNPC("lyra", "Lyra the Blight-Seer", "Choir Scholar", "Survivors", "bramblewood", 480f, 520f, 155f, 155f, true, false, "Decode Runes", "Sampling luminescent spores", 25, "Graviturgy and Runes are a new grammar of creation.", "Fire Sanguine Lance through a Runic Sigil to split it in three!", 0xFF312E81),
            NativeNPC("vael", "Commander Vael", "Cinder Marshal", "Cinder Covenant", "bastion", 500f, 760f, 340f, 340f, true, false, "Seize Bastion", "Directing Siege Trench defenses", 20, "Ironmire Bastion is the lock on the Crucible.", "Malakor fights in three deadly phases inside the Crucible.", 0xFF7C2D12),
            NativeNPC("malrik", "Whisperer Malrik", "Synod Envoy", "Umbral Synod", "bastion", 1100f, 740f, 270f, 270f, true, false, "Umbral Eclipse", "Coordinating Synod Blood-Knights", 10, "The First Ember is a rotting lie; embrace the Eclipse.", "The Synod will reward those who extinguish the Choir's light.", 0xFF0F172A)
        )
    }
    var selectedNpc by remember { mutableStateOf<NativeNPC?>(null) }
    var dialogueLog by remember { mutableStateOf("") }

    val creatures = remember {
        mutableStateListOf(
            // Bramblewood ecology
            NativeCreature("stag_1", "Ashen White-Stag", "prey", "wilds", "bramblewood", 460f, 720f, 460f, 720f, 65f, 65f, 10, 130f, 45f, "graze", 0f, 0f, 40, 0xFFE7E5E4),
            NativeCreature("hound_1", "Blight-Maw Hound", "predator", "wilds", "bramblewood", 760f, 580f, 760f, 580f, 105f, 105f, 24, 148f, 58f, "patrol", 0f, 0f, 75, 0xFF991B1B),
            NativeCreature("ghoul_1", "Marrow-Gorged Ghoul", "scavenger", "dead", "bramblewood", 880f, 820f, 880f, 820f, 120f, 120f, 26, 125f, 56f, "patrol", 0f, 0f, 85, 0xFF4D7C0F),
            NativeCreature("staglord", "Vaelen, Blighted Stag-Lord", "miniboss", "wilds", "bramblewood", 1220f, 520f, 1220f, 520f, 360f, 360f, 42, 140f, 82f, "patrol", 0f, 0f, 420, 0xFF10B981, 1.45f),
            // Cathedral
            NativeCreature("chanter_1", "Astral Choir Warden", "guard", "dead", "cathedral", 720f, 520f, 720f, 520f, 155f, 155f, 34, 120f, 70f, "patrol", 0f, 0f, 120, 0xFF6366F1),
            NativeCreature("oakhart", "Arch-Cantor Oakhart", "miniboss", "dead", "cathedral", 1180f, 520f, 1180f, 520f, 440f, 440f, 48, 126f, 86f, "patrol", 0f, 0f, 550, 0xFF8B5CF6, 1.5f),
            // Catacombs
            NativeCreature("skel_1", "Synod Bone-Sentinel", "guard", "dead", "catacombs", 680f, 480f, 680f, 480f, 150f, 150f, 35, 124f, 66f, "patrol", 0f, 0f, 115, 0xFFD6D3D1),
            NativeCreature("cat_ghoul", "Crypt Corpse-Eater", "scavenger", "dead", "catacombs", 940f, 660f, 940f, 660f, 140f, 140f, 32, 134f, 58f, "patrol", 0f, 0f, 110, 0xFF65A30D),
            // Bastion Faction Warfare
            NativeCreature("cinder_1", "Cinder Covenant Templar", "guard", "cinder", "bastion", 680f, 520f, 680f, 520f, 190f, 190f, 36, 126f, 68f, "patrol", 0f, 0f, 130, 0xFFEA580C),
            NativeCreature("umbral_1", "Umbral Synod Blood-Knight", "guard", "umbral", "bastion", 980f, 520f, 980f, 520f, 195f, 195f, 38, 132f, 68f, "patrol", 0f, 0f, 135, 0xFFE11D48),
            // Crucible Multi-Phase Main Boss
            NativeCreature("malakor", "Malakor, the Hollowed Seraph", "boss", "dead", "crucible", 850f, 520f, 850f, 520f, 1100f, 1100f, 58, 138f, 105f, "patrol", 0f, 0f, 2500, 0xFFF59E0B, 1.9f, true, 1)
        )
    }

    val spellZones = remember { mutableStateListOf<NativeSpellZone>() }
    val projectiles = remember { mutableStateListOf<NativeProjectile>() }
    val corpses = remember {
        mutableStateListOf(
            NativeCorpse("bramblewood", 620f, 760f, "Fallen Oakhaven Forager", 70),
            NativeCorpse("catacombs", 480f, 540f, "Apprentice Tomas's Remains", 120)
        )
    }

    val regionNames = mapOf(
        "oakhaven" to "Oakhaven Vigil",
        "bramblewood" to "Weeping Bramblewood",
        "cathedral" to "Cathedral of the Sunken Choir",
        "catacombs" to "Ossuary of the First Synod",
        "bastion" to "Ironmire Bastion",
        "crucible" to "The Ashen Crucible"
    )

    fun doAttack(heavy: Boolean) {
        val wpn = weapons[equippedWeaponIdx]
        val cost = wpn.staminaCost * (if (heavy) 1.5f else 1f)
        if (playerStam < cost) return
        playerStam -= cost
        slashTimer = 0.22f
        NativeSynthAudio.playSwing(heavy)

        val dmg = ((wpn.baseDamage + wpn.upgradeLevel * 8 + level * 3) * (if (heavy) 1.55f else 1f)).toInt()
        val reach = wpn.reach * (if (heavy) 1.2f else 1f)

        creatures.filter { it.regionId == regionId && it.hp > 0f }.forEach { c ->
            val d = hypot(c.x - playerX, c.y - playerY)
            if (d <= reach + 24f * c.scale) {
                c.hp -= dmg
                NativeSynthAudio.playHit(heavy)
                if (c.hp <= 0f) {
                    ash += c.ashReward
                    corpses.add(NativeCorpse(regionId, c.x, c.y, "Remains of ${c.name}", c.ashReward / 3))
                    if (c.isBoss) {
                        screenState = "VICTORY"
                    }
                }
            }
        }
    }

    fun doCastSpell() {
        val sp = spells[activeSpellIdx]
        if (playerMana < sp.manaCost) return
        if (sp.hpCost > 0f && playerHp <= sp.hpCost + 5f) return
        playerMana -= sp.manaCost
        playerHp -= sp.hpCost

        val tx = playerX + cos(playerFacing) * 140f
        val ty = playerY + sin(playerFacing) * 140f

        when (sp.id) {
            "grav", "pyro", "runic" -> {
                val newZone = NativeSpellZone(regionId, tx, ty, 95f, sp.school, 6f, sp.power + level * 4)
                // Check Cross-School Graviturgy + Pyromancy Synergy!
                var synergyHit = false
                spellZones.filter { it.regionId == regionId }.forEach { ez ->
                    val isCombo = (ez.school == "Graviturgy" && sp.school == "Pyromancy") ||
                            (ez.school == "Pyromancy" && sp.school == "Graviturgy")
                    if (isCombo && hypot(ez.x - tx, ez.y - ty) < 170f) {
                        ez.synergyTriggered = true
                        newZone.synergyTriggered = true
                        synergyHit = true
                        worldBanner = "SYNERGY: SINGULARITY CONFLAGRATION!"
                        creatures.filter { it.regionId == regionId && it.hp > 0f }.forEach { c ->
                            if (hypot(c.x - tx, c.y - ty) < 180f) {
                                c.hp -= sp.power * 3
                            }
                        }
                    }
                }
                spellZones.add(newZone)
                NativeSynthAudio.playSpell(synergyHit)
            }
            "blood" -> {
                projectiles.add(
                    NativeProjectile(
                        regionId,
                        playerX,
                        playerY,
                        cos(playerFacing) * 440f,
                        sin(playerFacing) * 440f,
                        sp.power + level * 5,
                        true,
                        1.2f,
                        sp.colorHex
                    )
                )
                NativeSynthAudio.playSpell(false)
            }
            "vital" -> {
                playerHp = min(playerMaxHp, playerHp + sp.power + level * 6)
                NativeSynthAudio.playSpell(false)
            }
            "umbral" -> {
                dodgeTimer = 0.45f
                playerX = (playerX + cos(playerFacing) * 110f).coerceIn(40f, 1560f)
                playerY = (playerY + sin(playerFacing) * 110f).coerceIn(40f, 960f)
                NativeSynthAudio.playSpell(false)
            }
        }
    }

    fun doInteract() {
        // Check nearby NPC
        val nearNpc = npcs.firstOrNull { it.alive && it.regionId == regionId && hypot(it.x - playerX, it.y - playerY) < 90f }
        if (nearNpc != null) {
            selectedNpc = nearNpc
            dialogueLog = "“${nearNpc.belief} ${nearNpc.knownFact}”"
            activeModal = "DIALOGUE"
            return
        }
        // Check nearby corpse
        val nearCorpse = corpses.firstOrNull { !it.scavenged && it.regionId == regionId && hypot(it.x - playerX, it.y - playerY) < 85f }
        if (nearCorpse != null) {
            nearCorpse.scavenged = true
            ash += nearCorpse.ashValue
            starIron += 1
            worldBanner = "Looted ${nearCorpse.name} (+${nearCorpse.ashValue} Ash, +1 Star-Iron)"
            NativeSynthAudio.playParry()
        }
    }

    // 60FPS Native Choreographer Game Loop
    LaunchedEffect(screenState, activeModal) {
        var lastNanos = System.nanoTime()
        var aiTickAccum = 0f
        while (true) {
            withFrameNanos { now ->
                val dt = ((now - lastNanos) / 1_000_000_000f).coerceIn(0.001f, 0.05f)
                lastNanos = now

                if (screenState == "PLAYING" && activeModal == "NONE") {
                    if (consumeLight()) doAttack(false)
                    if (consumeHeavy()) doAttack(true)
                    if (consumeDodge() && playerStam >= 18f) {
                        playerStam -= 18f
                        dodgeTimer = 0.30f
                        NativeSynthAudio.playSwing(false)
                    }
                    if (consumeParry()) {
                        parryTimer = 0.28f
                        NativeSynthAudio.playParry()
                    }
                    if (consumeSpell()) doCastSpell()
                    if (consumeInteract()) doInteract()
                    if (consumeHeal() && flasks > 0) {
                        flasks -= 1
                        playerHp = min(playerMaxHp, playerHp + 75f)
                        NativeSynthAudio.playSpell(false)
                    }

                    if (dodgeTimer > 0f) dodgeTimer -= dt
                    if (parryTimer > 0f) parryTimer -= dt
                    if (slashTimer > 0f) slashTimer -= dt

                    playerStam = min(playerMaxStam, playerStam + 28f * dt)
                    playerMana = min(playerMaxMana, playerMana + 5f * dt)

                    var mx = hwStickX + touchMoveX
                    var my = hwStickY + touchMoveY
                    if (keysHeld.contains(KeyEvent.KEYCODE_W) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_UP)) my -= 1f
                    if (keysHeld.contains(KeyEvent.KEYCODE_S) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_DOWN)) my += 1f
                    if (keysHeld.contains(KeyEvent.KEYCODE_A) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_LEFT)) mx -= 1f
                    if (keysHeld.contains(KeyEvent.KEYCODE_D) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_RIGHT)) mx += 1f

                    val mag = hypot(mx, my)
                    if (mag > 0.05f) {
                        mx /= mag
                        my /= mag
                        playerFacing = atan2(my, mx)
                        val spd = if (dodgeTimer > 0f) 410f else 210f
                        playerX = (playerX + mx * spd * dt).coerceIn(40f, 1560f)
                        playerY = (playerY + my * spd * dt).coerceIn(40f, 960f)
                    }

                    // Portal transitions at East / West edges
                    if (playerX > 1520f) {
                        val order = listOf("oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible")
                        val nextIdx = (order.indexOf(regionId) + 1) % order.size
                        regionId = order[nextIdx]
                        playerX = 90f
                        npcs.filter { it.isCompanion && it.alive }.forEach {
                            it.regionId = regionId; it.x = 130f; it.y = playerY
                        }
                        worldBanner = "Entered ${regionNames[regionId]}"
                    } else if (playerX < 60f && regionId != "oakhaven") {
                        val order = listOf("oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible")
                        val prevIdx = max(0, order.indexOf(regionId) - 1)
                        regionId = order[prevIdx]
                        playerX = 1460f
                        npcs.filter { it.isCompanion && it.alive }.forEach {
                            it.regionId = regionId; it.x = 1420f; it.y = playerY
                        }
                        worldBanner = "Entered ${regionNames[regionId]}"
                    }

                    // Update Spell Zones
                    val zIter = spellZones.iterator()
                    while (zIter.hasNext()) {
                        val z = zIter.next()
                        z.duration -= dt
                        if (z.duration <= 0f) {
                            zIter.remove()
                        } else if (z.regionId == regionId) {
                            creatures.filter { it.regionId == regionId && it.hp > 0f }.forEach { c ->
                                val d = hypot(z.x - c.x, z.y - c.y)
                                if (d <= z.radius) {
                                    if (z.school == "Graviturgy") {
                                        c.x += ((z.x - c.x) / max(1f, d)) * 95f * dt
                                        c.y += ((z.y - c.y) / max(1f, d)) * 95f * dt
                                    }
                                    c.hp -= z.power * 0.6f * dt
                                }
                            }
                        }
                    }

                    // Update Projectiles & Runic Convergence Split ×3
                    val newProjs = mutableListOf<NativeProjectile>()
                    val pIter = projectiles.iterator()
                    while (pIter.hasNext()) {
                        val pr = pIter.next()
                        pr.x += pr.vx * dt
                        pr.y += pr.vy * dt
                        pr.life -= dt
                        if (pr.life <= 0f) {
                            pIter.remove()
                            continue
                        }
                        if (pr.isPlayer && !pr.runicSplit) {
                            val hitRune = spellZones.firstOrNull {
                                it.regionId == regionId && it.school == "Runic Sorcery" && hypot(pr.x - it.x, pr.y - it.y) <= it.radius
                            }
                            if (hitRune != null) {
                                pr.runicSplit = true
                                val baseAng = atan2(pr.vy, pr.vx)
                                val spd = hypot(pr.vx, pr.vy)
                                listOf(-0.25f, 0.25f).forEach { off ->
                                    newProjs.add(
                                        pr.copy(
                                            vx = cos(baseAng + off) * spd,
                                            vy = sin(baseAng + off) * spd,
                                            runicSplit = true,
                                            colorHex = 0xFFFEF08A
                                        )
                                    )
                                }
                                worldBanner = "SYNERGY: RUNIC CONVERGENCE SPLIT ×3!"
                            }
                        }
                        if (pr.isPlayer) {
                            val hitC = creatures.firstOrNull {
                                it.regionId == regionId && it.hp > 0f && hypot(pr.x - it.x, pr.y - it.y) <= 28f * it.scale
                            }
                            if (hitC != null) {
                                hitC.hp -= pr.damage
                                NativeSynthAudio.playHit(pr.runicSplit)
                                pIter.remove()
                            }
                        }
                    }
                    projectiles.addAll(newProjs)

                    // Autonomous Creatures & Boss AI
                    creatures.filter { it.regionId == regionId && it.hp > 0f }.forEach { c ->
                        if (c.isBoss) {
                            val ratio = c.hp / c.maxHp
                            if (ratio < 0.66f && c.bossPhase == 1) {
                                c.bossPhase = 2
                                c.damage = 72
                                worldBanner = "PHASE II: MALAKOR INVOKES GRAVITATIONAL COLLAPSE"
                            } else if (ratio < 0.33f && c.bossPhase == 2) {
                                c.bossPhase = 3
                                c.damage = 88
                                worldBanner = "PHASE III: SERAPHIC BLOOD-PYRE UNLEASHED"
                            }
                        }

                        val dPlayer = hypot(playerX - c.x, playerY - c.y)
                        if (c.role == "prey") {
                            if (dPlayer < 200f) {
                                val ang = atan2(c.y - playerY, c.x - playerX)
                                c.x = (c.x + cos(ang) * c.speed * dt).coerceIn(40f, 1560f)
                                c.y = (c.y + sin(ang) * c.speed * dt).coerceIn(40f, 960f)
                            }
                        } else if (c.role == "scavenger" && dPlayer > 220f) {
                            val cp = corpses.firstOrNull { !it.scavenged && it.regionId == regionId }
                            if (cp != null) {
                                val ang = atan2(cp.y - c.y, cp.x - c.x)
                                if (hypot(cp.x - c.x, cp.y - c.y) > 24f) {
                                    c.x += cos(ang) * c.speed * dt
                                    c.y += sin(ang) * c.speed * dt
                                } else {
                                    cp.scavenged = true
                                    c.maxHp += 50f
                                    c.hp = c.maxHp
                                    c.scale = min(1.5f, c.scale + 0.15f)
                                    worldBanner = "${c.name} devoured remains and mutated!"
                                }
                            }
                        } else if (dPlayer < 320f) {
                            val ang = atan2(playerY - c.y, playerX - c.x)
                            c.facing = ang
                            if (c.aiState == "windup") {
                                c.stateTimer -= dt
                                if (c.stateTimer <= 0f) {
                                    if (dPlayer <= c.attackRange + 22f) {
                                        if (parryTimer > 0f) {
                                            c.aiState = "recover"
                                            c.stateTimer = 2.0f
                                            worldBanner = "PARRIED ${c.name.uppercase()}!"
                                            NativeSynthAudio.playParry()
                                        } else if (dodgeTimer <= 0f) {
                                            playerHp -= c.damage
                                            NativeSynthAudio.playHit(false)
                                            if (playerHp <= 0f) {
                                                screenState = "DEATH"
                                            }
                                        }
                                    }
                                    c.aiState = "recover"
                                    c.stateTimer = 0.9f
                                }
                            } else if (c.aiState == "recover") {
                                c.stateTimer -= dt
                                if (c.stateTimer <= 0f) c.aiState = "patrol"
                            } else {
                                if (dPlayer <= c.attackRange) {
                                    c.aiState = "windup"
                                    c.stateTimer = 0.65f
                                } else {
                                    c.x += cos(ang) * c.speed * dt
                                    c.y += sin(ang) * c.speed * dt
                                }
                            }
                        }
                    }

                    // Companion AI (Sir Gideon or recruited NPC)
                    npcs.filter { it.alive && it.isCompanion && it.regionId == regionId }.forEach { comp ->
                        val target = creatures.firstOrNull { it.regionId == regionId && it.hp > 0f && it.role != "prey" }
                        if (target != null && hypot(target.x - comp.x, target.y - comp.y) < 260f) {
                            val ang = atan2(target.y - comp.y, target.x - comp.x)
                            if (hypot(target.x - comp.x, target.y - comp.y) > 55f) {
                                comp.x += cos(ang) * 150f * dt
                                comp.y += sin(ang) * 150f * dt
                            } else {
                                target.hp -= 28f * dt
                            }
                        } else if (hypot(playerX - comp.x, playerY - comp.y) > 75f) {
                            val ang = atan2(playerY - comp.y, playerX - comp.x)
                            comp.x += cos(ang) * 165f * dt
                            comp.y += sin(ang) * 165f * dt
                        }
                    }

                    // Macro AI Living World Tick
                    aiTickAccum += dt
                    if (aiTickAccum >= 8f) {
                        aiTickAccum = 0f
                        settlementFood = (settlementFood - 1.2f).coerceIn(10f, 100f)
                        if (settlementFood < 38f) {
                            val ver = npcs.firstOrNull { it.id == "verenice" }
                            if (ver != null && ver.regionId == "oakhaven") {
                                ver.regionId = "bramblewood"
                                ver.currentGoal = "Forage in Bramblewood"
                                ver.currentAction = "Gathering untainted roots in Bramblewood"
                                settlementFood += 10f
                                worldBanner = "AI World Event: Sister Verenice departed to forage in Bramblewood"
                            }
                        }
                    }
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // 1. NATIVE ANDROID HARDWARE-ACCELERATED 2D GAME CANVAS
        Canvas(modifier = Modifier.fillMaxSize()) {
            val vw = size.width
            val vh = size.height
            val camX = (playerX - vw / 2f).coerceIn(0f, max(0f, 1600f - vw))
            val camY = (playerY - vh / 2f).coerceIn(0f, max(0f, 1000f - vh))

            // Region Background
            val bgColor = when (regionId) {
                "bramblewood" -> Color(0xFF111C1A)
                "cathedral" -> Color(0xFF121626)
                "catacombs" -> Color(0xFF171319)
                "bastion" -> Color(0xFF211618)
                "crucible" -> Color(0xFF1C1222)
                else -> Color(0xFF161820)
            }
            drawRect(color = bgColor, size = size)

            // Grid flagstones
            val tile = 80f
            val cols = (1600f / tile).toInt()
            val rows = (1000f / tile).toInt()
            for (r in 0..rows) {
                for (c in 0..cols) {
                    if ((r + c) % 2 == 0) {
                        drawRect(
                            color = Color(0x14FFFFFF),
                            topLeft = Offset(c * tile - camX, r * tile - camY),
                            size = Size(tile - 4f, tile - 4f)
                        )
                    }
                }
            }

            // Ember Pyre Shrine at (700, 500)
            val sx = 700f - camX
            val sy = 500f - camY
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(Color(0x55F59E0B), Color.Transparent),
                    center = Offset(sx, sy),
                    radius = 220f
                ),
                radius = 220f,
                center = Offset(sx, sy)
            )
            drawRect(color = Color(0xFFF59E0B), topLeft = Offset(sx - 14f, sy - 14f), size = Size(28f, 28f))

            // Spell Zones
            spellZones.filter { it.regionId == regionId }.forEach { z ->
                val zx = z.x - camX
                val zy = z.y - camY
                val col = when {
                    z.synergyTriggered -> Color(0x99FEF08A)
                    z.school == "Graviturgy" -> Color(0x776366F1)
                    z.school == "Pyromancy" -> Color(0x77F97316)
                    else -> Color(0x77F59E0B)
                }
                drawCircle(color = col, radius = z.radius, center = Offset(zx, zy))
            }

            // Corpses
            corpses.filter { it.regionId == regionId && !it.scavenged }.forEach { cp ->
                drawCircle(
                    color = Color(0xFFBE123C),
                    radius = 14f,
                    center = Offset(cp.x - camX, cp.y - camY)
                )
            }

            // Creatures & Bosses
            creatures.filter { it.regionId == regionId && it.hp > 0f }.forEach { c ->
                val cx = c.x - camX
                val cy = c.y - camY
                val rad = 20f * c.scale
                if (c.aiState == "windup") {
                    drawCircle(
                        color = Color(0x55EF4444),
                        radius = c.attackRange,
                        center = Offset(cx, cy),
                        style = Stroke(width = 3f)
                    )
                }
                drawRect(
                    color = Color(c.colorHex),
                    topLeft = Offset(cx - rad, cy - rad),
                    size = Size(rad * 2f, rad * 2f)
                )
                // Health bar
                val hpRatio = (c.hp / c.maxHp).coerceIn(0f, 1f)
                drawRect(
                    color = Color(0xFF090A0F),
                    topLeft = Offset(cx - 28f, cy - rad - 14f),
                    size = Size(56f, 6f)
                )
                drawRect(
                    color = Color(0xFFEF4444),
                    topLeft = Offset(cx - 28f, cy - rad - 14f),
                    size = Size(56f * hpRatio, 6f)
                )
            }

            // Autonomous NPCs
            npcs.filter { it.alive && it.regionId == regionId }.forEach { n ->
                val nx = n.x - camX
                val ny = n.y - camY
                drawRect(
                    color = Color(n.cloakColor),
                    topLeft = Offset(nx - 14f, ny - 18f),
                    size = Size(28f, 36f)
                )
                drawCircle(color = Color(0xFFFDE68A), radius = 5f, center = Offset(nx, ny - 26f))
            }

            // Projectiles
            projectiles.filter { it.regionId == regionId }.forEach { pr ->
                drawCircle(
                    color = Color(pr.colorHex),
                    radius = 8f,
                    center = Offset(pr.x - camX, pr.y - camY)
                )
            }

            // Player Character
            val px = playerX - camX
            val py = playerY - camY
            drawRect(
                color = if (dodgeTimer > 0f) Color(0xFF38BDF8) else Color(0xFFE2E8F0),
                topLeft = Offset(px - 15f, py - 20f),
                size = Size(30f, 40f)
            )
            if (slashTimer > 0f) {
                drawCircle(
                    color = Color(0x88F59E0B),
                    radius = weapons[equippedWeaponIdx].reach,
                    center = Offset(px + cos(playerFacing) * 28f, py + sin(playerFacing) * 28f),
                    style = Stroke(width = 6f)
                )
            }
            if (parryTimer > 0f) {
                drawCircle(
                    color = Color(0xFFFDE047),
                    radius = 30f,
                    center = Offset(px, py),
                    style = Stroke(width = 4f)
                )
            }
        }

        // 2. TITLE SCREEN OVERLAY
        if (screenState == "TITLE") {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xD9090A0F))
                    .padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "ASHEN FIELDS",
                    color = Color(0xFFF59E0B),
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Serif
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "NATIVE ANDROID EDITION · AUTONOMOUS LIVING WORLD RPG",
                    color = Color(0xFFA8A29E),
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.height(24.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFFB45309), RoundedCornerShape(6.dp))
                            .border(1.dp, Color(0xFFF59E0B), RoundedCornerShape(6.dp))
                            .clickable { screenState = "PLAYING" }
                            .padding(horizontal = 28.dp, vertical = 14.dp)
                    ) {
                        Text("Enter the Ashen Fields", color = Color.White, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        // 3. LOW-OCCLUSION PERIMETER HUD & NATIVE TOUCH CONTROLS
        if (screenState == "PLAYING") {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(14.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Top Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    // Vitals Cluster
                    Column(
                        modifier = Modifier
                            .background(Color(0xCC11131A), RoundedCornerShape(6.dp))
                            .border(1.dp, Color(0xFF2E2A22), RoundedCornerShape(6.dp))
                            .padding(10.dp)
                    ) {
                        Text(
                            text = "HP ${playerHp.toInt()}/${playerMaxHp.toInt()} · ST ${playerStam.toInt()} · MP ${playerMana.toInt()}",
                            color = Color(0xFFFCA5A5),
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "${weapons[equippedWeaponIdx].name} +${weapons[equippedWeaponIdx].upgradeLevel} · $ash Ash · Flask ×$flasks",
                            color = Color(0xFFFDE68A),
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "Attuned Spell: ${spells[activeSpellIdx].name} (Tap to Cycle)",
                            color = Color(0xFF93C5FD),
                            fontSize = 11.sp,
                            modifier = Modifier.clickable {
                                activeSpellIdx = (activeSpellIdx + 1) % spells.size
                            }
                        )
                    }

                    // World Banner & Navigation Buttons
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            text = "${regionNames[regionId]} · Food ${settlementFood.toInt()}%",
                            color = Color(0xFFFBBF24),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(text = worldBanner, color = Color(0xFFD6D3D1), fontSize = 11.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("INVENTORY" to "Gear & Temper", "AI_WORLD" to "AI World", "MAP" to "Travel").forEach { (tab, label) ->
                                Box(
                                    modifier = Modifier
                                        .background(Color(0xCC1A1C26), RoundedCornerShape(4.dp))
                                        .border(1.dp, Color(0xFF3A342A), RoundedCornerShape(4.dp))
                                        .clickable { activeModal = if (activeModal == tab) "NONE" else tab }
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text(label, color = Color(0xFFE5E0D8), fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }

                // Bottom Row: Native Touch Joystick + 6 Combat Action Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    // Multi-Touch Drag Virtual Stick
                    Box(
                        modifier = Modifier
                            .size(128.dp)
                            .background(Color(0x8811131A), CircleShape)
                            .border(1.5.dp, Color(0xFF3F3A30), CircleShape)
                            .pointerInput(Unit) {
                                detectDragGestures(
                                    onDragEnd = { touchMoveX = 0f; touchMoveY = 0f },
                                    onDragCancel = { touchMoveX = 0f; touchMoveY = 0f },
                                    onDrag = { change, dragAmount ->
                                        change.consume()
                                        touchMoveX = (touchMoveX + dragAmount.x / 35f).coerceIn(-1f, 1f)
                                        touchMoveY = (touchMoveY + dragAmount.y / 35f).coerceIn(-1f, 1f)
                                    }
                                )
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Text("MOVE", color = Color(0xFFA8A29E), fontSize = 11.sp)
                    }

                    // Combat Action Cluster
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            NativeActionBtn("Strike", 0xFFB45309) { doAttack(false) }
                            NativeActionBtn("Heavy", 0xFF9F1239) { doAttack(true) }
                            NativeActionBtn("Dodge", 0xFF0369A1) {
                                if (playerStam >= 18f) {
                                    playerStam -= 18f; dodgeTimer = 0.30f; NativeSynthAudio.playSwing(false)
                                }
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            NativeActionBtn("Spell", 0xFF4338CA) { doCastSpell() }
                            NativeActionBtn("Parry", 0xFF3F3F46) {
                                parryTimer = 0.28f; NativeSynthAudio.playParry()
                            }
                            NativeActionBtn("Act/Heal", 0xFF065F46) {
                                doInteract()
                            }
                        }
                    }
                }
            }
        }

        // 4. NATIVE MODALS (INVENTORY, AI LIVING WORLD INSPECTOR, DIALOGUE, FAST TRAVEL)
        if (activeModal != "NONE") {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xD9090A0F))
                    .padding(24.dp)
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "ASHEN FIELDS · $activeModal",
                            color = Color(0xFFF59E0B),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF27241D), RoundedCornerShape(4.dp))
                                .clickable { activeModal = "NONE" }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text("Resume Game", color = Color.White, fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))

                    if (activeModal == "INVENTORY") {
                        Text(
                            "Star-Iron Fragments: $starIron · Sovereign Ash: $ash · Level $level",
                            color = Color(0xFFD6D3D1),
                            fontSize = 13.sp
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(weapons.indices.toList()) { idx ->
                                val w = weapons[idx]
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFF151720), RoundedCornerShape(6.dp))
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text("${w.name} +${w.upgradeLevel}", color = Color.White, fontWeight = FontWeight.SemiBold)
                                        Text("Category: ${w.category} · Base Dmg: ${w.baseDamage + w.upgradeLevel * 8}", color = Color(0xFFA8A29E), fontSize = 12.sp)
                                    }
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Box(
                                            modifier = Modifier
                                                .background(if (equippedWeaponIdx == idx) Color(0xFF065F46) else Color(0xFF27241D), RoundedCornerShape(4.dp))
                                                .clickable { equippedWeaponIdx = idx }
                                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text(if (equippedWeaponIdx == idx) "Equipped" else "Equip", color = Color.White, fontSize = 12.sp)
                                        }
                                        Box(
                                            modifier = Modifier
                                                .background(Color(0xFFB45309), RoundedCornerShape(4.dp))
                                                .clickable {
                                                    if (starIron >= 1 && ash >= 100 && w.upgradeLevel < 5) {
                                                        starIron -= 1
                                                        ash -= 100
                                                        weapons[idx] = w.copy(upgradeLevel = w.upgradeLevel + 1)
                                                        NativeSynthAudio.playParry()
                                                    }
                                                }
                                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text("Temper (+1)", color = Color.White, fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                    } else if (activeModal == "AI_WORLD") {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(npcs) { n ->
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFF151720), RoundedCornerShape(6.dp))
                                        .padding(12.dp)
                                ) {
                                    Text("${n.name} (${n.title}) · Region: ${regionNames[n.regionId]}", color = Color(0xFFFBBF24), fontWeight = FontWeight.SemiBold)
                                    Text("Goal: ${n.currentGoal} · Action: ${n.currentAction} · Trust: ${n.trust}", color = Color(0xFFD6D3D1), fontSize = 12.sp)
                                    Text("Epistemic Fact: “${n.knownFact}”", color = Color(0xFF93C5FD), fontSize = 11.sp)
                                }
                            }
                        }
                    } else if (activeModal == "DIALOGUE" && selectedNpc != null) {
                        val npc = selectedNpc!!
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("${npc.name} · ${npc.title}", color = Color(0xFFFBBF24), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            Text(dialogueLog, color = Color.White, fontSize = 14.sp)
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Box(
                                    modifier = Modifier
                                        .background(Color(0xFF065F46), RoundedCornerShape(4.dp))
                                        .clickable {
                                            npc.trust += 12
                                            dialogueLog = "“Your conviction honors the Vigil. Take this counsel: ${npc.knownFact}”"
                                        }
                                        .padding(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text("Persuade (+Trust)", color = Color.White, fontSize = 12.sp)
                                }
                                Box(
                                    modifier = Modifier
                                        .background(Color(0xFFB45309), RoundedCornerShape(4.dp))
                                        .clickable {
                                            npc.isCompanion = true
                                            dialogueLog = "“My blade is bound to yours, Sovereign Wanderer! I will fight beside you.”"
                                        }
                                        .padding(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text("Recruit Companion", color = Color.White, fontSize = 12.sp)
                                }
                            }
                        }
                    } else if (activeModal == "MAP") {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(regionNames.entries.toList()) { (rKey, rTitle) ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .background(Color(0xFF151720), RoundedCornerShape(6.dp))
                                        .clickable {
                                            regionId = rKey
                                            playerX = 700f
                                            playerY = 520f
                                            activeModal = "NONE"
                                            worldBanner = "Traversed Leyline to $rTitle"
                                        }
                                        .padding(14.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(rTitle, color = Color.White, fontWeight = FontWeight.SemiBold)
                                    Text("Fast Travel →", color = Color(0xFFF59E0B))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NativeActionBtn(label: String, colorHex: Long, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(54.dp)
            .background(Color(colorHex), CircleShape)
            .border(1.dp, Color(0x88FFFFFF), CircleShape)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
    }
}
