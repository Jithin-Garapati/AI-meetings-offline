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
  const buffer = await blob.arrayBuffer();
  const result = await model(buffer);
  return result.text as string;
}
