import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, GripHorizontal, RotateCcw } from 'lucide-react';

// Outer wrapper keeps hooks out of the conditional return.
export default function CommandPalette({ isOpen, onClose, commands }) {
  if (!isOpen) return null;
  return <Palette onClose={onClose} commands={commands} />;
}

function Palette({ onClose, commands }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const listRef = useRef(null);
  const navSourceRef = useRef('keyboard');
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const backdropMouseDownRef = useRef(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords || ''}`.toLowerCase().includes(q));
  }, [query, commands]);

  // Only scroll item into view when navigating via keyboard (not on mouse movement / scrollbar drag)
  useEffect(() => {
    if (navSourceRef.current === 'keyboard') {
      const el = listRef.current?.querySelector('[aria-selected="true"]');
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [index, results]);

  const run = (cmd) => {
    if (!cmd) return;
    onClose();
    // Let the palette unmount first so focus/toasts behave naturally.
    setTimeout(() => cmd.run(), 0);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navSourceRef.current = 'keyboard';
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navSourceRef.current = 'keyboard';
      setIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results[index]);
    }
  };

  // Safe backdrop click dismissal (prevents closing when selecting/dragging text that releases on backdrop)
  const handleBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      backdropMouseDownRef.current = true;
    }
  };

  const handleBackdropMouseUp = (e) => {
    if (backdropMouseDownRef.current && e.target === e.currentTarget && !isDragging) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  // Dragging handlers for search modal
  const handlePointerDown = (e) => {
    if (e.button !== 0) return; // Only primary button
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    // Viewport clamping
    const maxOffsetX = Math.max((window.innerWidth - 300) / 2, 200);
    const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, dragStartRef.current.initialX + dx));
    const clampedY = Math.max(-80, Math.min(window.innerHeight - 200, dragStartRef.current.initialY + dy));

    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const resetPosition = (e) => {
    e?.stopPropagation();
    setPosition({ x: 0, y: 0 });
  };

  const handleItemMouseMove = (e, i) => {
    // Only update active index if the mouse actually moved to a different coordinate
    // (Prevents scrollbar drag or list scrolling from fighting the user)
    if (e.clientX !== lastMousePosRef.current.x || e.clientY !== lastMousePosRef.current.y) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      navSourceRef.current = 'mouse';
      setIndex(i);
    }
  };

  const handleListWheel = () => {
    navSourceRef.current = 'wheel';
  };

  const rows = results.map((cmd, i) => ({ cmd, i, header: i === 0 || results[i - 1].group !== cmd.group }));
  const hasMoved = position.x !== 0 || position.y !== 0;

  return (
    <div
      className="backdrop backdrop-top"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        className={`modal palette ${isDragging ? 'is-dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      >
        {/* Draggable header bar */}
        <div
          className={`palette-handle ${isDragging ? 'is-dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={resetPosition}
          title="Drag to reposition palette · Double-click to re-center"
        >
          <div className="palette-handle-pill">
            <GripHorizontal size={15} className="palette-grip-icon" />
            <span className="palette-handle-title">Command Palette</span>
            <span className="palette-handle-hint">Drag to move</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasMoved && (
              <button
                type="button"
                className="palette-reset-pos"
                onClick={resetPosition}
                title="Reset to center"
                aria-label="Reset position"
              >
                <RotateCcw size={11} style={{ marginRight: 3, verticalAlign: -1 }} />Center
              </button>
            )}
            <span className="kbd" style={{ fontSize: 10, padding: '1px 5px' }}>Esc</span>
          </div>
        </div>

        <div className="palette-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
              navSourceRef.current = 'keyboard';
            }}
            placeholder="Type a command or search…"
            aria-label="Search commands"
          />
          {query && (
            <button
              type="button"
              className="chip"
              onClick={() => { setQuery(''); setIndex(0); }}
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              Clear
            </button>
          )}
        </div>

        <div
          className="palette-list"
          ref={listRef}
          role="listbox"
          onWheel={handleListWheel}
        >
          {results.length === 0 && <div className="empty">No commands match “{query}”.</div>}
          {rows.map(({ cmd, i, header }) => {
            const Icon = cmd.icon;
            return (
              <React.Fragment key={cmd.id}>
                {header && <div className="palette-group">{cmd.group}</div>}
                <button
                  type="button"
                  role="option"
                  className="palette-item"
                  aria-selected={i === index}
                  onMouseMove={(e) => handleItemMouseMove(e, i)}
                  onClick={() => run(cmd)}
                >
                  <span className="pi-icon">{Icon && <Icon size={15} />}</span>
                  <span>{cmd.label}</span>
                  {cmd.hint && <span className="pi-hint">{cmd.hint}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div
          className="palette-foot"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          title="Drag to reposition palette"
        >
          <span><ArrowUp size={12} /><ArrowDown size={12} />Navigate</span>
          <span><CornerDownLeft size={12} />Run</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <GripHorizontal size={13} style={{ opacity: 0.6 }} />GaitIQ
          </span>
        </div>
      </div>
    </div>
  );
}
