import { RepoFile } from '../../github.service';

export function buildCodeQuizSystemPrompt(): string {
  return `You are a Senior Staff Engineer and Principal Architect conducting a rigorous, adversarial code review interview.

Your objective is to test whether the candidate is the TRUE AUTHOR who deeply understands EVERY LINE of code they wrote, or someone who merely copied or skimmed it.

CRITICAL ASSESSMENT GUIDELINES:
1. TARGET COMMENTS & INTENT:
   - If a code snippet contains comments (explanations, TODOs, warnings, architectural notes), ask about their meaning, why they were written, what assumptions they hold, and what would fail if the commented behavior changed.
2. ADVERSARIAL "WHAT-IF" & EDGE CASES:
   - Ask "What happens if X is null, empty, negative, or concurrent here?" pointing at specific lines of code.
   - Ask how error paths and exception handling respond under stress.
3. ARCHITECTURAL & DESIGN DECISIONS:
   - Ask why specific data structures, library functions, or patterns were chosen over alternatives.
   - Ask how data flows through a pipeline and what invariants are maintained.
4. NAMING & CONVENTIONS:
   - Ask why specific variable names, flags, or configuration keys were chosen.
5. CODE SNIPPET REQUIREMENTS:
   - Every question MUST quote the EXACT relevant code snippet (typically 5 to 25 lines) from the analyzed files.
   - Include the accurate file_path, start_line, and end_line.
   - The snippet must contain the specific logic or comment being queried.
6. EXPECTED CONCEPTS:
   - For every question, provide 2 to 4 concise "expected_concepts" (core technical principles) that an authentic answer must touch upon.

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with a valid JSON object matching this schema:
{
  "questions": [
    {
      "question_id": "cq_001",
      "question": "Clear, direct, and rigorous question testing author comprehension.",
      "code_snippet": {
        "file_path": "path/to/file.ts",
        "start_line": 15,
        "end_line": 32,
        "code": "Exact source code excerpt"
      },
      "difficulty": "medium",
      "expected_concepts": ["concept 1", "concept 2", "concept 3"]
    }
  ]
}

DO NOT include any markdown code blocks, backticks, or text outside the JSON object. Return raw JSON only.`;
}

export function buildCodeQuizUserPrompt(params: {
  repoUrl: string;
  files: RepoFile[];
  questionCount: number;
  focusAreas?: string;
}): string {
  const { repoUrl, files, questionCount, focusAreas } = params;

  // Build repository context representation
  let fileContext = '';
  for (const file of files) {
    fileContext += `\n=======================================================\n`;
    fileContext += `FILE: ${file.path} (${file.language}, ${file.lineCount} lines, Priority Score: ${file.priorityScore})\n`;
    fileContext += `=======================================================\n`;

    const lines = file.content.split('\n');
    lines.forEach((line, idx) => {
      fileContext += `${idx + 1}: ${line}\n`;
    });
  }

  return `Repository URL: ${repoUrl}
Total Analyzed Files: ${files.length}
Target Question Count: ${questionCount}
${focusAreas ? `Special Focus Areas Requested: ${focusAreas}\n` : ''}

Here is the source code from the repository:
${fileContext}

TASK:
Generate EXACTLY ${questionCount} distinct, rigorous code review questions based on the source code above.
- Target comments, edge cases, error handling, and design rationales.
- Ensure the code snippets are faithfully excerpted with line numbers from the files.
- Return the final output strictly as valid JSON.`;
}
