import { Heart } from "lucide-react";
import { motion } from "motion/react";
import { Progress } from "./ui/progress";
import { useState, useEffect } from "react";

interface LoadingScreenProps {
  onComplete: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500); // Small delay before transitioning
          return 100;
        }
        return prev + 33.33; // 3 steps to reach 100%
      });
    }, 800); // Each step takes ~800ms

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-white flex items-center justify-center">
      <div className="text-center space-y-8 max-w-md px-6">
        {/* Logo with Animation */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center space-x-3"
        >
          <motion.div 
            className="w-16 h-16 bg-gradient-to-r from-blue-500 to-teal-500 rounded-2xl flex items-center justify-center"
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1, repeat: Infinity, repeatType: "reverse" }
            }}
          >
            <Heart size={32} className="text-white" />
          </motion.div>
          <span className="text-3xl text-gray-900">Mediscript</span>
        </motion.div>

        {/* Medical Illustration */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex justify-center"
        >
          <img 
            src="https://images.unsplash.com/photo-1715111641899-b0118be16660?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwc3RldGhvc2NvcGUlMjBpbGx1c3RyYXRpb258ZW58MXx8fHwxNzU5MDcxMjAxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Medical Equipment" 
            className="w-32 h-32 object-cover rounded-full opacity-80"
          />
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-4"
        >
          <h2 className="text-xl text-gray-800">Signing you in securely...</h2>
          <p className="text-gray-600">Setting up your personalized dashboard</p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="space-y-3"
        >
          <Progress value={progress} className="h-2 bg-gray-200" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Verifying credentials</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </motion.div>

        {/* Security Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex items-center justify-center space-x-2 text-sm text-gray-500"
        >
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>Secure encrypted connection</span>
        </motion.div>
      </div>
    </div>
  );
}