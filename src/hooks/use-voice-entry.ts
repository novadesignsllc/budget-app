import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

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

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    transcript.current = text;
    onPartial(text);
    if (e.isFinal && !delivered.current) {
      delivered.current = true;
      onFinal(text);
    }
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    if (!delivered.current && transcript.current) {
      delivered.current = true;
      onFinal(transcript.current);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error === 'aborted' || e.error === 'no-speech') return;
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
    delivered.current = false;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('Voice isn’t available on this device. Type it instead.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone or speech access is off. Turn it on in Settings, or type instead.');
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: false,
      contextualStrings: hints.slice(0, 100),
      volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
    });
  }, [hints]);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);
  const abort = useCallback(() => {
    delivered.current = true;
    ExpoSpeechRecognitionModule.abort();
  }, []);

  return { listening, error, volume, start, stop, abort };
}
