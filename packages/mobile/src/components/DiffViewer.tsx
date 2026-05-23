import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import type { DiffHunk } from '../store/connection';
import { useTranslation } from '../i18n';

interface Props {
  hunks: DiffHunk[];
  fileName?: string;
}

export default function DiffViewer({ hunks, fileName }: Props) {
  const s = useTranslation();
  if (hunks.length === 0) return null;

  return (
    <View style={styles.container}>
      {fileName && <Text style={styles.fileName}>{fileName}</Text>}
      <Text style={styles.label}>{s.diffPreview}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {hunks.map((hunk, hi) => (
            <View key={hi} style={styles.hunk}>
              <Text style={styles.hunkHeader}>
                @@ -{hunk.oldStart} +{hunk.newStart} @@
              </Text>
              {hunk.oldLines.map((line, li) => (
                <View key={`old-${li}`} style={styles.lineRemove}>
                  <Text style={styles.lineSign}>-</Text>
                  <Text style={styles.lineTextRemove}>{line}</Text>
                </View>
              ))}
              {hunk.newLines.map((line, li) => (
                <View key={`new-${li}`} style={styles.lineAdd}>
                  <Text style={styles.lineSign}>+</Text>
                  <Text style={styles.lineTextAdd}>{line}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  container: { marginTop: 8, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
  fileName: { color: '#aaa', fontSize: 11, paddingHorizontal: 10, paddingTop: 6, fontFamily: MONO },
  label: { color: '#6366f1', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingBottom: 4, textTransform: 'uppercase' },
  hunk: { marginBottom: 4 },
  hunkHeader: { color: '#6366f1', fontSize: 11, fontFamily: MONO, backgroundColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 2 },
  lineRemove: { flexDirection: 'row', backgroundColor: '#2a1a1a', paddingHorizontal: 10, paddingVertical: 1 },
  lineAdd: { flexDirection: 'row', backgroundColor: '#1a2a1a', paddingHorizontal: 10, paddingVertical: 1 },
  lineSign: { color: '#888', fontSize: 12, fontFamily: MONO, width: 14 },
  lineTextRemove: { color: '#f87171', fontSize: 12, fontFamily: MONO, flexShrink: 1 },
  lineTextAdd: { color: '#4ade80', fontSize: 12, fontFamily: MONO, flexShrink: 1 },
});
