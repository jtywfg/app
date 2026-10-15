import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StudioProvider } from '../store/StudioContext';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <StudioProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </StudioProvider>
  );
}
