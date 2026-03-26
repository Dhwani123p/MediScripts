import { Button } from "./ui/button";
import { Heart, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion } from "motion/react";

const getNavItems = (onNavigateAbout?: () => void) => [
  { name: "Home", href: "#", action: () => window.scrollTo(0, 0) },
  { name: "About", href: "#about", action: onNavigateAbout },
  { name: "Services", href: "#services", action: () => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) },
  { name: "How It Works", href: "#how-it-works", action: () => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }) },
  { name: "Doctors", href: "#doctors", action: () => document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' }) }
];

interface HeaderProps {
  onNavigateSignIn?: () => void;
  onNavigateSignUp?: () => void;
  onNavigateAbout?: () => void;
  onBookAppointment?: () => void;
}

export function Header({ onNavigateSignIn, onNavigateSignUp, onNavigateAbout, onBookAppointment }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems = getNavItems(onNavigateAbout);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div 
            className="flex items-center space-x-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Heart size={24} className="text-white" />
            </div>
            <span className="text-2xl text-gray-900">Mediscript</span>
          </motion.div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={item.action}
                className="text-gray-600 hover:text-[#008080] transition-colors"
              >
                {item.name}
              </button>
            ))}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <Button 
              //variant="ghost" 
              className="text-gray-600 bg-blue-600 to-teal-100 hover:text-[#008080] text-white"
              onClick={onNavigateSignIn}
            >
              Sign In
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-[#008080]/90 text-white"
              onClick={onNavigateSignUp}
            >
              Sign Up
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <motion.div 
            className="lg:hidden py-4 border-t border-gray-100"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <nav className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    item.action?.();
                    setIsMenuOpen(false);
                  }}
                  className="text-gray-600 hover:text-[#008080] transition-colors px-2 py-1 text-left"
                >
                  {item.name}
                </button>
              ))}
              <div className="flex flex-col space-y-2 pt-4 border-t border-gray-100">
                <Button 
                  variant="ghost" 
                  className="bg-blue-600 hover:text-[#008080] justify-start text-white"
                  onClick={() => {
                    onNavigateSignIn?.();
                    setIsMenuOpen(false);
                  }}
                >
                  Sign In
                </Button>
                <Button 
                  variant="ghost" 
                  className="bg-blue-600 hover:bg-[#008080]/90  justify-start text-white"
                  onClick={() => {
                    onBookAppointment?.();
                    setIsMenuOpen(false);
                  }}
                >
                  Sign Up
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </div>
    </header>
  );
}