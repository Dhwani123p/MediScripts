import { UserPlus, Search, Video } from "lucide-react";
import { motion } from "motion/react";

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your account in less than 2 minutes. Add your basic health information and insurance details.",
    number: "01"
  },
  {
    icon: Search,
    title: "Select Doctor",
    description: "Browse through our network of certified doctors. Filter by specialization, ratings, and availability.",
    number: "02"
  },
  {
    icon: Video,
    title: "Consult Online",
    description: "Connect with your chosen doctor via video call or chat. Get prescription and medical advice instantly.",
    number: "03"
  }
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-br from-blue-50 to-teal-50">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl lg:text-5xl text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get started with your online consultation in just 3 simple steps
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
            >
              {/* Connection Line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-blue-200 to-teal-200 transform -translate-x-8 z-0"></div>
              )}
              
              <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 text-center">
                {/* Step Number */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-blue-600 to-teal-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-lg">
                  {step.number}
                </div>
                
                {/* Icon */}
                <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <step.icon size={40} className="text-blue-600" />
                </div>
                
                {/* Content */}
                <h3 className="text-2xl text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}