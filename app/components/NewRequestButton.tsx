"use client";

import { useState } from "react";

export default function NewRequestButton() {
  const [isOpen, setIsOpen] = useState(false);

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

      {isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsOpen(false)}
        >
          <section
            className="request-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-request-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Service request</p>
            <h2 id="new-request-title">Create a new request</h2>
            <p>The request form will be added in the next step.</p>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsOpen(false)}
            >
              Close
            </button>
          </section>
        </div>
      )}
    </>
  );
}