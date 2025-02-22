/// <reference types="vite/client" />
/// <reference path="../../vite-env.d.ts" />

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Cloud, 
  BarChart2, 
  AlertCircle,
  CheckCircle,
  Loader2,
  HardDrive,
  FileText,
} from 'lucide-react';
import type { DataSource, DataSourceType, LocalFileMetadata, LocalFileType } from './types';
import { LocalFileUploader } from './LocalFileUploader';
import { StepIndicator } from '../StepIndicator';
import { OAUTH_CONFIGS } from './oauth-config';
import { generateState, openOAuthWindow } from './oauth-utils';

interface AddDataSourceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (dataSource: { 
    name: string;
    type: DataSourceType;
    status: 'connected';
    lastSync: Date;
    metadata?: LocalFileMetadata;
  }) => void;
}

interface DataSourceUIType {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  category: 'database' | 'crm' | 'storage' | 'analytics' | 'sap';
  logoUrl?: string;
  options?: {
    id: string;
    name: string;
    logoUrl: string;
    description: string;
  }[];
}

interface OAuthConfig {
  authUrl: string;
  clientId: string;
  scope: string;
  responseType: 'code' | 'token';
  additionalParams?: Record<string, string>;
}

interface FormData {
  name: string;
  type: DataSourceType;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  sslMode: string;
  description: string;
  oauthCode: string;
  connectionType: string;
  connectionError?: string;
  sourceId?: string;
  sourceCategory?: string;
  sourceOption?: string;
  fileMetadata?: LocalFileMetadata;
}

// Add file type icons as base64-encoded SVG data URLs
const FILE_TYPE_ICONS = {
  csv: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2MzY2RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PGxpbmUgeDE9IjgiIHkxPSIxMyIgeDI9IjE2IiB5Mj0iMTMiPjwvbGluZT48bGluZSB4MT0iOCIgeTE9IjE3IiB4Mj0iMTYiIHkyPSIxNyI+PC9saW5lPjxwb2x5bGluZSBwb2ludHM9IjEwIDkgOSA5IDggOSI+PC9wb2x5bGluZT48L3N2Zz4=',
  excel: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyMTk2NTMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTggMTJsMyAzLTMgMyI+PC9wYXRoPjxwYXRoIGQ9Ik0xNiAxMmwtMyAzIDMgMyI+PC9wYXRoPjwvc3ZnPg==',
  pdf: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNFRjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTkuNSAxNmE5LjUxIDkuNTEgMCAwIDEtMS41LS4xMiA5LjQ2IDkuNDYgMCAwIDEtMS40Mi0uMzUgOS41IDkuNSAwIDAgMS0xLjMtLjU3IDkuNDkgOS40OSAwIDAgMS0xLjEzLS43OCI+PC9wYXRoPjxwYXRoIGQ9Ik0xNi41IDE2YTkuNTEgOS41MSAwIDAgMCAxLjUtLjEyIDkuNDYgOS40NiAwIDAgMCAxLjQyLS4zNSA5LjUgOS41IDAgMCAwIDEuMy0uNTcgOS40OSA5LjQ5IDAgMCAwIDEuMTMtLjc4Ij48L3BhdGg+PC9zdmc+',
  json: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGNTlFMEIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ij48L3BhdGg+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiPjwvcG9seWxpbmU+PHBhdGggZD0iTTEwIDE1YTIgMiAwIDEgMCAwLTQgMiAyIDAgMCAwIDAgNHoiPjwvcGF0aD48cGF0aCBkPSJNMTQgMTNhMiAyIDAgMCAxIDIgMiI+PC9wYXRoPjwvc3ZnPg=='
};

const DATA_SOURCE_TYPES: DataSourceUIType[] = [
  {
    id: 'local-files',
    name: 'Local Files',
    icon: <FileText className="w-8 h-8" />,
    description: 'Upload and manage local files',
    category: 'storage',
    options: [
      {
        id: 'csv',
        name: 'CSV Files',
        logoUrl: FILE_TYPE_ICONS.csv,
        description: 'Upload and analyze CSV files'
      },
      {
        id: 'excel',
        name: 'Excel Files',
        logoUrl: FILE_TYPE_ICONS.excel,
        description: 'Upload and analyze Excel spreadsheets'
      },
      {
        id: 'pdf',
        name: 'PDF Files',
        logoUrl: FILE_TYPE_ICONS.pdf,
        description: 'Upload and view PDF documents'
      },
      {
        id: 'json',
        name: 'JSON Files',
        logoUrl: FILE_TYPE_ICONS.json,
        description: 'Upload and parse JSON data'
      }
    ]
  },
  {
    id: 'database',
    name: 'Databases',
    icon: <Database className="w-8 h-8" />,
    description: 'Connect to SQL or NoSQL databases',
    category: 'database',
    options: [
      {
        id: '***REMOVED***ql',
        name: 'PostgreSQL',
        logoUrl: 'https://www.***REMOVED***ql.org/media/img/about/press/elephant.png',
        description: 'Open source relational database'
      },
      {
        id: 'mysql',
        name: 'MySQL',
        logoUrl: 'https://labs.mysql.com/common/logos/mysql-logo.svg',
        description: 'Popular open source database'
      },
      {
        id: 'mongodb',
        name: 'MongoDB',
        logoUrl: 'https://www.mongodb.com/assets/images/global/leaf.png',
        description: 'NoSQL document database'
      },
      {
        id: 'snowflake',
        name: 'Snowflake',
        logoUrl: 'https://cdn.brandfetch.io/idJz-fGD_q/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEGdCLU4o5B',
        description: 'Cloud data warehouse platform'
      }
    ]
  },
  {
    id: 'crm',
    name: 'CRM Systems',
    icon: <Cloud className="w-8 h-8" />,
    description: 'Integrate with CRM platforms',
    category: 'crm',
    options: [
      {
        id: 'hubspot',
        name: 'HubSpot',
        logoUrl: 'https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png',
        description: 'All-in-one CRM platform'
      },
      {
        id: 'salesforce',
        name: 'Salesforce',
        logoUrl: 'https://www.salesforce.com/news/wp-content/uploads/sites/3/2021/05/Salesforce-logo.jpg',
        description: 'Enterprise CRM solution'
      },
      {
        id: 'zoho',
        name: 'Zoho',
        logoUrl: 'https://www.zoho.com/branding/images/zoho-logo-512px.png',
        description: 'Business software suite'
      },
      {
        id: 'pipedrive',
        name: 'Pipedrive',
        logoUrl: 'https://www.pipedrive.com/favicon.ico',
        description: 'Sales-focused CRM'
      }
    ]
  },
  {
    id: 'storage',
    name: 'Storage Systems',
    icon: <HardDrive className="w-8 h-8" />,
    description: 'Connect to file storage systems',
    category: 'storage',
    options: [
      {
        id: 'google-drive',
        name: 'Google Drive',
        logoUrl: 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
        description: 'Connect to Google Drive'
      },
      {
        id: 'dropbox',
        name: 'Dropbox',
        logoUrl: 'https://www.dropbox.com/static/30168/images/favicon.ico',
        description: 'Connect to Dropbox'
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        logoUrl: 'https://www.microsoft.com/favicon.ico',
        description: 'Connect to Microsoft OneDrive'
      }
    ]
  },
  {
    id: 'analytics',
    name: 'Analytics Tools',
    icon: <BarChart2 className="w-8 h-8" />,
    description: 'Connect to analytics platforms',
    category: 'analytics',
    options: [
      {
        id: 'google-analytics',
        name: 'Google Analytics',
        logoUrl: 'https://www.google.com/analytics/favicon.ico',
        description: 'Web analytics platform'
      },
      {
        id: 'mixpanel',
        name: 'Mixpanel',
        logoUrl: 'https://mixpanel.com/favicon.ico',
        description: 'Product analytics'
      },
      {
        id: 'amplitude',
        name: 'Amplitude',
        logoUrl: 'https://amplitude.com/favicon.ico',
        description: 'Product intelligence'
      },
      {
        id: 'segment',
        name: 'Segment',
        logoUrl: 'https://segment.com/favicon.ico',
        description: 'Customer data platform'
      }
    ]
  },
  {
    id: 'sap',
    name: 'SAP Systems',
    icon: <Database className="w-8 h-8" />,
    description: 'Connect to SAP enterprise systems',
    category: 'database',
    options: [
      {
        id: 'sap-ecc',
        name: 'SAP ECC',
        logoUrl: 'https://www.sap.com/favicon.ico',
        description: 'SAP ERP Central Component'
      },
      {
        id: 's4hana',
        name: 'SAP S/4HANA',
        logoUrl: 'https://www.sap.com/favicon.ico',
        description: 'Next-generation intelligent ERP'
      },
      {
        id: 'sap-bw',
        name: 'SAP BW',
        logoUrl: 'https://www.sap.com/favicon.ico',
        description: 'SAP Business Warehouse'
      },
      {
        id: 'sap-hana',
        name: 'SAP HANA',
        logoUrl: 'https://www.sap.com/favicon.ico',
        description: 'In-memory database platform'
      }
    ]
  }
];

const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  'crm-hubspot': {
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    clientId: import.meta.env.VITE_HUBSPOT_CLIENT_ID,
    scope: 'oauth',
    responseType: 'code',
    additionalParams: {
      redirect_uri: `${window.location.origin}/oauth/callback`,
      optional_scope: [
        'crm.objects.contacts.read',
        'crm.objects.contacts.write',
        'crm.objects.companies.read',
        'account-info.security.read',
        'accounting',
        'actions',
        'analytics.behavioral_events.send',
        'automation',
        'automation.sequences.enrollments.write',
        'automation.sequences.read',
        'behavioral_events.event_definitions.read_write',
        'business-intelligence',
        'business_units_view.read',
        'cms.domains.read',
        'cms.domains.write',
        'cms.functions.read',
        'cms.functions.write',
        'cms.knowledge_base.articles.publish',
        'cms.knowledge_base.articles.read',
        'cms.knowledge_base.articles.write',
        'cms.knowledge_base.settings.read',
        'cms.knowledge_base.settings.write',
        'cms.membership.access_groups.read',
        'cms.membership.access_groups.write',
        'cms.performance.read',
        'collector.graphql_query.execute',
        'collector.graphql_schema.read',
        'communication_preferences.read',
        'communication_preferences.read_write',
        'communication_preferences.statuses.batch.read',
        'communication_preferences.statuses.batch.write',
        'communication_preferences.write',
        'content',
        'conversations.custom_channels.read',
        'conversations.custom_channels.write',
        'conversations.read',
        'conversations.visitor_identification.tokens.create',
        'conversations.write',
        'crm.dealsplits.read_write',
        'crm.export',
        'crm.import',
        'crm.lists.read',
        'crm.lists.write',
        'crm.objects.appointments.read',
        'crm.objects.appointments.write',
        'crm.objects.carts.read',
        'crm.objects.carts.write',
        'crm.objects.commercepayments.read',
        'crm.objects.companies.write',
        'crm.objects.courses.read',
        'crm.objects.courses.write',
        'crm.objects.custom.read',
        'crm.objects.custom.write',
        'crm.objects.deals.read',
        'crm.objects.deals.write',
        'crm.objects.feedback_submissions.read',
        'crm.objects.goals.read',
        'crm.objects.invoices.read',
        'crm.objects.invoices.write',
        'crm.objects.leads.read',
        'crm.objects.leads.write',
        'crm.objects.line_items.read',
        'crm.objects.line_items.write',
        'crm.objects.listings.read',
        'crm.objects.listings.write',
        'crm.objects.marketing_events.read',
        'crm.objects.marketing_events.write',
        'crm.objects.orders.read',
        'crm.objects.orders.write',
        'crm.objects.owners.read',
        'crm.objects.partner-clients.read',
        'crm.objects.partner-clients.write',
        'crm.objects.quotes.read',
        'crm.objects.quotes.write',
        'crm.objects.services.read',
        'crm.objects.services.write',
        'crm.objects.subscriptions.read',
        'crm.objects.users.read',
        'crm.objects.users.write',
        'crm.pipelines.orders.read',
        'crm.pipelines.orders.write',
        'crm.schemas.appointments.read',
        'crm.schemas.appointments.write',
        'crm.schemas.carts.read',
        'crm.schemas.carts.write',
        'crm.schemas.commercepayments.read',
        'crm.schemas.companies.read',
        'crm.schemas.companies.write',
        'crm.schemas.contacts.write',
        'crm.schemas.courses.read',
        'crm.schemas.courses.write',
        'crm.schemas.custom.read',
        'crm.schemas.deals.read',
        'crm.schemas.deals.write',
        'crm.schemas.invoices.read',
        'crm.schemas.invoices.write',
        'crm.schemas.line_items.read',
        'crm.schemas.listings.read',
        'crm.schemas.listings.write',
        'crm.schemas.orders.read',
        'crm.schemas.orders.write',
        'crm.schemas.quotes.read',
        'crm.schemas.services.read',
        'crm.schemas.services.write',
        'crm.schemas.subscriptions.read',
        'ctas.read',
        'e-commerce',
        'external_integrations.forms.access',
        'files',
        'files.ui_hidden.read',
        'forms',
        'forms-uploaded-files',
        'hubdb',
        'integration-sync',
        'marketing-email',
        'marketing.campaigns.read',
        'marketing.campaigns.revenue.read',
        'marketing.campaigns.write',
        'media_bridge.read',
        'media_bridge.write',
        'sales-email-read',
        'scheduler.meetings.meeting-link.read',
        'settings.billing.write',
        'settings.currencies.read',
        'settings.currencies.write',
        'settings.security.security_health.read',
        'settings.users.read',
        'settings.users.teams.read',
        'settings.users.teams.write',
        'settings.users.write',
        'social',
        'tickets',
        'timeline',
        'transactional-email'
      ].join(' ')
    }
  },
  'crm-salesforce': {
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    clientId: import.meta.env.VITE_SALESFORCE_CLIENT_ID,
    scope: 'api refresh_token',
    responseType: 'code',
    additionalParams: {
      redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      prompt: 'consent'
    }
  },
  'crm-zoho': {
    authUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    clientId: import.meta.env.VITE_ZOHO_CLIENT_ID,
    scope: 'ZohoCRM.modules.ALL',
    responseType: 'code',
  },
  'storage-google-drive': {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    responseType: 'code',
    additionalParams: {
      redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
      access_type: 'offline',
      prompt: 'consent'
    }
  },
  'analytics-google-analytics': {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    responseType: 'code',
  }
};

const StepIndicator: React.FC<{ currentStep: number, totalSteps: number }> = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex items-center space-x-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <React.Fragment key={index}>
          <div
            className={`h-2 w-2 rounded-full ${
              index < currentStep
                ? 'bg-purple-600 dark:bg-purple-400'
                : index === currentStep
                ? 'bg-purple-400 dark:bg-purple-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
          {index < totalSteps - 1 && (
            <div
              className={`h-0.5 w-8 ${
                index < currentStep
                  ? 'bg-purple-600 dark:bg-purple-400'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const generateState = () => {
  return Math.random().toString(36).substring(7);
};

const openOAuthWindow = (url: string): Promise<{ code: string; state: string }> => {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const oauthWindow = window.open(
      url,
      'OAuth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!oauthWindow) {
      reject(new Error('Failed to open OAuth window. Please allow popups for this site.'));
      return;
    }

    let isResolved = false;
    const checkWindow = setInterval(() => {
      try {
        if (oauthWindow.closed) {
          clearInterval(checkWindow);
          if (!isResolved) {
            reject(new Error('OAuth window was closed before completion'));
          }
          return;
        }
      } catch (error) {
        // Cross-origin errors are expected while the oauth flow is in progress
      }
    }, 500);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'oauth-success') {
        if (!event.data.code || !event.data.state) {
          reject(new Error('Invalid OAuth response: missing code or state'));
          return;
        }

        isResolved = true;
        clearInterval(checkWindow);
        window.removeEventListener('message', handleMessage);
        resolve({ code: event.data.code, state: event.data.state });
      } else if (event.data.type === 'oauth-error') {
        isResolved = true;
        clearInterval(checkWindow);
        window.removeEventListener('message', handleMessage);
        reject(new Error(event.data.error || 'Unknown OAuth error'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Add timeout to prevent hanging
    setTimeout(() => {
      if (!isResolved) {
        clearInterval(checkWindow);
        window.removeEventListener('message', handleMessage);
        oauthWindow.close();
        reject(new Error('OAuth timeout - no response received'));
      }
    }, 300000); // 5 minute timeout
  });
};

// Add fallback icon as base64 data URL
const FALLBACK_ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHg9IjMiIHk9IjMiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgcng9IjIiIHJ5PSIyIj48L3JlY3Q+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiPjwvY2lyY2xlPjxwb2x5bGluZSBwb2ludHM9IjIxIDE1IDEwIDIxIDMgMTUiPjwvcG9seWxpbmU+PC9zdmc+';

export const AddDataSourceWizard: React.FC<AddDataSourceWizardProps> = ({ isOpen, onClose, onAdd }) => {
  const [step, setStep] = useState(0);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'custom' as DataSourceType,
    host: '',
    port: '',
    username: '',
    password: '',
    database: '',
    sslMode: 'require',
    description: '',
    oauthCode: '',
    connectionType: ''
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none');
  const [isConnecting, setIsConnecting] = useState(false);

  // Add event listener for OAuth messages
  useEffect(() => {
    let isHandlingOAuth = false;
    
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || isHandlingOAuth) {
        return;
      }

      if (event.data.type === 'oauth-success') {
        try {
          isHandlingOAuth = true;
          setConnectionStatus('none');
          
          setFormData(prev => ({
            ...prev,
            oauthCode: event.data.code,
            connectionType: 'oauth'
          }));
          
          await testConnection(event.data.provider);
        } catch (error) {
          console.error('Connection test failed:', error);
          setConnectionStatus('error');
        } finally {
          isHandlingOAuth = false;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleTypeSelect = async (type: string) => {
    setSelectedType(type);
    const [sourceType, sourceId] = type.split('-');
    
    // For local files, we want to show the uploader immediately
    if (sourceType === 'local-files') {
      setFormData({
        ...formData,
        type: 'local-files' as DataSourceType,
        sourceId,
        sourceCategory: sourceType,
        sourceOption: sourceId,
        connectionType: 'file',
        name: `New ${sourceId.toUpperCase()} File`
      });
      setStep(1);
      return;
    }

    // For OAuth-based services
    if (OAUTH_CONFIGS[`${sourceType}-${sourceId}`]) {
      setIsConnecting(true);
      try {
        const config = OAUTH_CONFIGS[`${sourceType}-${sourceId}`];
        const state = generateState();
        const params = new URLSearchParams({
          client_id: config.clientId,
          response_type: config.responseType,
          scope: config.scope,
          state,
          ...config.additionalParams
        });
        
        const authUrl = `${config.authUrl}?${params.toString()}`;
        const result = await openOAuthWindow(authUrl);
        
        if (result.state !== state) {
          throw new Error('OAuth state mismatch');
        }
        
        setFormData(prev => ({
          ...prev,
          type: sourceType as DataSourceType,
          sourceId,
          sourceCategory: sourceType,
          sourceOption: sourceId,
          oauthCode: result.code,
          connectionType: 'oauth'
        }));
      } catch (error) {
        console.error('OAuth error:', error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      // For other types, proceed with form-based configuration
      setFormData({
        ...formData,
        type: sourceType as DataSourceType,
        sourceId,
        sourceCategory: sourceType,
        sourceOption: sourceId
      });
    }
    setStep(1);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      setConnectionStatus('success');
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testConnection = async (provider: string) => {
    try {
      const response = await fetch(`/api/proxy/${provider}/crm/v3/objects/contacts?limit=1`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      
      if (data && (data.results?.length > 0 || data.records?.length > 0)) {
        setConnectionStatus('success');
        return true;
      } else {
        throw new Error('API returned successful response but no data was found');
      }
    } catch (error) {
      setConnectionStatus('error');
      if (error instanceof Error) {
        console.error('Connection test failed:', error.message);
      }
      throw error;
    }
  };

  const handleSubmit = () => {
    try {
      // For file uploads, we want to add the data source immediately after upload
      if (selectedType?.startsWith('local-files') && formData.fileMetadata) {
        onAdd({
          name: formData.name,
          type: formData.type,
          status: 'connected',
          lastSync: new Date(),
          metadata: formData.fileMetadata
        });
        onClose();
        return;
      }

      // For other types of data sources
      onAdd({
        name: formData.name,
        type: formData.type,
        status: 'connected',
        lastSync: new Date()
      });
      
      // Reset form state
      setStep(0);
      setSelectedType(null);
      setFormData({
        name: '',
        type: 'custom' as DataSourceType,
        host: '',
        port: '',
        username: '',
        password: '',
        database: '',
        sslMode: 'require',
        description: '',
        oauthCode: '',
        connectionType: ''
      });
      setConnectionStatus('none');
      setIsConnecting(false);
      onClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  // For file uploads, we want to submit automatically when the upload is complete
  const handleFileUploadComplete = (file: LocalFileMetadata) => {
    setFormData(prev => ({
      ...prev,
      fileMetadata: file,
      name: file.filename || prev.name
    }));
    handleSubmit();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setStep(0);
      setSelectedType(null);
      setFormData({
        name: '',
        type: 'custom' as DataSourceType,
        host: '',
        port: '',
        username: '',
        password: '',
        database: '',
        sslMode: 'require',
        description: '',
        oauthCode: '',
        connectionType: ''
      });
      setConnectionStatus('none');
      setIsConnecting(false);
    };
  }, []);

  const renderStep = () => {
    switch (step) {
      case 0:
        return renderTypeSelectionStep();
      case 1:
        // For local files, show the file upload UI
        if (selectedType?.startsWith('local-files')) {
          return renderFileUploadStep();
        }
        // For other types, show the connection step
        return renderConnectionStep();
      case 2:
        return renderConfigurationStep();
      default:
        return null;
    }
  };

  const renderTypeSelectionStep = () => {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Select Data Source Type
        </h3>
        <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 -mr-2">
          {DATA_SOURCE_TYPES.map(category => (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center space-x-3 sticky top-0 bg-white dark:bg-gray-800 py-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                  {category.icon}
                </div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {category.description}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {category.options?.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handleTypeSelect(`${category.id}-${option.id}`)}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 transition-colors group text-left flex items-start space-x-3"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-gray-900 p-1.5 flex items-center justify-center">
                      <img
                        src={option.logoUrl}
                        alt={option.name}
                        className="w-5 h-5 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_ICON;
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 truncate">
                        {option.name}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {option.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFileUploadStep = () => {
    const [sourceType, sourceId] = selectedType?.split('-') || [];
    const sourceCategory = DATA_SOURCE_TYPES.find(type => type.id === sourceType);
    const sourceOption = sourceCategory?.options?.find(opt => opt.id === sourceId);

    if (!sourceCategory || !sourceOption) return null;

    return (
      <div className="flex flex-col flex-1">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700">
            <img
              src={sourceOption.logoUrl}
              alt={sourceOption.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_ICON;
              }}
            />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Upload {sourceOption.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sourceOption.description}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              File Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder={`My ${sourceOption.name}`}
            />
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
              <LocalFileUploader
                fileType={sourceId as LocalFileType}
                onUploadComplete={handleFileUploadComplete}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConfigurationStep = () => {
    const [sourceType, sourceId] = selectedType?.split('-') || [];
    const sourceCategory = DATA_SOURCE_TYPES.find(type => type.id === sourceType);
    const sourceOption = sourceCategory?.options?.find(opt => opt.id === sourceId);

    if (!sourceCategory || !sourceOption) return null;

    // Show loading state during OAuth connection
    if (isConnecting) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
          <p className="text-gray-600 dark:text-gray-400">Connecting to {sourceOption.name}...</p>
        </div>
      );
    }

    // For file uploads, show the uploader immediately
    if (sourceType === 'local-files') {
      return (
        <div className="flex flex-col flex-1">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700">
              <img
                src={sourceOption.logoUrl}
                alt={sourceOption.name}
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.src = FALLBACK_ICON;
                }}
              />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upload {sourceOption.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sourceOption.description}
              </p>
            </div>
          </div>

          <div className="flex-1 flex flex-col space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder={`My ${sourceOption.name}`}
              />
            </div>

            <div className="flex-1 flex items-center justify-center">
              <div className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 hover:border-purple-500 dark:hover:border-purple-400 transition-colors">
                <LocalFileUploader
                  fileType={sourceId as LocalFileType}
                  onUploadComplete={handleFileUploadComplete}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // For other data sources (databases, CRM, etc.)
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4 mb-8">
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-900 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700">
            <img
              src={sourceOption.logoUrl}
              alt={sourceOption.name}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_ICON;
              }}
            />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configure {sourceOption.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sourceOption.description}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input-primary w-full"
              placeholder={`My ${sourceOption.name}`}
              required
            />
          </div>

          {sourceType === 'database' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                    className="input-primary"
                    placeholder="localhost"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    value={formData.port}
                    onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
                    className="input-primary"
                    placeholder={sourceId === '***REMOVED***ql' ? '5432' : sourceId === 'mysql' ? '3306' : '27017'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className="input-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="input-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Database Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => setFormData(prev => ({ ...prev, database: e.target.value }))}
                  className="input-primary"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="input-primary w-full"
              rows={3}
              placeholder="Describe the purpose of this connection"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderConnectionStep = () => {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Test Connection
        </h3>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Connection Details</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="text-sm text-gray-900 dark:text-white">{selectedType}</dd>
              </div>
              {selectedType === 'database' && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Host</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{formData.host}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-500 dark:text-gray-400">Database</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{formData.database}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          <div className="flex justify-center">
            {connectionStatus === 'none' ? (
              <button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600 flex items-center space-x-2"
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <span>Test Connection</span>
                  </>
                )}
              </button>
            ) : connectionStatus === 'success' ? (
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span>Connection successful!</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>Connection failed. Please check your settings.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  // Only show footer for non-file upload steps
  const shouldShowFooter = !selectedType?.startsWith('local-files');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl flex flex-col min-h-[500px] max-h-[90vh] relative">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-4">
            <StepIndicator currentStep={step} totalSteps={shouldShowFooter ? 3 : 2} />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto">
            {renderStep()}
          </div>

          {shouldShowFooter && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <button
                onClick={() => setStep(prev => prev - 1)}
                disabled={step === 0}
                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
              >
                Back
              </button>
              <div className="space-x-3">
                <button
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={step === 2 ? handleSubmit : () => setStep(prev => prev + 1)}
                  disabled={step === 1 && connectionStatus !== 'success'}
                  className="btn-primary dark:bg-purple-700 dark:hover:bg-purple-600"
                >
                  {step === 2 ? 'Add Data Source' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 