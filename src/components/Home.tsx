// src/components/Home.tsx
import { useState, useEffect } from "react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Character } from "../types";
import { getModelAlias } from "./CharacterCard";
import { FiArrowRight } from "react-icons/fi";
import InfiniteCarousel from "./InfiniteCarousel";
import { Slide } from "./Carousel";

export default function Home() {
  const { user, login } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const navigate = useNavigate();

  // Redirect to dashboard if user is logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const slides: Slide[] = [
    {
      id: 1,
      title: "Software Engineer",
      subtitle: "Helps you write code",
      image: "profiles/profile1.jpg",
    },
    {
      id: 2,
      title: "Product Manager",
      subtitle: "Create a product roadmap",
      image: "profiles/product_manager.png",
    },
    {
      id: 3,
      title: "Yoga Instructor",
      subtitle: "Help you get fit and healthy",
      image: "profiles/yoga_instructor.png",
    },
    {
      id: 4,
      title: "Chef",
      subtitle: "Cooking up delicious meals",
      image: "profiles/chef.png",
    },
    {
      id: 5,
      title: "Project Manager",
      subtitle: "Help you outline and manage projects",
      image: "profiles/project_manager.png",
    },
    {
      id: 6,
      title: "Personal Trainer",
      subtitle: "Get fit and healthy",
      image: "profiles/personal_trainer.png",
    },
    {
      id: 7,
      title: "Web Developer",
      subtitle: "Helps you write code",
      image: "profiles/web_developer.png",
    },
    {
      id: 8,
      title: "Marketing Manager",
      subtitle: "Create a marketing plan",
      image: "profiles/marketing_manager.png",
    },
    {
      id: 9,
      title: "Financial Planner",
      subtitle: "Help you plan your finances",
      image: "profiles/finance_manager.png",
    },
    {
      id: 10,
      title: "Therapist",
      subtitle: "Talk about your life",
      image: "profiles/therapist.png",
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
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacters();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-gray-100">
      <nav className="p-4">
        <div className="mx-auto flex items-center justify-between max-w-[1560px]">
          <div className="flex items-center gap-2">
            {/* <img src={Logo} alt="NeverMade" className="w-8 h-8 mt-1" /> */}
            <h1 className="text-3xl instrument-serif-regular text-white">
              NeverMade
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* <Link
              to="/explore"
              className="rounded-lg px-4 py-2 hover:bg-zinc-800 hover:scale-102 transition-all duration-300"
            >
              Explore
            </Link> */}
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
                onClick={login}
                className="flex items-center cursor-pointer gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 hover:bg-zinc-700 hover:scale-102 transition-all duration-300"
              >
                <FcGoogle className="text-xl" /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto relative">
        <section className="flex flex-col justify-around h-[calc(100vh-2rem)] md:h-[calc(100vh-5rem)] relative">
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
                  onClick={login}
                  className="flex flex-row items-center justify-center gap-2 rounded-xl bg-white border border-zinc-300 text-zinc-900 pl-8 pr-7 py-3 text-xl font-semibold hover:bg-zinc-100 cursor-pointer hover:scale-102 transition-all duration-300"
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
                  console.log("clicked card parent");
                  navigate(`/characters/${slide.id}`);
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

        <section className="mt-48 mb-16">
          {isLoading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) =>
                user ? (
                  <Link
                    key={character.id}
                    to={`/dashboard/characters/${character.id}`}
                    className="p-6 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {character.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {character.User?.isOfficial ? (
                            <span className="flex items-center gap-1">
                              by{" "}
                              <span className="text-purple-500 font-medium">
                                Nevermade
                              </span>
                              <span className="inline-block px-1.5 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded-full">
                                Official
                              </span>
                            </span>
                          ) : (
                            <span>
                              by @{character.User?.username || "unknown"}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={`px-2 py-1 rounded ${
                            character.User?.isOfficial
                              ? "bg-purple-600/20 text-purple-400"
                              : "bg-gray-700 text-gray-400"
                          }`}
                        >
                          {getModelAlias(character.model)}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-400 mb-4 line-clamp-3">
                      {character.description}
                    </p>
                  </Link>
                ) : (
                  <button
                    key={character.id}
                    onClick={login}
                    className="p-6 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors text-left w-full"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {character.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {character.User?.isOfficial ? (
                            <span className="flex items-center gap-1">
                              by{" "}
                              <span className="text-purple-400 font-medium">
                                Nevermade
                              </span>
                              <span className="inline-block px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                Official
                              </span>
                            </span>
                          ) : (
                            <span>
                              by @{character.User?.username || "unknown"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-400 mb-4 line-clamp-3">
                      {character.description}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span
                        className={`px-2 py-1 rounded ${
                          character.User?.isOfficial
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {getModelAlias(character.model)}
                      </span>
                      <span className="text-purple-400">Sign in to chat →</span>
                    </div>
                  </button>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
