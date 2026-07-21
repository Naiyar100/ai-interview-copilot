import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";
import useSpeechSynthesis from "../../hooks/useSpeechSynthesis";
import {
  completeInterview,
  getInterview,
  updateInterview,
} from "../../services/api";
import "./InterviewSession.css";

const defaultVoiceMetadata = {
  mode: "text",
  language: "en-US",
  speakingRate: 1,
  muted: false,
  autoPlayQuestions: true,
  recordingAttempts: 0,
  lastRecordedAt: null,
};

function InterviewSession() {
  const navigate = useNavigate();
  const { id } = useParams();
  const autosaveTimerRef = useRef(null);
  const autosaveReadyRef = useRef(false);
  const autoPlayedQuestionRef = useRef("");
  const [interview, setInterview] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [voiceMetadata, setVoiceMetadata] = useState(defaultVoiceMetadata);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const [interviewPaused, setInterviewPaused] = useState(false);
  const [error, setError] = useState("");

  const updateCurrentEntry = useCallback((setter, value) => {
    setter((entries) => entries.map((entry, index) =>
      index === currentQuestion ? value : entry,
    ));
  }, [currentQuestion]);

  const handleSpeechTranscript = useCallback((committed, interim) => {
    const liveAnswer = [committed, interim].filter(Boolean).join(" ").trim();
    updateCurrentEntry(setAnswers, liveAnswer);
    updateCurrentEntry(setTranscripts, committed);
    setAutosaveStatus("Unsaved changes");
    if (committed) {
      setVoiceMetadata((metadata) => ({
        ...metadata,
        lastRecordedAt: new Date().toISOString(),
      }));
    }
  }, [updateCurrentEntry]);

  const handleVoiceUnavailable = useCallback((reason) => {
    setVoiceMetadata((metadata) => ({ ...metadata, mode: "text" }));
    if (reason === "network") {
      setError(
        "This browser could not connect to its speech recognition service. Text mode is active; use Chrome or Microsoft Edge to try voice mode.",
      );
    } else if (["not-allowed", "service-not-allowed"].includes(reason)) {
      setError("Microphone access is unavailable. Text mode is active until permission is enabled.");
    } else {
      setError("No working microphone was detected. Text mode remains available.");
    }
  }, []);

  const {
    isSupported: recognitionSupported,
    isListening,
    interimTranscript,
    microphoneStatus,
    error: recognitionError,
    start: startRecognition,
    stop: stopRecognition,
    abort: abortRecognition,
    clearError: clearRecognitionError,
  } = useSpeechRecognition({
    language: voiceMetadata.language,
    onTranscript: handleSpeechTranscript,
    onUnavailable: handleVoiceUnavailable,
  });

  const {
    isSupported: synthesisSupported,
    isSpeaking,
    isPaused: speechPaused,
    speak,
    pause: pauseSpeech,
    resume: resumeSpeech,
    stop: stopSpeech,
    replay: replaySpeech,
  } = useSpeechSynthesis({
    isMuted: voiceMetadata.muted,
    speakingRate: voiceMetadata.speakingRate,
  });

  const voiceAvailable = recognitionSupported && synthesisSupported;
  const voiceMode = voiceMetadata.mode === "voice" && voiceAvailable;
  const hasInterview = Boolean(interview);

  useEffect(() => {
    let active = true;
    getInterview(id)
      .then((response) => {
        if (!active) return;
        const loadedInterview = response.data.interview;
        if (loadedInterview.status === "completed") {
          navigate(`/interview/results/${id}`, { replace: true });
          return;
        }
        const loadedAnswers = loadedInterview.questions.map(
          (_, index) => loadedInterview.answers[index] || "",
        );
        setInterview(loadedInterview);
        setAnswers(loadedAnswers);
        setTranscripts(loadedInterview.questions.map(
          (_, index) => loadedInterview.transcripts?.[index] || "",
        ));
        setVoiceMetadata({
          ...defaultVoiceMetadata,
          ...loadedInterview.voiceMetadata,
          mode: voiceAvailable ? loadedInterview.voiceMetadata?.mode || "text" : "text",
        });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load interview");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, navigate, voiceAvailable]);

  useEffect(() => {
    if (!hasInterview) return undefined;
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return undefined;
    }
    if (isListening || saving) return undefined;
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      setAutosaveStatus("Saving...");
      try {
        const response = await updateInterview(id, {
          answers,
          transcripts,
          voiceMetadata,
        });
        setInterview(response.data.interview);
        setAutosaveStatus("Saved");
      } catch (requestError) {
        setAutosaveStatus("Save failed");
        setError(requestError.message || "Unable to autosave your transcript");
      }
    }, 1200);
    return () => window.clearTimeout(autosaveTimerRef.current);
  }, [answers, hasInterview, id, isListening, saving, transcripts, voiceMetadata]);

  const updateAnswer = (value) => {
    if (isListening) stopRecognition();
    updateCurrentEntry(setAnswers, value);
    if (voiceMode) updateCurrentEntry(setTranscripts, value);
    setAutosaveStatus("Unsaved changes");
  };

  const saveAnswers = async () => {
    if (!interview || saving) return false;
    window.clearTimeout(autosaveTimerRef.current);
    setSaving(true);
    setError("");
    try {
      const response = await updateInterview(id, {
        answers,
        transcripts,
        voiceMetadata,
      });
      setInterview(response.data.interview);
      setAutosaveStatus("Saved");
      return true;
    } catch (requestError) {
      setError(requestError.message || "Unable to save your answers");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const changeQuestion = async (nextQuestion) => {
    stopSpeech();
    const saved = await saveAnswers();
    if (saved) {
      setCurrentQuestion(nextQuestion);
      autoPlayedQuestionRef.current = "";
    }
  };

  const handleSubmit = async () => {
    if (saving || isListening) return;
    stopSpeech();
    window.clearTimeout(autosaveTimerRef.current);
    setSaving(true);
    setError("");
    try {
      await completeInterview(id, { answers, transcripts, voiceMetadata });
      navigate(`/interview/results/${id}`);
    } catch (requestError) {
      setError(requestError.message || "Unable to complete interview");
      setSaving(false);
    }
  };

  const setMode = (mode) => {
    abortRecognition();
    stopSpeech();
    setInterviewPaused(false);
    autoPlayedQuestionRef.current = "";
    setVoiceMetadata((metadata) => ({ ...metadata, mode }));
  };

  const startRecording = useCallback((replaceTranscript = false) => {
    if (!voiceMode || interviewPaused) return;
    stopSpeech();
    clearRecognitionError();
    if (replaceTranscript) {
      updateCurrentEntry(setAnswers, "");
      updateCurrentEntry(setTranscripts, "");
    }
    const baseTranscript = replaceTranscript ? "" : answers[currentQuestion] || "";
    if (startRecognition(baseTranscript)) {
      setAutosaveStatus("Unsaved changes");
      setVoiceMetadata((metadata) => ({
        ...metadata,
        mode: "voice",
        recordingAttempts: metadata.recordingAttempts + 1,
      }));
    }
  }, [answers, clearRecognitionError, currentQuestion, interviewPaused, startRecognition, stopSpeech, updateCurrentEntry, voiceMode]);

  const toggleInterviewPause = () => {
    if (interviewPaused) {
      setInterviewPaused(false);
      if (speechPaused) resumeSpeech();
      return;
    }
    if (isListening) stopRecognition();
    if (isSpeaking) pauseSpeech();
    setInterviewPaused(true);
  };

  const updateVoiceSetting = (field, value) => {
    if (field === "muted" && value) stopSpeech();
    setAutosaveStatus("Unsaved changes");
    setVoiceMetadata((metadata) => ({ ...metadata, [field]: value }));
  };

  useEffect(() => {
    if (!voiceMode || !interview || interviewPaused || !voiceMetadata.autoPlayQuestions) {
      return;
    }
    const key = `${interview.id}-${currentQuestion}`;
    if (autoPlayedQuestionRef.current === key) return;
    autoPlayedQuestionRef.current = key;
    speak(interview.questions[currentQuestion]);
  }, [currentQuestion, interview, interviewPaused, speak, voiceMetadata.autoPlayQuestions, voiceMode]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!voiceMode) return;
      if (event.altKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (isListening) stopRecognition();
        else startRecording(false);
      } else if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (speechPaused) resumeSpeech();
        else if (isSpeaking) pauseSpeech();
        else speak(interview?.questions[currentQuestion]);
      } else if (event.key === "Escape") {
        abortRecognition();
        stopSpeech();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [abortRecognition, currentQuestion, interview, isListening, isSpeaking, pauseSpeech, resumeSpeech, speak, speechPaused, startRecording, stopRecognition, stopSpeech, voiceMode]);

  if (loading || !interview || interview.questions.length === 0) {
    return (
      <main className="session-page">
        <div className="session-container">
          <section className="session-content">
            <p>{error || (interview ? "Questions have not been generated for this interview yet." : "Loading interview...")}</p>
            {(error || interview) && <Link to={`/interview/results/${id}`}>Open interview details</Link>}
          </section>
        </div>
      </main>
    );
  }

  const questions = interview.questions;
  const isFirstQuestion = currentQuestion === 0;
  const isLastQuestion = currentQuestion === questions.length - 1;
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const activityStatus = interviewPaused
    ? "Interview paused"
    : isListening
      ? "Microphone listening"
      : isSpeaking
        ? "Question speaking"
        : saving || autosaveStatus === "Saving..."
          ? "Saving..."
          : "Interview in progress";

  return (
    <main className="session-page">
      <div className="session-glow session-glow-one" />
      <div className="session-glow session-glow-two" />
      <div className="session-container">
        <header className="session-header">
          <Link className="session-brand" to="/dashboard"><span className="session-logo" aria-hidden="true">AI</span>AI Interview Copilot</Link>
          <span className={`session-status ${isListening ? "recording" : ""}`}><span aria-hidden="true" /> {activityStatus}</span>
        </header>

        <section className="session-content">
          <div className="session-overview">
            <div><span className="session-eyebrow">{interview.interviewType} interview</span><h1>{interview.role}</h1></div>
            <dl className="session-config">
              <div><dt>Level</dt><dd>{interview.experienceLevel}</dd></div>
              <div><dt>Questions</dt><dd>{questions.length}</dd></div>
              <div><dt>Difficulty</dt><dd>{interview.difficulty}</dd></div>
            </dl>
          </div>

          <div className="session-mode-bar" aria-label="Interview mode">
            <div className="session-mode-toggle">
              <button type="button" className={!voiceMode ? "active" : ""} onClick={() => setMode("text")}>Text Mode</button>
              <button type="button" className={voiceMode ? "active" : ""} disabled={!voiceAvailable} onClick={() => setMode("voice")}>Voice Mode</button>
            </div>
            {voiceMode && <button className="session-pause-button" type="button" onClick={toggleInterviewPause}>{interviewPaused ? "Resume Interview" : "Pause Interview"}</button>}
          </div>

          {!voiceAvailable && (
            <p className="voice-fallback" role="status">Voice recognition is unavailable in this browser. Text mode remains fully available.</p>
          )}
          {(error || recognitionError) && <p className="session-error" role="alert">{error || recognitionError}</p>}

          <div className="session-progress-info"><span>Question {currentQuestion + 1} of {questions.length}</span><span>{Math.round(progress)}% complete</span></div>
          <div className="session-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

          <article className="question-card">
            <div className="question-number" aria-hidden="true">{String(currentQuestion + 1).padStart(2, "0")}</div>
            <div className="question-content">
              <span>Interview question</span>
              <h2>{questions[currentQuestion]}</h2>

              {voiceMode && (
                <section className={`voice-panel ${isListening ? "is-recording" : ""}`} aria-label="Voice interview controls">
                  <div className="voice-status-row" aria-live="polite">
                    <span className={`voice-indicator ${isListening ? "active" : ""}`} aria-hidden="true" />
                    <strong>{isListening ? "Recording your answer" : isSpeaking ? "Speaking question" : interviewPaused ? "Paused" : "Microphone ready"}</strong>
                    <small>Microphone: {microphoneStatus}</small>
                  </div>
                  <div className="voice-controls">
                    <button type="button" disabled={interviewPaused} onClick={() => isSpeaking ? pauseSpeech() : speechPaused ? resumeSpeech() : speak(questions[currentQuestion])}>{isSpeaking ? "Pause Voice" : speechPaused ? "Resume Voice" : "Play Question"}</button>
                    <button type="button" disabled={interviewPaused} onClick={() => { replaySpeech() || speak(questions[currentQuestion]); }}>Replay</button>
                    <button type="button" onClick={() => updateVoiceSetting("muted", !voiceMetadata.muted)}>{voiceMetadata.muted ? "Unmute" : "Mute"}</button>
                    <label>Rate
                      <select value={voiceMetadata.speakingRate} onChange={(event) => updateVoiceSetting("speakingRate", Number(event.target.value))}>
                        <option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option>
                      </select>
                    </label>
                  </div>
                  <div className="recording-controls">
                    <button className="microphone-button" type="button" disabled={interviewPaused} onClick={() => isListening ? stopRecognition() : startRecording(false)}><span aria-hidden="true">{isListening ? "■" : "●"}</span>{isListening ? "Stop Recording" : "Start Recording"}</button>
                    <button type="button" disabled={isListening || interviewPaused} onClick={() => startRecording(true)}>Retry Recording</button>
                    <label className="autoplay-option"><input type="checkbox" checked={voiceMetadata.autoPlayQuestions} onChange={(event) => updateVoiceSetting("autoPlayQuestions", event.target.checked)} />Auto-play questions</label>
                  </div>
                  <div className="live-caption" aria-live="polite"><span>Live caption</span><p>{interimTranscript || transcripts[currentQuestion] || "Your speech will appear here as you answer."}</p></div>
                </section>
              )}

              <label htmlFor="interview-answer">{voiceMode ? "Transcript and answer" : "Your answer"}</label>
              <textarea id="interview-answer" value={answers[currentQuestion]} onChange={(event) => updateAnswer(event.target.value)} placeholder={voiceMode ? "Your voice transcript appears here, and you can edit it manually..." : "Type your answer here..."} rows="8" />
              <small>{autosaveStatus}. {voiceMode ? "You can always edit the transcript or switch to typing." : "Answers autosave after you stop typing."}</small>
              {voiceMode && <p className="keyboard-help">Shortcuts: Alt+R record/stop · Alt+P play/pause · Escape stop voice</p>}
            </div>
          </article>

          <div className="session-actions">
            <button className="session-button secondary" type="button" disabled={isFirstQuestion || saving || isListening || interviewPaused} onClick={() => changeQuestion(currentQuestion - 1)}>Previous</button>
            {isLastQuestion ? (
              <button className="session-button primary" type="button" disabled={saving || isListening || interviewPaused} onClick={handleSubmit}>{saving ? "Completing..." : "Submit Interview"}</button>
            ) : (
              <button className="session-button primary" type="button" disabled={saving || isListening || interviewPaused} onClick={() => changeQuestion(currentQuestion + 1)}>Next</button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default InterviewSession;
