import { NextResponse } from "next/server";
import { loadKnowledgeBase } from "@/lib/rag";
import { buildSystemPrompt } from "@/lib/prompts";
import { getAvailableSlots } from "@/lib/booking";

export async function GET() {
  try {
    const [knowledgeBase, availableSlots] = await Promise.all([
      loadKnowledgeBase(),
      getAvailableSlots().catch(() => []),
    ]);

    const systemPrompt = buildSystemPrompt(knowledgeBase, availableSlots);
    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error("Failed to load system prompt:", error);
    return NextResponse.json(
      { error: "Failed to load system prompt" },
      { status: 500 }
    );
  }
}
