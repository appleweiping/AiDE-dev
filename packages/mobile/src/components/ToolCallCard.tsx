import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Image, ScrollView,
} from 'react-native';
import type { ToolCallDetail } from '../store/connection';
import { useTranslation } from '../i18n';
import DiffViewer from './DiffViewer';

interface Props {
  tool: ToolCallDetail;
  isRunning?: boolean;
}

export default function ToolCallCard({ tool, isRunning }: Props) {
  const s = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  const statusColor = isRunning ? '#f59e0b' : tool.isError ? '#f87171' : '#4ade80';
  const statusLabel = isRunning ? s.toolRunning : tool.isError ? s.toolError : s.toolDone;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={[styles.dot, { backgroundColor: statusColor }]} />
        <Text style={styles.name}>{tool.name}</Text>
        {tool.elapsedMs !== undefined && (
          <Text style={styles.duration}>{tool.elapsedMs}ms</Text>
        )}
        <Text style={styles.status}>{statusLabel}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Arguments */}
          {Object.keys(tool.args).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{s.arguments}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.code}>{JSON.stringify(tool.args, null, 2)}</Text>
              </ScrollView>
            </View>
          )}

          {/* Screenshot */}
          {tool.screenshotBase64 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Screenshot</Text>
              <Image
                source={{ uri: `data:image/png;base64,${tool.screenshotBase64}` }}
                style={styles.screenshot}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Diff */}
          {tool.diffs && tool.diffs.length > 0 && (
            <DiffViewer hunks={tool.diffs} />
          )}

          {/* Output */}
          {tool.output !== undefined && !tool.screenshotBase64 && (!tool.diffs || tool.diffs.length === 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{s.output}</Text>
              <ScrollView style={styles.outputScroll} nestedScrollEnabled>
                <Text style={[styles.code, tool.isError && styles.codeError]}>
                  {tool.output.slice(0, 2000)}{tool.output.length > 2000 ? '\n…' : ''}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, borderColor: '#2a2a3a', backgroundColor: '#16161e', marginVertical: 2 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: '#a5b4fc', fontSize: 13, fontWeight: '600', fontFamily: MONO, flex: 1 },
  duration: { color: '#555', fontSize: 11 },
  status: { color: '#666', fontSize: 11 },
  chevron: { color: '#555', fontSize: 10, marginLeft: 4 },
  body: { borderTopWidth: 1, borderTopColor: '#2a2a3a', padding: 10, gap: 8 },
  section: { gap: 4 },
  sectionLabel: { color: '#6366f1', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  code: { color: '#d4d4d4', fontSize: 11, fontFamily: MONO, lineHeight: 16 },
  codeError: { color: '#f87171' },
  outputScroll: { maxHeight: 160 },
  screenshot: { width: '100%', height: 200, borderRadius: 6, backgroundColor: '#000' },
});
