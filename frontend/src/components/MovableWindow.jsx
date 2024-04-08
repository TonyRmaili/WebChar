import React, { useState } from 'react';
import ReactDOM from 'react-dom';

function MovableWindow() {
    
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setPosition({
      x: e.clientX - e.target.getBoundingClientRect().left,
      y: e.clientY - e.target.getBoundingClientRect().top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - position.x;
    const newY = e.clientY - position.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div>
      <button onClick={openModal}>Open Modal</button>
      {isOpen &&
        ReactDOM.createPortal(
          <div
            className="modal-overlay"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <div
              className="modal"
              style={{ top: position.y, left: position.x }}
              onMouseDown={handleMouseDown}
            >
              <button className="modal-close-button" onClick={closeModal}>
                Close
              </button>
              <h2>Modal Content</h2>
              <p>This is a modal dialog.</p>
            </div>
          </div>,
          document.getElementById('modal-root')
        )}
    </div>
  );
}

export default MovableWindow;
