/** Pure, offline text statistics. No network, no account. */
export const STOP_WORDS = new Set(
  ('a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves im ive dont cant wont isnt its youre thats').split(' '),
);

export type KeywordStat = { word: string; count: number; percent: number };
export type TextStats = {
  words: number; characters: number; charactersNoSpaces: number; sentences: number; paragraphs: number;
  letters: number; syllables: number; readingSeconds: number; speakingSeconds: number;
  readability: number | null; readabilityLabel: string; keywords: KeywordStat[];
};

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? []);
}

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function readabilityLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 90) return 'Very easy';
  if (score >= 70) return 'Easy';
  if (score >= 60) return 'Plain English';
  if (score >= 50) return 'Fairly difficult';
  if (score >= 30) return 'Difficult';
  return 'Very difficult';
}

export function analyze(text: string, opts: { wpmRead?: number; wpmSpeak?: number; topN?: number } = {}): TextStats {
  const { wpmRead = 238, wpmSpeak = 140, topN = 10 } = opts;
  const words = tokenize(text);
  const trimmed = text.trim();
  const sentences = trimmed ? (trimmed.match(/[^.!?…]+(?:[.!?…]+|$)/g) ?? []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n+/).filter((p) => p.trim()).length : 0;
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  const readability = words.length && sentences
    ? Math.round(Math.min(121, Math.max(0, 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length))))
    : null;

  const counts = new Map<string, number>();
  for (const w of words) {
    if (STOP_WORDS.has(w.replace(/['’]/g, '')) || w.length < 2 || /^\d+$/.test(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([word, count]) => ({ word, count, percent: Math.round((count / words.length) * 1000) / 10 }));

  return {
    words: words.length,
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(/\s/g, '')].length,
    sentences, paragraphs,
    letters: (text.match(/\p{L}/gu) ?? []).length,
    syllables,
    readingSeconds: Math.ceil((words.length / wpmRead) * 60),
    speakingSeconds: Math.ceil((words.length / wpmSpeak) * 60),
    readability, readabilityLabel: readabilityLabel(readability), keywords,
  };
}

export function formatDuration(sec: number): string {
  if (sec <= 0) return '0 sec';
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60), s = sec % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}
