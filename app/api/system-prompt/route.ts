import { NextResponse } from "next/server";
import { loadKnowledgeBase } from "@/lib/rag";
import { buildSystemPrompt } from "@/lib/prompts";

export async function GET() {
  try {
    const knowledgeBase = await loadKnowledgeBase();
    console.log("Knowledge base length:", knowledgeBase.length);
    const systemPrompt = buildSystemPrompt(knowledgeBase);
    console.log("System prompt length:", systemPrompt.length);

    return NextResponse.json({ systemPrompt });
  } catch (error) {
    console.error("Failed to load system prompt:", error);
    return NextResponse.json(
      { error: "Failed to load system prompt" },
      { status: 500 }
    );
  }
}
