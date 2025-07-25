# Transform-Based Card Stack Refactoring Guide

## 🎯 **Objective**

Refactor the left column card navigation from complex multi-state animation to a simple, robust transform-based approach while maintaining all existing functionality.

## 📋 **Current Functionality Checklist** (Must Preserve)

### ✅ **Visual Behavior**

- [ ] Cards stack like physical papers (headers visible at top/bottom)
- [ ] Active card shows full content, inactive cards show only headers
- [ ] Smooth "paper pulling" animation when switching sections
- [ ] Reverse animation effect (card sliding down behind headers)
- [ ] Proper z-index layering (higher cards appear on top)

### ✅ **Interactions**

- [ ] Click any header to navigate to that section
- [ ] Mouse wheel scroll to navigate up/down through sections
- [ ] Gallery image thumbnails sync with main content
- [ ] Main content changes based on left column selection

### ✅ **States & Data**

- [ ] 5 sections: Overview, Token Details, Product Manifesto, Place Bids, Chats
- [ ] Image selection state coordination between columns
- [ ] Proper section content rendering for each card

---

## 🏗️ **PHASE 1: ANALYSIS & PRESERVATION**

### Current Problems to Solve:

```jsx
// ❌ Complex state management
const [activeSection, setActiveSection] = useState(0);
const [isAnimating, setIsAnimating] = useState(false);
const [previousActiveSection, setPreviousActiveSection] = useState(null);
const [animationDirection, setAnimationDirection] = useState('up' | 'down');

// ❌ Complex visibility logic
const shouldShowContent = isActive ||
  (isReverseAnimation && isAnimating && index === previousActiveSection);

// ❌ Timing-dependent state
setTimeout(() => setIsAnimating(false), 1500);

// ❌ Complex positioning calculations
const getCardPosition = (cardIndex: number) => { /* complex math */ };
```

### Architecture Issues:

1. **State Complexity**: 4 interdependent state variables
2. **Race Conditions**: setTimeout + multiple state updates
3. **Performance**: 5 absolute positioned elements animating
4. **Memory**: All content components stay mounted
5. **Maintainability**: Logic spread across multiple functions

---

## 🎨 **PHASE 2: NEW ARCHITECTURE DESIGN**

### ✅ **Transform-Based Solution**

#### Core Concept:

```jsx
// ✅ Single state, single transform
const [activeSection, setActiveSection] = useState(0);

<div
  className="card-stack-container"
  style={{
    transform: `translateY(-${activeSection * CARD_HEIGHT}px)`,
    transition: 'transform 1s cubic-bezier(0.23, 1, 0.32, 1)',
  }}
>
  {sections.map((section, index) => (
    <Card key={section.id} index={index} />
  ))}
</div>;
```

#### Component Structure:

```
LeftColumnNavigation
├── CardStackContainer (transform wrapper)
│   ├── Card (index: 0) - Overview
│   ├── Card (index: 1) - Token Details
│   ├── Card (index: 2) - Product Manifesto
│   ├── Card (index: 3) - Place Bids
│   └── Card (index: 4) - Chats
└── ScrollHandler (wheel events)
```

#### Benefits:

- **Single State**: Only `activeSection` needed
- **GPU Accelerated**: Browser optimizes `transform`
- **Predictable**: No race conditions
- **Performant**: One element animating
- **Simple**: Easy to understand and maintain

---

## 🔧 **PHASE 3: IMPLEMENTATION STEPS**

### Step 3.1: Basic Stack Structure

```jsx
// New simplified component structure
function LeftColumnNavigation({ activeSection, onSectionChange, ... }) {
  const HEADER_HEIGHT = 64;
  const CONTENT_HEIGHT = 400;
  const CARD_HEIGHT = HEADER_HEIGHT + CONTENT_HEIGHT;

  return (
    <div className="h-full overflow-hidden relative">
      <div
        className="card-stack"
        style={{
          transform: `translateY(-${activeSection * CARD_HEIGHT}px)`,
          transition: 'transform 1s cubic-bezier(0.23, 1, 0.32, 1)'
        }}
      >
        {sections.map((section, index) => (
          <Card
            key={section.id}
            section={section}
            index={index}
            isActive={index === activeSection}
            onSectionChange={onSectionChange}
          />
        ))}
      </div>
    </div>
  );
}
```

### Step 3.2: Individual Card Component

```jsx
function Card({ section, index, isActive, onSectionChange }) {
  return (
    <div
      className="card"
      style={{
        height: `${HEADER_HEIGHT + (isActive ? CONTENT_HEIGHT : 0)}px`,
        zIndex: index * 5, // Fixed z-index: 0,5,10,15,20
      }}
    >
      {/* Header */}
      <div className="card-header" onClick={() => onSectionChange(index)}>
        {section.label}
      </div>

      {/* Content */}
      {isActive && (
        <div className="card-content">
          <ActiveSectionContent sectionIndex={index} />
        </div>
      )}
    </div>
  );
}
```

### Step 3.3: Interaction Handlers

```jsx
// Simplified scroll handler
const handleWheel = useCallback((e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY;

  if (delta > 0 && activeSection < sections.length - 1) {
    onSectionChange(activeSection + 1);
  } else if (delta < 0 && activeSection > 0) {
    onSectionChange(activeSection - 1);
  }
}, [activeSection, onSectionChange]);
```

---

## 🎭 **PHASE 4: ANIMATIONS & POLISH**

### Step 4.1: Smooth Transitions

```css
/* Optimized CSS transitions */
.card-stack {
  will-change: transform;
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

.card {
  will-change: height;
  transition: height 1s cubic-bezier(0.23, 1, 0.32, 1);
}
```

### Step 4.2: Content Animation

```jsx
// Stagger content appearance for polish
<AnimatePresence mode="wait">
  {isActive && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <ActiveSectionContent />
    </motion.div>
  )}
</AnimatePresence>
```

---

## 🚀 **PHASE 5: PERFORMANCE & ACCESSIBILITY**

### Step 5.1: Performance Optimizations

```jsx
// Virtualization for large lists
const visibleRange = useMemo(() => {
  const start = Math.max(0, activeSection - 1);
  const end = Math.min(sections.length, activeSection + 2);
  return [start, end];
}, [activeSection]);

// Only render visible cards + buffer
{
  sections.slice(visibleRange[0], visibleRange[1]).map(/* ... */);
}
```

### Step 5.2: Accessibility

```jsx
// Keyboard navigation
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'ArrowUp' && activeSection > 0) {
    onSectionChange(activeSection - 1);
  } else if (e.key === 'ArrowDown' && activeSection < sections.length - 1) {
    onSectionChange(activeSection + 1);
  }
}, [activeSection, onSectionChange]);

// ARIA attributes
<div
  role="tablist"
  aria-label="Navigation sections"
  onKeyDown={handleKeyDown}
>
  <div
    role="tab"
    aria-selected={isActive}
    tabIndex={isActive ? 0 : -1}
  >
```

---

## ✅ **PHASE 6: TESTING CHECKLIST**

### Functional Tests:

- [ ] All 5 sections accessible via click
- [ ] Mouse wheel navigation works both directions
- [ ] Keyboard navigation (arrow keys) works
- [ ] Image gallery sync works correctly
- [ ] Main content updates match left column selection
- [ ] Animation timing feels natural (1s duration)
- [ ] No visual glitches or flashing
- [ ] Proper z-index layering maintained

### Performance Tests:

- [ ] Smooth 60fps animations
- [ ] No layout thrashing in dev tools
- [ ] Memory usage stable (no leaks)
- [ ] Works on mobile devices
- [ ] Handles rapid section switching gracefully

### Edge Case Tests:

- [ ] Rapid clicking doesn't break state
- [ ] Wheel events during animation don't conflict
- [ ] Resize browser window doesn't break layout
- [ ] Content loading states handled gracefully

---

## 🔄 **MIGRATION STRATEGY**

### Phase-by-Phase Implementation:

1. ✅ **Analyze** - Document current behavior (Phase 1)
2. ✅ **Prototype** - Build basic transform version (Phase 3.1)
3. ✅ **Feature Parity** - Match all current functionality (Phase 3.2-3.3)
4. ✅ **Polish** - Add animations and improvements (Phase 4)
5. ✅ **Optimize** - Performance and accessibility (Phase 5)
6. ✅ **Test** - Comprehensive validation (Phase 6)
7. ✅ **Deploy** - Replace existing implementation
8. ✅ **Restructure** - Extract components to separate files (Phase 8)

### **TWO-PHASE APPROACH** (Risk Mitigation):

#### **PHASE A: TRANSFORM REFACTORING** (Phases 1-7)

**Focus**: Fix animation architecture while keeping same file structure

- ✅ Keep all components in `rwa/page.tsx` during transform refactoring
- ✅ Minimize risk by changing only animation/state logic
- ✅ Easier debugging - know that issues come from animation changes
- ✅ Clean rollback possible

#### **PHASE B: FILE STRUCTURE REFACTORING** (Phase 8)

**Focus**: Extract components after transform is stable

- ✅ Move from 618-line file to proper component structure
- ✅ Only start after transform refactoring is fully tested
- ✅ Separate concern from animation logic

### Rollback Plan:

- Keep current implementation in git branch
- Feature flag new implementation
- A/B test if needed
- Quick rollback if issues found

---

## 📁 **PHASE 8: FILE STRUCTURE REFACTORING**

### Current Issues:

```
❌ apps/frontend/src/app/rwa/page.tsx (618 lines!)
├── RWAPage (main component)
├── LeftColumnNavigation (100+ lines)
├── ActiveSectionContent (100+ lines)
└── MiddleContentArea (100+ lines)
```

### Target Structure:

```
✅ apps/frontend/src/app/rwa/
├── page.tsx (main page, ~50 lines)
├── components/
│   ├── left-column/
│   │   ├── left-column-navigation.tsx
│   │   ├── card.tsx (transform-based card)
│   │   └── active-section-content.tsx
│   ├── middle-column/
│   │   └── middle-content-area.tsx
│   └── sections/
│       ├── overview-content.tsx
│       ├── token-details-content.tsx
│       ├── manifesto-content.tsx
│       ├── place-bids-content.tsx
│       └── chats-content.tsx
├── hooks/
│   └── use-section-navigation.ts
└── types/
    └── section.types.ts
```

### Step 8.1: Extract Type Definitions

```typescript
// types/section.types.ts
export interface Section {
  id: string;
  label: string;
}

export interface SectionNavigationProps {
  sections: Section[];
  activeSection: number;
  onSectionChange: (index: number) => void;
  selectedImageIndex: number;
  setSelectedImageIndex: (index: number) => void;
}
```

### Step 8.2: Extract Custom Hook

```typescript
// hooks/use-section-navigation.ts
export function useSectionNavigation(initialSection = 0) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleSectionChange = useCallback((index: number) => {
    setActiveSection(index);
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // Wheel navigation logic
    },
    [activeSection],
  );

  return {
    activeSection,
    selectedImageIndex,
    setSelectedImageIndex,
    handleSectionChange,
    handleWheel,
  };
}
```

### Step 8.3: Extract Left Column Components

```typescript
// components/left-column/left-column-navigation.tsx
export function LeftColumnNavigation({ ... }: SectionNavigationProps) {
  // Transform-based navigation logic
}

// components/left-column/card.tsx
export function Card({ section, index, isActive, onSectionChange }: CardProps) {
  // Individual card component
}
```

### Step 8.4: Extract Section Content Components

```typescript
// components/sections/overview-content.tsx
export function OverviewContent({ selectedImageIndex, setSelectedImageIndex }: OverviewProps) {
  // Overview section content
}

// components/sections/token-details-content.tsx
export function TokenDetailsContent() {
  // Token details section content
}
```

### Step 8.5: Clean Main Page

```typescript
// app/rwa/page.tsx (~50 lines)
export default function RWAPage() {
  const navigation = useSectionNavigation();

  return (
    <div className="min-h-screen bg-black text-white">
      <header>...</header>
      <div className="flex min-h-[calc(100vh-200px)]">
        <LeftColumnNavigation {...navigation} />
        <MiddleContentArea {...navigation} />
        <TokenSwapInterface />
      </div>
    </div>
  );
}
```

### Benefits of File Structure Refactoring:

- ✅ **Maintainability**: Each component has single responsibility
- ✅ **Testability**: Can unit test individual components
- ✅ **Reusability**: Components can be reused in other pages
- ✅ **Developer Experience**: Easier navigation and understanding
- ✅ **Code Quality**: Follows React best practices

### When to Execute Phase 8:

- ✅ After transform refactoring is 100% stable
- ✅ After all animation tests pass
- ✅ After team approval of new animation system
- ✅ When ready for next iteration cycle

---

## 📊 **Success Metrics**

### Code Quality:

- [ ] Lines of code reduced by >50%
- [ ] Cyclomatic complexity reduced
- [ ] Zero setTimeout/setInterval usage
- [ ] Single source of truth for state

### Performance:

- [ ] 60fps animations verified in dev tools
- [ ] Memory usage stable or reduced
- [ ] Bundle size impact minimal

### Maintainability:

- [ ] New developers can understand quickly
- [ ] Easy to add new sections
- [ ] Simple to modify animations
- [ ] Comprehensive test coverage

---

This guide ensures we maintain all functionality while achieving a more robust, performant, and maintainable solution. Ready to start with Phase 1?
