/** Microphone recorder. Returns an AudioBuffer when stopped. */

export type MicRecordError =
  | "permission-denied"
  | "no-mic"
  | "in-use"
  | "no-recorder"
  | "https-required"
  | "empty"
  | "decode-failed"
  | "unknown";

export class MicRecorderError extends Error {
  code: MicRecordError;
  constructor(code: MicRecordError, message: string) {
    super(message);
    this.code = code;
  }
}

export class MicRecorder {
  private ctx: AudioContext;
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async start(): Promise<void> {
    // HTTPS check. On http (non-localhost) browsers don't expose getUserMedia.
    if (
      !window.isSecureContext &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {
      throw new MicRecorderError(
        "https-required",
        "マイク録音には HTTPS 接続が必要です",
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicRecorderError("no-recorder", "このブラウザはマイク録音に対応していません");
    }
    if (typeof MediaRecorder === "undefined") {
      throw new MicRecorderError("no-recorder", "MediaRecorder が利用できません");
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new MicRecorderError(
          "permission-denied",
          "マイクの使用が許可されていません",
        );
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new MicRecorderError("no-mic", "マイクが見つかりませんでした");
      }
      if (name === "NotReadableError") {
        throw new MicRecorderError(
          "in-use",
          "マイクが他のアプリで使用中です",
        );
      }
      throw new MicRecorderError("unknown", String(e?.message || e));
    }

    const mime = pickMediaRecorderMime();
    try {
      this.rec = mime
        ? new MediaRecorder(this.stream, { mimeType: mime })
        : new MediaRecorder(this.stream);
    } catch (e: any) {
      this.cleanup();
      throw new MicRecorderError("no-recorder", String(e?.message || e));
    }
    this.chunks = [];
    this.rec.ondataavailable = (e) => {
      if (e.data?.size) this.chunks.push(e.data);
    };
    // Use a 250ms timeslice. iOS Safari sometimes fails to flush chunks when
    // started without a timeslice, leaving the recording empty.
    this.rec.start(250);
  }

  async stop(): Promise<AudioBuffer> {
    if (!this.rec) throw new MicRecorderError("no-recorder", "録音していません");
    const rec = this.rec;
    return new Promise((resolve, reject) => {
      rec.onstop = async () => {
        try {
          if (this.chunks.length === 0 || this.chunks.every((c) => c.size === 0)) {
            this.cleanup();
            reject(
              new MicRecorderError(
                "empty",
                "音声データを取得できませんでした (マイクからの入力なし、もしくは権限不足の可能性)",
              ),
            );
            return;
          }
          const blob = new Blob(this.chunks, { type: rec.mimeType });
          this.cleanup();
          const arr = await blob.arrayBuffer();
          let buf: AudioBuffer;
          try {
            buf = await this.ctx.decodeAudioData(arr);
          } catch (e: any) {
            reject(new MicRecorderError("decode-failed", String(e?.message || e)));
            return;
          }
          resolve(buf);
        } catch (e: any) {
          reject(new MicRecorderError("unknown", String(e?.message || e)));
        }
      };
      try {
        rec.stop();
      } catch (e: any) {
        this.cleanup();
        reject(new MicRecorderError("unknown", String(e?.message || e)));
      }
    });
  }

  private cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.rec = null;
  }

  get isRecording() { return this.rec?.state === "recording"; }
}

/** Choose the best supported MediaRecorder mime type for the current platform.
 * Safari (incl. iOS) only supports audio/mp4; Chromium prefers webm/opus. */
export function pickMediaRecorderMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}
