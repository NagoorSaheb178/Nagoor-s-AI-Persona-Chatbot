import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nagoor's AI Assistant | Shaik Nagoor Saheb",
  description:
    "Chat with the AI assistant representing Shaik Nagoor Saheb — Final-year B.Tech IT student, AI Engineer, and Full Stack Developer. Ask about his background, projects, or book a meeting.",
  keywords: [
    "Shaik Nagoor Saheb",
    "AI Engineer",
    "Full Stack Developer",
    "LLM",
    "RAG",
    "Next.js",
    "Vijayawada",
  ],
  authors: [{ name: "Shaik Nagoor Saheb" }],
  openGraph: {
    title: "Nagoor's AI Assistant",
    description:
      "Chat with the AI assistant representing Shaik Nagoor Saheb — AI Engineer & Full Stack Developer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script src="https://js.puter.com/v2/"></script>
      </head>
      <body className={`${inter.className} antialiased bg-gray-950`}>{children}</body>
    </html>
  );
}
