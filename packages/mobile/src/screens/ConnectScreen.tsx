import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Switch,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useConnectionStore } from '../store/connection';

const RELAY_URL_KEY = 'aide_relay_url';
const TOKEN_KEY = 'aide_token';
const NTFY_TOPIC_KEY = 'aide_ntfy_topic';

export default function ConnectScreen() {
  const { status, connect, disconnect } = useConnectionStore();
  const [relayUrl, setRelayUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [ntfyTopic, setNtfyTopic] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  React.useEffect(() => {
    (async () => {
      const savedUrl = await SecureStore.getItemAsync(RELAY_URL_KEY);
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const savedNtfy = await SecureStore.getItemAsync(NTFY_TOPIC_KEY);
      if (savedUrl) setRelayUrl(savedUrl);
      if (savedToken) setToken(savedToken);
      if (savedNtfy) setNtfyTopic(savedNtfy);
      if (savedUrl && savedToken) connect(savedUrl, savedToken);
    })();
  }, []);

  async function handleConnect() {
    if (!relayUrl || !token) {
      Alert.alert('Missing fields', 'Enter relay URL and token, or scan the QR code from your desktop.');
      return;
    }
    await SecureStore.setItemAsync(RELAY_URL_KEY, relayUrl);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (ntfyTopic) await SecureStore.setItemAsync(NTFY_TOPIC_KEY, ntfyTopic);
    connect(relayUrl, token);
  }

  function handleQrScan(data: string) {
    setScanning(false);
    try {
      const parsed = JSON.parse(data) as { relayUrl: string; token: string };
      if (parsed.relayUrl && parsed.token) {
        setRelayUrl(parsed.relayUrl);
        setToken(parsed.token);
      }
    } catch {
      Alert.alert('Invalid QR code', 'Could not parse AiDE connection info.');
    }
  }

  const isConnected = status === 'connected';

  if (scanning) {
    return (
      <View style={styles.scanContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={(result) => handleQrScan(result.data)}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <TouchableOpacity style={styles.cancelScan} onPress={() => setScanning(false)}>
          <Text style={styles.cancelScanText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Connect to Desktop</Text>
      <Text style={styles.sub}>
        Scan the QR code shown in AiDE desktop, or enter the relay URL and token manually.
      </Text>

      <TouchableOpacity
        style={styles.qrBtn}
        onPress={async () => {
          if (!permission?.granted) await requestPermission();
          setScanning(true);
        }}
      >
        <Text style={styles.qrBtnText}>📷  Scan QR Code</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Relay URL</Text>
      <TextInput
        style={styles.input}
        value={relayUrl}
        onChangeText={setRelayUrl}
        placeholder="wss://relay.example.com  or  ws://192.168.1.x:7433"
        placeholderTextColor="#555"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={styles.label}>Auth Token</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Paste token from AiDE desktop"
        placeholderTextColor="#555"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <Text style={styles.label}>Push Notifications (ntfy topic, optional)</Text>
      <TextInput
        style={styles.input}
        value={ntfyTopic}
        onChangeText={setNtfyTopic}
        placeholder="my-aide-topic-abc123"
        placeholderTextColor="#555"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>
        Install the ntfy app and subscribe to this topic to receive notifications when tasks complete.
      </Text>

      <View style={styles.statusRow}>
        <View style={[styles.dot, isConnected ? styles.dotOn : styles.dotOff]} />
        <Text style={styles.statusText}>
          {status === 'connecting' ? 'Connecting...' : isConnected ? 'Connected' : status === 'error' ? 'Connection failed' : 'Disconnected'}
        </Text>
      </View>

      {isConnected ? (
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={disconnect}>
          <Text style={styles.btnText}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.btn} onPress={handleConnect}>
          <Text style={styles.btnText}>Connect</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  content: { padding: 20, gap: 12 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  sub: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  qrBtn: {
    backgroundColor: '#2a2a3a', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#444',
  },
  qrBtnText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#2a2a2a', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 14, borderWidth: 1, borderColor: '#444',
  },
  hint: { color: '#555', fontSize: 12, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOn: { backgroundColor: '#4caf50' },
  dotOff: { backgroundColor: '#555' },
  statusText: { color: '#aaa', fontSize: 14 },
  btn: {
    backgroundColor: '#2563eb', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDanger: { backgroundColor: '#dc2626' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scanContainer: { flex: 1, backgroundColor: '#000' },
  cancelScan: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 30,
  },
  cancelScanText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
