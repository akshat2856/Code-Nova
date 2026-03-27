import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  model?: string;
}

async function generateAIResponse(
  messages: ChatMessage[],
  requestedModel?: string
): Promise<{ response: string; model: string }> {
  const systemPrompt = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice  
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

  const fullMessages = [{ role: "system", content: systemPrompt }, ...messages];

  const prompt = fullMessages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const preferredModel =
    requestedModel || process.env.OLLAMA_MODEL || "codellama:7b";
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || "0");
  const numPredict = Number(process.env.OLLAMA_NUM_PREDICT || "220");

  const requestBody = (model: string) => ({
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.4,
      num_predict: Number.isFinite(numPredict) ? numPredict : 220,
      top_p: 0.9,
    },
  });

  const callOllama = async (model: string): Promise<string> => {
    const controller = new AbortController();
    const timeout =
      timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody(model)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      if (typeof data?.error === "string" && data.error.trim()) {
        throw new Error(data.error.trim());
      }

      if (typeof data?.response !== "string" || !data.response.trim()) {
        return "I could not generate a full response from the local model this time. Please try a shorter prompt or ask again.";
      }

      return data.response.trim();
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  };

  const getFallbackModel = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
      if (!response.ok) return null;

      const data = await response.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      const first = models[0]?.name;
      return typeof first === "string" && first.length > 0 ? first : null;
    } catch {
      return null;
    }
  };

  try {
    let responseText = "";
    let usedModel = preferredModel;

    try {
      responseText = await callOllama(preferredModel);
    } catch (preferredError) {
      console.warn(
        `Preferred model '${preferredModel}' failed, trying fallback model`,
        preferredError
      );
    }

    if (!responseText) {
      const fallbackModel = await getFallbackModel();
      if (fallbackModel) {
        responseText = await callOllama(fallbackModel);
        usedModel = fallbackModel;
      }
    }

    if (!responseText) {
      responseText =
        "I could not generate a response from your local model right now. Please try again in a few seconds.";
    }

    return { response: responseText, model: usedModel };
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error("Failed to generate AI response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, history = [], model } = body;

    // Validate input
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate history format
    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role)
        )
      : [];

    const recentHistory = validHistory.slice(-10);

    const messages: ChatMessage[] = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    //   Generate ai response

    const aiResponse = await generateAIResponse(messages, model);



    return NextResponse.json({
      response: aiResponse.response,
      model: aiResponse.model,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}