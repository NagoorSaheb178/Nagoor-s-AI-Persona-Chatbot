import { NextRequest, NextResponse } from "next/server";
import { checkAvailability, bookMeeting, getAvailableSlots } from "@/lib/booking";

export async function POST(req: NextRequest) {
  try {
    const { toolName, args } = await req.json();

    if (!toolName) {
      return NextResponse.json({ error: "Missing toolName" }, { status: 400 });
    }

    let result;
    if (toolName === "checkAvailability") {
      result = await checkAvailability(args.startTime);
    } else if (toolName === "bookMeeting") {
      result = await bookMeeting(args.name, args.email, args.start);
    } else if (toolName === "getAvailableSlots") {
      const availableSlots = await getAvailableSlots();
      if (availableSlots.length === 0) {
        result = { message: "No available slots found in the next 7 days." };
      } else {
        result = {
          available: true,
          slots: availableSlots,
          message: "Here are the available slots"
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
