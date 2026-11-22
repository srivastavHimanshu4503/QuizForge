import type { FastifyPluginAsync } from 'fastify';
import {
  createFlashcardDeckSchema,
  createFlashcardCardSchema,
  reviewFlashcardSchema,
  importMistakesSchema,
  generateFromQuizSchema,
} from '@quiz-forge/shared';
import { flashcardsService } from '../services/flashcards.service';

export const flashcardsRoutes: FastifyPluginAsync = async (app) => {
  // Ensure user is authenticated for all flashcard operations
  app.addHook('preHandler', app.authenticate);

  // 1. Overall User Flashcard Stats
  app.get('/stats', async (request, reply) => {
    const userId = request.user!.id;
    const stats = await flashcardsService.getOverallStats(userId);
    return reply.send(stats);
  });

  // 2. List All Decks for User
  app.get('/decks', async (request, reply) => {
    const userId = request.user!.id;
    const decks = await flashcardsService.getUserDecks(userId);
    return reply.send(decks);
  });

  // 3. Get Single Deck by ID
  app.get<{ Params: { id: string } }>('/decks/:id', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;
    const deck = await flashcardsService.getDeckById(id, userId);
    if (!deck) {
      return reply.status(404).send({ error: 'Deck not found' });
    }
    return reply.send(deck);
  });

  // 4. Create New Deck
  app.post('/decks', async (request, reply) => {
    const userId = request.user!.id;
    const parseResult = createFlashcardDeckSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const deck = await flashcardsService.createDeck(userId, parseResult.data);
    return reply.status(201).send(deck);
  });

  // 5. Delete Deck
  app.delete<{ Params: { id: string } }>('/decks/:id', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;
    const deleted = await flashcardsService.deleteDeck(id, userId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Deck not found or unauthorized' });
    }
    return reply.send({ success: true, message: 'Deck deleted successfully' });
  });

  // 6. Get Study Cards for Deck
  app.get<{
    Params: { id: string };
    Querystring: { mode?: 'due' | 'all' };
  }>('/decks/:id/study', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;
    const mode = request.query.mode === 'all' ? 'all' : 'due';

    try {
      const cards = await flashcardsService.getStudyCards(id, userId, mode);
      return reply.send(cards);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message || 'Deck not found' });
    }
  });

  // 7. Create Custom Card in Deck
  app.post('/cards', async (request, reply) => {
    const userId = request.user!.id;
    const parseResult = createFlashcardCardSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const card = await flashcardsService.createCard(userId, parseResult.data);
      return reply.status(201).send(card);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to create card' });
    }
  });

  // 8. Delete Card
  app.delete<{ Params: { id: string } }>('/cards/:id', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;
    const deleted = await flashcardsService.deleteCard(id, userId);
    if (!deleted) {
      return reply.status(404).send({ error: 'Card not found or unauthorized' });
    }
    return reply.send({ success: true, message: 'Card deleted successfully' });
  });

  // 9. Review Card (SM-2 Rating: 1-4)
  app.post<{ Params: { id: string } }>('/cards/:id/review', async (request, reply) => {
    const userId = request.user!.id;
    const { id } = request.params;
    const parseResult = reviewFlashcardSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await flashcardsService.reviewCard(id, userId, parseResult.data.rating);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to review card' });
    }
  });

  // 10. Auto-import Missed Questions from Quiz Attempts
  app.post('/import-mistakes', async (request, reply) => {
    const userId = request.user!.id;
    const parseResult = importMistakesSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await flashcardsService.importMistakes(userId, parseResult.data);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Failed to import mistakes' });
    }
  });

  // 11. Generate Full Flashcard Deck from Quiz
  app.post('/generate-from-quiz', async (request, reply) => {
    const userId = request.user!.id;
    const parseResult = generateFromQuizSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await flashcardsService.generateFromQuiz(userId, parseResult.data);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to generate flashcard deck' });
    }
  });
};
