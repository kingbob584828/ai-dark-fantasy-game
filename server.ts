import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Server-side Gemini AI endpoint for deep epistemic NPC dialogue & persuasion
  app.post('/api/npc-dialogue', async (req, res) => {
    const {
      npc,
      playerInput,
      intent,
      playerStats,
      worldContext,
    } = req.body || {};

    if (!npc || !playerInput) {
      res.status(400).json({ error: 'Missing npc or playerInput' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(200).json({ fallback: true });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemPrompt = `You are roleplaying an autonomous NPC in the dark fantasy RPG "Ashen Fields".
CRITICAL EPISTEMIC RULES:
1. Respond strictly in character as ${npc.name} (${npc.title}), belonging to faction "${npc.faction}".
2. Personality traits: ${JSON.stringify(npc.personality)}.
3. Core belief: "${npc.belief}". Deepest fear: "${npc.fear}". Long-term goal: "${npc.currentGoal}".
4. Current relationship with player: Trust=${npc.trust}/100, Fear=${npc.fearOfPlayer}/100, Respect=${npc.respect}/100.
5. LIMITED KNOWLEDGE: You ONLY know the following facts/rumors and personal memories:
   - Known facts: ${JSON.stringify(npc.knownFacts || [])}
   - Personal memories: ${JSON.stringify((npc.memories || []).slice(-8))}
   - Current Region: ${npc.regionId}, Current Action: ${npc.currentAction}
   - World State known locally: Settlement Food=${worldContext?.settlementFood ?? 50}%, Cinder Power=${worldContext?.cinderPower ?? 50}, Umbral Power=${worldContext?.umbralPower ?? 50}.
6. Do NOT magically know events outside your Known Facts or Memories. If the player asks about something you do not know, admit ignorance, suspicion, or speculate based on your beliefs.
7. Player's interaction intent is "${intent || 'converse'}". Player stats: Level ${playerStats?.level || 1}, Reputation ${playerStats?.reputation || 0}, Active Faction ${playerStats?.faction || 'Unbound'}.
8. Keep your spoken response atmospheric, FromSoftware-inspired, concise (2-4 sentences), cryptic yet grounded in your goals and memories.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Player says (${intent || 'converse'}): "${playerInput}"`,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dialogue: {
                type: Type.STRING,
                description: 'In-character spoken response (2-4 sentences).',
              },
              innerThought: {
                type: Type.STRING,
                description: 'Internal reasoning based on goals, fears, and memories.',
              },
              trustDelta: {
                type: Type.INTEGER,
                description: 'Change in trust (-25 to +25).',
              },
              fearDelta: {
                type: Type.INTEGER,
                description: 'Change in fear of player (-20 to +25).',
              },
              respectDelta: {
                type: Type.INTEGER,
                description: 'Change in respect (-20 to +25).',
              },
              newGoal: {
                type: Type.STRING,
                description: 'Optional revised goal if persuaded/threatened/informed, or empty string.',
              },
              newMemorySummary: {
                type: Type.STRING,
                description: '1-sentence summary of this interaction to store in persistent memory.',
              },
              tradeAllowed: {
                type: Type.BOOLEAN,
                description: 'Whether the NPC is willing to trade or assist right now.',
              },
              revealedFact: {
                type: Type.STRING,
                description: 'Optional secret/lore clue shared if trust or fear threshold met, or empty string.',
              },
            },
            required: [
              'dialogue',
              'innerThought',
              'trustDelta',
              'fearDelta',
              'respectDelta',
              'newGoal',
              'newMemorySummary',
              'tradeAllowed',
              'revealedFact',
            ],
          },
        },
      });

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      res.json({ fallback: false, result: parsed });
    } catch (error: any) {
      console.error('Gemini NPC dialogue fallback triggered:', error?.message);
      res.status(200).json({ fallback: true, error: error?.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Ashen Fields server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
