import { QuizDifficulty } from '@quiz-forge/shared';
import { GenerateQuestionsParams } from './ai.interface';

function getDifficultyInstructions(difficulty: QuizDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Target Level: EASY. Focus on foundational terminology, core definitions, and straightforward facts. Distractors should be clear and distinct.';
    case 'medium':
      return 'Target Level: MEDIUM. Focus on conceptual understanding, practical application of principles, and discerning between related concepts.';
    case 'hard':
      return 'Target Level: HARD. Focus on advanced mechanics, edge cases, subtle trade-offs, and in-depth problem analysis. Distractors should be plausible and require deep subject understanding to rule out.';
    case 'mixed':
    default:
      return 'Target Level: MIXED. Provide a well-balanced variety spanning easy fundamentals, medium application questions, and hard analytical questions.';
  }
}

export function buildQuizPrompt(params: GenerateQuestionsParams): string {
  const { topic, questionCount, difficulty } = params;
  const difficultyGuide = getDifficultyInstructions(difficulty);

  return `You are a Senior Technical Educator and Assessment Specialist creating an authoritative multiple-choice quiz.

Topic: "${topic}"
Number of Questions: ${questionCount}
${difficultyGuide}

CRITICAL ASSESSMENT RULES:
1. Generate EXACTLY ${questionCount} distinct, high-quality multiple choice questions.
2. Each question MUST have exactly four options labeled 'A', 'B', 'C', and 'D'.
3. EXACTLY ONE choice is correct. The remaining three choices must be plausible, realistic distractors that demonstrate common misconceptions.
4. DO NOT use "All of the above", "None of the above", or "Both A and B" options.
5. All 4 option texts for each question must be completely distinct from one another.
6. The "correct_answer_id" MUST strictly be one of "A", "B", "C", or "D".
7. Provide a concise, clear "explanation" (2-4 sentences) that clearly justifies why the correct answer is right and why the distractors are wrong.
8. Every question in the batch must be unique—do not repeat concepts or phrasing.`;
}
