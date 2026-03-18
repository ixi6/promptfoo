/**
 * RedteamGenerateApp - Interactive UI for redteam test case generation.
 *
 * Shows real-time progress as plugins generate adversarial test cases.
 */

import { useEffect, useMemo, useState } from 'react';
import type React from 'react';

import { Box, Text, useApp, useInput } from 'ink';
import { ProgressBar } from '../components/shared/ProgressBar';

// Callback for exposing the setProgress function to the controller.
// Set via the onController prop instead of global state.
type SetProgressFn = React.Dispatch<React.SetStateAction<GenerateProgress>>;

export interface PluginProgress {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  requested: number;
  generated: number;
  error?: string;
}

export interface StrategyProgress {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  requested: number;
  generated: number;
}

export interface GenerateProgress {
  phase: 'init' | 'purpose' | 'entities' | 'plugins' | 'strategies' | 'complete' | 'error';
  plugins: PluginProgress[];
  strategies: StrategyProgress[];
  totalTests: number;
  generatedTests: number;
  purpose?: string;
  entities?: string[];
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface RedteamGenerateAppProps {
  /** Called when generation is complete */
  onComplete?: (result: { testsGenerated: number; outputPath?: string }) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Called with the controller after mount, replacing the global-variable pattern */
  onController?: (controller: RedteamGenerateController) => void;
}

function PluginRow({ plugin }: { plugin: PluginProgress }) {
  const statusIcon = {
    pending: <Text color="gray">○</Text>,
    running: <Text color="yellow">◐</Text>,
    complete: <Text color="green">✓</Text>,
    error: <Text color="red">✗</Text>,
  }[plugin.status];

  const statusColor = {
    pending: 'gray',
    running: 'yellow',
    complete: 'green',
    error: 'red',
  }[plugin.status] as 'gray' | 'yellow' | 'green' | 'red';

  return (
    <Box>
      <Box width={3}>{statusIcon}</Box>
      <Box width={25}>
        <Text color={statusColor}>{plugin.id}</Text>
      </Box>
      <Box width={15}>
        <Text>
          {plugin.generated}/{plugin.requested}
        </Text>
      </Box>
      {plugin.error && (
        <Text color="red" dimColor>
          {plugin.error}
        </Text>
      )}
    </Box>
  );
}

function StrategyRow({ strategy }: { strategy: StrategyProgress }) {
  const statusIcon = {
    pending: <Text color="gray">○</Text>,
    running: <Text color="yellow">◐</Text>,
    complete: <Text color="green">✓</Text>,
    error: <Text color="red">✗</Text>,
  }[strategy.status];

  const statusColor = {
    pending: 'gray',
    running: 'yellow',
    complete: 'green',
    error: 'red',
  }[strategy.status] as 'gray' | 'yellow' | 'green' | 'red';

  return (
    <Box>
      <Box width={3}>{statusIcon}</Box>
      <Box width={25}>
        <Text color={statusColor}>{strategy.id}</Text>
      </Box>
      <Box width={15}>
        <Text>
          {strategy.generated}/{strategy.requested}
        </Text>
      </Box>
    </Box>
  );
}

function ElapsedTime({ startTime, endTime }: { startTime: number; endTime?: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (endTime) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const elapsed = Math.floor(((endTime || now) - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <Text dimColor>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </Text>
  );
}

export function RedteamGenerateApp({
  onComplete,
  onCancel,
  onController,
}: RedteamGenerateAppProps) {
  const { exit } = useApp();
  const [progress, setProgress] = useState<GenerateProgress>({
    phase: 'init',
    plugins: [],
    strategies: [],
    totalTests: 0,
    generatedTests: 0,
    startTime: Date.now(),
  });

  // Handle keyboard shortcuts
  useInput((input, key) => {
    if (input === 'c' && key.ctrl) {
      onCancel?.();
      exit();
    }
    if (
      (input === 'q' || key.return || key.escape) &&
      (progress.phase === 'complete' || progress.phase === 'error')
    ) {
      onComplete?.({ testsGenerated: progress.generatedTests });
      exit();
    }
  });

  // Calculate stats
  const stats = useMemo(() => {
    const completedPlugins = progress.plugins.filter((p) => p.status === 'complete').length;
    const errorPlugins = progress.plugins.filter((p) => p.status === 'error').length;
    const completedStrategies = progress.strategies.filter((s) => s.status === 'complete').length;

    return {
      completedPlugins,
      totalPlugins: progress.plugins.length,
      errorPlugins,
      completedStrategies,
      totalStrategies: progress.strategies.length,
    };
  }, [progress]);

  // Expose controller via callback prop instead of global state
  useEffect(() => {
    if (onController) {
      onController(createRedteamGenerateController(setProgress));
    }
  }, [onController]);

  const phaseLabels: Record<string, string> = {
    init: 'Initializing...',
    purpose: 'Extracting system purpose...',
    entities: 'Extracting entities...',
    plugins: 'Generating test cases...',
    strategies: 'Applying attack strategies...',
    complete: 'Generation complete!',
    error: 'Generation failed',
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="red">
          promptfoo redteam generate
        </Text>
        <Text> </Text>
        <ElapsedTime startTime={progress.startTime} endTime={progress.endTime} />
      </Box>

      {/* Phase indicator */}
      <Box marginBottom={1}>
        <Text color={progress.phase === 'error' ? 'red' : 'cyan'}>
          {phaseLabels[progress.phase]}
        </Text>
      </Box>

      {/* Overall progress */}
      {progress.totalTests > 0 && (
        <Box marginBottom={1}>
          <Box marginRight={2}>
            <Text>Overall: </Text>
          </Box>
          <ProgressBar
            value={progress.generatedTests}
            max={progress.totalTests}
            color="green"
            showPercentage
            width={30}
          />
          <Text>
            {' '}
            {progress.generatedTests}/{progress.totalTests} tests
          </Text>
        </Box>
      )}

      {/* Purpose and entities */}
      {progress.purpose && (
        <Box marginBottom={1}>
          <Text dimColor>Purpose: </Text>
          <Text>{progress.purpose.slice(0, 60)}...</Text>
        </Box>
      )}

      {/* Plugins section */}
      {progress.plugins.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text bold>
              Plugins ({stats.completedPlugins}/{stats.totalPlugins})
            </Text>
            {stats.errorPlugins > 0 && <Text color="red"> ({stats.errorPlugins} errors)</Text>}
          </Box>
          <Box flexDirection="column" marginLeft={2}>
            {progress.plugins.map((plugin) => (
              <PluginRow key={plugin.id} plugin={plugin} />
            ))}
          </Box>
        </Box>
      )}

      {/* Strategies section */}
      {progress.strategies.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text bold>
              Strategies ({stats.completedStrategies}/{stats.totalStrategies})
            </Text>
          </Box>
          <Box flexDirection="column" marginLeft={2}>
            {progress.strategies.map((strategy) => (
              <StrategyRow key={strategy.id} strategy={strategy} />
            ))}
          </Box>
        </Box>
      )}

      {/* Error message */}
      {progress.error && (
        <Box marginTop={1}>
          <Text color="red">{progress.error}</Text>
        </Box>
      )}

      {/* Completion message */}
      {progress.phase === 'complete' && (
        <Box marginTop={1} flexDirection="column">
          <Text color="green" bold>
            ✓ Generated {progress.generatedTests} test cases
          </Text>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Error dismissal */}
      {progress.phase === 'error' && (
        <Box marginTop={1}>
          <Text dimColor>Press Enter to continue</Text>
        </Box>
      )}

      {/* Footer */}
      {progress.phase !== 'complete' && progress.phase !== 'error' && (
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to cancel</Text>
        </Box>
      )}
    </Box>
  );
}

export interface RedteamGenerateController {
  init(plugins: string[], strategies: string[], totalTests: number): void;
  setPurpose(purpose: string): void;
  setEntities(entities: string[]): void;
  startPlugins(): void;
  updatePlugin(id: string, update: Partial<PluginProgress>): void;
  startStrategies(): void;
  updateStrategy(id: string, update: Partial<StrategyProgress>): void;
  complete(generatedTests: number): void;
  error(message: string): void;
}

export function createRedteamGenerateController(
  setProgress: SetProgressFn,
): RedteamGenerateController {
  return {
    init(plugins, strategies, totalTests) {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'init',
        plugins: plugins.map((id) => ({
          id,
          status: 'pending' as const,
          requested: 0,
          generated: 0,
        })),
        strategies: strategies.map((id) => ({
          id,
          status: 'pending' as const,
          requested: 0,
          generated: 0,
        })),
        totalTests,
      }));
    },

    setPurpose(purpose) {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'purpose',
        purpose,
      }));
    },

    setEntities(entities) {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'entities',
        entities,
      }));
    },

    startPlugins() {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'plugins',
      }));
    },

    updatePlugin(id, update) {
      setProgress((prev: GenerateProgress) => {
        const plugins = prev.plugins.map((p) => (p.id === id ? { ...p, ...update } : p));
        const generatedTests = plugins.reduce((sum, p) => sum + p.generated, 0);
        return { ...prev, plugins, generatedTests };
      });
    },

    startStrategies() {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'strategies',
      }));
    },

    updateStrategy(id, update) {
      setProgress((prev: GenerateProgress) => {
        const strategies = prev.strategies.map((s) => (s.id === id ? { ...s, ...update } : s));
        const strategyTests = strategies.reduce((sum, s) => sum + s.generated, 0);
        const pluginTests = prev.plugins.reduce((sum, p) => sum + p.generated, 0);
        return { ...prev, strategies, generatedTests: pluginTests + strategyTests };
      });
    },

    complete(generatedTests) {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'complete',
        generatedTests,
        endTime: Date.now(),
      }));
    },

    error(message) {
      setProgress((prev: GenerateProgress) => ({
        ...prev,
        phase: 'error',
        error: message,
        endTime: Date.now(),
      }));
    },
  };
}
