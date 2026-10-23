package com.ashenfields.rpg;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Ashen Fields — Canticles of the Seventh Star (Native Android Edition)
 * 100% Native Hardware-Accelerated 2D Pixel-Art RPG Engine (Zero WebView).
 * Features:
 * - Procedural Nearest-Neighbor Pixel-Art Sprite Sheets & Textured Environment Tiles
 * - Responsive Virtual Viewport Scaling (960x540 base scaled to any screen aspect ratio, zero UI overflow)
 * - Left-Side Movement Pad (Tactile 4-Way D-Pad + 360° Analog Thumbstick on Bottom-Left)
 * - Right-Side Ergonomic Radial Combat Cluster (Strike, Dodge, Heavy, Spell, Parry, Flask, Interact)
 * - Full Autonomous AI Living World Simulation, 6 Interconnected Regions, Multi-Phase Bosses & PCM Synth Audio
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
                            double env = Math.pow(1.0 - progress, 1.35);
                            phase += 2.0 * Math.PI * freq / sampleRate;
                            double wave = Math.sin(phase) * 0.75 + Math.sin(phase * 2.0) * 0.25;
                            int sample = (int) (wave * env * volume * Short.MAX_VALUE);
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
                        Thread.sleep(durationMs + 35L);
                        track.release();
                    } catch (Exception ignored) {
                    }
                }
            }).start();
        }

        static void playSwing(boolean heavy) {
            playTone(heavy ? 175.0 : 290.0, 54.0, heavy ? 200 : 125, 0.26f);
        }

        static void playHit(boolean crit) {
            playTone(crit ? 155.0 : 112.0, 34.0, crit ? 240 : 150, 0.34f);
        }

        static void playParry() {
            playTone(860.0, 1340.0, 290, 0.28f);
        }

        static void playSpell(boolean synergy) {
            playTone(synergy ? 380.0 : 230.0, synergy ? 52.0 : 460.0, synergy ? 450 : 260, 0.30f);
        }
    }

    // ==================== PIXEL ART SPRITE & TILE BAKER ====================
    static class PixelArtAssets {
        final Map<String, Bitmap> sprites = new HashMap<>();
        final Map<String, Bitmap> tiles = new HashMap<>();

        PixelArtAssets() {
            bakeAllSprites();
            bakeAllTiles();
        }

        private Bitmap bakeGrid(String[] rows, Map<Character, Integer> palette, int pixelScale) {
            int h = rows.length;
            int w = rows[0].length();
            Bitmap bmp = Bitmap.createBitmap(w * pixelScale, h * pixelScale, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(bmp);
            Paint p = new Paint();
            p.setStyle(Paint.Style.FILL);
            for (int y = 0; y < h; y++) {
                String row = rows[y];
                for (int x = 0; x < w && x < row.length(); x++) {
                    char ch = row.charAt(x);
                    if (ch == '.') continue;
                    Integer col = palette.get(ch);
                    if (col != null) {
                        p.setColor(col);
                        c.drawRect(
                                x * pixelScale,
                                y * pixelScale,
                                (x + 1) * pixelScale,
                                (y + 1) * pixelScale,
                                p
                        );
                    }
                }
            }
            return bmp;
        }

        private void bakeAllSprites() {
            // 1. Sovereign Wanderer (Hero Knight — Frame 0 & Frame 1)
            Map<Character, Integer> heroPal = new HashMap<>();
            heroPal.put('O', Color.rgb(12, 14, 20));    // Dark outline
            heroPal.put('H', Color.rgb(148, 163, 184)); // Steel helm/plate
            heroPal.put('L', Color.rgb(226, 232, 240)); // Bright steel highlight
            heroPal.put('E', Color.rgb(56, 189, 248));  // Astral visor glow
            heroPal.put('R', Color.rgb(190, 18, 60));   // Crimson mantle scarf
            heroPal.put('C', Color.rgb(30, 41, 59));    // Charcoal cloak
            heroPal.put('G', Color.rgb(245, 158, 11));  // Amber belt/trim
            heroPal.put('B', Color.rgb(28, 25, 23));    // Greaves/boots

            String[] heroF0 = {
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
            };
            String[] heroF1 = {
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
            };
            sprites.put("hero_0", bakeGrid(heroF0, heroPal, 3));
            sprites.put("hero_1", bakeGrid(heroF1, heroPal, 3));

            // 2. NPCs (Priestess, Blacksmith, Paladin, Scholar, Broker)
            String[] npcTemplate = {
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
            };
            sprites.put("npc_crimson", bakeNpcVariant(npcTemplate, Color.rgb(153, 27, 27), Color.rgb(251, 191, 36)));
            sprites.put("npc_smith", bakeNpcVariant(npcTemplate, Color.rgb(68, 64, 60), Color.rgb(249, 115, 22)));
            sprites.put("npc_paladin", bakeNpcVariant(npcTemplate, Color.rgb(180, 83, 9), Color.rgb(226, 232, 240)));
            sprites.put("npc_scholar", bakeNpcVariant(npcTemplate, Color.rgb(49, 46, 129), Color.rgb(56, 189, 248)));
            sprites.put("npc_synod", bakeNpcVariant(npcTemplate, Color.rgb(30, 41, 59), Color.rgb(225, 29, 72)));

            // 3. Creatures: Ashen Stag, Blight Hound, Ghoul, Choir Warden, Malakor Boss
            Map<Character, Integer> stagPal = new HashMap<>();
            stagPal.put('O', Color.rgb(15, 23, 42));
            stagPal.put('A', Color.rgb(253, 224, 71));  // Golden antlers
            stagPal.put('B', Color.rgb(226, 232, 240)); // Bone white coat
            stagPal.put('S', Color.rgb(148, 163, 184)); // Shadow coat
            stagPal.put('E', Color.rgb(56, 189, 248));  // Spirit eye
            String[] stagGrid = {
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
            };
            sprites.put("prey", bakeGrid(stagGrid, stagPal, 3));

            Map<Character, Integer> houndPal = new HashMap<>();
            houndPal.put('O', Color.rgb(15, 10, 12));
            houndPal.put('R', Color.rgb(153, 27, 27));
            houndPal.put('D', Color.rgb(69, 10, 10));
            houndPal.put('G', Color.rgb(16, 185, 129)); // Toxic spore pustules
            houndPal.put('E', Color.rgb(251, 191, 36));
            String[] houndGrid = {
                    "..........OOOO..",
                    ".........ORREEO.",
                    "..OOOOOOOORRRRO.",
                    ".ORGRRRRRDRRRDO.",
                    ".ORRRRRGRRRRRD..",
                    "..ODDDDDDDDDDO..",
                    "..ORO.....ORO...",
                    "..OOO.....OOO..."
            };
            sprites.put("predator", bakeGrid(houndGrid, houndPal, 3));

            Map<Character, Integer> ghoulPal = new HashMap<>();
            ghoulPal.put('O', Color.rgb(12, 16, 12));
            ghoulPal.put('G', Color.rgb(101, 163, 13));
            ghoulPal.put('D', Color.rgb(54, 83, 20));
            ghoulPal.put('R', Color.rgb(225, 29, 72));
            ghoulPal.put('B', Color.rgb(214, 211, 209));
            String[] ghoulGrid = {
                    "....OOOOOO......",
                    "...OGGGGGGO.....",
                    "...OGRGGRGO.....",
                    "..OOBBBBBBOO....",
                    ".OGGDDDDDDGGO...",
                    ".OGDBBBBBBDGO...",
                    "..ODDGGGGDDO....",
                    "...OGG..GGO.....",
                    "...OOO..OOO....."
            };
            sprites.put("scavenger", bakeGrid(ghoulGrid, ghoulPal, 3));

            Map<Character, Integer> guardPal = new HashMap<>();
            guardPal.put('O', Color.rgb(10, 12, 22));
            guardPal.put('I', Color.rgb(99, 102, 241));
            guardPal.put('S', Color.rgb(203, 213, 225));
            guardPal.put('G', Color.rgb(245, 158, 11));
            guardPal.put('D', Color.rgb(30, 27, 75));
            String[] guardGrid = {
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
            };
            sprites.put("guard", bakeGrid(guardGrid, guardPal, 3));

            // 4. Boss: Malakor, the Hollowed Seraph (24x20 grid at scale 4)
            Map<Character, Integer> bossPal = new HashMap<>();
            bossPal.put('O', Color.rgb(12, 10, 18));
            bossPal.put('W', Color.rgb(147, 51, 234)); // Seraphic wings
            bossPal.put('F', Color.rgb(225, 29, 72));  // Crimson wing tips
            bossPal.put('G', Color.rgb(251, 191, 36)); // Golden halo & crown
            bossPal.put('S', Color.rgb(226, 232, 240)); // Silver seraphic armor
            bossPal.put('D', Color.rgb(49, 46, 129));  // Deep astral core
            String[] bossGrid = {
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
            };
            sprites.put("boss", bakeGrid(bossGrid, bossPal, 4));

            // 5. Environment Props: First Ember Pyre Shrine, Gnarled Blight Tree, Gothic Pillar, Treasure Chest
            Map<Character, Integer> shrinePal = new HashMap<>();
            shrinePal.put('O', Color.rgb(15, 14, 13));
            shrinePal.put('S', Color.rgb(87, 83, 78));
            shrinePal.put('D', Color.rgb(41, 37, 36));
            shrinePal.put('B', Color.rgb(214, 211, 209)); // Coiled sword + skulls
            shrinePal.put('F', Color.rgb(249, 115, 22));  // Outer flame
            shrinePal.put('Y', Color.rgb(254, 240, 138)); // Inner flame
            String[] shrineGrid = {
                    ".......OO.......",
                    "......OBBO......",
                    "....OOOOOOOO....",
                    "......OBBO......",
                    ".....OFYYFO.....",
                    "....OFFYYFFO....",
                    "...OFFYYYYFFO...",
                    "...OSSSSSSSSO...",
                    "..OSSSSSSSSSSO..",
                    ".ODDDDDDDDDDDDO.",
                    ".OOOOOOOOOOOOOO."
            };
            sprites.put("shrine", bakeGrid(shrineGrid, shrinePal, 4));

            Map<Character, Integer> treePal = new HashMap<>();
            treePal.put('O', Color.rgb(12, 10, 9));
            treePal.put('C', Color.rgb(28, 37, 32));
            treePal.put('L', Color.rgb(16, 185, 129)); // Glowing spores
            treePal.put('T', Color.rgb(41, 37, 36));
            String[] treeGrid = {
                    "....OOOOOOOO....",
                    "..OOCCCCCCCCOO..",
                    ".OCCLCCCCCCLCCO.",
                    ".OCCCCCCCCCCCCO.",
                    "..OOCCLCCCCLOO..",
                    "....OOTTTTOO....",
                    ".....OTTTTO.....",
                    ".....OTTTTO.....",
                    "....OOTTTTOO....",
                    "...OOOOOOOOOO..."
            };
            sprites.put("tree", bakeGrid(treeGrid, treePal, 4));

            Map<Character, Integer> chestPal = new HashMap<>();
            chestPal.put('O', Color.rgb(12, 10, 9));
            chestPal.put('W', Color.rgb(120, 53, 15));
            chestPal.put('G', Color.rgb(245, 158, 11));
            String[] chestGrid = {
                    ".OOOOOOOOOOOO.",
                    "OWWWWWWWWWWWWO",
                    "OGGGGGGGGGGGGO",
                    "OWWWWWGGWWWWWO",
                    "OWWWWWWWWWWWWO",
                    ".OOOOOOOOOOOO."
            };
            sprites.put("chest", bakeGrid(chestGrid, chestPal, 3));
        }

        private Bitmap bakeNpcVariant(String[] grid, int cloakColor, int accentColor) {
            Map<Character, Integer> pal = new HashMap<>();
            pal.put('O', Color.rgb(12, 14, 20));
            pal.put('C', cloakColor);
            pal.put('A', Color.rgb(71, 85, 105));
            pal.put('G', accentColor);
            pal.put('F', Color.rgb(231, 229, 228));
            pal.put('B', Color.rgb(28, 25, 23));
            return bakeGrid(grid, pal, 3);
        }

        private void bakeAllTiles() {
            String[] regionIds = {"oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible"};
            int[][] colors = {
                    {Color.rgb(26, 28, 36), Color.rgb(34, 37, 46), Color.rgb(18, 20, 26), Color.rgb(180, 83, 9)},
                    {Color.rgb(18, 30, 27), Color.rgb(24, 39, 35), Color.rgb(12, 20, 18), Color.rgb(16, 185, 129)},
                    {Color.rgb(20, 24, 40), Color.rgb(28, 33, 54), Color.rgb(14, 17, 30), Color.rgb(99, 102, 241)},
                    {Color.rgb(25, 21, 27), Color.rgb(34, 29, 37), Color.rgb(16, 13, 18), Color.rgb(168, 162, 158)},
                    {Color.rgb(34, 22, 24), Color.rgb(45, 29, 32), Color.rgb(22, 14, 16), Color.rgb(234, 88, 12)},
                    {Color.rgb(28, 18, 36), Color.rgb(38, 25, 48), Color.rgb(18, 11, 24), Color.rgb(245, 158, 11)}
            };
            Paint p = new Paint();
            for (int i = 0; i < regionIds.length; i++) {
                Bitmap tile = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888);
                Canvas c = new Canvas(tile);
                p.setColor(colors[i][0]);
                c.drawRect(0, 0, 64, 64, p);
                // Flagstone bevels
                p.setColor(colors[i][1]);
                c.drawRect(2, 2, 30, 30, p);
                c.drawRect(34, 34, 62, 62, p);
                // Mortar lines & cracks
                p.setColor(colors[i][2]);
                c.drawRect(0, 31, 64, 33, p);
                c.drawRect(31, 0, 33, 64, p);
                c.drawRect(10, 12, 18, 14, p);
                c.drawRect(44, 48, 52, 50, p);
                // Subtle regional moss / rune / ember fleck
                p.setColor(colors[i][3]);
                p.setAlpha(90);
                c.drawRect(14, 20, 18, 24, p);
                c.drawRect(48, 12, 52, 16, p);
                p.setAlpha(255);
                tiles.put(regionIds[i], tile);
            }
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
        String spriteKey;

        NPC(String id, String name, String title, String regionId, float x, float y,
            String currentGoal, String currentAction, int trust, String belief, String knownFact, String spriteKey) {
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
            this.spriteKey = spriteKey;
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
        float hitFlash = 0f;
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

    static class WorldProp {
        String regionId;
        String type; // shrine, tree, chest
        float x, y;
        boolean opened = false;

        WorldProp(String regionId, String type, float x, float y) {
            this.regionId = regionId;
            this.type = type;
            this.x = x;
            this.y = y;
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

    static class FloatingText {
        float x, y;
        String text;
        int color;
        float life = 1.0f;

        FloatingText(float x, float y, String text, int color) {
            this.x = x;
            this.y = y;
            this.text = text;
            this.color = color;
        }
    }

    static class AshParticle {
        float x, y, vx, vy, size;
        int color;

        AshParticle(float x, float y, float vx, float vy, float size, int color) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.size = size;
            this.color = color;
        }
    }

    // ==================== NATIVE 60FPS HARDWARE-ACCELERATED GAME VIEW ====================
    static class AshenGameView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint pixelPaint = new Paint();
        private final RectF rect = new RectF();
        private final Rect srcRect = new Rect();
        private final Path path = new Path();
        private final Random rng = new Random(42);
        private final PixelArtAssets art;

        private long lastTimeNanos = System.nanoTime();
        private float globalTime = 0f;
        private float aiTickAccum = 0f;

        private String screenState = "TITLE"; // TITLE, PLAYING, DEATH, VICTORY
        private String activeModal = "NONE";  // NONE, INVENTORY, GRIMOIRE, AI_WORLD, DIALOGUE, MAP
        private String regionId = "oakhaven";

        private final String[] regionKeys = {"oakhaven", "bramblewood", "cathedral", "catacombs", "bastion", "crucible"};
        private final String[] regionTitles = {
                "Oakhaven Vigil",
                "Weeping Bramblewood",
                "Sunken Cathedral",
                "Synod Catacombs",
                "Ironmire Bastion",
                "The Ashen Crucible"
        };

        // Player state
        private int level = 1;
        private int ash = 240;
        private int flasks = 4;
        private int starIron = 3;
        private float playerHp = 280f, playerMaxHp = 280f;
        private float playerStam = 180f, playerMaxStam = 180f;
        private float playerMana = 160f, playerMaxMana = 160f;
        private float playerX = 680f, playerY = 480f;
        private float playerFacing = 0f;
        private boolean isMoving = false;
        private float dodgeTimer = 0f, parryTimer = 0f, slashTimer = 0f;

        private float settlementFood = 62f;
        private float cinderPower = 52f;
        private float umbralPower = 48f;
        private String worldBanner = "Oakhaven Vigil · Rest by the First Ember Pyre";
        private float bannerTimer = 4.5f;

        // Multi-Touch Left Movement Pad + Right Action Cluster State
        private float touchMoveX = 0f, touchMoveY = 0f;
        private float hwStickX = 0f, hwStickY = 0f;
        private int movePointerId = -1;
        private final Set<Integer> keysHeld = new HashSet<>();

        private final List<Weapon> weapons = new ArrayList<>();
        private int equippedWeaponIdx = 0;

        private final List<Spell> spells = new ArrayList<>();
        private int activeSpellIdx = 0;

        private final List<NPC> npcs = new ArrayList<>();
        private NPC selectedNpc = null;
        private String dialogueText = "";

        private final List<Creature> creatures = new ArrayList<>();
        private final List<WorldProp> props = new ArrayList<>();
        private final List<SpellZone> spellZones = new ArrayList<>();
        private final List<Projectile> projectiles = new ArrayList<>();
        private final List<Corpse> corpses = new ArrayList<>();
        private final List<FloatingText> floatingTexts = new ArrayList<>();
        private final List<AshParticle> ashParticles = new ArrayList<>();

        AshenGameView(Context context) {
            super(context);
            setFocusable(true);
            setFocusableInTouchMode(true);
            pixelPaint.setFilterBitmap(false);
            pixelPaint.setAntiAlias(false);
            art = new PixelArtAssets();
            initWorld();
        }

        private void initWorld() {
            weapons.clear();
            weapons.add(new Weapon("Vigilant Broadsword", "Sword", 42, 84f, 14f));
            weapons.add(new Weapon("Penitent Greatsword", "Greatsword", 68, 108f, 22f));
            weapons.add(new Weapon("Whispering Misericorde", "Dagger", 32, 60f, 8f));
            weapons.add(new Weapon("Choir-Guard Partisan", "Spear", 50, 118f, 16f));
            weapons.add(new Weapon("Astral Choir Catalyst", "Catalyst", 30, 90f, 11f));

            spells.clear();
            spells.add(new Spell("grav", "Singularity Well", "Graviturgy", 20f, 0f, 38, Color.rgb(99, 102, 241)));
            spells.add(new Spell("pyro", "Cinder Tempest", "Pyromancy", 18f, 0f, 44, Color.rgb(249, 115, 22)));
            spells.add(new Spell("runic", "Sigil of Convergence", "Runic Sorcery", 15f, 0f, 30, Color.rgb(245, 158, 11)));
            spells.add(new Spell("blood", "Sanguine Lance", "Bloodcraft", 8f, 16f, 74, Color.rgb(225, 29, 72)));
            spells.add(new Spell("vital", "Verdant Suture", "Vitalism", 22f, 0f, 68, Color.rgb(16, 185, 129)));
            spells.add(new Spell("umbral", "Umbral Phantom Step", "Umbral Arts", 16f, 0f, 34, Color.rgb(56, 189, 248)));

            npcs.clear();
            npcs.add(new NPC("verenice", "Sister Verenice", "Ember Keeper", "oakhaven", 600f, 410f,
                    "Preserve Supplies", "Tending the First Ember Pyre", 35,
                    "Only the warmth of the First Ember saves our souls.",
                    "The Sacred Chalice rests inside the Sunken Cathedral.", "npc_crimson"));
            npcs.add(new NPC("korvak", "Blacksmith Korvak", "Star-Iron Forger", "oakhaven", 470f, 540f,
                    "Forge Star-Iron", "Hammering star-iron at the anvil", 30,
                    "Star-tempered steel keeps a breath inside your ribs.",
                    "Vane sold my apprentice Tomas a trapped crypt map.", "npc_smith"));
            npcs.add(new NPC("gideon", "Sir Gideon", "Penitent Paladin", "oakhaven", 780f, 380f,
                    "Purge Bastion", "Standing watch at North Gate", 40,
                    "A knight's vow never burns out in the ash.",
                    "Recruit me in dialogue and I will fight beside you!", "npc_paladin"));
            npcs.add(new NPC("lyra", "Lyra Blight-Seer", "Choir Scholar", "bramblewood", 460f, 500f,
                    "Decode Runes", "Sampling luminescent spores", 28,
                    "Combine Graviturgy and Pyromancy for Singularity Conflagration.",
                    "Cast Sanguine Lance through a Runic Sigil to split it x3!", "npc_scholar"));
            npcs.add(new NPC("vael", "Commander Vael", "Cinder Marshal", "bastion", 480f, 640f,
                    "Hold Bastion", "Directing Siege Trench defenses", 25,
                    "Ironmire Bastion guards the threshold of the Crucible.",
                    "Malakor fights in three deadly phases in the Crucible.", "npc_paladin"));
            npcs.add(new NPC("malrik", "Whisperer Malrik", "Synod Envoy", "bastion", 1040f, 640f,
                    "Umbral Eclipse", "Coordinating Synod Blood-Knights", 15,
                    "The First Ember is a fading lie; embrace the Eclipse.",
                    "The Synod rewards those who claim the Seraph's crown.", "npc_synod"));

            props.clear();
            for (String rk : regionKeys) {
                props.add(new WorldProp(rk, "shrine", 680f, 460f));
                props.add(new WorldProp(rk, "chest", 960f, 340f));
                for (int i = 0; i < 8; i++) {
                    float tx = 180f + (i * 175f) % 1240f;
                    float ty = (i % 2 == 0) ? 210f : 760f;
                    props.add(new WorldProp(rk, "tree", tx, ty));
                }
            }

            resetCreatures();

            corpses.clear();
            corpses.add(new Corpse("bramblewood", 620f, 690f, "Fallen Oakhaven Forager", 75));
            corpses.add(new Corpse("catacombs", 520f, 560f, "Apprentice Tomas's Remains", 130));

            ashParticles.clear();
            for (int i = 0; i < 42; i++) {
                ashParticles.add(new AshParticle(
                        rng.nextFloat() * 960f,
                        rng.nextFloat() * 540f,
                        -12f - rng.nextFloat() * 18f,
                        8f + rng.nextFloat() * 14f,
                        2f + rng.nextFloat() * 2.5f,
                        i % 4 == 0 ? Color.argb(180, 245, 158, 11) : Color.argb(120, 214, 211, 209)
                ));
            }
        }

        private void resetCreatures() {
            creatures.clear();
            creatures.add(new Creature("Ashen White-Stag", "prey", "bramblewood", 440f, 680f, 65f, 10, 125f, 45f, 45, Color.rgb(231, 229, 228), 1.0f, false));
            creatures.add(new Creature("Blight-Maw Hound", "predator", "bramblewood", 780f, 560f, 110f, 24, 145f, 58f, 80, Color.rgb(153, 27, 27), 1.0f, false));
            creatures.add(new Creature("Marrow-Gorged Ghoul", "scavenger", "bramblewood", 890f, 720f, 125f, 26, 122f, 56f, 90, Color.rgb(77, 124, 15), 1.05f, false));
            creatures.add(new Creature("Vaelen, Stag-Lord", "miniboss", "bramblewood", 1180f, 480f, 360f, 40, 138f, 82f, 420, Color.rgb(16, 185, 129), 1.35f, false));

            creatures.add(new Creature("Astral Choir Warden", "guard", "cathedral", 780f, 500f, 160f, 32, 120f, 70f, 125, Color.rgb(99, 102, 241), 1.1f, false));
            creatures.add(new Creature("Arch-Cantor Oakhart", "miniboss", "cathedral", 1140f, 480f, 440f, 46, 126f, 86f, 550, Color.rgb(139, 92, 246), 1.4f, false));

            creatures.add(new Creature("Synod Bone-Sentinel", "guard", "catacombs", 760f, 460f, 155f, 34, 124f, 66f, 120, Color.rgb(214, 211, 209), 1.1f, false));
            creatures.add(new Creature("Crypt Corpse-Eater", "scavenger", "catacombs", 940f, 620f, 145f, 30, 132f, 58f, 115, Color.rgb(101, 163, 13), 1.1f, false));

            creatures.add(new Creature("Cinder Templar", "guard", "bastion", 740f, 480f, 190f, 36, 126f, 68f, 135, Color.rgb(234, 88, 12), 1.15f, false));
            creatures.add(new Creature("Synod Blood-Knight", "guard", "bastion", 980f, 480f, 195f, 38, 130f, 68f, 140, Color.rgb(225, 29, 72), 1.15f, false));

            creatures.add(new Creature("Malakor, Hollowed Seraph", "boss", "crucible", 920f, 480f, 1100f, 54, 135f, 105f, 2500, Color.rgb(245, 158, 11), 1.6f, true));
        }

        private String getRegionTitle(String key) {
            for (int i = 0; i < regionKeys.length; i++) {
                if (regionKeys[i].equals(key)) return regionTitles[i];
            }
            return "Ashen Fields";
        }

        private void showToast(String msg) {
            worldBanner = msg;
            bannerTimer = 4.0f;
        }

        private String fitText(String text, float maxWidth, Paint p) {
            if (text == null) return "";
            if (p.measureText(text) <= maxWidth) return text;
            int count = p.breakText(text, true, maxWidth - p.measureText("..."), null);
            if (count <= 0) return "";
            return text.substring(0, count) + "...";
        }

        private void doAttack(boolean heavy) {
            Weapon wpn = weapons.get(equippedWeaponIdx);
            float cost = wpn.staminaCost * (heavy ? 1.5f : 1.0f);
            if (playerStam < cost) {
                floatingTexts.add(new FloatingText(playerX, playerY - 30f, "Low Stamina", Color.rgb(148, 163, 184)));
                return;
            }
            playerStam -= cost;
            slashTimer = heavy ? 0.28f : 0.20f;
            SynthAudio.playSwing(heavy);
            performHapticFeedback(
                    heavy ? HapticFeedbackConstants.LONG_PRESS : HapticFeedbackConstants.VIRTUAL_KEY,
                    HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING
            );

            int dmg = (int) ((wpn.baseDamage + wpn.upgradeLevel * 9 + level * 4) * (heavy ? 1.55f : 1.0f));
            float reach = wpn.reach * (heavy ? 1.22f : 1.0f);

            for (Creature c : creatures) {
                if (!c.regionId.equals(regionId) || c.hp <= 0f) continue;
                float d = (float) Math.hypot(c.x - playerX, c.y - playerY);
                if (d <= reach + 26f * c.scale) {
                    c.hp -= dmg;
                    c.hitFlash = 0.16f;
                    SynthAudio.playHit(heavy);
                    performHapticFeedback(
                            heavy ? HapticFeedbackConstants.LONG_PRESS : HapticFeedbackConstants.KEYBOARD_TAP,
                            HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING
                    );
                    floatingTexts.add(new FloatingText(
                            c.x, c.y - 28f,
                            (heavy ? "CRIT " : "-") + dmg,
                            heavy ? Color.rgb(251, 191, 36) : Color.WHITE
                    ));
                    if (c.hp <= 0f) {
                        ash += c.ashReward;
                        corpses.add(new Corpse(regionId, c.x, c.y, "Remains of " + c.name, c.ashReward / 3));
                        showToast("Felled " + c.name + " (+" + c.ashReward + " Ash)");
                        if (c.isBoss) {
                            screenState = "VICTORY";
                        }
                    }
                }
            }
        }

        private void doCastSpell() {
            Spell sp = spells.get(activeSpellIdx);
            if (playerMana < sp.manaCost) {
                floatingTexts.add(new FloatingText(playerX, playerY - 30f, "Low Focus", Color.rgb(56, 189, 248)));
                return;
            }
            if (sp.hpCost > 0f && playerHp <= sp.hpCost + 5f) return;
            playerMana -= sp.manaCost;
            playerHp -= sp.hpCost;

            float tx = playerX + (float) Math.cos(playerFacing) * 135f;
            float ty = playerY + (float) Math.sin(playerFacing) * 135f;

            if (sp.id.equals("grav") || sp.id.equals("pyro") || sp.id.equals("runic")) {
                SpellZone newZone = new SpellZone(regionId, tx, ty, 92f, sp.school, 6f, sp.power + level * 4);
                boolean synergyHit = false;
                for (SpellZone ez : spellZones) {
                    if (!ez.regionId.equals(regionId)) continue;
                    boolean isCombo = (ez.school.equals("Graviturgy") && sp.school.equals("Pyromancy"))
                            || (ez.school.equals("Pyromancy") && sp.school.equals("Graviturgy"));
                    if (isCombo && Math.hypot(ez.x - tx, ez.y - ty) < 165f) {
                        ez.synergyTriggered = true;
                        newZone.synergyTriggered = true;
                        synergyHit = true;
                        showToast("SYNERGY: SINGULARITY CONFLAGRATION!");
                        for (Creature c : creatures) {
                            if (c.regionId.equals(regionId) && c.hp > 0f && Math.hypot(c.x - tx, c.y - ty) < 185f) {
                                int sDmg = sp.power * 3;
                                c.hp -= sDmg;
                                c.hitFlash = 0.2f;
                                floatingTexts.add(new FloatingText(c.x, c.y - 32f, "SYNERGY " + sDmg + "!", Color.rgb(254, 240, 138)));
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
                int heal = sp.power + level * 6;
                playerHp = Math.min(playerMaxHp, playerHp + heal);
                floatingTexts.add(new FloatingText(playerX, playerY - 30f, "+" + heal + " HP", Color.rgb(52, 211, 153)));
                SynthAudio.playSpell(false);
            } else if (sp.id.equals("umbral")) {
                dodgeTimer = 0.45f;
                playerX = Math.max(60f, Math.min(1380f, playerX + (float) Math.cos(playerFacing) * 115f));
                playerY = Math.max(60f, Math.min(860f, playerY + (float) Math.sin(playerFacing) * 115f));
                SynthAudio.playSpell(false);
            }
        }

        private void doUseFlask() {
            if (flasks > 0 && playerHp < playerMaxHp) {
                flasks -= 1;
                playerHp = Math.min(playerMaxHp, playerHp + 85f);
                floatingTexts.add(new FloatingText(playerX, playerY - 30f, "+85 HP (Flask)", Color.rgb(251, 113, 133)));
                SynthAudio.playSpell(false);
            } else if (flasks <= 0) {
                floatingTexts.add(new FloatingText(playerX, playerY - 30f, "No Flasks Left", Color.rgb(251, 113, 133)));
            }
        }

        private String getNearbyContextLabel() {
            for (NPC n : npcs) {
                if (n.alive && n.regionId.equals(regionId) && Math.hypot(n.x - playerX, n.y - playerY) < 95f) {
                    return "Talk to " + n.name;
                }
            }
            for (WorldProp pr : props) {
                if (!pr.regionId.equals(regionId)) continue;
                if (pr.type.equals("shrine") && Math.hypot(pr.x - playerX, pr.y - playerY) < 90f) {
                    return "Rest at Ember Pyre";
                }
                if (pr.type.equals("chest") && !pr.opened && Math.hypot(pr.x - playerX, pr.y - playerY) < 85f) {
                    return "Open Relic Chest";
                }
            }
            for (Corpse cp : corpses) {
                if (!cp.scavenged && cp.regionId.equals(regionId) && Math.hypot(cp.x - playerX, cp.y - playerY) < 85f) {
                    return "Loot " + cp.name;
                }
            }
            return null;
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
            for (WorldProp pr : props) {
                if (!pr.regionId.equals(regionId)) continue;
                if (pr.type.equals("shrine") && Math.hypot(pr.x - playerX, pr.y - playerY) < 90f) {
                    playerHp = playerMaxHp;
                    playerStam = playerMaxStam;
                    playerMana = playerMaxMana;
                    flasks = 4;
                    resetCreatures();
                    showToast("Rested at First Ember Pyre · Vitals & Flasks Restored");
                    SynthAudio.playParry();
                    return;
                }
                if (pr.type.equals("chest") && !pr.opened && Math.hypot(pr.x - playerX, pr.y - playerY) < 85f) {
                    pr.opened = true;
                    ash += 150;
                    starIron += 2;
                    showToast("Opened Relic Chest (+150 Ash, +2 Star-Iron Shards)");
                    SynthAudio.playParry();
                    return;
                }
            }
            for (Corpse cp : corpses) {
                if (!cp.scavenged && cp.regionId.equals(regionId) && Math.hypot(cp.x - playerX, cp.y - playerY) < 85f) {
                    cp.scavenged = true;
                    ash += cp.ashValue;
                    starIron += 1;
                    showToast("Looted " + cp.name + " (+" + cp.ashValue + " Ash, +1 Star-Iron)");
                    SynthAudio.playParry();
                    return;
                }
            }
            doUseFlask();
        }

        private void updateSimulation(float dt) {
            globalTime += dt;
            if (bannerTimer > 0f) bannerTimer -= dt;

            // Update drifting ash particles
            for (AshParticle pt : ashParticles) {
                pt.x += pt.vx * dt;
                pt.y += pt.vy * dt;
                if (pt.x < 0f) pt.x += 960f;
                if (pt.y > 540f) pt.y -= 540f;
            }

            if (!screenState.equals("PLAYING") || !activeModal.equals("NONE")) return;

            if (dodgeTimer > 0f) dodgeTimer -= dt;
            if (parryTimer > 0f) parryTimer -= dt;
            if (slashTimer > 0f) slashTimer -= dt;

            playerStam = Math.min(playerMaxStam, playerStam + 30f * dt);
            playerMana = Math.min(playerMaxMana, playerMana + 6f * dt);

            float mx = hwStickX + touchMoveX;
            float my = hwStickY + touchMoveY;
            if (keysHeld.contains(KeyEvent.KEYCODE_W) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_UP)) my -= 1f;
            if (keysHeld.contains(KeyEvent.KEYCODE_S) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_DOWN)) my += 1f;
            if (keysHeld.contains(KeyEvent.KEYCODE_A) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_LEFT)) mx -= 1f;
            if (keysHeld.contains(KeyEvent.KEYCODE_D) || keysHeld.contains(KeyEvent.KEYCODE_DPAD_RIGHT)) mx += 1f;

            float mag = (float) Math.hypot(mx, my);
            isMoving = mag > 0.06f;
            if (isMoving) {
                mx /= mag;
                my /= mag;
                playerFacing = (float) Math.atan2(my, mx);
                float spd = dodgeTimer > 0f ? 390f : 205f;
                playerX = Math.max(50f, Math.min(1390f, playerX + mx * spd * dt));
                playerY = Math.max(60f, Math.min(860f, playerY + my * spd * dt));
            }

            // Region portal transitions at East / West gates
            if (playerX > 1365f) {
                int idx = 0;
                for (int i = 0; i < regionKeys.length; i++) {
                    if (regionKeys[i].equals(regionId)) idx = i;
                }
                regionId = regionKeys[(idx + 1) % regionKeys.length];
                playerX = 95f;
                for (NPC n : npcs) {
                    if (n.isCompanion && n.alive) {
                        n.regionId = regionId;
                        n.x = 135f;
                        n.y = playerY;
                    }
                }
                showToast("Entered " + getRegionTitle(regionId));
            } else if (playerX < 70f && !regionId.equals("oakhaven")) {
                int idx = 0;
                for (int i = 0; i < regionKeys.length; i++) {
                    if (regionKeys[i].equals(regionId)) idx = i;
                }
                regionId = regionKeys[Math.max(0, idx - 1)];
                playerX = 1320f;
                for (NPC n : npcs) {
                    if (n.isCompanion && n.alive) {
                        n.regionId = regionId;
                        n.x = 1280f;
                        n.y = playerY;
                    }
                }
                showToast("Entered " + getRegionTitle(regionId));
            }

            // Update floating combat numbers
            Iterator<FloatingText> ftIt = floatingTexts.iterator();
            while (ftIt.hasNext()) {
                FloatingText ft = ftIt.next();
                ft.y -= 28f * dt;
                ft.life -= dt;
                if (ft.life <= 0f) ftIt.remove();
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
                                c.x += ((z.x - c.x) / Math.max(1f, d)) * 90f * dt;
                                c.y += ((z.y - c.y) / Math.max(1f, d)) * 90f * dt;
                            }
                            c.hp -= z.power * 0.6f * dt;
                        }
                    }
                }
            }

            // Update Projectiles & Runic Convergence Split x3
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
                            showToast("SYNERGY: RUNIC CONVERGENCE SPLIT x3!");
                            break;
                        }
                    }
                }
                for (Creature c : creatures) {
                    if (c.regionId.equals(regionId) && c.hp > 0f
                            && Math.hypot(pr.x - c.x, pr.y - c.y) <= 28f * c.scale) {
                        c.hp -= pr.damage;
                        c.hitFlash = 0.15f;
                        floatingTexts.add(new FloatingText(c.x, c.y - 26f, "-" + pr.damage, Color.rgb(254, 240, 138)));
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
                if (c.hitFlash > 0f) c.hitFlash -= dt;

                if (c.isBoss) {
                    float ratio = c.hp / c.maxHp;
                    if (ratio < 0.66f && c.bossPhase == 1) {
                        c.bossPhase = 2;
                        c.damage = 68;
                        showToast("PHASE II: MALAKOR INVOKES GRAVITATIONAL COLLAPSE");
                    } else if (ratio < 0.33f && c.bossPhase == 2) {
                        c.bossPhase = 3;
                        c.damage = 82;
                        showToast("PHASE III: SERAPHIC BLOOD-PYRE UNLEASHED");
                    }
                }

                float dPlayer = (float) Math.hypot(playerX - c.x, playerY - c.y);
                if (c.role.equals("prey")) {
                    if (dPlayer < 190f) {
                        float ang = (float) Math.atan2(c.y - playerY, c.x - playerX);
                        c.x = Math.max(60f, Math.min(1360f, c.x + (float) Math.cos(ang) * c.speed * dt));
                        c.y = Math.max(70f, Math.min(840f, c.y + (float) Math.sin(ang) * c.speed * dt));
                    }
                } else if (c.role.equals("scavenger") && dPlayer > 210f) {
                    for (Corpse cp : corpses) {
                        if (!cp.scavenged && cp.regionId.equals(regionId)) {
                            float ang = (float) Math.atan2(cp.y - c.y, cp.x - c.x);
                            if (Math.hypot(cp.x - c.x, cp.y - c.y) > 24f) {
                                c.x += (float) Math.cos(ang) * c.speed * dt;
                                c.y += (float) Math.sin(ang) * c.speed * dt;
                            } else {
                                cp.scavenged = true;
                                c.maxHp += 45f;
                                c.hp = c.maxHp;
                                c.scale = Math.min(1.45f, c.scale + 0.14f);
                                showToast(c.name + " devoured remains & mutated!");
                            }
                            break;
                        }
                    }
                } else if (dPlayer < 320f) {
                    float ang = (float) Math.atan2(playerY - c.y, playerX - c.x);
                    if (c.aiState.equals("windup")) {
                        c.stateTimer -= dt;
                        if (c.stateTimer <= 0f) {
                            if (dPlayer <= c.attackRange + 22f) {
                                if (parryTimer > 0f) {
                                    c.aiState = "recover";
                                    c.stateTimer = 2.0f;
                                    floatingTexts.add(new FloatingText(c.x, c.y - 34f, "PARRIED!", Color.rgb(253, 224, 71)));
                                    SynthAudio.playParry();
                                    performHapticFeedback(
                                            HapticFeedbackConstants.LONG_PRESS,
                                            HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING
                                    );
                                } else if (dodgeTimer <= 0f) {
                                    playerHp -= c.damage;
                                    floatingTexts.add(new FloatingText(playerX, playerY - 30f, "-" + c.damage, Color.rgb(244, 63, 94)));
                                    SynthAudio.playHit(false);
                                    performHapticFeedback(
                                            HapticFeedbackConstants.LONG_PRESS,
                                            HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING
                                    );
                                    if (playerHp <= 0f) {
                                        screenState = "DEATH";
                                    }
                                }
                            }
                            c.aiState = "recover";
                            c.stateTimer = 0.85f;
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

            // Sworn Companion AI
            for (NPC comp : npcs) {
                if (!comp.alive || !comp.isCompanion || !comp.regionId.equals(regionId)) continue;
                Creature nearest = null;
                float bestD = 250f;
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
                    if (bestD > 52f) {
                        comp.x += (float) Math.cos(ang) * 145f * dt;
                        comp.y += (float) Math.sin(ang) * 145f * dt;
                    } else {
                        nearest.hp -= 32f * dt;
                    }
                } else if (Math.hypot(playerX - comp.x, playerY - comp.y) > 72f) {
                    float ang = (float) Math.atan2(playerY - comp.y, playerX - comp.x);
                    comp.x += (float) Math.cos(ang) * 165f * dt;
                    comp.y += (float) Math.sin(ang) * 165f * dt;
                }
            }

            // Autonomous Living World Macro Tick
            aiTickAccum += dt;
            if (aiTickAccum >= 8f) {
                aiTickAccum = 0f;
                settlementFood = Math.max(12f, Math.min(100f, settlementFood - 1.2f));
                if (settlementFood < 40f) {
                    for (NPC n : npcs) {
                        if (n.id.equals("verenice") && n.regionId.equals("oakhaven")) {
                            n.regionId = "bramblewood";
                            n.currentGoal = "Forage Bramblewood";
                            n.currentAction = "Foraging untainted roots in Bramblewood";
                            settlementFood += 14f;
                            showToast("Living World: Sister Verenice traveled to Bramblewood to forage");
                        }
                    }
                }
            }
        }

        // ==================== RESPONSIVE SCALED RENDERING (960x540 BASE) ====================
        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            long now = System.nanoTime();
            float dt = (now - lastTimeNanos) / 1_000_000_000f;
            if (dt > 0.05f) dt = 0.05f;
            lastTimeNanos = now;

            updateSimulation(dt);

            int rawW = Math.max(1, getWidth());
            int rawH = Math.max(1, getHeight());
            // Responsive scale factor: guarantees virtual height = 540 (or proportional width)
            float scale = Math.min(rawW / 960f, rawH / 540f);
            if (scale <= 0f) scale = 1f;
            float uiW = rawW / scale;
            float uiH = rawH / scale;

            canvas.save();
            canvas.scale(scale, scale);

            drawWorldCanvas(canvas, uiW, uiH);
            drawHudAndModals(canvas, uiW, uiH);

            canvas.restore();
            postInvalidateOnAnimation();
        }

        private void drawWorldCanvas(Canvas canvas, float uiW, float uiH) {
            float camX = Math.max(0f, Math.min(Math.max(0f, 1440f - uiW), playerX - uiW / 2f));
            float camY = Math.max(0f, Math.min(Math.max(0f, 920f - uiH), playerY - uiH / 2f));

            // 1. Textured Pixel-Art Flagstone / Moss Floor Tiles
            Bitmap floorTile = art.tiles.get(regionId);
            if (floorTile != null) {
                int startC = Math.max(0, (int) (camX / 64f));
                int endC = Math.min(23, (int) ((camX + uiW) / 64f) + 1);
                int startR = Math.max(0, (int) (camY / 64f));
                int endR = Math.min(15, (int) ((camY + uiH) / 64f) + 1);
                for (int r = startR; r <= endR; r++) {
                    for (int c = startC; c <= endC; c++) {
                        canvas.drawBitmap(floorTile, c * 64f - camX, r * 64f - camY, pixelPaint);
                    }
                }
            } else {
                canvas.drawColor(Color.rgb(20, 22, 30));
            }

            // 2. Distant Parallax Gothic Horizon Silhouette Along Top Edge
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.argb(135, 8, 10, 16));
            float paraX = -(camX * 0.22f) % 240f;
            for (int i = -1; i < (int) (uiW / 240f) + 2; i++) {
                float bx = i * 240f + paraX;
                canvas.drawRect(bx + 20f, 0f, bx + 58f, 44f, paint);
                canvas.drawRect(bx + 32f, 0f, bx + 46f, 64f, paint);
                canvas.drawRect(bx + 125f, 0f, bx + 175f, 36f, paint);
            }

            // 3. East & West Leyline Threshold Portals
            float pulse = (float) Math.sin(globalTime * 3.5f) * 4f;
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2.5f);
            paint.setColor(Color.rgb(56, 189, 248));
            canvas.drawCircle(1375f - camX, 480f - camY, 34f + pulse, paint);
            if (!regionId.equals("oakhaven")) {
                canvas.drawCircle(65f - camX, 480f - camY, 34f + pulse, paint);
            }
            paint.setStyle(Paint.Style.FILL);

            // 4. Active Spell Zones (Graviturgy, Pyromancy, Runic Sigils)
            for (SpellZone z : spellZones) {
                if (!z.regionId.equals(regionId)) continue;
                float zx = z.x - camX;
                float zy = z.y - camY;
                paint.setShader(new RadialGradient(
                        zx, zy, z.radius,
                        z.synergyTriggered ? Color.argb(180, 254, 240, 138)
                                : z.school.equals("Graviturgy") ? Color.argb(150, 99, 102, 241)
                                : z.school.equals("Pyromancy") ? Color.argb(150, 249, 115, 22)
                                : Color.argb(150, 245, 158, 11),
                        Color.TRANSPARENT,
                        Shader.TileMode.CLAMP
                ));
                canvas.drawCircle(zx, zy, z.radius, paint);
                paint.setShader(null);
            }

            // 5. Environment Props (Shrines, Blight Trees, Relic Chests) & Dynamic Torchlight
            for (WorldProp pr : props) {
                if (!pr.regionId.equals(regionId)) continue;
                float px = pr.x - camX;
                float py = pr.y - camY;
                if (pr.type.equals("shrine")) {
                    float flicker = (float) Math.sin(globalTime * 9f) * 14f;
                    paint.setShader(new RadialGradient(
                            px, py, 190f + flicker,
                            Color.argb(115, 245, 158, 11),
                            Color.TRANSPARENT,
                            Shader.TileMode.CLAMP
                    ));
                    canvas.drawCircle(px, py, 190f + flicker, paint);
                    paint.setShader(null);
                    Bitmap sb = art.sprites.get("shrine");
                    if (sb != null) {
                        canvas.drawBitmap(sb, px - sb.getWidth() / 2f, py - sb.getHeight() / 2f, pixelPaint);
                    }
                } else if (pr.type.equals("tree")) {
                    Bitmap tb = art.sprites.get("tree");
                    if (tb != null) {
                        canvas.drawBitmap(tb, px - tb.getWidth() / 2f, py - tb.getHeight() / 2f, pixelPaint);
                    }
                } else if (pr.type.equals("chest")) {
                    Bitmap cb = art.sprites.get("chest");
                    if (cb != null) {
                        canvas.drawBitmap(cb, px - cb.getWidth() / 2f, py - cb.getHeight() / 2f, pixelPaint);
                    }
                }
            }

            // 6. Corpses
            for (Corpse cp : corpses) {
                if (!cp.regionId.equals(regionId) || cp.scavenged) continue;
                float cx = cp.x - camX;
                float cy = cp.y - camY;
                paint.setColor(Color.argb(180, 136, 19, 55));
                rect.set(cx - 16f, cy - 6f, cx + 16f, cy + 8f);
                canvas.drawOval(rect, paint);
                paint.setColor(Color.rgb(251, 191, 36));
                canvas.drawCircle(cx, cy - 8f + (float) Math.sin(globalTime * 5f) * 2.5f, 4f, paint);
            }

            // 7. Autonomous Creatures & Bosses (with Pixel-Art Sprites)
            for (Creature c : creatures) {
                if (!c.regionId.equals(regionId) || c.hp <= 0f) continue;
                float cx = c.x - camX;
                float cy = c.y - camY;
                float bob = (float) Math.sin(globalTime * 6f + c.x) * 2.5f;

                // Shadow
                paint.setColor(Color.argb(135, 0, 0, 0));
                rect.set(cx - 18f * c.scale, cy + 14f, cx + 18f * c.scale, cy + 24f);
                canvas.drawOval(rect, paint);

                if (c.aiState.equals("windup")) {
                    paint.setStyle(Paint.Style.STROKE);
                    paint.setStrokeWidth(2.5f);
                    paint.setColor(Color.argb(190, 239, 68, 68));
                    canvas.drawCircle(cx, cy, c.attackRange, paint);
                    paint.setStyle(Paint.Style.FILL);
                }

                String sKey = c.isBoss ? "boss" : c.role.equals("miniboss") ? "guard" : c.role;
                Bitmap cb = art.sprites.get(sKey);
                if (cb != null) {
                    canvas.drawBitmap(cb, cx - cb.getWidth() / 2f, cy - cb.getHeight() / 2f + bob, pixelPaint);
                }

                // Compact Health Bar above Creature
                float ratio = Math.max(0f, Math.min(1f, c.hp / c.maxHp));
                float bw = c.isBoss ? 76f : 44f;
                paint.setColor(Color.rgb(9, 10, 15));
                canvas.drawRect(cx - bw / 2f, cy - 34f, cx + bw / 2f, cy - 29f, paint);
                paint.setColor(c.isBoss ? Color.rgb(245, 158, 11) : Color.rgb(239, 68, 68));
                canvas.drawRect(cx - bw / 2f, cy - 34f, cx - bw / 2f + bw * ratio, cy - 29f, paint);

                paint.setColor(Color.rgb(229, 224, 216));
                paint.setTextSize(10.5f);
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(c.name, cx, cy - 38f, paint);
            }

            // 8. Autonomous NPCs (with Pixel-Art Sprites)
            for (NPC n : npcs) {
                if (!n.alive || !n.regionId.equals(regionId)) continue;
                float nx = n.x - camX;
                float ny = n.y - camY;
                float bob = (float) Math.sin(globalTime * 4f + n.x) * 2f;

                paint.setColor(Color.argb(135, 0, 0, 0));
                rect.set(nx - 15f, ny + 15f, nx + 15f, ny + 23f);
                canvas.drawOval(rect, paint);

                Bitmap nb = art.sprites.get(n.spriteKey);
                if (nb != null) {
                    canvas.drawBitmap(nb, nx - nb.getWidth() / 2f, ny - nb.getHeight() / 2f + bob, pixelPaint);
                }

                paint.setColor(n.isCompanion ? Color.rgb(52, 211, 153) : Color.rgb(253, 230, 138));
                paint.setTextSize(11f);
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(n.name, nx, ny - 29f, paint);
            }

            // 9. Projectiles
            for (Projectile pr : projectiles) {
                if (!pr.regionId.equals(regionId)) continue;
                paint.setColor(pr.color);
                canvas.drawCircle(pr.x - camX, pr.y - camY, 6f, paint);
            }

            // 10. Player Sovereign Wanderer (Animated Pixel-Art Knight Sprite + Weapon Swing)
            float px = playerX - camX;
            float py = playerY - camY;

            // Player lantern warm glow
            paint.setShader(new RadialGradient(
                    px, py, 115f,
                    Color.argb(65, 251, 191, 36),
                    Color.TRANSPARENT,
                    Shader.TileMode.CLAMP
            ));
            canvas.drawCircle(px, py, 115f, paint);
            paint.setShader(null);

            // Ground shadow
            paint.setColor(Color.argb(150, 0, 0, 0));
            rect.set(px - 16f, py + 15f, px + 16f, py + 24f);
            canvas.drawOval(rect, paint);

            int frame = (isMoving && ((int) (globalTime * 8f) % 2 == 1)) ? 1 : 0;
            Bitmap hb = art.sprites.get(frame == 1 ? "hero_1" : "hero_0");
            if (hb != null) {
                canvas.drawBitmap(hb, px - hb.getWidth() / 2f, py - hb.getHeight() / 2f, pixelPaint);
            }

            // Equipped Sword / Weapon Blade rendered along facing direction
            canvas.save();
            canvas.translate(px, py);
            float swingAng = slashTimer > 0f ? (float) Math.sin(slashTimer * 25f) * 0.9f : 0f;
            canvas.rotate((float) Math.toDegrees(playerFacing + swingAng));
            paint.setColor(Color.rgb(226, 232, 240));
            canvas.drawRect(12f, -2.5f, 38f, 2.5f, paint);
            paint.setColor(Color.rgb(245, 158, 11));
            canvas.drawRect(10f, -6f, 14f, 6f, paint);
            canvas.restore();

            if (slashTimer > 0f) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(5f);
                paint.setColor(Color.argb(200, 251, 191, 36));
                float deg = (float) Math.toDegrees(playerFacing);
                rect.set(px - 58f, py - 58f, px + 58f, py + 58f);
                canvas.drawArc(rect, deg - 55f, 110f, false, paint);
                paint.setStyle(Paint.Style.FILL);
            }

            if (parryTimer > 0f) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(3.5f);
                paint.setColor(Color.rgb(253, 224, 71));
                canvas.drawCircle(px, py, 28f, paint);
                paint.setStyle(Paint.Style.FILL);
            }

            // 11. Floating Combat Damage Numbers
            for (FloatingText ft : floatingTexts) {
                paint.setColor(ft.color);
                paint.setTextSize(13f);
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(ft.text, ft.x - camX, ft.y - camY, paint);
            }

            // 12. Atmospheric Drifting Ash & Embers
            for (AshParticle pt : ashParticles) {
                paint.setColor(pt.color);
                canvas.drawRect(pt.x, pt.y, pt.x + pt.size, pt.y + pt.size, paint);
            }
        }

        private void drawHudAndModals(Canvas canvas, float uiW, float uiH) {
            // ==================== TITLE SCREEN ====================
            if (screenState.equals("TITLE")) {
                paint.setColor(Color.argb(215, 9, 10, 15));
                canvas.drawRect(0f, 0f, uiW, uiH, paint);

                // Central Hero Card with Pixel-Art Sprites Showcase
                float cardW = Math.min(560f, uiW - 40f);
                float cardH = 340f;
                float cardL = (uiW - cardW) / 2f;
                float cardT = (uiH - cardH) / 2f;

                rect.set(cardL, cardT, cardL + cardW, cardT + cardH);
                paint.setColor(Color.argb(240, 16, 18, 26));
                canvas.drawRoundRect(rect, 12f, 12f, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(2f);
                paint.setColor(Color.rgb(180, 83, 9));
                canvas.drawRoundRect(rect, 12f, 12f, paint);
                paint.setStyle(Paint.Style.FILL);

                // Draw Hero, Shrine & Boss Sprites on Title Card
                Bitmap shrineBmp = art.sprites.get("shrine");
                Bitmap heroBmp = art.sprites.get("hero_0");
                Bitmap bossBmp = art.sprites.get("boss");
                if (shrineBmp != null) {
                    canvas.drawBitmap(shrineBmp, uiW / 2f - shrineBmp.getWidth() / 2f, cardT + 26f, pixelPaint);
                }
                if (heroBmp != null) {
                    canvas.drawBitmap(heroBmp, uiW / 2f - 110f - heroBmp.getWidth() / 2f, cardT + 30f, pixelPaint);
                }
                if (bossBmp != null) {
                    canvas.drawBitmap(bossBmp, uiW / 2f + 110f - bossBmp.getWidth() / 2f, cardT + 22f, pixelPaint);
                }

                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTypeface(Typeface.SERIF);
                paint.setColor(Color.rgb(245, 158, 11));
                paint.setTextSize(38f);
                canvas.drawText("ASHEN FIELDS", uiW / 2f, cardT + 135f, paint);

                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setColor(Color.rgb(214, 211, 209));
                paint.setTextSize(13f);
                canvas.drawText("CANTICLES OF THE SEVENTH STAR · LIVING WORLD DARK FANTASY RPG", uiW / 2f, cardT + 162f, paint);

                paint.setTypeface(Typeface.DEFAULT);
                paint.setColor(Color.rgb(168, 162, 158));
                paint.setTextSize(12f);
                canvas.drawText("6 Interconnected Regions · Autonomous AI NPCs & Ecology · Spell Synergies", uiW / 2f, cardT + 190f, paint);
                canvas.drawText("Left D-Pad / Stick: Move   ·   Right Action Arc: Strike, Dodge, Heavy, Spell, Parry", uiW / 2f, cardT + 212f, paint);

                // Start CTA Button
                rect.set(uiW / 2f - 140f, cardT + 242f, uiW / 2f + 140f, cardT + 298f);
                paint.setColor(Color.rgb(180, 83, 9));
                canvas.drawRoundRect(rect, 8f, 8f, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setColor(Color.rgb(251, 191, 36));
                canvas.drawRoundRect(rect, 8f, 8f, paint);
                paint.setStyle(Paint.Style.FILL);

                paint.setColor(Color.WHITE);
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextSize(16f);
                canvas.drawText("ENTER THE ASHEN FIELDS", uiW / 2f, cardT + 276f, paint);
                return;
            }

            // ==================== DEATH / VICTORY OVERLAY ====================
            if (screenState.equals("DEATH") || screenState.equals("VICTORY")) {
                paint.setColor(Color.argb(225, 9, 10, 15));
                canvas.drawRect(0f, 0f, uiW, uiH, paint);
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTypeface(Typeface.SERIF);
                paint.setColor(screenState.equals("VICTORY") ? Color.rgb(245, 158, 11) : Color.rgb(225, 29, 72));
                paint.setTextSize(36f);
                canvas.drawText(
                        screenState.equals("VICTORY") ? "THE SEVENTH STAR STILLED" : "CLAIMED BY THE ASH",
                        uiW / 2f, uiH * 0.42f, paint
                );
                rect.set(uiW / 2f - 150f, uiH * 0.54f, uiW / 2f + 150f, uiH * 0.65f);
                paint.setColor(Color.rgb(180, 83, 9));
                canvas.drawRoundRect(rect, 8f, 8f, paint);
                paint.setColor(Color.WHITE);
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextSize(15f);
                canvas.drawText("RISE AT FIRST EMBER PYRE", uiW / 2f, uiH * 0.608f, paint);
                return;
            }

            // ==================== 1. TOP-LEFT VITALS & EQUIPMENT PANEL ====================
            float tlW = 248f;
            float tlH = 98f;
            rect.set(14f, 12f, 14f + tlW, 12f + tlH);
            paint.setColor(Color.argb(215, 15, 17, 24));
            canvas.drawRoundRect(rect, 8f, 8f, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.5f);
            paint.setColor(Color.rgb(63, 55, 44));
            canvas.drawRoundRect(rect, 8f, 8f, paint);
            paint.setStyle(Paint.Style.FILL);

            // HP Bar
            drawStatBar(canvas, 24f, 22f, 150f, 9f, playerHp / playerMaxHp, Color.rgb(225, 29, 72), "HP " + (int) playerHp);
            // Stamina Bar
            drawStatBar(canvas, 24f, 37f, 150f, 8f, playerStam / playerMaxStam, Color.rgb(16, 185, 129), "ST " + (int) playerStam);
            // Mana Bar
            drawStatBar(canvas, 24f, 51f, 150f, 8f, playerMana / playerMaxMana, Color.rgb(56, 189, 248), "MP " + (int) playerMana);

            Weapon wpn = weapons.get(equippedWeaponIdx);
            Spell sp = spells.get(activeSpellIdx);
            paint.setTextAlign(Paint.Align.LEFT);
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextSize(11f);
            paint.setColor(Color.rgb(253, 230, 138));
            canvas.drawText(fitText(wpn.name + " +" + wpn.upgradeLevel + " · " + ash + " Ash", tlW - 20f, paint), 24f, 78f, paint);

            paint.setColor(Color.rgb(165, 180, 252));
            canvas.drawText(fitText("Spell: " + sp.name + " (Tap to Cycle)", tlW - 20f, paint), 24f, 96f, paint);

            // ==================== 2. TOP-RIGHT REGION & NAVIGATION BUTTONS ====================
            float trRight = uiW - 14f;
            paint.setTextAlign(Paint.Align.RIGHT);
            paint.setTypeface(Typeface.SERIF);
            paint.setTextSize(15f);
            paint.setColor(Color.rgb(251, 191, 36));
            canvas.drawText(getRegionTitle(regionId) + " · Food " + (int) settlementFood + "%", trRight, 28f, paint);

            String[] navLabels = {"Gear", "Spells", "AI World", "Map"};
            String[] navModals = {"INVENTORY", "GRIMOIRE", "AI_WORLD", "MAP"};
            float btnW = 68f;
            float btnH = 28f;
            float btnGap = 6f;
            float totalNavW = navLabels.length * btnW + (navLabels.length - 1) * btnGap;
            float startX = trRight - totalNavW;

            for (int i = 0; i < navLabels.length; i++) {
                float bx = startX + i * (btnW + btnGap);
                rect.set(bx, 38f, bx + btnW, 38f + btnH);
                boolean isActive = activeModal.equals(navModals[i]);
                paint.setColor(isActive ? Color.rgb(180, 83, 9) : Color.argb(220, 24, 27, 38));
                canvas.drawRoundRect(rect, 6f, 6f, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(1.2f);
                paint.setColor(Color.rgb(75, 68, 56));
                canvas.drawRoundRect(rect, 6f, 6f, paint);
                paint.setStyle(Paint.Style.FILL);

                paint.setColor(Color.WHITE);
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextSize(11f);
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(navLabels[i], bx + btnW / 2f, 56f, paint);
            }

            // Center Toast Banner (if active)
            if (bannerTimer > 0f && worldBanner != null) {
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setTextSize(12f);
                String clipped = fitText(worldBanner, 360f, paint);
                float bw = Math.min(380f, paint.measureText(clipped) + 28f);
                rect.set((uiW - bw) / 2f, 14f, (uiW + bw) / 2f, 44f);
                paint.setColor(Color.argb(220, 15, 17, 24));
                canvas.drawRoundRect(rect, 6f, 6f, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setColor(Color.rgb(180, 83, 9));
                canvas.drawRoundRect(rect, 6f, 6f, paint);
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(Color.rgb(253, 230, 138));
                paint.setTextAlign(Paint.Align.CENTER);
                canvas.drawText(clipped, uiW / 2f, 33f, paint);
            }

            // ==================== 3. BOTTOM-LEFT MOVEMENT PAD (D-PAD + ANALOG STICK) ====================
            float padCx = 104f;
            float padCy = uiH - 104f;
            float padR = 76f;

            // Outer movement ring
            paint.setColor(Color.argb(175, 14, 16, 23));
            canvas.drawCircle(padCx, padCy, padR, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2f);
            paint.setColor(Color.argb(190, 120, 113, 108));
            canvas.drawCircle(padCx, padCy, padR, paint);
            paint.setStyle(Paint.Style.FILL);

            // 4 Directional D-Pad Wedges (Up, Down, Left, Right) on Left Side
            drawDpadButton(canvas, padCx, padCy - 48f, "▲", touchMoveY < -0.3f);
            drawDpadButton(canvas, padCx, padCy + 48f, "▼", touchMoveY > 0.3f);
            drawDpadButton(canvas, padCx - 48f, padCy, "◄", touchMoveX < -0.3f);
            drawDpadButton(canvas, padCx + 48f, padCy, "►", touchMoveX > 0.3f);

            // Center Analog Thumbstick Knob
            float knobX = padCx + touchMoveX * 36f;
            float knobY = padCy + touchMoveY * 36f;
            paint.setColor(Color.argb(230, 245, 158, 11));
            canvas.drawCircle(knobX, knobY, 20f, paint);
            paint.setColor(Color.rgb(254, 240, 138));
            canvas.drawCircle(knobX, knobY, 8f, paint);

            paint.setColor(Color.rgb(168, 162, 158));
            paint.setTextSize(10f);
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText("MOVE", padCx, padCy + padR + 14f, paint);

            // ==================== 4. BOTTOM-RIGHT ERGONOMIC RADIAL ACTION CLUSTER ====================
            // Primary Strike Button (Bottom-Right Anchor)
            float strikeX = uiW - 76f;
            float strikeY = uiH - 74f;
            drawActionCircle(canvas, strikeX, strikeY, 36f, Color.rgb(180, 83, 9), Color.rgb(251, 191, 36), "STRIKE", "Light");

            // Surrounding Arc Buttons: Dodge, Heavy, Spell, Parry, Flask
            drawActionCircle(canvas, uiW - 158f, uiH - 54f, 26f, Color.rgb(3, 105, 161), Color.rgb(56, 189, 248), "DODGE", "Roll");
            drawActionCircle(canvas, uiW - 148f, uiH - 122f, 26f, Color.rgb(159, 18, 57), Color.rgb(251, 113, 133), "HEAVY", "Cleave");
            drawActionCircle(canvas, uiW - 84f, uiH - 154f, 26f, Color.rgb(67, 56, 202), Color.rgb(165, 180, 252), "SPELL", "Cast");
            drawActionCircle(canvas, uiW - 214f, uiH - 96f, 24f, Color.rgb(63, 63, 70), Color.rgb(212, 212, 216), "PARRY", "Deflect");
            drawActionCircle(canvas, uiW - 34f, uiH - 144f, 22f, Color.rgb(6, 95, 70), Color.rgb(52, 211, 153), "FLASK", "x" + flasks);

            // Context-Sensitive Interact Prompt Button (Bottom-Center)
            String ctxLabel = getNearbyContextLabel();
            if (ctxLabel != null) {
                float cw = 210f;
                rect.set((uiW - cw) / 2f, uiH - 64f, (uiW + cw) / 2f, uiH - 26f);
                paint.setColor(Color.rgb(180, 83, 9));
                canvas.drawRoundRect(rect, 8f, 8f, paint);
                paint.setStyle(Paint.Style.STROKE);
                paint.setColor(Color.rgb(253, 224, 71));
                canvas.drawRoundRect(rect, 8f, 8f, paint);
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(Color.WHITE);
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTextSize(13f);
                canvas.drawText(fitText("[ACT] " + ctxLabel, cw - 16f, paint), uiW / 2f, uiH - 41f, paint);
            }

            // ==================== 5. RESPONSIVE MODAL WINDOWS (ZERO OVERFLOW) ====================
            if (!activeModal.equals("NONE")) {
                drawModalWindow(canvas, uiW, uiH);
            }
        }

        private void drawStatBar(Canvas canvas, float x, float y, float w, float h, float ratio, int fillCol, String label) {
            float clamped = Math.max(0f, Math.min(1f, ratio));
            paint.setColor(Color.rgb(9, 10, 15));
            canvas.drawRect(x, y, x + w, y + h, paint);
            paint.setColor(fillCol);
            canvas.drawRect(x, y, x + w * clamped, y + h, paint);
            paint.setColor(Color.rgb(229, 231, 235));
            paint.setTextSize(9.5f);
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextAlign(Paint.Align.LEFT);
            canvas.drawText(label, x + w + 8f, y + h - 1f, paint);
        }

        private void drawDpadButton(Canvas canvas, float cx, float cy, String arrow, boolean active) {
            rect.set(cx - 18f, cy - 18f, cx + 18f, cy + 18f);
            paint.setColor(active ? Color.rgb(180, 83, 9) : Color.argb(210, 30, 33, 44));
            canvas.drawRoundRect(rect, 6f, 6f, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.2f);
            paint.setColor(active ? Color.rgb(253, 224, 71) : Color.rgb(87, 83, 78));
            canvas.drawRoundRect(rect, 6f, 6f, paint);
            paint.setStyle(Paint.Style.FILL);

            paint.setColor(Color.WHITE);
            paint.setTextSize(13f);
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText(arrow, cx, cy + 5f, paint);
        }

        private void drawActionCircle(Canvas canvas, float cx, float cy, float r, int bgCol, int borderCol, String title, String sub) {
            paint.setColor(bgCol);
            canvas.drawCircle(cx, cy, r, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2f);
            paint.setColor(borderCol);
            canvas.drawCircle(cx, cy, r, paint);
            paint.setStyle(Paint.Style.FILL);

            paint.setColor(Color.WHITE);
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTextSize(r > 30f ? 11.5f : 9.5f);
            canvas.drawText(title, cx, cy - 1f, paint);
            paint.setColor(Color.rgb(229, 231, 235));
            paint.setTypeface(Typeface.DEFAULT);
            paint.setTextSize(8f);
            canvas.drawText(sub, cx, cy + 10f, paint);
        }

        private void drawModalWindow(Canvas canvas, float uiW, float uiH) {
            float mW = Math.min(680f, uiW - 48f);
            float mH = Math.min(420f, uiH - 44f);
            float mL = (uiW - mW) / 2f;
            float mT = (uiH - mH) / 2f;

            rect.set(mL, mT, mL + mW, mT + mH);
            paint.setColor(Color.argb(245, 12, 14, 20));
            canvas.drawRoundRect(rect, 10f, 10f, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(2f);
            paint.setColor(Color.rgb(180, 83, 9));
            canvas.drawRoundRect(rect, 10f, 10f, paint);
            paint.setStyle(Paint.Style.FILL);

            // Header bar
            paint.setTextAlign(Paint.Align.LEFT);
            paint.setTypeface(Typeface.SERIF);
            paint.setTextSize(18f);
            paint.setColor(Color.rgb(251, 191, 36));
            canvas.drawText("ASHEN FIELDS · " + activeModal, mL + 20f, mT + 32f, paint);

            // Close Button (Top-Right of Modal)
            rect.set(mL + mW - 86f, mT + 12f, mL + mW - 16f, mT + 40f);
            paint.setColor(Color.rgb(159, 18, 57));
            canvas.drawRoundRect(rect, 6f, 6f, paint);
            paint.setColor(Color.WHITE);
            paint.setTypeface(Typeface.DEFAULT_BOLD);
            paint.setTextSize(11f);
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText("CLOSE [X]", mL + mW - 51f, mT + 30f, paint);

            paint.setTextAlign(Paint.Align.LEFT);
            if (activeModal.equals("INVENTORY")) {
                paint.setColor(Color.rgb(214, 211, 209));
                paint.setTextSize(12f);
                canvas.drawText(
                        fitText("Ash: " + ash + " · Star-Iron Shards: " + starIron + " · Tap any weapon row to Equip & Temper (+100 Ash)", mW - 40f, paint),
                        mL + 20f, mT + 58f, paint
                );
                for (int i = 0; i < weapons.size(); i++) {
                    Weapon w = weapons.get(i);
                    float top = mT + 72f + i * 54f;
                    rect.set(mL + 20f, top, mL + mW - 20f, top + 46f);
                    paint.setColor(i == equippedWeaponIdx ? Color.rgb(6, 78, 59) : Color.rgb(24, 27, 38));
                    canvas.drawRoundRect(rect, 6f, 6f, paint);
                    paint.setColor(Color.WHITE);
                    paint.setTextSize(13f);
                    String rowText = w.name + " +" + w.upgradeLevel + " (" + w.category + ") · Dmg " + (w.baseDamage + w.upgradeLevel * 9);
                    canvas.drawText(fitText(rowText, mW - 150f, paint), mL + 32f, top + 28f, paint);

                    paint.setColor(Color.rgb(253, 230, 138));
                    paint.setTextAlign(Paint.Align.RIGHT);
                    canvas.drawText(i == equippedWeaponIdx ? "EQUIPPED · TAP TO TEMPER" : "TAP TO EQUIP", mL + mW - 32f, top + 28f, paint);
                    paint.setTextAlign(Paint.Align.LEFT);
                }
            } else if (activeModal.equals("GRIMOIRE")) {
                paint.setColor(Color.rgb(214, 211, 209));
                paint.setTextSize(12f);
                canvas.drawText("Tap a Spell to Attune · Combine Graviturgy + Pyromancy or Runic Sigil + Blood Lance!", mL + 20f, mT + 58f, paint);
                for (int i = 0; i < spells.size(); i++) {
                    Spell s = spells.get(i);
                    float top = mT + 72f + i * 52f;
                    rect.set(mL + 20f, top, mL + mW - 20f, top + 44f);
                    paint.setColor(i == activeSpellIdx ? Color.rgb(49, 46, 129) : Color.rgb(24, 27, 38));
                    canvas.drawRoundRect(rect, 6f, 6f, paint);
                    paint.setColor(Color.WHITE);
                    paint.setTextSize(13f);
                    canvas.drawText(
                            fitText(s.name + " (" + s.school + ") · Power " + s.power + " · MP " + (int) s.manaCost, mW - 130f, paint),
                            mL + 32f, top + 27f, paint
                    );
                }
            } else if (activeModal.equals("AI_WORLD")) {
                paint.setColor(Color.rgb(253, 230, 138));
                paint.setTextSize(12f);
                canvas.drawText(
                        "Autonomous AI Simulation · Food " + (int) settlementFood + "% · Cinder " + (int) cinderPower + " vs Synod " + (int) umbralPower,
                        mL + 20f, mT + 58f, paint
                );
                for (int i = 0; i < npcs.size(); i++) {
                    NPC n = npcs.get(i);
                    float top = mT + 74f + i * 52f;
                    rect.set(mL + 20f, top, mL + mW - 20f, top + 44f);
                    paint.setColor(Color.rgb(22, 25, 35));
                    canvas.drawRoundRect(rect, 6f, 6f, paint);
                    paint.setColor(Color.rgb(251, 191, 36));
                    paint.setTextSize(12f);
                    canvas.drawText(
                            fitText(n.name + " [" + getRegionTitle(n.regionId) + "] · Goal: " + n.currentGoal + " · Trust " + n.trust, mW - 60f, paint),
                            mL + 30f, top + 18f, paint
                    );
                    paint.setColor(Color.rgb(168, 162, 158));
                    paint.setTextSize(11f);
                    canvas.drawText(
                            fitText("Action: " + n.currentAction + " · Fact: " + n.knownFact, mW - 60f, paint),
                            mL + 30f, top + 36f, paint
                    );
                }
            } else if (activeModal.equals("DIALOGUE") && selectedNpc != null) {
                paint.setColor(Color.rgb(251, 191, 36));
                paint.setTextSize(16f);
                canvas.drawText(selectedNpc.name + " · " + selectedNpc.title + " (Trust " + selectedNpc.trust + ")", mL + 20f, mT + 68f, paint);

                paint.setColor(Color.rgb(229, 231, 235));
                paint.setTextSize(13f);
                canvas.drawText(fitText(dialogueText, mW - 40f, paint), mL + 20f, mT + 108f, paint);
                canvas.drawText(fitText("Known Lore: " + selectedNpc.knownFact, mW - 40f, paint), mL + 20f, mT + 136f, paint);

                String[] dBtns = {"Ask Rumors (+Trust)", "Share Ration (+15 Trust)", "Recruit as Sworn Companion"};
                for (int i = 0; i < dBtns.length; i++) {
                    float top = mT + 175f + i * 54f;
                    rect.set(mL + 20f, top, mL + 340f, top + 42f);
                    paint.setColor(i == 2 ? Color.rgb(180, 83, 9) : Color.rgb(30, 41, 59));
                    canvas.drawRoundRect(rect, 6f, 6f, paint);
                    paint.setColor(Color.WHITE);
                    paint.setTextSize(13f);
                    canvas.drawText(dBtns[i], mL + 36f, top + 26f, paint);
                }
            } else if (activeModal.equals("MAP")) {
                paint.setColor(Color.rgb(214, 211, 209));
                paint.setTextSize(12f);
                canvas.drawText("Tap any discovered region below to traverse its Ember Leyline:", mL + 20f, mT + 58f, paint);
                for (int i = 0; i < regionKeys.length; i++) {
                    float top = mT + 72f + i * 52f;
                    rect.set(mL + 20f, top, mL + mW - 20f, top + 44f);
                    paint.setColor(regionKeys[i].equals(regionId) ? Color.rgb(180, 83, 9) : Color.rgb(24, 27, 38));
                    canvas.drawRoundRect(rect, 6f, 6f, paint);
                    paint.setColor(Color.WHITE);
                    paint.setTextSize(13f);
                    canvas.drawText("Traverse Leyline → " + regionTitles[i], mL + 32f, top + 27f, paint);
                }
            }
        }

        // ==================== MULTI-TOUCH & GAMEPAD INPUT (SCALED TO 960x540) ====================
        @Override
        public boolean onTouchEvent(MotionEvent event) {
            int rawW = Math.max(1, getWidth());
            int rawH = Math.max(1, getHeight());
            float scale = Math.min(rawW / 960f, rawH / 540f);
            if (scale <= 0f) scale = 1f;
            float uiW = rawW / scale;
            float uiH = rawH / scale;

            int action = event.getActionMasked();
            int idx = event.getActionIndex();
            int pointerId = event.getPointerId(idx);
            float ux = event.getX(idx) / scale;
            float uy = event.getY(idx) / scale;

            if (action == MotionEvent.ACTION_DOWN || action == MotionEvent.ACTION_POINTER_DOWN) {
                if (screenState.equals("TITLE")) {
                    screenState = "PLAYING";
                    SynthAudio.playParry();
                    return true;
                }
                if (screenState.equals("DEATH") || screenState.equals("VICTORY")) {
                    playerHp = playerMaxHp;
                    playerStam = playerMaxStam;
                    playerMana = playerMaxMana;
                    flasks = 4;
                    regionId = "oakhaven";
                    playerX = 680f;
                    playerY = 480f;
                    resetCreatures();
                    screenState = "PLAYING";
                    return true;
                }

                // 1. Handle Modal Window Interactions
                if (!activeModal.equals("NONE")) {
                    float mW = Math.min(680f, uiW - 48f);
                    float mH = Math.min(420f, uiH - 44f);
                    float mL = (uiW - mW) / 2f;
                    float mT = (uiH - mH) / 2f;

                    // Outside modal or Close button
                    if (ux < mL || ux > mL + mW || uy < mT || uy > mT + mH
                            || (ux >= mL + mW - 95f && uy <= mT + 48f)) {
                        activeModal = "NONE";
                        return true;
                    }

                    if (activeModal.equals("INVENTORY")) {
                        int row = (int) ((uy - (mT + 72f)) / 54f);
                        if (row >= 0 && row < weapons.size()) {
                            equippedWeaponIdx = row;
                            Weapon w = weapons.get(row);
                            if (starIron >= 1 && ash >= 100 && w.upgradeLevel < 5) {
                                starIron -= 1;
                                ash -= 100;
                                w.upgradeLevel += 1;
                                showToast("Tempered " + w.name + " to +" + w.upgradeLevel);
                            }
                            SynthAudio.playParry();
                        }
                    } else if (activeModal.equals("GRIMOIRE")) {
                        int row = (int) ((uy - (mT + 72f)) / 52f);
                        if (row >= 0 && row < spells.size()) {
                            activeSpellIdx = row;
                            showToast("Attuned Spell: " + spells.get(row).name);
                            SynthAudio.playSpell(false);
                        }
                    } else if (activeModal.equals("DIALOGUE") && selectedNpc != null) {
                        int row = (int) ((uy - (mT + 175f)) / 54f);
                        if (row == 0) {
                            selectedNpc.trust += 5;
                            dialogueText = "\"" + selectedNpc.knownFact + "\"";
                            SynthAudio.playSpell(false);
                        } else if (row == 1) {
                            selectedNpc.trust += 15;
                            settlementFood = Math.min(100f, settlementFood + 6f);
                            dialogueText = "\"Bless your generosity! Oakhaven will remember this warmth.\"";
                            SynthAudio.playParry();
                        } else if (row == 2) {
                            selectedNpc.isCompanion = true;
                            dialogueText = "\"My blade and lantern are bound to your cause, Wanderer!\"";
                            SynthAudio.playParry();
                        }
                    } else if (activeModal.equals("MAP")) {
                        int row = (int) ((uy - (mT + 72f)) / 52f);
                        if (row >= 0 && row < regionKeys.length) {
                            regionId = regionKeys[row];
                            playerX = 680f;
                            playerY = 480f;
                            for (NPC n : npcs) {
                                if (n.isCompanion && n.alive) {
                                    n.regionId = regionId;
                                    n.x = 720f;
                                    n.y = 490f;
                                }
                            }
                            activeModal = "NONE";
                            showToast("Traversed Leyline to " + regionTitles[row]);
                            SynthAudio.playSpell(false);
                        }
                    }
                    return true;
                }

                // 2. Top-Left Vitals Panel Tap -> Cycle Spell
                if (ux <= 265f && uy <= 112f) {
                    activeSpellIdx = (activeSpellIdx + 1) % spells.size();
                    showToast("Attuned Spell: " + spells.get(activeSpellIdx).name);
                    return true;
                }

                // 3. Top-Right Navigation Bar Buttons (Gear, Spells, AI World, Map)
                String[] navModals = {"INVENTORY", "GRIMOIRE", "AI_WORLD", "MAP"};
                float btnW = 68f;
                float btnGap = 6f;
                float totalNavW = navModals.length * btnW + (navModals.length - 1) * btnGap;
                float startX = (uiW - 14f) - totalNavW;
                if (uy >= 32f && uy <= 74f && ux >= startX && ux <= uiW - 10f) {
                    int bIdx = (int) ((ux - startX) / (btnW + btnGap));
                    if (bIdx >= 0 && bIdx < navModals.length) {
                        activeModal = navModals[bIdx];
                        return true;
                    }
                }

                // 4. Context-Sensitive Interact Banner (Bottom-Center)
                if (getNearbyContextLabel() != null && uy >= uiH - 72f && Math.abs(ux - uiW / 2f) <= 115f) {
                    doInteract();
                    return true;
                }

                // 5. Bottom-Left Movement Pad (D-Pad + Analog Stick on Left Side of Screen)
                float padCx = 104f;
                float padCy = uiH - 104f;
                if (ux < uiW * 0.42f && uy > 130f) {
                    movePointerId = pointerId;
                    updateLeftPadVector(ux, uy, padCx, padCy);
                    return true;
                }

                // 6. Bottom-Right Ergonomic Radial Combat Cluster
                if (Math.hypot(ux - (uiW - 76f), uy - (uiH - 74f)) <= 42f) {
                    doAttack(false);
                    return true;
                }
                if (Math.hypot(ux - (uiW - 158f), uy - (uiH - 54f)) <= 32f) {
                    if (playerStam >= 18f) {
                        playerStam -= 18f;
                        dodgeTimer = 0.30f;
                        SynthAudio.playSwing(false);
                    }
                    return true;
                }
                if (Math.hypot(ux - (uiW - 148f), uy - (uiH - 122f)) <= 32f) {
                    doAttack(true);
                    return true;
                }
                if (Math.hypot(ux - (uiW - 84f), uy - (uiH - 154f)) <= 32f) {
                    doCastSpell();
                    return true;
                }
                if (Math.hypot(ux - (uiW - 214f), uy - (uiH - 96f)) <= 30f) {
                    parryTimer = 0.28f;
                    SynthAudio.playParry();
                    return true;
                }
                if (Math.hypot(ux - (uiW - 34f), uy - (uiH - 144f)) <= 28f) {
                    doInteract();
                    return true;
                }
            } else if (action == MotionEvent.ACTION_MOVE) {
                float padCx = 104f;
                float padCy = uiH - 104f;
                for (int p = 0; p < event.getPointerCount(); p++) {
                    if (event.getPointerId(p) == movePointerId) {
                        float mx = event.getX(p) / scale;
                        float my = event.getY(p) / scale;
                        updateLeftPadVector(mx, my, padCx, padCy);
                    }
                }
                return true;
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_POINTER_UP || action == MotionEvent.ACTION_CANCEL) {
                if (pointerId == movePointerId) {
                    movePointerId = -1;
                    touchMoveX = 0f;
                    touchMoveY = 0f;
                }
                return true;
            }
            return super.onTouchEvent(event);
        }

        private void updateLeftPadVector(float ux, float uy, float padCx, float padCy) {
            float dx = ux - padCx;
            float dy = uy - padCy;
            float dist = (float) Math.hypot(dx, dy);
            if (dist < 8f) {
                touchMoveX = 0f;
                touchMoveY = 0f;
            } else {
                float norm = Math.min(1f, dist / 52f);
                touchMoveX = (dx / dist) * norm;
                touchMoveY = (dy / dist) * norm;
            }
        }

        @Override
        public boolean onGenericMotionEvent(MotionEvent event) {
            if ((event.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                    && event.getAction() == MotionEvent.ACTION_MOVE) {
                float lx = event.getAxisValue(MotionEvent.AXIS_X);
                float ly = event.getAxisValue(MotionEvent.AXIS_Y);
                hwStickX = Math.abs(lx) > 0.16f ? lx : 0f;
                hwStickY = Math.abs(ly) > 0.16f ? ly : 0f;
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
