"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";


type CopilotRole =
  | "user"
  | "assistant";


type AttentionLevel =
  | "normal"
  | "watch"
  | "urgent";


type CopilotApiResponse = {
  answer: string;
  attention_level: AttentionLevel;
  referenced_request_ids: string[];
  recommended_actions: string[];
  insufficient_context: boolean;
};


type CopilotHistoryMessage = {
  role: CopilotRole;
  content: string;
};


type CopilotAssistantResponse = {
  content: string;
  attentionLevel: AttentionLevel;
  referencedRequestIds: string[];
  recommendedActions: string[];
  insufficientContext: boolean;
};


type CopilotTurnStatus =
  | "loading"
  | "complete"
  | "error";


type CopilotTurn = {
  id: string;
  question: string;
  response: CopilotAssistantResponse | null;
  status: CopilotTurnStatus;
  error?: string;
};


const STARTER_QUESTIONS = [
  "What needs my attention right now?",
  "Which request is most urgent?",
  "What is overdue?",
  "Summarize active operations.",
];

const MAX_HISTORY_MESSAGES =
  8;

const MAX_VISIBLE_TURNS =
  6;


function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function isAttentionLevel(
  value: unknown,
): value is AttentionLevel {
  return (
    value === "normal" ||
    value === "watch" ||
    value === "urgent"
  );
}


function isCopilotApiResponse(
  value: unknown,
): value is CopilotApiResponse {
  return (
    isRecord(value) &&
    typeof value.answer === "string" &&
    isAttentionLevel(
      value.attention_level,
    ) &&
    Array.isArray(
      value.referenced_request_ids,
    ) &&
    value.referenced_request_ids.every(
      (requestId) =>
        typeof requestId === "string",
    ) &&
    Array.isArray(
      value.recommended_actions,
    ) &&
    value.recommended_actions.every(
      (action) =>
        typeof action === "string",
    ) &&
    typeof value.insufficient_context ===
      "boolean"
  );
}


function getResponseError(
  value: unknown,
  fallback: string,
) {
  if (
    isRecord(value) &&
    typeof value.error === "string" &&
    value.error.trim()
  ) {
    return value.error;
  }

  return fallback;
}


function getHistory(
  turns: CopilotTurn[],
) {
  return turns
    .filter(
      (
        turn,
      ): turn is CopilotTurn & {
        response: CopilotAssistantResponse;
      } =>
        turn.status === "complete" &&
        turn.response !== null,
    )
    .flatMap(
      (turn) => {
        const messages: CopilotHistoryMessage[] =
          [
            {
              role:
                "user",
              content:
                turn.question,
            },
          ];

                messages.push({
                  role:
                    "assistant",
                  content:
                    turn.response.content,
                });

        return messages;
      },
    )
    .slice(
      -MAX_HISTORY_MESSAGES,
    );
}


function createMessageId() {
  return crypto.randomUUID();
}


function formatAttentionLevel(
  attentionLevel: AttentionLevel,
) {
  const labels = {
    normal: "Normal",
    watch: "Watch",
    urgent: "Urgent",
  } as const;

  return labels[attentionLevel];
}


export default function OperationsCopilot() {
  const [
    isOpen,
    setIsOpen,
  ] = useState(false);

  const [
    input,
    setInput,
  ] = useState("");

  const [
    turns,
    setTurns,
  ] = useState<CopilotTurn[]>(
    [],
  );

  const [
    isSending,
    setIsSending,
  ] = useState(false);

  const isSendingRef =
    useRef(false);

  const threadEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const threadRef =
    useRef<HTMLDivElement | null>(
      null,
    );


  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen]);


  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let innerAnimationFrame:
      number | undefined;

    const animationFrame =
      window.requestAnimationFrame(
        () => {
          innerAnimationFrame =
            window.requestAnimationFrame(
              () => {
                threadEndRef.current?.scrollIntoView({
                  block:
                    "end",
                });

                if (threadRef.current) {
                  threadRef.current.scrollTop =
                    threadRef.current.scrollHeight;
                }
              },
            );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      if (
        innerAnimationFrame !== undefined
      ) {
        window.cancelAnimationFrame(
          innerAnimationFrame,
        );
      }
    };
  }, [
    isOpen,
    turns,
  ]);


  const trimmedInput =
    input.trim();

  const hasMessages =
    turns.length > 0;

  const latestAttention =
    useMemo(
      () =>
        [...turns]
          .reverse()
          .find(
            (turn) =>
              turn.status ===
                "complete" &&
              turn.response,
          )?.response
          ?.attentionLevel ??
        "normal",
      [turns],
    );


  async function submitQuestion(
    rawQuestion: string,
  ) {
    const question =
      rawQuestion.trim();

    if (
      isSendingRef.current ||
      question.length < 2
    ) {
      return;
    }

    isSendingRef.current =
      true;

    setInput("");

    const history =
      getHistory(
        turns,
      );

    const turnId =
      createMessageId();

    const turn: CopilotTurn =
      {
        id:
          turnId,
        question:
          question,
        response:
          null,
        status:
          "loading",
      };

    setTurns(
      (currentTurns) =>
        [
          ...currentTurns,
          turn,
        ].slice(
          -MAX_VISIBLE_TURNS,
        ),
    );

    setIsSending(true);

    try {
      const response =
        await fetch(
          "/api/ai/copilot",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                question,
                history,
              }),
          },
        );

      const result =
        (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(
          getResponseError(
            result,
            "ResolveOps Copilot is temporarily unavailable.",
          ),
        );
      }

      if (
        !isCopilotApiResponse(
          result,
        )
      ) {
        throw new Error(
          "ResolveOps Copilot returned an invalid response.",
        );
      }

      const assistantResponse: CopilotAssistantResponse =
        {
          content:
            result.answer,
          attentionLevel:
            result.attention_level,
          referencedRequestIds:
            result.referenced_request_ids,
          recommendedActions:
            result.recommended_actions,
          insufficientContext:
            result.insufficient_context,
        };

      setTurns(
        (currentTurns) =>
          currentTurns
            .map(
              (currentTurn) =>
                currentTurn.id ===
                turnId
                  ? {
                      ...currentTurn,
                      status:
                        "complete" as const,
                      response:
                        assistantResponse,
                      error:
                        undefined,
                    }
                : currentTurn,
            )
            .slice(
              -MAX_VISIBLE_TURNS,
            ),
      );
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "ResolveOps Copilot is temporarily unavailable.";

      setTurns(
        (currentTurns) =>
          currentTurns
            .map(
              (currentTurn) =>
                currentTurn.id ===
                turnId
                  ? {
                      ...currentTurn,
                      status:
                        "error" as const,
                      response:
                        null,
                      error:
                        message,
                    }
                  : currentTurn,
            )
            .slice(
              -MAX_VISIBLE_TURNS,
            ),
      );
    } finally {
      isSendingRef.current =
        false;
      setIsSending(false);
    }
  }


  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void submitQuestion(input);
  }


  function closeModal() {
    setIsOpen(false);
  }


  return (
    <>
      <article className="insight-card copilot-card">
        <div className="copilot-card-topline">
          <div className="copilot-mark">
            AI
          </div>

          <span
            className={`copilot-attention-pill ${latestAttention}`}
          >
            {formatAttentionLevel(
              latestAttention,
            )}
          </span>
        </div>

        <h3>
          AI Operations Copilot
        </h3>

        <p>
          Grounded in live operations data
        </p>

        <button
          type="button"
          className="primary-button copilot-open-button"
          onClick={() =>
            setIsOpen(true)
          }
        >
          Ask Copilot
        </button>
      </article>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={closeModal}
          >
            <section
              className="request-modal copilot-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="copilot-title"
              aria-describedby="copilot-subtitle"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="copilot-header">
                <div>
                  <p className="eyebrow">
                    AI Operations
                  </p>

                  <h2 id="copilot-title">
                    ResolveOps Copilot
                  </h2>

                  <p id="copilot-subtitle">
                    Grounded in live
                    operations data
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close-button"
                  aria-label="Close Copilot"
                  onClick={closeModal}
                >
                  X
                </button>
              </div>

              <div
                className="copilot-thread"
                role="log"
                aria-live="polite"
                ref={threadRef}
              >
                {!hasMessages && (
                  <div className="copilot-empty-state">
                    <strong>
                      Live operations are
                      ready.
                    </strong>

                    <p>
                      Ask for priorities,
                      overdue work, or
                      technician workload.
                    </p>
                  </div>
                )}

                {turns.map(
                  (turn) => (
                    <div
                      className="copilot-turn"
                      key={
                        turn.id
                      }
                    >
                      <article className="copilot-message copilot-user-message">
                        <p>
                          {
                            turn.question
                          }
                        </p>
                      </article>

                      {turn.status ===
                        "loading" && (
                        <div className="copilot-loading">
                          Analyzing live
                          operations...
                        </div>
                      )}

                      {turn.status ===
                        "error" && (
                        <article
                          className="copilot-message copilot-assistant-card copilot-turn-error"
                          role="alert"
                        >
                          <p>
                            {turn.error ??
                              "ResolveOps Copilot is temporarily unavailable."}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              void submitQuestion(
                                turn.question,
                              )
                            }
                            disabled={
                              isSending
                            }
                          >
                            Retry
                          </button>
                        </article>
                      )}

                      {turn.status ===
                        "complete" &&
                        turn.response && (
                        <article className="copilot-message copilot-assistant-card">
                          <p>
                            {
                              turn.response
                                .content
                            }
                          </p>

                          <div className="copilot-response-meta">
                            <span
                              className={`copilot-attention-pill ${turn.response.attentionLevel}`}
                            >
                              {formatAttentionLevel(
                                turn.response
                                  .attentionLevel,
                              )}
                            </span>

                            {turn.response
                              .insufficientContext && (
                              <span className="copilot-context-pill">
                                Limited context
                              </span>
                            )}
                          </div>

                          {turn.response
                            .referencedRequestIds
                            .length > 0 && (
                            <div className="copilot-chip-group">
                              {turn.response.referencedRequestIds.map(
                                (requestId) => (
                                  <span
                                    className="copilot-request-chip"
                                    key={
                                      requestId
                                    }
                                  >
                                    {
                                      requestId
                                    }
                                  </span>
                                ),
                              )}
                            </div>
                          )}

                          {turn.response
                            .recommendedActions
                            .length > 0 && (
                            <div className="copilot-actions">
                              <strong>
                                Recommendations
                              </strong>

                              <ul>
                                {turn.response.recommendedActions.map(
                                  (
                                    action,
                                  ) => (
                                    <li
                                      key={
                                        action
                                      }
                                    >
                                      {
                                        action
                                      }
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        </article>
                      )}
                    </div>
                  ),
                )}

                <div
                  ref={threadEndRef}
                  aria-hidden="true"
                />
              </div>

              <div className="copilot-suggestions">
                {STARTER_QUESTIONS.map(
                  (question) => (
                    <button
                      type="button"
                      key={
                        question
                      }
                      disabled={
                        isSending
                      }
                      onClick={() =>
                        void submitQuestion(
                          question,
                        )
                      }
                    >
                      {question}
                    </button>
                  ),
                )}
              </div>

              <form
                className="copilot-input-row"
                onSubmit={handleSubmit}
              >
                <label htmlFor="copilot-question">
                  Ask about operations
                </label>

                <div>
                  <textarea
                    id="copilot-question"
                    value={input}
                    onChange={(event) =>
                      setInput(
                        event.target.value,
                      )
                    }
                    placeholder="What needs my attention right now?"
                    rows={2}
                    maxLength={1500}
                    disabled={
                      isSending
                    }
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      isSending ||
                      trimmedInput.length < 2
                    }
                  >
                    {isSending
                      ? "Sending..."
                      : "Send"}
                  </button>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
