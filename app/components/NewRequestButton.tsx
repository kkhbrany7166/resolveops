"use client";

import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";

type RequestCategory =
  | "hvac"
  | "electrical"
  | "plumbing"
  | "security"
  | "other";

type RequestPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

type AiAnalysis = {
  title: string;
  category: RequestCategory;
  priority: RequestPriority;
  department: string;
  summary: string;
  location: string | null;
  sentiment: string;
  requires_human_escalation: boolean;
  suggested_response: string;
};

export default function NewRequestButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [description, setDescription] = useState("");
  const [site, setSite] = useState("");
  const [title, setTitle] = useState("");

  const [category, setCategory] =
    useState<RequestCategory | "">("");

  const [priority, setPriority] =
    useState<RequestPriority | "">("");

  const [analysis, setAnalysis] =
    useState<AiAnalysis | null>(null);

  const [isAnalyzing, setIsAnalyzing] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  function resetForm() {
    setDescription("");
    setSite("");
    setTitle("");
    setCategory("");
    setPriority("");
    setAnalysis(null);
    setError("");
    setIsAnalyzing(false);
    setIsSubmitting(false);
  }

  function closeModal() {
    setIsOpen(false);
    setIsSubmitted(false);
    resetForm();
  }

  async function handleAnalyze() {
    setError("");
    setAnalysis(null);

    if (description.trim().length < 5) {
      setError(
        "Describe the problem before asking AI to analyze it.",
      );
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch(
        "/api/ai/analyze-request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description,
            location: site.trim() || null,
          }),
        },
      );

      const result = (await response.json()) as
        | AiAnalysis
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in result && result.error
            ? result.error
            : "AI analysis could not be completed.",
        );
      }

      const aiResult = result as AiAnalysis;

      setAnalysis(aiResult);
      setTitle(aiResult.title);
      setCategory(aiResult.category);
      setPriority(aiResult.priority);

      if (!site.trim() && aiResult.location) {
        setSite(aiResult.location);
      }
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "AI analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    if (!category || !priority) {
      setError(
        "Analyze the request with AI or select category and priority.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          location: site,
          category,
          priority,
          description,
        }),
      });

      const result = (await response.json()) as {
        request?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to create request.",
        );
      }

      setIsSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="primary-button"
        onClick={() => setIsOpen(true)}
      >
        <span aria-hidden="true">+</span>
        New request
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="modal-backdrop"
            onClick={closeModal}
          >
            <section
              className="request-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-request-title"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <p className="eyebrow">
                AI-powered service request
              </p>

              <h2 id="new-request-title">
                Create a new request
              </h2>

              {isSubmitted ? (
                <div className="request-success">
                  <h3>Request created</h3>

                  <p>
                    The request was analyzed and saved
                    successfully.
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={closeModal}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form
                  className="request-form"
                  onSubmit={handleSubmit}
                >
                  <label>
                    Describe the problem

                    <textarea
                      value={description}
                      onChange={(event) =>
                        setDescription(
                          event.target.value,
                        )
                      }
                      placeholder="Example: The AC in room 504 stopped working and the guest is extremely upset."
                      rows={4}
                      required
                    />
                  </label>

                  <label>
                    Site or location

                    <input
                      type="text"
                      value={site}
                      onChange={(event) =>
                        setSite(event.target.value)
                      }
                      placeholder="Example: Room 504"
                      required
                    />
                  </label>

                  <div className="ai-row">
                    <button
                      type="button"
                      className="secondary-button ai-action"
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing
                        ? "Analyzing..."
                        : "✨ Analyze with AI"}
                    </button>

                    <div className="ai-summary-card">
                      {analysis ? (
                        <>
                          <h3>
                            AI analysis ready
                          </h3>

                          <p>
                            Routed to{" "}
                            <strong>
                              {analysis.department}
                            </strong>
                            {" · "}
                            Sentiment:{" "}
                            <strong>
                              {analysis.sentiment}
                            </strong>
                            {" · "}
                            Escalation:{" "}
                            <strong>
                              {analysis.requires_human_escalation
                                ? "Required"
                                : "Not required"}
                            </strong>
                          </p>
                        </>
                      ) : (
                        <>
                          <h3>AI analysis</h3>

                          <p>
                            Analyze the request to generate
                            the title, category, priority,
                            and routing.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <label className="full-span">
                    Request title

                    <input
                      type="text"
                      value={title}
                      onChange={(event) =>
                        setTitle(event.target.value)
                      }
                      placeholder="AI will generate a title"
                      required
                    />
                  </label>

                  <label>
                    Category

                    <select
                      value={category}
                      onChange={(event) =>
                        setCategory(
                          event.target
                            .value as RequestCategory,
                        )
                      }
                      required
                    >
                      <option value="">
                        Select a category
                      </option>

                      <option value="hvac">
                        HVAC
                      </option>

                      <option value="electrical">
                        Electrical
                      </option>

                      <option value="plumbing">
                        Plumbing
                      </option>

                      <option value="security">
                        Security
                      </option>

                      <option value="other">
                        Other
                      </option>
                    </select>
                  </label>

                  <label>
                    Priority

                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(
                          event.target
                            .value as RequestPriority,
                        )
                      }
                      required
                    >
                      <option value="">
                        Select a priority
                      </option>

                      <option value="low">
                        Low
                      </option>

                      <option value="medium">
                        Medium
                      </option>

                      <option value="high">
                        High
                      </option>

                      <option value="critical">
                        Critical
                      </option>
                    </select>
                  </label>

                  {error && (
                    <p
                      className="request-error"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Creating..."
                        : "Create request"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}