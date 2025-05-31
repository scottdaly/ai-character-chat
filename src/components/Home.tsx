// src/components/Home.tsx
import { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Character } from "../types";
import { FiArrowRight } from "react-icons/fi";
import InfiniteCarousel from "./InfiniteCarousel";

export default function Home() {
  const { user, login } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const navigate = useNavigate();

  // Redirect to dashboard if user is logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const slides = [
    {
      id: 1,
      title: "Software Engineer",
      subtitle: "Helps you write code",
      image: "profiles/profile1.jpg",
      characterName: "Software Engineer",
    },
    {
      id: 2,
      title: "Product Manager",
      subtitle: "Create a product roadmap",
      image: "profiles/product_manager.png",
      characterName: "Product Manager",
    },
    {
      id: 3,
      title: "Yoga Instructor",
      subtitle: "Help you get fit and healthy",
      image: "profiles/yoga_instructor.png",
      characterName: "Yoga Instructor",
    },
    {
      id: 4,
      title: "Chef",
      subtitle: "Cooking up delicious meals",
      image: "profiles/chef.png",
      characterName: "Chef",
    },
    {
      id: 5,
      title: "Project Manager",
      subtitle: "Help you outline and manage projects",
      image: "profiles/project_manager.png",
      characterName: "Project Manager",
    },
    {
      id: 6,
      title: "Personal Trainer",
      subtitle: "Get fit and healthy",
      image: "profiles/personal_trainer.png",
      characterName: "Personal Trainer",
    },
    {
      id: 7,
      title: "Web Developer",
      subtitle: "Helps you write code",
      image: "profiles/web_developer.png",
      characterName: "Web Developer",
    },
    {
      id: 8,
      title: "Marketing Manager",
      subtitle: "Create a marketing plan",
      image: "profiles/marketing_manager.png",
      characterName: "Marketing Manager",
    },
    {
      id: 9,
      title: "Financial Planner",
      subtitle: "Help you plan your finances",
      image: "profiles/finance_manager.png",
      characterName: "Financial Planner",
    },
    {
      id: 10,
      title: "Therapist",
      subtitle: "Talk about your life",
      image: "profiles/therapist.png",
      characterName: "Therapist",
    },
  ];

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/characters/featured`
        );
        if (!response.ok) {
          throw new Error("Failed to load characters");
        }
        const data = await response.json();
        setCharacters(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load characters:", error);
        setCharacters([]);
      }
    };

    // Clean up any old debugging localStorage items
    localStorage.removeItem("debug_character_click");
    localStorage.removeItem("debug_redirect_url");

    loadCharacters();
  }, []);

  // Function to find character by name
  const findCharacterByName = (characterName: string) => {
    return characters.find((char) => char.name === characterName);
  };

  // Function to handle card click
  const handleCardClick = (slide: (typeof slides)[0]) => {
    if (!user) {
      // Store the intended character in URL params before login
      const character = findCharacterByName(slide.characterName);

      if (character) {
        // Redirect to login with the intended character ID
        const redirectUrl = `${
          import.meta.env.VITE_API_URL
        }/auth/google?redirect_to_character=${character.id}`;

        window.location.href = redirectUrl;
      } else {
        // Fallback to normal login
        login();
      }
      return;
    }

    const character = findCharacterByName(slide.characterName);
    if (character) {
      const tempId = `temp-${Date.now()}`;
      navigate(`/dashboard/characters/${character.id}/conversations/${tempId}`);
    } else {
      // Fallback to dashboard if character not found
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-gray-100">
      <nav className="p-4">
        <div className="mx-auto flex items-center justify-between max-w-[1560px]">
          <div className="flex items-center gap-1">
            <svg
              width="155"
              height="267"
              viewBox="0 0 155 267"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8"
            >
              <path
                d="M142.666 3.46669C132.132 7.73336 119.466 16.9334 101.866 33.0667C76.2658 56.4 68.9324 62.2667 47.0658 76.8C18.2658 96 5.59909 109.867 2.53242 125.6L1.73242 130H8.26576C22.5324 130 35.0658 124.267 69.1991 102C80.7991 94.5334 95.4658 85.7334 101.866 82.4C114.532 76 134.399 69.2 144.932 67.6C151.066 66.8 151.999 66.2667 153.066 62.6667C155.066 56.1334 154.932 15.6 152.799 7.60002C151.866 3.86669 150.666 0.666685 150.266 0.800018C149.732 0.800018 146.399 2.00002 142.666 3.46669Z"
                fill="white"
              />
              <path
                d="M122 85.4667C105.2 89.8667 91.3334 98.8 66.6667 121.067C59.4667 127.467 46.6667 137.733 38.1334 143.867C29.6 150 19.7333 158.133 16.2667 161.867C1.73335 177.333 -3.19999 199.467 2.66668 222.4C3.46668 225.333 4.13335 225.867 6.53335 225.2C21.7333 220.533 35.6 211.867 48.4 199.067C57.7334 189.733 66.2667 177.6 80.5334 153.067C92.1334 133.067 100.667 122.667 112 114.667C123.2 106.667 132.133 103.2 144.667 102.133L154.667 101.333V93.3334C154.667 85.6 154.533 85.3334 150.667 84.5334C143.6 82.9334 129.6 83.4667 122 85.4667Z"
                fill="white"
              />
              <path
                d="M139.467 130.8C129.067 133.6 116.8 140 107.867 147.2C91.2003 160.533 82.2669 175.333 67.4669 214.4C57.0669 241.733 53.8669 247.6 43.4669 257.867L34.9336 266.4L42.2669 265.6C57.0669 264.133 67.6003 255.733 88.6669 228.667C101.334 212.533 112.4 201.067 132.4 183.6C148.667 169.333 153.6 159.6 154.267 139.6L154.667 128.667L150.667 128.8C148.534 128.8 143.467 129.733 139.467 130.8Z"
                fill="white"
              />
            </svg>
            <h1 className="text-3xl instrument-serif-regular text-white">
              NeverMade
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-lg border border-gray-400 hover:border-zinc-600 hover:bg-zinc-800 px-4 py-2 hover:scale-102 transition-all duration-300"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <button
                onClick={() => login()}
                className="flex items-center cursor-pointer gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700 hover:scale-102 transition-all duration-300"
              >
                <FcGoogle className="text-xl" /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto relative">
        <section className="flex flex-col justify-around h-[calc(100vh-2rem)] md:h-[calc(100vh-5rem)] relative pb-6">
          <div className="flex flex-col items-center md:items-start w-full gap-5 md:gap-8 px-4 2xl:px-0 md:max-w-[1560px] mx-auto text-center md:text-start">
            <p className="text-6xl md:text-8xl text-zinc-100 relative z-10 font-semibold md:w-[50%] leading-16 md:leading-24 instrument-serif-regular tracking-wide">
              AI Companions to Help You Do Anything
            </p>
            <div className="flex flex-row instrument-serif-regular">
              {user ? (
                <Link
                  to="/dashboard"
                  className="rounded-xl hover:scale-102 transition-all duration-300 bg-zinc-100 pl-6 pr-1 py-1 text-lg font-semibold hover:bg-white text-zinc-900 flex flex-row items-center justify-center gap-4"
                >
                  <span>Go to your Dashboard</span>
                  <div className="flex items-center justify-center gap-2 bg-purple-500 rounded-xl px-2 py-2 h-full">
                    <FiArrowRight className="text-xl" />
                  </div>
                </Link>
              ) : (
                <button
                  onClick={() => login()}
                  className="flex flex-row items-center justify-center gap-2 rounded-xl bg-zinc-100 border border-zinc-300 text-zinc-900 pl-8 pr-7 py-3 text-xl font-semibold hover:bg-white cursor-pointer hover:scale-105 transition-all duration-300"
                >
                  <span>Get Started</span>
                  <FiArrowRight className="text-xl" />
                </button>
              )}
            </div>
          </div>

          <InfiniteCarousel
            className="h-148 pt-12"
            speed={hoveredCard ? 0 : 10}
          >
            {" "}
            {/* any height you like */}
            {slides.map((slide) => (
              <article
                key={slide.id}
                className={`flex-shrink-0 w-72 flex flex-col justify-between mr-16 text-white hover:scale-105 transition-all duration-500  cursor-pointer ${
                  hoveredCard === slide.id || hoveredCard === null
                    ? ""
                    : "opacity-60"
                }`}
                onMouseEnter={() => {
                  setHoveredCard(slide.id);
                }}
                onMouseLeave={() => {
                  setHoveredCard(null);
                }}
                onClick={() => {
                  handleCardClick(slide);
                }}
              >
                {slide.id % 2 === 1 && (
                  <div className="flex flex-col justify-start items-start h-14">
                    <h3 className="text-2xl md:text-3xl font-semibold text-black dark:text-white leading-4 pb-2 instrument-serif-regular">
                      {slide.title}
                    </h3>
                    <p className="text-xs md:text-sm text-neutral-700 dark:text-neutral-300">
                      {slide.subtitle}
                    </p>
                  </div>
                )}
                <div className="h-96 md:h-108 w-full overflow-hidden rounded-xl relative">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                {slide.id % 2 === 0 && (
                  <div className="flex flex-col items-start justify-end h-14">
                    <h3 className="text-2xl md:text-3xl font-semibold text-black dark:text-white leading-tight instrument-serif-regular">
                      {slide.title}
                    </h3>
                    <p className="text-xs md:text-sm text-neutral-700 dark:text-neutral-300 leading-2 pt-0.5">
                      {slide.subtitle}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </InfiniteCarousel>
        </section>
      </main>
    </div>
  );
}
