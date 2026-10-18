// Read-aloud for the side panel, on the browser's speech engine through easy-speech (which papers over
// voice loading and Chrome's habit of cutting long utterances). The panel is read block by block: each
// block is highlighted while it is spoken, the current word is marked where the browser reports word
// boundaries, and clicking a block jumps there.
import EasySpeech from "easy-speech";
import type { SelectItemData } from "./ui.tsx";

const WORD = "hb-word";
const RATE_KEY = "hb-rate", VOICE_KEY = "hb-voice";

// Only two voices are offered: Google's UK English female and male voices (Chrome). Other browsers
// don't have them, so there the closest English female and male voices stand in.
const PREFERRED = ["Google UK English Female", "Google UK English Male"];
const FEMALE = /female|samantha|karen|moira|serena|tessa|victoria|zira|jenny|aria|libby|sonia|susan|hazel|kate|fiona/i;
const MALE = /\bmale|daniel|alex\b|fred|oliver|arthur|david|guy|ryan|george|thomas|james|mark|aaron|rishi/i;
interface VoiceChoice {
  voice: SpeechSynthesisVoice;
  label: string;
  key: string;
}
function pickVoices(all: SpeechSynthesisVoice[]): VoiceChoice[] {
  const en = all.filter((v) => /^en\b|^en[-_]/i.test(v.lang));
  const google = PREFERRED.map((n) => en.find((v) => v.name === n)).filter((v) => v !== undefined);
  if (google.length === 2) return google.map((v, i) => ({ voice: v, label: `${v.name} · ${v.lang}`, key: i ? "male" : "female" }));
  const gb = (v: SpeechSynthesisVoice) => (/en[-_]GB/i.test(v.lang) ? 0 : 1);
  const female = en.filter((v) => FEMALE.test(v.name) && !/\bmale/i.test(v.name.replace(/female/i, ""))).sort((a, b) => gb(a) - gb(b))[0];
  const male = en.filter((v) => MALE.test(v.name) && !/female/i.test(v.name)).sort((a, b) => gb(a) - gb(b))[0];
  const out: VoiceChoice[] = [];
  if (female) out.push({ voice: female, label: `${female.name} · ${female.lang}`, key: "female" });
  if (male) out.push({ voice: male, label: `${male.name} · ${male.lang}`, key: "male" });
  if (!out.length && en[0]) out.push({ voice: en[0], label: `${en[0].name} · ${en[0].lang}`, key: "default" });
  return out;
}

type State = "idle" | "playing" | "paused";
export interface ListenerOptions {
  root: HTMLElement;
  scroller: HTMLElement;
  player: HTMLElement;
  onVoices?: (items: SelectItemData[], value: string) => void;
}
export type Listener = ReturnType<typeof createListener>;

export function createListener({ root, scroller, player, onVoices }: ListenerOptions) {
  const playBtn = player.querySelector<HTMLButtonElement>("[data-say='play']")!;
  const stopBtn = player.querySelector<HTMLButtonElement>("[data-say='stop']")!;
  const count = player.querySelector<HTMLElement>("[data-say='count']")!;
  const note = player.querySelector<HTMLElement>("[data-say='note']")!;

  let ready: Promise<boolean> | null = null; // init promise
  let voices: VoiceChoice[] = [];
  let voiceKey = localStorage.getItem(VOICE_KEY) || "female";
  let blocks: HTMLElement[] = [];
  let at = 0;
  let state: State = "idle";
  let run = 0; // bumps on every stop/jump so a stale utterance can't advance the queue

  let rate: string = localStorage.getItem(RATE_KEY) ?? "1";

  function init() {
    if (ready) return ready;
    if (!("speechSynthesis" in window)) return (ready = Promise.resolve(false));
    ready = EasySpeech.init({ maxTimeout: 5000, interval: 250, quiet: true })
      .then(() => {
        voices = pickVoices(EasySpeech.voices());
        if (!voices.some((v) => v.key === voiceKey)) voiceKey = voices[0]?.key ?? voiceKey;
        onVoices?.(voices.map((v) => ({ value: v.key, label: v.label })), voiceKey);
        return voices.length > 0;
      })
      .catch(() => false);
    return ready;
  }

  const textOf = (el: HTMLElement) => el.dataset.say || el.textContent.replace(/\s+/g, " ").trim();
  const wordable = (el: HTMLElement) => !el.dataset.say;

  function mark(i: number) {
    blocks.forEach((b, k) => b.classList.toggle("is-saying", k === i && state !== "idle"));
    if (state !== "idle" && blocks[i]) {
      // Keep the spoken block in view inside the panel's scroll area.
      const b = blocks[i].getBoundingClientRect(), v = scroller.getBoundingClientRect();
      if (b.top < v.top + 8 || b.bottom > v.bottom - 8) scroller.scrollBy({ top: b.top - v.top - 24, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    count.textContent = blocks.length ? `${Math.min(i + 1, blocks.length)} / ${blocks.length}` : "";
  }
  function markWord(el: HTMLElement, start: number, len: number) {
    if (!window.CSS?.highlights || !wordable(el)) return;
    // Walk text nodes to turn the utterance's char offset into a DOM range. The spoken text is the
    // whitespace-collapsed textContent, which matches the DOM text for these plain blocks.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Text | null, off = 0;
    const range = new Range();
    let started = false;
    const end = start + (len || 1);
    while ((n = walker.nextNode() as Text | null)) {
      const t = n.data.replace(/\s+/g, " ");
      if (!started && start < off + t.length) (range.setStart(n, Math.max(0, start - off)), (started = true));
      if (started && end <= off + t.length) {
        range.setEnd(n, Math.max(0, end - off));
        CSS.highlights.set(WORD, new Highlight(range));
        return;
      }
      off += t.length;
    }
  }
  const clearWord = () => window.CSS?.highlights?.delete(WORD);

  function render() {
    player.dataset.state = state;
    playBtn.setAttribute("aria-label", state === "playing" ? "Pause" : "Play");
    playBtn.querySelector("span")!.textContent = state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Play";
    stopBtn.disabled = state === "idle";
    mark(at);
  }

  async function speakFrom(i: number) {
    const token = ++run;
    EasySpeech.cancel();
    clearWord();
    for (at = i; at < blocks.length; at++) {
      if (token !== run) return;
      state = "playing";
      render();
      const el = blocks[at];
      // Words longer than the boundary length (or browsers without charLength) still get marked.
      const text = textOf(el);
      try {
        await EasySpeech.speak({
          text,
          voice: voices.find((v) => v.key === voiceKey)?.voice,
          rate: Number(rate),
          pitch: 1,
          volume: 1,
          boundary: (e) => {
            if (token !== run || e.name === "sentence") return;
            const len = e.charLength || (text.slice(e.charIndex).match(/^\S+/)?.[0].length ?? 1);
            markWord(el, e.charIndex, len);
          },
        });
      } catch {
        if (token !== run) return; // cancelled by stop/jump
      }
      clearWord();
    }
    if (token !== run) return;
    state = "idle";
    at = 0;
    render();
  }

  async function play() {
    const ok = await init();
    if (!ok) {
      note.hidden = false;
      note.textContent = "Your browser has no speech voices, so the panel can't be read aloud here.";
      return;
    }
    note.hidden = true;
    if (state === "playing") {
      EasySpeech.pause();
      state = "paused";
      return render();
    }
    if (state === "paused") {
      EasySpeech.resume();
      state = "playing";
      return render();
    }
    speakFrom(at);
  }
  function stop() {
    run++;
    if (ready) EasySpeech.cancel();
    clearWord();
    state = "idle";
    at = 0;
    render();
  }

  // Load a freshly rendered panel. Blocks are the elements marked data-block, in reading order.
  function load({ autoplay = false }: { autoplay?: boolean } = {}) {
    stop();
    blocks = [...root.querySelectorAll<HTMLElement>("[data-block]")];
    blocks.forEach((b, i) =>
      b.addEventListener("click", (e) => {
        if (!player.closest("[data-mode='listen']") || (e.target as Element).closest("a")) return;
        speakFrom(i);
      }),
    );
    render();
    if (autoplay) play();
  }

  playBtn.addEventListener("click", play);
  stopBtn.addEventListener("click", stop);
  function setRate(value: string) {
    rate = value;
    localStorage.setItem(RATE_KEY, value);
    if (state === "playing") speakFrom(at);
  }
  function setVoice(key: string) {
    voiceKey = key;
    localStorage.setItem(VOICE_KEY, key);
    if (state === "playing") speakFrom(at);
  }

  return { load, play, stop, init, setVoice, setRate, get rate() { return rate; }, get state() { return state; }, get at() { return at; } };
}
