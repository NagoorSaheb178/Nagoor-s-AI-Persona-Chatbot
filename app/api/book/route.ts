import { NextRequest, NextResponse } from "next/server";
import { bookMeeting } from "@/lib/booking";

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

    let name, email, start;

    // Vapi wraps data in body.message.toolCalls
    const toolCalls = body?.message?.toolCalls;
    if (toolCalls && toolCalls.length > 0) {
      const args = toolCalls[0]?.function?.arguments;
      if (args) {
        name = args.name;
        email = args.email;
        start = args.start;
      }
    }

    // Fallback — direct body
    if (!name) {
      name = body.name;
      email = body.email;
      start = body.start || body.startTime;
    }

    console.log("Parsed:", { name, email, start });

    if (!name || !email || !start) {
      return NextResponse.json(
        { error: `Missing: name=${name}, email=${email}, start=${start}` },
        { status: 400 }
      );
    }

    const booking = await bookMeeting(name, email, start);

    return NextResponse.json({
      success: true,
      booking,
      message: `Meeting booked! Confirmation sent to ${email}`,
    });
  } catch (error: unknown) {
    console.error("Book API error:", error);
    const errMsg = error instanceof Error ? error.message : "Booking failed";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
