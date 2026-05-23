import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from 'react-native';
import { useConnectionStore } from '../store/connection';

export default function ChatScreen() {
  const {
    messages, streamingContent, sendMessage, cancelAgent,
    pendingApproval, respondApproval, desktopOnline, activeSessionId,
    status,
  } = useConnectionStore();

  const [input, setInput] = React.useState('');
  const listRef = React.useRef<FlatList>(null);
  const isStreaming = streamingContent.length > 0;

  React.useEffect(() => {
    if (messages.length > 0 || isStreaming) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length, streamingContent]);

  function handleSend() {
    const text = input.trim();
    if (!text || !activeSessionId) return;
    setInput('');
    sendMessage(text);
  }

  if (status !== 'connected') {
    return (
      <View style={styles.center}>
        <Text style={styles.offlineText}>Not connected to desktop</Text>
      </View>
    );
  }

  if (!activeSessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.offlineText}>Select a session to start chatting</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Desktop status bar */}
      <View style={[styles.statusBar, desktopOnline ? styles.statusOnline : styles.statusOffline]}>
        <View style={[styles.dot, desktopOnline ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.statusText}>
          {desktopOnline ? 'Desktop connected' : 'Desktop offline'}
        </Text>
      </View>

      {/* Approval dialog */}
      {pendingApproval && (
        <View style={styles.approvalCard}>
          <Text style={styles.approvalTitle}>Approval Required</Text>
          <Text style={styles.approvalTool}>{pendingApproval.toolName}</Text>
          {pendingApproval.command && (
            <Text style={styles.approvalCommand}>{pendingApproval.command}</Text>
          )}
          <View style={styles.approvalButtons}>
            <TouchableOpacity
              style={[styles.approvalBtn, styles.approvalDeny]}
              onPress={() => respondApproval(pendingApproval.id, false)}
            >
              <Text style={styles.approvalBtnText}>Deny</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.approvalBtn, styles.approvalAllow]}
              onPress={() => respondApproval(pendingApproval.id, true)}
            >
              <Text style={styles.approvalBtnText}>Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble,
            item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            item.role === 'tool' && styles.bubbleTool,
            item.isError && styles.bubbleError,
          ]}>
            {item.role === 'tool' && (
              <Text style={styles.toolLabel}>{item.toolName ?? 'tool'}</Text>
            )}
            <Text style={[
              styles.bubbleText,
              item.role === 'user' && styles.bubbleTextUser,
              item.role === 'tool' && styles.bubbleTextTool,
            ]}>
              {item.content}
            </Text>
          </View>
        )}
        ListFooterComponent={
          isStreaming ? (
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={styles.bubbleText}>{streamingContent}</Text>
              <ActivityIndicator size="small" color="#888" style={{ marginTop: 4 }} />
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message AiDE..."
          placeholderTextColor="#666"
          multiline
          maxLength={4000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        {isStreaming ? (
          <TouchableOpacity style={[styles.sendBtn, styles.cancelBtn]} onPress={cancelAgent}>
            <Text style={styles.sendBtnText}>■</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  offlineText: { color: '#888', fontSize: 16 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 6, gap: 8,
  },
  statusOnline: { backgroundColor: '#1a2a1a' },
  statusOffline: { backgroundColor: '#2a1a1a' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOnline: { backgroundColor: '#4caf50' },
  dotOffline: { backgroundColor: '#f44336' },
  statusText: { color: '#aaa', fontSize: 12 },
  approvalCard: {
    margin: 12, padding: 16, backgroundColor: '#2a2a1a',
    borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b',
  },
  approvalTitle: { color: '#f59e0b', fontWeight: '700', fontSize: 14, marginBottom: 4 },
  approvalTool: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  approvalCommand: {
    color: '#aaa', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#111', padding: 8, borderRadius: 6, marginBottom: 12,
  },
  approvalButtons: { flexDirection: 'row', gap: 12 },
  approvalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approvalDeny: { backgroundColor: '#3a1a1a' },
  approvalAllow: { backgroundColor: '#1a3a1a' },
  approvalBtnText: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 8 },
  bubble: {
    maxWidth: '85%', padding: 12, borderRadius: 16,
    marginBottom: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end', backgroundColor: '#2563eb', borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start', backgroundColor: '#2a2a2a', borderBottomLeftRadius: 4,
  },
  bubbleTool: { backgroundColor: '#1a1a2a', borderWidth: 1, borderColor: '#334' },
  bubbleError: { backgroundColor: '#2a1a1a', borderWidth: 1, borderColor: '#f44336' },
  bubbleText: { color: '#e0e0e0', fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextTool: { color: '#aaa', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  toolLabel: { color: '#6366f1', fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    gap: 8, borderTopWidth: 1, borderTopColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  input: {
    flex: 1, backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    maxHeight: 120, borderWidth: 1, borderColor: '#444',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: '#dc2626' },
  sendBtnDisabled: { backgroundColor: '#333' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
