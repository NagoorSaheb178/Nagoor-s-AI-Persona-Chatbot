"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { BOOKING_TOOLS } from "@/lib/prompts";

declare global {
  interface Window {
    puter: any;
  }
}

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I'm Nagoor's AI assistant. Ask me about his background, skills, projects, or book a meeting with him!",
};

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      <span
        className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: { role: "user" | "assistant", content: string } }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 group`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mr-3 mt-1 shadow-lg shadow-violet-500/20">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v2M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5"
            />
          </svg>
        </div>
      )}
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg transition-all duration-200 ${
          isUser
            ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-violet-500/20"
            : "bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 text-gray-100 rounded-tl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center ml-3 mt-1 shadow-lg">
          <svg
            className="w-4 h-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  "Tell me about Nagoor's experience",
  "What projects has he built?",
  "What are his technical skills?",
  "Book a meeting with Nagoor",
];

export default function ChatInterface() {
  const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/system-prompt")
      .then((res) => res.json())
      .then((data) => {
        if (data.systemPrompt) {
          setSystemPrompt(data.systemPrompt);
        }
      })
      .catch((err) => console.error("Failed to load system prompt", err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const runChatLoop = async (currentMessages: Message[]) => {
    if (!window.puter) {
      throw new Error("Puter.js SDK is not loaded.");
    }

    let conversationMessages = [...currentMessages];

    while (true) {
      // Create chat completion request via Puter SDK
      const response = await window.puter.ai.chat(conversationMessages, {
        model: "gpt-4o-mini", // Use GPT-4o-mini via Puter API
        tools: BOOKING_TOOLS,
        stream: false, // Turn off stream to support tool calls properly
      });

      const message = response?.message;
      if (!message) throw new Error("No message returned from Puter AI");

      // Append assistant's response to conversation
      const assistantMessage: Message = {
        role: "assistant",
        content: message.content || null,
        tool_calls: message.tool_calls,
      };

      conversationMessages.push(assistantMessage);
      setMessages([...conversationMessages]);

      // Handle tool calls if present
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const tc of message.tool_calls) {
          try {
            const toolArgs = typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments;
            const res = await fetch("/api/tools", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolName: tc.function.name,
                args: toolArgs,
              }),
            });
            const data = await res.json();
            
            conversationMessages.push({
              role: "tool",
              content: data.result || JSON.stringify(data.error),
              tool_call_id: tc.id,
            });
          } catch (err) {
            conversationMessages.push({
              role: "tool",
              content: JSON.stringify({ error: "Failed to execute tool" }),
              tool_call_id: tc.id,
            });
          }
        }
        setMessages([...conversationMessages]);
        // Continue the while loop so LLM can generate a text response after tool results
      } else {
        // No tool calls, break out of loop
        break;
      }
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !systemPrompt) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const apiMessages = [
        { role: "system", content: systemPrompt },
        // Skip the initial greeting from display messages when sending to AI
        ...newMessages.slice(1),
      ];

      await runChatLoop(apiMessages as Message[]);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Something went wrong";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestion = (question: string) => {
    sendMessage(question);
  };

  // Filter messages for display (hide system msgs, tools, and assistant tool-call place-holders)
  const displayMessages = messages.filter(
    (m) =>
      m.role === "user" ||
      (m.role === "assistant" && m.content && m.content.length > 0)
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30">
                NS
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-gray-950 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">
                Nagoor&apos;s AI Assistant
              </h1>
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {displayMessages.length === 1 && (
            <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border border-violet-700/30 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/30">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <h2 className="font-semibold text-violet-300 text-sm mb-1">
                    AI Persona · RAG-Powered
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    I&apos;m Nagoor&apos;s digital representative, trained on his resume and project
                    portfolio. Ask me anything or schedule a meeting!
                  </p>
                </div>
              </div>
            </div>
          )}

          {displayMessages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg as { role: "user" | "assistant"; content: string }} />
          ))}

          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mr-3 shadow-lg shadow-violet-500/20">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v2M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5"
                  />
                </svg>
              </div>
              <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                <LoadingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 text-xs">
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {displayMessages.length <= 1 && !isLoading && (
        <div className="flex-shrink-0 border-t border-gray-800/40">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">Suggested questions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-800 hover:bg-violet-900/50 border border-gray-700 hover:border-violet-500/50 text-gray-300 hover:text-violet-300 transition-all duration-200 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-gray-800/60 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                id="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about Nagoor's skills, projects, or book a meeting..."
                disabled={isLoading || !systemPrompt}
                className="w-full bg-gray-800/60 border border-gray-700/60 hover:border-gray-600/60 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all duration-200 disabled:opacity-50 pr-4"
              />
            </div>
            <button
              id="send-button"
              type="submit"
              disabled={isLoading || !input.trim() || !systemPrompt}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-200 cursor-pointer active:scale-95"
            >
              {isLoading ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
