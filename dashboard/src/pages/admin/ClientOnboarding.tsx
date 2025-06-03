import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CheckCircle, 
  Circle, 
  ArrowRight, 
  ArrowLeft,
  Save,
  Send,
  User,
  Settings,
  Database,
  Zap,
  DollarSign,
  Shield,
  Globe,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Users,
  FileText,
  AlertTriangle,
  Info,
  Upload,
  Check,
  X,
  Loader2
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'current' | 'completed' | 'error';
  required: boolean;
}

interface CompanyInfo {
  companyName: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  website: string;
  industry: string;
  companySize: string;
  yearEstablished: string;
}

interface ContactInfo {
  primaryContact: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    phone: string;
  };
  billingContact: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    phone: string;
  };
  technicalContact: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    phone: string;
  };
}

interface ServiceConfiguration {
  serviceTypes: string[];
  customerSegments: string[];
  regions: string[];
  estimatedCustomers: number;
  goLiveDate: string;
  dataRetentionPeriod: number;
  reportingFrequency: string;
}

interface DataSourceConfig {
  meterDataSource: string;
  billingSystem: string;
  customerDatabase: string;
  geographicData: string;
  weatherData: boolean;
  demandResponseData: boolean;
  solarProductionData: boolean;
}

interface BillingSetup {
  billingModel: string;
  monthlyFee: number;
  perCustomerFee: number;
  transactionFee: number;
  setupFee: number;
  contractTerm: number;
  invoiceFrequency: string;
  paymentTerms: string;
}

export const ClientOnboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form state
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    companyName: '',
    legalName: '',
    taxId: '',
    registrationNumber: '',
    website: '',
    industry: 'electric_utility',
    companySize: '',
    yearEstablished: ''
  });

  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    primaryContact: { firstName: '', lastName: '', title: '', email: '', phone: '' },
    billingContact: { firstName: '', lastName: '', title: '', email: '', phone: '' },
    technicalContact: { firstName: '', lastName: '', title: '', email: '', phone: '' }
  });

  const [serviceConfig, setServiceConfig] = useState<ServiceConfiguration>({
    serviceTypes: [],
    customerSegments: [],
    regions: [],
    estimatedCustomers: 0,
    goLiveDate: '',
    dataRetentionPeriod: 365,
    reportingFrequency: 'monthly'
  });

  const [dataSourceConfig, setDataSourceConfig] = useState<DataSourceConfig>({
    meterDataSource: '',
    billingSystem: '',
    customerDatabase: '',
    geographicData: '',
    weatherData: false,
    demandResponseData: false,
    solarProductionData: false
  });

  const [billingSetup, setBillingSetup] = useState<BillingSetup>({
    billingModel: 'subscription',
    monthlyFee: 0,
    perCustomerFee: 0,
    transactionFee: 0,
    setupFee: 0,
    contractTerm: 12,
    invoiceFrequency: 'monthly',
    paymentTerms: 'net_30'
  });

  const steps: OnboardingStep[] = [
    {
      id: 'company',
      title: 'Company Information',
      description: 'Basic company details and legal information',
      icon: <Building2 className="w-6 h-6" />,
      status: currentStep === 0 ? 'current' : currentStep > 0 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'contacts',
      title: 'Contact Information',
      description: 'Key contacts for administration, billing, and technical support',
      icon: <User className="w-6 h-6" />,
      status: currentStep === 1 ? 'current' : currentStep > 1 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'services',
      title: 'Service Configuration',
      description: 'Configure energy services, customer segments, and operational parameters',
      icon: <Zap className="w-6 h-6" />,
      status: currentStep === 2 ? 'current' : currentStep > 2 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'datasources',
      title: 'Data Source Integration',
      description: 'Connect meter data, billing systems, and external data sources',
      icon: <Database className="w-6 h-6" />,
      status: currentStep === 3 ? 'current' : currentStep > 3 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'billing',
      title: 'Billing & Pricing',
      description: 'Configure billing model, pricing structure, and payment terms',
      icon: <DollarSign className="w-6 h-6" />,
      status: currentStep === 4 ? 'current' : currentStep > 4 ? 'completed' : 'pending',
      required: true
    },
    {
      id: 'review',
      title: 'Review & Submit',
      description: 'Review configuration and submit for provisioning',
      icon: <CheckCircle className="w-6 h-6" />,
      status: currentStep === 5 ? 'current' : currentStep > 5 ? 'completed' : 'pending',
      required: true
    }
  ];

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 0: // Company Information
        if (!companyInfo.companyName) newErrors.companyName = 'Company name is required';
        if (!companyInfo.legalName) newErrors.legalName = 'Legal name is required';
        if (!companyInfo.taxId) newErrors.taxId = 'Tax ID is required';
        if (!companyInfo.website) newErrors.website = 'Website is required';
        break;

      case 1: // Contact Information
        if (!contactInfo.primaryContact.firstName) newErrors.primaryFirstName = 'First name is required';
        if (!contactInfo.primaryContact.lastName) newErrors.primaryLastName = 'Last name is required';
        if (!contactInfo.primaryContact.email) newErrors.primaryEmail = 'Email is required';
        if (!contactInfo.primaryContact.phone) newErrors.primaryPhone = 'Phone is required';
        break;

      case 2: // Service Configuration
        if (serviceConfig.serviceTypes.length === 0) newErrors.serviceTypes = 'At least one service type is required';
        if (serviceConfig.customerSegments.length === 0) newErrors.customerSegments = 'At least one customer segment is required';
        if (serviceConfig.estimatedCustomers <= 0) newErrors.estimatedCustomers = 'Estimated customers must be greater than 0';
        break;

      case 3: // Data Sources
        if (!dataSourceConfig.meterDataSource) newErrors.meterDataSource = 'Meter data source is required';
        if (!dataSourceConfig.billingSystem) newErrors.billingSystem = 'Billing system is required';
        break;

      case 4: // Billing
        if (billingSetup.monthlyFee < 0) newErrors.monthlyFee = 'Monthly fee cannot be negative';
        if (billingSetup.contractTerm <= 0) newErrors.contractTerm = 'Contract term must be greater than 0';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;

    setIsLoading(true);
    try {
      // Simulate API call to create client
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Handle successful submission
      alert('Client onboarding submitted successfully!');
    } catch (error) {
      console.error('Error submitting onboarding:', error);
      alert('Error submitting onboarding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <CompanyInformationStep 
          data={companyInfo} 
          onChange={setCompanyInfo} 
          errors={errors}
        />;
      case 1:
        return <ContactInformationStep 
          data={contactInfo} 
          onChange={setContactInfo} 
          errors={errors}
        />;
      case 2:
        return <ServiceConfigurationStep 
          data={serviceConfig} 
          onChange={setServiceConfig} 
          errors={errors}
        />;
      case 3:
        return <DataSourceConfigurationStep 
          data={dataSourceConfig} 
          onChange={setDataSourceConfig} 
          errors={errors}
        />;
      case 4:
        return <BillingSetupStep 
          data={billingSetup} 
          onChange={setBillingSetup} 
          errors={errors}
        />;
      case 5:
        return <ReviewStep 
          companyInfo={companyInfo}
          contactInfo={contactInfo}
          serviceConfig={serviceConfig}
          dataSourceConfig={dataSourceConfig}
          billingSetup={billingSetup}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Client Onboarding
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Set up a new energy company client in the platform
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center">
                  <div className={`
                    w-12 h-12 rounded-full border-2 flex items-center justify-center
                    ${step.status === 'completed' 
                      ? 'bg-green-500 border-green-500 text-white' 
                      : step.status === 'current'
                      ? 'bg-purple-600 border-purple-600 text-white'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500'
                    }
                  `}>
                    {step.status === 'completed' ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      step.icon
                    )}
                  </div>
                  <div className="ml-4 hidden md:block">
                    <div className={`text-sm font-medium ${
                      step.status === 'current' 
                        ? 'text-purple-600 dark:text-purple-400' 
                        : step.status === 'completed'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {step.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {step.description}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="p-8">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="border-t border-gray-200 dark:border-gray-700 px-8 py-6 flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`
                flex items-center px-4 py-2 rounded-lg font-medium transition-colors
                ${currentStep === 0
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }
              `}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Submit for Provisioning
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual step components would be defined here...
// For brevity, I'll define the interfaces and basic structure

interface StepProps<T> {
  data: T;
  onChange: (data: T) => void;
  errors: Record<string, string>;
}

const CompanyInformationStep: React.FC<StepProps<CompanyInfo>> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Company Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={data.companyName}
            onChange={(e) => onChange({ ...data, companyName: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
              errors.companyName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="e.g., Florida Power & Light"
          />
          {errors.companyName && (
            <p className="mt-1 text-sm text-red-600">{errors.companyName}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Legal Name *
          </label>
          <input
            type="text"
            value={data.legalName}
            onChange={(e) => onChange({ ...data, legalName: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
              errors.legalName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="e.g., Florida Power & Light Company"
          />
          {errors.legalName && (
            <p className="mt-1 text-sm text-red-600">{errors.legalName}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Tax ID / EIN *
          </label>
          <input
            type="text"
            value={data.taxId}
            onChange={(e) => onChange({ ...data, taxId: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
              errors.taxId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="XX-XXXXXXX"
          />
          {errors.taxId && (
            <p className="mt-1 text-sm text-red-600">{errors.taxId}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Website *
          </label>
          <input
            type="url"
            value={data.website}
            onChange={(e) => onChange({ ...data, website: e.target.value })}
            className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
              errors.website ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="https://www.company.com"
          />
          {errors.website && (
            <p className="mt-1 text-sm text-red-600">{errors.website}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Industry Type
          </label>
          <select
            value={data.industry}
            onChange={(e) => onChange({ ...data, industry: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          >
            <option value="electric_utility">Electric Utility</option>
            <option value="gas_utility">Gas Utility</option>
            <option value="water_utility">Water Utility</option>
            <option value="renewable_energy">Renewable Energy</option>
            <option value="energy_services">Energy Services</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Company Size
          </label>
          <select
            value={data.companySize}
            onChange={(e) => onChange({ ...data, companySize: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          >
            <option value="">Select size...</option>
            <option value="small">Small (1-50 employees)</option>
            <option value="medium">Medium (51-200 employees)</option>
            <option value="large">Large (201-1000 employees)</option>
            <option value="enterprise">Enterprise (1000+ employees)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

const ContactInformationStep: React.FC<StepProps<ContactInfo>> = ({ data, onChange, errors }) => {
  const contacts = [
    {
      key: 'primaryContact',
      title: 'Primary Contact',
      description: 'Main point of contact for this account',
      contact: data.primaryContact
    },
    {
      key: 'billingContact', 
      title: 'Billing Contact',
      description: 'Contact for billing and payment matters',
      contact: data.billingContact
    },
    {
      key: 'technicalContact',
      title: 'Technical Contact', 
      description: 'Contact for technical support and integrations',
      contact: data.technicalContact
    }
  ];

  const updateContact = (contactKey: keyof ContactInfo, field: string, value: string) => {
    onChange({
      ...data,
      [contactKey]: {
        ...data[contactKey],
        [field]: value
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Contact Information</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Provide key contacts for different aspects of the engagement.
        </p>
      </div>

      {contacts.map(({ key, title, description, contact }) => (
        <div key={key} className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name *
              </label>
              <input
                type="text"
                value={contact.firstName}
                onChange={(e) => updateContact(key as keyof ContactInfo, 'firstName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors[`${key}.firstName`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="John"
              />
              {errors[`${key}.firstName`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`${key}.firstName`]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                value={contact.lastName}
                onChange={(e) => updateContact(key as keyof ContactInfo, 'lastName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors[`${key}.lastName`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Doe"
              />
              {errors[`${key}.lastName`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`${key}.lastName`]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={contact.title}
                onChange={(e) => updateContact(key as keyof ContactInfo, 'title', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors[`${key}.title`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Director of Operations"
              />
              {errors[`${key}.title`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`${key}.title`]}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={contact.email}
                onChange={(e) => updateContact(key as keyof ContactInfo, 'email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors[`${key}.email`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="john.doe@company.com"
              />
              {errors[`${key}.email`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`${key}.email`]}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone *
              </label>
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) => updateContact(key as keyof ContactInfo, 'phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors[`${key}.phone`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="+1 (555) 123-4567"
              />
              {errors[`${key}.phone`] && (
                <p className="mt-1 text-sm text-red-600">{errors[`${key}.phone`]}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ServiceConfigurationStep: React.FC<StepProps<ServiceConfiguration>> = ({ data, onChange, errors }) => {
  const serviceTypeOptions = [
    { value: 'electricity', label: 'Electricity Supply' },
    { value: 'gas', label: 'Natural Gas Supply' },
    { value: 'renewable', label: 'Renewable Energy' },
    { value: 'demand_response', label: 'Demand Response' },
    { value: 'energy_efficiency', label: 'Energy Efficiency' },
    { value: 'grid_services', label: 'Grid Services' }
  ];

  const customerSegmentOptions = [
    { value: 'residential', label: 'Residential' },
    { value: 'small_business', label: 'Small Business' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'municipal', label: 'Municipal' }
  ];

  const toggleServiceType = (value: string) => {
    const newServiceTypes = data.serviceTypes.includes(value)
      ? data.serviceTypes.filter(type => type !== value)
      : [...data.serviceTypes, value];
    onChange({ ...data, serviceTypes: newServiceTypes });
  };

  const toggleCustomerSegment = (value: string) => {
    const newSegments = data.customerSegments.includes(value)
      ? data.customerSegments.filter(segment => segment !== value)
      : [...data.customerSegments, value];
    onChange({ ...data, customerSegments: newSegments });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Service Configuration</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure the energy services and customer segments for your platform.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service Types */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Service Types</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select the energy services you provide to customers.
          </p>
          <div className="space-y-3">
            {serviceTypeOptions.map(option => (
              <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.serviceTypes.includes(option.value)}
                  onChange={() => toggleServiceType(option.value)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.serviceTypes && (
            <p className="mt-2 text-sm text-red-600">{errors.serviceTypes}</p>
          )}
        </div>

        {/* Customer Segments */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Segments</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select the customer segments you serve.
          </p>
          <div className="space-y-3">
            {customerSegmentOptions.map(option => (
              <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.customerSegments.includes(option.value)}
                  onChange={() => toggleCustomerSegment(option.value)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.customerSegments && (
            <p className="mt-2 text-sm text-red-600">{errors.customerSegments}</p>
          )}
        </div>
      </div>

      {/* Operational Parameters */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Operational Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Estimated Customer Count *
            </label>
            <input
              type="number"
              value={data.estimatedCustomers}
              onChange={(e) => onChange({ ...data, estimatedCustomers: parseInt(e.target.value) || 0 })}
              className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                errors.estimatedCustomers ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="10000"
              min="0"
            />
            {errors.estimatedCustomers && (
              <p className="mt-1 text-sm text-red-600">{errors.estimatedCustomers}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Go-Live Date *
            </label>
            <input
              type="date"
              value={data.goLiveDate}
              onChange={(e) => onChange({ ...data, goLiveDate: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                errors.goLiveDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.goLiveDate && (
              <p className="mt-1 text-sm text-red-600">{errors.goLiveDate}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Retention Period (days)
            </label>
            <select
              value={data.dataRetentionPeriod}
              onChange={(e) => onChange({ ...data, dataRetentionPeriod: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value={365}>1 Year</option>
              <option value={730}>2 Years</option>
              <option value={1095}>3 Years</option>
              <option value={1825}>5 Years</option>
              <option value={3650}>10 Years</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reporting Frequency
            </label>
            <select
              value={data.reportingFrequency}
              onChange={(e) => onChange({ ...data, reportingFrequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

const DataSourceConfigurationStep: React.FC<StepProps<DataSourceConfig>> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Source Integration</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your existing systems and data sources to enable comprehensive energy management.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Core Systems</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Meter Data Source *
              </label>
              <select
                value={data.meterDataSource}
                onChange={(e) => onChange({ ...data, meterDataSource: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors.meterDataSource ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">Select meter data source...</option>
                <option value="ami">Advanced Metering Infrastructure (AMI)</option>
                <option value="mdm">Meter Data Management (MDM)</option>
                <option value="scada">SCADA Systems</option>
                <option value="manual">Manual Data Entry</option>
                <option value="third_party">Third-party Provider</option>
              </select>
              {errors.meterDataSource && (
                <p className="mt-1 text-sm text-red-600">{errors.meterDataSource}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Billing System *
              </label>
              <select
                value={data.billingSystem}
                onChange={(e) => onChange({ ...data, billingSystem: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors.billingSystem ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">Select billing system...</option>
                <option value="sap">SAP Utilities</option>
                <option value="oracle">Oracle Utilities</option>
                <option value="milestone">Milestone Utility Services</option>
                <option value="gentrack">Gentrack</option>
                <option value="custom">Custom System</option>
              </select>
              {errors.billingSystem && (
                <p className="mt-1 text-sm text-red-600">{errors.billingSystem}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Customer Database *
              </label>
              <select
                value={data.customerDatabase}
                onChange={(e) => onChange({ ...data, customerDatabase: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors.customerDatabase ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">Select customer database...</option>
                <option value="crm">CRM System</option>
                <option value="erp">ERP System</option>
                <option value="dedicated">Dedicated Customer Database</option>
                <option value="legacy">Legacy System</option>
              </select>
              {errors.customerDatabase && (
                <p className="mt-1 text-sm text-red-600">{errors.customerDatabase}</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Enhanced Data Sources</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Geographic Data Source
              </label>
              <select
                value={data.geographicData}
                onChange={(e) => onChange({ ...data, geographicData: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select geographic data...</option>
                <option value="gis">GIS System</option>
                <option value="google_maps">Google Maps API</option>
                <option value="arcgis">ArcGIS</option>
                <option value="custom_mapping">Custom Mapping Solution</option>
              </select>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Optional Data Sources</h4>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.weatherData}
                  onChange={(e) => onChange({ ...data, weatherData: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Weather Data Integration</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.demandResponseData}
                  onChange={(e) => onChange({ ...data, demandResponseData: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Demand Response Data</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.solarProductionData}
                  onChange={(e) => onChange({ ...data, solarProductionData: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="text-gray-700 dark:text-gray-300">Solar Production Data</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BillingSetupStep: React.FC<StepProps<BillingSetup>> = ({ data, onChange, errors }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Pricing</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Configure your billing model, pricing structure, and contract terms.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing Model</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Billing Model *
              </label>
              <select
                value={data.billingModel}
                onChange={(e) => onChange({ ...data, billingModel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="subscription">Subscription-based</option>
                <option value="usage">Usage-based</option>
                <option value="hybrid">Hybrid Model</option>
                <option value="enterprise">Enterprise License</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Monthly Base Fee ($)
              </label>
              <input
                type="number"
                value={data.monthlyFee}
                onChange={(e) => onChange({ ...data, monthlyFee: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors.monthlyFee ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {errors.monthlyFee && (
                <p className="mt-1 text-sm text-red-600">{errors.monthlyFee}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Per Customer Fee ($)
              </label>
              <input
                type="number"
                value={data.perCustomerFee}
                onChange={(e) => onChange({ ...data, perCustomerFee: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors.perCustomerFee ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {errors.perCustomerFee && (
                <p className="mt-1 text-sm text-red-600">{errors.perCustomerFee}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contract Terms</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contract Term (months)
              </label>
              <select
                value={data.contractTerm}
                onChange={(e) => onChange({ ...data, contractTerm: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
                <option value={36}>36 months</option>
                <option value={60}>60 months</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invoice Frequency
              </label>
              <select
                value={data.invoiceFrequency}
                onChange={(e) => onChange({ ...data, invoiceFrequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annually">Annually</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Terms
              </label>
              <select
                value={data.paymentTerms}
                onChange={(e) => onChange({ ...data, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="net_15">Net 15 days</option>
                <option value="net_30">Net 30 days</option>
                <option value="net_45">Net 45 days</option>
                <option value="net_60">Net 60 days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Setup Fee ($)
              </label>
              <input
                type="number"
                value={data.setupFee}
                onChange={(e) => onChange({ ...data, setupFee: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-white ${
                  errors.setupFee ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
              {errors.setupFee && (
                <p className="mt-1 text-sm text-red-600">{errors.setupFee}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReviewStepProps {
  companyInfo: CompanyInfo;
  contactInfo: ContactInfo;
  serviceConfig: ServiceConfiguration;
  dataSourceConfig: DataSourceConfig;
  billingSetup: BillingSetup;
}

const ReviewStep: React.FC<ReviewStepProps> = ({ 
  companyInfo, 
  contactInfo, 
  serviceConfig, 
  dataSourceConfig, 
  billingSetup 
}) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review & Submit</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Please review all configuration details before submitting for provisioning.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Company Information Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            Company Information
          </h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Company Name:</span> {companyInfo.companyName}</div>
            <div><span className="font-medium">Legal Name:</span> {companyInfo.legalName}</div>
            <div><span className="font-medium">Tax ID:</span> {companyInfo.taxId}</div>
            <div><span className="font-medium">Website:</span> {companyInfo.website}</div>
            <div><span className="font-medium">Industry:</span> {companyInfo.industry}</div>
            <div><span className="font-medium">Company Size:</span> {companyInfo.companySize}</div>
          </div>
        </div>

        {/* Primary Contact Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Primary Contact
          </h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Name:</span> {contactInfo.primaryContact.firstName} {contactInfo.primaryContact.lastName}</div>
            <div><span className="font-medium">Title:</span> {contactInfo.primaryContact.title}</div>
            <div><span className="font-medium">Email:</span> {contactInfo.primaryContact.email}</div>
            <div><span className="font-medium">Phone:</span> {contactInfo.primaryContact.phone}</div>
          </div>
        </div>

        {/* Service Configuration Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2" />
            Service Configuration
          </h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Services:</span> {serviceConfig.serviceTypes.join(', ')}</div>
            <div><span className="font-medium">Customer Segments:</span> {serviceConfig.customerSegments.join(', ')}</div>
            <div><span className="font-medium">Estimated Customers:</span> {serviceConfig.estimatedCustomers.toLocaleString()}</div>
            <div><span className="font-medium">Go-Live Date:</span> {serviceConfig.goLiveDate}</div>
            <div><span className="font-medium">Data Retention:</span> {serviceConfig.dataRetentionPeriod} days</div>
            <div><span className="font-medium">Reporting:</span> {serviceConfig.reportingFrequency}</div>
          </div>
        </div>

        {/* Data Sources Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2" />
            Data Sources
          </h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Meter Data:</span> {dataSourceConfig.meterDataSource}</div>
            <div><span className="font-medium">Billing System:</span> {dataSourceConfig.billingSystem}</div>
            <div><span className="font-medium">Customer DB:</span> {dataSourceConfig.customerDatabase}</div>
            <div><span className="font-medium">Geographic Data:</span> {dataSourceConfig.geographicData || 'Not configured'}</div>
            <div className="pt-2">
              <span className="font-medium">Optional Sources:</span>
              <ul className="mt-1 space-y-1">
                {dataSourceConfig.weatherData && <li>• Weather Data</li>}
                {dataSourceConfig.demandResponseData && <li>• Demand Response Data</li>}
                {dataSourceConfig.solarProductionData && <li>• Solar Production Data</li>}
                {!dataSourceConfig.weatherData && !dataSourceConfig.demandResponseData && !dataSourceConfig.solarProductionData && <li>• None selected</li>}
              </ul>
            </div>
          </div>
        </div>

        {/* Billing Configuration Summary */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Billing & Pricing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-2">
              <div><span className="font-medium">Billing Model:</span> {billingSetup.billingModel}</div>
              <div><span className="font-medium">Monthly Fee:</span> ${billingSetup.monthlyFee.toFixed(2)}</div>
              <div><span className="font-medium">Per Customer Fee:</span> ${billingSetup.perCustomerFee.toFixed(2)}</div>
              <div><span className="font-medium">Setup Fee:</span> ${billingSetup.setupFee.toFixed(2)}</div>
            </div>
            <div className="space-y-2">
              <div><span className="font-medium">Contract Term:</span> {billingSetup.contractTerm} months</div>
              <div><span className="font-medium">Invoice Frequency:</span> {billingSetup.invoiceFrequency}</div>
              <div><span className="font-medium">Payment Terms:</span> {billingSetup.paymentTerms}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Important Notes</h4>
            <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• Client provisioning will begin immediately after submission</li>
              <li>• Data source integrations may require additional technical configuration</li>
              <li>• Billing will commence according to the selected terms</li>
              <li>• All configurations can be modified after onboarding is complete</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 