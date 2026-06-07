import puter from "@heyputer/puter.js";
import { loadKnowledgeBase } from "@/lib/rag";
import { buildSystemPrompt, BOOKING_TOOLS } from "@/lib/prompts";
import { checkAvailability, bookMeeting } from "@/lib/booking";

// If you have a Puter auth token from your environment, you can set it like this:
// if (process.env.PUTER_AUTH_TOKEN) {
//   puter.setAuthToken(process.env.PUTER_AUTH_TOKEN);
// }

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const knowledge = await loadKnowledgeBase();
    console.log("KB Length:", knowledge.length);
    console.log("KB Preview:", knowledge.substring(0, 300));
    const systemPrompt = buildSystemPrompt(knowledge);

    const conversationMessages = [
      { role: "system", content: systemPrompt },
      ...messages
    ];

    const response = await puter.ai.chat(conversationMessages, {
      model: "gpt-4o-mini", // Use an available Puter model
      tools: BOOKING_TOOLS,
    });

    const message = response.message;

    if (message && message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;

      let toolResult;

      if (toolCall.function.name === "checkAvailability") {
        const available = await checkAvailability(args.startTime);
        toolResult = { available, message: available ? "Slot is available" : "Slot is busy" };
      }

      if (toolCall.function.name === "bookMeeting") {
        try {
          toolResult = await bookMeeting(args.name, args.email, args.start);
        } catch (error) {
          toolResult = { success: false, message: "Booking failed, please try again" };
        }
      }

      const finalResponse = await puter.ai.chat([
        ...conversationMessages,
        message,
        {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        },
      ], {
        model: "gpt-4o-mini"
      });

      return Response.json({
        message: finalResponse.message?.content,
      });
    }

    return Response.json({ message: message?.content });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
