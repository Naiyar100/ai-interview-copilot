import { useCallback, useEffect, useRef, useState } from "react";

const getRecognitionConstructor = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition;

const getRecognitionError = (code) => {
  if (["not-allowed", "service-not-allowed"].includes(code)) {
    return "Microphone permission was denied. You can continue by typing.";
  }
  if (code === "audio-capture") {
    return "No microphone was detected. Check your device or continue by typing.";
  }
  if (code === "no-speech") {
    return "No speech was detected. Try recording again or type your answer.";
  }
  if (code === "network") {
    return "Speech recognition could not reach the browser service.";
  }
  if (code === "aborted") return "";
  return "Speech recognition was interrupted. Please try again.";
};

export default function useSpeechRecognition({
  language = "en-US",
  onTranscript,
  onEnd,
  onUnavailable,
}) {
  const recognitionRef = useRef(null);
  const baseTranscriptRef = useRef("");
  const committedTranscriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const onEndRef = useRef(onEnd);
  const onUnavailableRef = useRef(onUnavailable);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const [microphoneStatus, setMicrophoneStatus] = useState("idle");
  const isSupported = typeof window !== "undefined" && Boolean(getRecognitionConstructor());

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onEndRef.current = onEnd;
    onUnavailableRef.current = onUnavailable;
  }, [onEnd, onTranscript, onUnavailable]);

  const abort = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
    setMicrophoneStatus("idle");
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setMicrophoneStatus("processing");
  }, []);

  const start = useCallback((baseTranscript = "") => {
    if (!isSupported || isListening) return false;
    const Recognition = getRecognitionConstructor();
    const recognition = new Recognition();
    baseTranscriptRef.current = baseTranscript.trim();
    committedTranscriptRef.current = baseTranscript.trim();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError("");
      setIsListening(true);
      setMicrophoneStatus("listening");
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";
        if (event.results[index].isFinal) finalText += `${transcript} `;
        else interimText += `${transcript} `;
      }
      const committed = [baseTranscriptRef.current, finalText.trim()]
        .filter(Boolean)
        .join(" ");
      committedTranscriptRef.current = committed;
      setInterimTranscript(interimText.trim());
      onTranscriptRef.current?.(committed, interimText.trim());
    };
    recognition.onspeechend = () => recognition.stop();
    recognition.onerror = (event) => {
      const message = getRecognitionError(event.error);
      if (message) setError(message);
      setMicrophoneStatus(event.error === "not-allowed" ? "denied" : "idle");
      if (["network", "not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        onUnavailableRef.current?.(event.error);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript("");
      setMicrophoneStatus("idle");
      onTranscriptRef.current?.(committedTranscriptRef.current, "");
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      recognitionRef.current = null;
      setError("The microphone could not start. Please try again or type your answer.");
      return false;
    }
  }, [isListening, isSupported, language]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return {
    isSupported,
    isListening,
    interimTranscript,
    microphoneStatus,
    error,
    start,
    stop,
    abort,
    clearError: () => setError(""),
  };
}
