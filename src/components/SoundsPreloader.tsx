'use client';
import { useEffect } from 'react';
import { preloadSounds } from '@/client/sounds';

export function SoundsPreloader() {
  useEffect(() => {
    preloadSounds();
  }, []);
  return null;
}
