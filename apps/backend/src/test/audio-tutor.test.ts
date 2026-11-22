import { describe, it, expect } from 'vitest';
import {
  matchVoiceCommand,
  buildSocraticNarrationScript,
  audioTutorPreferencesSchema,
} from '@quiz-forge/shared';

describe('Milestone 15: AI Voice Narration & Socratic Audio Tutor Engine', () => {
  describe('Speech Recognition Command Parsing', () => {
    it('accurately parses option selection variations for choices A, B, C, D', () => {
      // Choice A
      expect(matchVoiceCommand('option a').action).toBe('select_choice');
      expect(matchVoiceCommand('option a').choiceId).toBe('A');
      expect(matchVoiceCommand('choice a').choiceId).toBe('A');
      expect(matchVoiceCommand('select A').choiceId).toBe('A');
      expect(matchVoiceCommand('letter a').choiceId).toBe('A');
      expect(matchVoiceCommand('A').choiceId).toBe('A');

      // Choice B
      expect(matchVoiceCommand('option b').choiceId).toBe('B');
      expect(matchVoiceCommand('answer B').choiceId).toBe('B');

      // Choice C
      expect(matchVoiceCommand('select choice C').choiceId).toBe('C');
      expect(matchVoiceCommand('letter c').choiceId).toBe('C');

      // Choice D
      expect(matchVoiceCommand('option D').choiceId).toBe('D');
      expect(matchVoiceCommand('D').choiceId).toBe('D');
    });

    it('matches navigation commands (next, previous, repeat, submit, flip)', () => {
      expect(matchVoiceCommand('next question').action).toBe('next_question');
      expect(matchVoiceCommand('continue').action).toBe('next_question');
      expect(matchVoiceCommand('go back').action).toBe('prev_question');
      expect(matchVoiceCommand('previous').action).toBe('prev_question');
      expect(matchVoiceCommand('submit quiz').action).toBe('submit_quiz');
      expect(matchVoiceCommand('finish').action).toBe('submit_quiz');
      expect(matchVoiceCommand('repeat question').action).toBe('repeat_question');
      expect(matchVoiceCommand('read again').action).toBe('repeat_question');
      expect(matchVoiceCommand('flip card').action).toBe('flip_card');
      expect(matchVoiceCommand('reveal').action).toBe('flip_card');
    });

    it('returns unknown action for unrecognized phrases', () => {
      const res = matchVoiceCommand('what is the weather today');
      expect(res.action).toBe('unknown');
      expect(res.confidence).toBe(0);
    });
  });

  describe('Socratic Audio Script Synthesis', () => {
    const questionText = 'What is the primary role of useMemo in React?';
    const explanation = 'It memoizes the result of an expensive calculation between renders.';
    const correctChoiceText = 'Caches computed values';

    it('synthesizes supportive Socratic walkthrough for correct responses', () => {
      const script = buildSocraticNarrationScript({
        questionText,
        correctChoiceText,
        isCorrect: true,
        explanation,
        pace: 'pedagogical',
      });

      expect(script).toContain('Excellent work!');
      expect(script).toContain(questionText);
      expect(script).toContain(explanation);
    });

    it('synthesizes encouraging pedagogical walkthrough for incorrect responses', () => {
      const script = buildSocraticNarrationScript({
        questionText,
        selectedChoiceText: 'Executes side effects after commit',
        correctChoiceText,
        isCorrect: false,
        explanation,
        pace: 'pedagogical',
      });

      expect(script).toContain("Let's work through this question together.");
      expect(script).toContain('You selected "Executes side effects after commit"');
      expect(script).toContain(`The correct answer is "${correctChoiceText}"`);
      expect(script).toContain(explanation);
    });

    it('supports concise and deep pedagogical paces', () => {
      const conciseScript = buildSocraticNarrationScript({
        questionText,
        correctChoiceText,
        isCorrect: false,
        explanation,
        pace: 'concise',
      });
      expect(conciseScript).toBe(`Incorrect. The correct answer is: ${correctChoiceText}. ${explanation}`);

      const deepScript = buildSocraticNarrationScript({
        questionText,
        correctChoiceText,
        isCorrect: false,
        explanation,
        pace: 'deep',
      });
      expect(deepScript).toContain('Take a moment to reflect on how this core concept connects');
    });
  });

  describe('Audio Tutor Preferences Schema Validation', () => {
    it('validates default audio tutor settings', () => {
      const parsed = audioTutorPreferencesSchema.parse({});
      expect(parsed.voiceEnabled).toBe(false);
      expect(parsed.autoReadQuestion).toBe(false);
      expect(parsed.speechRate).toBe(1.0);
      expect(parsed.speechPitch).toBe(1.0);
      expect(parsed.socraticPace).toBe('pedagogical');
    });

    it('enforces bounds on speech rate and pitch', () => {
      expect(() => audioTutorPreferencesSchema.parse({ speechRate: 3.5 })).toThrow();
      expect(() => audioTutorPreferencesSchema.parse({ speechRate: 0.1 })).toThrow();
    });
  });
});
