export interface Pcm16AudioChunk {
  channels: number;
  durationSeconds: number;
  pcmData: Buffer;
  sampleRate: number;
}

function findChunkOffset(
  wavData: Buffer,
  chunkId: string,
): { offset: number; size: number } | null {
  let offset = 12;

  while (offset + 8 <= wavData.length) {
    const currentChunkId = wavData.toString('ascii', offset, offset + 4);
    const chunkSize = wavData.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (currentChunkId === chunkId) {
      return {
        offset: dataOffset,
        size: chunkSize,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

export function convertPcm16ToWav(
  pcmData: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const wavHeader = Buffer.alloc(44);
  let offset = 0;

  wavHeader.write('RIFF', offset);
  offset += 4;
  wavHeader.writeUInt32LE(fileSize, offset);
  offset += 4;
  wavHeader.write('WAVE', offset);
  offset += 4;

  wavHeader.write('fmt ', offset);
  offset += 4;
  wavHeader.writeUInt32LE(16, offset);
  offset += 4;
  wavHeader.writeUInt16LE(1, offset);
  offset += 2;
  wavHeader.writeUInt16LE(channels, offset);
  offset += 2;
  wavHeader.writeUInt32LE(sampleRate, offset);
  offset += 4;
  wavHeader.writeUInt32LE(byteRate, offset);
  offset += 4;
  wavHeader.writeUInt16LE(blockAlign, offset);
  offset += 2;
  wavHeader.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  wavHeader.write('data', offset);
  offset += 4;
  wavHeader.writeUInt32LE(dataSize, offset);

  return Buffer.concat([wavHeader, pcmData]);
}

export function parseWavToPcm16(wavData: Buffer): Pcm16AudioChunk {
  if (wavData.length < 44 || wavData.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Invalid WAV data: missing RIFF header');
  }

  if (wavData.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Invalid WAV data: missing WAVE header');
  }

  const fmtChunk = findChunkOffset(wavData, 'fmt ');
  if (!fmtChunk || fmtChunk.size < 16) {
    throw new Error('Invalid WAV data: missing fmt chunk');
  }

  const audioFormat = wavData.readUInt16LE(fmtChunk.offset);
  const channels = wavData.readUInt16LE(fmtChunk.offset + 2);
  const sampleRate = wavData.readUInt32LE(fmtChunk.offset + 4);
  const bitsPerSample = wavData.readUInt16LE(fmtChunk.offset + 14);

  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV encoding: expected PCM, received format ${audioFormat}`);
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV bit depth: expected 16, received ${bitsPerSample}`);
  }

  const dataChunk = findChunkOffset(wavData, 'data');
  if (!dataChunk) {
    throw new Error('Invalid WAV data: missing data chunk');
  }

  const pcmData = wavData.subarray(dataChunk.offset, dataChunk.offset + dataChunk.size);
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);

  return {
    pcmData,
    sampleRate,
    channels,
    durationSeconds: bytesPerSecond > 0 ? pcmData.length / bytesPerSecond : 0,
  };
}

export function createPcm16Silence(durationMs: number, sampleRate = 24000, channels = 1): Buffer {
  if (durationMs <= 0) {
    return Buffer.alloc(0);
  }

  const sampleCount = Math.round((durationMs / 1000) * sampleRate * channels);
  return Buffer.alloc(sampleCount * 2);
}

export function getPcm16DurationSeconds(pcmData: Buffer, sampleRate = 24000, channels = 1): number {
  const bytesPerSecond = sampleRate * channels * 2;
  return bytesPerSecond > 0 ? pcmData.length / bytesPerSecond : 0;
}
