import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { llmRegistry } from '../services/llm/provider-registry';

export const llmRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Public or Authenticated endpoint to list available LLM providers for quiz generation dropdown
  app.get('/providers', async (_request, reply) => {
    const providers = llmRegistry.getAvailableProviders();
    return reply.status(200).send({
      success: true,
      data: {
        providers,
      },
    });
  });
};
