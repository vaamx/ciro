import { useState, useEffect, useCallback } from 'react';
import { 
  clientAPI, 
  Client, 
  ClientFilters, 
  ClientListResponse, 
  ClientStats,
  CreateClientRequest,
  UpdateClientRequest 
} from '../services/clientAPI';

export interface UseClientsState {
  clients: Client[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  stats: ClientStats | null;
}

export interface UseClientsActions {
  fetchClients: (filters?: ClientFilters) => Promise<void>;
  searchClients: (query: string, filters?: ClientFilters) => Promise<void>;
  createClient: (clientData: CreateClientRequest) => Promise<Client>;
  updateClient: (clientData: UpdateClientRequest) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  updateClientStatus: (id: string, status: 'active' | 'inactive' | 'pending') => Promise<Client>;
  fetchClientStats: () => Promise<void>;
  refreshClients: () => Promise<void>;
}

export function useClients(initialFilters?: ClientFilters): UseClientsState & UseClientsActions {
  const [state, setState] = useState<UseClientsState>({
    clients: [],
    loading: false,
    error: null,
    total: 0,
    page: 1,
    totalPages: 0,
    stats: null
  });

  const [currentFilters, setCurrentFilters] = useState<ClientFilters>(initialFilters || {});

  const fetchClients = useCallback(async (filters: ClientFilters = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const mergedFilters = { ...currentFilters, ...filters };
      setCurrentFilters(mergedFilters);
      
      const response: ClientListResponse = await clientAPI.getClients(mergedFilters);
      
      setState(prev => ({
        ...prev,
        clients: response.clients,
        total: response.total,
        page: response.page,
        totalPages: response.totalPages,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch clients',
        loading: false
      }));
    }
  }, [currentFilters]);

  const searchClients = useCallback(async (query: string, filters: ClientFilters = {}) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const mergedFilters = { ...currentFilters, ...filters };
      const response: ClientListResponse = await clientAPI.searchClients(query, mergedFilters);
      
      setState(prev => ({
        ...prev,
        clients: response.clients,
        total: response.total,
        page: response.page,
        totalPages: response.totalPages,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to search clients',
        loading: false
      }));
    }
  }, [currentFilters]);

  const createClient = useCallback(async (clientData: CreateClientRequest): Promise<Client> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const newClient = await clientAPI.createClient(clientData);
      
      // Add the new client to the list
      setState(prev => ({
        ...prev,
        clients: [newClient, ...prev.clients],
        total: prev.total + 1
      }));
      
      return newClient;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create client';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const updateClient = useCallback(async (clientData: UpdateClientRequest): Promise<Client> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const updatedClient = await clientAPI.updateClient(clientData);
      
      // Update the client in the list
      setState(prev => ({
        ...prev,
        clients: prev.clients.map(client => 
          client.id === updatedClient.id ? updatedClient : client
        )
      }));
      
      return updatedClient;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update client';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const deleteClient = useCallback(async (id: string): Promise<void> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      await clientAPI.deleteClient(id);
      
      // Remove the client from the list
      setState(prev => ({
        ...prev,
        clients: prev.clients.filter(client => client.id !== id),
        total: prev.total - 1
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete client';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const updateClientStatus = useCallback(async (id: string, status: 'active' | 'inactive' | 'pending'): Promise<Client> => {
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const updatedClient = await clientAPI.updateClientStatus(id, status);
      
      // Update the client in the list
      setState(prev => ({
        ...prev,
        clients: prev.clients.map(client => 
          client.id === updatedClient.id ? updatedClient : client
        )
      }));
      
      return updatedClient;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update client status';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const fetchClientStats = useCallback(async () => {
    try {
      const stats = await clientAPI.getClientStats();
      setState(prev => ({ ...prev, stats }));
    } catch (error) {
      console.error('Failed to fetch client stats:', error);
      // Don't set error state for stats failure
    }
  }, []);

  const refreshClients = useCallback(async () => {
    await fetchClients(currentFilters);
  }, [fetchClients, currentFilters]);

  // Initial load
  useEffect(() => {
    fetchClients();
    fetchClientStats();
  }, []);

  return {
    ...state,
    fetchClients,
    searchClients,
    createClient,
    updateClient,
    deleteClient,
    updateClientStatus,
    fetchClientStats,
    refreshClients
  };
} 