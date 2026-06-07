# Project: GitGrade - AI-Powered GitHub Analytics Platform

**Repository:** Repository Mirror (GitGrade)
**Tagline:** A high-performance AI code auditor powered by Google Gemini 2.5 Flash.

## Overview
GitGrade provides a "harsh but fair" professional evaluation of GitHub repositories. It uses a modern Bento Grid UI, terminal-style feedback, and radar chart visualizations to present complex analysis data in a consolidated dashboard.

## Key Features
- **Scorecard**: 0-100 simplified rating with difficulty classification.
- **Metrics**: Interactive Radar chart for quality, structure, and testing dimensions.
- **Roadmap**: AI-generated actionable steps for improvement.
- **Grounding**: Real-time Google Search verification for repository context.
- **Repository Summaries**: Auto-generated developer insights and improvement suggestions.
- **Code Quality Analysis**: Evaluates maintainability, best practices, and code structure.

## Technology Stack

### Core Architecture
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS

### Artificial Intelligence
- **Model**: Google Gemini 2.5 Flash
- **SDK**: @google/genai (Latest Google GenAI SDK)
- **Capabilities**: Multimodal analysis, System Instructions, Google Search Grounding

### UI & Visualization
- **Charts**: Recharts (Custom Radar/Spider Charts)
- **Icons**: Lucide React
- **Design**: Glassmorphism, Bento Grid Layout, CSS Animations

### Infrastructure
- **Deployment**: Vercel
- **Environment**: Node.js / Edge Runtime compatible

## Problem Solved
Developers often struggle to objectively evaluate their own code quality. GitGrade provides an unbiased, AI-powered perspective that highlights issues, quantifies quality, and provides actionable improvement roadmaps.

## Role
Nagoor built this platform during his internship at Primo Fiscal. He architected the entire system from the Gemini API integration to the frontend dashboards, including the radar chart visualizations and the AI prompt engineering for generating fair, accurate repository evaluations.
