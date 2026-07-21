import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { apiRequest } from "../services/api";

describe("API error handling", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });

  test("centralizes authorization headers and expired-token events", async () => {
    localStorage.setItem("authToken", "secret-token");
    const unauthorized = vi.fn();
    window.addEventListener("auth:unauthorized", unauthorized);
    globalThis.fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Expired token" }) });
    await expect(apiRequest("/users/me", { requiresAuth: true })).rejects.toThrow("Expired token");
    expect(globalThis.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer secret-token");
    expect(unauthorized).toHaveBeenCalledOnce();
  });
});

describe("voice interview fallback", () => {
  test("reports unsupported browsers while preserving text fallback", () => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    const { result } = renderHook(() => useSpeechRecognition({ onTranscript: vi.fn() }));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.start()).toBe(false);
  });

  test("publishes live transcription and microphone state", () => {
    let recognition;
    class RecognitionMock {
      start() { recognition = this; this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() {}
    }
    window.SpeechRecognition = RecognitionMock;
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));
    act(() => result.current.start("Existing"));
    expect(result.current.isListening).toBe(true);
    act(() => recognition.onresult({ results: [{ 0: { transcript: "new answer" }, isFinal: true }] }));
    expect(onTranscript).toHaveBeenCalledWith("Existing new answer", "");
  });
});
