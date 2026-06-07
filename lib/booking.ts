export interface BookingResult {
  success: boolean;
  uid: string;
  meetLink: string | null;
  message: string;
}

export interface AvailabilityResult {
  available: boolean;
  slots?: string[];
  message: string;
}

const CAL_BASE = "https://api.cal.com/v2";
const CAL_HEADERS = {
  Authorization: `Bearer ${process.env.CAL_API_KEY}`,
  "cal-api-version": "2024-08-13",
  "Content-Type": "application/json",
};

export async function checkAvailability(startTime: string): Promise<AvailabilityResult> {
  try {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + 30 * 60 * 1000);

    const url = `https://api.cal.com/v2/slots/available?eventTypeId=${process.env.CAL_EVENT_TYPE_ID}&startTime=${start.toISOString()}&endTime=${end.toISOString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.CAL_API_KEY}`,
        "cal-api-version": "2024-08-13",
      },
    });

    const data = await res.json();
    console.log("Availability response:", JSON.stringify(data));

    if (!res.ok) {
      // If slots API fails, try to book and let Cal.com decide
      return { available: true, message: "Proceeding to book" };
    }

    const slots = data?.data?.slots;
    const hasSlots = slots && Object.keys(slots).length > 0;

    return {
      available: hasSlots,
      message: hasSlots ? "Slot is available" : "Slot is not available — already booked",
    };
  } catch (error) {
    return { available: true, message: "Proceeding to book" };
  }
}

export async function bookMeeting(
  name: string,
  email: string,
  start: string
): Promise<BookingResult> {
  const res = await fetch(`${CAL_BASE}/bookings`, {
    method: "POST",
    headers: CAL_HEADERS,
    body: JSON.stringify({
      eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
      start,
      attendee: {
        name,
        email,
        timeZone: "Asia/Kolkata",
        language: "en",
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Cal.com booking error:", JSON.stringify(data));
    // Return conflict message instead of throwing
    return {
      success: false,
      uid: "",
      meetLink: null,
      message: "This slot is already booked. Please choose a different date or time.",
    };
  }

  const meetLink =
    data?.data?.meetingUrl ??
    data?.data?.videoCallUrl ??
    data?.data?.location ??
    null;

  return {
    success: true,
    uid: data?.data?.uid ?? "unknown",
    meetLink,
    message: meetLink
      ? `Booking confirmed! Meeting link: ${meetLink}`
      : "Booking confirmed! Check your email for the meeting link.",
  };
}

export async function getAvailableSlots(): Promise<{ date: string; slots: string[] }[]> {
  try {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const url = `https://api.cal.com/v2/slots/available?eventTypeId=${process.env.CAL_EVENT_TYPE_ID}&startTime=${today.toISOString()}&endTime=${nextWeek.toISOString()}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.CAL_API_KEY}`,
        "cal-api-version": "2024-08-13",
      },
    });

    const data = await res.json();

    if (!res.ok) return [];

    const slots = data?.data?.slots || {};
    const result: { date: string; slots: string[] }[] = [];

    Object.keys(slots).forEach((date) => {
      // Convert each slot UTC time to IST readable format
      const readableSlots = slots[date].slice(0, 5).map((slot: { time: string }) => {
        const d = new Date(slot.time);
        return d.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      });

      // Format date nicely
      const dateObj = new Date(date + "T00:00:00+05:30");
      const readableDate = dateObj.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      result.push({ date: readableDate, slots: readableSlots });
    });

    return result;
  } catch (error) {
    console.error("Slots error:", error);
    return [];
  }
}
