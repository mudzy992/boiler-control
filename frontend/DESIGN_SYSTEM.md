# Frontend Design System

## Color Palette

### Light Mode
- **Background**: `#f6f7fb` (body), `#ffffff` (surfaces/cards)
- **Surface Secondary**: `#f3f4f6` (gray-100)
- **Border**: `#e5e7eb` (gray-300)
- **Text Primary**: `#111827` (gray-900)
- **Text Secondary**: `#6b7280` (gray-600)
- **Text Tertiary**: `#9ca3af` (gray-400)

### Dark Mode
- **Background**: `#0b0f1a` (body)
- **Surface**: `#1e293b` (slate-800)
- **Surface Secondary**: `#0f172a` (slate-900)
- **Border**: `#334155` (slate-700)
- **Text Primary**: `#e5e7eb` (gray-200)
- **Text Secondary**: `#cbd5e1` (slate-400)
- **Text Tertiary**: `#64748b` (slate-500)

### Semantic Colors
- **Success**: `#10b981` (emerald-500)
- **Success Light**: `#ecfdf5` (light), `#064e3b` (dark)
- **Warning**: `#f59e0b` (amber-500)
- **Warning Light**: `#fffbeb` (light), `#78350f` (dark)
- **Error**: `#ef4444` (red-500)
- **Error Light**: `#fef2f2` (light), `#7f1d1d` (dark)
- **Info**: `#3b82f6` (blue-500)
- **Info Light**: `#eff6ff` (light), `#1e3a8a` (dark)

## Typography

### Font Family
- System Font Stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`

### Font Sizes & Weights
- **Display**: 32px, 700 weight (headings)
- **H1**: 28px, 700 weight (page title)
- **H2**: 24px, 700 weight (section title)
- **H3**: 20px, 700 weight (subsection)
- **Body Large**: 16px, 400 weight (main content)
- **Body**: 14px, 400 weight (default)
- **Small**: 12px, 400 weight (hints, metadata)
- **Label**: 12px, 600 weight (form labels, tags)

## Spacing Scale (in px)
```
xs: 4    (1 unit)
sm: 8    (2 units)
md: 12   (3 units)
lg: 16   (4 units)
xl: 24   (6 units)
2xl: 32  (8 units)
3xl: 48  (12 units)
```

## Border Radius
- **Small**: 6px (buttons, inputs, small cards)
- **Medium**: 8px (cards, modals)
- **Large**: 12px (large sections)

## Shadows
- **None**: No shadow (flat design preference)
- **Subtle**: `box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)` (sm)
- **Small**: `box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1)` (base)
- **Medium**: `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1)` (md)

## Component Patterns

### Cards
- Background: white (light), slate-800 (dark)
- Border: 1px gray-200 (light), slate-700 (dark)
- Border Radius: 8px
- Padding: 16px (default), 12px (compact), 24px (spacious)
- Shadow: subtle (0 1px 2px)

### Buttons
- Primary: blue-600 background, white text
- Primary Hover: blue-700
- Secondary: gray-100 background, gray-700 text (light), slate-700 background, slate-300 text (dark)
- Destructive: red-600 background, white text
- Border Radius: 6px
- Padding: 8px 16px (md), 6px 12px (sm)
- Font Weight: 500

### Form Inputs
- Border: 1px gray-300 (light), slate-700 (dark)
- Background: white (light), slate-900 (dark)
- Padding: 8px 12px
- Border Radius: 6px
- Focus: border-blue-500, outline: 2px blue-500 with 2px offset

### Tables (Ant Design)
- Header Background: gray-50 (light), slate-900 (dark)
- Row Background: white (light), slate-800 (dark)
- Striped Rows: gray-50 (light), slate-800/50 (dark)
- Border: 1px gray-300 (light), slate-700 (dark)

### Modals (Ant Design)
- Background: white (light), slate-800 (dark)
- Overlay: rgba(0, 0, 0, 0.45)
- Border Radius: 8px
- Close Icon: gray-500 (light), slate-400 (dark)

## Responsive Breakpoints
- **Mobile**: 320px - 768px
  - 1 column layout
  - Collapsible navigation
  - Reduced padding (12px)
  - Smaller fonts (14px headings)
  - Full-width components

- **Tablet**: 768px - 1024px
  - 2 column layout for cards
  - Sidebar visible
  - Standard padding (16px)
  - Standard fonts

- **Desktop**: 1024px - 1440px
  - 3 column layout for cards/grids
  - Full sidebar
  - Standard padding (16px)
  - Standard fonts

- **Large Desktop**: 1440px+
  - 4+ column layout for cards/grids
  - Full sidebar
  - Generous padding (24px)
  - Larger fonts

## Layout Patterns

### Page Structure
```
Header (MainLayout - top bar with nav)
  |
Sidebar (collapsible on mobile)
  |
Main Content
  |
  ├─ Page Header (title + description)
  ├─ Toolbar (filters, actions)
  ├─ Content Grid/List
  │  ├─ Card / Table / Custom Content
  │  └─ Pagination (if needed)
  └─ Footer (if applicable)
```

### Content Spacing
- Page padding: 16px (mobile), 24px (tablet+)
- Section gap: 24px
- Card gap: 16px
- Component gap: 12px
- Text gap: 8px

### Grid System
- Mobile: 1 column (100% width - 32px padding)
- Tablet: 2 columns (50% each - 8px gap)
- Desktop: 3-4 columns depending on content
- Max width: 1400px for large screens

## Gas Features Specific Patterns

### Gas Readings Page
- Page title: 28px, 700, gray-900 (dark: white)
- Toolbar: flex row, gap-3 mobile → gap-2 desktop, wrap on sm
- Cards: Full width mobile, 1-col layout, consistent 16px gap
- Buttons: Responsive sizing (full-width sm → inline md+)

### Gas Analytics Page
- Period selector: Flex wrap on mobile, inline buttons
- Stats grid: 1-col (mobile), 2-col (tablet), 4-col (desktop)
- Charts/content: Full-width responsive
- Legend: Wrap on mobile, inline on desktop

### Forms (Add Reading Modal)
- Input fields: Full-width on mobile
- Date/time pickers: Responsive sizing
- Buttons: Full-width CTA on mobile, inline on desktop
- Error messages: Inline, consistent styling

## Dark Mode Implementation
- Use Tailwind `dark:` prefix throughout
- Apply to:
  - Backgrounds (`dark:bg-slate-800`, `dark:bg-slate-900`)
  - Text (`dark:text-white`, `dark:text-slate-400`)
  - Borders (`dark:border-slate-700`)
  - Components (`dark:hover:bg-slate-700`)
- Ant Design theme auto-adapts via theme context
- No hardcoded colors - always use Tailwind utilities

## Accessibility
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Focus states: Visible outlines on all interactive elements
- Semantic HTML: Use proper heading hierarchy, form labels, etc.
- ARIA labels: Add where needed for screen readers
- Color not the only indicator: Use icons, text, status indicators

## Common Component Classes (Tailwind)

### Light/Dark Card
```
className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
```

### Light/Dark Button (Primary)
```
className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
```

### Light/Dark Button (Secondary)
```
className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
```

### Light/Dark Text (Primary)
```
className="text-gray-900 dark:text-white"
```

### Light/Dark Text (Secondary)
```
className="text-gray-600 dark:text-slate-400"
```

### Responsive Container
```
className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
```

## Tailwind Configuration
- Dark mode: `class` (manual toggle)
- No custom theme extension (use defaults)
- Core plugins: All enabled except `preflight` (disabled for Ant Design compatibility)
- Content: `["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`
