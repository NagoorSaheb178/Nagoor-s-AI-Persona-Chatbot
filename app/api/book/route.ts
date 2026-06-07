import { NextRequest, NextResponse } from "next/server";
import { bookMeeting } from "@/lib/booking";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Received body:", JSON.stringify(body));

    // Handle multiple possible formats from Vapi
    const name = body.name || body.attendee?.name;
    const email = body.email || body.attendee?.email;
    const start = body.start || body.startTime || body.start_time;

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
      message: `Meeting booked successfully! Confirmation sent to ${email}`,
    });
  } catch (error: unknown) {
    console.error("Book API error:", error);
    const errMsg = error instanceof Error ? error.message : "Booking failed";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
