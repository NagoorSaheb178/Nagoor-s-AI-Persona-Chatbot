import { NextRequest, NextResponse } from "next/server";
import { bookMeeting } from "@/lib/booking";

export const maxDuration = 30;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("FULL BODY:", JSON.stringify(body, null, 2));

    let name, email, start, toolCallId;

    const toolCalls = body?.message?.toolCalls;
    if (toolCalls && toolCalls.length > 0) {
      const args = toolCalls[0]?.function?.arguments;
      toolCallId = toolCalls[0]?.id;
      if (args) {
        name = args.name;
        email = args.email;
        start = args.start;
      }
    }

    if (!name) {
      name = body.name;
      email = body.email;
      start = body.start || body.startTime;
    }

    console.log("Parsed:", { name, email, start, toolCallId });

    if (!name || !email || !start) {
      return NextResponse.json({
        results: [{
          toolCallId: toolCallId || "unknown",
          result: "Booking failed — missing name, email, or start time."
        }]
      });
    }

    const booking = await bookMeeting(name, email, start);

    return NextResponse.json({
      results: [{
        toolCallId: toolCallId || "unknown",
        result: booking.success
          ? `Booking confirmed successfully for ${name} on ${start}. Confirmation email sent to ${email}.`
          : `Booking failed: ${booking.message}`
      }]
    });

  } catch (error: unknown) {
    console.error("Book API error:", error);
    const errMsg = error instanceof Error ? error.message : "Booking failed";
    return NextResponse.json({
      results: [{
        toolCallId: "unknown",
        result: `Booking failed: ${errMsg}`
      }]
    });
  }
}
