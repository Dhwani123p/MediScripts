import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Shield, Heart, Clock, Users, Award, CheckCircle } from "lucide-react";
import { motion } from "motion/react";

export function AboutSection() {
  const stats = [
    { number: "Beta", label: "Currently in Testing", icon: Users },
    { number: "v1.0", label: "Prototype Release", icon: Award },
    { number: "24/7", label: "Available Support", icon: Clock },
    { number: "AI", label: "ML-Powered Prescriptions", icon: Heart }
  ];

  const features = [
    "HIPAA Compliant & Secure",
    "Licensed Healthcare Providers",
    "FDA Approved Treatments",
    "24/7 Emergency Support",
    "Insurance Coverage",
    "Prescription Management"
  ];

  const process = [
    {
      step: "1",
      title: "Create Your Account",
      description: "Sign up in minutes with your basic information and complete your medical profile."
    },
    {
      step: "2", 
      title: "Find Your Doctor",
      description: "Browse our network of certified specialists and choose the right doctor for your needs."
    },
    {
      step: "3",
      title: "Book & Connect",
      description: "Schedule your appointment and connect via secure video call, chat, or phone."
    },
    {
      step: "4",
      title: "Get Treatment",
      description: "Receive personalized care, prescriptions, and follow-up support from your healthcare provider."
    }
  ];

  return (
    <section id="about" className="py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="mb-4 px-4 py-2 text-[#008080] border-[#008080]">
            About MediScript
          </Badge>
          <h2 className="text-4xl lg:text-5xl mb-6 text-gray-900">
            About MediScript
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            MediScript is an AI-powered telemedicine prototype that connects patients with doctors through secure video consultations and generates smart prescriptions using machine learning.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-20"
        >
          {stats.map((stat, index) => (
            <Card key={index} className="text-center border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <stat.icon className="w-8 h-8 text-[#008080] mx-auto mb-4" />
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>



      </div>
    </section>
  );
}