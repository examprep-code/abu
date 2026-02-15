import type { AgentNavigationOptions } from './router';
import type { AgentUseCase } from './use-case-engine';

export type AgentPrimaryUseCaseFlags = {
  asksForVisibleContext: boolean;
  asksForSitemap: boolean;
  asksForDataModel: boolean;
  asksForQueryRecipe: boolean;
  asksForAssignmentCompletion: boolean;
  asksForExerciseAnalysis: boolean;
  asksForStrugglingLearners: boolean;
  asksToOpenLargestClassByLearners: boolean;
  topic: string;
  normalizedPrompt: string;
  currentContextLabel: string;
  currentContext: string;
  visibleItems: string[];
};

type AgentPrimaryUseCaseDeps = {
  options: AgentNavigationOptions;
  buildVisibleItemsMessage: (context: string, visibleItems?: string[]) => string;
  buildSitemapResponse: (prompt: string) => { status: string; message: string };
  buildDataModelResponse: () => { status: string; message: string };
  buildRecipeResponse: (prompt: string) => { status: string; message: string };
  runAssignmentCompletionInsight: (
    options: AgentNavigationOptions,
    normalizedPrompt: string,
    topic: string
  ) => Promise<{ status: string; message: string }>;
  runExerciseOverviewInsight: (
    options: AgentNavigationOptions,
    topic: string
  ) => Promise<{ status: string; message: string }>;
  runStrugglingLearnersInsight: (
    options: AgentNavigationOptions,
    normalizedPrompt: string
  ) => Promise<{ status: string; message: string }>;
  runOpenLargestClassByLearners: (
    options: AgentNavigationOptions
  ) => Promise<{ status: string; message: string }>;
};

// Zentrale Registry der wichtigsten Agent-Use-Cases.
// Neue Faelle hier ergaenzen (match + run), statt in der Router-If-Kette.
export const buildAgentPrimaryUseCases = ({
  options,
  buildVisibleItemsMessage,
  buildSitemapResponse,
  buildDataModelResponse,
  buildRecipeResponse,
  runAssignmentCompletionInsight,
  runExerciseOverviewInsight,
  runStrugglingLearnersInsight,
  runOpenLargestClassByLearners
}: AgentPrimaryUseCaseDeps): AgentUseCase<AgentPrimaryUseCaseFlags>[] => [
  {
    id: 'visible_context',
    match: (flags) => flags.asksForVisibleContext,
    run: ({ flags, done }) =>
      done({
        handled: true,
        status: flags.currentContextLabel,
        message: buildVisibleItemsMessage(flags.currentContext, flags.visibleItems)
      })
  },
  {
    id: 'sitemap',
    match: (flags) => flags.asksForSitemap,
    run: ({ done, nextMemory }) => {
      nextMemory.lastKnowledgeIntent = 'sitemap';
      const response = buildSitemapResponse(options.prompt || '');
      return done({ handled: true, status: response.status, message: response.message });
    }
  },
  {
    id: 'data_model',
    match: (flags) => flags.asksForDataModel,
    run: ({ done, nextMemory }) => {
      nextMemory.lastKnowledgeIntent = 'data_model';
      const response = buildDataModelResponse();
      return done({ handled: true, status: response.status, message: response.message });
    }
  },
  {
    id: 'query_recipe',
    match: (flags) => flags.asksForQueryRecipe,
    run: ({ done, nextMemory }) => {
      nextMemory.lastKnowledgeIntent = 'query_recipe';
      const response = buildRecipeResponse(options.prompt || '');
      return done({ handled: true, status: response.status, message: response.message });
    }
  },
  {
    id: 'assignment_completion',
    match: (flags) => flags.asksForAssignmentCompletion,
    run: async ({ done, nextMemory, flags }) => {
      nextMemory.lastInsightIntent = 'assignment_completion';
      const resolvedTopic = flags.topic || nextMemory.lastExerciseTopic;
      if (resolvedTopic) {
        nextMemory.lastExerciseTopic = resolvedTopic;
      }
      const response = await runAssignmentCompletionInsight(
        options,
        flags.normalizedPrompt,
        resolvedTopic
      );
      return done({ handled: true, status: response.status, message: response.message });
    }
  },
  {
    id: 'exercise_overview',
    match: (flags) => flags.asksForExerciseAnalysis,
    run: async ({ done, nextMemory, flags }) => {
      nextMemory.lastInsightIntent = 'exercise_overview';
      const response = await runExerciseOverviewInsight(
        options,
        flags.topic || nextMemory.lastExerciseTopic
      );
      if (flags.topic) {
        nextMemory.lastExerciseTopic = flags.topic;
      }
      return done({ handled: true, status: response.status, message: response.message });
    }
  },
  {
    id: 'struggling_learners',
    match: (flags) => flags.asksForStrugglingLearners,
    run: async ({ done, nextMemory, flags }) => {
      nextMemory.lastInsightIntent = 'struggling_learners';
      const response = await runStrugglingLearnersInsight(options, flags.normalizedPrompt);
      return done({ handled: true, status: response.status, message: response.message });
    }
  },
  {
    id: 'open_largest_class',
    match: (flags) => flags.asksToOpenLargestClassByLearners,
    run: async ({ done, nextMemory }) => {
      nextMemory.lastInsightIntent = 'open_largest_class';
      const response = await runOpenLargestClassByLearners(options);
      return done({ handled: true, status: response.status, message: response.message });
    }
  }
];
