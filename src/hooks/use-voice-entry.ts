import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

/** How long a pause ends dictation. Long enough to think of the next part mid-sentence. */
const PAUSE_MS = 2200;
/** How long to wait for the first word before giving up. */
const FIRST_WORD_MS = 8000;

/**
 * Speech to text for quick-add. Starts listening on `start()`, streams partial text
 * through `onPartial`, and calls `onFinal` once when the person stops talking.
 */
export function useVoiceEntry({
  onPartial,
  onFinal,
  hints,
}: {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  /** Names worth recognizing: accounts, envelopes, merchants you've used. */
  hints: string[];
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const volume = useSharedValue(0);
  const transcript = useRef('');
  const delivered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Finished pieces so far. With continuous listening each pause can start a new piece. */
  const finals = useRef('');
  /** Set when the sheet closes, so a start still waiting on permission never turns the mic on. */
  const cancelled = useRef(false);

  // Listening runs until a pause, not until the first breath.
  const stopAfter = useCallback((ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), ms);
  }, []);
  useEffect(
    () => () => {
      cancelled.current = true;
      clearTimeout(timer.current);
    },
    [],
  );

  useSpeechRecognitionEvent('start', () => {
    setListening(true);
    stopAfter(FIRST_WORD_MS);
  });
  useSpeechRecognitionEvent('result', (e) => {
    const piece = e.results[0]?.transcript ?? '';
    // Some results repeat everything so far, others only the newest piece: join only the latter.
    const done = finals.current;
    const text = done && !piece.toLowerCase().startsWith(done.toLowerCase()) ? `${done} ${piece}` : piece;
    transcript.current = text;
    onPartial(text);
    if (e.isFinal) finals.current = text;
    // The whole sentence is delivered when listening ends, after a pause.
    stopAfter(PAUSE_MS);
  });
  useSpeechRecognitionEvent('end', () => {
    clearTimeout(timer.current);
    setListening(false);
    if (!delivered.current && transcript.current) {
      delivered.current = true;
      onFinal(transcript.current);
    } else if (!delivered.current) {
      setError('Didn’t catch anything.');
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    clearTimeout(timer.current);
    setListening(false);
    if (e.error === 'aborted') return;
    if (e.error === 'no-speech') {
      if (!delivered.current) setError('Didn’t catch anything.');
      return;
    }
    setError(
      e.error === 'not-allowed'
        ? 'Microphone or speech access is off. Turn it on in Settings, or type instead.'
        : e.error === 'network'
          ? 'Voice needs a connection right now. Type it instead.'
          : 'Couldn’t hear that. Try again or type it.',
    );
  });
  useSpeechRecognitionEvent('volumechange', (e) => {
    volume.value = Math.max(0, Math.min(1, (e.value + 2) / 12));
  });

  const start = useCallback(async () => {
    setError('');
    transcript.current = '';
    finals.current = '';
    delivered.current = false;
    cancelled.current = false;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('Voice isn’t available on this device. Type it instead.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (cancelled.current) return;
    if (!permission.granted) {
      setError('Microphone or speech access is off. Turn it on in Settings, or type instead.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      addsPunctuation: false,
      contextualStrings: hints.slice(0, 100),
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
  }, [hints]);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const abort = useCallback(() => {
    cancelled.current = true;
    clearTimeout(timer.current);
    delivered.current = true;
    ExpoSpeechRecognitionModule.abort();
  }, []);

  return { listening, error, volume, start, stop, abort };
}
