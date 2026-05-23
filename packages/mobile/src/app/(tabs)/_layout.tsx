import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n';

export default function TabLayout() {
  const s = useTranslation();
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#0f0f13', borderTopColor: '#1e1e2e' },
        tabBarActiveTintColor: '#a5b4fc',
        tabBarInactiveTintColor: '#444',
        headerStyle: { backgroundColor: '#0f0f13' },
        headerTintColor: '#e0e0e0',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: s.chat,
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: s.sessions,
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="files"
        options={{
          title: s.files,
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="git"
        options={{
          title: s.git,
          tabBarIcon: ({ color, size }) => <Ionicons name="git-branch-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: s.connect,
          tabBarIcon: ({ color, size }) => <Ionicons name="wifi-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
