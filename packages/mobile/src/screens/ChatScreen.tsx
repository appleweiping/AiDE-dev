import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useConnectionStore } from '../store/connection';
import { useTranslation } from '../i18n';
import ToolCallCard from '../components/ToolCallCard';

export default function ChatScreen() {
  const {
    messages, streamingContent, streamingReasoning,
    sendMessage, cancelAgent, pendingApproval, respondApproval,
    desktopOnline, activeSessionId, status, isAgentRunning,
  } = useConnectionStore();
  const s = useTranslation();
  const [input, setInput] = React.useState('');
  const listRef = React.useRef<FlatList>(null);

  React.useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, streamingContent, streamingReasoning]);

  function handleSend() {
    const text = input.trim();
    if (!text || !activeSessionId) return;
    setInput('');
    sendMessage(text);
  }

  if (status !== 'connected' && status !== 'reconnecting') {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{s.notConnected}</Text>
      </View>
    );
  }

  if (!activeSessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>{s.selectSession}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Status bar */}
      <View style={[styles.statusBar, desktopOnline ? styles.statusOn : styles.statusOff]}>
        <View style={[styles.dot, desktopOnline ? styles.dotOn : styles.dotOff]} />
        <Text style={styles.statusText}>
          {desktopOnline ? s.desktopConnected : s.desktopOffline}
        </Text>
        {status === 'reconnecting' && (
          <ActivityIndicator size="small" color="#f59e0b" style={{ marginLeft: 8 }} />
        )}
      </View>

      {/* Approval card */}
      {pendingApproval && (
        <View style={styles.approvalCard}>
          <Text style={styles.approvalTitle}>{s.approvalRequired}</Text>
          <Text style={styles.approvalTool}>{pendingApproval.toolName}</Text>
          <Text style={styles.approvalDesc}>{pendingApproval.description}</Text>
          {pendingApproval.command && (
            <Text style={styles.approvalCmd}>{pendingApproval.command}</Text>
          )}
          {pendingApproval.filePath && (
            <Text style={styles.approvalFile}>{pendingApproval.filePath}</Text>
          )}
          <View style={styles.approvalBtns}>
            <TouchableOpacity
              style={[styles.approvalBtn, styles.denyBtn]}
              onPress={() => respondApproval(pendingApproval.id, false)}
            >
              <Text style={styles.approvalBtnText}>{s.deny}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.approvalBtn, styles.allowBtn]}
              onPress={() => respondApproval(pendingApproval.id, true)}
            >
              <Text style={styles.approvalBtnText}>{s.allow}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          if (item.role === 'reasoning') {
            return (
              <View style={styles.reasoningBlock}>
                <Text style={styles.reasoningLabel}>{s.reasoning}</Text>
                <Text style={styles.reasoningText}>{item.content}</Text>
              </View>
            );
          }
          if (item.role === 'tool' && item.toolCall) {
            return (
              <ToolCallCard
                tool={item.toolCall}
                isRunning={item.toolCall.output === undefined && isAgentRunning}
              />
            );
          }
          return (
            <View style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
              item.isError && styles.bubbleError,
            ]}>
              <Text style={[
                styles.bubbleText,
                item.role === 'user' && styles.bubbleTextUser,
                item.isError && styles.bubbleTextError,
              ]}>
                {item.content}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <>
            {streamingReasoning ? (
              <View style={styles.reasoningBlock}>
                <Text style={styles.reasoningLabel}>{s.reasoning}</Text>
                <Text style={styles.reasoningText}>{streamingReasoning}</Text>
                <ActivityIndicator size="small" color="#6366f1" style={{ marginTop: 4 }} />
              </View>
            ) : null}
            {streamingContent ? (
              <View style={[styles.bubble, styles.bubbleAssistant]}>
                <Text style={styles.bubbleText}>{streamingContent}</Text>
                <ActivityIndicator size="small" color="#888" style={{ marginTop: 4 }} />
              </View>
            ) : null}
            {isAgentRunning && !streamingContent && !streamingReasoning ? (
              <View style={styles.thinkingRow}>
                <ActivityIndicator size="small" color="#6366f1" />
                <Text style={styles.thinkingText}>{s.thinking}</Text>
              </View>
            ) : null}
          </>
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={s.messagePlaceholder}
          placeholderTextColor="#555"
          multiline
          maxLength={4000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={Platform.OS !== 'ios' ? handleSend : undefined}
        />
        {isAgentRunning ? (
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
  container: { flex: 1, backgroundColor: '#0f0f13' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f0f13' },
  hint: { color: '#555', fontSize: 15 },
  statusBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 5, gap: 6 },
  statusOn: { backgroundColor: '#0d1a0d' },
  statusOff: { backgroundColor: '#1a0d0d' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOn: { backgroundColor: '#4ade80' },
  dotOff: { backgroundColor: '#f87171' },
  statusText: { color: '#666', fontSize: 12 },
  approvalCard: {
    margin: 10, padding: 14, backgroundColor: '#1a1a0a',
    borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b',
  },
  approvalTitle: { color: '#f59e0b', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  approvalTool: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  approvalDesc: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  approvalCmd: {
    color: '#d4d4d4', fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#111', padding: 8, borderRadius: 6, marginBottom: 4,
  },
  approvalFile: { color: '#6366f1', fontSize: 12, marginBottom: 10 },
  approvalBtns: { flexDirection: 'row', gap: 10 },
  approvalBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  denyBtn: { backgroundColor: '#2a1010' },
  allowBtn: { backgroundColor: '#0d2a0d' },
  approvalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { flex: 1 },
  listContent: { padding: 10, gap: 6 },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 16, marginBottom: 2 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleAssistant: { alignSelf: 'flex-start', backgroundColor: '#1e1e2e', borderBottomLeftRadius: 4 },
  bubbleError: { backgroundColor: '#2a1010', borderWidth: 1, borderColor: '#f87171' },
  bubbleText: { color: '#e0e0e0', fontSize: 15, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextError: { color: '#f87171' },
  reasoningBlock: {
    backgroundColor: '#0d0d1a', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#2a2a4a', marginBottom: 4,
  },
  reasoningLabel: { color: '#6366f1', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  reasoningText: { color: '#888', fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  thinkingText: { color: '#555', fontSize: 13 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8,
    borderTopWidth: 1, borderTopColor: '#1e1e2e', backgroundColor: '#0f0f13',
  },
  input: {
    flex: 1, backgroundColor: '#1e1e2e', color: '#e0e0e0', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    maxHeight: 120, borderWidth: 1, borderColor: '#2a2a3a',
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#dc2626' },
  sendBtnDisabled: { backgroundColor: '#1e1e2e' },
  sendBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
