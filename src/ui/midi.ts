// Web MIDI input → pad triggers, with velocity.

export interface MidiOptions {
  onNoteOn(note: number, velocity: number): void;
  onConnected(name: string): void;
  onDisconnected(name: string): void;
}

export async function setupMidi(opts: MidiOptions): Promise<void> {
  if (!navigator.requestMIDIAccess) return;
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const bind = (input: MIDIInput) => {
      opts.onConnected(input.name || "MIDI");
      input.onmidimessage = (e) => {
        const data = e.data as Uint8Array | null;
        if (!data || data.length < 3) return;
        const status = data[0];
        const n = data[1];
        const v = data[2];
        const cmd = status & 0xf0;
        if (cmd === 0x90 && v > 0) opts.onNoteOn(n, v / 127);
      };
    };
    access.inputs.forEach(bind);
    access.onstatechange = (e) => {
      const port = (e as any).port as MIDIPort;
      if (port.type === "input") {
        if (port.state === "connected") bind(port as MIDIInput);
        else if (port.state === "disconnected")
          opts.onDisconnected(port.name || "MIDI");
      }
    };
  } catch {
    // MIDI not granted; ignore.
  }
}
