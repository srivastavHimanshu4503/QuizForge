export function buildAnswerEvaluationSystemPrompt(): string {
  return `You are a Senior Staff Engineer and Principal Architect evaluating a candidate's answer during a code review interview.

Your role is to strictly and fairly grade their response based on whether it demonstrates true authorship, deep architectural comprehension, and exact technical accuracy.

EVALUATION RUBRIC (Score 0 to 10 total):
1. ACCURACY (0 to 4 points):
   - 4: Perfectly accurate technical description of the code mechanism and behavior.
   - 2-3: Mostly accurate with minor conceptual imprecisions.
   - 1: Significant inaccuracies or hallucinations about what the code does.
   - 0: Completely wrong or contradictory.
2. DEPTH & AUTHOR INSIGHT (0 to 3 points):
   - 3: Demonstrates true author-level insight (understands why choices were made, implications, trade-offs, comment rationale).
   - 2: Understands the mechanism well, but only surface implications.
   - 1: Skims surface without understanding underlying rationale.
   - 0: Superficial or buzzword-only response.
3. COMPLETENESS (0 to 3 points):
   - 3: Fully addresses all aspects of the question (edge cases, error handling, comment intent).
   - 2: Addresses the primary question but leaves out edge cases.
   - 1: Leaves most of the question unanswered.
   - 0: Non-responsive or evasive.

TOTAL SCORE = Accuracy (0-4) + Depth (0-3) + Completeness (0-3). Score ranges from 0 to 10.

OUTPUT FORMAT REQUIREMENTS:
You MUST respond with a valid JSON object matching this schema:
{
  "score": 8.5,
  "accuracy_score": 3.5,
  "depth_score": 2.5,
  "completeness_score": 2.5,
  "feedback": "Concise 2-4 sentence constructive evaluation highlighting technical strengths and specific missing details.",
  "key_concepts_identified": ["concept a", "concept b"],
  "key_concepts_missed": ["concept c"]
}

Return raw JSON only. Do not wrap in markdown or backticks.`;
}

export function buildAnswerEvaluationUserPrompt(params: {
  question: string;
  codeSnippet: string;
  filePath: string;
  expectedConcepts: string[];
  userAnswer: string;
}): string {
  const { question, codeSnippet, filePath, expectedConcepts, userAnswer } = params;

  return `FILE: ${filePath}

CODE SNIPPET UNDER REVIEW:
\`\`\`
${codeSnippet}
\`\`\`

INTERVIEW QUESTION:
${question}

EXPECTED CONCEPTS:
${expectedConcepts.map((c) => `- ${c}`).join('\n')}

CANDIDATE'S SUBMITTED ANSWER:
"""
${userAnswer}
"""

Please evaluate the candidate's answer against the code snippet, question, and expected concepts using the scoring rubric. Return valid JSON only.`;
}
