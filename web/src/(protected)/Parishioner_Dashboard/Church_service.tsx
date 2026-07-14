import React, { useState, useEffect} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {Cross,Diamond,Home,ArrowLeft,Droplets,AlertCircle,Loader2,ArrowRight,Heart,Users,RefreshCw,CheckCircle,XCircle,FileText,Clock,} from "lucide-react";
import BaptismForm from "./components/Forms/BaptismForm";
import ServiceForm from "./components/Forms/ServiceForm";
import CertificateForm from "./components/Forms/CertificateForm";
import {availabilityAPI,type ServiceAvailability,type CertificateAvailability,} from "../../../library/Availability";
import {serviceFormAPI,type CreateServiceFormData,} from "../../../library/service-form";
import {baptismFormAPI,type CreateBaptismFormData,} from "../../../library/baptism-form";
import {certificateFormAPI,type CreateCertificateFormData,} from "../../../library/certificate-form";
import { manageRequestAPI } from "../../../library/manage-request";
import { churchServiceAPI } from "../../../library/church_service";
import type { ChurchService as ChurchServiceType } from "../../../library/church_service";
import Navigation from "./Navigation";
import { useAuth } from "../../../context/AuthContext";
import type { User } from "../../../library/AuthStorage";

interface Godparent {
  id?: number;
  godparent_name: string;
  relationship: "godfather" | "godmother";
}

type FormMode = "baptism" | "service" | "certificate" | "select";

// Define error response type
interface ApiError {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
  };
  message?: string;
}

// Define Axios error type
interface AxiosErrorType {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
}

// SERVICE ID MAPPING - Map service names to their form types
const getFormTypeFromServiceName = (name: string): FormMode | null => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("baptism") && !lowerName.includes("certificate")) return "baptism";
  if (
    lowerName.includes("funeral") ||
    (lowerName.includes("marriage") && !lowerName.includes("certificate")) ||
    lowerName.includes("house blessing")
  ) {
    return "service";
  }
  if (lowerName.includes("certificate")) return "certificate";
  return null;
};

// Get icon for service
const getServiceIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("baptism") && !lowerName.includes("certificate")) return <Droplets className="w-10 h-10" />;
  if (lowerName.includes("funeral")) return <Cross className="w-10 h-10" />;
  if (lowerName.includes("marriage") && !lowerName.includes("certificate")) return <Diamond className="w-10 h-10" />;
  if (lowerName.includes("house blessing") || lowerName.includes("house"))
    return <Home className="w-10 h-10" />;
  if (lowerName.includes("certificate"))
    return <Diamond className="w-10 h-10" />;
  return <Heart className="w-10 h-10" />;
};

// Get icon for certificate
const getCertificateIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('baptismal')) return <FileText className="w-10 h-10" />;
  if (lowerTitle.includes('marriage')) return <Diamond className="w-10 h-10" />;
  return <FileText className="w-10 h-10" />;
};

// Get color scheme for service
const getServiceColors = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("baptism") && !lowerName.includes("certificate")) {
    return {
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      hoverBg: "hover:bg-blue-100",
      textColor: "text-blue-600",
      buttonColor: "bg-blue-600",
      buttonHover: "hover:bg-blue-700",
      borderColor: "border-blue-200",
      borderHover: "hover:border-blue-400",
    };
  }
  if (lowerName.includes("funeral")) {
    return {
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      hoverBg: "hover:bg-purple-100",
      textColor: "text-purple-600",
      buttonColor: "bg-purple-600",
      buttonHover: "hover:bg-purple-700",
      borderColor: "border-purple-200",
      borderHover: "hover:border-purple-400",
    };
  }
  if (lowerName.includes("marriage") && !lowerName.includes("certificate")) {
    return {
      color: "from-pink-500 to-pink-600",
      bgColor: "bg-pink-50",
      hoverBg: "hover:bg-pink-100",
      textColor: "text-pink-600",
      buttonColor: "bg-pink-600",
      buttonHover: "hover:bg-pink-700",
      borderColor: "border-pink-200",
      borderHover: "hover:border-pink-400",
    };
  }
  if (lowerName.includes("house blessing") || lowerName.includes("house")) {
    return {
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50",
      hoverBg: "hover:bg-green-100",
      textColor: "text-green-600",
      buttonColor: "bg-green-600",
      buttonHover: "hover:bg-green-700",
      borderColor: "border-green-200",
      borderHover: "hover:border-green-400",
    };
  }
  if (lowerName.includes("certificate")) {
    return {
      color: "from-amber-500 to-amber-600",
      bgColor: "bg-amber-50",
      hoverBg: "hover:bg-amber-100",
      textColor: "text-amber-600",
      buttonColor: "bg-amber-600",
      buttonHover: "hover:bg-amber-700",
      borderColor: "border-amber-200",
      borderHover: "hover:border-amber-400",
    };
  }
  return {
    color: "from-gray-500 to-gray-600",
    bgColor: "bg-gray-50",
    hoverBg: "hover:bg-gray-100",
    textColor: "text-gray-600",
    buttonColor: "bg-gray-600",
    buttonHover: "hover:bg-gray-700",
    borderColor: "border-gray-200",
    borderHover: "hover:border-gray-400",
  };
};

// Get color scheme for certificate
const getCertificateColors = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('baptismal')) {
    return {
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-50",
      hoverBg: "hover:bg-blue-100",
      textColor: "text-blue-600",
      buttonColor: "bg-blue-600",
      buttonHover: "hover:bg-blue-700",
      borderColor: "border-blue-200",
      borderHover: "hover:border-blue-400",
    };
  }
  if (lowerTitle.includes('marriage')) {
    return {
      color: "from-pink-500 to-pink-600",
      bgColor: "bg-pink-50",
      hoverBg: "hover:bg-pink-100",
      textColor: "text-pink-600",
      buttonColor: "bg-pink-600",
      buttonHover: "hover:bg-pink-700",
      borderColor: "border-pink-200",
      borderHover: "hover:border-pink-400",
    };
  }
  return {
    color: "from-amber-500 to-amber-600",
    bgColor: "bg-amber-50",
    hoverBg: "hover:bg-amber-100",
    textColor: "text-amber-600",
    buttonColor: "bg-amber-600",
    buttonHover: "hover:bg-amber-700",
    borderColor: "border-amber-200",
    borderHover: "hover:border-amber-400",
  };
};

const getRemainingSlots = (slotsRemaining: string): number => {
  if (!slotsRemaining) return 0;
  if (slotsRemaining.includes("/")) {
    const parts = slotsRemaining.split("/");
    return parseInt(parts[0]) || 0;
  }
  return parseInt(slotsRemaining) || 0;
};

// ✅ FIXED: Get user ID from user object - Changed from parishioner to user
const getUserIdFromUser = (user: User | null): number => {
  if (!user) return 0;
  
  // Direct user_id from User model
  if (user.user_id) {
    return user.user_id;
  }
  
  return 0;
};

const LoadingFallback: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
};

type RenderableItem = ServiceAvailability | CertificateAvailability;

// Certificate to Church Service mapping
const CERTIFICATE_TO_SERVICE_MAP: Record<string, string> = {
  'baptismal': 'Baptismal Certificate',
  'marriage': 'Marriage Certificate',
};

// Helper function to get the church service name for a certificate
const getCertificateServiceName = (title: string): string | null => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('baptismal')) return CERTIFICATE_TO_SERVICE_MAP.baptismal;
  if (lowerTitle.includes('marriage')) return CERTIFICATE_TO_SERVICE_MAP.marriage;
  return null;
};

const ChurchService: React.FC = () => {
  const { serviceId } = useParams<Record<string, string>>();
  const navigate = useNavigate();
  
  // Use the auth context
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [services, setServices] = useState<ServiceAvailability[]>([]);
  const [certificates, setCertificates] = useState<CertificateAvailability[]>([]);
  const [churchServices, setChurchServices] = useState<ChurchServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<FormMode>("select");
  const [selectedService, setSelectedService] =
    useState<ServiceAvailability | null>(null);
  const [selectedCertificate, setSelectedCertificate] =
    useState<CertificateAvailability | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'services' | 'certificates'>('services');

  // Load services from API
  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoading(true);
        setError(null);

        const availabilityResponse = await availabilityAPI.getAvailability();

        if (!availabilityResponse.success) {
          throw new Error(
            availabilityResponse.message || "Failed to load availability"
          );
        }

        if (!availabilityResponse.data) {
          throw new Error("No data received");
        }

        // Set services from the response
        setServices(availabilityResponse.data.services || []);
        
        // Filter certificates
        const supportedCertificateTypes = ['baptismal', 'marriage'];
        const filteredCertificates = (availabilityResponse.data.certificates || [])
          .filter((cert: CertificateAvailability) => 
            supportedCertificateTypes.some(type => 
              cert.title.toLowerCase().includes(type)
            )
          );
        
        setCertificates(filteredCertificates);

        try {
          const churchServiceResponse = await churchServiceAPI.getAll({
            per_page: 100,
          });
          const serviceMap = churchServiceResponse.data?.data?.data || [];
          setChurchServices(serviceMap);

          if (serviceId) {
            const foundService = availabilityResponse.data.services.find(
              (s) => s.id === serviceId
            );

            if (foundService) {
              setSelectedService(foundService);

              const matchedService = serviceMap.find(
                (s: ChurchServiceType) => s.service_name === foundService.name
              );

              if (matchedService) {
                setSelectedServiceId(matchedService.service_id);
              }

              const formType = getFormTypeFromServiceName(foundService.name);
              if (formType) {
                setSelectedForm(formType);
              } else {
                setError(`Unsupported service type: ${foundService.name}`);
              }
            } else {
              setError(`Service "${serviceId}" not found`);
            }
          }
        } catch (churchError) {
          console.error("Failed to load church services:", churchError);
          setError(
            "Failed to load church service details. Some features may be limited."
          );
        }
      } catch (err) {
        console.error("Failed to load services:", err);

        if (err && typeof err === "object" && "response" in err) {
          const axiosError = err as AxiosErrorType;
          if (axiosError.response?.status === 404) {
            setError(
              "Service availability endpoint not found. Please check your connection."
            );
          } else if (axiosError.response?.status === 401) {
            setError("Please log in to view available services.");
          } else {
            setError(
              `Failed to load services: ${
                axiosError.response?.data?.message ||
                axiosError.message ||
                "Unknown error"
              }`
            );
          }
        } else {
          setError("Failed to load service details. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [serviceId]);

  const handleTabChange = (tab: 'services' | 'certificates') => {
    setActiveTab(tab);
    setSelectedForm('select');
    setSelectedService(null);
    setSelectedCertificate(null);
    setSelectedServiceId(null);
  };

  // ✅ FIXED: Handle baptism form submission - Changed parishioner_id to user_id
  const handleBaptismSubmit = async (
    data: CreateBaptismFormData & { godparents?: Godparent[] }
  ) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Use auth context
      if (!isAuthenticated || !user) {
        throw new Error("Please log in to submit a request");
      }

      // ✅ FIXED: Get user ID from user
      const userId = getUserIdFromUser(user);
      if (!userId) {
        console.error('❌ No user ID found in user object:', user);
        throw new Error("Please log in to submit a request");
      }

      if (!selectedServiceId) {
        throw new Error("No service selected");
      }

      const baptismResponse = await baptismFormAPI.create(data);

      if (!baptismResponse.data.success) {
        throw new Error(
          baptismResponse.data.message || "Failed to create baptism form"
        );
      }

      const baptismForm = baptismResponse.data.data;
      const baptismId = baptismForm.baptism_id;
      console.log(`✅ Baptism form created with ID: ${baptismId}`);

      if (data.godparents && data.godparents.length > 0) {
        console.log(`Step 2: Adding ${data.godparents.length} godparents...`);
        for (const gp of data.godparents) {
          await baptismFormAPI.addGodparent(baptismId, {
            godparent_name: gp.godparent_name,
            relationship: gp.relationship,
          });
        }
        console.log(
          `✅ ${data.godparents.length} godparents added successfully`
        );
      }

      // ✅ FIXED: Use user_id instead of parishioner_id
      const requestData = {
        user_id: userId,
        service_id: selectedServiceId,
        baptism_form_id: baptismId,
      };

      console.log("Request data:", requestData);

      const requestResponse = await manageRequestAPI.create(requestData);

      if (!requestResponse.data.success) {
        throw new Error(
          requestResponse.data.message || "Failed to create request"
        );
      }

      console.log(
        `✅ Request created with ID: ${requestResponse.data.data.request_id}`
      );

      // ✅ FIXED: Navigate to correct path
      navigate("/parishioner", {
        state: {
          type: "baptism",
          data: data,
          savedData: baptismForm,
          request: requestResponse.data.data,
          success: true,
        },
      });
    } catch (error: unknown) {
      console.error("Error submitting baptism form:", error);

      let errorMessage = "Failed to submit baptism request. Please try again.";

      if (error && typeof error === "object") {
        const apiError = error as ApiError;
        if (apiError.response?.data?.errors) {
          const errors = apiError.response.data.errors;
          const errorMessages = Object.values(errors).flat();
          errorMessage = errorMessages.join(". ");
        } else if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message;
        } else if (error instanceof Error && error.message) {
          errorMessage = error.message;
        }
      }

      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ FIXED: Handle service form submission - Changed parishioner_id to user_id
  const handleServiceSubmit = async (data: CreateServiceFormData) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Use auth context
      if (!isAuthenticated || !user) {
        throw new Error("Please log in to submit a request");
      }

      // ✅ FIXED: Get user ID from user
      const userId = getUserIdFromUser(user);
      if (!userId) {
        console.error('❌ No user ID found in user object:', user);
        throw new Error("Please log in to submit a request");
      }

      if (!selectedServiceId) {
        throw new Error("No service selected");
      }

      const serviceResponse = await serviceFormAPI.create(data);

      if (!serviceResponse.data.success) {
        throw new Error(
          serviceResponse.data.message || "Failed to create service form"
        );
      }

      const serviceForm = serviceResponse.data.data;
      const serviceFormId = serviceForm.serviceform_id;

      // ✅ FIXED: Use user_id instead of parishioner_id
      const requestData = {
        user_id: userId,
        service_id: selectedServiceId,
        service_form_id: serviceFormId,
      };

      const requestResponse = await manageRequestAPI.create(requestData);

      if (!requestResponse.data.success) {
        throw new Error(
          requestResponse.data.message || "Failed to create request"
        );
      }

      // ✅ FIXED: Navigate to correct path
      navigate("/parishioner", {
        state: {
          type: "service",
          data: data,
          savedData: serviceForm,
          request: requestResponse.data.data,
          success: true,
        },
      });
    } catch (error: unknown) {
      console.error("Error submitting service form:", error);

      let errorMessage = "Failed to submit service request. Please try again.";

      if (error && typeof error === "object") {
        const apiError = error as ApiError;
        if (apiError.response?.data?.errors) {
          const errors = apiError.response.data.errors;
          const errorMessages = Object.values(errors).flat();
          errorMessage = errorMessages.join(". ");
        } else if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message;
        } else if (error instanceof Error && error.message) {
          errorMessage = error.message;
        }
      }

      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ FIXED: Handle certificate form submission - Changed parishioner_id to user_id
  const handleCertificateSubmit = async (data: CreateCertificateFormData) => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Use auth context
      if (!isAuthenticated || !user) {
        throw new Error("Please log in to submit a request");
      }

      // ✅ FIXED: Get user ID from user
      const userId = getUserIdFromUser(user);
      if (!userId) {
        console.error('❌ No user ID found in user object:', user);
        throw new Error("Please log in to submit a request");
      }

      if (!selectedServiceId) {
        throw new Error("No service selected");
      }

      const certificateResponse = await certificateFormAPI.create(data);

      if (!certificateResponse.data.success) {
        throw new Error(
          certificateResponse.data.message ||
            "Failed to create certificate form"
        );
      }

      const certificateForm = certificateResponse.data.data;
      const certificateId = certificateForm.certificate_id;

      // ✅ FIXED: Use user_id instead of parishioner_id
      const requestData = {
        user_id: userId,
        service_id: selectedServiceId,
        certificate_form_id: certificateId,
      };

      const requestResponse = await manageRequestAPI.create(requestData);

      if (!requestResponse.data.success) {
        throw new Error(
          requestResponse.data.message || "Failed to create request"
        );
      }

      // ✅ FIXED: Navigate to correct path
      navigate("/parishioner", {
        state: {
          type: "certificate",
          data: data,
          savedData: certificateForm,
          request: requestResponse.data.data,
          success: true,
        },
      });
    } catch (error: unknown) {
      console.error("Error submitting certificate form:", error);

      let errorMessage =
        "Failed to submit certificate request. Please try again.";

      if (error && typeof error === "object") {
        const apiError = error as ApiError;
        if (apiError.response?.data?.errors) {
          const errors = apiError.response.data.errors;
          const errorMessages = Object.values(errors).flat();
          errorMessage = errorMessages.join(". ");
        } else if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message;
        } else if (error instanceof Error && error.message) {
          errorMessage = error.message;
        }
      }

      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/parishioner");
  };

  // Wait for auth to load
  if (authLoading) {
    return <LoadingFallback />;
  }

  // Loading State 
  if (loading) {
    return <LoadingFallback />;
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-red-600 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Oops! Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mb-3"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
          <button
            onClick={() => navigate("/parishioner")}
            className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Service Selection View
  if (selectedForm === "select") {
    // Determine which items to show based on active tab
    const items: RenderableItem[] = activeTab === 'services' ? services : certificates;
    const isEmpty = items.length === 0;

    // Helper to check if item is a ServiceAvailability
    const isService = (item: RenderableItem): item is ServiceAvailability => {
      return 'name' in item && 'slotsRemaining' in item;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Navigation Bar */}
        <Navigation />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
              Church Services
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose from our available services below. Select a service to begin your request.
            </p>
          </div>

          {/* Tab Navigation - Under the header */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex bg-gray-100 p-1 rounded-lg shadow-sm">
              <button
                onClick={() => handleTabChange('services')}
                className={`px-6 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'services'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Services
              </button>
              <button
                onClick={() => handleTabChange('certificates')}
                className={`px-6 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'certificates'
                    ? 'bg-white text-blue-600 shadow-md'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Certificates
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {isEmpty ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {activeTab === 'services' 
                  ? 'No services available at the moment.' 
                  : 'No certificates available at the moment.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map((item) => {
                // Handle service items
                if (isService(item)) {
                  const service = item;
                  const colors = getServiceColors(service.name);
                  const icon = getServiceIcon(service.name);
                  const isAvailable = service.isAvailable !== false;
                  const remainingSlots = getRemainingSlots(service.slotsRemaining);
                  const hasSlots = remainingSlots > 0;

                  const matchedService = churchServices.find(
                    (s: ChurchServiceType) => s.service_name === service.name
                  );
                  const serviceIdNumber = matchedService?.service_id || null;

                  return (
                    <div
                      key={service.id}
                      className={`${colors.bgColor} ${
                        colors.hoverBg
                      } rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 ${
                        isAvailable && hasSlots && serviceIdNumber
                          ? `${colors.borderColor} ${colors.borderHover}`
                          : "border-gray-200 opacity-60"
                      } relative overflow-hidden group`}
                    >
                      <div className="absolute top-3 right-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            isAvailable && hasSlots && serviceIdNumber
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {isAvailable && hasSlots && serviceIdNumber ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Available
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              {!serviceIdNumber ? "No ID" : "Unavailable"}
                            </>
                          )}
                        </span>
                      </div>

                      <div
                        className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.color} opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500`}
                      ></div>

                      <div className="relative">
                        <div
                          className={`${colors.textColor} mb-4 transform group-hover:scale-110 transition-transform duration-300`}
                        >
                          {icon}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {service.name}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                          {service.description || "Service description"}
                        </p>

                        <div className="space-y-2 mb-4 text-sm">
                          {service.dailyLimit && (
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                Daily Limit
                              </span>
                              <span className="font-semibold text-gray-800">
                                {service.dailyLimit}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-gray-600">
                            <span className="flex items-center gap-1">
                              <RefreshCw className="w-4 h-4" />
                              Limit Refresh
                            </span>
                            <span className="font-semibold text-gray-800">
                              {service.nextDate}
                            </span>
                          </div>

                          {hasSlots && (
                            <div className="flex items-center justify-between text-gray-600 border-t border-gray-100 pt-2 mt-1">
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                Available Today
                              </span>
                              <span className="text-xs font-medium text-green-600">
                                {remainingSlots} slots left
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            if (!isAvailable || !hasSlots || !serviceIdNumber)
                              return;
                            setSelectedService(service);
                            setSelectedServiceId(serviceIdNumber);

                            const formType = getFormTypeFromServiceName(
                              service.name
                            );
                            if (formType) {
                              setSelectedForm(formType);
                            } else {
                              setError(`Unsupported service type: ${service.name}`);
                            }
                          }}
                          disabled={!isAvailable || !hasSlots || !serviceIdNumber}
                          className={`w-full px-4 py-3 ${
                            isAvailable && hasSlots && serviceIdNumber
                              ? `${colors.buttonColor} ${colors.buttonHover}`
                              : "bg-gray-300 cursor-not-allowed"
                          } text-white rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50`}
                        >
                          <span>
                            {!serviceIdNumber
                              ? "No Service ID"
                              : isAvailable && hasSlots
                              ? "Start Request"
                              : "Not Available"}
                          </span>
                          {isAvailable && hasSlots && serviceIdNumber && (
                            <ArrowRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                } 
                // Handle certificate items
                else {
                  const certificate = item as CertificateAvailability;
                  const colors = getCertificateColors(certificate.title);
                  const icon = getCertificateIcon(certificate.title);
                  
                  // Get the expected service name for this certificate
                  const expectedServiceName = getCertificateServiceName(certificate.title);
                  
                  // Find matching church service by exact service name
                  let matchedService = churchServices.find(
                    (s: ChurchServiceType) => 
                      s.service_name === expectedServiceName
                  );
                  
                  if (!matchedService && expectedServiceName) {
                    matchedService = churchServices.find(
                      (s: ChurchServiceType) => 
                        s.service_name?.toLowerCase().includes(expectedServiceName.toLowerCase())
                    );
                  }
                  
                  if (!matchedService) {
                    matchedService = churchServices.find(
                      (s: ChurchServiceType) => 
                        s.service_name?.toLowerCase().includes(certificate.title.toLowerCase()) ||
                        certificate.title.toLowerCase().includes(s.service_name?.toLowerCase() || '')
                    );
                  }
                  
                  const serviceIdNumber = matchedService?.service_id || null;

                  return (
                    <div
                      key={certificate.id}
                      className={`${colors.bgColor} ${
                        colors.hoverBg
                      } rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 ${
                        serviceIdNumber
                          ? `${colors.borderColor} ${colors.borderHover}`
                          : "border-gray-200 opacity-60"
                      } relative overflow-hidden group`}
                    >
                      <div className="absolute top-3 right-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            serviceIdNumber
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {serviceIdNumber ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Available
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              No ID
                            </>
                          )}
                        </span>
                      </div>

                      <div
                        className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.color} opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500`}
                      ></div>

                      <div className="relative">
                        <div
                          className={`${colors.textColor} mb-4 transform group-hover:scale-110 transition-transform duration-300`}
                        >
                          {icon}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {certificate.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                          {certificate.description}
                        </p>

                        <div className="space-y-2 mb-4 text-sm">
                          <div className="flex items-center justify-between text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Processing Time
                            </span>
                            <span className={`font-semibold ${certificate.timeColor}`}>
                              {certificate.processingTime}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (!serviceIdNumber) {
                              console.error('❌ No service ID found for certificate:', certificate.title);
                              return;
                            }
                            setSelectedCertificate(certificate);
                            setSelectedServiceId(serviceIdNumber);
                            setSelectedForm('certificate');
                          }}
                          disabled={!serviceIdNumber}
                          className={`w-full px-4 py-3 ${
                            serviceIdNumber
                              ? `${colors.buttonColor} ${colors.buttonHover}`
                              : "bg-gray-300 cursor-not-allowed"
                          } text-white rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50`}
                        >
                          <span>
                            {!serviceIdNumber
                              ? "Unavailable"
                              : "Request Certificate"}
                          </span>
                          {serviceIdNumber && (
                            <ArrowRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Form Submission View
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => {
              setSelectedForm("select");
              setSelectedService(null);
              setSelectedCertificate(null);
              setSelectedServiceId(null);
              setSubmitError(null);
            }}
            className="hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            {activeTab === 'services' ? 'Services' : 'Certificates'}
          </button>
          <span>/</span>
          <span className="text-gray-700 font-medium">
            {selectedForm === "baptism" ? "Baptism Request" : 
             selectedForm === "certificate" ? "Certificate Request" : 
             "Service Request"}
          </span>
        </div>

        {submitError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Submission Error</p>
              <p className="text-sm">{submitError}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                  {selectedForm === "baptism" ? (
                    <Droplets className="w-5 h-5" />
                  ) : selectedForm === "certificate" ? (
                    <Diamond className="w-5 h-5" />
                  ) : (
                    <Heart className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedForm === "baptism" ? (
                      "Baptism Request Form"
                    ) : selectedForm === "certificate" ? (
                      "Certificate Request Form"
                    ) : (
                      `${selectedService?.name || selectedCertificate?.title || 'Service'} Request Form`
                    )}
                  </h3>
                </div>
              </div>
              {isSubmitting && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Submitting...</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {selectedForm === "baptism" && (
              <BaptismForm
                onSubmit={handleBaptismSubmit}
                onCancel={handleCancel}
                isEdit={false}
              />
            )}

            {selectedForm === "service" && (
              <ServiceForm
                onSubmit={handleServiceSubmit}
                onCancel={handleCancel}
                isEdit={false}
                preselectedService={selectedService?.name || ''}
              />
            )}

            {selectedForm === "certificate" && (
              <CertificateForm
                onSubmit={handleCertificateSubmit}
                onCancel={handleCancel}
                isEdit={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChurchService;