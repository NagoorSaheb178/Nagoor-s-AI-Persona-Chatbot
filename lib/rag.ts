import fs from "fs";
import path from "path";

// Cache the knowledge base in memory — files don't change at runtime,
// so we only pay the disk I/O cost on the very first request.
let cachedKnowledgeBase: string | null = null;

export async function loadKnowledgeBase(): Promise<string> {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  const dataDir = path.join(process.cwd(), "data");
  const githubDir = path.join(dataDir, "github");

  // Read resume
  const resumePath = path.join(dataDir, "resume.md");
  const resumeContent = fs.readFileSync(resumePath, "utf-8");

  // Read all GitHub project files
  const githubFiles = fs.readdirSync(githubDir).filter((f) => f.endsWith(".md"));
  const githubSections = githubFiles.map((file) => {
    const content = fs.readFileSync(path.join(githubDir, file), "utf-8");
    return content;
  });

  // Concatenate with section headers
  cachedKnowledgeBase = [
    "=== RESUME / BACKGROUND ===",
    resumeContent,
    "",
    "=== GITHUB PROJECTS ===",
    ...githubSections.map((s, i) => `--- Project ${i + 1} ---\n${s}`),
  ].join("\n\n");

  return cachedKnowledgeBase;
}
