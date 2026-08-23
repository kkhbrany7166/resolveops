"use client";

import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";

export default function NewRequestButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function closeModal() {
    setIsOpen(false);
    setIsSubmitted(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitted(true);
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
          <div className="modal-backdrop" onClick={closeModal}>
            <section
              className="request-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-request-title"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="eyebrow">Service request</p>
              <h2 id="new-request-title">Create a new request</h2>

              {isSubmitted ? (
                <div className="request-success">
                  <h3>Request ready</h3>
                  <p>Your request information was successfully validated.</p>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={closeModal}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form className="request-form" onSubmit={handleSubmit}>
                  <label>
                    Request title
                    <input
                      type="text"
                      name="title"
                      placeholder="Example: Air conditioner not working"
                      required
                    />
                  </label>

                  <label>
                    Site
                    <input
                      type="text"
                      name="site"
                      placeholder="Example: North Campus"
                      required
                    />
                  </label>

                  <label>
                    Category
                    <select name="category" required>
                      <option value="">Select a category</option>
                      <option value="hvac">HVAC</option>
                      <option value="electrical">Electrical</option>
                      <option value="plumbing">Plumbing</option>
                      <option value="security">Security</option>
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <label>
                    Priority
                    <select name="priority" required>
                      <option value="">Select a priority</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>

                  <label>
                    Description
                    <textarea
                      name="description"
                      placeholder="Describe the problem and its location"
                      rows={4}
                      required
                    />
                  </label>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>

                    <button type="submit" className="primary-button">
                      Create request
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