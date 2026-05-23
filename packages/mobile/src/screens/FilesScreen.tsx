import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useConnectionStore, type FileEntry } from '../store/connection';
import { useTranslation } from '../i18n';

export default function FilesScreen() {
  const { fileTree, fileTreeLoading, loadFileTree, activeSessionId, sessions, status } = useConnectionStore();
  const s = useTranslation();
  const [pathStack, setPathStack] = React.useState<string[]>([]);

  const session = sessions.find((s) => s.id === activeSessionId);
  const rootPath = session?.workingDirectory ?? '.';

  React.useEffect(() => {
    if (status === 'connected' && activeSessionId) {
      loadFileTree(rootPath);
      setPathStack([]);
    }
  }, [activeSessionId, status]);

  function openDir(entry: FileEntry) {
    setPathStack((p) => [...p, entry.path]);
    loadFileTree(entry.path);
  }

  function goUp() {
    const newStack = pathStack.slice(0, -1);
    setPathStack(newStack);
    loadFileTree(newStack[newStack.length - 1] ?? rootPath);
  }

  const currentPath = pathStack[pathStack.length - 1] ?? rootPath;
  const displayPath = currentPath.replace(rootPath, '') || '/';

  if (status !== 'connected' && status !== 'reconnecting') {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{s.notConnected}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        {pathStack.length > 0 && (
          <TouchableOpacity onPress={goUp} style={styles.backBtn}>
            <Text style={styles.backText}>← </Text>
          </TouchableOpacity>
        )}
        <Text style={styles.pathText} numberOfLines={1}>{displayPath}</Text>
        <TouchableOpacity onPress={() => loadFileTree(currentPath)} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {fileTreeLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6366f1" />
          <Text style={styles.hint}>{s.loading}</Text>
        </View>
      ) : (
        <FlatList
          data={fileTree}
          keyExtractor={(e) => e.path}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.hint}>{s.noFiles}</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => item.type === 'directory' ? openDir(item) : null}
              activeOpacity={item.type === 'directory' ? 0.6 : 1}
            >
              <Text style={styles.icon}>{item.type === 'directory' ? '📁' : getFileIcon(item.name)}</Text>
              <View style={styles.rowContent}>
                <Text style={[styles.name, item.type === 'directory' && styles.dirName]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.size !== undefined && item.type === 'file' && (
                  <Text style={styles.size}>{formatSize(item.size)}</Text>
                )}
              </View>
              {item.type === 'directory' && <Text style={styles.chevron}>›</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const icons: Record<string, string> = {
    ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨', py: '🐍',
    rs: '🦀', go: '🐹', java: '☕', md: '📝', json: '📋',
    toml: '📋', yaml: '📋', yml: '📋', sh: '⚙️', css: '🎨',
    html: '🌐', png: '🖼️', jpg: '🖼️', svg: '🖼️', pdf: '📄',
    zip: '📦', tar: '📦', gz: '📦',
  };
  return icons[ext] ?? '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  hint: { color: '#555', fontSize: 14 },
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#1e1e2e', borderBottomWidth: 1, borderBottomColor: '#2a2a3a',
  },
  backBtn: { paddingRight: 4 },
  backText: { color: '#6366f1', fontSize: 18 },
  pathText: { flex: 1, color: '#888', fontSize: 12, fontFamily: 'monospace' },
  refreshBtn: { paddingLeft: 8 },
  refreshText: { color: '#555', fontSize: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: '#1a1a22', gap: 10,
  },
  icon: { fontSize: 18, width: 24 },
  rowContent: { flex: 1 },
  name: { color: '#d4d4d4', fontSize: 14 },
  dirName: { color: '#a5b4fc', fontWeight: '600' },
  size: { color: '#444', fontSize: 11, marginTop: 1 },
  chevron: { color: '#444', fontSize: 18 },
});
