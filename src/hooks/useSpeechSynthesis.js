import { useCallback, useEffect, useRef, useState } from "react";

export default function useSpeechSynthesis({
  isMuted = false,
  speakingRate = 1,
} = {}) {
  const lastTextRef = useRef("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const isSupported = typeof window !== "undefined" &&
    "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  const stop = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const speak = useCallback((text) => {
    if (!isSupported || isMuted || !text?.trim()) return false;
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speakingRate;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    lastTextRef.current = text;
    window.speechSynthesis.speak(utterance);
    return true;
  }, [isMuted, isSupported, speakingRate]);

  const pause = useCallback(() => {
    if (!isSupported || !window.speechSynthesis.speaking) return;
    window.speechSynthesis.pause();
    setIsSpeaking(false);
    setIsPaused(true);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported || !window.speechSynthesis.paused) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
    setIsSpeaking(true);
  }, [isSupported]);

  const replay = useCallback(() => speak(lastTextRef.current), [speak]);

  useEffect(() => () => {
    if (isSupported) window.speechSynthesis.cancel();
  }, [isSupported]);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    speak,
    pause,
    resume,
    stop,
    replay,
  };
}
