import React, { useState, useRef, useEffect } from "react";

const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
};

export interface Slide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  isFeatures?: boolean;
  buttons?: string[];
  url?: string;
}

interface CarouselProps {
  slides: Slide[];
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
}

interface VisibleSlide extends Slide {
  position: number;
  visible: boolean;
  isDuplicate?: boolean;
}

const Carousel: React.FC<CarouselProps> = ({
  slides = [],
  cardWidth = 288,
  cardHeight = 432,
  cardGap = 108,
}) => {
  const [centerIndex, setCenterIndex] = useState(Math.floor(slides.length / 2));
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const dragRef = useRef(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const rafRef = useRef<number>();
  const { width } = useWindowSize();

  const updateDragPosition = () => {
    if (!carouselRef.current) return;

    const slides = carouselRef.current.querySelectorAll(".carousel-slide");
    slides.forEach((slide: Element) => {
      const slideElement = slide as HTMLElement;
      const position = Number(slideElement.dataset.position || 0);
      slideElement.style.transform = `translateX(${
        position * cardGap + (isDragging ? dragRef.current / 10 : 0)
      }%)`;
    });

    if (isDragging) {
      rafRef.current = requestAnimationFrame(updateDragPosition);
    }
  };

  const handleDragStart = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startXRef.current = clientX;
    scrollLeftRef.current = 0;
    dragRef.current = 0;
    animationRef.current?.pause();
    rafRef.current = requestAnimationFrame(updateDragPosition);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    // Calculate the new center index based on drag distance
    const dragDistance = dragRef.current;
    const slideWidth = cardWidth + (cardWidth * cardGap) / 100;
    const slidesMoved = Math.round(dragDistance / slideWidth);

    setCenterIndex((prev) => {
      const newIndex = (prev - slidesMoved + slides.length) % slides.length;
      return newIndex;
    });

    // Resume animation from new position
    if (animationRef.current) {
      animationRef.current.play();
    }
  };

  const handleDragMove = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (!isDragging) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    dragRef.current = (clientX - startXRef.current) * 0.5;
  };

  useEffect(() => {
    // Calculate duration based on screen width
    const minDuration = 5000;
    const maxDuration = 15000;
    const minWidth = 320;
    const maxWidth = 1920;

    const durationPerSlide =
      minDuration +
      ((width - minWidth) / (maxWidth - minWidth)) *
        (maxDuration - minDuration);

    const animation =
      carouselRef.current?.animate(
        [
          { transform: "translateX(0%)" },
          {
            transform: `translateX(-${
              (100 * slides.length) / (slides.length + 1)
            }%)`,
          },
        ],
        {
          duration:
            Math.min(Math.max(durationPerSlide, minDuration), maxDuration) *
            slides.length,
          iterations: Number.POSITIVE_INFINITY,
          easing: "linear",
        }
      ) || null;

    animationRef.current = animation;

    return () => {
      animationRef.current?.cancel();
    };
  }, [slides.length, width]);

  useEffect(() => {
    const handleMouseUp = () => handleDragEnd();
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  const getVisibleSlides = (): VisibleSlide[] => {
    // Calculate how many slides we need to show including duplicates
    const visibleCount = Math.min(5, slides.length); // Show up to 5 slides at a time
    const totalSlides = slides.length;

    // Create positions array for all slides plus duplicates for seamless loop
    const positions = Array.from(
      { length: totalSlides + visibleCount },
      (_, i) => i - Math.floor(totalSlides / 2)
    );

    return positions.map((position) => {
      // For positions beyond the original slides length, wrap back to the start
      let index =
        (((centerIndex + position) % totalSlides) + totalSlides) % totalSlides;

      return {
        ...slides[index],
        position,
        visible: true,
        isDuplicate: position >= totalSlides,
      };
    });
  };

  // Simple hash function to determine layout direction from string ID
  const getLayoutDirection = (id: string): boolean => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 2 === 0;
  };

  if (!slides.length) {
    return null;
  }

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={carouselRef}
        className="relative select-none"
        style={{ height: `${cardHeight + 100}px` }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onMouseMove={handleDragMove}
        onTouchMove={handleDragMove}
        onMouseEnter={() => animationRef.current?.pause()}
        onMouseLeave={() => {
          if (isDragging) handleDragEnd();
          animationRef.current?.play();
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {getVisibleSlides().map((slide: VisibleSlide, arrayIndex) => (
            <div
              key={`${slide.id}-${
                slide.isDuplicate ? "dup-" + arrayIndex : slide.position
              }`}
              className={`carousel-slide absolute hover:cursor-grab active:cursor-grabbing hover:scale-105 hover:z-50 hover:shadow-lg ${
                isDragging ? "cursor-grabbing" : ""
              }`}
              data-position={slide.position}
              style={{
                width: `${cardWidth}px`,
                height: `${cardHeight}px`,
                transition: isDragging ? "none" : "all 0.4s ease-out",
                zIndex: 30 - Math.abs(slide.position),
                opacity:
                  hoveredIndex === slide.id || hoveredIndex === null ? 1 : 0.5,
                visibility: slide.visible ? "visible" : "hidden",
                willChange: "transform",
                touchAction: "none",
              }}
              onClick={(e) => {
                if (isDragging || Math.abs(dragRef.current) > 5) {
                  e.preventDefault();
                  return;
                }
                window.open(slide.url, "_blank");
              }}
              onMouseEnter={(e) => {
                if (!isDragging) {
                  setHoveredIndex(slide.id);
                  e.currentTarget.style.transform = `translateX(${
                    slide.position * (cardGap - 5)
                  }%)`;
                }
              }}
              onMouseLeave={(e) => {
                if (!isDragging) {
                  setHoveredIndex(null);
                  e.currentTarget.style.transform = `translateX(${
                    slide.position * cardGap
                  }%)`;
                }
              }}
            >
              <div
                className={`flex w-full h-full rounded-lg overflow-hidden bg-zinc-950 ${
                  getLayoutDirection(slide.id) ? "flex-col" : "flex-col-reverse"
                }`}
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  className={`w-full object-cover h-[364px] rounded-lg`}
                  draggable={false}
                />
              </div>
              <div
                className={`absolute inset-0 flex flex-col items-start px-3 py-2 ${
                  getLayoutDirection(slide.id) ? "justify-end" : "justify-start"
                }`}
              >
                <h3 className="text-white text-xl font-medium">
                  {slide.title}
                </h3>
                <p className="text-white text-sm">{slide.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Carousel;

// Example usage:
/*
import { Carousel } from './Carousel';

const slides: Slide[] = [
  {
    id: 1,
    title: 'Zappa',
    subtitle: 'SECRET CLUB',
    image: '/path/to/image.jpg',
    logo: '/path/to/logo.jpg',
  },
  {
    id: 2,
    title: 'Wanna Play a Game?',
    subtitle: 'STRANGE THINGS',
    image: '/path/to/image.jpg',
    logo: '/path/to/logo.jpg',
    isFeatures: true,
    buttons: ['PREVIEW', 'DETAILS'],
  },
  // ... more slides
];

export const MyComponent = () => (
  <Carousel 
    slides={slides}
    cardWidth={256}  // optional, default is 256
    cardHeight={384} // optional, default is 384
    cardGap={110}    // optional, default is 110
  />
);
*/
