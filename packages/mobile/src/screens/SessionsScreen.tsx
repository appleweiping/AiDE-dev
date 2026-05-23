import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { useConnectionStore } from '../store/connection';
import { useTranslation } from '../i18n';

export default function SessionsScreen() {
  const {
    sessions, activeSessionId, selectSession, loadSessions,
    forkSession, providers, activeProvider, activeModel, switchModel,
    status,
  } = useConnectionStore();
  const s = useTranslation();
  const [refreshing, setRefreshing] = React.useState(false);
  const [modelSheetVisible, setModelSheetVisible] = React.useState(false);

  async function onRefresh() {
    setRefreshing(true);
    loadSessions();
    setTimeout(() => setRefreshing(false), 800);
  }

  function handleFork(sessionId: string) {
    Alert.alert(s.forkSession, '', [
      { text: s.cancel, style: 'cancel' },
      { text: s.forkSession, onPress: () => forkSession(sessionId) },
    ]);
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
      {/* Model switcher bar */}
      <TouchableOpacity style={styles.modelBar} onPress={() => setModelSheetVisible(true)}>
        <Text style={styles.modelBarLabel}>{s.currentModel}</Text>
        <Text style={styles.modelBarValue} numberOfLines={1}>
          {activeProvider ?? '—'} / {activeModel ?? '—'}
        </Text>
        <Text style={styles.modelBarChevron}>⌄</Text>
      </TouchableOpacity>

      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#555" />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.hint}>{s.noSessions}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, item.id === activeSessionId && styles.rowActive]}
            onPress={() => selectSession(item.id)}
            onLongPress={() => handleFork(item.id)}
          >
            <View style={styles.rowLeft}>
              {item.parentId && <Text style={styles.forkBadge}>fork</Text>}
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.providerId} · {item.model}
              </Text>
              <Text style={styles.dir} numberOfLines={1}>{item.workingDirectory}</Text>
              <Text style={styles.time}>
                {new Date(item.updatedAt).toLocaleString()}
              </Text>
            </View>
            {item.id === activeSessionId && <View style={styles.activeDot} />}
          </TouchableOpacity>
        )}
      />

      {/* Model switcher modal */}
      <Modal
        visible={modelSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModelSheetVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setModelSheetVisible(false)} activeOpacity={1}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{s.switchModel}</Text>
            <ScrollView>
              {providers.map((provider) => (
                <View key={provider.id}>
                  <Text style={styles.providerLabel}>{provider.name}</Text>
                  {provider.models.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.modelRow,
                        activeProvider === provider.id && activeModel === m.id && styles.modelRowActive,
                      ]}
                      onPress={() => {
                        switchModel(provider.id, m.id);
                        setModelSheetVisible(false);
                      }}
                    >
                      <Text style={styles.modelName}>{m.name}</Text>
                      <Text style={styles.modelCtx}>{(m.contextWindow / 1000).toFixed(0)}K</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { color: '#555', fontSize: 15 },
  modelBar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: '#1e1e2e', borderBottomWidth: 1, borderBottomColor: '#2a2a3a', gap: 8,
  },
  modelBarLabel: { color: '#555', fontSize: 12 },
  modelBarValue: { color: '#a5b4fc', fontSize: 13, fontWeight: '600', flex: 1 },
  modelBarChevron: { color: '#555', fontSize: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#1e1e2e',
  },
  rowActive: { backgroundColor: '#0d0d1a' },
  rowLeft: { flex: 1, gap: 2 },
  forkBadge: {
    alignSelf: 'flex-start', backgroundColor: '#2a2a4a', color: '#a5b4fc',
    fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginBottom: 2,
  },
  title: { color: '#e0e0e0', fontSize: 15, fontWeight: '600' },
  meta: { color: '#6366f1', fontSize: 12 },
  dir: { color: '#444', fontSize: 11 },
  time: { color: '#333', fontSize: 10 },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1e1e2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, maxHeight: '70%',
  },
  sheetTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 16 },
  providerLabel: { color: '#6366f1', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  modelRow: { padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modelRowActive: { backgroundColor: '#2a2a4a' },
  modelName: { color: '#e0e0e0', fontSize: 14 },
  modelCtx: { color: '#555', fontSize: 12 },
});
