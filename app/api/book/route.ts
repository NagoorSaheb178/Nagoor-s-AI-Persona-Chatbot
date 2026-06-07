import { NextRequest, NextResponse } from "next/server";
import { bookMeeting } from "@/lib/booking";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("FULL BODY:", JSON.stringify(body, null, 2));

    let name, email, start;

    // Vapi format — data inside message.toolCalls
    if (body?.message?.toolCalls?.[0]?.function?.arguments) {
      const args = body.message.toolCalls[0].function.arguments;
      name = args.name;
      email = args.email;
      start = args.start;
    }
    // Direct format
    else if (body?.name) {
      name = body.name;
      email = body.email;
      start = body.start || body.startTime;
    }

    console.log("Parsed:", { name, email, start });

    if (!name || !email || !start) {
      return NextResponse.json(
        { error: `Missing required fields: name=${name}, email=${email}, start=${start}` },
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
