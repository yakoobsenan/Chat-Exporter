import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, Schema } from "@google/genai";
import cors from "cors";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API Route to parse chat
  app.post("/api/parse-chat", async (req, res) => {
    try {
      const { input, file } = req.body;
      
      if (!input && !file) {
        return res.status(400).json({ error: "Input or file is required." });
      }

      const CHUNK_SIZE = 100000;
      let textChunks: string[] = [];
      let isPdfOrBinary = false;

      if (file) {
        const textMimetypes = ['application/json', 'multipart/related', 'application/rtf'];
        const isTextBased = file.mimeType.startsWith('text/') || textMimetypes.includes(file.mimeType) || file.mimeType.includes('csv') || file.mimeType.includes('markdown');
        
        if (isTextBased) {
             const fullText = Buffer.from(file.data, 'base64').toString('utf8');
             for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
               textChunks.push(fullText.substring(i, i + CHUNK_SIZE));
             }
        } else {
             isPdfOrBinary = true;
        }
      } else {
        const inputTrimmed = input.trim();
        let contentToParse = inputTrimmed;
        
        // If it looks like a URL, try to fetch it
        if (inputTrimmed.startsWith("http://") || inputTrimmed.startsWith("https://")) {
          try {
            const isDirectJsonDomain = inputTrimmed.includes("chatgpt.com/share") || 
                                       inputTrimmed.includes("gemini.google.com/share") || 
                                       inputTrimmed.includes("g.co/gemini/share");
            
            let fetchRes = { ok: false, text: async () => "" };
            
            if (!isDirectJsonDomain) {
              // Use an external rendering proxy (Jina Reader) to handle JS-heavy sites generally
              fetchRes = await fetch(`https://r.jina.ai/${inputTrimmed}`, {
                 headers: { "Accept": "text/plain" }
              });
            }
            
            if (fetchRes.ok) {
              let jinaText = await fetchRes.text();
              if (jinaText.includes("Checking your browser before accessing") || jinaText.includes("Enable JavaScript and cookies")) {
                 fetchRes.ok = false; // force fallback
              } else {
                 contentToParse = jinaText;
              }
            } 
            
            if (!fetchRes.ok) {
              // Fallback to standard fetch
              const fallbackRes = await fetch(inputTrimmed, {
                 headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
              });
              if (fallbackRes.ok) {
                const html = await fallbackRes.text();
                // Try to extract only meaningful script tags or text to help Gemini
                const scriptContents = [];
                const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
                if (nextDataMatch) scriptContents.push(nextDataMatch[1]);
                
                const remixMatch = html.match(/<script type="application\/json" id="client-bootstrap"[^>]*>([\s\S]*?)<\/script>/);
                if (remixMatch) scriptContents.push(remixMatch[1]);
  
                const wizMatch = html.match(/window\.WIZ_global_data\s*=\s*(\{[\s\S]*?\});/);
                if (wizMatch) scriptContents.push(wizMatch[1]);
                
                const genericScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
                if (genericScripts && scriptContents.length === 0) {
                   for (const s of genericScripts) {
                       if (s.length > 500) scriptContents.push(s);
                   }
                }
  
                 if (scriptContents.length > 0) {
                   contentToParse = "Extracted data:\n" + scriptContents.join("\n\n").substring(0, 500000);
                 } else {
                   contentToParse = html;
                 }
              } else {
                 return res.status(400).json({ error: `Failed to access the URL. The host (e.g., OpenAI or Google) might be blocking automated access. Please paste the raw conversation text instead.` });
              }
            }
          } catch (err) {
            console.error("Failed to fetch URL directly: ", err);
            return res.status(400).json({ error: "Network error while trying to read the URL. Please copy and paste the raw text instead." });
          }
        }
        
        for (let i = 0; i < contentToParse.length; i += CHUNK_SIZE) {
          textChunks.push(contentToParse.substring(i, i + CHUNK_SIZE));
        }
      }

      // Schema for structured output
      const schema: Schema = {
        type: Type.ARRAY,
        description: "List of conversation turns",
        items: {
          type: Type.OBJECT,
          properties: {
            role: {
              type: Type.STRING,
              description: "The role of the speaker, either 'user' or 'ai'",
            },
            content: {
              type: Type.STRING,
              description: "The main text content of the message",
            },
          },
          required: ["role", "content"],
        },
      };

      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      let allParsedData: any[] = [];
      const callGemini = async (contents: any[], retries = 3): Promise<any> => {
         for (let i = 0; i < retries; i++) {
           try {
             const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: contents,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: schema,
                  maxOutputTokens: 8192,
                }
             });
             const textRes = response.text;
             if (textRes) {
                try {
                   return JSON.parse(textRes);
                } catch (e) {
                   return [];
                }
             }
             return [];
           } catch (err: any) {
             const isRateLimit = err.status === 429 || (err.message && (err.message.includes("429") || err.message.includes("quota") || err.message.includes("rate limit") || err.message.includes("RESOURCE_EXHAUSTED")));
             if (isRateLimit) {
                console.warn(`Rate limit hit (429). Retrying in ${Math.pow(2, i) * 10} seconds...`);
                if (i === retries - 1) throw err;
                await delay(Math.pow(2, i) * 10000);
             } else {
                throw err;
             }
           }
         }
      };

      if (isPdfOrBinary) {
         try {
             let geminiContents = [
               { role: 'user', parts: [
                 { inlineData: { data: file.data, mimeType: file.mimeType } },
                 { text: `Extract the entire structured interaction (conversation) from this document.
                 
INSTRUCTIONS:
1. Search carefully through this document to find the messages between a user and an AI.
2. The user will be the human asking questions, and the AI will be the assistant replying.
3. Extract the full content of each message, PRESERVING MULTIPLE LINE BREAKS, MARKDOWN FORMATTING, CODE BLOCKS, MATHEMATICAL EQUATIONS, LISTS, AND TABLES. Do NOT strip formatting.
4. If you absolutely cannot find any conversational messages, return an empty array [].
5. CRITICAL: You MUST extract EVERY SINGLE message from the entire conversation. Do NOT stop early. Do NOT truncate or skip any messages.
6. Ensure you map the speaker correctly to "user" or "ai".` }
               ]}
             ];
             const parsedData = await callGemini(geminiContents);
             allParsedData = allParsedData.concat(parsedData);
         } catch (genErr: any) {
             if (genErr.message && genErr.message.includes("Unsupported MIME type") && file) {
                  console.warn("Retrying unsupported MIME type as raw text...");
                  const raw = Buffer.from(file.data, 'base64').toString('utf8');
                  for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
                      textChunks.push(raw.substring(i, i + CHUNK_SIZE));
                  }
             } else {
                  throw genErr;
             }
         }
      }

      if (textChunks.length > 0) {
         for (let i = 0; i < textChunks.length; i++) {
            const chunk = textChunks[i];
            const isLastChunk = i === textChunks.length - 1;
            const geminiContents = [
              { role: 'user', parts: [{ text: `Extract the structured interaction (conversation) from the following raw content (Part ${i+1} of ${textChunks.length}).

INSTRUCTIONS:
1. Extract the full content of each message, PRESERVING MULTIPLE LINE BREAKS, MARKDOWN FORMATTING, CODE BLOCKS, MATHEMATICAL EQUATIONS, LISTS, AND TABLES. Do NOT strip formatting.
2. If there are images mentioned, leave an indicator like [Image]. Do not invent new text.
3. If you absolutely cannot find any conversational messages in this part, return an empty array [].
4. Map the speaker to "user" or "ai".
5. CRITICAL: You MUST extract EVERY SINGLE message from this part. Do NOT truncate or skip any messages.

Content:
${chunk}`}]}
            ];
            
            const pData = await callGemini(geminiContents);
            
            for (const msg of pData) {
               if (allParsedData.length > 0) {
                  const lastMsg = allParsedData[allParsedData.length - 1];
                  if (lastMsg.role === msg.role) {
                     lastMsg.content += "\n\n" + msg.content;
                  } else {
                     allParsedData.push(msg);
                  }
               } else {
                  allParsedData.push(msg);
               }
            }
         }
      }

      if (allParsedData.length === 0) {
          return res.status(400).json({ error: "No conversation could be extracted. If you used a URL, it might be blocking bot access. Please paste the raw conversation text instead." });
      }
      return res.json({ data: allParsedData });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
