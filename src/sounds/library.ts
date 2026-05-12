// Built-in sound catalog. Each entry produces an AudioBuffer on demand.

import * as Drums from "./drums";
import * as Mel from "./melodic";
import * as Animal from "./animals";
import * as Nature from "./nature";

export interface BuiltinSound {
  id: string;
  name: string;
  category: string;
  color?: string;
  /** Lazily render an AudioBuffer for this sound. */
  render: () => Promise<AudioBuffer>;
}

const C = {
  drum: "#ff565f",
  bass: "#7882ff",
  melody: "#50dcb4",
  pad: "#b48cff",
  bell: "#ffc83c",
  fx: "#ff7eb6",
  animal: "#ffa852",
  nature: "#6dd3ff",
};

export const BUILTIN_SOUNDS: BuiltinSound[] = [
  // Drums
  { id: "kick-808", name: "Kick 808", category: "ドラム", color: C.drum, render: Drums.kick808 },
  { id: "kick-909", name: "Kick 909", category: "ドラム", color: C.drum, render: Drums.kick909 },
  { id: "snare", name: "Snare", category: "ドラム", color: C.drum, render: Drums.snare },
  { id: "clap", name: "Clap", category: "ドラム", color: C.drum, render: Drums.clap },
  { id: "hat-c", name: "Hat (Closed)", category: "ドラム", color: C.drum, render: Drums.hatClosed },
  { id: "hat-o", name: "Hat (Open)", category: "ドラム", color: C.drum, render: Drums.hatOpen },
  { id: "tom-low", name: "Tom (Low)", category: "ドラム", color: C.drum, render: () => Drums.tom(80) },
  { id: "tom-mid", name: "Tom (Mid)", category: "ドラム", color: C.drum, render: () => Drums.tom(140) },
  { id: "tom-hi", name: "Tom (Hi)", category: "ドラム", color: C.drum, render: () => Drums.tom(220) },
  { id: "rim", name: "Rim Shot", category: "ドラム", color: C.drum, render: Drums.rim },
  { id: "cymbal", name: "Cymbal", category: "ドラム", color: C.drum, render: Drums.cymbal },

  // Melodic
  { id: "bell-c4", name: "FM Bell (C4)", category: "メロディ", color: C.bell, render: () => Mel.fmBell(60) },
  { id: "bell-c5", name: "FM Bell (C5)", category: "メロディ", color: C.bell, render: () => Mel.fmBell(72) },
  { id: "epiano-c4", name: "FM EP (C4)", category: "メロディ", color: C.melody, render: () => Mel.fmEPiano(60) },
  { id: "saw-c4", name: "Saw Lead (C4)", category: "メロディ", color: C.melody, render: () => Mel.sawLead(60) },
  { id: "pluck-c4", name: "Pluck (C4)", category: "メロディ", color: C.melody, render: () => Mel.pluck(60) },
  { id: "glass-c5", name: "Glass (C5)", category: "メロディ", color: C.bell, render: () => Mel.glass(72) },

  // Bass / Pad
  { id: "subbass-c2", name: "Sub Bass (C2)", category: "ベース", color: C.bass, render: () => Mel.subBass(36) },
  { id: "subbass-e2", name: "Sub Bass (E2)", category: "ベース", color: C.bass, render: () => Mel.subBass(40) },
  { id: "subbass-g2", name: "Sub Bass (G2)", category: "ベース", color: C.bass, render: () => Mel.subBass(43) },
  { id: "pad-c4", name: "Pad (C4)", category: "パッド", color: C.pad, render: () => Mel.pad(60) },
  { id: "pad-f4", name: "Pad (F4)", category: "パッド", color: C.pad, render: () => Mel.pad(65) },

  // Animals
  { id: "cat", name: "猫の鳴き声", category: "動物", color: C.animal, render: Animal.cat },
  { id: "dog", name: "犬の鳴き声", category: "動物", color: C.animal, render: Animal.dog },
  { id: "bird", name: "鳥のさえずり", category: "動物", color: C.animal, render: Animal.bird },
  { id: "frog", name: "カエル", category: "動物", color: C.animal, render: Animal.frog },
  { id: "cow", name: "牛", category: "動物", color: C.animal, render: Animal.cow },
  { id: "owl", name: "フクロウ", category: "動物", color: C.animal, render: Animal.owl },
  { id: "cricket", name: "コオロギ", category: "動物", color: C.animal, render: Animal.cricket },
  { id: "wolf", name: "オオカミの遠吠え", category: "動物", color: C.animal, render: Animal.wolf },
  { id: "rooster", name: "ニワトリ", category: "動物", color: C.animal, render: Animal.rooster },
  { id: "sheep", name: "ヒツジ", category: "動物", color: C.animal, render: Animal.sheep },

  // Nature
  { id: "rain", name: "雨音", category: "自然", color: C.nature, render: Nature.rain },
  { id: "waves", name: "波", category: "自然", color: C.nature, render: Nature.waves },
  { id: "wind", name: "風", category: "自然", color: C.nature, render: Nature.wind },
  { id: "thunder", name: "雷", category: "自然", color: C.nature, render: Nature.thunder },
  { id: "fire", name: "焚き火", category: "自然", color: C.nature, render: Nature.fire },
  { id: "stream", name: "小川", category: "自然", color: C.nature, render: Nature.stream },

  // FX
  { id: "vinyl", name: "Vinyl Crackle", category: "FX", color: C.fx, render: Nature.vinyl },
  { id: "riser", name: "Riser", category: "FX", color: C.fx, render: Nature.riser },
];

export function getBuiltin(id: string): BuiltinSound | undefined {
  return BUILTIN_SOUNDS.find((s) => s.id === id);
}
