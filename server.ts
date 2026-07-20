import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("La API Key de Gemini (GEMINI_API_KEY) no está configurada. Al configurar filtros de IA, por favor agrégala desde Menu Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // CORS Middleware for Mobile/Capacitor connections
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API Routes
  app.post("/api/ai-filters", async (req, res) => {
    try {
      const { game, recentDraws, stats } = req.body;
      if (!game || !recentDraws || !stats) {
        return res.status(400).json({ error: "Faltan datos requeridos (juego, sorteos recientes o estadísticas)." });
      }

      const ai = getAiClient();

      const maxNumbers = game.maxNumbers;
      const maxStars = game.maxStars || 0;

      // Calcular opciones válidas en función del juego activo
      const allowedParImpar: string[] = [];
      const allowedBajosAltos: string[] = [];
      for (let p = maxNumbers; p >= 0; p--) {
        allowedParImpar.push(`${p}/${maxNumbers - p}`);
      }
      for (let b = maxNumbers; b >= 0; b--) {
        allowedBajosAltos.push(`${b}/${maxNumbers - b}`);
      }

      let allowedConsecutivos: string[] = [];
      if (maxNumbers === 6) {
        allowedConsecutivos = ["6", "5/1", "4/2", "4/1/1", "3/3", "3/2/1", "3/1/1/1", "2/2/2", "2/2/1/1", "2/1/1/1/1", "1/1/1/1/1/1"];
      } else if (maxNumbers === 5) {
        allowedConsecutivos = ["5", "4/1", "3/2", "3/1/1", "2/2/1", "2/1/1/1", "1/1/1/1/1"];
      } else if (maxNumbers === 2) {
        allowedConsecutivos = ["2", "1/1"];
      } else {
        allowedConsecutivos = [String(maxNumbers)];
      }

      const allowedStarParImpar: string[] = [];
      const allowedStarBajosAltos: string[] = [];
      let allowedStarConsecutivos: string[] = [];
      if (maxStars > 0) {
        for (let p = maxStars; p >= 0; p--) {
          allowedStarParImpar.push(`${p}/${maxStars - p}`);
        }
        for (let b = maxStars; b >= 0; b--) {
          allowedStarBajosAltos.push(`${b}/${maxStars - b}`);
        }
        if (maxStars === 2) {
          allowedStarConsecutivos = ["2", "1/1"];
        } else if (maxStars === 1) {
          allowedStarConsecutivos = ["1"];
        } else {
          allowedStarConsecutivos = [String(maxStars)];
        }
      }

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          terminaciones: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Lista de terminaciones de números individuales (0-9) que se deben excluir."
          },
          terminacionesDistintas: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Lista de las opciones válidas para la cantidad de terminaciones distintas (ej. [4, 5])."
          },
          sum: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"],
            description: "Rango recomendado para la suma de la combinación principal."
          },
          parImpar: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones par/impar sugeridos a activar. Únicamente valores de esta lista: ${JSON.stringify(allowedParImpar)}`
          },
          bajosAltos: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones bajos/altos sugeridos a activar. Únicamente valores de esta lista: ${JSON.stringify(allowedBajosAltos)}`
          },
          primos: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"],
            description: "Rango de cantidad de números primos recomendado."
          },
          consecutivos: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones de números consecutivos a activar escogiéndolos de esta lista: ${JSON.stringify(allowedConsecutivos)}`
          },
          distancia: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"],
            description: "Rango recomendado de distancia mínima."
          },
          agrupDecenas: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones de agrupación por decenas a activar de esta lista: ${JSON.stringify(allowedConsecutivos)}`
          },
          sumaDigitos: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"],
            description: "Rango recomendado de suma de dígitos de la combinación."
          },
          desviacion: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER },
              max: { type: Type.NUMBER }
            },
            required: ["min", "max"],
            description: "Rango para la desviación típica recomendado."
          },
          entropyTerminaciones: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER },
              max: { type: Type.NUMBER }
            },
            required: ["min", "max"],
            description: "Rango recomendado para la Entropía de Shannon de la distribución de las terminaciones de los números (hasta 2.585)."
          },
          entropyIntervalos: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.NUMBER },
              max: { type: Type.NUMBER }
            },
            required: ["min", "max"],
            description: "Rango recomendado para la Entropía de Shannon de la distribución de los intervalos / distancias entre números (hasta 2.322)."
          },
          starSum: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"],
            description: "Rango de suma recomendado para estrellas de Euromillones/EuroDreams o claves de El Gordo."
          },
          starParImpar: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones de par/impar para estrellas. Escoger solo de: ${JSON.stringify(allowedStarParImpar)}`
          },
          starBajosAltos: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones de bajos/altos para estrellas. Escoger solo de: ${JSON.stringify(allowedStarBajosAltos)}`
          },
          starSumaDigitos: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"]
          },
          starPrimos: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"]
          },
          starConsecutivos: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: `Lista de patrones de consecutivos para estrellas. Escoger solo de: ${JSON.stringify(allowedStarConsecutivos)}`
          },
          starDistancia: {
            type: Type.OBJECT,
            properties: {
              min: { type: Type.INTEGER },
              max: { type: Type.INTEGER }
            },
            required: ["min", "max"]
          },
          excludedNumbers: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Lista de números recomendados para excluir del próximo sorteo (ej. números que han salido en los dos últimos sorteos consecutivos, etc.)."
          },
          excludedStars: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Lista de estrellas/claves recomendadas para excluir del próximo sorteo."
          },
          useMarkov: { type: Type.BOOLEAN },
          useNash: { type: Type.BOOLEAN },
          useRegression: { type: Type.BOOLEAN },
          reasoning: {
            type: Type.STRING,
            description: "Breve resumen explicativo en español (2 o 3 frases) de por qué se sugieren excluir determinados números y configurar estos filtros basándose en la tendencia real de los datos facilitados."
          }
        },
        required: [
          "terminaciones",
          "terminacionesDistintas",
          "sum",
          "parImpar",
          "bajosAltos",
          "primos",
          "consecutivos",
          "distancia",
          "agrupDecenas",
          "sumaDigitos",
          "desviacion",
          "entropyTerminaciones",
          "entropyIntervalos",
          "excludedNumbers",
          "reasoning"
        ]
      };

      const prompt = `Analiza los sorteos recientes de lotería de "${game.name}" (${game.id}):
- Rango de números principales: 1 al ${game.numberRange} (se eligen ${game.maxNumbers}).
- Rango de estrellas/claves: ${game.maxStars > 0 ? `1 al ${game.starRange} (se eligen ${game.maxStars})` : "Este juego no tiene estrellas/claves"}.

Últimos sorteos históricos facilitados (del más reciente al más antiguo):
${recentDraws.map((d: any, idx: number) => `Sorteo #${idx + 1}: Números: [${d.numbers.join(', ')}]${d.stars ? `, Estrellas: [${d.stars.join(', ')}]` : ''}`).join('\n')}

Estadísticas globales de este período:
- Números Calientes (Hot): [${stats.hotNumbers.join(', ')}]
- Números Fríos (Cold): [${stats.coldNumbers.join(', ')}]
- Números Ausentes (No han salido recientemente): [${stats.absentNumbers.join(', ')}]
${game.maxStars > 0 ? `- Estrellas/Claves Calientes: [${(stats.hotStars || []).join(', ')}]\n- Estrellas/Claves Frías: [${(stats.coldStars || []).join(', ')}]\n- Estrellas/Claves Ausentes: [${(stats.absentStars || []).join(', ')}]` : ''}

Objetivo:
Utiliza tu inteligencia analítica, matemática y probabilística aplicada a loterías para optimizar y ajustar de forma selectiva todos los filtros de la aplicación.

REGLAS DE FORMATO Y COMPROMISO DE ANÁLISIS:
1. DEBES ACTIVAR Y AJUSTAR TODOS LOS FILTROS. No los dejes vacíos ni en valores por defecto. Ajusta los rangos numéricos de forma útil (no un rango que abarque el 100% de los casos, sino un rango optimizado, por ejemplo de la suma, distancias, primos, etc.) basado en la tendencia observada de los sorteos reales.
2. Formato de chips de exclusión o patrones (DEBES usar exactamente los valores válidos indicados abajo, con barra "/" como separador, de lo contrario la interfaz web no podrá activarlos):
   - 'parImpar': Escoge combinaciones preferibles del conjunto: [${allowedParImpar.join(', ')}]. Ejemplo: ["3/3", "4/2", "2/4"]. (No uses dos puntos ":" ni formatos como "3:3").
   - 'bajosAltos': Escoge combinaciones preferibles del conjunto: [${allowedBajosAltos.join(', ')}]. Ejemplo: ["3/3", "4/2", "2/4"].
   - 'consecutivos': Escoge combinaciones de este conjunto exacto: [${allowedConsecutivos.map(v => `"${v}"`).join(', ')}].
   - 'agrupDecenas': Escoge combinaciones de este conjunto exacto: [${allowedConsecutivos.map(v => `"${v}"`).join(', ')}].
${maxStars > 0 ? `   - 'starParImpar': Escoge combinaciones de: [${allowedStarParImpar.join(', ')}].
   - 'starBajosAltos': Escoge combinaciones de: [${allowedStarBajosAltos.join(', ')}].
   - 'starConsecutivos': Escoge combinaciones de: [${allowedStarConsecutivos.map(v => `"${v}"`).join(', ')}].
` : ''}
3. 'excludedNumbers': Analiza bien los 2 últimos sorteos. Si un número ha salido en los sorteos consecutivos recientes o tiene una desviación extrema por exceso, agrégalo a este arreglo para excluirlo del panel manualmente.
4. Explica detalladamente en español en 2 o 3 frases en 'reasoning' por qué has descartado o seleccionado esos patrones y números específicos.

Devuelve obligatoriamente un objeto en formato JSON según el esquema de respuesta especificado.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No se pudo obtener una respuesta válida de la inteligencia artificial de Gemini.");
      }

      const result = JSON.parse(responseText.trim());
      res.json(result);

    } catch (error: any) {
      console.error("Error en API filtros IA:", error);
      res.status(500).json({ error: error.message || "Error desconocido al procesar filtros de IA" });
    }
  });

  app.post("/api/contact", async (req, res) => {
    const { message, email } = req.body;

    if (!message) {
      return res.status(400).json({ error: "El mensaje es obligatorio." });
    }

    // Buscar variables de forma insensible a mayúsculas/minúsculas
    const getEnv = (name: string) => {
      const key = Object.keys(process.env).find(k => k.toUpperCase() === name.toUpperCase());
      return key ? process.env[key] : null;
    };

    const telegramToken = getEnv("TELEGRAM_BOT_TOKEN");
    const telegramChatId = getEnv("TELEGRAM_CHAT_ID");

    const isPlaceholder = (val: string | null | undefined) => {
      if (!val) return true;
      const lower = val.toLowerCase();
      return lower.includes("tu-") || lower.includes("example") || lower.includes("placeholder") || lower.trim() === "";
    };

    const hasTelegram = telegramToken && telegramChatId && !isPlaceholder(telegramToken) && !isPlaceholder(telegramChatId);

    if (!hasTelegram) {
      console.error("Falta la configuración de Telegram.");
      return res.status(400).json({ 
        error: "Falta configurar correctamente Telegram. Accede al menú de arriba a la derecha (Settings) > Secrets e introduce el valor para TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID." 
      });
    }

    // Validar formato mínimo de token de Telegram (ej. contiene dos puntos ':')
    if (!telegramToken!.includes(":")) {
      return res.status(400).json({
        error: "El token de Telegram no es válido (debe tener el formato 'números:letras', ej: 123456:ABC-def)."
      });
    }

    try {
      const text = `📬 *Nuevo mensaje de contacto - DataLotto*\n\n*Mensaje:* ${message}\n\n*Usuario Contacto:* ${email || "No proporcionado"}`;
      const url = `https://api.telegram.org/bot${telegramToken!.trim()}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId!.trim(),
          text: text,
          parse_mode: "Markdown"
        })
      });

      if (response.ok) {
        return res.json({ success: true, message: "Mensaje de contacto enviado correctamente a tu bot de Telegram." });
      } else {
        const errText = await response.text();
        console.error(`Telegram API responded with status ${response.status}: ${errText}`);
        return res.status(400).json({
          error: `Error al enviar a Telegram (${response.status}): ${errText}. Por favor verifica el Token de tu bot y tu Chat ID en Settings > Secrets.`
        });
      }
    } catch (error: any) {
      console.error("Error enviando a Telegram:", error);
      return res.status(500).json({
        error: `Error interno de conexión con Telegram: ${error.message || error}`
      });
    }
  });

  app.post("/api/telemetry", async (req, res) => {
    try {
      const { userId, event, gameId, payload, timestamp } = req.body;

      console.log(`[Telemetry] User: ${userId}, Event: ${event}, Game: ${gameId}`, payload);

      const getEnv = (name: string) => {
        const key = Object.keys(process.env).find(k => k.toUpperCase() === name.toUpperCase());
        return key ? process.env[key] : null;
      };

      const telegramToken = getEnv("TELEGRAM_BOT_TOKEN");
      const telegramChatId = getEnv("TELEGRAM_CHAT_ID");
      const googleSheetsUrl = getEnv("GOOGLE_SHEETS_WEBAPP_URL");

      const isPlaceholder = (val: string | null | undefined) => {
        if (!val) return true;
        const lower = val.toLowerCase();
        return lower.includes("tu-") || lower.includes("example") || lower.includes("placeholder") || lower.trim() === "";
      };

      const hasTelegram = telegramToken && telegramChatId && !isPlaceholder(telegramToken) && !isPlaceholder(telegramChatId);
      const hasGoogleSheets = googleSheetsUrl && !isPlaceholder(googleSheetsUrl);

      // 1. Send to Google Sheets if configured (anonymous telemetry)
      if (hasGoogleSheets) {
        await fetch(googleSheetsUrl!.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: timestamp || new Date().toISOString(),
            userId: userId,
            gameId: gameId,
            event: event,
            combinationsCount: payload.combinationsCount || 0,
            allHits: payload.allHits || []
          })
        }).catch(err => console.error("Error sending telemetry to Google Sheets:", err));
      }

      // 2. Send to Telegram if configured
      if (hasTelegram) {
        let msg = `📊 *Métrica Anónima - DataLotto*\n\n`;
        msg += `👤 *Usuario ID:* \`${userId}\`\n`;
        msg += `🎮 *Sorteo:* \`${gameId.toUpperCase()}\`\n`;
        msg += `🕒 *Fecha:* \`${timestamp || new Date().toISOString()}\`\n`;
        msg += `📝 *Evento:* *${event}*\n\n`;

        if (event === 'save_ticket') {
          msg += `💾 *Boleto Guardado!*\n`;
          msg += `📅 *Sorteo Programado:* \`${payload.drawDate}\`\n`;
          msg += `🎫 *Apuestas:* \`${payload.combinationsCount}\`\n`;
          msg += `⚙️ *Múltiple:* \`${payload.isMultiple ? "Sí" : "No"}\`\n`;
        } else if (event === 'validate_ticket') {
          msg += `🏆 *Boleto Validado!*\n`;
          msg += `🎯 *Acierto Máximo:* \`${payload.maxHits} aciertos\`\n`;
          msg += `📋 *Desglose completo:* \`${JSON.stringify(payload.allHits)}\`\n`;
          msg += `✨ *Detalle:* ${payload.prizeNotice}\n`;
        } else if (event === 'save_filter') {
          msg += `⚙️ *Filtro Guardado!*\n`;
          msg += `🏷️ *Nombre:* \`${payload.name}\`\n`;
        } else {
          msg += `📦 *Detalles:* \`${JSON.stringify(payload)}\`\n`;
        }

        const url = `https://api.telegram.org/bot${telegramToken!.trim()}/sendMessage`;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId!.trim(),
            text: msg,
            parse_mode: "Markdown"
          })
        }).catch(err => console.error("Error sending telemetry to Telegram:", err));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error logging telemetry:", error);
      res.status(500).json({ error: error.message || "Error logging telemetry" });
    }
  });

  app.get("/api/jackpots", async (req, res) => {
    const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRcKUCZOa3NM7dBYXOzWO94y51x6RFT6jUCrTYpoLBlKAztGTbbxnygcC8pg47RScEMuVquZOX8iLCt/pub?output=csv";
    
    // Fallback data helper
    const getNextDrawDateStr = (gameId: string): string => {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
      let daysToAdd = 1;
      
      if (gameId === 'bonoloto') {
        daysToAdd = 1;
      } else if (gameId === 'primitiva') {
        if (day < 4) daysToAdd = 4 - day;
        else if (day < 6) daysToAdd = 6 - day;
        else daysToAdd = 4;
      } else if (gameId === 'gordo') {
        if (day === 0) daysToAdd = 7;
        else daysToAdd = 7 - day;
      } else if (gameId === 'euromillones') {
        if (day < 2) daysToAdd = 2 - day;
        else if (day < 5) daysToAdd = 5 - day;
        else daysToAdd = 2;
      } else if (gameId === 'eurodreams') {
        if (day < 1) daysToAdd = 1 - day;
        else if (day < 4) daysToAdd = 4 - day;
        else daysToAdd = 1;
      } else {
        if (day < 4) daysToAdd = 4 - day;
        else if (day < 6) daysToAdd = 6 - day;
        else daysToAdd = 4;
      }
      
      const targetDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      return targetDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const fallbackJackpots = [
      { id: "euromillones", juego: "EuroMillones", bote: 38000000, fecha: getNextDrawDateStr("euromillones") },
      { id: "primitiva", juego: "La Primitiva", bote: 37000000, fecha: getNextDrawDateStr("primitiva") },
      { id: "gordo", juego: "El Gordo de la Primitiva", bote: 10900000, fecha: getNextDrawDateStr("gordo") },
      { id: "eurodreams", juego: "EuroDreams", bote: 7200000, fecha: getNextDrawDateStr("eurodreams") },
      { id: "bonoloto", juego: "BonoLoto", bote: 1000000, fecha: getNextDrawDateStr("bonoloto") },
      { id: "nacional", juego: "Lotería Nacional", bote: 30000, fecha: getNextDrawDateStr("nacional") }
    ];

    try {
      console.log(`[Jackpots] Fetching published sheet from: ${csvUrl}`);
      const response = await fetch(csvUrl, {
        method: "GET",
        headers: { "Accept": "text/csv; charset=utf-8" }
      });
      
      if (!response.ok) {
        throw new Error(`Google Sheets HTTP error: ${response.status} ${response.statusText}`);
      }

      const csvText = await response.text();
      
      if (!csvText || csvText.trim().startsWith("<!DOCTYPE")) {
        throw new Error("Returned HTML instead of CSV data");
      }

      // Simple CSV parser
      const parseCSV = (text: string): string[][] => {
        const lines: string[][] = [];
        let row: string[] = [];
        let cell = '';
        let inQuotes = false;
        
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];
          
          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              cell += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(cell.trim());
            cell = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
              i++;
            }
            row.push(cell.trim());
            if (row.length > 0 && row.some(c => c !== '')) {
              lines.push(row);
            }
            row = [];
            cell = '';
          } else {
            cell += char;
          }
        }
        if (cell || row.length > 0) {
          row.push(cell.trim());
          lines.push(row);
        }
        return lines;
      };

      const parseBote = (boteStr: string): number => {
        if (!boteStr) return 0;
        const lower = boteStr.toLowerCase();
        if (lower.includes("no disponible") || lower.includes("consultar")) return 0;
        const cleanStr = lower.replace(/[^0-9,]/g, "");
        const parts = cleanStr.split(',');
        const integerPart = parts[0].replace(/\./g, "");
        const num = parseInt(integerPart, 10);
        return isNaN(num) ? 0 : num;
      };

      const rows = parseCSV(csvText);
      if (rows.length <= 1) {
        throw new Error("CSV has no data rows");
      }

      const parsedData: any[] = [];
      const header = rows[0].map(h => h.toLowerCase().trim());
      
      const gameIdx = header.indexOf("juego");
      // Find index of column matching 'fecha próximo sorteo' or 'fecha'
      let dateIdx = header.findIndex(h => h.includes("fecha") || h.includes("sorteo"));
      if (dateIdx === -1) dateIdx = 1;
      
      // Find index of column matching 'bote' or 'acumulado'
      let jackpotIdx = header.findIndex(h => h.includes("bote") || h.includes("acumulado"));
      if (jackpotIdx === -1) jackpotIdx = 2;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue;
        
        const juego = row[gameIdx] || "";
        const fecha = row[dateIdx] || "";
        const boteRaw = row[jackpotIdx] || "";
        
        const lowerName = juego.toLowerCase();
        let id = "";
        
        if (lowerName.includes("euromillones") || (lowerName.includes("euro") && lowerName.includes("mill"))) {
          id = "euromillones";
        } else if (lowerName.includes("primitiva") && !lowerName.includes("gordo")) {
          id = "primitiva";
        } else if (lowerName.includes("gordo")) {
          id = "gordo";
        } else if (lowerName.includes("bonoloto")) {
          id = "bonoloto";
        } else if (lowerName.includes("eurodreams") || (lowerName.includes("euro") && lowerName.includes("dream"))) {
          id = "eurodreams";
        } else if (lowerName.includes("nacional")) {
          id = "nacional";
        }
        
        if (id) {
          const bote = parseBote(boteRaw);
          parsedData.push({
            id,
            juego,
            bote,
            fecha: fecha || getNextDrawDateStr(id)
          });
        }
      }

      // Ensure all 6 games are present, falling back to defaults if missing or empty
      const supportedGameIds = ["euromillones", "primitiva", "gordo", "eurodreams", "bonoloto", "nacional"];
      const finalData: any[] = [];

      supportedGameIds.forEach(gameId => {
        const found = parsedData.find(item => item.id === gameId);
        if (found) {
          let bote = found.bote;
          if (gameId === "nacional" && bote === 0) {
            bote = 30000;
          }
          if (gameId === "eurodreams" && bote === 0) {
            bote = 7200000;
          }
          finalData.push({
            ...found,
            bote
          });
        } else {
          const fb = fallbackJackpots.find(item => item.id === gameId);
          if (fb) {
            finalData.push(fb);
          }
        }
      });

      return res.json({
        success: true,
        isFallback: false,
        data: finalData
      });

    } catch (error: any) {
      console.error("[Jackpots] Error fetching/parsing jackpots, serving fallback:", error);
      return res.json({
        success: true,
        isFallback: true,
        errorDetail: error.message || "Error al conectar o parsear la hoja de cálculo.",
        data: fallbackJackpots
      });
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
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
