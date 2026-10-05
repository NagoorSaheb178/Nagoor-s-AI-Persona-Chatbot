# Project: Mentor AI – Mock Interview Platform

**Repository:** Mentor AI – Voice Mock Interview Platform  
**Tagline:** Real-time AI voice interviewer with LangGraph multi-node feedback analysis.  
**Status:** Live  

## Overview
Mentor AI is a full-stack, AI-powered voice interview platform designed to provide realistic, dynamic interview practice. Rather than relying on static question banks, Mentor AI utilizes Vapi.ai to hold spontaneous, real-time voice conversations where the AI dynamically listens, adapts to answers, and asks deep technical follow-ups.

## Key Architecture & Features
- **Real-Time Dynamic Voice Interviews**: Integrated Vapi.ai voice agents for dynamic speech interaction without scripted question banks. The interviewer adapts its questions based on the candidate's answers and probes into technical claims.
- **LangGraph Multi-Node State Machine**: Engineered an asynchronous multi-node evaluation pipeline that parses interview transcripts across:
  1. *Communication Node*: Evaluates fluency, confidence, articulation, and pacing.
  2. *Technical Node*: Assesses problem-solving approaches, correctness, and domain depth.
  3. *Synthesis Node*: Aggregates granular node scores into a comprehensive final report with actionable recommendations and candidate ratings.
- **Robust Full-Stack Foundation**:
  - Custom JWT-based authentication for secure session management.
  - MongoDB database for storing candidates, interview records, and evaluation breakdowns.
  - Candidate session dashboard displaying historical interview performance, progress trends, and topic mastery.
  - WebRTC connection lifecycle management and error handling to ensure a crash-free experience during connection drops or packet loss.

## Technology Stack
- **Frontend & App Framework**: Next.js 14/15, React, Tailwind CSS
- **Voice Engine**: Vapi.ai (WebRTC speech pipelines)
- **AI & Orchestration**: LangGraph, LLM APIs (OpenAI / Claude)
- **Database**: MongoDB
- **Security & State**: JWT Authentication, REST APIs

## Role & Contributions
Nagoor designed and implemented the full architecture from end to end: configured the Vapi.ai real-time voice interaction, engineered the LangGraph state machine for multi-metric evaluation, built the MongoDB database layer, and crafted the responsive candidate analytics dashboard.
