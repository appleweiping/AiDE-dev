import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useConnectionStore } from '../store/connection';
import { useTranslation } from '../i18n';

export default function GitScreen() {
  const { gitStatus, gitLog, loadGitStatus, loadGitLog, activeSessionId, sessions, status } = useConnectionStore();
  const s = useTranslation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [tab, setTab] = React.useState<'status' | 'log'>('status');

  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = session?.workingDirectory ?? '.';

  React.useEffect(() => {
    if (status === 'connected' && activeSessionId) {
      loadGitStatus(cwd);
      loadGitLog(cwd);
    }
  }, [activeSessionId, status]);

  async function onRefresh() {
    setRefreshing(true);
    loadGitStatus(cwd);
    loadGitLog(cwd);
    setTimeout(() => setRefreshing(false), 800);
  }

  if (status !== 'connected' && status !== 'reconnecting') {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{s.notConnected}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Branch header */}
      {gitStatus && (
        <View style={styles.branchBar}>
          <Text style={styles.branchIcon}>⎇</Text>
          <Text style={styles.branchName}>{gitStatus.branch}</Text>
          {gitStatus.ahead > 0 && <Text style={styles.badge}>↑{gitStatus.ahead}</Text>}
          {gitStatus.behind > 0 && <Text style={styles.badge}>↓{gitStatus.behind}</Text>}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'status' && styles.tabActive]}
          onPress={() => setTab('status')}
        >
          <Text style={[styles.tabText, tab === 'status' && styles.tabTextActive]}>{s.gitStatus}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'log' && styles.tabActive]}
          onPress={() => setTab('log')}
        >
          <Text style={[styles.tabText, tab === 'log' && styles.tabTextActive]}>{s.commitHistory}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
      >
        {tab === 'status' ? (
          gitStatus ? (
            <View style={styles.statusContent}>
              {gitStatus.staged.length > 0 && (
                <Section label={s.staged} items={gitStatus.staged} color="#4ade80" prefix="M" />
              )}
              {gitStatus.unstaged.length > 0 && (
                <Section label={s.unstaged} items={gitStatus.unstaged} color="#f59e0b" prefix="M" />
              )}
              {gitStatus.untracked.length > 0 && (
                <Section label={s.untracked} items={gitStatus.untracked} color="#888" prefix="?" />
              )}
              {gitStatus.staged.length === 0 && gitStatus.unstaged.length === 0 && gitStatus.untracked.length === 0 && (
                <View style={styles.center}>
                  <Text style={styles.hint}>{s.noChanges}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.center}><Text style={styles.hint}>{s.loading}</Text></View>
          )
        ) : (
          <View style={styles.logContent}>
            {gitLog.map((line, i) => (
              <Text key={i} style={styles.logLine}>{line}</Text>
            ))}
            {gitLog.length === 0 && (
              <View style={styles.center}><Text style={styles.hint}>{s.loading}</Text></View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ label, items, color, prefix }: { label: string; items: string[]; color: string; prefix: string }) {
  return (
    <View style={sectionStyles.container}>
      <Text style={sectionStyles.label}>{label} ({items.length})</Text>
      {items.map((item, i) => (
        <View key={i} style={sectionStyles.row}>
          <Text style={[sectionStyles.prefix, { color }]}>{prefix}</Text>
          <Text style={sectionStyles.path} numberOfLines={1}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { color: '#6366f1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  prefix: { fontSize: 12, fontWeight: '700', width: 14, fontFamily: 'monospace' },
  path: { color: '#d4d4d4', fontSize: 13, fontFamily: 'monospace', flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { color: '#555', fontSize: 14 },
  branchBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: '#1e1e2e', borderBottomWidth: 1, borderBottomColor: '#2a2a3a', gap: 8,
  },
  branchIcon: { color: '#6366f1', fontSize: 16 },
  branchName: { color: '#a5b4fc', fontSize: 14, fontWeight: '600', flex: 1 },
  badge: { backgroundColor: '#2a2a4a', color: '#a5b4fc', fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tabs: { flexDirection: 'row', backgroundColor: '#1e1e2e', borderBottomWidth: 1, borderBottomColor: '#2a2a3a' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { color: '#555', fontSize: 13 },
  tabTextActive: { color: '#a5b4fc', fontWeight: '600' },
  scroll: { flex: 1 },
  statusContent: { padding: 14 },
  logContent: { padding: 14 },
  logLine: { color: '#888', fontSize: 12, fontFamily: 'monospace', lineHeight: 18, marginBottom: 2 },
});
