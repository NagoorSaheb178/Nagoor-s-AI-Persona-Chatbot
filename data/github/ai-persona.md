# Project: AI Persona Chatbot & Voice Assistant

**Repository:** AI Persona & Recruiter Scheduler  
**Tagline:** Grounded AI voice and text persona representing Shaik Nagoor Saheb with real-time Cal.com scheduling.  
**Status:** Live  

## Overview
The AI Persona Chatbot is a production-ready conversational assistant representing Shaik Nagoor Saheb. It is strictly grounded in his verified resume and project portfolio, capable of conducting natural voice conversations or text chats with recruiters, answering questions about his background, and booking interview slots in real-time.

## Key Architecture & Features
- **Grounded RAG Pipeline**: Restricts LLM responses strictly to Shaik Nagoor Saheb's professional profile, technical stack, internships, and project achievements, preventing hallucinations.
- **Cal.com API v2 Tool Calling**: Seamless integration with Cal.com allows recruiters and visitors to ask about real-time availability and directly book meetings into Nagoor's calendar.
- **Dual-Mode Experience (Voice & Chat)**:
  - *Voice Mode*: Hands-free continuous conversational voice loop with Web Speech API and text-to-speech synthesis, closing cleanly when the user says "Thank you".
  - *Chat Mode*: Fast, distraction-free text-based messaging.
- **Security & Guardrails**: Multi-layer input validation and prompt injection defenses that reject out-of-scope queries and prevent system prompt leakage or persona drift.

## Technology Stack
- **Framework**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- **AI & Models**: Puter.js cloud LLM engine (gpt-4o-mini), RAG pipeline
- **Scheduling**: Cal.com v2 REST API with function tool calling
- **Voice**: Web Speech API (SpeechRecognition & SpeechSynthesis)
