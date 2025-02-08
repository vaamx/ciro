# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Fixed HubSpot data fetching in `fetchHubSpotData` function
  - Added proper null checking for API responses
  - Added fallback to `objects` array if `results` is not present
  - Fixed total records calculation to handle different API response structures
  - Added more robust error handling for API responses
- Fixed TypeScript errors in AddDataSourceWizard
  - Removed unused imports
  - Simplified error handling by using connectionStatus instead of separate error states
  - Added proper typing for form data

### Removed
- Removed unused `AddDataSourceModal` component (~150 lines) from `DataSourcesView.tsx` as it was replaced by `AddDataSourceWizard`
  - Removed `AddDataSourceModalProps` interface
  - Removed `FormData` interface
  - Removed complete modal component with form fields
  - Removed modal actions

### Changed
- Modified `handleRefreshSource` function in `DataSourcesView.tsx` to use `fetchHubSpotData` instead of inline fetching
  - Removed ~50 lines of duplicate fetching logic
  - Improved code organization and reduced duplication
  - Fixed TypeScript warnings about unused declarations

### Added
- Created types file with comprehensive HubSpot interfaces
  - Added interfaces for Contacts, Companies, Deals, and Activities
  - Added proper typing for all HubSpot data properties
  - Added support for additional properties with index signatures 