import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the shape of our Studio context
interface StudioContextType {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  activeChartTemplateId: string | null;
  setActiveChartTemplateId: (id: string | null) => void;
  workspaceName: string | null;
  setWorkspaceName: (name: string | null) => void;
  workspaceDescription: string | null;
  setWorkspaceDescription: (description: string | null) => void;
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
}

// Create the context with default values
const StudioContext = createContext<StudioContextType>({
  activeWorkspaceId: null,
  setActiveWorkspaceId: () => {},
  activeChartTemplateId: null,
  setActiveChartTemplateId: () => {},
  workspaceName: null,
  setWorkspaceName: () => {},
  workspaceDescription: null,
  setWorkspaceDescription: () => {},
  isEditMode: false,
  setIsEditMode: () => {}
});

// Create a provider component
export const StudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeChartTemplateId, setActiveChartTemplateId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [workspaceDescription, setWorkspaceDescription] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  return (
    <StudioContext.Provider
      value={{
        activeWorkspaceId,
        setActiveWorkspaceId,
        activeChartTemplateId,
        setActiveChartTemplateId,
        workspaceName,
        setWorkspaceName,
        workspaceDescription,
        setWorkspaceDescription,
        isEditMode,
        setIsEditMode
      }}
    >
      {children}
    </StudioContext.Provider>
  );
};

// Custom hook to access the Studio context
export const useStudio = () => useContext(StudioContext);

export default StudioContext; 