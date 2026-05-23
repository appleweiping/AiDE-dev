import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl,
} from 'react-native';
import { useConnectionStore } from '../store/connection';

export default function SessionsScreen() {
  const { sessions, activeSessionId, selectSession, loadSessions, status } = useConnectionStore();
  const [refreshing, setRefreshing] = React.useState(false);

  async function onRefresh() {
    setRefreshing(true);
    loadSessions();
    setTimeout(() => setRefreshing(false), 1000);
  }

  if (status !== 'connected') {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>Connect to your desktop first</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={sessions}
      keyExtractor={(s) => s.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#888" />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.hint}>No sessions yet</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, item.id === activeSessionId && styles.rowActive]}
          onPress={() => selectSession(item.id)}
        >
          <View style={styles.rowContent}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.providerId} · {item.model}
            </Text>
            <Text style={styles.dir} numberOfLines={1}>{item.workingDirectory}</Text>
          </View>
          {item.id === activeSessionId && (
            <View style={styles.activeDot} />
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#1a1a1a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { color: '#666', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  rowActive: { backgroundColor: '#1a1a2e' },
  rowContent: { flex: 1 },
  title: { color: '#e0e0e0', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  meta: { color: '#6366f1', fontSize: 12, marginBottom: 2 },
  dir: { color: '#555', fontSize: 11 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },
});
