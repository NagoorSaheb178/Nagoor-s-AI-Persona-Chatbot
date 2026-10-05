import { NextRequest, NextResponse } from "next/server";
import { checkAvailability, bookMeeting, getAvailableSlots } from "@/lib/booking";

export async function POST(req: NextRequest) {
  try {
    const { toolName, args } = await req.json();

    if (!toolName) {
      return NextResponse.json({ error: "Missing toolName" }, { status: 400 });
    }

    let result;
    const safeArgs = args || {};

    if (toolName === "checkAvailability") {
      const startTime =
        safeArgs.startTime ||
        safeArgs.start ||
        safeArgs.dateTime ||
        safeArgs.date ||
        safeArgs.time;
      result = await checkAvailability(startTime);
    } else if (toolName === "bookMeeting") {
      const name =
        safeArgs.name ||
        safeArgs.fullName ||
        safeArgs.attendeeName ||
        "Guest";
      const email = safeArgs.email || safeArgs.attendeeEmail;
      const start =
        safeArgs.start ||
        safeArgs.startTime ||
        safeArgs.dateTime ||
        safeArgs.date ||
        safeArgs.time;
      result = await bookMeeting(name, email, start);
    } else if (toolName === "getAvailableSlots") {
      const availableSlots = await getAvailableSlots();
      if (availableSlots.length === 0) {
        result = {
          available: false,
          slots: [],
          message: "No available weekday slots found in the next 7 days.",
        };
      } else {
        result = {
          available: true,
          slots: availableSlots,
          message: "Here are the available slots for upcoming weekdays",
        };
      }
    } else {
      return NextResponse.json({ error: `Unknown tool: ${toolName}` }, { status: 400 });
    }

    return NextResponse.json({ result: JSON.stringify(result) });
  } catch (error: unknown) {
    console.error("Tool execution error:", error);
    const errMsg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
