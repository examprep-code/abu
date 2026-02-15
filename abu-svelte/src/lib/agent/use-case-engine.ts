import type {
  AgentMemory,
  AgentNavigationOptions,
  AgentNavigationResult
} from './router';

export interface AgentUseCaseContext<Flags> {
  flags: Flags;
  nextMemory: AgentMemory;
  options: AgentNavigationOptions;
  done: (payload: Omit<AgentNavigationResult, 'memory'>) => AgentNavigationResult;
}

export interface AgentUseCase<Flags> {
  id: string;
  match: (flags: Flags) => boolean;
  run: (ctx: AgentUseCaseContext<Flags>) => Promise<AgentNavigationResult> | AgentNavigationResult;
}

export const runAgentUseCases = async <Flags>(
  useCases: AgentUseCase<Flags>[],
  ctx: AgentUseCaseContext<Flags>
): Promise<AgentNavigationResult | null> => {
  for (const useCase of useCases) {
    if (!useCase.match(ctx.flags)) continue;
    return await useCase.run(ctx);
  }
  return null;
};
