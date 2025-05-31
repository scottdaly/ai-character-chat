import React, { useState, useRef, useEffect, ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

interface ControlledCarouselProps {
  children: ReactNode[];
  title?: string;
  className?: string;
  itemsPerView?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  gap?: string;
}

const ControlledCarousel: React.FC<ControlledCarouselProps> = ({
  children,
  title,
  className = "",
  itemsPerView = { mobile: 1, tablet: 2, desktop: 3 },
  gap = "1rem",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerViewCurrent, setItemsPerViewCurrent] = useState(
    itemsPerView.desktop
  );
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Update items per view based on screen size with better breakpoints
  useEffect(() => {
    const updateItemsPerView = () => {
      const width = window.innerWidth;
      // More precise breakpoints for better mobile experience
      if (width < 640) {
        // Small mobile - always show exactly 1
        setItemsPerViewCurrent(itemsPerView.mobile);
      } else if (width < 1024) {
        // Tablet - show 2
        setItemsPerViewCurrent(itemsPerView.tablet);
      } else {
        // Desktop - show 3
        setItemsPerViewCurrent(itemsPerView.desktop);
      }

      // Debug: Log current settings (remove in production)
      if (process.env.NODE_ENV === "development") {
        console.log("Carousel responsive update:", {
          windowWidth: width,
          itemsPerView:
            width < 640
              ? itemsPerView.mobile
              : width < 1024
              ? itemsPerView.tablet
              : itemsPerView.desktop,
          totalItems: children.length,
        });
      }
    };

    updateItemsPerView();
    window.addEventListener("resize", updateItemsPerView);
    return () => window.removeEventListener("resize", updateItemsPerView);
  }, [itemsPerView, children.length]);

  // Calculate maximum index
  const maxIndex = Math.max(0, children.length - itemsPerViewCurrent);
  const totalPages = Math.ceil(children.length / itemsPerViewCurrent);

  // Navigation functions with infinite scrolling
  const goToNext = () => {
    setCurrentIndex((prev) => {
      const nextIndex = prev + 1;
      // If we're at the last possible position, wrap to beginning
      return nextIndex > maxIndex ? 0 : nextIndex;
    });
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => {
      // If we're at the beginning, wrap to the end
      return prev <= 0 ? maxIndex : prev - 1;
    });
  };

  // Touch/Mouse drag handlers with infinite scrolling
  const handleStart = (clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setScrollLeft(currentIndex);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;

    const diff = startX - clientX;
    const threshold = 50; // Minimum distance to trigger a slide

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swiped left - go to next
        goToNext();
      } else {
        // Swiped right - go to previous
        goToPrevious();
      }
      setIsDragging(false);
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("keydown", handleKeyDown);
      return () => container.removeEventListener("keydown", handleKeyDown);
    }
  }, []);

  // Always show navigation buttons since it's infinite
  const showNavigationButtons = children.length > itemsPerViewCurrent;

  return (
    <div
      ref={containerRef}
      className={`${className}`}
      tabIndex={0}
      role="region"
      aria-label="Character carousel"
    >
      {/* Title and Navigation Header */}
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">{title}</h2>
          {showNavigationButtons && (
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPrevious}
                className="p-2 rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-500  bg-zinc-700 hover:bg-zinc-600/80 text-zinc-200 hover:text-white cursor-pointer"
                aria-label="Previous characters"
              >
                <FiChevronLeft size={20} />
              </button>
              <button
                onClick={goToNext}
                className="p-2 rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-500 bg-zinc-700 hover:bg-zinc-600/80 text-zinc-200 hover:text-white cursor-pointer"
                aria-label="Next characters"
              >
                <FiChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Carousel track */}
      <div
        ref={trackRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing touch-pan-y relative"
        style={{
          width: "100%",
          maxWidth: "100%",
          marginRight: itemsPerViewCurrent > 1 ? "-2px" : "0", // Slight negative margin to hide slivers
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(-${
              currentIndex * (100 / itemsPerViewCurrent)
            }%)`,
            width: itemsPerViewCurrent === 1 ? "100%" : "100.1%", // Slight overwidth to prevent slivers
          }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="flex-shrink-0"
              style={{
                width: `${100 / itemsPerViewCurrent}%`,
                paddingRight:
                  itemsPerViewCurrent > 1 && index < children.length - 1
                    ? gap
                    : "1px",
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ControlledCarousel;
