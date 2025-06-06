import InfiniteCarousel from "./InfiniteCarousel";
import CharacterCard from "./CharacterCard";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Character } from "../types";

export default function Test() {
  const navigate = useNavigate();
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // Test characters with images
  const testCharacters: Character[] = [
    {
      id: "test-1",
      name: "Software Engineer",
      description:
        "Helps you write clean, efficient code and solve programming challenges",
      model: "gpt-4",
      systemPrompt: "You are a helpful software engineer...",
      createdAt: new Date(),
      UserId: "test-user",
      isPublic: true,
      messageCount: 150,
      image: "profiles/profile1.jpg",
      User: {
        username: "nevermade",
        displayName: "NeverMade",
        isOfficial: true,
      },
    },
    {
      id: "test-2",
      name: "Product Manager",
      description:
        "Create product roadmaps and manage development cycles effectively",
      model: "gpt-4",
      systemPrompt: "You are an experienced product manager...",
      createdAt: new Date(),
      UserId: "test-user",
      isPublic: true,
      messageCount: 89,
      image: "profiles/product_manager.png",
      User: {
        username: "nevermade",
        displayName: "NeverMade",
        isOfficial: true,
      },
    },
    {
      id: "test-3",
      name: "Yoga Instructor",
      description:
        "Guide you through mindful practices and help create balance in your life",
      model: "gpt-4",
      systemPrompt: "You are a calm and experienced yoga instructor...",
      createdAt: new Date(),
      UserId: "test-user",
      isPublic: true,
      messageCount: 234,
      image: "profiles/yoga_instructor.png",
      User: {
        username: "nevermade",
        displayName: "NeverMade",
        isOfficial: true,
      },
    },
    {
      id: "test-4",
      name: "No Image Character",
      description: "This character has no image to test the fallback behavior",
      model: "gpt-4",
      systemPrompt: "You are a helpful assistant...",
      createdAt: new Date(),
      UserId: "test-user",
      isPublic: true,
      messageCount: 42,
      // No image field
      User: {
        username: "testuser",
        displayName: "Test User",
        isOfficial: false,
      },
    },
  ];

  const slides = [
    {
      id: 1,
      title: "App Developer",
      subtitle: "Writes code for mobile apps",
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
      subtitle: "Create balance in your life",
      image: "profiles/yoga_instructor.png",
    },
    {
      id: 4,
      title: "Italian Chef",
      subtitle: "Cooking up delicious meals",
      image: "profiles/chef.png",
    },
    {
      id: 5,
      title: "Project Manager",
      subtitle: "Outline and manage projects",
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

  return (
    <main className="py-8 space-y-12">
      {/* Character Cards Test Section */}
      <section>
        <h1 className="text-3xl font-bold mb-6">
          Character Cards with Images Test
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {testCharacters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              showMessageCount={true}
              showPublicStatus={false}
            />
          ))}
        </div>
      </section>

      {/* Original Carousel Section */}
      <section>
        <h1 className="text-3xl font-bold mb-6">
          Featured Characters Carousel
        </h1>
        <InfiniteCarousel className="h-120 pt-10" speed={hoveredCard ? 0 : 20}>
          {slides.map((slide) => (
            <article
              key={slide.id}
              className={`flex-shrink-0 w-64 flex flex-col justify-between mr-10 text-white hover:scale-105 transition-all duration-500  cursor-pointer ${
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
                  <h3 className="text-2xl font-semibold text-black leading-4 pb-1.5">
                    {slide.title}
                  </h3>
                  <p className="text-sm text-neutral-700">{slide.subtitle}</p>
                </div>
              )}
              <div className="h-84 w-full overflow-hidden rounded-xl relative">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>
              {slide.id % 2 === 0 && (
                <div className="flex flex-col justify-end h-14">
                  <h3 className="text-2xl font-semibold text-black leading-tight">
                    {slide.title}
                  </h3>
                  <p className="text-sm text-neutral-700 leading-2 pt-1.5">
                    {slide.subtitle}
                  </p>
                </div>
              )}
            </article>
          ))}
        </InfiniteCarousel>
      </section>
    </main>
  );
}
