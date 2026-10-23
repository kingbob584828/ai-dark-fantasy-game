package com.ashenfields.rpg;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Bundle;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

/**
 * Ashen Fields — 100% Native Android 2D Dark Fantasy Action RPG Engine.
 * Built directly on hardware-accelerated android.graphics.Canvas & android.media.AudioTrack (Zero WebView).
 * Supports Multi-Touch Twin-Stick + Combat Cluster, Bluetooth/USB Gamepad Controllers, and Keyboards.
 */
public class MainActivity extends Activity {

    private AshenGameView gameView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        hideSystemUI();

        gameView = new AshenGameView(this);
        setContentView(gameView);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    // ==================== NATIVE ANDROID PCM SYNTHESIZER ====================
    static class SynthAudio {
        static void playTone(final double startFreq, final double endFreq, final int durationMs, final float volume) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int sampleRate = 22050;
                        int numSamples = (sampleRate * durationMs) / 1000;
                        short[] buffer = new short[numSamples];
                        double phase = 0.0;
                        for (int i = 0; i < numSamples; i++) {
                            double progress = (double) i / numSamples;
                            double freq = startFreq + (endFreq - startFreq) * progress;
                            double env = Math.pow(1.0 - progress, 1.4);
                            phase += 2.0 * Math.PI * freq / sampleRate;
                            int sample = (int) (Math.sin(phase) * env * volume * Short.MAX_VALUE);
                            if (sample > Short.MAX_VALUE) sample = Short.MAX_VALUE;
                            if (sample < Short.MIN_VALUE) sample = Short.MIN_VALUE;
                            buffer[i] = (short) sample;
                        }
                        AudioTrack track = new AudioTrack.Builder()
                                .setAudioAttributes(new AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_GAME)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                        .build())
                                .setAudioFormat(new AudioFormat.Builder()
                                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                                        .setSampleRate(sampleRate)
                                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                                        .build())
                                .setBufferSizeInBytes(buffer.length * 2)
                                .setTransferMode(AudioTrack.MODE_STATIC)
                                .build();
                        track.write(buffer, 0, buffer.length);
                        track.play();
                        Thread.sleep(durationMs + 40L);
                        track.release();
                    } catch (Exception ignored) {
                    }
                }
            }).start();
        }

        static void playSwing(boolean heavy) {
            playTone(heavy ? 180.0 : 280.0, 52.0, heavy ? 210 : 130, 0.28f);
        }

        static void playHit(boolean crit) {
            playTone(crit ? 160.0 : 110.0, 32.0, crit ? 260 : 160, 0.35f);
        }

        static void playParry() {
            playTone(880.0, 1320.0, 320, 0.30f);
        }

        static void playSpell(boolean synergy) {
            playTone(synergy ? 360.0 : 220.0, synergy ? 48.0 : 440.0, synergy ? 480 : 280, 0.32f);
        }
    }

    // ==================== GAME ENTITIES ====================
    static class Weapon {
        String name;
        String category;
        int baseDamage;
        float reach;
        float staminaCost;
        int upgradeLevel;

        Weapon(String name, String category, int baseDamage, float reach, float staminaCost) {
            this.name = name;
            this.category = category;
            this.baseDamage = baseDamage;
            this.reach = reach;
            this.staminaCost = staminaCost;
            this.upgradeLevel = 0;
        }
    }

    static class Spell {
        String id;
        String name;
        String school;
        float manaCost;
        float hpCost;
        int power;
        int color;

        Spell(String id, String name, String school, float manaCost, float hpCost, int power, int color) {
            this.id = id;
            this.name = name;
            this.school = school;
            this.manaCost = manaCost;
            this.hpCost = hpCost;
            this.power = power;
            this.color = color;
        }
    }

    static class NPC {
        String id;
        String name;
        String title;
        String regionId;
        float x, y;
        boolean alive = true;
        boolean isCompanion = false;
        String currentGoal;
        String currentAction;
        int trust;
        String belief;
        String knownFact;
        int cloakColor;

        NPC(String id, String name, String title, String regionId, float x, float y,
            String currentGoal, String currentAction, int trust, String belief, String knownFact, int cloakColor) {
            this.id = id;
            this.name = name;
            this.title = title;
            this.regionId = regionId;
            this.x = x;
            this.y = y;
            this.currentGoal = currentGoal;
            this.currentAction = currentAction;
            this.trust = trust;
            this.belief = belief;
            this.knownFact = knownFact;
            this.cloakColor = cloakColor;
        }
    }

    static class Creature {
        String name;
        String role; // prey, predator, scavenger, guard, miniboss, boss
        String regionId;
        float x, y;
        float hp, maxHp;
        int damage;
        float speed;
        float attackRange;
        String aiState = "patrol";
        float stateTimer = 0f;
        int ashReward;
        int color;
        float scale;
        boolean isBoss;
        int bossPhase = 1;

        Creature(String name, String role, String regionId, float x, float y, float maxHp,
                 int damage, float speed, float attackRange, int ashReward, int color, float scale, boolean isBoss) {
            this.name = name;
            this.role = role;
            this.regionId = regionId;
            this.x = x;
            this.y = y;
            this.hp = maxHp;
            this.maxHp = maxHp;
            this.damage = damage;
            this.speed = speed;
            this.attackRange = attackRange;
            this.ashReward = ashReward;
            this.color = color;
            this.scale = scale;
            this.isBoss = isBoss;
        }
    }

    static class SpellZone {
        String regionId;
        float x, y, radius;
        String school;
        float duration;
        int power;
        boolean synergyTriggered = false;

        SpellZone(String regionId, float x, float y, float radius, String school, float duration, int power) {
            this.regionId = regionId;
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.school = school;
            this.duration = duration;
            this.power = power;
        }
    }

    static class Projectile {
        String regionId;
        float x, y, vx, vy;
        int damage;
        float life;
        int color;
        boolean runicSplit = false;

        Projectile(String regionId, float x, float y, float vx, float vy, int damage, float life, int color) {
            this.regionId = regionId;
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.damage = damage;
            this.life = life;
            this.color = color;
        }
    }

    static class Corpse {
        String regionId;
        float x, y;
        String name;
        int ashValue;
        boolean scavenged = false;

        Corpse(String regionId, float x, float y, String name, int ashValue) {
            this.regionId = regionId;
            this.x = x;
            this.y = y;
            this.name = name;
            this.ashValue = ashValue;
        }
    }

    // ==================== NATIVE 60FPS HARDWARE-ACCELERATED GAME VIEW ====================
    static class AshenGameView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF rect = new RectF();
        private long lastTimeNanos = System.nanoTime();
        private float aiTickAccum = 0f;

        private String screenState = "TITLE"; // TITLE, PLAYING, DEATH, VICTORY
        private String activeModal = "NONE";  // NONE, INVENTORY, AI_WORLD, DIALOGUE, MAP
        private String regionId = "oakhaven";

        private final String[] regionKeys = {"oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible"};
        private final String[] regionTitles = {
                "Oakhaven Vigil",
                "Weeping Bramblewood",
                "Cathedral of the Sunken Choir",
                "Ossuary of the First Synod",
                "Ironmire Bastion",
                "The Ashen Crucible"
        };

        // Player state
        private int level = 1;
        private int ash = 220;
        private int flasks = 4;
        private int starIron = 2;
        private float playerHp = 260f, playerMaxHp = 260f;
        private float playerStam = 180f, playerMaxStam = 180f;
        private float playerMana = 160f, playerMaxMana = 160f;
        private float playerX = 700f, playerY = 520f;
        private float playerFacing = 0f;
        private float dodgeTimer = 0f, parryTimer = 0f, slashTimer = 0f;

        private float settlementFood = 58f;
        private String worldBanner = "Oakhaven Vigil · The First Ember Flickers";

        // Input state (Touch + Gamepad + Keyboard)
        private float touchMoveX = 0f, touchMoveY = 0f;
        private float hwStickX = 0f, hwStickY = 0f;
        private int joyPointerId = -1;
        private float joyCenterX = 0f, joyCenterY = 0f;
        private final Set<Integer> keysHeld = new HashSet<>();

        private final List<Weapon> weapons = new ArrayList<>();
        private int equippedWeaponIdx = 0;

        private final List<Spell> spells = new ArrayList<>();
        private int activeSpellIdx = 0;

        private final List<NPC> npcs = new ArrayList<>();
        private NPC selectedNpc = null;
        private String dialogueText = "";

        private final List<Creature> creatures = new ArrayList<>();
        private final List<SpellZone> spellZones = new ArrayList<>();
        private final List<Projectile> projectiles = new ArrayList<>();
        private final List<Corpse> corpses = new ArrayList<>();

        AshenGameView(Context context) {
            super(context);
            setFocusable(true);
            setFocusableInTouchMode(true);
            initWorld();
        }

        private void initWorld() {
            weapons.clear();
            weapons.add(new Weapon("Vigilant Broadsword", "Sword", 38, 80f, 14f));
            weapons.add(new Weapon("Penitent Greatsword", "Greatsword", 66, 105f, 24f));
            weapons.add(new Weapon("Whispering Misericorde", "Dagger", 28, 56f, 8f));
            weapons.add(new Weapon("Choir-Guard Partisan", "Spear", 46, 115f, 16f));
            weapons.add(new Weapon("Astral Choir Catalyst", "Catalyst", 26, 85f, 11f));

            spells.clear();
            spells.add(new Spell("grav", "Singularity Well", "Graviturgy", 22f, 0f, 34, Color.rgb(99, 102, 241)));
            spells.add(new Spell("pyro", "Cinder Tempest", "Pyromancy", 20f, 0f, 40, Color.rgb(249, 115, 22)));
            spells.add(new Spell("runic", "Sigil of Convergence", "Runic Sorcery", 16f, 0f, 28, Color.rgb(245, 158, 11)));
            spells.add(new Spell("blood", "Sanguine Lance", "Bloodcraft", 8f, 18f, 70, Color.rgb(225, 29, 72)));
            spells.add(new Spell("vital", "Verdant Suture", "Vitalism", 24f, 0f, 62, Color.rgb(16, 185, 129)));
            spells.add(new Spell("umbral", "Umbral Phantom Step", "Umbral Arts", 18f, 0f, 30, Color.rgb(56, 189, 248)));

            npcs.clear();
            npcs.add(new NPC("verenice", "Sister Verenice", "Keeper of the Hearth-Ash", "oakhaven", 640f, 440f,
                    "Preserve Supplies", "Tending the First Ember Pyre", 30,
                    "Only the warmth of the First Ember saves our souls.",
                    "The Sacred Chalice rests in the Sunken Cathedral.", Color.rgb(153, 27, 27)));
            npcs.add(new NPC("korvak", "Blacksmith Korvak", "Iron-Forger", "oakhaven", 500f, 560f,
                    "Forge Star-Iron", "Hammering star-iron at the anvil", 25,
                    "Only star-tempered steel keeps a breath in your ribs.",
                    "Vane sold my apprentice Tomas a trapped crypt map!", Color.rgb(87, 83, 78)));
            npcs.add(new NPC("vane", "Vane the Crow-Tongue", "Relic Broker", "oakhaven", 920f, 560f,
                    "Maximize Profit", "Appraising scavenged relics", 5,
                    "Empires burn; the clever walk away with the silver.",
                    "A lever in the Catacombs unlocks the Oakhaven shortcut.", Color.rgb(30, 41, 59)));
            npcs.add(new NPC("gideon", "Sir Gideon of the Ash", "Penitent Paladin", "oakhaven", 780f, 360f,
                    "Purge Bastion", "Standing watch near the North Gate", 35,
                    "A knight's oath never burns out.",
                    "Recruit me and my halberd will fight beside you across all regions!", Color.rgb(180, 83, 9)));
            npcs.add(new NPC("lyra", "Lyra the Blight-Seer", "Choir Scholar", "bramblewood", 480f, 520f,
                    "Decode Runes", "Sampling luminescent spores", 25,
                    "Graviturgy and Runes are a new grammar of creation.",
                    "Fire Sanguine Lance through a Runic Sigil to split it in three!", Color.rgb(49, 46, 129)));
            npcs.add(new NPC("vael", "Commander Vael", "Cinder Marshal", "bastion", 500f, 740f,
                    "Seize Bastion", "Directing Siege Trench defenses", 20,
                    "Ironmire Bastion is the lock on the Crucible.",
                    "Malakor fights in three deadly phases inside the Crucible.", Color.rgb(124, 45, 18)));
            npcs.add(new NPC("malrik", "Whisperer Malrik", "Synod Envoy", "bastion", 1100f, 740f,
                    "Umbral Eclipse", "Coordinating Synod Blood-Knights", 10,
                    "The First Ember is a rotting lie; embrace the Eclipse.",
                    "The Synod rewards those who extinguish the Choir's light.", Color.rgb(15, 23, 42)));

            resetCreatures();

            corpses.clear();
            corpses.add(new Corpse("bramblewood", 620f, 760f, "Fallen Oakhaven Forager", 70));
            corpses.add(new Corpse("catacombs", 480f, 540f, "Apprentice Tomas's Remains", 120));
        }

        private void resetCreatures() {
            creatures.clear();
            creatures.add(new Creature("Ashen White-Stag", "prey", "bramblewood", 460f, 720f, 65f, 10, 130f, 45f, 40, Color.rgb(231, 229, 228), 1.0f, false));
            creatures.add(new Creature("Blight-Maw Hound", "predator", "bramblewood", 760f, 580f, 105f, 24, 148f, 58f, 75, Color.rgb(153, 27, 27), 1.0f, false));
            creatures.add(new Creature("Marrow-Gorged Ghoul", "scavenger", "bramblewood", 880f, 820f, 120f, 26, 125f, 56f, 85, Color.rgb(77, 124, 15), 1.05f, false));
            creatures.add(new Creature("Vaelen, Blighted Stag-Lord", "miniboss", "bramblewood", 1220f, 520f, 360f, 42, 140f, 82f, 420, Color.rgb(16, 185, 129), 1.45f, false));

            creatures.add(new Creature("Astral Choir Warden", "guard", "cathedral", 720f, 520f, 155f, 34, 120f, 70f, 120, Color.rgb(99, 102, 241), 1.1f, false));
            creatures.add(new Creature("Arch-Cantor Oakhart", "miniboss", "cathedral", 1180f, 520f, 440f, 48, 126f, 86f, 550, Color.rgb(139, 92, 246), 1.5f, false));

            creatures.add(new Creature("Synod Bone-Sentinel", "guard", "catacombs", 680f, 480f, 150f, 35, 124f, 66f, 115, Color.rgb(214, 211, 209), 1.1f, false));
            creatures.add(new Creature("Crypt Corpse-Eater", "scavenger", "catacombs", 940f, 660f, 140f, 32, 134f, 58f, 110, Color.rgb(101, 163, 13), 1.1f, false));

            creatures.add(new Creature("Cinder Covenant Templar", "guard", "bastion", 680f, 520f, 190f, 36, 126f, 68f, 130, Color.rgb(234, 88, 12), 1.15f, false));
            creatures.add(new Creature("Umbral Synod Blood-Knight", "guard", "bastion", 980f, 520f, 195f, 38, 132f, 68f, 135, Color.rgb(225, 29, 72), 1.15f, false));

            creatures.add(new Creature("Malakor, the Hollowed Seraph", "boss", "crucible", 850f, 520f, 1100f, 58, 138f, 105f, 2500, Color.rgb(245, 158, 11), 1.9f, true));
        }

        private String getRegionTitle(String key) {
            for (int i = 0; i < regionKeys.length; i++) {
                if (regionKeys[i].equals(key)) return regionTitles[i];
            }
            return "Ashen Fields";
        }

        private void doAttack(boolean heavy) {
            Weapon wpn = weapons.get(equippedWeaponIdx);
            float cost = wpn.staminaCost * (heavy ? 1.5f : 1.0f);
            if (playerStam < cost) return;
            playerStam -= cost;
            slashTimer = 0.22f;
            SynthAudio.playSwing(heavy);

            int dmg = (int) ((wpn.baseDamage + wpn.upgradeLevel * 8 + level * 3) * (heavy ? 1.55f : 1.0f));
            float reach = wpn.reach * (heavy ? 1.2f : 1.0f);

            for (Creature c : creatures) {
                if (!c.regionId.equals(regionId) || c.hp <= 0f) continue;
                float d = (float) Math.hypot(c.x - playerX, c.y - playerY);
                if (d <= reach + 24f * c.scale) {
                    c.hp -= dmg;
                    SynthAudio.playHit(heavy);
                    if (c.hp <= 0f) {
                        ash += c.ashReward;
                        corpses.add(new Corpse(regionId, c.x, c.y, "Remains of " + c.name, c.ashReward / 3));
                        if (c.isBoss) {
                            screenState = "VICTORY";
                        }
                    }
                }
            }
        }

        private void doCastSpell() {
            Spell sp = spells.get(activeSpellIdx);
            if (playerMana < sp.manaCost) return;
            if (sp.hpCost > 0f && playerHp <= sp.hpCost + 5f) return;
            playerMana -= sp.manaCost;
            playerHp -= sp.hpCost;

            float tx = playerX + (float) Math.cos(playerFacing) * 140f;
            float ty = playerY + (float) Math.sin(playerFacing) * 140f;

            if (sp.id.equals("grav") || sp.id.equals("pyro") || sp.id.equals("runic")) {
                SpellZone newZone = new SpellZone(regionId, tx, ty, 95f, sp.school, 6f, sp.power + level * 4);
                boolean synergyHit = false;
                for (SpellZone ez : spellZones) {
                    if (!ez.regionId.equals(regionId)) continue;
                    boolean isCombo = (ez.school.equals("Graviturgy") && sp.school.equals("Pyromancy"))
                            || (ez.school.equals("Pyromancy") && sp.school.equals("Graviturgy"));
                    if (isCombo && Math.hypot(ez.x - tx, ez.y - ty) < 170f) {
                        ez.synergyTriggered = true;
                        newZone.synergyTriggered = true;
                        synergyHit = true;
                        worldBanner = "SYNERGY: SINGULARITY CONFLAGRATION!";
                        for (Creature c : creatures) {
                            if (c.regionId.equals(regionId) && c.hp > 0f && Math.hypot(c.x - tx, c.y - ty) < 185f) {
                                c.hp -= sp.power * 3;
                            }
                        }
                    }
                }
                spellZones.add(newZone);
                SynthAudio.playSpell(synergyHit);
            } else if (sp.id.equals("blood")) {
                projectiles.add(new Projectile(
                        regionId, playerX, playerY,
                        (float) Math.cos(playerFacing) * 440f,
                        (float) Math.sin(playerFacing) * 440f,
                        sp.power + level * 5, 1.2f, sp.color
                ));
                SynthAudio.playSpell(false);
            } else if (sp.id.equals("vital")) {
                playerHp = Math.min(playerMaxHp, playerHp + sp.power + level * 6);
                SynthAudio.playSpell(false);
            } else if (sp.id.equals("umbral")) {
                dodgeTimer = 0.45f;
                playerX = Math.max(40f, Math.min(1560f, playerX + (float) Math.cos(playerFacing) * 110f));
                playerY = Math.max(40f, Math.min(960f, playerY + (float) Math.sin(playerFacing) * 110f));
                SynthAudio.playSpell(false);
            }
        }

        private void doInteract() {
            for (NPC n : npcs) {
                if (n.alive && n.regionId.equals(regionId) && Math.hypot(n.x - playerX, n.y - playerY) < 95f) {
                    selectedNpc = n;
                    dialogueText = "\"" + n.belief + " " + n.knownFact + "\"";
                    activeModal = "DIALOGUE";
                    return;
                }
            }
            for (Corpse cp : corpses) {
                if (!cp.scavenged && cp.regionId.equals(regionId) && Math.hypot(cp.x - playerX, cp.y - playerY) < 90f) {
                    cp.scavenged = true;
                    ash += cp.ashValue;
                    starIron += 1;
                    worldBanner = "Looted " + cp.name + " (+" + cp.ashValue + " Ash, +1 Star-Iron)";
                    SynthAudio.playParry();
                    return;
                }
            }
            if (flasks > 0 && playerHp < playerMaxHp) {
                flasks -= 1;
                playerHp = Math.min(playerMaxHp, playerHp + 75f);
                worldBanner = "Used Crimson Cinder Draught (+75 HP)";
                SynthAudio.playSpell(false);
            }
        }

        private void updateSimulation(float dt) {
            if (!screenState.equals("PLAYING") || !activeModal.equals("NONE")) return;

            if (dodgeTimer > 0f) dodgeTimer -= dt;
            if (parryTimer > 0f) parryTimer -= dt;
            if (slashTimer > 0f) slashTimer -= dt;

            playerStam = Math.min(playerMaxStam, playerStam + 28f * dt);
            playerMana = Math.min(playerMaxMana, playerMana + 5f * dt);

            float mx = hwStickX + touchMoveX;
            float my = hwStickY + touchMoveY;
            if (keysHeld.contains(KeyEvent.KEYCODE_W) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_UP)) my -= 1f;
            if (keysHeld.contains(KeyEvent.KEYCODE_S) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_DOWN)) my += 1f;
            if (keysHeld.contains(KeyEvent.KEYCODE_A) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_LEFT)) mx -= 1f;
            if (keysHeld.contains(KeyEvent.KEYCODE_D) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_RIGHT)) mx += 1f;

            float mag = (float) Math.hypot(mx, my);
            if (mag > 0.05f) {
                mx /= mag;
                my /= mag;
                playerFacing = (float) Math.atan2(my, mx);
                float spd = dodgeTimer > 0f ? 410f : 210f;
                playerX = Math.max(40f, Math.min(1560f, playerX + mx * spd * dt));
                playerY = Math.max(40f, Math.min(960f, playerY + my * spd * dt));
            }

            // Region portal transitions at East / West edges
            if (playerX > 1520f) {
                int idx = 0;
                for (int i = 0; i < regionKeys.length; i++) {
                    if (regionKeys[i].equals(regionId)) idx = i;
                }
                regionId = regionKeys[(idx + 1) % regionKeys.length];
                playerX = 90f;
                for (NPC n : npcs) {
                    if (n.isCompanion && n.alive) {
                        n.regionId = regionId;
                        n.x = 130f;
                        n.y = playerY;
                    }
                }
                worldBanner = "Entered " + getRegionTitle(regionId);
            } else if (playerX < 60f && !regionId.equals("oakhaven")) {
                int idx = 0;
                for (int i = 0; i < regionKeys.length; i++) {
                    if (regionKeys[i].equals(regionId)) idx = i;
                }
                regionId = regionKeys[Math.max(0, idx - 1)];
                playerX = 1460f;
                for (NPC n : npcs) {
                    if (n.isCompanion && n.alive) {
                        n.regionId = regionId;
                        n.x = 1420f;
                        n.y = playerY;
                    }
                }
                worldBanner = "Entered " + getRegionTitle(regionId);
            }

            // Update Spell Zones
            Iterator<SpellZone> zIt = spellZones.iterator();
            while (zIt.hasNext()) {
                SpellZone z = zIt.next();
                z.duration -= dt;
                if (z.duration <= 0f) {
                    zIt.remove();
                } else if (z.regionId.equals(regionId)) {
                    for (Creature c : creatures) {
                        if (!c.regionId.equals(regionId) || c.hp <= 0f) continue;
                        float d = (float) Math.hypot(z.x - c.x, z.y - c.y);
                        if (d <= z.radius) {
                            if (z.school.equals("Graviturgy")) {
                                c.x += ((z.x - c.x) / Math.max(1f, d)) * 95f * dt;
                                c.y += ((z.y - c.y) / Math.max(1f, d)) * 95f * dt;
                            }
                            c.hp -= z.power * 0.6f * dt;
                        }
                    }
                }
            }

            // Update Projectiles & Runic Convergence Split ×3
            List<Projectile> splitAdded = new ArrayList<>();
            Iterator<Projectile> pIt = projectiles.iterator();
            while (pIt.hasNext()) {
                Projectile pr = pIt.next();
                pr.x += pr.vx * dt;
                pr.y += pr.vy * dt;
                pr.life -= dt;
                if (pr.life <= 0f) {
                    pIt.remove();
                    continue;
                }
                if (!pr.runicSplit) {
                    for (SpellZone z : spellZones) {
                        if (z.regionId.equals(regionId) && z.school.equals("Runic Sorcery")
                                && Math.hypot(pr.x - z.x, pr.y - z.y) <= z.radius) {
                            pr.runicSplit = true;
                            float baseAng = (float) Math.atan2(pr.vy, pr.vx);
                            float spd = (float) Math.hypot(pr.vx, pr.vy);
                            float[] offsets = {-0.25f, 0.25f};
                            for (float off : offsets) {
                                Projectile child = new Projectile(
                                        regionId, pr.x, pr.y,
                                        (float) Math.cos(baseAng + off) * spd,
                                        (float) Math.sin(baseAng + off) * spd,
                                        pr.damage, pr.life, Color.rgb(254, 240, 138)
                                );
                                child.runicSplit = true;
                                splitAdded.add(child);
                            }
                            worldBanner = "SYNERGY: RUNIC CONVERGENCE SPLIT ×3!";
                            break;
                        }
                    }
                }
                for (Creature c : creatures) {
                    if (c.regionId.equals(regionId) && c.hp > 0f
                            && Math.hypot(pr.x - c.x, pr.y - c.y) <= 28f * c.scale) {
                        c.hp -= pr.damage;
                        SynthAudio.playHit(pr.runicSplit);
                        pIt.remove();
                        break;
                    }
                }
            }
            projectiles.addAll(splitAdded);

            // Autonomous Creature Ecology & Boss AI
            for (Creature c : creatures) {
                if (!c.regionId.equals(regionId) || c.hp <= 0f) continue;

                if (c.isBoss) {
                    float ratio = c.hp / c.maxHp;
                    if (ratio < 0.66f && c.bossPhase == 1) {
                        c.bossPhase = 2;
                        c.damage = 72;
                        worldBanner = "PHASE II: MALAKOR INVOKES GRAVITATIONAL COLLAPSE";
                    } else if (ratio < 0.33f && c.bossPhase == 2) {
                        c.bossPhase = 3;
                        c.damage = 88;
                        worldBanner = "PHASE III: SERAPHIC BLOOD-PYRE UNLEASHED";
                    }
                }

                float dPlayer = (float) Math.hypot(playerX - c.x, playerY - c.y);
                if (c.role.equals("prey")) {
                    if (dPlayer < 200f) {
                        float ang = (float) Math.atan2(c.y - playerY, c.x - playerX);
                        c.x = Math.max(40f, Math.min(1560f, c.x + (float) Math.cos(ang) * c.speed * dt));
                        c.y = Math.max(40f, Math.min(960f, c.y + (float) Math.sin(ang) * c.speed * dt));
                    }
                } else if (c.role.equals("scavenger") && dPlayer > 220f) {
                    for (Corpse cp : corpses) {
                        if (!cp.scavenged && cp.regionId.equals(regionId)) {
                            float ang = (float) Math.atan2(cp.y - c.y, cp.x - c.x);
                            if (Math.hypot(cp.x - c.x, cp.y - c.y) > 24f) {
                                c.x += (float) Math.cos(ang) * c.speed * dt;
                                c.y += (float) Math.sin(ang) * c.speed * dt;
                            } else {
                                cp.scavenged = true;
                                c.maxHp += 50f;
                                c.hp = c.maxHp;
                                c.scale = Math.min(1.5f, c.scale + 0.15f);
                                worldBanner = c.name + " devoured remains and mutated!";
                            }
                            break;
                        }
                    }
                } else if (dPlayer < 330f) {
                    float ang = (float) Math.atan2(playerY - c.y, playerX - c.x);
                    if (c.aiState.equals("windup")) {
                        c.stateTimer -= dt;
                        if (c.stateTimer <= 0f) {
                            if (dPlayer <= c.attackRange + 22f) {
                                if (parryTimer > 0f) {
                                    c.aiState = "recover";
                                    c.stateTimer = 2.0f;
                                    worldBanner = "PARRIED " + c.name.toUpperCase() + "!";
                                    SynthAudio.playParry();
                                } else if (dodgeTimer <= 0f) {
                                    playerHp -= c.damage;
                                    SynthAudio.playHit(false);
                                    if (playerHp <= 0f) {
                                        screenState = "DEATH";
                                    }
                                }
                            }
                            c.aiState = "recover";
                            c.stateTimer = 0.9f;
                        }
                    } else if (c.aiState.equals("recover")) {
                        c.stateTimer -= dt;
                        if (c.stateTimer <= 0f) c.aiState = "patrol";
                    } else {
                        if (dPlayer <= c.attackRange) {
                            c.aiState = "windup";
                            c.stateTimer = 0.65f;
                        } else {
                            c.x += (float) Math.cos(ang) * c.speed * dt;
                            c.y += (float) Math.sin(ang) * c.speed * dt;
                        }
                    }
                }
            }

            // Companion AI
            for (NPC comp : npcs) {
                if (!comp.alive || !comp.isCompanion || !comp.regionId.equals(regionId)) continue;
                Creature nearest = null;
                float bestD = 260f;
                for (Creature c : creatures) {
                    if (c.regionId.equals(regionId) && c.hp > 0f && !c.role.equals("prey")) {
                        float d = (float) Math.hypot(c.x - comp.x, c.y - comp.y);
                        if (d < bestD) {
                            bestD = d;
                            nearest = c;
                        }
                    }
                }
                if (nearest != null) {
                    float ang = (float) Math.atan2(nearest.y - comp.y, nearest.x - comp.x);
                    if (bestD > 55f) {
                        comp.x += (float) Math.cos(ang) * 150f * dt;
                        comp.y += (float) Math.sin(ang) * 150f * dt;
                    } else {
                        nearest.hp -= 30f * dt;
                    }
                } else if (Math.hypot(playerX - comp.x, playerY - comp.y) > 75f) {
                    float ang = (float) Math.atan2(playerY - comp.y, playerX - comp.x);
                    comp.x += (float) Math.cos(ang) * 165f * dt;
                    comp.y += (float) Math.sin(ang) * 165f * dt;
                }
            }

            // Macro AI Living World Tick
            aiTickAccum += dt;
            if (aiTickAccum >= 8f) {
                aiTickAccum = 0f;
                settlementFood = Math.max(10f, Math.min(100f, settlementFood - 1.2f));
                if (settlementFood < 38f) {
                    for (NPC n : npcs) {
                        if (n.id.equals("verenice") && n.regionId.equals("oakhaven")) {
                            n.regionId = "bramblewood";
                            n.currentGoal = "Forage in Bramblewood";
                            n.currentAction = "Gathering untainted roots in Bramblewood";
                            settlementFood += 12f;
                            worldBanner = "AI World Event: Sister Verenice departed to forage in Bramblewood";
                        }
                    }
                }
            }
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            long now = System.nanoTime();
            float dt = (now - lastTimeNanos) / 1_000_000_000f;
            if (dt > 0.05f) dt = 0.05f;
            lastTimeNanos = now;

            updateSimulation(dt);

            int vw = getWidth();
            int vh = getHeight();
            float camX = Math.max(0f, Math.min(Math.max(0f, 1600f - vw), playerX - vw / 2f));
            float camY = Math.max(0f, Math.min(Math.max(0f, 1000f - vh), playerY - vh / 2f));

            // 1. Region Floor Backdrop
            if (regionId.equals("bramblewood")) canvas.drawColor(Color.rgb(17, 28, 26));
            else if (regionId.equals("cathedral")) canvas.drawColor(Color.rgb(18, 22, 38));
            else if (regionId.equals("catacombs")) canvas.drawColor(Color.rgb(23, 19, 25));
            else if (regionId.equals("bastion")) canvas.drawColor(Color.rgb(33, 22, 24));
            else if (regionId.equals("crucible")) canvas.drawColor(Color.rgb(28, 18, 34));
            else canvas.drawColor(Color.rgb(22, 24, 32));

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.argb(18, 255, 255, 255));
            for (int r = 0; r <= 12; r++) {
                for (int c = 0; c <= 20; c++) {
                    if ((r + c) % 2 == 0) {
                        float tx = c * 80f - camX;
                        float ty = r * 80f - camY;
                        canvas.drawRect(tx, ty, tx + 76f, ty + 76f, paint);
                    }
                }
            }

            // 2. First Ember Pyre Shrine & Warm Torchlight Radial Gradient
            float sx = 700f - camX;
            float sy = 500f - camY;
            paint.setShader(new RadialGradient(
                    sx, sy, 230f,
                    Color.argb(95, 245, 158, 11),
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
            ));
            canvas.drawCircle(sx, sy, 230f, paint);
            paint.setShader(null);
            paint.setColor(Color.rgb(245, 158, 11));
            canvas.drawRect(sx - 15f, sy - 15f, sx + 15f, sy + 15f, paint);

            // 3. Active Spell Zones
            for (SpellZone z : spellZones) {
                if (!z.regionId.equals(regionId)) continue;
                paint.setColor(z.synergyTriggered ? Color.argb(150, 254, 240, 138)
                        : z.school.equals("Graviturgy") ? Color.argb(120, 99, 102, 241)
                        : z.school.equals("Pyromancy") ? Color.argb(120, 249, 115, 22)
                        : Color.argb(120, 245, 158, 11));
                canvas.drawCircle(z.x - camX, z.y - camY, z.radius, paint);
            }

            // 4. Corpses
            for (Corpse cp : corpses) {
                if (!cp.regionId.equals(regionId) || cp.scavenged) continue;
                paint.setColor(Color.rgb(190, 18, 60));
                canvas.drawCircle(cp.x - camX, cp.y - camY, 14f, paint);
            }

            // 5. Autonomous Creatures & Bosses
            for (Creature c : creatures) {
                if (!c.regionId.equals(regionId) || c.hp <= 0f) continue;
                float cx = c.x - camX;
                float cy = c.y - camY;
                float rad = 20f * c.scale;

                if (c.aiState.equals("windup")) {
                    paint.setStyle(Paint.Style.STROKE);
                    paint.setStrokeWidth(4f);
                    paint.setColor(Color.argb(160, 239, 68, 68));
                    canvas.drawCircle(cx, cy, c.attackRange, paint);
                    paint.setStyle(Paint.Style.FILL);
                }

                paint.setColor(c.color);
                canvas.drawRect(cx - rad, cy - rad, cx + rad, cy + rad, paint);

                // Health bar
                float ratio = Math.max(0f, Math.min(1f, c.hp / c.maxHp));
                paint.setColor(Color.rgb(9, 10, 15));
                canvas.drawRect(cx - 30f, cy - rad - 16f, cx + 30f, cy - rad - 9f, paint);
                paint.setColor(Color.rgb(239, 68, 68));
                canvas.drawRect(cx - 30f, cy - rad - 16f, cx - 30f + 60f * ratio, cy - rad - 9f, paint);

                paint.setColor(Color.rgb(229, 224, 216));
                paint.setTextSize(22f);
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(c.name, cx, cy - rad - 22f, paint);
            }

            // 6. Autonomous NPCs
            for (NPC n : npcs) {
                if (!n.alive || !n.regionId.equals(regionId)) continue;
                float nx = n.x - camX;
                float ny = n.y - camY;
                paint.setColor(n.cloakColor);
                canvas.drawRect(nx - 15f, ny - 20f, nx + 15f, ny + 20f, paint);
                paint.setColor(Color.rgb(253, 230, 138));
                paint.setTextSize(22f);
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(n.name, nx, ny - 28f, paint);
            }

            // 7. Projectiles
            for (Projectile pr : projectiles) {
                if (!pr.regionId.equals(regionId)) continue;
                paint.setColor(pr.color);
                canvas.drawCircle(pr.x - camX, pr.y - camY, 9f, paint);
            }

            // 8. Player Character
            float px = playerX - camX;
            float py = playerY - camY;
            paint.setColor(dodgeTimer > 0f ? Color.rgb(56, 189, 248) : Color.rgb(226, 232, 240));
            canvas.drawRect(px - 15f, py - 20f, px + 15f, py + 20f, paint);

            if (slashTimer > 0f) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(7f);
                paint.setColor(Color.argb(190, 245, 158, 11));
                canvas.drawCircle(
                        px + (float) Math.cos(playerFacing) * 30f,
                        py + (float) Math.sin(playerFacing) * 30f,
                        weapons.get(equippedWeaponIdx).reach,
                        paint
                );
                paint.setStyle(Paint.Style.FILL);
            }

            if (parryTimer > 0f) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(5f);
                paint.setColor(Color.rgb(253, 224, 71));
                canvas.drawCircle(px, py, 32f, paint);
                paint.setStyle(Paint.Style.FILL);
            }

            // 9. HUD & Overlays
            drawHudAndOverlays(canvas, vw, vh);

            // Schedule next 60fps VSync frame
            postInvalidateOnAnimation();
        }

        private void drawHudAndOverlays(Canvas canvas, int vw, int vh) {
            if (screenState.equals("TITLE")) {
                paint.setColor(Color.argb(225, 9, 10, 15));
                canvas.drawRect(0, 0, vw, vh, paint);

                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTypeface(Typeface.SERIF);
                paint.setColor(Color.rgb(245, 158, 11));
                paint.setTextSize(72f);
                canvas.drawText("ASHEN FIELDS", vw / 2f, vh * 0.38f, paint);

                paint.setTypeface(Typeface.MONOSPACE);
                paint.setColor(Color.rgb(168, 162, 158));
                paint.setTextSize(26f);
                canvas.drawText("NATIVE ANDROID EDITION · AUTONOMOUS LIVING WORLD RPG", vw / 2f, vh * 0.48f, paint);

                rect.set(vw / 2f - 220f, vh * 0.58f, vw / 2f + 220f, vh * 0.72f);
                paint.setColor(Color.rgb(180, 83, 9));
                canvas.drawRoundRect(rect, 14f, 14f, paint);
                paint.setColor(Color.WHITE);
                paint.setTextSize(32f);
                canvas.drawText("TAP OR PRESS START TO ENTER", vw / 2f, vh * 0.665f, paint);
                return;
            }

            if (screenState.equals("DEATH") || screenState.equals("VICTORY")) {
                paint.setColor(Color.argb(225, 9, 10, 15));
                canvas.drawRect(0, 0, vw, vh, paint);
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTypeface(Typeface.SERIF);
                paint.setColor(screenState.equals("VICTORY") ? Color.rgb(245, 158, 11) : Color.rgb(225, 29, 72));
                paint.setTextSize(68f);
                canvas.drawText(
                        screenState.equals("VICTORY") ? "THE SEVENTH STAR STILLED" : "CLAIMED BY THE ASH",
                        vw / 2f, vh * 0.44f, paint
                );
                paint.setColor(Color.WHITE);
                paint.setTextSize(30f);
                canvas.drawText("TAP ANYWHERE TO RISE AT THE EMBER PYRE", vw / 2f, vh * 0.60f, paint);
                return;
            }

            // Top-Left Vitals Panel
            rect.set(24f, 24f, 640f, 165f);
            paint.setColor(Color.argb(205, 17, 19, 26));
            canvas.drawRoundRect(rect, 12f, 12f, paint);

            paint.setTextAlign(Paint.Align.LEFT);
            paint.setTypeface(Typeface.MONOSPACE);
            paint.setTextSize(24f);
            paint.setColor(Color.rgb(252, 165, 165));
            canvas.drawText(
                    "HP " + (int) playerHp + "/" + (int) playerMaxHp
                            + " · ST " + (int) playerStam
                            + " · MP " + (int) playerMana,
                    42f, 64f, paint
            );

            Weapon wpn = weapons.get(equippedWeaponIdx);
            paint.setColor(Color.rgb(253, 230, 138));
            canvas.drawText(
                    wpn.name + " +" + wpn.upgradeLevel + " · " + ash + " Ash · Flask x" + flasks,
                    42f, 102f, paint
            );

            Spell sp = spells.get(activeSpellIdx);
            paint.setColor(Color.rgb(147, 197, 253));
            canvas.drawText("Spell: " + sp.name + " (Tap Here to Cycle)", 42f, 140f, paint);

            // Top-Right Region & Modal Buttons
            paint.setTextAlign(Paint.Align.RIGHT);
            paint.setColor(Color.rgb(251, 191, 36));
            canvas.drawText(getRegionTitle(regionId) + " · Food " + (int) settlementFood + "%", vw - 28f, 56f, paint);
            paint.setColor(Color.rgb(214, 211, 209));
            paint.setTextSize(20f);
            canvas.drawText(worldBanner, vw - 28f, 88f, paint);

            String[] btnLabels = {"Gear & Temper", "AI World", "Fast Travel"};
            for (int i = 0; i < 3; i++) {
                float right = vw - 28f - i * 195f;
                float left = right - 180f;
                rect.set(left, 105f, right, 160f);
                paint.setColor(Color.rgb(30, 33, 45));
                canvas.drawRoundRect(rect, 10f, 10f, paint);
                paint.setColor(Color.WHITE);
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTextSize(21f);
                canvas.drawText(btnLabels[i], (left + right) / 2f, 140f, paint);
            }

            // Bottom-Left Multi-Touch Virtual Stick
            float jx = 175f;
            float jy = vh - 175f;
            paint.setColor(Color.argb(135, 17, 19, 26));
            canvas.drawCircle(jx, jy, 115f, paint);
            paint.setColor(Color.argb(200, 245, 158, 11));
            canvas.drawCircle(jx + touchMoveX * 55f, jy + touchMoveY * 55f, 42f, paint);

            // Bottom-Right 6 Combat Action Buttons (2 rows x 3 columns)
            String[] actLabels = {"Strike", "Heavy", "Dodge", "Spell", "Parry", "Act/Heal"};
            int[] actColors = {
                    Color.rgb(180, 83, 9),
                    Color.rgb(159, 18, 57),
                    Color.rgb(3, 105, 161),
                    Color.rgb(67, 56, 202),
                    Color.rgb(63, 63, 70),
                    Color.rgb(6, 95, 70)
            };
            for (int i = 0; i < 6; i++) {
                int row = i / 3;
                int col = i % 3;
                float cx = vw - 360f + col * 135f;
                float cy = vh - 245f + row * 135f;
                paint.setColor(actColors[i]);
                canvas.drawCircle(cx, cy, 56f, paint);
                paint.setColor(Color.WHITE);
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTextSize(21f);
                canvas.drawText(actLabels[i], cx, cy + 8f, paint);
            }

            // Modal Overlay (Inventory / AI World / Dialogue / Map)
            if (!activeModal.equals("NONE")) {
                paint.setColor(Color.argb(235, 11, 12, 16));
                canvas.drawRect(60f, 60f, vw - 60f, vh - 60f, paint);

                paint.setTextAlign(Paint.Align.LEFT);
                paint.setColor(Color.rgb(245, 158, 11));
                paint.setTextSize(32f);
                canvas.drawText("ASHEN FIELDS · " + activeModal + " (TAP TOP-RIGHT TO CLOSE)", 100f, 120f, paint);

                if (activeModal.equals("INVENTORY")) {
                    paint.setColor(Color.WHITE);
                    paint.setTextSize(25f);
                    canvas.drawText("Star-Iron Shards: " + starIron + " · Ash: " + ash + " · Tap a Weapon row to Equip & Temper (+100 Ash)", 100f, 175f, paint);
                    for (int i = 0; i < weapons.size(); i++) {
                        Weapon w = weapons.get(i);
                        float top = 205f + i * 82f;
                        rect.set(100f, top, vw - 100f, top + 68f);
                        paint.setColor(i == equippedWeaponIdx ? Color.rgb(6, 95, 70) : Color.rgb(26, 29, 40));
                        canvas.drawRoundRect(rect, 10f, 10f, paint);
                        paint.setColor(Color.WHITE);
                        canvas.drawText(
                                w.name + " +" + w.upgradeLevel + " (" + w.category + ") · Dmg " + (w.baseDamage + w.upgradeLevel * 8),
                                125f, top + 44f, paint
                        );
                    }
                } else if (activeModal.equals("AI_WORLD")) {
                    paint.setTextSize(22f);
                    for (int i = 0; i < npcs.size(); i++) {
                        NPC n = npcs.get(i);
                        float top = 165f + i * 74f;
                        paint.setColor(Color.rgb(251, 191, 36));
                        canvas.drawText(n.name + " (" + getRegionTitle(n.regionId) + ") · Goal: " + n.currentGoal + " · Trust: " + n.trust, 100f, top, paint);
                        paint.setColor(Color.rgb(168, 162, 158));
                        canvas.drawText("Action: " + n.currentAction + " · Known: " + n.knownFact, 100f, top + 28f, paint);
                    }
                } else if (activeModal.equals("DIALOGUE") && selectedNpc != null) {
                    paint.setColor(Color.rgb(251, 191, 36));
                    paint.setTextSize(30f);
                    canvas.drawText(selectedNpc.name + " · " + selectedNpc.title, 100f, 190f, paint);
                    paint.setColor(Color.WHITE);
                    paint.setTextSize(25f);
                    canvas.drawText(dialogueText, 100f, 250f, paint);

                    rect.set(100f, 320f, 520f, 400f);
                    paint.setColor(Color.rgb(180, 83, 9));
                    canvas.drawRoundRect(rect, 12f, 12f, paint);
                    paint.setColor(Color.WHITE);
                    canvas.drawText("Recruit as Sworn Companion", 135f, 370f, paint);
                } else if (activeModal.equals("MAP")) {
                    for (int i = 0; i < regionKeys.length; i++) {
                        float top = 175f + i * 78f;
                        rect.set(100f, top, vw - 100f, top + 64f);
                        paint.setColor(regionKeys[i].equals(regionId) ? Color.rgb(180, 83, 9) : Color.rgb(26, 29, 40));
                        canvas.drawRoundRect(rect, 10f, 10f, paint);
                        paint.setColor(Color.WHITE);
                        paint.setTextSize(26f);
                        canvas.drawText("Traverse Leyline → " + regionTitles[i], 130f, top + 42f, paint);
                    }
                }
            }
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            int action = event.getActionMasked();
            int idx = event.getActionIndex();
            float tx = event.getX(idx);
            float ty = event.getY(idx);
            int vw = getWidth();
            int vh = getHeight();

            if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN) {
                if (screenState.equals("TITLE")) {
                    screenState = "PLAYING";
                    return true;
                }
                if (screenState.equals("DEATH") || screenState.equals("VICTORY")) {
                    playerHp = playerMaxHp;
                    playerStam = playerMaxStam;
                    playerMana = playerMaxMana;
                    flasks = 4;
                    regionId = "oakhaven";
                    playerX = 700f;
                    playerY = 520f;
                    resetCreatures();
                    screenState = "PLAYING";
                    return true;
                }

                // Handle Active Modal taps
                if (!activeModal.equals("NONE")) {
                    if (ty < 155f) {
                        activeModal = "NONE";
                        return true;
                    }
                    if (activeModal.equals("INVENTORY")) {
                        int row = (int) ((ty - 205f) / 82f);
                        if (row >= 0 && row < weapons.size()) {
                            equippedWeaponIdx = row;
                            Weapon w = weapons.get(row);
                            if (starIron >= 1 && ash >= 100 && w.upgradeLevel < 5) {
                                starIron -= 1;
                                ash -= 100;
                                w.upgradeLevel += 1;
                            }
                            SynthAudio.playParry();
                        }
                    } else if (activeModal.equals("DIALOGUE") && selectedNpc != null) {
                        if (ty >= 320f && ty <= 400f) {
                            selectedNpc.isCompanion = true;
                            dialogueText = "\"My blade is bound to yours, Sovereign Wanderer!\"";
                            SynthAudio.playParry();
                        }
                    } else if (activeModal.equals("MAP")) {
                        int row = (int) ((ty - 175f) / 78f);
                        if (row >= 0 && row < regionKeys.length) {
                            regionId = regionKeys[row];
                            playerX = 700f;
                            playerY = 520f;
                            activeModal = "NONE";
                            worldBanner = "Traversed Leyline to " + regionTitles[row];
                        }
                    }
                    return true;
                }

                // Top-Left Spell Cycle Tap
                if (tx < 640f && ty < 170f) {
                    activeSpellIdx = (activeSpellIdx + 1) % spells.size();
                    return true;
                }

                // Top-Right Modal Buttons
                if (ty >= 100f && ty <= 165f && tx > vw - 620f) {
                    int btnIdx = (int) ((vw - 28f - tx) / 195f);
                    if (btnIdx == 0) activeModal = "MAP";
                    else if (btnIdx == 1) activeModal = "AI_WORLD";
                    else if (btnIdx == 2) activeModal = "INVENTORY";
                    return true;
                }

                // Bottom-Left Virtual Stick
                if (tx < vw * 0.42f && ty > vh * 0.45f) {
                    joyPointerId = event.getPointerId(idx);
                    joyCenterX = 175f;
                    joyCenterY = vh - 175f;
                    touchMoveX = Math.max(-1f, Math.min(1f, (tx - joyCenterX) / 75f));
                    touchMoveY = Math.max(-1f, Math.min(1f, (ty - joyCenterY) / 75f));
                    return true;
                }

                // Bottom-Right 6 Combat Action Buttons
                for (int i = 0; i < 6; i++) {
                    int row = i / 3;
                    int col = i % 3;
                    float cx = vw - 360f + col * 135f;
                    float cy = vh - 245f + row * 135f;
                    if (Math.hypot(tx - cx, ty - cy) <= 64f) {
                        if (i == 0) doAttack(false);
                        else if (i == 1) doAttack(true);
                        else if (i == 2 && playerStam >= 18f) {
                            playerStam -= 18f;
                            dodgeTimer = 0.30f;
                            SynthAudio.playSwing(false);
                        } else if (i == 3) doCastSpell();
                        else if (i == 4) {
                            parryTimer = 0.28f;
                            SynthAudio.playParry();
                        } else if (i == 5) doInteract();
                        return true;
                    }
                }
            } else if (action == MotionEvent.ACTION_MOVE) {
                for (int p = 0; p < event.getPointerCount(); p++) {
                    if (event.getPointerId(p) == joyPointerId) {
                        touchMoveX = Math.max(-1f, Math.min(1f, (event.getX(p) - joyCenterX) / 75f));
                        touchMoveY = Math.max(-1f, Math.min(1f, (event.getY(p) - joyCenterY) / 75f));
                    }
                }
                return true;
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP || action == MotionEvent.ACTION_CANCEL) {
                if (event.getPointerId(idx) == joyPointerId) {
                    joyPointerId = -1;
                    touchMoveX = 0f;
                    touchMoveY = 0f;
                }
                return true;
            }
            return super.onTouchEvent(event);
        }

        @Override
        public boolean onGenericMotionEvent(MotionEvent event) {
            if ((event.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                    && event.getAction() == MotionEvent.ACTION_MOVE) {
                float lx = event.getAxisValue(MotionEvent.AXIS_X);
                float ly = event.getAxisValue(MotionEvent.AXIS_Y);
                hwStickX = Math.abs(lx) > 0.18f ? lx : 0f;
                hwStickY = Math.abs(ly) > 0.18f ? ly : 0f;
                return true;
            }
            return super.onGenericMotionEvent(event);
        }

        @Override
        public boolean onKeyDown(int keyCode, KeyEvent event) {
            keysHeld.add(keyCode);
            if (screenState.equals("TITLE") && (keyCode == KeyEvent.KEYCODE_BUTTON_START || keyCode == KeyEvent.KEYCODE_ENTER || keyCode == KeyEvent.KEYCODE_SPACE)) {
                screenState = "PLAYING";
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_X || keyCode == KeyEvent.KEYCODE_BUTTON_R1 || keyCode == KeyEvent.KEYCODE_J) {
                doAttack(false);
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_Y || keyCode == KeyEvent.KEYCODE_BUTTON_R2 || keyCode == KeyEvent.KEYCODE_K) {
                doAttack(true);
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_A || keyCode == KeyEvent.KEYCODE_BUTTON_B || keyCode == KeyEvent.KEYCODE_SPACE) {
                if (playerStam >= 18f) {
                    playerStam -= 18f;
                    dodgeTimer = 0.30f;
                    SynthAudio.playSwing(false);
                }
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_L1 || keyCode == KeyEvent.KEYCODE_F) {
                parryTimer = 0.28f;
                SynthAudio.playParry();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_BUTTON_L2 || keyCode == KeyEvent.KEYCODE_Q) {
                doCastSpell();
                return true;
            }
            if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN || keyCode == KeyEvent.KEYCODE_E) {
                doInteract();
                return true;
            }
            return super.onKeyDown(keyCode, event);
        }

        @Override
        public boolean onKeyUp(int keyCode, KeyEvent event) {
            keysHeld.remove(keyCode);
            return super.onKeyUp(keyCode, event);
        }
    }
}
