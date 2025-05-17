import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

type InfiniteCarouselProps = {
  /** One run‑through of slides; the component will clone them internally */
  children: ReactNode;
  /** Extra classes on the outer wrapper (e.g. sizing / margins) */
  className?: string;
  /** Auto‑scroll speed in **pixels per second** (default = 40 px/s) */
  speed?: number;
};

const FRAME_MS = 1000 / 60; // ≈16.7 ms

const InfiniteCarousel: React.FC<InfiniteCarouselProps> = ({
  children,
  className = "",
  speed = 40,
}) => {
  /* ───────── refs & state ───────── */
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [offset, setOffset] = useState(0);

  const startX = useRef(0);
  const startOffset = useRef(0);

  /* ───────── measure one copy’s width ───────── */
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (track) setTrackWidth(track.scrollWidth / 3);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  /* ───────── auto‑scroll loop ───────── */
  useEffect(() => {
    if (!trackWidth) return; // skip until we know width

    let rafId: number;
    const step = () => {
      if (!dragging.current) {
        setOffset((prev) => {
          let next = prev - (speed * FRAME_MS) / 1000;
          return next <= -trackWidth ? next + trackWidth : next;
        });
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [trackWidth, speed]);

  /* ───────── pointer handlers ───────── */
  const DRAG_THRESHOLD = 5;

  // refs to track interaction state
  const pointerId = useRef<number | null>(null);
  const maybeDragging = useRef(false); // true after down, false after up
  const dragging = useRef(false); // true only after threshold crossed

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    maybeDragging.current = true; // might become a drag
    dragging.current = false; // reset real‑drag flag
    pointerId.current = e.pointerId;

    startX.current = e.clientX;
    startOffset.current = offset;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!maybeDragging.current) return; // nothing to do

    const dx = e.clientX - startX.current;

    // 1️⃣ Elevate to "real drag" once past threshold
    if (!dragging.current && Math.abs(dx) > DRAG_THRESHOLD) {
      dragging.current = true;
      trackRef.current?.setPointerCapture(pointerId.current!);
    }

    // 2️⃣ Update position only while truly dragging
    if (dragging.current && trackWidth) {
      let next = startOffset.current + dx;
      if (next >= 0) next -= trackWidth;
      if (next <= -trackWidth) next += trackWidth;
      setOffset(next);
    }
  };

  const onPointerUp = () => {
    // If we were dragging, stop; if not, let the click bubble
    if (dragging.current) {
      trackRef.current?.releasePointerCapture(pointerId.current!);
    }
    maybeDragging.current = false;
    dragging.current = false;
  };

  const stopDragging = () => (dragging.current = false);

  /* ───────── render ───────── */
  return (
    <div
      className={`overflow-hidden select-none ${className} ${
        dragging.current ? "cursor-grabbing" : ""
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={stopDragging}
      role="group" // helps screen‑reader grouping
    >
      <div
        ref={trackRef}
        className="flex whitespace-nowrap will-change-transform"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {/* [clone][original][clone] */}
        {children}
        {children}
        {children}
      </div>
    </div>
  );
};

export default InfiniteCarousel;
