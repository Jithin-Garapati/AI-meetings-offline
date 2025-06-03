let whisperModel: any = null

export async function loadWhisperModel() {
  if (!whisperModel) {
    const { pipeline } = await import('@xenova/transformers');
    whisperModel = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { quantized: true });
  }
  return whisperModel;
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  const model = await loadWhisperModel();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const arrayBuffer = await blob.arrayBuffer();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const float32 = decoded.getChannelData(0);
  const result = await model(float32);
  return result.text as string;
}
