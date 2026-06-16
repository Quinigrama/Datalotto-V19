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

    const emailUser = getEnv("EMAIL_USER");
    const emailPass = getEnv("EMAIL_PASS");

    if (!emailUser || !emailPass) {
      console.error("Faltan credenciales de email (EMAIL_USER o EMAIL_PASS)");
      return res.status(500).json({ error: "El servidor no está configurado para enviar correos." });
    }

    try {
      const mailOptions = {
        from: emailUser,
        to: "Datalotto49@gmail.com",
        subject: "Nuevo mensaje de contacto - DataLotto49",
        text: `Mensaje: ${message}\n\nEmail del usuario: ${email || "No proporcionado"}`,
      };

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Mensaje enviado correctamente." });
    } catch (error) {
      console.error("Error enviando email:", error);
      res.status(500).json({ error: "Error al enviar el mensaje. Inténtalo de nuevo más tarde." });
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
