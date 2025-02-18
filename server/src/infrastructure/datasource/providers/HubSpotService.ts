import { DataSourceService } from '../DataSourceService';

interface HubSpotCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface HubSpotContact {
  id: string;
  properties: {
    [key: string]: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface HubSpotProperty {
  name: string;
  type: string;
  fieldType: string;
  required: boolean;
  description?: string;
  groupName: string;
}

interface HubSpotPropertiesResponse {
  results: HubSpotProperty[];
}

export class HubSpotService {
  private dataSourceService: DataSourceService;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.dataSourceService = new DataSourceService();
    this.clientId = process.env.HUBSPOT_CLIENT_ID || '';
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('HubSpot credentials not configured');
    }
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string): Promise<HubSpotCredentials> {
    console.log('Exchanging code for token with HubSpot...');
    
    const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: `${process.env.FRONTEND_URL}/oauth/callback`,
      code: code,
    });

    try {
      console.log('Making request to HubSpot OAuth endpoint:', {
        url: tokenUrl,
        client_id: this.clientId,
        redirect_uri: `${process.env.FRONTEND_URL}/oauth/callback`,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse HubSpot response:', responseText);
        throw new Error('Invalid response from HubSpot');
      }

      if (!response.ok) {
        console.error('HubSpot OAuth error response:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        });
        throw new Error(`HubSpot OAuth failed: ${responseData.message || response.statusText}`);
      }

      if (!responseData.access_token) {
        console.error('HubSpot response missing access token:', responseData);
        throw new Error('Invalid response: missing access token');
      }

      console.log('Successfully received token from HubSpot');
      
      return {
        accessToken: responseData.access_token,
        refreshToken: responseData.refresh_token,
        expiresAt: Date.now() + (responseData.expires_in * 1000),
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  // Create or update data source for a user
  async setupDataSource(
    userId: number,
    credentials: HubSpotCredentials
  ): Promise<void> {
    try {
      console.log('Setting up HubSpot data source for user:', userId);

      // Create or get existing data source
      let dataSource = await this.dataSourceService.createDataSource(
        userId,
        'hubspot',
        'HubSpot CRM',
        credentials,
        { lastSyncedContacts: null }
      );

      console.log('Data source created:', dataSource.id);

      // Fetch and store schema
      console.log('Fetching contact schema...');
      const schema = await this.fetchContactSchema(credentials.accessToken);
      console.log('Contact schema fetched, upserting fields...');
      await this.dataSourceService.upsertFields(dataSource.id, schema);

      // Initial sync
      console.log('Starting initial contact sync...');
      await this.syncContacts(dataSource.id, credentials.accessToken);
      console.log('Initial sync completed');
    } catch (error) {
      console.error('Error setting up data source:', error);
      throw error;
    }
  }

  // Fetch contact schema from HubSpot
  private async fetchContactSchema(
    accessToken: string
  ): Promise<Array<{ field_name: string; field_type: string; is_required: boolean; is_array: boolean; description?: string }>> {
    const response = await fetch(
      'https://api.hubapi.com/crm/v3/properties/contacts',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch contact properties');
    }

    const data = await response.json() as HubSpotPropertiesResponse;
    
    return data.results.map((prop: HubSpotProperty) => ({
      field_name: prop.name,
      field_type: this.mapHubSpotType(prop.type),
      is_required: prop.required,
      is_array: prop.fieldType === 'checkbox' || prop.fieldType === 'multiselect',
      description: prop.description,
      metadata: {
        hubspot_type: prop.type,
        hubspot_field_type: prop.fieldType,
        group_name: prop.groupName,
      },
    }));
  }

  // Map HubSpot types to our internal types
  private mapHubSpotType(hubspotType: string): string {
    const typeMap: { [key: string]: string } = {
      string: 'text',
      number: 'number',
      date: 'date',
      datetime: 'datetime',
      enumeration: 'enum',
      boolean: 'boolean',
    };

    return typeMap[hubspotType] || 'text';
  }

  // Sync contacts from HubSpot
  private async syncContacts(
    dataSourceId: number,
    accessToken: string
  ): Promise<void> {
    let after: string | undefined;
    
    do {
      const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
      if (after) {
        url.searchParams.append('after', after);
      }
      
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      
      // Transform and store contacts
      const records = data.results.map((contact: HubSpotContact) => ({
        external_id: contact.id,
        data: {
          ...contact.properties,
          hubspot_id: contact.id,
          hubspot_created_at: contact.createdAt,
          hubspot_updated_at: contact.updatedAt,
        },
      }));

      await this.dataSourceService.storeRecords(dataSourceId, records);

      after = data.paging?.next?.after;
    } while (after);

    // Update sync status
    await this.dataSourceService.updateStatus(dataSourceId, 'active');
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<HubSpotCredentials> {
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  }
} 