import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useConnectionStore } from '../store/connection';
import { useTranslation, setLocale, getLocale, type Locale } from '../i18n';

const RELAY_URL_KEY = 'aide_relay_url';
const TOKEN_KEY = 'aide_token';
const NTFY_TOPIC_KEY = 'aide_ntfy_topic';
const LOCALE_KEY = 'aide_locale';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<void> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('aide', {
      name: 'AiDE Notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

const LOCALES: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
];

export default function ConnectScreen() {
  const { status, connect, disconnect } = useConnectionStore();
  const s = useTranslation();
  const [relayUrl, setRelayUrl] = React.useState('');
  const [token, setToken] = React.useState('');
  const [ntfyTopic, setNtfyTopic] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [locale, setLocaleState] = React.useState<Locale>(getLocale());
  const [permission, requestPermission] = useCameraPermissions();

  React.useEffect(() => {
    (async () => {
      const savedUrl = await SecureStore.getItemAsync(RELAY_URL_KEY);
      const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const savedNtfy = await SecureStore.getItemAsync(NTFY_TOPIC_KEY);
      const savedLocale = await SecureStore.getItemAsync(LOCALE_KEY) as Locale | null;
      if (savedUrl) setRelayUrl(savedUrl);
      if (savedToken) setToken(savedToken);
      if (savedNtfy) setNtfyTopic(savedNtfy);
      if (savedLocale) { setLocale(savedLocale); setLocaleState(savedLocale); }
      await registerForPushNotifications();
      if (savedUrl && savedToken) connect(savedUrl, savedToken);
    })();
  }, []);

  async function handleConnect() {
    if (!relayUrl || !token) {
      Alert.alert('', s.missingFields);
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
      } else {
        Alert.alert('', s.invalidQr);
      }
    } catch {
      Alert.alert('', s.invalidQr);
    }
  }

  async function handleLocaleChange(code: Locale) {
    setLocale(code);
    setLocaleState(code);
    await SecureStore.setItemAsync(LOCALE_KEY, code);
  }

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || status === 'reconnecting';

  if (scanning) {
    return (
      <View style={styles.scanContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={(r) => handleQrScan(r.data)}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <TouchableOpacity style={styles.cancelScan} onPress={() => setScanning(false)}>
          <Text style={styles.cancelScanText}>{s.cancel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{s.connectToDesktop}</Text>

      {/* QR scan */}
      <TouchableOpacity
        style={styles.qrBtn}
        onPress={async () => {
          if (!permission?.granted) await requestPermission();
          setScanning(true);
        }}
      >
        <Text style={styles.qrBtnText}>📷  {s.scanQrCode}</Text>
      </TouchableOpacity>

      {/* Relay URL */}
      <Text style={styles.label}>{s.relayUrl}</Text>
      <TextInput
        style={styles.input}
        value={relayUrl}
        onChangeText={setRelayUrl}
        placeholder="ws://192.168.1.x:7433"
        placeholderTextColor="#444"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      {/* Token */}
      <Text style={styles.label}>{s.authToken}</Text>
      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="••••••••"
        placeholderTextColor="#444"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      {/* ntfy */}
      <Text style={styles.label}>{s.ntfyTopic}</Text>
      <TextInput
        style={styles.input}
        value={ntfyTopic}
        onChangeText={setNtfyTopic}
        placeholder="my-aide-topic"
        placeholderTextColor="#444"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.hint}>{s.ntfyHint}</Text>

      {/* Language */}
      <Text style={styles.label}>Language / 语言 / 言語 / 언어</Text>
      <View style={styles.localeRow}>
        {LOCALES.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[styles.localeBtn, locale === l.code && styles.localeBtnActive]}
            onPress={() => handleLocaleChange(l.code)}
          >
            <Text style={[styles.localeBtnText, locale === l.code && styles.localeBtnTextActive]}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status */}
      <View style={styles.statusRow}>
        <View style={[styles.dot,
          isConnected ? styles.dotOn : isConnecting ? styles.dotWarn : styles.dotOff,
        ]} />
        <Text style={styles.statusText}>
          {isConnecting ? s.connecting : isConnected ? s.connected : status === 'error' ? s.connectionFailed : s.disconnected}
        </Text>
      </View>

      {/* Connect / Disconnect */}
      {isConnected ? (
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={disconnect}>
          <Text style={styles.btnText}>{s.disconnectBtn}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.btn, isConnecting && styles.btnDisabled]} onPress={handleConnect} disabled={isConnecting}>
          <Text style={styles.btnText}>{isConnecting ? s.connecting : s.connectBtn}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  content: { padding: 20, gap: 10 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  qrBtn: {
    backgroundColor: '#1e1e2e', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#2a2a4a',
  },
  qrBtnText: { color: '#a5b4fc', fontSize: 15, fontWeight: '600' },
  label: { color: '#666', fontSize: 12, fontWeight: '600', marginTop: 6 },
  input: {
    backgroundColor: '#1e1e2e', color: '#e0e0e0', borderRadius: 10,
    padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#2a2a3a',
  },
  hint: { color: '#444', fontSize: 12, lineHeight: 17 },
  localeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  localeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#1e1e2e', borderWidth: 1, borderColor: '#2a2a3a',
  },
  localeBtnActive: { backgroundColor: '#2a2a4a', borderColor: '#6366f1' },
  localeBtnText: { color: '#666', fontSize: 13 },
  localeBtnTextActive: { color: '#a5b4fc', fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOn: { backgroundColor: '#4ade80' },
  dotWarn: { backgroundColor: '#f59e0b' },
  dotOff: { backgroundColor: '#444' },
  statusText: { color: '#666', fontSize: 13 },
  btn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDanger: { backgroundColor: '#7f1d1d' },
  btnDisabled: { backgroundColor: '#1e1e2e' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scanContainer: { flex: 1, backgroundColor: '#000' },
  cancelScan: {
    position: 'absolute', bottom: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30,
  },
  cancelScanText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
