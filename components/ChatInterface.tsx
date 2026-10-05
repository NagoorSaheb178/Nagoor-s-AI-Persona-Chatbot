"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { BOOKING_TOOLS, buildSystemPrompt, getDynamicWeekdaySlots } from "@/lib/prompts";
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  Send,
  Calendar,
  Clock,
  User,
  Mail,
  Check,
  CheckCircle2,
  RotateCcw,
  MessageSquare,
  ExternalLink,
  X,
  Video,
  Loader2,
  ArrowRight,
  Edit3,
  Briefcase,
  Code2,
  Sparkles,
} from "lucide-react";

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

interface BookingSlot {
  date: string;
  time: string;
  iso: string;
}

function getDynamicUpcomingSlots(): BookingSlot[] {
  const dynamicDays = getDynamicWeekdaySlots();
  const slots: BookingSlot[] = [];
  for (const day of dynamicDays) {
    for (const item of day.slotDetails) {
      slots.push({
        date: day.date,
        time: item.time,
        iso: item.iso,
      });
    }
  }
  return slots;
}

/* ── Resolves user intent & model slot response to an actual available slot ── */
function resolveSlot(
  parsed?: { date?: string; time?: string; iso?: string },
  userText?: string,
  slots: BookingSlot[] = []
): BookingSlot {
  if (slots.length === 0) {
    return (
      (parsed as BookingSlot) || {
        date: "Monday, October 5, 2026",
        time: "09:00 AM IST",
        iso: "2026-10-05T03:30:00.000Z",
      }
    );
  }

  // 1. Exact ISO match
  if (parsed?.iso) {
    const foundIso = slots.find((s) => s.iso === parsed.iso);
    if (foundIso) return foundIso;
  }

  // 2. Date and time match
  if (parsed?.date && parsed?.time) {
    const normParsedTime = parsed.time.replace(/[^0-9:]/g, "").trim();
    const foundDateTime = slots.find((s) => {
      const dateMatch =
        s.date.toLowerCase().replace(/,\s*\d{4}/, "") ===
        parsed.date!.toLowerCase().replace(/,\s*\d{4}/, "") ||
        s.date.toLowerCase().includes(parsed.date!.toLowerCase()) ||
        parsed.date!.toLowerCase().includes(s.date.toLowerCase());
      const timeMatch = s.time.replace(/[^0-9:]/g, "").trim() === normParsedTime;
      return dateMatch && timeMatch;
    });
    if (foundDateTime) return foundDateTime;
  }

  // 3. User spoken / typed text matching (e.g. "Monday 11 AM", "9:30 AM", "10:30")
  if (userText) {
    const lower = userText.toLowerCase();
    const targetDay = ["monday", "tuesday", "wednesday", "thursday", "friday"].find((d) =>
      lower.includes(d)
    );

    for (const slot of slots) {
      if (targetDay && !slot.date.toLowerCase().includes(targetDay)) continue;

      const simpleHour = slot.time.replace(/^0?(\d+):00\s*(am|pm).*/i, "$1 $2").toLowerCase();
      const colonTime = slot.time.replace(/^0?(\d+:\d+)\s*(am|pm).*/i, "$1").toLowerCase();

      if (lower.includes(simpleHour) || lower.includes(colonTime) || lower.includes(slot.time.toLowerCase().replace(" ist", ""))) {
        return slot;
      }
    }

    // Secondary pass without day constraint
    for (const slot of slots) {
      const simpleHour = slot.time.replace(/^0?(\d+):00\s*(am|pm).*/i, "$1 $2").toLowerCase();
      const colonTime = slot.time.replace(/^0?(\d+:\d+)\s*(am|pm).*/i, "$1").toLowerCase();
      if (lower.includes(simpleHour) || lower.includes(colonTime)) {
        return slot;
      }
    }
  }

  // 4. Time-only match
  if (parsed?.time) {
    const normParsedTime = parsed.time.replace(/[^0-9:]/g, "").trim();
    const foundTime = slots.find((s) => s.time.replace(/[^0-9:]/g, "").trim() === normParsedTime);
    if (foundTime) return foundTime;
  }

  // 5. Fallback to first available slot
  return slots[0];
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Hello! I'm Nagoor's assistant. How can I assist you today?",
};

const FALLBACK_SYSTEM_PROMPT = `You are Nagoor AI, the professional AI voice persona of Shaik Nagoor Saheb.
Your primary purpose is to have natural, professional conversations with visitors and help them learn about Nagoor's professional background, skills, experience, projects, and availability for meetings.
You have access to a trusted knowledge base containing Nagoor's resume and project information.

CRITICAL RULES:
1. GREETING: When user says "hi", "hello", "hey", or greets, warmly respond: "Hello! I'm Nagoor's assistant. How can I help you today?"
2. STRICT SCOPE: Only answer questions about Shaik Nagoor Saheb's profile, skills, projects, and meeting availability.
3. GRADUATE STATUS: Shaik Nagoor Saheb is a B.Tech Information Technology graduate (2026) from Velagapudi Ramakrishna Siddhartha Engineering College with an 8.08 CGPA. NEVER say he is "currently studying", "in his final year", or a "student". Always describe him as a B.Tech IT graduate and software engineer.
4. NO GENERAL DEFINITIONS: NEVER provide textbook or general encyclopedia definitions of technologies (e.g. NEVER define what React, Python, or AI is in general).
5. If asked about a skill or technology like React or Python, ONLY explain how Nagoor uses it in his projects and experience.
6. FOR PROJECTS: Nagoor has built 5 major AI and full-stack projects:
   1. Mentor AI: Full-stack AI voice mock interview platform using Vapi.ai for real-time adaptive voice interviews and a LangGraph multi-node state machine (Communication, Technical, Synthesis nodes) with custom JWT auth and MongoDB.
   2. AI Persona: This resume-grounded AI voice persona with Cal.com live meeting booking and prompt injection prevention.
   3. AI Hallucination Citation Verifier: Python and React RAG verification pipeline detecting LLM hallucinations with precision scoring and semantic citation linking.
   4. Real-Time Medical Translation & AI Assistant: Next.js, Gemini API, and Web Speech API clinical speech translation assistant across language barriers.
   5. GitGrade: AI GitHub analytics platform built during his internship at Primo Fiscal to evaluate code quality, repository health, and best practices.
   When asked about projects (in English or Telugu, e.g. "projects", "what did you build", "tell me his projects", "projects cheppu"), ALWAYS summarize all 5 projects cleanly and neatly! Never limit to just 1 or 2 projects.
7. INTERNSHIPS & EXPERIENCE:
   - Primo Fiscal (Full Stack Developer Intern, Jun 2025 - Aug 2025): Architected GitGrade with Next.js and Gemini API.
   - Next24tech (Frontend Developer Intern, Mar 2025 - May 2025): Built responsive mobile-first UI components and integrated REST APIs.
8. BOOKINGS & AVAILABILITY: Real-time availability is fetched from Cal.com. Confirm the user's exact requested time if available.
9. Keep responses natural, conversational, concise, and without any asterisks or markdown symbols.`;

/* ── Check if user wants to end voice session ─────────────────────── */
function isSessionEndingPhrase(text: string): boolean {
  if (!text) return false;
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const endKeywords = [
    "thank",
    "thanks",
    "thankyou",
    "thank u",
    "thx",
    "tq",
    "bye",
    "goodbye",
    "byebye",
    "see you",
    "that is all",
    "thats all",
    "that s all",
    "thats it",
    "that s it",
    "nothing else",
    "stop session",
    "end session",
    "end call",
    "exit",
    "close",
    "stop",
    "chalu",
    "dhanyavadalu",
    "dhanyavadamulu",
  ];

  return endKeywords.some((w) => clean === w || clean.includes(w));
}

/* ── Check if user said a simple greeting ─────────────────────────── */
function isGreetingPhrase(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
  const greetings = [
    "hi",
    "hello",
    "hey",
    "hi there",
    "hello there",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
    "namaste",
    "start",
    "hi nagoor",
    "hello nagoor",
  ];
  return greetings.includes(t);
}

/* ── Check if user said a confirmation phrase for booking ────────── */
function isBookingConfirmationPhrase(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
  const confirmations = [
    "yes",
    "yes book it",
    "yes please",
    "confirm",
    "confirm it",
    "confirm and book",
    "go ahead",
    "book it",
    "please book it",
    "proceed",
    "sure",
    "sure book it",
    "do it",
    "book this",
    "yeah",
    "yep",
    "okay book it",
    "ok book it",
    "done",
    "okay",
    "ok",
  ];
  return confirmations.includes(t) || confirmations.some((c) => t === c || t.startsWith(c + " ") || t.endsWith(" " + c));
}

/* ── Check if user wants to change or cancel booking ──────────────── */
function isBookingChangePhrase(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
  const changes = [
    "edit",
    "edit details",
    "edit it",
    "change details",
    "change time",
    "change slot",
    "change date",
    "change",
    "change it",
    "modify details",
    "update details",
    "change my details",
  ];
  return changes.some((c) => t === c || t.startsWith(c + " ") || t.endsWith(" " + c));
}

/* ── Clean markdown symbols (e.g. **bold**, *italic*) into plain text ─── */
function cleanMarkdownFormatting(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[.*?\]/g, "")         // Strip any bracket markers
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold **word** -> word
    .replace(/\*(.*?)\*/g, "$1")     // Italic *word* -> word
    .replace(/__(.*?)__/g, "$1")     // Bold __word__ -> word
    .replace(/_(.*?)_/g, "$1")       // Italic _word_ -> word
    .replace(/`([^`]+)`/g, "$1")     // Code `word` -> word
    .replace(/#{1,6}\s+/g, "")       // Headers ### -> empty
    .trim();
}

/* ── Speech Synthesis helper (Continuous, non-stalling, word-by-word reactive) ── */
let speechKeepAliveInterval: any = null;
let speechSafetyTimeout: any = null;
let activeWordTimer: any = null;
let currentSpeechId = 0;

function stopSpeaking() {
  currentSpeechId++;
  if (speechKeepAliveInterval) {
    clearInterval(speechKeepAliveInterval);
    speechKeepAliveInterval = null;
  }
  if (speechSafetyTimeout) {
    clearTimeout(speechSafetyTimeout);
    speechSafetyTimeout = null;
  }
  if (activeWordTimer) {
    clearInterval(activeWordTimer);
    activeWordTimer = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch { }
  }
}

function getBestVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    return (
      voices.find(v => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Samantha") || v.name.includes("Jenny") || v.name.includes("Guy") || v.name.includes("Rishi") || v.name.includes("Heera") || v.name.includes("Veena"))) ||
      voices.find(v => v.lang.startsWith("en") && !v.localService) ||
      voices.find(v => v.lang.startsWith("en")) ||
      voices[0] ||
      null
    );
  } catch {
    return null;
  }
}

function extractContactInfo(text: string): { name?: string; email?: string } {
  const result: { name?: string; email?: string } = {};

  // Clean common spoken phrasing for @ and .
  const normalized = text
    .replace(/\s+(?:at|@)\s+/gi, "@")
    .replace(/\s+(?:dot|\.)\s+/gi, ".");

  const emailMatch = normalized.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }

  const nameMatch = text.match(/(?:my name is|i am|this is|i'm|name is|call me)\s+([A-Za-z\s]{2,30})/i);
  if (nameMatch) {
    const raw = nameMatch[1].replace(/(and my email|and email|my email|email|the email).*/i, "").trim();
    if (raw && raw.length >= 2 && !raw.toLowerCase().includes("booking") && !raw.toLowerCase().includes("mentor")) {
      result.name = raw;
    }
  }

  return result;
}

function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onWordIndex?: (wordIndex: number, totalWords: number) => void
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }

  const hadOngoingSpeech = window.speechSynthesis.speaking || window.speechSynthesis.pending;
  stopSpeaking();
  const speechId = currentSpeechId;

  // Strip brackets, markdown symbols, and URLs to keep speech natural
  const cleanText = text
    .replace(/\[.*?\]/g, "")
    .replace(/[*_#`~]/g, "")
    .replace(/https?:\/\/\S+/g, "the video meeting link")
    .trim();

  if (!cleanText) {
    onEnd?.();
    return;
  }

  const allWords = cleanText.split(/\s+/).filter(Boolean);
  const totalWords = allWords.length;

  // Split into clean sentence chunks (max 15-20 words per chunk) to eliminate Chrome's 15-second buffer freeze
  const rawSentences = cleanText.match(/[^.!?\n]+[.!?\n]*/g) || [cleanText];
  const sentenceChunks: string[] = [];

  for (const s of rawSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > 110) {
      const subParts = trimmed.split(/([,;:]\s+)/);
      let currentChunk = "";
      for (const part of subParts) {
        if ((currentChunk + part).length > 90) {
          if (currentChunk.trim()) sentenceChunks.push(currentChunk.trim());
          currentChunk = part;
        } else {
          currentChunk += part;
        }
      }
      if (currentChunk.trim()) sentenceChunks.push(currentChunk.trim());
    } else {
      sentenceChunks.push(trimmed);
    }
  }

  if (sentenceChunks.length === 0) {
    sentenceChunks.push(cleanText);
  }

  let chunkIndex = 0;
  let wordsSpokenSoFar = 0;
  let hasStarted = false;
  let isDone = false;

  const cleanup = () => {
    if (speechKeepAliveInterval) {
      clearInterval(speechKeepAliveInterval);
      speechKeepAliveInterval = null;
    }
    if (speechSafetyTimeout) {
      clearTimeout(speechSafetyTimeout);
      speechSafetyTimeout = null;
    }
    if (activeWordTimer) {
      clearInterval(activeWordTimer);
      activeWordTimer = null;
    }
  };

  const finishSpeech = () => {
    if (isDone || speechId !== currentSpeechId) return;
    isDone = true;
    cleanup();
    onWordIndex?.(totalWords, totalWords);
    onEnd?.();
  };

  // Safety watchdog timer: guarantees speech ends and voice returns to continuous listening
  const estimatedTotalMs = Math.max(totalWords * 450 + 5000, 7000);
  speechSafetyTimeout = setTimeout(() => {
    if (speechId === currentSpeechId) {
      finishSpeech();
    }
  }, estimatedTotalMs);

  const speakChunk = (idx: number) => {
    if (isDone || speechId !== currentSpeechId || idx >= sentenceChunks.length) {
      finishSpeech();
      return;
    }

    const chunkText = sentenceChunks[idx];
    const chunkWords = chunkText.split(/\s+/).filter(Boolean);
    const chunkWordCount = chunkWords.length;
    const baseWordOffset = wordsSpokenSoFar;

    const utterance = new SpeechSynthesisUtterance(chunkText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const chosenVoice = getBestVoice();
    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang;
    } else {
      utterance.lang = "en-US";
    }

    let lastReportedLocal = 0;

    // React word-by-word boundary event
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name === "word") {
        const charSub = chunkText.slice(0, e.charIndex);
        const localWordIdx = charSub.split(/\s+/).filter(Boolean).length;
        lastReportedLocal = localWordIdx;
        const currentGlobalWord = Math.min(baseWordOffset + localWordIdx, totalWords - 1);
        onWordIndex?.(currentGlobalWord, totalWords);
      }
    };

    utterance.onstart = () => {
      if (speechId !== currentSpeechId) return;
      if (!hasStarted) {
        hasStarted = true;
        onStart?.();
      }
      onWordIndex?.(baseWordOffset, totalWords);

      // Pacing timer fallback for voices/browsers with sparse boundary triggers
      if (activeWordTimer) clearInterval(activeWordTimer);
      let localStep = lastReportedLocal;
      activeWordTimer = setInterval(() => {
        if (localStep < chunkWordCount) {
          localStep++;
          const currentGlobalWord = Math.min(baseWordOffset + localStep, totalWords - 1);
          onWordIndex?.(currentGlobalWord, totalWords);
        }
      }, 290);
    };

    utterance.onend = () => {
      if (speechId !== currentSpeechId) return;
      if (activeWordTimer) {
        clearInterval(activeWordTimer);
        activeWordTimer = null;
      }
      wordsSpokenSoFar += chunkWordCount;
      onWordIndex?.(Math.min(wordsSpokenSoFar, totalWords), totalWords);

      chunkIndex++;
      if (chunkIndex < sentenceChunks.length) {
        speakChunk(chunkIndex);
      } else {
        finishSpeech();
      }
    };

    utterance.onerror = (e: any) => {
      if (speechId !== currentSpeechId) return;
      if (e?.error === "interrupted" || e?.error === "canceled") {
        return;
      }
      console.warn("[speakText] Chunk utterance error:", e?.error || e);
      if (activeWordTimer) {
        clearInterval(activeWordTimer);
        activeWordTimer = null;
      }
      wordsSpokenSoFar += chunkWordCount;
      chunkIndex++;
      if (chunkIndex < sentenceChunks.length) {
        speakChunk(chunkIndex);
      } else {
        finishSpeech();
      }
    };

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[speakText] speak failed:", err);
      finishSpeech();
    }
  };

  // If there was ongoing speech that was cancelled, give Chrome 60ms to flush the cancel IPC
  if (hadOngoingSpeech) {
    setTimeout(() => {
      if (speechId === currentSpeechId) {
        try {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        } catch { }
        speakChunk(0);
      }
    }, 60);
  } else {
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch { }
    speakChunk(0);
  }
}

function getInitialSystemPrompt(): string {
  const dynamicDays = getDynamicWeekdaySlots();
  return buildSystemPrompt("", dynamicDays);
}

/* ── Main Voice-Only Interface ────────────────────────────────────── */
export default function ChatInterface() {
  const [systemPrompt, setSystemPrompt] = useState<string>(() => getInitialSystemPrompt());

  /* ── Tab Switcher: Independent Voice AI vs Text Chat ────────────── */
  const [activeTab, setActiveTab] = useState<"voice" | "chat">("voice");

  /* ── Independent Text Chat State (Never mixed with voice) ───────── */
  const [chatMessages, setChatMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [chatInput, setChatInput] = useState("");
  const [chatIsLoading, setChatIsLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<Message[]>([INITIAL_MESSAGE]);
  chatMessagesRef.current = chatMessages;

  useEffect(() => {
    if (activeTab === "chat") {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  /* ── Voice Engine State (Never mixed with text chat) ────────────── */
  const [voiceMessages, setVoiceMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  const [voiceIsListening, setVoiceIsListening] = useState(false);
  const [voiceIsLoading, setVoiceIsLoading] = useState(false);
  const [voiceIsSpeaking, setVoiceIsSpeaking] = useState(false);
  const [voiceLiveTranscript, setVoiceLiveTranscript] = useState("");
  const [voiceSubtitle, setVoiceSubtitle] = useState("");
  const [spokenWordIndex, setSpokenWordIndex] = useState<number>(-1);
  const [spokenWordsList, setSpokenWordsList] = useState<string[]>([]);
  const [voiceStatusText, setVoiceStatusText] = useState("Tap to start conversation");

  const updateVoiceSubtitle = useCallback((text: string) => {
    setVoiceSubtitle(text);
    if (text) {
      setSpokenWordsList(text.split(/\s+/).filter(Boolean));
      setSpokenWordIndex(-1);
    } else {
      setSpokenWordsList([]);
      setSpokenWordIndex(-1);
    }
  }, []);

  /* ── Booking Modals State ───────────────────────────────────────── */
  const [showContactModal, setShowContactModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookingSuccessModal, setBookingSuccessModal] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [hasBookedSuccessfully, setHasBookedSuccessfully] = useState(false);

  // Contact form inputs
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [availableSlots, setAvailableSlots] = useState<BookingSlot[]>(() => getDynamicUpcomingSlots());
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot>(() => getDynamicUpcomingSlots()[0]);
  const [bookingResultData, setBookingResultData] = useState<{ meetLink: string | null } | null>(null);

  // Keep ref mirrors to avoid stale closures in Web Speech callbacks
  const voiceSessionActiveRef = useRef(false);
  const voiceIsSpeakingRef = useRef(false);
  const voiceIsLoadingRef = useRef(false);
  const voiceIsListeningRef = useRef(false);
  const voiceMessagesRef = useRef<Message[]>([INITIAL_MESSAGE]);
  const voiceRecognitionRef = useRef<any>(null);
  const voiceLiveTranscriptRef = useRef("");
  const showContactModalRef = useRef(false);
  const showConfirmationModalRef = useRef(false);
  const contactNameRef = useRef("");
  const contactEmailRef = useRef("");
  const selectedSlotRef = useRef<BookingSlot>(getDynamicUpcomingSlots()[0]);
  const isBookingInProgressRef = useRef(false);
  const hasBookedSuccessfullyRef = useRef(false);
  const restartListeningTimeoutRef = useRef<any>(null);

  const cleanupRecognition = useCallback(() => {
    if (restartListeningTimeoutRef.current) {
      clearTimeout(restartListeningTimeoutRef.current);
      restartListeningTimeoutRef.current = null;
    }
    if (voiceRecognitionRef.current) {
      const old = voiceRecognitionRef.current;
      old.onstart = null;
      old.onresult = null;
      old.onerror = null;
      old.onend = null;
      try {
        old.abort();
      } catch { }
      voiceRecognitionRef.current = null;
    }
  }, []);

  voiceSessionActiveRef.current = voiceSessionActive;
  voiceIsSpeakingRef.current = voiceIsSpeaking;
  voiceIsLoadingRef.current = voiceIsLoading;
  voiceIsListeningRef.current = voiceIsListening;
  voiceMessagesRef.current = voiceMessages;
  showContactModalRef.current = showContactModal;
  showConfirmationModalRef.current = showConfirmationModal;
  contactNameRef.current = contactName;
  contactEmailRef.current = contactEmail;
  selectedSlotRef.current = selectedSlot;

  // Initialize Puter.js in quiet mode to suppress console noise
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).puter) {
      (window as any).puter.quiet = true;
    }
  }, []);

  // Pre-fetch enhanced system prompt and live Cal.com slots
  useEffect(() => {
    fetch("/api/system-prompt")
      .then((res) => res.json())
      .then((data) => {
        if (data.systemPrompt) setSystemPrompt(data.systemPrompt);
      })
      .catch((err) => console.error("Failed to load enhanced system prompt", err));

    // Dynamic real-time slot loading from Cal.com
    fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolName: "getAvailableSlots" }),
    })
      .then((res) => res.json())
      .then((data) => {
        try {
          const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
          if (parsed?.slots && Array.isArray(parsed.slots) && parsed.slots.length > 0) {
            const dynamicSlots: BookingSlot[] = [];
            parsed.slots.forEach((day: any) => {
              if (day.slotDetails && Array.isArray(day.slotDetails)) {
                day.slotDetails.forEach((sd: any) => {
                  const cleanTime = sd.time.includes("IST") ? sd.time : `${sd.time} IST`;
                  dynamicSlots.push({
                    date: day.date,
                    time: cleanTime,
                    iso: sd.iso,
                  });
                });
              } else if (day.slots && Array.isArray(day.slots)) {
                day.slots.forEach((s: string) => {
                  const cleanTime = s.includes("IST") ? s : `${s} IST`;
                  dynamicSlots.push({
                    date: day.date,
                    time: cleanTime,
                    iso: `${day.dateKey || day.date}T${cleanTime.replace(/[^0-9:]/g, "")}`,
                  });
                });
              }
            });
            if (dynamicSlots.length > 0) {
              setAvailableSlots(dynamicSlots);
              setSelectedSlot(dynamicSlots[0]);
            }
          }
        } catch (e) {
          console.warn("Could not parse dynamic Cal.com slots", e);
        }
      })
      .catch((err) => console.warn("Failed to fetch live Cal.com slots", err));
  }, []);

  /* ── Chat loop execution ─────────────────────────────────────────── */
  const runChatLoop = async (
    currentMessages: Message[],
    updateMessages: (msgs: Message[]) => void
  ): Promise<string | null> => {
    if (!(window as any).puter) {
      throw new Error("Puter.js SDK is loading. Please try again in a few seconds.");
    }

    let conversationMessages = [...currentMessages];
    let lastContent: string | null = null;

    // Detect if current turn involves booking/availability to pass tools only when needed (significantly speeds up response time)
    const lastUserMsg = [...conversationMessages].reverse().find((m) => m.role === "user");
    const lastUserText = (lastUserMsg?.content || "").toLowerCase();
    const isBookingQuery =
      lastUserText.includes("book") ||
      lastUserText.includes("schedule") ||
      lastUserText.includes("slot") ||
      lastUserText.includes("available") ||
      lastUserText.includes("meeting") ||
      lastUserText.includes("appointment") ||
      lastUserText.includes("time") ||
      lastUserText.includes("call");

    while (true) {
      const chatOptions: any = {
        model: "gpt-4o-mini",
        stream: false,
      };
      if (isBookingQuery) {
        chatOptions.tools = BOOKING_TOOLS;
      }

      const response = await (window as any).puter.ai.chat(conversationMessages, chatOptions);

      const message = response?.message;
      if (!message) throw new Error("No response received from AI model.");

      const assistantMessage: Message = {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls,
      };

      conversationMessages.push(assistantMessage);
      if (assistantMessage.content) lastContent = assistantMessage.content;
      updateMessages([...conversationMessages]);

      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          try {
            const toolArgs =
              typeof tc.function.arguments === "string"
                ? JSON.parse(tc.function.arguments)
                : tc.function.arguments;
            const res = await fetch("/api/tools", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ toolName: tc.function.name, args: toolArgs }),
            });
            const data = await res.json();
            conversationMessages.push({
              role: "tool",
              content: data.result || JSON.stringify(data.error),
              tool_call_id: tc.id,
            });
          } catch {
            conversationMessages.push({
              role: "tool",
              content: JSON.stringify({ error: "Failed to execute tool" }),
              tool_call_id: tc.id,
            });
          }
        }
        updateMessages([...conversationMessages]);
      } else {
        break;
      }
    }

    // Safety fallback: If model was silent after tool call, synthesize spoken answer
    if (!lastContent) {
      const lastToolMsg = [...conversationMessages].reverse().find((m) => m.role === "tool");
      if (lastToolMsg?.content) {
        try {
          const parsed = JSON.parse(lastToolMsg.content);
          if (parsed.slots && parsed.slots.length > 0) {
            const firstDay = parsed.slots[0];
            const slotList = firstDay.slots?.slice(0, 4).join(", ") || "09:00 AM IST, 09:30 AM IST";
            const cleanSlotList = slotList.includes("IST") ? slotList : `${slotList} IST`;
            lastContent = `Nagoor has availability on ${firstDay.date} with slots at ${cleanSlotList}. Which time would you prefer?`;
          } else if (parsed.message) {
            lastContent = parsed.message;
          }
        } catch { }
      }
    }

    if (!lastContent) {
      lastContent = "How can I help you with scheduling or learning about Nagoor?";
    }

    return lastContent;
  };

  /* ── Handle Independent Text Chat Submission ─────────────────────── */
  const handleSendChatMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || chatInput).trim();
    if (!textToSend || chatIsLoading) return;

    setChatInput("");
    const userMsg: Message = { role: "user", content: textToSend };
    const updated = [...chatMessagesRef.current, userMsg];
    chatMessagesRef.current = updated;
    setChatMessages(updated);
    setChatIsLoading(true);

    try {
      const lowerText = textToSend.toLowerCase();
      const userAskedToBook =
        lowerText.includes("book") ||
        lowerText.includes("schedule") ||
        lowerText.includes("slot") ||
        lowerText.includes("meeting") ||
        lowerText.includes("call");

      let replyContent: string | null = null;

      if (isGreetingPhrase(textToSend)) {
        replyContent = "Hello! I'm Nagoor's assistant. How can I help you today?";
        const assistantMsg: Message = { role: "assistant", content: replyContent };
        chatMessagesRef.current = [...updated, assistantMsg];
        setChatMessages(chatMessagesRef.current);
      } else {
        const apiMessages = [
          { role: "system", content: systemPrompt },
          ...updated.slice(1),
        ];

        replyContent = await runChatLoop(apiMessages as Message[], (msgs) => {
          chatMessagesRef.current = msgs;
          setChatMessages(msgs);
        });
      }

      if (replyContent && userAskedToBook) {
        const formMatch = replyContent.match(/\[OPEN_BOOKING_FORM:date=([^|]+)\|time=([^|]+)\|iso=([^\]]+)\]/i);
        const parsed = formMatch
          ? {
            date: formMatch[1].trim(),
            time: formMatch[2].trim(),
            iso: formMatch[3].trim(),
          }
          : undefined;
        const bestSlot = resolveSlot(parsed, textToSend, availableSlots);
        setSelectedSlot(bestSlot);
        selectedSlotRef.current = bestSlot;
        setShowContactModal(true);
      }
    } catch (err) {
      console.error("Chat error:", err);
      const errorMsg: Message = {
        role: "assistant",
        content: "I had trouble responding. Please ask again in a moment.",
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setChatIsLoading(false);
    }
  };

  /* ── Trigger Cal.com Booking Execution (Strictly Single Execution & Guaranteed 1 Email) ── */
  const executeBooking = async () => {
    // Strictly prevent double execution / race conditions from multiple clicks or simultaneous voice triggers
    if (isBookingInProgressRef.current || hasBookedSuccessfullyRef.current) {
      console.log("[executeBooking] Booking already completed or in progress. Suppressing duplicate call.");
      return;
    }
    isBookingInProgressRef.current = true;
    setIsBookingLoading(true);
    setBookingError(null);

    // Immediately disarm and hide the confirmation modal
    setShowConfirmationModal(false);
    showConfirmationModalRef.current = false;

    // Immediately abort voice recognition to avoid any speech collision/race
    try {
      voiceRecognitionRef.current?.abort();
    } catch { }
    setVoiceIsListening(false);
    voiceIsListeningRef.current = false;

    const nameToBook = contactNameRef.current.trim();
    const emailToBook = contactEmailRef.current.trim();
    const slotToBook = selectedSlotRef.current;

    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: "bookMeeting",
          args: {
            name: nameToBook,
            email: emailToBook,
            start: slotToBook.iso,
          },
        }),
      });

      const data = await res.json();
      const result = typeof data.result === "string" ? JSON.parse(data.result) : data.result;

      if (result && result.success) {
        hasBookedSuccessfullyRef.current = true;
        setHasBookedSuccessfully(true);
        isBookingInProgressRef.current = false;
        setBookingResultData({ meetLink: result.meetLink || null });
        setBookingSuccessModal(true);
        setIsBookingLoading(false);

        const successSpeech = `Done. Your meeting has been confirmed for ${slotToBook.date} at ${slotToBook.time}.`;
        setVoiceLiveTranscript("");
        voiceLiveTranscriptRef.current = "";
        updateVoiceSubtitle(successSpeech);
        setVoiceStatusText("Booking Confirmed!");

        speakText(
          successSpeech,
          () => {
            setVoiceIsSpeaking(true);
            setSpokenWordIndex(0);
          },
          () => {
            setVoiceIsSpeaking(false);
            if (voiceSessionActiveRef.current) {
              setVoiceStatusText("Listening for your next question...");
              startContinuousListening();
            }
          },
          (wordIdx) => setSpokenWordIndex(wordIdx)
        );
      } else {
        isBookingInProgressRef.current = false;
        const errorMsg = result?.message || "Could not complete the booking on Cal.com. Please try another time.";
        setBookingError(errorMsg);
        setShowConfirmationModal(true);
        showConfirmationModalRef.current = true;
        setIsBookingLoading(false);

        const failSpeech = "I wasn't able to complete the booking right now. Would you like to select another time?";
        setVoiceLiveTranscript("");
        voiceLiveTranscriptRef.current = "";
        updateVoiceSubtitle(failSpeech);

        speakText(
          failSpeech,
          () => {
            setVoiceIsSpeaking(true);
            setSpokenWordIndex(0);
          },
          () => {
            setVoiceIsSpeaking(false);
            if (voiceSessionActiveRef.current) {
              startContinuousListening();
            }
          },
          (wordIdx) => setSpokenWordIndex(wordIdx)
        );
      }
    } catch (err) {
      console.error("Booking error:", err);
      isBookingInProgressRef.current = false;
      setBookingError("Connection error while reserving slot. Please try again.");
      setShowConfirmationModal(true);
      showConfirmationModalRef.current = true;
      setIsBookingLoading(false);
    }
  };

  /* ── Continuous Hands-Free Voice Loop ────────────────────────────── */
  const startContinuousListening = useCallback(() => {
    if (!voiceSessionActiveRef.current) return;
    if (voiceIsSpeakingRef.current || voiceIsLoadingRef.current) return;

    const SpeechRecognition =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      setVoiceSessionActive(false);
      voiceSessionActiveRef.current = false;
      return;
    }

    cleanupRecognition();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    const navLang = (typeof navigator !== "undefined" && navigator.language) || "en-IN";
    recognition.lang = navLang.startsWith("en") ? navLang : "en-IN";
    voiceRecognitionRef.current = recognition;

    let localFinalTranscript = "";
    let speechSilenceTimer: any = null;

    const stopEarlyOnSilence = () => {
      if (speechSilenceTimer) {
        clearTimeout(speechSilenceTimer);
        speechSilenceTimer = null;
      }
      try {
        recognition.stop();
      } catch { }
    };

    recognition.onstart = () => {
      if (voiceRecognitionRef.current !== recognition) return;

      voiceIsListeningRef.current = true;
      setVoiceIsListening(true);
      setVoiceStatusText("Listening to you... Speak now");
      voiceLiveTranscriptRef.current = "";
      setVoiceLiveTranscript("");
    };

    recognition.onresult = (event: any) => {
      if (voiceRecognitionRef.current !== recognition) return;
      let interim = "";
      let hasFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          localFinalTranscript += text;
          hasFinal = true;
        } else {
          interim += text;
        }
      }
      const current = (localFinalTranscript + " " + interim).trim();
      voiceLiveTranscriptRef.current = current;
      setVoiceLiveTranscript(current);

      if (speechSilenceTimer) clearTimeout(speechSilenceTimer);
      if (current.length > 0) {
        // Stop after 700ms on final or 1000ms on interim so user isn't cut off mid-thought
        const delay = hasFinal ? 700 : 1000;
        speechSilenceTimer = setTimeout(() => {
          stopEarlyOnSilence();
        }, delay);
      }
    };

    recognition.onerror = (e: any) => {
      if (voiceRecognitionRef.current !== recognition) return;
      if (speechSilenceTimer) {
        clearTimeout(speechSilenceTimer);
        speechSilenceTimer = null;
      }
      if (e.error === "not-allowed") {
        setVoiceStatusText("Microphone access blocked. Please allow browser permissions.");
        setVoiceSessionActive(false);
        voiceSessionActiveRef.current = false;
        voiceIsListeningRef.current = false;
        setVoiceIsListening(false);
        return;
      }
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Voice recognition warning:", e.error);
      }
    };

    recognition.onend = async () => {
      if (voiceRecognitionRef.current !== recognition) return;
      if (speechSilenceTimer) {
        clearTimeout(speechSilenceTimer);
        speechSilenceTimer = null;
      }
      voiceIsListeningRef.current = false;
      setVoiceIsListening(false);

      if (!voiceSessionActiveRef.current) return;

      const userSpokenText = (localFinalTranscript || voiceLiveTranscriptRef.current).trim();

      if (userSpokenText) {
        setVoiceLiveTranscript(userSpokenText);

        // Auto-extract contact info if user provides their name/email via speech
        const extracted = extractContactInfo(userSpokenText);
        if (extracted.name) {
          setContactName(extracted.name);
          contactNameRef.current = extracted.name;
        }
        if (extracted.email) {
          setContactEmail(extracted.email);
          contactEmailRef.current = extracted.email;
        }

        // Check if user is confirming or changing an open Confirmation Card
        if (showConfirmationModalRef.current && !hasBookedSuccessfullyRef.current && !isBookingInProgressRef.current) {
          if (isBookingConfirmationPhrase(userSpokenText)) {
            executeBooking();
            return;
          }
          if (isBookingChangePhrase(userSpokenText)) {
            setShowConfirmationModal(false);
            showConfirmationModalRef.current = false;
            setShowContactModal(true);
            showContactModalRef.current = true;
            speakText(
              "Sure, you can edit your details now.",
              () => {
                setVoiceIsSpeaking(true);
                voiceIsSpeakingRef.current = true;
                setSpokenWordIndex(0);
              },
              () => {
                setVoiceIsSpeaking(false);
                voiceIsSpeakingRef.current = false;
                if (voiceSessionActiveRef.current) {
                  startContinuousListening();
                }
              },
              (wordIdx) => setSpokenWordIndex(wordIdx)
            );
            return;
          }
        }

        const shouldEndSession = isSessionEndingPhrase(userSpokenText);
        const isUserGreeting = isGreetingPhrase(userSpokenText);

        const userMessage: Message = { role: "user", content: userSpokenText };
        const updated = [...voiceMessagesRef.current, userMessage];
        voiceMessagesRef.current = updated;
        setVoiceMessages(updated);

        setVoiceIsLoading(true);
        voiceIsLoadingRef.current = true;
        setVoiceStatusText("Thinking...");

        try {
          let replyText: string | null = null;

          if (shouldEndSession) {
            voiceSessionActiveRef.current = false;
            setVoiceSessionActive(false);
            try {
              voiceRecognitionRef.current?.abort();
            } catch { }
            setVoiceIsListening(false);
            voiceIsListeningRef.current = false;
            setVoiceIsLoading(false);
            voiceIsLoadingRef.current = false;
            setVoiceStatusText("Ending session...");

            const farewell = "You are very welcome! Feel free to reach out anytime. Have a wonderful day!";
            const assistantMsg: Message = { role: "assistant", content: farewell };
            voiceMessagesRef.current = [...updated, assistantMsg];
            setVoiceMessages(voiceMessagesRef.current);

            setVoiceLiveTranscript("");
            voiceLiveTranscriptRef.current = "";
            updateVoiceSubtitle(farewell);

            speakText(
              farewell,
              () => {
                setVoiceIsSpeaking(true);
                voiceIsSpeakingRef.current = true;
                setSpokenWordIndex(0);
              },
              () => {
                setVoiceIsSpeaking(false);
                voiceIsSpeakingRef.current = false;
                setVoiceStatusText("Conversation ended. Tap to start again.");
              },
              (wordIdx) => setSpokenWordIndex(wordIdx)
            );
            return;
          } else if (isUserGreeting) {
            replyText = "Hello! I'm Nagoor's assistant. How can I help you today?";
            const assistantMsg: Message = { role: "assistant", content: replyText };
            voiceMessagesRef.current = [...updated, assistantMsg];
            setVoiceMessages(voiceMessagesRef.current);
          } else {
            const apiMessages = [
              { role: "system", content: systemPrompt },
              ...updated.slice(1),
            ];
            replyText = await runChatLoop(apiMessages as Message[], (msgs) => {
              voiceMessagesRef.current = msgs;
              setVoiceMessages(msgs);
            });
          }

          setVoiceIsLoading(false);
          voiceIsLoadingRef.current = false;

          if (replyText) {
            const formMatch = replyText.match(/\[OPEN_BOOKING_FORM:date=([^|]+)\|time=([^|]+)\|iso=([^\]]+)\]/i);
            const lowerUser = userSpokenText.toLowerCase();
            const lowerReply = replyText.toLowerCase();

            const userAskedToBook =
              lowerUser.includes("book") ||
              lowerUser.includes("schedule") ||
              lowerUser.includes("appointment") ||
              lowerUser.includes("reserve") ||
              lowerUser.includes("slot") ||
              lowerUser.includes("call") ||
              lowerUser.includes("meeting");

            const replyIndicatesBooking =
              formMatch !== null ||
              lowerReply.includes("open_booking_form") ||
              lowerReply.includes("need your full name and email") ||
              lowerReply.includes("that time is available") ||
              (userAskedToBook && (
                lowerReply.includes("available") ||
                lowerReply.includes("nagoor is available") ||
                lowerReply.includes("sure") ||
                lowerReply.includes("slot") ||
                lowerReply.includes("time") ||
                lowerReply.includes("book") ||
                lowerReply.includes("calendar") ||
                lowerReply.includes("schedule")
              ));

            if (replyIndicatesBooking && !showContactModalRef.current && !showConfirmationModalRef.current) {
              const parsed = formMatch
                ? {
                  date: formMatch[1].trim(),
                  time: formMatch[2].trim(),
                  iso: formMatch[3].trim(),
                }
                : undefined;
              const bestSlot = resolveSlot(parsed, userSpokenText, availableSlots);
              setSelectedSlot(bestSlot);
              selectedSlotRef.current = bestSlot;
              setShowContactModal(true);
              showContactModalRef.current = true;
            }

            const cleanSpoken = cleanMarkdownFormatting(replyText);
            setVoiceLiveTranscript("");
            voiceLiveTranscriptRef.current = "";
            updateVoiceSubtitle(cleanSpoken);
            setVoiceStatusText(shouldEndSession ? "Ending session..." : "Speaking...");

            speakText(
              cleanSpoken,
              () => {
                setVoiceIsSpeaking(true);
                voiceIsSpeakingRef.current = true;
                setSpokenWordIndex(0);
              },
              () => {
                setVoiceIsSpeaking(false);
                voiceIsSpeakingRef.current = false;
                if (shouldEndSession) {
                  voiceSessionActiveRef.current = false;
                  setVoiceSessionActive(false);
                  setVoiceLiveTranscript("");
                  voiceLiveTranscriptRef.current = "";
                  updateVoiceSubtitle("");
                  setVoiceStatusText("Conversation ended. Tap to start again.");
                } else if (voiceSessionActiveRef.current) {
                  setVoiceStatusText("Listening to you... Speak now");
                  setTimeout(() => {
                    if (voiceSessionActiveRef.current && !voiceIsSpeakingRef.current && !voiceIsLoadingRef.current) {
                      startContinuousListening();
                    }
                  }, 120);
                }
              },
              (wordIdx) => setSpokenWordIndex(wordIdx)
            );
          } else if (voiceSessionActiveRef.current) {
            startContinuousListening();
          }
        } catch (err) {
          console.error("Voice error:", err);
          setVoiceIsLoading(false);
          voiceIsLoadingRef.current = false;
          if (voiceSessionActiveRef.current) {
            speakText(
              "I had a brief connection issue. Could you please repeat that?",
              () => {
                setVoiceIsSpeaking(true);
                voiceIsSpeakingRef.current = true;
                setSpokenWordIndex(0);
              },
              () => {
                setVoiceIsSpeaking(false);
                voiceIsSpeakingRef.current = false;
                if (voiceSessionActiveRef.current) {
                  startContinuousListening();
                }
              },
              (wordIdx) => setSpokenWordIndex(wordIdx)
            );
          }
        }
      } else {
        // No speech detected: restart listening cleanly if session remains active and AI is not speaking/loading
        if (voiceSessionActiveRef.current && !voiceIsSpeakingRef.current && !voiceIsLoadingRef.current) {
          restartListeningTimeoutRef.current = setTimeout(() => {
            if (voiceSessionActiveRef.current && !voiceIsSpeakingRef.current && !voiceIsLoadingRef.current) {
              startContinuousListening();
            }
          }, 250);
        }
      }
    };

    try {
      recognition.start();
      voiceIsListeningRef.current = true;
      setVoiceIsListening(true);
    } catch (err: any) {
      if (err?.name === "InvalidStateError" || String(err).includes("already started")) {
        voiceIsListeningRef.current = true;
        setVoiceIsListening(true);
      } else {
        voiceIsListeningRef.current = false;
        setVoiceIsListening(false);
        console.warn("Could not start recognition:", err);
      }
    }
  }, [systemPrompt, cleanupRecognition]);

  // Heartbeat watchdog: Guarantees voice listening NEVER silently dies or freezes during an active session
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (
        voiceSessionActiveRef.current &&
        !voiceIsSpeakingRef.current &&
        !voiceIsLoadingRef.current &&
        !voiceIsListeningRef.current
      ) {
        startContinuousListening();
      }
    }, 1500);

    return () => clearInterval(watchdog);
  }, [startContinuousListening]);

  /* ── Handle Contact Form Continue ────────────────────────────────── */
  const handleContactFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = contactName.trim();
    const trimmedEmail = contactEmail.trim();

    if (trimmedName.length < 2) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return;

    // 1. Close contact form
    setShowContactModal(false);

    // 2. Open confirmation card
    setShowConfirmationModal(true);

    // 3. Return control to voice agent & AI speaks confirmation prompt
    const confirmPrompt = `Thanks. I have your details. Your meeting is scheduled for ${selectedSlot.date} at ${selectedSlot.time}. Please check the details on your screen and confirm to book, or click edit to change.`;
    updateVoiceSubtitle(confirmPrompt);
    setVoiceStatusText("Please check details and confirm to book");

    speakText(
      confirmPrompt,
      () => {
        setVoiceIsSpeaking(true);
        setSpokenWordIndex(0);
      },
      () => {
        setVoiceIsSpeaking(false);
        // Start continuous voice listening so user can say "Yes", "Confirm", "Book it"
        if (voiceSessionActiveRef.current) {
          startContinuousListening();
        }
      },
      (wordIdx) => setSpokenWordIndex(wordIdx)
    );
  };

  /* ── Toggle Voice Session ────────────────────────────────────────── */
  const handleToggleVoiceSession = () => {
    if (voiceSessionActive) {
      voiceSessionActiveRef.current = false;
      setVoiceSessionActive(false);
      cleanupRecognition();
      stopSpeaking();
      setVoiceIsSpeaking(false);
      setVoiceIsListening(false);
      setVoiceIsLoading(false);
      setVoiceLiveTranscript("");
      voiceLiveTranscriptRef.current = "";
      updateVoiceSubtitle("");
      setVoiceStatusText("Session ended. Tap to start again.");
    } else {
      // 1. Preload voices & resume audio context
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        try {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        } catch { }
      }

      // 2. Request mic permission explicitly via getUserMedia to unlock audio input immediately
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            stream.getTracks().forEach((track) => track.stop());
          })
          .catch((err) => {
            console.warn("Microphone access check:", err);
          });
      }

      cleanupRecognition();
      voiceSessionActiveRef.current = true;
      setVoiceSessionActive(true);

      const welcomeGreeting = "Hello! I'm Nagoor's assistant. How can I help you today?";
      const freshMessages: Message[] = [{ role: "assistant", content: welcomeGreeting }];
      setVoiceMessages(freshMessages);
      voiceMessagesRef.current = freshMessages;
      voiceLiveTranscriptRef.current = "";
      setVoiceLiveTranscript("");
      updateVoiceSubtitle(welcomeGreeting);
      setVoiceStatusText("Speaking...");

      speakText(
        welcomeGreeting,
        () => {
          setVoiceIsSpeaking(true);
          setSpokenWordIndex(0);
        },
        () => {
          setVoiceIsSpeaking(false);
          if (voiceSessionActiveRef.current) {
            setVoiceStatusText("Listening to you... Speak now");
            startContinuousListening();
          }
        },
        (wordIdx) => setSpokenWordIndex(wordIdx)
      );
    }
  };

  // Distinct Date and Time separation for slot selection
  const availableDates = Array.from(new Set(availableSlots.map((s) => s.date)));
  const slotsForSelectedDate = availableSlots.filter(
    (s) =>
      s.date === selectedSlot.date ||
      s.date.toLowerCase().replace(/,\s*\d{4}/, "") ===
      selectedSlot.date.toLowerCase().replace(/,\s*\d{4}/, "")
  );
  const effectiveSlotsForDate =
    slotsForSelectedDate.length > 0 ? slotsForSelectedDate : availableSlots.slice(0, 6);

  const isFormValid =
    contactName.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim());

  return (
    <div className="relative flex flex-col h-[100dvh] bg-[#090a0f] text-zinc-100 overflow-hidden select-none">
      {/* ── Top Header ──────────────────────────────────────────────── */}
      <header className="relative z-10 flex-shrink-0 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand / Persona Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-100 font-semibold text-xs tracking-wider shadow-sm">
                NS
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zinc-950">
                <span className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-40" />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 leading-tight tracking-tight truncate">
                Shaik Nagoor Saheb
              </h1>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5 font-medium truncate">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="truncate">{activeTab === "voice" ? "Voice AI Active" : "Chat AI Active"}</span>
              </p>
            </div>
          </div>

          {/* Mode Switcher: Voice vs Chat + Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-inner">
              <button
                type="button"
                id="tab-voice-button"
                onClick={() => setActiveTab("voice")}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === "voice"
                  ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/70"
                  : "text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Voice</span>
              </button>
              <button
                type="button"
                id="tab-chat-button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                  setVoiceIsSpeaking(false);
                  setActiveTab("chat");
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === "chat"
                  ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/70"
                  : "text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            </div>

            {/* Reset Button */}
            <button
              type="button"
              id="new-session-button"
              onClick={() => {
                if (activeTab === "voice") {
                  if (voiceSessionActiveRef.current) {
                    voiceSessionActiveRef.current = false;
                    setVoiceSessionActive(false);
                    try {
                      voiceRecognitionRef.current?.abort();
                    } catch { }
                    stopSpeaking();
                  }
                  const fresh: Message[] = [INITIAL_MESSAGE];
                  setVoiceMessages(fresh);
                  voiceMessagesRef.current = fresh;
                  setVoiceLiveTranscript("");
                  voiceLiveTranscriptRef.current = "";
                  updateVoiceSubtitle("");
                  setVoiceStatusText("Tap to start conversation");
                  setVoiceIsSpeaking(false);
                  setVoiceIsListening(false);
                  setVoiceIsLoading(false);
                } else {
                  const fresh: Message[] = [INITIAL_MESSAGE];
                  setChatMessages(fresh);
                  chatMessagesRef.current = fresh;
                  setChatInput("");
                }
                setShowContactModal(false);
                setShowConfirmationModal(false);
                setBookingSuccessModal(false);
              }}
              className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer"
              title="Reset conversation"
              aria-label="Reset conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">Reset</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main View: Voice AI or Text Chat (Independent) ─────────── */}
      {activeTab === "voice" ? (
        /* ── Voice-First Clean Stage ───────────────────────────────── */
        <main className="relative z-10 flex-1 flex flex-col items-center justify-between p-3 sm:p-6 md:p-8 max-w-xl mx-auto w-full h-[calc(100dvh-57px)] sm:h-[calc(100dvh-64px)] overflow-y-auto">
          {/* Clean Central Microphone Visualizer */}
          <div className="relative flex flex-col items-center justify-center my-auto py-2 sm:py-4">
            <div
              id="voice-orb-interactive"
              onClick={handleToggleVoiceSession}
              role="button"
              tabIndex={0}
              aria-label="Toggle voice session"
              className={`w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 select-none ${voiceIsListening
                ? "bg-rose-500/10 border-2 border-rose-500/50 voice-listening-ring"
                : voiceIsSpeaking
                  ? "bg-emerald-500/10 border-2 border-emerald-500/50 voice-speaking-ring"
                  : voiceIsLoading
                    ? "bg-zinc-900 border-2 border-amber-500/40"
                    : voiceSessionActive
                      ? "bg-zinc-900 border-2 border-blue-500/40"
                      : "bg-zinc-900 border border-zinc-700/80 hover:border-zinc-500 hover:bg-zinc-850"
                }`}
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-zinc-950 flex flex-col items-center justify-center p-3 sm:p-4 border border-zinc-800 shadow-inner">
                {voiceIsListening ? (
                  <div className="flex items-center gap-1.5 h-10">
                    <span className="w-1.5 bg-rose-400 rounded-full sound-wave-bar" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 bg-rose-400 rounded-full sound-wave-bar" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 bg-rose-400 rounded-full sound-wave-bar" style={{ animationDelay: "300ms" }} />
                    <span className="w-1.5 bg-rose-400 rounded-full sound-wave-bar" style={{ animationDelay: "450ms" }} />
                    <span className="w-1.5 bg-rose-400 rounded-full sound-wave-bar" style={{ animationDelay: "200ms" }} />
                  </div>
                ) : voiceIsSpeaking ? (
                  <div className="flex items-center gap-1.5 h-10">
                    <span className="w-1.5 bg-emerald-400 rounded-full sound-wave-bar" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 bg-emerald-400 rounded-full sound-wave-bar" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 bg-emerald-400 rounded-full sound-wave-bar" style={{ animationDelay: "240ms" }} />
                    <span className="w-1.5 bg-emerald-400 rounded-full sound-wave-bar" style={{ animationDelay: "360ms" }} />
                    <span className="w-1.5 bg-emerald-400 rounded-full sound-wave-bar" style={{ animationDelay: "180ms" }} />
                  </div>
                ) : voiceIsLoading ? (
                  <Loader2 className="w-9 h-9 sm:w-10 sm:h-10 text-amber-400 animate-spin" />
                ) : (
                  <Mic className="w-9 h-9 sm:w-10 sm:h-10 text-zinc-300 transition-transform duration-200 group-hover:scale-105" />
                )}

                <span className="text-[10px] sm:text-xs font-medium text-zinc-400 mt-1.5 sm:mt-2 text-center tracking-wide">
                  {voiceIsListening
                    ? "Listening..."
                    : voiceIsSpeaking
                      ? "Speaking..."
                      : voiceIsLoading
                        ? "Thinking..."
                        : voiceSessionActive
                          ? "Ready..."
                          : "Tap to Speak"}
                </span>
              </div>
            </div>
          </div>

          {/* Subtle live user speech preview (only when actively speaking, zero layout jitter) */}
          <div className="h-6 flex items-center justify-center w-full px-2">
            {voiceIsListening && voiceLiveTranscript ? (
              <p className="text-xs text-zinc-300 font-normal truncate max-w-xs sm:max-w-md px-3 py-1 rounded-full bg-zinc-900/60 border border-zinc-800 animate-pulse text-center">
                &ldquo;{voiceLiveTranscript}&rdquo;
              </p>
            ) : null}
          </div>

          {/* Unified Bottom Action Bar: Clean Voice Toggle */}
          <div className="w-full max-w-md flex flex-col items-center gap-2 mt-2 sm:mt-6 mb-2 px-3 sm:px-4">
            <button
              id="voice-session-toggle-button"
              type="button"
              onClick={handleToggleVoiceSession}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-sm shadow-md transition-all cursor-pointer active:scale-98 ${voiceSessionActive
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "bg-zinc-100 hover:bg-white text-zinc-900"
                }`}
            >
              {voiceSessionActive ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>End Voice Session</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>Start Voice Session</span>
                </>
              )}
            </button>

            {voiceSessionActive && (
              <p className="text-[10px] sm:text-[11px] text-zinc-400 text-center px-2">
                Saying <span className="text-zinc-200 font-medium">&quot;Thank you&quot;</span> will automatically conclude the session.
              </p>
            )}
          </div>
        </main>
      ) : (
        /* ── Independent Text Chat Stage ────────────────────────────── */
        <main className="relative z-10 flex-1 flex flex-col max-w-3xl mx-auto w-full h-[calc(100dvh-57px)] sm:h-[calc(100dvh-64px)] overflow-hidden">
          {/* Scrollable Message History */}
          <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-6 sm:py-6 space-y-3 sm:space-y-4">
            {chatMessages.map((msg, index) => {
              if (msg.role === "system" || msg.role === "tool") return null;
              const isUser = msg.role === "user";
              const cleanContent = cleanMarkdownFormatting(msg.content || "");
              const lower = cleanContent.toLowerCase();
              const mentionsBooking =
                !isUser &&
                (lower.includes("book") ||
                  lower.includes("schedule") ||
                  lower.includes("slot") ||
                  lower.includes("meeting") ||
                  lower.includes("available"));

              return (
                <div
                  key={index}
                  className={`flex gap-2 sm:gap-3 items-start ${isUser ? "flex-row-reverse" : "flex-row"
                    }`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-200 font-bold text-xs flex-shrink-0 mt-0.5 shadow-sm">
                      NS
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${isUser
                      ? "bg-blue-600 text-white rounded-tr-sm shadow-sm font-medium"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm shadow-sm"
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{cleanContent}</p>

                    {mentionsBooking && (
                      <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-zinc-300">Ready to book a 30-min call?</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowContactModal(true)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          <span>Select Slot</span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {chatIsLoading && (
              <div className="flex gap-2 sm:gap-3 items-start">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-200 font-bold text-xs flex-shrink-0 mt-0.5">
                  NS
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-xs sm:text-sm text-zinc-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            <div ref={chatMessagesEndRef} />
          </div>

          {/* Quick Starter Chips with Smooth Touch Scroll on Mobile */}
          {chatMessages.length <= 1 && (
            <div className="px-3 pb-2 flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap">
              {[
                { label: "Tell me about Nagoor", icon: User },
                { label: "All 5 Key Projects", icon: Briefcase },
                { label: "Tech stack", icon: Code2 },
                { label: "Experience & Education", icon: Sparkles },
                { label: "Schedule a meeting", icon: Calendar },
              ].map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSendChatMessage(item.label)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs transition cursor-pointer active:scale-95"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Text Input Footer Bar */}
          <div className="p-2.5 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="flex items-center gap-2 max-w-3xl mx-auto"
            >
              <button
                type="button"
                onClick={() => setActiveTab("voice")}
                title="Switch to Voice mode"
                className="p-2.5 sm:p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer flex-shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>

              <input
                type="text"
                id="chat-text-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about Nagoor or type 'book a slot'..."
                disabled={chatIsLoading}
                className="flex-1 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 text-white placeholder-zinc-500 text-base sm:text-sm outline-none transition"
              />

              <button
                type="submit"
                id="chat-send-button"
                disabled={!chatInput.trim() || chatIsLoading}
                className={`p-2.5 sm:p-3 rounded-xl font-medium transition cursor-pointer active:scale-95 flex-shrink-0 ${chatInput.trim() && !chatIsLoading
                  ? "bg-zinc-100 hover:bg-white text-zinc-900 shadow-sm"
                  : "bg-zinc-850 text-zinc-600 cursor-not-allowed border border-zinc-800"
                  }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>
      )}



      {/* ── STEP 1: Minimal Booking Form Overlay ──────────────────────── */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl transition-all my-auto"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-200 flex-shrink-0">
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    {contactName.trim() ? "Edit booking details" : "Schedule a meeting"}
                  </h3>
                  <p className="text-[11px] text-zinc-400">30-minute session with Nagoor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowContactModal(false);
                  showContactModalRef.current = false;
                  if (voiceSessionActiveRef.current && !voiceIsSpeakingRef.current && !voiceIsLoadingRef.current) {
                    startContinuousListening();
                  }
                }}
                className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer active:scale-95"
                aria-label="Close booking modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Distinct Date & Time Selection */}
            <div className="mt-4 flex flex-col gap-3.5">
              {/* 1. Date Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Select Date</span>
                  </label>
                  <span className="text-[11px] text-zinc-400 font-normal">Next 8 weekdays</span>
                </div>
                <select
                  id="booking-form-date-select"
                  value={
                    availableDates.find(
                      (d) =>
                        d === selectedSlot.date ||
                        d.toLowerCase().replace(/,\s*\d{4}/, "") ===
                        selectedSlot.date.toLowerCase().replace(/,\s*\d{4}/, "")
                    ) || availableDates[0] || selectedSlot.date
                  }
                  onChange={(e) => {
                    const newDate = e.target.value;
                    const matchingSlot =
                      availableSlots.find((s) => s.date === newDate && s.time === selectedSlot.time) ||
                      availableSlots.find((s) => s.date === newDate);
                    if (matchingSlot) {
                      setSelectedSlot(matchingSlot);
                      selectedSlotRef.current = matchingSlot;
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-800/90 border border-zinc-700/80 text-white text-base sm:text-xs font-medium focus:outline-none focus:border-zinc-500 transition cursor-pointer"
                >
                  {availableDates.map((dateStr) => (
                    <option key={dateStr} value={dateStr} className="bg-zinc-900 text-white py-1">
                      {dateStr}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Time Slot Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Select Time Slot</span>
                  </label>
                  <span className="text-[11px] text-blue-400 font-medium">30 mins · IST</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {effectiveSlotsForDate.map((slot) => {
                    const isSelected =
                      selectedSlot.iso === slot.iso ||
                      (selectedSlot.time === slot.time &&
                        (selectedSlot.date === slot.date ||
                          selectedSlot.date.toLowerCase().replace(/,\s*\d{4}/, "") ===
                          slot.date.toLowerCase().replace(/,\s*\d{4}/, "")));
                    return (
                      <button
                        key={slot.iso}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slot);
                          selectedSlotRef.current = slot;
                        }}
                        className={`py-2 px-1 text-xs rounded-lg font-medium transition text-center border cursor-pointer active:scale-95 ${isSelected
                          ? "bg-zinc-100 border-zinc-100 text-zinc-900 font-semibold shadow-sm"
                          : "bg-zinc-800/80 border-zinc-700/70 text-zinc-300 hover:border-zinc-500 hover:text-white"
                          }`}
                      >
                        {slot.time.replace(" IST", "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Minimal Form */}
            <form onSubmit={handleContactFormSubmit} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Full name</span>
                </label>
                <input
                  type="text"
                  id="booking-form-name"
                  required
                  autoFocus
                  placeholder="e.g. Sarah Jenkins"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-sm focus:outline-none focus:border-zinc-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Email address</span>
                </label>
                <input
                  type="email"
                  id="booking-form-email"
                  required
                  placeholder="e.g. sarah@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-base sm:text-sm focus:outline-none focus:border-zinc-500 transition"
                />
                {contactEmail.trim().toLowerCase() === "nagoorsaheb718@gmail.com" && (
                  <p className="mt-1.5 text-[11px] text-amber-400 bg-amber-950/40 border border-amber-500/30 rounded-lg p-2 leading-relaxed">
                    Note: This is Nagoor&apos;s organizer email. Please enter your personal or company email so you receive only 1 booking confirmation email directly.
                  </p>
                )}
              </div>

              <button
                type="submit"
                id="booking-form-continue"
                disabled={!isFormValid}
                className={`mt-2 w-full py-3 sm:py-3.5 rounded-xl font-medium text-sm transition cursor-pointer flex items-center justify-center gap-2 ${isFormValid
                  ? "bg-zinc-100 hover:bg-white text-zinc-900 font-semibold shadow-sm active:scale-98"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700/50"
                  }`}
              >
                <span>{contactName.trim() ? "Update & Continue" : "Continue"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── STEP 2: Confirmation Card Overlay ───────────────────────── */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl my-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <h3 className="text-base font-semibold text-white tracking-tight">Confirm your meeting</h3>
            </div>

            {/* Attendee & Slot Summary with Clear Day & Time */}
            <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-zinc-800/70 border border-zinc-700/70 flex flex-col gap-3 text-left">
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-zinc-700/60">
                <Calendar className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">Scheduled Date</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{selectedSlot.date}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pb-2.5 border-b border-zinc-700/60">
                <Clock className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">Meeting Time</p>
                  <p className="text-sm font-semibold text-blue-400 mt-0.5">{selectedSlot.time}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">Attendee</p>
                  <p className="text-sm font-medium text-white mt-0.5 truncate">{contactName}</p>
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{contactEmail}</p>
                </div>
              </div>
            </div>

            {bookingError && (
              <p className="mt-3 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-500/30 text-center">
                {bookingError}
              </p>
            )}

            {/* Action Buttons */}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                id="confirm-and-book-button"
                disabled={isBookingLoading || hasBookedSuccessfully}
                onClick={executeBooking}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-sm text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBookingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Booking...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm &amp; Book</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="edit-booking-button"
                disabled={isBookingLoading}
                onClick={() => {
                  setShowConfirmationModal(false);
                  showConfirmationModalRef.current = false;
                  setShowContactModal(true);
                  showContactModalRef.current = true;
                }}
                className="py-3 px-4 rounded-xl font-medium text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                <span>Edit</span>
              </button>
            </div>

            <p className="mt-3 text-[11px] text-zinc-400 text-center">
              Say <span className="text-emerald-400 font-semibold">&quot;Yes, book it&quot;</span> to confirm, or click <span className="text-zinc-200 font-semibold">&quot;Edit&quot;</span> to change.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP 3: Final Success Confirmation Card ─────────────────── */}
      {bookingSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-center my-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white tracking-tight">Booking Confirmed!</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Your meeting with Shaik Nagoor Saheb has been confirmed.
            </p>

            <div className="mt-4 p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/60 text-left text-xs text-zinc-300 flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-400">Date &amp; Time:</span>
                <span className="font-semibold text-emerald-400">{selectedSlot.date} · {selectedSlot.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Attendee:</span>
                <span className="font-medium text-white">{contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Email:</span>
                <span className="font-medium text-white">{contactEmail}</span>
              </div>
            </div>

            {bookingResultData?.meetLink && (
              <a
                href={bookingResultData.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/30 transition shadow-sm active:scale-98"
              >
                <Video className="w-4 h-4" />
                <span>Join Cal Video Room</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              id="success-done-button"
              onClick={() => setBookingSuccessModal(false)}
              className="mt-4 w-full py-3 rounded-xl font-medium text-sm text-zinc-900 bg-zinc-100 hover:bg-white transition cursor-pointer active:scale-98 font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
