import { z } from 'zod';

export const audioTutorPreferencesSchema = z.object({
  voiceEnabled: z.boolean().default(false),
  autoReadQuestion: z.boolean().default(false),
  speechRate: z.number().min(0.5).max(2.0).default(1.0),
  speechPitch: z.number().min(0.5).max(1.5).default(1.0),
  preferredVoiceName: z.string().optional(),
  socraticPace: z.enum(['concise', 'pedagogical', 'deep']).default('pedagogical'),
});

export type AudioTutorPreferences = z.infer<typeof audioTutorPreferencesSchema>;

export type VoiceActionType =
  | 'select_choice'
  | 'next_question'
  | 'prev_question'
  | 'submit_quiz'
  | 'repeat_question'
  | 'flip_card'
  | 'unknown';

export interface VoiceCommandResult {
  rawTranscript: string;
  action: VoiceActionType;
  choiceId?: 'A' | 'B' | 'C' | 'D';
  confidence: number;
}

/**
 * Normalizes speech recognition transcripts and matches voice commands to quiz actions.
 */
export function matchVoiceCommand(transcript: string): VoiceCommandResult {
  const clean = transcript.toLowerCase().trim();

  // 1. Navigation & Action Commands (Check before single-letter choice match)
  if (/\b(?:repeat|read|listen|again|speak)\b/i.test(clean)) {
    return {
      rawTranscript: transcript,
      action: 'repeat_question',
      confidence: 0.9,
    };
  }

  if (/\b(?:next|continue|forward|skip)\b/i.test(clean)) {
    return {
      rawTranscript: transcript,
      action: 'next_question',
      confidence: 0.9,
    };
  }

  if (/\b(?:previous|back|prev)\b/i.test(clean)) {
    return {
      rawTranscript: transcript,
      action: 'prev_question',
      confidence: 0.9,
    };
  }

  if (/\b(?:submit|finish|complete|done)\b/i.test(clean)) {
    return {
      rawTranscript: transcript,
      action: 'submit_quiz',
      confidence: 0.9,
    };
  }

  if (/\b(?:flip|turn|show|reveal)\b/i.test(clean)) {
    return {
      rawTranscript: transcript,
      action: 'flip_card',
      confidence: 0.9,
    };
  }

  // 2. Choice Selection
  // Matches: "option a", "choice b", "select c", "letter d", "answer a", or standalone "a", "b", "c", "d"
  const choiceRegex = /(?:(?:option|choice|select|letter|answer)\s+)?\b([a-d])\b/i;
  const choiceMatch = clean.match(choiceRegex);

  if (choiceMatch && choiceMatch[1]) {
    const choiceLetter = choiceMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    return {
      rawTranscript: transcript,
      action: 'select_choice',
      choiceId: choiceLetter,
      confidence: 0.95,
    };
  }

  return {
    rawTranscript: transcript,
    action: 'unknown',
    confidence: 0,
  };
}

/**
 * Builds a natural, conversational Socratic audio script for pedagogical narration.
 */
export function buildSocraticNarrationScript(params: {
  questionText: string;
  selectedChoiceText?: string;
  correctChoiceText: string;
  isCorrect: boolean;
  explanation: string;
  pace?: 'concise' | 'pedagogical' | 'deep';
}): string {
  const { questionText, selectedChoiceText, correctChoiceText, isCorrect, explanation, pace = 'pedagogical' } = params;

  if (pace === 'concise') {
    if (isCorrect) {
      return `Correct! ${explanation}`;
    }
    return `Incorrect. The correct answer is: ${correctChoiceText}. ${explanation}`;
  }

  if (isCorrect) {
    return `Excellent work! For the question: "${questionText}", you correctly identified that: ${correctChoiceText}. Here is why that is right: ${explanation}`;
  }

  let script = `Let's work through this question together. The question asked: "${questionText}". `;
  if (selectedChoiceText) {
    script += `You selected "${selectedChoiceText}". `;
  }
  script += `The correct answer is "${correctChoiceText}". `;
  script += `Here is the key takeaway: ${explanation}`;

  if (pace === 'deep') {
    script += ` Take a moment to reflect on how this core concept connects to your broader understanding.`;
  }

  return script;
}
