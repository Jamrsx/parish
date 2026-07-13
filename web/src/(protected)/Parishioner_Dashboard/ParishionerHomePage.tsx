import React from "react";
import Navigation from "./Navigation";
import ChurchImage from "../../assets/images/church_entrance.jpg";
import { Church, ScrollText } from "lucide-react";

interface Service {
  id: number;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const servicesData: Service[] = [
  {
    id: 1,
    title: "Church Services",
    icon: <Church size={32} className="text-blue-600" />,
    description:
      "Join us for worship, prayer, and spiritual growth. Experience God's presence in our welcoming community.",
  },
  {
    id: 2,
    title: "Sacramental Records",
    icon: <ScrollText size={32} className="text-blue-600" />,
    description:
      "Access baptism, confirmation, marriage, and other sacramental documents for your records.",
  },
];

const ParishionerHome: React.FC = () => {
  const handleInquire = (serviceTitle: string): void => {
    console.log(`Inquire about ${serviceTitle}`);
    alert(
      `Thank you for your interest in ${serviceTitle}. A representative will contact you soon.`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main>
        {/* ==================== HERO SECTION ==================== */}
        <section className="bg-[#FEFCF8] py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center gap-12">
              {/* Left Content */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Welcome to San Guillermo Parish
                </h1>
                <p className="mt-4 text-lg md:text-xl text-gray-600">
                  A place of worship, community, and grace
                </p>
              </div>

              {/* Right Image */}
              <div className="flex-1">
                <img
                  src={ChurchImage}
                  alt="St. Mary's Church beautiful architecture"
                  className="w-full h-auto rounded-2xl shadow-xl object-cover"
                  style={{ maxHeight: "400px" }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ==================== SERVICES SECTION (Cards) ==================== */}
        <section id="services" className="py-16 md:py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Our Services
              </h2>
              <div className="w-24 h-1 bg-blue-600 mx-auto mt-4 rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {servicesData.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6 flex flex-col items-center text-center border border-gray-100"
                >
                  <div className="mb-4 p-3 bg-blue-50 rounded-full">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-3">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {service.description}
                  </p>
                  <button
                    onClick={() => handleInquire(service.title)}
                    className="mt-auto bg-transparent border-2 border-blue-600 text-blue-600 px-6 py-2 rounded-full hover:bg-blue-600 hover:text-white transition-colors font-medium"
                  >
                    Inquire Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                San Guillermo Parish
              </h3>
              <address className="not-italic space-y-2">
                <p>Centro Iponan, Cagayan de Oro</p>
                <p>Philippines 9000</p>

                <p className="pt-2">
                  📞 <a href="tel:09065054009">0906-505-4009</a>
                </p>

                <p>
                  <a href="https://mail.google.com/mail/?view=cm&to=sanguillermodemaleval@gmail.com">
                    sanguillermodemaleval@gmail.com
                  </a>
                </p>
              </address>
            </div>
            <div className="md:text-right">
              <p className="text-sm">
                &copy; {new Date().getFullYear()} St. Mary's Church. All rights
                reserved.
              </p>
              <p className="text-sm mt-2 text-gray-400">
                A place of worship, community, and grace.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ParishionerHome;
