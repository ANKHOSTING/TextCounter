import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { analyze, formatDuration } from '@/lib/textStats';
import { useEditor } from '@/lib/editor';
import { AdBanner } from '@/components/AdBanner';
import { Card, Stat, colors, s } from '@/components/ui';

export default function Analysis() {
  const { text } = useEditor();
  const st = useMemo(() => analyze(text, { topN: 15 }), [text]);
  const max = st.keywords[0]?.count ?? 1;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14 }}>
        {!text.trim() && <Card><Text style={s.muted}>Write or paste text on the Write tab to see a full analysis.</Text></Card>}
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Stat label="Words" value={st.words} />
          <Stat label="Characters" value={st.characters} />
          <Stat label="Chars (no spaces)" value={st.charactersNoSpaces} />
          <Stat label="Letters" value={st.letters} />
          <Stat label="Sentences" value={st.sentences} />
          <Stat label="Paragraphs" value={st.paragraphs} />
        </Card>
        <Card>
          <Text style={s.h2}>Time</Text>
          <Text>📖 Reading time: {formatDuration(st.readingSeconds)} <Text style={s.muted}>(238 wpm)</Text></Text>
          <Text>🎤 Speaking time: {formatDuration(st.speakingSeconds)} <Text style={s.muted}>(140 wpm)</Text></Text>
        </Card>
        <Card>
          <Text style={s.h2}>Readability</Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>{st.readability ?? '—'}</Text>
          <Text>{st.readabilityLabel}</Text>
          <Text style={[s.muted, { fontSize: 12, marginTop: 4 }]}>Flesch Reading Ease (0–100, higher is easier). English estimate.</Text>
        </Card>
        <Card>
          <Text style={s.h2}>Keyword density</Text>
          {st.keywords.length === 0 && <Text style={s.muted}>No keywords yet. Common words like “the” and “and” are excluded.</Text>}
          {st.keywords.map((k) => (
            <View key={k.word} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600' }}>{k.word}</Text>
                <Text style={s.muted}>{k.count}× · {k.percent}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#EEF2FF', borderRadius: 3 }}>
                <View style={{ height: 6, width: `${(k.count / max) * 100}%`, backgroundColor: colors.primary, borderRadius: 3 }} />
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
      <AdBanner />
    </View>
  );
}
