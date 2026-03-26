import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { motion } from "motion/react";

interface HeroSectionProps {
  onBookAppointment?: () => void;
}

export function HeroSection({ onBookAppointment }: HeroSectionProps) {
  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-teal-50 to-white min-h-screen flex items-center">
      <div className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div 
            className="space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl text-gray-900 leading-tight">
                Your Health, 
                <span className="block text-blue-600">Anytime, Anywhere.</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-lg">
                Consult top doctors online within minutes. Get professional healthcare 
                from the comfort of your home.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-blue-600 hover:bg-[#008080]/90 text-white px-8 py-6 text-lg"
                onClick={onBookAppointment}
              >
                Book Appointment
              </Button>
              
            </div>
            {/* Trust Indicators */}
           
          </motion.div>

          {/* Right Image */}
          <motion.div 
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1758691463606-1493d79cc577?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWxlbWVkaWNpbmUlMjBkb2N0b3IlMjBwYXRpZW50JTIwdmlkZW8lMjBjYWxsfGVufDF8fHx8MTc1OTA2ODk3MHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                alt="Doctor patient telemedicine consultation"
                className="w-full h-auto rounded-2xl shadow-2xl"
              />
              
              {/* Floating Elements */}
              <motion.div 
                className="absolute -top-4 -right-4 bg-white rounded-xl p-4 shadow-lg"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Online Now</span>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute -bottom-4 -left-4 bg-blue-600 text-white rounded-xl p-4 shadow-lg"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
              >
                <div className="text-sm"> Prescription Ready</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}