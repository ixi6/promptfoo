---
sidebar_label: Tau Voice
description: 'Run local Tau-style voice evals with a simulated user, text-to-speech, realtime targets, transcripts, and trace-aware assertions'
---

# Tau Voice Provider

The Tau Voice provider runs a local, eval-focused voice conversation loop inspired by [Tau-Bench](https://github.com/sierra-research/tau-bench). It keeps the simulated user, text-to-speech, and grading-oriented metadata inside promptfoo, then sends audio turns to your target provider.

It is designed for voice evals against providers such as [`openai:realtime:*`](/docs/providers/openai/), where you want:

- a local simulated user
- synthesized user audio
- per-turn transcripts and latency data
- trace-aware grading with `llm-rubric` and trajectory assertions

## Configuration

Use `promptfoo:tau-voice` as the test-level provider. The target provider remains your normal entry in `providers`.

```yaml
providers:
  - id: openai:realtime:gpt-realtime
    config:
      modalities: ['text', 'audio']
      maintainContext: true
      turn_detection: null
      tools:
        - file://functions/get_user_profile.json
        - file://functions/search_flights.json

defaultTest:
  provider:
    id: promptfoo:tau-voice
    config:
      maxTurns: 6
      initialMessages:
        - role: assistant
          content: Hello, thank you for calling Promptfoo Air. Please share your traveler ID and what trip you need help with today.
      userProvider:
        id: openai:chat:gpt-4.1-mini
      ttsProvider:
        id: openai:speech:gpt-4o-mini-tts
        config:
          voice: alloy
          format: pcm
      transcriptionProvider:
        id: openai:transcription:gpt-4o-transcribe-diarize
      transcriptionScope: assistant-turns-and-conversation
```

## How it works

For each turn, the provider:

1. Uses `userProvider` to generate the next simulated user utterance from the task instructions and conversation history.
2. Uses `ttsProvider` to synthesize that utterance into audio.
3. Sends the audio turn to the target provider through promptfoo's audio wrapper.
4. Captures the assistant transcript, audio output, tool calls, event counts, and latency metadata.
5. Feeds the assistant reply back into the next simulated-user turn.

The loop stops when the simulated user emits `###STOP###`, the target ends the conversation, or `maxTurns` is reached.

## Configuration Options

| Option                  | Type                | Description                                                                                                        |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `userProvider`          | string or object    | Required. Local provider used to generate the next simulated user turn.                                            |
| `ttsProvider`           | string or object    | Optional. Text-to-speech provider for user audio. Defaults to OpenAI speech.                                       |
| `transcriptionProvider` | string or object    | Optional. Provider used to retranscribe saved audio for verification or diarization.                               |
| `transcriptionScope`    | string              | Optional. `assistant-turns`, `conversation`, or `assistant-turns-and-conversation`. Defaults to `assistant-turns`. |
| `instructions`          | string              | Nunjucks template for the simulated-user objective. Defaults to `{{instructions}}`.                                |
| `maxTurns`              | number              | Maximum number of simulated turns. Defaults to 10.                                                                 |
| `initialMessages`       | Message[] or string | Optional. Seed conversation state before the first simulated user turn. Supports inline arrays or `file://` paths. |
| `voice`                 | string              | Default voice for the built-in OpenAI TTS fallback.                                                                |
| `ttsFormat`             | string              | Default audio format for the built-in OpenAI TTS fallback.                                                         |

## Output and Metadata

`promptfoo:tau-voice` returns the final transcript in `output`, so standard output graders such as `llm-rubric` work without extra adapters.

It also stores normalized voice artifacts in metadata:

- `metadata.transcript` for the full conversation transcript
- `metadata.messages` for text-only chat history
- `metadata.voiceTurns` for per-turn audio, transcripts, tool calls, verification transcripts, usage breakdowns, event counts, session IDs, and latencies
- `metadata.conversationTranscription` for an optional diarized or post-run transcript of the stitched user+assistant audio
- `metadata.costBreakdown` for separate user simulation, TTS, target, and transcription costs
- `metadata.stopReason` for the harness stop condition
- `metadata.objective` and `metadata.targetPrompt` for trace-aware grading context

## Trace-aware grading

If you want trajectory assertions such as `trajectory:tool-used` or `trajectory:tool-sequence`, enable tracing for the eval:

```yaml
tracing:
  enabled: true
```

With tracing enabled, the Tau Voice span becomes the parent for the nested simulator, TTS, realtime provider, and tool-call spans. That lets you grade both the final transcript and the observed tool path in the same eval run.

For local Tau-style voice evals, prefer `turn_detection: null` on the realtime target so promptfoo stays in explicit half-duplex control of each synthesized audio turn. Enable `tracing.otlp` only if your own external callbacks or services need to export spans back into promptfoo.

For voice-specific assertions, prefer `trajectory:tool-used`, `trajectory:tool-sequence`, and stable argument checks over exact spoken identifiers. Audio transcription and model normalization can slightly alter IDs, account numbers, or spelling even when the tool path is otherwise correct.

If you need stricter Tau-style checks, use a `javascript` assertion to inspect `context.providerResponse.metadata.voiceTurns`. That lets you verify tool outputs such as resolved traveler IDs, baggage benefits, or post-run retranscription results directly from the saved eval artifact.

## Example

For a complete working example, initialize:

```bash
npx promptfoo@latest init --example openai-realtime-tau-voice
```

That example combines:

- `openai:realtime:gpt-realtime` as the voice target
- `openai:speech:gpt-4o-mini-tts` for user audio
- a local chat model as the simulated user
- `llm-rubric` plus trajectory assertions over the same run
