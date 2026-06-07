import { NextRequest, NextResponse } from "next/server";
import { bookMeeting } from "@/lib/booking";

export async function POST(req: NextRequest) {
  try {
    const { name, email, start } = await req.json();

    if (!name || !email || !start) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, start" },
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
