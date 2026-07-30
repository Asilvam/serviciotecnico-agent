export class PrintAgentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly outcomeUncertain = false,
  ) {
    super(message);
  }
}
