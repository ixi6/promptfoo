/**
 * Entry point for the Ink-based share UI.
 *
 * IMPORTANT: This module uses dynamic imports for ink-related components to avoid
 * loading ink/React when promptfoo is used as a library.
 */

import { initInkApp } from '../initInkApp';

export { shouldUseInkUI as shouldUseInkShare } from '../interactiveCheck';

import type { RenderResult } from '../render';
import type { ShareController } from './ShareApp';

export interface ShareRunnerOptions {
  /** Eval ID to share */
  evalId: string;
  /** Eval description */
  description?: string;
  /** Number of results */
  resultCount?: number;
  /** Skip confirmation prompt */
  skipConfirmation?: boolean;
}

export interface ShareUIResult {
  /** Render result for cleanup */
  renderResult: RenderResult;
  /** Controller for sending progress updates */
  controller: ShareController;
  /** Cleanup function */
  cleanup: () => void;
  /** Promise that resolves when user confirms or cancels */
  confirmation: Promise<boolean>;
  /** Promise that resolves with share URL or undefined if cancelled */
  result: Promise<string | undefined>;
}

/**
 * Initialize the Ink-based share UI.
 */
export async function initInkShare(options: ShareRunnerOptions): Promise<ShareUIResult> {
  const [React, { ShareApp }] = await Promise.all([import('react'), import('./ShareApp')]);

  // Controller is created inside the component and delivered via onController callback
  let resolveController: (c: ShareController) => void;
  const controllerPromise = new Promise<ShareController>((resolve) => {
    resolveController = resolve;
  });

  const { renderResult, cleanup, promises } = await initInkApp<ShareController>({
    componentName: 'ShareApp',
    controller: undefined,
    channels: {
      confirmation: false,
      result: undefined,
    },
    signalContext: 'share',
    render: (resolvers) =>
      React.createElement(ShareApp, {
        evalId: options.evalId,
        description: options.description,
        resultCount: options.resultCount,
        skipConfirmation: options.skipConfirmation,
        onConfirm: () => {
          resolvers.confirmation(true);
        },
        onCancel: () => {
          resolvers.confirmation(false);
          resolvers.result(undefined);
        },
        onComplete: (shareUrl: string) => {
          resolvers.result(shareUrl);
        },
        onController: (c: ShareController) => {
          resolveController(c);
        },
      }),
  });

  // Race against waitUntilExit so a pre-mount crash (ErrorBoundary) doesn't deadlock.
  const resolvedController = await Promise.race([
    controllerPromise,
    renderResult.waitUntilExit().then(() => {
      throw new Error('Ink UI exited before controller was delivered');
    }),
  ]);

  return {
    renderResult,
    controller: resolvedController,
    cleanup,
    confirmation: promises.confirmation as Promise<boolean>,
    result: promises.result as Promise<string | undefined>,
  };
}
