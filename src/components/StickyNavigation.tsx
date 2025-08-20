import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, Play, ChevronDown } from 'lucide-react';
import { useCSVStore } from '@/store/csvStore';

// Custom hook for smooth animations
const useSmoothAnimation = (show: boolean, delay: number = 0) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, delay]);
  
  return isVisible;
};

export const StickyNavigation: React.FC = () => {
  const { files, variantExpansion } = useCSVStore();
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isAtGenerateSection, setIsAtGenerateSection] = useState(false);
  
  // Check if all files are uploaded
  const allFilesUploaded = Object.values(files).every(file => file.uploaded);
  const hasVariantExpansion = !!variantExpansion;
  const canGenerate = allFilesUploaded && hasVariantExpansion;
  
  // Use smooth animations
  const showGenerateButton = useSmoothAnimation(canGenerate && !isAtGenerateSection, 500);
  const showScrollButton = useSmoothAnimation(showScrollToTop, 100);
  
  // Show scroll to top button when user scrolls down and check if at generate section
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 600);
      
      // Check if user is at the generate section
      const generateSection = document.querySelector('[data-section="generate"]');
      if (generateSection) {
        const rect = generateSection.getBoundingClientRect();
        
        // Hide button when the generate section is visible in the viewport
        // We consider the user "at" the section when it's within 600px of the top
        // This gives a better buffer zone for the button to disappear
        const isAtSection = rect.top <= 600;
        setIsAtGenerateSection(isAtSection);
      }
    };

    // Use passive scroll listener for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const scrollToGenerate = () => {
    const generateSection = document.querySelector('[data-section="generate"]');
    if (generateSection) {
      generateSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Only show the sticky navigation when all files are uploaded
  if (!allFilesUploaded) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {/* Go to Generate Button */}
      {showGenerateButton && (
        <div className="relative group sticky-nav-enter">
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Jump to CSV generation section
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
          
          <Button
            onClick={scrollToGenerate}
            size="lg"
            className="shadow-xl hover:shadow-2xl transition-all duration-200 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-4 py-4 rounded-full group animate-bounce"
            style={{ animationDelay: '2s', animationIterationCount: '3' }}
          >
            {/* <div className="flex items-center gap-3"> */}
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Play className="h-4 w-4 text-white" />
              </div>
              {/* <span className="font-semibold">Go to Generate</span> */}
              {/* <ChevronDown className="h-4 w-4 text-white group-hover:translate-y-1 transition-transform" /> */}
            {/* </div> */}
          </Button>
        </div>
      )}

      {/* Scroll to Top Button */}
      {showScrollButton && (
        <div className="relative group sticky-nav-enter">
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Back to top
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
          
          <Button
            onClick={scrollToTop}
            size="lg"
            variant="outline"
            className="shadow-lg hover:shadow-xl transition-all duration-200 bg-white/90 backdrop-blur-sm border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 px-4 py-4 rounded-full group"
          >
            <ArrowUp className="h-5 w-5 text-primary group-hover:-translate-y-1 transition-transform" />
          </Button>
        </div>
      )}
    </div>
  );
};
