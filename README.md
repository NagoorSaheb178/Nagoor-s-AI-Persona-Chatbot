# Nagoor's AI Persona Chatbot

An interactive, RAG-powered AI chatbot acting as the professional persona of Shaik Nagoor Saheb. The assistant can answer questions about Nagoor's skills, experience, and projects, as well as seamlessly schedule meetings via Cal.com.

## Features

- **Conversational UI**: A modern, mobile-responsive chat interface built with Next.js and Tailwind CSS.
- **RAG-Powered Knowledge**: The AI answers questions based on a localized knowledge base containing Nagoor's resume and project portfolio.
- **Tool Calling (Scheduling)**: Integrated with the Cal.com v2 API to let the AI check availability and automatically book meetings right from the chat.
- **Puter.js Integration**: Uses Puter AI's client-side SDK (`window.puter.ai.chat`) for fast, serverless LLM generation. 
- **Protected Prompting**: Instructions guard the AI from prompt injection and off-topic conversations.

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **AI/LLM**: [Puter AI](https://docs.puter.com/api/ai/) (using `gpt-4o-mini`)
- **Scheduling**: [Cal.com API v2](https://cal.com/docs)
- **Markdown Parsing**: Built-in simple extraction from markdown files

## Prerequisites

To run this project locally, you will need:

1. Node.js (v18+)
2. A Cal.com account and API key.
3. Event Type ID for your Cal.com booking link.

## Environment Variables

Create a `.env.local` file in the root directory and add your Cal.com credentials:

```env
CAL_API_KEY=your_cal_com_api_key_here
CAL_EVENT_TYPE_ID=your_cal_com_event_type_id_here
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the app:**
   Open [http://localhost:3000](http://localhost:3000) with your browser. The Chat UI will automatically load and initialize the Puter.js SDK.

## Project Structure

- `app/` - Next.js App Router setup.
- `app/api/` - Backend API routes for serving the RAG prompt (`system-prompt`) and securely proxying Cal.com requests (`tools`).
- `components/ChatInterface.tsx` - The main client-side chat interface, managing message state and tool execution loops.
- `data/` - Markdown files (`resume.md`, `projects.md`) acting as the RAG knowledge base.
- `lib/`
  - `rag.ts` - Reads and concatenates local markdown data.
  - `prompts.ts` - Defines system prompt constraints, injection rules, and tool schemas.
  - `booking.ts` - Handlers for checking availability and booking slots via Cal.com.
