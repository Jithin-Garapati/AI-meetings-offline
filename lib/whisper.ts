let whisperModel: any = null
let currentModelSize: 'base' | 'small' | null = null

export async function loadWhisperModel(size: 'base' | 'small' = 'base') {
  if (!whisperModel || currentModelSize !== size) {
    const { pipeline } = await import('@xenova/transformers');
    const modelId = size === 'small' ? 'Xenova/whisper-small' : 'Xenova/whisper-base';
    whisperModel = await pipeline('automatic-speech-recognition', modelId, { quantized: true });
    currentModelSize = size;
  }
  return whisperModel;
}

export async function transcribeBlob(blob: Blob, size: 'base' | 'small' = 'base'): Promise<string> {
  const model = await loadWhisperModel(size);
export async function transcribeBlob(blob: Blob): Promise<string> {
  const model = await loadWhisperModel();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const float32 = decoded.getChannelData(0);
  const result = await model(float32);
  return result.text as string;
}
