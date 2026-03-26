import { Video, MessageCircle, FileText, Clock } from "lucide-react";
import { motion } from "motion/react";

const features = [
  {
    icon: Video,
    title: "Online Doctor Consultation",
    description: "Connect with certified doctors through HD video calls and secure chat messaging for instant medical advice.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: FileText,
    title: "Digital Prescription & Medicine",
    description: "Receive digital prescriptions instantly and get medicines delivered to your doorstep within hours.",
    color: "bg-teal-100 text-teal-600"
  },
  {
    icon: MessageCircle,
    title: "Health Records Management",
    description: "Access your complete medical history, lab reports, and prescriptions in one secure digital dashboard.",
    color: "bg-blue-100 text-blue-600"
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl lg:text-5xl text-gray-900 mb-4">
            Why Choose Our Platform?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Experience healthcare like never before with our comprehensive telemedicine solutions
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="text-center space-y-4 p-6 rounded-xl hover:bg-gray-50 transition-colors duration-300">
                <div className={`w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon size={32} />
                </div>
                <h3 className="text-xl text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}