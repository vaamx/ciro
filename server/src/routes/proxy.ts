import express from 'express';
import axios from 'axios';
import { attachTokens } from './oauth';

const router = express.Router();

// HubSpot API proxy
router.get('/hubspot/*', attachTokens, async (req: express.Request, res: express.Response) => {
  try {
    const path = req.params[0];
    const tokens = (req as any).tokens;
    
    console.log('Proxying request to HubSpot:', {
      path,
      hasToken: !!tokens.access_token
    });

    // Handle different HubSpot endpoints
    let url = `https://api.hubapi.com/${path}`;
    
    // For contacts, fetch with all important properties
    if (path === 'crm/v3/objects/contacts') {
      const properties = [
        'firstname',
        'lastname',
        'email',
        'phone',
        'company',
        'website',
        'address',
        'city',
        'state',
        'zip',
        'country',
        'jobtitle',
        'lifecyclestage',
        'lastmodifieddate',
        'createdate'
      ];
      
      url += `?limit=100&properties=${properties.join(',')}`;
    }
    // For activities feed
    else if (path === 'crm/v3/objects/activities/feed') {
      // Preserve existing query parameters if any
      const queryParams = new URLSearchParams(req.query as any);
      if (!queryParams.has('limit')) {
        queryParams.set('limit', '100');
      }
      url += `?${queryParams.toString()}`;
    }
    // For companies
    else if (path === 'crm/v3/objects/companies') {
      const properties = [
        'name',
        'domain',
        'industry',
        'phone',
        'address',
        'city',
        'state',
        'zip',
        'country',
        'website',
        'numberofemployees',
        'annualrevenue',
        'lifecyclestage',
        'lastmodifieddate',
        'createdate'
      ];
      
      url += `?limit=100&properties=${properties.join(',')}`;
    }
    
    // For deals
    else if (path === 'crm/v3/objects/deals') {
      const properties = [
        'dealname',
        'amount',
        'pipeline',
        'dealstage',
        'closedate',
        'createdate',
        'lastmodifieddate'
      ];
      
      url += `?limit=100&properties=${properties.join(',')}`;
    }

    console.log('Making request to:', url);
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    // Add metadata about the results
    const total = response.data.total || response.data.results?.length || 0;
    const count = response.data.results?.length || 0;
    
    const responseData = {
      ...response.data,
      _metadata: {
        total,
        count,
        hasMore: response.data.paging?.next ? true : false,
        objectType: path.split('/').pop(),
        timestamp: new Date().toISOString()
      },
      records: response.data.results || []
    };

    console.log('HubSpot API response:', {
      status: response.status,
      metadata: responseData._metadata,
      recordCount: responseData.records.length
    });

    res.json(responseData);
  } catch (error: any) {
    console.error('HubSpot proxy error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Failed to proxy request', details: error.message });
    }
  }
});

// Add more provider-specific proxy routes here
// Example: Salesforce, Google Drive, etc.

export const proxyRouter = router; 