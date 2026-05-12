/** Encode an AudioBuffer to WAV (16-bit PCM). */
export function encodeWav(buf: AudioBuffer): ArrayBuffer {
  const channels = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const len = buf.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  let p = 0;
  function writeStr(s: string) { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); }
  function u32(v: number) { view.setUint32(p, v, true); p += 4; }
  function u16(v: number) { view.setUint16(p, v, true); p += 2; }

  writeStr("RIFF");
  u32(36 + dataSize);
  writeStr("WAVE");
  writeStr("fmt ");
  u32(16);
  u16(1);          // PCM
  u16(channels);
  u32(sr);
  u32(byteRate);
  u16(blockAlign);
  u16(16);         // bits per sample
  writeStr("data");
  u32(dataSize);

  const interleaved = new Float32Array(len * channels);
  for (let ch = 0; ch < channels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) interleaved[i * channels + ch] = data[i];
  }
  let off = 44;
  for (let i = 0; i < interleaved.length; i++) {
    let s = Math.max(-1, Math.min(1, interleaved[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(off, s, true);
    off += 2;
  }
  return ab;
}

/** Decode a WAV blob into an AudioBuffer using ctx.decodeAudioData. */
export async function decodeAudio(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    (ctx as AudioContext).decodeAudioData(data.slice(0), resolve, reject);
  });
}
