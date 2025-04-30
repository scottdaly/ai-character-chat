// src/components/Home.tsx
import { useState, useEffect } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Character } from '../types';
import { getModelAlias } from './CharacterCard';
import { FiArrowRight } from 'react-icons/fi';
import Carousel from './Carousel';
import { Slide } from './Carousel';

export default function Home() {
  const { user, login } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const slides: Slide[] = [
    {
      id: 1,
      title: 'Software Engineer',
      subtitle: 'Helps you write code',
      image: 'profiles/profile1.jpg',
    },
    {
      id: 2,
      title: 'Product Manager',
      subtitle: 'Create a product roadmap',
      image: 'profiles/product_manager.png',
    },
    {
      id: 3,
      title: 'Yoga Instructor',
      subtitle: 'Help you get fit and healthy',
      image: 'profiles/yoga_instructor.png',
    },
    {
      id: 4,
      title: 'Chef',
      subtitle: 'Cooking up delicious meals',
      image: 'profiles/chef.png',
    },
    {
      id: 5,
      title: 'Project Manager',
      subtitle: 'Help you outline and manage projects',
      image: 'profiles/project_manager.png',
    },
    {
      id: 6,
      title: 'Personal Trainer',
      subtitle: 'Get fit and healthy',
      image: 'profiles/personal_trainer.png',
    },
    {
      id: 7,
      title: 'Marketing Manager',
      subtitle: 'Create a marketing plan',
      image: 'profiles/marketing_manager.png',
    },
    {
      id: 8,
      title: 'Financial Planner',
      subtitle: 'Help you plan your finances',
      image: 'profiles/finance_manager.png',
    },
    {
      id: 9,
      title: 'Therapist',
      subtitle: 'Talk about your life',
      image: 'profiles/therapist.png',
    },
    
    
    
  ];

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/characters/featured`);
        if (!response.ok) {
          throw new Error('Failed to load characters');
        }
        const data = await response.json();
        setCharacters(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load characters:', error);
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
        <div className="mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
          {/* <img src={Logo} alt="NeverMade" className="w-8 h-8 mt-1" /> */}
          <h1 className="text-2xl font-bold text-white old-standard-tt-bold">NeverMade</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/explore"
              className="rounded-lg px-4 py-2 hover:bg-gray-700"
            >
              Explore
            </Link>
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-lg border border-gray-400 hover:bg-gray-700 px-4 py-2"
                >
                  Dashboard
                </Link>
                
              </>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 hover:bg-gray-600"
              >
                <FcGoogle className="text-xl" /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto relative">
          
        <section className="mx-auto mt-8 mb-12 md:mt-20 md:mb-24 text-center relative">
          <div className="px-12 md:px-0 md:max-w-2xl mx-auto">
          <p className="mx-auto text-5xl md:text-7xl text-purple-300 relative z-10 font-semibold old-standard-tt-bold">
            Specialized AI to help with your life
          </p>
          <p className="mx-auto mb-8 max-w-4xl text-xl md:text-xl text-zinc-200">
            Powered by your choice of state-of-the-art language models
          </p>
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-full bg-zinc-100 pl-6 pr-2 py-2 text-lg font-semibold hover:bg-white text-zinc-900 inline-flex flex-row items-center gap-4"
            >
              <span>Go to your Dashboard</span>
              <div className="flex items-center gap-2 bg-purple-500 rounded-full px-2 py-1 mb-12 md:mb-24">
                <FiArrowRight className="text-xl" />
              </div>
            </Link>
          ) : (
            <button
              onClick={login}
              className="rounded-lg bg-purple-600 px-8 py-3 text-lg font-semibold hover:bg-purple-500 mb-4 md:mb-8"
            >
              Get Started
            </button>
          )}
</div>
          <Carousel 
    slides={slides}
  />

        </section>

        <section className="mt-48 mb-16">
         
          {isLoading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map(character => (
                user ? (
                  <Link
                    key={character.id}
                    to={`/dashboard/characters/${character.id}`}
                    className="p-6 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{character.name}</h3>
                        <p className="text-sm text-gray-400">
                          {character.User?.isOfficial ? (
                            <span className="flex items-center gap-1">
                              by <span className="text-purple-500 font-medium">Nevermade</span>
                              <span className="inline-block px-1.5 py-0.5 bg-purple-600/20 text-purple-400 text-xs rounded-full">
                                Official
                              </span>
                            </span>
                          ) : (
                            <span>by @{character.User?.username || 'unknown'}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 rounded ${
                        character.User?.isOfficial 
                          ? 'bg-purple-600/20 text-purple-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {getModelAlias(character.model)}
                      </span>
                    </div>
                    </div>
                    <p className="text-gray-400 mb-4 line-clamp-3">{character.description}</p>
                    
                  </Link>
                ) : (
                  <button
                    key={character.id}
                    onClick={login}
                    className="p-6 bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors text-left w-full"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold">{character.name}</h3>
                        <p className="text-sm text-gray-400">
                          {character.User?.isOfficial ? (
                            <span className="flex items-center gap-1">
                              by <span className="text-purple-400 font-medium">Nevermade</span>
                              <span className="inline-block px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                                Official
                              </span>
                            </span>
                          ) : (
                            <span>by @{character.User?.username || 'unknown'}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <p className="text-gray-400 mb-4 line-clamp-3">{character.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 rounded ${
                        character.User?.isOfficial 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {getModelAlias(character.model)}
                      </span>
                      <span className="text-purple-400">Sign in to chat →</span>
                    </div>
                  </button>
                )
              ))}
            </div>
          )}
        </section>

       
      </main>
    </div>
  );
}