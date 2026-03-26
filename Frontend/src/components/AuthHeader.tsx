import { Heart } from "lucide-react";
import { motion } from "motion/react";

interface AuthHeaderProps {
  onLogoClick: () => void;
}

export function AuthHeader({ onLogoClick }: AuthHeaderProps) {
  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-100">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <motion.button 
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            onClick={onLogoClick}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center">
              <Heart size={24} className="text-white" />
            </div>
            <span className="text-2xl text-gray-900">Mediscript</span>
          </motion.button>

          {/* Trust Badge */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}