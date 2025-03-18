import { createOrganizationScopedContext } from './OrganizationScopedContext';
import { buildApiUrl } from '../api-config';

export interface Team {
  id: string;
  name: string;
  description?: string;
  organization_id: number;
  createdAt: string;
  updatedAt: string;
}

class TeamApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = '/api/teams';
  }

  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getItems(organizationId: number): Promise<Team[]> {
    try {
      const apiUrl = buildApiUrl(`/api/organizations/${organizationId}/teams`);
      const response = await fetch(apiUrl, {
        headers: this.getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }

      return response.json();
    } catch (error) {
      throw new Error('Failed to fetch teams');
    }
  }

  async createItem(team: Partial<Team>): Promise<Team> {
    const apiUrl = buildApiUrl(this.baseUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(team)
    });

    if (!response.ok) {
      throw new Error('Failed to create team');
    }

    return response.json();
  }

  async updateItem(id: string, team: Partial<Team>): Promise<Team> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}`);
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(team)
    });

    if (!response.ok) {
      throw new Error('Failed to update team');
    }

    return response.json();
  }

  async deleteItem(id: string): Promise<void> {
    const apiUrl = buildApiUrl(`${this.baseUrl}/${id}`);
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to delete team');
    }
  }
}

const teamApiService = new TeamApiService();
const { Provider: TeamProvider, useContext: useTeam } = createOrganizationScopedContext<Team>(
  teamApiService,
  'Team'
);

export { TeamProvider, useTeam }; 