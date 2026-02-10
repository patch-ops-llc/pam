# Design Guidelines: White-Label Project Management & Time Logging App

## Design Approach
**System-Based Approach**: Using Material Design principles for this productivity-focused application with data-dense interfaces and complex hierarchical relationships. The emphasis is on clarity, efficiency, and professional aesthetics suitable for business environments.

## Key Design Principles
- **Hierarchy First**: Clear visual hierarchy to navigate agency → account → project → task relationships
- **Efficiency Over Aesthetics**: Streamlined interfaces that prioritize quick data entry and retrieval
- **Professional Polish**: Clean, trustworthy design suitable for white-label deployment
- **Contextual Clarity**: Visual cues that help users understand their current location in the data hierarchy

## Core Design Elements

### A. Color Palette
**Light Mode:**
- Primary: 220 85% 35% (Professional blue)
- Secondary: 220 15% 65% (Neutral gray-blue)
- Background: 0 0% 98% (Off-white)
- Surface: 0 0% 100% (Pure white)
- Success: 142 76% 36% (Green for completed tasks)
- Warning: 38 92% 50% (Amber for time tracking alerts)

**Dark Mode:**
- Primary: 220 85% 65% (Lighter blue)
- Secondary: 220 15% 75% (Light gray-blue)
- Background: 220 15% 8% (Dark blue-gray)
- Surface: 220 15% 12% (Elevated dark surface)

### B. Typography
- **Primary Font**: Inter (Google Fonts) - excellent readability for data-heavy interfaces
- **Headings**: 600-700 weight
- **Body Text**: 400-500 weight
- **Data/Numbers**: 500 weight for emphasis
- **Scale**: 12px, 14px, 16px, 20px, 24px, 32px

### C. Layout System
**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16 (consistent 8px base grid)
- Dense information requires consistent, predictable spacing
- Form elements use 4-6 units for comfortable interaction
- Card spacing uses 6-8 units for clear separation

### D. Component Library

**Navigation:**
- Top navigation bar with agency/client switcher
- Sidebar navigation for main sections (Dashboard, Time Logging, Projects, Reports)
- Breadcrumb navigation for hierarchical context

**Data Entry:**
- Cascading dropdown system for time logging
- Inline editing for quick updates
- Form sections with clear visual grouping
- Real-time validation feedback

**Data Display:**
- Table-based layouts for time logs and project lists
- Card layouts for dashboard metrics
- Progress bars for billing targets
- Status indicators with consistent color coding

**Time Logging Interface:**
- Prominent "Start Timer" button
- Quick-entry modal with smart defaults
- Recent entries for rapid re-logging
- Dual time display (billed vs actual) with visual distinction

**White-Label Elements:**
- Customizable logo placement in header
- Brand color application to primary elements
- Configurable company name throughout interface

### E. Responsive Behavior
- **Desktop**: Multi-column layouts with sidebar navigation
- **Tablet**: Collapsible sidebar, maintained table layouts
- **Mobile**: Bottom navigation, simplified single-column forms, swipe gestures for time entries

## Critical UX Patterns

**Time Logging Flow:**
1. Agency selection → Account dropdown updates
2. Account selection → Project dropdown filters
3. Project selection → Task dropdown filters
4. One-click time entry with smart defaults

**Dashboard Hierarchy:**
- Agency-level overview with monthly targets
- Account-level project summaries
- Project-level task breakdowns
- Individual time entry details

**White-Label Customization:**
- Admin panel for brand configuration
- Live preview of changes
- Export/import of brand settings

This design system prioritizes functional clarity while maintaining professional aesthetics suitable for business environments and white-label deployment across various client brands.