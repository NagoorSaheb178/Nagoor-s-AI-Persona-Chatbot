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

// Global deduplication cache & in-flight request registry: ensures single booking & strictly single email
interface BookingCacheEntry {
  timestamp: number;
  result: BookingResult;
}

const globalForBooking = globalThis as unknown as {
  recentBookingsCache?: Map<string, BookingCacheEntry>;
  inFlightBookings?: Map<string, Promise<BookingResult>>;
};

const recentBookingsCache =
  globalForBooking.recentBookingsCache ??
  (globalForBooking.recentBookingsCache = new Map<string, BookingCacheEntry>());

const inFlightBookings =
  globalForBooking.inFlightBookings ??
  (globalForBooking.inFlightBookings = new Map<string, Promise<BookingResult>>());

export async function bookMeeting(
  name: string,
  email: string,
  start: string
): Promise<BookingResult> {
  const normEmail = (email || "").toLowerCase().trim();
  const startDate = new Date(start);
  const timeMs = isNaN(startDate.getTime()) ? 0 : startDate.getTime();
  const cacheKey = `${normEmail}__${timeMs}`;
  const now = Date.now();

  // 1. If this exact slot was booked by this email in the last 15 minutes, return existing result
  const existing = recentBookingsCache.get(cacheKey);
  if (existing && now - existing.timestamp < 15 * 60 * 1000) {
    console.log(`[bookMeeting] Suppressing duplicate booking for ${normEmail} at slot ${timeMs}`);
    return existing.result;
  }

  // 2. If any booking was processed for this email in the last 20 seconds (e.g. double click/speech race), return it
  let rapidResult: BookingResult | null = null;
  recentBookingsCache.forEach((v, k) => {
    if (!rapidResult && k.startsWith(`${normEmail}__`) && now - v.timestamp < 20000) {
      console.log(`[bookMeeting] Suppressing rapid repeated call for ${normEmail}`);
      rapidResult = v.result;
    }
  });
  if (rapidResult) return rapidResult;

  // 3. In-flight promise locking: If a booking request for this slot or email is ALREADY running,
  // await and return that exact same promise so Cal.com is called exactly ONCE.
  if (inFlightBookings.has(cacheKey)) {
    console.log(`[bookMeeting] In-flight booking detected for ${cacheKey}, awaiting existing request.`);
    return await inFlightBookings.get(cacheKey)!;
  }
  let inFlightPromise: Promise<BookingResult> | null = null;
  inFlightBookings.forEach((promise, k) => {
    if (!inFlightPromise && k.startsWith(`${normEmail}__`)) {
      console.log(`[bookMeeting] In-flight booking detected for ${normEmail}, awaiting existing request.`);
      inFlightPromise = promise;
    }
  });
  if (inFlightPromise) {
    return await inFlightPromise;
  }

  if (isNaN(startDate.getTime())) {
    return {
      success: false,
      uid: "",
      meetLink: null,
      message: "Invalid meeting date format. Please choose a valid upcoming date and time.",
    };
  }

  if (startDate.getTime() <= Date.now()) {
    return {
      success: false,
      uid: "",
      meetLink: null,
      message: "The requested meeting time is in the past. Please select an upcoming date and time.",
    };
  }

  // 4. Create single execution promise and register in inFlightBookings BEFORE making fetch call
  const executionPromise = (async (): Promise<BookingResult> => {
    try {
      const res = await fetch(`${CAL_BASE}/bookings`, {
        method: "POST",
        headers: CAL_HEADERS,
        body: JSON.stringify({
          eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
          start: startDate.toISOString(),
          attendee: {
            name,
            email: normEmail,
            timeZone: "Asia/Kolkata",
            language: "en",
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Cal.com booking error:", JSON.stringify(data));
        const errorMsg = data?.error?.message || data?.message || "";
        if (errorMsg.toLowerCase().includes("past")) {
          return {
            success: false,
            uid: "",
            meetLink: null,
            message: "That meeting time has already passed. Please select an upcoming weekday slot.",
          };
        }
        if (errorMsg.toLowerCase().includes("email")) {
          return {
            success: false,
            uid: "",
            meetLink: null,
            message: "Please provide a valid email address so I can send your meeting link.",
          };
        }
        return {
          success: false,
          uid: "",
          meetLink: null,
          message: "This slot is not available. Please choose a different date or time.",
        };
      }

      const meetLink =
        data?.data?.meetingUrl ??
        data?.data?.videoCallUrl ??
        data?.data?.location ??
        null;

      const bookingResult: BookingResult = {
        success: true,
        uid: data?.data?.uid ?? "unknown",
        meetLink,
        message: meetLink
          ? `Booking confirmed! Meeting link: ${meetLink}`
          : "Booking confirmed! Check your email for the meeting link.",
      };

      recentBookingsCache.set(cacheKey, { timestamp: Date.now(), result: bookingResult });
      return bookingResult;
    } finally {
      inFlightBookings.delete(cacheKey);
      inFlightBookings.delete(normEmail);
    }
  })();

  inFlightBookings.set(cacheKey, executionPromise);
  inFlightBookings.set(normEmail, executionPromise);

  return await executionPromise;
}

export interface AvailableSlotItem {
  time: string;
  iso: string;
}

export interface DayAvailableSlots {
  date: string;
  dateKey: string;
  slots: string[];
  slotDetails: AvailableSlotItem[];
}

export async function getAvailableSlots(): Promise<DayAvailableSlots[]> {
  try {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);

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
    const result: DayAvailableSlots[] = [];

    Object.keys(slots).forEach((dateKey) => {
      const rawDaySlots: { time: string }[] = slots[dateKey] || [];
      if (!Array.isArray(rawDaySlots) || rawDaySlots.length === 0) return;

      const slotDetails: AvailableSlotItem[] = [];
      const readableSlots: string[] = [];

      // Sort chronological
      rawDaySlots.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      rawDaySlots.forEach((slot) => {
        const d = new Date(slot.time);
        if (isNaN(d.getTime())) return;

        // Skip slots in past
        if (d.getTime() <= Date.now()) return;

        // Format to clean, standard IST format e.g. "09:00 AM IST"
        const timeFormatted = d.toLocaleTimeString("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        const label = `${timeFormatted} IST`;
        readableSlots.push(label);
        slotDetails.push({
          time: label,
          iso: slot.time,
        });
      });

      if (readableSlots.length === 0) return;

      // Format date nicely e.g. "Monday, October 5, 2026"
      const dateObj = new Date(dateKey + "T00:00:00+05:30");
      const readableDate = dateObj.toLocaleDateString("en-US", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      result.push({
        date: readableDate,
        dateKey,
        slots: readableSlots.slice(0, 6),
        slotDetails: slotDetails.slice(0, 6),
      });
    });

    return result;
  } catch (error) {
    console.error("Slots error:", error);
    return [];
  }
}
