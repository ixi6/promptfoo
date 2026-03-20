import dedent from 'dedent';
import logger from '../logger';
import { maybeLoadConfigFromExternalFile } from '../util/file';
import { getNunjucksEngine } from '../util/templates';

export type TauMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function buildTauUserSystemPrompt(instructions?: string): string {
  const instructionBlock = instructions ? `\n\nInstruction: ${instructions}\n` : '';

  return dedent`
    You are a user interacting with an agent.${instructionBlock}
    Rules:
    - Just generate one line at a time to simulate the user's message.
    - Always speak as the user in first person. Never speak as the assistant, never narrate tool work, and never ask questions from the agent's perspective.
    - React only to the latest assistant turn and the instruction goal. Do not invent the agent's next action or continue both sides of the conversation.
    - Never repeat the assistant's last message verbatim or paraphrase it as if you said it.
    - Do not give away all the instruction at once. Only provide the information that is necessary for the current step.
    - Do not hallucinate information that is not provided in the instruction. For example, if the agent asks for an order id but it is not mentioned in the instruction, do not make up an order id. Just say you do not remember or have it.
    - If the instruction goal is satisfied, generate '###STOP###' as a standalone message without anything else to end the conversation.
    - Do not repeat the exact instruction in the conversation. Instead, use your own words to convey the same information.
    - Try to make the conversation as natural as possible, and stick to the personalities in the instruction.
  `;
}

export function buildTauUserMessages(instructions: string, history: TauMessage[]): TauMessage[] {
  return [{ role: 'system', content: buildTauUserSystemPrompt(instructions) }, ...history];
}

export function formatTauConversation(messages: TauMessage[]): string {
  return messages
    .map((message) => {
      switch (message.role) {
        case 'assistant':
          return `Assistant: ${message.content}`;
        case 'system':
          return `System: ${message.content}`;
        default:
          return `User: ${message.content}`;
      }
    })
    .join('\n---\n');
}

export function isTauMessage(message: unknown): message is TauMessage {
  return (
    !!message &&
    typeof message === 'object' &&
    typeof (message as TauMessage).content === 'string' &&
    ((message as TauMessage).role === 'user' ||
      (message as TauMessage).role === 'assistant' ||
      (message as TauMessage).role === 'system')
  );
}

export function renderTauTemplate(
  template: unknown,
  vars: Record<string, any> | undefined,
  logPrefix: string,
): unknown {
  if (typeof template !== 'string') {
    return template;
  }

  try {
    return getNunjucksEngine().renderString(template, vars || {});
  } catch (error) {
    logger.warn(
      `[${logPrefix}] Failed to render template: ${template.substring(0, 100)}. Error: ${error instanceof Error ? error.message : error}`,
    );
    return template;
  }
}

export function resolveTauInitialMessages(
  initialMessages: TauMessage[] | string | undefined,
  logPrefix: string,
): TauMessage[] {
  if (!initialMessages) {
    return [];
  }

  if (Array.isArray(initialMessages)) {
    return initialMessages;
  }

  const trimmed = initialMessages.trim();
  if (trimmed === '') {
    return [];
  }

  if (initialMessages.startsWith('file://')) {
    try {
      const resolved = maybeLoadConfigFromExternalFile(initialMessages);
      if (Array.isArray(resolved)) {
        return resolved;
      }
      logger.warn(
        `[${logPrefix}] Expected array of messages from file, got: ${typeof resolved}. Value: ${JSON.stringify(resolved).substring(0, 200)}`,
      );
    } catch (error) {
      logger.warn(
        `[${logPrefix}] Failed to load initialMessages from file: ${error instanceof Error ? error.message : error}`,
      );
    }
    return [];
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(initialMessages);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      logger.warn(
        `[${logPrefix}] Parsed JSON but got ${typeof parsed} instead of array. Value: ${initialMessages.substring(0, 200)}`,
      );
    } catch (error) {
      logger.warn(
        `[${logPrefix}] Failed to parse initialMessages as JSON: ${error}. Value: ${initialMessages.substring(0, 200)}`,
      );
    }
  }

  logger.warn(
    `[${logPrefix}] initialMessages is a string but could not be resolved: ${initialMessages.substring(0, 200)}`,
  );
  return [];
}

export function renderAndValidateTauMessages(
  initialMessages: TauMessage[] | string | undefined,
  vars: Record<string, any> | undefined,
  logPrefix: string,
): TauMessage[] {
  const resolvedMessages = resolveTauInitialMessages(initialMessages, logPrefix);
  const validMessages: TauMessage[] = [];

  for (let index = 0; index < resolvedMessages.length; index++) {
    const message = resolvedMessages[index];
    const renderedMessage = {
      role: renderTauTemplate(message.role, vars, logPrefix),
      content: renderTauTemplate(message.content, vars, logPrefix),
    };

    if (isTauMessage(renderedMessage)) {
      validMessages.push(renderedMessage);
      continue;
    }

    logger.warn(
      `[${logPrefix}] Invalid initial message at index ${index}, skipping. Expected {role: 'user'|'assistant'|'system', content: string}, got: ${JSON.stringify(renderedMessage).substring(0, 100)}`,
    );
  }

  return validMessages;
}
